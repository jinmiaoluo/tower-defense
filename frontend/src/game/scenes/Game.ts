/**
 * Game Scene - 游戏主场景
 * 整合 GameSceneLogic，负责渲染和用户交互
 * 逻辑层与渲染层分离，Game.ts 只负责渲染
 */

import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { AppEventBus } from '@/utils/EventEmitter'
import { createGameSceneLogic, type GameSceneLogic } from '../systems'
import { mockStartGame, mockSubmitWave } from '@/mocks/api'
import type { GameConfig, WaveConfig, Position, BuildingType, GameColors, ResolvedTheme } from '@/types'
import { GAME_CONSTANTS } from '@/types'
import {
  createPhaserAdapter,
  renderBuilding,
  renderMonster,
  renderBullet,
  BUILDING_COLORS,
  type RenderContext,
  type BuildingRenderData,
  type MonsterRenderData,
  type BulletRenderData,
} from '../render'
import { getTranslator } from '@/i18n'
import { getTheme, darkTheme } from '@/theme'
import { STORAGE_KEY as THEME_STORAGE_KEY, type ResolvedTheme as ThemeType } from '@/types/theme'

const { GRID_SIZE } = GAME_CONSTANTS

/** 波次间隔帧数 (60 FPS x 3 秒 = 180 帧) */
const WAVE_INTERVAL_FRAMES = 180

/** 游戏 UI 状态 */
interface UIState {
  isLoading: boolean
  waveIntervalCounter: number
  isSubmittingWave: boolean
  selectedBuildingType: BuildingType | null
  selectedBuildingId: string | null
  hoverPosition: Position | null
}

/** 提示消息持续时间 (毫秒) */
const TIP_DURATION = 2000

export class Game extends Scene {
  // 核心逻辑
  private logic!: GameSceneLogic

  // UI 状态
  private uiState!: UIState

  // 会话状态
  private sessionId: string = ''
  private gameConfig!: GameConfig
  private currentWaveConfig!: WaveConfig

  // 渲染对象
  private mapGraphics!: Phaser.GameObjects.Graphics
  private pathGraphics!: Phaser.GameObjects.Graphics
  private buildingGraphics!: Phaser.GameObjects.Graphics
  private monsterGraphics!: Phaser.GameObjects.Graphics
  private bulletGraphics!: Phaser.GameObjects.Graphics
  private hoverGraphics!: Phaser.GameObjects.Graphics
  private uiText!: Phaser.GameObjects.Text
  private buildingPanel!: Phaser.GameObjects.Container

  // 渲染上下文适配器
  private buildingRenderCtx!: RenderContext
  private monsterRenderCtx!: RenderContext
  private bulletRenderCtx!: RenderContext

  // 提示消息
  private tipContainer!: Phaser.GameObjects.Container
  private tipBackground!: Phaser.GameObjects.Graphics
  private tipText!: Phaser.GameObjects.Text
  private tipTimer: Phaser.Time.TimerEvent | null = null

  // Tooltip（悬停提示）
  private tooltipContainer!: Phaser.GameObjects.Container
  private tooltipBackground!: Phaser.GameObjects.Graphics
  private tooltipText!: Phaser.GameObjects.Text
  private tooltipSource: 'panel' | 'map' | null = null

  // 地图偏移（居中显示）
  private mapOffsetX = 0
  private mapOffsetY = 0

  // 翻译函数
  private t = getTranslator()

  // 当前主题颜色（从 localStorage 读取初始主题）
  private gameColors: GameColors = this.getInitialThemeColors()

  // 建筑面板按钮文字（用于语言切换时更新）
  private buildingPanelTexts: Phaser.GameObjects.Text[] = []

  // 控制面板（暂停/重启按钮）
  private controlPanel!: Phaser.GameObjects.Container
  private pauseButton!: Phaser.GameObjects.Rectangle
  private pauseButtonText!: Phaser.GameObjects.Text
  private restartButton!: Phaser.GameObjects.Rectangle
  private restartButtonText!: Phaser.GameObjects.Text

  constructor() {
    super('Game')
  }

