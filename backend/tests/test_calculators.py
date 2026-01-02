"""计算器单元测试."""

from game.calculators import calc_total_cost
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
