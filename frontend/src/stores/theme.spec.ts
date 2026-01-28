/**
 * Theme Store tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from './theme'

const mockDocument = {
  documentElement: {
    style: {
      setProperty: vi.fn(),
    },
    setAttribute: vi.fn(),
  },
}

const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

const createMockMediaQueryList = (matches: boolean) => ({
  matches,
  media: '',
  addEventListener: mockAddEventListener,
  removeEventListener: mockRemoveEventListener,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
})

describe('ThemeStore', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubGlobal('document', mockDocument)

    mockAddEventListener.mockClear()
    mockRemoveEventListener.mockClear()

    mockMatchMedia = vi.fn((query: string) => createMockMediaQueryList(query.includes('dark')))

    vi.stubGlobal('matchMedia', mockMatchMedia)
    vi.stubGlobal('window', {
      matchMedia: mockMatchMedia,
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initialization', () => {
    it('should detect system theme by default', () => {
      const store = useThemeStore()
      expect(store.current).toBe('dark')
    })

    it('should detect light when system theme is light', () => {
      mockMatchMedia = vi.fn(() => createMockMediaQueryList(false))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })
      setActivePinia(createPinia())

      const store = useThemeStore()
      expect(store.current).toBe('light')
    })
  })

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(store.current).toBe('dark')
      store.toggleTheme()
      expect(store.current).toBe('light')
    })

    it('should toggle from light to dark', () => {
      mockMatchMedia = vi.fn(() => createMockMediaQueryList(false))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })
      setActivePinia(createPinia())

      const store = useThemeStore()
      store.initTheme()
      expect(store.current).toBe('light')
      store.toggleTheme()
      expect(store.current).toBe('dark')
    })
  })

  describe('initTheme', () => {
    it('should register system theme change listener after initTheme', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('should remove event listener on cleanup', () => {
      const store = useThemeStore()
      store.initTheme()
      store.cleanup()
      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('should auto-switch on system theme change', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(store.current).toBe('dark')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: false })
      expect(store.current).toBe('light')
    })

    it('should override manual toggle on system theme change', () => {
      const store = useThemeStore()
      store.initTheme()
      store.toggleTheme()
      expect(store.current).toBe('light')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: true })
      expect(store.current).toBe('dark')
    })

    it('should not redundantly switch to the same theme', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(store.current).toBe('dark')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: true })
      expect(store.current).toBe('dark')
    })
  })

  describe('getters', () => {
    it('isDark should return true when dark theme is active', () => {
      const store = useThemeStore()
      expect(store.isDark).toBe(true)
    })

    it('isDark should return false when light theme is active', () => {
      mockMatchMedia = vi.fn(() => createMockMediaQueryList(false))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })
      setActivePinia(createPinia())

      const store = useThemeStore()
      expect(store.isDark).toBe(false)
    })

    it('isLight should return true when light theme is active', () => {
      mockMatchMedia = vi.fn(() => createMockMediaQueryList(false))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })
      setActivePinia(createPinia())

      const store = useThemeStore()
      expect(store.isLight).toBe(true)
    })
  })
})
