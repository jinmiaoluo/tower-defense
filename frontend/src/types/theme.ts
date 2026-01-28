/**
 * Theme system type definitions
 */

export type Theme = 'light' | 'dark'

export interface ThemeColors {
  // Background colors
  background: string
  backgroundSecondary: string
  backgroundTertiary: string

  // Text colors
  text: string
  textSecondary: string
  textMuted: string

  // Border colors
  border: string
  borderLight: string

  // Interactive colors
  primary: string
  primaryHover: string
  primaryActive: string

  // Status colors
  success: string
  warning: string
  danger: string
  info: string

  // Game-specific colors
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
  // Canvas background
  canvasBackground: number

  // Grid
  gridLine: number
  gridFill: number

  // Path
  path: number
  entrance: number
  exit: number
  obstacle: number

  // Interaction
  hoverValid: number
  hoverInvalid: number
  selected: number

  // Attack range dashed line
  rangeDash: number

  // Selected building attack range (gold)
  rangeSelected: number

  // Grid cell highlight
  gridHighlight: number

  // UI text
  uiText: string
}

export interface ThemeConfig {
  name: string
  colors: ThemeColors
  gameColors: GameColors
}
