import { formatDateNl } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { assumptions, priceSegments, segmentLabel, type CustomerView } from '@/engine/customerView'
import { kindLabel } from '@/lib/utils'

const eur = (c: number) => formatEuro(c, { plainSpace: true })
/** Standaard-PDF-lettertypen kennen alleen WinAnsi: vervang tekens daarbuiten. */
const clean = (s: string) => s.replace(/[  ]/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/–/g, '-').replace(/≥/g, '>=')

const PURPLE: [number, number, number] = [91, 33, 182]
const INK: [number, number, number] = [30, 22, 50]
const MUTED: [number, number, number] = [107, 100, 128]
const GOOD: [number, number, number] = [15, 138, 95]
const WARN: [number, number, number] = [194, 65, 12]
const LINE: [number, number, number] = [228, 224, 238]

/** Bouwt een vector-PDF (geen schermafdruk) met uitsluitend klantveilige gegevens. */
export async function generateProposalPdf(view: CustomerView, advisorName: string): Promise<{ blob: Blob; filename: string }> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 18
  const CW = W - 2 * M
  let y = 0
  const { current, offer, result, combo } = view

  const text = (s: string, x: number, yy: number, o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center'; maxWidth?: number } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.setFontSize(o.size ?? 10)
    doc.setTextColor(...(o.color ?? INK))
    doc.text(clean(s), x, yy, { align: o.align ?? 'left', maxWidth: o.maxWidth })
  }
  const para = (s: string, x: number, width: number, size = 9.5, color = INK): void => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(clean(s), width) as string[]
    const lh = size * 0.45
    ensure(lines.length * lh + 1)
    doc.setTextColor(...color)
    doc.text(lines, x, y)
    y += lines.length * lh + 1.2
  }
  const footer = () => {
    doc.setDrawColor(...LINE)
    doc.line(M, 284, W - M, 284)
    text('Onafhankelijk overstapadvies - indicatieve berekening, geen officiële uiting van de aanbieder.', M, 289, { size: 7.5, color: MUTED })
    text(`Pagina ${doc.getNumberOfPages()}`, W - M, 289, { size: 7.5, color: MUTED, align: 'right' })
  }
  const ensure = (h: number) => {
    if (y + h > 278) {
      footer()
      doc.addPage()
      y = 20
    }
  }
  const heading = (s: string) => {
    ensure(16)
    y += 4
    text(s.toUpperCase(), M, y, { size: 8, bold: true, color: PURPLE })
    y += 2
    doc.setDrawColor(...LINE)
    doc.line(M, y, W - M, y)
    y += 6
  }
  const kv = (x: number, w: number, yy: number, k: string, v: string) => {
    text(k, x, yy, { size: 9, color: MUTED })
    text(v, x + w, yy, { size: 9.5, bold: true, align: 'right' })
  }

  // Kop
  doc.setFillColor(...PURPLE)
  doc.rect(0, 0, W, 5, 'F')
  y = 22
  text('Persoonlijk overstapadvies', M, y, { size: 20, bold: true })
  text(formatDateNl(view.startDate), W - M, y - 4, { size: 9.5, color: MUTED, align: 'right' })
  if (advisorName.trim()) text(`Adviseur: ${advisorName.trim()}`, W - M, y + 1, { size: 9.5, color: MUTED, align: 'right' })
  y += 6
  text('Internet en televisie - vergelijking van uw huidige en nieuwe abonnement', M, y, { size: 10, color: MUTED })
  y += 9

  // Kernresultaat
  const saving = result.totalSavingsCents
  const tone = !result.currentKnown ? MUTED : saving >= 0 ? GOOD : WARN
  doc.setFillColor(248, 246, 252)
  doc.roundedRect(M, y, CW, 30, 3, 3, 'F')
  doc.setFillColor(...tone)
  doc.roundedRect(M, y, 1.6, 30, 0.8, 0.8, 'F')
  const heroLabel = !result.currentKnown ? `Kosten nieuw abonnement over ${result.period} maanden` : saving >= 0 ? `Verwachte besparing over ${result.period} maanden` : `Meerkosten over ${result.period} maanden`
  text(heroLabel, M + 8, y + 9, { size: 10, color: MUTED })
  text(eur(result.currentKnown ? Math.abs(saving) : result.newPeriodCents), M + 8, y + 22, { size: 24, bold: true, color: tone })
  text('Gemiddeld per maand (nieuw)', W - M - 6, y + 9, { size: 9, color: MUTED, align: 'right' })
  text(eur(result.avgEffectiveMonthlyCents), W - M - 6, y + 17, { size: 13, bold: true, align: 'right' })
  text('inclusief eenmalige kosten', W - M - 6, y + 23, { size: 8, color: MUTED, align: 'right' })
  y += 36

  // Twee kolommen
  heading('Abonnementen')
  const colW = (CW - 10) / 2
  const xL = M
  const xR = M + colW + 10
  const top = y
  text('Uw huidige abonnement', xL, y, { size: 11, bold: true })
  text('Uw nieuwe abonnement', xR, y, { size: 11, bold: true })
  y += 5.5
  const fit = (s: string) => (s.length > 46 ? s.slice(0, 45) + '...' : s)
  text(fit([current.provider || 'Huidige aanbieder', current.packageName].filter(Boolean).join(' · ')), xL, y, { size: 9.5, color: MUTED })
  text(fit(`${offer.provider} · ${offer.name}`), xR, y, { size: 9.5, color: MUTED })
  y += 7
  const left: [string, string][] = [
    ['Internetsnelheid', current.speedMbps ? `${current.speedMbps} Mbit/s` : '-'],
    ['Televisie', current.hasTv ? `Ja${current.tvReceivers > 1 ? `, ${current.tvReceivers} ontvangers` : ''}` : 'Nee'],
    ['Maandbedrag nu', result.currentKnown ? eur(result.months[0].currentCents) : 'onbekend'],
    ...(current.contractEndDate ? ([['Einddatum contract', formatDateNl(current.contractEndDate)]] as [string, string][]) : []),
  ]
  const segs = priceSegments(result)
  const right: [string, string][] = [
    ...(offer.includes && offer.includes.length > 1 ? ([['Inbegrepen', `${offer.includes.length} onderdelen`]] as [string, string][]) : []),
    ['Internetsnelheid', `${offer.speedMbps} Mbit/s`],
    ['Type', kindLabel(offer.kind)],
    ['Contractduur', `${offer.contractMonths} maanden`],
    ...segs.map((s): [string, string] => [`${segmentLabel(s)}${s.from > offer.contractMonths ? ' (schatting)' : ''}`, `${eur(s.cents)} p/m`]),
    ...(offer.promoMonths > 0 ? ([['Regulier tarief na actie', `${eur(offer.regularMonthlyCents)} p/m`]] as [string, string][]) : []),
  ]
  const rows = Math.max(left.length, right.length)
  for (let i = 0; i < rows; i++) {
    if (left[i]) kv(xL, colW, y, left[i][0], left[i][1])
    if (right[i]) kv(xR, colW, y, right[i][0], right[i][1])
    y += 6
  }
  doc.setDrawColor(...LINE)
  doc.line(M + colW + 5, top - 3, M + colW + 5, y - 3)

  // Kostenoverzicht
  heading('Kostenoverzicht')
  const cols = [M + 100, M + 132, W - M]
  text('Huidig', cols[0], y, { size: 8.5, color: MUTED, align: 'right' })
  text('Nieuw', cols[1], y, { size: 8.5, color: MUTED, align: 'right' })
  text('Verschil', cols[2], y, { size: 8.5, color: MUTED, align: 'right' })
  y += 6
  const row = (label: string, cur: number | null, neu: number, bold = false) => {
    text(label, M, y, { size: 9.5, bold })
    text(cur === null ? '-' : eur(cur), cols[0], y, { size: 9.5, bold, align: 'right' })
    text(eur(neu), cols[1], y, { size: 9.5, bold, align: 'right' })
    if (cur !== null) {
      const d = cur - neu
      text(d >= 0 ? `${eur(d)} voordeel` : `${eur(-d)} duurder`, cols[2], y, { size: 9.5, bold, align: 'right', color: d >= 0 ? GOOD : WARN })
    }
    y += 6.5
  }
  const k = result.currentKnown
  row('Eerste 12 maanden (incl. eenmalige kosten)', k ? result.current12Cents : null, result.new12Cents)
  if (result.period === 24) row('Maand 13-24', k ? result.current24Cents - result.current12Cents : null, result.new24Cents - result.new12Cents)
  doc.line(M, y - 3.5, W - M, y - 3.5)
  y += 1
  row(`Totaal over ${result.period} maanden`, k ? result.currentPeriodCents : null, result.newPeriodCents, true)
  if (result.oneTime.totalCents > 0) {
    const p = [
      result.oneTime.activationCents && `activatie ${eur(result.oneTime.activationCents)}`,
      result.oneTime.installationCents && `installatie ${eur(result.oneTime.installationCents)}`,
      result.oneTime.equipmentCents && `apparatuur ${eur(result.oneTime.equipmentCents)}`,
      result.oneTime.cancellationCents && `beëindiging huidig contract ${eur(result.oneTime.cancellationCents)}`,
    ].filter(Boolean)
    para(`Waarvan eenmalige kosten: ${eur(result.oneTime.totalCents)} (${p.join(', ')}).`, M, CW, 8.5, MUTED)
  }
  if (result.comboSavingsPeriodCents > 0) {
    para(`Vodafone-combinatievoordeel: ${eur(combo.monthlyDiscountCents)} per maand (${eur(result.comboSavingsPeriodCents)} over de periode), al verwerkt in de bedragen hierboven. Zonder dit voordeel: ${result.totalSavingsWithoutComboCents >= 0 ? `${eur(result.totalSavingsWithoutComboCents)} besparing` : `${eur(-result.totalSavingsWithoutComboCents)} meerkosten`}.${combo.extraBenefits ? ` Extra: ${combo.extraBenefits}.` : ''}`, M, CW, 8.5, MUTED)
  }

  if (offer.gift) {
    heading('Uw cadeau')
    text(offer.gift.name || 'Actieproduct', M, y, { size: 11, bold: true })
    y += 5.5
    if (offer.gift.description) para(offer.gift.description, M, CW)
    if (offer.gift.retailValueCents) para(`Adviesprijs volgens de aanbieder: ${eur(offer.gift.retailValueCents)}. Dit is geen geldbedrag dat u bespaart en is niet verrekend in de kosten.`, M, CW, 8.5, MUTED)
    if (offer.gift.conditions) para(`Voorwaarden: ${offer.gift.conditions}`, M, CW, 8.5, MUTED)
  }

  heading('Toelichting')
  for (const i of view.insights) {
    ensure(8)
    doc.setFillColor(...(i.tone === 'positive' ? GOOD : i.tone === 'neutral' ? MUTED : WARN))
    doc.circle(M + 1, y - 1.1, 0.8, 'F')
    para(i.text, M + 5, CW - 5)
  }

  heading('Voorwaarden en aannames')
  para(`Aanbieding geldig van ${formatDateNl(offer.validFrom)} tot en met ${formatDateNl(offer.validTo)} (versie ${offer.version}).`, M, CW, 9)
  if (offer.conditions.trim()) para(offer.conditions.trim(), M, CW, 9)
  for (const a of assumptions(view)) para(`- ${a}`, M, CW, 8.5, MUTED)

  footer()
  return { blob: doc.output('blob'), filename: `overstapadvies-${view.startDate}.pdf` }
}

export async function downloadProposalPdf(view: CustomerView, advisorName: string) {
  const { blob, filename } = await generateProposalPdf(view, advisorName)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
