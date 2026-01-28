/**
 * BuildingSystem - Building system
 * Handles building-related calculations including cost, damage, range, etc.
 * Reference: html5-tower-defense/src/js/td-obj-building.js
 */

import type { BuildingConfig, BuildingType, GameConfig, Position } from '@/types'
import { GAME_CONSTANTS, getUpgradeMultiplier, calculateDistance } from '@/types'

/** Building info for range checking */
export interface BuildingForRangeCheck {
  type: BuildingType
  level: number
  position: Position
}

/** BuildingSystem interface definition */
export interface BuildingSystem {
  /**
   * Calculate cumulative building cost (build cost + all upgrade costs)
   * @param type Building type
   * @param level Current level
   */
  getTotalCost(type: BuildingType, level: number): number

  /**
   * Calculate the cost to upgrade from current level to the next
   * @param type Building type
   * @param level Current level
   */
  getUpgradeCost(type: BuildingType, level: number): number

  /**
   * Calculate the money recovered from selling a building
   * @param type Building type
   * @param level Current level
   */
  getSellIncome(type: BuildingType, level: number): number

  /**
   * Calculate damage at a given level
   * @param type Building type
   * @param level Current level
   */
  getDamageAtLevel(type: BuildingType, level: number): number

  /**
   * Calculate range at a given level
   * @param type Building type
   * @param level Current level
   */
  getRangeAtLevel(type: BuildingType, level: number): number

  /**
   * Check whether a target is within the building's attack range
   * @param building Building info
   * @param targetPos Target position
   */
  isInRange(building: BuildingForRangeCheck, targetPos: Position): boolean

  /**
   * Get attack interval in frames
   * @param type Building type
   */
  getAttackSpeedFrames(type: BuildingType): number

  /**
   * Check whether there is enough money to build
   * @param money Current money
   * @param type Building type
   */
  canAfford(money: number, type: BuildingType): boolean

  /**
   * Check whether there is enough money to upgrade
   * @param money Current money
   * @param type Building type
   * @param level Current level
   */
  canAffordUpgrade(money: number, type: BuildingType, level: number): boolean

  /**
   * Determine whether a building is a weapon (can attack)
   * @param type Building type
   */
  isWeapon(type: BuildingType): boolean

  /**
   * Get building configuration
   * @param type Building type
   */
  getBuildingConfig(type: BuildingType): BuildingConfig
}

/**
 * Create a BuildingSystem instance
 */
export function createBuildingSystem(config: GameConfig): BuildingSystem {
  const { buildings } = config

  /**
   * Calculate cumulative cost
   * Formula: totalCost(level) = cost + sum(totalCost(i) * upgradeCostRatio) for i=1 to level-1
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
   * Calculate upgrade cost
   * Formula: upgradeCost = totalCost(currentLevel) * upgradeCostRatio
   */
  function getUpgradeCost(type: BuildingType, level: number): number {
    const buildingConfig = buildings[type]
    const totalCost = getTotalCost(type, level)
    return Math.floor(totalCost * buildingConfig.upgradeCostRatio)
  }

  /**
   * Calculate sell income
   * Formula: sellIncome = max(totalCost * sellRatio, 1)
   */
  function getSellIncome(type: BuildingType, level: number): number {
    const buildingConfig = buildings[type]
    const totalCost = getTotalCost(type, level)
    const income = Math.floor(totalCost * buildingConfig.sellRatio)
    return Math.max(income, 1)
  }

  /**
   * Calculate damage at a given level
   * Uses upgrade multiplier calculated level by level
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
   * Calculate range at a given level
   * Formula: range = min(baseRange * 1.2^(level-1), maxRange)
   * Reference: td-obj-building.js:258-289, using default upgrade rule x1.2 per level
   */
  function getRangeAtLevel(type: BuildingType, level: number): number {
    const buildingConfig = buildings[type]
    const { range, max_range } = buildingConfig

    if (range === 0) {
      return 0
    }

    // Calculate level by level: x1.2 per level, consistent with damage upgrade rule
    let currentRange = range
    for (let i = 1; i < level; i++) {
      currentRange = currentRange * 1.2
    }
    return Math.min(Math.floor(currentRange), max_range)
  }

  /**
   * Check whether the target is within range
   * Range rules (reference: td-obj-building.js:187-204):
   * - range: initial range (value at level 1)
   * - max_range: maximum range after upgrades
   * - No minimum range restriction; building can attack any target from 0 to current range
   */
  function isInRange(building: BuildingForRangeCheck, targetPos: Position): boolean {
    const { type, level, position } = building
    const buildingConfig = buildings[type]

    if (buildingConfig.range === 0 || buildingConfig.speed === 0) {
      return false
    }

    const distance = calculateDistance(position, targetPos)
    const currentRange = getRangeAtLevel(type, level)

    // Only check maximum range, no minimum range restriction
    return distance <= currentRange
  }

  /**
   * Get attack interval in frames
   * Reference: td-obj-building.js:168
   * Old formula: floor(max(2 / (speed * global_speed), 1))
   * where global_speed = 0.1, simplified to floor(20 / speed)
   *
   * Due to frame rate difference (old 24 FPS, new 60 FPS), multiply by frame rate ratio
   * New formula: floor(max(2 / (speed * global_speed) * (60 / 24), 1))
   *            = floor(max(20 / speed * 2.5, 1))
   *            = floor(max(50 / speed, 1))
   */
  function getAttackSpeedFrames(type: BuildingType): number {
    const buildingConfig = buildings[type]
    const { speed } = buildingConfig

    if (speed === 0) {
      return Infinity
    }

    // Old implementation base attack interval: 2 / (speed * GLOBAL_SPEED) = 20 / speed frames (24 FPS)
    // Convert to 60 FPS: multiply by frame rate ratio 60 / 24 = 2.5
    const OLD_FPS = 24
    const baseInterval = 2 / (speed * GAME_CONSTANTS.GLOBAL_SPEED)
    const scaledInterval = baseInterval * (GAME_CONSTANTS.FPS / OLD_FPS)

    return Math.max(Math.floor(scaledInterval), 1)
  }

  /**
   * Check whether the player can afford to build
   */
  function canAfford(money: number, type: BuildingType): boolean {
    const buildingConfig = buildings[type]
    return money >= buildingConfig.cost
  }

  /**
   * Check whether the player can afford to upgrade
   */
  function canAffordUpgrade(money: number, type: BuildingType, level: number): boolean {
    const cost = getUpgradeCost(type, level)
    return money >= cost
  }

  /**
   * Determine whether a building is a weapon
   */
  function isWeapon(type: BuildingType): boolean {
    return type !== 'wall'
  }

  /**
   * Get building configuration
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
