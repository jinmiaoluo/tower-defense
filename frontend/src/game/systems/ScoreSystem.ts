/**
 * ScoreSystem - Score calculation system
 * Handles hit score calculation
 *
 * Score rules (reference: SPEC.md):
 * - Hit score = floor(sqrt(actual damage))
 * - Final score = cumulative hit score (no extra bonuses, uses state.score directly)
 *
 * Hit score reference: html5-tower-defense/src/js/td-obj-monster.js:85
 */

/** ScoreSystem interface definition */
export interface ScoreSystem {
  /**
   * Calculate single hit score
   * Formula: score = floor(sqrt(actualDamage))
   * @param actualDamage Actual damage value (after shield reduction)
   * @returns Score
   */
  calculateHitScore(actualDamage: number): number

  /**
   * Calculate total hit score from multiple attacks
   * @param damages Array of actual damage values per attack
   * @returns Total score
   */
  calculateTotalHitScore(damages: number[]): number
}

/**
 * Create a ScoreSystem instance
 */
export function createScoreSystem(): ScoreSystem {
  /**
   * Calculate single hit score
   * Reference: TD.score += Math.floor(Math.sqrt(damage))
   */
  function calculateHitScore(actualDamage: number): number {
    return Math.floor(Math.sqrt(actualDamage))
  }

  /**
   * Calculate total hit score from multiple attacks
   */
  function calculateTotalHitScore(damages: number[]): number {
    return damages.reduce((total, damage) => total + calculateHitScore(damage), 0)
  }

  return {
    calculateHitScore,
    calculateTotalHitScore,
  }
}
