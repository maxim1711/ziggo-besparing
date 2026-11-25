import { describe, expect, it } from 'vitest'
import { emptyCurrent } from './defaults'
import { composeOffer, emptySelection, type Selection } from './pricing'
import { seedPricing } from './pricingSeed'
import { emptyCurrentProduct, extenderLabel, gaugeFill, hardwareLabel, hasProductInfo, productComparison, resolvedTvFeatures, speedTier, totalExtenders, tvCards, tvFeatureView } from './product'
import type { CurrentSubscription, OfferProduct } from './types'

const TODAY = '2026-11-16'
const catalog = () => ({ ...seedPricing(), activationCents: 0 })
const product = (over: Partial<Selection> = {}): OfferProduct => composeOffer(catalog(), { ...emptySelection(), internetId: 'net-200', ...over }, TODAY).offer!.product!
const current = (over: Partial<CurrentSubscription> = {}, p: Partial<ReturnType<typeof emptyCurrentProduct>> = {}): CurrentSubscription => ({ ...emptyCurrent(), ...over, product: { ...emptyCurrentProduct(), ...p } })

describe('speed presentation', () => {
  it('uses a calibrated, non-linear gauge where 200 Mbit/s is clearly filled', () => {
    expect(gaugeFill(200)).toBeGreaterThanOrEqual(0.5)
    expect(gaugeFill(2000)).toBe(1)
    const fills = [200, 500, 1000, 2000].map(gaugeFill)
    for (let i = 1; i < fills.length; i++) expect(fills[i]).toBeGreaterThan(fills[i - 1])
    // Niet lineair: lineair zou 200 op 10% zetten.
    expect(gaugeFill(200)).toBeGreaterThan(200 / 2000 + 0.3)
  })
  it('clamps unknown and very high values', () => {
    expect(gaugeFill(0)).toBe(0)
    expect(gaugeFill(Number.NaN)).toBe(0)
    expect(gaugeFill(8000)).toBe(1)
    expect(gaugeFill(50)).toBeGreaterThanOrEqual(0.3)
  })
  it('assigns tiers', () => {
    expect([200, 500, 1000, 2000].map(speedTier)).toEqual(['basis', 'plus', 'premium', 'top'])
  })
})

describe('wifi extenders come from the central product configuration', () => {
  it.each([
    ['net-200', 0],
    ['net-500', 1],
    ['net-1000', 2],
    ['net-2000', 3],
  ])('%s includes %i extenders', (id, n) => {
    const net = seedPricing().internet.find((i) => i.id === id)!
    expect(net.includedExtenders).toBe(n)
    expect(product({ internetId: id }).includedExtenders).toBe(n)
  })
  it('labels', () => {
    expect(extenderLabel(0)).toBe('')
    expect(extenderLabel(1)).toBe('1 wifi-versterker inbegrepen')
    expect(extenderLabel(3)).toBe('3 wifi-versterkers inbegrepen')
    expect(hardwareLabel(0)).toBe('Modem')
    expect(hardwareLabel(2)).toBe('Modem + 2 wifi-versterkers')
  })
  it('counts extra paid extenders separately', () => {
    const p = product({ internetId: 'net-500', extras: { 'x-wifi-extender': 2 } })
    expect([p.includedExtenders, p.extraExtenders, totalExtenders(p)]).toEqual([1, 2, 3])
  })
})

describe('tv package cards use only configured features', () => {
  const tvs = seedPricing().tv
  const cards = tvCards(tvs)
  const card = (id: string) => cards.find((c) => c.id === id)!

  it('resolves "Alles van …" into the base package features', () => {
    const max = tvs.find((t) => t.id === 'tv-max')!
    const all = resolvedTvFeatures(tvs, max)
    expect(all).toContain('Opnemen')
    expect(all).toContain('70+ zenders')
    expect(all).not.toContain('Alles van TV Complete')
  })
  it('TV Start: complete basic package with its channel count', () => {
    expect(card('tv-start').channels).toBe('70+ zenders')
    expect(card('tv-start').recording).toBe(false)
    expect(card('tv-start').basedOn).toBeNull()
    expect(card('tv-start').highlights.length).toBeGreaterThanOrEqual(3)
  })
  it('TV Complete communicates recording', () => {
    const c = card('tv-complete')
    expect(c.recording).toBe(true)
    expect(c.basedOn).toBe('TV Start')
    expect(c.highlights[0]).toEqual({ icon: 'opnemen', label: 'Programma’s opnemen' })
    expect(c.channels).toBe('70+ zenders')
  })
  it('TV Max is the most complete package, with the highest channel count', () => {
    expect(card('tv-max').mostComplete).toBe(true)
    expect(card('tv-start').mostComplete).toBe(false)
    expect(card('tv-complete').mostComplete).toBe(false)
    expect(card('tv-max').channels).toBe('110+ zenders')
    expect(card('tv-max').highlights.map((h) => h.label)).toEqual(['Ziggo Sport Totaal', 'SkyShowtime'])
  })
  it('does not invent features or a "most complete" label without a chain', () => {
    const flat = tvCards([{ ...tvs[0], id: 'a', name: 'A', features: ['Iets'] }, { ...tvs[0], id: 'b', name: 'B', features: ['Iets anders'] }])
    expect(flat.every((c) => !c.mostComplete && c.channels === null && !c.recording)).toBe(true)
    expect(tvFeatureView('Iets').icon).toBe('overig')
  })
})

