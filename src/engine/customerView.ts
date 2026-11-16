import { compare, newMonthlyCost } from './calc'
import type { Cents } from './money'
import { buildInsights, buildSummary } from './insights'
import type { ComparisonInput, ComparisonResult, CurrentSubscription, Insight, Offer, VodafoneCombo } from './types'

/** Aanbieding zoals de klant die mag zien: zonder interne notities. */
export type CustomerOffer = Omit<Offer, 'internalNotes'>

export interface CustomerView {
  current: CurrentSubscription
  offer: CustomerOffer
  combo: VodafoneCombo
  result: ComparisonResult
  insights: Insight[]
  summary: string
  startDate: string
}

/**
 * Enige toegangspoort voor klantweergave, PDF, afdruk en WhatsApp.
 * Hier komen bewust geen provisie, doelen of interne notities doorheen.
 */
export function buildCustomerView(input: ComparisonInput): CustomerView {
  const result = compare(input)
  const insights = buildInsights(input, result)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { internalNotes: _omit, ...offer } = input.offer
  return { current: input.current, offer, combo: input.combo, result, insights, summary: buildSummary(insights), startDate: input.startDate }
}

export interface PriceSegment {
  from: number
  to: number
  cents: number
}

/** Aaneengesloten perioden met hetzelfde maandbedrag, binnen de vergeleken periode. */
export function priceSegments(result: ComparisonResult, side: 'new' | 'current' = 'new'): PriceSegment[] {
  const out: PriceSegment[] = []
  for (const m of result.months.slice(0, result.period)) {
    const cents = side === 'new' ? m.newCents : m.currentCents
    const last = out[out.length - 1]
    if (last && last.cents === cents) last.to = m.month
    else out.push({ from: m.month, to: m.month, cents })
  }
  return out
}

export const segmentLabel = (s: PriceSegment) => (s.from === s.to ? `Maand ${s.from}` : `Maand ${s.from}–${s.to}`)

/** Vaste aannames die bij elke klantuiting horen. */
export function assumptions(view: CustomerView): string[] {
  const { result, offer } = view
  const list = [
    'Alle bedragen zijn inclusief btw.',
    `De vergelijking loopt over ${result.period} maanden en is per maand doorgerekend.`,
    'De besparing is een schatting: er is aangenomen dat uw huidige maandbedrag gelijk blijft, tenzij anders opgegeven.',
  ]
  if (result.periodExceedsContract) list.push(`Na de contractduur van ${offer.contractMonths} maanden is gerekend met het reguliere tarief; dat bedrag is niet contractueel vastgelegd en kan wijzigen.`)
  if (offer.gift) list.push('De winkelwaarde van het cadeau is niet verrekend in de kosten en is geen geldbedrag dat u bespaart.')
  list.push('Niet meegerekend: kosten voor bellen, losse aankopen (zoals films), en eventuele tussentijdse prijswijzigingen van uw huidige of nieuwe aanbieder.')
  list.push('De actuele actievoorwaarden en tarieven van de aanbieder zijn altijd leidend. Dit is een onafhankelijk advies en geen officiële uiting van de aanbieder.')
  return list
}

export interface PriceStory {
  nowCents: Cents
  /** Bv. "De eerste 12 maanden". */
  nowLabel: string
  /** Bv. "Daarna € 69,95 per maand". Altijd tonen: dit zijn wezenlijke voorwaarden. */
  later: { label: string; cents: Cents; estimate: boolean }[]
}

/** De prijs in gewone taal: wat betaalt u nu, en wat daarna. */
export function priceStory(view: CustomerView): PriceStory {
  const { result, offer, combo } = view
  const segs = priceSegments(result)
  const months = (n: number) => (n === 1 ? 'De eerste maand' : `De eerste ${n} maanden`)
  const later = segs.slice(1).map((s, i) => ({ label: i === 0 ? 'Daarna' : `Vanaf maand ${s.from}`, cents: s.cents, estimate: s.from > offer.contractMonths }))
  // Ook laten zien wat er ná de vergeleken periode gebeurt als de prijs dan verandert.
  const after = newMonthlyCost(offer as Offer, combo, result.period + 1).withCombo
  const last = segs[segs.length - 1]
  if (after !== last.cents) later.push({ label: `Na ${result.period} maanden`, cents: after, estimate: true })
  return { nowCents: segs[0].cents, nowLabel: segs.length > 1 || later.length > 0 ? months(segs[0].to) : 'Vaste prijs, geen tijdelijke actieprijs', later }
}
