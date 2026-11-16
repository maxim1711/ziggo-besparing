import { Download, Gift as GiftIcon, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Page, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, NumberInput, Segmented, Select, Switch, Textarea } from '@/components/ui/inputs'
import { CATALOG_SCHEMA_VERSION, formatSpeed, parseCatalogExport, sampleCatalog, type Catalog, type ExtraProduct, type InternetProduct, type Promotion, type TvPackage } from '@/engine/catalog'
import { formatDateNl, todayIso } from '@/engine/dates'
import { newId } from '@/engine/defaults'
import { formatEuro } from '@/engine/money'
import type { Gift, GiftType } from '@/engine/types'
import { downloadFile } from '@/lib/utils'
import { useData } from '@/store/data'
import { toast } from '@/store/toast'
import BundlesPanel from './OffersPage'

type Tab = 'internet' | 'tv' | 'extras' | 'promotions' | 'vodafone' | 'bundles' | 'backup'
type ListKey = 'internet' | 'tv' | 'extras' | 'promotions'
type Item = InternetProduct | TvPackage | ExtraProduct | Promotion

const price = (c: number | null) => (c === null ? null : formatEuro(c))
const Missing = () => <Badge tone="warn">Prijs ontbreekt</Badge>

const blank = {
  internet: (): InternetProduct => ({ id: newId(), name: '', available: true, isExample: false, downloadMbps: 0, uploadMbps: null, regularMonthlyCents: null, promoMonthlyCents: null, promoMonths: 12, contractMonths: 24, oneTimeCents: 0, validFrom: null, validTo: null, internalNotes: '' }),
  tv: (): TvPackage => ({ id: newId(), name: '', available: true, isExample: false, monthlyCents: null, features: '', includedReceivers: 1, extraReceiverMonthlyCents: null }),
  extras: (): ExtraProduct => ({ id: newId(), name: '', available: true, isExample: false, category: 'entertainment', monthlyCents: null, oneTimeCents: 0, requiresTv: true }),
  promotions: (): Promotion => ({ id: newId(), name: '', available: true, isExample: false, type: 'standaard', monthlyDiscountCents: 0, durationMonths: 12, oneTimeDiscountCents: 0, gift: null, conditions: '', exclusiveGroup: null, requiresTv: false, validFrom: null, validTo: null }),
}
const emptyGift = (): Gift => ({ type: 'televisie', name: '', imageDataUrl: null, retailValueCents: null, description: '', conditions: '' })

const PROMO_TYPE: Record<Promotion['type'], string> = { standaard: 'Standaardkorting', black_friday: 'Black Friday', cadeau: 'Cadeauactie', tijdelijk: 'Tijdelijke actie' }
const EXTRA_CAT: Record<ExtraProduct['category'], string> = { entertainment: 'Entertainment', sport: 'Sport', overig: 'Overig' }

async function readImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

/* ---------- formulieren per soort ---------- */

function Common<T extends Item>({ item, set }: { item: T; set: (p: Partial<T>) => void }) {
  return (
    <div className="space-y-1 rounded-2xl bg-muted/60 px-4 py-1">
      <Switch checked={item.available} onCheckedChange={(available) => set({ available } as Partial<T>)} label="Beschikbaar" description="Uit = niet zichtbaar in de pakketbouwer." />
      <Switch checked={!item.isExample} onCheckedChange={(v) => set({ isExample: !v } as Partial<T>)} label="Prijs gecontroleerd" description="Uit = gemarkeerd als voorbeeld, ook voor de klant." />
    </div>
  )
}

