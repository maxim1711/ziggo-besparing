import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ComparisonRow } from '@/engine/product'
import { cn } from '@/lib/utils'

/**
 * Compacte vergelijking huidig ↔ nieuw. Toont alleen rijen die de motor heeft opgeleverd
 * (beide kanten bekend). Geen rijen = niets tonen.
 */
export function ProductComparison({ rows, currentName, nextName, size = 'md' }: { rows: ComparisonRow[]; currentName: string; nextName: string; size?: 'sm' | 'md' }) {
  if (rows.length === 0) return null
  if (size === 'sm') {
    // Smalle kolom van de adviseur: kenmerk boven, "nu → nieuw" eronder.
    return (
      <div className="rounded-2xl border px-4 py-2">
        <div className="pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
          {currentName} → {nextName}
        </div>
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="border-t border-border/70 py-2">
              <div className="text-xs text-muted-foreground">{r.label}</div>
              <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                <span className="text-muted-foreground">{r.current}</span>
                <span aria-hidden className="text-muted-foreground">→</span>
                <span className={cn(r.verdict === 'beter' && 'font-semibold')}>{r.next}</span>
                {r.verdict === 'beter' && <ArrowUp className="size-3.5 text-good" strokeWidth={2.6} aria-hidden />}
                {r.verdict === 'minder' && <ArrowDown className="size-3.5 text-warn" strokeWidth={2.6} aria-hidden />}
                {(r.verdict === 'beter' || r.verdict === 'minder') && <span className="sr-only">({r.verdict})</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className={'rounded-3xl border bg-card px-5 py-4'}>
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">
          Vergelijking {currentName} en {nextName}
        </caption>
        <thead>
          <tr className={cn('text-left font-semibold uppercase tracking-[.12em] text-muted-foreground', 'text-xs')}>
            <th className="w-[34%] pb-1.5 font-semibold">
              <span className="sr-only">Kenmerk</span>
            </th>
            <th className="truncate pb-1.5 pr-2 font-semibold">{currentName}</th>
            <th className="truncate pb-1.5 font-semibold text-primary">{nextName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/70">
              <th scope="row" className={cn('py-2 pr-2 text-left font-medium text-muted-foreground', 'text-[15px]')}>
                {r.label}
              </th>
              <td className={cn('py-2 pr-2 text-muted-foreground', 'text-[17px]')}>{r.current}</td>
              <td className={cn('py-2', 'text-[17px]', r.verdict === 'beter' ? 'font-semibold text-foreground' : 'text-foreground')}>
                {r.next}
                {r.verdict === 'beter' && <ArrowUp className="ml-1.5 inline size-4 align-[-2px] text-good" strokeWidth={2.6} aria-hidden />}
                {r.verdict === 'minder' && <ArrowDown className="ml-1.5 inline size-4 align-[-2px] text-warn" strokeWidth={2.6} aria-hidden />}
                {(r.verdict === 'beter' || r.verdict === 'minder') && <span className="sr-only">({r.verdict})</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
