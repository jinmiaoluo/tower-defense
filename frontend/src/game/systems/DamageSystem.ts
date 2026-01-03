/**
 * DamageSystem - 伤害计算系统
 * 负责伤害计算、得分计算和击杀判定
 * 参考旧实现：html5-tower-defense/src/js/td-obj-monster.js:beHit
 */

import type { IMonster } from '@/types/entities'

/** 最低伤害比例（保证高伤害武器对护盾怪的优势） */
const MIN_DAMAGE_RATIO = 0.1

/** DamageSystem 接口定义 */
export interface DamageSystem {
  /**
   * 计算实际伤害
   * 公式: actualDamage = max(rawDamage - shield, ceil(rawDamage × 0.1))
   * @param rawDamage 原始伤害值
   * @param shield 护盾值
   * @returns 实际伤害值
   */
  calculate(rawDamage: number, shield: number): number

  /**
   * 判断伤害是否足以击杀怪物
   * @param monster 怪物实例
   * @param damage 伤害值（已扣除护盾后的实际伤害）
   * @returns 是否击杀
   */
  isKilled(monster: IMonster, damage: number): boolean

  /**
   * 预判是否会击杀怪物（考虑护盾）
   * @param monster 怪物实例
   * @param rawDamage 原始伤害值
   * @returns 是否会击杀
   */
  wouldKill(monster: IMonster, rawDamage: number): boolean

  /**
   * 获取对特定怪物的有效伤害
   * @param monster 怪物实例
   * @param rawDamage 原始伤害值
   * @returns 有效伤害值
   */
  getEffectiveDamage(monster: IMonster, rawDamage: number): number

  /**
   * 计算击杀怪物所需的总伤害
   * @param monster 怪物实例
   * @returns 所需总伤害（简化计算：生命 + 护盾）
   */
  getDamageToKill(monster: IMonster): number
}

/**
 * 创建 DamageSystem 实例
 */
export function createDamageSystem(): DamageSystem {
  /**
   * 计算实际伤害
   * 公式: actualDamage = max(rawDamage - shield, ceil(rawDamage × 0.1))
   */
  function calculate(rawDamage: number, shield: number): number {
    // 计算最低伤害（向上取整，保证至少 1 点伤害）
    const minDamage = Math.ceil(rawDamage * MIN_DAMAGE_RATIO)

    // 计算减免后伤害
    const reducedDamage = rawDamage - shield

    // 取两者较大值
    return Math.max(reducedDamage, minDamage)
  }

  /**
   * 判断伤害是否足以击杀怪物
   */
  function isKilled(monster: IMonster, damage: number): boolean {
    return monster.currentLife <= damage
  }

  /**
   * 预判是否会击杀怪物（考虑护盾）
   */
  function wouldKill(monster: IMonster, rawDamage: number): boolean {
    const effectiveDamage = calculate(rawDamage, monster.shield)
    return isKilled(monster, effectiveDamage)
  }

  /**
   * 获取对特定怪物的有效伤害
   */
  function getEffectiveDamage(monster: IMonster, rawDamage: number): number {
    return calculate(rawDamage, monster.shield)
  }

  /**
   * 计算击杀怪物所需的总伤害（简化计算）
   * 护盾是静态减伤值，不会递减
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
