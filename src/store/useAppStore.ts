import { create } from 'zustand'
import { localDb, type CashSession as LocalCashSession } from '../lib/db/local'
import { supabaseRemote } from '../lib/remote/supabase'
import { buildReceiptText } from '../lib/receipt'
import type { AppSyncStatus, CartItem, CashSession, DebtRecord, ExpenseCategory, HeldCart, ProductRecord, ReportSummary, ShopProfile, UserSession } from '../types/app'
import { defaultLocale, type Locale } from '../lib/i18n'

const initialProducts: ProductRecord[] = [
  { id: 'p1', name: 'Sukari 1kg', buying_price: 130, selling_price: 170, low_limit: 5, unit: 'kg', image_emoji: '🍚', stock: 12, denomination: 'full', base_unit: 'kg' },
  { id: 'p2', name: 'Chai', buying_price: 80, selling_price: 120, low_limit: 6, unit: 'pcs', image_emoji: '🫖', stock: 8, denomination: 'unit' },
  { id: 'p3', name: 'Maziwa', buying_price: 95, selling_price: 140, low_limit: 4, unit: 'ltr', image_emoji: '🥛', stock: 3, denomination: 'unit' },
  { id: 'p4', name: 'Pasta', buying_price: 60, selling_price: 80, low_limit: 5, unit: 'pcs', image_emoji: '🍝', stock: 0, denomination: 'unit' },
  { id: 'p5', name: 'Mango', buying_price: 40, selling_price: 60, low_limit: 8, unit: 'pcs', image_emoji: '🥭', stock: 15, denomination: 'unit' },
  { id: 'p6', name: 'Beans', buying_price: 110, selling_price: 150, low_limit: 7, unit: 'kg', image_emoji: '🫘', stock: 6, denomination: 'full', base_unit: 'kg' },
]

const initialDebts: DebtRecord[] = [
  { id: 'd1', customer: 'Amina', phone: '+254712000001', amount: 850, paid: 200, items: [], dueDate: '2026-09-25', status: 'partial' },
  { id: 'd2', customer: 'Kibaki', phone: '+254712000002', amount: 1200, paid: 0, items: [], dueDate: '2026-09-18', status: 'open' },
  { id: 'd3', customer: 'Salim', phone: '+254712000003', amount: 350, paid: 350, items: [], dueDate: '2026-09-10', status: 'paid' },
]

const deviceId = 'demo-device'

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
  lastSaleMessage: string | null
  shopProfile: ShopProfile | null
  lowStockThreshold: number
  isHydrated: boolean
  reportSummary: ReportSummary
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
  addProduct: (product: Omit<ProductRecord, 'id' | 'image_emoji'> & { image_emoji?: string | null }) => void
  receiveStock: (productId: string, quantity: number) => Promise<void>
  addExpense: (title: string, amount: number, category: ExpenseCategory, paymentMethod: 'cash' | 'mpesa') => Promise<void>
  closeCashSession: (countedCash: number, note: string) => Promise<boolean>
  parkCart: (label?: string) => Promise<boolean>
  resumeHeldCart: (id: string) => Promise<boolean>
  deleteHeldCart: (id: string) => Promise<void>
  addDebt: (customer: string, phone: string, items: DebtRecord['items'], creditLimit?: number | null) => Promise<boolean>
  payDebt: (debtId: string, amount: number, method: 'cash' | 'mpesa') => Promise<boolean>
  setActiveTab: (tab: AppState['activeTab']) => void
  setLocale: (locale: Locale) => void
  loginDemo: () => void
  logout: () => void
  completeOnboarding: (profile: ShopProfile) => Promise<void>
  updateShopProfile: (profile: ShopProfile) => Promise<void>
  setLowStockThreshold: (threshold: number) => Promise<void>
  syncNow: () => Promise<void>
  hydrateLocalState: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  products: initialProducts,
  cart: [],
  debts: initialDebts,
  activeTab: 'sell',
  locale: defaultLocale,
  session: { id: 'demo-user', name: 'Owner', phone: '+254700000000', role: 'owner' },
  syncStatus: 'online',
  lastSyncedAt: null,
  pendingSyncCount: 0,
  lastSaleMessage: null,
  shopProfile: null,
  lowStockThreshold: 5,
  isHydrated: false,
  reportSummary: { sales: 0, profit: 0, transactions: 0, expenses: 0, net: 0 },
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
      image_emoji: product.image_emoji ?? '📦',
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
  setLocale: (locale) => set({ locale }),
  loginDemo: () =>
    set({
      session: { id: 'demo-user', name: 'Owner', phone: '+254700000000', role: 'owner' },
    }),
  logout: () => set({ session: null }),
  completeOnboarding: async (profile) => {
    await localDb.meta.put({ key: 'shop_profile', value: profile })
    await supabaseRemote.register(profile)
    set({
      shopProfile: profile,
      session: { id: 'demo-user', name: profile.ownerName, phone: profile.phone, role: 'owner' },
    })
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
      const [metaSyncState, queuedRows, profileMeta, lowStockThresholdMeta, todaysSales, todaysExpenses, saleItems, creditLimitsMeta, localHeldCarts] = await Promise.all([
        localDb.syncState.get('products'),
        localDb.outbox.count(),
        localDb.meta.get('shop_profile'),
        localDb.meta.get('low_stock_threshold'),
        localDb.sales.where('created_at').aboveOrEqual(new Date().toISOString().slice(0, 10)).toArray(),
        localDb.expenses.where('created_at').aboveOrEqual(new Date().toISOString().slice(0, 10)).toArray(),
        localDb.saleItems.toArray(),
        localDb.meta.get('credit_limits'),
        localDb.heldCarts.toArray(),
      ])

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
      const quickSellProducts = productsFromState(useAppStore.getState().products, counts)
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

      set({
        syncStatus: await supabaseRemote.syncStatus(),
        pendingSyncCount: queuedRows,
        lastSyncedAt: metaSyncState?.last_pull_at ?? null,
        shopProfile: profileMeta?.value && typeof profileMeta.value === 'object' && 'shopName' in profileMeta.value
          ? profileMeta.value as ShopProfile
          : null,
        lowStockThreshold: typeof lowStockThresholdMeta?.value === 'number' && Number.isInteger(lowStockThresholdMeta.value) && lowStockThresholdMeta.value >= 0
          ? lowStockThresholdMeta.value
          : 5,
        isHydrated: true,
        reportSummary,
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
