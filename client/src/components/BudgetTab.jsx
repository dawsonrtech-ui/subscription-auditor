import React from 'react'

export default function BudgetTab({ categories, budgets, summary, priceCompares, onSetBudget, onFetchPriceCompares }) {
  return (
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
                      <input type="number" step="5" min="0" defaultValue={budgetVal || ''} placeholder="0"
                        onBlur={e => onSetBudget(cat, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onSetBudget(cat, e.target.value)}
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
            <button onClick={onFetchPriceCompares} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer">Check Prices</button>
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
  )
}
