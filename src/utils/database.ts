import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/types'

// Server-side client (uses private env vars)
const serverUrl = import.meta.env.SUPABASE_DATABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL
const serverKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY

export const supabase = serverUrl && serverKey 
  ? createClient<Database>(serverUrl, serverKey) 
  : null

// Check if Supabase is configured
export const isConfigured = supabase !== null

// Helper to get client
export async function getClient() {
  if (!supabase) return null
  
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('active', true)
    .limit(1)
  
  return data?.[0] || null
}
