import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 select-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white shadow-lift hover:brightness-110',
        secondary: 'bg-primary-soft text-primary hover:brightness-95',
        outline: 'border bg-card text-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        danger: 'bg-red-50 text-red-700 hover:bg-red-100',
      },
      size: {
        md: 'h-12 px-4 text-[15px] [&_svg]:size-[18px]',
        sm: 'h-11 px-3 text-sm [&_svg]:size-4',
        lg: 'h-14 px-6 text-base [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, type, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'
