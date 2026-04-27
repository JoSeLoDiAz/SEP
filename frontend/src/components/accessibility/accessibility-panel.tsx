'use client'

import { useEffect, useState } from 'react'
import {
  X,
  Type,
  Contrast,
  Moon,
  AlignVerticalSpaceBetween,
  Volume2,
  Eye,
  Pause,
  Underline,
  RotateCcw,
  Accessibility as AccessIcon,
  Loader2,
  Info
} from 'lucide-react'
import { useAccessibility } from '@/lib/accessibility/store'
import type { TextSize, Spacing, Colorblind } from '@/lib/accessibility/store'

interface Props {
  open: boolean
  onClose: () => void
}

const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: 'xs', label: '90%' },
  { value: 'sm', label: '95%' },
  { value: 'md', label: '100%' },
  { value: 'lg', label: '125%' },
  { value: 'xl', label: '150%' }
]

const SPACINGS: { value: Spacing; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'comodo', label: 'Cómodo' },
  { value: 'amplio', label: 'Amplio' }
]

const COLORBLIND_OPTS: { value: Colorblind; label: string }[] = [
  { value: 'off', label: 'Sin filtro' },
  { value: 'deuteranopia', label: 'Deuteranopia (verde-rojo)' },
  { value: 'protanopia', label: 'Protanopia (rojo-verde)' },
  { value: 'tritanopia', label: 'Tritanopia (azul-amarillo)' }
]

