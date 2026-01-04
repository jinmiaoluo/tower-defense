/**
 * Monster - 怪物实体
 * 负责怪物的状态管理、伤害计算和路径跟随
 * 参考旧实现：html5-tower-defense/src/js/td-obj-monster.js
 */

import type { IMonster, MonsterCreateParams, Path } from '@/types/entities'
import type { MonsterTypeId, Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE, GLOBAL_SPEED, FPS } = GAME_CONSTANTS

/** 旧实现的帧率（用于速度换算） */
const OLD_FPS = 24

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
  /** 从指定位置生成到出口的路径（用于独立寻路） */
  generatePathFrom: (startPosition: Position) => Path
  /** 根据进度获取像素位置 */
  getPositionAtProgress: (path: Path, progress: number) => { x: number; y: number }
  /** 检查指定位置是否可通行 */
  isPassable: (position: Position) => boolean
  /** 获取地图入口位置 */
  getEntrance: () => Position
}

/** 10% 概率重新寻路（与旧实现一致） */
const REPATH_PROBABILITY = 0.1

/**
 * Monster 实现类
 *
 * 移动机制与旧实现保持一致：
 * - 直接追踪像素位置 (pixelX, pixelY)，与旧实现的 (cx, cy) 对应
 * - 每帧朝下一个格子中心移动固定像素距离
 * - 重新寻路时只改变目标，不改变当前位置，保证移动连续性
 * - 参考旧实现: td-obj-monster.js:238-278 step()
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
  isValid: boolean

  private readonly deps: MonsterDependencies
  /** 怪物独立的路径数组（与旧实现的 this.way 对应） */
  private path: Path = []
  /** 当前像素位置 X（与旧实现的 this.cx 对应） */
  private pixelX: number = 0
  /** 当前像素位置 Y（与旧实现的 this.cy 对应） */
  private pixelY: number = 0
  /** 当前路径中的目标格子索引 */
  private targetGridIndex: number = 1
  /** 内部进度值 */
  private _progress: number = 0

  /**
   * 获取进度（0-1）
   * 进度是从像素位置计算的派生值
   */
  get progress(): number {
    return this._progress
  }

  /**
   * 设置进度（0-1）
   * 设置进度时会同步更新像素位置，保持向后兼容性
   * 这使得测试代码可以通过设置 progress 来定位怪物
   */
  set progress(value: number) {
    this._progress = Math.max(0, Math.min(1, value))

    // 如果路径有效，根据 progress 计算像素位置
    if (this.path.length >= 2) {
      const totalSegments = this.path.length - 1
      const exactPosition = this._progress * totalSegments
      const segmentIndex = Math.min(Math.floor(exactPosition), totalSegments - 1)
      const segmentProgress = exactPosition - segmentIndex

      const [startX, startY] = this.path[segmentIndex]
      const [endX, endY] = this.path[Math.min(segmentIndex + 1, this.path.length - 1)]

      const startPixelX = startX * GRID_SIZE + GRID_SIZE / 2
      const startPixelY = startY * GRID_SIZE + GRID_SIZE / 2
      const endPixelX = endX * GRID_SIZE + GRID_SIZE / 2
      const endPixelY = endY * GRID_SIZE + GRID_SIZE / 2

      this.pixelX = startPixelX + (endPixelX - startPixelX) * segmentProgress
      this.pixelY = startPixelY + (endPixelY - startPixelY) * segmentProgress

      // 更新目标格子索引
      this.targetGridIndex = Math.min(segmentIndex + 1, this.path.length - 1)
    }
  }

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

    // 初始化像素位置为入口中心
    const entrance = deps.getEntrance()
    this.pixelX = entrance[0] * GRID_SIZE + GRID_SIZE / 2
    this.pixelY = entrance[1] * GRID_SIZE + GRID_SIZE / 2

    // 初始寻路
    this.findPath()
  }

  /**
   * 独立寻路
   * 参考旧实现: td-obj-monster.js:124-136 findWay()
   *
   * 重要：重新寻路时不改变像素位置，只改变路径
   * 这保证了移动的连续性，与旧实现行为一致
   */
  private findPath(): void {
    const currentGridPos = this.getGridPosition()
    this.path = this.deps.generatePathFrom(currentGridPos)
    // 目标格子是路径中的下一个格子（索引 1），索引 0 是当前格子
    this.targetGridIndex = 1
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
    // progress >= 1 表示已到达终点（update 方法在到达时设置 progress = 1）
    return this.progress >= 1
  }

  /**
   * 获取当前格子坐标
   * 基于像素位置计算，与旧实现一致
   */
  getGridPosition(): Position {
    // 从像素位置计算格子坐标
    const gridX = Math.floor(this.pixelX / GRID_SIZE)
    const gridY = Math.floor(this.pixelY / GRID_SIZE)
    return [gridX, gridY]
  }

  /**
   * 获取当前像素位置
   * 直接返回追踪的像素位置，与旧实现一致
   */
  getPixelPosition(): { x: number; y: number } {
    return { x: this.pixelX, y: this.pixelY }
  }

  /**
   * 获取路径上下一个要去的格子
   * 参考旧实现: td-obj-monster.js:184-203 getNextGrid()
   */
  private getNextGridInPath(): Position | null {
    if (this.path.length <= 1 || this.targetGridIndex >= this.path.length) {
      return null
    }
    return this.path[this.targetGridIndex]
  }

  /**
   * 计算到达出口的总路径长度（像素）
   * 用于计算 progress
   */
  private calculateTotalPathLength(): number {
    if (this.path.length <= 1) return 0
    // 路径长度 = (格子数 - 1) * GRID_SIZE
    return (this.path.length - 1) * GRID_SIZE
  }

  /**
   * 计算当前已走过的路径长度（像素）
   * 基于像素位置计算
   */
  private calculateTraveledDistance(): number {
    if (this.path.length === 0) return 0

    const [startX, startY] = this.path[0]
    const startPixelX = startX * GRID_SIZE + GRID_SIZE / 2
    const startPixelY = startY * GRID_SIZE + GRID_SIZE / 2

    // 简化计算：使用曼哈顿距离（因为怪物只能水平或垂直移动）
    return Math.abs(this.pixelX - startPixelX) + Math.abs(this.pixelY - startPixelY)
  }

  /**
   * 每帧更新
   * 参考旧实现: td-obj-monster.js:238-278 step()
   *
   * 核心机制：直接追踪像素位置
   * - 每帧朝目标格子中心移动固定像素距离
   * - 到达目标后切换到下一个目标
   * - 重新寻路时只改变目标，不改变当前位置，保证移动连续性
   */
  update(): void {
    if (!this.isValid) {
      return
    }

    // 路径为空时强制寻路
    if (this.path.length === 0) {
      this.findPath()
    }

    // 检查下一个格子是否可通行，不可通行则强制重新寻路
    // 参考旧实现: td-obj-monster.js:192-195
    const nextGrid = this.getNextGridInPath()
    if (nextGrid && !this.deps.isPassable(nextGrid)) {
      this.findPath()
    }

    // 路径被阻塞（无法到达出口）
    if (this.path.length === 0) {
      return
    }

    // 检查是否已经到达路径终点
    if (this.path.length <= 1 || this.targetGridIndex >= this.path.length) {
      // 到达出口
      const [exitX, exitY] = this.path[this.path.length - 1]
      this.pixelX = exitX * GRID_SIZE + GRID_SIZE / 2
      this.pixelY = exitY * GRID_SIZE + GRID_SIZE / 2
      this._progress = 1
      this.isValid = false
      return
    }

    // 获取目标格子中心
    const [targetGridX, targetGridY] = this.path[this.targetGridIndex]
    const targetPixelX = targetGridX * GRID_SIZE + GRID_SIZE / 2
    const targetPixelY = targetGridY * GRID_SIZE + GRID_SIZE / 2

    // 计算到目标的距离和方向
    const dx = targetPixelX - this.pixelX
    const dy = targetPixelY - this.pixelY

    // 计算每帧移动的像素距离
    // 旧实现 (24 FPS): 每帧移动 speed * GLOBAL_SPEED 像素
    // 新实现 (60 FPS): 需要乘以帧率比例 (24/60) 以保持相同的实际移动速度
    const speed = this.speed * GLOBAL_SPEED * (OLD_FPS / FPS)

    // 检查是否能在这一帧到达目标
    // 参考旧实现: td-obj-monster.js:264-274
    if (Math.abs(dx) < speed && Math.abs(dy) < speed) {
      // 到达目标格子中心
      this.pixelX = targetPixelX
      this.pixelY = targetPixelY
      this.targetGridIndex++

      // 检查是否到达终点
      if (this.targetGridIndex >= this.path.length) {
        this._progress = 1
        this.isValid = false
        return
      }

      // 10% 概率重新寻路（只在到达格子中心时触发）
      // 参考旧实现: td-obj-monster.js:184-188 getNextGrid() 只在 next_grid 为空时调用
      // 旧实现中 next_grid 在到达目标后才设为 null，因此 10% 检查只在格子交接点触发
      if (Math.random() < REPATH_PROBABILITY) {
        this.findPath()
      }
    } else {
      // 朝目标移动
      // 参考旧实现: td-obj-monster.js:270-273
      if (dx !== 0) {
        const sx = dx < 0 ? -1 : 1
        this.pixelX += sx * speed
      }
      if (dy !== 0) {
        const sy = dy < 0 ? -1 : 1
        this.pixelY += sy * speed
      }
    }

    // 更新全局进度（用于外部查询）
    // 注意：使用 _progress 直接赋值，避免触发 setter 覆盖像素位置
    const totalLength = this.calculateTotalPathLength()
    if (totalLength > 0) {
      const traveled = this.calculateTraveledDistance()
      this._progress = Math.min(traveled / totalLength, 1)
    } else {
      this._progress = 1
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
