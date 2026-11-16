import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border bg-card shadow-card', className)} {...props} />
}

export function CardHeader({ title, description, icon, action, className }: { title: string; description?: string; icon?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 px-5 pt-5', className)}>
      {icon && <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">{icon}</div>}
      <div className="min-w-[140px] flex-1">
        <h2 className="text-[17px] font-semibold leading-tight tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Badge({ className, tone = 'neutral', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'primary' | 'accent' | 'good' | 'warn' }) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-primary-soft text-primary',
    accent: 'bg-accent-soft text-warn',
    good: 'bg-good-soft text-good',
    warn: 'bg-warn-soft text-warn',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold [&_svg]:size-3.5', tones[tone], className)} {...props} />
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary [&_svg]:size-7">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
