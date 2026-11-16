import { ArrowLeft, ArrowRight, Check, FileDown, Info, Send } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatedMoney } from '@/components/AnimatedMoney'
import { Breakdown } from '@/components/Breakdown'
import { GiftImage } from '@/components/GiftImage'
import { OptionTabs } from '@/components/OptionTabs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { priceStory, type CustomerView } from '@/engine/customerView'
import { formatDateNl } from '@/engine/dates'
import { formatEuro } from '@/engine/money'
import { downloadProposalPdf } from '@/export/pdf'
import { buildShareText, shareText } from '@/export/shareText'
import { useData } from '@/store/data'
import { useComparison } from '@/store/draft'
import { toast } from '@/store/toast'

/**
 * Klantpresentatie: één rustig scherm. Krijgt uitsluitend een CustomerView
 * (zie engine/customerView); provisie, doelen en interne notities bestaan hier niet.
 */

const eur = (c: number) => formatEuro(c, { decimals: 'auto' })

function Result({ v }: { v: CustomerView }) {
  const r = v.result
  const provider = v.current.provider || 'uw huidige aanbieder'
  const now = r.currentKnown ? `Vergeleken met wat u nu betaalt bij ${provider} (${formatEuro(r.months[0].currentCents)} per maand).` : ''
  if (!r.currentKnown) {
    return (
      <div className="rounded-3xl bg-muted p-7">
        <div className="text-lg font-medium text-muted-foreground">Uw kosten over {r.period} maanden</div>
        <AnimatedMoney cents={r.newPeriodCents} decimals="auto" className="mt-1 block text-6xl font-semibold tracking-tight" />
        <p className="mt-3 text-base text-muted-foreground">Uw huidige maandbedrag is niet ingevuld, dus er is geen vergelijking gemaakt.</p>
      </div>
    )
  }
  if (r.totalSavingsCents > 0) {
    return (
      <div className="rounded-3xl bg-good-soft p-7">
        <div className="text-lg font-medium">Uw besparing over {r.period} maanden</div>
        <AnimatedMoney cents={r.totalSavingsCents} decimals="auto" className="mt-1 block text-[clamp(56px,7vw,88px)] font-semibold leading-none tracking-tighter text-good" />
        <p className="mt-4 text-base text-muted-foreground">{now}</p>
      </div>
    )
  }
  if (r.totalSavingsCents < 0) {
    return (
      <div className="rounded-3xl bg-warn-soft p-7">
        <div className="text-lg font-medium">Dit kost u meer dan nu</div>
        <div className="mt-1 text-[clamp(44px,5.5vw,68px)] font-semibold leading-none tracking-tighter text-warn">
          <AnimatedMoney cents={-r.totalSavingsCents} decimals="auto" /> meer
        </div>
        <p className="mt-2 text-lg">over {r.period} maanden</p>
        <p className="mt-3 text-base text-muted-foreground">{now}</p>
      </div>
    )
  }
  return (
    <div className="rounded-3xl bg-muted p-7">
      <div className="text-2xl font-semibold">U betaalt over {r.period} maanden hetzelfde als nu</div>
      <p className="mt-3 text-base text-muted-foreground">{now}</p>
    </div>
  )
}

