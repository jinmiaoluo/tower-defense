/**
 * 建筑渲染器 - 像素艺术风格
 */

import type { RenderContext, BuildingRenderData } from './types'

/** 选中建筑的高亮颜色 */
const SELECTED_COLOR = 0x00ffff

/** 像素单位大小 */
const PIXEL_SIZE = 2

/** 像素风格建筑颜色配置 */
const PIXEL_COLORS = {
  wall: {
    brick: 0x8b4513,
    mortar: 0x5c3317,
    highlight: 0xa0522d,
  },
  cannon: {
    base: 0x228b22,
    dark: 0x006400,
    light: 0x32cd32,
    barrel: 0x2f4f4f,
  },
  LMG: {
    base: 0x4169e1,
    dark: 0x191970,
    light: 0x6495ed,
    barrel: 0x1e3a5f,
  },
  HMG: {
    base: 0xb22222,
    dark: 0x8b0000,
    light: 0xcd5c5c,
    barrel: 0x4a0404,
  },
  laser_gun: {
    crystal: 0xff0000,
    crystalLight: 0xff6666,
    base: 0x9400d3,
    baseLight: 0xba55d3,
  },
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
 * 绘制单个像素块
 */
function drawPixel(ctx: RenderContext, x: number, y: number, color: number): void {
  ctx.fillStyle(color, 1)
  ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE)
}

/**
 * 渲染墙 - 像素砖块风格
 */
function renderWall(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected } = data
  const gs2 = gridSize / 2
  const colors = PIXEL_COLORS.wall
  const startX = centerX - gs2 + 2
  const startY = centerY - gs2 + 2
  const size = gridSize - 4

  // 背景砂浆色
  ctx.fillStyle(colors.mortar, 1)
  ctx.fillRect(startX, startY, size, size)

  // 绘制砖块纹理（交错排列）
  const brickW = 6
  const brickH = 3
  for (let row = 0; row < Math.floor(size / brickH); row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2
    for (let col = -1; col < Math.ceil(size / brickW) + 1; col++) {
      const bx = startX + col * brickW + offset
      const by = startY + row * brickH
      if (bx >= startX && bx + brickW - 1 <= startX + size && by + brickH - 1 <= startY + size) {
        ctx.fillStyle(colors.brick, 1)
        ctx.fillRect(bx, by, brickW - 1, brickH - 1)
        // 高光像素
        drawPixel(ctx, bx, by, colors.highlight)
      }
    }
  }

  // 黑色边框
  ctx.lineStyle(2, 0x000000, 1)
  ctx.strokeRect(startX, startY, size, size)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2, SELECTED_COLOR, 1)
    ctx.strokeRect(centerX - gs2, centerY - gs2, gridSize, gridSize)
  }
}

/**
 * 渲染炮台 - 像素炮塔风格
 */
function renderCannon(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition } = data
  const gs2 = gridSize / 2
  const colors = PIXEL_COLORS.cannon
  const p = PIXEL_SIZE

  // 底座（大方块）
  const baseSize = 16
  const baseX = centerX - baseSize / 2
  const baseY = centerY - baseSize / 2

  // 深色底层
  ctx.fillStyle(colors.dark, 1)
  ctx.fillRect(baseX, baseY, baseSize, baseSize)

  // 主色中层
  ctx.fillStyle(colors.base, 1)
  ctx.fillRect(baseX + p, baseY + p, baseSize - p * 2, baseSize - p * 2)

  // 高光区域（左上角）
  ctx.fillStyle(colors.light, 1)
  ctx.fillRect(baseX + p, baseY + p, p * 3, p)
  ctx.fillRect(baseX + p, baseY + p * 2, p, p * 2)

  // 炮管（指向目标）
  const barrelLength = gs2
  const barrelWidth = 4
  let angle = 0

  if (targetPosition) {
    // 使用格子坐标差值计算方向，避免像素坐标偏移量问题
    const dx = targetPosition[0] - data.position[0]
    const dy = targetPosition[1] - data.position[1]
    angle = Math.atan2(dy, dx)
  }

  // 绘制像素化炮管
  const steps = Math.floor(barrelLength / p)
  for (let i = 0; i < steps; i++) {
    const bx = centerX + Math.cos(angle) * i * p - p / 2
    const by = centerY + Math.sin(angle) * i * p - p / 2
    ctx.fillStyle(i < 2 ? colors.dark : colors.barrel, 1)
    ctx.fillRect(Math.round(bx), Math.round(by), barrelWidth, barrelWidth)
  }

  // 中心炮座
  ctx.fillStyle(colors.dark, 1)
  ctx.fillRect(centerX - 3, centerY - 3, 6, 6)

  // 黑色边框
  ctx.lineStyle(1, 0x000000, 1)
  ctx.strokeRect(baseX, baseY, baseSize, baseSize)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2, SELECTED_COLOR, 1)
    ctx.strokeRect(centerX - gs2 + 2, centerY - gs2 + 2, gridSize - 4, gridSize - 4)
  }
}

