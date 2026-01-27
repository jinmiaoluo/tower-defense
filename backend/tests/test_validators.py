"""Validator unit tests."""

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
    """Wave continuity validation tests."""

    def test_first_wave_valid(self):
        """Pass: wave_count=0, submit wave_number=1."""
        session = Mock()
        session.wave_count = 0
        ok, err = validate_wave_continuity(session, 1)
        assert ok is True
        assert err == ""

    def test_second_wave_valid(self):
        """Pass: wave_count=1, submit wave_number=2."""
        session = Mock()
        session.wave_count = 1
        ok, err = validate_wave_continuity(session, 2)
        assert ok is True

    def test_skip_wave_invalid(self):
        """Fail: wave_count=1, submit wave_number=3 (skip)."""
        session = Mock()
        session.wave_count = 1
        ok, err = validate_wave_continuity(session, 3)
        assert ok is False
        assert "expected 2" in err
        assert "got 3" in err

    def test_repeat_wave_invalid(self):
        """Fail: wave_count=2, submit wave_number=2 (repeat)."""
        session = Mock()
        session.wave_count = 2
        ok, err = validate_wave_continuity(session, 2)
        assert ok is False
        assert "expected 3" in err


class TestValidateBasic:
    """Basic validation tests."""

    def test_success_single_type(self):
        """Pass: single monster type."""
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
        """Pass: multiple monster types."""
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
        """Pass: some monsters reached the exit."""
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
        """Fail: killed does not match killed_by_type sum."""
        result = {
            "killed": 5,  # wrong: actual 3
            "killed_by_type": {0: 3},
            "passed": 0,
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "Kill count mismatch" in err

    def test_unknown_monster_type(self):
        """Fail: unknown monster type."""
        result = {
            "killed": 3,
            "killed_by_type": {99: 3},  # nonexistent type
            "passed": 0,
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "Unknown monster type" in err

    def test_killed_exceeds_config(self):
        """Fail: kill count exceeds configured amount."""
        result = {
            "killed": 5,
            "killed_by_type": {0: 5},  # config only has 3
            "passed": 0,
            "money_gained": 25,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "kill count exceeds config" in err

    def test_total_mismatch(self):
        """Fail: killed + passed + remaining != total."""
        result = {
            "killed": 2,
            "killed_by_type": {0: 2},
            "passed": 0,  # total should be 3
            "remaining": 0,
            "money_gained": 10,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "Monster count mismatch" in err

    def test_success_with_remaining(self):
        """Pass: early end with remaining monsters on field."""
        result = {
            "killed": 1,
            "killed_by_type": {0: 1},
            "passed": 0,
            "remaining": 2,
            "money_gained": 5,  # only killed count
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_success_remaining_multiple_types(self):
        """Pass: early end with multiple monster types remaining."""
        result = {
            "killed": 2,
            "killed_by_type": {0: 1, 1: 1},
            "passed": 1,
            "remaining": 2,
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
        """Pass: remaining defaults to 0 (backward compat)."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            # no remaining field
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_remaining_exceeds_limit(self):
        """Fail: remaining exceeds total count."""
        result = {
            "killed": 1,
            "killed_by_type": {0: 1},
            "passed": 0,
            "remaining": 10,  # exceeds total 3
            "money_gained": 5,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "Monster count mismatch" in err

    def test_remaining_negative(self):
        """Fail: remaining is negative."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            "remaining": -1,
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "remaining cannot be negative" in err

    def test_money_mismatch(self):
        """Fail: money gained mismatch."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            "money_gained": 100,  # wrong, should be 15
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "Money gained mismatch" in err

    def test_success_with_spawned_partial(self):
        """Pass: early end with spawned < total (partial spawn).

        Wave 2 has 2 monsters configured, but only 1 spawned before
        early end. This matches the per-frame spawn mechanism in
        td-obj-map.js.
        """
        result = {
            "killed": 0,
            "killed_by_type": {},
            "passed": 0,
            "remaining": 1,
            "spawned": 1,
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
        """Pass: spawned == total (normal case)."""
        result = {
            "killed": 2,
            "killed_by_type": {0: 1, 1: 1},
            "passed": 0,
            "remaining": 0,
            "spawned": 2,
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
        """Pass: spawned defaults to total_monsters (backward compat)."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            # no spawned field
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True

    def test_spawned_exceeds_total(self):
        """Fail: spawned > total_monsters."""
        result = {
            "killed": 3,
            "killed_by_type": {0: 3},
            "passed": 0,
            "spawned": 10,  # exceeds configured 3
            "money_gained": 15,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "spawned exceeds total monsters" in err

    def test_spawned_negative(self):
        """Fail: spawned is negative."""
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
        assert "spawned cannot be negative" in err

    def test_killed_plus_passed_plus_remaining_not_equal_spawned(self):
        """Fail: killed + passed + remaining != spawned."""
        result = {
            "killed": 1,
            "killed_by_type": {0: 1},
            "passed": 0,
            "remaining": 0,  # total 1
            "spawned": 2,     # claims 2 spawned
            "money_gained": 5,
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is False
        assert "Monster count mismatch" in err

    def test_real_bug_scenario(self):
        """Regression: wave 2 only spawns 1 monster before early end.

        Repro steps:
        1. Clear wave 1
        2. Pause immediately after wave 2 monsters start spawning
        3. End game early
        """
        result = {
            "killed": 0,
            "killed_by_type": {},
            "passed": 0,
            "remaining": 1,
            "spawned": 1,
            "money_gained": 0,
        }
        wave_config = {
            "monsters": [
                {"type": 0, "count": 1, "money": 5},
                {"type": 1, "count": 1, "money": 8},
            ]  # total = 2, but spawned = 1
        }
        ok, err = validate_basic(result, wave_config)
        assert ok is True


class TestValidateScore:
    """Score validation tests."""

    def test_success_single_attack(self):
        """Pass: single attack."""
        attacks = [{"damage": 16}]  # floor(sqrt(16)) = 4
        result = {"score_gained": 4}
        ok, err = validate_score(attacks, result)
        assert ok is True

    def test_success_multiple_attacks(self):
        """Pass: multiple attacks.

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
        """Pass: zero damage attack."""
        attacks = [{"damage": 0}]  # floor(sqrt(0)) = 0
        result = {"score_gained": 0}
        ok, err = validate_score(attacks, result)
        assert ok is True

    def test_success_no_attacks(self):
        """Pass: no attacks."""
        attacks = []
        result = {"score_gained": 0}
        ok, err = validate_score(attacks, result)
        assert ok is True

    def test_score_mismatch(self):
        """Fail: score mismatch."""
        attacks = [{"damage": 16}]  # expected 4
        result = {"score_gained": 10}  # wrong
        ok, err = validate_score(attacks, result)
        assert ok is False
        assert "expected 4" in err
        assert "got 10" in err

    def test_complex_calculation(self):
        """Pass: verify floor behavior with various values."""
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
    """Money balance validation tests."""

    def test_positive_balance(self):
        """Pass: positive balance."""
        new_state = {"money": 100}
        ok, err = validate_money_balance(new_state)
        assert ok is True

    def test_zero_balance(self):
        """Pass: zero balance."""
        new_state = {"money": 0}
        ok, err = validate_money_balance(new_state)
        assert ok is True

    def test_negative_balance(self):
        """Fail: negative balance."""
        new_state = {"money": -1}
        ok, err = validate_money_balance(new_state)
        assert ok is False
        assert "Insufficient money" in err


class TestValidateBuildingsConsistency:
    """Building consistency validation tests."""

    def test_empty_lists(self):
        """Pass: both lists empty."""
        ok, err = validate_buildings_consistency([], [])
        assert ok is True

    def test_single_building_match(self):
        """Pass: single building matches."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [{"id": "b-001", "type": "cannon", "level": 1}]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is True

    def test_multiple_buildings_match(self):
        """Pass: multiple buildings match (order-independent)."""
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
        """Fail: level mismatch."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [{"id": "b-001", "type": "cannon", "level": 2}]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is False
        assert "Building list mismatch" in err

    def test_type_mismatch(self):
        """Fail: type mismatch."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [{"id": "b-001", "type": "LMG", "level": 1}]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is False
        assert "Building list mismatch" in err

    def test_missing_building(self):
        """Fail: missing building."""
        calculated = [
            {"id": "b-001", "type": "cannon", "level": 1},
            {"id": "b-002", "type": "LMG", "level": 1},
        ]
        submitted = [{"id": "b-001", "type": "cannon", "level": 1}]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is False

    def test_extra_building(self):
        """Fail: extra building."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [
            {"id": "b-001", "type": "cannon", "level": 1},
            {"id": "b-002", "type": "LMG", "level": 1},
        ]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is False

    def test_ignores_extra_fields(self):
        """Pass: ignores extra fields (e.g. position)."""
        calculated = [{"id": "b-001", "type": "cannon", "level": 1}]
        submitted = [
            {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        ]
        ok, err = validate_buildings_consistency(calculated, submitted)
        assert ok is True


class TestValidateDamage:
    """Damage validation tests."""

    def test_success_single_monster_type(self):
        """Pass: single monster type, life pool matches."""
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
        """Pass: multiple monster types."""
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
            "monsters": [{"type": 0, "count": 3, "money": 5}]
        }
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        ok, err = validate_damage(result, buildings, wave_config, building_config)
        assert ok is False
        assert "DPS capacity exceeded" in err

    def test_dps_within_tolerance(self):
        """Pass: damage within 10% tolerance."""
        # max_dps = 12 / 2 = 6
        # max_damage = 6 * 100 = 600
        # 10% tolerance = 660
        result = {
            "killed_by_type": {0: 3},
            "total_life_destroyed": 150,
            "total_damage_dealt": 650,  # within tolerance
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
        """Pass: DPS sums across multiple buildings."""
        # cannon: 12/2 = 6, LMG: 5/3 = 1.67
        # total max_dps = 7.67
        # max_damage = 7.67 * 100 = 767
        result = {
            "killed_by_type": {0: 5},
            "total_life_destroyed": 250,
            "total_damage_dealt": 700,  # within capacity
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
        """Pass: upgraded building DPS calculation.

        Damage uses exponential growth (x 1.2 per level):
        - Level 2 cannon: int(12 * 1.2) = 14
        - DPS = 14 / 2 = 7
        - max_damage = 7 * 100 = 700
        - 10% tolerance: 700 * 1.1 = 770
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
        """Pass: high-level building DPS (exponential growth is significant).

        HMG x 1.3 per level, maintaining float precision:
        - Level 5 HMG: int(30 * 1.3^4) = int(85.68) = 85
        - DPS = 85 / 3 = 28.33
        - max_damage = 28.33 * 100 = 2833
        - 10% tolerance: 2833 * 1.1 = 3116

        Compare linear: 30 * 5 / 3 = 50 DPS, max = 5000 (significant gap)
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
        """Pass: cannon level 10/11/12 upgrade rule transition boundary.

        cannon upgrade rule: levels 1-10 x 1.2, level 11+ x 1.3

        Maintaining float precision:
        - Level 10: int(12 * 1.2^9) = 61
        - Level 11: int(12 * 1.2^10) = 74 (current_level=10 <= 10, use 1.2)
        - Level 12: int(12 * 1.2^10 * 1.3) = 96 (current_level=11 > 10, use 1.3)

        Compare linear calculation gap:
        - Level 10 linear: 12 * 10 = 120, actual 61, 49% gap
        - Level 12 linear: 12 * 12 = 144, actual 96, 33% gap
        """
        building_config = {
            "cannon": {"damage": 12, "speed": 2},
        }
        wave_config = {
            "monsters": [{"type": 0, "count": 100, "life": 50, "money": 5}]
        }

        # Level 10 cannon: damage = 61, DPS = 30.5, max = 3050, 10% tolerance = 3355
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
        assert ok is True, f"Level 10 should pass: {err}"

        # Level 12 cannon: damage = 96, DPS = 48, max = 4800, 10% tolerance = 5280
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
        assert ok is True, f"Level 12 should pass: {err}"

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
        """Pass: no buildings means DPS is 0."""
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
        """Pass: wall building (speed=0) excluded from DPS."""
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
    """Manhattan distance helper tests."""

    def test_same_position(self):
        """Distance is 0 for same position."""
        assert position_distance([5, 5], [5, 5]) == 0

    def test_horizontal_distance(self):
        """Horizontal distance."""
        assert position_distance([0, 0], [10, 0]) == 10

    def test_vertical_distance(self):
        """Vertical distance."""
        assert position_distance([0, 0], [0, 10]) == 10

    def test_diagonal_distance(self):
        """Diagonal distance (Manhattan)."""
        assert position_distance([0, 0], [3, 4]) == 7

    def test_negative_coordinates(self):
        """Negative coordinates."""
        assert position_distance([-5, -5], [5, 5]) == 20


class TestValidateMonsterIds:
    """Monster ID validation tests."""

    def test_all_valid_ids(self):
        """Pass: all IDs are valid."""
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
        """Pass: no attack events."""
        attacks = []
        monsters_config = {"m-001": {"type": 0, "life": 50}}
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is True

    def test_invalid_id(self):
        """Fail: contains invalid ID."""
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
        assert "not a server-issued UUID" in err

    def test_valid_original_target_id(self):
        """Pass: originalTargetId is valid."""
        attacks = [
            {
                "monsterId": "m-001",
                "originalTargetId": "m-001",
                "damage": 10,
            },
            {
                "monsterId": "m-002",
                "originalTargetId": "m-001",  # splash: aimed at m-001, hit m-002
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
        """Fail: originalTargetId is invalid."""
        attacks = [
            {
                "monsterId": "m-001",
                "originalTargetId": "fake-target",
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
        assert "not a server-issued UUID" in err

    def test_missing_original_target_id(self):
        """Pass: missing originalTargetId skips validation (backward compat)."""
        attacks = [
            {"monsterId": "m-001", "damage": 10},
        ]
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_monster_ids(attacks, monsters_config)
        assert ok is True

    def test_friendly_fire_both_valid(self):
        """Pass: splash damage with both IDs valid."""
        attacks = [
            {
                "monsterId": "m-002",  # actual hit
                "originalTargetId": "m-001",  # originally aimed at
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
    """Cumulative damage validation tests."""

    def test_exact_kill(self):
        """Pass: exact kill."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},
            {"monsterId": "m-001", "damage": 20},  # cumulative 50
        ]
        result = {"killed_by_type": {0: 1}}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is True

    def test_overkill(self):
        """Pass: overkill."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},
            {"monsterId": "m-001", "damage": 30},  # cumulative 60 > 50
        ]
        result = {"killed_by_type": {0: 1}}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is True

    def test_multiple_monsters(self):
        """Pass: multiple monsters killed."""
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
        """Pass: mixed monster types."""
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
        """Pass: insufficient damage, monster escaped."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},  # not enough to kill
        ]
        result = {"killed_by_type": {0: 0}}
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is True

    def test_kill_count_mismatch(self):
        """Fail: kill count mismatch."""
        attacks = [
            {"monsterId": "m-001", "damage": 50},  # killed 1
        ]
        result = {"killed_by_type": {0: 2}}  # claims 2 kills
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is False
        assert "kill count mismatch" in err

    def test_claimed_kill_without_damage(self):
        """Fail: claims kill but insufficient damage."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},  # not enough to kill
        ]
        result = {"killed_by_type": {0: 1}}  # claims kill
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_cumulative_damage(attacks, result, monsters_config)
        assert ok is False


class TestValidateRemainingMonsters:
    """Remaining monster validation tests."""

    def test_zero_remaining_skip_validation(self):
        """Pass: remaining=0 skips validation."""
        attacks = []
        result = {"remaining": 0}
        monsters_config = {}
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True
        assert err == ""

    def test_remaining_default_zero(self):
        """Pass: missing remaining field defaults to 0, skip validation."""
        attacks = []
        result = {}
        monsters_config = {}
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True
        assert err == ""

    def test_success_with_valid_remaining_ids(self):
        """Pass: remainingMonsterIds valid and not killed."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},  # cumulative 30 < 50
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
        """Pass: remaining monster never attacked."""
        attacks = [
            {"monsterId": "m-001", "damage": 50},  # killed m-001
        ]
        result = {
            "remaining": 1,
            "remaining_monster_ids": ["m-002"],  # m-002 never attacked
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True
        assert err == ""

    def test_count_mismatch(self):
        """Fail: remainingMonsterIds count does not match remaining."""
        attacks = []
        result = {
            "remaining": 2,
            "remaining_monster_ids": ["m-001"],  # only 1
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "count mismatch" in err
        assert "expected 2" in err

    def test_missing_remaining_ids(self):
        """Fail: remaining > 0 but no remainingMonsterIds provided."""
        attacks = []
        result = {
            "remaining": 1,
        }
        monsters_config = {}
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "count mismatch" in err

    def test_duplicate_ids(self):
        """Fail: remainingMonsterIds contains duplicates."""
        attacks = []
        result = {
            "remaining": 2,
            "remaining_monster_ids": ["m-001", "m-001"],
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "duplicates" in err

    def test_invalid_id(self):
        """Fail: remainingMonsterIds contains invalid ID."""
        attacks = []
        result = {
            "remaining": 1,
            "remaining_monster_ids": ["fake-id"],
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is False
        assert "fake-id" in err
        assert "not a server-issued UUID" in err

    def test_should_be_killed(self):
        """Fail: cumulative damage >= life, should be killed not remaining."""
        attacks = [
            {"monsterId": "m-001", "damage": 30},
            {"monsterId": "m-001", "damage": 25},  # cumulative 55 >= 50
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
        assert "m-001" in err
        assert "should be killed not remaining" in err

    def test_exact_damage_should_be_killed(self):
        """Fail: cumulative damage equals life, should be killed not remaining."""
        attacks = [
            {"monsterId": "m-001", "damage": 50},  # exactly 50 == 50
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
        assert "should be killed not remaining" in err

    def test_multiple_remaining_mixed_types(self):
        """Pass: multiple remaining monsters of different types."""
        attacks = [
            {"monsterId": "m-001", "damage": 20},  # cumulative 20 < 50
            {"monsterId": "m-003", "damage": 30},  # cumulative 30 < 100
        ]
        result = {
            "remaining": 3,
            "remaining_monster_ids": ["m-001", "m-002", "m-003"],
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-002": {"type": 0, "life": 50},   # never attacked
            "m-003": {"type": 1, "life": 100},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True

    def test_remaining_id_not_in_spawned(self):
        """Fail: remaining monster ID not among the first spawned monsters."""
        attacks = []
        result = {
            "remaining": 2,
            "remaining_monster_ids": ["m-001", "m-006"],  # m-006 is 6th, not spawned
            "spawned": 5,  # only first 5 spawned
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
            "m-006": {"type": 0, "life": 50},  # in config but not spawned
        }
        monsters_list = ["m-001", "m-002", "m-003", "m-004", "m-005", "m-006", "m-007"]
        ok, err = validate_remaining_monsters(
            attacks, result, monsters_config, monsters_list
        )
        assert ok is False
        assert "m-006" in err
        assert "not among the first" in err or "spawned monsters" in err

    def test_remaining_id_in_spawned_success(self):
        """Pass: remaining monster IDs all among first spawned monsters."""
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
        """Pass: no monsters_list skips spawned validation (backward compat)."""
        attacks = []
        result = {
            "remaining": 1,
            "remaining_monster_ids": ["m-001"],
        }
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_remaining_monsters(attacks, result, monsters_config)
        assert ok is True

    def test_cheat_scenario_use_unspawned_monster(self):
        """Fail: cheat using unspawned monster IDs to hide passed monsters."""
        # Scenario: 5 monsters configured, 3 spawned, m-001 passed through
        # Cheater claims remaining=3, padding with m-004 (not spawned)
        attacks = []
        result = {
            "remaining": 3,
            "remaining_monster_ids": ["m-002", "m-003", "m-004"],  # m-004 not spawned
            "spawned": 3,  # only m-001, m-002, m-003 spawned
        }
        monsters_config = {
            "m-002": {"type": 0, "life": 50},
            "m-003": {"type": 0, "life": 50},
            "m-004": {"type": 0, "life": 50},  # in config but not spawned
        }
        monsters_list = ["m-001", "m-002", "m-003", "m-004", "m-005"]
        ok, err = validate_remaining_monsters(
            attacks, result, monsters_config, monsters_list
        )
        assert ok is False
        assert "m-004" in err


class TestValidateAttackRange:
    """Attack range validation tests."""

    def test_within_range(self):
        """Pass: target within range."""
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
        """Pass: target at current range boundary."""
        # level 1: current_range = min(4, 8) = 4
        attack = {
            "originalTargetPosition": [9, 5],  # distance 4, equals current range
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_very_close_target(self):
        """Pass: very close target (no minimum range)."""
        attack = {
            "originalTargetPosition": [6, 5],  # distance 1
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_too_far(self):
        """Fail: target too far."""
        attack = {
            "originalTargetPosition": [20, 5],  # distance 15 > 8+1
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is False
        assert "out of range" in err

    def test_upgraded_building_range(self):
        """Pass: upgraded building has increased range."""
        # level 3: current_range = min(4 * 1.2^2, 8) = min(5.76, 8) = 5.76
        attack = {
            "originalTargetPosition": [11, 5],  # distance 6, within upgraded range (5.76 + 1 tolerance)
        }
        building = {"id": "b-001", "type": "cannon", "level": 3, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_tolerance_at_range(self):
        """Pass: within 1-tile tolerance."""
        # level 1: current_range = min(4, 8) = 4
        # distance 5 is within tolerance (4 + 1 = 5)
        attack = {
            "originalTargetPosition": [10, 5],  # distance 5 = 4 + 1 (within tolerance)
        }
        building = {"id": "b-001", "type": "cannon", "level": 1, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True

    def test_range_capped_by_max_range(self):
        """Pass: range capped by max_range."""
        # level 10: range * 1.2^9 = 4 * 5.16 = 20.64, but capped by max_range=8
        # current_range = min(20.64, 8) = 8
        attack = {
            "originalTargetPosition": [13, 5],  # distance 8, equals max_range
        }
        building = {"id": "b-001", "type": "cannon", "level": 10, "position": [5, 5]}
        building_config = {
            "cannon": {"range": 4, "max_range": 8},
        }
        ok, err = validate_attack_range(attack, building, building_config)
        assert ok is True


class TestValidateDamageValue:
    """Damage value validation tests."""

    def test_exact_damage(self):
        """Pass: damage equals building damage."""
        attack = {"damage": 12}
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_reduced_damage_by_shield(self):
        """Pass: damage reduced by shield."""
        attack = {"damage": 8}  # possibly reduced by shield
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_minimum_damage(self):
        """Pass: minimum damage (1)."""
        attack = {"damage": 1}
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_upgraded_building_damage(self):
        """Pass: upgraded building damage."""
        # level 2: 12 * 1.2 = 14.4 -> 14
        attack = {"damage": 14}
        building = {"id": "b-001", "type": "cannon", "level": 2}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_level_3_damage(self):
        """Pass: level 3 building damage.

        Maintaining float precision: 12 * 1.2 = 14.4 * 1.2 = 17.28 -> 17
        """
        attack = {"damage": 17}
        building = {"id": "b-001", "type": "cannon", "level": 3}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is True

    def test_damage_exceeds_limit(self):
        """Fail: damage exceeds limit."""
        attack = {"damage": 20}  # exceeds 12
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is False
        assert "Damage exceeds building limit" in err

    def test_zero_damage(self):
        """Fail: zero damage."""
        attack = {"damage": 0}
        building = {"id": "b-001", "type": "cannon", "level": 1}
        building_config = {"cannon": {"damage": 12}}
        ok, err = validate_damage_value(attack, building, building_config)
        assert ok is False
        assert "Damage cannot be less than 1" in err

    def test_hmg_upgrade_rule(self):
        """Pass: HMG uses 1.3x upgrade rule.

        HMG base damage 30, x 1.3 per level
        level 2: 30 x 1.3 = 39
        level 3: 39 x 1.3 = 50.7 -> 50
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
        """Pass: cannon switches to 1.3x at level 12.

        cannon base damage 12, maintaining float precision
        (matches legacy td-cfg-buildings.js:51-53):
        Legacy condition: old_level <= 10 ? 1.2 : 1.3 (old_level is 0-based)
        New impl: current_level <= 11 uses 1.2, current_level > 11 uses 1.3

        level 11: int(12 * 1.2^10) = int(74.30...) = 74 (current_level=10, use 1.2)
        level 12: int(12 * 1.2^11) = int(89.16...) = 89 (current_level=11 <= 11, use 1.2)
        level 13: int(12 * 1.2^11 * 1.3) = int(115.90...) = 115 (current_level=12 > 11, use 1.3)
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
        """Pass: LMG uses default 1.2x upgrade rule.

        LMG base damage 5
        level 2: 5 x 1.2 = 6
        level 3: 6 x 1.2 = 7.2 -> 7
        """
        building_config = {"LMG": {"damage": 5}}

        attack_lv3 = {"damage": 7}
        building_lv3 = {"id": "b-001", "type": "LMG", "level": 3}
        ok, _ = validate_damage_value(attack_lv3, building_lv3, building_config)
        assert ok is True


class TestCalcBuildingDamage:
    """Building damage calculation tests."""

    def test_default_upgrade_rule(self):
        """Default upgrade rule: x 1.2 per level."""
        # level 1: 10
        # level 2: 10 x 1.2 = 12
        # level 3: 12 x 1.2 = 14.4 -> 14
        assert calc_building_damage("LMG", 10, 1) == 10
        assert calc_building_damage("LMG", 10, 2) == 12
        assert calc_building_damage("LMG", 10, 3) == 14

    def test_hmg_always_1_3(self):
        """HMG always uses 1.3x multiplier."""
        # level 1: 30
        # level 2: 30 x 1.3 = 39
        # level 3: 39 x 1.3 = 50.7 -> 50
        assert calc_building_damage("HMG", 30, 1) == 30
        assert calc_building_damage("HMG", 30, 2) == 39
        assert calc_building_damage("HMG", 30, 3) == 50

    def test_cannon_upgrade_transition(self):
        """cannon switches to 1.3x at level 12.

        Maintaining float precision (matches legacy td-cfg-buildings.js:51-53):
        Legacy condition: old_level <= 10 ? 1.2 : 1.3 (old_level is 0-based)
        New impl: current_level <= 11 uses 1.2, current_level > 11 uses 1.3

        level 11: int(12 * 1.2^10) = 74 (current_level=10 <= 11, use 1.2)
        level 12: int(12 * 1.2^11) = 89 (current_level=11 <= 11, use 1.2)
        level 13: int(12 * 1.2^11 * 1.3) = 115 (current_level=12 > 11, use 1.3)
        """
        assert calc_building_damage("cannon", 12, 11) == 74
        assert calc_building_damage("cannon", 12, 12) == 89
        assert calc_building_damage("cannon", 12, 13) == 115


class TestValidateMonsterPaths:
    """Monster path validation tests.

    Note: validate_monster_paths returns True/False, but in
    validate_attacks, path anomalies only log warnings and do not
    block requests. This is because monster re-pathing and player
    removing barricades are both legitimate gameplay behaviors.
    """

    def test_moving_toward_exit(self):
        """Pass: monster moving toward exit."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [2, 2]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [8, 8]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_single_attack(self):
        """Pass: single attack (path cannot be validated)."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [5, 5]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_multiple_monsters(self):
        """Pass: multiple monsters all moving toward exit."""
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
        """Pass: slight detour (within tolerance)."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [5, 5]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [4, 6]},  # slight detour
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_moving_away_from_exit(self):
        """Fail: monster moving away from exit."""
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [10, 10]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [2, 2]},  # away from exit
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is False
        assert "path anomaly" in err
        assert "moving away from exit" in err

    def test_no_attacks(self):
        """Pass: no attack events."""
        attacks = []
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True

    def test_zigzag_path_should_pass(self):
        """Pass: serpentine path may temporarily increase Manhattan distance.

        Scenario: player builds serpentine barricades forcing detour
        - Row 1: entrance (0,0) right to (14,0), then turn
        - Row 2: from (14,1) left to (1,1), then turn
        - Repeating zigzag pattern

        At turning points:
        - First attack at (14, 1): distance to exit (15,15) = 1 + 14 = 15
        - Last attack at (1, 2): distance to exit = 14 + 13 = 27
        - Distance increased by 12 tiles, which is legitimate gameplay
        """
        attacks = [
            {"monsterId": "m-001", "frame": 100, "monsterPosition": [14, 1]},
            {"monsterId": "m-001", "frame": 200, "monsterPosition": [8, 1]},
            {"monsterId": "m-001", "frame": 300, "monsterPosition": [1, 2]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True, f"Serpentine path should pass, but failed: {err}"

    def test_extreme_zigzag_path(self):
        """Pass: extreme serpentine path across the map.

        Simulates monster hit at mid-map after multiple serpentine turns.
        First attack near exit turning point, last attack on far straight.
        """
        attacks = [
            {"monsterId": "m-001", "frame": 50, "monsterPosition": [15, 10]},
            {"monsterId": "m-001", "frame": 150, "monsterPosition": [1, 11]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is True, f"Extreme serpentine path should pass, but failed: {err}"

    def test_backward_movement_should_fail(self):
        """Fail: monster moving backward toward entrance (both axes away from exit).

        Scenario: cheater fabricates data, monster from (10, 10) to (3, 3)
        - First attack at (10, 10): distance to exit = 10
        - Last attack at (3, 3): distance to exit = 24
        - x-axis: distance 5 -> 12 (away)
        - y-axis: distance 5 -> 12 (away)
        - Both axes moving away from exit, should fail
        """
        attacks = [
            {"monsterId": "m-001", "frame": 10, "monsterPosition": [10, 10]},
            {"monsterId": "m-001", "frame": 20, "monsterPosition": [3, 3]},
        ]
        map_config = {"entrance": [0, 0], "exit": [15, 15]}
        ok, err = validate_monster_paths(attacks, map_config)
        assert ok is False
        assert "path anomaly" in err
        assert "both axes moving away from exit" in err


class TestValidateAttacks:
    """Attack event validation tests."""

    def test_success_complete_validation(self):
        """Pass: complete attack event validation."""
        # level 1 cannon: current_range = min(4, 8) = 4, plus 1 tolerance = 5
        # building at [5, 5], target must be within distance <= 5
        attacks = [
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 10,
                "damage": 12,
                "originalTargetPosition": [8, 5],  # distance 3
                "monsterPosition": [8, 5],
            },
            {
                "buildingId": "b-001",
                "monsterId": "m-001",
                "frame": 20,
                "damage": 12,
                "originalTargetPosition": [9, 6],
                "monsterPosition": [9, 6],
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
        monsters_config = {
            "m-001": {"type": 0, "life": 50},
        }
        ok, err = validate_attacks(
            attacks, buildings, result, building_config, map_config, monsters_config
        )
        assert ok is True

    def test_damage_sum_mismatch(self):
        """Fail: damage sum mismatch."""
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
            "total_damage_dealt": 100,  # mismatch
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
        assert "Damage sum mismatch" in err

    def test_frame_order_invalid(self):
        """Fail: frame ordering violation."""
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
                "frame": 10,  # out of order
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
        assert "Attack frame ordering violation" in err

    def test_unknown_building(self):
        """Fail: unknown building ID."""
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
        assert "Unknown building" in err

    def test_empty_attacks(self):
        """Pass: no attack events."""
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
        """Pass: path anomaly only logged, does not block request.

        Scenario: player removes barricade, monster re-paths
        - First attack at (8, 5): distance to exit = 17
        - Last attack at (2, 3): distance to exit = 25 (both axes away)
        - This is legitimate gameplay (monster re-pathing)

        Validates: validate_attacks returns True, anomaly only logged
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
            assert ok is True
            mock_logger.warning.assert_called_once()
            assert "Path validation anomaly" in mock_logger.warning.call_args[0][0]


class TestAnalyzeStatistics:
    """Statistics analysis tests."""

    def _create_wave_record(self, killed, passed, score_gained, money_spent):
        """Create a mock wave record."""
        record = Mock()
        record.killed = killed
        record.passed = passed
        record.score_gained = score_gained
        record.money_spent = money_spent
        return record

    def test_insufficient_data(self):
        """No analysis with insufficient data (fewer than 3 records)."""
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
        """No warning for normal kill rate."""
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
        """Kill rate spike warning: historical < 0.5 and current > 0.95."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(3, 7, 30, 100),  # 30%
            self._create_wave_record(4, 6, 40, 100),  # 40%
            self._create_wave_record(5, 5, 50, 100),  # 50%
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # Current wave: 96% kill rate
        result = {"killed": 24, "passed": 1, "score_gained": 100}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            warning_calls = [
                call for call in mock_logger.warning.call_args_list
                if "Kill rate anomaly spike" in str(call)
            ]
            assert len(warning_calls) == 1

    def test_efficiency_spike_warning(self):
        """Efficiency spike warning: current efficiency > historical x 3."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 50, 100),  # efficiency 0.5
            self._create_wave_record(10, 0, 60, 100),  # efficiency 0.6
            self._create_wave_record(10, 0, 40, 100),  # efficiency 0.4
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # historical avg efficiency = 150/300 = 0.5
        # current efficiency = 200/100 = 2.0 > 0.5 x 3 = 1.5
        result = {"killed": 10, "passed": 0, "score_gained": 200}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            warning_calls = [
                call for call in mock_logger.warning.call_args_list
                if "Resource efficiency anomaly spike" in str(call)
            ]
            assert len(warning_calls) == 1

    def test_no_efficiency_warning_within_threshold(self):
        """No efficiency warning when within threshold."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 50, 100),  # efficiency 0.5
            self._create_wave_record(10, 0, 60, 100),  # efficiency 0.6
            self._create_wave_record(10, 0, 40, 100),  # efficiency 0.4
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # historical avg efficiency = 150/300 = 0.5
        # current efficiency = 100/100 = 1.0 < 0.5 x 3 = 1.5
        result = {"killed": 10, "passed": 0, "score_gained": 100}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            warning_calls = [
                call for call in mock_logger.warning.call_args_list
                if "Resource efficiency anomaly spike" in str(call)
            ]
            assert len(warning_calls) == 0

    def test_both_warnings(self):
        """Both warnings triggered simultaneously."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(3, 7, 30, 100),  # kill rate 30%, efficiency 0.3
            self._create_wave_record(4, 6, 40, 100),  # kill rate 40%, efficiency 0.4
            self._create_wave_record(5, 5, 50, 100),  # kill rate 50%, efficiency 0.5
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # historical kill rate = 12/30 = 0.4 < 0.5
        # historical efficiency = 120/300 = 0.4
        # current kill rate = 24/25 = 0.96 > 0.95
        # current efficiency = 200/100 = 2.0 > 0.4 x 3 = 1.2
        result = {"killed": 24, "passed": 1, "score_gained": 200}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            assert mock_logger.warning.call_count == 2

    def test_no_efficiency_warning_when_no_spending(self):
        """No efficiency warning when no spending (normal strategy).

        Players may invest heavily early and stop building later.
        When money_spent = 0, efficiency check should be skipped.
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 50, 500),  # efficiency 0.1
            self._create_wave_record(10, 0, 60, 300),  # efficiency 0.2
            self._create_wave_record(10, 0, 40, 200),  # efficiency 0.2
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # historical avg efficiency = 150/1000 = 0.15
        # current: no spending, score 100 (from existing buildings)
        result = {"killed": 10, "passed": 0, "score_gained": 100}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 0)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "Resource efficiency anomaly spike" in str(call)
            ]
            assert len(efficiency_warnings) == 0

    def test_zero_money_spent_no_crash(self):
        """No crash and no efficiency warning when spending is 0."""
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
            analyze_statistics(session, result, 0)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "Resource efficiency anomaly spike" in str(call)
            ]
            assert len(efficiency_warnings) == 0

    def test_zero_total_monsters_no_crash(self):
        """No crash when total monsters is 0."""
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(0, 0, 0, 100),
            self._create_wave_record(0, 0, 0, 100),
            self._create_wave_record(0, 0, 0, 100),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        result = {"killed": 0, "passed": 0, "score_gained": 0}

        analyze_statistics(session, result, 100)

    def test_no_efficiency_warning_when_zero_historical_cost(self):
        """Skip efficiency check when historical cost is zero.

        When all 3 historical waves have zero spending, no meaningful
        efficiency baseline can be computed. Skip the check.
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
                if "Resource efficiency anomaly spike" in str(call)
            ]
            assert len(efficiency_warnings) == 0

    def test_efficiency_warning_when_zero_historical_score(self):
        """Efficiency warning when historical score is zero.

        When historical waves have spending but zero score (efficiency=0),
        any positive efficiency triggers a warning. This is expected:
        a sudden jump from zero efficiency is worth flagging.
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(0, 0, 0, 100),
            self._create_wave_record(0, 0, 0, 100),
            self._create_wave_record(0, 0, 0, 100),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # historical efficiency = 0 / 300 = 0
        # current efficiency = 50 / 100 = 0.5 > 0 x 3 = 0
        result = {"killed": 5, "passed": 0, "score_gained": 50}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "Resource efficiency anomaly spike" in str(call)
            ]
            assert len(efficiency_warnings) == 1

    def test_no_efficiency_warning_at_exact_threshold(self):
        """No efficiency warning at exact threshold.

        Uses > not >=, so exactly at threshold does not trigger.
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 100, 100),
            self._create_wave_record(10, 0, 100, 100),
            self._create_wave_record(10, 0, 100, 100),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # historical efficiency = 300 / 300 = 1.0
        # current efficiency = 300 / 100 = 3.0 == 1.0 x 3
        result = {"killed": 10, "passed": 0, "score_gained": 300}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "Resource efficiency anomaly spike" in str(call)
            ]
            assert len(efficiency_warnings) == 0

    def test_no_efficiency_warning_when_zero_current_score(self):
        """No efficiency warning when current score is zero.

        Spending with zero score (efficiency=0) will not > historical x 3.
        """
        session = Mock()
        session.waves.all.return_value = [
            self._create_wave_record(10, 0, 50, 100),
            self._create_wave_record(10, 0, 50, 100),
            self._create_wave_record(10, 0, 50, 100),
        ]
        session.wave_count = 3
        session.id = "test-session-id"
        # historical efficiency = 150 / 300 = 0.5
        # current efficiency = 0 / 100 = 0 < 0.5 x 3 = 1.5
        result = {"killed": 0, "passed": 10, "score_gained": 0}

        with patch("game.validators.logger") as mock_logger:
            analyze_statistics(session, result, 100)
            efficiency_warnings = [
                call for call in mock_logger.warning.call_args_list
                if "Resource efficiency anomaly spike" in str(call)
            ]
            assert len(efficiency_warnings) == 0


class TestValidateGameEnd:
    """Game end validation tests."""

    def _create_wave_record(self, wave_number: int, score_gained: int):
        """Create a mock wave record."""
        record = Mock()
        record.wave_number = wave_number
        record.score_gained = score_gained
        return record

    def test_empty_waves_zero_score(self):
        """Pass: no wave records and score is 0."""
        session = Mock()
        session.waves.order_by.return_value = []
        session.score = 0
        ok, err = validate_game_end(session)
        assert ok is True
        assert err == ""

    def test_empty_waves_nonzero_score(self):
        """Fail: no wave records but score is nonzero."""
        session = Mock()
        session.waves.order_by.return_value = []
        session.score = 100
        ok, err = validate_game_end(session)
        assert ok is False
        assert "Score accumulation mismatch" in err
        assert "expected 0" in err

    def test_single_wave_success(self):
        """Pass: single wave record, score matches."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 50)
        ]
        session.score = 50
        ok, err = validate_game_end(session)
        assert ok is True
        assert err == ""

    def test_multiple_waves_success(self):
        """Pass: multiple wave records, accumulated score matches."""
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
        """Fail: accumulated score mismatch."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 30),
            self._create_wave_record(2, 40),
        ]
        session.score = 100  # should be 70
        ok, err = validate_game_end(session)
        assert ok is False
        assert "Score accumulation mismatch" in err
        assert "expected 70" in err
        assert "got 100" in err

    def test_wave_continuity_gap(self):
        """Fail: wave record gap (skipped wave)."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 30),
            self._create_wave_record(3, 50),  # missing wave 2
        ]
        session.score = 80
        ok, err = validate_game_end(session)
        assert ok is False
        assert "Wave record gap" in err
        assert "missing wave 2" in err

    def test_wave_continuity_start_wrong(self):
        """Fail: wave records do not start from 1."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(2, 30),  # should start from 1
        ]
        session.score = 30
        ok, err = validate_game_end(session)
        assert ok is False
        assert "Wave record gap" in err
        assert "missing wave 1" in err

    def test_wave_continuity_duplicate(self):
        """Fail: duplicate wave records."""
        session = Mock()
        session.waves.order_by.return_value = [
            self._create_wave_record(1, 30),
            self._create_wave_record(1, 40),  # duplicate wave 1
        ]
        session.score = 70
        ok, err = validate_game_end(session)
        assert ok is False
        assert "Wave record gap" in err
        assert "missing wave 2" in err


class TestValidateNickname:
    """Nickname validation tests."""

    def test_valid_nickname(self):
        """Pass: valid nickname."""
        ok, err = validate_nickname("Player1")
        assert ok is True
        assert err == ""

    def test_valid_nickname_with_spaces(self):
        """Pass: nickname with spaces."""
        ok, err = validate_nickname("Player One")
        assert ok is True
        assert err == ""

    def test_valid_nickname_unicode(self):
        """Pass: Unicode nickname."""
        ok, err = validate_nickname("玩家一号")
        assert ok is True
        assert err == ""

    def test_valid_nickname_max_length(self):
        """Pass: nickname at exactly 32 characters."""
        nickname = "A" * 32
        ok, err = validate_nickname(nickname)
        assert ok is True
        assert err == ""

    def test_empty_nickname(self):
        """Fail: empty nickname."""
        ok, err = validate_nickname("")
        assert ok is False
        assert "Nickname cannot be empty" in err

    def test_whitespace_only_nickname(self):
        """Fail: whitespace-only nickname."""
        ok, err = validate_nickname("   ")
        assert ok is False
        assert "Nickname cannot be empty" in err

    def test_whitespace_only_tabs(self):
        """Fail: tab-only nickname."""
        ok, err = validate_nickname("\t\t\t")
        assert ok is False
        assert "Nickname cannot be empty" in err

    def test_whitespace_mixed(self):
        """Fail: mixed whitespace nickname."""
        ok, err = validate_nickname(" \t \n ")
        assert ok is False
        assert "Nickname cannot be empty" in err

    def test_nickname_too_long(self):
        """Fail: nickname exceeds 32 characters."""
        nickname = "A" * 33
        ok, err = validate_nickname(nickname)
        assert ok is False
        assert "Nickname cannot exceed 32 characters" in err

    def test_nickname_with_leading_trailing_spaces(self):
        """Pass: nickname with leading/trailing spaces but content inside."""
        ok, err = validate_nickname("  Player  ")
        assert ok is True
        assert err == ""

    def test_xss_script_tag(self):
        """Fail: contains script tag (XSS)."""
        ok, err = validate_nickname("<script>alert('XSS')</script>")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_xss_img_tag(self):
        """Fail: contains img tag (XSS)."""
        ok, err = validate_nickname("<img src=x onerror=alert(1)>")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_xss_javascript_protocol(self):
        """Fail: contains javascript: protocol."""
        ok, err = validate_nickname("javascript:alert(1)")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_xss_event_handler(self):
        """Fail: contains event handler."""
        ok, err = validate_nickname("Player onclick=hack")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_xss_case_insensitive(self):
        """Fail: mixed-case XSS attempt."""
        ok, err = validate_nickname("<SCRIPT>alert(1)</SCRIPT>")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_html_link_injection(self):
        """Fail: HTML link injection."""
        ok, err = validate_nickname("<a href='x'>Click</a>")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_html_style_injection(self):
        """Fail: CSS injection."""
        ok, err = validate_nickname("<style>*{}</style>")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_control_char_null(self):
        """Fail: contains null character."""
        ok, err = validate_nickname("Player\x00Name")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_control_char_escape(self):
        """Fail: contains ANSI escape sequence."""
        ok, err = validate_nickname("\x1b[31mRed\x1b[0m")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_control_char_delete(self):
        """Fail: contains DEL character."""
        ok, err = validate_nickname("Player\x7fName")
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_unicode_zero_width_space(self):
        """Fail: contains zero-width space."""
        ok, err = validate_nickname("P\u200Blayer")  # U+200B Zero Width Space
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_unicode_zero_width_joiner(self):
        """Fail: contains zero-width joiner."""
        ok, err = validate_nickname("Play\u200Der")  # U+200D Zero Width Joiner
        assert ok is False
        assert "Nickname contains illegal characters" in err

    def test_valid_special_chars(self):
        """Pass: allowed special characters."""
        ok, err = validate_nickname("Player_123-XYZ")
        assert ok is True
        assert err == ""

    def test_valid_emoji(self):
        """Pass: emoji allowed."""
        ok, err = validate_nickname("Player123")
        assert ok is True
        assert err == ""

    def test_valid_angle_brackets_without_tag(self):
        """Pass: standalone angle brackets (not forming tags)."""
        ok, err = validate_nickname("1 < 2 > 0")
        assert ok is True
        assert err == ""
