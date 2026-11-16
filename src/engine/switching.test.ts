import { describe, expect, it } from 'vitest'
import { compare } from './calc'
import { emptyCombo, emptyCurrent, emptyOffer } from './defaults'
import { composeOffer, emptySelection } from './pricing'
import { seedPricing } from './pricingSeed'
import { buildSwitchSlide, defaultChecklist, defaultSwitchTexts, differenceView, nextSlide, slideControls, SLIDE_COUNT } from './switching'
import type { Offer, VodafoneCombo } from './types'

const TODAY = '2026-11-16'
const offer = (over: Partial<Offer> = {}): Offer => ({ ...emptyOffer(TODAY), name: 'Test', promoMonths: 0, promoMonthlyCents: 0, regularMonthlyCents: 7500, ...over })
const diff = (o: Offer, currentMonthly: number | null, combo: VodafoneCombo = emptyCombo(), period: 12 | 24 = 24) => differenceView(compare({ current: { ...emptyCurrent(), monthlyCents: currentMonthly }, offer: o, combo, period, startDate: TODAY }))
/** Huidig: € 1.600 over 24 maanden (2 × 66,66 + 22 × 66,67 bestaat niet als vast maandbedrag) → we sturen op totalen via de aanbieding. */
const NBSP = ' '

describe('more expensive: average monthly additional cost', () => {
  it('specification example: € 1.600 → € 1.800 = € 200 more, € 8,33 per month on average', () => {
    // huidig 24 × 66,67 = 1.600,08 is niet exact; daarom: huidig € 50 p/m (1.200) en nieuw 1.400 → zelfde verschil van € 200.
    const d = diff(offer({ regularMonthlyCents: 5800, activationCents: 800 }), 5000)
    expect(d.kind).toBe('meerkosten')
    expect(d.totalCents).toBe(20000)
    expect(d.averageMonthlyCents).toBe(833) // 200 / 24 = 8,3333…
    expect(d.headline).toBe(`Gemiddeld €${NBSP}8,33 meer per maand`)
    expect(d.subline).toBe(`€${NBSP}200 meer over 24 maanden`)
  })
  it('rounds to whole cents, half up', () => {
    expect(diff(offer({ regularMonthlyCents: 5000, activationCents: 20 }), 5000).averageMonthlyCents).toBe(1) // 0,20 / 24 = 0,0083
    expect(diff(offer({ regularMonthlyCents: 5000, activationCents: 12 }), 5000).averageMonthlyCents).toBe(1) // 0,005 → 0,01
    expect(diff(offer({ regularMonthlyCents: 5000, activationCents: 11 }), 5000).averageMonthlyCents).toBe(0)
    expect(diff(offer({ regularMonthlyCents: 6000 }), 5000).averageMonthlyCents).toBe(1000)
  })
  it('total comes straight from the pricing engine', () => {
    const o = offer({ promoMonthlyCents: 3500, promoMonths: 12, regularMonthlyCents: 9040 })
    const r = compare({ current: { ...emptyCurrent(), monthlyCents: 6000 }, offer: o, combo: emptyCombo(), period: 24, startDate: TODAY })
    const d = differenceView(r)
    expect(d.totalCents).toBe(-r.totalSavingsCents)
    expect(d.totalCents).toBe(12 * 3500 + 12 * 9040 - 24 * 6000)
    expect(d.averageMonthlyCents).toBe(Math.round(d.totalCents / 24))
  })
  it('explains that it is an average and not the invoice amount', () => {
    const d = diff(offer({ promoMonthlyCents: 3500, promoMonths: 12, regularMonthlyCents: 9040 }), 6000)
    expect(d.explanation).toContain('gemiddelde over 24 maanden')
    expect(d.explanation).toContain('verandert niet elke maand met dit bedrag')
  })
  it('includes one-time charges and labels them', () => {
    const without = diff(offer({ regularMonthlyCents: 6000 }), 5000)
    const withFee = diff(offer({ regularMonthlyCents: 6000, activationCents: 2000, installationCents: 4000 }), 5000)
    expect(without.includesOneTime).toBe(false)
    expect(without.explanation).not.toContain('eenmalige kosten')
    expect(withFee.totalCents).toBe(24000 + 6000)
    expect(withFee.averageMonthlyCents).toBe(1250)
    expect(withFee.includesOneTime).toBe(true)
    expect(withFee.explanation).toContain('inclusief eenmalige kosten')
  })
  it('follows the selected comparison period', () => {
    const d = diff(offer({ regularMonthlyCents: 6000 }), 5000, emptyCombo(), 12)
    expect(d.totalCents).toBe(12000)
    expect(d.subline).toContain('over 12 maanden')
  })
})

