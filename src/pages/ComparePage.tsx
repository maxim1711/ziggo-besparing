import { Columns3, Gift, Info, Presentation } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActionBar } from '@/components/ActionBar'
import { CumulativeSavings, MonthlyTimeline, MonthTable, TotalBars, YearBars } from '@/components/charts/Charts'
import { InsightList } from '@/components/InsightList'
import { OptionTabs } from '@/components/OptionTabs'
import { Page, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState } from '@/components/ui/card'
import { Segmented } from '@/components/ui/inputs'
import { formatEuro } from '@/engine/money'
import { cn, kindLabel } from '@/lib/utils'
import { useComparison, useDraft } from '@/store/draft'

type ChartId = 'timeline' | 'years' | 'cumulative' | 'total' | 'table'

export default function ComparePage() {
  const navigate = useNavigate()
  const { all, active, activeIndex, period, current } = useComparison()
  const { setPeriod, setActive } = useDraft()
  const [chart, setChart] = useState<ChartId>('timeline')

  if (!active) {
    return (
      <Page>
        <PageHeader title="Vergelijken" />
        <Card>
          <EmptyState icon={<Columns3 />} title="Nog niets om te vergelijken" text="Stel in het adviesscherm een pakket samen. Via Geavanceerd kunt u tot drie opties naast elkaar zetten." action={<Button asChild variant="primary"><Link to="/ziggo">Naar nieuw advies</Link></Button>} />
        </Card>
      </Page>
    )
  }

  const known = active.result.currentKnown
  const curName = current.provider || 'Huidig'
  const dash = '—'
  const first = all[0].result
  const rows: { label: string; current: string; cells: (i: number) => React.ReactNode; strong?: boolean }[] = [
    { label: 'Internetsnelheid', current: current.speedMbps ? `${current.speedMbps} Mbit/s` : dash, cells: (i) => `${all[i].offer.speedMbps} Mbit/s` },
    { label: 'Type', current: current.hasTv ? 'Internet + TV' : 'Alleen internet', cells: (i) => kindLabel(all[i].offer.kind) },
    { label: 'Contractduur', current: dash, cells: (i) => `${all[i].offer.contractMonths} maanden` },
    {
      label: 'Per maand tijdens actie',
      current: known ? formatEuro(first.months[0].currentCents) : dash,
      cells: (i) => (
        <>
          {formatEuro(all[i].result.firstMonthNewCents)}
          <span className="block text-xs font-normal text-muted-foreground">{all[i].offer.promoMonths > 0 ? `${all[i].offer.promoMonths} maanden` : 'geen actieprijs'}</span>
        </>
      ),
    },
    { label: 'Per maand na actie', current: known ? formatEuro(first.months[period - 1].currentCents) : dash, cells: (i) => formatEuro(all[i].result.months[23].newCents) },
    { label: 'Eenmalige kosten', current: dash, cells: (i) => formatEuro(all[i].result.oneTime.totalCents) },
    { label: 'Totaal eerste jaar', current: known ? formatEuro(first.current12Cents) : dash, cells: (i) => formatEuro(all[i].result.new12Cents) },
    { label: 'Totaal 24 maanden', current: known ? formatEuro(first.current24Cents) : dash, cells: (i) => formatEuro(all[i].result.new24Cents), strong: true },
    {
      label: `Verschil over ${period} maanden`,
      current: dash,
      strong: true,
      cells: (i) => {
        const s = all[i].result.totalSavingsCents
        if (!known) return dash
        return <span className={s >= 0 ? 'text-good' : 'text-warn'}>{s >= 0 ? `${formatEuro(s)} besparing` : `${formatEuro(-s)} duurder`}</span>
      },
    },
    {
      label: 'Cadeau en extra’s',
      current: current.extras.length ? current.extras.map((e) => e.label).filter(Boolean).join(', ') || dash : dash,
      cells: (i) => {
        const o = all[i].offer
        const extras = o.extras.map((e) => e.label).filter(Boolean)
        return o.gift || extras.length ? (
          <span className="text-sm font-medium">
            {o.gift && (
              <span className="flex items-center gap-1.5">
                <Gift className="size-4 shrink-0 text-accent" /> {o.gift.name || 'Cadeau'}
              </span>
            )}
            {extras.join(', ')}
          </span>
        ) : (
          dash
        )
      },
    },
  ]

  return (
    <Page>
      <PageHeader
        title={`${curName} vs. ${active.offer.provider}`}
        subtitle="Alle bedragen inclusief btw. Totalen zijn inclusief eenmalige kosten."
        actions={
          <>
            <Segmented size="sm" className="w-auto" aria-label="Vergelijkingsperiode" value={period} onChange={setPeriod} options={[{ value: 12, label: '12 mnd' }, { value: 24, label: '24 mnd' }]} />
            <Button variant="primary" onClick={() => navigate('/presentatie')}>
              <Presentation /> Presenteren
            </Button>
          </>
        }
      />

      <Card className="overflow-x-auto">
        <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `minmax(150px,1fr) repeat(${all.length + 1}, minmax(150px,1.2fr))` }}>
          <div className="border-b p-4" />
          <div className="border-b p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Huidig</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">{curName}</div>
            {current.packageName && <div className="text-sm text-muted-foreground">{current.packageName}</div>}
          </div>
          {all.map((o, i) => (
            <button key={o.buildIndex} onClick={() => setActive(o.buildIndex)} aria-pressed={i === activeIndex} className={cn('border-b border-l p-4 text-left transition-colors', i === activeIndex ? 'bg-primary-soft/60' : 'hover:bg-muted/50')}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] text-white">{o.letter}</span>
                {o.offer.provider}
              </div>
              <div className="mt-1 text-lg font-semibold leading-tight tracking-tight">{o.offer.name}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {o.offer.isExample && <Badge tone="accent">Voorbeeld</Badge>}
                {o.badges.map((b) => (
                  <Badge key={b.id} tone={b.id === 'cheapest' ? 'good' : 'primary'}>
                    {b.label}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <div className="flex items-center border-b px-4 py-3 text-sm text-muted-foreground">{row.label}</div>
              <div className={cn('tnum flex items-center border-b px-4 py-3', row.strong ? 'text-lg font-semibold' : 'font-medium')}>{row.current}</div>
              {all.map((o, i) => (
                <div key={o.buildIndex} className={cn('tnum border-b border-l px-4 py-3', row.strong ? 'text-lg font-semibold' : 'font-medium', i === activeIndex && 'bg-primary-soft/30')}>
                  {row.cells(i)}
                </div>
              ))}
            </div>
          ))}
        </div>
        {all.some((o) => o.badges.length > 0) && (
          <div className="space-y-1 p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Info className="size-3.5" /> Waarop zijn de labels gebaseerd?
            </div>
            {all.flatMap((o) =>
              o.badges.map((b) => (
                <p key={o.buildIndex + b.id}>
                  <strong>
                    Optie {o.letter} – {b.label}:
                  </strong>{' '}
                  {b.criterion}
                </p>
              )),
            )}
            <p>Er is geen “beste” optie zonder context: welke het meest geschikt is hangt af van wat voor de klant het zwaarst weegt.</p>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <OptionTabs options={all} activeIndex={activeIndex} />
            <Segmented
              size="sm"
              className="w-full sm:w-auto"
              aria-label="Grafiek"
              value={chart}
              onChange={setChart}
              options={[
                { value: 'timeline', label: 'Per maand' },
                { value: 'years', label: 'Per jaar' },
                { value: 'cumulative', label: 'Opgeteld' },
                { value: 'total', label: 'Totaal' },
                { value: 'table', label: 'Tabel' },
              ]}
            />
          </div>
          <div key={chart + activeIndex} className="animate-fade-up">
            {chart === 'timeline' && <MonthlyTimeline result={active.result} currentName={curName} newName={active.offer.provider} height={300} />}
            {chart === 'years' && (known ? <YearBars result={active.result} currentName={curName} newName={active.offer.provider} height={300} /> : <Unknown />)}
            {chart === 'cumulative' && (known ? <CumulativeSavings result={active.result} height={300} /> : <Unknown />)}
            {chart === 'total' && (known ? <div className="py-8"><TotalBars result={active.result} currentName={curName} newName={`${active.offer.provider} ${active.offer.name}`} big /></div> : <Unknown />)}
            {chart === 'table' && <MonthTable result={active.result} currentName={curName} newName={active.offer.provider} />}
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">Adviessamenvatting – optie {active.letter}</h2>
            <p className="text-xs text-muted-foreground">Automatisch opgesteld op basis van de berekende bedragen.</p>
          </div>
          <InsightList insights={active.insights} />
          <ActionBar option={active} />
        </Card>
      </div>
    </Page>
  )
}

const Unknown = () => <p className="py-16 text-center text-sm text-muted-foreground">Vul het huidige maandbedrag in om deze vergelijking te tonen.</p>
