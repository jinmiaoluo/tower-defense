/**
 * API 层测试
 * 采用 TDD 方式，先定义期望行为
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  createGameApi,
  type GameApi,
} from './game'
import type {
  GameStartResponse,
  WaveRequest,
  WaveResponse,
  GameEndRequest,
  GameEndResponse,
  LeaderboardResponse,
} from '@/types'

// Mock 网络请求
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('GameApi', () => {
  let api: GameApi

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Mock 模式', () => {
    beforeEach(() => {
      api = createGameApi({ useMock: true })
    })

    it('createSession 应返回会话信息和配置', async () => {
      const response = await api.createSession()

      expect(response.sessionId).toBeDefined()
      expect(response.sessionId).toMatch(/^session-/)
      expect(response.config).toBeDefined()
      expect(response.config.buildings).toBeDefined()
      expect(response.config.monsters).toBeDefined()
      expect(response.config.map).toBeDefined()
      expect(response.config.initial).toBeDefined()
      expect(response.firstWave).toBeDefined()
      expect(response.firstWave.waveNumber).toBe(1)
      expect(response.firstWave.monsters.length).toBeGreaterThan(0)
    })

    it('createSession 返回的怪物应有服务端生成的 UUID', async () => {
      const response = await api.createSession()

      for (const monster of response.firstWave.monsters) {
        expect(monster.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        expect(typeof monster.type).toBe('number')
        expect(typeof monster.life).toBe('number')
        expect(typeof monster.speed).toBe('number')
        expect(typeof monster.shield).toBe('number')
        expect(typeof monster.money).toBe('number')
      }
    })

    it('submitWave 应验证并返回服务端状态', async () => {
      // 先创建会话
      const startResponse = await api.createSession()

      const waveRequest: WaveRequest = {
        sessionId: startResponse.sessionId,
        waveNumber: 1,
        actions: [],
        attacks: [],
        result: {
          killed: 3,
          killedByType: { 0: 3 },
          passed: 0,
          scoreGained: 15,
          moneyGained: 15,
          lifeLost: 0,
          totalDamageDealt: 150,
          totalLifeDestroyed: 150,
          waveDurationFrames: 1000,
        },
        buildings: [],
      }

      const response = await api.submitWave(waveRequest)

      expect(response.valid).toBe(true)
      expect(response.serverState).toBeDefined()
      expect(response.serverState.money).toBeGreaterThan(0)
      expect(response.serverState.score).toBe(15)
      expect(response.serverState.life).toBe(100)
      expect(response.nextWave).toBeDefined()
      expect(response.nextWave?.waveNumber).toBe(2)
    })

    it('submitWave 对不存在的会话应返回错误', async () => {
      const waveRequest: WaveRequest = {
        sessionId: 'non-existent-session',
        waveNumber: 1,
        actions: [],
        attacks: [],
        result: {
          killed: 0,
          killedByType: {},
          passed: 0,
          scoreGained: 0,
          moneyGained: 0,
          lifeLost: 0,
          totalDamageDealt: 0,
          totalLifeDestroyed: 0,
          waveDurationFrames: 0,
        },
        buildings: [],
      }

      const response = await api.submitWave(waveRequest)

      expect(response.valid).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe('SESSION_NOT_FOUND')
    })

    it('submitWave 应计算生命奖励（每 5 波）', async () => {
      const startResponse = await api.createSession()

      // 模拟完成 5 波
      for (let wave = 1; wave <= 5; wave++) {
        const waveRequest: WaveRequest = {
          sessionId: startResponse.sessionId,
          waveNumber: wave,
          actions: [],
          attacks: [],
          result: {
            killed: 3,
            killedByType: { 0: 3 },
            passed: 0,
            scoreGained: 15,
            moneyGained: 15,
            lifeLost: 0,
            totalDamageDealt: 150,
            totalLifeDestroyed: 150,
            waveDurationFrames: 1000,
          },
          buildings: [],
        }

        const response = await api.submitWave(waveRequest)

        if (wave === 5) {
          expect(response.nextWave?.lifeReward).toBe(5)
        }
      }
    })

    it('endGame 应返回排名信息', async () => {
      const startResponse = await api.createSession()

      const endRequest: GameEndRequest = {
        sessionId: startResponse.sessionId,
        nickname: 'TestPlayer',
        lastWave: {
          waveNumber: 1,
          actions: [],
          attacks: [],
          result: {
            killed: 3,
            killedByType: { 0: 3 },
            passed: 0,
            scoreGained: 15,
            moneyGained: 15,
            lifeLost: 100,
            totalDamageDealt: 150,
            totalLifeDestroyed: 150,
            waveDurationFrames: 1000,
          },
          buildings: [],
        },
      }

      const response = await api.endGame(endRequest)

      expect(response.verified).toBe(true)
      expect(response.ranking).toBeDefined()
      expect(response.ranking?.rank).toBeGreaterThan(0)
      expect(response.ranking?.total).toBeGreaterThan(0)
      expect(typeof response.ranking?.isNewRecord).toBe('boolean')
    })

    it('getLeaderboard 应返回排行榜列表', async () => {
      const response = await api.getLeaderboard()

      expect(response.entries).toBeDefined()
      expect(Array.isArray(response.entries)).toBe(true)
      expect(response.entries.length).toBeGreaterThan(0)

      // 验证排行榜条目结构
      const firstEntry = response.entries[0]
      expect(firstEntry.rank).toBe(1)
      expect(typeof firstEntry.nickname).toBe('string')
      expect(typeof firstEntry.score).toBe('number')
      expect(typeof firstEntry.wavesCompleted).toBe('number')
      expect(typeof firstEntry.createdAt).toBe('string')

      // 验证排名顺序
      for (let i = 0; i < response.entries.length - 1; i++) {
        expect(response.entries[i].score).toBeGreaterThanOrEqual(response.entries[i + 1].score)
      }
    })

    it('getLeaderboard 应支持 limit 参数', async () => {
      const response = await api.getLeaderboard(5)

      expect(response.entries.length).toBeLessThanOrEqual(5)
    })
  })

  describe('真实 API 模式', () => {
    beforeEach(() => {
      api = createGameApi({ useMock: false, baseUrl: '/api/game' })
    })

    it('createSession 应调用正确的 API 端点', async () => {
      const mockResponse: GameStartResponse = {
        sessionId: 'test-session-id',
        config: {
          buildings: {},
          monsters: {},
          map: { width: 16, height: 16, entrance: [0, 0], exit: [15, 15], obstacles: [] },
          initial: { money: 500, life: 100, difficulty: 1 },
        },
        firstWave: {
          waveNumber: 1,
          monsters: [],
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const response = await api.createSession()

      expect(mockFetch).toHaveBeenCalledWith('/api/game/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
      })
      expect(response.sessionId).toBe('test-session-id')
    })

    it('submitWave 应调用正确的 API 端点', async () => {
      const mockResponse: WaveResponse = {
        valid: true,
        serverState: { money: 500, score: 100, life: 100, difficulty: 1 },
        nextWave: { waveNumber: 2, monsters: [] },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const waveRequest: WaveRequest = {
        sessionId: 'test-session',
        waveNumber: 1,
        actions: [],
        attacks: [],
        result: {
          killed: 0,
          killedByType: {},
          passed: 0,
          scoreGained: 0,
          moneyGained: 0,
          lifeLost: 0,
          totalDamageDealt: 0,
          totalLifeDestroyed: 0,
          waveDurationFrames: 0,
        },
        buildings: [],
      }

      await api.submitWave(waveRequest)

      expect(mockFetch).toHaveBeenCalledWith('/api/game/sessions/wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waveRequest),
      })
    })

    it('endGame 应调用正确的 API 端点', async () => {
      const mockResponse: GameEndResponse = {
        verified: true,
        ranking: { rank: 1, total: 100, isNewRecord: true },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const endRequest: GameEndRequest = {
        sessionId: 'test-session',
        nickname: 'TestPlayer',
        lastWave: {
          waveNumber: 1,
          actions: [],
          attacks: [],
          result: {
            killed: 0,
            killedByType: {},
            passed: 0,
            scoreGained: 0,
            moneyGained: 0,
            lifeLost: 100,
            totalDamageDealt: 0,
            totalLifeDestroyed: 0,
            waveDurationFrames: 0,
          },
          buildings: [],
        },
      }

      await api.endGame(endRequest)

      expect(mockFetch).toHaveBeenCalledWith('/api/game/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endRequest),
      })
    })

    it('getLeaderboard 应调用正确的 API 端点', async () => {
      const mockResponse: LeaderboardResponse = {
        entries: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await api.getLeaderboard(10)

      expect(mockFetch).toHaveBeenCalledWith('/api/game/leaderboard?limit=10', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
      })
    })

    it('API 错误应正确处理', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          error: { code: 'SESSION_NOT_FOUND', message: '会话不存在' },
        }),
      })

      await expect(api.createSession()).rejects.toThrow()
    })
  })
})
