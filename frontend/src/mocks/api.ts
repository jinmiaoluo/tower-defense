/**
 * API Mock 实现
 * 模拟后端 API 接口，用于前端独立开发
 */

import type {
  Action,
  GameEndRequest,
  GameEndResponse,
  GameStartResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  ServerState,
  WaveRequest,
  WaveResponse,
} from '@/types'
import { MOCK_BUILDINGS, MOCK_GAME_CONFIG, MOCK_INITIAL } from './config'
import { calculateLifeReward, generateWaveConfig } from './waves'

/** 模拟延迟（毫秒） */
const MOCK_DELAY = 100

/** 模拟会话存储 */
interface MockSession {
  id: string
  state: ServerState
  currentWave: number
}

const sessions = new Map<string, MockSession>()

/** 生成 Session ID */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** 模拟网络延迟 */
function delay(ms: number = MOCK_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 建筑累计花费缓存（简化实现） */
const buildingCosts = new Map<string, number>()

/**
 * 计算 actions 中的花费和收入
 * spent = BUILD + UPGRADE
 * income = SELL
 */
function calculateMoneyFromActions(actions: Action[]): { spent: number; income: number } {
  let spent = 0
  let income = 0

  for (const action of actions) {
    if (action.type === 'BUILD' && action.buildingType) {
      const cost = MOCK_BUILDINGS[action.buildingType].cost
      spent += cost
      buildingCosts.set(action.buildingId, cost)
    } else if (action.type === 'UPGRADE') {
      const currentCost = buildingCosts.get(action.buildingId) || 0
      const upgradeCost = Math.floor(currentCost * 0.75)
      spent += upgradeCost
      buildingCosts.set(action.buildingId, currentCost + upgradeCost)
    } else if (action.type === 'SELL') {
      const totalCost = buildingCosts.get(action.buildingId) || 0
      income += Math.floor(totalCost * 0.5)
      buildingCosts.delete(action.buildingId)
    }
  }

  return { spent, income }
}

/**
 * POST /api/game/sessions - 创建游戏会话
 */
export async function mockStartGame(): Promise<GameStartResponse> {
  await delay()

  const sessionId = generateSessionId()
  const firstWave = generateWaveConfig(1, MOCK_INITIAL.difficulty)

  sessions.set(sessionId, {
    id: sessionId,
    state: {
      money: MOCK_INITIAL.money,
      score: 0,
      life: MOCK_INITIAL.life,
      difficulty: MOCK_INITIAL.difficulty,
    },
    currentWave: 1,
  })

  return {
    sessionId,
    config: MOCK_GAME_CONFIG,
    firstWave,
  }
}

/**
 * POST /api/game/sessions/wave - 提交波次结果
 */
export async function mockSubmitWave(request: WaveRequest): Promise<WaveResponse> {
  await delay()

  const session = sessions.get(request.sessionId)

  if (!session) {
    return {
      valid: false,
      serverState: {
        money: 0,
        score: 0,
        life: 0,
        difficulty: 1,
      },
      error: {
        code: 'SESSION_NOT_FOUND',
        message: '会话不存在',
      },
    }
  }

  // 计算建筑操作的金钱变化
  const { spent, income } = calculateMoneyFromActions(request.actions)

  // 更新服务端状态
  // new_money = old_money - spent + income + moneyGained
  const newState: ServerState = {
    money: session.state.money - spent + income + request.result.moneyGained,
    score: session.state.score + request.result.scoreGained,
    life: Math.max(0, session.state.life - request.result.lifeLost),
    difficulty: calculateNewDifficulty(
      session.state.difficulty,
      request.result.lifeLost,
      request.waveNumber,
    ),
  }

  session.state = newState
  session.currentWave = request.waveNumber + 1

  // 检查游戏是否结束
  if (newState.life <= 0) {
    return {
      valid: true,
      serverState: newState,
    }
  }

  // 生成下一波
  const nextWave = generateWaveConfig(session.currentWave, newState.difficulty)
  const lifeReward = calculateLifeReward(request.waveNumber)

  if (lifeReward) {
    newState.life = Math.min(newState.life + lifeReward, 100)
  }

  return {
    valid: true,
    serverState: newState,
    nextWave: {
      ...nextWave,
      lifeReward,
    },
  }
}

/**
 * POST /api/game/sessions/end - 游戏结束
 */
export async function mockEndGame(request: GameEndRequest): Promise<GameEndResponse> {
  await delay()

  const session = sessions.get(request.sessionId)

  if (!session) {
    return {
      verified: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: '会话不存在',
      },
    }
  }

  // 更新最后一波的状态
  session.state.score += request.lastWave.result.scoreGained

  // 模拟排名
  const rank = Math.floor(Math.random() * 100) + 1

  // 清理会话
  sessions.delete(request.sessionId)

  return {
    verified: true,
    ranking: {
      rank,
      total: 1000,
      isNewRecord: rank <= 10,
    },
  }
}

