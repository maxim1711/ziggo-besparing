import type { InternetProduct, PricingCatalog, Selection, TvPackage } from './pricing'
import type { CurrentProduct, CurrentSubscription, OfferProduct } from './types'

/**
 * Productpresentatie: snelheid, wifi-versterkers, tv-kenmerken en de optionele
 * productvergelijking. Alles komt uit de centrale prijsconfiguratie; hier worden
 * geen kenmerken verzonnen en geen prijzen berekend.
 */

/* ---------- snelheid ---------- */

export type SpeedTier = 'basis' | 'plus' | 'premium' | 'top'

/**
 * Gevulde fractie van de snelheidsmeter (0–1). Bewust niet-lineair (logaritmisch vanaf 200 Mbit/s),
 * zodat 200 Mbit/s een volwaardige verbinding blijft en elke stap omhoog zichtbaar meer is.
 * Puur visueel: het getal naast de meter is altijd de echte abonnementssnelheid.
 */
export function gaugeFill(mbps: number): number {
  if (!(mbps > 0)) return 0
  const f = 0.52 + 0.48 * (Math.log(mbps / 200) / Math.log(10))
  return Math.min(1, Math.max(0.3, Math.round(f * 1000) / 1000))
}

export function speedTier(mbps: number): SpeedTier {
  if (mbps >= 2000) return 'top'
  if (mbps >= 1000) return 'premium'
  if (mbps >= 500) return 'plus'
  return 'basis'
}

/** "1 wifi-versterker inbegrepen"; leeg bij 0. */
export function extenderLabel(n: number): string {
  if (n <= 0) return ''
  return `${n} wifi-versterker${n === 1 ? '' : 's'} inbegrepen`
}

/** "Modem + 2 wifi-versterkers". */
export function hardwareLabel(n: number): string {
  return n <= 0 ? 'Modem' : `Modem + ${n} wifi-versterker${n === 1 ? '' : 's'}`
}

/* ---------- tv ---------- */

const INHERIT = /^alles van (.+)$/i

/** Kenmerken van een tv-pakket inclusief wat het "Alles van …"-pakket meebrengt (zonder de verwijzing zelf). */
export function resolvedTvFeatures(tvs: TvPackage[], tv: TvPackage, seen = new Set<string>()): string[] {
  if (seen.has(tv.id)) return []
  seen.add(tv.id)
  const out: string[] = []
  for (const f of tv.features) {
    const m = f.trim().match(INHERIT)
    const parent = m ? tvs.find((t) => t.name.toLowerCase() === m[1].trim().toLowerCase()) : undefined
    if (parent) out.push(...resolvedTvFeatures(tvs, parent, seen))
    else out.push(f)
  }
  return out
}

/** Naam van het pakket waar dit pakket op voortbouwt ("Alles van TV Start"), als dat in de configuratie staat. */
export function tvBase(tvs: TvPackage[], tv: TvPackage): TvPackage | undefined {
  for (const f of tv.features) {
    const m = f.trim().match(INHERIT)
    const parent = m ? tvs.find((t) => t.name.toLowerCase() === m[1].trim().toLowerCase()) : undefined
    if (parent) return parent
  }
  return undefined
}

const CHANNELS = /(\d+)\s*\+?\s*zenders/i
const RECORDING = /opnemen|opname/i

export function channelInfo(features: string[]): { count: number; label: string } | null {
  let best: { count: number; label: string } | null = null
  for (const f of features) {
    const m = f.match(CHANNELS)
    if (m && (!best || Number(m[1]) > best.count)) best = { count: Number(m[1]), label: f.trim() }
  }
  return best
}

export type TvFeatureIcon = 'zenders' | 'opnemen' | 'terugkijken' | 'app' | 'sport' | 'film' | 'streaming' | 'overig'

/** Hoe een kenmerk op de productkaart staat. Alleen de weergave verandert; de inhoud komt uit de configuratie. */
export function tvFeatureView(feature: string): { icon: TvFeatureIcon; label: string } {
  const f = feature.trim()
  if (/^opnemen$/i.test(f)) return { icon: 'opnemen', label: 'Programma’s opnemen' }
  if (RECORDING.test(f)) return { icon: 'opnemen', label: f }
  if (CHANNELS.test(f)) return { icon: 'zenders', label: f }
  if (/terugkijken|replay/i.test(f)) return { icon: 'terugkijken', label: f }
  if (/\bgo\b|app/i.test(f)) return { icon: 'app', label: f }
  if (/sport|espn/i.test(f)) return { icon: 'sport', label: f }
  if (/movies|series|film/i.test(f)) return { icon: 'film', label: f }
  if (/skyshowtime|netflix|disney|hbo|videoland|prime|viaplay/i.test(f)) return { icon: 'streaming', label: f }
  return { icon: 'overig', label: f }
}

export interface TvCardView {
  id: string
  name: string
  /** Bv. "70+ zenders" (eigen of overgenomen van het basispakket); null = niet bekend. */
  channels: string | null
  /** Naam van het pakket waarop dit voortbouwt. */
  basedOn: string | null
  /** De eigen, onderscheidende kenmerken (zonder zenderaantal en zonder "Alles van …"). */
  highlights: { icon: TvFeatureIcon; label: string }[]
  recording: boolean
  /** Het uitgebreidste pakket in de configuratie (langste "Alles van"-keten). */
  mostComplete: boolean
}

function depth(tvs: TvPackage[], tv: TvPackage, seen = new Set<string>()): number {
  if (seen.has(tv.id)) return 0
  seen.add(tv.id)
  const base = tvBase(tvs, tv)
  return base ? 1 + depth(tvs, base, seen) : 0
}

