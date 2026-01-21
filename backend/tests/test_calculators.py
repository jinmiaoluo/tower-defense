"""计算器单元测试."""

from game.calculators import (
    calc_actual_damage,
    calc_hit_score,
    calc_life_reward,
    calc_monster_attrs,
    calc_new_difficulty,
    calc_total_cost,
    process_actions,
)
from game.config import GAME_CONFIG


class TestCalcTotalCost:
    """calc_total_cost 测试."""

    def test_level_1_cannon(self):
        """1 级炮台：只有建造成本."""
        assert calc_total_cost("cannon", 1, GAME_CONFIG) == 300

    def test_level_2_cannon(self):
        """2 级炮台：建造 + 1 次升级.

        升级成本 = 累计花费 × 0.75 = 300 × 0.75 = 225
        总计 = 300 + 225 = 525
        """
        assert calc_total_cost("cannon", 2, GAME_CONFIG) == 525

    def test_level_3_cannon(self):
        """3 级炮台：建造 + 2 次升级.

        第 1 次升级 = 300 × 0.75 = 225，累计 525
        第 2 次升级 = 525 × 0.75 = 393（取整）
        总计 = 525 + 393 = 918
        """
        assert calc_total_cost("cannon", 3, GAME_CONFIG) == 918

    def test_level_1_wall(self):
        """1 级路障."""
        assert calc_total_cost("wall", 1, GAME_CONFIG) == 5

    def test_level_1_lmg(self):
        """1 级轻机枪."""
        assert calc_total_cost("LMG", 1, GAME_CONFIG) == 100

    def test_level_1_hmg(self):
        """1 级重机枪."""
        assert calc_total_cost("HMG", 1, GAME_CONFIG) == 800

    def test_level_1_laser_gun(self):
        """1 级激光枪."""
        assert calc_total_cost("laser_gun", 1, GAME_CONFIG) == 2000

    def test_level_5_cannon(self):
        """5 级炮台：验证多次升级累计.

        Level 1: 300
        Level 2: 300 + 225 = 525
        Level 3: 525 + 393 = 918
        Level 4: 918 + 688 = 1606
        Level 5: 1606 + 1204 = 2810
        """
        assert calc_total_cost("cannon", 5, GAME_CONFIG) == 2810


