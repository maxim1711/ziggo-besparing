import { describe, expect, it } from 'vitest'
import { compare, currentMonthlyCost, newMonthlyCost, offerDiscountForMonth } from './calc'
import { emptyCombo, emptyCurrent, emptyOffer } from './defaults'
import { centsToInput, formatEuro, parseEuroToCents } from './money'
import { addMonths, startOfWeek } from './dates'
import { buildInsights, buildSummary } from './insights'
import { rankOptions } from './ranking'
import { estimateCommission } from './commission'
import { buildCustomerView } from './customerView'
import { annualEnergyCost, compareEnergy, type EnergyTariff } from './energy'
import type { ComparisonInput, CurrentSubscription, Offer } from './types'

const START = '2026-01-01'
const cur = (over: Partial<CurrentSubscription> = {}): CurrentSubscription => ({ ...emptyCurrent(), provider: 'KPN', monthlyCents: 6500, speedMbps: 100, ...over })
const offer = (over: Partial<Offer> = {}): Offer => ({
  ...emptyOffer(START),
  name: 'Test',
  validTo: '2026-12-31',
  promoMonthlyCents: 3495,
  promoMonths: 12,
  regularMonthlyCents: 7000,
  contractMonths: 12,
  ...over,
})
const input = (over: Partial<ComparisonInput> = {}): ComparisonInput => ({ current: cur(), offer: offer(), combo: emptyCombo(), period: 24, startDate: START, ...over })

describe('money', () => {
  it('parses Dutch and dotted notation without float errors', () => {
    expect(parseEuroToCents('34,95')).toBe(3495)
    expect(parseEuroToCents('34.95')).toBe(3495)
    expect(parseEuroToCents('€ 1.234,56')).toBe(123456)
    expect(parseEuroToCents('1.234')).toBe(123400)
    expect(parseEuroToCents('65')).toBe(6500)
    expect(parseEuroToCents('65,-')).toBe(6500)
    expect(parseEuroToCents('0,1')).toBe(10)
    expect(parseEuroToCents('19,99')).toBe(1999)
    expect(parseEuroToCents('-5,50')).toBe(-550)
    expect(parseEuroToCents('')).toBeNull()
    expect(parseEuroToCents('abc')).toBeNull()
    expect(parseEuroToCents('1,2,3')).toBeNull()
  })
  it('formats in nl-NL style', () => {
    expect(formatEuro(125940, { plainSpace: true })).toBe('€ 1.259,40')
    expect(formatEuro(156000, { plainSpace: true, decimals: 'auto' })).toBe('€ 1.560')
    expect(formatEuro(-7000, { plainSpace: true })).toBe('€ -70,00')
    expect(formatEuro(5, { plainSpace: true })).toBe('€ 0,05')
    expect(centsToInput(3495)).toBe('34,95')
  })
  it('0,10 + 0,20 is exactly 0,30 in cents', () => {
    expect(parseEuroToCents('0,10')! + parseEuroToCents('0,20')!).toBe(30)
  })
})

describe('dates', () => {
  it('adds months with end-of-month clamping', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15')
    expect(addMonths('2026-03-10', 0)).toBe('2026-03-10')
  })
  it('finds monday', () => {
    expect(startOfWeek('2026-11-14')).toBe('2026-11-09')
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09')
  })
})

describe('reference example from the specification', () => {
  const r = compare(input())
  it('current 24 months = € 1.560', () => expect(r.current24Cents).toBe(156000))
  it('new 24 months = 12 × 34,95 + 12 × 70 = € 1.259,40', () => expect(r.new24Cents).toBe(125940))
  it('total saving = € 300,60', () => expect(r.totalSavingsCents).toBe(30060))
  it('year 1 and year 2 split', () => {
    expect(r.current12Cents).toBe(78000)
    expect(r.new12Cents).toBe(41940)
    expect(r.year1SavingsCents).toBe(36060)
    expect(r.year2SavingsCents).toBe(-6000)
    expect(r.year1SavingsCents + r.year2SavingsCents).toBe(r.totalSavingsCents)
  })
  it('monthly promo advantage and average', () => {
    expect(r.monthlyPromoAdvantageCents).toBe(3005)
    expect(r.avgEffectiveMonthlyCents).toBe(5248) // 1259,40 / 24 = 52,475 → 52,48
  })
  it('promotion expires: month 12 promo, month 13 regular', () => {
    expect(r.months[11].newCents).toBe(3495)
    expect(r.months[12].newCents).toBe(7000)
    expect(r.priceIncreaseMonth).toBe(13)
    expect(r.priceAfterIncreaseCents).toBe(7000)
  })
  it('flags months after contract end as estimates', () => {
    expect(r.months[11].contractual).toBe(true)
    expect(r.months[12].contractual).toBe(false)
    expect(r.periodExceedsContract).toBe(true)
  })
  it('always produces 24 month rows whose cumulative ends at total', () => {
    expect(r.months).toHaveLength(24)
    expect(r.months[23].cumulativeSavingsCents).toBe(30060)
  })
})

