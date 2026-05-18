'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import toast, { Toaster } from 'react-hot-toast'

type Employee = {
  id: string
  name: string
  email: string
}

type Goal = {
  id: string
  employee_id: string
  title: string
  thrust_area: string
  uom_type: string
  uom_direction: string
  target: number
  weightage: number
  status: string
  priority: string
}

type Achievement = {
  goal_id: string
  quarter: string
  actual: string
  status: string
}

type Comment = {
  id?: string
  goal_id: string
  manager_id: string
  quarter: string
  comment: string
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export default function ManagerDashboard() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [selectedQuarter, setSelectedQuarter] = useState('Q1')
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (profile) {
      const path = window.location.pathname
      if (profile.role === 'admin') router.push('/admin/dashboard')
      if (profile.role === 'employee') router.push('/employee/dashboard')
      if (path.includes('manager')) fetchAll()
    }
  }, [user, userLoading, profile])

  const fetchAll = async () => {
    setLoading(true)

    const [empRes, goalsRes, achRes, commentsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email').eq('role', 'employee'),
      supabase.from('goals').select('*'),
      supabase.from('goal_achievements').select('*'),
      supabase.from('checkin_comments').select('*'),
    ])

    setEmployees(empRes.data || [])
    setGoals(goalsRes.data || [])
    setAchievements(achRes.data || [])
    setComments(commentsRes.data || [])
    setLoading(false)
  }

  const getEmployeeGoals = (empId: string, status?: string | string[]) => {
    return goals.filter(g => {
      if (g.employee_id !== empId) return false
      if (!status) return true
      if (Array.isArray(status)) return status.includes(g.status)
      return g.status === status
    })
  }

  const handleBatchApprove = async (empId: string, newStatus: 'Approved' | 'Returned') => {
    const empGoals = getEmployeeGoals(empId, 'Pending Approval')
    if (empGoals.length === 0) return toast.error('No pending goals found for this employee.')

    const { error } = await supabase
      .from('goals')
      .update({ status: newStatus })
      .in('id', empGoals.map(g => g.id))

    if (error) return toast.error(error.message)

    // Write audit log for each goal
    const emp = employees.find(e => e.id === empId)
    const logs = empGoals.map(g => ({
      goal_id: g.id,
      changed_by: user?.id,
      change_description: `Manager ${newStatus === 'Approved' ? 'approved' : 'returned'} goal for ${emp?.name || 'employee'}.`,
    }))
    await supabase.from('audit_logs').insert(logs)

    toast.success(
      newStatus === 'Approved'
        ? `All goals approved for ${emp?.name}!`
        : `Goals sent back to ${emp?.name} for revision.`
    )
    fetchAll()
  }

  const handleSaveComment = async (goalId: string) => {
    const comment = commentDrafts[`${goalId}-${selectedQuarter}`]
    if (!comment?.trim()) return toast.error('Please write a comment before saving.')

    const existing = comments.find(c => c.goal_id === goalId && c.quarter === selectedQuarter)

    let error
    if (existing?.id) {
      const res = await supabase.from('checkin_comments').update({ comment }).eq('id', existing.id)
      error = res.error
    } else {
      const res = await supabase.from('checkin_comments').insert({
        goal_id: goalId,
        manager_id: user?.id,
        quarter: selectedQuarter,
        comment,
      })
      error = res.error
    }

    if (error) toast.error(error.message)
    else {
      toast.success('Feedback saved!')
      fetchAll()
    }
  }

  const getExistingComment = (goalId: string) =>
    comments.find(c => c.goal_id === goalId && c.quarter === selectedQuarter)?.comment || ''

  const getAchievement = (goalId: string, quarter: string) =>
    achievements.find(a => a.goal_id === goalId && a.quarter === quarter)

  const getScore = (goal: Goal, actual: string) => {
    if (!actual) return null
    const a = Number(actual)
    const t = Number(goal.target)
    if (goal.uom_type === 'Zero') return a === 0 ? 100 : 0
    if (t === 0) return 0
    if (goal.uom_direction === 'lower') return Math.min(Math.round((t / a) * 100), 100)
    return Math.min(Math.round((a / t) * 100), 100)
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-slate-400'
    if (score >= 80) return 'text-emerald-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const getPriorityStyle = (p: string) => {
    if (p === 'High') return 'bg-red-50 text-red-700 border-red-200'
    if (p === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const pendingEmployees = employees.filter(e => getEmployeeGoals(e.id, 'Pending Approval').length > 0)
  const approvedEmployees = employees.filter(e => getEmployeeGoals(e.id, 'Approved').length > 0)

  if (userLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 font-medium text-sm">Loading manager dashboard...</p>
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
          <button
            onClick={() => setActiveTab('pending')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-blue-600/20 border border-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Pending Approvals</span>
            {pendingEmployees.length > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {pendingEmployees.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'approved' ? 'bg-blue-600/20 border border-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span>Team Check-ins</span>
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
            <h1 className="text-lg font-bold text-slate-900">
              {activeTab === 'pending' ? 'Pending Approvals' : 'Team Check-ins'}
            </h1>
            <p className="text-xs text-slate-400">VoltEdge Manufacturing — FY 2025</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{profile?.name || user?.email}</p>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Manager</span>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* ── PENDING APPROVALS TAB ── */}
            {activeTab === 'pending' && (
              <>
                {pendingEmployees.length === 0 ? (
                  <div className="rounded-2xl bg-white p-16 text-center shadow-sm border border-slate-100">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">All caught up!</h3>
                    <p className="text-slate-500 text-sm mt-1">No goals are waiting for your approval right now.</p>
                  </div>
                ) : (
                  pendingEmployees.map(emp => {
                    const empGoals = getEmployeeGoals(emp.id, 'Pending Approval')
                    const totalWeightage = empGoals.reduce((s, g) => s + g.weightage, 0)

                    return (
                      <div key={emp.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                        {/* Employee Header */}
                        <div className="px-6 py-5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                              <span className="text-white font-black text-lg">{emp.name?.[0] || '?'}</span>
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{emp.name}</p>
                              <p className="text-xs text-slate-500">{empGoals.length} goals submitted · Total weightage: <strong className={totalWeightage === 100 ? 'text-emerald-600' : 'text-red-600'}>{totalWeightage}%</strong></p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleBatchApprove(emp.id, 'Returned')}
                              className="rounded-xl border-2 border-red-200 bg-red-50 text-red-700 font-bold px-4 py-2 text-sm hover:bg-red-100 transition-colors">
                              ✗ Send Back for Changes
                            </button>
                            <button
                              onClick={() => handleBatchApprove(emp.id, 'Approved')}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 text-sm transition-colors shadow-sm">
                              ✓ Approve All Goals
                            </button>
                          </div>
                        </div>

                        {/* Goals Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                              <tr>
                                <th className="px-6 py-3">Goal</th>
                                <th className="px-6 py-3">Focus Area</th>
                                <th className="px-6 py-3">Target</th>
                                <th className="px-6 py-3">Priority</th>
                                <th className="px-6 py-3">Weightage</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {empGoals.map(goal => (
                                <tr key={goal.id} className="hover:bg-slate-50/50">
                                  <td className="px-6 py-4 font-medium text-slate-900 max-w-xs">{goal.title}</td>
                                  <td className="px-6 py-4 text-slate-600">{goal.thrust_area}</td>
                                  <td className="px-6 py-4">
                                    <span className="font-semibold text-slate-800">{goal.target ?? '—'}</span>
                                    <span className="text-xs text-slate-400 ml-1">{goal.uom_type}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getPriorityStyle(goal.priority)}`}>
                                      {goal.priority}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 font-black text-blue-700">{goal.weightage}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })
                )}
              </>
            )}

            {/* ── TEAM CHECK-INS TAB ── */}
            {activeTab === 'approved' && (
              <>
                {/* Quarter Selector */}
                <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-2 w-fit">
                  {QUARTERS.map((q) => (
                    <button key={q} onClick={() => setSelectedQuarter(q)}
                      className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        selectedQuarter === q ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}>
                      {q}
                    </button>
                  ))}
                </div>

                {approvedEmployees.length === 0 ? (
                  <div className="rounded-2xl bg-white p-16 text-center shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg">No approved goals yet</h3>
                    <p className="text-slate-500 text-sm mt-1">Approve employee goals first to see their check-in progress here.</p>
                  </div>
                ) : (
                  approvedEmployees.map(emp => {
                    const empGoals = getEmployeeGoals(emp.id, 'Approved')

                    return (
                      <div key={emp.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                        {/* Employee Header */}
                        <div className="px-6 py-5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                            <span className="text-white font-black text-lg">{emp.name?.[0] || '?'}</span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{emp.name}</p>
                            <p className="text-xs text-slate-500">
                              {empGoals.filter(g => getAchievement(g.id, selectedQuarter)).length} of {empGoals.length} goals logged for {selectedQuarter}
                            </p>
                          </div>
                        </div>

                        {/* Goals with check-in data */}
                        <div className="divide-y divide-slate-100">
                          {empGoals.map(goal => {
                            const ach = getAchievement(goal.id, selectedQuarter)
                            const score = ach ? getScore(goal, ach.actual) : null
                            const existingComment = getExistingComment(goal.id)
                            const draftKey = `${goal.id}-${selectedQuarter}`

                            return (
                              <div key={goal.id} className="p-6">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                  <div className="flex-1">
                                    <p className="font-bold text-slate-900">{goal.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      Target: <strong className="text-slate-700">{goal.target} {goal.uom_type}</strong>
                                      <span className="mx-2 text-slate-300">·</span>
                                      Weightage: <strong className="text-blue-700">{goal.weightage}%</strong>
                                    </p>
                                  </div>

                                  {/* Planned vs Actual */}
                                  <div className="flex gap-3">
                                    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100 min-w-[80px]">
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Target</p>
                                      <p className="text-lg font-black text-slate-700">{goal.target ?? '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100 min-w-[80px]">
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Actual</p>
                                      <p className="text-lg font-black text-slate-700">{ach?.actual ?? '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100 min-w-[80px]">
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Score</p>
                                      <p className={`text-lg font-black ${getScoreColor(score)}`}>{score !== null ? `${score}%` : '—'}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Status Badge */}
                                {ach && (
                                  <div className="mb-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                                      ach.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                      ach.status === 'On Track' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                      {ach.status}
                                    </span>
                                  </div>
                                )}

                                {!ach && (
                                  <div className="mb-4">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      ⚠ Employee hasn't logged {selectedQuarter} yet
                                    </span>
                                  </div>
                                )}

                                {/* Manager Comment Box */}
                                <div className="mt-2">
                                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Your feedback for {selectedQuarter}
                                    {existingComment && <span className="ml-2 text-xs font-normal text-emerald-600">✓ Saved</span>}
                                  </label>
                                  <div className="flex gap-3">
                                    <textarea
                                      rows={2}
                                      defaultValue={existingComment}
                                      onChange={(e) => setCommentDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                      placeholder="Add your feedback or coaching notes for this goal..."
                                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none placeholder:text-slate-400"
                                    />
                                    <button
                                      onClick={() => handleSaveComment(goal.id)}
                                      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 text-sm transition-colors shadow-sm self-end py-3">
                                      {existingComment ? 'Update' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}