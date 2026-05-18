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

export default function AdminDashboard() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [auditPage, setAuditPage] = useState(1)
  const logsPerPage = 5

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (profile) {
      const path = window.location.pathname
      if (profile.role === 'admin' && !path.includes('/admin')) router.push('/admin/dashboard')
      if (profile.role === 'manager' && !path.includes('/manager')) router.push('/manager/dashboard')
      if (profile.role === 'employee' && !path.includes('/employee')) router.push('/employee/dashboard')
      
      if (path.includes(profile.role)) {
        fetchData() 
      }
    }
  }, [user, userLoading, profile])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    const [profilesRes, goalsRes, achRes, auditRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('goals').select('*'),
      supabase.from('goal_achievements').select('*'),
      supabase.from('audit_logs').select('*').order('changed_at', { ascending: false })
    ])

    if (profilesRes.error) setError(profilesRes.error.message)
    if (goalsRes.error) setError(goalsRes.error.message)
    if (achRes.error) setError(achRes.error.message)
    if (auditRes.error) setError(auditRes.error.message)

    setProfiles(profilesRes.data || [])
    setGoals(goalsRes.data || [])
    setAchievements(achRes.data || [])
    setAuditLogs(auditRes.data || [])
    
    setLoading(false)
  }

  const handleUnlockGoals = async (employeeId: string) => {
    const empGoals = goals.filter(g => g.employee_id === employeeId && g.status === 'Approved')
    if (empGoals.length === 0) return

    const { error: updateError } = await supabase
      .from('goals')
      .update({ status: 'Draft' })
      .eq('employee_id', employeeId)

    if (updateError) {
      toast.error(updateError.message)
      return
    }

    const newLogs = empGoals.map(g => ({
      goal_id: g.id,
      changed_by: user?.id,
      change_description: 'Admin unlocked goal. Status changed from Approved back to Draft.',
    }))

    await supabase.from('audit_logs').insert(newLogs)
    toast.success('Goals successfully unlocked and returned to Draft!')
    fetchData()
  }

  const exportCSV = () => {
    let csv = 'Employee Name,Goal Title,Thrust Area,UoM,Target,Weightage,Quarter,Actual Achievement,Check-in Status\n'
    
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
    link.setAttribute('download', 'Employee_Achievements_Report.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (userLoading || loading) return <div className="p-8 text-center">Loading admin dashboard...</div>

  const employees = profiles.filter(p => p.role === 'employee')
  const totalEmployees = employees.length
  const goalsSubmitted = goals.filter(g => g.status !== 'Draft').length
  const goalsPending = goals.filter(g => g.status === 'Pending Approval').length
  const checkinsCompleted = achievements.length

  const paginatedLogs = auditLogs.slice((auditPage - 1) * logsPerPage, auditPage * logsPerPage)
  const totalPages = Math.ceil(auditLogs.length / logsPerPage)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500">System Overview & Governance</p>
          </div>
          <div className="flex space-x-4">
            <button 
              onClick={exportCSV}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Export CSV Report
            </button>
            <button 
              onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
              className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Sign out
            </button>
          </div>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-lg bg-white p-6 shadow-sm border-l-4 border-blue-500">
            <p className="text-sm font-medium text-gray-500">Total Employees</p>
            <p className="text-3xl font-bold text-gray-900">{totalEmployees}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm border-l-4 border-indigo-500">
            <p className="text-sm font-medium text-gray-500">Goals Submitted</p>
            <p className="text-3xl font-bold text-gray-900">{goalsSubmitted}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm border-l-4 border-yellow-500">
            <p className="text-sm font-medium text-gray-500">Pending Approval</p>
            <p className="text-3xl font-bold text-gray-900">{goalsPending}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm border-l-4 border-green-500">
            <p className="text-sm font-medium text-gray-500">Check-ins Completed</p>
            <p className="text-3xl font-bold text-gray-900">{checkinsCompleted}</p>
          </div>
        </div>

        {/* Main Status Table */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Employee Completion Status</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Goal Status</th>
                  <th className="px-4 py-3">Q1 Check-in</th>
                  <th className="px-4 py-3">Q2 Check-in</th>
                  <th className="px-4 py-3">Q3 Check-in</th>
                  <th className="px-4 py-3">Q4 Check-in</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const empGoals = goals.filter(g => g.employee_id === emp.id)
                  const hasApproved = empGoals.some(g => g.status === 'Approved')
                  const hasPending = empGoals.some(g => g.status === 'Pending Approval')
                  const status = hasPending ? 'Pending' : hasApproved ? 'Approved' : 'Draft / None'

                  const empGoalIds = empGoals.map(g => g.id)
                  const empAchs = achievements.filter(a => empGoalIds.includes(a.goal_id))
                  
                  const hasQ1 = empAchs.some(a => a.quarter === 'Q1')
                  const hasQ2 = empAchs.some(a => a.quarter === 'Q2')
                  const hasQ3 = empAchs.some(a => a.quarter === 'Q3')
                  const hasQ4 = empAchs.some(a => a.quarter === 'Q4')

                  return (
                    <tr key={emp.id} className="border-b bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{emp.name || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          status === 'Approved' ? 'bg-green-100 text-green-800' :
                          status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                        }`}>{status}</span>
                      </td>
                      <td className="px-4 py-3">{hasQ1 ? '✅' : '-'}</td>
                      <td className="px-4 py-3">{hasQ2 ? '✅' : '-'}</td>
                      <td className="px-4 py-3">{hasQ3 ? '✅' : '-'}</td>
                      <td className="px-4 py-3">{hasQ4 ? '✅' : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => handleUnlockGoals(emp.id)}
                          disabled={!hasApproved}
                          className="text-indigo-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                        >
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

        {/* Audit Logs Table */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Audit Logs</h2>
          {auditLogs.length === 0 ? (
            <p className="text-gray-500">No audit logs available.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                    <tr>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Changed By</th>
                      <th className="px-4 py-3">Goal ID</th>
                      <th className="px-4 py-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map(log => {
                      const userProfile = profiles.find(p => p.id === log.changed_by)
                      return (
                        <tr key={log.id} className="border-b bg-white">
                          <td className="px-4 py-3 whitespace-nowrap">{new Date(log.changed_at).toLocaleString()}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{userProfile?.name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-xs">{log.goal_id.split('-')[0]}...</td>
                          <td className="px-4 py-3">{log.change_description}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Page {auditPage} of {totalPages}
                </span>
                <div className="space-x-2">
                  <button 
                    disabled={auditPage === 1} 
                    onClick={() => setAuditPage(p => p - 1)}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button 
                    disabled={auditPage === totalPages} 
                    onClick={() => setAuditPage(p => p + 1)}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}