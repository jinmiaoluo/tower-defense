/**
 * API 请求与响应类型定义
 * 对应后端 API 接口规范
 */

import type {
  BuildingConfig,
  BuildingType,
  GameConfig,
  InitialConfig,
  MapConfig,
  MonsterDisplayConfig,
  MonsterTypeId,
  Position,
} from './config'

// 重新导出常用类型
export type {
  BuildingConfig,
  BuildingType,
  GameConfig,
  InitialConfig,
  MapConfig,
  MonsterDisplayConfig,
  MonsterTypeId,
  Position,
}

// ============================================================================
// POST /api/game/sessions - 创建游戏会话
// ============================================================================

/** 创建会话响应 */
export interface GameStartResponse {
  sessionId: string
  config: GameConfig
  firstWave: WaveConfig
}

/** 波次配置 */
export interface WaveConfig {
  waveNumber: number
  monsters: MonsterConfig[]
}

/** 单个怪物配置（服务端计算后的属性） */
export interface MonsterConfig {
  /** 怪物唯一 ID（服务端生成的 UUID） */
  id: string
  /** 怪物类型（0-8） */
  type: MonsterTypeId
  /** 生命值（受难度系数影响） */
  life: number
  /** 移动速度（受难度系数影响） */
  speed: number
  /** 护盾值（受难度系数影响） */
  shield: number
  /** 击杀获得金钱 */
  money: number
}

// ============================================================================
// POST /api/game/sessions/wave - 提交波次结果
// ============================================================================

/** 波次提交请求 */
export interface WaveRequest {
  sessionId: string
  waveNumber: number
  actions: Action[]
  attacks: AttackEvent[]
  result: WaveResult
  buildings: BuildingSnapshot[]
}

/** 建筑操作类型 */
export type ActionType = 'BUILD' | 'UPGRADE' | 'SELL'

/** 建筑操作记录 */
export interface Action {
  type: ActionType
  /** 操作发生的帧号 */
  frame: number
  /** 建筑唯一 ID */
  buildingId: string
  /** BUILD 时的建筑类型 */
  buildingType?: BuildingType
  /** BUILD 时的位置 */
  position?: Position
  /** UPGRADE 后的等级 */
  level?: number
}

/** 攻击事件记录 */
export interface AttackEvent {
  /** 命中发生的帧号 */
  frame: number
  /** 发起攻击的建筑 ID */
  buildingId: string

  /** 发射时瞄准的怪物 ID（用于验证建筑有合法目标） */
  originalTargetId: string
  /** 发射时目标的格子坐标（用于射程验证） */
  originalTargetPosition: Position

  /** 实际命中的怪物 ID，可能与 originalTargetId 不同（"误伤"） */
  monsterId: string
  /** 命中时怪物的格子坐标，用于路径验证 */
  monsterPosition: Position

  /** 实际伤害 = max(原伤害 - 护盾, 原伤害 × 0.1) */
  damage: number
}

/** 波次战斗结果 */
export interface WaveResult {
  /** 击杀怪物总数 */
  killed: number
  /** 每种怪物的击杀数（只包含本波出现的类型） */
  killedByType: Partial<Record<MonsterTypeId, number>>
  /** 穿过终点的怪物数 */
  passed: number
  /** 获得分数 */
  scoreGained: number
  /** 获得金钱 */
  moneyGained: number
  /** 损失生命 */
  lifeLost: number
  /** 总伤害输出 */
  totalDamageDealt: number
  /** 击杀怪物的总生命值 */
  totalLifeDestroyed: number
  /** 波次持续帧数 */
  waveDurationFrames: number
}

/** 建筑状态快照 */
export interface BuildingSnapshot {
  id: string
  type: BuildingType
  position: Position
  level: number
  /** 本波造成的伤害 */
  damageDealt: number
  /** 本波击杀数 */
  kills: number
}

/** 波次提交响应 */
export interface WaveResponse {
  valid: boolean
  /** 服务端计算的状态（用于同步） */
  serverState: ServerState
  /** 下一波配置（游戏继续时返回） */
  nextWave?: WaveConfig & {
    /** 生命恢复奖励 */
    lifeReward?: number
  }
  /** 验证失败时返回 */
  error?: ApiError
}

/** 服务端状态（用于同步） */
export interface ServerState {
  money: number
  score: number
  life: number
  difficulty: number
}

// ============================================================================
// POST /api/game/sessions/end - 游戏结束
// ============================================================================

/** 游戏结束请求 */
export interface GameEndRequest {
  sessionId: string
  nickname: string
  /** 最后一波数据 */
  lastWave: {
    waveNumber: number
    actions: Action[]
    attacks: AttackEvent[]
    result: WaveResult
    buildings: BuildingSnapshot[]
  }
}

/** 游戏结束响应 */
export interface GameEndResponse {
  verified: boolean
  /** 排名信息 */
  ranking?: RankingInfo
  /** 验证失败时返回 */
  error?: ApiError
}

/** 排名信息 */
export interface RankingInfo {
  /** 本次排名 */
  rank: number
  /** 总参与人数 */
  total: number
  /** 是否创造新纪录 */
  isNewRecord: boolean
}

// ============================================================================
// GET /api/game/leaderboard - 排行榜
// ============================================================================

/** 排行榜响应 */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
}

/** 排行榜条目 */
export interface LeaderboardEntry {
  /** 排名（从 1 开始） */
  rank: number
  /** 玩家昵称 */
  nickname: string
  /** 最终得分 */
  score: number
  /** 完成波次数 */
  wavesCompleted: number
  /** 记录时间（ISO 8601） */
  createdAt: string
}

// ============================================================================
// 通用类型
// ============================================================================

/** API 错误 */
export interface ApiError {
  code: ApiErrorCode
  message: string
}

/** 错误码枚举 */
export type ApiErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'INVALID_REQUEST'
