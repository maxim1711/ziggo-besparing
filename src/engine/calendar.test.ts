import { describe, expect, it } from 'vitest'
import { buildCalendarEvent, googleCalendarUrl, icsFile, mapsUrl, telHref, type AppointmentInput } from './calendar'

const f = (over: Partial<AppointmentInput> = {}): AppointmentInput => ({ reference: 'Jan', callbackDate: '2026-12-03', callbackTime: '14:30', durationMinutes: 30, address: 'Dorpsstraat 12, 1234 AB Voorbeeldstad', phone: '06 12 34 56 78', reason: 'Contract loopt nog', offerDiscussed: 'Ziggo Internet 200 + TV Start', contractEndDate: '2027-02-01', notes: 'Hond: niet aanbellen & kloppen', ...over })

describe('calendar event for a follow-up', () => {
  it('contains everything the advisor needs', () => {
    const e = buildCalendarEvent(f())!
    expect(e.title).toBe('Opvolging Jan – Ziggo Internet 200 + TV Start')
    expect(e.location).toBe('Dorpsstraat 12, 1234 AB Voorbeeldstad')
    expect(e.details.split('\n')).toEqual(['Reden: Contract loopt nog', 'Telefoon: 06 12 34 56 78', 'Adres: Dorpsstraat 12, 1234 AB Voorbeeldstad', 'Besproken aanbieding: Ziggo Internet 200 + TV Start', 'Huidig contract loopt tot: 1 februari 2027', 'Notities: Hond: niet aanbellen & kloppen'])
  })
  it('timed appointment: local start and end', () => {
    const e = buildCalendarEvent(f())!
    expect([e.allDay, e.start, e.end]).toEqual([false, '20261203T143000', '20261203T150000'])
    expect(buildCalendarEvent(f({ durationMinutes: 90 }))!.end).toBe('20261203T160000')
    expect(buildCalendarEvent(f({ durationMinutes: null }))!.end).toBe('20261203T150000')
  })
  it('crossing midnight ends on the next day, also across a month boundary', () => {
    const e = buildCalendarEvent(f({ callbackDate: '2026-12-31', callbackTime: '23:45', durationMinutes: 30 }))!
    expect([e.start, e.end]).toEqual(['20261231T234500', '20270101T001500'])
  })
  it('without a time it is an all-day event ending the next day', () => {
    const e = buildCalendarEvent(f({ callbackTime: null }))!
    expect([e.allDay, e.start, e.end]).toEqual([true, '20261203', '20261204'])
    expect(buildCalendarEvent(f({ callbackTime: '25:99' }))!.allDay).toBe(true)
  })
  it('no date means no event', () => {
    expect(buildCalendarEvent(f({ callbackDate: null }))).toBeNull()
    expect(buildCalendarEvent(f({ callbackDate: 'morgen' }))).toBeNull()
  })
  it('leaves out empty fields', () => {
    const e = buildCalendarEvent(f({ reference: '', address: '', phone: '', reason: '', offerDiscussed: '', contractEndDate: null, notes: '' }))!
    expect(e).toMatchObject({ title: 'Opvolging', location: '', details: '' })
  })
  it('never contains commission or internal sales data', () => {
    expect(JSON.stringify(buildCalendarEvent(f()))).not.toMatch(/provisie|commissie|weekdoel/i)
  })
})

describe('Google Calendar link', () => {
  it('prefills title, time, timezone, location and details', () => {
    const url = new URL(googleCalendarUrl(buildCalendarEvent(f())!))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Opvolging Jan – Ziggo Internet 200 + TV Start')
    expect(url.searchParams.get('dates')).toBe('20261203T143000/20261203T150000')
    expect(url.searchParams.get('ctz')).toBe('Europe/Amsterdam')
    expect(url.searchParams.get('location')).toBe('Dorpsstraat 12, 1234 AB Voorbeeldstad')
    expect(url.searchParams.get('details')).toContain('Telefoon: 06 12 34 56 78\nAdres: Dorpsstraat 12')
    expect(url.searchParams.get('details')).toContain('niet aanbellen & kloppen')
  })
  it('all-day link has plain dates and no timezone; no empty location', () => {
    const url = new URL(googleCalendarUrl(buildCalendarEvent(f({ callbackTime: null, address: '' }))!))
    expect(url.searchParams.get('dates')).toBe('20261203/20261204')
    expect(url.searchParams.has('ctz')).toBe(false)
    expect(url.searchParams.has('location')).toBe(false)
  })
})

describe('.ics file and quick links', () => {
  it('produces a valid event with escaped text', () => {
    const ics = icsFile(buildCalendarEvent(f())!, 'abc', '20261116T120000Z')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0')).toBe(true)
    expect(ics).toContain('UID:abc@overstapadvies')
    expect(ics).toContain('DTSTART;TZID=Europe/Amsterdam:20261203T143000')
    expect(ics).toContain('LOCATION:Dorpsstraat 12\\, 1234 AB Voorbeeldstad')
    expect(ics).toContain('DESCRIPTION:Reden: Contract loopt nog\\nTelefoon: 06 12 34 56 78')
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR')).toBe(true)
    expect(icsFile(buildCalendarEvent(f({ callbackTime: null }))!, 'x', 's')).toContain('DTSTART;VALUE=DATE:20261203')
  })
  it('phone and map links', () => {
    expect(telHref('06 12 34 56 78')).toBe('tel:0612345678')
    expect(telHref('+31 (0)6-1234 5678')).toBe('tel:+310612345678')
    expect(telHref('n.v.t.')).toBeNull()
    expect(mapsUrl(' Dorpsstraat 12, Voorbeeldstad ')).toBe('https://www.google.com/maps/search/?api=1&query=Dorpsstraat%2012%2C%20Voorbeeldstad')
  })
})