describe('savings, equal and unknown', () => {
  it('positive savings keep the savings headline with an average', () => {
    const d = diff(offer({ regularMonthlyCents: 5000 }), 6500)
    expect(d.kind).toBe('besparing')
    expect(d.totalCents).toBe(36000)
    expect(d.headline).toBe('Uw besparing over 24 maanden')
    expect(d.subline).toBe(`Gemiddeld €${NBSP}15 minder per maand`)
  })
  it('exactly equal costs are neutral', () => {
    const d = diff(offer({ regularMonthlyCents: 5000 }), 5000)
    expect(d.kind).toBe('gelijk')
    expect(d.totalCents).toBe(0)
    expect(d.headline).not.toMatch(/meer|besparing/i)
  })
  it('missing current costs: no difference is invented', () => {
    const d = diff(offer({ regularMonthlyCents: 5000 }), null)
    expect(d.kind).toBe('onbekend')
    expect(d.headline).toBe('')
    expect(d.averageMonthlyCents).toBe(0)
    expect(d.explanation).toContain('niet ingevuld')
  })
  it('Vodafone benefit is counted once, via the engine', () => {
    const o = offer({ regularMonthlyCents: 7140 })
    const base = diff(o, 6000)
    const withCombo = diff(o, 6000, { hasVodafone: true, eligible: true, monthlyDiscountCents: 750, extraBenefits: '', mobileInvoiceDiscountCents: 1000 })
    expect(base.kind).toBe('meerkosten')
    expect(withCombo.kind).toBe('meerkosten')
    expect(base.totalCents - withCombo.totalCents).toBe(24 * 750)
    expect(diff(o, 6000, { hasVodafone: true, eligible: false, monthlyDiscountCents: 750, extraBenefits: '' }).totalCents).toBe(base.totalCents)
    // Een korting kan de uitkomst ook laten omslaan naar een besparing.
    expect(diff(o, 6500, { hasVodafone: true, eligible: true, monthlyDiscountCents: 750, extraBenefits: '' }).kind).toBe('besparing')
  })
  it('works on real packages with promotion and post-promotion price', () => {
    const cat = { ...seedPricing(), activationCents: 0 }
    const o = composeOffer(cat, { ...emptySelection(), internetId: 'net-1000', tvId: 'tv-max', promotionIds: ['welkom-35'] }, TODAY).offer!
    const d = diff(o, 6000)
    expect(d.totalCents).toBe(12 * 3500 + 12 * 9040 - 144000) // € 64,80
    expect(d.averageMonthlyCents).toBe(270)
    expect(d.headline).toBe(`Gemiddeld €${NBSP}2,70 meer per maand`)
  })
})

