/**
 * 主题系统集成测试
 * 测试主题初始化、CSS 变量应用和系统主题自动切换
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '@/stores/theme'
import { applyThemeToCSSVariables, getTheme, darkTheme, lightTheme } from './colors'
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

describe('Theme Integration', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>
  let mediaQueryChangeHandler: ((e: { matches: boolean }) => void) | null = null
  let cssProperties: Record<string, string> = {}
  let dataTheme = ''

  beforeEach(() => {
    cssProperties = {}
    dataTheme = ''

    vi.stubGlobal('localStorage', mockLocalStorage)
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

    mockLocalStorage.clear()

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

  describe('CSS 变量应用', () => {
    it('应用暗色主题时设置正确的 CSS 变量', () => {
      applyThemeToCSSVariables(darkTheme)

      expect(cssProperties['--color-background']).toBe('#1a1a2e')
      expect(cssProperties['--color-text']).toBe('rgba(255, 255, 255, 0.87)')
      expect(cssProperties['--color-primary']).toBe('#4488ff')
      expect(dataTheme).toBe('dark')
    })

    it('应用亮色主题时设置正确的 CSS 变量', () => {
      applyThemeToCSSVariables(lightTheme)

      expect(cssProperties['--color-background']).toBe('#f5f5f5')
      expect(cssProperties['--color-text']).toBe('rgba(0, 0, 0, 0.87)')
      expect(cssProperties['--color-primary']).toBe('#2266cc')
      expect(dataTheme).toBe('light')
    })

    it('getTheme 返回正确的主题配置', () => {
      expect(getTheme('dark')).toBe(darkTheme)
      expect(getTheme('light')).toBe(lightTheme)
    })
  })

  describe('系统主题自动切换', () => {
    it('system 模式下响应系统主题变化', () => {
      const store = useThemeStore()
      store.initTheme()

      expect(store.mode).toBe('system')
      expect(store.resolved).toBe('dark')

      if (mediaQueryChangeHandler) {
        mediaQueryChangeHandler({ matches: false })
      }

      expect(store.resolved).toBe('light')
    })

    it('非 system 模式下不响应系统主题变化', () => {
      const store = useThemeStore()
      store.initTheme()
      store.setMode('dark')

      if (mediaQueryChangeHandler) {
        mediaQueryChangeHandler({ matches: false })
      }

      expect(store.resolved).toBe('dark')
    })
  })

  describe('主题持久化', () => {
    it('主题设置保存到 localStorage', () => {
      const store = useThemeStore()
      store.setMode('light')

      expect(mockStorage[STORAGE_KEY]).toBe('light')
    })

    it('从 localStorage 恢复主题设置', () => {
      mockStorage[STORAGE_KEY] = 'dark'
      setActivePinia(createPinia())

      const store = useThemeStore()
      store.initTheme()

      expect(store.mode).toBe('dark')
      expect(store.resolved).toBe('dark')
    })
  })

  describe('主题配置完整性', () => {
    it('darkTheme 包含所有必需的游戏颜色', () => {
      expect(darkTheme.gameColors.gridLine).toBeDefined()
      expect(darkTheme.gameColors.gridFill).toBeDefined()
      expect(darkTheme.gameColors.path).toBeDefined()
      expect(darkTheme.gameColors.entrance).toBeDefined()
      expect(darkTheme.gameColors.exit).toBeDefined()
      expect(darkTheme.gameColors.hoverValid).toBeDefined()
      expect(darkTheme.gameColors.hoverInvalid).toBeDefined()
      expect(darkTheme.gameColors.selected).toBeDefined()
    })

    it('lightTheme 包含所有必需的游戏颜色', () => {
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
})
