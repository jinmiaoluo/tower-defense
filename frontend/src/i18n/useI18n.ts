/**
 * Vue 3 Composable for i18n
 * Provides reactive multilingual support.
 */

import { ref, type Ref } from 'vue'
import { createI18n, detectBrowserLocale, type Locale, type I18n } from './i18n'
import { AppEventBus } from '@/utils/EventEmitter'

const LOCALE_STORAGE_KEY = 'tower-defense-locale'

/** Global i18n instance */
let globalI18n: I18n | null = null

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') {
      return saved
    }
  } catch {
    // localStorage may be disabled
  }
  return detectBrowserLocale()
}

/** Global locale state (reactive) */
const globalLocale = ref<Locale>(getInitialLocale())

/**
 * Get or create the global i18n instance.
 */
function getGlobalI18n(): I18n {
  if (!globalI18n) {
    globalI18n = createI18n(globalLocale.value)
  }
  return globalI18n
}

/**
 * Set the global locale.
 */
export function setGlobalLocale(locale: Locale): void {
  globalLocale.value = locale
  getGlobalI18n().setLocale(locale)
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // localStorage may be disabled
  }
  AppEventBus.emit('locale-changed', locale)
}

/**
 * Get the global locale.
 */
export function getGlobalLocale(): Locale {
  return globalLocale.value
}

/**
 * useI18n composable return type
 */
export interface UseI18nReturn {
  /** Translation function */
  t: (key: string, args?: (string | number)[]) => string
  /** Current locale (reactive) */
  locale: Ref<Locale>
  /** Set locale */
  setLocale: (locale: Locale) => void
}

/**
 * Vue 3 Composable for i18n
 * Provides reactive translation capabilities.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useI18n } from '@/i18n'
 *
 * const { t, locale, setLocale } = useI18n()
 * </script>
 *
 * <template>
 *   <div>{{ t('panel_money_title') }}{{ money }}</div>
 *   <button @click="setLocale('en')">English</button>
 *   <button @click="setLocale('zh')">Chinese</button>
 * </template>
 * ```
 */
export function useI18n(): UseI18nReturn {
  const i18n = getGlobalI18n()

  const t = (key: string, args?: (string | number)[]): string => {
    return i18n.t(key, args)
  }

  const setLocale = (locale: Locale): void => {
    setGlobalLocale(locale)
  }

  return {
    t,
    locale: globalLocale,
    setLocale,
  }
}

/**
 * Get the translation function (non-reactive, for Phaser and other non-Vue contexts).
 */
export function getTranslator(): (key: string, args?: (string | number)[]) => string {
  const i18n = getGlobalI18n()
  return (key: string, args?: (string | number)[]) => i18n.t(key, args)
}
