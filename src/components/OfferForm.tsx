import { Gift as GiftIcon, ImagePlus, X } from 'lucide-react'
import { newId } from '@/engine/defaults'
import type { Gift, GiftType, Offer } from '@/engine/types'
import { toast } from '@/store/toast'
import { ListEditor } from './ListEditor'
import { Button } from './ui/button'
import { Field, Input, MoneyInput, NumberInput, Segmented, Select, Switch, Textarea } from './ui/inputs'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    {children}
  </section>
)

const emptyGift = (): Gift => ({ type: 'televisie', name: '', imageDataUrl: null, retailValueCents: null, description: '', conditions: '' })

async function readImage(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

export function validateOffer(o: Offer): string[] {
  const errors: string[] = []
  if (!o.name.trim()) errors.push('Geef de aanbieding een naam.')
  if (o.regularMonthlyCents <= 0) errors.push('Vul het reguliere maandbedrag in.')
  if (o.promoMonths > 0 && o.promoMonthlyCents <= 0) errors.push('Vul de actieprijs in, of zet het aantal actiemaanden op 0.')
  if (o.validFrom && o.validTo && o.validTo < o.validFrom) errors.push('De einddatum ligt vóór de begindatum.')
  return errors
}

/** Formulier voor alle velden van een aanbieding; gebruikt in beheer én per advies. */
export function OfferForm({ offer, onChange }: { offer: Offer; onChange: (offer: Offer) => void }) {
  const set = (patch: Partial<Offer>) => onChange({ ...offer, ...patch })
  const setGift = (patch: Partial<Gift>) => set({ gift: { ...(offer.gift ?? emptyGift()), ...patch } })

  return (
    <div className="space-y-7">
      <Section title="Pakket">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Naam aanbieding" className="sm:col-span-2">
            <Input value={offer.name} onChange={(e) => set({ name: e.target.value })} placeholder="Bijv. Internet + TV 400 – 1 jaar actie" />
          </Field>
          <Field label="Aanbieder">
            <Input value={offer.provider} onChange={(e) => set({ provider: e.target.value })} />
          </Field>
          <Field label="Internetsnelheid">
            <NumberInput value={offer.speedMbps} onChange={(n) => set({ speedMbps: n ?? 0 })} suffix="Mbit/s" max={10000} />
          </Field>
          <Field label="Type">
            <Segmented value={offer.kind} onChange={(kind) => set({ kind })} options={[{ value: 'internet', label: 'Alleen internet' }, { value: 'internet_tv', label: 'Internet + TV' }]} />
          </Field>
          <Field label="Contractduur">
            <Segmented value={offer.contractMonths} onChange={(contractMonths) => set({ contractMonths })} options={[{ value: 12, label: '12 maanden' }, { value: 24, label: '24 maanden' }]} />
          </Field>
        </div>
      </Section>

      <Section title="Maandprijzen (incl. btw)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Actieprijs per maand">
            <MoneyInput value={offer.promoMonthlyCents} onChange={(c) => set({ promoMonthlyCents: c ?? 0 })} emptyAsZero />
          </Field>
          <Field label="Aantal actiemaanden" hint="0 = geen actieprijs">
            <NumberInput value={offer.promoMonths} onChange={(n) => set({ promoMonths: n ?? 0 })} max={24} suffix="mnd" />
          </Field>
          <Field label="Regulier per maand" hint="Geldt na de actieperiode">
            <MoneyInput value={offer.regularMonthlyCents} onChange={(c) => set({ regularMonthlyCents: c ?? 0 })} emptyAsZero />
          </Field>
        </div>
      </Section>

      <Section title="Eenmalige kosten">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Activatie">
            <MoneyInput value={offer.activationCents} onChange={(c) => set({ activationCents: c ?? 0 })} emptyAsZero />
          </Field>
          <Field label="Installatie">
            <MoneyInput value={offer.installationCents} onChange={(c) => set({ installationCents: c ?? 0 })} emptyAsZero />
          </Field>
          <Field label="Apparatuur">
            <MoneyInput value={offer.equipmentCents} onChange={(c) => set({ equipmentCents: c ?? 0 })} emptyAsZero />
          </Field>
        </div>
      </Section>

      <Section title="Extra maandabonnementen">
        <ListEditor
          items={offer.extras}
          onChange={(extras) => set({ extras })}
          create={() => ({ id: newId(), label: '', monthlyCents: 0 })}
          addLabel="Extra toevoegen"
          empty="Geen extra's, bijvoorbeeld een sport- of filmpakket."
          render={(item, update) => (
            <div className="grid grid-cols-[1fr_130px] gap-2">
              <Input aria-label="Omschrijving" placeholder="Omschrijving" value={item.label} onChange={(e) => update({ label: e.target.value })} />
              <MoneyInput aria-label="Bedrag per maand" value={item.monthlyCents} onChange={(c) => update({ monthlyCents: c ?? 0 })} emptyAsZero />
            </div>
          )}
        />
      </Section>

      <Section title="Maandkortingen">
        <ListEditor
          items={offer.discounts}
          onChange={(discounts) => set({ discounts })}
          create={() => ({ id: newId(), label: '', monthlyCents: 0, fromMonth: 1, toMonth: 12, exclusiveGroup: null })}
          addLabel="Korting toevoegen"
          empty="Geen aanvullende kortingen bovenop de actieprijs."
          render={(item, update) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.3fr_1fr_.7fr_.7fr_1fr]">
              <Input aria-label="Omschrijving" placeholder="Omschrijving" value={item.label} onChange={(e) => update({ label: e.target.value })} />
              <MoneyInput aria-label="Korting per maand" value={item.monthlyCents} onChange={(c) => update({ monthlyCents: c ?? 0 })} emptyAsZero />
              <NumberInput value={item.fromMonth} onChange={(n) => update({ fromMonth: Math.max(1, n ?? 1) })} min={1} max={24} placeholder="van" suffix="van" />
              <NumberInput value={item.toMonth} onChange={(n) => update({ toMonth: n })} min={1} max={24} nullable placeholder="∞" suffix="t/m" />
              <Input aria-label="Groep" placeholder="Groep (optie)" value={item.exclusiveGroup ?? ''} onChange={(e) => update({ exclusiveGroup: e.target.value || null })} />
            </div>
          )}
        />
        <p className="text-xs text-muted-foreground">Kortingen met dezelfde groepsnaam stapelen niet: per maand telt alleen de hoogste. Zo worden overlappende acties niet dubbel geteld.</p>
      </Section>

      <Section title="Cadeau">
        <Switch checked={!!offer.gift} onCheckedChange={(on) => set({ gift: on ? emptyGift() : null })} label="Aanbieding met cadeau" description="De winkelwaarde telt nooit mee als besparing." />
        {offer.gift && (
          <div className="grid gap-3 rounded-2xl bg-accent-soft/60 p-4 sm:grid-cols-2">
            <Field label="Soort">
              <Select value={offer.gift.type} onChange={(e) => setGift({ type: e.target.value as GiftType })}>
                <option value="televisie">Televisie</option>
                <option value="soundbar">Soundbar</option>
                <option value="cadeaukaart">Cadeaukaart</option>
                <option value="anders">Ander actieproduct</option>
              </Select>
            </Field>
            <Field label="Productnaam">
              <Input value={offer.gift.name} onChange={(e) => setGift({ name: e.target.value })} placeholder="Bijv. 43-inch smart-tv" />
            </Field>
            <Field label="Adviesprijs (optioneel)" hint="Alleen ter informatie">
              <MoneyInput value={offer.gift.retailValueCents} onChange={(c) => setGift({ retailValueCents: c })} />
            </Field>
            <Field label="Afbeelding (optioneel)">
              <div className="flex items-center gap-2">
                {offer.gift.imageDataUrl ? (
                  <>
                    <img src={offer.gift.imageDataUrl} alt="" className="size-12 rounded-lg border object-cover" />
                    <Button variant="ghost" size="sm" onClick={() => setGift({ imageDataUrl: null })}>
                      <X /> Verwijderen
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" asChild>
                    <label className="cursor-pointer">
                      <ImagePlus /> Kies afbeelding
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const url = await readImage(file).catch(() => null)
                          if (url) setGift({ imageDataUrl: url })
                          else toast('Deze afbeelding kon niet worden gelezen.')
                        }}
                      />
                    </label>
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Omschrijving" className="sm:col-span-2">
              <Input value={offer.gift.description} onChange={(e) => setGift({ description: e.target.value })} />
            </Field>
            <Field label="Voorwaarden cadeau" className="sm:col-span-2">
              <Textarea value={offer.gift.conditions} onChange={(e) => setGift({ conditions: e.target.value })} placeholder="Bijv. op = op, levering na activatie" />
            </Field>
            <p className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
              <GiftIcon className="size-4 shrink-0" /> Het cadeau wordt apart getoond en nooit van de abonnementskosten afgetrokken.
            </p>
          </div>
        )}
      </Section>

      <Section title="Geldigheid en versie">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Geldig vanaf">
            <Input type="date" value={offer.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
          </Field>
          <Field label="Geldig tot en met">
            <Input type="date" value={offer.validTo} onChange={(e) => set({ validTo: e.target.value })} />
          </Field>
          <Field label="Versie">
            <Input value={offer.version} onChange={(e) => set({ version: e.target.value })} />
          </Field>
        </div>
        <Switch checked={!offer.isExample} onCheckedChange={(verified) => set({ isExample: !verified })} label="Voorwaarden gecontroleerd" description="Zet aan zodra prijzen en voorwaarden overeenkomen met de actuele actie. Uit = gemarkeerd als voorbeeld." />
      </Section>

      <Section title="Voorwaarden en notities">
        <Field label="Voorwaarden (zichtbaar voor de klant)">
          <Textarea value={offer.conditions} onChange={(e) => set({ conditions: e.target.value })} />
        </Field>
        <Field label="Interne notities (alleen adviseur)" hint="Verschijnt nooit in klantweergave, PDF of gedeelde tekst.">
          <Textarea value={offer.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} />
        </Field>
      </Section>
    </div>
  )
}
