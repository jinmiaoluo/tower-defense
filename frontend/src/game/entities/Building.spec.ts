/**
 * Building entity tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createBuilding, type BuildingDependencies } from './Building'
import type { IMonster, BuildingCreateParams } from '@/types/entities'
import type { IWaveRecorder } from '@/types/recorder'
import type { BuildingType, Position } from '@/types'

// ============================================================================
// Mock data and factory functions
// ============================================================================

function createMockDependencies(overrides?: Partial<BuildingDependencies>): BuildingDependencies {
  return {
    getDamageAtLevel: vi.fn((type: BuildingType, level: number) => {
      // Simulate base damage calculation
      const baseDamage: Record<BuildingType, number> = {
        wall: 0,
        cannon: 12,
        LMG: 5,
        HMG: 30,
        laser_gun: 25,
      }
      let damage = baseDamage[type]
      for (let i = 1; i < level; i++) {
        damage = Math.floor(damage * 1.2)
      }
      return damage
    }),
    getRangeAtLevel: vi.fn((type: BuildingType, level: number) => {
      const baseRange: Record<BuildingType, number> = {
        wall: 0,
        cannon: 8,
        LMG: 10,
        HMG: 5,
        laser_gun: 10,
      }
      return Math.floor(baseRange[type] * Math.pow(level, 0.1))
    }),
    getAttackSpeedFrames: vi.fn((type: BuildingType) => {
      const speeds: Record<BuildingType, number> = {
        wall: Infinity,
        cannon: 30,
        LMG: 20,
        HMG: 20,
        laser_gun: 3,
      }
      return speeds[type]
    }),
    isInRange: vi.fn((building, targetPos) => {
      // Simple distance calculation
      const dx = building.position[0] - targetPos[0]
      const dy = building.position[1] - targetPos[1]
      const distance = Math.sqrt(dx * dx + dy * dy)
      const range = building.type === 'wall' ? 0 : 8
      return distance <= range && distance >= 0
    }),
    isWeapon: vi.fn((type: BuildingType) => type !== 'wall'),
    getBulletSpeed: vi.fn((type: BuildingType) => {
      const speeds: Record<BuildingType, number> = {
        wall: 0,
        cannon: 10,
        LMG: 15,
        HMG: 12,
        laser_gun: 0,
      }
      return speeds[type]
    }),
    ...overrides,
  }
}

function createMockMonster(overrides?: Partial<IMonster>): IMonster {
  return {
    id: 'monster-1',
    type: 0,
    maxLife: 100,
    currentLife: 100,
    speed: 1,
    shield: 0,
    money: 10,
    damage: 1,
    radius: 5,
    color: '#ff0000',
    progress: 0.5,
    isValid: true,
    takeDamage: vi.fn((rawDamage: number) => rawDamage),
    isDead: vi.fn(() => false),
    reachedExit: vi.fn(() => false),
    getGridPosition: vi.fn((): Position => [5, 5]),
    getPixelPosition: vi.fn(() => ({ x: 160, y: 160 })),
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
    addMoney: vi.fn(),
    addScore: vi.fn(),
    setDuration: vi.fn(),
    getActions: vi.fn(() => []),
    getAttacks: vi.fn(() => []),
    getResult: vi.fn(() => ({
      killed: 0,
      killedByType: {},
      passed: 0,
      scoreGained: 0,
      moneyGained: 0,
      lifeLost: 0,
      totalDamageDealt: 0,
      totalLifeDestroyed: 0,
      waveDurationFrames: 0,
    })),
    toWaveRequest: vi.fn(),
  } as unknown as IWaveRecorder
}

// ============================================================================
// Test cases
// ============================================================================

describe('Building', () => {
  let deps: BuildingDependencies
  let defaultParams: BuildingCreateParams

  beforeEach(() => {
    deps = createMockDependencies()
    defaultParams = {
      id: 'building-1',
      type: 'cannon',
      position: [5, 5] as Position,
      level: 1,
    }
  })

  // --------------------------------------------------------------------------
  // Creation and initialization
  // --------------------------------------------------------------------------

  describe('creation and initialization', () => {
    it('should correctly create a Building instance', () => {
      const building = createBuilding(defaultParams, deps)

      expect(building.id).toBe('building-1')
      expect(building.type).toBe('cannon')
      expect(building.level).toBe(1)
      expect(building.position).toEqual([5, 5])
      expect(building.cooldown).toBe(0)
      expect(building.damageDealt).toBe(0)
      expect(building.kills).toBe(0)
    })

    it('should default level to 1', () => {
      const params = { ...defaultParams, level: undefined }
      const building = createBuilding(params, deps)

      expect(building.level).toBe(1)
    })

    it('should support different building types', () => {
      const types: BuildingType[] = ['wall', 'cannon', 'LMG', 'HMG', 'laser_gun']

      for (const type of types) {
        const building = createBuilding({ ...defaultParams, type }, deps)
        expect(building.type).toBe(type)
      }
    })
  })

  // --------------------------------------------------------------------------
  // Attack ability check
  // --------------------------------------------------------------------------

  describe('canAttack', () => {
    it('should be able to attack when cooldown is finished', () => {
      const building = createBuilding(defaultParams, deps)
      building.cooldown = 0

      expect(building.canAttack()).toBe(true)
    })

    it('should not be able to attack while on cooldown', () => {
      const building = createBuilding(defaultParams, deps)
      building.cooldown = 10

      expect(building.canAttack()).toBe(false)
    })

    it('wall type should never be able to attack', () => {
      const building = createBuilding({ ...defaultParams, type: 'wall' }, deps)
      building.cooldown = 0

      expect(building.canAttack()).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Target search
  // --------------------------------------------------------------------------

  describe('findTarget', () => {
    it('should find a monster within range', () => {
      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster({ id: 'monster-1' })
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])

      const target = building.findTarget([monster])

      expect(target).toBe(monster)
    })

    it('should ignore invalid monsters', () => {
      const building = createBuilding(defaultParams, deps)
      const invalidMonster = createMockMonster({ isValid: false })
      const validMonster = createMockMonster({ id: 'monster-2' })
      ;(validMonster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])

      const target = building.findTarget([invalidMonster, validMonster])

      expect(target).toBe(validMonster)
    })

    it('should return null when there are no monsters', () => {
      const building = createBuilding(defaultParams, deps)

      const target = building.findTarget([])

      expect(target).toBeNull()
    })

    it('wall type should always return null', () => {
      const building = createBuilding({ ...defaultParams, type: 'wall' }, deps)
      const monster = createMockMonster()

      const target = building.findTarget([monster])

      expect(target).toBeNull()
    })

    it('should ignore monsters out of range', () => {
      // Configure isInRange to return false
      deps.isInRange = vi.fn(() => false)

      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster()
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([100, 100])

      const target = building.findTarget([monster])

      expect(target).toBeNull()
    })

    it('should prioritize the monster with the highest path progress', () => {
      const building = createBuilding(defaultParams, deps)

      const monster1 = createMockMonster({ id: 'monster-1', progress: 0.3 })
      const monster2 = createMockMonster({ id: 'monster-2', progress: 0.7 })
      const monster3 = createMockMonster({ id: 'monster-3', progress: 0.5 })

      ;(monster1.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      ;(monster2.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      ;(monster3.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])

      const target = building.findTarget([monster1, monster2, monster3])

      expect(target?.id).toBe('monster-2')
    })
  })

  // --------------------------------------------------------------------------
  // Attack behavior
  // --------------------------------------------------------------------------

  describe('attack', () => {
    it('should set cooldown after attacking', () => {
      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster()
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      expect(building.cooldown).toBe(30) // cannon attack interval
    })

    it('should not record attack event for non-laser weapons', () => {
      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster()
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      // Non-laser weapons should not record attack directly; BulletSystem handles it
      expect(recorder.recordAttack).not.toHaveBeenCalled()
    })

    it('laser_gun should hit immediately and record', () => {
      const building = createBuilding({ ...defaultParams, type: 'laser_gun' }, deps)
      const monster = createMockMonster()
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      // laser_gun deals damage directly
      expect(monster.takeDamage).toHaveBeenCalled()
      // laser_gun should record the attack event
      expect(recorder.recordAttack).toHaveBeenCalled()
    })

    it('laser_gun should update stats after attacking', () => {
      const building = createBuilding({ ...defaultParams, type: 'laser_gun' }, deps)
      const monster = createMockMonster()
      ;(monster.takeDamage as ReturnType<typeof vi.fn>).mockReturnValue(25)
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      expect(building.damageDealt).toBe(25)
    })

    it('laser_gun kill should increment kills', () => {
      const building = createBuilding({ ...defaultParams, type: 'laser_gun' }, deps)
      const monster = createMockMonster()
      ;(monster.takeDamage as ReturnType<typeof vi.fn>).mockReturnValue(100)
      ;(monster.isDead as ReturnType<typeof vi.fn>).mockReturnValue(true)
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      expect(building.kills).toBe(1)
    })
  })

  // --------------------------------------------------------------------------
  // Property getters
  // --------------------------------------------------------------------------

  describe('property getters', () => {
    it('getDamage should return damage for the current level', () => {
      const building = createBuilding(defaultParams, deps)

      const damage = building.getDamage()

      expect(deps.getDamageAtLevel).toHaveBeenCalledWith('cannon', 1)
      expect(damage).toBe(12)
    })

    it('getRange should return range for the current level', () => {
      const building = createBuilding(defaultParams, deps)

      const range = building.getRange()

      expect(deps.getRangeAtLevel).toHaveBeenCalledWith('cannon', 1)
      expect(range).toBe(8)
    })

    it('getAttackSpeed should return attack interval in frames', () => {
      const building = createBuilding(defaultParams, deps)

      const speed = building.getAttackSpeed()

      expect(deps.getAttackSpeedFrames).toHaveBeenCalledWith('cannon')
      expect(speed).toBe(30)
    })

    it('properties should update correctly after upgrade', () => {
      const building = createBuilding({ ...defaultParams, level: 3 }, deps)

      const damage = building.getDamage()

      expect(deps.getDamageAtLevel).toHaveBeenCalledWith('cannon', 3)
      // level 1: 12
      // level 2: floor(12 * 1.2) = floor(14.4) = 14
      // level 3: floor(14 * 1.2) = floor(16.8) = 16
      expect(damage).toBe(16)
    })
  })

  // --------------------------------------------------------------------------
  // Wave stats reset
  // --------------------------------------------------------------------------

  describe('resetWaveStats', () => {
    it('should reset wave statistics', () => {
      const building = createBuilding(defaultParams, deps)
      building.damageDealt = 500
      building.kills = 10

      building.resetWaveStats()

      expect(building.damageDealt).toBe(0)
      expect(building.kills).toBe(0)
    })

    it('should not reset other state', () => {
      const building = createBuilding(defaultParams, deps)
      building.level = 5
      building.cooldown = 10

      building.resetWaveStats()

      expect(building.level).toBe(5)
      expect(building.cooldown).toBe(10)
    })
  })

  // --------------------------------------------------------------------------
  // Cooldown update
  // --------------------------------------------------------------------------

  describe('updateCooldown', () => {
    it('should decrease cooldown each frame', () => {
      const building = createBuilding(defaultParams, deps)
      building.cooldown = 10

      building.updateCooldown()

      expect(building.cooldown).toBe(9)
    })

    it('cooldown should not go below zero', () => {
      const building = createBuilding(defaultParams, deps)
      building.cooldown = 0

      building.updateCooldown()

      expect(building.cooldown).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Bullet creation parameters
  // --------------------------------------------------------------------------

  describe('getBulletParams', () => {
    it('should return correct bullet creation parameters', () => {
      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster()
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])

      const params = building.getBulletParams(monster)

      expect(params).not.toBeNull()
      expect(params!.building).toBe(building)
      expect(params!.damage).toBe(12) // cannon level 1 damage
      expect(params!.speed).toBe(10) // cannon bullet speed
      expect(params!.originalTargetId).toBe('monster-1')
      expect(params!.originalTargetPosition).toEqual([6, 6])
    })

    it('laser_gun should return null (does not use bullets)', () => {
      const building = createBuilding({ ...defaultParams, type: 'laser_gun' }, deps)
      const monster = createMockMonster()

      const params = building.getBulletParams(monster)

      expect(params).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // Upgrade
  // --------------------------------------------------------------------------

  describe('upgrade', () => {
    it('should increment level', () => {
      const building = createBuilding(defaultParams, deps)

      building.upgrade()

      expect(building.level).toBe(2)
    })

    it('damage should increase after upgrade', () => {
      const building = createBuilding(defaultParams, deps)

      building.upgrade()
      building.getDamage()

      expect(deps.getDamageAtLevel).toHaveBeenCalledWith('cannon', 2)
    })
  })
})
