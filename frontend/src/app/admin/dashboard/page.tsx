'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import toast, { Toaster } from 'react-hot-toast'

type Profile = { id: string; name: string | null; role: string }
type Goal = { id: string; employee_id: string; title: string; thrust_area: string; uom_type: string; target: string; weightage: number; status: string }
type Achievement = { id: string; goal_id: string; quarter: string; actual: string; status: string }
type AuditLog = { id: string; goal_id: string; changed_by: string; change_description: string; changed_at: string }

type ActiveTab = 'overview' | 'audit'

export default function AdminDashboard() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [auditPage, setAuditPage] = useState(1)
  const logsPerPage = 8

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (profile) {
      const path = window.location.pathname
      if (profile.role === 'manager') router.push('/manager/dashboard')
      if (profile.role === 'employee') router.push('/employee/dashboard')
      if (path.includes('admin')) fetchData()
    }
  }, [user, userLoading, profile])

  const fetchData = async () => {
    setLoading(true)
    const [profilesRes, goalsRes, achRes, auditRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('goal_achievements').select('*'),
      supabase.from('audit_logs').select('*').order('changed_at', { ascending: false }),
    ])

    setProfiles(profilesRes.data || [])
    setGoals(goalsRes.data || [])
    setAchievements(achRes.data || [])
    setAuditLogs(auditRes.data || [])
    setLoading(false)
  }

  const handleUnlockGoals = async (employeeId: string) => {
    const empGoals = goals.filter(g => g.employee_id === employeeId && g.status === 'Approved')
    if (empGoals.length === 0) return toast.error('No approved goals to unlock for this employee.')

    const { error } = await supabase
      .from('goals')
      .update({ status: 'Draft' })
      .eq('employee_id', employeeId)

    if (error) return toast.error(error.message)

    const emp = profiles.find(p => p.id === employeeId)
    const logs = empGoals.map(g => ({
      goal_id: g.id,
      changed_by: user?.id,
      change_description: `Admin unlocked goal for ${emp?.name || 'employee'}. Status changed from Approved back to Draft.`,
    }))
    await supabase.from('audit_logs').insert(logs)

    toast.success(`Goals unlocked for ${emp?.name || 'employee'}!`)
    fetchData()
  }

  const exportCSV = () => {
    let csv = 'Employee Name,Goal Title,Focus Area,Measurement,Target,Priority,Weightage,Quarter,Actual Achievement,Check-in Status\n'
    const approvedGoals = goals.filter(g => g.status === 'Approved')

    approvedGoals.forEach(goal => {
      const emp = profiles.find(p => p.id === goal.employee_id)
      const goalAchs = achievements.filter(a => a.goal_id === goal.id)

      if (goalAchs.length === 0) {
        csv += `"${emp?.name || 'Unknown'}","${goal.title}","${goal.thrust_area}","${goal.uom_type}","${goal.target}","${goal.weightage}%","N/A","N/A","No Check-in"\n`
      } else {
        goalAchs.forEach(ach => {
          csv += `"${emp?.name || 'Unknown'}","${goal.title}","${goal.thrust_area}","${goal.uom_type}","${goal.target}","${goal.weightage}%","${ach.quarter}","${ach.actual}","${ach.status}"\n`
        })
      }
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `VoltEdge_Goals_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Report downloaded!')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (userLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 font-medium text-sm">Loading admin dashboard...</p>
      </div>
    </div>
  )

  const employees = profiles.filter(p => p.role === 'employee')
  const totalEmployees = employees.length
  const goalsSubmitted = goals.filter(g => g.status !== 'Draft').length
  const goalsPending = goals.filter(g => g.status === 'Pending Approval').length
  const checkinsCompleted = achievements.length

  const paginatedLogs = auditLogs.slice((auditPage - 1) * logsPerPage, auditPage * logsPerPage)
  const totalPages = Math.ceil(auditLogs.length / logsPerPage)

  const getGoalTitle = (goalId: string) => goals.find(g => g.id === goalId)?.title || 'Unknown Goal'
  const getChangedByName = (userId: string) => profiles.find(p => p.id === userId)?.name || 'Unknown'

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
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-blue-600/20 border border-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'audit' ? 'bg-blue-600/20 border border-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <span>Audit Logs</span>
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
              {activeTab === 'overview' ? 'System Overview' : 'Audit Logs'}
            </h1>
            <p className="text-xs text-slate-400">VoltEdge Manufacturing — FY 2025</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-sm transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export Report
            </button>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{profile?.name || user?.email}</p>
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Admin</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <>
                {/* Stat Cards */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { label: 'Total Employees', value: totalEmployees, color: 'bg-blue-600', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0' },
                    { label: 'Goals Submitted', value: goalsSubmitted, color: 'bg-indigo-500', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                    { label: 'Pending Approval', value: goalsPending, color: 'bg-amber-500', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                    { label: 'Check-ins Logged', value: checkinsCompleted, color: 'bg-emerald-500', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6 flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl ${stat.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                        <p className="text-3xl font-black text-slate-900 mt-0.5">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Employee Status Table */}
                <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                    <h2 className="text-base font-bold text-slate-900">Employee Goal Status</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Track submission and check-in progress for every employee</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4">Employee</th>
                          <th className="px-6 py-4">Goal Status</th>
                          <th className="px-6 py-4 text-center">Q1</th>
                          <th className="px-6 py-4 text-center">Q2</th>
                          <th className="px-6 py-4 text-center">Q3</th>
                          <th className="px-6 py-4 text-center">Q4</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {employees.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">No employees found.</td>
                          </tr>
                        ) : employees.map(emp => {
                          const empGoals = goals.filter(g => g.employee_id === emp.id)
                          const hasApproved = empGoals.some(g => g.status === 'Approved')
                          const hasPending = empGoals.some(g => g.status === 'Pending Approval')
                          const hasNone = empGoals.length === 0

                          const goalStatus = hasPending ? 'Pending' : hasApproved ? 'Approved' : hasNone ? 'No Goals' : 'Draft'

                          const empGoalIds = empGoals.map(g => g.id)
                          const empAchs = achievements.filter(a => empGoalIds.includes(a.goal_id))

                          const quarterStatus = (q: string) => empAchs.some(a => a.quarter === q)

                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-black text-sm">{emp.name?.[0] || '?'}</span>
                                  </div>
                                  <span className="font-semibold text-slate-900">{emp.name || 'Unknown'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  goalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  goalStatus === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  goalStatus === 'No Goals' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                  'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {goalStatus}
                                </span>
                              </td>
                              {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                                <td key={q} className="px-6 py-4 text-center">
                                  {hasApproved ? (
                                    quarterStatus(q) ? (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Done</span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">Pending</span>
                                    )
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </td>
                              ))}
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleUnlockGoals(emp.id)}
                                  disabled={!hasApproved}
                                  className="rounded-lg text-xs font-bold px-3 py-2 transition-colors disabled:text-slate-300 disabled:cursor-not-allowed text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 disabled:border-slate-200">
                                  Unlock Goals
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ── AUDIT LOG TAB ── */}
            {activeTab === 'audit' && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-base font-bold text-slate-900">Audit Trail</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Full history of every change made in the system</p>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="p-16 text-center">
                    <h3 className="font-bold text-slate-700">No audit logs yet</h3>
                    <p className="text-slate-400 text-sm mt-1">Logs will appear here when goals are approved, returned, or unlocked.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4">Date & Time</th>
                            <th className="px-6 py-4">Changed By</th>
                            <th className="px-6 py-4">Goal</th>
                            <th className="px-6 py-4">What Happened</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                                {new Date(log.changed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              </td>
                              <td className="px-6 py-4 font-semibold text-slate-900">{getChangedByName(log.changed_by)}</td>
                              <td className="px-6 py-4 text-slate-700 max-w-xs">
                                <p className="truncate">{getGoalTitle(log.goal_id)}</p>
                              </td>
                              <td className="px-6 py-4 text-slate-600">{log.change_description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        Showing {((auditPage - 1) * logsPerPage) + 1}–{Math.min(auditPage * logsPerPage, auditLogs.length)} of {auditLogs.length} entries
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={auditPage === 1}
                          onClick={() => setAuditPage(p => p - 1)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          ← Previous
                        </button>
                        <button
                          disabled={auditPage === totalPages || totalPages === 0}
                          onClick={() => setAuditPage(p => p + 1)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          Next →
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}