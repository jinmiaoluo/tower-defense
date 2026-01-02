/**
 * 游戏实体类型定义
 * 用于 Phaser 游戏对象的接口定义
 */

import type { BuildingType, MonsterTypeId, Position } from './config'
import type { MonsterConfig } from './api'
import type { IWaveRecorder } from './recorder'

// ============================================================================
// 怪物实体
// ============================================================================

/** 怪物实体接口 */
export interface IMonster {
  /** 唯一 ID（服务端下发的 UUID） */
  readonly id: string
  /** 怪物类型 */
  readonly type: MonsterTypeId
  /** 最大生命值 */
  readonly maxLife: number
  /** 当前生命值 */
  currentLife: number
  /** 移动速度（格子/帧） */
  readonly speed: number
  /** 初始护盾值（每次攻击减少的伤害量） */
  readonly shield: number
  /** 当前护盾值（随受击逐渐降低） */
  currentShield: number
  /** 击杀奖励金钱 */
  readonly money: number
  /** 到达终点造成的伤害（从 config.monsters[type].damage 获取） */
  readonly damage: number
  /** 路径进度 (0-1) */
  progress: number
  /** 是否有效（未被击杀且未到达终点） */
  isValid: boolean

  /**
   * 受到伤害，返回实际造成的伤害值
   * 伤害计算: actualDamage = max(rawDamage - currentShield, rawDamage × 0.1)
   * 最低伤害为原始伤害的 10%，保证高伤害武器打护盾怪更有效
   * 每次受击后护盾值降低: currentShield = max(0, currentShield - 1)
   */
  takeDamage(rawDamage: number): number

  /** 是否已死亡 */
  isDead(): boolean

  /** 是否到达终点 */
  reachedExit(): boolean

  /** 获取当前格子坐标 */
  getGridPosition(): Position
}

/** 怪物创建参数 */
export interface MonsterCreateParams extends MonsterConfig {
  /** 颜色（用于渲染，从 MonsterDisplayConfig 获取） */
  color: string
  /** 到达终点造成的伤害（从 config.monsters[type].damage 获取） */
  damage: number
}

// ============================================================================
// 建筑实体
// ============================================================================

/** 建筑实体接口 */
export interface IBuilding {
  /** 唯一 ID */
  readonly id: string
  /** 建筑类型 */
  readonly type: BuildingType
  /** 等级 */
  level: number
  /** 位置 */
  readonly position: Position
  /** 攻击冷却计数 */
  cooldown: number
  /** 本波累计伤害 */
  damageDealt: number
  /** 本波击杀数 */
  kills: number

  /** 是否可以攻击 */
  canAttack(): boolean

  /** 在怪物列表中寻找目标 */
  findTarget(monsters: IMonster[]): IMonster | null

  /** 攻击目标 */
  attack(target: IMonster, recorder: IWaveRecorder, frame: number): void

  /** 获取当前伤害值 */
  getDamage(): number

  /** 获取当前射程 */
  getRange(): number

  /** 获取攻击速度（帧间隔） */
  getAttackSpeed(): number

  /** 重置波次统计 */
  resetWaveStats(): void
}

/** 建筑创建参数 */
export interface BuildingCreateParams {
  id: string
  type: BuildingType
  position: Position
  level?: number
}

// ============================================================================
// 子弹实体
// ============================================================================

/** 子弹实体接口 */
export interface IBullet {
  /** 所属建筑 */
  readonly building: IBuilding
  /** 目标怪物 */
  readonly target: IMonster
  /** 伤害值 */
  readonly damage: number
  /** 速度 */
  readonly speed: number
  /** 当前位置 */
  x: number
  y: number
  /** 是否有效 */
  isValid: boolean

  /** 更新位置 */
  update(): void

  /** 检查是否命中 */
  checkHit(): boolean
}

/** 子弹创建参数 */
export interface BulletCreateParams {
  building: IBuilding
  target: IMonster
  damage: number
  speed: number
  startX: number
  startY: number
}

// ============================================================================
// 路径相关
// ============================================================================

/** 路径点 */
export type PathPoint = Position

/** 路径（一系列坐标点） */
export type Path = PathPoint[]

/** 路径计算接口 */
export interface IPathFinder {
  /** 计算从起点到终点的路径 */
  findPath(
    start: Position,
    end: Position,
    isPassable: (x: number, y: number) => boolean,
  ): Path | null
}

// ============================================================================
// 游戏场景相关
// ============================================================================

/** 格子状态 */
export interface GridCell {
  /** 格子坐标 */
  position: Position
  /** 是否可通行 */
  isPassable: boolean
  /** 放置的建筑 ID（如有） */
  buildingId: string | null
  /** 是否是入口 */
  isEntrance: boolean
  /** 是否是出口 */
  isExit: boolean
  /** 是否是障碍物 */
  isObstacle: boolean
}

/** 地图状态 */
export interface MapState {
  /** 宽度（格子数） */
  width: number
  /** 高度（格子数） */
  height: number
  /** 格子数组 */
  cells: GridCell[][]
  /** 当前路径缓存 */
  cachedPath: Path | null
}

// ============================================================================
// 游戏场景接口
// ============================================================================

/** 游戏场景接口 */
export interface IGameScene {
  /** 当前帧号 */
  currentFrame: number
  /** 地图状态 */
  map: MapState
  /** 怪物列表 */
  monsters: IMonster[]
  /** 建筑列表 */
  buildings: IBuilding[]
  /** 子弹列表 */
  bullets: IBullet[]
  /** 波次记录器 */
  recorder: IWaveRecorder

  /** 添加怪物 */
  addMonster(params: MonsterCreateParams): IMonster

  /** 移除怪物 */
  removeMonster(id: string): void

  /** 添加建筑 */
  addBuilding(params: BuildingCreateParams): IBuilding

  /** 移除建筑 */
  removeBuilding(id: string): void

  /** 获取建筑 */
  getBuilding(id: string): IBuilding | null

  /** 检查位置是否可以放置建筑 */
  canPlaceBuilding(position: Position): boolean

  /** 获取路径 */
  getPath(): Path

  /** 更新游戏逻辑 */
  update(): void
}

// ============================================================================
// 辅助类型
// ============================================================================

/** 计算两点之间的距离 */
export function calculateDistance(a: Position, b: Position): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/** 计算曼哈顿距离 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

/** 判断两个位置是否相同 */
export function isSamePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}