export function tvCards(tvs: TvPackage[]): TvCardView[] {
  const depths = tvs.map((t) => depth(tvs, t))
  const max = Math.max(0, ...depths)
  const top = depths.filter((d) => d === max).length === 1 && max >= 1 ? max : -1
  return tvs.map((t, i) => {
    const all = resolvedTvFeatures(tvs, t)
    const ch = channelInfo(all)
    const own = t.features.filter((f) => !INHERIT.test(f.trim()) && !CHANNELS.test(f))
    return {
      id: t.id,
      name: t.name,
      channels: ch?.label ?? null,
      basedOn: tvBase(tvs, t)?.name ?? null,
      highlights: own.map(tvFeatureView),
      recording: all.some((f) => RECORDING.test(f)),
      mostComplete: depths[i] === top,
    }
  })
}

/* ---------- product van de gekozen aanbieding ---------- */

/** Productkenmerken van een selectie; wordt door de prijsmotor in de Offer gezet. */
export function offerProduct(catalog: PricingCatalog, internet: InternetProduct, tv: TvPackage | undefined, sel: Pick<Selection, 'phone' | 'extras'>): OfferProduct {
  const extra = catalog.extras.find((e) => e.id === 'x-wifi-extender')
  const extraExtenders = extra ? Math.min(sel.extras[extra.id] ?? 0, extra.maxQuantity) : 0
  const features = tv ? resolvedTvFeatures(catalog.tv, tv) : []
  const ch = channelInfo(features)
  // Opnemen alleen als "ja" of "nee" wanneer de configuratie het onderscheid maakt; anders onbekend.
  const anyListsRecording = catalog.tv.some((t) => t.features.some((f) => RECORDING.test(f)))
  const recording = !tv ? false : features.some((f) => RECORDING.test(f)) ? true : anyListsRecording ? false : null
  return {
    downloadMbps: internet.downloadMbps,
    uploadMbps: internet.uploadMbps,
    includedExtenders: internet.includedExtenders,
    extraExtenders,
    tvName: tv?.name ?? null,
    channels: ch?.count ?? (tv ? null : 0),
    channelsLabel: ch?.label ?? null,
    recording,
    phone: sel.phone,
  }
}

export const totalExtenders = (p: OfferProduct) => p.includedExtenders + p.extraExtenders

/* ---------- uitgebreid vergelijken ---------- */

export const emptyCurrentProduct = (): CurrentProduct => ({ extenders: null, recording: null, phone: null, channels: null })

/** Heeft de adviseur iets ingevuld om te vergelijken? */
export function hasProductInfo(c: CurrentSubscription): boolean {
  const p = c.product
  return c.speedMbps !== null || (!!p && (p.extenders !== null || p.recording !== null || p.phone !== null || p.channels !== null))
}

export type Verdict = 'beter' | 'gelijk' | 'minder' | 'anders'

export interface ComparisonRow {
  id: 'snelheid' | 'wifi' | 'zenders' | 'opnemen' | 'bellen'
  label: string
  current: string
  next: string
  verdict: Verdict
}

const speedText = (mbps: number) => `${mbps} Mbit/s`
const extText = (n: number) => (n === 0 ? 'Geen wifi-versterkers' : `${n} wifi-versterker${n === 1 ? '' : 's'}`)
const cmp = (a: number, b: number): Verdict => (b > a ? 'beter' : b < a ? 'minder' : 'gelijk')

/**
 * Productvergelijking huidig ↔ nieuw. Alleen rijen waarvan BEIDE kanten bekend zijn;
 * onbekend is nooit "nee" of 0, en zonder gegevens wordt geen verbetering gesuggereerd.
 */
export function productComparison(current: CurrentSubscription, next: OfferProduct | undefined): ComparisonRow[] {
  if (!next) return []
  const p = current.product ?? emptyCurrentProduct()
  const rows: ComparisonRow[] = []
  if (current.speedMbps !== null && current.speedMbps > 0) {
    rows.push({ id: 'snelheid', label: 'Internetsnelheid', current: speedText(current.speedMbps), next: speedText(next.downloadMbps), verdict: cmp(current.speedMbps, next.downloadMbps) })
  }
  if (p.extenders !== null) {
    const n = totalExtenders(next)
    rows.push({ id: 'wifi', label: 'Wifi-versterkers', current: extText(p.extenders), next: extText(n), verdict: cmp(p.extenders, n) })
  }
  if (p.channels !== null && next.channels !== null) {
    const cur = current.hasTv ? (p.channels === 0 ? 'Geen tv-zenders' : `${p.channels} zenders`) : 'Geen tv'
    const nx = next.tvName ? (next.channelsLabel ?? `${next.channels} zenders`) : 'Geen tv'
    // "70+" is een ondergrens: alleen "beter" als die ondergrens al hoger ligt.
    rows.push({ id: 'zenders', label: 'Tv-zenders', current: cur, next: nx, verdict: cmp(current.hasTv ? p.channels : 0, next.channels) })
  }
  if (p.recording !== null && next.recording !== null) {
    const t = (b: boolean) => (b ? 'Opnemen inbegrepen' : 'Opnemen niet inbegrepen')
    rows.push({ id: 'opnemen', label: 'Programma’s opnemen', current: t(p.recording), next: t(next.recording), verdict: p.recording === next.recording ? 'gelijk' : next.recording ? 'beter' : 'minder' })
  }
  if (p.phone !== null) {
    const t = (b: boolean) => (b ? 'Vaste telefonie' : 'Geen vaste telefonie')
    // Bellen erbij is geen verbetering op zich (het kost geld); wegvallen is wel een verschil om te noemen.
    rows.push({ id: 'bellen', label: 'Vaste telefonie', current: t(p.phone), next: t(next.phone), verdict: p.phone === next.phone ? 'gelijk' : p.phone ? 'minder' : 'anders' })
  }
  return rows
}
