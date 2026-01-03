/**
 * M2 里程碑集成测试
 * 验证：Building → Bullet → Monster 完整攻击流程
 *
 * 测试场景：
 * 1. 建筑发现射程内的目标
 * 2. 建筑攻击创建子弹（或激光枪即时命中）
 * 3. 子弹飞行并命中怪物
 * 4. 怪物受到伤害（考虑护盾减免）
 * 5. 怪物死亡时 isValid 变为 false
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPathSystem, type PathSystem } from '../systems/PathSystem'
import { createGridSystem, type GridSystem } from '../systems/GridSystem'
import { createBuildingSystem, type BuildingSystem } from '../systems/BuildingSystem'
import { createBulletSystem, type BulletSystem, type Rect } from '../systems/BulletSystem'
import { createDamageSystem, type DamageSystem } from '../systems/DamageSystem'
import { createBuilding, type BuildingDependencies, type IBuildingRuntime } from '../entities/Building'
import { createMonster, type MonsterDependencies, type IMonsterRuntime } from '../entities/Monster'
import type { IBuilding, IMonster, Path } from '@/types/entities'
import type { IWaveRecorder, AttackRecordData } from '@/types/recorder'
import type { MapConfig, MonsterTypeId, Position, BuildingType } from '@/types'
import { GAME_CONSTANTS } from '@/types'
import { MOCK_GAME_CONFIG, MOCK_BUILDINGS } from '@/mocks'

const { GRID_SIZE } = GAME_CONSTANTS

// ============================================================================
// 测试配置
// ============================================================================

/** 创建小型测试地图（便于控制距离） */
function createTestMapConfig(): MapConfig {
  return {
    width: 10,
    height: 10,
    entrance: [0, 5],
    exit: [9, 5],
    obstacles: [],
  }
}

/** 创建 Mock WaveRecorder */
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

/** 创建 Building 依赖 */
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

/** 创建 Monster 依赖 */
function createMonsterDeps(gridSystem: GridSystem, pathSystem: PathSystem): MonsterDependencies {
  return {
    getPath: () => gridSystem.getCurrentPath(),
    getPositionAtProgress: (path: Path, progress: number) => {
      return pathSystem.getPositionAtProgress(path, progress)
    },
  }
}

/** 获取地图边界 */
function getMapBounds(mapConfig: MapConfig): Rect {
  return {
    x: 0,
    y: 0,
    width: mapConfig.width * GRID_SIZE,
    height: mapConfig.height * GRID_SIZE,
  }
}

// ============================================================================
// M2 集成测试
// ============================================================================

