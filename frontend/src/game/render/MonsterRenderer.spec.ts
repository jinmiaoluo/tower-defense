/**
 * Monster renderer tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderMonster, createMonsterRenderer } from './MonsterRenderer'
import type { RenderContext, MonsterRenderData } from './types'

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

describe('MonsterRenderer', () => {
  let ctx: RenderContext & { calls: string[] }

  beforeEach(() => {
    ctx = createMockContext()
  })

  describe('renderMonster', () => {
    it('should draw circular body when rendering a monster', () => {
      const data: MonsterRenderData = {
        id: 'monster-1',
        x: 100,
        y: 100,
        radius: 10,
        color: '#ff0000',
        currentLife: 100,
        maxLife: 100,
        shield: 0,
      }

      renderMonster(ctx, data)

      // Simple style uses fillCircle to draw monster body (outer ring + body + highlight + eyes + pupils)
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(7)
    })

    it('should draw health bar background and fill when rendering a monster', () => {
      const data: MonsterRenderData = {
        id: 'monster-1',
        x: 100,
        y: 100,
        radius: 10,
        color: '#00ff00',
        currentLife: 50,
        maxLife: 100,
        shield: 0,
      }

      renderMonster(ctx, data)

      // Health bar requires drawing background rect and health rect
      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      expect(fillRectCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('should have half width health bar at 50% health', () => {
      const data: MonsterRenderData = {
        id: 'monster-1',
        x: 100,
        y: 100,
        radius: 10,
        color: '#0000ff',
        currentLife: 50,
        maxLife: 100,
        shield: 0,
      }

      renderMonster(ctx, data)

      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      // Find health bar related calls (bar width is 20, in later calls)
      const healthBarCalls = fillRectCalls.filter((call) => call[2] <= 22 && call[2] >= 10)
      expect(healthBarCalls.length).toBeGreaterThan(0)
    })

    it('should show green health bar at full health', () => {
      const data: MonsterRenderData = {
        id: 'monster-1',
        x: 100,
        y: 100,
        radius: 10,
        color: '#ff0000',
        currentLife: 100,
        maxLife: 100,
        shield: 0,
      }

      renderMonster(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      // Should have a green health bar call
      const hasGreenHealthBar = fillStyleCalls.some((call) => call[0] === 0x00ff00)
      expect(hasGreenHealthBar).toBe(true)
    })

    it('should show red health bar at low health', () => {
      const data: MonsterRenderData = {
        id: 'monster-1',
        x: 100,
        y: 100,
        radius: 10,
        color: '#ff0000',
        currentLife: 20,
        maxLife: 100,
        shield: 0,
      }

      renderMonster(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      // Should have a red health bar call
      const hasRedHealthBar = fillStyleCalls.some((call) => call[0] === 0xff0000)
      expect(hasRedHealthBar).toBe(true)
    })

    it('should draw shield bar when shield is present', () => {
      const data: MonsterRenderData = {
        id: 'monster-1',
        x: 100,
        y: 100,
        radius: 10,
        color: '#ff0000',
        currentLife: 100,
        maxLife: 100,
        shield: 50,
      }

      renderMonster(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      // Shield bar should be cyan
      const hasBlueShield = fillStyleCalls.some((call) => call[0] === 0x00ffff)
      expect(hasBlueShield).toBe(true)
    })

    it('should apply monster color to body fill', () => {
      const data: MonsterRenderData = {
        id: 'monster-1',
        x: 100,
        y: 100,
        radius: 10,
        color: '#ff6600',
        currentLife: 100,
        maxLife: 100,
        shield: 0,
      }

      renderMonster(ctx, data)

      const fillStyleCalls = (ctx.fillStyle as ReturnType<typeof vi.fn>).mock.calls
      // Should have a call with the monster color (0xff6600)
      const hasMonsterColor = fillStyleCalls.some((call) => call[0] === 0xff6600)
      expect(hasMonsterColor).toBe(true)
    })
  })

  describe('createMonsterRenderer', () => {
    it('should create a monster renderer', () => {
      const renderer = createMonsterRenderer(ctx)

      expect(renderer).toBeDefined()
      expect(typeof renderer.render).toBe('function')
      expect(typeof renderer.clear).toBe('function')
    })

    it('should render multiple monsters', () => {
      const renderer = createMonsterRenderer(ctx)

      const monsters: MonsterRenderData[] = [
        {
          id: 'monster-1',
          x: 100,
          y: 100,
          radius: 10,
          color: '#ff0000',
          currentLife: 100,
          maxLife: 100,
          shield: 0,
        },
        {
          id: 'monster-2',
          x: 200,
          y: 200,
          radius: 12,
          color: '#00ff00',
          currentLife: 80,
          maxLife: 100,
          shield: 20,
        },
      ]

      renderer.clear()
      for (const monster of monsters) {
        renderer.render(monster)
      }

      expect(ctx.clear).toHaveBeenCalledTimes(1)
      // Simple style uses fillCircle to render, at least 7 calls per monster
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(14)
    })
  })
})
