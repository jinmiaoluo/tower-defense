/**
 * GameSceneLogic - 游戏场景核心逻辑
 * 整合所有游戏系统，与 Phaser 渲染解耦，便于单元测试
 * 参考旧实现：html5-tower-defense/src/js/td.js
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
// 注意: DamageSystem 的伤害计算在 Monster 实体的 takeDamage 方法中完成
// 注意: EconomySystem 的生命奖励功能由服务端计算并通过 API 返回
// 客户端在 Game.ts 中根据服务端响应的 lifeReward 应用奖励
import { createMonster, type MonsterDependencies, type IMonsterRuntime } from '../entities/Monster'
import { createBuilding, type BuildingDependencies, type IBuildingRuntime } from '../entities/Building'

const { GRID_SIZE } = GAME_CONSTANTS

/** 游戏状态 */
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

/** 建筑放置结果 */
export interface PlaceBuildingResult {
  success: boolean
  buildingId?: string
  reason?: 'insufficient_money' | 'invalid_position' | 'would_block_path' | 'would_block_monsters'
}

/** 升级/出售结果 */
export interface BuildingActionResult {
  success: boolean
  reason?: 'insufficient_money' | 'building_not_found'
}

/** GameSceneLogic 接口 */
export interface GameSceneLogic {
  // 状态获取
  getState(): GameState
  getMonsters(): readonly IMonster[]
  getBuildings(): readonly IBuilding[]
  getBullets(): readonly Bullet[]
  getCurrentPath(): Position[]
  getWaveRecorder(): IWaveRecorder
  getBuilding(id: string): IBuilding | null
  canPlaceBuilding(position: Position): boolean
  getUpgradeCost(type: BuildingType, level: number): number

  // 波次管理
  prepareNextWaveRecorder(waveNumber: number): void
  startWave(waveConfig: WaveConfig): void
  isWaveComplete(): boolean

  // 建筑操作
  placeBuilding(position: Position, type: BuildingType): PlaceBuildingResult
  upgradeBuilding(buildingId: string): BuildingActionResult
  sellBuilding(buildingId: string): BuildingActionResult

  // 游戏控制
  update(): void
  togglePause(): void
  setGameOver(): void
  reset(): void
}

/**
 * 创建 GameSceneLogic 实例
 */
