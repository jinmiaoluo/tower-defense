/**
 * i18n 多语言模块测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createI18n,
  detectBrowserLocale,
  type I18n,
} from './i18n'

describe('i18n', () => {
  describe('createI18n', () => {
    let i18n: I18n

    beforeEach(() => {
      i18n = createI18n('zh')
    })

    it('应创建 i18n 实例', () => {
      expect(i18n).toBeDefined()
      expect(typeof i18n.t).toBe('function')
      expect(typeof i18n.setLocale).toBe('function')
      expect(typeof i18n.getLocale).toBe('function')
    })

    it('默认语言应为指定语言', () => {
      expect(i18n.getLocale()).toBe('zh')
    })

    it('可以切换语言', () => {
      i18n.setLocale('en')
      expect(i18n.getLocale()).toBe('en')
    })

    it('翻译基础文本', () => {
      const zhI18n = createI18n('zh')
      const enI18n = createI18n('en')

      expect(zhI18n.t('panel_money_title')).toBe('金钱: ')
      expect(enI18n.t('panel_money_title')).toBe('Money: ')
    })

    it('翻译带参数的文本', () => {
      const zhI18n = createI18n('zh')
      const enI18n = createI18n('en')

      expect(zhI18n.t('wave_info', [5])).toBe('第 5 波')
      expect(enI18n.t('wave_info', [5])).toBe('Wave 5')
    })

    it('翻译带多个参数的文本', () => {
      const zhI18n = createI18n('zh')

      expect(zhI18n.t('not_enough_money', [300])).toBe('金钱不足，需要 $300！')
    })

    it('未知 key 应返回 key 本身', () => {
      expect(i18n.t('unknown_key')).toBe('unknown_key')
    })

    it('切换语言后翻译应更新', () => {
      expect(i18n.t('panel_score_title')).toBe('积分: ')

      i18n.setLocale('en')
      expect(i18n.t('panel_score_title')).toBe('Score: ')
    })
  })

  describe('detectBrowserLocale', () => {
    const originalNavigator = global.navigator

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
      })
    })

    it('中文浏览器应返回 zh', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'zh-CN' },
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('zh')
    })

    it('繁体中文浏览器应返回 zh', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'zh-TW' },
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('zh')
    })

    it('英文浏览器应返回 en', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('en')
    })

    it('其他语言浏览器应默认返回 en', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ja-JP' },
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('en')
    })

    it('无 navigator 时应返回 en', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('en')
    })
  })

  describe('建筑名称翻译', () => {
    it('应正确翻译所有建筑名称（中文）', () => {
      const i18n = createI18n('zh')

      expect(i18n.t('building_name_wall')).toBe('路障')
      expect(i18n.t('building_name_cannon')).toBe('炮台')
      expect(i18n.t('building_name_LMG')).toBe('轻机枪')
      expect(i18n.t('building_name_HMG')).toBe('重机枪')
      expect(i18n.t('building_name_laser_gun')).toBe('激光炮')
    })

    it('应正确翻译所有建筑名称（英文）', () => {
      const i18n = createI18n('en')

      expect(i18n.t('building_name_wall')).toBe('Roadblock')
      expect(i18n.t('building_name_cannon')).toBe('Cannon')
      expect(i18n.t('building_name_LMG')).toBe('LMG')
      expect(i18n.t('building_name_HMG')).toBe('HMG')
      expect(i18n.t('building_name_laser_gun')).toBe('Laser Gun')
    })
  })

  describe('游戏 UI 翻译', () => {
    it('应正确翻译按钮文本（中文）', () => {
      const i18n = createI18n('zh')

      expect(i18n.t('button_pause_text')).toBe('暂停')
      expect(i18n.t('button_continue_text')).toBe('继续')
      expect(i18n.t('button_restart_text')).toBe('重新开始')
      expect(i18n.t('button_upgrade_text')).toBe('升级')
      expect(i18n.t('button_sell_text')).toBe('出售')
    })

    it('应正确翻译按钮文本（英文）', () => {
      const i18n = createI18n('en')

      expect(i18n.t('button_pause_text')).toBe('Pause')
      expect(i18n.t('button_continue_text')).toBe('Continue')
      expect(i18n.t('button_restart_text')).toBe('Restart')
      expect(i18n.t('button_upgrade_text')).toBe('Upgrade')
      expect(i18n.t('button_sell_text')).toBe('Sell')
    })
  })
})
