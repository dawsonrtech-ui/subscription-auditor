import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import './index.css'

const API = '/api'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [email, setEmail] = useState('')
  const [page, setPage] = useState('login')
  const [subs, setSubs] = useState([])
  const [summary, setSummary] = useState(null)
  const [activeTab, setActiveTab] = useState('subscriptions')

  // Plaid
  const [plaidConnected, setPlaidConnected] = useState(false)
  const [plaidRecurring, setPlaidRecurring] = useState([])
  const [plaidImportCount, setPlaidImportCount] = useState(0)
  const [plaidLoading, setPlaidLoading] = useState(false)

  // Gmail
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailDetected, setGmailDetected] = useState([])
  const [gmailLoading, setGmailLoading] = useState(false)

  // Notify
  const [notifyDays, setNotifyDays] = useState(3)
  const [notifyPreview, setNotifyPreview] = useState(null)
  const [notifySending, setNotifySending] = useState(false)

  // Budget
  const [budgets, setBudgets] = useState([])
  const [priceCompares, setPriceCompares] = useState([])

  // Toast
  const [toast, setToast] = useState(null)

  const categories = ['Streaming', 'SaaS', 'Gym', 'Insurance', 'Utilities', 'Software', 'Cloud', 'Other']
  const cycles = ['monthly', 'yearly', 'weekly']
  const tabs = ['dashboard', 'subscriptions', 'budget', 'bank', 'gmail', 'alerts']

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (token) {
      fetchSubs(); fetchSummary(); fetchBudgets()
      fetchPlaidStatus(); fetchGmailStatus(); fetchNotifySettings()
      if (window.location.search.includes('gmail=connected')) {
        fetchGmailStatus()
        window.history.replaceState({}, '', '/')
      }
    }
  }, [token])

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...opts.headers },
      ...opts,
    })
    if (res.status === 401) {
      setToken(null); localStorage.removeItem('token'); setEmail('')
      throw new Error('Session expired. Please log in again.')
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || 'Request failed')
    }
    return res.json()
  }

  // Auth
  async function handleRegister(e) {
    e.preventDefault(); const f = e.target
    try { await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: f.email.value, password: f.password.value }) }); f.reset(); setPage('login'); showToast('Account created! Sign in to continue.', 'success') }
    catch (err) { showToast(err.message, 'error') }
  }
  async function handleLogin(e) {
    e.preventDefault(); const f = e.target
    try { const d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: f.email.value, password: f.password.value }) }); setToken(d.token); setEmail(d.email); setNotifyDays(d.notify_before_days ?? 3); localStorage.setItem('token', d.token) }
    catch (err) { showToast(err.message, 'error') }
  }
  function logout() { setToken(null); setEmail(''); localStorage.removeItem('token'); setSubs([]); setSummary(null); setPlaidRecurring([]); setGmailDetected([]); showToast('Logged out', 'info') }

  // Subs
  async function fetchSubs() { setSubs(await api('/subscriptions')) }
  async function fetchSummary() { setSummary(await api('/summary')) }
  async function addSub(e) {
    e.preventDefault(); const f = e.target
    try {
      await api('/subscriptions', { method: 'POST', body: JSON.stringify({ name: f.name.value, category: f.category.value, cost: parseFloat(f.cost.value), billing_cycle: f.cycle.value, next_billing: f.next.value || null, notes: f.notes.value }) })
      f.reset(); fetchSubs(); fetchSummary(); showToast('Subscription added', 'success')
    } catch (err) { showToast(err.message, 'error') }
  }
  async function deleteSub(id) { try { await api('/subscriptions/' + id, { method: 'DELETE' }); fetchSubs(); fetchSummary(); showToast('Subscription deleted', 'info') } catch (err) { showToast(err.message, 'error') } }
  async function toggleStatus(sub) { try { await api('/subscriptions/' + sub.id, { method: 'PUT', body: JSON.stringify({ status: sub.status === 'active' ? 'cancelled' : 'active' }) }); fetchSubs(); fetchSummary() } catch (err) { showToast(err.message, 'error') } }

  // Budget
  async function fetchBudgets() { try { setBudgets(await api('/budgets')) } catch {} }
  async function setBudget(cat, val) { await api('/budgets', { method: 'PUT', body: JSON.stringify({ category: cat, monthly_budget: parseFloat(val) || 0 }) }); fetchBudgets(); fetchSummary() }

  // Projection / Spending Trends
  const [projection, setProjection] = useState(null)
  async function fetchProjection() { try { setProjection(await api('/projection')) } catch {} }

  // Price compare
  async function fetchPriceCompares() { try { setPriceCompares(await api('/price-compare')) } catch {} }

  // Export
  async function exportCSV() {
    try {
      const res = await fetch(API + '/export/csv', { headers: { Authorization: 'Bearer ' + token } })
      if (res.status === 401) { setToken(null); localStorage.removeItem('token'); setEmail(''); throw new Error('Session expired') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'subscriptions.csv'; a.click()
      URL.revokeObjectURL(url)
      showToast('CSV downloaded', 'success')
    } catch (err) { showToast(err.message, 'error') }
  }

  // Plaid
  async function fetchPlaidStatus() { try { const c = await api('/plaid/connections'); setPlaidConnected(c.length > 0) } catch {} }
  async function syncTransactions() {
    setPlaidLoading(true)
    try { const d = await api('/plaid/sync', { method: 'POST' }); setPlaidImportCount(d.imported); setPlaidRecurring(d.recurring || []); showToast(`Imported ${d.imported} transactions, ${d.recurring.length} recurring merchants`, 'success') }
    catch (err) { showToast(err.message, 'error') }
    setPlaidLoading(false)
  }
  async function convertPlaidSub(m, name, amt) { try { await api('/plaid/convert-sub', { method: 'POST', body: JSON.stringify({ merchant_name: m, name, avg_amount: amt }) }); fetchSubs(); fetchSummary(); syncTransactions(); showToast(`Added ${m} to subscriptions`, 'success') } catch (err) { showToast(err.message, 'error') } }

  // Gmail
  async function fetchGmailStatus() { try { const s = await api('/gmail/status'); setGmailConnected(s.connected) } catch {} }
  async function connectGmail() { try { const { url } = await api('/gmail/auth-url'); window.location.href = url } catch (err) { showToast(err.message, 'error') } }
  async function scanGmail() {
    setGmailLoading(true)
    try { const d = await api('/gmail/scan', { method: 'POST' }); showToast(`Scanned ${d.scanned} emails, ${d.new_detected} new subscriptions found`, 'success'); fetchGmailDetected() }
    catch (err) { showToast(err.message, 'error') }
    setGmailLoading(false)
  }
  async function fetchGmailDetected() { try { setGmailDetected(await api('/gmail/detected')) } catch {} }
  async function convertGmailSub(id) { await api('/gmail/convert', { method: 'POST', body: JSON.stringify({ detected_id: id }) }); fetchSubs(); fetchSummary(); fetchGmailDetected() }
  async function dismissGmailSub(id) { await api('/gmail/dismiss', { method: 'POST', body: JSON.stringify({ detected_id: id }) }); fetchGmailDetected() }
  async function disconnectGmail() { await api('/gmail/disconnect', { method: 'DELETE' }); setGmailConnected(false) }

  // Notifications
  async function fetchNotifySettings() { try { const s = await api('/notify/settings'); setNotifyDays(s.notify_before_days ?? 3) } catch {} }
  async function updateNotifyDays(days) { await api('/notify/settings', { method: 'PUT', body: JSON.stringify({ notify_before_days: days }) }); setNotifyDays(days) }
  async function previewNotify() { try { setNotifyPreview(await api('/notify/preview')) } catch (err) { showToast(err.message, 'error') } }
  async function sendNotify() {
    setNotifySending(true)
    try { const r = await api('/notify/send', { method: 'POST' }); showToast(r.sent ? `Sent to ${email}` : 'No upcoming renewals', r.sent ? 'success' : 'info') }
    catch (err) { showToast(err.message, 'error') }
    setNotifySending(false)
  }

  // Login screen
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {page === 'login' ? (
            <div className="bg-gray-800 rounded-2xl p-8 shadow-xl">
              <h1 className="text-2xl font-bold mb-1">Subscription Auditor</h1>
              <p className="text-gray-400 text-sm mb-6">Track, audit, and save on subscriptions</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <input name="email" type="email" placeholder="Email" required className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
                <input name="password" type="password" placeholder="Password" required className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
                <button className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold cursor-pointer">Sign In</button>
              </form>
              <p className="mt-4 text-center text-gray-400">No account? <button onClick={() => setPage('register')} className="text-blue-400 hover:underline cursor-pointer">Register</button></p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-2xl p-8 shadow-xl">
              <h1 className="text-2xl font-bold mb-6">Create Account</h1>
              <form onSubmit={handleRegister} className="space-y-4">
                <input name="email" type="email" placeholder="Email" required className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
                <input name="password" type="password" placeholder="Password" minLength={4} required className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
                <button className="w-full p-3 rounded-lg bg-green-600 hover:bg-green-700 font-semibold cursor-pointer">Register</button>
              </form>
              <p className="mt-4 text-center text-gray-400">Have an account? <button onClick={() => setPage('login')} className="text-blue-400 hover:underline cursor-pointer">Sign In</button></p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-xl text-sm font-medium transition-all animate-slide-in ${toast.type === 'error' ? 'bg-red-600 text-white' : toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
          {toast.msg}
        </div>
      )}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Subscription Auditor</h1>
        <div className="flex items-center gap-4">
          <button onClick={exportCSV} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded cursor-pointer">Export CSV</button>
          <span className="text-sm text-gray-400">{email}</span>
          <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 cursor-pointer">Logout</button>
        </div>
      </header>

      <div className="border-b border-gray-700 px-6 flex gap-6 text-sm overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => { setActiveTab(t); if (t === 'budget' || t === 'dashboard') fetchPriceCompares(); if (t === 'dashboard') { fetchSummary(); fetchProjection() } }}
            className={`pb-3 pt-3 border-b-2 font-medium capitalize whitespace-nowrap cursor-pointer transition-colors ${activeTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            {t === 'dashboard' ? '📊 Dash' : t === 'bank' ? '🏦 Bank' : t === 'gmail' ? '📧 Gmail' : t === 'alerts' ? '🔔 Alerts' : t === 'budget' ? '💰 Budget' : '📋 Subs'}
          </button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto p-6 space-y-6">

        {/* ═══ DASHBOARD TAB ═══ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">Active Subs</p>
                <p className="text-3xl font-bold">{summary?.count ?? 0}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">Monthly</p>
                <p className="text-3xl font-bold text-blue-400">${(summary?.monthly ?? 0).toFixed(2)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">Yearly</p>
                <p className="text-3xl font-bold text-purple-400">${((summary?.monthly ?? 0) * 12).toFixed(2)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">Due This Week</p>
                <p className={`text-3xl font-bold ${(summary?.upcoming?.length ?? 0) > 0 ? 'text-yellow-400' : ''}`}>{summary?.upcoming?.length ?? 0}</p>
              </div>
            </div>

            {summary && Object.keys(summary.byCategory).length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Spending by Category</h2>
                <div className="space-y-3">
                  {Object.entries(summary.byCategory).map(([cat, amount]) => {
                    const pct = Math.min(100, (amount / summary.total) * 100)
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{cat}</span>
                          <span className="font-mono">${amount.toFixed(2)}</span>
                        </div>
                        <div className="bg-gray-700 rounded-full h-4">
                          <div className="bg-blue-500 h-4 rounded-full" style={{ width: pct + '%' }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {summary && Object.keys(summary.budgetVsActual).length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Budget vs Actual</h2>
                <div className="space-y-3">
                  {Object.entries(summary.budgetVsActual).filter(([, v]) => v.budget > 0).map(([cat, v]) => {
                    const pct = Math.min(100, (v.actual / v.budget) * 100)
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{cat}</span>
                          <span className={`font-mono ${v.actual > v.budget ? 'text-red-400' : 'text-green-400'}`}>
                            ${v.actual.toFixed(2)} / ${v.budget.toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-gray-700 rounded-full h-4 relative overflow-hidden">
                          <div className={`h-full rounded-full ${v.actual > v.budget ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: pct + '%' }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {summary && summary.upcoming.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Upcoming Renewals</h2>
                <div className="space-y-2">
                  {summary.upcoming.map(s => (
                    <div key={s.id} className="flex justify-between p-3 bg-gray-700/40 rounded-lg">
                      <span className="font-medium">{s.name}</span>
                      <span className="font-mono">${s.cost.toFixed(2)} — {s.next_billing}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {projection && (
              <>
                <div className="bg-gray-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-3">12-Month Spending Trend</h2>
                  <div className="space-y-2">
                    {projection.months.map((m, i) => {
                      const maxTotal = Math.max(...projection.months.map(x => x.total), 1)
                      const pct = Math.max(3, (m.total / maxTotal) * 100)
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">{m.month}</span>
                            <span className="font-mono">${m.total.toFixed(2)}</span>
                          </div>
                          <div className="bg-gray-700 rounded-full h-5 relative overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: pct + '%' }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-3">Annual Projection</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-700/40 rounded-xl p-4 text-center">
                      <p className="text-sm text-gray-400">Total Per Year</p>
                      <p className="text-3xl font-bold text-purple-400">${projection.annualTotal.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-700/40 rounded-xl p-4 text-center">
                      <p className="text-sm text-gray-400">Per Day</p>
                      <p className="text-3xl font-bold text-blue-400">$${(projection.annualTotal / 365).toFixed(2)}</p>
                    </div>
                  </div>
                  {Object.keys(projection.annualByCategory).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400 mb-2">By Category</p>
                      {Object.entries(projection.annualByCategory).map(([cat, amt]) => {
                        const pct = Math.min(100, (amt / projection.annualTotal) * 100)
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{cat}</span>
                              <span className="font-mono">${amt.toFixed(2)}</span>
                            </div>
                            <div className="bg-gray-700 rounded-full h-4">
                              <div className="h-full rounded-full bg-purple-500" style={{ width: pct + '%' }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Top 5 Most Expensive */}
            {subs.filter(s => s.status === 'active').length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Top 5 Most Expensive</h2>
                <div className="space-y-2">
                  {subs.filter(s => s.status === 'active').sort((a, b) => Number(b.cost) - Number(a.cost)).slice(0, 5).map(s => (
                    <div key={s.id} className="flex justify-between items-center p-3 bg-gray-700/40 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"></span>
                        <span className="font-medium truncate">{s.name}</span>
                        <span className="text-xs bg-gray-600 px-2 py-0.5 rounded flex-shrink-0">{s.category}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <span className="font-mono">${Number(s.cost).toFixed(2)}</span>
                        <span className="text-xs text-gray-400 ml-1">/{s.billing_cycle === 'yearly' ? 'yr' : s.billing_cycle === 'weekly' ? 'wk' : 'mo'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancelled Subs */}
            {summary && summary.cancelledCount > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Cancelled Subs</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-700/40 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-400">Cancelled</p>
                    <p className="text-2xl font-bold text-gray-400">{summary.cancelledCount}</p>
                  </div>
                  <div className="bg-gray-700/40 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-400">Saved /mo</p>
                    <p className="text-2xl font-bold text-green-400">${summary.cancelledMonthly.toFixed(2)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {summary.cancelled.map(s => (
                    <div key={s.id} className="flex justify-between p-3 bg-gray-700/30 rounded-lg opacity-70">
                      <span className="font-medium">{s.name}</span>
                      <span className="font-mono text-sm line-through decoration-red-400">${Number(s.cost).toFixed(2)}/{s.billing_cycle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Savings Opportunities */}
            {priceCompares.length > 0 && priceCompares.filter(p => p.diff > 0).length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Savings Opportunities</h2>
                <p className="text-sm text-gray-400 mb-4">You're paying above average for these services.</p>
                <div className="space-y-2">
                  {priceCompares.filter(p => p.diff > 0).map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-red-900/20 rounded-lg border border-red-900/30">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-gray-400">You pay: ${p.userCost.toFixed(2)}/{p.userCycle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-red-400 font-mono">+${p.diff.toFixed(2)} above avg</p>
                        <p className="text-xs text-gray-400">Avg: ${p.avgMonthly.toFixed(2)}/mo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Renewal Heatmap */}
            {subs.filter(s => s.status === 'active' && s.next_billing).length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Renewal Days</h2>
                <p className="text-sm text-gray-400 mb-3">When your subscriptions renew each month.</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                    const count = subs.filter(s => s.status === 'active' && s.next_billing && new Date(s.next_billing).getDate() === day).length
                    if (count === 0) return <div key={day} className="w-9 h-9 rounded-lg bg-gray-700/30 flex items-center justify-center text-xs text-gray-600">{day}</div>
                    const intensity = Math.min(1, count / 3)
                    return (
                      <div key={day} className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: `rgba(59, 130, 246, ${0.3 + intensity * 0.7})` }}
                        title={`${count} renewal${count > 1 ? 's' : ''}`}>
                        {day}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SUBS TAB ═══ */}
        {activeTab === 'subscriptions' && (
          <>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-xl p-4"><p className="text-sm text-gray-400">Active</p><p className="text-2xl font-bold">{summary.count}</p></div>
                <div className="bg-gray-800 rounded-xl p-4"><p className="text-sm text-gray-400">Monthly</p><p className="text-2xl font-bold">${summary.monthly.toFixed(2)}</p></div>
                <div className="bg-gray-800 rounded-xl p-4"><p className="text-sm text-gray-400">Yearly</p><p className="text-2xl font-bold">${(summary.monthly * 12).toFixed(2)}</p></div>
                <div className="bg-gray-800 rounded-xl p-4"><p className="text-sm text-gray-400">Due This Week</p><p className={`text-2xl font-bold ${summary.upcoming.length > 0 ? 'text-yellow-400' : ''}`}>{summary.upcoming.length}</p></div>
              </div>
            )}

            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Add Subscription</h2>
              <form onSubmit={addSub} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input name="name" placeholder="Name" required className="p-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
                <select name="category" className="p-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none">{categories.map(c => <option key={c}>{c}</option>)}</select>
                <input name="cost" type="number" step="0.01" min="0" placeholder="Cost" required className="p-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
                <select name="cycle" className="p-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none">{cycles.map(c => <option key={c}>{c}</option>)}</select>
                <input name="next" type="date" className="p-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
                <input name="notes" placeholder="Notes" className="p-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
                <button className="md:col-span-3 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold cursor-pointer">Add</button>
              </form>
            </div>

            {summary && Object.keys(summary.byCategory).length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Spending by Category</h2>
                <div className="space-y-3">
                  {Object.entries(summary.byCategory).map(([cat, amount]) => {
                    const pct = Math.min(100, (amount / summary.total) * 100)
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{cat}</span>
                          <span className="font-mono">${amount.toFixed(2)}</span>
                        </div>
                        <div className="bg-gray-700 rounded-full h-4">
                          <div className="bg-blue-500 h-4 rounded-full" style={{ width: pct + '%' }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">All Subscriptions</h2>
                <span className="text-sm text-gray-400">{subs.length} total</span>
              </div>
              {subs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No subscriptions yet.</p>
              ) : (
                <div className="space-y-2">
                  {subs.map(sub => (
                    <div key={sub.id} className={`flex items-center justify-between p-3 rounded-lg ${sub.status === 'active' ? 'bg-gray-700/50' : 'bg-gray-700/20 opacity-60'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sub.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                          <span className="font-medium truncate">{sub.name}</span>
                          <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">{sub.category}</span>
                          {sub.billing_cycle === 'yearly' && <span className="text-xs bg-purple-600/30 text-purple-400 px-2 py-0.5 rounded">Annual</span>}
                          {sub.next_billing && new Date(sub.next_billing) <= new Date(Date.now() + 7 * 86400000) && sub.status === 'active' && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Due soon</span>
                          )}
                        </div>
                        {sub.notes && <p className="text-xs text-gray-500 mt-1 truncate">{sub.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <div className="text-right">
                          <p className="font-mono">${sub.cost.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">{sub.billing_cycle}</p>
                        </div>
                        <button onClick={() => toggleStatus(sub)} className={`text-xs px-3 py-1 rounded cursor-pointer ${sub.status === 'active' ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40' : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'}`}>
                          {sub.status === 'active' ? 'Cancel' : 'Reactivate'}
                        </button>
                        <button onClick={() => deleteSub(sub.id)} className="text-xs text-gray-500 hover:text-red-400 cursor-pointer">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ BUDGET TAB ═══ */}
        {activeTab === 'budget' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2">Budget Planner</h2>
              <p className="text-sm text-gray-400 mb-4">Set monthly spending targets per category. See planned vs actual at a glance.</p>
              <div className="space-y-4">
                {categories.map(cat => {
                  const budget = budgets.find(b => b.category === cat)
                  const budgetVal = budget?.monthly_budget || 0
                  const actual = summary?.budgetVsActual?.[cat]?.actual || 0
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{cat}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">Actual: ${actual.toFixed(2)}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">Budget:</span>
                            <input type="number" step="5" min="0" value={budgetVal || ''} placeholder="0"
                              onChange={e => setBudget(cat, e.target.value)}
                              className="w-20 p-1 text-sm rounded bg-gray-700 border border-gray-600 text-right font-mono outline-none focus:border-blue-500" />
                          </div>
                        </div>
                      </div>
                      {budgetVal > 0 && (
                        <div className="bg-gray-700 rounded-full h-5 relative overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${actual > budgetVal ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: Math.min(100, (actual / budgetVal) * 100) + '%' }}></div>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-mono">
                            {actual > budgetVal ? `$${actual.toFixed(0)} / $${budgetVal} (OVER)` : `$${actual.toFixed(0)} / $${budgetVal}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-3">Price Comparison</h2>
              <p className="text-sm text-gray-400 mb-4">How your subscription costs compare to average market prices.</p>
              {priceCompares.length === 0 ? (
                <div className="text-center py-6">
                  <button onClick={fetchPriceCompares} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer">Check Prices</button>
                  <p className="text-xs text-gray-500 mt-2">Compares your subscriptions against average market rates for common services.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {priceCompares.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-gray-400">You pay: ${p.userCost.toFixed(2)}/{p.userCycle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Avg: <span className="font-mono">${p.avgMonthly.toFixed(2)}/mo</span></p>
                        <p className={`text-xs font-mono ${p.diff > 0 ? 'text-red-400' : p.diff < 0 ? 'text-green-400' : 'text-gray-400'}`}>
                          {p.diff > 0 ? `+$${p.diff.toFixed(2)} above avg` : p.diff < 0 ? `Save $${Math.abs(p.diff).toFixed(2)} vs avg` : 'At market avg'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ BANK TAB ═══ */}
        {activeTab === 'bank' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2">Bank Connection</h2>
              <p className="text-sm text-gray-400 mb-4">Connect your bank to auto-detect recurring payments.</p>
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${plaidConnected ? 'bg-green-400' : 'bg-gray-600'}`}></span>
                <span className={plaidConnected ? 'text-green-400' : 'text-gray-400'}>{plaidConnected ? 'Bank connected' : 'No bank connected'}</span>
              </div>
              <div className="flex gap-3 mt-4">
                <PlaidLinkButton api={api} setPlaidConnected={setPlaidConnected} plaidConnected={plaidConnected} showToast={showToast} />
                {plaidConnected && (
                  <button onClick={syncTransactions} disabled={plaidLoading} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 font-medium cursor-pointer">
                    {plaidLoading ? 'Syncing...' : 'Sync Transactions'}
                  </button>
                )}
              </div>
              {plaidImportCount > 0 && <p className="text-sm text-gray-400 mt-3">Last sync: {plaidImportCount} new</p>}
            </div>
            {plaidRecurring.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Detected Recurring ({plaidRecurring.length})</h2>
                <div className="space-y-2">
                  {plaidRecurring.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                      <div>
                        <p className="font-medium">{r.merchant_name || r.name}</p>
                        <p className="text-xs text-gray-400">{r.count} txns | Avg ${parseFloat(r.avg_amount).toFixed(2)}</p>
                      </div>
                      <button onClick={() => convertPlaidSub(r.merchant_name || r.name, r.name, r.avg_amount)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm cursor-pointer">Track</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!plaidConnected && (
              <div className="bg-gray-800/50 rounded-xl p-6 text-center text-gray-500">
                <p className="text-lg mb-2">🏦</p>
                <p>Connect a bank to auto-detect subscriptions from transactions.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ GMAIL TAB ═══ */}
        {activeTab === 'gmail' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2">Gmail Scan</h2>
              <p className="text-sm text-gray-400 mb-4">Scan your inbox for subscription receipts.</p>
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${gmailConnected ? 'bg-green-400' : 'bg-gray-600'}`}></span>
                <span className={gmailConnected ? 'text-green-400' : 'text-gray-400'}>{gmailConnected ? 'Gmail connected' : 'Not connected'}</span>
              </div>
              <div className="flex gap-3 mt-4 flex-wrap">
                {!gmailConnected ? (
                  <button onClick={connectGmail} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 font-medium cursor-pointer">Connect Gmail</button>
                ) : (
                  <>
                    <button onClick={scanGmail} disabled={gmailLoading} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-medium cursor-pointer">
                      {gmailLoading ? 'Scanning...' : 'Scan Inbox'}
                    </button>
                    <button onClick={fetchGmailDetected} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 font-medium cursor-pointer">Refresh</button>
                    <button onClick={disconnectGmail} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-red-800/50 text-red-400 font-medium cursor-pointer">Disconnect</button>
                  </>
                )}
              </div>
            </div>
            {gmailDetected.filter(d => d.status === 'pending').length > 0 && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3">Detected from Email</h2>
                <div className="space-y-2">
                  {gmailDetected.filter(d => d.status === 'pending').map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{d.service_name}</p>
                        <p className="text-xs text-gray-400 truncate">{d.email_subject}</p>
                        {d.amount != null && <p className="text-sm font-mono mt-1">${parseFloat(d.amount).toFixed(2)}/mo</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0 ml-3">
                        <button onClick={() => convertGmailSub(d.id)} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm cursor-pointer">Add</button>
                        <button onClick={() => dismissGmailSub(d.id)} className="px-3 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-sm cursor-pointer">Dismiss</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ALERTS TAB ═══ */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2">Renewal Alerts</h2>
              <p className="text-sm text-gray-400 mb-4">Get email reminders before subscriptions renew.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Notify me before renewal:</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="1" max="14" value={notifyDays} onChange={e => setNotifyDays(parseInt(e.target.value))} onMouseUp={e => updateNotifyDays(parseInt(e.target.value))} onTouchEnd={e => updateNotifyDays(parseInt(e.target.value))} className="w-48 accent-blue-500 cursor-pointer" />
                    <span className="font-mono text-lg">{notifyDays} day{notifyDays > 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={previewNotify} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-medium cursor-pointer">Preview</button>
                  <button onClick={sendNotify} disabled={notifySending} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 font-medium cursor-pointer">
                    {notifySending ? 'Sending...' : 'Send Test'}
                  </button>
                </div>
                {notifyPreview && (
                  <div className="space-y-4">
                    <div className="bg-gray-700/40 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-2">Upcoming ({notifyPreview.upcoming.length}):</p>
                      {notifyPreview.upcoming.length === 0 ? (
                        <p className="text-green-400 text-sm">All caught up!</p>
                      ) : (
                        <ul className="space-y-1">{notifyPreview.upcoming.map(s => (
                          <li key={s.id} className="text-sm flex justify-between">
                            <span>{s.name}</span>
                            <span className="font-mono">${s.cost.toFixed(2)} — {s.next_billing}</span>
                          </li>
                        ))}</ul>
                      )}
                    </div>
                    <div className="bg-gray-700/40 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-2">Annual Subscriptions ({notifyPreview.annual.length}):</p>
                      {notifyPreview.annual.length === 0 ? (
                        <p className="text-sm text-gray-500">No annual subscriptions tracked.</p>
                      ) : (
                        <ul className="space-y-1">{notifyPreview.annual.map(s => (
                          <li key={s.id} className="text-sm flex justify-between">
                            <span>{s.name}</span>
                            <span className="font-mono text-purple-400">${s.cost.toFixed(2)}/yr</span>
                          </li>
                        ))}</ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

function PlaidLinkButton({ api, plaidConnected, setPlaidConnected, showToast }) {
  const [linkToken, setLinkToken] = useState(null)
  const [loading, setLoading] = useState(false)

  const onSuccess = useCallback(async (publicToken, metadata) => {
    try {
      await api('/plaid/exchange-token', { method: 'POST', body: JSON.stringify({ public_token: publicToken, institution_name: metadata?.institution?.name || '' }) })
      setPlaidConnected(true)
      showToast('Bank connected! Sync transactions to find subscriptions.', 'success')
    } catch (err) { showToast(err.message, 'error') }
  }, [api, setPlaidConnected, showToast])

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess, onExit: () => { setLinkToken(null); setLoading(false) } })

  async function handleClick() {
    if (!plaidConnected) {
      setLoading(true)
      try { const { link_token } = await api('/plaid/create-link-token', { method: 'POST' }); setLinkToken(link_token) }
      catch (err) { showToast(err.message, 'error'); setLoading(false); return }
    }
    if (linkToken && ready) open()
  }

  useEffect(() => { if (linkToken && ready) { open(); setLoading(false) } }, [linkToken, ready, open])

  return (
    <button onClick={handleClick} disabled={loading || (linkToken && !ready)}
      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-medium cursor-pointer">
      {loading ? 'Loading...' : plaidConnected ? 'Reconnect' : 'Connect Bank'}
    </button>
  )
}

export default App
