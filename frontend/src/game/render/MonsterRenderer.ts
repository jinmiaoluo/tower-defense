/**
 * 怪物渲染器 - 简单动画风格
 */

import type { RenderContext, MonsterRenderData } from './types'
import { DPR } from '../dpr'

/** 血条配置（DPR 缩放） */
const HEALTH_BAR = {
  width: 20 * DPR,
  height: 3 * DPR,
  offsetY: 12 * DPR,
  backgroundColor: 0x000000,
  shieldColor: 0x00ffff,
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
 * 计算较暗的颜色
 */
function darkenColor(color: number, factor: number = 0.6): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor)
  const g = Math.floor(((color >> 8) & 0xff) * factor)
  const b = Math.floor((color & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

/**
 * 计算较亮的颜色
 */
function lightenColor(color: number, factor: number = 1.4): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor))
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor))
  const b = Math.min(255, Math.floor((color & 0xff) * factor))
  return (r << 16) | (g << 8) | b
}

/** 计算呼吸动画缩放 */
function calcBreath(frame: number, speed: number = 0.1): number {
  return 1 + Math.sin(frame * speed) * 0.08
}

/**
 * 渲染单个怪物
 */
export function renderMonster(ctx: RenderContext, data: MonsterRenderData): void {
  const { x, y, radius, color, currentLife, maxLife, shield, frame = 0 } = data

  const bodyColor = parseColor(color)
  const dark = darkenColor(bodyColor)
  const light = lightenColor(bodyColor)

  // 呼吸动画
  const scale = calcBreath(frame, 0.12)
  const animRadius = radius * scale

  // 外圈（阴影）
  ctx.fillStyle(dark, 1)
  ctx.fillCircle(x, y, animRadius + 2 * DPR)

  // 主体圆
  ctx.fillStyle(bodyColor, 1)
  ctx.fillCircle(x, y, animRadius)

  // 高光
  ctx.fillStyle(light, 0.6)
  ctx.fillCircle(x - animRadius * 0.3, y - animRadius * 0.3, animRadius * 0.4)

  // 眼睛
  const eyeOffset = animRadius * 0.25
  const eyeRadius = Math.max(2 * DPR, animRadius * 0.2)
  ctx.fillStyle(0x000000, 1)
  ctx.fillCircle(x - eyeOffset, y - eyeOffset * 0.5, eyeRadius)
  ctx.fillCircle(x + eyeOffset, y - eyeOffset * 0.5, eyeRadius)

  // 眼睛高光
  const pupilRadius = eyeRadius * 0.4
  ctx.fillStyle(0xffffff, 1)
  ctx.fillCircle(x - eyeOffset + pupilRadius, y - eyeOffset * 0.5 - pupilRadius, pupilRadius)
  ctx.fillCircle(x + eyeOffset + pupilRadius, y - eyeOffset * 0.5 - pupilRadius, pupilRadius)

  // 边框
  ctx.lineStyle(1 * DPR, 0x000000, 0.5)
  ctx.strokeCircle(x, y, animRadius + 2 * DPR)

  // 绘制血条
  renderHealthBar(ctx, x, y, radius, currentLife, maxLife, shield)
}

/**
 * 渲染血条
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
