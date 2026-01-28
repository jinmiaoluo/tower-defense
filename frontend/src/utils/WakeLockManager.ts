/**
 * WakeLockManager - prevents mobile device screens from auto-locking.
 *
 * Uses the Screen Wake Lock API to prevent the device screen from dimming or locking.
 * The system automatically releases the lock when the page becomes hidden,
 * and reacquires it when the page becomes visible again.
 */
export class WakeLockManager {
  private wakeLockSentinel: WakeLockSentinel | null = null
  private isManuallyReleased = false
  private boundVisibilityChangeHandler: (() => void) | null = null

  /**
   * Check whether the current browser supports the Screen Wake Lock API.
   */
  isSupported(): boolean {
    return 'wakeLock' in navigator
  }

  /**
   * Acquire the screen wake lock.
   * @returns Whether the lock was successfully acquired
   */
  async acquire(): Promise<boolean> {
    if (!this.isSupported()) {
      return false
    }

    if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
      return true
    }

    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen')
      this.isManuallyReleased = false

      this.setupVisibilityChangeListener()

      return true
    } catch {
      return false
    }
  }

  /**
   * Release the screen wake lock.
   */
  async release(): Promise<void> {
    this.isManuallyReleased = true
    this.removeVisibilityChangeListener()

    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release()
      } catch {
        // Ignore errors during release
      }
      this.wakeLockSentinel = null
    }
  }

  /**
   * Check whether the lock is currently active.
   */
  isActive(): boolean {
    return this.wakeLockSentinel !== null && !this.wakeLockSentinel.released
  }

  /**
   * Set up the page visibility change listener.
   * Reacquires the lock when the page transitions from hidden to visible.
   */
  private setupVisibilityChangeListener(): void {
    if (this.boundVisibilityChangeHandler) {
      return
    }

    this.boundVisibilityChangeHandler = () => {
      this.handleVisibilityChange()
    }

    document.addEventListener('visibilitychange', this.boundVisibilityChangeHandler)
  }

  /**
   * Remove the page visibility change listener.
   */
  private removeVisibilityChangeListener(): void {
    if (this.boundVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityChangeHandler)
      this.boundVisibilityChangeHandler = null
    }
  }

  /**
   * Handle page visibility changes.
   */
  private handleVisibilityChange(): void {
    if (this.isManuallyReleased) {
      return
    }

    if (document.visibilityState === 'visible') {
      this.reacquire()
    }
  }

  /**
   * Reacquire the lock (called when the page becomes visible again).
   */
  private async reacquire(): Promise<void> {
    if (!this.isSupported() || this.isManuallyReleased) {
      return
    }

    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen')
    } catch {
      // Silently handle reacquisition failures
    }
  }
}
