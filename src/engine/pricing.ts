import type { Cents } from './money'
import type { IsoDate } from './dates'
import type { ContractMonths, Gift, MonthlyItem, Offer, OfferDiscount, VodafoneCombo } from './types'
import type { Catalog as CatalogV2 } from './catalog'
import { offerProduct } from './product'

/**
 * Prijsconfiguratie v3 — de enige bron van waarheid voor pakketprijzen.
 *
 * Kernregel: een pakketprijs komt altijd uit de prijsmatrix (internet × tv × bellen).
 * Er wordt NOOIT een losse tv-prijs bij een internetprijs opgeteld.
 * Ontbreekt een prijs of is hij niet gecontroleerd, dan meldt de motor
 * "Prijs of combinatie nog controleren" en komt er geen klantvergelijking.
 */
export const PRICING_SCHEMA_VERSION = 3

export interface Source {
  url: string | null
  /** Datum waarop de adviseur dit bedrag heeft gecontroleerd; null = niet gecontroleerd. */
  verifiedOn: IsoDate | null
}

export interface InternetProduct {
  id: string
  name: string
  downloadMbps: number
  uploadMbps: number | null
  /** Aantal wifi-versterkers dat volgens de aanbieder is inbegrepen. */
  includedExtenders: number
  /** Referentiebedrag Vodafone-combinatiekorting op de Ziggo-rekening; null = onbekend. */
  vodafoneDiscountCents: Cents | null
  available: boolean
  source: Source
  internalNotes: string
}

export interface TvPackage {
  id: string
  name: string
  /** Korte omschrijving voor de klant, één punt per regel. */
  features: string[]
  includedReceivers: number
  /** Id's van extra diensten die al in dit pakket zitten (worden nooit apart berekend). */
  includes: string[]
  available: boolean
  source: Source
}

/** Eén cel uit de prijsmatrix: volledige pakketprijs per maand, incl. btw. */
export interface PackagePrice {
  internetId: string
  /** null = alleen internet. */
  tvId: string | null
  phone: boolean
  cents: Cents | null
  source: Source
}

export type ExtraCategory = 'apparatuur' | 'sport' | 'entertainment' | 'streaming' | 'bundel' | 'specialistisch'

export interface ExtraService {
  id: string
  name: string
  category: ExtraCategory
  /** Exacte maandprijs; null = nog invullen (bv. bij een "vanaf"-prijs). */
  monthlyCents: Cents | null
  /** Geadverteerde "vanaf"-prijs, puur ter referentie; wordt nooit als offerteprijs gebruikt. */
  fromCents: Cents | null
  oneTimeCents: Cents
  requiresTv: boolean
  /** Aantal instelbaar (ontvangers, wifi-versterkers). */
  countable: boolean
  maxQuantity: number
  /** Bij een bundel: de diensten die erin zitten (worden dan niet apart berekend). */
  includes: string[]
  /** Aandachtspunt voor de adviseur, bv. een geschiktheidscontrole. */
  eligibilityNote: string
  /** Alleen tonen onder "Meer opties". */
  moreOptions: boolean
  available: boolean
  source: Source
}

export interface GiftDefinition extends Gift {
  id: string
  available: boolean
}

export type PromotionStatus = 'concept' | 'gecontroleerd' | 'verlopen'
export type PromotionChannel = 'openbaar' | 'eigen'

