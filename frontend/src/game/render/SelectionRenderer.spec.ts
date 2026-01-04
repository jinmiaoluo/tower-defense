/**
 * 建筑选中渲染器测试
 * TDD: 先编写测试，再实现功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  renderBuildingSelection,
  type SelectionRenderData,
  type SelectionColors,
} from './SelectionRenderer'
import type { RenderContext } from './types'

/** 创建 Mock 渲染上下文 */
function createMockContext(): RenderContext & {
  calls: Array<{ method: string; args: unknown[] }>
} {
  const calls: Array<{ method: string; args: unknown[] }> = []

  const createSpy = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls.push({ method: name, args })
    })

  return {
    calls,
    clear: createSpy('clear'),
    fillStyle: createSpy('fillStyle'),
    lineStyle: createSpy('lineStyle'),
    fillRect: createSpy('fillRect'),
    strokeRect: createSpy('strokeRect'),
    fillCircle: createSpy('fillCircle'),
    strokeCircle: createSpy('strokeCircle'),
    beginPath: createSpy('beginPath'),
    closePath: createSpy('closePath'),
    moveTo: createSpy('moveTo'),
    lineTo: createSpy('lineTo'),
    fill: createSpy('fill'),
    stroke: createSpy('stroke'),
    lineBetween: createSpy('lineBetween'),
    fillTriangle: createSpy('fillTriangle'),
    strokeTriangle: createSpy('strokeTriangle'),
  }
}

/** 默认选中颜色（金色，与旧实现一致） */
const defaultColors: SelectionColors = {
  rangeSelected: 0xbb8d20,
  gridHighlight: 0xbb8d20,
}

describe('SelectionRenderer', () => {
  let ctx: ReturnType<typeof createMockContext>

  beforeEach(() => {
    ctx = createMockContext()
  })

  describe('renderBuildingSelection', () => {
    it('选中武器建筑时应渲染金色攻击范围圆（带填充和描边）', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // 验证使用了金色填充
      const fillStyleCalls = ctx.calls.filter((c) => c.method === 'fillStyle')
      const hasFillWithGoldenColor = fillStyleCalls.some(
        (c) => c.args[0] === 0xbb8d20
      )
      expect(hasFillWithGoldenColor).toBe(true)

      // 验证渲染了填充圆
      const fillCircleCalls = ctx.calls.filter((c) => c.method === 'fillCircle')
      expect(fillCircleCalls.length).toBeGreaterThan(0)

      // 验证使用了金色描边
      const lineStyleCalls = ctx.calls.filter((c) => c.method === 'lineStyle')
      const hasStrokeWithGoldenColor = lineStyleCalls.some(
        (c) => c.args[1] === 0xbb8d20
      )
      expect(hasStrokeWithGoldenColor).toBe(true)

      // 验证渲染了描边圆
      const strokeCircleCalls = ctx.calls.filter(
        (c) => c.method === 'strokeCircle'
      )
      expect(strokeCircleCalls.length).toBeGreaterThan(0)
    })

    it('攻击范围圆的填充透明度应为 0.15（与旧实现一致）', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // 验证范围圆填充透明度为 0.15（查找紧跟 fillCircle 的 fillStyle）
      const fillCircleIndex = ctx.calls.findIndex(
        (c) => c.method === 'fillCircle'
      )
      expect(fillCircleIndex).toBeGreaterThan(0)

      // fillCircle 前面的 fillStyle 应该是范围圆的填充设置
      const rangeFillStyle = ctx.calls
        .slice(0, fillCircleIndex)
        .reverse()
        .find((c) => c.method === 'fillStyle')

      expect(rangeFillStyle).toBeDefined()
      expect(rangeFillStyle?.args[0]).toBe(0xbb8d20)
      expect(rangeFillStyle?.args[1]).toBe(0.15)
    })

    it('应渲染格子高亮效果', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // 验证渲染了格子高亮矩形
      const fillRectCalls = ctx.calls.filter((c) => c.method === 'fillRect')
      expect(fillRectCalls.length).toBeGreaterThan(0)
    })

    it('非武器建筑（墙）不应渲染攻击范围圆', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 0,
        isWeapon: false,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // 验证没有渲染攻击范围圆
      const fillCircleCalls = ctx.calls.filter((c) => c.method === 'fillCircle')
      expect(fillCircleCalls.length).toBe(0)

      const strokeCircleCalls = ctx.calls.filter(
        (c) => c.method === 'strokeCircle'
      )
      expect(strokeCircleCalls.length).toBe(0)
    })

    it('非武器建筑（墙）仍应渲染格子高亮', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 0,
        isWeapon: false,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // 验证仍然渲染了格子高亮
      const fillRectCalls = ctx.calls.filter((c) => c.method === 'fillRect')
      expect(fillRectCalls.length).toBeGreaterThan(0)
    })

    it('攻击范围圆半径应正确计算（range * gridSize）', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // 验证圆的半径为 range * gridSize = 4 * 32 = 128
      const fillCircleCall = ctx.calls.find((c) => c.method === 'fillCircle')
      expect(fillCircleCall).toBeDefined()
      expect(fillCircleCall?.args[2]).toBe(128)
    })

    it('格子高亮应正确定位在建筑位置', () => {
      const data: SelectionRenderData = {
        centerX: 116,
        centerY: 116,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // 验证格子高亮矩形的位置
      const fillRectCalls = ctx.calls.filter((c) => c.method === 'fillRect')
      expect(fillRectCalls.length).toBeGreaterThan(0)

      // 格子左上角应该是 centerX - gridSize/2, centerY - gridSize/2
      const expectedX = 116 - 16
      const expectedY = 116 - 16
      const highlightCall = fillRectCalls[0]
      expect(highlightCall.args[0]).toBe(expectedX)
      expect(highlightCall.args[1]).toBe(expectedY)
      expect(highlightCall.args[2]).toBe(32)
      expect(highlightCall.args[3]).toBe(32)
    })
  })
})
