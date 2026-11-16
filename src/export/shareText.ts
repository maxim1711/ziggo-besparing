import { formatDateNl } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { priceSegments, segmentLabel, type CustomerView } from '@/engine/customerView'
import { kindLabel } from '@/lib/utils'

const eur = (c: number) => formatEuro(c, { plainSpace: true })

/** Beknopte, niet-misleidende samenvatting voor WhatsApp of e-mail. */
export function buildShareText(view: CustomerView): string {
  const { current, offer, result, combo } = view
  const lines: string[] = [`*Overstapadvies* (${formatDateNl(view.startDate)})`, '']
  if (result.currentKnown) lines.push(`Huidig: ${current.provider || 'huidige aanbieder'}, ${eur(result.months[0].currentCents)} per maand`)
  lines.push(`Voorstel: ${offer.provider} ${offer.name} (${kindLabel(offer.kind)}, ${offer.speedMbps} Mbit/s, contract ${offer.contractMonths} maanden)`)
  for (const s of priceSegments(result)) lines.push(`• ${segmentLabel(s)}: ${eur(s.cents)} per maand${s.from > offer.contractMonths ? ' (schatting)' : ''}`)
  if (result.oneTime.totalCents > 0) lines.push(`• Eenmalige kosten: ${eur(result.oneTime.totalCents)}`)
  lines.push('')
  lines.push(`Kosten over ${result.period} maanden: ${eur(result.newPeriodCents)}${result.currentKnown ? ` (nu: ${eur(result.currentPeriodCents)})` : ''}`)
  if (result.currentKnown) {
    if (result.totalSavingsCents > 0) lines.push(`Verwachte besparing: ${eur(result.totalSavingsCents)}`)
    else if (result.totalSavingsCents < 0) lines.push(`Meerkosten ten opzichte van nu: ${eur(-result.totalSavingsCents)}`)
    else lines.push('De kosten zijn gelijk aan uw huidige abonnement.')
  }
  if (result.comboSavingsPeriodCents > 0) lines.push(`Waarvan Vodafone-combinatievoordeel: ${eur(result.comboSavingsPeriodCents)}${combo.extraBenefits ? ` (+ ${combo.extraBenefits})` : ''}`)
  if (offer.gift) lines.push(`Cadeau volgens actievoorwaarden: ${offer.gift.name || 'actieproduct'} (waarde niet meegerekend als besparing)`)
  lines.push('')
  lines.push(`Aanbieding geldig t/m ${formatDateNl(offer.validTo)}.${offer.isExample ? ' Let op: voorbeeldprijzen, nog te controleren.' : ''}`)
  lines.push('Indicatieve berekening incl. btw; de actievoorwaarden van de aanbieder zijn leidend.')
  return lines.join('\n')
}

/** Alleen na een tik van de gebruiker: deelmenu of WhatsApp met vooringevulde tekst. Verstuurt nooit zelf. */
export async function shareText(text: string): Promise<'shared' | 'whatsapp' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  return 'whatsapp'
}
