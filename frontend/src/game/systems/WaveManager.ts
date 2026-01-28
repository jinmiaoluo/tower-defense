/**
 * WaveManager - Wave manager
 * Handles wave state management and monster spawn scheduling
 * Reference: html5-tower-defense/src/js/td-data-stage-1.js
 */

import type { WaveConfig, MonsterConfig } from '@/types'
import type { IMonster } from '@/types/entities'
import { GAME_CONSTANTS } from '@/types'

const { WAVE_INTERVAL_FRAMES, MONSTER_SPAWN_INTERVAL_FRAMES } = GAME_CONSTANTS

/**
 * Wave state
 * - idle: Waiting to start a new wave
 * - spawning: Spawning monsters
 * - fighting: All monsters spawned, combat in progress
 * - completed: Wave completed (all monsters dead or passed)
 * - interval: Wave interval period (waiting for next wave)
 */
export type WaveState = 'idle' | 'spawning' | 'fighting' | 'completed' | 'interval'

/** Wave statistics */
export interface WaveStats {
  /** Total monsters in this wave */
  totalMonsters: number
  /** Number of monsters spawned */
  spawnedMonsters: number
  /** Number of currently alive monsters */
  aliveMonsters: number
  /** Number of monsters pending spawn */
  pendingMonsters: number
}

/** WaveManager interface definition */
export interface WaveManager {
  /** Get current state */
  getState(): WaveState

  /** Get current wave number */
  getCurrentWaveNumber(): number

  /** Get list of pending monster configs */
  getPendingMonsters(): readonly MonsterConfig[]

  /** Get list of currently alive monsters */
  getAliveMonsters(): readonly IMonster[]

  /** Start a new wave */
  startWave(waveConfig: WaveConfig): void

  /**
   * Per-frame update
   * @param currentFrame Current frame number
   * @returns Monster config to spawn, or null
   */
  update(currentFrame: number): MonsterConfig | null

  /** Register a monster with the manager (for tracking alive status) */
  registerMonster(monster: IMonster): void

  /** Notify that a monster died or reached the exit */
  onMonsterRemoved(monster: IMonster): void

  /** Check if the wave is complete */
  isWaveComplete(): boolean

  /** Start wave interval */
  startInterval(currentFrame: number): void

  /** Check if wave interval has ended */
  isIntervalComplete(currentFrame: number): boolean

  /** End wave interval, return to idle state */
  completeInterval(): void

  /** Get wave statistics */
  getWaveStats(): WaveStats

  /** Reset manager state */
  reset(): void
}

/**
 * Create a WaveManager instance
 */
export function createWaveManager(): WaveManager {
  let state: WaveState = 'idle'
  let waveNumber = 0
  let totalMonsters = 0
  let pendingMonsters: MonsterConfig[] = []
  let aliveMonsters: IMonster[] = []

  let lastSpawnFrame = -MONSTER_SPAWN_INTERVAL_FRAMES
  let intervalStartFrame = 0

  return {
    getState(): WaveState {
      return state
    },

    getCurrentWaveNumber(): number {
      return waveNumber
    },

    getPendingMonsters(): readonly MonsterConfig[] {
      return pendingMonsters
    },

    getAliveMonsters(): readonly IMonster[] {
      return aliveMonsters
    },

    startWave(waveConfig: WaveConfig): void {
      if (state !== 'idle') {
        throw new Error(`Cannot start wave in ${state} state. Must be idle.`)
      }

      waveNumber = waveConfig.waveNumber
      totalMonsters = waveConfig.monsters.length
      pendingMonsters = [...waveConfig.monsters]
      aliveMonsters = []
      lastSpawnFrame = -MONSTER_SPAWN_INTERVAL_FRAMES // Ensure first frame spawns immediately
      state = 'spawning'
    },

    update(currentFrame: number): MonsterConfig | null {
      // No processing in idle or interval state
      if (state === 'idle' || state === 'interval') {
        return null
      }

      // No spawning in completed state, but no error
      if (state === 'completed') {
        return null
      }

      // Spawning state: check if next monster can be spawned
      if (state === 'spawning') {
        if (pendingMonsters.length > 0) {
          const framesSinceLastSpawn = currentFrame - lastSpawnFrame

          if (framesSinceLastSpawn >= MONSTER_SPAWN_INTERVAL_FRAMES) {
            const monsterConfig = pendingMonsters.shift()!
            lastSpawnFrame = currentFrame
            return monsterConfig
          }
        } else {
          // All monsters spawned, transition to fighting state
          state = 'fighting'
        }
      }

      // Fighting state: check if all monsters are dead or passed
      if (state === 'fighting') {
        if (aliveMonsters.length === 0 && pendingMonsters.length === 0) {
          state = 'completed'
        }
      }

      return null
    },

    registerMonster(monster: IMonster): void {
      aliveMonsters.push(monster)
    },

    onMonsterRemoved(monster: IMonster): void {
      const index = aliveMonsters.indexOf(monster)
      if (index !== -1) {
        aliveMonsters.splice(index, 1)
      }
    },

    isWaveComplete(): boolean {
      if (state === 'idle' || state === 'interval') {
        return false
      }

      // Pending or alive monsters remain, wave not complete
      if (pendingMonsters.length > 0 || aliveMonsters.length > 0) {
        return false
      }

      return true
    },

    startInterval(currentFrame: number): void {
      if (state !== 'completed') {
        throw new Error(`Cannot start interval in ${state} state. Must be completed.`)
      }

      intervalStartFrame = currentFrame
      state = 'interval'
    },

    isIntervalComplete(currentFrame: number): boolean {
      if (state !== 'interval') {
        return false
      }

      const framesSinceIntervalStart = currentFrame - intervalStartFrame
      return framesSinceIntervalStart >= WAVE_INTERVAL_FRAMES
    },

    completeInterval(): void {
      if (state !== 'interval') {
        throw new Error(`Cannot complete interval in ${state} state. Must be interval.`)
      }

      state = 'idle'
      intervalStartFrame = 0
    },

    getWaveStats(): WaveStats {
      const spawnedMonsters = totalMonsters - pendingMonsters.length

      return {
        totalMonsters,
        spawnedMonsters,
        aliveMonsters: aliveMonsters.length,
        pendingMonsters: pendingMonsters.length,
      }
    },

    reset(): void {
      state = 'idle'
      waveNumber = 0
      totalMonsters = 0
      pendingMonsters = []
      aliveMonsters = []
      lastSpawnFrame = -MONSTER_SPAWN_INTERVAL_FRAMES
      intervalStartFrame = 0
    },
  }
}
