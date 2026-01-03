/**
 * WaveRecorder 测试用例
 * 测试波次记录器的核心功能
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type {
  AttackRecordData,
  BuildActionData,
  BuildingSnapshot,
  KillRecordData,
  PassedRecordData,
  SellActionData,
  UpgradeActionData,
} from '@/types'
import { createWaveRecorder, type WaveRecorder } from './WaveRecorder'

describe('WaveRecorder', () => {
  let recorder: WaveRecorder

  beforeEach(() => {
    recorder = createWaveRecorder(1, 0)
  })

  // ============================================================================
  // 初始化测试
  // ============================================================================

  describe('initialization', () => {
    it('创建记录器时设置波次号和起始帧', () => {
      const r = createWaveRecorder(5, 100)
      const result = r.getResult()
      expect(result.killed).toBe(0)
      expect(result.passed).toBe(0)
    })

    it('初始状态下所有统计为空', () => {
      expect(recorder.getActions()).toEqual([])
      expect(recorder.getAttacks()).toEqual([])
      const result = recorder.getResult()
      expect(result.killed).toBe(0)
      expect(result.killedByType).toEqual({})
      expect(result.passed).toBe(0)
      expect(result.scoreGained).toBe(0)
      expect(result.moneyGained).toBe(0)
      expect(result.lifeLost).toBe(0)
      expect(result.totalDamageDealt).toBe(0)
      expect(result.totalLifeDestroyed).toBe(0)
    })
  })

  // ============================================================================
  // recordBuild - 记录建造操作
  // ============================================================================

  describe('recordBuild', () => {
    it('记录建造操作', () => {
      const data: BuildActionData = {
        buildingId: 'b-001',
        buildingType: 'cannon',
        position: [5, 5],
        frame: 100,
      }
      recorder.recordBuild(data)

      const actions = recorder.getActions()
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        type: 'BUILD',
        buildingId: 'b-001',
        buildingType: 'cannon',
        position: [5, 5],
        frame: 100,
      })
    })

    it('记录多个建造操作', () => {
      recorder.recordBuild({
        buildingId: 'b-001',
        buildingType: 'cannon',
        position: [5, 5],
        frame: 100,
      })
      recorder.recordBuild({
        buildingId: 'b-002',
        buildingType: 'LMG',
        position: [6, 6],
        frame: 150,
      })

      const actions = recorder.getActions()
      expect(actions).toHaveLength(2)
      expect(actions[0].buildingId).toBe('b-001')
      expect(actions[1].buildingId).toBe('b-002')
    })
  })

  // ============================================================================
  // recordUpgrade - 记录升级操作
  // ============================================================================

  describe('recordUpgrade', () => {
    it('记录升级操作', () => {
      const data: UpgradeActionData = {
        buildingId: 'b-001',
        level: 2,
        frame: 200,
      }
      recorder.recordUpgrade(data)

      const actions = recorder.getActions()
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        type: 'UPGRADE',
        buildingId: 'b-001',
        level: 2,
        frame: 200,
      })
    })

    it('升级操作不包含 buildingType 和 position', () => {
      recorder.recordUpgrade({
        buildingId: 'b-001',
        level: 3,
        frame: 300,
      })

      const actions = recorder.getActions()
      expect(actions[0].buildingType).toBeUndefined()
      expect(actions[0].position).toBeUndefined()
    })
  })

  // ============================================================================
  // recordSell - 记录出售操作
  // ============================================================================

  describe('recordSell', () => {
    it('记录出售操作', () => {
      const data: SellActionData = {
        buildingId: 'b-001',
        frame: 400,
      }
      recorder.recordSell(data)

      const actions = recorder.getActions()
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        type: 'SELL',
        buildingId: 'b-001',
        frame: 400,
      })
    })

    it('出售操作不包含 buildingType、position 和 level', () => {
      recorder.recordSell({
        buildingId: 'b-001',
        frame: 500,
      })

      const actions = recorder.getActions()
      expect(actions[0].buildingType).toBeUndefined()
      expect(actions[0].position).toBeUndefined()
      expect(actions[0].level).toBeUndefined()
    })
  })

  // ============================================================================
  // 混合操作测试
  // ============================================================================

  describe('mixed actions', () => {
    it('按顺序记录多种操作', () => {
      recorder.recordBuild({
        buildingId: 'b-001',
        buildingType: 'cannon',
        position: [5, 5],
        frame: 100,
      })
      recorder.recordUpgrade({
        buildingId: 'b-001',
        level: 2,
        frame: 200,
      })
      recorder.recordSell({
        buildingId: 'b-001',
        frame: 300,
      })

      const actions = recorder.getActions()
      expect(actions).toHaveLength(3)
      expect(actions[0].type).toBe('BUILD')
      expect(actions[1].type).toBe('UPGRADE')
      expect(actions[2].type).toBe('SELL')
    })
  })

  // ============================================================================
  // recordAttack - 记录攻击事件
  // ============================================================================

  describe('recordAttack', () => {
    it('记录攻击事件', () => {
      const data: AttackRecordData = {
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 10,
        frame: 100,
      }
      recorder.recordAttack(data)

      const attacks = recorder.getAttacks()
      expect(attacks).toHaveLength(1)
      expect(attacks[0]).toEqual({
        frame: 100,
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 10,
      })
    })

    it('记录"误伤"攻击事件（原始目标与实际命中不同）', () => {
      const data: AttackRecordData = {
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-2',
        monsterPosition: [4, 4],
        damage: 10,
        frame: 100,
      }
      recorder.recordAttack(data)

      const attacks = recorder.getAttacks()
      expect(attacks[0].originalTargetId).toBe('uuid-1')
      expect(attacks[0].monsterId).toBe('uuid-2')
    })

    it('攻击事件累加 totalDamageDealt', () => {
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 10,
        frame: 100,
      })
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [4, 4],
        monsterId: 'uuid-1',
        monsterPosition: [4, 4],
        damage: 15,
        frame: 120,
      })

      expect(recorder.getResult().totalDamageDealt).toBe(25)
    })

    it('攻击事件累加得分（score = floor(sqrt(damage))）', () => {
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 9,
        frame: 100,
      })
      // sqrt(9) = 3

      expect(recorder.getResult().scoreGained).toBe(3)
    })

    it('多次攻击得分分别计算再累加', () => {
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 4,
        frame: 100,
      })
      // sqrt(4) = 2

      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [4, 4],
        monsterId: 'uuid-1',
        monsterPosition: [4, 4],
        damage: 16,
        frame: 120,
      })
      // sqrt(16) = 4

      expect(recorder.getResult().scoreGained).toBe(6) // 2 + 4
    })

    it('得分向下取整', () => {
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 10,
        frame: 100,
      })
      // sqrt(10) ≈ 3.16 -> 3

      expect(recorder.getResult().scoreGained).toBe(3)
    })
  })

  // ============================================================================
  // recordKill - 记录击杀
  // ============================================================================

  describe('recordKill', () => {
    it('记录击杀增加 killed 计数', () => {
      const data: KillRecordData = {
        monsterType: 0,
        monsterLife: 50,
        money: 5,
      }
      recorder.recordKill(data)

      expect(recorder.getResult().killed).toBe(1)
    })

    it('记录击杀累加 killedByType', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 1, monsterLife: 100, money: 8 })

      const result = recorder.getResult()
      expect(result.killedByType[0]).toBe(2)
      expect(result.killedByType[1]).toBe(1)
    })

    it('记录击杀累加 moneyGained', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 1, monsterLife: 100, money: 8 })

      expect(recorder.getResult().moneyGained).toBe(13)
    })

    it('记录击杀累加 totalLifeDestroyed', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 3, monsterLife: 500, money: 50 })

      expect(recorder.getResult().totalLifeDestroyed).toBe(550)
    })

    it('击杀不影响 scoreGained（得分在攻击时计算）', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })

      expect(recorder.getResult().scoreGained).toBe(0)
    })
  })

  // ============================================================================
  // recordPassed - 记录怪物穿过终点
  // ============================================================================

  describe('recordPassed', () => {
    it('记录穿过增加 passed 计数', () => {
      const data: PassedRecordData = { damage: 1 }
      recorder.recordPassed(data)

      expect(recorder.getResult().passed).toBe(1)
    })

    it('记录穿过累加 lifeLost', () => {
      recorder.recordPassed({ damage: 1 })
      recorder.recordPassed({ damage: 3 })
      recorder.recordPassed({ damage: 10 })

      expect(recorder.getResult().lifeLost).toBe(14)
    })

    it('多次穿过正确累加', () => {
      recorder.recordPassed({ damage: 1 })
      recorder.recordPassed({ damage: 1 })
      recorder.recordPassed({ damage: 1 })

      expect(recorder.getResult().passed).toBe(3)
      expect(recorder.getResult().lifeLost).toBe(3)
    })
  })

  // ============================================================================
  // setDuration - 设置波次持续时间
  // ============================================================================

  describe('setDuration', () => {
    it('传入当前帧号，计算相对于起始帧的持续时间', () => {
      // recorder 初始化时 startFrame = 0
      recorder.setDuration(1000) // currentFrame = 1000

      // waveDurationFrames = 1000 - 0 = 1000
      expect(recorder.getResult().waveDurationFrames).toBe(1000)
    })

    it('可以更新波次持续帧数', () => {
      recorder.setDuration(500)
      recorder.setDuration(1000)

      expect(recorder.getResult().waveDurationFrames).toBe(1000)
    })

    it('非零起始帧时正确计算相对持续时间', () => {
      const r = createWaveRecorder(1, 500) // startFrame = 500
      r.setDuration(1500) // currentFrame = 1500

      // waveDurationFrames = 1500 - 500 = 1000
      expect(r.getResult().waveDurationFrames).toBe(1000)
    })

    it('reset 后使用新的起始帧计算', () => {
      recorder.setDuration(100)
      expect(recorder.getResult().waveDurationFrames).toBe(100) // 100 - 0

      recorder.reset(2, 1000) // 新的 startFrame = 1000
      recorder.setDuration(1500) // currentFrame = 1500

      // waveDurationFrames = 1500 - 1000 = 500
      expect(recorder.getResult().waveDurationFrames).toBe(500)
    })
  })

  // ============================================================================
  // getResult - 获取波次结果
  // ============================================================================

  describe('getResult', () => {
    it('返回完整的波次结果', () => {
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 25,
        frame: 100,
      })
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [4, 4],
        monsterId: 'uuid-1',
        monsterPosition: [4, 4],
        damage: 30,
        frame: 120,
      })
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 1, monsterLife: 100, money: 8 })
      recorder.recordPassed({ damage: 3 })
      recorder.setDuration(1500)

      const result = recorder.getResult()
      expect(result.killed).toBe(2)
      expect(result.killedByType).toEqual({ 0: 1, 1: 1 })
      expect(result.passed).toBe(1)
      expect(result.scoreGained).toBe(10) // floor(sqrt(25)) + floor(sqrt(30)) = 5 + 5
      expect(result.moneyGained).toBe(13)
      expect(result.lifeLost).toBe(3)
      expect(result.totalDamageDealt).toBe(55)
      expect(result.totalLifeDestroyed).toBe(150)
      expect(result.waveDurationFrames).toBe(1500)
    })

    it('killedByType 只包含有击杀的类型', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 3, monsterLife: 500, money: 50 })

      const result = recorder.getResult()
      expect(Object.keys(result.killedByType)).toHaveLength(2)
      expect(result.killedByType[0]).toBe(1)
      expect(result.killedByType[3]).toBe(1)
      expect(result.killedByType[1]).toBeUndefined()
    })
  })

  // ============================================================================
  // toWaveRequest - 导出为 API 请求格式
  // ============================================================================

  describe('toWaveRequest', () => {
    it('导出完整的 WaveRequest', () => {
      recorder.recordBuild({
        buildingId: 'b-001',
        buildingType: 'cannon',
        position: [5, 5],
        frame: 100,
      })
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 10,
        frame: 150,
      })
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.setDuration(1000)

      const buildings: BuildingSnapshot[] = [
        {
          id: 'b-001',
          type: 'cannon',
          position: [5, 5],
          level: 1,
          damageDealt: 10,
          kills: 1,
        },
      ]

      const request = recorder.toWaveRequest('session-123', buildings)

      expect(request.sessionId).toBe('session-123')
      expect(request.waveNumber).toBe(1)
      expect(request.actions).toHaveLength(1)
      expect(request.attacks).toHaveLength(1)
      expect(request.result.killed).toBe(1)
      expect(request.buildings).toEqual(buildings)
    })

    it('waveNumber 使用构造时传入的值', () => {
      const r = createWaveRecorder(5, 0)
      const request = r.toWaveRequest('session-123', [])
      expect(request.waveNumber).toBe(5)
    })
  })

  // ============================================================================
  // reset - 重置记录器
  // ============================================================================

  describe('reset', () => {
    it('重置后所有数据清空', () => {
      recorder.recordBuild({
        buildingId: 'b-001',
        buildingType: 'cannon',
        position: [5, 5],
        frame: 100,
      })
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 10,
        frame: 150,
      })
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.setDuration(1000)

      recorder.reset(2, 1000)

      expect(recorder.getActions()).toEqual([])
      expect(recorder.getAttacks()).toEqual([])
      const result = recorder.getResult()
      expect(result.killed).toBe(0)
      expect(result.scoreGained).toBe(0)
      expect(result.totalDamageDealt).toBe(0)
    })

    it('重置后使用新的波次号', () => {
      recorder.reset(3, 500)
      const request = recorder.toWaveRequest('session-123', [])
      expect(request.waveNumber).toBe(3)
    })

    it('重置后可以继续记录', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.reset(2, 1000)
      recorder.recordKill({ monsterType: 1, monsterLife: 100, money: 8 })

      expect(recorder.getResult().killed).toBe(1)
      expect(recorder.getResult().moneyGained).toBe(8)
    })
  })

  // ============================================================================
  // 集成测试 - 完整波次模拟
  // ============================================================================

  describe('integration', () => {
    it('模拟完整波次记录', () => {
      // 1. 玩家建造建筑
      recorder.recordBuild({
        buildingId: 'b-001',
        buildingType: 'cannon',
        position: [5, 5],
        frame: 0,
      })
      recorder.recordBuild({
        buildingId: 'b-002',
        buildingType: 'LMG',
        position: [6, 6],
        frame: 10,
      })

      // 2. 建筑攻击怪物
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 12,
        frame: 100,
      })
      recorder.recordAttack({
        buildingId: 'b-002',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 4],
        monsterId: 'uuid-1',
        monsterPosition: [3, 4],
        damage: 5,
        frame: 110,
      })
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 5],
        monsterId: 'uuid-1',
        monsterPosition: [3, 5],
        damage: 12,
        frame: 130,
      })
      recorder.recordAttack({
        buildingId: 'b-002',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 6],
        monsterId: 'uuid-1',
        monsterPosition: [3, 6],
        damage: 5,
        frame: 140,
      })
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 7],
        monsterId: 'uuid-1',
        monsterPosition: [3, 7],
        damage: 12,
        frame: 160,
      })

      // 3. 怪物被击杀
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })

      // 4. 玩家升级建筑
      recorder.recordUpgrade({
        buildingId: 'b-001',
        level: 2,
        frame: 200,
      })

      // 5. 第二只怪物穿过
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-2',
        originalTargetPosition: [4, 4],
        monsterId: 'uuid-2',
        monsterPosition: [4, 4],
        damage: 14,
        frame: 300,
      })
      recorder.recordPassed({ damage: 1 })

      // 6. 波次结束
      recorder.setDuration(500)

      // 验证结果
      const result = recorder.getResult()
      expect(result.killed).toBe(1)
      expect(result.passed).toBe(1)
      expect(result.moneyGained).toBe(5)
      expect(result.lifeLost).toBe(1)
      expect(result.totalDamageDealt).toBe(60) // 12+5+12+5+12+14
      expect(result.totalLifeDestroyed).toBe(50)
      expect(result.waveDurationFrames).toBe(500)

      // 得分: floor(sqrt(12))+floor(sqrt(5))+floor(sqrt(12))+floor(sqrt(5))+floor(sqrt(12))+floor(sqrt(14))
      // = 3 + 2 + 3 + 2 + 3 + 3 = 16
      expect(result.scoreGained).toBe(16)

      const actions = recorder.getActions()
      expect(actions).toHaveLength(3) // 2 BUILD + 1 UPGRADE

      const attacks = recorder.getAttacks()
      expect(attacks).toHaveLength(6)
    })
  })
})
