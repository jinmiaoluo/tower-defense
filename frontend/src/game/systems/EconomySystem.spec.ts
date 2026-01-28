/**
 * EconomySystem test cases
 * Tests wave life recovery reward calculation during gameplay
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { BuildingConfig, BuildingType, GameConfig } from '@/types'
import { createEconomySystem, type EconomySystem } from './EconomySystem'

// Mock game config
const mockBuildingConfigs: Record<BuildingType, BuildingConfig> = {
  wall: {
    name: 'Wall',
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
    name: 'Cannon',
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
    name: 'LMG',
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
    name: 'HMG',
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
    name: 'Laser Gun',
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
  // getLifeReward - Wave life recovery reward calculation (resource recovery during gameplay, not scoring)
  // ============================================================================

  describe('getLifeReward', () => {
    it('normal waves (not multiples of 5) have no reward', () => {
      expect(system.getLifeReward(1)).toBe(0)
      expect(system.getLifeReward(2)).toBe(0)
      expect(system.getLifeReward(3)).toBe(0)
      expect(system.getLifeReward(4)).toBe(0)
      expect(system.getLifeReward(6)).toBe(0)
      expect(system.getLifeReward(7)).toBe(0)
      expect(system.getLifeReward(8)).toBe(0)
      expect(system.getLifeReward(9)).toBe(0)
    })

    it('every 5th wave (not multiples of 10) rewards 5 life', () => {
      expect(system.getLifeReward(5)).toBe(5)
      expect(system.getLifeReward(15)).toBe(5)
      expect(system.getLifeReward(25)).toBe(5)
      expect(system.getLifeReward(35)).toBe(5)
    })

    it('every 10th wave rewards 10 life', () => {
      expect(system.getLifeReward(10)).toBe(10)
      expect(system.getLifeReward(20)).toBe(10)
      expect(system.getLifeReward(30)).toBe(10)
      expect(system.getLifeReward(100)).toBe(10)
    })

    it('multiples of 10 take priority over multiples of 5', () => {
      // 10 is both a multiple of 5 and 10, should return 10 not 5
      expect(system.getLifeReward(10)).toBe(10)
      expect(system.getLifeReward(20)).toBe(10)
      expect(system.getLifeReward(50)).toBe(10)
    })

    it('high waves follow the same rules', () => {
      expect(system.getLifeReward(99)).toBe(0)
      expect(system.getLifeReward(100)).toBe(10)
      expect(system.getLifeReward(105)).toBe(5)
      expect(system.getLifeReward(110)).toBe(10)
    })
  })

  // ============================================================================
  // applyLifeReward - Apply life reward (considering cap)
  // ============================================================================

  describe('applyLifeReward', () => {
    it('life increases normally when not full', () => {
      expect(system.applyLifeReward(90, 10)).toBe(100)
      expect(system.applyLifeReward(95, 5)).toBe(100)
      expect(system.applyLifeReward(50, 10)).toBe(60)
    })

    it('life increase does not exceed 100 cap', () => {
      expect(system.applyLifeReward(95, 10)).toBe(100)
      expect(system.applyLifeReward(98, 5)).toBe(100)
      expect(system.applyLifeReward(100, 10)).toBe(100)
    })

    it('reward has no effect when life is already full', () => {
      expect(system.applyLifeReward(100, 5)).toBe(100)
      expect(system.applyLifeReward(100, 10)).toBe(100)
    })

    it('life unchanged when reward is 0', () => {
      expect(system.applyLifeReward(50, 0)).toBe(50)
      expect(system.applyLifeReward(100, 0)).toBe(100)
    })
  })

})
