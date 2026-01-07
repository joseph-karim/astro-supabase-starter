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
 * Known API keys - must be listed explicitly because Vite statically replaces import.meta.env
 * Dynamic access like import.meta.env[key] doesn't work
 */
const ENV_VARS: Record<string, string | undefined> = {
  ANTHROPIC_API_KEY: import.meta.env.ANTHROPIC_API_KEY,
  EXA_API_KEY: import.meta.env.EXA_API_KEY,
  PERPLEXITY_API_KEY: import.meta.env.PERPLEXITY_API_KEY,
  OPENAI_API_KEY: import.meta.env.OPENAI_API_KEY,
  FOLK_API_KEY: import.meta.env.FOLK_API_KEY,
  CONTEXTUAL_AI_API_KEY: import.meta.env.CONTEXTUAL_AI_API_KEY,
}

/**
 * Get an environment variable
 */
export function getEnvVar(key: string): string | null {
  return ENV_VARS[key] || null
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
