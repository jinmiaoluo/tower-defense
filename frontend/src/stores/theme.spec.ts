/**
 * Theme Store 测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from './theme'
import { STORAGE_KEY } from '@/types/theme'

const mockStorage: Record<string, string> = {}
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  }),
  key: vi.fn(),
  length: 0,
}

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
    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('document', mockDocument)
    mockLocalStorage.clear()

    mockAddEventListener.mockClear()
    mockRemoveEventListener.mockClear()

    mockMatchMedia = vi.fn((query: string) => createMockMediaQueryList(query.includes('dark')))

    vi.stubGlobal('matchMedia', mockMatchMedia)
    vi.stubGlobal('window', {
      matchMedia: mockMatchMedia,
      localStorage: mockLocalStorage,
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('初始化', () => {
    it('默认使用 system 模式', () => {
      const store = useThemeStore()
      expect(store.mode).toBe('system')
    })

    it('从 localStorage 恢复主题设置', () => {
      mockStorage[STORAGE_KEY] = 'light'
      setActivePinia(createPinia())
      const store = useThemeStore()
      store.initTheme()
      expect(store.mode).toBe('light')
      expect(store.resolved).toBe('light')
    })

    it('localStorage 中无效值时使用默认 system 模式', () => {
      mockStorage[STORAGE_KEY] = 'invalid'
      setActivePinia(createPinia())
      const store = useThemeStore()
      store.initTheme()
      expect(store.mode).toBe('system')
    })
  })

  describe('setMode', () => {
    it('设置为 light 模式', () => {
      const store = useThemeStore()
      store.setMode('light')
      expect(store.mode).toBe('light')
      expect(store.resolved).toBe('light')
    })

    it('设置为 dark 模式', () => {
      const store = useThemeStore()
      store.setMode('dark')
      expect(store.mode).toBe('dark')
      expect(store.resolved).toBe('dark')
    })

    it('设置为 system 模式', () => {
      const store = useThemeStore()
      store.setMode('system')
      expect(store.mode).toBe('system')
    })

    it('设置主题后保存到 localStorage', () => {
      const store = useThemeStore()
      store.setMode('dark')
      expect(mockStorage[STORAGE_KEY]).toBe('dark')
    })
  })

  describe('toggleTheme', () => {
    it('从 light 切换到 dark', () => {
      const store = useThemeStore()
      store.setMode('light')
      store.toggleTheme()
      expect(store.mode).toBe('dark')
    })

    it('从 dark 切换到 light', () => {
      const store = useThemeStore()
      store.setMode('dark')
      store.toggleTheme()
      expect(store.mode).toBe('light')
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

    it('非 system 模式下不响应系统主题变化', () => {
      const store = useThemeStore()
      store.initTheme()
      store.setMode('dark')
      expect(store.resolved).toBe('dark')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: false })
      expect(store.resolved).toBe('dark')
    })

    it('system 模式下响应系统主题变化', () => {
      const store = useThemeStore()
      store.initTheme()
      expect(store.mode).toBe('system')
      expect(store.resolved).toBe('dark')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: false })
      expect(store.resolved).toBe('light')
    })

    it('系统事件不重复切换相同主题', () => {
      const store = useThemeStore()
      store.initTheme()
      store.setMode('dark')

      const changeHandler = mockAddEventListener.mock.calls[0][1]
      changeHandler({ matches: true })
      expect(store.resolved).toBe('dark')
    })
  })

  describe('getters', () => {
    it('isDark 在暗色主题时返回 true', () => {
      const store = useThemeStore()
      store.setMode('dark')
      expect(store.isDark).toBe(true)
    })

    it('isDark 在亮色主题时返回 false', () => {
      const store = useThemeStore()
      store.setMode('light')
      expect(store.isDark).toBe(false)
    })

    it('isLight 在亮色主题时返回 true', () => {
      const store = useThemeStore()
      store.setMode('light')
      expect(store.isLight).toBe(true)
    })

    it('isSystem 在 system 模式时返回 true', () => {
      const store = useThemeStore()
      store.setMode('system')
      expect(store.isSystem).toBe(true)
    })
  })
})