describe('comparison period', () => {
  it('12-month period only counts first year', () => {
    const r = compare(input({ period: 12 }))
    expect(r.currentPeriodCents).toBe(78000)
    expect(r.newPeriodCents).toBe(41940)
    expect(r.totalSavingsCents).toBe(36060)
    expect(r.priceIncreaseMonth).toBeNull()
    expect(r.periodExceedsContract).toBe(false)
  })
  it('flags a contract longer than the period', () => {
    const r = compare(input({ period: 12, offer: offer({ contractMonths: 24 }) }))
    expect(r.contractExceedsPeriod).toBe(true)
  })
  it('promo shorter than a year', () => {
    const r = compare(input({ offer: offer({ promoMonths: 6 }) }))
    expect(r.new12Cents).toBe(6 * 3495 + 6 * 7000)
    expect(r.priceIncreaseMonth).toBe(7)
  })
  it('promoMonths 0 means regular price from month 1', () => {
    const r = compare(input({ offer: offer({ promoMonths: 0 }) }))
    expect(r.new24Cents).toBe(24 * 7000)
  })
})

describe('negative savings', () => {
  it('shows extra cost when the new offer is more expensive', () => {
    const r = compare(input({ current: cur({ monthlyCents: 4000 }), offer: offer({ promoMonthlyCents: 4500, regularMonthlyCents: 6000 }) }))
    expect(r.totalSavingsCents).toBe(24 * 4000 - (12 * 4500 + 12 * 6000))
    expect(r.totalSavingsCents).toBeLessThan(0)
    expect(r.year1SavingsCents).toBe(-6000)
    const ins = buildInsights(input({ current: cur({ monthlyCents: 4000 }), offer: offer({ promoMonthlyCents: 4500, regularMonthlyCents: 6000 }) }), r)
    expect(ins.find((i) => i.id === 'total')?.tone).toBe('negative')
    expect(ins.find((i) => i.id === 'total')?.text).toContain('duurder')
  })
  it('mentions higher speed only when it is actually higher', () => {
    const i1 = input({ current: cur({ monthlyCents: 3000, speedMbps: 100 }), offer: offer({ speedMbps: 1000 }) })
    expect(buildInsights(i1, compare(i1)).find((i) => i.id === 'total')?.text).toContain('hogere internetsnelheid')
    const i2 = input({ current: cur({ monthlyCents: 3000, speedMbps: 1000 }), offer: offer({ speedMbps: 200 }) })
    expect(buildInsights(i2, compare(i2)).find((i) => i.id === 'total')?.text).not.toContain('hogere internetsnelheid')
  })
})

describe('one-time fees', () => {
  const i = input({ current: cur({ cancellationCents: 5000 }), offer: offer({ activationCents: 2000, installationCents: 4995, equipmentCents: 1000 }) })
  const r = compare(i)
  it('adds all one-time costs once, in year 1', () => {
    expect(r.oneTime.totalCents).toBe(12995)
    expect(r.new12Cents).toBe(41940 + 12995)
    expect(r.new24Cents).toBe(125940 + 12995)
    expect(r.newRecurring24Cents).toBe(125940)
    expect(r.totalSavingsCents).toBe(30060 - 12995)
    expect(r.year2SavingsCents).toBe(-6000)
  })
  it('cumulative starts below zero', () => {
    expect(r.months[0].cumulativeSavingsCents).toBe(3005 - 12995)
    expect(r.months[23].cumulativeSavingsCents).toBe(r.totalSavingsCents)
  })
})

