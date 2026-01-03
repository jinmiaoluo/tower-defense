/**
 * Game Scene - 游戏主场景
 * 整合 PathSystem + GridSystem + Monster，实现游戏主循环
 */

import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { createPathSystem, type PathSystem } from '../systems/PathSystem'
import { createGridSystem, type GridSystem } from '../systems/GridSystem'
import { createMonster, type MonsterDependencies, type IMonsterRuntime } from '../entities/Monster'
import { MOCK_GAME_CONFIG, MOCK_MONSTERS, MOCK_MONSTER_BASE_STATS } from '@/mocks'
import type { MonsterTypeId } from '@/types'
import type { Path } from '@/types/entities'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE } = GAME_CONSTANTS

/** 颜色常量 */
const COLORS = {
  GRID_LINE: 0x444444,
  GRID_FILL: 0x2a2a3e,
  ENTRANCE: 0x00ff00,
  EXIT: 0xff0000,
  PATH: 0x3a3a5e,
  OBSTACLE: 0x666666,
  MONSTER_HEALTH_BG: 0x333333,
  MONSTER_HEALTH: 0x00ff00,
  UI_TEXT: '#ffffff',
}

/** 游戏状态 */
interface GameState {
  money: number
  life: number
  score: number
  wave: number
  frame: number
  isPlaying: boolean
  isPaused: boolean
}

export class Game extends Scene {
  // 游戏系统
  private pathSystem!: PathSystem
  private gridSystem!: GridSystem

  // 游戏状态
  private gameState!: GameState

  // 怪物列表
  private monsters: IMonsterRuntime[] = []
  private monsterGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map()

  // 渲染对象
  private mapGraphics!: Phaser.GameObjects.Graphics
  private pathGraphics!: Phaser.GameObjects.Graphics
  private uiText!: Phaser.GameObjects.Text

  // 地图偏移（居中显示）
  private mapOffsetX = 0
  private mapOffsetY = 0

  constructor() {
    super('Game')
  }

  create() {
    const { width, height } = this.scale

    // 计算地图偏移（居中显示）
    const mapWidth = MOCK_GAME_CONFIG.map.width * GRID_SIZE
    const mapHeight = MOCK_GAME_CONFIG.map.height * GRID_SIZE
    this.mapOffsetX = Math.floor((width - mapWidth) / 2)
    this.mapOffsetY = Math.floor((height - mapHeight) / 2) + 30 // 留出顶部 UI 空间

    // 初始化游戏系统
    this.initSystems()

    // 初始化游戏状态
    this.initGameState()

    // 创建渲染对象
    this.createRenderObjects()

    // 渲染静态元素
    this.renderMap()
    this.renderPath()

    // 创建 UI
    this.createUI()

    // 生成初始怪物
    this.spawnWave()

    // 通知 Vue 场景已就绪
    EventBus.emit('current-scene-ready', this)
  }

  /** 初始化游戏系统 */
  private initSystems() {
    this.pathSystem = createPathSystem()
    this.gridSystem = createGridSystem(MOCK_GAME_CONFIG.map)
  }

  /** 初始化游戏状态 */
  private initGameState() {
    this.gameState = {
      money: MOCK_GAME_CONFIG.initial.money,
      life: MOCK_GAME_CONFIG.initial.life,
      score: 0,
      wave: 1,
      frame: 0,
      isPlaying: true,
      isPaused: false,
    }
  }

  /** 创建渲染对象 */
  private createRenderObjects() {
    // 地图背景层
    this.mapGraphics = this.add.graphics()

    // 路径层
    this.pathGraphics = this.add.graphics()
  }

