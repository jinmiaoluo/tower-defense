"""清理过期游戏会话的管理命令."""

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from game.models import GameSession

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """清理过期的游戏会话.

    通过外部 cron 定时调用此命令：
    0 * * * * /app/.venv/bin/python manage.py cleanup_sessions
    """

    help = "清理过期的游戏会话"

    DEFAULT_HOURS = 24

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=self.DEFAULT_HOURS,
            help=f"会话过期时间（小时），默认 {self.DEFAULT_HOURS}",
        )

    def handle(self, *args, **options):
        hours = options["hours"]
        threshold = timezone.now() - timedelta(hours=hours)
        deleted, _ = GameSession.objects.filter(created_at__lt=threshold).delete()
        self.stdout.write(f"已清理 {deleted} 个过期会话")
        logger.info(f"清理了 {deleted} 个过期会话（超过 {hours} 小时）")
