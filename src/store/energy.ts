import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { todayIso } from '@/engine/dates'
import { newId } from '@/engine/defaults'
import { compareEnergyOffer, defaultRegulatory, emptyRates, exampleOffer, offerBlockedReason, rulesFor, saveOfferVersion, type CurrentEnergy, type EnergyComparison, type EnergyInput, type EnergyOffer, type RegulatoryYear, type Usage } from '@/engine/essent'

/** Opgeslagen vergelijking: bevat een onveranderlijke kopie van tarieven en regels van dat moment. */
export interface SavedEnergyComparison {
  id: string
  savedAt: string
  label: string
  input: EnergyInput
}

interface EnergyState {
  offers: EnergyOffer[]
  /** Eerdere versies van aanbiedingen, ter referentie. */
  history: EnergyOffer[]
  defaultOfferId: string | null
  regulatory: RegulatoryYear[]
  saved: SavedEnergyComparison[]
  commission: { electricityCents: number; gasCents: number }
  saveOffer: (offer: EnergyOffer) => void
  deleteOffer: (id: string) => void
  setDefault: (id: string | null) => void
  replaceOffers: (offers: EnergyOffer[]) => void
  setRegulatory: (years: RegulatoryYear[]) => void
  saveComparison: (label: string, input: EnergyInput) => void
  deleteComparison: (id: string) => void
  setCommission: (c: Partial<EnergyState['commission']>) => void
  restoreAll: (data: Partial<Pick<EnergyState, 'offers' | 'history' | 'defaultOfferId' | 'regulatory' | 'saved' | 'commission'>>) => void
}

/** Tarieven staan in de opslag van het apparaat: wijzigen kan direct, zonder nieuwe versie van de app. */
export const useEnergy = create<EnergyState>()(
  persist(
    (set) => ({
      offers: [exampleOffer(new Date().toISOString())],
      history: [],
      defaultOfferId: null,
      regulatory: defaultRegulatory(),
      saved: [],
      commission: { electricityCents: 0, gasCents: 0 },
      saveOffer: (offer) => set((s) => saveOfferVersion(s.offers, s.history, offer, new Date().toISOString())),
      deleteOffer: (id) => set((s) => ({ offers: s.offers.filter((o) => o.id !== id), defaultOfferId: s.defaultOfferId === id ? null : s.defaultOfferId })),
      setDefault: (defaultOfferId) => set({ defaultOfferId }),
      replaceOffers: (offers) => set({ offers }),
      setRegulatory: (regulatory) => set({ regulatory }),
      saveComparison: (label, input) => set((s) => ({ saved: [{ id: newId(), savedAt: new Date().toISOString(), label, input: structuredClone(input) }, ...s.saved] })),
      deleteComparison: (id) => set((s) => ({ saved: s.saved.filter((c) => c.id !== id) })),
      setCommission: (c) => set((s) => ({ commission: { ...s.commission, ...c } })),
      restoreAll: (data) =>
        set((s) => ({
          offers: Array.isArray(data.offers) ? data.offers : s.offers,
          history: Array.isArray(data.history) ? data.history : s.history,
          defaultOfferId: data.defaultOfferId ?? s.defaultOfferId,
          regulatory: Array.isArray(data.regulatory) && data.regulatory.length ? data.regulatory : s.regulatory,
          saved: Array.isArray(data.saved) ? data.saved : s.saved,
          commission: data.commission ? { ...s.commission, ...data.commission } : s.commission,
        })),
    }),
    { name: 'overstapadvies.energie.v1', version: 1 },
  ),
)

const emptyUsage = (): Usage => ({ electricityKwh: null, meter: 'enkel', peakKwh: null, offPeakKwh: null, gasM3: null, feedInKwh: 0 })
const emptyCurrent = (): CurrentEnergy => ({ supplier: '', mode: 'tarieven', rates: emptyRates(), annualCostCents: null, contractType: 'variabel', contractEndDate: null, terminationCents: 0 })