export interface Promotion {
  id: string
  name: string
  /** 'openbaar' = actie van de website; 'eigen' = Mijn Salesacties (deur-aan-deur). */
  channel: PromotionChannel
  status: PromotionStatus
  validFrom: IsoDate | null
  validTo: IsoDate | null
  /** Minimale contractduur waarvoor de actie geldt (of precies deze duur bij `contractExact`). */
  contractMonths: ContractMonths
  /** true = alleen bij precies deze contractduur (bv. een actie die er alleen bij 1 jaar is). */
  contractExact?: boolean
  /** Aantal actiemaanden (3, 6, 9, 12, …); null = hele contractduur. */
  durationMonths: number | null
  /** Vaste actieprijs per pakket (sleutel = packageKey). Alleen deze pakketten komen in aanmerking. */
  fixedPrices: Record<string, Cents>
  /**
   * Afwijkend aantal actiemaanden per pakketcategorie (bv. Internet + Vaste telefonie).
   * Ontbreekt de categorie, dan geldt `durationMonths`; null = hele contractduur.
   * Optioneel, zodat oudere opgeslagen acties ongewijzigd blijven werken.
   */
  categoryMonths?: Partial<Record<PackageCategory, number | null>>
  /** Korting per maand bovenop de pakketprijs (0 = geen). */
  monthlyDiscountCents: Cents
  /**
   * Procentuele korting op de pakketprijs (internet, tv en vast bellen samen) tijdens de actiemaanden.
   * Extra diensten, losse apparatuur en eenmalige kosten krijgen nooit deze korting.
   */
  percentDiscount?: number
  /** Korting op eenmalige kosten (bv. gratis aansluiting/installatie). */
  oneTimeDiscountCents: Cents
  giftId: string | null
  /** Acties met dezelfde groep zijn niet te combineren. */
  exclusiveGroup: string | null
  requiresTv: boolean
  /** Voorwaarden om in aanmerking te komen (zichtbaar voor de klant). */
  conditions: string
  /** Overige voordelen in woorden (bv. gratis apparatuur). */
  benefits: string
  source: Source
  internalNotes: string
}

export interface PricingCatalog {
  schemaVersion: number
  /** Datum van de meegeleverde basisprijzen. */
  seedDate: IsoDate
  provider: string
  internet: InternetProduct[]
  tv: TvPackage[]
  prices: PackagePrice[]
  extras: ExtraService[]
  gifts: GiftDefinition[]
  promotions: Promotion[]
  /** Eenmalige aansluitkosten; null = nog invullen (0 mag). */
  activationCents: Cents | null
  vodafone: { conditions: string; source: Source }
}

/** Wat de adviseur in stap 2 kiest. */
export interface Selection {
  internetId: string | null
  tvId: string | null
  phone: boolean
  /** Extra diensten met aantal (aan = 1). */
  extras: Record<string, number>
  promotionIds: string[]
  /** Per advies bevestigde bedragen: `<extraId>` of `promo:<promotionId>`. */
  overrides: Record<string, Cents>
  contractMonths: ContractMonths
}

export const emptySelection = (): Selection => ({ internetId: null, tvId: null, phone: false, extras: {}, promotionIds: [], overrides: {}, contractMonths: 24 })

/** De vier soorten pakketten waarvoor een actie een eigen prijs en looptijd kan hebben. */
export type PackageCategory = 'internet' | 'internet_tv' | 'internet_bellen' | 'alles_in_1'

export const PACKAGE_CATEGORIES: { id: PackageCategory; label: string; tv: boolean; phone: boolean }[] = [
  { id: 'internet', label: 'Alleen internet', tv: false, phone: false },
  { id: 'internet_tv', label: 'Internet + TV', tv: true, phone: false },
  { id: 'internet_bellen', label: 'Internet + Vaste telefonie', tv: false, phone: true },
  { id: 'alles_in_1', label: 'Internet + TV + Vaste telefonie', tv: true, phone: true },
]

export const packageCategory = (tvId: string | null, phone: boolean): PackageCategory => (tvId ? (phone ? 'alles_in_1' : 'internet_tv') : phone ? 'internet_bellen' : 'internet')

/** Aantal actiemaanden voor deze pakketcategorie; null = hele contractduur. */
export function promotionMonths(p: Pick<Promotion, 'durationMonths' | 'categoryMonths'>, category: PackageCategory): number | null {
  const own = p.categoryMonths?.[category]
  return own === undefined ? p.durationMonths : own
}

/** Pakketsleutels van één categorie in een actie. */
export const keysInCategory = (fixedPrices: Record<string, Cents>, category: PackageCategory): string[] =>
  Object.keys(fixedPrices).filter((k) => {
    const [, tv, phone] = k.split('|')
    return packageCategory(tv === 'geen-tv' ? null : tv, phone === 'bellen') === category
  })

export const packageKey = (internetId: string, tvId: string | null, phone: boolean): string => `${internetId}|${tvId ?? 'geen-tv'}|${phone ? 'bellen' : 'geen-bellen'}`

