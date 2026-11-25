import { cn } from '@/lib/utils'

/**
 * Sobere hardware-illustraties (geen merkafbeeldingen). Eén vormtaal voor de
 * snelheidsweergave en de wifi-opstelling, zodat modem en versterker overal hetzelfde zijn.
 */

export function ModemGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-10', className)} aria-hidden>
      <rect x="9" y="5" width="22" height="30" rx="6" fill="hsl(var(--card))" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.5" />
      <rect x="13" y="9" width="14" height="22" rx="3.5" fill="currentColor" fillOpacity=".05" />
      <circle cx="20" cy="27" r="1.8" fill="hsl(var(--accent))" />
      <path d="M15.5 16.5a6.5 6.5 0 0 1 9 0M17.6 19a3.4 3.4 0 0 1 4.8 0" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ExtenderGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-10', className)} aria-hidden>
      <rect x="11" y="9" width="18" height="22" rx="9" fill="hsl(var(--card))" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.5" />
      <circle cx="20" cy="25" r="1.6" fill="hsl(var(--accent))" />
      <path d="M16.3 18.2a5.2 5.2 0 0 1 7.4 0M18 20.3a2.8 2.8 0 0 1 4 0" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
