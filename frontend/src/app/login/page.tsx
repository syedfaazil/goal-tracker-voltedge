'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profileData) {
      setError('Could not fetch your profile. Please contact your administrator.')
      setLoading(false)
      return
    }

    const role = profileData.role
    if (role === 'admin') router.push('/admin/dashboard')
    else if (role === 'manager') router.push('/manager/dashboard')
    else router.push('/employee/dashboard')

    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background geometric accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-900/10 blur-3xl" />
        {/* Grid lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-5">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">VoltEdge</h1>
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mt-1">Goal Management Portal</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-white">Welcome back</h2>
            <p className="text-slate-400 text-sm mt-1">Sign in with your company credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-300 mb-2">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@voltedge.com"
                className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 text-white placeholder-slate-500 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 text-white placeholder-slate-500 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-blue-400 text-white font-bold py-3 text-sm transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing you in...
                </>
              ) : (
                'Sign In to Portal'
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-slate-600 text-xs mt-6">
            Having trouble? Contact your HR administrator
          </p>
        </div>

        {/* Bottom tag */}
        <p className="text-center text-slate-700 text-xs mt-6">
          VoltEdge Manufacturing Pvt. Ltd. · AtomQuest 1.0
        </p>
      </div>
    </div>
  )
}