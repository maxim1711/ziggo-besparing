import { useEffect, useId, useState } from 'react'
import type { InternetProduct } from '@/engine/pricing'
import { extenderLabel, gaugeFill, speedTier } from '@/engine/product'
import { useCountUp } from '@/lib/countUp'
import { cn } from '@/lib/utils'
import { ExtenderGlyph, ModemGlyph } from './Hardware'

/* Meter: boog van 240°, middelpunt (100,100), straal 80. */
const R = 80
const START = 150
const SWEEP = 240
const point = (deg: number) => {
  const a = (deg * Math.PI) / 180
  return { x: 100 + R * Math.cos(a), y: 100 + R * Math.sin(a) }
}
const s = point(START)
const e = point(START + SWEEP)
const ARC = `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 1 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`

/**
 * Snelheid van het gekozen abonnement als meter + groot getal, met de inbegrepen wifi-versterkers.
 * De meter is een gekalibreerde, niet-lineaire weergave zonder getallen op de schaal;
 * het getal zelf is altijd de exacte abonnementssnelheid.
 */
export function SpeedShowcase({ internet, options }: { internet: InternetProduct; options: InternetProduct[] }) {
  const mbps = internet.downloadMbps
  const tier = speedTier(mbps)
  const target = gaugeFill(mbps)
  const shown = useCountUp(mbps, { duration: 700, memoryKey: 'snelheid' })
  // Eerste weergave: de boog loopt vanaf leeg; daarna via CSS-transitie van de vorige stand.
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFill(target))
    return () => cancelAnimationFrame(raf)
  }, [target])
  const gid = useId().replace(/:/g, '')
  const top = tier === 'top'
  const strong = tier === 'premium' || top
  const extenders = internet.includedExtenders
  const marks = [...new Set(options.map((o) => o.downloadMbps))].sort((a, b) => a - b)

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted/55 px-4 py-3 min-[520px]:flex-row min-[520px]:gap-6 sm:px-5">
      <div className="relative w-[200px] shrink-0 min-[520px]:w-[184px]">
        <svg viewBox="0 0 200 158" className="block w-full" role="img" aria-label={`Abonnementssnelheid ${mbps} Mbit/s download`}>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={top ? 0.85 : 0.75} />
              <stop offset="70%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor={top ? 'hsl(var(--accent))' : 'hsl(var(--primary))'} />
            </linearGradient>
          </defs>
          <path d={ARC} fill="none" stroke="hsl(var(--border))" strokeWidth="12" strokeLinecap="round" />
          {strong && <path d={ARC} pathLength={100} fill="none" stroke="hsl(var(--primary))" strokeOpacity={top ? 0.14 : 0.08} strokeWidth="24" strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - fill * 100} className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]" />}
          <path d={ARC} pathLength={100} fill="none" stroke={`url(#g${gid})`} strokeWidth="12" strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - fill * 100} className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]" />
          {/* Stippen = de beschikbare snelheden; geen getallen op de schaal. */}
          {marks.map((m) => {
            const p = point(START + SWEEP * gaugeFill(m))
            const reached = m <= mbps
            return <circle key={m} cx={p.x} cy={p.y} r={m === mbps ? 3.2 : 2.2} fill={reached ? '#fff' : 'hsl(var(--muted-foreground))'} fillOpacity={reached ? 0.95 : 0.35} className="transition-all duration-500" />
          })}
        </svg>
        <div className="absolute inset-x-0 top-[34%] text-center">
          <div className={cn('tnum font-semibold leading-none tracking-tight transition-[font-size] duration-300', top ? 'text-[50px]' : strong ? 'text-[46px]' : 'text-[42px]')} aria-hidden>
            {shown}
          </div>
          <div className="mt-1 text-[13px] font-medium text-muted-foreground">Mbit/s</div>
        </div>
      </div>

      <div className="w-full min-w-0 flex-1">
        <div className={cn('text-xs font-semibold uppercase tracking-[.14em]', top ? 'text-accent' : 'text-primary')}>{internet.name}</div>
        <div className="mt-0.5 text-[15px] font-medium leading-snug">
          {mbps} Mbit/s download{internet.uploadMbps ? <span className="text-muted-foreground"> · {internet.uploadMbps} Mbit/s upload</span> : null}
        </div>
        <div className="mt-3 flex items-center gap-1">
          <ModemGlyph className="size-9 text-foreground" />
          {Array.from({ length: extenders }, (_, i) => (
            <span key={i} className="animate-in fade-in zoom-in-75 fill-mode-both duration-300" style={{ animationDelay: `${120 + i * 110}ms` }}>
              <ExtenderGlyph className="size-9 text-foreground" />
            </span>
          ))}
        </div>
        <div className="mt-1 text-sm font-semibold">{extenders > 0 ? extenderLabel(extenders) : 'Wifi via de modem'}</div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Snelheid van het abonnement, geen gemeten snelheid.</p>
      </div>
    </div>
  )
}
