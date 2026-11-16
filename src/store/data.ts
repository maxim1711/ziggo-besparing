import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId } from '@/engine/defaults'
import type { CommissionSettings } from '@/engine/commission'
import type { Catalog as CatalogV2 } from '@/engine/catalog'
import { migrateCatalogV2, PRICING_SCHEMA_VERSION, type PricingCatalog } from '@/engine/pricing'
import { seedPricing } from '@/engine/pricingSeed'
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
  /** Zelf gemaakte vaste aanbiedingen uit eerdere versies (optioneel). */
  offers: Offer[]
  /** Prijsconfiguratie: pakketprijzen, extra's, acties en cadeaus. */
  pricing: PricingCatalog
  updatePricing: (fn: (c: PricingCatalog) => PricingCatalog) => void
  importPricing: (pricing: PricingCatalog) => void
  /** Zet de basisprijzen terug; eigen salesacties en cadeaus blijven staan. */
  restoreSeedPricing: () => void
  settings: Settings
  consultations: SavedConsultation[]
  followUps: FollowUp[]
  outcomes: Outcome[]
  upsertOffer: (offer: Offer) => void
  deleteOffer: (id: string) => void
  duplicateOffer: (id: string) => void
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
  importAll: (data: Partial<Pick<DataState, 'offers' | 'pricing' | 'settings' | 'consultations' | 'followUps' | 'outcomes'>>) => void
}

const defaultSettings = (): Settings => ({
  advisorName: '',
  defaultPeriod: 24,
  weeklyTargetCents: 50000,
  commission: { internetBaseCents: 4000, tvBonusCents: 1500, contract24BonusCents: 1000, vodafoneComboBonusCents: 500 },
})

export const PRE_V3_BACKUP_KEY = 'overstapadvies.backup.voor-v3'

export const useData = create<DataState>()(
  persist(
    (set) => ({
      offers: [],
      pricing: seedPricing(),
      settings: defaultSettings(),
      consultations: [],
      followUps: [],
      outcomes: [],
      updatePricing: (fn) => set((s) => ({ pricing: fn(s.pricing) })),
      importPricing: (pricing) => set({ pricing }),
      restoreSeedPricing: () =>
        set((s) => {
          const seed = seedPricing()
          const mine = s.pricing.promotions.filter((p) => p.channel === 'eigen')
          return { pricing: { ...seed, activationCents: s.pricing.activationCents, gifts: s.pricing.gifts, promotions: [...seed.promotions, ...mine] } }
        }),
      upsertOffer: (offer) => set((s) => ({ offers: s.offers.some((o) => o.id === offer.id) ? s.offers.map((o) => (o.id === offer.id ? offer : o)) : [...s.offers, offer] })),
      deleteOffer: (id) => set((s) => ({ offers: s.offers.filter((o) => o.id !== id) })),
      duplicateOffer: (id) =>
        set((s) => {
          const src = s.offers.find((o) => o.id === id)
          return src ? { offers: [...s.offers, { ...structuredClone(src), id: newId(), name: `${src.name} (kopie)` }] } : s
        }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      saveConsultation: (c) => set((s) => ({ consultations: [{ ...structuredClone(c), id: newId(), savedAt: new Date().toISOString() }, ...s.consultations] })),
      deleteConsultation: (id) => set((s) => ({ consultations: s.consultations.filter((c) => c.id !== id) })),
      upsertFollowUp: (f) => set((s) => ({ followUps: s.followUps.some((x) => x.id === f.id) ? s.followUps.map((x) => (x.id === f.id ? f : x)) : [f, ...s.followUps] })),
      deleteFollowUp: (id) => set((s) => ({ followUps: s.followUps.filter((f) => f.id !== id) })),
      clearFollowUps: () => set({ followUps: [] }),
      addOutcome: (o) => set((s) => ({ outcomes: [{ ...o, id: newId() }, ...s.outcomes] })),
      deleteOutcome: (id) => set((s) => ({ outcomes: s.outcomes.filter((o) => o.id !== id) })),
      wipeCustomerData: () => set({ consultations: [], followUps: [] }),
      wipeEverything: () => set({ offers: [], pricing: seedPricing(), settings: defaultSettings(), consultations: [], followUps: [], outcomes: [] }),
      importAll: (data) =>
        set((s) => ({
          offers: Array.isArray(data.offers) ? data.offers : s.offers,
          pricing: data.pricing && Array.isArray(data.pricing.prices) ? { ...s.pricing, ...data.pricing, schemaVersion: PRICING_SCHEMA_VERSION } : s.pricing,
          settings: data.settings ? { ...s.settings, ...data.settings } : s.settings,
          consultations: Array.isArray(data.consultations) ? data.consultations : s.consultations,
          followUps: Array.isArray(data.followUps) ? data.followUps : s.followUps,
          outcomes: Array.isArray(data.outcomes) ? data.outcomes : s.outcomes,
        })),
    }),
    {
      // De sleutel blijft gelijk tussen versies, zodat instellingen en prijzen een app-update overleven.
      name: 'overstapadvies.data.v1',
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Partial<DataState> & { catalog?: CatalogV2 }
        if (version < 3) {
          // Veiligheidskopie van de oude gegevens vóór de migratie (te downloaden via Back-up).
          try {
            localStorage.setItem(PRE_V3_BACKUP_KEY, JSON.stringify({ app: 'overstapadvies', version, savedAt: new Date().toISOString(), state }))
          } catch {
            /* opslag vol of geblokkeerd: migratie gaat door, zonder kopie */
          }
          // v3: officiële prijsmatrix. Eigen (niet-voorbeeld) extra's en acties gaan mee; verzonnen voorbeelden vervallen.
          state.pricing = migrateCatalogV2(state.catalog, seedPricing())
          delete state.catalog
          state.offers = (state.offers ?? []).filter((o) => !o.id.startsWith('sample-') && !o.isExample)
        }
        return state as DataState
      },
    },
  ),
)
