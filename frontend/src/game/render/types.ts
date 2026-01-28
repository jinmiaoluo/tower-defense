/**
 * Render module type definitions
 */

import type { BuildingType, Position } from '@/types'

/** Render context interface (abstracts Phaser Graphics) */
export interface RenderContext {
  clear(): void
  fillStyle(color: number, alpha?: number): void
  lineStyle(width: number, color: number, alpha?: number): void
  fillRect(x: number, y: number, width: number, height: number): void
  strokeRect(x: number, y: number, width: number, height: number): void
  fillCircle(x: number, y: number, radius: number): void
  strokeCircle(x: number, y: number, radius: number): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  fill(): void
  stroke(): void
  lineBetween(x1: number, y1: number, x2: number, y2: number): void
  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void
  strokeTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void
}

/** Building render data */
export interface BuildingRenderData {
  id: string
  type: BuildingType
  position: Position
  level: number
  centerX: number
  centerY: number
  gridSize: number
  isSelected: boolean
  targetPosition?: Position
  frame?: number
}

/** Monster render data */
export interface MonsterRenderData {
  id: string
  x: number
  y: number
  radius: number
  color: string
  currentLife: number
  maxLife: number
  shield: number
  frame?: number
}

/** Bullet render data */
export interface BulletRenderData {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
  color?: number
}

/** Building color scheme */
export interface BuildingColorScheme {
  primary: number
  secondary: number
  highlight: number
  barrel?: number
}

/** Building color map */
export const BUILDING_COLORS: Record<BuildingType, BuildingColorScheme> = {
  wall: {
    primary: 0x666666,
    secondary: 0x444444,
    highlight: 0x888888,
  },
  cannon: {
    primary: 0x339933,
    secondary: 0x006600,
    highlight: 0xcceecc,
    barrel: 0x000000,
  },
  LMG: {
    primary: 0x3366ff,
    secondary: 0x6666cc,
    highlight: 0xccccff,
    barrel: 0x3366ff,
  },
  HMG: {
    primary: 0x993333,
    secondary: 0x663300,
    highlight: 0xffcccc,
    barrel: 0x993333,
  },
  laser_gun: {
    primary: 0xff0000,
    secondary: 0x6600ff,
    highlight: 0x666666,
  },
}
