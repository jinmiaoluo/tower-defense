/**
 * 波次记录类型定义
 * 用于 WaveRecorder 系统记录游戏数据
 */

import type { BuildingType, MonsterTypeId, Position } from './config'
import type {
  Action,
  ActionType,
  AttackEvent,
  BuildingSnapshot,
  WaveRequest,
  WaveResult,
} from './api'

// 重新导出常用类型
export type {
  Action,
  ActionType,
  AttackEvent,
  BuildingSnapshot,
  WaveRequest,
  WaveResult,
}

// ============================================================================
// 内部记录类型（用于累计统计）
// ============================================================================

/** 波次记录内部状态 */
export interface WaveRecordState {
  waveNumber: number
  startFrame: number
  actions: Action[]
  attacks: AttackEvent[]
  result: MutableWaveResult
}

/** 可变的波次结果（内部使用） */
export interface MutableWaveResult {
  killed: number
  killedByType: Map<MonsterTypeId, number>
  passed: number
  remainingMonsterIds: string[]
  scoreGained: number
  moneyGained: number
  lifeLost: number
  totalDamageDealt: number
  totalLifeDestroyed: number
}

// ============================================================================
// 建造操作数据
// ============================================================================

/** 建造操作数据 */
export interface BuildActionData {
  buildingId: string
  buildingType: BuildingType
  position: Position
  frame: number
}

/** 升级操作数据 */
export interface UpgradeActionData {
  buildingId: string
  level: number
  frame: number
}

/** 出售操作数据 */
export interface SellActionData {
  buildingId: string
  frame: number
}

// ============================================================================
// 攻击记录数据
// ============================================================================

/** 攻击记录数据 */
export interface AttackRecordData {
  buildingId: string
  /** 发射时瞄准的怪物 ID（用于验证建筑有合法目标） */
  originalTargetId: string
  /** 发射时目标的格子坐标（用于射程验证） */
  originalTargetPosition: Position
  /** 实际命中的怪物 ID，可能与 originalTargetId 不同（"误伤"） */
  monsterId: string
  /** 命中时怪物的格子坐标，用于路径验证 */
  monsterPosition: Position
  damage: number
  frame: number
}

// ============================================================================
// 击杀/穿过记录
// ============================================================================

/** 怪物击杀数据 */
export interface KillRecordData {
  monsterType: MonsterTypeId
  monsterLife: number
  money: number
}

/** 怪物穿过终点数据 */
export interface PassedRecordData {
  /** 怪物到达终点造成的伤害（扣除玩家生命值） */
  damage: number
}

// ============================================================================
// WaveRecorder 接口
// ============================================================================

/** WaveRecorder 接口定义 */
export interface IWaveRecorder {
  /** 记录建造操作 */
  recordBuild(data: BuildActionData): void

  /** 记录升级操作 */
  recordUpgrade(data: UpgradeActionData): void

  /** 记录出售操作 */
  recordSell(data: SellActionData): void

  /**
   * 记录攻击事件
   * 同时累加得分: scoreGained += floor(√damage)
   */
  recordAttack(data: AttackRecordData): void

  /** 记录怪物被击杀（用于统计击杀数和金钱奖励，不计算得分） */
  recordKill(data: KillRecordData): void

  /** 记录怪物穿过终点 */
  recordPassed(data: PassedRecordData): void

  /** 记录在场剩余怪物（提前结束时使用） */
  recordRemainingMonster(monsterId: string): void

  /** 获取在场剩余怪物 ID 列表 */
  getRemainingMonsterIds(): string[]

  /** 设置波次持续帧数 */
  setDuration(frames: number): void

  /** 获取所有操作 */
  getActions(): Action[]

  /** 获取所有攻击事件 */
  getAttacks(): AttackEvent[]

  /** 获取波次结果 */
  getResult(): WaveResult

  /** 导出为 WaveRequest 格式 */
  toWaveRequest(sessionId: string, buildings: BuildingSnapshot[]): WaveRequest

  /** 重置记录器（开始新波次） */
  reset(waveNumber: number, startFrame: number): void
}

// ============================================================================
// 辅助函数类型
// ============================================================================

/** 将 Map 转换为 Record */
export function mapToRecord<K extends number, V>(
  map: Map<K, V>,
): Record<K, V> {
  const record = {} as Record<K, V>
  map.forEach((value, key) => {
    record[key] = value
  })
  return record
}

/** 创建空的可变波次结果 */
export function createEmptyMutableResult(): MutableWaveResult {
  return {
    killed: 0,
    killedByType: new Map(),
    passed: 0,
    remainingMonsterIds: [],
    scoreGained: 0,
    moneyGained: 0,
    lifeLost: 0,
    totalDamageDealt: 0,
    totalLifeDestroyed: 0,
  }
}

/** 将可变结果转换为不可变结果 */
export function toImmutableResult(
  mutable: MutableWaveResult,
  waveDurationFrames: number,
): WaveResult {
  const result: WaveResult = {
    killed: mutable.killed,
    killedByType: mapToRecord(mutable.killedByType),
    passed: mutable.passed,
    scoreGained: mutable.scoreGained,
    moneyGained: mutable.moneyGained,
    lifeLost: mutable.lifeLost,
    totalDamageDealt: mutable.totalDamageDealt,
    totalLifeDestroyed: mutable.totalLifeDestroyed,
    waveDurationFrames,
  }

  // 只有当有剩余怪物时才添加这些字段
  if (mutable.remainingMonsterIds.length > 0) {
    result.remaining = mutable.remainingMonsterIds.length
    result.remainingMonsterIds = [...mutable.remainingMonsterIds]
  }

  return result
}
