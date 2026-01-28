/**
 * PathSystem - Path calculation system
 * Handles monster path calculation based on BFS pathfinding algorithm
 * Reference: html5-tower-defense/src/js/td-walk.js
 */

import type { MapConfig, Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE } = GAME_CONSTANTS

/** PathSystem interface definition */
export interface PathSystem {
  /**
   * Generate path from entrance to exit
   * @param mapConfig Map configuration
   * @returns Array of path points, or empty array if path is blocked
   */
  generatePath(mapConfig: MapConfig): Position[]

  /**
   * Generate path from a specified position to the exit
   * Used for independent monster pathfinding
   * @param startPosition Starting position
   * @param mapConfig Map configuration (including current obstacles)
   * @returns Array of path points, or empty array if path is blocked
   */
  generatePathFrom(startPosition: Position, mapConfig: MapConfig): Position[]

  /**
   * Get pixel position on the path at a given progress
   * @param path Array of path points
   * @param progress Progress value (0-1)
   * @returns Pixel coordinates { x, y }
   */
  getPositionAtProgress(path: Position[], progress: number): { x: number; y: number }
}

/** Unexplored marker */
const UNEXPLORED = -2
/** Impassable marker */
const BLOCKED = -1

/**
 * BFS pathfinder
 * Rewritten based on the old implementation's TD.FindWay class
 */
class PathFinder {
  private readonly width: number
  private readonly height: number
  private readonly startX: number
  private readonly startY: number
  private readonly endX: number
  private readonly endY: number
  private readonly grid: number[]
  private readonly obstacleSet: Set<string>

  private currentWave: Position[] = []
  private distance = 0
  private isBlocked = false

  constructor(mapConfig: MapConfig) {
    this.width = mapConfig.width
    this.height = mapConfig.height
    this.startX = mapConfig.entrance[0]
    this.startY = mapConfig.entrance[1]
    this.endX = mapConfig.exit[0]
    this.endY = mapConfig.exit[1]

    // Initialize grid as unexplored
    const len = this.width * this.height
    this.grid = new Array(len).fill(UNEXPLORED)

    // Create obstacle set for fast lookup
    this.obstacleSet = new Set(mapConfig.obstacles.map((p) => `${p[0]},${p[1]}`))
  }

