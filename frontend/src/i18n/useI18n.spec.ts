/**
 * useI18n composable 测试
 */

import { describe, it, expect } from 'vitest'
import { useI18n, setGlobalLocale, getGlobalLocale } from './useI18n'

describe('useI18n', () => {
  it('应返回翻译函数', () => {
    const { t } = useI18n()
    expect(typeof t).toBe('function')
  })

  it('应返回当前语言', () => {
    const { locale } = useI18n()
    expect(['zh', 'en']).toContain(locale.value)
  })

  it('应能切换语言', () => {
    const { locale, setLocale } = useI18n()

    setLocale('en')
    expect(locale.value).toBe('en')

    setLocale('zh')
    expect(locale.value).toBe('zh')
  })

  it('翻译应随语言切换更新', () => {
    const { t, setLocale } = useI18n()

    setLocale('zh')
    expect(t('button_pause_text')).toBe('暂停')

    setLocale('en')
    expect(t('button_pause_text')).toBe('Pause')
  })
})

describe('全局语言设置', () => {
  it('setGlobalLocale 应设置全局语言', () => {
    setGlobalLocale('en')
    expect(getGlobalLocale()).toBe('en')

    setGlobalLocale('zh')
    expect(getGlobalLocale()).toBe('zh')
  })

  it('useI18n 应使用全局语言', () => {
    setGlobalLocale('en')
    const { locale } = useI18n()
    expect(locale.value).toBe('en')
  })
})
