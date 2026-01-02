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