export function findPrice(catalog: PricingCatalog, internetId: string, tvId: string | null, phone: boolean): PackagePrice | undefined {
  return catalog.prices.find((p) => p.internetId === internetId && p.tvId === tvId && p.phone === phone)
}

/** Bruikbaar voor een offerte: bedrag ingevuld én gecontroleerd. */
export const isVerifiedPrice = (p: PackagePrice | undefined): p is PackagePrice & { cents: Cents } => !!p && p.cents !== null && p.source.verifiedOn !== null

export const formatSpeed = (mbps: number): string => (mbps >= 1000 ? `${String(mbps / 1000).replace('.', ',')} Gbit/s` : `${mbps} Mbit/s`)

export const CHECK_MESSAGE = 'Prijs of combinatie nog controleren'

/** Waarom een actie nu niet te gebruiken is; null = bruikbaar. */
export function promotionBlockedReason(p: Promotion, today: IsoDate, contractMonths: ContractMonths, hasTv: boolean): string | null {
  if (p.status === 'concept') return 'Concept: nog niet gecontroleerd'
  if (p.status === 'verlopen' || (p.validTo && p.validTo < today)) return 'Verlopen'
  if (p.validFrom && p.validFrom > today) return 'Nog niet geldig'
  if (p.contractExact ? p.contractMonths !== contractMonths : p.contractMonths > contractMonths) return `Alleen bij ${p.contractMonths} maanden contract`
  if (p.requiresTv && !hasTv) return 'Alleen bij Internet + TV'
  return null
}

/** Bepaalt de pakketprijs tijdens de actie: een vaste actieprijs of een percentage korting. Max. één tegelijk. */
const isFixedPrice = (p: Promotion) => Object.keys(p.fixedPrices).length > 0 || (p.percentDiscount ?? 0) > 0

/** Actieprijs bij een procentuele korting, afgerond op hele centen. */
export const percentPrice = (regular: Cents, percent: number): Cents => Math.round((regular * (100 - percent)) / 100)

/** Kiest/vervangt een actie; acties uit dezelfde groep en een tweede vaste actieprijs vallen af. */
export function togglePromotion(catalog: PricingCatalog, selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id)
  const promo = catalog.promotions.find((p) => p.id === id)
  if (!promo) return selected
  const group = promo.exclusiveGroup?.trim().toLowerCase()
  const kept = selected.filter((x) => {
    const other = catalog.promotions.find((p) => p.id === x)
    if (!other) return false
    if (group && other.exclusiveGroup?.trim().toLowerCase() === group) return false
    if (isFixedPrice(promo) && isFixedPrice(other)) return false
    if (promo.giftId && other.giftId) return false
    return true
  })
  return [...kept, id]
}

export interface PriceLine {
  kind: 'pakket' | 'extra' | 'inbegrepen' | 'discount' | 'onetime'
  label: string
  cents: Cents
  note?: string
}

export interface Issue {
  message: string
  /** true = geen klantvergelijking mogelijk tot dit is opgelost. */
  blocking: boolean
  /** Sleutel waarmee de adviseur ter plekke een gecontroleerd bedrag kan invullen. */
  overrideKey?: string
  /** Oplossen door de eenmalige aansluitkosten in te vullen. */
  needsActivation?: boolean
}

export type ExtraState = 'berekend' | 'inbegrepen' | 'in_bundel' | 'controleren'

export interface Composed {
  /** null zolang er geen internetpakket is gekozen. */
  offer: Offer | null
  issues: Issue[]
  lines: PriceLine[]
  extraStates: Record<string, ExtraState>
}

const oldest = (dates: (IsoDate | null)[]): IsoDate | null => {
  const known = dates.filter((d): d is IsoDate => !!d)
  return known.length ? known.reduce((a, b) => (a < b ? a : b)) : null
}

