import type { ExtraCategory, ExtraService, GiftDefinition, InternetProduct, PackagePrice, PricingCatalog, Promotion, Source, TvPackage } from './pricing'
import { PRICING_SCHEMA_VERSION, packageKey } from './pricing'

/**
 * Basisprijzen, door de adviseur aangeleverd en gecontroleerd op ziggo.nl.
 * Alleen bedragen die daadwerkelijk zijn geverifieerd staan hier; al het andere
 * is `null` en moet in de app worden ingevuld. Bestaande, door de adviseur
 * aangepaste configuraties worden hier NOOIT door overschreven.
 */
export const SEED_DATE = '2026-11-16'

const URL = {
  pakketten: 'https://www.ziggo.nl/tarieven/pakketten',
  tvInternet: 'https://www.ziggo.nl/tv-internet',
  televisie: 'https://www.ziggo.nl/televisie',
  mediaboxen: 'https://www.ziggo.nl/televisie/mediaboxen/extra',
  extra: 'https://www.ziggo.nl/televisie/extra-zenders-streamingdiensten',
  vodafone: 'https://www.ziggo.nl/vodafone',
  aanbiedingen: 'https://www.ziggo.nl/aanbiedingen',
}
const verified = (url: string): Source => ({ url, verifiedOn: SEED_DATE })
const unverified = (url: string | null = null): Source => ({ url, verifiedOn: null })

const net = (id: string, name: string, down: number, up: number, extenders: number, vodafone: number | null, ok = true): InternetProduct => ({
  id,
  name,
  downloadMbps: down,
  uploadMbps: up,
  includedExtenders: extenders,
  vodafoneDiscountCents: vodafone,
  available: ok,
  source: ok ? verified(URL.pakketten) : unverified(URL.tvInternet),
  internalNotes: ok ? '' : 'Prijs niet gevonden in de officiële tarieventabel. Vul prijs en beschikbaarheid in voordat u dit pakket aanbiedt.',
})

const INTERNET: InternetProduct[] = [
  net('net-200', 'Internet 200', 200, 25, 0, 250),
  net('net-500', 'Internet 500', 500, 50, 1, 500),
  net('net-1000', 'Internet 1 Gbit', 1000, 100, 2, 750),
  net('net-2000', 'Internet 2 Gbit', 2000, 120, 3, 1000),
  net('net-4000', 'Internet 4 Gbit', 4000, 250, 4, null, false),
  net('net-8000', 'Internet 8 Gbit', 8000, 350, 5, null, false),
]

const TV: TvPackage[] = [
  { id: 'tv-start', name: 'TV Start', features: ['70+ zenders', 'Ziggo Sport en ESPN-zenders uit het pakket', 'Ziggo GO', 'Tot 7 dagen terugkijken'], includedReceivers: 1, includes: [], available: true, source: verified(URL.tvInternet) },
  { id: 'tv-complete', name: 'TV Complete', features: ['Alles van TV Start', 'Opnemen', 'Movies & Series'], includedReceivers: 1, includes: [], available: true, source: verified(URL.tvInternet) },
  { id: 'tv-max', name: 'TV Max', features: ['Alles van TV Complete', '110+ zenders', 'Ziggo Sport Totaal', 'SkyShowtime'], includedReceivers: 1, includes: ['x-zst', 'x-skyshowtime'], available: true, source: verified(URL.televisie) },
]

/** Officiële pakketprijzen in centen: [alleen internet, TV Start, TV Complete, TV Max]. */
const MATRIX: Record<string, [number, number, number, number]> = {
  'net-200': [4195, 5840, 6440, 7740],
  'net-500': [4895, 6540, 7140, 8440],
  'net-1000': [5495, 7140, 7740, 9040],
  'net-2000': [5995, 7640, 8240, 9540],
}
/** Alles-in-1 (met vast bellen): [TV Start, TV Complete, TV Max]. */
const MATRIX_PHONE: Record<string, [number, number, number]> = {
  'net-200': [6335, 6935, 8235],
  'net-500': [7035, 7635, 8935],
  'net-1000': [7635, 8235, 9535],
  'net-2000': [8135, 8735, 10035],
}

