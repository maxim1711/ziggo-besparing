import { describe, expect, it } from 'vitest'
import { compare } from './calc'
import { buildCustomerView } from './customerView'
import { emptyCombo, emptyCurrent } from './defaults'
import { addMissingSeedItems, CHECK_MESSAGE, composeOffer, emptySelection, findPrice, applyPromotionUpdate, keysInCategory, migrateCatalogV2, percentPrice, promotionsForContract, vodafoneFor, vodafoneOn, packageCategory, packageKey, promotionMonths, parsePricingExport, promotionBlockedReason, staleCount, togglePromotion, type PricingCatalog, type Promotion, type Selection } from './pricing'
import { REPLACED_PROMOTION_IDS, seedPricing, WELCOME_IDS } from './pricingSeed'
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
const [W24, W12, W50]: string[] = [WELCOME_IDS.tweeJaar, WELCOME_IDS.eenJaarVast, WELCOME_IDS.eenJaarProcent]
/** Officiële prijzen: [alleen internet, TV Start, TV Complete, TV Max] en Alles-in-1 [Start, Complete, Max]. */
const REGULAR: Record<string, number[]> = { 'net-200': [4195, 5840, 6440, 7740], 'net-500': [4895, 6540, 7140, 8440], 'net-1000': [5495, 7140, 7740, 9040], 'net-2000': [5995, 7640, 8240, 9540] }
const PHONE: Record<string, number[]> = { 'net-200': [6335, 6935, 8235], 'net-500': [7035, 7635, 8935], 'net-1000': [7635, 8235, 9535], 'net-2000': [8135, 8735, 10035] }
/** Fictieve normale prijs voor internet + bellen (in de seed bewust leeg). */
const NET_PHONE = 4695
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
    expect(m.promotions.map((p) => p.id)).toEqual([W24, W12, W50, 'welkom-bol', 'welkom-samsung', 'promo-3495-12m', 'mine'])
    expect(m.promotions[6]).toMatchObject({ status: 'concept', channel: 'eigen', giftId: 'gift-mine' })
    expect(m.gifts.map((g) => g.id)).toEqual(['gift-bol-450', 'gift-samsung-tv-soundbar', 'gift-mine'])
    expect(m.extras.some((e) => e.id === 'mijn-extra')).toBe(true)
    expect(m.extras.some((e) => e.id.startsWith('vb-'))).toBe(false)
    expect(migrateCatalogV2(undefined, seedPricing())).toEqual(seedPricing())
  })
})

