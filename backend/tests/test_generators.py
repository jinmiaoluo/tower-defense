"""Wave generator unit tests."""

import uuid

import pytest

from game.generators import generate_wave


class TestGenerateWavePredefined:
    """Predefined waves (1-10) tests."""

    def test_wave_1_structure(self):
        """Wave 1: 1 normal monster (type 0)."""
        wave = generate_wave(1, 1.0)
        assert wave["waveNumber"] == 1
        assert len(wave["monsters"]) == 1
        assert all(m["type"] == 0 for m in wave["monsters"])

    def test_wave_2_structure(self):
        """Wave 2: 1 normal + 1 slightly stronger monster."""
        wave = generate_wave(2, 1.0)
        assert wave["waveNumber"] == 2
        assert len(wave["monsters"]) == 2
        types = [m["type"] for m in wave["monsters"]]
        assert types.count(0) == 1
        assert types.count(1) == 1

    def test_wave_7_structure(self):
        """Wave 7: 5 type0 + 3 type1 + 1 type2."""
        wave = generate_wave(7, 1.0)
        assert wave["waveNumber"] == 7
        assert len(wave["monsters"]) == 9  # 5 + 3 + 1
        types = [m["type"] for m in wave["monsters"]]
        assert types.count(0) == 5
        assert types.count(1) == 3
        assert types.count(2) == 1

    def test_wave_10_structure(self):
        """Wave 10: 8 type0 + 4 type1 + 3 type2."""
        wave = generate_wave(10, 1.0)
        assert wave["waveNumber"] == 10
        assert len(wave["monsters"]) == 15  # 8 + 4 + 3


class TestGenerateWaveMonsterIds:
    """Monster ID tests."""

    def test_unique_ids(self):
        """Each monster has a unique UUID."""
        wave = generate_wave(5, 1.0)
        ids = [m["id"] for m in wave["monsters"]]
        assert len(ids) == len(set(ids))

    def test_valid_uuid_format(self):
        """ID is a valid UUID format."""
        wave = generate_wave(1, 1.0)
        for monster in wave["monsters"]:
            # Validates UUID (throws exception if invalid)
            uuid.UUID(monster["id"])


class TestGenerateWaveWithDifficulty:
    """Difficulty coefficient impact tests.

    Attributes now include random factors, tests verify ranges.
    Random factors source: td-obj-monster.js:24-35
    - life: random(0.5, 1.5)
    - speed: random(0.75, 1.25)
    - shield: no random factor
    """

    def test_difficulty_1_attributes_in_range(self):
        """Attribute range at difficulty 1.0.

        Normal monster base: life=50, speed=3, shield=0, money=5
        At difficulty=1.0:
        - life_base = 50 * (1+1) * 0.5 = 50
        - life_range = [25, 75) (50 * 0.5 ~ 50 * 1.5)
        - speed_base = 3 + 1.0/2 = 3.5
        - speed_range = [2.625, 4.375) (3.5 * 0.75 ~ 3.5 * 1.25)
        """
        wave = generate_wave(1, 1.0)
        monster = wave["monsters"][0]
        assert monster["type"] == 0
        assert 25 <= monster["life"] < 75
        assert 2.625 <= monster["speed"] < 4.375
        assert monster["shield"] == 0
        assert monster["money"] == 5

    def test_difficulty_2_attributes_in_range(self):
        """Attribute range increases at difficulty 2.0."""
        wave = generate_wave(1, 2.0)
        monster = wave["monsters"][0]
        # life_base = 50 * (2+1) * 0.5 = 75
        # life_range = [37, 112] (int(75 * [0.5, 1.5)), 112 achievable)
        assert 37 <= monster["life"] <= 112
        # speed_base = 3 + 2.0/2 = 4.0
        # speed_range = [3.0, 5.0) (4.0 * 0.75 ~ 4.0 * 1.25)
        assert 3.0 <= monster["speed"] < 5.0
        assert monster["shield"] == 1

    def test_high_difficulty_attributes_in_range(self):
        """Attribute range significantly increases at high difficulty."""
        wave = generate_wave(1, 10.0)
        monster = wave["monsters"][0]
        # life_base = 50 * (10+1) * 0.5 = 275
        # life_range = [137, 412] (275 * 0.5 ~ 275 * 1.5)
        assert 137 <= monster["life"] <= 412
        # speed_base = 3 + 10.0/2 = 8.0
        # speed_range = [6.0, 10.0] (8.0 * 0.75 ~ 8.0 * 1.25, capped by max_speed=10)
        assert 6.0 <= monster["speed"] <= 10.0
        assert monster["shield"] == 5


