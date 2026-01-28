/**
 * Monster - Monster entity
 * Handles monster state management, damage calculation, and path following
 * Reference: html5-tower-defense/src/js/td-obj-monster.js
 */

import type { IMonster, MonsterCreateParams, Path } from '@/types/entities'
import type { MonsterTypeId, Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE, GLOBAL_SPEED, FPS } = GAME_CONSTANTS

/** Frame rate of the old implementation (used for speed conversion) */
const OLD_FPS = 24

/** Minimum damage ratio (guarantees high-damage weapons advantage against shielded monsters) */
const MIN_DAMAGE_RATIO = 0.1

/** Monster radius calculation constants (reference: this.r = Math.floor(this.damage * 1.2)) */
const MONSTER_RADIUS_FACTOR = 1.2
const MONSTER_RADIUS_MIN = 4
const MONSTER_RADIUS_MAX = 12

/**
 * Calculate monster radius
 * Based on damage value: floor(damage * 1.2), clamped to range 4-12
 */
function calculateMonsterRadius(damage: number): number {
  const r = Math.floor(damage * MONSTER_RADIUS_FACTOR)
  return Math.max(MONSTER_RADIUS_MIN, Math.min(MONSTER_RADIUS_MAX, r))
}

/**
 * Monster dependencies interface
 * Uses dependency injection to access PathSystem functionality for testability and decoupling
 */
export interface MonsterDependencies {
  /** Generate a path from the specified position to the exit (for independent pathfinding) */
  generatePathFrom: (startPosition: Position) => Path
  /** Get pixel position at the given progress */
  getPositionAtProgress: (path: Path, progress: number) => { x: number; y: number }
  /** Check whether the specified position is passable */
  isPassable: (position: Position) => boolean
  /** Get the map entrance position */
  getEntrance: () => Position
}

/** 10% re-pathing probability (consistent with old implementation) */
const REPATH_PROBABILITY = 0.1

/**
 * Monster implementation class
 *
 * Movement mechanism consistent with the old implementation:
 * - Directly tracks pixel position (pixelX, pixelY), corresponding to (cx, cy) in the old implementation
 * - Each frame moves a fixed pixel distance toward the next cell center
 * - Re-pathing only changes the target, not the current position, ensuring movement continuity
 * - Reference: td-obj-monster.js:238-278 step()
 */
class Monster implements IMonster {
  readonly id: string
  readonly type: MonsterTypeId
  readonly maxLife: number
  currentLife: number
  readonly speed: number
  readonly shield: number
  readonly money: number
  readonly damage: number
  readonly radius: number
  readonly color: string
  isValid: boolean

  private readonly deps: MonsterDependencies
  /** Monster's independent path array (corresponds to this.way in the old implementation) */
  private path: Path = []
  /** Current pixel position X (corresponds to this.cx in the old implementation) */
  private pixelX: number = 0
  /** Current pixel position Y (corresponds to this.cy in the old implementation) */
  private pixelY: number = 0
  /** Target cell index in the current path */
  private targetGridIndex: number = 1
  /** Internal progress value */
  private _progress: number = 0

  /**
   * Get progress (0-1)
   * Progress is a derived value calculated from pixel position
   */
  get progress(): number {
    return this._progress
  }

  /**
   * Set progress (0-1)
   * Setting progress synchronizes the pixel position for backward compatibility
   * This allows test code to position the monster by setting progress
   */
  set progress(value: number) {
    this._progress = Math.max(0, Math.min(1, value))

    // If the path is valid, calculate pixel position from progress
    if (this.path.length >= 2) {
      const totalSegments = this.path.length - 1
      const exactPosition = this._progress * totalSegments
      const segmentIndex = Math.min(Math.floor(exactPosition), totalSegments - 1)
      const segmentProgress = exactPosition - segmentIndex

      const [startX, startY] = this.path[segmentIndex]
      const [endX, endY] = this.path[Math.min(segmentIndex + 1, this.path.length - 1)]

      const startPixelX = startX * GRID_SIZE + GRID_SIZE / 2
      const startPixelY = startY * GRID_SIZE + GRID_SIZE / 2
      const endPixelX = endX * GRID_SIZE + GRID_SIZE / 2
      const endPixelY = endY * GRID_SIZE + GRID_SIZE / 2

      this.pixelX = startPixelX + (endPixelX - startPixelX) * segmentProgress
      this.pixelY = startPixelY + (endPixelY - startPixelY) * segmentProgress

      // Update target cell index
      this.targetGridIndex = Math.min(segmentIndex + 1, this.path.length - 1)
    }
  }

