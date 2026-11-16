import { describe, expect, it } from 'vitest'
import { blankOffer, compareEnergyOffer, defaultRegulatory, duplicateOffer, emptyRates, exampleOffer, formatRate, offerBlockedReason, parseRate, rateToInput, rulesFor, saveOfferVersion, sideCost, validateOffer, type CurrentEnergy, type EnergyOffer, type RegulatoryYear, type TariffRates, type Usage } from './essent'
import { csvToOffers, draftToOffer, jsonToOffers, mergeImported, offersToCsv, parseTariffText } from './essentImport'

/**
 * Alle tarieven in dit bestand zijn VERZONNEN rekenvoorbeelden,
 * gekozen om makkelijk na te rekenen. Het zijn geen actuele Essent-prijzen.
 */
const TODAY = '2026-11-16'
const NOW = '2026-11-16T10:00:00.000Z'
const usage = (over: Partial<Usage> = {}): Usage => ({ electricityKwh: 2500, meter: 'enkel', peakKwh: null, offPeakKwh: null, gasM3: 1200, feedInKwh: 0, ...over })
const rates = (over: Partial<TariffRates> = {}): TariffRates => ({ ...emptyRates(), electricitySingle: 25000, gas: 125000, fixedElectricityMonthlyCents: 899, fixedGasMonthlyCents: 899, ...over })
const reg = (over: Partial<RegulatoryYear> = {}): RegulatoryYear => ({ ...defaultRegulatory()[0], ...over })
const offer = (over: Partial<EnergyOffer> = {}): EnergyOffer => ({ ...blankOffer('o1', NOW), name: 'Voorbeeld 1 jaar vast', status: 'gecontroleerd', verifiedOn: TODAY, rates: rates(), ...over })
const current = (over: Partial<CurrentEnergy> = {}): CurrentEnergy => ({ supplier: 'Voorbeeldleverancier', mode: 'tarieven', rates: rates({ electricitySingle: 30000, gas: 140000, fixedElectricityMonthlyCents: 900, fixedGasMonthlyCents: 900 }), annualCostCents: null, contractType: 'variabel', contractEndDate: null, terminationCents: 0, ...over })
const run = (o: Partial<Parameters<typeof compareEnergyOffer>[0]> = {}) => compareEnergyOffer({ usage: usage(), current: current(), offer: offer(), reg: reg(), today: TODAY, ...o })
const cost = (u: Usage, r: TariffRates, g = reg()) => sideCost(u, r, g, 'Essent').cost!

describe('rates: decimal-safe parsing and formatting', () => {
  it('parses up to five decimals without floats', () => {
    expect(parseRate('0,24531')).toBe(24531)
    expect(parseRate('€ 0.25')).toBe(25000)
    expect(parseRate('1,4')).toBe(140000)
    expect(parseRate('0')).toBe(0)
    expect(parseRate('0,123456')).toBeNull()
    expect(parseRate('abc')).toBeNull()
    expect(parseRate('')).toBeNull()
  })
  it('formats with 3–5 decimals', () => {
    expect(rateToInput(24531)).toBe('0,24531')
    expect(rateToInput(25000)).toBe('0,250')
    expect(rateToInput(125000)).toBe('1,250')
    expect(formatRate(11500)).toBe('€ 0,115')
    expect(rateToInput(null)).toBe('')
  })
  it('2.500 kWh × € 0,24531 is exact', () => {
    expect(cost(usage({ gasM3: 0 }), rates({ electricitySingle: 24531 })).electricityCents).toBe(61328) // 613,275 → 613,28
  })
})

