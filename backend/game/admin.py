from django.contrib import admin

from .models import GameSession, LeaderboardEntry, WaveRecord


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "wave_count", "score", "life", "money", "created_at"]
    list_filter = ["created_at"]
    readonly_fields = ["id", "created_at"]
    ordering = ["-created_at"]


@admin.register(WaveRecord)
class WaveRecordAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "session",
        "wave_number",
        "killed",
        "passed",
        "score_gained",
        "created_at",
    ]
    list_filter = ["wave_number", "created_at"]
    readonly_fields = ["id", "created_at"]
    ordering = ["-created_at"]


@admin.register(LeaderboardEntry)
class LeaderboardEntryAdmin(admin.ModelAdmin):
    list_display = ["nickname", "score", "waves_completed", "created_at"]
    list_filter = ["created_at"]
    readonly_fields = ["id", "created_at"]
    ordering = ["-score", "-waves_completed"]
