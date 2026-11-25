import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { hardwareLabel } from '@/engine/product'
import { cn, usePrefersReducedMotion } from '@/lib/utils'
import { ExtenderGlyph, ModemGlyph } from './Hardware'

/**
 * Doorsnede van een woning met modem en wifi-versterkers, als voorbeeld van een opstelling.
 * Aantal apparaten komt uit de productconfiguratie (via de aanbieding). Alle animatie is CSS:
 * sluiten = ontkoppelen = klaar; er blijven geen timers of frames achter.
 */

type Floor = 'grond' | 'eerste' | 'zolder'
type Spot = { x: number; y: number; room: string; floor: Floor }
const MODEM: Spot = { x: 272, y: 352, room: 'woonkamer', floor: 'grond' }
/** Volgorde: eerste verdieping, zolder, binnen bij de tuindeur (nooit buiten). */
const SPOTS: Spot[] = [
  { x: 306, y: 236, room: 'eerste verdieping', floor: 'eerste' },
  { x: 262, y: 121, room: 'zolder', floor: 'zolder' },
  { x: 404, y: 352, room: 'begane grond, bij de tuindeur', floor: 'grond' },
]
const MAX_DRAWN = SPOTS.length

const T = {
  modem: 0.45,
  extender: (i: number) => 1.05 + i * 0.45,
}

const line = 'hsl(var(--foreground))'

function Device({ spot, kind, delay, animate }: { spot: Spot; kind: 'modem' | 'extender'; delay: number; animate: boolean }) {
  const w = kind === 'modem' ? 18 : 14
  const h = kind === 'modem' ? 26 : 18
  const cy = spot.y - h / 2
  return (
    // Golven blijven binnen de eigen verdieping: geen suggestie van bereik door vloeren heen.
    <g clipPath={`url(#wh-${spot.floor})`}>
      {/* Rustige eindtoestand: een zachte gloed rond het apparaat. */}
      <circle cx={spot.x} cy={cy} r={kind === 'modem' ? 34 : 28} fill="hsl(var(--accent))" fillOpacity=".09" className={cn(animate && 'wh-fade')} style={animate ? { animationDelay: `${delay + 2.2}s` } : undefined} />
      {animate &&
        [0, 0.8, 1.6].map((d) => (
          <circle key={d} cx={spot.x} cy={cy} r={54} fill="none" stroke="hsl(var(--accent))" strokeWidth="1.6" vectorEffect="non-scaling-stroke" className="wh-wave" style={{ animationDelay: `${delay + 0.3 + d}s` }} />
        ))}
      <g className={cn(animate && 'wh-pop')} style={animate ? { animationDelay: `${delay}s` } : undefined}>
        <rect x={spot.x - w / 2} y={spot.y - h} width={w} height={h} rx={kind === 'modem' ? 5 : 7} fill="hsl(var(--card))" stroke={line} strokeOpacity=".55" strokeWidth="1.6" />
        <circle cx={spot.x} cy={spot.y - (kind === 'modem' ? 7 : 5)} r="2.2" fill="hsl(var(--accent))" />
      </g>
    </g>
  )
}

