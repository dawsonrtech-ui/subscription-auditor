// Happy-path tests for the Plaid integration.
//
// We never call the real Plaid API. Instead we replace the `plaid` package
// with a test double (via vi.mock) whose responses look like what Plaid's
// sandbox environment actually returns, and exercise the full route ->
// Express -> Postgres pipeline through supertest. This gives us confidence
// that our request/response shapes and DB writes are correct without any
// live Plaid credentials or network access.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

const {
  mockLinkTokenCreate,
  mockItemPublicTokenExchange,
  mockTransactionsSync,
} = vi.hoisted(() => ({
  mockLinkTokenCreate: vi.fn(),
  mockItemPublicTokenExchange: vi.fn(),
  mockTransactionsSync: vi.fn(),
}));

vi.mock('plaid', () => ({
  Configuration: class Configuration {
    constructor(opts) { this.opts = opts; }
  },
  PlaidEnvironments: { sandbox: 'https://sandbox.plaid.com', production: 'https://production.plaid.com' },
  Products: { Transactions: 'transactions' },
  CountryCode: { Us: 'US', Ca: 'CA' },
  PlaidApi: class PlaidApi {
    linkTokenCreate(...args) { return mockLinkTokenCreate(...args); }
    itemPublicTokenExchange(...args) { return mockItemPublicTokenExchange(...args); }
    transactionsSync(...args) { return mockTransactionsSync(...args); }
  },
}));

// These must be set before `server/index.js` is imported, since the module
// only constructs a `plaidClient` (from the mocked `plaid` package above) if
// PLAID_CLIENT_ID/PLAID_SECRET are present at import time. Using a dynamic
// `import()` (rather than a static one) means these assignments actually run
// first — static imports are hoisted above ordinary statements in ESM.
process.env.NODE_ENV = 'test';
process.env.PLAID_CLIENT_ID = 'test-plaid-client-id';
process.env.PLAID_SECRET = 'test-plaid-secret';
process.env.PLAID_ENV = 'sandbox';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/subaudit_test';

const { app, initDb } = await import('../index.js');

let token;
const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const email = `plaid-test-${runId}@test.com`;

beforeAll(async () => {
  await initDb();
  await request(app).post('/api/auth/register').send({ email, password: 'test123' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'test123' });
  token = login.body.token;
  expect(token).toBeTruthy();
});

