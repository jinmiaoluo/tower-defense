import Phaser from 'phaser'
import { Boot } from './scenes/Boot'
import { Preloader } from './scenes/Preloader'
import { Game } from './scenes/Game'
import { GAME_CONSTANTS } from '@/types'
import { DPR } from './dpr'
import { getInitialGameColors } from '@/theme'

const { GRID_SIZE } = GAME_CONSTANTS

// Map grid dimensions (consistent with mock config)
const MAP_GRID_WIDTH = 16
const MAP_GRID_HEIGHT = 16

// Calculate appropriate game dimensions
function calculateGameSize(): { width: number; height: number } {
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  // Map pixel dimensions
  const mapPixelWidth = MAP_GRID_WIDTH * GRID_SIZE
  const mapPixelHeight = MAP_GRID_HEIGHT * GRID_SIZE

  // UI reserved space (status bar + building panel)
  const uiHeightReserve = 140

  // Minimum padding
  const minPadding = 10

  // Calculate available space
  const availableWidth = screenWidth - minPadding * 2
  const availableHeight = screenHeight - uiHeightReserve - minPadding * 2

  // Calculate scale ratio, ensuring the map displays completely
  const scaleX = availableWidth / mapPixelWidth
  const scaleY = availableHeight / mapPixelHeight
  const scale = Math.min(scaleX, scaleY, 1) // Do not scale beyond original size

  // Calculate actual game dimensions
  const gameWidth = Math.max(mapPixelWidth * scale + minPadding * 2, mapPixelWidth)
  const gameHeight = Math.max(mapPixelHeight * scale + uiHeightReserve + minPadding * 2, mapPixelHeight + uiHeightReserve)

  return {
    width: Math.floor(gameWidth),
    height: Math.floor(gameHeight),
  }
}

const { width, height } = calculateGameSize()

// Dynamically get initial background color (based on system theme or user setting)
const initialColors = getInitialGameColors()

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: width * DPR,
  height: height * DPR,
  parent: 'game-container',
  backgroundColor: initialColors.canvasBackground,
  scene: [Boot, Preloader, Game],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    zoom: 1 / DPR,
  },
  render: {
    antialias: true,
    roundPixels: false,
    pixelArt: false,
  },
  audio: {
    disableWebAudio: true,
  },
}

const StartGame = (parent: string) => {
  return new Phaser.Game({ ...config, parent })
}

export default StartGame
