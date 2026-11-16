import { describe, expect, it } from 'vitest'
import { compare } from './calc'
import { buildCustomerView } from './customerView'
import { emptyCombo, emptyCurrent } from './defaults'
import { CHECK_MESSAGE, composeOffer, emptySelection, findPrice, migrateCatalogV2, packageKey, parsePricingExport, promotionBlockedReason, staleCount, togglePromotion, type PricingCatalog, type Promotion, type Selection } from './pricing'
import { seedPricing } from './pricingSeed'
import { sampleCatalog } from './catalog'
import type { Offer, VodafoneCombo } from './types'

const TODAY = '2026-11-16'
/** Seed met ingevulde aansluitkosten (in de echte seed bewust leeg). */
const cat = (activation: number | null = 0): PricingCatalog => ({ ...seedPricing(), activationCents: activation })
const sel = (over: Partial<Selection> = {}): Selection => ({ ...emptySelection(), internetId: 'net-200', ...over })
const build = (s: Selection, c = cat()) => composeOffer(c, s, TODAY)
const blocking = (s: Selection, c = cat()) => build(s, c).issues.filter((i) => i.blocking)
const run = (offer: Offer, monthly = 6500, combo: VodafoneCombo = emptyCombo()) => compare({ current: { ...emptyCurrent(), monthlyCents: monthly }, offer, combo, period: 24, startDate: TODAY })
const promo = (over: Partial<Promotion>): Promotion => ({ id: 'p', name: 'Testactie', channel: 'eigen', status: 'gecontroleerd', validFrom: null, validTo: null, contractMonths: 24, durationMonths: 12, fixedPrices: {}, monthlyDiscountCents: 0, oneTimeDiscountCents: 0, giftId: null, exclusiveGroup: null, requiresTv: false, conditions: '', benefits: '', source: { url: null, verifiedOn: TODAY }, internalNotes: '', ...over })

const NET = ['net-200', 'net-500', 'net-1000', 'net-2000']
const TVS = ['tv-start', 'tv-complete', 'tv-max']

describe('internet only — 4 verified base prices', () => {
  it.each([
    ['net-200', 4195],
    ['net-500', 4895],
    ['net-1000', 5495],
    ['net-2000', 5995],
  ])('%s = %i cents', (id, cents) => {
    const { offer, issues } = build(sel({ internetId: id }))
    expect(issues.filter((i) => i.blocking)).toEqual([])
    expect(offer!.regularMonthlyCents).toBe(cents)
    expect(offer!.kind).toBe('internet')
    expect(run(offer!).new24Cents).toBe(24 * cents)
  })
})

describe('internet + tv — all 12 official bundle prices', () => {
  const expected = [
    [5840, 6440, 7740],
    [6540, 7140, 8440],
    [7140, 7740, 9040],
    [7640, 8240, 9540],
  ]
  NET.forEach((n, i) =>
    TVS.forEach((t, j) =>
      it(`${n} + ${t} = ${expected[i][j]}`, () => {
        const { offer, issues } = build(sel({ internetId: n, tvId: t }))
        expect(issues.filter((x) => x.blocking)).toEqual([])
        expect(offer!.regularMonthlyCents).toBe(expected[i][j])
        expect(run(offer!).months[0].newCents).toBe(expected[i][j])
      }),
    ),
  )
  it('is a matrix price, not internet-only plus a separate tv price', () => {
    const c = cat()
    const only = findPrice(c, 'net-500', null, false)!.cents!
    const bundle = build(sel({ internetId: 'net-500', tvId: 'tv-complete' }), c).offer!
    expect(bundle.regularMonthlyCents).toBe(7140)
    expect(bundle.extras).toEqual([])
    // De internetprijs wijzigen verandert de bundelprijs niet: er wordt niets opgeteld.
    findPrice(c, 'net-500', null, false)!.cents = 9999
    expect(build(sel({ internetId: 'net-500', tvId: 'tv-complete' }), c).offer!.regularMonthlyCents).toBe(7140)
    expect(only).toBe(4895)
  })
})

