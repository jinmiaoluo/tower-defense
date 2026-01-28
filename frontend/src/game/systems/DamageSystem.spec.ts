/**
 * DamageSystem test cases
 * Tests core damage calculation logic (score calculation moved to ScoreSystem)
 * Reference: html5-tower-defense/src/js/td-obj-monster.js:beHit
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createDamageSystem, type DamageSystem } from './DamageSystem'
import { createScoreSystem, type ScoreSystem } from './ScoreSystem'
import type { IMonster } from '@/types/entities'

/** Create a mock monster */
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
    getPixelPosition: () => ({ x: 0, y: 0 }),
    ...overrides,
  }
}

describe('DamageSystem', () => {
  let system: DamageSystem
  let scoreSystem: ScoreSystem

  beforeEach(() => {
    system = createDamageSystem()
    scoreSystem = createScoreSystem()
  })

  // ============================================================================
  // calculate - Actual damage calculation
  // ============================================================================

  describe('calculate', () => {
    it('damage equals raw damage when no shield', () => {
      expect(system.calculate(12, 0)).toBe(12)
      expect(system.calculate(30, 0)).toBe(30)
      expect(system.calculate(1, 0)).toBe(1)
    })

    it('shield reduces damage', () => {
      // Raw damage 12, shield 5, actual damage = 12 - 5 = 7
      expect(system.calculate(12, 5)).toBe(7)
      // Raw damage 30, shield 10, actual damage = 30 - 10 = 20
      expect(system.calculate(30, 10)).toBe(20)
    })

    it('uses minimum damage (10%) when shield exceeds damage', () => {
      // Raw damage 12, shield 20
      // After reduction = 12 - 20 = -8, minimum damage = ceil(12 * 0.1) = 2
      expect(system.calculate(12, 20)).toBe(2)
    })

    it('uses minimum damage when shield equals damage', () => {
      // Raw damage 10, shield 10
      // After reduction = 0, minimum damage = ceil(10 * 0.1) = 1
      expect(system.calculate(10, 10)).toBe(1)
    })

    it('high damage weapons have advantage against high shield monsters', () => {
      // HMG damage 30, shield 100
      // After reduction = 30 - 100 = -70, minimum damage = ceil(30 * 0.1) = 3
      expect(system.calculate(30, 100)).toBe(3)
      // LMG damage 5, shield 100
      // After reduction = 5 - 100 = -95, minimum damage = ceil(5 * 0.1) = 1
      expect(system.calculate(5, 100)).toBe(1)
      // HMG minimum damage is 3x that of LMG
    })

    it('minimum damage rounds up', () => {
      // Raw damage 15, shield 20
      // Minimum damage = ceil(15 * 0.1) = ceil(1.5) = 2
      expect(system.calculate(15, 20)).toBe(2)
      // Raw damage 11, shield 20
      // Minimum damage = ceil(11 * 0.1) = ceil(1.1) = 2
      expect(system.calculate(11, 20)).toBe(2)
    })

    it('minimum damage is 1 when raw damage is 1', () => {
      // Raw damage 1, shield 10
      // After reduction = 1 - 10 = -9, minimum damage = ceil(1 * 0.1) = ceil(0.1) = 1
      expect(system.calculate(1, 10)).toBe(1)
    })

    it('edge case: reduced damage exactly equals minimum damage', () => {
      // Raw damage 10, shield 9
      // After reduction = 10 - 9 = 1, minimum damage = ceil(10 * 0.1) = 1
      // Should take the greater = 1
      expect(system.calculate(10, 9)).toBe(1)
    })

    it('uses reduced value when it exceeds minimum damage', () => {
      // Raw damage 100, shield 50
      // After reduction = 50, minimum damage = ceil(100 * 0.1) = 10
      // Should take the greater = 50
      expect(system.calculate(100, 50)).toBe(50)
    })
  })

  // ============================================================================
  // isKilled - Kill determination
  // ============================================================================

  describe('isKilled', () => {
    it('returns true when damage is enough to kill', () => {
      const monster = createMockMonster({ currentLife: 10 })
      expect(system.isKilled(monster, 10)).toBe(true)
      expect(system.isKilled(monster, 15)).toBe(true)
    })

    it('returns false when damage is not enough to kill', () => {
      const monster = createMockMonster({ currentLife: 10 })
      expect(system.isKilled(monster, 5)).toBe(false)
      expect(system.isKilled(monster, 9)).toBe(false)
    })

    it('returns true when monster is already dead', () => {
      const monster = createMockMonster({ currentLife: 0 })
      expect(system.isKilled(monster, 0)).toBe(true)
    })

    it('edge case: damage exactly equals remaining life', () => {
      const monster = createMockMonster({ currentLife: 25 })
      expect(system.isKilled(monster, 25)).toBe(true)
    })
  })

  // ============================================================================
  // wouldKill - Kill prediction (without dealing actual damage)
  // ============================================================================

  describe('wouldKill', () => {
    it('kill prediction considering shield', () => {
      const monster = createMockMonster({ currentLife: 10, shield: 5 })
      // Raw damage 20, shield 5, actual damage 15 > life 10
      expect(system.wouldKill(monster, 20)).toBe(true)
    })

    it('shield prevents kill', () => {
      const monster = createMockMonster({ currentLife: 10, shield: 15 })
      // Raw damage 12, shield 15, actual damage = ceil(12*0.1) = 2 < life 10
      expect(system.wouldKill(monster, 12)).toBe(false)
    })
  })

  // ============================================================================
  // getEffectiveDamage - Get effective damage against a specific monster
  // ============================================================================

  describe('getEffectiveDamage', () => {
    it('calculates effective damage based on current shield', () => {
      const monster = createMockMonster({ shield: 5 })
      // Raw damage 12, shield 5, effective damage 7
      expect(system.getEffectiveDamage(monster, 12)).toBe(7)
    })

    it('effective damage equals raw damage when shield is depleted', () => {
      const monster = createMockMonster({ shield: 0 })
      expect(system.getEffectiveDamage(monster, 12)).toBe(12)
    })
  })

  // ============================================================================
  // getDamageToKill - Calculate total damage needed to kill
  // ============================================================================

  describe('getDamageToKill', () => {
    it('equals remaining life when no shield', () => {
      const monster = createMockMonster({ currentLife: 50, shield: 0 })
      expect(system.getDamageToKill(monster)).toBe(50)
    })

    it('considers shield absorption when shield is present', () => {
      const monster = createMockMonster({ currentLife: 50, shield: 10 })
      // Total damage needed = life + shield = 60 (simplified calculation)
      expect(system.getDamageToKill(monster)).toBe(60)
    })
  })

  // ============================================================================
  // Integration scenarios (with ScoreSystem)
  // ============================================================================

  describe('Integration scenarios', () => {
    it('laser gun high-frequency attack scoring advantage', () => {
      // Laser gun: damage 25, speed 20 (20 attacks per second)
      // 20 attacks in 1 second, 5 points each, total 100
      const laserDamages = Array(20).fill(25)
      const laserScore = scoreSystem.calculateTotalHitScore(laserDamages)

      // HMG: damage 30, speed 3 (3 attacks per second)
      // 3 attacks in 1 second, 5 points each, total 15
      const hmgDamages = Array(3).fill(30)
      const hmgScore = scoreSystem.calculateTotalHitScore(hmgDamages)

      expect(laserScore).toBeGreaterThan(hmgScore)
      expect(laserScore).toBe(100)
      expect(hmgScore).toBe(15)
    })

    it('shield monster combat scenario', () => {
      // Shield monster: life 50, shield 20
      const shieldMonster = createMockMonster({
        currentLife: 50,
        shield: 20,
      })

      // LMG attack (damage 5)
      const lmgEffective = system.getEffectiveDamage(shieldMonster, 5)
      // 5 - 20 = -15, minimum damage = ceil(5*0.1) = 1
      expect(lmgEffective).toBe(1)

      // HMG attack (damage 30)
      const hmgEffective = system.getEffectiveDamage(shieldMonster, 30)
      // 30 - 20 = 10 > ceil(30*0.1) = 3
      expect(hmgEffective).toBe(10)

      // HMG efficiency against shield monster is 10x that of LMG
      expect(hmgEffective / lmgEffective).toBe(10)
    })
  })
})
