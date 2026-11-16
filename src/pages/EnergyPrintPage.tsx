import { ArrowLeft, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EnergyBreakdown } from '@/components/EnergyBreakdown'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/card'
import { formatDateNl } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { useData } from '@/store/data'
import { useEnergyComparison } from '@/store/energy'

/** Afdrukbaar klantvoorstel energie (ook op te slaan als PDF via het afdrukvenster). */
export default function EnergyPrintPage() {
  const navigate = useNavigate()
  const { input, result, offer } = useEnergyComparison()
  const advisorName = useData((s) => s.settings.advisorName)
  if (!input || !result || !offer || result.blocked || result.yearlySavingsCents === null) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState icon={<Printer />} title="Nog niets om af te drukken" text="Maak eerst een volledige vergelijking." action={<Button variant="primary" onClick={() => navigate('/energie')}>Naar de vergelijking</Button>} />
      </div>
    )
  }
  const s = result.yearlySavingsCents
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
            <h1 className="text-3xl font-semibold tracking-tight">Persoonlijke energievergelijking</h1>
            <p className="text-sm text-muted-foreground">
              {input.current.supplier || 'Huidige leverancier'} vergeleken met Essent · {offer.name}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {formatDateNl(input.today)}
            {advisorName && <div>Adviseur: {advisorName}</div>}
          </div>
        </header>
        <section className={`my-6 rounded-xl p-5 ${s >= 0 ? 'bg-good-soft' : 'bg-warn-soft'}`}>
          <div className="text-sm text-muted-foreground">{s >= 0 ? 'Geschatte besparing per jaar' : 'Geschat duurder per jaar'}</div>
          <div className={`tnum text-4xl font-semibold ${s >= 0 ? 'text-good' : 'text-warn'}`}>{formatEuro(Math.abs(s))}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Bij {input.usage.electricityKwh} kWh stroom{(input.usage.gasM3 ?? 0) > 0 ? ` en ${input.usage.gasM3} m³ gas` : ''} per jaar
            {input.usage.feedInKwh > 0 ? ` en ${input.usage.feedInKwh} kWh teruglevering` : ''}.
          </div>
        </section>
        <EnergyBreakdown input={input} result={result} />
      </article>
    </div>
  )
}