describe('extended comparison', () => {
  it('nothing entered: no rows and no product info', () => {
    const c = { ...emptyCurrent() }
    expect(hasProductInfo(c)).toBe(false)
    expect(productComparison(c, product({ internetId: 'net-1000' }))).toEqual([])
  })
  it('compares only known attributes', () => {
    const rows = productComparison(current({ speedMbps: 200 }), product({ internetId: 'net-500' }))
    expect(rows).toEqual([{ id: 'snelheid', label: 'Internetsnelheid', current: '200 Mbit/s', next: '500 Mbit/s', verdict: 'beter' }])
  })
  it('unknown is never treated as zero or "no"', () => {
    const rows = productComparison(current({}, { extenders: null, recording: null, phone: null }), product({ internetId: 'net-2000', tvId: 'tv-complete' }))
    expect(rows).toEqual([])
  })
  it('zero extenders is a known value', () => {
    const rows = productComparison(current({}, { extenders: 0 }), product({ internetId: 'net-500' }))
    expect(rows[0]).toMatchObject({ id: 'wifi', current: 'Geen wifi-versterkers', next: '1 wifi-versterker', verdict: 'beter' })
  })
  it('shows disadvantages honestly', () => {
    const rows = productComparison(current({ speedMbps: 1000 }, { recording: true, phone: true, extenders: 2 }), product({ internetId: 'net-200', tvId: 'tv-start' }))
    expect(rows.find((r) => r.id === 'snelheid')!.verdict).toBe('minder')
    expect(rows.find((r) => r.id === 'opnemen')!).toMatchObject({ current: 'Opnemen inbegrepen', next: 'Opnemen niet inbegrepen', verdict: 'minder' })
    expect(rows.find((r) => r.id === 'bellen')!.verdict).toBe('minder')
    expect(rows.find((r) => r.id === 'wifi')!.verdict).toBe('minder')
  })
  it('recording upgrade with TV Complete', () => {
    const rows = productComparison(current({}, { recording: false }), product({ tvId: 'tv-complete' }))
    expect(rows).toEqual([{ id: 'opnemen', label: 'Programma’s opnemen', current: 'Opnemen niet inbegrepen', next: 'Opnemen inbegrepen', verdict: 'beter' }])
  })
  it('adding fixed telephony is a difference, not an improvement', () => {
    const rows = productComparison(current({}, { phone: false }), product({ tvId: 'tv-start', phone: true }))
    expect(rows[0].verdict).toBe('anders')
  })
  it('includes extra paid extenders on the Ziggo side', () => {
    const rows = productComparison(current({}, { extenders: 1 }), product({ internetId: 'net-200', extras: { 'x-wifi-extender': 1 } }))
    expect(rows[0].verdict).toBe('gelijk')
  })
  it('channel count uses the verified lower bound', () => {
    const rows = productComparison(current({ hasTv: true }, { channels: 50 }), product({ tvId: 'tv-start' }))
    expect(rows[0]).toMatchObject({ id: 'zenders', current: '50 zenders', next: '70+ zenders', verdict: 'beter' })
    expect(productComparison(current({ hasTv: true }, { channels: 90 }), product({ tvId: 'tv-start' }))[0].verdict).toBe('minder')
  })
  it('older saved offers without product data produce no comparison', () => {
    expect(productComparison(current({ speedMbps: 100 }), undefined)).toEqual([])
  })
})
