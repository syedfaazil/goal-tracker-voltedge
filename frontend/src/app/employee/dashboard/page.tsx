'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import toast, { Toaster } from 'react-hot-toast'

type Goal = {
  id: string
  title: string
  description: string
  thrust_area: string
  uom_type: string
  target: number
  weightage: number
  status: string
}

export default function EmployeeDashboard() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thrustArea, setThrustArea] = useState('Operations')
  const [uomType, setUomType] = useState('Numeric')
  const [target, setTarget] = useState('')
  const [weightage, setWeightage] = useState('')

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (profile) {
      // Force users into their correct role dashboards if they wander off
      const path = window.location.pathname
      if (profile.role === 'admin' && !path.includes('/admin')) router.push('/admin/dashboard')
      if (profile.role === 'manager' && !path.includes('/manager')) router.push('/manager/dashboard')
      if (profile.role === 'employee' && !path.includes('/employee')) router.push('/employee/dashboard')
      
      // Only fetch data if they are on the correct page
      if (path.includes(profile.role)) {
         // Replace 'fetchGoals' with whatever your fetch function is named in that specific file!
        fetchGoals() 
      }
    }
      }, [user, userLoading, profile])

  const fetchGoals = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('employee_id', user?.id)
      .order('created_at', { ascending: true })

    if (error) toast.error(error.message)
    else setGoals(data || [])
    setLoading(false)
  }

  const editableGoals = goals.filter((g) => g.status === 'Draft' || g.status === 'Returned')
  const lockedGoals = goals.filter((g) => g.status === 'Pending Approval' || g.status === 'Approved')
  const currentTotalWeightage = editableGoals.reduce((sum, g) => sum + Number(g.weightage), 0)
  const isLocked = lockedGoals.length > 0 && editableGoals.length === 0

  const handleAddDraft = async (e: React.FormEvent) => {
    e.preventDefault()

    const weightNum = Number(weightage)
    if (weightNum < 10) return toast.error('Minimum weightage per goal is 10%.')
    if (currentTotalWeightage + weightNum > 100) return toast.error(`Exceeds 100%. You can only add up to ${100 - currentTotalWeightage}%.`)
    if (editableGoals.length >= 8) return toast.error('Maximum 8 goals allowed.')

    const { error: insertError } = await supabase.from('goals').insert({
      employee_id: user?.id,
      title,
      description,
      thrust_area: thrustArea,
      uom_type: uomType,
      target: Number(target),
      weightage: weightNum,
      status: 'Draft',
    })

    if (insertError) {
      toast.error(insertError.message)
    } else {
      toast.success('Goal added to draft!')
      setTitle('')
      setDescription('')
      setTarget('')
      setWeightage('')
      fetchGoals()
    }
  }

  const handleSubmitForApproval = async () => {
    if (currentTotalWeightage !== 100) {
      return toast.error(`Total weightage must be exactly 100%. Current: ${currentTotalWeightage}%.`)
    }

    const goalIds = editableGoals.map((g) => g.id)
    const { error: updateError } = await supabase
      .from('goals')
      .update({ status: 'Pending Approval' })
      .in('id', goalIds)

    if (updateError) {
      toast.error(updateError.message)
    } else {
      toast.success('Goals submitted for approval!')
      fetchGoals()
    }
  }

  const handleDelete = async (id: string) => {
    const { error: deleteError } = await supabase.from('goals').delete().eq('id', id)
    if (deleteError) toast.error(deleteError.message)
    else {
      toast.success('Goal deleted.')
      fetchGoals()
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (userLoading || loading) return <div className="flex min-h-screen items-center justify-center text-blue-900 font-medium">Loading dashboard...</div>

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
          <button onClick={() => router.push('/employee/dashboard')} className="w-full flex items-center space-x-3 bg-blue-800 px-4 py-3 rounded-lg text-sm font-medium text-white transition-colors">
            <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span>My Goals</span>
          </button>
          <button onClick={() => router.push('/employee/checkin')} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-blue-200 hover:bg-blue-800 transition-colors">
            <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <span>Quarterly Check-ins</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        
        {/* Top Navbar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10 sticky top-0">
          <h1 className="text-xl font-semibold text-slate-800">Goal Dashboard</h1>
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
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* Goal Creation Form */}
            {!isLocked && (
              <div className="rounded-xl bg-white p-8 shadow-sm border border-slate-100">
                <h2 className="mb-6 text-lg font-bold text-slate-800 border-b pb-3">Draft New Goal</h2>
                <form onSubmit={handleAddDraft} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Thrust Area</label>
                      <select value={thrustArea} onChange={(e) => setThrustArea(e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all">
                        <option>Operations</option><option>Sales & Marketing</option><option>Finance</option><option>Learning & Growth</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Goal Title</label>
                      <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-slate-400" placeholder="e.g., Reduce assembly TAT..." />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                      <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all resize-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Unit of Measurement</label>
                      <select value={uomType} onChange={(e) => setUomType(e.target.value)} className="w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all">
                        <option value="Numeric">Numeric</option><option value="%">%</option><option value="Timeline">Timeline</option><option value="Zero">Zero</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Target Value</label>
                        <input type="number" required value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Weightage (%)</label>
                        <input type="number" min="10" max="100" required value={weightage} onChange={(e) => setWeightage(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-5 gap-4">
                    <div className="w-full max-w-md">
                      <div className="flex justify-between text-sm font-semibold mb-1">
                        <span className="text-slate-600">Total Weightage</span>
                        <span className={currentTotalWeightage > 100 ? 'text-red-600' : currentTotalWeightage === 100 ? 'text-green-600' : 'text-blue-700'}>{currentTotalWeightage}% / 100%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all duration-500 ${currentTotalWeightage > 100 ? 'bg-red-500' : currentTotalWeightage === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(currentTotalWeightage, 100)}%` }}></div>
                      </div>
                    </div>
                    <button type="submit" disabled={currentTotalWeightage >= 100 || editableGoals.length >= 8} className="rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 transition-colors">
                      Add to Draft
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Existing Goals List */}
            <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-800">Your Goals</h2>
                {!isLocked && editableGoals.length > 0 && (
                  <button onClick={handleSubmitForApproval} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors">
                    Submit All for Approval
                  </button>
                )}
              </div>

              {goals.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No goals added yet. Start drafting above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Title</th>
                        <th className="px-6 py-4">Area</th>
                        <th className="px-6 py-4">Target</th>
                        <th className="px-6 py-4">Weight</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {goals.map((goal) => (
                        <tr key={goal.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{goal.title}</td>
                          <td className="px-6 py-4 text-slate-600">{goal.thrust_area}</td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{goal.target} <span className="text-xs text-slate-400 ml-1">{goal.uom_type}</span></td>
                          <td className="px-6 py-4 font-bold text-blue-700">{goal.weightage}%</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              goal.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              goal.status === 'Pending Approval' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              goal.status === 'Returned' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {goal.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {(goal.status === 'Draft' || goal.status === 'Returned') && (
                              <button onClick={() => handleDelete(goal.id)} className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors">
                                Delete
                              </button>
                            )}
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