export type RemoteAdapter = {
  login: (phone: string, pin: string) => Promise<unknown>
  register: (input: { shopName: string; ownerName: string; phone: string; pin: string }) => Promise<unknown>
  refresh: () => Promise<unknown>
  pushBatch: (rows: Array<{ table: string; op: 'upsert' | 'delete'; payload: unknown }>) => Promise<void>
  pullSince: (table: string, since: number, limit: number) => Promise<Array<unknown>>

  syncStatus: () => Promise<'online' | 'offline'>
}
