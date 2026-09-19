import Dexie, { type EntityTable } from 'dexie'

export type Product = {
  id: string
  shop_id: string
  name: string
  search_key: string
  buying_price: number
  selling_price: number
  low_limit: number
  unit: string
  barcode?: string | null
  image_emoji?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
  device_id?: string | null
}

export type Sale = {
  id: string
  shop_id: string
  sale_no: number
  total: number
  total_profit: number
  item_count: number
  payment_method: 'cash' | 'mpesa' | 'deni'
  debt_id?: string | null
  status: 'completed' | 'void'
  voided_at?: string | null
  void_reason?: string | null
  voided_by?: string | null
  created_at: string
  updated_at: string
  device_id?: string | null
  created_by?: string | null
  cash_session_id?: string | null
}

export type SaleItem = {
  id: string
  sale_id: string
  shop_id: string
  product_id: string
  product_name: string
  qty: number
  unit_price: number
  unit_cost: number
  cost_unknown: boolean
  line_total: number
  line_profit: number
}

export type StockMovement = {
  id: string
  shop_id: string
  product_id: string
  delta: number
  reason: 'opening' | 'purchase' | 'sale' | 'void' | 'adjustment' | 'damage' | 'return'
  ref_type?: string | null
  ref_id?: string | null
  unit_cost?: number | null
  note?: string | null
  created_at: string
  device_id?: string | null
  created_by?: string | null
}