  /** 渲染地图 */
  private renderMap() {
    const { width, height } = MOCK_GAME_CONFIG.map
    const g = this.mapGraphics

    g.clear()

    // 绘制格子
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = this.mapOffsetX + x * GRID_SIZE
        const py = this.mapOffsetY + y * GRID_SIZE

        const cell = this.gridSystem.getCell([x, y])
        if (!cell) continue

        // 填充颜色
        let fillColor = COLORS.GRID_FILL
        if (cell.isEntrance) {
          fillColor = COLORS.ENTRANCE
        } else if (cell.isExit) {
          fillColor = COLORS.EXIT
        } else if (cell.isObstacle) {
          fillColor = COLORS.OBSTACLE
        }

        // 绘制格子
        g.fillStyle(fillColor, cell.isEntrance || cell.isExit ? 0.5 : 1)
        g.fillRect(px, py, GRID_SIZE, GRID_SIZE)

        // 绘制边框
        g.lineStyle(1, COLORS.GRID_LINE, 0.5)
        g.strokeRect(px, py, GRID_SIZE, GRID_SIZE)
      }
    }

    // 绘制入口和出口标记
    this.drawEntranceExit()
  }

  /** 绘制入口和出口标记 */
  private drawEntranceExit() {
    const g = this.mapGraphics
    const entrance = this.gridSystem.getEntrance()
    const exit = this.gridSystem.getExit()

    // 入口圆圈
    const entranceX = this.mapOffsetX + entrance[0] * GRID_SIZE + GRID_SIZE / 2
    const entranceY = this.mapOffsetY + entrance[1] * GRID_SIZE + GRID_SIZE / 2
    g.lineStyle(2, COLORS.ENTRANCE, 1)
    g.strokeCircle(entranceX, entranceY, GRID_SIZE / 3)

    // 出口圆圈
    const exitX = this.mapOffsetX + exit[0] * GRID_SIZE + GRID_SIZE / 2
    const exitY = this.mapOffsetY + exit[1] * GRID_SIZE + GRID_SIZE / 2
    g.lineStyle(2, COLORS.EXIT, 1)
    g.strokeCircle(exitX, exitY, GRID_SIZE / 3)
  }

  /** 渲染路径 */
  private renderPath() {
    const g = this.pathGraphics
    const path = this.gridSystem.getCurrentPath()

    g.clear()
    g.fillStyle(COLORS.PATH, 0.3)

    for (const [x, y] of path) {
      const px = this.mapOffsetX + x * GRID_SIZE
      const py = this.mapOffsetY + y * GRID_SIZE
      g.fillRect(px + 2, py + 2, GRID_SIZE - 4, GRID_SIZE - 4)
    }
  }

  /** 创建 UI */
  private createUI() {
    const { width } = this.scale

    this.uiText = this.add.text(width / 2, 20, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: COLORS.UI_TEXT,
    }).setOrigin(0.5, 0)

    this.updateUI()
  }

  /** 更新 UI 显示 */
  private updateUI() {
    const { money, life, score, wave, frame } = this.gameState
    const aliveMonsters = this.monsters.filter(m => m.isValid).length

    this.uiText.setText(
      `Wave: ${wave} | Money: ${money} | Life: ${life} | Score: ${score} | Monsters: ${aliveMonsters} | Frame: ${frame}`
    )
  }

  /** 生成一波怪物 */
  private spawnWave() {
    const monsterTypes: MonsterTypeId[] = [0, 1, 2]
    const spawnCount = Math.min(3 + this.gameState.wave, 10)

    for (let i = 0; i < spawnCount; i++) {
      const typeId = monsterTypes[i % monsterTypes.length]
      this.spawnMonster(typeId, i * 30) // 每隔 30 帧生成一个
    }
  }

  /** 生成单个怪物 */
  private spawnMonster(typeId: MonsterTypeId, delayFrames: number = 0) {
    const baseStats = MOCK_MONSTER_BASE_STATS[typeId]
    const displayConfig = MOCK_MONSTERS[typeId]

    const monsterId = `m-${this.gameState.wave}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // 创建依赖
    const deps: MonsterDependencies = {
      getPath: () => this.gridSystem.getCurrentPath(),
      getPositionAtProgress: (path: Path, progress: number) => {
        return this.pathSystem.getPositionAtProgress(path, progress)
      },
    }

    // 创建怪物
    const monster = createMonster({
      id: monsterId,
      type: typeId,
      life: baseStats.life,
      speed: baseStats.speed,
      shield: baseStats.shield,
      money: baseStats.money,
      color: displayConfig.color,
      damage: displayConfig.damage,
    }, deps)

    // 设置初始延迟（通过负进度模拟）
    if (delayFrames > 0) {
      const path = this.gridSystem.getCurrentPath()
      const totalPathLength = (path.length - 1) * GRID_SIZE
      const delayProgress = -(delayFrames * baseStats.speed) / totalPathLength
      monster.progress = delayProgress
    }

    this.monsters.push(monster)

    // 创建怪物图形
    const graphics = this.add.graphics()
    this.monsterGraphics.set(monsterId, graphics)
  }

  /** 渲染单个怪物 */
  private renderMonster(monster: IMonsterRuntime) {
    const graphics = this.monsterGraphics.get(monster.id)
    if (!graphics) return

    graphics.clear()

    // 如果怪物还在等待生成（负进度），不渲染
    if (monster.progress < 0) return

    const pos = monster.getPixelPosition()
    const x = this.mapOffsetX + pos.x
    const y = this.mapOffsetY + pos.y

    // 解析颜色
    const color = Phaser.Display.Color.HexStringToColor(monster.color).color

    // 绘制怪物身体（圆形）
    graphics.fillStyle(color, 1)
    graphics.fillCircle(x, y, monster.radius)

    // 绘制边框
    graphics.lineStyle(1, 0x000000, 0.5)
    graphics.strokeCircle(x, y, monster.radius)

    // 绘制血条背景
    const healthBarWidth = monster.radius * 2
    const healthBarHeight = 4
    const healthBarY = y - monster.radius - 6

    graphics.fillStyle(COLORS.MONSTER_HEALTH_BG, 1)
    graphics.fillRect(x - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight)

    // 绘制血条
    const healthPercent = monster.currentLife / monster.maxLife
    const healthColor = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000
    graphics.fillStyle(healthColor, 1)
    graphics.fillRect(x - healthBarWidth / 2, healthBarY, healthBarWidth * healthPercent, healthBarHeight)
  }

  /** 清理无效怪物 */
  private cleanupMonsters() {
    const invalidMonsters = this.monsters.filter(m => !m.isValid)

    for (const monster of invalidMonsters) {
      // 处理到达终点的怪物
      if (monster.reachedExit()) {
        this.gameState.life -= monster.damage
        if (this.gameState.life <= 0) {
          this.gameState.life = 0
          this.gameOver()
        }
      }

      // 清理图形
      const graphics = this.monsterGraphics.get(monster.id)
      if (graphics) {
        graphics.destroy()
        this.monsterGraphics.delete(monster.id)
      }
    }

    // 移除无效怪物
    this.monsters = this.monsters.filter(m => m.isValid)
  }

  /** 检查波次是否结束 */
  private checkWaveComplete() {
    const hasActiveMonsters = this.monsters.some(m => m.isValid || m.progress < 0)

    if (!hasActiveMonsters && this.gameState.isPlaying) {
      // 波次结束，生成下一波
      this.gameState.wave++
      this.gameState.money += 50 // 波次奖励
      this.spawnWave()
    }
  }

  /** 游戏结束 */
  private gameOver() {
    this.gameState.isPlaying = false

    // 显示游戏结束文字
    const { width, height } = this.scale
    this.add.text(width / 2, height / 2, 'GAME OVER', {
      fontFamily: 'Arial Black',
      fontSize: '64px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5)

    this.add.text(width / 2, height / 2 + 60, `Final Score: ${this.gameState.score}`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.add.text(width / 2, height / 2 + 100, `Waves Completed: ${this.gameState.wave - 1}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#cccccc',
    }).setOrigin(0.5)
  }

  /** 游戏主循环 */
  update() {
    if (!this.gameState.isPlaying || this.gameState.isPaused) {
      return
    }

    this.gameState.frame++

    // 更新所有怪物
    for (const monster of this.monsters) {
      if (monster.isValid && monster.progress >= 0) {
        monster.update()
      } else if (monster.progress < 0) {
        // 等待生成的怪物，增加进度
        const path = this.gridSystem.getCurrentPath()
        const totalPathLength = (path.length - 1) * GRID_SIZE
        monster.progress += monster.speed / totalPathLength
      }
    }

    // 渲染怪物
    for (const monster of this.monsters) {
      this.renderMonster(monster)
    }

    // 清理无效怪物
    this.cleanupMonsters()

    // 检查波次是否结束
    this.checkWaveComplete()

    // 更新 UI
    this.updateUI()
  }

  /** 暂停/恢复游戏 */
  togglePause() {
    this.gameState.isPaused = !this.gameState.isPaused
    EventBus.emit('game-paused', this.gameState.isPaused)
  }

  /** 获取游戏状态 */
  getGameState(): GameState {
    return { ...this.gameState }
  }
}
