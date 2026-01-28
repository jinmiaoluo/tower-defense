/**
 * Game entity type definitions
 * Interface definitions for Phaser game objects
 */

import type { BuildingType, MonsterTypeId, Position } from './config'
import type { MonsterConfig } from './api'
import type { IWaveRecorder } from './recorder'

// ============================================================================
// Monster entity
// ============================================================================

/** Monster entity interface */
export interface IMonster {
  /** Unique ID (UUID provided by the server) */
  readonly id: string
  /** Monster type */
  readonly type: MonsterTypeId
  /** Maximum hit points */
  readonly maxLife: number
  /** Current hit points */
  currentLife: number
  /** Movement speed (grid cells per frame) */
  readonly speed: number
  /** Shield value (damage reduction per attack, static value that does not deplete) */
  readonly shield: number
  /** Money reward on kill */
  readonly money: number
  /** Damage dealt upon reaching the exit (from config.monsters[type].damage) */
  readonly damage: number
  /** Collision radius (calculated from damage: floor(damage * 1.2), range 4-12) */
  readonly radius: number
  /** Color (for rendering, from MonsterDisplayConfig or randomly generated) */
  readonly color: string
  /** Path progress (0-1) */
  progress: number
  /** Whether the monster is valid (not killed and has not reached the exit) */
  isValid: boolean

  /**
   * Take damage, returns the actual damage dealt
   * Damage calculation: actualDamage = max(rawDamage - shield, rawDamage x 0.1)
   * Minimum damage is 10% of raw damage, ensuring high-damage weapons are more effective against shielded monsters
   * Consistent with the legacy implementation, shield is a static value that does not deplete on hit
   */
  takeDamage(rawDamage: number): number

  /** Whether the monster is dead */
  isDead(): boolean

  /** Whether the monster has reached the exit */
  reachedExit(): boolean

  /** Get the current grid position */
  getGridPosition(): Position

  /** Get the current pixel position (for rendering) */
  getPixelPosition(): { x: number; y: number }
}

/** Monster creation parameters */
export interface MonsterCreateParams extends MonsterConfig {
  /** Color (for rendering, from MonsterDisplayConfig) */
  color: string
  /** Damage dealt upon reaching the exit (from config.monsters[type].damage) */
  damage: number
}

// ============================================================================
// Building entity
// ============================================================================

/** Building entity interface */
export interface IBuilding {
  /** Unique ID */
  readonly id: string
  /** Building type */
  readonly type: BuildingType
  /** Level */
  level: number
  /** Position */
  readonly position: Position
  /** Attack cooldown counter */
  cooldown: number
  /** Cumulative damage dealt this wave */
  damageDealt: number
  /** Kills this wave */
  kills: number

  /** Whether the building can attack */
  canAttack(): boolean

  /** Find a target among the monster list */
  findTarget(monsters: IMonster[]): IMonster | null

  /** Attack the target */
  attack(target: IMonster, recorder: IWaveRecorder, frame: number): void

  /** Get the current damage value */
  getDamage(): number

  /** Get the current range */
  getRange(): number

  /** Get the attack speed (frame interval) */
  getAttackSpeed(): number

  /** Reset wave statistics */
  resetWaveStats(): void

  /** Get the current target grid position (for rendering turret orientation, includes last target position) */
  getCurrentTargetPosition(): Position | null

  /** Whether there is an active target (for laser beam rendering) */
  hasActiveTarget(): boolean
}

/** Building creation parameters */
export interface BuildingCreateParams {
  id: string
  type: BuildingType
  position: Position
  level?: number
}

// ============================================================================
// Bullet entity
// ============================================================================

/** Bullet entity interface */
export interface IBullet {
  /** Owning building */
  readonly building: IBuilding
  /** Target monster */
  readonly target: IMonster
  /** Damage value */
  readonly damage: number
  /** Speed */
  readonly speed: number
  /** Current position */
  x: number
  y: number
  /** Whether the bullet is valid */
  isValid: boolean

  /** Update position */
  update(): void

  /** Check if the bullet has hit */
  checkHit(): boolean
}

/** Bullet creation parameters */
export interface BulletCreateParams {
  building: IBuilding
  target: IMonster
  damage: number
  speed: number
  startX: number
  startY: number
}

// ============================================================================
// Path related
// ============================================================================

/** Path point */
export type PathPoint = Position

/** Path (a series of coordinate points) */
export type Path = PathPoint[]

/** Pathfinding interface */
export interface IPathFinder {
  /** Find a path from start to end */
  findPath(
    start: Position,
    end: Position,
    isPassable: (x: number, y: number) => boolean,
  ): Path | null
}

// ============================================================================
// Game scene related
// ============================================================================

/** Grid cell state */
export interface GridCell {
  /** Grid coordinates */
  position: Position
  /** Whether the cell is passable */
  isPassable: boolean
  /** Placed building ID (if any) */
  buildingId: string | null
  /** Whether this is the entrance */
  isEntrance: boolean
  /** Whether this is the exit */
  isExit: boolean
  /** Whether this is an obstacle */
  isObstacle: boolean
}

/** Map state */
export interface MapState {
  /** Width (in grid cells) */
  width: number
  /** Height (in grid cells) */
  height: number
  /** Grid cell array */
  cells: GridCell[][]
  /** Cached path */
  cachedPath: Path | null
}

// ============================================================================
// Game scene interface
// ============================================================================

/** Game scene interface */
export interface IGameScene {
  /** Current frame number */
  currentFrame: number
  /** Map state */
  map: MapState
  /** Monster list */
  monsters: IMonster[]
  /** Building list */
  buildings: IBuilding[]
  /** Bullet list */
  bullets: IBullet[]
  /** Wave recorder */
  recorder: IWaveRecorder

  /** Add a monster */
  addMonster(params: MonsterCreateParams): IMonster

  /** Remove a monster */
  removeMonster(id: string): void

  /** Add a building */
  addBuilding(params: BuildingCreateParams): IBuilding

  /** Remove a building */
  removeBuilding(id: string): void

  /** Get a building */
  getBuilding(id: string): IBuilding | null

  /** Check if a building can be placed at the position */
  canPlaceBuilding(position: Position): boolean

  /** Get the path */
  getPath(): Path

  /** Update game logic */
  update(): void
}

// ============================================================================
// Helper types
// ============================================================================

/** Calculate the Euclidean distance between two points */
export function calculateDistance(a: Position, b: Position): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/** Calculate the Manhattan distance between two points */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

/** Check if two positions are the same */
export function isSamePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}
