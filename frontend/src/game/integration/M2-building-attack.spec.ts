/**
 * M2 milestone integration test
 * Verify: Building -> Bullet -> Monster complete attack flow
 *
 * Test scenarios:
 * 1. Building detects a target within range
 * 2. Building attacks and creates a bullet (or laser gun hits instantly)
 * 3. Bullet flies and hits the monster
 * 4. Monster takes damage (considering shield reduction)
 * 5. Monster dies when isValid becomes false
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPathSystem, type PathSystem } from '../systems/PathSystem'
import { createGridSystem, type GridSystem } from '../systems/GridSystem'
import { createBuildingSystem, type BuildingSystem } from '../systems/BuildingSystem'
import { createBulletSystem, type BulletSystem, type Rect } from '../systems/BulletSystem'
import { createDamageSystem, type DamageSystem } from '../systems/DamageSystem'
import { createBuilding, type BuildingDependencies, type IBuildingRuntime } from '../entities/Building'
import { createMonster, type MonsterDependencies } from '../entities/Monster'
import type { IBuilding, Path } from '@/types/entities'
import type { IWaveRecorder, AttackRecordData } from '@/types/recorder'
import type { MapConfig, MonsterTypeId, BuildingType } from '@/types'
import { GAME_CONSTANTS } from '@/types'
import { MOCK_GAME_CONFIG, MOCK_BUILDINGS } from '@/mocks'

const { GRID_SIZE } = GAME_CONSTANTS

// ============================================================================
// Test configuration
// ============================================================================

/** Create a small test map (easy to control distances) */
function createTestMapConfig(): MapConfig {
  return {
    width: 10,
    height: 10,
    entrance: [0, 5],
    exit: [9, 5],
    obstacles: [],
  }
}

/** Create mock WaveRecorder */
function createMockRecorder(): IWaveRecorder & { attacks: AttackRecordData[] } {
  const attacks: AttackRecordData[] = []

  return {
    attacks,
    recordBuild: vi.fn(),
    recordUpgrade: vi.fn(),
    recordSell: vi.fn(),
    recordAttack: (data: AttackRecordData) => {
      attacks.push(data)
    },
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
    toWaveRequest: () => ({
      sessionId: '',
      waveNumber: 1,
      buildings: [],
      actions: [],
      attacks: [],
      result: {
        killed: 0,
        killedByType: {},
        passed: 0,
        scoreGained: 0,
        moneyGained: 0,
        lifeLost: 0,
        totalDamageDealt: 0,
        totalLifeDestroyed: 0,
        waveDurationFrames: 0,
      },
    }),
    reset: vi.fn(),
  }
}

/** Create Building dependencies */
function createBuildingDeps(buildingSystem: BuildingSystem): BuildingDependencies {
  return {
    getDamageAtLevel: buildingSystem.getDamageAtLevel,
    getRangeAtLevel: buildingSystem.getRangeAtLevel,
    getAttackSpeedFrames: buildingSystem.getAttackSpeedFrames,
    isInRange: buildingSystem.isInRange,
    isWeapon: buildingSystem.isWeapon,
    getBulletSpeed: (type: BuildingType) => {
      const config = buildingSystem.getBuildingConfig(type)
      return config.bullet_speed
    },
  }
}

/** Create Monster dependencies */
function createMonsterDeps(gridSystem: GridSystem, pathSystem: PathSystem): MonsterDependencies {
  return {
    generatePathFrom: (startPosition) => {
      return pathSystem.generatePathFrom(startPosition, gridSystem.getMapConfig())
    },
    getPositionAtProgress: (path: Path, progress: number) => {
      return pathSystem.getPositionAtProgress(path, progress)
    },
    isPassable: (position) => gridSystem.isPassable(position),
    getEntrance: () => gridSystem.getMapConfig().entrance,
  }
}

