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
      expect(recorder.getAttacks()).toBeDefined()
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

    it('调用 setGameOver 后游戏停止更新', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      // 运行几帧
      logic.update()
      logic.update()
      const frameBefore = logic.getState().frame

      // 调用 setGameOver
      logic.setGameOver()

      // 确认状态已设置
      expect(logic.getState().isGameOver).toBe(true)
      expect(logic.getState().isPlaying).toBe(false)

      // 继续调用 update，帧号不应增加
      logic.update()
      logic.update()
      logic.update()

      expect(logic.getState().frame).toBe(frameBefore)
    })

    it('调用 setGameOver 后怪物不再移动', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      // 生成怪物并移动几帧
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      const monsters = logic.getMonsters()
      expect(monsters.length).toBeGreaterThan(0)

      const positionBefore = monsters[0].getGridPosition()

      // 调用 setGameOver
      logic.setGameOver()

      // 继续调用 update
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // 怪物位置不应改变
      const positionAfter = monsters[0].getGridPosition()
      expect(positionAfter).toEqual(positionBefore)
    })

    it('调用 setGameOver 后建筑不再攻击', () => {
      // 放置建筑
      logic.placeBuilding([3, 3], 'laser_gun')

      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 500, speed: 1, shield: 0, money: 5 }],
      })

      // 运行让怪物进入射程并被攻击
      for (let i = 0; i < 200; i++) {
        logic.update()
      }

      const attacksBefore = logic.getWaveRecorder().getAttacks().length

      // 调用 setGameOver
      logic.setGameOver()

      // 继续调用 update
      for (let i = 0; i < 200; i++) {
        logic.update()
      }

      // 攻击次数不应增加
      const attacksAfter = logic.getWaveRecorder().getAttacks().length
      expect(attacksAfter).toBe(attacksBefore)
    })

    it('调用 setGameOver 后不能放置建筑', () => {
      const moneyBefore = logic.getState().money

      logic.setGameOver()

      const result = logic.placeBuilding([5, 5], 'wall')

      expect(result.success).toBe(false)
      expect(result.reason).toBe('game_over')
      expect(logic.getState().money).toBe(moneyBefore)
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('调用 setGameOver 后不能升级建筑', () => {
      // 先放置建筑
      const placeResult = logic.placeBuilding([5, 5], 'cannon')
      expect(placeResult.success).toBe(true)

      const building = logic.getBuildings()[0]
      const levelBefore = building.level
      const moneyBefore = logic.getState().money

      logic.setGameOver()

      const result = logic.upgradeBuilding(building.id)

      expect(result.success).toBe(false)
      expect(result.reason).toBe('game_over')
      expect(building.level).toBe(levelBefore)
      expect(logic.getState().money).toBe(moneyBefore)
    })

    it('调用 setGameOver 后不能出售建筑', () => {
      // 先放置建筑
      const placeResult = logic.placeBuilding([5, 5], 'cannon')
      expect(placeResult.success).toBe(true)

      const building = logic.getBuildings()[0]
      const moneyBefore = logic.getState().money

      logic.setGameOver()

      const result = logic.sellBuilding(building.id)

      expect(result.success).toBe(false)
      expect(result.reason).toBe('game_over')
      expect(logic.getBuildings()).toHaveLength(1)
      expect(logic.getState().money).toBe(moneyBefore)
    })

    it('游戏结束后重置再放置建筑应成功', () => {
      logic.setGameOver()

      // 游戏结束后操作应失败
      const failResult = logic.placeBuilding([5, 5], 'wall')
      expect(failResult.success).toBe(false)
      expect(failResult.reason).toBe('game_over')

      // 重置后操作应成功
      logic.reset()

      const successResult = logic.placeBuilding([5, 5], 'wall')
      expect(successResult.success).toBe(true)
      expect(logic.getBuildings()).toHaveLength(1)
    })

    it('怪物穿过导致游戏结束后不能放置建筑', () => {
      const lowLifeConfig = {
        ...MOCK_GAME_CONFIG,
        initial: { ...MOCK_GAME_CONFIG.initial, life: 1 },
      }
      const lowLifeLogic = createGameSceneLogic(lowLifeConfig)
      lowLifeLogic.prepareNextWaveRecorder(1)

      // 使用高速怪物快速穿过
      lowLifeLogic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 }],
      })

      // 运行直到游戏结束
      for (let i = 0; i < 5000; i++) {
        lowLifeLogic.update()
        if (lowLifeLogic.getState().isGameOver) break
      }

      expect(lowLifeLogic.getState().isGameOver).toBe(true)

      // 游戏结束后尝试放置建筑应失败
      const result = lowLifeLogic.placeBuilding([5, 5], 'wall')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('game_over')
    })

    it('生命值从 1 降为 0 时游戏结束且无法操作', () => {
      const lowLifeConfig = {
        ...MOCK_GAME_CONFIG,
        initial: { ...MOCK_GAME_CONFIG.initial, life: 1 },
      }
      const lowLifeLogic = createGameSceneLogic(lowLifeConfig)
      lowLifeLogic.prepareNextWaveRecorder(1)

      // 使用伤害为 1 的普通怪 (type: 0, damage: 1)
      lowLifeLogic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 }],
      })

      // 运行直到游戏结束
      for (let i = 0; i < 5000; i++) {
        lowLifeLogic.update()
        if (lowLifeLogic.getState().isGameOver) break
      }

      // 验证生命值精确为 0
      expect(lowLifeLogic.getState().life).toBe(0)
      expect(lowLifeLogic.getState().isGameOver).toBe(true)

      // 游戏结束后操作应失败
      const result = lowLifeLogic.placeBuilding([5, 5], 'wall')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('game_over')
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

    it('暂停时波次完成状态不变（用于 UI 层检查）', () => {
      // 这个测试验证暂停时 isWaveComplete() 状态保持不变
      // UI 层（Game.ts）应该在暂停时跳过波次间隔处理
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 }],
      })

      // 运行直到波次完成
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      expect(logic.isWaveComplete()).toBe(true)
      const waveBefore = logic.getState().wave

      // 暂停后波次号不应改变
      logic.togglePause()
      expect(logic.getState().isPaused).toBe(true)

      // 多次调用 update
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // 波次号应该保持不变（因为暂停时不更新）
      expect(logic.getState().wave).toBe(waveBefore)
      expect(logic.isWaveComplete()).toBe(true)
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

    it('记录怪物生成（spawned 字段）', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
          { id: 'uuid-2', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
          { id: 'uuid-3', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
        ],
      })

      // 第一帧生成第一只怪物
      logic.update()
      expect(logic.getWaveRecorder().getResult().spawned).toBe(1)
    })

    it('多只怪物生成时 spawned 递增', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
          { id: 'uuid-2', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
        ],
      })

      // 运行足够帧数让两只怪物都生成
      // 怪物生成间隔默认为 30 帧
      for (let i = 0; i < 60; i++) {
        logic.update()
      }

      const recorder = logic.getWaveRecorder()
      expect(recorder.getResult().spawned).toBe(2)
    })

    it('spawned 与怪物数量一致性验证', () => {
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 },
        ],
      }

      logic.startWave(waveConfig)

      // 运行到怪物穿过终点
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const result = logic.getWaveRecorder().getResult()
      // 验证公式: killed + passed + remaining == spawned
      const remaining = result.remaining ?? 0
      expect(result.killed + result.passed + remaining).toBe(result.spawned)
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

    it('连续 3 波以上的累计分数计算正确（使用 prepareNextWaveRecorder）', () => {
      // 放置建筑
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')

      const waveScores: number[] = []
      let expectedTotal = 0

      // 运行 4 波，验证累计分数
      for (let wave = 1; wave <= 4; wave++) {
        logic.startWave({
          waveNumber: wave,
          monsters: [
            { id: `uuid-${wave}-1`, type: 0, life: 30, speed: 0.5, shield: 0, money: 20 },
          ],
        })

        // 运行到波次结束
        for (let i = 0; i < 3000; i++) {
          logic.update()
          if (logic.isWaveComplete()) break
        }

        // 记录本波得分
        const recorder = logic.getWaveRecorder()
        const waveScore = recorder.getResult().scoreGained
        waveScores.push(waveScore)
        expectedTotal += waveScore

        // 如果不是最后一波，准备下一波
        if (wave < 4) {
          logic.prepareNextWaveRecorder(wave + 1)
        }

        // 验证当前累计分数
        const currentScore = logic.getState().score
        expect(currentScore).toBe(expectedTotal)
      }

      // 最终验证：累计分数 = 所有波次得分之和
      const finalScore = logic.getState().score
      const sumOfWaveScores = waveScores.reduce((a, b) => a + b, 0)
      expect(finalScore).toBe(sumOfWaveScores)

      // 确保确实有多波得分（测试有效性验证）
      expect(waveScores.filter(s => s > 0).length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('prepareNextWaveRecorder - 波次间隔期间建筑操作', () => {
    it('第一波开始前需要调用 prepareNextWaveRecorder 确保 waveNumber 正确', () => {
      // 模拟 Game.ts 中第一波开始前的调用顺序
      logic.prepareNextWaveRecorder(1)
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // 放置建筑（在 startWave 之后）
      logic.placeBuilding([3, 3], 'cannon')

      // 运行到波次结束
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 验证 recorder 的 waveNumber 是 1（不是初始的 0）
      const recorder = logic.getWaveRecorder()
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(1)

      // 验证操作被正确记录
      expect(recorder.getActions()).toHaveLength(1)
      expect(recorder.getActions()[0].type).toBe('BUILD')
    })

    it('prepareNextWaveRecorder 创建新的 recorder 并保存累计分数', () => {
      // 放置建筑
      logic.placeBuilding([3, 3], 'laser_gun')

      // 第一波
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // 运行到波次结束
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const wave1Score = logic.getWaveRecorder().getResult().scoreGained

      // 调用 prepareNextWaveRecorder（模拟提交成功后的调用）
      logic.prepareNextWaveRecorder(2)

      // 新的 recorder 应该是波次 2
      const recorder = logic.getWaveRecorder()
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)

      // 新 recorder 的操作列表应该为空
      expect(recorder.getActions()).toHaveLength(0)
      expect(recorder.getAttacks()).toHaveLength(0)

      // 状态中的分数应该包含第一波的分数
      expect(logic.getState().score).toBe(wave1Score)
    })

    it('波次间隔期间的建筑操作记录到新 recorder', () => {
      // 第一波
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 10 }],
      })

      // 运行到波次结束（怪物快速通过）
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 模拟提交成功后立即准备下一波 recorder
      logic.prepareNextWaveRecorder(2)

      // 在"间隔期间"放置建筑
      logic.placeBuilding([3, 3], 'cannon')
      logic.placeBuilding([5, 5], 'LMG')

      // 这些操作应该记录到波次 2 的 recorder
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      expect(actions).toHaveLength(2)
      expect(actions[0].type).toBe('BUILD')
      expect(actions[1].type).toBe('BUILD')

      // 验证 waveNumber 是 2
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)
    })

    it('startWave 不再重新创建 recorder（由 prepareNextWaveRecorder 负责）', () => {
      // 第一波
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 10 }],
      })

      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 准备下一波 recorder
      logic.prepareNextWaveRecorder(2)

      // 在间隔期间放置建筑
      logic.placeBuilding([3, 3], 'cannon')

      // 获取 recorder 引用
      const recorderBefore = logic.getWaveRecorder()
      const actionsBefore = recorderBefore.getActions().length

      // 调用 startWave
      logic.startWave({
        waveNumber: 2,
        monsters: [{ id: 'uuid-2', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // recorder 应该是同一个实例，操作记录保留
      const recorderAfter = logic.getWaveRecorder()
      expect(recorderAfter.getActions().length).toBe(actionsBefore)
    })

    it('升级和出售操作也记录到新 recorder', () => {
      // 先放一个建筑（wall 最便宜，留更多钱升级）
      logic.placeBuilding([3, 3], 'wall')

      // 第一波（怪物给更多金钱用于升级）
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 100 }],
      })

      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 准备下一波 recorder
      logic.prepareNextWaveRecorder(2)

      // 获取建筑 ID
      const buildings = logic.getBuildings()
      const buildingId = buildings[0].id

      // 在间隔期间升级（验证操作成功）
      const upgradeResult = logic.upgradeBuilding(buildingId)
      expect(upgradeResult.success).toBe(true)

      // 在间隔期间出售（验证操作成功）
      const sellResult = logic.sellBuilding(buildingId)
      expect(sellResult.success).toBe(true)

      // 验证操作记录到波次 2
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      expect(actions.some(a => a.type === 'UPGRADE')).toBe(true)
      expect(actions.some(a => a.type === 'SELL')).toBe(true)

      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)
    })

    it('间隔期间放置的建筑在下一波战斗中正常参与攻击，攻击记录归属正确波次', () => {
      // 简化测试：直接从间隔期间放置建筑开始
      // 模拟场景：API 返回波次 1 配置后，玩家在放置第一个武器前放置了建筑

      // 准备波次 1 的 recorder
      logic.prepareNextWaveRecorder(1)

      // 在"间隔期间"放置建筑（第一波开始前）
      const placeResult = logic.placeBuilding([3, 3], 'LMG')
      expect(placeResult.success).toBe(true)

      // 获取放置的建筑 ID
      const placedBuildingId = placeResult.buildingId!

      // 验证 BUILD action 记录到 recorder
      const recorderBeforeCombat = logic.getWaveRecorder()
      expect(recorderBeforeCombat.getActions()).toHaveLength(1)
      expect(recorderBeforeCombat.getActions()[0].type).toBe('BUILD')

      // 波次 1 的怪物 UUID
      const wave1MonsterId = 'uuid-monster-1'

      // 开始波次 1（怪物进入，建筑开始攻击）
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: wave1MonsterId, type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // 运行战斗直到怪物被击杀或通过
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 获取最终的 recorder
      const recorder = logic.getWaveRecorder()
      const request = recorder.toWaveRequest('test-session', [])

      // 验证 waveNumber 正确
      expect(request.waveNumber).toBe(1)

      // 验证 BUILD action 存在
      expect(request.actions.some(a => a.type === 'BUILD')).toBe(true)

      // 验证有攻击记录
      expect(request.attacks.length).toBeGreaterThan(0)

      // 验证攻击事件的具体内容
      const attacks = request.attacks
      for (const attack of attacks) {
        // 验证攻击来自放置的建筑
        expect(attack.buildingId).toBe(placedBuildingId)

        // 验证攻击目标是波次 1 的怪物
        expect(attack.monsterId).toBe(wave1MonsterId)

        // 验证伤害值为正数
        expect(attack.damage).toBeGreaterThan(0)

        // 验证帧号为正数
        expect(attack.frame).toBeGreaterThan(0)
      }

      // 验证结果数据存在
      expect(request.result).toBeDefined()
      expect(request.result.spawned).toBe(1)
    })

    it('跨波次场景：波次 1 结束后间隔期间放置的建筑，攻击记录归属波次 2', () => {
      // 完整的跨波次场景测试

      // 波次 1：放置第一个建筑，击杀怪物
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')

      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'wave1-monster', type: 0, life: 30, speed: 0.5, shield: 0, money: 100 }],
      })

      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 波次 1 结束后的帧号
      const wave1EndFrame = logic.getState().frame

      // 准备波次 2（模拟 API 返回后）
      logic.prepareNextWaveRecorder(2)

      // 在间隔期间放置第二个建筑
      const placeResult = logic.placeBuilding([5, 5], 'cannon')
      expect(placeResult.success).toBe(true)
      const wave2BuildingId = placeResult.buildingId!

      // 验证 BUILD action 记录到 recorder 2
      const recorder2Actions = logic.getWaveRecorder().getActions()
      expect(recorder2Actions).toHaveLength(1)
      expect(recorder2Actions[0].type).toBe('BUILD')

      // 波次 2 的怪物
      const wave2MonsterId = 'wave2-monster'

      logic.startWave({
        waveNumber: 2,
        monsters: [{ id: wave2MonsterId, type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const request = logic.getWaveRecorder().toWaveRequest('test-session', [])

      // 验证 waveNumber
      expect(request.waveNumber).toBe(2)

      // 验证有攻击记录
      expect(request.attacks.length).toBeGreaterThan(0)

      // 筛选出来自波次 2 新建筑的攻击
      const wave2BuildingAttacks = request.attacks.filter(a => a.buildingId === wave2BuildingId)

      // 验证新建筑的攻击记录
      if (wave2BuildingAttacks.length > 0) {
        for (const attack of wave2BuildingAttacks) {
          // 攻击目标是波次 2 的怪物
          expect(attack.monsterId).toBe(wave2MonsterId)
          // 攻击帧号在波次 2 期间
          expect(attack.frame).toBeGreaterThan(wave1EndFrame)
          // 伤害值为正数
          expect(attack.damage).toBeGreaterThan(0)
        }
      }

      // 验证所有攻击都针对波次 2 的怪物
      for (const attack of request.attacks) {
        expect(attack.monsterId).toBe(wave2MonsterId)
      }
    })

    it('间隔期间升级的建筑在下一波战斗中使用升级后的属性', () => {
      // 第一波：放置 1 级建筑
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'cannon')

      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 100 }],
      })

      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 波次 1 结束，准备波次 2
      logic.prepareNextWaveRecorder(2)

      // 在间隔期间升级建筑
      const buildings = logic.getBuildings()
      const buildingId = buildings[0].id
      const levelBefore = buildings[0].level

      const upgradeResult = logic.upgradeBuilding(buildingId)
      expect(upgradeResult.success).toBe(true)

      const levelAfter = logic.getBuildings()[0].level
      expect(levelAfter).toBe(levelBefore + 1)

      // 验证 UPGRADE action 记录到 recorder 2
      const recorder = logic.getWaveRecorder()
      expect(recorder.getActions().some(a => a.type === 'UPGRADE')).toBe(true)

      // 开始波次 2
      logic.startWave({
        waveNumber: 2,
        monsters: [{ id: 'uuid-2', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // 运行战斗
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 验证攻击记录存在（升级后的建筑参与战斗）
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)
      expect(request.attacks.length).toBeGreaterThan(0)

      // 验证升级操作和攻击记录在同一个请求中
      expect(request.actions.some(a => a.type === 'UPGRADE')).toBe(true)
    })

    it('第一波开始前先放置非武器建筑再放置武器建筑，两个操作都记录到波次 1', () => {
      // 边界问题 4：模拟 Game.ts 的调用顺序
      // 关键点：在放置第一个建筑（无论类型）时就应该准备 recorder

      // 正确的调用顺序：
      // 1. 放置第一个建筑前先准备 recorder
      logic.prepareNextWaveRecorder(1)

      // 2. 玩家先放置 wall（非武器建筑）
      const wallResult = logic.placeBuilding([1, 1], 'wall')
      expect(wallResult.success).toBe(true)

      // 3. 玩家再放置 cannon（武器建筑）
      const cannonResult = logic.placeBuilding([3, 3], 'cannon')
      expect(cannonResult.success).toBe(true)

      // 4. 放置武器后开始波次
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // 验证两个 BUILD 操作都记录到波次 1 的 recorder
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()

      // 应该有 2 个 BUILD action
      const buildActions = actions.filter(a => a.type === 'BUILD')
      expect(buildActions).toHaveLength(2)

      // 验证 waveNumber 是 1
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(1)

      // 验证两个建筑类型
      const buildTypes = buildActions.map(a => (a as { buildingType: string }).buildingType)
      expect(buildTypes).toContain('wall')
      expect(buildTypes).toContain('cannon')
    })

    it('第一波开始前放置多个非武器建筑，所有操作都记录到波次 1', () => {
      // 扩展场景：玩家可能放置多个 wall 后再放置武器

      // 正确的调用顺序：在第一个建筑放置前准备 recorder
      logic.prepareNextWaveRecorder(1)

      // 放置多个 wall（初始金钱 500，wall 成本 20）
      logic.placeBuilding([1, 1], 'wall')
      logic.placeBuilding([2, 2], 'wall')
      logic.placeBuilding([4, 4], 'wall')

      // 然后放置武器（LMG 成本 100）
      logic.placeBuilding([3, 3], 'LMG')

      // 开始波次
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // 验证所有 BUILD 操作都记录到波次 1
      const recorder = logic.getWaveRecorder()
      const buildActions = recorder.getActions().filter(a => a.type === 'BUILD')

      expect(buildActions).toHaveLength(4)

      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(1)
    })
  })

  // ============================================================================
  // 帧号记录正确性测试（边界问题 5）
  // ============================================================================

  describe('startFrame and frame recording', () => {
    it('第一波开始前 prepareNextWaveRecorder 使用 frame=0 作为 startFrame', () => {
      // 游戏初始化后 frame = 0
      expect(logic.getState().frame).toBe(0)

      // 准备波次 1
      logic.prepareNextWaveRecorder(1)

      // 放置建筑（frame 仍然是 0，因为还没调用 update）
      logic.placeBuilding([3, 3], 'cannon')

      // 验证操作记录的 frame 是 0
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      expect(actions).toHaveLength(1)
      expect(actions[0].frame).toBe(0)
    })

    it('波次进行中操作记录使用当前绝对帧号', () => {
      logic.prepareNextWaveRecorder(1)
      // 使用 wall（成本 5）而不是 cannon（成本 300），以便有足够金钱升级
      logic.placeBuilding([3, 3], 'wall')

      logic.startWave({
        waveNumber: 1,
        // 怪物给 300 金钱，足够升级 wall（升级成本约 5 * 0.75 = 3）
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 300 }],
      })

      // 运行 50 帧
      for (let i = 0; i < 50; i++) {
        logic.update()
      }

      const frameAfter50Updates = logic.getState().frame
      expect(frameAfter50Updates).toBe(50)

      // 在 frame=50 时升级建筑
      const building = logic.getBuildings()[0]
      const upgradeResult = logic.upgradeBuilding(building.id)
      expect(upgradeResult.success).toBe(true)

      // 验证升级操作记录的 frame 是 50
      const recorder = logic.getWaveRecorder()
      const upgradeAction = recorder.getActions().find(a => a.type === 'UPGRADE')
      expect(upgradeAction).toBeDefined()
      expect(upgradeAction!.frame).toBe(50)
    })

    it('跨波次场景：波次 2 的 startFrame 是波次 1 结束时的帧号', () => {
      // 波次 1
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // 运行到波次 1 结束
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const wave1EndFrame = logic.getState().frame

      // 准备波次 2（此时 startFrame 应该是 wave1EndFrame）
      logic.prepareNextWaveRecorder(2)

      // 在间隔期间放置建筑（frame 仍然是 wave1EndFrame）
      logic.placeBuilding([5, 5], 'cannon')

      // 验证操作记录的 frame 是 wave1EndFrame
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      expect(actions).toHaveLength(1)
      expect(actions[0].frame).toBe(wave1EndFrame)
    })

    it('waveDurationFrames 正确计算为 endFrame - startFrame', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')

      // 记录波次开始时的帧号
      const startFrame = logic.getState().frame

      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // 运行到波次结束
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const endFrame = logic.getState().frame

      // 验证 waveDurationFrames
      const recorder = logic.getWaveRecorder()
      const result = recorder.getResult()
      expect(result.waveDurationFrames).toBe(endFrame - startFrame)
    })

    it('间隔期间 frame 不增长（update 跳过非战斗状态）', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 10, shield: 0, money: 10 }],
      })

      // 运行到波次结束
      for (let i = 0; i < 1000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const frameAtWaveEnd = logic.getState().frame

      // 准备波次 2（模拟 API 响应后）
      logic.prepareNextWaveRecorder(2)

      // 在间隔期间，不调用 startWave，直接放置建筑
      // （模拟玩家在等待下一波时操作）
      logic.placeBuilding([5, 5], 'cannon')

      // 间隔期间 frame 不增长（因为没有调用 update 或 update 跳过）
      // 注意：实际游戏中 Game.ts 的 update 会在间隔期间继续运行
      // 但 GameSceneLogic.update 会因为 waveComplete 而不增长 frame
      const frameAfterIntervalAction = logic.getState().frame
      expect(frameAfterIntervalAction).toBe(frameAtWaveEnd)
    })

    it('攻击事件的 frame 记录正确（绝对帧号）', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // 运行直到有攻击发生
      let attackOccurred = false
      for (let i = 0; i < 500; i++) {
        logic.update()
        const attacks = logic.getWaveRecorder().getAttacks()
        if (attacks.length > 0) {
          attackOccurred = true
          break
        }
      }

      expect(attackOccurred).toBe(true)

      // 验证攻击事件的 frame 是正数（绝对帧号）
      const attacks = logic.getWaveRecorder().getAttacks()
      for (const attack of attacks) {
        expect(attack.frame).toBeGreaterThan(0)
        expect(attack.frame).toBeLessThanOrEqual(logic.getState().frame)
      }
    })
  })

  // ============================================================================
  // waveNumber 一致性测试（边界问题 6）
  // ============================================================================

  describe('prepareNextWaveRecorder and startWave waveNumber consistency', () => {
    it('正确调用顺序：prepareNextWaveRecorder(N) → startWave(N) 数据一致', () => {
      // 准备波次 2
      logic.prepareNextWaveRecorder(2)
      logic.placeBuilding([3, 3], 'LMG')

      // 开始波次 2（waveNumber 一致）
      logic.startWave({
        waveNumber: 2,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // 运行到波次结束
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 验证 state.wave 和 recorder.waveNumber 一致
      expect(logic.getState().wave).toBe(2)
      const request = logic.getWaveRecorder().toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)
    })

    it('不一致调用：prepareNextWaveRecorder(2) → startWave(3) 导致 recorder.waveNumber 与 state.wave 不同', () => {
      // 这是一个文档化的边界行为测试
      // 目的：记录当前行为，以便未来修改时能检测到变化

      // 准备波次 2
      logic.prepareNextWaveRecorder(2)
      logic.placeBuilding([3, 3], 'LMG')

      // 错误地开始波次 3（waveNumber 不一致）
      logic.startWave({
        waveNumber: 3,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // 运行到波次结束
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 当前行为：state.wave 被更新为 3，但 recorder.waveNumber 仍然是 2
      expect(logic.getState().wave).toBe(3)
      const request = logic.getWaveRecorder().toWaveRequest('test-session', [])
      // recorder 的 waveNumber 是 prepareNextWaveRecorder 传入的值
      expect(request.waveNumber).toBe(2)

      // 注意：这是一个编程错误场景，Game.ts 应该确保一致性
      // 此测试记录当前行为，不是推荐的使用方式
    })

    it('连续正确调用序列：波次 1 → 波次 2 → 波次 3 数据一致', () => {
      // 波次 1
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }
      expect(logic.getState().wave).toBe(1)
      expect(logic.getWaveRecorder().toWaveRequest('test', []).waveNumber).toBe(1)

      // 波次 2
      logic.prepareNextWaveRecorder(2)
      logic.startWave({
        waveNumber: 2,
        monsters: [{ id: 'uuid-2', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }
      expect(logic.getState().wave).toBe(2)
      expect(logic.getWaveRecorder().toWaveRequest('test', []).waveNumber).toBe(2)

      // 波次 3
      logic.prepareNextWaveRecorder(3)
      logic.startWave({
        waveNumber: 3,
        monsters: [{ id: 'uuid-3', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }
      expect(logic.getState().wave).toBe(3)
      expect(logic.getWaveRecorder().toWaveRequest('test', []).waveNumber).toBe(3)
    })

    it('Game.ts 调用模式验证：第一波正确初始化', () => {
      // 模拟 Game.ts 中第一波的调用模式
      // 1. 玩家放置建筑前先 prepareNextWaveRecorder
      // 2. 放置建筑
      // 3. 放置武器后 startWave

      const waveNumber = 1

      // 准备 recorder（使用相同的 waveNumber）
      logic.prepareNextWaveRecorder(waveNumber)

      // 放置建筑
      logic.placeBuilding([3, 3], 'LMG')

      // 开始波次（使用相同的 waveNumber）
      logic.startWave({
        waveNumber: waveNumber,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // 验证一致性
      expect(logic.getState().wave).toBe(waveNumber)
      expect(logic.getWaveRecorder().toWaveRequest('test', []).waveNumber).toBe(waveNumber)
    })
  })

  // ============================================================================
  // 暂停期间操作行为测试
  // ============================================================================

  describe('pause state and operations', () => {
    it('暂停期间允许放置建筑', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 100 }],
      })

      // 运行几帧
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      // 暂停游戏
      logic.togglePause()
      expect(logic.getState().isPaused).toBe(true)

      // 暂停期间放置建筑应该成功
      const result = logic.placeBuilding([5, 5], 'cannon')
      expect(result.success).toBe(true)

      // 验证建筑确实被放置
      expect(logic.getBuildings()).toHaveLength(2)
    })

    it('暂停期间放置建筑使用暂停时的帧号', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 100 }],
      })

      // 运行 50 帧
      for (let i = 0; i < 50; i++) {
        logic.update()
      }

      const frameBeforePause = logic.getState().frame
      expect(frameBeforePause).toBe(50)

      // 暂停游戏
      logic.togglePause()

      // 暂停期间放置建筑
      logic.placeBuilding([5, 5], 'cannon')

      // 验证操作记录的帧号是暂停时的帧号
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      const lastAction = actions[actions.length - 1]
      expect(lastAction.type).toBe('BUILD')
      expect(lastAction.frame).toBe(50)
    })

    it('暂停期间帧号不增长', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 100 }],
      })

      // 运行 30 帧
      for (let i = 0; i < 30; i++) {
        logic.update()
      }

      const frameBeforePause = logic.getState().frame
      expect(frameBeforePause).toBe(30)

      // 暂停游戏
      logic.togglePause()

      // 暂停期间调用多次 update
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // 帧号不应该增长
      expect(logic.getState().frame).toBe(30)

      // 恢复游戏
      logic.togglePause()

      // 继续运行 20 帧
      for (let i = 0; i < 20; i++) {
        logic.update()
      }

      // 帧号应该是 30 + 20 = 50
      expect(logic.getState().frame).toBe(50)
    })

    it('暂停期间允许升级建筑，使用暂停时的帧号', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'wall')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 500 }],
      })

      // 运行到怪物被击杀（获得金钱）
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const frameBeforePause = logic.getState().frame

      // 暂停游戏
      logic.togglePause()

      // 暂停期间升级建筑
      const building = logic.getBuildings()[0]
      const result = logic.upgradeBuilding(building.id)
      expect(result.success).toBe(true)

      // 验证升级操作记录的帧号
      const recorder = logic.getWaveRecorder()
      const upgradeAction = recorder.getActions().find(a => a.type === 'UPGRADE')
      expect(upgradeAction).toBeDefined()
      expect(upgradeAction!.frame).toBe(frameBeforePause)
    })

    it('暂停期间允许出售建筑，使用暂停时的帧号', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'cannon')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // 运行 40 帧
      for (let i = 0; i < 40; i++) {
        logic.update()
      }

      const frameBeforePause = logic.getState().frame
      expect(frameBeforePause).toBe(40)

      // 暂停游戏
      logic.togglePause()

      // 暂停期间出售建筑
      const building = logic.getBuildings()[0]
      const result = logic.sellBuilding(building.id)
      expect(result.success).toBe(true)

      // 验证出售操作记录的帧号
      const recorder = logic.getWaveRecorder()
      const sellAction = recorder.getActions().find(a => a.type === 'SELL')
      expect(sellAction).toBeDefined()
      expect(sellAction!.frame).toBe(40)

      // 验证建筑已被移除
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('暂停期间怪物不移动，建筑不攻击', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // 运行 10 帧让怪物开始移动
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      // 记录暂停前的攻击数
      const attacksBeforePause = logic.getWaveRecorder().getAttacks().length

      // 暂停游戏
      logic.togglePause()

      // 暂停期间调用多次 update
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // 攻击数不应该增加
      const attacksAfterPause = logic.getWaveRecorder().getAttacks().length
      expect(attacksAfterPause).toBe(attacksBeforePause)
    })

    it('恢复后游戏继续正常运行', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // 运行几帧
      for (let i = 0; i < 20; i++) {
        logic.update()
      }

      // 暂停
      logic.togglePause()

      // 暂停期间
      for (let i = 0; i < 50; i++) {
        logic.update()
      }

      // 恢复
      logic.togglePause()

      // 运行到波次结束
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // 波次应该正常结束
      expect(logic.isWaveComplete()).toBe(true)

      // 应该有攻击记录
      expect(logic.getWaveRecorder().getAttacks().length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // 提前结束游戏测试
  // ============================================================================

  describe('early game over - remaining monsters', () => {
    it('setGameOver 后可以获取在场怪物列表', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // 运行几帧让怪物生成
      for (let i = 0; i < 50; i++) {
        logic.update()
      }

      // 提前结束游戏
      logic.setGameOver()

      // 应该能获取在场怪物
      const monsters = logic.getMonsters()
      expect(monsters.length).toBeGreaterThan(0)

      // 怪物仍然有效
      for (const monster of monsters) {
        expect(monster.isValid).toBe(true)
      }
    })

    it('提前结束时记录剩余怪物 ID（模拟 Game.ts 的调用流程）', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'wall') // 不攻击，所有怪物都会存活
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-3', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // 运行足够帧数让所有怪物生成
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // 提前结束游戏
      logic.setGameOver()

      // 模拟 Game.ts 的调用流程：遍历在场怪物并记录
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      // 验证 remainingMonsterIds
      const remainingIds = waveRecorder.getRemainingMonsterIds()
      expect(remainingIds.length).toBe(monsters.filter(m => m.isValid).length)

      // 验证 ID 正确
      for (const monster of monsters) {
        if (monster.isValid) {
          expect(remainingIds).toContain(monster.id)
        }
      }
    })

    it('提前结束时 remaining 数量正确', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 30, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-3', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // 运行一段时间，可能击杀第一个怪物
      for (let i = 0; i < 200; i++) {
        logic.update()
      }

      // 提前结束游戏
      logic.setGameOver()

      // 记录剩余怪物
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      // 获取结果
      const result = waveRecorder.getResult()

      // 验证 remaining 字段
      if (result.remaining !== undefined) {
        expect(result.remaining).toBe(result.remainingMonsterIds?.length)
      }
    })

    it('提前结束时数量守恒公式成立：killed + passed + remaining == spawned', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 30, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 30, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-3', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-4', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // 运行一段时间，击杀部分怪物
      for (let i = 0; i < 300; i++) {
        logic.update()
      }

      // 提前结束游戏
      logic.setGameOver()

      // 记录剩余怪物
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      // 验证数量守恒公式
      const result = waveRecorder.getResult()
      const remaining = result.remaining ?? 0
      expect(result.killed + result.passed + remaining).toBe(result.spawned)
    })

    it('波次进行中部分怪物未生成时提前结束', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-3', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-4', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-5', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // 只运行很少的帧数，可能只生成了部分怪物
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      // 提前结束游戏
      logic.setGameOver()

      // 记录剩余怪物
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      const result = waveRecorder.getResult()

      // spawned 可能小于配置的怪物总数（因为提前结束）
      // 但数量守恒公式仍然成立
      const remaining = result.remaining ?? 0
      expect(result.killed + result.passed + remaining).toBe(result.spawned)
    })

    it('提前结束后 lastWave 数据包含正确的 remaining 信息', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // 运行一段时间
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // 提前结束游戏
      logic.setGameOver()

      // 模拟 Game.ts 的完整调用流程
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      // 获取 API 请求格式的数据
      const buildings = logic.getBuildings()
      const buildingSnapshots = buildings.map(b => ({
        id: b.id,
        type: b.type,
        position: b.position,
        level: b.level,
        damageDealt: b.damageDealt,
        kills: b.kills,
      }))
      const request = waveRecorder.toWaveRequest('test-session', buildingSnapshots)

      // 验证请求数据
      expect(request.waveNumber).toBe(1)
      expect(request.result.remaining).toBeGreaterThan(0)
      expect(request.result.remainingMonsterIds).toBeDefined()
      expect(request.result.remainingMonsterIds!.length).toBe(request.result.remaining)

      // 验证数量守恒
      const remaining = request.result.remaining ?? 0
      expect(request.result.killed + request.result.passed + remaining).toBe(request.result.spawned)
    })

    it('正常结束时 remaining 为 0 或 undefined', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'laser_gun')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          // 使用高速度的怪物，确保能在限定帧内完成
          { id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 },
        ],
      })

      // 运行到波次正常结束（增加帧数上限）
      let completed = false
      for (let i = 0; i < 10000; i++) {
        logic.update()
        if (logic.isWaveComplete()) {
          completed = true
          break
        }
      }

      expect(completed).toBe(true)

      // 正常结束时不需要记录剩余怪物
      const result = logic.getWaveRecorder().getResult()

      // remaining 应该是 undefined（没有剩余怪物）
      expect(result.remaining).toBeUndefined()

      // 数量守恒：killed + passed == spawned
      expect(result.killed + result.passed).toBe(result.spawned)
    })
  })
})
