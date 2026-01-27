"""Validator module.

Game data validation logic, organized in multiple levels:
- Level 1: Basic validation (count consistency, reward verification)
- Level 2: Damage validation (life pool, DPS capacity, range, damage value, cumulative damage)
- Level 4: Statistical analysis (anomaly detection)
"""

import logging
import math
from typing import Any

from game.models import GameSession

logger = logging.getLogger(__name__)


def validate_wave_continuity(
    session: GameSession,
    wave_number: int,
) -> tuple[bool, str]:
    """Validate wave number continuity.

    Source: SPEC.md L942-946
    """
    expected = session.wave_count + 1
    if wave_number != expected:
        return False, f"Wave not continuous: expected {expected}, got {wave_number}"
    return True, ""


def validate_basic(
    result: dict[str, Any],
    wave_config: dict[str, Any],
) -> tuple[bool, str]:
    """Level 1 basic validation: count consistency and reward verification.

    Source: SPEC.md L956-986

    Validations:
    1. sum(killed_by_type) == killed
    2. killedByType[type] <= wave_config[type].count
    3. remaining >= 0 (backward compatible, defaults to 0)
    4. 0 <= spawned <= total_monsters (backward compatible, defaults to total_monsters)
    5. killed + passed + remaining == spawned
    6. money_gained == calculated money from kills

    Args:
        result: Client-submitted wave result.
        wave_config: Wave configuration.

    Returns:
        Tuple of (success, error_message).
    """
    # JSON deserialization may produce string keys; normalize to int
    killed_by_type = {int(k): v for k, v in result["killed_by_type"].items()}
    wave_monsters = {m["type"]: m for m in wave_config["monsters"]}

    # 1. killed_by_type consistency
    if sum(killed_by_type.values()) != result["killed"]:
        return False, "Kill count mismatch"

    # 2. Per-type kill count must not exceed wave config
    for monster_type, killed_count in killed_by_type.items():
        if monster_type not in wave_monsters:
            return False, f"Unknown monster type: {monster_type}"
        if killed_count > wave_monsters[monster_type]["count"]:
            return False, f"Monster type {monster_type} kill count exceeds config"

    # 3. remaining field (backward compatible, defaults to 0)
    remaining = result.get("remaining", 0)
    if remaining < 0:
        return False, "remaining cannot be negative"

    # 4. spawned field (backward compatible, defaults to total_monsters)
    total_monsters = sum(m["count"] for m in wave_config["monsters"])
    spawned = result.get("spawned", total_monsters)
    if spawned < 0:
        return False, "spawned cannot be negative"
    if spawned > total_monsters:
        return False, "spawned exceeds total monsters in wave"

    # 5. Conservation check
    if result["killed"] + result["passed"] + remaining != spawned:
        return False, "Monster count mismatch"

    # 6. Money reward verification
    expected_money = sum(
        killed_by_type.get(m["type"], 0) * m["money"]
        for m in wave_config["monsters"]
    )
    if result["money_gained"] != expected_money:
        return False, "Money gained mismatch"

    return True, ""


def validate_score(
    attacks: list[dict[str, Any]],
    result: dict[str, Any],
) -> tuple[bool, str]:
    """Validate score based on attack damage.

    Source: SPEC.md L989-995
    Formula: score = sum(floor(sqrt(damage)) for each attack)

    Args:
        attacks: List of attack events, each containing a damage field.
        result: Client-submitted result containing score_gained.

    Returns:
        Tuple of (success, error_message).
    """
    expected_score = sum(int(math.sqrt(a["damage"])) for a in attacks)
    actual_score = result["score_gained"]

    if actual_score != expected_score:
        return False, f"Score mismatch: expected {expected_score}, got {actual_score}"

    return True, ""


def validate_money_balance(new_state: dict[str, Any]) -> tuple[bool, str]:
    """Validate that money balance is non-negative.

    Source: SPEC.md L998-1002
    """
    if new_state["money"] < 0:
        return False, "Insufficient money to complete all operations"
    return True, ""


