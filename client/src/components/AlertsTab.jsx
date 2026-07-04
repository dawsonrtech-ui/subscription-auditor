import React from 'react'

export default function AlertsTab({ notifyDays, setNotifyDays, onUpdateNotifyDays, onPreview, onSend, notifySending, notifyPreview }) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">Renewal Alerts</h2>
        <p className="text-sm text-gray-400 mb-4">Get email reminders before subscriptions renew.</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Notify me before renewal:</label>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="14" value={notifyDays}
                onChange={e => setNotifyDays(parseInt(e.target.value))}
                onMouseUp={e => onUpdateNotifyDays(parseInt(e.target.value))}
                onTouchEnd={e => onUpdateNotifyDays(parseInt(e.target.value))}
                onKeyUp={e => onUpdateNotifyDays(parseInt(e.target.value))}
                className="w-48 accent-blue-500 cursor-pointer" />
              <span className="font-mono text-lg">{notifyDays} day{notifyDays > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onPreview} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-medium cursor-pointer">Preview</button>
            <button onClick={onSend} disabled={notifySending} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 font-medium cursor-pointer">
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
                      <span className="font-mono">${Number(s.cost).toFixed(2)} — {s.next_billing}</span>
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
                      <span className="font-mono text-purple-400">${Number(s.cost).toFixed(2)}/yr</span>
                    </li>
                  ))}</ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
