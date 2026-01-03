/**
 * 简单的事件发射器，用于 Vue 层与游戏层的通信
 * 不依赖 Phaser，可在测试环境中使用
 */

type EventCallback = (...args: unknown[]) => void

class SimpleEventEmitter {
  private events: Map<string, Set<EventCallback>> = new Map()

  on(event: string, callback: EventCallback): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }
    this.events.get(event)!.add(callback)
    return this
  }

  off(event: string, callback?: EventCallback): this {
    if (callback) {
      this.events.get(event)?.delete(callback)
    } else {
      this.events.delete(event)
    }
    return this
  }

  emit(event: string, ...args: unknown[]): this {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => callback(...args))
    }
    return this
  }

  removeAllListeners(): this {
    this.events.clear()
    return this
  }
}

export const AppEventBus = new SimpleEventEmitter()
