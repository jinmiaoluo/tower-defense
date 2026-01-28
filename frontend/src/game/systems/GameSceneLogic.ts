/**
 * GameSceneLogic - Core game scene logic
 * Integrates all game systems, decoupled from Phaser rendering for unit testing
 * Reference: html5-tower-defense/src/js/td.js
 */

import type {
  GameConfig,
  WaveConfig,
  MonsterConfig,
  Position,
  BuildingType,
} from '@/types'
import { GAME_CONSTANTS } from '@/types'
import type { IMonster, IBuilding } from '@/types/entities'
import type { IWaveRecorder } from '@/types/recorder'

import { createGridSystem } from './GridSystem'
import { createPathSystem } from './PathSystem'
import { createWaveManager } from './WaveManager'
import { createWaveRecorder } from './WaveRecorder'
import { createBuildingSystem } from './BuildingSystem'
import { createBulletSystem, type Rect, type Bullet } from './BulletSystem'
// Note: DamageSystem damage calculation is done in the Monster entity's takeDamage method
// Note: EconomySystem life reward is calculated server-side and returned via API
// Client applies lifeReward from server response in Game.ts
import { createMonster, type MonsterDependencies, type IMonsterRuntime } from '../entities/Monster'
import { createBuilding, type BuildingDependencies, type IBuildingRuntime } from '../entities/Building'

const { GRID_SIZE } = GAME_CONSTANTS

/** Game state */
export interface GameState {
  money: number
  life: number
  score: number
  wave: number
  frame: number
  isPlaying: boolean
  isPaused: boolean
  isGameOver: boolean
}

/** Building placement result */
export interface PlaceBuildingResult {
  success: boolean
  buildingId?: string
  reason?:
    | 'insufficient_money'
    | 'invalid_position'
    | 'would_block_path'
    | 'would_block_monsters'
    | 'game_over'
}

/** Upgrade/sell result */
export interface BuildingActionResult {
  success: boolean
  reason?: 'insufficient_money' | 'building_not_found' | 'game_over'
}

/** GameSceneLogic interface */
export interface GameSceneLogic {
  // State getters
  getState(): GameState
  getMonsters(): readonly IMonster[]
  getBuildings(): readonly IBuilding[]
  getBullets(): readonly Bullet[]
  getCurrentPath(): Position[]
  getWaveRecorder(): IWaveRecorder
  getBuilding(id: string): IBuilding | null
  canPlaceBuilding(position: Position): boolean
  getUpgradeCost(type: BuildingType, level: number): number

  // Wave management
  prepareNextWaveRecorder(waveNumber: number): void
  startWave(waveConfig: WaveConfig): void
  isWaveComplete(): boolean

  // Building operations
  placeBuilding(position: Position, type: BuildingType): PlaceBuildingResult
  upgradeBuilding(buildingId: string): BuildingActionResult
  sellBuilding(buildingId: string): BuildingActionResult

  // Game control
  update(): void
  pause(): void
  togglePause(): void
  setGameOver(): void
  reset(): void
}

/**
 * Create a GameSceneLogic instance
 */
