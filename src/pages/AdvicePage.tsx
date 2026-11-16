import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Gift, Minus, MonitorPlay, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActionBar, CommissionPeek } from '@/components/ActionBar'
import { AnimatedMoney } from '@/components/AnimatedMoney'
import { Breakdown } from '@/components/Breakdown'
import { ListEditor } from '@/components/ListEditor'
import { OfferForm, validateOffer } from '@/components/OfferForm'
import { OptionTabs } from '@/components/OptionTabs'
import { Button } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, NumberInput, Segmented, Select, Switch } from '@/components/ui/inputs'
import { formatSpeed, isActive, togglePromotion } from '@/engine/catalog'
import { priceStory } from '@/engine/customerView'
import { newId } from '@/engine/defaults'
import { formatEuro } from '@/engine/money'
import type { Offer } from '@/engine/types'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { MAX_OPTIONS, useComparison, useDraft, type OptionComparison } from '@/store/draft'

const PROVIDERS = ['KPN', 'Odido', 'Ziggo', 'Delta', 'Youfone', 'Budget Thuis']
const eur = (c: number) => formatEuro(c, { decimals: 'auto' })

export function offerPriceLine(o: Offer): string {
  if (o.promoMonths <= 0 || o.promoMonthlyCents === o.regularMonthlyCents) return `${formatEuro(o.regularMonthlyCents)} per maand`
  return `${formatEuro(o.promoMonthlyCents)} × ${o.promoMonths} mnd, daarna ${formatEuro(o.regularMonthlyCents)}`
}

/* ---------- gedeelde bouwstenen ---------- */

function Tile({ active, onClick, children, className, disabled, plain }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean; plain?: boolean }) {
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

const SectionTitle = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className="mb-3 flex items-baseline justify-between gap-3">
    <h2 className="text-[17px] font-semibold tracking-tight">{children}</h2>
    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
  </div>
)