describe('electricity, gas and fixed delivery costs', () => {
  const c = cost(usage(), rates())
  it('electricity 2.500 × 0,25 = € 625', () => expect(c.electricityCents).toBe(62500))
  it('gas 1.200 × 1,25 = € 1.500', () => expect(c.gasCents).toBe(150000))
  it('fixed 12 × (8,99 + 8,99) = € 215,76', () => expect(c.fixedCents).toBe(21576))
  it('supplier total', () => expect(c.supplierYearCents).toBe(62500 + 150000 + 21576))
  it('no gas connection: no gas costs and no gas fixed fee', () => {
    const e = cost(usage({ gasM3: 0 }), rates({ gas: null, fixedGasMonthlyCents: null }))
    expect(e.gasCents).toBe(0)
    expect(e.fixedCents).toBe(12 * 899)
  })
})

describe('single and dual tariffs', () => {
  const dual = usage({ meter: 'dubbel', peakKwh: 1500, offPeakKwh: 1000 })
  it('dual meter uses peak and off-peak rates', () => {
    expect(cost(dual, rates({ electricityPeak: 26000, electricityOffPeak: 24000 })).electricityCents).toBe(1500 * 26 + 1000 * 24)
  })
  it('dual meter with a single-rate contract uses the single rate', () => {
    expect(cost(dual, rates()).electricityCents).toBe(62500)
  })
  it('single meter cannot use a peak/off-peak-only tariff', () => {
    const r = sideCost(usage(), rates({ electricitySingle: null, electricityPeak: 26000, electricityOffPeak: 24000 }), reg(), 'Essent')
    expect(r.cost).toBeNull()
    expect(r.missing[0]).toContain('meter is enkel')
  })
  it('dual meter needs the peak/off-peak split', () => {
    expect(sideCost(usage({ meter: 'dubbel' }), rates(), reg(), 'Essent').missing).toContain('Verbruik normaal en dal ontbreekt.')
  })
})

describe('VAT and energy tax — never double-counted', () => {
  const tax = reg({ energyTaxElectricity: 10000, energyTaxGas: 50000 })
  it('all-in rates: nothing is added', () => {
    const c = cost(usage(), rates(), tax)
    expect(c.energyTaxCents).toBe(0)
    expect(c.supplierYearCents).toBe(234076)
  })
  it('rates excl. VAT but incl. energy tax: × 1,21', () => {
    const c = cost(usage(), rates({ includesVat: false }), tax)
    expect(c.electricityCents).toBe(75625)
    expect(c.gasCents).toBe(181500)
    expect(c.fixedCents).toBe(26107) // 215,76 × 1,21 = 261,0696
    expect(c.energyTaxCents).toBe(0)
  })
  it('rates incl. VAT but excl. energy tax: tax added once, with VAT', () => {
    const c = cost(usage(), rates({ includesEnergyTax: false }), tax)
    expect(c.electricityCents).toBe(62500)
    expect(c.energyTaxCents).toBe(102850) // (2.500 × 0,10 + 1.200 × 0,50) × 1,21
    expect(c.supplierYearCents).toBe(234076 + 102850)
  })
  it('bare rates (excl. both)', () => {
    const c = cost(usage(), rates({ includesVat: false, includesEnergyTax: false }), tax)
    expect(c.electricityCents + c.gasCents).toBe(257125) // 2.125 × 1,21
    expect(c.energyTaxCents).toBe(102850)
  })
  it('equivalent tariffs on different bases give the same total', () => {
    // all-in 0,25 ≙ kaal (0,25 / 1,21 − 0,10): hier omgekeerd opgebouwd om exact te blijven
    const bare = rates({ electricitySingle: 10000, gas: 50000, fixedElectricityMonthlyCents: 1000, fixedGasMonthlyCents: 1000, includesVat: false, includesEnergyTax: false })
    const allIn = rates({ electricitySingle: 24200, gas: 121000, fixedElectricityMonthlyCents: 1210, fixedGasMonthlyCents: 1210 })
    expect(cost(usage(), bare, tax).supplierYearCents).toBe(cost(usage(), allIn, tax).supplierYearCents)
  })
  it('missing energy tax is reported, only when it is needed', () => {
    expect(sideCost(usage(), rates(), reg(), 'Essent').missing).toEqual([])
    const m = sideCost(usage(), rates({ includesEnergyTax: false }), reg(), 'Essent').missing
    expect(m).toHaveLength(2)
    expect(m[0]).toContain('Energiebelasting stroom 2026 is niet ingevuld')
  })
  it('a different VAT rate comes from the yearly configuration', () => {
    expect(cost(usage({ gasM3: 0 }), rates({ includesVat: false }), reg({ vatBp: 900 })).electricityCents).toBe(68125)
  })
})

