/**
 * Game API layer
 * Supports switching between mock mode and real API mode
 */

import type {
  GameStartResponse,
  WaveRequest,
  WaveResponse,
  GameEndRequest,
  GameEndResponse,
  LeaderboardResponse,
} from '@/types'
import {
  mockStartGame,
  mockSubmitWave,
  mockEndGame,
  mockGetLeaderboard,
} from '@/mocks'

/** API configuration options */
export interface GameApiOptions {
  /** Whether to use mock mode */
  useMock?: boolean
  /** API base URL (used in real mode) */
  baseUrl?: string
}

/** Game API interface */
export interface GameApi {
  /** Create a game session */
  createSession(): Promise<GameStartResponse>
  /** Submit wave result */
  submitWave(request: WaveRequest): Promise<WaveResponse>
  /** End the game */
  endGame(request: GameEndRequest): Promise<GameEndResponse>
  /** Get leaderboard */
  getLeaderboard(limit?: number): Promise<LeaderboardResponse>
}

/**
 * Create a Game API instance
 * @param options API configuration options
 */
export function createGameApi(options: GameApiOptions = {}): GameApi {
  const { useMock = true, baseUrl = '/api/game' } = options

  if (useMock) {
    return createMockApi()
  }

  return createRealApi(baseUrl)
}

/**
 * Create mock API implementation
 */
function createMockApi(): GameApi {
  return {
    createSession: mockStartGame,
    submitWave: mockSubmitWave,
    endGame: mockEndGame,
    getLeaderboard: (limit?: number) => mockGetLeaderboard(limit),
  }
}

/**
 * Create real API implementation
 */
function createRealApi(baseUrl: string): GameApi {
  async function request<T>(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        response.status,
        errorData.error?.code || 'UNKNOWN_ERROR',
        errorData.error?.message || `HTTP ${response.status}`,
      )
    }

    return response.json()
  }

  return {
    createSession(): Promise<GameStartResponse> {
      return request('/sessions', 'POST')
    },

    submitWave(waveRequest: WaveRequest): Promise<WaveResponse> {
      return request('/sessions/wave', 'POST', waveRequest)
    },

    endGame(endRequest: GameEndRequest): Promise<GameEndResponse> {
      return request('/sessions/end', 'POST', endRequest)
    },

    getLeaderboard(limit: number = 10): Promise<LeaderboardResponse> {
      return request(`/leaderboard?limit=${limit}`, 'GET')
    },
  }
}

/**
 * API error class
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Create default API instance
 * Automatically selects mode based on environment variables
 */
export function createDefaultApi(): GameApi {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/game'

  return createGameApi({ useMock, baseUrl })
}

/** Default API instance (singleton) */
export const gameApi = createDefaultApi()
