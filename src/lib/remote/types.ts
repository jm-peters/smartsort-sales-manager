import type { Session, User } from '@supabase/supabase-js'

export type AuthResult = {
  user: User | null
  session: Session | null
  error: string | null
  needsEmailConfirmation?: boolean
}

export type RemoteAdapter = {
  login: (identifier: string, password: string) => Promise<AuthResult>
  checkUsernameAvailable: (username: string) => Promise<{ available: boolean; error: string | null }>
  register: (input: { email: string; password: string; username: string; shopName: string; ownerName: string; phone?: string }) => Promise<AuthResult>
  registerCashier: (email: string, password: string) => Promise<AuthResult>
  resendConfirmation: (email: string) => Promise<{ error: string | null }>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  claimCashierInvitation: () => Promise<{ error: string | null }>
  getShopContext: () => Promise<{ shopId: string; shopName: string; ownerName: string; phone: string; role: 'owner' | 'cashier'; username?: string; email?: string; onboardingStep?: string } | null>
  inviteCashier: (email: string) => Promise<{ error: string | null }>
  refresh: () => Promise<AuthResult>
  logout: () => Promise<{ error: string | null }>
  pushBatch: (rows: Array<{ table: string; op: 'upsert' | 'delete'; payload: unknown }>) => Promise<void>
  pullSince: (table: string, since: number, limit: number) => Promise<Array<unknown>>

  syncStatus: () => Promise<'online' | 'offline'>
}