describe('network costs and tax reduction', () => {
  const full = reg({ networkElectricityYearCents: 30000, networkGasYearCents: 20000, taxReductionYearCents: 60000 })
  it('without them the comparison is on supplier costs and says so', () => {
    const r = run()
    expect(r.basis).toBe('leverancier')
    expect(r.essent!.totalYearCents).toBe(234076)
    expect(r.notes.join(' ')).toContain('Netbeheerkosten en de vermindering energiebelasting zijn niet meegeteld')
  })
  it('with them both sides include network costs and the reduction', () => {
    const r = run({ reg: full })
    expect(r.basis).toBe('volledig')
    expect(r.essent!.totalYearCents).toBe(234076 + 50000 - 60000)
    expect(r.currentYearCents).toBe(264600 + 50000 - 60000)
  })
  it('they are identical for both suppliers, so the saving does not change', () => {
    expect(run({ reg: full }).yearlySavingsCents).toBe(run().yearlySavingsCents)
  })
  it('no gas: gas network costs are not charged', () => {
    const r = run({ reg: { ...full, networkGasYearCents: null }, usage: usage({ gasM3: 0 }) })
    expect(r.basis).toBe('volledig')
    expect(r.essent!.networkCents).toBe(30000)
  })
})

describe('comparison, bonuses and negative savings', () => {
  it('yearly saving with identical usage', () => {
    const r = run()
    expect(r.currentYearCents).toBe(75000 + 168000 + 21600)
    expect(r.yearlySavingsCents).toBe(264600 - 234076)
    expect(r.monthlyEquivalentCents).toBe(2544) // 305,24 / 12 = 25,4367
    expect(r.blocked).toBe(false)
  })
  it('welcome bonus is one-time and kept out of the yearly figure', () => {
    const r = run({ offer: offer({ welcomeBonusCents: 20000, bonusConditions: 'na 12 maanden' }) })
    expect(r.yearlySavingsCents).toBe(30524)
    expect(r.oneTimeCents).toBe(20000)
    expect(r.firstYearSavingsCents).toBe(50524)
    expect(r.notes.join(' ')).toContain('Voorwaarden: na 12 maanden')
  })
  it('yearly discount lowers yearly costs; one-time discount and termination costs are one-time', () => {
    const r = run({ offer: offer({ discounts: [{ id: 'a', label: 'Korting', amountCents: 5000, kind: 'jaarlijks' }, { id: 'b', label: 'Actie', amountCents: 2500, kind: 'eenmalig' }] }), current: current({ terminationCents: 10000 }) })
    expect(r.essent!.yearlyDiscountCents).toBe(5000)
    expect(r.yearlySavingsCents).toBe(30524 + 5000)
    expect(r.oneTimeCents).toBe(2500 - 10000)
  })
  it('negative savings when Essent costs more', () => {
    const r = run({ current: current({ rates: rates({ electricitySingle: 20000, gas: 100000 }) }) })
    expect(r.yearlySavingsCents).toBe(50000 + 120000 - 62500 - 150000)
    expect(r.yearlySavingsCents).toBeLessThan(0)
    expect(r.monthlyEquivalentCents).toBeLessThan(0)
  })
  it('variable and dynamic contracts are marked as projections, not guarantees', () => {
    expect(run({ offer: offer({ contractType: 'dynamisch' }) }).notes.join(' ')).toContain('geen prijsgarantie')
    expect(run().notes.join(' ')).toContain('staan 12 maanden vast')
    expect(run().notes.join(' ')).toContain('Uw huidige tarieven zijn variabel')
  })
  it('warns about a running contract', () => {
    expect(run({ current: current({ contractEndDate: '2027-03-01' }) }).issues.some((i) => !i.blocking && i.message.includes('opzegvergoeding'))).toBe(true)
  })
})

