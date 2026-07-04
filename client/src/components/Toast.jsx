import React from 'react'

export default function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-xl text-sm font-medium transition-all animate-slide-in ${toast.type === 'error' ? 'bg-red-600 text-white' : toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
      {toast.msg}
    </div>
  )
}