/** Centrale prijsmotor: maakt van een selectie één Offer voor de maand-voor-maand-berekening. */
export function composeOffer(catalog: PricingCatalog, sel: Selection, today: IsoDate): Composed {
  const issues: Issue[] = []
  const lines: PriceLine[] = []
  const extraStates: Record<string, ExtraState> = {}
  const internet = sel.internetId ? catalog.internet.find((i) => i.id === sel.internetId) : undefined
  if (!internet) return { offer: null, issues, lines, extraStates }
  const tv = sel.tvId ? catalog.tv.find((t) => t.id === sel.tvId) : undefined
  const hasTv = !!tv
  const key = packageKey(internet.id, tv?.id ?? null, sel.phone)
  const category = packageCategory(tv?.id ?? null, sel.phone)
  const verifiedDates: (IsoDate | null)[] = []

  // 1–3. Pakketprijs uit de matrix; nooit optellen van losse onderdelen.
  const entry = findPrice(catalog, internet.id, tv?.id ?? null, sel.phone)
  const name = [internet.name, tv?.name, sel.phone ? 'Bellen' : null].filter(Boolean).join(' + ')
  let regular = 0
  if (!internet.available || (tv && !tv.available) || !isVerifiedPrice(entry)) {
    const noPhonePrice = sel.phone && !tv && internet.available && !isVerifiedPrice(entry)
    issues.push({ blocking: true, message: `${CHECK_MESSAGE}: ${name}${noPhonePrice ? '. De normale maandprijs voor internet met vaste telefonie (nodig na de actie) staat nog niet in Prijzen & Aanbiedingen → Alles-in-1.' : ''}` })
  } else {
    regular = entry.cents
    verifiedDates.push(entry.source.verifiedOn)
  }
  lines.push({ kind: 'pakket', label: name, cents: regular })
  const includes: string[] = [`Internet ${formatSpeed(internet.downloadMbps)}`]
  if (tv) includes.push(tv.name)
  if (sel.phone) includes.push('Vast bellen')

  // 6–8. Extra's: inbegrepen diensten en onderdelen van een gekozen bundel kosten niets extra.
  const chosen = Object.entries(sel.extras)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ extra: catalog.extras.find((e) => e.id === id), qty }))
    .filter((x): x is { extra: ExtraService; qty: number } => !!x.extra && (!x.extra.requiresTv || hasTv))
  const tvIncluded = new Set(tv?.includes ?? [])
  const coveredBy = new Map<string, string>()
  const extras: MonthlyItem[] = []
  let extrasOneTime = 0
  // Bundels eerst, zodat hun onderdelen daarna als "in bundel" herkend worden.
  for (const { extra: e, qty } of [...chosen].sort((a, b) => b.extra.includes.length - a.extra.includes.length)) {
    const count = e.countable ? Math.min(qty, e.maxQuantity) : 1
    const label = count > 1 ? `${count}× ${e.name}` : e.name
    if (tvIncluded.has(e.id)) {
      extraStates[e.id] = 'inbegrepen'
      lines.push({ kind: 'inbegrepen', label: e.name, cents: 0, note: `inbegrepen bij ${tv!.name}` })
      continue
    }
    if (coveredBy.has(e.id)) {
      extraStates[e.id] = 'in_bundel'
      lines.push({ kind: 'inbegrepen', label: e.name, cents: 0, note: `zit in ${coveredBy.get(e.id)}` })
      continue
    }
    const override = sel.overrides[e.id]
    const overlap = e.includes.find((id) => tvIncluded.has(id) || coveredBy.has(id))
    let price: Cents | null = override ?? e.monthlyCents
    if (overlap && override === undefined) {
      // Bundel overlapt met iets dat de klant al heeft: geen korting verzinnen, laten bevestigen.
      const what = catalog.extras.find((x) => x.id === overlap)?.name ?? 'een inbegrepen dienst'
      issues.push({ blocking: true, overrideKey: e.id, message: `${CHECK_MESSAGE}: ${e.name} overlapt met ${what}${tvIncluded.has(overlap) ? ` (inbegrepen bij ${tv!.name})` : ''}. Vul de geldende prijs in.` })
      extraStates[e.id] = 'controleren'
      price = null
    } else if (price === null || (override === undefined && e.source.verifiedOn === null) || !e.available) {
      issues.push({ blocking: true, overrideKey: e.id, message: `${CHECK_MESSAGE}: ${e.name}${e.fromCents !== null ? ' (alleen een vanaf-prijs bekend)' : ''}.` })
      extraStates[e.id] = 'controleren'
      price = null
    } else {
      extraStates[e.id] = 'berekend'
      if (override === undefined) verifiedDates.push(e.source.verifiedOn)
    }
    for (const id of e.includes) coveredBy.set(id, e.name)
    if (price !== null) {
      extras.push({ id: e.id, label, monthlyCents: price * count })
      extrasOneTime += e.oneTimeCents * count
      lines.push({ kind: 'extra', label, cents: price * count })
      includes.push(label)
      if (e.eligibilityNote && override === undefined) issues.push({ blocking: false, message: `${e.name}: ${e.eligibilityNote}` })
    }
  }

  // 4–5, 9. Acties: alleen gecontroleerd en geldig; één per groep; één vaste actieprijs.
  const discounts: OfferDiscount[] = []
  const conditions: string[] = []
  const seenGroups = new Set<string>()
  let promoMonthly = regular
  let promoMonths = 0
  let oneTimeDiscount = 0
  let gift: Gift | null = null
  let promoValidTo: IsoDate | null = null
  let fixedUsed = false
  let giftUsed = false
  const promoNames: string[] = []
  for (const id of sel.promotionIds) {
    const p = catalog.promotions.find((x) => x.id === id)
    if (!p) continue
    const blocked = promotionBlockedReason(p, today, sel.contractMonths, hasTv)
    if (blocked) {
      issues.push({ blocking: false, message: `Actie “${p.name}” telt niet mee: ${blocked.toLowerCase()}.` })
      continue
    }
    const group = p.exclusiveGroup?.trim().toLowerCase()
    if (group) {
      if (seenGroups.has(group)) continue
      seenGroups.add(group)
    }
    // Nooit twee welkomstcadeaus, ook niet als ze (per ongeluk) in verschillende groepen staan.
    if (p.giftId && giftUsed) continue
    // Looptijd volgt de pakketcategorie (bv. een eigen looptijd voor Internet + Vaste telefonie).
    const months = promotionMonths(p, category)
    if (isFixedPrice(p)) {
      if (fixedUsed) continue
      fixedUsed = true
      const pct = p.percentDiscount ?? 0
      const price = pct > 0 ? percentPrice(regular, pct) : (sel.overrides[`promo:${p.id}`] ?? p.fixedPrices[key])
      if (price === undefined) {
        issues.push({ blocking: true, overrideKey: `promo:${p.id}`, message: `${CHECK_MESSAGE}: de actie “${p.name}” is niet toegewezen aan ${name}. Bevestig de actieprijs voor dit pakket.` })
        continue
      }
      // Vaste actieprijs = volledige pakketprijs voor precies deze combinatie (ook met bellen):
      // er komt nooit een toeslag voor bellen bovenop.
      promoMonthly = price
      promoMonths = months ?? sel.contractMonths
      lines.push({ kind: 'discount', label: p.name, cents: price - regular, note: `eerste ${promoMonths} maanden${pct > 0 ? `, ${pct}% op het abonnement` : ''}` })
    }
    if (p.monthlyDiscountCents > 0) {
      discounts.push({ id: p.id, label: p.name, monthlyCents: p.monthlyDiscountCents, fromMonth: 1, toMonth: months, exclusiveGroup: p.exclusiveGroup })
      lines.push({ kind: 'discount', label: p.name, cents: -p.monthlyDiscountCents, note: months ? `${months} maanden` : 'hele looptijd' })
    }
    oneTimeDiscount += p.oneTimeDiscountCents
    if (p.giftId) giftUsed = true
    promoNames.push(p.name)
    if (p.giftId && !gift) {
      const g = catalog.gifts.find((x) => x.id === p.giftId && x.available)
      if (g) {
        const { id: _id, available: _available, ...rest } = g
        void _id
        void _available
        gift = rest
      }
    }
    if (p.conditions.trim()) conditions.push(`${p.name}: ${p.conditions.trim()}`)
    if (p.benefits.trim()) includes.push(p.benefits.trim())
    if (p.validTo && (!promoValidTo || p.validTo < promoValidTo)) promoValidTo = p.validTo
    verifiedDates.push(p.source.verifiedOn)
  }

  // 11. Eenmalige kosten horen in de vergelijking; onbekend = eerst invullen.
  let activation = 0
  if (catalog.activationCents === null) issues.push({ blocking: true, needsActivation: true, message: 'Eenmalige aansluitkosten zijn nog niet ingevuld (€ 0 mag ook).' })
  else activation = Math.max(0, catalog.activationCents - oneTimeDiscount)
  const oneTime = activation + extrasOneTime
  if (oneTime > 0) lines.push({ kind: 'onetime', label: 'Eenmalige kosten', cents: oneTime })

  const offer: Offer = {
    id: `pakket:${key}`,
    name,
    provider: catalog.provider,
    kind: hasTv ? 'internet_tv' : 'internet',
    speedMbps: internet.downloadMbps,
    contractMonths: sel.contractMonths,
    promoMonthlyCents: promoMonthly,
    promoMonths,
    regularMonthlyCents: regular,
    activationCents: activation,
    installationCents: 0,
    equipmentCents: extrasOneTime,
    extras,
    discounts,
    gift,
    validFrom: today,
    validTo: promoValidTo ?? today,
    version: `prijzen-v${catalog.schemaVersion}`,
    isExample: false,
    conditions: conditions.join(' '),
    internalNotes: '',
    includes,
    promoName: promoNames.join(' + ') || undefined,
    promoValidTo,
    pricesVerifiedOn: oldest(verifiedDates),
    product: offerProduct(catalog, internet, tv, sel),
  }
  return { offer, issues, lines, extraStates }
}

