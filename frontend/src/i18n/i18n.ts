/**
 * i18n 多语言模块
 * 参考旧实现的 TD._t() 函数，提供类型安全的翻译功能
 */

import { zh, en, type MessageKey } from './locales'

/** 支持的语言类型 */
export type Locale = 'zh' | 'en'

/** 语言包映射 */
const messages: Record<Locale, Record<string, string>> = {
  zh,
  en,
}

/** i18n 实例接口 */
export interface I18n {
  /** 翻译文本，支持参数替换 */
  t(key: string, args?: (string | number)[]): string
  /** 设置当前语言 */
  setLocale(locale: Locale): void
  /** 获取当前语言 */
  getLocale(): Locale
}

/**
 * 创建 i18n 实例
 * @param initialLocale 初始语言，默认为浏览器语言
 */
export function createI18n(initialLocale: Locale = 'zh'): I18n {
  let currentLocale: Locale = initialLocale

  return {
    t(key: string, args: (string | number)[] = []): string {
      const message = messages[currentLocale][key]

      if (!message) {
        return key
      }

      // 替换参数 ${0}, ${1}, ...
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
 * 检测浏览器语言并返回最匹配的 Locale
 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined' || !navigator?.language) {
    return 'en'
  }

  const browserLang = navigator.language.toLowerCase()

  // 中文（简体、繁体）
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }

  // 默认英文
  return 'en'
}

/**
 * 创建带浏览器自动检测的 i18n 实例
 */
export function createAutoI18n(): I18n {
  return createI18n(detectBrowserLocale())
}

/**
 * 根据 Locale 获取 Date API 使用的本地化字符串
 */
export function getDateLocale(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en-US'
}

// 导出类型
export type { MessageKey }