function prices(): PackagePrice[] {
  const out: PackagePrice[] = []
  for (const i of INTERNET) {
    const row = MATRIX[i.id]
    const phone = MATRIX_PHONE[i.id]
    out.push({ internetId: i.id, tvId: null, phone: false, cents: row?.[0] ?? null, source: row ? verified(URL.pakketten) : unverified() })
    TV.forEach((t, n) => {
      out.push({ internetId: i.id, tvId: t.id, phone: false, cents: row?.[n + 1] ?? null, source: row ? verified(URL.pakketten) : unverified() })
      out.push({ internetId: i.id, tvId: t.id, phone: true, cents: phone?.[n] ?? null, source: phone ? verified(URL.pakketten) : unverified() })
    })
    // Alleen internet + bellen staat niet in de gecontroleerde tabel: bewust leeg.
    out.push({ internetId: i.id, tvId: null, phone: true, cents: null, source: unverified() })
  }
  return out
}

const x = (id: string, name: string, category: ExtraCategory, cents: number | null, over: Partial<ExtraService> = {}): ExtraService => ({
  id,
  name,
  category,
  monthlyCents: cents,
  fromCents: null,
  oneTimeCents: 0,
  requiresTv: category !== 'streaming',
  countable: false,
  maxQuantity: 1,
  includes: [],
  eligibilityNote: '',
  moreOptions: false,
  available: true,
  source: cents === null ? unverified(URL.extra) : verified(URL.extra),
  ...over,
})
/** Streamingdienst met alleen een "vanaf"-prijs: geen offerteprijs tot de adviseur de vorm en prijs invult. */
const from = (id: string, name: string, fromCents: number) => x(id, name, 'streaming', null, { fromCents })

const EXTRAS: ExtraService[] = [
  x('x-next-mini', 'Extra Next Mini', 'apparatuur', 600, { countable: true, maxQuantity: 5, source: verified(URL.mediaboxen) }),
  x('x-ci-module', 'CI+ module', 'apparatuur', 400, { countable: true, maxQuantity: 5, source: verified(URL.mediaboxen) }),
  x('x-wifi-extender', 'Extra wifi-versterker', 'apparatuur', 250, { countable: true, maxQuantity: 5, requiresTv: false, source: verified(URL.tvInternet) }),

  x('x-zst', 'Ziggo Sport Totaal', 'sport', 1695),
  x('x-espn-premium', 'ESPN Premium', 'sport', 995, { eligibilityNote: 'controleer of dit iets toevoegt aan de ESPN-zenders die al in het gekozen pakket zitten.' }),
  x('x-viaplay-tv', 'Viaplay TV+', 'sport', 1699),
  x('x-zenders-plus', 'TV Zenders Plus', 'entertainment', 995),
  x('x-film1', 'Film1', 'entertainment', 995),

  // Inhoud van "Sport Compleet" is een aanname (Ziggo Sport Totaal + ESPN Premium): door de adviseur te bevestigen.
  x('x-b-sport-compleet', 'Sport Compleet', 'bundel', 1895, { includes: ['x-zst', 'x-espn-premium'] }),
  x('x-b-sport-film1', 'Sport Compleet + Film1', 'bundel', 1995, { includes: ['x-b-sport-compleet', 'x-zst', 'x-espn-premium', 'x-film1'] }),
  x('x-b-netflix-zst', 'Netflix + Ziggo Sport Totaal', 'bundel', 2195, { includes: ['x-netflix', 'x-zst'] }),
  x('x-b-viaplay-zst', 'Viaplay TV+ + Ziggo Sport Totaal', 'bundel', 2295, { includes: ['x-viaplay-tv', 'x-zst'] }),
  x('x-b-disney-espn', 'Disney+ + ESPN Premium', 'bundel', 2195, { includes: ['x-disney', 'x-espn-premium'] }),

  x('x-skyshowtime', 'SkyShowtime', 'streaming', 999),
  x('x-prime', 'Prime Video', 'streaming', 499),
  x('x-appletv', 'Apple TV', 'streaming', 999),
  x('x-canal', 'CANAL+', 'streaming', 499),
  x('x-npo-plus', 'NPO Plus', 'streaming', 349),
  x('x-cinetree', 'Cinetree', 'streaming', 999),
  x('x-hayu', 'Hayu', 'streaming', 699),
  from('x-netflix', 'Netflix', 999),
  from('x-videoland', 'Videoland', 699),
  from('x-disney', 'Disney+', 699),
  from('x-hbo', 'HBO Max', 599),
  from('x-viaplay', 'Viaplay', 1699),

  x('x-hindi', 'Hindi-zenders', 'specialistisch', 1595, { moreOptions: true }),
  x('x-turks', 'Turkse zenders', 'specialistisch', 795, { moreOptions: true }),
  x('x-erotiek', 'Erotiek', 'specialistisch', 1250, { moreOptions: true }),
  x('x-gay', 'Gay Lifestyle', 'specialistisch', 995, { moreOptions: true }),
]