describe('welcome offers — 24 months: one of three', () => {
  const WELCOME = [W24, 'welkom-bol', 'welkom-samsung']
  const combos = NET.flatMap((n) => [null, ...TVS].map((t, j) => ({ n, t, regular: REGULAR[n][j] })))

  it('all welcome offers are in the editable campaign configuration', () => {
    const promos = seedPricing().promotions.filter((p) => p.exclusiveGroup === 'Welkomstactie' && p.channel === 'eigen')
    expect(promos.map((p) => p.id)).toEqual([W24, W12, W50, 'welkom-bol', 'welkom-samsung'])
    for (const p of promos) expect(p).toMatchObject({ status: 'gecontroleerd', contractExact: true })
    const [a, b, c] = promos
    expect(a).toMatchObject({ contractMonths: 24, durationMonths: 12 })
    expect(b).toMatchObject({ contractMonths: 12, durationMonths: 9 })
    expect(c).toMatchObject({ contractMonths: 12, durationMonths: 6, percentDiscount: 50, fixedPrices: {} })
    // 4 snelheden × (internet, 3 tv-pakketten) × (met/zonder bellen)
    expect(Object.keys(a.fixedPrices)).toHaveLength(32)
    expect(new Set(Object.values(a.fixedPrices))).toEqual(new Set([3495]))
    expect(a.fixedPrices).toEqual(b.fixedPrices)
    expect(seedPricing().promotions.some((p) => p.id === 'welkom-35')).toBe(false)
  })

  it.each(combos)('12 × € 34,95: $n + $t, then 12 × regular', ({ n, t, regular }) => {
    const { offer, issues } = build(sel({ internetId: n, tvId: t, promotionIds: [W24] }))
    expect(issues.filter((i) => i.blocking)).toEqual([])
    const r = run(offer!)
    expect(r.months.slice(0, 12).every((m) => m.newCents === 3495)).toBe(true)
    expect(r.months.slice(12).every((m) => m.newCents === regular)).toBe(true)
    expect(r.new24Cents).toBe(12 * 3495 + 12 * regular)
    expect(offer!.gift).toBeNull()
    expect(offer!.promoName).toBe('12 maanden € 34,95 p/m')
  })

  it.each(combos)('gift offers: $n + $t pays the regular price for 24 months', ({ n, t, regular }) => {
    for (const [id, gift] of [['welkom-bol', 'bol cadeaukaart van € 450'], ['welkom-samsung', 'Samsung 55-inch 4K-tv + soundbar']]) {
      const { offer, issues } = build(sel({ internetId: n, tvId: t, promotionIds: [id] }))
      expect(issues.filter((i) => i.blocking)).toEqual([])
      expect(offer!.promoMonths).toBe(0)
      expect(run(offer!).new24Cents).toBe(24 * regular)
      expect(offer!.gift?.name).toBe(gift)
    }
  })

  it('selecting another offer deselects the previous one', () => {
    const c = cat()
    let ids: string[] = []
    for (const id of WELCOME) {
      ids = togglePromotion(c, ids, id)
      expect(ids).toEqual([id])
    }
    expect(togglePromotion(c, [W12], W50)).toEqual([W50])
    expect(togglePromotion(c, [W24], W24)).toEqual([])
  })

  it('cannot be stacked even if several end up selected', () => {
    for (const order of [WELCOME, [...WELCOME].reverse(), ['welkom-bol', W24, 'welkom-samsung']]) {
      const o = build(sel({ tvId: 'tv-start', promotionIds: order })).offer!
      const single = build(sel({ tvId: 'tv-start', promotionIds: [order[0]] })).offer!
      expect(run(o).new24Cents).toBe(run(single).new24Cents)
      expect(o.gift).toEqual(single.gift)
      expect(o.promoName).toBe(single.promoName)
    }
    // Vaste prijs en procentkorting stapelen nooit.
    const both = build(sel({ contractMonths: 12, tvId: 'tv-start', promotionIds: [W12, W50] })).offer!
    expect([both.promoMonthlyCents, both.promoMonths]).toEqual([3495, 9])
  })

  it('two gift promotions never combine, even in different groups', () => {
    const c = cat()
    c.promotions.find((p) => p.id === 'welkom-samsung')!.exclusiveGroup = 'Andere groep'
    expect(togglePromotion(c, ['welkom-bol'], 'welkom-samsung')).toEqual(['welkom-samsung'])
    const o = build(sel({ promotionIds: ['welkom-bol', 'welkom-samsung'] }), c).offer!
    expect(o.gift?.name).toBe('bol cadeaukaart van € 450')
  })

  it('gift value (€ 450 / € 898) is never added to the cash savings', () => {
    const plain = run(build(sel({ internetId: 'net-500', tvId: 'tv-complete' })).offer!, 8000)
    for (const id of ['welkom-bol', 'welkom-samsung']) {
      const r = run(build(sel({ internetId: 'net-500', tvId: 'tv-complete', promotionIds: [id] })).offer!, 8000)
      expect(r.totalSavingsCents).toBe(plain.totalSavingsCents)
    }
    expect(seedPricing().gifts.map((g) => g.retailValueCents)).toEqual([45000, 89800])
  })

  it('€ 34,95 also covers Alles-in-1 without charging tv or phone on top', () => {
    for (const n of NET)
      TVS.forEach((t, j) => {
        const o = build(sel({ internetId: n, tvId: t, phone: true, promotionIds: [W24] })).offer!
        expect([o.promoMonthlyCents, o.regularMonthlyCents, o.promoMonths]).toEqual([3495, PHONE[n][j], 12])
        expect(o.extras).toEqual([])
      })
  })

  it('gift images are bundled, base-relative paths (no root-relative or external URLs)', () => {
    for (const g of seedPricing().gifts) expect(g.imageDataUrl).toMatch(/^gifts\/[a-z-]+\.svg$/)
  })

  it('updating an existing configuration adds the offers without touching existing rows', () => {
    const mine = cat()
    mine.promotions = [{ ...mine.promotions.find((p) => p.id === W24)!, name: 'Door mij aangepast', fixedPrices: {} }]
    mine.gifts = []
    const merged = addMissingSeedItems(mine, seedPricing())
    expect(merged.promotions.find((p) => p.id === W24)!.name).toBe('Door mij aangepast')
    expect(merged.gifts).toHaveLength(2)
  })
})

