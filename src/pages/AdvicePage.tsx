import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Minus, MonitorPlay, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActionBar, CommissionPeek } from '@/components/ActionBar'
import { AnimatedMoney } from '@/components/AnimatedMoney'
import { Breakdown } from '@/components/Breakdown'
import { GiftImage } from '@/components/GiftImage'
import { ListEditor } from '@/components/ListEditor'
import { OfferForm, validateOffer } from '@/components/OfferForm'
import { OptionTabs } from '@/components/OptionTabs'
import { Button } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, NumberInput, Segmented, Select, Switch } from '@/components/ui/inputs'
import { findPrice, formatSpeed, isVerifiedPrice, promotionBlockedReason, staleCount, togglePromotion, type ExtraCategory, type ExtraService } from '@/engine/pricing'
import { formatDateNl } from '@/engine/dates'
import { priceStory } from '@/engine/customerView'
import { newId } from '@/engine/defaults'
import { formatEuro } from '@/engine/money'
import type { Offer } from '@/engine/types'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { MAX_OPTIONS, useComparison, useDraft, type OptionComparison } from '@/store/draft'

const PROVIDERS = ['KPN', 'Odido', 'Ziggo', 'Delta', 'Youfone', 'Budget Thuis']

export function offerPriceLine(o: Offer): string {
  if (o.promoMonths <= 0 || o.promoMonthlyCents === o.regularMonthlyCents) return `${formatEuro(o.regularMonthlyCents)} per maand`
  return `${formatEuro(o.promoMonthlyCents)} × ${o.promoMonths} mnd, daarna ${formatEuro(o.regularMonthlyCents)}`
}

/* ---------- gedeelde bouwstenen ---------- */

export function Tile({ active, onClick, children, className, disabled, plain }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean; plain?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn('relative min-h-[64px] rounded-2xl border-2 bg-card p-4 text-left transition-all duration-150 active:scale-[.98] disabled:opacity-40', active ? 'border-primary bg-primary-soft/60 shadow-card' : 'border-border hover:border-primary/40', className)}
    >
      {active && !plain && (
        <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-primary text-white">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  )
}

export const SectionTitle = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className="mb-3 flex items-baseline justify-between gap-3">
    <h2 className="text-[17px] font-semibold tracking-tight">{children}</h2>
    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
  </div>
)

export function More({ label, children, defaultOpen }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border-t pt-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-[48px] w-full items-center justify-between text-left text-[15px] font-semibold text-muted-foreground hover:text-foreground">
        {label}
        <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="animate-fade-up space-y-5 pb-2 pt-2">{children}</div>}
    </div>
  )
}

