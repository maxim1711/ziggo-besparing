import { addMonths } from './dates'
import { sum, type Cents } from './money'
import type { ComparisonInput, ComparisonResult, CurrentSubscription, MonthRow, Offer, VodafoneCombo } from './types'

export const HORIZON = 24

/** Huidig maandbedrag in maand m (1 = eerste maand van de vergelijking). */
export function currentMonthlyCost(current: CurrentSubscription, month: number, startDate: string): Cents {
  const extras = sum(current.extras.map((e) => e.monthlyCents))
  if (current.futureMonthlyCents !== null && month >= current.futureFromMonth) {
    // Het verwachte tarief vervangt basisbedrag én aflopende kortingen: niet dubbel tellen.
    return current.futureMonthlyCents + extras
  }
  const monthStart = addMonths(startDate, month - 1)
  const expired = sum(
    current.discounts.filter((d) => d.endsOn !== null && monthStart > d.endsOn).map((d) => d.monthlyCents),
  )
  return (current.monthlyCents ?? 0) + expired + extras
}

/** Totale maandkorting; binnen één exclusieve groep telt alleen de hoogste korting. */
export function offerDiscountForMonth(offer: Offer, month: number): Cents {
  const groups = new Map<string, Cents>()
  for (const d of offer.discounts) {
    if (month < d.fromMonth || (d.toMonth !== null && month > d.toMonth)) continue
    const key = d.exclusiveGroup?.trim() ? `g:${d.exclusiveGroup.trim().toLowerCase()}` : `d:${d.id}`
    groups.set(key, Math.max(groups.get(key) ?? 0, d.monthlyCents))
  }
  return sum([...groups.values()])
}

export function comboApplies(combo: VodafoneCombo): boolean {
  return combo.hasVodafone && combo.eligible && combo.monthlyDiscountCents > 0
}

export function newMonthlyCost(offer: Offer, combo: VodafoneCombo, month: number): { withCombo: Cents; withoutCombo: Cents } {
  const promo = month <= offer.promoMonths
  const base = promo ? offer.promoMonthlyCents : offer.regularMonthlyCents
  // Kortingen kunnen het abonnementsbedrag nooit onder nul brengen.
  const afterDiscounts = Math.max(0, base - offerDiscountForMonth(offer, month))
  const extras = sum(offer.extras.map((e) => e.monthlyCents))
  const afterCombo = comboApplies(combo) ? Math.max(0, afterDiscounts - combo.monthlyDiscountCents) : afterDiscounts
  return { withCombo: afterCombo + extras, withoutCombo: afterDiscounts + extras }
}

const range = (rows: MonthRow[], from: number, to: number) => rows.filter((r) => r.month >= from && r.month <= to)

export function compare(input: ComparisonInput): ComparisonResult {
  const { current, offer, combo, period, startDate } = input
  const oneTime = {
    activationCents: offer.activationCents,
    installationCents: offer.installationCents,
    equipmentCents: offer.equipmentCents,
    cancellationCents: current.cancellationCents,
    totalCents: offer.activationCents + offer.installationCents + offer.equipmentCents + current.cancellationCents,
  }

  const months: MonthRow[] = []
  let cumulative = -oneTime.totalCents
  for (let m = 1; m <= HORIZON; m++) {
    const cur = currentMonthlyCost(current, m, startDate)
    const neu = newMonthlyCost(offer, combo, m)
    cumulative += cur - neu.withCombo
    months.push({
      month: m,
      currentCents: cur,
      newCents: neu.withCombo,
      newWithoutComboCents: neu.withoutCombo,
      diffCents: cur - neu.withCombo,
      cumulativeSavingsCents: cumulative,
      contractual: m <= offer.contractMonths,
      promo: m <= offer.promoMonths,
    })
  }

  const cur = (from: number, to: number) => sum(range(months, from, to).map((r) => r.currentCents))
  const neu = (from: number, to: number) => sum(range(months, from, to).map((r) => r.newCents))
  const neuNoCombo = (from: number, to: number) => sum(range(months, from, to).map((r) => r.newWithoutComboCents))

  const current12Cents = cur(1, 12)
  const current24Cents = cur(1, 24)
  const newRecurring12Cents = neu(1, 12)
  const newRecurring24Cents = neu(1, 24)
  const new12Cents = newRecurring12Cents + oneTime.totalCents
  const new24Cents = newRecurring24Cents + oneTime.totalCents

  const currentPeriodCents = period === 12 ? current12Cents : current24Cents
  const newPeriodCents = period === 12 ? new12Cents : new24Cents
  const totalSavingsCents = currentPeriodCents - newPeriodCents
  const comboSavingsPeriodCents = neuNoCombo(1, period) - neu(1, period)

  const increase = months.find((r, i) => i > 0 && r.month <= period && r.newCents > months[i - 1].newCents)

  return {
    period,
    months,
    currentKnown: current.monthlyCents !== null,
    current12Cents,
    current24Cents,
    new12Cents,
    new24Cents,
    newRecurring12Cents,
    newRecurring24Cents,
    oneTime,
    year1SavingsCents: current12Cents - new12Cents,
    year2SavingsCents: cur(13, 24) - neu(13, 24),
    currentPeriodCents,
    newPeriodCents,
    totalSavingsCents,
    monthlyPromoAdvantageCents: months[0].diffCents,
    avgEffectiveMonthlyCents: Math.round(newPeriodCents / period),
    comboSavingsPeriodCents,
    totalSavingsWithoutComboCents: totalSavingsCents - comboSavingsPeriodCents,
    giftRetailValueCents: offer.gift?.retailValueCents ?? null,
    firstMonthNewCents: months[0].newCents,
    priceIncreaseMonth: increase?.month ?? null,
    priceAfterIncreaseCents: increase?.newCents ?? null,
    periodExceedsContract: period > offer.contractMonths,
    contractExceedsPeriod: offer.contractMonths > period,
  }
}