describe('alles-in-1 — all 12 verified prices with fixed telephone', () => {
  const expected = [
    [6335, 6935, 8235],
    [7035, 7635, 8935],
    [7635, 8235, 9535],
    [8135, 8735, 10035],
  ]
  NET.forEach((n, i) =>
    TVS.forEach((t, j) =>
      it(`${n} + ${t} + bellen = ${expected[i][j]}`, () => {
        const { offer, issues } = build(sel({ internetId: n, tvId: t, phone: true }))
        expect(issues.filter((x) => x.blocking)).toEqual([])
        expect(offer!.regularMonthlyCents).toBe(expected[i][j])
        expect(offer!.regularMonthlyCents - build(sel({ internetId: n, tvId: t })).offer!.regularMonthlyCents).toBe(495)
        expect(offer!.includes).toContain('Vast bellen')
      }),
    ),
  )
})

describe('promotional pricing', () => {
  const s = sel({ tvId: 'tv-start', promotionIds: ['promo-3495-12m'] })
  it('reference example: Internet 200 + TV Start, 12 × 34,95 then 12 × 58,40 = € 1.120,20', () => {
    const { offer, issues } = build(s)
    expect(issues.filter((i) => i.blocking)).toEqual([])
    const r = run(offer!)
    expect(offer!.regularMonthlyCents).toBe(5840)
    expect(r.newRecurring12Cents).toBe(12 * 3495)
    expect(r.months[11].newCents).toBe(3495)
    expect(r.months[12].newCents).toBe(5840)
    expect(r.priceIncreaseMonth).toBe(13)
    expect(r.newRecurring24Cents).toBe(112020)
    expect(r.new24Cents).toBe(112020)
    expect(offer!.contractMonths).toBe(24)
  })
  it('does not overwrite the regular package price', () => {
    const c = cat()
    build(s, c)
    expect(findPrice(c, 'net-200', 'tv-start', false)!.cents).toBe(5840)
  })
  it('includes one-time charges in the total', () => {
    const r = run(build(s, cat(4995)).offer!)
    expect(r.oneTime.totalCents).toBe(4995)
    expect(r.new24Cents).toBe(112020 + 4995)
  })
  it('requires confirmation for packages the promotion is not assigned to', () => {
    const other = sel({ internetId: 'net-1000', tvId: 'tv-max', promotionIds: ['promo-3495-12m'] })
    const issues = blocking(other)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain(CHECK_MESSAGE)
    expect(issues[0].overrideKey).toBe('promo:promo-3495-12m')
    // Zonder bevestiging geldt gewoon de normale prijs; er wordt geen € 34,95 aangenomen.
    expect(build(other).offer!.promoMonths).toBe(0)
    const confirmed = build({ ...other, overrides: { 'promo:promo-3495-12m': 4995 } })
    expect(confirmed.issues.filter((i) => i.blocking)).toEqual([])
    expect(run(confirmed.offer!).newRecurring24Cents).toBe(12 * 4995 + 12 * 9040)
  })
  it.each([3, 6, 9, 12])('supports a %i-month fixed promotional price', (months) => {
    const c = cat()
    c.promotions.push(promo({ durationMonths: months, fixedPrices: { [packageKey('net-500', 'tv-complete', false)]: 3995 } }))
    const r = run(build(sel({ internetId: 'net-500', tvId: 'tv-complete', promotionIds: ['p'] }), c).offer!)
    expect(r.newRecurring24Cents).toBe(months * 3995 + (24 - months) * 7140)
    expect(r.months[months - 1].newCents).toBe(3995)
    expect(r.months[months].newCents).toBe(7140)
  })
  it('monthly discounts stop after their duration', () => {
    const c = cat()
    c.promotions.push(promo({ durationMonths: 6, monthlyDiscountCents: 1000 }))
    const r = run(build(sel({ promotionIds: ['p'] }), c).offer!)
    expect(r.months[5].newCents).toBe(3195)
    expect(r.months[6].newCents).toBe(4195)
  })
  it('one-time discount (free installation) never goes below zero', () => {
    const c = cat(2000)
    c.promotions.push(promo({ oneTimeDiscountCents: 5000 }))
    expect(run(build(sel({ promotionIds: ['p'] }), c).offer!).oneTime.totalCents).toBe(0)
  })
})

