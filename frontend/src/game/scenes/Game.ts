/**
 * Game Scene - Main game scene
 * Integrates GameSceneLogic, handles rendering and user interaction
 * Logic layer and rendering layer are separated; Game.ts only handles rendering
 */

import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { AppEventBus } from '@/utils/EventEmitter'
import { createGameSceneLogic, type GameSceneLogic } from '../systems'
import { gameApi, ApiError } from '@/api'
import type { GameConfig, WaveConfig, Position, BuildingType, GameColors, Theme } from '@/types'
import { GAME_CONSTANTS, isWeaponBuilding } from '@/types'
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
import { getTheme, getInitialGameColors } from '@/theme'
import { isMobileDevice } from '@/utils/device'
import { DPR } from '../dpr'

const { GRID_SIZE } = GAME_CONSTANTS

// Scaled grid size for rendering (adapts to high DPR displays)
const RENDER_GRID_SIZE = GRID_SIZE * DPR

/** Wave interval in frames (60 FPS x 3 seconds = 180 frames) */
const WAVE_INTERVAL_FRAMES = 180

/** Stats card color configuration */
const STATS_CARD_COLORS = {
  money: 0xf5a623,
  score: 0x9b59b6,
  life: 0xe74c3c,
  buildings: 0x27ae60,
  monsters: 0xe67e22,
} as const

/** Data structure for a single stats card */
interface StatsCard {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Graphics
  colorBar: Phaser.GameObjects.Graphics
  labelText: Phaser.GameObjects.Text
  valueText: Phaser.GameObjects.Text
}

/** Game UI state */
interface UIState {
  isLoading: boolean
  waveIntervalCounter: number
  isSubmittingWave: boolean
  waitingForFirstWeapon: boolean
  firstWaveRecorderPrepared: boolean
  currentWaveSubmitted: boolean
  selectedBuildingType: BuildingType | null
  selectedBuildingId: string | null
  hoverPosition: Position | null
  mobilePreviewPosition: Position | null
}

/** Tip message duration (milliseconds) */
const TIP_DURATION = 2000

export class Game extends Scene {
  // Core logic
  private logic!: GameSceneLogic

  // UI state
  private uiState!: UIState

  // Session state
  private sessionId: string = ''
  private gameConfig!: GameConfig
  private currentWaveConfig!: WaveConfig

  // Render objects
  private mapGraphics!: Phaser.GameObjects.Graphics
  private buildingGraphics!: Phaser.GameObjects.Graphics
  private monsterGraphics!: Phaser.GameObjects.Graphics
  private bulletGraphics!: Phaser.GameObjects.Graphics
  private hoverGraphics!: Phaser.GameObjects.Graphics
  private buildingPanel!: Phaser.GameObjects.Container

  // Stats card container
  private statsContainer!: Phaser.GameObjects.Container
  private statsCards!: {
    money: StatsCard
    score: StatsCard
    life: StatsCard
    buildings: StatsCard
    monsters: StatsCard
  }

  // Render context adapters
  private buildingRenderCtx!: RenderContext
  private monsterRenderCtx!: RenderContext
  private bulletRenderCtx!: RenderContext

  // Tip message
  private tipContainer!: Phaser.GameObjects.Container
  private tipBackground!: Phaser.GameObjects.Graphics
  private tipText!: Phaser.GameObjects.Text
  private tipTimer: Phaser.Time.TimerEvent | null = null

  // Tooltip (hover hint)
  private tooltipContainer!: Phaser.GameObjects.Container
  private tooltipBackground!: Phaser.GameObjects.Graphics
  private tooltipText!: Phaser.GameObjects.Text
  private tooltipSource: 'panel' | 'map' | null = null

  // Map offset (for centering)
  private mapOffsetX = 0
  private mapOffsetY = 0

  // Translation function
  private t = getTranslator()

  // Current theme colors (read initial theme from localStorage)
  private gameColors: GameColors = this.getInitialThemeColors()

  // Mobile device flag
  private isMobile: boolean = isMobileDevice()

  // Building panel button texts (for updating on language switch)
  private buildingPanelTexts: Phaser.GameObjects.Text[] = []

  // Building panel buttons (for selected state updates)
  private buildingPanelButtons: Map<BuildingType, Phaser.GameObjects.Rectangle> = new Map()

  // Page visibility change handlers (for auto pause/resume)
  private visibilityChangeHandler: (() => void) | null = null
  private pageHideHandler: (() => void) | null = null
  private pageShowHandler: ((event: PageTransitionEvent) => void) | null = null
  private wasAutoPaused: boolean = false

  // Control panel (pause/restart/end buttons)
  private controlPanel!: Phaser.GameObjects.Container
  private pauseButton!: Phaser.GameObjects.Rectangle
  private pauseButtonText!: Phaser.GameObjects.Text
  private restartButton!: Phaser.GameObjects.Rectangle
  private restartButtonText!: Phaser.GameObjects.Text
  private endGameButton!: Phaser.GameObjects.Rectangle
  private endGameButtonText!: Phaser.GameObjects.Text

  // Building action panel (upgrade/sell buttons, shown when a building is selected)
  private buildingActionPanel!: Phaser.GameObjects.Container
  private upgradeButton!: Phaser.GameObjects.Rectangle
  private upgradeButtonText!: Phaser.GameObjects.Text
  private sellButton!: Phaser.GameObjects.Rectangle
  private sellButtonText!: Phaser.GameObjects.Text

  constructor() {
    super('Game')
  }