def validate_buildings_consistency(
    calculated_buildings: list[dict[str, Any]],
    submitted_buildings: list[dict[str, Any]],
) -> tuple[bool, str]:
    """Validate server-calculated buildings match client-submitted buildings.

    Source: SPEC.md L1005-1015

    Only compares id, type, and level fields; ignores others (e.g. position).

    Args:
        calculated_buildings: Server-calculated building list.
        submitted_buildings: Client-submitted building list.

    Returns:
        Tuple of (success, error_message).
    """
    calc_map = {
        b["id"]: (b["type"], b["level"])
        for b in calculated_buildings
    }
    submit_map = {
        b["id"]: (b["type"], b["level"])
        for b in submitted_buildings
    }

    if calc_map != submit_map:
        return False, "Building list mismatch"

    return True, ""


def validate_game_end(session: GameSession) -> tuple[bool, str]:
    """Validate cumulative state consistency at game end.

    Source: SPEC.md L1326-1341

    Validations:
    1. Wave record continuity
    2. Score accumulation consistency

    Edge case: when wave records are empty, expected score is 0;
    passes if session.score == 0.

    Args:
        session: Game session.

    Returns:
        Tuple of (success, error_message).
    """
    wave_records = list(session.waves.order_by("wave_number"))

    for i, record in enumerate(wave_records):
        if record.wave_number != i + 1:
            return False, f"Wave record gap: missing wave {i + 1}"

    expected_score = sum(r.score_gained for r in wave_records)
    if session.score != expected_score:
        return False, f"Score accumulation mismatch: expected {expected_score}, got {session.score}"

    return True, ""


def validate_nickname(nickname: str) -> tuple[bool, str]:
    """Validate player nickname.

    Source: SPEC.md nickname validation rules

    Validations:
    1. Must not be empty (including whitespace-only)
    2. Length must not exceed 32 characters
    3. No control characters (prevents log injection and display issues)
    4. No HTML/script tags (prevents XSS)

    Args:
        nickname: Player nickname.

    Returns:
        Tuple of (success, error_message).
    """
    if not nickname or not nickname.strip():
        return False, "Nickname cannot be empty"
    if len(nickname) > 32:
        return False, "Nickname cannot exceed 32 characters"

    # Reject control characters (0-31, 127) and zero-width Unicode chars
    for char in nickname:
        code = ord(char)
        if code < 32 or code == 127 or (0x200B <= code <= 0x200F):
            return False, "Nickname contains illegal characters"

    # Reject dangerous HTML/script patterns (case-insensitive)
    dangerous_patterns = ["<script", "</script", "<img", "<a ", "<style", "javascript:", "onerror", "onclick"]
    nickname_lower = nickname.lower()
    for pattern in dangerous_patterns:
        if pattern in nickname_lower:
            return False, "Nickname contains illegal characters"

    return True, ""


def validate_damage(
    result: dict[str, Any],
    buildings: list[dict[str, Any]],
    wave_config: dict[str, Any],
    building_config: dict[str, Any],
    monsters_config: dict[str, Any] | None = None,
) -> tuple[bool, str]:
    """Level 2 damage validation: DPS capacity, damage floor.

    Source: SPEC.md L1018-1055

    Validations:
    1. Damage floor: total_damage_dealt >= total_life_destroyed
    2. DPS capacity: total_damage_dealt <= max_dps * duration * 1.1

    Note: Life pool validation is done by validate_cumulative_damage,
    since each monster has independent random life values.

    Args:
        result: Wave result.
        buildings: Building list.
        wave_config: Wave config (unused, kept for backward compatibility).
        building_config: Building config.
        monsters_config: Monster config {id: {type, life, ...}} (unused, kept for extensibility).

    Returns:
        Tuple of (success, error_message).
    """
    # 1. Damage floor validation
    if result["total_damage_dealt"] < result["total_life_destroyed"]:
        return False, "Damage insufficient to kill"

    # 2. DPS capacity validation
    max_dps = sum(
        calc_building_damage(b["type"], building_config[b["type"]]["damage"], b["level"])
        / building_config[b["type"]]["speed"]
        for b in buildings
        if building_config[b["type"]]["speed"] > 0
    )
    max_damage = max_dps * result["wave_duration_frames"]
    if result["total_damage_dealt"] > max_damage * 1.1:  # 10% tolerance
        return False, "DPS capacity exceeded"

    return True, ""


