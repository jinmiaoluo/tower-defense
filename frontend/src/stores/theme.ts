/**
 * Theme Store - theme state management.
 * Always follows the system theme; manual toggle is a temporary override.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Theme } from '@/types/theme'
import { getTheme, applyThemeToCSSVariables } from '@/theme'
import { AppEventBus } from '@/utils/EventEmitter'

const MEDIA_QUERY = '(prefers-color-scheme: dark)'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const current = ref<Theme>(getSystemTheme())

  let mediaQuery: MediaQueryList | null = null

  const isDark = computed(() => current.value === 'dark')
  const isLight = computed(() => current.value === 'light')

  function applyTheme(theme: Theme): void {
    if (current.value === theme) return
    current.value = theme
    applyThemeToCSSVariables(getTheme(theme))
    AppEventBus.emit('theme-changed', theme)
  }

  function handleSystemThemeChange(e: MediaQueryListEvent): void {
    const systemTheme: Theme = e.matches ? 'dark' : 'light'
    applyTheme(systemTheme)
  }

  function toggleTheme(): void {
    const newTheme: Theme = current.value === 'dark' ? 'light' : 'dark'
    applyTheme(newTheme)
  }

  function initTheme(): void {
    const systemTheme = getSystemTheme()
    current.value = systemTheme
    applyThemeToCSSVariables(getTheme(systemTheme))
    AppEventBus.emit('theme-changed', systemTheme)

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
    current,
    isDark,
    isLight,
    toggleTheme,
    initTheme,
    cleanup,
  }
})
