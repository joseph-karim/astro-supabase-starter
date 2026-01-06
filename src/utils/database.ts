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

/**
 * Get an environment variable (works in both Astro and Node.js contexts)
 * Server-side env vars are NOT exposed to the client - they're secure.
 */
export function getEnvVar(key: string): string | null {
  // Try Astro's import.meta.env first
  const astroValue = (import.meta.env as Record<string, string | undefined>)[key]
  if (astroValue) return astroValue
  
  // Fallback to process.env for Node.js contexts
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || null
  }
  
  return null
}

/**
 * Get multiple environment variables at once
 */
export function getEnvVars(keys: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  for (const key of keys) {
    result[key] = getEnvVar(key)
  }
  return result
}

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
