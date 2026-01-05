/**
 * ScoreSystem - 得分计算系统
 * 负责命中得分计算
 *
 * 得分规则（参考 SPEC.md）：
 * - 命中得分 = floor(sqrt(实际伤害))
 * - 最终得分 = 累计命中得分（无额外奖励，直接使用 state.score）
 *
 * 命中得分参考旧实现：html5-tower-defense/src/js/td-obj-monster.js:85
 */

/** ScoreSystem 接口定义 */
export interface ScoreSystem {
  /**
   * 计算单次命中得分
   * 公式: score = floor(sqrt(actualDamage))
   * @param actualDamage 实际伤害值（已扣除护盾后）
   * @returns 得分
   */
  calculateHitScore(actualDamage: number): number

  /**
   * 计算多次攻击的总命中得分
   * @param damages 每次攻击的实际伤害数组
   * @returns 总得分
   */
  calculateTotalHitScore(damages: number[]): number
}

/**
 * 创建 ScoreSystem 实例
 */
export function createScoreSystem(): ScoreSystem {
  /**
   * 计算单次命中得分
   * 参考旧实现：TD.score += Math.floor(Math.sqrt(damage))
   */
  function calculateHitScore(actualDamage: number): number {
    return Math.floor(Math.sqrt(actualDamage))
  }

  /**
   * 计算多次攻击的总命中得分
   */
  function calculateTotalHitScore(damages: number[]): number {
    return damages.reduce((total, damage) => total + calculateHitScore(damage), 0)
  }

  return {
    calculateHitScore,
    calculateTotalHitScore,
  }
}
