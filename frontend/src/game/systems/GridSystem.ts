/**
 * GridSystem - 格子管理系统
 * 负责管理地图格子状态，包括建筑放置和路径计算
 * 参考旧实现：html5-tower-defense/src/js/td-obj-grid.js
 */

import type { MapConfig, Position } from '@/types'
import type { GridCell } from '@/types/entities'
import { createPathSystem } from './PathSystem'

/** GridSystem 接口定义 */
export interface GridSystem {
  /** 获取地图宽度 */
  getWidth(): number

  /** 获取地图高度 */
  getHeight(): number

  /** 获取指定位置的格子，超出边界返回 null */
  getCell(position: Position): GridCell | null

  /** 检查是否可以在指定位置放置建筑 */
  canPlaceBuilding(position: Position): boolean

  /** 在指定位置放置建筑，返回是否成功 */
  placeBuilding(position: Position, buildingId: string): boolean

  /** 移除指定位置的建筑，返回是否成功 */
  removeBuilding(position: Position): boolean

  /** 获取当前路径（从入口到出口） */
  getCurrentPath(): Position[]

  /** 检查指定位置是否可通行 */
  isPassable(position: Position): boolean

  /** 获取所有障碍物位置（包括建筑） */
  getObstacles(): Position[]

  /** 获取指定位置的建筑 ID */
  getBuildingAt(position: Position): string | null

  /** 获取所有格子的二维数组 */
  getAllCells(): GridCell[][]

  /** 获取当前地图配置（障碍物包含建筑） */
  getMapConfig(): MapConfig
}

/**
 * 创建 GridSystem 实例
 */
export function createGridSystem(mapConfig: MapConfig): GridSystem {
  const { width, height, entrance, exit, obstacles } = mapConfig
  const pathSystem = createPathSystem()

  // 初始化格子网格
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

  // 缓存当前路径
  let cachedPath: Position[] = pathSystem.generatePath(getMapConfigWithBuildings())

  /** 获取包含建筑的地图配置 */
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

  /** 重新计算路径 */
  function recalculatePath(): void {
    cachedPath = pathSystem.generatePath(getMapConfigWithBuildings())
  }

  /** 检查坐标是否在边界内 */
  function isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < width && y >= 0 && y < height
  }

  /** 检查放置建筑是否会阻断路径 */
  function wouldBlockPath(position: Position): boolean {
    const [x, y] = position

    // 临时将该位置标记为不可通行
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

      // 入口、出口、障碍物不能放置建筑
      if (cell.isEntrance || cell.isExit || cell.isObstacle) {
        return false
      }

      // 已有建筑的格子不能放置
      if (cell.buildingId !== null) {
        return false
      }

      // 检查是否会阻断路径
      if (wouldBlockPath(position)) {
        return false
      }

      return true
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
  }
}
