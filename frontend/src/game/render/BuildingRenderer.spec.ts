/**
 * 建筑渲染器测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderBuilding, createBuildingRenderer } from './BuildingRenderer'
import type { RenderContext, BuildingRenderData } from './types'

/** 创建 Mock 渲染上下文 */
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
    it('渲染墙应绘制方块', () => {
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

      // 简单风格使用 fillRect 绘制方块
      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      expect(fillRectCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('渲染炮台应绘制圆形底座和炮管', () => {
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

      // 简单风格使用 fillCircle 绘制圆形底座
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(3)
      // 使用 lineBetween 绘制炮管
      expect(ctx.lineBetween).toHaveBeenCalled()
    })

    it('渲染 LMG 应绘制圆形底座和枪管', () => {
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

      // 简单风格使用 fillCircle 绘制
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(3)
    })

    it('渲染 HMG 应绘制大圆形底座和粗枪管', () => {
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

      // HMG 有多层圆形
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(4)
    })

    it('渲染激光枪应绘制三角形水晶', () => {
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

      // 激光枪使用三角形绘制水晶
      const fillTriangleCalls = (ctx.fillTriangle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillTriangleCalls.length).toBeGreaterThanOrEqual(1)
      // 也使用圆形绘制底座和能量点
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('选中建筑应绘制高亮边框', () => {
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

      // 检查是否使用了选中颜色（青色 0x00ffff）
      const lineStyleCalls = (ctx.lineStyle as ReturnType<typeof vi.fn>).mock.calls
      const hasSelectedColor = lineStyleCalls.some((call) => call[1] === 0x00ffff)
      expect(hasSelectedColor).toBe(true)
    })
  })

  describe('createBuildingRenderer', () => {
    it('应创建批量渲染器', () => {
      const renderer = createBuildingRenderer(ctx)

      expect(renderer).toBeDefined()
      expect(typeof renderer.render).toBe('function')
      expect(typeof renderer.clear).toBe('function')
    })

    it('批量渲染多个建筑', () => {
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

      // 应该调用 clear 一次，然后为每个建筑调用渲染函数
      expect(ctx.clear).toHaveBeenCalledTimes(1)
    })
  })
})
