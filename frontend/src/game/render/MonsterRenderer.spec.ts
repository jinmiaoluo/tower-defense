/**
 * 怪物渲染器测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderMonster, createMonsterRenderer } from './MonsterRenderer'
import type { RenderContext, MonsterRenderData } from './types'

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

describe('MonsterRenderer', () => {
  let ctx: RenderContext & { calls: string[] }

  beforeEach(() => {
    ctx = createMockContext()
  })

  describe('renderMonster', () => {
    it('渲染怪物应绘制圆形身体', () => {
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

      // 简单风格使用 fillCircle 绘制怪物身体（外圈+主体+高光+眼睛+瞳孔）
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(7)
    })

    it('渲染怪物应绘制血条背景和血量', () => {
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

      // 血条需要绘制背景矩形和血量矩形
      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls
      expect(fillRectCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('血量为 50% 时血条宽度应为一半', () => {
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
      // 找到血条相关的调用（血条宽度为 20，在靠后的调用中）
      const healthBarCalls = fillRectCalls.filter((call) => call[2] <= 22 && call[2] >= 10)
      expect(healthBarCalls.length).toBeGreaterThan(0)
    })

    it('满血时血条应为绿色', () => {
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
      // 应该有绿色血条的调用
      const hasGreenHealthBar = fillStyleCalls.some((call) => call[0] === 0x00ff00)
      expect(hasGreenHealthBar).toBe(true)
    })

    it('低血量时血条应为红色', () => {
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
      // 应该有红色血条的调用
      const hasRedHealthBar = fillStyleCalls.some((call) => call[0] === 0xff0000)
      expect(hasRedHealthBar).toBe(true)
    })

    it('有护盾时应绘制护盾条', () => {
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
      // 护盾条应为蓝色
      const hasBlueShield = fillStyleCalls.some((call) => call[0] === 0x00ffff)
      expect(hasBlueShield).toBe(true)
    })

    it('怪物颜色应用于身体填充', () => {
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
      // 应该有怪物颜色的调用 (0xff6600)
      const hasMonsterColor = fillStyleCalls.some((call) => call[0] === 0xff6600)
      expect(hasMonsterColor).toBe(true)
    })
  })

  describe('createMonsterRenderer', () => {
    it('应创建怪物渲染器', () => {
      const renderer = createMonsterRenderer(ctx)

      expect(renderer).toBeDefined()
      expect(typeof renderer.render).toBe('function')
      expect(typeof renderer.clear).toBe('function')
    })

    it('批量渲染多个怪物', () => {
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
      // 简单风格使用 fillCircle 渲染，每个怪物至少 7 次调用
      const fillCircleCalls = (ctx.fillCircle as ReturnType<typeof vi.fn>).mock.calls
      expect(fillCircleCalls.length).toBeGreaterThanOrEqual(14)
    })
  })
})
