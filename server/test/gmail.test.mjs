// Happy-path tests for the Gmail integration.
//
// The real `googleapis` package is replaced with a test double so we never
// perform a live OAuth handshake or Gmail API call. The double mimics the
// shape of real OAuth2 client / Gmail API responses, and everything else
// (Express routing, JWT auth, Postgres reads/writes, receipt-parsing logic)
// runs for real.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

const {
  mockGenerateAuthUrl,
  mockGetToken,
  mockSetCredentials,
  mockRefreshAccessToken,
  mockMessagesList,
  mockMessagesGet,
} = vi.hoisted(() => ({
  mockGenerateAuthUrl: vi.fn(),
  mockGetToken: vi.fn(),
  mockSetCredentials: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
  mockMessagesList: vi.fn(),
  mockMessagesGet: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class OAuth2 {
        constructor(clientId, clientSecret, redirectUri) {
          this.clientId = clientId;
          this.clientSecret = clientSecret;
          this.redirectUri = redirectUri;
        }
        generateAuthUrl(...args) { return mockGenerateAuthUrl(...args); }
        getToken(...args) { return mockGetToken(...args); }
        setCredentials(...args) { return mockSetCredentials(...args); }
        refreshAccessToken(...args) { return mockRefreshAccessToken(...args); }
      },
    },
    gmail: () => ({
      users: {
        messages: {
          list: (...args) => mockMessagesList(...args),
          get: (...args) => mockMessagesGet(...args),
        },
      },
    }),
  },
}));

// Must be set before `server/index.js` is dynamically imported below — see
// the comment in plaid.test.mjs for why a dynamic import is required here.
process.env.NODE_ENV = 'test';
process.env.GMAIL_CLIENT_ID = 'test-gmail-client-id';
process.env.GMAIL_CLIENT_SECRET = 'test-gmail-client-secret';
process.env.GMAIL_REDIRECT_URI = 'http://localhost:3001/api/gmail/callback';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/subaudit_test';

const { app, initDb } = await import('../index.js');

let token;
let userId;
const email = `gmail-test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;

beforeAll(async () => {
  await initDb();
  await request(app).post('/api/auth/register').send({ email, password: 'test123' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'test123' });
  token = login.body.token;
  userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).id;
  expect(token).toBeTruthy();
});

describe('Gmail integration (OAuth + API responses mocked)', () => {
  it('returns a Google consent URL for the authenticated user', async () => {
    mockGenerateAuthUrl.mockReturnValueOnce('https://accounts.google.com/o/oauth2/v2/auth?mock=1');

    const res = await request(app)
      .get('/api/gmail/auth-url')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('accounts.google.com');
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({ scope: expect.arrayContaining(['https://www.googleapis.com/auth/gmail.readonly']) })
    );
  });

  it('completes the OAuth callback and stores tokens for the user', async () => {
    mockGetToken.mockResolvedValueOnce({
      tokens: {
        access_token: 'ya29.mock-access-token',
        refresh_token: '1//mock-refresh-token',
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        expiry_date: Date.now() + 3600 * 1000,
      },
    });

    const res = await request(app)
      .get('/api/gmail/callback')
      .query({ code: 'mock-auth-code', state: String(userId) });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('gmail=connected');

    const status = await request(app).get('/api/gmail/status').set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.connected).toBe(true);
  });

  it('scans recent mail and detects new subscription-looking receipts', async () => {
    mockMessagesList.mockResolvedValueOnce({ data: { messages: [{ id: 'msg-1' }, { id: 'msg-2' }] } });
    mockMessagesGet.mockImplementation(({ id }) => {
      const headers = id === 'msg-1'
        ? [
            { name: 'Subject', value: 'Your Spotify subscription receipt - $9.99' },
            { name: 'From', value: 'no-reply@spotify.com' },
            { name: 'Date', value: 'Mon, 1 Jun 2026 10:00:00 -0400' },
          ]
        : [
            { name: 'Subject', value: 'Your Netflix bill - $15.99' },
            { name: 'From', value: 'info@netflix.com' },
            { name: 'Date', value: 'Tue, 2 Jun 2026 10:00:00 -0400' },
          ];
      return Promise.resolve({ data: { payload: { headers } } });
    });

    const res = await request(app)
      .post('/api/gmail/scan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(2);
    expect(res.body.new_detected).toBe(2);
    const names = res.body.detected.map(d => d.serviceName);
    expect(names).toContain('Spotify');
    expect(names).toContain('Netflix');

    const detected = await request(app).get('/api/gmail/detected').set('Authorization', `Bearer ${token}`);
    expect(detected.status).toBe(200);
    expect(detected.body.length).toBe(2);
    expect(detected.body.every(d => d.status === 'pending')).toBe(true);
  });

  it('re-scanning the same messages does not create duplicates', async () => {
    mockMessagesList.mockResolvedValueOnce({ data: { messages: [{ id: 'msg-1' }] } });
    mockMessagesGet.mockResolvedValueOnce({
      data: {
        payload: {
          headers: [
            { name: 'Subject', value: 'Your Spotify subscription receipt - $9.99' },
            { name: 'From', value: 'no-reply@spotify.com' },
            { name: 'Date', value: 'Mon, 1 Jun 2026 10:00:00 -0400' },
          ],
        },
      },
    });

    const res = await request(app).post('/api/gmail/scan').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.new_detected).toBe(0);
  });

  it('converts a detected receipt into a tracked subscription', async () => {
    const detected = await request(app).get('/api/gmail/detected').set('Authorization', `Bearer ${token}`);
    const spotify = detected.body.find(d => d.service_name === 'Spotify');
    expect(spotify).toBeTruthy();

    const res = await request(app)
      .post('/api/gmail/convert')
      .set('Authorization', `Bearer ${token}`)
      .send({ detected_id: spotify.id });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const subs = await request(app).get('/api/subscriptions').set('Authorization', `Bearer ${token}`);
    expect(subs.body.some(s => s.name === 'Spotify' && s.source === 'gmail')).toBe(true);

    const detectedAfter = await request(app).get('/api/gmail/detected').set('Authorization', `Bearer ${token}`);
    const updated = detectedAfter.body.find(d => d.id === spotify.id);
    expect(updated.status).toBe('converted');
  });

  it('dismisses a detected receipt without creating a subscription', async () => {
    const detected = await request(app).get('/api/gmail/detected').set('Authorization', `Bearer ${token}`);
    const netflix = detected.body.find(d => d.service_name === 'Netflix');
    expect(netflix).toBeTruthy();

    const res = await request(app)
      .post('/api/gmail/dismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({ detected_id: netflix.id });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const detectedAfter = await request(app).get('/api/gmail/detected').set('Authorization', `Bearer ${token}`);
    const updated = detectedAfter.body.find(d => d.id === netflix.id);
    expect(updated.status).toBe('dismissed');
  });

  it('disconnects Gmail', async () => {
    const res = await request(app).delete('/api/gmail/disconnect').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const status = await request(app).get('/api/gmail/status').set('Authorization', `Bearer ${token}`);
    expect(status.body.connected).toBe(false);
  });
});
