import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { centsToInput, parseEuroToCents } from '@/engine/money'
import { cn } from '@/lib/utils'

const inputBase =
  'h-12 w-full rounded-xl border bg-card px-3.5 text-[16px] text-foreground shadow-[inset_0_1px_1px_rgba(24,16,48,.03)] transition placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputBase, className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputBase, 'h-auto min-h-[88px] py-3', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputBase, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6480' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }} {...props} />
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

interface MoneyInputProps {
  value: number | null
  onChange: (cents: number | null) => void
  /** Leeg veld telt als 0 in plaats van "onbekend". */
  emptyAsZero?: boolean
  placeholder?: string
  className?: string
  large?: boolean
  suffix?: string
  autoFocus?: boolean
  'aria-label'?: string
}

/** Euro-invoer met numeriek toetsenbord; slaat intern gehele centen op. */
export function MoneyInput({ value, onChange, emptyAsZero, placeholder = '0,00', className, large, suffix, autoFocus, ...rest }: MoneyInputProps) {
  const show = (v: number | null) => (v === null || (emptyAsZero && v === 0) ? '' : centsToInput(v))
  const [text, setText] = React.useState(() => show(value))
  const [focused, setFocused] = React.useState(false)
  const [invalid, setInvalid] = React.useState(false)
  React.useEffect(() => {
    if (!focused) setText(show(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused])

  return (
    <div className="relative">
      <span className={cn('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground', large && 'left-4 text-2xl font-medium')}>€</span>
      <input
        {...rest}
        autoFocus={autoFocus}
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        aria-invalid={invalid}
        onFocus={(e) => {
          setFocused(true)
          e.currentTarget.select()
        }}
        onBlur={() => {
          setFocused(false)
          setInvalid(false)
        }}
        onChange={(e) => {
          const t = e.target.value
          setText(t)
          if (t.trim() === '') {
            setInvalid(false)
            onChange(emptyAsZero ? 0 : null)
            return
          }
          const cents = parseEuroToCents(t)
          setInvalid(cents === null || cents < 0)
          if (cents !== null && cents >= 0) onChange(cents)
        }}
        className={cn(inputBase, 'tnum pl-8', large && 'h-16 pl-11 text-3xl font-semibold tracking-tight', suffix && 'pr-16', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/10', className)}
      />
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  )
}

interface NumberInputProps {
  value: number | null
  onChange: (n: number | null) => void
  min?: number
  max?: number
  suffix?: string
  placeholder?: string
  nullable?: boolean
}

export function NumberInput({ value, onChange, min = 0, max = 100000, suffix, placeholder, nullable }: NumberInputProps) {
  const [text, setText] = React.useState(value === null ? '' : String(value))
  const [focused, setFocused] = React.useState(false)
  React.useEffect(() => {
    if (!focused) setText(value === null ? '' : String(value))
  }, [value, focused])
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          setFocused(true)
          e.currentTarget.select()
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9]/g, '')
          setText(t)
          if (t === '') onChange(nullable ? null : min)
          else onChange(Math.max(min, Math.min(max, Number(t))))
        }}
        className={cn(inputBase, 'tnum', suffix && 'pr-16')}
      />
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  )
}

export function Segmented<T extends string | number>({ value, onChange, options, className, size = 'md', 'aria-label': ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; size?: 'sm' | 'md'; 'aria-label'?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex w-full rounded-xl bg-muted p-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 whitespace-nowrap rounded-[10px] px-3 text-sm font-semibold transition-all duration-200',
            size === 'md' ? 'h-11' : 'h-10',
            o.value === value ? 'bg-card text-primary shadow-card' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onCheckedChange, label, description }: { checked: boolean; onCheckedChange: (c: boolean) => void; label: string; description?: string }) {
  const id = React.useId()
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-4">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </label>
      <SwitchPrimitive.Root id={id} checked={checked} onCheckedChange={onCheckedChange} className="relative h-8 w-14 shrink-0 rounded-full bg-border transition-colors data-[state=checked]:bg-primary">
        <SwitchPrimitive.Thumb className="block size-6 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-7" />
      </SwitchPrimitive.Root>
    </div>
  )
}
