import { Bookmark, CalendarClock, Download, FolderOpen, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FollowUpDialog, STATUS_LABEL } from '@/components/FollowUpDialog'
import { Page, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Segmented, Select } from '@/components/ui/inputs'
import { compare } from '@/engine/calc'
import { formatDateNl, todayIso } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { downloadFile } from '@/lib/utils'
import { useData, type FollowUp, type FollowUpStatus } from '@/store/data'
import { useDraft } from '@/store/draft'
import { compareEnergyOffer } from '@/engine/essent'
import { useEnergy, useEnergyDraft } from '@/store/energy'
import { toast } from '@/store/toast'

const csvCell = (s: string | null) => `"${(s ?? '').replace(/"/g, '""')}"`

export default function FollowUpsPage() {
  const navigate = useNavigate()
  const { followUps, consultations, upsertFollowUp, deleteFollowUp, clearFollowUps, deleteConsultation } = useData()
  const loadDraft = useDraft((s) => s.load)
  const energySaved = useEnergy((s) => s.saved)
  const deleteEnergySaved = useEnergy((s) => s.deleteComparison)
  const loadEnergy = useEnergyDraft((s) => s.load)
  const [tab, setTab] = useState<'followups' | 'saved'>('followups')
  const [dialog, setDialog] = useState<{ open: boolean; item: FollowUp | null }>({ open: false, item: null })
  const [confirmAll, setConfirmAll] = useState(false)
  const today = todayIso()
  const sorted = [...followUps].sort((a, b) => {
    const done = (f: FollowUp) => (f.status === 'afgerond' || f.status === 'vervallen' ? 1 : 0)
    return done(a) - done(b) || (a.callbackDate ?? '9999').localeCompare(b.callbackDate ?? '9999')
  })

  const exportCsv = () => {
    const head = ['Referentie', 'Terugbeldatum', 'Reden', 'Einddatum contract', 'Besproken aanbieding', 'Notities', 'Status', 'Aangemaakt']
    const lines = followUps.map((f) => [f.reference, f.callbackDate, f.reason, f.contractEndDate, f.offerDiscussed, f.notes, STATUS_LABEL[f.status], f.createdAt.slice(0, 10)].map(csvCell).join(';'))
    downloadFile(`opvolgingen-${today}.csv`, '﻿' + [head.map(csvCell).join(';'), ...lines].join('\r\n'), 'text/csv;charset=utf-8')
  }

  return (
    <Page>
      <PageHeader
        title="Opvolgingen"
        subtitle="Terugbelafspraken en opgeslagen adviezen, alleen op dit apparaat."
        actions={
          tab === 'followups' ? (
            <>
              <Button disabled={followUps.length === 0} onClick={exportCsv}>
                <Download /> CSV
              </Button>
              <Button disabled={followUps.length === 0} onClick={() => downloadFile(`opvolgingen-${today}.json`, JSON.stringify(followUps, null, 2), 'application/json')}>
                <Download /> JSON
              </Button>
              <Button variant="primary" onClick={() => setDialog({ open: true, item: null })}>
                <Plus /> Nieuwe opvolging
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="mb-4 flex gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          <strong>Privacy:</strong> wie persoonsgegevens op een apparaat bewaart, is daar zelf verantwoordelijk voor (AVG). Noteer zo weinig mogelijk, beveilig uw tablet met een code, en verwijder gegevens zodra u ze niet meer nodig heeft. Er wordt niets naar een server of derde partij gestuurd.
        </p>
      </div>
      <Segmented className="mb-4 max-w-md" value={tab} onChange={setTab} options={[{ value: 'followups', label: `Opvolgingen (${followUps.length})` }, { value: 'saved', label: `Opgeslagen adviezen (${consultations.length + energySaved.length})` }]} />

      {tab === 'followups' &&
        (sorted.length === 0 ? (
          <Card>
            <EmptyState icon={<CalendarClock />} title="Geen opvolgingen" text="Plan een terugbelafspraak vanuit een advies of voeg er hier een toe." action={<Button variant="primary" onClick={() => setDialog({ open: true, item: null })}><Plus /> Nieuwe opvolging</Button>} />
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {sorted.map((f) => {
                const active = f.status === 'open' || f.status === 'gepland'
                const overdue = active && f.callbackDate !== null && f.callbackDate < today
                const isToday = active && f.callbackDate === today
                return (
                  <Card key={f.id} className={`flex flex-wrap items-center gap-4 p-4 ${active ? '' : 'opacity-60'}`}>
                    <div className="min-w-[200px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[16px] font-semibold">{f.reference || 'Zonder referentie'}</h2>
                        {overdue && <Badge tone="warn">Te laat</Badge>}
                        {isToday && <Badge tone="good">Vandaag</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {f.callbackDate ? `Terugbellen op ${formatDateNl(f.callbackDate)}` : 'Geen terugbeldatum'}
                        {f.reason && ` · ${f.reason}`}
                      </p>
                      {(f.offerDiscussed || f.contractEndDate) && (
                        <p className="text-sm text-muted-foreground">
                          {f.offerDiscussed}
                          {f.offerDiscussed && f.contractEndDate && ' · '}
                          {f.contractEndDate && `contract tot ${formatDateNl(f.contractEndDate)}`}
                        </p>
                      )}
                      {f.notes && <p className="mt-1 text-sm">{f.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select aria-label="Status" className="w-[140px]" value={f.status} onChange={(e) => upsertFollowUp({ ...f, status: e.target.value as FollowUpStatus })}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </Select>
                      <Button size="icon" aria-label="Bewerken" onClick={() => setDialog({ open: true, item: f })}>
                        <Pencil />
                      </Button>
                      <Button size="icon" variant="danger" aria-label="Verwijderen" onClick={() => deleteFollowUp(f.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
            <div className="mt-5 text-right">
              <Button variant="danger" size="sm" onClick={() => setConfirmAll(true)}>
                <Trash2 /> Alle opvolgingen verwijderen
              </Button>
            </div>
          </>
        ))}

      {tab === 'saved' &&
        (consultations.length + energySaved.length === 0 ? (
          <Card>
            <EmptyState icon={<Bookmark />} title="Geen opgeslagen adviezen" text="Tik in het adviesscherm op “Opslaan” om een vergelijking anoniem te bewaren." />
          </Card>
        ) : (
          <div className="space-y-3">
            {energySaved.map((c) => {
              const r = compareEnergyOffer(c.input)
              return (
                <Card key={c.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold">{c.label || `Energieadvies van ${formatDateNl(c.savedAt.slice(0, 10))}`}</h2>
                      <Badge tone="accent">Essent</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.input.current.supplier || 'Onbekende leverancier'} → {c.input.offer.name} (tarieven versie {c.input.offer.version} van {formatDateNl(c.input.today)})
                    </p>
                    <p className="text-xs text-muted-foreground">Opgeslagen op {formatDateNl(c.savedAt.slice(0, 10))} · met de tarieven van toen</p>
                  </div>
                  {r.yearlySavingsCents !== null && <Badge tone={r.yearlySavingsCents >= 0 ? 'good' : 'warn'}>{r.yearlySavingsCents >= 0 ? `${formatEuro(r.yearlySavingsCents)} besparing` : `${formatEuro(-r.yearlySavingsCents)} duurder`} / jaar</Badge>}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        loadEnergy(c)
                        navigate('/energie')
                        toast('Energievergelijking geopend')
                      }}
                    >
                      <FolderOpen /> Openen
                    </Button>
                    <Button size="icon" variant="danger" aria-label="Verwijderen" onClick={() => deleteEnergySaved(c.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </Card>
              )
            })}
            {consultations.map((c) => {
              const first = c.options[0]
              const r = first ? compare({ current: c.current, offer: first, combo: c.combo, period: c.period, startDate: c.startDate }) : null
              return (
                <Card key={c.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-[200px] flex-1">
                    <h2 className="text-[16px] font-semibold">{c.label || `Advies van ${formatDateNl(c.savedAt.slice(0, 10))}`}</h2>
                    <p className="text-sm text-muted-foreground">
                      {c.current.provider || 'Onbekende aanbieder'}
                      {c.current.monthlyCents !== null && ` · ${formatEuro(c.current.monthlyCents)} p/m`} → {c.options.map((o) => o.name).join(' / ') || 'geen aanbieding'}
                    </p>
                    <p className="text-xs text-muted-foreground">Opgeslagen op {formatDateNl(c.savedAt.slice(0, 10))}</p>
                  </div>
                  {r && r.currentKnown && <Badge tone={r.totalSavingsCents >= 0 ? 'good' : 'warn'}>{r.totalSavingsCents >= 0 ? `${formatEuro(r.totalSavingsCents)} besparing` : `${formatEuro(-r.totalSavingsCents)} duurder`} / {c.period} mnd</Badge>}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        loadDraft(c)
                        navigate('/ziggo')
                        toast('Advies geopend')
                      }}
                    >
                      <FolderOpen /> Openen
                    </Button>
                    <Button size="icon" variant="danger" aria-label="Verwijderen" onClick={() => deleteConsultation(c.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        ))}

      <FollowUpDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} initial={dialog.item} />
      <Dialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Alle opvolgingen verwijderen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmAll(false)}>
              Annuleren
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearFollowUps()
                setConfirmAll(false)
                toast('Alle opvolgingen verwijderd')
              }}
            >
              <Trash2 /> Alles verwijderen
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Dit kan niet ongedaan worden gemaakt. Exporteer eerst als u de gegevens wilt bewaren.</p>
      </Dialog>
    </Page>
  )
}
