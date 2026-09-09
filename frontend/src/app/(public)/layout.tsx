import { GovBar } from '@/components/public/gov-bar'
import { InstitutionalHeader } from '@/components/public/institutional-header'
import { PublicNav } from '@/components/public/public-nav'
import { PublicFooter } from '@/components/public/public-footer'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* anclado arriba: el menu sigue accesible al bajar */}
      <div className="sticky top-0 z-40 shadow-sm">
        <GovBar />
        <InstitutionalHeader />
        <PublicNav />
      </div>
      <main className="flex-1 bg-white">{children}</main>
      <PublicFooter />
    </div>
  )
}
