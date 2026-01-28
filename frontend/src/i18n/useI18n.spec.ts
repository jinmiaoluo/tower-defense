/**
 * useI18n composable tests
 */

import { describe, it, expect } from 'vitest'
import { useI18n, setGlobalLocale, getGlobalLocale } from './useI18n'

describe('useI18n', () => {
  it('should return a translation function', () => {
    const { t } = useI18n()
    expect(typeof t).toBe('function')
  })

  it('should return the current locale', () => {
    const { locale } = useI18n()
    expect(['zh', 'en']).toContain(locale.value)
  })

  it('should switch locale', () => {
    const { locale, setLocale } = useI18n()

    setLocale('en')
    expect(locale.value).toBe('en')

    setLocale('zh')
    expect(locale.value).toBe('zh')
  })

  it('should update translations after locale switch', () => {
    const { t, setLocale } = useI18n()

    setLocale('zh')
    expect(t('button_pause_text')).toBe('暂停')

    setLocale('en')
    expect(t('button_pause_text')).toBe('Pause')
  })
})

describe('global locale settings', () => {
  it('setGlobalLocale should set the global locale', () => {
    setGlobalLocale('en')
    expect(getGlobalLocale()).toBe('en')

    setGlobalLocale('zh')
    expect(getGlobalLocale()).toBe('zh')
  })

  it('useI18n should use the global locale', () => {
    setGlobalLocale('en')
    const { locale } = useI18n()
    expect(locale.value).toBe('en')
  })
})
