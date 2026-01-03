/**
 * WaveManager 波次管理器测试
 * 基于 TDD 方式编写，测试先于实现
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createWaveManager,
  type WaveManager,
  type WaveState,
} from './WaveManager'
import type { WaveConfig, MonsterConfig } from '@/types'
import type { IMonster } from '@/types/entities'
import type { MonsterTypeId, Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { WAVE_INTERVAL_FRAMES, MONSTER_SPAWN_INTERVAL_FRAMES } = GAME_CONSTANTS

// ============================================================================
// Mock 工厂函数
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
    ...overrides,
  }
}

// ============================================================================
// 测试用例
// ============================================================================

describe('WaveManager', () => {
  let waveManager: WaveManager

  beforeEach(() => {
    waveManager = createWaveManager()
  })

  describe('初始状态', () => {
    it('初始状态应为 idle', () => {
      expect(waveManager.getState()).toBe('idle')
    })

    it('初始怪物队列应为空', () => {
      expect(waveManager.getPendingMonsters()).toHaveLength(0)
    })

    it('初始存活怪物列表应为空', () => {
      expect(waveManager.getAliveMonsters()).toHaveLength(0)
    })

    it('初始波次号应为 0', () => {
      expect(waveManager.getCurrentWaveNumber()).toBe(0)
    })
  })

  describe('startWave - 开始波次', () => {
    it('开始波次后状态应变为 spawning', () => {
      const waveConfig = createMockWaveConfig(1, 3)

      waveManager.startWave(waveConfig)

      expect(waveManager.getState()).toBe('spawning')
    })

    it('开始波次后应有待生成的怪物', () => {
      const waveConfig = createMockWaveConfig(1, 5)

      waveManager.startWave(waveConfig)

      expect(waveManager.getPendingMonsters()).toHaveLength(5)
    })

    it('开始波次后波次号应更新', () => {
      const waveConfig = createMockWaveConfig(3, 2)

      waveManager.startWave(waveConfig)

      expect(waveManager.getCurrentWaveNumber()).toBe(3)
    })

    it('不能在非 idle 状态开始新波次', () => {
      const waveConfig1 = createMockWaveConfig(1)
      const waveConfig2 = createMockWaveConfig(2)

      waveManager.startWave(waveConfig1)

      expect(() => waveManager.startWave(waveConfig2)).toThrow()
    })
  })

  describe('update - 怪物生成调度', () => {
    it('每隔指定帧数应返回一个待生成的怪物配置', () => {
      const waveConfig = createMockWaveConfig(1, 3)
      waveManager.startWave(waveConfig)

      // 第一帧立即生成第一个怪物
      const monster1 = waveManager.update(0)
      expect(monster1).not.toBeNull()
      expect(monster1!.id).toBe('m-1-0')

      // 未到间隔时间不生成
      const noMonster = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES - 1)
      expect(noMonster).toBeNull()

      // 到达间隔时间生成第二个
      const monster2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)
      expect(monster2).not.toBeNull()
      expect(monster2!.id).toBe('m-1-1')
    })

    it('所有怪物生成完毕后应返回 null', () => {
      const waveConfig = createMockWaveConfig(1, 2)
      waveManager.startWave(waveConfig)

      // 生成两个怪物
      waveManager.update(0) // 第一个
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES) // 第二个

      // 再调用应返回 null
      const result = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)
      expect(result).toBeNull()
    })

    it('所有怪物生成完毕后状态应变为 fighting', () => {
      const waveConfig = createMockWaveConfig(1, 2)
      waveManager.startWave(waveConfig)

      // 注册生成的怪物
      const config1 = waveManager.update(0)!
      waveManager.registerMonster(createMockMonster(config1.id))

      const config2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)!
      waveManager.registerMonster(createMockMonster(config2.id))

      // 再次 update 触发状态检查
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.getState()).toBe('fighting')
    })

    it('idle 状态下 update 应返回 null', () => {
      const result = waveManager.update(0)
      expect(result).toBeNull()
    })
  })

  describe('registerMonster - 注册怪物', () => {
    it('注册的怪物应出现在存活列表中', () => {
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)

      waveManager.registerMonster(monster)

      expect(waveManager.getAliveMonsters()).toContain(monster)
    })

    it('多次注册不同怪物应都在列表中', () => {
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

  describe('onMonsterRemoved - 怪物移除', () => {
    it('移除怪物后应从存活列表中消失', () => {
      const waveConfig = createMockWaveConfig(1, 2)
      waveManager.startWave(waveConfig)

      // 生成并注册两个怪物
      const config1 = waveManager.update(0)!
      const monster1 = createMockMonster(config1.id)
      waveManager.registerMonster(monster1)

      const config2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)!
      const monster2 = createMockMonster(config2.id)
      waveManager.registerMonster(monster2)

      // 移除一个
      waveManager.onMonsterRemoved(monster1)

      expect(waveManager.getAliveMonsters()).not.toContain(monster1)
      expect(waveManager.getAliveMonsters()).toContain(monster2)
    })

    it('移除不存在的怪物不应报错', () => {
      const monster = createMockMonster('unknown-id')

      expect(() => waveManager.onMonsterRemoved(monster)).not.toThrow()
    })
  })

  describe('isWaveComplete - 波次完成判断', () => {
    it('所有怪物死亡或穿过后波次应完成', () => {
      const waveConfig = createMockWaveConfig(1, 2)
      waveManager.startWave(waveConfig)

      // 生成并注册怪物
      const config1 = waveManager.update(0)!
      const monster1 = createMockMonster(config1.id)
      waveManager.registerMonster(monster1)

      const config2 = waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)!
      const monster2 = createMockMonster(config2.id)
      waveManager.registerMonster(monster2)

      // 进入 fighting 状态
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.isWaveComplete()).toBe(false)

      // 移除所有怪物
      waveManager.onMonsterRemoved(monster1)
      waveManager.onMonsterRemoved(monster2)

      expect(waveManager.isWaveComplete()).toBe(true)
    })

    it('还有待生成怪物时波次不应完成', () => {
      const waveConfig = createMockWaveConfig(1, 5)
      waveManager.startWave(waveConfig)

      // 只生成一个
      waveManager.update(0)

      expect(waveManager.isWaveComplete()).toBe(false)
    })

    it('idle 状态下波次不算完成', () => {
      expect(waveManager.isWaveComplete()).toBe(false)
    })
  })

  describe('状态转换: spawning → fighting → completed', () => {
    it('所有怪物死亡后状态应变为 completed', () => {
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      // 生成并注册
      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)
      waveManager.registerMonster(monster)

      // 进入 fighting
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)
      expect(waveManager.getState()).toBe('fighting')

      // 怪物死亡
      waveManager.onMonsterRemoved(monster)

      // 再次 update 检查波次完成
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)

      expect(waveManager.getState()).toBe('completed')
    })
  })

  describe('startInterval - 波次间隔', () => {
    it('completed 状态下可以开始间隔', () => {
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      // 快速完成波次
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

    it('非 completed 状态不能开始间隔', () => {
      expect(() => waveManager.startInterval(0)).toThrow()
    })
  })

  describe('isIntervalComplete - 间隔完成判断', () => {
    let currentFrame: number

    beforeEach(() => {
      currentFrame = 0
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      // 快速完成波次
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

    it('间隔时间未到应返回 false', () => {
      expect(waveManager.isIntervalComplete(currentFrame + 1)).toBe(false)
      expect(waveManager.isIntervalComplete(currentFrame + WAVE_INTERVAL_FRAMES - 1)).toBe(false)
    })

    it('间隔时间到达应返回 true', () => {
      expect(waveManager.isIntervalComplete(currentFrame + WAVE_INTERVAL_FRAMES)).toBe(true)
    })

    it('非 interval 状态应返回 false', () => {
      const freshManager = createWaveManager()
      expect(freshManager.isIntervalComplete(1000)).toBe(false)
    })
  })

  describe('completeInterval - 结束间隔', () => {
    it('间隔结束后状态应回到 idle', () => {
      const waveConfig = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig)

      // 快速完成波次
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

    it('idle 状态后可以开始新波次', () => {
      const waveConfig1 = createMockWaveConfig(1, 1)
      waveManager.startWave(waveConfig1)

      // 完成第一波
      const config = waveManager.update(0)!
      const monster = createMockMonster(config.id)
      waveManager.registerMonster(monster)
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES)
      waveManager.onMonsterRemoved(monster)
      waveManager.update(MONSTER_SPAWN_INTERVAL_FRAMES * 2)
      waveManager.startInterval(MONSTER_SPAWN_INTERVAL_FRAMES * 2)
      waveManager.completeInterval()

      // 开始第二波
      const waveConfig2 = createMockWaveConfig(2, 2)

      expect(() => waveManager.startWave(waveConfig2)).not.toThrow()
      expect(waveManager.getCurrentWaveNumber()).toBe(2)
    })
  })

  describe('getWaveStats - 波次统计', () => {
    it('应返回正确的波次统计信息', () => {
      const waveConfig = createMockWaveConfig(1, 3)
      waveManager.startWave(waveConfig)

      // 生成 2 个怪物
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

  describe('reset - 重置', () => {
    it('重置后应回到初始状态', () => {
      const waveConfig = createMockWaveConfig(1, 3)
      waveManager.startWave(waveConfig)

      // 生成一些怪物
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
