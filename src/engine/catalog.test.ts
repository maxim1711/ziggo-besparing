import { describe, expect, it } from 'vitest'
import { compare } from './calc'
import { composeOffer, emptySelection, formatSpeed, isActive, parseCatalogExport, sampleCatalog, togglePromotion, type Catalog, type Selection } from './catalog'
import { buildCustomerView } from './customerView'
import { emptyCombo, emptyCurrent, emptyOffer } from './defaults'
import type { Offer } from './types'

const TODAY = '2026-06-01'
const cat = (): Catalog => sampleCatalog(TODAY)
const sel = (over: Partial<Selection> = {}): Selection => ({ ...emptySelection(), internetId: 'vb-net-400', ...over })
const build = (s: Selection, c = cat(), bundles: Offer[] = []) => composeOffer(c, bundles, s, TODAY)
const run = (offer: Offer, monthly = 6500) => compare({ current: { ...emptyCurrent(), monthlyCents: monthly }, offer, combo: emptyCombo(), period: 24, startDate: TODAY })

describe('package builder', () => {
  it('returns no offer until an internet product is chosen', () => {
    expect(build(emptySelection()).offer).toBeNull()
  })
  it('defaults to a 24-month contract', () => {
    expect(build(sel()).offer!.contractMonths).toBe(24)
    expect(emptyOffer(TODAY).contractMonths).toBe(24)
  })
  it('keeps 12 months available as an explicit override', () => {
    expect(build(sel({ contractMonths: 12 })).offer!.contractMonths).toBe(12)
  })
  it('internet only: promo and regular price from the product', () => {
    const o = build(sel()).offer!
    expect(o.kind).toBe('internet')
    expect([o.promoMonthlyCents, o.promoMonths, o.regularMonthlyCents]).toEqual([3495, 12, 5500])
    expect(o.includes).toEqual(['Internet 400 Mbit/s'])
  })
  it('internet + tv + extras − discounts + charges adds up month by month', () => {
    const { offer, missing } = build(sel({ tvId: 'vb-tv-start', extraIds: ['vb-x-sport'], extraReceivers: 2, promotionIds: ['vb-p-tijdelijk'] }))
    expect(missing).toEqual([])
    const r = run(offer!)
    // maand 1–6: 34,95 + 15 − 5 + 17,95 + 2×5 = 72,90
    expect(r.months[0].newCents).toBe(3495 + 1500 - 500 + 1795 + 1000)
    // maand 7–12: korting voorbij
    expect(r.months[6].newCents).toBe(3495 + 1500 + 1795 + 1000)
    // maand 13+: regulier
    expect(r.months[12].newCents).toBe(5500 + 1500 + 1795 + 1000)
    expect(r.oneTime.totalCents).toBe(2000)
    expect(r.new24Cents).toBe(6 * 7290 + 6 * 7790 + 12 * 9795 + 2000)
    expect(offer!.name).toBe('Internet 400 Mbit/s + TV Start')
    expect(offer!.kind).toBe('internet_tv')
  })
  it('supports arbitrary promotion durations (3, 6, 9, 12, whole term)', () => {
    for (const months of [3, 6, 9, 12, null]) {
      const c = cat()
      c.promotions[0].durationMonths = months
      const r = run(build(sel({ promotionIds: ['vb-p-bf'] }), c).offer!)
      const discounted = r.months.filter((m) => m.newCents === (m.promo ? 3495 : 5500) - 1000).length
      expect(discounted).toBe(months ?? 24)
    }
  })
  it('ignores tv-only extras and promotions when there is no tv', () => {
    const { offer } = build(sel({ extraIds: ['vb-x-sport'], promotionIds: ['vb-p-cadeau'], extraReceivers: 3 }))
    expect(offer!.extras).toEqual([])
    expect(offer!.gift).toBeNull()
  })
  it('applies a one-time discount without going below zero', () => {
    const c = cat()
    c.promotions[2].oneTimeDiscountCents = 9999
    const o = build(sel({ promotionIds: ['vb-p-activatie'] }), c).offer!
    expect(o.activationCents).toBe(0)
    expect(run(o).oneTime.totalCents).toBe(0)
  })
  it('reproduces the reference example through the builder', () => {
    const c = cat()
    Object.assign(c.internet[1], { promoMonthlyCents: 3495, promoMonths: 12, regularMonthlyCents: 7000, oneTimeCents: 0 })
    const r = run(build(sel(), c).offer!)
    expect(r.new24Cents).toBe(125940)
    expect(r.totalSavingsCents).toBe(30060)
  })
})

describe('mutually exclusive promotions', () => {
  it('selecting one replaces the other in the same group', () => {
    const c = cat()
    let ids = togglePromotion(c, [], 'vb-p-bf')
    ids = togglePromotion(c, ids, 'vb-p-activatie')
    ids = togglePromotion(c, ids, 'vb-p-tijdelijk')
    expect(ids).toEqual(['vb-p-activatie', 'vb-p-tijdelijk'])
    expect(togglePromotion(c, ids, 'vb-p-tijdelijk')).toEqual(['vb-p-activatie'])
  })
  it('never stacks two promotions of one group, even if both are selected', () => {
    const o = build(sel({ promotionIds: ['vb-p-bf', 'vb-p-tijdelijk'] })).offer!
    expect(o.discounts).toHaveLength(1)
    expect(run(o).months[0].newCents).toBe(3495 - 1000)
  })
})

