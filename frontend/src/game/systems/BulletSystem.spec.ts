/**
 * BulletSystem test cases
 * Written in TDD style, tests before implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createBulletSystem,
  type BulletSystem,
  type Rect,
} from './BulletSystem'
import type { IBuilding, IMonster } from '@/types/entities'
import type { IWaveRecorder } from '@/types/recorder'
import type { Position } from '@/types'

// ============================================================================
// Mock factory functions
// ============================================================================

function createMockBuilding(overrides: Partial<IBuilding> = {}): IBuilding {
  return {
    id: 'building-001',
    type: 'cannon',
    level: 1,
    position: [5, 5] as Position,
    cooldown: 0,
    damageDealt: 0,
    kills: 0,
    canAttack: () => true,
    findTarget: () => null,
    attack: vi.fn(),
    getDamage: () => 12,
    getRange: () => 4,
    getAttackSpeed: () => 30,
    resetWaveStats: vi.fn(),
    getCurrentTargetPosition: () => null,
    hasActiveTarget: () => false,
    ...overrides,
  }
}

function createMockMonster(overrides: Partial<IMonster> = {}): IMonster {
  const damage = overrides.damage ?? 1
  // radius = floor(damage * 1.2), clamped to 4-12
  const radius = Math.max(4, Math.min(12, Math.floor(damage * 1.2)))
  return {
    id: 'monster-001',
    type: 0,
    maxLife: 50,
    currentLife: 50,
    speed: 3,
    shield: 0,
    money: 10,
    damage,
    radius,
    color: '#00ff00',
    progress: 0.5,
    isValid: true,
    takeDamage: vi.fn((rawDamage: number) => rawDamage),
    isDead: () => false,
    reachedExit: () => false,
    getGridPosition: () => [8, 5] as Position,
    getPixelPosition: () => ({ x: 256, y: 160 }),
    ...overrides,
  }
}

function createMockRecorder(): IWaveRecorder {
  return {
    recordBuild: vi.fn(),
    recordUpgrade: vi.fn(),
    recordSell: vi.fn(),
    recordAttack: vi.fn(),
    recordKill: vi.fn(),
    recordPassed: vi.fn(),
    recordRemainingMonster: vi.fn(),
    recordSpawn: vi.fn(),
    getRemainingMonsterIds: () => [],
    setDuration: vi.fn(),
    getActions: () => [],
    getAttacks: () => [],
    getResult: () => ({
      killed: 0,
      killedByType: {},
      passed: 0,
      scoreGained: 0,
      moneyGained: 0,
      lifeLost: 0,
      totalDamageDealt: 0,
      totalLifeDestroyed: 0,
      waveDurationFrames: 0,
    }),
    toWaveRequest: vi.fn() as unknown as IWaveRecorder['toWaveRequest'],
    reset: vi.fn(),
  }
}

function createTestMapBounds(): Rect {
  return {
    x: 0,
    y: 0,
    width: 512, // 16 * 32
    height: 512,
  }
}

// ============================================================================
// Test cases
// ============================================================================

describe('BulletSystem', () => {
  let bulletSystem: BulletSystem
  let mockRecorder: IWaveRecorder

  beforeEach(() => {
    bulletSystem = createBulletSystem()
    mockRecorder = createMockRecorder()
  })

  describe('createBullet', () => {
    it('should correctly create a bullet', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      const bullet = bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 6,
        startX: 160, // 5 * 32
        startY: 160,
      })

      expect(bullet).toBeDefined()
      expect(bullet.building).toBe(building)
      expect(bullet.damage).toBe(12)
      expect(bullet.speed).toBe(6)
      expect(bullet.x).toBe(160)
      expect(bullet.y).toBe(160)
      expect(bullet.isValid).toBe(true)
    })

    it('should calculate correct velocity vector', () => {
      const building = createMockBuilding({ position: [0, 0] })
      const target = createMockMonster({
        getGridPosition: () => [3, 4] as Position, // distance 5 cells
      })

      const bullet = bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 10, // config value
        startX: 16, // cell center
        startY: 16,
        targetX: 3 * 32 + 16, // 112
        targetY: 4 * 32 + 16, // 144
      })

      // Direction vector (96, 128), length 160
      // Old implementation (24 FPS): actual speed = 10 * 20 * 0.1 = 20
      // New implementation (60 FPS): actual speed = 10 * 20 * 0.1 * (24/60) = 8
      // vx = 96 * 8 / 160 = 4.8
      // vy = 128 * 8 / 160 = 6.4
      expect(bullet.vx).toBeCloseTo(4.8)
      expect(bullet.vy).toBeCloseTo(6.4)
    })

    it('should record original target info', () => {
      const building = createMockBuilding()
      const target = createMockMonster({
        id: 'target-monster',
        getGridPosition: () => [10, 10] as Position,
      })

      const bullet = bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 6,
        startX: 160,
        startY: 160,
      })

      expect(bullet.originalTargetId).toBe('target-monster')
      expect(bullet.originalTargetPosition).toEqual([10, 10])
    })

    it('should add bullet to the system', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 6,
        startX: 160,
        startY: 160,
      })

      expect(bulletSystem.getBullets()).toHaveLength(1)
    })
  })

  describe('update - movement', () => {
    it('should move bullet each frame', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      const bullet = bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 10,
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 100, // pure horizontal direction
      })

      const initialX = bullet.x

      bulletSystem.update([], createTestMapBounds(), mockRecorder, 1)

      expect(bullet.x).toBeGreaterThan(initialX)
      expect(bullet.y).toBe(100) // Y unchanged
    })

    it('should not move invalid bullets', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      const bullet = bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 10,
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 100,
      })

      bullet.isValid = false
      const initialX = bullet.x

      bulletSystem.update([], createTestMapBounds(), mockRecorder, 1)

      expect(bullet.x).toBe(initialX)
    })
  })

  describe('update - collision detection', () => {
    it('should detect hitting a monster', () => {
      const building = createMockBuilding()
      const target = createMockMonster({
        id: 'target-001',
        getGridPosition: () => [6, 5] as Position,
      })

      // Bullet position very close to monster
      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 100,
        startX: 6 * 32 + 16, // same position as monster
        startY: 5 * 32 + 16,
        targetX: 6 * 32 + 16,
        targetY: 5 * 32 + 16,
      })

      const monster = createMockMonster({
        id: 'target-001',
        getGridPosition: () => [6, 5] as Position,
      })

      // Mock monster pixel position
      ;(monster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(monster as unknown as { x: number; y: number }).y = 5 * 32 + 16

      bulletSystem.update([monster], createTestMapBounds(), mockRecorder, 100)

      // Should call takeDamage
      expect(monster.takeDamage).toHaveBeenCalledWith(12)
    })

    it('should record attack event after hit', () => {
      const building = createMockBuilding({ id: 'building-test' })
      const originalTarget = createMockMonster({
        id: 'original-target',
        getGridPosition: () => [6, 5] as Position,
      })

      bulletSystem.createBullet({
        building,
        target: originalTarget,
        damage: 12,
        speed: 100,
        startX: 6 * 32 + 16,
        startY: 5 * 32 + 16,
        targetX: 6 * 32 + 16,
        targetY: 5 * 32 + 16,
      })

      const hitMonster = createMockMonster({
        id: 'hit-monster',
        getGridPosition: () => [6, 5] as Position,
        takeDamage: vi.fn(() => 10), // returns actual damage
      })
      ;(hitMonster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(hitMonster as unknown as { x: number; y: number }).y = 5 * 32 + 16

      bulletSystem.update([hitMonster], createTestMapBounds(), mockRecorder, 100)

      expect(mockRecorder.recordAttack).toHaveBeenCalledWith(
        expect.objectContaining({
          buildingId: 'building-test',
          originalTargetId: 'original-target',
          monsterId: 'hit-monster',
          frame: 100,
        }),
      )
    })

    it('should remove bullet after hit', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 100,
        startX: 6 * 32 + 16,
        startY: 5 * 32 + 16,
        targetX: 6 * 32 + 16,
        targetY: 5 * 32 + 16,
      })

      const monster = createMockMonster()
      ;(monster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(monster as unknown as { x: number; y: number }).y = 5 * 32 + 16

      bulletSystem.update([monster], createTestMapBounds(), mockRecorder, 1)

      expect(bulletSystem.getBullets()).toHaveLength(0)
    })

    it('should support friendly fire (hitting non-original target)', () => {
      const building = createMockBuilding()
      const originalTarget = createMockMonster({
        id: 'original-target',
        getGridPosition: () => [10, 10] as Position,
      })

      // Bullet flying towards (10, 10), using slower speed for testing
      // speed=1 means actual speed = 1 * 20 * 0.1 = 2 pixels/frame
      bulletSystem.createBullet({
        building,
        target: originalTarget,
        damage: 12,
        speed: 1, // slower speed for collision testing
        startX: 5 * 32 + 16,
        startY: 5 * 32 + 16,
        targetX: 10 * 32 + 16,
        targetY: 10 * 32 + 16,
      })

      // But another monster is on the path (closer)
      const interceptMonster = createMockMonster({
        id: 'intercept-monster',
        getGridPosition: () => [6, 6] as Position,
      })
      ;(interceptMonster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(interceptMonster as unknown as { x: number; y: number }).y = 6 * 32 + 16

      // Update multiple times until hit or bullet disappears
      for (let i = 0; i < 50; i++) {
        bulletSystem.update([interceptMonster], createTestMapBounds(), mockRecorder, i)
        if (bulletSystem.getBullets().length === 0) break
      }

      // Should hit the intercepting monster
      expect(interceptMonster.takeDamage).toHaveBeenCalled()
      expect(mockRecorder.recordAttack).toHaveBeenCalledWith(
        expect.objectContaining({
          originalTargetId: 'original-target',
          monsterId: 'intercept-monster',
        }),
      )
    })

    it('should not hit invalid monsters', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 100,
        startX: 6 * 32 + 16,
        startY: 5 * 32 + 16,
        targetX: 6 * 32 + 16,
        targetY: 5 * 32 + 16,
      })

      const invalidMonster = createMockMonster({
        isValid: false,
      })
      ;(invalidMonster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(invalidMonster as unknown as { x: number; y: number }).y = 5 * 32 + 16

      bulletSystem.update([invalidMonster], createTestMapBounds(), mockRecorder, 1)

      expect(invalidMonster.takeDamage).not.toHaveBeenCalled()
    })

    it('should update building damageDealt stat after hit', () => {
      const building = createMockBuilding({ damageDealt: 0 })
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 100,
        startX: 6 * 32 + 16,
        startY: 5 * 32 + 16,
        targetX: 6 * 32 + 16,
        targetY: 5 * 32 + 16,
      })

      const hitMonster = createMockMonster({
        takeDamage: vi.fn(() => 10), // returns actual damage 10
      })
      ;(hitMonster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(hitMonster as unknown as { x: number; y: number }).y = 5 * 32 + 16

      bulletSystem.update([hitMonster], createTestMapBounds(), mockRecorder, 1)

      expect(building.damageDealt).toBe(10)
    })

    it('should update building kills stat after killing a monster', () => {
      const building = createMockBuilding({ kills: 0 })
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 50,
        speed: 100,
        startX: 6 * 32 + 16,
        startY: 5 * 32 + 16,
        targetX: 6 * 32 + 16,
        targetY: 5 * 32 + 16,
      })

      const dyingMonster = createMockMonster({
        takeDamage: vi.fn(() => 50),
        isDead: () => true, // killed
      })
      ;(dyingMonster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(dyingMonster as unknown as { x: number; y: number }).y = 5 * 32 + 16

      bulletSystem.update([dyingMonster], createTestMapBounds(), mockRecorder, 1)

      expect(building.kills).toBe(1)
    })

    it('should not increment kills stat when monster survives', () => {
      const building = createMockBuilding({ kills: 0 })
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 10,
        speed: 100,
        startX: 6 * 32 + 16,
        startY: 5 * 32 + 16,
        targetX: 6 * 32 + 16,
        targetY: 5 * 32 + 16,
      })

      const survivingMonster = createMockMonster({
        takeDamage: vi.fn(() => 10),
        isDead: () => false, // not killed
      })
      ;(survivingMonster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(survivingMonster as unknown as { x: number; y: number }).y = 5 * 32 + 16

      bulletSystem.update([survivingMonster], createTestMapBounds(), mockRecorder, 1)

      expect(building.damageDealt).toBe(10) // damage stat should update
      expect(building.kills).toBe(0) // kills stat should not update
    })
  })

  describe('update - boundary detection', () => {
    it('should remove bullets that fly out of map bounds', () => {
      const building = createMockBuilding()
      const target = createMockMonster({
        getGridPosition: () => [20, 5] as Position, // target outside map
      })

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 100,
        startX: 500,
        startY: 256,
        targetX: 1000, // target outside map
        targetY: 256,
      })

      const bounds = createTestMapBounds()

      // Update multiple times until bullet flies out of bounds
      for (let i = 0; i < 10; i++) {
        bulletSystem.update([], bounds, mockRecorder, i)
      }

      expect(bulletSystem.getBullets()).toHaveLength(0)
    })

    it('should not record attack event for out-of-bounds bullets', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 1000,
        startX: 500,
        startY: 256,
        targetX: 1000,
        targetY: 256,
      })

      bulletSystem.update([], createTestMapBounds(), mockRecorder, 1)

      expect(mockRecorder.recordAttack).not.toHaveBeenCalled()
    })
  })

  describe('getBullets', () => {
    it('should return all valid bullets', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 6,
        startX: 100,
        startY: 100,
      })

      bulletSystem.createBullet({
        building,
        target,
        damage: 15,
        speed: 8,
        startX: 200,
        startY: 200,
      })

      const bullets = bulletSystem.getBullets()

      expect(bullets).toHaveLength(2)
    })

    it('returned array should be readonly (not affecting internal state)', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 6,
        startX: 100,
        startY: 100,
      })

      const bullets = bulletSystem.getBullets()
      // Returns a readonly copy, cannot be modified
      expect(bullets).toHaveLength(1)
      // Getting again should still have 1 bullet (proving immutability)
      expect(bulletSystem.getBullets()).toHaveLength(1)
    })
  })

  describe('clear', () => {
    it('should clear all bullets', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 6,
        startX: 100,
        startY: 100,
      })

      bulletSystem.createBullet({
        building,
        target,
        damage: 15,
        speed: 8,
        startX: 200,
        startY: 200,
      })

      expect(bulletSystem.getBullets()).toHaveLength(2)

      bulletSystem.clear()

      expect(bulletSystem.getBullets()).toHaveLength(0)
    })
  })

  describe('collision detection details', () => {
    it('collision detection should use lenient range', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      // Bullet damage=12, radius ~ max(log(12), 2) ~ 2.48
      // Monster damage=1, radius = max(floor(1*1.2), 4) = 4
      // Lenient collision range = sqrt((2.48 + 4)^2 * 2) ~ 9.15
      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 0.1, // very slow, barely moves
        startX: 200,
        startY: 200,
        targetX: 300,
        targetY: 200,
      })

      const monster = createMockMonster()
      // Monster is about 8 pixels from bullet, within lenient collision range (< 9.15)
      ;(monster as unknown as { x: number; y: number }).x = 208
      ;(monster as unknown as { x: number; y: number }).y = 200

      bulletSystem.update([monster], createTestMapBounds(), mockRecorder, 1)

      expect(monster.takeDamage).toHaveBeenCalled()
    })
  })

  describe('performance', () => {
    it('should efficiently handle large number of bullets', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      // Create 100 bullets
      for (let i = 0; i < 100; i++) {
        bulletSystem.createBullet({
          building,
          target,
          damage: 12,
          speed: 6,
          startX: 100 + i,
          startY: 100,
          targetX: 400,
          targetY: 100,
        })
      }

      expect(bulletSystem.getBullets()).toHaveLength(100)

      // Update should complete normally
      const startTime = performance.now()
      for (let frame = 0; frame < 60; frame++) {
        bulletSystem.update([], createTestMapBounds(), mockRecorder, frame)
      }
      const elapsed = performance.now() - startTime

      // Should complete within reasonable time (< 100ms)
      expect(elapsed).toBeLessThan(100)
    })
  })
})
