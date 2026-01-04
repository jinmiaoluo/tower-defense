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
  renderBuildingSelection,
  BUILDING_COLORS,
  type RenderContext,
  type BuildingRenderData,
  type MonsterRenderData,
  type BulletRenderData,
  type SelectionRenderData,
} from '../render'
import { getTranslator } from '@/i18n'
import { getTheme, darkTheme } from '@/theme'
import { STORAGE_KEY as THEME_STORAGE_KEY } from '@/types/theme'
import { isMobileDevice } from '@/utils/device'
import { DPR } from '../dpr'

const { GRID_SIZE } = GAME_CONSTANTS

// 渲染用的缩放格子尺寸（适配高 DPR 显示）
const RENDER_GRID_SIZE = GRID_SIZE * DPR

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
  mobilePreviewPosition: Position | null
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

  // 移动设备标识
  private isMobile: boolean = isMobileDevice()

  // 建筑面板按钮文字（用于语言切换时更新）
  private buildingPanelTexts: Phaser.GameObjects.Text[] = []

  // 建筑面板按钮（用于选中状态更新）
  private buildingPanelButtons: Map<BuildingType, Phaser.GameObjects.Rectangle> = new Map()

  // 控制面板（暂停/重启按钮）
  private controlPanel!: Phaser.GameObjects.Container
  private pauseButton!: Phaser.GameObjects.Rectangle
  private pauseButtonText!: Phaser.GameObjects.Text
  private restartButton!: Phaser.GameObjects.Rectangle
  private restartButtonText!: Phaser.GameObjects.Text

  // 建筑操作面板（升级/出售按钮，选中建筑时显示）
  private buildingActionPanel!: Phaser.GameObjects.Container
  private upgradeButton!: Phaser.GameObjects.Rectangle
  private upgradeButtonText!: Phaser.GameObjects.Text
  private sellButton!: Phaser.GameObjects.Rectangle
  private sellButtonText!: Phaser.GameObjects.Text

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

      // 计算地图偏移（居中显示，考虑 UI 元素）
      const { width, height } = this.scale
      const mapWidth = this.gameConfig.map.width * RENDER_GRID_SIZE
      const mapHeight = this.gameConfig.map.height * RENDER_GRID_SIZE
      // 预留顶部状态栏和底部按钮面板的空间
      const topReserve = 50 * DPR
      const bottomReserve = 90 * DPR
      const availableHeight = height - topReserve - bottomReserve
      this.mapOffsetX = Math.floor((width - mapWidth) / 2)
      this.mapOffsetY = topReserve + Math.floor((availableHeight - mapHeight) / 2)

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
      this.createBuildingActionPanel()

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
      mobilePreviewPosition: null,
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
        this.updateBuildingActionPanel()
        this.updateBuildingPanelButtonStates()
        return
      }

      // 先检查是否点击了已有建筑（优先级高于放置新建筑）
      const buildings = this.logic.getBuildings()
      const clickedBuilding = buildings.find(
        (b) => b.position[0] === gridPos[0] && b.position[1] === gridPos[1],
      )

      if (clickedBuilding) {
        // 点击已有建筑：选中该建筑，取消放置模式
        this.uiState.selectedBuildingType = null
        this.uiState.selectedBuildingId = clickedBuilding.id
        this.uiState.mobilePreviewPosition = null
        this.updateBuildingActionPanel()
        this.updateBuildingPanelButtonStates()
        EventBus.emit('building-selected', clickedBuilding)
        return
      }

      // 如果选中了建筑类型且点击的是空地，尝试放置
      if (this.uiState.selectedBuildingType) {
        if (this.isMobile) {
          const preview = this.uiState.mobilePreviewPosition
          if (preview && preview[0] === gridPos[0] && preview[1] === gridPos[1]) {
            this.tryPlaceBuilding(gridPos)
            this.uiState.mobilePreviewPosition = null
          } else {
            this.uiState.mobilePreviewPosition = gridPos
          }
        } else {
          this.tryPlaceBuilding(gridPos)
        }
        return
      }

      // 点击空地且未选中建筑类型：取消选中
      this.uiState.selectedBuildingId = null
      this.updateBuildingActionPanel()
    })

    // 键盘快捷键
    this.input.keyboard?.on('keydown-ESC', () => {
      this.uiState.selectedBuildingType = null
      this.uiState.selectedBuildingId = null
      this.updateBuildingActionPanel()
      this.updateBuildingPanelButtonStates()
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

  /** 绘制虚线圆 */
  private strokeDashedCircle(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number,
    dashLength: number = 8,
    gapLength: number = 6,
  ) {
    const circumference = 2 * Math.PI * radius
    const totalLength = dashLength + gapLength
    const segments = Math.floor(circumference / totalLength)
    const dashAngle = (dashLength / circumference) * 2 * Math.PI
    const gapAngle = (gapLength / circumference) * 2 * Math.PI

    g.lineStyle(1, color, alpha)
    for (let i = 0; i < segments; i++) {
      const startAngle = i * (dashAngle + gapAngle)
      const endAngle = startAngle + dashAngle
      g.beginPath()
      g.arc(x, y, radius, startAngle, endAngle, false)
      g.strokePath()
    }
  }

  /** 屏幕坐标转格子坐标 */
  private screenToGrid(x: number, y: number): Position | null {
    const gx = Math.floor((x - this.mapOffsetX) / RENDER_GRID_SIZE)
    const gy = Math.floor((y - this.mapOffsetY) / RENDER_GRID_SIZE)

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
      const centerX = this.mapOffsetX + gx * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
      const centerY = this.mapOffsetY + gy * RENDER_GRID_SIZE
      this.showTooltip(this.t('entrance'), centerX, centerY)
      return
    }

    // 检查出口
    if (gx === exit[0] && gy === exit[1]) {
      const centerX = this.mapOffsetX + gx * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
      const centerY = this.mapOffsetY + gy * RENDER_GRID_SIZE
      this.showTooltip(this.t('exit'), centerX, centerY)
      return
    }

    // 检查怪物（包含血条区域）
    const monsters = this.logic.getMonsters()
    for (const monster of monsters) {
      if (!monster.isValid || monster.progress < 0) continue

      const pos = monster.getPixelPosition()
      const monsterX = this.mapOffsetX + pos.x * DPR
      const monsterY = this.mapOffsetY + pos.y * DPR
      const scaledRadius = monster.radius * DPR

      // 检测怪物身体（圆形）
      const distance = Math.sqrt(
        Math.pow(screenX - monsterX, 2) + Math.pow(screenY - monsterY, 2),
      )
      const isOverBody = distance <= scaledRadius

      // 检测血条区域（矩形：宽 22px，高约 20px，包含血条和可能的护盾条）
      const healthBarWidth = 22 * DPR
      const healthBarHeight = 20 * DPR
      const healthBarY = monsterY - scaledRadius - 12 * DPR
      const isOverHealthBar =
        screenX >= monsterX - healthBarWidth / 2 &&
        screenX <= monsterX + healthBarWidth / 2 &&
        screenY >= healthBarY - healthBarHeight &&
        screenY <= healthBarY + 4 * DPR

      if (isOverBody || isOverHealthBar) {
        const tooltipText = this.t('monster_tooltip', [
          Math.ceil(monster.currentLife),
          monster.maxLife,
          monster.shield ?? 0,
          monster.speed.toFixed(1),
          monster.damage,
          monster.money,
        ])
        this.showTooltip(tooltipText, monsterX, monsterY - scaledRadius)
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
    this.uiState.mobilePreviewPosition = null
    this.updateBuildingActionPanel()
    this.updateBuildingPanelButtonStates()
    EventBus.emit('building-type-selected', type)
  }

  /** 更新建筑面板按钮选中状态 */
  private updateBuildingPanelButtonStates() {
    const selectedType = this.uiState.selectedBuildingType
    const colors = this.getColors()

    this.buildingPanelButtons.forEach((button, type) => {
      if (type === selectedType) {
        // 选中状态：金色边框
        button.setStrokeStyle(2, colors.rangeSelected)
      } else {
        // 非选中状态：白色边框
        button.setStrokeStyle(2, 0xffffff)
      }
    })
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
        const tipX = this.mapOffsetX + position[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
        const tipY = this.mapOffsetY + position[1] * RENDER_GRID_SIZE - 20 * DPR
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
        const tipX = this.mapOffsetX + building.position[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
        const tipY = this.mapOffsetY + building.position[1] * RENDER_GRID_SIZE - 20 * DPR
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
      this.updateBuildingActionPanel()
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
        const px = this.mapOffsetX + x * RENDER_GRID_SIZE
        const py = this.mapOffsetY + y * RENDER_GRID_SIZE

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
        g.fillRect(px, py, RENDER_GRID_SIZE, RENDER_GRID_SIZE)

        g.lineStyle(1 * DPR, colors.gridLine, 0.5)
        g.strokeRect(px, py, RENDER_GRID_SIZE, RENDER_GRID_SIZE)
      }
    }

    // 入口标记
    const entranceX = this.mapOffsetX + entrance[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
    const entranceY = this.mapOffsetY + entrance[1] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
    g.lineStyle(2 * DPR, colors.entrance, 1)
    g.strokeCircle(entranceX, entranceY, RENDER_GRID_SIZE / 3)

    // 出口标记
    const exitX = this.mapOffsetX + exit[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
    const exitY = this.mapOffsetY + exit[1] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
    g.lineStyle(2 * DPR, colors.exit, 1)
    g.strokeCircle(exitX, exitY, RENDER_GRID_SIZE / 3)
  }

  /** 渲染路径 */
  private renderPath() {
    const g = this.pathGraphics
    const path = this.logic.getCurrentPath()
    const colors = this.getColors()

    g.clear()
    g.fillStyle(colors.path, 0.3)

    for (const [x, y] of path) {
      const px = this.mapOffsetX + x * RENDER_GRID_SIZE
      const py = this.mapOffsetY + y * RENDER_GRID_SIZE
      g.fillRect(px + 2 * DPR, py + 2 * DPR, RENDER_GRID_SIZE - 4 * DPR, RENDER_GRID_SIZE - 4 * DPR)
    }
  }

  /** 渲染所有建筑 */
  private renderBuildings() {
    const buildings = this.logic.getBuildings()

    this.buildingRenderCtx.clear()

    for (const building of buildings) {
      const [x, y] = building.position
      const px = this.mapOffsetX + x * RENDER_GRID_SIZE
      const py = this.mapOffsetY + y * RENDER_GRID_SIZE
      const centerX = px + RENDER_GRID_SIZE / 2
      const centerY = py + RENDER_GRID_SIZE / 2
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
        gridSize: RENDER_GRID_SIZE,
        isSelected,
        targetPosition,
      }

      renderBuilding(this.buildingRenderCtx, data)

      // 激光射线渲染（与旧实现一致: td-obj-building.js:361-376）
      // 只有当有实际目标时才渲染激光线
      if (building.type === 'laser_gun' && building.hasActiveTarget() && targetPosition) {
        const targetX = this.mapOffsetX + targetPosition[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
        const targetY = this.mapOffsetY + targetPosition[1] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2

        // 外层激光线（蓝色半透明）
        this.buildingRenderCtx.lineStyle(3 * DPR, 0x3232c8, 0.5)
        this.buildingRenderCtx.lineBetween(centerX, centerY, targetX, targetY)

        // 内层激光线（亮蓝色）
        this.buildingRenderCtx.lineStyle(1 * DPR, 0x9696ff, 0.5)
        this.buildingRenderCtx.lineBetween(centerX, centerY, targetX, targetY)
      }

      // 选中效果（金色范围圆 + 格子高亮，与旧实现一致）
      if (isSelected) {
        const selectionData: SelectionRenderData = {
          centerX,
          centerY,
          gridSize: RENDER_GRID_SIZE,
          range: building.getRange(),
          isWeapon: building.type !== 'wall',
          position: building.position,
        }
        const colors = this.getColors()
        renderBuildingSelection(this.buildingRenderCtx, selectionData, {
          rangeSelected: colors.rangeSelected,
          gridHighlight: colors.gridHighlight,
        })
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
      const x = this.mapOffsetX + pos.x * DPR
      const y = this.mapOffsetY + pos.y * DPR

      const data: MonsterRenderData = {
        id: monster.id,
        x,
        y,
        radius: monster.radius * DPR,
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

      const x = this.mapOffsetX + bullet.x * DPR
      const y = this.mapOffsetY + bullet.y * DPR

      const data: BulletRenderData = {
        x,
        y,
        radius: bullet.radius * DPR,
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

    if (!this.uiState.selectedBuildingType) {
      return
    }

    // 移动端使用 mobilePreviewPosition，PC 端使用 hoverPosition
    const previewPos = this.isMobile
      ? this.uiState.mobilePreviewPosition
      : this.uiState.hoverPosition

    if (!previewPos) {
      return
    }

    const [hx, hy] = previewPos
    const px = this.mapOffsetX + hx * RENDER_GRID_SIZE
    const py = this.mapOffsetY + hy * RENDER_GRID_SIZE

    const canPlace = this.logic.canPlaceBuilding(previewPos)
    const color = canPlace ? colors.hoverValid : colors.hoverInvalid

    // 预览建筑
    g.fillStyle(color, 0.3)
    g.fillRect(px + 4 * DPR, py + 4 * DPR, RENDER_GRID_SIZE - 8 * DPR, RENDER_GRID_SIZE - 8 * DPR)

    g.lineStyle(2 * DPR, color, 0.8)
    g.strokeRect(px + 4 * DPR, py + 4 * DPR, RENDER_GRID_SIZE - 8 * DPR, RENDER_GRID_SIZE - 8 * DPR)

    // 射程预览（虚线圆）
    if (this.uiState.selectedBuildingType !== 'wall') {
      const buildingConfig = this.gameConfig.buildings[this.uiState.selectedBuildingType]
      const range = buildingConfig.range * RENDER_GRID_SIZE
      const centerX = px + RENDER_GRID_SIZE / 2
      const centerY = py + RENDER_GRID_SIZE / 2

      this.strokeDashedCircle(g, centerX, centerY, range, colors.rangeDash, 0.6)
    }
  }

  /** 创建 UI */
  private createUI() {
    const { width } = this.scale

    this.uiText = this.add
      .text(width / 2, 10 * DPR, '', {
        fontFamily: 'Arial',
        fontSize: `${14 * DPR}px`,
        color: this.getColors().uiText,
        wordWrap: { width: width - 20 * DPR },
        align: 'center',
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
      fontSize: `${14 * DPR}px`,
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
      fontSize: `${12 * DPR}px`,
      color: '#ffffff',
      wordWrap: { width: 200 * DPR },
      align: 'left',
      lineSpacing: 2 * DPR,
    })
    this.tooltipText.setOrigin(0.5, 1)

    this.tooltipContainer.add([this.tooltipBackground, this.tooltipText])
  }

  /** 显示 Tooltip */
  private showTooltip(message: string, x: number, y: number, source: 'panel' | 'map' = 'map') {
    this.tooltipSource = source
    this.tooltipText.setText(message)

    const padding = 8 * DPR
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
    const padding = 10 * DPR
    const bgWidth = this.tipText.width + padding * 2
    const bgHeight = this.tipText.height + padding * 2

    // 绘制黄色背景（与旧实现一致）
    this.tipBackground.clear()
    this.tipBackground.fillStyle(0xffff00, 0.8)
    this.tipBackground.lineStyle(2 * DPR, 0xdede00, 1)
    this.tipBackground.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 4 * DPR)
    this.tipBackground.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 4 * DPR)

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

    this.buildingPanel = this.add.container(width / 2, height - 50 * DPR)
    this.buildingPanelTexts = []
    this.buildingPanelButtons.clear()

    const buildingTypes: BuildingType[] = ['LMG', 'cannon', 'HMG', 'laser_gun', 'wall']
    const buttonWidth = 70 * DPR
    const buttonHeight = 28 * DPR
    const gapX = 8 * DPR
    const gapY = 6 * DPR

    // 计算每行能放多少个按钮
    const availableWidth = width - 20 * DPR
    const buttonsPerRow = Math.max(2, Math.floor(availableWidth / (buttonWidth + gapX)))
    const rows = Math.ceil(buildingTypes.length / buttonsPerRow)

    buildingTypes.forEach((type, index) => {
      const row = Math.floor(index / buttonsPerRow)
      const col = index % buttonsPerRow
      const buttonsInThisRow = Math.min(buttonsPerRow, buildingTypes.length - row * buttonsPerRow)

      // 计算该行的起始 X 位置（居中）
      const rowWidth = buttonsInThisRow * buttonWidth + (buttonsInThisRow - 1) * gapX
      const rowStartX = -rowWidth / 2

      const x = rowStartX + col * (buttonWidth + gapX) + buttonWidth / 2
      const y = (row - (rows - 1) / 2) * (buttonHeight + gapY)

      const config = this.gameConfig.buildings[type]

      // 按钮背景
      const buttonColor = BUILDING_COLORS[type].primary
      const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, buttonColor, 0.8)
      button.setStrokeStyle(2 * DPR, 0xffffff)
      button.setInteractive({ useHandCursor: true })

      // 存储按钮引用
      this.buildingPanelButtons.set(type, button)

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
        const panelY = height - 50 * DPR
        const buttonScreenX = panelX + x
        const buttonScreenY = panelY + y - buttonHeight / 2
        this.showTooltip(tooltipText, buttonScreenX, buttonScreenY, 'panel')
      })

      button.on('pointerout', () => {
        // 如果当前按钮是选中状态，保持选中边框
        const isSelected = this.uiState.selectedBuildingType === type
        button.setFillStyle(buttonColor, 0.8)
        if (isSelected) {
          button.setStrokeStyle(2 * DPR, this.getColors().rangeSelected)
        }
        this.hideTooltip()
      })

      button.on('pointerdown', () => {
        this.selectBuildingType(type)
        this.hideTooltip()
      })

      // 按钮文字（使用 i18n 翻译）
      const buildingName = this.t(`building_name_${type}`)
      const text = this.add.text(x, y, `${buildingName}\n$${config.cost}`, {
        fontFamily: 'Arial',
        fontSize: `${9 * DPR}px`,
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
    this.controlPanel = this.add.container(width / 2, height - 10 * DPR)

    const buttonWidth = 70 * DPR
    const buttonHeight = 20 * DPR
    const gap = 10 * DPR

    // 暂停按钮
    const pauseX = -(buttonWidth + gap) / 2
    this.pauseButton = this.add.rectangle(pauseX, 0, buttonWidth, buttonHeight, 0x4488ff, 0.8)
    this.pauseButton.setStrokeStyle(1 * DPR, 0xffffff)
    this.pauseButton.setInteractive({ useHandCursor: true })

    this.pauseButtonText = this.add.text(pauseX, 0, this.t('button_pause_text'), {
      fontFamily: 'Arial',
      fontSize: `${11 * DPR}px`,
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
    this.restartButton.setStrokeStyle(1 * DPR, 0xffffff)
    this.restartButton.setInteractive({ useHandCursor: true })
    this.restartButton.setVisible(false)

    this.restartButtonText = this.add.text(restartX, 0, this.t('button_restart_text'), {
      fontFamily: 'Arial',
      fontSize: `${11 * DPR}px`,
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

  /** 创建建筑操作面板（选中建筑时显示升级/出售按钮） */
  private createBuildingActionPanel() {
    this.buildingActionPanel = this.add.container(0, 0)
    this.buildingActionPanel.setVisible(false)
    this.buildingActionPanel.setDepth(100)

    const buttonWidth = 80 * DPR
    const buttonHeight = 22 * DPR
    const gap = 6 * DPR

    // 升级按钮
    this.upgradeButton = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x44aa44, 0.9)
    this.upgradeButton.setStrokeStyle(1 * DPR, 0xffffff)
    this.upgradeButton.setInteractive({ useHandCursor: true })

    this.upgradeButtonText = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: `${10 * DPR}px`,
      color: '#ffffff',
    })
    this.upgradeButtonText.setOrigin(0.5, 0.5)

    this.upgradeButton.on('pointerover', () => {
      this.upgradeButton.setFillStyle(0x44aa44, 1)
      this.showBuildingActionTooltip('upgrade')
    })

    this.upgradeButton.on('pointerout', () => {
      this.upgradeButton.setFillStyle(0x44aa44, 0.9)
      this.hideTooltip('panel')
    })

    this.upgradeButton.on('pointerdown', () => {
      if (this.uiState.selectedBuildingId) {
        this.tryUpgradeBuilding(this.uiState.selectedBuildingId)
        this.updateBuildingActionPanel()
      }
    })

    // 出售按钮
    const sellX = buttonWidth + gap
    this.sellButton = this.add.rectangle(sellX, 0, buttonWidth, buttonHeight, 0xcc4444, 0.9)
    this.sellButton.setStrokeStyle(1 * DPR, 0xffffff)
    this.sellButton.setInteractive({ useHandCursor: true })

    this.sellButtonText = this.add.text(sellX, 0, '', {
      fontFamily: 'Arial',
      fontSize: `${10 * DPR}px`,
      color: '#ffffff',
    })
    this.sellButtonText.setOrigin(0.5, 0.5)

    this.sellButton.on('pointerover', () => {
      this.sellButton.setFillStyle(0xcc4444, 1)
      this.showBuildingActionTooltip('sell')
    })

    this.sellButton.on('pointerout', () => {
      this.sellButton.setFillStyle(0xcc4444, 0.9)
      this.hideTooltip('panel')
    })

    this.sellButton.on('pointerdown', () => {
      if (this.uiState.selectedBuildingId) {
        this.trySellBuilding(this.uiState.selectedBuildingId)
      }
    })

    this.buildingActionPanel.add([
      this.upgradeButton,
      this.upgradeButtonText,
      this.sellButton,
      this.sellButtonText,
    ])
  }

  /** 显示建筑操作的 Tooltip */
  private showBuildingActionTooltip(action: 'upgrade' | 'sell') {
    if (!this.uiState.selectedBuildingId) return

    const building = this.logic.getBuilding(this.uiState.selectedBuildingId)
    if (!building) return

    const buildingName = this.t(`building_name_${building.type}`)
    let tooltipText: string

    if (action === 'upgrade') {
      const cost = this.logic.getUpgradeCost(building.type, building.level)
      tooltipText = this.t('upgrade_tooltip', [buildingName, building.level + 1, cost])
    } else {
      const income = this.getSellIncome(building.type, building.level)
      tooltipText = this.t('sell_tooltip', [buildingName, income])
    }

    const panelPos = this.buildingActionPanel.getWorldTransformMatrix()
    const buttonWidth = 80 * DPR
    const gap = 6 * DPR
    const buttonX = action === 'upgrade' ? 0 : buttonWidth + gap
    this.showTooltip(tooltipText, panelPos.tx + buttonX, panelPos.ty - 20 * DPR, 'panel')
  }

  /** 获取出售收入（调用 BuildingSystem） */
  private getSellIncome(type: string, level: number): number {
    const buildingConfig = this.gameConfig.buildings[type as BuildingType]
    const totalCost = this.getTotalCost(type as BuildingType, level)
    const income = Math.floor(totalCost * buildingConfig.sellRatio)
    return Math.max(income, 1)
  }

  /** 获取建筑累计花费 */
  private getTotalCost(type: BuildingType, level: number): number {
    const buildingConfig = this.gameConfig.buildings[type]
    let total = buildingConfig.cost
    for (let l = 1; l < level; l++) {
      total += Math.floor(total * buildingConfig.upgradeCostRatio)
    }
    return total
  }

  /** 更新建筑操作面板的显示状态和位置 */
  private updateBuildingActionPanel() {
    // 面板尚未创建时跳过
    if (!this.buildingActionPanel) return

    if (!this.uiState.selectedBuildingId) {
      this.buildingActionPanel.setVisible(false)
      return
    }

    const building = this.logic.getBuilding(this.uiState.selectedBuildingId)
    if (!building) {
      this.buildingActionPanel.setVisible(false)
      return
    }

    // 计算面板位置（建筑格子上方）
    const [bx, by] = building.position
    const panelX = this.mapOffsetX + bx * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2 - 40 * DPR
    const panelY = this.mapOffsetY + by * RENDER_GRID_SIZE - 30 * DPR

    this.buildingActionPanel.setPosition(panelX, panelY)

    // 更新按钮文字
    const upgradeCost = this.logic.getUpgradeCost(building.type, building.level)
    this.upgradeButtonText.setText(`${this.t('button_upgrade_text')} $${upgradeCost}`)

    const sellIncome = this.getSellIncome(building.type, building.level)
    this.sellButtonText.setText(`${this.t('button_sell_text')} $${sellIncome}`)

    this.buildingActionPanel.setVisible(true)
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
    const buildings = this.logic.getBuildings()
    const monsters = this.logic.getMonsters()
    const aliveMonsters = monsters.filter((m) => m.isValid).length

    const statusText = [
      `${this.t('panel_money_title')}${state.money}`,
      `${this.t('panel_score_title')}${state.score}`,
      `${this.t('panel_life_title')}${state.life}`,
      `${this.t('panel_building_title')}${buildings.length}`,
      `${this.t('panel_monster_title')}${aliveMonsters}`,
    ].join(' | ')

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
    this.uiState.mobilePreviewPosition = null

    // 重置控制面板状态
    this.pauseButtonText.setText(this.t('button_pause_text'))
    this.restartButton.setVisible(false)
    this.restartButtonText.setVisible(false)

    // 隐藏建筑操作面板
    this.updateBuildingActionPanel()

    // 重置建筑面板按钮选中状态
    this.updateBuildingPanelButtonStates()

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
