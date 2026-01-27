from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from django.db import models

if TYPE_CHECKING:
    from django.db.models.manager import RelatedManager


class GameSession(models.Model):
    """Stores the complete state of a single game session."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    money = models.IntegerField(help_text="Current money")
    score = models.IntegerField(default=0, help_text="Cumulative score")

    life = models.IntegerField(help_text="Current life points")

    wave_count = models.IntegerField(default=0, help_text="Completed wave count")
    difficulty = models.FloatField(default=1.0, help_text="Current difficulty multiplier")

    # Used for cross-wave validation
    # Format: [{"id": "b-001", "type": "cannon", "level": 2, "position": [x, y]}, ...]
    buildings = models.JSONField(default=list, help_text="Current building list")

    config = models.JSONField(help_text="Game config (buildings, monsters, map, etc.)")
    next_wave = models.JSONField(help_text="Next wave monster config")

    # Type hint for reverse relation (defined in WaveRecord.session)
    waves: RelatedManager[WaveRecord]

    class Meta:
        db_table = "game_session"
        indexes = [
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"Session {self.id} (Wave {self.wave_count}, Score {self.score})"


class WaveRecord(models.Model):
    """Records the result of a single wave.

    Immutable once created. Used for statistical analysis
    and cumulative consistency validation.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        GameSession, on_delete=models.CASCADE, related_name="waves"
    )
    wave_number = models.IntegerField(help_text="Wave number (starting from 1)")
    created_at = models.DateTimeField(auto_now_add=True)

    # Battle results (provided by client, written after validation)
    killed = models.IntegerField(help_text="Monsters killed")
    killed_by_type = models.JSONField(
        default=dict, help_text="Kills per monster type {type_id: count}"
    )
    passed = models.IntegerField(help_text="Monsters that reached the end")
    remaining = models.IntegerField(default=0, help_text="Monsters remaining on early end")
    score_gained = models.IntegerField(help_text="Score gained this wave")
    money_gained = models.IntegerField(help_text="Money gained this wave")
    life_lost = models.IntegerField(help_text="Life lost this wave")
    total_damage_dealt = models.IntegerField(help_text="Total damage dealt this wave")
    total_life_destroyed = models.IntegerField(
        default=0, help_text="Total HP of killed monsters"
    )
    wave_duration_frames = models.IntegerField(help_text="Wave duration in frames")

    # Economy data (calculated server-side)
    money_spent = models.IntegerField(help_text="Money spent this wave")
    money_income = models.IntegerField(help_text="Income from selling buildings this wave")
    building_count = models.IntegerField(help_text="Building count at wave end")

    # State snapshot at wave end
    end_money = models.IntegerField(help_text="Money at wave end")
    end_score = models.IntegerField(help_text="Score at wave end")
    end_life = models.IntegerField(help_text="Life at wave end")
    end_difficulty = models.FloatField(help_text="Difficulty multiplier at wave end")

    class Meta:
        db_table = "wave_record"
        ordering = ["wave_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "wave_number"],
                name="unique_session_wave",
            )
        ]
        indexes = [
            models.Index(fields=["session", "wave_number"]),
        ]

    def __str__(self):
        return f"Wave {self.wave_number} of {self.session_id}"


class LeaderboardEntry(models.Model):
    """排行榜记录模型

    存储游戏结束后的最终成绩，用于排行榜展示
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nickname = models.CharField(max_length=32, help_text="玩家昵称")
    score = models.IntegerField(help_text="最终得分")
    waves_completed = models.IntegerField(help_text="完成的波次数")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "leaderboard"
        ordering = ["-score", "-waves_completed"]
        indexes = [
            models.Index(fields=["-score"]),
            models.Index(fields=["-score", "-waves_completed"]),
        ]

    def __str__(self):
        return f"{self.nickname}: {self.score} points ({self.waves_completed} waves)"