describe('current costs from an annual statement', () => {
  const full = reg({ networkElectricityYearCents: 30000, networkGasYearCents: 20000, taxReductionYearCents: 60000 })
  it('compares on the full basis and labels it an estimate', () => {
    const r = run({ current: current({ mode: 'jaarbedrag', annualCostCents: 280000 }), reg: full })
    expect(r.basis).toBe('volledig')
    expect(r.yearlySavingsCents).toBe(280000 - (234076 - 10000))
    expect(r.notes[0]).toContain('schatting')
  })
  it('refuses to compare a statement total against supplier-only costs', () => {
    const r = run({ current: current({ mode: 'jaarbedrag', annualCostCents: 280000 }) })
    expect(r.blocked).toBe(true)
    expect(r.yearlySavingsCents).toBeNull()
    expect(r.issues[0].message).toContain('netbeheerkosten')
  })
  it('needs the amount itself', () => {
    expect(run({ current: current({ mode: 'jaarbedrag' }), reg: full }).issues[0].message).toContain('jaarbedrag')
  })
  it('has no monthly-advance input anywhere', () => {
    expect(JSON.stringify([current(), usage(), offer()])).not.toMatch(/voorschot|advance|termijn/i)
  })
})

describe('solar feed-in and the end of net metering', () => {
  const solar = rates({ feedInFeePerKwh: 11500, feedInCompensationPerKwh: 6000 })
  it('2026 — net metering: feed-in is offset against offtake', () => {
    const c = cost(usage({ feedInKwh: 1000, gasM3: 0 }), solar)
    expect(c.billedKwh).toBe(1500)
    expect(c.electricityCents).toBe(37500)
    expect(c.feedInFeeCents).toBe(11500)
    expect(c.feedInCompensationCents).toBe(0)
  })
  it('2026 — surplus beyond offtake gets the feed-in compensation', () => {
    const c = cost(usage({ feedInKwh: 3000, gasM3: 0 }), solar)
    expect(c.billedKwh).toBe(0)
    expect(c.compensatedKwh).toBe(500)
    expect(c.feedInCompensationCents).toBe(3000)
    expect(c.feedInFeeCents).toBe(34500)
    expect(c.supplierYearCents).toBe(34500 - 3000 + 12 * 899)
  })
  it('2027 — no net metering: all offtake billed, all feed-in compensated', () => {
    const c = cost(usage({ feedInKwh: 1000, gasM3: 0 }), solar, defaultRegulatory()[1])
    expect(c.billedKwh).toBe(2500)
    expect(c.electricityCents).toBe(62500)
    expect(c.feedInCompensationCents).toBe(6000)
    expect(c.feedInFeeCents).toBe(11500)
  })
  it('the regime is configuration, not code', () => {
    const years = defaultRegulatory()
    expect(years.map((y) => [y.year, y.netting])).toEqual([[2026, 'salderen'], [2027, 'geen']])
    expect(rulesFor(years, 2026)!.year).toBe(2026)
    expect(rulesFor(years, 2029)!.year).toBe(2027)
    expect(rulesFor(years, 2020)!.year).toBe(2026)
    years[1].netting = 'salderen'
    expect(cost(usage({ feedInKwh: 1000, gasM3: 0 }), solar, years[1]).billedKwh).toBe(1500)
  })
  it('net metering scales peak and off-peak proportionally', () => {
    const c = cost(usage({ meter: 'dubbel', peakKwh: 1500, offPeakKwh: 1000, feedInKwh: 500, gasM3: 0 }), rates({ ...solar, electricityPeak: 26000, electricityOffPeak: 24000 }))
    expect(c.electricityCents).toBe(1200 * 26 + 800 * 24)
  })
  it('feed-in fee and compensation must be known when there is feed-in', () => {
    const m = sideCost(usage({ feedInKwh: 3000 }), rates(), reg(), 'Essent').missing
    expect(m).toEqual(['Terugleverkosten van Essent ontbreken (vul 0 in als er geen zijn).', 'Terugleververgoeding van Essent ontbreekt.'])
  })
  it('explains which rules were used', () => {
    const o = offer({ rates: solar })
    const c = current({ rates: { ...current().rates, feedInFeePerKwh: 0, feedInCompensationPerKwh: 5000 } })
    expect(run({ usage: usage({ feedInKwh: 500 }), offer: o, current: c }).notes.join(' ')).toContain('Vanaf 2027 vervalt salderen')
    expect(run({ usage: usage({ feedInKwh: 500 }), offer: o, current: c, reg: defaultRegulatory()[1] }).notes.join(' ')).toContain('zonder salderen')
  })
})

