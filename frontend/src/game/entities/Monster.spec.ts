/**
 * Monster 实体测试
 * 基于 TDD 方式编写，测试先于实现
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createMonster, type MonsterDependencies } from './Monster'
import type { MonsterCreateParams, MapState, Path } from '@/types/entities'
import type { MonsterTypeId, Position } from '@/types'

// ============================================================================
// 测试 fixtures
// ============================================================================

/** 创建测试用的怪物参数 */
function createTestMonsterParams(overrides: Partial<MonsterCreateParams> = {}): MonsterCreateParams {
  return {
    id: 'test-monster-001',
    type: 0 as MonsterTypeId,
    life: 50,
    speed: 3,
    shield: 0,
    money: 10,
    color: '#00ff00',
    damage: 1,
    ...overrides,
  }
}

/** 创建测试用的路径 */
function createTestPath(): Path {
  return [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ] as Position[]
}

/** 创建测试用的地图状态 */
function createTestMapState(): MapState {
  return {
    width: 16,
    height: 16,
    cells: [],
    cachedPath: createTestPath(),
  }
}

/** 创建测试用的依赖 */
function createTestDependencies(): MonsterDependencies {
  return {
    getPath: () => createTestPath(),
    getPositionAtProgress: (path: Path, progress: number) => {
      if (path.length === 0) return { x: 0, y: 0 }
      if (path.length === 1) return { x: path[0][0] * 32 + 16, y: path[0][1] * 32 + 16 }

      const totalSegments = path.length - 1
      const clampedProgress = Math.max(0, Math.min(1, progress))
      const exactPosition = clampedProgress * totalSegments
      const segmentIndex = Math.min(Math.floor(exactPosition), totalSegments - 1)
      const segmentProgress = exactPosition - segmentIndex

      const [startX, startY] = path[segmentIndex]
      const [endX, endY] = path[segmentIndex + 1]

      return {
        x: (startX * 32 + 16) + ((endX - startX) * 32) * segmentProgress,
        y: (startY * 32 + 16) + ((endY - startY) * 32) * segmentProgress,
      }
    },
  }
}

// ============================================================================
// 测试用例
// ============================================================================

