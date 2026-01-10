/**
 * 英文语言包
 * 参考旧实现：html5-tower-defense/src/js/td-msg-en.js
 */

import type { MessageKey } from './zh'

export const en: Record<MessageKey, string> = {
  // 地图标记
  entrance: 'Entrance',
  exit: 'Exit',

  // 面板标题
  panel_money_title: 'Money: ',
  panel_score_title: 'Score: ',
  panel_life_title: 'Life: ',
  panel_building_title: 'Buildings: ',
  panel_monster_title: 'Monsters: ',

  // 波次信息
  wave_info: 'Wave ${0}',

  // 建筑名称
  building_name_wall: 'Roadblock',
  building_name_cannon: 'Cannon',
  building_name_LMG: 'LMG',
  building_name_HMG: 'HMG',
  building_name_laser_gun: 'Laser Gun',

  // 建筑信息
  building_info: '${0}: Level ${1}, Damage ${2}, Speed ${3}, Range ${4}, Kills ${5}',
  building_info_wall: '${0}',

  // 建筑 tooltip（面板悬停）
  building_tooltip_wall: 'Name: ${0}\nCost: $${1}\n\nBlocks monsters',
  building_tooltip_weapon: 'Name: ${0}\nCost: $${1}\nDamage: ${2}\nSpeed: ${3}\nRange: ${4}',

  // 建筑介绍（旧格式，保留兼容）
  building_intro_wall: 'Roadblock: monsters cannot pass ($${0})',
  building_intro_cannon: 'Cannon: balanced range and damage ($${0})',
  building_intro_LMG: 'Light Machine Gun: longer range, normal damage ($${0})',
  building_intro_HMG: 'Heavy Machine Gun: fast shooting, greater damage, normal range ($${0})',
  building_intro_laser_gun: 'Laser Gun: greater damage, 100% hit rate ($${0})',

  // 操作提示
  click_to_build: 'Left click to build ${0} ($${1})',
  upgrade: 'Upgrade ${0} to level ${1}, cost $${2}.',
  sell: 'Sell ${0} for $${1}',
  upgrade_success: 'Upgrade success! ${0} upgraded to level ${1}. Next upgrade costs $${2}.',
  upgrade_tooltip: 'Upgrade ${0} to level ${1}\nCost: $${2}',
  sell_tooltip: 'Sell ${0}\nReceive: $${1}',

  // 怪物信息
  monster_info: 'Monster: Life ${0}, Shield ${1}, Speed ${2}, Damage ${3}',
  monster_tooltip: 'Life: ${0}/${1}\nShield: ${2}\nSpeed: ${3}\nDamage: ${4}\nGold: ${5}',

  // 按钮文本
  button_upgrade_text: 'Upgrade',
  button_sell_text: 'Sell',
  button_start_text: 'Start',
  button_restart_text: 'Restart',
  button_pause_text: 'Pause',
  button_continue_text: 'Continue',
  button_endgame_text: 'End Game',

  // 按钮描述
  button_pause_desc_0: 'Game paused',
  button_pause_desc_1: 'Game resumed',

  // 错误和警告
  not_enough_money: 'Not enough money, need $${0}.',
  cant_build: "Can't build here!",
  cant_pass: "Can't pass!",
  blocked: "Can't build here, it will block the way from entrance to exit!",
  monster_be_blocked: "Can't build here, some monsters will be blocked!",
  entrance_or_exit_be_blocked: "Can't build on the entrance or exit!",
  error_session_expired: 'Session expired, restarting...',
  error_network: 'Network error, please try again',

  // 游戏结束
  game_over: 'GAME OVER',
  final_score: 'Final Score: ${0}',
  waves_completed: 'Waves Completed: ${0}',

  // 排行榜
  leaderboard: 'Leaderboard',
  rank: 'Rank',
  nickname: 'Nickname',
  player: 'Player',
  score: 'Score',
  waves: 'Waves',
  date: 'Date',
  enter_nickname: 'Enter your nickname',
  submit: 'Submit',
  retry: 'Retry',
  close: 'Close',
  leaderboard_error: 'Failed to load leaderboard',
  leaderboard_empty: 'No records yet. Be the first!',

  // 游戏状态
  loading: 'Loading...',
  paused: 'PAUSED',
  next_wave_in: 'Next wave: ${0}s',
  selected: 'Selected: ${0}',
  frame: 'Frame: ${0}',

  // 工具栏
  toolbar_switch_to_light: 'Switch to light mode',
  toolbar_switch_to_dark: 'Switch to dark mode',
  toolbar_switch_to_english: 'Switch to English',
  toolbar_switch_to_chinese: '切换到中文',
  toolbar_view_leaderboard: 'View Leaderboard',

  // 横屏提示
  rotate_screen: 'Please rotate to portrait mode',

  // 游戏指引
  guide_title: 'How to Play',
  guide_objective_title: 'Objective',
  guide_objective: 'Stop monsters from reaching the exit. Each monster that escapes costs you life. Game over when life reaches zero.',
  guide_build_title: 'Build Towers',
  guide_build: 'Select a tower type from the building panel below, then click an empty tile on the map to place it. Different towers have different damage, range, and attack speed.',
  guide_upgrade_title: 'Upgrade & Sell',
  guide_upgrade: 'Click on a placed tower to upgrade or sell it. Upgrading increases damage, selling refunds some money.',
  guide_tips_title: 'Tips',
  guide_tips: 'Use roadblocks strategically to extend the monster path, giving your towers more time to attack.',
  guide_start_game: 'Got it',
  toolbar_view_guide: 'View Guide',
} as const