/** Welkomstacties sluiten elkaar uit: de klant kiest er precies één. */
export const WELCOME_GROUP = 'Welkomstactie'
/** Welkomstacties zoals door de adviseur aangeleverd op 25-11-2026. */
const campaign = (): Source => ({ url: null, verifiedOn: '2026-11-25' })

const GIFTS: GiftDefinition[] = [
  { id: 'gift-bol-450', available: true, type: 'cadeaukaart', name: 'bol cadeaukaart van € 450', imageDataUrl: 'gifts/cadeaukaart.svg', retailValueCents: 45000, description: 'Cadeaukaart om te besteden bij bol.', conditions: 'Volgens de actievoorwaarden.' },
  { id: 'gift-samsung-tv-soundbar', available: true, type: 'televisie', name: 'Samsung 55-inch 4K-tv + soundbar', imageDataUrl: 'gifts/tv-soundbar.svg', retailValueCents: 89800, description: 'Televisie met bijpassende soundbar.', conditions: 'Volgens de actievoorwaarden.' },
]

const welcome = (over: Partial<Promotion> & Pick<Promotion, 'id' | 'name'>): Promotion => ({
  channel: 'eigen',
  status: 'gecontroleerd',
  validFrom: null,
  validTo: null,
  contractMonths: 24,
  durationMonths: null,
  fixedPrices: {},
  monthlyDiscountCents: 0,
  oneTimeDiscountCents: 0,
  giftId: null,
  exclusiveGroup: WELCOME_GROUP,
  requiresTv: false,
  conditions: 'Bij een contract van 24 maanden. Niet te combineren met een andere welkomstactie.',
  benefits: '',
  source: campaign(),
  internalNotes: 'Uit de salescampagne van de adviseur (bijgewerkt 25-11-2026). Einddatum nog invullen.',
  ...over,
})

/** Alle 32 kernpakketten: vier snelheden × (alleen internet of een tv-pakket) × (met of zonder vast bellen). */
const allCore = (cents: number): Record<string, number> =>
  Object.fromEntries(Object.keys(MATRIX).flatMap((n) => [null, ...TV.map((t) => t.id)].flatMap((t) => [false, true].map((phone) => [packageKey(n, t, phone), cents]))))

/** Id's van de welkomstacties (per 25-11-2026). De vorige actie "12 maanden € 35" is vervangen. */
export const WELCOME_IDS = { tweeJaar: 'welkom-3495-24m', eenJaarVast: 'welkom-3495-12m', eenJaarProcent: 'welkom-50pct-12m' } as const
export const REPLACED_PROMOTION_IDS = ['welkom-35']

