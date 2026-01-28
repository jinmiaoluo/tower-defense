/**
 * i18n module
 * Provides type-safe translation, inspired by the legacy TD._t() function.
 */

import { zh, en, type MessageKey } from './locales'

/** Supported locale types */
export type Locale = 'zh' | 'en'

/** Locale-to-messages mapping */
const messages: Record<Locale, Record<string, string>> = {
  zh,
  en,
}

/** i18n instance interface */
export interface I18n {
  /** Translate text with optional parameter substitution */
  t(key: string, args?: (string | number)[]): string
  /** Set the current locale */
  setLocale(locale: Locale): void
  /** Get the current locale */
  getLocale(): Locale
}

/**
 * Create an i18n instance.
 * @param initialLocale Initial locale, defaults to browser locale
 */
export function createI18n(initialLocale: Locale = 'zh'): I18n {
  let currentLocale: Locale = initialLocale

  return {
    t(key: string, args: (string | number)[] = []): string {
      const message = messages[currentLocale][key]

      if (!message) {
        return key
      }

      // Replace parameters ${0}, ${1}, ...
      let result = message
      for (let i = 0; i < args.length; i++) {
        result = result.replace(`\${${i}}`, String(args[i]))
      }

      return result
    },

    setLocale(locale: Locale): void {
      currentLocale = locale
    },

    getLocale(): Locale {
      return currentLocale
    },
  }
}

/**
 * Detect the browser language and return the best matching Locale.
 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined' || !navigator?.language) {
    return 'en'
  }

  const browserLang = navigator.language.toLowerCase()

  // Chinese (Simplified or Traditional)
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }

  // Default to English
  return 'en'
}

/**
 * Create an i18n instance with automatic browser locale detection.
 */
export function createAutoI18n(): I18n {
  return createI18n(detectBrowserLocale())
}

/**
 * Get the locale string used by the Date API for the given Locale.
 */
export function getDateLocale(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en-US'
}

// Export types
export type { MessageKey }
