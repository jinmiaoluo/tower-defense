/**
 * DamageSystem 测试用例
 * 测试伤害计算、得分计算等核心逻辑
 * 参考旧实现：html5-tower-defense/src/js/td-obj-monster.js:beHit
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createDamageSystem, type DamageSystem } from './DamageSystem'
import type { IMonster } from '@/types/entities'

/** 创建 Mock Monster */
function createMockMonster(overrides: Partial<IMonster> = {}): IMonster {
  const damage = overrides.damage ?? 1
  const radius = Math.max(4, Math.min(12, Math.floor(damage * 1.2)))
  return {
    id: 'test-monster-1',
    type: 0,
    maxLife: 100,
    currentLife: 100,
    speed: 3,
    shield: 0,
    money: 10,
    damage,
    radius,
    color: '#00ff00',
    progress: 0,
    isValid: true,
    takeDamage: () => 0,
    isDead: () => false,
    reachedExit: () => false,
    getGridPosition: () => [0, 0],
    ...overrides,
  }
}

describe('DamageSystem', () => {
  let system: DamageSystem

  beforeEach(() => {
    system = createDamageSystem()
  })

  // ============================================================================
  // calculate - 实际伤害计算
  // ============================================================================

  describe('calculate', () => {
    it('无护盾时伤害等于原始伤害', () => {
      expect(system.calculate(12, 0)).toBe(12)
      expect(system.calculate(30, 0)).toBe(30)
      expect(system.calculate(1, 0)).toBe(1)
    })

    it('护盾减免伤害', () => {
      // 原始伤害 12，护盾 5，实际伤害 = 12 - 5 = 7
      expect(system.calculate(12, 5)).toBe(7)
      // 原始伤害 30，护盾 10，实际伤害 = 30 - 10 = 20
      expect(system.calculate(30, 10)).toBe(20)
    })

    it('护盾高于伤害时使用最低伤害（10%）', () => {
      // 原始伤害 12，护盾 20
      // 减免后 = 12 - 20 = -8，最低伤害 = ceil(12 * 0.1) = 2
      expect(system.calculate(12, 20)).toBe(2)
    })

    it('护盾刚好等于伤害时使用最低伤害', () => {
      // 原始伤害 10，护盾 10
      // 减免后 = 0，最低伤害 = ceil(10 * 0.1) = 1
      expect(system.calculate(10, 10)).toBe(1)
    })

    it('高伤害武器对高护盾怪的优势', () => {
      // HMG 伤害 30，护盾 100
      // 减免后 = 30 - 100 = -70，最低伤害 = ceil(30 * 0.1) = 3
      expect(system.calculate(30, 100)).toBe(3)
      // LMG 伤害 5，护盾 100
      // 减免后 = 5 - 100 = -95，最低伤害 = ceil(5 * 0.1) = 1
      expect(system.calculate(5, 100)).toBe(1)
      // HMG 的最低伤害是 LMG 的 3 倍
    })

    it('最低伤害向上取整', () => {
      // 原始伤害 15，护盾 20
      // 最低伤害 = ceil(15 * 0.1) = ceil(1.5) = 2
      expect(system.calculate(15, 20)).toBe(2)
      // 原始伤害 11，护盾 20
      // 最低伤害 = ceil(11 * 0.1) = ceil(1.1) = 2
      expect(system.calculate(11, 20)).toBe(2)
    })

    it('伤害为 1 时最低伤害也为 1', () => {
      // 原始伤害 1，护盾 10
      // 减免后 = 1 - 10 = -9，最低伤害 = ceil(1 * 0.1) = ceil(0.1) = 1
      expect(system.calculate(1, 10)).toBe(1)
    })

    it('边界情况：减免后刚好等于最低伤害', () => {
      // 原始伤害 10，护盾 9
      // 减免后 = 10 - 9 = 1，最低伤害 = ceil(10 * 0.1) = 1
      // 应该取较大值 = 1
      expect(system.calculate(10, 9)).toBe(1)
    })

    it('护盾减免后大于最低伤害时使用减免值', () => {
      // 原始伤害 100，护盾 50
      // 减免后 = 50，最低伤害 = ceil(100 * 0.1) = 10
      // 应该取较大值 = 50
      expect(system.calculate(100, 50)).toBe(50)
    })
  })

  // ============================================================================
  // calculateScore - 命中得分计算
  // ============================================================================

  describe('calculateScore', () => {
    it('得分 = floor(sqrt(actualDamage))', () => {
      expect(system.calculateScore(1)).toBe(1) // sqrt(1) = 1
      expect(system.calculateScore(4)).toBe(2) // sqrt(4) = 2
      expect(system.calculateScore(9)).toBe(3) // sqrt(9) = 3
      expect(system.calculateScore(16)).toBe(4) // sqrt(16) = 4
      expect(system.calculateScore(100)).toBe(10) // sqrt(100) = 10
    })

    it('非完全平方数向下取整', () => {
      expect(system.calculateScore(2)).toBe(1) // sqrt(2) ≈ 1.41 -> 1
      expect(system.calculateScore(3)).toBe(1) // sqrt(3) ≈ 1.73 -> 1
      expect(system.calculateScore(5)).toBe(2) // sqrt(5) ≈ 2.24 -> 2
      expect(system.calculateScore(10)).toBe(3) // sqrt(10) ≈ 3.16 -> 3
      expect(system.calculateScore(15)).toBe(3) // sqrt(15) ≈ 3.87 -> 3
    })

    it('高伤害得分更高', () => {
      // 单次高伤害 vs 多次低伤害的得分比较
      // HMG 单次 30 伤害：floor(sqrt(30)) = 5
      expect(system.calculateScore(30)).toBe(5)
      // LMG 单次 5 伤害：floor(sqrt(5)) = 2
      // 需要打 3 次才能达到同等得分
      expect(system.calculateScore(5)).toBe(2)
    })

    it('伤害为 0 时得分为 0', () => {
      expect(system.calculateScore(0)).toBe(0)
    })
  })

  // ============================================================================
  // calculateTotalScore - 批量计算攻击得分
  // ============================================================================

  describe('calculateTotalScore', () => {
    it('计算多次攻击的总得分', () => {
      // 三次攻击：伤害 10, 20, 30
      // 得分：3 + 4 + 5 = 12
      const damages = [10, 20, 30]
      expect(system.calculateTotalScore(damages)).toBe(12)
    })

    it('空数组返回 0', () => {
      expect(system.calculateTotalScore([])).toBe(0)
    })

    it('单次攻击', () => {
      expect(system.calculateTotalScore([25])).toBe(5)
    })
  })

  // ============================================================================
  // isKilled - 击杀判定
  // ============================================================================

  describe('isKilled', () => {
    it('伤害足以击杀时返回 true', () => {
      const monster = createMockMonster({ currentLife: 10 })
      expect(system.isKilled(monster, 10)).toBe(true)
      expect(system.isKilled(monster, 15)).toBe(true)
    })

    it('伤害不足以击杀时返回 false', () => {
      const monster = createMockMonster({ currentLife: 10 })
      expect(system.isKilled(monster, 5)).toBe(false)
      expect(system.isKilled(monster, 9)).toBe(false)
    })

    it('怪物已死亡时返回 true', () => {
      const monster = createMockMonster({ currentLife: 0 })
      expect(system.isKilled(monster, 0)).toBe(true)
    })

    it('边界情况：伤害刚好等于剩余生命', () => {
      const monster = createMockMonster({ currentLife: 25 })
      expect(system.isKilled(monster, 25)).toBe(true)
    })
  })

  // ============================================================================
  // wouldKill - 预判击杀（不实际造成伤害）
  // ============================================================================

  describe('wouldKill', () => {
    it('考虑护盾的击杀预判', () => {
      const monster = createMockMonster({ currentLife: 10, shield: 5 })
      // 原始伤害 20，护盾 5，实际伤害 15 > 生命 10
      expect(system.wouldKill(monster, 20)).toBe(true)
    })

    it('护盾导致无法击杀', () => {
      const monster = createMockMonster({ currentLife: 10, shield: 15 })
      // 原始伤害 12，护盾 15，实际伤害 = ceil(12*0.1) = 2 < 生命 10
      expect(system.wouldKill(monster, 12)).toBe(false)
    })
  })

  // ============================================================================
  // getEffectiveDamage - 获取对特定怪物的有效伤害
  // ============================================================================

  describe('getEffectiveDamage', () => {
    it('根据怪物当前护盾计算有效伤害', () => {
      const monster = createMockMonster({ shield: 5 })
      // 原始伤害 12，护盾 5，有效伤害 7
      expect(system.getEffectiveDamage(monster, 12)).toBe(7)
    })

    it('护盾耗尽后有效伤害等于原始伤害', () => {
      const monster = createMockMonster({ shield: 0 })
      expect(system.getEffectiveDamage(monster, 12)).toBe(12)
    })
  })

  // ============================================================================
  // getDamageToKill - 计算击杀所需总伤害
  // ============================================================================

  describe('getDamageToKill', () => {
    it('无护盾时等于剩余生命', () => {
      const monster = createMockMonster({ currentLife: 50, shield: 0 })
      expect(system.getDamageToKill(monster)).toBe(50)
    })

    it('有护盾时考虑护盾吸收', () => {
      const monster = createMockMonster({ currentLife: 50, shield: 10 })
      // 需要的总伤害 = 生命 + 护盾 = 60（简化计算）
      expect(system.getDamageToKill(monster)).toBe(60)
    })
  })

  // ============================================================================
  // 集成场景测试
  // ============================================================================

  describe('Integration scenarios', () => {
    it('激光枪高频攻击得分优势', () => {
      // 激光枪：伤害 25，速度 20（每秒 20 次）
      // 1 秒内攻击 20 次，每次得分 5，总得分 100
      const laserDamages = Array(20).fill(25)
      const laserScore = system.calculateTotalScore(laserDamages)

      // HMG：伤害 30，速度 3（每秒 3 次）
      // 1 秒内攻击 3 次，每次得分 5，总得分 15
      const hmgDamages = Array(3).fill(30)
      const hmgScore = system.calculateTotalScore(hmgDamages)

      expect(laserScore).toBeGreaterThan(hmgScore)
      expect(laserScore).toBe(100)
      expect(hmgScore).toBe(15)
    })

    it('护盾怪战斗场景', () => {
      // 护盾怪：生命 50，护盾 20
      const shieldMonster = createMockMonster({
        currentLife: 50,
        shield: 20,
      })

      // LMG 攻击（伤害 5）
      const lmgEffective = system.getEffectiveDamage(shieldMonster, 5)
      // 5 - 20 = -15，最低伤害 = ceil(5*0.1) = 1
      expect(lmgEffective).toBe(1)

      // HMG 攻击（伤害 30）
      const hmgEffective = system.getEffectiveDamage(shieldMonster, 30)
      // 30 - 20 = 10 > ceil(30*0.1) = 3
      expect(hmgEffective).toBe(10)

      // HMG 对护盾怪的效率是 LMG 的 10 倍
      expect(hmgEffective / lmgEffective).toBe(10)
    })
  })
})
