/**
 * i18n module tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createI18n,
  detectBrowserLocale,
  getDateLocale,
  type I18n,
} from './i18n'

describe('i18n', () => {
  describe('createI18n', () => {
    let i18n: I18n

    beforeEach(() => {
      i18n = createI18n('zh')
    })

    it('should create an i18n instance', () => {
      expect(i18n).toBeDefined()
      expect(typeof i18n.t).toBe('function')
      expect(typeof i18n.setLocale).toBe('function')
      expect(typeof i18n.getLocale).toBe('function')
    })

    it('should have the specified default locale', () => {
      expect(i18n.getLocale()).toBe('zh')
    })

    it('should switch locale', () => {
      i18n.setLocale('en')
      expect(i18n.getLocale()).toBe('en')
    })

    it('should translate basic text', () => {
      const zhI18n = createI18n('zh')
      const enI18n = createI18n('en')

      expect(zhI18n.t('panel_money_title')).toBe('金钱: ')
      expect(enI18n.t('panel_money_title')).toBe('Money: ')
    })

    it('should translate text with parameters', () => {
      const zhI18n = createI18n('zh')
      const enI18n = createI18n('en')

      expect(zhI18n.t('wave_info', [5])).toBe('第 5 波')
      expect(enI18n.t('wave_info', [5])).toBe('Wave 5')
    })

    it('should translate text with multiple parameters', () => {
      const zhI18n = createI18n('zh')

      expect(zhI18n.t('not_enough_money', [300])).toBe('金钱不足，需要 $300！')
    })

    it('should return the key itself for unknown keys', () => {
      expect(i18n.t('unknown_key')).toBe('unknown_key')
    })

    it('should update translations after switching locale', () => {
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

    it('should return zh for Chinese browsers', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'zh-CN' },
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('zh')
    })

    it('should return zh for Traditional Chinese browsers', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'zh-TW' },
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('zh')
    })

    it('should return en for English browsers', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('en')
    })

    it('should default to en for other language browsers', () => {
      Object.defineProperty(global, 'navigator', {
        value: { language: 'ja-JP' },
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('en')
    })

    it('should return en when navigator is unavailable', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
      })
      expect(detectBrowserLocale()).toBe('en')
    })
  })

  describe('building name translations', () => {
    it('should correctly translate all building names (Chinese)', () => {
      const i18n = createI18n('zh')

      expect(i18n.t('building_name_wall')).toBe('路障')
      expect(i18n.t('building_name_cannon')).toBe('炮台')
      expect(i18n.t('building_name_LMG')).toBe('轻机枪')
      expect(i18n.t('building_name_HMG')).toBe('重机枪')
      expect(i18n.t('building_name_laser_gun')).toBe('激光炮')
    })

    it('should correctly translate all building names (English)', () => {
      const i18n = createI18n('en')

      expect(i18n.t('building_name_wall')).toBe('Roadblock')
      expect(i18n.t('building_name_cannon')).toBe('Cannon')
      expect(i18n.t('building_name_LMG')).toBe('LMG')
      expect(i18n.t('building_name_HMG')).toBe('HMG')
      expect(i18n.t('building_name_laser_gun')).toBe('Laser Gun')
    })
  })

  describe('game UI translations', () => {
    it('should correctly translate button text (Chinese)', () => {
      const i18n = createI18n('zh')

      expect(i18n.t('button_pause_text')).toBe('暂停')
      expect(i18n.t('button_continue_text')).toBe('继续')
      expect(i18n.t('button_restart_text')).toBe('重新开始')
      expect(i18n.t('button_endgame_text')).toBe('结束')
      expect(i18n.t('button_upgrade_text')).toBe('升级')
      expect(i18n.t('button_sell_text')).toBe('出售')
    })

    it('should correctly translate button text (English)', () => {
      const i18n = createI18n('en')

      expect(i18n.t('button_pause_text')).toBe('Pause')
      expect(i18n.t('button_continue_text')).toBe('Continue')
      expect(i18n.t('button_restart_text')).toBe('Restart')
      expect(i18n.t('button_endgame_text')).toBe('End Game')
      expect(i18n.t('button_upgrade_text')).toBe('Upgrade')
      expect(i18n.t('button_sell_text')).toBe('Sell')
    })
  })

  describe('leaderboard translations', () => {
    it('should correctly translate leaderboard text (Chinese)', () => {
      const i18n = createI18n('zh')

      expect(i18n.t('leaderboard')).toBe('排行榜')
      expect(i18n.t('rank')).toBe('排名')
      expect(i18n.t('player')).toBe('玩家')
      expect(i18n.t('score')).toBe('得分')
      expect(i18n.t('waves')).toBe('波次')
      expect(i18n.t('date')).toBe('日期')
      expect(i18n.t('retry')).toBe('重试')
      expect(i18n.t('close')).toBe('关闭')
      expect(i18n.t('leaderboard_error')).toBe('加载排行榜失败')
      expect(i18n.t('leaderboard_empty')).toBe('暂无记录，成为第一个上榜者吧！')
    })

    it('should correctly translate leaderboard text (English)', () => {
      const i18n = createI18n('en')

      expect(i18n.t('leaderboard')).toBe('Leaderboard')
      expect(i18n.t('rank')).toBe('Rank')
      expect(i18n.t('player')).toBe('Player')
      expect(i18n.t('score')).toBe('Score')
      expect(i18n.t('waves')).toBe('Waves')
      expect(i18n.t('date')).toBe('Date')
      expect(i18n.t('retry')).toBe('Retry')
      expect(i18n.t('close')).toBe('Close')
      expect(i18n.t('leaderboard_error')).toBe('Failed to load leaderboard')
      expect(i18n.t('leaderboard_empty')).toBe('No records yet. Be the first!')
    })
  })

  describe('getDateLocale', () => {
    it('should return zh-CN for Chinese locale', () => {
      expect(getDateLocale('zh')).toBe('zh-CN')
    })

    it('should return en-US for English locale', () => {
      expect(getDateLocale('en')).toBe('en-US')
    })

    it('should use correct date format with Date.toLocaleDateString', () => {
      const date = new Date('2024-06-15T12:00:00Z')

      const zhFormatted = date.toLocaleDateString(getDateLocale('zh'), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      const enFormatted = date.toLocaleDateString(getDateLocale('en'), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })

      // Chinese format should contain year, month, and day
      expect(zhFormatted).toMatch(/2024/)
      expect(zhFormatted).toMatch(/6/)
      expect(zhFormatted).toMatch(/15/)

      // English format should contain Jun and 15
      expect(enFormatted).toMatch(/Jun/)
      expect(enFormatted).toMatch(/15/)
      expect(enFormatted).toMatch(/2024/)
    })
  })
})
