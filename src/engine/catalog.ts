import type { Cents } from './money'
import type { IsoDate } from './dates'
import type { ContractMonths, Gift, MonthlyItem, Offer, OfferDiscount } from './types'

/**
 * Prijsconfiguratie ("Prijzen & Aanbiedingen").
 * Losse onderdelen die de pakketbouwer combineert tot één Offer voor de rekenmotor:
 *   internet + tv + extra's − acties + eenmalige kosten.
 * Een prijs van `null` betekent "nog niet ingevuld": de app vraagt er dan om
 * en verzint nooit zelf een bedrag.
 */
export const CATALOG_SCHEMA_VERSION = 2

interface Base {
  id: string
  name: string
  available: boolean
  /** Voorbeelddata met verzonnen prijzen; nog niet gecontroleerd. */
  isExample: boolean
}

export interface InternetProduct extends Base {
  downloadMbps: number
  uploadMbps: number | null
  regularMonthlyCents: Cents | null
  /** null = geen actieprijs. */
  promoMonthlyCents: Cents | null
  promoMonths: number
  contractMonths: ContractMonths
  oneTimeCents: Cents
  validFrom: IsoDate | null
  validTo: IsoDate | null
  internalNotes: string
}

export interface TvPackage extends Base {
  /** Meerprijs per maand bovenop internet. */
  monthlyCents: Cents | null
  features: string
  includedReceivers: number
  extraReceiverMonthlyCents: Cents | null
}

export type ExtraCategory = 'entertainment' | 'sport' | 'overig'
export interface ExtraProduct extends Base {
  category: ExtraCategory
  monthlyCents: Cents | null
  oneTimeCents: Cents
  requiresTv: boolean
}

export type PromotionType = 'standaard' | 'black_friday' | 'cadeau' | 'tijdelijk'
export interface Promotion extends Base {
  type: PromotionType
  monthlyDiscountCents: Cents
  /** Aantal maanden korting (3, 6, 9, 12, …); null = hele looptijd. */
  durationMonths: number | null
  /** Korting op eenmalige kosten (bv. gratis activatie). */
  oneTimeDiscountCents: Cents
  gift: Gift | null
  /** Voorwaarden om in aanmerking te komen (zichtbaar voor de klant). */
  conditions: string
  /** Acties met dezelfde groep sluiten elkaar uit. */
  exclusiveGroup: string | null
  requiresTv: boolean
  validFrom: IsoDate | null
  validTo: IsoDate | null
}

export interface VodafoneConfig {
  /** Gecontroleerde standaardkorting; null = adviseur vult per klant in. */
  monthlyDiscountCents: Cents | null
  extraBenefits: string
  conditions: string
}

export interface Catalog {
  schemaVersion: number
  provider: string
  internet: InternetProduct[]
  tv: TvPackage[]
  extras: ExtraProduct[]
  promotions: Promotion[]
  vodafone: VodafoneConfig
}

/** Wat de adviseur in stap 2 aantikt. */
export interface Selection {
  internetId: string | null
  /** null = alleen internet. */
  tvId: string | null
  /** Vaste bundel (totaalprijs); vervangt internet + tv, zodat niets dubbel telt. */
  bundleId: string | null
  extraIds: string[]
  extraReceivers: number
  promotionIds: string[]
  /** null = contractduur van het gekozen product (standaard 24). */
  contractMonths: ContractMonths | null
}

export const emptySelection = (): Selection => ({ internetId: null, tvId: null, bundleId: null, extraIds: [], extraReceivers: 0, promotionIds: [], contractMonths: null })

export interface PriceLine {
  kind: 'internet' | 'tv' | 'bundle' | 'extra' | 'discount' | 'onetime'
  label: string
  /** Per maand (negatief bij korting) of eenmalig bedrag bij kind 'onetime'. */
  cents: Cents
  note?: string
}

export interface Composed {
  /** null zolang er geen internetpakket of bundel is gekozen. */
  offer: Offer | null
  /** Onderdelen waarvan de prijs nog ontbreekt; presenteren is dan geblokkeerd. */
  missing: string[]
  lines: PriceLine[]
}

export const formatSpeed = (mbps: number): string => (mbps >= 1000 ? `${String(mbps / 1000).replace('.', ',')} Gbit/s` : `${mbps} Mbit/s`)

