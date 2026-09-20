import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AuthResult, RemoteAdapter } from './types'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

const authFailure = (error: unknown): AuthResult => ({
  user: null,
  session: null,
  error: error instanceof Error ? error.message : 'Authentication is not available.',
})

export const supabaseRemote: RemoteAdapter = {
  async login(email, password) {
    if (!supabase) return authFailure(new Error('Supabase is not configured.'))
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { user: data.user, session: data.session, error: error?.message ?? null }
  },
  async register({ email, password, shopName, ownerName, phone }) {
    if (!supabase) return authFailure(new Error('Supabase is not configured.'))
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { shopName, ownerName, phone } },
    })
    return {
      user: data.user,
      session: data.session,
      error: error?.message ?? null,
      needsEmailConfirmation: Boolean(data.user && !data.session),
    }
  },
  async refresh() {
    if (!supabase) return authFailure(new Error('Supabase is not configured.'))
    const { data, error } = await supabase.auth.getSession()
    return { user: data.session?.user ?? null, session: data.session, error: error?.message ?? null }
  },
  async logout() {
    if (!supabase) return { error: null }
    const { error } = await supabase.auth.signOut()
    return { error: error?.message ?? null }
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
