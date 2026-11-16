import { BarChart3, CalendarClock, Settings, Sparkles, Tags, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useToast } from '@/store/toast'
import AdvicePage from '@/pages/AdvicePage'
import ComparePage from '@/pages/ComparePage'
import PricingPage from '@/pages/PricingPage'
import FollowUpsPage from '@/pages/FollowUpsPage'
import ResultsPage from '@/pages/ResultsPage'
import SettingsPage from '@/pages/SettingsPage'
import PresentationPage from '@/pages/PresentationPage'
import PrintPage from '@/pages/PrintPage'

const NAV = [
  { to: '/', label: 'Nieuw advies', icon: Sparkles },
  { to: '/prijzen', label: 'Prijzen & Aanbiedingen', icon: Tags },
  { to: '/opvolgingen', label: 'Opvolgingen', icon: CalendarClock },
  { to: '/resultaten', label: 'Mijn resultaten', icon: BarChart3 },
  { to: '/instellingen', label: 'Instellingen', icon: Settings },
]

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

function Shell() {
  const online = useOnline()
  const { pathname } = useLocation()
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <nav aria-label="Hoofdnavigatie" className="safe-b order-last z-30 flex shrink-0 border-t bg-card/90 backdrop-blur lg:order-first lg:w-[92px] lg:flex-col lg:border-r lg:border-t-0 lg:py-4">
        <div className="hidden justify-center pb-4 lg:flex">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-11 rounded-2xl shadow-card" />
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              cn(
                'group flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[10.5px] font-semibold leading-tight transition-colors lg:mx-2 lg:my-0.5 lg:min-h-[68px] lg:flex-none lg:rounded-2xl lg:text-[11px]',
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
          <Route path="/" element={<AdvicePage />} />
          <Route path="/vergelijken" element={<ComparePage />} />
          <Route path="/prijzen" element={<PricingPage />} />
          <Route path="/aanbiedingen" element={<PricingPage />} />
          <Route path="/opvolgingen" element={<FollowUpsPage />} />
          <Route path="/resultaten" element={<ResultsPage />} />
          <Route path="/instellingen" element={<SettingsPage />} />
          <Route path="*" element={<AdvicePage />} />
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
  return (
    <>
      <Routes>
        <Route path="/presentatie" element={<PresentationPage />} />
        <Route path="/afdrukken" element={<PrintPage />} />
        <Route path="*" element={<Shell />} />
      </Routes>
      <Toast />
    </>
  )
}
