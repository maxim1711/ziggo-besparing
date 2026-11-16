import { addDays, formatDateNl } from './dates'

/**
 * Agenda-afspraak voor een opvolging. Er is geen koppeling met Google: de app bouwt
 * alleen een link (of een .ics-bestand) die de adviseur zelf opent en opslaat.
 * Er gaat pas iets naar Google als de adviseur op de link tikt.
 */
export interface AppointmentInput {
  reference: string
  callbackDate: string | null
  /** "HH:MM"; leeg = afspraak voor de hele dag. */
  callbackTime?: string | null
  durationMinutes?: number | null
  address?: string
  phone?: string
  reason: string
  offerDiscussed: string
  contractEndDate: string | null
  notes: string
}

export interface CalendarEvent {
  title: string
  allDay: boolean
  /** Lokale tijd, zonder tijdzone: "YYYYMMDD" of "YYYYMMDDTHHMMSS". */
  start: string
  end: string
  location: string
  details: string
}

export const CALENDAR_TIMEZONE = 'Europe/Amsterdam'
const compact = (date: string) => date.replace(/-/g, '')
const pad = (n: number) => String(n).padStart(2, '0')

/** null als er geen (geldige) datum is: zonder datum geen agenda-afspraak. */
export function buildCalendarEvent(f: AppointmentInput): CalendarEvent | null {
  if (!f.callbackDate || !/^\d{4}-\d{2}-\d{2}$/.test(f.callbackDate)) return null
  const time = f.callbackTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(f.callbackTime) ? f.callbackTime : null
  const name = f.reference.trim()
  const title = `Opvolging${name ? ` ${name}` : ''}${f.offerDiscussed.trim() ? ` – ${f.offerDiscussed.trim()}` : ''}`
  const lines = [
    f.reason.trim() && `Reden: ${f.reason.trim()}`,
    f.phone?.trim() && `Telefoon: ${f.phone.trim()}`,
    f.address?.trim() && `Adres: ${f.address.trim()}`,
    f.offerDiscussed.trim() && `Besproken aanbieding: ${f.offerDiscussed.trim()}`,
    f.contractEndDate && `Huidig contract loopt tot: ${formatDateNl(f.contractEndDate)}`,
    f.notes.trim() && `Notities: ${f.notes.trim()}`,
  ].filter(Boolean) as string[]
  const base = { title, location: f.address?.trim() ?? '', details: lines.join('\n') }
  if (!time) return { ...base, allDay: true, start: compact(f.callbackDate), end: compact(addDays(f.callbackDate, 1)) }
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + Math.max(5, f.durationMinutes ?? 30)
  // Loopt de afspraak over middernacht, dan eindigt hij de volgende dag.
  const endDate = total >= 1440 ? addDays(f.callbackDate, 1) : f.callbackDate
  return { ...base, allDay: false, start: `${compact(f.callbackDate)}T${pad(h)}${pad(m)}00`, end: `${compact(endDate)}T${pad(Math.floor((total % 1440) / 60))}${pad(total % 60)}00` }
}

/** Link die Google Agenda opent met alles ingevuld; de adviseur slaat daar zelf op. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${e.start}/${e.end}`, details: e.details, location: e.location })
  if (!e.allDay) q.set('ctz', CALENDAR_TIMEZONE)
  if (!e.location) q.delete('location')
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** .ics-bestand voor andere agenda-apps (Apple, Outlook, Samsung). */
export function icsFile(e: CalendarEvent, uid: string, stamp: string): string {
  const date = e.allDay ? [`DTSTART;VALUE=DATE:${e.start}`, `DTEND;VALUE=DATE:${e.end}`] : [`DTSTART;TZID=${CALENDAR_TIMEZONE}:${e.start}`, `DTEND;TZID=${CALENDAR_TIMEZONE}:${e.end}`]
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Overstapadvies//NL', 'BEGIN:VEVENT', `UID:${uid}@overstapadvies`, `DTSTAMP:${stamp}`, ...date, `SUMMARY:${icsText(e.title)}`, ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []), ...(e.details ? [`DESCRIPTION:${icsText(e.details)}`] : []), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
}

/** Telefoonnummer voor een tel:-link (alleen cijfers en een eventuele +). */
export const telHref = (phone: string): string | null => {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits.replace('+', '').length >= 6 ? `tel:${digits}` : null
}

export const mapsUrl = (address: string): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
