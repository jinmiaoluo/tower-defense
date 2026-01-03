/**
 * 游戏配置类型定义
 * 所有配置由服务端下发，客户端不内置任何默认值
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 坐标元组 [x, y] */
export type Position = [number, number]

/** 建筑类型枚举 */
export type BuildingType = 'wall' | 'cannon' | 'LMG' | 'HMG' | 'laser_gun'

/** 怪物类型索引 (0-8) */
export type MonsterTypeId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

// ============================================================================
// 服务端下发的配置类型
// ============================================================================

/** 建筑配置（服务端下发） */
export interface BuildingConfig {
  /** 建筑名称 */
  name: string
  /** 建造费用 */
  cost: number
  /** 基础伤害（wall 为 0） */
  damage: number
  /** 最小攻击范围（格子数） */
  range: number
  /** 最大攻击范围（格子数，升级可扩展到此值） */
  max_range: number
  /** 攻击速度（越高攻击越快，wall 为 0） */
  speed: number
  /** 子弹速度（laser_gun 为 0，即时命中） */
  bullet_speed: number
  /** 建筑生命值 */
  life: number
  /** 建筑护盾值 */
  shield: number
  /** 升级成本比例（默认 0.75） */
  upgradeCostRatio: number
  /** 出售回收比例（默认 0.5） */
  sellRatio: number
}

/** 怪物静态配置（服务端下发） */
export interface MonsterDisplayConfig {
  name: string
  color: string
  /** 到达终点造成的伤害（1-10，固定值不受难度影响） */
  damage: number
}

/** 地图配置（服务端下发） */
export interface MapConfig {
  width: number
  height: number
  entrance: Position
  exit: Position
  obstacles: Position[]
}

/** 初始状态配置（服务端下发） */
export interface InitialConfig {
  money: number
  life: number
  difficulty: number
}

/** 完整游戏配置（服务端下发） */
export interface GameConfig {
  buildings: Record<BuildingType, BuildingConfig>
  monsters: Record<MonsterTypeId, MonsterDisplayConfig>
  map: MapConfig
  initial: InitialConfig
}

// ============================================================================
// 游戏常量
// ============================================================================

/** 游戏常量 */
export const GAME_CONSTANTS = {
  /** 格子大小（像素） */
  GRID_SIZE: 32,
  /** 游戏帧率 */
  FPS: 60,
  /** 波次间隔帧数（3 秒） */
  WAVE_INTERVAL_FRAMES: 180,
  /** 最大生命值上限 */
  MAX_LIFE: 100,
  /** 同一类型怪物单波最大数量 */
  MAX_MONSTERS_PER_TYPE_PER_WAVE: 3,
  /** 怪物生成间隔帧数（怪物逐个从入口出现的间隔） */
  MONSTER_SPAWN_INTERVAL_FRAMES: 30,
  /** 全局速度系数（参考旧实现 TD.global_speed = 0.1） */
  GLOBAL_SPEED: 0.1,
} as const

/** 建筑类型数组（用于 UI 展示顺序） */
export const BUILDING_TYPES: readonly BuildingType[] = [
  'wall',
  'cannon',
  'LMG',
  'HMG',
  'laser_gun',
] as const

/** 怪物类型数组 */
export const MONSTER_TYPES: readonly MonsterTypeId[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8,
] as const

/** 怪物类型数量 */
export const MONSTER_TYPE_COUNT = MONSTER_TYPES.length

// ============================================================================
// 类型守卫
// ============================================================================

/** 判断是否为有效的建筑类型 */
export function isBuildingType(value: string): value is BuildingType {
  return BUILDING_TYPES.includes(value as BuildingType)
}

/** 判断建筑是否为武器（可攻击） */
export function isWeaponBuilding(type: BuildingType): boolean {
  return type !== 'wall'
}

/** 判断是否为有效的怪物类型 */
export function isMonsterType(value: number): value is MonsterTypeId {
  return MONSTER_TYPES.includes(value as MonsterTypeId)
}

// ============================================================================
// 升级规则
// ============================================================================

/**
 * 升级倍率配置
 * - 默认: 每级属性 × 1.2
 * - cannon: 1-10 级 × 1.2，11 级起 × 1.3
 * - HMG: 每级 × 1.3
 */
export interface UpgradeMultiplier {
  default: number
  special?: {
    levelThreshold: number
    beforeThreshold: number
    afterThreshold: number
  }
}

export const UPGRADE_MULTIPLIERS: Record<BuildingType, UpgradeMultiplier> = {
  wall: { default: 1.2 },
  cannon: {
    default: 1.2,
    special: {
      levelThreshold: 10,
      beforeThreshold: 1.2,
      afterThreshold: 1.3,
    },
  },
  LMG: { default: 1.2 },
  HMG: { default: 1.3 },
  laser_gun: { default: 1.2 },
}

/** 获取指定建筑类型和等级的升级倍率 */
export function getUpgradeMultiplier(type: BuildingType, level: number): number {
  const config = UPGRADE_MULTIPLIERS[type]
  if (config.special) {
    return level <= config.special.levelThreshold
      ? config.special.beforeThreshold
      : config.special.afterThreshold
  }
  return config.default
}

// ============================================================================
// JSON 转换辅助函数
// ============================================================================

/**
 * 将 API 返回的 monsters 配置转换为正确的键类型
 * JSON 中键是字符串 "0", "1"，需要转换为数字索引
 */
export function parseMonsterConfigs(
  raw: Record<string, MonsterDisplayConfig>,
): Record<MonsterTypeId, MonsterDisplayConfig> {
  const result = {} as Record<MonsterTypeId, MonsterDisplayConfig>
  for (const key of Object.keys(raw)) {
    const typeId = parseInt(key, 10) as MonsterTypeId
    if (isMonsterType(typeId)) {
      result[typeId] = raw[key]
    }
  }
  return result
}

/**
 * 验证并转换 API 返回的 GameConfig
 * 处理 JSON 序列化导致的键类型问题
 */
export function parseGameConfig(raw: unknown): GameConfig {
  const config = raw as {
    buildings: Record<string, BuildingConfig>
    monsters: Record<string, MonsterDisplayConfig>
    map: MapConfig
    initial: InitialConfig
  }
  return {
    buildings: config.buildings as Record<BuildingType, BuildingConfig>,
    monsters: parseMonsterConfigs(config.monsters),
    map: config.map,
    initial: config.initial,
  }
}
