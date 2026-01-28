/**
 * GridSystem - Grid management system
 * Manages map grid state, including building placement and path calculation
 * Reference: html5-tower-defense/src/js/td-obj-grid.js
 */

import type { MapConfig, Position } from '@/types'
import type { GridCell, MapState } from '@/types/entities'
import { createPathSystem } from './PathSystem'

/** GridSystem interface definition */
export interface GridSystem {
  /** Get map width */
  getWidth(): number

  /** Get map height */
  getHeight(): number

  /** Get cell at position, returns null if out of bounds */
  getCell(position: Position): GridCell | null

  /** Check if a building can be placed at the specified position */
  canPlaceBuilding(position: Position): boolean

  /**
   * Check if a building can be placed at the specified position (considering monster blocking)
   * Reference: html5-tower-defense/src/js/td-obj-grid.js:47 checkBlock()
   * @param position Position to place the building
   * @param monsterPositions Grid positions of all current monsters
   */
  canPlaceBuildingWithMonsters(position: Position, monsterPositions: Position[]): boolean

  /**
   * Check if placing a building would block monsters' path to the exit
   * Reference: html5-tower-defense/src/js/td-obj-monster.js:211 chkIfBlocked()
   * @param position Position to place the building
   * @param monsterPositions Grid positions of all current monsters
   */
  wouldBlockMonsters(position: Position, monsterPositions: Position[]): boolean

  /**
   * Calculate path from the specified position to the exit
   * Used to check if a monster can reach the exit
   * @param position Starting position
   */
  findPathFromPosition(position: Position): Position[]

  /** Place a building at the specified position, returns whether successful */
  placeBuilding(position: Position, buildingId: string): boolean

  /** Remove the building at the specified position, returns whether successful */
  removeBuilding(position: Position): boolean

  /** Get current path (from entrance to exit) */
  getCurrentPath(): Position[]

  /** Check if the specified position is passable */
  isPassable(position: Position): boolean

  /** Get all obstacle positions (including buildings) */
  getObstacles(): Position[]

  /** Get building ID at the specified position */
  getBuildingAt(position: Position): string | null

  /** Get 2D array of all cells */
  getAllCells(): GridCell[][]

  /** Get current map config (obstacles include buildings) */
  getMapConfig(): MapConfig

  /** Get current map state snapshot (for IGameScene.map) */
  getMapState(): MapState

  /** Get entrance position */
  getEntrance(): Position

  /** Get exit position */
  getExit(): Position

  /** Reset grid state (clear all buildings) */
  reset(): void
}

/**
 * Create a GridSystem instance
 */