class TestProcessActions:
    """process_actions 测试."""

    def test_build_cannon(self):
        """建造炮台."""
        actions = [
            {
                "type": "BUILD",
                "buildingType": "cannon",
                "buildingId": "b-001",
                "position": [5, 5],
                "frame": 100,
            }
        ]
        spent, income, buildings = process_actions(actions, [], GAME_CONFIG)
        assert spent == 300
        assert income == 0
        assert len(buildings) == 1
        assert buildings[0]["type"] == "cannon"
        assert buildings[0]["level"] == 1
        assert buildings[0]["position"] == [5, 5]

    def test_upgrade_cannon(self):
        """升级炮台.

        升级成本 = 累计花费 × 0.75 = 300 × 0.75 = 225
        """
        session_buildings = [{"id": "b-001", "type": "cannon", "level": 1}]
        actions = [
            {"type": "UPGRADE", "buildingId": "b-001", "level": 2, "frame": 200}
        ]
        spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
        assert spent == 225
        assert income == 0
        assert buildings[0]["level"] == 2

    def test_sell_cannon(self):
        """出售炮台.

        出售收入 = 累计花费 × 0.5 = 300 × 0.5 = 150
        """
        session_buildings = [{"id": "b-001", "type": "cannon", "level": 1}]
        actions = [{"type": "SELL", "buildingId": "b-001", "frame": 300}]
        spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
        assert spent == 0
        assert income == 150
        assert len(buildings) == 0

    def test_sell_wall_minimum_income(self):
        """出售路障：最低收入为 1.

        路障 cost = 5，出售收入 = 5 × 0.5 = 2（取整后为 2）
        """
        session_buildings = [{"id": "b-001", "type": "wall", "level": 1}]
        actions = [{"type": "SELL", "buildingId": "b-001", "frame": 100}]
        spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
        assert income == 2

    def test_build_upgrade_sell_sequence(self):
        """建造 → 升级 → 出售序列.

        1. 建造 cannon: spent += 300, 累计 = 300
        2. 升级到 level 2: spent += 300 × 0.75 = 225, 累计 = 525
        3. 出售: income += 525 × 0.5 = 262
        """
        actions = [
            {
                "type": "BUILD",
                "buildingType": "cannon",
                "buildingId": "b-001",
                "position": [5, 5],
                "frame": 100,
            },
            {"type": "UPGRADE", "buildingId": "b-001", "level": 2, "frame": 200},
            {"type": "SELL", "buildingId": "b-001", "frame": 300},
        ]
        spent, income, buildings = process_actions(actions, [], GAME_CONFIG)
        assert spent == 300 + 225  # 525
        assert income == 262  # int(525 * 0.5)
        assert len(buildings) == 0

    def test_actions_sorted_by_frame(self):
        """操作按 frame 排序处理.

        即使输入顺序乱序，也应按 frame 正确处理。
        """
        actions = [
            {"type": "UPGRADE", "buildingId": "b-001", "level": 2, "frame": 200},
            {
                "type": "BUILD",
                "buildingType": "cannon",
                "buildingId": "b-001",
                "position": [5, 5],
                "frame": 100,
            },
        ]
        spent, income, buildings = process_actions(actions, [], GAME_CONFIG)
        assert spent == 300 + 225
        assert buildings[0]["level"] == 2

    def test_multiple_buildings(self):
        """多个建筑操作."""
        actions = [
            {
                "type": "BUILD",
                "buildingType": "cannon",
                "buildingId": "b-001",
                "position": [5, 5],
                "frame": 100,
            },
            {
                "type": "BUILD",
                "buildingType": "LMG",
                "buildingId": "b-002",
                "position": [6, 6],
                "frame": 150,
            },
        ]
        spent, income, buildings = process_actions(actions, [], GAME_CONFIG)
        assert spent == 300 + 100  # cannon + LMG
        assert len(buildings) == 2

    def test_upgrade_level_2_cannon_then_sell(self):
        """升级到 level 2 后出售.

        累计花费 = 525，出售收入 = 525 × 0.5 = 262
        """
        session_buildings = [{"id": "b-001", "type": "cannon", "level": 2}]
        actions = [{"type": "SELL", "buildingId": "b-001", "frame": 100}]
        spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
        assert income == 262


