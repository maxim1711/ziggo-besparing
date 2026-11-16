import type { Cents } from './money'
import type { IsoDate } from './dates'

/**
 * Energievergelijking (Essent-module).
 *
 * Uitgangspunten:
 *  - Beide leveranciers worden doorgerekend met exact hetzelfde verbruik.
 *  - Er bestaat bewust geen veld voor een maandelijks voorschot.
 *  - Leverancierskosten, belastingen en netbeheer zijn gescheiden gemodelleerd.
 *  - Belastingregels staan per jaar in een instelbare tabel (RegulatoryYear), niet in code.
 *  - Ontbreekt een gegeven, dan meldt de motor dat; er wordt niets verzonnen.
 *
 * Tarieven per eenheid zijn gehele honderdduizendsten van een euro (1e-5 €),
 * zodat € 0,24531 per kWh exact is. Jaarbedragen zijn gehele centen.
 */
export type Rate = number
const RATE_SCALE = 100000

/** "0,24531", "€ 0,2453", "0.25" → Rate. Geen floats. */
export function parseRate(input: string): Rate | null {
  const s = input.replace(/[€\s ]/g, '').replace(',', '.')
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  if (frac.length > 5) return null
  const v = Number(whole || '0') * RATE_SCALE + Number((frac + '00000').slice(0, 5))
  return Number.isSafeInteger(v) ? v : null
}

/** Rate → "0,24531" (minstens 3, hoogstens 5 decimalen). */
export function rateToInput(r: Rate | null): string {
  if (r === null) return ''
  const frac = (r % RATE_SCALE).toString().padStart(5, '0').replace(/0{1,2}$/, '')
  return `${Math.floor(r / RATE_SCALE)},${frac}`
}
export const formatRate = (r: Rate): string => `€ ${rateToInput(r)}`

export type ContractType = 'vast' | 'variabel' | 'dynamisch'
export type OfferStatus = 'concept' | 'gecontroleerd' | 'verlopen'

/** De tarieven van één leverancier. null = niet ingevuld. */
export interface TariffRates {
  electricitySingle: Rate | null
  electricityPeak: Rate | null
  electricityOffPeak: Rate | null
  gas: Rate | null
  fixedElectricityMonthlyCents: Cents | null
  fixedGasMonthlyCents: Cents | null
  /** Zijn de bedragen hierboven inclusief btw? */
  includesVat: boolean
  /** Zijn de kWh- en m³-tarieven inclusief energiebelasting? */
  includesEnergyTax: boolean
  /** Terugleverkosten per teruggeleverde kWh. */
  feedInFeePerKwh: Rate | null
  /** Terugleververgoeding per kWh (voor wat niet wordt gesaldeerd). */
  feedInCompensationPerKwh: Rate | null
}

export const emptyRates = (): TariffRates => ({ electricitySingle: null, electricityPeak: null, electricityOffPeak: null, gas: null, fixedElectricityMonthlyCents: null, fixedGasMonthlyCents: null, includesVat: true, includesEnergyTax: true, feedInFeePerKwh: null, feedInCompensationPerKwh: null })

export interface EnergyDiscount {
  id: string
  label: string
  amountCents: Cents
  kind: 'jaarlijks' | 'eenmalig'
}

export interface EnergyOffer {
  id: string
  version: number
  createdAt: string
  updatedAt: string
  name: string
  campaign: string
  contractType: ContractType
  contractMonths: number
  validFrom: IsoDate | null
  validTo: IsoDate | null
  status: OfferStatus
  rates: TariffRates
  discounts: EnergyDiscount[]
  /** Eenmalige welkomstbonus/cashback. */
  welcomeBonusCents: Cents
  /** Voorwaarden van bonus/cashback (zichtbaar voor de klant). */
  bonusConditions: string
  /** Wie komt in aanmerking (zichtbaar voor de klant). */
  eligibility: string
  salesChannel: string
  source: string
  verifiedOn: IsoDate | null
  internalNotes: string
  favorite: boolean
  /** Voorbeeld met verzonnen waarden; nooit een actueel Essent-tarief. */
  isExample: boolean
}

