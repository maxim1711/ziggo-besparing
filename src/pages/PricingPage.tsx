import { AlertTriangle, Check, Download, ExternalLink, Gift as GiftIcon, Pencil, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { GiftImage } from '@/components/GiftImage'
import { Page, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, NumberInput, Segmented, Select, Switch, Textarea } from '@/components/ui/inputs'
import { formatDateNl, todayIso } from '@/engine/dates'
import { newId } from '@/engine/defaults'
import { formatEuro } from '@/engine/money'
import { findPrice, formatSpeed, isVerifiedPrice, keysInCategory, PACKAGE_CATEGORIES, packageKey, parsePricingExport, promotionMonths, type PackageCategory, PRICING_SCHEMA_VERSION, staleCount, type ExtraCategory, type GiftDefinition, type PricingCatalog, type Promotion, type PromotionChannel, type PromotionStatus, type Source, type TvPackage } from '@/engine/pricing'
import type { GiftType } from '@/engine/types'
import { cn, downloadFile } from '@/lib/utils'
import { PRE_V3_BACKUP_KEY, useData } from '@/store/data'
import { toast } from '@/store/toast'
import BundlesPanel from './OffersPage'

type Tab = 'internet' | 'tv' | 'allin1' | 'extras' | 'vodafone' | 'promos' | 'mine' | 'gifts' | 'backup' | 'old'

const CATEGORY: Record<ExtraCategory, string> = { apparatuur: 'Apparatuur', sport: 'Sport', entertainment: 'Film en zenders', bundel: 'Voordeelbundels', streaming: 'Streaming', specialistisch: 'Meer opties' }
const STATUS: Record<PromotionStatus, { label: string; tone: 'good' | 'accent' | 'neutral' }> = { concept: { label: 'Concept', tone: 'accent' }, gecontroleerd: { label: 'Gecontroleerd', tone: 'good' }, verlopen: { label: 'Verlopen', tone: 'neutral' } }

/* ---------- kleine bouwstenen ---------- */

function Verified({ source }: { source: Source }) {
  return source.verifiedOn ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3.5 text-good" /> {formatDateNl(source.verifiedOn)}
      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer" aria-label="Bron openen" className="text-primary" onClick={(e) => e.stopPropagation()}>
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </span>
  ) : (
    <Badge tone="warn">Niet gecontroleerd</Badge>
  )
}

function SourceFields({ source, onChange }: { source: Source; onChange: (s: Source) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <Field label="Bron (link)">
        <Input type="url" inputMode="url" value={source.url ?? ''} onChange={(e) => onChange({ ...source, url: e.target.value || null })} placeholder="https://…" />
      </Field>
      <Field label="Laatst gecontroleerd">
        <div className="flex gap-2">
          <Input type="date" value={source.verifiedOn ?? ''} onChange={(e) => onChange({ ...source, verifiedOn: e.target.value || null })} />
          <Button onClick={() => onChange({ ...source, verifiedOn: todayIso() })}>Vandaag</Button>
        </div>
      </Field>
    </div>
  )
}

const usePricing = () => {
  const pricing = useData((s) => s.pricing)
  const update = useData((s) => s.updatePricing)
  return { pricing, update }
}

/** Prijs in de matrix zetten. Een ingevuld bedrag geldt als vandaag gecontroleerd. */
function setMatrixPrice(c: PricingCatalog, internetId: string, tvId: string | null, phone: boolean, cents: number | null): PricingCatalog {
  const existing = findPrice(c, internetId, tvId, phone)
  const source: Source = { url: existing?.source.url ?? null, verifiedOn: cents === null ? null : todayIso() }
  const entry = { internetId, tvId, phone, cents, source }
  return { ...c, prices: existing ? c.prices.map((p) => (p === existing ? entry : p)) : [...c.prices, entry] }
}

