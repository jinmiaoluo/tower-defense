/**
 * API Mock implementation
 * Simulate backend API endpoints for frontend standalone development
 */

import type {
  Action,
  ErrorResponse,
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

/** Error response returned by mock functions, converted to thrown ApiError by the adapter. */
export interface MockErrorResponse {
  error: ErrorResponse
}

/** Simulated delay (milliseconds) */
const MOCK_DELAY = 100

/** Mock session storage */
interface MockSession {
  id: string
  state: ServerState
  currentWave: number
}

const sessions = new Map<string, MockSession>()

/** Generate session ID */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Simulate network delay */
function delay(ms: number = MOCK_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Building cumulative cost cache (simplified implementation) */
const buildingCosts = new Map<string, number>()

/**
 * Calculate spending and income from actions
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
 * POST /api/game/sessions - Create a game session
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
 * POST /api/game/sessions/wave - Submit wave result
 */
export async function mockSubmitWave(
  request: WaveRequest,
): Promise<WaveResponse | MockErrorResponse> {
  await delay()

  const session = sessions.get(request.sessionId)

  if (!session) {
    return {
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      },
    }
  }

  // Calculate money changes from building actions
  const { spent, income } = calculateMoneyFromActions(request.actions)

  // Update server state
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

  // Check if game is over
  if (newState.life <= 0) {
    return {
      valid: true,
      serverState: newState,
    }
  }

  // Generate next wave
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
 * POST /api/game/sessions/end - End game
 * Supports two modes:
 * 1. With lastWave: submit last wave data and end (normal ending)
 * 2. Without lastWave: end game immediately (early ending), using already submitted wave data
 */
export async function mockEndGame(
  request: GameEndRequest,
): Promise<GameEndResponse | MockErrorResponse> {
  await delay()

  const session = sessions.get(request.sessionId)

  if (!session) {
    return {
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      },
    }
  }

  // If lastWave is provided, update state with the last wave's data
  if (request.lastWave) {
    session.state.score += request.lastWave.result.scoreGained
  }
  // If no lastWave (early ending), use accumulated state from submitted waves

  // Simulate ranking
  const rank = Math.floor(Math.random() * 100) + 1

  // Clean up session
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
 * GET /api/game/leaderboard - Get leaderboard
 * @param limit Number of entries to return, default 10, max 100
 */
export async function mockGetLeaderboard(limit: number = 10): Promise<LeaderboardResponse> {
  await delay()

  const allEntries: LeaderboardEntry[] = [
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

  const entries = allEntries.slice(0, Math.min(limit, 100))

  return { entries }
}

/**
 * Calculate new difficulty coefficient
 * Formula source: docs/SPEC.md
 */
function calculateNewDifficulty(
  currentDifficulty: number,
  lifeLost: number,
  waveNumber: number,
): number {
  let newDifficulty: number

  if (lifeLost === 0) {
    // No damage taken, increase difficulty
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
