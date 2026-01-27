"""Game calculator module.

Core game calculation logic including building costs, damage, scoring, etc.
"""

import math
import random
from typing import Any

from game.config import MonsterAttrs


def calc_total_cost(building_type: str, level: int, config: dict) -> int:
    """Calculate the total cost of a building at the given level.

    Formula: total = build_cost + sum(upgrade_costs)
    where upgrade_cost = int(accumulated_cost * upgradeCostRatio)

    Source: td-obj-building.js:56-66

    Args:
        building_type: Building type identifier.
        level: Target level (1 means initial build).
        config: Full game config (must contain a "buildings" key).

    Returns:
        Total cost to reach the specified level.
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
    """Process a sequence of building actions and compute spending and income.

    Source: SPEC.md L771-789

    Args:
        actions: List of actions, each containing type, buildingId, frame, etc.
        session_buildings: Current buildings in the session.
        config: Full game config.

    Returns:
        A (spent, income, updated_buildings) tuple.
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
    """Adjust difficulty based on life lost in the previous wave.

    Source: td-data-stage-1.js:264-288

    Args:
        current: Current difficulty coefficient.
        life_lost: Life points lost in the previous wave.
        wave: Current wave number.

    Returns:
        New difficulty coefficient (minimum 1.0).
    """
    # Wave 1 is the tutorial wave; no adjustment
    if wave == 1:
        return current

    if life_lost == 0:
        if wave < 5:
            factor = 1.05
        elif current > 30:
            factor = 1.1  # Slow down scaling at high difficulty
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


def calc_monster_attrs(base: MonsterAttrs, difficulty: float) -> dict[str, Any]:
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
        base: Base monster attributes dict.
        difficulty: Current difficulty coefficient.

    Returns:
        Calculated monster attributes (does not mutate base).
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
    """Calculate actual damage after shield reduction.

    Formula: actual = max(raw - shield, ceil(raw * 0.1))
    Minimum damage is 10% of raw damage (rounded up), ensuring high-attack
    buildings remain effective against high-shield monsters.

    Source: td-obj-monster.js:78-83

    Args:
        raw_damage: Raw damage value (building attack power).
        shield: Monster shield value.

    Returns:
        Actual damage dealt.
    """
    min_damage = math.ceil(raw_damage * 0.1)
    return max(raw_damage - shield, min_damage)


def calc_life_reward(wave: int) -> int:
    """Calculate the life reward for completing a wave.

    Rules:
    - Every 10th wave: +10 life
    - Every 5th wave (not a multiple of 10): +5 life
    - All other waves: 0

    Note:
        The life cap of 100 is enforced when the reward is applied, not here.

    Source: td-data-stage-1.js:62-73

    Args:
        wave: Current wave number.

    Returns:
        Life reward value.
    """
    if wave % 10 == 0:
        return 10
    elif wave % 5 == 0:
        return 5
    return 0


def calc_hit_score(actual_damage: int) -> int:
    """Calculate the score awarded for a single hit.

    Formula: score = floor(sqrt(actual_damage))
    Score is awarded on each hit, not on kill.

    Source: td-obj-monster.js:85

    Args:
        actual_damage: Actual damage dealt.

    Returns:
        Score earned from this hit.
    """
    return int(math.sqrt(actual_damage))


def build_validation_buildings(
    actions: list[dict[str, Any]],
    session_buildings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build the building list used for attack validation.

    Unlike process_actions, SELL actions are ignored here because attacks
    may occur before a building is sold, so all buildings that ever
    participated in combat must be retained for validation.

    Args:
        actions: List of actions, each containing type, buildingId, frame, etc.
        session_buildings: Current buildings in the session.

    Returns:
        Building list for validation (each with id, type, level, position).
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

        # SELL is intentionally ignored; buildings are kept for validation

    return list(buildings.values())
