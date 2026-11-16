import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './ui/button'

/** Generieke lijst met toevoegen/verwijderen voor extra's en kortingen. */
export function ListEditor<T extends { id: string }>({ items, onChange, create, addLabel, render, empty }: { items: T[]; onChange: (items: T[]) => void; create: () => T; addLabel: string; render: (item: T, update: (patch: Partial<T>) => void) => ReactNode; empty?: string }) {
  return (
    <div className="space-y-2">
      {items.length === 0 && empty && <p className="text-sm text-muted-foreground">{empty}</p>}
      {items.map((item) => (
        <div key={item.id} className="flex items-end gap-2 rounded-xl bg-muted/60 p-2.5">
          <div className="min-w-0 flex-1">{render(item, (patch) => onChange(items.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}</div>
          <Button variant="ghost" size="icon" aria-label="Verwijderen" onClick={() => onChange(items.filter((x) => x.id !== item.id))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...items, create()])}>
        <Plus /> {addLabel}
      </Button>
    </div>
  )
}
