/**
 * Building 实体测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createBuilding, type BuildingDependencies } from './Building'
import type { IMonster, BuildingCreateParams } from '@/types/entities'
import type { IWaveRecorder } from '@/types/recorder'
import type { BuildingType, Position } from '@/types'

// ============================================================================
// Mock 数据和工厂函数
// ============================================================================

function createMockDependencies(overrides?: Partial<BuildingDependencies>): BuildingDependencies {
  return {
    getDamageAtLevel: vi.fn((type: BuildingType, level: number) => {
      // 模拟基础伤害计算
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
      // 简单距离计算
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
// 测试用例
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
  // 创建和初始化
  // --------------------------------------------------------------------------

  describe('创建和初始化', () => {
    it('应该正确创建 Building 实例', () => {
      const building = createBuilding(defaultParams, deps)

      expect(building.id).toBe('building-1')
      expect(building.type).toBe('cannon')
      expect(building.level).toBe(1)
      expect(building.position).toEqual([5, 5])
      expect(building.cooldown).toBe(0)
      expect(building.damageDealt).toBe(0)
      expect(building.kills).toBe(0)
    })

    it('默认等级应该为 1', () => {
      const params = { ...defaultParams, level: undefined }
      const building = createBuilding(params, deps)

      expect(building.level).toBe(1)
    })

    it('应该支持不同建筑类型', () => {
      const types: BuildingType[] = ['wall', 'cannon', 'LMG', 'HMG', 'laser_gun']

      for (const type of types) {
        const building = createBuilding({ ...defaultParams, type }, deps)
        expect(building.type).toBe(type)
      }
    })
  })

  // --------------------------------------------------------------------------
  // 攻击能力检查
  // --------------------------------------------------------------------------

  describe('canAttack', () => {
    it('冷却结束时应该可以攻击', () => {
      const building = createBuilding(defaultParams, deps)
      building.cooldown = 0

      expect(building.canAttack()).toBe(true)
    })

    it('冷却中时不能攻击', () => {
      const building = createBuilding(defaultParams, deps)
      building.cooldown = 10

      expect(building.canAttack()).toBe(false)
    })

    it('wall 类型永远不能攻击', () => {
      const building = createBuilding({ ...defaultParams, type: 'wall' }, deps)
      building.cooldown = 0

      expect(building.canAttack()).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // 目标搜索
  // --------------------------------------------------------------------------

  describe('findTarget', () => {
    it('应该找到射程内的怪物', () => {
      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster({ id: 'monster-1' })
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])

      const target = building.findTarget([monster])

      expect(target).toBe(monster)
    })

    it('应该忽略无效的怪物', () => {
      const building = createBuilding(defaultParams, deps)
      const invalidMonster = createMockMonster({ isValid: false })
      const validMonster = createMockMonster({ id: 'monster-2' })
      ;(validMonster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])

      const target = building.findTarget([invalidMonster, validMonster])

      expect(target).toBe(validMonster)
    })

    it('没有怪物时应该返回 null', () => {
      const building = createBuilding(defaultParams, deps)

      const target = building.findTarget([])

      expect(target).toBeNull()
    })

    it('wall 类型应该始终返回 null', () => {
      const building = createBuilding({ ...defaultParams, type: 'wall' }, deps)
      const monster = createMockMonster()

      const target = building.findTarget([monster])

      expect(target).toBeNull()
    })

    it('应该忽略射程外的怪物', () => {
      // 配置 isInRange 返回 false
      deps.isInRange = vi.fn(() => false)

      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster()
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([100, 100])

      const target = building.findTarget([monster])

      expect(target).toBeNull()
    })

    it('应该优先选择路径进度最高的怪物', () => {
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
  // 攻击行为
  // --------------------------------------------------------------------------

  describe('attack', () => {
    it('攻击后应该设置冷却时间', () => {
      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster()
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      expect(building.cooldown).toBe(30) // cannon 的攻击间隔
    })

    it('应该记录攻击事件（非激光枪）', () => {
      const building = createBuilding(defaultParams, deps)
      const monster = createMockMonster()
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      // 非激光枪不应该直接记录攻击，由 BulletSystem 记录
      expect(recorder.recordAttack).not.toHaveBeenCalled()
    })

    it('laser_gun 应该立即命中并记录', () => {
      const building = createBuilding({ ...defaultParams, type: 'laser_gun' }, deps)
      const monster = createMockMonster()
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      // laser_gun 直接造成伤害
      expect(monster.takeDamage).toHaveBeenCalled()
      // laser_gun 应该记录攻击事件
      expect(recorder.recordAttack).toHaveBeenCalled()
    })

    it('laser_gun 攻击后应该更新统计', () => {
      const building = createBuilding({ ...defaultParams, type: 'laser_gun' }, deps)
      const monster = createMockMonster()
      ;(monster.takeDamage as ReturnType<typeof vi.fn>).mockReturnValue(25)
      ;(monster.getGridPosition as ReturnType<typeof vi.fn>).mockReturnValue([6, 6])
      const recorder = createMockRecorder()

      building.attack(monster, recorder, 100)

      expect(building.damageDealt).toBe(25)
    })

    it('laser_gun 击杀应该增加 kills', () => {
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
  // 属性获取
  // --------------------------------------------------------------------------

  describe('属性获取', () => {
    it('getDamage 应该返回当前等级的伤害', () => {
      const building = createBuilding(defaultParams, deps)

      const damage = building.getDamage()

      expect(deps.getDamageAtLevel).toHaveBeenCalledWith('cannon', 1)
      expect(damage).toBe(12)
    })

    it('getRange 应该返回当前等级的射程', () => {
      const building = createBuilding(defaultParams, deps)

      const range = building.getRange()

      expect(deps.getRangeAtLevel).toHaveBeenCalledWith('cannon', 1)
      expect(range).toBe(8)
    })

    it('getAttackSpeed 应该返回攻击间隔帧数', () => {
      const building = createBuilding(defaultParams, deps)

      const speed = building.getAttackSpeed()

      expect(deps.getAttackSpeedFrames).toHaveBeenCalledWith('cannon')
      expect(speed).toBe(30)
    })

    it('升级后属性应该正确更新', () => {
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
  // 波次统计重置
  // --------------------------------------------------------------------------

  describe('resetWaveStats', () => {
    it('应该重置波次统计数据', () => {
      const building = createBuilding(defaultParams, deps)
      building.damageDealt = 500
      building.kills = 10

      building.resetWaveStats()

      expect(building.damageDealt).toBe(0)
      expect(building.kills).toBe(0)
    })

    it('不应该重置其他状态', () => {
      const building = createBuilding(defaultParams, deps)
      building.level = 5
      building.cooldown = 10

      building.resetWaveStats()

      expect(building.level).toBe(5)
      expect(building.cooldown).toBe(10)
    })
  })

  // --------------------------------------------------------------------------
  // 冷却更新
  // --------------------------------------------------------------------------

  describe('updateCooldown', () => {
    it('每帧应该减少冷却', () => {
      const building = createBuilding(defaultParams, deps)
      building.cooldown = 10

      building.updateCooldown()

      expect(building.cooldown).toBe(9)
    })

    it('冷却不应该变成负数', () => {
      const building = createBuilding(defaultParams, deps)
      building.cooldown = 0

      building.updateCooldown()

      expect(building.cooldown).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // 子弹创建参数
  // --------------------------------------------------------------------------

  describe('getBulletParams', () => {
    it('应该返回正确的子弹创建参数', () => {
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

    it('laser_gun 应该返回 null（不使用子弹）', () => {
      const building = createBuilding({ ...defaultParams, type: 'laser_gun' }, deps)
      const monster = createMockMonster()

      const params = building.getBulletParams(monster)

      expect(params).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // 升级
  // --------------------------------------------------------------------------

  describe('upgrade', () => {
    it('应该增加等级', () => {
      const building = createBuilding(defaultParams, deps)

      building.upgrade()

      expect(building.level).toBe(2)
    })

    it('升级后伤害应该增加', () => {
      const building = createBuilding(defaultParams, deps)

      building.upgrade()
      building.getDamage()

      expect(deps.getDamageAtLevel).toHaveBeenCalledWith('cannon', 2)
    })
  })
})
