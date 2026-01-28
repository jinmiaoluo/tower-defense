/**
 * Building renderer - simple animated style
 */

import type { RenderContext, BuildingRenderData } from './types'
import { DPR } from '../dpr'

/** Highlight color for selected buildings */
const SELECTED_COLOR = 0x00ffff

/** Simple style building color configuration */
const COLORS = {
  wall: {
    base: 0x666666,
    dark: 0x444444,
    light: 0x888888,
  },
  cannon: {
    base: 0x339933,
    dark: 0x226622,
    light: 0x55bb55,
    barrel: 0x333333,
  },
  LMG: {
    base: 0x3366ff,
    dark: 0x2244cc,
    light: 0x5588ff,
    barrel: 0x222266,
  },
  HMG: {
    base: 0xcc3333,
    dark: 0x992222,
    light: 0xee5555,
    barrel: 0x442222,
  },
  laser_gun: {
    base: 0x9933ff,
    dark: 0x6622cc,
    light: 0xbb55ff,
    crystal: 0xff3333,
  },
}

/** Calculate breathing animation scale */
function calcBreath(frame: number, speed: number = 0.08): number {
  return 1 + Math.sin(frame * speed) * 0.05
}

/** Calculate pulse animation brightness */
function calcPulse(frame: number, speed: number = 0.1): number {
  return (Math.sin(frame * speed) + 1) / 2
}

/** Adjust color brightness */
function adjustBrightness(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor))
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor))
  const b = Math.min(255, Math.floor((color & 0xff) * factor))
  return (r << 16) | (g << 8) | b
}

/**
 * Render a single building
 */
export function renderBuilding(ctx: RenderContext, data: BuildingRenderData): void {
  switch (data.type) {
    case 'wall':
      renderWall(ctx, data)
      break
    case 'cannon':
      renderCannon(ctx, data)
      break
    case 'LMG':
      renderLMG(ctx, data)
      break
    case 'HMG':
      renderHMG(ctx, data)
      break
    case 'laser_gun':
      renderLaserGun(ctx, data)
      break
  }
}

/**
 * Render wall - simple block
 */
function renderWall(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, frame = 0 } = data
  const colors = COLORS.wall
  const size = gridSize - 4 * DPR
  const half = size / 2

  // Breathing animation
  const scale = calcBreath(frame, 0.05)
  const animSize = size * scale
  const animHalf = animSize / 2

  // Outer dark layer
  ctx.fillStyle(colors.dark, 1)
  ctx.fillRect(centerX - animHalf, centerY - animHalf, animSize, animSize)

  // Inner main color
  const innerSize = animSize - 4 * DPR
  ctx.fillStyle(colors.base, 1)
  ctx.fillRect(centerX - innerSize / 2, centerY - innerSize / 2, innerSize, innerSize)

  // Highlight
  ctx.fillStyle(colors.light, 1)
  ctx.fillRect(centerX - innerSize / 2, centerY - innerSize / 2, innerSize / 3, 3 * DPR)

  // Border
  ctx.lineStyle(1 * DPR, 0x000000, 1)
  ctx.strokeRect(centerX - animHalf, centerY - animHalf, animSize, animSize)

  // Selection highlight
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeRect(centerX - half - 2 * DPR, centerY - half - 2 * DPR, size + 4 * DPR, size + 4 * DPR)
  }
}

/**
 * Render cannon - circular base + barrel
 */
function renderCannon(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition, frame = 0 } = data
  const colors = COLORS.cannon
  const baseRadius = 10 * DPR

  // Breathing animation
  const scale = calcBreath(frame, 0.06)
  const animRadius = baseRadius * scale

  // Outer dark ring
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(centerX, centerY, animRadius + 2 * DPR)

  // Main circle
  ctx.fillStyle(colors.base, 1)
  ctx.fillCircle(centerX, centerY, animRadius)

  // Highlight
  ctx.fillStyle(colors.light, 1)
  ctx.fillCircle(centerX - 3 * DPR, centerY - 3 * DPR, 4 * DPR)

  // Barrel
  const barrelLength = gridSize / 2
  let angle = 0
  if (targetPosition) {
    const dx = targetPosition[0] - data.position[0]
    const dy = targetPosition[1] - data.position[1]
    angle = Math.atan2(dy, dx)
  }

  const endX = centerX + Math.cos(angle) * barrelLength
  const endY = centerY + Math.sin(angle) * barrelLength
  ctx.lineStyle(5 * DPR, colors.barrel, 1)
  ctx.lineBetween(centerX, centerY, endX, endY)

  // Muzzle
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(endX, endY, 3 * DPR)

  // Border
  ctx.lineStyle(1 * DPR, 0x000000, 1)
  ctx.strokeCircle(centerX, centerY, animRadius + 2 * DPR)

  // Selection highlight
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeCircle(centerX, centerY, baseRadius + 6 * DPR)
  }
}

/**
 * Render LMG - small circular base + thin barrel
 */
