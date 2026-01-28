/**
 * PathSystem unit tests
 * TDD step 1: Write test cases (red phase)
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
  // generatePath tests
  // ============================================================================

  describe('generatePath', () => {
    it('should generate the shortest path from entrance to exit (no obstacles)', () => {
      const mapConfig: MapConfig = {
        width: 16,
        height: 16,
        entrance: [0, 0],
        exit: [15, 15],
        obstacles: [],
      }

      const path = pathSystem.generatePath(mapConfig)

      // Path should exist
      expect(path).toBeDefined()
      expect(path.length).toBeGreaterThan(0)

      // Path start should be the entrance
      expect(path[0]).toEqual([0, 0])

      // Path end should be the exit
      expect(path[path.length - 1]).toEqual([15, 15])

      // Without obstacles, the shortest path length should be 31 steps (Manhattan distance 30 + start)
      // From (0,0) to (15,15) requires 15 steps right + 15 steps down = 30 steps
      expect(path.length).toBe(31)
    })

    it('should generate a path that routes around obstacles', () => {
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

      // Path should exist
      expect(path).toBeDefined()
      expect(path.length).toBeGreaterThan(0)

      // Path should not pass through obstacles
      const obstacleSet = new Set(mapConfig.obstacles.map((p) => `${p[0]},${p[1]}`))
      for (const point of path) {
        expect(obstacleSet.has(`${point[0]},${point[1]}`)).toBe(false)
      }

      // Start and end verification
      expect(path[0]).toEqual([0, 0])
      expect(path[path.length - 1]).toEqual([4, 4])
    })

    it('should return an empty array when the path is completely blocked', () => {
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

      // Path is blocked, should return empty array
      expect(path).toEqual([])
    })

    it('should return a single-point path when entrance and exit are the same', () => {
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

    it('adjacent points in the path should be neighboring cells (up/down/left/right)', () => {
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
        // Adjacent cells should have Manhattan distance of 1
        expect(distance).toBe(1)
      }
    })
  })

  // ============================================================================
  // getPositionAtProgress tests
  // ============================================================================

  describe('getPositionAtProgress', () => {
    const GRID_SIZE = 32

    it('should return the path start position (cell center) at progress=0', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
        [2, 0],
      ]

      const pos = pathSystem.getPositionAtProgress(path, 0)

      // Center of cell (0, 0)
      expect(pos.x).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
      expect(pos.y).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
    })

    it('should return the path end position (cell center) at progress=1', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
        [2, 0],
      ]

      const pos = pathSystem.getPositionAtProgress(path, 1)

      // Center of cell (2, 0)
      expect(pos.x).toBe(2 * GRID_SIZE + GRID_SIZE / 2)
      expect(pos.y).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
    })

    it('should return the path midpoint at progress=0.5', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
        [2, 0],
      ]

      const pos = pathSystem.getPositionAtProgress(path, 0.5)

      // Path has 3 points, 2 segments, progress=0.5 should be at the end of the 1st segment
      // i.e. the center of cell (1, 0)
      expect(pos.x).toBe(1 * GRID_SIZE + GRID_SIZE / 2)
      expect(pos.y).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
    })

    it('should return the midpoint of the first segment at progress=0.25', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
        [2, 0],
      ]

      const pos = pathSystem.getPositionAtProgress(path, 0.25)

      // Path has 2 segments, progress=0.25 means 50% through the first segment
      // Midpoint from (0,0) to (1,0)
      expect(pos.x).toBe(0.5 * GRID_SIZE + GRID_SIZE / 2)
      expect(pos.y).toBe(0 * GRID_SIZE + GRID_SIZE / 2)
    })

    it('should return the origin for an empty path', () => {
      const path: Position[] = []

      const pos = pathSystem.getPositionAtProgress(path, 0.5)

      expect(pos.x).toBe(0)
      expect(pos.y).toBe(0)
    })

    it('should always return that point position for a single-point path', () => {
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

    it('should clamp progress to [0, 1] when out of range', () => {
      const path: Position[] = [
        [0, 0],
        [1, 0],
      ]

      const posNegative = pathSystem.getPositionAtProgress(path, -0.5)
      const posOver = pathSystem.getPositionAtProgress(path, 1.5)

      // -0.5 should clamp to 0
      expect(posNegative.x).toBe(0 * GRID_SIZE + GRID_SIZE / 2)

      // 1.5 should clamp to 1
      expect(posOver.x).toBe(1 * GRID_SIZE + GRID_SIZE / 2)
    })
  })

  // ============================================================================
  // generatePath with dynamic obstacles tests
  // ============================================================================

  describe('generatePath with dynamic obstacles', () => {
    it('should handle buildings as obstacles', () => {
      const mapConfig: MapConfig = {
        width: 5,
        height: 5,
        entrance: [0, 0],
        exit: [4, 0],
        obstacles: [
          [2, 0], // building blocking the straight path
        ],
      }

      const path = pathSystem.generatePath(mapConfig)

      // Path should exist and route around the obstacle
      expect(path.length).toBeGreaterThan(0)
      expect(path[0]).toEqual([0, 0])
      expect(path[path.length - 1]).toEqual([4, 0])

      // Verify it does not pass through the obstacle
      const hasObstacle = path.some((p) => p[0] === 2 && p[1] === 0)
      expect(hasObstacle).toBe(false)
    })
  })
})
