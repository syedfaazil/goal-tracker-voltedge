'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'

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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

    if (error) setError(error.message)
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
    setError(null)
    setSuccess(null)
    const data = formData[goalId]
    const goal = goals.find((g) => g.id === goalId)
    
    if (!data.actual) return setError('Actual achievement is required.')

    const { error: insertError } = await supabase.from('goal_achievements').insert({
      goal_id: goalId,
      quarter: data.quarter,
      actual: goal?.uom_type === 'Timeline' ? null : Number(data.actual) || 0,
      status: data.status,
    })

    if (insertError) setError(insertError.message)
    else setSuccess('Achievement updated successfully!')
  }

  const getScore = (actual: string, target: string, uomType: string) => {
    if (!actual) return '-'
    if (uomType === 'Zero') return Number(actual) === 0 ? '100%' : '0%'
    if (uomType === 'Timeline') {
      const aDate = new Date(actual).getTime()
      const tDate = new Date(target).getTime()
      if (isNaN(aDate) || isNaN(tDate)) return '-'
      return aDate <= tDate ? 'On Time' : 'Late'
    }
    const a = Number(actual)
    const t = Number(target)
    if (t === 0) return '0%'
    return `${Math.round((a / t) * 100)}%`
  }

  if (userLoading || loading) return <div className="p-8 text-center">Loading check-ins...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quarterly Check-ins</h1>
            <p className="text-gray-500">Log your progress</p>
          </div>
          <button onClick={() => router.push('/employee/dashboard')} className="text-indigo-600 hover:underline">
            Back to Dashboard
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}
        {success && <div className="rounded-md bg-green-50 p-4 text-green-700">{success}</div>}

        {goals.length === 0 ? (
          <div className="rounded-lg bg-white p-6 shadow-sm text-gray-500">No approved goals found to update.</div>
        ) : (
          <div className="space-y-6">
            {goals.map(goal => {
              const form = formData[goal.id]
              return (
                <div key={goal.id} className="rounded-lg bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">{goal.title}</h2>
                      <p className="text-sm text-gray-500">Target: {goal.target} ({goal.uom_type}) | Weightage: {goal.weightage}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Progress Score</p>
                      <p className="text-xl font-bold text-indigo-600">{getScore(form.actual, goal.target, goal.uom_type)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Quarter</label>
                      <select 
                        value={form.quarter} onChange={(e) => handleFormChange(goal.id, 'quarter', e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Actual Achievement</label>
                      <input 
                        type={goal.uom_type === 'Timeline' ? 'date' : 'number'} 
                        value={form.actual} onChange={(e) => handleFormChange(goal.id, 'actual', e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select 
                        value={form.status} onChange={(e) => handleFormChange(goal.id, 'status', e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option>Not Started</option>
                        <option>On Track</option>
                        <option>Completed</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={() => handleSave(goal.id)}
                        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                      >
                        Save Progress
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}