class TestCalcNewDifficulty:
    """calc_new_difficulty 测试."""

    def test_wave_1_no_adjustment(self):
        """第 1 波不调整难度（教学波）."""
        assert calc_new_difficulty(1.0, 0, 1) == 1.0
        assert calc_new_difficulty(1.0, 10, 1) == 1.0
        assert calc_new_difficulty(2.0, 50, 1) == 2.0

    def test_no_damage_early_wave(self):
        """早期波次（wave < 5）无伤：×1.05."""
        assert calc_new_difficulty(1.0, 0, 3) == 1.05

    def test_no_damage_late_wave(self):
        """后期波次（wave >= 5）无伤且 difficulty <= 30：×1.2."""
        assert calc_new_difficulty(1.0, 0, 5) == 1.2
        assert calc_new_difficulty(1.0, 0, 10) == 1.2
        assert calc_new_difficulty(30.0, 0, 5) == 36.0  # 30 * 1.2

    def test_no_damage_high_difficulty(self):
        """高难度（difficulty > 30）无伤：×1.1（减缓增长）."""
        import pytest

        assert calc_new_difficulty(31.0, 0, 5) == pytest.approx(34.1)  # 31 * 1.1
        assert calc_new_difficulty(50.0, 0, 10) == pytest.approx(55.0)  # 50 * 1.1

    def test_heavy_damage_50_plus(self):
        """重伤（>= 50）：×0.6."""
        assert calc_new_difficulty(2.0, 50, 5) == 1.2  # 2.0 * 0.6
        assert calc_new_difficulty(2.0, 60, 5) == 1.2

    def test_damage_30_to_49(self):
        """伤害 30-49：×0.7."""
        assert calc_new_difficulty(2.0, 30, 5) == 1.4  # 2.0 * 0.7
        assert calc_new_difficulty(2.0, 49, 5) == 1.4

    def test_damage_20_to_29(self):
        """伤害 20-29：×0.8."""
        assert calc_new_difficulty(2.0, 20, 5) == 1.6  # 2.0 * 0.8
        assert calc_new_difficulty(2.0, 29, 5) == 1.6

    def test_damage_10_to_19(self):
        """伤害 10-19：×0.9."""
        assert calc_new_difficulty(2.0, 10, 5) == 1.8  # 2.0 * 0.9
        assert calc_new_difficulty(2.0, 19, 5) == 1.8

    def test_low_damage_early_wave(self):
        """低伤害（< 10）早期波次（wave < 10）：×1.0（不变）."""
        assert calc_new_difficulty(2.0, 5, 5) == 2.0
        assert calc_new_difficulty(2.0, 9, 9) == 2.0

    def test_low_damage_late_wave(self):
        """低伤害（< 10）后期波次（wave >= 10）：×1.05."""
        assert calc_new_difficulty(2.0, 5, 10) == 2.1  # 2.0 * 1.05
        assert calc_new_difficulty(2.0, 9, 15) == 2.1

    def test_min_difficulty_is_1(self):
        """难度最小值为 1.0."""
        assert calc_new_difficulty(0.5, 50, 5) == 1.0  # 0.5 * 0.6 = 0.3 → 1.0
        assert calc_new_difficulty(1.0, 50, 5) == 1.0  # 1.0 * 0.6 = 0.6 → 1.0

    def test_high_difficulty_accumulation(self):
        """高难度累积."""
        # 连续无伤通关
        d = 1.0
        d = calc_new_difficulty(d, 0, 5)   # 1.0 * 1.2 = 1.2
        assert d == 1.2
        d = calc_new_difficulty(d, 0, 6)   # 1.2 * 1.2 = 1.44
        assert d == 1.44


class TestCalcActualDamage:
    """calc_actual_damage 测试.

    伤害计算公式：actual = max(raw - shield, ceil(raw * 0.1))
    来源：旧实现 td-obj-monster.js:78-83
    """

    def test_no_shield(self):
        """无护盾：伤害 = 原始伤害."""
        assert calc_actual_damage(12, 0) == 12

    def test_with_shield(self):
        """有护盾：伤害 = 原始伤害 - 护盾."""
        assert calc_actual_damage(12, 5) == 7  # 12 - 5 = 7

    def test_high_shield_uses_min_damage(self):
        """高护盾：使用最低伤害（10%）.

        当 raw - shield < ceil(raw * 0.1) 时，使用最低伤害。
        12 - 20 = -8，但 min_damage = ceil(12 * 0.1) = 2
        """
        assert calc_actual_damage(12, 20) == 2

    def test_min_damage_guarantees_effectiveness(self):
        """最低伤害保证高攻武器对高护盾怪有效.

        30 - 100 = -70，但 min_damage = ceil(30 * 0.1) = 3
        """
        assert calc_actual_damage(30, 100) == 3

    def test_shield_equals_damage(self):
        """护盾等于伤害：使用最低伤害.

        12 - 12 = 0，但 min_damage = ceil(12 * 0.1) = 2
        """
        assert calc_actual_damage(12, 12) == 2

    def test_shield_slightly_less_than_damage(self):
        """护盾略小于伤害：取较大值.

        12 - 10 = 2，min_damage = ceil(12 * 0.1) = 2
        两者相等，返回 2
        """
        assert calc_actual_damage(12, 10) == 2

    def test_min_damage_ceiling(self):
        """最低伤害向上取整.

        15 * 0.1 = 1.5 → ceil = 2
        """
        assert calc_actual_damage(15, 100) == 2

    def test_small_damage(self):
        """小伤害值.

        5 - 0 = 5
        """
        assert calc_actual_damage(5, 0) == 5

    def test_small_damage_with_high_shield(self):
        """小伤害 + 高护盾.

        5 - 50 = -45，min_damage = ceil(5 * 0.1) = 1
        """
        assert calc_actual_damage(5, 50) == 1

    def test_single_damage(self):
        """1 点伤害.

        1 - 0 = 1，min_damage = ceil(1 * 0.1) = 1
        """
        assert calc_actual_damage(1, 0) == 1
        assert calc_actual_damage(1, 10) == 1