function renderLMG(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition, frame = 0 } = data
  const colors = COLORS.LMG
  const baseRadius = 8 * DPR

  // Breathing animation
  const scale = calcBreath(frame, 0.07)
  const animRadius = baseRadius * scale

  // Outer ring
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(centerX, centerY, animRadius + 2 * DPR)

  // Main circle
  ctx.fillStyle(colors.base, 1)
  ctx.fillCircle(centerX, centerY, animRadius)

  // Highlight
  ctx.fillStyle(colors.light, 1)
  ctx.fillCircle(centerX - 2 * DPR, centerY - 2 * DPR, 3 * DPR)

  // Barrel
  const barrelLength = gridSize / 2 + 4 * DPR
  let angle = 0
  if (targetPosition) {
    const dx = targetPosition[0] - data.position[0]
    const dy = targetPosition[1] - data.position[1]
    angle = Math.atan2(dy, dx)
  }

  const endX = centerX + Math.cos(angle) * barrelLength
  const endY = centerY + Math.sin(angle) * barrelLength
  ctx.lineStyle(3 * DPR, colors.barrel, 1)
  ctx.lineBetween(centerX, centerY, endX, endY)

  // Border
  ctx.lineStyle(1 * DPR, 0x000000, 1)
  ctx.strokeCircle(centerX, centerY, animRadius + 2 * DPR)

  // Selection highlight
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeCircle(centerX, centerY, baseRadius + 5 * DPR)
  }
}

/**
 * Render HMG - large circular base + thick barrel
 */
function renderHMG(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition, frame = 0 } = data
  const colors = COLORS.HMG
  const baseRadius = 12 * DPR

  // Breathing animation
  const scale = calcBreath(frame, 0.05)
  const animRadius = baseRadius * scale

  // Outer ring
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(centerX, centerY, animRadius + 3 * DPR)

  // Main circle
  ctx.fillStyle(colors.base, 1)
  ctx.fillCircle(centerX, centerY, animRadius)

  // Inner ring
  ctx.fillStyle(colors.light, 1)
  ctx.fillCircle(centerX, centerY, animRadius - 4 * DPR)

  // Highlight
  ctx.fillStyle(0xffffff, 0.3)
  ctx.fillCircle(centerX - 4 * DPR, centerY - 4 * DPR, 4 * DPR)

  // Thick barrel
  const barrelLength = gridSize / 2 + 6 * DPR
  let angle = 0
  if (targetPosition) {
    const dx = targetPosition[0] - data.position[0]
    const dy = targetPosition[1] - data.position[1]
    angle = Math.atan2(dy, dx)
  }

  const endX = centerX + Math.cos(angle) * barrelLength
  const endY = centerY + Math.sin(angle) * barrelLength
  ctx.lineStyle(7 * DPR, colors.barrel, 1)
  ctx.lineBetween(centerX, centerY, endX, endY)

  // Muzzle
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(endX, endY, 4 * DPR)

  // Border
  ctx.lineStyle(1 * DPR, 0x000000, 1)
  ctx.strokeCircle(centerX, centerY, animRadius + 3 * DPR)

  // Selection highlight
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeCircle(centerX, centerY, baseRadius + 6 * DPR)
  }
}

/**
 * Render laser gun - triangle + pulse animation
 */
function renderLaserGun(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, isSelected, frame = 0 } = data
  const colors = COLORS.laser_gun
  const size = 12 * DPR

  // Pulse animation
  const pulse = calcPulse(frame, 0.12)
  const crystalColor = adjustBrightness(colors.crystal, 0.8 + pulse * 0.4)

  // Base circle
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(centerX, centerY + 4 * DPR, 10 * DPR)

  ctx.fillStyle(colors.base, 1)
  ctx.fillCircle(centerX, centerY + 4 * DPR, 8 * DPR)

  // Crystal triangle
  const topY = centerY - size
  const bottomY = centerY + 2 * DPR
  const halfWidth = 6 * DPR

  ctx.fillStyle(crystalColor, 1)
  ctx.fillTriangle(
    centerX, topY,
    centerX - halfWidth, bottomY,
    centerX + halfWidth, bottomY
  )

  // Crystal highlight
  ctx.fillStyle(0xffffff, 0.5)
  ctx.fillTriangle(
    centerX - 2 * DPR, topY + 4 * DPR,
    centerX - halfWidth + 2 * DPR, bottomY - 4 * DPR,
    centerX - 1 * DPR, bottomY - 4 * DPR
  )

  // Crystal border
  ctx.lineStyle(1 * DPR, colors.dark, 1)
  ctx.strokeTriangle(
    centerX, topY,
    centerX - halfWidth, bottomY,
    centerX + halfWidth, bottomY
  )

  // Center energy point
  const energyRadius = 2 * DPR + pulse * 1 * DPR
  ctx.fillStyle(0xffffff, 1)
  ctx.fillCircle(centerX, centerY - 2 * DPR, energyRadius)

  // Selection highlight
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeCircle(centerX, centerY, 14 * DPR)
  }
}

/**
 * Building renderer interface
 */
export interface BuildingRenderer {
  render(data: BuildingRenderData): void
  clear(): void
}

/**
 * Create a building renderer
 */
export function createBuildingRenderer(ctx: RenderContext): BuildingRenderer {
  return {
    render(data: BuildingRenderData): void {
      renderBuilding(ctx, data)
    },
    clear(): void {
      ctx.clear()
    },
  }
}