/** Belasting- en regelgeving voor één kalenderjaar. null = nog niet ingevuld. */
export interface RegulatoryYear {
  year: number
  /** Btw in honderdsten van een procent (2100 = 21%). */
  vatBp: number
  /** Energiebelasting per kWh, exclusief btw. */
  energyTaxElectricity: Rate | null
  /** Energiebelasting per m³, exclusief btw. */
  energyTaxGas: Rate | null
  /** Vermindering energiebelasting per jaar, inclusief btw. */
  taxReductionYearCents: Cents | null
  /** Netbeheerkosten per jaar, inclusief btw (verschilt per netbeheerder). */
  networkElectricityYearCents: Cents | null
  networkGasYearCents: Cents | null
  /** 'salderen' = teruglevering wegstrepen tegen afname; 'geen' = niet meer salderen. */
  netting: 'salderen' | 'geen'
  verifiedOn: IsoDate | null
  note: string
}

export interface Usage {
  /** Afname van het net per jaar. */
  electricityKwh: number | null
  meter: 'enkel' | 'dubbel'
  peakKwh: number | null
  offPeakKwh: number | null
  /** 0 = geen gasaansluiting. */
  gasM3: number | null
  /** Teruglevering aan het net per jaar (zonnepanelen). */
  feedInKwh: number
}

export interface CurrentEnergy {
  supplier: string
  /** 'tarieven' = tarieven invullen; 'jaarbedrag' = totaal van de jaarafrekening. */
  mode: 'tarieven' | 'jaarbedrag'
  rates: TariffRates
  /** Totale jaarkosten volgens de jaarafrekening (incl. belastingen en netbeheer). */
  annualCostCents: Cents | null
  contractType: ContractType
  contractEndDate: IsoDate | null
  terminationCents: Cents
}

export interface SideCost {
  electricityCents: Cents
  gasCents: Cents
  fixedCents: Cents
  /** Energiebelasting incl. btw die los bovenop de tarieven komt (0 als die al in het tarief zit). */
  energyTaxCents: Cents
  feedInFeeCents: Cents
  /** Positief bedrag dat de klant ontvangt. */
  feedInCompensationCents: Cents
  yearlyDiscountCents: Cents
  /** Kosten bij de leverancier incl. belastingen, zonder netbeheer en vermindering. */
  supplierYearCents: Cents
  networkCents: Cents | null
  taxReductionCents: Cents | null
  /** Totaal per jaar op de gekozen basis (zie EnergyComparison.basis). */
  totalYearCents: Cents
  billedKwh: number
  compensatedKwh: number
}

export interface EnergyIssue {
  message: string
  blocking: boolean
}

export interface EnergyComparison {
  /** 'volledig' = incl. netbeheer en vermindering; 'leverancier' = alleen kosten bij de leverancier. */
  basis: 'volledig' | 'leverancier'
  current: SideCost | null
  /** Totaal huidige leverancier per jaar (uit tarieven of jaarafrekening). */
  currentYearCents: Cents | null
  essent: SideCost | null
  /** Positief = besparing per jaar, negatief = duurder. Zonder eenmalige bonus. */
  yearlySavingsCents: Cents | null
  monthlyEquivalentCents: Cents | null
  /** Eenmalig voordeel (bonus + eenmalige kortingen − opzegkosten). */
  oneTimeCents: Cents
  firstYearSavingsCents: Cents | null
  issues: EnergyIssue[]
  /** Aannames en toelichting voor de klant. */
  notes: string[]
  blocked: boolean
  rulesYear: number
}

const round = (micro: number): Cents => Math.round(micro / 1000)
const withVat = (micro: number, includesVat: boolean, vatBp: number) => (includesVat ? micro : (micro * (10000 + vatBp)) / 10000)