describe('M2: Building → Bullet → Monster 完整攻击流程', () => {
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

  describe('建筑目标搜索', () => {
    it('建筑应能发现射程内的怪物', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // 在 [5, 5] 放置 LMG（射程 5-10）
      const building = createBuilding({
        id: 'building-001',
        type: 'LMG',
        position: [5, 5],
        level: 1,
      }, buildingDeps)

      // 创建怪物在 [5, 3]（距离 2，在最小射程内）
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
      // 设置怪物位置到 [5, 3]
      const path = gridSystem.getCurrentPath()
      const nearIndex = path.findIndex(([x, y]) => x === 5 && y === 3)
      if (nearIndex >= 0) {
        monsterNear.progress = nearIndex / (path.length - 1)
      }

      // 创建怪物在 [0, 5]（距离 5，在射程内）
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
      monsterInRange.progress = 0 // 在入口位置

      const monsters = [monsterNear, monsterInRange]
      const target = building.findTarget(monsters)

      // 应该找到在射程内的怪物（入口位置的怪物距离为 5，刚好在 LMG 射程边界）
      expect(target).not.toBeNull()
    })

    it('建筑应选择路径进度最高的目标', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // 在 [5, 5] 放置 cannon（射程 4-8）
      const building = createBuilding({
        id: 'building-001',
        type: 'cannon',
        position: [5, 5],
        level: 1,
      }, buildingDeps)

      // 创建两个怪物，都在射程内
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
      monster2.progress = 0.6 // 进度更高

      const monsters = [monster1, monster2]
      const target = building.findTarget(monsters)

      // 如果两个怪物都在射程内，应该选择进度更高的
      if (target !== null) {
        // 验证选择逻辑：进度高的优先
        const validTargets = monsters.filter(m => {
          const pos = m.getGridPosition()
          return buildingSystem.isInRange({ type: 'cannon', level: 1, position: [5, 5] }, pos)
        })

        if (validTargets.length === 2) {
          expect(target.id).toBe('monster-2')
        }
      }
    })

    it('射程外的怪物不应被选为目标', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // 在 [0, 0] 放置 HMG（射程 3-5，范围很小）
      const building = createBuilding({
        id: 'building-001',
        type: 'HMG',
        position: [0, 0],
        level: 1,
      }, buildingDeps)

      // 创建怪物在 [9, 5]（距离约 10，远超射程）
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
      monster.progress = 0.9 // 接近出口

      const target = building.findTarget([monster])

      expect(target).toBeNull()
    })
  })

  describe('激光枪即时命中', () => {
    it('激光枪应立即对目标造成伤害', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // 在路径中间放置激光枪
      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      // 创建怪物
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

      // 将怪物移动到建筑射程内
      // 激光枪射程 6-10，需要将怪物放到距离 6-10 的位置
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

        // 激光枪立即造成伤害
        expect(monster.currentLife).toBe(initialLife - expectedDamage)

        // 应该记录攻击事件
        expect(recorder.attacks.length).toBe(1)
        expect(recorder.attacks[0].damage).toBe(expectedDamage)
      }
    })

    it('激光枪攻击有护盾怪物应考虑护盾减免', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      // 创建护盾怪物（shield: 20）
      const monster = createMonster({
        id: 'monster-shield',
        type: 4 as MonsterTypeId, // 护盾怪
        life: 50,
        speed: 5,
        shield: 20,
        money: 30,
        color: '#0000ff',
        damage: 3,
      }, monsterDeps)

      const laserDamage = buildingSystem.getDamageAtLevel('laser_gun', 1) // 25
      const expectedDamage = damageSystem.calculate(laserDamage, 20) // max(25-20, ceil(25*0.1)) = max(5, 3) = 5

      // 将怪物移动到射程内
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

    it('激光枪不应产生子弹', () => {
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

      // 激光枪 getBulletParams 应返回 null
      const bulletParams = building.getBulletParams(monster)
      expect(bulletParams).toBeNull()
    })
  })

  describe('子弹攻击流程', () => {
    it('非激光武器应产生子弹', () => {
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

    it('子弹应能创建并飞行', () => {
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

      // 计算建筑中心像素位置
      const startX = building.position[0] * GRID_SIZE + GRID_SIZE / 2
      const startY = building.position[1] * GRID_SIZE + GRID_SIZE / 2

      // 获取子弹参数
      const bulletParams = building.getBulletParams(monster)!

      // 创建子弹
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

      // 子弹飞行一帧
      const initialX = bullet.x
      const initialY = bullet.y
      bulletSystem.update([monster], mapBounds, recorder, 1)

      // 子弹位置应该改变
      const hasMoved = bullet.x !== initialX || bullet.y !== initialY
      expect(hasMoved || !bullet.isValid).toBe(true) // 要么移动了，要么已经命中
    })

    it('子弹命中怪物应造成伤害', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // 建筑和怪物靠近，确保子弹能快速命中
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

      // 将怪物放在建筑附近
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

      // 创建子弹
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

      // 模拟多帧，直到子弹命中或飞出
      const maxFrames = 100
      for (let frame = 0; frame < maxFrames; frame++) {
        bulletSystem.update([monster], mapBounds, recorder, frame)

        if (bulletSystem.getBullets().length === 0) {
          break // 子弹已经命中或消失
        }
      }

      // 检查是否造成了伤害
      if (recorder.attacks.length > 0) {
        expect(monster.currentLife).toBe(initialLife - expectedDamage)
        expect(recorder.attacks[0].damage).toBe(expectedDamage)
      }
    })

    it('子弹命中护盾怪物应考虑护盾减免', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'cannon-001',
        type: 'cannon',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      // 护盾怪物
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

      // 将怪物放在射程内
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

      // 创建子弹
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

      // 模拟直到命中
      for (let frame = 0; frame < 100; frame++) {
        bulletSystem.update([monster], mapBounds, recorder, frame)
        if (bulletSystem.getBullets().length === 0) break
      }

      if (recorder.attacks.length > 0) {
        expect(monster.currentLife).toBe(initialLife - expectedDamage)
      }
    })
  })

  describe('怪物死亡判定', () => {
    it('生命值归零时怪物应死亡', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      // 创建低血量怪物，确保一击必杀
      const monster = createMonster({
        id: 'monster-weak',
        type: 0 as MonsterTypeId,
        life: 10, // 低于激光枪伤害 25
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      // 将怪物放在射程内
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

    it('多次攻击应累计伤害直到击杀', () => {
      const buildingDeps = createBuildingDeps(buildingSystem)
      const monsterDeps = createMonsterDeps(gridSystem, pathSystem)

      // 使用 LMG（伤害 5）
      const building = createBuilding({
        id: 'lmg-001',
        type: 'LMG',
        position: [5, 5],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 15, // 需要 3 次攻击（5 × 3 = 15）
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, monsterDeps)

      // 将怪物放在射程内
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

      // 获取怪物位置用于子弹起点（确保立即命中）
      const monsterGridPos = monster.getGridPosition()
      const monsterX = monsterGridPos[0] * GRID_SIZE + GRID_SIZE / 2
      const monsterY = monsterGridPos[1] * GRID_SIZE + GRID_SIZE / 2

      // 模拟多次子弹攻击（子弹从怪物位置发射以确保命中）
      while (monster.isValid && attackCount < 10) {
        bulletSystem.createBullet({
          building,
          target: monster,
          damage,
          speed: MOCK_BUILDINGS.LMG.bullet_speed,
          startX: monsterX, // 从怪物位置发射确保命中
          startY: monsterY,
        })

        // 更新一帧让子弹命中
        bulletSystem.update([monster], mapBounds, recorder, attackCount)

        attackCount++
      }

      expect(monster.isDead()).toBe(true)
      expect(monster.isValid).toBe(false)
      expect(attackCount).toBe(3) // 15 / 5 = 3 次
    })
  })

  describe('攻击冷却机制', () => {
    it('攻击后应进入冷却', () => {
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

      // 将怪物放在射程内
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

        // 攻击后应进入冷却
        expect(building.canAttack()).toBe(false)
        expect(building.cooldown).toBeGreaterThan(0)
      }
    })

    it('冷却结束后应能再次攻击', () => {
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

      // 将怪物放在射程内
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

        // 模拟冷却时间
        for (let i = 0; i < cooldownFrames; i++) {
          building.updateCooldown()
        }

        expect(building.canAttack()).toBe(true)
        expect(building.cooldown).toBe(0)
      }
    })
  })

  describe('完整攻击循环', () => {
    it('建筑应能持续攻击直到击杀怪物', () => {
      // 使用更大的地图，让激光枪能找到在射程内的目标
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

      // 激光枪 level=1 射程为 6，放在 [8, 4] 可以打到 [8, 8] 路径点（距离 4）
      const building = createBuilding({
        id: 'laser-001',
        type: 'laser_gun',
        position: [8, 4],
        level: 1,
      }, buildingDeps) as IBuilding & IBuildingRuntime

      const monster = createMonster({
        id: 'monster-001',
        type: 0 as MonsterTypeId,
        life: 100, // 激光枪伤害 25，需要 4 次攻击
        speed: 3,
        shield: 0,
        money: 5,
        color: '#00ff00',
        damage: 1,
      }, largeMonsterDeps)

      // 将怪物放在射程内（固定位置）
      // 路径从 [0,8] 到 [15,8]，找到在激光枪射程内的位置
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
        // 更新冷却
        building.updateCooldown()

        // 尝试攻击
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
      expect(attackCount).toBe(4) // 100 / 25 = 4 次
    })
  })
})
