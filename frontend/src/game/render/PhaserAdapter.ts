/**
 * Phaser Graphics adapter
 * Adapts Phaser.GameObjects.Graphics to the RenderContext interface
 */

import type { RenderContext } from './types'

/**
 * Create Phaser Graphics render context adapter
 */
export function createPhaserAdapter(graphics: Phaser.GameObjects.Graphics): RenderContext {
  return {
    clear(): void {
      graphics.clear()
    },
    fillStyle(color: number, alpha = 1): void {
      graphics.fillStyle(color, alpha)
    },
    lineStyle(width: number, color: number, alpha = 1): void {
      graphics.lineStyle(width, color, alpha)
    },
    fillRect(x: number, y: number, width: number, height: number): void {
      graphics.fillRect(x, y, width, height)
    },
    strokeRect(x: number, y: number, width: number, height: number): void {
      graphics.strokeRect(x, y, width, height)
    },
    fillCircle(x: number, y: number, radius: number): void {
      graphics.fillCircle(x, y, radius)
    },
    strokeCircle(x: number, y: number, radius: number): void {
      graphics.strokeCircle(x, y, radius)
    },
    beginPath(): void {
      graphics.beginPath()
    },
    closePath(): void {
      graphics.closePath()
    },
    moveTo(x: number, y: number): void {
      graphics.moveTo(x, y)
    },
    lineTo(x: number, y: number): void {
      graphics.lineTo(x, y)
    },
    fill(): void {
      graphics.fillPath()
    },
    stroke(): void {
      graphics.strokePath()
    },
    lineBetween(x1: number, y1: number, x2: number, y2: number): void {
      graphics.lineBetween(x1, y1, x2, y2)
    },
    fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
      graphics.fillTriangle(x1, y1, x2, y2, x3, y3)
    },
    strokeTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
      graphics.strokeTriangle(x1, y1, x2, y2, x3, y3)
    },
  }
}