/** Bedragen die langer dan `days` dagen niet zijn gecontroleerd (of nooit). */
export function staleCount(catalog: PricingCatalog, today: IsoDate, days = 30): number {
  const [y, m, d] = today.split('-').map(Number)
  const limit = new Date(y, m - 1, d - days)
  const cutoff = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`
  const stale = (s: Source) => s.verifiedOn !== null && s.verifiedOn < cutoff
  return catalog.prices.filter((p) => p.cents !== null && stale(p.source)).length + catalog.extras.filter((e) => e.available && e.monthlyCents !== null && stale(e.source)).length + catalog.promotions.filter((p) => p.status === 'gecontroleerd' && stale(p.source)).length
}

export const lastVerified = (catalog: PricingCatalog): IsoDate | null => oldest(catalog.prices.filter((p) => p.cents !== null).map((p) => p.source.verifiedOn))

/* ---------- import / validatie ---------- */

const isCents = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0)

/** Controleert een geïmporteerd bestand. Gooit een fout met alle gevonden problemen. */
export function parsePricingExport(raw: unknown): PricingCatalog {
  const data = raw as { app?: string; schemaVersion?: number; pricing?: Partial<PricingCatalog> }
  if (!data || data.app !== 'overstapadvies' || !data.pricing || typeof data.pricing !== 'object') throw new Error('Dit is geen prijzenbestand van deze app (of het is van een oudere versie).')
  if ((data.schemaVersion ?? 0) > PRICING_SCHEMA_VERSION) throw new Error('Dit bestand komt uit een nieuwere versie van de app.')
  const c = data.pricing
  const errors: string[] = []
  const list = <T,>(v: unknown, name: string): T[] => {
    if (!Array.isArray(v)) {
      errors.push(`Onderdeel “${name}” ontbreekt.`)
      return []
    }
    return v as T[]
  }
  const internet = list<InternetProduct>(c.internet, 'internet')
  const tv = list<TvPackage>(c.tv, 'tv')
  const prices = list<PackagePrice>(c.prices, 'prijzen')
  const extras = list<ExtraService>(c.extras, 'extra diensten')
  const gifts = list<GiftDefinition>(c.gifts, 'cadeaus')
  const promotions = list<Promotion>(c.promotions, 'acties')
  const unique = (items: { id?: unknown }[], name: string) => {
    const ids = items.map((i) => i.id)
    if (ids.some((id) => typeof id !== 'string' || !id)) errors.push(`${name}: een regel heeft geen geldig id.`)
    if (new Set(ids).size !== ids.length) errors.push(`${name}: dubbele id's gevonden.`)
  }
  unique(internet, 'Internet')
  unique(tv, 'Tv-pakketten')
  unique(extras, 'Extra diensten')
  unique(gifts, 'Cadeaus')
  unique(promotions, 'Acties')
  const netIds = new Set(internet.map((i) => i.id))
  const tvIds = new Set(tv.map((t) => t.id))
  prices.forEach((p, i) => {
    if (!isCents(p.cents)) errors.push(`Prijs ${i + 1}: bedrag moet een geheel aantal centen zijn.`)
    if (!netIds.has(p.internetId)) errors.push(`Prijs ${i + 1}: onbekend internetpakket “${p.internetId}”.`)
    if (p.tvId !== null && !tvIds.has(p.tvId)) errors.push(`Prijs ${i + 1}: onbekend tv-pakket “${p.tvId}”.`)
  })
  extras.forEach((e) => {
    if (!isCents(e.monthlyCents)) errors.push(`${e.name}: ongeldig maandbedrag.`)
  })
  promotions.forEach((p) => {
    if (!['concept', 'gecontroleerd', 'verlopen'].includes(p.status)) errors.push(`${p.name}: onbekende status.`)
    if (!p.fixedPrices || Object.values(p.fixedPrices).some((v) => !isCents(v) || v === null)) errors.push(`${p.name}: ongeldige actieprijs.`)
    if (p.percentDiscount !== undefined && !(typeof p.percentDiscount === 'number' && p.percentDiscount >= 0 && p.percentDiscount <= 100)) errors.push(`${p.name}: ongeldig kortingspercentage.`)
    if (p.categoryMonths !== undefined && (typeof p.categoryMonths !== 'object' || p.categoryMonths === null || Object.values(p.categoryMonths).some((v) => v !== null && !(Number.isInteger(v) && (v as number) > 0)))) errors.push(`${p.name}: ongeldig aantal actiemaanden per categorie.`)
  })
  if (!isCents(c.activationCents ?? null)) errors.push('Eenmalige aansluitkosten: ongeldig bedrag.')
  if (errors.length) throw new Error(errors.slice(0, 6).join(' '))
  return {
    schemaVersion: PRICING_SCHEMA_VERSION,
    seedDate: typeof c.seedDate === 'string' ? c.seedDate : '',
    provider: typeof c.provider === 'string' ? c.provider : 'Ziggo',
    internet,
    tv,
    prices,
    extras,
    gifts,
    promotions,
    activationCents: c.activationCents ?? null,
    vodafone: { conditions: c.vodafone?.conditions ?? '', source: c.vodafone?.source ?? { url: null, verifiedOn: null } },
  }
}

