import React from 'react'

export default function AuthScreen({ page, setPage, onLogin, onRegister }) {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {page === 'login' ? (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold mb-1">Subscription Auditor</h1>
            <p className="text-gray-400 text-sm mb-6">Track, audit, and save on subscriptions</p>
            <form onSubmit={onLogin} className="space-y-4">
              <input name="email" type="email" placeholder="Email" required className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
              <input name="password" type="password" placeholder="Password" required className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
              <button className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold cursor-pointer">Sign In</button>
            </form>
            <p className="mt-4 text-center text-gray-400">No account? <button onClick={() => setPage('register')} className="text-blue-400 hover:underline cursor-pointer">Register</button></p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold mb-6">Create Account</h1>
            <form onSubmit={onRegister} className="space-y-4">
              <input name="email" type="email" placeholder="Email" required className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
              <input name="password" type="password" placeholder="Password" minLength={4} required className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none" />
              <button className="w-full p-3 rounded-lg bg-green-600 hover:bg-green-700 font-semibold cursor-pointer">Register</button>
            </form>
            <p className="mt-4 text-center text-gray-400">Have an account? <button onClick={() => setPage('login')} className="text-blue-400 hover:underline cursor-pointer">Sign In</button></p>
          </div>
        )}
      </div>
    </div>
  )
}
