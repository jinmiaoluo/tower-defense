/**
 * 怪物渲染器 - 像素艺术风格
 */

import type { RenderContext, MonsterRenderData } from './types'
import { DPR } from '../dpr'

/** 像素单位大小（DPR 缩放） */
const PIXEL_SIZE = 2 * DPR

/** 血条配置（DPR 缩放） */
const HEALTH_BAR = {
  width: 20 * DPR,
  height: 3 * DPR,
  offsetY: 12 * DPR,
  backgroundColor: 0x000000,
  shieldColor: 0x00ffff,
}

/** 怪物大小阈值（DPR 缩放） */
const SIZE_THRESHOLD = {
  small: 6 * DPR,
  medium: 10 * DPR,
}

/**
 * 根据血量百分比获取血条颜色
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
 * 将 CSS 颜色字符串转换为数字
 */
function parseColor(color: string): number {
  if (color.startsWith('#')) {
    return parseInt(color.slice(1), 16)
  }
  return 0xffffff
}

/**
 * 计算较暗的颜色（用于阴影）
 */
function darkenColor(color: number, factor: number = 0.6): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor)
  const g = Math.floor(((color >> 8) & 0xff) * factor)
  const b = Math.floor((color & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

/**
 * 计算较亮的颜色（用于高光）
 */
function lightenColor(color: number, factor: number = 1.4): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor))
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor))
  const b = Math.min(255, Math.floor((color & 0xff) * factor))
  return (r << 16) | (g << 8) | b
}

/**
 * 渲染单个怪物
 */
export function renderMonster(ctx: RenderContext, data: MonsterRenderData): void {
  const { x, y, radius, color, currentLife, maxLife, shield } = data

  const bodyColor = parseColor(color)

  // 根据大小选择不同的像素图案
  if (radius < SIZE_THRESHOLD.small) {
    renderSmallMonster(ctx, x, y, bodyColor)
  } else if (radius < SIZE_THRESHOLD.medium) {
    renderMediumMonster(ctx, x, y, bodyColor)
  } else {
    renderLargeMonster(ctx, x, y, bodyColor)
  }

  // 绘制血条
  renderHealthBar(ctx, x, y, radius, currentLife, maxLife, shield)
}

/**
 * 渲染小型怪物 - 像素史莱姆
 */
function renderSmallMonster(ctx: RenderContext, x: number, y: number, color: number): void {
  const p = PIXEL_SIZE
  const dark = darkenColor(color)
  const light = lightenColor(color)

  // 史莱姆形状（底宽顶窄）
  //   ##
  //  ####
  // ######

  // 底层（最宽）
  ctx.fillStyle(dark, 1)
  ctx.fillRect(x - p * 3, y + p, p * 6, p)

  // 中层
  ctx.fillStyle(color, 1)
  ctx.fillRect(x - p * 2, y - p, p * 4, p * 2)

  // 顶层
  ctx.fillStyle(color, 1)
  ctx.fillRect(x - p, y - p * 2, p * 2, p)

  // 高光
  ctx.fillStyle(light, 1)
  ctx.fillRect(x - p, y - p, p, p)

  // 眼睛
  ctx.fillStyle(0x000000, 1)
  ctx.fillRect(x - p, y, p, p)
  ctx.fillRect(x + p - 1, y, p, p)
}

/**
 * 渲染中型怪物 - 像素小人
 */
function renderMediumMonster(ctx: RenderContext, x: number, y: number, color: number): void {
  const p = PIXEL_SIZE
  const dark = darkenColor(color)
  const light = lightenColor(color)

  // 像素小人形状
  //  ##
  // ####
  //  ##
  // #  #

  // 头部
  ctx.fillStyle(color, 1)
  ctx.fillRect(x - p, y - p * 4, p * 2, p * 2)

  // 头部高光
  ctx.fillStyle(light, 1)
  ctx.fillRect(x - p, y - p * 4, p, p)

  // 眼睛
  ctx.fillStyle(0x000000, 1)
  ctx.fillRect(x - p + 1, y - p * 3, 2, 2)
  ctx.fillRect(x + 1, y - p * 3, 2, 2)

  // 身体
  ctx.fillStyle(color, 1)
  ctx.fillRect(x - p * 2, y - p * 2, p * 4, p * 3)

  // 身体阴影
  ctx.fillStyle(dark, 1)
  ctx.fillRect(x + p, y - p * 2, p, p * 3)

  // 腿
  ctx.fillStyle(dark, 1)
  ctx.fillRect(x - p * 2, y + p, p, p * 2)
  ctx.fillRect(x + p, y + p, p, p * 2)
}

/**
 * 渲染大型怪物 - 像素怪兽
 */
function renderLargeMonster(ctx: RenderContext, x: number, y: number, color: number): void {
  const p = PIXEL_SIZE
  const dark = darkenColor(color)
  const light = lightenColor(color)

  // 大型怪兽形状（带角）
  // #    #
  //  ####
  // ######
  // ######
  //  #  #

  // 角
  ctx.fillStyle(dark, 1)
  ctx.fillRect(x - p * 3, y - p * 5, p, p * 2)
  ctx.fillRect(x + p * 2, y - p * 5, p, p * 2)

  // 头部
  ctx.fillStyle(color, 1)
  ctx.fillRect(x - p * 2, y - p * 4, p * 4, p * 2)

  // 头部高光
  ctx.fillStyle(light, 1)
  ctx.fillRect(x - p * 2, y - p * 4, p * 2, p)

  // 眼睛（红色发光）
  ctx.fillStyle(0xff0000, 1)
  ctx.fillRect(x - p, y - p * 3, p, p)
  ctx.fillRect(x, y - p * 3, p, p)

  // 身体
  ctx.fillStyle(color, 1)
  ctx.fillRect(x - p * 3, y - p * 2, p * 6, p * 4)

  // 身体纹理
  ctx.fillStyle(dark, 1)
  ctx.fillRect(x - p * 2, y - p, p, p)
  ctx.fillRect(x + p, y, p, p)

  // 身体高光
  ctx.fillStyle(light, 1)
  ctx.fillRect(x - p * 3, y - p * 2, p, p * 2)

  // 腿
  ctx.fillStyle(dark, 1)
  ctx.fillRect(x - p * 2, y + p * 2, p * 2, p * 2)
  ctx.fillRect(x, y + p * 2, p * 2, p * 2)

  // 黑色轮廓（部分）
  ctx.lineStyle(1, 0x000000, 0.5)
  ctx.strokeRect(x - p * 3, y - p * 2, p * 6, p * 4)
}

/**
 * 渲染血条 - 像素风格
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

  // 血条背景
  ctx.fillStyle(HEALTH_BAR.backgroundColor, 1)
  ctx.fillRect(barX - 1, barY - 1, HEALTH_BAR.width + 2, HEALTH_BAR.height + 2)

  // 血量条
  const healthRatio = Math.max(0, Math.min(1, currentLife / maxLife))
  const healthWidth = Math.floor(HEALTH_BAR.width * healthRatio)
  const healthColor = getHealthBarColor(healthRatio)

  ctx.fillStyle(healthColor, 1)
  ctx.fillRect(barX, barY, healthWidth, HEALTH_BAR.height)

  // 护盾条
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
 * 怪物渲染器接口
 */
export interface MonsterRenderer {
  render(data: MonsterRenderData): void
  clear(): void
}

/**
 * 创建怪物渲染器
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
