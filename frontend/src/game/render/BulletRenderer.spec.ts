/**
 * Bullet renderer tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderBullet, createBulletRenderer } from './BulletRenderer'
import type { RenderContext, BulletRenderData } from './types'

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

describe('BulletRenderer', () => {
  let ctx: RenderContext & { calls: string[] }

  beforeEach(() => {
    ctx = createMockContext()
  })

  describe('renderBullet', () => {
    it('should draw a circle when rendering a bullet', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 5,
        vy: 0,
      }

      renderBullet(ctx, data)

      expect(ctx.fillCircle).toHaveBeenCalled()
    })

    it('should default to black color', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 5,
        vy: 0,
      }

      renderBullet(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      // Main bullet should be black
      const hasBlackColor = fillStyleCalls.some((call) => call[0] === 0x000000)
      expect(hasBlackColor).toBe(true)
    })

    it('should support custom bullet color', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 5,
        vy: 0,
        color: 0xff0000,
      }

      renderBullet(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      const hasRedColor = fillStyleCalls.some((call) => call[0] === 0xff0000)
      expect(hasRedColor).toBe(true)
    })

    it('should draw trail effect when bullet has velocity', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 10,
        vy: 0,
      }

      renderBullet(ctx, data)

      // Trail effect draws multiple circles
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThan(1)
    })

    it('should not draw trail for stationary bullet', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 0,
        vy: 0,
      }

      renderBullet(ctx, data)

      // Stationary bullet draws only one circle
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBe(1)
    })

    it('should have alpha gradient in trail', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 10,
        vy: 0,
      }

      renderBullet(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      // Should have calls with different alpha values
      const alphas = fillStyleCalls.map((call) => call[1])
      const hasVaryingAlpha = new Set(alphas).size > 1
      expect(hasVaryingAlpha).toBe(true)
    })
  })

  describe('createBulletRenderer', () => {
    it('should create a bullet renderer', () => {
      const renderer = createBulletRenderer(ctx)

      expect(renderer).toBeDefined()
      expect(typeof renderer.render).toBe('function')
      expect(typeof renderer.clear).toBe('function')
    })

    it('should render multiple bullets', () => {
      const renderer = createBulletRenderer(ctx)

      const bullets: BulletRenderData[] = [
        { x: 100, y: 100, radius: 3, vx: 5, vy: 0 },
        { x: 200, y: 200, radius: 4, vx: 0, vy: 5 },
      ]

      renderer.clear()
      for (const bullet of bullets) {
        renderer.render(bullet)
      }

      expect(ctx.clear).toHaveBeenCalledTimes(1)
    })
  })
})
