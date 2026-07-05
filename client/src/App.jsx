import React, { useState, useEffect } from 'react'
import AuthScreen from './components/AuthScreen'
import Toast from './components/Toast'
import TabNav from './components/TabNav'
import DashboardTab from './components/DashboardTab'
import SubscriptionsTab from './components/SubscriptionsTab'
import BudgetTab from './components/BudgetTab'
import BankTab from './components/BankTab'
import GmailTab from './components/GmailTab'
import AlertsTab from './components/AlertsTab'
import './index.css'

const API = '/api'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [email, setEmail] = useState('')
  const [page, setPage] = useState('login')
  const [subs, setSubs] = useState([])
  const [summary, setSummary] = useState(null)
  const [activeTab, setActiveTab] = useState('subscriptions')

  // Subscriptions list search/sort
  const [subSearch, setSubSearch] = useState('')
  const [subSort, setSubSort] = useState('next_billing')

  // Plaid
  const [plaidConnected, setPlaidConnected] = useState(false)
  const [plaidConnections, setPlaidConnections] = useState([])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  async function fetchSubs() { try { setSubs(await api('/subscriptions')) } catch {} }
  async function fetchSummary() { try { setSummary(await api('/summary')) } catch {} }
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

  // Cost History
  const [costHistory, setCostHistory] = useState([])
  async function fetchCostHistory() { try { setCostHistory(await api('/cost-history')) } catch {} }

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
  async function fetchPlaidStatus() { try { const c = await api('/plaid/connections'); setPlaidConnected(c.length > 0); setPlaidConnections(c) } catch {} }
  async function syncTransactions() {
    setPlaidLoading(true)
    try { const d = await api('/plaid/sync', { method: 'POST' }); setPlaidImportCount(d.imported); setPlaidRecurring(d.recurring || []); showToast(`Imported ${d.imported} transactions, ${d.recurring.length} recurring merchants`, 'success') }
    catch (err) { showToast(err.message, 'error') }
    setPlaidLoading(false)
  }
  async function convertPlaidSub(m, amt) { try { await api('/plaid/convert-sub', { method: 'POST', body: JSON.stringify({ merchant_name: m, avg_amount: amt }) }); fetchSubs(); fetchSummary(); syncTransactions(); showToast(`Added ${m} to subscriptions`, 'success') } catch (err) { showToast(err.message, 'error') } }

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

  if (!token) {
    return <AuthScreen page={page} setPage={setPage} onLogin={handleLogin} onRegister={handleRegister} />
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Toast toast={toast} />
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Subscription Auditor</h1>
        <div className="flex items-center gap-4">
          <button onClick={exportCSV} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded cursor-pointer">Export CSV</button>
          <span className="text-sm text-gray-400">{email}</span>
          <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 cursor-pointer">Logout</button>
        </div>
      </header>

      <TabNav
        tabs={tabs}
        activeTab={activeTab}
        onSelect={t => {
          setActiveTab(t)
          if (t === 'budget' || t === 'dashboard') fetchPriceCompares()
          if (t === 'dashboard') { fetchSummary(); fetchProjection(); fetchCostHistory() }
        }}
      />

      <main className="max-w-5xl mx-auto p-6 space-y-6">

        {activeTab === 'dashboard' && (
          <DashboardTab summary={summary} subs={subs} projection={projection} costHistory={costHistory} priceCompares={priceCompares} />
        )}

        {activeTab === 'subscriptions' && (
          <SubscriptionsTab
            summary={summary}
            categories={categories}
            cycles={cycles}
            onAddSub={addSub}
            subs={subs}
            subSearch={subSearch}
            subSort={subSort}
            onSearchChange={setSubSearch}
            onSortChange={setSubSort}
            onToggleStatus={toggleStatus}
            onDelete={deleteSub}
          />
        )}

        {activeTab === 'budget' && (
          <BudgetTab
            categories={categories}
            budgets={budgets}
            summary={summary}
            priceCompares={priceCompares}
            onSetBudget={setBudget}
            onFetchPriceCompares={fetchPriceCompares}
          />
        )}

        {activeTab === 'bank' && (
          <BankTab
            api={api}
            showToast={showToast}
            plaidConnected={plaidConnected}
            setPlaidConnected={setPlaidConnected}
            plaidConnections={plaidConnections}
            onReconnected={fetchPlaidStatus}
            plaidRecurring={plaidRecurring}
            plaidImportCount={plaidImportCount}
            plaidLoading={plaidLoading}
            onSync={syncTransactions}
            onConvert={convertPlaidSub}
          />
        )}

        {activeTab === 'gmail' && (
          <GmailTab
            gmailConnected={gmailConnected}
            gmailDetected={gmailDetected}
            gmailLoading={gmailLoading}
            onConnect={connectGmail}
            onScan={scanGmail}
            onRefresh={fetchGmailDetected}
            onDisconnect={disconnectGmail}
            onConvert={convertGmailSub}
            onDismiss={dismissGmailSub}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsTab
            notifyDays={notifyDays}
            setNotifyDays={setNotifyDays}
            onUpdateNotifyDays={updateNotifyDays}
            onPreview={previewNotify}
            onSend={sendNotify}
            notifySending={notifySending}
            notifyPreview={notifyPreview}
          />
        )}

      </main>
    </div>
  )
}

export default App