/**
 * Migratie v2 → v3. De basisprijzen komen uit de nieuwe seed; zelf aangemaakte
 * (niet-voorbeeld) extra's en acties gaan mee. Acties komen als "concept" binnen
 * onder Mijn Salesacties, zodat de adviseur ze eerst opnieuw controleert.
 */
export function migrateCatalogV2(old: CatalogV2 | undefined, seed: PricingCatalog): PricingCatalog {
  if (!old) return seed
  const none: Source = { url: null, verifiedOn: null }
  const extras: ExtraService[] = (old.extras ?? [])
    .filter((e) => !e.isExample)
    .map((e) => ({ id: e.id, name: e.name, category: e.category === 'sport' ? 'sport' : 'entertainment', monthlyCents: e.monthlyCents, fromCents: null, oneTimeCents: e.oneTimeCents, requiresTv: e.requiresTv, countable: false, maxQuantity: 1, includes: [], eligibilityNote: '', moreOptions: false, available: e.available, source: none }))
  const gifts: GiftDefinition[] = []
  const promotions: Promotion[] = (old.promotions ?? [])
    .filter((p) => !p.isExample)
    .map((p) => {
      if (p.gift) gifts.push({ ...p.gift, id: `gift-${p.id}`, available: true })
      return { id: p.id, name: p.name, channel: 'eigen', status: 'concept', validFrom: p.validFrom, validTo: p.validTo, contractMonths: 24, durationMonths: p.durationMonths, fixedPrices: {}, monthlyDiscountCents: p.monthlyDiscountCents, oneTimeDiscountCents: p.oneTimeDiscountCents, giftId: p.gift ? `gift-${p.id}` : null, exclusiveGroup: p.exclusiveGroup, requiresTv: p.requiresTv, conditions: p.conditions, benefits: '', source: none, internalNotes: 'Overgenomen uit de vorige versie; opnieuw controleren.' }
    })
  const taken = new Set(seed.extras.map((e) => e.id))
  return { ...seed, extras: [...seed.extras, ...extras.filter((e) => !taken.has(e.id))], gifts: [...seed.gifts, ...gifts], promotions: [...seed.promotions, ...promotions] }
}

