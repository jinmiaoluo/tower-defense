/**
 * Game API layer
 * Supports switching between mock mode and real API mode
 */

import type {
  ErrorCode,
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
  type MockErrorResponse,
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

/** Check if response is a MockErrorResponse */
function isMockErrorResponse(response: unknown): response is MockErrorResponse {
  if (response === null || typeof response !== 'object') {
    return false
  }
  const obj = response as Record<string, unknown>
  if (!obj.error || typeof obj.error !== 'object' || obj.error === null) {
    return false
  }
  const err = obj.error as Record<string, unknown>
  return typeof err.code === 'string' && typeof err.message === 'string'
}

/**
 * Create mock API implementation
 *
 * Mock functions may return a MockErrorResponse (with an `error` field).
 * This adapter converts those into thrown ApiError instances, matching real API behavior
 * where HTTP 4xx responses become exceptions.
 */
function createMockApi(): GameApi {
  function assertNotError<T>(response: T | MockErrorResponse): asserts response is T {
    if (isMockErrorResponse(response)) {
      const status = response.error.code === 'SESSION_NOT_FOUND' ? 404 : 400
      throw new ApiError(status, response.error.code, response.error.message)
    }
  }

  return {
    createSession: mockStartGame,
    async submitWave(request): Promise<WaveResponse> {
      const response = await mockSubmitWave(request)
      assertNotError(response)
      return response
    },
    async endGame(request): Promise<GameEndResponse> {
      const response = await mockEndGame(request)
      assertNotError(response)
      return response
    },
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
        errorData.code,
        errorData.message || `HTTP ${response.status}`,
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
    public readonly code: ErrorCode | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Check if this is a session not found error */
  isSessionNotFound(): boolean {
    return this.code === 'SESSION_NOT_FOUND' || this.status === 404
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
