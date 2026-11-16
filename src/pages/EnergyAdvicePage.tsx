import { AlertTriangle, ArrowLeft, ArrowRight, BookmarkPlus, CalendarPlus, Check, CheckCircle2, Eye, EyeOff, MonitorPlay, MoreHorizontal, Printer, RotateCcw, Share2, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatedMoney } from '@/components/AnimatedMoney'
import { EnergyBreakdown, energyShareText } from '@/components/EnergyBreakdown'
import { blankFollowUp, FollowUpDialog } from '@/components/FollowUpDialog'
import { Button } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, NumberInput, RateInput, Segmented, Switch } from '@/components/ui/inputs'
import { formatDateNl, todayIso } from '@/engine/dates'
import { formatRate, offerBlockedReason, type ContractType, type EnergyOffer } from '@/engine/essent'
import { formatEuro } from '@/engine/money'
import { shareText } from '@/export/shareText'
import { cn } from '@/lib/utils'
import { useData, type OutcomeResult } from '@/store/data'
import { sortOffers, useEnergy, useEnergyComparison, useEnergyDraft } from '@/store/energy'
import { toast } from '@/store/toast'
import { More, SectionTitle, Tile } from './AdvicePage'

const SUPPLIERS = ['Vattenfall', 'Eneco', 'Greenchoice', 'Budget Energie', 'Engie', 'Oxxio']

