import { formatEuro, type Cents } from './money'
import type { ComparisonResult } from './types'

/**
 * Tweede presentatiescherm ("Overstappen zonder gedoe") en de weergave van het prijsverschil.
 * Alles hier is puur en deterministisch: de schermen tonen alleen wat deze functies opleveren.
 */

/* ---------- gemiddeld verschil per maand ---------- */

export interface DifferenceView {
  /** 'onbekend' = huidige kosten ontbreken: er wordt geen verschil getoond of verzonnen. */
  kind: 'besparing' | 'meerkosten' | 'gelijk' | 'onbekend'
  period: number
  /** Absoluut verschil over de hele periode, uit de bestaande rekenmotor. */
  totalCents: Cents
  /** totalCents ÷ periode, afgerond op hele centen. */
  averageMonthlyCents: Cents
  /** Zitten er eenmalige kosten in het verschil (en dus in het gemiddelde)? */
  includesOneTime: boolean
  /** Bv. "Gemiddeld € 8,33 meer per maand". Leeg bij 'onbekend'. */
  headline: string
  /** Bv. "€ 200 meer over 24 maanden". */
  subline: string
  /** Uitleg dat het een gemiddelde is en niet het bedrag per factuur. */
  explanation: string
}

const eur = (c: Cents) => formatEuro(c, { decimals: 'auto' })

/** Maakt van het resultaat van de rekenmotor de klanttekst; rekent zelf niets opnieuw uit behalve ÷ periode. */
export function differenceView(r: ComparisonResult): DifferenceView {
  const period = r.period
  const includesOneTime = r.oneTime.totalCents > 0
  if (!r.currentKnown) return { kind: 'onbekend', period, totalCents: 0, averageMonthlyCents: 0, includesOneTime, headline: '', subline: '', explanation: 'Uw huidige maandbedrag is niet ingevuld, dus er is geen vergelijking gemaakt.' }
  const total = Math.abs(r.totalSavingsCents)
  const avg = Math.round(total / period)
  const oneTime = includesOneTime ? ' Eenmalige kosten zijn hierin meegeteld.' : ''
  if (r.totalSavingsCents === 0) return { kind: 'gelijk', period, totalCents: 0, averageMonthlyCents: 0, includesOneTime, headline: 'U betaalt ongeveer hetzelfde als nu', subline: `Gerekend over ${period} maanden`, explanation: `Over ${period} maanden zijn de totale kosten gelijk.${oneTime}` }
  if (r.totalSavingsCents > 0) return { kind: 'besparing', period, totalCents: total, averageMonthlyCents: avg, includesOneTime, headline: `Uw besparing over ${period} maanden`, subline: `Gemiddeld ${eur(avg)} minder per maand`, explanation: `Gemiddelde over ${period} maanden.${oneTime}` }
  return {
    kind: 'meerkosten',
    period,
    totalCents: total,
    averageMonthlyCents: avg,
    includesOneTime,
    headline: `Gemiddeld ${eur(avg)} meer per maand`,
    subline: `${eur(total)} meer over ${period} maanden`,
    explanation: `Dit is een gemiddelde over ${period} maanden${includesOneTime ? ', inclusief eenmalige kosten' : ''}. Uw maandbedrag zelf verandert niet elke maand met dit bedrag: de actieprijs en de prijs daarna staan hiernaast.`,
  }
}

/* ---------- overstappen zonder gedoe ---------- */

export type OverstapChoice = 'ja' | 'nee' | 'controleren'
export type InstallChoice = 'ja' | 'nee' | 'bespreken'

/** Snelle checklist van de adviseur. Standaard "Ja": beide diensten gelden volgens de adviseur altijd; per klant uit te zetten. */
export interface SwitchChecklist {
  overstap: OverstapChoice
  install: InstallChoice
}
export const defaultChecklist = (): SwitchChecklist => ({ overstap: 'ja', install: 'ja' })

/** Teksten en regels die de adviseur zelf kan bijwerken (Instellingen). */
export interface SwitchTexts {
  /** Voorwaarden Overstapservice, zichtbaar voor de klant onder "Voorwaarden". */
  overstapConditions: string
  /** Voorwaarden installatiehulp, zichtbaar voor de klant. */
  installConditions: string
  /** Eigen geheugensteun voor de adviseur: wanneer geldt de Overstapservice? Nooit zichtbaar voor de klant. */
  advisorRules: string
  verifiedOn: string | null
}

export const SWITCH_SOURCES = ['https://www.ziggo.nl/overstappen', 'https://www.ziggo.nl/klantenservice/abonnement/bestelling/overstapservice-en-nummerbehoud', 'https://www.ziggo.nl/klantenservice/monteur']

export const defaultSwitchTexts = (): SwitchTexts => ({
  overstapConditions: 'De Overstapservice geldt niet bij elke aanbieder, contractsituatie of verhuizing en moet bij de bestelling worden gekozen. De voorwaarden van Ziggo zijn leidend.',
  installConditions: 'Installatiehulp is op afspraak aan te vragen tot acht weken na ontvangst van de apparatuur. De monteur sluit de Ziggo-apparatuur en meegeleverde wifi-versterkers aan en controleert de wifi in drie ruimtes naar keuze. Extra werkzaamheden of bekabeling zijn niet automatisch gratis.',
  advisorRules: 'Controleer op ziggo.nl of de huidige aanbieder en de situatie van de klant in aanmerking komen voor de Overstapservice voordat u “Ja” kiest.',
  verifiedOn: null,
})

