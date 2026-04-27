'use client'

import { useEffect, useState } from 'react'
import { Accessibility } from 'lucide-react'
import { AccessibilityPanel } from './accessibility-panel'
import { ColorblindFilters } from './colorblind-filters'
import { useAccessibility } from '@/lib/accessibility/store'

export function AccessibilityFab() {
  const [open, setOpen] = useState(false)
  const a = useAccessibility()

  // Aplica preferencias al <html> via data-attributes
  useEffect(() => {
    const root = document.documentElement
    root.dataset.textSize = a.textSize
    root.dataset.spacing = a.spacing
    root.dataset.colorblind = a.colorblind
    root.dataset.highContrast = String(a.highContrast)
    root.dataset.darkMode = String(a.darkMode)
    root.dataset.reducedMotion = String(a.reducedMotion)
    root.dataset.underlineLinks = String(a.underlineLinks)
  }, [
    a.textSize,
    a.spacing,
    a.colorblind,
    a.highContrast,
    a.darkMode,
    a.reducedMotion,
    a.underlineLinks
  ])

  // Atajo Alt + L para leer página
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        if (typeof window === 'undefined' || !window.speechSynthesis) return
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel()
          return
        }
        const main = document.querySelector('main') ?? document.body
        const text = (main as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
        if (!text) return
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'es-CO'
        window.speechSynthesis.speak(u)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Detener cualquier lectura al desmontar
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return (
    <>
      <ColorblindFilters />
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar accesibilidad' : 'Abrir opciones de accesibilidad'}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#6C29B3] to-[#4A1A82] text-white shadow-lg shadow-purple-900/30 hover:scale-105 active:scale-95 transition flex items-center justify-center ring-2 ring-white/20"
      >
        <Accessibility size={26} strokeWidth={2.2} />
      </button>
      <AccessibilityPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
