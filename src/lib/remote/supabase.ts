import type { RemoteAdapter } from './types'

export const supabaseRemote: RemoteAdapter = {
  async login() {
    return { status: 'stubbed' }
  },
  async register() {
    return { status: 'stubbed' }
  },
  async refresh() {
    return { status: 'stubbed' }
  },
  async pushBatch() {
    return undefined
  },
  async pullSince() {
    return []
  },
  async syncStatus() {
    return 'online'
  },
}
