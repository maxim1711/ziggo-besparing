import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({ open, onOpenChange, title, description, children, footer, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[#1a1030]/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border bg-card shadow-lift data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            wide ? 'max-w-3xl' : 'max-w-lg',
          )}
        >
          <div className="flex items-start gap-3 border-b px-6 py-4">
            <div className="flex-1">
              <DialogPrimitive.Title className="text-lg font-semibold tracking-tight">{title}</DialogPrimitive.Title>
              {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            <DialogPrimitive.Close aria-label="Sluiten" className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
