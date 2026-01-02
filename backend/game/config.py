"""游戏配置模块.

定义建筑、怪物、地图等游戏核心配置。
配置来源于旧实现：/home/jinmiaoluo/repo/html5-tower-defense
"""

from typing import TypedDict


class BuildingConfig(TypedDict):
    """建筑配置类型."""

    name: str
    cost: int
    damage: int
    range: int
    speed: int  # 攻击间隔（帧），0 表示不攻击
    upgradeCostRatio: float
    sellRatio: float


class MonsterConfig(TypedDict):
    """怪物配置类型."""

    name: str
    life: int  # 基础生命值
    speed: int  # 基础移动速度
    max_speed: int  # 速度上限（用于高难度限制）
    shield: int  # 基础护盾
    damage: int  # 到达终点造成的伤害
    money: int  # 击杀奖励金钱
    color: str  # 显示颜色


class MapConfig(TypedDict):
    """地图配置类型."""

    width: int
    height: int
    entrance: list[int]
    exit: list[int]
    obstacles: list[list[int]]


class InitialConfig(TypedDict):
    """初始状态配置类型."""

    money: int
    life: int
    difficulty: float


BUILDINGS: dict[str, BuildingConfig] = {
    "wall": {
        "name": "路障",
        "cost": 5,
        "damage": 0,
        "range": 0,
        "speed": 0,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
    "cannon": {
        "name": "炮台",
        "cost": 300,
        "damage": 12,
        "range": 8,  # max_range from old impl
        "speed": 2,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
    "LMG": {
        "name": "轻机枪",
        "cost": 100,
        "damage": 5,
        "range": 10,  # max_range from old impl
        "speed": 3,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
    "HMG": {
        "name": "重机枪",
        "cost": 800,
        "damage": 30,
        "range": 5,  # max_range from old impl
        "speed": 3,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
    "laser_gun": {
        "name": "激光枪",
        "cost": 2000,
        "damage": 25,
        "range": 10,  # max_range from old impl
        "speed": 20,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
}

MONSTERS: dict[int, MonsterConfig] = {
    0: {
        "name": "普通怪",
        "life": 50,
        "speed": 3,
        "max_speed": 10,
        "shield": 0,
        "damage": 1,
        "money": 5,
        "color": "#00ff00",
    },
    1: {
        "name": "稍强怪",
        "life": 50,
        "speed": 6,
        "max_speed": 20,
        "shield": 1,
        "damage": 2,
        "money": 8,
        "color": "#33ff33",
    },
    2: {
        "name": "速度怪",
        "life": 50,
        "speed": 12,
        "max_speed": 30,
        "shield": 1,
        "damage": 3,
        "money": 10,
        "color": "#66ff66",
    },
    3: {
        "name": "血量怪",
        "life": 500,
        "speed": 5,
        "max_speed": 10,
        "shield": 1,
        "damage": 3,
        "money": 50,
        "color": "#ff0000",
    },
    4: {
        "name": "护盾怪",
        "life": 50,
        "speed": 5,
        "max_speed": 10,
        "shield": 20,
        "damage": 3,
        "money": 30,
        "color": "#0000ff",
    },
    5: {
        "name": "伤害怪",
        "life": 50,
        "speed": 7,
        "max_speed": 14,
        "shield": 2,
        "damage": 10,
        "money": 25,
        "color": "#ff00ff",
    },
    6: {
        "name": "速度血量怪",
        "life": 100,
        "speed": 15,
        "max_speed": 30,
        "shield": 3,
        "damage": 3,
        "money": 35,
        "color": "#ffff00",
    },
    7: {
        "name": "极速怪",
        "life": 30,
        "speed": 30,
        "max_speed": 40,
        "shield": 1,
        "damage": 4,
        "money": 20,
        "color": "#00ffff",
    },
    8: {
        "name": "护盾血量怪",
        "life": 300,
        "speed": 3,
        "max_speed": 10,
        "shield": 15,
        "damage": 5,
        "money": 60,
        "color": "#ff6600",
    },
}

MAP: MapConfig = {
    "width": 16,
    "height": 16,
    "entrance": [0, 0],
    "exit": [15, 15],
    "obstacles": [],
}

INITIAL: InitialConfig = {
    "money": 500,
    "life": 100,
    "difficulty": 1.0,
}

# 最终得分配置
# 参考 SPEC.md 第 168-174 行（新设计，旧实现无此功能）
# 最终得分 = 累计命中得分 + 波次奖励 + 剩余生命奖励 + 剩余金币奖励
SCORE_CONFIG = {
    "wave_coefficient": 10,    # 波次奖励 = 完成波次数 × 系数
    "life_coefficient": 5,     # 生命奖励 = 剩余生命 × 系数
    "money_coefficient": 0.1,  # 金币奖励 = 剩余金币 × 系数
}

# 波次生成配置
WAVE_CONFIG = {
    "max_monsters_per_wave": 100,
    "predefined_wave_count": 10,  # 前 10 波使用 PREDEFINED_WAVES
}

# 波次奖励配置
# 参考 SPEC.md 第 146-147 行，旧实现 td-data-stage-1.js:63-68
WAVE_BONUS = {
    "life_per_5_waves": 5,   # 每 5 波 +5 生命
    "life_per_10_waves": 10,  # 每 10 波 +10 生命（覆盖 5 波奖励）
    "max_life": 100,
}

# 难度调整配置
# 参考旧实现：td-data-stage-1.js:266-288
DIFFICULTY_ADJUSTMENTS = {
    # 无伤害时的难度提升
    "no_damage": {
        "early_wave_threshold": 5,  # wave < 5 时使用 early 系数
        "early_multiplier": 1.05,
        "high_difficulty_threshold": 30,  # difficulty > 30 时使用 high 系数
        "high_multiplier": 1.1,
        "normal_multiplier": 1.2,
    },
    # 受伤时的难度降低
    "damage_thresholds": [
        (50, 0.6),  # 伤害 >= 50: × 0.6
        (30, 0.7),  # 伤害 >= 30: × 0.7
        (20, 0.8),  # 伤害 >= 20: × 0.8
        (10, 0.9),  # 伤害 >= 10: × 0.9
    ],
    # 低伤害且后期时的难度提升
    "low_damage": {
        "wave_threshold": 10,  # wave >= 10 且伤害 < 10
        "multiplier": 1.05,
    },
    "min_difficulty": 1.0,
}


# 预定义波次配置（波次 1-10）
# 来源：旧实现 td-data-stage-1.js:184-250
# 每个元素为 {"type": 怪物类型, "count": 数量}
# 前 10 波只使用 type 0/1/2 三种基础怪物，难度渐进
PREDEFINED_WAVES: dict[int, list[dict[str, int]]] = {
    1: [{"type": 0, "count": 1}],
    2: [{"type": 0, "count": 1}, {"type": 1, "count": 1}],
    3: [{"type": 0, "count": 2}, {"type": 1, "count": 1}],
    4: [{"type": 0, "count": 2}, {"type": 1, "count": 1}],
    5: [{"type": 0, "count": 3}, {"type": 1, "count": 2}],
    6: [{"type": 0, "count": 4}, {"type": 1, "count": 2}],
    7: [{"type": 0, "count": 5}, {"type": 1, "count": 3}, {"type": 2, "count": 1}],
    8: [{"type": 0, "count": 6}, {"type": 1, "count": 4}, {"type": 2, "count": 1}],
    9: [{"type": 0, "count": 7}, {"type": 1, "count": 3}, {"type": 2, "count": 2}],
    10: [{"type": 0, "count": 8}, {"type": 1, "count": 4}, {"type": 2, "count": 3}],
}

# 组合完整游戏配置（用于 API 响应）
GAME_CONFIG = {
    "buildings": BUILDINGS,
    "monsters": {
        k: {"name": v["name"], "color": v["color"], "damage": v["damage"]}
        for k, v in MONSTERS.items()
    },
    "map": MAP,
    "initial": INITIAL,
}
