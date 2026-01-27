"""Management command unit tests."""

from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from game.config import GAME_CONFIG, INITIAL
from game.generators import generate_wave
from game.models import GameSession, WaveRecord


class TestCleanupSessionsCommand:
    """cleanup_sessions management command tests."""

    @pytest.fixture
    def create_session(self, db):
        """Return a session factory function."""
        def _create(created_at=None):
            first_wave = generate_wave(1, INITIAL["difficulty"])
            session = GameSession.objects.create(
                money=INITIAL["money"],
                life=INITIAL["life"],
                difficulty=INITIAL["difficulty"],
                wave_count=0,
                buildings=[],
                config=GAME_CONFIG,
                next_wave=first_wave,
            )
            if created_at:
                GameSession.objects.filter(id=session.id).update(created_at=created_at)
                session.refresh_from_db()
            return session
        return _create

    @pytest.mark.django_db
    def test_cleanup_expired_sessions(self, create_session):
        """Test cleaning up expired sessions."""
        now = timezone.now()

        # Create an expired session (25 hours ago)
        expired_session = create_session(now - timedelta(hours=25))

        # Create a non-expired session (1 hour ago)
        valid_session = create_session(now - timedelta(hours=1))

        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        # Verify expired session is deleted
        assert not GameSession.objects.filter(id=expired_session.id).exists()

        # Verify non-expired session is retained
        assert GameSession.objects.filter(id=valid_session.id).exists()

        output = out.getvalue()
        assert "1" in output

    @pytest.mark.django_db
    def test_cleanup_multiple_expired_sessions(self, create_session):
        """Test cleaning up multiple expired sessions."""
        now = timezone.now()

        # Create 3 expired sessions
        for hours in [25, 30, 48]:
            create_session(now - timedelta(hours=hours))

        # Create 2 non-expired sessions
        for hours in [1, 12]:
            create_session(now - timedelta(hours=hours))

        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        # Verify only 2 sessions are retained
        assert GameSession.objects.count() == 2

        output = out.getvalue()
        assert "3" in output

    @pytest.mark.django_db
    def test_cleanup_no_expired_sessions(self, create_session):
        """Test when no expired sessions exist."""
        now = timezone.now()

        # Only create non-expired sessions
        create_session(now - timedelta(hours=1))
        create_session(now - timedelta(hours=12))

        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        # Verify all sessions are retained
        assert GameSession.objects.count() == 2

        output = out.getvalue()
        assert "0" in output

    @pytest.mark.django_db
    def test_cleanup_empty_database(self, db):
        """Test with an empty database."""
        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        output = out.getvalue()
        assert "0" in output

    @pytest.mark.django_db
    def test_cleanup_boundary_24_hours(self, create_session):
        """Test 24-hour boundary condition."""
        now = timezone.now()

        # 23h50m session should not be deleted (sufficient safety margin)
        session_23h50m = create_session(now - timedelta(hours=23, minutes=50))

        # 24h10m session should be deleted (sufficient safety margin)
        session_24h10m = create_session(now - timedelta(hours=24, minutes=10))

        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        # Verify 23h50m session is retained
        assert GameSession.objects.filter(id=session_23h50m.id).exists()

        # Verify 24h10m session is deleted
        assert not GameSession.objects.filter(id=session_24h10m.id).exists()

    @pytest.mark.django_db
    def test_cleanup_cascade_deletes_wave_records(self, create_session):
        """Test cascade deletion of wave records when session is deleted."""
        now = timezone.now()

        # Create an expired session
        expired_session = create_session(now - timedelta(hours=25))

        # Add wave records to the session
        WaveRecord.objects.create(
            session=expired_session,
            wave_number=1,
            killed=3,
            killed_by_type={0: 3},
            passed=0,
            score_gained=30,
            money_gained=15,
            life_lost=0,
            total_damage_dealt=100,
            total_life_destroyed=100,
            wave_duration_frames=1000,
            money_spent=0,
            money_income=0,
            building_count=0,
            end_money=515,
            end_score=30,
            end_life=100,
            end_difficulty=1.0,
        )

        assert WaveRecord.objects.filter(session=expired_session).count() == 1

        call_command("cleanup_sessions", stdout=StringIO())

        # Verify wave records are also deleted
        assert WaveRecord.objects.filter(session=expired_session).count() == 0

    @pytest.mark.django_db
    def test_cleanup_custom_hours(self, create_session):
        """Test custom expiration hours parameter."""
        now = timezone.now()

        # Create a session from 13 hours ago
        session_13h = create_session(now - timedelta(hours=13))

        # Create a session from 11 hours ago
        session_11h = create_session(now - timedelta(hours=11))

        out = StringIO()
        call_command("cleanup_sessions", "--hours=12", stdout=out)

        # 13-hour-old session should be deleted
        assert not GameSession.objects.filter(id=session_13h.id).exists()

        # 11-hour-old session should be retained
        assert GameSession.objects.filter(id=session_11h.id).exists()
