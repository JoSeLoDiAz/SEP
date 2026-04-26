import type { Metadata } from 'next'
import { NoScrollNumbers } from '@/components/ui/no-scroll-numbers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'SEP — Sistema Especializado de Proyectos',
    template: '%s | SEP — SENA',
  },
  description: 'Plataforma de gestión de proyectos GGPC — SENA',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body><NoScrollNumbers />{children}</body>
    </html>
  )
}
