/**
 * Mock 模块导出入口
 */

// 配置数据
export {
  MOCK_BUILDINGS,
  MOCK_GAME_CONFIG,
  MOCK_INITIAL,
  MOCK_MAP,
  MOCK_MONSTER_BASE_STATS,
  MOCK_MONSTERS,
} from './config'

// 波次生成
export {
  calculateLifeReward,
  generateWaveConfig,
  PREDEFINED_WAVES,
} from './waves'

// API Mock
export {
  mockEndGame,
  mockGetLeaderboard,
  mockStartGame,
  mockSubmitWave,
} from './api'
