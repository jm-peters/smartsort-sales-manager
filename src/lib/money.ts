export type KES = number & { __brand: 'KES' }

export function asKES(value: number): KES {
  return Math.trunc(value) as KES
}

export function add(...values: number[]): KES {
  return asKES(values.reduce((total, value) => total + Math.trunc(value), 0))
}

export function mul(value: number, multiplier: number): KES {
  return asKES(Math.trunc(value) * Math.trunc(multiplier))
}

export function sum(values: Array<number | undefined | null>): KES {
  let total = 0

  for (const value of values) {
    total += value == null ? 0 : Math.trunc(value)
  }

  return asKES(total)
}

export function format(value: number): string {
  const normalized = Math.trunc(value)
  return `KES ${new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: 0,
  }).format(normalized)}`
}

export function formatShort(value: number): string {
  return format(value)
}
