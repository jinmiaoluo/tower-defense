/**
 * Bullet renderer
 * Reference: html5-tower-defense/src/js/td-obj-building.js
 */

import type { RenderContext, BulletRenderData } from './types'

/** Trail configuration */
const TRAIL = {
  segments: 4,
  minSpeed: 1,
}

/** Default bullet color */
const DEFAULT_COLOR = 0x000000

/**
 * Render a single bullet
 */
export function renderBullet(ctx: RenderContext, data: BulletRenderData): void {
  const { x, y, radius, vx, vy, color = DEFAULT_COLOR } = data

  const speed = Math.sqrt(vx * vx + vy * vy)

  // Draw trail effect (only when moving)
  if (speed > TRAIL.minSpeed) {
    renderTrail(ctx, x, y, radius, vx, vy, speed, color)
  }

  // Draw main bullet
  ctx.fillStyle(color, 1)
  ctx.fillCircle(x, y, radius)
}

/**
 * Render trail effect
 */
function renderTrail(
  ctx: RenderContext,
  x: number,
  y: number,
  radius: number,
  vx: number,
  vy: number,
  speed: number,
  color: number,
): void {
  // Calculate unit direction vector (reversed, for trail)
  const dx = -vx / speed
  const dy = -vy / speed

  // Trail spacing
  const spacing = radius * 1.5

  for (let i = 1; i <= TRAIL.segments; i++) {
    const trailX = x + dx * spacing * i
    const trailY = y + dy * spacing * i

    // Alpha decreases with distance
    const alpha = 1 - i / (TRAIL.segments + 1)
    // Radius decreases with distance
    const trailRadius = radius * (1 - i * 0.15)

    ctx.fillStyle(color, alpha)
    ctx.fillCircle(trailX, trailY, Math.max(1, trailRadius))
  }
}

/**
 * Bullet renderer interface
 */
export interface BulletRenderer {
  render(data: BulletRenderData): void
  clear(): void
}

/**
 * Create a bullet renderer
 */
export function createBulletRenderer(ctx: RenderContext): BulletRenderer {
  return {
    render(data: BulletRenderData): void {
      renderBullet(ctx, data)
    },
    clear(): void {
      ctx.clear()
    },
  }
}
