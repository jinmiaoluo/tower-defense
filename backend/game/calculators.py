"""游戏计算器模块.

包含游戏核心计算逻辑，如建筑成本、伤害计算、得分计算等。
"""


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
