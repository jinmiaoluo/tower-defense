/**
 * Building - 建筑实体
 * 负责建筑的状态管理、目标搜索和攻击行为
 * 参考旧实现：html5-tower-defense/src/js/td-obj-building.js
 */

import type { IBuilding, IMonster, BuildingCreateParams } from '@/types/entities'
import type { IWaveRecorder } from '@/types/recorder'
import type { BuildingType, Position } from '@/types'

/**
 * Building 依赖接口
 * 通过依赖注入方式获取 BuildingSystem 功能，便于测试和解耦
 */
export interface BuildingDependencies {
  /** 获取指定等级的伤害值 */
  getDamageAtLevel: (type: BuildingType, level: number) => number
  /** 获取指定等级的射程 */
  getRangeAtLevel: (type: BuildingType, level: number) => number
  /** 获取攻击间隔帧数 */
  getAttackSpeedFrames: (type: BuildingType) => number
  /** 检查目标是否在射程内 */
  isInRange: (building: { type: BuildingType; level: number; position: Position }, targetPos: Position) => boolean
  /** 判断是否为武器（可攻击） */
  isWeapon: (type: BuildingType) => boolean
  /** 获取子弹速度 */
  getBulletSpeed: (type: BuildingType) => number
}

/**
 * 子弹创建参数
 */
export interface BulletCreateInfo {
  /** 所属建筑 */
  building: IBuilding
  /** 伤害值 */
  damage: number
  /** 子弹速度 */
  speed: number
  /** 原始目标 ID */
  originalTargetId: string
  /** 原始目标位置 */
  originalTargetPosition: Position
}

/**
 * Building 实现类
 */
class Building implements IBuilding {
  readonly id: string
  readonly type: BuildingType
  level: number
  readonly position: Position
  cooldown: number
  damageDealt: number
  kills: number

  private readonly deps: BuildingDependencies
  private currentTarget: IMonster | null = null
  private lastTargetPosition: Position | null = null

  constructor(params: BuildingCreateParams, deps: BuildingDependencies) {
    this.id = params.id
    this.type = params.type
    this.level = params.level ?? 1
    this.position = params.position
    this.cooldown = 0
    this.damageDealt = 0
    this.kills = 0
    this.deps = deps
  }

  /** 是否可以攻击（冷却结束且是武器类型） */
  canAttack(): boolean {
    if (!this.deps.isWeapon(this.type)) {
      return false
    }
    return this.cooldown <= 0
  }

  /**
   * 在怪物列表中寻找目标
   * 策略：优先选择路径进度最高的怪物（更接近出口的威胁更大）
   * 参考旧实现: td-obj-building.js:187-204
   */
  findTarget(monsters: IMonster[]): IMonster | null {
    if (!this.deps.isWeapon(this.type)) {
      this.currentTarget = null
      return null
    }

    // 如果当前目标仍然有效且在射程内，保持目标
    if (this.currentTarget && this.currentTarget.isValid) {
      const targetPos = this.currentTarget.getGridPosition()
      if (this.deps.isInRange(
        { type: this.type, level: this.level, position: this.position },
        targetPos,
      )) {
        return this.currentTarget
      }
    }

    // 筛选有效且在射程内的怪物
    const validTargets = monsters.filter((monster) => {
      if (!monster.isValid) {
        return false
      }

      const targetPos = monster.getGridPosition()
      return this.deps.isInRange(
        { type: this.type, level: this.level, position: this.position },
        targetPos,
      )
    })

    if (validTargets.length === 0) {
      this.currentTarget = null
      return null
    }

    // 选择路径进度最高的怪物
    this.currentTarget = validTargets.reduce((best, current) => {
      return current.progress > best.progress ? current : best
    })

    return this.currentTarget
  }

  /**
   * 攻击目标
   * - 激光枪：立即命中，直接造成伤害
   * - 其他武器：设置冷却，由外部 BulletSystem 创建子弹
   */
  attack(target: IMonster, recorder: IWaveRecorder, frame: number): void {
    // 设置攻击冷却
    this.cooldown = this.deps.getAttackSpeedFrames(this.type)

    const damage = this.getDamage()
    const targetPos = target.getGridPosition()

    // 激光枪特殊处理：立即命中
    if (this.type === 'laser_gun') {
      const actualDamage = target.takeDamage(damage)

      // 更新统计
      this.damageDealt += actualDamage

      // 检查是否击杀
      if (target.isDead()) {
        this.kills += 1
      }

      // 记录攻击事件
      recorder.recordAttack({
        frame,
        buildingId: this.id,
        originalTargetId: target.id,
        originalTargetPosition: targetPos,
        monsterId: target.id,
        monsterPosition: targetPos,
        damage: actualDamage,
      })
    }
    // 其他武器类型不在这里处理，由外部通过 getBulletParams 创建子弹
  }

  /** 获取当前等级的伤害值 */
  getDamage(): number {
    return this.deps.getDamageAtLevel(this.type, this.level)
  }

  /** 获取当前等级的射程 */
  getRange(): number {
    return this.deps.getRangeAtLevel(this.type, this.level)
  }

  /** 获取攻击速度（帧间隔） */
  getAttackSpeed(): number {
    return this.deps.getAttackSpeedFrames(this.type)
  }

  /** 重置波次统计 */
  resetWaveStats(): void {
    this.damageDealt = 0
    this.kills = 0
  }

  /** 获取当前目标的格子位置（用于渲染炮管指向） */
  getCurrentTargetPosition(): Position | null {
    if (this.currentTarget && this.currentTarget.isValid) {
      this.lastTargetPosition = this.currentTarget.getGridPosition()
      return this.lastTargetPosition
    }
    // 没有目标时返回最后的目标位置，保持炮管方向
    return this.lastTargetPosition
  }

  /** 是否有活跃目标 */
  hasActiveTarget(): boolean {
    return this.currentTarget !== null && this.currentTarget.isValid
  }

  /** 每帧更新冷却 */
  updateCooldown(): void {
    if (this.cooldown > 0) {
      this.cooldown -= 1
    }
  }

  /**
   * 获取子弹创建参数
   * 激光枪返回 null（不使用子弹）
   */
  getBulletParams(target: IMonster): BulletCreateInfo | null {
    // 激光枪不使用子弹
    if (this.type === 'laser_gun') {
      return null
    }

    const targetPos = target.getGridPosition()

    return {
      building: this,
      damage: this.getDamage(),
      speed: this.deps.getBulletSpeed(this.type),
      originalTargetId: target.id,
      originalTargetPosition: targetPos,
    }
  }

  /** 升级建筑 */
  upgrade(): void {
    this.level += 1
  }
}

/**
 * 创建 Building 实例
 */
export function createBuilding(
  params: BuildingCreateParams,
  deps: BuildingDependencies,
): IBuilding & IBuildingRuntime {
  return new Building(params, deps)
}

/**
 * 扩展的 Building 接口（包含运行时方法）
 */
export interface IBuildingRuntime {
  /** 每帧更新冷却 */
  updateCooldown(): void
  /** 获取子弹创建参数 */
  getBulletParams(target: IMonster): BulletCreateInfo | null
  /** 升级建筑 */
  upgrade(): void
}