function More({ label, children, defaultOpen }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
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

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <SectionTitle>Wat heeft de klant?</SectionTitle>
            <Segmented aria-label="Huidig pakket" value={current.hasTv ? 'tv' : 'net'} onChange={(v) => setCurrent({ hasTv: v === 'tv' })} options={[{ value: 'net', label: 'Alleen internet' }, { value: 'tv', label: 'Internet + TV' }]} />
          </div>
          <div>
            <SectionTitle hint="optioneel">Contract loopt tot</SectionTitle>
            <Input type="date" aria-label="Einddatum huidig contract" value={current.contractEndDate ?? ''} onChange={(e) => setCurrent({ contractEndDate: e.target.value || null })} />
          </div>
        </div>

        <More label="Meer details (optioneel)">
          <div className="grid gap-3 sm:grid-cols-3">
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Kosten om nu op te zeggen" hint="Telt mee als eenmalige kosten">
              <MoneyInput value={current.cancellationCents} onChange={(c) => setCurrent({ cancellationCents: c ?? 0 })} emptyAsZero />
            </Field>
            <Field label="Verwacht nieuw maandbedrag" hint="Leeg = blijft gelijk">
              <MoneyInput value={current.futureMonthlyCents} onChange={(c) => setCurrent({ futureMonthlyCents: c })} placeholder="—" />
            </Field>
            <Field label="Vanaf maand">
              <NumberInput value={current.futureFromMonth} onChange={(n) => setCurrent({ futureFromMonth: Math.max(1, n ?? 1) })} min={1} max={24} />
            </Field>
          </div>
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

function Builder() {
  const catalog = useData((s) => s.catalog)
  const bundles = useData((s) => s.offers)
  const { builds, activeIndex, setSelection, setSnapshot, combo, setCombo, period, setPeriod, startDate, addOption, removeOption } = useDraft()
  const { all, active } = useComparison()
  const build = builds[activeIndex] ?? builds[0]
  const sel = build.selection
  const [editing, setEditing] = useState<Offer | null>(null)
  const errors = editing ? validateOffer(editing) : []

  const internet = catalog.internet.filter((i) => isActive(i, startDate) || i.id === sel.internetId)
  const tvs = catalog.tv.filter((t) => t.available || t.id === sel.tvId)
  const bundle = sel.bundleId ? bundles.find((b) => b.id === sel.bundleId) : undefined
  const hasTv = bundle ? bundle.kind === 'internet_tv' : !!sel.tvId
  const tv = catalog.tv.find((t) => t.id === sel.tvId)
  const extras = catalog.extras.filter((e) => (e.available || sel.extraIds.includes(e.id)) && (!e.requiresTv || hasTv))
  const promos = catalog.promotions.filter((p) => (isActive(p, startDate) || sel.promotionIds.includes(p.id)) && (!p.requiresTv || hasTv))
  const comboOn = combo.hasVodafone && combo.eligible
  const contract = sel.contractMonths ?? active?.offer.contractMonths ?? 24

  const advanced = (
    <More label="Geavanceerd" defaultOpen={contract === 12 || builds.length > 1 || !!bundle}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contractduur" hint="Standaard 24 maanden">
          <Segmented value={contract} onChange={(m) => setSelection({ contractMonths: m })} options={[{ value: 24, label: '24 maanden' }, { value: 12, label: '12 maanden' }]} />
        </Field>
        <Field label="Vergelijken over" hint="Standaard 24 maanden">
          <Segmented value={period} onChange={setPeriod} options={[{ value: 24, label: '24 maanden' }, { value: 12, label: '12 maanden' }]} />
        </Field>
      </div>
      {bundles.length > 0 && (
        <Field label="Vaste bundel gebruiken" hint="Eén totaalprijs voor internet (en tv), in plaats van losse onderdelen.">
          <Select value={sel.bundleId ?? ''} onChange={(e) => setSelection({ bundleId: e.target.value || null })}>
            <option value="">Geen – losse onderdelen</option>
            {bundles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.isExample ? ' (voorbeeld)' : ''}
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
            <Pencil /> Prijzen aanpassen voor deze klant
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
    <Card className="space-y-7 p-5 sm:p-6">
      {bundle ? (
        <section>
          <SectionTitle>Vaste bundel</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-primary bg-primary-soft/60 p-4">
            <div>
              <div className="text-lg font-semibold">{bundle.name}</div>
              <div className="tnum text-sm text-muted-foreground">{offerPriceLine(bundle)}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelection({ bundleId: null })}>
              Losse onderdelen kiezen
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section>
            <SectionTitle>Internetsnelheid</SectionTitle>
            {internet.length === 0 ? (
              <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                Er zijn geen beschikbare internetpakketten.{' '}
                <Link to="/prijzen" className="font-semibold text-primary underline">
                  Voeg ze toe bij Prijzen &amp; Aanbiedingen
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {internet.map((i) => {
                  const promo = i.promoMonthlyCents !== null && i.promoMonths > 0
                  return (
                    <Tile key={i.id} active={sel.internetId === i.id} onClick={() => setSelection({ internetId: i.id })}>
                      <div className="text-2xl font-semibold tracking-tight">{formatSpeed(i.downloadMbps)}</div>
                      {i.regularMonthlyCents === null ? (
                        <div className="mt-1 text-sm font-semibold text-warn">Prijs ontbreekt</div>
                      ) : (
                        <div className="tnum mt-1 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{formatEuro(promo ? i.promoMonthlyCents! : i.regularMonthlyCents)}</span> p/m
                          {promo && <span className="block text-xs">daarna {formatEuro(i.regularMonthlyCents)}</span>}
                        </div>
                      )}
                    </Tile>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <SectionTitle>Televisie</SectionTitle>
            <Segmented aria-label="Televisie" value={sel.tvId ? 'tv' : 'net'} onChange={(v) => setSelection({ tvId: v === 'tv' ? (tvs[0]?.id ?? null) : null, extraReceivers: 0 })} options={[{ value: 'net', label: 'Alleen internet' }, { value: 'tv', label: 'Internet + TV' }]} />
            {sel.tvId && tvs.length > 1 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {tvs.map((t) => (
                  <Tile key={t.id} active={sel.tvId === t.id} onClick={() => setSelection({ tvId: t.id })}>
                    <div className="pr-8 text-[16px] font-semibold">{t.name}</div>
                    <div className="tnum text-sm text-muted-foreground">{t.monthlyCents === null ? <span className="font-semibold text-warn">Prijs ontbreekt</span> : `+ ${formatEuro(t.monthlyCents)} p/m`}</div>
                    {t.features && <div className="mt-1 text-xs text-muted-foreground">{t.features}</div>}
                  </Tile>
                ))}
              </div>
            )}
            {catalog.tv.length === 0 && sel.tvId === null && <p className="mt-2 text-xs text-muted-foreground">Er zijn nog geen tv-pakketten ingesteld.</p>}
          </section>
        </>
      )}

      {(extras.length > 0 || (tv && !bundle)) && (
        <section>
          <SectionTitle hint="optioneel">Extra's</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {extras.map((e) => {
              const on = sel.extraIds.includes(e.id)
              return (
                <button key={e.id} type="button" aria-pressed={on} onClick={() => setSelection({ extraIds: on ? sel.extraIds.filter((x) => x !== e.id) : [...sel.extraIds, e.id] })} className={cn('flex h-12 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition-all active:scale-95', on ? 'border-primary bg-primary text-white' : 'border-border bg-card hover:border-primary/40')}>
                  {on && <Check className="size-4" strokeWidth={3} />}
                  {e.name}
                  <span className={cn('tnum font-normal', on ? 'text-white/80' : 'text-muted-foreground')}>{e.monthlyCents === null ? 'prijs ontbreekt' : `+ ${eur(e.monthlyCents)}`}</span>
                </button>
              )
            })}
            {tv && !bundle && (
              <div className="flex h-12 items-center gap-1 rounded-full border-2 border-border bg-card pl-4 pr-1 text-sm font-semibold">
                Extra ontvangers
                <button type="button" aria-label="Minder ontvangers" disabled={sel.extraReceivers === 0} onClick={() => setSelection({ extraReceivers: sel.extraReceivers - 1 })} className="ml-2 grid size-10 place-items-center rounded-full hover:bg-muted disabled:opacity-30">
                  <Minus className="size-4" />
                </button>
                <span className="tnum w-5 text-center">{sel.extraReceivers}</span>
                <button type="button" aria-label="Meer ontvangers" disabled={sel.extraReceivers >= 5} onClick={() => setSelection({ extraReceivers: sel.extraReceivers + 1 })} className="grid size-10 place-items-center rounded-full hover:bg-muted disabled:opacity-30">
                  <Plus className="size-4" />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {promos.length > 0 && (
        <section>
          <SectionTitle hint="alleen wat voor deze klant geldt">Acties</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {promos.map((p) => (
              <Tile key={p.id} active={sel.promotionIds.includes(p.id)} onClick={() => setSelection({ promotionIds: togglePromotion(catalog, sel.promotionIds, p.id) })} className="min-h-[60px] py-3">
                <div className="flex items-center gap-2 pr-8 text-[15px] font-semibold">
                  {p.gift && <Gift className="size-4 shrink-0 text-accent" />}
                  {p.name}
                </div>
                {p.conditions && <div className="mt-0.5 text-xs text-muted-foreground">{p.conditions}</div>}
              </Tile>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle hint="optioneel">Vodafone</SectionTitle>
        <div className="rounded-2xl border-2 border-border px-4 py-1">
          <Switch
            checked={comboOn}
            onCheckedChange={(on) => setCombo({ hasVodafone: on, eligible: on, monthlyDiscountCents: on ? (combo.monthlyDiscountCents || catalog.vodafone.monthlyDiscountCents || 0) : combo.monthlyDiscountCents, extraBenefits: on ? combo.extraBenefits || catalog.vodafone.extraBenefits : combo.extraBenefits })}
            label="Klant heeft Vodafone en komt in aanmerking"
            description="Niet elk Vodafone-abonnement geeft recht op combinatievoordeel."
          />
          {comboOn && (
            <div className="grid animate-fade-up gap-3 pb-3 pt-1 sm:grid-cols-2">
              <Field label="Korting per maand" error={combo.monthlyDiscountCents === 0 ? 'Vul de gecontroleerde korting in; zonder bedrag telt er niets mee.' : null}>
                <MoneyInput value={combo.monthlyDiscountCents} onChange={(c) => setCombo({ monthlyDiscountCents: c ?? 0 })} emptyAsZero placeholder="Invullen" />
              </Field>
              <Field label="Extra voordeel (optioneel)">
                <Input value={combo.extraBenefits} onChange={(e) => setCombo({ extraBenefits: e.target.value })} placeholder="Bijv. dubbele data" />
              </Field>
            </div>
          )}
        </div>
      </section>

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

function Summary() {
  const navigate = useNavigate()
  const { active } = useComparison()
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
  const story = priceStory(view)
  const res = resultPhrase(view)
  const blocked = active.missing.length > 0
  return (
    <Card className="space-y-5 p-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {offer.provider}
          {offer.isExample && <Badge tone="accent">Voorbeeldprijzen</Badge>}
        </div>
        <h2 className="mt-1 text-xl font-semibold leading-tight tracking-tight">{offer.name}</h2>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
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
            {offer.contractMonths} maanden contract
            {view.result.oneTime.totalCents > 0 && <> · eenmalig {formatEuro(view.result.oneTime.totalCents)}</>}
          </li>
        </ul>
      </div>

      <div className={cn('flex items-center justify-between gap-3 rounded-2xl px-5 py-4', res.tone === 'good' ? 'bg-good-soft' : res.tone === 'warn' ? 'bg-warn-soft' : 'bg-muted')}>
        <span className="text-sm font-medium">{res.label}</span>
        <AnimatedMoney cents={res.cents} decimals="auto" className={cn('text-3xl font-semibold tracking-tight', res.tone === 'good' && 'text-good', res.tone === 'warn' && 'text-warn')} />
      </div>
      {!view.result.currentKnown && <p className="-mt-2 text-xs text-muted-foreground">Vul in stap 1 het huidige maandbedrag in om het verschil te zien.</p>}

      {blocked && (
        <div className="flex gap-3 rounded-2xl bg-warn-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
          <div>
            <p className="font-semibold">Er ontbreekt een prijs</p>
            <p className="text-muted-foreground">{active.missing.join(', ')}. De app vult geen bedrag voor u in.</p>
            <Link to="/prijzen" className="mt-1 inline-block font-semibold text-primary underline">
              Prijs invullen
            </Link>
          </div>
        </div>
      )}

      <Button variant="primary" size="lg" className="h-16 w-full text-lg" disabled={blocked} onClick={() => navigate('/presentatie')}>
        <MonitorPlay /> Toon aan klant
      </Button>
      <button type="button" onClick={() => setCalc(true)} className="mx-auto block min-h-[44px] text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Bekijk berekening
      </button>

      <div className="space-y-2 border-t pt-4">
        <ActionBar option={active} />
        <CommissionPeek option={active} />
      </div>

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
        <Steps step={step} canPresent={!!active && active.missing.length === 0} />
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
