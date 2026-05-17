'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'

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
  const [error, setError] = useState<string | null>(null)

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
    } else if (user) {
      fetchGoals()
    }
  }, [user, userLoading])

  const fetchGoals = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('employee_id', user?.id)
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setGoals(data || [])
    setLoading(false)
  }

  const editableGoals = goals.filter((g) => g.status === 'Draft' || g.status === 'Returned')
  const lockedGoals = goals.filter((g) => g.status === 'Pending Approval' || g.status === 'Approved')
  const currentTotalWeightage = editableGoals.reduce((sum, g) => sum + Number(g.weightage), 0)
  const isLocked = lockedGoals.length > 0 && editableGoals.length === 0

  const handleAddDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const weightNum = Number(weightage)
    if (weightNum < 10) return setError('Minimum weightage per goal is 10%.')
    if (currentTotalWeightage + weightNum > 100) return setError(`Adding this exceeds 100%. You can only add up to ${100 - currentTotalWeightage}%.`)
    if (editableGoals.length >= 8) return setError('Maximum 8 goals allowed.')

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
      setError(insertError.message)
    } else {
      // Reset form
      setTitle('')
      setDescription('')
      setTarget('')
      setWeightage('')
      fetchGoals()
    }
  }

  const handleSubmitForApproval = async () => {
    setError(null)
    if (currentTotalWeightage !== 100) {
      return setError(`Total weightage must be exactly 100%. Current total is ${currentTotalWeightage}%.`)
    }

    const goalIds = editableGoals.map((g) => g.id)
    
    const { error: updateError } = await supabase
      .from('goals')
      .update({ status: 'Pending Approval' })
      .in('id', goalIds)

    if (updateError) {
      setError(updateError.message)
    } else {
      fetchGoals()
    }
  }

  const handleDelete = async (id: string) => {
    const { error: deleteError } = await supabase.from('goals').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else fetchGoals()
  }

  if (userLoading || loading) return <div className="p-8 text-center">Loading dashboard...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Dashboard</h1>
            <p className="text-gray-500">Welcome, {profile?.name || user?.email}</p>
          </div>
          <button 
            onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Sign out
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

        {/* Goal Creation Form */}
        {!isLocked && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">Add New Goal</h2>
            <form onSubmit={handleAddDraft} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Thrust Area</label>
                  <select 
                    value={thrustArea} onChange={(e) => setThrustArea(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option>Operations</option>
                    <option>Sales & Marketing</option>
                    <option>Finance</option>
                    <option>Learning & Growth</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Goal Title</label>
                  <input 
                    type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea 
                    required value={description} onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Unit of Measurement</label>
                  <select 
                    value={uomType} onChange={(e) => setUomType(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="Numeric">Numeric</option>
                    <option value="%">%</option>
                    <option value="Timeline">Timeline</option>
                    <option value="Zero">Zero</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Target Value (Number)</label>
                  <input 
                    type="number" required value={target} onChange={(e) => setTarget(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Weightage (%) - Min 10%</label>
                  <input 
                    type="number" min="10" max="100" required value={weightage} onChange={(e) => setWeightage(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm font-medium text-gray-700">
                  Running Total: <span className={currentTotalWeightage > 100 ? 'text-red-600' : 'text-indigo-600'}>{currentTotalWeightage}%</span> / 100%
                  <span className="ml-2 text-gray-500">({editableGoals.length}/8 Goals Added)</span>
                </div>
                <button 
                  type="submit" 
                  disabled={currentTotalWeightage >= 100 || editableGoals.length >= 8}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  Add Goal to Draft
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Goals List */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Your Goals</h2>
            {!isLocked && editableGoals.length > 0 && (
              <button 
                onClick={handleSubmitForApproval}
                className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                Submit All for Approval
              </button>
            )}
          </div>

          {goals.length === 0 ? (
            <p className="text-gray-500">No goals added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500">
                <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Area</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Weightage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map((goal) => (
                    <tr key={goal.id} className="border-b bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{goal.title}</td>
                      <td className="px-4 py-3">{goal.thrust_area}</td>
                      <td className="px-4 py-3">{goal.target} {goal.uom_type}</td>
                      <td className="px-4 py-3">{goal.weightage}%</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          goal.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          goal.status === 'Pending Approval' ? 'bg-yellow-100 text-yellow-800' :
                          goal.status === 'Returned' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {goal.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(goal.status === 'Draft' || goal.status === 'Returned') && (
                          <button onClick={() => handleDelete(goal.id)} className="text-red-600 hover:underline">
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
    </div>
  )
}