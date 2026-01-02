"""验证器模块.

包含游戏数据验证逻辑，分为多个级别：
- Level 1：基础验证（数量一致性、收益验证）
- Level 2：伤害验证（DPS 容量、生命池）
- Level 2+：攻击事件验证（射程、攻速）
- Level 4：统计分析（异常检测）
"""

import math
from typing import Any

from game.models import GameSession


def validate_wave_continuity(
    session: GameSession,
    wave_number: int,
) -> tuple[bool, str]:
    """验证波次连续性.

    来源：SPEC.md L942-946

    Args:
        session: 游戏会话
        wave_number: 提交的波次号

    Returns:
        (成功标志, 错误信息)
    """
    expected = session.wave_count + 1
    if wave_number != expected:
        return False, f"波次不连续: 期望 {expected}, 收到 {wave_number}"
    return True, ""


def validate_basic(
    result: dict[str, Any],
    wave_config: dict[str, Any],
) -> tuple[bool, str]:
    """基础验证：收益上限、数量一致性.

    来源：SPEC.md L956-986

    验证项目：
    1. killed_by_type 总和 == killed
    2. 每种怪物击杀数 <= 配置数量
    3. killed + passed == 波次怪物总数
    4. money_gained == 基于击杀计算的金钱

    Args:
        result: 客户端提交的波次结果
        wave_config: 波次配置

    Returns:
        (成功标志, 错误信息)
    """
    # JSON 反序列化后键可能是字符串，统一转换为整数
    killed_by_type = {int(k): v for k, v in result["killed_by_type"].items()}
    wave_monsters = {m["type"]: m for m in wave_config["monsters"]}

    # 1. killed_by_type 一致性验证
    if sum(killed_by_type.values()) != result["killed"]:
        return False, "击杀数量不一致"

    # 2. 每种怪物击杀数不能超过波次配置
    for monster_type, killed_count in killed_by_type.items():
        if monster_type not in wave_monsters:
            return False, f"未知的怪物类型: {monster_type}"
        if killed_count > wave_monsters[monster_type]["count"]:
            return False, f"怪物 {monster_type} 击杀数超出配置"

    # 3. 总数量一致性验证
    total_monsters = sum(m["count"] for m in wave_config["monsters"])
    if result["killed"] + result["passed"] != total_monsters:
        return False, "怪物数量不一致"

    # 4. 金钱收益验证
    expected_money = sum(
        killed_by_type.get(m["type"], 0) * m["money"]
        for m in wave_config["monsters"]
    )
    if result["money_gained"] != expected_money:
        return False, "金钱收益不匹配"

    return True, ""


def validate_score(
    attacks: list[dict[str, Any]],
    result: dict[str, Any],
) -> tuple[bool, str]:
    """验证得分：基于攻击伤害计算.

    来源：SPEC.md L989-995
    公式：score = sum(floor(sqrt(damage)) for each attack)

    Args:
        attacks: 攻击事件列表，每个包含 damage 字段
        result: 客户端提交的结果，包含 score_gained 字段

    Returns:
        (成功标志, 错误信息)
    """
    expected_score = sum(int(math.sqrt(a["damage"])) for a in attacks)
    actual_score = result["score_gained"]

    if actual_score != expected_score:
        return False, f"分数不匹配: 期望 {expected_score}, 实际 {actual_score}"

    return True, ""


def validate_money_balance(new_state: dict[str, Any]) -> tuple[bool, str]:
    """验证金钱余额不为负.

    来源：SPEC.md L998-1002

    Args:
        new_state: 计算后的新状态，包含 money 字段

    Returns:
        (成功标志, 错误信息)
    """
    if new_state["money"] < 0:
        return False, "金钱余额不足，无法完成所有操作"
    return True, ""


