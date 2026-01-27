"""Tests for game models."""

import pytest

from game.models import GameSession, LeaderboardEntry, WaveRecord


@pytest.mark.django_db
class TestGameSession:
    """Tests for GameSession model."""

    def test_create_session(self, game_config: dict, first_wave: dict) -> None:
        """Test creating a game session."""
        session = GameSession.objects.create(
            money=500,
            life=100,
            config=game_config,
            next_wave=first_wave,
        )

        assert session.id is not None
        assert session.money == 500
        assert session.life == 100
        assert session.score == 0
        assert session.wave_count == 0
        assert session.difficulty == 1.0
        assert session.buildings == []

    def test_session_str(self, game_session: GameSession) -> None:
        """Test session string representation."""
        assert "Session" in str(game_session)
        assert "Wave 0" in str(game_session)


@pytest.mark.django_db
class TestWaveRecord:
    """Tests for WaveRecord model."""

    def test_create_wave_record(self, game_session: GameSession) -> None:
        """Test creating a wave record."""
        record = WaveRecord.objects.create(
            session=game_session,
            wave_number=1,
            killed=3,
            killed_by_type={0: 3},
            passed=0,
            score_gained=30,
            money_gained=30,
            life_lost=0,
            total_damage_dealt=150,
            total_life_destroyed=150,
            wave_duration_frames=1000,
            money_spent=300,
            money_income=0,
            building_count=1,
            end_money=230,
            end_score=30,
            end_life=100,
            end_difficulty=1.0,
        )

        assert record.id is not None
        assert record.session == game_session
        assert record.wave_number == 1
        assert record.killed == 3

    def test_unique_wave_number_constraint(self, game_session: GameSession) -> None:
        """Test unique wave number constraint."""
        WaveRecord.objects.create(
            session=game_session,
            wave_number=1,
            killed=3,
            killed_by_type={0: 3},
            passed=0,
            score_gained=30,
            money_gained=30,
            life_lost=0,
            total_damage_dealt=150,
            total_life_destroyed=150,
            wave_duration_frames=1000,
            money_spent=0,
            money_income=0,
            building_count=0,
            end_money=530,
            end_score=30,
            end_life=100,
            end_difficulty=1.0,
        )

        with pytest.raises(Exception):
            WaveRecord.objects.create(
                session=game_session,
                wave_number=1,
                killed=0,
                killed_by_type={},
                passed=3,
                score_gained=0,
                money_gained=0,
                life_lost=3,
                total_damage_dealt=0,
                total_life_destroyed=0,
                wave_duration_frames=500,
                money_spent=0,
                money_income=0,
                building_count=0,
                end_money=500,
                end_score=0,
                end_life=97,
                end_difficulty=1.0,
            )


@pytest.mark.django_db
class TestLeaderboardEntry:
    """Tests for LeaderboardEntry model."""

    def test_create_entry(self) -> None:
        """Test creating a leaderboard entry."""
        entry = LeaderboardEntry.objects.create(
            nickname="TestPlayer",
            score=1000,
            waves_completed=10,
        )

        assert entry.id is not None
        assert entry.nickname == "TestPlayer"
        assert entry.score == 1000
        assert entry.waves_completed == 10

    def test_ordering(self, leaderboard_entries: list[LeaderboardEntry]) -> None:
        """Test leaderboard ordering."""
        entries = LeaderboardEntry.objects.all()[:5]
        scores = [e.score for e in entries]

        assert scores == sorted(scores, reverse=True)
