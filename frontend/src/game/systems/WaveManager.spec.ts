/**
 * WaveManager tests
 * Written in TDD style, tests before implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createWaveManager,
  type WaveManager,
} from './WaveManager'
import type { WaveConfig, MonsterConfig } from '@/types'
import type { IMonster } from '@/types/entities'
import type { MonsterTypeId, Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { WAVE_INTERVAL_FRAMES, MONSTER_SPAWN_INTERVAL_FRAMES } = GAME_CONSTANTS

// ============================================================================
// Mock factory functions
// ============================================================================

function createMockMonsterConfig(overrides: Partial<MonsterConfig> = {}): MonsterConfig {
  return {
    id: `monster-${Math.random().toString(36).slice(2, 8)}`,
    type: 0 as MonsterTypeId,
    life: 50,
    speed: 3,
    shield: 0,
    money: 5,
    ...overrides,
  }
}

function createMockWaveConfig(
  waveNumber: number,
  monsterCount: number = 3,
): WaveConfig {
  const monsters: MonsterConfig[] = []
  for (let i = 0; i < monsterCount; i++) {
    monsters.push(createMockMonsterConfig({ id: `m-${waveNumber}-${i}` }))
  }
  return {
    waveNumber,
    monsters,
  }
}

function createMockMonster(id: string, overrides: Partial<IMonster> = {}): IMonster {
  return {
    id,
    type: 0 as MonsterTypeId,
    maxLife: 50,
    currentLife: 50,
    speed: 3,
    shield: 0,
    money: 5,
    damage: 1,
    radius: 4,
    color: '#00ff00',
    progress: 0,
    isValid: true,
    takeDamage: vi.fn((raw) => raw),
    isDead: () => false,
    reachedExit: () => false,
    getGridPosition: () => [0, 0] as Position,
    getPixelPosition: () => ({ x: 0, y: 0 }),
    ...overrides,
  }
}

// ============================================================================
// Test cases
// ============================================================================

describe('WaveManager', () => {
  let waveManager: WaveManager

  beforeEach(() => {
    waveManager = createWaveManager()
  })

  describe('initial state', () => {
    it('initial state should be idle', () => {
      expect(waveManager.getState()).toBe('idle')
    })

    it('initial monster queue should be empty', () => {
      expect(waveManager.getPendingMonsters()).toHaveLength(0)
    })

    it('initial alive monster list should be empty', () => {
      expect(waveManager.getAliveMonsters()).toHaveLength(0)
    })

    it('initial wave number should be 0', () => {
      expect(waveManager.getCurrentWaveNumber()).toBe(0)
    })
  })

  describe('startWave - start a wave', () => {
    it('state should become spawning after starting a wave', () => {
      const waveConfig = createMockWaveConfig(1, 3)

      waveManager.startWave(waveConfig)

      expect(waveManager.getState()).toBe('spawning')
    })

    it('should have pending monsters after starting a wave', () => {
      const waveConfig = createMockWaveConfig(1, 5)

      waveManager.startWave(waveConfig)

      expect(waveManager.getPendingMonsters()).toHaveLength(5)
    })

    it('wave number should be updated after starting a wave', () => {
      const waveConfig = createMockWaveConfig(3, 2)

      waveManager.startWave(waveConfig)

      expect(waveManager.getCurrentWaveNumber()).toBe(3)
    })

    it('cannot start a new wave when not in idle state', () => {
      const waveConfig1 = createMockWaveConfig(1)
      const waveConfig2 = createMockWaveConfig(2)

      waveManager.startWave(waveConfig1)

      expect(() => waveManager.startWave(waveConfig2)).toThrow()
    })
  })

  describe('update - monster spawn scheduling', () => {
    it('should return a pending monster config at each spawn interval', () => {
      const waveConfig = createMockWaveConfig(1, 3)
      waveManager.startWave(waveConfig)

      // First frame immediately spawns the first monster
      const monster1 = waveManager.update(0)
      expect(monster1).not.toBeNull()
      expect(monster1!.id).toBe('m-1-0')

      // Before the interval, no spawn
      const noMonster = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES - 1)
      expect(noMonster).toBeNull()

      // At the interval, spawn the second monster
      const monster2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)
      expect(monster2).not.toBeNull()
      expect(monster2!.id).toBe('m-1-1')
    })

    it('should return null after all monsters have been spawned', () => {
      const waveConfig = createMockWaveConfig(1, 2)
      waveManager.startWave(waveConfig)

      // Spawn two monsters
      waveManager.update(0) // first
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES) // second

      // Further calls should return null
      const result = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)
      expect(result).toBeNull()
    })

    it('state should become fighting after all monsters are spawned', () => {
      const waveConfig = createMockWaveConfig(1, 2)
      waveManager.startWave(waveConfig)

      // Register spawned monsters
      const config1 = waveManager.update(0)!
      waveManager.registerMonster(createMockMonster(config1.id))

      const config2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)!
      waveManager.registerMonster(createMockMonster(config2.id))

      // Another update triggers state check
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.getState()).toBe('fighting')
    })

    it('update should return null in idle state', () => {
      const result = waveManager.update(0)
      expect(result).toBeNull()
    })
  })

  describe('registerMonster - register a monster', () => {
    it('registered monster should appear in the alive list', () => {
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)

      waveManager.registerMonster(monster)

      expect(waveManager.getAliveMonsters()).toContain(monster)
    })

    it('registering multiple different monsters should all be in the list', () => {
      const waveConfig = createMockWaveConfig(1, 3)
      waveManager.startWave(waveConfig)

      const monsters: IMonster[] = []
      for (let i = 0; i < 3; i++) {
        const config = waveManager.update(i * MONSTER_SPAWN_INTERVAL_FRAMES)
        if (config) {
          const monster = createMockMonster(config.id)
          waveManager.registerMonster(monster)
          monsters.push(monster)
        }
      }

      expect(waveManager.getAliveMonsters()).toHaveLength(3)
    })
  })

  describe('onMonsterRemoved - monster removal', () => {
    it('removed monster should disappear from the alive list', () => {
      const waveConfig = createMockWaveConfig(1, 2)
      waveManager.startWave(waveConfig)

      // Spawn and register two monsters
      const config1 = waveManager.update(0)!
      const monster1 = createMockMonster(config1.id)
      waveManager.registerMonster(monster1)

      const config2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)!
      const monster2 = createMockMonster(config2.id)
      waveManager.registerMonster(monster2)

      // Remove one
      waveManager.onMonsterRemoved(monster1)

      expect(waveManager.getAliveMonsters()).not.toContain(monster1)
      expect(waveManager.getAliveMonsters()).toContain(monster2)
    })

    it('removing a non-existent monster should not throw', () => {
      const monster = createMockMonster('unknown-id')

      expect(() => waveManager.onMonsterRemoved(monster)).not.toThrow()
    })
  })

  describe('isWaveComplete - wave completion check', () => {
    it('wave should be complete after all monsters are dead or passed', () => {
      const waveConfig = createMockWaveConfig(1, 2)
      waveManager.startWave(waveConfig)

      // Spawn and register monsters
      const config1 = waveManager.update(0)!
      const monster1 = createMockMonster(config1.id)
      waveManager.registerMonster(monster1)

      const config2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)!
      const monster2 = createMockMonster(config2.id)
      waveManager.registerMonster(monster2)

      // Enter fighting state
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.isWaveComplete()).toBe(false)

      // Remove all monsters
      waveManager.onMonsterRemoved(monster1)
      waveManager.onMonsterRemoved(monster2)

      expect(waveManager.isWaveComplete()).toBe(true)
    })

    it('wave should not be complete when there are pending monsters', () => {
      const waveConfig = createMockWaveConfig(1, 5)
      waveManager.startWave(waveConfig)

      // Only spawn one
      waveManager.update(0)

      expect(waveManager.isWaveComplete()).toBe(false)
    })

    it('wave is not considered complete in idle state', () => {
      expect(waveManager.isWaveComplete()).toBe(false)
    })
  })

  describe('state transitions: spawning -> fighting -> completed', () => {
    it('state should become completed after all monsters are dead', () => {
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      // Spawn and register
      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)
      waveManager.registerMonster(monster)

      // Enter fighting
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)
      expect(waveManager.getState()).toBe('fighting')

      // Monster dies
      waveManager.onMonsterRemoved(monster)

      // Another update checks wave completion
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.getState()).toBe('completed')
    })
  })

  describe('startInterval - wave interval', () => {
    it('can start interval in completed state', () => {
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      // Quickly complete the wave
      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)
      waveManager.registerMonster(monster)
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)
      waveManager.onMonsterRemoved(monster)
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.getState()).toBe('completed')

      waveManager.startInterval(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.getState()).toBe('interval')
    })

    it('cannot start interval in non-completed state', () => {
      expect(() => waveManager.startInterval(0)).toThrow()
    })
  })

  describe('isIntervalComplete - interval completion check', () => {
    let currentFrame: number

    beforeEach(() => {
      currentFrame = 0
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      // Quickly complete the wave
      const config = waveManager.update(currentFrame)!
      const monster = createMockMonster(config.id)
      waveManager.registerMonster(monster)
      currentFrame += MONSTER_SPAWN_INTERVAL_FRAMES
      waveManager.update(currentFrame)
      waveManager.onMonsterRemoved(monster)
      currentFrame += 1
      waveManager.update(currentFrame)
      waveManager.startInterval(currentFrame)
    })

    it('should return false before interval time is reached', () => {
      expect(waveManager.isIntervalComplete(currentFrame + 1)).toBe(false)
      expect(waveManager.isIntervalComplete(currentFrame + WAVE_INTERVAL_FRAMES - 1)).toBe(false)
    })

    it('should return true when interval time is reached', () => {
      expect(waveManager.isIntervalComplete(currentFrame + WAVE_INTERVAL_FRAMES)).toBe(true)
    })

    it('should return false in non-interval state', () => {
      const freshManager = createWaveManager()
      expect(freshManager.isIntervalComplete(1000)).toBe(false)
    })
  })

  describe('completeInterval - end interval', () => {
    it('state should return to idle after interval ends', () => {
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      // Quickly complete the wave
      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)
      waveManager.registerMonster(monster)
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)
      waveManager.onMonsterRemoved(monster)
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)
      waveManager.startInterval(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.getState()).toBe('interval')

      waveManager.completeInterval()

      expect(waveManager.getState()).toBe('idle')
    })

    it('can start a new wave after returning to idle', () => {
      const waveConfig1 = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig1)

      // Complete the first wave
      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)
      waveManager.registerMonster(monster)
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)
      waveManager.onMonsterRemoved(monster)
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)
      waveManager.startInterval(MONSTER_SPAWN_INTERVAL_FRAMES * 2)
      waveManager.completeInterval()

      // Start the second wave
      const waveConfig2 = createMockWaveConfig(2, 2)

      expect(() => waveManager.startWave(waveConfig2)).not.toThrow()
      expect(waveManager.getCurrentWaveNumber()).toBe(2)
    })
  })

  describe('getWaveStats - wave statistics', () => {
    it('should return correct wave statistics', () => {
      const waveConfig = createMockWaveConfig(1, 3)
      waveManager.startWave(waveConfig)

      // Spawn 2 monsters
      const config1 = waveManager.update(0)!
      const monster1 = createMockMonster(config1.id)
      waveManager.registerMonster(monster1)

      const config2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)!
      const monster2 = createMockMonster(config2.id)
      waveManager.registerMonster(monster2)

      const stats = waveManager.getWaveStats()

      expect(stats.totalMonsters).toBe(3)
      expect(stats.spawnedMonsters).toBe(2)
      expect(stats.aliveMonsters).toBe(2)
      expect(stats.pendingMonsters).toBe(1)
    })
  })

  describe('reset', () => {
    it('should return to initial state after reset', () => {
      const waveConfig = createMockWaveConfig(1, 3)
      waveManager.startWave(waveConfig)

      // Spawn some monsters
      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)
      waveManager.registerMonster(monster)

      waveManager.reset()

      expect(waveManager.getState()).toBe('idle')
      expect(waveManager.getPendingMonsters()).toHaveLength(0)
      expect(waveManager.getAliveMonsters()).toHaveLength(0)
      expect(waveManager.getCurrentWaveNumber()).toBe(0)
    })
  })
})