  constructor(params: MonsterCreateParams, deps: MonsterDependencies) {
    this.id = params.id
    this.type = params.type
    this.maxLife = params.life
    this.currentLife = params.life
    this.speed = params.speed
    this.shield = params.shield
    this.money = params.money
    this.damage = params.damage
    this.radius = calculateMonsterRadius(params.damage)
    this.color = params.color
    this.progress = 0
    this.isValid = true
    this.deps = deps

    // Initialize pixel position to the entrance center
    const entrance = deps.getEntrance()
    this.pixelX = entrance[0] * GRID_SIZE + GRID_SIZE / 2
    this.pixelY = entrance[1] * GRID_SIZE + GRID_SIZE / 2

    // Initial pathfinding
    this.findPath()
  }

  /**
   * Independent pathfinding
   * Reference: td-obj-monster.js:124-136 findWay()
   *
   * Important: re-pathing does not change pixel position, only the path
   * This ensures movement continuity, consistent with old implementation behavior
   */
  private findPath(): void {
    const currentGridPos = this.getGridPosition()
    this.path = this.deps.generatePathFrom(currentGridPos)
    // Target cell is the next cell in the path (index 1); index 0 is the current cell
    this.targetGridIndex = 1
  }

  /**
   * Take damage
   * Damage formula: actualDamage = max(rawDamage - shield, rawDamage * 0.1)
   * Consistent with old implementation; shield is a static value and does not decrease
   */
  takeDamage(rawDamage: number): number {
    if (!this.isValid) {
      return 0
    }

    // Calculate minimum damage (guarantees high-damage weapon advantage)
    const minDamage = Math.ceil(rawDamage * MIN_DAMAGE_RATIO)

    // Calculate actual damage (using static shield value)
    const reducedDamage = rawDamage - this.shield
    const actualDamage = Math.max(reducedDamage, minDamage)

    // Deduct life
    this.currentLife = Math.max(0, this.currentLife - actualDamage)

    // Check for death
    if (this.currentLife <= 0) {
      this.isValid = false
    }

    return actualDamage
  }

  /** Whether the monster is dead */
  isDead(): boolean {
    return this.currentLife <= 0
  }

  /** Whether the monster has reached the exit */
  reachedExit(): boolean {
    // progress >= 1 means the exit has been reached (update method sets progress = 1 on arrival)
    return this.progress >= 1
  }

  /**
   * Get current grid coordinates
   * Calculated from pixel position, consistent with old implementation
   */
  getGridPosition(): Position {
    // Calculate grid coordinates from pixel position
    const gridX = Math.floor(this.pixelX / GRID_SIZE)
    const gridY = Math.floor(this.pixelY / GRID_SIZE)
    return [gridX, gridY]
  }

  /**
   * Get current pixel position
   * Directly returns the tracked pixel position, consistent with old implementation
   */
  getPixelPosition(): { x: number; y: number } {
    return { x: this.pixelX, y: this.pixelY }
  }

  /**
   * Get the next cell to move to in the path
   * Reference: td-obj-monster.js:184-203 getNextGrid()
   */
  private getNextGridInPath(): Position | null {
    if (this.path.length <= 1 || this.targetGridIndex >= this.path.length) {
      return null
    }
    return this.path[this.targetGridIndex]
  }

  /**
   * Calculate the total path length to the exit (in pixels)
   * Used for calculating progress
   */
  private calculateTotalPathLength(): number {
    if (this.path.length <= 1) return 0
    // Path length = (number of cells - 1) * GRID_SIZE
    return (this.path.length - 1) * GRID_SIZE
  }

  /**
   * Calculate the distance already traveled (in pixels)
   * Calculated from pixel position
   */
  private calculateTraveledDistance(): number {
    if (this.path.length === 0) return 0

    const [startX, startY] = this.path[0]
    const startPixelX = startX * GRID_SIZE + GRID_SIZE / 2
    const startPixelY = startY * GRID_SIZE + GRID_SIZE / 2

    // Simplified calculation: use Manhattan distance (monsters can only move horizontally or vertically)
    return Math.abs(this.pixelX - startPixelX) + Math.abs(this.pixelY - startPixelY)
  }

