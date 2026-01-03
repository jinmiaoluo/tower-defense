/**
 * BuildingSystem - 建筑系统
 * 负责建筑相关的计算逻辑，包括成本、伤害、射程等
 * 参考旧实现：html5-tower-defense/src/js/td-obj-building.js
 */

import type { BuildingConfig, BuildingType, GameConfig, Position } from '@/types'
import { GAME_CONSTANTS, getUpgradeMultiplier, calculateDistance } from '@/types'

/** 用于射程检查的建筑信息 */
export interface BuildingForRangeCheck {
  type: BuildingType
  level: number
  position: Position
}

/** BuildingSystem 接口定义 */
export interface BuildingSystem {
  /**
   * 计算建筑累计花费（建造成本 + 所有升级成本）
   * @param type 建筑类型
   * @param level 当前等级
   */
  getTotalCost(type: BuildingType, level: number): number

  /**
   * 计算从当前等级升级到下一级的成本
   * @param type 建筑类型
   * @param level 当前等级
   */
  getUpgradeCost(type: BuildingType, level: number): number

  /**
   * 计算出售建筑可回收的金钱
   * @param type 建筑类型
   * @param level 当前等级
   */
  getSellIncome(type: BuildingType, level: number): number

  /**
   * 计算指定等级的伤害值
   * @param type 建筑类型
   * @param level 当前等级
   */
  getDamageAtLevel(type: BuildingType, level: number): number

  /**
   * 计算指定等级的射程
   * @param type 建筑类型
   * @param level 当前等级
   */
  getRangeAtLevel(type: BuildingType, level: number): number

  /**
   * 检查目标是否在建筑的攻击范围内
   * @param building 建筑信息
   * @param targetPos 目标位置
   */
  isInRange(building: BuildingForRangeCheck, targetPos: Position): boolean

  /**
   * 获取攻击间隔帧数
   * @param type 建筑类型
   */
  getAttackSpeedFrames(type: BuildingType): number

  /**
   * 检查是否有足够的金钱建造建筑
   * @param money 当前金钱
   * @param type 建筑类型
   */
  canAfford(money: number, type: BuildingType): boolean

  /**
   * 检查是否有足够的金钱升级建筑
   * @param money 当前金钱
   * @param type 建筑类型
   * @param level 当前等级
   */
  canAffordUpgrade(money: number, type: BuildingType, level: number): boolean

  /**
   * 判断建筑是否为武器（可攻击）
   * @param type 建筑类型
   */
  isWeapon(type: BuildingType): boolean

  /**
   * 获取建筑配置
   * @param type 建筑类型
   */
  getBuildingConfig(type: BuildingType): BuildingConfig
}

/**
 * 创建 BuildingSystem 实例
 */
