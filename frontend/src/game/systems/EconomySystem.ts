/**
 * EconomySystem - 经济系统
 * 负责游戏过程中的波次生命恢复奖励计算
 *
 * 注意区分：
 * - EconomySystem.getLifeReward(): 游戏过程中的资源恢复（每 5/10 波恢复生命值）
 * - ScoreSystem.calculateLifeBonus(): 游戏结束时的得分计算（剩余生命转换为分数）
 *
 * 参考旧实现：html5-tower-defense/src/js/td-data-stage-1.js 第 62-73 行
 */

import type { GameConfig } from '@/types'
import { GAME_CONSTANTS } from '@/types'

/** EconomySystem 接口定义 */
export interface EconomySystem {
  /**
   * 计算波次生命恢复奖励（游戏过程中的资源恢复，非得分）
   *
   * 这是游戏过程中每完成一定波次后恢复的生命值，用于帮助玩家持续游戏。
   * 与 ScoreSystem.calculateLifeBonus() 不同，后者是游戏结束时的得分计算。
   *
   * 规则：
   * - 每 10 波：+10 生命
   * - 每 5 波（非 10 的倍数）：+5 生命
   * - 其他波次：0
   *
   * @param waveNumber 当前波次号
   */
  getLifeReward(waveNumber: number): number

  /**
   * 应用生命奖励，考虑生命值上限
   * @param currentLife 当前生命值
   * @param reward 奖励值
   * @returns 应用奖励后的生命值（不超过 MAX_LIFE）
   */
  applyLifeReward(currentLife: number, reward: number): number
}

/**
 * 创建 EconomySystem 实例
 * 注意: canAfford 和 getBuildCost 已移至 BuildingSystem，避免功能重复
 */
export function createEconomySystem(_config: GameConfig): EconomySystem {
  /**
   * 计算波次生命奖励
   * 来源：旧实现 td-data-stage-1.js 第 62-73 行
   *
   * 规则：
   * - 每 10 波：返回 10
   * - 每 5 波（非 10 的倍数）：返回 5
   * - 其他：返回 0
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
   * 应用生命奖励
   * 来源：旧实现 td-data-stage-1.js 第 68-72 行
   *
   * 生命值有上限 100，奖励后不超过此上限
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
