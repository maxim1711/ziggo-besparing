import { CalendarPlus, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { buildCalendarEvent, googleCalendarUrl } from '@/engine/calendar'
import { newId } from '@/engine/defaults'
import { useData, type FollowUp, type FollowUpStatus } from '@/store/data'
import { toast } from '@/store/toast'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Field, Input, Select, Textarea } from './ui/inputs'

export const STATUS_LABEL: Record<FollowUpStatus, string> = { open: 'Open', gepland: 'Gepland', afgerond: 'Afgerond', vervallen: 'Vervallen' }

export const blankFollowUp = (patch: Partial<FollowUp> = {}): FollowUp => ({ id: newId(), createdAt: new Date().toISOString(), reference: '', callbackDate: null, callbackTime: null, durationMinutes: 30, address: '', phone: '', reason: '', contractEndDate: null, offerDiscussed: '', notes: '', status: 'open', ...patch })

export function FollowUpDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial: FollowUp | null }) {
  const upsert = useData((s) => s.upsertFollowUp)
  const [f, setF] = useState<FollowUp>(() => initial ?? blankFollowUp())
  useEffect(() => {
    if (open) setF(initial ?? blankFollowUp())
  }, [open, initial])
  const set = (patch: Partial<FollowUp>) => setF((x) => ({ ...x, ...patch }))
  const event = buildCalendarEvent(f)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Opvolging"
      description="Alle velden zijn optioneel. Met een datum kunt u de afspraak direct in Google Agenda zetten."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            onClick={() => {
              upsert(f)
              toast('Opvolging opgeslagen op dit apparaat')
              onOpenChange(false)
            }}
          >
            Alleen opslaan
          </Button>
          <Button
            variant="primary"
            disabled={!event}
            title={event ? undefined : 'Vul eerst een datum in'}
            onClick={() => {
              upsert(f)
              if (event) window.open(googleCalendarUrl(event), '_blank', 'noopener')
              toast('Opgeslagen. Google Agenda opent met de afspraak ingevuld.')
              onOpenChange(false)
            }}
          >
            <CalendarPlus /> Opslaan en in agenda zetten
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Referentie of voornaam" hint="Zo herkent u de afspraak in uw agenda">
          <Input value={f.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Bijv. Jan – hoekhuis" />
        </Field>
        <Field label="Datum afspraak of terugbellen">
          <Input type="date" value={f.callbackDate ?? ''} onChange={(e) => set({ callbackDate: e.target.value || null })} />
        </Field>
        <Field label="Tijd" hint="Leeg = hele dag">
          <Input type="time" value={f.callbackTime ?? ''} onChange={(e) => set({ callbackTime: e.target.value || null })} />
        </Field>
        <Field label="Duur">
          <Select value={String(f.durationMinutes ?? 30)} onChange={(e) => set({ durationMinutes: Number(e.target.value) })}>
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} minuten
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Telefoonnummer" hint="Optioneel">
          <Input type="tel" inputMode="tel" autoComplete="off" value={f.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} placeholder="06 …" />
        </Field>
        <Field label="Adres" hint="Optioneel; komt als locatie in de agenda" className="sm:col-span-2">
          <Input autoComplete="off" value={f.address ?? ''} onChange={(e) => set({ address: e.target.value })} placeholder="Straat en huisnummer, plaats" />
        </Field>
        <Field label="Reden">
          <Input value={f.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="Bijv. contract loopt nog" />
        </Field>
        <Field label="Einddatum huidig contract">
          <Input type="date" value={f.contractEndDate ?? ''} onChange={(e) => set({ contractEndDate: e.target.value || null })} />
        </Field>
        <Field label="Besproken aanbieding">
          <Input value={f.offerDiscussed} onChange={(e) => set({ offerDiscussed: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={(e) => set({ status: e.target.value as FollowUpStatus })}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notities" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      <p className="mt-4 flex gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        Deze gegevens blijven op dit apparaat, tot u zelf op “in agenda zetten” tikt: dan gaan titel, tijd, adres, telefoonnummer en notities naar uw Google Agenda. Noteer geen bank-, betaal- of identiteitsgegevens en verwijder opvolgingen die u niet meer nodig heeft.
      </p>
    </Dialog>
  )
}
