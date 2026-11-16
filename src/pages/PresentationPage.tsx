import { ArrowLeft, ArrowRight, Check, ChevronLeft, FileDown, Handshake, Info, Send, Wifi, Wrench } from 'lucide-react'
import { useRef, useState } from 'react'
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
import { buildSwitchSlide, differenceView, nextSlide, slideControls, type SwitchSlide } from '@/engine/switching'
import { downloadProposalPdf } from '@/export/pdf'
import { buildShareText, shareText } from '@/export/shareText'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { useComparison, useDraft } from '@/store/draft'
import { toast } from '@/store/toast'

/**
 * Klantpresentatie in twee rustige schermen: (1) Uw aanbod, (2) Overstappen zonder gedoe.
 * Krijgt uitsluitend klantveilige gegevens; provisie, doelen en interne notities bestaan hier niet.
 */

const eur = (c: number) => formatEuro(c, { decimals: 'auto' })

function Result({ v }: { v: CustomerView }) {
  const r = v.result
  const d = differenceView(r)
  const provider = v.current.provider || 'uw huidige aanbieder'
  const now = r.currentKnown ? `Vergeleken met wat u nu betaalt bij ${provider} (${formatEuro(r.months[0].currentCents)} per maand).` : ''
  if (d.kind === 'onbekend') {
    return (
      <div className="rounded-3xl bg-muted p-7">
        <div className="text-lg font-medium text-muted-foreground">Uw kosten over {r.period} maanden</div>
        <AnimatedMoney cents={r.newPeriodCents} decimals="auto" className="mt-1 block text-6xl font-semibold tracking-tight" />
        <p className="mt-3 text-base text-muted-foreground">{d.explanation}</p>
      </div>
    )
  }
  if (d.kind === 'besparing') {
    return (
      <div className="rounded-3xl bg-good-soft p-7">
        <div className="text-lg font-medium">{d.headline}</div>
        <AnimatedMoney cents={d.totalCents} decimals="auto" className="mt-1 block text-[clamp(56px,7vw,88px)] font-semibold leading-none tracking-tighter text-good" />
        <p className="mt-4 text-lg">{d.subline}</p>
        <p className="mt-1 text-base text-muted-foreground">{now}</p>
      </div>
    )
  }
  if (d.kind === 'meerkosten') {
    return (
      <div className="rounded-3xl bg-warn-soft p-7">
        <div className="text-lg font-medium">Dit kost u meer dan nu</div>
        <div className="mt-2 text-[clamp(30px,3.6vw,44px)] font-semibold leading-[1.1] tracking-tight text-warn">
          Gemiddeld <AnimatedMoney cents={d.averageMonthlyCents} decimals="auto" /> meer per maand
        </div>
        <p className="tnum mt-2 text-2xl font-semibold">{d.subline}</p>
        <p className="mt-3 text-base text-muted-foreground">{d.explanation}</p>
        <p className="mt-1 text-base text-muted-foreground">{now}</p>
      </div>
    )
  }
  return (
    <div className="rounded-3xl bg-muted p-7">
      <div className="text-2xl font-semibold">{d.headline}</div>
      <p className="mt-2 text-lg text-muted-foreground">{d.subline}</p>
      <p className="mt-2 text-base text-muted-foreground">{now}</p>
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

function OfferSlide({ v }: { v: CustomerView }) {
  const { offer, result: r, combo } = v
  const story = priceStory(v)
  const includes = offer.includes ?? [offer.name]
  const comboOn = combo.hasVodafone && combo.eligible && combo.monthlyDiscountCents > 0
  const mobile = combo.hasVodafone && combo.eligible ? (combo.mobileInvoiceDiscountCents ?? 0) : 0
  return (
    <div className="grid w-full items-center gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
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
    </div>
  )
}

const ICONS = { handshake: Handshake, wifi: Wifi, wrench: Wrench }
const NAVY = '#0b1f4b'

function SwitchSlideView({ slide, onDetails }: { slide: SwitchSlide; onDetails: () => void }) {
  return (
    <div className="w-full">
      <div className="text-center">
        <div className="text-sm font-semibold uppercase tracking-[.16em] text-accent">{slide.intro}</div>
        <h1 className="mt-2 text-[clamp(34px,4.6vw,54px)] font-bold leading-[1.05] tracking-tight [@media(max-height:800px)]:text-[38px]" style={{ color: NAVY }}>
          {slide.title}
        </h1>
      </div>
      <div className="mt-9 grid gap-4 lg:grid-cols-3 lg:gap-5 [@media(max-height:800px)]:mt-5">
        {slide.cards.map((c, i) => {
          const Icon = ICONS[c.icon]
          return (
            <article key={c.id} className="flex animate-fade-up gap-5 rounded-3xl border bg-white p-6 shadow-card lg:flex-col lg:gap-0 lg:p-8 [@media(max-height:800px)]:p-5 [@media(max-height:800px)]:lg:p-6" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="grid size-[72px] shrink-0 place-items-center rounded-[22px] bg-gradient-to-br from-[#ff8a1f] to-[#f15a00] text-white shadow-[0_10px_24px_-10px_rgba(241,90,0,.6)] [@media(max-height:800px)]:size-14">
                <Icon className="size-9" strokeWidth={1.9} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="text-[30px] font-bold leading-[1.1] tracking-tight lg:mt-6 [@media(max-height:800px)]:text-[26px] [@media(max-height:800px)]:lg:mt-4" style={{ color: NAVY }}>
                  {c.heading}
                </h2>
                <p className="mt-3 text-[19px] leading-snug text-[#3b4a6b] [@media(max-height:800px)]:text-[17px]">{c.text}</p>
                {c.note && <p className="mt-auto pt-4 text-sm leading-snug text-muted-foreground">{c.note}</p>}
              </div>
            </article>
          )
        })}
      </div>
      <div className="mt-5 text-center [@media(max-height:800px)]:mt-1">
        <button onClick={onDetails} className="min-h-[44px] px-3 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Voorwaarden
        </button>
      </div>
    </div>
  )
}

export default function PresentationPage() {
  const navigate = useNavigate()
  const { all, active, activeIndex } = useComparison()
  const checklist = useDraft((s) => s.switching)
  const advisorName = useData((s) => s.settings.advisorName)
  const texts = useData((s) => s.switchTexts)
  const [slide, setSlide] = useState(0)
  const [calc, setCalc] = useState(false)
  const [details, setDetails] = useState(false)
  const [next, setNext] = useState(false)
  const [busy, setBusy] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)

  if (!active || active.blocked) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState icon={<Info />} title="Nog niets om te tonen" text={active ? 'Er moet nog een prijs of combinatie worden gecontroleerd.' : 'Stel eerst een pakket samen.'} action={<Button variant="primary" onClick={() => navigate('/ziggo')}>Naar het pakket</Button>} />
      </div>
    )
  }

  const v = active.view
  const { offer } = v
  const story = priceStory(v)
  const switching = buildSwitchSlide(checklist, texts, offer.provider)
  const controls = slideControls(slide)
  const tabs = ['Uw aanbod', switching.title]

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto bg-white"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        if (!touch.current || calc || details || next) return
        const dx = e.changedTouches[0].clientX - touch.current.x
        const dy = e.changedTouches[0].clientY - touch.current.y
        if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) setSlide((s) => nextSlide(s, dx < 0 ? 'volgende' : 'vorige'))
        touch.current = null
      }}
    >
      <header className="safe-t flex items-center justify-between gap-3 px-4 pt-3 sm:px-6">
        <button onClick={() => navigate('/ziggo')} className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground/80 hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Pakket aanpassen</span>
        </button>
        <nav aria-label="Schermen" className="flex gap-1">
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setSlide(i)} aria-current={i === slide ? 'step' : undefined} className={cn('flex h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors', i === slide ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground')}>
              <span className={cn('grid size-6 place-items-center rounded-full text-xs', i === slide ? 'bg-primary text-white' : 'bg-muted')}>{i + 1}</span>
              <span className={cn(i !== slide && 'hidden md:inline')}>{t}</span>
            </button>
          ))}
        </nav>
        <div className="flex min-w-[44px] justify-end">{slide === 0 && <OptionTabs options={all} activeIndex={activeIndex} />}</div>
      </header>

      <main key={`${slide}-${active.buildIndex}`} className="mx-auto flex w-full max-w-[1180px] flex-1 animate-fade-up items-center px-6 py-6 sm:px-10 [@media(max-height:800px)]:py-2">
        {slide === 0 ? <OfferSlide v={v} /> : <SwitchSlideView slide={switching} onDetails={() => setDetails(true)} />}
      </main>

      <footer className="safe-b mx-auto w-full max-w-[1180px] px-6 pb-5 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          {controls.back ? (
            <Button size="lg" variant="ghost" className="h-16" onClick={() => setSlide((s) => nextSlide(s, 'vorige'))}>
              <ChevronLeft /> {controls.back}
            </Button>
          ) : (
            <button onClick={() => setCalc(true)} className="min-h-[48px] px-2 text-base font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Bekijk berekening
            </button>
          )}
          <Button variant="primary" size="lg" className="h-16 px-8 text-lg" onClick={() => (controls.primaryAction === 'volgende' ? setSlide((s) => nextSlide(s, 'volgende')) : setNext(true))}>
            {controls.primary} <ArrowRight />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground sm:text-left">
          Onafhankelijk advies, geen officiële uiting van {offer.provider}.
          {slide === 0 && offer.promoValidTo ? ` Actie geldig t/m ${formatDateNl(offer.promoValidTo)}.` : ''}
          {slide === 0 && offer.pricesVerifiedOn ? ` Prijzen gecontroleerd op ${formatDateNl(offer.pricesVerifiedOn)}.` : ''}
          {slide === 0 && offer.isExample && ' Let op: voorbeeldprijzen, nog niet gecontroleerd.'}
        </p>
      </footer>

      <Dialog wide open={calc} onOpenChange={setCalc} title="Berekening" description="Zo is het bedrag opgebouwd, inclusief alle kosten en aannames.">
        <Breakdown view={v} lines={active.lines} />
      </Dialog>

      <Dialog open={details} onOpenChange={setDetails} title="Voorwaarden bij overstappen en installatie">
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          {switching.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">Meer informatie: ziggo.nl/overstappen en ziggo.nl/klantenservice/monteur.</p>
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