describe('expired, concept and incomplete offers are never presented', () => {
  it('blocks expired offers', () => {
    for (const o of [offer({ validTo: '2026-11-15' }), offer({ status: 'verlopen' })]) {
      const r = run({ offer: o })
      expect(r.blocked).toBe(true)
      expect(r.yearlySavingsCents).toBeNull()
      expect(r.essent).toBeNull()
      expect(r.issues[0].message).toBe('Dit aanbod is verlopen.')
    }
    expect(offerBlockedReason(offer({ validTo: TODAY }), TODAY)).toBeNull()
  })
  it('blocks concepts and offers that are not yet valid', () => {
    expect(run({ offer: offer({ status: 'concept' }) }).issues[0].message).toContain('concept')
    expect(run({ offer: offer({ validFrom: '2026-12-01' }) }).issues[0].message).toContain('nog niet geldig')
  })
  it('the bundled example is a concept and flagged as invented', () => {
    const ex = exampleOffer(NOW)
    expect(ex.status).toBe('concept')
    expect(ex.isExample).toBe(true)
    expect(ex.internalNotes).toContain('GEEN actueel Essent-tarief')
    expect(run({ offer: ex }).blocked).toBe(true)
  })
  it('lists exactly what is missing instead of guessing', () => {
    const r = run({ usage: usage({ electricityKwh: null, gasM3: null }), offer: offer({ rates: emptyRates() }), current: current({ rates: emptyRates() }) })
    expect(r.blocked).toBe(true)
    const text = r.issues.map((i) => i.message).join('|')
    expect(text).toContain('Stroomverbruik per jaar ontbreekt.')
    expect(text).toContain('Stroomtarief van Essent ontbreekt.')
    expect(text).toContain('Stroomtarief van Voorbeeldleverancier ontbreekt.')
    expect(text).toContain('Vaste leveringskosten stroom van Essent ontbreken.')
  })
  it('missing gas rate only matters with gas usage', () => {
    expect(run({ offer: offer({ rates: rates({ gas: null }) }) }).issues[0].message).toBe('Gastarief van Essent ontbreekt.')
    expect(run({ usage: usage({ gasM3: 0 }), offer: offer({ rates: rates({ gas: null, fixedGasMonthlyCents: null }) }) }).blocked).toBe(false)
  })
})