def position_distance(pos1: list, pos2: list) -> int:
    """Calculate Manhattan distance between two positions."""
    return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])


def validate_monster_ids(
    attacks: list[dict[str, Any]],
    monsters_config: dict[str, Any],
) -> tuple[bool, str]:
    """Validate that monster IDs in attacks are server-issued UUIDs.

    Source: SPEC.md L1106-1115, L620-622

    Validates both monsterId (actual hit target) and originalTargetId
    (aimed target at fire time). Due to the "collateral hit" mechanic,
    they may differ, but both must be valid server-issued UUIDs.

    Args:
        attacks: List of attack events.
        monsters_config: Server-issued monster config {id: {type, life, ...}}.

    Returns:
        Tuple of (success, error_message).
    """
    for attack in attacks:
        mid = attack["monsterId"]
        if mid not in monsters_config:
            return False, f"Unknown monsterId: {mid} (not a server-issued UUID)"

        original_tid = attack.get("originalTargetId")
        if original_tid is not None and original_tid not in monsters_config:
            return False, f"Unknown originalTargetId: {original_tid} (not a server-issued UUID)"

    return True, ""


def validate_cumulative_damage(
    attacks: list[dict[str, Any]],
    result: dict[str, Any],
    monsters_config: dict[str, Any],
) -> tuple[bool, str]:
    """Validate cumulative damage is sufficient for killed monsters.

    Source: SPEC.md L1133-1164

    Args:
        attacks: List of attack events.
        result: Wave result.
        monsters_config: Server-issued monster config.

    Returns:
        Tuple of (success, error_message).
    """
    # Group cumulative damage by monsterId
    damage_by_monster: dict[str, int] = {}
    for attack in attacks:
        mid = attack["monsterId"]
        damage_by_monster[mid] = damage_by_monster.get(mid, 0) + attack["damage"]

    # Count kills based on cumulative damage
    killed_by_type = result.get("killed_by_type", {})
    killed_count_by_type: dict[int, int] = {int(k): 0 for k in killed_by_type.keys()}

    for mid, total_damage in damage_by_monster.items():
        monster = monsters_config[mid]
        if total_damage >= monster["life"]:
            killed_count_by_type[monster["type"]] = killed_count_by_type.get(monster["type"], 0) + 1

    # Verify kill counts match
    for monster_type, expected_count in killed_by_type.items():
        actual_count = killed_count_by_type.get(int(monster_type), 0)
        if actual_count != expected_count:
            return False, f"Type {monster_type} kill count mismatch: expected {expected_count}, damage-based count {actual_count}"

    return True, ""


