/**
 * Theme system integration tests.
 * Tests theme initialization, CSS variable application, and automatic system theme switching.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '@/stores/theme'
import { applyThemeToCSSVariables, getTheme, darkTheme, lightTheme, getInitialGameColors } from './colors'

describe('Theme Integration', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>
  let mediaQueryChangeHandler: ((e: { matches: boolean }) => void) | null = null
  let cssProperties: Record<string, string> = {}
  let dataTheme = ''

  beforeEach(() => {
    cssProperties = {}
    dataTheme = ''

    vi.stubGlobal('document', {
      documentElement: {
        style: {
          setProperty: vi.fn((key: string, value: string) => {
            cssProperties[key] = value
          }),
        },
        setAttribute: vi.fn((_name: string, value: string) => {
          dataTheme = value
        }),
      },
    })

    mockMatchMedia = vi.fn((query: string) => {
      const mediaQuery = {
        matches: query.includes('dark'),
        media: query,
        addEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
          mediaQueryChangeHandler = handler
        }),
        removeEventListener: vi.fn(() => {
          mediaQueryChangeHandler = null
        }),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
      return mediaQuery
    })

    vi.stubGlobal('matchMedia', mockMatchMedia)
    vi.stubGlobal('window', {
      matchMedia: mockMatchMedia,
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mediaQueryChangeHandler = null
  })

  describe('CSS variable application', () => {
    it('should set correct CSS variables when applying dark theme', () => {
      applyThemeToCSSVariables(darkTheme)

      expect(cssProperties['--color-background']).toBe('#1a1a2e')
      expect(cssProperties['--color-text']).toBe('rgba(255, 255, 255, 0.87)')
      expect(cssProperties['--color-primary']).toBe('#4488ff')
      expect(dataTheme).toBe('dark')
    })

    it('should set correct CSS variables when applying light theme', () => {
      applyThemeToCSSVariables(lightTheme)

      expect(cssProperties['--color-background']).toBe('#f5f5f5')
      expect(cssProperties['--color-text']).toBe('rgba(0, 0, 0, 0.87)')
      expect(cssProperties['--color-primary']).toBe('#2266cc')
      expect(dataTheme).toBe('light')
    })

    it('getTheme should return the correct theme config', () => {
      expect(getTheme('dark')).toBe(darkTheme)
      expect(getTheme('light')).toBe(lightTheme)
    })
  })

  describe('automatic system theme switching', () => {
    it('should always respond to system theme changes', () => {
      const store = useThemeStore()
      store.initTheme()

      expect(store.current).toBe('dark')

      if (mediaQueryChangeHandler) {
        mediaQueryChangeHandler({ matches: false })
      }

      expect(store.current).toBe('light')
    })

    it('should still respond to system theme changes after manual toggle', () => {
      const store = useThemeStore()
      store.initTheme()
      store.toggleTheme()
      expect(store.current).toBe('light')

      if (mediaQueryChangeHandler) {
        mediaQueryChangeHandler({ matches: true })
      }

      expect(store.current).toBe('dark')
    })
  })

  describe('theme config completeness', () => {
    it('darkTheme should contain all required game colors', () => {
      expect(darkTheme.gameColors.gridLine).toBeDefined()
      expect(darkTheme.gameColors.gridFill).toBeDefined()
      expect(darkTheme.gameColors.path).toBeDefined()
      expect(darkTheme.gameColors.entrance).toBeDefined()
      expect(darkTheme.gameColors.exit).toBeDefined()
      expect(darkTheme.gameColors.hoverValid).toBeDefined()
      expect(darkTheme.gameColors.hoverInvalid).toBeDefined()
      expect(darkTheme.gameColors.selected).toBeDefined()
    })

    it('lightTheme should contain all required game colors', () => {
      expect(lightTheme.gameColors.gridLine).toBeDefined()
      expect(lightTheme.gameColors.gridFill).toBeDefined()
      expect(lightTheme.gameColors.path).toBeDefined()
      expect(lightTheme.gameColors.entrance).toBeDefined()
      expect(lightTheme.gameColors.exit).toBeDefined()
      expect(lightTheme.gameColors.hoverValid).toBeDefined()
      expect(lightTheme.gameColors.hoverInvalid).toBeDefined()
      expect(lightTheme.gameColors.selected).toBeDefined()
    })
  })

  describe('canvas theme sync on first load', () => {
    it('should return dark game colors when system theme is dark', () => {
      mockMatchMedia = vi.fn(() => ({
        matches: true,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })

      const colors = getInitialGameColors()
      expect(colors.canvasBackground).toBe(darkTheme.gameColors.canvasBackground)
    })

    it('should return light game colors when system theme is light', () => {
      mockMatchMedia = vi.fn(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })

      const colors = getInitialGameColors()
      expect(colors.canvasBackground).toBe(lightTheme.gameColors.canvasBackground)
    })
  })
})