/** Jaarkosten bij één leverancier voor het opgegeven verbruik. `who` komt terug in meldingen. */
export function sideCost(usage: Usage, rates: TariffRates, reg: RegulatoryYear, who: string, yearlyDiscountCents = 0): { cost: SideCost | null; missing: string[] } {
  const missing: string[] = []
  const kwh = usage.electricityKwh
  const gas = usage.gasM3
  if (kwh === null) missing.push('Stroomverbruik per jaar ontbreekt.')
  if (gas === null) missing.push('Gasverbruik per jaar ontbreekt (vul 0 in bij geen gas).')

  const total = kwh ?? 0
  const feedIn = Math.max(0, usage.feedInKwh)
  const billed = reg.netting === 'salderen' ? Math.max(0, total - feedIn) : total
  const compensated = reg.netting === 'salderen' ? Math.max(0, feedIn - total) : feedIn

  // Stroom: bij een dubbele meter normaal/dal apart, anders (of zonder dubbel tarief) het enkeltarief.
  let electricityMicro = 0
  const dual = usage.meter === 'dubbel' && rates.electricityPeak !== null && rates.electricityOffPeak !== null
  if (usage.meter === 'dubbel' && (usage.peakKwh === null || usage.offPeakKwh === null)) missing.push('Verbruik normaal en dal ontbreekt.')
  if (dual && usage.peakKwh !== null && usage.offPeakKwh !== null) {
    const sum = usage.peakKwh + usage.offPeakKwh
    // Salderen verlaagt normaal en dal naar verhouding.
    const peak = sum > 0 ? Math.round((usage.peakKwh * billed) / sum) : 0
    electricityMicro = peak * rates.electricityPeak! + (billed - peak) * rates.electricityOffPeak!
  } else if (rates.electricitySingle !== null) {
    electricityMicro = billed * rates.electricitySingle
  } else if (billed > 0 || kwh === null) {
    missing.push(`Stroomtarief van ${who} ontbreekt${usage.meter === 'enkel' && rates.electricityPeak !== null ? ' (alleen normaal/dal ingevuld, maar de meter is enkel)' : ''}.`)
  }

  let gasMicro = 0
  if ((gas ?? 0) > 0) {
    if (rates.gas === null) missing.push(`Gastarief van ${who} ontbreekt.`)
    else gasMicro = gas! * rates.gas
  }

  // Energiebelasting alleen los berekenen als die niet al in het tarief zit: nooit dubbel.
  let taxMicro = 0
  if (!rates.includesEnergyTax) {
    if (billed > 0 && reg.energyTaxElectricity === null) missing.push(`Energiebelasting stroom ${reg.year} is niet ingevuld (nodig omdat de tarieven van ${who} exclusief energiebelasting zijn).`)
    if ((gas ?? 0) > 0 && reg.energyTaxGas === null) missing.push(`Energiebelasting gas ${reg.year} is niet ingevuld (nodig omdat de tarieven van ${who} exclusief energiebelasting zijn).`)
    taxMicro = ((billed * (reg.energyTaxElectricity ?? 0) + (gas ?? 0) * (reg.energyTaxGas ?? 0)) * (10000 + reg.vatBp)) / 10000
  }

  if (rates.fixedElectricityMonthlyCents === null) missing.push(`Vaste leveringskosten stroom van ${who} ontbreken.`)
  if ((gas ?? 0) > 0 && rates.fixedGasMonthlyCents === null) missing.push(`Vaste leveringskosten gas van ${who} ontbreken.`)
  const fixedMicro = ((rates.fixedElectricityMonthlyCents ?? 0) + ((gas ?? 0) > 0 ? (rates.fixedGasMonthlyCents ?? 0) : 0)) * 12 * 1000

  let feeMicro = 0
  let compMicro = 0
  if (feedIn > 0) {
    if (rates.feedInFeePerKwh === null) missing.push(`Terugleverkosten van ${who} ontbreken (vul 0 in als er geen zijn).`)
    else feeMicro = feedIn * rates.feedInFeePerKwh
    if (compensated > 0) {
      if (rates.feedInCompensationPerKwh === null) missing.push(`Terugleververgoeding van ${who} ontbreekt.`)
      else compMicro = compensated * rates.feedInCompensationPerKwh
    }
  }

  if (missing.length) return { cost: null, missing }
  const vat = (m: number) => withVat(m, rates.includesVat, reg.vatBp)
  const electricityCents = round(vat(electricityMicro))
  const gasCents = round(vat(gasMicro))
  const fixedCents = round(vat(fixedMicro))
  const energyTaxCents = round(taxMicro)
  const feedInFeeCents = round(vat(feeMicro))
  const feedInCompensationCents = round(compMicro)
  const supplierYearCents = electricityCents + gasCents + fixedCents + energyTaxCents + feedInFeeCents - feedInCompensationCents - yearlyDiscountCents
  const networkCents = reg.networkElectricityYearCents !== null && ((gas ?? 0) === 0 || reg.networkGasYearCents !== null) ? reg.networkElectricityYearCents + ((gas ?? 0) > 0 ? reg.networkGasYearCents! : 0) : null
  return {
    cost: { electricityCents, gasCents, fixedCents, energyTaxCents, feedInFeeCents, feedInCompensationCents, yearlyDiscountCents, supplierYearCents, networkCents, taxReductionCents: reg.taxReductionYearCents, totalYearCents: supplierYearCents, billedKwh: billed, compensatedKwh: compensated },
    missing: [],
  }
}

