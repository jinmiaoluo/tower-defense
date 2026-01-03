/**
 * 游戏配置 Mock 数据
 * 数据来源：docs/BACKEND_GUIDE.md
 */

import type {
  BuildingConfig,
  BuildingType,
  GameConfig,
  InitialConfig,
  MapConfig,
  MonsterDisplayConfig,
  MonsterTypeId,
} from '@/types'

/** 建筑配置（参考 SPEC.md 塔类型表格） */
export const MOCK_BUILDINGS: Record<BuildingType, BuildingConfig> = {
  wall: {
    name: '路障',
    cost: 5,
    damage: 0,
    range: 0,
    max_range: 0,
    speed: 0,
    bullet_speed: 0,
    life: 100,
    shield: 0,
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
    bullet_speed: 10,
    life: 100,
    shield: 0,
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
    bullet_speed: 15,
    life: 100,
    shield: 0,
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
    bullet_speed: 12,
    life: 100,
    shield: 0,
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
    shield: 0,
    upgradeCostRatio: 0.75,
    sellRatio: 0.5,
  },
}

/** 怪物静态配置（name, color, damage） */
export const MOCK_MONSTERS: Record<MonsterTypeId, MonsterDisplayConfig> = {
  0: { name: '普通怪', color: '#00ff00', damage: 1 },
  1: { name: '稍强怪', color: '#33ff33', damage: 2 },
  2: { name: '速度怪', color: '#66ff66', damage: 3 },
  3: { name: '血量怪', color: '#ff0000', damage: 3 },
  4: { name: '护盾怪', color: '#0000ff', damage: 3 },
  5: { name: '伤害怪', color: '#ff00ff', damage: 10 },
  6: { name: '速度血量怪', color: '#ffff00', damage: 3 },
  7: { name: '极速怪', color: '#00ffff', damage: 4 },
  8: { name: '护盾血量怪', color: '#ff6600', damage: 5 },
}

/**
 * 怪物基础属性（用于波次生成时计算）
 * life/speed/shield 会根据难度系数动态调整
 * max_speed 是速度上限，防止高难度时怪物过快
 */
export const MOCK_MONSTER_BASE_STATS: Record<
  MonsterTypeId,
  { life: number; speed: number; max_speed: number; shield: number; money: number }
> = {
  0: { life: 50, speed: 3, max_speed: 10, shield: 0, money: 5 },
  1: { life: 50, speed: 6, max_speed: 20, shield: 1, money: 8 },
  2: { life: 50, speed: 12, max_speed: 30, shield: 1, money: 10 },
  3: { life: 500, speed: 5, max_speed: 10, shield: 1, money: 50 },
  4: { life: 50, speed: 5, max_speed: 10, shield: 20, money: 30 },
  5: { life: 50, speed: 7, max_speed: 14, shield: 2, money: 25 },
  6: { life: 100, speed: 15, max_speed: 30, shield: 3, money: 35 },
  7: { life: 30, speed: 30, max_speed: 40, shield: 1, money: 20 },
  8: { life: 300, speed: 3, max_speed: 10, shield: 15, money: 60 },
}

/** 地图配置 */
export const MOCK_MAP: MapConfig = {
  width: 16,
  height: 16,
  entrance: [0, 0],
  exit: [15, 15],
  obstacles: [],
}

/** 初始状态 */
export const MOCK_INITIAL: InitialConfig = {
  money: 500,
  life: 100,
  difficulty: 1.0,
}

/** 完整游戏配置 */
export const MOCK_GAME_CONFIG: GameConfig = {
  buildings: MOCK_BUILDINGS,
  monsters: MOCK_MONSTERS,
  map: MOCK_MAP,
  initial: MOCK_INITIAL,
}
