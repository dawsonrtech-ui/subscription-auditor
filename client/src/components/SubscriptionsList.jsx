import React from 'react'
import { filterAndSortSubscriptions } from '../subscriptionUtils'

const SORT_OPTIONS = [
  { value: 'next_billing', label: 'Sort: Next billing' },
  { value: 'name', label: 'Sort: Name (A–Z)' },
  { value: 'cost_desc', label: 'Sort: Cost (high–low)' },
  { value: 'cost_asc', label: 'Sort: Cost (low–high)' },
  { value: 'category', label: 'Sort: Category' },
]

export default function SubscriptionsList({ subs, search, sort, onSearchChange, onSortChange, onToggleStatus, onDelete }) {
  const visibleSubs = filterAndSortSubscriptions(subs, { search, sort })

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">All Subscriptions</h2>
        <span className="text-sm text-gray-400">{visibleSubs.length} of {subs.length}</span>
      </div>

      {subs.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by name, category, or notes..."
            aria-label="Search subscriptions"
            className="flex-1 min-w-[200px] p-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none text-sm"
          />
          <select
            value={sort}
            onChange={e => onSortChange(e.target.value)}
            aria-label="Sort subscriptions"
            className="p-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none text-sm"
          >
            {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      )}

      {subs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No subscriptions yet.</p>
      ) : visibleSubs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No subscriptions match "{search}".</p>
      ) : (
        <div className="space-y-2">
          {visibleSubs.map(sub => (
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
                  <p className="font-mono">${Number(sub.cost).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{sub.billing_cycle}</p>
                </div>
                <button onClick={() => onToggleStatus(sub)} className={`text-xs px-3 py-1 rounded cursor-pointer ${sub.status === 'active' ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40' : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'}`}>
                  {sub.status === 'active' ? 'Cancel' : 'Reactivate'}
                </button>
                <button onClick={() => onDelete(sub.id)} className="text-xs text-gray-500 hover:text-red-400 cursor-pointer">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
