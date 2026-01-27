"""Game configuration module."""

from typing import NotRequired, TypedDict


class BuildingConfig(TypedDict):
    """Source: td-cfg-buildings.js."""

    name: str
    cost: int
    damage: int
    range: int  # Initial range (grid units), upgradeable
    max_range: int  # Max range after upgrades (grid units)
    speed: int  # Attack speed factor; 0 means non-attacking
    bullet_speed: int  # 0 means no bullet (wall) or instant hit (laser_gun)
    life: int
    shield: int
    upgradeCostRatio: float
    sellRatio: float


class MonsterAttrs(TypedDict):
    """Attributes used by monster calculation functions.

    Required fields are directly used in calculations.
    Optional fields are either conditionally accessed or passed through.
    """

    life: int
    speed: int
    shield: int
    money: int
    name: NotRequired[str]
    max_speed: NotRequired[int]
    damage: NotRequired[int]
    color: NotRequired[str]


class MonsterConfig(TypedDict):

    name: str
    life: int
    speed: int
    max_speed: int  # Speed cap for high difficulty
    shield: int
    damage: int  # Damage to player when reaching exit
    money: int  # Kill reward
    color: str


class MapConfig(TypedDict):

    width: int
    height: int
    entrance: list[int]
    exit: list[int]
    obstacles: list[list[int]]


class InitialConfig(TypedDict):

    money: int
    life: int
    difficulty: float


BUILDINGS: dict[str, BuildingConfig] = {
    # Source: td-cfg-buildings.js:29-94
    "wall": {
        "name": "路障",
        "cost": 5,
        "damage": 0,
        "range": 0,
        "max_range": 0,
        "speed": 0,
        "bullet_speed": 0,
        "life": 100,
        "shield": 500,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
    "cannon": {
        "name": "炮台",
        "cost": 300,
        "damage": 12,
        "range": 4,
        "max_range": 8,
        "speed": 2,
        "bullet_speed": 6,
        "life": 100,
        "shield": 100,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
    "LMG": {
        "name": "轻机枪",
        "cost": 100,
        "damage": 5,
        "range": 5,
        "max_range": 10,
        "speed": 3,
        "bullet_speed": 6,
        "life": 100,
        "shield": 50,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
    "HMG": {
        "name": "重机枪",
        "cost": 800,
        "damage": 30,
        "range": 3,
        "max_range": 5,
        "speed": 3,
        "bullet_speed": 5,
        "life": 100,
        "shield": 200,
        "upgradeCostRatio": 0.75,
        "sellRatio": 0.5,
    },
    "laser_gun": {
        "name": "激光枪",
        "cost": 2000,
        "damage": 25,
        "range": 6,
        "max_range": 10,
        "speed": 20,
        "bullet_speed": 0,
        "life": 100,
        "shield": 100,
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

WAVE_CONFIG = {
    "max_monsters_per_wave": 100,
    "predefined_wave_count": 10,
}

# Wave bonus config
# Source: SPEC.md L146-147, td-data-stage-1.js:63-68
WAVE_BONUS = {
    "life_per_5_waves": 5,
    "life_per_10_waves": 10,  # Overrides 5-wave bonus
    "max_life": 100,
}

# Difficulty adjustment config
# Source: td-data-stage-1.js:266-288
DIFFICULTY_ADJUSTMENTS = {
    # Difficulty increase when no damage taken
    "no_damage": {
        "early_wave_threshold": 5,
        "early_multiplier": 1.05,
        "high_difficulty_threshold": 30,
        "high_multiplier": 1.1,
        "normal_multiplier": 1.2,
    },
    # Difficulty reduction based on damage taken
    "damage_thresholds": [
        (50, 0.6),  # damage >= 50: x0.6
        (30, 0.7),  # damage >= 30: x0.7
        (20, 0.8),  # damage >= 20: x0.8
        (10, 0.9),  # damage >= 10: x0.9
    ],
    # Difficulty increase in late game with low damage
    "low_damage": {
        "wave_threshold": 10,  # wave >= 10 and damage < 10
        "multiplier": 1.05,
    },
    "min_difficulty": 1.0,
}


# Predefined wave configs (waves 1-10)
# Source: td-data-stage-1.js:184-250
# Only uses basic types (0/1/2) with gradual difficulty increase
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

GAME_CONFIG = {
    "buildings": BUILDINGS,
    "monsters": {
        k: {"name": v["name"], "color": v["color"], "damage": v["damage"]}
        for k, v in MONSTERS.items()
    },
    "map": MAP,
    "initial": INITIAL,
}
