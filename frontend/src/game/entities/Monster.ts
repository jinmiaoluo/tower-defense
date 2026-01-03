/**
 * Monster - 怪物实体
 * 负责怪物的状态管理、伤害计算和路径跟随
 * 参考旧实现：html5-tower-defense/src/js/td-obj-monster.js
 */

import type { IMonster, MonsterCreateParams, Path } from '@/types/entities'
import type { MonsterTypeId, Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE, GLOBAL_SPEED } = GAME_CONSTANTS

/** 最低伤害比例（保证高伤害武器对护盾怪的优势） */
const MIN_DAMAGE_RATIO = 0.1

/** 怪物半径计算常量（参考旧实现: this.r = Math.floor(this.damage * 1.2)） */
const MONSTER_RADIUS_FACTOR = 1.2
const MONSTER_RADIUS_MIN = 4
const MONSTER_RADIUS_MAX = 12

/**
 * 计算怪物半径
 * 基于伤害值计算: floor(damage * 1.2)，范围 4-12
 */
function calculateMonsterRadius(damage: number): number {
  const r = Math.floor(damage * MONSTER_RADIUS_FACTOR)
  return Math.max(MONSTER_RADIUS_MIN, Math.min(MONSTER_RADIUS_MAX, r))
}

/**
 * Monster 依赖接口
 * 通过依赖注入方式获取 PathSystem 功能，便于测试和解耦
 */
export interface MonsterDependencies {
  /** 获取当前路径 */
  getPath: () => Path
  /** 根据进度获取像素位置 */
  getPositionAtProgress: (path: Path, progress: number) => { x: number; y: number }
}

/**
 * Monster 实现类
 */
class Monster implements IMonster {
  readonly id: string
  readonly type: MonsterTypeId
  readonly maxLife: number
  currentLife: number
  readonly speed: number
  readonly shield: number
  readonly money: number
  readonly damage: number
  readonly radius: number
  readonly color: string
  progress: number
  isValid: boolean

  private readonly deps: MonsterDependencies

  constructor(params: MonsterCreateParams, deps: MonsterDependencies) {
    this.id = params.id
    this.type = params.type
    this.maxLife = params.life
    this.currentLife = params.life
    this.speed = params.speed
    this.shield = params.shield
    this.money = params.money
    this.damage = params.damage
    this.radius = calculateMonsterRadius(params.damage)
    this.color = params.color
    this.progress = 0
    this.isValid = true
    this.deps = deps
  }

  /**
   * 受到伤害
   * 伤害计算公式: actualDamage = max(rawDamage - shield, rawDamage × 0.1)
   * 与旧实现一致，shield 是静态值，不会递减
   */
  takeDamage(rawDamage: number): number {
    if (!this.isValid) {
      return 0
    }

    // 计算最低伤害（保证高伤害武器的优势）
    const minDamage = Math.ceil(rawDamage * MIN_DAMAGE_RATIO)

    // 计算实际伤害（使用静态 shield 值）
    const reducedDamage = rawDamage - this.shield
    const actualDamage = Math.max(reducedDamage, minDamage)

    // 扣除生命值
    this.currentLife = Math.max(0, this.currentLife - actualDamage)

    // 检查是否死亡
    if (this.currentLife <= 0) {
      this.isValid = false
    }

    return actualDamage
  }

  /** 是否已死亡 */
  isDead(): boolean {
    return this.currentLife <= 0
  }

  /** 是否到达终点 */
  reachedExit(): boolean {
    return this.progress >= 1
  }

  /** 获取当前格子坐标 */
  getGridPosition(): Position {
    const path = this.deps.getPath()

    if (path.length === 0) {
      return [0, 0]
    }

    if (path.length === 1) {
      return path[0]
    }

    const clampedProgress = Math.max(0, Math.min(1, this.progress))
    const totalSegments = path.length - 1
    const exactPosition = clampedProgress * totalSegments
    const segmentIndex = Math.min(Math.floor(exactPosition), totalSegments - 1)

    // 判断更接近哪个格子
    const segmentProgress = exactPosition - segmentIndex
    if (segmentProgress >= 0.5) {
      return path[Math.min(segmentIndex + 1, path.length - 1)]
    }
    return path[segmentIndex]
  }

  /** 获取当前像素位置 */
  getPixelPosition(): { x: number; y: number } {
    const path = this.deps.getPath()
    return this.deps.getPositionAtProgress(path, this.progress)
  }

  /** 每帧更新 */
  update(): void {
    if (!this.isValid) {
      return
    }

    const path = this.deps.getPath()
    if (path.length <= 1) {
      // 空路径或单点路径，直接到达终点
      this.progress = 1
      this.isValid = false
      return
    }

    // 计算每帧移动的 progress 增量
    // 实际速度 = speed * GLOBAL_SPEED（参考旧实现）
    // 总路径像素长度 = (path.length - 1) * GRID_SIZE
    const totalPathLength = (path.length - 1) * GRID_SIZE
    const actualSpeed = this.speed * GLOBAL_SPEED
    const progressPerFrame = actualSpeed / totalPathLength

    this.progress += progressPerFrame

    // 检查是否到达终点
    if (this.progress >= 1) {
      this.progress = 1
      this.isValid = false
    }
  }
}

/**
 * 创建 Monster 实例
 */
export function createMonster(params: MonsterCreateParams, deps: MonsterDependencies): IMonster & {
  /** 获取当前像素位置 */
  getPixelPosition(): { x: number; y: number }
  /** 每帧更新 */
  update(): void
} {
  return new Monster(params, deps)
}

/**
 * 扩展的 Monster 接口（包含运行时方法）
 */
export interface IMonsterRuntime extends IMonster {
  /** 获取当前像素位置 */
  getPixelPosition(): { x: number; y: number }
  /** 每帧更新 */
  update(): void
}
