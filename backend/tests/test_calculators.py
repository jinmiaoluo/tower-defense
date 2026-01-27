"""Calculator unit tests."""

from game.calculators import (
    calc_actual_damage,
    calc_hit_score,
    calc_life_reward,
    calc_monster_attrs,
    calc_new_difficulty,
    calc_total_cost,
    process_actions,
)
from game.config import GAME_CONFIG, MonsterAttrs


class TestCalcTotalCost:

    def test_level_1_cannon(self):
        """Level 1 cannon: build cost only."""
        assert calc_total_cost("cannon", 1, GAME_CONFIG) == 300

    def test_level_2_cannon(self):
        """Level 2 cannon: build + 1 upgrade.

        Upgrade cost = cumulative * 0.75 = 300 * 0.75 = 225
        Total = 300 + 225 = 525
        """
        assert calc_total_cost("cannon", 2, GAME_CONFIG) == 525

    def test_level_3_cannon(self):
        """Level 3 cannon: build + 2 upgrades.

        Upgrade 1 = 300 * 0.75 = 225, cumulative = 525
        Upgrade 2 = 525 * 0.75 = 393 (floored)
        Total = 525 + 393 = 918
        """
        assert calc_total_cost("cannon", 3, GAME_CONFIG) == 918

    def test_level_1_wall(self):
        assert calc_total_cost("wall", 1, GAME_CONFIG) == 5

    def test_level_1_lmg(self):
        assert calc_total_cost("LMG", 1, GAME_CONFIG) == 100

    def test_level_1_hmg(self):
        assert calc_total_cost("HMG", 1, GAME_CONFIG) == 800

    def test_level_1_laser_gun(self):
        assert calc_total_cost("laser_gun", 1, GAME_CONFIG) == 2000

    def test_level_5_cannon(self):
        """Level 5 cannon: verify multi-upgrade accumulation.

        Level 1: 300
        Level 2: 300 + 225 = 525
        Level 3: 525 + 393 = 918
        Level 4: 918 + 688 = 1606
        Level 5: 1606 + 1204 = 2810
        """
        assert calc_total_cost("cannon", 5, GAME_CONFIG) == 2810