function Steps({ step, canPresent }: { step: 1 | 2; canPresent: boolean }) {
  const setStep = useEnergyDraft((s) => s.setStep)
  const navigate = useNavigate()
  const items = [
    { n: 1, label: 'Huidige situatie', go: () => setStep(1), enabled: true },
    { n: 2, label: 'Essent aanbod', go: () => setStep(2), enabled: true },
    { n: 3, label: 'Toon aan klant', go: () => navigate('/energie/presentatie'), enabled: canPresent },
  ]
  return (
    <ol className="flex items-center gap-1 sm:gap-2">
      {items.map((it, i) => (
        <li key={it.n} className="flex items-center gap-1 sm:gap-2">
          {i > 0 && <span className="h-px w-3 bg-border sm:w-6" />}
          <button type="button" disabled={!it.enabled} aria-current={it.n === step ? 'step' : undefined} onClick={it.go} className={cn('flex h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold transition-colors disabled:opacity-40 sm:px-3', it.n === step ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground')}>
            <span className={cn('grid size-7 place-items-center rounded-full text-xs', it.n === step ? 'bg-primary text-white' : it.n < step ? 'bg-good-soft text-good' : 'bg-muted')}>{it.n < step ? <Check className="size-4" strokeWidth={3} /> : it.n}</span>
            <span className={cn(it.n !== step && 'hidden md:inline')}>{it.label}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

/* ---------- stap 1 ---------- */

function StepCurrent() {
  const { usage, current, setUsage, setCurrent, setCurrentRates, setStep } = useEnergyDraft()
  const r = current.rates
  const custom = current.supplier !== '' && !SUPPLIERS.includes(current.supplier)
  const [other, setOther] = useState(custom)
  const hasGas = usage.gasM3 === null || usage.gasM3 > 0
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="space-y-7 p-6 sm:p-8">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Hoeveel energie verbruikt de klant per jaar?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Het jaarverbruik staat op de jaarafrekening of in de app van de leverancier.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Stroom per jaar">
              <NumberInput value={usage.electricityKwh} onChange={(n) => setUsage({ electricityKwh: n })} nullable suffix="kWh" max={100000} placeholder="bijv. 2500" />
            </Field>
            <Field label="Gas per jaar" hint="0 = geen gasaansluiting">
              <NumberInput value={usage.gasM3} onChange={(n) => setUsage({ gasM3: n })} nullable suffix="m³" max={50000} placeholder="bijv. 1200" />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Huidige leverancier</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUPPLIERS.map((p) => (
              <Tile
                plain
                key={p}
                className="min-h-[52px] py-3 text-center text-[15px] font-semibold"
                active={!other && current.supplier === p}
                onClick={() => {
                  setOther(false)
                  setCurrent({ supplier: p })
                }}
              >
                {p}
              </Tile>
            ))}
            <Tile
              plain
              className="min-h-[52px] py-3 text-center text-[15px] font-semibold"
              active={other}
              onClick={() => {
                setOther(true)
                setCurrent({ supplier: '' })
              }}
            >
              Anders
            </Tile>
          </div>
          {other && <Input className="mt-2" autoFocus placeholder="Naam leverancier" value={current.supplier} onChange={(e) => setCurrent({ supplier: e.target.value })} />}
        </div>

        <div>
          <SectionTitle>Wat betaalt de klant nu?</SectionTitle>
          <Segmented aria-label="Soort gegevens" value={current.mode} onChange={(mode) => setCurrent({ mode })} options={[{ value: 'tarieven', label: 'Tarieven invullen' }, { value: 'jaarbedrag', label: 'Jaarbedrag van jaarafrekening' }]} />
          {current.mode === 'tarieven' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Stroomtarief">
                <RateInput value={r.electricitySingle} onChange={(v) => setCurrentRates({ electricitySingle: v })} unit="per kWh" />
              </Field>
              {hasGas && (
                <Field label="Gastarief">
                  <RateInput value={r.gas} onChange={(v) => setCurrentRates({ gas: v })} unit="per m³" />
                </Field>
              )}
              <Field label="Vaste leveringskosten stroom">
                <MoneyInput value={r.fixedElectricityMonthlyCents} onChange={(c) => setCurrentRates({ fixedElectricityMonthlyCents: c })} suffix="p/m" placeholder="Invullen" />
              </Field>
              {hasGas && (
                <Field label="Vaste leveringskosten gas">
                  <MoneyInput value={r.fixedGasMonthlyCents} onChange={(c) => setCurrentRates({ fixedGasMonthlyCents: c })} suffix="p/m" placeholder="Invullen" />
                </Field>
              )}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Tarieven zoals op het contract of de jaarafrekening: {r.includesVat ? 'inclusief' : 'exclusief'} btw en {r.includesEnergyTax ? 'inclusief' : 'exclusief'} energiebelasting (aan te passen onder Meer details).
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <Field label="Totale jaarkosten volgens de jaarafrekening" hint="Het totaalbedrag over 12 maanden, inclusief belastingen en netbeheer. Vul hier niet het maandelijkse termijnbedrag in: dat zegt niets over de werkelijke kosten.">
                <MoneyInput large value={current.annualCostCents} onChange={(c) => setCurrent({ annualCostCents: c })} suffix="per jaar" />
              </Field>
            </div>
          )}
        </div>

        <More label="Meer details (optioneel)" defaultOpen={usage.meter === 'dubbel' || usage.feedInKwh > 0}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Soort meter">
              <Segmented value={usage.meter} onChange={(meter) => setUsage({ meter })} options={[{ value: 'enkel', label: 'Enkel' }, { value: 'dubbel', label: 'Normaal en dal' }]} />
            </Field>
            {usage.meter === 'dubbel' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Normaal">
                  <NumberInput value={usage.peakKwh} onChange={(n) => setUsage({ peakKwh: n, electricityKwh: n !== null && usage.offPeakKwh !== null ? n + usage.offPeakKwh : usage.electricityKwh })} nullable suffix="kWh" max={100000} />
                </Field>
                <Field label="Dal">
                  <NumberInput value={usage.offPeakKwh} onChange={(n) => setUsage({ offPeakKwh: n, electricityKwh: n !== null && usage.peakKwh !== null ? n + usage.peakKwh : usage.electricityKwh })} nullable suffix="kWh" max={100000} />
                </Field>
              </div>
            )}
          </div>
          {usage.meter === 'dubbel' && current.mode === 'tarieven' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Huidig normaaltarief" hint="Leeg = enkeltarief hierboven geldt">
                <RateInput value={r.electricityPeak} onChange={(v) => setCurrentRates({ electricityPeak: v })} unit="per kWh" />
              </Field>
              <Field label="Huidig daltarief">
                <RateInput value={r.electricityOffPeak} onChange={(v) => setCurrentRates({ electricityOffPeak: v })} unit="per kWh" />
              </Field>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Teruglevering zonnepanelen" hint="Per jaar; 0 = geen">
              <NumberInput value={usage.feedInKwh} onChange={(n) => setUsage({ feedInKwh: n ?? 0 })} suffix="kWh" max={100000} />
            </Field>
            {usage.feedInKwh > 0 && current.mode === 'tarieven' && (
              <>
                <Field label="Huidige terugleverkosten" hint="0 als er geen zijn">
                  <RateInput value={r.feedInFeePerKwh} onChange={(v) => setCurrentRates({ feedInFeePerKwh: v })} unit="per kWh" />
                </Field>
                <Field label="Huidige terugleververgoeding">
                  <RateInput value={r.feedInCompensationPerKwh} onChange={(v) => setCurrentRates({ feedInCompensationPerKwh: v })} unit="per kWh" />
                </Field>
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Huidig contract">
              <Segmented size="sm" value={current.contractType} onChange={(contractType: ContractType) => setCurrent({ contractType })} options={[{ value: 'vast', label: 'Vast' }, { value: 'variabel', label: 'Variabel' }, { value: 'dynamisch', label: 'Dynamisch' }]} />
            </Field>
            <Field label="Contract loopt tot">
              <Input type="date" value={current.contractEndDate ?? ''} onChange={(e) => setCurrent({ contractEndDate: e.target.value || null })} />
            </Field>
            <Field label="Bekende opzegkosten">
              <MoneyInput value={current.terminationCents} onChange={(c) => setCurrent({ terminationCents: c ?? 0 })} emptyAsZero />
            </Field>
          </div>
          {current.mode === 'tarieven' && (
            <div className="rounded-2xl bg-muted/60 px-4 py-1">
              <Switch checked={r.includesVat} onCheckedChange={(includesVat) => setCurrentRates({ includesVat })} label="Huidige tarieven zijn inclusief btw" />
              <Switch checked={r.includesEnergyTax} onCheckedChange={(includesEnergyTax) => setCurrentRates({ includesEnergyTax })} label="Huidige tarieven zijn inclusief energiebelasting" />
            </div>
          )}
        </More>

        <Button variant="primary" size="lg" className="w-full" onClick={() => setStep(2)}>
          Verder: Essent aanbod <ArrowRight />
        </Button>
      </Card>
    </div>
  )
}

/* ---------- stap 2 ---------- */

export function offerRateLine(o: EnergyOffer): string {
  const r = o.rates
  const parts = [r.electricitySingle !== null ? `stroom ${formatRate(r.electricitySingle)}` : r.electricityPeak !== null && r.electricityOffPeak !== null ? `stroom ${formatRate(r.electricityPeak)} / ${formatRate(r.electricityOffPeak)}` : null, r.gas !== null ? `gas ${formatRate(r.gas)}` : null, o.welcomeBonusCents > 0 ? `bonus ${formatEuro(o.welcomeBonusCents, { decimals: 'auto' })}` : null]
  return parts.filter(Boolean).join(' · ') || 'Nog geen tarieven ingevuld'
}

function OfferPicker() {
  const { offers, defaultOfferId, regulatory } = useEnergy()
  const { setOffer, rulesYear, setRulesYear, snapshot } = useEnergyDraft()
  const { offer } = useEnergyComparison()
  const today = todayIso()
  const list = sortOffers(offers, defaultOfferId, today)
  const year = rulesYear ?? Number(today.slice(0, 4))
  return (
    <Card className="space-y-6 p-5 sm:p-6">
      {snapshot && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm">
          <span>
            <strong>Opgeslagen vergelijking.</strong> Er wordt gerekend met de tarieven van toen ({snapshot.offer.name}, versie {snapshot.offer.version}).
          </span>
          <Button size="sm" onClick={() => setOffer(snapshot.offer.id)}>
            Actuele tarieven gebruiken
          </Button>
        </div>
      )}
      <section>
        <SectionTitle hint="één tik om te wisselen">Essent aanbod</SectionTitle>
        <div role="radiogroup" aria-label="Essent aanbod" className="grid gap-2">
          {list.map((o) => {
            const blocked = offerBlockedReason(o, today)
            const on = !snapshot && offer?.id === o.id
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setOffer(o.id)} className={cn('flex min-h-[72px] items-center gap-4 rounded-2xl border-2 bg-card px-4 py-2.5 text-left transition-all active:scale-[.99]', on ? 'border-primary bg-primary-soft/60 shadow-card' : 'border-border hover:border-primary/40', blocked && !on && 'opacity-60')}>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-semibold">{o.name}</span>
                    {o.id === defaultOfferId && (
                      <Badge tone="primary">
                        <Star /> Standaard
                      </Badge>
                    )}
                    {o.isExample && <Badge tone="accent">Voorbeeld</Badge>}
                    {blocked && <Badge tone="warn">{o.status === 'concept' ? 'Concept' : blocked.includes('verlopen') ? 'Verlopen' : 'Nog niet geldig'}</Badge>}
                  </span>
                  <span className="tnum block text-sm text-muted-foreground">
                    {offerRateLine(o)} · {o.contractType === 'vast' ? `${o.contractMonths} mnd vast` : o.contractType}
                    {o.validTo && ` · t/m ${formatDateNl(o.validTo)}`}
                  </span>
                </span>
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', on ? 'border-primary bg-primary text-white' : 'border-border')}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
              </button>
            )
          })}
        </div>
        <Link to="/energie/tarieven" className="mt-3 inline-block text-sm font-semibold text-primary underline">
          Tarieven &amp; acties beheren
        </Link>
      </section>
      <More label="Geavanceerd">
        <Field label="Rekenen met de regels van" hint="Bepaalt btw, energiebelasting, netbeheer en of er nog gesaldeerd wordt.">
          <Segmented value={year} onChange={(y) => setRulesYear(y)} options={[...regulatory].sort((a, b) => a.year - b.year).map((y) => ({ value: y.year, label: `${y.year}${y.netting === 'geen' ? ' · geen salderen' : ''}` }))} />
        </Field>
      </More>
    </Card>
  )
}

function Summary() {
  const navigate = useNavigate()
  const { input, result, offer } = useEnergyComparison()
  const { saveComparison, commission } = useEnergy()
  const addOutcome = useData((s) => s.addOutcome)
  const [calc, setCalc] = useState(false)
  const [more, setMore] = useState(false)
  const [peek, setPeek] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [followOpen, setFollowOpen] = useState(false)
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [outcome, setOutcome] = useState<OutcomeResult>('verkocht')
  const [outcomeCents, setOutcomeCents] = useState(0)
  if (!input || !result || !offer) {
    return (
      <Card className="grid min-h-[260px] place-items-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold">Nog geen Essent-aanbod</p>
          <p className="mt-1 text-sm text-muted-foreground">Voeg bij Tarieven &amp; acties een aanbod toe.</p>
          <Button asChild variant="primary" className="mt-4">
            <Link to="/energie/tarieven">Naar tarieven</Link>
          </Button>
        </div>
      </Card>
    )
  }
  const s = result.yearlySavingsCents
  const blockers = result.issues.filter((i) => i.blocking)
  const notes = result.issues.filter((i) => !i.blocking)
  const estimate = commission.electricityCents + ((input.usage.gasM3 ?? 0) > 0 ? commission.gasCents : 0)
  return (
    <Card className="space-y-5 p-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Essent{offer.campaign ? ` · ${offer.campaign}` : ''}</div>
        <h2 className="mt-1 text-xl font-semibold leading-tight tracking-tight">{offer.name}</h2>
      </div>

      {result.blocked ? (
        <div className="space-y-2 rounded-2xl bg-warn-soft p-4">
          <div className="flex items-center gap-2 font-semibold text-warn">
            <AlertTriangle className="size-5" /> Nog niet te tonen
          </div>
          <p className="text-sm text-muted-foreground">Er wordt niets geschat. Vul aan wat ontbreekt:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {blockers.map((b) => (
              <li key={b.message}>{b.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <dl className="space-y-1 text-[15px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Nu bij {input.current.supplier || 'huidige leverancier'}</dt>
              <dd className="tnum text-lg font-semibold">{formatEuro(result.currentYearCents!)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Met Essent</dt>
              <dd className="tnum text-lg font-semibold">{formatEuro(result.essent!.totalYearCents)}</dd>
            </div>
            <div className="text-xs text-muted-foreground">per jaar · {result.basis === 'volledig' ? 'incl. netbeheer en belastingen' : 'kosten bij de leverancier, incl. belastingen'}</div>
          </dl>
          <div className={cn('flex items-center justify-between gap-3 rounded-2xl px-5 py-4', s! > 0 ? 'bg-good-soft' : s! < 0 ? 'bg-warn-soft' : 'bg-muted')}>
            <span className="text-sm font-medium">{s! > 0 ? 'Besparing per jaar' : s! < 0 ? 'Duurder per jaar' : 'Zelfde kosten'}</span>
            <AnimatedMoney cents={Math.abs(s!)} decimals="auto" className={cn('text-3xl font-semibold tracking-tight', s! > 0 && 'text-good', s! < 0 && 'text-warn')} />
          </div>
          {offer.welcomeBonusCents > 0 && (
            <p className="-mt-2 text-sm text-muted-foreground">
              Plus eenmalig <strong className="tnum text-foreground">{formatEuro(offer.welcomeBonusCents, { decimals: 'auto' })}</strong> welkomstbonus.
            </p>
          )}
        </>
      )}

      {notes.length > 0 && (
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {notes.map((n) => (
            <li key={n.message} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" /> {n.message}
            </li>
          ))}
        </ul>
      )}

      <Button variant="primary" size="lg" className="h-16 w-full text-lg" disabled={result.blocked} onClick={() => navigate('/energie/presentatie')}>
        <MonitorPlay /> Toon aan klant
      </Button>
      {!result.blocked && (
        <>
          <button type="button" onClick={() => setCalc(true)} className="mx-auto block min-h-[44px] text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Bekijk berekening
          </button>
          <div className="space-y-2 border-t pt-4">
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={() => setSaveOpen(true)}>
                <BookmarkPlus /> Opslaan
              </Button>
              <Button size="sm" onClick={() => shareText(energyShareText(input, result))}>
                <Share2 /> Delen
              </Button>
              <Button size="sm" onClick={() => setMore((m) => !m)} aria-expanded={more}>
                <MoreHorizontal /> Meer
              </Button>
            </div>
            {more && (
              <div className="grid animate-fade-up grid-cols-3 gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/energie/afdrukken')}>
                  <Printer /> Voorstel
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setFollowOpen(true)}>
                  <CalendarPlus /> Opvolging
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOutcome('verkocht')
                    setOutcomeCents(estimate)
                    setOutcomeOpen(true)
                  }}
                >
                  <CheckCircle2 /> Uitkomst
                </Button>
              </div>
            )}
            <div className="rounded-xl border border-dashed px-3 py-1">
              <button type="button" onClick={() => setPeek((o) => !o)} aria-expanded={peek} className="flex min-h-[44px] w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground">
                {peek ? <EyeOff className="size-4" /> : <Eye className="size-4" />} Alleen voor adviseur
                {peek && <span className="tnum ml-auto text-sm font-semibold text-foreground">{formatEuro(estimate)}</span>}
              </button>
              {peek && <p className="pb-3 text-xs text-muted-foreground">Geschatte provisie Essent ({(input.usage.gasM3 ?? 0) > 0 ? 'stroom + gas' : 'alleen stroom'}). Instelbaar bij Instellingen.</p>}
            </div>
          </div>
        </>
      )}
      {offer.verifiedOn && <p className="text-center text-xs text-muted-foreground">Tarieven gecontroleerd op {formatDateNl(offer.verifiedOn)} · versie {offer.version}</p>}

      <Dialog wide open={calc} onOpenChange={setCalc} title="Berekening" description={`Essent · ${offer.name}`}>
        <EnergyBreakdown input={input} result={result} />
      </Dialog>
      <Dialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Vergelijking opslaan"
        description="Wordt anoniem op dit apparaat bewaard, mét de tarieven van nu. Latere tariefwijzigingen veranderen deze vergelijking niet."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                saveComparison(label.trim(), input)
                setLabel('')
                setSaveOpen(false)
                toast('Vergelijking opgeslagen')
              }}
            >
              Opslaan
            </Button>
          </>
        }
      >
        <Field label="Eigen kenmerk (optioneel)" hint="Gebruik liever geen volledige naam.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bijv. Energie 7" />
        </Field>
      </Dialog>
      <FollowUpDialog open={followOpen} onOpenChange={setFollowOpen} initial={followOpen ? blankFollowUp({ contractEndDate: input.current.contractEndDate, offerDiscussed: `Essent ${offer.name}`, reason: input.current.contractEndDate && input.current.contractEndDate > input.today ? 'Huidig energiecontract loopt nog' : '' }) : null} />
      <Dialog
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
        title="Uitkomst registreren"
        description="Optioneel, voor uw eigen resultaten. Er worden geen klantgegevens vastgelegd."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOutcomeOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                addOutcome({ date: todayIso(), result: outcome, offerName: `Essent ${offer.name}`, kind: null, commissionCents: outcome === 'verkocht' ? outcomeCents : 0, module: 'energie' })
                setOutcomeOpen(false)
                toast('Uitkomst geregistreerd')
              }}
            >
              Registreren
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented value={outcome} onChange={setOutcome} options={[{ value: 'verkocht', label: 'Verkocht' }, { value: 'opvolgen', label: 'Opvolgen' }, { value: 'geen_interesse', label: 'Geen interesse' }]} />
          {outcome === 'verkocht' && (
            <Field label="Provisie Essent voor deze verkoop" hint="Vooringevuld vanuit uw instellingen; aanpasbaar.">
              <MoneyInput value={outcomeCents} onChange={(c) => setOutcomeCents(c ?? 0)} emptyAsZero />
            </Field>
          )}
        </div>
      </Dialog>
    </Card>
  )
}

export default function EnergyAdvicePage() {
  const { step, setStep, reset } = useEnergyDraft()
  const { result } = useEnergyComparison()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 p-4 sm:p-6 lg:h-full">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Steps step={step} canPresent={!!result && !result.blocked} />
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
          <RotateCcw /> Nieuw advies
        </Button>
      </header>
      {step === 1 ? (
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-6">
          <StepCurrent />
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,40%)]">
          <div className="min-w-0 space-y-3 lg:overflow-y-auto lg:pb-6 lg:pr-1">
            <button type="button" onClick={() => setStep(1)} className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Huidige situatie wijzigen
            </button>
            <OfferPicker />
          </div>
          <div className="min-w-0 lg:overflow-y-auto lg:pb-6">
            <Summary />
          </div>
        </div>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Nieuw energieadvies starten?"
        description="De huidige vergelijking wordt leeggemaakt. Opgeslagen vergelijkingen blijven bewaard."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                reset()
                setConfirm(false)
              }}
            >
              Nieuw advies starten
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Dit kan niet ongedaan worden gemaakt.</p>
      </Dialog>
    </div>
  )
}
