/**
 * Device pixel ratio constant
 * Used for high DPR display adaptation
 * Separate module to avoid circular dependencies
 */

// Get device pixel ratio, capped at 2 to avoid performance issues
// Defaults to 1 in Node test environment
const getDevicePixelRatio = (): number => {
  if (typeof window !== 'undefined' && window.devicePixelRatio) {
    return window.devicePixelRatio
  }
  return 1
}
export const DPR = Math.min(getDevicePixelRatio(), 2)
