/**
 * Game state type definitions
 * Used for Pinia store and game runtime state management
 */

import type { BuildingType, GameConfig, Position } from './config'
import type { ServerState, WaveConfig } from './api'

// ============================================================================
// Game runtime state
// ============================================================================

/** Game phase */
export type GamePhase =
  | 'idle'        // Waiting to start
  | 'preparing'   // Preparing (can place buildings)
  | 'playing'     // Game in progress
  | 'paused'      // Paused
  | 'waveEnd'     // Wave ended, waiting for next wave
  | 'gameOver'    // Game over

/** Game store state */
export interface GameStoreState {
  /** Session ID */
  sessionId: string | null
  /** Game configuration (fetched from server) */
  config: GameConfig | null

  /** Game phase */
  phase: GamePhase
  /** Current frame number */
  currentFrame: number

  /** Money */
  money: number
  /** Life */
  life: number
  /** Score */
  score: number
  /** Difficulty modifier */
  difficulty: number
  /** Current wave number */
  waveNumber: number

  /** Building list */
  buildings: BuildingRuntimeState[]

  /** Current wave configuration */
  currentWave: WaveConfig | null
  /** Pending life recovery reward to apply */
  pendingLifeReward: number
}

/** Building runtime state */
export interface BuildingRuntimeState {
  /** Building unique ID */
  id: string
  /** Building type */
  type: BuildingType
  /** Position */
  position: Position
  /** Level */
  level: number
  /** Damage dealt this wave */
  damageDealt: number
  /** Kills this wave */
  kills: number
  /** Total cost (build + upgrades) */
  totalCost: number
}

// ============================================================================
// UI state
// ============================================================================

/** UI store state */
export interface UIStoreState {
  /** Currently selected building type (for building) */
  selectedBuildingType: BuildingType | null
  /** Currently selected placed building ID (for upgrade/sell) */
  selectedBuildingId: string | null
  /** Whether to show the game over modal */
  showGameOverModal: boolean
  /** Whether to show the leaderboard */
  showLeaderboard: boolean
  /** Error message */
  errorMessage: string | null
  /** Whether to show all building ranges */
  showAllRanges: boolean
  /** Whether to show monster health bars */
  showMonsterHealth: boolean
}

// ============================================================================
// State synchronization
// ============================================================================

/** Data for synchronizing server state */
export interface StateSyncData extends ServerState {
  /** Next wave configuration */
  nextWave?: WaveConfig & {
    lifeReward?: number
  }
}

/** Data for initializing a game */
export interface GameInitData {
  sessionId: string
  config: GameConfig
  firstWave: WaveConfig
}

// ============================================================================
// Operation results
// ============================================================================

/** Building operation result */
export interface BuildingOperationResult {
  success: boolean
  message?: string
  buildingId?: string
}

/** Wave submission result */
export interface WaveSubmitResult {
  success: boolean
  message?: string
  nextWave?: WaveConfig
  lifeReward?: number
}

/** Game end result */
export interface GameEndResult {
  success: boolean
  verified: boolean
  rank?: number
  total?: number
  isNewRecord?: boolean
  message?: string
}
