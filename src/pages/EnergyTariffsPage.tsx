import { AlertTriangle, ClipboardPaste, Copy, Download, Heart, History, Pencil, Plus, Star, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ListEditor } from '@/components/ListEditor'
import { Page, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, NumberInput, RateInput, Segmented, Select, Switch, Textarea } from '@/components/ui/inputs'
import { formatDateNl, todayIso } from '@/engine/dates'
import { newId } from '@/engine/defaults'
import { blankOffer, duplicateOffer, offerBlockedReason, validateOffer, type ContractType, type EnergyOffer, type OfferStatus, type RegulatoryYear, type TariffRates } from '@/engine/essent'
import { csvToOffers, draftToOffer, jsonToOffers, mergeImported, offersToCsv, parseTariffText, type ImportResult, type ParsedDraft } from '@/engine/essentImport'
import { cn, downloadFile } from '@/lib/utils'
import { useEnergy } from '@/store/energy'
import { toast } from '@/store/toast'
import { offerRateLine } from './EnergyAdvicePage'

type Tab = 'offers' | 'paste' | 'rules' | 'backup'
const STATUS: Record<OfferStatus, { label: string; tone: 'good' | 'accent' | 'neutral' }> = { concept: { label: 'Concept', tone: 'accent' }, gecontroleerd: { label: 'Gecontroleerd', tone: 'good' }, verlopen: { label: 'Verlopen', tone: 'neutral' } }

/* ---------- snel bewerken ---------- */