class TestCalcMonsterAttrs:
    """calc_monster_attrs tests.

    Source: td-obj-monster.js:24-35 (with random factors)

    Formulas (with random factors):
    - speed: (base + difficulty / 2) * random(0.75, 1.25)
    - life: int(base * (difficulty + 1) * random(0.5, 1.5) * 0.5)
    - shield: int(base + difficulty / 2)  # no random
    - money is not affected by difficulty
    """

    def test_life_in_random_range(self):
        """Life value falls within random range.

        Formula: life = int(base * (difficulty + 1) * random(0.5, 1.5) * 0.5)
        base=50, difficulty=1.0:
        - median = 50 * 2 * 1.0 * 0.5 = 50
        - min = 50 * 2 * 0.5 * 0.5 = 25
        - max = 50 * 2 * 1.5 * 0.5 = 75
        """
        base = {"life": 50, "speed": 3, "shield": 0, "money": 10}
        for _ in range(20):
            result = calc_monster_attrs(base, 1.0)
            assert 25 <= result["life"] < 75

    def test_speed_in_random_range(self):
        """Speed value falls within random range.

        Formula: speed = (base + difficulty / 2) * random(0.75, 1.25)
        base=3, difficulty=1.0:
        - base_value = 3 + 0.5 = 3.5
        - min = 3.5 * 0.75 = 2.625
        - max = 3.5 * 1.25 = 4.375
        """
        base = {"life": 50, "speed": 3, "shield": 0, "money": 10}
        for _ in range(20):
            result = calc_monster_attrs(base, 1.0)
            assert 2.625 <= result["speed"] < 4.375

    def test_shield_is_deterministic(self):
        """Shield calculation is deterministic (no random).

        Formula: shield = int(base + difficulty / 2)
        base=10, difficulty=2.0:
        - shield = int(10 + 1.0) = 11
        """
        base = {"life": 50, "speed": 3, "shield": 10, "money": 10}
        results = [calc_monster_attrs(base, 2.0)["shield"] for _ in range(10)]
        assert all(s == 11 for s in results)

    def test_randomness_produces_different_values(self):
        """Multiple calls produce different values (verify randomness)."""
        base = {"life": 50, "speed": 3, "shield": 0, "money": 10}
        life_values = set()
        speed_values = set()
        for _ in range(50):
            result = calc_monster_attrs(base, 1.0)
            life_values.add(result["life"])
            speed_values.add(round(result["speed"], 2))
        assert len(life_values) > 10, f"life should have multiple values, got {life_values}"
        assert len(speed_values) > 10, f"speed should have multiple values, got {speed_values}"

    def test_preserves_other_attributes(self):
        """Preserves other attributes. Money is not affected by difficulty."""
        base = {
            "name": "Normal",
            "life": 50,
            "speed": 3,
            "shield": 0,
            "damage": 1,
            "money": 5,
            "color": "#00ff00",
        }
        result = calc_monster_attrs(base, 5.0)
        assert result["name"] == "Normal"
        assert result["damage"] == 1
        assert result["money"] == 5
        assert result["color"] == "#00ff00"

    def test_does_not_mutate_base(self):
        """Does not mutate original base dict."""
        base = {"life": 50, "speed": 3, "shield": 0, "money": 10}
        base_copy = base.copy()
        calc_monster_attrs(base, 5.0)
        assert base == base_copy

    def test_max_speed_limit(self):
        """Speed does not exceed max_speed.

        Source td-obj-monster.js:28:
        if (this.speed > cfg.max_speed) this.speed = cfg.max_speed;
        """
        base = {"life": 50, "speed": 30, "max_speed": 10, "shield": 0, "money": 10}
        for _ in range(20):
            result = calc_monster_attrs(base, 20.0)
            assert result["speed"] == 10

    def test_min_speed_is_1(self):
        """Minimum speed is 1.

        if (this.speed < 1) this.speed = 1;
        """
        base = {"life": 50, "speed": 0, "max_speed": 10, "shield": 0, "money": 10}
        for _ in range(20):
            result = calc_monster_attrs(base, 0.0)
            assert result["speed"] >= 1

    def test_min_life_is_1(self):
        """Minimum life is 1"""
        base = {"life": 1, "speed": 3, "max_speed": 10, "shield": 0, "money": 10}
        for _ in range(20):
            result = calc_monster_attrs(base, 0.0)
            assert result["life"] >= 1

    def test_min_shield_is_0(self):
        """Minimum shield is 0."""
        base = {"life": 50, "speed": 3, "max_speed": 10, "shield": -5, "money": 10}
        result = calc_monster_attrs(base, 0.0)
        assert result["shield"] == 0

    def test_no_max_speed_field(self):
        """Speed is unlimited when max_speed field is absent"""
        base = {"life": 50, "speed": 3, "shield": 0, "money": 10}
        for _ in range(20):
            result = calc_monster_attrs(base, 100.0)
            # base = 3 + 50 = 53, range = 53 * 0.75 ~ 53 * 1.25
            assert 39.75 <= result["speed"] < 66.25

    def test_no_max_speed_and_speed_below_1(self):
        """When no max_speed and calculated speed < 1, minimum is still 1.

        This is a critical edge case:
        - No max_speed field
        - Calculated speed < 1

        Wrong implementation returns 0, correct implementation returns 1.
        """
        base = {"life": 50, "speed": 0, "shield": 0, "money": 10}  # no max_speed
        result = calc_monster_attrs(base, 0.0)  # speed = 0 + 0/2 = 0
        assert result["speed"] == 1  # min constraint still applies