export interface SwitchCard {
  id: 'overstap' | 'verbinding' | 'installatie'
  icon: 'handshake' | 'wifi' | 'wrench'
  heading: string
  text: string
  /** Korte toelichting bij een niet-bevestigde kaart; null bij een bevestigde belofte. */
  note: string | null
  /** true = bevestigd voordeel; false = hulp/uitleg zonder toezegging. */
  confirmed: boolean
}

export interface SwitchSlide {
  title: string
  intro: string
  cards: SwitchCard[]
  /** Voorwaarden achter de subtiele link. */
  details: string[]
  sources: string[]
}

/**
 * Bouwt het tweede scherm. De drie beloften (in de woorden van de adviseur) verschijnen alleen
 * wanneer de adviseur de bijbehorende dienst heeft bevestigd; anders komt er een eerlijk alternatief.
 * Bevestigde beloften staan zonder kanttekening op het scherm; de voorwaarden staan achter de link "Voorwaarden".
 */
export function buildSwitchSlide(c: SwitchChecklist, texts: SwitchTexts, provider = 'Ziggo'): SwitchSlide {
  const confirmed = c.overstap === 'ja'
  const overstap: SwitchCard = confirmed
    ? { id: 'overstap', icon: 'handshake', heading: 'Wij regelen uw overstap.', text: 'Wij zeggen uw huidige abonnement op en regelen de volledige overstap. U hoeft zelf niets te doen.', note: null, confirmed: true }
    : {
        id: 'overstap',
        icon: 'handshake',
        heading: 'Hulp bij uw overstap',
        text: 'Wij helpen u met de stappen voor een soepele overstap.',
        note: c.overstap === 'nee' ? 'Uw huidige abonnement zegt u zelf op. Wij vertellen u hoe en wanneer.' : 'We controleren samen of de Overstapservice voor u geldt. Zo niet, dan zegt u uw huidige abonnement zelf op.',
        confirmed: false,
      }
  const verbinding: SwitchCard = confirmed
    ? { id: 'verbinding', icon: 'wifi', heading: 'Geen seconde zonder internet.', text: 'Wij zorgen voor een vlekkeloze overgang, zodat u gewoon verbonden blijft.', note: null, confirmed: true }
    : { id: 'verbinding', icon: 'wifi', heading: 'Zo houdt u verbinding', text: 'Zeg uw oude abonnement pas op als uw nieuwe aansluiting werkt.', note: 'Zo voorkomt u dat u een periode zonder internet of tv zit.', confirmed: false }
  const installatie: SwitchCard =
    c.install === 'ja'
      ? { id: 'installatie', icon: 'wrench', heading: 'Alles professioneel geïnstalleerd.', text: 'Onze monteur komt gratis langs, installeert uw Ziggo-apparatuur en controleert de wifi in huis.', note: null, confirmed: true }
      : c.install === 'nee'
        ? { id: 'installatie', icon: 'wrench', heading: 'Zelf aansluiten', text: 'U sluit de apparatuur zelf aan met de meegeleverde uitleg.', note: 'Toch hulp nodig? Installatiehulp is aan te vragen tot acht weken na ontvangst van de apparatuur.', confirmed: false }
        : { id: 'installatie', icon: 'wrench', heading: 'Installatiehulp mogelijk', text: `Als u dat wilt, helpt een ${provider}-monteur op afspraak met de installatie en een wifi-check.`, note: 'Aan te vragen tot acht weken na ontvangst van de apparatuur; extra werk of bekabeling is niet automatisch gratis.', confirmed: false }
  const details = [confirmed || c.overstap === 'controleren' ? texts.overstapConditions.trim() : 'De Overstapservice is in uw situatie niet van toepassing; u zegt uw huidige abonnement zelf op.', texts.installConditions.trim(), `Dit scherm is een toelichting van uw adviseur en geen bevestiging van een bestelling. De voorwaarden van ${provider} zijn leidend.`].filter(Boolean)
  return { title: 'Overstappen zonder gedoe', intro: confirmed ? 'Zo verloopt uw overstap.' : 'Zo helpen we u bij de overstap.', cards: [overstap, verbinding, installatie], details, sources: SWITCH_SOURCES }
}

/* ---------- navigatie tussen de twee schermen ---------- */

export const SLIDE_COUNT = 2
export type SlideAction = 'volgende' | 'vorige'

/** Geen automatische doorloop: alleen een tik verandert het scherm, en het blijft binnen 0..1. */
export function nextSlide(current: number, action: SlideAction): number {
  return Math.max(0, Math.min(SLIDE_COUNT - 1, current + (action === 'volgende' ? 1 : -1)))
}

/** Welke knoppen horen bij welk scherm. De slotactie staat alleen op het laatste scherm. */
export function slideControls(current: number): { back: string | null; primary: string; primaryAction: 'volgende' | 'afronden' } {
  return current >= SLIDE_COUNT - 1 ? { back: 'Vorige', primary: 'Verder met dit abonnement', primaryAction: 'afronden' } : { back: null, primary: 'Volgende', primaryAction: 'volgende' }
}
