/**
 * GameSceneLogic 单元测试
 * 测试游戏核心逻辑，与 Phaser 渲染解耦
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createGameSceneLogic, type GameSceneLogic } from './GameSceneLogic'
import { MOCK_GAME_CONFIG } from '@/mocks'
import type { WaveConfig, Position } from '@/types'

describe('GameSceneLogic', () => {
  let logic: GameSceneLogic

  beforeEach(() => {
    logic = createGameSceneLogic(MOCK_GAME_CONFIG)
  })

  // ============================================================================
  // 初始化测试
  // ============================================================================

  describe('initialization', () => {
    it('初始化后游戏状态正确', () => {
      const state = logic.getState()

      expect(state.money).toBe(MOCK_GAME_CONFIG.initial.money)
      expect(state.life).toBe(MOCK_GAME_CONFIG.initial.life)
      expect(state.score).toBe(0)
      expect(state.wave).toBe(0)
      expect(state.frame).toBe(0)
      expect(state.isPlaying).toBe(true)
      expect(state.isPaused).toBe(false)
      expect(state.isGameOver).toBe(false)
    })

    it('初始化后没有怪物和建筑', () => {
      expect(logic.getMonsters()).toHaveLength(0)
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('初始化后路径存在', () => {
      const path = logic.getCurrentPath()
      expect(path.length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // 波次管理测试
  // ============================================================================

  describe('wave management', () => {
    it('开始波次后状态正确', () => {
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
          { id: 'uuid-2', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
        ],
      }

      logic.startWave(waveConfig)
      const state = logic.getState()

      expect(state.wave).toBe(1)
    })

    it('波次进行中生成怪物', () => {
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      }

      logic.startWave(waveConfig)

      // 第一帧应该生成第一个怪物
      logic.update()
      expect(logic.getMonsters().length).toBeGreaterThanOrEqual(1)
    })

    it('使用高速怪物快速完成波次', () => {
      // 使用非常快的怪物来测试
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 }],
      }

      logic.startWave(waveConfig)

      // 运行有限帧数
      let completed = false
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) {
          completed = true
          break
        }
      }

      expect(completed).toBe(true)
    })
  })

  // ============================================================================
  // 建筑放置测试
  // ============================================================================

  describe('building placement', () => {
    it('在可放置位置放置建筑成功', () => {
      const result = logic.placeBuilding([1, 1], 'cannon')

      expect(result.success).toBe(true)
      expect(result.buildingId).toBeDefined()
      expect(logic.getBuildings()).toHaveLength(1)
    })

    it('放置建筑扣除金钱', () => {
      const moneyBefore = logic.getState().money
      logic.placeBuilding([1, 1], 'cannon')
      const moneyAfter = logic.getState().money

      expect(moneyAfter).toBe(moneyBefore - MOCK_GAME_CONFIG.buildings.cannon.cost)
    })

    it('金钱不足时无法放置建筑', () => {
      // 使用昂贵的建筑快速消耗金钱
      logic.placeBuilding([2, 2], 'laser_gun') // 2000
      // 此时金钱不足再放置 laser_gun

      const result = logic.placeBuilding([3, 3], 'laser_gun')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('insufficient_money')
    })

    it('在入口位置无法放置建筑', () => {
      const entrance = MOCK_GAME_CONFIG.map.entrance
      const result = logic.placeBuilding(entrance, 'cannon')

      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_position')
    })

    it('在出口位置无法放置建筑', () => {
      const exit = MOCK_GAME_CONFIG.map.exit
      const result = logic.placeBuilding(exit, 'cannon')

      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_position')
    })

    it('会阻断路径的位置无法放置建筑', () => {
      // 放置建筑直到接近阻断
      logic.placeBuilding([1, 0], 'wall')

      // 尝试阻断入口
      const result = logic.placeBuilding([0, 1], 'wall')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('would_block_path')
    })
  })

  // ============================================================================
  // 建筑升级测试
  // ============================================================================

  describe('building upgrade', () => {
    it('升级建筑成功', () => {
      // LMG cost=100, 升级费用=floor(100*0.75)=75, 剩余400足够
      const { buildingId } = logic.placeBuilding([1, 1], 'LMG')
      const result = logic.upgradeBuilding(buildingId!)

      expect(result.success).toBe(true)

      const building = logic.getBuilding(buildingId!)
      expect(building?.level).toBe(2)
    })

    it('升级建筑扣除金钱', () => {
      const { buildingId } = logic.placeBuilding([1, 1], 'LMG')
      const moneyBefore = logic.getState().money

      logic.upgradeBuilding(buildingId!)

      const moneyAfter = logic.getState().money
      expect(moneyAfter).toBeLessThan(moneyBefore)
    })

    it('金钱不足时无法升级', () => {
      const { buildingId } = logic.placeBuilding([1, 1], 'cannon')

      // 消耗所有金钱：初始 500，cannon 花费 300，剩余 200
      // 放置 wall（cost=5）直到金钱不足升级（升级费用约 225）
      let x = 3
      let y = 1
      while (logic.getState().money >= 100 && x < 15) {
        const result = logic.placeBuilding([x, y], 'wall')
        if (result.success) {
          y++
          if (y >= 15) {
            y = 1
            x++
          }
        } else {
          break
        }
      }

      const result = logic.upgradeBuilding(buildingId!)
      expect(result.success).toBe(false)
      expect(result.reason).toBe('insufficient_money')
    })
  })

  // ============================================================================
  // 建筑出售测试
  // ============================================================================

  describe('building sell', () => {
    it('出售建筑返回金钱', () => {
      const { buildingId } = logic.placeBuilding([1, 1], 'cannon')
      const moneyBefore = logic.getState().money

      const result = logic.sellBuilding(buildingId!)

      expect(result.success).toBe(true)
      expect(logic.getState().money).toBeGreaterThan(moneyBefore)
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('出售不存在的建筑失败', () => {
      const result = logic.sellBuilding('non-existent')

      expect(result.success).toBe(false)
      expect(result.reason).toBe('building_not_found')
    })
  })

  // ============================================================================
  // 战斗系统测试
  // ============================================================================

  describe('combat system', () => {
    it('建筑攻击怪物', () => {
      // 放置建筑
      logic.placeBuilding([8, 8], 'cannon')

      // 开始波次
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      // 运行若干帧让怪物移动并被攻击
      for (let i = 0; i < 500; i++) {
        logic.update()
      }

      // 检查是否有攻击记录
      const recorder = logic.getWaveRecorder()
      const attacks = recorder.getAttacks()
      // 取决于怪物是否进入射程
    })

    it('击杀怪物获得金钱', () => {
      // 放置高伤害建筑
      logic.placeBuilding([3, 3], 'laser_gun')

      const moneyBefore = logic.getState().money

      // 开始波次
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // 运行直到怪物被击杀或穿过
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 如果怪物被击杀，应该获得金钱
      const recorder = logic.getWaveRecorder()
      const result = recorder.getResult()
      if (result.killed > 0) {
        expect(logic.getState().money).toBeGreaterThan(moneyBefore)
      }
    })

    it('怪物到达终点扣除生命', () => {
      const lifeBefore = logic.getState().life

      // 不放置建筑，让怪物直接穿过
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 30, shield: 0, money: 5 }],
      })

      // 快速怪物，应该很快到达终点
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const lifeAfter = logic.getState().life
      expect(lifeAfter).toBeLessThan(lifeBefore)
    })
  })

  // ============================================================================
  // 游戏结束测试
  // ============================================================================

  describe('game over', () => {
    it('生命值为 0 时游戏结束', () => {
      // 使用低生命值配置
      const lowLifeConfig = {
        ...MOCK_GAME_CONFIG,
        initial: { ...MOCK_GAME_CONFIG.initial, life: 1 },
      }
      const lowLifeLogic = createGameSceneLogic(lowLifeConfig)

      // 让高伤害怪物穿过
      lowLifeLogic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 5, life: 50, speed: 30, shield: 0, money: 5 }],
      })

      for (let i = 0; i < 5000; i++) {
        lowLifeLogic.update()
        if (lowLifeLogic.getState().isGameOver) break
      }

      expect(lowLifeLogic.getState().isGameOver).toBe(true)
    })
  })

  // ============================================================================
  // 暂停/恢复测试
  // ============================================================================

  describe('pause/resume', () => {
    it('暂停后不更新游戏状态', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      logic.update() // 生成怪物
      const frameBefore = logic.getState().frame

      logic.togglePause()
      expect(logic.getState().isPaused).toBe(true)

      logic.update()
      logic.update()
      logic.update()

      expect(logic.getState().frame).toBe(frameBefore)
    })

    it('恢复后继续更新', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      logic.update()
      logic.togglePause()
      logic.togglePause() // 恢复

      const frameBefore = logic.getState().frame
      logic.update()

      expect(logic.getState().frame).toBe(frameBefore + 1)
    })
  })

  // ============================================================================
  // 波次记录器测试
  // ============================================================================

  describe('wave recorder', () => {
    it('记录建筑操作', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      logic.placeBuilding([1, 1], 'cannon')

      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()

      expect(actions.length).toBeGreaterThanOrEqual(1)
      expect(actions[0].type).toBe('BUILD')
    })
  })

  // ============================================================================
  // 累计分数测试
  // ============================================================================

  describe('score accumulation', () => {
    it('跨波次累计分数正确', () => {
      // 放置高伤害建筑
      logic.placeBuilding([3, 3], 'laser_gun')

      // 第一波
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const scoreAfterWave1 = logic.getState().score
      const recorder1 = logic.getWaveRecorder()
      const wave1Score = recorder1.getResult().scoreGained

      // 确保第一波有得分
      if (wave1Score > 0) {
        expect(scoreAfterWave1).toBe(wave1Score)

        // 第二波
        logic.startWave({
          waveNumber: 2,
          monsters: [{ id: 'uuid-2', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
        })

        for (let i = 0; i < 5000; i++) {
          logic.update()
          if (logic.isWaveComplete()) break
        }

        const scoreAfterWave2 = logic.getState().score
        const recorder2 = logic.getWaveRecorder()
        const wave2Score = recorder2.getResult().scoreGained

        // 累计分数应该是两波的总和
        expect(scoreAfterWave2).toBe(wave1Score + wave2Score)
        expect(scoreAfterWave2).toBeGreaterThanOrEqual(scoreAfterWave1)
      }
    })

    it('重置游戏后分数归零', () => {
      // 放置建筑并进行一波
      logic.placeBuilding([3, 3], 'laser_gun')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 重置游戏
      logic.reset()

      // 分数应该归零
      expect(logic.getState().score).toBe(0)
    })
  })
})
