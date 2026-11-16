import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export const Page = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`mx-auto w-full max-w-[1400px] p-4 sm:p-6 ${className}`}>{children}</div>
