/**
 * EconomySystem - 经济系统
 * 负责游戏经济相关的计算逻辑，包括建造成本检查、波次生命奖励等
 * 参考旧实现：html5-tower-defense/src/js/td-data-stage-1.js
 */

import type { BuildingType, GameConfig } from '@/types'
import { GAME_CONSTANTS } from '@/types'

/** EconomySystem 接口定义 */
export interface EconomySystem {
  /**
   * 检查是否有足够的金钱建造指定类型的建筑
   * @param money 当前金钱
   * @param buildingType 建筑类型
   */
  canAfford(money: number, buildingType: BuildingType): boolean

  /**
   * 计算波次生命奖励
   * 规则：
   * - 每 10 波：+10 生命
   * - 每 5 波（非 10 的倍数）：+5 生命
   * - 其他波次：0
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

  /**
   * 获取建筑的建造成本
   * @param buildingType 建筑类型
   */
  getBuildCost(buildingType: BuildingType): number
}

/**
 * 创建 EconomySystem 实例
 */
export function createEconomySystem(config: GameConfig): EconomySystem {
  const { buildings } = config

  /**
   * 检查是否能支付建造成本
   */
  function canAfford(money: number, buildingType: BuildingType): boolean {
    const buildingConfig = buildings[buildingType]
    return money >= buildingConfig.cost
  }

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

  /**
   * 获取建造成本
   */
  function getBuildCost(buildingType: BuildingType): number {
    return buildings[buildingType].cost
  }

  return {
    canAfford,
    getLifeReward,
    applyLifeReward,
    getBuildCost,
  }
}
