/**
 * Wave configuration mock data
 * Data source: docs/BACKEND_GUIDE.md
 */

import type { MonsterConfig, MonsterTypeId, WaveConfig } from '@/types'
import { MOCK_MONSTER_BASE_STATS } from './config'

/**
 * Predefined wave configs (waves 1-10)
 * Source: old implementation td-data-stage-1.js:184-250
 * First 10 waves only use type 0/1/2 basic monsters with progressive difficulty
 */
export const PREDEFINED_WAVES: Record<number, { type: MonsterTypeId; count: number }[]> = {
  1: [{ type: 0, count: 1 }],
  2: [{ type: 0, count: 1 }, { type: 1, count: 1 }],
  3: [{ type: 0, count: 2 }, { type: 1, count: 1 }],
  4: [{ type: 0, count: 2 }, { type: 1, count: 1 }],
  5: [{ type: 0, count: 3 }, { type: 1, count: 2 }],
  6: [{ type: 0, count: 4 }, { type: 1, count: 2 }],
  7: [{ type: 0, count: 5 }, { type: 1, count: 3 }, { type: 2, count: 1 }],
  8: [{ type: 0, count: 6 }, { type: 1, count: 4 }, { type: 2, count: 1 }],
  9: [{ type: 0, count: 7 }, { type: 1, count: 3 }, { type: 2, count: 2 }],
  10: [{ type: 0, count: 8 }, { type: 1, count: 4 }, { type: 2, count: 3 }],
}

/** Generate UUID (simplified version for mock) */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Calculate monster attributes based on difficulty coefficient
 * Formula source: docs/SPEC.md
 * speed is capped by max_speed to prevent monsters from being too fast at high difficulty
 */
function applyDifficulty(
  base: { life: number; speed: number; max_speed: number; shield: number },
  difficulty: number,
): { life: number; speed: number; shield: number } {
  const calculatedSpeed = base.speed + difficulty / 2
  return {
    life: Math.floor(base.life * (difficulty + 1) * 0.5),
    speed: Math.min(calculatedSpeed, base.max_speed),
    shield: Math.floor(base.shield + difficulty / 2),
  }
}

/**
 * Generate wave monster configuration
 * @param waveNumber Wave number
 * @param difficulty Difficulty coefficient
 */
export function generateWaveConfig(waveNumber: number, difficulty: number = 1.0): WaveConfig {
  const waveDefinition = PREDEFINED_WAVES[waveNumber]

  if (!waveDefinition) {
    // Waves 11+ use random generation
    return generateRandomWave(waveNumber, difficulty)
  }

  const monsters: MonsterConfig[] = []

  for (const { type, count } of waveDefinition) {
    const baseStats = MOCK_MONSTER_BASE_STATS[type]
    const adjustedStats = applyDifficulty(baseStats, difficulty)

    for (let i = 0; i < count; i++) {
      monsters.push({
        id: generateUUID(),
        type,
        life: adjustedStats.life,
        speed: adjustedStats.speed,
        shield: adjustedStats.shield,
        money: baseStats.money,
      })
    }
  }

  return {
    waveNumber,
    monsters,
  }
}

/**
 * Generate random wave (wave 11+)
 * Monster count formula: min(wave^1.1, 100)
 * Max 3 of the same type per group
 */
function generateRandomWave(waveNumber: number, difficulty: number): WaveConfig {
  const totalMonsters = Math.min(Math.floor(Math.pow(waveNumber, 1.1)), 100)
  const monsters: MonsterConfig[] = []
  const monsterTypes: MonsterTypeId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]

  let remaining = totalMonsters

  while (remaining > 0) {
    const type = monsterTypes[Math.floor(Math.random() * monsterTypes.length)]
    const count = Math.min(Math.floor(Math.random() * 3) + 1, 3, remaining)
    const baseStats = MOCK_MONSTER_BASE_STATS[type]
    const adjustedStats = applyDifficulty(baseStats, difficulty)

    for (let i = 0; i < count; i++) {
      monsters.push({
        id: generateUUID(),
        type,
        life: adjustedStats.life,
        speed: adjustedStats.speed,
        shield: adjustedStats.shield,
        money: baseStats.money,
      })
    }

    remaining -= count
  }

  return {
    waveNumber,
    monsters,
  }
}

/**
 * Calculate life recovery reward
 * Every 5 waves +5, every 10 waves +10, capped at 100
 */
export function calculateLifeReward(waveNumber: number): number | undefined {
  if (waveNumber % 10 === 0) {
    return 10
  }
  if (waveNumber % 5 === 0) {
    return 5
  }
  return undefined
}