/** Waarom een aanbod nu niet aan een klant getoond mag worden; null = bruikbaar. */
export function offerBlockedReason(offer: EnergyOffer, today: IsoDate): string | null {
  if (offer.status === 'verlopen' || (offer.validTo !== null && offer.validTo < today)) return 'Dit aanbod is verlopen.'
  if (offer.status === 'concept') return 'Dit aanbod is nog een concept. Controleer de tarieven en zet de status op Gecontroleerd.'
  if (offer.validFrom !== null && offer.validFrom > today) return 'Dit aanbod is nog niet geldig.'
  return null
}

/** Kiest de regels voor het jaar; valt terug op het laatste eerdere jaar dat is ingesteld. */
export function rulesFor(years: RegulatoryYear[], year: number): RegulatoryYear | undefined {
  const sorted = [...years].sort((a, b) => a.year - b.year)
  return sorted.filter((y) => y.year <= year).pop() ?? sorted[0]
}

export interface EnergyInput {
  usage: Usage
  current: CurrentEnergy
  offer: EnergyOffer
  reg: RegulatoryYear
  today: IsoDate
}

export function compareEnergyOffer({ usage, current, offer, reg, today }: EnergyInput): EnergyComparison {
  const issues: EnergyIssue[] = []
  const notes: string[] = []
  const block = (message: string) => issues.push({ message, blocking: true })

  const reason = offerBlockedReason(offer, today)
  if (reason) block(reason)

  const yearlyDiscount = offer.discounts.filter((d) => d.kind === 'jaarlijks').reduce((a, d) => a + d.amountCents, 0)
  const oneTimeDiscount = offer.discounts.filter((d) => d.kind === 'eenmalig').reduce((a, d) => a + d.amountCents, 0)
  const essentSide = sideCost(usage, offer.rates, reg, 'Essent', yearlyDiscount)
  essentSide.missing.forEach(block)

  const networkKnown = reg.networkElectricityYearCents !== null && ((usage.gasM3 ?? 0) === 0 || reg.networkGasYearCents !== null) && reg.taxReductionYearCents !== null
  let basis: EnergyComparison['basis'] = networkKnown ? 'volledig' : 'leverancier'
  const full = (c: SideCost): SideCost => (basis === 'volledig' ? { ...c, totalYearCents: c.supplierYearCents + c.networkCents! - c.taxReductionCents! } : c)

  let currentCost: SideCost | null = null
  let currentYear: Cents | null = null
  if (current.mode === 'jaarbedrag') {
    // Een jaarafrekening bevat netbeheer en belastingvermindering: alleen eerlijk te vergelijken op volledige basis.
    if (current.annualCostCents === null) block('Vul het jaarbedrag van de jaarafrekening in, of voer de huidige tarieven in.')
    else if (!networkKnown) block(`Een jaarbedrag bevat netbeheerkosten en de vermindering energiebelasting. Vul die in voor ${reg.year} (Tarieven → Belastingen & netbeheer), of voer de huidige tarieven in.`)
    else {
      currentYear = current.annualCostCents
      notes.push('De huidige kosten komen van uw jaarafrekening en horen bij het verbruik van toen. De vergelijking is daarom een schatting.')
    }
    if (usage.feedInKwh > 0 && reg.netting !== 'salderen') notes.push('Uw jaarafrekening is mogelijk nog met salderen berekend; zonder salderen kunnen uw huidige kosten hoger uitvallen.')
  } else {
    const side = sideCost(usage, current.rates, reg, current.supplier || 'de huidige leverancier')
    side.missing.forEach((m) => {
      if (!issues.some((i) => i.message === m)) block(m)
    })
    if (side.cost) {
      currentCost = full(side.cost)
      currentYear = currentCost.totalYearCents
    }
  }
  if (current.mode === 'jaarbedrag') basis = 'volledig'
  const essent = essentSide.cost ? full(essentSide.cost) : null

  const blocked = issues.some((i) => i.blocking)
  const yearlySavings = !blocked && essent && currentYear !== null ? currentYear - essent.totalYearCents : null
  const oneTime = offer.welcomeBonusCents + oneTimeDiscount - current.terminationCents

  notes.push('Beide leveranciers zijn doorgerekend met hetzelfde jaarverbruik. Verbruikt u meer of minder, dan veranderen de bedragen.')
  if (basis === 'leverancier') notes.push('De bedragen zijn de kosten bij de leverancier, inclusief energiebelasting en btw. Netbeheerkosten en de vermindering energiebelasting zijn niet meegeteld; die zijn bij elke leverancier gelijk.')
  else notes.push('De bedragen zijn inclusief energiebelasting, btw, netbeheerkosten en de vermindering energiebelasting.')
  if (offer.contractType !== 'vast') notes.push(`Dit is een ${offer.contractType} contract: de tarieven kunnen wijzigen. De berekening gebruikt de tarieven van nu en is geen prijsgarantie.`)
  else notes.push(`De leveringstarieven van Essent staan ${offer.contractMonths} maanden vast. Belastingen en netbeheerkosten kunnen wel wijzigen.`)
  if (current.mode === 'tarieven' && current.contractType !== 'vast') notes.push('Uw huidige tarieven zijn variabel en kunnen wijzigen; er is gerekend met de tarieven van nu.')
  if (usage.feedInKwh > 0) notes.push(reg.netting === 'salderen' ? `Er is gerekend met salderen volgens de regels van ${reg.year}. Vanaf 2027 vervalt salderen; dan kan de uitkomst anders zijn.` : `Er is gerekend zonder salderen (regels ${reg.year}): alle afname wordt berekend en teruglevering krijgt de terugleververgoeding.`)
  if (offer.welcomeBonusCents > 0) notes.push(`De welkomstbonus is eenmalig en niet meegeteld in de jaarkosten.${offer.bonusConditions ? ` Voorwaarden: ${offer.bonusConditions}` : ''}`)
  if (current.terminationCents > 0) notes.push('Kosten voor het opzeggen van uw huidige contract zijn eenmalig en apart vermeld.')
  if (current.contractEndDate && current.contractEndDate > today && current.terminationCents === 0) issues.push({ blocking: false, message: 'Het huidige contract loopt nog. Controleer of er een opzegvergoeding geldt.' })
  if (reg.verifiedOn === null && (!offer.rates.includesEnergyTax || basis === 'volledig')) issues.push({ blocking: false, message: `De belasting- en netbeheergegevens voor ${reg.year} zijn niet als gecontroleerd gemarkeerd.` })
  if (offer.isExample) issues.push({ blocking: false, message: 'Dit is een voorbeeldaanbod met verzonnen tarieven.' })

  return {
    basis,
    current: currentCost,
    currentYearCents: blocked ? null : currentYear,
    essent: blocked ? null : essent,
    yearlySavingsCents: yearlySavings,
    monthlyEquivalentCents: yearlySavings === null ? null : Math.round(yearlySavings / 12),
    oneTimeCents: oneTime,
    firstYearSavingsCents: yearlySavings === null ? null : yearlySavings + oneTime,
    issues,
    notes,
    blocked,
    rulesYear: reg.year,
  }
}

