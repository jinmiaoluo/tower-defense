/**
 * ScoreSystem 测试用例
 * 测试命中得分计算逻辑
 *
 * 得分规则（参考 SPEC.md）：
 * - 命中得分 = floor(sqrt(实际伤害))
 * - 最终得分 = 累计命中得分（无额外奖励，直接使用 state.score）
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
})
