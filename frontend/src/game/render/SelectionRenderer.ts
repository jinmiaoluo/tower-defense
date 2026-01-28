/**
 * Building selection renderer
 * Renders visual effects when a building is selected: golden attack range circle and grid highlight
 * Consistent with legacy implementation (td-obj-building.js:342-359)
 */

import type { RenderContext } from './types'
import type { Position } from '@/types'
import { DPR } from '../dpr'

/** Selection render data */
export interface SelectionRenderData {
  centerX: number
  centerY: number
  gridSize: number
  range: number
  isWeapon: boolean
  position: Position
}

/** Selection color configuration */
export interface SelectionColors {
  rangeSelected: number
  gridHighlight: number
}

/**
 * Render building selection effect
 * Includes: grid highlight + attack range circle for weapon buildings
 */
export function renderBuildingSelection(
  ctx: RenderContext,
  data: SelectionRenderData,
  colors: SelectionColors,
): void {
  const { centerX, centerY, gridSize, range, isWeapon } = data

  // 1. Render grid highlight (all buildings have this)
  const highlightX = centerX - gridSize / 2
  const highlightY = centerY - gridSize / 2
  ctx.fillStyle(colors.gridHighlight, 0.2)
  ctx.fillRect(highlightX, highlightY, gridSize, gridSize)

  // 2. Render attack range circle for weapon buildings
  if (isWeapon && range > 0) {
    const rangePixels = range * gridSize

    // Fill circle (alpha 0.15, consistent with legacy implementation)
    ctx.fillStyle(colors.rangeSelected, 0.15)
    ctx.fillCircle(centerX, centerY, rangePixels)

    // Stroke circle
    ctx.lineStyle(1 * DPR, colors.rangeSelected, 1)
    ctx.strokeCircle(centerX, centerY, rangePixels)
  }
}
