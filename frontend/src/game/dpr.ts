/**
 * 设备像素比常量
 * 用于高 DPR 显示适配
 * 独立模块避免循环依赖
 */

// 获取设备像素比，限制最大为 2 以避免性能问题
export const DPR = Math.min(window.devicePixelRatio || 1, 2)