class TestCalcLifeReward:
    """calc_life_reward 测试.

    波次奖励规则：
    - 每 10 波: +10 生命
    - 每 5 波（非 10 的倍数）: +5 生命
    - 其他波次: 0

    来源：旧实现 td-data-stage-1.js:62-73
    """

    def test_normal_wave_no_reward(self):
        """普通波次无奖励."""
        assert calc_life_reward(1) == 0
        assert calc_life_reward(2) == 0
        assert calc_life_reward(3) == 0
        assert calc_life_reward(4) == 0
        assert calc_life_reward(7) == 0
        assert calc_life_reward(9) == 0

    def test_every_5_waves(self):
        """每 5 波（非 10 的倍数）奖励 5 生命."""
        assert calc_life_reward(5) == 5
        assert calc_life_reward(15) == 5
        assert calc_life_reward(25) == 5
        assert calc_life_reward(35) == 5

    def test_every_10_waves(self):
        """每 10 波奖励 10 生命（覆盖 5 的规则）."""
        assert calc_life_reward(10) == 10
        assert calc_life_reward(20) == 10
        assert calc_life_reward(30) == 10
        assert calc_life_reward(100) == 10

    def test_wave_6_to_9_no_reward(self):
        """6-9 波无奖励."""
        assert calc_life_reward(6) == 0
        assert calc_life_reward(7) == 0
        assert calc_life_reward(8) == 0
        assert calc_life_reward(9) == 0

    def test_wave_11_to_14_no_reward(self):
        """11-14 波无奖励."""
        assert calc_life_reward(11) == 0
        assert calc_life_reward(12) == 0
        assert calc_life_reward(13) == 0
        assert calc_life_reward(14) == 0

    def test_high_wave_numbers(self):
        """高波次测试."""
        assert calc_life_reward(45) == 5   # 45 % 5 == 0, 45 % 10 != 0
        assert calc_life_reward(50) == 10  # 50 % 10 == 0
        assert calc_life_reward(55) == 5   # 55 % 5 == 0, 55 % 10 != 0


