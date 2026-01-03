/**
 * 子弹渲染器
 * 参考旧实现：html5-tower-defense/src/js/td-obj-building.js
 */

import type { RenderContext, BulletRenderData } from './types'

/** 拖尾配置 */
const TRAIL = {
  segments: 4,
  minSpeed: 1,
}

/** 默认子弹颜色 */
const DEFAULT_COLOR = 0x000000

/**
 * 渲染单个子弹
 */
export function renderBullet(ctx: RenderContext, data: BulletRenderData): void {
  const { x, y, radius, vx, vy, color = DEFAULT_COLOR } = data

  const speed = Math.sqrt(vx * vx + vy * vy)

  // 绘制拖尾效果（仅当有速度时）
  if (speed > TRAIL.minSpeed) {
    renderTrail(ctx, x, y, radius, vx, vy, speed, color)
  }

  // 绘制主子弹
  ctx.fillStyle(color, 1)
  ctx.fillCircle(x, y, radius)
}

/**
 * 渲染拖尾效果
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
  // 计算单位方向向量（反向，用于拖尾）
  const dx = -vx / speed
  const dy = -vy / speed

  // 拖尾间距
  const spacing = radius * 1.5

  for (let i = 1; i <= TRAIL.segments; i++) {
    const trailX = x + dx * spacing * i
    const trailY = y + dy * spacing * i

    // 透明度随距离递减
    const alpha = 1 - i / (TRAIL.segments + 1)
    // 半径随距离递减
    const trailRadius = radius * (1 - i * 0.15)

    ctx.fillStyle(color, alpha)
    ctx.fillCircle(trailX, trailY, Math.max(1, trailRadius))
  }
}

/**
 * 子弹渲染器接口
 */
export interface BulletRenderer {
  render(data: BulletRenderData): void
  clear(): void
}

/**
 * 创建子弹渲染器
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
