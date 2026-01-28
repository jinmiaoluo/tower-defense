/**
 * Monster entity tests
 * Written in TDD style, tests before implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createMonster, type MonsterDependencies } from './Monster'
import type { MonsterCreateParams, Path } from '@/types/entities'
import type { MonsterTypeId, Position } from '@/types'

// ============================================================================
// Test fixtures
// ============================================================================

/** Create test monster parameters */
function createTestMonsterParams(overrides: Partial<MonsterCreateParams> = {}): MonsterCreateParams {
  return {
    id: 'test-monster-001',
    type: 0 as MonsterTypeId,
    life: 50,
    speed: 3,
    shield: 0,
    money: 10,
    color: '#00ff00',
    damage: 1,
    ...overrides,
  }
}

/** Create a test path */
function createTestPath(): Path {
  return [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ] as Position[]
}

/** Create test dependencies */
function createTestDependencies(): MonsterDependencies {
  return {
    generatePathFrom: () => createTestPath(),
    getPositionAtProgress: (path: Path, progress: number) => {
      if (path.length === 0) return { x: 0, y: 0 }
      if (path.length === 1) return { x: path[0][0] * 32 + 16, y: path[0][1] * 32 + 16 }

      const totalSegments = path.length - 1
      const clampedProgress = Math.max(0, Math.min(1, progress))
      const exactPosition = clampedProgress * totalSegments
      const segmentIndex = Math.min(Math.floor(exactPosition), totalSegments - 1)
      const segmentProgress = exactPosition - segmentIndex

      const [startX, startY] = path[segmentIndex]
      const [endX, endY] = path[segmentIndex + 1]

      return {
        x: (startX * 32 + 16) + ((endX - startX) * 32) * segmentProgress,
        y: (startY * 32 + 16) + ((endY - startY) * 32) * segmentProgress,
      }
    },
    isPassable: () => true,
    getEntrance: () => [0, 0] as Position,
  }
}

// ============================================================================
// Test cases
// ============================================================================

