/**
 * PathSystem 单元测试
 * TDD 第一步：编写测试用例（红灯阶段）
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PathSystem, createPathSystem } from './PathSystem'
import type { MapConfig, Position } from '@/types'

describe('PathSystem', () => {
  let pathSystem: PathSystem

  beforeEach(() => {
    pathSystem = createPathSystem()
  })

  // ============================================================================
  // generatePath 测试
  // ============================================================================

  describe('generatePath', () => {
    it('应该生成从入口到出口的最短路径（无障碍物）', () => {
      const mapConfig: MapConfig = {
        width: 16,
        height: 16,
        entrance: [0, 0],
        exit: [15, 15],
        obstacles: [],
      }

      const path = pathSystem.generatePath(mapConfig)

      // 路径应该存在
      expect(path).toBeDefined()
      expect(path.length).toBeGreaterThan(0)

      // 路径起点应该是入口
      expect(path[0]).toEqual([0, 0])

      // 路径终点应该是出口
      expect(path[path.length - 1]).toEqual([15, 15])

      // 无障碍时最短路径长度应为 31 步（曼哈顿距离 30 + 起点）
      // 从 (0,0) 到 (15,15) 需要 15 步向右 + 15 步向下 = 30 步
      expect(path.length).toBe(31)
    })

    it('应该生成绕过障碍物的路径', () => {
      const mapConfig: MapConfig = {
        width: 5,
        height: 5,
        entrance: [0, 0],
        exit: [4, 4],
        obstacles: [
          [1, 0],
          [1, 1],
          [1, 2],
        ],
      }

      const path = pathSystem.generatePath(mapConfig)

      // 路径应该存在
      expect(path).toBeDefined()
      expect(path.length).toBeGreaterThan(0)

      // 路径不应经过障碍物
      const obstacleSet = new Set(mapConfig.obstacles.map((p) => `${p[0]},${p[1]}`))
      for (const point of path) {
        expect(obstacleSet.has(`${point[0]},${point[1]}`)).toBe(false)
      }

      // 起点和终点验证
      expect(path[0]).toEqual([0, 0])
      expect(path[path.length - 1]).toEqual([4, 4])
    })

    it('当路径被完全阻塞时应该返回空数组', () => {
      const mapConfig: MapConfig = {
        width: 3,
        height: 3,
        entrance: [0, 0],
        exit: [2, 2],
        obstacles: [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
      }

      const path = pathSystem.generatePath(mapConfig)

      // 路径被阻塞，应返回空数组
      expect(path).toEqual([])
    })

    it('当入口和出口相同时应该返回包含单个点的路径', () => {
      const mapConfig: MapConfig = {
        width: 5,
        height: 5,
        entrance: [2, 2],
        exit: [2, 2],
        obstacles: [],
      }

      const path = pathSystem.generatePath(mapConfig)

      expect(path).toEqual([[2, 2]])
    })

    it('路径中相邻点应该是相邻格子（上下左右）', () => {
      const mapConfig: MapConfig = {
        width: 8,
        height: 8,
        entrance: [0, 0],
        exit: [7, 7],
        obstacles: [],
      }

      const path = pathSystem.generatePath(mapConfig)

      for (let i = 1; i < path.length; i++) {
        const [x1, y1] = path[i - 1]
        const [x2, y2] = path[i]
        const distance = Math.abs(x2 - x1) + Math.abs(y2 - y1)
        // 相邻格子曼哈顿距离应为 1
        expect(distance).toBe(1)
      }
    })
  })

  // ============================================================================
  // getPositionAtProgress 测试
  // ============================================================================

  describe('getPositionAtProgress', () => {
    const GRID_SIZE = 32

    it('progress=0 时应该返回路径起点位置（格子中心）', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
        [2, 0],
      ]

      const pos = pathSystem.getPositionAtProgress(path, 0)

      // 格子 (0, 0) 的中心位置
      expect(pos.x).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
      expect(pos.y).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
    })

    it('progress=1 时应该返回路径终点位置（格子中心）', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
        [2, 0],
      ]

      const pos = pathSystem.getPositionAtProgress(path, 1)

      // 格子 (2, 0) 的中心位置
      expect(pos.x).toBe(2 * GRID_SIZE + GRID_SIZE / 2)
      expect(pos.y).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
    })

    it('progress=0.5 时应该返回路径中间位置', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
        [2, 0],
      ]

      const pos = pathSystem.getPositionAtProgress(path, 0.5)

      // 路径有 3 个点，2 段，progress=0.5 应该在第 1 段结束位置
      // 即格子 (1, 0) 的中心
      expect(pos.x).toBe(1 * GRID_SIZE + GRID_SIZE / 2)
      expect(pos.y).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
    })

    it('progress=0.25 时应该返回第一段中间位置', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
        [2, 0],
      ]

      const pos = pathSystem.getPositionAtProgress(path, 0.25)

      // 路径有 2 段，progress=0.25 相当于第一段走了 50%
      // 从 (0,0) 到 (1,0) 的中间点
      expect(pos.x).toBe(0.5 * GRID_SIZE + GRID_SIZE / 2)
      expect(pos.y).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
    })

    it('空路径应该返回原点', () => {
      const path: Position[] = []

      const pos = pathSystem.getPositionAtProgress(path, 0.5)

      expect(pos.x).toBe(0)
      expect(pos.y).toBe(0)
    })

    it('单点路径应该始终返回该点位置', () => {
      const path: Position[] = [[5, 3]]

      const pos0 = pathSystem.getPositionAtProgress(path, 0)
      const pos50 = pathSystem.getPositionAtProgress(path, 0.5)
      const pos100 = pathSystem.getPositionAtProgress(path, 1)

      const expectedX = 5 * GRID_SIZE + GRID_SIZE / 2
      const expectedY = 3 * GRID_SIZE + GRID_SIZE / 2

      expect(pos0).toEqual({ x: expectedX, y: expectedY })
      expect(pos50).toEqual({ x: expectedX, y: expectedY })
      expect(pos100).toEqual({ x: expectedX, y: expectedY })
    })

    it('progress 超出范围时应该 clamp 到 [0, 1]', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
      ]

      const posNegative = pathSystem.getPositionAtProgress(path, -0.5)
      const posOver = pathSystem.getPositionAtProgress(path, 1.5)

      // -0.5 应该 clamp 到 0
      expect(posNegative.x).toBe(0 * GRID_SIZE + GRID_SIZE / 2)

      // 1.5 应该 clamp 到 1
      expect(posOver.x).toBe(1 * GRID_SIZE + GRID_SIZE / 2)
    })
  })

  // ============================================================================
  // generatePath 带障碍物更新的测试
  // ============================================================================

  describe('generatePath 动态障碍物', () => {
    it('应该能够处理建筑作为障碍物', () => {
      const mapConfig: MapConfig = {
        width: 5,
        height: 5,
        entrance: [0, 0],
        exit: [4, 0],
        obstacles: [
          [2, 0], // 建筑阻挡直线路径
        ],
      }

      const path = pathSystem.generatePath(mapConfig)

      // 路径应该存在且绕过障碍物
      expect(path.length).toBeGreaterThan(0)
      expect(path[0]).toEqual([0, 0])
      expect(path[path.length - 1]).toEqual([4, 0])

      // 验证不经过障碍物
      const hasObstacle = path.some((p) => p[0] === 2 && p[1] === 0)
      expect(hasObstacle).toBe(false)
    })
  })
})
