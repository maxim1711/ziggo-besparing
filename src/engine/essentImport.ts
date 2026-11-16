import { parseEuroToCents, type Cents } from './money'
import { blankOffer, parseRate, rateToInput, validateOffer, type ContractType, type EnergyOffer, type OfferStatus, type Rate } from './essent'
import { centsToInput } from './money'

/**
 * "Tarieven plakken": leest een geplakte tekst (WhatsApp, e-mail, spreadsheet) regel voor regel
 * met vaste regels — geen AI, niets verlaat het apparaat. Elke gevonden waarde houdt de
 * bronregel bij, zodat de adviseur kan controleren. Wat niet herkend wordt, blijft leeg.
 */
export type ParsedKey = 'electricitySingle' | 'electricityPeak' | 'electricityOffPeak' | 'gas' | 'fixedElectricityMonthlyCents' | 'fixedGasMonthlyCents' | 'welcomeBonusCents' | 'feedInFeePerKwh' | 'feedInCompensationPerKwh' | 'contractMonths' | 'contractType' | 'validTo' | 'validFrom' | 'includesVat' | 'includesEnergyTax'

export interface ParsedField {
  key: ParsedKey
  label: string
  /** Rate, centen, maanden, datum, boolean of contracttype. */
  value: number | string | boolean
  display: string
  /** De regel uit de geplakte tekst waar dit uit komt. */
  source: string
  /** Aandachtspunt (bv. omgerekend of ongebruikelijke waarde). */
  warning?: string
}

export interface ParsedDraft {
  fields: ParsedField[]
  missing: string[]
  conflicts: string[]
  /** Regels met een bedrag die niet zijn herkend. */
  unrecognized: string[]
}

const LABEL: Record<ParsedKey, string> = {
  electricitySingle: 'Stroom enkeltarief (per kWh)',
  electricityPeak: 'Stroom normaaltarief (per kWh)',
  electricityOffPeak: 'Stroom daltarief (per kWh)',
  gas: 'Gas (per m³)',
  fixedElectricityMonthlyCents: 'Vaste leveringskosten stroom (per maand)',
  fixedGasMonthlyCents: 'Vaste leveringskosten gas (per maand)',
  welcomeBonusCents: 'Welkomstbonus (eenmalig)',
  feedInFeePerKwh: 'Terugleverkosten (per kWh)',
  feedInCompensationPerKwh: 'Terugleververgoeding (per kWh)',
  contractMonths: 'Looptijd (maanden)',
  contractType: 'Contracttype',
  validFrom: 'Geldig vanaf',
  validTo: 'Geldig tot en met',
  includesVat: 'Inclusief btw',
  includesEnergyTax: 'Inclusief energiebelasting',
}

const NUM = /(\d{1,4}(?:[.,]\d{1,5})?)/
const MONTHS: Record<string, string> = { januari: '01', februari: '02', maart: '03', april: '04', mei: '05', juni: '06', juli: '07', augustus: '08', september: '09', oktober: '10', november: '11', december: '12' }

