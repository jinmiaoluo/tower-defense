/**
 * 主题颜色配置
 */

import type { ThemeConfig, ResolvedTheme, GameColors } from '@/types/theme'
import { STORAGE_KEY } from '@/types/theme'

export const darkTheme: ThemeConfig = {
  name: 'dark',
  colors: {
    // 背景色
    background: '#1a1a2e',
    backgroundSecondary: '#2a2a3e',
    backgroundTertiary: '#3a3a4e',

    // 文本色
    text: 'rgba(255, 255, 255, 0.87)',
    textSecondary: 'rgba(255, 255, 255, 0.6)',
    textMuted: 'rgba(255, 255, 255, 0.38)',

    // 边框色
    border: '#4a4a6e',
    borderLight: '#5a5a7e',

    // 交互色
    primary: '#4488ff',
    primaryHover: '#5599ff',
    primaryActive: '#3377ee',

    // 状态色
    success: '#00ff00',
    warning: '#ffcc00',
    danger: '#ff4444',
    info: '#00ffff',

    // 游戏特定色
    gridLine: '#444444',
    gridFill: '#2a2a3e',
    pathColor: '#3a3a5e',
    entrance: '#00ff00',
    exit: '#ff0000',
    hoverValid: '#00ff00',
    hoverInvalid: '#ff0000',
    selected: '#00ffff',
  },
  gameColors: {
    canvasBackground: 0x1a1a2e,
    gridLine: 0x444444,
    gridFill: 0x2a2a3e,
    path: 0x3a3a5e,
    entrance: 0x00ff00,
    exit: 0xff0000,
    obstacle: 0x666666,
    hoverValid: 0x00ff00,
    hoverInvalid: 0xff0000,
    selected: 0x00ffff,
    rangeDash: 0xffffff,
    rangeSelected: 0xbb8d20,
    gridHighlight: 0xbb8d20,
    uiText: '#ffffff',
  },
}

export const lightTheme: ThemeConfig = {
  name: 'light',
  colors: {
    // 背景色
    background: '#f5f5f5',
    backgroundSecondary: '#ffffff',
    backgroundTertiary: '#e8e8e8',

    // 文本色
    text: 'rgba(0, 0, 0, 0.87)',
    textSecondary: 'rgba(0, 0, 0, 0.6)',
    textMuted: 'rgba(0, 0, 0, 0.38)',

    // 边框色
    border: '#d0d0d0',
    borderLight: '#e0e0e0',

    // 交互色
    primary: '#2266cc',
    primaryHover: '#3377dd',
    primaryActive: '#1155bb',

    // 状态色
    success: '#00aa00',
    warning: '#cc9900',
    danger: '#cc3333',
    info: '#0099aa',

    // 游戏特定色
    gridLine: '#cccccc',
    gridFill: '#e8e8e8',
    pathColor: '#d8d8d8',
    entrance: '#00aa00',
    exit: '#cc0000',
    hoverValid: '#00aa00',
    hoverInvalid: '#cc0000',
    selected: '#0088aa',
  },
  gameColors: {
    canvasBackground: 0xf5f5f5,
    gridLine: 0xcccccc,
    gridFill: 0xe8e8e8,
    path: 0xd8d8d8,
    entrance: 0x00aa00,
    exit: 0xcc0000,
    obstacle: 0x999999,
    hoverValid: 0x00aa00,
    hoverInvalid: 0xcc0000,
    selected: 0x0088aa,
    rangeDash: 0x000000,
    rangeSelected: 0xbb8d20,
    gridHighlight: 0xbb8d20,
    uiText: '#333333',
  },
}

export const themes: Record<ResolvedTheme, ThemeConfig> = {
  dark: darkTheme,
  light: lightTheme,
}

export function getTheme(theme: ResolvedTheme): ThemeConfig {
  return themes[theme]
}

export function applyThemeToCSSVariables(theme: ThemeConfig): void {
  const root = document.documentElement
  const { colors } = theme

  root.style.setProperty('--color-background', colors.background)
  root.style.setProperty('--color-background-secondary', colors.backgroundSecondary)
  root.style.setProperty('--color-background-tertiary', colors.backgroundTertiary)

  root.style.setProperty('--color-text', colors.text)
  root.style.setProperty('--color-text-secondary', colors.textSecondary)
  root.style.setProperty('--color-text-muted', colors.textMuted)

  root.style.setProperty('--color-border', colors.border)
  root.style.setProperty('--color-border-light', colors.borderLight)

  root.style.setProperty('--color-primary', colors.primary)
  root.style.setProperty('--color-primary-hover', colors.primaryHover)
  root.style.setProperty('--color-primary-active', colors.primaryActive)

  root.style.setProperty('--color-success', colors.success)
  root.style.setProperty('--color-warning', colors.warning)
  root.style.setProperty('--color-danger', colors.danger)
  root.style.setProperty('--color-info', colors.info)

  root.style.setProperty('--color-grid-line', colors.gridLine)
  root.style.setProperty('--color-grid-fill', colors.gridFill)
  root.style.setProperty('--color-path', colors.pathColor)
  root.style.setProperty('--color-entrance', colors.entrance)
  root.style.setProperty('--color-exit', colors.exit)
  root.style.setProperty('--color-hover-valid', colors.hoverValid)
  root.style.setProperty('--color-hover-invalid', colors.hoverInvalid)
  root.style.setProperty('--color-selected', colors.selected)

  root.setAttribute('data-theme', theme.name)
}

/**
 * 获取初始游戏颜色（用于 Phaser canvas 初始化）
 * 解决首次加载时 canvas 主题与系统主题不同步的问题
 *
 * 逻辑：
 * 1. 检查 localStorage 中保存的主题模式
 * 2. 如果是 light/dark，直接返回对应颜色
 * 3. 如果是 system 或 null（首次访问），检测系统主题
 */
export function getInitialGameColors(): GameColors {
  const MEDIA_QUERY = '(prefers-color-scheme: dark)'

  function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (saved === 'light') {
      return lightTheme.gameColors
    }
    if (saved === 'dark') {
      return darkTheme.gameColors
    }
    // system 模式或首次访问（null）：检测系统主题
    const systemTheme = getSystemTheme()
    return getTheme(systemTheme).gameColors
  } catch {
    // localStorage 可能被禁用，回退到系统主题检测
    const systemTheme = typeof window !== 'undefined'
      ? (window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light')
      : 'dark'
    return getTheme(systemTheme).gameColors
  }
}