export type Customer = {
  id: string
  shop_id: string
  name: string
  phone?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export type Debt = {
  id: string
  shop_id: string
  customer_id: string
  customer_name: string
  customer_phone?: string | null
  principal: number
  amount_paid: number
  status: 'open' | 'partial' | 'paid' | 'written_off'
  due_date?: string | null
  sale_id?: string | null
  created_at: string
  updated_at: string
  device_id?: string | null
}

export type DebtPayment = {
  id: string
  shop_id: string
  debt_id: string
  amount: number
  method: 'cash' | 'mpesa'
  created_at: string
  created_by?: string | null
  device_id?: string | null
}

export type Expense = {
  id: string
  shop_id: string
  title: string
  amount: number
  category: 'rent' | 'transport' | 'stock' | 'airtime' | 'electricity' | 'water' | 'wages' | 'licence' | 'food' | 'cash_drop' | 'other'
  payment_method: 'cash' | 'mpesa'
  is_cash_drop: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
  created_by?: string | null
}

export type ProductStat = {
  product_id: string
  sold_count_30d: number
  last_sold_at: string
  score: number
}

export type CashSession = {
  id: string
  shop_id: string
  shop_user_id: string
  device_id: string
  label: string
  opened_at: string
  opening_float: number
  closed_at?: string | null
  closed_by?: string | null
  expected_cash?: number | null
  counted_cash?: number | null
  cash_variance?: number | null
  total_sales?: number | null
  total_profit?: number | null
  total_expenses?: number | null
  transaction_count?: number | null
  note?: string | null
  status: 'open' | 'closed' | 'abandoned'
}

export type HeldCart = {
  id: string
  shop_id: string
  device_id: string
  shop_user_id: string
  label: string
  items: unknown[]
  total: number
  created_at: string
}

export type OutboxEntry = {
  seq?: number
  id: string
  table: string
  op: 'upsert' | 'delete'
  payload: unknown
  attempts: number
  next_attempt_at: number
  last_error?: string | null
}

export type SyncState = {
  table: string
  last_change_seq: number
  last_pull_at?: string | null
}

export type MetaEntry = {
  key: string
  value: string | number | boolean | Record<string, unknown>
}

class SmartSortDb extends Dexie {
  products!: EntityTable<Product, 'id'>
  sales!: EntityTable<Sale, 'id'>
  saleItems!: EntityTable<SaleItem, 'id'>
  stockMovements!: EntityTable<StockMovement, 'id'>
  customers!: EntityTable<Customer, 'id'>
  debts!: EntityTable<Debt, 'id'>
  debtPayments!: EntityTable<DebtPayment, 'id'>
  expenses!: EntityTable<Expense, 'id'>
  productStats!: EntityTable<ProductStat, 'product_id'>
  cashSessions!: EntityTable<CashSession, 'id'>
  heldCarts!: EntityTable<HeldCart, 'id'>
  outbox!: EntityTable<OutboxEntry, 'id'>
  syncState!: EntityTable<SyncState, 'table'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor() {
    super('smartsort-sales-manager-db')

    void this.version(1).stores({
      products:
        'id, shop_id, search_key, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      sales:
        'id, shop_id, sale_no, created_at, updated_at, status, [shop_id+created_at], [shop_id+updated_at]',
      saleItems: 'id, sale_id, shop_id, product_id, [sale_id+product_id]',
      stockMovements:
        'id, shop_id, product_id, created_at, ref_type, ref_id, [shop_id+product_id], [shop_id+created_at]',
      customers:
        'id, shop_id, name, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      debts:
        'id, shop_id, customer_id, status, due_date, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at]',
      debtPayments: 'id, shop_id, debt_id, created_at, [shop_id+created_at]',
      expenses:
        'id, shop_id, category, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      productStats: 'product_id, sold_count_30d, score, last_sold_at',
      outbox: '++seq, id, table, op, payload, attempts, next_attempt_at, last_error',
      syncState: 'table, last_change_seq, last_pull_at',
      meta: 'key',
    })

    void this.version(2).stores({
      products:
        'id, shop_id, search_key, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      sales:
        'id, shop_id, sale_no, created_at, updated_at, status, [shop_id+created_at], [shop_id+updated_at]',
      saleItems: 'id, sale_id, shop_id, product_id, [sale_id+product_id]',
      stockMovements:
        'id, shop_id, product_id, created_at, ref_type, ref_id, [shop_id+product_id], [shop_id+created_at]',
      customers:
        'id, shop_id, name, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      debts:
        'id, shop_id, customer_id, status, due_date, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at]',
      debtPayments: 'id, shop_id, debt_id, created_at, [shop_id+created_at]',
      expenses:
        'id, shop_id, category, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      productStats: 'product_id, sold_count_30d, score, last_sold_at',
      outbox: '++seq, id, table, op, payload, attempts, next_attempt_at, last_error',
      syncState: 'table, last_change_seq, last_pull_at',
      meta: 'key',
    })

    void this.version(3).stores({
      products:
        'id, shop_id, search_key, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      sales:
        'id, shop_id, sale_no, created_at, updated_at, status, [shop_id+created_at], [shop_id+updated_at]',
      saleItems: 'id, sale_id, shop_id, product_id, [sale_id+product_id]',
      stockMovements:
        'id, shop_id, product_id, created_at, ref_type, ref_id, [shop_id+product_id], [shop_id+created_at]',
      customers:
        'id, shop_id, name, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      debts:
        'id, shop_id, customer_id, status, due_date, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at]',
      debtPayments: 'id, shop_id, debt_id, created_at, [shop_id+created_at]',
      expenses:
        'id, shop_id, category, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      productStats: 'product_id, sold_count_30d, score, last_sold_at',
      cashSessions: 'id, shop_id, shop_user_id, device_id, opened_at, status',
      outbox: '++seq, id, table, op, payload, attempts, next_attempt_at, last_error',
      syncState: 'table, last_change_seq, last_pull_at',
      meta: 'key',
    })

    void this.version(4).stores({
      products:
        'id, shop_id, search_key, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      sales:
        'id, shop_id, sale_no, created_at, updated_at, status, [shop_id+created_at], [shop_id+updated_at]',
      saleItems: 'id, sale_id, shop_id, product_id, [sale_id+product_id]',
      stockMovements:
        'id, shop_id, product_id, created_at, ref_type, ref_id, [shop_id+product_id], [shop_id+created_at]',
      customers:
        'id, shop_id, name, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      debts:
        'id, shop_id, customer_id, status, due_date, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at]',
      debtPayments: 'id, shop_id, debt_id, created_at, [shop_id+created_at]',
      expenses:
        'id, shop_id, category, created_at, updated_at, [shop_id+created_at], [shop_id+updated_at], deleted_at',
      productStats: 'product_id, sold_count_30d, score, last_sold_at',
      cashSessions: 'id, shop_id, shop_user_id, device_id, opened_at, status',
      heldCarts: 'id, shop_id, device_id, shop_user_id, created_at',
      outbox: '++seq, id, table, op, payload, attempts, next_attempt_at, last_error',
      syncState: 'table, last_change_seq, last_pull_at',
      meta: 'key',
    })
  }
}

export const localDb = new SmartSortDb()

export async function seedDemoData(): Promise<void> {
  const productCount = await localDb.products.count()
  if (productCount > 0) return

  const now = new Date().toISOString()

  const demoProducts: Product[] = [
    {
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      name: 'Sukari 1kg',
      search_key: 'sukari 1kg',
      buying_price: 130,
      selling_price: 170,
      low_limit: 5,
      unit: 'kg',
      image_emoji: '🍚',
      is_active: true,
      created_at: now,
      updated_at: now,
      device_id: 'demo-device',
    },
    {
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      name: 'Chai',
      search_key: 'chai',
      buying_price: 80,
      selling_price: 120,
      low_limit: 6,
      unit: 'pcs',
      image_emoji: '🫖',
      is_active: true,
      created_at: now,
      updated_at: now,
      device_id: 'demo-device',
    },
    {
      id: crypto.randomUUID(),
      shop_id: 'demo-shop',
      name: 'Maziwa',
      search_key: 'maziwa',
      buying_price: 95,
      selling_price: 140,
      low_limit: 4,
      unit: 'ltr',
      image_emoji: '🥛',
      is_active: true,
      created_at: now,
      updated_at: now,
      device_id: 'demo-device',
    },
  ]

  await localDb.products.bulkPut(demoProducts)

  const initialMovements: StockMovement[] = demoProducts.map((product, index) => ({
    id: crypto.randomUUID(),
    shop_id: 'demo-shop',
    product_id: product.id,
    delta: 12 + index * 3,
    reason: 'opening',
    ref_type: 'opening',
    ref_id: 'demo-opening',
    unit_cost: product.buying_price,
    note: 'Demo stock opening balance',
    created_at: now,
    device_id: 'demo-device',
    created_by: 'owner',
  }))

  await localDb.stockMovements.bulkPut(initialMovements)
}
