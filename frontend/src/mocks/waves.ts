/**
 * 波次配置 Mock 数据
 * 数据来源：docs/BACKEND_GUIDE.md
 */

import type { MonsterConfig, MonsterTypeId, WaveConfig } from '@/types'
import { MOCK_MONSTER_BASE_STATS } from './config'

/** 预定义波次配置（波次 1-10） */
export const PREDEFINED_WAVES: Record<number, { type: MonsterTypeId; count: number }[]> = {
  1: [{ type: 0, count: 3 }],
  2: [{ type: 0, count: 3 }, { type: 1, count: 2 }],
  3: [{ type: 1, count: 3 }, { type: 2, count: 2 }],
  4: [{ type: 0, count: 2 }, { type: 2, count: 3 }],
  5: [{ type: 1, count: 3 }, { type: 3, count: 1 }],
  6: [{ type: 2, count: 3 }, { type: 4, count: 2 }],
  7: [{ type: 3, count: 2 }, { type: 5, count: 2 }],
  8: [{ type: 4, count: 3 }, { type: 6, count: 2 }],
  9: [{ type: 5, count: 2 }, { type: 7, count: 3 }],
  10: [{ type: 6, count: 2 }, { type: 8, count: 2 }],
}

/** 生成 UUID（简化版，用于 Mock） */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 根据难度系数计算怪物属性
 * 公式来源：docs/SPEC.md
 * speed 受 max_speed 上限限制，防止高难度时怪物过快
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
 * 生成波次怪物配置
 * @param waveNumber 波次号
 * @param difficulty 难度系数
 */
export function generateWaveConfig(waveNumber: number, difficulty: number = 1.0): WaveConfig {
  const waveDefinition = PREDEFINED_WAVES[waveNumber]

  if (!waveDefinition) {
    // 波次 11+ 使用随机生成
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
 * 生成随机波次（波次 11+）
 * 怪物数量公式：min(wave^1.1, 100)
 * 同一类型最多 3 个
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
 * 计算生命恢复奖励
 * 每 5 波 +5，每 10 波 +10，上限 100
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