export function createBuildingSystem(config: GameConfig): BuildingSystem {
  const { buildings } = config

  /**
   * 计算累计花费
   * 公式: totalCost(level) = cost + Σ(totalCost(i) × upgradeCostRatio) for i=1 to level-1
   */
  function getTotalCost(type: BuildingType, level: number): number {
    const buildingConfig = buildings[type]
    const { cost, upgradeCostRatio } = buildingConfig

    let total = cost
    for (let i = 1; i < level; i++) {
      total += Math.floor(total * upgradeCostRatio)
    }
    return total
  }

  /**
   * 计算升级成本
   * 公式: upgradeCost = totalCost(currentLevel) × upgradeCostRatio
   */
  function getUpgradeCost(type: BuildingType, level: number): number {
    const buildingConfig = buildings[type]
    const totalCost = getTotalCost(type, level)
    return Math.floor(totalCost * buildingConfig.upgradeCostRatio)
  }

  /**
   * 计算出售回收金额
   * 公式: sellIncome = max(totalCost × sellRatio, 1)
   */
  function getSellIncome(type: BuildingType, level: number): number {
    const buildingConfig = buildings[type]
    const totalCost = getTotalCost(type, level)
    const income = Math.floor(totalCost * buildingConfig.sellRatio)
    return Math.max(income, 1)
  }

  /**
   * 计算指定等级的伤害值
   * 使用升级倍率逐级计算
   */
  function getDamageAtLevel(type: BuildingType, level: number): number {
    const buildingConfig = buildings[type]
    let damage = buildingConfig.damage

    if (damage === 0) {
      return 0
    }

    for (let i = 1; i < level; i++) {
      const multiplier = getUpgradeMultiplier(type, i)
      damage = Math.floor(damage * multiplier)
    }

    return damage
  }

  /**
   * 计算指定等级的射程
   * 公式: range = min(baseRange × level^0.1, maxRange)
   */
  function getRangeAtLevel(type: BuildingType, level: number): number {
    const buildingConfig = buildings[type]
    const { range, max_range } = buildingConfig

    if (range === 0) {
      return 0
    }

    const levelFactor = Math.pow(level, 0.1)
    const calculatedRange = range * levelFactor
    return Math.min(Math.floor(calculatedRange), max_range)
  }

  /**
   * 检查目标是否在射程内
   * 射程规则:
   * - range: 最小射程（太近无法攻击）
   * - max_range: 最大射程（太远无法攻击）
   * - 实际射程会随等级提升
   */
  function isInRange(building: BuildingForRangeCheck, targetPos: Position): boolean {
    const { type, level, position } = building
    const buildingConfig = buildings[type]

    if (buildingConfig.range === 0 || buildingConfig.speed === 0) {
      return false
    }

    const distance = calculateDistance(position, targetPos)
    const levelFactor = Math.pow(level, 0.1)
    const minRange = buildingConfig.range * levelFactor
    const maxRange = Math.min(buildingConfig.max_range * levelFactor, buildingConfig.max_range)

    return distance >= minRange && distance <= maxRange
  }

  /**
   * 获取攻击间隔帧数
   * 参考旧实现 td-obj-building.js:168
   * 旧公式: floor(max(2 / (speed * global_speed), 1))
   * 其中 global_speed = 0.1，简化为 floor(20 / speed)
   *
   * 由于帧率差异（旧 24 FPS，新 60 FPS），需要乘以帧率比例
   * 新公式: floor(max(2 / (speed * global_speed) * (60 / 24), 1))
   *       = floor(max(20 / speed * 2.5, 1))
   *       = floor(max(50 / speed, 1))
   */
  function getAttackSpeedFrames(type: BuildingType): number {
    const buildingConfig = buildings[type]
    const { speed } = buildingConfig

    if (speed === 0) {
      return Infinity
    }

    // 旧实现基础攻击间隔：2 / (speed * GLOBAL_SPEED) = 20 / speed 帧（24 FPS）
    // 换算到 60 FPS：乘以帧率比例 60 / 24 = 2.5
    const OLD_FPS = 24
    const baseInterval = 2 / (speed * GAME_CONSTANTS.GLOBAL_SPEED)
    const scaledInterval = baseInterval * (GAME_CONSTANTS.FPS / OLD_FPS)

    return Math.max(Math.floor(scaledInterval), 1)
  }

  /**
   * 检查是否能负担建造成本
   */
  function canAfford(money: number, type: BuildingType): boolean {
    const buildingConfig = buildings[type]
    return money >= buildingConfig.cost
  }

  /**
   * 检查是否能负担升级成本
   */
  function canAffordUpgrade(money: number, type: BuildingType, level: number): boolean {
    const cost = getUpgradeCost(type, level)
    return money >= cost
  }

  /**
   * 判断是否为武器建筑
   */
  function isWeapon(type: BuildingType): boolean {
    return type !== 'wall'
  }

  /**
   * 获取建筑配置
   */
  function getBuildingConfig(type: BuildingType): BuildingConfig {
    return buildings[type]
  }

  return {
    getTotalCost,
    getUpgradeCost,
    getSellIncome,
    getDamageAtLevel,
    getRangeAtLevel,
    isInRange,
    getAttackSpeedFrames,
    canAfford,
    canAffordUpgrade,
    isWeapon,
    getBuildingConfig,
  }
}
