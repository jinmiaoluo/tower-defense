/**
 * 游戏状态类型定义
 * 用于 Pinia store 和游戏运行时状态管理
 */

import type { BuildingType, GameConfig, Position } from './config'
import type { ServerState, WaveConfig } from './api'

// ============================================================================
// 游戏运行时状态
// ============================================================================

/** 游戏阶段 */
export type GamePhase =
  | 'idle'        // 等待开始
  | 'preparing'   // 准备中（可放置建筑）
  | 'playing'     // 游戏进行中
  | 'paused'      // 已暂停
  | 'waveEnd'     // 波次结束，等待下一波
  | 'gameOver'    // 游戏结束

/** 游戏 Store 状态 */
export interface GameStoreState {
  /** 会话 ID */
  sessionId: string | null
  /** 游戏配置（从服务端获取） */
  config: GameConfig | null

  /** 游戏阶段 */
  phase: GamePhase
  /** 当前帧号 */
  currentFrame: number

  /** 金钱 */
  money: number
  /** 生命值 */
  life: number
  /** 分数 */
  score: number
  /** 难度系数 */
  difficulty: number
  /** 当前波次 */
  waveNumber: number

  /** 建筑列表 */
  buildings: BuildingRuntimeState[]

  /** 当前波次配置 */
  currentWave: WaveConfig | null
  /** 待应用的生命恢复奖励 */
  pendingLifeReward: number
}

/** 建筑运行时状态 */
export interface BuildingRuntimeState {
  /** 建筑唯一 ID */
  id: string
  /** 建筑类型 */
  type: BuildingType
  /** 位置 */
  position: Position
  /** 等级 */
  level: number
  /** 本波造成的伤害 */
  damageDealt: number
  /** 本波击杀数 */
  kills: number
  /** 累计花费（建造 + 升级） */
  totalCost: number
}

// ============================================================================
// UI 状态
// ============================================================================

/** UI Store 状态 */
export interface UIStoreState {
  /** 当前选中的建筑类型（用于建造） */
  selectedBuildingType: BuildingType | null
  /** 当前选中的已放置建筑 ID（用于升级/出售） */
  selectedBuildingId: string | null
  /** 是否显示游戏结束弹窗 */
  showGameOverModal: boolean
  /** 是否显示排行榜 */
  showLeaderboard: boolean
  /** 错误消息 */
  errorMessage: string | null
  /** 是否显示所有建筑射程 */
  showAllRanges: boolean
  /** 是否显示怪物生命条 */
  showMonsterHealth: boolean
}

// ============================================================================
// 状态同步
// ============================================================================

/** 同步服务端状态的数据 */
export interface StateSyncData extends ServerState {
  /** 下一波配置 */
  nextWave?: WaveConfig & {
    lifeReward?: number
  }
}

/** 初始化游戏的数据 */
export interface GameInitData {
  sessionId: string
  config: GameConfig
  firstWave: WaveConfig
}

// ============================================================================
// 操作结果
// ============================================================================

/** 建筑操作结果 */
export interface BuildingOperationResult {
  success: boolean
  message?: string
  buildingId?: string
}

/** 波次提交结果 */
export interface WaveSubmitResult {
  success: boolean
  message?: string
  nextWave?: WaveConfig
  lifeReward?: number
}

/** 游戏结束结果 */
export interface GameEndResult {
  success: boolean
  verified: boolean
  rank?: number
  total?: number
  isNewRecord?: boolean
  message?: string
}
