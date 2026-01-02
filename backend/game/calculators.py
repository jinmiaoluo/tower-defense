"""游戏计算器模块.

包含游戏核心计算逻辑，如建筑成本、伤害计算、得分计算等。
"""

from typing import Any


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
            buildings[bid] = {"id": bid, "type": action["buildingType"], "level": 1}

        elif atype == "UPGRADE":
            b = buildings[bid]
            spent += int(calc_total_cost(b["type"], b["level"], config) * 0.75)
            b["level"] += 1

        elif atype == "SELL":
            b = buildings.pop(bid)
            income += int(calc_total_cost(b["type"], b["level"], config) * 0.5) or 1

    return spent, income, list(buildings.values())
