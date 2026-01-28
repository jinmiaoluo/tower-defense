/**
 * Unified type definition exports
 */

// Basic configuration types
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

// API types
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

// Game state types
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

// Wave recorder types
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

// Game entity types
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

// Theme types
export type {
  Theme,
  ThemeColors,
  GameColors,
  ThemeConfig,
} from './theme'
