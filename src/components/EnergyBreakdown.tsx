import type { EnergyComparison, EnergyInput, SideCost } from '@/engine/essent'
import { formatRate } from '@/engine/essent'
import { formatDateNl } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { cn } from '@/lib/utils'

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>

/** Volledige berekening van de energievergelijking; klantveilig (geen provisie of interne notities). */
export function EnergyBreakdown({ input, result }: { input: EnergyInput; result: EnergyComparison }) {
  const { usage, current, offer } = input
  const a = result.current
  const b = result.essent
  const rows: { label: string; pick: (c: SideCost) => number; sign?: -1; show?: boolean }[] = [
    { label: `Stroom (${b?.billedKwh ?? usage.electricityKwh ?? 0} kWh)`, pick: (c) => c.electricityCents },
    { label: `Gas (${usage.gasM3 ?? 0} m³)`, pick: (c) => c.gasCents, show: (usage.gasM3 ?? 0) > 0 },
    { label: 'Vaste leveringskosten', pick: (c) => c.fixedCents },
    { label: 'Energiebelasting (los berekend)', pick: (c) => c.energyTaxCents, show: (a?.energyTaxCents ?? 0) + (b?.energyTaxCents ?? 0) > 0 },
    { label: 'Terugleverkosten', pick: (c) => c.feedInFeeCents, show: usage.feedInKwh > 0 },
    { label: 'Terugleververgoeding', pick: (c) => c.feedInCompensationCents, sign: -1, show: usage.feedInKwh > 0 },
    { label: 'Jaarlijkse korting', pick: (c) => c.yearlyDiscountCents, sign: -1, show: (b?.yearlyDiscountCents ?? 0) > 0 },
    { label: 'Netbeheerkosten', pick: (c) => c.networkCents ?? 0, show: result.basis === 'volledig' && !!a },
    { label: 'Vermindering energiebelasting', pick: (c) => c.taxReductionCents ?? 0, sign: -1, show: result.basis === 'volledig' && !!a },
  ]
  const cell = (c: SideCost | null, r: (typeof rows)[number]) => (c ? formatEuro((r.sign ?? 1) * r.pick(c)) : '—')
  const r = offer.rates
  return (
    <div className="space-y-7 text-[15px]">
      <section>
        <H>Kosten per jaar</H>
        {b ? (
          <div className="overflow-x-auto">
            <table className="tnum w-full min-w-[440px]">
              <thead>
                <tr className="text-right text-xs text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Onderdeel</th>
                  <th className="font-medium">{current.supplier || 'Nu'}</th>
                  <th className="font-medium">Essent</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((x) => x.show !== false)
                  .map((x) => (
                    <tr key={x.label} className="border-t text-right">
                      <td className="py-2 text-left text-muted-foreground">{x.label}</td>
                      <td>{a ? cell(a, x) : x.label.startsWith('Netbeheer') || x.label.startsWith('Vermindering') ? 'in jaarbedrag' : '—'}</td>
                      <td>{cell(b, x)}</td>
                    </tr>
                  ))}
                <tr className="border-t-2 text-right font-semibold">
                  <td className="py-2.5 text-left">Totaal per jaar</td>
                  <td>{result.currentYearCents !== null ? formatEuro(result.currentYearCents) : '—'}</td>
                  <td>{formatEuro(b.totalYearCents)}</td>
                </tr>
                {result.yearlySavingsCents !== null && (
                  <tr className={cn('text-right font-semibold', result.yearlySavingsCents >= 0 ? 'text-good' : 'text-warn')}>
                    <td className="py-1 text-left">{result.yearlySavingsCents >= 0 ? 'U betaalt per jaar minder' : 'U betaalt per jaar meer'}</td>
                    <td />
                    <td>{formatEuro(Math.abs(result.yearlySavingsCents))}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {current.mode === 'jaarbedrag' && <p className="mt-2 text-xs text-muted-foreground">De huidige kosten zijn het totaal van uw jaarafrekening en zijn daarom niet per onderdeel uitgesplitst.</p>}
          </div>
        ) : (
          <p className="text-muted-foreground">Er ontbreken nog gegevens voor een berekening.</p>
        )}
      </section>

      {(result.oneTimeCents !== 0 || current.terminationCents > 0) && (
        <section>
          <H>Eenmalig</H>
          <ul className="space-y-1">
            {offer.welcomeBonusCents > 0 && (
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">Welkomstbonus{offer.bonusConditions ? ` (${offer.bonusConditions})` : ''}</span>
                <span className="tnum font-medium">{formatEuro(offer.welcomeBonusCents)}</span>
              </li>
            )}
            {offer.discounts
              .filter((d) => d.kind === 'eenmalig')
              .map((d) => (
                <li key={d.id} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{d.label || 'Eenmalige korting'}</span>
                  <span className="tnum font-medium">{formatEuro(d.amountCents)}</span>
                </li>
              ))}
            {current.terminationCents > 0 && (
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">Opzegkosten huidig contract</span>
                <span className="tnum font-medium">{formatEuro(-current.terminationCents)}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      <section>
        <H>Tarieven van Essent in deze berekening</H>
        <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {r.electricitySingle !== null && <li>Stroom: <span className="tnum font-medium">{formatRate(r.electricitySingle)}</span> per kWh</li>}
          {r.electricityPeak !== null && <li>Stroom normaal: <span className="tnum font-medium">{formatRate(r.electricityPeak)}</span> per kWh</li>}
          {r.electricityOffPeak !== null && <li>Stroom dal: <span className="tnum font-medium">{formatRate(r.electricityOffPeak)}</span> per kWh</li>}
          {r.gas !== null && <li>Gas: <span className="tnum font-medium">{formatRate(r.gas)}</span> per m³</li>}
          {r.fixedElectricityMonthlyCents !== null && <li>Vaste kosten stroom: <span className="tnum font-medium">{formatEuro(r.fixedElectricityMonthlyCents)}</span> per maand</li>}
          {r.fixedGasMonthlyCents !== null && (usage.gasM3 ?? 0) > 0 && <li>Vaste kosten gas: <span className="tnum font-medium">{formatEuro(r.fixedGasMonthlyCents)}</span> per maand</li>}
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          Tarieven {r.includesVat ? 'inclusief' : 'exclusief'} btw en {r.includesEnergyTax ? 'inclusief' : 'exclusief'} energiebelasting. {offer.contractType === 'vast' ? `Vast voor ${offer.contractMonths} maanden.` : `Contracttype: ${offer.contractType}.`}
          {offer.validTo ? ` Aanbod geldig tot en met ${formatDateNl(offer.validTo)}.` : ''}
          {offer.verifiedOn ? ` Tarieven gecontroleerd op ${formatDateNl(offer.verifiedOn)}.` : ''}
        </p>
        {offer.eligibility && <p className="mt-1 text-sm text-muted-foreground">Voorwaarden: {offer.eligibility}</p>}
      </section>

      <section className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
        <h3 className="mb-1.5 font-semibold text-foreground">Aannames</h3>
        <ul className="list-disc space-y-1 pl-4">
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>Dit is een schatting op basis van de ingevulde gegevens en geen offerte. De voorwaarden en tarieven van Essent zijn leidend.</li>
        </ul>
      </section>
    </div>
  )
}

/** Korte tekst voor WhatsApp; verstuurt niets zelf. */
export function energyShareText(input: EnergyInput, result: EnergyComparison): string {
  const eur = (c: number) => formatEuro(c, { plainSpace: true })
  const lines = [`*Energievergelijking* (${formatDateNl(input.today)})`, '', `Verbruik: ${input.usage.electricityKwh ?? '?'} kWh stroom${(input.usage.gasM3 ?? 0) > 0 ? ` en ${input.usage.gasM3} m³ gas` : ''} per jaar`]
  if (result.currentYearCents !== null) lines.push(`Nu (${input.current.supplier || 'huidige leverancier'}): ${eur(result.currentYearCents)} per jaar`)
  if (result.essent) lines.push(`Essent – ${input.offer.name}: ${eur(result.essent.totalYearCents)} per jaar`)
  if (result.yearlySavingsCents !== null) lines.push(result.yearlySavingsCents >= 0 ? `Geschatte besparing: ${eur(result.yearlySavingsCents)} per jaar` : `Geschat duurder: ${eur(-result.yearlySavingsCents)} per jaar`)
  if (input.offer.welcomeBonusCents > 0) lines.push(`Eenmalige welkomstbonus: ${eur(input.offer.welcomeBonusCents)}${input.offer.bonusConditions ? ` (${input.offer.bonusConditions})` : ''}`)
  lines.push('', result.basis === 'leverancier' ? 'Kosten bij de leverancier incl. energiebelasting en btw; netbeheer en belastingvermindering zijn bij elke leverancier gelijk en niet meegeteld.' : 'Inclusief energiebelasting, btw, netbeheerkosten en belastingvermindering.')
  lines.push(`${input.offer.contractType === 'vast' ? `Tarieven ${input.offer.contractMonths} maanden vast` : `Contract: ${input.offer.contractType}, tarieven kunnen wijzigen`}. Schatting bij gelijk verbruik; de voorwaarden van Essent zijn leidend.`)
  return lines.join('\n')
}