describe('promotion status, validity and exclusivity', () => {
  it('ignores concept, expired and not-yet-valid offers', () => {
    for (const over of [{ status: 'concept' as const }, { status: 'verlopen' as const }, { validTo: '2026-11-15' }, { validFrom: '2026-12-01' }]) {
      const c = cat()
      c.promotions.push(promo({ monthlyDiscountCents: 1000, ...over }))
      const { offer, issues } = build(sel({ promotionIds: ['p'] }), c)
      expect(offer!.discounts).toEqual([])
      expect(issues.some((i) => !i.blocking && i.message.includes('telt niet mee'))).toBe(true)
    }
  })
  it('reports why a promotion is blocked', () => {
    expect(promotionBlockedReason(promo({}), TODAY, 24, false)).toBeNull()
    expect(promotionBlockedReason(promo({ status: 'concept' }), TODAY, 24, false)).toContain('Concept')
    expect(promotionBlockedReason(promo({ validTo: '2026-01-01' }), TODAY, 24, false)).toBe('Verlopen')
    expect(promotionBlockedReason(promo({ contractMonths: 24 }), TODAY, 12, false)).toContain('24 maanden')
    expect(promotionBlockedReason(promo({ requiresTv: true }), TODAY, 24, false)).toContain('TV')
  })
  it('a 24-month promotion does not apply to a 12-month contract', () => {
    const { offer } = build(sel({ tvId: 'tv-start', promotionIds: ['promo-3495-12m'], contractMonths: 12 }))
    expect(offer!.promoMonths).toBe(0)
    expect(offer!.contractMonths).toBe(12)
  })
  it('mutually exclusive promotions cannot be stacked', () => {
    const c = cat()
    c.promotions.push(promo({ id: 'a', exclusiveGroup: 'G', monthlyDiscountCents: 500 }), promo({ id: 'b', exclusiveGroup: 'g ', monthlyDiscountCents: 700 }), promo({ id: 'c', monthlyDiscountCents: 100 }))
    expect(togglePromotion(c, ['a', 'c'], 'b')).toEqual(['c', 'b'])
    const o = build(sel({ promotionIds: ['a', 'b', 'c'] }), c).offer!
    expect(o.discounts.map((d) => d.id)).toEqual(['a', 'c'])
  })
  it('only one fixed promotional price can be active', () => {
    const c = cat()
    const k = packageKey('net-200', 'tv-start', false)
    c.promotions.push(promo({ id: 'f2', fixedPrices: { [k]: 2995 } }))
    expect(togglePromotion(c, ['promo-3495-12m'], 'f2')).toEqual(['f2'])
    expect(build(sel({ tvId: 'tv-start', promotionIds: ['promo-3495-12m', 'f2'] }), c).offer!.promoMonthlyCents).toBe(3495)
  })
})

