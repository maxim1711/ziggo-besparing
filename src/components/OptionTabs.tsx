import { cn } from '@/lib/utils'
import { useDraft, type OptionComparison } from '@/store/draft'

/** Schakelen tussen optie A, B en C. */
export function OptionTabs({ options, activeIndex, big }: { options: OptionComparison[]; activeIndex: number; big?: boolean }) {
  const setActive = useDraft((s) => s.setActive)
  if (options.length < 2) return null
  return (
    <div role="tablist" aria-label="Opties" className="flex gap-1.5">
      {options.map((o, i) => (
        <button
          key={o.buildIndex}
          role="tab"
          aria-selected={i === activeIndex}
          onClick={() => setActive(o.buildIndex)}
          className={cn('flex min-w-0 items-center gap-2 rounded-xl border px-3 font-semibold transition-all', big ? 'h-12 text-base' : 'h-11 text-sm', i === activeIndex ? 'border-primary bg-primary text-white shadow-lift' : 'bg-card text-muted-foreground hover:text-foreground')}
        >
          <span>Optie {o.letter}</span>
        </button>
      ))}
    </div>
  )
}
