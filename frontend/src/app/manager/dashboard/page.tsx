'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import toast, { Toaster } from 'react-hot-toast'

type Profile = {
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
  target: number
  weightage: number
  status: string
  employeeName?: string
}

export default function ManagerDashboard() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [pendingGoals, setPendingGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (user) {
      fetchPendingGoals()
    }
  }, [user, userLoading])

  const fetchPendingGoals = async () => {
    setLoading(true)
    
    // Fetch all goals that need approval
    const { data: goalsData, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('status', 'Pending Approval')

    if (goalsError) {
      toast.error(goalsError.message)
      setLoading(false)
      return
    }

    // Fetch profiles to map employee names to the goals
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')

    if (profilesError) {
      toast.error(profilesError.message)
    }

    // Map names to goals safely
    const enrichedGoals = (goalsData || []).map((goal) => {
      const empProfile = (profilesData || []).find((p) => p.id === goal.employee_id)
      return {
        ...goal,
        employeeName: empProfile?.name || empProfile?.email || 'Unknown Employee'
      }
    })

    setPendingGoals(enrichedGoals)
    setLoading(false)
  }

  const handleUpdateStatus = async (goalId: string, newStatus: 'Approved' | 'Returned') => {
    const { error } = await supabase
      .from('goals')
      .update({ status: newStatus })
      .eq('id', goalId)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Goal ${newStatus.toLowerCase()} successfully!`)
      // Remove the handled goal from the UI immediately
      setPendingGoals((prev) => prev.filter((g) => g.id !== goalId))
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (userLoading || loading) return <div className="flex min-h-screen items-center justify-center text-blue-900 font-medium">Loading approvals...</div>

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
          <button className="w-full flex items-center space-x-3 bg-blue-800 px-4 py-3 rounded-lg text-sm font-medium text-white transition-colors">
            <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Pending Approvals</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10 sticky top-0">
          <h1 className="text-xl font-semibold text-slate-800">Manager Dashboard</h1>
          <div className="flex items-center space-x-6">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-slate-900">{profile?.name || user?.email}</span>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-0.5">Manager</span>
            </div>
            <button onClick={handleSignOut} className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            
            <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Goals Awaiting Approval</h2>
                  <p className="text-sm text-slate-500 mt-1">Review employee submissions to lock them in for the year.</p>
                </div>
                <div className="bg-amber-100 text-amber-800 text-sm font-bold px-3 py-1 rounded-full">
                  {pendingGoals.length} Pending
                </div>
              </div>

              {pendingGoals.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">All caught up!</h3>
                  <p className="text-sm mt-1">There are no goals pending approval at the moment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4">Goal Title</th>
                        <th className="px-6 py-4">Area / Target</th>
                        <th className="px-6 py-4">Weight</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingGoals.map((goal) => (
                        <tr key={goal.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">{goal.employeeName}</td>
                          <td className="px-6 py-4 font-medium text-slate-700">{goal.title}</td>
                          <td className="px-6 py-4">
                            <div className="text-slate-900 font-medium">{goal.target} <span className="text-xs text-slate-400">{goal.uom_type}</span></div>
                            <div className="text-xs text-slate-500 mt-0.5">{goal.thrust_area}</div>
                          </td>
                          <td className="px-6 py-4 font-bold text-blue-700">{goal.weightage}%</td>
                          <td className="px-6 py-4 text-right space-x-3">
                            <button 
                              onClick={() => handleUpdateStatus(goal.id, 'Returned')}
                              className="text-sm font-semibold text-red-600 hover:text-red-800 transition-colors bg-red-50 px-3 py-1.5 rounded-md"
                            >
                              Return
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(goal.id, 'Approved')}
                              className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors px-3 py-1.5 rounded-md shadow-sm"
                            >
                              Approve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}