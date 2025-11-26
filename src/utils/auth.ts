import { createClient, type User, type Session } from '@supabase/supabase-js'
import type { Database } from '../../supabase/types'

// Server-side Supabase client
export function createServerClient(cookies: { get: (name: string) => string | undefined }) {
  const supabaseUrl = import.meta.env.SUPABASE_DATABASE_URL
  const supabaseKey = import.meta.env.SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        cookie: `sb-access-token=${cookies.get('sb-access-token') || ''}; sb-refresh-token=${cookies.get('sb-refresh-token') || ''}`
      }
    }
  })
}

// Get session from cookies
export async function getSession(cookies: { get: (name: string) => string | undefined }) {
  const accessToken = cookies.get('sb-access-token')
  const refreshToken = cookies.get('sb-refresh-token')
  
  if (!accessToken) {
    return null
  }

  const supabase = createServerClient(cookies)
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  
  if (error || !user) {
    return null
  }

  return { user, accessToken, refreshToken }
}

// Check if user is authenticated
export async function requireAuth(cookies: { get: (name: string) => string | undefined }, redirectTo: string = '/login') {
  const session = await getSession(cookies)
  
  if (!session) {
    return { redirect: redirectTo }
  }

  return { user: session.user }
}

// Browser-side Supabase client
export function createBrowserClient() {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseKey)
}

export type { User, Session }