describe('welcome offers — 12-month contract', () => {
  const combos = NET.flatMap((n) => [null, ...TVS].flatMap((t, j) => [false, true].map((phone) => ({ n, t, phone, regular: phone ? (t ? PHONE[n][j - 1] : NET_PHONE) : REGULAR[n][j] }))))
  /** Seed + gecontroleerde normale prijs voor internet + bellen (in de echte seed nog leeg). */
  const full = () => {
    const c = cat()
    c.prices = c.prices.map((p) => (p.tvId === null && p.phone && NET.includes(p.internetId) ? { ...p, cents: NET_PHONE, source: { url: null, verifiedOn: TODAY } } : p))
    return c
  }
  const run12 = (offer: Offer, monthly = 6500) => compare({ current: { ...emptyCurrent(), monthlyCents: monthly }, offer, combo: emptyCombo(), period: 12, startDate: TODAY })

  it.each(combos)('9 × € 34,95: $n + $t (bellen: $phone), then 3 × regular', ({ n, t, phone, regular }) => {
    const { offer, issues } = build(sel({ internetId: n, tvId: t, phone, contractMonths: 12, promotionIds: [W12] }), full())
    expect(issues.filter((i) => i.blocking)).toEqual([])
    const r = run12(offer!)
    expect(r.months.slice(0, 9).every((m) => m.newCents === 3495)).toBe(true)
    expect(r.months.slice(9, 12).every((m) => m.newCents === regular)).toBe(true)
    expect(r.newPeriodCents).toBe(9 * 3495 + 3 * regular)
  })

  it.each(combos)('6 × 50%: $n + $t (bellen: $phone), then 6 × regular', ({ n, t, phone, regular }) => {
    const { offer, issues } = build(sel({ internetId: n, tvId: t, phone, contractMonths: 12, promotionIds: [W50] }), full())
    expect(issues.filter((i) => i.blocking)).toEqual([])
    const half = Math.round(regular / 2)
    const r = run12(offer!)
    expect(r.months.slice(0, 6).every((m) => m.newCents === half)).toBe(true)
    expect(r.months.slice(6, 12).every((m) => m.newCents === regular)).toBe(true)
    expect(offer!.promoName).toBe('6 maanden 50% korting')
  })

  it('50% rounds to whole cents (half a cent rounds up)', () => {
    expect(percentPrice(8000, 50)).toBe(4000)
    expect(percentPrice(5995, 50)).toBe(2998)
    expect(percentPrice(7740, 50)).toBe(3870)
  })

  it('contract duration determines which promotions are available', () => {
    const c = cat()
    const usable = (m: 12 | 24) => c.promotions.filter((p) => p.channel === 'eigen' && !promotionBlockedReason(p, TODAY, m, true)).map((p) => p.id)
    expect(usable(24)).toEqual([W24, 'welkom-bol', 'welkom-samsung'])
    expect(usable(12)).toEqual([W12, W50])
    // Een 24-maandenactie telt niet mee bij 1 jaar en andersom.
    expect(build(sel({ contractMonths: 12, promotionIds: [W24] })).offer!.promoMonths).toBe(0)
    expect(build(sel({ contractMonths: 24, promotionIds: [W12] })).offer!.promoMonths).toBe(0)
    expect(build(sel({ contractMonths: 24, promotionIds: [W50] })).offer!.promoMonths).toBe(0)
  })

  it('older promotions without contractExact keep the minimum-duration rule', () => {
    const p = promo({ contractMonths: 12 })
    expect(promotionBlockedReason(p, TODAY, 24, false)).toBeNull()
    expect(promotionBlockedReason({ ...p, contractExact: true }, TODAY, 24, false)).toMatch(/12 maanden/)
  })
})

