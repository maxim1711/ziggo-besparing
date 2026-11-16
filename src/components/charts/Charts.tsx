import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useId } from 'react'
import { formatEuro } from '@/engine/money'
import type { ComparisonResult } from '@/engine/types'
import { cn, usePrefersReducedMotion } from '@/lib/utils'

export const CHART = { current: '#64748b', next: '#6d28d9', good: '#0f8a5f', warn: '#c2410c', grid: '#ece9f3', ink: '#6b6480' }

const eur0 = (c: number) => formatEuro(c, { decimals: 'auto' })
const axis = { fontSize: 12, fill: CHART.ink }

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-xl border bg-white/95 px-3 py-2 text-xs shadow-card backdrop-blur">
      <div className="mb-1 font-semibold text-foreground">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5 text-muted-foreground">
          {r.color && <span className="h-0.5 w-3 rounded" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <span className="tnum font-semibold text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items, className }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground', className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

interface ChartProps {
  result: ComparisonResult
  currentName: string
  newName: string
  height?: number
  big?: boolean
}

/** Maandbedrag per maand: huidig vs. nieuw (trapsgewijs, want prijzen springen). */
export function MonthlyTimeline({ result, currentName, newName, height = 220, big }: ChartProps) {
  const reduced = usePrefersReducedMotion()
  const n = result.period
  const rows = result.months.slice(0, n).map((m) => ({ month: m.month, current: result.currentKnown ? m.currentCents : null, next: m.newCents }))
  // Extra eindpunt zodat ook de laatste maand als trede zichtbaar is.
  const data = [...rows, { ...rows[n - 1], month: n + 1 }]
  const ticks = n === 12 ? [1, 3, 6, 9, 12] : [1, 6, 12, 18, 24]
  const fs = big ? 14 : 12
  return (
    <div>
      <Legend className="mb-2" items={[...(result.currentKnown ? [{ label: currentName, color: CHART.current }] : []), { label: newName, color: CHART.next }]} />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="month" type="number" domain={[1, n + 1]} ticks={ticks} tickFormatter={(m) => `mnd ${m}`} tick={{ ...axis, fontSize: fs }} tickLine={false} axisLine={{ stroke: CHART.grid }} />
          <YAxis tickFormatter={eur0} tick={{ ...axis, fontSize: fs }} tickLine={false} axisLine={false} width={big ? 64 : 56} domain={[0, (max: number) => Math.ceil((max * 1.15) / 1000) * 1000]} />
          <Tooltip
            cursor={{ stroke: CHART.ink, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as (typeof data)[number]
              const m = Math.min(p.month, n)
              const row = result.months[m - 1]
              return (
                <TooltipBox
                  title={`Maand ${m}${row.contractual ? '' : ' (schatting)'}`}
                  rows={[
                    ...(result.currentKnown ? [{ label: currentName, value: formatEuro(row.currentCents), color: CHART.current }] : []),
                    { label: newName, value: formatEuro(row.newCents), color: CHART.next },
                  ]}
                />
              )
            }}
          />
          {result.priceIncreaseMonth && (
            <ReferenceLine x={result.priceIncreaseMonth} stroke={CHART.warn} strokeDasharray="4 4" label={{ value: 'Einde actieprijs', position: 'top', fontSize: fs - 1, fill: CHART.warn }} />
          )}
          {result.currentKnown && <Line type="stepAfter" dataKey="current" stroke={CHART.current} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={!reduced} animationDuration={600} />}
          <Line type="stepAfter" dataKey="next" stroke={CHART.next} strokeWidth={3} dot={false} activeDot={false} isAnimationActive={!reduced} animationDuration={600} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Opgetelde besparing (of meerkosten) per maand, inclusief eenmalige kosten. */
export function CumulativeSavings({ result, height = 220, big }: Pick<ChartProps, 'result' | 'height' | 'big'>) {
  const reduced = usePrefersReducedMotion()
  const id = useId().replace(/:/g, '')
  const n = result.period
  const data = [{ month: 0, value: -result.oneTime.totalCents }, ...result.months.slice(0, n).map((m) => ({ month: m.month, value: m.cumulativeSavingsCents }))]
  const max = Math.max(...data.map((d) => d.value), 0)
  const min = Math.min(...data.map((d) => d.value), 0)
  const zero = max === min ? 0.5 : max / (max - min)
  const ticks = n === 12 ? [0, 3, 6, 9, 12] : [0, 6, 12, 18, 24]
  const fs = big ? 14 : 12
  return (
    <div>
      <Legend className="mb-2" items={[...(max > 0 ? [{ label: 'Opgebouwde besparing', color: CHART.good }] : []), ...(min < 0 ? [{ label: 'Meerkosten', color: CHART.warn }] : [])]} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={CHART.good} stopOpacity={0.28} />
              <stop offset={zero} stopColor={CHART.good} stopOpacity={0.04} />
              <stop offset={zero} stopColor={CHART.warn} stopOpacity={0.04} />
              <stop offset={1} stopColor={CHART.warn} stopOpacity={0.28} />
            </linearGradient>
            <linearGradient id={`line${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={zero} stopColor={CHART.good} />
              <stop offset={zero} stopColor={CHART.warn} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="month" type="number" domain={[0, n]} ticks={ticks} tickFormatter={(m) => (m === 0 ? 'start' : `mnd ${m}`)} tick={{ ...axis, fontSize: fs }} tickLine={false} axisLine={{ stroke: CHART.grid }} />
          <YAxis tickFormatter={eur0} tick={{ ...axis, fontSize: fs }} tickLine={false} axisLine={false} width={big ? 70 : 60} />
          <ReferenceLine y={0} stroke={CHART.ink} strokeOpacity={0.5} />
          <Tooltip
            cursor={{ stroke: CHART.ink, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as (typeof data)[number]
              return <TooltipBox title={p.month === 0 ? 'Bij de start' : `Na ${p.month} ${p.month === 1 ? 'maand' : 'maanden'}`} rows={[{ label: p.value >= 0 ? 'Bespaard' : 'Meerkosten', value: formatEuro(Math.abs(p.value)) }]} />
            }}
          />
          <Area type="monotone" dataKey="value" stroke={`url(#line${id})`} strokeWidth={3} fill={`url(#fill${id})`} isAnimationActive={!reduced} animationDuration={700} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Kosten jaar 1 vs. jaar 2, huidig naast nieuw. Eenmalige kosten zitten in jaar 1. */
export function YearBars({ result, currentName, newName, height = 220, big }: ChartProps) {
  const reduced = usePrefersReducedMotion()
  const data = [
    { name: result.period === 12 ? '12 maanden' : 'Jaar 1', current: result.current12Cents, next: result.new12Cents },
    ...(result.period === 24 ? [{ name: 'Jaar 2', current: result.current24Cents - result.current12Cents, next: result.new24Cents - result.new12Cents }] : []),
  ]
  const fs = big ? 14 : 12
  return (
    <div>
      <Legend className="mb-2" items={[{ label: currentName, color: CHART.current }, { label: newName, color: CHART.next }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ ...axis, fontSize: fs + 1 }} tickLine={false} axisLine={{ stroke: CHART.grid }} />
          <YAxis tickFormatter={eur0} tick={{ ...axis, fontSize: fs }} tickLine={false} axisLine={false} width={big ? 70 : 60} />
          <Tooltip
            cursor={{ fill: 'rgba(109,40,217,.05)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as (typeof data)[number]
              const diff = p.current - p.next
              return (
                <TooltipBox
                  title={String(label)}
                  rows={[
                    { label: currentName, value: formatEuro(p.current), color: CHART.current },
                    { label: newName, value: formatEuro(p.next), color: CHART.next },
                    { label: diff >= 0 ? 'Besparing' : 'Meerkosten', value: formatEuro(Math.abs(diff)) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="current" fill={CHART.current} radius={[4, 4, 0, 0]} maxBarSize={72} isAnimationActive={!reduced} animationDuration={600}>
            <LabelList dataKey="current" position="top" formatter={eur0} fontSize={fs} fill="#2a2140" fontWeight={600} />
          </Bar>
          <Bar dataKey="next" fill={CHART.next} radius={[4, 4, 0, 0]} maxBarSize={72} isAnimationActive={!reduced} animationDuration={600}>
            <LabelList dataKey="next" position="top" formatter={eur0} fontSize={fs} fill="#2a2140" fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Totale kosten over de hele periode: twee balken, direct gelabeld. */
export function TotalBars({ result, currentName, newName, big }: Omit<ChartProps, 'height'>) {
  const max = Math.max(result.currentPeriodCents, result.newPeriodCents, 1)
  const rows = [
    { label: currentName, cents: result.currentPeriodCents, color: CHART.current },
    { label: newName, cents: result.newPeriodCents, color: CHART.next },
  ]
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className={cn('mb-1.5 flex items-baseline justify-between gap-3', big ? 'text-lg' : 'text-sm')}>
            <span className="truncate font-medium text-muted-foreground">{r.label}</span>
            <span className={cn('tnum font-semibold', big && 'text-2xl')}>{formatEuro(r.cents)}</span>
          </div>
          <div className={cn('overflow-hidden rounded-md bg-muted', big ? 'h-7' : 'h-4')}>
            <div className="h-full rounded-r-md transition-[width] duration-700 ease-out" style={{ width: `${Math.max(2, (r.cents / max) * 100)}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Tabelweergave van de maandbedragen (toegankelijk alternatief voor de grafieken). */
export function MonthTable({ result, currentName, newName }: Omit<ChartProps, 'height'>) {
  return (
    <div className="max-h-[320px] overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Maand</th>
            <th className="px-3 py-2 text-right font-medium">{currentName}</th>
            <th className="px-3 py-2 text-right font-medium">{newName}</th>
            <th className="px-3 py-2 text-right font-medium">Verschil</th>
            <th className="px-3 py-2 text-right font-medium">Opgeteld</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {result.months.slice(0, result.period).map((m) => (
            <tr key={m.month} className="border-t">
              <td className="px-3 py-1.5">
                {m.month}
                {!m.contractual && <span className="ml-1 text-xs text-muted-foreground">(schatting)</span>}
              </td>
              <td className="px-3 py-1.5 text-right">{result.currentKnown ? formatEuro(m.currentCents) : '—'}</td>
              <td className="px-3 py-1.5 text-right">{formatEuro(m.newCents)}</td>
              <td className={cn('px-3 py-1.5 text-right', result.currentKnown && (m.diffCents >= 0 ? 'text-good' : 'text-warn'))}>{result.currentKnown ? formatEuro(m.diffCents) : '—'}</td>
              <td className="px-3 py-1.5 text-right">{result.currentKnown ? formatEuro(m.cumulativeSavingsCents) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
