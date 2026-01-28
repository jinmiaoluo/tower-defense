/**
 * EconomySystem - Economy system
 * Handles wave life recovery reward calculation during gameplay
 *
 * Reference: html5-tower-defense/src/js/td-data-stage-1.js lines 62-73
 */

import type { GameConfig } from '@/types'
import { GAME_CONSTANTS } from '@/types'

/** EconomySystem interface definition */
export interface EconomySystem {
  /**
   * Calculate wave life recovery reward (resource recovery during gameplay)
   *
   * Rules:
   * - Every 10 waves: +10 life
   * - Every 5 waves (not a multiple of 10): +5 life
   * - Other waves: 0
   *
   * @param waveNumber Current wave number
   */
  getLifeReward(waveNumber: number): number

  /**
   * Apply life reward, considering life cap
   * @param currentLife Current life value
   * @param reward Reward value
   * @returns Life value after applying reward (capped at MAX_LIFE)
   */
  applyLifeReward(currentLife: number, reward: number): number
}

/**
 * Create an EconomySystem instance
 * Note: canAfford and getBuildCost have been moved to BuildingSystem to avoid duplication
 */
export function createEconomySystem(_config: GameConfig): EconomySystem {
  /**
   * Calculate wave life reward
   * Source: old implementation td-data-stage-1.js lines 62-73
   *
   * Rules:
   * - Every 10 waves: return 10
   * - Every 5 waves (not a multiple of 10): return 5
   * - Others: return 0
   */
  function getLifeReward(waveNumber: number): number {
    if (waveNumber % 10 === 0) {
      return 10
    }
    if (waveNumber % 5 === 0) {
      return 5
    }
    return 0
  }

  /**
   * Apply life reward
   * Source: old implementation td-data-stage-1.js lines 68-72
   *
   * Life has a cap of 100; reward cannot exceed this cap
   */
  function applyLifeReward(currentLife: number, reward: number): number {
    const newLife = currentLife + reward
    return Math.min(newLife, GAME_CONSTANTS.MAX_LIFE)
  }

  return {
    getLifeReward,
    applyLifeReward,
  }
}