describe('calculation examples A, B and C (core € 80 + € 10 non-eligible extras)', () => {
  /** Kernabonnement van € 80 met een niet-kortingsgerechtigde extra van € 10. */
  const example = () => {
    const c = cat()
    c.prices = c.prices.map((p) => (p.internetId === 'net-200' && p.tvId === 'tv-start' && !p.phone ? { ...p, cents: 8000 } : p))
    c.extras = c.extras.map((e) => (e.id === 'x-zenders-plus' ? { ...e, monthlyCents: 1000 } : e))
    return c
  }
  const months = (s: Selection) => {
    const o = build(s, example())
    expect(o.issues.filter((i) => i.blocking)).toEqual([])
    return compare({ current: { ...emptyCurrent(), monthlyCents: 9000 }, offer: o.offer!, combo: emptyCombo(), period: s.contractMonths, startDate: TODAY }).months.slice(0, s.contractMonths).map((m) => m.newCents)
  }
  const base = (over: Partial<Selection>) => sel({ tvId: 'tv-start', extras: { 'x-zenders-plus': 1 }, ...over })

  it('A — 24 months: 12 × € 44,95 then 12 × € 90', () => {
    expect(months(base({ contractMonths: 24, promotionIds: [W24] }))).toEqual([...Array(12).fill(4495), ...Array(12).fill(9000)])
  })
  it('B — 12 months fixed price: 9 × € 44,95 then 3 × € 90', () => {
    expect(months(base({ contractMonths: 12, promotionIds: [W12] }))).toEqual([...Array(9).fill(4495), ...Array(3).fill(9000)])
  })
  it('C — 12 months 50%: 6 × € 50 then 6 × € 90', () => {
    expect(months(base({ contractMonths: 12, promotionIds: [W50] }))).toEqual([...Array(6).fill(5000), ...Array(6).fill(9000)])
  })
  it('50% never touches extra receivers, extra wifi hardware or one-time fees', () => {
    const c = example()
    c.activationCents = 2500
    const o = build(base({ contractMonths: 12, promotionIds: [W50], extras: { 'x-zenders-plus': 1, 'x-next-mini': 1, 'x-wifi-extender': 2 } }), c).offer!
    expect(o.promoMonthlyCents).toBe(4000)
    expect(o.extras.reduce((a, e) => a + e.monthlyCents, 0)).toBe(1000 + 600 + 500)
    expect(o.activationCents).toBe(2500)
  })
  it('services included in TV Max stay part of the package price', () => {
    const o = build(sel({ tvId: 'tv-max', contractMonths: 12, promotionIds: [W50], extras: { 'x-zst': 1 } })).offer!
    expect(o.promoMonthlyCents).toBe(percentPrice(7740, 50))
    expect(o.extras).toEqual([])
  })
})

describe('promotion update for saved settings', () => {
  it('retires the old € 35 offer, adds the new ones first and keeps everything else', () => {
    const old = cat()
    const legacy = { ...old.promotions.find((p) => p.id === W24)!, id: 'welkom-35', name: '12 maanden € 35 per maand', internalNotes: 'eigen notitie' }
    old.promotions = [legacy, ...old.promotions.filter((p) => ![W24, W12, W50].includes(p.id))]
    old.activationCents = 1995
    const mineExtra = { ...old.extras[0], id: 'mijn-extra' }
    old.extras.push(mineExtra)
    const up = applyPromotionUpdate(old, seedPricing(), REPLACED_PROMOTION_IDS, 'Vervangen.')
    expect(up.promotions.slice(0, 3).map((p) => p.id)).toEqual([W24, W12, W50])
    const retired = up.promotions.find((p) => p.id === 'welkom-35')!
    expect(retired.status).toBe('verlopen')
    expect(retired.internalNotes).toBe('Vervangen. eigen notitie')
    expect(up.activationCents).toBe(1995)
    expect(up.extras).toContainEqual(mineExtra)
    expect(up.prices).toEqual(old.prices)
    // Opnieuw uitvoeren verandert niets.
    expect(applyPromotionUpdate(up, seedPricing(), REPLACED_PROMOTION_IDS, 'Vervangen.')).toEqual(up)
  })
  it('a retired offer no longer counts in a calculation', () => {
    const c = applyPromotionUpdate(cat(), seedPricing(), ['welkom-bol'], '')
    expect(build(sel({ promotionIds: ['welkom-bol'] }), c).offer!.gift).toBeNull()
  })
})

