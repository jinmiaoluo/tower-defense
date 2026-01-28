/**
 * Wave recorder type definitions
 * Used by the WaveRecorder system to record game data
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

// Re-export common types
export type {
  Action,
  ActionType,
  AttackEvent,
  BuildingSnapshot,
  WaveRequest,
  WaveResult,
}

// ============================================================================
// Internal record types (for cumulative statistics)
// ============================================================================

/** Wave record internal state */
export interface WaveRecordState {
  waveNumber: number
  startFrame: number
  actions: Action[]
  attacks: AttackEvent[]
  result: MutableWaveResult
}

/** Mutable wave result (for internal use) */
export interface MutableWaveResult {
  killed: number
  killedByType: Map<MonsterTypeId, number>
  passed: number
  remainingMonsterIds: string[]
  spawned: number
  scoreGained: number
  moneyGained: number
  lifeLost: number
  totalDamageDealt: number
  totalLifeDestroyed: number
}

// ============================================================================
// Build action data
// ============================================================================

/** Build action data */
export interface BuildActionData {
  buildingId: string
  buildingType: BuildingType
  position: Position
  frame: number
}

/** Upgrade action data */
export interface UpgradeActionData {
  buildingId: string
  level: number
  frame: number
}

/** Sell action data */
export interface SellActionData {
  buildingId: string
  frame: number
}

// ============================================================================
// Attack record data
// ============================================================================

/** Attack record data */
export interface AttackRecordData {
  buildingId: string
  /** Monster ID targeted at the time of firing (used to verify the building had a valid target) */
  originalTargetId: string
  /** Grid coordinates of the target at the time of firing (used for range verification) */
  originalTargetPosition: Position
  /** Monster ID actually hit, may differ from originalTargetId ("friendly fire") */
  monsterId: string
  /** Grid coordinates of the monster when hit (used for path verification) */
  monsterPosition: Position
  damage: number
  frame: number
}

// ============================================================================
// Kill/pass records
// ============================================================================

/** Monster kill data */
export interface KillRecordData {
  monsterType: MonsterTypeId
  monsterLife: number
  money: number
}

/** Monster passed through exit data */
export interface PassedRecordData {
  /** Damage dealt when the monster reaches the exit (deducted from player life) */
  damage: number
}

// ============================================================================
// WaveRecorder interface
// ============================================================================

/** WaveRecorder interface definition */
export interface IWaveRecorder {
  /** Record a build action */
  recordBuild(data: BuildActionData): void

  /** Record an upgrade action */
  recordUpgrade(data: UpgradeActionData): void

  /** Record a sell action */
  recordSell(data: SellActionData): void

  /**
   * Record an attack event
   * Also accumulates score: scoreGained += floor(sqrt(damage))
   */
  recordAttack(data: AttackRecordData): void

  /** Record a monster kill (for kill count and money reward statistics, does not compute score) */
  recordKill(data: KillRecordData): void

  /** Record a monster passing through the exit */
  recordPassed(data: PassedRecordData): void

  /** Record a remaining monster on the field (used when ending early) */
  recordRemainingMonster(monsterId: string): void

  /** Record a monster spawn (called once per monster spawned) */
  recordSpawn(): void

  /** Get the list of remaining monster IDs on the field */
  getRemainingMonsterIds(): string[]

  /** Set the wave duration in frames */
  setDuration(frames: number): void

  /** Get all actions */
  getActions(): Action[]

  /** Get all attack events */
  getAttacks(): AttackEvent[]

  /** Get the wave result */
  getResult(): WaveResult

  /** Export as WaveRequest format */
  toWaveRequest(sessionId: string, buildings: BuildingSnapshot[]): WaveRequest

  /** Reset the recorder (start a new wave) */
  reset(waveNumber: number, startFrame: number): void
}

// ============================================================================
// Helper function types
// ============================================================================

/** Convert a Map to a Record */
export function mapToRecord<K extends number, V>(
  map: Map<K, V>,
): Record<K, V> {
  const record = {} as Record<K, V>
  map.forEach((value, key) => {
    record[key] = value
  })
  return record
}

/** Create an empty mutable wave result */
export function createEmptyMutableResult(): MutableWaveResult {
  return {
    killed: 0,
    killedByType: new Map(),
    passed: 0,
    remainingMonsterIds: [],
    spawned: 0,
    scoreGained: 0,
    moneyGained: 0,
    lifeLost: 0,
    totalDamageDealt: 0,
    totalLifeDestroyed: 0,
  }
}

/** Convert a mutable result to an immutable result */
export function toImmutableResult(
  mutable: MutableWaveResult,
  waveDurationFrames: number,
): WaveResult {
  const result: WaveResult = {
    killed: mutable.killed,
    killedByType: mapToRecord(mutable.killedByType),
    passed: mutable.passed,
    spawned: mutable.spawned,
    scoreGained: mutable.scoreGained,
    moneyGained: mutable.moneyGained,
    lifeLost: mutable.lifeLost,
    totalDamageDealt: mutable.totalDamageDealt,
    totalLifeDestroyed: mutable.totalLifeDestroyed,
    waveDurationFrames,
  }

  // Only add these fields when there are remaining monsters
  if (mutable.remainingMonsterIds.length > 0) {
    result.remaining = mutable.remainingMonsterIds.length
    result.remainingMonsterIds = [...mutable.remainingMonsterIds]
  }

  return result
}