/* ---------- validatie en versies ---------- */

const isRate = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10 * RATE_SCALE)
const isCents = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0)
const isDate = (v: unknown) => v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))

/** Controleert eenheden en bedragen. Lege lijst = geldig. */
export function validateOffer(o: EnergyOffer): string[] {
  const e: string[] = []
  const r = o.rates
  if (!o.name?.trim()) e.push('Naam ontbreekt.')
  if (!['vast', 'variabel', 'dynamisch'].includes(o.contractType)) e.push('Onbekend contracttype.')
  if (!Number.isInteger(o.contractMonths) || o.contractMonths < 0 || o.contractMonths > 120) e.push('Looptijd moet tussen 0 en 120 maanden liggen.')
  if (!['concept', 'gecontroleerd', 'verlopen'].includes(o.status)) e.push('Onbekende status.')
  if (!r || typeof r !== 'object') return [...e, 'Tarieven ontbreken.']
  for (const [k, label] of [['electricitySingle', 'Stroom enkel'], ['electricityPeak', 'Stroom normaal'], ['electricityOffPeak', 'Stroom dal'], ['gas', 'Gas'], ['feedInFeePerKwh', 'Terugleverkosten'], ['feedInCompensationPerKwh', 'Terugleververgoeding']] as const) {
    if (!isRate(r[k])) e.push(`${label}: ongeldig tarief.`)
  }
  // Eenheidscontrole: een kWh-prijs boven € 2 of een m³-prijs boven € 5 is vrijwel zeker een typefout of verkeerde eenheid.
  for (const k of ['electricitySingle', 'electricityPeak', 'electricityOffPeak'] as const) if (typeof r[k] === 'number' && r[k]! > 2 * RATE_SCALE) e.push('Stroomtarief is hoger dan € 2 per kWh: controleer de eenheid (euro, geen centen).')
  if (typeof r.gas === 'number' && r.gas > 5 * RATE_SCALE) e.push('Gastarief is hoger dan € 5 per m³: controleer de eenheid.')
  if (!isCents(r.fixedElectricityMonthlyCents) || !isCents(r.fixedGasMonthlyCents)) e.push('Vaste leveringskosten: ongeldig bedrag.')
  if ((r.fixedElectricityMonthlyCents ?? 0) > 10000 || (r.fixedGasMonthlyCents ?? 0) > 10000) e.push('Vaste leveringskosten zijn hoger dan € 100 per maand: controleer of dit geen jaarbedrag is.')
  if (typeof r.includesVat !== 'boolean' || typeof r.includesEnergyTax !== 'boolean') e.push('Geef aan of de tarieven inclusief btw en energiebelasting zijn.')
  if ((r.electricityPeak === null) !== (r.electricityOffPeak === null)) e.push('Vul normaal- én daltarief in, of geen van beide.')
  if (!isCents(o.welcomeBonusCents)) e.push('Welkomstbonus: ongeldig bedrag.')
  if (!isDate(o.validFrom) || !isDate(o.validTo) || !isDate(o.verifiedOn)) e.push('Ongeldige datum.')
  if (o.validFrom && o.validTo && o.validTo < o.validFrom) e.push('De einddatum ligt vóór de begindatum.')
  if (o.status === 'gecontroleerd') {
    if (r.electricitySingle === null && r.electricityPeak === null) e.push('Een gecontroleerd aanbod heeft een stroomtarief nodig.')
    if (r.fixedElectricityMonthlyCents === null) e.push('Een gecontroleerd aanbod heeft vaste leveringskosten stroom nodig.')
    if (!o.verifiedOn) e.push('Een gecontroleerd aanbod heeft een controledatum nodig.')
  }
  if (!Array.isArray(o.discounts) || o.discounts.some((d) => !isCents(d.amountCents) || d.amountCents === null || !['jaarlijks', 'eenmalig'].includes(d.kind))) e.push('Ongeldige korting.')
  return e
}

