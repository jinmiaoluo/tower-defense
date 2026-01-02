"""计算器单元测试."""

from game.calculators import calc_total_cost, process_actions
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