  /** 获取初始主题颜色（从 localStorage 读取） */
  private getInitialThemeColors(): GameColors {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') {
        return getTheme(saved).gameColors
      }
      // system 模式：检测系统主题
      if (saved === 'system' && typeof window !== 'undefined') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        return getTheme(isDark ? 'dark' : 'light').gameColors
      }
    } catch {
      // localStorage 可能被禁用
    }
    return darkTheme.gameColors
  }

  /** 获取当前主题颜色 */
  private getColors(): GameColors {
    return this.gameColors
  }

  create() {
    // 初始化 UI 状态
    this.initUIState()

    // 设置初始 canvas 背景色（根据保存的主题）
    this.cameras.main.setBackgroundColor(this.gameColors.canvasBackground)

    // 创建渲染对象
    this.createRenderObjects()

    // 创建 UI
    this.createUI()

    // 设置输入事件
    this.setupInput()

    // 异步初始化游戏会话
    mockStartGame().then((response) => {
      this.sessionId = response.sessionId
      this.gameConfig = response.config
      this.currentWaveConfig = response.firstWave

      // 计算地图偏移（居中显示）
      const { width, height } = this.scale
      const mapWidth = this.gameConfig.map.width * GRID_SIZE
      const mapHeight = this.gameConfig.map.height * GRID_SIZE
      this.mapOffsetX = Math.floor((width - mapWidth) / 2)
      this.mapOffsetY = Math.floor((height - mapHeight) / 2) + 50

      // 创建核心逻辑
      this.logic = createGameSceneLogic(this.gameConfig)

      // 开始第一波
      this.logic.startWave(this.currentWaveConfig)

      this.uiState.isLoading = false

      // 渲染静态元素
      this.renderMap()
      this.renderPath()
      this.createBuildingPanel()
      this.createControlPanel()

      // 通知 Vue 场景已就绪
      EventBus.emit('current-scene-ready', this)
    })
  }

  /** 初始化 UI 状态 */
  private initUIState() {
    this.uiState = {
      isLoading: true,
      waveIntervalCounter: 0,
      isSubmittingWave: false,
      selectedBuildingType: null,
      selectedBuildingId: null,
      hoverPosition: null,
    }
  }

  /** 创建渲染对象 */
  private createRenderObjects() {
    this.mapGraphics = this.add.graphics()
    this.pathGraphics = this.add.graphics()
    this.buildingGraphics = this.add.graphics()
    this.monsterGraphics = this.add.graphics()
    this.bulletGraphics = this.add.graphics()
    this.hoverGraphics = this.add.graphics()

    // 创建渲染上下文适配器
    this.buildingRenderCtx = createPhaserAdapter(this.buildingGraphics)
    this.monsterRenderCtx = createPhaserAdapter(this.monsterGraphics)
    this.bulletRenderCtx = createPhaserAdapter(this.bulletGraphics)
  }

  /** 设置输入事件 */
  private setupInput() {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.uiState.isLoading) return

      const gridPos = this.screenToGrid(pointer.x, pointer.y)
      if (gridPos) {
        this.uiState.hoverPosition = gridPos
        this.checkMapElementTooltip(pointer.x, pointer.y, gridPos)
      } else {
        this.uiState.hoverPosition = null
        this.hideTooltip('map')
      }
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.uiState.isLoading) return

      // 检查是否点击在交互 UI 元素上（建筑面板按钮等）
      // hitTestPointer 返回指针位置下所有设置了 interactive 的游戏对象
      const hitObjects = this.input.hitTestPointer(pointer)
      if (hitObjects.length > 0) {
        // 点击了某个交互对象（如建筑面板按钮），不处理地图点击
        return
      }

      const gridPos = this.screenToGrid(pointer.x, pointer.y)
      if (!gridPos) {
        // 点击地图外且不在 UI 上，取消选择
        this.uiState.selectedBuildingType = null
        this.uiState.selectedBuildingId = null
        return
      }

      // 如果选中了建筑类型，尝试放置
      if (this.uiState.selectedBuildingType) {
        this.tryPlaceBuilding(gridPos)
        return
      }

      // 否则检查是否点击了已有建筑
      const buildings = this.logic.getBuildings()
      const clickedBuilding = buildings.find(
        (b) => b.position[0] === gridPos[0] && b.position[1] === gridPos[1],
      )

      if (clickedBuilding) {
        this.uiState.selectedBuildingId = clickedBuilding.id
        EventBus.emit('building-selected', clickedBuilding)
      } else {
        this.uiState.selectedBuildingId = null
      }
    })

    // 键盘快捷键
    this.input.keyboard?.on('keydown-ESC', () => {
      this.uiState.selectedBuildingType = null
      this.uiState.selectedBuildingId = null
    })

    this.input.keyboard?.on('keydown-ONE', () => {
      this.selectBuildingType('LMG')
    })

    this.input.keyboard?.on('keydown-TWO', () => {
      this.selectBuildingType('cannon')
    })

    this.input.keyboard?.on('keydown-THREE', () => {
      this.selectBuildingType('HMG')
    })

    this.input.keyboard?.on('keydown-FOUR', () => {
      this.selectBuildingType('laser_gun')
    })

    this.input.keyboard?.on('keydown-FIVE', () => {
      this.selectBuildingType('wall')
    })

    this.input.keyboard?.on('keydown-U', () => {
      if (this.uiState.selectedBuildingId) {
        this.tryUpgradeBuilding(this.uiState.selectedBuildingId)
      }
    })

    this.input.keyboard?.on('keydown-S', () => {
      if (this.uiState.selectedBuildingId) {
        this.trySellBuilding(this.uiState.selectedBuildingId)
      }
    })

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.logic) {
        this.handlePauseClick()
      }
    })

    // 监听重新开始事件
    EventBus.on('restart-game', () => {
      this.restart()
    })

    // 监听主题变化（来自 Vue 层的 AppEventBus）
    AppEventBus.on('theme-changed', (theme: unknown) => {
      this.handleThemeChange(theme as ResolvedTheme)
    })

    // 监听语言变化（来自 Vue 层的 AppEventBus）
    AppEventBus.on('locale-changed', (_locale: unknown) => {
      this.handleLocaleChange()
    })
  }

  /** 处理主题变化 */
  private handleThemeChange(theme: ResolvedTheme) {
    this.gameColors = getTheme(theme).gameColors
    // 更新 canvas 背景色
    this.cameras.main.setBackgroundColor(this.gameColors.canvasBackground)
    // 重新渲染需要主题颜色的元素
    if (!this.uiState.isLoading) {
      this.renderMap()
      this.renderPath()
      // 更新 UI 文本颜色
      this.uiText.setColor(this.gameColors.uiText)
    }
  }

  /** 处理语言变化 */
  private handleLocaleChange() {
    // 更新翻译函数
    this.t = getTranslator()
    // 更新建筑面板文字
    this.updateBuildingPanelTexts()
    // 更新控制面板文字
    this.updateControlPanelTexts()
    // 更新 UI 文字
    this.updateUI()
  }

  /** 更新建筑面板文字 */
  private updateBuildingPanelTexts() {
    if (!this.gameConfig) return

    const buildingTypes: BuildingType[] = ['LMG', 'cannon', 'HMG', 'laser_gun', 'wall']
    buildingTypes.forEach((type, index) => {
      if (this.buildingPanelTexts[index]) {
        const config = this.gameConfig.buildings[type]
        const buildingName = this.t(`building_name_${type}`)
        this.buildingPanelTexts[index].setText(`${buildingName}\n$${config.cost}`)
      }
    })
  }

  /** 更新控制面板文字 */
  private updateControlPanelTexts() {
    if (!this.pauseButtonText || !this.restartButtonText) return

    const state = this.logic?.getState()
    const isPaused = state?.isPaused ?? false

    // 根据当前状态设置暂停按钮文字
    this.pauseButtonText.setText(
      isPaused ? this.t('button_continue_text') : this.t('button_pause_text'),
    )
    this.restartButtonText.setText(this.t('button_restart_text'))
  }

  /** 屏幕坐标转格子坐标 */
  private screenToGrid(x: number, y: number): Position | null {
    const gx = Math.floor((x - this.mapOffsetX) / GRID_SIZE)
    const gy = Math.floor((y - this.mapOffsetY) / GRID_SIZE)

    if (
      gx >= 0 &&
      gx < this.gameConfig.map.width &&
      gy >= 0 &&
      gy < this.gameConfig.map.height
    ) {
      return [gx, gy]
    }
    return null
  }

  /** 检查地图元素的 tooltip（入口/出口/怪物） */
  private checkMapElementTooltip(screenX: number, screenY: number, gridPos: Position) {
    const [gx, gy] = gridPos
    const { entrance, exit } = this.gameConfig.map

    // 检查入口
    if (gx === entrance[0] && gy === entrance[1]) {
      const centerX = this.mapOffsetX + gx * GRID_SIZE + GRID_SIZE / 2
      const centerY = this.mapOffsetY + gy * GRID_SIZE
      this.showTooltip(this.t('entrance'), centerX, centerY)
      return
    }

    // 检查出口
    if (gx === exit[0] && gy === exit[1]) {
      const centerX = this.mapOffsetX + gx * GRID_SIZE + GRID_SIZE / 2
      const centerY = this.mapOffsetY + gy * GRID_SIZE
      this.showTooltip(this.t('exit'), centerX, centerY)
      return
    }

    // 检查怪物（包含血条区域）
    const monsters = this.logic.getMonsters()
    for (const monster of monsters) {
      if (!monster.isValid || monster.progress < 0) continue

      const pos = monster.getPixelPosition()
      const monsterX = this.mapOffsetX + pos.x
      const monsterY = this.mapOffsetY + pos.y

      // 检测怪物身体（圆形）
      const distance = Math.sqrt(
        Math.pow(screenX - monsterX, 2) + Math.pow(screenY - monsterY, 2),
      )
      const isOverBody = distance <= monster.radius

      // 检测血条区域（矩形：宽 22px，高约 20px，包含血条和可能的护盾条）
      const healthBarWidth = 22
      const healthBarHeight = 20
      const healthBarY = monsterY - monster.radius - 12
      const isOverHealthBar =
        screenX >= monsterX - healthBarWidth / 2 &&
        screenX <= monsterX + healthBarWidth / 2 &&
        screenY >= healthBarY - healthBarHeight &&
        screenY <= healthBarY + 4

      if (isOverBody || isOverHealthBar) {
        const tooltipText = this.t('monster_tooltip', [
          Math.ceil(monster.currentLife),
          monster.maxLife,
          monster.shield ?? 0,
          monster.speed.toFixed(1),
          monster.damage,
          monster.money,
        ])
        this.showTooltip(tooltipText, monsterX, monsterY - monster.radius)
        return
      }
    }

    // 不在任何地图元素上时隐藏地图 tooltip（不影响建筑面板的 tooltip）
    this.hideTooltip('map')
  }

  /** 选择建筑类型 */
  selectBuildingType(type: BuildingType | null) {
    this.uiState.selectedBuildingType = type
    this.uiState.selectedBuildingId = null
    EventBus.emit('building-type-selected', type)
  }

  /** 尝试放置建筑 */
  private tryPlaceBuilding(position: Position) {
    if (!this.uiState.selectedBuildingType) return

    const result = this.logic.placeBuilding(
      position,
      this.uiState.selectedBuildingType,
    )

    if (result.success) {
      EventBus.emit('building-placed', {
        id: result.buildingId,
        type: this.uiState.selectedBuildingType,
        position,
      })
      this.renderPath()
    } else {
      // 显示提示消息
      if (result.reason === 'insufficient_money') {
        const cost = this.gameConfig.buildings[this.uiState.selectedBuildingType].cost
        const tipX = this.mapOffsetX + position[0] * GRID_SIZE + GRID_SIZE / 2
        const tipY = this.mapOffsetY + position[1] * GRID_SIZE - 20
        this.showTip(`金钱不足，需要 $${cost}!`, tipX, tipY)
      }
      EventBus.emit('building-place-failed', result.reason)
    }
  }

  /** 尝试升级建筑 */
  tryUpgradeBuilding(buildingId: string) {
    const building = this.logic.getBuilding(buildingId)
    const result = this.logic.upgradeBuilding(buildingId)
    if (result.success) {
      EventBus.emit('building-upgraded', this.logic.getBuilding(buildingId))
    } else {
      // 显示提示消息
      if (result.reason === 'insufficient_money' && building) {
        const cost = this.logic.getUpgradeCost(building.type, building.level)
        const tipX = this.mapOffsetX + building.position[0] * GRID_SIZE + GRID_SIZE / 2
        const tipY = this.mapOffsetY + building.position[1] * GRID_SIZE - 20
        this.showTip(`金钱不足，需要 $${cost}!`, tipX, tipY)
      }
      EventBus.emit('building-upgrade-failed', result.reason)
    }
  }

  /** 尝试出售建筑 */
  trySellBuilding(buildingId: string) {
    const result = this.logic.sellBuilding(buildingId)
    if (result.success) {
      this.uiState.selectedBuildingId = null
      this.renderPath()
      EventBus.emit('building-sold', buildingId)
    } else {
      EventBus.emit('building-sell-failed', result.reason)
    }
  }

  /** 渲染地图 */
  private renderMap() {
    const { width, height, entrance, exit, obstacles } = this.gameConfig.map
    const g = this.mapGraphics
    const colors = this.getColors()

    g.clear()

    // 绘制格子
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = this.mapOffsetX + x * GRID_SIZE
        const py = this.mapOffsetY + y * GRID_SIZE

        let fillColor = colors.gridFill
        const isEntrance = x === entrance[0] && y === entrance[1]
        const isExit = x === exit[0] && y === exit[1]
        const isObstacle = obstacles.some(
          ([ox, oy]) => ox === x && oy === y,
        )

        if (isEntrance) {
          fillColor = colors.entrance
        } else if (isExit) {
          fillColor = colors.exit
        } else if (isObstacle) {
          fillColor = colors.obstacle
        }

        g.fillStyle(fillColor, isEntrance || isExit ? 0.5 : 1)
        g.fillRect(px, py, GRID_SIZE, GRID_SIZE)

        g.lineStyle(1, colors.gridLine, 0.5)
        g.strokeRect(px, py, GRID_SIZE, GRID_SIZE)
      }
    }

    // 入口标记
    const entranceX = this.mapOffsetX + entrance[0] * GRID_SIZE + GRID_SIZE / 2
    const entranceY = this.mapOffsetY + entrance[1] * GRID_SIZE + GRID_SIZE / 2
    g.lineStyle(2, colors.entrance, 1)
    g.strokeCircle(entranceX, entranceY, GRID_SIZE / 3)

    // 出口标记
    const exitX = this.mapOffsetX + exit[0] * GRID_SIZE + GRID_SIZE / 2
    const exitY = this.mapOffsetY + exit[1] * GRID_SIZE + GRID_SIZE / 2
    g.lineStyle(2, colors.exit, 1)
    g.strokeCircle(exitX, exitY, GRID_SIZE / 3)
  }

  /** 渲染路径 */
  private renderPath() {
    const g = this.pathGraphics
    const path = this.logic.getCurrentPath()
    const colors = this.getColors()

    g.clear()
    g.fillStyle(colors.path, 0.3)

    for (const [x, y] of path) {
      const px = this.mapOffsetX + x * GRID_SIZE
      const py = this.mapOffsetY + y * GRID_SIZE
      g.fillRect(px + 2, py + 2, GRID_SIZE - 4, GRID_SIZE - 4)
    }
  }

  /** 渲染所有建筑 */
  private renderBuildings() {
    const buildings = this.logic.getBuildings()

    this.buildingRenderCtx.clear()

    for (const building of buildings) {
      const [x, y] = building.position
      const px = this.mapOffsetX + x * GRID_SIZE
      const py = this.mapOffsetY + y * GRID_SIZE
      const centerX = px + GRID_SIZE / 2
      const centerY = py + GRID_SIZE / 2
      const isSelected = building.id === this.uiState.selectedBuildingId

      // 获取建筑当前目标位置（由 Building 实体维护，包含最后目标位置）
      const targetPosition = building.getCurrentTargetPosition() ?? undefined

      const data: BuildingRenderData = {
        id: building.id,
        type: building.type,
        position: building.position,
        level: building.level,
        centerX,
        centerY,
        gridSize: GRID_SIZE,
        isSelected,
        targetPosition,
      }

      renderBuilding(this.buildingRenderCtx, data)

      // 激光射线渲染（与旧实现一致: td-obj-building.js:361-376）
      // 只有当有实际目标时才渲染激光线
      if (building.type === 'laser_gun' && building.hasActiveTarget() && targetPosition) {
        const targetX = this.mapOffsetX + targetPosition[0] * GRID_SIZE + GRID_SIZE / 2
        const targetY = this.mapOffsetY + targetPosition[1] * GRID_SIZE + GRID_SIZE / 2

        // 外层激光线（蓝色半透明）
        this.buildingRenderCtx.lineStyle(3, 0x3232c8, 0.5)
        this.buildingRenderCtx.lineBetween(centerX, centerY, targetX, targetY)

        // 内层激光线（亮蓝色）
        this.buildingRenderCtx.lineStyle(1, 0x9696ff, 0.5)
        this.buildingRenderCtx.lineBetween(centerX, centerY, targetX, targetY)
      }

      // 射程指示（选中时显示）
      if (isSelected && building.type !== 'wall') {
        const range = building.getRange() * GRID_SIZE
        this.buildingRenderCtx.lineStyle(1, this.getColors().selected, 0.3)
        this.buildingRenderCtx.strokeCircle(centerX, centerY, range)
      }
    }
  }

  /** 渲染所有怪物 */
  private renderMonsters() {
    const monsters = this.logic.getMonsters()

    this.monsterRenderCtx.clear()

    for (const monster of monsters) {
      if (!monster.isValid || monster.progress < 0) continue

      const pos = monster.getPixelPosition()
      const x = this.mapOffsetX + pos.x
      const y = this.mapOffsetY + pos.y

      const data: MonsterRenderData = {
        id: monster.id,
        x,
        y,
        radius: monster.radius,
        color: monster.color,
        currentLife: monster.currentLife,
        maxLife: monster.maxLife,
        shield: monster.shield ?? 0,
      }

      renderMonster(this.monsterRenderCtx, data)
    }
  }

  /** 渲染所有子弹 */
  private renderBullets() {
    const bullets = this.logic.getBullets()

    this.bulletRenderCtx.clear()

    for (const bullet of bullets) {
      if (!bullet.isValid) continue

      const x = this.mapOffsetX + bullet.x
      const y = this.mapOffsetY + bullet.y

      const data: BulletRenderData = {
        x,
        y,
        radius: bullet.radius,
        vx: bullet.vx,
        vy: bullet.vy,
      }

      renderBullet(this.bulletRenderCtx, data)
    }
  }

  /** 渲染悬停指示 */
  private renderHover() {
    const g = this.hoverGraphics
    const colors = this.getColors()
    g.clear()

    if (
      !this.uiState.selectedBuildingType ||
      !this.uiState.hoverPosition
    ) {
      return
    }

    const [hx, hy] = this.uiState.hoverPosition
    const px = this.mapOffsetX + hx * GRID_SIZE
    const py = this.mapOffsetY + hy * GRID_SIZE

    const canPlace = this.logic.canPlaceBuilding(this.uiState.hoverPosition)
    const color = canPlace ? colors.hoverValid : colors.hoverInvalid

    // 预览建筑
    g.fillStyle(color, 0.3)
    g.fillRect(px + 4, py + 4, GRID_SIZE - 8, GRID_SIZE - 8)

    g.lineStyle(2, color, 0.8)
    g.strokeRect(px + 4, py + 4, GRID_SIZE - 8, GRID_SIZE - 8)

    // 射程预览
    if (this.uiState.selectedBuildingType !== 'wall') {
      const buildingConfig = this.gameConfig.buildings[this.uiState.selectedBuildingType]
      const range = buildingConfig.range * GRID_SIZE
      const centerX = px + GRID_SIZE / 2
      const centerY = py + GRID_SIZE / 2

      g.lineStyle(1, color, 0.3)
      g.strokeCircle(centerX, centerY, range)
    }
  }

  /** 创建 UI */
  private createUI() {
    const { width } = this.scale

    this.uiText = this.add
      .text(width / 2, 20, '', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: this.getColors().uiText,
      })
      .setOrigin(0.5, 0)

    // 创建提示容器
    this.createTipContainer()

    // 创建 Tooltip 容器
    this.createTooltipContainer()

    this.updateUI()
  }

  /** 创建提示容器 */
  private createTipContainer() {
    const { width, height } = this.scale

    this.tipContainer = this.add.container(width / 2, height / 2)
    this.tipContainer.setVisible(false)
    this.tipContainer.setDepth(1000)

    this.tipBackground = this.add.graphics()
    this.tipText = this.add.text(0, 0, '', {
      fontFamily: 'Courier New',
      fontSize: '14px',
      color: '#000000',
    })
    this.tipText.setOrigin(0.5, 0.5)

    this.tipContainer.add([this.tipBackground, this.tipText])
  }

  /** 创建 Tooltip 容器 */
  private createTooltipContainer() {
    this.tooltipContainer = this.add.container(0, 0)
    this.tooltipContainer.setVisible(false)
    this.tooltipContainer.setDepth(1001)

    this.tooltipBackground = this.add.graphics()
    this.tooltipText = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffffff',
      wordWrap: { width: 200 },
      align: 'left',
      lineSpacing: 2,
    })
    this.tooltipText.setOrigin(0.5, 1)

    this.tooltipContainer.add([this.tooltipBackground, this.tooltipText])
  }

  /** 显示 Tooltip */
  private showTooltip(message: string, x: number, y: number, source: 'panel' | 'map' = 'map') {
    this.tooltipSource = source
    this.tooltipText.setText(message)

    const padding = 8
    const bgWidth = this.tooltipText.width + padding * 2
    const bgHeight = this.tooltipText.height + padding * 2

    // 将文本上移 padding 像素，使其在背景中垂直居中
    this.tooltipText.setPosition(0, -padding)

    this.tooltipBackground.clear()
    this.tooltipBackground.fillStyle(0x333333, 0.9)
    this.tooltipBackground.lineStyle(1, 0x666666, 1)
    this.tooltipBackground.fillRoundedRect(-bgWidth / 2, -bgHeight, bgWidth, bgHeight, 4)
    this.tooltipBackground.strokeRoundedRect(-bgWidth / 2, -bgHeight, bgWidth, bgHeight, 4)

    this.tooltipContainer.setPosition(x, y - 10)
    this.tooltipContainer.setVisible(true)
  }

  /** 隐藏 Tooltip（仅隐藏指定来源的 tooltip，不指定则强制隐藏） */
  private hideTooltip(source?: 'panel' | 'map') {
    if (source && this.tooltipSource !== source) {
      return
    }
    this.tooltipContainer.setVisible(false)
    this.tooltipSource = null
  }

  /** 显示提示消息 */
  private showTip(message: string, x?: number, y?: number) {
    const { width, height } = this.scale

    // 设置文本
    this.tipText.setText(message)

    // 计算背景尺寸
    const padding = 10
    const bgWidth = this.tipText.width + padding * 2
    const bgHeight = this.tipText.height + padding * 2

    // 绘制黄色背景（与旧实现一致）
    this.tipBackground.clear()
    this.tipBackground.fillStyle(0xffff00, 0.8)
    this.tipBackground.lineStyle(2, 0xdede00, 1)
    this.tipBackground.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 4)
    this.tipBackground.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 4)

    // 设置位置
    const posX = x ?? width / 2
    const posY = y ?? height / 2
    this.tipContainer.setPosition(posX, posY)

    // 显示
    this.tipContainer.setVisible(true)

    // 清除之前的定时器
    if (this.tipTimer) {
      this.tipTimer.destroy()
    }

    // 自动隐藏
    this.tipTimer = this.time.delayedCall(TIP_DURATION, () => {
      this.tipContainer.setVisible(false)
    })
  }

  /** 创建建筑面板 */
  private createBuildingPanel() {
    const { width, height } = this.scale

    this.buildingPanel = this.add.container(width / 2, height - 40)
    this.buildingPanelTexts = []

    const buildingTypes: BuildingType[] = ['LMG', 'cannon', 'HMG', 'laser_gun', 'wall']
    const buttonWidth = 80
    const buttonHeight = 30
    const gap = 10
    const startX = -((buildingTypes.length * (buttonWidth + gap) - gap) / 2)

    buildingTypes.forEach((type, index) => {
      const x = startX + index * (buttonWidth + gap) + buttonWidth / 2
      const config = this.gameConfig.buildings[type]

      // 按钮背景
      const buttonColor = BUILDING_COLORS[type].primary
      const button = this.add.rectangle(x, 0, buttonWidth, buttonHeight, buttonColor, 0.8)
      button.setStrokeStyle(2, 0xffffff)
      button.setInteractive({ useHandCursor: true })

      button.on('pointerover', () => {
        button.setFillStyle(buttonColor, 1)
        // 显示建筑介绍 tooltip
        const buildingName = this.t(`building_name_${type}`)
        let tooltipText: string
        if (type === 'wall') {
          tooltipText = this.t('building_tooltip_wall', [buildingName, config.cost])
        } else {
          tooltipText = this.t('building_tooltip_weapon', [
            buildingName,
            config.cost,
            config.damage,
            config.speed,
            config.range,
          ])
        }
        const panelX = width / 2
        const panelY = height - 40
        const buttonScreenX = panelX + x
        const buttonScreenY = panelY - buttonHeight / 2
        this.showTooltip(tooltipText, buttonScreenX, buttonScreenY, 'panel')
      })

      button.on('pointerout', () => {
        button.setFillStyle(buttonColor, 0.8)
        this.hideTooltip()
      })

      button.on('pointerdown', () => {
        this.selectBuildingType(type)
        this.hideTooltip()
      })

      // 按钮文字（使用 i18n 翻译）
      const buildingName = this.t(`building_name_${type}`)
      const text = this.add.text(x, 0, `${buildingName}\n$${config.cost}`, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#ffffff',
        align: 'center',
      })
      text.setOrigin(0.5, 0.5)

      this.buildingPanelTexts.push(text)
      this.buildingPanel.add([button, text])
    })
  }

  /** 创建控制面板（暂停/重启按钮） */
  private createControlPanel() {
    const { width, height } = this.scale

    // 控制面板位于建筑面板下方
    this.controlPanel = this.add.container(width / 2, height - 8)

    const buttonWidth = 70
    const buttonHeight = 20
    const gap = 10

    // 暂停按钮
    const pauseX = -(buttonWidth + gap) / 2
    this.pauseButton = this.add.rectangle(pauseX, 0, buttonWidth, buttonHeight, 0x4488ff, 0.8)
    this.pauseButton.setStrokeStyle(1, 0xffffff)
    this.pauseButton.setInteractive({ useHandCursor: true })

    this.pauseButtonText = this.add.text(pauseX, 0, this.t('button_pause_text'), {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#ffffff',
    })
    this.pauseButtonText.setOrigin(0.5, 0.5)

    this.pauseButton.on('pointerover', () => {
      this.pauseButton.setFillStyle(0x4488ff, 1)
    })

    this.pauseButton.on('pointerout', () => {
      this.pauseButton.setFillStyle(0x4488ff, 0.8)
    })

    this.pauseButton.on('pointerdown', () => {
      this.handlePauseClick()
    })

    // 重启按钮（初始隐藏，仅在暂停时显示）
    const restartX = (buttonWidth + gap) / 2
    this.restartButton = this.add.rectangle(restartX, 0, buttonWidth, buttonHeight, 0xff6644, 0.8)
    this.restartButton.setStrokeStyle(1, 0xffffff)
    this.restartButton.setInteractive({ useHandCursor: true })
    this.restartButton.setVisible(false)

    this.restartButtonText = this.add.text(restartX, 0, this.t('button_restart_text'), {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#ffffff',
    })
    this.restartButtonText.setOrigin(0.5, 0.5)
    this.restartButtonText.setVisible(false)

    this.restartButton.on('pointerover', () => {
      this.restartButton.setFillStyle(0xff6644, 1)
    })

    this.restartButton.on('pointerout', () => {
      this.restartButton.setFillStyle(0xff6644, 0.8)
    })

    this.restartButton.on('pointerdown', () => {
      this.restart()
    })

    this.controlPanel.add([
      this.pauseButton,
      this.pauseButtonText,
      this.restartButton,
      this.restartButtonText,
    ])
  }

  /** 处理暂停按钮点击 */
  private handlePauseClick() {
    const state = this.logic.getState()

    if (state.isPaused) {
      // 当前是暂停状态，点击继续游戏
      this.logic.togglePause()
      this.pauseButtonText.setText(this.t('button_pause_text'))
      this.restartButton.setVisible(false)
      this.restartButtonText.setVisible(false)
    } else {
      // 当前是运行状态，点击暂停游戏
      this.logic.togglePause()
      this.pauseButtonText.setText(this.t('button_continue_text'))
      this.restartButton.setVisible(true)
      this.restartButtonText.setVisible(true)
    }

    EventBus.emit('game-paused', this.logic.getState().isPaused)
  }

  /** 更新 UI 显示 */
  private updateUI() {
    if (this.uiState.isLoading) {
      this.uiText.setText(this.t('loading'))
      return
    }

    const state = this.logic.getState()
    const monsters = this.logic.getMonsters()
    const aliveMonsters = monsters.filter((m) => m.isValid).length

    let statusText = `${this.t('wave_info', [state.wave])} | ${this.t('panel_money_title')}${state.money} | ${this.t('panel_life_title')}${state.life} | ${this.t('panel_score_title')}${state.score} | ${this.t('panel_monster_title')}${aliveMonsters}`

    if (state.isPaused) {
      statusText += ` | ${this.t('paused')}`
    }

    if (this.uiState.waveIntervalCounter > 0) {
      const secondsLeft = Math.ceil(this.uiState.waveIntervalCounter / 60)
      statusText += ` | ${this.t('next_wave_in', [secondsLeft])}`
    }

    if (this.uiState.selectedBuildingType) {
      const buildingName = this.t(`building_name_${this.uiState.selectedBuildingType}`)
      statusText += ` | ${this.t('selected', [buildingName])}`
    }

    this.uiText.setText(statusText)
  }

  /** 检查波次是否结束并处理 */
  private checkWaveComplete() {
    if (this.uiState.isSubmittingWave) return

    if (this.logic.isWaveComplete()) {
      if (this.uiState.waveIntervalCounter === 0) {
        this.uiState.isSubmittingWave = true
        this.submitWaveResult()
        return
      }

      this.uiState.waveIntervalCounter--

      if (this.uiState.waveIntervalCounter === 0) {
        this.logic.startWave(this.currentWaveConfig)
        this.renderPath()
      }
    }
  }

  /** 提交波次结果到服务端 */
  private submitWaveResult() {
    const state = this.logic.getState()
    const waveRecorder = this.logic.getWaveRecorder()
    const buildings = this.logic.getBuildings()

    const buildingSnapshots = buildings.map((b) => ({
      id: b.id,
      type: b.type,
      position: b.position,
      level: b.level,
      damageDealt: b.damageDealt,
      kills: b.kills,
    }))

    mockSubmitWave(
      waveRecorder.toWaveRequest(this.sessionId, buildingSnapshots),
    ).then((response) => {
      if (!response.valid) {
        console.error('Wave validation failed:', response.error)
        this.uiState.isSubmittingWave = false
        return
      }

      // 检查游戏是否结束
      if (state.life <= 0 || !response.nextWave) {
        this.gameOver()
        return
      }

      // 保存下一波配置
      this.currentWaveConfig = response.nextWave

      // 开始波次间隔倒计时
      this.uiState.waveIntervalCounter = WAVE_INTERVAL_FRAMES
      this.uiState.isSubmittingWave = false
    })
  }

  /** 游戏结束 */
  private gameOver() {
    const state = this.logic.getState()
    const waveRecorder = this.logic.getWaveRecorder()
    const buildings = this.logic.getBuildings()

    // 获取最后一波结果
    const lastWaveResult = waveRecorder.getResult()

    // 转换建筑列表为快照格式
    const buildingSnapshots = buildings.map((b) => ({
      id: b.id,
      type: b.type,
      position: b.position,
      level: b.level,
      damageDealt: 0,
      kills: 0,
    }))

    // 发送游戏结束事件到 Vue 层（不再在画布上绘制文字）
    EventBus.emit('game-over', {
      score: state.score,
      wave: state.wave,
      sessionId: this.sessionId,
      lastWaveResult,
      buildings: buildingSnapshots,
    })
  }

  /** 游戏主循环 */
  update() {
    if (this.uiState.isLoading) return

    const state = this.logic.getState()

    if (state.isGameOver) return

    // 更新逻辑
    this.logic.update()

    // 渲染
    this.renderBuildings()
    this.renderMonsters()
    this.renderBullets()
    this.renderHover()
    this.updateUI()

    // 检查波次完成
    this.checkWaveComplete()
  }

  /** 暂停/恢复游戏 */
  togglePause() {
    if (this.logic) {
      this.logic.togglePause()
      EventBus.emit('game-paused', this.logic.getState().isPaused)
    }
  }

  /** 获取游戏状态 */
  getGameState() {
    if (this.logic) {
      return this.logic.getState()
    }
    return null
  }

  /** 重新开始游戏 */
  async restart() {
    // 设置加载状态
    this.uiState.isLoading = true
    this.uiState.waveIntervalCounter = 0
    this.uiState.isSubmittingWave = false
    this.uiState.selectedBuildingType = null
    this.uiState.selectedBuildingId = null
    this.uiState.hoverPosition = null

    // 重置控制面板状态
    this.pauseButtonText.setText(this.t('button_pause_text'))
    this.restartButton.setVisible(false)
    this.restartButtonText.setVisible(false)

    // 清除渲染
    this.buildingGraphics.clear()
    this.monsterGraphics.clear()
    this.bulletGraphics.clear()
    this.hoverGraphics.clear()

    try {
      // 请求新的游戏会话
      const response = await mockStartGame()

      this.sessionId = response.sessionId
      this.gameConfig = response.config
      this.currentWaveConfig = response.firstWave

      // 重置核心逻辑
      this.logic.reset()

      // 开始第一波
      this.logic.startWave(this.currentWaveConfig)

      this.uiState.isLoading = false

      // 重新渲染静态元素
      this.renderMap()
      this.renderPath()

      // 通知重新开始完成
      EventBus.emit('game-restarted')
    } catch (error) {
      console.error('Failed to restart game:', error)
      this.uiState.isLoading = false
    }
  }
}
