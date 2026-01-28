/**
 * WaveRecorder test cases
 * Tests the core functionality of the wave recorder
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
  // Initialization tests
  // ============================================================================

  describe('initialization', () => {
    it('sets wave number and start frame when creating a recorder', () => {
      const r = createWaveRecorder(5, 100)
      const result = r.getResult()
      expect(result.killed).toBe(0)
      expect(result.passed).toBe(0)
    })

    it('all statistics are empty in initial state', () => {
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
  // recordBuild - Record build actions
  // ============================================================================

  describe('recordBuild', () => {
    it('records a build action', () => {
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

    it('records multiple build actions', () => {
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
  // recordUpgrade - Record upgrade actions
  // ============================================================================

  describe('recordUpgrade', () => {
    it('records an upgrade action', () => {
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

    it('upgrade action does not include buildingType and position', () => {
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
  // recordSell - Record sell actions
  // ============================================================================

  describe('recordSell', () => {
    it('records a sell action', () => {
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

    it('sell action does not include buildingType, position, or level', () => {
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
  // Mixed action tests
  // ============================================================================

  describe('mixed actions', () => {
    it('records multiple action types in order', () => {
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
  // recordAttack - Record attack events
  // ============================================================================

  describe('recordAttack', () => {
    it('records an attack event', () => {
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

    it('records a "friendly fire" attack event (original target differs from actual hit)', () => {
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

    it('attack events accumulate totalDamageDealt', () => {
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

    it('attack events accumulate score (score = floor(sqrt(damage)))', () => {
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

    it('scores from multiple attacks are calculated individually then summed', () => {
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

    it('score is floored', () => {
      recorder.recordAttack({
        buildingId: 'b-001',
        originalTargetId: 'uuid-1',
        originalTargetPosition: [3, 3],
        monsterId: 'uuid-1',
        monsterPosition: [3, 3],
        damage: 10,
        frame: 100,
      })
      // sqrt(10) = 3.16 -> 3

      expect(recorder.getResult().scoreGained).toBe(3)
    })
  })

  // ============================================================================
  // recordKill - Record kills
  // ============================================================================

  describe('recordKill', () => {
    it('recording a kill increases the killed count', () => {
      const data: KillRecordData = {
        monsterType: 0,
        monsterLife: 50,
        money: 5,
      }
      recorder.recordKill(data)

      expect(recorder.getResult().killed).toBe(1)
    })

    it('recording kills accumulates killedByType', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 1, monsterLife: 100, money: 8 })

      const result = recorder.getResult()
      expect(result.killedByType[0]).toBe(2)
      expect(result.killedByType[1]).toBe(1)
    })

    it('recording kills accumulates moneyGained', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 1, monsterLife: 100, money: 8 })

      expect(recorder.getResult().moneyGained).toBe(13)
    })

    it('recording kills accumulates totalLifeDestroyed', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordKill({ monsterType: 3, monsterLife: 500, money: 50 })

      expect(recorder.getResult().totalLifeDestroyed).toBe(550)
    })

    it('kills do not affect scoreGained (score is calculated during attacks)', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })

      expect(recorder.getResult().scoreGained).toBe(0)
    })
  })

  // ============================================================================
  // recordPassed - Record monsters passing through the exit
  // ============================================================================

  describe('recordPassed', () => {
    it('recording a pass increases the passed count', () => {
      const data: PassedRecordData = { damage: 1 }
      recorder.recordPassed(data)

      expect(recorder.getResult().passed).toBe(1)
    })

    it('recording passes accumulates lifeLost', () => {
      recorder.recordPassed({ damage: 1 })
      recorder.recordPassed({ damage: 3 })
      recorder.recordPassed({ damage: 10 })

      expect(recorder.getResult().lifeLost).toBe(14)
    })

    it('multiple passes accumulate correctly', () => {
      recorder.recordPassed({ damage: 1 })
      recorder.recordPassed({ damage: 1 })
      recorder.recordPassed({ damage: 1 })

      expect(recorder.getResult().passed).toBe(3)
      expect(recorder.getResult().lifeLost).toBe(3)
    })
  })

  // ============================================================================
  // recordRemainingMonster - Record remaining monsters on the field
  // ============================================================================

  describe('recordRemainingMonster', () => {
    it('records a single remaining monster', () => {
      recorder.recordRemainingMonster('uuid-1')

      const ids = recorder.getRemainingMonsterIds()
      expect(ids).toHaveLength(1)
      expect(ids[0]).toBe('uuid-1')
    })

    it('records multiple remaining monsters', () => {
      recorder.recordRemainingMonster('uuid-1')
      recorder.recordRemainingMonster('uuid-2')
      recorder.recordRemainingMonster('uuid-3')

      const ids = recorder.getRemainingMonsterIds()
      expect(ids).toHaveLength(3)
      expect(ids).toContain('uuid-1')
      expect(ids).toContain('uuid-2')
      expect(ids).toContain('uuid-3')
    })

    it('getResult includes remaining field (when there are remaining monsters)', () => {
      recorder.recordRemainingMonster('uuid-1')
      recorder.recordRemainingMonster('uuid-2')

      const result = recorder.getResult()
      expect(result.remaining).toBe(2)
      expect(result.remainingMonsterIds).toEqual(['uuid-1', 'uuid-2'])
    })

    it('getResult does not include remaining field (when there are no remaining monsters)', () => {
      // Do not record any remaining monsters
      const result = recorder.getResult()
      expect(result.remaining).toBeUndefined()
      expect(result.remainingMonsterIds).toBeUndefined()
    })

    it('remaining monster list is cleared after reset', () => {
      recorder.recordRemainingMonster('uuid-1')
      recorder.recordRemainingMonster('uuid-2')

      recorder.reset(2, 1000)

      const ids = recorder.getRemainingMonsterIds()
      expect(ids).toHaveLength(0)

      const result = recorder.getResult()
      expect(result.remaining).toBeUndefined()
    })

    it('toWaveRequest includes correct remaining data', () => {
      recorder.recordRemainingMonster('uuid-1')
      recorder.recordRemainingMonster('uuid-2')
      recorder.setDuration(1000)

      const request = recorder.toWaveRequest('session-123', [])

      expect(request.result.remaining).toBe(2)
      expect(request.result.remainingMonsterIds).toEqual(['uuid-1', 'uuid-2'])
    })
  })

  // ============================================================================
  // setDuration - Set wave duration
  // ============================================================================

  describe('setDuration', () => {
    it('calculates duration relative to start frame given current frame', () => {
      // recorder initialized with startFrame = 0
      recorder.setDuration(1000) // currentFrame = 1000

      // waveDurationFrames = 1000 - 0 = 1000
      expect(recorder.getResult().waveDurationFrames).toBe(1000)
    })

    it('can update wave duration frames', () => {
      recorder.setDuration(500)
      recorder.setDuration(1000)

      expect(recorder.getResult().waveDurationFrames).toBe(1000)
    })

    it('correctly calculates relative duration with non-zero start frame', () => {
      const r = createWaveRecorder(1, 500) // startFrame = 500
      r.setDuration(1500) // currentFrame = 1500

      // waveDurationFrames = 1500 - 500 = 1000
      expect(r.getResult().waveDurationFrames).toBe(1000)
    })

    it('uses new start frame after reset', () => {
      recorder.setDuration(100)
      expect(recorder.getResult().waveDurationFrames).toBe(100) // 100 - 0

      recorder.reset(2, 1000) // new startFrame = 1000
      recorder.setDuration(1500) // currentFrame = 1500

      // waveDurationFrames = 1500 - 1000 = 500
      expect(recorder.getResult().waveDurationFrames).toBe(500)
    })
  })

  // ============================================================================
  // getResult - Get wave result
  // ============================================================================

  describe('getResult', () => {
    it('returns the complete wave result', () => {
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

    it('killedByType only includes types with kills', () => {
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
  // toWaveRequest - Export as API request format
  // ============================================================================

  describe('toWaveRequest', () => {
    it('exports a complete WaveRequest', () => {
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

    it('waveNumber uses the value passed at construction', () => {
      const r = createWaveRecorder(5, 0)
      const request = r.toWaveRequest('session-123', [])
      expect(request.waveNumber).toBe(5)
    })
  })

  // ============================================================================
  // reset - Reset recorder
  // ============================================================================

  describe('reset', () => {
    it('all data is cleared after reset', () => {
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

    it('uses new wave number after reset', () => {
      recorder.reset(3, 500)
      const request = recorder.toWaveRequest('session-123', [])
      expect(request.waveNumber).toBe(3)
    })

    it('can continue recording after reset', () => {
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.reset(2, 1000)
      recorder.recordKill({ monsterType: 1, monsterLife: 100, money: 8 })

      expect(recorder.getResult().killed).toBe(1)
      expect(recorder.getResult().moneyGained).toBe(8)
    })
  })

  // ============================================================================
  // recordSpawn - Record monster spawns
  // ============================================================================

  describe('recordSpawn', () => {
    it('records a single monster spawn', () => {
      recorder.recordSpawn()

      expect(recorder.getResult().spawned).toBe(1)
    })

    it('records multiple monster spawns', () => {
      recorder.recordSpawn()
      recorder.recordSpawn()
      recorder.recordSpawn()

      expect(recorder.getResult().spawned).toBe(3)
    })

    it('spawned is 0 in initial state', () => {
      expect(recorder.getResult().spawned).toBe(0)
    })

    it('spawned resets to 0 after reset', () => {
      recorder.recordSpawn()
      recorder.recordSpawn()

      recorder.reset(2, 1000)

      expect(recorder.getResult().spawned).toBe(0)
    })

    it('toWaveRequest includes spawned field', () => {
      recorder.recordSpawn()
      recorder.recordSpawn()
      recorder.setDuration(1000)

      const request = recorder.toWaveRequest('session-123', [])

      expect(request.result.spawned).toBe(2)
    })

    it('spawned works together with killed/passed/remaining', () => {
      // Simulate: spawn 3 monsters, kill 1, pass 1, 1 remaining
      recorder.recordSpawn()
      recorder.recordSpawn()
      recorder.recordSpawn()
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })
      recorder.recordPassed({ damage: 1 })
      recorder.recordRemainingMonster('uuid-3')
      recorder.setDuration(1000)

      const result = recorder.getResult()
      expect(result.spawned).toBe(3)
      expect(result.killed).toBe(1)
      expect(result.passed).toBe(1)
      expect(result.remaining).toBe(1)
      // Verify formula: killed + passed + remaining == spawned
      expect(result.killed + result.passed + (result.remaining ?? 0)).toBe(result.spawned)
    })
  })

  // ============================================================================
  // Integration test - Full wave simulation
  // ============================================================================

  describe('integration', () => {
    it('simulates a complete wave recording', () => {
      // 1. Player builds buildings
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

      // 2. Buildings attack monsters
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

      // 3. Monster is killed
      recorder.recordKill({ monsterType: 0, monsterLife: 50, money: 5 })

      // 4. Player upgrades building
      recorder.recordUpgrade({
        buildingId: 'b-001',
        level: 2,
        frame: 200,
      })

      // 5. Second monster passes through
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

      // 6. Wave ends
      recorder.setDuration(500)

      // Verify results
      const result = recorder.getResult()
      expect(result.killed).toBe(1)
      expect(result.passed).toBe(1)
      expect(result.moneyGained).toBe(5)
      expect(result.lifeLost).toBe(1)
      expect(result.totalDamageDealt).toBe(60) // 12+5+12+5+12+14
      expect(result.totalLifeDestroyed).toBe(50)
      expect(result.waveDurationFrames).toBe(500)

      // Score: floor(sqrt(12))+floor(sqrt(5))+floor(sqrt(12))+floor(sqrt(5))+floor(sqrt(12))+floor(sqrt(14))
      // = 3 + 2 + 3 + 2 + 3 + 3 = 16
      expect(result.scoreGained).toBe(16)

      const actions = recorder.getActions()
      expect(actions).toHaveLength(3) // 2 BUILD + 1 UPGRADE

      const attacks = recorder.getAttacks()
      expect(attacks).toHaveLength(6)
    })
  })
})