  /** Get grid value */
  private getVal(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return BLOCKED
    }
    return this.grid[y * this.width + x]
  }

  /** Set grid value */
  private setVal(x: number, y: number, value: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y * this.width + x] = value
    }
  }

  /** Check if a cell is passable */
  private isPassable(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false
    }
    return !this.obstacleSet.has(`${x},${y}`)
  }

  /** Get adjacent cells (up, down, left, right) */
  private getNeighbors(x: number, y: number): Position[] {
    const neighbors: Position[] = []
    if (y > 0) neighbors.push([x, y - 1]) // up
    if (x < this.width - 1) neighbors.push([x + 1, y]) // right
    if (y < this.height - 1) neighbors.push([x, y + 1]) // down
    if (x > 0) neighbors.push([x - 1, y]) // left
    return neighbors
  }

  /** Execute one round of BFS expansion */
  private expandWave(): boolean {
    const nextWave: Position[] = []
    this.distance++

    for (const [cx, cy] of this.currentWave) {
      const neighbors = this.getNeighbors(cx, cy)

      for (const [nx, ny] of neighbors) {
        // Skip already explored cells
        if (this.getVal(nx, ny) !== UNEXPLORED) continue

        if (this.isPassable(nx, ny)) {
          this.setVal(nx, ny, this.distance)
          nextWave.push([nx, ny])

          // Check if destination reached
          if (nx === this.endX && ny === this.endY) {
            this.currentWave = []
            return false
          }
        } else {
          this.setVal(nx, ny, BLOCKED)
        }
      }
    }

    if (nextWave.length === 0) {
      this.isBlocked = true
      return false
    }

    this.currentWave = nextWave
    return true
  }

  /** Trace path backwards from destination */
  private tracePath(): Position[] {
    const path: Position[] = []
    let x = this.endX
    let y = this.endY

    // Trace back from destination to start
    while (x !== this.startX || y !== this.startY) {
      path.unshift([x, y])

      const neighbors = this.getNeighbors(x, y)
      let minVal = Infinity

      // First pass: find minimum distance value
      for (const [nx, ny] of neighbors) {
        const val = this.getVal(nx, ny)
        if (val >= 0 && val < minVal) {
          minVal = val
        }
      }

      // Second pass: collect all neighbors with minimum distance value
      const closestNeighbors: Position[] = []
      for (const [nx, ny] of neighbors) {
        const val = this.getVal(nx, ny)
        if (val === minVal) {
          closestNeighbors.push([nx, ny])
        }
      }

      // Randomly select one (consistent with old implementation)
      if (closestNeighbors.length === 0) break
      const randomIndex =
        closestNeighbors.length > 1 ? Math.floor(Math.random() * closestNeighbors.length) : 0
      const nextPos = closestNeighbors[randomIndex]
      ;[x, y] = nextPos
    }

    // Add start point
    path.unshift([this.startX, this.startY])
    return path
  }

  /** Execute pathfinding */
  findPath(): Position[] {
    // Special case: start and end are the same
    if (this.startX === this.endX && this.startY === this.endY) {
      return [[this.startX, this.startY]]
    }

    // Check if start is passable
    if (!this.isPassable(this.startX, this.startY)) {
      return []
    }

    // Initialize start point
    this.setVal(this.startX, this.startY, 0)
    this.currentWave = [[this.startX, this.startY]]

    // BFS expansion until destination reached or blocked
    while (this.expandWave()) {
      // Continue expanding
    }

    if (this.isBlocked) {
      return []
    }

    return this.tracePath()
  }
}

/**
 * Convert grid coordinates to pixel coordinates (cell center)
 */
function gridToPixel(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * GRID_SIZE + GRID_SIZE / 2,
    y: gridY * GRID_SIZE + GRID_SIZE / 2,
  }
}

/**
 * Create a PathSystem instance
 */
export function createPathSystem(): PathSystem {
  return {
    generatePath(mapConfig: MapConfig): Position[] {
      const finder = new PathFinder(mapConfig)
      return finder.findPath()
    },

    generatePathFrom(startPosition: Position, mapConfig: MapConfig): Position[] {
      // Create temporary config, setting start to specified position
      const tempConfig: MapConfig = {
        ...mapConfig,
        entrance: startPosition,
      }
      const finder = new PathFinder(tempConfig)
      return finder.findPath()
    },

    getPositionAtProgress(path: Position[], progress: number): { x: number; y: number } {
      // Empty path returns origin
      if (path.length === 0) {
        return { x: 0, y: 0 }
      }

      // Single-point path returns that point directly
      if (path.length === 1) {
        return gridToPixel(path[0][0], path[0][1])
      }

      // Clamp progress to [0, 1]
      const clampedProgress = Math.max(0, Math.min(1, progress))

      // Calculate total segments and current position
      const totalSegments = path.length - 1
      const exactPosition = clampedProgress * totalSegments
      const segmentIndex = Math.min(Math.floor(exactPosition), totalSegments - 1)
      const segmentProgress = exactPosition - segmentIndex

      // Get start and end of current segment
      const [startGridX, startGridY] = path[segmentIndex]
      const [endGridX, endGridY] = path[segmentIndex + 1]

      // Convert to pixel coordinates
      const startPixel = gridToPixel(startGridX, startGridY)
      const endPixel = gridToPixel(endGridX, endGridY)

      // Linear interpolation
      return {
        x: startPixel.x + (endPixel.x - startPixel.x) * segmentProgress,
        y: startPixel.y + (endPixel.y - startPixel.y) * segmentProgress,
      }
    },
  }
}
