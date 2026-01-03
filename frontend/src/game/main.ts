import Phaser from 'phaser'
import { Boot } from './scenes/Boot'
import { Preloader } from './scenes/Preloader'
import { Game } from './scenes/Game'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE } = GAME_CONSTANTS

// 地图格子数（与 mock 配置一致）
const MAP_GRID_WIDTH = 16
const MAP_GRID_HEIGHT = 16

// 计算合适的游戏尺寸
function calculateGameSize(): { width: number; height: number } {
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  // 地图实际像素大小
  const mapPixelWidth = MAP_GRID_WIDTH * GRID_SIZE
  const mapPixelHeight = MAP_GRID_HEIGHT * GRID_SIZE

  // UI 预留空间（状态栏 + 建筑面板）
  const uiHeightReserve = 140

  // 最小边距
  const minPadding = 10

  // 计算可用空间
  const availableWidth = screenWidth - minPadding * 2
  const availableHeight = screenHeight - uiHeightReserve - minPadding * 2

  // 计算缩放比例，确保地图完整显示
  const scaleX = availableWidth / mapPixelWidth
  const scaleY = availableHeight / mapPixelHeight
  const scale = Math.min(scaleX, scaleY, 1) // 不放大超过原始尺寸

  // 计算实际游戏尺寸
  const gameWidth = Math.max(mapPixelWidth * scale + minPadding * 2, mapPixelWidth)
  const gameHeight = Math.max(mapPixelHeight * scale + uiHeightReserve + minPadding * 2, mapPixelHeight + uiHeightReserve)

  return {
    width: Math.floor(gameWidth),
    height: Math.floor(gameHeight),
  }
}

const { width, height } = calculateGameSize()

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width,
  height,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [Boot, Preloader, Game],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: true,
  },
}

const StartGame = (parent: string) => {
  return new Phaser.Game({ ...config, parent })
}

export default StartGame