const CORE = 'Geldt voor het abonnement: internet, tv en vast bellen samen. Extra diensten tegen de normale prijs.'
const WELCOME: Promotion[] = [
  welcome({ id: WELCOME_IDS.tweeJaar, name: '12 maanden € 34,95 p/m', contractExact: true, durationMonths: 12, fixedPrices: allCore(3495), conditions: `Bij een contract van 24 maanden. De eerste 12 maanden € 34,95 per maand, daarna de normale prijs. ${CORE}` }),
  welcome({ id: WELCOME_IDS.eenJaarVast, name: '9 maanden € 34,95 p/m', contractMonths: 12, contractExact: true, durationMonths: 9, fixedPrices: allCore(3495), conditions: `Bij een contract van 12 maanden. De eerste 9 maanden € 34,95 per maand, daarna de normale prijs. ${CORE}` }),
  welcome({ id: WELCOME_IDS.eenJaarProcent, name: '6 maanden 50% korting', contractMonths: 12, contractExact: true, durationMonths: 6, percentDiscount: 50, conditions: 'Bij een contract van 12 maanden. De eerste 6 maanden 50% korting op het abonnement (internet, tv en vast bellen), daarna de normale prijs. Geen korting op extra diensten, apparatuur of eenmalige kosten.' }),
  welcome({ id: 'welkom-bol', name: 'bol cadeaukaart van € 450', contractExact: true, giftId: 'gift-bol-450', conditions: 'Bij een contract van 24 maanden. U betaalt de normale maandprijs. Niet te combineren met de maandkorting of een ander cadeau.' }),
  welcome({ id: 'welkom-samsung', name: 'Samsung 55-inch 4K-tv + soundbar', contractExact: true, giftId: 'gift-samsung-tv-soundbar', conditions: 'Bij een contract van 24 maanden. U betaalt de normale maandprijs. Niet te combineren met de maandkorting of een ander cadeau.' }),
]

export function seedPricing(): PricingCatalog {
  return structuredClone({
    schemaVersion: PRICING_SCHEMA_VERSION,
    seedDate: SEED_DATE,
    provider: 'Ziggo',
    internet: INTERNET,
    tv: TV,
    prices: prices(),
    extras: EXTRAS,
    gifts: GIFTS,
    promotions: [
      ...WELCOME,
      {
        id: 'promo-3495-12m',
        name: '12 maanden € 34,95 — 24 maanden contract',
        channel: 'openbaar' as const,
        status: 'gecontroleerd' as const,
        validFrom: null,
        validTo: null,
        contractMonths: 24 as const,
        durationMonths: 12,
        // Alleen het openbaar getoonde voorbeeld is toegewezen; andere pakketten eerst bevestigen.
        fixedPrices: { [packageKey('net-200', 'tv-start', false)]: 3495 },
        monthlyDiscountCents: 0,
        oneTimeDiscountCents: 0,
        giftId: null,
        exclusiveGroup: WELCOME_GROUP,
        requiresTv: false,
        conditions: 'Voor nieuwe klanten, bij een contract van 24 maanden. Na 12 maanden geldt de normale prijs.',
        benefits: '',
        source: verified(URL.aanbiedingen),
        internalNotes: 'Openbare websiteactie. Zegt niets over wat via de deur mag worden aangeboden; einddatum onbekend.',
      },
    ],
    // Niet gevonden in de aangeleverde gegevens: de adviseur vult dit eenmalig in.
    activationCents: null,
    vodafone: {
      conditions: 'Sinds 8 juni 2026 “One van Vodafone & Ziggo”. Alleen bij bevestigde geschiktheid; bestaande klanten kunnen oude voordelen hebben. Bedragen per snelheid zijn referentiebedragen.',
      source: verified(URL.vodafone),
    },
  })
}
