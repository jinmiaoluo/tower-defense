"""验证器单元测试."""

from unittest.mock import Mock, patch

from game.validators import (
    analyze_statistics,
    calc_building_damage,
    position_distance,
    validate_attack_range,
    validate_attacks,
    validate_basic,
    validate_buildings_consistency,
    validate_cumulative_damage,
    validate_damage,
    validate_damage_value,
    validate_game_end,
    validate_money_balance,
    validate_monster_ids,
    validate_monster_paths,
    validate_nickname,
    validate_remaining_monsters,
    validate_score,
    validate_wave_continuity,
)


class TestValidateWaveContinuity:
    """波次连续性验证测试."""

    def test_first_wave_valid(self):
        """第一波：wave_count=0，提交 wave_number=1."""
        session = Mock()
        session.wave_count = 0
        ok, err = validate_wave_continuity(session, 1)
        assert ok is True
        assert err == ""

    def test_second_wave_valid(self):
        """第二波：wave_count=1，提交 wave_number=2."""
        session = Mock()
        session.wave_count = 1
        ok, err = validate_wave_continuity(session, 2)
        assert ok is True

    def test_skip_wave_invalid(self):
        """跳波：wave_count=1，提交 wave_number=3."""
        session = Mock()
        session.wave_count = 1
        ok, err = validate_wave_continuity(session, 3)
        assert ok is False
        assert "期望 2" in err
        assert "收到 3" in err

    def test_repeat_wave_invalid(self):
        """重复提交：wave_count=2，提交 wave_number=2."""
        session = Mock()
        session.wave_count = 2
        ok, err = validate_wave_continuity(session, 2)
        assert ok is False
        assert "期望 3" in err


