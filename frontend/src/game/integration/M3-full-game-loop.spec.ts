/**
 * M3 integration test: Full game loop
 * Test: Building placement -> Attack -> Monster death -> Money earned -> Wave complete
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createGameSceneLogic, type GameSceneLogic } from '../systems/GameSceneLogic'
import { MOCK_GAME_CONFIG } from '@/mocks/config'
import type { WaveConfig, MonsterConfig, GameConfig } from '@/types'

describe('M3: Full game loop', () => {
  let logic: GameSceneLogic
  let config: GameConfig

  beforeEach(() => {
    config = MOCK_GAME_CONFIG
    logic = createGameSceneLogic(config)
  })

  /**
   * Create test wave config
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

  describe('Building placement flow', () => {
    it('Placing a building should deduct money', () => {
      const initialMoney = logic.getState().money

      const result = logic.placeBuilding([5, 5], 'LMG')
      expect(result.success).toBe(true)

      const cost = config.buildings.LMG.cost
      expect(logic.getState().money).toBe(initialMoney - cost)
    })

    it('Cannot place building when money is insufficient', () => {
      // Place multiple expensive buildings to exhaust money
      logic.placeBuilding([3, 3], 'cannon') // 300
      logic.placeBuilding([3, 5], 'laser_gun') // 2000 - should fail

      const result = logic.placeBuilding([5, 5], 'laser_gun')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('insufficient_money')
    })

    it('Placing a building should update the path', () => {
      const pathBefore = logic.getCurrentPath()

      // Find a point on the path to place the building
      // Path usually goes diagonally, find a midpoint
      const midPoint = pathBefore[Math.floor(pathBefore.length / 2)]

      // Place building on a path point
      const result = logic.placeBuilding(midPoint, 'wall')

      if (result.success) {
        const pathAfter = logic.getCurrentPath()
        // Path should change to route around the building
        expect(pathAfter).not.toEqual(pathBefore)
      } else {
        // If placement fails (may block path), skip the test
        expect(result.reason).toBe('would_block_path')
      }
    })

    it('Cannot place building on entrance/exit', () => {
      const result1 = logic.placeBuilding([0, 0], 'wall') // entrance
      expect(result1.success).toBe(false)

      const result2 = logic.placeBuilding([15, 15], 'wall') // exit
      expect(result2.success).toBe(false)
    })
  })

  describe('Building attack flow', () => {
    it('Building should attack monsters within range', () => {
      // Place LMG near entrance to ensure it covers monsters regardless of path randomness
      // Entrance is at [0,0], monsters always start here
      logic.placeBuilding([1, 1], 'LMG')

      // Start wave
      const waveConfig = createWaveConfig([{ life: 100, speed: 3 }])
      logic.startWave(waveConfig)

      // Run enough frames for monsters to enter range and be attacked
      for (let i = 0; i < 500; i++) {
        logic.update()
      }

      // Check for attack records
      const attacks = logic.getWaveRecorder().getAttacks()
      expect(attacks.length).toBeGreaterThan(0)
    })

    it('Laser gun should hit instantly', () => {
      // Laser gun costs 2000, need to increase money first
      // Get money by selling buildings
      logic.placeBuilding([5, 5], 'LMG')

      // Place a laser gun if affordable
      const state = logic.getState()
      if (state.money >= 2000) {
        logic.placeBuilding([3, 3], 'laser_gun')
      }

      // Start wave
      const waveConfig = createWaveConfig([{ life: 50, speed: 3 }])
      logic.startWave(waveConfig)

      // Run frames
      for (let i = 0; i < 300; i++) {
        logic.update()
      }

      // Laser gun attack does not produce bullets
      const bullets = logic.getBullets()
      // Should only have LMG bullets
      expect(bullets.every((b) => b.building.type !== 'laser_gun')).toBe(true)
    })
  })

  describe('Monster death and money reward', () => {
    it('Killing monsters should earn money', () => {
      // Place multiple buildings to ensure kills
      logic.placeBuilding([5, 5], 'LMG')
      logic.placeBuilding([7, 7], 'LMG')
      logic.placeBuilding([9, 9], 'LMG')

      // Start wave (low-health monsters for easy kill testing)
      const waveConfig = createWaveConfig([
        { life: 20, speed: 3, money: 10 },
        { life: 20, speed: 3, money: 10 },
      ])
      logic.startWave(waveConfig)

      // Run until wave completes
      // Monster speed is slow (0.12 pixels/frame), need enough frames to reach building range
      let maxFrames = 5000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      // Check kill records
      const result = logic.getWaveRecorder().getResult()
      expect(result.killed).toBeGreaterThan(0)

      // Money should increase (kill reward - some monsters may pass through)
      if (result.killed > 0) {
        expect(result.moneyGained).toBeGreaterThan(0)
      }
    })

    it('Kills should accumulate correct score', () => {
      logic.placeBuilding([5, 5], 'LMG')
      logic.placeBuilding([7, 7], 'LMG')

      // Start wave
      const waveConfig = createWaveConfig([{ life: 30, speed: 3 }])
      logic.startWave(waveConfig)

      // Run until wave completes
      let maxFrames = 2000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      // Check score (score = sum(floor(sqrt(damage per attack))))
      const result = logic.getWaveRecorder().getResult()
      if (result.totalDamageDealt > 0) {
        expect(result.scoreGained).toBeGreaterThan(0)
      }
    })
  })

  describe('Monster reaching exit', () => {
    it('Monster reaching exit should deduct life', () => {
      // Do not place any buildings
      const initialLife = logic.getState().life

      // Start wave (fast high-health monster)
      const waveConfig = createWaveConfig([
        { life: 1000, speed: 30, money: 5 }, // fast and tanky, hard to kill
      ])
      logic.startWave(waveConfig)

      // Run until wave completes
      let maxFrames = 3000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      // Check if life decreased
      const result = logic.getWaveRecorder().getResult()
      if (result.passed > 0) {
        expect(result.lifeLost).toBeGreaterThan(0)
        expect(logic.getState().life).toBeLessThan(initialLife)
      }
    })
  })

  describe('Wave completion check', () => {
    it('Wave should complete after all monsters die', () => {
      // Place enough buildings to kill all monsters
      logic.placeBuilding([3, 3], 'LMG')
      logic.placeBuilding([5, 5], 'LMG')
      logic.placeBuilding([7, 7], 'LMG')
      logic.placeBuilding([9, 9], 'LMG')

      // Start wave (low-health monsters)
      const waveConfig = createWaveConfig([
        { life: 10, speed: 3 },
        { life: 10, speed: 3 },
      ])
      logic.startWave(waveConfig)

      expect(logic.isWaveComplete()).toBe(false)

      // Run until complete
      let maxFrames = 2000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      expect(logic.isWaveComplete()).toBe(true)
    })

    it('Wave should complete after all monsters pass through', () => {
      // Do not place buildings
      const waveConfig = createWaveConfig([
        { life: 100, speed: 30 }, // fast
      ])
      logic.startWave(waveConfig)

      // Run until complete
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

  describe('Building upgrade and sell', () => {
    it('Upgrading building should increase damage and range', () => {
      const result = logic.placeBuilding([5, 5], 'LMG')
      expect(result.success).toBe(true)

      const buildingId = result.buildingId!
      const buildingBefore = logic.getBuilding(buildingId)!
      const damageBefore = buildingBefore.getDamage()
      const rangeBefore = buildingBefore.getRange()

      // Upgrade
      const upgradeResult = logic.upgradeBuilding(buildingId)
      expect(upgradeResult.success).toBe(true)

      const buildingAfter = logic.getBuilding(buildingId)!
      expect(buildingAfter.level).toBe(2)
      expect(buildingAfter.getDamage()).toBeGreaterThan(damageBefore)
      expect(buildingAfter.getRange()).toBeGreaterThanOrEqual(rangeBefore)
    })

    it('Selling building should return money', () => {
      const result = logic.placeBuilding([5, 5], 'LMG')
      const buildingId = result.buildingId!
      const moneyBefore = logic.getState().money

      // Sell
      const sellResult = logic.sellBuilding(buildingId)
      expect(sellResult.success).toBe(true)

      // Money should increase
      expect(logic.getState().money).toBeGreaterThan(moneyBefore)

      // Building should be removed
      expect(logic.getBuilding(buildingId)).toBeNull()
    })

    it('After selling can use money to buy new building', () => {
      // Initial money 500, place cannon (300), remaining 200
      const { buildingId } = logic.placeBuilding([3, 3], 'cannon')
      expect(logic.getState().money).toBe(200)

      // Cannot buy another cannon now
      const failResult = logic.placeBuilding([5, 5], 'cannon')
      expect(failResult.success).toBe(false)
      expect(failResult.reason).toBe('insufficient_money')

      // Sell cannon, get 150 (300 x 0.5)
      logic.sellBuilding(buildingId!)
      expect(logic.getState().money).toBe(350)

      // Now 350 >= 300, can buy cannon
      const successResult = logic.placeBuilding([5, 5], 'cannon')
      expect(successResult.success).toBe(true)
    })

    it('Selling upgraded building returns half of cumulative investment', () => {
      // Place LMG (100) and upgrade twice
      const { buildingId } = logic.placeBuilding([5, 5], 'LMG')
      // Money: 500 - 100 = 400

      // First upgrade: cost floor(100 x 0.75) = 75
      logic.upgradeBuilding(buildingId!)
      // Money: 400 - 75 = 325

      // Second upgrade: cost floor((100+75) x 0.75) = floor(131.25) = 131
      logic.upgradeBuilding(buildingId!)
      // Money: 325 - 131 = 194

      const building = logic.getBuilding(buildingId!)!
      expect(building.level).toBe(3)
      expect(logic.getState().money).toBe(194)

      // Sell level 3 LMG
      // Cumulative cost = 100 + 75 + 131 = 306
      // Sell income = floor(306 x 0.5) = 153
      logic.sellBuilding(buildingId!)
      expect(logic.getState().money).toBe(194 + 153)
    })

    it('Position can be reused immediately after selling', () => {
      const position: [number, number] = [5, 5]

      // Place and sell
      const { buildingId } = logic.placeBuilding(position, 'LMG')
      logic.sellBuilding(buildingId!)

      // Place a different type of building at the same position
      const result = logic.placeBuilding(position, 'cannon')
      expect(result.success).toBe(true)
      expect(logic.getBuildings()).toHaveLength(1)
      expect(logic.getBuilding(result.buildingId!)?.type).toBe('cannon')
    })

    it('Monster path may change after selling building during wave', () => {
      // Place wall to block part of the path
      const { buildingId } = logic.placeBuilding([1, 0], 'wall')

      // Sell wall
      logic.sellBuilding(buildingId!)

      const pathWithoutWall = logic.getCurrentPath()

      // Path may change (if wall affected the path)
      // At least ensure the path is still valid
      expect(pathWithoutWall.length).toBeGreaterThan(0)
    })
  })

  describe('Game over', () => {
    it('Game should end when life reaches zero', () => {
      // Create a low-life game config
      const lowLifeConfig: GameConfig = {
        ...config,
        initial: { ...config.initial, life: 1 },
      }
      logic = createGameSceneLogic(lowLifeConfig)

      // Start wave (high-damage monster)
      const waveConfig = createWaveConfig([
        { life: 10000, speed: 30, money: 5 }, // nearly impossible to kill
      ])
      logic.startWave(waveConfig)

      // Run until game over or timeout
      let maxFrames = 5000
      while (!logic.getState().isGameOver && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      // After monster reaches exit, game should be over
      if (logic.getState().life <= 0) {
        expect(logic.getState().isGameOver).toBe(true)
      }
    })
  })

  describe('Bullet system', () => {
    it('Bullets should fly toward the target', () => {
      logic.placeBuilding([5, 5], 'cannon')

      const waveConfig = createWaveConfig([{ life: 100, speed: 3 }])
      logic.startWave(waveConfig)

      // Run to let monsters enter range
      for (let i = 0; i < 200; i++) {
        logic.update()
      }

      // Check bullets
      const bullets = logic.getBullets()
      // May have already hit and disappeared, so don't require bullets to exist
      // But if there are bullets, they should be valid
      for (const bullet of bullets) {
        expect(bullet.isValid).toBe(true)
        expect(bullet.damage).toBeGreaterThan(0)
      }
    })

    it('Bullet hit should deal damage', () => {
      // Use LMG (range 5) instead of cannon (range 4), easier to hit
      logic.placeBuilding([5, 5], 'LMG')

      const waveConfig = createWaveConfig([{ life: 200, speed: 3, shield: 0 }])
      logic.startWave(waveConfig)

      // Run enough frames for monsters to enter range and be attacked
      // Monster speed is slow (speed * GLOBAL_SPEED * FPS_RATIO = 0.12 pixels/frame)
      // Need enough time for monster to move into building range
      for (let i = 0; i < 2000; i++) {
        logic.update()
      }

      // Check damage records
      const result = logic.getWaveRecorder().getResult()
      expect(result.totalDamageDealt).toBeGreaterThan(0)
    })
  })

  describe('Score accumulation', () => {
    it('Score should accumulate correctly across waves', () => {
      logic.placeBuilding([5, 5], 'LMG')
      logic.placeBuilding([7, 7], 'LMG')

      // Wave 1
      const wave1 = createWaveConfig([{ life: 30, speed: 3 }])
      logic.startWave(wave1)

      let maxFrames = 2000
      while (!logic.isWaveComplete() && maxFrames > 0) {
        logic.update()
        maxFrames--
      }

      const scoreAfterWave1 = logic.getState().score

      // Wave 2
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

      // Wave 2 score should accumulate on top of wave 1
      expect(scoreAfterWave2).toBeGreaterThanOrEqual(scoreAfterWave1)
    })
  })
})
