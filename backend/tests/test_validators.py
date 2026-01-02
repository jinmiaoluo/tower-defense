"""验证器单元测试."""

from unittest.mock import Mock

from game.validators import (
    position_distance,
    validate_attack_range,
    validate_attacks,
    validate_basic,
    validate_buildings_consistency,
    validate_cumulative_damage,
    validate_damage,
    validate_damage_value,
    validate_money_balance,
    validate_monster_ids,
    validate_monster_paths,
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

    def test_life_pool_mismatch(self):
        """失败：生命池不匹配."""
        result = {
            "killed_by_type": {0: 3},
            "total_life_destroyed": 200,  # 错误，应为 150
            "total_damage_dealt": 200,
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
        assert "生命池验证失败" in err

    def test_damage_insufficient(self):
        """失败：伤害值不足以击杀."""
        result = {
            "killed_by_type": {0: 3},
            "total_life_destroyed": 150,
            "total_damage_dealt": 100,  # 小于 150，不足以击杀
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
        assert "伤害值不足以击杀" in err

    def test_dps_capacity_exceeded(self):
        """失败：DPS 容量超限."""
        # 建筑：cannon level 1, damage=12, speed=2
        # max_dps = 12 * 1 / 2 = 6
        # 100 帧内最大伤害 = 6 * 100 = 600
        # 允许 10% 容差 = 660
        result = {
            "killed_by_type": {0: 3},
            "total_life_destroyed": 150,
            "total_damage_dealt": 1000,  # 超出 660
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
        assert "DPS 容量超限" in err

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
        """成功：升级建筑的 DPS 计算."""
        # level 2 cannon: 12 * 2 / 2 = 12
        # max_damage = 12 * 100 = 1200
        result = {
            "killed_by_type": {0: 10},
            "total_life_destroyed": 500,
            "total_damage_dealt": 1100,
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

    def test_at_max_range(self):
        """成功：目标在最大射程边界."""
        attack = {
            "originalTargetPosition": [13, 5],  # 距离 8
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_at_min_range(self):
        """成功：目标在最小射程边界."""
        attack = {
            "originalTargetPosition": [9, 5],  # 距离 4
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

    def test_too_close(self):
        """失败：目标太近."""
        attack = {
            "originalTargetPosition": [6, 5],  # 距离 1 < 4-1
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is False
        assert "目标太近" in err

    def test_upgraded_building_range(self):
        """成功：升级建筑射程增加."""
        # level 3: range * 3^0.1 = 4 * 1.116 = 4.46
        # max_range * 3^0.1 = 8 * 1.116 = 8.93
        attack = {
            "originalTargetPosition": [14, 5],  # 距离 9，在升级后射程内
        }
        building = {"id": "b-001", "type": "cannon", "level": 3, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_tolerance_at_max_range(self):
        """成功：利用 1 格容差."""
        attack = {
            "originalTargetPosition": [14, 5],  # 距离 9 = 8 + 1（容差内）
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
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
        """成功：3 级建筑的伤害."""
        # level 2: 12 * 1.2 = 14.4 -> 14
        # level 3: 14 * 1.2 = 16.8 -> 16
        attack = {"damage": 16}
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


class TestValidateMonsterPaths:
    """怪物路径合理性验证测试."""

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


class TestValidateAttacks:
    """攻击事件综合验证测试."""

    def test_success_complete_validation(self):
        """成功：完整的攻击事件验证."""
        attacks = [
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 10,
                "damage": 12,
                "originalTargetPosition": [10, 5],
                "monsterPosition": [10, 5],
            },
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 20,
                "damage": 12,
                "originalTargetPosition": [11, 6],
                "monsterPosition": [11, 6],
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