describe('validation of units and amounts', () => {
  it('accepts a complete offer', () => expect(validateOffer(offer())).toEqual([]))
  it('catches cents entered as euros and yearly amounts entered as monthly', () => {
    expect(validateOffer(offer({ rates: rates({ electricitySingle: 2500000 }) })).join(' ')).toContain('controleer de eenheid')
    expect(validateOffer(offer({ rates: rates({ gas: 12500000 }) })).join(' ')).toMatch(/ongeldig tarief|eenheid/)
    expect(validateOffer(offer({ rates: rates({ fixedElectricityMonthlyCents: 10788 }) })).join(' ')).toContain('jaarbedrag')
  })
  it('rejects non-integer, negative and half-filled values', () => {
    expect(validateOffer(offer({ rates: rates({ electricitySingle: 0.25 as number }) }))).not.toEqual([])
    expect(validateOffer(offer({ welcomeBonusCents: -1 }))).not.toEqual([])
    expect(validateOffer(offer({ rates: rates({ electricityPeak: 26000 }) })).join(' ')).toContain('normaal- én daltarief')
    expect(validateOffer(offer({ validFrom: '2026-12-01', validTo: '2026-11-01' })).join(' ')).toContain('einddatum')
    expect(validateOffer(offer({ name: ' ' }))).toContain('Naam ontbreekt.')
  })
  it('a verified offer needs rates and a verification date', () => {
    expect(validateOffer(offer({ verifiedOn: null })).join(' ')).toContain('controledatum')
    expect(validateOffer(offer({ rates: emptyRates() })).length).toBeGreaterThanOrEqual(2)
    expect(validateOffer(offer({ status: 'concept', rates: emptyRates(), verifiedOn: null }))).toEqual([])
  })
})

describe('versioning', () => {
  it('each change creates a new version and keeps the previous one', () => {
    const v1 = offer()
    const step = saveOfferVersion([v1], [], { ...v1, rates: rates({ electricitySingle: 26000 }) }, '2026-12-01T09:00:00.000Z')
    expect(step.offers[0]).toMatchObject({ version: 2, updatedAt: '2026-12-01T09:00:00.000Z', createdAt: NOW })
    expect(step.history).toHaveLength(1)
    expect(step.history[0].rates.electricitySingle).toBe(25000)
    expect(step.history[0].version).toBe(1)
    const again = saveOfferVersion(step.offers, step.history, { ...step.offers[0], welcomeBonusCents: 5000 }, NOW)
    expect(again.offers[0].version).toBe(3)
    expect(again.history.map((h) => h.version)).toEqual([1, 2])
  })
  it('saving without changes, or only starring, does not create a version', () => {
    const v1 = offer()
    expect(saveOfferVersion([v1], [], { ...v1 }, 'later').history).toEqual([])
    const fav = saveOfferVersion([v1], [], { ...v1, favorite: true }, 'later')
    expect(fav.offers[0]).toMatchObject({ version: 1, favorite: true, updatedAt: NOW })
    expect(fav.history).toEqual([])
  })
  it('a new offer starts at version 1', () => {
    expect(saveOfferVersion([], [], offer({ version: 9 }), NOW).offers[0].version).toBe(1)
  })
  it('"nieuwe actie op basis van huidige" copies the rates as an unverified concept', () => {
    const d = duplicateOffer(offer({ validTo: '2026-12-31', favorite: true }), 'o2', '2027-01-02T08:00:00.000Z')
    expect(d).toMatchObject({ id: 'o2', version: 1, status: 'concept', validFrom: null, validTo: null, verifiedOn: null, favorite: false })
    expect(d.rates).toEqual(rates())
    d.rates.gas = 1
    expect(offer().rates.gas).toBe(125000)
  })
})

describe('saved comparisons keep an immutable tariff snapshot', () => {
  it('editing the offer afterwards does not change the saved result', () => {
    const live = offer()
    const saved = structuredClone({ usage: usage(), current: current(), offer: live, reg: reg(), today: TODAY })
    const before = compareEnergyOffer(saved).yearlySavingsCents
    live.rates.electricitySingle = 99000
    live.status = 'verlopen'
    expect(compareEnergyOffer(saved).yearlySavingsCents).toBe(before)
    expect(saved.offer.rates.electricitySingle).toBe(25000)
    expect(compareEnergyOffer({ ...saved, offer: live }).blocked).toBe(true)
  })
})

