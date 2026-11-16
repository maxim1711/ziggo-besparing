import { Copy, Gift, Pencil, Plus, RotateCcw, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { OfferForm, validateOffer } from '@/components/OfferForm'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { addMonths, formatDateNl, todayIso } from '@/engine/dates'
import { emptyOffer } from '@/engine/defaults'
import type { Offer } from '@/engine/types'
import { kindLabel } from '@/lib/utils'
import { useData } from '@/store/data'
import { toast } from '@/store/toast'
import { offerPriceLine } from './AdvicePage'

export default function BundlesPanel() {
  const { offers, upsertOffer, deleteOffer, duplicateOffer, restoreSampleOffers } = useData()
  const [editing, setEditing] = useState<Offer | null>(null)
  const [removing, setRemoving] = useState<Offer | null>(null)
  const today = todayIso()
  const errors = editing ? validateOffer(editing) : []
  const isNew = editing ? !offers.some((o) => o.id === editing.id) : false

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-muted-foreground">Een bundel heeft één totaalprijs voor internet (en tv). Kies hem in de pakketbouwer onder Geavanceerd; losse onderdelen tellen dan niet nog eens mee.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              restoreSampleOffers()
              toast('Voorbeeldbundels toegevoegd')
            }}
          >
            <RotateCcw /> Voorbeelden terugzetten
          </Button>
          <Button size="sm" variant="primary" onClick={() => setEditing({ ...emptyOffer(today), validTo: addMonths(today, 1) })}>
            <Plus /> Nieuwe bundel
          </Button>
        </div>
      </div>
      {offers.length === 0 ? (
        <Card>
          <EmptyState icon={<Tags />} title="Nog geen bundels" text="Bundels zijn optioneel. De pakketbouwer werkt ook met alleen losse onderdelen." action={<Button variant="primary" onClick={() => setEditing({ ...emptyOffer(today), validTo: addMonths(today, 1) })}><Plus /> Nieuwe bundel</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((o) => {
            const status = o.validTo < today ? { tone: 'warn' as const, label: 'Verlopen' } : o.validFrom > today ? { tone: 'neutral' as const, label: 'Nog niet geldig' } : { tone: 'good' as const, label: 'Actief' }
            return (
              <Card key={o.id} className="flex flex-col p-5">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {o.isExample ? <Badge tone="accent">Voorbeeld</Badge> : <Badge tone="primary">Gecontroleerd</Badge>}
                  {o.gift && (
                    <Badge tone="primary">
                      <Gift /> Cadeau
                    </Badge>
                  )}
                </div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary">{o.provider}</div>
                <h2 className="text-lg font-semibold leading-snug tracking-tight">{o.name}</h2>
                <p className="tnum mt-1 text-[15px] font-medium">{offerPriceLine(o)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {kindLabel(o.kind)} · {o.speedMbps} Mbit/s · contract {o.contractMonths} maanden
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Geldig {formatDateNl(o.validFrom)} t/m {formatDateNl(o.validTo)} · versie {o.version}
                </p>
                <div className="mt-4 flex gap-2 border-t pt-4">
                  <Button className="flex-1" variant="secondary" onClick={() => setEditing(structuredClone(o))}>
                    <Pencil /> Bewerken
                  </Button>
                  <Button size="icon" aria-label="Dupliceren" onClick={() => duplicateOffer(o.id)}>
                    <Copy />
                  </Button>
                  <Button size="icon" variant="danger" aria-label="Verwijderen" onClick={() => setRemoving(o)}>
                    <Trash2 />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        wide
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={isNew ? 'Nieuwe bundel' : 'Bundel bewerken'}
        description="Alle bedragen inclusief btw."
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
                if (editing) upsertOffer(editing)
                setEditing(null)
                toast('Aanbieding opgeslagen')
              }}
            >
              Opslaan
            </Button>
          </>
        }
      >
        {editing && <OfferForm offer={editing} onChange={setEditing} />}
      </Dialog>

      <Dialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Aanbieding verwijderen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Annuleren
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (removing) deleteOffer(removing.id)
                setRemoving(null)
              }}
            >
              <Trash2 /> Verwijderen
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">“{removing?.name}” wordt verwijderd uit het beheer. Eerder opgeslagen adviezen behouden hun eigen kopie.</p>
      </Dialog>
    </div>
  )
}