describe('internet + vaste telefonie — eigen actiecategorie', () => {
  /** Catalogus met een gecontroleerde normale prijs voor Internet 200 + bellen. */
  const withPhonePromo = (over: Partial<Promotion> = {}): PricingCatalog => {
    const c = cat()
    c.prices = c.prices.map((p) => (p.internetId === 'net-200' && p.tvId === null && p.phone ? { ...p, cents: NET_PHONE, source: { url: null, verifiedOn: TODAY } } : p))
    c.promotions = c.promotions.map((p) => (p.id === W24 ? { ...p, ...over } : p))
    return c
  }
  const phoneSel = (over: Partial<Selection> = {}) => sel({ phone: true, promotionIds: [W24], ...over })

  it('applies the configured package price for internet + fixed telephony automatically', () => {
    const { offer, issues, lines } = build(phoneSel(), withPhonePromo())
    expect(issues.filter((i) => i.blocking)).toEqual([])
    expect([offer!.promoMonthlyCents, offer!.promoMonths, offer!.regularMonthlyCents]).toEqual([3495, 12, NET_PHONE])
    expect(offer!.includes).toContain('Vast bellen')
    expect(lines.map((l) => l.kind)).toEqual(['pakket', 'discount'])
    expect(run(offer!).new24Cents).toBe(12 * 3495 + 12 * NET_PHONE)
  })

  it('a separate internet + phone price never leaks into other categories', () => {
    const c = withPhonePromo()
    c.promotions = c.promotions.map((p) => (p.id === W24 ? { ...p, fixedPrices: { ...p.fixedPrices, [packageKey('net-200', null, true)]: 3000 } } : p))
    expect(build(phoneSel(), c).offer!.promoMonthlyCents).toBe(3000)
    expect(build(sel({ promotionIds: [W24] }), c).offer!.promoMonthlyCents).toBe(3495)
    expect(build(sel({ tvId: 'tv-start', phone: true, promotionIds: [W24] }), c).offer!.promoMonthlyCents).toBe(3495)
  })

  it('supports its own promotional duration per category', () => {
    const c = withPhonePromo({ categoryMonths: { internet_bellen: 6 } })
    expect(build(phoneSel(), c).offer!.promoMonths).toBe(6)
    expect(build(sel({ promotionIds: [W24] }), c).offer!.promoMonths).toBe(12)
    expect(build(sel({ tvId: 'tv-max', promotionIds: [W24] }), c).offer!.promoMonths).toBe(12)
    expect(run(build(phoneSel(), c).offer!).new24Cents).toBe(6 * 3495 + 18 * NET_PHONE)
  })

  it('category duration also applies to a monthly discount', () => {
    const c = withPhonePromo()
    c.promotions.push(promo({ id: 'korting', monthlyDiscountCents: 500, durationMonths: 12, categoryMonths: { internet_bellen: 3 } }))
    expect(build(sel({ phone: true, promotionIds: ['korting'] }), c).offer!.discounts[0].toMonth).toBe(3)
    expect(build(sel({ promotionIds: ['korting'] }), c).offer!.discounts[0].toMonth).toBe(12)
  })

  it('blocks with a clear message while the regular internet + phone price is missing', () => {
    const b = build(phoneSel(), cat()).issues.filter((i) => i.blocking)
    expect(b[0].message).toContain(CHECK_MESSAGE)
    expect(b[0].message).toContain('vaste telefonie')
  })

  it('older promotions without category settings keep their duration', () => {
    expect(promotionMonths(promo({ durationMonths: 9 }), 'internet_bellen')).toBe(9)
    expect(promotionMonths({ durationMonths: null }, 'internet')).toBeNull()
    expect(promotionMonths({ durationMonths: 12, categoryMonths: { internet_bellen: null } }, 'internet_bellen')).toBeNull()
  })

  it('maps package keys to the right category', () => {
    expect(packageCategory(null, false)).toBe('internet')
    expect(packageCategory('tv-start', false)).toBe('internet_tv')
    expect(packageCategory(null, true)).toBe('internet_bellen')
    expect(packageCategory('tv-max', true)).toBe('alles_in_1')
    const fp = cat().promotions.find((p) => p.id === W24)!.fixedPrices
    expect([keysInCategory(fp, 'internet'), keysInCategory(fp, 'internet_tv'), keysInCategory(fp, 'internet_bellen'), keysInCategory(fp, 'alles_in_1')].map((k) => k.length)).toEqual([4, 12, 4, 12])
  })

  it('price, duration and percentage survive export and import', () => {
    const c = withPhonePromo({ categoryMonths: { internet_bellen: 6 } })
    const back = parsePricingExport(JSON.parse(JSON.stringify({ app: 'overstapadvies', schemaVersion: 3, pricing: c })))
    expect(back.promotions.find((x) => x.id === W24)!.categoryMonths).toEqual({ internet_bellen: 6 })
    expect(back.promotions.find((x) => x.id === W50)!).toMatchObject({ percentDiscount: 50, contractExact: true })
    expect(build(phoneSel(), back).offer!.promoMonths).toBe(6)
  })

  it('rejects invalid category durations and percentages on import', () => {
    expect(() => parsePricingExport({ app: 'overstapadvies', schemaVersion: 3, pricing: withPhonePromo({ categoryMonths: { internet_bellen: -2 } }) })).toThrow(/actiemaanden/)
    expect(() => parsePricingExport({ app: 'overstapadvies', schemaVersion: 3, pricing: withPhonePromo({ percentDiscount: 150 }) })).toThrow(/percentage/)
  })

  it('customer view and saved snapshot carry the same totals', () => {
    const o = build(phoneSel(), withPhonePromo()).offer!
    const snapshot = JSON.parse(JSON.stringify(o)) as Offer
    const view = buildCustomerView({ current: { ...emptyCurrent(), monthlyCents: 6500 }, offer: snapshot, combo: emptyCombo(), period: 24, startDate: TODAY })
    expect(view.result.new24Cents).toBe(12 * 3495 + 12 * NET_PHONE)
    expect(view.result.totalSavingsCents).toBe(24 * 6500 - (12 * 3495 + 12 * NET_PHONE))
  })
})

