import { ArrowLeft, ArrowRight, Info, Printer, Send } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatedMoney } from '@/components/AnimatedMoney'
import { EnergyBreakdown, energyShareText } from '@/components/EnergyBreakdown'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { formatDateNl } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { shareText } from '@/export/shareText'
import { cn } from '@/lib/utils'
import { useEnergyComparison } from '@/store/energy'

const eur = (c: number) => formatEuro(c, { decimals: 'auto' })

/** Klantpresentatie energie: één rustig scherm, zonder provisie of interne notities. */
export default function EnergyPresentationPage() {
  const navigate = useNavigate()
  const { input, result, offer } = useEnergyComparison()
  const [calc, setCalc] = useState(false)
  const [next, setNext] = useState(false)
  if (!input || !result || !offer || result.blocked || result.yearlySavingsCents === null) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState icon={<Info />} title="Nog niets om te tonen" text={result?.issues.find((i) => i.blocking)?.message ?? 'Maak eerst een vergelijking.'} action={<Button variant="primary" onClick={() => navigate('/energie')}>Naar de vergelijking</Button>} />
      </div>
    )
  }
  const s = result.yearlySavingsCents
  const supplier = input.current.supplier || 'uw huidige leverancier'
  const fixed = offer.contractType === 'vast'
  const max = Math.max(result.currentYearCents!, result.essent!.totalYearCents, 1)
  const bars = [
    { label: `Nu bij ${supplier}`, cents: result.currentYearCents!, cls: 'bg-slate-400' },
    { label: 'Met Essent', cents: result.essent!.totalYearCents, cls: 'bg-primary' },
  ]
  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto bg-white">
      <header className="safe-t px-4 pt-3 sm:px-6">
        <button onClick={() => navigate('/energie')} className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground/80 hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Aanbod aanpassen
        </button>
      </header>

      <main className="mx-auto grid w-full max-w-[1180px] flex-1 animate-fade-up content-center items-center gap-8 px-6 py-6 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        <section>
          <div className="text-sm font-semibold uppercase tracking-[.16em] text-primary">Uw energiekosten per jaar</div>
          <h1 className="mt-2 text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.1] tracking-tight">Essent · {offer.name}</h1>
          <div className="mt-8 space-y-6">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-xl text-muted-foreground">{b.label}</span>
                  <span className="tnum text-[clamp(34px,4.6vw,56px)] font-semibold leading-none tracking-tight">{formatEuro(b.cents)}</span>
                </div>
                <div className="mt-2 h-4 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', b.cls)} style={{ width: `${Math.max(3, (b.cents / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary-soft px-4 py-1.5 text-lg font-semibold text-primary">{fixed ? `${offer.contractMonths} maanden vast` : `${offer.contractType.charAt(0).toUpperCase()}${offer.contractType.slice(1)} contract`}</span>
            {!fixed && <span className="text-base text-muted-foreground">tarieven kunnen wijzigen</span>}
          </div>
          <p className="mt-4 text-base text-muted-foreground">
            Schatting bij {input.usage.electricityKwh} kWh stroom{(input.usage.gasM3 ?? 0) > 0 ? ` en ${input.usage.gasM3} m³ gas` : ''} per jaar. {result.basis === 'volledig' ? 'Inclusief belastingen en netbeheerkosten.' : 'Kosten bij de leverancier, inclusief belastingen. Netbeheerkosten komen er bij elke leverancier bij.'}
          </p>
        </section>

        <section className="space-y-4">
          {s > 0 ? (
            <div className="rounded-3xl bg-good-soft p-7">
              <div className="text-lg font-medium">Uw geschatte besparing per jaar</div>
              <AnimatedMoney cents={s} decimals="auto" className="mt-1 block text-[clamp(56px,7vw,88px)] font-semibold leading-none tracking-tighter text-good" />
              <p className="mt-4 text-lg text-muted-foreground">Dat is ongeveer {eur(result.monthlyEquivalentCents!)} per maand.</p>
            </div>
          ) : s < 0 ? (
            <div className="rounded-3xl bg-warn-soft p-7">
              <div className="text-lg font-medium">Dit kost u meer dan nu</div>
              <div className="mt-1 text-[clamp(44px,5.5vw,68px)] font-semibold leading-none tracking-tighter text-warn">
                <AnimatedMoney cents={-s} decimals="auto" /> meer
              </div>
              <p className="mt-3 text-lg">per jaar, ongeveer {eur(-result.monthlyEquivalentCents!)} per maand</p>
            </div>
          ) : (
            <div className="rounded-3xl bg-muted p-7 text-2xl font-semibold">U betaalt per jaar ongeveer hetzelfde als nu</div>
          )}
          {offer.welcomeBonusCents > 0 && (
            <div className="rounded-3xl border bg-card p-5">
              <div className="text-sm font-semibold uppercase tracking-wider text-accent">Eenmalige welkomstbonus</div>
              <div className="tnum text-3xl font-semibold">{eur(offer.welcomeBonusCents)}</div>
              <p className="mt-1 text-sm text-muted-foreground">{offer.bonusConditions || 'Volgens de actievoorwaarden.'} Niet meegeteld in de besparing per jaar.</p>
            </div>
          )}
          {input.current.terminationCents > 0 && <p className="rounded-2xl border px-5 py-3 text-base text-muted-foreground">Let op: eenmalig {eur(input.current.terminationCents)} opzegkosten bij uw huidige leverancier.</p>}
        </section>
      </main>

      <footer className="safe-b mx-auto w-full max-w-[1180px] px-6 pb-5 sm:px-10">
        <div className="flex flex-col-reverse items-center justify-between gap-2 sm:flex-row">
          <button onClick={() => setCalc(true)} className="min-h-[48px] px-2 text-base font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Bekijk berekening
          </button>
          <Button variant="primary" size="lg" className="h-16 w-full px-8 text-lg sm:w-auto" onClick={() => setNext(true)}>
            Verder met dit aanbod <ArrowRight />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground sm:text-left">
          Onafhankelijk advies, geen officiële uiting van Essent. Schatting bij gelijk verbruik, geen offerte.{offer.validTo ? ` Aanbod geldig t/m ${formatDateNl(offer.validTo)}.` : ''}
          {offer.verifiedOn ? ` Tarieven gecontroleerd op ${formatDateNl(offer.verifiedOn)}.` : ''}
          {offer.isExample && ' Let op: voorbeeldtarieven.'}
        </p>
      </footer>

      <Dialog wide open={calc} onOpenChange={setCalc} title="Berekening" description="Zo zijn de jaarkosten opgebouwd, met alle aannames.">
        <EnergyBreakdown input={input} result={result} />
      </Dialog>
      <Dialog
        open={next}
        onOpenChange={setNext}
        title="Volgende stap"
        footer={
          <Button variant="primary" onClick={() => navigate('/energie')}>
            Terug naar adviseur
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="flex gap-2.5 text-[15px]">
            <Info className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <strong>Dit is nog geen contract.</strong> Uw adviseur doorloopt nu samen met u de officiële aanmelding bij Essent. Pas na de bevestiging van Essent is het contract definitief; u heeft daarna de wettelijke bedenktijd.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => navigate('/energie/afdrukken')}>
              <Printer /> Voorstel afdrukken
            </Button>
            <Button onClick={() => shareText(energyShareText(input, result))}>
              <Send /> Stuur via WhatsApp
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
