/**
 * BulletSystem - 子弹系统
 * 负责子弹的创建、飞行、碰撞检测
 * 参考旧实现：html5-tower-defense/src/js/td-obj-building.js
 */

import type { IBuilding, IMonster } from '@/types/entities'
import type { IWaveRecorder } from '@/types/recorder'
import type { Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE } = GAME_CONSTANTS

/**
 * 子弹速度因子
 * 旧实现中：speed = 20 * this.speed * TD.global_speed
 * 配置值（如 bullet_speed: 6）需要乘以此因子才是实际像素速度
 */
const BULLET_SPEED_FACTOR = 20

/** 子弹默认半径 */
const DEFAULT_BULLET_RADIUS = 3

/** 碰撞检测宽松因子（√2，避免子弹穿过怪物） */
const COLLISION_TOLERANCE = Math.SQRT2

/** 矩形区域 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 子弹实体 */
export interface Bullet {
  /** 所属建筑 */
  readonly building: IBuilding
  /** 伤害值 */
  readonly damage: number
  /** 飞行速度（像素/帧） */
  readonly speed: number
  /** 当前 X 位置 */
  x: number
  /** 当前 Y 位置 */
  y: number
  /** X 方向速度分量 */
  readonly vx: number
  /** Y 方向速度分量 */
  readonly vy: number
  /** 原始目标 ID（用于服务端验证） */
  readonly originalTargetId: string
  /** 原始目标位置（用于服务端射程验证） */
  readonly originalTargetPosition: Position
  /** 子弹半径（用于碰撞检测和渲染） */
  readonly radius: number
  /** 是否有效 */
  isValid: boolean
}

/** 子弹创建参数 */
export interface BulletCreateParams {
  building: IBuilding
  target: IMonster
  damage: number
  speed: number
  startX: number
  startY: number
  /** 目标 X 位置（可选，默认从 target 计算） */
  targetX?: number
  /** 目标 Y 位置（可选，默认从 target 计算） */
  targetY?: number
}

/** BulletSystem 接口 */
export interface BulletSystem {
  /** 创建子弹 */
  createBullet(params: BulletCreateParams): Bullet

  /**
   * 每帧更新
   * @param monsters 当前存活的怪物列表
   * @param mapBounds 地图边界
   * @param recorder 波次记录器
   * @param currentFrame 当前帧号
   */
  update(
    monsters: IMonster[],
    mapBounds: Rect,
    recorder: IWaveRecorder,
    currentFrame: number,
  ): void

  /** 获取当前所有子弹（用于渲染） */
  getBullets(): readonly Bullet[]

  /** 清除所有子弹 */
  clear(): void
}

/**
 * 获取怪物的像素位置
 * 怪物可能有 x/y 属性（运行时），也可能需要从 getGridPosition 计算
 */
function getMonsterPixelPosition(monster: IMonster): { x: number; y: number } {
  const monsterAny = monster as unknown as { x?: number; y?: number }
  if (typeof monsterAny.x === 'number' && typeof monsterAny.y === 'number') {
    return { x: monsterAny.x, y: monsterAny.y }
  }
  const gridPos = monster.getGridPosition()
  return {
    x: gridPos[0] * GRID_SIZE + GRID_SIZE / 2,
    y: gridPos[1] * GRID_SIZE + GRID_SIZE / 2,
  }
}

/**
 * 计算子弹半径（基于伤害值）
 * 参考旧实现: r = max(log(damage), 2)，限制在 1-6 之间
 */
function calculateBulletRadius(damage: number): number {
  const r = Math.max(Math.log(damage), 2)
  return Math.min(Math.max(r, 1), 6)
}

/**
 * 检测子弹与怪物的碰撞
 * 使用宽松的圆形碰撞检测
 */
function checkCollision(bullet: Bullet, monster: IMonster): boolean {
  if (!monster.isValid) return false

  const monsterPos = getMonsterPixelPosition(monster)
  const dx = monsterPos.x - bullet.x
  const dy = monsterPos.y - bullet.y
  const distanceSquared = dx * dx + dy * dy

  // 宽松碰撞检测：(r1 + r2)² × 2
  const collisionRadiusSquared =
    Math.pow(bullet.radius + monster.radius, 2) * 2

  return distanceSquared <= collisionRadiusSquared
}

/**
 * 检测子弹是否飞出地图边界
 */
function isOutOfBounds(bullet: Bullet, bounds: Rect): boolean {
  return (
    bullet.x < bounds.x ||
    bullet.x > bounds.x + bounds.width ||
    bullet.y < bounds.y ||
    bullet.y > bounds.y + bounds.height
  )
}

/**
 * 创建 BulletSystem 实例
 */
export function createBulletSystem(): BulletSystem {
  const bullets: Bullet[] = []

  return {
    createBullet(params: BulletCreateParams): Bullet {
      const { building, target, damage, speed, startX, startY } = params

      // 获取目标位置
      const targetPos = getMonsterPixelPosition(target)
      const targetX = params.targetX ?? targetPos.x
      const targetY = params.targetY ?? targetPos.y

      // 计算方向向量
      const dx = targetX - startX
      const dy = targetY - startY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // 计算实际像素速度（配置值 × 速度因子）
      // 旧实现: speed = 20 * this.speed * TD.global_speed
      const actualSpeed = speed * BULLET_SPEED_FACTOR

      // 计算速度分量（如果距离为 0，默认向右）
      let vx: number, vy: number
      if (distance > 0) {
        vx = (dx * actualSpeed) / distance
        vy = (dy * actualSpeed) / distance
      } else {
        vx = actualSpeed
        vy = 0
      }

      // 记录原始目标信息
      const originalTargetPosition = target.getGridPosition()

      const bullet: Bullet = {
        building,
        damage,
        speed,
        x: startX,
        y: startY,
        vx,
        vy,
        originalTargetId: target.id,
        originalTargetPosition,
        radius: calculateBulletRadius(damage),
        isValid: true,
      }

      bullets.push(bullet)
      return bullet
    },

    update(
      monsters: IMonster[],
      mapBounds: Rect,
      recorder: IWaveRecorder,
      currentFrame: number,
    ): void {
      // 从后向前遍历，方便删除
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i]

        if (!bullet.isValid) {
          bullets.splice(i, 1)
          continue
        }

        // 1. 检测是否飞出边界
        if (isOutOfBounds(bullet, mapBounds)) {
          bullet.isValid = false
          bullets.splice(i, 1)
          continue
        }

        // 2. 检测碰撞
        let hitMonster: IMonster | null = null
        for (const monster of monsters) {
          if (checkCollision(bullet, monster)) {
            hitMonster = monster
            break
          }
        }

        if (hitMonster) {
          // 命中怪物
          const actualDamage = hitMonster.takeDamage(bullet.damage)

          // 记录攻击事件
          recorder.recordAttack({
            buildingId: bullet.building.id,
            originalTargetId: bullet.originalTargetId,
            originalTargetPosition: bullet.originalTargetPosition,
            monsterId: hitMonster.id,
            monsterPosition: hitMonster.getGridPosition(),
            damage: actualDamage,
            frame: currentFrame,
          })

          // 移除子弹
          bullet.isValid = false
          bullets.splice(i, 1)
          continue
        }

        // 3. 移动子弹
        bullet.x += bullet.vx
        bullet.y += bullet.vy
      }
    },

    getBullets(): readonly Bullet[] {
      return [...bullets]
    },

    clear(): void {
      bullets.length = 0
    },
  }
}