class TestValidateBasic:
    """基础验证测试."""

    def test_success_single_type(self):
        """成功：单一怪物类型."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_success_multiple_types(self):
        """成功：多种怪物类型."""
        result = {
            "killed": 5,
            "killed_by_type": {0: 3, 1: 2},
            "passed": 0,
            "money_gained": 31,  # 3*5 + 2*8 = 31
        }
        wave_config = {
            "monsters": [
                {"type": 0, "count": 3, "money": 5},
                {"type": 1, "count": 2, "money": 8},
            ]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_success_with_passed(self):
        """成功：部分怪物穿过终点."""
        result = {
            "killed": 2,
            "killed_by_type": {0: 2},
            "passed": 1,
            "money_gained": 10,  # 2*5 = 10
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_killed_sum_mismatch(self):
        """失败：killed 与 killed_by_type 总和不一致."""
        result = {
            "killed": 5,  # 错误：实际 3
            "killed_by_type": {0: 3},
            "passed": 0,
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "击杀数量不一致" in err

    def test_unknown_monster_type(self):
        """失败：未知的怪物类型."""
        result = {
            "killed": 3,
            "killed_by_type": {99: 3},  # 不存在的类型
            "passed": 0,
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "未知的怪物类型" in err

    def test_killed_exceeds_config(self):
        """失败：击杀数超出配置数量."""
        result = {
            "killed": 5,
            "killed_by_type": {0: 5},  # 配置只有 3 个
            "passed": 0,
            "money_gained": 25,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "击杀数超出配置" in err

    def test_total_mismatch(self):
        """失败：killed + passed + remaining != 总数."""
        result = {
            "killed": 2,
            "killed_by_type": {0: 2},
            "passed": 0,  # 总数应为 3
            "remaining": 0,
            "money_gained": 10,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "怪物数量不一致" in err

    def test_success_with_remaining(self):
        """成功：提前结束场景，场上有 remaining 怪物."""
        result = {
            "killed": 1,
            "killed_by_type": {0: 1},
            "passed": 0,
            "remaining": 2,  # 2 只在场怪物
            "money_gained": 5,  # 只算击杀的
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_success_remaining_multiple_types(self):
        """成功：提前结束场景，多种怪物类型都有 remaining."""
        result = {
            "killed": 2,
            "killed_by_type": {0: 1, 1: 1},
            "passed": 1,
            "remaining": 2,  # 还有 2 只在场
            "money_gained": 13,  # 1*5 + 1*8 = 13
        }
        wave_config = {
            "monsters": [
                {"type": 0, "count": 2, "money": 5},
                {"type": 1, "count": 3, "money": 8},
            ]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_success_remaining_default_zero(self):
        """成功：remaining 字段默认为 0（向后兼容）."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            # 不提供 remaining 字段
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_remaining_exceeds_limit(self):
        """失败：remaining 数量过大，超出总数."""
        result = {
            "killed": 1,
            "killed_by_type": {0: 1},
            "passed": 0,
            "remaining": 10,  # 超过总数 3
            "money_gained": 5,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "怪物数量不一致" in err

    def test_remaining_negative(self):
        """失败：remaining 为负数."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            "remaining": -1,  # 负数
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "remaining 不能为负数" in err

    def test_money_mismatch(self):
        """失败：金钱收益不匹配."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            "money_gained": 100,  # 错误值，应为 15
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "金钱收益不匹配" in err

    def test_success_with_spawned_partial(self):
        """成功：提前结束场景，spawned < total（部分怪物未生成）.

        场景：第 2 波配置有 2 只怪物，但只生成了 1 只就提前结束
        这对应 td-obj-map.js 中怪物逐帧生成的机制
        """
        result = {
            "killed": 0,
            "killed_by_type": {},
            "passed": 0,
            "remaining": 1,
            "spawned": 1,  # 只生成了 1 只
            "money_gained": 0,
        }
        wave_config = {
            "monsters": [
                {"type": 0, "count": 1, "money": 5},
                {"type": 1, "count": 1, "money": 8},
            ]  # total = 2
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_success_spawned_equals_total(self):
        """成功：spawned == total（正常情况）."""
        result = {
            "killed": 2,
            "killed_by_type": {0: 1, 1: 1},
            "passed": 0,
            "remaining": 0,
            "spawned": 2,  # 等于 total
            "money_gained": 13,
        }
        wave_config = {
            "monsters": [
                {"type": 0, "count": 1, "money": 5},
                {"type": 1, "count": 1, "money": 8},
            ]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_success_spawned_default_to_total(self):
        """成功：未提供 spawned 时默认为 total_monsters（向后兼容）."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            # 不提供 spawned 字段
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_spawned_exceeds_total(self):
        """失败：spawned > total_monsters."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            "spawned": 10,  # 超过配置的 3 只
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "spawned 超过波次怪物总数" in err

    def test_spawned_negative(self):
        """失败：spawned 为负数."""
        result = {
            "killed": 0,
            "killed_by_type": {},
            "passed": 0,
            "spawned": -1,
            "money_gained": 0,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "spawned 不能为负数" in err

    def test_killed_plus_passed_plus_remaining_not_equal_spawned(self):
        """失败：killed + passed + remaining != spawned."""
        result = {
            "killed": 1,
            "killed_by_type": {0: 1},
            "passed": 0,
            "remaining": 0,  # 总计 1
            "spawned": 2,     # 但声称生成了 2 只
            "money_gained": 5,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "怪物数量不一致" in err

    def test_real_bug_scenario(self):
        """真实 bug 场景复现：第 2 波只生成 1 只怪物就提前结束.

        复现步骤：
        1. 第一波怪物消灭后
        2. 第二波怪物出现的短时间内立即暂停
        3. 提前结束游戏
        """
        result = {
            "killed": 0,
            "killed_by_type": {},
            "passed": 0,
            "remaining": 1,
            "spawned": 1,  # 只生成了 1 只
            "money_gained": 0,
        }
        wave_config = {
            "monsters": [
                {"type": 0, "count": 1, "money": 5},
                {"type": 1, "count": 1, "money": 8},
            ]  # total = 2，但 spawned = 1
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True


class TestValidateScore:
    """得分验证测试."""

    def test_success_single_attack(self):
        """成功：单次攻击."""
        attacks = [{"damage": 16}]  # floor(sqrt(16)) = 4
        result = {"score_gained": 4}
        ok, err = validate_score(attacks, result)
        assert ok is True

    def test_success_multiple_attacks(self):
        """成功：多次攻击.

        damage=16 -> sqrt=4
        damage=25 -> sqrt=5
        damage=10 -> sqrt=3 (floor(3.16))
        total = 4+5+3 = 12
        """
        attacks = [
            {"damage": 16},
            {"damage": 25},
            {"damage": 10},
        ]
        result = {"score_gained": 12}
        ok, err = validate_score(attacks, result)
        assert ok is True

    def test_success_zero_damage(self):
        """成功：零伤害攻击."""
        attacks = [{"damage": 0}]  # floor(sqrt(0)) = 0
        result = {"score_gained": 0}
        ok, err = validate_score(attacks, result)
        assert ok is True

    def test_success_no_attacks(self):
        """成功：无攻击."""
        attacks = []
        result = {"score_gained": 0}
        ok, err = validate_score(attacks, result)
        assert ok is True

    def test_score_mismatch(self):
        """失败：分数不匹配."""
        attacks = [{"damage": 16}]  # 期望 4
        result = {"score_gained": 10}  # 错误
        ok, err = validate_score(attacks, result)
        assert ok is False
        assert "期望 4" in err
        assert "实际 10" in err

    def test_complex_calculation(self):
        """复杂计算：验证 floor 行为."""
        attacks = [
            {"damage": 2},   # floor(1.41) = 1
            {"damage": 3},   # floor(1.73) = 1
            {"damage": 5},   # floor(2.24) = 2
            {"damage": 99},  # floor(9.95) = 9
        ]
        expected = 1 + 1 + 2 + 9  # = 13
        result = {"score_gained": expected}
        ok, err = validate_score(attacks, result)
        assert ok is True


class TestValidateMoneyBalance:
    """金钱余额验证测试."""

    def test_positive_balance(self):
        """成功：正余额."""
        new_state = {"money": 100}
        ok, err = validate_money_balance(new_state)
        assert ok is True

    def test_zero_balance(self):
        """成功：零余额."""
        new_state = {"money": 0}
        ok, err = validate_money_balance(new_state)
        assert ok is True

    def test_negative_balance(self):
        """失败：负余额."""
        new_state = {"money": -1}
        ok, err = validate_money_balance(new_state)
        assert ok is False
        assert "余额不足" in err


class TestValidateBuildingsConsistency:
    """建筑一致性验证测试."""

    def test_empty_lists(self):
        """成功：两个空列表."""
        ok, err = validate_buildings_consistency([], [])
        assert ok is True

    def test_single_building_match(self):
        """成功：单个建筑匹配."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [{"id": "b-001", "type": "cannon", "level": 1}]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is True

    def test_multiple_buildings_match(self):
        """成功：多个建筑匹配（顺序可以不同）."""
        calculated = [
            {"id": "b-001", "type": "cannon", "level": 1},
            {"id": "b-002", "type": "LMG", "level": 2},
        ]
        submitted = [
            {"id": "b-002", "type": "LMG", "level": 2},
            {"id": "b-001", "type": "cannon", "level": 1},
        ]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is True

    def test_level_mismatch(self):
        """失败：等级不匹配."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [{"id": "b-001", "type": "cannon", "level": 2}]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is False
        assert "建筑列表不一致" in err

    def test_type_mismatch(self):
        """失败：类型不匹配."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [{"id": "b-001", "type": "LMG", "level": 1}]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is False
        assert "建筑列表不一致" in err

    def test_missing_building(self):
        """失败：缺少建筑."""
        calculated = [
            {"id": "b-001", "type": "cannon", "level": 1},
            {"id": "b-002", "type": "LMG", "level": 1},
        ]
        submitted = [{"id": "b-001", "type": "cannon", "level": 1}]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is False

    def test_extra_building(self):
        """失败：多余建筑."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [
            {"id": "b-001", "type": "cannon", "level": 1},
            {"id": "b-002", "type": "LMG", "level": 1},
        ]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is False

    def test_ignores_extra_fields(self):
        """成功：忽略额外字段（如 position）."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        ]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is True


class TestValidateDamage:
    """Level 2 伤害验证测试."""

    def test_success_single_monster_type(self):
        """成功：单一怪物类型，生命池匹配."""
        result = {
            "killed_by_type": {0: 3},
            "total_life_destroyed": 150,  # 3 * 50 = 150
            "total_damage_dealt": 180,
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "life": 50, "money": 5}]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is True
        assert err == ""

    def test_success_multiple_monster_types(self):
        """成功：多种怪物类型."""
        result = {
            "killed_by_type": {0: 2, 1: 1},
            "total_life_destroyed": 150,  # 2*50 + 1*50 = 150
            "total_damage_dealt": 200,
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
            {"id": "b-002", "type": "LMG", "level": 1, "position": [6, 6]},
        ]
        wave_config = {
            "monsters": [
                {"type": 0, "count": 2, "life": 50, "money": 5},
                {"type": 1, "count": 1, "life": 50, "money": 8},
            ]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
            "LMG": {"damage": 5, "speed": 3},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is True

    def test_damage_insufficient(self):
        """Fail: Damage insufficient to kill."""
        result = {
            "killed_by_type": {0: 3},
            "total_life_destroyed": 150,
            "total_damage_dealt": 100,  # Less than 150, insufficient to kill
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "life": 50, "money": 5}]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is False
        assert "Damage insufficient to kill" in err

    def test_dps_capacity_exceeded(self):
        """Fail: DPS capacity exceeded."""
        # Building: cannon level 1, damage=12, speed=2
        # max_dps = 12 * 1 / 2 = 6
        # Max damage in 100 frames = 6 * 100 = 600
        # 10% tolerance = 660
        result = {
            "killed_by_type": {0: 3},
            "total_life_destroyed": 150,
            "total_damage_dealt": 1000,  # Exceeds 660
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "life": 50, "money": 5}]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is False
        assert "DPS capacity exceeded" in err

    def test_dps_within_tolerance(self):
        """成功：伤害在 10% 容差内."""
        # max_dps = 12 / 2 = 6
        # max_damage = 6 * 100 = 600
        # 允许 10% 容差 = 660
        result = {
            "killed_by_type": {0: 3},
            "total_life_destroyed": 150,
            "total_damage_dealt": 650,  # 在容差内
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "life": 50, "money": 5}]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is True

    def test_multiple_buildings_dps(self):
        """成功：多个建筑的 DPS 累加."""
        # cannon: 12/2 = 6, LMG: 5/3 = 1.67
        # total max_dps = 7.67
        # max_damage = 7.67 * 100 = 767
        result = {
            "killed_by_type": {0: 5},
            "total_life_destroyed": 250,
            "total_damage_dealt": 700,  # 在容量内
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
            {"id": "b-002", "type": "LMG", "level": 1, "position": [6, 6]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 5, "life": 50, "money": 5}]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
            "LMG": {"damage": 5, "speed": 3},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is True

    def test_upgraded_building_dps(self):
        """成功：升级建筑的 DPS 计算.

        伤害使用指数增长规则（每级 x 1.2）：
        - Level 2 cannon: int(12 * 1.2) = 14
        - DPS = 14 / 2 = 7
        - max_damage = 7 * 100 = 700
        - 10% 容差内: 700 * 1.1 = 770
        """
        result = {
            "killed_by_type": {0: 10},
            "total_life_destroyed": 500,
            "total_damage_dealt": 700,
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 2, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 10, "life": 50, "money": 5}]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is True

    def test_high_level_building_dps(self):
        """成功：高等级建筑的 DPS 计算（验证指数增长差异显著）.

        HMG 每级 x 1.3，保持浮点精度：
        - Level 5 HMG: int(30 * 1.3^4) = int(85.68) = 85
        - DPS = 85 / 3 = 28.33
        - max_damage = 28.33 * 100 = 2833
        - 10% 容差内: 2833 * 1.1 = 3116

        对比线性计算 30 * 5 / 3 = 50 DPS, max = 5000，差异显著
        """
        result = {
            "killed_by_type": {0: 50},
            "total_life_destroyed": 2500,
            "total_damage_dealt": 2800,
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "HMG", "level": 5, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 50, "life": 50, "money": 5}]
        }
        building_config = {
            "HMG": {"damage": 30, "speed": 3},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is True

    def test_high_level_building_dps_exceeds_exponential_limit(self):
        """Fail: Damage exceeds exponential growth DPS limit.

        Linear values exceed exponential growth limit:
        - Level 5 HMG exponential (float precision): 85 damage, DPS = 28.33, max = 2833 * 1.1 = 3116
        - Level 5 HMG linear: 150 damage, DPS = 50, max = 5000

        Test uses 4000 damage: within linear calc but exceeds exponential limit
        """
        result = {
            "killed_by_type": {0: 50},
            "total_life_destroyed": 2500,
            "total_damage_dealt": 4000,
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "HMG", "level": 5, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 50, "life": 50, "money": 5}]
        }
        building_config = {
            "HMG": {"damage": 30, "speed": 3},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is False
        assert "DPS capacity exceeded" in err

    def test_cannon_high_level_upgrade_rule_transition(self):
        """成功：cannon level 10/11/12 的升级规则切换边界测试.

        cannon 升级规则：1-10 级 x 1.2，11 级起 x 1.3

        保持浮点精度计算：
        - Level 10: int(12 * 1.2^9) = 61
        - Level 11: int(12 * 1.2^10) = 74 (current_level=10 <= 10, 用 1.2)
        - Level 12: int(12 * 1.2^10 * 1.3) = 96 (current_level=11 > 10, 用 1.3)

        对比线性计算的差异：
        - Level 10 线性: 12 * 10 = 120，实际 61，差异 49%
        - Level 12 线性: 12 * 12 = 144，实际 96，差异 33%
        """
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 100, "life": 50, "money": 5}]
        }

        # Level 10 cannon: damage = 61, DPS = 30.5, max = 3050, 10% 容差 = 3355
        result_level_10 = {
            "killed_by_type": {0: 50},
            "total_life_destroyed": 2500,
            "total_damage_dealt": 2600,
            "wave_duration_frames": 100,
        }
        buildings_level_10 = [
            {"id": "b-001", "type": "cannon", "level": 10, "position": [5, 5]},
        ]
        ok, err = validate_damage(result_level_10, buildings_level_10, wave_config, building_config)
        assert ok is True, f"Level 10 应通过: {err}"

        # Level 12 cannon: damage = 96, DPS = 48, max = 4800, 10% 容差 = 5280
        result_level_12 = {
            "killed_by_type": {0: 80},
            "total_life_destroyed": 4000,
            "total_damage_dealt": 4000,
            "wave_duration_frames": 100,
        }
        buildings_level_12 = [
            {"id": "b-001", "type": "cannon", "level": 12, "position": [5, 5]},
        ]
        ok, err = validate_damage(result_level_12, buildings_level_12, wave_config, building_config)
        assert ok is True, f"Level 12 应通过: {err}"

    def test_cannon_high_level_linear_damage_rejected(self):
        """Fail: High level cannon with linear damage is rejected.

        Level 10 cannon (float precision):
        - Exponential: damage = 61, DPS = 30.5, max_damage = 3050, 10% tolerance = 3355
        - Linear: damage = 120, DPS = 60, max_damage = 6000

        Test uses 5000 damage: within linear calc but exceeds exponential limit
        """
        result = {
            "killed_by_type": {0: 100},
            "total_life_destroyed": 5000,
            "total_damage_dealt": 5000,
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 10, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 100, "life": 50, "money": 5}]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is False
        assert "DPS capacity exceeded" in err

    def test_no_buildings(self):
        """成功：无建筑时 DPS 为 0."""
        result = {
            "killed_by_type": {},
            "total_life_destroyed": 0,
            "total_damage_dealt": 0,
            "wave_duration_frames": 100,
        }
        buildings = []
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "life": 50, "money": 5}]
        }
        building_config = {}
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is True

    def test_wall_no_dps(self):
        """成功：wall 建筑 speed=0 不计入 DPS."""
        result = {
            "killed_by_type": {},
            "total_life_destroyed": 0,
            "total_damage_dealt": 0,
            "wave_duration_frames": 100,
        }
        buildings = [
            {"id": "b-001", "type": "wall", "level": 1, "position": [5, 5]},
        ]
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "life": 50, "money": 5}]
        }
        building_config = {
            "wall": {"damage": 0, "speed": 0},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is True


class TestPositionDistance:
    """曼哈顿距离辅助函数测试."""

    def test_same_position(self):
        """同一位置距离为 0."""
        assert position_distance([5, 5], [5, 5]) == 0

    def test_horizontal_distance(self):
        """水平距离."""
        assert position_distance([0, 0], [10, 0]) == 10

    def test_vertical_distance(self):
        """垂直距离."""
        assert position_distance([0, 0], [0, 10]) == 10

    def test_diagonal_distance(self):
        """对角距离（曼哈顿）."""
        assert position_distance([0, 0], [3, 4]) == 7

    def test_negative_coordinates(self):
        """负坐标."""
        assert position_distance([-5, -5], [5, 5]) == 20


class TestValidateMonsterIds:
    """怪物 ID 有效性验证测试."""

    def test_all_valid_ids(self):
        """成功：所有 ID 都有效."""
        attacks = [
            {"monsterId": "m-001", "damage": 10},
            {"monsterId": "m-002", "damage": 15},
        ]
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 0, "life": 50},
        }
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is True
        assert err == ""

    def test_empty_attacks(self):
        """成功：无攻击事件."""
        attacks = []
        monsters_config = {"m-001": {"type": 0, "life": 50}}
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is True

    def test_invalid_id(self):
        """失败：存在无效 ID."""
        attacks = [
            {"monsterId": "m-001", "damage": 10},
            {"monsterId": "fake-id", "damage": 15},
        ]
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is False
        assert "fake-id" in err
        assert "不是服务端下发的 UUID" in err

    def test_valid_original_target_id(self):
        """成功：originalTargetId 有效."""
        attacks = [
            {
                "monsterId": "m-001",
                "originalTargetId": "m-001",
                "damage": 10,
            },
            {
                "monsterId": "m-002",
                "originalTargetId": "m-001",  # 误伤：瞄准 m-001 命中 m-002
                "damage": 15,
            },
        ]
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 0, "life": 50},
        }
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is True
        assert err == ""

    def test_invalid_original_target_id(self):
        """失败：originalTargetId 无效."""
        attacks = [
            {
                "monsterId": "m-001",
                "originalTargetId": "fake-target",  # 无效的原始目标
                "damage": 10,
            },
        ]
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is False
        assert "fake-target" in err
        assert "originalTargetId" in err
        assert "不是服务端下发的 UUID" in err

    def test_missing_original_target_id(self):
        """成功：缺少 originalTargetId 时不验证（向后兼容）."""
        attacks = [
            {"monsterId": "m-001", "damage": 10},  # 无 originalTargetId
        ]
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is True

    def test_friendly_fire_both_valid(self):
        """成功：误伤场景下两个 ID 都有效."""
        attacks = [
            {
                "monsterId": "m-002",  # 实际命中
                "originalTargetId": "m-001",  # 原本瞄准
                "damage": 10,
            },
        ]
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 1, "life": 100},
        }
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is True


class TestValidateCumulativeDamage:
    """累计伤害验证测试."""

    def test_exact_kill(self):
        """成功：刚好击杀."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},
            {"monsterId": "m-001", "damage": 20},  # 累计 50
        ]
        result = {"killed_by_type": {0: 1}}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is True

    def test_overkill(self):
        """成功：过量击杀."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},
            {"monsterId": "m-001", "damage": 30},  # 累计 60 > 50
        ]
        result = {"killed_by_type": {0: 1}}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is True

    def test_multiple_monsters(self):
        """成功：击杀多只怪物."""
        attacks = [
            {"monsterId": "m-001", "damage": 50},
            {"monsterId": "m-002", "damage": 50},
        ]
        result = {"killed_by_type": {0: 2}}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is True

    def test_mixed_types(self):
        """成功：混合类型怪物."""
        attacks = [
            {"monsterId": "m-001", "damage": 50},  # type 0
            {"monsterId": "m-002", "damage": 100},  # type 1
        ]
        result = {"killed_by_type": {0: 1, 1: 1}}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 1, "life": 100},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is True

    def test_not_killed_escaped(self):
        """成功：伤害不足，怪物逃脱."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},  # 不足以击杀
        ]
        result = {"killed_by_type": {0: 0}}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is True

    def test_kill_count_mismatch(self):
        """失败：击杀数不一致."""
        attacks = [
            {"monsterId": "m-001", "damage": 50},  # 击杀 1 只
        ]
        result = {"killed_by_type": {0: 2}}  # 声称击杀 2 只
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is False
        assert "击杀数不一致" in err

    def test_claimed_kill_without_damage(self):
        """失败：声称击杀但伤害不足."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},  # 不足以击杀
        ]
        result = {"killed_by_type": {0: 1}}  # 声称击杀
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is False


class TestValidateRemainingMonsters:
    """remaining 怪物验证测试."""

    def test_zero_remaining_skip_validation(self):
        """成功：remaining=0 时跳过验证."""
        attacks = []
        result = {"remaining": 0}
        monsters_config = {}
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True
        assert err == ""

    def test_remaining_default_zero(self):
        """成功：remaining 字段不存在时默认为 0，跳过验证."""
        attacks = []
        result = {}  # 不提供 remaining 字段
        monsters_config = {}
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True
        assert err == ""

    def test_success_with_valid_remaining_ids(self):
        """成功：remainingMonsterIds 有效且未被击杀."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},  # 累计 30 < 50
        ]
        result = {
            "remaining": 2,
            "remaining_monster_ids": ["m-001", "m-002"],
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True
        assert err == ""

    def test_success_no_damage_to_remaining(self):
        """成功：在场怪物未受过攻击."""
        attacks = [
            {"monsterId": "m-001", "damage": 50},  # 击杀 m-001
        ]
        result = {
            "remaining": 1,
            "remaining_monster_ids": ["m-002"],  # m-002 从未被攻击
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True
        assert err == ""

    def test_count_mismatch(self):
        """失败：remainingMonsterIds 数量与 remaining 不一致."""
        attacks = []
        result = {
            "remaining": 2,
            "remaining_monster_ids": ["m-001"],  # 只有 1 个
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "数量不一致" in err
        assert "期望 2" in err

    def test_missing_remaining_ids(self):
        """失败：remaining > 0 但未提供 remainingMonsterIds."""
        attacks = []
        result = {
            "remaining": 1,
            # 没有 remaining_monster_ids
        }
        monsters_config = {}
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "数量不一致" in err

    def test_duplicate_ids(self):
        """失败：remainingMonsterIds 包含重复 ID."""
        attacks = []
        result = {
            "remaining": 2,
            "remaining_monster_ids": ["m-001", "m-001"],  # 重复
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "重复 ID" in err

    def test_invalid_id(self):
        """失败：remainingMonsterIds 包含无效 ID."""
        attacks = []
        result = {
            "remaining": 1,
            "remaining_monster_ids": ["fake-id"],  # 无效 ID
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "fake-id" in err
        assert "不是服务端下发的 UUID" in err

    def test_should_be_killed(self):
        """失败：怪物累计伤害 >= 生命值，应被击杀而非 remaining."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},
            {"monsterId": "m-001", "damage": 25},  # 累计 55 >= 50
        ]
        result = {
            "remaining": 1,
            "remaining_monster_ids": ["m-001"],  # 声称 m-001 在场
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "m-001" in err
        assert "应被击杀而非 remaining" in err

    def test_exact_damage_should_be_killed(self):
        """失败：累计伤害刚好等于生命值，应被击杀而非 remaining."""
        attacks = [
            {"monsterId": "m-001", "damage": 50},  # 刚好 50 == 50
        ]
        result = {
            "remaining": 1,
            "remaining_monster_ids": ["m-001"],
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "应被击杀而非 remaining" in err

    def test_multiple_remaining_mixed_types(self):
        """成功：多个不同类型的在场怪物."""
        attacks = [
            {"monsterId": "m-001", "damage": 20},  # 累计 20 < 50
            {"monsterId": "m-003", "damage": 30},  # 累计 30 < 100
        ]
        result = {
            "remaining": 3,
            "remaining_monster_ids": ["m-001", "m-002", "m-003"],
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 0, "life": 50},   # 从未被攻击
            "m-003": {"type": 1, "life": 100},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True

    def test_remaining_id_not_in_spawned(self):
        """失败：remaining 怪物 ID 不在前 spawned 个怪物中."""
        attacks = []
        result = {
            "remaining": 2,
            "remaining_monster_ids": ["m-001", "m-006"],  # m-006 是第 6 个，未生成
            "spawned": 5,  # 只生成了前 5 个
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-006": {"type": 0, "life": 50},  # 未生成但在配置中
        }
        monsters_list = ["m-001", "m-002", "m-003", "m-004", "m-005", "m-006", "m-007"]
        ok, err = validate_remaining_monsters(
            attacks, result, monsters_config, monsters_list
        )
        assert ok is False
        assert "m-006" in err
        assert "未生成" in err or "不在前" in err

    def test_remaining_id_in_spawned_success(self):
        """成功：remaining 怪物 ID 都在前 spawned 个怪物中."""
        attacks = []
        result = {
            "remaining": 2,
            "remaining_monster_ids": ["m-002", "m-004"],
            "spawned": 5,
        }
        monsters_config = {
            "m-002": {"type": 0, "life": 50},
            "m-004": {"type": 0, "life": 50},
        }
        monsters_list = ["m-001", "m-002", "m-003", "m-004", "m-005", "m-006"]
        ok, err = validate_remaining_monsters(
            attacks, result, monsters_config, monsters_list
        )
        assert ok is True

    def test_remaining_without_monsters_list_backward_compat(self):
        """向后兼容：不传入 monsters_list 时跳过 spawned 验证."""
        attacks = []
        result = {
            "remaining": 1,
            "remaining_monster_ids": ["m-001"],
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        # 不传入 monsters_list，应该跳过 spawned 验证
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True

    def test_cheat_scenario_use_unspawned_monster(self):
        """作弊场景：用未生成的怪物 ID 隐藏 passed 怪物."""
        # 场景：5 个怪物配置，生成了 3 个，m-001 穿过终点
        # 作弊者声称 remaining=3，用 m-002, m-003, m-004（未生成）凑数
        attacks = []
        result = {
            "remaining": 3,
            "remaining_monster_ids": ["m-002", "m-003", "m-004"],  # m-004 未生成
            "spawned": 3,  # 只生成了 m-001, m-002, m-003
        }
        monsters_config = {
            "m-002": {"type": 0, "life": 50},
            "m-003": {"type": 0, "life": 50},
            "m-004": {"type": 0, "life": 50},  # 在配置中但未生成
        }
        monsters_list = ["m-001", "m-002", "m-003", "m-004", "m-005"]
        ok, err = validate_remaining_monsters(
            attacks, result, monsters_config, monsters_list
        )
        assert ok is False
        assert "m-004" in err


class TestValidateAttackRange:
    """射程验证测试."""

    def test_within_range(self):
        """成功：目标在射程内."""
        attack = {
            "originalTargetPosition": [10, 5],
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_at_current_range(self):
        """成功：目标在当前射程边界."""
        # level 1: current_range = min(4, 8) = 4
        attack = {
            "originalTargetPosition": [9, 5],  # 距离 4，等于当前射程
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_very_close_target(self):
        """成功：目标很近也可以攻击（无最小射程限制）."""
        attack = {
            "originalTargetPosition": [6, 5],  # 距离 1
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_too_far(self):
        """失败：目标太远."""
        attack = {
            "originalTargetPosition": [20, 5],  # 距离 15 > 8+1
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is False
        assert "目标太远" in err

    def test_upgraded_building_range(self):
        """成功：升级建筑射程增加."""
        # level 3: current_range = min(4 * 1.2^2, 8) = min(5.76, 8) = 5.76
        attack = {
            "originalTargetPosition": [11, 5],  # 距离 6，在升级后射程内（5.76 + 1 容差）
        }
        building = {"id": "b-001", "type": "cannon", "level": 3, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_tolerance_at_range(self):
        """成功：利用 1 格容差."""
        # level 1: current_range = min(4, 8) = 4
        # 距离 5 在容差内（4 + 1 = 5）
        attack = {
            "originalTargetPosition": [10, 5],  # 距离 5 = 4 + 1（容差内）
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_range_capped_by_max_range(self):
        """成功：射程不超过 max_range."""
        # level 10: range * 1.2^9 = 4 * 5.16 = 20.64，但被 max_range=8 限制
        # current_range = min(20.64, 8) = 8
        attack = {
            "originalTargetPosition": [13, 5],  # 距离 8，等于 max_range
        }
        building = {"id": "b-001", "type": "cannon", "level": 10, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True


class TestValidateDamageValue:
    """伤害值合法性验证测试."""

    def test_exact_damage(self):
        """成功：伤害等于建筑伤害."""
        attack = {"damage": 12}
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_reduced_damage_by_shield(self):
        """成功：护盾减伤后的伤害."""
        attack = {"damage": 8}  # 可能被护盾减少
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_minimum_damage(self):
        """成功：最小伤害（1）."""
        attack = {"damage": 1}
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_upgraded_building_damage(self):
        """成功：升级建筑的伤害."""
        # level 2: 12 * 1.2 = 14.4 -> 14
        attack = {"damage": 14}
        building = {"id": "b-001", "type": "cannon", "level": 2}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_level_3_damage(self):
        """成功：3 级建筑的伤害.

        旧实现保持浮点精度：12 * 1.2 = 14.4 * 1.2 = 17.28 -> 17
        """
        attack = {"damage": 17}
        building = {"id": "b-001", "type": "cannon", "level": 3}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_damage_exceeds_limit(self):
        """失败：伤害超过上限."""
        attack = {"damage": 20}  # 超过 12
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is False
        assert "伤害值超过建筑上限" in err

    def test_zero_damage(self):
        """失败：零伤害."""
        attack = {"damage": 0}
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is False
        assert "伤害值不能小于 1" in err

    def test_hmg_upgrade_rule(self):
        """成功：HMG 使用 1.3 倍升级规则.

        HMG 基础伤害 30，每级 × 1.3
        level 2: 30 × 1.3 = 39
        level 3: 39 × 1.3 = 50.7 -> 50
        """
        building_config = {"HMG": {"damage": 30}}

        attack_lv2 = {"damage": 39}
        building_lv2 = {"id": "b-001", "type": "HMG", "level": 2}
        ok, _ = validate_damage_value(attack_lv2, building_lv2, building_config)
        assert ok is True

        attack_lv3 = {"damage": 50}
        building_lv3 = {"id": "b-001", "type": "HMG", "level": 3}
        ok, _ = validate_damage_value(attack_lv3, building_lv3, building_config)
        assert ok is True

    def test_cannon_upgrade_rule_high_level(self):
        """成功：cannon 第 12 次升级起使用 1.3 倍.

        cannon 基础伤害 12，保持浮点精度计算（与旧实现 td-cfg-buildings.js:51-53 一致）：
        旧实现条件：old_level <= 10 ? 1.2 : 1.3（old_level 是 0-based）
        新实现对应：current_level <= 11 用 1.2，current_level > 11 用 1.3

        level 11: int(12 * 1.2^10) = int(74.30...) = 74（current_level=10，用 1.2）
        level 12: int(12 * 1.2^11) = int(89.16...) = 89（current_level=11 <= 11，用 1.2）
        level 13: int(12 * 1.2^11 * 1.3) = int(115.90...) = 115（current_level=12 > 11，用 1.3）
        """
        assert calc_building_damage("cannon", 12, 11) == 74
        assert calc_building_damage("cannon", 12, 12) == 89
        assert calc_building_damage("cannon", 12, 13) == 115

        building_config = {"cannon": {"damage": 12}}
        attack = {"damage": 89}
        building = {"id": "b-001", "type": "cannon", "level": 12}
        ok, _ = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_lmg_default_upgrade_rule(self):
        """成功：LMG 使用默认 1.2 倍升级规则.

        LMG 基础伤害 5
        level 2: 5 × 1.2 = 6
        level 3: 6 × 1.2 = 7.2 -> 7
        """
        building_config = {"LMG": {"damage": 5}}

        attack_lv3 = {"damage": 7}
        building_lv3 = {"id": "b-001", "type": "LMG", "level": 3}
        ok, _ = validate_damage_value(attack_lv3, building_lv3, building_config)
        assert ok is True


class TestCalcBuildingDamage:
    """建筑伤害计算测试."""

    def test_default_upgrade_rule(self):
        """默认升级规则：每级 × 1.2."""
        # level 1: 10
        # level 2: 10 × 1.2 = 12
        # level 3: 12 × 1.2 = 14.4 -> 14
        assert calc_building_damage("LMG", 10, 1) == 10
        assert calc_building_damage("LMG", 10, 2) == 12
        assert calc_building_damage("LMG", 10, 3) == 14

    def test_hmg_always_1_3(self):
        """HMG 始终使用 1.3 倍."""
        # level 1: 30
        # level 2: 30 × 1.3 = 39
        # level 3: 39 × 1.3 = 50.7 -> 50
        assert calc_building_damage("HMG", 30, 1) == 30
        assert calc_building_damage("HMG", 30, 2) == 39
        assert calc_building_damage("HMG", 30, 3) == 50

    def test_cannon_upgrade_transition(self):
        """cannon 第 12 次升级起切换到 1.3 倍.

        保持浮点精度计算（与旧实现 td-cfg-buildings.js:51-53 一致）：
        旧实现条件：old_level <= 10 ? 1.2 : 1.3（old_level 是 0-based）
        新实现对应：current_level <= 11 用 1.2，current_level > 11 用 1.3

        level 11: int(12 * 1.2^10) = 74 (current_level=10 <= 11, 用 1.2)
        level 12: int(12 * 1.2^11) = 89 (current_level=11 <= 11, 用 1.2)
        level 13: int(12 * 1.2^11 * 1.3) = 115 (current_level=12 > 11, 用 1.3)
        """
        assert calc_building_damage("cannon", 12, 11) == 74
        assert calc_building_damage("cannon", 12, 12) == 89
        assert calc_building_damage("cannon", 12, 13) == 115


class TestValidateMonsterPaths:
    """怪物路径合理性验证测试.

    注意：validate_monster_paths 函数本身仍然返回检测结果（True/False），
    但在 validate_attacks 中，路径异常只会记录日志而不会阻断请求。
    这是因为怪物重新寻路和玩家移除路障都是合法的游戏行为。
    """

    def test_moving_toward_exit(self):
        """成功：怪物向出口移动."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [2, 2]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [8, 8]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_single_attack(self):
        """成功：单次攻击（无法验证路径）."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [5, 5]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_multiple_monsters(self):
        """成功：多只怪物都向出口移动."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [2, 2]},
            {"monsterId": "m-002", "frame": 15, "monsterPosition": [3, 3]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [5, 5]},
            {"monsterId": "m-002", "frame": 25, "monsterPosition": [6, 6]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_slight_detour(self):
        """成功：轻微绕路（在容差内）."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [5, 5]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [4, 6]},  # 稍微绕路
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_moving_away_from_exit(self):
        """失败：怪物远离出口."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [10, 10]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [2, 2]},  # 远离出口
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is False
        assert "路径异常" in err
        assert "远离出口" in err

    def test_no_attacks(self):
        """成功：无攻击事件."""
        attacks = []
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_zigzag_path_should_pass(self):
        """成功：蛇形路径中怪物曼哈顿距离可能暂时增加.

        场景：玩家构建蛇形路障迫使怪物绕行
        - 第一行：入口 (0,0) 向右走到 (14,0)，然后转弯
        - 第二行：从 (14,1) 向左走到 (1,1)，然后转弯
        - 如此往复形成蛇形路径

        在这种情况下，怪物在转弯点被攻击时：
        - 首次攻击位置 (14, 1)：到出口 (15,15) 距离 = 1 + 14 = 15
        - 最后攻击位置 (1, 2)：到出口距离 = 14 + 13 = 27
        - 距离增加了 12 格，这是合法的游戏行为
        """
        attacks = [
            {"monsterId": "m-001", "frame": 100, "monsterPosition": [14, 1]},
            {"monsterId": "m-001", "frame": 200, "monsterPosition": [8, 1]},
            {"monsterId": "m-001", "frame": 300, "monsterPosition": [1, 2]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True, f"蛇形路径应该通过验证，但失败了: {err}"

    def test_extreme_zigzag_path(self):
        """成功：极端蛇形路径，怪物需要走到地图另一端.

        模拟多轮蛇形路径后，怪物在地图中部被攻击的情况。
        首次攻击在接近出口的拐弯处，最后攻击在远离出口的直道上。
        """
        attacks = [
            {"monsterId": "m-001", "frame": 50, "monsterPosition": [15, 10]},
            {"monsterId": "m-001", "frame": 150, "monsterPosition": [1, 11]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True, f"极端蛇形路径应该通过验证，但失败了: {err}"

    def test_backward_movement_should_fail(self):
        """失败：怪物向入口方向倒退（两个方向都远离出口）.

        场景：作弊者伪造数据，怪物从 (10, 10) 倒退到 (3, 3)
        - 首次攻击位置 (10, 10)：到出口距离 = 10
        - 最后攻击位置 (3, 3)：到出口距离 = 24
        - x 方向：从距离 5 增加到 12（远离）
        - y 方向：从距离 5 增加到 12（远离）
        - 两个方向都远离出口，应该失败
        """
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [10, 10]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [3, 3]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is False
        assert "路径异常" in err
        assert "两个方向都远离出口" in err


class TestValidateAttacks:
    """攻击事件综合验证测试."""

    def test_success_complete_validation(self):
        """成功：完整的攻击事件验证."""
        # level 1 cannon: current_range = min(4, 8) = 4，加 1 容差 = 5
        # 建筑位于 [5, 5]，目标需要在距离 <= 5 的范围内
        attacks = [
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 10,
                "damage": 12,
                "originalTargetPosition": [8, 5],  # 距离 3
                "monsterPosition": [8, 5],
            },
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 20,
                "damage": 12,
                "originalTargetPosition": [9, 6],  # 距离 sqrt(16+1) ≈ 4.12
                "monsterPosition": [9, 6],
            },
        ]
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        result = {
            "total_damage_dealt": 24,
            "killed_by_type": {0: 0},  # 没击杀
        }
        building_config = {
            "cannon": {"damage": 12, "range": 4, "max_range": 8},
        }
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_attacks(
            attacks, buildings, result, building_config, map_config, monsters_config
        )
        assert ok is True

    def test_damage_sum_mismatch(self):
        """失败：伤害总和不一致."""
        attacks = [
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 10,
                "damage": 12,
                "originalTargetPosition": [10, 5],
                "monsterPosition": [10, 5],
            },
        ]
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        result = {
            "total_damage_dealt": 100,  # 不匹配
            "killed_by_type": {0: 0},
        }
        building_config = {
            "cannon": {"damage": 12, "range": 4, "max_range": 8},
        }
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        monsters_config = {"m-001": {"type": 0, "life": 50}}
        ok, err = validate_attacks(
            attacks, buildings, result, building_config, map_config, monsters_config
        )
        assert ok is False
        assert "伤害总和不一致" in err

    def test_frame_order_invalid(self):
        """失败：帧号时序错误."""
        attacks = [
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 20,
                "damage": 12,
                "originalTargetPosition": [10, 5],
                "monsterPosition": [10, 5],
            },
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 10,  # 时序错误
                "damage": 12,
                "originalTargetPosition": [10, 5],
                "monsterPosition": [10, 5],
            },
        ]
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        result = {
            "total_damage_dealt": 24,
            "killed_by_type": {0: 0},
        }
        building_config = {
            "cannon": {"damage": 12, "range": 4, "max_range": 8},
        }
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        monsters_config = {"m-001": {"type": 0, "life": 50}}
        ok, err = validate_attacks(
            attacks, buildings, result, building_config, map_config, monsters_config
        )
        assert ok is False
        assert "帧号时序错误" in err

    def test_unknown_building(self):
        """失败：未知建筑 ID."""
        attacks = [
            {
                "buildingId": "unknown",
                "monsterId": "m-001",
                "frame": 10,
                "damage": 12,
                "originalTargetPosition": [10, 5],
                "monsterPosition": [10, 5],
            },
        ]
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        result = {
            "total_damage_dealt": 12,
            "killed_by_type": {0: 0},
        }
        building_config = {
            "cannon": {"damage": 12, "range": 4, "max_range": 8},
        }
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        monsters_config = {"m-001": {"type": 0, "life": 50}}
        ok, err = validate_attacks(
            attacks, buildings, result, building_config, map_config, monsters_config
        )
        assert ok is False
        assert "未知建筑" in err

    def test_empty_attacks(self):
        """成功：无攻击事件."""
        attacks = []
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        result = {
            "total_damage_dealt": 0,
            "killed_by_type": {},
        }
        building_config = {
            "cannon": {"damage": 12, "range": 4, "max_range": 8},
        }
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        monsters_config = {}
        ok, err = validate_attacks(
            attacks, buildings, result, building_config, map_config, monsters_config
        )
        assert ok is True

    def test_path_anomaly_does_not_block(self):
        """成功：路径异常不阻断请求（只记录日志）.

        场景：玩家移除路障后，怪物掉头走新路径
        - 首次攻击位置 (8, 5)：到出口距离 = 17
        - 最后攻击位置 (2, 3)：到出口距离 = 25（两个方向都远离）
        - 这是合法的游戏行为（怪物重新寻路）

        验证：validate_attacks 应返回 True，路径异常只记录日志
        """
        attacks = [
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 10,
                "damage": 12,
                "originalTargetPosition": [8, 5],
                "monsterPosition": [8, 5],
            },
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 20,
                "damage": 12,
                "originalTargetPosition": [2, 3],
                "monsterPosition": [2, 3],
            },
        ]
        buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]},
        ]
        result = {
            "total_damage_dealt": 24,
            "killed_by_type": {0: 0},
        }
        building_config = {
            "cannon": {"damage": 12, "range": 4, "max_range": 8},
        }
        map_config = {"entrance": [0, 0], "exit": [15, 15], "width": 16, "height": 16}
        monsters_config = {"m-001": {"type": 0, "life": 50}}

        with patch("game.validators.logger") as mock_logger:
            ok, err = validate_attacks(
                attacks, buildings, result, building_config, map_config, monsters_config
            )
            # 验证请求未被阻断
            assert ok is True
            # 验证路径异常被记录到日志
            mock_logger.warning.assert_called_once()
            assert "路径验证异常" in mock_logger.warning.call_args[0][0]


class TestAnalyzeStatistics:
    """Level 4 统计分析测试."""

    def _create_wave_record(self, killed, passed, score_gained, money_spent):
        """创建模拟的波次记录."""
        record = Mock()
        record.killed = killed
        record.passed = passed
        record.score_gained = score_gained
        record.money_spent = money_spent
        return record

    def test_insufficient_data(self):
        """数据不足时不进行分析（少于 3 条记录）."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(5, 0, 50, 100),
            self._create_wave_record(5, 0, 50, 100),
        ]
        result = {"killed": 10, "passed": 0, "score_gained": 100}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            mock_logger.warning.assert_not_called()

    def test_no_warning_normal_kill_rate(self):
        """正常击杀率不触发警告."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(8, 2, 50, 100),  # 80%
            self._create_wave_record(7, 3, 50, 100),  # 70%
            self._create_wave_record(9, 1, 50, 100),  # 90%
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        result = {"killed": 9, "passed": 1, "score_gained": 50}  # 90%

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            mock_logger.warning.assert_not_called()

    def test_kill_rate_spike_warning(self):
        """击杀率突增触发警告：历史 < 0.5 且当前 > 0.95."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(3, 7, 30, 100),  # 30%
            self._create_wave_record(4, 6, 40, 100),  # 40%
            self._create_wave_record(5, 5, 50, 100),  # 50%
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # 当前波次：96% 击杀率
        result = {"killed": 24, "passed": 1, "score_gained": 100}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            # 检查是否记录了击杀率突增警告
            warning_calls = [
                call for call in mock_logger.warning.call_args_list
                if "击杀率异常突增" in str(call)
            ]
            assert len(warning_calls) == 1

    def test_efficiency_spike_warning(self):
        """资源效率突增触发警告：当前效率 > 历史 × 3."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 50, 100),  # 效率 0.5
            self._create_wave_record(10, 0, 60, 100),  # 效率 0.6
            self._create_wave_record(10, 0, 40, 100),  # 效率 0.4
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # 历史平均效率 = 150/300 = 0.5
        # 当前效率 = 200/100 = 2.0 > 0.5 × 3 = 1.5
        result = {"killed": 10, "passed": 0, "score_gained": 200}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            # 检查是否记录了效率突增警告
            warning_calls = [
                call for call in mock_logger.warning.call_args_list
                if "资源效率异常突增" in str(call)
            ]
            assert len(warning_calls) == 1

    def test_no_efficiency_warning_within_threshold(self):
        """效率在阈值内不触发警告."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 50, 100),  # 效率 0.5
            self._create_wave_record(10, 0, 60, 100),  # 效率 0.6
            self._create_wave_record(10, 0, 40, 100),  # 效率 0.4
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # 历史平均效率 = 150/300 = 0.5
        # 当前效率 = 100/100 = 1.0 < 0.5 × 3 = 1.5
        result = {"killed": 10, "passed": 0, "score_gained": 100}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            # 检查没有效率突增警告
            warning_calls = [
                call for call in mock_logger.warning.call_args_list
                if "资源效率异常突增" in str(call)
            ]
            assert len(warning_calls) == 0

    def test_both_warnings(self):
        """同时触发两种警告."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(3, 7, 30, 100),  # 击杀率 30%，效率 0.3
            self._create_wave_record(4, 6, 40, 100),  # 击杀率 40%，效率 0.4
            self._create_wave_record(5, 5, 50, 100),  # 击杀率 50%，效率 0.5
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # 历史击杀率 = 12/30 = 0.4 < 0.5
        # 历史效率 = 120/300 = 0.4
        # 当前击杀率 = 24/25 = 0.96 > 0.95
        # 当前效率 = 200/100 = 2.0 > 0.4 × 3 = 1.2
        result = {"killed": 24, "passed": 1, "score_gained": 200}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            assert mock_logger.warning.call_count == 2

    def test_no_efficiency_warning_when_no_spending(self):
        """无花费时不触发效率警告（正常游戏策略）.

        玩家在前期集中投资建造后，后续波次不再建造是正常策略。
        此时 money_spent = 0，不应触发效率警告。
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 50, 500),  # 效率 0.1
            self._create_wave_record(10, 0, 60, 300),  # 效率 0.2
            self._create_wave_record(10, 0, 40, 200),  # 效率 0.2
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # 历史平均效率 = 150/1000 = 0.15
        # 当前：无花费，分数 100（已有建筑产出）
        result = {"killed": 10, "passed": 0, "score_gained": 100}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 0)
            # 无花费时应跳过效率检测，不触发警告
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "资源效率异常突增" in str(call)
            ]
            assert len(efficiency_warnings) == 0

    def test_zero_money_spent_no_crash(self):
        """花费为 0 时不崩溃且不触发效率警告."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(5, 0, 50, 0),
            self._create_wave_record(5, 0, 50, 0),
            self._create_wave_record(5, 0, 50, 0),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        result = {"killed": 5, "passed": 0, "score_gained": 50}

        with patch("game.validators.logger") as mock_logger:
            # 不应该崩溃
            analyze_statistics(session, result, 0)
            # 无花费时应跳过效率检测
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "资源效率异常突增" in str(call)
            ]
            assert len(efficiency_warnings) == 0

    def test_zero_total_monsters_no_crash(self):
        """怪物总数为 0 时不崩溃."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(0, 0, 0, 100),
            self._create_wave_record(0, 0, 0, 100),
            self._create_wave_record(0, 0, 0, 100),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        result = {"killed": 0, "passed": 0, "score_gained": 0}

        # 不应该崩溃
        analyze_statistics(session, result, 100)

    def test_no_efficiency_warning_when_zero_historical_cost(self):
        """历史无花费时跳过效率检测.

        当历史 3 波都没有花费时，无法计算有意义的历史效率基准，
        应跳过效率检测，与当前波无花费的处理保持一致。
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(5, 0, 50, 0),
            self._create_wave_record(5, 0, 50, 0),
            self._create_wave_record(5, 0, 50, 0),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        result = {"killed": 5, "passed": 0, "score_gained": 100}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "资源效率异常突增" in str(call)
            ]
            assert len(efficiency_warnings) == 0

    def test_efficiency_warning_when_zero_historical_score(self):
        """历史效率为零时触发效率警告.

        当历史有花费但无分数（效率=0）时，任何正效率都会触发警告。
        这是合理行为：从零效率突变到有效率确实值得关注。
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(0, 0, 0, 100),
            self._create_wave_record(0, 0, 0, 100),
            self._create_wave_record(0, 0, 0, 100),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # 历史效率 = 0 / 300 = 0
        # 当前效率 = 50 / 100 = 0.5 > 0 × 3 = 0
        result = {"killed": 5, "passed": 0, "score_gained": 50}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "资源效率异常突增" in str(call)
            ]
            assert len(efficiency_warnings) == 1

    def test_no_efficiency_warning_at_exact_threshold(self):
        """效率刚好等于阈值时不触发警告.

        使用 > 而非 >=，刚好等于阈值时不触发。
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 100, 100),
            self._create_wave_record(10, 0, 100, 100),
            self._create_wave_record(10, 0, 100, 100),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # 历史效率 = 300 / 300 = 1.0
        # 当前效率 = 300 / 100 = 3.0 == 1.0 × 3
        result = {"killed": 10, "passed": 0, "score_gained": 300}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "资源效率异常突增" in str(call)
            ]
            assert len(efficiency_warnings) == 0

    def test_no_efficiency_warning_when_zero_current_score(self):
        """当前分数为零时效率为零，不触发警告.

        有花费但无分数（效率=0）不会 > 历史效率 × 3。
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 50, 100),
            self._create_wave_record(10, 0, 50, 100),
            self._create_wave_record(10, 0, 50, 100),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # 历史效率 = 150 / 300 = 0.5
        # 当前效率 = 0 / 100 = 0 < 0.5 × 3 = 1.5
        result = {"killed": 0, "passed": 10, "score_gained": 0}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "资源效率异常突增" in str(call)
            ]
            assert len(efficiency_warnings) == 0


class TestValidateGameEnd:
    """游戏结束验证测试."""

    def _create_wave_record(self, wave_number: int, score_gained: int):
        """创建模拟的波次记录."""
        record = Mock()
        record.wave_number = wave_number
        record.score_gained = score_gained
        return record

    def test_empty_waves_zero_score(self):
        """成功：无波次记录且分数为 0."""
        session = Mock()
        session.waves.order_by.return_value = []
        session.score = 0
        ok, err = validate_game_end(session)
        assert ok is True
        assert err == ""

    def test_empty_waves_nonzero_score(self):
        """失败：无波次记录但分数不为 0."""
        session = Mock()
        session.waves.order_by.return_value = []
        session.score = 100
        ok, err = validate_game_end(session)
        assert ok is False
        assert "分数累计不一致" in err
        assert "期望 0" in err

    def test_single_wave_success(self):
        """成功：单波次记录，分数一致."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 50)
        ]
        session.score = 50
        ok, err = validate_game_end(session)
        assert ok is True
        assert err == ""

    def test_multiple_waves_success(self):
        """成功：多波次记录，分数累计一致."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 30),
            self._create_wave_record(2, 40),
            self._create_wave_record(3, 50),
        ]
        session.score = 120  # 30 + 40 + 50 = 120
        ok, err = validate_game_end(session)
        assert ok is True
        assert err == ""

    def test_score_mismatch(self):
        """失败：分数累计不一致."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 30),
            self._create_wave_record(2, 40),
        ]
        session.score = 100  # 实际应为 70
        ok, err = validate_game_end(session)
        assert ok is False
        assert "分数累计不一致" in err
        assert "期望 70" in err
        assert "实际 100" in err

    def test_wave_continuity_gap(self):
        """失败：波次记录有间断（跳波）."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 30),
            self._create_wave_record(3, 50),  # 缺少波次 2
        ]
        session.score = 80
        ok, err = validate_game_end(session)
        assert ok is False
        assert "波次记录不连续" in err
        assert "缺少波次 2" in err

    def test_wave_continuity_start_wrong(self):
        """失败：波次记录不从 1 开始."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(2, 30),  # 应从 1 开始
        ]
        session.score = 30
        ok, err = validate_game_end(session)
        assert ok is False
        assert "波次记录不连续" in err
        assert "缺少波次 1" in err

    def test_wave_continuity_duplicate(self):
        """失败：波次记录重复."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 30),
            self._create_wave_record(1, 40),  # 重复波次 1
        ]
        session.score = 70
        ok, err = validate_game_end(session)
        assert ok is False
        assert "波次记录不连续" in err
        assert "缺少波次 2" in err


class TestValidateNickname:
    """昵称验证测试."""

    def test_valid_nickname(self):
        """成功：有效昵称."""
        ok, err = validate_nickname("Player1")
        assert ok is True
        assert err == ""

    def test_valid_nickname_with_spaces(self):
        """成功：昵称包含空格."""
        ok, err = validate_nickname("Player One")
        assert ok is True
        assert err == ""

    def test_valid_nickname_unicode(self):
        """成功：Unicode 昵称."""
        ok, err = validate_nickname("玩家一号")
        assert ok is True
        assert err == ""

    def test_valid_nickname_max_length(self):
        """成功：昵称长度正好 32 字符."""
        nickname = "A" * 32
        ok, err = validate_nickname(nickname)
        assert ok is True
        assert err == ""

    def test_empty_nickname(self):
        """失败：空昵称."""
        ok, err = validate_nickname("")
        assert ok is False
        assert "昵称不能为空" in err

    def test_whitespace_only_nickname(self):
        """失败：纯空白字符昵称."""
        ok, err = validate_nickname("   ")
        assert ok is False
        assert "昵称不能为空" in err

    def test_whitespace_only_tabs(self):
        """失败：纯 tab 字符昵称."""
        ok, err = validate_nickname("\t\t\t")
        assert ok is False
        assert "昵称不能为空" in err

    def test_whitespace_mixed(self):
        """失败：混合空白字符昵称."""
        ok, err = validate_nickname(" \t \n ")
        assert ok is False
        assert "昵称不能为空" in err

    def test_nickname_too_long(self):
        """失败：昵称超过 32 字符."""
        nickname = "A" * 33
        ok, err = validate_nickname(nickname)
        assert ok is False
        assert "昵称长度不能超过 32 个字符" in err

    def test_nickname_with_leading_trailing_spaces(self):
        """成功：昵称两端有空格但中间有内容."""
        ok, err = validate_nickname("  Player  ")
        assert ok is True
        assert err == ""

    def test_xss_script_tag(self):
        """失败：包含 script 标签（XSS 攻击）."""
        ok, err = validate_nickname("<script>alert('XSS')</script>")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_xss_img_tag(self):
        """失败：包含 img 标签（XSS 攻击）."""
        ok, err = validate_nickname("<img src=x onerror=alert(1)>")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_xss_javascript_protocol(self):
        """失败：包含 javascript: 协议."""
        ok, err = validate_nickname("javascript:alert(1)")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_xss_event_handler(self):
        """失败：包含事件处理器."""
        ok, err = validate_nickname("Player onclick=hack")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_xss_case_insensitive(self):
        """失败：大小写混合的 XSS 尝试."""
        ok, err = validate_nickname("<SCRIPT>alert(1)</SCRIPT>")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_html_link_injection(self):
        """失败：HTML 链接注入."""
        ok, err = validate_nickname("<a href='x'>Click</a>")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_html_style_injection(self):
        """失败：CSS 注入."""
        ok, err = validate_nickname("<style>*{}</style>")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_control_char_null(self):
        """失败：包含空字符."""
        ok, err = validate_nickname("Player\x00Name")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_control_char_escape(self):
        """失败：包含 ANSI 转义序列."""
        ok, err = validate_nickname("\x1b[31mRed\x1b[0m")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_control_char_delete(self):
        """失败：包含 DEL 字符."""
        ok, err = validate_nickname("Player\x7fName")
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_unicode_zero_width_space(self):
        """失败：包含零宽空格."""
        ok, err = validate_nickname("P\u200Blayer")  # U+200B Zero Width Space
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_unicode_zero_width_joiner(self):
        """失败：包含零宽连接符."""
        ok, err = validate_nickname("Play\u200Der")  # U+200D Zero Width Joiner
        assert ok is False
        assert "昵称包含非法字符" in err

    def test_valid_special_chars(self):
        """成功：允许的特殊字符."""
        ok, err = validate_nickname("Player_123-XYZ")
        assert ok is True
        assert err == ""

    def test_valid_emoji(self):
        """成功：允许 emoji."""
        ok, err = validate_nickname("Player123")
        assert ok is True
        assert err == ""

    def test_valid_angle_brackets_without_tag(self):
        """成功：单独的尖括号（不构成标签）."""
        ok, err = validate_nickname("1 < 2 > 0")
        assert ok is True
        assert err == ""
