/**
 * BulletSystem - Bullet system
 * Handles bullet creation, flight, and collision detection
 * Reference: html5-tower-defense/src/js/td-obj-building.js
 */

import type { IBuilding, IMonster } from '@/types/entities'
import type { IWaveRecorder } from '@/types/recorder'
import type { Position } from '@/types'
import { GAME_CONSTANTS } from '@/types'

const { GRID_SIZE, GLOBAL_SPEED, FPS } = GAME_CONSTANTS

/** Old implementation frame rate (for speed conversion) */
const OLD_FPS = 24

/**
 * Bullet speed factor
 * Old implementation: speed = 20 * this.speed * TD.global_speed
 * where global_speed = 0.1, so actual formula: 20 * bullet_speed * 0.1 = 2 * bullet_speed
 */
const BULLET_SPEED_FACTOR = 20

/** Rectangle area */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Bullet entity */
export interface Bullet {
  /** Owning building */
  readonly building: IBuilding
  /** Damage value */
  readonly damage: number
  /** Flight speed (pixels/frame) */
  readonly speed: number
  /** Current X position */
  x: number
  /** Current Y position */
  y: number
  /** X velocity component */
  readonly vx: number
  /** Y velocity component */
  readonly vy: number
  /** Original target ID (for server-side validation) */
  readonly originalTargetId: string
  /** Original target position (for server-side range validation) */
  readonly originalTargetPosition: Position
  /** Bullet radius (for collision detection and rendering) */
  readonly radius: number
  /** Whether the bullet is valid */
  isValid: boolean
}

/** Bullet creation parameters */
export interface BulletCreateParams {
  building: IBuilding
  target: IMonster
  damage: number
  speed: number
  startX: number
  startY: number
  /** Target X position (optional, defaults to computed from target) */
  targetX?: number
  /** Target Y position (optional, defaults to computed from target) */
  targetY?: number
}

/** BulletSystem interface */
export interface BulletSystem {
  /** Create a bullet */
  createBullet(params: BulletCreateParams): Bullet

  /**
   * Per-frame update
   * @param monsters Currently alive monsters
   * @param mapBounds Map boundaries
   * @param recorder Wave recorder
   * @param currentFrame Current frame number
   */
  update(
    monsters: IMonster[],
    mapBounds: Rect,
    recorder: IWaveRecorder,
    currentFrame: number,
  ): void

  /** Get all current bullets (for rendering) */
  getBullets(): readonly Bullet[]

  /** Clear all bullets */
  clear(): void
}

/**
 * Get pixel position of a monster
 * Monster may have x/y properties (runtime), or may need to compute from getGridPosition
 */
function getMonsterPixelPosition(monster: IMonster): { x: number; y: number } {
  const monsterAny = monster as unknown as { x?: number; y?: number }
  if (typeof monsterAny.x === 'number' && typeof monsterAny.y === 'number') {
    return { x: monsterAny.x, y: monsterAny.y }
  }
  const gridPos = monster.getGridPosition()
  return {
    x: gridPos[0] * GRID_SIZE + GRID_SIZE / 2,
    y: gridPos[1] * GRID_SIZE + GRID_SIZE / 2,
  }
}

/**
 * Calculate bullet radius (based on damage value)
 * Reference old implementation: r = max(log(damage), 2), clamped to 1-6
 */
function calculateBulletRadius(damage: number): number {
  const r = Math.max(Math.log(damage), 2)
  return Math.min(Math.max(r, 1), 6)
}

/**
 * Detect collision between bullet and monster
 * Uses lenient circular collision detection
 */
function checkCollision(bullet: Bullet, monster: IMonster): boolean {
  if (!monster.isValid) return false

  const monsterPos = getMonsterPixelPosition(monster)
  const dx = monsterPos.x - bullet.x
  const dy = monsterPos.y - bullet.y
  const distanceSquared = dx * dx + dy * dy

  // Lenient collision detection: (r1 + r2)^2 * 2
  const collisionRadiusSquared =
    Math.pow(bullet.radius + monster.radius, 2) * 2

  return distanceSquared <= collisionRadiusSquared
}

/**
 * Detect whether a bullet has flown out of map bounds
 */
function isOutOfBounds(bullet: Bullet, bounds: Rect): boolean {
  return (
    bullet.x < bounds.x ||
    bullet.x > bounds.x + bounds.width ||
    bullet.y < bounds.y ||
    bullet.y > bounds.y + bounds.height
  )
}

/**
 * Create a BulletSystem instance
 */
export function createBulletSystem(): BulletSystem {
  const bullets: Bullet[] = []

  return {
    createBullet(params: BulletCreateParams): Bullet {
      const { building, target, damage, speed, startX, startY } = params

      // Get target position
      const targetPos = getMonsterPixelPosition(target)
      const targetX = params.targetX ?? targetPos.x
      const targetY = params.targetY ?? targetPos.y

      // Calculate direction vector
      const dx = targetX - startX
      const dy = targetY - startY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Calculate actual pixel speed
      // Old implementation (24 FPS): speed = 20 * this.speed * TD.global_speed (global_speed = 0.1)
      // New implementation (60 FPS): multiply by frame rate ratio (24/60) to maintain same per-second movement
      const actualSpeed = speed * BULLET_SPEED_FACTOR * GLOBAL_SPEED * (OLD_FPS / FPS)

      // Calculate velocity components (if distance is 0, default to rightward)
      let vx: number, vy: number
      if (distance > 0) {
        vx = (dx * actualSpeed) / distance
        vy = (dy * actualSpeed) / distance
      } else {
        vx = actualSpeed
        vy = 0
      }

      // Record original target info
      const originalTargetPosition = target.getGridPosition()

      const bullet: Bullet = {
        building,
        damage,
        speed,
        x: startX,
        y: startY,
        vx,
        vy,
        originalTargetId: target.id,
        originalTargetPosition,
        radius: calculateBulletRadius(damage),
        isValid: true,
      }

      bullets.push(bullet)
      return bullet
    },

    update(
      monsters: IMonster[],
      mapBounds: Rect,
      recorder: IWaveRecorder,
      currentFrame: number,
    ): void {
      // Iterate backwards for safe removal
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i]

        if (!bullet.isValid) {
          bullets.splice(i, 1)
          continue
        }

        // 1. Check if out of bounds
        if (isOutOfBounds(bullet, mapBounds)) {
          bullet.isValid = false
          bullets.splice(i, 1)
          continue
        }

        // 2. Check collision
        let hitMonster: IMonster | null = null
        for (const monster of monsters) {
          if (checkCollision(bullet, monster)) {
            hitMonster = monster
            break
          }
        }

        if (hitMonster) {
          // Hit monster
          const actualDamage = hitMonster.takeDamage(bullet.damage)

          // Update building stats
          bullet.building.damageDealt += actualDamage
          if (hitMonster.isDead()) {
            bullet.building.kills += 1
          }

          // Record attack event
          recorder.recordAttack({
            buildingId: bullet.building.id,
            originalTargetId: bullet.originalTargetId,
            originalTargetPosition: bullet.originalTargetPosition,
            monsterId: hitMonster.id,
            monsterPosition: hitMonster.getGridPosition(),
            damage: actualDamage,
            frame: currentFrame,
          })

          // Remove bullet
          bullet.isValid = false
          bullets.splice(i, 1)
          continue
        }

        // 3. Move bullet
        bullet.x += bullet.vx
        bullet.y += bullet.vy
      }
    },

    getBullets(): readonly Bullet[] {
      return [...bullets]
    },

    clear(): void {
      bullets.length = 0
    },
  }
}