export function createGameSceneLogic(config: GameConfig): GameSceneLogic {
  // 系统实例
  const pathSystem = createPathSystem()
  const gridSystem = createGridSystem(config.map)
  const waveManager = createWaveManager()
  const buildingSystem = createBuildingSystem(config)
  const bulletSystem = createBulletSystem()

  // 波次记录器
  let waveRecorder = createWaveRecorder(0, 0)

  // 累计分数（跨波次保持）
  let accumulatedScore = 0

  // 游戏状态
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

  // 怪物和建筑列表
  const monsters: (IMonster & IMonsterRuntime)[] = []
  const buildings: (IBuilding & IBuildingRuntime)[] = []

  // 建筑 ID 计数器
  let buildingIdCounter = 0

  // 地图边界（用于子弹系统）
  const mapBounds: Rect = {
    x: 0,
    y: 0,
    width: config.map.width * GRID_SIZE,
    height: config.map.height * GRID_SIZE,
  }

  // 怪物依赖
  const monsterDeps: MonsterDependencies = {
    generatePathFrom: (startPosition) =>
      pathSystem.generatePathFrom(startPosition, gridSystem.getMapConfig()),
    getPositionAtProgress: (path, progress) =>
      pathSystem.getPositionAtProgress(path, progress),
    isPassable: (position) => gridSystem.isPassable(position),
    getEntrance: () => gridSystem.getMapConfig().entrance,
  }

  // 建筑依赖
  const buildingDeps: BuildingDependencies = {
    getDamageAtLevel: (type, level) => buildingSystem.getDamageAtLevel(type, level),
    getRangeAtLevel: (type, level) => buildingSystem.getRangeAtLevel(type, level),
    getAttackSpeedFrames: (type) => buildingSystem.getAttackSpeedFrames(type),
    isInRange: (building, targetPos) => buildingSystem.isInRange(building, targetPos),
    isWeapon: (type) => buildingSystem.isWeapon(type),
    getBulletSpeed: (type) => buildingSystem.getBuildingConfig(type).bullet_speed,
  }

  /**
   * 获取所有怪物的格子位置
   */
  function getMonsterPositions(): Position[] {
    return monsters
      .filter((m) => m.isValid && m.progress >= 0)
      .map((m) => m.getGridPosition())
  }

  /**
   * 生成怪物
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
   * 处理怪物击杀
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
   * 处理怪物到达终点
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
   * 更新所有怪物
   */
  function updateMonsters(): void {
    for (let i = monsters.length - 1; i >= 0; i--) {
      const monster = monsters[i]

      if (!monster.isValid) {
        // 怪物已死亡或到达终点
        if (monster.isDead()) {
          handleMonsterKill(monster)
        } else if (monster.reachedExit()) {
          handleMonsterPassed(monster)
        }
        monsters.splice(i, 1)
        continue
      }

      // 更新怪物位置
      monster.update()
    }
  }

  /**
   * 更新所有建筑
   */
  function updateBuildings(): void {
    const aliveMonsters = monsters.filter((m) => m.isValid)

    for (const building of buildings) {
      building.updateCooldown()

      if (!building.canAttack()) continue

      const target = building.findTarget(aliveMonsters)
      if (!target) continue

      // 执行攻击
      building.attack(target, waveRecorder, state.frame)

      // 非激光枪需要创建子弹
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

      // 检查目标是否被击杀（激光枪直接命中）
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
   * 更新子弹系统
   */
  function updateBullets(): void {
    const aliveMonsters = monsters.filter((m) => m.isValid)
    bulletSystem.update(aliveMonsters, mapBounds, waveRecorder, state.frame)

    // 检查被子弹击杀的怪物
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
      // 保存之前波次的累计分数
      accumulatedScore += waveRecorder.getResult().scoreGained
      // 更新状态中的分数
      state.score = accumulatedScore
      // 为下一波创建新的 recorder
      waveRecorder = createWaveRecorder(waveNumber, state.frame)
    },

    startWave(waveConfig: WaveConfig): void {
      // recorder 已由 prepareNextWaveRecorder 创建，这里只更新波次号和启动波次
      state.wave = waveConfig.waveNumber
      waveManager.reset()
      waveManager.startWave(waveConfig)

      // 重置建筑统计
      for (const building of buildings) {
        building.resetWaveStats()
      }
    },

    isWaveComplete(): boolean {
      return waveManager.isWaveComplete()
    },

    placeBuilding(position: Position, type: BuildingType): PlaceBuildingResult {
      const cost = buildingSystem.getBuildingConfig(type).cost

      // 检查金钱
      if (state.money < cost) {
        return { success: false, reason: 'insufficient_money' }
      }

      // 检查位置（不考虑怪物）
      if (!gridSystem.canPlaceBuilding(position)) {
        // 细分原因
        const cell = gridSystem.getCell(position)
        if (!cell || cell.isEntrance || cell.isExit || cell.isObstacle || cell.buildingId) {
          return { success: false, reason: 'invalid_position' }
        }
        return { success: false, reason: 'would_block_path' }
      }

      // 检查是否会阻断怪物
      const monsterPositions = getMonsterPositions()
      if (gridSystem.wouldBlockMonsters(position, monsterPositions)) {
        return { success: false, reason: 'would_block_monsters' }
      }

      // 放置建筑
      const buildingId = `b-${++buildingIdCounter}`
      gridSystem.placeBuilding(position, buildingId)

      const building = createBuilding(
        { id: buildingId, type, position },
        buildingDeps,
      )
      buildings.push(building)

      // 扣除金钱
      state.money -= cost

      // 记录操作
      waveRecorder.recordBuild({
        buildingId,
        buildingType: type,
        position,
        frame: state.frame,
      })

      return { success: true, buildingId }
    },

    upgradeBuilding(buildingId: string): BuildingActionResult {
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
      const index = buildings.findIndex((b) => b.id === buildingId)
      if (index === -1) {
        return { success: false, reason: 'building_not_found' }
      }

      const building = buildings[index]
      const income = buildingSystem.getSellIncome(building.type, building.level)

      // 从格子系统移除
      gridSystem.removeBuilding(building.position)

      // 从列表移除
      buildings.splice(index, 1)

      // 增加金钱
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

      // 检查是否需要生成怪物
      const monsterConfig = waveManager.update(state.frame)
      if (monsterConfig) {
        spawnMonster(monsterConfig)
      }

      // 更新怪物
      updateMonsters()

      // 更新建筑
      updateBuildings()

      // 更新子弹
      updateBullets()

      // 更新波次记录器的持续时间
      waveRecorder.setDuration(state.frame)

      // 累计分数（之前波次 + 当前波次）
      state.score = accumulatedScore + waveRecorder.getResult().scoreGained
    },

    togglePause(): void {
      state.isPaused = !state.isPaused
    },

    setGameOver(): void {
      state.isGameOver = true
      state.isPlaying = false
    },

    reset(): void {
      // 重置状态
      state.money = config.initial.money
      state.life = config.initial.life
      state.score = 0
      state.wave = 0
      state.frame = 0
      state.isPlaying = true
      state.isPaused = false
      state.isGameOver = false

      // 清空列表
      monsters.length = 0
      buildings.length = 0
      buildingIdCounter = 0

      // 重置累计分数
      accumulatedScore = 0

      // 重置系统
      gridSystem.reset()
      waveManager.reset()
      bulletSystem.clear()
      waveRecorder = createWaveRecorder(0, 0)
    },
  }
}
