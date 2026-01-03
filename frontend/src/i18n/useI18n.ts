/**
 * Vue 3 Composable for i18n
 * 提供响应式的多语言支持
 */

import { ref, type Ref } from 'vue'
import { createI18n, detectBrowserLocale, type Locale, type I18n } from './i18n'
import { AppEventBus } from '@/utils/EventEmitter'

const LOCALE_STORAGE_KEY = 'tower-defense-locale'

/** 全局 i18n 实例 */
let globalI18n: I18n | null = null

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') {
      return saved
    }
  } catch {
    // localStorage 可能被禁用
  }
  return detectBrowserLocale()
}

/** 全局语言状态（响应式） */
const globalLocale = ref<Locale>(getInitialLocale())

/**
 * 获取或创建全局 i18n 实例
 */
function getGlobalI18n(): I18n {
  if (!globalI18n) {
    globalI18n = createI18n(globalLocale.value)
  }
  return globalI18n
}

/**
 * 设置全局语言
 */
export function setGlobalLocale(locale: Locale): void {
  globalLocale.value = locale
  getGlobalI18n().setLocale(locale)
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // localStorage 可能被禁用
  }
  AppEventBus.emit('locale-changed', locale)
}

/**
 * 获取全局语言
 */
export function getGlobalLocale(): Locale {
  return globalLocale.value
}

/**
 * useI18n composable 返回类型
 */
export interface UseI18nReturn {
  /** 翻译函数 */
  t: (key: string, args?: (string | number)[]) => string
  /** 当前语言（响应式） */
  locale: Ref<Locale>
  /** 设置语言 */
  setLocale: (locale: Locale) => void
}

/**
 * Vue 3 Composable for i18n
 * 提供响应式的翻译功能
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
 *   <button @click="setLocale('zh')">中文</button>
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
 * 获取翻译函数（非响应式，用于 Phaser 等非 Vue 环境）
 */
export function getTranslator(): (key: string, args?: (string | number)[]) => string {
  const i18n = getGlobalI18n()
  return (key: string, args?: (string | number)[]) => i18n.t(key, args)
}