describe('extras, inclusion and bundles', () => {
  it('charges extra receivers per unit; the included one is free', () => {
    const { offer } = build(sel({ tvId: 'tv-start', extras: { 'x-next-mini': 2, 'x-ci-module': 1 } }))
    expect(run(offer!).months[0].newCents).toBe(5840 + 2 * 600 + 400)
    expect(build(sel({ tvId: 'tv-start' })).offer!.extras).toEqual([])
  })
  it('respects an authorised price override for a receiver', () => {
    const { offer } = build(sel({ tvId: 'tv-start', extras: { 'x-next-mini': 1 }, overrides: { 'x-next-mini': 0 } }))
    expect(run(offer!).months[0].newCents).toBe(5840)
  })
  it('charges additional wifi extenders only', () => {
    expect(run(build(sel({ internetId: 'net-500', extras: { 'x-wifi-extender': 2 } })).offer!).months[0].newCents).toBe(4895 + 500)
    expect(cat().internet.map((i) => i.includedExtenders)).toEqual([0, 1, 2, 3, 4, 5])
  })
  it('never charges for a service already included in the tv package', () => {
    const r = build(sel({ tvId: 'tv-max', extras: { 'x-zst': 1, 'x-skyshowtime': 1 } }))
    expect(r.extraStates).toEqual({ 'x-zst': 'inbegrepen', 'x-skyshowtime': 'inbegrepen' })
    expect(r.offer!.extras).toEqual([])
    expect(run(r.offer!).months[0].newCents).toBe(7740)
    // Bij TV Start kost dezelfde dienst wel geld.
    expect(run(build(sel({ tvId: 'tv-start', extras: { 'x-zst': 1 } })).offer!).months[0].newCents).toBe(5840 + 1695)
  })
  it('a bundle replaces its constituent add-ons', () => {
    const r = build(sel({ tvId: 'tv-start', extras: { 'x-b-sport-film1': 1, 'x-film1': 1, 'x-zst': 1, 'x-b-sport-compleet': 1 } }))
    expect(r.issues.filter((i) => i.blocking)).toEqual([])
    expect(r.extraStates['x-b-sport-film1']).toBe('berekend')
    expect(r.extraStates['x-film1']).toBe('in_bundel')
    expect(r.extraStates['x-zst']).toBe('in_bundel')
    expect(r.extraStates['x-b-sport-compleet']).toBe('in_bundel')
    expect(run(r.offer!).months[0].newCents).toBe(5840 + 1995)
  })
  it('all five verified bundle prices', () => {
    const want: Record<string, number> = { 'x-b-sport-compleet': 1895, 'x-b-sport-film1': 1995, 'x-b-netflix-zst': 2195, 'x-b-viaplay-zst': 2295, 'x-b-disney-espn': 2195 }
    for (const [id, cents] of Object.entries(want)) expect(run(build(sel({ tvId: 'tv-start', extras: { [id]: 1 } })).offer!).months[0].newCents).toBe(5840 + cents)
  })
  it('a bundle overlapping TV Max needs a verified price instead of an invented discount', () => {
    const s = sel({ tvId: 'tv-max', extras: { 'x-b-netflix-zst': 1 } })
    const issues = blocking(s)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('overlapt met Ziggo Sport Totaal')
    expect(issues[0].overrideKey).toBe('x-b-netflix-zst')
    expect(build(s).offer!.extras).toEqual([])
    const fixed = build({ ...s, overrides: { 'x-b-netflix-zst': 999 } })
    expect(fixed.issues.filter((i) => i.blocking)).toEqual([])
    expect(run(fixed.offer!).months[0].newCents).toBe(7740 + 999)
  })
  it('two overlapping bundles are flagged', () => {
    expect(blocking(sel({ tvId: 'tv-start', extras: { 'x-b-netflix-zst': 1, 'x-b-viaplay-zst': 1 } }))).toHaveLength(1)
  })
  it('never quotes a "from" price', () => {
    const s = sel({ extras: { 'x-netflix': 1 } })
    expect(blocking(s)[0].message).toContain('vanaf-prijs')
    expect(build(s).offer!.extras).toEqual([])
    expect(run(build({ ...s, overrides: { 'x-netflix': 1399 } }).offer!).months[0].newCents).toBe(4195 + 1399)
  })
  it('flags ESPN Premium for an eligibility check without blocking', () => {
    const r = build(sel({ tvId: 'tv-start', extras: { 'x-espn-premium': 1 } }))
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].blocking).toBe(false)
    expect(r.issues[0].message).toContain('ESPN')
  })
  it('ignores tv-only extras without tv', () => {
    expect(build(sel({ extras: { 'x-zst': 1, 'x-next-mini': 2 } })).offer!.extras).toEqual([])
  })
  it('specialist and adult channels sit under "more options"', () => {
    expect(cat().extras.filter((e) => e.moreOptions).map((e) => e.id)).toEqual(['x-hindi', 'x-turks', 'x-erotiek', 'x-gay'])
  })
})

