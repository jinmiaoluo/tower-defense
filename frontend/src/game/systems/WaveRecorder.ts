/**
 * WaveRecorder - Wave recorder
 * Records all actions, attack events, and combat results for each wave
 * Used for server-side verification
 */

import type {
  Action,
  AttackEvent,
  AttackRecordData,
  BuildActionData,
  BuildingSnapshot,
  IWaveRecorder,
  KillRecordData,
  MutableWaveResult,
  PassedRecordData,
  SellActionData,
  UpgradeActionData,
  WaveRequest,
  WaveResult,
} from '@/types'
import { createEmptyMutableResult, toImmutableResult } from '@/types'

/** WaveRecorder type alias */
export type WaveRecorder = IWaveRecorder

/**
 * Create a wave recorder
 * @param waveNumber Wave number
 * @param startFrame Starting frame number
 */
export function createWaveRecorder(waveNumber: number, startFrame: number): WaveRecorder {
  let currentWaveNumber = waveNumber
  let currentStartFrame = startFrame
  let actions: Action[] = []
  let attacks: AttackEvent[] = []
  let result: MutableWaveResult = createEmptyMutableResult()
  let waveDurationFrames = 0

  /**
   * Record a build action
   */
  function recordBuild(data: BuildActionData): void {
    actions.push({
      type: 'BUILD',
      buildingId: data.buildingId,
      buildingType: data.buildingType,
      position: data.position,
      frame: data.frame,
    })
  }

  /**
   * Record an upgrade action
   */
  function recordUpgrade(data: UpgradeActionData): void {
    actions.push({
      type: 'UPGRADE',
      buildingId: data.buildingId,
      level: data.level,
      frame: data.frame,
    })
  }

  /**
   * Record a sell action
   */
  function recordSell(data: SellActionData): void {
    actions.push({
      type: 'SELL',
      buildingId: data.buildingId,
      frame: data.frame,
    })
  }

  /**
   * Record an attack event
   * Also accumulates damage and score
   */
  function recordAttack(data: AttackRecordData): void {
    attacks.push({
      frame: data.frame,
      buildingId: data.buildingId,
      originalTargetId: data.originalTargetId,
      originalTargetPosition: data.originalTargetPosition,
      monsterId: data.monsterId,
      monsterPosition: data.monsterPosition,
      damage: data.damage,
    })

    // Accumulate total damage
    result.totalDamageDealt += data.damage

    // Accumulate score: score = floor(sqrt(damage))
    result.scoreGained += Math.floor(Math.sqrt(data.damage))
  }

  /**
   * Record a monster kill
   */
  function recordKill(data: KillRecordData): void {
    result.killed += 1

    // Accumulate killedByType
    const currentCount = result.killedByType.get(data.monsterType) || 0
    result.killedByType.set(data.monsterType, currentCount + 1)

    // Accumulate money
    result.moneyGained += data.money

    // Accumulate total life destroyed
    result.totalLifeDestroyed += data.monsterLife
  }

  /**
   * Record a monster passing through the exit
   */
  function recordPassed(data: PassedRecordData): void {
    result.passed += 1
    result.lifeLost += data.damage
  }

  /**
   * Record remaining monsters on the field (used for early termination)
   */
  function recordRemainingMonster(monsterId: string): void {
    result.remainingMonsterIds.push(monsterId)
  }

  /**
   * Record monster spawn (called once per monster spawned)
   */
  function recordSpawn(): void {
    result.spawned += 1
  }

  /**
   * Get list of remaining monster IDs on the field
   */
  function getRemainingMonsterIds(): string[] {
    return [...result.remainingMonsterIds]
  }

  /**
   * Set wave duration in frames
   * @param currentFrame Current absolute frame number; internally calculates duration relative to wave start
   */
  function setDuration(currentFrame: number): void {
    waveDurationFrames = currentFrame - currentStartFrame
  }

  /**
   * Get all actions
   */
  function getActions(): Action[] {
    return [...actions]
  }

  /**
   * Get all attack events
   */
  function getAttacks(): AttackEvent[] {
    return [...attacks]
  }

  /**
   * Get wave result
   */
  function getResult(): WaveResult {
    return toImmutableResult(result, waveDurationFrames)
  }

  /**
   * Export as WaveRequest format
   */
  function toWaveRequest(sessionId: string, buildings: BuildingSnapshot[]): WaveRequest {
    return {
      sessionId,
      waveNumber: currentWaveNumber,
      actions: getActions(),
      attacks: getAttacks(),
      result: getResult(),
      buildings,
    }
  }

  /**
   * Reset recorder
   */
  function reset(newWaveNumber: number, newStartFrame: number): void {
    currentWaveNumber = newWaveNumber
    currentStartFrame = newStartFrame
    actions = []
    attacks = []
    result = createEmptyMutableResult()
    waveDurationFrames = 0
  }

  return {
    recordBuild,
    recordUpgrade,
    recordSell,
    recordAttack,
    recordKill,
    recordPassed,
    recordRemainingMonster,
    recordSpawn,
    getRemainingMonsterIds,
    setDuration,
    getActions,
    getAttacks,
    getResult,
    toWaveRequest,
    reset,
  }
}