function findDate(line: string): string | null {
  let m = line.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = line.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return m[0]
  m = line.match(new RegExp(`(\\d{1,2})\\s+(${Object.keys(MONTHS).join('|')})\\s+(\\d{4})`, 'i'))
  if (m) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`
  return null
}

/** Eerste bedrag op de regel, na de dubbele punt als die er is. */
function amount(line: string): { text: string; inCents: boolean } | null {
  const tail = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line.replace(/\b(1|2|3)\s*jaar\b/gi, '')
  const m = tail.match(new RegExp(`(?:€|eur)?\\s*${NUM.source}\\s*(ct|cent)?`, 'i'))
  if (!m) return null
  return { text: m[1], inCents: !!m[2] }
}

export function parseTariffText(text: string): ParsedDraft {
  const fields: ParsedField[] = []
  const conflicts: string[] = []
  const unrecognized: string[] = []
  const add = (f: ParsedField) => {
    const prev = fields.find((x) => x.key === f.key)
    if (!prev) fields.push(f)
    else if (prev.value !== f.value) conflicts.push(`${f.label}: “${prev.display}” en “${f.display}” gevonden. De eerste is overgenomen; controleer welke klopt.`)
  }
  const rate = (key: ParsedKey, line: string, max: number) => {
    const a = amount(line)
    if (!a) return false
    let r = parseRate(a.text)
    if (r === null) return false
    let warning: string | undefined
    if (a.inCents) {
      r = Math.round(r / 100)
      warning = 'Omgerekend van centen naar euro.'
    }
    if (r > max) warning = 'Ongebruikelijk hoog: controleer de eenheid.'
    add({ key, label: LABEL[key], value: r, display: `€ ${rateToInput(r)}`, source: line, warning })
    return true
  }
  const money = (key: ParsedKey, line: string) => {
    const a = amount(line)
    const c = a ? parseEuroToCents(a.text) : null
    if (c === null) return false
    let cents: Cents = c
    let warning: string | undefined
    if (key !== 'welcomeBonusCents') {
      if (/per\s*dag|\/\s*dag|p\/d\b/i.test(line)) {
        // Dagbedragen hebben vaak meer dan 2 decimalen: reken exact om vanuit het tarief.
        const exact = parseRate(a!.text)
        cents = Math.round(((exact ?? c * 1000) * 365) / 12 / 1000)
        warning = 'Omgerekend van per dag naar per maand (× 365 ÷ 12, afgerond).'
      } else if (/per\s*jaar|\/\s*jaar|p\/j\b/i.test(line)) {
        cents = Math.round(c / 12)
        warning = 'Omgerekend van per jaar naar per maand (afgerond).'
      }
    }
    add({ key, label: LABEL[key], value: cents, display: `€ ${centsToInput(cents)}`, source: line, warning })
    return true
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t+/g, ' : ').replace(/\s+/g, ' ').trim()
    if (!line) continue
    const l = line.toLowerCase()
    let hit = false

    if (/\bincl(?:usief|\.)?\s[^.]*\bbtw\b/.test(l)) (add({ key: 'includesVat', label: LABEL.includesVat, value: true, display: 'Ja', source: line }), (hit = true))
    else if (/\bexcl(?:usief|\.)?\s[^.]*\bbtw\b/.test(l)) (add({ key: 'includesVat', label: LABEL.includesVat, value: false, display: 'Nee', source: line }), (hit = true))
    if (/\bincl(?:usief|\.)?\s[^.]*\b(energiebelasting|belastingen|eb)\b/.test(l)) (add({ key: 'includesEnergyTax', label: LABEL.includesEnergyTax, value: true, display: 'Ja', source: line }), (hit = true))
    else if (/\bexcl(?:usief|\.)?\s[^.]*\b(energiebelasting|belastingen|eb)\b/.test(l)) (add({ key: 'includesEnergyTax', label: LABEL.includesEnergyTax, value: false, display: 'Nee', source: line }), (hit = true))

    const type: ContractType | null = /\bdynamisch/.test(l) ? 'dynamisch' : /\bvariabel/.test(l) ? 'variabel' : /\bvast(e)?\s*(contract|tarie|prijs)|jaar\s*vast|maanden\s*vast/.test(l) ? 'vast' : null
    if (type) (add({ key: 'contractType', label: LABEL.contractType, value: type, display: type, source: line }), (hit = true))
    const dur = l.match(/(\d{1,2})\s*(jaar|maanden|mnd)/)
    if (dur && /(looptijd|contract|vast|duur)/.test(l)) {
      const months = Number(dur[1]) * (dur[2] === 'jaar' ? 12 : 1)
      add({ key: 'contractMonths', label: LABEL.contractMonths, value: months, display: `${months} maanden`, source: line })
      hit = true
    }
    const date = findDate(line)
    if (date && /(geldig|t\/m|tot en met|tot|einde|verloopt)/.test(l) && !/vanaf/.test(l)) (add({ key: 'validTo', label: LABEL.validTo, value: date, display: date, source: line }), (hit = true))
    else if (date && /(vanaf|ingang|start)/.test(l)) (add({ key: 'validFrom', label: LABEL.validFrom, value: date, display: date, source: line }), (hit = true))
    if (hit && !/€|\d[.,]\d/.test(line.replace(/\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/, ''))) continue

    const fixed = /(vaste\s*(leverings)?kosten|vastrecht|vaste\s*lasten)/.test(l)
    if (/terugleverkosten|kosten\s*teruglever/.test(l)) hit = rate('feedInFeePerKwh', line, 50000) || hit
    else if (/terugleververgoeding|vergoeding\s*teruglever|teruglevertarief/.test(l)) hit = rate('feedInCompensationPerKwh', line, 50000) || hit
    else if (/(welkomstbonus|bonus|cashback|welkomstcadeau)/.test(l)) hit = money('welcomeBonusCents', line) || hit
    else if (fixed && /\bgas\b/.test(l)) hit = money('fixedGasMonthlyCents', line) || hit
    else if (fixed) hit = money('fixedElectricityMonthlyCents', line) || hit
    else if (/\bgas\b|m3|m³/.test(l)) hit = rate('gas', line, 500000) || hit
    else if (/\b(dal|daltarief|laag|laagtarief|nacht)\b/.test(l)) hit = rate('electricityOffPeak', line, 200000) || hit
    else if (/\b(normaal|normaaltarief|piek|hoog|hoogtarief|dag)\b/.test(l) && /(stroom|kwh|tarief|elektr)/.test(l)) hit = rate('electricityPeak', line, 200000) || hit
    else if (/(stroom|elektriciteit|kwh|enkel)/.test(l)) hit = rate('electricitySingle', line, 200000) || hit

    if (!hit && /€|\d[.,]\d/.test(line)) unrecognized.push(line)
  }

  const has = (k: ParsedKey) => fields.some((f) => f.key === k)
  const missing: string[] = []
  if (!has('electricitySingle') && !(has('electricityPeak') && has('electricityOffPeak'))) missing.push('Stroomtarief')
  if (has('electricityPeak') !== has('electricityOffPeak')) missing.push(has('electricityPeak') ? 'Daltarief stroom' : 'Normaaltarief stroom')
  if (!has('gas')) missing.push('Gastarief')
  if (!has('fixedElectricityMonthlyCents')) missing.push('Vaste leveringskosten stroom')
  if (!has('fixedGasMonthlyCents')) missing.push('Vaste leveringskosten gas')
  if (!has('includesVat')) missing.push('Of de tarieven inclusief btw zijn (aangenomen: ja — controleer)')
  if (!has('includesEnergyTax')) missing.push('Of de tarieven inclusief energiebelasting zijn (aangenomen: ja — controleer)')
  if (!has('validTo')) missing.push('Einddatum van de actie')
  return { fields, missing, conflicts, unrecognized }
}

/** Maakt van de (door de adviseur nagekeken) velden een concept-aanbod. Activeren gebeurt apart. */
export function draftToOffer(draft: ParsedDraft, id: string, now: string, name: string): EnergyOffer {
  const o = blankOffer(id, now)
  o.name = name
  o.source = 'Geplakte tekst'
  for (const f of draft.fields) {
    switch (f.key) {
      case 'contractMonths':
        o.contractMonths = f.value as number
        break
      case 'contractType':
        o.contractType = f.value as ContractType
        break
      case 'validFrom':
      case 'validTo':
        o[f.key] = f.value as string
        break
      case 'welcomeBonusCents':
        o.welcomeBonusCents = f.value as number
        break
      case 'includesVat':
      case 'includesEnergyTax':
        o.rates[f.key] = f.value as boolean
        break
      case 'fixedElectricityMonthlyCents':
      case 'fixedGasMonthlyCents':
        o.rates[f.key] = f.value as number
        break
      default:
        o.rates[f.key] = f.value as Rate
    }
  }
  return o
}

/* ---------- CSV en JSON ---------- */

const COLS = ['id', 'naam', 'campagne', 'contracttype', 'looptijd_maanden', 'geldig_vanaf', 'geldig_tot', 'status', 'stroom_enkel', 'stroom_normaal', 'stroom_dal', 'gas', 'vast_stroom_maand', 'vast_gas_maand', 'incl_btw', 'incl_energiebelasting', 'welkomstbonus', 'bonusvoorwaarden', 'terugleverkosten_kwh', 'terugleververgoeding_kwh', 'voorwaarden', 'verkoopkanaal', 'bron', 'gecontroleerd_op', 'interne_notitie'] as const

const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const yn = (b: boolean) => (b ? 'ja' : 'nee')

export function offersToCsv(offers: EnergyOffer[]): string {
  const rows = offers.map((o) =>
    [o.id, o.name, o.campaign, o.contractType, String(o.contractMonths), o.validFrom ?? '', o.validTo ?? '', o.status, rateToInput(o.rates.electricitySingle), rateToInput(o.rates.electricityPeak), rateToInput(o.rates.electricityOffPeak), rateToInput(o.rates.gas), centsToInput(o.rates.fixedElectricityMonthlyCents), centsToInput(o.rates.fixedGasMonthlyCents), yn(o.rates.includesVat), yn(o.rates.includesEnergyTax), centsToInput(o.welcomeBonusCents), o.bonusConditions, rateToInput(o.rates.feedInFeePerKwh), rateToInput(o.rates.feedInCompensationPerKwh), o.eligibility, o.salesChannel, o.source, o.verifiedOn ?? '', o.internalNotes]
      .map(cell)
      .join(';'),
  )
  return '﻿' + [COLS.join(';'), ...rows].join('\r\n')
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  const sep = (src.split(/\r?\n/)[0].match(/;/g)?.length ?? 0) >= (src.split(/\r?\n/)[0].match(/,/g)?.length ?? 0) ? ';' : ','
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') (cur += '"'), i++
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) (row.push(cur), (cur = ''))
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cur)
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      cur = ''
    } else cur += ch
  }
  row.push(cur)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

export interface ImportResult {
  offers: EnergyOffer[]
  /** Per afgekeurde regel wat er mis is; die regels worden niet opgeslagen. */
  errors: string[]
}

export function csvToOffers(text: string, newId: () => string, now: string): ImportResult {
  const rows = splitCsv(text)
  const errors: string[] = []
  if (rows.length < 2) return { offers: [], errors: ['Het bestand bevat geen regels.'] }
  const head = rows[0].map((h) => h.trim().toLowerCase())
  if (!head.includes('naam')) return { offers: [], errors: ['Kolom “naam” ontbreekt. Gebruik de kolommen uit een export van deze app.'] }
  const offers: EnergyOffer[] = []
  rows.slice(1).forEach((r, n) => {
    const get = (c: (typeof COLS)[number]) => (r[head.indexOf(c)] ?? '').trim()
    const bad: string[] = []
    const rate = (c: (typeof COLS)[number]) => {
      const v = get(c)
      if (!v) return null
      const p = parseRate(v)
      if (p === null) bad.push(`${c}: “${v}” is geen geldig tarief`)
      return p
    }
    const cents = (c: (typeof COLS)[number]) => {
      const v = get(c)
      if (!v) return null
      const p = parseEuroToCents(v)
      if (p === null || p < 0) bad.push(`${c}: “${v}” is geen geldig bedrag`)
      return p
    }
    const bool = (c: (typeof COLS)[number]) => {
      const v = get(c).toLowerCase()
      if (!['ja', 'nee', 'true', 'false', '1', '0'].includes(v)) bad.push(`${c}: vul ja of nee in`)
      return ['ja', 'true', '1'].includes(v)
    }
    const o = blankOffer(get('id') || newId(), now)
    Object.assign(o, { name: get('naam'), campaign: get('campagne'), contractType: (get('contracttype') || 'vast') as ContractType, contractMonths: Number(get('looptijd_maanden') || '12'), validFrom: get('geldig_vanaf') || null, validTo: get('geldig_tot') || null, status: (get('status') || 'concept') as OfferStatus, welcomeBonusCents: cents('welkomstbonus') ?? 0, bonusConditions: get('bonusvoorwaarden'), eligibility: get('voorwaarden'), salesChannel: get('verkoopkanaal'), source: get('bron'), verifiedOn: get('gecontroleerd_op') || null, internalNotes: get('interne_notitie') })
    o.rates = { electricitySingle: rate('stroom_enkel'), electricityPeak: rate('stroom_normaal'), electricityOffPeak: rate('stroom_dal'), gas: rate('gas'), fixedElectricityMonthlyCents: cents('vast_stroom_maand'), fixedGasMonthlyCents: cents('vast_gas_maand'), includesVat: bool('incl_btw'), includesEnergyTax: bool('incl_energiebelasting'), feedInFeePerKwh: rate('terugleverkosten_kwh'), feedInCompensationPerKwh: rate('terugleververgoeding_kwh') }
    bad.push(...validateOffer(o))
    if (bad.length) errors.push(`Regel ${n + 2} (${o.name || 'zonder naam'}): ${bad.join('; ')}`)
    else offers.push(o)
  })
  return { offers, errors }
}

export function jsonToOffers(raw: unknown): ImportResult {
  const data = raw as { app?: string; offers?: unknown }
  if (!data || data.app !== 'overstapadvies' || !Array.isArray(data.offers)) return { offers: [], errors: ['Dit is geen Essent-tarievenbestand van deze app.'] }
  const offers: EnergyOffer[] = []
  const errors: string[] = []
  ;(data.offers as EnergyOffer[]).forEach((o, n) => {
    const bad = !o || typeof o !== 'object' || typeof o.id !== 'string' ? ['geen geldig aanbod'] : validateOffer(o)
    if (bad.length) errors.push(`Aanbod ${n + 1} (${o?.name || 'zonder naam'}): ${bad.join('; ')}`)
    else offers.push(o)
  })
  return { offers, errors }
}

/**
 * Voegt geïmporteerde aanbiedingen toe zonder iets te overschrijven:
 * bestaat het id al, dan komt de import er als nieuw aanbod naast.
 */
export function mergeImported(existing: EnergyOffer[], imported: EnergyOffer[], newId: () => string): EnergyOffer[] {
  const ids = new Set(existing.map((o) => o.id))
  const added = imported.map((o) => {
    if (!ids.has(o.id)) {
      ids.add(o.id)
      return o
    }
    const same = existing.find((e) => e.id === o.id)!
    if (JSON.stringify({ ...same, favorite: false }) === JSON.stringify({ ...o, favorite: false })) return null
    return { ...o, id: newId(), name: `${o.name} (import)`, favorite: false }
  })
  return [...existing, ...added.filter((o): o is EnergyOffer => o !== null)]
}