export function AccessibilityPanel({ open, onClose }: Props) {
  const a = useAccessibility()
  const [reading, setReading] = useState(false)
  const [openTip, setOpenTip] = useState<string | null>(null)

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Cerrar tooltip al cerrar panel
  useEffect(() => { if (!open) setOpenTip(null) }, [open])

  function leerPagina() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Tu navegador no soporta lectura de pantalla.')
      return
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
      setReading(false)
      return
    }
    const main = document.querySelector('main') ?? document.body
    const text = (main as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
    if (!text) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-CO'
    u.rate = 1
    u.pitch = 1
    u.onend = () => setReading(false)
    u.onerror = () => setReading(false)
    setReading(true)
    window.speechSynthesis.speak(u)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-end p-4 sm:p-6 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-title"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative pointer-events-auto w-full max-w-sm rounded-2xl bg-gradient-to-br from-[#5B2A86] to-[#3F1B62] text-white shadow-2xl border border-white/10 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/90 flex items-center justify-center">
              <AccessIcon size={20} className="text-emerald-950" />
            </div>
            <div>
              <h2 id="a11y-title" className="text-base font-bold leading-tight">Accesibilidad</h2>
              <p className="text-xs text-white/70">Personaliza tu experiencia</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Cerrar panel de accesibilidad"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <Tile
            id="tamano"
            icon={<Type size={20} />}
            label="Tamaño texto"
            description="Aumenta o reduce el tamaño de todos los textos del aplicativo. Útil para baja visión o si quieres ver con más detalle."
            openTip={openTip}
            setOpenTip={setOpenTip}
          >
            <div className="flex flex-wrap gap-1 mt-2">
              {TEXT_SIZES.map(t => (
                <button
                  key={t.value}
                  onClick={() => a.setTextSize(t.value)}
                  className={`text-[11px] px-2 py-1 rounded-md transition ${
                    a.textSize === t.value
                      ? 'bg-emerald-400 text-emerald-950 font-semibold'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Tile>

          <Tile
            id="contraste"
            icon={<Contrast size={20} />}
            label="Alto contraste"
            description="Cambia toda la pantalla a negro/blanco/amarillo con bordes marcados. Ayuda a personas con baja visión a distinguir mejor los elementos."
            active={a.highContrast}
            onClick={a.toggleHighContrast}
            openTip={openTip}
            setOpenTip={setOpenTip}
          />

          <Tile
            id="dark"
            icon={<Moon size={20} />}
            label="Modo oscuro"
            description="Cambia el fondo claro por uno oscuro. Reduce el cansancio visual al usar el aplicativo en ambientes con poca luz o por mucho tiempo."
            active={a.darkMode}
            onClick={a.toggleDarkMode}
            openTip={openTip}
            setOpenTip={setOpenTip}
          />

          <Tile
            id="espaciado"
            icon={<AlignVerticalSpaceBetween size={20} />}
            label="Espaciado texto"
            description="Aumenta el espacio entre líneas, palabras y letras. Facilita la lectura para personas con dislexia o dificultades de lectura."
            openTip={openTip}
            setOpenTip={setOpenTip}
          >
            <div className="flex flex-wrap gap-1 mt-2">
              {SPACINGS.map(s => (
                <button
                  key={s.value}
                  onClick={() => a.setSpacing(s.value)}
                  className={`text-[10px] px-2 py-1 rounded-md transition ${
                    a.spacing === s.value
                      ? 'bg-emerald-400 text-emerald-950 font-semibold'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Tile>

          <Tile
            id="leer"
            icon={reading ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
            label={reading ? 'Detener lectura' : 'Leer página'}
            description="Lee en voz alta el contenido de la página actual usando el sintetizador del navegador. También se activa con la combinación Alt + L."
            active={reading}
            onClick={leerPagina}
            openTip={openTip}
            setOpenTip={setOpenTip}
          />

          <Tile
            id="daltonismo"
            icon={<Eye size={20} />}
            label="Daltonismo"
            description="Aplica un filtro de color para simular o compensar tres tipos de daltonismo: deuteranopia (verde-rojo), protanopia (rojo-verde) y tritanopia (azul-amarillo)."
            openTip={openTip}
            setOpenTip={setOpenTip}
          >
            <select
              value={a.colorblind}
              onChange={(e) => a.setColorblind(e.target.value as Colorblind)}
              className="mt-2 w-full text-[11px] bg-white/10 hover:bg-white/20 rounded-md px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              {COLORBLIND_OPTS.map(o => (
                <option key={o.value} value={o.value} className="text-neutral-900">
                  {o.label}
                </option>
              ))}
            </select>
          </Tile>

          <Tile
            id="anim"
            icon={<Pause size={20} />}
            label="Reducir animaciones"
            description="Desactiva o reduce al mínimo las animaciones y transiciones del aplicativo. Útil para personas con sensibilidad al movimiento o desorden vestibular."
            active={a.reducedMotion}
            onClick={a.toggleReducedMotion}
            openTip={openTip}
            setOpenTip={setOpenTip}
          />

          <Tile
            id="enlaces"
            icon={<Underline size={20} />}
            label="Subrayar enlaces"
            description="Subraya todos los enlaces del aplicativo para que se distingan claramente del texto normal, sin depender solo del color."
            active={a.underlineLinks}
            onClick={a.toggleUnderlineLinks}
            openTip={openTip}
            setOpenTip={setOpenTip}
          />

          <button
            onClick={a.reset}
            disabled={!a.hasActiveSettings()}
            className="col-span-2 mt-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            <RotateCcw size={15} />
            Restablecer todo
          </button>

          <div className="col-span-2 text-center text-[11px] text-white/60 mt-1">
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Alt</kbd>
            {' + '}
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded">L</kbd>
            {' para leer la página'}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TileProps {
  id: string
  icon: React.ReactNode
  label: string
  description: string
  active?: boolean
  onClick?: () => void
  children?: React.ReactNode
  openTip: string | null
  setOpenTip: (v: string | null) => void
}

function Tile({ id, icon, label, description, active, onClick, children, openTip, setOpenTip }: TileProps) {
  const showTip = openTip === id

  return (
    <div
      className={`relative flex flex-col items-center justify-start text-center gap-1 p-3 rounded-xl border transition min-h-[88px] ${
        active
          ? 'bg-emerald-400/20 border-emerald-400'
          : 'bg-white/10 border-white/10 hover:bg-white/20'
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick && active != null ? active : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Botón "i" — info de la opción */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpenTip(showTip ? null : id)
        }}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition"
        aria-label={`Información sobre ${label}`}
        aria-expanded={showTip}
      >
        <Info size={11} className="text-white/90" />
      </button>

      <div className="text-white pt-1">{icon}</div>
      <span className="text-xs font-medium leading-tight">{label}</span>
      {children}

      {/* Tooltip */}
      {showTip && (
        <div
          className="absolute z-10 top-full left-0 right-0 mt-1 mx-1 px-3 py-2 rounded-lg bg-neutral-900 text-white text-[11px] leading-snug shadow-lg ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
          role="tooltip"
        >
          {description}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpenTip(null)
            }}
            className="absolute top-1 right-1 text-white/60 hover:text-white"
            aria-label="Cerrar información"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  )
}