describe('invalid, unavailable and unverified combinations', () => {
  it('4 and 8 Gbit exist but are disabled without a price', () => {
    const c = cat()
    for (const id of ['net-4000', 'net-8000']) {
      expect(c.internet.find((i) => i.id === id)!.available).toBe(false)
      expect(findPrice(c, id, null, false)!.cents).toBeNull()
      const issues = blocking(sel({ internetId: id }), c)
      expect(issues[0].message).toContain(CHECK_MESSAGE)
    }
  })
  it('becomes usable once the advisor enters and verifies a price', () => {
    const c = cat()
    c.internet.find((i) => i.id === 'net-4000')!.available = true
    Object.assign(findPrice(c, 'net-4000', null, false)!, { cents: 7495, source: { url: null, verifiedOn: TODAY } })
    expect(blocking(sel({ internetId: 'net-4000' }), c)).toEqual([])
  })
  it('a price without a verification date is not quoted', () => {
    const c = cat()
    findPrice(c, 'net-200', null, false)!.source.verifiedOn = null
    expect(blocking(sel(), c)).toHaveLength(1)
  })
  it('internet only + telephone has no verified price', () => {
    expect(blocking(sel({ phone: true }))[0].message).toContain(CHECK_MESSAGE)
  })
  it('missing one-time costs block the comparison (seed leaves them empty on purpose)', () => {
    expect(seedPricing().activationCents).toBeNull()
    const issues = blocking(sel(), cat(null))
    expect(issues).toHaveLength(1)
    expect(issues[0].needsActivation).toBe(true)
  })
  it('no selection yields no offer', () => {
    expect(build(emptySelection()).offer).toBeNull()
  })
})

describe('Vodafone combination benefit', () => {
  const offer = () => build(sel({ internetId: 'net-1000', tvId: 'tv-start' })).offer!
  it('reference amounts per speed', () => {
    expect(cat().internet.map((i) => i.vodafoneDiscountCents)).toEqual([250, 500, 750, 1000, null, null])
  })
  it('has no effect until eligibility is confirmed', () => {
    const r = run(offer(), 6500, { hasVodafone: true, eligible: false, monthlyDiscountCents: 750, extraBenefits: '' })
    expect(r.comboSavingsPeriodCents).toBe(0)
    expect(r.months[0].newCents).toBe(7140)
  })
  it('applies the confirmed Ziggo-invoice discount and reports it separately', () => {
    const r = run(offer(), 6500, { hasVodafone: true, eligible: true, monthlyDiscountCents: 750, extraBenefits: '' })
    expect(r.months[0].newCents).toBe(7140 - 750)
    expect(r.comboSavingsPeriodCents).toBe(24 * 750)
    expect(r.totalSavingsWithoutComboCents).toBe(r.totalSavingsCents - 18000)
  })
  it('a discount on the Vodafone invoice never lowers the Ziggo price', () => {
    const a = run(offer(), 6500, { hasVodafone: true, eligible: true, monthlyDiscountCents: 750, extraBenefits: '' })
    const b = run(offer(), 6500, { hasVodafone: true, eligible: true, monthlyDiscountCents: 750, extraBenefits: '', mobileInvoiceDiscountCents: 1000 })
    expect(b.new24Cents).toBe(a.new24Cents)
    expect(b.totalSavingsCents).toBe(a.totalSavingsCents)
  })
})

