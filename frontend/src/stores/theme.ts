/**
 * Theme Store - 主题状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ThemeMode, ResolvedTheme } from '@/types/theme'
import { STORAGE_KEY } from '@/types/theme'
import { getTheme, applyThemeToCSSVariables } from '@/theme'
import { AppEventBus } from '@/utils/EventEmitter'

const MEDIA_QUERY = '(prefers-color-scheme: dark)'

function isValidThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('system')
  const resolved = ref<ResolvedTheme>(getSystemTheme())

  let mediaQuery: MediaQueryList | null = null

  const isDark = computed(() => resolved.value === 'dark')
  const isLight = computed(() => resolved.value === 'light')
  const isSystem = computed(() => mode.value === 'system')

  function resolveTheme(): ResolvedTheme {
    if (mode.value === 'system') {
      return getSystemTheme()
    }
    return mode.value
  }

  function updateResolved(): void {
    resolved.value = resolveTheme()
    applyThemeToCSSVariables(getTheme(resolved.value))
    AppEventBus.emit('theme-changed', resolved.value)
  }

  function handleSystemThemeChange(e: MediaQueryListEvent | { matches: boolean }): void {
    // 只有在 system 模式下才响应系统主题变化
    if (mode.value !== 'system') {
      return
    }
    const systemTheme: ResolvedTheme = e.matches ? 'dark' : 'light'
    if (resolved.value !== systemTheme) {
      resolved.value = systemTheme
      applyThemeToCSSVariables(getTheme(resolved.value))
      AppEventBus.emit('theme-changed', resolved.value)
    }
  }

  function setMode(newMode: ThemeMode): void {
    mode.value = newMode
    updateResolved()
    try {
      localStorage.setItem(STORAGE_KEY, newMode)
    } catch {
      // localStorage 可能被禁用
    }
  }

  function toggleTheme(): void {
    const newMode: ThemeMode = resolved.value === 'dark' ? 'light' : 'dark'
    setMode(newMode)
  }

  function initTheme(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isValidThemeMode(saved)) {
        mode.value = saved
      }
    } catch {
      // localStorage 可能被禁用
    }

    updateResolved()

    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia(MEDIA_QUERY)
      mediaQuery.addEventListener('change', handleSystemThemeChange)
    }
  }

  function cleanup(): void {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
      mediaQuery = null
    }
  }

  return {
    mode,
    resolved,
    isDark,
    isLight,
    isSystem,
    setMode,
    toggleTheme,
    initTheme,
    cleanup,
  }
})
