import type { ComparisonResult, Offer } from './types'

export interface OptionBadge {
  id: 'cheapest' | 'cheapest-y1' | 'flexible' | 'gift' | 'fastest'
  label: string
  /** Het criterium waarop het label is gebaseerd; altijd tonen bij het label. */
  criterion: string
}

function uniqueBest<T>(items: T[], score: (t: T) => number): number | null {
  if (items.length < 2) return null
  const scores = items.map(score)
  const best = Math.min(...scores)
  return scores.filter((s) => s === best).length === 1 ? scores.indexOf(best) : null
}

/** Kent labels alleen toe als een optie op dat criterium eenduidig wint. */
export function rankOptions(options: { offer: Offer; result: ComparisonResult }[]): OptionBadge[][] {
  const badges: OptionBadge[][] = options.map(() => [])
  if (options.length === 0) return badges
  const period = options[0].result.period

  const cheapest = uniqueBest(options, (o) => o.result.newPeriodCents)
  if (cheapest !== null) badges[cheapest].push({ id: 'cheapest', label: 'Laagste totale kosten', criterion: `Laagste totaalbedrag over ${period} maanden, inclusief eenmalige kosten.` })

  if (period === 24) {
    const y1 = uniqueBest(options, (o) => o.result.new12Cents)
    if (y1 !== null && y1 !== cheapest) badges[y1].push({ id: 'cheapest-y1', label: 'Laagste kosten eerste jaar', criterion: 'Laagste totaalbedrag over de eerste 12 maanden, inclusief eenmalige kosten.' })
  }

  const flex = uniqueBest(options, (o) => o.offer.contractMonths)
  if (flex !== null) badges[flex].push({ id: 'flexible', label: 'Meeste flexibiliteit', criterion: `Kortste contractduur (${options[flex].offer.contractMonths} maanden).` })

  const fastest = uniqueBest(options, (o) => -o.offer.speedMbps)
  if (fastest !== null) badges[fastest].push({ id: 'fastest', label: 'Hoogste snelheid', criterion: `Hoogste internetsnelheid (${options[fastest].offer.speedMbps} Mbit/s).` })

  options.forEach((o, i) => {
    if (o.offer.gift) badges[i].push({ id: 'gift', label: 'Met cadeau', criterion: 'Inclusief cadeau volgens de actievoorwaarden; de waarde is niet verrekend in de kosten.' })
  })
  return badges
}
