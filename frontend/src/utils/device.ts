/**
 * Device detection utilities
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window
}
