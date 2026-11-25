import { Check, CircleDot, Clapperboard, History, PlayCircle, Smartphone, Trophy, Tv, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import type { TvPackage } from '@/engine/pricing'
import { tvCards, type TvFeatureIcon } from '@/engine/product'
import { cn } from '@/lib/utils'

const ICON: Record<TvFeatureIcon, LucideIcon> = { zenders: Tv, opnemen: CircleDot, terugkijken: History, app: Smartphone, sport: Trophy, film: Clapperboard, streaming: PlayCircle, overig: Check }
const VISIBLE = 3

/**
 * Tv-pakketten als productkaarten. Inhoud komt uit de prijsconfiguratie (kenmerken per pakket);
 * er wordt niets bij verzonnen. Selectie werkt exact als voorheen via `onSelect`.
 */
export function TvCards({ tvs, all, selectedId, priceLabel, onSelect }: { tvs: TvPackage[]; all: TvPackage[]; selectedId: string | null; priceLabel: (tv: TvPackage) => React.ReactNode; onSelect: (id: string) => void }) {
  const cards = useMemo(() => tvCards(all), [all])
  return (
    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
      {tvs.map((t) => {
        const c = cards.find((x) => x.id === t.id)
        const on = selectedId === t.id
        const highlights = c?.highlights ?? []
        const rest = highlights.length - VISIBLE
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(t.id)}
            className={cn(
              'relative flex min-h-[64px] flex-col overflow-hidden rounded-2xl border-2 bg-card p-4 text-left transition-all duration-200 active:scale-[.98]',
              on ? 'border-primary shadow-card' : 'border-border hover:border-primary/40',
            )}
          >
            {c?.mostComplete && <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary to-accent" />}
            <span className={cn('absolute right-3 top-3 grid size-6 place-items-center rounded-full border-2 transition-colors', on ? 'border-primary bg-primary text-white' : 'border-border bg-card')}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
            {c?.mostComplete && <span className="mb-0.5 pr-8 text-[11px] font-semibold uppercase tracking-[.14em] text-accent">Meest compleet</span>}
            <span className="pr-8 text-[18px] font-semibold leading-tight tracking-tight">{t.name}</span>
            {c?.channels && (
              <span className="mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-primary">
                <Tv className="size-4" strokeWidth={2.2} /> {c.channels}
              </span>
            )}
            {c?.basedOn && <span className="mt-2 text-xs font-medium text-muted-foreground">Alles van {c.basedOn}, plus:</span>}
            {highlights.length > 0 && (
              <ul className={cn('space-y-1.5', c?.basedOn ? 'mt-1.5' : 'mt-2.5')}>
                {highlights.slice(0, VISIBLE).map((h) => {
                  const Icon = ICON[h.icon]
                  const rec = h.icon === 'opnemen'
                  return (
                    <li key={h.label} className={cn('flex gap-2 text-[13px] leading-snug', rec ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      <Icon className={cn('mt-px size-4 shrink-0', rec ? 'text-accent' : 'text-primary/70')} strokeWidth={rec ? 2.6 : 2} aria-hidden />
                      {h.label}
                    </li>
                  )
                })}
                {rest > 0 && <li className="pl-6 text-xs text-muted-foreground">en nog {rest} meer</li>}
              </ul>
            )}
            <span className="tnum mt-auto pt-3 text-sm text-muted-foreground">{priceLabel(t)}</span>
          </button>
        )
      })}
    </div>
  )
}