describe('paste parser — deterministic, with sources', () => {
  const text = `Essent actie november — 1 jaar vast
Stroom enkel: € 0,24531 per kWh
Stroom normaal: 0,25612
Stroom dal: 0,23455
Gas: € 1,23456 per m3
Vaste leveringskosten stroom: € 8,99 per maand
Vaste leveringskosten gas € 0,29556 per dag
Welkomstbonus € 200
Terugleverkosten: 11,5 ct per kWh
Terugleververgoeding: € 0,06
Tarieven inclusief btw en energiebelasting
Geldig t/m 30-11-2026
Bel 0800 1234 voor vragen`
  const d = parseTariffText(text)
  const get = (k: string) => d.fields.find((f) => f.key === k)
  it('extracts every recognisable value', () => {
    expect(get('electricitySingle')!.value).toBe(24531)
    expect(get('electricityPeak')!.value).toBe(25612)
    expect(get('electricityOffPeak')!.value).toBe(23455)
    expect(get('gas')!.value).toBe(123456)
    expect(get('fixedElectricityMonthlyCents')!.value).toBe(899)
    expect(get('welcomeBonusCents')!.value).toBe(20000)
    expect(get('feedInCompensationPerKwh')!.value).toBe(6000)
    expect(get('contractMonths')!.value).toBe(12)
    expect(get('contractType')!.value).toBe('vast')
    expect(get('validTo')!.value).toBe('2026-11-30')
    expect(get('includesVat')!.value).toBe(true)
    expect(get('includesEnergyTax')!.value).toBe(true)
    expect(d.missing).toEqual([])
    expect(d.conflicts).toEqual([])
  })
  it('keeps the source line for every value', () => {
    expect(get('gas')!.source).toBe('Gas: € 1,23456 per m3')
    for (const f of d.fields) expect(text).toContain(f.source.split(' : ')[0].slice(0, 12))
  })
  it('converts units explicitly and says so', () => {
    expect(get('feedInFeePerKwh')).toMatchObject({ value: 11500, warning: 'Omgerekend van centen naar euro.' })
    expect(get('fixedGasMonthlyCents')).toMatchObject({ value: 899, warning: expect.stringContaining('per dag') }) // 0,29556 × 365 ÷ 12 = 8,99
  })
  it('flags conflicting values instead of choosing silently', () => {
    const c = parseTariffText('Gas: 1,20\nGas per m3: 1,35')
    expect(c.fields.find((f) => f.key === 'gas')!.value).toBe(120000)
    expect(c.conflicts[0]).toContain('€ 1,200')
    expect(c.conflicts[0]).toContain('€ 1,350')
  })
  it('reports what is missing and never invents it', () => {
    const m = parseTariffText('Stroom 0,25 per kWh')
    expect(m.fields.map((f) => f.key)).toEqual(['electricitySingle'])
    expect(m.missing).toEqual(['Gastarief', 'Vaste leveringskosten stroom', 'Vaste leveringskosten gas', expect.stringContaining('inclusief btw'), expect.stringContaining('energiebelasting'), 'Einddatum van de actie'])
  })
  it('lists amounts it could not place', () => {
    expect(parseTariffText('Iets anders: € 12,50').unrecognized).toEqual(['Iets anders: € 12,50'])
    expect(parseTariffText('').fields).toEqual([])
  })
  it('reads spreadsheet rows (tab-separated) and excl. flags', () => {
    const s = parseTariffText('Stroom enkel\t0,21\nGas\t1,10\nPrijzen exclusief btw\nExcl. energiebelasting')
    expect(s.fields.find((f) => f.key === 'electricitySingle')!.value).toBe(21000)
    expect(s.fields.find((f) => f.key === 'includesVat')!.value).toBe(false)
    expect(s.fields.find((f) => f.key === 'includesEnergyTax')!.value).toBe(false)
  })
  it('creates a concept that still needs explicit verification', () => {
    const o = draftToOffer(d, 'p1', NOW, 'Actie november')
    expect(o).toMatchObject({ status: 'concept', verifiedOn: null, contractMonths: 12, validTo: '2026-11-30', welcomeBonusCents: 20000 })
    expect(o.rates).toMatchObject({ electricitySingle: 24531, gas: 123456, fixedElectricityMonthlyCents: 899, fixedGasMonthlyCents: 899, feedInFeePerKwh: 11500 })
    expect(offerBlockedReason(o, TODAY)).toContain('concept')
  })
})

