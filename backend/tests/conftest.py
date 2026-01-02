"""Pytest configuration and fixtures."""

import pytest
from django.test import Client

from game.config import GAME_CONFIG, INITIAL, MONSTERS
from game.models import GameSession, LeaderboardEntry, WaveRecord


@pytest.fixture
def client() -> Client:
    """Django test client."""
    return Client()


@pytest.fixture
def game_config() -> dict:
    """游戏配置."""
    return GAME_CONFIG


@pytest.fixture
def first_wave() -> dict:
    """第一波怪物配置.

    与旧实现一致：第一波只有 1 个 type 0 怪物。
    参考 td-data-stage-1.js:189-191
    """
    monster = MONSTERS[0]
    return {
        "waveNumber": 1,
        "monsters": [
            {
                "id": "m-001",
                "type": 0,
                "life": monster["life"],
                "speed": monster["speed"],
                "shield": monster["shield"],
                "money": monster["money"],
            }
        ],
    }


@pytest.fixture
def game_session(db, game_config: dict, first_wave: dict) -> GameSession:
    """创建测试用游戏会话."""
    return GameSession.objects.create(
        money=INITIAL["money"],
        life=INITIAL["life"],
        difficulty=INITIAL["difficulty"],
        wave_count=0,
        buildings=[],
        config=game_config,
        next_wave=first_wave,
    )


@pytest.fixture
def game_session_with_waves(game_session: GameSession) -> GameSession:
    """创建带有波次记录的游戏会话."""
    monster = MONSTERS[0]
    money_per_wave = monster["money"] * 3

    for i in range(1, 6):
        WaveRecord.objects.create(
            session=game_session,
            wave_number=i,
            killed=3,
            killed_by_type={0: 3},
            passed=0,
            score_gained=30,
            money_gained=money_per_wave,
            life_lost=0,
            total_damage_dealt=150,
            total_life_destroyed=150,
            wave_duration_frames=1000,
            money_spent=0,
            money_income=0,
            building_count=0,
            end_money=INITIAL["money"] + i * money_per_wave,
            end_score=i * 30,
            end_life=INITIAL["life"],
            end_difficulty=INITIAL["difficulty"],
        )
    game_session.wave_count = 5
    game_session.score = 150
    game_session.save()
    return game_session


@pytest.fixture
def leaderboard_entries(db) -> list[LeaderboardEntry]:
    """创建测试用排行榜数据."""
    entries = []
    for i in range(20):
        entries.append(
            LeaderboardEntry.objects.create(
                nickname=f"Player{i}",
                score=1000 - i * 50,
                waves_completed=10 + i,
            )
        )
    return entries