function RatesGrid({ rates, set }: { rates: TariffRates; set: (p: Partial<TariffRates>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Field label="Stroom enkel">
        <RateInput value={rates.electricitySingle} onChange={(v) => set({ electricitySingle: v })} unit="/kWh" />
      </Field>
      <Field label="Stroom normaal">
        <RateInput value={rates.electricityPeak} onChange={(v) => set({ electricityPeak: v })} unit="/kWh" />
      </Field>
      <Field label="Stroom dal">
        <RateInput value={rates.electricityOffPeak} onChange={(v) => set({ electricityOffPeak: v })} unit="/kWh" />
      </Field>
      <Field label="Gas">
        <RateInput value={rates.gas} onChange={(v) => set({ gas: v })} unit="/m³" />
      </Field>
      <Field label="Vast stroom">
        <MoneyInput value={rates.fixedElectricityMonthlyCents} onChange={(c) => set({ fixedElectricityMonthlyCents: c })} suffix="p/m" placeholder="—" />
      </Field>
      <Field label="Vast gas">
        <MoneyInput value={rates.fixedGasMonthlyCents} onChange={(c) => set({ fixedGasMonthlyCents: c })} suffix="p/m" placeholder="—" />
      </Field>
    </div>
  )
}

function OfferCard({ offer, onFull, onHistory }: { offer: EnergyOffer; onFull: () => void; onHistory: () => void }) {
  const { saveOffer, setDefault, defaultOfferId, history } = useEnergy()
  const [draft, setDraft] = useState(offer)
  useEffect(() => setDraft(offer), [offer])
  const today = todayIso()
  const dirty = JSON.stringify(draft) !== JSON.stringify(offer)
  const errors = dirty ? validateOffer(draft) : []
  const blocked = offerBlockedReason(offer, today)
  const versions = history.filter((h) => h.id === offer.id).length
  const set = (p: Partial<EnergyOffer>) => setDraft((d) => ({ ...d, ...p }))
  const isDefault = defaultOfferId === offer.id
  return (
    <Card className={cn('space-y-4 p-5', isDefault && 'border-primary shadow-lift')}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{offer.name || 'Naamloos aanbod'}</h2>
            <Badge tone={STATUS[offer.status].tone}>{STATUS[offer.status].label}</Badge>
            {offer.status !== 'verlopen' && offer.validTo && offer.validTo < today && <Badge tone="warn">Einddatum voorbij</Badge>}
            {offer.isExample && <Badge tone="accent">Voorbeeld – verzonnen tarieven</Badge>}
            {isDefault && (
              <Badge tone="primary">
                <Star /> Standaardactie
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {offer.campaign || 'Geen campagnenaam'} · versie {offer.version} · gewijzigd {formatDateNl(offer.updatedAt.slice(0, 10))}
            {offer.verifiedOn ? ` · gecontroleerd ${formatDateNl(offer.verifiedOn)}` : ' · niet gecontroleerd'}
          </p>
        </div>
        <Button size="icon" variant="ghost" aria-label={offer.favorite ? 'Geen favoriet meer' : 'Favoriet maken'} aria-pressed={offer.favorite} onClick={() => saveOffer({ ...offer, favorite: !offer.favorite })}>
          <Heart className={offer.favorite ? 'fill-primary text-primary' : ''} />
        </Button>
        <Button size="sm" variant={isDefault ? 'secondary' : 'outline'} disabled={!!blocked && !isDefault} title={blocked ?? undefined} onClick={() => setDefault(isDefault ? null : offer.id)}>
          <Star /> {isDefault ? 'Standaard' : 'Maak standaard'}
        </Button>
      </div>

      <RatesGrid rates={draft.rates} set={(p) => set({ rates: { ...draft.rates, ...p } })} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Welkomstbonus">
          <MoneyInput value={draft.welcomeBonusCents} onChange={(c) => set({ welcomeBonusCents: c ?? 0 })} emptyAsZero />
        </Field>
        <Field label="Geldig t/m">
          <Input type="date" value={draft.validTo ?? ''} onChange={(e) => set({ validTo: e.target.value || null })} />
        </Field>
        <Field label="Looptijd">
          <NumberInput value={draft.contractMonths} onChange={(n) => set({ contractMonths: n ?? 0 })} suffix="mnd" max={120} />
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set({ status: e.target.value as OfferStatus, verifiedOn: e.target.value === 'gecontroleerd' ? today : draft.verifiedOn })}>
            <option value="concept">Concept</option>
            <option value="gecontroleerd">Gecontroleerd</option>
            <option value="verlopen">Verlopen</option>
          </Select>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Tarieven {draft.rates.includesVat ? 'inclusief' : 'exclusief'} btw en {draft.rates.includesEnergyTax ? 'inclusief' : 'exclusief'} energiebelasting.{blocked && <span className="font-medium text-warn"> {blocked}</span>}
      </p>

      {dirty && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-primary-soft p-3">
          {errors.length > 0 ? <p className="flex-1 text-sm font-medium text-red-700">{errors[0]}</p> : <p className="flex-1 text-sm">Niet-opgeslagen wijzigingen. Opslaan maakt versie {offer.version + 1}; de vorige blijft bewaard.</p>}
          <Button size="sm" variant="ghost" onClick={() => setDraft(offer)}>
            Ongedaan maken
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={errors.length > 0}
            onClick={() => {
              saveOffer(draft)
              toast('Tarieven opgeslagen')
            }}
          >
            Opslaan
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const copy = duplicateOffer(offer, newId(), new Date().toISOString())
            saveOffer(copy)
            toast('Kopie gemaakt als concept: pas de gewijzigde tarieven aan')
          }}
        >
          <Copy /> Nieuwe actie op basis van huidige
        </Button>
        <Button size="sm" variant="ghost" onClick={onFull}>
          <Pencil /> Alle velden
        </Button>
        <Button size="sm" variant="ghost" disabled={versions === 0} onClick={onHistory}>
          <History /> Vorige versies ({versions})
        </Button>
      </div>
    </Card>
  )
}

function FullEditor({ offer, onClose }: { offer: EnergyOffer | null; onClose: () => void }) {
  const { offers, saveOffer, deleteOffer } = useEnergy()
  const [e, setE] = useState<EnergyOffer | null>(offer)
  useEffect(() => setE(offer), [offer])
  const today = todayIso()
  const isNew = e ? !offers.some((o) => o.id === e.id) : false
  const errors = e ? validateOffer(e) : []
  const set = (p: Partial<EnergyOffer>) => setE((x) => (x ? { ...x, ...p } : x))
  const setRates = (p: Partial<TariffRates>) => setE((x) => (x ? { ...x, rates: { ...x.rates, ...p } } : x))
  return (
    <Dialog
      wide
      open={!!e}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Nieuw Essent-aanbod' : 'Essent-aanbod bewerken'}
      description="Alleen voor u. Interne notities en provisie zijn nooit zichtbaar voor de klant."
      footer={
        <>
          {!isNew && e && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                deleteOffer(e.id)
                onClose()
                toast('Aanbod verwijderd')
              }}
            >
              <Trash2 /> Verwijderen
            </Button>
          )}
          {errors.length > 0 && <p className="self-center text-sm font-medium text-red-600">{errors[0]}</p>}
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            variant="primary"
            disabled={errors.length > 0}
            onClick={() => {
              if (e) saveOffer(e)
              onClose()
              toast('Opgeslagen')
            }}
          >
            Opslaan
          </Button>
        </>
      }
    >
      {e && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Naam aanbod">
              <Input value={e.name} onChange={(ev) => set({ name: ev.target.value })} placeholder="Bijv. 1 jaar vast – november" />
            </Field>
            <Field label="Campagne">
              <Input value={e.campaign} onChange={(ev) => set({ campaign: ev.target.value })} />
            </Field>
            <Field label="Contracttype">
              <Segmented value={e.contractType} onChange={(contractType: ContractType) => set({ contractType })} options={[{ value: 'vast', label: 'Vast' }, { value: 'variabel', label: 'Variabel' }, { value: 'dynamisch', label: 'Dynamisch' }]} />
            </Field>
            <Field label="Looptijd">
              <NumberInput value={e.contractMonths} onChange={(n) => set({ contractMonths: n ?? 0 })} suffix="maanden" max={120} />
            </Field>
            <Field label="Geldig vanaf">
              <Input type="date" value={e.validFrom ?? ''} onChange={(ev) => set({ validFrom: ev.target.value || null })} />
            </Field>
            <Field label="Geldig tot en met">
              <Input type="date" value={e.validTo ?? ''} onChange={(ev) => set({ validTo: ev.target.value || null })} />
            </Field>
          </div>
          <Field label="Status">
            <Segmented value={e.status} onChange={(status: OfferStatus) => set({ status, verifiedOn: status === 'gecontroleerd' && !e.verifiedOn ? today : e.verifiedOn })} options={[{ value: 'concept', label: 'Concept' }, { value: 'gecontroleerd', label: 'Gecontroleerd' }, { value: 'verlopen', label: 'Verlopen' }]} />
          </Field>
          <RatesGrid rates={e.rates} set={setRates} />
          <div className="rounded-2xl bg-muted/60 px-4 py-1">
            <Switch checked={e.rates.includesVat} onCheckedChange={(includesVat) => setRates({ includesVat })} label="Tarieven en vaste kosten zijn inclusief btw" />
            <Switch checked={e.rates.includesEnergyTax} onCheckedChange={(includesEnergyTax) => setRates({ includesEnergyTax })} label="kWh- en m³-tarieven zijn inclusief energiebelasting" description="Uit = de app telt de energiebelasting van het gekozen jaar er één keer bij." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Terugleverkosten" hint="Per teruggeleverde kWh; 0 = geen">
              <RateInput value={e.rates.feedInFeePerKwh} onChange={(v) => setRates({ feedInFeePerKwh: v })} unit="/kWh" />
            </Field>
            <Field label="Terugleververgoeding" hint="Voor wat niet wordt gesaldeerd">
              <RateInput value={e.rates.feedInCompensationPerKwh} onChange={(v) => setRates({ feedInCompensationPerKwh: v })} unit="/kWh" />
            </Field>
            <Field label="Welkomstbonus / cashback (eenmalig)">
              <MoneyInput value={e.welcomeBonusCents} onChange={(c) => set({ welcomeBonusCents: c ?? 0 })} emptyAsZero />
            </Field>
            <Field label="Voorwaarden bonus / cashback" hint="Zichtbaar voor de klant">
              <Input value={e.bonusConditions} onChange={(ev) => set({ bonusConditions: ev.target.value })} placeholder="Bijv. uitbetaling na 12 maanden" />
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">Kortingen</span>
            <ListEditor
              items={e.discounts}
              onChange={(discounts) => set({ discounts })}
              create={() => ({ id: newId(), label: '', amountCents: 0, kind: 'jaarlijks' as const })}
              addLabel="Korting toevoegen"
              empty="Geen aanvullende kortingen."
              render={(d, update) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_140px_160px]">
                  <Input aria-label="Omschrijving" className="col-span-2 sm:col-span-1" placeholder="Omschrijving" value={d.label} onChange={(ev) => update({ label: ev.target.value })} />
                  <MoneyInput aria-label="Bedrag" value={d.amountCents} onChange={(c) => update({ amountCents: c ?? 0 })} emptyAsZero />
                  <Select aria-label="Soort" value={d.kind} onChange={(ev) => update({ kind: ev.target.value as 'jaarlijks' | 'eenmalig' })}>
                    <option value="jaarlijks">Per jaar</option>
                    <option value="eenmalig">Eenmalig</option>
                  </Select>
                </div>
              )}
            />
          </div>
          <Field label="Voorwaarden om in aanmerking te komen" hint="Zichtbaar voor de klant in de berekening">
            <Textarea value={e.eligibility} onChange={(ev) => set({ eligibility: ev.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Verkoopkanaal">
              <Input value={e.salesChannel} onChange={(ev) => set({ salesChannel: ev.target.value })} />
            </Field>
            <Field label="Bron">
              <Input value={e.source} onChange={(ev) => set({ source: ev.target.value })} placeholder="Bijv. mail salesmanager" />
            </Field>
            <Field label="Gecontroleerd op">
              <div className="flex gap-2">
                <Input type="date" value={e.verifiedOn ?? ''} onChange={(ev) => set({ verifiedOn: ev.target.value || null })} />
                <Button onClick={() => set({ verifiedOn: today })}>Vandaag</Button>
              </div>
            </Field>
          </div>
          <Field label="Interne notities" hint="Nooit zichtbaar voor de klant">
            <Textarea value={e.internalNotes} onChange={(ev) => set({ internalNotes: ev.target.value })} />
          </Field>
        </div>
      )}
    </Dialog>
  )
}

