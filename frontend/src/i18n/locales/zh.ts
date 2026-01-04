/**
 * 中文语言包
 * 参考旧实现：html5-tower-defense/src/js/td-msg-zh.js
 */

export const zh = {
  // 地图标记
  entrance: '起点',
  exit: '终点',

  // 面板标题
  panel_money_title: '金钱: ',
  panel_score_title: '积分: ',
  panel_life_title: '生命: ',
  panel_building_title: '建筑: ',
  panel_monster_title: '怪物: ',

  // 波次信息
  wave_info: '第 ${0} 波',

  // 建筑名称
  building_name_wall: '路障',
  building_name_cannon: '炮台',
  building_name_LMG: '轻机枪',
  building_name_HMG: '重机枪',
  building_name_laser_gun: '激光炮',

  // 建筑信息
  building_info: '${0}: 等级 ${1}，攻击 ${2}，速度 ${3}，射程 ${4}，战绩 ${5}',
  building_info_wall: '${0}',

  // 建筑 tooltip（面板悬停）
  building_tooltip_wall: '名称: ${0}\n费用: $${1}\n\n阻挡怪物通过',
  building_tooltip_weapon: '名称: ${0}\n费用: $${1}\n伤害: ${2}\n攻速: ${3}\n射程: ${4}',

  // 建筑介绍（旧格式，保留兼容）
  building_intro_wall: '路障 可以阻止怪物通过 ($${0})',
  building_intro_cannon: '炮台 射程、杀伤力较为平衡 ($${0})',
  building_intro_LMG: '轻机枪 射程较远，杀伤力一般 ($${0})',
  building_intro_HMG: '重机枪 快速射击，威力较大，射程一般 ($${0})',
  building_intro_laser_gun: '激光枪 伤害较大，命中率 100% ($${0})',

  // 操作提示
  click_to_build: '左键点击建造 ${0} ($${1})',
  upgrade: '升级 ${0} 到 ${1} 级，需花费 $${2}。',
  sell: '出售 ${0}，可获得 $${1}',
  upgrade_success: '升级成功，${0} 已升级到 ${1} 级！下次升级需要 $${2}。',
  upgrade_tooltip: '升级 ${0} 到 ${1} 级\n费用: $${2}',
  sell_tooltip: '出售 ${0}\n获得: $${1}',

  // 怪物信息
  monster_info: '怪物: 生命 ${0}，防御 ${1}，速度 ${2}，伤害 ${3}',
  monster_tooltip: '生命: ${0}/${1}\n护盾: ${2}\n速度: ${3}\n伤害: ${4}\n金币: ${5}',

  // 按钮文本
  button_upgrade_text: '升级',
  button_sell_text: '出售',
  button_start_text: '开始',
  button_restart_text: '重新开始',
  button_pause_text: '暂停',
  button_continue_text: '继续',

  // 按钮描述
  button_pause_desc_0: '游戏暂停',
  button_pause_desc_1: '游戏继续',

  // 错误和警告
  not_enough_money: '金钱不足，需要 $${0}！',
  cant_build: '不能在这儿修建',
  cant_pass: '怪物不能通过这儿',
  blocked: '不能在这儿修建建筑，起点与终点之间至少要有一条路可到达！',
  monster_be_blocked: '不能在这儿修建建筑，有怪物被围起来了！',
  entrance_or_exit_be_blocked: '不能在起点或终点处修建建筑！',

  // 游戏结束
  game_over: '游戏结束',
  final_score: '最终得分: ${0}',
  waves_completed: '完成波次: ${0}',

  // 排行榜
  leaderboard: '排行榜',
  rank: '排名',
  nickname: '昵称',
  score: '得分',
  enter_nickname: '请输入昵称',
  submit: '提交',

  // 游戏状态
  loading: '加载中...',
  paused: '已暂停',
  next_wave_in: '下一波: ${0}秒',
  selected: '已选: ${0}',
  frame: '帧: ${0}',

  // 工具栏
  toolbar_switch_to_light: '切换到亮色模式',
  toolbar_switch_to_dark: '切换到暗色模式',
  toolbar_switch_to_english: 'Switch to English',
  toolbar_switch_to_chinese: '切换到中文',
  toolbar_view_leaderboard: '查看排行榜',

  // 横屏提示
  rotate_screen: '请旋转设备至竖屏模式',
} as const

export type MessageKey = keyof typeof zh
