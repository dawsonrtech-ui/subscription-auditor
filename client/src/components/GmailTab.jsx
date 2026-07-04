import React from 'react'

export default function GmailTab({ gmailConnected, gmailDetected, gmailLoading, onConnect, onScan, onRefresh, onDisconnect, onConvert, onDismiss }) {
  const pending = gmailDetected.filter(d => d.status === 'pending')

  return (
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
            <button onClick={onConnect} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 font-medium cursor-pointer">Connect Gmail</button>
          ) : (
            <>
              <button onClick={onScan} disabled={gmailLoading} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-medium cursor-pointer">
                {gmailLoading ? 'Scanning...' : 'Scan Inbox'}
              </button>
              <button onClick={onRefresh} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 font-medium cursor-pointer">Refresh</button>
              <button onClick={onDisconnect} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-red-800/50 text-red-400 font-medium cursor-pointer">Disconnect</button>
            </>
          )}
        </div>
      </div>
      {pending.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">Detected from Email</h2>
          <div className="space-y-2">
            {pending.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-gray-700/40 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{d.service_name}</p>
                  <p className="text-xs text-gray-400 truncate">{d.email_subject}</p>
                  {d.amount != null && <p className="text-sm font-mono mt-1">${parseFloat(d.amount).toFixed(2)}/mo</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <button onClick={() => onConvert(d.id)} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm cursor-pointer">Add</button>
                  <button onClick={() => onDismiss(d.id)} className="px-3 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-sm cursor-pointer">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