describe('switching contract duration', () => {
  const c = cat()
  it('replaces the fixed-price welcome offer with the one for the new duration', () => {
    expect(promotionsForContract(c, [W24], 12, TODAY, true)).toEqual([W12])
    expect(promotionsForContract(c, [W12], 24, TODAY, true)).toEqual([W24])
    expect(promotionsForContract(c, [W50], 24, TODAY, true)).toEqual([W24])
  })
  it('drops a gift offer that does not exist for 12 months, without inventing a replacement', () => {
    expect(promotionsForContract(c, ['welkom-bol'], 12, TODAY, true)).toEqual([])
  })
  it('keeps what is still valid', () => {
    expect(promotionsForContract(c, [W50], 12, TODAY, true)).toEqual([W50])
    expect(promotionsForContract(c, [], 12, TODAY, true)).toEqual([])
  })
})

describe('Vodafone op dit adres', () => {
  const net = (id: string) => seedPricing().internet.find((i) => i.id === id)!
  it('uses the central amount per speed when switched on', () => {
    expect(vodafoneOn(true, net('net-1000'))).toEqual({ hasVodafone: true, eligible: true, monthlyDiscountCents: 750 })
    expect(vodafoneFor({ ...emptyCombo(), ...vodafoneOn(true, net('net-200')) }, net('net-2000')).monthlyDiscountCents).toBe(1000)
  })
  it('off removes the discount; unknown amount never invents one', () => {
    expect(vodafoneOn(false, net('net-1000'))).toEqual({ hasVodafone: false, eligible: false, monthlyDiscountCents: 0 })
    expect(vodafoneFor({ ...emptyCombo(), ...vodafoneOn(true, net('net-200')) }, net('net-4000')).monthlyDiscountCents).toBe(0)
    expect(vodafoneFor(emptyCombo(), net('net-1000'))).toEqual(emptyCombo())
  })
  it('is applied once, on top of the promotion, and disappears when switched off', () => {
    const o = build(sel({ internetId: 'net-1000', tvId: 'tv-start', promotionIds: [W24] })).offer!
    const on = run(o, 8000, { ...emptyCombo(), ...vodafoneOn(true, net('net-1000')) })
    const off = run(o, 8000, { ...emptyCombo(), ...vodafoneOn(false, net('net-1000')) })
    expect(off.new24Cents - on.new24Cents).toBe(24 * 750)
    expect(on.months[0].newCents).toBe(3495 - 750)
    expect(on.months[12].newCents).toBe(7140 - 750)
  })
})