export function isActive(item: { available: boolean; validFrom?: IsoDate | null; validTo?: IsoDate | null }, today: IsoDate): boolean {
  return item.available && (!item.validFrom || item.validFrom <= today) && (!item.validTo || item.validTo >= today)
}

/** Kiest/vervangt een actie; acties uit dezelfde exclusieve groep vallen dan af. */
export function togglePromotion(catalog: Catalog, selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id)
  const promo = catalog.promotions.find((p) => p.id === id)
  const group = promo?.exclusiveGroup?.trim().toLowerCase()
  const kept = group ? selected.filter((x) => catalog.promotions.find((p) => p.id === x)?.exclusiveGroup?.trim().toLowerCase() !== group) : selected
  return [...kept, id]
}

const promoDuration = (p: Promotion) => (p.durationMonths ? `${p.durationMonths} maanden` : 'hele looptijd')

/** Stelt uit de catalogus en een selectie één Offer samen voor de rekenmotor. */
export function composeOffer(catalog: Catalog, bundles: Offer[], sel: Selection, today: IsoDate): Composed {
  const missing: string[] = []
  const lines: PriceLine[] = []
  const bundle = sel.bundleId ? bundles.find((b) => b.id === sel.bundleId) : undefined
  const internet = !bundle && sel.internetId ? catalog.internet.find((i) => i.id === sel.internetId) : undefined
  if (!bundle && !internet) return { offer: null, missing, lines }

  const need = (value: Cents | null, label: string): Cents => {
    if (value === null) missing.push(label)
    return value ?? 0
  }

  let offer: Offer
  let hasTv: boolean
  const includes: string[] = []
  const extras: MonthlyItem[] = []
  let equipmentCents = 0

  if (bundle) {
    // Bundelprijs is al het totaal voor internet (+ tv): geen losse onderdelen erbij tellen.
    offer = structuredClone(bundle)
    hasTv = bundle.kind === 'internet_tv'
    includes.push(...(bundle.includes ?? [`Internet ${formatSpeed(bundle.speedMbps)}`, ...(hasTv ? ['Televisie'] : [])]))
    extras.push(...offer.extras)
    equipmentCents = offer.equipmentCents
    lines.push({ kind: 'bundle', label: bundle.name, cents: bundle.regularMonthlyCents })
    if (bundle.promoMonths > 0 && bundle.promoMonthlyCents !== bundle.regularMonthlyCents) lines.push({ kind: 'discount', label: 'Actiekorting', cents: bundle.promoMonthlyCents - bundle.regularMonthlyCents, note: `eerste ${bundle.promoMonths} maanden` })
  } else {
    const i = internet!
    const tv = sel.tvId ? catalog.tv.find((t) => t.id === sel.tvId) : undefined
    hasTv = !!tv
    const regular = need(i.regularMonthlyCents, `Prijs van ${i.name}`)
    const hasPromo = i.promoMonthlyCents !== null && i.promoMonths > 0
    const promo = hasPromo ? i.promoMonthlyCents! : regular
    const tvCents = tv ? need(tv.monthlyCents, `Prijs van ${tv.name}`) : 0
    includes.push(i.name)
    lines.push({ kind: 'internet', label: i.name, cents: regular })
    if (hasPromo && promo !== regular) lines.push({ kind: 'discount', label: 'Actiekorting internet', cents: promo - regular, note: `eerste ${i.promoMonths} maanden` })
    if (tv) {
      includes.push(tv.name)
      lines.push({ kind: 'tv', label: tv.name, cents: tvCents })
      if (sel.extraReceivers > 0) {
        const per = need(tv.extraReceiverMonthlyCents, `Prijs extra ontvanger (${tv.name})`)
        const label = `${sel.extraReceivers} extra ${sel.extraReceivers === 1 ? 'ontvanger' : 'ontvangers'}`
        extras.push({ id: 'receivers', label, monthlyCents: per * sel.extraReceivers })
        includes.push(label)
      }
    }
    offer = {
      id: `build:${i.id}:${tv?.id ?? 'geen-tv'}`,
      name: tv ? `${i.name} + ${tv.name}` : i.name,
      provider: catalog.provider,
      kind: tv ? 'internet_tv' : 'internet',
      speedMbps: i.downloadMbps,
      contractMonths: i.contractMonths,
      promoMonthlyCents: promo + tvCents,
      promoMonths: hasPromo ? i.promoMonths : 0,
      regularMonthlyCents: regular + tvCents,
      activationCents: i.oneTimeCents,
      installationCents: 0,
      equipmentCents: 0,
      extras: [],
      discounts: [],
      gift: null,
      validFrom: i.validFrom ?? today,
      validTo: i.validTo ?? today,
      version: `config-${catalog.schemaVersion}`,
      isExample: i.isExample || !!tv?.isExample,
      conditions: '',
      internalNotes: '',
    }
  }

  for (const id of sel.extraIds) {
    const e = catalog.extras.find((x) => x.id === id)
    if (!e || (e.requiresTv && !hasTv)) continue
    extras.push({ id: e.id, label: e.name, monthlyCents: need(e.monthlyCents, `Prijs van ${e.name}`) })
    equipmentCents += e.oneTimeCents
    includes.push(e.name)
    if (e.isExample) offer.isExample = true
  }
  for (const e of extras) if (!lines.some((l) => l.label === e.label) && !(bundle && bundle.extras.some((b) => b.id === e.id))) lines.push({ kind: 'extra', label: e.label, cents: e.monthlyCents })

  const discounts: OfferDiscount[] = [...offer.discounts]
  const conditions: string[] = offer.conditions ? [offer.conditions] : []
  let oneTimeDiscount = 0
  let gift = offer.gift
  const seenGroups = new Set<string>()
  for (const id of sel.promotionIds) {
    const p = catalog.promotions.find((x) => x.id === id)
    if (!p || (p.requiresTv && !hasTv)) continue
    // Vangnet: ook als de selectie twee acties uit één groep bevat, telt alleen de eerste.
    const group = p.exclusiveGroup?.trim().toLowerCase()
    if (group) {
      if (seenGroups.has(group)) continue
      seenGroups.add(group)
    }
    if (p.monthlyDiscountCents > 0) {
      discounts.push({ id: p.id, label: p.name, monthlyCents: p.monthlyDiscountCents, fromMonth: 1, toMonth: p.durationMonths, exclusiveGroup: p.exclusiveGroup })
      lines.push({ kind: 'discount', label: p.name, cents: -p.monthlyDiscountCents, note: promoDuration(p) })
    }
    oneTimeDiscount += p.oneTimeDiscountCents
    if (p.gift && !gift) gift = p.gift
    if (p.conditions.trim()) conditions.push(`${p.name}: ${p.conditions.trim()}`)
    if (p.validTo && p.validTo < offer.validTo) offer.validTo = p.validTo
    if (p.isExample) offer.isExample = true
  }

  // Korting op eenmalige kosten: eerst op activatie, nooit onder nul.
  const fromActivation = Math.min(offer.activationCents, oneTimeDiscount)
  offer.activationCents -= fromActivation
  offer.installationCents = Math.max(0, offer.installationCents - (oneTimeDiscount - fromActivation))
  offer.equipmentCents = equipmentCents
  offer.extras = extras
  offer.discounts = discounts
  offer.gift = gift
  offer.conditions = conditions.join(' ')
  offer.includes = includes
  if (sel.contractMonths) offer.contractMonths = sel.contractMonths
  const oneTime = offer.activationCents + offer.installationCents + offer.equipmentCents
  if (oneTime > 0) lines.push({ kind: 'onetime', label: 'Eenmalige kosten', cents: oneTime })

  return { offer, missing, lines }
}