describe('Plaid integration (sandbox responses mocked)', () => {
  it('creates a Link token for the authenticated user', async () => {
    mockLinkTokenCreate.mockResolvedValueOnce({ data: { link_token: 'link-sandbox-abc123', expiration: '2026-08-01T00:00:00Z' } });

    const res = await request(app)
      .post('/api/plaid/create-link-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.link_token).toBe('link-sandbox-abc123');
    expect(mockLinkTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({ client_name: 'Subscription Auditor' })
    );
  });

  it('exchanges a public token for an access token and stores the connection', async () => {
    mockItemPublicTokenExchange.mockResolvedValueOnce({
      data: { access_token: 'access-sandbox-xyz789', item_id: 'item-sandbox-1' },
    });

    const exchangeRes = await request(app)
      .post('/api/plaid/exchange-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ public_token: 'public-sandbox-1', institution_name: 'Sandbox Test Bank' });

    expect(exchangeRes.status).toBe(200);
    expect(exchangeRes.body.ok).toBe(true);

    const connections = await request(app)
      .get('/api/plaid/connections')
      .set('Authorization', `Bearer ${token}`);

    expect(connections.status).toBe(200);
    expect(connections.body.some(c => c.institution_name === 'Sandbox Test Bank')).toBe(true);
  });

  it('syncs transactions and surfaces recurring merchants', async () => {
    mockTransactionsSync.mockResolvedValueOnce({
      data: {
        added: [
          { transaction_id: `tx-${runId}-1`, name: 'Netflix.com', amount: 15.99, date: '2026-05-01', category: ['Entertainment'], merchant_name: 'Netflix', pending: false },
          { transaction_id: `tx-${runId}-2`, name: 'Netflix.com', amount: 15.99, date: '2026-06-01', category: ['Entertainment'], merchant_name: 'Netflix', pending: false },
          { transaction_id: `tx-${runId}-3`, name: 'Coffee Shop', amount: 4.50, date: '2026-06-02', category: ['Food and Drink'], merchant_name: 'Local Cafe', pending: false },
        ],
        next_cursor: 'cursor-page-1',
        has_more: false,
      },
    });

    const res = await request(app)
      .post('/api/plaid/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(3);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    const netflixRecurring = res.body.recurring.find(r => r.merchant_name === 'Netflix');
    expect(netflixRecurring).toBeTruthy();
    expect(Number(netflixRecurring.count)).toBe(2);
  });

  it('re-syncing with an empty added list does not duplicate transactions', async () => {
    mockTransactionsSync.mockResolvedValueOnce({
      data: { added: [], next_cursor: 'cursor-page-2', has_more: false },
    });

    const before = await request(app).get('/api/plaid/connections').set('Authorization', `Bearer ${token}`);
    const res = await request(app).post('/api/plaid/sync').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(0);
    expect(before.status).toBe(200);
  });

  it('converts a recurring merchant into a tracked subscription', async () => {
    const res = await request(app)
      .post('/api/plaid/convert-sub')
      .set('Authorization', `Bearer ${token}`)
      .send({ merchant_name: 'Netflix', avg_amount: 15.99 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const subs = await request(app).get('/api/subscriptions').set('Authorization', `Bearer ${token}`);
    const created = subs.body.find(s => s.name === 'Netflix' && s.source === 'plaid');
    expect(created).toBeTruthy();
    expect(Number(created.cost)).toBeCloseTo(15.99);
  });

  it('rejects sync for a user with no bank connected', async () => {
    const freshEmail = `plaid-nobank-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
    await request(app).post('/api/auth/register').send({ email: freshEmail, password: 'test123' });
    const login = await request(app).post('/api/auth/login').send({ email: freshEmail, password: 'test123' });

    const res = await request(app)
      .post('/api/plaid/sync')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no bank/i);
  });

  it('returns a 500 with the Plaid error message when link token creation fails', async () => {
    mockLinkTokenCreate.mockRejectedValueOnce(new Error('INVALID_API_KEYS'));

    const res = await request(app)
      .post('/api/plaid/create-link-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INVALID_API_KEYS');
  });

  describe('webhooks and update mode (re-auth)', () => {
    let reauthToken;
    let reauthItemId;

    beforeAll(async () => {
      const reauthEmail = `plaid-reauth-${runId}@test.com`;
      await request(app).post('/api/auth/register').send({ email: reauthEmail, password: 'test123' });
      const login = await request(app).post('/api/auth/login').send({ email: reauthEmail, password: 'test123' });
      reauthToken = login.body.token;
      reauthItemId = `item-sandbox-reauth-${runId}`;

      mockItemPublicTokenExchange.mockResolvedValueOnce({
        data: { access_token: 'access-sandbox-reauth', item_id: reauthItemId },
      });
      await request(app)
        .post('/api/plaid/exchange-token')
        .set('Authorization', `Bearer ${reauthToken}`)
        .send({ public_token: 'public-sandbox-reauth', institution_name: 'Reauth Bank' });
    });

    it('is not flagged for reauth right after connecting', async () => {
      const connections = await request(app).get('/api/plaid/connections').set('Authorization', `Bearer ${reauthToken}`);
      const conn = connections.body.find(c => c.item_id === reauthItemId);
      expect(conn.needs_reauth).toBe(false);
    });

    it('flags a connection needing reauth when Plaid sends an ITEM_LOGIN_REQUIRED webhook', async () => {
      const res = await request(app).post('/api/plaid/webhook').send({
        webhook_type: 'ITEM',
        webhook_code: 'ERROR',
        item_id: reauthItemId,
        error: { error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'the login details of this item have changed' },
      });
      expect(res.status).toBe(200);

      const connections = await request(app).get('/api/plaid/connections').set('Authorization', `Bearer ${reauthToken}`);
      const conn = connections.body.find(c => c.item_id === reauthItemId);
      expect(conn.needs_reauth).toBe(true);
    });

    it('ignores ITEM ERROR webhooks for unrelated error codes', async () => {
      const res = await request(app).post('/api/plaid/webhook').send({
        webhook_type: 'ITEM',
        webhook_code: 'ERROR',
        item_id: reauthItemId,
        error: { error_code: 'RATE_LIMIT_EXCEEDED' },
      });
      expect(res.status).toBe(200);
      // Already true from the previous test; a non-login error shouldn't
      // have changed it (it also shouldn't clear a flag it didn't set).
      const connections = await request(app).get('/api/plaid/connections').set('Authorization', `Bearer ${reauthToken}`);
      expect(connections.body.find(c => c.item_id === reauthItemId).needs_reauth).toBe(true);
    });

    it('creates an update-mode link token scoped to the flagged item', async () => {
      mockLinkTokenCreate.mockResolvedValueOnce({ data: { link_token: 'link-sandbox-update-mode' } });

      const res = await request(app)
        .post('/api/plaid/create-link-token')
        .set('Authorization', `Bearer ${reauthToken}`)
        .send({ item_id: reauthItemId });

      expect(res.status).toBe(200);
      expect(res.body.link_token).toBe('link-sandbox-update-mode');
      expect(mockLinkTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: 'access-sandbox-reauth', products: undefined })
      );
    });

    it('rejects an update-mode request for an item_id that does not belong to the user', async () => {
      const res = await request(app)
        .post('/api/plaid/create-link-token')
        .set('Authorization', `Bearer ${token}`) // the main test user, not reauthToken's owner
        .send({ item_id: reauthItemId });

      expect(res.status).toBe(404);
    });

    it('clears needs_reauth after re-exchanging a token for the same item (simulating a completed update-mode Link flow)', async () => {
      mockItemPublicTokenExchange.mockResolvedValueOnce({
        data: { access_token: 'access-sandbox-reauth', item_id: reauthItemId },
      });
      await request(app)
        .post('/api/plaid/exchange-token')
        .set('Authorization', `Bearer ${reauthToken}`)
        .send({ public_token: 'public-sandbox-reauth-2', institution_name: 'Reauth Bank' });

      const connections = await request(app).get('/api/plaid/connections').set('Authorization', `Bearer ${reauthToken}`);
      expect(connections.body.find(c => c.item_id === reauthItemId).needs_reauth).toBe(false);
    });

    it('flags needs_reauth as a fallback when a sync call itself hits ITEM_LOGIN_REQUIRED', async () => {
      const err = new Error('ITEM_LOGIN_REQUIRED');
      mockTransactionsSync.mockRejectedValueOnce(err);

      await request(app).post('/api/plaid/sync').set('Authorization', `Bearer ${reauthToken}`);

      const connections = await request(app).get('/api/plaid/connections').set('Authorization', `Bearer ${reauthToken}`);
      expect(connections.body.find(c => c.item_id === reauthItemId).needs_reauth).toBe(true);
    });
  });

  describe('pagination and partial failures', () => {
    let pagedToken;
    let pagedEmail;

    beforeAll(async () => {
      pagedEmail = `plaid-paged-${runId}@test.com`;
      await request(app).post('/api/auth/register').send({ email: pagedEmail, password: 'test123' });
      const login = await request(app).post('/api/auth/login').send({ email: pagedEmail, password: 'test123' });
      pagedToken = login.body.token;

      mockItemPublicTokenExchange.mockResolvedValueOnce({
        data: { access_token: 'access-sandbox-paged', item_id: 'item-sandbox-paged' },
      });
      await request(app)
        .post('/api/plaid/exchange-token')
        .set('Authorization', `Bearer ${pagedToken}`)
        .send({ public_token: 'public-sandbox-paged', institution_name: 'Paged Bank' });
    });

    it('walks multiple transactionsSync pages until has_more is false', async () => {
      mockTransactionsSync.mockClear();
      mockTransactionsSync
        .mockResolvedValueOnce({
          data: {
            added: [{ transaction_id: `tx-${runId}-page1`, name: 'Hulu', amount: 7.99, date: '2026-05-01', category: ['Entertainment'], merchant_name: 'Hulu', pending: false }],
            next_cursor: 'cursor-page-a',
            has_more: true,
          },
        })
        .mockResolvedValueOnce({
          data: {
            added: [{ transaction_id: `tx-${runId}-page2`, name: 'Hulu', amount: 7.99, date: '2026-06-01', category: ['Entertainment'], merchant_name: 'Hulu', pending: false }],
            next_cursor: 'cursor-page-b',
            has_more: false,
          },
        });

      const res = await request(app).post('/api/plaid/sync').set('Authorization', `Bearer ${pagedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(2);
      expect(mockTransactionsSync).toHaveBeenCalledTimes(2);
      // Second call should resume from the cursor returned by the first page.
      expect(mockTransactionsSync.mock.calls[mockTransactionsSync.mock.calls.length - 1][0]).toMatchObject({ cursor: 'cursor-page-a' });
    });

    it('does not fail the whole request when Plaid returns an item error (e.g. ITEM_LOGIN_REQUIRED)', async () => {
      mockTransactionsSync.mockRejectedValueOnce(new Error('ITEM_LOGIN_REQUIRED'));

      const res = await request(app).post('/api/plaid/sync').set('Authorization', `Bearer ${pagedToken}`);

      // The route logs and swallows per-connection Plaid errors so one broken
      // bank connection doesn't take down the whole sync response.
      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(0);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });
  });
});
