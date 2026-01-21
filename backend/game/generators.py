"""Wave generator module.

Generates monster configurations for game waves.
"""

import math
import random
import uuid
from typing import Any

from game.calculators import calc_monster_attrs
from game.config import MONSTERS, PREDEFINED_WAVES, WAVE_CONFIG


def generate_wave(wave_number: int, difficulty: float) -> dict[str, Any]:
    """Generate monster configuration for a specific wave.

    Sources:
    - Predefined waves (1-10): PREDEFINED_WAVES config
    - Auto-generated (11+): td-data-stage-1.js:296-300

    Args:
        wave_number: Wave number (starting from 1)
        difficulty: Current difficulty coefficient

    Returns:
        Wave config dict containing:
        - waveNumber: Wave number
        - monsters: Expanded monster list (each with unique ID)
        - waveConfig: Aggregated format for server validation

    Raises:
        ValueError: When wave_number <= 0
    """
    if wave_number <= 0:
        raise ValueError("Wave number must be greater than 0")

    if wave_number <= WAVE_CONFIG["predefined_wave_count"]:
        wave_def = PREDEFINED_WAVES[wave_number]
    else:
        wave_def = _generate_auto_wave(wave_number)

    monsters, wave_config = _expand_wave_def(wave_def, difficulty)

    return {
        "waveNumber": wave_number,
        "monsters": monsters,
        "waveConfig": wave_config,
    }


def _generate_auto_wave(wave_number: int) -> list[dict[str, int]]:
    """Auto-generate wave configuration (wave 11+).

    Algorithm:
    - Total monsters = min(floor(wave^1.1), max_monsters_per_wave)
    - Group size: random 1-3
    - Monster type: random selection (0-8)

    Source: td-cfg-monsters.js:170-191 makeMonsters()

    Args:
        wave_number: Wave number

    Returns:
        Wave definition list [{"type": int, "count": int}, ...], in spawn order
    """
    total = min(
        int(math.pow(wave_number, 1.1)),
        WAVE_CONFIG["max_monsters_per_wave"],
    )

    type_count = len(MONSTERS)
    groups = []
    remaining = total

    while remaining > 0:
        group_size = min(random.randint(1, 3), remaining)
        monster_type = random.randint(0, type_count - 1)
        groups.append({"type": monster_type, "count": group_size})
        remaining -= group_size

    return groups


def _expand_wave_def(
    wave_def: list[dict[str, int]],
    difficulty: float,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Expand wave definition into concrete monster list.

    Each monster gets independently calculated random attributes,
    ensuring same-type monsters have different life/speed values.

    Args:
        wave_def: Wave definition [{"type": int, "count": int}, ...]
        difficulty: Difficulty coefficient

    Returns:
        (monsters, wave_config) tuple:
        - monsters: Monster list, each with id, type, life, speed, shield, money
        - wave_config: Aggregated validation config [{"type", "count", "money"}, ...]
          (money is static, kept in waveConfig for validation)
    """
    monsters = []
    wave_config = []

    for group in wave_def:
        monster_type = group["type"]
        count = group["count"]
        base_attrs = MONSTERS[monster_type]

        wave_config.append({
            "type": monster_type,
            "count": count,
            "money": base_attrs["money"],
        })

        for _ in range(count):
            attrs = calc_monster_attrs(base_attrs, difficulty)
            monsters.append({
                "id": str(uuid.uuid4()),
                "type": monster_type,
                "life": attrs["life"],
                "speed": attrs["speed"],
                "shield": attrs["shield"],
                "money": attrs["money"],
            })

    return monsters, wave_config