describe('bundled prices', () => {
  const bundle: Offer = { ...emptyOffer(TODAY), id: 'b1', name: 'Alles-in-1', kind: 'internet_tv', speedMbps: 400, promoMonthlyCents: 4750, promoMonths: 12, regularMonthlyCents: 6950, validTo: '2026-12-31' }
  it('uses the bundle price and does not add internet or tv again', () => {
    const { offer } = build(sel({ bundleId: 'b1', tvId: 'vb-tv-start' }), cat(), [bundle])
    expect(offer!.promoMonthlyCents).toBe(4750)
    expect(offer!.regularMonthlyCents).toBe(6950)
    expect(run(offer!).months[0].newCents).toBe(4750)
  })
  it('still allows extras and promotions on top of a bundle', () => {
    const { offer } = build(sel({ bundleId: 'b1', extraIds: ['vb-x-film'], promotionIds: ['vb-p-bf'] }), cat(), [bundle])
    expect(run(offer!).months[0].newCents).toBe(4750 - 1000 + 1295)
  })
})

describe('missing prices', () => {
  it('reports them instead of inventing a value', () => {
    const c = cat()
    c.internet[1].regularMonthlyCents = null
    c.tv[0].monthlyCents = null
    const { missing } = build(sel({ tvId: 'vb-tv-start' }), c)
    expect(missing).toEqual(['Prijs van Internet 400 Mbit/s', 'Prijs van TV Start'])
  })
  it('ships no invented Vodafone discount', () => {
    expect(cat().vodafone.monthlyDiscountCents).toBeNull()
  })
})

describe('gift promotions', () => {
  it('attach a gift without changing any cost', () => {
    const base = build(sel({ tvId: 'vb-tv-start' })).offer!
    const withGift = build(sel({ tvId: 'vb-tv-start', promotionIds: ['vb-p-cadeau'] })).offer!
    expect(withGift.gift?.name).toBe('43-inch smart-tv')
    expect(run(withGift).new24Cents).toBe(run(base).new24Cents)
    expect(withGift.conditions).toContain('24 maanden')
  })
})

describe('availability and helpers', () => {
  it('filters on status and validity dates', () => {
    expect(isActive({ available: true, validFrom: '2026-01-01', validTo: '2026-12-31' }, TODAY)).toBe(true)
    expect(isActive({ available: false }, TODAY)).toBe(false)
    expect(isActive({ available: true, validTo: '2026-05-31' }, TODAY)).toBe(false)
    expect(isActive({ available: true, validFrom: '2026-07-01' }, TODAY)).toBe(false)
  })
  it('formats speeds', () => {
    expect(formatSpeed(400)).toBe('400 Mbit/s')
    expect(formatSpeed(1000)).toBe('1 Gbit/s')
    expect(formatSpeed(2500)).toBe('2,5 Gbit/s')
  })
})

describe('configuration import', () => {
  it('round-trips an export', () => {
    const c = cat()
    const parsed = parseCatalogExport(JSON.parse(JSON.stringify({ app: 'overstapadvies', catalog: c, bundles: [] })))
    expect(parsed.catalog).toEqual(c)
    expect(parsed.bundles).toEqual([])
  })
  it('rejects foreign files and tolerates missing sections', () => {
    expect(() => parseCatalogExport({ foo: 1 })).toThrow()
    const p = parseCatalogExport({ app: 'overstapadvies', catalog: { internet: [] } })
    expect(p.catalog.promotions).toEqual([])
    expect(p.catalog.vodafone.monthlyDiscountCents).toBeNull()
    expect(p.bundles).toBeNull()
  })
})

describe('customer presentation safety', () => {
  it('never carries internal notes from products or bundles', () => {
    const c = cat()
    c.internet[1].internalNotes = 'GEHEIM-INKOOP'
    const bundle: Offer = { ...emptyOffer(TODAY), id: 'b1', name: 'Bundel', regularMonthlyCents: 5000, internalNotes: 'GEHEIM-BUNDEL' }
    for (const s of [sel({ tvId: 'vb-tv-start', promotionIds: ['vb-p-cadeau'] }), sel({ bundleId: 'b1' })]) {
      const offer = build(s, c, [bundle]).offer!
      const json = JSON.stringify(buildCustomerView({ current: { ...emptyCurrent(), monthlyCents: 6500 }, offer, combo: emptyCombo(), period: 24, startDate: TODAY }))
      expect(json).not.toMatch(/GEHEIM|internalNotes|commission|provisie|weekdoel/i)
    }
  })
  it('keeps gift value out of the savings figure', () => {
    const c = cat()
    c.promotions[3].gift!.retailValueCents = 39900
    const a = run(build(sel({ tvId: 'vb-tv-start', promotionIds: ['vb-p-cadeau'] }), c).offer!)
    const b = run(build(sel({ tvId: 'vb-tv-start' }), c).offer!)
    expect(a.totalSavingsCents).toBe(b.totalSavingsCents)
  })
})
