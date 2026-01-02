"""Pytest configuration and fixtures."""

import pytest
from django.test import Client

from game.models import GameSession, LeaderboardEntry, WaveRecord


@pytest.fixture
def client() -> Client:
    """Django test client."""
    return Client()


@pytest.fixture
def game_config() -> dict:
    """基础游戏配置."""
    return {
        "buildings": {
            "wall": {
                "name": "路障",
                "cost": 5,
                "damage": 0,
                "range": 0,
                "speed": 0,
                "upgradeCostRatio": 0.75,
                "sellRatio": 0.5,
            },
            "cannon": {
                "name": "炮台",
                "cost": 300,
                "damage": 12,
                "range": 8,
                "speed": 30,
                "upgradeCostRatio": 0.75,
                "sellRatio": 0.5,
            },
        },
        "monsters": {
            0: {
                "name": "普通怪",
                "life": 50,
                "speed": 3,
                "shield": 0,
                "damage": 1,
                "money": 10,
                "color": "#00ff00",
            },
        },
        "map": {
            "width": 16,
            "height": 16,
            "entrance": [0, 0],
            "exit": [15, 15],
            "obstacles": [],
        },
        "initial": {
            "money": 500,
            "life": 100,
            "difficulty": 1.0,
        },
    }


@pytest.fixture
def first_wave() -> dict:
    """第一波怪物配置."""
    return {
        "waveNumber": 1,
        "monsters": [
            {
                "id": "m-001",
                "type": 0,
                "life": 50,
                "speed": 3,
                "shield": 0,
                "money": 10,
            },
            {
                "id": "m-002",
                "type": 0,
                "life": 50,
                "speed": 3,
                "shield": 0,
                "money": 10,
            },
            {
                "id": "m-003",
                "type": 0,
                "life": 50,
                "speed": 3,
                "shield": 0,
                "money": 10,
            },
        ],
    }


@pytest.fixture
def game_session(db, game_config: dict, first_wave: dict) -> GameSession:
    """创建测试用游戏会话."""
    return GameSession.objects.create(
        money=500,
        life=100,
        difficulty=1.0,
        wave_count=0,
        buildings=[],
        config=game_config,
        next_wave=first_wave,
    )


@pytest.fixture
def game_session_with_waves(game_session: GameSession) -> GameSession:
    """创建带有波次记录的游戏会话."""
    for i in range(1, 6):
        WaveRecord.objects.create(
            session=game_session,
            wave_number=i,
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
            end_money=500 + i * 30,
            end_score=i * 30,
            end_life=100,
            end_difficulty=1.0,
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