export function createGridSystem(mapConfig: MapConfig): GridSystem {
  const { width, height, entrance, exit, obstacles } = mapConfig
  const pathSystem = createPathSystem()

  // Initialize grid cells
  const cells: GridCell[][] = []
  const obstacleSet = new Set(obstacles.map((p) => `${p[0]},${p[1]}`))
  const entranceKey = `${entrance[0]},${entrance[1]}`
  const exitKey = `${exit[0]},${exit[1]}`

  for (let y = 0; y < height; y++) {
    cells[y] = []
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`
      const isObstacle = obstacleSet.has(key)
      const isEntrance = key === entranceKey
      const isExit = key === exitKey

      cells[y][x] = {
        position: [x, y],
        isPassable: !isObstacle,
        buildingId: null,
        isEntrance,
        isExit,
        isObstacle,
      }
    }
  }

  // Cache current path
  let cachedPath: Position[] = pathSystem.generatePath(getMapConfigWithBuildings())

  /** Get map config including buildings as obstacles */
  function getMapConfigWithBuildings(): MapConfig {
    const allObstacles: Position[] = [...obstacles]
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cells[y][x].buildingId !== null) {
          allObstacles.push([x, y])
        }
      }
    }
    return {
      width,
      height,
      entrance,
      exit,
      obstacles: allObstacles,
    }
  }

  /** Recalculate path */
  function recalculatePath(): void {
    cachedPath = pathSystem.generatePath(getMapConfigWithBuildings())
  }

  /** Check if coordinates are within bounds */
  function isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < width && y >= 0 && y < height
  }

  /** Check if placing a building would block the path from entrance to exit */
  function wouldBlockPath(position: Position): boolean {
    const [x, y] = position

    // Temporarily mark this position as impassable
    const tempObstacles: Position[] = [...getMapConfigWithBuildings().obstacles, [x, y]]
    const tempConfig: MapConfig = {
      width,
      height,
      entrance,
      exit,
      obstacles: tempObstacles,
    }

    const testPath = pathSystem.generatePath(tempConfig)
    return testPath.length === 0
  }

  /**
   * Calculate path from a specified position to the exit
   * Reference: html5-tower-defense/src/js/td-walk.js
   */
  function findPathFromPositionImpl(startPosition: Position): Position[] {
    const [startX, startY] = startPosition

    // If start is already the exit, return directly
    if (startX === exit[0] && startY === exit[1]) {
      return [exit]
    }

    // Use current map config (including buildings) to calculate path from position to exit
    const currentMapConfig = getMapConfigWithBuildings()
    const tempConfig: MapConfig = {
      ...currentMapConfig,
      entrance: startPosition, // Temporarily set start as entrance
    }

    return pathSystem.generatePath(tempConfig)
  }

  /**
   * Check if placing a building would block specific monsters' path to the exit
   * Reference: html5-tower-defense/src/js/td-obj-monster.js:211 chkIfBlocked()
   */
  function wouldBlockMonstersImpl(position: Position, monsterPositions: Position[]): boolean {
    // No blocking issue when there are no monsters
    if (monsterPositions.length === 0) {
      return false
    }

    const [buildX, buildY] = position

    // Create temporary map config (including the building to be placed)
    const tempObstacles: Position[] = [...getMapConfigWithBuildings().obstacles, [buildX, buildY]]

    // Check if each monster can reach the exit
    for (const monsterPos of monsterPositions) {
      const [mx, my] = monsterPos

      // No need to check if monster is already at the exit
      if (mx === exit[0] && my === exit[1]) {
        continue
      }

      // Create temporary config to check monster path
      const tempConfig: MapConfig = {
        width,
        height,
        entrance: monsterPos, // Start from monster position
        exit,
        obstacles: tempObstacles,
      }

      const testPath = pathSystem.generatePath(tempConfig)

      // If monster cannot reach the exit, placement would block
      if (testPath.length === 0) {
        return true
      }
    }

    return false
  }

  return {
    getWidth(): number {
      return width
    },

    getHeight(): number {
      return height
    },

    getCell(position: Position): GridCell | null {
      const [x, y] = position
      if (!isInBounds(x, y)) {
        return null
      }
      return cells[y][x]
    },

    canPlaceBuilding(position: Position): boolean {
      const [x, y] = position

      if (!isInBounds(x, y)) {
        return false
      }

      const cell = cells[y][x]

      // Cannot place buildings on entrance, exit, or obstacles
      if (cell.isEntrance || cell.isExit || cell.isObstacle) {
        return false
      }

      // Cannot place on cells that already have a building
      if (cell.buildingId !== null) {
        return false
      }

      // Check if it would block the path
      if (wouldBlockPath(position)) {
        return false
      }

      return true
    },

    canPlaceBuildingWithMonsters(position: Position, monsterPositions: Position[]): boolean {
      // First check basic conditions
      if (!this.canPlaceBuilding(position)) {
        return false
      }

      // Then check if it would block monster paths
      if (wouldBlockMonstersImpl(position, monsterPositions)) {
        return false
      }

      return true
    },

    wouldBlockMonsters(position: Position, monsterPositions: Position[]): boolean {
      return wouldBlockMonstersImpl(position, monsterPositions)
    },

    findPathFromPosition(position: Position): Position[] {
      return findPathFromPositionImpl(position)
    },

    placeBuilding(position: Position, buildingId: string): boolean {
      if (!this.canPlaceBuilding(position)) {
        return false
      }

      const [x, y] = position
      cells[y][x].buildingId = buildingId
      cells[y][x].isPassable = false

      recalculatePath()
      return true
    },

    removeBuilding(position: Position): boolean {
      const [x, y] = position

      if (!isInBounds(x, y)) {
        return false
      }

      const cell = cells[y][x]
      if (cell.buildingId === null) {
        return false
      }

      cell.buildingId = null
      cell.isPassable = true

      recalculatePath()
      return true
    },

    getCurrentPath(): Position[] {
      return cachedPath
    },

    isPassable(position: Position): boolean {
      const [x, y] = position

      if (!isInBounds(x, y)) {
        return false
      }

      return cells[y][x].isPassable
    },

    getObstacles(): Position[] {
      const result: Position[] = []
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cell = cells[y][x]
          if (cell.isObstacle || cell.buildingId !== null) {
            result.push([x, y])
          }
        }
      }
      return result
    },

    getBuildingAt(position: Position): string | null {
      const cell = this.getCell(position)
      return cell?.buildingId ?? null
    },

    getAllCells(): GridCell[][] {
      return cells
    },

    getMapConfig(): MapConfig {
      return getMapConfigWithBuildings()
    },

    getMapState(): MapState {
      return {
        width,
        height,
        cells,
        cachedPath,
      }
    },

    getEntrance(): Position {
      return entrance
    },

    getExit(): Position {
      return exit
    },

    reset(): void {
      // Clear all buildings
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cell = cells[y][x]
          if (cell.buildingId !== null) {
            cell.buildingId = null
            // Restore passable state (if not an original obstacle)
            if (!cell.isObstacle) {
              cell.isPassable = true
            }
          }
        }
      }
      // Recalculate path
      recalculatePath()
    },
  }
}
