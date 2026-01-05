/**
 * Theme Store 测试
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

  describe('初始化', () => {
    it('默认检测系统主题', () => {
      const store = useThemeStore()
      expect(store.current).toBe('dark')
    })

    it('系统亮色主题时检测为 light', () => {
      mockMatchMedia = vi.fn(() => createMockMediaQueryList(false))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })
      setActivePinia(createPinia())

      const store = useThemeStore()
      expect(store.current).toBe('light')
    })
  })

  describe('toggleTheme', () => {
    it('从 dark 切换到 light', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(store.current).toBe('dark')
      store.toggleTheme()
      expect(store.current).toBe('light')
    })

    it('从 light 切换到 dark', () => {
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
    it('调用 initTheme 后注册系统主题变化监听', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('cleanup 移除事件监听', () => {
      const store = useThemeStore()
      store.initTheme()
      store.cleanup()
      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('系统主题变化时自动切换', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(store.current).toBe('dark')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: false })
      expect(store.current).toBe('light')
    })

    it('系统主题变化时覆盖手动切换', () => {
      const store = useThemeStore()
      store.initTheme()
      store.toggleTheme()
      expect(store.current).toBe('light')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: true })
      expect(store.current).toBe('dark')
    })

    it('系统事件不重复切换相同主题', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(store.current).toBe('dark')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: true })
      expect(store.current).toBe('dark')
    })
  })

  describe('getters', () => {
    it('isDark 在暗色主题时返回 true', () => {
      const store = useThemeStore()
      expect(store.isDark).toBe(true)
    })

    it('isDark 在亮色主题时返回 false', () => {
      mockMatchMedia = vi.fn(() => createMockMediaQueryList(false))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })
      setActivePinia(createPinia())

      const store = useThemeStore()
      expect(store.isDark).toBe(false)
    })

    it('isLight 在亮色主题时返回 true', () => {
      mockMatchMedia = vi.fn(() => createMockMediaQueryList(false))
      vi.stubGlobal('matchMedia', mockMatchMedia)
      vi.stubGlobal('window', { matchMedia: mockMatchMedia })
      setActivePinia(createPinia())

      const store = useThemeStore()
      expect(store.isLight).toBe(true)
    })
  })
})
