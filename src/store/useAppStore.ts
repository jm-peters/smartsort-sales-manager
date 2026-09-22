import { create } from 'zustand'
import { localDb, type CashSession as LocalCashSession } from '../lib/db/local'
import { supabaseRemote } from '../lib/remote/supabase'
import { buildReceiptText } from '../lib/receipt'
import type { AppSyncStatus, CartItem, CashSession, DebtRecord, ExpenseCategory, HeldCart, ProductRecord, ReportSummary, ShopProfile, SignupInput, UserSession } from '../types/app'
import { defaultLocale, type Locale } from '../lib/i18n'
import type { User } from '@supabase/supabase-js'

const today = () => new Date().toISOString().slice(0, 10)

async function reportForDate(date: string): Promise<ReportSummary> {
  const start = new Date(`${date}T00:00:00`).toISOString()
  const endDate = new Date(`${date}T00:00:00`)
  endDate.setDate(endDate.getDate() + 1)
  const end = endDate.toISOString()
  const [sales, expenses] = await Promise.all([
    localDb.sales.where('created_at').between(start, end, true, false).toArray(),
    localDb.expenses.where('created_at').between(start, end, true, false).toArray(),
  ])
  const salesSummary = sales.reduce<ReportSummary>((summary, sale) => ({
    sales: summary.sales + (sale.status === 'completed' ? sale.total : 0),
    profit: summary.profit + (sale.status === 'completed' ? sale.total_profit : 0),
    transactions: summary.transactions + (sale.status === 'completed' ? 1 : 0),
    expenses: 0,
    net: summary.net + (sale.status === 'completed' ? sale.total_profit : 0),
  }), { sales: 0, profit: 0, transactions: 0, expenses: 0, net: 0 })
  const expenseTotal = expenses.reduce((total, expense) => total + (expense.is_cash_drop ? 0 : expense.amount), 0)
  return { ...salesSummary, expenses: expenseTotal, net: salesSummary.profit - expenseTotal }
}

const initialDebts: DebtRecord[] = [
  { id: 'd1', customer: 'Amina', phone: '+254712000001', amount: 850, paid: 200, items: [], dueDate: '2026-09-25', status: 'partial' },
  { id: 'd2', customer: 'Kibaki', phone: '+254712000002', amount: 1200, paid: 0, items: [], dueDate: '2026-09-18', status: 'open' },
  { id: 'd3', customer: 'Salim', phone: '+254712000003', amount: 350, paid: 350, items: [], dueDate: '2026-09-10', status: 'paid' },
]

const deviceId = 'demo-device'
const credentialError = 'Jina la mtumiaji/barua pepe au password si sahihi'

async function derivePinHash(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 600_000, hash: 'SHA-256' }, key, 256)
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function sessionFromUser(user: User, role: UserSession['role'] = 'owner'): UserSession {
  const metadata = user.user_metadata as Record<string, unknown>
  return {
    id: user.id,
    name: typeof metadata.ownerName === 'string' ? metadata.ownerName : user.email ?? 'Owner',
    phone: typeof metadata.phone === 'string' ? metadata.phone : '',
    email: user.email,
    role,
  }
}

async function expectedCashForSession(session: LocalCashSession): Promise<number> {
  const dayStart = session.opened_at.slice(0, 10)
  const [sales, expenses] = await Promise.all([
    localDb.sales.where('created_at').aboveOrEqual(dayStart).toArray(),
    localDb.expenses.where('created_at').aboveOrEqual(dayStart).toArray(),
  ])
  const cashSales = sales.reduce((total, sale) => total + (sale.status === 'completed' && sale.payment_method === 'cash' ? sale.total : 0), 0)
  const cashExpenses = expenses.reduce((total, expense) => total + (expense.payment_method === 'cash' ? expense.amount : 0), 0)
  return session.opening_float + cashSales - cashExpenses
}

function productsFromState(products: ProductRecord[], counts: Map<string, { count: number; last: string }>): ProductRecord[] {
  const totalSales = Array.from(counts.values()).reduce((total, value) => total + value.count, 0)
  if (totalSales < 20) return []

  return products
    .filter((product) => counts.has(product.id))
    .sort((left, right) => (counts.get(right.id)?.count ?? 0) - (counts.get(left.id)?.count ?? 0))
    .slice(0, 8)
}

