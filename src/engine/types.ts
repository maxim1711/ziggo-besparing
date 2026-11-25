import type { Cents } from './money'
import type { IsoDate } from './dates'

export type ComparisonPeriod = 12 | 24
export type ContractMonths = 12 | 24
export type ProductKind = 'internet' | 'internet_tv'

export interface MonthlyItem {
  id: string
  label: string
  monthlyCents: Cents
}

/** Korting die nu al in het huidige maandbedrag verwerkt zit en op een datum afloopt. */
export interface CurrentDiscount {
  id: string
  label: string
  monthlyCents: Cents
  endsOn: IsoDate | null
}

export interface CurrentSubscription {
  provider: string
  packageName: string
  /** Wat de klant vandaag per maand betaalt (incl. btw). null = nog onbekend. */
  monthlyCents: Cents | null
  speedMbps: number | null
  hasTv: boolean
  tvReceivers: number
  /** Extra's die NIET in monthlyCents zitten (sport, entertainment, vaste toeslagen). */
  extras: MonthlyItem[]
  discounts: CurrentDiscount[]
  contractEndDate: IsoDate | null
  cancellationCents: Cents
  /** Verwacht toekomstig maandbedrag; vervangt het basisbedrag vanaf futureFromMonth. */
  futureMonthlyCents: Cents | null
  futureFromMonth: number
  /** Optioneel; ontbreekt bij oudere adviezen. Snelheid staat in `speedMbps`. */
  product?: CurrentProduct
}

/** Maandkorting op een nieuwe aanbieding. */
export interface OfferDiscount {
  id: string
  label: string
  monthlyCents: Cents
  fromMonth: number
  /** Laatste maand (inclusief); null = onbeperkt. */
  toMonth: number | null
  /** Kortingen met dezelfde groep stapelen niet: per maand telt alleen de hoogste. */
  exclusiveGroup: string | null
}

export type GiftType = 'televisie' | 'soundbar' | 'cadeaukaart' | 'anders'

export interface Gift {
  type: GiftType
  name: string
  /** Geüploade foto (data-URL) of pad naar een meegeleverde afbeelding in `public/` (bv. "gifts/x.svg"). */
  imageDataUrl: string | null
  /** Adviesprijs; puur informatief, telt nooit mee als besparing. */
  retailValueCents: Cents | null
  description: string
  conditions: string
}

export interface Offer {
  id: string
  name: string
  provider: string
  kind: ProductKind
  speedMbps: number
  contractMonths: ContractMonths
  promoMonthlyCents: Cents
  promoMonths: number
  regularMonthlyCents: Cents
  activationCents: Cents
  installationCents: Cents
  equipmentCents: Cents
  extras: MonthlyItem[]
  discounts: OfferDiscount[]
  gift: Gift | null
  validFrom: IsoDate
  validTo: IsoDate
  version: string
  /** Voorbeelddata: nog niet gecontroleerd tegen de actuele actievoorwaarden. */
  isExample: boolean
  /** Voorwaarden die de klant mag zien. */
  conditions: string
  /** Alleen voor de adviseur; komt nooit in klantweergave of export. */
  internalNotes: string
  /** Inbegrepen onderdelen, zoals de klant ze ziet (bv. "Internet 1 Gbit/s", "TV Start"). */
  includes?: string[]
  /** Naam van de gekozen actie(s), zoals de klant die ziet. */
  promoName?: string
  /** Einddatum van de gekozen actie; null/undefined = geen actie met einddatum. */
  promoValidTo?: IsoDate | null
  /** Oudste controledatum van de gebruikte prijzen. */
  pricesVerifiedOn?: IsoDate | null
  /** Productkenmerken uit de prijsconfiguratie (snelheid, wifi, tv). Ontbreekt bij oudere opgeslagen aanbiedingen. */
  product?: OfferProduct
}

