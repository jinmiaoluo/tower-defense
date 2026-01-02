"""验证器单元测试."""

import math
from unittest.mock import Mock

import pytest

from game.validators import (
    validate_basic,
    validate_buildings_consistency,
    validate_money_balance,
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
        """失败：killed + passed != 总数."""
        result = {
            "killed": 2,
            "killed_by_type": {0: 2},
            "passed": 0,  # 总数应为 3
            "money_gained": 10,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "怪物数量不一致" in err

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
