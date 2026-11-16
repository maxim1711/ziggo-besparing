import { BarChart3, Lock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART } from '@/components/charts/Charts'
import { Page, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, Segmented } from '@/components/ui/inputs'
import { estimateCommission } from '@/engine/commission'
import { addDays, formatDateNl, startOfWeek, todayIso } from '@/engine/dates'
import { emptyCombo } from '@/engine/defaults'
import { formatEuro } from '@/engine/money'
import type { ProductKind } from '@/engine/types'
import { cn, kindLabel, usePrefersReducedMotion } from '@/lib/utils'
import { useData, type OutcomeResult } from '@/store/data'
import { toast } from '@/store/toast'

const RESULT_LABEL: Record<OutcomeResult, string> = { verkocht: 'Verkocht', opvolgen: 'Opvolgen', geen_interesse: 'Geen interesse' }
const DAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="tnum mt-1 text-4xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  )
}

export default function ResultsPage() {
  const { outcomes, followUps, settings, addOutcome, deleteOutcome } = useData()
  const reduced = usePrefersReducedMotion()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ date: todayIso(), result: 'verkocht' as OutcomeResult, kind: 'internet_tv' as ProductKind, offerName: '', commissionCents: 0 })
  const today = todayIso()
  const monday = startOfWeek(today)
  const sunday = addDays(monday, 6)

  const week = outcomes.filter((o) => o.date >= monday && o.date <= sunday)
  const weekSales = week.filter((o) => o.result === 'verkocht')
  const todaySales = outcomes.filter((o) => o.date === today && o.result === 'verkocht').length
  const weekCommission = weekSales.reduce((a, o) => a + o.commissionCents, 0)
  const weekEnergy = weekSales.filter((o) => o.module === 'energie')
  const weekEnergyCommission = weekEnergy.reduce((a, o) => a + o.commissionCents, 0)
  const avgCommission = weekSales.length ? Math.round(weekCommission / weekSales.length) : 0
  const sales = outcomes.filter((o) => o.result === 'verkocht').length
  const conversion = outcomes.length ? Math.round((sales / outcomes.length) * 100) : null
  const openFollowUps = followUps.filter((f) => f.status === 'open' || f.status === 'gepland').length
  const target = settings.weeklyTargetCents
  const progress = target > 0 ? Math.min(100, Math.round((weekCommission / target) * 100)) : 0
  const perDay = DAYS.map((d, i) => {
    const date = addDays(monday, i)
    return { day: d, date, sales: weekSales.filter((o) => o.date === date).length }
  })
  const defaultCommission = (kind: ProductKind) => estimateCommission({ kind, contractMonths: 12 }, emptyCombo(), settings.commission).totalCents

  return (
    <Page>
      <PageHeader
        title="Mijn resultaten"
        subtitle="Uw eigen overzicht. Dit scherm is alleen voor u en staat los van klantberekeningen."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setForm({ date: today, result: 'verkocht', kind: 'internet_tv', offerName: '', commissionCents: defaultCommission('internet_tv') })
              setOpen(true)
            }}
          >
            <Plus /> Uitkomst registreren
          </Button>
        }
      />
      <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Lock className="size-3.5" /> Alleen voor adviseur – niet tonen aan klanten. Provisiebedragen zijn schattingen op basis van uw instellingen.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Verkopen vandaag" value={String(todaySales)} sub={formatDateNl(today)} />
        <Tile label="Verkopen deze week" value={String(weekSales.length)} sub={`${formatDateNl(monday)} – ${formatDateNl(sunday)}`} />
        <Tile label="Open opvolgingen" value={String(openFollowUps)} sub="status open of gepland" />
        <Tile label="Conversie" value={conversion === null ? '—' : `${conversion}%`} sub={conversion === null ? 'nog geen uitkomsten geregistreerd' : `${sales} van ${outcomes.length} geregistreerde adviezen`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-5">
          <div className="text-sm font-medium text-muted-foreground">Geschatte provisie deze week</div>
          <div className="tnum mt-1 text-5xl font-semibold tracking-tight">{formatEuro(weekCommission)}</div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Voortgang weekdoel">
            <div className={cn('h-full rounded-full transition-[width] duration-700', progress >= 100 ? 'bg-good' : 'bg-primary')} style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-sm text-muted-foreground">
            <span>{target > 0 ? `${progress}% van weekdoel` : 'Geen weekdoel ingesteld'}</span>
            <span className="tnum">{target > 0 && (weekCommission >= target ? 'Doel gehaald' : `nog ${formatEuro(target - weekCommission)} tot ${formatEuro(target)}`)}</span>
          </div>
          <div className="mt-4 space-y-1.5 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ziggo ({weekSales.length - weekEnergy.length} verkopen)</span>
              <span className="tnum font-semibold">{formatEuro(weekCommission - weekEnergyCommission)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Essent ({weekEnergy.length} verkopen)</span>
              <span className="tnum font-semibold">{formatEuro(weekEnergyCommission)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gemiddelde provisie per verkoop</span>
              <span className="tnum font-semibold">{weekSales.length ? formatEuro(avgCommission) : '—'}</span>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Verkopen per dag, deze week</h2>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={perDay} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: CHART.ink }} tickLine={false} axisLine={{ stroke: CHART.grid }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: CHART.ink }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(109,40,217,.05)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as (typeof perDay)[number]
                  return (
                    <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-card">
                      <div className="font-semibold">{formatDateNl(p.date)}</div>
                      <div className="text-muted-foreground">
                        {p.sales} {p.sales === 1 ? 'verkoop' : 'verkopen'}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="sales" fill={CHART.next} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Geregistreerde uitkomsten" description="Registreren is optioneel en bevat geen klantgegevens." />
        {outcomes.length === 0 ? (
          <EmptyState icon={<BarChart3 />} title="Nog geen uitkomsten" text="Registreer na een advies of het een verkoop, opvolging of geen interesse was. Zo ziet u uw weektotaal en conversie." />
        ) : (
          <ul className="divide-y p-2">
            {outcomes.slice(0, 50).map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-3 py-2">
                <Badge tone={o.result === 'verkocht' ? 'good' : o.result === 'opvolgen' ? 'primary' : 'neutral'}>{RESULT_LABEL[o.result]}</Badge>
                {o.module === 'energie' && <Badge tone="accent">Essent</Badge>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{o.offerName || (o.kind ? kindLabel(o.kind) : 'Advies')}</div>
                  <div className="text-xs text-muted-foreground">{formatDateNl(o.date)}</div>
                </div>
                {o.result === 'verkocht' && <span className="tnum text-sm font-semibold">{formatEuro(o.commissionCents)}</span>}
                <Button size="icon" variant="ghost" aria-label="Verwijderen" onClick={() => deleteOutcome(o.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Uitkomst registreren"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                addOutcome({ ...form, commissionCents: form.result === 'verkocht' ? form.commissionCents : 0 })
                setOpen(false)
                toast('Uitkomst geregistreerd')
              }}
            >
              Registreren
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented value={form.result} onChange={(result) => setForm({ ...form, result })} options={[{ value: 'verkocht', label: 'Verkocht' }, { value: 'opvolgen', label: 'Opvolgen' }, { value: 'geen_interesse', label: 'Geen interesse' }]} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Datum">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value || today })} />
            </Field>
            <Field label="Aanbieding (optioneel)">
              <Input value={form.offerName} onChange={(e) => setForm({ ...form, offerName: e.target.value })} />
            </Field>
          </div>
          {form.result === 'verkocht' && (
            <>
              <Field label="Product">
                <Segmented value={form.kind} onChange={(kind) => setForm({ ...form, kind, commissionCents: defaultCommission(kind) })} options={[{ value: 'internet', label: 'Alleen internet' }, { value: 'internet_tv', label: 'Internet + TV' }]} />
              </Field>
              <Field label="Provisie" hint="Vooringevuld vanuit uw provisie-instellingen">
                <MoneyInput value={form.commissionCents} onChange={(c) => setForm({ ...form, commissionCents: c ?? 0 })} emptyAsZero />
              </Field>
            </>
          )}
        </div>
      </Dialog>
    </Page>
  )
}
