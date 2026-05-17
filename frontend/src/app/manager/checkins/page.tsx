'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'

type Employee = { id: string, name: string | null }
type Goal = { id: string, employee_id: string, title: string, target: string, uom_type: string }
type Achievement = { goal_id: string, quarter: string, actual: string, status: string, updated_at: string }

export default function ManagerCheckins() {
  const { user, profile, loading: userLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [comments, setComments] = useState<Record<string, string>>({})
  const [selectedQuarter, setSelectedQuarter] = useState('Q1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
    else if (user) fetchData()
  }, [user, userLoading])

  const fetchData = async () => {
    setLoading(true)
    const { data: team } = await supabase.from('profiles').select('id, name').eq('manager_id', user?.id)
    setEmployees(team || [])

    if (team && team.length > 0) {
      const teamIds = team.map(emp => emp.id)
      const { data: goalsData } = await supabase.from('goals').select('id, employee_id, title, target, uom_type').in('employee_id', teamIds).eq('status', 'Approved')
      setGoals(goalsData || [])

      if (goalsData && goalsData.length > 0) {
        const goalIds = goalsData.map(g => g.id)
        const { data: achData } = await supabase.from('goal_achievements').select('*').in('goal_id', goalIds)
        setAchievements(achData || [])
      }
    }
    setLoading(false)
  }

  const handleSaveComment = async (goalId: string) => {
    setError(null)
    setSuccess(null)
    const commentText = comments[`${goalId}-${selectedQuarter}`]
    if (!commentText) return setError('Comment cannot be empty.')

    const { error: insertError } = await supabase.from('checkin_comments').insert({
      goal_id: goalId,
      manager_id: user?.id,
      quarter: selectedQuarter,
      comment: commentText
    })

    if (insertError) setError(insertError.message)
    else setSuccess('Comment saved successfully!')
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

  const getStatusColor = (status: string) => {
    if (status === 'Completed') return 'bg-green-100 text-green-800'
    if (status === 'On Track') return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800' // Not Started
  }

  if (userLoading || loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Check-ins</h1>
            <p className="text-gray-500">Review progress & add feedback</p>
          </div>
          <div className="flex space-x-4">
            <select 
              value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}
              className="rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500"
            >
              <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
            </select>
            <button onClick={() => router.push('/manager/dashboard')} className="text-indigo-600 hover:underline px-2 py-2">
              Back to Dashboard
            </button>
          </div>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>}
        {success && <div className="rounded-md bg-green-50 p-4 text-green-700">{success}</div>}

        {employees.length === 0 ? (
          <div className="rounded-lg bg-white p-6 shadow-sm text-gray-500">No team members found.</div>
        ) : (
          employees.map(emp => {
            const empGoals = goals.filter(g => g.employee_id === emp.id)
            if (empGoals.length === 0) return null

            return (
              <div key={emp.id} className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-gray-800 border-b pb-2">{emp.name || 'Employee'}</h2>
                <div className="space-y-6">
                  {empGoals.map(goal => {
                    const ach = achievements.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).find(a => a.goal_id === goal.id && a.quarter === selectedQuarter)
                    
                    return (
                      <div key={goal.id} className="rounded border p-4 bg-gray-50">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 items-center">
                          <div className="col-span-2">
                            <p className="font-medium text-gray-900">{goal.title}</p>
                            <p className="text-sm text-gray-500">Planned: {goal.target} {goal.uom_type}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">Actual ({selectedQuarter})</p>
                            <p className="text-lg">{ach?.actual || '-'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">Score & Status</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="font-bold text-indigo-600">{getScore(ach?.actual || '', goal.target, goal.uom_type)}</span>
                              {ach && (
                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(ach.status)}`}>
                                  {ach.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex space-x-3">
                          <input 
                            type="text"
                            placeholder="Add structured check-in comment..."
                            value={comments[`${goal.id}-${selectedQuarter}`] || ''}
                            onChange={(e) => setComments(prev => ({ ...prev, [`${goal.id}-${selectedQuarter}`]: e.target.value }))}
                            className="flex-1 rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 text-sm"
                          />
                          <button 
                            onClick={() => handleSaveComment(goal.id)}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                          >
                            Save Comment
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}