class TestBuildValidationBuildings:
    """build_validation_buildings 测试.

    该函数用于构建验证攻击事件用的建筑列表。
    与 process_actions 的区别是：不执行 SELL 操作，
    因为攻击可能发生在建筑被出售之前。
    """

    def test_build_only(self):
        """成功：只有 BUILD 操作."""
        from game.calculators import build_validation_buildings

        actions = [
            {
                "type": "BUILD",
                "buildingType": "cannon",
                "buildingId": "b-001",
                "position": [5, 5],
                "frame": 100,
            }
        ]
        buildings = build_validation_buildings(actions, [])
        assert len(buildings) == 1
        assert buildings[0]["id"] == "b-001"
        assert buildings[0]["type"] == "cannon"
        assert buildings[0]["level"] == 1
        assert buildings[0]["position"] == [5, 5]

    def test_build_and_upgrade(self):
        """成功：BUILD + UPGRADE 操作."""
        from game.calculators import build_validation_buildings

        actions = [
            {
                "type": "BUILD",
                "buildingType": "cannon",
                "buildingId": "b-001",
                "position": [5, 5],
                "frame": 100,
            },
            {
                "type": "UPGRADE",
                "buildingId": "b-001",
                "level": 2,
                "frame": 200,
            },
        ]
        buildings = build_validation_buildings(actions, [])
        assert len(buildings) == 1
        assert buildings[0]["level"] == 2

    def test_sell_not_executed(self):
        """关键：SELL 操作不执行，建筑仍保留在列表中."""
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        ]
        actions = [{"type": "SELL", "buildingId": "b-001", "frame": 300}]
        buildings = build_validation_buildings(actions, session_buildings)
        # 与 process_actions 不同，建筑不会被移除
        assert len(buildings) == 1
        assert buildings[0]["id"] == "b-001"

    def test_attack_before_sell(self):
        """核心场景：攻击发生在出售之前，验证时建筑必须存在.

        这是修复 '未知建筑: b-1' 问题的核心测试。
        """
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-1", "type": "LMG", "level": 1, "position": [2, 2]},
            {"id": "b-2", "type": "cannon", "level": 1, "position": [3, 3]},
        ]
        # 攻击在帧 2025-2291，出售在帧 2296
        actions = [{"type": "SELL", "buildingId": "b-1", "frame": 2296}]
        buildings = build_validation_buildings(actions, session_buildings)
        # 两个建筑都必须存在（用于验证攻击）
        building_ids = {b["id"] for b in buildings}
        assert "b-1" in building_ids
        assert "b-2" in building_ids

    def test_from_session_buildings(self):
        """成功：继承上一波的建筑."""
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-001", "type": "cannon", "level": 2, "position": [5, 5]}
        ]
        actions = []  # 无操作
        buildings = build_validation_buildings(actions, session_buildings)
        assert len(buildings) == 1
        assert buildings[0]["id"] == "b-001"
        assert buildings[0]["level"] == 2
        assert buildings[0]["position"] == [5, 5]

    def test_upgrade_existing_building(self):
        """成功：升级上一波的建筑."""
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        ]
        actions = [{"type": "UPGRADE", "buildingId": "b-001", "level": 2, "frame": 100}]
        buildings = build_validation_buildings(actions, session_buildings)
        assert buildings[0]["level"] == 2

    def test_multiple_operations(self):
        """复杂场景：多个建筑的混合操作."""
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-001", "type": "LMG", "level": 1, "position": [2, 2]}
        ]
        actions = [
            {
                "type": "BUILD",
                "buildingType": "cannon",
                "buildingId": "b-002",
                "position": [3, 3],
                "frame": 100,
            },
            {"type": "UPGRADE", "buildingId": "b-002", "level": 2, "frame": 200},
            {"type": "SELL", "buildingId": "b-001", "frame": 300},  # 不执行
        ]
        buildings = build_validation_buildings(actions, session_buildings)
        # 两个建筑都在
        assert len(buildings) == 2
        building_map = {b["id"]: b for b in buildings}
        assert "b-001" in building_map
        assert "b-002" in building_map
        assert building_map["b-002"]["level"] == 2


