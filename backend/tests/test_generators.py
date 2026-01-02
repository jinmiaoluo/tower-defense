"""波次生成器单元测试."""

import uuid

import pytest

from game.generators import generate_first_wave, generate_wave


class TestGenerateWavePredefined:
    """预定义波次（1-10）测试."""

    def test_wave_1_structure(self):
        """第 1 波：1 个普通怪（type 0）."""
        wave = generate_wave(1, 1.0)
        assert wave["waveNumber"] == 1
        assert len(wave["monsters"]) == 1
        assert all(m["type"] == 0 for m in wave["monsters"])

    def test_wave_2_structure(self):
        """第 2 波：1 个普通怪 + 1 个稍强怪."""
        wave = generate_wave(2, 1.0)
        assert wave["waveNumber"] == 2
        assert len(wave["monsters"]) == 2
        types = [m["type"] for m in wave["monsters"]]
        assert types.count(0) == 1
        assert types.count(1) == 1

    def test_wave_7_structure(self):
        """第 7 波：5 个 type0 + 3 个 type1 + 1 个 type2."""
        wave = generate_wave(7, 1.0)
        assert wave["waveNumber"] == 7
        assert len(wave["monsters"]) == 9  # 5 + 3 + 1
        types = [m["type"] for m in wave["monsters"]]
        assert types.count(0) == 5
        assert types.count(1) == 3
        assert types.count(2) == 1

    def test_wave_10_structure(self):
        """第 10 波：8 个 type0 + 4 个 type1 + 3 个 type2."""
        wave = generate_wave(10, 1.0)
        assert wave["waveNumber"] == 10
        assert len(wave["monsters"]) == 15  # 8 + 4 + 3


class TestGenerateWaveMonsterIds:
    """怪物 ID 测试."""

    def test_unique_ids(self):
        """每个怪物有唯一 UUID."""
        wave = generate_wave(5, 1.0)
        ids = [m["id"] for m in wave["monsters"]]
        assert len(ids) == len(set(ids))

    def test_valid_uuid_format(self):
        """ID 是有效的 UUID 格式."""
        wave = generate_wave(1, 1.0)
        for monster in wave["monsters"]:
            # 验证是有效 UUID（不会抛出异常）
            uuid.UUID(monster["id"])


class TestGenerateWaveWithDifficulty:
    """难度系数影响测试."""

    def test_difficulty_1_attributes(self):
        """难度 1.0 时的属性计算.

        普通怪基础属性：life=50, speed=3, shield=0, money=5
        difficulty=1.0 时：
        - life = 50 * (1+1) * 0.5 = 50
        - speed = 3 + 1.0/2 = 3.5
        - shield = 0 + 1.0/2 = 0 (int)
        """
        wave = generate_wave(1, 1.0)
        monster = wave["monsters"][0]
        assert monster["type"] == 0
        assert monster["life"] == 50
        assert monster["speed"] == 3.5
        assert monster["shield"] == 0
        assert monster["money"] == 5

    def test_difficulty_2_attributes(self):
        """难度 2.0 时属性增加."""
        wave = generate_wave(1, 2.0)
        monster = wave["monsters"][0]
        # life = 50 * (2+1) * 0.5 = 75
        assert monster["life"] == 75
        # speed = 3 + 2.0/2 = 4.0
        assert monster["speed"] == 4.0
        # shield = 0 + 2.0/2 = 1
        assert monster["shield"] == 1

    def test_high_difficulty_attributes(self):
        """高难度时属性大幅增加."""
        wave = generate_wave(1, 10.0)
        monster = wave["monsters"][0]
        # life = 50 * (10+1) * 0.5 = 275
        assert monster["life"] == 275
        # speed = 3 + 10.0/2 = 8.0 (不超过 max_speed=10)
        assert monster["speed"] == 8.0
        # shield = 0 + 10.0/2 = 5
        assert monster["shield"] == 5


