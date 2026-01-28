/**
 * Wave configuration tests
 * Verify predefined wave configs match old implementation (td-data-stage-1.js:184-250)
 */

import { describe, expect, it } from 'vitest'
import { PREDEFINED_WAVES, generateWaveConfig } from './waves'

/**
 * Predefined wave configs from old implementation (source: td-data-stage-1.js:184-250)
 * Format: [[count, type], ...]
 */
const OLD_IMPLEMENTATION_WAVES: Record<number, [number, number][]> = {
  1: [[1, 0]],
  2: [[1, 0], [1, 1]],
  3: [[2, 0], [1, 1]],
  4: [[2, 0], [1, 1]],
  5: [[3, 0], [2, 1]],
  6: [[4, 0], [2, 1]],
  7: [[5, 0], [3, 1], [1, 2]],
  8: [[6, 0], [4, 1], [1, 2]],
  9: [[7, 0], [3, 1], [2, 2]],
  10: [[8, 0], [4, 1], [3, 2]],
}

describe('PREDEFINED_WAVES', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('wave %i should match old implementation', (waveNumber) => {
    const oldWave = OLD_IMPLEMENTATION_WAVES[waveNumber]
    const newWave = PREDEFINED_WAVES[waveNumber]

    // Convert old format to new format for comparison
    const expectedGroups = oldWave.map(([count, type]) => ({ type, count }))

    expect(newWave).toEqual(expectedGroups)
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('wave %i should have correct total monster count', (waveNumber) => {
    const oldWave = OLD_IMPLEMENTATION_WAVES[waveNumber]
    const newWave = PREDEFINED_WAVES[waveNumber]

    const expectedTotal = oldWave.reduce((sum, [count]) => sum + count, 0)
    const actualTotal = newWave.reduce((sum, group) => sum + group.count, 0)

    expect(actualTotal).toBe(expectedTotal)
  })

  // Detailed monster count validation for waves 1-10
  const expectedTotals: Record<number, number> = {
    1: 1,
    2: 2,
    3: 3,
    4: 3,
    5: 5,
    6: 6,
    7: 9,
    8: 11,
    9: 12,
    10: 15,
  }

  it.each(Object.entries(expectedTotals))('wave %s should have %i monsters', (waveStr, expectedCount) => {
    const waveNumber = parseInt(waveStr)
    const wave = PREDEFINED_WAVES[waveNumber]
    const actualCount = wave.reduce((sum, group) => sum + group.count, 0)

    expect(actualCount).toBe(expectedCount)
  })
})

describe('generateWaveConfig', () => {
  it('should generate correct number of monsters for predefined waves', () => {
    const wave1 = generateWaveConfig(1, 1.0)
    expect(wave1.monsters).toHaveLength(1)

    const wave5 = generateWaveConfig(5, 1.0)
    expect(wave5.monsters).toHaveLength(5)

    const wave10 = generateWaveConfig(10, 1.0)
    expect(wave10.monsters).toHaveLength(15)
  })

  it('should use correct monster types for wave 1-10', () => {
    // Wave 1: only type 0
    const wave1 = generateWaveConfig(1, 1.0)
    expect(wave1.monsters.every(m => m.type === 0)).toBe(true)

    // Wave 2: type 0 and type 1
    const wave2 = generateWaveConfig(2, 1.0)
    const types2 = new Set(wave2.monsters.map(m => m.type))
    expect(types2.has(0)).toBe(true)
    expect(types2.has(1)).toBe(true)

    // Waves 7-10 start including type 2
    const wave7 = generateWaveConfig(7, 1.0)
    const types7 = new Set(wave7.monsters.map(m => m.type))
    expect(types7.has(2)).toBe(true)
  })

  it('should generate unique UUIDs for each monster', () => {
    const wave = generateWaveConfig(10, 1.0)
    const ids = wave.monsters.map(m => m.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
  })

  describe('wave 11+ auto-generation', () => {
    it('should calculate total monsters as min(wave^1.1, 100)', () => {
      // Wave 11: floor(11^1.1) = 13
      const wave11 = generateWaveConfig(11, 1.0)
      expect(wave11.monsters.length).toBe(Math.floor(Math.pow(11, 1.1)))

      // Wave 20: floor(20^1.1) = 26
      const wave20 = generateWaveConfig(20, 1.0)
      expect(wave20.monsters.length).toBe(Math.floor(Math.pow(20, 1.1)))

      // Wave 100+: capped at 100
      const wave100 = generateWaveConfig(100, 1.0)
      expect(wave100.monsters.length).toBeLessThanOrEqual(100)
    })
  })
})
