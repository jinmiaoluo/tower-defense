/**
 * PathSystem - 路径计算系统
 * 负责怪物路径计算，基于 BFS 寻路算法
 * 参考旧实现：html5-tower-defense/src/js/td-walk.js
 */

import type { MapConfig, Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE } = GAME_CONSTANTS

/** PathSystem 接口定义 */
export interface PathSystem {
  /**
   * 生成从入口到出口的路径
   * @param mapConfig 地图配置
   * @returns 路径点数组，如果路径被阻塞返回空数组
   */
  generatePath(mapConfig: MapConfig): Position[]

  /**
   * 从指定位置生成到出口的路径
   * 用于怪物独立寻路
   * @param startPosition 起始位置
   * @param mapConfig 地图配置（包含当前障碍物）
   * @returns 路径点数组，如果路径被阻塞返回空数组
   */
  generatePathFrom(startPosition: Position, mapConfig: MapConfig): Position[]

  /**
   * 根据进度获取路径上的像素位置
   * @param path 路径点数组
   * @param progress 进度 (0-1)
   * @returns 像素坐标 { x, y }
   */
  getPositionAtProgress(path: Position[], progress: number): { x: number; y: number }
}

/** 未探索标记 */
const UNEXPLORED = -2
/** 不可通过标记 */
const BLOCKED = -1

/**
 * BFS 寻路器
 * 基于旧实现的 TD.FindWay 类重写
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

    // 初始化网格为未探索状态
    const len = this.width * this.height
    this.grid = new Array(len).fill(UNEXPLORED)

    // 创建障碍物集合用于快速查找
    this.obstacleSet = new Set(mapConfig.obstacles.map((p) => `${p[0]},${p[1]}`))
  }

  /** 获取网格值 */
  private getVal(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return BLOCKED
    }
    return this.grid[y * this.width + x]
  }

  /** 设置网格值 */
  private setVal(x: number, y: number, value: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y * this.width + x] = value
    }
  }

  /** 检查格子是否可通过 */
  private isPassable(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false
    }
    return !this.obstacleSet.has(`${x},${y}`)
  }

  /** 获取相邻格子（上下左右） */
  private getNeighbors(x: number, y: number): Position[] {
    const neighbors: Position[] = []
    if (y > 0) neighbors.push([x, y - 1]) // 上
    if (x < this.width - 1) neighbors.push([x + 1, y]) // 右
    if (y < this.height - 1) neighbors.push([x, y + 1]) // 下
    if (x > 0) neighbors.push([x - 1, y]) // 左
    return neighbors
  }

  /** 执行一轮 BFS 扩展 */
  private expandWave(): boolean {
    const nextWave: Position[] = []
    this.distance++

    for (const [cx, cy] of this.currentWave) {
      const neighbors = this.getNeighbors(cx, cy)

      for (const [nx, ny] of neighbors) {
        // 跳过已探索的格子
        if (this.getVal(nx, ny) !== UNEXPLORED) continue

        if (this.isPassable(nx, ny)) {
          this.setVal(nx, ny, this.distance)
          nextWave.push([nx, ny])

          // 检查是否到达终点
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

  /** 从终点回溯找到路径 */
  private tracePath(): Position[] {
    const path: Position[] = []
    let x = this.endX
    let y = this.endY

    // 从终点回溯到起点
    while (x !== this.startX || y !== this.startY) {
      path.unshift([x, y])

      const neighbors = this.getNeighbors(x, y)
      let minVal = Infinity

      // 第一遍：找到最小距离值
      for (const [nx, ny] of neighbors) {
        const val = this.getVal(nx, ny)
        if (val >= 0 && val < minVal) {
          minVal = val
        }
      }

      // 第二遍：收集所有具有最小距离值的邻格
      const closestNeighbors: Position[] = []
      for (const [nx, ny] of neighbors) {
        const val = this.getVal(nx, ny)
        if (val === minVal) {
          closestNeighbors.push([nx, ny])
        }
      }

      // 随机选择一个（与旧实现一致）
      if (closestNeighbors.length === 0) break
      const randomIndex =
        closestNeighbors.length > 1 ? Math.floor(Math.random() * closestNeighbors.length) : 0
      const nextPos = closestNeighbors[randomIndex]
      ;[x, y] = nextPos
    }

    // 添加起点
    path.unshift([this.startX, this.startY])
    return path
  }

  /** 执行寻路 */
  findPath(): Position[] {
    // 特殊情况：起点和终点相同
    if (this.startX === this.endX && this.startY === this.endY) {
      return [[this.startX, this.startY]]
    }

    // 检查起点是否可通过
    if (!this.isPassable(this.startX, this.startY)) {
      return []
    }

    // 初始化起点
    this.setVal(this.startX, this.startY, 0)
    this.currentWave = [[this.startX, this.startY]]

    // BFS 扩展直到到达终点或被阻塞
    while (this.expandWave()) {
      // 继续扩展
    }

    if (this.isBlocked) {
      return []
    }

    return this.tracePath()
  }
}

/**
 * 将格子坐标转换为像素坐标（格子中心）
 */
function gridToPixel(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * GRID_SIZE + GRID_SIZE / 2,
    y: gridY * GRID_SIZE + GRID_SIZE / 2,
  }
}

/**
 * 创建 PathSystem 实例
 */
export function createPathSystem(): PathSystem {
  return {
    generatePath(mapConfig: MapConfig): Position[] {
      const finder = new PathFinder(mapConfig)
      return finder.findPath()
    },

    generatePathFrom(startPosition: Position, mapConfig: MapConfig): Position[] {
      // 创建临时配置，将起点设为指定位置
      const tempConfig: MapConfig = {
        ...mapConfig,
        entrance: startPosition,
      }
      const finder = new PathFinder(tempConfig)
      return finder.findPath()
    },

    getPositionAtProgress(path: Position[], progress: number): { x: number; y: number } {
      // 空路径返回原点
      if (path.length === 0) {
        return { x: 0, y: 0 }
      }

      // 单点路径直接返回该点
      if (path.length === 1) {
        return gridToPixel(path[0][0], path[0][1])
      }

      // clamp progress 到 [0, 1]
      const clampedProgress = Math.max(0, Math.min(1, progress))

      // 计算总段数和当前位置
      const totalSegments = path.length - 1
      const exactPosition = clampedProgress * totalSegments
      const segmentIndex = Math.min(Math.floor(exactPosition), totalSegments - 1)
      const segmentProgress = exactPosition - segmentIndex

      // 获取当前段的起点和终点
      const [startGridX, startGridY] = path[segmentIndex]
      const [endGridX, endGridY] = path[segmentIndex + 1]

      // 转换为像素坐标
      const startPixel = gridToPixel(startGridX, startGridY)
      const endPixel = gridToPixel(endGridX, endGridY)

      // 线性插值
      return {
        x: startPixel.x + (endPixel.x - startPixel.x) * segmentProgress,
        y: startPixel.y + (endPixel.y - startPixel.y) * segmentProgress,
      }
    },
  }
}