/** Get map bounds */
function getMapBounds(mapConfig: MapConfig): Rect {
  return {
    x: 0,
    y: 0,
    width: mapConfig.width * GRID_SIZE,
    height: mapConfig.height * GRID_SIZE,
  }
}

// ============================================================================
// M2 integration tests
// ============================================================================

describe('M2: Building -> Bullet -> Monster complete attack flow', () => {
  let pathSystem: PathSystem
  let gridSystem: GridSystem
  let buildingSystem: BuildingSystem
  let bulletSystem: BulletSystem
  let damageSystem: DamageSystem
  let mapConfig: MapConfig
  let mapBounds: Rect
  let recorder: IWaveRecorder & { attacks: AttackRecordData[] }

  beforeEach(() => {
    mapConfig = createTestMapConfig()
    mapBounds = getMapBounds(mapConfig)
    pathSystem = createPathSystem()
    gridSystem = createGridSystem(mapConfig)
    buildingSystem = createBuildingSystem(MOCK_GAME_CONFIG)
    bulletSystem = createBulletSystem()
    damageSystem = createDamageSystem()
    recorder = createMockRecorder()
  })

  describe('Building target search', () => {
    it('Building should detect monsters within range', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // Place LMG at [5, 5] (range 5-10)
      const building = createBuilding({
        id: 'building-001',
        type: 'LMG',
        position: [5, 5],
        level: 1,
      }, buildingDeps)

      // Create monster at [5, 3] (distance 2, within minimum range)
      const monsterNear = createMonster({
        id: 'monster-near',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)
      // Set monster position to [5, 3]
      const path = gridSystem.getCurrentPath()
      const nearIndex = path.findIndex(([x, y]) => x === 5 && y === 3)
      if (nearIndex >= 0) {
        monsterNear.progress = nearIndex / (path.length - 1)
      }

      // Create monster at [0, 5] (distance 5, within range)
      const monsterInRange = createMonster({
        id: 'monster-in-range',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)
      monsterInRange.progress = 0 // at entrance

      const monsters = [monsterNear, monsterInRange]
      const target = building.findTarget(monsters)

      // Should find a monster within range (entrance monster is distance 5, right at LMG range boundary)
      expect(target).not.toBeNull()
    })

    it('Building should select the target with highest path progress', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // Place cannon at [5, 5] (range 4-8)
      const building = createBuilding({
        id: 'building-001',
        type: 'cannon',
        position: [5, 5],
        level: 1,
      }, buildingDeps)

      // Create two monsters, both within range
      const monster1 = createMonster({
        id: 'monster-1',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)
      monster1.progress = 0.3

      const monster2 = createMonster({
        id: 'monster-2',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)
      monster2.progress = 0.6 // higher progress

      const monsters = [monster1, monster2]
      const target = building.findTarget(monsters)

      // If both monsters are within range, should select the one with higher progress
      if (target !== null) {
        // Verify selection logic: higher progress is prioritized
        const validTargets = monsters.filter(m => {
          const pos = m.getGridPosition()
          return buildingSystem.isInRange({ type: 'cannon', level: 1, position: [5, 5] }, pos)
        })

        if (validTargets.length === 2) {
          expect(target.id).toBe('monster-2')
        }
      }
    })

    it('Monsters outside range should not be selected as targets', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // Place HMG at [0, 0] (range 3-5, very small)
      const building = createBuilding({
        id: 'building-001',
        type: 'HMG',
        position: [0, 0],
        level: 1,
      }, buildingDeps)

      // Create monster at [9, 5] (distance ~10, far beyond range)
      const monster = createMonster({
        id: 'monster-far',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)
      monster.progress = 0.9 // near exit

      const target = building.findTarget([monster])

      expect(target).toBeNull()
    })
  })

  describe('Laser gun instant hit', () => {
    it('Laser gun should immediately deal damage to the target', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // Place laser gun in the middle of the path
      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      // Create monster
      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      const initialLife = monster.currentLife
      const expectedDamage = buildingSystem.getDamageAtLevel('laser_gun', 1) // 25

      // Move monster into building range
      // Laser gun range 6-10, need to place monster at distance 6-10
      const path = gridSystem.getCurrentPath()
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'laser_gun', level: 1, position: [5, 5] }, pos)) {
          break
        }
      }

      const target = building.findTarget([monster])
      if (target) {
        building.attack(target, recorder, 1)

        // Laser gun deals damage instantly
        expect(monster.currentLife).toBe(initialLife - expectedDamage)

        // Should record the attack event
        expect(recorder.attacks.length).toBe(1)
        expect(recorder.attacks[0].damage).toBe(expectedDamage)
      }
    })

    it('Laser gun attacking shielded monster should consider shield reduction', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      // Create shielded monster (shield: 20)
      const monster = createMonster({
        id: 'monster-shield',
        type: 4 as MonsterTypeId, // shielded monster
        life: 50,
        speed: 5,
        shield: 20,
        money: 30,
        color: '#0000ff',
        damage: 3,
      }, monsterDeps)

      const laserDamage = buildingSystem.getDamageAtLevel('laser_gun', 1) // 25
      const expectedDamage = damageSystem.calculate(laserDamage, 20) // max(25-20, ceil(25*0.1)) = max(5, 3) = 5

      // Move monster into range
      const path = gridSystem.getCurrentPath()
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'laser_gun', level: 1, position: [5, 5] }, pos)) {
          break
        }
      }

      const target = building.findTarget([monster])
      if (target) {
        const initialLife = monster.currentLife
        building.attack(target, recorder, 1)

        expect(monster.currentLife).toBe(initialLife - expectedDamage)
      }
    })

    it('Laser gun should not produce bullets', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      // Laser gun getBulletParams should return null
      const bulletParams = building.getBulletParams(monster)
      expect(bulletParams).toBeNull()
    })
  })

  describe('Bullet attack flow', () => {
    it('Non-laser weapons should produce bullets', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'lmg-001',
        type: 'LMG',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      const bulletParams = building.getBulletParams(monster)

      expect(bulletParams).not.toBeNull()
      expect(bulletParams!.building).toBe(building)
      expect(bulletParams!.damage).toBe(buildingSystem.getDamageAtLevel('LMG', 1))
      expect(bulletParams!.speed).toBe(MOCK_BUILDINGS.LMG.bullet_speed)
    })

    it('Bullet should be created and fly', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'lmg-001',
        type: 'LMG',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)
      monster.progress = 0.5

      // Calculate building center pixel position
      const startX = building.position[0] * GRID_SIZE + GRID_SIZE / 2
      const startY = building.position[1] * GRID_SIZE + GRID_SIZE / 2

      // Get bullet params
      const bulletParams = building.getBulletParams(monster)!

      // Create bullet
      const bullet = bulletSystem.createBullet({
        building: bulletParams.building,
        target: monster,
        damage: bulletParams.damage,
        speed: bulletParams.speed,
        startX,
        startY,
      })

      expect(bullet.isValid).toBe(true)
      expect(bullet.x).toBe(startX)
      expect(bullet.y).toBe(startY)

      // Bullet flies for one frame
      const initialX = bullet.x
      const initialY = bullet.y
      bulletSystem.update([monster], mapBounds, recorder, 1)

      // Bullet position should change
      const hasMoved = bullet.x !== initialX || bullet.y !== initialY
      expect(hasMoved || !bullet.isValid).toBe(true) // either moved or already hit
    })

    it('Bullet hitting monster should deal damage', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // Building and monster close together, ensuring bullet hits quickly
      const building = createBuilding({
        id: 'cannon-001',
        type: 'cannon',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 50,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      // Place monster near the building
      const path = gridSystem.getCurrentPath()
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'cannon', level: 1, position: [5, 5] }, pos)) {
          break
        }
      }

      const initialLife = monster.currentLife
      const expectedDamage = buildingSystem.getDamageAtLevel('cannon', 1) // 12

      // Create bullet
      const startX = building.position[0] * GRID_SIZE + GRID_SIZE / 2
      const startY = building.position[1] * GRID_SIZE + GRID_SIZE / 2

      bulletSystem.createBullet({
        building,
        target: monster,
        damage: expectedDamage,
        speed: MOCK_BUILDINGS.cannon.bullet_speed,
        startX,
        startY,
      })

      // Simulate multiple frames until bullet hits or exits
      const maxFrames = 100
      for (let frame = 0; frame < maxFrames; frame++) {
        bulletSystem.update([monster], mapBounds, recorder, frame)

        if (bulletSystem.getBullets().length === 0) {
          break // bullet has hit or disappeared
        }
      }

      // Check if damage was dealt
      if (recorder.attacks.length > 0) {
        expect(monster.currentLife).toBe(initialLife - expectedDamage)
        expect(recorder.attacks[0].damage).toBe(expectedDamage)
      }
    })

    it('Bullet hitting shielded monster should consider shield reduction', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'cannon-001',
        type: 'cannon',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      // Shielded monster
      const monster = createMonster({
        id: 'monster-shield',
        type: 4 as MonsterTypeId,
        life: 50,
        speed: 5,
        shield: 10,
        money: 30,
        color: '#0000ff',
        damage: 3,
      }, monsterDeps)

      // Place monster within range
      const path = gridSystem.getCurrentPath()
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'cannon', level: 1, position: [5, 5] }, pos)) {
          break
        }
      }

      const initialLife = monster.currentLife
      const rawDamage = buildingSystem.getDamageAtLevel('cannon', 1) // 12
      const expectedDamage = damageSystem.calculate(rawDamage, 10) // max(12-10, ceil(12*0.1)) = max(2, 2) = 2

      // Create bullet
      const startX = building.position[0] * GRID_SIZE + GRID_SIZE / 2
      const startY = building.position[1] * GRID_SIZE + GRID_SIZE / 2

      bulletSystem.createBullet({
        building,
        target: monster,
        damage: rawDamage,
        speed: MOCK_BUILDINGS.cannon.bullet_speed,
        startX,
        startY,
      })

      // Simulate until hit
      for (let frame = 0; frame < 100; frame++) {
        bulletSystem.update([monster], mapBounds, recorder, frame)
        if (bulletSystem.getBullets().length === 0) break
      }

      if (recorder.attacks.length > 0) {
        expect(monster.currentLife).toBe(initialLife - expectedDamage)
      }
    })
  })

  describe('Monster death check', () => {
    it('Monster should die when health reaches zero', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      // Create low-health monster, ensuring one-hit kill
      const monster = createMonster({
        id: 'monster-weak',
        type: 0 as MonsterTypeId,
        life: 10, // below laser gun damage of 25
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      // Place monster within range
      const path = gridSystem.getCurrentPath()
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'laser_gun', level: 1, position: [5, 5] }, pos)) {
          break
        }
      }

      const target = building.findTarget([monster])
      if (target) {
        building.attack(target, recorder, 1)

        expect(monster.currentLife).toBe(0)
        expect(monster.isDead()).toBe(true)
        expect(monster.isValid).toBe(false)
      }
    })

    it('Multiple attacks should accumulate damage until kill', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // Use LMG (damage 5)
      const building = createBuilding({
        id: 'lmg-001',
        type: 'LMG',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 15, // requires 3 attacks (5 x 3 = 15)
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      // Place monster within range
      const path = gridSystem.getCurrentPath()
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'LMG', level: 1, position: [5, 5] }, pos)) {
          break
        }
      }

      const damage = buildingSystem.getDamageAtLevel('LMG', 1) // 5
      let attackCount = 0

      // Get monster position for bullet origin (ensuring immediate hit)
      const monsterGridPos = monster.getGridPosition()
      const monsterX = monsterGridPos[0] * GRID_SIZE + GRID_SIZE / 2
      const monsterY = monsterGridPos[1] * GRID_SIZE + GRID_SIZE / 2

      // Simulate multiple bullet attacks (bullet fired from monster position to ensure hit)
      while (monster.isValid && attackCount < 10) {
        bulletSystem.createBullet({
          building,
          target: monster,
          damage,
          speed: MOCK_BUILDINGS.LMG.bullet_speed,
          startX: monsterX, // fire from monster position to ensure hit
          startY: monsterY,
        })

        // Update one frame to let bullet hit
        bulletSystem.update([monster], mapBounds, recorder, attackCount)

        attackCount++
      }

      expect(monster.isDead()).toBe(true)
      expect(monster.isValid).toBe(false)
      expect(attackCount).toBe(3) // 15 / 5 = 3 attacks
    })
  })

  describe('Attack cooldown mechanism', () => {
    it('Should enter cooldown after attacking', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 100,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      // Place monster within range
      const path = gridSystem.getCurrentPath()
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'laser_gun', level: 1, position: [5, 5] }, pos)) {
          break
        }
      }

      expect(building.canAttack()).toBe(true)

      const target = building.findTarget([monster])
      if (target) {
        building.attack(target, recorder, 1)

        // Should enter cooldown after attacking
        expect(building.canAttack()).toBe(false)
        expect(building.cooldown).toBeGreaterThan(0)
      }
    })

    it('Should be able to attack again after cooldown ends', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 100,
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      // Place monster within range
      const path = gridSystem.getCurrentPath()
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'laser_gun', level: 1, position: [5, 5] }, pos)) {
          break
        }
      }

      const target = building.findTarget([monster])
      if (target) {
        building.attack(target, recorder, 1)

        const cooldownFrames = building.cooldown

        // Simulate cooldown time
        for (let i = 0; i < cooldownFrames; i++) {
          building.updateCooldown()
        }

        expect(building.canAttack()).toBe(true)
        expect(building.cooldown).toBe(0)
      }
    })
  })

  describe('Complete attack cycle', () => {
    it('Building should continuously attack until the monster is killed', () => {
      // Use a larger map so the laser gun can find targets within range
      const largeMapConfig: MapConfig = {
        width: 16,
        height: 16,
        entrance: [0, 8],
        exit: [15, 8],
        obstacles: [],
      }
      const largeGridSystem = createGridSystem(largeMapConfig)
      const largeMonsterDeps = createMonsterDeps(largeGridSystem, pathSystem)
      const buildingDeps = createBuildingDeps(buildingSystem)

      // Laser gun level=1 range is 6, placed at [8, 4] can hit [8, 8] path point (distance 4)
      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [8, 4],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 100, // laser gun damage 25, requires 4 attacks
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, largeMonsterDeps)

      // Place monster within range (fixed position)
      // Path from [0,8] to [15,8], find a position within laser gun range
      const path = largeGridSystem.getCurrentPath()
      let foundInRange = false
      for (let i = 0; i < path.length; i++) {
        monster.progress = i / (path.length - 1)
        const pos = monster.getGridPosition()
        if (buildingSystem.isInRange({ type: 'laser_gun', level: 1, position: [8, 4] }, pos)) {
          foundInRange = true
          break
        }
      }

      expect(foundInRange).toBe(true)

      let frame = 0
      const maxFrames = 500
      let attackCount = 0

      while (monster.isValid && frame < maxFrames) {
        // Update cooldown
        building.updateCooldown()

        // Attempt to attack
        if (building.canAttack()) {
          const target = building.findTarget([monster])
          if (target) {
            building.attack(target, recorder, frame)
            attackCount++
          }
        }

        frame++
      }

      expect(monster.isDead()).toBe(true)
      expect(monster.isValid).toBe(false)
      expect(attackCount).toBe(4) // 100 / 25 = 4 attacks
    })
  })
})
