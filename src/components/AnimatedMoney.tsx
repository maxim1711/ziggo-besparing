import { formatEuro } from '@/engine/money'
import { useCountUp } from '@/lib/countUp'

/**
 * Telt vloeiend naar het nieuwe bedrag; direct bij "verminder beweging".
 * `memoryKey`: niet opnieuw vanaf 0 tellen als de klant dit bedrag al heeft gezien.
 */
export function AnimatedMoney({ cents, className, decimals = 'always', memoryKey }: { cents: number; className?: string; decimals?: 'always' | 'auto'; memoryKey?: string }) {
  const shown = useCountUp(cents, { memoryKey })
  return (
    <span className={className} aria-label={formatEuro(cents, { decimals })}>
      <span aria-hidden className="tnum">{formatEuro(shown, { decimals })}</span>
    </span>
  )
}
