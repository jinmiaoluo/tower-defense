/**
 * Game configuration mock data
 * Data source: docs/BACKEND_GUIDE.md
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

/** Building configuration (reference: SPEC.md tower type table) */
export const MOCK_BUILDINGS: Record<BuildingType, BuildingConfig> = {
  wall: {
    name: 'Wall',
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
    name: 'Cannon',
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
    name: 'Light Machine Gun',
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
    name: 'Heavy Machine Gun',
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
    name: 'Laser Gun',
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

/** Monster static configuration (name, color, damage) */
export const MOCK_MONSTERS: Record<MonsterTypeId, MonsterDisplayConfig> = {
  0: { name: 'Normal', color: '#00ff00', damage: 1 },
  1: { name: 'Slightly Strong', color: '#33ff33', damage: 2 },
  2: { name: 'Speeder', color: '#66ff66', damage: 3 },
  3: { name: 'Tank', color: '#ff0000', damage: 3 },
  4: { name: 'Shielded', color: '#0000ff', damage: 3 },
  5: { name: 'Heavy Hitter', color: '#ff00ff', damage: 10 },
  6: { name: 'Fast Tank', color: '#ffff00', damage: 3 },
  7: { name: 'Ultra Speeder', color: '#00ffff', damage: 4 },
  8: { name: 'Shielded Tank', color: '#ff6600', damage: 5 },
}

/**
 * Monster base stats (used for wave generation calculations)
 * life/speed/shield are dynamically adjusted by difficulty coefficient
 * max_speed is the speed cap to prevent monsters from being too fast at high difficulty
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

/** Map configuration */
export const MOCK_MAP: MapConfig = {
  width: 16,
  height: 16,
  entrance: [0, 0],
  exit: [15, 15],
  obstacles: [],
}

/** Initial state */
export const MOCK_INITIAL: InitialConfig = {
  money: 500,
  life: 100,
  difficulty: 1.0,
}

/** Full game configuration */
export const MOCK_GAME_CONFIG: GameConfig = {
  buildings: MOCK_BUILDINGS,
  monsters: MOCK_MONSTERS,
  map: MOCK_MAP,
  initial: MOCK_INITIAL,
}