class TestCalcHitScore:
    """calc_hit_score 测试.

    命中得分公式：score = floor(sqrt(actual_damage))
    每次攻击命中时立即加分，而非击杀时加分。

    来源：旧实现 td-obj-monster.js:85
    """

    def test_perfect_squares(self):
        """完全平方数：得分 = 平方根."""
        assert calc_hit_score(1) == 1    # sqrt(1) = 1
        assert calc_hit_score(4) == 2    # sqrt(4) = 2
        assert calc_hit_score(9) == 3    # sqrt(9) = 3
        assert calc_hit_score(16) == 4   # sqrt(16) = 4
        assert calc_hit_score(25) == 5   # sqrt(25) = 5
        assert calc_hit_score(100) == 10 # sqrt(100) = 10

    def test_floor_behavior(self):
        """非完全平方数：向下取整.

        sqrt(10) ≈ 3.16 -> 3
        sqrt(15) ≈ 3.87 -> 3
        sqrt(24) ≈ 4.90 -> 4
        """
        assert calc_hit_score(10) == 3
        assert calc_hit_score(15) == 3
        assert calc_hit_score(24) == 4

    def test_small_damage(self):
        """小伤害值.

        伤害 2: sqrt(2) ≈ 1.41 -> 1
        伤害 3: sqrt(3) ≈ 1.73 -> 1
        """
        assert calc_hit_score(2) == 1
        assert calc_hit_score(3) == 1

    def test_typical_weapon_damage(self):
        """典型武器伤害值.

        LMG damage=5: sqrt(5) ≈ 2.24 -> 2
        cannon damage=12: sqrt(12) ≈ 3.46 -> 3
        laser_gun damage=25: sqrt(25) = 5
        HMG damage=30: sqrt(30) ≈ 5.48 -> 5
        """
        assert calc_hit_score(5) == 2   # LMG
        assert calc_hit_score(12) == 3  # cannon
        assert calc_hit_score(25) == 5  # laser_gun
        assert calc_hit_score(30) == 5  # HMG

    def test_high_damage(self):
        """高伤害值（升级后的武器）.

        damage=50: sqrt(50) ≈ 7.07 -> 7
        damage=200: sqrt(200) ≈ 14.14 -> 14
        """
        assert calc_hit_score(50) == 7
        assert calc_hit_score(200) == 14

    def test_score_accumulation_example(self):
        """验证累计得分计算.

        场景：激光枪 (damage=25, speed=20) vs HMG (damage=30, speed=3)
        假设同等时间内：
        - 激光枪攻击 20 次: 20 × floor(sqrt(25)) = 20 × 5 = 100 分
        - HMG 攻击 3 次: 3 × floor(sqrt(30)) = 3 × 5 = 15 分

        这体现了高攻速武器在得分上的优势。
        """
        laser_score_per_hit = calc_hit_score(25)
        hmg_score_per_hit = calc_hit_score(30)

        assert laser_score_per_hit == 5
        assert hmg_score_per_hit == 5

        # 同等时间内（假设 60 帧）
        laser_total = laser_score_per_hit * 20  # speed=20, 攻击 20 次
        hmg_total = hmg_score_per_hit * 3       # speed=3, 攻击 3 次

        assert laser_total == 100
        assert hmg_total == 15