def validate_remaining_monsters(
    attacks: list[dict[str, Any]],
    result: dict[str, Any],
    monsters_config: dict[str, Any],
    monsters_list: list[str] | None = None,
) -> tuple[bool, str]:
    """Validate remaining monster legitimacy.

    Source: SPEC.md remaining monster validation rules

    Validations:
    1. len(remainingMonsterIds) == remaining
    2. No duplicate IDs
    3. Each ID is a valid server-issued UUID
    4. Cumulative damage < life (monster is indeed not killed)
    5. Each ID is within the first ``spawned`` monsters (prevents using unspawned IDs)

    Skipped when remaining == 0 (backward compatible).

    Args:
        attacks: List of attack events.
        result: Wave result containing remaining and remaining_monster_ids.
        monsters_config: Server-issued monster config {id: {type, life, ...}}.
        monsters_list: Ordered monster ID list (optional, for spawned validation).

    Returns:
        Tuple of (success, error_message).
    """
    remaining = result.get("remaining", 0)
    if remaining == 0:
        return True, ""

    remaining_ids = result.get("remaining_monster_ids", [])

    # 1. Count consistency
    if len(remaining_ids) != remaining:
        return False, f"remainingMonsterIds count mismatch: expected {remaining}, got {len(remaining_ids)}"

    # 2. Uniqueness
    if len(remaining_ids) != len(set(remaining_ids)):
        return False, "remainingMonsterIds contains duplicates"

    # Group cumulative damage by monsterId
    damage_by_monster: dict[str, int] = {}
    for attack in attacks:
        mid = attack["monsterId"]
        damage_by_monster[mid] = damage_by_monster.get(mid, 0) + attack["damage"]

    for mid in remaining_ids:
        # 3. ID validity
        if mid not in monsters_config:
            return False, f"Unknown remainingMonsterId: {mid} (not a server-issued UUID)"

        # 4. Remaining monsters must not have lethal cumulative damage
        monster = monsters_config[mid]
        total_damage = damage_by_monster.get(mid, 0)
        if total_damage >= monster["life"]:
            return False, f"Monster {mid} cumulative damage {total_damage} >= life {monster['life']}, should be killed not remaining"

    # 5. Spawned range validation (enabled when monsters_list is provided)
    if monsters_list is not None:
        spawned = result.get("spawned", len(monsters_list))
        spawned_ids = set(monsters_list[:spawned])
        for mid in remaining_ids:
            if mid not in spawned_ids:
                return False, f"Monster {mid} is not among the first {spawned} spawned monsters"

    return True, ""


def validate_attack_range(
    attack: dict[str, Any],
    building: dict[str, Any],
    building_config: dict[str, Any],
) -> tuple[bool, str]:
    """Validate that the original target was within building range at fire time.

    Source: td-obj-building.js:187-204, td-cfg-buildings.js

    Range rules (consistent with original implementation):
    - range: initial range (value at level 1)
    - max_range: range upgrade cap
    - Upgraded range: min(range * 1.2^(level-1), max_range)
    - No minimum range restriction

    Args:
        attack: Attack event.
        building: Building info.
        building_config: Building config.

    Returns:
        Tuple of (success, error_message).
    """
    bx, by = building["position"]
    tx, ty = attack["originalTargetPosition"]

    distance = math.sqrt((bx - tx) ** 2 + (by - ty) ** 2)

    base_range = building_config[building["type"]]["range"]
    max_range = building_config[building["type"]]["max_range"]
    level_factor = 1.2 ** (building["level"] - 1)
    current_range = min(base_range * level_factor, max_range)

    if distance > current_range + 1:  # 1 grid tolerance (monster may be at grid edge)
        return False, f"Target out of range: building {building['id']} range {current_range:.1f}, target distance {distance:.1f}"

    return True, ""


def _get_damage_multiplier(building_type: str, current_level: int) -> float:
    """Get damage upgrade multiplier for a building at a given level.

    Source: SPEC.md L120-122, td-cfg-buildings.js:51-53

    Rules:
    - Default: x1.2 per level
    - cannon: x1.2 for first 11 upgrades, x1.3 from upgrade 12 onward
    - HMG: x1.3 per level

    The original implementation uses 0-based levels (level=0 when built).
    This implementation uses 1-based levels (level=1 when built), so the
    cannon threshold is adjusted from ``old_level <= 10`` to ``current_level > 11``.

    Args:
        building_type: Building type.
        current_level: Current level (1-based).

    Returns:
        Damage multiplier.
    """
    if building_type == "HMG":
        return 1.3
    if building_type == "cannon" and current_level > 11:
        return 1.3
    return 1.2


def calc_building_damage(
    building_type: str,
    base_damage: int,
    level: int,
) -> int:
    """Calculate building damage at a given level.

    Source: SPEC.md L120-122, td-obj-building.js:258-272

    Maintains float precision during calculation, truncates only on return.
    This matches the original ``_upgrade_records`` mechanism where float
    values are stored during upgrades and only ``Math.floor()``'d on final
    assignment.

    Args:
        building_type: Building type.
        base_damage: Base damage.
        level: Target level.

    Returns:
        Calculated damage (floored).
    """
    damage = float(base_damage)
    for current_level in range(1, level):
        multiplier = _get_damage_multiplier(building_type, current_level)
        damage = damage * multiplier
    return int(damage)


