import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId, sampleOffers } from '@/engine/defaults'
import { todayIso } from '@/engine/dates'
import type { CommissionSettings } from '@/engine/commission'
import { CATALOG_SCHEMA_VERSION, sampleCatalog, type Catalog } from '@/engine/catalog'
import type { ComparisonPeriod, CurrentSubscription, Offer, ProductKind, VodafoneCombo } from '@/engine/types'

export interface Settings {
  advisorName: string
  defaultPeriod: ComparisonPeriod
  weeklyTargetCents: number
  commission: CommissionSettings
}

export interface SavedConsultation {
  id: string
  savedAt: string
  label: string
  current: CurrentSubscription
  options: Offer[]
  combo: VodafoneCombo
  period: ComparisonPeriod
  startDate: string
}

export type FollowUpStatus = 'open' | 'gepland' | 'afgerond' | 'vervallen'
export interface FollowUp {
  id: string
  createdAt: string
  reference: string
  callbackDate: string | null
  reason: string
  contractEndDate: string | null
  offerDiscussed: string
  notes: string
  status: FollowUpStatus
}

export type OutcomeResult = 'verkocht' | 'opvolgen' | 'geen_interesse'
export interface Outcome {
  id: string
  date: string
  result: OutcomeResult
  offerName: string
  kind: ProductKind | null
  commissionCents: number
}

interface DataState {
  /** Vaste bundels (totaalprijs). */
  offers: Offer[]
  /** Losse onderdelen en acties voor de pakketbouwer. */
  catalog: Catalog
  updateCatalog: (fn: (c: Catalog) => Catalog) => void
  importConfig: (catalog: Catalog, bundles: Offer[] | null) => void
  settings: Settings
  consultations: SavedConsultation[]
  followUps: FollowUp[]
  outcomes: Outcome[]
  upsertOffer: (offer: Offer) => void
  deleteOffer: (id: string) => void
  duplicateOffer: (id: string) => void
  restoreSampleOffers: () => void
  updateSettings: (patch: Partial<Settings>) => void
  saveConsultation: (c: Omit<SavedConsultation, 'id' | 'savedAt'>) => void
  deleteConsultation: (id: string) => void
  upsertFollowUp: (f: FollowUp) => void
  deleteFollowUp: (id: string) => void
  clearFollowUps: () => void
  addOutcome: (o: Omit<Outcome, 'id'>) => void
  deleteOutcome: (id: string) => void
  wipeCustomerData: () => void
  wipeEverything: () => void
  importAll: (data: Partial<Pick<DataState, 'offers' | 'catalog' | 'settings' | 'consultations' | 'followUps' | 'outcomes'>>) => void
}

const defaultSettings = (): Settings => ({
  advisorName: '',
  defaultPeriod: 24,
  weeklyTargetCents: 50000,
  commission: { internetBaseCents: 4000, tvBonusCents: 1500, contract24BonusCents: 1000, vodafoneComboBonusCents: 500 },
})

export const useData = create<DataState>()(
  persist(
    (set) => ({
      offers: sampleOffers(todayIso()),
      catalog: sampleCatalog(todayIso()),
      settings: defaultSettings(),
      consultations: [],
      followUps: [],
      outcomes: [],
      updateCatalog: (fn) => set((s) => ({ catalog: fn(s.catalog) })),
      importConfig: (catalog, bundles) => set((s) => ({ catalog, offers: bundles ?? s.offers })),
      upsertOffer: (offer) => set((s) => ({ offers: s.offers.some((o) => o.id === offer.id) ? s.offers.map((o) => (o.id === offer.id ? offer : o)) : [...s.offers, offer] })),
      deleteOffer: (id) => set((s) => ({ offers: s.offers.filter((o) => o.id !== id) })),
      duplicateOffer: (id) =>
        set((s) => {
          const src = s.offers.find((o) => o.id === id)
          return src ? { offers: [...s.offers, { ...structuredClone(src), id: newId(), name: `${src.name} (kopie)` }] } : s
        }),
      restoreSampleOffers: () => set((s) => ({ offers: [...s.offers.filter((o) => !o.id.startsWith('sample-')), ...sampleOffers(todayIso())] })),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      saveConsultation: (c) => set((s) => ({ consultations: [{ ...structuredClone(c), id: newId(), savedAt: new Date().toISOString() }, ...s.consultations] })),
      deleteConsultation: (id) => set((s) => ({ consultations: s.consultations.filter((c) => c.id !== id) })),
      upsertFollowUp: (f) => set((s) => ({ followUps: s.followUps.some((x) => x.id === f.id) ? s.followUps.map((x) => (x.id === f.id ? f : x)) : [f, ...s.followUps] })),
      deleteFollowUp: (id) => set((s) => ({ followUps: s.followUps.filter((f) => f.id !== id) })),
      clearFollowUps: () => set({ followUps: [] }),
      addOutcome: (o) => set((s) => ({ outcomes: [{ ...o, id: newId() }, ...s.outcomes] })),
      deleteOutcome: (id) => set((s) => ({ outcomes: s.outcomes.filter((o) => o.id !== id) })),
      wipeCustomerData: () => set({ consultations: [], followUps: [] }),
      wipeEverything: () => set({ offers: sampleOffers(todayIso()), catalog: sampleCatalog(todayIso()), settings: defaultSettings(), consultations: [], followUps: [], outcomes: [] }),
      importAll: (data) =>
        set((s) => ({
          offers: Array.isArray(data.offers) ? data.offers : s.offers,
          catalog: data.catalog && Array.isArray(data.catalog.internet) ? { ...s.catalog, ...data.catalog, schemaVersion: CATALOG_SCHEMA_VERSION } : s.catalog,
          settings: data.settings ? { ...s.settings, ...data.settings } : s.settings,
          consultations: Array.isArray(data.consultations) ? data.consultations : s.consultations,
          followUps: Array.isArray(data.followUps) ? data.followUps : s.followUps,
          outcomes: Array.isArray(data.outcomes) ? data.outcomes : s.outcomes,
        })),
    }),
    {
      // De sleutel blijft gelijk tussen versies, zodat instellingen en prijzen een app-update overleven.
      name: 'overstapadvies.data.v1',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Partial<DataState>
        // v1 → v2: prijsconfiguratie toegevoegd. Bestaande gegevens blijven onaangeroerd.
        if (version < 2 && !state.catalog) state.catalog = sampleCatalog(todayIso())
        return state as DataState
      },
    },
  ),
)
