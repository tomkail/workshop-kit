import { useEffect, type ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CanvasTheme } from './types'
import { themes, defaultTheme } from './themes'

/**
 * Convert a CanvasTheme to CSS custom properties (shared by every workshop tool)
 */
export function themeToCssVars(theme: CanvasTheme): Record<string, string> {
  return {
    '--canvas-bg': theme.background,
    '--grid-dot': theme.gridColor,

    '--shape-fill': theme.fill,
    '--shape-stroke': theme.stroke,
    '--shape-stroke-hover': theme.strokeHover,
    '--shape-stroke-selected': theme.accent,
    '--shape-handle': theme.chrome,
    '--shape-selection-glow': hexToRgba(theme.accent, 0.35),

    '--path-stroke': theme.pathStroke,

    '--measure-text': theme.strokeHover,
    '--measure-line': theme.chrome,

    '--accent-color': theme.accent,
    '--accent-dim': theme.accentDim,
    '--accent-ghost': theme.accentGhost,
    '--accent-glow': hexToRgba(theme.accent, 0.35),

    '--danger': theme.danger,
    '--danger-dim': theme.dangerDim,

    '--panel-bg': theme.ui.panelBg,
    '--panel-border': theme.ui.panelBorder,
    '--panel-item-bg': theme.ui.panelItemBg,
    '--panel-item-hover': theme.ui.panelItemHover,
    '--panel-item-selected': theme.ui.panelItemSelected,

    '--menu-bg': theme.ui.menuBg,
    '--menu-hover': theme.ui.menuHover,
    '--menu-border': theme.ui.menuBorder,

    '--text-primary': theme.ui.textPrimary,
    '--text-secondary': theme.ui.textSecondary,
    '--text-muted': theme.ui.textMuted,

    '--scrollbar-track': theme.ui.scrollbarTrack,
    '--scrollbar-thumb': theme.ui.scrollbarThumb,
    '--scrollbar-thumb-hover': theme.ui.scrollbarThumbHover,

    '--overlay-subtle': theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    '--overlay-light': theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    '--overlay-medium': theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    '--overlay-strong': theme.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
    '--border-subtle': theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    '--border-medium': theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',

    '--shadow-color': theme.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)',
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export interface ThemeState {
  themeName: string
  theme: CanvasTheme
  setTheme: (name: string) => void
}

/**
 * Create a persisted theme store. Pass a per-tool key, or share one key
 * (e.g. 'workshop-theme') so every tool on the same origin follows the same theme.
 */
export function createThemeStore(storageKey: string, initial = 'amber') {
  return create<ThemeState>()(
    persist(
      (set) => ({
        themeName: initial,
        theme: themes[initial] ?? defaultTheme,
        setTheme: (name) => set({ themeName: name, theme: themes[name] ?? defaultTheme }),
      }),
      {
        name: storageKey,
        partialize: (state) => ({ themeName: state.themeName }),
        onRehydrateStorage: () => (state) => {
          if (state) state.theme = themes[state.themeName] ?? defaultTheme
        },
      }
    )
  )
}

/**
 * Applies theme CSS custom properties to the document root
 */
export function ThemeProvider({ theme, children }: { theme: CanvasTheme; children: ReactNode }) {
  useEffect(() => {
    const cssVars = themeToCssVars(theme)
    const root = document.documentElement
    for (const [property, value] of Object.entries(cssVars)) {
      root.style.setProperty(property, value)
    }
    root.style.setProperty('color-scheme', theme.isDark ? 'dark' : 'light')
    root.dataset.theme = theme.isDark ? 'dark' : 'light'
  }, [theme])

  return <>{children}</>
}
