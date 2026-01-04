/**
 * 建筑渲染器 - 简单动画风格
 */

import type { RenderContext, BuildingRenderData } from './types'
import { DPR } from '../dpr'

/** 选中建筑的高亮颜色 */
const SELECTED_COLOR = 0x00ffff

/** 简单风格建筑颜色配置 */
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

/** 计算呼吸动画缩放 */
function calcBreath(frame: number, speed: number = 0.08): number {
  return 1 + Math.sin(frame * speed) * 0.05
}

/** 计算脉冲动画亮度 */
function calcPulse(frame: number, speed: number = 0.1): number {
  return (Math.sin(frame * speed) + 1) / 2
}

/** 调整颜色亮度 */
function adjustBrightness(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor))
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor))
  const b = Math.min(255, Math.floor((color & 0xff) * factor))
  return (r << 16) | (g << 8) | b
}

/**
 * 渲染单个建筑
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
 * 渲染墙 - 简单方块
 */
function renderWall(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, frame = 0 } = data
  const colors = COLORS.wall
  const size = gridSize - 4 * DPR
  const half = size / 2

  // 简单呼吸动画
  const scale = calcBreath(frame, 0.05)
  const animSize = size * scale
  const animHalf = animSize / 2

  // 外层深色
  ctx.fillStyle(colors.dark, 1)
  ctx.fillRect(centerX - animHalf, centerY - animHalf, animSize, animSize)

  // 内层主色
  const innerSize = animSize - 4 * DPR
  ctx.fillStyle(colors.base, 1)
  ctx.fillRect(centerX - innerSize / 2, centerY - innerSize / 2, innerSize, innerSize)

  // 高光
  ctx.fillStyle(colors.light, 1)
  ctx.fillRect(centerX - innerSize / 2, centerY - innerSize / 2, innerSize / 3, 3 * DPR)

  // 边框
  ctx.lineStyle(1 * DPR, 0x000000, 1)
  ctx.strokeRect(centerX - animHalf, centerY - animHalf, animSize, animSize)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeRect(centerX - half - 2 * DPR, centerY - half - 2 * DPR, size + 4 * DPR, size + 4 * DPR)
  }
}

/**
 * 渲染炮台 - 圆形底座 + 炮管
 */
function renderCannon(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition, frame = 0 } = data
  const colors = COLORS.cannon
  const baseRadius = 10 * DPR

  // 呼吸动画
  const scale = calcBreath(frame, 0.06)
  const animRadius = baseRadius * scale

  // 外圈深色
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(centerX, centerY, animRadius + 2 * DPR)

  // 主圆
  ctx.fillStyle(colors.base, 1)
  ctx.fillCircle(centerX, centerY, animRadius)

  // 高光
  ctx.fillStyle(colors.light, 1)
  ctx.fillCircle(centerX - 3 * DPR, centerY - 3 * DPR, 4 * DPR)

  // 炮管
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

  // 炮口
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(endX, endY, 3 * DPR)

  // 边框
  ctx.lineStyle(1 * DPR, 0x000000, 1)
  ctx.strokeCircle(centerX, centerY, animRadius + 2 * DPR)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeCircle(centerX, centerY, baseRadius + 6 * DPR)
  }
}

/**
 * 渲染轻机枪 - 小圆形底座 + 细枪管
 */
function renderLMG(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition, frame = 0 } = data
  const colors = COLORS.LMG
  const baseRadius = 8 * DPR

  // 呼吸动画
  const scale = calcBreath(frame, 0.07)
  const animRadius = baseRadius * scale

  // 外圈
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(centerX, centerY, animRadius + 2 * DPR)

  // 主圆
  ctx.fillStyle(colors.base, 1)
  ctx.fillCircle(centerX, centerY, animRadius)

  // 高光
  ctx.fillStyle(colors.light, 1)
  ctx.fillCircle(centerX - 2 * DPR, centerY - 2 * DPR, 3 * DPR)

  // 枪管
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

  // 边框
  ctx.lineStyle(1 * DPR, 0x000000, 1)
  ctx.strokeCircle(centerX, centerY, animRadius + 2 * DPR)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeCircle(centerX, centerY, baseRadius + 5 * DPR)
  }
}

/**
 * 渲染重机枪 - 大圆形底座 + 粗枪管
 */
function renderHMG(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition, frame = 0 } = data
  const colors = COLORS.HMG
  const baseRadius = 12 * DPR

  // 呼吸动画
  const scale = calcBreath(frame, 0.05)
  const animRadius = baseRadius * scale

  // 外圈
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(centerX, centerY, animRadius + 3 * DPR)

  // 主圆
  ctx.fillStyle(colors.base, 1)
  ctx.fillCircle(centerX, centerY, animRadius)

  // 内圈
  ctx.fillStyle(colors.light, 1)
  ctx.fillCircle(centerX, centerY, animRadius - 4 * DPR)

  // 高光
  ctx.fillStyle(0xffffff, 0.3)
  ctx.fillCircle(centerX - 4 * DPR, centerY - 4 * DPR, 4 * DPR)

  // 粗枪管
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

  // 炮口
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(endX, endY, 4 * DPR)

  // 边框
  ctx.lineStyle(1 * DPR, 0x000000, 1)
  ctx.strokeCircle(centerX, centerY, animRadius + 3 * DPR)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeCircle(centerX, centerY, baseRadius + 6 * DPR)
  }
}

/**
 * 渲染激光枪 - 三角形 + 脉冲动画
 */
function renderLaserGun(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, isSelected, frame = 0 } = data
  const colors = COLORS.laser_gun
  const size = 12 * DPR

  // 脉冲动画
  const pulse = calcPulse(frame, 0.12)
  const crystalColor = adjustBrightness(colors.crystal, 0.8 + pulse * 0.4)

  // 底座圆形
  ctx.fillStyle(colors.dark, 1)
  ctx.fillCircle(centerX, centerY + 4 * DPR, 10 * DPR)

  ctx.fillStyle(colors.base, 1)
  ctx.fillCircle(centerX, centerY + 4 * DPR, 8 * DPR)

  // 水晶三角形
  const topY = centerY - size
  const bottomY = centerY + 2 * DPR
  const halfWidth = 6 * DPR

  ctx.fillStyle(crystalColor, 1)
  ctx.fillTriangle(
    centerX, topY,
    centerX - halfWidth, bottomY,
    centerX + halfWidth, bottomY
  )

  // 水晶高光
  ctx.fillStyle(0xffffff, 0.5)
  ctx.fillTriangle(
    centerX - 2 * DPR, topY + 4 * DPR,
    centerX - halfWidth + 2 * DPR, bottomY - 4 * DPR,
    centerX - 1 * DPR, bottomY - 4 * DPR
  )

  // 水晶边框
  ctx.lineStyle(1 * DPR, colors.dark, 1)
  ctx.strokeTriangle(
    centerX, topY,
    centerX - halfWidth, bottomY,
    centerX + halfWidth, bottomY
  )

  // 中心能量点
  const energyRadius = 2 * DPR + pulse * 1 * DPR
  ctx.fillStyle(0xffffff, 1)
  ctx.fillCircle(centerX, centerY - 2 * DPR, energyRadius)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2 * DPR, SELECTED_COLOR, 1)
    ctx.strokeCircle(centerX, centerY, 14 * DPR)
  }
}

/**
 * 建筑渲染器接口
 */
export interface BuildingRenderer {
  render(data: BuildingRenderData): void
  clear(): void
}

/**
 * 创建建筑渲染器
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
