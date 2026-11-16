import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { compare } from '@/engine/calc'
import { composeOffer, emptySelection, isActive, type PriceLine, type Selection } from '@/engine/catalog'
import { buildCustomerView, type CustomerView } from '@/engine/customerView'
import { todayIso } from '@/engine/dates'
import { emptyCombo, emptyCurrent, newId } from '@/engine/defaults'
import { buildInsights, buildSummary } from '@/engine/insights'
import { rankOptions, type OptionBadge } from '@/engine/ranking'
import type { ComparisonPeriod, ComparisonResult, CurrentSubscription, Insight, Offer, VodafoneCombo } from '@/engine/types'
import { useData, type SavedConsultation } from './data'

export const MAX_OPTIONS = 3

/** Eén optie in het advies: een selectie uit de catalogus, of een vastgezette aanbieding. */
export interface Build {
  id: string
  selection: Selection
  /** Vastgezet (handmatig aangepast of geopend uit een opgeslagen advies); gaat vóór de selectie. */
  snapshot: Offer | null
}

/**
 * Werkconcept van het lopende advies. Staat alleen in sessionStorage (verdwijnt
 * bij het sluiten van de app) en bevat geen persoonsgegevens. Blijvend opslaan
 * gebeurt uitsluitend via een expliciete actie van de adviseur.
 */
interface DraftState {
  step: 1 | 2
  current: CurrentSubscription
  builds: Build[]
  activeIndex: number
  combo: VodafoneCombo
  period: ComparisonPeriod
  startDate: string
  setStep: (step: 1 | 2) => void
  setCurrent: (patch: Partial<CurrentSubscription>) => void
  setSelection: (patch: Partial<Selection>) => void
  setSnapshot: (offer: Offer | null) => void
  addOption: () => void
  removeOption: (index: number) => void
  setActive: (index: number) => void
  setCombo: (patch: Partial<VodafoneCombo>) => void
  setPeriod: (p: ComparisonPeriod) => void
  reset: () => void
  load: (c: SavedConsultation) => void
}

const newBuild = (): Build => ({ id: newId(), selection: emptySelection(), snapshot: null })

const fresh = () => ({
  step: 1 as const,
  current: emptyCurrent(),
  builds: [newBuild()],
  activeIndex: 0,
  combo: emptyCombo(),
  period: useData.getState().settings.defaultPeriod,
  startDate: todayIso(),
})

const patchActive = (s: DraftState, fn: (b: Build) => Build) => ({ builds: s.builds.map((b, i) => (i === s.activeIndex ? fn(b) : b)) })

export const useDraft = create<DraftState>()(
  persist(
    (set) => ({
      ...fresh(),
      setStep: (step) =>
        set((s) => {
          if (step !== 2) return { step }
          // Bij de eerste stap naar de pakketbouwer: tv alvast gelijk aan de huidige situatie.
          const catalog = useData.getState().catalog
          const firstTv = catalog.tv.find((t) => isActive(t, s.startDate))
          return {
            step,
            builds: s.builds.map((b) => (b.snapshot || b.selection.internetId || b.selection.bundleId ? b : { ...b, selection: { ...b.selection, tvId: s.current.hasTv ? (firstTv?.id ?? null) : null } })),
          }
        }),
      setCurrent: (patch) => set((s) => ({ current: { ...s.current, ...patch } })),
      setSelection: (patch) => set((s) => patchActive(s, (b) => ({ ...b, selection: { ...b.selection, ...patch } }))),
      setSnapshot: (snapshot) => set((s) => patchActive(s, (b) => ({ ...b, snapshot }))),
      addOption: () =>
        set((s) => {
          if (s.builds.length >= MAX_OPTIONS) return s
          const src = s.builds[s.activeIndex]
          return { builds: [...s.builds, { ...structuredClone(src), id: newId() }], activeIndex: s.builds.length }
        }),
      removeOption: (index) =>
        set((s) => {
          if (s.builds.length <= 1) return s
          const builds = s.builds.filter((_, i) => i !== index)
          return { builds, activeIndex: Math.min(s.activeIndex, builds.length - 1) }
        }),
      setActive: (activeIndex) => set({ activeIndex }),
      setCombo: (patch) => set((s) => ({ combo: { ...s.combo, ...patch } })),
      setPeriod: (period) => set({ period }),
      reset: () => set(fresh()),
      load: (c) =>
        set({
          step: 2,
          current: structuredClone(c.current),
          builds: c.options.length ? c.options.map((o) => ({ id: newId(), selection: emptySelection(), snapshot: structuredClone(o) })) : [newBuild()],
          combo: { ...c.combo },
          period: c.period,
          startDate: c.startDate,
          activeIndex: 0,
        }),
    }),
    { name: 'overstapadvies.draft.v2', storage: createJSONStorage(() => sessionStorage) },
  ),
)

export interface OptionComparison {
  offer: Offer
  result: ComparisonResult
  insights: Insight[]
  summary: string
  view: CustomerView
  badges: OptionBadge[]
  letter: string
  lines: PriceLine[]
  missing: string[]
  /** Index in draft.builds. */
  buildIndex: number
}

/** Alle berekeningen voor het werkconcept; herberekent bij elke invoerwijziging. */
export function useComparison() {
  const { current, builds, combo, period, startDate, activeIndex } = useDraft()
  const catalog = useData((s) => s.catalog)
  const bundles = useData((s) => s.offers)
  return useMemo(() => {
    const composed = builds.map((b) => (b.snapshot ? { offer: b.snapshot, missing: [] as string[], lines: [] as PriceLine[] } : composeOffer(catalog, bundles, b.selection, startDate)))
    const base = composed.flatMap((c, buildIndex) => {
      if (!c.offer) return []
      const input = { current, offer: c.offer, combo, period, startDate }
      const result = compare(input)
      const insights = buildInsights(input, result)
      return [{ offer: c.offer, result, insights, summary: buildSummary(insights), view: buildCustomerView(input), lines: c.lines, missing: c.missing, buildIndex }]
    })
    const badges = rankOptions(base)
    const all: OptionComparison[] = base.map((b, i) => ({ ...b, badges: badges[i], letter: 'ABC'[b.buildIndex] }))
    const active = all.find((o) => o.buildIndex === activeIndex)
    return { all, active, activeIndex: active ? all.indexOf(active) : 0, current, combo, period, startDate }
  }, [current, builds, combo, period, startDate, activeIndex, catalog, bundles])
}
