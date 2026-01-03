/**
 * 类型定义统一导出
 */

// 基础配置类型
export type {
  Position,
  BuildingType,
  MonsterTypeId,
  BuildingConfig,
  MonsterDisplayConfig,
  MapConfig,
  InitialConfig,
  GameConfig,
  UpgradeMultiplier,
} from './config'

export {
  GAME_CONSTANTS,
  BUILDING_TYPES,
  MONSTER_TYPES,
  MONSTER_TYPE_COUNT,
  UPGRADE_MULTIPLIERS,
  isBuildingType,
  isWeaponBuilding,
  isMonsterType,
  getUpgradeMultiplier,
  parseMonsterConfigs,
  parseGameConfig,
} from './config'

// API 类型
export type {
  GameStartResponse,
  WaveConfig,
  MonsterConfig,
  WaveRequest,
  ActionType,
  Action,
  AttackEvent,
  WaveResult,
  BuildingSnapshot,
  WaveResponse,
  ServerState,
  GameEndRequest,
  GameEndResponse,
  RankingInfo,
  LeaderboardResponse,
  LeaderboardEntry,
  ApiError,
  ApiErrorCode,
} from './api'

// 游戏状态类型
export type {
  GamePhase,
  GameStoreState,
  BuildingRuntimeState,
  UIStoreState,
  StateSyncData,
  GameInitData,
  BuildingOperationResult,
  WaveSubmitResult,
  GameEndResult,
} from './state'

// 波次记录类型
export type {
  WaveRecordState,
  MutableWaveResult,
  BuildActionData,
  UpgradeActionData,
  SellActionData,
  AttackRecordData,
  KillRecordData,
  PassedRecordData,
  IWaveRecorder,
} from './recorder'

export {
  mapToRecord,
  createEmptyMutableResult,
  toImmutableResult,
} from './recorder'

// 游戏实体类型
export type {
  IMonster,
  MonsterCreateParams,
  IBuilding,
  BuildingCreateParams,
  IBullet,
  BulletCreateParams,
  PathPoint,
  Path,
  IPathFinder,
  GridCell,
  MapState,
  IGameScene,
} from './entities'

export {
  calculateDistance,
  manhattanDistance,
  isSamePosition,
} from './entities'

// 主题类型
export type {
  ThemeMode,
  ResolvedTheme,
  ThemeColors,
  GameColors,
  ThemeConfig,
  ThemeState,
} from './theme'

export { STORAGE_KEY as THEME_STORAGE_KEY } from './theme'
