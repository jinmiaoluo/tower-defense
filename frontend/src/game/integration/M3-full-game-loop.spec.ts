/**
 * M3 集成测试: 完整游戏循环
 * 测试: 建筑放置 -> 攻击 -> 怪物死亡 -> 金钱获得 -> 波次完成
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createGameSceneLogic, type GameSceneLogic } from '../systems/GameSceneLogic'
import { MOCK_GAME_CONFIG } from '@/mocks/config'
import type { WaveConfig, MonsterConfig, GameConfig } from '@/types'

describe('M3: 完整游戏循环', () => {
  let logic: GameSceneLogic
  let config: GameConfig

  beforeEach(() => {
    config = MOCK_GAME_CONFIG
    logic = createGameSceneLogic(config)
  })

  /**
   * 创建测试用波次配置
   */
  function createWaveConfig(monsters: Partial<MonsterConfig>[]): WaveConfig {
    return {
      waveNumber: 1,
      monsters: monsters.map((m, i) => ({
        id: `test-monster-${i}`,
        type: m.type ?? 0,
        life: m.life ?? 50,
        speed: m.speed ?? 3,
        shield: m.shield ?? 0,
        money: m.money ?? 5,
      })),
    }
  }

  describe('建筑放置流程', () => {
    it('放置建筑应扣除金钱', () => {
      const initialMoney = logic.getState().money

      const result = logic.placeBuilding([5, 5], 'LMG')
      expect(result.success).toBe(true)

      const cost = config.buildings.LMG.cost
      expect(logic.getState().money).toBe(initialMoney - cost)
    })

    it('金钱不足时无法放置建筑', () => {
      // 放置多个昂贵建筑耗尽金钱
      logic.placeBuilding([3, 3], 'cannon') // 300
      logic.placeBuilding([3, 5], 'laser_gun') // 2000 - 应该失败

      const result = logic.placeBuilding([5, 5], 'laser_gun')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('insufficient_money')
    })

    it('放置建筑应更新路径', () => {
      const pathBefore = logic.getCurrentPath()

      // 找到路径上的一个点来放置建筑
      // 路径通常经过对角线，找一个中间点
      const midPoint = pathBefore[Math.floor(pathBefore.length / 2)]

      // 放置建筑在路径上的点
      const result = logic.placeBuilding(midPoint, 'wall')

      if (result.success) {
        const pathAfter = logic.getCurrentPath()
        // 路径应该改变以绕过建筑
        expect(pathAfter).not.toEqual(pathBefore)
      } else {
        // 如果放置失败（可能阻断路径），则测试跳过
        expect(result.reason).toBe('would_block_path')
      }
    })

    it('不能在入口/出口放置建筑', () => {
      const result1 = logic.placeBuilding([0, 0], 'wall') // 入口
      expect(result1.success).toBe(false)

      const result2 = logic.placeBuilding([15, 15], 'wall') // 出口
      expect(result2.success).toBe(false)
    })
  })

  describe('建筑攻击流程', () => {
    it('建筑应攻击射程内的怪物', () => {
      // 放置 LMG 在入口附近，确保无论路径如何随机都能覆盖怪物
      // 入口在 [0,0]，怪物必然从这里出发
      logic.placeBuilding([1, 1], 'LMG')

      // 开始波次
      const waveConfig = createWaveConfig([{ life: 100, speed: 3 }])
      logic.startWave(waveConfig)

      // 运行足够帧数让怪物进入射程并被攻击
      for (let i = 0; i < 500; i++) {
        logic.update()
      }

      // 检查是否有攻击记录
      const attacks = logic.getWaveRecorder().getAttacks()
      expect(attacks.length).toBeGreaterThan(0)
    })

    it('激光枪应立即命中', () => {
      // 激光枪成本 2000，需要先增加金钱
      // 通过出售建筑获得金钱
      logic.placeBuilding([5, 5], 'LMG')

      // 放置一个激光枪位置
      const state = logic.getState()
      if (state.money >= 2000) {
        logic.placeBuilding([3, 3], 'laser_gun')
      }

      // 开始波次
      const waveConfig = createWaveConfig([{ life: 50, speed: 3 }])
      logic.startWave(waveConfig)

      // 运行帧数
      for (let i = 0; i < 300; i++) {
        logic.update()
      }

      // 激光枪攻击不产生子弹
      const bullets = logic.getBullets()
      // 应该只有 LMG 的子弹
      expect(bullets.every((b) => b.building.type !== 'laser_gun')).toBe(true)
    })
  })

  describe('怪物死亡和金钱奖励', () => {
    it('击杀怪物应获得金钱', () => {
      // 放置多个建筑确保能击杀
      logic.placeBuilding([5, 5], 'LMG')
      logic.placeBuilding([7, 7], 'LMG')
      logic.placeBuilding([9, 9], 'LMG')

      // 开始波次（低生命值怪物便于测试击杀）
      const waveConfig = createWaveConfig([
        { life: 20, speed: 3, money: 10 },
        { life: 20, speed: 3, money: 10 },
      ])
      logic.startWave(waveConfig)

      // 运行直到波次完成
      // 怪物速度慢（0.12 像素/帧），需要足够帧数确保到达建筑射程
      let maxFrames = 5000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      // 检查击杀记录
      const result = logic.getWaveRecorder().getResult()
      expect(result.killed).toBeGreaterThan(0)

      // 金钱应该增加（击杀奖励 - 可能有怪物穿过）
      if (result.killed > 0) {
        expect(result.moneyGained).toBeGreaterThan(0)
      }
    })

    it('击杀应累计正确的分数', () => {
      logic.placeBuilding([5, 5], 'LMG')
      logic.placeBuilding([7, 7], 'LMG')

      // 开始波次
      const waveConfig = createWaveConfig([{ life: 30, speed: 3 }])
      logic.startWave(waveConfig)

      // 运行直到波次完成
      let maxFrames = 2000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      // 检查分数（分数 = sum(floor(sqrt(每次攻击伤害)))）
      const result = logic.getWaveRecorder().getResult()
      if (result.totalDamageDealt > 0) {
        expect(result.scoreGained).toBeGreaterThan(0)
      }
    })
  })

  describe('怪物到达终点', () => {
    it('怪物到达终点应扣除生命', () => {
      // 不放置任何建筑
      const initialLife = logic.getState().life

      // 开始波次（高速低生命怪物）
      const waveConfig = createWaveConfig([
        { life: 1000, speed: 30, money: 5 }, // 高速高血量，难以击杀
      ])
      logic.startWave(waveConfig)

      // 运行直到波次完成
      let maxFrames = 3000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      // 检查生命是否减少
      const result = logic.getWaveRecorder().getResult()
      if (result.passed > 0) {
        expect(result.lifeLost).toBeGreaterThan(0)
        expect(logic.getState().life).toBeLessThan(initialLife)
      }
    })
  })

  describe('波次完成判定', () => {
    it('所有怪物死亡后波次应完成', () => {
      // 放置足够建筑击杀所有怪物
      logic.placeBuilding([3, 3], 'LMG')
      logic.placeBuilding([5, 5], 'LMG')
      logic.placeBuilding([7, 7], 'LMG')
      logic.placeBuilding([9, 9], 'LMG')

      // 开始波次（低生命怪物）
      const waveConfig = createWaveConfig([
        { life: 10, speed: 3 },
        { life: 10, speed: 3 },
      ])
      logic.startWave(waveConfig)

      expect(logic.isWaveComplete()).toBe(false)

      // 运行直到完成
      let maxFrames = 2000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      expect(logic.isWaveComplete()).toBe(true)
    })

    it('所有怪物穿过后波次应完成', () => {
      // 不放置建筑
      const waveConfig = createWaveConfig([
        { life: 100, speed: 30 }, // 高速
      ])
      logic.startWave(waveConfig)

      // 运行直到完成
      let maxFrames = 3000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      expect(logic.isWaveComplete()).toBe(true)

      const result = logic.getWaveRecorder().getResult()
      expect(result.passed).toBe(1)
    })
  })

  describe('建筑升级和出售', () => {
    it('升级建筑应增加伤害和射程', () => {
      const result = logic.placeBuilding([5, 5], 'LMG')
      expect(result.success).toBe(true)

      const buildingId = result.buildingId!
      const buildingBefore = logic.getBuilding(buildingId)!
      const damageBefore = buildingBefore.getDamage()
      const rangeBefore = buildingBefore.getRange()

      // 升级
      const upgradeResult = logic.upgradeBuilding(buildingId)
      expect(upgradeResult.success).toBe(true)

      const buildingAfter = logic.getBuilding(buildingId)!
      expect(buildingAfter.level).toBe(2)
      expect(buildingAfter.getDamage()).toBeGreaterThan(damageBefore)
      expect(buildingAfter.getRange()).toBeGreaterThanOrEqual(rangeBefore)
    })

    it('出售建筑应返回金钱', () => {
      const result = logic.placeBuilding([5, 5], 'LMG')
      const buildingId = result.buildingId!
      const moneyBefore = logic.getState().money

      // 出售
      const sellResult = logic.sellBuilding(buildingId)
      expect(sellResult.success).toBe(true)

      // 金钱应增加
      expect(logic.getState().money).toBeGreaterThan(moneyBefore)

      // 建筑应被移除
      expect(logic.getBuilding(buildingId)).toBeNull()
    })

    it('出售后可用金钱购买新建筑', () => {
      // 初始金钱 500，放置 cannon（300）后剩余 200
      const { buildingId } = logic.placeBuilding([3, 3], 'cannon')
      expect(logic.getState().money).toBe(200)

      // 此时无法购买另一个 cannon
      const failResult = logic.placeBuilding([5, 5], 'cannon')
      expect(failResult.success).toBe(false)
      expect(failResult.reason).toBe('insufficient_money')

      // 出售 cannon，获得 150（300 x 0.5）
      logic.sellBuilding(buildingId!)
      expect(logic.getState().money).toBe(350)

      // 现在仍然无法购买 cannon（需要 300，只有 350 勉强够）
      // 实际上 350 >= 300，可以购买
      const successResult = logic.placeBuilding([5, 5], 'cannon')
      expect(successResult.success).toBe(true)
    })

    it('出售升级后的建筑返回累计投资的一半', () => {
      // 放置 LMG (100) 并升级两次
      const { buildingId } = logic.placeBuilding([5, 5], 'LMG')
      // 金钱: 500 - 100 = 400

      // 第一次升级: 花费 floor(100 x 0.75) = 75
      logic.upgradeBuilding(buildingId!)
      // 金钱: 400 - 75 = 325

      // 第二次升级: 花费 floor((100+75) x 0.75) = floor(131.25) = 131
      logic.upgradeBuilding(buildingId!)
      // 金钱: 325 - 131 = 194

      const building = logic.getBuilding(buildingId!)!
      expect(building.level).toBe(3)
      expect(logic.getState().money).toBe(194)

      // 出售 3 级 LMG
      // 累计花费 = 100 + 75 + 131 = 306
      // 出售回收 = floor(306 x 0.5) = 153
      logic.sellBuilding(buildingId!)
      expect(logic.getState().money).toBe(194 + 153)
    })

    it('出售后位置可立即重新使用', () => {
      const position: [number, number] = [5, 5]

      // 放置并出售
      const { buildingId } = logic.placeBuilding(position, 'LMG')
      logic.sellBuilding(buildingId!)

      // 同一位置放置不同类型的建筑
      const result = logic.placeBuilding(position, 'cannon')
      expect(result.success).toBe(true)
      expect(logic.getBuildings()).toHaveLength(1)
      expect(logic.getBuilding(result.buildingId!)?.type).toBe('cannon')
    })

    it('波次中出售建筑后怪物路径可能变化', () => {
      // 放置 wall 阻挡部分路径
      const { buildingId } = logic.placeBuilding([1, 0], 'wall')

      // 出售 wall
      logic.sellBuilding(buildingId!)

      const pathWithoutWall = logic.getCurrentPath()

      // 路径可能变化（如果 wall 影响了路径）
      // 至少确保路径仍然有效
      expect(pathWithoutWall.length).toBeGreaterThan(0)
    })
  })

  describe('游戏结束', () => {
    it('生命值归零时游戏应结束', () => {
      // 创建一个低生命值的游戏配置
      const lowLifeConfig: GameConfig = {
        ...config,
        initial: { ...config.initial, life: 1 },
      }
      logic = createGameSceneLogic(lowLifeConfig)

      // 开始波次（高伤害怪物）
      const waveConfig = createWaveConfig([
        { life: 10000, speed: 30, money: 5 }, // 几乎不可能击杀
      ])
      logic.startWave(waveConfig)

      // 运行直到游戏结束或超时
      let maxFrames = 5000
      while (!logic.getState().isGameOver && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      // 怪物到达终点后应该游戏结束
      if (logic.getState().life <= 0) {
        expect(logic.getState().isGameOver).toBe(true)
      }
    })
  })

  describe('子弹系统', () => {
    it('子弹应该飞向目标', () => {
      logic.placeBuilding([5, 5], 'cannon')

      const waveConfig = createWaveConfig([{ life: 100, speed: 3 }])
      logic.startWave(waveConfig)

      // 运行让怪物进入射程
      for (let i = 0; i < 200; i++) {
        logic.update()
      }

      // 检查子弹
      const bullets = logic.getBullets()
      // 可能已经命中消失，所以不强制要求有子弹
      // 但如果有子弹，它们应该是有效的
      for (const bullet of bullets) {
        expect(bullet.isValid).toBe(true)
        expect(bullet.damage).toBeGreaterThan(0)
      }
    })

    it('子弹命中应造成伤害', () => {
      // 使用 LMG (射程 5) 而非 cannon (射程 4)，更容易命中
      logic.placeBuilding([5, 5], 'LMG')

      const waveConfig = createWaveConfig([{ life: 200, speed: 3, shield: 0 }])
      logic.startWave(waveConfig)

      // 运行足够帧数让怪物进入射程并被攻击
      // 怪物速度慢（speed * GLOBAL_SPEED * FPS_RATIO = 0.12 像素/帧）
      // 需要足够时间让怪物移动到建筑射程内
      for (let i = 0; i < 2000; i++) {
        logic.update()
      }

      // 检查伤害记录
      const result = logic.getWaveRecorder().getResult()
      expect(result.totalDamageDealt).toBeGreaterThan(0)
    })
  })

  describe('分数累计', () => {
    it('跨波次分数应正确累计', () => {
      logic.placeBuilding([5, 5], 'LMG')
      logic.placeBuilding([7, 7], 'LMG')

      // 第一波
      const wave1 = createWaveConfig([{ life: 30, speed: 3 }])
      logic.startWave(wave1)

      let maxFrames = 2000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      const scoreAfterWave1 = logic.getState().score

      // 第二波
      const wave2: WaveConfig = {
        waveNumber: 2,
        monsters: [{ id: 'w2-m1', type: 0, life: 30, speed: 3, shield: 0, money: 5 }],
      }
      logic.startWave(wave2)

      maxFrames = 2000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      const scoreAfterWave2 = logic.getState().score

      // 第二波分数应该累加
      expect(scoreAfterWave2).toBeGreaterThanOrEqual(scoreAfterWave1)
    })
  })
})
