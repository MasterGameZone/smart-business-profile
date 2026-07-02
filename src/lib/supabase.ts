import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase environment variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function testSupabaseConnection(): boolean {
  const isInitialized = Boolean(supabase)
  if (isInitialized) {
    console.log('Supabase client initialized successfully.')
  } else {
    console.error('Supabase client failed to initialize.')
  }
  return isInitialized
}
