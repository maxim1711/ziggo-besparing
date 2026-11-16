import { useEffect, useRef, useState } from 'react'
import { formatEuro } from '@/engine/money'
import { usePrefersReducedMotion } from '@/lib/utils'

/** Telt vloeiend naar het nieuwe bedrag; direct bij "verminder beweging". */
export function AnimatedMoney({ cents, className, decimals = 'always' }: { cents: number; className?: string; decimals?: 'always' | 'auto' }) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(reduced ? cents : 0)
  const from = useRef(shown)
  useEffect(() => {
    if (reduced) {
      setShown(cents)
      from.current = cents
      return
    }
    const start = from.current
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 800)
      const eased = 1 - Math.pow(1 - p, 4)
      const v = Math.round(start + (cents - start) * eased)
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cents, reduced])
  return (
    <span className={className} aria-label={formatEuro(cents)}>
      <span aria-hidden className="tnum">{formatEuro(shown, { decimals })}</span>
    </span>
  )
}
