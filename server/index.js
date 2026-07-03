import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'data.db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'client', 'dist')));

let db;

async function initDb() {
  const SQL = await initSqlJs();
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      notify_before_days INTEGER DEFAULT 3,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      cost REAL NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      next_billing TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      monthly_budget REAL NOT NULL DEFAULT 0,
      UNIQUE(user_id, category),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS plaid_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, access_token TEXT NOT NULL,
      item_id TEXT NOT NULL, institution_name TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS plaid_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, plaid_transaction_id TEXT,
      name TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, category TEXT DEFAULT '',
      merchant_name TEXT DEFAULT '', pending INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS gmail_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE,
      access_token TEXT NOT NULL, refresh_token TEXT, scope TEXT, expiry_date INTEGER,
      created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS detected_subs_from_email (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, service_name TEXT NOT NULL,
      amount REAL, billing_cycle TEXT DEFAULT 'monthly', email_subject TEXT, email_date TEXT,
      status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  saveDb();
}

function saveDb() { const d = db.export(); writeFileSync(DB_PATH, Buffer.from(d)); }
function queryAll(sql, p = []) { const s = db.prepare(sql); s.bind(p); const r = []; while (s.step()) r.push(s.getAsObject()); s.free(); return r; }
function queryOne(sql, p = []) { const s = db.prepare(sql); s.bind(p); const r = s.step() ? s.getAsObject() : null; s.free(); return r; }

const authenticate = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next() }
  catch { res.status(401).json({ error: 'Invalid token' }) }
};

// ── Auth ──
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try { const hash = await bcrypt.hash(password, 10); db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash]); saveDb(); res.json({ ok: true }) }
  catch { res.status(400).json({ error: 'Email already registered' }) }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, email: user.email, notify_before_days: user.notify_before_days });
});

// ── Subscriptions CRUD ──
app.get('/api/subscriptions', authenticate, (req, res) => {
  res.json(queryAll('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_billing ASC', [req.user.id]));
});