interface EnergyDraft {
  step: 1 | 2
  usage: Usage
  current: CurrentEnergy
  /** null = standaardactie. */
  offerId: string | null
  /** null = regels van het huidige jaar. */
  rulesYear: number | null
  /** Geopend uit een opgeslagen vergelijking: tarieven en regels van toen. */
  snapshot: { offer: EnergyOffer; reg: RegulatoryYear } | null
  setStep: (s: 1 | 2) => void
  setUsage: (p: Partial<Usage>) => void
  setCurrent: (p: Partial<CurrentEnergy>) => void
  setCurrentRates: (p: Partial<CurrentEnergy['rates']>) => void
  setOffer: (id: string) => void
  setRulesYear: (y: number | null) => void
  reset: () => void
  load: (c: SavedEnergyComparison) => void
}

const fresh = () => ({ step: 1 as const, usage: emptyUsage(), current: emptyCurrent(), offerId: null, rulesYear: null, snapshot: null })

/** Lopende vergelijking; alleen in sessionStorage en zonder persoonsgegevens. */
export const useEnergyDraft = create<EnergyDraft>()(
  persist(
    (set) => ({
      ...fresh(),
      setStep: (step) => set({ step }),
      setUsage: (p) => set((s) => ({ usage: { ...s.usage, ...p } })),
      setCurrent: (p) => set((s) => ({ current: { ...s.current, ...p } })),
      setCurrentRates: (p) => set((s) => ({ current: { ...s.current, rates: { ...s.current.rates, ...p } } })),
      setOffer: (offerId) => set({ offerId, snapshot: null }),
      setRulesYear: (rulesYear) => set({ rulesYear, snapshot: null }),
      reset: () => set(fresh()),
      load: (c) => set({ step: 2, usage: structuredClone(c.input.usage), current: structuredClone(c.input.current), offerId: c.input.offer.id, rulesYear: c.input.reg.year, snapshot: structuredClone({ offer: c.input.offer, reg: c.input.reg }) }),
    }),
    { name: 'overstapadvies.energie.draft.v1', storage: createJSONStorage(() => sessionStorage) },
  ),
)

/** Volgorde voor de keuzelijst: bruikbaar eerst, dan standaard, favorieten, naam. */
export function sortOffers(offers: EnergyOffer[], defaultId: string | null, today: string): EnergyOffer[] {
  const rank = (o: EnergyOffer) => (offerBlockedReason(o, today) ? 4 : 0) + (o.id === defaultId ? 0 : o.favorite ? 1 : 2)
  return [...offers].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

export interface EnergyView {
  input: EnergyInput | null
  result: EnergyComparison | null
  offer: EnergyOffer | null
  fromSnapshot: boolean
}

/** Berekening voor de lopende vergelijking; rekent bij elke wijziging opnieuw. */
export function useEnergyComparison(): EnergyView {
  const { usage, current, offerId, rulesYear, snapshot } = useEnergyDraft()
  const { offers, defaultOfferId, regulatory } = useEnergy()
  return useMemo(() => {
    const today = todayIso()
    const usable = sortOffers(offers, defaultOfferId, today)
    const offer = snapshot?.offer ?? offers.find((o) => o.id === offerId) ?? offers.find((o) => o.id === defaultOfferId && !offerBlockedReason(o, today)) ?? usable.find((o) => !offerBlockedReason(o, today)) ?? usable[0] ?? null
    const reg = snapshot?.reg ?? rulesFor(regulatory, rulesYear ?? Number(today.slice(0, 4)))
    if (!offer || !reg) return { input: null, result: null, offer, fromSnapshot: false }
    const input = { usage, current, offer, reg, today }
    return { input, result: compareEnergyOffer(input), offer, fromSnapshot: !!snapshot }
  }, [usage, current, offerId, rulesYear, snapshot, offers, defaultOfferId, regulatory])
}
