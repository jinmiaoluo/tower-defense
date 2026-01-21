"""游戏计算器模块.

包含游戏核心计算逻辑，如建筑成本、伤害计算、得分计算等。
"""

import math
import random
from typing import Any

from game.config import MonsterConfig


def calc_total_cost(building_type: str, level: int, config: dict) -> int:
    """计算建筑升级到指定等级的总花费.

    公式：总花费 = 建造成本 + Σ(升级成本)
    升级成本 = int(累计花费 × upgradeCostRatio)

    来源：旧实现 td-obj-building.js:56-66

    Args:
        building_type: 建筑类型标识符
        level: 目标等级（1 表示初始建造）
        config: 完整游戏配置（包含 buildings 键）

    Returns:
        升级到指定等级的总花费
    """
    building = config["buildings"][building_type]
    total = building["cost"]

    for _ in range(1, level):
        upgrade_cost = int(total * building["upgradeCostRatio"])
        total += upgrade_cost

    return total


def process_actions(
    actions: list[dict[str, Any]],
    session_buildings: list[dict[str, Any]],
    config: dict,
) -> tuple[int, int, list[dict[str, Any]]]:
    """处理建筑操作序列，计算花费和收入.

    来源：SPEC.md L771-789

    Args:
        actions: 操作列表，每个操作包含 type, buildingId, frame 等字段
        session_buildings: 当前会话中的建筑列表
        config: 完整游戏配置

    Returns:
        (spent, income, updated_buildings) 元组
    """
    buildings = {b["id"]: b.copy() for b in session_buildings}
    spent, income = 0, 0

    for action in sorted(actions, key=lambda a: a["frame"]):
        bid, atype = action["buildingId"], action["type"]

        if atype == "BUILD":
            spent += config["buildings"][action["buildingType"]]["cost"]
            buildings[bid] = {
                "id": bid,
                "type": action["buildingType"],
                "level": 1,
                "position": action["position"],
            }

        elif atype == "UPGRADE":
            b = buildings[bid]
            spent += int(calc_total_cost(b["type"], b["level"], config) * 0.75)
            b["level"] += 1

        elif atype == "SELL":
            b = buildings.pop(bid)
            income += int(calc_total_cost(b["type"], b["level"], config) * 0.5) or 1

    return spent, income, list(buildings.values())


def calc_new_difficulty(current: float, life_lost: int, wave: int) -> float:
    """根据上一波受伤情况调整难度.

    来源：旧实现 td-data-stage-1.js:264-288

    Args:
        current: 当前难度系数
        life_lost: 上一波损失的生命值
        wave: 当前波次号

    Returns:
        新的难度系数（最小为 1.0）
    """
    # Wave 1 不调整难度（教学波）
    if wave == 1:
        return current

    if life_lost == 0:
        if wave < 5:
            factor = 1.05
        elif current > 30:
            factor = 1.1  # 高难度时减缓增长
        else:
            factor = 1.2
    elif life_lost >= 50:
        factor = 0.6
    elif life_lost >= 30:
        factor = 0.7
    elif life_lost >= 20:
        factor = 0.8
    elif life_lost >= 10:
        factor = 0.9
    else:
        factor = 1.05 if wave >= 10 else 1.0

    return max(current * factor, 1.0)


def calc_monster_attrs(base: MonsterConfig, difficulty: float) -> dict[str, Any]:
    """Calculate monster attributes based on difficulty.

    Source: td-obj-monster.js:24-35

    Random factors:
    - life: random(0.5, 1.5) i.e. Math.random() + 0.5
    - speed: random(0.75, 1.25) i.e. Math.random() * 0.5 + 0.75
    - shield: no random factor

    Constraints (from td-obj-monster.js:27-36):
    - speed: min 1, max max_speed (if defined)
    - life: min 1
    - shield: min 0

    Args:
        base: Base monster attributes dict
        difficulty: Current difficulty coefficient

    Returns:
        Calculated monster attributes (does not mutate base)
    """
    life_rand = random.random() + 0.5
    speed_rand = random.random() * 0.5 + 0.75

    speed = (base["speed"] + difficulty / 2) * speed_rand
    max_speed = base.get("max_speed", float("inf"))

    return {
        **base,
        "speed": min(max(speed, 1), max_speed),
        "life": max(int(base["life"] * (difficulty + 1) * 0.5 * life_rand), 1),
        "shield": max(int(base["shield"] + difficulty / 2), 0),
    }


def calc_actual_damage(raw_damage: int, shield: int) -> int:
    """计算实际伤害.

    公式：actual = max(raw - shield, ceil(raw * 0.1))
    最低伤害为原始伤害的 10%（向上取整），保证高攻武器对高护盾怪有效。

    来源：旧实现 td-obj-monster.js:78-83

    Args:
        raw_damage: 原始伤害值（建筑攻击力）
        shield: 怪物护盾值

    Returns:
        实际造成的伤害
    """
    min_damage = math.ceil(raw_damage * 0.1)
    return max(raw_damage - shield, min_damage)


def calc_life_reward(wave: int) -> int:
    """计算波次生命奖励.

    规则：
    - 每 10 波: +10 生命
    - 每 5 波（非 10 的倍数）: +5 生命
    - 其他波次: 0

    注意：生命上限 100 的约束在应用奖励时处理，此函数只计算应得奖励值。

    来源：旧实现 td-data-stage-1.js:62-73

    Args:
        wave: 当前波次号

    Returns:
        生命奖励值
    """
    if wave % 10 == 0:
        return 10
    elif wave % 5 == 0:
        return 5
    return 0


def calc_hit_score(actual_damage: int) -> int:
    """计算命中得分.

    公式：score = floor(√actual_damage)
    每次攻击命中时立即加分，而非击杀时加分。

    来源：旧实现 td-obj-monster.js:85

    Args:
        actual_damage: 实际造成的伤害

    Returns:
        本次命中获得的分数
    """
    return int(math.sqrt(actual_damage))


def build_validation_buildings(
    actions: list[dict[str, Any]],
    session_buildings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """构建用于攻击验证的建筑列表.

    与 process_actions 的区别：不执行 SELL 操作。
    因为攻击可能发生在建筑被出售之前，验证时需要保留所有参与过攻击的建筑。

    Args:
        actions: 操作列表，每个操作包含 type, buildingId, frame 等字段
        session_buildings: 当前会话中的建筑列表

    Returns:
        用于验证的建筑列表（包含 id, type, level, position）
    """
    buildings = {b["id"]: b.copy() for b in session_buildings}

    for action in sorted(actions, key=lambda a: a["frame"]):
        bid, atype = action["buildingId"], action["type"]

        if atype == "BUILD":
            buildings[bid] = {
                "id": bid,
                "type": action["buildingType"],
                "level": 1,
                "position": action["position"],
            }

        elif atype == "UPGRADE":
            buildings[bid]["level"] += 1

        # SELL 操作被忽略，建筑保留在列表中

    return list(buildings.values())
