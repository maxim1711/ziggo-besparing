/** ISO-datums (YYYY-MM-DD) zonder tijdzone-gedoe. */
export type IsoDate = string

export function todayIso(now = new Date()): IsoDate {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(ny, nm, 0).getDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  return todayIso(new Date(y, m - 1, d + days))
}

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

export function formatDateNl(date: IsoDate | null | undefined): string {
  if (!date) return '—'
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return '—'
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** Maandag van de week waarin de datum valt. */
export function startOfWeek(date: IsoDate): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7
  return addDays(date, -dow)
}
