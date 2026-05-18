'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import toast, { Toaster } from 'react-hot-toast'

type Goal = {
  id: string
  title: string
  uom_type: string
  uom_direction: string
  target: string
  weightage: number
  thrust_area: string
}

type Achievement = {
  id: string
  goal_id: string
  quarter: string
  actual: string
  status: string
}

type Comment = {
  goal_id: string
  quarter: string
  comment: string
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export default function EmployeeCheckins() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [selectedQuarter, setSelectedQuarter] = useState('Q1')
  const [formData, setFormData] = useState<Record<string, { actual: string; status: string }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
    else if (user) fetchAll()
  }, [user, userLoading])

  const fetchAll = async () => {
    setLoading(true)

    const goalsRes = await supabase.from('goals').select('id, title, uom_type, uom_direction, target, weightage, thrust_area').eq('employee_id', user?.id).eq('status', 'Approved')
    const achRes = await supabase.from('goal_achievements').select('*').in('goal_id', goalsRes.data?.map(g => g.id) || [])
    const commentsRes = await supabase.from('checkin_comments').select('goal_id, quarter, comment')

    if (goalsRes.error) toast.error(goalsRes.error.message)
    if (achRes.error) toast.error(achRes.error.message)

    const goalsData = goalsRes.data || []
    const achData = achRes.data || []
    const commentsData = commentsRes.data || []

    setGoals(goalsData)
    setAchievements(achData)
    setComments(commentsData)

    // Pre-fill form with existing data for current quarter
    const initial: Record<string, { actual: string; status: string }> = {}
    goalsData.forEach((g) => {
      const existing = achData.find((a) => a.goal_id === g.id && a.quarter === selectedQuarter)
      initial[g.id] = {
        actual: existing?.actual?.toString() || '',
        status: existing?.status || 'Not Started',
      }
    })
    setFormData(initial)
    setLoading(false)
  }

  // Re-fill form when quarter changes
  useEffect(() => {
    if (goals.length === 0) return
    const updated: Record<string, { actual: string; status: string }> = {}
    goals.forEach((g) => {
      const existing = achievements.find((a) => a.goal_id === g.id && a.quarter === selectedQuarter)
      updated[g.id] = {
        actual: existing?.actual?.toString() || '',
        status: existing?.status || 'Not Started',
      }
    })
    setFormData(updated)
  }, [selectedQuarter, achievements, goals])

  const handleFormChange = (goalId: string, field: 'actual' | 'status', value: string) => {
    setFormData((prev) => ({ ...prev, [goalId]: { ...prev[goalId], [field]: value } }))
  }

  const handleSave = async (goalId: string) => {
    const data = formData[goalId]
    const goal = goals.find((g) => g.id === goalId)
    if (!data.actual && goal?.uom_type !== 'Zero') return toast.error('Please enter what you achieved this quarter.')

    const existing = achievements.find((a) => a.goal_id === goalId && a.quarter === selectedQuarter)
    const payload = {
      goal_id: goalId,
      quarter: selectedQuarter,
      actual: goal?.uom_type === 'Zero' ? 0 : goal?.uom_type === 'Timeline' ? null : Number(data.actual),
      actual_date: goal?.uom_type === 'Timeline' ? data.actual : null,
      status: data.status,
    }

    let error
    if (existing) {
      // Update existing entry
      const res = await supabase.from('goal_achievements').update(payload).eq('id', existing.id)
      error = res.error
    } else {
      // Insert new entry
      const res = await supabase.from('goal_achievements').insert(payload)
      error = res.error
    }

    if (error) toast.error(error.message)
    else {
      toast.success(existing ? 'Progress updated!' : 'Progress saved!')
      fetchAll()
    }
  }

  const getScore = (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId)
    const form = formData[goalId]
    if (!goal || !form?.actual) return null

    const actual = Number(form.actual)
    const target = Number(goal.target)

    if (goal.uom_type === 'Zero') return actual === 0 ? 100 : 0
    if (goal.uom_type === 'Timeline') {
      const aDate = new Date(form.actual).getTime()
      const tDate = new Date(goal.target).getTime()
      if (isNaN(aDate) || isNaN(tDate)) return null
      return aDate <= tDate ? 100 : 0
    }
    if (target === 0) return 0
    if (goal.uom_direction === 'lower') return Math.min(Math.round((target / actual) * 100), 100)
    return Math.min(Math.round((actual / target) * 100), 100)
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-slate-400'
    if (score >= 80) return 'text-emerald-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBarColor = (score: number | null) => {
    if (score === null) return 'bg-slate-200'
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const getStatusStyle = (s: string) => {
    if (s === 'Completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (s === 'On Track') return 'bg-blue-50 text-blue-700 border-blue-200'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  const isAlreadySaved = (goalId: string) => achievements.some((a) => a.goal_id === goalId && a.quarter === selectedQuarter)
  const getManagerComment = (goalId: string) => comments.find((c) => c.goal_id === goalId && c.quarter === selectedQuarter)?.comment

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (userLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 font-medium text-sm">Loading your check-ins...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 text-white fixed h-full shadow-xl z-20 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">VoltEdge</h2>
              <p className="text-slate-500 text-xs uppercase tracking-wider">Goal Portal</p>
            </div>
          </div>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <button onClick={() => router.push('/employee/dashboard')} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <span>My Goals</span>
          </button>
          <button onClick={() => router.push('/employee/checkin')} className="w-full flex items-center space-x-3 bg-blue-600/20 border border-blue-500/20 px-4 py-3 rounded-xl text-sm font-semibold text-blue-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span>Quarterly Check-ins</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleSignOut} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-800 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">

        {/* Navbar */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 z-10 sticky top-0 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Quarterly Progress Log</h1>
            <p className="text-xs text-slate-400">VoltEdge Manufacturing — FY 2025</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{profile?.name || user?.email}</p>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Employee</span>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Quarter Selector */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-2 w-fit">
              {QUARTERS.map((q) => {
                const savedCount = goals.filter(g => achievements.some(a => a.goal_id === g.id && a.quarter === q)).length
                return (
                  <button key={q} onClick={() => setSelectedQuarter(q)}
                    className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      selectedQuarter === q
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}>
                    {q}
                    {savedCount > 0 && savedCount === goals.length && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Info banner */}
            {goals.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {goals.filter(g => achievements.some(a => a.goal_id === g.id && a.quarter === selectedQuarter)).length} of {goals.length} goals logged for {selectedQuarter}
              </div>
            )}

            {/* No approved goals */}
            {goals.length === 0 ? (
              <div className="rounded-2xl bg-white p-16 text-center shadow-sm border border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <h3 className="font-bold text-slate-800 text-lg">No approved goals yet</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Your goals need to be approved by your manager before you can log your quarterly progress here.</p>
                <button onClick={() => router.push('/employee/dashboard')} className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                  Go to My Goals →
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {goals.map((goal) => {
                  const form = formData[goal.id] || { actual: '', status: 'Not Started' }
                  const score = getScore(goal.id)
                  const saved = isAlreadySaved(goal.id)
                  const managerComment = getManagerComment(goal.id)

                  return (
                    <div key={goal.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">

                      {/* Goal Header */}
                      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{goal.thrust_area}</span>
                              {saved ? (
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">✓ {selectedQuarter} Logged</span>
                              ) : (
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">⚠ {selectedQuarter} Not Logged Yet</span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 leading-snug">{goal.title}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                              Target: <strong className="text-slate-700">{goal.target} {goal.uom_type}</strong>
                              <span className="mx-2 text-slate-300">·</span>
                              Weightage: <strong className="text-blue-700">{goal.weightage}%</strong>
                            </p>
                          </div>

                          {/* Score Card */}
                          <div className="w-full md:w-44 bg-slate-50 rounded-xl p-4 border border-slate-100 text-center shrink-0">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Your Score</p>
                            <p className={`text-3xl font-black ${getScoreColor(score)}`}>
                              {score !== null ? `${score}%` : '—'}
                            </p>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                              <div className={`h-1.5 rounded-full transition-all duration-700 ${getScoreBarColor(score)}`}
                                style={{ width: `${score ?? 0}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Input Area */}
                      <div className="px-6 py-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-end">

                          {/* Actual Achievement */}
                          <div className="md:col-span-1">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                              What did you achieve this quarter?
                            </label>
                            {goal.uom_type === 'Zero' ? (
                              <div className="flex gap-3">
                                {['0', '1'].map((v) => (
                                  <button key={v} type="button"
                                    onClick={() => handleFormChange(goal.id, 'actual', v)}
                                    className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                                      form.actual === v
                                        ? v === '0' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-red-400 text-red-700'
                                        : 'bg-white border-slate-200 text-slate-500'
                                    }`}>
                                    {v === '0' ? '✓ Zero (Target Met)' : '✗ Not Zero'}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <input
                                type={goal.uom_type === 'Timeline' ? 'date' : 'number'}
                                value={form.actual}
                                onChange={(e) => handleFormChange(goal.id, 'actual', e.target.value)}
                                placeholder={goal.uom_type === '%' ? 'e.g. 95' : 'Enter your result...'}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                              />
                            )}
                          </div>

                          {/* Status */}
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">How is this going?</label>
                            <select value={form.status} onChange={(e) => handleFormChange(goal.id, 'status', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                              <option value="Not Started">Haven't started yet</option>
                              <option value="On Track">In progress / On track</option>
                              <option value="Completed">Completed ✓</option>
                            </select>
                          </div>

                          {/* Save Button */}
                          <button onClick={() => handleSave(goal.id)}
                            className={`w-full rounded-xl font-bold py-3 text-sm transition-all shadow-sm ${
                              saved
                                ? 'bg-slate-800 hover:bg-slate-900 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                            }`}>
                            {saved ? '↻ Update Progress' : '✓ Save Progress'}
                          </button>
                        </div>

                        {/* Manager Comment */}
                        {managerComment && (
                          <div className="mt-4 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-blue-700 mb-0.5">Manager's Feedback — {selectedQuarter}</p>
                              <p className="text-sm text-blue-900">{managerComment}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}