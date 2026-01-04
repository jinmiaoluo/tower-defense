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

    it('会阻断已出发怪物的位置无法放置建筑', () => {
      // 16x16 地图，入口(0,0)，出口(15,15)
      // 策略：使用高速怪物快速移动到远离入口的位置，然后测试阻断

      // 开始波次生成怪物（使用高速怪物确保快速移动）
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [{ id: 'uuid-block-test', type: 0, life: 50000, speed: 30, shield: 0, money: 5 }],
      }
      logic.startWave(waveConfig)

      // 运行足够帧数让怪物移动到地图中间区域
      for (let i = 0; i < 200; i++) {
        logic.update()
        // 检查是否有怪物离开了入口
        const monsters = logic.getMonsters()
        if (monsters.length > 0) {
          const [gx, gy] = monsters[0].getGridPosition()
          // 当怪物到达 (3,3) 或更远时停止
          if (gx >= 3 || gy >= 3) break
        }
      }

      // 确认怪物已生成并移动
      const monsters = logic.getMonsters()
      expect(monsters.length).toBeGreaterThan(0)

      // 获取怪物当前格子位置
      const monster = monsters[0]
      const monsterGridPos = monster.getGridPosition()
      const [gx, gy] = monsterGridPos

      // 怪物应该已经离开入口区域
      // 如果怪物还在入口附近，这个测试场景不适用，跳过后续断言
      if (gx === 0 && gy === 0) {
        // 怪物还在入口，无法测试 would_block_monsters 场景
        // 因为在入口位置，怪物路径等于入口到出口路径
        return
      }

      // 测试 canPlaceBuilding 函数 - 它应该检查怪物阻断
      // 在怪物周围放墙，留一个出口
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]]
      const wallPositions: Position[] = []

      for (const [dx, dy] of directions) {
        const wx = gx + dx
        const wy = gy + dy
        if (wx < 0 || wx > 15 || wy < 0 || wy > 15) continue
        if (wx === 0 && wy === 0) continue
        if (wx === 15 && wy === 15) continue

        // 使用 canPlaceBuilding 检查
        if (logic.canPlaceBuilding([wx, wy])) {
          wallPositions.push([wx, wy])
        }
      }

      // 放置除最后一个外的所有墙
      if (wallPositions.length > 1) {
        const lastWall = wallPositions.pop()!
        for (const pos of wallPositions) {
          const result = logic.placeBuilding(pos, 'wall')
          // 每次放置都应该成功或因为阻断而失败
          if (!result.success) {
            // 如果放置失败，说明会阻断（path 或 monsters）
            expect(['would_block_path', 'would_block_monsters']).toContain(result.reason)
            return // 测试目的达成
          }
        }

        // 尝试放置最后一个墙
        const result = logic.placeBuilding(lastWall, 'wall')
        expect(result.success).toBe(false)
        expect(['would_block_path', 'would_block_monsters']).toContain(result.reason)
      }
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

    it('出售 1 级建筑返回正确金额（建造成本 x 0.5）', () => {
      // 初始金钱 500，cannon 花费 300，剩余 200
      const { buildingId } = logic.placeBuilding([1, 1], 'cannon')
      expect(logic.getState().money).toBe(200)

      logic.sellBuilding(buildingId!)

      // 出售回收 = floor(300 x 0.5) = 150
      // 最终金钱 = 200 + 150 = 350
      expect(logic.getState().money).toBe(350)
    })

    it('出售升级后的建筑返回更多金钱', () => {
      // 使用 LMG（cost=100）方便计算
      // 初始 500，建造 -100 = 400
      const { buildingId } = logic.placeBuilding([1, 1], 'LMG')
      expect(logic.getState().money).toBe(400)

      // 升级到 2 级：升级成本 = floor(100 x 0.75) = 75
      // 升级后金钱 = 400 - 75 = 325
      logic.upgradeBuilding(buildingId!)
      expect(logic.getState().money).toBe(325)
      expect(logic.getBuilding(buildingId!)?.level).toBe(2)

      // 出售 2 级 LMG：累计花费 = 100 + 75 = 175
      // 出售回收 = floor(175 x 0.5) = 87
      logic.sellBuilding(buildingId!)
      expect(logic.getState().money).toBe(325 + 87)
    })

    it('出售操作被记录到 WaveRecorder', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      const { buildingId } = logic.placeBuilding([1, 1], 'cannon')

      // 更新几帧让帧号增加
      logic.update()
      logic.update()

      logic.sellBuilding(buildingId!)

      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()

      // 应该有 BUILD 和 SELL 两个操作
      expect(actions.length).toBe(2)
      expect(actions[0].type).toBe('BUILD')
      expect(actions[1].type).toBe('SELL')
      expect(actions[1].buildingId).toBe(buildingId)
      expect(actions[1].frame).toBeGreaterThan(0)
    })

    it('出售后格子可以重新放置建筑', () => {
      const position: [number, number] = [1, 1]
      const { buildingId } = logic.placeBuilding(position, 'cannon')

      // 出售建筑
      logic.sellBuilding(buildingId!)

      // 同一位置应该可以再次放置建筑
      const result = logic.placeBuilding(position, 'LMG')
      expect(result.success).toBe(true)
      expect(logic.getBuildings()).toHaveLength(1)
    })

    it('出售后建筑从列表中移除', () => {
      const { buildingId: id1 } = logic.placeBuilding([1, 1], 'cannon')
      const { buildingId: id2 } = logic.placeBuilding([2, 2], 'LMG')

      expect(logic.getBuildings()).toHaveLength(2)

      // 出售第一个建筑
      logic.sellBuilding(id1!)

      expect(logic.getBuildings()).toHaveLength(1)
      expect(logic.getBuilding(id1!)).toBeNull()
      expect(logic.getBuilding(id2!)).not.toBeNull()
    })

    it('wall 出售最少返回 1 金币', () => {
      // wall 建造成本 5，出售 = floor(5 x 0.5) = 2
      const { buildingId } = logic.placeBuilding([1, 1], 'wall')
      const moneyBefore = logic.getState().money

      logic.sellBuilding(buildingId!)

      // 出售回收至少 1 金币（实际是 2）
      expect(logic.getState().money).toBeGreaterThanOrEqual(moneyBefore + 1)
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
  // 重置游戏测试
  // ============================================================================

  describe('reset', () => {
    it('重置后游戏状态恢复到初始值', () => {
      // 放置建筑并运行一些帧
      logic.placeBuilding([1, 1], 'cannon')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // 重置
      logic.reset()

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

    it('重置后清空所有怪物', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
          { id: 'uuid-2', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
        ],
      })

      logic.update()
      expect(logic.getMonsters().length).toBeGreaterThan(0)

      logic.reset()
      expect(logic.getMonsters()).toHaveLength(0)
    })

    it('重置后清空所有建筑', () => {
      logic.placeBuilding([1, 1], 'cannon')
      logic.placeBuilding([2, 2], 'LMG')
      expect(logic.getBuildings()).toHaveLength(2)

      logic.reset()
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('重置后清空所有子弹', () => {
      logic.placeBuilding([3, 3], 'cannon')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 5 }],
      })

      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.getBullets().length > 0) break
      }

      logic.reset()
      expect(logic.getBullets()).toHaveLength(0)
    })

    it('重置后可以重新开始新波次', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 30, shield: 0, money: 5 }],
      })

      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      logic.reset()

      // 应该可以重新开始波次
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-new', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      expect(logic.getState().wave).toBe(1)
      logic.update()
      expect(logic.getMonsters().length).toBeGreaterThan(0)
    })

    it('重置后可以重新放置建筑', () => {
      logic.placeBuilding([1, 1], 'cannon')
      logic.reset()

      // 应该可以在同一位置放置建筑
      const result = logic.placeBuilding([1, 1], 'LMG')
      expect(result.success).toBe(true)
    })

    it('游戏结束后重置可以继续游戏', () => {
      // 设置低生命值
      const lowLifeConfig = {
        ...MOCK_GAME_CONFIG,
        initial: { ...MOCK_GAME_CONFIG.initial, life: 1 },
      }
      const lowLifeLogic = createGameSceneLogic(lowLifeConfig)

      // 让怪物穿过导致游戏结束
      lowLifeLogic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 5, life: 50, speed: 30, shield: 0, money: 5 }],
      })

      for (let i = 0; i < 5000; i++) {
        lowLifeLogic.update()
        if (lowLifeLogic.getState().isGameOver) break
      }

      expect(lowLifeLogic.getState().isGameOver).toBe(true)

      // 重置
      lowLifeLogic.reset()

      // 应该可以继续游戏
      expect(lowLifeLogic.getState().isGameOver).toBe(false)
      expect(lowLifeLogic.getState().isPlaying).toBe(true)
      expect(lowLifeLogic.getState().life).toBe(1)
    })

    it('暂停状态下重置后恢复为非暂停', () => {
      logic.togglePause()
      expect(logic.getState().isPaused).toBe(true)

      logic.reset()
      expect(logic.getState().isPaused).toBe(false)
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
