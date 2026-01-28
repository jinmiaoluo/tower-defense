/**
 * Building renderer tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderBuilding, createBuildingRenderer } from './BuildingRenderer'
import type { RenderContext, BuildingRenderData } from './types'

/** Create mock render context */
function createMockContext(): RenderContext & { calls: string[] } {
  const calls: string[] = []

  return {
    calls,
    clear: vi.fn(() => calls.push('clear')),
    fillStyle: vi.fn((color, alpha) => calls.push(`fillStyle(${color}, ${alpha})`)),
    lineStyle: vi.fn((width, color, alpha) => calls.push(`lineStyle(${width}, ${color}, ${alpha})`)),
    fillRect: vi.fn(() => calls.push('fillRect')),
    strokeRect: vi.fn(() => calls.push('strokeRect')),
    fillCircle: vi.fn(() => calls.push('fillCircle')),
    strokeCircle: vi.fn(() => calls.push('strokeCircle')),
    beginPath: vi.fn(() => calls.push('beginPath')),
    closePath: vi.fn(() => calls.push('closePath')),
    moveTo: vi.fn(() => calls.push('moveTo')),
    lineTo: vi.fn(() => calls.push('lineTo')),
    fill: vi.fn(() => calls.push('fill')),
    stroke: vi.fn(() => calls.push('stroke')),
    lineBetween: vi.fn(() => calls.push('lineBetween')),
    fillTriangle: vi.fn(() => calls.push('fillTriangle')),
    strokeTriangle: vi.fn(() => calls.push('strokeTriangle')),
  }
}

describe('BuildingRenderer', () => {
  let ctx: RenderContext & { calls: string[] }

  beforeEach(() => {
    ctx = createMockContext()
  })

  describe('renderBuilding', () => {
    it('should draw blocks when rendering a wall', () => {
      const data: BuildingRenderData = {
        id: 'wall-1',
        type: 'wall',
        position: [5, 5],
        level: 1,
        centerX: 176,
        centerY: 176,
        gridSize: 32,
        isSelected: false,
      }

      renderBuilding(ctx, data)

      // Simple style uses fillRect to draw blocks
      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      expect(fillRectCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('should draw circular base and barrel when rendering a cannon', () => {
      const data: BuildingRenderData = {
        id: 'cannon-1',
        type: 'cannon',
        position: [5, 5],
        level: 1,
        centerX: 176,
        centerY: 176,
        gridSize: 32,
        isSelected: false,
        targetPosition: [8, 5],
      }

      renderBuilding(ctx, data)

      // Simple style uses fillCircle to draw circular base
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(3)
      // Uses lineBetween to draw barrel
      expect(ctx.lineBetween).toHaveBeenCalled()
    })

    it('should draw circular base and barrel when rendering LMG', () => {
      const data: BuildingRenderData = {
        id: 'lmg-1',
        type: 'LMG',
        position: [5, 5],
        level: 1,
        centerX: 176,
        centerY: 176,
        gridSize: 32,
        isSelected: false,
        targetPosition: [8, 5],
      }

      renderBuilding(ctx, data)

      // Simple style uses fillCircle to draw
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(3)
    })

    it('should draw large circular base and thick barrel when rendering HMG', () => {
      const data: BuildingRenderData = {
        id: 'hmg-1',
        type: 'HMG',
        position: [5, 5],
        level: 1,
        centerX: 176,
        centerY: 176,
        gridSize: 32,
        isSelected: false,
        targetPosition: [8, 5],
      }

      renderBuilding(ctx, data)

      // HMG has multiple circle layers
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(4)
    })

    it('should draw triangle crystal when rendering laser gun', () => {
      const data: BuildingRenderData = {
        id: 'laser-1',
        type: 'laser_gun',
        position: [5, 5],
        level: 1,
        centerX: 176,
        centerY: 176,
        gridSize: 32,
        isSelected: false,
      }

      renderBuilding(ctx, data)

      // Laser gun uses triangles to draw crystal
      const fillTriangleCalls = (ctx.fillTriangle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillTriangleCalls.length).toBeGreaterThanOrEqual(1)
      // Also uses circles to draw base and energy point
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('should draw highlight border when building is selected', () => {
      const data: BuildingRenderData = {
        id: 'cannon-1',
        type: 'cannon',
        position: [5, 5],
        level: 1,
        centerX: 176,
        centerY: 176,
        gridSize: 32,
        isSelected: true,
        targetPosition: [8, 5],
      }

      renderBuilding(ctx, data)

      // Check if the selection color (cyan 0x00ffff) was used
      const lineStyleCalls = (ctx.lineStyle as ReturnType<typeof vi.fn>).mock.calls
      const hasSelectedColor = lineStyleCalls.some((call) => call[1] === 0x00ffff)
      expect(hasSelectedColor).toBe(true)
    })
  })

  describe('createBuildingRenderer', () => {
    it('should create a building renderer', () => {
      const renderer = createBuildingRenderer(ctx)

      expect(renderer).toBeDefined()
      expect(typeof renderer.render).toBe('function')
      expect(typeof renderer.clear).toBe('function')
    })

    it('should render multiple buildings', () => {
      const renderer = createBuildingRenderer(ctx)

      const buildings: BuildingRenderData[] = [
        {
          id: 'wall-1',
          type: 'wall',
          position: [0, 0],
          level: 1,
          centerX: 16,
          centerY: 16,
          gridSize: 32,
          isSelected: false,
        },
        {
          id: 'cannon-1',
          type: 'cannon',
          position: [1, 0],
          level: 1,
          centerX: 48,
          centerY: 16,
          gridSize: 32,
          isSelected: false,
          targetPosition: [5, 0],
        },
      ]

      renderer.clear()
      for (const building of buildings) {
        renderer.render(building)
      }

      // Should call clear once, then call render for each building
      expect(ctx.clear).toHaveBeenCalledTimes(1)
    })
  })
})
