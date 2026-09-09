import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'green' | 'purpura' | 'celeste' | 'lime'

const variantStyles: Record<Variant, { icon: string; card: string }> = {
  green:   { icon: 'bg-green-50 text-green-500',   card: '' },
  purpura: { icon: 'bg-purpura-50 text-purpura-500', card: '' },
  celeste: { icon: 'bg-celeste-50 text-celeste-500', card: '' },
  lime:    { icon: 'bg-lime-50 text-lime-500',      card: '' },
}

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  variant: Variant
}

export function StatCard({ label, value, icon: Icon, variant }: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-5 bg-white rounded-xl border border-neutral-200 shadow-sm transition-shadow hover:shadow-md',
        styles.card
      )}
    >
      <div
        className={cn(
          'w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0',
          styles.icon
        )}
      >
        <Icon size={20} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-2xl font-bold leading-tight text-neutral-900">
          {value}
        </span>
        <span className="text-sm text-neutral-600 truncate">{label}</span>
      </div>
    </div>
  )
}
