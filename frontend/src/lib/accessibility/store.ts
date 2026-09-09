import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type Spacing = 'normal' | 'comodo' | 'amplio'
export type Colorblind = 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia'

export interface AccessibilityState {
  textSize: TextSize
  highContrast: boolean
  darkMode: boolean
  spacing: Spacing
  colorblind: Colorblind
  reducedMotion: boolean
  underlineLinks: boolean

  setTextSize: (v: TextSize) => void
  toggleHighContrast: () => void
  toggleDarkMode: () => void
  setSpacing: (v: Spacing) => void
  setColorblind: (v: Colorblind) => void
  toggleReducedMotion: () => void
  toggleUnderlineLinks: () => void
  reset: () => void
  hasActiveSettings: () => boolean
}

const defaults = {
  textSize: 'md' as TextSize,
  highContrast: false,
  darkMode: false,
  spacing: 'normal' as Spacing,
  colorblind: 'off' as Colorblind,
  reducedMotion: false,
  underlineLinks: false
}

export const useAccessibility = create<AccessibilityState>()(
  persist(
    (set, get) => ({
      ...defaults,

      setTextSize: (v) => set({ textSize: v }),
      toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setSpacing: (v) => set({ spacing: v }),
      setColorblind: (v) => set({ colorblind: v }),
      toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
      toggleUnderlineLinks: () => set((s) => ({ underlineLinks: !s.underlineLinks })),
      reset: () => set(defaults),
      hasActiveSettings: () => {
        const s = get()
        return (
          s.textSize !== 'md' ||
          s.highContrast ||
          s.darkMode ||
          s.spacing !== 'normal' ||
          s.colorblind !== 'off' ||
          s.reducedMotion ||
          s.underlineLinks
        )
      }
    }),
    { name: 'sep-accessibility' }
  )
)