class TestProcessActions:

    def test_build_cannon(self):
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
        """Upgrade cost = cumulative * 0.75 = 300 * 0.75 = 225."""
        session_buildings = [{"id": "b-001", "type": "cannon", "level": 1}]
        actions = [
            {"type": "UPGRADE", "buildingId": "b-001", "level": 2, "frame": 200}
        ]
        spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
        assert spent == 225
        assert income == 0
        assert buildings[0]["level"] == 2

    def test_sell_cannon(self):
        """Sell income = cumulative * 0.5 = 300 * 0.5 = 150."""
        session_buildings = [{"id": "b-001", "type": "cannon", "level": 1}]
        actions = [{"type": "SELL", "buildingId": "b-001", "frame": 300}]
        spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
        assert spent == 0
        assert income == 150
        assert len(buildings) == 0

    def test_sell_wall_minimum_income(self):
        """Wall cost = 5, sell income = 5 * 0.5 = 2 (floored)."""
        session_buildings = [{"id": "b-001", "type": "wall", "level": 1}]
        actions = [{"type": "SELL", "buildingId": "b-001", "frame": 100}]
        spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
        assert income == 2

    def test_build_upgrade_sell_sequence(self):
        """Build -> upgrade -> sell sequence.

        1. Build cannon: spent += 300, cumulative = 300
        2. Upgrade to level 2: spent += 300 * 0.75 = 225, cumulative = 525
        3. Sell: income += 525 * 0.5 = 262
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
        """Actions are processed in frame order regardless of input order."""
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
        """Cumulative cost = 525, sell income = 525 * 0.5 = 262."""
        session_buildings = [{"id": "b-001", "type": "cannon", "level": 2}]
        actions = [{"type": "SELL", "buildingId": "b-001", "frame": 100}]
        spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
        assert income == 262


class TestCalcNewDifficulty:

    def test_wave_1_no_adjustment(self):
        """Wave 1 is a tutorial wave; no difficulty adjustment."""
        assert calc_new_difficulty(1.0, 0, 1) == 1.0
        assert calc_new_difficulty(1.0, 10, 1) == 1.0
        assert calc_new_difficulty(2.0, 50, 1) == 2.0

    def test_no_damage_early_wave(self):
        """Early wave (wave < 5) no damage: x1.05."""
        assert calc_new_difficulty(1.0, 0, 3) == 1.05

    def test_no_damage_late_wave(self):
        """Late wave (wave >= 5) no damage, difficulty <= 30: x1.2."""
        assert calc_new_difficulty(1.0, 0, 5) == 1.2
        assert calc_new_difficulty(1.0, 0, 10) == 1.2
        assert calc_new_difficulty(30.0, 0, 5) == 36.0  # 30 * 1.2

    def test_no_damage_high_difficulty(self):
        """High difficulty (> 30) no damage: x1.1 (slower growth)."""
        import pytest

        assert calc_new_difficulty(31.0, 0, 5) == pytest.approx(34.1)  # 31 * 1.1
        assert calc_new_difficulty(50.0, 0, 10) == pytest.approx(55.0)  # 50 * 1.1

    def test_heavy_damage_50_plus(self):
        """Heavy damage (>= 50): x0.6."""
        assert calc_new_difficulty(2.0, 50, 5) == 1.2  # 2.0 * 0.6
        assert calc_new_difficulty(2.0, 60, 5) == 1.2

    def test_damage_30_to_49(self):
        """Damage 30-49: x0.7."""
        assert calc_new_difficulty(2.0, 30, 5) == 1.4  # 2.0 * 0.7
        assert calc_new_difficulty(2.0, 49, 5) == 1.4

    def test_damage_20_to_29(self):
        """Damage 20-29: x0.8."""
        assert calc_new_difficulty(2.0, 20, 5) == 1.6  # 2.0 * 0.8
        assert calc_new_difficulty(2.0, 29, 5) == 1.6

    def test_damage_10_to_19(self):
        """Damage 10-19: x0.9."""
        assert calc_new_difficulty(2.0, 10, 5) == 1.8  # 2.0 * 0.9
        assert calc_new_difficulty(2.0, 19, 5) == 1.8

    def test_low_damage_early_wave(self):
        """Low damage (< 10) early wave (wave < 10): x1.0 (unchanged)."""
        assert calc_new_difficulty(2.0, 5, 5) == 2.0
        assert calc_new_difficulty(2.0, 9, 9) == 2.0

    def test_low_damage_late_wave(self):
        """Low damage (< 10) late wave (wave >= 10): x1.05."""
        assert calc_new_difficulty(2.0, 5, 10) == 2.1  # 2.0 * 1.05
        assert calc_new_difficulty(2.0, 9, 15) == 2.1

    def test_min_difficulty_is_1(self):
        """Minimum difficulty is 1.0."""
        assert calc_new_difficulty(0.5, 50, 5) == 1.0  # 0.5 * 0.6 = 0.3 -> 1.0
        assert calc_new_difficulty(1.0, 50, 5) == 1.0  # 1.0 * 0.6 = 0.6 -> 1.0

    def test_high_difficulty_accumulation(self):
        """Consecutive no-damage waves accumulate difficulty."""
        d = 1.0
        d = calc_new_difficulty(d, 0, 5)   # 1.0 * 1.2 = 1.2
        assert d == 1.2
        d = calc_new_difficulty(d, 0, 6)   # 1.2 * 1.2 = 1.44
        assert d == 1.44


class TestCalcActualDamage:
    """Source: td-obj-monster.js:78-83

    Formula: actual = max(raw - shield, ceil(raw * 0.1))
    """

    def test_no_shield(self):
        assert calc_actual_damage(12, 0) == 12

    def test_with_shield(self):
        """12 - 5 = 7."""
        assert calc_actual_damage(12, 5) == 7

    def test_high_shield_uses_min_damage(self):
        """When raw - shield < ceil(raw * 0.1), use minimum damage.

        12 - 20 = -8, but min_damage = ceil(12 * 0.1) = 2
        """
        assert calc_actual_damage(12, 20) == 2

    def test_min_damage_guarantees_effectiveness(self):
        """Minimum damage ensures high-attack weapons remain effective against high-shield monsters.

        30 - 100 = -70, but min_damage = ceil(30 * 0.1) = 3
        """
        assert calc_actual_damage(30, 100) == 3

    def test_shield_equals_damage(self):
        """12 - 12 = 0, but min_damage = ceil(12 * 0.1) = 2."""
        assert calc_actual_damage(12, 12) == 2

    def test_shield_slightly_less_than_damage(self):
        """12 - 10 = 2, min_damage = ceil(12 * 0.1) = 2; both equal, returns 2."""
        assert calc_actual_damage(12, 10) == 2

    def test_min_damage_ceiling(self):
        """15 * 0.1 = 1.5 -> ceil = 2."""
        assert calc_actual_damage(15, 100) == 2

    def test_small_damage(self):
        assert calc_actual_damage(5, 0) == 5

    def test_small_damage_with_high_shield(self):
        """5 - 50 = -45, min_damage = ceil(5 * 0.1) = 1."""
        assert calc_actual_damage(5, 50) == 1

    def test_single_damage(self):
        """1 - 0 = 1, min_damage = ceil(1 * 0.1) = 1."""
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
        base: MonsterAttrs = {"life": 50, "speed": 3, "shield": 0, "money": 10}
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
        base: MonsterAttrs = {"life": 50, "speed": 3, "shield": 0, "money": 10}
        for _ in range(20):
            result = calc_monster_attrs(base, 1.0)
            assert 2.625 <= result["speed"] < 4.375

    def test_shield_is_deterministic(self):
        """Shield calculation is deterministic (no random).

        Formula: shield = int(base + difficulty / 2)
        base=10, difficulty=2.0:
        - shield = int(10 + 1.0) = 11
        """
        base: MonsterAttrs = {"life": 50, "speed": 3, "shield": 10, "money": 10}
        results = [calc_monster_attrs(base, 2.0)["shield"] for _ in range(10)]
        assert all(s == 11 for s in results)

    def test_randomness_produces_different_values(self):
        """Multiple calls produce different values (verify randomness)."""
        base: MonsterAttrs = {"life": 50, "speed": 3, "shield": 0, "money": 10}
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
        base: MonsterAttrs = {
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
        base: MonsterAttrs = {"life": 50, "speed": 3, "shield": 0, "money": 10}
        base_copy = base.copy()
        calc_monster_attrs(base, 5.0)
        assert base == base_copy

    def test_max_speed_limit(self):
        """Speed does not exceed max_speed.

        Source td-obj-monster.js:28:
        if (this.speed > cfg.max_speed) this.speed = cfg.max_speed;
        """
        base: MonsterAttrs = {
            "life": 50, "speed": 30, "max_speed": 10, "shield": 0, "money": 10,
        }
        for _ in range(20):
            result = calc_monster_attrs(base, 20.0)
            assert result["speed"] == 10

    def test_min_speed_is_1(self):
        """Minimum speed is 1.

        if (this.speed < 1) this.speed = 1;
        """
        base: MonsterAttrs = {
            "life": 50, "speed": 0, "max_speed": 10, "shield": 0, "money": 10,
        }
        for _ in range(20):
            result = calc_monster_attrs(base, 0.0)
            assert result["speed"] >= 1

    def test_min_life_is_1(self):
        """Minimum life is 1."""
        base: MonsterAttrs = {
            "life": 1, "speed": 3, "max_speed": 10, "shield": 0, "money": 10,
        }
        for _ in range(20):
            result = calc_monster_attrs(base, 0.0)
            assert result["life"] >= 1

    def test_min_shield_is_0(self):
        """Minimum shield is 0."""
        base: MonsterAttrs = {
            "life": 50, "speed": 3, "max_speed": 10, "shield": -5, "money": 10,
        }
        result = calc_monster_attrs(base, 0.0)
        assert result["shield"] == 0

    def test_no_max_speed_field(self):
        """Speed is unlimited when max_speed field is absent."""
        base: MonsterAttrs = {"life": 50, "speed": 3, "shield": 0, "money": 10}
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
        base: MonsterAttrs = {"life": 50, "speed": 0, "shield": 0, "money": 10}
        result = calc_monster_attrs(base, 0.0)  # speed = 0 + 0/2 = 0
        assert result["speed"] == 1  # min constraint still applies


class TestCalcLifeReward:
    """Wave bonus rules (source: td-data-stage-1.js:62-73):

    - Every 10 waves: +10 life
    - Every 5 waves (not multiple of 10): +5 life
    - Other waves: 0
    """

    def test_normal_wave_no_reward(self):
        assert calc_life_reward(1) == 0
        assert calc_life_reward(2) == 0
        assert calc_life_reward(3) == 0
        assert calc_life_reward(4) == 0
        assert calc_life_reward(7) == 0
        assert calc_life_reward(9) == 0

    def test_every_5_waves(self):
        """Every 5 waves (not multiple of 10): +5 life."""
        assert calc_life_reward(5) == 5
        assert calc_life_reward(15) == 5
        assert calc_life_reward(25) == 5
        assert calc_life_reward(35) == 5

    def test_every_10_waves(self):
        """Every 10 waves: +10 life (overrides 5-wave rule)."""
        assert calc_life_reward(10) == 10
        assert calc_life_reward(20) == 10
        assert calc_life_reward(30) == 10
        assert calc_life_reward(100) == 10

    def test_wave_6_to_9_no_reward(self):
        assert calc_life_reward(6) == 0
        assert calc_life_reward(7) == 0
        assert calc_life_reward(8) == 0
        assert calc_life_reward(9) == 0

    def test_wave_11_to_14_no_reward(self):
        assert calc_life_reward(11) == 0
        assert calc_life_reward(12) == 0
        assert calc_life_reward(13) == 0
        assert calc_life_reward(14) == 0

    def test_high_wave_numbers(self):
        assert calc_life_reward(45) == 5   # 45 % 5 == 0, 45 % 10 != 0
        assert calc_life_reward(50) == 10  # 50 % 10 == 0
        assert calc_life_reward(55) == 5   # 55 % 5 == 0, 55 % 10 != 0


class TestBuildValidationBuildings:
    """Builds a building list for attack validation.

    Unlike process_actions, SELL operations are not executed because
    attacks may have occurred before the building was sold.
    """

    def test_build_only(self):
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
        """SELL is ignored; building remains in the list."""
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        ]
        actions = [{"type": "SELL", "buildingId": "b-001", "frame": 300}]
        buildings = build_validation_buildings(actions, session_buildings)
        assert len(buildings) == 1
        assert buildings[0]["id"] == "b-001"

    def test_attack_before_sell(self):
        """Attacks at frames 2025-2291, sell at frame 2296.

        Both buildings must exist for attack validation.
        """
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-1", "type": "LMG", "level": 1, "position": [2, 2]},
            {"id": "b-2", "type": "cannon", "level": 1, "position": [3, 3]},
        ]
        actions = [{"type": "SELL", "buildingId": "b-1", "frame": 2296}]
        buildings = build_validation_buildings(actions, session_buildings)
        building_ids = {b["id"] for b in buildings}
        assert "b-1" in building_ids
        assert "b-2" in building_ids

    def test_from_session_buildings(self):
        """Inherits buildings from previous wave."""
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-001", "type": "cannon", "level": 2, "position": [5, 5]}
        ]
        buildings = build_validation_buildings(actions=[], session_buildings=session_buildings)
        assert len(buildings) == 1
        assert buildings[0]["id"] == "b-001"
        assert buildings[0]["level"] == 2
        assert buildings[0]["position"] == [5, 5]

    def test_upgrade_existing_building(self):
        from game.calculators import build_validation_buildings

        session_buildings = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        ]
        actions = [{"type": "UPGRADE", "buildingId": "b-001", "level": 2, "frame": 100}]
        buildings = build_validation_buildings(actions, session_buildings)
        assert buildings[0]["level"] == 2

    def test_multiple_operations(self):
        """Mixed operations across multiple buildings."""
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
            {"type": "SELL", "buildingId": "b-001", "frame": 300},  # not executed
        ]
        buildings = build_validation_buildings(actions, session_buildings)
        assert len(buildings) == 2
        building_map = {b["id"]: b for b in buildings}
        assert "b-001" in building_map
        assert "b-002" in building_map
        assert building_map["b-002"]["level"] == 2


class TestCalcHitScore:
    """Hit score formula: score = floor(sqrt(actual_damage)).

    Score is awarded per hit, not per kill.
    Source: td-obj-monster.js:85
    """

    def test_perfect_squares(self):
        assert calc_hit_score(1) == 1     # sqrt(1) = 1
        assert calc_hit_score(4) == 2     # sqrt(4) = 2
        assert calc_hit_score(9) == 3     # sqrt(9) = 3
        assert calc_hit_score(16) == 4    # sqrt(16) = 4
        assert calc_hit_score(25) == 5    # sqrt(25) = 5
        assert calc_hit_score(100) == 10  # sqrt(100) = 10

    def test_floor_behavior(self):
        """Non-perfect squares are floored.

        sqrt(10) = 3.16 -> 3
        sqrt(15) = 3.87 -> 3
        sqrt(24) = 4.90 -> 4
        """
        assert calc_hit_score(10) == 3
        assert calc_hit_score(15) == 3
        assert calc_hit_score(24) == 4

    def test_small_damage(self):
        assert calc_hit_score(2) == 1  # sqrt(2) = 1.41 -> 1
        assert calc_hit_score(3) == 1  # sqrt(3) = 1.73 -> 1

    def test_typical_weapon_damage(self):
        """LMG=5, cannon=12, laser_gun=25, HMG=30."""
        assert calc_hit_score(5) == 2   # LMG
        assert calc_hit_score(12) == 3  # cannon
        assert calc_hit_score(25) == 5  # laser_gun
        assert calc_hit_score(30) == 5  # HMG

    def test_high_damage(self):
        """Upgraded weapons: sqrt(50)=7.07->7, sqrt(200)=14.14->14."""
        assert calc_hit_score(50) == 7
        assert calc_hit_score(200) == 14

    def test_score_accumulation_example(self):
        """Laser gun (damage=25, speed=20) vs HMG (damage=30, speed=3).

        In equal time:
        - Laser gun fires 20 times: 20 * floor(sqrt(25)) = 20 * 5 = 100 score
        - HMG fires 3 times: 3 * floor(sqrt(30)) = 3 * 5 = 15 score

        High attack speed weapons have a scoring advantage.
        """
        laser_score_per_hit = calc_hit_score(25)
        hmg_score_per_hit = calc_hit_score(30)

        assert laser_score_per_hit == 5
        assert hmg_score_per_hit == 5

        # In equal time (assuming 60 frames)
        laser_total = laser_score_per_hit * 20  # speed=20, fires 20 times
        hmg_total = hmg_score_per_hit * 3       # speed=3, fires 3 times

        assert laser_total == 100
        assert hmg_total == 15
