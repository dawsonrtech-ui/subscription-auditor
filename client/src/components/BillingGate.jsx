import React from 'react'

function daysLeft(isoDate) {
  if (!isoDate) return null
  const ms = new Date(isoDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

// Wraps the main app. If billing isn't configured on the server at all
// (e.g. local dev without Stripe keys), or the user has an active/trialing
// subscription, renders children as normal. Otherwise shows a paywall.
export default function BillingGate({ billing, billingLoading, onStartCheckout, children }) {
  // Still loading billing status, or billing isn't set up on this
  // deployment at all — don't block the app either way.
  if (!billing || !billing.configured) return children

  if (billing.active) {
    if (billing.status === 'trialing') {
      const left = daysLeft(billing.trial_ends_at)
      return (
        <>
          {left !== null && (
            <div className="bg-blue-900/30 border-b border-blue-900/50 text-center text-sm py-2 text-blue-300">
              {left === 0 ? 'Your free trial ends today' : `${left} day${left === 1 ? '' : 's'} left in your free trial`}
            </div>
          )}
          {children}
        </>
      )
    }
    return children
  }

  const isReturningUser = billing.status !== 'none'

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 shadow-xl text-center">
        <h1 className="text-2xl font-bold mb-2">
          {isReturningUser ? 'Your subscription has ended' : 'Start your free trial'}
        </h1>
        <p className="text-gray-400 mb-6">
          {isReturningUser
            ? 'Resubscribe to keep tracking your subscriptions and get renewal alerts.'
            : '14 days free, then a simple monthly subscription. Cancel anytime.'}
        </p>
        <button
          onClick={onStartCheckout}
          disabled={billingLoading}
          className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold cursor-pointer"
        >
          {billingLoading ? 'Redirecting...' : isReturningUser ? 'Resubscribe' : 'Start Free Trial'}
        </button>
      </div>
    </div>
  )
}