/**
 * Voorbeeldcatalogus met VERZONNEN prijzen (geen actuele Ziggo-tarieven).
 * Wordt alleen gebruikt bij een lege configuratie; overschrijft nooit bestaande gegevens.
 * De Vodafone-korting blijft bewust leeg: die moet de adviseur zelf invullen.
 */
export function sampleCatalog(today: IsoDate): Catalog {
  const year = today.slice(0, 4)
  const valid = { validFrom: `${year}-01-01`, validTo: `${year}-12-31` }
  const ex = { available: true, isExample: true }
  const net = (id: string, name: string, down: number, up: number, regular: number, promo: number): InternetProduct => ({ id, name, downloadMbps: down, uploadMbps: up, regularMonthlyCents: regular, promoMonthlyCents: promo, promoMonths: 12, contractMonths: 24, oneTimeCents: 2000, internalNotes: '', ...valid, ...ex })
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    provider: 'Ziggo',
    internet: [net('vb-net-100', 'Internet 100 Mbit/s', 100, 20, 4750, 2995), net('vb-net-400', 'Internet 400 Mbit/s', 400, 40, 5500, 3495), net('vb-net-1000', 'Internet 1 Gbit/s', 1000, 100, 6750, 4495)],
    tv: [
      { id: 'vb-tv-start', name: 'TV Start', monthlyCents: 1500, features: 'Ruim 60 zenders, terugkijken en opnemen', includedReceivers: 1, extraReceiverMonthlyCents: 500, ...ex },
      { id: 'vb-tv-compleet', name: 'TV Compleet', monthlyCents: 2250, features: 'Ruim 100 zenders, terugkijken, opnemen en extra themazenders', includedReceivers: 1, extraReceiverMonthlyCents: 500, ...ex },
    ],
    extras: [
      { id: 'vb-x-sport', name: 'Sportpakket', category: 'sport', monthlyCents: 1795, oneTimeCents: 0, requiresTv: true, ...ex },
      { id: 'vb-x-film', name: 'Film & Series', category: 'entertainment', monthlyCents: 1295, oneTimeCents: 0, requiresTv: true, ...ex },
    ],
    promotions: [
      { id: 'vb-p-bf', name: 'Black Friday: 3 maanden € 10 extra korting', type: 'black_friday', monthlyDiscountCents: 1000, durationMonths: 3, oneTimeDiscountCents: 0, gift: null, conditions: 'Voorbeeld: alleen voor nieuwe klanten.', exclusiveGroup: 'Seizoensactie', requiresTv: false, ...valid, ...ex },
      { id: 'vb-p-tijdelijk', name: 'Tijdelijke actie: 6 maanden € 5 korting', type: 'tijdelijk', monthlyDiscountCents: 500, durationMonths: 6, oneTimeDiscountCents: 0, gift: null, conditions: '', exclusiveGroup: 'Seizoensactie', requiresTv: false, ...valid, ...ex },
      { id: 'vb-p-activatie', name: 'Gratis activatie', type: 'standaard', monthlyDiscountCents: 0, durationMonths: null, oneTimeDiscountCents: 2000, gift: null, conditions: '', exclusiveGroup: null, requiresTv: false, ...valid, ...ex },
      {
        id: 'vb-p-cadeau',
        name: 'Cadeauactie: smart-tv',
        type: 'cadeau',
        monthlyDiscountCents: 0,
        durationMonths: null,
        oneTimeDiscountCents: 0,
        gift: { type: 'televisie', name: '43-inch smart-tv', imageDataUrl: null, retailValueCents: null, description: 'Smart-tv als welkomstcadeau.', conditions: 'Voorbeeld: op = op, levering na activatie van het abonnement.' },
        conditions: 'Voorbeeld: alleen bij Internet + TV met een contract van 24 maanden.',
        exclusiveGroup: null,
        requiresTv: true,
        ...valid,
        ...ex,
      },
    ],
    vodafone: { monthlyDiscountCents: null, extraBenefits: '', conditions: '' },
  }
}

/** Valideert een geïmporteerd bestand en vult ontbrekende velden veilig aan. */
export function parseCatalogExport(raw: unknown): { catalog: Catalog; bundles: Offer[] | null } {
  const data = raw as { app?: string; catalog?: Partial<Catalog>; bundles?: Offer[]; offers?: Offer[] }
  if (!data || data.app !== 'overstapadvies' || !data.catalog || typeof data.catalog !== 'object') throw new Error('Geen geldige prijsconfiguratie')
  const c = data.catalog
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  return {
    catalog: {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      provider: typeof c.provider === 'string' ? c.provider : 'Ziggo',
      internet: arr<InternetProduct>(c.internet),
      tv: arr<TvPackage>(c.tv),
      extras: arr<ExtraProduct>(c.extras),
      promotions: arr<Promotion>(c.promotions),
      vodafone: { monthlyDiscountCents: null, extraBenefits: '', conditions: '', ...(c.vodafone ?? {}) },
    },
    bundles: Array.isArray(data.bundles) ? data.bundles : Array.isArray(data.offers) ? data.offers : null,
  }
}
