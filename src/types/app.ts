export type ProductDenomination = 'quarter' | 'half' | 'three-quarter' | 'full' | 'unit'

export type ProductRecord = {
  id: string
  name: string
  buying_price: number
  selling_price: number
  low_limit: number
  unit: string
  stock: number
  denomination?: ProductDenomination
  base_unit?: string
}

export type CartItem = {
  productId: string
  name: string
  qty: number
  unitPrice: number
  unitCost: number
  costUnknown: boolean
}

export type DebtRecord = {
  id: string
  customer: string
  phone: string
  amount: number
  paid: number
  items: Array<{
    productId: string
    productName: string
    qty: number
    unitPrice: number
  }>
  dueDate: string
  status: 'open' | 'partial' | 'paid'
}

export type LocaleMode = 'sw' | 'en'

export type UserSession = {
  id: string
  name: string
  phone: string
  email?: string
  role: 'owner' | 'cashier'
}

export type ShopProfile = {
  shopName: string
  ownerName: string
  phone: string
  pin: string
}

export type AppSyncStatus = 'online' | 'offline' | 'syncing' | 'error'

export type ReportSummary = {
  sales: number
  profit: number
  transactions: number
  expenses: number
  net: number
}

export type ExpenseCategory = 'rent' | 'transport' | 'stock' | 'airtime' | 'electricity' | 'water' | 'wages' | 'licence' | 'food' | 'cash_drop' | 'other'

export type CashSession = {
  id: string
  label: string
  openedAt: string
  openingFloat: number
  expectedCash: number
  status: 'open' | 'closed' | 'abandoned'
  countedCash?: number
  variance?: number
}

export type HeldCart = {
  id: string
  label: string
  items: CartItem[]
  total: number
  createdAt: string
}
