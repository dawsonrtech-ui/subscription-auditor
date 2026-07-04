import React from 'react'

export default function DashboardTab({ summary, subs, projection, costHistory, priceCompares }) {
  return (
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
                <span className="font-mono">${Number(s.cost).toFixed(2)} — {s.next_billing}</span>
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
                 <p className="text-3xl font-bold text-blue-400">${(projection.annualTotal / 365).toFixed(2)}</p>
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

      {costHistory.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">Cost Over Time</h2>
          <p className="text-sm text-gray-400 mb-4">Monthly subscription cost recorded over time.</p>
          <div className="space-y-2">
            {costHistory.map((h, i) => {
              const vals = costHistory.map(x => Number(x.monthly_cost))
              const max = Math.max(...vals, 1)
              const pct = Math.max(3, (Number(h.monthly_cost) / max) * 100)
              const prev = i > 0 ? Number(costHistory[i - 1].monthly_cost) : Number(h.monthly_cost)
              const diff = Number(h.monthly_cost) - prev
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{h.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">${Number(h.monthly_cost).toFixed(2)}</span>
                      {diff !== 0 && (
                        <span className={`text-xs font-mono ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-700 rounded-full h-5 relative overflow-hidden">
                    <div className={`h-full rounded-full ${h.date === costHistory[costHistory.length - 1].date ? 'bg-blue-500' : diff > 0 ? 'bg-red-500/60' : diff < 0 ? 'bg-green-500/60' : 'bg-gray-500/60'}`}
                      style={{ width: pct + '%' }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
  )
}
