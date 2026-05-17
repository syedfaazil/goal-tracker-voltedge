'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

export type Profile = {
  role: 'employee' | 'manager' | 'admin'
  name: string | null
  manager_id: string | null
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, name, manager_id')
          .eq('id', user.id)
          .single()
        
        if (data) {
          setProfile(data as Profile)
        }
      }
      setLoading(false)
    }

    getUser()
  }, [])

  return { user, profile, loading }
}