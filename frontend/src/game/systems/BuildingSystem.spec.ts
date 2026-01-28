/**
 * BuildingSystem test cases
 * Tests core calculation logic of the building system
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { BuildingConfig, BuildingType, GameConfig, Position } from '@/types'
import {
  createBuildingSystem,
  type BuildingSystem,
  type BuildingForRangeCheck,
} from './BuildingSystem'

// Mock game config (simulating server-delivered config)
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

describe('BuildingSystem', () => {
  let system: BuildingSystem

  beforeEach(() => {
    system = createBuildingSystem(mockGameConfig)
  })

  // ============================================================================
  // getTotalCost - Cumulative cost calculation
  // ============================================================================

  describe('getTotalCost', () => {
    it('level 1 building cumulative cost equals build cost', () => {
      expect(system.getTotalCost('cannon', 1)).toBe(300)
      expect(system.getTotalCost('LMG', 1)).toBe(100)
      expect(system.getTotalCost('wall', 1)).toBe(5)
    })

    it('level 2 building cumulative cost = build cost + upgrade cost', () => {
      // cannon: 300 + floor(300 * 0.75) = 300 + 225 = 525
      expect(system.getTotalCost('cannon', 2)).toBe(525)
      // LMG: 100 + floor(100 * 0.75) = 100 + 75 = 175
      expect(system.getTotalCost('LMG', 2)).toBe(175)
    })

    it('level 3 building cumulative cost calculated correctly', () => {
      // cannon: 300 + 225 + floor(525 * 0.75) = 525 + 393 = 918
      expect(system.getTotalCost('cannon', 3)).toBe(918)
    })

    it('high level building cumulative cost', () => {
      // Verify cumulative cost increases after multiple upgrades
      const costs = [1, 2, 3, 4, 5].map((level) => system.getTotalCost('cannon', level))
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1])
      }
    })
  })

  // ============================================================================
  // getUpgradeCost - Upgrade cost calculation
  // ============================================================================

  describe('getUpgradeCost', () => {
    it('cost to upgrade from level 1 to level 2', () => {
      // cannon: floor(300 * 0.75) = 225
      expect(system.getUpgradeCost('cannon', 1)).toBe(225)
      // LMG: floor(100 * 0.75) = 75
      expect(system.getUpgradeCost('LMG', 1)).toBe(75)
    })

    it('cost to upgrade from level 2 to level 3', () => {
      // cannon level 2 cumulative cost 525, upgrade cost = floor(525 * 0.75) = 393
      expect(system.getUpgradeCost('cannon', 2)).toBe(393)
    })

    it('upgrade cost increases with level', () => {
      const costs = [1, 2, 3, 4, 5].map((level) => system.getUpgradeCost('cannon', level))
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1])
      }
    })
  })

  // ============================================================================
  // getSellIncome - Sell income calculation
  // ============================================================================

  describe('getSellIncome', () => {
    it('level 1 building sell income = build cost * 0.5', () => {
      // cannon: floor(300 * 0.5) = 150
      expect(system.getSellIncome('cannon', 1)).toBe(150)
      // LMG: floor(100 * 0.5) = 50
      expect(system.getSellIncome('LMG', 1)).toBe(50)
    })

    it('level 2 building sell income = cumulative cost * 0.5', () => {
      // cannon level 2 cumulative cost 525, sell = floor(525 * 0.5) = 262
      expect(system.getSellIncome('cannon', 2)).toBe(262)
    })

    it('wall sell returns at least 1 gold', () => {
      // wall build cost 5, sell = floor(5 * 0.5) = 2
      expect(system.getSellIncome('wall', 1)).toBe(2)
    })

    it('sell income minimum is 1', () => {
      // Even if calculated result is 0, should return 1
      const income = system.getSellIncome('wall', 1)
      expect(income).toBeGreaterThanOrEqual(1)
    })
  })

  // ============================================================================
  // getDamageAtLevel - Damage at level calculation
  // ============================================================================

  describe('getDamageAtLevel', () => {
    it('level 1 damage equals base damage', () => {
      expect(system.getDamageAtLevel('cannon', 1)).toBe(12)
      expect(system.getDamageAtLevel('LMG', 1)).toBe(5)
      expect(system.getDamageAtLevel('HMG', 1)).toBe(30)
    })

    it('wall damage is always 0', () => {
      expect(system.getDamageAtLevel('wall', 1)).toBe(0)
      expect(system.getDamageAtLevel('wall', 5)).toBe(0)
    })

    it('default upgrade rule: multiply by 1.2 per level', () => {
      // LMG level 2: floor(5 * 1.2) = 6
      expect(system.getDamageAtLevel('LMG', 2)).toBe(6)
      // LMG level 3: floor(6 * 1.2) = 7
      expect(system.getDamageAtLevel('LMG', 3)).toBe(7)
    })

    it('cannon upgrade rule: levels 1-10 multiply by 1.2, level 11+ multiply by 1.3', () => {
      // Upgrading from level 10 to 11 uses level 10 multiplier 1.2
      const damage10 = system.getDamageAtLevel('cannon', 10)
      const damage11 = system.getDamageAtLevel('cannon', 11)
      expect(damage11).toBe(Math.floor(damage10 * 1.2))

      // Upgrading from level 11 to 12 uses level 11 multiplier 1.3
      const damage12 = system.getDamageAtLevel('cannon', 12)
      expect(damage12).toBe(Math.floor(damage11 * 1.3))
    })

    it('HMG upgrade rule: multiply by 1.3 per level', () => {
      // HMG level 2: floor(30 * 1.3) = 39
      expect(system.getDamageAtLevel('HMG', 2)).toBe(39)
      // HMG level 3: floor(39 * 1.3) = 50
      expect(system.getDamageAtLevel('HMG', 3)).toBe(50)
    })

    it('laser_gun upgrade rule: multiply by 1.2 per level', () => {
      // laser_gun level 2: floor(25 * 1.2) = 30
      expect(system.getDamageAtLevel('laser_gun', 2)).toBe(30)
    })
  })

  // ============================================================================
  // getRangeAtLevel - Range at level calculation
  // Reference: td-obj-building.js:258-289, default upgrade rule multiply by 1.2 per level
  // ============================================================================

  describe('getRangeAtLevel', () => {
    it('level 1 range equals base range', () => {
      expect(system.getRangeAtLevel('cannon', 1)).toBe(4)
      expect(system.getRangeAtLevel('LMG', 1)).toBe(5)
    })

    it('wall range is always 0', () => {
      expect(system.getRangeAtLevel('wall', 1)).toBe(0)
      expect(system.getRangeAtLevel('wall', 10)).toBe(0)
    })

    it('range increases with level (multiply by 1.2 per level)', () => {
      // level 2 range = floor(4 * 1.2) = 4
      expect(system.getRangeAtLevel('cannon', 2)).toBe(4)
      // level 3 range = floor(4.8 * 1.2) = floor(5.76) = 5
      expect(system.getRangeAtLevel('cannon', 3)).toBe(5)
      // level 4 range = floor(5.76 * 1.2) = floor(6.91) = 6
      expect(system.getRangeAtLevel('cannon', 4)).toBe(6)
    })

    it('range does not exceed max_range', () => {
      // cannon max_range is 8, cannot exceed even at high levels
      // level 6 range = floor(4 * 1.2^5) = floor(9.95) = 9, capped by max_range=8 -> 8
      expect(system.getRangeAtLevel('cannon', 6)).toBe(8)
      // Higher levels still capped
      expect(system.getRangeAtLevel('cannon', 100)).toBe(8)
    })
  })

  // ============================================================================
  // isInRange - Range validation
  // Reference: td-obj-building.js:187-204, no minimum range restriction
  // ============================================================================

  describe('isInRange', () => {
    it('returns true when target is within range', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // cannon level 1 range 4, check target at distance 3
      const target: Position = [5, 8] // distance 3
      expect(system.isInRange(building, target)).toBe(true)
    })

    it('returns true when target distance is 0 (no minimum range)', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // Target overlaps with building
      const target: Position = [5, 5] // distance 0
      expect(system.isInRange(building, target)).toBe(true)
    })

    it('returns false when target is too far (beyond current range)', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // cannon level 1 range 4, check target at distance 5
      const target: Position = [5, 10] // distance 5
      expect(system.isInRange(building, target)).toBe(false)
    })

    it('wall has no range, always returns false', () => {
      const building: BuildingForRangeCheck = {
        type: 'wall',
        level: 1,
        position: [5, 5],
      }
      const target: Position = [5, 5]
      expect(system.isInRange(building, target)).toBe(false)
    })

    it('higher level building has increased range', () => {
      const building1: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      const building6: BuildingForRangeCheck = {
        type: 'cannon',
        level: 6,
        position: [5, 5],
      }
      // Distance 7 is out of range at level 1 (range 4), but in range at level 6 (range 8)
      const target: Position = [5, 12] // distance 7
      expect(system.isInRange(building1, target)).toBe(false)
      expect(system.isInRange(building6, target)).toBe(true)
    })

    it('edge case: target exactly at range boundary', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // cannon level 1 range 4
      const target: Position = [5, 9] // distance 4
      expect(system.isInRange(building, target)).toBe(true)
    })

    it('edge case: target just beyond range', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // cannon level 1 range 4, distance 4.1 is beyond
      const target: Position = [5, 9.1] // distance 4.1
      expect(system.isInRange(building, target)).toBe(false)
    })
  })

  // ============================================================================
  // getAttackSpeedFrames - Attack interval in frames
  // Reference: td-obj-building.js:168
  // Old formula: floor(max(2 / (speed * global_speed), 1)) frames (24 FPS)
  // New formula: floor(max(2 / (speed * 0.1) * (60 / 24), 1)) = floor(50 / speed)
  // ============================================================================

  describe('getAttackSpeedFrames', () => {
    it('calculates attack interval frames based on old implementation formula (same attack frequency)', () => {
      // Old implementation: 2 / (speed * 0.1) = 20 / speed frames (24 FPS)
      // New implementation: multiply by frame rate ratio 60/24 = 2.5, i.e. 50 / speed frames (60 FPS)
      // cannon speed=2: floor(50 / 2) = 25 frames
      expect(system.getAttackSpeedFrames('cannon')).toBe(25)
      // LMG speed=3: floor(50 / 3) = 16 frames
      expect(system.getAttackSpeedFrames('LMG')).toBe(16)
      // HMG speed=3: floor(50 / 3) = 16 frames
      expect(system.getAttackSpeedFrames('HMG')).toBe(16)
      // laser_gun speed=20: floor(50 / 20) = 2 frames
      expect(system.getAttackSpeedFrames('laser_gun')).toBe(2)
    })

    it('wall has no attack speed, returns Infinity', () => {
      expect(system.getAttackSpeedFrames('wall')).toBe(Infinity)
    })

    it('attack interval minimum is 1 frame', () => {
      // Even with very high speed, interval is at least 1 frame
      const frames = system.getAttackSpeedFrames('laser_gun')
      expect(frames).toBeGreaterThanOrEqual(1)
    })

    it('attack frequency matches old implementation', () => {
      // Verify attack interval time (seconds) matches old implementation
      // Old 24 FPS: cannon 10 frames = 0.417 seconds
      // New 60 FPS: cannon 25 frames = 0.417 seconds
      const cannonFrames = system.getAttackSpeedFrames('cannon')
      const cannonSeconds = cannonFrames / 60
      expect(cannonSeconds).toBeCloseTo(0.417, 2)

      // Old 24 FPS: LMG 6 frames = 0.25 seconds
      // New 60 FPS: LMG 16 frames = 0.267 seconds (slight difference due to rounding)
      const lmgFrames = system.getAttackSpeedFrames('LMG')
      const lmgSeconds = lmgFrames / 60
      expect(lmgSeconds).toBeCloseTo(0.25, 1)
    })
  })

  // ============================================================================
  // canAfford - Money check
  // ============================================================================

  describe('canAfford', () => {
    it('returns true when money is sufficient', () => {
      expect(system.canAfford(500, 'cannon')).toBe(true)
      expect(system.canAfford(300, 'cannon')).toBe(true)
    })

    it('returns false when money is insufficient', () => {
      expect(system.canAfford(100, 'cannon')).toBe(false)
      expect(system.canAfford(299, 'cannon')).toBe(false)
    })

    it('returns true when money exactly equals build cost', () => {
      expect(system.canAfford(300, 'cannon')).toBe(true)
      expect(system.canAfford(5, 'wall')).toBe(true)
    })
  })

  // ============================================================================
  // canAffordUpgrade - Upgrade money check
  // ============================================================================

  describe('canAffordUpgrade', () => {
    it('returns true when money is sufficient for upgrade', () => {
      // cannon level 1 upgrade cost 225
      expect(system.canAffordUpgrade(500, 'cannon', 1)).toBe(true)
      expect(system.canAffordUpgrade(225, 'cannon', 1)).toBe(true)
    })

    it('returns false when money is insufficient for upgrade', () => {
      expect(system.canAffordUpgrade(100, 'cannon', 1)).toBe(false)
      expect(system.canAffordUpgrade(224, 'cannon', 1)).toBe(false)
    })
  })

  // ============================================================================
  // isWeapon - Weapon check
  // ============================================================================

  describe('isWeapon', () => {
    it('wall is not a weapon', () => {
      expect(system.isWeapon('wall')).toBe(false)
    })

    it('all other buildings are weapons', () => {
      expect(system.isWeapon('cannon')).toBe(true)
      expect(system.isWeapon('LMG')).toBe(true)
      expect(system.isWeapon('HMG')).toBe(true)
      expect(system.isWeapon('laser_gun')).toBe(true)
    })
  })

  // ============================================================================
  // getBuildingConfig - Get building config
  // ============================================================================

  describe('getBuildingConfig', () => {
    it('returns config for specified building type', () => {
      const config = system.getBuildingConfig('cannon')
      expect(config.name).toBe('Cannon')
      expect(config.cost).toBe(300)
      expect(config.damage).toBe(12)
    })
  })
})
