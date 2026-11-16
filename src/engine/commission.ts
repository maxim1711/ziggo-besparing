import type { Cents } from './money'
import { comboApplies } from './calc'
import type { Offer, VodafoneCombo } from './types'

/** Provisiestructuur van de adviseur. Staat volledig los van klantbesparingen. */
export interface CommissionSettings {
  internetBaseCents: Cents
  tvBonusCents: Cents
  contract24BonusCents: Cents
  vodafoneComboBonusCents: Cents
}

export interface CommissionEstimate {
  totalCents: Cents
  lines: { label: string; cents: Cents }[]
}

export function estimateCommission(offer: Pick<Offer, 'kind' | 'contractMonths'>, combo: VodafoneCombo, s: CommissionSettings): CommissionEstimate {
  const lines = [{ label: 'Basis internet', cents: s.internetBaseCents }]
  if (offer.kind === 'internet_tv') lines.push({ label: 'Bonus tv', cents: s.tvBonusCents })
  if (offer.contractMonths === 24) lines.push({ label: 'Bonus 2-jarig contract', cents: s.contract24BonusCents })
  if (comboApplies(combo)) lines.push({ label: 'Bonus Vodafone-combinatie', cents: s.vodafoneComboBonusCents })
  const active = lines.filter((l) => l.cents !== 0)
  return { totalCents: active.reduce((a, l) => a + l.cents, 0), lines: active }
}
