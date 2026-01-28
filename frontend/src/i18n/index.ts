/**
 * i18n module exports
 */

export {
  createI18n,
  createAutoI18n,
  detectBrowserLocale,
  getDateLocale,
  type I18n,
  type Locale,
  type MessageKey,
} from './i18n'

export {
  useI18n,
  setGlobalLocale,
  getGlobalLocale,
  getTranslator,
  type UseI18nReturn,
} from './useI18n'

export { zh } from './locales/zh'
export { en } from './locales/en'