export const blankOffer = (id: string, now: string): EnergyOffer => ({ id, version: 1, createdAt: now, updatedAt: now, name: '', campaign: '', contractType: 'vast', contractMonths: 12, validFrom: null, validTo: null, status: 'concept', rates: emptyRates(), discounts: [], welcomeBonusCents: 0, bonusConditions: '', eligibility: '', salesChannel: 'Deur-aan-deur', source: '', verifiedOn: null, internalNotes: '', favorite: false, isExample: false })

/** "Nieuwe actie op basis van huidige": kopie als concept, zonder geldigheid en controledatum. */
export function duplicateOffer(src: EnergyOffer, id: string, now: string): EnergyOffer {
  return { ...structuredClone(src), id, version: 1, createdAt: now, updatedAt: now, name: `${src.name} (nieuw)`, status: 'concept', validFrom: null, validTo: null, verifiedOn: null, favorite: false, isExample: false }
}

/** Slaat een wijziging op als nieuwe versie en bewaart de vorige ter referentie. */
export function saveOfferVersion(offers: EnergyOffer[], history: EnergyOffer[], next: EnergyOffer, now: string): { offers: EnergyOffer[]; history: EnergyOffer[] } {
  const prev = offers.find((o) => o.id === next.id)
  if (!prev) return { offers: [...offers, { ...next, version: 1, createdAt: now, updatedAt: now }], history }
  const { updatedAt: _a, version: _b, favorite: _c, ...p } = prev
  const { updatedAt: _d, version: _e, favorite: _f, ...n } = next
  void [_a, _b, _c, _d, _e, _f]
  // Alleen een ster zetten is geen nieuwe versie.
  if (JSON.stringify(p) === JSON.stringify(n)) return { offers: offers.map((o) => (o.id === next.id ? { ...next, version: prev.version, updatedAt: prev.updatedAt } : o)), history }
  return { offers: offers.map((o) => (o.id === next.id ? { ...next, version: prev.version + 1, createdAt: prev.createdAt, updatedAt: now } : o)), history: [...history, structuredClone(prev)].slice(-200) }
}

