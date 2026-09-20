import type { Session, User } from '@supabase/supabase-js'

export type AuthResult = {
  user: User | null
  session: Session | null
  error: string | null
  needsEmailConfirmation?: boolean
}

export type RemoteAdapter = {
  login: (email: string, password: string) => Promise<AuthResult>
  register: (input: { email: string; password: string; shopName: string; ownerName: string; phone: string }) => Promise<AuthResult>
  refresh: () => Promise<AuthResult>
  logout: () => Promise<{ error: string | null }>
  pushBatch: (rows: Array<{ table: string; op: 'upsert' | 'delete'; payload: unknown }>) => Promise<void>
  pullSince: (table: string, since: number, limit: number) => Promise<Array<unknown>>

  syncStatus: () => Promise<'online' | 'offline'>
}