describe('offer discounts', () => {
  it('stacks independent discounts', () => {
    const o = offer({
      discounts: [
        { id: '1', label: 'a', monthlyCents: 500, fromMonth: 1, toMonth: 12, exclusiveGroup: null },
        { id: '2', label: 'b', monthlyCents: 250, fromMonth: 1, toMonth: null, exclusiveGroup: null },
      ],
    })
    expect(offerDiscountForMonth(o, 1)).toBe(750)
    expect(offerDiscountForMonth(o, 13)).toBe(250)
  })
  it('does not double-count overlapping discounts in the same group', () => {
    const o = offer({
      discounts: [
        { id: '1', label: 'welkom', monthlyCents: 500, fromMonth: 1, toMonth: 12, exclusiveGroup: 'Actie' },
        { id: '2', label: 'online', monthlyCents: 750, fromMonth: 7, toMonth: 18, exclusiveGroup: 'actie ' },
      ],
    })
    expect(offerDiscountForMonth(o, 1)).toBe(500)
    expect(offerDiscountForMonth(o, 7)).toBe(750) // overlap: only the highest
    expect(offerDiscountForMonth(o, 13)).toBe(750)
    expect(offerDiscountForMonth(o, 19)).toBe(0)
    const r = compare(input({ offer: o }))
    expect(r.newRecurring24Cents).toBe(125940 - (6 * 500 + 12 * 750))
  })
  it('never drives the subscription price below zero', () => {
    const o = offer({ promoMonthlyCents: 1000, discounts: [{ id: '1', label: 'x', monthlyCents: 5000, fromMonth: 1, toMonth: null, exclusiveGroup: null }] })
    expect(newMonthlyCost(o, emptyCombo(), 1).withCombo).toBe(0)
  })
  it('adds monthly extras on top', () => {
    const o = offer({ extras: [{ id: 'e', label: 'Sport', monthlyCents: 1495 }] })
    expect(newMonthlyCost(o, emptyCombo(), 1).withCombo).toBe(3495 + 1495)
  })
})

describe('current subscription over time', () => {
  it('raises the current price after a discount expires', () => {
    const c = cur({ discounts: [{ id: 'd', label: 'Loyaliteit', monthlyCents: 1000, endsOn: '2026-06-15' }] })
    expect(currentMonthlyCost(c, 6, START)).toBe(6500) // month starts 2026-06-01
    expect(currentMonthlyCost(c, 7, START)).toBe(7500) // month starts 2026-07-01
    const r = compare(input({ current: c }))
    expect(r.current24Cents).toBe(6 * 6500 + 18 * 7500)
  })
  it('keeps discounts without an end date', () => {
    const c = cur({ discounts: [{ id: 'd', label: 'x', monthlyCents: 1000, endsOn: null }] })
    expect(currentMonthlyCost(c, 24, START)).toBe(6500)
  })
  it('uses the expected future rate and does not also add expired discounts', () => {
    const c = cur({ futureMonthlyCents: 7200, futureFromMonth: 13, discounts: [{ id: 'd', label: 'x', monthlyCents: 1000, endsOn: '2026-03-01' }] })
    expect(currentMonthlyCost(c, 12, START)).toBe(7500)
    expect(currentMonthlyCost(c, 13, START)).toBe(7200)
  })
  it('adds current extras every month', () => {
    const r = compare(input({ current: cur({ extras: [{ id: 'e', label: 'ESPN', monthlyCents: 1000 }] }) }))
    expect(r.current24Cents).toBe(24 * 7500)
  })
  it('reports unknown current price instead of a saving', () => {
    const i = input({ current: cur({ monthlyCents: null }) })
    const r = compare(i)
    expect(r.currentKnown).toBe(false)
    const ins = buildInsights(i, r)
    expect(ins[0].id).toBe('unknown')
    expect(ins.some((x) => x.id === 'total')).toBe(false)
    expect(buildSummary(ins)).toContain('nog niet ingevuld')
  })
})

describe('Vodafone combination benefit', () => {
  const combo = { hasVodafone: true, eligible: true, monthlyDiscountCents: 500, extraBenefits: '' }
  it('is calculated separately', () => {
    const r = compare(input({ combo }))
    expect(r.comboSavingsPeriodCents).toBe(24 * 500)
    expect(r.totalSavingsCents).toBe(30060 + 12000)
    expect(r.totalSavingsWithoutComboCents).toBe(30060)
    expect(r.months[0].newWithoutComboCents - r.months[0].newCents).toBe(500)
  })
  it('is ignored unless the plan is confirmed eligible', () => {
    const r = compare(input({ combo: { ...combo, eligible: false } }))
    expect(r.comboSavingsPeriodCents).toBe(0)
    expect(r.totalSavingsCents).toBe(30060)
  })
  it('scales with a 12-month period', () => {
    expect(compare(input({ combo, period: 12 })).comboSavingsPeriodCents).toBe(6000)
  })
})

describe('gifts', () => {
  const gift = { type: 'televisie' as const, name: 'Tv', imageDataUrl: null, retailValueCents: 39900, description: '', conditions: '' }
  it('never reduces contractual costs', () => {
    const withGift = compare(input({ offer: offer({ gift }) }))
    const without = compare(input())
    expect(withGift.new24Cents).toBe(without.new24Cents)
    expect(withGift.totalSavingsCents).toBe(without.totalSavingsCents)
    expect(withGift.giftRetailValueCents).toBe(39900)
  })
})

