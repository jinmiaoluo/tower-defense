import uuid

from django.db import models


class GameSession(models.Model):
    """游戏会话模型

    存储单局游戏的完整状态，包括：
    - 经济状态（金钱、分数）
    - 生存状态（生命值）
    - 进度状态（波次数、难度系数）
    - 建筑状态（JSON 格式存储）
    - 配置数据（游戏配置、下一波怪物配置）
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # 经济状态
    money = models.IntegerField(help_text="当前金钱")
    score = models.IntegerField(default=0, help_text="累计分数")

    # 生存状态
    life = models.IntegerField(help_text="当前生命值")

    # 进度状态
    wave_count = models.IntegerField(default=0, help_text="已完成的波次数")
    difficulty = models.FloatField(default=1.0, help_text="当前难度系数")

    # 建筑状态（用于跨波次验证）
    # 格式: [{"id": "b-001", "type": "cannon", "level": 2, "position": [x, y]}, ...]
    buildings = models.JSONField(default=list, help_text="当前建筑列表")

    # 配置数据
    config = models.JSONField(help_text="游戏配置（建筑、怪物、地图等）")
    next_wave = models.JSONField(help_text="下一波怪物配置")

    class Meta:
        db_table = "game_session"
        indexes = [
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"Session {self.id} (Wave {self.wave_count}, Score {self.score})"


class WaveRecord(models.Model):
    """波次记录模型

    记录每一波的战斗结果，用于：
    - Level 4 统计分析（检测异常行为）
    - 游戏结束时的累计一致性验证
    - 历史数据追溯

    原则：只创建不更新，是不可变的历史记录
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        GameSession, on_delete=models.CASCADE, related_name="waves"
    )
    wave_number = models.IntegerField(help_text="波次编号（从 1 开始）")
    created_at = models.DateTimeField(auto_now_add=True)

    # 战斗结果（客户端提供，验证后写入）
    killed = models.IntegerField(help_text="击杀怪物数")
    killed_by_type = models.JSONField(
        default=dict, help_text="每种怪物类型的击杀数 {type_id: count}"
    )
    passed = models.IntegerField(help_text="穿过终点的怪物数")
    remaining = models.IntegerField(default=0, help_text="提前结束时场上剩余的怪物数")
    score_gained = models.IntegerField(help_text="本波获得的分数")
    money_gained = models.IntegerField(help_text="本波获得的金钱")
    life_lost = models.IntegerField(help_text="本波损失的生命值")
    total_damage_dealt = models.IntegerField(help_text="本波造成的总伤害")
    total_life_destroyed = models.IntegerField(
        default=0, help_text="击杀怪物的总生命值"
    )
    wave_duration_frames = models.IntegerField(help_text="波次持续帧数")

    # 经济数据（服务端计算）
    money_spent = models.IntegerField(help_text="本波花费的金钱")
    money_income = models.IntegerField(help_text="本波出售建筑的收入")
    building_count = models.IntegerField(help_text="波次结束时的建筑数量")

    # 状态快照（波次结束时的状态）
    end_money = models.IntegerField(help_text="波次结束时的金钱")
    end_score = models.IntegerField(help_text="波次结束时的分数")
    end_life = models.IntegerField(help_text="波次结束时的生命值")
    end_difficulty = models.FloatField(help_text="波次结束时的难度系数")

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