/**
 * 渲染轻机枪 (LMG) - 像素精准塔风格
 */
function renderLMG(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition } = data
  const gs2 = gridSize / 2
  const colors = PIXEL_COLORS.LMG
  const p = PIXEL_SIZE

  // 底座（较小方块）
  const baseSize = 12
  const baseX = centerX - baseSize / 2
  const baseY = centerY - baseSize / 2

  // 深色底层
  ctx.fillStyle(colors.dark, 1)
  ctx.fillRect(baseX, baseY, baseSize, baseSize)

  // 主色层
  ctx.fillStyle(colors.base, 1)
  ctx.fillRect(baseX + p, baseY + p, baseSize - p * 2, baseSize - p * 2)

  // 高光
  ctx.fillStyle(colors.light, 1)
  ctx.fillRect(baseX + p, baseY + p, p * 2, p)
  ctx.fillRect(baseX + p, baseY + p * 2, p, p)

  // 枪管（细长）
  const barrelLength = gs2 + 2
  let angle = 0

  if (targetPosition) {
    // 使用格子坐标差值计算方向
    const dx = targetPosition[0] - data.position[0]
    const dy = targetPosition[1] - data.position[1]
    angle = Math.atan2(dy, dx)
  }

  // 绘制细长像素枪管
  const steps = Math.floor(barrelLength / p)
  for (let i = 0; i < steps; i++) {
    const bx = centerX + Math.cos(angle) * i * p - 1
    const by = centerY + Math.sin(angle) * i * p - 1
    ctx.fillStyle(colors.barrel, 1)
    ctx.fillRect(Math.round(bx), Math.round(by), 2, 2)
  }

  // 中心点
  ctx.fillStyle(colors.dark, 1)
  ctx.fillRect(centerX - 2, centerY - 2, 4, 4)

  // 黑色边框
  ctx.lineStyle(1, 0x000000, 1)
  ctx.strokeRect(baseX, baseY, baseSize, baseSize)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2, SELECTED_COLOR, 1)
    ctx.strokeRect(centerX - gs2 + 4, centerY - gs2 + 4, gridSize - 8, gridSize - 8)
  }
}

/**
 * 渲染重机枪 (HMG) - 像素重型塔风格
 */