describe('CSV and JSON import/export', () => {
  const a = offer({ name: 'Actie; met "leestekens"', campaign: 'November', welcomeBonusCents: 20000, validTo: '2026-11-30', rates: rates({ electricityPeak: 26000, electricityOffPeak: 24000, feedInFeePerKwh: 11500, feedInCompensationPerKwh: 6000 }), eligibility: 'Nieuwe klanten', internalNotes: 'regel 1\nregel 2' })
  let n = 0
  const id = () => `new-${++n}`
  it('round-trips through CSV', () => {
    const r = csvToOffers(offersToCsv([a]), id, NOW)
    expect(r.errors).toEqual([])
    expect(r.offers[0]).toMatchObject({ id: 'o1', name: a.name, campaign: 'November', status: 'gecontroleerd', welcomeBonusCents: 20000, validTo: '2026-11-30', internalNotes: 'regel 1\nregel 2' })
    expect(r.offers[0].rates).toEqual(a.rates)
  })
  it('validates every row and skips only the bad ones', () => {
    const csv = offersToCsv([a, offer({ id: 'o2', name: 'Goed' })]).replace('0,250;0,260', 'kapot;0,260')
    const r = csvToOffers(csv, id, NOW)
    expect(r.offers.map((o) => o.name)).toEqual(['Goed'])
    expect(r.errors[0]).toContain('Regel 2')
    expect(r.errors[0]).toContain('geen geldig tarief')
  })
  it('accepts comma-separated files and rejects unknown formats', () => {
    expect(csvToOffers('naam,stroom_enkel,vast_stroom_maand,incl_btw,incl_energiebelasting\nBulk,"0,22","7,50",ja,ja', id, NOW).offers[0]).toMatchObject({ name: 'Bulk', status: 'concept', rates: { electricitySingle: 22000, fixedElectricityMonthlyCents: 750 } })
    expect(csvToOffers('a;b\n1;2', id, NOW).errors[0]).toContain('naam')
    expect(csvToOffers('naam;incl_btw;incl_energiebelasting\nX;misschien;ja', id, NOW).errors[0]).toContain('ja of nee')
  })
  it('validates JSON', () => {
    expect(jsonToOffers({ app: 'overstapadvies', offers: [a] }).offers).toEqual([a])
    expect(jsonToOffers({ app: 'overstapadvies', offers: [a, { ...a, rates: { ...a.rates, gas: -5 } }, null] }).errors).toHaveLength(2)
    expect(jsonToOffers({ foo: 1 }).errors[0]).toContain('geen Essent-tarievenbestand')
  })
  it('importing preserves existing offers', () => {
    const existing = [offer({ name: 'Bestaand' })]
    const merged = mergeImported(existing, [offer({ name: 'Andere inhoud, zelfde id' }), offer({ id: 'o9', name: 'Nieuw' }), offer({ name: 'Bestaand', favorite: true })], id)
    expect(merged.map((o) => o.name)).toEqual(['Bestaand', 'Andere inhoud, zelfde id (import)', 'Nieuw'])
    expect(merged[0]).toBe(existing[0])
    expect(merged[1].id).not.toBe('o1')
  })
})