/**
 * GET /api/game/leaderboard - 获取排行榜
 */
export async function mockGetLeaderboard(): Promise<LeaderboardResponse> {
  await delay()

  const entries: LeaderboardEntry[] = [
    { rank: 1, nickname: 'ProPlayer', score: 99999, wavesCompleted: 100, createdAt: '2025-01-01T00:00:00Z' },
    { rank: 2, nickname: 'GameMaster', score: 88888, wavesCompleted: 90, createdAt: '2025-01-02T00:00:00Z' },
    { rank: 3, nickname: 'TowerKing', score: 77777, wavesCompleted: 80, createdAt: '2025-01-03T00:00:00Z' },
    { rank: 4, nickname: 'DefenseHero', score: 66666, wavesCompleted: 70, createdAt: '2025-01-04T00:00:00Z' },
    { rank: 5, nickname: 'Strategist', score: 55555, wavesCompleted: 60, createdAt: '2025-01-05T00:00:00Z' },
    { rank: 6, nickname: 'Builder', score: 44444, wavesCompleted: 50, createdAt: '2025-01-06T00:00:00Z' },
    { rank: 7, nickname: 'Defender', score: 33333, wavesCompleted: 40, createdAt: '2025-01-07T00:00:00Z' },
    { rank: 8, nickname: 'Guardian', score: 22222, wavesCompleted: 30, createdAt: '2025-01-08T00:00:00Z' },
    { rank: 9, nickname: 'Warrior', score: 11111, wavesCompleted: 20, createdAt: '2025-01-09T00:00:00Z' },
    { rank: 10, nickname: 'Rookie', score: 5000, wavesCompleted: 10, createdAt: '2025-01-10T00:00:00Z' },
  ]

  return { entries }
}

/**
 * 计算新的难度系数
 * 公式来源：docs/SPEC.md
 */
function calculateNewDifficulty(
  currentDifficulty: number,
  lifeLost: number,
  waveNumber: number,
): number {
  let newDifficulty: number

  if (lifeLost === 0) {
    // 未受伤，增加难度
    if (waveNumber < 5) {
      newDifficulty = currentDifficulty * 1.05
    } else if (currentDifficulty > 30) {
      newDifficulty = currentDifficulty * 1.1
    } else {
      newDifficulty = currentDifficulty * 1.2
    }
  } else if (lifeLost >= 50) {
    newDifficulty = currentDifficulty * 0.6
  } else if (lifeLost >= 30) {
    newDifficulty = currentDifficulty * 0.7
  } else if (lifeLost >= 20) {
    newDifficulty = currentDifficulty * 0.8
  } else if (lifeLost >= 10) {
    newDifficulty = currentDifficulty * 0.9
  } else if (waveNumber >= 10) {
    newDifficulty = currentDifficulty * 1.05
  } else {
    newDifficulty = currentDifficulty
  }

  return Math.max(newDifficulty, 1)
}
