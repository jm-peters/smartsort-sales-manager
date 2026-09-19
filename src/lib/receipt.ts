import type { CartItem } from '../types/app'

export function buildReceiptText(
  shopName: string,
  saleNo: number,
  items: CartItem[],
  total: number,
  paymentMethod: 'cash' | 'mpesa' | 'deni' = 'cash',
): string {
  const lines = items.map((item) => `${item.name}  ${item.qty} x ${item.unitPrice} = ${item.qty * item.unitPrice}`)
  const paymentLabel = paymentMethod === 'deni' ? 'Deni' : paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'

  return [
    shopName,
    `${new Date().toLocaleString('en-KE')} · Receipt #${saleNo}`,
    '---------------------',
    ...lines,
    '---------------------',
    `TOTAL          KES ${total}`,
    `Payment: ${paymentLabel}`,
    '',
    `Thank you! - ${shopName}`,
  ].join('\n')
}
