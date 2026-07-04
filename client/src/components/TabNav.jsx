import React from 'react'

const TAB_LABELS = {
  dashboard: '📊 Dash',
  subscriptions: '📋 Subs',
  budget: '💰 Budget',
  bank: '🏦 Bank',
  gmail: '📧 Gmail',
  alerts: '🔔 Alerts',
}

export default function TabNav({ tabs, activeTab, onSelect }) {
  return (
    <div className="border-b border-gray-700 px-6 flex gap-6 text-sm overflow-x-auto">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          className={`pb-3 pt-3 border-b-2 font-medium capitalize whitespace-nowrap cursor-pointer transition-colors ${activeTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
        >
          {TAB_LABELS[t] ?? t}
        </button>
      ))}
    </div>
  )
}