describe('insights', () => {
  it('produces the expected facts for the reference example', () => {
    const i = input()
    const ins = buildInsights(i, compare(i))
    const text = ins.map((x) => x.text).join('\n')
    expect(text).toContain('€ 300,60 goedkoper')
    expect(text).toContain('Vanaf maand 13 stijgt het maandbedrag van € 34,95 naar € 70.')
    expect(text).toContain('schatting op basis van het reguliere tarief')
    expect(ins.find((x) => x.id === 'y2')?.tone).toBe('warning')
  })
  it('warns about a running contract', () => {
    const i = input({ current: cur({ contractEndDate: '2026-08-01' }) })
    expect(buildInsights(i, compare(i)).find((x) => x.id === 'contract-running')?.text).toContain('Controleer eventuele beëindigingskosten')
  })
  it('warns about expired and example offers', () => {
    const i = input({ offer: offer({ validTo: '2025-12-31', isExample: true }) })
    const ids = buildInsights(i, compare(i)).map((x) => x.id)
    expect(ids).toContain('expired')
    expect(ids).toContain('example')
  })
})

describe('ranking', () => {
  const mk = (o: Partial<Offer>) => {
    const of = offer(o)
    return { offer: of, result: compare(input({ offer: of })) }
  }
  it('explains every label with a criterion', () => {
    const opts = [mk({ contractMonths: 12 }), mk({ contractMonths: 24, promoMonths: 24, promoMonthlyCents: 4500 }), mk({ contractMonths: 24, promoMonths: 0, regularMonthlyCents: 6000, gift: { type: 'anders', name: 'x', imageDataUrl: null, retailValueCents: null, description: '', conditions: '' } })]
    const b = rankOptions(opts)
    expect(b[1].map((x) => x.id)).toContain('cheapest')
    expect(b[0].map((x) => x.id)).toContain('flexible')
    expect(b[0].map((x) => x.id)).toContain('cheapest-y1')
    expect(b[2].map((x) => x.id)).toContain('gift')
    b.flat().forEach((x) => expect(x.criterion.length).toBeGreaterThan(10))
  })
  it('gives no winner on a tie or a single option', () => {
    expect(rankOptions([mk({}), mk({})]).flat()).toHaveLength(0)
    expect(rankOptions([mk({})]).flat()).toHaveLength(0)
  })
})

describe('commission', () => {
  const s = { internetBaseCents: 4000, tvBonusCents: 1500, contract24BonusCents: 1000, vodafoneComboBonusCents: 500 }
  it('builds from configurable parts', () => {
    expect(estimateCommission({ kind: 'internet', contractMonths: 12 }, emptyCombo(), s).totalCents).toBe(4000)
    expect(estimateCommission({ kind: 'internet_tv', contractMonths: 24 }, { hasVodafone: true, eligible: true, monthlyDiscountCents: 500, extraBenefits: '' }, s).totalCents).toBe(7000)
  })
})

describe('customer view', () => {
  it('contains no advisor-only data', () => {
    const view = buildCustomerView(input({ offer: offer({ internalNotes: 'GEHEIM-MARGE' }) }))
    const json = JSON.stringify(view)
    expect(json).not.toContain('GEHEIM-MARGE')
    expect(json).not.toMatch(/internalNotes|commission|provisie|target/i)
  })
})

describe('energy module (prepared)', () => {
  const t: EnergyTariff = {
    supplier: 'A', contractMonths: 12, meter: 'dubbel',
    electricityNormalPerKwh: 12000, electricityOffPeakPerKwh: 10000, gasPerM3: 50000,
    feedInCompensationPerKwh: 5000, feedInChargePerKwh: 11000,
    energyTaxElectricityPerKwh: 11000, energyTaxGasPerM3: 70000,
    fixedDeliveryPerYearCents: 9000, networkChargesPerYearCents: 60000, taxReductionPerYearCents: 62000, oneTimeIncentiveCents: 10000,
  }
  const p = { electricityNormalKwh: 1500, electricityOffPeakKwh: 1000, gasM3: 1000, solarFeedInKwh: 500 }
  it('computes annual cost from consumption, not from an advance payment', () => {
    const a = annualEnergyCost(p, t)
    expect(a.electricitySupplyCents).toBe(28000)
    expect(a.gasSupplyCents).toBe(50000)
    expect(a.energyTaxCents).toBe(27500 + 70000)
    expect(a.feedInNetCents).toBe(3000)
    expect(a.totalPerYearCents).toBe(28000 + 50000 + 97500 + 3000 + 69000 - 62000)
    expect(a.firstYearCents).toBe(a.totalPerYearCents - 10000)
  })
  it('compares two tariffs on the same profile', () => {
    const r = compareEnergy(p, t, { ...t, gasPerM3: 45000, oneTimeIncentiveCents: 0 })
    expect(r.annualSavingsCents).toBe(5000)
    expect(r.firstYearSavingsCents).toBe(-5000)
  })
})
