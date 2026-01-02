"""清理过期游戏会话的管理命令."""

import logging
import signal
import sys
import time
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from game.models import GameSession

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """清理过期的游戏会话.

    支持两种运行模式：
    1. 单次执行：清理当前过期的会话后退出
    2. 守护进程：每隔指定时间自动清理过期会话
    """

    help = "清理过期的游戏会话"

    DEFAULT_HOURS = 24
    DEFAULT_INTERVAL = 3600  # 1 小时 = 3600 秒

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._shutdown = False

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=self.DEFAULT_HOURS,
            help=f"会话过期时间（小时），默认 {self.DEFAULT_HOURS}",
        )
        parser.add_argument(
            "--daemon",
            action="store_true",
            help="以守护进程模式运行，定时清理",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=self.DEFAULT_INTERVAL,
            help=f"清理间隔（秒），仅在 --daemon 模式下有效，默认 {self.DEFAULT_INTERVAL}",
        )

    def handle(self, *args, **options):
        hours = options["hours"]
        daemon = options["daemon"]
        interval = options["interval"]

        if daemon:
            self._run_scheduler(hours, interval)
        else:
            self._cleanup_sessions(hours)

    def _cleanup_sessions(self, hours: int) -> int:
        """执行一次清理.

        Args:
            hours: 会话过期时间（小时）

        Returns:
            删除的会话数量
        """
        threshold = timezone.now() - timedelta(hours=hours)
        deleted, _ = GameSession.objects.filter(created_at__lt=threshold).delete()
        self.stdout.write(f"已清理 {deleted} 个过期会话")
        logger.info(f"清理了 {deleted} 个过期会话（超过 {hours} 小时）")
        return deleted

    def _run_scheduler(self, hours: int, interval: int):
        """以守护进程模式运行定时清理.

        Args:
            hours: 会话过期时间（小时）
            interval: 清理间隔（秒）
        """
        self.stdout.write(
            f"启动定时清理服务，每 {interval} 秒清理超过 {hours} 小时的会话"
        )
        logger.info(f"启动定时清理服务，间隔 {interval} 秒，过期时间 {hours} 小时")

        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

        while not self._shutdown:
            try:
                self._cleanup_sessions(hours)
                time.sleep(interval)
            except Exception as e:
                logger.error(f"清理过程出错: {e}")
                time.sleep(60)

        self.stdout.write("清理服务已停止")
        logger.info("清理服务已停止")

    def _signal_handler(self, signum, frame):
        """处理终止信号."""
        self.stdout.write(f"收到信号 {signum}，正在停止...")
        logger.info(f"收到信号 {signum}，正在停止服务")
        self._shutdown = True
