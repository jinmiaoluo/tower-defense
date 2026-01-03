/**
 * 子弹渲染器测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderBullet, createBulletRenderer } from './BulletRenderer'
import type { RenderContext, BulletRenderData } from './types'

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

describe('BulletRenderer', () => {
  let ctx: RenderContext & { calls: string[] }

  beforeEach(() => {
    ctx = createMockContext()
  })

  describe('renderBullet', () => {
    it('渲染子弹应绘制圆形', () => {
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

    it('子弹应默认为黑色', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 5,
        vy: 0,
      }

      renderBullet(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      // 主子弹应为黑色
      const hasBlackColor = fillStyleCalls.some((call) => call[0] === 0x000000)
      expect(hasBlackColor).toBe(true)
    })

    it('可以自定义子弹颜色', () => {
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

    it('有速度时应绘制拖尾效果', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 10,
        vy: 0,
      }

      renderBullet(ctx, data)

      // 拖尾效果会绘制多个圆形
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThan(1)
    })

    it('静止子弹不应有拖尾', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 0,
        vy: 0,
      }

      renderBullet(ctx, data)

      // 静止子弹只绘制一个圆
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBe(1)
    })

    it('拖尾应有透明度渐变', () => {
      const data: BulletRenderData = {
        x: 100,
        y: 100,
        radius: 3,
        vx: 10,
        vy: 0,
      }

      renderBullet(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      // 应该有不同透明度的调用
      const alphas = fillStyleCalls.map((call) => call[1])
      const hasVaryingAlpha = new Set(alphas).size > 1
      expect(hasVaryingAlpha).toBe(true)
    })
  })

  describe('createBulletRenderer', () => {
    it('应创建子弹渲染器', () => {
      const renderer = createBulletRenderer(ctx)

      expect(renderer).toBeDefined()
      expect(typeof renderer.render).toBe('function')
      expect(typeof renderer.clear).toBe('function')
    })

    it('批量渲染多个子弹', () => {
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
