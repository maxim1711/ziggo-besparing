import { describe, expect, it } from 'vitest'
import { clearCountUpMemory, countUpStart, countUpValue, rememberCountUp } from './countUp'

describe('count-up', () => {
  it('always settles on the exact amount', () => {
    expect(countUpValue(0, 43800, 1)).toBe(43800)
    expect(countUpValue(0, 43800, 1.7)).toBe(43800)
    expect(countUpValue(12345, -5000, 1)).toBe(-5000)
  })
  it('moves monotonically from the previous value', () => {
    const steps = [0, 0.1, 0.3, 0.6, 0.9, 1].map((p) => countUpValue(20000, 43800, p))
    expect(steps[0]).toBe(20000)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1])
    expect(steps.at(-1)).toBe(43800)
  })
  it('starts from 0 the first time, and from the seen value afterwards', () => {
    clearCountUpMemory()
    expect(countUpStart('besparing', 43800, false)).toBe(0)
    rememberCountUp('besparing', 43800)
    // Terug naar het scherm met dezelfde besparing: niet opnieuw tellen.
    expect(countUpStart('besparing', 43800, false)).toBe(43800)
    // Andere waarde: tellen vanaf wat de klant al zag.
    expect(countUpStart('besparing', 50000, false)).toBe(43800)
    clearCountUpMemory()
    expect(countUpStart('besparing', 43800, false)).toBe(0)
  })
  it('reduced motion shows the final value immediately', () => {
    expect(countUpStart(undefined, 43800, true)).toBe(43800)
    expect(countUpStart('x', 43800, true)).toBe(43800)
  })
})