def validate_damage_value(
    attack: dict[str, Any],
    building: dict[str, Any],
    building_config: dict[str, Any],
) -> tuple[bool, str]:
    """Validate that damage value is within building limits.

    Source: SPEC.md L1201-1222

    Args:
        attack: Attack event.
        building: Building info.
        building_config: Building config.

    Returns:
        Tuple of (success, error_message).
    """
    building_type = building["type"]
    base_damage = building_config[building_type]["damage"]
    level = building["level"]

    expected_damage = calc_building_damage(building_type, base_damage, level)

    if attack["damage"] > expected_damage:
        return False, f"Damage exceeds building limit: {attack['damage']} > {expected_damage}"
    if attack["damage"] < 1:
        return False, "Damage cannot be less than 1"

    return True, ""


def _is_moving_toward_exit(
    first_pos: list[int],
    last_pos: list[int],
    exit_pos: list[int],
) -> bool:
    """Check if a monster is moving toward the exit on at least one axis.

    In serpentine paths, a monster may move away from the exit on one axis
    but should approach it on the other.
    """
    dx_first = exit_pos[0] - first_pos[0]
    dx_last = exit_pos[0] - last_pos[0]
    dy_first = exit_pos[1] - first_pos[1]
    dy_last = exit_pos[1] - last_pos[1]

    x_toward = abs(dx_last) <= abs(dx_first)
    y_toward = abs(dy_last) <= abs(dy_first)

    return x_toward or y_toward


def validate_monster_paths(
    attacks: list[dict[str, Any]],
    map_config: dict[str, Any],
) -> tuple[bool, str]:
    """Validate monster path reasonability.

    Source: SPEC.md L1225-1258

    Compares Manhattan distance to exit between first and last attack
    positions. Allows tolerance for legitimate detours (serpentine paths
    from player-built walls). Additionally checks movement direction:
    at least one axis should show progress toward the exit.

    Args:
        attacks: List of attack events.
        map_config: Map configuration.

    Returns:
        Tuple of (success, error_message).
    """
    exit_pos = map_config["exit"]
    width = map_config.get("width", 16)
    height = map_config.get("height", 16)
    tolerance = max(width, height) - 1

    # Group attacks by monster
    monster_attacks: dict[str, list[dict]] = {}
    for attack in attacks:
        mid = attack["monsterId"]
        if mid not in monster_attacks:
            monster_attacks[mid] = []
        monster_attacks[mid].append(attack)

    for mid, atks in monster_attacks.items():
        atks.sort(key=lambda a: a["frame"])

        if len(atks) < 2:
            continue

        first_pos = atks[0]["monsterPosition"]
        last_pos = atks[-1]["monsterPosition"]

        first_to_exit = position_distance(first_pos, exit_pos)
        last_to_exit = position_distance(last_pos, exit_pos)

        # Check 1: distance must not increase beyond tolerance
        if last_to_exit > first_to_exit + tolerance:
            return False, f"Monster {mid} path anomaly: moving away from exit"

        # Check 2: if distance increased, at least one axis should move toward exit
        if last_to_exit > first_to_exit:
            if not _is_moving_toward_exit(first_pos, last_pos, exit_pos):
                return False, f"Monster {mid} path anomaly: both axes moving away from exit"

    return True, ""