app.post('/api/subscriptions', authenticate, (req, res) => {
  const { name, category, cost, billing_cycle, next_billing, notes, source } = req.body;
  if (!name || cost === undefined) return res.status(400).json({ error: 'Name and cost required' });
  db.run('INSERT INTO subscriptions (user_id, name, category, cost, billing_cycle, next_billing, notes, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, name, category || 'Other', cost, billing_cycle || 'monthly', next_billing || null, notes || '', source || 'manual']);
  const id = db.exec('SELECT last_insert_rowid()')[0]?.values?.[0]?.[0];
  saveDb();
  res.json({ id: id ?? 0 });
});

app.put('/api/subscriptions/:id', authenticate, (req, res) => {
  const sub = queryOne('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  const { name, category, cost, billing_cycle, next_billing, status, notes } = req.body;
  db.run('UPDATE subscriptions SET name=?, category=?, cost=?, billing_cycle=?, next_billing=?, status=?, notes=? WHERE id=?',
    [name ?? sub.name, category ?? sub.category, cost ?? sub.cost, billing_cycle ?? sub.billing_cycle, next_billing ?? sub.next_billing, status ?? sub.status, notes ?? sub.notes, req.params.id]);
  saveDb();
  res.json({ ok: true });
});

app.delete('/api/subscriptions/:id', authenticate, (req, res) => {
  db.run('DELETE FROM subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  saveDb();
  const changes = db.getRowsModified();
  if (changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── Summary ──
app.get('/api/summary', authenticate, (req, res) => {
  const subs = queryAll('SELECT * FROM subscriptions WHERE user_id = ? AND status = ?', [req.user.id, 'active']);
  const total = subs.reduce((s, x) => s + x.cost, 0);
  const monthly = subs.reduce((s, x) => s + (x.billing_cycle === 'monthly' ? x.cost : x.billing_cycle === 'yearly' ? x.cost / 12 : x.cost), 0);
  const upcoming = subs.filter(x => x.next_billing && new Date(x.next_billing) <= new Date(Date.now() + 7 * 86400000));
  const annual = subs.filter(x => x.billing_cycle === 'yearly');
  const byCategory = {};
  subs.forEach(x => { byCategory[x.category] = (byCategory[x.category] || 0) + x.cost; });

  // Budget comparison
  const budgets = queryAll('SELECT * FROM budgets WHERE user_id = ?', [req.user.id]);
  const budgetMap = {};
  budgets.forEach(b => { budgetMap[b.category] = b.monthly_budget; });
  const budgetVsActual = {};
  Object.entries(byCategory).forEach(([cat, actual]) => {
    budgetVsActual[cat] = { actual: Math.round(actual * 100) / 100, budget: budgetMap[cat] || 0 };
  });
  Object.entries(budgetMap).forEach(([cat, budget]) => {
    if (!budgetVsActual[cat]) budgetVsActual[cat] = { actual: 0, budget };
  });

  res.json({
    total: Math.round(total * 100) / 100, monthly: Math.round(monthly * 100) / 100,
    count: subs.length, upcoming, annual, budgetVsActual, byCategory
  });
});

// ── Budgets ──
app.get('/api/budgets', authenticate, (req, res) => {
  res.json(queryAll('SELECT * FROM budgets WHERE user_id = ?', [req.user.id]));
});

app.put('/api/budgets', authenticate, (req, res) => {
  const { category, monthly_budget } = req.body;
  if (!category) return res.status(400).json({ error: 'Category required' });
  db.run('INSERT OR REPLACE INTO budgets (user_id, category, monthly_budget) VALUES (?, ?, ?)',
    [req.user.id, category, monthly_budget || 0]);
  saveDb();
  res.json({ ok: true });
});

// ── Price Comparison ──
const AVG_PRICES = {
  'Netflix': { monthly: 15.49, yearly: 185.88 },
  'Spotify': { monthly: 10.99, yearly: 131.88 },
  'Disney+': { monthly: 13.99, yearly: 139.99 },
  'Amazon Prime': { monthly: 14.99, yearly: 139 },
  'HBO Max': { monthly: 15.99, yearly: 149.99 },
  'Apple TV+': { monthly: 9.99, yearly: 99 },
  'Hulu': { monthly: 7.99, yearly: 95.88 },
  'YouTube Premium': { monthly: 13.99, yearly: 139.99 },
  'Apple Music': { monthly: 10.99, yearly: 109 },
  'Tidal': { monthly: 10.99, yearly: 131.88 },
  'Deezer': { monthly: 10.99, yearly: 131.88 },
  'Audible': { monthly: 14.95, yearly: 149.50 },
  'Microsoft 365': { monthly: 9.99, yearly: 99.99 },
  'Google One': { monthly: 1.99, yearly: 19.99 },
  'iCloud+': { monthly: 2.99, yearly: 35.88 },
  'Dropbox': { monthly: 11.99, yearly: 119.88 },
  'Slack': { monthly: 8.67, yearly: 104 },
  'Notion': { monthly: 10, yearly: 96 },
  'GitHub': { monthly: 4, yearly: 48 },
  'Figma': { monthly: 12, yearly: 144 },
  'Canva': { monthly: 12.99, yearly: 119.99 },
  'Adobe CC': { monthly: 54.99, yearly: 659.88 },
  'Peloton': { monthly: 44, yearly: 528 },
  'Planet Fitness': { monthly: 10, yearly: 120 },
  'GoodLife': { monthly: 49.99, yearly: 599.88 },
  'Crunch Fitness': { monthly: 9.99, yearly: 119.88 },
  'Duolingo': { monthly: 6.99, yearly: 83.99 },
  'Headspace': { monthly: 12.99, yearly: 69.99 },
  'Calm': { monthly: 14.99, yearly: 69.99 },
  'MasterClass': { monthly: 15, yearly: 180 },
};

app.get('/api/price-compare', authenticate, (req, res) => {
  const subs = queryAll('SELECT * FROM subscriptions WHERE user_id = ? AND status = ?', [req.user.id, 'active']);
  const results = [];
  subs.forEach(s => {
    const avg = AVG_PRICES[s.name];
    if (avg) {
      const userMonthly = s.billing_cycle === 'monthly' ? s.cost : s.billing_cycle === 'yearly' ? s.cost / 12 : s.cost;
      const avgMonthly = avg.monthly;
      results.push({ name: s.name, userCost: s.cost, userCycle: s.billing_cycle, avgMonthly, userMonthly: Math.round(userMonthly * 100) / 100, diff: Math.round((userMonthly - avgMonthly) * 100) / 100 });
    }
  });
  res.json(results);
});

// ── Export ──
app.get('/api/export/csv', authenticate, (req, res) => {
  const subs = queryAll('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY status ASC, next_billing ASC', [req.user.id]);
  let csv = 'Name,Category,Cost,Billing Cycle,Next Billing,Status,Source,Notes\n';
  subs.forEach(s => {
    csv += `"${s.name}","${s.category}",${s.cost},"${s.billing_cycle}","${s.next_billing || ''}","${s.status}","${s.source || ''}","${(s.notes || '').replace(/"/g, '""')}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=subscriptions.csv');
  res.send(csv);
});

// ═══════════════════════════════════════════════
//  PLAID INTEGRATION
// ═══════════════════════════════════════════════

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || '';
const PLAID_SECRET = process.env.PLAID_SECRET || '';
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

let plaidClient = null;
if (PLAID_CLIENT_ID && PLAID_SECRET) {
  const config = new Configuration({ basePath: PlaidEnvironments[PLAID_ENV], baseOptions: { headers: { 'PLAID-CLIENT-ID': PLAID_CLIENT_ID, 'PLAID-SECRET': PLAID_SECRET } } });
  plaidClient = new PlaidApi(config);
}

app.post('/api/plaid/create-link-token', authenticate, async (req, res) => {
  if (!plaidClient) return res.status(400).json({ error: 'Plaid not configured.' });
  try {
    const r = await plaidClient.linkTokenCreate({ user: { client_user_id: String(req.user.id) }, client_name: 'Subscription Auditor', products: [Products.Transactions], country_codes: [CountryCode.Ca, CountryCode.Us], language: 'en' });
    res.json({ link_token: r.data.link_token });
  } catch (err) { res.status(500).json({ error: err.message }) }
});

app.post('/api/plaid/exchange-token', authenticate, async (req, res) => {
  if (!plaidClient) return res.status(400).json({ error: 'Plaid not configured.' });
  try {
    const ex = await plaidClient.itemPublicTokenExchange({ public_token: req.body.public_token });
    db.run('INSERT OR REPLACE INTO plaid_tokens (user_id, access_token, item_id, institution_name) VALUES (?, ?, ?, ?)',
      [req.user.id, ex.data.access_token, ex.data.item_id, req.body.institution_name || '']);
    saveDb(); res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }) }
});

app.get('/api/plaid/connections', authenticate, (req, res) => {
  res.json(queryAll('SELECT id, item_id, institution_name FROM plaid_tokens WHERE user_id = ?', [req.user.id]));
});

app.post('/api/plaid/sync', authenticate, async (req, res) => {
  if (!plaidClient) return res.status(400).json({ error: 'Plaid not configured.' });
  const tokens = queryAll('SELECT * FROM plaid_tokens WHERE user_id = ?', [req.user.id]);
  if (tokens.length === 0) return res.status(400).json({ error: 'No bank connected.' });
  const allNew = [];
  for (const t of tokens) {
    try {
      const r = await plaidClient.transactionsSync({ access_token: t.access_token });
      for (const tx of r.data.added) {
        if (queryOne('SELECT id FROM plaid_transactions WHERE plaid_transaction_id = ?', [tx.transaction_id])) continue;
        db.run('INSERT INTO plaid_transactions (user_id, plaid_transaction_id, name, amount, date, category, merchant_name, pending) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [req.user.id, tx.transaction_id, tx.name, Math.abs(tx.amount), tx.date, (tx.category || []).join(', '), tx.merchant_name || '', tx.pending ? 1 : 0]);
        allNew.push({ name: tx.name, amount: Math.abs(tx.amount), date: tx.date });
      }
    } catch (err) { console.error('Plaid sync error:', err.message) }
  }
  saveDb();
  const recurring = queryAll(`SELECT merchant_name, name, COUNT(*) as count, ROUND(AVG(amount),2) as avg_amount, MIN(date) as first, MAX(date) as last FROM plaid_transactions WHERE user_id=? AND pending=0 GROUP BY merchant_name HAVING count>=2 ORDER BY count DESC`, [req.user.id]);
  res.json({ imported: allNew.length, total: queryAll('SELECT COUNT(*) as c FROM plaid_transactions WHERE user_id=?', [req.user.id])[0].c, recurring });
});

app.post('/api/plaid/convert-sub', authenticate, (req, res) => {
  const { merchant_name, avg_amount } = req.body;
  if (!merchant_name) return res.status(400).json({ error: 'merchant_name required' });
  if (queryOne('SELECT id FROM subscriptions WHERE user_id=? AND name=?', [req.user.id, merchant_name])) return res.status(400).json({ error: 'Already added' });
  db.run('INSERT INTO subscriptions (user_id, name, category, cost, billing_cycle, source) VALUES (?,?,?,?,?,?)', [req.user.id, merchant_name, 'Other', avg_amount || 0, 'monthly', 'plaid']);
  saveDb(); res.json({ ok: true });
});

// ═══════════════════════════════════════════════
//  GMAIL INTEGRATION
// ═══════════════════════════════════════════════

import { google } from 'googleapis';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || `${BASE_URL}/api/gmail/callback`;

app.get('/api/gmail/auth-url', authenticate, (req, res) => {
  if (!GMAIL_CLIENT_ID) return res.status(400).json({ error: 'Gmail not configured.' });
  const oauth2 = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
  res.json({ url: oauth2.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/gmail.readonly'], state: String(req.user.id) }) });
});

app.get('/api/gmail/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');
  try {
    const oauth2 = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
    const { tokens } = await oauth2.getToken(code);
    db.run('INSERT OR REPLACE INTO gmail_tokens (user_id, access_token, refresh_token, scope, expiry_date) VALUES (?,?,?,?,?)',
      [Number(state), tokens.access_token, tokens.refresh_token || '', tokens.scope || '', tokens.expiry_date || 0]);
    saveDb();
    res.redirect((process.env.CLIENT_URL || 'http://localhost:5173') + '/?gmail=connected');
  } catch (err) { res.status(500).send('Gmail auth failed: ' + err.message) }
});

app.get('/api/gmail/status', authenticate, (req, res) => {
  const t = queryOne('SELECT id, expiry_date FROM gmail_tokens WHERE user_id=?', [req.user.id]);
  res.json({ connected: !!t, expiry: t?.expiry_date || null });
});

app.delete('/api/gmail/disconnect', authenticate, (req, res) => {
  db.run('DELETE FROM gmail_tokens WHERE user_id=?', [req.user.id]); saveDb(); res.json({ ok: true });
});

app.post('/api/gmail/scan', authenticate, async (req, res) => {
  const tokenRow = queryOne('SELECT * FROM gmail_tokens WHERE user_id=?', [req.user.id]);
  if (!tokenRow) return res.status(400).json({ error: 'Gmail not connected' });
  try {
    const oauth2 = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
    oauth2.setCredentials({ access_token: tokenRow.access_token, refresh_token: tokenRow.refresh_token, expiry_date: tokenRow.expiry_date });
    if (tokenRow.expiry_date && Date.now() > tokenRow.expiry_date) {
      const { credentials } = await oauth2.refreshAccessToken();
      db.run('UPDATE gmail_tokens SET access_token=?, refresh_token=?, expiry_date=? WHERE user_id=?',
        [credentials.access_token, credentials.refresh_token || tokenRow.refresh_token, credentials.expiry_date, req.user.id]);
      saveDb(); oauth2.setCredentials(credentials);
    }
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const listRes = await gmail.users.messages.list({ userId: 'me', q: `after:${new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]}`, maxResults: 20 });
    const messages = listRes.data.messages || [];
    const detected = [];
    for (const msg of messages) {
      const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
      const h = detail.data.payload.headers;
      const subject = h.find(x => x.name === 'Subject')?.value || '';
      const from = h.find(x => x.name === 'From')?.value || '';
      const date = h.find(x => x.name === 'Date')?.value || '';
      const m = subject.match(/(your\s+)?(.+?)\s+(subscription|receipt|bill|charge)/i);
      const am = subject.match(/[\$£€](\d+\.?\d*)/);
      const name = m ? m[2].trim() : subject.split(' - ')[0]?.trim() || from.split('<')[0].trim();
      if (!queryOne('SELECT id FROM detected_subs_from_email WHERE user_id=? AND service_name=?', [req.user.id, name])) {
        db.run('INSERT INTO detected_subs_from_email (user_id, service_name, amount, billing_cycle, email_subject, email_date) VALUES (?,?,?,?,?,?)',
          [req.user.id, name, am ? parseFloat(am[1]) : null, 'monthly', subject, date]);
        detected.push({ serviceName: name, amount: am ? parseFloat(am[1]) : null, subject, from, date });
      }
    }
    saveDb(); res.json({ scanned: messages.length, new_detected: detected.length, detected });
  } catch (err) { res.status(500).json({ error: err.message }) }
});

app.get('/api/gmail/detected', authenticate, (req, res) => {
  res.json(queryAll('SELECT * FROM detected_subs_from_email WHERE user_id=? ORDER BY created_at DESC', [req.user.id]));
});

app.post('/api/gmail/convert', authenticate, (req, res) => {
  const d = queryOne('SELECT * FROM detected_subs_from_email WHERE id=? AND user_id=?', [req.body.detected_id, req.user.id]);
  if (!d) return res.status(404).json({ error: 'Not found' });
  db.run('INSERT INTO subscriptions (user_id, name, category, cost, billing_cycle, source, notes) VALUES (?,?,?,?,?,?,?)',
    [req.user.id, d.service_name, 'Other', d.amount || 0, d.billing_cycle, 'gmail', 'From: ' + d.email_subject]);
  db.run('UPDATE detected_subs_from_email SET status=? WHERE id=?', ['converted', req.body.detected_id]);
  saveDb(); res.json({ ok: true });
});

app.post('/api/gmail/dismiss', authenticate, (req, res) => {
  db.run('UPDATE detected_subs_from_email SET status=? WHERE id=? AND user_id=?', ['dismissed', req.body.detected_id, req.user.id]);
  saveDb(); res.json({ ok: true });
});

// ═══════════════════════════════════════════════
//  EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════

import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@subscription-auditor.app';

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS }, tls: { rejectUnauthorized: false } });
}

app.get('/api/notify/settings', authenticate, (req, res) => {
  const u = queryOne('SELECT email, notify_before_days FROM users WHERE id=?', [req.user.id]);
  res.json({ email: u.email, notify_before_days: u.notify_before_days });
});

app.put('/api/notify/settings', authenticate, (req, res) => {
  db.run('UPDATE users SET notify_before_days=? WHERE id=?', [req.body.notify_before_days ?? 3, req.user.id]);
  saveDb(); res.json({ ok: true });
});

app.get('/api/notify/preview', authenticate, (req, res) => {
  const u = queryOne('SELECT * FROM users WHERE id=?', [req.user.id]);
  const days = u.notify_before_days || 3;
  const c = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  const upcoming = queryAll('SELECT * FROM subscriptions WHERE user_id=? AND status=? AND next_billing IS NOT NULL AND next_billing<=? ORDER BY next_billing ASC', [req.user.id, 'active', c]);
  const annual = queryAll('SELECT * FROM subscriptions WHERE user_id=? AND status=? AND billing_cycle=?', [req.user.id, 'active', 'yearly']);
  res.json({ days, upcoming, annual });
});

app.post('/api/notify/send', authenticate, async (req, res) => {
  if (!transporter) return res.status(400).json({ error: 'SMTP not configured.' });
  const u = queryOne('SELECT * FROM users WHERE id=?', [req.user.id]);
  const days = u.notify_before_days || 3;
  const c = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  const upcoming = queryAll('SELECT * FROM subscriptions WHERE user_id=? AND status=? AND next_billing IS NOT NULL AND next_billing<=? ORDER BY next_billing ASC', [req.user.id, 'active', c]);
  if (upcoming.length === 0) return res.json({ sent: false, reason: 'No upcoming' });
  const total = upcoming.reduce((s, x) => s + x.cost, 0);
  const htmlLines = upcoming.map(s => `<li><b>${s.name}</b> — $${s.cost.toFixed(2)} <span style="color:#888">(due ${s.next_billing})</span></li>`).join('');
  const annualLines = upcoming.filter(s => s.billing_cycle === 'yearly').map(s => `<li><b>${s.name}</b> — $${s.cost.toFixed(2)}/yr <span style="color:#888">(due ${s.next_billing})</span></li>`).join('');
  try {
    await transporter.sendMail({
      from: FROM_EMAIL, to: u.email,
      subject: `Subscription Auditor — ${upcoming.length} upcoming renewal(s)`,
      html: `<h2>Upcoming Renewals (${days} day window)</h2><ul>${htmlLines}</ul><p><b>Total: $${total.toFixed(2)}</b></p>${annualLines ? `<h3>Annual Subscriptions</h3><ul>${annualLines}</ul>` : ''}`,
    });
    res.json({ sent: true, count: upcoming.length });
  } catch (err) { res.status(500).json({ error: err.message }) }
});

// ── Client fallback (production) ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
});

// ── Migrations ──
function migrate() {
  try { db.run('ALTER TABLE users ADD COLUMN notify_before_days INTEGER DEFAULT 3'); } catch {}
  try { db.run('ALTER TABLE subscriptions ADD COLUMN source TEXT DEFAULT "manual"'); } catch {}
  try { db.run('ALTER TABLE detected_subs_from_email ADD COLUMN status TEXT DEFAULT "pending"'); } catch {}
  saveDb();
}

await initDb();
migrate();
app.listen(PORT, () => console.log(`Server running on ${BASE_URL}`));