  /**
   * Per-frame update
   * Reference: td-obj-monster.js:238-278 step()
   *
   * Core mechanism: directly track pixel position
   * - Each frame moves a fixed pixel distance toward the target cell center
   * - Switches to the next target upon arrival
   * - Re-pathing only changes the target, not the current position, ensuring movement continuity
   */
  update(): void {
    if (!this.isValid) {
      return
    }

    // Force pathfinding when path is empty
    if (this.path.length === 0) {
      this.findPath()
    }

    // Check if the next cell is passable; force re-pathing if not
    // Reference: td-obj-monster.js:192-195
    const nextGrid = this.getNextGridInPath()
    if (nextGrid && !this.deps.isPassable(nextGrid)) {
      this.findPath()
    }

    // Path is blocked (cannot reach the exit)
    if (this.path.length === 0) {
      return
    }

    // Check if the end of the path has been reached
    if (this.path.length <= 1 || this.targetGridIndex >= this.path.length) {
      // Reached the exit
      const [exitX, exitY] = this.path[this.path.length - 1]
      this.pixelX = exitX * GRID_SIZE + GRID_SIZE / 2
      this.pixelY = exitY * GRID_SIZE + GRID_SIZE / 2
      this._progress = 1
      this.isValid = false
      return
    }

    // Get target cell center
    const [targetGridX, targetGridY] = this.path[this.targetGridIndex]
    const targetPixelX = targetGridX * GRID_SIZE + GRID_SIZE / 2
    const targetPixelY = targetGridY * GRID_SIZE + GRID_SIZE / 2

    // Calculate distance and direction to target
    const dx = targetPixelX - this.pixelX
    const dy = targetPixelY - this.pixelY

    // Calculate per-frame pixel movement distance
    // Old implementation (24 FPS): moves speed * GLOBAL_SPEED pixels per frame
    // New implementation (60 FPS): multiply by frame rate ratio (24/60) to maintain the same actual speed
    const speed = this.speed * GLOBAL_SPEED * (OLD_FPS / FPS)

    // Check if the target can be reached in this frame
    // Reference: td-obj-monster.js:264-274
    if (Math.abs(dx) < speed && Math.abs(dy) < speed) {
      // Reached the target cell center
      this.pixelX = targetPixelX
      this.pixelY = targetPixelY
      this.targetGridIndex++

      // Check if the end has been reached
      if (this.targetGridIndex >= this.path.length) {
        this._progress = 1
        this.isValid = false
        return
      }

      // 10% chance to re-path (only triggered when reaching a cell center)
      // Reference: td-obj-monster.js:184-188 getNextGrid() only calls when next_grid is null
      // In the old implementation, next_grid is set to null after reaching the target,
      // so the 10% check only triggers at cell transition points
      if (Math.random() < REPATH_PROBABILITY) {
        this.findPath()
      }
    } else {
      // Move toward the target
      // Reference: td-obj-monster.js:270-273
      if (dx !== 0) {
        const sx = dx < 0 ? -1 : 1
        this.pixelX += sx * speed
      }
      if (dy !== 0) {
        const sy = dy < 0 ? -1 : 1
        this.pixelY += sy * speed
      }
    }

    // Update global progress (for external queries)
    // Note: use _progress directly to avoid triggering the setter which would overwrite pixel position
    const totalLength = this.calculateTotalPathLength()
    if (totalLength > 0) {
      const traveled = this.calculateTraveledDistance()
      this._progress = Math.min(traveled / totalLength, 1)
    } else {
      this._progress = 1
    }
  }
}

/**
 * Create a Monster instance
 */
export function createMonster(params: MonsterCreateParams, deps: MonsterDependencies): IMonster & {
  /** Get current pixel position */
  getPixelPosition(): { x: number; y: number }
  /** Per-frame update */
  update(): void
} {
  return new Monster(params, deps)
}

/**
 * Extended Monster interface (includes runtime methods)
 */
export interface IMonsterRuntime extends IMonster {
  /** Get current pixel position */
  getPixelPosition(): { x: number; y: number }
  /** Per-frame update */
  update(): void
}
