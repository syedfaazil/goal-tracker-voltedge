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
  target: string
  weightage: number
}

type AchievementForm = {
  quarter: string
  actual: string
  status: string
}

export default function EmployeeCheckins() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [formData, setFormData] = useState<Record<string, AchievementForm>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
    else if (user) fetchGoals()
  }, [user, userLoading])

  const fetchGoals = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('goals')
      .select('id, title, uom_type, target, weightage')
      .eq('employee_id', user?.id)
      .eq('status', 'Approved')

    if (error) toast.error(error.message)
    else {
      setGoals(data || [])
      const initialForm: Record<string, AchievementForm> = {}
      data?.forEach(g => {
        initialForm[g.id] = { quarter: 'Q1', actual: '', status: 'Not Started' }
      })
      setFormData(initialForm)
    }
    setLoading(false)
  }

  const handleFormChange = (goalId: string, field: keyof AchievementForm, value: string) => {
    setFormData(prev => ({
      ...prev,
      [goalId]: { ...prev[goalId], [field]: value }
    }))
  }

  const handleSave = async (goalId: string) => {
    const data = formData[goalId]
    const goal = goals.find((g) => g.id === goalId)
    
    if (!data.actual) return toast.error('Actual achievement is required.')

    const { error: insertError } = await supabase.from('goal_achievements').insert({
      goal_id: goalId,
      quarter: data.quarter,
      actual: goal?.uom_type === 'Timeline' ? null : Number(data.actual) || 0,
      status: data.status,
    })

    if (insertError) toast.error(insertError.message)
    else toast.success('Progress saved successfully!')
  }

  const getScore = (actual: string, target: string, uomType: string) => {
    if (!actual) return '-'
    if (uomType === 'Zero') return Number(actual) === 0 ? '100%' : '0%'
    if (uomType === 'Timeline') {
      const aDate = new Date(actual).getTime()
      const tDate = new Date(target).getTime()
      if (isNaN(aDate) || isNaN(tDate)) return '-'
      return aDate <= tDate ? '100%' : '0%'
    }
    const a = Number(actual)
    const t = Number(target)
    if (t === 0) return '0%'
    return `${Math.min(Math.round((a / t) * 100), 100)}%`
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (userLoading || loading) return <div className="flex min-h-screen items-center justify-center text-blue-900 font-medium">Loading check-ins...</div>

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white fixed h-full shadow-xl z-20 hidden md:block">
        <div className="p-6 border-b border-blue-800">
          <h2 className="text-2xl font-bold tracking-tight">VoltEdge</h2>
          <p className="text-blue-300 text-xs uppercase tracking-wider mt-1">Goal Portal</p>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => router.push('/employee/dashboard')} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-blue-200 hover:bg-blue-800 transition-colors">
            <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span>My Goals</span>
          </button>
          <button onClick={() => router.push('/employee/checkin')} className="w-full flex items-center space-x-3 bg-blue-800 px-4 py-3 rounded-lg text-sm font-medium text-white transition-colors">
            <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span>Quarterly Check-ins</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10 sticky top-0">
          <h1 className="text-xl font-semibold text-slate-800">Progress Log</h1>
          <div className="flex items-center space-x-6">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-slate-900">{profile?.name || user?.email}</span>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-0.5">Employee</span>
            </div>
            <button onClick={handleSignOut} className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {goals.length === 0 ? (
              <div className="rounded-xl bg-white p-12 text-center shadow-sm border border-slate-100">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">No Approved Goals Yet</h3>
                <p className="text-slate-500 mt-2">Goals must be approved by your manager before you can log progress.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {goals.map(goal => {
                  const form = formData[goal.id]
                  const scoreRaw = getScore(form.actual, goal.target, goal.uom_type);
                  const scoreNum = scoreRaw === '-' ? 0 : parseInt(scoreRaw.replace('%', ''));
                  
                  return (
                    <div key={goal.id} className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                      <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between border-b border-slate-100 pb-5 gap-4">
                        <div className="flex-1">
                          <h2 className="text-lg font-bold text-slate-900 leading-snug">{goal.title}</h2>
                          <div className="flex flex-wrap items-center gap-4 mt-2">
                            <span className="text-sm font-medium text-slate-500">Target: <strong className="text-slate-700">{goal.target} {goal.uom_type}</strong></span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-sm font-medium text-slate-500">Weightage: <strong className="text-blue-700">{goal.weightage}%</strong></span>
                          </div>
                        </div>
                        <div className="w-full md:w-48 bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Projected Score</p>
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-2xl font-black text-blue-700">{scoreRaw}</span>
                            <div className="w-16 bg-slate-200 rounded-full h-2 hidden sm:block">
                              <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${scoreNum}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-4 items-end">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Quarter</label>
                          <select value={form.quarter} onChange={(e) => handleFormChange(goal.id, 'quarter', e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all">
                            <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Actual Result</label>
                          <input type={goal.uom_type === 'Timeline' ? 'date' : 'number'} value={form.actual} onChange={(e) => handleFormChange(goal.id, 'actual', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all" placeholder="Enter value..." />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                          <select value={form.status} onChange={(e) => handleFormChange(goal.id, 'status', e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all">
                            <option>Not Started</option><option>On Track</option><option>Completed</option>
                          </select>
                        </div>
                        <button onClick={() => handleSave(goal.id)} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors">
                          Save Progress
                        </button>
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