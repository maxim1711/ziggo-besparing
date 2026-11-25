import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './utils'

/**
 * Vloeiend optellen naar een getal. Met een `memoryKey` onthoudt de app welk getal
 * de klant al heeft gezien: bij terugkeren naar een scherm wordt niet opnieuw vanaf 0
 * geteld, alleen als de waarde echt verandert.
 */
const memory = new Map<string, number>()

/** Startwaarde voor een nieuwe weergave. */
export function countUpStart(key: string | undefined, target: number, reduced: boolean): number {
  if (reduced) return target
  if (key && memory.has(key)) return memory.get(key)!
  return 0
}

export const rememberCountUp = (key: string | undefined, value: number) => {
  if (key) memory.set(key, value)
}

/** Nieuw klantgesprek: alles mag weer vanaf het begin tellen. */
export const clearCountUpMemory = () => memory.clear()

export const easeOutQuart = (p: number) => 1 - Math.pow(1 - p, 4)

/** Tussenwaarde, afgerond op hele eenheden; eindigt altijd exact op `to`. */
export function countUpValue(from: number, to: number, progress: number): number {
  if (progress >= 1) return to
  return Math.round(from + (to - from) * easeOutQuart(Math.max(0, progress)))
}

export function useCountUp(target: number, { duration = 800, memoryKey }: { duration?: number; memoryKey?: string } = {}): number {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(() => countUpStart(memoryKey, target, reduced))
  const current = useRef(shown)
  useEffect(() => {
    rememberCountUp(memoryKey, target)
    if (reduced || current.current === target) {
      current.current = target
      setShown(target)
      return
    }
    // Snel na elkaar wijzigen: verder vanaf wat nu in beeld staat, zonder sprong.
    const start = current.current
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const v = countUpValue(start, target, (t - t0) / duration)
      current.current = v
      setShown(v)
      if (t - t0 < duration) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, duration, memoryKey])
  return shown
}