describe('Monster', () => {
  let dependencies: MonsterDependencies

  beforeEach(() => {
    dependencies = createTestDependencies()
  })

  describe('创建', () => {
    it('应正确初始化所有属性', () => {
      const params = createTestMonsterParams()
      const monster = createMonster(params, dependencies)

      expect(monster.id).toBe('test-monster-001')
      expect(monster.type).toBe(0)
      expect(monster.maxLife).toBe(50)
      expect(monster.currentLife).toBe(50)
      expect(monster.speed).toBe(3)
      expect(monster.shield).toBe(0)
      expect(monster.money).toBe(10)
      expect(monster.color).toBe('#00ff00')
      expect(monster.damage).toBe(1)
      expect(monster.progress).toBe(0)
      expect(monster.isValid).toBe(true)
    })

    it('应正确初始化有护盾的怪物', () => {
      const params = createTestMonsterParams({ shield: 20 })
      const monster = createMonster(params, dependencies)

      expect(monster.shield).toBe(20)
    })

    it('应正确初始化高级怪物', () => {
      const params = createTestMonsterParams({
        type: 8 as MonsterTypeId,
        life: 300,
        speed: 3,
        shield: 15,
        money: 60,
        damage: 5,
        color: '#ff6600',
      })
      const monster = createMonster(params, dependencies)

      expect(monster.type).toBe(8)
      expect(monster.maxLife).toBe(300)
      expect(monster.shield).toBe(15)
      expect(monster.damage).toBe(5)
    })
  })

  describe('radius', () => {
    it('应根据 damage 计算 radius: floor(damage * 1.2)', () => {
      // damage = 5, radius = floor(5 * 1.2) = 6
      const monster = createMonster(createTestMonsterParams({ damage: 5 }), dependencies)
      expect(monster.radius).toBe(6)
    })

    it('radius 最小值应为 4', () => {
      // damage = 1, floor(1 * 1.2) = 1, 但最小值为 4
      const monster = createMonster(createTestMonsterParams({ damage: 1 }), dependencies)
      expect(monster.radius).toBe(4)
    })

    it('radius 最大值应为 12', () => {
      // damage = 20, floor(20 * 1.2) = 24, 但最大值为 12
      const monster = createMonster(createTestMonsterParams({ damage: 20 }), dependencies)
      expect(monster.radius).toBe(12)
    })

    it('高伤害怪物应有更大的 radius', () => {
      const lowDamageMonster = createMonster(createTestMonsterParams({ damage: 3 }), dependencies)
      const highDamageMonster = createMonster(createTestMonsterParams({ damage: 10 }), dependencies)

      // damage = 3, radius = max(floor(3 * 1.2), 4) = 4
      expect(lowDamageMonster.radius).toBe(4)
      // damage = 10, radius = floor(10 * 1.2) = 12
      expect(highDamageMonster.radius).toBe(12)
      expect(highDamageMonster.radius).toBeGreaterThan(lowDamageMonster.radius)
    })
  })

  describe('takeDamage', () => {
    it('无护盾时应造成全额伤害', () => {
      const monster = createMonster(createTestMonsterParams({ life: 100, shield: 0 }), dependencies)

      const actualDamage = monster.takeDamage(30)

      expect(actualDamage).toBe(30)
      expect(monster.currentLife).toBe(70)
    })

    it('有护盾时应减少伤害', () => {
      const monster = createMonster(createTestMonsterParams({ life: 100, shield: 10 }), dependencies)

      const actualDamage = monster.takeDamage(30)

      expect(actualDamage).toBe(20) // 30 - 10 = 20
      expect(monster.currentLife).toBe(80)
    })

    it('护盾应保证最低 10% 伤害', () => {
      const monster = createMonster(createTestMonsterParams({ life: 100, shield: 50 }), dependencies)

      const actualDamage = monster.takeDamage(30)

      // 30 - 50 = -20，但最低伤害 = ceil(30 * 0.1) = 3
      expect(actualDamage).toBe(3)
      expect(monster.currentLife).toBe(97)
    })

    it('高伤害武器应对护盾怪造成更多伤害', () => {
      const monster1 = createMonster(createTestMonsterParams({ life: 100, shield: 20 }), dependencies)
      const monster2 = createMonster(createTestMonsterParams({ life: 100, shield: 20 }), dependencies)

      // 低伤害武器
      const damage1 = monster1.takeDamage(10) // max(10 - 20, 1) = 1
      // 高伤害武器
      const damage2 = monster2.takeDamage(50) // max(50 - 20, 5) = 30

      expect(damage1).toBe(1) // ceil(10 * 0.1) = 1
      expect(damage2).toBe(30) // 50 - 20 = 30
    })

    it('shield 是静态值，不会随受击递减', () => {
      const monster = createMonster(createTestMonsterParams({ shield: 10 }), dependencies)

      expect(monster.shield).toBe(10)

      monster.takeDamage(5)
      // 与旧实现一致，shield 不变
      expect(monster.shield).toBe(10)

      monster.takeDamage(5)
      expect(monster.shield).toBe(10)
    })

    it('生命值不应低于 0', () => {
      const monster = createMonster(createTestMonsterParams({ life: 10, shield: 0 }), dependencies)

      monster.takeDamage(100)

      expect(monster.currentLife).toBe(0)
    })

    it('死亡后不应再受到伤害', () => {
      const monster = createMonster(createTestMonsterParams({ life: 10, shield: 0 }), dependencies)

      monster.takeDamage(10)
      expect(monster.currentLife).toBe(0)
      expect(monster.isValid).toBe(false)

      const additionalDamage = monster.takeDamage(50)
      expect(additionalDamage).toBe(0)
      expect(monster.currentLife).toBe(0)
    })
  })

  describe('isDead', () => {
    it('生命值 > 0 时应返回 false', () => {
      const monster = createMonster(createTestMonsterParams({ life: 50 }), dependencies)

      expect(monster.isDead()).toBe(false)
    })

    it('生命值 = 0 时应返回 true', () => {
      const monster = createMonster(createTestMonsterParams({ life: 10 }), dependencies)

      monster.takeDamage(10)

      expect(monster.isDead()).toBe(true)
    })

    it('生命值 < 0 时应返回 true', () => {
      const monster = createMonster(createTestMonsterParams({ life: 10 }), dependencies)

      monster.takeDamage(100)

      expect(monster.isDead()).toBe(true)
    })
  })

  describe('reachedExit', () => {
    it('progress < 1 时应返回 false', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 0.5

      expect(monster.reachedExit()).toBe(false)
    })

    it('progress = 1 时应返回 true', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 1

      expect(monster.reachedExit()).toBe(true)
    })

    it('progress > 1 时应返回 true', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 1.1

      expect(monster.reachedExit()).toBe(true)
    })
  })

  describe('getGridPosition', () => {
    it('progress = 0 时应返回入口格子', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 0
      const pos = monster.getGridPosition()

      expect(pos).toEqual([0, 0])
    })

    it('progress = 1 时应返回出口格子', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 1
      const pos = monster.getGridPosition()

      expect(pos).toEqual([4, 0])
    })

    it('progress = 0.5 时应返回中间格子', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 0.5
      const pos = monster.getGridPosition()

      expect(pos).toEqual([2, 0])
    })
  })

  describe('getPixelPosition', () => {
    it('progress = 0 时应返回入口格子中心', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 0
      const pos = monster.getPixelPosition()

      // 格子 (0, 0) 中心 = (16, 16)
      expect(pos.x).toBe(16)
      expect(pos.y).toBe(16)
    })

    it('progress = 1 时应返回出口格子中心', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 1
      const pos = monster.getPixelPosition()

      // 格子 (4, 0) 中心 = (4 * 32 + 16, 16) = (144, 16)
      expect(pos.x).toBe(144)
      expect(pos.y).toBe(16)
    })

    it('progress 介于两个格子之间时应返回插值位置', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      // 4 段路径，progress = 0.125 = 0.5 / 4，表示在第一段的中点
      monster.progress = 0.125
      const pos = monster.getPixelPosition()

      // 从 (0,0) 到 (1,0)，中点应在 x = 32
      expect(pos.x).toBe(32)
      expect(pos.y).toBe(16)
    })
  })

  describe('update', () => {
    it('每帧应根据 speed 更新 progress', () => {
      const monster = createMonster(createTestMonsterParams({ speed: 3 }), dependencies)
      const path = createTestPath()

      // 速度 3 表示每帧移动 3 格，路径 5 个点共 4 段
      // progress 增量 = speed / (路径段数 * 32)
      const initialProgress = monster.progress
      monster.update()

      expect(monster.progress).toBeGreaterThan(initialProgress)
    })

    it('到达终点时应标记为无效', () => {
      const monster = createMonster(createTestMonsterParams({ speed: 100 }), dependencies)

      // 多次更新直到到达终点
      for (let i = 0; i < 100; i++) {
        monster.update()
        if (!monster.isValid) break
      }

      expect(monster.reachedExit()).toBe(true)
      expect(monster.isValid).toBe(false)
    })

    it('已无效的怪物不应更新', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      // 标记为无效
      monster.isValid = false
      const initialProgress = monster.progress

      monster.update()

      expect(monster.progress).toBe(initialProgress)
    })
  })

  describe('边界情况', () => {
    it('空路径时不应崩溃', () => {
      const emptyDeps: MonsterDependencies = {
        getPath: () => [],
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
      }
      const monster = createMonster(createTestMonsterParams(), emptyDeps)

      expect(() => monster.getGridPosition()).not.toThrow()
      expect(() => monster.getPixelPosition()).not.toThrow()
      expect(() => monster.update()).not.toThrow()
    })

    it('单点路径应正确处理', () => {
      const singlePointDeps: MonsterDependencies = {
        getPath: () => [[5, 5]] as Position[],
        getPositionAtProgress: () => ({ x: 5 * 32 + 16, y: 5 * 32 + 16 }),
      }
      const monster = createMonster(createTestMonsterParams(), singlePointDeps)

      const pos = monster.getGridPosition()
      expect(pos).toEqual([5, 5])
    })
  })
})
