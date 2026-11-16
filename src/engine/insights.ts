import { formatDateNl } from './dates'
import { formatEuro } from './money'
import { addMonths } from './dates'
import { comboApplies } from './calc'
import type { ComparisonInput, ComparisonResult, Insight } from './types'

const eur = (c: number) => formatEuro(Math.abs(c), { decimals: 'auto' })

/**
 * Deterministische adviesregels: elke zin volgt rechtstreeks uit berekende waarden.
 * Geen gegenereerde tekst, geen aannames buiten de invoer.
 */
export function buildInsights(input: ComparisonInput, r: ComparisonResult): Insight[] {
  const { current, offer, combo, period, startDate } = input
  const out: Insight[] = []
  const add = (id: string, tone: Insight['tone'], text: string) => out.push({ id, tone, text })

  if (!r.currentKnown) {
    add('unknown', 'warning', 'Het huidige maandbedrag is nog niet ingevuld. Een besparing kan pas worden berekend als dit bekend is.')
  } else {
    if (r.totalSavingsCents > 0) {
      add('total', 'positive', `Over ${period} maanden is dit pakket naar verwachting ${eur(r.totalSavingsCents)} goedkoper dan uw huidige abonnement.`)
    } else if (r.totalSavingsCents < 0) {
      const faster = current.speedMbps !== null && offer.speedMbps > current.speedMbps
      add(
        'total',
        'negative',
        `Dit pakket is over ${period} maanden ${eur(r.totalSavingsCents)} duurder dan uw huidige abonnement${
          faster ? `, maar biedt een hogere internetsnelheid (${offer.speedMbps} in plaats van ${current.speedMbps} Mbit/s)` : ''
        }.`,
      )
    } else {
      add('total', 'neutral', `Over ${period} maanden zijn de kosten gelijk aan die van uw huidige abonnement.`)
    }

    if (period === 24) {
      if (r.year1SavingsCents > 0) add('y1', 'positive', `In de eerste 12 maanden is het nieuwe abonnement ${eur(r.year1SavingsCents)} goedkoper.`)
      else if (r.year1SavingsCents < 0) add('y1', 'negative', `In de eerste 12 maanden is het nieuwe abonnement ${eur(r.year1SavingsCents)} duurder.`)
      if (r.year2SavingsCents < 0 && r.year1SavingsCents > 0)
        add('y2', 'warning', `In het tweede jaar betaalt u ${eur(r.year2SavingsCents)} meer dan bij uw huidige abonnement.`)
    }
  }

  if (r.priceIncreaseMonth !== null && r.priceAfterIncreaseCents !== null) {
    const before = r.months[r.priceIncreaseMonth - 2].newCents
    add('increase', 'warning', `Vanaf maand ${r.priceIncreaseMonth} stijgt het maandbedrag van ${eur(before)} naar ${eur(r.priceAfterIncreaseCents)}.`)
  }

  if (r.oneTime.totalCents > 0) {
    const parts: string[] = []
    if (r.oneTime.activationCents) parts.push(`activatie ${eur(r.oneTime.activationCents)}`)
    if (r.oneTime.installationCents) parts.push(`installatie ${eur(r.oneTime.installationCents)}`)
    if (r.oneTime.equipmentCents) parts.push(`apparatuur ${eur(r.oneTime.equipmentCents)}`)
    if (r.oneTime.cancellationCents) parts.push(`beëindiging huidig contract ${eur(r.oneTime.cancellationCents)}`)
    add('onetime', 'neutral', `Eenmalige kosten van ${eur(r.oneTime.totalCents)} zijn meegerekend (${parts.join(', ')}).`)
  }

  if (current.contractEndDate && current.contractEndDate > startDate) {
    add(
      'contract-running',
      'warning',
      current.cancellationCents > 0
        ? `Uw huidige contract loopt nog tot ${formatDateNl(current.contractEndDate)}. De opgegeven beëindigingskosten zijn meegerekend.`
        : `Uw huidige contract loopt nog tot ${formatDateNl(current.contractEndDate)}. Controleer eventuele beëindigingskosten.`,
    )
  }

  for (const d of current.discounts) {
    if (d.endsOn && d.endsOn >= startDate && d.endsOn < addMonths(startDate, period - 1) && current.futureMonthlyCents === null) {
      add(`cur-disc-${d.id}`, 'neutral', `Uw huidige korting${d.label ? ` “${d.label}”` : ''} vervalt op ${formatDateNl(d.endsOn)}; daarna betaalt u ${eur(d.monthlyCents)} per maand meer.`)
    }
  }

  if (r.periodExceedsContract) {
    add('estimate', 'neutral', `Het contract duurt ${offer.contractMonths} maanden. Bedragen na maand ${offer.contractMonths} zijn een schatting op basis van het reguliere tarief.`)
  } else if (r.contractExceedsPeriod) {
    add('longer', 'warning', `Deze aanbieding heeft een contractduur van ${offer.contractMonths} maanden; dat is langer dan de vergeleken periode van ${period} maanden.`)
  } else if (offer.contractMonths === 24) {
    add('longer', 'neutral', 'Deze aanbieding heeft een contractduur van 24 maanden.')
  }

  if (comboApplies(combo)) {
    add(
      'combo',
      'positive',
      `Vodafone-combinatievoordeel: ${eur(combo.monthlyDiscountCents)} per maand, ${eur(r.comboSavingsPeriodCents)} over ${period} maanden. Zonder dit voordeel is het verschil ${
        r.totalSavingsWithoutComboCents >= 0 ? `${eur(r.totalSavingsWithoutComboCents)} besparing` : `${eur(r.totalSavingsWithoutComboCents)} meerkosten`
      }.`,
    )
  } else if (combo.hasVodafone && !combo.eligible) {
    add('combo-check', 'neutral', 'Er is een Vodafone-abonnement, maar de combinatievoordelen zijn nog niet bevestigd en daarom niet meegerekend.')
  }

  if (offer.gift) {
    add('gift', 'neutral', `Bij dit pakket hoort een cadeau (${offer.gift.name || 'actieproduct'}). De winkelwaarde daarvan is niet meegeteld als besparing.`)
  }

  if (offer.validTo < startDate) add('expired', 'warning', `Deze aanbieding was geldig tot ${formatDateNl(offer.validTo)} en is mogelijk verlopen.`)
  else if (offer.validFrom > startDate) add('not-yet', 'warning', `Deze aanbieding is pas geldig vanaf ${formatDateNl(offer.validFrom)}.`)
  if (offer.isExample) add('example', 'warning', 'Dit is een voorbeeldaanbieding met illustratieve prijzen. Controleer de actuele actievoorwaarden.')

  return out
}

/** Korte samenvatting: de drie belangrijkste feiten. */
export function buildSummary(insights: Insight[]): string {
  const order = ['unknown', 'total', 'increase', 'onetime', 'estimate', 'longer']
  const picked = order.map((id) => insights.find((i) => i.id === id)).filter((i): i is Insight => !!i)
  return picked.slice(0, 3).map((i) => i.text).join(' ')
}