function House({ extenders, animate }: { extenders: number; animate: boolean }) {
  const spots = SPOTS.slice(0, Math.min(extenders, MAX_DRAWN))
  const reveal = animate ? 'wh-reveal' : undefined
  const soft = { stroke: line, strokeOpacity: 0.28, strokeWidth: 1.5, fill: 'none' } as const
  const furniture = { fill: 'hsl(var(--muted))', stroke: line, strokeOpacity: 0.22, strokeWidth: 1.2 } as const
  return (
    <svg viewBox="0 0 680 410" className="block h-auto w-full" role="img" aria-label={`Voorbeeld van een woning met ${hardwareLabel(extenders).toLowerCase()}`}>
      <defs>
        <clipPath id="wh-zolder">
          <polygon points="60,147 250,40 440,147" />
        </clipPath>
        <clipPath id="wh-eerste">
          <rect x="72" y="153" width="356" height="105" />
        </clipPath>
        <clipPath id="wh-grond">
          <rect x="72" y="264" width="356" height="108" />
          <rect x="430" y="236" width="230" height="136" />
        </clipPath>
      </defs>

      <g className={reveal}>
        {/* Tuin */}
        <rect x="20" y="372" width="640" height="16" rx="3" fill="hsl(var(--muted))" />
        <line x1="20" y1="372" x2="660" y2="372" stroke={line} strokeOpacity=".3" strokeWidth="1.5" />
        <g opacity=".9">
          <rect x="586" y="302" width="8" height="70" rx="2" {...furniture} />
          <circle cx="590" cy="282" r="38" {...furniture} />
          {[470, 500, 530, 640].map((x) => (
            <line key={x} x1={x} y1="348" x2={x} y2="372" {...soft} />
          ))}
          <line x1="462" y1="356" x2="648" y2="356" {...soft} />
        </g>

        {/* Woning: muren, vloeren, dak */}
        <polygon points="70,150 250,46 430,150 430,372 70,372" fill="hsl(var(--card))" />
        <path d="M50 152 L250 36 L450 152" fill="none" stroke={line} strokeOpacity=".7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M70 150 V372 M430 150 V290" fill="none" stroke={line} strokeOpacity=".6" strokeWidth="2.5" />
        {/* Glazen tuindeur */}
        <path d="M430 290 V372" stroke={line} strokeOpacity=".25" strokeWidth="2.5" />
        <path d="M424 292 V372" stroke="hsl(var(--primary))" strokeOpacity=".18" strokeWidth="4" />
        <rect x="70" y="147" width="360" height="6" fill={line} fillOpacity=".12" />
        <rect x="70" y="258" width="360" height="6" fill={line} fillOpacity=".12" />

        {/* Zolder: bureau en dakraam */}
        <rect x="200" y="119" width="84" height="5" rx="2" {...furniture} />
        <path d="M206 124 V147 M278 124 V147" {...soft} />
        <path d="M150 104 L176 89 L182 99 L156 114 Z" fill="hsl(var(--primary))" fillOpacity=".06" stroke={line} strokeOpacity=".25" strokeWidth="1.2" />
        {/* Eerste verdieping: bed, nachtkastje, raam */}
        <rect x="104" y="232" width="118" height="26" rx="6" {...furniture} />
        <rect x="104" y="214" width="10" height="44" rx="3" {...furniture} />
        <rect x="128" y="226" width="34" height="10" rx="5" fill="hsl(var(--card))" stroke={line} strokeOpacity=".2" />
        <rect x="290" y="236" width="32" height="22" rx="3" {...furniture} />
        <rect x="356" y="182" width="46" height="40" rx="3" fill="hsl(var(--primary))" fillOpacity=".05" stroke={line} strokeOpacity=".25" strokeWidth="1.2" />
        {/* Begane grond: bank, tv-meubel, dressoir bij de tuindeur */}
        <rect x="94" y="340" width="92" height="32" rx="8" {...furniture} />
        <rect x="94" y="326" width="92" height="18" rx="7" {...furniture} />
        <rect x="204" y="352" width="84" height="20" rx="3" {...furniture} />
        <rect x="210" y="314" width="50" height="34" rx="3" fill={line} fillOpacity=".07" stroke={line} strokeOpacity=".25" strokeWidth="1.2" />
        <rect x="384" y="352" width="40" height="20" rx="3" {...furniture} />

        {/* Verdiepingen */}
        <g fontSize="11" fontWeight="600" letterSpacing=".08em" fill="hsl(var(--muted-foreground))">
          <text x="84" y="286">BEGANE GROND</text>
          <text x="84" y="176">EERSTE VERDIEPING</text>
          <text x="150" y="140">ZOLDER</text>
          <text x="470" y="402">TUIN</text>
        </g>
      </g>

      {/* Verbindingen tussen modem en versterkers */}
      {spots.map((s, i) => {
        const a = { x: MODEM.x, y: MODEM.y - 13 }
        const b = { x: s.x, y: s.y - 9 }
        const c = { x: (a.x + b.x) / 2 + (b.y < a.y ? 34 : 0), y: Math.min(a.y, b.y) + (b.y < a.y ? 30 : -24) }
        return <path key={s.room} d={`M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`} fill="none" stroke="hsl(var(--accent))" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="3 5" strokeLinecap="round" className={cn(animate && 'wh-flow')} style={animate ? { animationDelay: `${T.extender(i) + 0.25}s, ${T.extender(i) + 0.25}s` } : undefined} />
      })}

      <g>
        <Device spot={MODEM} kind="modem" delay={T.modem} animate={animate} />
        {spots.map((s, i) => (
          <Device key={s.room} spot={s} kind="extender" delay={T.extender(i)} animate={animate} />
        ))}
      </g>
    </svg>
  )
}

export default function WifiHouse({ extenders }: { extenders: number }) {
  const reduced = usePrefersReducedMotion()
  const [run, setRun] = useState(0)
  return (
    <div>
      <div key={run} className={cn('mx-auto max-w-[680px]', !reduced && 'wh-anim')}>
        <House extenders={extenders} animate={!reduced} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <ModemGlyph className="size-8 text-foreground" /> Modem
          </span>
          {extenders > 0 && (
            <span className="flex items-center gap-1">
              <ExtenderGlyph className="size-8 text-foreground" /> Wifi-versterker
            </span>
          )}
        </div>
        {!reduced && (
          <button type="button" onClick={() => setRun((r) => r + 1)} className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            <RotateCcw className="size-4" /> Opnieuw afspelen
          </button>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Voorbeeld ter illustratie. Hoe ver de wifi reikt en waar de apparatuur het best staat, hangt af van uw woning.</p>
    </div>
  )
}