function Steps({ step, canPresent }: { step: 1 | 2; canPresent: boolean }) {
  const setStep = useDraft((s) => s.setStep)
  const navigate = useNavigate()
  const items = [
    { n: 1, label: 'Huidige situatie', go: () => setStep(1), enabled: true },
    { n: 2, label: 'Nieuw pakket', go: () => setStep(2), enabled: true },
    { n: 3, label: 'Toon aan klant', go: () => navigate('/presentatie'), enabled: canPresent },
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

/* ---------- stap 1: huidige situatie ---------- */

function StepCurrent() {
  const { current, setCurrent, setStep } = useDraft()
  const custom = current.provider !== '' && !PROVIDERS.includes(current.provider)
  const [other, setOther] = useState(custom)
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="space-y-7 p-6 sm:p-8">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Wat betaalt de klant nu?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Het maandbedrag voor internet en tv samen, inclusief btw.</p>
          <div className="mt-4">
            <MoneyInput large autoFocus value={current.monthlyCents} onChange={(c) => setCurrent({ monthlyCents: c })} suffix="per maand" aria-label="Huidig maandbedrag" />
          </div>
        </div>

        <div>
          <SectionTitle>Bij welke aanbieder?</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROVIDERS.map((p) => (
              <Tile
                plain
                key={p}
                className="min-h-[52px] py-3 text-center text-[15px] font-semibold"
                active={!other && current.provider === p}
                onClick={() => {
                  setOther(false)
                  setCurrent({ provider: p })
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
                setCurrent({ provider: '' })
              }}
            >
              Anders
            </Tile>
          </div>
          {other && <Input className="mt-2" autoFocus placeholder="Naam aanbieder" value={current.provider} onChange={(e) => setCurrent({ provider: e.target.value })} />}
        </div>

        <div>
          <SectionTitle>Wat heeft de klant?</SectionTitle>
          <Segmented aria-label="Huidig pakket" value={current.hasTv ? 'tv' : 'net'} onChange={(v) => setCurrent({ hasTv: v === 'tv' })} options={[{ value: 'net', label: 'Alleen internet' }, { value: 'tv', label: 'Internet + TV' }]} />
        </div>

        <More label="Meer details (optioneel)">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Contract loopt tot">
              <Input type="date" value={current.contractEndDate ?? ''} onChange={(e) => setCurrent({ contractEndDate: e.target.value || null })} />
            </Field>
            <Field label="Kosten om nu op te zeggen" hint="Telt mee als eenmalige kosten">
              <MoneyInput value={current.cancellationCents} onChange={(c) => setCurrent({ cancellationCents: c ?? 0 })} emptyAsZero />
            </Field>
            <Field label="Verwacht nieuw maandbedrag" hint={`Leeg = blijft gelijk; geldt vanaf maand ${current.futureFromMonth}`}>
              <MoneyInput value={current.futureMonthlyCents} onChange={(c) => setCurrent({ futureMonthlyCents: c })} placeholder="—" />
            </Field>
            <Field label="Pakketnaam">
              <Input value={current.packageName} onChange={(e) => setCurrent({ packageName: e.target.value })} />
            </Field>
            <Field label="Internetsnelheid">
              <NumberInput value={current.speedMbps} onChange={(n) => setCurrent({ speedMbps: n })} nullable suffix="Mbit/s" max={10000} />
            </Field>
            <Field label="Aantal tv-ontvangers">
              <NumberInput value={current.tvReceivers} onChange={(n) => setCurrent({ tvReceivers: n ?? 0 })} max={9} />
            </Field>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Extra's bovenop het maandbedrag (sport, films, vaste toeslagen)</h3>
            <ListEditor
              items={current.extras}
              onChange={(extras) => setCurrent({ extras })}
              create={() => ({ id: newId(), label: '', monthlyCents: 0 })}
              addLabel="Extra toevoegen"
              render={(item, update) => (
                <div className="grid grid-cols-[1fr_130px] gap-2">
                  <Input aria-label="Omschrijving" placeholder="Bijv. sportzender" value={item.label} onChange={(e) => update({ label: e.target.value })} />
                  <MoneyInput aria-label="Bedrag per maand" value={item.monthlyCents} onChange={(c) => update({ monthlyCents: c ?? 0 })} emptyAsZero />
                </div>
              )}
            />
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Korting die nu in het maandbedrag zit en afloopt</h3>
            <ListEditor
              items={current.discounts}
              onChange={(discounts) => setCurrent({ discounts })}
              create={() => ({ id: newId(), label: '', monthlyCents: 0, endsOn: null })}
              addLabel="Aflopende korting toevoegen"
              render={(item, update) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_130px_170px]">
                  <Input aria-label="Omschrijving" className="col-span-2 sm:col-span-1" placeholder="Bijv. welkomstkorting" value={item.label} onChange={(e) => update({ label: e.target.value })} />
                  <MoneyInput aria-label="Korting per maand" value={item.monthlyCents} onChange={(c) => update({ monthlyCents: c ?? 0 })} emptyAsZero />
                  <Input aria-label="Loopt af op" type="date" value={item.endsOn ?? ''} onChange={(e) => update({ endsOn: e.target.value || null })} />
                </div>
              )}
            />
          </div>
          <Field label="Verwacht nieuw maandbedrag geldt vanaf maand" className="max-w-[260px]">
            <NumberInput value={current.futureFromMonth} onChange={(n) => setCurrent({ futureFromMonth: Math.max(1, n ?? 1) })} min={1} max={24} />
          </Field>
        </More>

        <div>
          <Button variant="primary" size="lg" className="w-full" onClick={() => setStep(2)}>
            Verder: nieuw pakket <ArrowRight />
          </Button>
          {current.monthlyCents === null && <p className="mt-2 text-center text-xs text-muted-foreground">Zonder maandbedrag kan de app geen besparing laten zien.</p>}
        </div>
      </Card>
    </div>
  )
}

/* ---------- stap 2: pakket samenstellen ---------- */

function Stepper({ value, onChange, max, label }: { value: number; onChange: (n: number) => void; max: number; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`Minder: ${label}`} disabled={value === 0} onClick={() => onChange(value - 1)} className="grid size-11 place-items-center rounded-full border hover:bg-muted disabled:opacity-30">
        <Minus className="size-4" />
      </button>
      <span className="tnum w-7 text-center text-lg font-semibold">{value}</span>
      <button type="button" aria-label={`Meer: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid size-11 place-items-center rounded-full border hover:bg-muted disabled:opacity-30">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

const EXTRA_GROUPS: { category: ExtraCategory; title: string }[] = [
  { category: 'sport', title: 'Sport' },
  { category: 'entertainment', title: 'Film en zenders' },
  { category: 'bundel', title: 'Voordeelbundels' },
  { category: 'streaming', title: 'Streaming' },
]

function Builder() {
  const pricing = useData((s) => s.pricing)
  const oldOffers = useData((s) => s.offers)
  const { builds, activeIndex, setSelection, setSnapshot, combo, setCombo, period, setPeriod, startDate, addOption, removeOption } = useDraft()
  const { all, active } = useComparison()
  const build = builds[activeIndex] ?? builds[0]
  const sel = build.selection
  const [editing, setEditing] = useState<Offer | null>(null)
  const [moreExtras, setMoreExtras] = useState(false)
  const errors = editing ? validateOffer(editing) : []

  const internet = pricing.internet.filter((i) => i.available || i.id === sel.internetId)
  const net = pricing.internet.find((i) => i.id === sel.internetId)
  const tvs = pricing.tv.filter((t) => t.available || t.id === sel.tvId)
  const tv = pricing.tv.find((t) => t.id === sel.tvId)
  const states = active?.extraStates ?? {}
  const priceOf = (internetId: string, tvId: string | null, phone: boolean) => {
    const p = findPrice(pricing, internetId, tvId, phone)
    return isVerifiedPrice(p) ? p.cents : null
  }
  const base = net ? priceOf(net.id, sel.tvId, false) : null
  const withPhone = net ? priceOf(net.id, sel.tvId, true) : null
  const setQty = (id: string, qty: number) => setSelection({ extras: { ...sel.extras, [id]: qty } })
  const visibleExtra = (e: ExtraService) => (e.available && e.monthlyCents !== null && (!e.requiresTv || !!tv)) || (sel.extras[e.id] ?? 0) > 0
  const equipment = pricing.extras.filter((e) => e.category === 'apparatuur' && visibleExtra(e))
  const special = pricing.extras.filter((e) => e.moreOptions && visibleExtra(e))
  const promos = pricing.promotions.filter((p) => !promotionBlockedReason(p, startDate, sel.contractMonths, !!tv) || sel.promotionIds.includes(p.id)).sort((a, b) => (a.channel === b.channel ? 0 : a.channel === 'eigen' ? -1 : 1))
  const hiddenPromos = pricing.promotions.length - promos.length
  const chosenExtras = Object.entries(sel.extras).filter(([id, q]) => q > 0 && pricing.extras.find((e) => e.id === id)?.category !== 'apparatuur').length
  const chosenEquipment = equipment.reduce((a, e) => a + (sel.extras[e.id] ?? 0), 0)

  const pickInternet = (id: string) => {
    setSelection({ internetId: id })
    // Vodafone-referentiebedrag volgt de gekozen snelheid, tot de adviseur het zelf aanpast.
    const prev = net?.vodafoneDiscountCents ?? null
    const next = pricing.internet.find((i) => i.id === id)?.vodafoneDiscountCents ?? null
    if (combo.hasVodafone && next !== null && (combo.monthlyDiscountCents === 0 || combo.monthlyDiscountCents === prev)) setCombo({ monthlyDiscountCents: next })
  }

  const extraChip = (e: ExtraService) => {
    const on = (sel.extras[e.id] ?? 0) > 0
    const included = tv?.includes.includes(e.id)
    const state = states[e.id]
    const tag = included ? 'Inbegrepen' : state === 'in_bundel' ? 'Zit in bundel' : state === 'controleren' ? 'Controleren' : e.monthlyCents === null ? 'prijs invullen' : `+ ${formatEuro(e.monthlyCents)}`
    return (
      <button
        key={e.id}
        type="button"
        aria-pressed={on}
        disabled={included}
        onClick={() => setQty(e.id, on ? 0 : 1)}
        className={cn(
          'flex min-h-[48px] items-center gap-2 rounded-full border-2 px-4 py-2 text-left text-sm font-semibold transition-all active:scale-95',
          included ? 'border-good/30 bg-good-soft text-good' : on ? (state === 'controleren' ? 'border-warn bg-warn-soft text-warn' : 'border-primary bg-primary text-white') : 'border-border bg-card hover:border-primary/40',
        )}
      >
        {(on || included) && <Check className="size-4 shrink-0" strokeWidth={3} />}
        {e.name}
        <span className={cn('tnum whitespace-nowrap font-normal', included ? '' : on && state !== 'controleren' ? 'text-white/80' : 'text-muted-foreground')}>{tag}</span>
      </button>
    )
  }

  const advanced = (
    <More label="Geavanceerd" defaultOpen={sel.contractMonths === 12 || builds.length > 1}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contractduur" hint="Standaard 24 maanden">
          <Segmented value={sel.contractMonths} onChange={(m) => setSelection({ contractMonths: m })} options={[{ value: 24, label: '24 maanden' }, { value: 12, label: '12 maanden' }]} />
        </Field>
        <Field label="Vergelijken over" hint="Standaard 24 maanden">
          <Segmented value={period} onChange={setPeriod} options={[{ value: 24, label: '24 maanden' }, { value: 12, label: '12 maanden' }]} />
        </Field>
      </div>
      {oldOffers.length > 0 && (
        <Field label="Eerder opgeslagen vaste aanbieding gebruiken" hint="Uit een vorige versie van de app; staat los van de prijsmatrix.">
          <Select
            value=""
            onChange={(e) => {
              const o = oldOffers.find((x) => x.id === e.target.value)
              if (o) setSnapshot(structuredClone(o))
            }}
          >
            <option value="">Kies…</option>
            {oldOffers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {builds.length > 1 && <OptionTabs options={all} activeIndex={all.findIndex((o) => o.buildIndex === activeIndex)} />}
        {builds.length < MAX_OPTIONS && (
          <Button size="sm" onClick={addOption} disabled={!active}>
            <Plus /> Tweede optie om te vergelijken
          </Button>
        )}
        {builds.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => removeOption(activeIndex)}>
            <Trash2 /> Deze optie verwijderen
          </Button>
        )}
        {active && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(structuredClone(active.offer))}>
            <Pencil /> Alles handmatig aanpassen
          </Button>
        )}
      </div>
    </More>
  )

  const editDialog = (
    <Dialog
      wide
      open={!!editing}
      onOpenChange={(o) => !o && setEditing(null)}
      title="Aanpassen voor deze klant"
      description="Geldt alleen voor dit advies. Uw prijsconfiguratie verandert niet."
      footer={
        <>
          {errors.length > 0 && <p className="mr-auto self-center text-sm font-medium text-red-600">{errors[0]}</p>}
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Annuleren
          </Button>
          <Button
            variant="primary"
            disabled={errors.length > 0}
            onClick={() => {
              setSnapshot(editing)
              setEditing(null)
            }}
          >
            Toepassen
          </Button>
        </>
      }
    >
      {editing && <OfferForm offer={editing} onChange={setEditing} />}
    </Dialog>
  )

  if (build.snapshot) {
    return (
      <Card className="space-y-4 p-6">
        <Badge tone="primary">Vastgezette aanbieding</Badge>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{build.snapshot.name}</h2>
          <p className="tnum text-muted-foreground">{offerPriceLine(build.snapshot)}</p>
        </div>
        <p className="text-sm text-muted-foreground">Deze aanbieding is handmatig aangepast of geopend uit een opgeslagen advies. De prijzen staan los van uw prijsconfiguratie.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(structuredClone(build.snapshot!))}>
            <Pencil /> Aanpassen
          </Button>
          <Button variant="ghost" onClick={() => setSnapshot(null)}>
            <RotateCcw /> Opnieuw samenstellen
          </Button>
        </div>
        {advanced}
        {editDialog}
      </Card>
    )
  }

  return (
    <Card className="space-y-6 p-5 sm:p-6">
      <section>
        <SectionTitle>Internet</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {internet.map((i) => {
            const cents = priceOf(i.id, null, false)
            return (
              <Tile key={i.id} active={sel.internetId === i.id} onClick={() => pickInternet(i.id)}>
                <div className="text-[22px] font-semibold leading-tight tracking-tight">{formatSpeed(i.downloadMbps)}</div>
                <div className="tnum mt-1 text-sm text-muted-foreground">{cents === null ? <span className="font-semibold text-warn">Prijs controleren</span> : `${formatEuro(cents)} p/m`}</div>
              </Tile>
            )
          })}
        </div>
      </section>

      <section>
        <SectionTitle hint={net ? 'totaalprijs per maand, incl. internet' : undefined}>Televisie</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile active={!sel.tvId} onClick={() => setSelection({ tvId: null, phone: false })}>
            <div className="text-[17px] font-semibold">Geen TV</div>
            <div className="mt-1 text-sm text-muted-foreground">Alleen internet</div>
          </Tile>
          {tvs.map((t) => {
            const cents = net ? priceOf(net.id, t.id, false) : null
            return (
              <Tile key={t.id} active={sel.tvId === t.id} onClick={() => setSelection({ tvId: t.id })}>
                <div className="pr-7 text-[17px] font-semibold">{t.name}</div>
                <div className="tnum mt-1 text-sm text-muted-foreground">{!net ? t.features[0] : cents === null ? <span className="font-semibold text-warn">Prijs controleren</span> : `${formatEuro(cents)} p/m`}</div>
              </Tile>
            )
          })}
        </div>
        {tv && <p className="mt-2 text-sm text-muted-foreground">{tv.features.join(' · ')}</p>}
      </section>

      <section>
        <SectionTitle hint="de klant kiest er één">Welkomstactie</SectionTitle>
        {promos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Geen gecontroleerde, geldige acties voor dit pakket.{' '}
            <Link to="/prijzen" className="font-semibold text-primary underline">
              Acties beheren
            </Link>
          </p>
        ) : (
          <div role="radiogroup" aria-label="Welkomstactie" className="grid gap-2">
            {promos.map((p) => {
              const gift = p.giftId ? pricing.gifts.find((g) => g.id === p.giftId) : undefined
              const blocked = promotionBlockedReason(p, startDate, sel.contractMonths, !!tv)
              const on = sel.promotionIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelection({ promotionIds: togglePromotion(pricing, sel.promotionIds, p.id) })}
                  className={cn('relative flex min-h-[72px] items-center gap-4 rounded-2xl border-2 bg-card px-3 py-2.5 text-left transition-all duration-150 active:scale-[.98]', on ? 'border-primary bg-primary-soft/60 shadow-card' : 'border-border hover:border-primary/40')}
                >
                  {gift ? <GiftImage src={gift.imageDataUrl} className="size-14 rounded-xl" /> : <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-good-soft text-lg font-bold text-good">€</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">{blocked ? <span className="font-semibold text-warn">{blocked}</span> : gift ? 'Cadeau · normale maandprijs' : p.channel === 'eigen' ? 'Maandkorting' : 'Openbare actie ziggo.nl'}</span>
                  </span>
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', on ? 'border-primary bg-primary text-white' : 'border-border')}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
                </button>
              )
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Welkomstacties zijn niet te combineren: een andere kiezen vervangt de vorige.{hiddenPromos > 0 && ` ${hiddenPromos} actie(s) verborgen (concept, verlopen of niet voor dit pakket).`}
        </p>
      </section>

      <More label={`Vast bellen${sel.phone ? ' (aan)' : ''}`}>
        <div className="rounded-2xl border-2 border-border px-4 py-1">
          <Switch
            checked={sel.phone}
            onCheckedChange={(phone) => setSelection({ phone })}
            label="Vast bellen toevoegen"
            description={!net ? 'Kies eerst een internetpakket.' : base !== null && withPhone !== null ? `+ ${formatEuro(withPhone - base)} per maand (Alles-in-1). Belkosten zelf zijn niet meegerekend.` : sel.phone ? 'Voor deze combinatie is geen gecontroleerde prijs ingesteld.' : tv ? 'Prijs voor deze combinatie nog niet ingesteld.' : 'Alleen ingesteld in combinatie met tv.'}
          />
        </div>
      </More>

      <More label={`Extra tv en wifi${chosenEquipment ? ` (${chosenEquipment})` : ''}`}>
        <div className="divide-y rounded-2xl border-2 border-border">
          {equipment.map((e) => {
            const included = e.id === 'x-next-mini' ? (tv?.includedReceivers ?? 0) : e.id === 'x-wifi-extender' ? (net?.includedExtenders ?? 0) : 0
            return (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <div className="text-[15px] font-semibold">{e.name}</div>
                  <div className="tnum text-xs text-muted-foreground">
                    {formatEuro(sel.overrides[e.id] ?? e.monthlyCents ?? 0)} per stuk per maand{included > 0 && ` · ${included} al inbegrepen`}
                  </div>
                </div>
                <Stepper label={e.name} value={sel.extras[e.id] ?? 0} max={e.maxQuantity} onChange={(n) => setQty(e.id, n)} />
              </div>
            )
          })}
          {equipment.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Geen apparatuur beschikbaar voor dit pakket.</p>}
        </div>
        {equipment.some((e) => (sel.extras[e.id] ?? 0) > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {equipment
              .filter((e) => (sel.extras[e.id] ?? 0) > 0)
              .map((e) => (
                <Field key={e.id} label={`Afwijkende prijs ${e.name}`} hint="Alleen bij een toegestane actie; leeg = standaardprijs">
                  <MoneyInput
                    value={sel.overrides[e.id] ?? null}
                    placeholder={formatEuro(e.monthlyCents ?? 0).replace('€', '').trim()}
                    onChange={(c) => {
                      const next = { ...sel.overrides }
                      if (c === null) delete next[e.id]
                      else next[e.id] = c
                      setSelection({ overrides: next })
                    }}
                  />
                </Field>
              ))}
          </div>
        )}
      </More>

      <More label={`Sport en entertainment${chosenExtras ? ` (${chosenExtras})` : ''}`}>
        {EXTRA_GROUPS.map((g) => {
          const items = pricing.extras.filter((e) => e.category === g.category && !e.moreOptions && (visibleExtra(e) || tv?.includes.includes(e.id)))
          if (items.length === 0) return null
          return (
            <div key={g.category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h3>
              <div className="flex flex-wrap gap-2">{items.map(extraChip)}</div>
            </div>
          )
        })}
        {!tv && <p className="text-sm text-muted-foreground">Sport- en zenderpakketten zijn er alleen bij een tv-pakket.</p>}
        {special.length > 0 && (
          <div>
            <button type="button" onClick={() => setMoreExtras((m) => !m)} aria-expanded={moreExtras} className="min-h-[44px] text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline">
              {moreExtras ? 'Minder opties' : 'Meer opties'}
            </button>
            {moreExtras && <div className="mt-1 flex flex-wrap gap-2">{special.map(extraChip)}</div>}
          </div>
        )}
      </More>

      <More label={`Vodafone-voordeel${combo.hasVodafone ? (combo.eligible ? ' (bevestigd)' : ' (nog controleren)') : ''}`}>
        <div className="rounded-2xl border-2 border-border px-4 py-1">
          <Switch checked={combo.hasVodafone} onCheckedChange={(on) => setCombo({ hasVodafone: on, eligible: on ? combo.eligible : false, monthlyDiscountCents: on && combo.monthlyDiscountCents === 0 ? (net?.vodafoneDiscountCents ?? 0) : combo.monthlyDiscountCents })} label="Heeft u Vodafone?" />
          {combo.hasVodafone && (
            <div className="animate-fade-up space-y-3 border-t pb-3 pt-2">
              <div className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
                <strong>Combinatievoordeel controleren.</strong> <span className="text-muted-foreground">Niet elk abonnement komt in aanmerking en bestaande klanten kunnen oude voordelen hebben. Tot u bevestigt, telt er niets mee.</span>
              </div>
              <Switch checked={combo.eligible} onCheckedChange={(eligible) => setCombo({ eligible })} label="Ik heb gecontroleerd dat de klant in aanmerking komt" />
              {combo.eligible && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Korting op de Ziggo-rekening" hint={net?.vodafoneDiscountCents != null ? `Referentie bij ${formatSpeed(net.downloadMbps)}: ${formatEuro(net.vodafoneDiscountCents)} per maand` : 'Per maand'} error={combo.monthlyDiscountCents === 0 ? 'Vul het bevestigde bedrag in; zonder bedrag telt er niets mee.' : null}>
                    <MoneyInput value={combo.monthlyDiscountCents} onChange={(c) => setCombo({ monthlyDiscountCents: c ?? 0 })} emptyAsZero placeholder="Invullen" />
                  </Field>
                  <Field label="Korting op de Vodafone-rekening" hint="Alleen bij bevestigd bedrag. Wordt apart getoond en niet van de Ziggo-prijs afgetrokken.">
                    <MoneyInput value={combo.mobileInvoiceDiscountCents ?? 0} onChange={(c) => setCombo({ mobileInvoiceDiscountCents: c ?? 0 })} emptyAsZero placeholder="—" />
                  </Field>
                  <Field label="Extra voordeel (optioneel)" className="sm:col-span-2">
                    <Input value={combo.extraBenefits} onChange={(e) => setCombo({ extraBenefits: e.target.value })} placeholder="Bijv. dubbele data" />
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>
      </More>

      {advanced}
      {editDialog}
    </Card>
  )
}

/** Uitkomst in één zin; gebruikt in stap 2 en in de klantpresentatie. */
export function resultPhrase(o: OptionComparison['view']): { label: string; cents: number; tone: 'good' | 'warn' | 'neutral' } {
  const r = o.result
  if (!r.currentKnown) return { label: `Kosten over ${r.period} maanden`, cents: r.newPeriodCents, tone: 'neutral' }
  if (r.totalSavingsCents > 0) return { label: `Besparing over ${r.period} maanden`, cents: r.totalSavingsCents, tone: 'good' }
  if (r.totalSavingsCents < 0) return { label: `Meer over ${r.period} maanden`, cents: -r.totalSavingsCents, tone: 'warn' }
  return { label: `Zelfde kosten over ${r.period} maanden`, cents: 0, tone: 'neutral' }
}

/** Bedrag invullen en bewust bevestigen (niet per toetsaanslag opslaan). */
function ConfirmAmount({ label, placeholder, note, onConfirm }: { label: string; placeholder: string; note: string; onConfirm: (cents: number) => void }) {
  const [value, setValue] = useState<number | null>(null)
  return (
    <div className="mt-2">
      <div className="flex max-w-[320px] gap-2">
        <div className="flex-1">
          <MoneyInput aria-label={label} value={value} placeholder={placeholder} onChange={setValue} />
        </div>
        <Button variant="primary" disabled={value === null} onClick={() => value !== null && onConfirm(value)}>
          Bevestigen
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

function Summary() {
  const navigate = useNavigate()
  const { active } = useComparison()
  const pricing = useData((s) => s.pricing)
  const updatePricing = useData((s) => s.updatePricing)
  const { builds, activeIndex, setSelection } = useDraft()
  const [calc, setCalc] = useState(false)
  if (!active) {
    return (
      <Card className="grid min-h-[280px] place-items-center p-8 text-center">
        <div>
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <MonitorPlay className="size-7" />
          </div>
          <p className="mt-4 text-lg font-semibold">Kies een internetsnelheid</p>
          <p className="mt-1 text-sm text-muted-foreground">De prijs en het verschil verschijnen hier direct.</p>
        </div>
      </Card>
    )
  }
  const { offer, view } = active
  const sel = builds[activeIndex]?.selection
  const story = priceStory(view)
  const res = resultPhrase(view)
  const blockers = active.issues.filter((i) => i.blocking)
  const notes = active.issues.filter((i) => !i.blocking)
  const stale = staleCount(pricing, view.startDate)
  return (
    <Card className="space-y-5 p-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {offer.provider}
          {offer.isExample && <Badge tone="accent">Voorbeeldprijzen</Badge>}
        </div>
        <h2 className="mt-1 text-xl font-semibold leading-tight tracking-tight">{offer.name}</h2>
      </div>

      {active.blocked ? (
        <div className="space-y-3 rounded-2xl bg-warn-soft p-4">
          <div className="flex items-center gap-2 font-semibold text-warn">
            <AlertTriangle className="size-5" /> Prijs of combinatie nog controleren
          </div>
          <p className="text-sm text-muted-foreground">Zolang dit openstaat toont de app geen prijs of besparing aan de klant. Er wordt niets geschat.</p>
          {blockers.map((b) => (
            <div key={b.message} className="rounded-xl bg-card p-3 text-sm">
              <p>{b.message.replace('Prijs of combinatie nog controleren: ', '')}</p>
              {b.needsActivation && (
                <ConfirmAmount label="Eenmalige aansluitkosten" placeholder="Bedrag, 0 mag" note="Wordt bewaard in Prijzen & Aanbiedingen." onConfirm={(c) => updatePricing((p) => ({ ...p, activationCents: c }))} />
              )}
              {b.overrideKey && sel && (
                <ConfirmAmount label="Gecontroleerde prijs per maand" placeholder="Prijs per maand" note="Geldt alleen voor dit advies." onConfirm={(c) => setSelection({ overrides: { ...sel.overrides, [b.overrideKey!]: c } })} />
              )}
            </div>
          ))}
          <Link to="/prijzen" className="inline-block text-sm font-semibold text-primary underline">
            Naar Prijzen &amp; Aanbiedingen
          </Link>
        </div>
      ) : (
        <>
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <AnimatedMoney cents={story.nowCents} className="text-5xl font-semibold tracking-tight" />
              <span className="text-muted-foreground">per maand</span>
            </div>
            <ul className="mt-2 space-y-0.5 text-[15px] text-muted-foreground">
              <li>{story.nowLabel}</li>
              {story.later.map((l) => (
                <li key={l.label}>
                  {l.label} <span className="tnum font-semibold text-foreground">{formatEuro(l.cents)}</span> per maand
                </li>
              ))}
              <li>
                {offer.contractMonths} maanden contract · {view.result.oneTime.totalCents > 0 ? `eenmalig ${formatEuro(view.result.oneTime.totalCents)}` : 'geen eenmalige kosten'}
              </li>
            </ul>
          </div>

          <div className={cn('flex items-center justify-between gap-3 rounded-2xl px-5 py-4', res.tone === 'good' ? 'bg-good-soft' : res.tone === 'warn' ? 'bg-warn-soft' : 'bg-muted')}>
            <span className="text-sm font-medium">{res.label}</span>
            <AnimatedMoney cents={res.cents} decimals="auto" className={cn('text-3xl font-semibold tracking-tight', res.tone === 'good' && 'text-good', res.tone === 'warn' && 'text-warn')} />
          </div>
          {!view.result.currentKnown && <p className="-mt-2 text-xs text-muted-foreground">Vul in stap 1 het huidige maandbedrag in om het verschil te zien.</p>}
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

      <Button variant="primary" size="lg" className="h-16 w-full text-lg" disabled={active.blocked} onClick={() => navigate('/presentatie')}>
        <MonitorPlay /> Toon aan klant
      </Button>
      {!active.blocked && (
        <button type="button" onClick={() => setCalc(true)} className="mx-auto block min-h-[44px] text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Bekijk berekening
        </button>
      )}

      {!active.blocked && (
        <div className="space-y-2 border-t pt-4">
          <ActionBar option={active} />
          <CommissionPeek option={active} />
        </div>
      )}
      {offer.pricesVerifiedOn && (
        <p className={cn('text-center text-xs', stale > 0 ? 'font-medium text-warn' : 'text-muted-foreground')}>
          Prijzen gecontroleerd op {formatDateNl(offer.pricesVerifiedOn)}
          {stale > 0 && ' · langer dan 30 dagen geleden, controleer ze opnieuw'}
        </p>
      )}

      <Dialog wide open={calc} onOpenChange={setCalc} title="Berekening" description={`${offer.provider} ${offer.name}`}>
        <Breakdown view={view} lines={active.lines} />
      </Dialog>
    </Card>
  )
}

/* ---------- pagina ---------- */

export default function AdvicePage() {
  const { step, setStep, reset } = useDraft()
  const { active } = useComparison()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 p-4 sm:p-6 lg:h-full">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Steps step={step} canPresent={!!active && !active.blocked} />
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
            <Builder />
          </div>
          <div className="min-w-0 lg:overflow-y-auto lg:pb-6">
            <Summary />
          </div>
        </div>
      )}

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Nieuw advies starten?"
        description="Het huidige advies wordt leeggemaakt. Opgeslagen adviezen blijven bewaard."
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