/** Wat er in het gekozen pakket zit, afgeleid uit de centrale productconfiguratie. */
export interface OfferProduct {
  downloadMbps: number
  uploadMbps: number | null
  /** Wifi-versterkers die bij de snelheid zijn inbegrepen. */
  includedExtenders: number
  /** Extra (bijbetaalde) wifi-versterkers. */
  extraExtenders: number
  tvName: string | null
  /** Ondergrens aantal zenders (uit bv. "70+ zenders"); null = onbekend of geen tv. */
  channels: number | null
  channelsLabel: string | null
  /** null = niet bekend uit de productgegevens. */
  recording: boolean | null
  phone: boolean
}

/**
 * Optionele productgegevens van het huidige abonnement ("Uitgebreid vergelijken").
 * null = onbekend; dat is iets anders dan 0 of "nee" en wordt nooit vergeleken.
 */
export interface CurrentProduct {
  extenders: number | null
  recording: boolean | null
  phone: boolean | null
  channels: number | null
}

export interface VodafoneCombo {
  hasVodafone: boolean
  eligible: boolean
  /** Gecontroleerde maandkorting voor déze klant; geen aanname per abonnement. */
  monthlyDiscountCents: Cents
  extraBenefits: string
  /**
   * Bevestigde korting op de Vodafone-rekening (mobiel). Voordeel voor het huishouden,
   * maar GEEN korting op het Ziggo-abonnement: wordt apart getoond en nergens verrekend.
   */
  mobileInvoiceDiscountCents?: Cents
}

export interface ComparisonInput {
  current: CurrentSubscription
  offer: Offer
  combo: VodafoneCombo
  period: ComparisonPeriod
  /** Startdatum van maand 1 (standaard vandaag). */
  startDate: IsoDate
}

export interface MonthRow {
  month: number
  currentCents: Cents
  newCents: Cents
  newWithoutComboCents: Cents
  /** current - new, exclusief eenmalige kosten. */
  diffCents: Cents
  /** Opgetelde besparing t/m deze maand, inclusief eenmalige kosten. */
  cumulativeSavingsCents: Cents
  /** false = na afloop van de contractduur: schatting op basis van regulier tarief. */
  contractual: boolean
  promo: boolean
}

export interface OneTimeCosts {
  activationCents: Cents
  installationCents: Cents
  equipmentCents: Cents
  cancellationCents: Cents
  totalCents: Cents
}

export interface ComparisonResult {
  period: ComparisonPeriod
  /** Altijd 24 rijen, ongeacht de gekozen periode. */
  months: MonthRow[]
  currentKnown: boolean
  current12Cents: Cents
  current24Cents: Cents
  /** Inclusief eenmalige kosten. */
  new12Cents: Cents
  new24Cents: Cents
  newRecurring12Cents: Cents
  newRecurring24Cents: Cents
  oneTime: OneTimeCosts
  year1SavingsCents: Cents
  year2SavingsCents: Cents
  currentPeriodCents: Cents
  newPeriodCents: Cents
  /** Positief = besparing, negatief = meerkosten. */
  totalSavingsCents: Cents
  monthlyPromoAdvantageCents: Cents
  avgEffectiveMonthlyCents: Cents
  comboSavingsPeriodCents: Cents
  totalSavingsWithoutComboCents: Cents
  /** Informatieve cadeauwaarde; nooit verrekend in bovenstaande bedragen. */
  giftRetailValueCents: Cents | null
  firstMonthNewCents: Cents
  /** Eerste maand waarin het nieuwe maandbedrag stijgt. */
  priceIncreaseMonth: number | null
  priceAfterIncreaseCents: Cents | null
  /** Vergelijking loopt langer door dan het contract. */
  periodExceedsContract: boolean
  contractExceedsPeriod: boolean
}

export type InsightTone = 'positive' | 'negative' | 'neutral' | 'warning'

export interface Insight {
  id: string
  tone: InsightTone
  text: string
}
