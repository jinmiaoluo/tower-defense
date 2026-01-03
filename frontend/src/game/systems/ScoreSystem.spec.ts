/**
 * ScoreSystem 测试用例
 * 测试得分计算逻辑，包括命中得分和最终得分
 * 参考文档：docs/SPEC.md 得分计算章节
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createScoreSystem, type ScoreSystem } from './ScoreSystem'

describe('ScoreSystem', () => {
  let system: ScoreSystem

  beforeEach(() => {
    system = createScoreSystem()
  })

  // ============================================================================
  // calculateHitScore - 命中得分计算
  // ============================================================================

  describe('calculateHitScore', () => {
    it('得分 = floor(sqrt(actualDamage))', () => {
      expect(system.calculateHitScore(1)).toBe(1) // sqrt(1) = 1
      expect(system.calculateHitScore(4)).toBe(2) // sqrt(4) = 2
      expect(system.calculateHitScore(9)).toBe(3) // sqrt(9) = 3
      expect(system.calculateHitScore(16)).toBe(4) // sqrt(16) = 4
      expect(system.calculateHitScore(100)).toBe(10) // sqrt(100) = 10
    })

    it('非完全平方数向下取整', () => {
      expect(system.calculateHitScore(2)).toBe(1) // sqrt(2) = 1.41 -> 1
      expect(system.calculateHitScore(3)).toBe(1) // sqrt(3) = 1.73 -> 1
      expect(system.calculateHitScore(5)).toBe(2) // sqrt(5) = 2.24 -> 2
      expect(system.calculateHitScore(10)).toBe(3) // sqrt(10) = 3.16 -> 3
      expect(system.calculateHitScore(15)).toBe(3) // sqrt(15) = 3.87 -> 3
    })

    it('高伤害得分更高', () => {
      // HMG 单次 30 伤害
      expect(system.calculateHitScore(30)).toBe(5)
      // LMG 单次 5 伤害
      expect(system.calculateHitScore(5)).toBe(2)
    })

    it('伤害为 0 时得分为 0', () => {
      expect(system.calculateHitScore(0)).toBe(0)
    })
  })

  // ============================================================================
  // calculateTotalHitScore - 批量计算命中得分
  // ============================================================================

  describe('calculateTotalHitScore', () => {
    it('计算多次攻击的总得分', () => {
      // 三次攻击：伤害 10, 20, 30
      // 得分：3 + 4 + 5 = 12
      const damages = [10, 20, 30]
      expect(system.calculateTotalHitScore(damages)).toBe(12)
    })

    it('空数组返回 0', () => {
      expect(system.calculateTotalHitScore([])).toBe(0)
    })

    it('单次攻击', () => {
      expect(system.calculateTotalHitScore([25])).toBe(5)
    })
  })

  // ============================================================================
  // calculateWaveBonus - 波次奖励计算
  // ============================================================================

  describe('calculateWaveBonus', () => {
    it('波次奖励 = 完成波次 x 10', () => {
      expect(system.calculateWaveBonus(1)).toBe(10)
      expect(system.calculateWaveBonus(5)).toBe(50)
      expect(system.calculateWaveBonus(10)).toBe(100)
      expect(system.calculateWaveBonus(42)).toBe(420)
    })

    it('0 波次返回 0', () => {
      expect(system.calculateWaveBonus(0)).toBe(0)
    })
  })

  // ============================================================================
  // calculateLifeBonus - 剩余生命奖励计算
  // ============================================================================

  describe('calculateLifeBonus', () => {
    it('生命奖励 = 剩余生命 x 5', () => {
      expect(system.calculateLifeBonus(100)).toBe(500)
      expect(system.calculateLifeBonus(50)).toBe(250)
      expect(system.calculateLifeBonus(1)).toBe(5)
    })

    it('0 生命返回 0', () => {
      expect(system.calculateLifeBonus(0)).toBe(0)
    })
  })

  // ============================================================================
  // calculateMoneyBonus - 剩余金币奖励计算
  // ============================================================================

  describe('calculateMoneyBonus', () => {
    it('金币奖励 = floor(剩余金币 x 0.1)', () => {
      expect(system.calculateMoneyBonus(100)).toBe(10)
      expect(system.calculateMoneyBonus(500)).toBe(50)
      expect(system.calculateMoneyBonus(1000)).toBe(100)
    })

    it('金币奖励向下取整', () => {
      // 55 x 0.1 = 5.5 -> 5
      expect(system.calculateMoneyBonus(55)).toBe(5)
      // 99 x 0.1 = 9.9 -> 9
      expect(system.calculateMoneyBonus(99)).toBe(9)
      // 123 x 0.1 = 12.3 -> 12
      expect(system.calculateMoneyBonus(123)).toBe(12)
    })

    it('0 金币返回 0', () => {
      expect(system.calculateMoneyBonus(0)).toBe(0)
    })
  })

  // ============================================================================
  // calculateFinalScore - 最终得分计算
  // ============================================================================

  describe('calculateFinalScore', () => {
    it('最终得分 = 累计命中得分 + 波次奖励 + 生命奖励 + 金币奖励', () => {
      // 累计 1000 分 + 10 波 x 10 + 50 生命 x 5 + 200 金币 x 0.1
      // = 1000 + 100 + 250 + 20 = 1370
      const result = system.calculateFinalScore({
        accumulatedScore: 1000,
        wavesCompleted: 10,
        remainingLife: 50,
        remainingMoney: 200,
      })
      expect(result).toBe(1370)
    })

    it('全部为 0 时返回 0', () => {
      const result = system.calculateFinalScore({
        accumulatedScore: 0,
        wavesCompleted: 0,
        remainingLife: 0,
        remainingMoney: 0,
      })
      expect(result).toBe(0)
    })

    it('只有累计得分时', () => {
      const result = system.calculateFinalScore({
        accumulatedScore: 500,
        wavesCompleted: 0,
        remainingLife: 0,
        remainingMoney: 0,
      })
      expect(result).toBe(500)
    })

    it('金币奖励向下取整后累加', () => {
      // 累计 100 分 + 5 波 x 10 + 100 生命 x 5 + 55 金币 x 0.1
      // = 100 + 50 + 500 + 5 = 655
      const result = system.calculateFinalScore({
        accumulatedScore: 100,
        wavesCompleted: 5,
        remainingLife: 100,
        remainingMoney: 55,
      })
      expect(result).toBe(655)
    })
  })

  // ============================================================================
  // getFinalScoreBreakdown - 获取最终得分明细
  // ============================================================================

  describe('getFinalScoreBreakdown', () => {
    it('返回各项得分明细', () => {
      const breakdown = system.getFinalScoreBreakdown({
        accumulatedScore: 1000,
        wavesCompleted: 10,
        remainingLife: 50,
        remainingMoney: 200,
      })

      expect(breakdown.hitScore).toBe(1000)
      expect(breakdown.waveBonus).toBe(100)
      expect(breakdown.lifeBonus).toBe(250)
      expect(breakdown.moneyBonus).toBe(20)
      expect(breakdown.total).toBe(1370)
    })

    it('明细各项加和等于 total', () => {
      const breakdown = system.getFinalScoreBreakdown({
        accumulatedScore: 500,
        wavesCompleted: 15,
        remainingLife: 80,
        remainingMoney: 333,
      })

      const sum = breakdown.hitScore + breakdown.waveBonus + breakdown.lifeBonus + breakdown.moneyBonus
      expect(sum).toBe(breakdown.total)
    })
  })

  // ============================================================================
  // 集成场景测试
  // ============================================================================

  describe('Integration scenarios', () => {
    it('典型游戏结束场景', () => {
      // 模拟一局游戏结束：打了 20 波，剩余 30 生命，800 金币
      // 累计命中得分约 2000（假设）
      const breakdown = system.getFinalScoreBreakdown({
        accumulatedScore: 2000,
        wavesCompleted: 20,
        remainingLife: 30,
        remainingMoney: 800,
      })

      // 2000 + 200 + 150 + 80 = 2430
      expect(breakdown.hitScore).toBe(2000)
      expect(breakdown.waveBonus).toBe(200)
      expect(breakdown.lifeBonus).toBe(150)
      expect(breakdown.moneyBonus).toBe(80)
      expect(breakdown.total).toBe(2430)
    })

    it('高分游戏场景（长时间存活）', () => {
      // 打了 50 波，剩余 100 生命，5000 金币
      // 累计命中得分 10000
      const breakdown = system.getFinalScoreBreakdown({
        accumulatedScore: 10000,
        wavesCompleted: 50,
        remainingLife: 100,
        remainingMoney: 5000,
      })

      // 10000 + 500 + 500 + 500 = 11500
      expect(breakdown.total).toBe(11500)
    })

    it('游戏刚开始就结束（低分场景）', () => {
      // 第 1 波就失败，0 生命，剩余 300 金币
      // 累计命中得分 50
      const breakdown = system.getFinalScoreBreakdown({
        accumulatedScore: 50,
        wavesCompleted: 0,
        remainingLife: 0,
        remainingMoney: 300,
      })

      // 50 + 0 + 0 + 30 = 80
      expect(breakdown.total).toBe(80)
    })
  })
})