function Grid({ pricing, columns, get, set, verifiedOf, nullLabel = 'Alleen internet' }: { pricing: PricingCatalog; columns: (TvPackage | null)[]; nullLabel?: string; get: (internetId: string, tvId: string | null) => number | null; set: (internetId: string, tvId: string | null, cents: number | null) => void; verifiedOf?: (internetId: string, tvId: string | null) => string | null }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-separate border-spacing-x-2 border-spacing-y-2', columns.length > 2 ? 'min-w-[560px]' : 'max-w-[420px]')}>
        <thead>
          <tr className="text-left text-sm text-muted-foreground">
            <th className="font-medium">Internet</th>
            {columns.map((t) => (
              <th key={t?.id ?? 'geen'} className="font-medium">
                {t?.name ?? nullLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pricing.internet.map((i) => (
            <tr key={i.id}>
              <td className="whitespace-nowrap pr-2">
                <div className="font-semibold">{formatSpeed(i.downloadMbps)}</div>
                {!i.available && <div className="text-xs text-warn">niet beschikbaar</div>}
              </td>
              {columns.map((t) => {
                const v = verifiedOf?.(i.id, t?.id ?? null)
                return (
                  <td key={t?.id ?? 'geen'} className="min-w-[120px]">
                    <MoneyInput aria-label={`${i.name} ${t?.name ?? nullLabel.toLowerCase()}`} value={get(i.id, t?.id ?? null)} onChange={(c) => set(i.id, t?.id ?? null, c)} placeholder="—" />
                    {verifiedOf && <div className="mt-0.5 h-4 text-[11px] text-muted-foreground">{v ? `✓ ${v.slice(8)}-${v.slice(5, 7)}-${v.slice(0, 4)}` : get(i.id, t?.id ?? null) !== null ? 'niet gecontroleerd' : ''}</div>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({ title, badges, sub, right, onEdit }: { title: string; badges?: ReactNode; sub?: ReactNode; right?: ReactNode; onEdit: () => void }) {
  return (
    <div className="flex min-h-[72px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <button type="button" onClick={onEdit} className="min-w-[180px] flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold">{title}</span>
          {badges}
        </div>
        {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      </button>
      {right}
      <Button size="icon" variant="ghost" aria-label={`${title} bewerken`} onClick={onEdit}>
        <Pencil />
      </Button>
    </div>
  )
}

function EditDialog<T extends { id: string; name: string }>({ item, isNew, title, onClose, onSave, onDelete, children }: { item: T | null; isNew: boolean; title: string; onClose: () => void; onSave: () => void; onDelete?: () => void; children: ReactNode }) {
  return (
    <Dialog
      wide
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? `${title} toevoegen` : `${title} bewerken`}
      footer={
        <>
          {!isNew && onDelete && (
            <Button variant="danger" className="mr-auto" onClick={onDelete}>
              <Trash2 /> Verwijderen
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="primary" disabled={!item?.name.trim()} onClick={onSave}>
            Opslaan
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}

/** Lijstbewerking voor één onderdeel van de catalogus. */
function useList<K extends 'internet' | 'tv' | 'extras' | 'gifts' | 'promotions'>(key: K) {
  type T = PricingCatalog[K][number]
  const { pricing, update } = usePricing()
  const [editing, setEditing] = useState<T | null>(null)
  const items = pricing[key] as T[]
  const isNew = editing ? !items.some((i) => i.id === editing.id) : false
  const write = (next: T[]) => update((c) => ({ ...c, [key]: next }) as PricingCatalog)
  return {
    pricing,
    update,
    items,
    editing,
    isNew,
    setEditing,
    patch: (p: Partial<T>) => setEditing((e) => (e ? ({ ...e, ...p } as T) : e)),
    patchItem: (id: string, p: Partial<T>) => write(items.map((i) => (i.id === id ? ({ ...i, ...p } as T) : i))),
    save: () => {
      if (!editing) return
      write(isNew ? [...items, editing] : items.map((i) => (i.id === editing.id ? editing : i)))
      setEditing(null)
      toast('Opgeslagen')
    },
    remove: () => {
      if (!editing) return
      write(items.filter((i) => i.id !== editing.id))
      setEditing(null)
      toast('Verwijderd')
    },
  }
}

const match = (q: string, ...texts: (string | null | undefined)[]) => !q.trim() || texts.some((t) => t?.toLowerCase().includes(q.trim().toLowerCase()))

/* ---------- Internet ---------- */

function InternetPanel({ q }: { q: string }) {
  const l = useList('internet')
  const { pricing, update } = l
  const e = l.editing
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="max-w-md">
          <h2 className="text-[16px] font-semibold">Eenmalige aansluitkosten</h2>
          <p className="text-sm text-muted-foreground">Telt mee in elke vergelijking. Vul € 0 in als er geen kosten zijn. Leeg = de app vraagt erom.</p>
        </div>
        <div className="w-[180px]">
          <MoneyInput aria-label="Eenmalige aansluitkosten" value={pricing.activationCents} onChange={(c) => update((p) => ({ ...p, activationCents: c }))} placeholder="Invullen" />
        </div>
      </Card>
      <Card className="divide-y overflow-hidden">
        {l.items
          .filter((i) => match(q, i.name, formatSpeed(i.downloadMbps)))
          .map((i) => {
            const price = findPrice(pricing, i.id, null, false)
            return (
              <Row
                key={i.id}
                title={i.name}
                onEdit={() => l.setEditing(structuredClone(i))}
                badges={price?.cents == null ? <Badge tone="warn">Prijs niet gecontroleerd</Badge> : undefined}
                sub={
                  <>
                    {formatSpeed(i.downloadMbps)} download{i.uploadMbps ? ` · ${formatSpeed(i.uploadMbps)} upload` : ''} · {i.includedExtenders} wifi-versterker(s) inbegrepen {price && price.cents !== null && <Verified source={price.source} />}
                  </>
                }
                right={
                  <div className="flex items-center gap-3">
                    <div className="w-[130px]">
                      <MoneyInput aria-label={`Prijs ${i.name} alleen internet`} value={price?.cents ?? null} onChange={(c) => update((p) => setMatrixPrice(p, i.id, null, false, c))} placeholder="Invullen" />
                    </div>
                    <div>
                      <Switch checked={i.available} onCheckedChange={(available) => l.patchItem(i.id, { available })} label="Beschikbaar" compact />
                    </div>
                  </div>
                }
              />
            )
          })}
      </Card>
      <Button variant="secondary" onClick={() => l.setEditing({ id: newId(), name: '', downloadMbps: 0, uploadMbps: null, includedExtenders: 0, vodafoneDiscountCents: null, available: false, source: { url: null, verifiedOn: null }, internalNotes: '' })}>
        <Plus /> Internetpakket toevoegen
      </Button>
      <p className="text-xs text-muted-foreground">De schakelaar bepaalt of het pakket te kiezen is. Prijzen met tv staan op de tabbladen “Internet + TV” en “Alles-in-1”.</p>
      <EditDialog item={e} isNew={l.isNew} title="Internetpakket" onClose={() => l.setEditing(null)} onSave={l.save} onDelete={l.remove}>
        {e && (
          <div className="space-y-4">
            <Field label="Naam">
              <Input value={e.name} onChange={(ev) => l.patch({ name: ev.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Downloadsnelheid">
                <NumberInput value={e.downloadMbps} onChange={(n) => l.patch({ downloadMbps: n ?? 0 })} suffix="Mbit/s" max={100000} />
              </Field>
              <Field label="Uploadsnelheid">
                <NumberInput value={e.uploadMbps} onChange={(n) => l.patch({ uploadMbps: n })} nullable suffix="Mbit/s" max={100000} />
              </Field>
              <Field label="Wifi-versterkers inbegrepen">
                <NumberInput value={e.includedExtenders} onChange={(n) => l.patch({ includedExtenders: n ?? 0 })} max={9} />
              </Field>
              <Field label="Vodafone-korting (referentie)" hint="Per maand op de Ziggo-rekening; leeg = onbekend">
                <MoneyInput value={e.vodafoneDiscountCents} onChange={(c) => l.patch({ vodafoneDiscountCents: c })} placeholder="—" />
              </Field>
            </div>
            <SourceFields source={e.source} onChange={(source) => l.patch({ source })} />
            <Field label="Interne notities" hint="Nooit zichtbaar voor de klant">
              <Textarea value={e.internalNotes} onChange={(ev) => l.patch({ internalNotes: ev.target.value })} />
            </Field>
            <div className="rounded-2xl bg-muted/60 px-4 py-1">
              <Switch checked={e.available} onCheckedChange={(available) => l.patch({ available })} label="Beschikbaar in de pakketbouwer" description="Zet pas aan als prijs en beschikbaarheid zijn gecontroleerd." />
            </div>
          </div>
        )}
      </EditDialog>
    </div>
  )
}

/* ---------- Internet + TV en Alles-in-1 ---------- */

function MatrixPanel({ phone }: { phone: boolean }) {
  const l = useList('tv')
  const { pricing, update } = l
  const e = l.editing
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-[16px] font-semibold">{phone ? 'Alles-in-1: internet + tv + vast bellen' : 'Internet + TV'}</h2>
        <p className="mb-3 text-sm text-muted-foreground">Volledige pakketprijs per maand, inclusief btw. De app telt nooit een losse tv-prijs bij internet op. Een gewijzigd bedrag geldt als vandaag gecontroleerd.</p>
        <Grid pricing={pricing} nullLabel="Internet + vaste telefonie" columns={phone ? [null, ...pricing.tv] : pricing.tv} get={(n, t) => findPrice(pricing, n, t, phone)?.cents ?? null} set={(n, t, c) => update((p) => setMatrixPrice(p, n, t, phone, c))} verifiedOf={(n, t) => findPrice(pricing, n, t, phone)?.source.verifiedOn ?? null} />
        {phone && <p className="mt-2 text-xs text-muted-foreground">“Internet + vaste telefonie” (zonder tv) stond niet in de gecontroleerde tabel; vul de normale maandprijs in zodra u die hebt gecontroleerd. Die prijs geldt na een actieperiode. Belkosten zelf worden niet berekend.</p>}
      </Card>
      {!phone && (
        <>
          <Card className="divide-y overflow-hidden">
            {l.items.map((t) => (
              <Row
                key={t.id}
                title={t.name}
                onEdit={() => l.setEditing(structuredClone(t))}
                sub={t.features.join(' · ')}
                right={
                  <div>
                    <Switch checked={t.available} onCheckedChange={(available) => l.patchItem(t.id, { available })} label="Beschikbaar" compact />
                  </div>
                }
              />
            ))}
          </Card>
          <Button variant="secondary" onClick={() => l.setEditing({ id: newId(), name: '', features: [], includedReceivers: 1, includes: [], available: true, source: { url: null, verifiedOn: null } })}>
            <Plus /> Tv-pakket toevoegen
          </Button>
        </>
      )}
      <EditDialog item={e} isNew={l.isNew} title="Tv-pakket" onClose={() => l.setEditing(null)} onSave={l.save} onDelete={l.remove}>
        {e && (
          <div className="space-y-4">
            <Field label="Naam">
              <Input value={e.name} onChange={(ev) => l.patch({ name: ev.target.value })} />
            </Field>
            <Field label="Omschrijving voor de klant" hint="Eén punt per regel; houd het kort">
              <Textarea value={e.features.join('\n')} onChange={(ev) => l.patch({ features: ev.target.value.split('\n') })} onBlur={() => l.patch({ features: e.features.map((f) => f.trim()).filter(Boolean) })} />
            </Field>
            <Field label="Ontvangers inbegrepen">
              <NumberInput value={e.includedReceivers} onChange={(n) => l.patch({ includedReceivers: n ?? 0 })} max={9} />
            </Field>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">Al inbegrepen diensten (worden nooit apart berekend)</span>
              <div className="flex flex-wrap gap-2">
                {pricing.extras
                  .filter((x) => x.category !== 'apparatuur')
                  .map((x) => {
                    const on = e.includes.includes(x.id)
                    return (
                      <button key={x.id} type="button" aria-pressed={on} onClick={() => l.patch({ includes: on ? e.includes.filter((i) => i !== x.id) : [...e.includes, x.id] })} className={cn('h-10 rounded-full border px-3 text-sm font-medium', on ? 'border-good bg-good-soft text-good' : 'bg-card text-muted-foreground')}>
                        {on && '✓ '}
                        {x.name}
                      </button>
                    )
                  })}
              </div>
            </div>
            <SourceFields source={e.source} onChange={(source) => l.patch({ source })} />
          </div>
        )}
      </EditDialog>
    </div>
  )
}

/* ---------- Extra diensten ---------- */

function ExtrasPanel({ q }: { q: string }) {
  const l = useList('extras')
  const e = l.editing
  const today = todayIso()
  const groups = (Object.keys(CATEGORY) as ExtraCategory[]).map((c) => ({ c, items: l.items.filter((x) => x.category === c && match(q, x.name, CATEGORY[c])) })).filter((g) => g.items.length)
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.c}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{CATEGORY[g.c]}</h2>
          <Card className="divide-y overflow-hidden">
            {g.items.map((x) => (
              <Row
                key={x.id}
                title={x.name}
                onEdit={() => l.setEditing(structuredClone(x))}
                badges={
                  <>
                    {x.monthlyCents === null && <Badge tone="warn">{x.fromCents !== null ? `Vanaf ${formatEuro(x.fromCents)} – exacte prijs invullen` : 'Prijs invullen'}</Badge>}
                    {x.includes.length > 0 && <Badge tone="primary">Bundel</Badge>}
                  </>
                }
                sub={
                  <>
                    {x.requiresTv ? 'Alleen bij tv' : 'Ook zonder tv'}
                    {x.countable && ' · aantal instelbaar'}
                    {x.includes.length > 0 && ` · bevat: ${x.includes.map((id) => l.items.find((i) => i.id === id)?.name ?? id).join(', ')}`} {x.monthlyCents !== null && <Verified source={x.source} />}
                  </>
                }
                right={
                  <div className="flex items-center gap-3">
                    <div className="w-[130px]">
                      <MoneyInput aria-label={`Prijs ${x.name}`} value={x.monthlyCents} onChange={(c) => l.patchItem(x.id, { monthlyCents: c, source: { ...x.source, verifiedOn: c === null ? null : today } })} placeholder="Invullen" />
                    </div>
                    <div>
                      <Switch checked={x.available} onCheckedChange={(available) => l.patchItem(x.id, { available })} label="Beschikbaar" compact />
                    </div>
                  </div>
                }
              />
            ))}
          </Card>
        </div>
      ))}
      {groups.length === 0 && (
        <Card>
          <EmptyState icon={<Search />} title="Niets gevonden" text="Pas de zoekterm aan of voeg een dienst toe." />
        </Card>
      )}
      <Button variant="secondary" onClick={() => l.setEditing({ id: newId(), name: '', category: 'entertainment', monthlyCents: null, fromCents: null, oneTimeCents: 0, requiresTv: true, countable: false, maxQuantity: 1, includes: [], eligibilityNote: '', moreOptions: false, available: true, source: { url: null, verifiedOn: null } })}>
        <Plus /> Dienst toevoegen
      </Button>
      <p className="text-xs text-muted-foreground">Diensten zonder exacte prijs (bijvoorbeeld met alleen een “vanaf”-prijs) zijn niet te kiezen in de pakketbouwer. Dit zijn referentieprijzen; niet elke dienst is bij elk pakket te bestellen.</p>
      <EditDialog item={e} isNew={l.isNew} title="Extra dienst" onClose={() => l.setEditing(null)} onSave={l.save} onDelete={l.remove}>
        {e && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Naam">
                <Input value={e.name} onChange={(ev) => l.patch({ name: ev.target.value })} />
              </Field>
              <Field label="Categorie">
                <Select value={e.category} onChange={(ev) => l.patch({ category: ev.target.value as ExtraCategory, moreOptions: ev.target.value === 'specialistisch' })}>
                  {Object.entries(CATEGORY).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Exacte prijs per maand" hint="Leeg = niet te kiezen">
                <MoneyInput value={e.monthlyCents} onChange={(c) => l.patch({ monthlyCents: c })} placeholder="Invullen" />
              </Field>
              <Field label="“Vanaf”-prijs (alleen ter info)">
                <MoneyInput value={e.fromCents} onChange={(c) => l.patch({ fromCents: c })} placeholder="—" />
              </Field>
              <Field label="Eenmalige kosten">
                <MoneyInput value={e.oneTimeCents} onChange={(c) => l.patch({ oneTimeCents: c ?? 0 })} emptyAsZero />
              </Field>
              <Field label="Maximaal aantal" hint="Alleen als het aantal instelbaar is">
                <NumberInput value={e.maxQuantity} onChange={(n) => l.patch({ maxQuantity: Math.max(1, n ?? 1) })} min={1} max={9} />
              </Field>
            </div>
            <div className="rounded-2xl bg-muted/60 px-4 py-1">
              <Switch checked={e.requiresTv} onCheckedChange={(requiresTv) => l.patch({ requiresTv })} label="Alleen bij een tv-pakket" />
              <Switch checked={e.countable} onCheckedChange={(countable) => l.patch({ countable })} label="Aantal instelbaar" description="Voor ontvangers en wifi-versterkers." />
              <Switch checked={e.moreOptions} onCheckedChange={(moreOptions) => l.patch({ moreOptions })} label="Alleen tonen onder “Meer opties”" />
              <Switch checked={e.available} onCheckedChange={(available) => l.patch({ available })} label="Beschikbaar" />
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">Bundel: bevat deze diensten (worden dan niet apart berekend)</span>
              <div className="flex flex-wrap gap-2">
                {l.items
                  .filter((x) => x.id !== e.id && x.category !== 'apparatuur')
                  .map((x) => {
                    const on = e.includes.includes(x.id)
                    return (
                      <button key={x.id} type="button" aria-pressed={on} onClick={() => l.patch({ includes: on ? e.includes.filter((i) => i !== x.id) : [...e.includes, x.id] })} className={cn('h-10 rounded-full border px-3 text-sm font-medium', on ? 'border-primary bg-primary-soft text-primary' : 'bg-card text-muted-foreground')}>
                        {on && '✓ '}
                        {x.name}
                      </button>
                    )
                  })}
              </div>
            </div>
            <Field label="Aandachtspunt voor de adviseur" hint="Verschijnt als melding zodra de dienst is gekozen">
              <Input value={e.eligibilityNote} onChange={(ev) => l.patch({ eligibilityNote: ev.target.value })} />
            </Field>
            <SourceFields source={e.source} onChange={(source) => l.patch({ source })} />
          </div>
        )}
      </EditDialog>
    </div>
  )
}

/* ---------- Vodafone ---------- */

function VodafonePanel() {
  const { pricing, update } = usePricing()
  return (
    <div className="max-w-3xl space-y-4">
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-[16px] font-semibold">Referentiekorting op de Ziggo-rekening, per snelheid</h2>
          <p className="text-sm text-muted-foreground">Wordt alleen voorgesteld na “Heeft u Vodafone?” en telt pas mee als u de geschiktheid heeft bevestigd. Per klant aan te passen.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {pricing.internet.map((i) => (
            <Field key={i.id} label={formatSpeed(i.downloadMbps)}>
              <MoneyInput value={i.vodafoneDiscountCents} onChange={(c) => update((p) => ({ ...p, internet: p.internet.map((x) => (x.id === i.id ? { ...x, vodafoneDiscountCents: c } : x)) }))} placeholder="Onbekend" suffix="p/m" />
            </Field>
          ))}
        </div>
      </Card>
      <Card className="space-y-4 p-6">
        <Field label="Voorwaarden en aandachtspunten (voor uzelf)">
          <Textarea value={pricing.vodafone.conditions} onChange={(e) => update((p) => ({ ...p, vodafone: { ...p.vodafone, conditions: e.target.value } }))} />
        </Field>
        <SourceFields source={pricing.vodafone.source} onChange={(source) => update((p) => ({ ...p, vodafone: { ...p.vodafone, source } }))} />
        <p className="text-sm text-muted-foreground">Korting op de <strong>Vodafone</strong>-rekening (mobiel) vult u per klant in bij het advies. Die wordt apart getoond en nooit van de Ziggo-prijs afgetrokken.</p>
      </Card>
    </div>
  )
}

/* ---------- Acties en Mijn Salesacties ---------- */

/** Vaste actieprijs per pakketcategorie, elk met eigen prijzen per snelheid en eventueel een eigen looptijd. */
function PromoCategoryPrices({ promo: e, pricing, cat, setCat, patch }: { promo: Promotion; pricing: PricingCatalog; cat: PackageCategory; setCat: (c: PackageCategory) => void; patch: (p: Partial<Promotion>) => void }) {
  const c = PACKAGE_CATEGORIES.find((x) => x.id === cat)!
  const nets = pricing.internet.filter((i) => i.available)
  const own = e.categoryMonths?.[cat]
  const months = (n: number | null) => (n ? `${n} maanden` : 'hele looptijd')
  const missingRegular = nets.filter((i) => !isVerifiedPrice(findPrice(pricing, i.id, null, true)))
  const setMonths = (n: number | null) => {
    const next = { ...(e.categoryMonths ?? {}) }
    if (n === null) delete next[cat]
    else next[cat] = n
    patch({ categoryMonths: Object.keys(next).length ? next : undefined })
  }
  return (
    <div className="rounded-2xl border p-4">
      <h3 className="font-semibold">Vaste actieprijs per pakket</h3>
      <p className="text-sm text-muted-foreground">Volledige pakketprijs per maand tijdens de actie. Vul alleen in waarvoor de actie geldt; na de actie geldt weer de normale pakketprijs. De app kiest automatisch de prijs die bij het gekozen pakket hoort.</p>
      <div role="tablist" aria-label="Pakketcategorie" className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PACKAGE_CATEGORIES.map((x) => {
          const filled = keysInCategory(e.fixedPrices, x.id).length
          const on = x.id === cat
          return (
            <button key={x.id} type="button" role="tab" aria-selected={on} onClick={() => setCat(x.id)} className={cn('min-h-[60px] rounded-xl border-2 px-3 py-2 text-left transition-colors', on ? 'border-primary bg-primary-soft/60' : 'border-border hover:border-primary/40')}>
              <span className="block text-sm font-semibold leading-tight">{x.label}</span>
              <span className={cn('block text-xs', filled ? 'text-foreground' : 'text-muted-foreground')}>{filled ? `${filled} ${filled === 1 ? 'prijs' : 'prijzen'} · ${months(promotionMonths(e, x.id))}` : 'Niet ingesteld'}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-4">
        <Field label={`Actiemaanden voor ${c.label}`} hint={`Leeg = zoals de actie (${months(e.durationMonths)})`} className="max-w-[300px]">
          <NumberInput value={own ?? null} onChange={(n) => setMonths(n && n > 0 ? n : null)} nullable placeholder={e.durationMonths ? String(e.durationMonths) : 'Hele looptijd'} suffix="maanden" max={24} />
        </Field>
      </div>
      <Grid
        pricing={pricing}
        nullLabel={c.phone ? 'Internet + vaste telefonie' : 'Alleen internet'}
        columns={c.tv ? pricing.tv : [null]}
        get={(n, t) => e.fixedPrices[packageKey(n, t, c.phone)] ?? null}
        set={(n, t, v) => {
          const next = { ...e.fixedPrices }
          if (v === null) delete next[packageKey(n, t, c.phone)]
          else next[packageKey(n, t, c.phone)] = v
          patch({ fixedPrices: next })
        }}
      />
      {cat === 'internet_bellen' && (
        <p className={cn('mt-2 text-xs', missingRegular.length ? 'font-medium text-warn' : 'text-muted-foreground')}>
          {missingRegular.length
            ? `Let op: de normale maandprijs van internet met vaste telefonie ontbreekt nog voor ${missingRegular.map((i) => formatSpeed(i.downloadMbps)).join(', ')}. Die is nodig voor de maanden na de actie; vul hem in op het tabblad Alles-in-1.`
            : 'Deze prijs is inclusief vaste telefonie; er komt geen toeslag voor bellen bovenop. Geldt niet voor pakketten met tv.'}
        </p>
      )}
    </div>
  )
}

const blankPromo = (channel: PromotionChannel): Promotion => ({ id: newId(), name: '', channel, status: 'concept', validFrom: null, validTo: null, contractMonths: 24, durationMonths: 12, fixedPrices: {}, monthlyDiscountCents: 0, oneTimeDiscountCents: 0, giftId: null, exclusiveGroup: null, requiresTv: false, conditions: '', benefits: '', source: { url: null, verifiedOn: null }, internalNotes: '' })

function PromoPanel({ channel, q }: { channel: PromotionChannel; q: string }) {
  const l = useList('promotions')
  const { pricing } = l
  const e = l.editing
  const [cat, setCat] = useState<PackageCategory>('internet')
  const today = todayIso()
  const items = l.items.filter((p) => p.channel === channel && match(q, p.name, p.conditions))
  const describe = (p: Promotion) => {
    const n = Object.keys(p.fixedPrices).length
    const cats = PACKAGE_CATEGORIES.filter((c) => keysInCategory(p.fixedPrices, c.id).length > 0).map((c) => c.label)
    const parts = [
      n > 0 && `vaste actieprijs voor ${n} pakket${n === 1 ? '' : 'ten'} (${cats.join(', ')})`,
      p.monthlyDiscountCents > 0 && `${formatEuro(p.monthlyDiscountCents)} korting p/m`,
      (p.percentDiscount ?? 0) > 0 && `${p.percentDiscount}% korting op het abonnement`,
      (n > 0 || p.monthlyDiscountCents > 0 || (p.percentDiscount ?? 0) > 0) && (p.durationMonths ? `${p.durationMonths} maanden` : 'hele looptijd'),
      p.oneTimeDiscountCents > 0 && `${formatEuro(p.oneTimeDiscountCents)} korting eenmalig`,
      p.giftId && `cadeau: ${pricing.gifts.find((g) => g.id === p.giftId)?.name ?? 'onbekend'}`,
      p.contractExact || p.contractMonths === 24 ? `${p.contractMonths} mnd contract` : '12 of 24 mnd contract',
    ]
    return parts.filter(Boolean).join(' · ')
  }
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        {channel === 'eigen'
          ? 'De acties die u van uw salesorganisatie mag aanbieden. Alleen acties met status “Gecontroleerd” die vandaag geldig zijn, zijn te kiezen in de pakketbouwer.'
          : 'Openbare acties van de website, als referentie. Ze zeggen niets over wat u aan de deur mag aanbieden; gebruik daarvoor Mijn Salesacties.'}
      </p>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Plus />} title={channel === 'eigen' ? 'Nog geen eigen salesacties' : 'Geen acties gevonden'} text={channel === 'eigen' ? 'Voeg de actie toe die u nu mag aanbieden: een vaste actieprijs, maandkorting, cadeau of gratis installatie.' : 'Voeg een actie toe of pas de zoekterm aan.'} action={<Button variant="primary" onClick={() => l.setEditing(blankPromo(channel))}><Plus /> Actie toevoegen</Button>} />
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {items.map((p) => {
            const expired = p.status !== 'verlopen' && p.validTo !== null && p.validTo < today
            return (
              <Row
                key={p.id}
                title={p.name}
                onEdit={() => l.setEditing(structuredClone(p))}
                badges={
                  <>
                    <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                    {expired && <Badge tone="warn">Einddatum voorbij</Badge>}
                    {p.giftId && (
                      <Badge tone="primary">
                        <GiftIcon /> Cadeau
                      </Badge>
                    )}
                  </>
                }
                sub={
                  <>
                    {describe(p)}
                    {p.validTo && ` · t/m ${formatDateNl(p.validTo)}`} {p.status === 'gecontroleerd' && <Verified source={p.source} />}
                  </>
                }
                right={
                  <Select aria-label="Status" className="w-[160px]" value={p.status} onChange={(ev) => l.patchItem(p.id, { status: ev.target.value as PromotionStatus, source: ev.target.value === 'gecontroleerd' ? { ...p.source, verifiedOn: today } : p.source })}>
                    <option value="concept">Concept</option>
                    <option value="gecontroleerd">Gecontroleerd</option>
                    <option value="verlopen">Verlopen</option>
                  </Select>
                }
              />
            )
          })}
        </Card>
      )}
      {items.length > 0 && (
        <Button variant="secondary" onClick={() => l.setEditing(blankPromo(channel))}>
          <Plus /> Actie toevoegen
        </Button>
      )}
      <EditDialog item={e} isNew={l.isNew} title={channel === 'eigen' ? 'Salesactie' : 'Actie'} onClose={() => l.setEditing(null)} onSave={l.save} onDelete={l.remove}>
        {e && (
          <div className="space-y-5">
            <Field label="Naam" hint="Zo ziet de klant de actie in de berekening">
              <Input value={e.name} onChange={(ev) => l.patch({ name: ev.target.value })} placeholder="Bijv. 12 maanden € 34,95" />
            </Field>
            <Field label="Status">
              <Segmented value={e.status} onChange={(status) => l.patch({ status, source: status === 'gecontroleerd' && !e.source.verifiedOn ? { ...e.source, verifiedOn: today } : e.source })} options={[{ value: 'concept', label: 'Concept' }, { value: 'gecontroleerd', label: 'Gecontroleerd' }, { value: 'verlopen', label: 'Verlopen' }]} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Aantal actiemaanden" hint="Bijv. 3, 6, 9 of 12. Leeg = hele contractduur">
                <NumberInput value={e.durationMonths} onChange={(n) => l.patch({ durationMonths: n && n > 0 ? n : null })} nullable placeholder="Hele looptijd" suffix="maanden" max={24} />
              </Field>
              <Field label="Geldt bij contract van">
                <Segmented
                  value={e.contractExact || e.contractMonths === 24 ? String(e.contractMonths) : 'beide'}
                  onChange={(v) => l.patch(v === 'beide' ? { contractMonths: 12, contractExact: false } : { contractMonths: Number(v) as 12 | 24, contractExact: true })}
                  options={[{ value: '24', label: '24 maanden' }, { value: '12', label: '12 maanden' }, { value: 'beide', label: 'Beide' }]}
                />
              </Field>
              <Field label="Geldig vanaf" hint="Leeg = geen begindatum">
                <Input type="date" value={e.validFrom ?? ''} onChange={(ev) => l.patch({ validFrom: ev.target.value || null })} />
              </Field>
              <Field label="Geldig tot en met" hint="Leeg = geen einddatum">
                <Input type="date" value={e.validTo ?? ''} onChange={(ev) => l.patch({ validTo: ev.target.value || null })} />
              </Field>
            </div>

            <Field label="Korting in procenten op het abonnement" hint="Op internet, tv en vast bellen samen, tijdens de actiemaanden. Nooit op extra diensten, apparatuur of eenmalige kosten. Vervangt een vaste actieprijs.">
              <NumberInput value={e.percentDiscount ?? null} onChange={(n) => l.patch({ percentDiscount: n && n > 0 ? Math.min(n, 100) : undefined })} nullable placeholder="Geen" suffix="%" max={100} />
            </Field>
            {!(e.percentDiscount ?? 0) && <PromoCategoryPrices promo={e} pricing={pricing} cat={cat} setCat={setCat} patch={l.patch} />}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Korting per maand" hint="Bovenop de pakket- of actieprijs; 0 = geen">
                <MoneyInput value={e.monthlyDiscountCents} onChange={(c) => l.patch({ monthlyDiscountCents: c ?? 0 })} emptyAsZero />
              </Field>
              <Field label="Korting op eenmalige kosten" hint="Bijv. gratis installatie of aansluiting">
                <MoneyInput value={e.oneTimeDiscountCents} onChange={(c) => l.patch({ oneTimeDiscountCents: c ?? 0 })} emptyAsZero />
              </Field>
              <Field label="Cadeau" hint="Beheer cadeaus op het tabblad Cadeaus">
                <Select value={e.giftId ?? ''} onChange={(ev) => l.patch({ giftId: ev.target.value || null })}>
                  <option value="">Geen cadeau</option>
                  {pricing.gifts.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Niet te combineren met (groep)" hint="Acties met dezelfde groepsnaam sluiten elkaar uit">
                <Input value={e.exclusiveGroup ?? ''} onChange={(ev) => l.patch({ exclusiveGroup: ev.target.value || null })} placeholder="Bijv. Hoofdactie" />
              </Field>
              <Field label="Overig voordeel in woorden" hint="Bijv. gratis apparatuur">
                <Input value={e.benefits} onChange={(ev) => l.patch({ benefits: ev.target.value })} />
              </Field>
              <div className="self-end rounded-xl bg-muted/60 px-3">
                <Switch checked={e.requiresTv} onCheckedChange={(requiresTv) => l.patch({ requiresTv })} label="Alleen bij Internet + TV" />
              </div>
            </div>
            <Field label="Voorwaarden" hint="Wie komt in aanmerking? Zichtbaar voor de klant in de berekening.">
              <Textarea value={e.conditions} onChange={(ev) => l.patch({ conditions: ev.target.value })} />
            </Field>
            <SourceFields source={e.source} onChange={(source) => l.patch({ source })} />
            <Field label="Interne notities" hint="Nooit zichtbaar voor de klant">
              <Textarea value={e.internalNotes} onChange={(ev) => l.patch({ internalNotes: ev.target.value })} />
            </Field>
          </div>
        )}
      </EditDialog>
    </div>
  )
}

/* ---------- Cadeaus ---------- */

async function readImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

function GiftsPanel({ q }: { q: string }) {
  const l = useList('gifts')
  const e = l.editing
  const items = l.items.filter((g) => match(q, g.name, g.description))
  const blank = (): GiftDefinition => ({ id: newId(), available: true, type: 'televisie', name: '', imageDataUrl: null, retailValueCents: null, description: '', conditions: '' })
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">Cadeaus koppelt u aan een actie. De waarde wordt apart getoond en nooit van de abonnementskosten afgetrokken.</p>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<GiftIcon />} title="Nog geen cadeaus" text="Voeg een televisie, soundbar of cadeaukaart toe en koppel die daarna aan een actie." action={<Button variant="primary" onClick={() => l.setEditing(blank())}><Plus /> Cadeau toevoegen</Button>} />
        </Card>
      ) : (
        <>
          <Card className="divide-y overflow-hidden">
            {items.map((g) => (
              <Row
                key={g.id}
                title={g.name}
                onEdit={() => l.setEditing(structuredClone(g))}
                sub={`${g.description || 'Geen omschrijving'} · gekoppeld aan ${l.pricing.promotions.filter((p) => p.giftId === g.id).length} actie(s)`}
                right={
                  <div className="flex items-center gap-3">
                    <GiftImage src={g.imageDataUrl} className="size-12 rounded-lg" />
                    <div>
                      <Switch checked={g.available} onCheckedChange={(available) => l.patchItem(g.id, { available })} label="Beschikbaar" compact />
                    </div>
                  </div>
                }
              />
            ))}
          </Card>
          <Button variant="secondary" onClick={() => l.setEditing(blank())}>
            <Plus /> Cadeau toevoegen
          </Button>
        </>
      )}
      <EditDialog item={e} isNew={l.isNew} title="Cadeau" onClose={() => l.setEditing(null)} onSave={l.save} onDelete={l.remove}>
        {e && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Soort">
              <Select value={e.type} onChange={(ev) => l.patch({ type: ev.target.value as GiftType })}>
                <option value="televisie">Televisie</option>
                <option value="soundbar">Soundbar</option>
                <option value="cadeaukaart">Cadeaukaart</option>
                <option value="anders">Ander product</option>
              </Select>
            </Field>
            <Field label="Productnaam">
              <Input value={e.name} onChange={(ev) => l.patch({ name: ev.target.value })} />
            </Field>
            <Field label="Korte omschrijving" className="sm:col-span-2">
              <Input value={e.description} onChange={(ev) => l.patch({ description: ev.target.value })} />
            </Field>
            <Field label="Belangrijkste voorwaarden" className="sm:col-span-2">
              <Input value={e.conditions} onChange={(ev) => l.patch({ conditions: ev.target.value })} placeholder="Bijv. op = op, levering na activatie" />
            </Field>
            <Field label="Adviesprijs (optioneel, alleen voor uzelf)" hint="Wordt niet als besparing getoond">
              <MoneyInput value={e.retailValueCents} onChange={(c) => l.patch({ retailValueCents: c })} placeholder="—" />
            </Field>
            <Field label="Afbeelding" hint="Meegeleverd is een illustratie. Upload alleen een productfoto als model en gebruiksrecht kloppen.">
              <div className="flex items-center gap-2">
                <GiftImage src={e.imageDataUrl} className="size-12 rounded-lg" />
                <Button asChild size="sm">
                  <label className="cursor-pointer">
                    {e.imageDataUrl ? 'Andere foto' : 'Foto kiezen'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (ev) => {
                        const f = ev.target.files?.[0]
                        if (f) await readImage(f).then((imageDataUrl) => l.patch({ imageDataUrl })).catch(() => toast('Deze afbeelding kon niet worden gelezen.'))
                      }}
                    />
                  </label>
                </Button>
                {e.imageDataUrl && (
                  <Button size="sm" variant="ghost" onClick={() => l.patch({ imageDataUrl: null })}>
                    Verwijderen
                  </Button>
                )}
              </div>
            </Field>
          </div>
        )}
      </EditDialog>
    </div>
  )
}

/* ---------- Back-up ---------- */

function BackupPanel() {
  const { pricing } = usePricing()
  const { importPricing, restoreSeedPricing } = useData()
  const file = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PricingCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restore, setRestore] = useState(false)
  const today = todayIso()
  const old = typeof localStorage !== 'undefined' ? localStorage.getItem(PRE_V3_BACKUP_KEY) : null
  return (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Card className="space-y-3 p-6">
        <h2 className="text-[17px] font-semibold">Exporteren</h2>
        <p className="text-sm text-muted-foreground">Alle prijzen, extra diensten, acties, salesacties en cadeaus in één bestand. Doe dit vóór elke update van de app.</p>
        <Button variant="primary" onClick={() => downloadFile(`overstapadvies-prijzen-${today}.json`, JSON.stringify({ app: 'overstapadvies', kind: 'prijsconfiguratie', schemaVersion: PRICING_SCHEMA_VERSION, exportedAt: new Date().toISOString(), pricing }, null, 2), 'application/json')}>
          <Download /> Prijzen exporteren
        </Button>
      </Card>
      <Card className="space-y-3 p-6">
        <h2 className="text-[17px] font-semibold">Importeren</h2>
        <p className="text-sm text-muted-foreground">Het bestand wordt eerst gecontroleerd. Daarna vervangt het de huidige prijzen; instellingen, adviezen en opvolgingen blijven staan.</p>
        <Button onClick={() => file.current?.click()}>
          <Upload /> Bestand kiezen
        </Button>
        {error && (
          <p className="flex gap-2 rounded-xl bg-warn-soft p-3 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setError(null)
            try {
              setPending(parsePricingExport(JSON.parse(await f.text())))
            } catch (err) {
              setError(err instanceof SyntaxError ? 'Dit bestand is geen geldig JSON-bestand.' : (err as Error).message)
            }
          }}
        />
      </Card>
      <Card className="space-y-3 p-6">
        <h2 className="text-[17px] font-semibold">Basisprijzen terugzetten</h2>
        <p className="text-sm text-muted-foreground">Zet pakketprijzen, extra diensten en de openbare actie terug naar de meegeleverde lijst van {formatDateNl(pricing.seedDate || '2026-11-16')}. Uw eigen salesacties, cadeaus en aansluitkosten blijven staan.</p>
        <Button onClick={() => setRestore(true)}>
          <RotateCcw /> Basisprijzen terugzetten
        </Button>
      </Card>
      {old && (
        <Card className="space-y-3 p-6">
          <h2 className="text-[17px] font-semibold">Kopie van vóór de update</h2>
          <p className="text-sm text-muted-foreground">Bij de overgang naar de nieuwe prijsopzet is automatisch een kopie van uw oude gegevens bewaard.</p>
          <Button onClick={() => downloadFile('overstapadvies-voor-update.json', old, 'application/json')}>
            <Download /> Oude gegevens downloaden
          </Button>
        </Card>
      )}
      <Dialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Prijzen vervangen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pending) importPricing(pending)
                setPending(null)
                toast('Prijzen geïmporteerd')
              }}
            >
              Vervangen
            </Button>
          </>
        }
      >
        {pending && (
          <p className="text-sm text-muted-foreground">
            Het bestand is geldig en bevat {pending.internet.length} internetpakketten, {pending.prices.filter((p) => p.cents !== null).length} pakketprijzen, {pending.extras.length} extra diensten, {pending.promotions.length} acties en {pending.gifts.length} cadeaus. Uw huidige prijzen worden hierdoor vervangen.
          </p>
        )}
      </Dialog>
      <Dialog
        open={restore}
        onOpenChange={setRestore}
        title="Basisprijzen terugzetten?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRestore(false)}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                restoreSeedPricing()
                setRestore(false)
                toast('Basisprijzen teruggezet')
              }}
            >
              Terugzetten
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Zelf aangepaste pakketprijzen en extra diensten gaan verloren. Exporteer eerst als u ze wilt bewaren.</p>
      </Dialog>
    </div>
  )
}

/* ---------- pagina ---------- */

export default function PricingPage() {
  const pricing = useData((s) => s.pricing)
  const oldOffers = useData((s) => s.offers)
  const [tab, setTab] = useState<Tab>('internet')
  const [q, setQ] = useState('')
  const stale = staleCount(pricing, todayIso())
  const mine = pricing.promotions.filter((p) => p.channel === 'eigen').length
  const searchable = tab === 'internet' || tab === 'extras' || tab === 'promos' || tab === 'mine' || tab === 'gifts'
  return (
    <Page className="max-w-[1180px]">
      <PageHeader
        title="Prijzen & Aanbiedingen"
        subtitle="Alleen voor u. Alle bedragen per maand, inclusief btw."
        actions={
          searchable ? (
            <div className="relative w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Zoeken" className="pl-10" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          ) : undefined
        }
      />
      <div className="mb-4 overflow-x-auto pb-1">
        <Segmented
          className="min-w-[980px]"
          aria-label="Onderdeel"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'internet', label: 'Internet' },
            { value: 'tv', label: 'Internet + TV' },
            { value: 'allin1', label: 'Alles-in-1' },
            { value: 'extras', label: 'Extra diensten' },
            { value: 'vodafone', label: 'Vodafone' },
            { value: 'promos', label: 'Acties' },
            { value: 'mine', label: `Mijn Salesacties${mine ? ` (${mine})` : ''}` },
            { value: 'gifts', label: 'Cadeaus' },
            { value: 'backup', label: 'Back-up' },
            ...(oldOffers.length ? [{ value: 'old' as const, label: 'Vaste aanbiedingen' }] : []),
          ]}
        />
      </div>
      {stale > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-2.5 text-sm text-warn">
          <AlertTriangle className="size-4 shrink-0" /> {stale} bedrag{stale === 1 ? ' is' : 'en zijn'} langer dan 30 dagen niet gecontroleerd. Controleer ze op de bron en pas de datum aan.
        </p>
      )}
      <div key={tab} className="animate-fade-up">
        {tab === 'internet' && <InternetPanel q={q} />}
        {tab === 'tv' && <MatrixPanel phone={false} />}
        {tab === 'allin1' && <MatrixPanel phone />}
        {tab === 'extras' && <ExtrasPanel q={q} />}
        {tab === 'vodafone' && <VodafonePanel />}
        {tab === 'promos' && <PromoPanel channel="openbaar" q={q} />}
        {tab === 'mine' && <PromoPanel channel="eigen" q={q} />}
        {tab === 'gifts' && <GiftsPanel q={q} />}
        {tab === 'backup' && <BackupPanel />}
        {tab === 'old' && <BundlesPanel />}
      </div>
    </Page>
  )
}
