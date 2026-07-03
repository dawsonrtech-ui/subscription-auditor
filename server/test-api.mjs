const BASE = 'http://localhost:3001/api';
let token = '';
let pass = 0, fail = 0;

async function t(name, fn) {
  try { await fn(); pass++; console.log(`  PASS  ${name}`) }
  catch (e) { fail++; console.log(`  FAIL  ${name}: ${e.message}`) }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed') }
function eq(a, b) { assert(a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...opts.headers },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, headers: res.headers };
}

console.log('\n=== Auth ===');
await t('Register a new user', async () => {
  const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'testapi@test.com', password: 'test123' }) });
  eq(r.status, 200); eq(r.body.ok, true);
});
await t('Register duplicate email rejected', async () => {
  const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'testapi@test.com', password: 'test123' }) });
  eq(r.status, 400); assert(r.body.error);
});
await t('Register rejects missing password', async () => {
  const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: 'nopass@test.com' }) });
  eq(r.status, 400);
});
await t('Login with valid credentials', async () => {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'testapi@test.com', password: 'test123' }) });
  eq(r.status, 200); assert(r.body.token); assert(r.body.email === 'testapi@test.com');
  token = r.body.token;
});
await t('Login with wrong password rejected', async () => {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'testapi@test.com', password: 'wrong' }) });
  eq(r.status, 401);
});

console.log('\n=== Subscriptions CRUD ===');
let subId;
await t('Get subscriptions (empty)', async () => {
  const r = await api('/subscriptions'); eq(r.status, 200); eq(r.body.length, 0);
});
await t('Add subscription', async () => {
  const r = await api('/subscriptions', { method: 'POST', body: JSON.stringify({ name: 'Netflix', category: 'Streaming', cost: 15.99, billing_cycle: 'monthly', next_billing: '2026-08-15' }) });
  eq(r.status, 200); assert(r.body.id); subId = r.body.id;
});
await t('Add subscription rejects missing name', async () => {
  const r = await api('/subscriptions', { method: 'POST', body: JSON.stringify({ cost: 10 }) });
  eq(r.status, 400);
});
await t('Add subscription rejects negative cost', async () => {
  const r = await api('/subscriptions', { method: 'POST', body: JSON.stringify({ name: 'Bad', cost: -5 }) });
  eq(r.status, 400);
});
await t('Add subscription rejects non-numeric cost', async () => {
  const r = await api('/subscriptions', { method: 'POST', body: JSON.stringify({ name: 'Bad', cost: 'abc' }) });
  eq(r.status, 400);
});
await t('Get subscriptions (1 item)', async () => {
  const r = await api('/subscriptions'); eq(r.status, 200); eq(r.body.length, 1); eq(r.body[0].name, 'Netflix');
});
await t('Update subscription', async () => {
  const r = await api('/subscriptions/' + subId, { method: 'PUT', body: JSON.stringify({ cost: 17.99 }) });
  eq(r.status, 200); eq(r.body.ok, true);
});
await t('Update to negative cost rejected', async () => {
  const r = await api('/subscriptions/' + subId, { method: 'PUT', body: JSON.stringify({ cost: -10 }) });
  eq(r.status, 400);
});
await t('Update non-existent returns 404', async () => {
  const r = await api('/subscriptions/999999', { method: 'PUT', body: JSON.stringify({ name: 'Ghost' }) });
  eq(r.status, 404);
});
await t('Delete non-existent returns 404', async () => {
  const r = await api('/subscriptions/999999', { method: 'DELETE' });
  eq(r.status, 404);
});

console.log('\n=== Summary ===');
await t('Summary returns stats', async () => {
  const r = await api('/summary'); eq(r.status, 200);
  assert(r.body.count === 1); assert(r.body.monthly > 0);
  assert(typeof r.body.total === 'number'); assert(Array.isArray(r.body.upcoming));
  assert(Array.isArray(r.body.cancelled));
});

console.log('\n=== Projection ===');
await t('Projection returns 12 months', async () => {
  const r = await api('/projection'); eq(r.status, 200);
  eq(r.body.months.length, 12); assert(r.body.annualTotal > 0);
});
await t('Projection has category breakdown', async () => {
  const r = await api('/projection');
  const hasCat = r.body.months.some(m => Object.keys(m.byCategory).length > 0);
  assert(hasCat);
});

console.log('\n=== Cost History ===');
await t('Cost history returns array', async () => {
  const r = await api('/cost-history'); eq(r.status, 200);
  assert(Array.isArray(r.body));
});

console.log('\n=== Budgets ===');
await t('Budgets returns empty initially', async () => {
  const r = await api('/budgets'); eq(r.status, 200); eq(r.body.length, 0);
});
await t('Set budget', async () => {
  const r = await api('/budgets', { method: 'PUT', body: JSON.stringify({ category: 'Streaming', monthly_budget: 50 }) });
  eq(r.status, 200);
});
await t('Budget appears in list', async () => {
  const r = await api('/budgets'); eq(r.status, 200); eq(r.body.length, 1); eq(r.body[0].category, 'Streaming');
});
await t('Budget reflects in summary', async () => {
  const r = await api('/summary');
  assert(r.body.budgetVsActual.Streaming);
  eq(r.body.budgetVsActual.Streaming.budget, 50);
});

console.log('\n=== Price Compare ===');
await t('Price compare matches Netflix', async () => {
  const r = await api('/price-compare'); eq(r.status, 200);
  const netflix = r.body.find(p => p.name === 'Netflix');
  assert(netflix); assert(netflix.avgMonthly > 0);
});

console.log('\n=== Export CSV ===');
await t('CSV export returns text/csv', async () => {
  const r = await api('/export/csv'); eq(r.status, 200);
  assert(r.headers.get('content-type').includes('text/csv'));
  assert(r.headers.get('content-disposition').includes('.csv'));
});

console.log('\n=== Auth guard ===');
await t('No token returns 401', async () => {
  const r = await fetch(BASE + '/subscriptions');
  eq(r.status, 401);
});
await t('Bad token returns 401', async () => {
  const r = await fetch(BASE + '/subscriptions', { headers: { Authorization: 'Bearer badtoken' } });
  eq(r.status, 401);
});

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
