/**
 * Monster renderer - simple animated style
 */

import type { RenderContext, MonsterRenderData } from './types'
import { DPR } from '../dpr'

/** Health bar configuration (DPR scaled) */
const HEALTH_BAR = {
  width: 20 * DPR,
  height: 3 * DPR,
  offsetY: 12 * DPR,
  backgroundColor: 0x000000,
  shieldColor: 0x00ffff,
}

/**
 * Get health bar color based on health percentage
 */
function getHealthBarColor(ratio: number): number {
  if (ratio > 0.6) {
    return 0x00ff00
  } else if (ratio > 0.3) {
    return 0xffff00
  } else {
    return 0xff0000
  }
}

/**
 * Convert CSS color string to number
 */
function parseColor(color: string): number {
  if (color.startsWith('#')) {
    return parseInt(color.slice(1), 16)
  }
  return 0xffffff
}

/**
 * Calculate darker color
 */
function darkenColor(color: number, factor: number = 0.6): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor)
  const g = Math.floor(((color >> 8) & 0xff) * factor)
  const b = Math.floor((color & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

/**
 * Calculate lighter color
 */
function lightenColor(color: number, factor: number = 1.4): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor))
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor))
  const b = Math.min(255, Math.floor((color & 0xff) * factor))
  return (r << 16) | (g << 8) | b
}

/** Calculate breathing animation scale */
function calcBreath(frame: number, speed: number = 0.1): number {
  return 1 + Math.sin(frame * speed) * 0.08
}

/**
 * Render a single monster
 */
export function renderMonster(ctx: RenderContext, data: MonsterRenderData): void {
  const { x, y, radius, color, currentLife, maxLife, shield, frame = 0 } = data

  const bodyColor = parseColor(color)
  const dark = darkenColor(bodyColor)
  const light = lightenColor(bodyColor)

  // Breathing animation
  const scale = calcBreath(frame, 0.12)
  const animRadius = radius * scale

  // Outer ring (shadow)
  ctx.fillStyle(dark, 1)
  ctx.fillCircle(x, y, animRadius + 2 * DPR)

  // Main body circle
  ctx.fillStyle(bodyColor, 1)
  ctx.fillCircle(x, y, animRadius)

  // Highlight
  ctx.fillStyle(light, 0.6)
  ctx.fillCircle(x - animRadius * 0.3, y - animRadius * 0.3, animRadius * 0.4)

  // Eyes
  const eyeOffset = animRadius * 0.25
  const eyeRadius = Math.max(2 * DPR, animRadius * 0.2)
  ctx.fillStyle(0x000000, 1)
  ctx.fillCircle(x - eyeOffset, y - eyeOffset * 0.5, eyeRadius)
  ctx.fillCircle(x + eyeOffset, y - eyeOffset * 0.5, eyeRadius)

  // Eye highlights
  const pupilRadius = eyeRadius * 0.4
  ctx.fillStyle(0xffffff, 1)
  ctx.fillCircle(x - eyeOffset + pupilRadius, y - eyeOffset * 0.5 - pupilRadius, pupilRadius)
  ctx.fillCircle(x + eyeOffset + pupilRadius, y - eyeOffset * 0.5 - pupilRadius, pupilRadius)

  // Border
  ctx.lineStyle(1 * DPR, 0x000000, 0.5)
  ctx.strokeCircle(x, y, animRadius + 2 * DPR)

  // Draw health bar
  renderHealthBar(ctx, x, y, radius, currentLife, maxLife, shield)
}

/**
 * Render health bar
 */
function renderHealthBar(
  ctx: RenderContext,
  x: number,
  y: number,
  radius: number,
  currentLife: number,
  maxLife: number,
  shield: number,
): void {
  const barX = x - HEALTH_BAR.width / 2
  const barY = y - radius - HEALTH_BAR.offsetY

  // Health bar background
  ctx.fillStyle(HEALTH_BAR.backgroundColor, 1)
  ctx.fillRect(barX - 1, barY - 1, HEALTH_BAR.width + 2, HEALTH_BAR.height + 2)

  // Health bar fill
  const healthRatio = Math.max(0, Math.min(1, currentLife / maxLife))
  const healthWidth = Math.floor(HEALTH_BAR.width * healthRatio)
  const healthColor = getHealthBarColor(healthRatio)

  ctx.fillStyle(healthColor, 1)
  ctx.fillRect(barX, barY, healthWidth, HEALTH_BAR.height)

  // Shield bar
  if (shield > 0) {
    const shieldRatio = Math.min(1, shield / maxLife)
    const shieldWidth = Math.floor(HEALTH_BAR.width * shieldRatio)
    const shieldY = barY - HEALTH_BAR.height - 2

    ctx.fillStyle(HEALTH_BAR.backgroundColor, 1)
    ctx.fillRect(barX - 1, shieldY - 1, HEALTH_BAR.width + 2, HEALTH_BAR.height + 2)

    ctx.fillStyle(HEALTH_BAR.shieldColor, 1)
    ctx.fillRect(barX, shieldY, shieldWidth, HEALTH_BAR.height)
  }
}

/**
 * Monster renderer interface
 */
export interface MonsterRenderer {
  render(data: MonsterRenderData): void
  clear(): void
}

/**
 * Create a monster renderer
 */
export function createMonsterRenderer(ctx: RenderContext): MonsterRenderer {
  return {
    render(data: MonsterRenderData): void {
      renderMonster(ctx, data)
    },
    clear(): void {
      ctx.clear()
    },
  }
}