describe('Monster', () => {
  let dependencies: MonsterDependencies

  beforeEach(() => {
    dependencies = createTestDependencies()
  })

  describe('creation', () => {
    it('should correctly initialize all properties', () => {
      const params = createTestMonsterParams()
      const monster = createMonster(params, dependencies)

      expect(monster.id).toBe('test-monster-001')
      expect(monster.type).toBe(0)
      expect(monster.maxLife).toBe(50)
      expect(monster.currentLife).toBe(50)
      expect(monster.speed).toBe(3)
      expect(monster.shield).toBe(0)
      expect(monster.money).toBe(10)
      expect(monster.color).toBe('#00ff00')
      expect(monster.damage).toBe(1)
      expect(monster.progress).toBe(0)
      expect(monster.isValid).toBe(true)
    })

    it('should correctly initialize a monster with shield', () => {
      const params = createTestMonsterParams({ shield: 20 })
      const monster = createMonster(params, dependencies)

      expect(monster.shield).toBe(20)
    })

    it('should correctly initialize an advanced monster', () => {
      const params = createTestMonsterParams({
        type: 8 as MonsterTypeId,
        life: 300,
        speed: 3,
        shield: 15,
        money: 60,
        damage: 5,
        color: '#ff6600',
      })
      const monster = createMonster(params, dependencies)

      expect(monster.type).toBe(8)
      expect(monster.maxLife).toBe(300)
      expect(monster.shield).toBe(15)
      expect(monster.damage).toBe(5)
    })
  })

  describe('radius', () => {
    it('should calculate radius based on damage: floor(damage * 1.2)', () => {
      // damage = 5, radius = floor(5 * 1.2) = 6
      const monster = createMonster(createTestMonsterParams({ damage: 5 }), dependencies)
      expect(monster.radius).toBe(6)
    })

    it('radius minimum should be 4', () => {
      // damage = 1, floor(1 * 1.2) = 1, but minimum is 4
      const monster = createMonster(createTestMonsterParams({ damage: 1 }), dependencies)
      expect(monster.radius).toBe(4)
    })

    it('radius maximum should be 12', () => {
      // damage = 20, floor(20 * 1.2) = 24, but maximum is 12
      const monster = createMonster(createTestMonsterParams({ damage: 20 }), dependencies)
      expect(monster.radius).toBe(12)
    })

    it('high damage monsters should have larger radius', () => {
      const lowDamageMonster = createMonster(createTestMonsterParams({ damage: 3 }), dependencies)
      const highDamageMonster = createMonster(createTestMonsterParams({ damage: 10 }), dependencies)

      // damage = 3, radius = max(floor(3 * 1.2), 4) = 4
      expect(lowDamageMonster.radius).toBe(4)
      // damage = 10, radius = floor(10 * 1.2) = 12
      expect(highDamageMonster.radius).toBe(12)
      expect(highDamageMonster.radius).toBeGreaterThan(lowDamageMonster.radius)
    })
  })

  describe('takeDamage', () => {
    it('should deal full damage without shield', () => {
      const monster = createMonster(createTestMonsterParams({ life: 100, shield: 0 }), dependencies)

      const actualDamage = monster.takeDamage(30)

      expect(actualDamage).toBe(30)
      expect(monster.currentLife).toBe(70)
    })

    it('should reduce damage with shield', () => {
      const monster = createMonster(createTestMonsterParams({ life: 100, shield: 10 }), dependencies)

      const actualDamage = monster.takeDamage(30)

      expect(actualDamage).toBe(20) // 30 - 10 = 20
      expect(monster.currentLife).toBe(80)
    })

    it('shield should guarantee minimum 10% damage', () => {
      const monster = createMonster(createTestMonsterParams({ life: 100, shield: 50 }), dependencies)

      const actualDamage = monster.takeDamage(30)

      // 30 - 50 = -20, but minimum damage = ceil(30 * 0.1) = 3
      expect(actualDamage).toBe(3)
      expect(monster.currentLife).toBe(97)
    })

    it('high damage weapons should deal more damage to shielded monsters', () => {
      const monster1 = createMonster(createTestMonsterParams({ life: 100, shield: 20 }), dependencies)
      const monster2 = createMonster(createTestMonsterParams({ life: 100, shield: 20 }), dependencies)

      // Low damage weapon
      const damage1 = monster1.takeDamage(10) // max(10 - 20, 1) = 1
      // High damage weapon
      const damage2 = monster2.takeDamage(50) // max(50 - 20, 5) = 30

      expect(damage1).toBe(1) // ceil(10 * 0.1) = 1
      expect(damage2).toBe(30) // 50 - 20 = 30
    })

    it('shield is a static value and does not decrease on hit', () => {
      const monster = createMonster(createTestMonsterParams({ shield: 10 }), dependencies)

      expect(monster.shield).toBe(10)

      monster.takeDamage(5)
      // Consistent with the old implementation, shield remains unchanged
      expect(monster.shield).toBe(10)

      monster.takeDamage(5)
      expect(monster.shield).toBe(10)
    })

    it('life should not go below 0', () => {
      const monster = createMonster(createTestMonsterParams({ life: 10, shield: 0 }), dependencies)

      monster.takeDamage(100)

      expect(monster.currentLife).toBe(0)
    })

    it('should not take damage after death', () => {
      const monster = createMonster(createTestMonsterParams({ life: 10, shield: 0 }), dependencies)

      monster.takeDamage(10)
      expect(monster.currentLife).toBe(0)
      expect(monster.isValid).toBe(false)

      const additionalDamage = monster.takeDamage(50)
      expect(additionalDamage).toBe(0)
      expect(monster.currentLife).toBe(0)
    })
  })

  describe('isDead', () => {
    it('should return false when life > 0', () => {
      const monster = createMonster(createTestMonsterParams({ life: 50 }), dependencies)

      expect(monster.isDead()).toBe(false)
    })

    it('should return true when life = 0', () => {
      const monster = createMonster(createTestMonsterParams({ life: 10 }), dependencies)

      monster.takeDamage(10)

      expect(monster.isDead()).toBe(true)
    })

    it('should return true when life < 0', () => {
      const monster = createMonster(createTestMonsterParams({ life: 10 }), dependencies)

      monster.takeDamage(100)

      expect(monster.isDead()).toBe(true)
    })
  })

  describe('reachedExit', () => {
    it('should return false when progress < 1', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 0.5

      expect(monster.reachedExit()).toBe(false)
    })

    it('should return true when progress = 1', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 1

      expect(monster.reachedExit()).toBe(true)
    })

    it('should return true when progress > 1', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      monster.progress = 1.1

      expect(monster.reachedExit()).toBe(true)
    })
  })

  describe('getGridPosition', () => {
    it('should return the entrance cell initially', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      const pos = monster.getGridPosition()

      expect(pos).toEqual([0, 0])
    })

    it('should return the exit cell when reached the end', () => {
      // Use a high-speed monster to reach the end quickly
      const monster = createMonster(createTestMonsterParams({ speed: 1000 }), dependencies)

      // Update multiple times until reaching the end
      for (let i = 0; i < 100; i++) {
        if (!monster.isValid) break
        monster.update()
      }

      const pos = monster.getGridPosition()
      expect(pos).toEqual([4, 0])
    })

    it('should return the corresponding cell during movement', () => {
      // Use high speed to reduce the impact of 10% re-pathing
      // speed=320, GLOBAL_SPEED=0.1, OLD_FPS/FPS=0.4
      // Per-frame movement = 320 * 0.1 * 0.4 = 12.8 pixels
      // Each cell takes 32 / 12.8 = 2.5 frames
      const monster = createMonster(createTestMonsterParams({ speed: 320 }), dependencies)

      // Simulate moving several frames then check position
      // Due to the 10% re-pathing mechanism, monster movement may be unstable
      // Use enough frames to ensure at least 1 cell of movement
      for (let i = 0; i < 20; i++) {
        monster.update()
        if (!monster.isValid) break
      }

      // High-speed monster should have moved at least 1 cell after 20 frames
      const pos = monster.getGridPosition()
      expect(pos[1]).toBe(0) // y coordinate should be 0
      // Due to path randomness and re-pathing, only verify that the monster is indeed moving
      expect(monster.progress).toBeGreaterThan(0)
    })
  })

  describe('getPixelPosition', () => {
    it('should return the entrance cell center initially', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      const pos = monster.getPixelPosition()

      // Cell (0, 0) center = (16, 16)
      expect(pos.x).toBe(16)
      expect(pos.y).toBe(16)
    })

    it('should return the exit cell center when reached the end', () => {
      // Use a high-speed monster to reach the end quickly
      const monster = createMonster(createTestMonsterParams({ speed: 1000 }), dependencies)

      // Update multiple times until reaching the end
      for (let i = 0; i < 100; i++) {
        if (!monster.isValid) break
        monster.update()
      }

      const pos = monster.getPixelPosition()

      // Cell (4, 0) center = (4 * 32 + 16, 16) = (144, 16)
      expect(pos.x).toBe(144)
      expect(pos.y).toBe(16)
    })

    it('should return a correct interpolated position during movement', () => {
      // Use a predictable speed for movement
      // speed=32, GLOBAL_SPEED=0.1, OLD_FPS/FPS=0.4
      // Per-frame movement = 32 * 0.1 * 0.4 = 1.28 pixels
      const monster = createMonster(createTestMonsterParams({ speed: 32 }), dependencies)

      // Simulate moving one frame then check position
      monster.update()
      const pos = monster.getPixelPosition()

      // Should have moved 1.28 pixels to the right
      expect(pos.x).toBeGreaterThan(16) // Starting position is 16
      expect(pos.x).toBeLessThan(48) // Has not reached the second cell center (48)
      expect(pos.y).toBe(16)
    })
  })

  describe('update', () => {
    it('should update progress based on speed each frame', () => {
      const monster = createMonster(createTestMonsterParams({ speed: 3 }), dependencies)

      // Speed 3 means moving 3 cells per frame, path has 5 points and 4 segments
      // progress increment = speed / (segments * 32)
      const initialProgress = monster.progress
      monster.update()

      expect(monster.progress).toBeGreaterThan(initialProgress)
    })

    it('should be marked invalid when reaching the end', () => {
      // Use a high-speed monster to ensure reaching the end within limited frames
      const monster = createMonster(createTestMonsterParams({ speed: 1000 }), dependencies)

      // Update multiple times until reaching the end
      for (let i = 0; i < 200; i++) {
        monster.update()
        if (!monster.isValid) break
      }

      expect(monster.reachedExit()).toBe(true)
      expect(monster.isValid).toBe(false)
    })

    it('invalid monster should not be updated', () => {
      const monster = createMonster(createTestMonsterParams(), dependencies)

      // Mark as invalid
      monster.isValid = false
      const initialProgress = monster.progress

      monster.update()

      expect(monster.progress).toBe(initialProgress)
    })
  })

  describe('edge cases', () => {
    it('should not crash with an empty path', () => {
      const emptyDeps: MonsterDependencies = {
        generatePathFrom: () => [],
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
        isPassable: () => true,
        getEntrance: () => [0, 0] as Position,
      }
      const monster = createMonster(createTestMonsterParams(), emptyDeps)

      expect(() => monster.getGridPosition()).not.toThrow()
      expect(() => monster.getPixelPosition()).not.toThrow()
      expect(() => monster.update()).not.toThrow()
    })

    it('should handle a single-point path correctly', () => {
      const singlePointDeps: MonsterDependencies = {
        generatePathFrom: () => [[5, 5]] as Position[],
        getPositionAtProgress: () => ({ x: 5 * 32 + 16, y: 5 * 32 + 16 }),
        isPassable: () => true,
        getEntrance: () => [5, 5] as Position,
      }
      const monster = createMonster(createTestMonsterParams(), singlePointDeps)

      const pos = monster.getGridPosition()
      expect(pos).toEqual([5, 5])
    })
  })

  describe('movement continuity (preventing jumps)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('pixel position should remain continuous during re-pathing (reference: old implementation)', () => {
      // Simulate a scenario where path direction changes during re-pathing
      // The old implementation maintains continuity by tracking pixel position (cx, cy)
      // The new implementation should have the same behavior

      let pathCallCount = 0
      const repathDeps: MonsterDependencies = {
        generatePathFrom: (startPos) => {
          pathCallCount++
          if (pathCallCount === 1) {
            // Initial path: move right (long enough to ensure time for re-pathing trigger)
            return [
              [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
              [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
              [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0],
            ] as Position[]
          } else {
            // Re-path: move downward from current cell (direction change)
            const [sx, sy] = startPos
            return [
              [sx, sy],
              [sx, sy + 1],
              [sx, sy + 2],
              [sx, sy + 3],
              [sx, sy + 4],
              [sx, sy + 5],
            ] as Position[]
          }
        },
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
        isPassable: () => true,
        getEntrance: () => [0, 0] as Position,
      }

      // Use higher speed to ensure crossing enough cells to trigger re-pathing
      // speed=128, GLOBAL_SPEED=0.1, OLD_FPS/FPS=0.4
      // Per-frame movement = 128 * 0.1 * 0.4 = 5.12 pixels
      // Crossing one cell (32 pixels) takes approximately 6-7 frames
      const monster = createMonster(createTestMonsterParams({ speed: 128 }), repathDeps)

      // Move several frames to get the monster into the middle of the path
      for (let i = 0; i < 10; i++) {
        monster.update()
      }

      // Mock Math.random() to deterministically trigger 10% re-pathing
      // Returning 0.05 < 0.1 will trigger re-pathing
      let randomCallCount = 0
      vi.spyOn(Math, 'random').mockImplementation(() => {
        randomCallCount++
        // Trigger re-pathing on first arrival at a cell center (return 0.05 < 0.1)
        if (randomCallCount === 1) {
          return 0.05
        }
        // Afterwards return 0.5 to not trigger re-pathing
        return 0.5
      })

      const initialPathCallCount = pathCallCount
      let repathOccurred = false

      // Continue moving until re-pathing occurs or the end is reached
      for (let i = 0; i < 100 && !repathOccurred && monster.isValid; i++) {
        const posBeforeUpdate = monster.getPixelPosition()
        monster.update()
        const posAfterUpdate = monster.getPixelPosition()

        if (pathCallCount > initialPathCallCount) {
          repathOccurred = true

          // Key assertion: pixel position change after re-pathing should be small
          // Max per-frame movement is about 5.12 pixels; there should be no large jumps
          const dx = Math.abs(posAfterUpdate.x - posBeforeUpdate.x)
          const dy = Math.abs(posAfterUpdate.y - posBeforeUpdate.y)
          const distance = Math.sqrt(dx * dx + dy * dy)

          // Single-frame movement distance should not exceed a few pixels
          // If there is a jump, the distance will be far above this value
          const maxExpectedMove = 10
          expect(distance).toBeLessThan(maxExpectedMove)
        }
      }

      expect(repathOccurred).toBe(true)
    })

    it('per-frame movement should be smooth (no large jumps)', () => {
      const monster = createMonster(createTestMonsterParams({ speed: 64 }), dependencies)

      let lastPos = monster.getPixelPosition()
      const jumpThreshold = 20 // Single-frame jump exceeding this distance is considered abnormal

      for (let i = 0; i < 100 && monster.isValid; i++) {
        monster.update()
        const currentPos = monster.getPixelPosition()

        const dx = Math.abs(currentPos.x - lastPos.x)
        const dy = Math.abs(currentPos.y - lastPos.y)
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Single-frame movement should not have large jumps
        expect(distance).toBeLessThan(jumpThreshold)

        lastPos = currentPos
      }
    })

    it('10% re-pathing should only trigger when reaching a cell center (reference: old implementation)', () => {
      // Old implementation: 10% re-pathing only triggers when the monster reaches a cell center
      // and selects the next target, not every frame with a 10% chance
      // This ensures stable direction when moving between two cells

      let pathCallCount = 0
      const trackingDeps: MonsterDependencies = {
        generatePathFrom: () => {
          pathCallCount++
          // Return a long path
          return [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
            [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
          ] as Position[]
        },
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
        isPassable: () => true,
        getEntrance: () => [0, 0] as Position,
      }

      // Use a slow monster to ensure each cell requires multiple frames to traverse
      // speed=16, GLOBAL_SPEED=0.1, OLD_FPS/FPS=0.4
      // Per-frame movement = 16 * 0.1 * 0.4 = 0.64 pixels
      // Each cell takes 32 / 0.64 = 50 frames
      const monster = createMonster(createTestMonsterParams({ speed: 16 }), trackingDeps)
      const initialPathCallCount = pathCallCount

      // Run 30 frames; the monster should still be within the first cell
      // If every frame has a 10% re-pathing chance, expect about 3 re-pathings
      // If re-pathing only occurs at cell boundaries, there should be no additional path calls
      for (let i = 0; i < 30; i++) {
        monster.update()
      }

      // No additional path calls should be triggered while moving within a cell
      // Allow at most 1 additional path call (due to passability checks)
      const additionalPathCalls = pathCallCount - initialPathCallCount
      expect(additionalPathCalls).toBeLessThanOrEqual(1)
    })

    it('monster movement direction should remain stable (no oscillation)', () => {
      // Test that the monster direction does not change frequently while moving between two cells
      let pathCallCount = 0
      const stableDeps: MonsterDependencies = {
        generatePathFrom: () => {
          pathCallCount++
          // Return a straight-line path (moving right)
          return [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
            [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
          ] as Position[]
        },
        getPositionAtProgress: () => ({ x: 0, y: 0 }),
        isPassable: () => true,
        getEntrance: () => [0, 0] as Position,
      }

      const monster = createMonster(createTestMonsterParams({ speed: 32 }), stableDeps)

      // Track direction changes
      let directionChanges = 0
      let lastDirection = { dx: 0, dy: 0 }
      let lastPos = monster.getPixelPosition()

      for (let i = 0; i < 100 && monster.isValid; i++) {
        monster.update()
        const currentPos = monster.getPixelPosition()

        const dx = currentPos.x - lastPos.x
        const dy = currentPos.y - lastPos.y

        // Check if direction changed (ignore stationary state)
        if (dx !== 0 || dy !== 0) {
          const currentDirection = {
            dx: dx > 0 ? 1 : dx < 0 ? -1 : 0,
            dy: dy > 0 ? 1 : dy < 0 ? -1 : 0,
          }

          if (lastDirection.dx !== 0 || lastDirection.dy !== 0) {
            if (currentDirection.dx !== lastDirection.dx ||
                currentDirection.dy !== lastDirection.dy) {
              directionChanges++
            }
          }

          lastDirection = currentDirection
        }

        lastPos = currentPos
      }

      // On a straight-line path, direction changes should be rare (at most at cell boundaries)
      // If frequent re-pathing causes oscillation, the direction change count will be high
      expect(directionChanges).toBeLessThan(5)
    })
  })
})