  /** Get initial theme colors (based on system theme or user setting) */
  private getInitialThemeColors(): GameColors {
    return getInitialGameColors()
  }

  /** Get current theme colors */
  private getColors(): GameColors {
    return this.gameColors
  }

  create() {
    // Initialize UI state
    this.initUIState()

    // Set initial canvas background color (based on saved theme)
    this.cameras.main.setBackgroundColor(this.gameColors.canvasBackground)

    // Create render objects
    this.createRenderObjects()

    // Create UI
    this.createUI()

    // Set up input events
    this.setupInput()

    // Async initialize game session
    gameApi.createSession().then((response) => {
      this.sessionId = response.sessionId
      this.gameConfig = response.config
      this.currentWaveConfig = response.firstWave

      // Calculate map offset (center display, accounting for UI elements)
      const { width, height } = this.scale
      const mapWidth = this.gameConfig.map.width * RENDER_GRID_SIZE
      const mapHeight = this.gameConfig.map.height * RENDER_GRID_SIZE
      // Reserve space for top status bar and bottom button panel
      const topReserve = 50 * DPR
      const bottomReserve = 90 * DPR
      const availableHeight = height - topReserve - bottomReserve
      this.mapOffsetX = Math.floor((width - mapWidth) / 2)
      this.mapOffsetY = topReserve + Math.floor((availableHeight - mapHeight) / 2)

      // Create core logic
      this.logic = createGameSceneLogic(this.gameConfig)

      // Wait for the player to place the first weapon before starting wave 1
      // Consistent with old implementation: wave == 0 && !has_weapon means no start

      this.uiState.isLoading = false

      // Render static elements
      this.renderMap()
      this.createBuildingPanel()
      this.createControlPanel()
      this.createBuildingActionPanel()

      // Notify Vue that the scene is ready
      EventBus.emit('current-scene-ready', this)
    })
  }

  /** Initialize UI state */
  private initUIState() {
    this.uiState = {
      isLoading: true,
      waveIntervalCounter: 0,
      isSubmittingWave: false,
      waitingForFirstWeapon: true,
      firstWaveRecorderPrepared: false,
      currentWaveSubmitted: false,
      selectedBuildingType: null,
      selectedBuildingId: null,
      hoverPosition: null,
      mobilePreviewPosition: null,
    }
  }

  /** Create render objects */
  private createRenderObjects() {
    this.mapGraphics = this.add.graphics()
    this.buildingGraphics = this.add.graphics()
    this.monsterGraphics = this.add.graphics()
    this.bulletGraphics = this.add.graphics()
    this.hoverGraphics = this.add.graphics()

    // Create render context adapters
    this.buildingRenderCtx = createPhaserAdapter(this.buildingGraphics)
    this.monsterRenderCtx = createPhaserAdapter(this.monsterGraphics)
    this.bulletRenderCtx = createPhaserAdapter(this.bulletGraphics)
  }

  /** Set up input events */
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
      if (this.logic.getState().isGameOver) return

      // Check if click is on an interactive UI element (building panel buttons, etc.)
      // hitTestPointer returns all interactive game objects under the pointer
      const hitObjects = this.input.hitTestPointer(pointer)
      if (hitObjects.length > 0) {
        // Clicked an interactive object (e.g., building panel button), skip map click
        return
      }

      const gridPos = this.screenToGrid(pointer.x, pointer.y)
      if (!gridPos) {
        // Clicked outside map and not on UI, deselect
        this.uiState.selectedBuildingType = null
        this.uiState.selectedBuildingId = null
        this.updateBuildingActionPanel()
        this.updateBuildingPanelButtonStates()
        return
      }

      // First check if an existing building was clicked (higher priority than placing new)
      const buildings = this.logic.getBuildings()
      const clickedBuilding = buildings.find(
        (b) => b.position[0] === gridPos[0] && b.position[1] === gridPos[1],
      )

      if (clickedBuilding) {
        // Clicked an existing building: select it, cancel placement mode
        this.uiState.selectedBuildingType = null
        this.uiState.selectedBuildingId = clickedBuilding.id
        this.uiState.mobilePreviewPosition = null
        this.updateBuildingActionPanel()
        this.updateBuildingPanelButtonStates()
        EventBus.emit('building-selected', clickedBuilding)
        return
      }

      // If a building type is selected and clicked on empty ground, try to place
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

