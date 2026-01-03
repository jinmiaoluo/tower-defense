/**
 * WaveManager - 波次管理器
 * 负责波次状态管理和怪物生成调度
 * 参考旧实现：html5-tower-defense/src/js/td-data-stage-1.js
 */

import type { WaveConfig, MonsterConfig } from '@/types'
import type { IMonster } from '@/types/entities'
import { GAME_CONSTANTS } from '@/types'

const { WAVE_INTERVAL_FRAMES, MONSTER_SPAWN_INTERVAL_FRAMES } = GAME_CONSTANTS

/**
 * 波次状态
 * - idle: 等待开始新波次
 * - spawning: 正在生成怪物
 * - fighting: 所有怪物已生成，战斗中
 * - completed: 波次已完成（所有怪物死亡或穿过）
 * - interval: 波次间隔期（等待下一波）
 */
export type WaveState = 'idle' | 'spawning' | 'fighting' | 'completed' | 'interval'

/** 波次统计信息 */
export interface WaveStats {
  /** 本波次总怪物数 */
  totalMonsters: number
  /** 已生成的怪物数 */
  spawnedMonsters: number
  /** 当前存活怪物数 */
  aliveMonsters: number
  /** 待生成怪物数 */
  pendingMonsters: number
}

/** WaveManager 接口定义 */
export interface WaveManager {
  /** 获取当前状态 */
  getState(): WaveState

  /** 获取当前波次号 */
  getCurrentWaveNumber(): number

  /** 获取待生成的怪物配置列表 */
  getPendingMonsters(): readonly MonsterConfig[]

  /** 获取当前存活的怪物列表 */
  getAliveMonsters(): readonly IMonster[]

  /** 开始新波次 */
  startWave(waveConfig: WaveConfig): void

  /**
   * 每帧更新
   * @param currentFrame 当前帧号
   * @returns 需要生成的怪物配置，或 null
   */
  update(currentFrame: number): MonsterConfig | null

  /** 注册怪物到管理器（用于追踪存活状态） */
  registerMonster(monster: IMonster): void

  /** 通知怪物死亡或到达终点 */
  onMonsterRemoved(monster: IMonster): void

  /** 检查波次是否完成 */
  isWaveComplete(): boolean

  /** 开始波次间隔 */
  startInterval(currentFrame: number): void

  /** 检查波次间隔是否结束 */
  isIntervalComplete(currentFrame: number): boolean

  /** 结束波次间隔，回到 idle 状态 */
  completeInterval(): void

  /** 获取波次统计信息 */
  getWaveStats(): WaveStats

  /** 重置管理器状态 */
  reset(): void
}

/**
 * 创建 WaveManager 实例
 */
export function createWaveManager(): WaveManager {
  let state: WaveState = 'idle'
  let waveNumber = 0
  let totalMonsters = 0
  let pendingMonsters: MonsterConfig[] = []
  let aliveMonsters: IMonster[] = []

  let lastSpawnFrame = -MONSTER_SPAWN_INTERVAL_FRAMES
  let intervalStartFrame = 0

  return {
    getState(): WaveState {
      return state
    },

    getCurrentWaveNumber(): number {
      return waveNumber
    },

    getPendingMonsters(): readonly MonsterConfig[] {
      return pendingMonsters
    },

    getAliveMonsters(): readonly IMonster[] {
      return aliveMonsters
    },

    startWave(waveConfig: WaveConfig): void {
      if (state !== 'idle') {
        throw new Error(`Cannot start wave in ${state} state. Must be idle.`)
      }

      waveNumber = waveConfig.waveNumber
      totalMonsters = waveConfig.monsters.length
      pendingMonsters = [...waveConfig.monsters]
      aliveMonsters = []
      lastSpawnFrame = -MONSTER_SPAWN_INTERVAL_FRAMES // 确保第一帧立即生成
      state = 'spawning'
    },

    update(currentFrame: number): MonsterConfig | null {
      // idle 或 interval 状态不处理
      if (state === 'idle' || state === 'interval') {
        return null
      }

      // completed 状态不生成，但不返回错误
      if (state === 'completed') {
        return null
      }

      // spawning 状态：检查是否可以生成下一个怪物
      if (state === 'spawning') {
        if (pendingMonsters.length > 0) {
          const framesSinceLastSpawn = currentFrame - lastSpawnFrame

          if (framesSinceLastSpawn >= MONSTER_SPAWN_INTERVAL_FRAMES) {
            const monsterConfig = pendingMonsters.shift()!
            lastSpawnFrame = currentFrame
            return monsterConfig
          }
        } else {
          // 所有怪物已生成完毕，转换到 fighting 状态
          state = 'fighting'
        }
      }

      // fighting 状态：检查是否所有怪物都已死亡/穿过
      if (state === 'fighting') {
        if (aliveMonsters.length === 0 && pendingMonsters.length === 0) {
          state = 'completed'
        }
      }

      return null
    },

    registerMonster(monster: IMonster): void {
      aliveMonsters.push(monster)
    },

    onMonsterRemoved(monster: IMonster): void {
      const index = aliveMonsters.indexOf(monster)
      if (index !== -1) {
        aliveMonsters.splice(index, 1)
      }
    },

    isWaveComplete(): boolean {
      if (state === 'idle' || state === 'interval') {
        return false
      }

      // 还有待生成的怪物或存活的怪物，波次未完成
      if (pendingMonsters.length > 0 || aliveMonsters.length > 0) {
        return false
      }

      return true
    },

    startInterval(currentFrame: number): void {
      if (state !== 'completed') {
        throw new Error(`Cannot start interval in ${state} state. Must be completed.`)
      }

      intervalStartFrame = currentFrame
      state = 'interval'
    },

    isIntervalComplete(currentFrame: number): boolean {
      if (state !== 'interval') {
        return false
      }

      const framesSinceIntervalStart = currentFrame - intervalStartFrame
      return framesSinceIntervalStart >= WAVE_INTERVAL_FRAMES
    },

    completeInterval(): void {
      if (state !== 'interval') {
        throw new Error(`Cannot complete interval in ${state} state. Must be interval.`)
      }

      state = 'idle'
      intervalStartFrame = 0
    },

    getWaveStats(): WaveStats {
      const spawnedMonsters = totalMonsters - pendingMonsters.length

      return {
        totalMonsters,
        spawnedMonsters,
        aliveMonsters: aliveMonsters.length,
        pendingMonsters: pendingMonsters.length,
      }
    },

    reset(): void {
      state = 'idle'
      waveNumber = 0
      totalMonsters = 0
      pendingMonsters = []
      aliveMonsters = []
      lastSpawnFrame = -MONSTER_SPAWN_INTERVAL_FRAMES
      intervalStartFrame = 0
    },
  }
}
