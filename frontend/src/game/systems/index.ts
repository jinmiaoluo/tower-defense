/**
 * 游戏系统模块导出
 */

export { createPathSystem, type PathSystem } from './PathSystem'
export { createGridSystem, type GridSystem } from './GridSystem'
export { createBuildingSystem, type BuildingSystem, type BuildingForRangeCheck } from './BuildingSystem'
export { createDamageSystem, type DamageSystem } from './DamageSystem'
export {
  createBulletSystem,
  type BulletSystem,
  type Bullet,
  type BulletCreateParams,
  type Rect,
} from './BulletSystem'
export { createEconomySystem, type EconomySystem } from './EconomySystem'
export { createWaveRecorder, type WaveRecorder } from './WaveRecorder'
export {
  createScoreSystem,
  type ScoreSystem,
  type FinalScoreInput,
  type FinalScoreBreakdown,
} from './ScoreSystem'
export { createWaveManager, type WaveManager, type WaveState } from './WaveManager'
export {
  createGameSceneLogic,
  type GameSceneLogic,
  type GameState,
  type PlaceBuildingResult,
  type BuildingActionResult,
} from './GameSceneLogic'
