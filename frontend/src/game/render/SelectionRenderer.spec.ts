/**
 * Building selection renderer tests
 * TDD: write tests first, then implement functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  renderBuildingSelection,
  type SelectionRenderData,
  type SelectionColors,
} from './SelectionRenderer'
import type { RenderContext } from './types'

/** Create mock render context */
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

/** Default selection colors (golden, consistent with legacy implementation) */
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
    it('should render golden attack range circle (with fill and stroke) when weapon building is selected', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // Verify golden fill was used
      const fillStyleCalls = ctx.calls.filter((c) => c.method === 'fillStyle')
      const hasFillWithGoldenColor = fillStyleCalls.some(
        (c) => c.args[0] === 0xbb8d20
      )
      expect(hasFillWithGoldenColor).toBe(true)

      // Verify fill circle was rendered
      const fillCircleCalls = ctx.calls.filter((c) => c.method === 'fillCircle')
      expect(fillCircleCalls.length).toBeGreaterThan(0)

      // Verify golden stroke was used
      const lineStyleCalls = ctx.calls.filter((c) => c.method === 'lineStyle')
      const hasStrokeWithGoldenColor = lineStyleCalls.some(
        (c) => c.args[1] === 0xbb8d20
      )
      expect(hasStrokeWithGoldenColor).toBe(true)

      // Verify stroke circle was rendered
      const strokeCircleCalls = ctx.calls.filter(
        (c) => c.method === 'strokeCircle'
      )
      expect(strokeCircleCalls.length).toBeGreaterThan(0)
    })

    it('should have fill alpha of 0.15 for attack range circle (consistent with legacy)', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // Verify range circle fill alpha is 0.15 (find fillStyle preceding fillCircle)
      const fillCircleIndex = ctx.calls.findIndex(
        (c) => c.method === 'fillCircle'
      )
      expect(fillCircleIndex).toBeGreaterThan(0)

      // The fillStyle before fillCircle should be the range circle fill setting
      const rangeFillStyle = ctx.calls
        .slice(0, fillCircleIndex)
        .reverse()
        .find((c) => c.method === 'fillStyle')

      expect(rangeFillStyle).toBeDefined()
      expect(rangeFillStyle?.args[0]).toBe(0xbb8d20)
      expect(rangeFillStyle?.args[1]).toBe(0.15)
    })

    it('should render grid highlight effect', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // Verify grid highlight rect was rendered
      const fillRectCalls = ctx.calls.filter((c) => c.method === 'fillRect')
      expect(fillRectCalls.length).toBeGreaterThan(0)
    })

    it('should not render attack range circle for non-weapon building (wall)', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 0,
        isWeapon: false,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // Verify no attack range circle was rendered
      const fillCircleCalls = ctx.calls.filter((c) => c.method === 'fillCircle')
      expect(fillCircleCalls.length).toBe(0)

      const strokeCircleCalls = ctx.calls.filter(
        (c) => c.method === 'strokeCircle'
      )
      expect(strokeCircleCalls.length).toBe(0)
    })

    it('should still render grid highlight for non-weapon building (wall)', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 0,
        isWeapon: false,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // Verify grid highlight was still rendered
      const fillRectCalls = ctx.calls.filter((c) => c.method === 'fillRect')
      expect(fillRectCalls.length).toBeGreaterThan(0)
    })

    it('should correctly calculate attack range circle radius (range * gridSize)', () => {
      const data: SelectionRenderData = {
        centerX: 100,
        centerY: 100,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // Verify circle radius is range * gridSize = 4 * 32 = 128
      const fillCircleCall = ctx.calls.find((c) => c.method === 'fillCircle')
      expect(fillCircleCall).toBeDefined()
      expect(fillCircleCall?.args[2]).toBe(128)
    })

    it('should correctly position grid highlight at building location', () => {
      const data: SelectionRenderData = {
        centerX: 116,
        centerY: 116,
        gridSize: 32,
        range: 4,
        isWeapon: true,
        position: [3, 3],
      }

      renderBuildingSelection(ctx, data, defaultColors)

      // Verify grid highlight rect position
      const fillRectCalls = ctx.calls.filter((c) => c.method === 'fillRect')
      expect(fillRectCalls.length).toBeGreaterThan(0)

      // Grid top-left should be centerX - gridSize/2, centerY - gridSize/2
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