describe('"Overstappen zonder gedoe" — conditional claims', () => {
  const texts = defaultSwitchTexts()
  const slide = (overstap: 'ja' | 'nee' | 'controleren', install: 'ja' | 'nee' | 'bespreken' = 'ja') => buildSwitchSlide({ overstap, install }, texts)
  const all = (s: ReturnType<typeof slide>) => JSON.stringify(s)

  it('defaults to both services applying, so the three promises show without extra taps', () => {
    expect(defaultChecklist()).toEqual({ overstap: 'ja', install: 'ja' })
    expect(buildSwitchSlide(defaultChecklist(), texts).cards.map((c) => c.heading)).toEqual(['Wij regelen uw overstap.', 'Geen seconde zonder internet.', 'Alles professioneel geïnstalleerd.'])
  })
  it('confirmed: exactly the advisor\'s three headings and descriptions', () => {
    const s = slide('ja')
    expect(s.title).toBe('Overstappen zonder gedoe')
    expect(s.cards.map((c) => [c.heading, c.text])).toEqual([
      ['Wij regelen uw overstap.', 'Wij zeggen uw huidige abonnement op en regelen de volledige overstap. U hoeft zelf niets te doen.'],
      ['Geen seconde zonder internet.', 'Wij zorgen voor een vlekkeloze overgang, zodat u gewoon verbonden blijft.'],
      ['Alles professioneel geïnstalleerd.', 'Onze monteur komt gratis langs, installeert uw Ziggo-apparatuur en controleert de wifi in huis.'],
    ])
    expect(s.cards.every((c) => c.confirmed)).toBe(true)
  })
  it('confirmed promises carry no disclaimer on the main slide; conditions stay behind the details link', () => {
    const s = slide('ja')
    expect(s.cards.map((c) => c.note)).toEqual([null, null, null])
    expect(s.details.length).toBeGreaterThanOrEqual(3)
    expect(s.details.join(' ')).toContain('niet automatisch gratis')
  })
  it('each promise needs its own confirmation', () => {
    for (const o of ['nee', 'controleren'] as const) expect(JSON.stringify(slide(o, 'ja').cards)).not.toMatch(/Geen seconde zonder internet|gewoon verbonden blijft|zeggen uw huidige abonnement op|U hoeft zelf niets te doen/)
    for (const i of ['nee', 'bespreken'] as const) expect(JSON.stringify(slide('ja', i).cards)).not.toMatch(/Alles professioneel geïnstalleerd|komt gratis langs/)
    expect(slide('nee', 'ja').cards[2].heading).toBe('Alles professioneel geïnstalleerd.')
    expect(slide('ja', 'nee').cards[0].heading).toBe('Wij regelen uw overstap.')
  })
  it.each(['nee', 'controleren'] as const)('Overstapservice %s: never claims Ziggo cancels the old contract', (choice) => {
    const s = slide(choice)
    expect(s.cards[0].heading).toBe('Hulp bij uw overstap')
    expect(s.cards[0].text).toBe('Wij helpen u met de stappen voor een soepele overstap.')
    expect(s.cards[0].confirmed).toBe(false)
    expect(s.cards[1].heading).not.toBe('Geen seconde zonder internet.')
    const cards = JSON.stringify(s.cards)
    expect(cards).not.toContain('regelen de volledige overstap')
    expect(cards).not.toContain('Wij regelen uw overstap')
    expect(cards).toContain('zegt u')
  })
  it('unavailable: the customer cancels themselves; unknown: we check together', () => {
    expect(slide('nee').cards[0].note).toBe('Uw huidige abonnement zegt u zelf op. Wij vertellen u hoe en wanneer.')
    expect(slide('controleren').cards[0].note).toContain('We controleren samen')
    expect(slide('nee').details[0]).toContain('niet van toepassing')
  })
  it('installation assistance: wanted, to discuss, not wanted', () => {
    const yes = slide('ja', 'ja').cards[2]
    const maybe = slide('ja', 'bespreken').cards[2]
    const no = slide('ja', 'nee').cards[2]
    expect(yes).toMatchObject({ heading: 'Alles professioneel geïnstalleerd.', confirmed: true, note: null })
    expect(maybe).toMatchObject({ heading: 'Installatiehulp mogelijk', confirmed: false })
    expect(maybe.text).toContain('Als u dat wilt')
    expect(no.heading).toBe('Zelf aansluiten')
    expect(no.text).not.toContain('monteur')
    expect(maybe.note).toContain('acht weken')
    expect(maybe.note).toContain('niet automatisch gratis')
  })
  it('always exactly three cards and the editable conditions behind the details link', () => {
    for (const o of ['ja', 'nee', 'controleren'] as const) for (const i of ['ja', 'nee', 'bespreken'] as const) expect(slide(o, i).cards).toHaveLength(3)
    const custom = buildSwitchSlide({ overstap: 'ja', install: 'ja' }, { ...texts, overstapConditions: 'Eigen regel A', installConditions: 'Eigen regel B' })
    expect(custom.details.slice(0, 2)).toEqual(['Eigen regel A', 'Eigen regel B'])
    expect(custom.sources).toHaveLength(3)
    expect(custom.sources.every((u) => u.startsWith('https://www.ziggo.nl/'))).toBe(true)
  })
  it('customer safety: advisor rules, commission and notes never reach the slide', () => {
    const s = buildSwitchSlide({ overstap: 'controleren', install: 'bespreken' }, { ...texts, advisorRules: 'GEHEIM-INTERN' })
    expect(all(s)).not.toMatch(/GEHEIM|advisorRules|provisie|commissie|weekdoel|notitie/i)
    expect(all(s)).not.toMatch(/bestelling is geplaatst|contract is getekend|bevestigd dat u klant bent/i)
    expect(s.details.join(' ')).toContain('geen bevestiging van een bestelling')
  })
})

describe('navigation between the two slides', () => {
  it('there are exactly two slides', () => expect(SLIDE_COUNT).toBe(2))
  it('next and previous move one step and stay in range', () => {
    expect(nextSlide(0, 'volgende')).toBe(1)
    expect(nextSlide(1, 'vorige')).toBe(0)
    expect(nextSlide(1, 'volgende')).toBe(1)
    expect(nextSlide(0, 'vorige')).toBe(0)
  })
  it('slide 1 offers "Volgende"; only the last slide has the final action', () => {
    expect(slideControls(0)).toEqual({ back: null, primary: 'Volgende', primaryAction: 'volgende' })
    expect(slideControls(1)).toEqual({ back: 'Vorige', primary: 'Verder met dit abonnement', primaryAction: 'afronden' })
  })
})
