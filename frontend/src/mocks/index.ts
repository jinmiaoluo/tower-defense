/**
 * Mock module export entry point
 */

// Configuration data
export {
  MOCK_BUILDINGS,
  MOCK_GAME_CONFIG,
  MOCK_INITIAL,
  MOCK_MAP,
  MOCK_MONSTER_BASE_STATS,
  MOCK_MONSTERS,
} from './config'

// Wave generation
export {
  calculateLifeReward,
  generateWaveConfig,
  PREDEFINED_WAVES,
} from './waves'

// API mock
export {
  mockEndGame,
  mockGetLeaderboard,
  mockStartGame,
  mockSubmitWave,
  type MockErrorResponse,
} from './api'
