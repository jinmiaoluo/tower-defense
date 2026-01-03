/**
 * Game API 层
 * 支持 Mock 模式和真实 API 模式的切换
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

/** API 配置选项 */
export interface GameApiOptions {
  /** 是否使用 Mock 模式 */
  useMock?: boolean
  /** API 基础 URL（真实模式下使用） */
  baseUrl?: string
}

/** Game API 接口 */
export interface GameApi {
  /** 创建游戏会话 */
  createSession(): Promise<GameStartResponse>
  /** 提交波次结果 */
  submitWave(request: WaveRequest): Promise<WaveResponse>
  /** 结束游戏 */
  endGame(request: GameEndRequest): Promise<GameEndResponse>
  /** 获取排行榜 */
  getLeaderboard(limit?: number): Promise<LeaderboardResponse>
}

/**
 * 创建 Game API 实例
 * @param options API 配置选项
 */
export function createGameApi(options: GameApiOptions = {}): GameApi {
  const { useMock = true, baseUrl = '/api/game' } = options

  if (useMock) {
    return createMockApi()
  }

  return createRealApi(baseUrl)
}

/**
 * 创建 Mock API 实现
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
 * 创建真实 API 实现
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
 * API 错误类
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
 * 创建默认 API 实例
 * 根据环境变量自动选择模式
 */
export function createDefaultApi(): GameApi {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/game'

  return createGameApi({ useMock, baseUrl })
}

/** 默认 API 实例（单例） */
export const gameApi = createDefaultApi()