interface AppState {
  products: ProductRecord[]
  cart: CartItem[]
  debts: DebtRecord[]
  activeTab: 'sell' | 'stock' | 'deni' | 'reports'
  locale: Locale
  session: UserSession | null
  syncStatus: AppSyncStatus
  lastSyncedAt: string | null
  pendingSyncCount: number
  authError: string | null
  authBusy: boolean
  localUnlockRequired: boolean
  devicePinConfigured: boolean
  lastSaleMessage: string | null
  shopProfile: ShopProfile | null
  lowStockThreshold: number
  isHydrated: boolean
  reportSummary: ReportSummary
  reportDate: string
  quickSellProducts: ProductRecord[]
  cashSession: CashSession | null
  expectedCash: number
  creditLimits: Record<string, number | null>
  debtMessage: string | null
  lastSaleReceipt: string | null
  heldCarts: HeldCart[]
  addToCart: (product: ProductRecord) => void
  incrementCartItem: (productId: string) => void
  decrementCartItem: (productId: string) => void
  removeCartItem: (productId: string) => void
  clearCart: () => void
  completeSale: () => Promise<boolean>
  addProduct: (product: Omit<ProductRecord, 'id'>) => void
  receiveStock: (productId: string, quantity: number) => Promise<void>
  addExpense: (title: string, amount: number, category: ExpenseCategory, paymentMethod: 'cash' | 'mpesa') => Promise<void>
  closeCashSession: (countedCash: number, note: string) => Promise<boolean>
  parkCart: (label?: string) => Promise<boolean>
  resumeHeldCart: (id: string) => Promise<boolean>
  deleteHeldCart: (id: string) => Promise<void>
  addDebt: (customer: string, phone: string, items: DebtRecord['items'], creditLimit?: number | null) => Promise<boolean>
  payDebt: (debtId: string, amount: number, method: 'cash' | 'mpesa') => Promise<boolean>
  setActiveTab: (tab: AppState['activeTab']) => void
  setReportDate: (date: string) => Promise<void>
  setLocale: (locale: Locale) => void
  signIn: (identifier: string, password: string) => Promise<boolean>
  registerCashier: (email: string, password: string) => Promise<boolean>
  resendConfirmation: (email: string) => Promise<boolean>
  requestPasswordReset: (email: string) => Promise<boolean>
  updatePassword: (password: string) => Promise<boolean>
  inviteCashier: (email: string) => Promise<boolean>
  logout: () => Promise<void>
  completeOnboarding: (input: SignupInput) => Promise<boolean>
  setDevicePin: (pin: string) => Promise<boolean>
  unlockWithPin: (pin: string) => Promise<boolean>
  updateShopProfile: (profile: ShopProfile) => Promise<void>
  setLowStockThreshold: (threshold: number) => Promise<void>
  syncNow: () => Promise<void>
  hydrateLocalState: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  products: [],
  cart: [],
  debts: initialDebts,
  activeTab: 'sell',
  locale: defaultLocale,
  session: null,
  syncStatus: 'online',
  lastSyncedAt: null,
  pendingSyncCount: 0,
  authError: null,
  authBusy: false,
  localUnlockRequired: false,
  devicePinConfigured: false,
  lastSaleMessage: null,
  shopProfile: null,
  lowStockThreshold: 5,
  isHydrated: false,
  reportSummary: { sales: 0, profit: 0, transactions: 0, expenses: 0, net: 0 },
  reportDate: today(),
  quickSellProducts: [],
  cashSession: null,
  expectedCash: 0,
  creditLimits: {},
  debtMessage: null,
  lastSaleReceipt: null,
  heldCarts: [],
  addToCart: (product) =>
    set((state) => {
      const existing = state.cart.find((item) => item.productId === product.id)
      const requestedQty = (existing?.qty ?? 0) + 1
      if (product.stock <= 0 || requestedQty > product.stock) {
        return { lastSaleMessage: 'Not enough stock available' }
      }

      if (existing) {
        return {
          cart: state.cart.map((item) =>
            item.productId === product.id
              ? { ...item, qty: item.qty + 1 }
              : item,
          ),
        }
      }

      return {
        cart: [
          ...state.cart,
          {
            productId: product.id,
            name: product.name,
            qty: 1,
            unitPrice: product.selling_price,
            unitCost: product.buying_price,
            costUnknown: product.buying_price === 0,
          },
        ],
      }
    }),
  incrementCartItem: (productId) =>
    set((state) => {
      const product = state.products.find((item) => item.id === productId)
      const item = state.cart.find((cartItem) => cartItem.productId === productId)
      if (!product || !item || item.qty >= product.stock) {
        return { lastSaleMessage: 'Not enough stock available' }
      }

      return {
        cart: state.cart.map((cartItem) =>
          cartItem.productId === productId ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem,
        ),
        lastSaleMessage: null,
      }
    }),
  decrementCartItem: (productId) =>
    set((state) => ({
      cart: state.cart
        .map((item) =>
          item.productId === productId ? { ...item, qty: item.qty - 1 } : item,
        )
        .filter((item) => item.qty > 0),
    })),
  removeCartItem: (productId) =>
    set((state) => ({
      cart: state.cart.filter((item) => item.productId !== productId),
    })),
  clearCart: () => set({ cart: [], lastSaleMessage: null }),
  completeSale: async () => {
    let state = useAppStore.getState()
    if (state.cart.length === 0) {
      set({ lastSaleMessage: 'Add an item before checkout' })
      return false
    }

    let activeCashSession = await localDb.cashSessions.where('status').equals('open').first()
    if (!activeCashSession) {
      activeCashSession = {
        id: crypto.randomUUID(),
        shop_id: 'demo-shop',
        shop_user_id: state.session?.id ?? 'demo-user',
        device_id: deviceId,
        label: 'New session',
        opened_at: new Date().toISOString(),
        opening_float: 0,
        status: 'open',
      }
      await localDb.cashSessions.put(activeCashSession)
      set({ cashSession: { id: activeCashSession.id, label: activeCashSession.label, openedAt: activeCashSession.opened_at, openingFloat: 0, expectedCash: 0, status: 'open' } })
      state = useAppStore.getState()
    }

    const now = new Date().toISOString()
    const saleId = crypto.randomUUID()
    const saleNo = Number(await localDb.meta.get('next_sale_no').then((entry) => entry?.value ?? 1))
    const total = state.cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
    const totalProfit = state.cart.reduce((sum, item) => sum + (item.unitPrice - item.unitCost) * item.qty, 0)
    const saleItems = state.cart.map((item) => ({
      id: crypto.randomUUID(),
      sale_id: saleId,
      shop_id: 'demo-shop',
      product_id: item.productId,
      product_name: item.name,
      qty: item.qty,
      unit_price: item.unitPrice,
      unit_cost: item.unitCost,
      cost_unknown: item.costUnknown,
      line_total: item.unitPrice * item.qty,
      line_profit: (item.unitPrice - item.unitCost) * item.qty,
    }))
    const sale = {
      id: saleId,
      shop_id: 'demo-shop',
      sale_no: saleNo,
      total,
      total_profit: totalProfit,
      item_count: state.cart.reduce((sum, item) => sum + item.qty, 0),
      payment_method: 'cash' as const,
      status: 'completed' as const,
      created_at: now,
      updated_at: now,
      device_id: 'demo-device',
      created_by: state.session?.id ?? null,
      cash_session_id: activeCashSession.id,
    }
    const movements = state.cart.map((item) => ({
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      product_id: item.productId,
      delta: -item.qty,
      reason: 'sale' as const,
      ref_type: 'sale',
      ref_id: saleId,
      unit_cost: item.unitCost,
      created_at: now,
      device_id: 'demo-device',
      created_by: state.session?.id ?? null,
    }))

    await localDb.transaction('rw', [localDb.sales, localDb.saleItems, localDb.stockMovements, localDb.outbox, localDb.meta], async () => {
      await localDb.sales.put(sale)
      await localDb.saleItems.bulkPut(saleItems)
      await localDb.stockMovements.bulkPut(movements)
      await localDb.outbox.bulkPut([
        { id: saleId, table: 'sales', op: 'upsert', payload: sale, attempts: 0, next_attempt_at: Date.now() },
        ...saleItems.map((item) => ({ id: item.id, table: 'saleItems', op: 'upsert' as const, payload: item, attempts: 0, next_attempt_at: Date.now() })),
        ...movements.map((movement) => ({ id: movement.id, table: 'stockMovements', op: 'upsert' as const, payload: movement, attempts: 0, next_attempt_at: Date.now() })),
      ])
      await localDb.meta.put({ key: 'next_sale_no', value: saleNo + 1 })
    })

    set((current) => ({
      products: current.products.map((product) => {
        const sold = current.cart.find((item) => item.productId === product.id)?.qty ?? 0
        return sold > 0 ? { ...product, stock: product.stock - sold } : product
      }),
      cart: [],
      pendingSyncCount: current.pendingSyncCount + 1 + saleItems.length + movements.length,
      lastSaleMessage: `Sale #${saleNo} completed`,
      lastSaleReceipt: buildReceiptText(current.shopProfile?.shopName ?? 'SmartSort Sales Manager', saleNo, current.cart, total, 'cash'),
      reportSummary: {
        sales: current.reportSummary.sales + total,
        profit: current.reportSummary.profit + totalProfit,
        transactions: current.reportSummary.transactions + 1,
        expenses: current.reportSummary.expenses,
        net: current.reportSummary.net + totalProfit,
      },
      expectedCash: current.expectedCash + total,
    }))
    return true
  },
  addProduct: (product) => {
    const id = `p${Date.now()}`
    const now = new Date().toISOString()
    const nextProduct = {
      id,
      ...product,
      stock: product.stock ?? 0,
    }
    const localProduct = {
      ...nextProduct,
      shop_id: 'demo-shop',
      search_key: nextProduct.name.toLocaleLowerCase(),
      is_active: true,
      created_at: now,
      updated_at: now,
      device_id: 'demo-device',
    }

    set((state) => ({ products: [...state.products, nextProduct] }))
    void localDb.products.put(localProduct)
    void localDb.outbox.put({
      id,
      table: 'products',
      op: 'upsert',
      payload: localProduct,
      attempts: 0,
      next_attempt_at: Date.now(),
    })
  },
  receiveStock: async (productId, quantity) => {
    if (!Number.isInteger(quantity) || quantity <= 0) return

    const product = useAppStore.getState().products.find((item) => item.id === productId)
    if (!product) return

    const now = new Date().toISOString()
    const movement = {
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      product_id: productId,
      delta: quantity,
      reason: 'purchase' as const,
      ref_type: 'stock_receipt',
      ref_id: null,
      unit_cost: product.buying_price,
      created_at: now,
      device_id: 'demo-device',
    }
    const updatedProduct = {
      ...product,
      stock: product.stock + quantity,
      updated_at: now,
    }
    const localProduct = {
      ...updatedProduct,
      shop_id: 'demo-shop',
      search_key: updatedProduct.name.toLocaleLowerCase(),
      is_active: true,
      created_at: now,
      device_id: 'demo-device',
    }

    await localDb.transaction('rw', [localDb.products, localDb.stockMovements, localDb.outbox], async () => {
      await localDb.products.put(localProduct)
      await localDb.stockMovements.put(movement)
      await localDb.outbox.bulkPut([
        { id: updatedProduct.id, table: 'products', op: 'upsert' as const, payload: localProduct, attempts: 0, next_attempt_at: Date.now() },
        { id: movement.id, table: 'stockMovements', op: 'upsert' as const, payload: movement, attempts: 0, next_attempt_at: Date.now() },
      ])
    })

    set((state) => ({
      products: state.products.map((item) => item.id === productId ? updatedProduct : item),
      pendingSyncCount: state.pendingSyncCount + 2,
    }))
  },
  addExpense: async (title, amount, category, paymentMethod) => {
    if (!title.trim() || !Number.isInteger(amount) || amount <= 0) return

    const now = new Date().toISOString()
    const expense = {
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      title: title.trim(),
      amount,
      category,
      payment_method: paymentMethod,
      is_cash_drop: category === 'cash_drop',
      created_at: now,
      updated_at: now,
      created_by: useAppStore.getState().session?.id ?? null,
    }

    await localDb.transaction('rw', [localDb.expenses, localDb.outbox], async () => {
      await localDb.expenses.put(expense)
      await localDb.outbox.put({ id: expense.id, table: 'expenses', op: 'upsert', payload: expense, attempts: 0, next_attempt_at: Date.now() })
    })

    set((state) => ({
      pendingSyncCount: state.pendingSyncCount + 1,
      reportSummary: category === 'cash_drop'
        ? state.reportSummary
        : {
            ...state.reportSummary,
            expenses: state.reportSummary.expenses + amount,
            net: state.reportSummary.net - amount,
          },
    }))
  },
  closeCashSession: async (countedCash, note) => {
    const state = useAppStore.getState()
    const session = await localDb.cashSessions.where('status').equals('open').first()
    if (!session || !Number.isInteger(countedCash) || countedCash < 0) return false

    const expectedCash = await expectedCashForSession(session)
    const now = new Date().toISOString()
    const closedSession = {
      ...session,
      closed_at: now,
      closed_by: state.session?.id ?? null,
      expected_cash: expectedCash,
      counted_cash: countedCash,
      cash_variance: countedCash - expectedCash,
      total_sales: state.reportSummary.sales,
      total_profit: state.reportSummary.profit,
      total_expenses: state.reportSummary.expenses,
      transaction_count: state.reportSummary.transactions,
      note: note.trim() || null,
      status: 'closed' as const,
    }

    await localDb.transaction('rw', [localDb.cashSessions, localDb.outbox], async () => {
      await localDb.cashSessions.put(closedSession)
      await localDb.outbox.put({ id: closedSession.id, table: 'cashSessions', op: 'upsert', payload: closedSession, attempts: 0, next_attempt_at: Date.now() })
    })

    set({ cashSession: { id: session.id, label: session.label, openedAt: session.opened_at, openingFloat: session.opening_float, expectedCash, status: 'closed', countedCash, variance: countedCash - expectedCash }, expectedCash, pendingSyncCount: state.pendingSyncCount + 1 })
    return true
  },
  parkCart: async (label) => {
    const state = useAppStore.getState()
    if (state.cart.length === 0 || state.heldCarts.length >= 5) return false
    const heldCart = {
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      device_id: deviceId,
      shop_user_id: state.session?.id ?? 'demo-user',
      label: label?.trim() || `Customer ${state.heldCarts.length + 1}`,
      items: state.cart,
      total: state.cart.reduce((total, item) => total + item.qty * item.unitPrice, 0),
      created_at: new Date().toISOString(),
    }
    await localDb.heldCarts.put(heldCart)
    set((current) => ({
      heldCarts: [...current.heldCarts, { id: heldCart.id, label: heldCart.label, items: state.cart, total: heldCart.total, createdAt: heldCart.created_at }],
      cart: [],
    }))
    return true
  },
  resumeHeldCart: async (id) => {
    const state = useAppStore.getState()
    if (state.cart.length > 0) return false
    const heldCart = state.heldCarts.find((item) => item.id === id)
    if (!heldCart) return false
    await localDb.heldCarts.delete(id)
    set((current) => ({
      cart: heldCart.items,
      heldCarts: current.heldCarts.filter((item) => item.id !== id),
    }))
    return true
  },
  deleteHeldCart: async (id) => {
    await localDb.heldCarts.delete(id)
    set((state) => ({ heldCarts: state.heldCarts.filter((item) => item.id !== id) }))
  },
  addDebt: async (customer, phone, items, creditLimit) => {
    const currentState = useAppStore.getState()
    const outstanding = currentState.debts
      .filter((debt) => debt.phone === phone && debt.status !== 'paid')
      .reduce((total, debt) => total + Math.max(debt.amount - debt.paid, 0), 0)
    const configuredLimit = creditLimit === undefined ? currentState.creditLimits[phone] ?? null : creditLimit
    const amount = items.reduce((total, item) => total + item.qty * item.unitPrice, 0)
    if (configuredLimit !== null && outstanding + amount > configuredLimit) {
      set({ debtMessage: `Credit limit exceeded: KES ${configuredLimit.toLocaleString('en-KE')}` })
      return false
    }
    const hasEnoughStock = items.every((item) => {
      const product = currentState.products.find((candidate) => candidate.id === item.productId)
      return product && item.qty > 0 && item.qty <= product.stock
    })
    if (!hasEnoughStock) return false

    const id = `d${Date.now()}`
    const now = new Date().toISOString()
    const debt = {
      id,
      customer,
      phone,
      amount,
      paid: 0,
      items,
      dueDate: new Date().toISOString().slice(0, 10),
      status: 'open' as const,
    }
    const remoteDebt = {
      id,
      shop_id: 'demo-shop',
      customer_id: id,
      customer_name: customer,
      customer_phone: phone,
      principal: amount,
      amount_paid: 0,
      status: 'open' as const,
      due_date: debt.dueDate,
      created_at: now,
      updated_at: now,
      device_id: 'demo-device',
    }
    const movements = items.map((item) => ({
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      product_id: item.productId,
      delta: -item.qty,
      reason: 'sale' as const,
      ref_type: 'debt',
      ref_id: id,
      unit_cost: currentState.products.find((product) => product.id === item.productId)?.buying_price ?? 0,
      created_at: now,
      device_id: 'demo-device',
      created_by: currentState.session?.id ?? null,
    }))

    await localDb.transaction('rw', [localDb.debts, localDb.products, localDb.stockMovements, localDb.outbox], async () => {
      await localDb.debts.put(remoteDebt)
      await localDb.products.bulkPut(currentState.products.map((product) => {
        const taken = items.find((item) => item.productId === product.id)?.qty ?? 0
        return {
          ...product,
          shop_id: 'demo-shop',
          search_key: product.name.toLocaleLowerCase(),
          is_active: true,
          created_at: now,
          updated_at: now,
          device_id: 'demo-device',
          stock: product.stock - taken,
        }
      }))
      await localDb.stockMovements.bulkPut(movements)
      await localDb.outbox.bulkPut([
        { id, table: 'debts', op: 'upsert' as const, payload: { ...remoteDebt, items }, attempts: 0, next_attempt_at: Date.now() },
        ...movements.map((movement) => ({ id: movement.id, table: 'stockMovements', op: 'upsert' as const, payload: movement, attempts: 0, next_attempt_at: Date.now() })),
      ])
    })

    set((state) => ({
      debts: [debt, ...state.debts],
      products: state.products.map((product) => {
        const taken = items.find((item) => item.productId === product.id)?.qty ?? 0
        return taken > 0 ? { ...product, stock: product.stock - taken } : product
      }),
      pendingSyncCount: state.pendingSyncCount + 1 + movements.length,
      debtMessage: null,
      creditLimits: creditLimit === undefined ? state.creditLimits : { ...state.creditLimits, [phone]: creditLimit },
    }))
    if (creditLimit !== undefined) {
      await localDb.meta.put({ key: 'credit_limits', value: { ...currentState.creditLimits, [phone]: creditLimit } })
    }
    return true
  },
  payDebt: async (debtId, amount, method) => {
    const state = useAppStore.getState()
    const debt = state.debts.find((item) => item.id === debtId)
    if (!debt || !Number.isInteger(amount) || amount <= 0) return false
    const outstanding = Math.max(debt.amount - debt.paid, 0)
    if (outstanding === 0 || amount > outstanding) return false

    const now = new Date().toISOString()
    const payment = {
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      debt_id: debtId,
      amount,
      method,
      created_at: now,
      created_by: state.session?.id ?? null,
      device_id: deviceId,
    }
    const paid = debt.paid + amount
    const status = paid >= debt.amount ? 'paid' as const : 'partial' as const
    const remoteDebt = {
      id: debt.id,
      shop_id: 'demo-shop',
      customer_id: debt.id,
      customer_name: debt.customer,
      customer_phone: debt.phone,
      principal: debt.amount,
      amount_paid: paid,
      status,
      due_date: debt.dueDate,
      created_at: now,
      updated_at: now,
      device_id: deviceId,
    }

    await localDb.transaction('rw', [localDb.debtPayments, localDb.debts, localDb.outbox], async () => {
      await localDb.debtPayments.put(payment)
      await localDb.debts.put(remoteDebt)
      await localDb.outbox.bulkPut([
        { id: payment.id, table: 'debtPayments', op: 'upsert' as const, payload: payment, attempts: 0, next_attempt_at: Date.now() },
        { id: debt.id, table: 'debts', op: 'upsert' as const, payload: remoteDebt, attempts: 0, next_attempt_at: Date.now() },
      ])
    })

    set((current) => ({
      debts: current.debts.map((item) => item.id === debtId ? { ...item, paid, status } : item),
      pendingSyncCount: current.pendingSyncCount + 2,
    }))
    return true
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setReportDate: async (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    set({ reportDate: date, reportSummary: await reportForDate(date) })
  },
  setLocale: (locale) => set({ locale }),
  signIn: async (identifier, password) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ authError: 'Unahitaji intaneti kwa mara ya kwanza kwenye simu hii.' })
      return false
    }
    set({ authBusy: true, authError: null })
    const result = await supabaseRemote.login(identifier, password)
    if (result.error || !result.user) {
      set({ authBusy: false, authError: result.error ?? credentialError })
      return false
    }
    const claim = await supabaseRemote.claimCashierInvitation()
    if (claim.error) {
      set({ authBusy: false, authError: claim.error, session: null })
      return false
    }
    const provisioning = await supabaseRemote.ensureMyShop()
    if (provisioning.error) {
      set({ authBusy: false, authError: provisioning.error, session: null })
      return false
    }
    const context = await supabaseRemote.getShopContext()
    if (!context) {
      set({ authBusy: false, authError: 'Your account is not linked to a shop yet.', session: null })
      return false
    }
    const profile = { shopName: context.shopName, ownerName: context.ownerName, phone: context.phone, pin: '' }
    await localDb.meta.put({ key: 'shop_profile', value: profile })
    const session = sessionFromUser(result.user, context.role)
    await localDb.meta.put({ key: 'local_session', value: session })
    set({ authBusy: false, authError: null, session, shopProfile: profile, localUnlockRequired: false })
    return true
  },
  registerCashier: async (email, password) => {
    set({ authBusy: true, authError: null })
    const result = await supabaseRemote.registerCashier(email, password)
    if (result.error) {
      set({ authBusy: false, authError: result.error })
      return false
    }
    if (!result.user || !result.session) {
      set({ authBusy: false, authError: 'Account created. Check your email to confirm your account, then sign in.' })
      return false
    }
    const claim = await supabaseRemote.claimCashierInvitation()
    const context = await supabaseRemote.getShopContext()
    if (claim.error || !context) {
      await supabaseRemote.logout()
      set({ authBusy: false, authError: claim.error ?? 'No active cashier invitation was found.' })
      return false
    }
    const profile = { shopName: context.shopName, ownerName: context.ownerName, phone: context.phone, pin: '' }
    await localDb.meta.put({ key: 'shop_profile', value: profile })
    set({ authBusy: false, authError: null, session: sessionFromUser(result.user, 'cashier'), shopProfile: profile })
    return true
  },
  resendConfirmation: async (email) => {
    set({ authBusy: true, authError: null })
    const result = await supabaseRemote.resendConfirmation(email)
    set({ authBusy: false, authError: result.error ?? 'Confirmation email sent.' })
    return !result.error
  },
  requestPasswordReset: async (email) => {
    set({ authBusy: true, authError: null })
    const result = await supabaseRemote.requestPasswordReset(email)
    set({ authBusy: false, authError: result.error ?? 'Password reset email sent.' })
    return !result.error
  },
  updatePassword: async (password) => {
    if (password.length < 8) {
      set({ authError: 'Password lazima iwe na angalau herufi 8.' })
      return false
    }
    set({ authBusy: true, authError: null })
    const result = await supabaseRemote.updatePassword(password)
    set({ authBusy: false, authError: result.error ?? null })
    return !result.error
  },
  inviteCashier: async (email) => {
    set({ authBusy: true, authError: null })
    const result = await supabaseRemote.inviteCashier(email)
    set({ authBusy: false, authError: result.error })
    return !result.error
  },
  logout: async () => {
    const result = await supabaseRemote.logout()
    set({ session: null, authError: result.error })
  },
  completeOnboarding: async (input) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ authError: 'Signup inahitaji intaneti.' })
      return false
    }
    const username = input.username.trim().toLowerCase()
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
      set({ authError: 'Username lazima iwe na herufi 3-20: a-z, 0-9, _ au .' })
      return false
    }
    if (input.password.length < 8) {
      set({ authError: 'Password lazima iwe na angalau herufi 8.' })
      return false
    }
    set({ authBusy: true, authError: null })
    const availability = await supabaseRemote.checkUsernameAvailable(username)
    if (availability.error || !availability.available) {
      set({ authBusy: false, authError: 'Username hiyo tayari inatumika.' })
      return false
    }
    const result = await supabaseRemote.register({ ...input, username, ownerName: input.ownerName.trim(), shopName: input.shopName.trim() })
    if (result.error) {
      set({ authBusy: false, authError: result.error })
      return false
    }
    const profile = { shopName: input.shopName.trim(), ownerName: input.ownerName.trim(), phone: '', pin: '' }
    await localDb.meta.put({ key: 'shop_profile', value: profile })
    if (result.user && result.session) {
      const provisioning = await supabaseRemote.ensureMyShop()
      if (provisioning.error) {
        set({ authBusy: false, authError: provisioning.error })
        return false
      }
      const context = await supabaseRemote.getShopContext()
      if (!context) {
        set({ authBusy: false, authError: 'Account created, but the shop could not be provisioned.' })
        return false
      }
      const session = sessionFromUser(result.user, context.role)
      await localDb.meta.put({ key: 'local_session', value: session })
      set({ authBusy: false, authError: null, shopProfile: profile, session, localUnlockRequired: false })
      return true
    }
    set({ authBusy: false, authError: 'Account created. Check your email to confirm your account, then sign in.' })
    return false
  },
  setDevicePin: async (pin) => {
    if (!/^\d{4,6}$/.test(pin)) return false
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const hash = await derivePinHash(pin, salt)
    await localDb.meta.put({ key: 'device_pin', value: { salt: bytesToBase64(salt), hash, failures: 0 } })
    set({ devicePinConfigured: true, localUnlockRequired: false })
    return true
  },
  unlockWithPin: async (pin) => {
    const stored = await localDb.meta.get('device_pin')
    const cached = await localDb.meta.get('local_session')
    if (!stored || !cached || typeof stored.value !== 'object' || typeof cached.value !== 'object') return false
    const pinRecord = stored.value as { salt?: string; hash?: string; failures?: number }
    if (!pinRecord.salt || !pinRecord.hash) return false
    const hash = await derivePinHash(pin, base64ToBytes(pinRecord.salt))
    if (hash !== pinRecord.hash) {
      const failures = (pinRecord.failures ?? 0) + 1
      if (failures >= 10) {
        await localDb.meta.delete('device_pin')
        await localDb.meta.delete('local_session')
        set({ devicePinConfigured: false, localUnlockRequired: false, session: null, shopProfile: null, authError: 'PIN imejaribiwa mara nyingi. Ingia tena kwa email na password.' })
      } else {
        await localDb.meta.put({ key: 'device_pin', value: { ...pinRecord, failures } })
        set({ authError: `PIN si sahihi. Jaribio ${failures}/10.` })
      }
      return false
    }
    await localDb.meta.put({ key: 'device_pin', value: { ...pinRecord, failures: 0 } })
    set({ session: cached.value as UserSession, localUnlockRequired: false, authError: null })
    return true
  },
  updateShopProfile: async (profile) => {
    await localDb.meta.put({ key: 'shop_profile', value: profile })
    set({
      shopProfile: profile,
      session: { id: 'demo-user', name: profile.ownerName, phone: profile.phone, role: 'owner' },
    })
  },
  setLowStockThreshold: async (threshold) => {
    if (!Number.isInteger(threshold) || threshold < 0) return
    await localDb.meta.put({ key: 'low_stock_threshold', value: threshold })
    set({ lowStockThreshold: threshold })
  },
  syncNow: async () => {
    set({ syncStatus: 'syncing' })

    try {
      const queuedRows = await localDb.outbox.toArray()
      await supabaseRemote.pushBatch(
        queuedRows.map((row) => ({
          table: row.table,
          op: row.op,
          payload: row.payload,
        })),
      )
      if (queuedRows.length > 0) {
        await localDb.outbox.bulkDelete(queuedRows.map((row) => row.id))
      }
      await supabaseRemote.pullSince('products', 0, 25)

      set({
        syncStatus: 'online',
        lastSyncedAt: new Date().toISOString(),
        pendingSyncCount: 0,
      })
    } catch {
      set({ syncStatus: 'error' })
    }
  },
  hydrateLocalState: async () => {
    try {
      const [metaSyncState, queuedRows, profileMeta, lowStockThresholdMeta, localProducts, todaysSales, todaysExpenses, saleItems, creditLimitsMeta, localHeldCarts] = await Promise.all([
        localDb.syncState.get('products'),
        localDb.outbox.count(),
        localDb.meta.get('shop_profile'),
        localDb.meta.get('low_stock_threshold'),
        localDb.products.toArray(),
        localDb.sales.where('created_at').aboveOrEqual(new Date().toISOString().slice(0, 10)).toArray(),
        localDb.expenses.where('created_at').aboveOrEqual(new Date().toISOString().slice(0, 10)).toArray(),
        localDb.saleItems.toArray(),
        localDb.meta.get('credit_limits'),
        localDb.heldCarts.toArray(),
      ])
      const hydratedProducts: ProductRecord[] = localProducts.map((product) => {
        const storedProduct = product as typeof product & {
          stock?: number
          denomination?: ProductRecord['denomination']
          base_unit?: string
        }
        return {
          id: storedProduct.id,
          name: storedProduct.name,
          buying_price: storedProduct.buying_price,
          selling_price: storedProduct.selling_price,
          low_limit: storedProduct.low_limit,
          unit: storedProduct.unit,
          stock: storedProduct.stock ?? 0,
          denomination: storedProduct.denomination,
          base_unit: storedProduct.base_unit,
        }
      })

      const salesSummary = todaysSales.reduce<ReportSummary>((summary, sale) => ({
        sales: summary.sales + (sale.status === 'completed' ? sale.total : 0),
        profit: summary.profit + (sale.status === 'completed' ? sale.total_profit : 0),
        transactions: summary.transactions + (sale.status === 'completed' ? 1 : 0),
        expenses: 0,
        net: summary.net + (sale.status === 'completed' ? sale.total_profit : 0),
      }), { sales: 0, profit: 0, transactions: 0, expenses: 0, net: 0 })
      const expenseTotal = todaysExpenses.reduce((total, expense) => total + (expense.is_cash_drop ? 0 : expense.amount), 0)
      const reportSummary = { ...salesSummary, expenses: expenseTotal, net: salesSummary.profit - expenseTotal }
      const counts = new Map<string, { count: number; last: string }>()
      for (const item of saleItems) {
        const current = counts.get(item.product_id) ?? { count: 0, last: '' }
        counts.set(item.product_id, { count: current.count + item.qty, last: current.last })
      }
      const quickSellProducts = productsFromState(hydratedProducts, counts)
      let localSession = await localDb.cashSessions.where('status').equals('open').first()
      if (!localSession) {
        localSession = {
          id: crypto.randomUUID(),
          shop_id: 'demo-shop',
          shop_user_id: useAppStore.getState().session?.id ?? 'demo-user',
          device_id: deviceId,
          label: 'Today',
          opened_at: new Date().toISOString(),
          opening_float: 0,
          status: 'open' as const,
        }
        await localDb.cashSessions.put(localSession)
      }
      const expectedCash = await expectedCashForSession(localSession)

      const localPin = await localDb.meta.get('device_pin')
      const cachedSession = await localDb.meta.get('local_session')
      const cachedProfile = await localDb.meta.get('shop_profile')
      const hasLocalSession = Boolean(localPin && cachedSession && typeof cachedSession.value === 'object')
      if (typeof navigator !== 'undefined' && !navigator.onLine && hasLocalSession) {
        set({
          products: hydratedProducts,
          session: null,
          localUnlockRequired: true,
          devicePinConfigured: true,
          authError: null,
          syncStatus: 'offline',
          pendingSyncCount: queuedRows,
          lastSyncedAt: metaSyncState?.last_pull_at ?? null,
          shopProfile: cachedProfile?.value && typeof cachedProfile.value === 'object' ? cachedProfile.value as ShopProfile : null,
          lowStockThreshold: typeof lowStockThresholdMeta?.value === 'number' && Number.isInteger(lowStockThresholdMeta.value) && lowStockThresholdMeta.value >= 0 ? lowStockThresholdMeta.value : 5,
          isHydrated: true,
          reportSummary,
          reportDate: today(),
          quickSellProducts,
          cashSession: { id: localSession.id, label: localSession.label, openedAt: localSession.opened_at, openingFloat: localSession.opening_float, expectedCash, status: localSession.status },
          expectedCash,
          creditLimits: creditLimitsMeta?.value && typeof creditLimitsMeta.value === 'object' ? creditLimitsMeta.value as Record<string, number | null> : {},
          heldCarts: localHeldCarts.map((heldCart) => ({ id: heldCart.id, label: heldCart.label, items: heldCart.items as CartItem[], total: heldCart.total, createdAt: heldCart.created_at })),
        })
        return
      }

      const auth = await supabaseRemote.refresh()
      const context = auth.user ? await supabaseRemote.getShopContext() : null
      set({
        products: hydratedProducts,
        session: auth.user && context ? sessionFromUser(auth.user, context.role) : null,
        devicePinConfigured: Boolean(localPin),
        authError: auth.error ?? (auth.user && !context ? 'Your account is not linked to a shop yet.' : null),
        syncStatus: await supabaseRemote.syncStatus(),
        pendingSyncCount: queuedRows,
        lastSyncedAt: metaSyncState?.last_pull_at ?? null,
        shopProfile: context
          ? { shopName: context.shopName, ownerName: context.ownerName, phone: context.phone, pin: '' }
          : profileMeta?.value && typeof profileMeta.value === 'object' && 'shopName' in profileMeta.value
            ? profileMeta.value as ShopProfile
          : null,
        lowStockThreshold: typeof lowStockThresholdMeta?.value === 'number' && Number.isInteger(lowStockThresholdMeta.value) && lowStockThresholdMeta.value >= 0
          ? lowStockThresholdMeta.value
          : 5,
        isHydrated: true,
        reportSummary,
        reportDate: today(),
        quickSellProducts,
        cashSession: {
          id: localSession.id,
          label: localSession.label,
          openedAt: localSession.opened_at,
          openingFloat: localSession.opening_float,
          expectedCash,
          status: localSession.status,
        },
        expectedCash,
        creditLimits: creditLimitsMeta?.value && typeof creditLimitsMeta.value === 'object'
          ? creditLimitsMeta.value as Record<string, number | null>
          : {},
        heldCarts: localHeldCarts.map((heldCart) => ({
          id: heldCart.id,
          label: heldCart.label,
          items: heldCart.items as CartItem[],
          total: heldCart.total,
          createdAt: heldCart.created_at,
        })),
      })
    } catch {
      set({ syncStatus: 'offline', isHydrated: true })
    }
  },
}))
