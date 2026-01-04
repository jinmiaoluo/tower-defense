/**
 * 建筑选中渲染器
 * 负责渲染建筑选中时的视觉效果：金色攻击范围圆和格子高亮
 * 与旧实现保持一致（td-obj-building.js:342-359）
 */

import type { RenderContext } from './types'
import type { Position } from '@/types'
import { DPR } from '../dpr'

/** 选中渲染数据 */
export interface SelectionRenderData {
  centerX: number
  centerY: number
  gridSize: number
  range: number
  isWeapon: boolean
  position: Position
}

/** 选中颜色配置 */
export interface SelectionColors {
  rangeSelected: number
  gridHighlight: number
}

/**
 * 渲染建筑选中效果
 * 包含：格子高亮 + 武器建筑的攻击范围圆
 */
export function renderBuildingSelection(
  ctx: RenderContext,
  data: SelectionRenderData,
  colors: SelectionColors,
): void {
  const { centerX, centerY, gridSize, range, isWeapon } = data

  // 1. 渲染格子高亮（所有建筑都有）
  const highlightX = centerX - gridSize / 2
  const highlightY = centerY - gridSize / 2
  ctx.fillStyle(colors.gridHighlight, 0.2)
  ctx.fillRect(highlightX, highlightY, gridSize, gridSize)

  // 2. 武器建筑渲染攻击范围圆
  if (isWeapon && range > 0) {
    const rangePixels = range * gridSize

    // 填充圆（透明度 0.15，与旧实现一致）
    ctx.fillStyle(colors.rangeSelected, 0.15)
    ctx.fillCircle(centerX, centerY, rangePixels)

    // 描边圆
    ctx.lineStyle(1 * DPR, colors.rangeSelected, 1)
    ctx.strokeCircle(centerX, centerY, rangePixels)
  }
}
