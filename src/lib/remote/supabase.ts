import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RemoteAdapter } from './types'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const supabaseRemote: RemoteAdapter = {
  async login() {
    if (!supabase) return { status: 'not-configured' }
    return { status: 'ready' }
  },
  async register() {
    if (!supabase) return { status: 'not-configured' }
    return { status: 'ready' }
  },
  async refresh() {
    if (!supabase) return { status: 'not-configured' }
    const { data, error } = await supabase.auth.getSession()
    return { session: data.session, error: error?.message ?? null }
  },
  async pushBatch() {
    if (!supabase) return
    return undefined
  },
  async pullSince() {
    if (!supabase) return []
    return []
  },
  async syncStatus() {
    if (!supabase) return 'offline'
    const { error } = await supabase.auth.getSession()
    return error ? 'offline' : 'online'
  },
}