function OffersPanel() {
  const { offers, defaultOfferId, history } = useEnergy()
  const [full, setFull] = useState<EnergyOffer | null>(null)
  const [hist, setHist] = useState<string | null>(null)
  const today = todayIso()
  const def = offers.find((o) => o.id === defaultOfferId)
  const defBlocked = def ? offerBlockedReason(def, today) : null
  const sorted = [...offers].sort((a, b) => Number(b.id === defaultOfferId) - Number(a.id === defaultOfferId) || Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt))
  return (
    <div className="space-y-4">
      {defBlocked && (
        <p className="flex items-center gap-2 rounded-2xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          <AlertTriangle className="size-4 shrink-0" /> Uw standaardactie “{def!.name}” is niet meer te gebruiken: {defBlocked} Kies een nieuwe standaard of werk de tarieven bij.
        </p>
      )}
      {!def && offers.some((o) => !offerBlockedReason(o, today)) && <p className="rounded-2xl bg-primary-soft px-4 py-3 text-sm">Nog geen standaardactie gekozen. Tik bij een gecontroleerd aanbod op “Maak standaard”; dat aanbod staat dan vooraf geselecteerd in elk advies.</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setFull(blankOffer(newId(), new Date().toISOString()))}>
          <Plus /> Nieuw aanbod
        </Button>
      </div>
      {sorted.length === 0 ? (
        <Card>
          <EmptyState icon={<Plus />} title="Nog geen aanbiedingen" text="Voeg een aanbod toe of plak de tarieven uit een bericht." />
        </Card>
      ) : (
        sorted.map((o) => <OfferCard key={o.id} offer={o} onFull={() => setFull(structuredClone(o))} onHistory={() => setHist(o.id)} />)
      )}
      <FullEditor offer={full} onClose={() => setFull(null)} />
      <Dialog open={hist !== null} onOpenChange={(o) => !o && setHist(null)} title="Vorige versies" description="Ter referentie. Opgeslagen vergelijkingen bewaren hun eigen kopie van de tarieven.">
        <ul className="divide-y">
          {history
            .filter((h) => h.id === hist)
            .reverse()
            .map((h) => (
              <li key={h.version} className="py-2.5 text-sm">
                <div className="font-semibold">
                  Versie {h.version} · {formatDateNl(h.updatedAt.slice(0, 10))} · {STATUS[h.status].label}
                </div>
                <div className="tnum text-muted-foreground">
                  {offerRateLine(h)}
                  {h.validTo ? ` · t/m ${formatDateNl(h.validTo)}` : ''}
                </div>
              </li>
            ))}
        </ul>
      </Dialog>
    </div>
  )
}

