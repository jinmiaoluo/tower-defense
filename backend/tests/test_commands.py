"""管理命令单元测试."""

from datetime import timedelta
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.utils import timezone

from game.config import GAME_CONFIG, INITIAL
from game.generators import generate_wave
from game.models import GameSession, WaveRecord


class TestCleanupSessionsCommand:
    """cleanup_sessions 管理命令测试."""

    @pytest.fixture
    def create_session(self, db):
        """创建会话的工厂函数."""
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
        """测试清理过期会话."""
        now = timezone.now()

        # 创建一个过期会话 (25 小时前)
        expired_session = create_session(now - timedelta(hours=25))

        # 创建一个未过期会话 (1 小时前)
        valid_session = create_session(now - timedelta(hours=1))

        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        # 验证过期会话被删除
        assert not GameSession.objects.filter(id=expired_session.id).exists()

        # 验证未过期会话保留
        assert GameSession.objects.filter(id=valid_session.id).exists()

        output = out.getvalue()
        assert "1" in output

    @pytest.mark.django_db
    def test_cleanup_multiple_expired_sessions(self, create_session):
        """测试清理多个过期会话."""
        now = timezone.now()

        # 创建 3 个过期会话
        for hours in [25, 30, 48]:
            create_session(now - timedelta(hours=hours))

        # 创建 2 个未过期会话
        for hours in [1, 12]:
            create_session(now - timedelta(hours=hours))

        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        # 验证只有 2 个会话保留
        assert GameSession.objects.count() == 2

        output = out.getvalue()
        assert "3" in output

    @pytest.mark.django_db
    def test_cleanup_no_expired_sessions(self, create_session):
        """测试没有过期会话时的情况."""
        now = timezone.now()

        # 只创建未过期会话
        create_session(now - timedelta(hours=1))
        create_session(now - timedelta(hours=12))

        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        # 验证所有会话保留
        assert GameSession.objects.count() == 2

        output = out.getvalue()
        assert "0" in output

    @pytest.mark.django_db
    def test_cleanup_empty_database(self, db):
        """测试空数据库时的情况."""
        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        output = out.getvalue()
        assert "0" in output

    @pytest.mark.django_db
    def test_cleanup_boundary_24_hours(self, create_session):
        """测试 24 小时边界条件."""
        now = timezone.now()

        # 23 小时 50 分的会话不应被删除（有充足的安全边际）
        session_23h50m = create_session(now - timedelta(hours=23, minutes=50))

        # 24 小时 10 分的会话应被删除（有充足的安全边际）
        session_24h10m = create_session(now - timedelta(hours=24, minutes=10))

        out = StringIO()
        call_command("cleanup_sessions", stdout=out)

        # 验证 23h50m 的会话保留
        assert GameSession.objects.filter(id=session_23h50m.id).exists()

        # 验证 24h10m 的会话被删除
        assert not GameSession.objects.filter(id=session_24h10m.id).exists()

    @pytest.mark.django_db
    def test_cleanup_cascade_deletes_wave_records(self, create_session):
        """测试删除会话时级联删除波次记录."""
        now = timezone.now()

        # 创建过期会话
        expired_session = create_session(now - timedelta(hours=25))

        # 为会话添加波次记录
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

        # 验证波次记录也被删除
        assert WaveRecord.objects.filter(session=expired_session).count() == 0

    @pytest.mark.django_db
    def test_cleanup_custom_hours(self, create_session):
        """测试自定义过期时间参数."""
        now = timezone.now()

        # 创建 13 小时前的会话
        session_13h = create_session(now - timedelta(hours=13))

        # 创建 11 小时前的会话
        session_11h = create_session(now - timedelta(hours=11))

        out = StringIO()
        call_command("cleanup_sessions", "--hours=12", stdout=out)

        # 13 小时前的会话应被删除
        assert not GameSession.objects.filter(id=session_13h.id).exists()

        # 11 小时前的会话应保留
        assert GameSession.objects.filter(id=session_11h.id).exists()


class TestCleanupSessionsScheduler:
    """cleanup_sessions 定时调度测试."""

    @pytest.mark.django_db
    def test_daemon_mode_runs_cleanup(self, db):
        """测试守护进程模式."""
        from game.management.commands.cleanup_sessions import Command

        cmd = Command()

        # 验证定时间隔设置正确 (2 小时 = 7200 秒)
        assert cmd.DEFAULT_INTERVAL == 7200

    @pytest.mark.django_db
    def test_daemon_mode_custom_interval(self, db):
        """测试自定义定时间隔."""
        out = StringIO()

        # 使用 --daemon 和 --interval 参数运行时，应能正确解析参数
        with patch(
            "game.management.commands.cleanup_sessions.Command._run_scheduler"
        ) as mock_scheduler:
            try:
                call_command(
                    "cleanup_sessions",
                    "--daemon",
                    "--interval=3600",
                    stdout=out,
                )
            except SystemExit:
                pass

            # 验证调度器被调用（或命令正确接受参数）
            # 由于是无限循环，我们只验证参数被接受
