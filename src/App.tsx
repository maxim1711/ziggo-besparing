import { BarChart3, CalendarClock, Home, ReceiptEuro, Settings, Sparkles, Tags, WifiOff, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useToast } from '@/store/toast'
import HomePage from '@/pages/HomePage'
import AdvicePage from '@/pages/AdvicePage'
import ComparePage from '@/pages/ComparePage'
import PricingPage from '@/pages/PricingPage'
import FollowUpsPage from '@/pages/FollowUpsPage'
import ResultsPage from '@/pages/ResultsPage'
import SettingsPage from '@/pages/SettingsPage'
import PresentationPage from '@/pages/PresentationPage'
import PrintPage from '@/pages/PrintPage'
import EnergyAdvicePage from '@/pages/EnergyAdvicePage'
import EnergyTariffsPage from '@/pages/EnergyTariffsPage'
import EnergyPresentationPage from '@/pages/EnergyPresentationPage'
import EnergyPrintPage from '@/pages/EnergyPrintPage'

type Module = 'ziggo' | 'essent'
const MODULE_KEY = 'overstapadvies.module'
const ZIGGO_PATHS = ['/ziggo', '/prijzen', '/aanbiedingen', '/vergelijken', '/presentatie', '/afdrukken']

/** Welk onderdeel is actief? Volgt het adres; gedeelde schermen onthouden het laatst gekozen onderdeel. */
function useModule(): Module | null {
  const { pathname } = useLocation()
  const fromPath: Module | null = pathname.startsWith('/energie') ? 'essent' : ZIGGO_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ? 'ziggo' : null
  useEffect(() => {
    if (fromPath) {
      try {
        localStorage.setItem(MODULE_KEY, fromPath)
      } catch {
        /* opslag geblokkeerd: geen probleem */
      }
    }
  }, [fromPath])
  if (fromPath) return fromPath
  if (pathname === '/') return null
  try {
    return (localStorage.getItem(MODULE_KEY) as Module | null) ?? 'ziggo'
  } catch {
    return 'ziggo'
  }
}

const SHARED = [
  { to: '/opvolgingen', label: 'Opvolgingen', icon: CalendarClock },
  { to: '/resultaten', label: 'Mijn resultaten', icon: BarChart3 },
  { to: '/instellingen', label: 'Instellingen', icon: Settings },
]
const NAV: Record<Module, { to: string; label: string; icon: typeof Home }[]> = {
  ziggo: [
    { to: '/ziggo', label: 'Nieuw advies', icon: Sparkles },
    { to: '/prijzen', label: 'Prijzen & Aanbiedingen', icon: Tags },
  ],
  essent: [
    { to: '/energie', label: 'Nieuw advies', icon: Zap },
    { to: '/energie/tarieven', label: 'Tarieven & Acties', icon: ReceiptEuro },
  ],
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function Shell({ module }: { module: Module | null }) {
  const online = useOnline()
  const { pathname } = useLocation()
  const items = [{ to: '/', label: 'Start', icon: Home }, ...(module ? NAV[module] : []), ...SHARED]
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <nav aria-label="Hoofdnavigatie" className="safe-b order-last z-30 flex shrink-0 border-t bg-card/90 backdrop-blur lg:order-first lg:w-[92px] lg:flex-col lg:border-r lg:border-t-0 lg:py-4">
        <div className="hidden flex-col items-center gap-1 pb-3 lg:flex">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-11 rounded-2xl shadow-card" />
          {module && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{module === 'ziggo' ? 'Ziggo' : 'Essent'}</span>}
        </div>
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end
            className={({ isActive }) =>
              cn(
                'group flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[10.5px] font-semibold leading-tight transition-colors lg:mx-2 lg:my-0.5 lg:min-h-[64px] lg:flex-none lg:rounded-2xl lg:text-[11px]',
                isActive ? 'text-primary lg:bg-primary-soft' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <n.icon className="size-[22px]" strokeWidth={2} />
            <span className="text-center">{n.label}</span>
          </NavLink>
        ))}
        {!online && (
          <div className="mt-auto hidden flex-col items-center gap-1 pb-2 text-[10px] font-medium text-muted-foreground lg:flex" title="U werkt offline; alles blijft werken.">
            <WifiOff className="size-4" /> Offline
          </div>
        )}
      </nav>
      <main key={pathname} className="safe-t min-h-0 min-w-0 flex-1 animate-fade-up overflow-y-auto">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ziggo" element={<AdvicePage />} />
          <Route path="/vergelijken" element={<ComparePage />} />
          <Route path="/prijzen" element={<PricingPage />} />
          <Route path="/aanbiedingen" element={<PricingPage />} />
          <Route path="/energie" element={<EnergyAdvicePage />} />
          <Route path="/energie/tarieven" element={<EnergyTariffsPage />} />
          <Route path="/opvolgingen" element={<FollowUpsPage />} />
          <Route path="/resultaten" element={<ResultsPage />} />
          <Route path="/instellingen" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  )
}

function Toast() {
  const message = useToast((s) => s.message)
  if (!message) return null
  return (
    <div role="status" className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
      <div className="animate-fade-up rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white shadow-lift">{message}</div>
    </div>
  )
}

export default function App() {
  const module = useModule()
  // De themaklasse staat op <html>, zodat ook dialogen (die buiten de app-boom renderen) meekleuren.
  useEffect(() => {
    document.documentElement.classList.toggle('theme-essent', module === 'essent')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', module === 'essent' ? '#c2185b' : '#5b21b6')
  }, [module])
  return (
    <>
      <Routes>
        <Route path="/presentatie" element={<PresentationPage />} />
        <Route path="/afdrukken" element={<PrintPage />} />
        <Route path="/energie/presentatie" element={<EnergyPresentationPage />} />
        <Route path="/energie/afdrukken" element={<EnergyPrintPage />} />
        <Route path="*" element={<Shell module={module} />} />
      </Routes>
      <Toast />
    </>
  )
}
