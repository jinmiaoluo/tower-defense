/**
 * Building - Building entity
 * Handles building state management, target searching, and attack behavior
 * Reference: html5-tower-defense/src/js/td-obj-building.js
 */

import type { IBuilding, IMonster, BuildingCreateParams } from '@/types/entities'
import type { IWaveRecorder } from '@/types/recorder'
import type { BuildingType, Position } from '@/types'

/**
 * Building dependencies interface
 * Uses dependency injection to access BuildingSystem functionality for testability and decoupling
 */
export interface BuildingDependencies {
  /** Get damage value at the specified level */
  getDamageAtLevel: (type: BuildingType, level: number) => number
  /** Get range at the specified level */
  getRangeAtLevel: (type: BuildingType, level: number) => number
  /** Get attack interval in frames */
  getAttackSpeedFrames: (type: BuildingType) => number
  /** Check whether the target is within range */
  isInRange: (building: { type: BuildingType; level: number; position: Position }, targetPos: Position) => boolean
  /** Check whether the type is a weapon (can attack) */
  isWeapon: (type: BuildingType) => boolean
  /** Get bullet speed */
  getBulletSpeed: (type: BuildingType) => number
}

/**
 * Bullet creation parameters
 */
export interface BulletCreateInfo {
  /** Owning building */
  building: IBuilding
  /** Damage value */
  damage: number
  /** Bullet speed */
  speed: number
  /** Original target ID */
  originalTargetId: string
  /** Original target position */
  originalTargetPosition: Position
}

/**
 * Building implementation class
 */
class Building implements IBuilding {
  readonly id: string
  readonly type: BuildingType
  level: number
  readonly position: Position
  cooldown: number
  damageDealt: number
  kills: number

  private readonly deps: BuildingDependencies
  private currentTarget: IMonster | null = null
  private lastTargetPosition: Position | null = null

  constructor(params: BuildingCreateParams, deps: BuildingDependencies) {
    this.id = params.id
    this.type = params.type
    this.level = params.level ?? 1
    this.position = params.position
    this.cooldown = 0
    this.damageDealt = 0
    this.kills = 0
    this.deps = deps
  }

  /** Whether the building can attack (cooldown finished and is a weapon type) */
  canAttack(): boolean {
    if (!this.deps.isWeapon(this.type)) {
      return false
    }
    return this.cooldown <= 0
  }

  /**
   * Find a target among the monster list
   * Strategy: prioritize the monster with the highest path progress (closer to exit = greater threat)
   * Reference: td-obj-building.js:187-204
   */
  findTarget(monsters: IMonster[]): IMonster | null {
    if (!this.deps.isWeapon(this.type)) {
      this.currentTarget = null
      return null
    }

    // If the current target is still valid and in range, keep it
    if (this.currentTarget && this.currentTarget.isValid) {
      const targetPos = this.currentTarget.getGridPosition()
      if (this.deps.isInRange(
        { type: this.type, level: this.level, position: this.position },
        targetPos,
      )) {
        return this.currentTarget
      }
    }

    // Filter valid monsters within range
    const validTargets = monsters.filter((monster) => {
      if (!monster.isValid) {
        return false
      }

      const targetPos = monster.getGridPosition()
      return this.deps.isInRange(
        { type: this.type, level: this.level, position: this.position },
        targetPos,
      )
    })

    if (validTargets.length === 0) {
      this.currentTarget = null
      return null
    }

    // Select the monster with the highest path progress
    this.currentTarget = validTargets.reduce((best, current) => {
      return current.progress > best.progress ? current : best
    })

    return this.currentTarget
  }

  /**
   * Attack the target
   * - Laser gun: hits immediately, deals damage directly
   * - Other weapons: sets cooldown, bullets created externally by BulletSystem
   */
  attack(target: IMonster, recorder: IWaveRecorder, frame: number): void {
    // Set attack cooldown
    this.cooldown = this.deps.getAttackSpeedFrames(this.type)

    const damage = this.getDamage()
    const targetPos = target.getGridPosition()

    // Laser gun special handling: instant hit
    if (this.type === 'laser_gun') {
      const actualDamage = target.takeDamage(damage)

      // Update stats
      this.damageDealt += actualDamage

      // Check for kill
      if (target.isDead()) {
        this.kills += 1
      }

      // Record attack event
      recorder.recordAttack({
        frame,
        buildingId: this.id,
        originalTargetId: target.id,
        originalTargetPosition: targetPos,
        monsterId: target.id,
        monsterPosition: targetPos,
        damage: actualDamage,
      })
    }
    // Other weapon types are not handled here; bullets are created externally via getBulletParams
  }

  /** Get damage value at the current level */
  getDamage(): number {
    return this.deps.getDamageAtLevel(this.type, this.level)
  }

  /** Get range at the current level */
  getRange(): number {
    return this.deps.getRangeAtLevel(this.type, this.level)
  }

  /** Get attack speed (frame interval) */
  getAttackSpeed(): number {
    return this.deps.getAttackSpeedFrames(this.type)
  }

  /** Reset wave statistics */
  resetWaveStats(): void {
    this.damageDealt = 0
    this.kills = 0
  }

  /** Get the current target's grid position (used for rendering turret direction) */
  getCurrentTargetPosition(): Position | null {
    if (this.currentTarget && this.currentTarget.isValid) {
      this.lastTargetPosition = this.currentTarget.getGridPosition()
      return this.lastTargetPosition
    }
    // When there is no target, return the last target position to maintain turret direction
    return this.lastTargetPosition
  }

  /** Whether there is an active target */
  hasActiveTarget(): boolean {
    return this.currentTarget !== null && this.currentTarget.isValid
  }

  /** Update cooldown each frame */
  updateCooldown(): void {
    if (this.cooldown > 0) {
      this.cooldown -= 1
    }
  }

  /**
   * Get bullet creation parameters
   * Returns null for laser gun (does not use bullets)
   */
  getBulletParams(target: IMonster): BulletCreateInfo | null {
    // Laser gun does not use bullets
    if (this.type === 'laser_gun') {
      return null
    }

    const targetPos = target.getGridPosition()

    return {
      building: this,
      damage: this.getDamage(),
      speed: this.deps.getBulletSpeed(this.type),
      originalTargetId: target.id,
      originalTargetPosition: targetPos,
    }
  }

  /** Upgrade building */
  upgrade(): void {
    this.level += 1
  }
}

/**
 * Create a Building instance
 */
export function createBuilding(
  params: BuildingCreateParams,
  deps: BuildingDependencies,
): IBuilding & IBuildingRuntime {
  return new Building(params, deps)
}

/**
 * Extended Building interface (includes runtime methods)
 */
export interface IBuildingRuntime {
  /** Update cooldown each frame */
  updateCooldown(): void
  /** Get bullet creation parameters */
  getBulletParams(target: IMonster): BulletCreateInfo | null
  /** Upgrade building */
  upgrade(): void
}
