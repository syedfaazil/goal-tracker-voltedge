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
  uom_direction: string
  target: number
  weightage: number
  status: string
  priority: string
}

const THRUST_AREAS = [
  'Production',
  'Quality',
  'Safety',
  'Delivery',
  'Cost',
  'Energy Efficiency',
  'Learning & Development',
]

const UOM_OPTIONS = [
  { value: 'Numeric', label: 'Number (e.g. units, count)' },
  { value: '%', label: 'Percentage (e.g. 95%)' },
  { value: 'Timeline', label: 'Date (e.g. complete by Jun 30)' },
  { value: 'Zero', label: 'Yes / No Target (e.g. zero incidents)' },
]

const PRIORITY_OPTIONS = [
  { value: 'High', label: '🔴 High', points: 3, color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'Medium', label: '🟡 Medium', points: 2, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'Low', label: '🟢 Low', points: 1, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
]

const DIRECTION_OPTIONS = [
  { value: 'higher', label: 'Higher is better (e.g. more units produced)' },
  { value: 'lower', label: 'Lower is better (e.g. fewer defects)' },
]

function computeWeightages(goals: { priority: string }[]) {
  const points: Record<string, number> = { High: 3, Medium: 2, Low: 1 }
  const total = goals.reduce((sum, g) => sum + (points[g.priority] || 1), 0)
  if (total === 0) return []
  return goals.map((g) => Math.round(((points[g.priority] || 1) / total) * 100))
}

export default function EmployeeDashboard() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thrustArea, setThrustArea] = useState('Production')
  const [uomType, setUomType] = useState('Numeric')
  const [uomDirection, setUomDirection] = useState('higher')
  const [target, setTarget] = useState('')
  const [priority, setPriority] = useState('Medium')

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (profile) {
      const path = window.location.pathname
      if (profile.role === 'admin' && !path.includes('/admin')) router.push('/admin/dashboard')
      if (profile.role === 'manager' && !path.includes('/manager')) router.push('/manager/dashboard')
      if (profile.role === 'employee' && !path.includes('/employee')) router.push('/employee/dashboard')
      if (path.includes(profile.role)) fetchGoals()
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
  const isLocked = lockedGoals.length > 0 && editableGoals.length === 0

  const handleAddDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editableGoals.length >= 8) return toast.error('You can add a maximum of 8 goals.')

    // Compute new weightages for all goals including the new one
    const allPriorities = [...editableGoals.map(g => ({ priority: g.priority })), { priority }]
    const weightages = computeWeightages(allPriorities)
    const newWeightage = weightages[weightages.length - 1]

    // Update existing goals' weightages
    for (let i = 0; i < editableGoals.length; i++) {
      await supabase.from('goals').update({ weightage: weightages[i] }).eq('id', editableGoals[i].id)
    }

    const { error: insertError } = await supabase.from('goals').insert({
      employee_id: user?.id,
      title,
      description,
      thrust_area: thrustArea,
      uom_type: uomType,
      uom_direction: uomDirection,
      target: uomType === 'Timeline' ? null : Number(target),
      weightage: newWeightage,
      priority,
      status: 'Draft',
    })

    if (insertError) {
      toast.error(insertError.message)
    } else {
      toast.success('Goal added successfully!')
      setTitle('')
      setDescription('')
      setTarget('')
      setPriority('Medium')
      setThrustArea('Production')
      setUomType('Numeric')
      setUomDirection('higher')
      fetchGoals()
    }
  }

  const handleSubmitForApproval = async () => {
    if (editableGoals.length === 0) return toast.error('Please add at least one goal before submitting.')

    const goalIds = editableGoals.map((g) => g.id)
    const { error } = await supabase
      .from('goals')
      .update({ status: 'Pending Approval' })
      .in('id', goalIds)

    if (error) toast.error(error.message)
    else {
      toast.success('Goals sent to your manager for review!')
      fetchGoals()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Goal removed.')
      // Recompute weightages for remaining editable goals
      const remaining = editableGoals.filter(g => g.id !== id)
      if (remaining.length > 0) {
        const weightages = computeWeightages(remaining.map(g => ({ priority: g.priority })))
        for (let i = 0; i < remaining.length; i++) {
          await supabase.from('goals').update({ weightage: weightages[i] }).eq('id', remaining[i].id)
        }
      }
      fetchGoals()
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getPriorityStyle = (p: string) => PRIORITY_OPTIONS.find(o => o.value === p)?.color || 'bg-slate-100 text-slate-700 border-slate-200'
  const getStatusStyle = (s: string) => {
    if (s === 'Approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (s === 'Pending Approval') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (s === 'Returned') return 'bg-red-50 text-red-700 border-red-200'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  if (userLoading || loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 font-medium text-sm">Loading your dashboard...</p>
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
          <button onClick={() => router.push('/employee/dashboard')} className="w-full flex items-center space-x-3 bg-blue-600/20 border border-blue-500/20 px-4 py-3 rounded-xl text-sm font-semibold text-blue-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <span>My Goals</span>
          </button>
          <button onClick={() => router.push('/employee/checkin')} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
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
            <h1 className="text-lg font-bold text-slate-900">My Goals</h1>
            <p className="text-xs text-slate-400">VoltEdge Manufacturing — FY 2025</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{profile?.name || user?.email}</p>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Employee</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-5xl mx-auto space-y-8">

            {/* Status Banner for locked goals */}
            {isLocked && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div>
                  <p className="font-bold text-emerald-800">Your goals are locked in</p>
                  <p className="text-sm text-emerald-700 mt-0.5">Your goals have been approved by your manager. You can now log your quarterly progress in the Check-ins section.</p>
                </div>
              </div>
            )}

            {/* Returned Banner */}
            {editableGoals.some(g => g.status === 'Returned') && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                  <p className="font-bold text-amber-800">Your manager sent back some goals for revision</p>
                  <p className="text-sm text-amber-700 mt-0.5">Please review the returned goals below, make changes, and resubmit for approval.</p>
                </div>
              </div>
            )}

            {/* Goal Creation Form */}
            {!isLocked && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Add a New Goal</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {editableGoals.length} of 8 goals added
                    </p>
                  </div>
                  {editableGoals.length > 0 && (
                    <div className="flex items-center gap-2">
                      {['High', 'Medium', 'Low'].map(p => {
                        const count = editableGoals.filter(g => g.priority === p).length
                        if (count === 0) return null
                        return (
                          <span key={p} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getPriorityStyle(p)}`}>
                            {count} {p}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddDraft} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                    {/* Thrust Area */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Focus Area</label>
                      <select value={thrustArea} onChange={(e) => setThrustArea(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                        {THRUST_AREAS.map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Priority Level</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PRIORITY_OPTIONS.map(opt => (
                          <button key={opt.value} type="button"
                            onClick={() => setPriority(opt.value)}
                            className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                              priority === opt.value
                                ? opt.color + ' border-current scale-105 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">Weightage is calculated automatically based on priority</p>
                    </div>

                    {/* Goal Title */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Goal Title</label>
                      <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Reduce motor assembly time from 45 to 38 minutes"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">What does success look like?</label>
                      <textarea required value={description} onChange={(e) => setDescription(e.target.value)}
                        rows={2} placeholder="Briefly describe how you plan to achieve this goal..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none placeholder:text-slate-400" />
                    </div>

                    {/* UoM Type */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">How will you measure it?</label>
                      <select value={uomType} onChange={(e) => setUomType(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                        {UOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    {/* UoM Direction — hide for Zero and Timeline */}
                    {(uomType === 'Numeric' || uomType === '%') && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Is a higher or lower result better?</label>
                        <select value={uomDirection} onChange={(e) => setUomDirection(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                          {DIRECTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Target */}
                    {uomType !== 'Zero' && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          {uomType === 'Timeline' ? 'Target Completion Date' : 'Target Value'}
                        </label>
                        <input
                          type={uomType === 'Timeline' ? 'date' : 'number'}
                          required value={target} onChange={(e) => setTarget(e.target.value)}
                          placeholder={uomType === '%' ? 'e.g. 95' : 'e.g. 50000'}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-5">
                    <button type="submit"
                      disabled={editableGoals.length >= 8}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-7 py-3 text-sm transition-all shadow-sm">
                      + Add Goal
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Goals List */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Your Goals</h2>
                {!isLocked && editableGoals.length > 0 && (
                  <button onClick={handleSubmitForApproval}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 text-sm transition-all shadow-sm">
                    ✓ Send to Manager for Review
                  </button>
                )}
              </div>

              {goals.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">No goals yet</h3>
                  <p className="text-slate-500 text-sm mt-1">Start by adding your first goal above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Goal</th>
                        <th className="px-6 py-4">Focus Area</th>
                        <th className="px-6 py-4">Target</th>
                        <th className="px-6 py-4">Priority</th>
                        <th className="px-6 py-4">Weightage</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {goals.map((goal) => (
                        <tr key={goal.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900 max-w-xs leading-snug">{goal.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{goal.description?.slice(0, 60)}{goal.description?.length > 60 ? '...' : ''}</p>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{goal.thrust_area}</td>
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
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(goal.status)}`}>
                              {goal.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {(goal.status === 'Draft' || goal.status === 'Returned') && (
                              <button onClick={() => handleDelete(goal.id)}
                                className="text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                                Remove
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