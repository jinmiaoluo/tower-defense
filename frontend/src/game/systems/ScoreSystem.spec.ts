/**
 * ScoreSystem test cases
 * Tests hit score calculation logic
 *
 * Scoring rules (reference: SPEC.md):
 * - Hit score = floor(sqrt(actualDamage))
 * - Final score = cumulative hit score (no extra bonus, directly uses state.score)
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createScoreSystem, type ScoreSystem } from './ScoreSystem'

describe('ScoreSystem', () => {
  let system: ScoreSystem

  beforeEach(() => {
    system = createScoreSystem()
  })

  // ============================================================================
  // calculateHitScore - Hit score calculation
  // ============================================================================

  describe('calculateHitScore', () => {
    it('score = floor(sqrt(actualDamage))', () => {
      expect(system.calculateHitScore(1)).toBe(1) // sqrt(1) = 1
      expect(system.calculateHitScore(4)).toBe(2) // sqrt(4) = 2
      expect(system.calculateHitScore(9)).toBe(3) // sqrt(9) = 3
      expect(system.calculateHitScore(16)).toBe(4) // sqrt(16) = 4
      expect(system.calculateHitScore(100)).toBe(10) // sqrt(100) = 10
    })

    it('non-perfect squares are floored', () => {
      expect(system.calculateHitScore(2)).toBe(1) // sqrt(2) = 1.41 -> 1
      expect(system.calculateHitScore(3)).toBe(1) // sqrt(3) = 1.73 -> 1
      expect(system.calculateHitScore(5)).toBe(2) // sqrt(5) = 2.24 -> 2
      expect(system.calculateHitScore(10)).toBe(3) // sqrt(10) = 3.16 -> 3
      expect(system.calculateHitScore(15)).toBe(3) // sqrt(15) = 3.87 -> 3
    })

    it('higher damage yields higher score', () => {
      // HMG single hit 30 damage
      expect(system.calculateHitScore(30)).toBe(5)
      // LMG single hit 5 damage
      expect(system.calculateHitScore(5)).toBe(2)
    })

    it('score is 0 when damage is 0', () => {
      expect(system.calculateHitScore(0)).toBe(0)
    })
  })

  // ============================================================================
  // calculateTotalHitScore - Batch hit score calculation
  // ============================================================================

  describe('calculateTotalHitScore', () => {
    it('calculates total score from multiple attacks', () => {
      // Three attacks: damage 10, 20, 30
      // Score: 3 + 4 + 5 = 12
      const damages = [10, 20, 30]
      expect(system.calculateTotalHitScore(damages)).toBe(12)
    })

    it('returns 0 for an empty array', () => {
      expect(system.calculateTotalHitScore([])).toBe(0)
    })

    it('single attack', () => {
      expect(system.calculateTotalHitScore([25])).toBe(5)
    })
  })
})
