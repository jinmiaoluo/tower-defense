"""波次生成器模块.

生成游戏波次的怪物配置。
"""

import math
import uuid
from typing import Any

from game.calculators import calc_monster_attrs
from game.config import MONSTERS, PREDEFINED_WAVES, WAVE_CONFIG


def generate_wave(wave_number: int, difficulty: float) -> dict[str, Any]:
    """生成指定波次的怪物配置.

    来源：
    - 预定义波次 (1-10): PREDEFINED_WAVES 配置
    - 自动生成 (11+): td-data-stage-1.js:296-300

    Args:
        wave_number: 波次号（从 1 开始）
        difficulty: 当前难度系数

    Returns:
        波次配置字典，包含 waveNumber 和 monsters 列表

    Raises:
        ValueError: 波次号小于等于 0 时
    """
    if wave_number <= 0:
        raise ValueError("波次号必须大于 0")

    if wave_number <= WAVE_CONFIG["predefined_wave_count"]:
        wave_def = PREDEFINED_WAVES[wave_number]
    else:
        wave_def = _generate_auto_wave(wave_number)

    monsters = _expand_wave_def(wave_def, difficulty)

    return {
        "waveNumber": wave_number,
        "monsters": monsters,
    }


def generate_first_wave() -> dict[str, Any]:
    """生成第一波配置.

    使用默认难度 1.0。

    Returns:
        第一波配置字典
    """
    return generate_wave(1, 1.0)


def _generate_auto_wave(wave_number: int) -> list[dict[str, int]]:
    """自动生成波次配置（波次 11+）.

    算法说明：
    - 怪物总数 = min(floor(wave^1.1), max_monsters_per_wave)
    - 使用确定性分布算法（轮询所有怪物类型）

    Args:
        wave_number: 波次号

    Returns:
        波次定义列表 [{"type": int, "count": int}, ...]
    """
    total = min(
        int(math.pow(wave_number, 1.1)),
        WAVE_CONFIG["max_monsters_per_wave"],
    )

    type_count = len(MONSTERS)
    counts = [0] * type_count

    remaining = total
    type_idx = 0
    group_sizes = [1, 2, 3]
    group_idx = 0

    while remaining > 0:
        size = min(group_sizes[group_idx % len(group_sizes)], remaining)
        counts[type_idx] += size
        remaining -= size
        type_idx = (type_idx + 1) % type_count
        group_idx += 1

    return [
        {"type": t, "count": c}
        for t, c in enumerate(counts)
        if c > 0
    ]


def _expand_wave_def(
    wave_def: list[dict[str, int]],
    difficulty: float,
) -> list[dict[str, Any]]:
    """展开波次定义为具体怪物列表.

    Args:
        wave_def: 波次定义 [{"type": int, "count": int}, ...]
        difficulty: 难度系数

    Returns:
        怪物列表，每个怪物包含 id, type, life, speed, shield, money
    """
    monsters = []

    for group in wave_def:
        monster_type = group["type"]
        count = group["count"]
        base_attrs = MONSTERS[monster_type]

        attrs = calc_monster_attrs(base_attrs, difficulty)

        for _ in range(count):
            monsters.append({
                "id": str(uuid.uuid4()),
                "type": monster_type,
                "life": attrs["life"],
                "speed": attrs["speed"],
                "shield": attrs["shield"],
                "money": attrs["money"],
            })

    return monsters
