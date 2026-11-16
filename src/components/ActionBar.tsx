import { BookmarkPlus, CalendarPlus, CheckCircle2, Columns3, Copy, Eye, EyeOff, FileDown, MoreHorizontal, Printer, Send, Share2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { estimateCommission } from '@/engine/commission'
import { todayIso } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { downloadProposalPdf } from '@/export/pdf'
import { buildShareText, shareText } from '@/export/shareText'
import { kindLabel } from '@/lib/utils'
import { useData, type OutcomeResult } from '@/store/data'
import { useComparison, useDraft, type OptionComparison } from '@/store/draft'
import { toast } from '@/store/toast'
import { blankFollowUp, FollowUpDialog } from './FollowUpDialog'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Field, Input, MoneyInput, Segmented, Textarea } from './ui/inputs'

/** Exporteren, delen, opslaan en uitkomst registreren voor de actieve optie. */
export function ActionBar({ option }: { option: OptionComparison }) {
  const navigate = useNavigate()
  const draft = useDraft()
  const { settings, saveConsultation, addOutcome } = useData()
  const { all } = useComparison()
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [share, setShare] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [followOpen, setFollowOpen] = useState(false)
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const commission = useMemo(() => estimateCommission(option.offer, draft.combo, settings.commission), [option.offer, draft.combo, settings.commission])
  const [outcome, setOutcome] = useState<OutcomeResult>('verkocht')
  const [outcomeCommission, setOutcomeCommission] = useState(0)
  const followInitial = useMemo(
    () => blankFollowUp({ contractEndDate: draft.current.contractEndDate, offerDiscussed: `${option.offer.provider} ${option.offer.name}`, reason: draft.current.contractEndDate && draft.current.contractEndDate > draft.startDate ? 'Huidig contract loopt nog' : '' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [followOpen],
  )

  const pdf = async () => {
    setBusy(true)
    try {
      await downloadProposalPdf(option.view, settings.advisorName)
      toast('PDF-voorstel gedownload')
    } catch {
      toast('De PDF kon niet worden gemaakt. Probeer de afdrukversie.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" onClick={() => setSaveOpen(true)}>
          <BookmarkPlus /> Opslaan
        </Button>
        <Button size="sm" onClick={() => setShare(buildShareText(option.view))}>
          <Share2 /> Delen
        </Button>
        <Button size="sm" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <MoreHorizontal /> Meer
        </Button>
      </div>
      {more && (
        <div className="mt-2 grid animate-fade-up grid-cols-2 gap-2">
          <Button variant="ghost" size="sm" onClick={pdf} disabled={busy}>
            <FileDown /> {busy ? 'Bezig…' : 'PDF-voorstel'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/afdrukken')}>
            <Printer /> Afdrukken
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFollowOpen(true)}>
            <CalendarPlus /> Opvolging
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOutcome('verkocht')
              setOutcomeCommission(commission.totalCents)
              setOutcomeOpen(true)
            }}
          >
            <CheckCircle2 /> Uitkomst
          </Button>
          {all.length > 1 && (
            <Button variant="ghost" size="sm" className="col-span-2" onClick={() => navigate('/vergelijken')}>
              <Columns3 /> Opties naast elkaar vergelijken
            </Button>
          )}
        </div>
      )}

      <Dialog
        open={share !== null}
        onOpenChange={(o) => !o && setShare(null)}
        title="Samenvatting delen"
        description="Controleer de tekst. Er wordt niets verstuurd totdat u zelf op verzenden tikt in WhatsApp."
        footer={
          <>
            <Button
              onClick={async () => {
                await navigator.clipboard?.writeText(share ?? '').catch(() => undefined)
                toast('Tekst gekopieerd')
              }}
            >
              <Copy /> Kopiëren
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                const r = await shareText(share ?? '')
                if (r !== 'cancelled') setShare(null)
              }}
            >
              <Send /> Delen via WhatsApp
            </Button>
          </>
        }
      >
        <Textarea value={share ?? ''} onChange={(e) => setShare(e.target.value)} className="min-h-[300px] font-mono text-[13px] leading-relaxed" />
      </Dialog>

      <Dialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Advies opslaan"
        description="Het advies wordt anoniem op dit apparaat bewaard: alleen bedragen, pakketten en datums."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                saveConsultation({ label: label.trim(), current: draft.current, options: all.map((o) => o.offer), combo: draft.combo, period: draft.period, startDate: draft.startDate })
                setLabel('')
                setSaveOpen(false)
                toast('Advies opgeslagen')
              }}
            >
              Opslaan
            </Button>
          </>
        }
      >
        <Field label="Eigen kenmerk (optioneel)" hint="Bijv. een straatnaam of volgnummer. Gebruik liever geen volledige naam.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bijv. Advies 14" />
        </Field>
      </Dialog>

      <FollowUpDialog open={followOpen} onOpenChange={setFollowOpen} initial={followInitial} />

      <Dialog
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
        title="Uitkomst registreren"
        description="Optioneel, voor uw eigen resultatenoverzicht. Er worden geen klantgegevens vastgelegd."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOutcomeOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                addOutcome({ date: todayIso(), result: outcome, offerName: option.offer.name, kind: option.offer.kind, commissionCents: outcome === 'verkocht' ? outcomeCommission : 0 })
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
          <p className="text-sm text-muted-foreground">
            {option.offer.name} · {kindLabel(option.offer.kind)}
          </p>
          {outcome === 'verkocht' && (
            <Field label="Provisie voor deze verkoop" hint="Vooringevuld vanuit uw provisie-instellingen; aanpasbaar.">
              <MoneyInput value={outcomeCommission} onChange={(c) => setOutcomeCommission(c ?? 0)} emptyAsZero />
            </Field>
          )}
        </div>
      </Dialog>
    </>
  )
}

/** Provisie-indicatie: standaard verborgen, want de klant kan meekijken. */
export function CommissionPeek({ option }: { option: OptionComparison }) {
  const [open, setOpen] = useState(false)
  const combo = useDraft((s) => s.combo)
  const settings = useData((s) => s.settings)
  const c = estimateCommission(option.offer, combo, settings.commission)
  return (
    <div className="no-print rounded-xl border border-dashed px-3 py-1">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[44px] w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground">
        {open ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        Alleen voor adviseur
        {open && <span className="tnum ml-auto text-sm font-semibold text-foreground">{formatEuro(c.totalCents)}</span>}
      </button>
      {open && (
        <ul className="space-y-1 pb-3 text-xs text-muted-foreground">
          <li className="pb-1">Geschatte provisie bij verkoop van deze optie:</li>
          {c.lines.map((l) => (
            <li key={l.label} className="flex justify-between">
              <span>{l.label}</span>
              <span className="tnum">{formatEuro(l.cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
