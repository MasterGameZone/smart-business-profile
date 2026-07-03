import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase environment variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// TEMPORARY DIAGNOSTIC LOGGING — for Version 2.2 failure investigation only.
// Does not alter any application logic.
function maskMiddle(value: string | undefined, keep = 6): string {
  if (!value) return '(empty)'
  if (value.length <= keep * 2) return `${value[0]}***${value[value.length - 1]}`
  return `${value.slice(0, keep)}...MASKED...${value.slice(-keep)}`
}
console.log('[DIAGNOSTIC] VITE_SUPABASE_URL (masked):', maskMiddle(supabaseUrl))
console.log('[DIAGNOSTIC] VITE_SUPABASE_URL length:', supabaseUrl ? supabaseUrl.length : 0)
console.log('[DIAGNOSTIC] VITE_SUPABASE_URL ends with trailing slash?:', supabaseUrl ? supabaseUrl.endsWith('/') : 'N/A')
console.log('[DIAGNOSTIC] VITE_SUPABASE_ANON_KEY loaded?:', Boolean(supabaseAnonKey))
console.log('[DIAGNOSTIC] VITE_SUPABASE_ANON_KEY length:', supabaseAnonKey ? supabaseAnonKey.length : 0)
console.log('[DIAGNOSTIC] Expected REST endpoint for business_profiles:', `${supabaseUrl}/rest/v1/business_profiles`)

export function testSupabaseConnection(): boolean {
  const isInitialized = Boolean(supabase)
  if (isInitialized) {
    console.log('Supabase client initialized successfully.')
  } else {
    console.error('Supabase client failed to initialize.')
  }
  return isInitialized
}
