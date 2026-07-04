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
});
