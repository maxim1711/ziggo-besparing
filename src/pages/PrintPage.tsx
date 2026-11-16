import { ArrowLeft, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { InsightList } from '@/components/InsightList'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/card'
import { assumptions, priceSegments, segmentLabel, validityText } from '@/engine/customerView'
import { formatDateNl } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { kindLabel } from '@/lib/utils'
import { useData } from '@/store/data'
import { useComparison } from '@/store/draft'

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 border-b border-dashed py-1.5 text-sm">
    <span className="text-muted-foreground">{k}</span>
    <span className="tnum text-right font-semibold">{v}</span>
  </div>
)

/** Afdrukvriendelijk voorstel (alternatief voor de PDF); alleen klantveilige gegevens. */
export default function PrintPage() {
  const navigate = useNavigate()
  const { active } = useComparison()
  const advisorName = useData((s) => s.settings.advisorName)
  if (!active) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState icon={<Printer />} title="Nog niets om af te drukken" text="Kies eerst een aanbieding in het adviesscherm." action={<Button variant="primary" onClick={() => navigate('/ziggo')}>Naar nieuw advies</Button>} />
      </div>
    )
  }
  const v = active.view
  const { current, offer, result: r } = v
  const pos = r.totalSavingsCents >= 0
  const diff = (a: number, b: number) => (a - b >= 0 ? `${formatEuro(a - b)} voordeel` : `${formatEuro(b - a)} duurder`)
  return (
    <div className="h-full overflow-y-auto bg-muted print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card/90 px-4 py-3 backdrop-blur">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft /> Terug
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer /> Afdrukken of opslaan als PDF
        </Button>
      </div>
      <article className="print-page mx-auto my-6 max-w-[800px] rounded-2xl border bg-white p-10 shadow-card">
        <header className="flex items-start justify-between gap-4 border-b-4 border-primary pb-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Persoonlijk overstapadvies</h1>
            <p className="text-sm text-muted-foreground">Internet en televisie – vergelijking van uw huidige en nieuwe abonnement</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {formatDateNl(v.startDate)}
            {advisorName && <div>Adviseur: {advisorName}</div>}
          </div>
        </header>

        <section className={`mt-6 rounded-xl p-5 ${!r.currentKnown ? 'bg-muted' : pos ? 'bg-good-soft' : 'bg-warn-soft'}`}>
          <div className="text-sm text-muted-foreground">{!r.currentKnown ? `Kosten nieuw abonnement over ${r.period} maanden` : pos ? `Verwachte besparing over ${r.period} maanden` : `Meerkosten over ${r.period} maanden`}</div>
          <div className={`tnum text-4xl font-semibold ${!r.currentKnown ? '' : pos ? 'text-good' : 'text-warn'}`}>{formatEuro(r.currentKnown ? Math.abs(r.totalSavingsCents) : r.newPeriodCents)}</div>
        </section>

        <section className="mt-6 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 font-semibold">Uw huidige abonnement</h2>
            <Row k="Aanbieder" v={current.provider || '—'} />
            {current.packageName && <Row k="Pakket" v={current.packageName} />}
            <Row k="Internetsnelheid" v={current.speedMbps ? `${current.speedMbps} Mbit/s` : '—'} />
            <Row k="Televisie" v={current.hasTv ? 'Ja' : 'Nee'} />
            <Row k="Maandbedrag nu" v={r.currentKnown ? formatEuro(r.months[0].currentCents) : 'onbekend'} />
            {current.contractEndDate && <Row k="Einddatum contract" v={formatDateNl(current.contractEndDate)} />}
          </div>
          <div>
            <h2 className="mb-1 font-semibold">Uw nieuwe abonnement</h2>
            <Row k="Aanbieder" v={offer.provider} />
            <Row k="Pakket" v={offer.name} />
            <Row k="Internetsnelheid" v={`${offer.speedMbps} Mbit/s`} />
            <Row k="Type" v={kindLabel(offer.kind)} />
            <Row k="Contractduur" v={`${offer.contractMonths} maanden`} />
            {offer.promoName && <Row k="Welkomstactie" v={offer.promoName} />}
            {priceSegments(r).map((s) => (
              <Row key={s.from} k={`${segmentLabel(s)}${s.from > offer.contractMonths ? ' (schatting)' : ''}`} v={`${formatEuro(s.cents)} p/m`} />
            ))}
            {offer.promoMonths > 0 && <Row k="Regulier tarief na actie" v={`${formatEuro(offer.regularMonthlyCents)} p/m`} />}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 font-semibold">Kostenoverzicht</h2>
          <table className="tnum w-full text-sm">
            <thead>
              <tr className="border-b text-right text-xs text-muted-foreground">
                <th className="py-1.5 text-left font-medium">Periode</th>
                <th className="font-medium">Huidig</th>
                <th className="font-medium">Nieuw</th>
                <th className="font-medium">Verschil</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Eerste 12 maanden (incl. eenmalige kosten)', r.current12Cents, r.new12Cents] as const,
                ...(r.period === 24 ? [['Maand 13–24', r.current24Cents - r.current12Cents, r.new24Cents - r.new12Cents] as const] : []),
                [`Totaal over ${r.period} maanden`, r.currentPeriodCents, r.newPeriodCents] as const,
              ].map(([label, a, b], i, arr) => (
                <tr key={label} className={`border-b text-right ${i === arr.length - 1 ? 'font-semibold' : ''}`}>
                  <td className="py-2 text-left">{label}</td>
                  <td>{r.currentKnown ? formatEuro(a) : '—'}</td>
                  <td>{formatEuro(b)}</td>
                  <td className={r.currentKnown ? (a - b >= 0 ? 'text-good' : 'text-warn') : ''}>{r.currentKnown ? diff(a, b) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.oneTime.totalCents > 0 && <p className="mt-2 text-xs text-muted-foreground">Waarvan eenmalige kosten: {formatEuro(r.oneTime.totalCents)}.</p>}
        </section>

        {offer.gift && (
          <section className="mt-6 rounded-xl border p-4">
            <h2 className="font-semibold">Uw cadeau: {offer.gift.name || 'actieproduct'}</h2>
            {offer.gift.description && <p className="text-sm">{offer.gift.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {offer.gift.retailValueCents ? `Geadverteerde waarde: ${formatEuro(offer.gift.retailValueCents)}. ` : ''}De waarde van het cadeau is geen geldbedrag dat u bespaart en is niet verrekend in de kosten.
              {offer.gift.conditions && ` Voorwaarden: ${offer.gift.conditions}`}
            </p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 font-semibold">Toelichting</h2>
          <InsightList insights={v.insights} />
        </section>

        <section className="mt-6 text-xs text-muted-foreground">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Voorwaarden en aannames</h2>
          <p>{validityText(offer)}</p>
          {offer.conditions && <p className="mt-1">{offer.conditions}</p>}
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {assumptions(v).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  )
}