describe('savings, gifts and customer safety', () => {
  it('shows negative savings when the new package costs more', () => {
    const r = run(build(sel({ internetId: 'net-2000', tvId: 'tv-max' })).offer!, 6000)
    expect(r.totalSavingsCents).toBe(24 * 6000 - 24 * 9540)
    expect(r.totalSavingsCents).toBeLessThan(0)
  })
  it('gift value is separate from subscription savings', () => {
    const c = cat()
    c.gifts.push({ id: 'g1', available: true, type: 'televisie', name: 'Smart-tv', imageDataUrl: null, retailValueCents: 49900, description: '', conditions: '' })
    c.promotions.push(promo({ giftId: 'g1' }))
    const withGift = build(sel({ tvId: 'tv-start', promotionIds: ['p'] }), c).offer!
    const without = build(sel({ tvId: 'tv-start' }), c).offer!
    expect(withGift.gift?.name).toBe('Smart-tv')
    expect(run(withGift).new24Cents).toBe(run(without).new24Cents)
    expect(run(withGift).totalSavingsCents).toBe(run(without).totalSavingsCents)
  })
  it('an unavailable gift is not shown', () => {
    const c = cat()
    c.gifts.push({ id: 'g1', available: false, type: 'anders', name: 'X', imageDataUrl: null, retailValueCents: null, description: '', conditions: '' })
    c.promotions.push(promo({ giftId: 'g1' }))
    expect(build(sel({ promotionIds: ['p'] }), c).offer!.gift).toBeNull()
  })
  it('customer view carries no internal notes or commission data', () => {
    const c = cat()
    c.promotions[0].internalNotes = 'GEHEIM-ACTIE'
    c.internet[0].internalNotes = 'GEHEIM-NET'
    const offer = build(sel({ tvId: 'tv-start', promotionIds: ['promo-3495-12m'] }), c).offer!
    const json = JSON.stringify(buildCustomerView({ current: { ...emptyCurrent(), monthlyCents: 6500 }, offer, combo: emptyCombo(), period: 24, startDate: TODAY }))
    expect(json).not.toMatch(/GEHEIM|internalNotes|commission|provisie|weekdoel/i)
  })
  it('uses integer cents everywhere in the seed', () => {
    const c = seedPricing()
    const all = [...c.prices.map((p) => p.cents), ...c.extras.flatMap((e) => [e.monthlyCents, e.fromCents]), ...c.internet.map((i) => i.vodafoneDiscountCents)].filter((v): v is number => v !== null)
    expect(all.length).toBeGreaterThan(60)
    expect(all.every((v) => Number.isInteger(v) && v >= 0)).toBe(true)
  })
})

describe('source metadata and maintenance', () => {
  it('every seeded price has a source and verification date', () => {
    const c = seedPricing()
    for (const p of c.prices.filter((x) => x.cents !== null)) {
      expect(p.source.verifiedOn).toBe('2026-11-16')
      expect(p.source.url).toContain('ziggo.nl')
    }
    expect(c.prices).toHaveLength(6 * 8)
  })
  it('counts stale prices after 30 days', () => {
    expect(staleCount(seedPricing(), '2026-11-20')).toBe(0)
    expect(staleCount(seedPricing(), '2027-01-10')).toBeGreaterThan(50)
  })
  it('validates imports', () => {
    const c = seedPricing()
    expect(parsePricingExport(JSON.parse(JSON.stringify({ app: 'overstapadvies', schemaVersion: 3, pricing: c })))).toEqual(c)
    expect(() => parsePricingExport({ foo: 1 })).toThrow()
    expect(() => parsePricingExport({ app: 'overstapadvies', schemaVersion: 9, pricing: c })).toThrow(/nieuwere versie/)
    const bad = JSON.parse(JSON.stringify(c))
    bad.prices[0].cents = 41.95
    bad.prices[1].internetId = 'bestaat-niet'
    expect(() => parsePricingExport({ app: 'overstapadvies', schemaVersion: 3, pricing: bad })).toThrow(/centen.*onbekend internetpakket/s)
    expect(() => parsePricingExport({ app: 'overstapadvies', schemaVersion: 3, pricing: { ...c, extras: undefined } })).toThrow(/ontbreekt/)
  })
  it('migrates advisor-created v2 items and drops the invented examples', () => {
    const old = sampleCatalog(TODAY)
    old.promotions.push({ ...old.promotions[0], id: 'mine', name: 'Mijn actie', isExample: false, gift: { type: 'soundbar', name: 'Soundbar', imageDataUrl: null, retailValueCents: null, description: '', conditions: '' } })
    old.extras.push({ ...old.extras[0], id: 'mijn-extra', name: 'Mijn extra', isExample: false })
    const m = migrateCatalogV2(old, seedPricing())
    expect(m.promotions.map((p) => p.id)).toEqual(['promo-3495-12m', 'mine'])
    expect(m.promotions[1]).toMatchObject({ status: 'concept', channel: 'eigen', giftId: 'gift-mine' })
    expect(m.gifts.map((g) => g.name)).toEqual(['Soundbar'])
    expect(m.extras.some((e) => e.id === 'mijn-extra')).toBe(true)
    expect(m.extras.some((e) => e.id.startsWith('vb-'))).toBe(false)
    expect(migrateCatalogV2(undefined, seedPricing())).toEqual(seedPricing())
  })
})
