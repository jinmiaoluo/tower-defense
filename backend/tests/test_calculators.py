"""计算器单元测试."""

from game.calculators import calc_new_difficulty, calc_total_cost, process_actions
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
            {"type": "BUILD", "buildingType": "cannon", "buildingId": "b-001", "frame": 100}
        ]
        spent, income, buildings = process_actions(actions, [], GAME_CONFIG)
        assert spent == 300
        assert income == 0
        assert len(buildings) == 1
        assert buildings[0]["type"] == "cannon"
        assert buildings[0]["level"] == 1

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
            {"type": "BUILD", "buildingType": "cannon", "buildingId": "b-001", "frame": 100},
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
            {"type": "BUILD", "buildingType": "cannon", "buildingId": "b-001", "frame": 100},
        ]
        spent, income, buildings = process_actions(actions, [], GAME_CONFIG)
        assert spent == 300 + 225
        assert buildings[0]["level"] == 2

    def test_multiple_buildings(self):
        """多个建筑操作."""
        actions = [
            {"type": "BUILD", "buildingType": "cannon", "buildingId": "b-001", "frame": 100},
            {"type": "BUILD", "buildingType": "LMG", "buildingId": "b-002", "frame": 150},
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
