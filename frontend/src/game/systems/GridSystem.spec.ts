/**
 * GridSystem 单元测试
 * TDD 第一步：编写测试用例（红灯阶段）
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GridSystem, createGridSystem } from './GridSystem'
import type { MapConfig } from '@/types'

describe('GridSystem', () => {
  let gridSystem: GridSystem

  // 默认测试地图配置
  const defaultMapConfig: MapConfig = {
    width: 5,
    height: 5,
    entrance: [0, 0],
    exit: [4, 4],
    obstacles: [[2, 2]],
  }

  beforeEach(() => {
    gridSystem = createGridSystem(defaultMapConfig)
  })

  // ============================================================================
  // 初始化测试
  // ============================================================================

  describe('初始化', () => {
    it('应该根据地图配置创建正确大小的格子网格', () => {
      expect(gridSystem.getWidth()).toBe(5)
      expect(gridSystem.getHeight()).toBe(5)
    })

    it('应该正确标记入口格子', () => {
      const cell = gridSystem.getCell([0, 0])
      expect(cell).toBeDefined()
      expect(cell!.isEntrance).toBe(true)
      expect(cell!.isExit).toBe(false)
    })

    it('应该正确标记出口格子', () => {
      const cell = gridSystem.getCell([4, 4])
      expect(cell).toBeDefined()
      expect(cell!.isExit).toBe(true)
      expect(cell!.isEntrance).toBe(false)
    })

    it('应该正确标记障碍物格子', () => {
      const cell = gridSystem.getCell([2, 2])
      expect(cell).toBeDefined()
      expect(cell!.isObstacle).toBe(true)
      expect(cell!.isPassable).toBe(false)
    })

    it('普通格子应该是可通行的', () => {
      const cell = gridSystem.getCell([1, 1])
      expect(cell).toBeDefined()
      expect(cell!.isPassable).toBe(true)
      expect(cell!.isObstacle).toBe(false)
      expect(cell!.isEntrance).toBe(false)
      expect(cell!.isExit).toBe(false)
    })

    it('所有格子初始时都没有建筑', () => {
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const cell = gridSystem.getCell([x, y])
          expect(cell!.buildingId).toBeNull()
        }
      }
    })
  })

  // ============================================================================
  // getCell 测试
  // ============================================================================

  describe('getCell', () => {
    it('应该返回指定位置的格子', () => {
      const cell = gridSystem.getCell([1, 2])
      expect(cell).toBeDefined()
      expect(cell!.position).toEqual([1, 2])
    })

    it('超出边界时应该返回 null', () => {
      expect(gridSystem.getCell([-1, 0])).toBeNull()
      expect(gridSystem.getCell([0, -1])).toBeNull()
      expect(gridSystem.getCell([5, 0])).toBeNull()
      expect(gridSystem.getCell([0, 5])).toBeNull()
    })
  })

  // ============================================================================
  // canPlaceBuilding 测试
  // ============================================================================

  describe('canPlaceBuilding', () => {
    it('普通空格子应该可以放置建筑', () => {
      expect(gridSystem.canPlaceBuilding([1, 1])).toBe(true)
    })

    it('入口格子不能放置建筑', () => {
      expect(gridSystem.canPlaceBuilding([0, 0])).toBe(false)
    })

    it('出口格子不能放置建筑', () => {
      expect(gridSystem.canPlaceBuilding([4, 4])).toBe(false)
    })

    it('障碍物格子不能放置建筑', () => {
      expect(gridSystem.canPlaceBuilding([2, 2])).toBe(false)
    })

    it('已有建筑的格子不能再放置建筑', () => {
      gridSystem.placeBuilding([1, 1], 'b-001')
      expect(gridSystem.canPlaceBuilding([1, 1])).toBe(false)
    })

    it('超出边界的位置不能放置建筑', () => {
      expect(gridSystem.canPlaceBuilding([-1, 0])).toBe(false)
      expect(gridSystem.canPlaceBuilding([5, 5])).toBe(false)
    })

    it('会阻断路径的位置不能放置建筑', () => {
      // 在 5x5 地图上，入口 (0,0)，出口 (4,4)，障碍物 (2,2)
      // 如果在 (1,0) 和 (0,1) 都放建筑，会阻断从入口出发的路径

      // 先放一个建筑
      gridSystem.placeBuilding([1, 0], 'b-001')
      // 此时 (0,1) 如果再放建筑会阻断路径
      expect(gridSystem.canPlaceBuilding([0, 1])).toBe(false)
    })
  })

  // ============================================================================
  // placeBuilding 测试
  // ============================================================================

  describe('placeBuilding', () => {
    it('应该在指定位置放置建筑', () => {
      const result = gridSystem.placeBuilding([1, 1], 'b-001')
      expect(result).toBe(true)

      const cell = gridSystem.getCell([1, 1])
      expect(cell!.buildingId).toBe('b-001')
      expect(cell!.isPassable).toBe(false)
    })

    it('在不能放置的位置应该返回 false', () => {
      const result = gridSystem.placeBuilding([0, 0], 'b-001') // 入口
      expect(result).toBe(false)

      const cell = gridSystem.getCell([0, 0])
      expect(cell!.buildingId).toBeNull()
    })

    it('放置建筑后应该更新路径缓存', () => {
      const pathBefore = gridSystem.getCurrentPath()
      expect(pathBefore.length).toBeGreaterThan(0)

      gridSystem.placeBuilding([1, 0], 'b-001')
      const pathAfter = gridSystem.getCurrentPath()

      // 路径应该绕过新建筑
      const hasBuilding = pathAfter.some((p) => p[0] === 1 && p[1] === 0)
      expect(hasBuilding).toBe(false)
    })
  })

  // ============================================================================
  // removeBuilding 测试
  // ============================================================================

  describe('removeBuilding', () => {
    it('应该移除指定位置的建筑', () => {
      gridSystem.placeBuilding([1, 1], 'b-001')

      const result = gridSystem.removeBuilding([1, 1])
      expect(result).toBe(true)

      const cell = gridSystem.getCell([1, 1])
      expect(cell!.buildingId).toBeNull()
      expect(cell!.isPassable).toBe(true)
    })

    it('移除不存在的建筑应该返回 false', () => {
      const result = gridSystem.removeBuilding([1, 1])
      expect(result).toBe(false)
    })

    it('移除建筑后应该更新路径缓存', () => {
      gridSystem.placeBuilding([1, 0], 'b-001')
      const pathWithBuilding = gridSystem.getCurrentPath()

      gridSystem.removeBuilding([1, 0])
      const pathWithoutBuilding = gridSystem.getCurrentPath()

      // 移除建筑后，路径可能会变短（如果之前绕路了）
      expect(pathWithoutBuilding.length).toBeLessThanOrEqual(pathWithBuilding.length)
    })
  })

  // ============================================================================
  // getCurrentPath 测试
  // ============================================================================

  describe('getCurrentPath', () => {
    it('应该返回从入口到出口的路径', () => {
      const path = gridSystem.getCurrentPath()

      expect(path.length).toBeGreaterThan(0)
      expect(path[0]).toEqual([0, 0]) // 起点是入口
      expect(path[path.length - 1]).toEqual([4, 4]) // 终点是出口
    })

    it('路径应该避开障碍物', () => {
      const path = gridSystem.getCurrentPath()

      const hasObstacle = path.some((p) => p[0] === 2 && p[1] === 2)
      expect(hasObstacle).toBe(false)
    })

    it('路径应该避开建筑', () => {
      gridSystem.placeBuilding([1, 0], 'b-001')
      const path = gridSystem.getCurrentPath()

      const hasBuilding = path.some((p) => p[0] === 1 && p[1] === 0)
      expect(hasBuilding).toBe(false)
    })
  })

  // ============================================================================
  // isPassable 测试
  // ============================================================================

  describe('isPassable', () => {
    it('普通格子应该可通行', () => {
      expect(gridSystem.isPassable([1, 1])).toBe(true)
    })

    it('障碍物不可通行', () => {
      expect(gridSystem.isPassable([2, 2])).toBe(false)
    })

    it('有建筑的格子不可通行', () => {
      gridSystem.placeBuilding([1, 1], 'b-001')
      expect(gridSystem.isPassable([1, 1])).toBe(false)
    })

    it('超出边界不可通行', () => {
      expect(gridSystem.isPassable([-1, 0])).toBe(false)
      expect(gridSystem.isPassable([5, 5])).toBe(false)
    })
  })

  // ============================================================================
  // getObstacles 测试
  // ============================================================================

  describe('getObstacles', () => {
    it('应该返回所有障碍物位置（包括建筑）', () => {
      const obstaclesBefore = gridSystem.getObstacles()
      expect(obstaclesBefore).toContainEqual([2, 2]) // 原始障碍物

      gridSystem.placeBuilding([1, 1], 'b-001')
      const obstaclesAfter = gridSystem.getObstacles()
      expect(obstaclesAfter).toContainEqual([2, 2])
      expect(obstaclesAfter).toContainEqual([1, 1]) // 新建筑也算障碍物
    })
  })

  // ============================================================================
  // getBuildingAt 测试
  // ============================================================================

  describe('getBuildingAt', () => {
    it('应该返回指定位置的建筑 ID', () => {
      gridSystem.placeBuilding([1, 1], 'b-001')
      expect(gridSystem.getBuildingAt([1, 1])).toBe('b-001')
    })

    it('没有建筑时应该返回 null', () => {
      expect(gridSystem.getBuildingAt([1, 1])).toBeNull()
    })

    it('超出边界应该返回 null', () => {
      expect(gridSystem.getBuildingAt([-1, 0])).toBeNull()
    })
  })

  // ============================================================================
  // getAllCells 测试
  // ============================================================================

  describe('getAllCells', () => {
    it('应该返回所有格子的二维数组', () => {
      const cells = gridSystem.getAllCells()

      expect(cells.length).toBe(5) // height
      expect(cells[0].length).toBe(5) // width

      // 验证入口
      expect(cells[0][0].isEntrance).toBe(true)
      // 验证出口
      expect(cells[4][4].isExit).toBe(true)
      // 验证障碍物
      expect(cells[2][2].isObstacle).toBe(true)
    })
  })

  // ============================================================================
  // getMapConfig 测试
  // ============================================================================

  describe('getMapConfig', () => {
    it('应该返回当前地图配置（包含建筑作为障碍物）', () => {
      gridSystem.placeBuilding([1, 1], 'b-001')

      const config = gridSystem.getMapConfig()

      expect(config.width).toBe(5)
      expect(config.height).toBe(5)
      expect(config.entrance).toEqual([0, 0])
      expect(config.exit).toEqual([4, 4])
      expect(config.obstacles).toContainEqual([2, 2]) // 原始障碍物
      expect(config.obstacles).toContainEqual([1, 1]) // 建筑
    })
  })

  // ============================================================================
  // getMapState 测试 - MapState 数据快照
  // ============================================================================

  describe('getMapState', () => {
    it('应该返回符合 MapState 接口的对象', () => {
      const mapState = gridSystem.getMapState()

      expect(mapState).toBeDefined()
      expect(typeof mapState.width).toBe('number')
      expect(typeof mapState.height).toBe('number')
      expect(Array.isArray(mapState.cells)).toBe(true)
      // cachedPath 可以是 Position[] 或 null
      expect(mapState.cachedPath === null || Array.isArray(mapState.cachedPath)).toBe(true)
    })

    it('应该返回正确的地图尺寸', () => {
      const mapState = gridSystem.getMapState()

      expect(mapState.width).toBe(5)
      expect(mapState.height).toBe(5)
    })

    it('应该返回正确的格子二维数组', () => {
      const mapState = gridSystem.getMapState()

      expect(mapState.cells.length).toBe(5) // height
      expect(mapState.cells[0].length).toBe(5) // width

      // 验证入口格子
      expect(mapState.cells[0][0].isEntrance).toBe(true)
      // 验证出口格子
      expect(mapState.cells[4][4].isExit).toBe(true)
      // 验证障碍物格子
      expect(mapState.cells[2][2].isObstacle).toBe(true)
    })

    it('应该返回当前缓存的路径', () => {
      const mapState = gridSystem.getMapState()

      expect(mapState.cachedPath).not.toBeNull()
      expect(mapState.cachedPath!.length).toBeGreaterThan(0)
      expect(mapState.cachedPath![0]).toEqual([0, 0]) // 起点
      expect(mapState.cachedPath![mapState.cachedPath!.length - 1]).toEqual([4, 4]) // 终点
    })

    it('放置建筑后 MapState 应该反映最新状态', () => {
      gridSystem.placeBuilding([1, 1], 'b-001')
      const mapState = gridSystem.getMapState()

      // 格子状态应该更新
      expect(mapState.cells[1][1].buildingId).toBe('b-001')
      expect(mapState.cells[1][1].isPassable).toBe(false)

      // 路径应该更新（不经过建筑）
      const hasBuilding = mapState.cachedPath!.some((p) => p[0] === 1 && p[1] === 1)
      expect(hasBuilding).toBe(false)
    })

    it('移除建筑后 MapState 应该反映最新状态', () => {
      gridSystem.placeBuilding([1, 1], 'b-001')
      gridSystem.removeBuilding([1, 1])
      const mapState = gridSystem.getMapState()

      // 格子状态应该恢复
      expect(mapState.cells[1][1].buildingId).toBeNull()
      expect(mapState.cells[1][1].isPassable).toBe(true)
    })

    it('返回的是实时视图而非快照（状态变化会反映到已获取的对象）', () => {
      const mapState = gridSystem.getMapState()

      // 放置建筑前
      expect(mapState.cells[1][1].buildingId).toBeNull()

      // 放置建筑
      gridSystem.placeBuilding([1, 1], 'b-001')

      // 状态变化会反映到同一个 mapState 对象（视图语义）
      expect(mapState.cells[1][1].buildingId).toBe('b-001')
    })
  })

  // ============================================================================
  // getEntrance / getExit 测试 - 便捷访问入口/出口位置
  // ============================================================================

  describe('getEntrance', () => {
    it('应该返回入口位置', () => {
      const entrance = gridSystem.getEntrance()
      expect(entrance).toEqual([0, 0])
    })

    it('返回的位置应该与 cells 中标记的入口一致', () => {
      const entrance = gridSystem.getEntrance()
      const cell = gridSystem.getCell(entrance)
      expect(cell!.isEntrance).toBe(true)
    })
  })

  describe('getExit', () => {
    it('应该返回出口位置', () => {
      const exit = gridSystem.getExit()
      expect(exit).toEqual([4, 4])
    })

    it('返回的位置应该与 cells 中标记的出口一致', () => {
      const exit = gridSystem.getExit()
      const cell = gridSystem.getCell(exit)
      expect(cell!.isExit).toBe(true)
    })

    it('返回的位置应该与路径终点一致', () => {
      const exit = gridSystem.getExit()
      const path = gridSystem.getCurrentPath()
      expect(exit).toEqual(path[path.length - 1])
    })
  })
})
