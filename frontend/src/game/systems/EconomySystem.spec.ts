/**
 * EconomySystem 测试用例
 * 测试游戏过程中的波次生命恢复奖励计算
 *
 * 注意：这里测试的是游戏过程中的资源恢复（每 5/10 波恢复生命值），
 * 与 ScoreSystem 中的 calculateLifeBonus()（游戏结束时的得分计算）不同。
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { BuildingConfig, BuildingType, GameConfig } from '@/types'
import { createEconomySystem, type EconomySystem } from './EconomySystem'

// Mock 游戏配置
const mockBuildingConfigs: Record<BuildingType, BuildingConfig> = {
  wall: {
    name: '路障',
    cost: 5,
    damage: 0,
    range: 0,
    max_range: 0,
    speed: 0,
    bullet_speed: 0,
    life: 100,
    shield: 500,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
  cannon: {
    name: '炮台',
    cost: 300,
    damage: 12,
    range: 4,
    max_range: 8,
    speed: 2,
    bullet_speed: 6,
    life: 100,
    shield: 100,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
  LMG: {
    name: '轻机枪',
    cost: 100,
    damage: 5,
    range: 5,
    max_range: 10,
    speed: 3,
    bullet_speed: 6,
    life: 100,
    shield: 50,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
  HMG: {
    name: '重机枪',
    cost: 800,
    damage: 30,
    range: 3,
    max_range: 5,
    speed: 3,
    bullet_speed: 5,
    life: 100,
    shield: 200,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
  laser_gun: {
    name: '激光枪',
    cost: 2000,
    damage: 25,
    range: 6,
    max_range: 10,
    speed: 20,
    bullet_speed: 0,
    life: 100,
    shield: 100,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
}

const mockGameConfig: GameConfig = {
  buildings: mockBuildingConfigs,
  monsters: {} as GameConfig['monsters'],
  map: {
    width: 16,
    height: 16,
    entrance: [0, 0],
    exit: [15, 15],
    obstacles: [],
  },
  initial: {
    money: 500,
    life: 100,
    difficulty: 1.0,
  },
}

describe('EconomySystem', () => {
  let system: EconomySystem

  beforeEach(() => {
    system = createEconomySystem(mockGameConfig)
  })

  // ============================================================================
  // getLifeReward - 波次生命恢复奖励计算（游戏过程中的资源恢复，非得分）
  // ============================================================================

  describe('getLifeReward', () => {
    it('普通波次（非 5 的倍数）没有奖励', () => {
      expect(system.getLifeReward(1)).toBe(0)
      expect(system.getLifeReward(2)).toBe(0)
      expect(system.getLifeReward(3)).toBe(0)
      expect(system.getLifeReward(4)).toBe(0)
      expect(system.getLifeReward(6)).toBe(0)
      expect(system.getLifeReward(7)).toBe(0)
      expect(system.getLifeReward(8)).toBe(0)
      expect(system.getLifeReward(9)).toBe(0)
    })

    it('每 5 波（非 10 的倍数）奖励 5 点生命', () => {
      expect(system.getLifeReward(5)).toBe(5)
      expect(system.getLifeReward(15)).toBe(5)
      expect(system.getLifeReward(25)).toBe(5)
      expect(system.getLifeReward(35)).toBe(5)
    })

    it('每 10 波奖励 10 点生命', () => {
      expect(system.getLifeReward(10)).toBe(10)
      expect(system.getLifeReward(20)).toBe(10)
      expect(system.getLifeReward(30)).toBe(10)
      expect(system.getLifeReward(100)).toBe(10)
    })

    it('10 的倍数优先于 5 的倍数规则', () => {
      // 10 同时是 5 的倍数和 10 的倍数，应该返回 10 而不是 5
      expect(system.getLifeReward(10)).toBe(10)
      expect(system.getLifeReward(20)).toBe(10)
      expect(system.getLifeReward(50)).toBe(10)
    })

    it('高波次依然遵循相同规则', () => {
      expect(system.getLifeReward(99)).toBe(0)
      expect(system.getLifeReward(100)).toBe(10)
      expect(system.getLifeReward(105)).toBe(5)
      expect(system.getLifeReward(110)).toBe(10)
    })
  })

  // ============================================================================
  // applyLifeReward - 应用生命奖励（考虑上限）
  // ============================================================================

  describe('applyLifeReward', () => {
    it('生命值未满时正常增加', () => {
      expect(system.applyLifeReward(90, 10)).toBe(100)
      expect(system.applyLifeReward(95, 5)).toBe(100)
      expect(system.applyLifeReward(50, 10)).toBe(60)
    })

    it('生命值增加不超过 100 上限', () => {
      expect(system.applyLifeReward(95, 10)).toBe(100)
      expect(system.applyLifeReward(98, 5)).toBe(100)
      expect(system.applyLifeReward(100, 10)).toBe(100)
    })

    it('生命值已满时奖励不生效', () => {
      expect(system.applyLifeReward(100, 5)).toBe(100)
      expect(system.applyLifeReward(100, 10)).toBe(100)
    })

    it('奖励为 0 时生命值不变', () => {
      expect(system.applyLifeReward(50, 0)).toBe(50)
      expect(system.applyLifeReward(100, 0)).toBe(100)
    })
  })

})
