/**
 * 主题系统类型定义
 */

export type ThemeMode = 'light' | 'dark' | 'system'

export type ResolvedTheme = 'light' | 'dark'

export interface ThemeColors {
  // 背景色
  background: string
  backgroundSecondary: string
  backgroundTertiary: string

  // 文本色
  text: string
  textSecondary: string
  textMuted: string

  // 边框色
  border: string
  borderLight: string

  // 交互色
  primary: string
  primaryHover: string
  primaryActive: string

  // 状态色
  success: string
  warning: string
  danger: string
  info: string

  // 游戏特定色
  gridLine: string
  gridFill: string
  pathColor: string
  entrance: string
  exit: string
  hoverValid: string
  hoverInvalid: string
  selected: string
}

export interface GameColors {
  // 画布背景
  canvasBackground: number

  // 网格
  gridLine: number
  gridFill: number

  // 路径
  path: number
  entrance: number
  exit: number
  obstacle: number

  // 交互
  hoverValid: number
  hoverInvalid: number
  selected: number

  // 攻击范围虚线
  rangeDash: number

  // UI 文本
  uiText: string
}

export interface ThemeConfig {
  name: string
  colors: ThemeColors
  gameColors: GameColors
}

export interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
}

export const STORAGE_KEY = 'tower-defense-theme'
