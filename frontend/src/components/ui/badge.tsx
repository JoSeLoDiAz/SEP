import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-green-500 text-white',
        secondary:   'border-transparent bg-purpura-500 text-white',
        celeste:     'border-transparent bg-celeste-500 text-white',
        lime:        'border-transparent bg-lime-500 text-white',
        outline:     'border-neutral-200 text-neutral-700 bg-white',
        warning:     'border-transparent bg-yellowrange-500 text-neutral-900',
        destructive: 'border-transparent bg-red-500 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
