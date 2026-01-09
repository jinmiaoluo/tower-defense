import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WakeLockManager } from './WakeLockManager'

describe('WakeLockManager', () => {
  let mockWakeLockSentinel: {
    released: boolean
    release: ReturnType<typeof vi.fn>
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  }
  let mockWakeLock: {
    request: ReturnType<typeof vi.fn>
  }
  let visibilityState: DocumentVisibilityState
  let visibilityChangeHandler: ((event: Event) => void) | null = null
  const mockAddEventListener = vi.fn()
  const mockRemoveEventListener = vi.fn()

  beforeEach(() => {
    // Mock WakeLockSentinel
    mockWakeLockSentinel = {
      released: false,
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    // Mock WakeLock
    mockWakeLock = {
      request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
    }

    // Mock navigator.wakeLock
    vi.stubGlobal('navigator', {
      wakeLock: mockWakeLock,
    })

    // Mock document.visibilityState and event listeners
    visibilityState = 'visible'
    visibilityChangeHandler = null
    mockAddEventListener.mockClear()
    mockRemoveEventListener.mockClear()

    mockAddEventListener.mockImplementation((event: string, handler: (event: Event) => void) => {
      if (event === 'visibilitychange') {
        visibilityChangeHandler = handler
      }
    })

    vi.stubGlobal('document', {
      get visibilityState() {
        return visibilityState
      },
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    visibilityChangeHandler = null
  })

  describe('isSupported', () => {
    it('should return true when Wake Lock API is available', () => {
      const manager = new WakeLockManager()
      expect(manager.isSupported()).toBe(true)
    })

    it('should return false when Wake Lock API is not available', () => {
      vi.stubGlobal('navigator', {})

      const manager = new WakeLockManager()
      expect(manager.isSupported()).toBe(false)
    })
  })

  describe('acquire', () => {
    it('should request a screen wake lock', async () => {
      const manager = new WakeLockManager()
      const result = await manager.acquire()

      expect(result).toBe(true)
      expect(mockWakeLock.request).toHaveBeenCalledWith('screen')
    })

    it('should return false when API is not supported', async () => {
      vi.stubGlobal('navigator', {})

      const manager = new WakeLockManager()
      const result = await manager.acquire()

      expect(result).toBe(false)
    })

    it('should return false when request fails', async () => {
      mockWakeLock.request.mockRejectedValue(new Error('Low battery'))

      const manager = new WakeLockManager()
      const result = await manager.acquire()

      expect(result).toBe(false)
    })

    it('should not request again if already acquired', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()
      await manager.acquire()

      expect(mockWakeLock.request).toHaveBeenCalledTimes(1)
    })

    it('should set up visibility change listener', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      )
    })

    it('should re-acquire after manual release (restart scenario)', async () => {
      const manager = new WakeLockManager()

      // First acquire
      await manager.acquire()
      expect(mockWakeLock.request).toHaveBeenCalledTimes(1)

      // Release
      await manager.release()
      expect(manager.isActive()).toBe(false)

      // Re-acquire (simulates game restart)
      const result = await manager.acquire()
      expect(result).toBe(true)
      expect(mockWakeLock.request).toHaveBeenCalledTimes(2)
    })
  })

  describe('release', () => {
    it('should release the wake lock', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()
      await manager.release()

      expect(mockWakeLockSentinel.release).toHaveBeenCalled()
    })

    it('should do nothing if not acquired', async () => {
      const manager = new WakeLockManager()
      await manager.release()

      expect(mockWakeLockSentinel.release).not.toHaveBeenCalled()
    })

    it('should remove visibility change listener', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()
      await manager.release()

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      )
    })

    it('should handle release error gracefully', async () => {
      mockWakeLockSentinel.release.mockRejectedValue(new Error('Release failed'))

      const manager = new WakeLockManager()
      await manager.acquire()

      // Should not throw
      await expect(manager.release()).resolves.toBeUndefined()
      expect(manager.isActive()).toBe(false)
    })
  })

  describe('visibility change handling', () => {
    it('should re-acquire lock when page becomes visible', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()

      // Simulate page becoming hidden then visible
      visibilityState = 'hidden'
      mockWakeLockSentinel.released = true

      visibilityState = 'visible'
      visibilityChangeHandler?.(new Event('visibilitychange'))

      // Wait for async re-acquire
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockWakeLock.request).toHaveBeenCalledTimes(2)
    })

    it('should not re-acquire if lock was manually released', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()
      await manager.release()

      visibilityState = 'visible'
      visibilityChangeHandler?.(new Event('visibilitychange'))

      await new Promise((resolve) => setTimeout(resolve, 0))

      // Should only have been called once (initial acquire)
      expect(mockWakeLock.request).toHaveBeenCalledTimes(1)
    })

    it('should not re-acquire when page becomes hidden', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()

      visibilityState = 'hidden'
      visibilityChangeHandler?.(new Event('visibilitychange'))

      await new Promise((resolve) => setTimeout(resolve, 0))

      // Should only have been called once (initial acquire)
      expect(mockWakeLock.request).toHaveBeenCalledTimes(1)
    })

    it('should handle re-acquire failure gracefully', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()

      // Make re-acquire fail
      mockWakeLock.request.mockRejectedValueOnce(new Error('Low battery'))

      visibilityState = 'visible'
      visibilityChangeHandler?.(new Event('visibilitychange'))

      // Should not throw
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Original acquire + failed re-acquire attempt
      expect(mockWakeLock.request).toHaveBeenCalledTimes(2)
    })
  })

  describe('isActive', () => {
    it('should return true when lock is active', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()

      expect(manager.isActive()).toBe(true)
    })

    it('should return false when lock is not acquired', () => {
      const manager = new WakeLockManager()
      expect(manager.isActive()).toBe(false)
    })

    it('should return false after release', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()
      await manager.release()

      expect(manager.isActive()).toBe(false)
    })

    it('should return false when system auto-released the lock', async () => {
      const manager = new WakeLockManager()
      await manager.acquire()

      // Simulate system auto-release (e.g., page hidden)
      mockWakeLockSentinel.released = true

      expect(manager.isActive()).toBe(false)
    })
  })
})