function Validity<T extends { validFrom: string | null; validTo: string | null }>({ item, set }: { item: T; set: (p: Partial<T>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Geldig vanaf" hint="Leeg = geen begindatum">
        <Input type="date" value={item.validFrom ?? ''} onChange={(e) => set({ validFrom: e.target.value || null } as Partial<T>)} />
      </Field>
      <Field label="Geldig tot en met" hint="Leeg = geen einddatum">
        <Input type="date" value={item.validTo ?? ''} onChange={(e) => set({ validTo: e.target.value || null } as Partial<T>)} />
      </Field>
    </div>
  )
}

function InternetForm({ item, set }: { item: InternetProduct; set: (p: Partial<InternetProduct>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Naam pakket">
        <Input value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder="Bijv. Internet 1 Gbit/s" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Downloadsnelheid">
          <NumberInput value={item.downloadMbps} onChange={(n) => set({ downloadMbps: n ?? 0 })} suffix="Mbit/s" max={10000} />
        </Field>
        <Field label="Uploadsnelheid (optioneel)">
          <NumberInput value={item.uploadMbps} onChange={(n) => set({ uploadMbps: n })} nullable suffix="Mbit/s" max={10000} />
        </Field>
        <Field label="Normale prijs per maand" hint="Inclusief btw">
          <MoneyInput value={item.regularMonthlyCents} onChange={(c) => set({ regularMonthlyCents: c })} placeholder="Invullen" />
        </Field>
        <Field label="Actieprijs per maand" hint="Leeg = geen actieprijs">
          <MoneyInput value={item.promoMonthlyCents} onChange={(c) => set({ promoMonthlyCents: c })} placeholder="—" />
        </Field>
        <Field label="Duur actieprijs">
          <NumberInput value={item.promoMonths} onChange={(n) => set({ promoMonths: n ?? 0 })} suffix="maanden" max={24} />
        </Field>
        <Field label="Eenmalige kosten">
          <MoneyInput value={item.oneTimeCents} onChange={(c) => set({ oneTimeCents: c ?? 0 })} emptyAsZero />
        </Field>
      </div>
      <Field label="Contractduur" hint="Standaard 24 maanden">
        <Segmented value={item.contractMonths} onChange={(contractMonths) => set({ contractMonths })} options={[{ value: 24, label: '24 maanden' }, { value: 12, label: '12 maanden' }]} />
      </Field>
      <Validity item={item} set={set} />
      <Field label="Interne notities" hint="Alleen voor u; nooit zichtbaar voor de klant.">
        <Textarea value={item.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} />
      </Field>
      <Common item={item} set={set} />
    </div>
  )
}

function TvForm({ item, set }: { item: TvPackage; set: (p: Partial<TvPackage>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Naam pakket">
        <Input value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder="Bijv. TV Start" />
      </Field>
      <Field label="Meerprijs per maand" hint="Bovenop het internetpakket, inclusief btw">
        <MoneyInput value={item.monthlyCents} onChange={(c) => set({ monthlyCents: c })} placeholder="Invullen" />
      </Field>
      <Field label="Zenders en functies" hint="Korte omschrijving die de adviseur ziet bij het kiezen">
        <Textarea value={item.features} onChange={(e) => set({ features: e.target.value })} placeholder="Bijv. ruim 60 zenders, terugkijken en opnemen" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Aantal ontvangers inbegrepen">
          <NumberInput value={item.includedReceivers} onChange={(n) => set({ includedReceivers: n ?? 0 })} max={9} />
        </Field>
        <Field label="Extra ontvanger per maand" hint="Leeg = nog invullen">
          <MoneyInput value={item.extraReceiverMonthlyCents} onChange={(c) => set({ extraReceiverMonthlyCents: c })} placeholder="Invullen" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Sport-, film- en andere pakketten stelt u in op het tabblad Extra’s.</p>
      <Common item={item} set={set} />
    </div>
  )
}

function ExtraForm({ item, set }: { item: ExtraProduct; set: (p: Partial<ExtraProduct>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Naam">
        <Input value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder="Bijv. Sportpakket" />
      </Field>
      <Field label="Soort">
        <Segmented value={item.category} onChange={(category) => set({ category })} options={[{ value: 'entertainment', label: 'Entertainment' }, { value: 'sport', label: 'Sport' }, { value: 'overig', label: 'Overig' }]} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prijs per maand" hint="Inclusief btw">
          <MoneyInput value={item.monthlyCents} onChange={(c) => set({ monthlyCents: c })} placeholder="Invullen" />
        </Field>
        <Field label="Eenmalige kosten">
          <MoneyInput value={item.oneTimeCents} onChange={(c) => set({ oneTimeCents: c ?? 0 })} emptyAsZero />
        </Field>
      </div>
      <div className="rounded-2xl bg-muted/60 px-4 py-1">
        <Switch checked={item.requiresTv} onCheckedChange={(requiresTv) => set({ requiresTv })} label="Alleen bij Internet + TV" />
      </div>
      <Common item={item} set={set} />
    </div>
  )
}

function PromotionForm({ item, set }: { item: Promotion; set: (p: Partial<Promotion>) => void }) {
  const setGift = (p: Partial<Gift>) => set({ gift: { ...(item.gift ?? emptyGift()), ...p } })
  const whole = item.durationMonths === null
  return (
    <div className="space-y-4">
      <Field label="Naam actie" hint="Zo ziet de klant de actie in de berekening">
        <Input value={item.name} onChange={(e) => set({ name: e.target.value })} placeholder="Bijv. 6 maanden € 5 korting" />
      </Field>
      <Field label="Soort">
        <Select value={item.type} onChange={(e) => set({ type: e.target.value as Promotion['type'] })}>
          {Object.entries(PROMO_TYPE).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Korting per maand" hint="0 = geen maandkorting">
          <MoneyInput value={item.monthlyDiscountCents} onChange={(c) => set({ monthlyDiscountCents: c ?? 0 })} emptyAsZero />
        </Field>
        <Field label="Aantal maanden korting" hint={whole ? 'Geldt de hele looptijd' : 'Bijv. 3, 6, 9 of 12'}>
          <NumberInput value={item.durationMonths} onChange={(n) => set({ durationMonths: n && n > 0 ? n : null })} nullable placeholder="Hele looptijd" suffix="maanden" max={24} />
        </Field>
        <Field label="Korting op eenmalige kosten" hint="Bijv. gratis activatie">
          <MoneyInput value={item.oneTimeDiscountCents} onChange={(c) => set({ oneTimeDiscountCents: c ?? 0 })} emptyAsZero />
        </Field>
        <Field label="Sluit uit met (groep)" hint="Acties met dezelfde groepsnaam zijn niet te combineren">
          <Input value={item.exclusiveGroup ?? ''} onChange={(e) => set({ exclusiveGroup: e.target.value || null })} placeholder="Bijv. Seizoensactie" />
        </Field>
      </div>
      <Field label="Voorwaarden" hint="Wie komt in aanmerking? Zichtbaar voor de klant.">
        <Textarea value={item.conditions} onChange={(e) => set({ conditions: e.target.value })} />
      </Field>
      <Validity item={item} set={set} />
      <div className="rounded-2xl bg-muted/60 px-4 py-1">
        <Switch checked={item.requiresTv} onCheckedChange={(requiresTv) => set({ requiresTv })} label="Alleen bij Internet + TV" />
        <Switch checked={!!item.gift} onCheckedChange={(on) => set({ gift: on ? emptyGift() : null })} label="Met cadeau" description="De waarde van het cadeau telt nooit mee als besparing." />
      </div>
      {item.gift && (
        <div className="grid gap-3 rounded-2xl bg-accent-soft/60 p-4 sm:grid-cols-2">
          <Field label="Soort cadeau">
            <Select value={item.gift.type} onChange={(e) => setGift({ type: e.target.value as GiftType })}>
              <option value="televisie">Televisie</option>
              <option value="soundbar">Soundbar</option>
              <option value="cadeaukaart">Cadeaukaart</option>
              <option value="anders">Ander product</option>
            </Select>
          </Field>
          <Field label="Productnaam">
            <Input value={item.gift.name} onChange={(e) => setGift({ name: e.target.value })} />
          </Field>
          <Field label="Korte omschrijving" className="sm:col-span-2">
            <Input value={item.gift.description} onChange={(e) => setGift({ description: e.target.value })} />
          </Field>
          <Field label="Voorwaarden cadeau" className="sm:col-span-2">
            <Input value={item.gift.conditions} onChange={(e) => setGift({ conditions: e.target.value })} placeholder="Bijv. op = op" />
          </Field>
          <Field label="Productfoto (optioneel)" hint="Gebruik alleen beeld dat u mag gebruiken" className="sm:col-span-2">
            <div className="flex items-center gap-2">
              {item.gift.imageDataUrl && <img src={item.gift.imageDataUrl} alt="" className="size-14 rounded-lg border bg-white object-contain" />}
              <Button asChild size="sm">
                <label className="cursor-pointer">
                  {item.gift.imageDataUrl ? 'Andere foto' : 'Foto kiezen'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (f) await readImage(f).then((imageDataUrl) => setGift({ imageDataUrl })).catch(() => toast('Deze afbeelding kon niet worden gelezen.'))
                    }}
                  />
                </label>
              </Button>
              {item.gift.imageDataUrl && (
                <Button size="sm" variant="ghost" onClick={() => setGift({ imageDataUrl: null })}>
                  Verwijderen
                </Button>
              )}
            </div>
          </Field>
        </div>
      )}
      <Common item={item} set={set} />
    </div>
  )
}

/* ---------- lijstweergave ---------- */

interface RowInfo {
  title: string
  price: ReactNode
  sub: string
}

function describe(key: ListKey, item: Item): RowInfo {
  if (key === 'internet') {
    const i = item as InternetProduct
    const promo = i.promoMonthlyCents !== null && i.promoMonths > 0
    return {
      title: i.name || 'Naamloos pakket',
      price: i.regularMonthlyCents === null ? <Missing /> : promo ? `${price(i.promoMonthlyCents)} × ${i.promoMonths} mnd, daarna ${price(i.regularMonthlyCents)}` : `${price(i.regularMonthlyCents)} p/m`,
      sub: `${formatSpeed(i.downloadMbps)}${i.uploadMbps ? ` / ${formatSpeed(i.uploadMbps)} upload` : ''} · ${i.contractMonths} mnd contract${i.oneTimeCents ? ` · eenmalig ${price(i.oneTimeCents)}` : ''}${i.validTo ? ` · t/m ${formatDateNl(i.validTo)}` : ''}`,
    }
  }
  if (key === 'tv') {
    const t = item as TvPackage
    return { title: t.name || 'Naamloos pakket', price: t.monthlyCents === null ? <Missing /> : `+ ${price(t.monthlyCents)} p/m`, sub: `${t.includedReceivers} ontvanger${t.includedReceivers === 1 ? '' : 's'} inbegrepen${t.extraReceiverMonthlyCents !== null ? ` · extra ontvanger ${price(t.extraReceiverMonthlyCents)}` : ''}${t.features ? ` · ${t.features}` : ''}` }
  }
  if (key === 'extras') {
    const e = item as ExtraProduct
    return { title: e.name || 'Naamloze extra', price: e.monthlyCents === null ? <Missing /> : `+ ${price(e.monthlyCents)} p/m`, sub: `${EXTRA_CAT[e.category]}${e.requiresTv ? ' · alleen bij tv' : ''}` }
  }
  const p = item as Promotion
  const parts = [p.monthlyDiscountCents > 0 && `${price(p.monthlyDiscountCents)} korting p/m, ${p.durationMonths ? `${p.durationMonths} mnd` : 'hele looptijd'}`, p.oneTimeDiscountCents > 0 && `${price(p.oneTimeDiscountCents)} korting eenmalig`, p.gift && `cadeau: ${p.gift.name || 'product'}`].filter(Boolean)
  return { title: p.name || 'Naamloze actie', price: parts.join(' · ') || 'Nog geen voordeel ingesteld', sub: `${PROMO_TYPE[p.type]}${p.exclusiveGroup ? ` · niet samen met andere “${p.exclusiveGroup}”` : ''}${p.validTo ? ` · t/m ${formatDateNl(p.validTo)}` : ''}` }
}

const LABELS: Record<ListKey, { add: string; emptyTitle: string; emptyText: string }> = {
  internet: { add: 'Internetpakket toevoegen', emptyTitle: 'Nog geen internetpakketten', emptyText: 'Voeg per snelheid een pakket toe met de normale prijs en de actieprijs.' },
  tv: { add: 'Tv-pakket toevoegen', emptyTitle: 'Nog geen tv-pakketten', emptyText: 'Voeg een tv-pakket toe met de meerprijs bovenop internet.' },
  extras: { add: 'Extra toevoegen', emptyTitle: 'Nog geen extra’s', emptyText: 'Bijvoorbeeld een sport- of filmpakket.' },
  promotions: { add: 'Actie toevoegen', emptyTitle: 'Nog geen acties', emptyText: 'Bijvoorbeeld een tijdelijke korting, Black Friday-actie of cadeau.' },
}

function ListPanel({ listKey }: { listKey: ListKey }) {
  const { catalog, updateCatalog } = useData()
  const items = catalog[listKey] as Item[]
  const [editing, setEditing] = useState<Item | null>(null)
  const today = todayIso()
  const labels = LABELS[listKey]
  const set = (p: Partial<Item>) => setEditing((e) => (e ? ({ ...e, ...p } as Item) : e))
  const isNew = editing ? !items.some((i) => i.id === editing.id) : false
  const save = () => {
    if (!editing) return
    updateCatalog((c) => ({ ...c, [listKey]: isNew ? [...items, editing] : items.map((i) => (i.id === editing.id ? editing : i)) }) as Catalog)
    setEditing(null)
    toast('Opgeslagen')
  }
  const remove = () => {
    if (!editing) return
    updateCatalog((c) => ({ ...c, [listKey]: items.filter((i) => i.id !== editing.id) }) as Catalog)
    setEditing(null)
    toast('Verwijderd')
  }
  return (
    <>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<Plus />} title={labels.emptyTitle} text={labels.emptyText} action={<Button variant="primary" onClick={() => setEditing(blank[listKey]())}><Plus /> {labels.add}</Button>} />
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {items.map((item) => {
            const d = describe(listKey, item)
            const expired = 'validTo' in item && item.validTo !== null && item.validTo < today
            return (
              <button key={item.id} type="button" onClick={() => setEditing(structuredClone(item))} className="flex min-h-[76px] w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-semibold">{d.title}</span>
                    {item.isExample && <Badge tone="accent">Voorbeeld</Badge>}
                    {!item.available && <Badge>Niet beschikbaar</Badge>}
                    {expired && <Badge tone="warn">Verlopen</Badge>}
                    {'gift' in item && item.gift && (
                      <Badge tone="primary">
                        <GiftIcon /> Cadeau
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{d.sub}</div>
                </div>
                <div className="tnum hidden max-w-[45%] text-right text-[15px] font-semibold sm:block">{d.price}</div>
                <Pencil className="size-[18px] shrink-0 text-muted-foreground" />
              </button>
            )
          })}
        </Card>
      )}
      {items.length > 0 && (
        <Button className="mt-4" variant="secondary" onClick={() => setEditing(blank[listKey]())}>
          <Plus /> {labels.add}
        </Button>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={isNew ? labels.add : 'Bewerken'}
        footer={
          <>
            {!isNew && (
              <Button variant="danger" className="mr-auto" onClick={remove}>
                <Trash2 /> Verwijderen
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Annuleren
            </Button>
            <Button variant="primary" disabled={!editing?.name.trim()} onClick={save}>
              Opslaan
            </Button>
          </>
        }
      >
        {editing && listKey === 'internet' && <InternetForm item={editing as InternetProduct} set={set} />}
        {editing && listKey === 'tv' && <TvForm item={editing as TvPackage} set={set} />}
        {editing && listKey === 'extras' && <ExtraForm item={editing as ExtraProduct} set={set} />}
        {editing && listKey === 'promotions' && <PromotionForm item={editing as Promotion} set={set} />}
      </Dialog>
    </>
  )
}

function VodafonePanel() {
  const { catalog, updateCatalog } = useData()
  const v = catalog.vodafone
  const set = (p: Partial<typeof v>) => updateCatalog((c) => ({ ...c, vodafone: { ...c.vodafone, ...p } }))
  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <p className="text-sm text-muted-foreground">Dit bedrag wordt voorgesteld zodra u in de pakketbouwer “Klant heeft Vodafone” aanzet. U kunt het per klant aanpassen, want niet elk abonnement geeft hetzelfde voordeel.</p>
      <Field label="Standaardkorting per maand" hint="Leeg = per klant invullen. De app verzint geen bedrag.">
        <MoneyInput value={v.monthlyDiscountCents} onChange={(c) => set({ monthlyDiscountCents: c })} placeholder="Invullen" />
      </Field>
      <Field label="Extra voordeel (optioneel)">
        <Input value={v.extraBenefits} onChange={(e) => set({ extraBenefits: e.target.value })} placeholder="Bijv. dubbele data" />
      </Field>
      <Field label="Voorwaarden (voor uzelf)">
        <Textarea value={v.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder="Bijv. welke abonnementen in aanmerking komen" />
      </Field>
    </Card>
  )
}

function BackupPanel() {
  const { catalog, offers, importConfig, updateCatalog } = useData()
  const file = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ReturnType<typeof parseCatalogExport> | null>(null)
  const today = todayIso()
  const doExport = () =>
    downloadFile(`overstapadvies-prijzen-${today}.json`, JSON.stringify({ app: 'overstapadvies', kind: 'prijsconfiguratie', schemaVersion: CATALOG_SCHEMA_VERSION, exportedAt: new Date().toISOString(), catalog, bundles: offers }, null, 2), 'application/json')
  return (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Card className="space-y-3 p-6">
        <h2 className="text-[17px] font-semibold">Back-up maken</h2>
        <p className="text-sm text-muted-foreground">Slaat alle pakketten, extra’s, acties, de Vodafone-instelling en bundels op in één bestand. Doe dit vóór elke update van de app.</p>
        <Button variant="primary" onClick={doExport}>
          <Download /> Prijzen exporteren
        </Button>
      </Card>
      <Card className="space-y-3 p-6">
        <h2 className="text-[17px] font-semibold">Back-up terugzetten</h2>
        <p className="text-sm text-muted-foreground">Vervangt de huidige prijzen door die uit het bestand. Uw instellingen, adviezen en opvolgingen blijven staan.</p>
        <Button onClick={() => file.current?.click()}>
          <Upload /> Bestand kiezen
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              setPending(parseCatalogExport(JSON.parse(await f.text())))
            } catch {
              toast('Dit is geen geldig prijzenbestand van deze app.')
            }
          }}
        />
      </Card>
      <Card className="space-y-3 p-6 sm:col-span-2">
        <h2 className="text-[17px] font-semibold">Voorbeelden</h2>
        <p className="text-sm text-muted-foreground">Voegt de voorbeeldpakketten opnieuw toe als ze ontbreken. Uw eigen pakketten en prijzen worden nooit overschreven.</p>
        <Button
          onClick={() => {
            const sample = sampleCatalog(today)
            const add = <T extends { id: string }>(mine: T[], theirs: T[]) => [...mine, ...theirs.filter((t) => !mine.some((m) => m.id === t.id))]
            updateCatalog((c) => ({ ...c, internet: add(c.internet, sample.internet), tv: add(c.tv, sample.tv), extras: add(c.extras, sample.extras), promotions: add(c.promotions, sample.promotions) }))
            toast('Ontbrekende voorbeelden toegevoegd')
          }}
        >
          <Plus /> Ontbrekende voorbeelden toevoegen
        </Button>
      </Card>
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
                if (pending) importConfig(pending.catalog, pending.bundles)
                setPending(null)
                toast('Prijzen teruggezet')
              }}
            >
              Vervangen
            </Button>
          </>
        }
      >
        {pending && (
          <p className="text-sm text-muted-foreground">
            Het bestand bevat {pending.catalog.internet.length} internetpakketten, {pending.catalog.tv.length} tv-pakketten, {pending.catalog.extras.length} extra’s en {pending.catalog.promotions.length} acties{pending.bundles ? ` en ${pending.bundles.length} bundels` : ''}. Uw huidige prijzen worden hierdoor vervangen.
          </p>
        )}
      </Dialog>
    </div>
  )
}

export default function PricingPage() {
  const catalog = useData((s) => s.catalog)
  const offers = useData((s) => s.offers)
  const [tab, setTab] = useState<Tab>('internet')
  const examples = [...catalog.internet, ...catalog.tv, ...catalog.extras, ...catalog.promotions].some((i) => i.isExample)
  return (
    <Page className="max-w-[1100px]">
      <PageHeader title="Prijzen & Aanbiedingen" subtitle="Hier stelt u alle pakketten, prijzen en acties in. Alle bedragen inclusief btw." />
      <div className="mb-4 overflow-x-auto pb-1">
        <Segmented
          className="min-w-[640px]"
          aria-label="Onderdeel"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'internet', label: `Internet (${catalog.internet.length})` },
            { value: 'tv', label: `Televisie (${catalog.tv.length})` },
            { value: 'extras', label: `Extra’s (${catalog.extras.length})` },
            { value: 'promotions', label: `Acties (${catalog.promotions.length})` },
            { value: 'vodafone', label: 'Vodafone' },
            { value: 'bundles', label: `Bundels (${offers.length})` },
            { value: 'backup', label: 'Back-up' },
          ]}
        />
      </div>
      {examples && tab !== 'backup' && tab !== 'bundles' && tab !== 'vodafone' && (
        <div className="mb-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-warn">
          <strong>Voorbeeldprijzen.</strong> Alles met het label “Voorbeeld” heeft verzonnen bedragen. Tik erop, vul de echte prijs in en zet “Prijs gecontroleerd” aan.
        </div>
      )}
      <div key={tab} className="animate-fade-up">
        {(tab === 'internet' || tab === 'tv' || tab === 'extras' || tab === 'promotions') && <ListPanel listKey={tab} />}
        {tab === 'vodafone' && <VodafonePanel />}
        {tab === 'bundles' && <BundlesPanel />}
        {tab === 'backup' && <BackupPanel />}
      </div>
    </Page>
  )
}
