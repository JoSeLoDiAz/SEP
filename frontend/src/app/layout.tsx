import type { Metadata } from 'next'
import { NoScrollNumbers } from '@/components/ui/no-scroll-numbers'
import { AccessibilityFab } from '@/components/accessibility/accessibility-fab'
import { SkipLink } from '@/components/accessibility/skip-link'
import './globals.css'

// Script que aplica las preferencias de accesibilidad guardadas en
// localStorage ANTES de la hidratación de React. Evita el flash blanco
// (FOUC) cuando el usuario tiene "modo oscuro" o "alto contraste"
// activados al recargar.
const a11yPrehydrate = `(function(){try{var raw=localStorage.getItem('sep-accessibility');if(!raw)return;var p=JSON.parse(raw);var s=p&&p.state;if(!s)return;var r=document.documentElement;if(s.textSize)r.dataset.textSize=s.textSize;if(s.spacing)r.dataset.spacing=s.spacing;if(s.colorblind)r.dataset.colorblind=s.colorblind;if(s.highContrast!=null)r.dataset.highContrast=String(s.highContrast);if(s.darkMode!=null)r.dataset.darkMode=String(s.darkMode);if(s.reducedMotion!=null)r.dataset.reducedMotion=String(s.reducedMotion);if(s.underlineLinks!=null)r.dataset.underlineLinks=String(s.underlineLinks);}catch(e){}})();`

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
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: a11yPrehydrate }} />
      </head>
      <body><SkipLink /><NoScrollNumbers />{children}<AccessibilityFab /></body>
    </html>
  )
}