class TestGenerateWaveAuto:
    """Auto-generated waves (11+) tests.

    Waves 11+ use random generation algorithm:
    - Total monsters = min(floor(wave^1.1), 100)
    - Monster type: random selection (0-8)
    - Group size: random (1-3)

    Source: td-cfg-monsters.js:170-191 makeMonsters()
    """

    def test_wave_11_auto_generated(self):
        """Wave 11 starts auto-generation.

        count = floor(11^1.1) = floor(13.98) = 13
        """
        wave = generate_wave(11, 1.0)
        assert wave["waveNumber"] == 11
        assert len(wave["monsters"]) == 13

    def test_wave_15_monster_count(self):
        """Wave 15 monster count.

        count = floor(15^1.1) = floor(19.67) = 19
        """
        wave = generate_wave(15, 1.0)
        assert wave["waveNumber"] == 15
        assert len(wave["monsters"]) == 19

    def test_wave_50_monster_count(self):
        """Wave 50 monster count.

        count = floor(50^1.1) = floor(73.94) = 73
        """
        wave = generate_wave(50, 1.0)
        assert len(wave["monsters"]) == 73

    def test_wave_100_capped_at_max(self):
        """Wave 100 monster count capped at maximum.

        count = min(floor(100^1.1), 100) = 158, but capped at 100
        """
        wave = generate_wave(100, 1.0)
        assert len(wave["monsters"]) == 100

    def test_auto_wave_uses_multiple_monster_types(self):
        """Auto-generated waves use multiple monster types."""
        wave = generate_wave(20, 1.0)
        types = set(m["type"] for m in wave["monsters"])
        assert len(types) >= 2

    def test_auto_wave_random_type_distribution(self):
        """Multiple generations of same wave produce different type distributions."""
        distributions = []
        for _ in range(10):
            wave = generate_wave(15, 1.0)
            types = tuple(sorted(m["type"] for m in wave["monsters"]))
            distributions.append(types)
        unique_distributions = set(distributions)
        assert len(unique_distributions) > 1, "Type distribution should vary"

    def test_auto_wave_has_groups(self):
        """Wave contains multiple groups (waveConfig entries > 1).

        Algorithm generates groups of size 1-3, but consecutive random types
        may merge visually, so only verify multiple groups exist.
        """
        wave = generate_wave(15, 1.0)
        assert len(wave["waveConfig"]) > 1, "Should have multiple groups"

    def test_auto_wave_all_ids_unique(self):
        """All auto-generated monster IDs are unique."""
        wave = generate_wave(50, 1.0)
        ids = [m["id"] for m in wave["monsters"]]
        assert len(ids) == len(set(ids))


class TestGenerateWaveMonsterAttributes:
    """Monster attribute completeness tests."""

    def test_all_required_fields_present(self):
        """Each monster contains all required fields."""
        wave = generate_wave(1, 1.0)
        required_fields = {"id", "type", "life", "speed", "shield", "money"}
        for monster in wave["monsters"]:
            assert required_fields.issubset(monster.keys())

    def test_monster_type_in_valid_range(self):
        """Monster type is in valid range (0-8)."""
        wave = generate_wave(15, 1.0)
        for monster in wave["monsters"]:
            assert 0 <= monster["type"] <= 8


class TestGenerateWaveConfig:
    """waveConfig aggregated format tests.

    Since monster attributes now have random factors, waveConfig no longer
    stores specific attribute values, only type and count for validation.
    """

    def test_wave_config_present(self):
        """Response contains waveConfig field."""
        wave = generate_wave(1, 1.0)
        assert "waveConfig" in wave

    def test_wave_config_structure(self):
        """waveConfig contains type and count fields."""
        wave = generate_wave(1, 1.0)
        for config in wave["waveConfig"]:
            assert "type" in config
            assert "count" in config

    def test_wave_config_count_matches_monsters(self):
        """waveConfig count matches monsters list."""
        wave = generate_wave(7, 1.0)
        monster_counts: dict[int, int] = {}
        for m in wave["monsters"]:
            t = m["type"]
            monster_counts[t] = monster_counts.get(t, 0) + 1
        config_counts = {c["type"]: c["count"] for c in wave["waveConfig"]}
        assert monster_counts == config_counts


class TestGenerateWaveEdgeCases:
    """Edge case tests."""

    def test_wave_0_raises_error(self):
        """Wave 0 should raise error."""
        with pytest.raises(ValueError, match="Wave number must be greater than 0"):
            generate_wave(0, 1.0)

    def test_negative_wave_raises_error(self):
        """Negative wave should raise error."""
        with pytest.raises(ValueError, match="Wave number must be greater than 0"):
            generate_wave(-1, 1.0)

    def test_difficulty_below_1_works(self):
        """Difficulty below 1.0 works correctly."""
        wave = generate_wave(1, 0.5)
        monster = wave["monsters"][0]
        # life_base = 50 * (0.5+1) * 0.5 = 37.5
        # life_range = [18, 56] (37.5 * 0.5 ~ 37.5 * 1.5, int conversion)
        assert 18 <= monster["life"] <= 56