/**
 * Voegt nieuwe basisacties en -cadeaus toe aan een bestaande configuratie.
 * Bestaande regels (ook door de adviseur aangepaste) blijven exact zoals ze zijn.
 */
export function addMissingSeedItems(current: PricingCatalog, seed: PricingCatalog): PricingCatalog {
  const missing = <T extends { id: string }>(mine: T[], theirs: T[]) => theirs.filter((t) => !mine.some((m) => m.id === t.id))
  return { ...current, gifts: [...current.gifts, ...missing(current.gifts, seed.gifts)], promotions: [...current.promotions, ...missing(current.promotions, seed.promotions)] }
}

/**
 * Promotie-update (v5): vervangen acties gaan op "Verlopen" (niet verwijderd, zodat oude
 * adviezen herleidbaar blijven) en de nieuwe basisacties komen bovenaan. Al het andere
 * (prijzen, eigen acties, cadeaus, extra's) blijft precies zoals de adviseur het had.
 */
export function applyPromotionUpdate(current: PricingCatalog, seed: PricingCatalog, replacedIds: string[], note: string): PricingCatalog {
  const updated = current.promotions.map((p) => (replacedIds.includes(p.id) && p.status !== 'verlopen' ? { ...p, status: 'verlopen' as const, internalNotes: [note, p.internalNotes].filter(Boolean).join(' ') } : p))
  const missing = seed.promotions.filter((s) => !updated.some((p) => p.id === s.id))
  const fresh = missing.filter((p) => p.channel === 'eigen')
  const gifts = [...current.gifts, ...seed.gifts.filter((g) => !current.gifts.some((x) => x.id === g.id))]
  return { ...current, gifts, promotions: [...fresh, ...updated, ...missing.filter((p) => p.channel !== 'eigen')] }
}