/** Voorbeeld voor een lege app. Verzonnen waarden, status Concept: niet te presenteren tot u ze vervangt. */
export function exampleOffer(now: string): EnergyOffer {
  return {
    ...blankOffer('voorbeeld-essent', now),
    name: 'Voorbeeld: 1 jaar vast',
    campaign: 'Voorbeeldcampagne',
    rates: { ...emptyRates(), electricitySingle: 25000, electricityPeak: 26000, electricityOffPeak: 24000, gas: 125000, fixedElectricityMonthlyCents: 899, fixedGasMonthlyCents: 899, feedInFeePerKwh: 11500, feedInCompensationPerKwh: 6000 },
    welcomeBonusCents: 20000,
    bonusConditions: 'Voorbeeld: uitbetaling na 12 maanden klant.',
    eligibility: 'Voorbeeld: alleen voor nieuwe klanten.',
    internalNotes: 'Verzonnen voorbeeldwaarden — GEEN actueel Essent-tarief. Vervang ze en zet de status op Gecontroleerd.',
    isExample: true,
  }
}

/** Jaren met lege belastingvelden: de adviseur vult ze in; alleen de salderingsregel staat vast ingesteld (wel aanpasbaar). */
export function defaultRegulatory(): RegulatoryYear[] {
  const base = { vatBp: 2100, energyTaxElectricity: null, energyTaxGas: null, taxReductionYearCents: null, networkElectricityYearCents: null, networkGasYearCents: null, verifiedOn: null }
  return [
    { ...base, year: 2026, netting: 'salderen', note: 'Salderen is in 2026 nog toegestaan.' },
    { ...base, year: 2027, netting: 'geen', note: 'Per 1 januari 2027 vervalt de salderingsregeling. Controleer de actuele regels en de minimale terugleververgoeding.' },
  ]
}
