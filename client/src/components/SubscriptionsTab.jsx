import React from 'react'
import SubscriptionsList from './SubscriptionsList'

export default function SubscriptionsTab({
  summary, categories, cycles, onAddSub,
  subs, subSearch, subSort, onSearchChange, onSortChange, onToggleStatus, onDelete,
}) {
  return (
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
        <form onSubmit={onAddSub} className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

      <SubscriptionsList
        subs={subs}
        search={subSearch}
        sort={subSort}
        onSearchChange={onSearchChange}
        onSortChange={onSortChange}
        onToggleStatus={onToggleStatus}
        onDelete={onDelete}
      />
    </>
  )
}