function GiftCard({ v }: { v: CustomerView }) {
  const g = v.offer.gift
  if (!g) return null
  return (
    <div className="flex items-center gap-5 rounded-3xl border bg-card p-5">
      <GiftImage src={g.imageDataUrl} alt={g.name} className="size-28 sm:size-32" />
      <div className="min-w-0">
        <div className="text-sm font-semibold uppercase tracking-wider text-accent">Uw cadeau</div>
        <div className="text-xl font-semibold leading-tight">{g.name || 'Actieproduct'}</div>
        {g.description && <p className="text-base text-muted-foreground">{g.description}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {g.retailValueCents ? `Geadverteerde waarde ${eur(g.retailValueCents)}. ` : ''}
          {g.conditions ? `${g.conditions} ` : ''}Het cadeau is geen geldbedrag en telt niet mee in uw besparing.
        </p>
      </div>
    </div>
  )
}

export default function PresentationPage() {
  const navigate = useNavigate()
  const { all, active, activeIndex } = useComparison()
  const advisorName = useData((s) => s.settings.advisorName)
  const [calc, setCalc] = useState(false)
  const [next, setNext] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!active || active.blocked) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState icon={<Info />} title="Nog niets om te tonen" text={active ? 'Er moet nog een prijs of combinatie worden gecontroleerd.' : 'Stel eerst een pakket samen.'} action={<Button variant="primary" onClick={() => navigate('/ziggo')}>Naar het pakket</Button>} />
      </div>
    )
  }

  const v = active.view
  const { offer, result: r, combo } = v
  const story = priceStory(v)
  const includes = offer.includes ?? [offer.name]
  const comboOn = combo.hasVodafone && combo.eligible && combo.monthlyDiscountCents > 0
  const mobile = combo.hasVodafone && combo.eligible ? (combo.mobileInvoiceDiscountCents ?? 0) : 0

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto bg-white">
      <header className="safe-t flex items-center justify-between gap-3 px-4 pt-3 sm:px-6">
        <button onClick={() => navigate('/ziggo')} className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground/80 hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Pakket aanpassen
        </button>
        <OptionTabs options={all} activeIndex={activeIndex} />
      </header>

      <main key={active.buildIndex} className="mx-auto grid w-full max-w-[1180px] flex-1 animate-fade-up content-center items-center gap-8 px-6 py-6 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        <section>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold uppercase tracking-[.16em] text-primary">Uw nieuwe abonnement</span>
            {offer.promoName && <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-warn">Welkomstactie: {offer.promoName}</span>}
          </div>
          <h1 className="mt-2 text-[clamp(30px,4vw,46px)] font-semibold leading-[1.08] tracking-tight">{offer.name}</h1>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-lg text-muted-foreground">
            {includes.map((i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check className="size-5 text-primary" strokeWidth={2.5} /> {i}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-baseline gap-x-3">
            <AnimatedMoney cents={story.nowCents} className="text-[clamp(64px,9vw,112px)] font-semibold leading-none tracking-tighter" />
            <span className="whitespace-nowrap text-2xl text-muted-foreground">per maand</span>
          </div>
          <dl className="mt-5 space-y-1.5 text-[22px] leading-snug">
            <div className="font-medium">{story.nowLabel}</div>
            {story.later.map((l) => (
              <div key={l.label}>
                {l.label} <strong className="tnum font-semibold">{formatEuro(l.cents)}</strong> per maand
                {l.estimate && <span className="text-base text-muted-foreground"> (huidig tarief, kan wijzigen)</span>}
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <span className="rounded-full bg-primary-soft px-4 py-1.5 text-lg font-semibold text-primary">{offer.contractMonths} maanden contract</span>
            </div>
          </dl>
          <p className="mt-4 text-base text-muted-foreground">
            Prijzen inclusief btw.{r.oneTime.totalCents > 0 ? ` Eenmalige kosten: ${formatEuro(r.oneTime.totalCents)}.` : ' Geen eenmalige kosten.'}
            {comboOn && ` Inclusief ${eur(combo.monthlyDiscountCents)} Vodafone-voordeel per maand.`}
          </p>
        </section>

        <section className="space-y-4">
          <Result v={v} />
          <GiftCard v={v} />
          {mobile > 0 && (
            <p className="rounded-2xl border px-5 py-3 text-base text-muted-foreground">
              Daarnaast: <strong className="tnum text-foreground">{eur(mobile)}</strong> korting per maand op uw Vodafone-rekening. Dit staat los van uw Ziggo-abonnement en is hierboven niet meegeteld.
            </p>
          )}
        </section>
      </main>

      <footer className="safe-b mx-auto w-full max-w-[1180px] px-6 pb-5 sm:px-10">
        <div className="flex flex-col-reverse items-center justify-between gap-2 sm:flex-row">
          <button onClick={() => setCalc(true)} className="min-h-[48px] px-2 text-base font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Bekijk berekening
          </button>
          <Button variant="primary" size="lg" className="h-16 w-full px-8 text-lg sm:w-auto" onClick={() => setNext(true)}>
            Verder met dit abonnement <ArrowRight />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground sm:text-left">
          Onafhankelijk advies, geen officiële uiting van {offer.provider}.{offer.promoValidTo ? ` Actie geldig t/m ${formatDateNl(offer.promoValidTo)}.` : ''}{offer.pricesVerifiedOn ? ` Prijzen gecontroleerd op ${formatDateNl(offer.pricesVerifiedOn)}.` : ''}{offer.isExample && ' Let op: voorbeeldprijzen, nog niet gecontroleerd.'}
        </p>
      </footer>

      <Dialog wide open={calc} onOpenChange={setCalc} title="Berekening" description="Zo is het bedrag opgebouwd, inclusief alle kosten en aannames.">
        <Breakdown view={v} lines={active.lines} />
      </Dialog>

      <Dialog
        open={next}
        onOpenChange={setNext}
        title="Volgende stap"
        footer={
          <Button variant="primary" onClick={() => navigate('/ziggo')}>
            Terug naar adviseur
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-muted p-4">
            <div className="font-semibold">{offer.name}</div>
            <div className="tnum text-sm text-muted-foreground">
              {formatEuro(story.nowCents)} per maand · {story.nowLabel.toLowerCase()}
              {story.later[0] && ` · ${story.later[0].label.toLowerCase()} ${formatEuro(story.later[0].cents)}`} · {offer.contractMonths} maanden contract
            </div>
          </div>
          <p className="flex gap-2.5 text-[15px]">
            <Info className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <strong>Dit is nog geen bestelling.</strong> Uw adviseur doorloopt nu samen met u de officiële aanmelding bij {offer.provider}. Pas als {offer.provider} die bevestigt, is het abonnement definitief. De voorwaarden van {offer.provider} zijn daarbij leidend.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await downloadProposalPdf(v, advisorName)
                  .then(() => toast('Samenvatting gedownload'))
                  .catch(() => toast('De PDF kon niet worden gemaakt.'))
                setBusy(false)
              }}
            >
              <FileDown /> {busy ? 'Bezig…' : 'Samenvatting (PDF)'}
            </Button>
            <Button onClick={() => shareText(buildShareText(v))}>
              <Send /> Stuur via WhatsApp
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