function renderHMG(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected, targetPosition } = data
  const gs2 = gridSize / 2
  const colors = PIXEL_COLORS.HMG
  const p = PIXEL_SIZE

  // 底座（大方块）
  const baseSize = 20
  const baseX = centerX - baseSize / 2
  const baseY = centerY - baseSize / 2

  // 深色底层
  ctx.fillStyle(colors.dark, 1)
  ctx.fillRect(baseX, baseY, baseSize, baseSize)

  // 主色层
  ctx.fillStyle(colors.base, 1)
  ctx.fillRect(baseX + p, baseY + p, baseSize - p * 2, baseSize - p * 2)

  // 中心区域（更亮）
  ctx.fillStyle(colors.light, 1)
  ctx.fillRect(baseX + p * 2, baseY + p * 2, baseSize - p * 4, baseSize - p * 4)

  // 高光（左上角）
  ctx.fillStyle(0xee6666, 1)
  ctx.fillRect(baseX + p, baseY + p, p * 3, p)
  ctx.fillRect(baseX + p, baseY + p * 2, p * 2, p)

  // 粗枪管
  const barrelLength = gs2 + 4
  const barrelWidth = 6
  let angle = 0

  if (targetPosition) {
    // 使用格子坐标差值计算方向
    const dx = targetPosition[0] - data.position[0]
    const dy = targetPosition[1] - data.position[1]
    angle = Math.atan2(dy, dx)
  }

  // 绘制粗像素枪管（双排）
  const steps = Math.floor(barrelLength / p)
  for (let i = 0; i < steps; i++) {
    const bx = centerX + Math.cos(angle) * i * p - barrelWidth / 2
    const by = centerY + Math.sin(angle) * i * p - barrelWidth / 2
    ctx.fillStyle(i < 3 ? colors.dark : colors.barrel, 1)
    ctx.fillRect(Math.round(bx), Math.round(by), barrelWidth, barrelWidth)
  }

  // 中心炮座
  ctx.fillStyle(colors.dark, 1)
  ctx.fillRect(centerX - 4, centerY - 4, 8, 8)
  ctx.fillStyle(0x660000, 1)
  ctx.fillRect(centerX - 2, centerY - 2, 4, 4)

  // 黑色边框
  ctx.lineStyle(1, 0x000000, 1)
  ctx.strokeRect(baseX, baseY, baseSize, baseSize)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2, SELECTED_COLOR, 1)
    ctx.strokeRect(centerX - gs2 + 1, centerY - gs2 + 1, gridSize - 2, gridSize - 2)
  }
}

/**
 * 渲染激光枪 - 像素水晶塔风格
 */
function renderLaserGun(ctx: RenderContext, data: BuildingRenderData): void {
  const { centerX, centerY, gridSize, isSelected } = data
  const gs2 = gridSize / 2
  const colors = PIXEL_COLORS.laser_gun
  const p = PIXEL_SIZE

  // 紫色底座
  const baseSize = 14
  const baseX = centerX - baseSize / 2
  const baseY = centerY - baseSize / 2 + 2

  ctx.fillStyle(colors.base, 1)
  ctx.fillRect(baseX, baseY, baseSize, baseSize)

  ctx.fillStyle(colors.baseLight, 1)
  ctx.fillRect(baseX + p, baseY + p, baseSize - p * 2, baseSize - p * 2)

  // 像素化红色水晶（金字塔形状）
  const crystalLevels = [
    { width: 2, yOffset: -10 },
    { width: 4, yOffset: -8 },
    { width: 6, yOffset: -6 },
    { width: 8, yOffset: -4 },
    { width: 10, yOffset: -2 },
  ]

  for (const level of crystalLevels) {
    const lx = centerX - level.width / 2
    const ly = centerY + level.yOffset
    ctx.fillStyle(colors.crystal, 1)
    ctx.fillRect(lx, ly, level.width, p)
    // 高光
    if (level.width > 2) {
      ctx.fillStyle(colors.crystalLight, 1)
      ctx.fillRect(lx, ly, p, p)
    }
  }

  // 水晶顶端高光
  ctx.fillStyle(0xffffff, 1)
  ctx.fillRect(centerX - 1, centerY - 10, 2, 2)

  // 中心能量核心
  ctx.fillStyle(0x000000, 1)
  ctx.fillRect(centerX - 3, centerY, 6, 6)
  ctx.fillStyle(colors.crystal, 1)
  ctx.fillRect(centerX - 2, centerY + 1, 4, 4)

  // 底座边框
  ctx.lineStyle(1, 0x000000, 1)
  ctx.strokeRect(baseX, baseY, baseSize, baseSize)

  // 选中高亮
  if (isSelected) {
    ctx.lineStyle(2, SELECTED_COLOR, 1)
    ctx.strokeRect(centerX - gs2 + 3, centerY - gs2 + 3, gridSize - 6, gridSize - 6)
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