def validate_attacks(
    attacks: list[dict[str, Any]],
    buildings: list[dict[str, Any]],
    result: dict[str, Any],
    building_config: dict[str, Any],
    map_config: dict[str, Any],
    monsters_config: dict[str, Any],
) -> tuple[bool, str]:
    """Level 2 attack event validation: damage consistency, range, path, cumulative damage.

    Source: SPEC.md L1061-1118

    Args:
        attacks: List of attack events.
        buildings: Building list.
        result: Wave result.
        building_config: Building config.
        map_config: Map configuration.
        monsters_config: Server-issued monster config.

    Returns:
        Tuple of (success, error_message).
    """
    building_map = {b["id"]: b for b in buildings}

    # 1. Damage sum consistency
    total_damage = sum(a["damage"] for a in attacks)
    if total_damage != result["total_damage_dealt"]:
        return False, f"Damage sum mismatch: attacks {total_damage}, result {result['total_damage_dealt']}"

    # 2. Attack frame ordering
    for i in range(1, len(attacks)):
        if attacks[i]["frame"] < attacks[i - 1]["frame"]:
            return False, "Attack frame ordering violation"

    # 3. Monster ID validation
    ok, err = validate_monster_ids(attacks, monsters_config)
    if not ok:
        return False, err

    # 4. Per-attack validation
    for attack in attacks:
        building = building_map.get(attack["buildingId"])
        if not building:
            return False, f"Unknown building: {attack['buildingId']}"

        ok, err = validate_attack_range(attack, building, building_config)
        if not ok:
            return False, err

        ok, err = validate_damage_value(attack, building, building_config)
        if not ok:
            return False, err

    # 5. Cumulative damage validation
    ok, err = validate_cumulative_damage(attacks, result, monsters_config)
    if not ok:
        return False, err

    # 6. Path validation (log only, does not block)
    # Monsters have a 10% chance of random re-pathing, and players can remove
    # walls and block old paths causing monsters to turn around. These are
    # legitimate behaviors that may cause monsters to temporarily move away
    # from the exit.
    #
    # TODO: Combine with building sell/build operations to assess timing
    # reasonability; this is essentially trading gold for score.
    ok, err = validate_monster_paths(attacks, map_config)
    if not ok:
        logger.warning("Path validation anomaly: %s", err)

    return True, ""


def analyze_statistics(
    session: GameSession,
    result: dict[str, Any],
    money_spent: int,
) -> None:
    """Level 4 statistical analysis: detect anomalous behavior from historical data.

    Source: SPEC.md L1254-1294

    Detections:
    1. Kill rate spike: historical < 0.5 and current > 0.95
    2. Resource efficiency spike: current > historical * 3

    Log-only; does not affect validation results.

    Args:
        session: Game session.
        result: Current wave result.
        money_spent: Money spent in current wave.
    """
    wave_records = list(session.waves.all())
    if len(wave_records) < 3:
        return  # Insufficient data

    # Historical average kill rate
    hist_killed = sum(r.killed for r in wave_records)
    hist_total = sum(r.killed + r.passed for r in wave_records)
    hist_kill_rate = hist_killed / max(hist_total, 1)

    # Current kill rate
    curr_total = result["killed"] + result["passed"]
    curr_kill_rate = result["killed"] / max(curr_total, 1)

    if hist_kill_rate < 0.5 and curr_kill_rate > 0.95:
        logger.warning(
            "Kill rate anomaly spike",
            extra={
                "wave": session.wave_count + 1,
                "session_id": str(session.id),
                "hist_kill_rate": hist_kill_rate,
                "curr_kill_rate": curr_kill_rate,
            },
        )

    # Efficiency spike detection: only when both current and historical have spending.
    # No current spending: normal strategy to invest early then stop building.
    # No historical spending: no meaningful baseline for efficiency.
    if money_spent > 0:
        hist_score = sum(r.score_gained for r in wave_records)
        hist_cost = sum(r.money_spent for r in wave_records)

        if hist_cost > 0:
            hist_efficiency = hist_score / hist_cost
            curr_efficiency = result["score_gained"] / money_spent

            if curr_efficiency > hist_efficiency * 3:
                logger.warning(
                    "Resource efficiency anomaly spike",
                    extra={
                        "wave": session.wave_count + 1,
                        "session_id": str(session.id),
                        "hist_efficiency": hist_efficiency,
                        "curr_efficiency": curr_efficiency,
                    },
                )
