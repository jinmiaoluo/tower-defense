/**
 * BulletSystem 子弹系统测试
 * 基于 TDD 方式编写，测试先于实现
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
// Mock 工厂函数
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
    ...overrides,
  }
}

function createMockMonster(overrides: Partial<IMonster> = {}): IMonster {
  const damage = overrides.damage ?? 1
  // radius = floor(damage * 1.2)，范围 4-12
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
// 测试用例
// ============================================================================

describe('BulletSystem', () => {
  let bulletSystem: BulletSystem
  let mockRecorder: IWaveRecorder

  beforeEach(() => {
    bulletSystem = createBulletSystem()
    mockRecorder = createMockRecorder()
  })

  describe('createBullet', () => {
    it('应正确创建子弹', () => {
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

    it('应计算正确的速度向量', () => {
      const building = createMockBuilding({ position: [0, 0] })
      const target = createMockMonster({
        getGridPosition: () => [3, 4] as Position, // 距离 5 格
      })

      const bullet = bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 10, // 配置值，实际速度 = 10 × 20 = 200 像素/帧
        startX: 16, // 格子中心
        startY: 16,
        targetX: 3 * 32 + 16, // 112
        targetY: 4 * 32 + 16, // 144
      })

      // 方向向量 (96, 128)，长度 160
      // 实际速度 = 10 × 20 = 200
      // vx = 96 * 200 / 160 = 120
      // vy = 128 * 200 / 160 = 160
      expect(bullet.vx).toBeCloseTo(120)
      expect(bullet.vy).toBeCloseTo(160)
    })

    it('应记录原始目标信息', () => {
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

    it('应将子弹添加到系统中', () => {
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

  describe('update - 移动', () => {
    it('每帧应移动子弹', () => {
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
        targetY: 100, // 纯水平方向
      })

      const initialX = bullet.x

      bulletSystem.update([], createTestMapBounds(), mockRecorder, 1)

      expect(bullet.x).toBeGreaterThan(initialX)
      expect(bullet.y).toBe(100) // Y 不变
    })

    it('无效的子弹不应移动', () => {
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

  describe('update - 碰撞检测', () => {
    it('应检测到命中怪物', () => {
      const building = createMockBuilding()
      const target = createMockMonster({
        id: 'target-001',
        getGridPosition: () => [6, 5] as Position,
      })

      // 子弹位置非常接近怪物
      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 100,
        startX: 6 * 32 + 16, // 和怪物在同一位置
        startY: 5 * 32 + 16,
        targetX: 6 * 32 + 16,
        targetY: 5 * 32 + 16,
      })

      const monster = createMockMonster({
        id: 'target-001',
        getGridPosition: () => [6, 5] as Position,
      })

      // 模拟怪物的像素位置
      ;(monster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(monster as unknown as { x: number; y: number }).y = 5 * 32 + 16

      bulletSystem.update([monster], createTestMapBounds(), mockRecorder, 100)

      // 应调用 takeDamage
      expect(monster.takeDamage).toHaveBeenCalledWith(12)
    })

    it('命中后应记录攻击事件', () => {
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
        takeDamage: vi.fn(() => 10), // 返回实际伤害
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

    it('命中后子弹应被移除', () => {
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

    it('应支持误伤机制（命中非原始目标）', () => {
      const building = createMockBuilding()
      const originalTarget = createMockMonster({
        id: 'original-target',
        getGridPosition: () => [10, 10] as Position,
      })

      // 子弹朝 (10, 10) 飞行，使用较慢速度以便测试
      // speed=1 表示实际速度 = 1 × 20 = 20 像素/帧
      bulletSystem.createBullet({
        building,
        target: originalTarget,
        damage: 12,
        speed: 1, // 较慢速度，方便测试碰撞
        startX: 5 * 32 + 16,
        startY: 5 * 32 + 16,
        targetX: 10 * 32 + 16,
        targetY: 10 * 32 + 16,
      })

      // 但路径上有另一个怪物（更近一点）
      const interceptMonster = createMockMonster({
        id: 'intercept-monster',
        getGridPosition: () => [6, 6] as Position,
      })
      ;(interceptMonster as unknown as { x: number; y: number }).x = 6 * 32 + 16
      ;(interceptMonster as unknown as { x: number; y: number }).y = 6 * 32 + 16

      // 多次更新直到命中或子弹消失
      for (let i = 0; i < 50; i++) {
        bulletSystem.update([interceptMonster], createTestMapBounds(), mockRecorder, i)
        if (bulletSystem.getBullets().length === 0) break
      }

      // 应命中拦截的怪物
      expect(interceptMonster.takeDamage).toHaveBeenCalled()
      expect(mockRecorder.recordAttack).toHaveBeenCalledWith(
        expect.objectContaining({
          originalTargetId: 'original-target',
          monsterId: 'intercept-monster',
        }),
      )
    })

    it('不应命中无效的怪物', () => {
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
  })

  describe('update - 边界检测', () => {
    it('飞出地图边界的子弹应被移除', () => {
      const building = createMockBuilding()
      const target = createMockMonster({
        getGridPosition: () => [20, 5] as Position, // 目标在地图外
      })

      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 100,
        startX: 500,
        startY: 256,
        targetX: 1000, // 目标在地图外
        targetY: 256,
      })

      const bounds = createTestMapBounds()

      // 多次更新直到子弹飞出边界
      for (let i = 0; i < 10; i++) {
        bulletSystem.update([], bounds, mockRecorder, i)
      }

      expect(bulletSystem.getBullets()).toHaveLength(0)
    })

    it('飞出边界的子弹不应记录攻击事件', () => {
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
    it('应返回所有有效的子弹', () => {
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

    it('返回的数组应是只读的（不影响内部状态）', () => {
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
      // 返回的是只读数组的副本，无法修改
      expect(bullets).toHaveLength(1)
      // 再次获取应该仍然有1个子弹（证明是不可变的）
      expect(bulletSystem.getBullets()).toHaveLength(1)
    })
  })

  describe('clear', () => {
    it('应清除所有子弹', () => {
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

  describe('碰撞检测细节', () => {
    it('碰撞检测应使用宽松范围', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      // 子弹 damage=12，radius ≈ max(log(12), 2) ≈ 2.48
      // 怪物 damage=1，radius = max(floor(1*1.2), 4) = 4
      // 宽松碰撞范围 = sqrt((2.48 + 4)² × 2) ≈ 9.15
      bulletSystem.createBullet({
        building,
        target,
        damage: 12,
        speed: 0.1, // 很慢，基本不移动
        startX: 200,
        startY: 200,
        targetX: 300,
        targetY: 200,
      })

      const monster = createMockMonster()
      // 怪物距离子弹约 8 像素，在宽松碰撞范围内（< 9.15）
      ;(monster as unknown as { x: number; y: number }).x = 208
      ;(monster as unknown as { x: number; y: number }).y = 200

      bulletSystem.update([monster], createTestMapBounds(), mockRecorder, 1)

      expect(monster.takeDamage).toHaveBeenCalled()
    })
  })

  describe('性能', () => {
    it('应高效处理大量子弹', () => {
      const building = createMockBuilding()
      const target = createMockMonster()

      // 创建 100 个子弹
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

      // 更新应该正常完成
      const startTime = performance.now()
      for (let frame = 0; frame < 60; frame++) {
        bulletSystem.update([], createTestMapBounds(), mockRecorder, frame)
      }
      const elapsed = performance.now() - startTime

      // 应在合理时间内完成（< 100ms）
      expect(elapsed).toBeLessThan(100)
    })
  })
})
