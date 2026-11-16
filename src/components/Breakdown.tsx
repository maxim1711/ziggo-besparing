import { MonthlyTimeline } from '@/components/charts/Charts'
import { InsightList } from '@/components/InsightList'
import type { PriceLine } from '@/engine/pricing'
import { assumptions, priceSegments, segmentLabel, type CustomerView } from '@/engine/customerView'
import { formatDateNl } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { cn } from '@/lib/utils'

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
const Line = ({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: 'good' | 'warn' }) => (
  <div className={cn('flex items-baseline justify-between gap-4 border-b border-dashed py-2 last:border-0', strong && 'font-semibold')}>
    <span className={strong ? '' : 'text-muted-foreground'}>{k}</span>
    <span className={cn('tnum text-right', !strong && 'font-medium', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn')}>{v}</span>
  </div>
)

/** Volledige berekening ("Bekijk berekening"): klantveilig, dus zonder provisie of notities. */
export function Breakdown({ view, lines }: { view: CustomerView; lines: PriceLine[] }) {
  const { result: r, offer, current, combo } = view
  const known = r.currentKnown
  const diff = (a: number, b: number) => (a - b >= 0 ? `${formatEuro(a - b)} minder` : `${formatEuro(b - a)} meer`)
  const monthly = lines.filter((l) => l.kind !== 'onetime')
  const mobile = combo.hasVodafone && combo.eligible ? (combo.mobileInvoiceDiscountCents ?? 0) : 0
  return (
    <div className="space-y-7 text-[15px]">
      <section>
        <H>Uw maandbedrag</H>
        {monthly.map((l) => (
          <Line key={l.kind + l.label} k={`${l.label}${l.note ? ` (${l.note})` : ''}`} v={l.kind === 'inbegrepen' ? 'Inbegrepen' : `${formatEuro(l.cents)} p/m`} />
        ))}
        {combo.hasVodafone && combo.eligible && combo.monthlyDiscountCents > 0 && <Line k="Vodafone-combinatievoordeel op uw Ziggo-rekening" v={`${formatEuro(-combo.monthlyDiscountCents)} p/m`} />}
        {priceSegments(r).map((s) => (
          <Line key={s.from} strong k={`${segmentLabel(s)}${s.from > offer.contractMonths ? ' (schatting)' : ''}`} v={`${formatEuro(s.cents)} p/m`} />
        ))}
      </section>

      {mobile > 0 && (
        <section className="rounded-2xl border p-4">
          <H>Apart: voordeel op uw Vodafone-rekening</H>
          <p>
            <strong className="tnum">{formatEuro(mobile)}</strong> korting per maand op uw mobiele abonnement ({formatEuro(mobile * r.period)} over {r.period} maanden).
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Dit staat op de rekening van Vodafone, niet op die van {offer.provider}. Het is daarom niet meegeteld in uw maandbedrag of in het verschil hieronder.</p>
        </section>
      )}

      <section>
        <H>Eenmalige kosten</H>
        {r.oneTime.totalCents === 0 ? (
          <p className="text-muted-foreground">Geen eenmalige kosten.</p>
        ) : (
          <>
            {r.oneTime.activationCents > 0 && <Line k="Activatie" v={formatEuro(r.oneTime.activationCents)} />}
            {r.oneTime.installationCents > 0 && <Line k="Installatie" v={formatEuro(r.oneTime.installationCents)} />}
            {r.oneTime.equipmentCents > 0 && <Line k="Apparatuur" v={formatEuro(r.oneTime.equipmentCents)} />}
            {r.oneTime.cancellationCents > 0 && <Line k="Beëindigen huidig contract" v={formatEuro(r.oneTime.cancellationCents)} />}
          </>
        )}
      </section>

      <section>
        <H>Vergelijking met uw huidige abonnement</H>
        {known ? (
          <div className="overflow-x-auto">
            <table className="tnum w-full min-w-[420px]">
              <thead>
                <tr className="text-right text-xs text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Periode</th>
                  <th className="font-medium">{current.provider || 'Nu'}</th>
                  <th className="font-medium">Nieuw</th>
                  <th className="font-medium">Verschil</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Eerste 12 maanden', r.current12Cents, r.new12Cents] as const,
                  ...(r.period === 24 ? [['Maand 13–24', r.current24Cents - r.current12Cents, r.new24Cents - r.new12Cents] as const] : []),
                  [`Totaal ${r.period} maanden`, r.currentPeriodCents, r.newPeriodCents] as const,
                ].map(([label, a, b], i, arr) => (
                  <tr key={label} className={cn('border-t text-right', i === arr.length - 1 && 'font-semibold')}>
                    <td className="py-2.5 text-left">{label}</td>
                    <td>{formatEuro(a)}</td>
                    <td>{formatEuro(b)}</td>
                    <td className={a - b >= 0 ? 'text-good' : 'text-warn'}>{diff(a, b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">Eenmalige kosten zijn meegeteld in de eerste 12 maanden.</p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Uw huidige maandbedrag is niet ingevuld. Kosten van het nieuwe abonnement over {r.period} maanden: <strong className="tnum text-foreground">{formatEuro(r.newPeriodCents)}</strong>.
          </p>
        )}
      </section>

      <section>
        <H>Maandbedrag per maand</H>
        <MonthlyTimeline result={r} currentName={current.provider || 'Nu'} newName={offer.provider} height={200} />
      </section>

      <section>
        <H>Goed om te weten</H>
        <InsightList insights={view.insights} />
      </section>

      <section className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
        <h3 className="mb-1.5 font-semibold text-foreground">Voorwaarden en aannames</h3>
        <p>
          {offer.promoValidTo ? `Actie geldig tot en met ${formatDateNl(offer.promoValidTo)}. ` : ''}Contractduur {offer.contractMonths} maanden.{offer.pricesVerifiedOn ? ` Prijzen gecontroleerd op ${formatDateNl(offer.pricesVerifiedOn)}.` : ''}
        </p>
        {offer.conditions && <p className="mt-1">{offer.conditions}</p>}
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          {assumptions(view).map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