class TestGenerateWaveAuto:
    """自动生成波次（11+）测试."""

    def test_wave_11_auto_generated(self):
        """第 11 波开始自动生成.

        count = floor(11^1.1) = floor(13.98) = 13
        """
        wave = generate_wave(11, 1.0)
        assert wave["waveNumber"] == 11
        assert len(wave["monsters"]) == 13

    def test_wave_15_monster_count(self):
        """第 15 波怪物数量.

        count = floor(15^1.1) = floor(19.67) = 19
        """
        wave = generate_wave(15, 1.0)
        assert wave["waveNumber"] == 15
        assert len(wave["monsters"]) == 19

    def test_wave_50_monster_count(self):
        """第 50 波怪物数量.

        count = floor(50^1.1) = floor(73.94) = 73
        """
        wave = generate_wave(50, 1.0)
        assert len(wave["monsters"]) == 73

    def test_wave_100_capped_at_max(self):
        """第 100 波怪物数量不超过上限.

        count = min(floor(100^1.1), 100) ≈ 158，但被限制为 100
        """
        wave = generate_wave(100, 1.0)
        assert len(wave["monsters"]) == 100

    def test_auto_wave_uses_all_monster_types(self):
        """自动生成的波次使用多种怪物类型."""
        wave = generate_wave(20, 1.0)
        types = set(m["type"] for m in wave["monsters"])
        # 应该使用多种类型（至少 3 种）
        assert len(types) >= 3

    def test_auto_wave_deterministic(self):
        """自动生成是确定性的（相同参数产生相同结果）."""
        wave1 = generate_wave(15, 1.0)
        wave2 = generate_wave(15, 1.0)
        # 类型和数量应该相同（ID 不同）
        types1 = [m["type"] for m in wave1["monsters"]]
        types2 = [m["type"] for m in wave2["monsters"]]
        assert types1 == types2
        # 但 ID 应该不同（每次生成新的 UUID）
        ids1 = set(m["id"] for m in wave1["monsters"])
        ids2 = set(m["id"] for m in wave2["monsters"])
        assert ids1.isdisjoint(ids2)


class TestGenerateWaveMonsterAttributes:
    """怪物属性完整性测试."""

    def test_all_required_fields_present(self):
        """每个怪物包含所有必需字段."""
        wave = generate_wave(1, 1.0)
        required_fields = {"id", "type", "life", "speed", "shield", "money"}
        for monster in wave["monsters"]:
            assert required_fields.issubset(monster.keys())

    def test_monster_type_in_valid_range(self):
        """怪物类型在有效范围内（0-8）."""
        wave = generate_wave(15, 1.0)
        for monster in wave["monsters"]:
            assert 0 <= monster["type"] <= 8


class TestGenerateFirstWave:
    """generate_first_wave 测试."""

    def test_returns_wave_1(self):
        """返回第 1 波配置."""
        wave = generate_first_wave()
        assert wave["waveNumber"] == 1

    def test_uses_default_difficulty(self):
        """使用默认难度 1.0."""
        wave = generate_first_wave()
        # 验证属性是按难度 1.0 计算的
        monster = wave["monsters"][0]
        assert monster["life"] == 50  # 难度 1.0 时的值


class TestGenerateWaveEdgeCases:
    """边界情况测试."""

    def test_wave_0_raises_error(self):
        """波次 0 应该抛出错误."""
        with pytest.raises(ValueError, match="波次号必须大于 0"):
            generate_wave(0, 1.0)

    def test_negative_wave_raises_error(self):
        """负数波次应该抛出错误."""
        with pytest.raises(ValueError, match="波次号必须大于 0"):
            generate_wave(-1, 1.0)

    def test_difficulty_below_1_works(self):
        """难度低于 1.0 也能正常工作."""
        wave = generate_wave(1, 0.5)
        monster = wave["monsters"][0]
        # life = 50 * (0.5+1) * 0.5 = 37.5 -> 37
        assert monster["life"] == 37
