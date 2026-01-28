/**
 * GameSceneLogic unit tests
 * Tests core game logic, decoupled from Phaser rendering
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
  // Initialization tests
  // ============================================================================

  describe('initialization', () => {
    it('game state is correct after initialization', () => {
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

    it('no monsters or buildings after initialization', () => {
      expect(logic.getMonsters()).toHaveLength(0)
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('path exists after initialization', () => {
      const path = logic.getCurrentPath()
      expect(path.length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // Wave management tests
  // ============================================================================

  describe('wave management', () => {
    it('state is correct after starting a wave', () => {
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

    it('monsters are spawned during the wave', () => {
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      }

      logic.startWave(waveConfig)

      // First frame should spawn the first monster
      logic.update()
      expect(logic.getMonsters().length).toBeGreaterThanOrEqual(1)
    })

    it('wave completes quickly with high-speed monsters', () => {
      // Use very fast monsters for testing
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 }],
      }

      logic.startWave(waveConfig)

      // Run a limited number of frames
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
  // Building placement tests
  // ============================================================================

  describe('building placement', () => {
    it('building placement succeeds at a valid position', () => {
      const result = logic.placeBuilding([1, 1], 'cannon')

      expect(result.success).toBe(true)
      expect(result.buildingId).toBeDefined()
      expect(logic.getBuildings()).toHaveLength(1)
    })

    it('placing a building deducts money', () => {
      const moneyBefore = logic.getState().money
      logic.placeBuilding([1, 1], 'cannon')
      const moneyAfter = logic.getState().money

      expect(moneyAfter).toBe(moneyBefore - MOCK_GAME_CONFIG.buildings.cannon.cost)
    })

    it('cannot place a building with insufficient money', () => {
      // Use an expensive building to quickly drain money
      logic.placeBuilding([2, 2], 'laser_gun') // 2000
      // Not enough money for another laser_gun

      const result = logic.placeBuilding([3, 3], 'laser_gun')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('insufficient_money')
    })

    it('cannot place a building at the entrance', () => {
      const entrance = MOCK_GAME_CONFIG.map.entrance
      const result = logic.placeBuilding(entrance, 'cannon')

      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_position')
    })

    it('cannot place a building at the exit', () => {
      const exit = MOCK_GAME_CONFIG.map.exit
      const result = logic.placeBuilding(exit, 'cannon')

      expect(result.success).toBe(false)
      expect(result.reason).toBe('invalid_position')
    })

    it('cannot place a building that would block the path', () => {
      // Place buildings until near-blocking
      logic.placeBuilding([1, 0], 'wall')

      // Try to block the entrance
      const result = logic.placeBuilding([0, 1], 'wall')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('would_block_path')
    })

    it('cannot place a building that would block spawned monsters', () => {
      // 16x16 map, entrance(0,0), exit(15,15)
      // Strategy: use high-speed monsters to move them away from the entrance, then test blocking

      // Start a wave to spawn monsters (use high-speed monsters to ensure quick movement)
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [{ id: 'uuid-block-test', type: 0, life: 50000, speed: 30, shield: 0, money: 5 }],
      }
      logic.startWave(waveConfig)

      // Run enough frames to move the monster to the middle of the map
      for (let i = 0; i < 200; i++) {
        logic.update()
        // Check if a monster has left the entrance
        const monsters = logic.getMonsters()
        if (monsters.length > 0) {
          const [gx, gy] = monsters[0].getGridPosition()
          // Stop when the monster reaches (3,3) or further
          if (gx >= 3 || gy >= 3) break
        }
      }

      // Confirm monsters have spawned and moved
      const monsters = logic.getMonsters()
      expect(monsters.length).toBeGreaterThan(0)

      // Get the monster's current grid position
      const monster = monsters[0]
      const monsterGridPos = monster.getGridPosition()
      const [gx, gy] = monsterGridPos

      // Monster should have left the entrance area
      // If the monster is still at the entrance, this test scenario is not applicable
      if (gx === 0 && gy === 0) {
        // Monster is still at the entrance, cannot test would_block_monsters scenario
        // Because at the entrance, the monster path equals the entrance-to-exit path
        return
      }

      // Test canPlaceBuilding function - it should check monster blocking
      // Place walls around the monster, leaving one exit
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]]
      const wallPositions: Position[] = []

      for (const [dx, dy] of directions) {
        const wx = gx + dx
        const wy = gy + dy
        if (wx < 0 || wx > 15 || wy < 0 || wy > 15) continue
        if (wx === 0 && wy === 0) continue
        if (wx === 15 && wy === 15) continue

        // Use canPlaceBuilding to check
        if (logic.canPlaceBuilding([wx, wy])) {
          wallPositions.push([wx, wy])
        }
      }

      // Place all walls except the last one
      if (wallPositions.length > 1) {
        const lastWall = wallPositions.pop()!
        for (const pos of wallPositions) {
          const result = logic.placeBuilding(pos, 'wall')
          // Each placement should either succeed or fail due to blocking
          if (!result.success) {
            // If placement fails, it means it would block (path or monsters)
            expect(['would_block_path', 'would_block_monsters']).toContain(result.reason)
            return // Test objective achieved
          }
        }

        // Try to place the last wall
        const result = logic.placeBuilding(lastWall, 'wall')
        expect(result.success).toBe(false)
        expect(['would_block_path', 'would_block_monsters']).toContain(result.reason)
      }
    })
  })

  // ============================================================================
  // Building upgrade tests
  // ============================================================================

  describe('building upgrade', () => {
    it('upgrading a building succeeds', () => {
      // LMG cost=100, upgrade cost=floor(100*0.75)=75, remaining 400 is enough
      const { buildingId } = logic.placeBuilding([1, 1], 'LMG')
      const result = logic.upgradeBuilding(buildingId!)

      expect(result.success).toBe(true)

      const building = logic.getBuilding(buildingId!)
      expect(building?.level).toBe(2)
    })

    it('upgrading a building deducts money', () => {
      const { buildingId } = logic.placeBuilding([1, 1], 'LMG')
      const moneyBefore = logic.getState().money

      logic.upgradeBuilding(buildingId!)

      const moneyAfter = logic.getState().money
      expect(moneyAfter).toBeLessThan(moneyBefore)
    })

    it('cannot upgrade with insufficient money', () => {
      const { buildingId } = logic.placeBuilding([1, 1], 'cannon')

      // Drain all money: initial 500, cannon costs 300, remaining 200
      // Place walls (cost=5) until not enough for upgrade (upgrade cost ~225)
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
  // Building sell tests
  // ============================================================================

  describe('building sell', () => {
    it('selling a building returns money', () => {
      const { buildingId } = logic.placeBuilding([1, 1], 'cannon')
      const moneyBefore = logic.getState().money

      const result = logic.sellBuilding(buildingId!)

      expect(result.success).toBe(true)
      expect(logic.getState().money).toBeGreaterThan(moneyBefore)
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('selling a non-existent building fails', () => {
      const result = logic.sellBuilding('non-existent')

      expect(result.success).toBe(false)
      expect(result.reason).toBe('building_not_found')
    })

    it('selling a level 1 building returns the correct amount (build cost x 0.5)', () => {
      // Initial money 500, cannon costs 300, remaining 200
      const { buildingId } = logic.placeBuilding([1, 1], 'cannon')
      expect(logic.getState().money).toBe(200)

      logic.sellBuilding(buildingId!)

      // Sell income = floor(300 x 0.5) = 150
      // Final money = 200 + 150 = 350
      expect(logic.getState().money).toBe(350)
    })

    it('selling an upgraded building returns more money', () => {
      // Use LMG (cost=100) for easier calculation
      // Initial 500, build -100 = 400
      const { buildingId } = logic.placeBuilding([1, 1], 'LMG')
      expect(logic.getState().money).toBe(400)

      // Upgrade to level 2: upgrade cost = floor(100 x 0.75) = 75
      // Money after upgrade = 400 - 75 = 325
      logic.upgradeBuilding(buildingId!)
      expect(logic.getState().money).toBe(325)
      expect(logic.getBuilding(buildingId!)?.level).toBe(2)

      // Sell level 2 LMG: cumulative cost = 100 + 75 = 175
      // Sell income = floor(175 x 0.5) = 87
      logic.sellBuilding(buildingId!)
      expect(logic.getState().money).toBe(325 + 87)
    })

    it('sell action is recorded in WaveRecorder', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      const { buildingId } = logic.placeBuilding([1, 1], 'cannon')

      // Update a few frames to advance the frame counter
      logic.update()
      logic.update()

      logic.sellBuilding(buildingId!)

      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()

      // Should have BUILD and SELL actions
      expect(actions.length).toBe(2)
      expect(actions[0].type).toBe('BUILD')
      expect(actions[1].type).toBe('SELL')
      expect(actions[1].buildingId).toBe(buildingId)
      expect(actions[1].frame).toBeGreaterThan(0)
    })

    it('cell can be reused for building placement after selling', () => {
      const position: [number, number] = [1, 1]
      const { buildingId } = logic.placeBuilding(position, 'cannon')

      // Sell the building
      logic.sellBuilding(buildingId!)

      // Same position should allow building placement again
      const result = logic.placeBuilding(position, 'LMG')
      expect(result.success).toBe(true)
      expect(logic.getBuildings()).toHaveLength(1)
    })

    it('building is removed from the list after selling', () => {
      const { buildingId: id1 } = logic.placeBuilding([1, 1], 'cannon')
      const { buildingId: id2 } = logic.placeBuilding([2, 2], 'LMG')

      expect(logic.getBuildings()).toHaveLength(2)

      // Sell the first building
      logic.sellBuilding(id1!)

      expect(logic.getBuildings()).toHaveLength(1)
      expect(logic.getBuilding(id1!)).toBeNull()
      expect(logic.getBuilding(id2!)).not.toBeNull()
    })

    it('selling a wall returns at least 1 gold', () => {
      // Wall build cost 5, sell = floor(5 x 0.5) = 2
      const { buildingId } = logic.placeBuilding([1, 1], 'wall')
      const moneyBefore = logic.getState().money

      logic.sellBuilding(buildingId!)

      // Sell income is at least 1 gold (actually 2)
      expect(logic.getState().money).toBeGreaterThanOrEqual(moneyBefore + 1)
    })
  })

  // ============================================================================
  // Combat system tests
  // ============================================================================

  describe('combat system', () => {
    it('buildings attack monsters', () => {
      // Place a building
      logic.placeBuilding([8, 8], 'cannon')

      // Start a wave
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      // Run several frames for the monster to move and be attacked
      for (let i = 0; i < 500; i++) {
        logic.update()
      }

      // Check if there are attack records
      const recorder = logic.getWaveRecorder()
      expect(recorder.getAttacks()).toBeDefined()
      // Depends on whether the monster enters range
    })

    it('killing a monster awards money', () => {
      // Place a high-damage building
      logic.placeBuilding([3, 3], 'laser_gun')

      const moneyBefore = logic.getState().money

      // Start a wave
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // Run until the monster is killed or passes through
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // If the monster was killed, money should increase
      const recorder = logic.getWaveRecorder()
      const result = recorder.getResult()
      if (result.killed > 0) {
        expect(logic.getState().money).toBeGreaterThan(moneyBefore)
      }
    })

    it('monster reaching the exit deducts life', () => {
      const lifeBefore = logic.getState().life

      // Don't place buildings, let the monster pass through
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 30, shield: 0, money: 5 }],
      })

      // Fast monster should reach the exit quickly
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const lifeAfter = logic.getState().life
      expect(lifeAfter).toBeLessThan(lifeBefore)
    })
  })

  // ============================================================================
  // Game over tests
  // ============================================================================

  describe('game over', () => {
    it('game ends when life reaches 0', () => {
      // Use low life config
      const lowLifeConfig = {
        ...MOCK_GAME_CONFIG,
        initial: { ...MOCK_GAME_CONFIG.initial, life: 1 },
      }
      const lowLifeLogic = createGameSceneLogic(lowLifeConfig)

      // Let a high-damage monster pass through
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

    it('game stops updating after setGameOver', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      // Run a few frames
      logic.update()
      logic.update()
      const frameBefore = logic.getState().frame

      // Call setGameOver
      logic.setGameOver()

      // Confirm state is set
      expect(logic.getState().isGameOver).toBe(true)
      expect(logic.getState().isPlaying).toBe(false)

      // Continue calling update, frame count should not increase
      logic.update()
      logic.update()
      logic.update()

      expect(logic.getState().frame).toBe(frameBefore)
    })

    it('monsters stop moving after setGameOver', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      // Spawn monsters and run a few frames
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      const monsters = logic.getMonsters()
      expect(monsters.length).toBeGreaterThan(0)

      const positionBefore = monsters[0].getGridPosition()

      // Call setGameOver
      logic.setGameOver()

      // Continue calling update
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // Monster position should not change
      const positionAfter = monsters[0].getGridPosition()
      expect(positionAfter).toEqual(positionBefore)
    })

    it('buildings stop attacking after setGameOver', () => {
      // Place a building
      logic.placeBuilding([3, 3], 'laser_gun')

      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 500, speed: 1, shield: 0, money: 5 }],
      })

      // Run to let the monster enter range and get attacked
      for (let i = 0; i < 200; i++) {
        logic.update()
      }

      const attacksBefore = logic.getWaveRecorder().getAttacks().length

      // Call setGameOver
      logic.setGameOver()

      // Continue calling update
      for (let i = 0; i < 200; i++) {
        logic.update()
      }

      // Attack count should not increase
      const attacksAfter = logic.getWaveRecorder().getAttacks().length
      expect(attacksAfter).toBe(attacksBefore)
    })

    it('cannot place buildings after setGameOver', () => {
      const moneyBefore = logic.getState().money

      logic.setGameOver()

      const result = logic.placeBuilding([5, 5], 'wall')

      expect(result.success).toBe(false)
      expect(result.reason).toBe('game_over')
      expect(logic.getState().money).toBe(moneyBefore)
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('cannot upgrade buildings after setGameOver', () => {
      // Place a building first
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

    it('cannot sell buildings after setGameOver', () => {
      // Place a building first
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

    it('can place buildings after reset following game over', () => {
      logic.setGameOver()

      // Operations should fail after game over
      const failResult = logic.placeBuilding([5, 5], 'wall')
      expect(failResult.success).toBe(false)
      expect(failResult.reason).toBe('game_over')

      // Operations should succeed after reset
      logic.reset()

      const successResult = logic.placeBuilding([5, 5], 'wall')
      expect(successResult.success).toBe(true)
      expect(logic.getBuildings()).toHaveLength(1)
    })

    it('cannot place buildings after game over caused by monster passing through', () => {
      const lowLifeConfig = {
        ...MOCK_GAME_CONFIG,
        initial: { ...MOCK_GAME_CONFIG.initial, life: 1 },
      }
      const lowLifeLogic = createGameSceneLogic(lowLifeConfig)
      lowLifeLogic.prepareNextWaveRecorder(1)

      // Use high-speed monster to quickly pass through
      lowLifeLogic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 }],
      })

      // Run until game over
      for (let i = 0; i < 5000; i++) {
        lowLifeLogic.update()
        if (lowLifeLogic.getState().isGameOver) break
      }

      expect(lowLifeLogic.getState().isGameOver).toBe(true)

      // Attempting to place a building after game over should fail
      const result = lowLifeLogic.placeBuilding([5, 5], 'wall')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('game_over')
    })

    it('life drops from 1 to 0 causing game over and preventing operations', () => {
      const lowLifeConfig = {
        ...MOCK_GAME_CONFIG,
        initial: { ...MOCK_GAME_CONFIG.initial, life: 1 },
      }
      const lowLifeLogic = createGameSceneLogic(lowLifeConfig)
      lowLifeLogic.prepareNextWaveRecorder(1)

      // Use a normal monster with damage 1 (type: 0, damage: 1)
      lowLifeLogic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 }],
      })

      // Run until game over
      for (let i = 0; i < 5000; i++) {
        lowLifeLogic.update()
        if (lowLifeLogic.getState().isGameOver) break
      }

      // Verify life is exactly 0
      expect(lowLifeLogic.getState().life).toBe(0)
      expect(lowLifeLogic.getState().isGameOver).toBe(true)

      // Operations after game over should fail
      const result = lowLifeLogic.placeBuilding([5, 5], 'wall')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('game_over')
    })
  })

  // ============================================================================
  // Pause/resume tests
  // ============================================================================

  describe('pause/resume', () => {
    it('game state does not update while paused', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      logic.update() // spawn monster
      const frameBefore = logic.getState().frame

      logic.togglePause()
      expect(logic.getState().isPaused).toBe(true)

      logic.update()
      logic.update()
      logic.update()

      expect(logic.getState().frame).toBe(frameBefore)
    })

    it('updates resume after unpausing', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      logic.update()
      logic.togglePause()
      logic.togglePause() // resume

      const frameBefore = logic.getState().frame
      logic.update()

      expect(logic.getState().frame).toBe(frameBefore + 1)
    })

    it('wave completion state is preserved while paused (for UI layer checks)', () => {
      // This test verifies that isWaveComplete() state remains unchanged while paused
      // The UI layer (Game.ts) should skip wave interval processing when paused
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 }],
      })

      // Run until wave complete
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      expect(logic.isWaveComplete()).toBe(true)
      const waveBefore = logic.getState().wave

      // Wave number should not change after pausing
      logic.togglePause()
      expect(logic.getState().isPaused).toBe(true)

      // Multiple update calls
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // Wave number should remain unchanged (because paused does not update)
      expect(logic.getState().wave).toBe(waveBefore)
      expect(logic.isWaveComplete()).toBe(true)
    })
  })

  // ============================================================================
  // Wave recorder tests
  // ============================================================================

  describe('wave recorder', () => {
    it('records building actions', () => {
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

    it('records monster spawns (spawned field)', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
          { id: 'uuid-2', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
          { id: 'uuid-3', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
        ],
      })

      // First frame spawns the first monster
      logic.update()
      expect(logic.getWaveRecorder().getResult().spawned).toBe(1)
    })

    it('spawned count increments with multiple monster spawns', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
          { id: 'uuid-2', type: 0, life: 50, speed: 3, shield: 0, money: 5 },
        ],
      })

      // Run enough frames for both monsters to spawn
      // Default monster spawn interval is 30 frames
      for (let i = 0; i < 60; i++) {
        logic.update()
      }

      const recorder = logic.getWaveRecorder()
      expect(recorder.getResult().spawned).toBe(2)
    })

    it('spawned count consistency with monster count', () => {
      const waveConfig: WaveConfig = {
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 50, speed: 100, shield: 0, money: 5 },
        ],
      }

      logic.startWave(waveConfig)

      // Run until the monster passes through the exit
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const result = logic.getWaveRecorder().getResult()
      // Verify formula: killed + passed + remaining == spawned
      const remaining = result.remaining ?? 0
      expect(result.killed + result.passed + remaining).toBe(result.spawned)
    })
  })

  // ============================================================================
  // Game reset tests
  // ============================================================================

  describe('reset', () => {
    it('game state returns to initial values after reset', () => {
      // Place buildings and run some frames
      logic.placeBuilding([1, 1], 'cannon')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // Reset
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

    it('all monsters are cleared after reset', () => {
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

    it('all buildings are cleared after reset', () => {
      logic.placeBuilding([1, 1], 'cannon')
      logic.placeBuilding([2, 2], 'LMG')
      expect(logic.getBuildings()).toHaveLength(2)

      logic.reset()
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('all bullets are cleared after reset', () => {
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

    it('can start a new wave after reset', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 30, shield: 0, money: 5 }],
      })

      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      logic.reset()

      // Should be able to start a new wave
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-new', type: 0, life: 50, speed: 3, shield: 0, money: 5 }],
      })

      expect(logic.getState().wave).toBe(1)
      logic.update()
      expect(logic.getMonsters().length).toBeGreaterThan(0)
    })

    it('can place buildings again after reset', () => {
      logic.placeBuilding([1, 1], 'cannon')
      logic.reset()

      // Should be able to place a building at the same position
      const result = logic.placeBuilding([1, 1], 'LMG')
      expect(result.success).toBe(true)
    })

    it('can continue playing after reset following game over', () => {
      // Set low life
      const lowLifeConfig = {
        ...MOCK_GAME_CONFIG,
        initial: { ...MOCK_GAME_CONFIG.initial, life: 1 },
      }
      const lowLifeLogic = createGameSceneLogic(lowLifeConfig)

      // Let monster pass through to cause game over
      lowLifeLogic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 5, life: 50, speed: 30, shield: 0, money: 5 }],
      })

      for (let i = 0; i < 5000; i++) {
        lowLifeLogic.update()
        if (lowLifeLogic.getState().isGameOver) break
      }

      expect(lowLifeLogic.getState().isGameOver).toBe(true)

      // Reset
      lowLifeLogic.reset()

      // Should be able to continue playing
      expect(lowLifeLogic.getState().isGameOver).toBe(false)
      expect(lowLifeLogic.getState().isPlaying).toBe(true)
      expect(lowLifeLogic.getState().life).toBe(1)
    })

    it('pause state is cleared after reset', () => {
      logic.togglePause()
      expect(logic.getState().isPaused).toBe(true)

      logic.reset()
      expect(logic.getState().isPaused).toBe(false)
    })
  })

  // ============================================================================
  // Score accumulation tests
  // ============================================================================

  describe('score accumulation', () => {
    it('score accumulates correctly across waves', () => {
      // Place a high-damage building
      logic.placeBuilding([3, 3], 'laser_gun')

      // Wave 1
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

      // Ensure wave 1 has score
      if (wave1Score > 0) {
        expect(scoreAfterWave1).toBe(wave1Score)

        // Wave 2
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

        // Cumulative score should be the sum of both waves
        expect(scoreAfterWave2).toBe(wave1Score + wave2Score)
        expect(scoreAfterWave2).toBeGreaterThanOrEqual(scoreAfterWave1)
      }
    })

    it('score resets to zero after game reset', () => {
      // Place a building and play one wave
      logic.placeBuilding([3, 3], 'laser_gun')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Reset the game
      logic.reset()

      // Score should be zero
      expect(logic.getState().score).toBe(0)
    })

    it('cumulative score is correct over 3+ waves (using prepareNextWaveRecorder)', () => {
      // Place a building
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')

      const waveScores: number[] = []
      let expectedTotal = 0

      // Run 4 waves, verify cumulative score
      for (let wave = 1; wave <= 4; wave++) {
        logic.startWave({
          waveNumber: wave,
          monsters: [
            { id: `uuid-${wave}-1`, type: 0, life: 30, speed: 0.5, shield: 0, money: 20 },
          ],
        })

        // Run until wave ends
        for (let i = 0; i < 3000; i++) {
          logic.update()
          if (logic.isWaveComplete()) break
        }

        // Record this wave's score
        const recorder = logic.getWaveRecorder()
        const waveScore = recorder.getResult().scoreGained
        waveScores.push(waveScore)
        expectedTotal += waveScore

        // Prepare the next wave if not the last
        if (wave < 4) {
          logic.prepareNextWaveRecorder(wave + 1)
        }

        // Verify current cumulative score
        const currentScore = logic.getState().score
        expect(currentScore).toBe(expectedTotal)
      }

      // Final verification: cumulative score = sum of all wave scores
      const finalScore = logic.getState().score
      const sumOfWaveScores = waveScores.reduce((a, b) => a + b, 0)
      expect(finalScore).toBe(sumOfWaveScores)

      // Ensure there were actually scores in multiple waves (test validity check)
      expect(waveScores.filter(s => s > 0).length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('prepareNextWaveRecorder - building actions during wave interval', () => {
    it('prepareNextWaveRecorder must be called before wave 1 to ensure correct waveNumber', () => {
      // Simulate the call order in Game.ts before the first wave
      logic.prepareNextWaveRecorder(1)
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // Place a building (after startWave)
      logic.placeBuilding([3, 3], 'cannon')

      // Run until wave ends
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Verify recorder's waveNumber is 1 (not the initial 0)
      const recorder = logic.getWaveRecorder()
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(1)

      // Verify actions are correctly recorded
      expect(recorder.getActions()).toHaveLength(1)
      expect(recorder.getActions()[0].type).toBe('BUILD')
    })

    it('prepareNextWaveRecorder creates a new recorder and saves cumulative score', () => {
      // Place a building
      logic.placeBuilding([3, 3], 'laser_gun')

      // Wave 1
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // Run until wave ends
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const wave1Score = logic.getWaveRecorder().getResult().scoreGained

      // Call prepareNextWaveRecorder (simulating a successful submission callback)
      logic.prepareNextWaveRecorder(2)

      // New recorder should be for wave 2
      const recorder = logic.getWaveRecorder()
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)

      // New recorder's action lists should be empty
      expect(recorder.getActions()).toHaveLength(0)
      expect(recorder.getAttacks()).toHaveLength(0)

      // State score should include wave 1's score
      expect(logic.getState().score).toBe(wave1Score)
    })

    it('building actions during interval are recorded to the new recorder', () => {
      // Wave 1
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 10 }],
      })

      // Run until wave ends (monster quickly passes through)
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Simulate preparing the next wave recorder after successful submission
      logic.prepareNextWaveRecorder(2)

      // Place buildings during the "interval"
      logic.placeBuilding([3, 3], 'cannon')
      logic.placeBuilding([5, 5], 'LMG')

      // These actions should be recorded to wave 2's recorder
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      expect(actions).toHaveLength(2)
      expect(actions[0].type).toBe('BUILD')
      expect(actions[1].type).toBe('BUILD')

      // Verify waveNumber is 2
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)
    })

    it('startWave no longer recreates the recorder (prepareNextWaveRecorder handles that)', () => {
      // Wave 1
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 10 }],
      })

      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Prepare next wave recorder
      logic.prepareNextWaveRecorder(2)

      // Place a building during the interval
      logic.placeBuilding([3, 3], 'cannon')

      // Get recorder reference
      const recorderBefore = logic.getWaveRecorder()
      const actionsBefore = recorderBefore.getActions().length

      // Call startWave
      logic.startWave({
        waveNumber: 2,
        monsters: [{ id: 'uuid-2', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // Recorder should be the same instance, action records preserved
      const recorderAfter = logic.getWaveRecorder()
      expect(recorderAfter.getActions().length).toBe(actionsBefore)
    })

    it('upgrade and sell actions are also recorded to the new recorder', () => {
      // Place a building first (wall is cheapest, leaving more money for upgrades)
      logic.placeBuilding([3, 3], 'wall')

      // Wave 1 (monster gives more money for upgrade)
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 100 }],
      })

      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Prepare next wave recorder
      logic.prepareNextWaveRecorder(2)

      // Get building ID
      const buildings = logic.getBuildings()
      const buildingId = buildings[0].id

      // Upgrade during interval (verify action succeeds)
      const upgradeResult = logic.upgradeBuilding(buildingId)
      expect(upgradeResult.success).toBe(true)

      // Sell during interval (verify action succeeds)
      const sellResult = logic.sellBuilding(buildingId)
      expect(sellResult.success).toBe(true)

      // Verify actions are recorded to wave 2
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      expect(actions.some(a => a.type === 'UPGRADE')).toBe(true)
      expect(actions.some(a => a.type === 'SELL')).toBe(true)

      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)
    })

    it('buildings placed during interval participate in combat during the next wave with attack records attributed correctly', () => {
      // Simplified test: start from placing a building during interval
      // Scenario: after API returns wave 1 config, player places first weapon building

      // Prepare wave 1 recorder
      logic.prepareNextWaveRecorder(1)

      // Place a building during the "interval" (before wave 1 starts)
      const placeResult = logic.placeBuilding([3, 3], 'LMG')
      expect(placeResult.success).toBe(true)

      // Get the placed building ID
      const placedBuildingId = placeResult.buildingId!

      // Verify BUILD action is recorded in the recorder
      const recorderBeforeCombat = logic.getWaveRecorder()
      expect(recorderBeforeCombat.getActions()).toHaveLength(1)
      expect(recorderBeforeCombat.getActions()[0].type).toBe('BUILD')

      // Wave 1 monster UUID
      const wave1MonsterId = 'uuid-monster-1'

      // Start wave 1 (monsters enter, buildings start attacking)
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: wave1MonsterId, type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // Run combat until monster is killed or passes through
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Get the final recorder
      const recorder = logic.getWaveRecorder()
      const request = recorder.toWaveRequest('test-session', [])

      // Verify waveNumber is correct
      expect(request.waveNumber).toBe(1)

      // Verify BUILD action exists
      expect(request.actions.some(a => a.type === 'BUILD')).toBe(true)

      // Verify attack records exist
      expect(request.attacks.length).toBeGreaterThan(0)

      // Verify attack event details
      const attacks = request.attacks
      for (const attack of attacks) {
        // Verify attacks come from the placed building
        expect(attack.buildingId).toBe(placedBuildingId)

        // Verify attack target is wave 1's monster
        expect(attack.monsterId).toBe(wave1MonsterId)

        // Verify damage is positive
        expect(attack.damage).toBeGreaterThan(0)

        // Verify frame is positive
        expect(attack.frame).toBeGreaterThan(0)
      }

      // Verify result data exists
      expect(request.result).toBeDefined()
      expect(request.result.spawned).toBe(1)
    })

    it('cross-wave scenario: building placed during interval after wave 1 has attack records attributed to wave 2', () => {
      // Complete cross-wave scenario test

      // Wave 1: place first building, kill monster
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

      // Frame number at wave 1 end
      const wave1EndFrame = logic.getState().frame

      // Prepare wave 2 (simulating API response)
      logic.prepareNextWaveRecorder(2)

      // Place second building during interval
      const placeResult = logic.placeBuilding([5, 5], 'cannon')
      expect(placeResult.success).toBe(true)
      const wave2BuildingId = placeResult.buildingId!

      // Verify BUILD action is recorded to recorder 2
      const recorder2Actions = logic.getWaveRecorder().getActions()
      expect(recorder2Actions).toHaveLength(1)
      expect(recorder2Actions[0].type).toBe('BUILD')

      // Wave 2 monster
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

      // Verify waveNumber
      expect(request.waveNumber).toBe(2)

      // Verify attack records exist
      expect(request.attacks.length).toBeGreaterThan(0)

      // Filter attacks from the wave 2 new building
      const wave2BuildingAttacks = request.attacks.filter(a => a.buildingId === wave2BuildingId)

      // Verify new building's attack records
      if (wave2BuildingAttacks.length > 0) {
        for (const attack of wave2BuildingAttacks) {
          // Attack target is wave 2's monster
          expect(attack.monsterId).toBe(wave2MonsterId)
          // Attack frame is during wave 2
          expect(attack.frame).toBeGreaterThan(wave1EndFrame)
          // Damage is positive
          expect(attack.damage).toBeGreaterThan(0)
        }
      }

      // Verify all attacks target wave 2's monster
      for (const attack of request.attacks) {
        expect(attack.monsterId).toBe(wave2MonsterId)
      }
    })

    it('building upgraded during interval uses upgraded stats in the next wave combat', () => {
      // Wave 1: place level 1 building
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

      // Wave 1 ends, prepare wave 2
      logic.prepareNextWaveRecorder(2)

      // Upgrade building during interval
      const buildings = logic.getBuildings()
      const buildingId = buildings[0].id
      const levelBefore = buildings[0].level

      const upgradeResult = logic.upgradeBuilding(buildingId)
      expect(upgradeResult.success).toBe(true)

      const levelAfter = logic.getBuildings()[0].level
      expect(levelAfter).toBe(levelBefore + 1)

      // Verify UPGRADE action is recorded to recorder 2
      const recorder = logic.getWaveRecorder()
      expect(recorder.getActions().some(a => a.type === 'UPGRADE')).toBe(true)

      // Start wave 2
      logic.startWave({
        waveNumber: 2,
        monsters: [{ id: 'uuid-2', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // Run combat
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Verify attack records exist (upgraded building participates in combat)
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)
      expect(request.attacks.length).toBeGreaterThan(0)

      // Verify upgrade action and attack records are in the same request
      expect(request.actions.some(a => a.type === 'UPGRADE')).toBe(true)
    })

    it('placing a non-weapon building then a weapon building before wave 1 records both actions to wave 1', () => {
      // Edge case 4: simulate Game.ts call order
      // Key point: recorder should be prepared before placing the first building (regardless of type)

      // Correct call order:
      // 1. Prepare recorder before placing the first building
      logic.prepareNextWaveRecorder(1)

      // 2. Player places a wall (non-weapon building) first
      const wallResult = logic.placeBuilding([1, 1], 'wall')
      expect(wallResult.success).toBe(true)

      // 3. Player then places a cannon (weapon building)
      const cannonResult = logic.placeBuilding([3, 3], 'cannon')
      expect(cannonResult.success).toBe(true)

      // 4. Start wave after placing weapon
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // Verify both BUILD actions are recorded to wave 1's recorder
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()

      // Should have 2 BUILD actions
      const buildActions = actions.filter(a => a.type === 'BUILD')
      expect(buildActions).toHaveLength(2)

      // Verify waveNumber is 1
      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(1)

      // Verify both building types
      const buildTypes = buildActions.map(a => (a as { buildingType: string }).buildingType)
      expect(buildTypes).toContain('wall')
      expect(buildTypes).toContain('cannon')
    })

    it('placing multiple non-weapon buildings before wave 1 records all actions to wave 1', () => {
      // Extended scenario: player may place multiple walls before placing a weapon

      // Correct call order: prepare recorder before the first building placement
      logic.prepareNextWaveRecorder(1)

      // Place multiple walls (initial money 500, wall cost 20)
      logic.placeBuilding([1, 1], 'wall')
      logic.placeBuilding([2, 2], 'wall')
      logic.placeBuilding([4, 4], 'wall')

      // Then place a weapon (LMG cost 100)
      logic.placeBuilding([3, 3], 'LMG')

      // Start wave
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // Verify all BUILD actions are recorded to wave 1
      const recorder = logic.getWaveRecorder()
      const buildActions = recorder.getActions().filter(a => a.type === 'BUILD')

      expect(buildActions).toHaveLength(4)

      const request = recorder.toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(1)
    })
  })

  // ============================================================================
  // Frame number recording correctness tests (edge case 5)
  // ============================================================================

  describe('startFrame and frame recording', () => {
    it('prepareNextWaveRecorder before wave 1 uses frame=0 as startFrame', () => {
      // frame = 0 after game initialization
      expect(logic.getState().frame).toBe(0)

      // Prepare wave 1
      logic.prepareNextWaveRecorder(1)

      // Place a building (frame is still 0 because update hasn't been called)
      logic.placeBuilding([3, 3], 'cannon')

      // Verify action's recorded frame is 0
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      expect(actions).toHaveLength(1)
      expect(actions[0].frame).toBe(0)
    })

    it('actions during wave use the current absolute frame number', () => {
      logic.prepareNextWaveRecorder(1)
      // Use wall (cost 5) instead of cannon (cost 300) to have enough money for upgrade
      logic.placeBuilding([3, 3], 'wall')

      logic.startWave({
        waveNumber: 1,
        // Monster gives 300 gold, enough for wall upgrade (upgrade cost ~5 * 0.75 = 3)
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 300 }],
      })

      // Run 50 frames
      for (let i = 0; i < 50; i++) {
        logic.update()
      }

      const frameAfter50Updates = logic.getState().frame
      expect(frameAfter50Updates).toBe(50)

      // Upgrade building at frame=50
      const building = logic.getBuildings()[0]
      const upgradeResult = logic.upgradeBuilding(building.id)
      expect(upgradeResult.success).toBe(true)

      // Verify upgrade action's recorded frame is 50
      const recorder = logic.getWaveRecorder()
      const upgradeAction = recorder.getActions().find(a => a.type === 'UPGRADE')
      expect(upgradeAction).toBeDefined()
      expect(upgradeAction!.frame).toBe(50)
    })

    it('cross-wave scenario: wave 2 startFrame is the frame number at wave 1 end', () => {
      // Wave 1
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // Run until wave 1 ends
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const wave1EndFrame = logic.getState().frame

      // Prepare wave 2 (startFrame should be wave1EndFrame)
      logic.prepareNextWaveRecorder(2)

      // Place a building during interval (frame is still wave1EndFrame)
      logic.placeBuilding([5, 5], 'cannon')

      // Verify action's recorded frame is wave1EndFrame
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      expect(actions).toHaveLength(1)
      expect(actions[0].frame).toBe(wave1EndFrame)
    })

    it('waveDurationFrames is correctly calculated as endFrame - startFrame', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')

      // Record the frame number at wave start
      const startFrame = logic.getState().frame

      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // Run until wave ends
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const endFrame = logic.getState().frame

      // Verify waveDurationFrames
      const recorder = logic.getWaveRecorder()
      const result = recorder.getResult()
      expect(result.waveDurationFrames).toBe(endFrame - startFrame)
    })

    it('frame does not advance during interval (update skips non-combat state)', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 10, shield: 0, money: 10 }],
      })

      // Run until wave ends
      for (let i = 0; i < 1000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const frameAtWaveEnd = logic.getState().frame

      // Prepare wave 2 (simulating API response)
      logic.prepareNextWaveRecorder(2)

      // During interval, don't call startWave, just place buildings
      // (simulating player actions while waiting for the next wave)
      logic.placeBuilding([5, 5], 'cannon')

      // Frame should not advance during interval (because update is not called or update skips)
      // Note: in the actual game, Game.ts's update continues to run during interval
      // But GameSceneLogic.update will not advance frames because the wave is complete
      const frameAfterIntervalAction = logic.getState().frame
      expect(frameAfterIntervalAction).toBe(frameAtWaveEnd)
    })

    it('attack event frames are recorded correctly (absolute frame numbers)', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // Run until an attack occurs
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

      // Verify attack event frames are positive (absolute frame numbers)
      const attacks = logic.getWaveRecorder().getAttacks()
      for (const attack of attacks) {
        expect(attack.frame).toBeGreaterThan(0)
        expect(attack.frame).toBeLessThanOrEqual(logic.getState().frame)
      }
    })
  })

  // ============================================================================
  // waveNumber consistency tests (edge case 6)
  // ============================================================================

  describe('prepareNextWaveRecorder and startWave waveNumber consistency', () => {
    it('correct call order: prepareNextWaveRecorder(N) then startWave(N) results in consistent data', () => {
      // Prepare wave 2
      logic.prepareNextWaveRecorder(2)
      logic.placeBuilding([3, 3], 'LMG')

      // Start wave 2 (waveNumber consistent)
      logic.startWave({
        waveNumber: 2,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // Run until wave ends
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Verify state.wave and recorder.waveNumber are consistent
      expect(logic.getState().wave).toBe(2)
      const request = logic.getWaveRecorder().toWaveRequest('test-session', [])
      expect(request.waveNumber).toBe(2)
    })

    it('inconsistent call: prepareNextWaveRecorder(2) then startWave(3) causes recorder.waveNumber to differ from state.wave', () => {
      // This is a documented edge behavior test
      // Purpose: record current behavior so future changes can be detected

      // Prepare wave 2
      logic.prepareNextWaveRecorder(2)
      logic.placeBuilding([3, 3], 'LMG')

      // Incorrectly start wave 3 (waveNumber inconsistent)
      logic.startWave({
        waveNumber: 3,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // Run until wave ends
      for (let i = 0; i < 3000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Current behavior: state.wave is updated to 3, but recorder.waveNumber remains 2
      expect(logic.getState().wave).toBe(3)
      const request = logic.getWaveRecorder().toWaveRequest('test-session', [])
      // recorder's waveNumber is the value passed to prepareNextWaveRecorder
      expect(request.waveNumber).toBe(2)

      // Note: this is a programming error scenario, Game.ts should ensure consistency
      // This test documents current behavior, not the recommended usage
    })

    it('consecutive correct call sequence: wave 1 -> wave 2 -> wave 3 data is consistent', () => {
      // Wave 1
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

      // Wave 2
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

      // Wave 3
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

    it('Game.ts call pattern verification: first wave initializes correctly', () => {
      // Simulate the Game.ts call pattern for the first wave
      // 1. Prepare recorder before player places buildings
      // 2. Place buildings
      // 3. Start wave after placing weapon

      const waveNumber = 1

      // Prepare recorder (using the same waveNumber)
      logic.prepareNextWaveRecorder(waveNumber)

      // Place buildings
      logic.placeBuilding([3, 3], 'LMG')

      // Start wave (using the same waveNumber)
      logic.startWave({
        waveNumber: waveNumber,
        monsters: [{ id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 }],
      })

      // Verify consistency
      expect(logic.getState().wave).toBe(waveNumber)
      expect(logic.getWaveRecorder().toWaveRequest('test', []).waveNumber).toBe(waveNumber)
    })
  })

  // ============================================================================
  // Pause state and operations tests
  // ============================================================================

  describe('pause state and operations', () => {
    it('building placement is allowed while paused', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 100 }],
      })

      // Run a few frames
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      // Pause the game
      logic.togglePause()
      expect(logic.getState().isPaused).toBe(true)

      // Placing a building while paused should succeed
      const result = logic.placeBuilding([5, 5], 'cannon')
      expect(result.success).toBe(true)

      // Verify building was actually placed
      expect(logic.getBuildings()).toHaveLength(2)
    })

    it('building placed while paused uses the paused frame number', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 100 }],
      })

      // Run 50 frames
      for (let i = 0; i < 50; i++) {
        logic.update()
      }

      const frameBeforePause = logic.getState().frame
      expect(frameBeforePause).toBe(50)

      // Pause the game
      logic.togglePause()

      // Place a building while paused
      logic.placeBuilding([5, 5], 'cannon')

      // Verify the action's recorded frame is the paused frame
      const recorder = logic.getWaveRecorder()
      const actions = recorder.getActions()
      const lastAction = actions[actions.length - 1]
      expect(lastAction.type).toBe('BUILD')
      expect(lastAction.frame).toBe(50)
    })

    it('frame does not advance while paused', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 100 }],
      })

      // Run 30 frames
      for (let i = 0; i < 30; i++) {
        logic.update()
      }

      const frameBeforePause = logic.getState().frame
      expect(frameBeforePause).toBe(30)

      // Pause the game
      logic.togglePause()

      // Call update multiple times while paused
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // Frame should not advance
      expect(logic.getState().frame).toBe(30)

      // Resume the game
      logic.togglePause()

      // Run 20 more frames
      for (let i = 0; i < 20; i++) {
        logic.update()
      }

      // Frame should be 30 + 20 = 50
      expect(logic.getState().frame).toBe(50)
    })

    it('building upgrade is allowed while paused, using the paused frame number', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'wall')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 10, speed: 5, shield: 0, money: 500 }],
      })

      // Run until monster is killed (to earn money)
      for (let i = 0; i < 500; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      const frameBeforePause = logic.getState().frame

      // Pause the game
      logic.togglePause()

      // Upgrade building while paused
      const building = logic.getBuildings()[0]
      const result = logic.upgradeBuilding(building.id)
      expect(result.success).toBe(true)

      // Verify upgrade action's recorded frame
      const recorder = logic.getWaveRecorder()
      const upgradeAction = recorder.getActions().find(a => a.type === 'UPGRADE')
      expect(upgradeAction).toBeDefined()
      expect(upgradeAction!.frame).toBe(frameBeforePause)
    })

    it('building sell is allowed while paused, using the paused frame number', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'cannon')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // Run 40 frames
      for (let i = 0; i < 40; i++) {
        logic.update()
      }

      const frameBeforePause = logic.getState().frame
      expect(frameBeforePause).toBe(40)

      // Pause the game
      logic.togglePause()

      // Sell building while paused
      const building = logic.getBuildings()[0]
      const result = logic.sellBuilding(building.id)
      expect(result.success).toBe(true)

      // Verify sell action's recorded frame
      const recorder = logic.getWaveRecorder()
      const sellAction = recorder.getActions().find(a => a.type === 'SELL')
      expect(sellAction).toBeDefined()
      expect(sellAction!.frame).toBe(40)

      // Verify building was removed
      expect(logic.getBuildings()).toHaveLength(0)
    })

    it('monsters do not move and buildings do not attack while paused', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // Run 10 frames to start moving monsters
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      // Record attack count before pause
      const attacksBeforePause = logic.getWaveRecorder().getAttacks().length

      // Pause the game
      logic.togglePause()

      // Call update multiple times while paused
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // Attack count should not increase
      const attacksAfterPause = logic.getWaveRecorder().getAttacks().length
      expect(attacksAfterPause).toBe(attacksBeforePause)
    })

    it('game continues running normally after resuming', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 10 }],
      })

      // Run a few frames
      for (let i = 0; i < 20; i++) {
        logic.update()
      }

      // Pause
      logic.togglePause()

      // While paused
      for (let i = 0; i < 50; i++) {
        logic.update()
      }

      // Resume
      logic.togglePause()

      // Run until wave ends
      for (let i = 0; i < 5000; i++) {
        logic.update()
        if (logic.isWaveComplete()) break
      }

      // Wave should end normally
      expect(logic.isWaveComplete()).toBe(true)

      // Should have attack records
      expect(logic.getWaveRecorder().getAttacks().length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // Early game over tests
  // ============================================================================

  describe('early game over - remaining monsters', () => {
    it('can get the list of monsters on the field after setGameOver', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // Run a few frames to spawn monsters
      for (let i = 0; i < 50; i++) {
        logic.update()
      }

      // End game early
      logic.setGameOver()

      // Should be able to get monsters on the field
      const monsters = logic.getMonsters()
      expect(monsters.length).toBeGreaterThan(0)

      // Monsters should still be valid
      for (const monster of monsters) {
        expect(monster.isValid).toBe(true)
      }
    })

    it('remaining monster IDs are recorded on early game over (simulating Game.ts call flow)', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'wall') // no attack, all monsters survive
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-3', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // Run enough frames to spawn all monsters
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // End game early
      logic.setGameOver()

      // Simulate Game.ts call flow: iterate over monsters and record them
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      // Verify remainingMonsterIds
      const remainingIds = waveRecorder.getRemainingMonsterIds()
      expect(remainingIds.length).toBe(monsters.filter(m => m.isValid).length)

      // Verify IDs are correct
      for (const monster of monsters) {
        if (monster.isValid) {
          expect(remainingIds).toContain(monster.id)
        }
      }
    })

    it('remaining count is correct on early game over', () => {
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

      // Run for a while, possibly killing the first monster
      for (let i = 0; i < 200; i++) {
        logic.update()
      }

      // End game early
      logic.setGameOver()

      // Record remaining monsters
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      // Get result
      const result = waveRecorder.getResult()

      // Verify remaining field
      if (result.remaining !== undefined) {
        expect(result.remaining).toBe(result.remainingMonsterIds?.length)
      }
    })

    it('conservation formula holds on early game over: killed + passed + remaining == spawned', () => {
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

      // Run for a while, killing some monsters
      for (let i = 0; i < 300; i++) {
        logic.update()
      }

      // End game early
      logic.setGameOver()

      // Record remaining monsters
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      // Verify conservation formula
      const result = waveRecorder.getResult()
      const remaining = result.remaining ?? 0
      expect(result.killed + result.passed + remaining).toBe(result.spawned)
    })

    it('early game over when some monsters have not been spawned yet', () => {
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

      // Run only a few frames, may have only spawned some monsters
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      // End game early
      logic.setGameOver()

      // Record remaining monsters
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      const result = waveRecorder.getResult()

      // spawned may be less than the configured total (because of early termination)
      // But the conservation formula still holds
      const remaining = result.remaining ?? 0
      expect(result.killed + result.passed + remaining).toBe(result.spawned)
    })

    it('lastWave data contains correct remaining information on early game over', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          { id: 'uuid-1', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
          { id: 'uuid-2', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 },
        ],
      })

      // Run for a while
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // End game early
      logic.setGameOver()

      // Simulate Game.ts complete call flow
      const waveRecorder = logic.getWaveRecorder()
      const monsters = logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      // Get API request format data
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

      // Verify request data
      expect(request.waveNumber).toBe(1)
      expect(request.result.remaining).toBeGreaterThan(0)
      expect(request.result.remainingMonsterIds).toBeDefined()
      expect(request.result.remainingMonsterIds!.length).toBe(request.result.remaining)

      // Verify conservation
      const remaining = request.result.remaining ?? 0
      expect(request.result.killed + request.result.passed + remaining).toBe(request.result.spawned)
    })

    it('remaining is 0 or undefined on normal wave completion', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'laser_gun')
      logic.startWave({
        waveNumber: 1,
        monsters: [
          // Use high-speed monsters to ensure completion within the frame limit
          { id: 'uuid-1', type: 0, life: 30, speed: 5, shield: 0, money: 10 },
        ],
      })

      // Run until wave ends normally (increase frame limit)
      let completed = false
      for (let i = 0; i < 10000; i++) {
        logic.update()
        if (logic.isWaveComplete()) {
          completed = true
          break
        }
      }

      expect(completed).toBe(true)

      // No need to record remaining monsters on normal completion
      const result = logic.getWaveRecorder().getResult()

      // remaining should be undefined (no remaining monsters)
      expect(result.remaining).toBeUndefined()

      // Conservation: killed + passed == spawned
      expect(result.killed + result.passed).toBe(result.spawned)
    })
  })

  // ============================================================================
  // Auto pause feature tests
  // ============================================================================

  describe('auto pause - pause() method', () => {
    it('pause() method can pause the game', () => {
      expect(logic.getState().isPaused).toBe(false)

      logic.pause()

      expect(logic.getState().isPaused).toBe(true)
    })

    it('pause() does not change state when already paused', () => {
      logic.pause()
      expect(logic.getState().isPaused).toBe(true)

      logic.pause()
      expect(logic.getState().isPaused).toBe(true)
    })

    it('togglePause() can resume after pause()', () => {
      logic.pause()
      expect(logic.getState().isPaused).toBe(true)

      logic.togglePause()
      expect(logic.getState().isPaused).toBe(false)
    })

    it('frame does not advance after pause()', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 1, shield: 0, money: 5 }],
      })

      logic.update()
      const frameBeforePause = logic.getState().frame

      logic.pause()

      // Multiple updates after pause
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      expect(logic.getState().frame).toBe(frameBeforePause)
    })

    it('monsters do not move after pause()', () => {
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 3, shield: 0, money: 5 }],
      })

      // Spawn monsters and move for a while
      for (let i = 0; i < 30; i++) {
        logic.update()
      }

      const monsters = logic.getMonsters()
      expect(monsters.length).toBeGreaterThan(0)

      const positionBeforePause = monsters[0].getPixelPosition()

      logic.pause()

      // Multiple updates after pause
      for (let i = 0; i < 30; i++) {
        logic.update()
      }

      const positionAfterPause = monsters[0].getPixelPosition()

      expect(positionAfterPause.x).toBe(positionBeforePause.x)
      expect(positionAfterPause.y).toBe(positionBeforePause.y)
    })

    it('pause() has no effect after game over', () => {
      logic.setGameOver()

      logic.pause()

      // Game over state is not affected by pause()
      const state = logic.getState()
      expect(state.isGameOver).toBe(true)
      expect(state.isPlaying).toBe(false)
    })

    it('pause state is reset after reset()', () => {
      logic.pause()
      expect(logic.getState().isPaused).toBe(true)

      logic.reset()

      expect(logic.getState().isPaused).toBe(false)
    })

    it('buildings do not attack after pause()', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // Run 10 frames to let monsters enter range
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      const attacksBeforePause = logic.getWaveRecorder().getAttacks().length

      logic.pause()

      // Multiple updates while paused
      for (let i = 0; i < 100; i++) {
        logic.update()
      }

      // Attack count should not increase
      expect(logic.getWaveRecorder().getAttacks().length).toBe(attacksBeforePause)
    })

    it('bullets do not move after pause()', () => {
      logic.prepareNextWaveRecorder(1)
      // Use cannon (has bullet flight) instead of laser_gun (instant hit)
      logic.placeBuilding([3, 3], 'cannon')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 500, speed: 0.5, shield: 0, money: 10 }],
      })

      // Run until bullets appear
      let hasBullets = false
      for (let i = 0; i < 100 && !hasBullets; i++) {
        logic.update()
        if (logic.getBullets().length > 0) {
          hasBullets = true
        }
      }

      // If there are bullets, test pause behavior
      if (hasBullets) {
        const bullets = logic.getBullets()
        const bulletPositions = bullets.map(b => ({ x: b.x, y: b.y }))

        logic.pause()

        // Multiple updates while paused
        for (let i = 0; i < 50; i++) {
          logic.update()
        }

        // Bullet positions should not change
        const bulletsAfterPause = logic.getBullets()
        bulletPositions.forEach((pos, idx) => {
          if (bulletsAfterPause[idx]) {
            expect(bulletsAfterPause[idx].x).toBe(pos.x)
            expect(bulletsAfterPause[idx].y).toBe(pos.y)
          }
        })
      }
    })

    it('building operations are still allowed while paused via pause()', () => {
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 100, speed: 0.5, shield: 0, money: 10 }],
      })

      // Run a few frames
      for (let i = 0; i < 10; i++) {
        logic.update()
      }

      logic.pause()

      // Placing a building while paused should succeed
      const result = logic.placeBuilding([5, 5], 'cannon')
      expect(result.success).toBe(true)

      // Upgrading a building while paused should succeed
      const building = logic.getBuildings()[0]
      const upgradeResult = logic.upgradeBuilding(building.id)
      expect(upgradeResult.success).toBe(true)
    })

    it('pause works correctly in initial state (wave=0)', () => {
      // Game just started, no wave yet
      expect(logic.getState().wave).toBe(0)
      expect(logic.getState().frame).toBe(0)

      logic.pause()

      expect(logic.getState().isPaused).toBe(true)

      // Frame does not advance after pause
      for (let i = 0; i < 10; i++) {
        logic.update()
      }
      expect(logic.getState().frame).toBe(0)

      // Can proceed normally after resuming
      logic.togglePause()
      logic.prepareNextWaveRecorder(1)
      logic.placeBuilding([3, 3], 'LMG')
      logic.startWave({
        waveNumber: 1,
        monsters: [{ id: 'uuid-1', type: 0, life: 50, speed: 1, shield: 0, money: 5 }],
      })

      logic.update()
      expect(logic.getState().frame).toBe(1)
    })
  })
})
