import React, { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'

export function PlaidLinkButton({ api, plaidConnected, setPlaidConnected, showToast }) {
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
    setLoading(true)
    try { const { link_token } = await api('/plaid/create-link-token', { method: 'POST' }); setLinkToken(link_token) }
    catch (err) { showToast(err.message, 'error'); setLoading(false) }
  }

  useEffect(() => { if (linkToken && ready) { open(); setLoading(false) } }, [linkToken, ready, open])

  return (
    <button onClick={handleClick} disabled={loading || (linkToken && !ready)}
      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-medium cursor-pointer">
      {loading ? 'Loading...' : plaidConnected ? 'Reconnect' : 'Connect Bank'}
    </button>
  )
}

export default function BankTab({ api, showToast, plaidConnected, setPlaidConnected, plaidRecurring, plaidImportCount, plaidLoading, onSync, onConvert }) {
  return (
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
            <button onClick={onSync} disabled={plaidLoading} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 font-medium cursor-pointer">
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
                <button onClick={() => onConvert(r.merchant_name || r.name, r.avg_amount)}
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
  )
}
