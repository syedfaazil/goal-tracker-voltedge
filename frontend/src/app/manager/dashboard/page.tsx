'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'

type Employee = {
  id: string
  name: string | null
}

type Goal = {
  id: string
  employee_id: string
  title: string
  description: string
  thrust_area: string
  uom_type: string
  target: number
  weightage: number
  status: string
}

export default function ManagerDashboard() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [edits, setEdits] = useState<Record<string, { target: number; weightage: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    } else if (user) {
      fetchData()
    }
  }, [user, userLoading])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    const { data: teamData, error: teamError } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('manager_id', user?.id)

    if (teamError) {
      setError(teamError.message)
      setLoading(false)
      return
    }

    setEmployees(teamData || [])

    if (teamData && teamData.length > 0) {
      const teamIds = teamData.map((emp) => emp.id)
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .in('employee_id', teamIds)
        .order('created_at', { ascending: true })

      if (goalsError) {
        setError(goalsError.message)
      } else {
        setGoals(goalsData || [])
        
        const initialEdits: Record<string, { target: number; weightage: number }> = {}
        goalsData?.forEach((g) => {
          initialEdits[g.id] = { target: g.target, weightage: g.weightage }
        })
        setEdits(initialEdits)
      }
    }
    setLoading(false)
  }

  const handleEditChange = (goalId: string, field: 'target' | 'weightage', value: string) => {
    setEdits((prev) => ({
      ...prev,
      [goalId]: {
        ...prev[goalId],
        [field]: Number(value),
      },
    }))
  }

  const handleApprove = async (employeeId: string) => {
    setError(null)
    const empGoals = goals.filter((g) => g.employee_id === employeeId && g.status === 'Pending Approval')
    
    if (empGoals.length === 0) return

    const totalWeight = empGoals.reduce((sum, g) => sum + (edits[g.id]?.weightage || g.weightage), 0)
    if (totalWeight !== 100) {
      return setError(`Cannot approve. Total weightage for this employee is ${totalWeight}%, it must be exactly 100%.`)
    }

    for (const g of empGoals) {
      const newTarget = edits[g.id]?.target ?? g.target
      const newWeightage = edits[g.id]?.weightage ?? g.weightage

      const { error: updateError } = await supabase
        .from('goals')
        .update({ status: 'Approved', target: newTarget, weightage: newWeightage })
        .eq('id', g.id)

      if (updateError) {
        setError(updateError.message)
        return
      }

      await supabase.from('audit_logs').insert({
        goal_id: g.id,
        changed_by: user?.id,
        change_description: `Manager approved goal. Target set to ${newTarget}, Weightage set to ${newWeightage}%`,
      })
    }
    
    fetchData()
  }

  const handleReturn = async (employeeId: string) => {
    setError(null)
    const empGoals = goals.filter((g) => g.employee_id === employeeId && g.status === 'Pending Approval')
    const goalIds = empGoals.map((g) => g.id)

    if (goalIds.length === 0) return

    const { error: updateError } = await supabase
      .from('goals')
      .update({ status: 'Returned' })
      .in('id', goalIds)

    if (updateError) setError(updateError.message)
    else fetchData()
  }

  if (userLoading || loading) return <div className="p-8 text-center">Loading team dashboard...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        
        <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
            <p className="text-gray-500">Welcome, {profile?.name || 'Manager'}</p>
          </div>
          <button 
            onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Sign out
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

        {employees.length === 0 ? (
          <div className="rounded-lg bg-white p-6 shadow-sm text-gray-500">No team members found.</div>
        ) : (
          employees.map((emp) => {
            const empGoals = goals.filter((g) => g.employee_id === emp.id)
            const pendingGoals = empGoals.filter((g) => g.status === 'Pending Approval')
            const hasPending = pendingGoals.length > 0

            return (
              <div key={emp.id} className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b pb-4">
                  <h2 className="text-xl font-semibold text-gray-800">{emp.name || 'Unknown Employee'}</h2>
                  {hasPending && (
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => handleReturn(emp.id)}
                        className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
                      >
                        Return for Rework
                      </button>
                      <button 
                        onClick={() => handleApprove(emp.id)}
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Approve Goals
                      </button>
                    </div>
                  )}
                </div>

                {empGoals.length === 0 ? (
                  <p className="text-sm text-gray-500">No goals submitted yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-500">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                        <tr>
                          <th className="px-4 py-3">Title</th>
                          <th className="px-4 py-3">Area</th>
                          <th className="px-4 py-3 w-32">Target</th>
                          <th className="px-4 py-3 w-32">Weightage (%)</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empGoals.map((goal) => {
                          const isPending = goal.status === 'Pending Approval'
                          return (
                            <tr key={goal.id} className="border-b bg-white">
                              <td className="px-4 py-3 font-medium text-gray-900">{goal.title}</td>
                              <td className="px-4 py-3">{goal.thrust_area} <br/><span className="text-xs text-gray-400">({goal.uom_type})</span></td>
                              <td className="px-4 py-3">
                                {isPending ? (
                                  <input 
                                    type="number" 
                                    value={edits[goal.id]?.target ?? ''}
                                    onChange={(e) => handleEditChange(goal.id, 'target', e.target.value)}
                                    className="w-full rounded border border-gray-300 p-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                ) : (
                                  goal.target
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {isPending ? (
                                  <input 
                                    type="number" 
                                    value={edits[goal.id]?.weightage ?? ''}
                                    onChange={(e) => handleEditChange(goal.id, 'weightage', e.target.value)}
                                    className="w-full rounded border border-gray-300 p-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                ) : (
                                  `${goal.weightage}%`
                                )}
                              </td>
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
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}