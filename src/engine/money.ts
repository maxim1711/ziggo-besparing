/** Alle bedragen in de app zijn gehele eurocenten (integer), nooit floats. */
export type Cents = number

const NBSP = ' '

/**
 * Zet een ingetypt bedrag om naar centen zonder floating-point tussenstap.
 * Accepteert "34,95", "34.95", "1.234,56", "€ 65", "65,-".
 */
export function parseEuroToCents(input: string): Cents | null {
  let s = input.replace(/[€\s ]/g, '').replace(/,-$/, '')
  if (s === '') return null
  const negative = s.startsWith('-')
  if (negative) s = s.slice(1)
  if (!/^[0-9.,]+$/.test(s)) return null
  let whole: string
  let frac = ''
  if (s.includes(',')) {
    const parts = s.split(',')
    if (parts.length !== 2) return null
    whole = parts[0].replace(/\./g, '')
    frac = parts[1]
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    ;[whole, frac] = s.split('.')
  } else {
    whole = s.replace(/\./g, '')
  }
  if (whole === '') whole = '0'
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac)) return null
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  if (!Number.isSafeInteger(cents)) return null
  return negative ? -cents : cents
}

export interface EuroFormatOptions {
  /** 'auto' laat ",00" weg bij ronde bedragen. */
  decimals?: 'always' | 'auto'
  /** Gewone spatie i.p.v. harde spatie (voor PDF en platte tekst). */
  plainSpace?: boolean
}

/** Nederlandse notatie: € 1.259,40 en € -70,00. */
export function formatEuro(cents: Cents, opts: EuroFormatOptions = {}): string {
  const abs = Math.abs(Math.round(cents))
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const rest = abs % 100
  const dec = opts.decimals === 'auto' && rest === 0 ? '' : ',' + rest.toString().padStart(2, '0')
  return `€${opts.plainSpace ? ' ' : NBSP}${cents < 0 ? '-' : ''}${euros}${dec}`
}

/** Invoerweergave zonder euroteken: "34,95". */
export function centsToInput(cents: Cents | null): string {
  if (cents === null) return ''
  const abs = Math.abs(cents)
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)},${(abs % 100).toString().padStart(2, '0')}`
}

export const sum = (values: Cents[]): Cents => values.reduce((a, b) => a + b, 0)
