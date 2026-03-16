import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] || ''
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] || ''

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Xorb] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — Supabase features disabled. Set these in your .env file.')
}

// Use a placeholder that will fail clearly rather than silently routing to a real endpoint
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')