/**
 * Andere contractduur gekozen: acties die niet meer gelden vallen af. Stond er een actie met
 * actieprijs of procentkorting, dan komt de eerste geldige van hetzelfde soort ervoor in de plaats
 * (bv. 12 × € 34,95 bij 24 maanden → 9 × € 34,95 bij 12 maanden). Een cadeau wordt nooit vervangen.
 */
export function promotionsForContract(catalog: PricingCatalog, selected: string[], contractMonths: ContractMonths, today: IsoDate, hasTv: boolean): string[] {
  const ok = (p: Promotion) => !promotionBlockedReason(p, today, contractMonths, hasTv)
  const chosen = selected.map((id) => catalog.promotions.find((p) => p.id === id)).filter((p): p is Promotion => !!p)
  const kept = chosen.filter(ok).map((p) => p.id)
  const lostPrice = chosen.some((p) => !ok(p) && isFixedPrice(p))
  if (!lostPrice || chosen.some((p) => ok(p) && isFixedPrice(p))) return kept
  const replacement = catalog.promotions.find((p) => p.channel === 'eigen' && isFixedPrice(p) && !p.giftId && ok(p))
  return replacement ? togglePromotion(catalog, kept, replacement.id) : kept
}

/**
 * "Vodafone op dit adres": het combinatievoordeel komt uit de centrale instelling per snelheid.
 * Uit = geen voordeel. Onbekend bedrag (null) = niets verrekenen, nooit een bedrag verzinnen.
 */
export function vodafoneFor(combo: VodafoneCombo, internet: Pick<InternetProduct, 'vodafoneDiscountCents'> | undefined): VodafoneCombo {
  if (!combo.hasVodafone || !combo.eligible) return combo
  return { ...combo, monthlyDiscountCents: internet?.vodafoneDiscountCents ?? 0 }
}

export const vodafoneOn = (on: boolean, internet: Pick<InternetProduct, 'vodafoneDiscountCents'> | undefined): Pick<VodafoneCombo, 'hasVodafone' | 'eligible' | 'monthlyDiscountCents'> =>
  on ? { hasVodafone: true, eligible: true, monthlyDiscountCents: internet?.vodafoneDiscountCents ?? 0 } : { hasVodafone: false, eligible: false, monthlyDiscountCents: 0 }
