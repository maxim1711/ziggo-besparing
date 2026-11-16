import { AlertTriangle, CheckCircle2, Info, TrendingUp } from 'lucide-react'
import type { Insight } from '@/engine/types'
import { cn } from '@/lib/utils'

const tones = {
  positive: { icon: CheckCircle2, cls: 'text-good' },
  negative: { icon: TrendingUp, cls: 'text-warn' },
  warning: { icon: AlertTriangle, cls: 'text-accent' },
  neutral: { icon: Info, cls: 'text-muted-foreground' },
}

export function InsightList({ insights, big, limit }: { insights: Insight[]; big?: boolean; limit?: number }) {
  const list = limit ? insights.slice(0, limit) : insights
  return (
    <ul className={cn('space-y-2.5', big && 'space-y-4')}>
      {list.map((i) => {
        const T = tones[i.tone]
        return (
          <li key={i.id} className={cn('flex gap-2.5 leading-snug', big ? 'text-lg' : 'text-sm')}>
            <T.icon className={cn('mt-0.5 shrink-0', big ? 'size-6' : 'size-4', T.cls)} aria-hidden />
            <span>{i.text}</span>
          </li>
        )
      })}
    </ul>
  )
}
