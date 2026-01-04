/**
 * Monster 实体测试
 * 基于 TDD 方式编写，测试先于实现
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createMonster, type MonsterDependencies } from './Monster'
import type { MonsterCreateParams, Path } from '@/types/entities'
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

/** 创建测试用的依赖 */
function createTestDependencies(): MonsterDependencies {
  return {
    generatePathFrom: () => createTestPath(),
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
    isPassable: () => true,
    getEntrance: () => [0, 0] as Position,
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
    it('初始时应返回入口格子', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      const pos = monster.getGridPosition()

      expect(pos).toEqual([0, 0])
    })

    it('到达终点时应返回出口格子', () => {
      // 使用高速怪物快速到达终点
      const monster = createMonster(createTestMonsterParams({ speed: 1000 }), dependencies)

      // 多次更新直到到达终点
      for (let i = 0; i < 100; i++) {
        if (!monster.isValid) break
        monster.update()
      }

      const pos = monster.getGridPosition()
      expect(pos).toEqual([4, 0])
    })

    it('移动过程中应返回对应的格子', () => {
      // 使用高速移动，减少 10% 重新寻路的影响
      // speed=320, GLOBAL_SPEED=0.1, OLD_FPS/FPS=0.4
      // 每帧移动 = 320 * 0.1 * 0.4 = 12.8 像素
      // 每格需要 32 / 12.8 = 2.5 帧
      const monster = createMonster(createTestMonsterParams({ speed: 320 }), dependencies)

      // 模拟移动若干帧后检查位置
      // 由于 10% 重新寻路机制，怪物移动可能不稳定
      // 使用足够多的帧来确保移动了至少 1 格
      for (let i = 0; i < 20; i++) {
        monster.update()
        if (!monster.isValid) break
      }

      // 高速怪物在 20 帧后应该移动了至少 1 格
      const pos = monster.getGridPosition()
      expect(pos[1]).toBe(0) // y 坐标应该是 0
      // 由于路径随机性和重新寻路，只验证怪物确实在移动
      expect(monster.progress).toBeGreaterThan(0)
    })
  })

  describe('getPixelPosition', () => {
    it('初始时应返回入口格子中心', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      const pos = monster.getPixelPosition()

      // 格子 (0, 0) 中心 = (16, 16)
      expect(pos.x).toBe(16)
      expect(pos.y).toBe(16)
    })

    it('到达终点时应返回出口格子中心', () => {
      // 使用高速怪物快速到达终点
      const monster = createMonster(createTestMonsterParams({ speed: 1000 }), dependencies)

      // 多次更新直到到达终点
      for (let i = 0; i < 100; i++) {
        if (!monster.isValid) break
        monster.update()
      }

      const pos = monster.getPixelPosition()

      // 格子 (4, 0) 中心 = (4 * 32 + 16, 16) = (144, 16)
      expect(pos.x).toBe(144)
      expect(pos.y).toBe(16)
    })

    it('移动过程中应返回正确的插值位置', () => {
      // 使用可预测的速度移动
      // speed=32, GLOBAL_SPEED=0.1, OLD_FPS/FPS=0.4
      // 每帧移动 = 32 * 0.1 * 0.4 = 1.28 像素
      const monster = createMonster(createTestMonsterParams({ speed: 32 }), dependencies)

      // 模拟移动一帧后检查位置
      monster.update()
      const pos = monster.getPixelPosition()

      // 应该向右移动了 1.28 像素
      expect(pos.x).toBeGreaterThan(16) // 起始位置是 16
      expect(pos.x).toBeLessThan(48) // 还没到第二个格子中心 (48)
      expect(pos.y).toBe(16)
    })
  })

  describe('update', () => {
    it('每帧应根据 speed 更新 progress', () => {
      const monster = createMonster(createTestMonsterParams({ speed: 3 }), dependencies)

      // 速度 3 表示每帧移动 3 格，路径 5 个点共 4 段
      // progress 增量 = speed / (路径段数 * 32)
      const initialProgress = monster.progress
      monster.update()

      expect(monster.progress).toBeGreaterThan(initialProgress)
    })

    it('到达终点时应标记为无效', () => {
      // 使用高速怪物确保能在有限帧数内到达终点
      const monster = createMonster(createTestMonsterParams({ speed: 1000 }), dependencies)

      // 多次更新直到到达终点
      for (let i = 0; i < 200; i++) {
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
        generatePathFrom: () => [],
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
        isPassable: () => true,
        getEntrance: () => [0, 0] as Position,
      }
      const monster = createMonster(createTestMonsterParams(), emptyDeps)

      expect(() => monster.getGridPosition()).not.toThrow()
      expect(() => monster.getPixelPosition()).not.toThrow()
      expect(() => monster.update()).not.toThrow()
    })

    it('单点路径应正确处理', () => {
      const singlePointDeps: MonsterDependencies = {
        generatePathFrom: () => [[5, 5]] as Position[],
        getPositionAtProgress: () => ({ x: 5 * 32 + 16, y: 5 * 32 + 16 }),
        isPassable: () => true,
        getEntrance: () => [5, 5] as Position,
      }
      const monster = createMonster(createTestMonsterParams(), singlePointDeps)

      const pos = monster.getGridPosition()
      expect(pos).toEqual([5, 5])
    })
  })

  describe('移动连续性（防止跳跃）', () => {
    it('重新寻路时像素位置应保持连续（参考旧实现）', () => {
      // 模拟重新寻路时路径方向改变的情况
      // 旧实现通过追踪像素位置 (cx, cy) 保持连续性
      // 新实现应该有相同的行为

      let pathCallCount = 0
      const repathDeps: MonsterDependencies = {
        generatePathFrom: (startPos) => {
          pathCallCount++
          if (pathCallCount === 1) {
            // 初始路径：向右移动（足够长以确保有时间触发重新寻路）
            return [
              [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
              [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
              [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0],
            ] as Position[]
          } else {
            // 重新寻路：从当前格子向下移动（方向改变）
            const [sx, sy] = startPos
            return [
              [sx, sy],
              [sx, sy + 1],
              [sx, sy + 2],
              [sx, sy + 3],
              [sx, sy + 4],
              [sx, sy + 5],
            ] as Position[]
          }
        },
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
        isPassable: () => true,
        getEntrance: () => [0, 0] as Position,
      }

      // 使用较高速度，确保能穿越足够多格子触发 10% 重新寻路
      // speed=128, GLOBAL_SPEED=0.1, OLD_FPS/FPS=0.4
      // 每帧移动 = 128 * 0.1 * 0.4 = 5.12 像素
      // 穿越一个格子 (32 像素) 约需 6-7 帧
      // 10% 重新寻路只在到达格子中心时触发
      const monster = createMonster(createTestMonsterParams({ speed: 128 }), repathDeps)

      // 移动若干帧，让怪物进入路径中段
      for (let i = 0; i < 10; i++) {
        monster.update()
      }

      // 触发重新寻路（通过多次 update，10% 概率在格子交接点触发）
      const initialPathCallCount = pathCallCount
      let repathOccurred = false

      // 增加帧数以确保穿越足够多格子来触发 10% 重新寻路
      for (let i = 0; i < 500 && !repathOccurred && monster.isValid; i++) {
        const posBeforeUpdate = monster.getPixelPosition()
        monster.update()
        const posAfterUpdate = monster.getPixelPosition()

        if (pathCallCount > initialPathCallCount) {
          repathOccurred = true

          // 关键断言：重新寻路后像素位置变化应该很小
          // 每帧最大移动距离约 1.28 像素，不应该有大幅跳跃
          const dx = Math.abs(posAfterUpdate.x - posBeforeUpdate.x)
          const dy = Math.abs(posAfterUpdate.y - posBeforeUpdate.y)
          const distance = Math.sqrt(dx * dx + dy * dy)

          // 单帧移动距离不应超过几个像素
          // 如果有跳跃，距离会远超这个值
          const maxExpectedMove = 10
          expect(distance).toBeLessThan(maxExpectedMove)
        }
      }

      expect(repathOccurred).toBe(true)
    })

    it('每帧移动应该是平滑的（无大幅跳跃）', () => {
      const monster = createMonster(createTestMonsterParams({ speed: 64 }), dependencies)

      let lastPos = monster.getPixelPosition()
      const jumpThreshold = 20 // 单帧跳跃超过这个距离视为异常

      for (let i = 0; i < 100 && monster.isValid; i++) {
        monster.update()
        const currentPos = monster.getPixelPosition()

        const dx = Math.abs(currentPos.x - lastPos.x)
        const dy = Math.abs(currentPos.y - lastPos.y)
        const distance = Math.sqrt(dx * dx + dy * dy)

        // 单帧移动不应有大幅跳跃
        expect(distance).toBeLessThan(jumpThreshold)

        lastPos = currentPos
      }
    })

    it('10% 重新寻路应只在到达格子中心时触发（参考旧实现）', () => {
      // 旧实现: 10% 重新寻路只在怪物到达格子中心后选择下一个目标时触发
      // 而不是每帧都有 10% 概率触发
      // 这保证了怪物在两个格子之间移动时方向稳定

      let pathCallCount = 0
      const trackingDeps: MonsterDependencies = {
        generatePathFrom: () => {
          pathCallCount++
          // 返回一条长路径
          return [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
            [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
          ] as Position[]
        },
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
        isPassable: () => true,
        getEntrance: () => [0, 0] as Position,
      }

      // 使用慢速怪物，确保每个格子需要多帧才能通过
      // speed=16, GLOBAL_SPEED=0.1, OLD_FPS/FPS=0.4
      // 每帧移动 = 16 * 0.1 * 0.4 = 0.64 像素
      // 每格需要 32 / 0.64 = 50 帧
      const monster = createMonster(createTestMonsterParams({ speed: 16 }), trackingDeps)
      const initialPathCallCount = pathCallCount

      // 运行 30 帧，怪物应该还在第一个格子内
      // 如果每帧都有 10% 概率重新寻路，预期会有约 3 次重新寻路
      // 如果只在格子边界重新寻路，应该没有额外的寻路调用
      for (let i = 0; i < 30; i++) {
        monster.update()
      }

      // 在格子内移动时不应该触发额外的寻路
      // 允许最多 1 次额外寻路（由于路径阻塞检查）
      const additionalPathCalls = pathCallCount - initialPathCallCount
      expect(additionalPathCalls).toBeLessThanOrEqual(1)
    })

    it('怪物移动方向应保持稳定（无左右晃动）', () => {
      // 测试怪物在两个格子之间移动时方向不会频繁改变
      let pathCallCount = 0
      const stableDeps: MonsterDependencies = {
        generatePathFrom: () => {
          pathCallCount++
          // 返回一条直线路径（向右移动）
          return [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
            [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
          ] as Position[]
        },
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
        isPassable: () => true,
        getEntrance: () => [0, 0] as Position,
      }

      const monster = createMonster(createTestMonsterParams({ speed: 32 }), stableDeps)

      // 记录方向变化次数
      let directionChanges = 0
      let lastDirection = { dx: 0, dy: 0 }
      let lastPos = monster.getPixelPosition()

      for (let i = 0; i < 100 && monster.isValid; i++) {
        monster.update()
        const currentPos = monster.getPixelPosition()

        const dx = currentPos.x - lastPos.x
        const dy = currentPos.y - lastPos.y

        // 检查方向是否改变（忽略静止状态）
        if (dx !== 0 || dy !== 0) {
          const currentDirection = {
            dx: dx > 0 ? 1 : dx < 0 ? -1 : 0,
            dy: dy > 0 ? 1 : dy < 0 ? -1 : 0,
          }

          if (lastDirection.dx !== 0 || lastDirection.dy !== 0) {
            if (currentDirection.dx !== lastDirection.dx ||
                currentDirection.dy !== lastDirection.dy) {
              directionChanges++
            }
          }

          lastDirection = currentDirection
        }

        lastPos = currentPos
      }

      // 在直线路径上，方向变化应该很少（最多在格子边界处）
      // 如果频繁重新寻路导致晃动，方向变化次数会很高
      expect(directionChanges).toBeLessThan(5)
    })
  })
})
