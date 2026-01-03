/**
 * BuildingSystem 测试用例
 * 测试建筑系统的核心计算逻辑
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { BuildingConfig, BuildingType, GameConfig, Position } from '@/types'
import {
  createBuildingSystem,
  type BuildingSystem,
  type BuildingForRangeCheck,
} from './BuildingSystem'

// Mock 游戏配置（模拟服务端下发的配置）
const mockBuildingConfigs: Record<BuildingType, BuildingConfig> = {
  wall: {
    name: '路障',
    cost: 5,
    damage: 0,
    range: 0,
    max_range: 0,
    speed: 0,
    bullet_speed: 0,
    life: 100,
    shield: 500,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
  cannon: {
    name: '炮台',
    cost: 300,
    damage: 12,
    range: 4,
    max_range: 8,
    speed: 2,
    bullet_speed: 6,
    life: 100,
    shield: 100,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
  LMG: {
    name: '轻机枪',
    cost: 100,
    damage: 5,
    range: 5,
    max_range: 10,
    speed: 3,
    bullet_speed: 6,
    life: 100,
    shield: 50,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
  HMG: {
    name: '重机枪',
    cost: 800,
    damage: 30,
    range: 3,
    max_range: 5,
    speed: 3,
    bullet_speed: 5,
    life: 100,
    shield: 200,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
  laser_gun: {
    name: '激光枪',
    cost: 2000,
    damage: 25,
    range: 6,
    max_range: 10,
    speed: 20,
    bullet_speed: 0,
    life: 100,
    shield: 100,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
}

const mockGameConfig: GameConfig = {
  buildings: mockBuildingConfigs,
  monsters: {} as GameConfig['monsters'],
  map: {
    width: 16,
    height: 16,
    entrance: [0, 0],
    exit: [15, 15],
    obstacles: [],
  },
  initial: {
    money: 500,
    life: 100,
    difficulty: 1.0,
  },
}

describe('BuildingSystem', () => {
  let system: BuildingSystem

  beforeEach(() => {
    system = createBuildingSystem(mockGameConfig)
  })

  // ============================================================================
  // getTotalCost - 累计花费计算
  // ============================================================================

  describe('getTotalCost', () => {
    it('1 级建筑累计花费等于建造成本', () => {
      expect(system.getTotalCost('cannon', 1)).toBe(300)
      expect(system.getTotalCost('LMG', 1)).toBe(100)
      expect(system.getTotalCost('wall', 1)).toBe(5)
    })

    it('2 级建筑累计花费 = 建造成本 + 升级成本', () => {
      // cannon: 300 + floor(300 * 0.75) = 300 + 225 = 525
      expect(system.getTotalCost('cannon', 2)).toBe(525)
      // LMG: 100 + floor(100 * 0.75) = 100 + 75 = 175
      expect(system.getTotalCost('LMG', 2)).toBe(175)
    })

    it('3 级建筑累计花费正确计算', () => {
      // cannon: 300 + 225 + floor(525 * 0.75) = 525 + 393 = 918
      expect(system.getTotalCost('cannon', 3)).toBe(918)
    })

    it('高等级建筑累计花费', () => {
      // 验证多次升级后的累计花费是递增的
      const costs = [1, 2, 3, 4, 5].map((level) => system.getTotalCost('cannon', level))
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1])
      }
    })
  })

  // ============================================================================
  // getUpgradeCost - 升级成本计算
  // ============================================================================

  describe('getUpgradeCost', () => {
    it('1 级升级到 2 级的成本', () => {
      // cannon: floor(300 * 0.75) = 225
      expect(system.getUpgradeCost('cannon', 1)).toBe(225)
      // LMG: floor(100 * 0.75) = 75
      expect(system.getUpgradeCost('LMG', 1)).toBe(75)
    })

    it('2 级升级到 3 级的成本', () => {
      // cannon 2 级累计花费 525，升级成本 = floor(525 * 0.75) = 393
      expect(system.getUpgradeCost('cannon', 2)).toBe(393)
    })

    it('升级成本随等级递增', () => {
      const costs = [1, 2, 3, 4, 5].map((level) => system.getUpgradeCost('cannon', level))
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]).toBeGreaterThan(costs[i - 1])
      }
    })
  })

  // ============================================================================
  // getSellIncome - 出售回收计算
  // ============================================================================

  describe('getSellIncome', () => {
    it('1 级建筑出售回收 = 建造成本 × 0.5', () => {
      // cannon: floor(300 * 0.5) = 150
      expect(system.getSellIncome('cannon', 1)).toBe(150)
      // LMG: floor(100 * 0.5) = 50
      expect(system.getSellIncome('LMG', 1)).toBe(50)
    })

    it('2 级建筑出售回收 = 累计花费 × 0.5', () => {
      // cannon 2 级累计花费 525，出售 = floor(525 * 0.5) = 262
      expect(system.getSellIncome('cannon', 2)).toBe(262)
    })

    it('wall 出售最少返回 1 金币', () => {
      // wall 建造成本 5，出售 = floor(5 * 0.5) = 2
      expect(system.getSellIncome('wall', 1)).toBe(2)
    })

    it('出售回收最小值为 1', () => {
      // 即使计算结果为 0，也应返回 1
      const income = system.getSellIncome('wall', 1)
      expect(income).toBeGreaterThanOrEqual(1)
    })
  })

  // ============================================================================
  // getDamageAtLevel - 等级伤害计算
  // ============================================================================

  describe('getDamageAtLevel', () => {
    it('1 级伤害等于基础伤害', () => {
      expect(system.getDamageAtLevel('cannon', 1)).toBe(12)
      expect(system.getDamageAtLevel('LMG', 1)).toBe(5)
      expect(system.getDamageAtLevel('HMG', 1)).toBe(30)
    })

    it('wall 伤害始终为 0', () => {
      expect(system.getDamageAtLevel('wall', 1)).toBe(0)
      expect(system.getDamageAtLevel('wall', 5)).toBe(0)
    })

    it('默认升级规则：每级 × 1.2', () => {
      // LMG 2 级: floor(5 * 1.2) = 6
      expect(system.getDamageAtLevel('LMG', 2)).toBe(6)
      // LMG 3 级: floor(6 * 1.2) = 7
      expect(system.getDamageAtLevel('LMG', 3)).toBe(7)
    })

    it('cannon 升级规则：1-10 级 × 1.2，11 级起 × 1.3', () => {
      // 从 10 级升到 11 级时，使用的是等级 10 的倍率 1.2
      const damage10 = system.getDamageAtLevel('cannon', 10)
      const damage11 = system.getDamageAtLevel('cannon', 11)
      expect(damage11).toBe(Math.floor(damage10 * 1.2))

      // 从 11 级升到 12 级时，使用的是等级 11 的倍率 1.3
      const damage12 = system.getDamageAtLevel('cannon', 12)
      expect(damage12).toBe(Math.floor(damage11 * 1.3))
    })

    it('HMG 升级规则：每级 × 1.3', () => {
      // HMG 2 级: floor(30 * 1.3) = 39
      expect(system.getDamageAtLevel('HMG', 2)).toBe(39)
      // HMG 3 级: floor(39 * 1.3) = 50
      expect(system.getDamageAtLevel('HMG', 3)).toBe(50)
    })

    it('laser_gun 升级规则：每级 × 1.2', () => {
      // laser_gun 2 级: floor(25 * 1.2) = 30
      expect(system.getDamageAtLevel('laser_gun', 2)).toBe(30)
    })
  })

  // ============================================================================
  // getRangeAtLevel - 等级射程计算
  // 参考旧实现 td-obj-building.js:258-289，使用默认升级规则每级 ×1.2
  // ============================================================================

  describe('getRangeAtLevel', () => {
    it('1 级射程等于基础射程', () => {
      expect(system.getRangeAtLevel('cannon', 1)).toBe(4)
      expect(system.getRangeAtLevel('LMG', 1)).toBe(5)
    })

    it('wall 射程始终为 0', () => {
      expect(system.getRangeAtLevel('wall', 1)).toBe(0)
      expect(system.getRangeAtLevel('wall', 10)).toBe(0)
    })

    it('射程随等级增加（每级 × 1.2）', () => {
      // 2 级射程 = floor(4 * 1.2) = 4
      expect(system.getRangeAtLevel('cannon', 2)).toBe(4)
      // 3 级射程 = floor(4.8 * 1.2) = floor(5.76) = 5
      expect(system.getRangeAtLevel('cannon', 3)).toBe(5)
      // 4 级射程 = floor(5.76 * 1.2) = floor(6.91) = 6
      expect(system.getRangeAtLevel('cannon', 4)).toBe(6)
    })

    it('射程不超过 max_range', () => {
      // cannon max_range 是 8，即使等级很高也不能超过
      // 6 级射程 = floor(4 * 1.2^5) = floor(9.95) = 9，受 max_range=8 限制 -> 8
      expect(system.getRangeAtLevel('cannon', 6)).toBe(8)
      // 更高等级仍然受限
      expect(system.getRangeAtLevel('cannon', 100)).toBe(8)
    })
  })

  // ============================================================================
  // isInRange - 射程验证
  // 参考旧实现 td-obj-building.js:187-204，无最小射程限制
  // ============================================================================

  describe('isInRange', () => {
    it('目标在射程内返回 true', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // cannon 1 级射程 4，检查距离 3 的目标
      const target: Position = [5, 8] // 距离 3
      expect(system.isInRange(building, target)).toBe(true)
    })

    it('目标距离为 0 也在射程内（无最小射程）', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // 目标与建筑重叠
      const target: Position = [5, 5] // 距离 0
      expect(system.isInRange(building, target)).toBe(true)
    })

    it('目标太远（大于当前射程）返回 false', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // cannon 1 级射程 4，检查距离 5 的目标
      const target: Position = [5, 10] // 距离 5
      expect(system.isInRange(building, target)).toBe(false)
    })

    it('wall 没有射程，始终返回 false', () => {
      const building: BuildingForRangeCheck = {
        type: 'wall',
        level: 1,
        position: [5, 5],
      }
      const target: Position = [5, 5]
      expect(system.isInRange(building, target)).toBe(false)
    })

    it('高等级建筑射程增加', () => {
      const building1: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      const building6: BuildingForRangeCheck = {
        type: 'cannon',
        level: 6,
        position: [5, 5],
      }
      // 距离 7 在 1 级时超出射程（射程 4），但在 6 级时在射程内（射程 8）
      const target: Position = [5, 12] // 距离 7
      expect(system.isInRange(building1, target)).toBe(false)
      expect(system.isInRange(building6, target)).toBe(true)
    })

    it('边界情况：目标刚好在射程边界上', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // cannon 1 级射程 4
      const target: Position = [5, 9] // 距离 4
      expect(system.isInRange(building, target)).toBe(true)
    })

    it('边界情况：目标刚好超出射程', () => {
      const building: BuildingForRangeCheck = {
        type: 'cannon',
        level: 1,
        position: [5, 5],
      }
      // cannon 1 级射程 4，距离 4.1 超出
      const target: Position = [5, 9.1] // 距离 4.1
      expect(system.isInRange(building, target)).toBe(false)
    })
  })

  // ============================================================================
  // getAttackSpeedFrames - 攻击间隔帧数
  // 参考旧实现 td-obj-building.js:168
  // 旧公式: floor(max(2 / (speed * global_speed), 1)) 帧（24 FPS）
  // 新公式: floor(max(2 / (speed * 0.1) * (60 / 24), 1)) = floor(50 / speed)
  // ============================================================================

  describe('getAttackSpeedFrames', () => {
    it('根据旧实现公式计算攻击间隔帧数（保持相同攻击频率）', () => {
      // 旧实现: 2 / (speed * 0.1) = 20 / speed 帧（24 FPS）
      // 新实现: 乘以帧率比例 60/24 = 2.5，即 50 / speed 帧（60 FPS）
      // cannon speed=2: floor(50 / 2) = 25 帧
      expect(system.getAttackSpeedFrames('cannon')).toBe(25)
      // LMG speed=3: floor(50 / 3) = 16 帧
      expect(system.getAttackSpeedFrames('LMG')).toBe(16)
      // HMG speed=3: floor(50 / 3) = 16 帧
      expect(system.getAttackSpeedFrames('HMG')).toBe(16)
      // laser_gun speed=20: floor(50 / 20) = 2 帧
      expect(system.getAttackSpeedFrames('laser_gun')).toBe(2)
    })

    it('wall 没有攻击速度，返回 Infinity', () => {
      expect(system.getAttackSpeedFrames('wall')).toBe(Infinity)
    })

    it('攻击间隔最小为 1 帧', () => {
      // 即使 speed 很高，间隔也至少 1 帧
      const frames = system.getAttackSpeedFrames('laser_gun')
      expect(frames).toBeGreaterThanOrEqual(1)
    })

    it('攻击频率与旧实现保持一致', () => {
      // 验证攻击间隔时间（秒）与旧实现一致
      // 旧实现 24 FPS: cannon 10 帧 = 0.417 秒
      // 新实现 60 FPS: cannon 25 帧 = 0.417 秒
      const cannonFrames = system.getAttackSpeedFrames('cannon')
      const cannonSeconds = cannonFrames / 60
      expect(cannonSeconds).toBeCloseTo(0.417, 2)

      // 旧实现 24 FPS: LMG 6 帧 = 0.25 秒
      // 新实现 60 FPS: LMG 16 帧 = 0.267 秒（略有差异是因为取整）
      const lmgFrames = system.getAttackSpeedFrames('LMG')
      const lmgSeconds = lmgFrames / 60
      expect(lmgSeconds).toBeCloseTo(0.25, 1)
    })
  })

  // ============================================================================
  // canAfford - 金钱检查
  // ============================================================================

  describe('canAfford', () => {
    it('金钱足够时返回 true', () => {
      expect(system.canAfford(500, 'cannon')).toBe(true)
      expect(system.canAfford(300, 'cannon')).toBe(true)
    })

    it('金钱不足时返回 false', () => {
      expect(system.canAfford(100, 'cannon')).toBe(false)
      expect(system.canAfford(299, 'cannon')).toBe(false)
    })

    it('金钱刚好等于建造成本时返回 true', () => {
      expect(system.canAfford(300, 'cannon')).toBe(true)
      expect(system.canAfford(5, 'wall')).toBe(true)
    })
  })

  // ============================================================================
  // canAffordUpgrade - 升级金钱检查
  // ============================================================================

  describe('canAffordUpgrade', () => {
    it('金钱足够升级时返回 true', () => {
      // cannon 1 级升级成本 225
      expect(system.canAffordUpgrade(500, 'cannon', 1)).toBe(true)
      expect(system.canAffordUpgrade(225, 'cannon', 1)).toBe(true)
    })

    it('金钱不足升级时返回 false', () => {
      expect(system.canAffordUpgrade(100, 'cannon', 1)).toBe(false)
      expect(system.canAffordUpgrade(224, 'cannon', 1)).toBe(false)
    })
  })

  // ============================================================================
  // isWeapon - 武器判断
  // ============================================================================

  describe('isWeapon', () => {
    it('wall 不是武器', () => {
      expect(system.isWeapon('wall')).toBe(false)
    })

    it('其他建筑都是武器', () => {
      expect(system.isWeapon('cannon')).toBe(true)
      expect(system.isWeapon('LMG')).toBe(true)
      expect(system.isWeapon('HMG')).toBe(true)
      expect(system.isWeapon('laser_gun')).toBe(true)
    })
  })

  // ============================================================================
  // getBuildingConfig - 获取建筑配置
  // ============================================================================

  describe('getBuildingConfig', () => {
    it('返回指定建筑类型的配置', () => {
      const config = system.getBuildingConfig('cannon')
      expect(config.name).toBe('炮台')
      expect(config.cost).toBe(300)
      expect(config.damage).toBe(12)
    })
  })
})