/* ---------- tarieven plakken ---------- */

function PastePanel({ onDone }: { onDone: () => void }) {
  const saveOffer = useEnergy((s) => s.saveOffer)
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<ParsedDraft | null>(null)
  const [name, setName] = useState('')
  const [checked, setChecked] = useState(false)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <h2 className="text-[17px] font-semibold">Tarieven plakken</h2>
        <p className="text-sm text-muted-foreground">Plak een bericht uit WhatsApp, e-mail of een spreadsheet. De app leest het met vaste regels op dit apparaat; er wordt niets naar een externe dienst gestuurd.</p>
        <Textarea aria-label="Geplakte tekst" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[300px] font-mono text-[13px]" placeholder={'Bijv.\nStroom enkel: € 0,25 per kWh\nGas: € 1,25 per m3\nVaste leveringskosten stroom: € 8,99 per maand\n…'} />
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={!text.trim()}
            onClick={() => {
              setDraft(parseTariffText(text))
              setChecked(false)
            }}
          >
            <ClipboardPaste /> Tarieven herkennen
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setText('')
              setDraft(null)
            }}
          >
            Leegmaken
          </Button>
        </div>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="text-[17px] font-semibold">Herkende waarden</h2>
        {!draft ? (
          <p className="text-sm text-muted-foreground">Na “Tarieven herkennen” ziet u hier elke gevonden waarde met de regel waar hij vandaan komt.</p>
        ) : (
          <>
            {draft.fields.length === 0 && <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">Er is niets herkend. Controleer de tekst of vul het aanbod met de hand in.</p>}
            <ul className="divide-y">
              {draft.fields.map((f) => (
                <li key={f.key} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{f.label}</span>
                    <span className="tnum text-[15px] font-semibold">{f.display}</span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">↳ “{f.source}”</div>
                  {f.warning && <div className="mt-0.5 text-xs font-medium text-warn">{f.warning}</div>}
                </li>
              ))}
            </ul>
            {draft.conflicts.length > 0 && (
              <div className="rounded-xl bg-warn-soft p-3 text-sm text-warn">
                <strong>Tegenstrijdig:</strong>
                <ul className="mt-1 list-disc pl-4">
                  {draft.conflicts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {draft.missing.length > 0 && (
              <div className="rounded-xl bg-accent-soft p-3 text-sm">
                <strong>Niet gevonden (blijft leeg):</strong> {draft.missing.join(' · ')}
              </div>
            )}
            {draft.unrecognized.length > 0 && (
              <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Bedragen die niet zijn geplaatst:</strong>
                <ul className="mt-1 list-disc pl-4 font-mono text-xs">
                  {draft.unrecognized.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
            )}
            {draft.fields.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <Field label="Naam voor dit aanbod">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Actie december" />
                </Field>
                <div className="rounded-2xl bg-muted/60 px-4 py-1">
                  <Switch checked={checked} onCheckedChange={setChecked} label="Ik heb elke waarde vergeleken met de bron" />
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={!checked || !name.trim()}
                  onClick={() => {
                    saveOffer(draftToOffer(draft, newId(), new Date().toISOString(), name.trim()))
                    setText('')
                    setDraft(null)
                    setName('')
                    toast('Concept aangemaakt. Zet de status op Gecontroleerd om het te gebruiken.')
                    onDone()
                  }}
                >
                  Concept aanmaken
                </Button>
                <p className="text-xs text-muted-foreground">Het aanbod komt als concept bij Aanbiedingen. Het is pas te gebruiken nadat u het daar aanvult en op Gecontroleerd zet.</p>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

/* ---------- belastingen en netbeheer ---------- */

function RulesPanel() {
  const { regulatory, setRegulatory } = useEnergy()
  const years = [...regulatory].sort((a, b) => a.year - b.year)
  const patch = (year: number, p: Partial<RegulatoryYear>) => setRegulatory(regulatory.map((y) => (y.year === year ? { ...y, ...p } : y)))
  const today = todayIso()
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Deze bedragen zijn voor elke leverancier gelijk. Ze zijn alleen nodig als een tarief <em>exclusief</em> energiebelasting is ingevoerd, of als u totale jaarkosten inclusief netbeheer wilt tonen. De app vult ze niet zelf in: neem ze over van de Belastingdienst en de netbeheerder.
      </p>
      {years.map((y) => (
        <Card key={y.year} className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{y.year}</h2>
            {y.verifiedOn ? <Badge tone="good">Gecontroleerd {formatDateNl(y.verifiedOn)}</Badge> : <Badge tone="warn">Niet gecontroleerd</Badge>}
            <Button size="sm" className="ml-auto" onClick={() => patch(y.year, { verifiedOn: today })}>
              Vandaag gecontroleerd
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Btw">
              <NumberInput value={y.vatBp / 100} onChange={(n) => patch(y.year, { vatBp: (n ?? 0) * 100 })} suffix="%" max={50} />
            </Field>
            <Field label="Energiebelasting stroom" hint="Exclusief btw">
              <RateInput value={y.energyTaxElectricity} onChange={(v) => patch(y.year, { energyTaxElectricity: v })} unit="/kWh" />
            </Field>
            <Field label="Energiebelasting gas" hint="Exclusief btw">
              <RateInput value={y.energyTaxGas} onChange={(v) => patch(y.year, { energyTaxGas: v })} unit="/m³" />
            </Field>
            <Field label="Vermindering energiebelasting" hint="Per jaar, inclusief btw">
              <MoneyInput value={y.taxReductionYearCents} onChange={(c) => patch(y.year, { taxReductionYearCents: c })} placeholder="Invullen" />
            </Field>
            <Field label="Netbeheer stroom" hint="Per jaar, inclusief btw">
              <MoneyInput value={y.networkElectricityYearCents} onChange={(c) => patch(y.year, { networkElectricityYearCents: c })} placeholder="Invullen" />
            </Field>
            <Field label="Netbeheer gas" hint="Per jaar, inclusief btw">
              <MoneyInput value={y.networkGasYearCents} onChange={(c) => patch(y.year, { networkGasYearCents: c })} placeholder="Invullen" />
            </Field>
          </div>
          <Field label="Zonnepanelen: teruglevering">
            <Segmented value={y.netting} onChange={(netting) => patch(y.year, { netting })} options={[{ value: 'salderen', label: 'Salderen (wegstrepen tegen afname)' }, { value: 'geen', label: 'Geen salderen' }]} />
          </Field>
          <Field label="Notitie">
            <Input value={y.note} onChange={(e) => patch(y.year, { note: e.target.value })} />
          </Field>
        </Card>
      ))}
      <Button
        variant="secondary"
        onClick={() => {
          const last = years[years.length - 1]
          setRegulatory([...regulatory, { ...last, year: last.year + 1, verifiedOn: null, note: `Overgenomen van ${last.year}; controleer alle bedragen.` }])
        }}
      >
        <Plus /> Jaar toevoegen (kopie van {years[years.length - 1]?.year})
      </Button>
    </div>
  )
}

/* ---------- back-up, CSV en JSON ---------- */

function BackupPanel() {
  const e = useEnergy()
  const file = useRef<HTMLInputElement>(null)
  const restore = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const today = todayIso()
  const applyImport = (r: ImportResult) => {
    if (r.offers.length) e.replaceOffers(mergeImported(e.offers, r.offers, newId))
    setResult(r)
  }
  return (
    <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
      <Card className="space-y-3 p-6">
        <h2 className="text-[17px] font-semibold">Aanbiedingen exporteren</h2>
        <p className="text-sm text-muted-foreground">CSV opent in Excel of Google Sheets, handig om meerdere aanbiedingen tegelijk aan te passen. JSON is een exacte kopie.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadFile(`essent-aanbiedingen-${today}.csv`, offersToCsv(e.offers), 'text/csv;charset=utf-8')}>
            <Download /> CSV
          </Button>
          <Button onClick={() => downloadFile(`essent-aanbiedingen-${today}.json`, JSON.stringify({ app: 'overstapadvies', kind: 'essent-aanbiedingen', exportedAt: new Date().toISOString(), offers: e.offers }, null, 2), 'application/json')}>
            <Download /> JSON
          </Button>
        </div>
      </Card>
      <Card className="space-y-3 p-6">
        <h2 className="text-[17px] font-semibold">Aanbiedingen importeren</h2>
        <p className="text-sm text-muted-foreground">Elk aanbod wordt eerst gecontroleerd. Bestaande aanbiedingen blijven staan: een aanbod met hetzelfde id maar andere inhoud komt er als “(import)” naast.</p>
        <Button onClick={() => file.current?.click()}>
          <Upload /> CSV of JSON kiezen
        </Button>
        <input
          ref={file}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="sr-only"
          onChange={async (ev) => {
            const f = ev.target.files?.[0]
            ev.target.value = ''
            if (!f) return
            const text = await f.text()
            if (f.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{')) {
              try {
                applyImport(jsonToOffers(JSON.parse(text)))
              } catch {
                setResult({ offers: [], errors: ['Dit bestand is geen geldig JSON-bestand.'] })
              }
            } else applyImport(csvToOffers(text, newId, new Date().toISOString()))
          }}
        />
        {result && (
          <div className={cn('rounded-xl p-3 text-sm', result.errors.length ? 'bg-warn-soft' : 'bg-good-soft')}>
            <p className="font-semibold">
              {result.offers.length} aanbod(en) gecontroleerd en toegevoegd{result.errors.length ? `, ${result.errors.length} afgekeurd` : ''}.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-warn">
                {result.errors.slice(0, 8).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
      <Card className="space-y-3 p-6 sm:col-span-2">
        <h2 className="text-[17px] font-semibold">Volledige back-up van de Essent-module</h2>
        <p className="text-sm text-muted-foreground">Aanbiedingen, vorige versies, belastinginstellingen, opgeslagen vergelijkingen en provisie-instellingen. Terugzetten vervangt de huidige Essent-gegevens; de Ziggo-module blijft ongemoeid.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => downloadFile(`essent-backup-${today}.json`, JSON.stringify({ app: 'overstapadvies', kind: 'essent-backup', version: 1, exportedAt: new Date().toISOString(), offers: e.offers, history: e.history, defaultOfferId: e.defaultOfferId, regulatory: e.regulatory, saved: e.saved, commission: e.commission }, null, 2), 'application/json')}>
            <Download /> Back-up maken
          </Button>
          <Button onClick={() => restore.current?.click()}>
            <Upload /> Back-up terugzetten
          </Button>
          <input
            ref={restore}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={async (ev) => {
              const f = ev.target.files?.[0]
              ev.target.value = ''
              if (!f) return
              try {
                const data = JSON.parse(await f.text())
                if (data?.app !== 'overstapadvies' || data.kind !== 'essent-backup') throw new Error('kind')
                const checked = jsonToOffers({ app: 'overstapadvies', offers: data.offers })
                if (checked.errors.length) throw new Error(checked.errors[0])
                e.restoreAll(data)
                toast('Back-up teruggezet')
              } catch (err) {
                toast((err as Error).message === 'kind' || err instanceof SyntaxError ? 'Dit is geen Essent-back-up van deze app.' : `Back-up afgekeurd: ${(err as Error).message}`)
              }
            }}
          />
        </div>
      </Card>
    </div>
  )
}

export default function EnergyTariffsPage() {
  const offers = useEnergy((s) => s.offers)
  const [tab, setTab] = useState<Tab>('offers')
  return (
    <Page className="max-w-[1180px]">
      <PageHeader title="Essent — Tarieven & Acties" subtitle="Alleen voor u. Wijzigingen gelden direct, zonder nieuwe versie van de app." />
      <div className="mb-4 overflow-x-auto pb-1">
        <Segmented className="min-w-[600px]" aria-label="Onderdeel" value={tab} onChange={setTab} options={[{ value: 'offers', label: `Aanbiedingen (${offers.length})` }, { value: 'paste', label: 'Tarieven plakken' }, { value: 'rules', label: 'Belastingen & netbeheer' }, { value: 'backup', label: 'Import & back-up' }]} />
      </div>
      <div key={tab} className="animate-fade-up">
        {tab === 'offers' && <OffersPanel />}
        {tab === 'paste' && <PastePanel onDone={() => setTab('offers')} />}
        {tab === 'rules' && <RulesPanel />}
        {tab === 'backup' && <BackupPanel />}
      </div>
    </Page>
  )
}
