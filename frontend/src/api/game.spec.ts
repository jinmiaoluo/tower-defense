/**
 * API layer tests
 * Uses TDD approach, defining expected behavior first
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
  BuildingType,
  BuildingConfig,
  MonsterTypeId,
  MonsterDisplayConfig,
} from '@/types'

// Mock network requests
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

  describe('Mock mode', () => {
    beforeEach(() => {
      api = createGameApi({ useMock: true })
    })

    it('createSession should return session info and config', async () => {
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

    it('createSession monsters should have server-generated UUIDs', async () => {
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

    it('submitWave should validate and return server state', async () => {
      // Create session first
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

    it('submitWave should throw for non-existent session', async () => {
      const { ApiError } = await import('./game')

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

      try {
        await api.submitWave(waveRequest)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as InstanceType<typeof ApiError>).status).toBe(404)
      }
    })

    it('submitWave should calculate life reward (every 5 waves)', async () => {
      const startResponse = await api.createSession()

      // Simulate completing 5 waves
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

    it('endGame should return ranking info', async () => {
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

    it('getLeaderboard should return leaderboard list', async () => {
      const response = await api.getLeaderboard()

      expect(response.entries).toBeDefined()
      expect(Array.isArray(response.entries)).toBe(true)
      expect(response.entries.length).toBeGreaterThan(0)

      // Verify leaderboard entry structure
      const firstEntry = response.entries[0]
      expect(firstEntry.rank).toBe(1)
      expect(typeof firstEntry.nickname).toBe('string')
      expect(typeof firstEntry.score).toBe('number')
      expect(typeof firstEntry.wavesCompleted).toBe('number')
      expect(typeof firstEntry.createdAt).toBe('string')

      // Verify ranking order
      for (let i = 0; i < response.entries.length - 1; i++) {
        expect(response.entries[i].score).toBeGreaterThanOrEqual(response.entries[i + 1].score)
      }
    })

    it('getLeaderboard should support limit parameter', async () => {
      const response = await api.getLeaderboard(5)

      expect(response.entries.length).toBeLessThanOrEqual(5)
    })

    it('endGame should support early end (without lastWave, ending between waves)', async () => {
      const startResponse = await api.createSession()

      // Submit wave 1 first
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
      await api.submitWave(waveRequest)

      // Early end: without lastWave (ending between waves, current wave already submitted via /wave)
      const endRequest = {
        sessionId: startResponse.sessionId,
        nickname: 'EarlyEndPlayer',
      }

      const response = await api.endGame(endRequest)

      expect(response.verified).toBe(true)
      expect(response.ranking).toBeDefined()
      expect(response.ranking?.rank).toBeGreaterThan(0)
    })

    it('endGame should support mid-wave end (with lastWave and remaining)', async () => {
      const startResponse = await api.createSession()

      // Mid-wave end: with lastWave, including remaining (monsters still on the field)
      const endRequest: GameEndRequest = {
        sessionId: startResponse.sessionId,
        nickname: 'MidWaveEndPlayer',
        lastWave: {
          waveNumber: 1,
          actions: [],
          attacks: [],
          result: {
            killed: 1,
            killedByType: { 0: 1 },
            passed: 0,
            remaining: 2,
            remainingMonsterIds: [
              startResponse.firstWave.monsters[1]?.id || 'mock-id-1',
              startResponse.firstWave.monsters[2]?.id || 'mock-id-2',
            ],
            scoreGained: 5,
            moneyGained: 5,
            lifeLost: 0,
            totalDamageDealt: 50,
            totalLifeDestroyed: 50,
            waveDurationFrames: 500,
          },
          buildings: [],
        },
      }

      const response = await api.endGame(endRequest)

      expect(response.verified).toBe(true)
      expect(response.ranking).toBeDefined()
      expect(response.ranking?.rank).toBeGreaterThan(0)
    })
  })

  describe('Real API mode', () => {
    beforeEach(() => {
      api = createGameApi({ useMock: false, baseUrl: '/api/game' })
    })

    it('createSession should call the correct API endpoint', async () => {
      const mockResponse: GameStartResponse = {
        sessionId: 'test-session-id',
        config: {
          buildings: {} as Record<BuildingType, BuildingConfig>,
          monsters: {} as Record<MonsterTypeId, MonsterDisplayConfig>,
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

    it('submitWave should call the correct API endpoint', async () => {
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

    it('endGame should call the correct API endpoint', async () => {
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

    it('getLeaderboard should call the correct API endpoint', async () => {
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

    it('API errors should be handled correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          message: 'Session not found',
        }),
      })

      await expect(api.createSession()).rejects.toThrow()
    })

    it('SESSION_NOT_FOUND error should contain the correct status code', async () => {
      const { ApiError } = await import('./game')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          message: 'Session not found',
        }),
      })

      try {
        await api.createSession()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as InstanceType<typeof ApiError>).status).toBe(404)
        expect((error as InstanceType<typeof ApiError>).message).toBe('Session not found')
      }
    })

    it('VALIDATION_FAILED error should have fallback message when server returns empty', async () => {
      const { ApiError } = await import('./game')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          code: 'VALIDATION_FAILED',
          message: '',
        }),
      })

      try {
        await api.submitWave({
          sessionId: 'test-session',
          waveNumber: 1,
          actions: [],
          attacks: [],
          result: {
            killed: 0,
            killedByType: {},
            passed: 0,
            scoreGained: 0,
            moneyGained: 9999,
            lifeLost: 0,
            totalDamageDealt: 0,
            totalLifeDestroyed: 0,
            waveDurationFrames: 0,
          },
          buildings: [],
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as InstanceType<typeof ApiError>).code).toBe('VALIDATION_FAILED')
        // API client uses fallback message when server returns empty
        expect((error as InstanceType<typeof ApiError>).message).toBe('HTTP 400')
        expect((error as InstanceType<typeof ApiError>).status).toBe(400)
      }
    })

    it('INVALID_REQUEST error should contain nickname validation error message', async () => {
      const { ApiError } = await import('./game')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          message: 'Nickname contains invalid characters',
        }),
      })

      try {
        await api.endGame({
          sessionId: 'test-session',
          nickname: '<script>alert(1)</script>',
        })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as InstanceType<typeof ApiError>).message).toBe('Nickname contains invalid characters')
        expect((error as InstanceType<typeof ApiError>).status).toBe(400)
      }
    })
  })
})
