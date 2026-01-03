/**
 * 设备检测工具函数
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window
}
