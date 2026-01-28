/**
 * Game configuration type definitions
 * All configurations are provided by the server; the client has no built-in defaults
 */

// ============================================================================
// Basic types
// ============================================================================

/** Coordinate tuple [x, y] */
export type Position = [number, number]

/** Building type enum */
export type BuildingType = 'wall' | 'cannon' | 'LMG' | 'HMG' | 'laser_gun'

/** Monster type index (0-8) */
export type MonsterTypeId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

// ============================================================================
// Server-provided configuration types
// ============================================================================

/** Building configuration (from server) */
export interface BuildingConfig {
  /** Building name */
  name: string
  /** Build cost */
  cost: number
  /** Base damage (0 for wall) */
  damage: number
  /** Minimum attack range (in grid cells) */
  range: number
  /** Maximum attack range (in grid cells, upgradable to this value) */
  max_range: number
  /** Attack speed (higher means faster; 0 for wall) */
  speed: number
  /** Bullet speed (0 for laser_gun, instant hit) */
  bullet_speed: number
  /** Building hit points */
  life: number
  /** Building shield value */
  shield: number
  /** Upgrade cost ratio (default 0.75) */
  upgradeCostRatio: number
  /** Sell refund ratio (default 0.5) */
  sellRatio: number
}

/** Monster display configuration (from server) */
export interface MonsterDisplayConfig {
  name: string
  color: string
  /** Damage dealt upon reaching the exit (1-10, fixed value unaffected by difficulty) */
  damage: number
}

/** Map configuration (from server) */
export interface MapConfig {
  width: number
  height: number
  entrance: Position
  exit: Position
  obstacles: Position[]
}

/** Initial state configuration (from server) */
export interface InitialConfig {
  money: number
  life: number
  difficulty: number
}

/** Complete game configuration (from server) */
export interface GameConfig {
  buildings: Record<BuildingType, BuildingConfig>
  monsters: Record<MonsterTypeId, MonsterDisplayConfig>
  map: MapConfig
  initial: InitialConfig
}

// ============================================================================
// Game constants
// ============================================================================

/** Game constants */
export const GAME_CONSTANTS = {
  /** Grid cell size (pixels) */
  GRID_SIZE: 32,
  /** Game frame rate */
  FPS: 60,
  /** Interval frames between waves (3 seconds) */
  WAVE_INTERVAL_FRAMES: 180,
  /** Maximum life cap */
  MAX_LIFE: 100,
  /** Maximum number of monsters of the same type per wave */
  MAX_MONSTERS_PER_TYPE_PER_WAVE: 3,
  /** Monster spawn interval frames (interval between monsters appearing from the entrance) */
  MONSTER_SPAWN_INTERVAL_FRAMES: 30,
  /** Global speed factor (based on legacy implementation TD.global_speed = 0.1) */
  GLOBAL_SPEED: 0.1,
} as const

/** Building type array (for UI display order) */
export const BUILDING_TYPES: readonly BuildingType[] = [
  'wall',
  'cannon',
  'LMG',
  'HMG',
  'laser_gun',
] as const

/** Monster type array */
export const MONSTER_TYPES: readonly MonsterTypeId[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8,
] as const

/** Number of monster types */
export const MONSTER_TYPE_COUNT = MONSTER_TYPES.length

// ============================================================================
// Type guards
// ============================================================================

/** Check if the value is a valid building type */
export function isBuildingType(value: string): value is BuildingType {
  return BUILDING_TYPES.includes(value as BuildingType)
}

/** Check if the building is a weapon (can attack) */
export function isWeaponBuilding(type: BuildingType): boolean {
  return type !== 'wall'
}

/** Check if the value is a valid monster type */
export function isMonsterType(value: number): value is MonsterTypeId {
  return MONSTER_TYPES.includes(value as MonsterTypeId)
}

// ============================================================================
// Upgrade rules
// ============================================================================

/**
 * Upgrade multiplier configuration
 * - Default: attribute x 1.2 per level
 * - cannon: levels 1-10 x 1.2, level 11+ x 1.3
 * - HMG: x 1.3 per level
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

/** Get the upgrade multiplier for a given building type and level */
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
// JSON conversion helpers
// ============================================================================

/**
 * Convert the API-returned monsters config to the correct key type
 * JSON keys are strings "0", "1", etc., and need to be converted to numeric indices
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
 * Validate and convert the API-returned GameConfig
 * Handles key type issues caused by JSON serialization
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
