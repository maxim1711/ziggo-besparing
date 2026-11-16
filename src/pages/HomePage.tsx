import { ArrowRight, Tv, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

function ModuleCard({ to, title, sub, icon, tone }: { to: string; title: string; sub: string; icon: React.ReactNode; tone: 'ziggo' | 'essent' }) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-3xl p-8 text-white shadow-lift transition-transform duration-200 active:scale-[.98]',
        tone === 'ziggo' ? 'bg-gradient-to-br from-[#6d28d9] to-[#3b1a8f]' : 'bg-gradient-to-br from-[#d81b6a] to-[#8e0f47]',
      )}
    >
      <div className="grid size-16 place-items-center rounded-2xl bg-white/15 [&_svg]:size-8">{icon}</div>
      <div>
        <div className="text-4xl font-semibold tracking-tight">{title}</div>
        <div className="mt-1 text-xl text-white/80">{sub}</div>
        <div className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-[#1e1632] transition-transform group-hover:translate-x-1">
          Nieuw advies <ArrowRight className="size-4" />
        </div>
      </div>
    </Link>
  )
}

export default function HomePage() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1100px] flex-col justify-center gap-8 p-5 sm:p-8">
      <header>
        <h1 className="text-[32px] font-semibold tracking-tight">Waar wilt u advies over geven?</h1>
        <p className="mt-1 text-muted-foreground">Kies een onderdeel. Uw prijzen, opvolgingen en resultaten blijven per onderdeel gescheiden.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <ModuleCard to="/ziggo" tone="ziggo" title="Ziggo" sub="Internet & TV" icon={<Tv />} />
        <ModuleCard to="/energie" tone="essent" title="Essent" sub="Energie" icon={<Zap />} />
      </div>
      <p className="text-xs text-muted-foreground">Onafhankelijk hulpmiddel voor de adviseur; geen officiële uiting van Ziggo of Essent.</p>
    </div>
  )
}
