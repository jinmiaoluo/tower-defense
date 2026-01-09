/**
 * WakeLockManager - 防止移动设备屏幕自动锁定
 *
 * 使用 Screen Wake Lock API 防止设备屏幕变暗或锁定。
 * 当页面不可见时系统会自动释放锁，页面重新可见时会自动重新获取。
 */
export class WakeLockManager {
  private wakeLockSentinel: WakeLockSentinel | null = null
  private isManuallyReleased = false
  private boundVisibilityChangeHandler: (() => void) | null = null

  /**
   * 检查当前浏览器是否支持 Screen Wake Lock API
   */
  isSupported(): boolean {
    return 'wakeLock' in navigator
  }

  /**
   * 获取屏幕唤醒锁
   * @returns 是否成功获取锁
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
   * 释放屏幕唤醒锁
   */
  async release(): Promise<void> {
    this.isManuallyReleased = true
    this.removeVisibilityChangeListener()

    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release()
      } catch {
        // 忽略释放时的错误
      }
      this.wakeLockSentinel = null
    }
  }

  /**
   * 检查锁是否处于活动状态
   */
  isActive(): boolean {
    return this.wakeLockSentinel !== null && !this.wakeLockSentinel.released
  }

  /**
   * 设置页面可见性变化监听器
   * 当页面从隐藏变为可见时，重新获取锁
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
   * 移除页面可见性变化监听器
   */
  private removeVisibilityChangeListener(): void {
    if (this.boundVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityChangeHandler)
      this.boundVisibilityChangeHandler = null
    }
  }

  /**
   * 处理页面可见性变化
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
   * 重新获取锁（页面重新可见时调用）
   */
  private async reacquire(): Promise<void> {
    if (!this.isSupported() || this.isManuallyReleased) {
      return
    }

    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen')
    } catch {
      // 重新获取失败时静默处理
    }
  }
}
