import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AuthResult, RemoteAdapter } from './types'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

const genericAuthError = 'Jina la mtumiaji/barua pepe au password si sahihi'

const authFailure = (error: unknown): AuthResult => ({
  user: null,
  session: null,
  error: error instanceof Error ? error.message : 'Authentication is not available.',
})

export const supabaseRemote: RemoteAdapter = {
  async login(identifier, password) {
    if (!supabase) return authFailure(new Error('Supabase is not configured.'))
    let email = identifier.trim()
    if (!email.includes('@')) {
      const { data, error } = await supabase.rpc('resolve_username', { p_username: email })
      if (!error && typeof data === 'string') email = data
      else email = `${email || 'invalid'}@invalid.local`
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { user: data.user, session: data.session, error: error ? genericAuthError : null }
  },
  async checkUsernameAvailable(username) {
    if (!supabase) return { available: false, error: 'Supabase is not configured.' }
    const { data, error } = await supabase.rpc('check_username_available', { p_username: username.trim().toLowerCase() })
    return { available: Boolean(data), error: error?.message ?? null }
  },
  async register({ email, password, username, shopName, ownerName, phone }) {
    if (!supabase) return authFailure(new Error('Supabase is not configured.'))
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, shopName, ownerName, phone: phone ?? '' } },
    })
    return {
      user: data.user,
      session: data.session,
      error: error?.message ?? null,
      needsEmailConfirmation: Boolean(data.user && !data.session),
    }
  },
  async registerCashier(email, password) {
    if (!supabase) return authFailure(new Error('Supabase is not configured.'))
    const { data, error } = await supabase.auth.signUp({ email, password })
    return {
      user: data.user,
      session: data.session,
      error: error?.message ?? null,
      needsEmailConfirmation: Boolean(data.user && !data.session),
    }
  },
  async resendConfirmation(email) {
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    return { error: error?.message ?? null }
  },
  async requestPasswordReset(email) {
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/?reset=1`,
    })
    return { error: error?.message ?? null }
  },
  async updatePassword(password) {
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error?.message ?? null }
  },
  async claimCashierInvitation() {
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.rpc('claim_cashier_invitation')
    return { error: error?.message ?? null }
  },
  async ensureMyShop() {
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.rpc('ensure_my_shop')
    return { error: error?.message ?? null }
  },
  async getShopContext() {
    if (!supabase) return null
    const { data, error } = await supabase.rpc('get_my_shop_context')
    if (error || !data?.[0]) return null
    const context = data[0] as { shop_id: string; shop_name: string; owner_name: string; phone: string; role: 'owner' | 'cashier'; username?: string; email?: string; onboarding_step?: string }
    return { shopId: context.shop_id, shopName: context.shop_name, ownerName: context.owner_name, phone: context.phone ?? '', role: context.role, username: context.username, email: context.email, onboardingStep: context.onboarding_step }
  },
  async inviteCashier(email) {
    if (!supabase) return { error: 'Supabase is not configured.' }
    const { error } = await supabase.rpc('invite_cashier', { cashier_email: email })
    return { error: error?.message ?? null }
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