export function createGameSceneLogic(config: GameConfig): GameSceneLogic {
  // System instances
  const pathSystem = createPathSystem()
  const gridSystem = createGridSystem(config.map)
  const waveManager = createWaveManager()
  const buildingSystem = createBuildingSystem(config)
  const bulletSystem = createBulletSystem()

  // Wave recorder
  let waveRecorder = createWaveRecorder(0, 0)

  // Accumulated score (persists across waves)
  let accumulatedScore = 0

  // Game state
  const state: GameState = {
    money: config.initial.money,
    life: config.initial.life,
    score: 0,
    wave: 0,
    frame: 0,
    isPlaying: true,
    isPaused: false,
    isGameOver: false,
  }

  // Monster and building lists
  const monsters: (IMonster & IMonsterRuntime)[] = []
  const buildings: (IBuilding & IBuildingRuntime)[] = []

  // Building ID counter
  let buildingIdCounter = 0

  // Map bounds (for bullet system)
  const mapBounds: Rect = {
    x: 0,
    y: 0,
    width: config.map.width * GRID_SIZE,
    height: config.map.height * GRID_SIZE,
  }

  // Monster dependencies
  const monsterDeps: MonsterDependencies = {
    generatePathFrom: (startPosition) =>
      pathSystem.generatePathFrom(startPosition, gridSystem.getMapConfig()),
    getPositionAtProgress: (path, progress) =>
      pathSystem.getPositionAtProgress(path, progress),
    isPassable: (position) => gridSystem.isPassable(position),
    getEntrance: () => gridSystem.getMapConfig().entrance,
  }

  // Building dependencies
  const buildingDeps: BuildingDependencies = {
    getDamageAtLevel: (type, level) => buildingSystem.getDamageAtLevel(type, level),
    getRangeAtLevel: (type, level) => buildingSystem.getRangeAtLevel(type, level),
    getAttackSpeedFrames: (type) => buildingSystem.getAttackSpeedFrames(type),
    isInRange: (building, targetPos) => buildingSystem.isInRange(building, targetPos),
    isWeapon: (type) => buildingSystem.isWeapon(type),
    getBulletSpeed: (type) => buildingSystem.getBuildingConfig(type).bullet_speed,
  }

  /**
   * Get grid positions of all monsters
   */
  function getMonsterPositions(): Position[] {
    return monsters
      .filter((m) => m.isValid && m.progress >= 0)
      .map((m) => m.getGridPosition())
  }

  /**
   * Spawn a monster
   */
  function spawnMonster(monsterConfig: MonsterConfig): void {
    const displayConfig = config.monsters[monsterConfig.type]

    const monster = createMonster(
      {
        id: monsterConfig.id,
        type: monsterConfig.type,
        life: monsterConfig.life,
        speed: monsterConfig.speed,
        shield: monsterConfig.shield,
        money: monsterConfig.money,
        color: displayConfig.color,
        damage: displayConfig.damage,
      },
      monsterDeps,
    )

    monsters.push(monster)
    waveManager.registerMonster(monster)
    waveRecorder.recordSpawn()
  }

  /**
   * Handle monster kill
   */
  function handleMonsterKill(monster: IMonster): void {
    waveRecorder.recordKill({
      monsterType: monster.type,
      monsterLife: monster.maxLife,
      money: monster.money,
    })

    state.money += monster.money
    waveManager.onMonsterRemoved(monster)
  }

  /**
   * Handle monster reaching the exit
   */
  function handleMonsterPassed(monster: IMonster): void {
    waveRecorder.recordPassed({ damage: monster.damage })

    state.life -= monster.damage
    waveManager.onMonsterRemoved(monster)

    if (state.life <= 0) {
      state.life = 0
      state.isGameOver = true
      state.isPlaying = false
    }
  }

  /**
   * Update all monsters
   */
  function updateMonsters(): void {
    for (let i = monsters.length - 1; i >= 0; i--) {
      const monster = monsters[i]

      if (!monster.isValid) {
        // Monster is dead or reached the exit
        if (monster.isDead()) {
          handleMonsterKill(monster)
        } else if (monster.reachedExit()) {
          handleMonsterPassed(monster)
        }
        monsters.splice(i, 1)
        continue
      }

      // Update monster position
      monster.update()
    }
  }

  /**
   * Update all buildings
   */
  function updateBuildings(): void {
    const aliveMonsters = monsters.filter((m) => m.isValid)

    for (const building of buildings) {
      building.updateCooldown()

      if (!building.canAttack()) continue

      const target = building.findTarget(aliveMonsters)
      if (!target) continue

      // Execute attack
      building.attack(target, waveRecorder, state.frame)

      // Non-laser weapons need to create a bullet
      const bulletParams = building.getBulletParams(target)
      if (bulletParams) {
        const pos = building.position
        bulletSystem.createBullet({
          building: bulletParams.building,
          target,
          damage: bulletParams.damage,
          speed: bulletParams.speed,
          startX: pos[0] * GRID_SIZE + GRID_SIZE / 2,
          startY: pos[1] * GRID_SIZE + GRID_SIZE / 2,
        })
      }

      // Check if target was killed (laser gun hits directly)
      if (target.isDead() && !target.isValid) {
        handleMonsterKill(target)
        const idx = monsters.indexOf(target as IMonster & IMonsterRuntime)
        if (idx !== -1) {
          monsters.splice(idx, 1)
        }
      }
    }
  }

  /**
   * Update bullet system
   */
  function updateBullets(): void {
    const aliveMonsters = monsters.filter((m) => m.isValid)
    bulletSystem.update(aliveMonsters, mapBounds, waveRecorder, state.frame)

    // Check for monsters killed by bullets
    for (let i = monsters.length - 1; i >= 0; i--) {
      const monster = monsters[i]
      if (monster.isDead() && !monster.isValid) {
        handleMonsterKill(monster)
        monsters.splice(i, 1)
      }
    }
  }

  return {
    getState(): GameState {
      return { ...state }
    },

    getMonsters(): readonly IMonster[] {
      return monsters
    },

    getBuildings(): readonly IBuilding[] {
      return buildings
    },

    getBullets(): readonly Bullet[] {
      return bulletSystem.getBullets()
    },

    getCurrentPath(): Position[] {
      return gridSystem.getCurrentPath()
    },

    getWaveRecorder(): IWaveRecorder {
      return waveRecorder
    },

    getBuilding(id: string): IBuilding | null {
      return buildings.find((b) => b.id === id) ?? null
    },

    canPlaceBuilding(position: Position): boolean {
      const monsterPositions = getMonsterPositions()
      return (
        gridSystem.canPlaceBuilding(position) &&
        !gridSystem.wouldBlockMonsters(position, monsterPositions)
      )
    },

    getUpgradeCost(type: BuildingType, level: number): number {
      return buildingSystem.getUpgradeCost(type, level)
    },

    prepareNextWaveRecorder(waveNumber: number): void {
      // Save accumulated score from previous wave
      accumulatedScore += waveRecorder.getResult().scoreGained
      // Update score in state
      state.score = accumulatedScore
      // Create new recorder for the next wave
      waveRecorder = createWaveRecorder(waveNumber, state.frame)
    },

    startWave(waveConfig: WaveConfig): void {
      // Recorder already created by prepareNextWaveRecorder, just update wave number and start wave
      state.wave = waveConfig.waveNumber
      waveManager.reset()
      waveManager.startWave(waveConfig)

      // Reset building stats
      for (const building of buildings) {
        building.resetWaveStats()
      }
    },

    isWaveComplete(): boolean {
      return waveManager.isWaveComplete()
    },

    placeBuilding(position: Position, type: BuildingType): PlaceBuildingResult {
      if (state.isGameOver) {
        return { success: false, reason: 'game_over' }
      }

      const cost = buildingSystem.getBuildingConfig(type).cost

      // Check money
      if (state.money < cost) {
        return { success: false, reason: 'insufficient_money' }
      }

      // Check position (without considering monsters)
      if (!gridSystem.canPlaceBuilding(position)) {
        // Determine specific reason
        const cell = gridSystem.getCell(position)
        if (!cell || cell.isEntrance || cell.isExit || cell.isObstacle || cell.buildingId) {
          return { success: false, reason: 'invalid_position' }
        }
        return { success: false, reason: 'would_block_path' }
      }

      // Check if it would block monsters
      const monsterPositions = getMonsterPositions()
      if (gridSystem.wouldBlockMonsters(position, monsterPositions)) {
        return { success: false, reason: 'would_block_monsters' }
      }

      // Place building
      const buildingId = `b-${++buildingIdCounter}`
      gridSystem.placeBuilding(position, buildingId)

      const building = createBuilding(
        { id: buildingId, type, position },
        buildingDeps,
      )
      buildings.push(building)

      // Deduct money
      state.money -= cost

      // Record action
      waveRecorder.recordBuild({
        buildingId,
        buildingType: type,
        position,
        frame: state.frame,
      })

      return { success: true, buildingId }
    },

    upgradeBuilding(buildingId: string): BuildingActionResult {
      if (state.isGameOver) {
        return { success: false, reason: 'game_over' }
      }

      const building = buildings.find((b) => b.id === buildingId)
      if (!building) {
        return { success: false, reason: 'building_not_found' }
      }

      const cost = buildingSystem.getUpgradeCost(building.type, building.level)
      if (state.money < cost) {
        return { success: false, reason: 'insufficient_money' }
      }

      building.upgrade()
      state.money -= cost

      waveRecorder.recordUpgrade({
        buildingId,
        level: building.level,
        frame: state.frame,
      })

      return { success: true }
    },

    sellBuilding(buildingId: string): BuildingActionResult {
      if (state.isGameOver) {
        return { success: false, reason: 'game_over' }
      }

      const index = buildings.findIndex((b) => b.id === buildingId)
      if (index === -1) {
        return { success: false, reason: 'building_not_found' }
      }

      const building = buildings[index]
      const income = buildingSystem.getSellIncome(building.type, building.level)

      // Remove from grid system
      gridSystem.removeBuilding(building.position)

      // Remove from list
      buildings.splice(index, 1)

      // Add money
      state.money += income

      waveRecorder.recordSell({
        buildingId,
        frame: state.frame,
      })

      return { success: true }
    },

    update(): void {
      if (!state.isPlaying || state.isPaused || state.isGameOver) {
        return
      }

      state.frame++

      // Check if a monster needs to be spawned
      const monsterConfig = waveManager.update(state.frame)
      if (monsterConfig) {
        spawnMonster(monsterConfig)
      }

      // Update monsters
      updateMonsters()

      // Update buildings
      updateBuildings()

      // Update bullets
      updateBullets()

      // Update wave recorder duration
      waveRecorder.setDuration(state.frame)

      // Accumulated score (previous waves + current wave)
      state.score = accumulatedScore + waveRecorder.getResult().scoreGained
    },

    pause(): void {
      if (!state.isGameOver) {
        state.isPaused = true
      }
    },

    togglePause(): void {
      state.isPaused = !state.isPaused
    },

    setGameOver(): void {
      state.isGameOver = true
      state.isPlaying = false
    },

    reset(): void {
      // Reset state
      state.money = config.initial.money
      state.life = config.initial.life
      state.score = 0
      state.wave = 0
      state.frame = 0
      state.isPlaying = true
      state.isPaused = false
      state.isGameOver = false

      // Clear lists
      monsters.length = 0
      buildings.length = 0
      buildingIdCounter = 0

      // Reset accumulated score
      accumulatedScore = 0

      // Reset systems
      gridSystem.reset()
      waveManager.reset()
      bulletSystem.clear()
      waveRecorder = createWaveRecorder(0, 0)
    },
  }
}