def validate_buildings_consistency(
    calculated_buildings: list[dict[str, Any]],
    submitted_buildings: list[dict[str, Any]],
) -> tuple[bool, str]:
    """验证服务端计算的建筑列表与客户端提交的一致.

    来源：SPEC.md L1005-1015

    只比较 id、type、level 三个字段，忽略其他字段（如 position）。

    Args:
        calculated_buildings: 服务端计算的建筑列表
        submitted_buildings: 客户端提交的建筑列表

    Returns:
        (成功标志, 错误信息)
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
        return False, "建筑列表不一致"

    return True, ""


def validate_game_end(session: GameSession) -> tuple[bool, str]:
    """验证累计状态一致性.

    来源：SPEC.md L1326-1341

    验证项目：
    1. 波次记录连续性
    2. 分数累计一致性

    Args:
        session: 游戏会话

    Returns:
        (成功标志, 错误信息)
    """
    wave_records = list(session.waves.order_by("wave_number"))

    for i, record in enumerate(wave_records):
        if record.wave_number != i + 1:
            return False, f"波次记录不连续: 缺少波次 {i + 1}"

    expected_score = sum(r.score_gained for r in wave_records)
    if session.score != expected_score:
        return False, f"分数累计不一致: 期望 {expected_score}, 实际 {session.score}"

    return True, ""


def validate_nickname(nickname: str) -> tuple[bool, str]:
    """验证昵称.

    Args:
        nickname: 玩家昵称

    Returns:
        (成功标志, 错误信息)
    """
    if not nickname:
        return False, "昵称不能为空"
    if len(nickname) > 32:
        return False, "昵称长度不能超过 32 个字符"
    return True, ""


def validate_damage(
    result: dict[str, Any],
    buildings: list[dict[str, Any]],
    wave_config: dict[str, Any],
    building_config: dict[str, Any],
) -> tuple[bool, str]:
    """Level 2 伤害验证：生命池、DPS 容量.

    来源：SPEC.md L1018-1055

    验证项目：
    1. 生命池验证：total_life_destroyed == sum(killed_by_type[t] * monster[t].life)
    2. 伤害下限验证：total_damage_dealt >= total_life_destroyed
    3. DPS 容量验证：total_damage_dealt <= max_dps * duration * 1.1

    Args:
        result: 波次结果
        buildings: 建筑列表
        wave_config: 波次配置
        building_config: 建筑配置

    Returns:
        (成功标志, 错误信息)
    """
    killed_by_type = {int(k): v for k, v in result["killed_by_type"].items()}

    # 1. 生命池验证
    expected_life = sum(
        killed_by_type.get(m["type"], 0) * m["life"]
        for m in wave_config["monsters"]
    )
    if result["total_life_destroyed"] != expected_life:
        return False, f"生命池验证失败: 期望 {expected_life}, 实际 {result['total_life_destroyed']}"

    # 2. 伤害下限验证
    if result["total_damage_dealt"] < result["total_life_destroyed"]:
        return False, "伤害值不足以击杀"

    # 3. DPS 容量验证
    max_dps = sum(
        building_config[b["type"]]["damage"] * b["level"] / building_config[b["type"]]["speed"]
        for b in buildings
        if building_config[b["type"]]["speed"] > 0
    )
    max_damage = max_dps * result["wave_duration_frames"]
    if result["total_damage_dealt"] > max_damage * 1.1:  # 10% 容差
        return False, "DPS 容量超限"

    return True, ""


def position_distance(pos1: list, pos2: list) -> int:
    """计算两个位置之间的曼哈顿距离.

    Args:
        pos1: 位置 1 [x, y]
        pos2: 位置 2 [x, y]

    Returns:
        曼哈顿距离
    """
    return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])


def validate_monster_ids(
    attacks: list[dict[str, Any]],
    monsters_config: dict[str, Any],
) -> tuple[bool, str]:
    """验证攻击事件中的 monsterId 是否是服务端下发的有效 UUID.

    来源：SPEC.md L1121-1131

    Args:
        attacks: 攻击事件列表
        monsters_config: 服务端下发的怪物配置 {id: {type, life, ...}}

    Returns:
        (成功标志, 错误信息)
    """
    for attack in attacks:
        mid = attack["monsterId"]
        if mid not in monsters_config:
            return False, f"未知的 monsterId: {mid}（不是服务端下发的 UUID）"
    return True, ""


def validate_cumulative_damage(
    attacks: list[dict[str, Any]],
    result: dict[str, Any],
    monsters_config: dict[str, Any],
) -> tuple[bool, str]:
    """验证击杀怪物的累计伤害是否足够.

    来源：SPEC.md L1133-1164

    Args:
        attacks: 攻击事件列表
        result: 波次结果
        monsters_config: 服务端下发的怪物配置

    Returns:
        (成功标志, 错误信息)
    """
    # 按 monsterId 分组计算累计伤害
    damage_by_monster: dict[str, int] = {}
    for attack in attacks:
        mid = attack["monsterId"]
        damage_by_monster[mid] = damage_by_monster.get(mid, 0) + attack["damage"]

    # 验证被击杀怪物的累计伤害
    killed_by_type = result.get("killed_by_type", {})
    killed_count_by_type: dict[int, int] = {int(k): 0 for k in killed_by_type.keys()}

    for mid, total_damage in damage_by_monster.items():
        monster = monsters_config[mid]
        monster_life = monster["life"]

        if total_damage >= monster_life:
            # 怪物应被击杀
            killed_count_by_type[monster["type"]] = killed_count_by_type.get(monster["type"], 0) + 1

    # 验证击杀数量一致性
    for monster_type, expected_count in killed_by_type.items():
        actual_count = killed_count_by_type.get(int(monster_type), 0)
        if actual_count != expected_count:
            return False, f"类型 {monster_type} 击杀数不一致: 期望 {expected_count}, 实际根据伤害计算为 {actual_count}"

    return True, ""


def validate_attack_range(
    attack: dict[str, Any],
    building: dict[str, Any],
    building_config: dict[str, Any],
) -> tuple[bool, str]:
    """验证发射时的原始目标是否在建筑射程内.

    来源：SPEC.md L1167-1198

    射程规则：
    - range: 最小射程（太近的目标无法攻击）
    - max_range: 最大射程（太远的目标无法攻击）
    - 升级后射程略微增加（level ** 0.1）

    Args:
        attack: 攻击事件
        building: 建筑信息
        building_config: 建筑配置

    Returns:
        (成功标志, 错误信息)
    """
    bx, by = building["position"]
    tx, ty = attack["originalTargetPosition"]

    distance = math.sqrt((bx - tx) ** 2 + (by - ty) ** 2)
    level_factor = building["level"] ** 0.1
    min_range = building_config[building["type"]]["range"] * level_factor
    max_range = building_config[building["type"]]["max_range"] * level_factor

    if distance < min_range - 1:  # 1 格容差
        return False, f"目标太近: 建筑 {building['id']} 最小射程 {min_range:.1f}, 目标距离 {distance:.1f}"

    if distance > max_range + 1:  # 1 格容差
        return False, f"目标太远: 建筑 {building['id']} 最大射程 {max_range:.1f}, 目标距离 {distance:.1f}"

    return True, ""


def validate_damage_value(
    attack: dict[str, Any],
    building: dict[str, Any],
    building_config: dict[str, Any],
) -> tuple[bool, str]:
    """验证伤害值是否合法.

    来源：SPEC.md L1201-1222

    Args:
        attack: 攻击事件
        building: 建筑信息
        building_config: 建筑配置

    Returns:
        (成功标志, 错误信息)
    """
    base_damage = building_config[building["type"]]["damage"]
    level = building["level"]

    # 计算建筑在当前等级的伤害（升级规则：每级 x1.2）
    expected_damage = base_damage
    for _ in range(1, level):
        expected_damage = int(expected_damage * 1.2)

    if attack["damage"] > expected_damage:
        return False, f"伤害值超过建筑上限: {attack['damage']} > {expected_damage}"
    if attack["damage"] < 1:
        return False, "伤害值不能小于 1"

    return True, ""


def validate_monster_paths(
    attacks: list[dict[str, Any]],
    map_config: dict[str, Any],
) -> tuple[bool, str]:
    """验证怪物路径合理性.

    来源：SPEC.md L1225-1258

    Args:
        attacks: 攻击事件列表
        map_config: 地图配置

    Returns:
        (成功标志, 错误信息)
    """
    exit_pos = map_config["exit"]

    # 按怪物分组
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

        # 计算到出口的距离
        first_to_exit = position_distance(first_pos, exit_pos)
        last_to_exit = position_distance(last_pos, exit_pos)

        # 怪物应该从入口向出口移动
        if last_to_exit > first_to_exit + 3:  # 允许 3 格容差
            return False, f"怪物 {mid} 路径异常: 远离出口方向移动"

    return True, ""


def validate_attacks(
    attacks: list[dict[str, Any]],
    buildings: list[dict[str, Any]],
    result: dict[str, Any],
    building_config: dict[str, Any],
    map_config: dict[str, Any],
    monsters_config: dict[str, Any],
) -> tuple[bool, str]:
    """Level 2+ 攻击事件验证：伤害一致性、射程验证、路径合理性、累计伤害验证.

    来源：SPEC.md L1061-1118

    Args:
        attacks: 攻击事件列表
        buildings: 建筑列表
        result: 波次结果
        building_config: 建筑配置
        map_config: 地图配置
        monsters_config: 服务端下发的怪物配置

    Returns:
        (成功标志, 错误信息)
    """
    building_map = {b["id"]: b for b in buildings}

    # 1. 伤害总和一致性
    total_damage = sum(a["damage"] for a in attacks)
    if total_damage != result["total_damage_dealt"]:
        return False, f"伤害总和不一致: 攻击记录 {total_damage}, 结果 {result['total_damage_dealt']}"

    # 2. 攻击帧号时序验证
    for i in range(1, len(attacks)):
        if attacks[i]["frame"] < attacks[i - 1]["frame"]:
            return False, "攻击帧号时序错误"

    # 3. 怪物 ID 有效性验证
    ok, err = validate_monster_ids(attacks, monsters_config)
    if not ok:
        return False, err

    # 4. 逐条验证
    for attack in attacks:
        building = building_map.get(attack["buildingId"])
        if not building:
            return False, f"未知建筑: {attack['buildingId']}"

        # 射程验证
        ok, err = validate_attack_range(attack, building, building_config)
        if not ok:
            return False, err

        # 伤害值合法性验证
        ok, err = validate_damage_value(attack, building, building_config)
        if not ok:
            return False, err

    # 5. 累计伤害验证
    ok, err = validate_cumulative_damage(attacks, result, monsters_config)
    if not ok:
        return False, err

    # 6. 路径合理性验证
    ok, err = validate_monster_paths(attacks, map_config)
    if not ok:
        return False, err

    return True, ""
