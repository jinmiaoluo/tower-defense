/**
 * 设备像素比常量
 * 用于高 DPR 显示适配
 * 独立模块避免循环依赖
 */

// 获取设备像素比，限制最大为 2 以避免性能问题
// 在 Node 测试环境中默认使用 1
const getDevicePixelRatio = (): number => {
  if (typeof window !== 'undefined' && window.devicePixelRatio) {
    return window.devicePixelRatio
  }
  return 1
}
export const DPR = Math.min(getDevicePixelRatio(), 2)