      // Clicked empty ground with no building type selected: deselect
      this.uiState.selectedBuildingId = null
      this.updateBuildingActionPanel()
    })

    // Keyboard shortcuts
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

    // Listen for restart event
    EventBus.on('restart-game', () => {
      this.restart()
    })

    // Listen for theme change (from Vue layer via AppEventBus)
    AppEventBus.on('theme-changed', (theme: unknown) => {
      this.handleThemeChange(theme as Theme)
    })

    // Listen for locale change (from Vue layer via AppEventBus)
    AppEventBus.on('locale-changed', (_locale: unknown) => {
      this.handleLocaleChange()
    })

    // Set up page visibility handlers (auto pause)
    this.setupVisibilityHandlers()
  }

  /** Set up page visibility handlers (auto pause/resume) */
  private setupVisibilityHandlers() {
    // Auto pause logic (extracted to avoid duplication)
    const autoPause = () => {
      if (!this.logic || this.uiState.isLoading) return
      const state = this.logic.getState()
      if (!state.isGameOver && !state.isPaused && state.isPlaying) {
        this.logic.pause()
        this.wasAutoPaused = true
        this.pauseButtonText?.setText(this.t('button_continue_text'))
        EventBus.emit('game-paused', true)
      }
    }

    // Auto resume logic
    const autoResume = () => {
      if (!this.logic || this.uiState.isLoading) return
      const state = this.logic.getState()
      if (this.wasAutoPaused && state.isPaused && !state.isGameOver) {
        this.logic.togglePause()
        this.wasAutoPaused = false
        this.pauseButtonText?.setText(this.t('button_pause_text'))
        EventBus.emit('game-paused', false)
      }
    }

    // visibilitychange event: primarily handles tab switching
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        autoPause()
      } else {
        autoResume()
      }
    }

    // pagehide event: supplementary handling for mobile page hiding
    this.pageHideHandler = () => {
      autoPause()
    }

    // pageshow event: supplementary handling for mobile page restoration
    this.pageShowHandler = (event: PageTransitionEvent) => {
      // persisted property indicates the page was restored from bfcache (back-forward cache)
      if (event.persisted) {
        autoResume()
      }
    }

    document.addEventListener('visibilitychange', this.visibilityChangeHandler)
    window.addEventListener('pagehide', this.pageHideHandler)
    window.addEventListener('pageshow', this.pageShowHandler)

    // Remove listeners when scene shuts down
    this.events.on('shutdown', () => {
      if (this.visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
        this.visibilityChangeHandler = null
      }
      if (this.pageHideHandler) {
        window.removeEventListener('pagehide', this.pageHideHandler)
        this.pageHideHandler = null
      }
      if (this.pageShowHandler) {
        window.removeEventListener('pageshow', this.pageShowHandler)
        this.pageShowHandler = null
      }
    })
  }

  /** Handle theme change */
  private handleThemeChange(theme: Theme) {
    this.gameColors = getTheme(theme).gameColors
    // Update canvas background color
    this.cameras.main.setBackgroundColor(this.gameColors.canvasBackground)
    // Re-render elements that depend on theme colors
    if (!this.uiState.isLoading) {
      this.renderMap()
    }
  }

  /** Handle locale change */
  private handleLocaleChange() {
    // Update translation function
    this.t = getTranslator()
    // Update stats card labels
    this.updateStatsCardLabels()
    // Update building panel texts
    this.updateBuildingPanelTexts()
    // Update control panel texts
    this.updateControlPanelTexts()
    // Update UI texts
    this.updateUI()
  }

  /** Update building panel texts */
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

  /** Update control panel texts */
  private updateControlPanelTexts() {
    if (!this.pauseButtonText || !this.restartButtonText || !this.endGameButtonText) return

    const state = this.logic?.getState()
    const isPaused = state?.isPaused ?? false

    // Set pause button text based on current state
    this.pauseButtonText.setText(
      isPaused ? this.t('button_continue_text') : this.t('button_pause_text'),
    )
    this.restartButtonText.setText(this.t('button_restart_text'))
    this.endGameButtonText.setText(this.t('button_endgame_text'))
  }

  /** Draw a dashed circle */
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

  /** Convert screen coordinates to grid coordinates */
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

  /** Check tooltip for map elements (entrance/exit/monster) */
  private checkMapElementTooltip(screenX: number, screenY: number, gridPos: Position) {
    const [gx, gy] = gridPos
    const { entrance, exit } = this.gameConfig.map

    // Check entrance
    if (gx === entrance[0] && gy === entrance[1]) {
      const centerX = this.mapOffsetX + gx * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
      const centerY = this.mapOffsetY + gy * RENDER_GRID_SIZE
      this.showTooltip(this.t('entrance'), centerX, centerY)
      return
    }

    // Check exit
    if (gx === exit[0] && gy === exit[1]) {
      const centerX = this.mapOffsetX + gx * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
      const centerY = this.mapOffsetY + gy * RENDER_GRID_SIZE
      this.showTooltip(this.t('exit'), centerX, centerY)
      return
    }

    // Check monsters (including health bar area)
    const monsters = this.logic.getMonsters()
    for (const monster of monsters) {
      if (!monster.isValid || monster.progress < 0) continue

      const pos = monster.getPixelPosition()
      const monsterX = this.mapOffsetX + pos.x * DPR
      const monsterY = this.mapOffsetY + pos.y * DPR
      const scaledRadius = monster.radius * DPR

      // Detect monster body (circle)
      const distance = Math.sqrt(
        Math.pow(screenX - monsterX, 2) + Math.pow(screenY - monsterY, 2),
      )
      const isOverBody = distance <= scaledRadius

      // Detect health bar area (rectangle: 22px wide, ~20px tall, includes health and possible shield bar)
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

    // Hide map tooltip when not over any map element (does not affect building panel tooltip)
    this.hideTooltip('map')
  }

  /** Select building type */
  selectBuildingType(type: BuildingType | null) {
    this.uiState.selectedBuildingType = type
    this.uiState.selectedBuildingId = null
    this.uiState.mobilePreviewPosition = null
    this.updateBuildingActionPanel()
    this.updateBuildingPanelButtonStates()
    EventBus.emit('building-type-selected', type)
  }

  /** Update building panel button selected states */
  private updateBuildingPanelButtonStates() {
    const selectedType = this.uiState.selectedBuildingType
    const colors = this.getColors()

    this.buildingPanelButtons.forEach((button, type) => {
      if (type === selectedType) {
        // Selected state: gold border
        button.setStrokeStyle(2, colors.rangeSelected)
      } else {
        // Unselected state: white border
        button.setStrokeStyle(2, 0xffffff)
      }
    })
  }

  /** Try to place a building */
  private tryPlaceBuilding(position: Position) {
    if (!this.uiState.selectedBuildingType) return
    // Disallow operations during wave submission (response not yet received, new recorder not created)
    if (this.uiState.isSubmittingWave) return
    if (this.logic.getState().isGameOver) return

    const buildingType = this.uiState.selectedBuildingType

    // Before wave 1 starts, placing any building requires preparing the recorder first
    // Ensures all BUILD actions (including wall) are recorded in wave 1's recorder
    if (this.uiState.waitingForFirstWeapon && !this.uiState.firstWaveRecorderPrepared) {
      this.logic.prepareNextWaveRecorder(this.currentWaveConfig.waveNumber)
      this.uiState.firstWaveRecorderPrepared = true
    }

    // Only placing a weapon building triggers wave start (spawns monsters)
    if (this.uiState.waitingForFirstWeapon && isWeaponBuilding(buildingType)) {
      this.uiState.waitingForFirstWeapon = false
      this.uiState.currentWaveSubmitted = false
      this.logic.startWave(this.currentWaveConfig)
    }

    const result = this.logic.placeBuilding(position, buildingType)

    if (result.success) {
      EventBus.emit('building-placed', {
        id: result.buildingId,
        type: buildingType,
        position,
      })
    } else {
      // Show tip message
      if (result.reason === 'insufficient_money') {
        const cost = this.gameConfig.buildings[this.uiState.selectedBuildingType].cost
        const tipX = this.mapOffsetX + position[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
        const tipY = this.mapOffsetY + position[1] * RENDER_GRID_SIZE - 20 * DPR
        this.showTip(`Not enough money, need $${cost}!`, tipX, tipY)
      }
      EventBus.emit('building-place-failed', result.reason)
    }
  }

  /** Try to upgrade a building */
  tryUpgradeBuilding(buildingId: string) {
    // Disallow operations during wave submission (response not yet received, new recorder not created)
    if (this.uiState.isSubmittingWave) return
    if (this.logic.getState().isGameOver) return

    const building = this.logic.getBuilding(buildingId)
    const result = this.logic.upgradeBuilding(buildingId)
    if (result.success) {
      EventBus.emit('building-upgraded', this.logic.getBuilding(buildingId))
    } else {
      // Show tip message
      if (result.reason === 'insufficient_money' && building) {
        const cost = this.logic.getUpgradeCost(building.type, building.level)
        const tipX = this.mapOffsetX + building.position[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
        const tipY = this.mapOffsetY + building.position[1] * RENDER_GRID_SIZE - 20 * DPR
        this.showTip(`Not enough money, need $${cost}!`, tipX, tipY)
      }
      EventBus.emit('building-upgrade-failed', result.reason)
    }
  }

  /** Try to sell a building */
  trySellBuilding(buildingId: string) {
    // Disallow operations during wave submission (response not yet received, new recorder not created)
    if (this.uiState.isSubmittingWave) return
    if (this.logic.getState().isGameOver) return

    const result = this.logic.sellBuilding(buildingId)
    if (result.success) {
      this.uiState.selectedBuildingId = null
      this.updateBuildingActionPanel()
      EventBus.emit('building-sold', buildingId)
    } else {
      EventBus.emit('building-sell-failed', result.reason)
    }
  }

  /** Render map */
  private renderMap() {
    const { width, height, entrance, exit, obstacles } = this.gameConfig.map
    const g = this.mapGraphics
    const colors = this.getColors()

    g.clear()

    // Draw grid cells
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

    // Entrance marker
    const entranceX = this.mapOffsetX + entrance[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
    const entranceY = this.mapOffsetY + entrance[1] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
    g.lineStyle(2 * DPR, colors.entrance, 1)
    g.strokeCircle(entranceX, entranceY, RENDER_GRID_SIZE / 3)

    // Exit marker
    const exitX = this.mapOffsetX + exit[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
    const exitY = this.mapOffsetY + exit[1] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
    g.lineStyle(2 * DPR, colors.exit, 1)
    g.strokeCircle(exitX, exitY, RENDER_GRID_SIZE / 3)
  }

  /** Render all buildings */
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

      // Get current target position from the Building entity (includes last target position)
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

      // Laser beam rendering (consistent with old implementation: td-obj-building.js:361-376)
      // Only render laser line when there is an active target
      if (building.type === 'laser_gun' && building.hasActiveTarget() && targetPosition) {
        const targetX = this.mapOffsetX + targetPosition[0] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2
        const targetY = this.mapOffsetY + targetPosition[1] * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2

        // Outer laser line (semi-transparent blue)
        this.buildingRenderCtx.lineStyle(3 * DPR, 0x3232c8, 0.5)
        this.buildingRenderCtx.lineBetween(centerX, centerY, targetX, targetY)

        // Inner laser line (bright blue)
        this.buildingRenderCtx.lineStyle(1 * DPR, 0x9696ff, 0.5)
        this.buildingRenderCtx.lineBetween(centerX, centerY, targetX, targetY)
      }

      // Selection effect (gold range circle + grid highlight, consistent with old implementation)
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

  /** Render all monsters */
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

  /** Render all bullets */
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

  /** Render hover indicator */
  private renderHover() {
    const g = this.hoverGraphics
    const colors = this.getColors()
    g.clear()

    if (!this.uiState.selectedBuildingType) {
      return
    }

    // Mobile uses mobilePreviewPosition, desktop uses hoverPosition
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

    // Preview building
    g.fillStyle(color, 0.3)
    g.fillRect(px + 4 * DPR, py + 4 * DPR, RENDER_GRID_SIZE - 8 * DPR, RENDER_GRID_SIZE - 8 * DPR)

    g.lineStyle(2 * DPR, color, 0.8)
    g.strokeRect(px + 4 * DPR, py + 4 * DPR, RENDER_GRID_SIZE - 8 * DPR, RENDER_GRID_SIZE - 8 * DPR)

    // Range preview (dashed circle)
    if (this.uiState.selectedBuildingType !== 'wall') {
      const buildingConfig = this.gameConfig.buildings[this.uiState.selectedBuildingType]
      const range = buildingConfig.range * RENDER_GRID_SIZE
      const centerX = px + RENDER_GRID_SIZE / 2
      const centerY = py + RENDER_GRID_SIZE / 2

      this.strokeDashedCircle(g, centerX, centerY, range, colors.rangeDash, 0.6)
    }
  }

  /** Create UI */
  private createUI() {
    // Create stats cards
    this.createStatsCards()

    // Create tip container
    this.createTipContainer()

    // Create tooltip container
    this.createTooltipContainer()

    this.updateUI()
  }

  /** Create stats cards */
  private createStatsCards() {
    const { width } = this.scale

    this.statsContainer = this.add.container(width / 2, 8 * DPR)

    const cardWidth = 60 * DPR
    const cardHeight = 36 * DPR
    const gap = 6 * DPR
    const colorBarHeight = 4 * DPR
    const cornerRadius = 4 * DPR

    const cardConfigs: Array<{
      key: keyof typeof STATS_CARD_COLORS
      labelKey: string
    }> = [
      { key: 'money', labelKey: 'panel_money_title' },
      { key: 'score', labelKey: 'panel_score_title' },
      { key: 'life', labelKey: 'panel_life_title' },
      { key: 'buildings', labelKey: 'panel_building_title' },
      { key: 'monsters', labelKey: 'panel_monster_title' },
    ]

    const totalWidth = cardConfigs.length * cardWidth + (cardConfigs.length - 1) * gap
    const startX = -totalWidth / 2

    this.statsCards = {} as typeof this.statsCards

    cardConfigs.forEach((config, index) => {
      const x = startX + index * (cardWidth + gap) + cardWidth / 2
      const color = STATS_CARD_COLORS[config.key]

      const container = this.add.container(x, cardHeight / 2)

      // Background (semi-transparent dark)
      const background = this.add.graphics()
      background.fillStyle(0x000000, 0.5)
      background.fillRoundedRect(
        -cardWidth / 2,
        -cardHeight / 2,
        cardWidth,
        cardHeight,
        cornerRadius,
      )
      background.lineStyle(1, 0xffffff, 0.2)
      background.strokeRoundedRect(
        -cardWidth / 2,
        -cardHeight / 2,
        cardWidth,
        cardHeight,
        cornerRadius,
      )

      // Top color bar
      const colorBar = this.add.graphics()
      colorBar.fillStyle(color, 1)
      colorBar.fillRoundedRect(
        -cardWidth / 2 + 2,
        -cardHeight / 2 + 2,
        cardWidth - 4,
        colorBarHeight,
        { tl: cornerRadius - 1, tr: cornerRadius - 1, bl: 0, br: 0 },
      )

      // Label text (short version, without colon)
      const label = this.t(config.labelKey).replace(/[:\s:]+$/, '')
      const labelText = this.add.text(0, -4 * DPR, label, {
        fontFamily: 'Arial',
        fontSize: `${9 * DPR}px`,
        color: 'rgba(255, 255, 255, 0.7)',
      })
      labelText.setOrigin(0.5, 0.5)

      // Value text
      const valueText = this.add.text(0, 10 * DPR, '0', {
        fontFamily: 'Arial',
        fontSize: `${12 * DPR}px`,
        fontStyle: 'bold',
        color: '#ffffff',
      })
      valueText.setOrigin(0.5, 0.5)

      container.add([background, colorBar, labelText, valueText])
      this.statsContainer.add(container)

      this.statsCards[config.key] = {
        container,
        background,
        colorBar,
        labelText,
        valueText,
      }
    })
  }

  /** Create tip container */
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

  /** Create tooltip container */
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

  /** Show tooltip */
  private showTooltip(message: string, x: number, y: number, source: 'panel' | 'map' = 'map') {
    this.tooltipSource = source
    this.tooltipText.setText(message)

    const padding = 8 * DPR
    const bgWidth = this.tooltipText.width + padding * 2
    const bgHeight = this.tooltipText.height + padding * 2

    // Move text up by padding pixels to vertically center it within the background
    this.tooltipText.setPosition(0, -padding)

    this.tooltipBackground.clear()
    this.tooltipBackground.fillStyle(0x333333, 0.9)
    this.tooltipBackground.lineStyle(1, 0x666666, 1)
    this.tooltipBackground.fillRoundedRect(-bgWidth / 2, -bgHeight, bgWidth, bgHeight, 4)
    this.tooltipBackground.strokeRoundedRect(-bgWidth / 2, -bgHeight, bgWidth, bgHeight, 4)

    this.tooltipContainer.setPosition(x, y - 10)
    this.tooltipContainer.setVisible(true)
  }

  /** Hide tooltip (only hides tooltip from specified source; force hides if no source specified) */
  private hideTooltip(source?: 'panel' | 'map') {
    if (source && this.tooltipSource !== source) {
      return
    }
    this.tooltipContainer.setVisible(false)
    this.tooltipSource = null
  }

  /** Show tip message */
  private showTip(message: string, x?: number, y?: number) {
    const { width, height } = this.scale

    // Set text
    this.tipText.setText(message)

    // Calculate background dimensions
    const padding = 10 * DPR
    const bgWidth = this.tipText.width + padding * 2
    const bgHeight = this.tipText.height + padding * 2

    // Draw yellow background (consistent with old implementation)
    this.tipBackground.clear()
    this.tipBackground.fillStyle(0xffff00, 0.8)
    this.tipBackground.lineStyle(2 * DPR, 0xdede00, 1)
    this.tipBackground.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 4 * DPR)
    this.tipBackground.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 4 * DPR)

    // Set position
    const posX = x ?? width / 2
    const posY = y ?? height / 2
    this.tipContainer.setPosition(posX, posY)

    // Show
    this.tipContainer.setVisible(true)

    // Clear previous timer
    if (this.tipTimer) {
      this.tipTimer.destroy()
    }

    // Auto hide
    this.tipTimer = this.time.delayedCall(TIP_DURATION, () => {
      this.tipContainer.setVisible(false)
    })
  }

  /** Create building panel */
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

    // Calculate how many buttons fit per row
    const availableWidth = width - 20 * DPR
    const buttonsPerRow = Math.max(2, Math.floor(availableWidth / (buttonWidth + gapX)))
    const rows = Math.ceil(buildingTypes.length / buttonsPerRow)

    buildingTypes.forEach((type, index) => {
      const row = Math.floor(index / buttonsPerRow)
      const col = index % buttonsPerRow
      const buttonsInThisRow = Math.min(buttonsPerRow, buildingTypes.length - row * buttonsPerRow)

      // Calculate starting X position for this row (centered)
      const rowWidth = buttonsInThisRow * buttonWidth + (buttonsInThisRow - 1) * gapX
      const rowStartX = -rowWidth / 2

      const x = rowStartX + col * (buttonWidth + gapX) + buttonWidth / 2
      const y = (row - (rows - 1) / 2) * (buttonHeight + gapY)

      const config = this.gameConfig.buildings[type]

      // Button background
      const buttonColor = BUILDING_COLORS[type].primary
      const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, buttonColor, 0.8)
      button.setStrokeStyle(2 * DPR, 0xffffff)
      button.setInteractive({ useHandCursor: true })

      // Store button reference
      this.buildingPanelButtons.set(type, button)

      button.on('pointerover', () => {
        button.setFillStyle(buttonColor, 1)
        // Show building info tooltip
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
        // If current button is selected, keep selected border
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

      // Button text (using i18n translation)
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

  /** Create control panel (pause/restart/end buttons) */
  private createControlPanel() {
    const { width, height } = this.scale

    // Control panel is below the building panel
    this.controlPanel = this.add.container(width / 2, height - 10 * DPR)

    const buttonWidth = 70 * DPR
    const buttonHeight = 20 * DPR
    const gap = 10 * DPR

    // Restart button (left side, initially hidden, only shown when paused)
    const restartX = -(buttonWidth + gap)
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

    // Pause button (center)
    const pauseX = 0
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

    // End game button (right side, initially hidden, only shown when paused)
    const endGameX = buttonWidth + gap
    this.endGameButton = this.add.rectangle(endGameX, 0, buttonWidth, buttonHeight, 0x888888, 0.8)
    this.endGameButton.setStrokeStyle(1 * DPR, 0xffffff)
    this.endGameButton.setInteractive({ useHandCursor: true })
    this.endGameButton.setVisible(false)

    this.endGameButtonText = this.add.text(endGameX, 0, this.t('button_endgame_text'), {
      fontFamily: 'Arial',
      fontSize: `${11 * DPR}px`,
      color: '#ffffff',
    })
    this.endGameButtonText.setOrigin(0.5, 0.5)
    this.endGameButtonText.setVisible(false)

    this.endGameButton.on('pointerover', () => {
      this.endGameButton.setFillStyle(0x888888, 1)
    })

    this.endGameButton.on('pointerout', () => {
      this.endGameButton.setFillStyle(0x888888, 0.8)
    })

    this.endGameButton.on('pointerdown', () => {
      this.handleEndGameClick()
    })

    this.controlPanel.add([
      this.restartButton,
      this.restartButtonText,
      this.pauseButton,
      this.pauseButtonText,
      this.endGameButton,
      this.endGameButtonText,
    ])
  }

  /** Create building action panel (upgrade/sell buttons shown when a building is selected) */
  private createBuildingActionPanel() {
    this.buildingActionPanel = this.add.container(0, 0)
    this.buildingActionPanel.setVisible(false)
    this.buildingActionPanel.setDepth(100)

    const buttonWidth = 80 * DPR
    const buttonHeight = 22 * DPR
    const gap = 6 * DPR

    // Upgrade button
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

    // Sell button
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

  /** Show building action tooltip */
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

  /** Get sell income (calls BuildingSystem) */
  private getSellIncome(type: string, level: number): number {
    const buildingConfig = this.gameConfig.buildings[type as BuildingType]
    const totalCost = this.getTotalCost(type as BuildingType, level)
    const income = Math.floor(totalCost * buildingConfig.sellRatio)
    return Math.max(income, 1)
  }

  /** Get cumulative building cost */
  private getTotalCost(type: BuildingType, level: number): number {
    const buildingConfig = this.gameConfig.buildings[type]
    let total = buildingConfig.cost
    for (let l = 1; l < level; l++) {
      total += Math.floor(total * buildingConfig.upgradeCostRatio)
    }
    return total
  }

  /** Update building action panel display state and position */
  private updateBuildingActionPanel() {
    // Skip if panel has not been created yet
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

    // Calculate panel position (above the building cell)
    const [bx, by] = building.position
    const panelX = this.mapOffsetX + bx * RENDER_GRID_SIZE + RENDER_GRID_SIZE / 2 - 40 * DPR
    const panelY = this.mapOffsetY + by * RENDER_GRID_SIZE - 30 * DPR

    this.buildingActionPanel.setPosition(panelX, panelY)

    // Update button text
    const upgradeCost = this.logic.getUpgradeCost(building.type, building.level)
    this.upgradeButtonText.setText(`${this.t('button_upgrade_text')} $${upgradeCost}`)

    const sellIncome = this.getSellIncome(building.type, building.level)
    this.sellButtonText.setText(`${this.t('button_sell_text')} $${sellIncome}`)

    this.buildingActionPanel.setVisible(true)
  }

  /** Handle pause button click */
  private handlePauseClick() {
    const state = this.logic.getState()

    // When game is over, clicking continue button restarts the game
    if (state.isGameOver) {
      this.restart()
      return
    }

    // Clear auto-pause flag on manual operation
    this.wasAutoPaused = false

    if (state.isPaused) {
      // Currently paused, click to resume
      this.logic.togglePause()
      this.pauseButtonText.setText(this.t('button_pause_text'))
      this.restartButton.setVisible(false)
      this.restartButtonText.setVisible(false)
      this.endGameButton.setVisible(false)
      this.endGameButtonText.setVisible(false)
    } else {
      // Currently running, click to pause
      this.logic.togglePause()
      this.pauseButtonText.setText(this.t('button_continue_text'))
      this.restartButton.setVisible(true)
      this.restartButtonText.setVisible(true)
      this.endGameButton.setVisible(true)
      this.endGameButtonText.setVisible(true)
    }

    EventBus.emit('game-paused', this.logic.getState().isPaused)
  }

  /** Handle end game button click */
  private handleEndGameClick() {
    // Disallow ending during wave submission (to avoid race conditions)
    if (this.uiState.isSubmittingWave) {
      console.warn('Cannot end game: wave submission in progress')
      return
    }

    // Determine if this is an "early end after wave submitted"
    // In this case lastWave was already submitted via /wave, no need to resend
    // Otherwise (wave in progress, or wave completed but not submitted) lastWave needs to be sent
    const isEarlyEnd = this.uiState.currentWaveSubmitted && this.uiState.waveIntervalCounter > 0

    this.gameOver(isEarlyEnd)
  }

  /** Update UI display */
  private updateUI() {
    if (this.uiState.isLoading || !this.statsCards) {
      return
    }

    const state = this.logic.getState()
    const buildings = this.logic.getBuildings()
    const monsters = this.logic.getMonsters()
    const aliveMonsters = monsters.filter((m) => m.isValid).length

    // Update card values
    this.statsCards.money.valueText.setText(`$${state.money}`)
    this.statsCards.score.valueText.setText(String(state.score))
    this.statsCards.life.valueText.setText(String(state.life))
    this.statsCards.buildings.valueText.setText(String(buildings.length))
    this.statsCards.monsters.valueText.setText(String(aliveMonsters))
  }

  /** Update stats card label texts (on language switch) */
  private updateStatsCardLabels() {
    if (!this.statsCards) return

    const labelConfigs: Array<{
      key: keyof typeof STATS_CARD_COLORS
      labelKey: string
    }> = [
      { key: 'money', labelKey: 'panel_money_title' },
      { key: 'score', labelKey: 'panel_score_title' },
      { key: 'life', labelKey: 'panel_life_title' },
      { key: 'buildings', labelKey: 'panel_building_title' },
      { key: 'monsters', labelKey: 'panel_monster_title' },
    ]

    labelConfigs.forEach((config) => {
      const label = this.t(config.labelKey).replace(/[:\s:]+$/, '')
      this.statsCards[config.key].labelText.setText(label)
    })
  }

  /** Check if wave is complete and handle accordingly */
  private checkWaveComplete() {
    if (this.uiState.isSubmittingWave) return

    // Do not process wave completion or interval counting while paused
    // Consistent with old implementation: td.js step() returns early when is_paused
    const state = this.logic.getState()
    if (state.isPaused) return

    if (this.logic.isWaveComplete()) {
      if (this.uiState.waveIntervalCounter === 0) {
        this.uiState.isSubmittingWave = true
        this.submitWaveResult()
        return
      }

      this.uiState.waveIntervalCounter--

      if (this.uiState.waveIntervalCounter === 0) {
        // New wave starts, reset submission flag
        this.uiState.currentWaveSubmitted = false
        this.logic.startWave(this.currentWaveConfig)
      }
    }
  }

  /** Submit wave result to server */
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

    gameApi.submitWave(
      waveRecorder.toWaveRequest(this.sessionId, buildingSnapshots),
    ).then((response) => {
      // Check if game is over
      // Wave was already submitted via /wave, call gameOver(true) to avoid duplicate lastWave submission
      if (state.life <= 0 || !response.nextWave) {
        this.gameOver(true)
        return
      }

      // Save next wave config
      this.currentWaveConfig = response.nextWave

      // Immediately prepare recorder for next wave so actions during interval are recorded correctly
      this.logic.prepareNextWaveRecorder(response.nextWave.waveNumber)

      // Mark current wave as submitted
      this.uiState.currentWaveSubmitted = true

      // Start wave interval countdown
      this.uiState.waveIntervalCounter = WAVE_INTERVAL_FRAMES
      this.uiState.isSubmittingWave = false
    }).catch((error) => {
      console.error('Submit wave error:', error)
      this.uiState.isSubmittingWave = false

      if (error instanceof ApiError && error.isSessionNotFound()) {
        this.handleSessionNotFound()
        return
      }

      this.showTip(this.t('error_network'))
    })
  }

  /** Handle session not found error */
  private handleSessionNotFound() {
    // Show tip informing user that the session has expired
    const { width, height } = this.scale
    this.showTip(this.t('error_session_expired'), width / 2, height / 2)

    // Auto restart after delay
    this.time.delayedCall(2000, () => {
      this.restart()
    })
  }

  /**
   * Game over
   * @param isEarlyEnd Whether this is an early end (wave already submitted via /wave, no need to send lastWave)
   */
  private gameOver(isEarlyEnd: boolean = false) {
    // Set game over state, stop game logic updates
    this.logic.setGameOver()

    const state = this.logic.getState()
    const buildings = this.logic.getBuildings()

    // Calculate completed waves count
    // - isEarlyEnd = true: current wave already submitted via /wave, state.wave is the completed count
    // - isEarlyEnd = false: current wave in progress or just completed without submission, completed = state.wave - 1
    const wavesCompleted = isEarlyEnd ? state.wave : Math.max(0, state.wave - 1)

    // Final score = cumulative hit score (no bonus)
    const finalScore = state.score

    // Send game over event to Vue layer
    if (isEarlyEnd) {
      // Early end: lastWave already submitted via /wave, no need to resend
      EventBus.emit('game-over', {
        score: finalScore,
        wavesCompleted,
        sessionId: this.sessionId,
        isEarlyEnd: true,
      })
    } else {
      // Normal end: need to send lastWave data
      const waveRecorder = this.logic.getWaveRecorder()

      // Record remaining monsters on the field (needed for early end, used for server validation)
      const monsters = this.logic.getMonsters()
      for (const monster of monsters) {
        if (monster.isValid) {
          waveRecorder.recordRemainingMonster(monster.id)
        }
      }

      const lastWaveActions = waveRecorder.getActions()
      const lastWaveAttacks = waveRecorder.getAttacks()
      const lastWaveResult = waveRecorder.getResult()

      const buildingSnapshots = buildings.map((b) => ({
        id: b.id,
        type: b.type,
        position: b.position,
        level: b.level,
        damageDealt: b.damageDealt,
        kills: b.kills,
      }))

      EventBus.emit('game-over', {
        score: finalScore,
        wavesCompleted,
        sessionId: this.sessionId,
        lastWaveActions,
        lastWaveAttacks,
        lastWaveResult,
        buildings: buildingSnapshots,
        isEarlyEnd: false,
      })
    }

    // Disable continue button (not allowed after game over)
    this.pauseButton.disableInteractive()
    this.pauseButton.setFillStyle(0x666666, 0.5)
    this.pauseButtonText.setAlpha(0.5)
  }

  /** Game main loop */
  update() {
    if (this.uiState.isLoading) return

    const state = this.logic.getState()

    if (state.isGameOver) return

    // Update logic
    this.logic.update()

    // Render
    this.renderBuildings()
    this.renderMonsters()
    this.renderBullets()
    this.renderHover()
    this.updateUI()

    // Check wave completion
    this.checkWaveComplete()
  }

  /** Pause/resume game */
  togglePause() {
    if (this.logic) {
      this.logic.togglePause()
      EventBus.emit('game-paused', this.logic.getState().isPaused)
    }
  }

  /** Get game state */
  getGameState() {
    if (this.logic) {
      return this.logic.getState()
    }
    return null
  }

  /** Restart game */
  async restart() {
    // Set loading state
    this.uiState.isLoading = true
    this.uiState.waveIntervalCounter = 0
    this.uiState.isSubmittingWave = false
    this.uiState.selectedBuildingType = null
    this.uiState.selectedBuildingId = null
    this.uiState.hoverPosition = null
    this.uiState.mobilePreviewPosition = null

    // Reset auto-pause flag
    this.wasAutoPaused = false

    // Reset control panel state
    this.pauseButtonText.setText(this.t('button_pause_text'))
    this.pauseButtonText.setAlpha(1)
    this.pauseButton.setInteractive({ useHandCursor: true })
    this.pauseButton.setFillStyle(0x4488ff, 0.8)
    this.restartButton.setVisible(false)
    this.restartButtonText.setVisible(false)
    this.endGameButton.setVisible(false)
    this.endGameButtonText.setVisible(false)

    // Hide building action panel
    this.updateBuildingActionPanel()

    // Reset building panel button selected states
    this.updateBuildingPanelButtonStates()

    // Clear rendering
    this.buildingGraphics.clear()
    this.monsterGraphics.clear()
    this.bulletGraphics.clear()
    this.hoverGraphics.clear()

    try {
      // Request new game session
      const response = await gameApi.createSession()

      this.sessionId = response.sessionId
      this.gameConfig = response.config
      this.currentWaveConfig = response.firstWave

      // Reset core logic
      this.logic.reset()

      // Wait for the player to place the first weapon before starting wave 1
      this.uiState.waitingForFirstWeapon = true
      this.uiState.firstWaveRecorderPrepared = false
      this.uiState.currentWaveSubmitted = false

      this.uiState.isLoading = false

      // Re-render static elements
      this.renderMap()

      // Notify restart completed
      EventBus.emit('game-restarted')
    } catch (error) {
      console.error('Failed to restart game:', error)
      this.uiState.isLoading = false
    }
  }
}
