/**
 * DamageSystem - Damage calculation system
 * Handles damage calculation, score calculation, and kill determination
 * Reference: html5-tower-defense/src/js/td-obj-monster.js:beHit
 */

import type { IMonster } from '@/types/entities'

/** Minimum damage ratio (ensures high-damage weapons have advantage against shielded monsters) */
const MIN_DAMAGE_RATIO = 0.1

/** DamageSystem interface definition */
export interface DamageSystem {
  /**
   * Calculate actual damage
   * Formula: actualDamage = max(rawDamage - shield, ceil(rawDamage * 0.1))
   * @param rawDamage Raw damage value
   * @param shield Shield value
   * @returns Actual damage value
   */
  calculate(rawDamage: number, shield: number): number

  /**
   * Determine whether damage is enough to kill a monster
   * @param monster Monster instance
   * @param damage Damage value (actual damage after shield reduction)
   * @returns Whether the monster is killed
   */
  isKilled(monster: IMonster, damage: number): boolean

  /**
   * Predict whether the attack would kill the monster (considering shield)
   * @param monster Monster instance
   * @param rawDamage Raw damage value
   * @returns Whether it would kill the monster
   */
  wouldKill(monster: IMonster, rawDamage: number): boolean

  /**
   * Get effective damage against a specific monster
   * @param monster Monster instance
   * @param rawDamage Raw damage value
   * @returns Effective damage value
   */
  getEffectiveDamage(monster: IMonster, rawDamage: number): number

  /**
   * Calculate total damage required to kill a monster
   * @param monster Monster instance
   * @returns Total damage required (simplified: life + shield)
   */
  getDamageToKill(monster: IMonster): number
}

/**
 * Create a DamageSystem instance
 */
export function createDamageSystem(): DamageSystem {
  /**
   * Calculate actual damage
   * Formula: actualDamage = max(rawDamage - shield, ceil(rawDamage * 0.1))
   */
  function calculate(rawDamage: number, shield: number): number {
    // Calculate minimum damage (round up, guarantees at least 1 point of damage)
    const minDamage = Math.ceil(rawDamage * MIN_DAMAGE_RATIO)

    // Calculate damage after reduction
    const reducedDamage = rawDamage - shield

    // Take the larger value
    return Math.max(reducedDamage, minDamage)
  }

  /**
   * Determine whether damage is enough to kill a monster
   */
  function isKilled(monster: IMonster, damage: number): boolean {
    return monster.currentLife <= damage
  }

  /**
   * Predict whether the attack would kill the monster (considering shield)
   */
  function wouldKill(monster: IMonster, rawDamage: number): boolean {
    const effectiveDamage = calculate(rawDamage, monster.shield)
    return isKilled(monster, effectiveDamage)
  }

  /**
   * Get effective damage against a specific monster
   */
  function getEffectiveDamage(monster: IMonster, rawDamage: number): number {
    return calculate(rawDamage, monster.shield)
  }

  /**
   * Calculate total damage required to kill a monster (simplified)
   * Shield is a static damage reduction value and does not deplete
   */
  function getDamageToKill(monster: IMonster): number {
    return monster.currentLife + monster.shield
  }

  return {
    calculate,
    isKilled,
    wouldKill,
    getEffectiveDamage,
    getDamageToKill,
  }
}
