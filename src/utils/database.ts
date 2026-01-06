import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/types'

// Server-side client (uses private env vars)
const serverUrl = import.meta.env.SUPABASE_DATABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL
const serverKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY

// Service role client for accessing secrets (bypasses RLS)
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY

export const supabase = serverUrl && serverKey 
  ? createClient<Database>(serverUrl, serverKey) 
  : null

// Service role client - only for server-side secret access
export const supabaseAdmin = serverUrl && serviceRoleKey
  ? createClient<Database>(serverUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Check if Supabase is configured
export const isConfigured = supabase !== null

// In-memory cache for secrets (avoid repeated DB calls)
const secretsCache: Map<string, { value: string; fetchedAt: number }> = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch a secret from Supabase Vault
 * Uses service role key to access vault.decrypted_secrets
 * Caches results for 5 minutes
 * 
 * To add secrets: Supabase Dashboard → Settings → Vault → New Secret
 */
export async function getSecret(key: string): Promise<string | null> {
  // Check cache first
  const cached = secretsCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value
  }

  if (!supabaseAdmin) {
    console.warn(`[getSecret] Supabase admin client not configured, cannot fetch secret: ${key}`)
    return null
  }

  try {
    // Query Supabase Vault (decrypted_secrets view)
    const { data, error } = await supabaseAdmin
      .from('decrypted_secrets')
      .select('decrypted_secret')
      .eq('name', key)
      .single()

    if (error) {
      // Vault might not be enabled or secret doesn't exist
      if (error.code === 'PGRST116') {
        console.warn(`[getSecret] Secret '${key}' not found in Vault`)
      } else {
        console.error(`[getSecret] Error fetching secret ${key}:`, error.message)
      }
      return null
    }

    const value = data?.decrypted_secret
    if (!value) {
      console.warn(`[getSecret] Secret '${key}' has no value`)
      return null
    }

    // Cache the result
    secretsCache.set(key, { value, fetchedAt: Date.now() })
    
    return value
  } catch (err) {
    console.error(`[getSecret] Exception fetching secret ${key}:`, err)
    return null
  }
}

/**
 * Fetch multiple secrets at once from Supabase Vault
 */
export async function getSecrets(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {}
  
  // Check cache for each key
  const keysToFetch: string[] = []
  for (const key of keys) {
    const cached = secretsCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      result[key] = cached.value
    } else {
      keysToFetch.push(key)
    }
  }

  if (keysToFetch.length === 0) {
    return result
  }

  if (!supabaseAdmin) {
    console.warn('[getSecrets] Supabase admin client not configured')
    for (const key of keysToFetch) {
      result[key] = null
    }
    return result
  }

  try {
    // Query Supabase Vault for multiple secrets
    const { data, error } = await supabaseAdmin
      .from('decrypted_secrets')
      .select('name, decrypted_secret')
      .in('name', keysToFetch)

    if (error) {
      console.error('[getSecrets] Error fetching secrets from Vault:', error.message)
      for (const key of keysToFetch) {
        result[key] = null
      }
      return result
    }

    // Process results
    const fetchedKeys = new Set<string>()
    for (const row of data || []) {
      if (row.decrypted_secret) {
        result[row.name] = row.decrypted_secret
        secretsCache.set(row.name, { value: row.decrypted_secret, fetchedAt: Date.now() })
        fetchedKeys.add(row.name)
      } else {
        result[row.name] = null
      }
    }

    // Mark missing keys as null
    for (const key of keysToFetch) {
      if (!fetchedKeys.has(key)) {
        result[key] = null
      }
    }

    return result
  } catch (err) {
    console.error('[getSecrets] Exception:', err)
    for (const key of keysToFetch) {
      result[key] = null
    }
    return result
  }
}

/**
 * Clear the secrets cache (useful for testing or after updating secrets)
 */
export function clearSecretsCache(): void {
  secretsCache.clear()
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
