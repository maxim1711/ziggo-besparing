import type { CurrentSubscription, Offer, VodafoneCombo } from './types'

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)

export const emptyCurrent = (): CurrentSubscription => ({
  provider: '',
  packageName: '',
  monthlyCents: null,
  speedMbps: null,
  hasTv: true,
  tvReceivers: 1,
  extras: [],
  discounts: [],
  contractEndDate: null,
  cancellationCents: 0,
  futureMonthlyCents: null,
  futureFromMonth: 13,
})

export const emptyCombo = (): VodafoneCombo => ({ hasVodafone: false, eligible: false, monthlyDiscountCents: 0, extraBenefits: '' })

export const emptyOffer = (today: string): Offer => ({
  id: newId(),
  name: '',
  provider: 'Ziggo',
  kind: 'internet_tv',
  speedMbps: 200,
  contractMonths: 24,
  promoMonthlyCents: 0,
  promoMonths: 12,
  regularMonthlyCents: 0,
  activationCents: 0,
  installationCents: 0,
  equipmentCents: 0,
  extras: [],
  discounts: [],
  gift: null,
  validFrom: today,
  validTo: today,
  version: '1',
  isExample: false,
  conditions: '',
  internalNotes: '',
})

/**
 * Illustratieve voorbeeldaanbiedingen. De bedragen zijn verzonnen en GEEN actuele
 * Ziggo-prijzen; ze blijven als "Voorbeeld" gemarkeerd tot de adviseur ze aanpast.
 */
export function sampleOffers(today: string): Offer[] {
  const year = today.slice(0, 4)
  const base = { ...emptyOffer(today), validFrom: `${year}-01-01`, validTo: `${year}-12-31`, version: 'voorbeeld-1', isExample: true, conditions: 'Voorbeeldvoorwaarden: actie geldt voor nieuwe klanten. Prijzen inclusief btw.' }
  return [
    { ...base, id: 'sample-a', name: 'Internet 200 – 1 jaar actie', kind: 'internet', speedMbps: 200, contractMonths: 12, promoMonthlyCents: 3495, promoMonths: 12, regularMonthlyCents: 5500, activationCents: 2000 },
    { ...base, id: 'sample-b', name: 'Internet + TV 400 – 2 jaar actie', kind: 'internet_tv', speedMbps: 400, contractMonths: 24, promoMonthlyCents: 4750, promoMonths: 24, regularMonthlyCents: 6950, activationCents: 2000 },
    {
      ...base,
      id: 'sample-c',
      name: 'Internet + TV 400 – 2 jaar met cadeau',
      kind: 'internet_tv',
      speedMbps: 400,
      contractMonths: 24,
      promoMonthlyCents: 6250,
      promoMonths: 0,
      regularMonthlyCents: 6250,
      activationCents: 2000,
      gift: { type: 'televisie', name: '43-inch smart-tv', imageDataUrl: null, retailValueCents: 39900, description: 'Smart-tv als welkomstcadeau.', conditions: 'Voorbeeld: op = op, levering na activatie van het abonnement.' },
    },
    { ...base, id: 'sample-d', name: 'Internet + TV 1000 – half jaar korting', kind: 'internet_tv', speedMbps: 1000, contractMonths: 12, promoMonthlyCents: 5495, promoMonths: 6, regularMonthlyCents: 7950, activationCents: 2000 },
  ]
}
