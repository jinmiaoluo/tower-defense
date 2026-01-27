"""Management command to clean up expired game sessions."""

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from game.models import GameSession

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """Clean up expired game sessions.

    Intended to be called via an external cron job:
    0 * * * * /app/.venv/bin/python manage.py cleanup_sessions
    """

    help = "Clean up expired game sessions"

    DEFAULT_HOURS = 24

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=self.DEFAULT_HOURS,
            help=f"Session expiry threshold in hours (default: {self.DEFAULT_HOURS})",
        )

    def handle(self, *args, **options):
        hours = options["hours"]
        threshold = timezone.now() - timedelta(hours=hours)
        deleted, _ = GameSession.objects.filter(created_at__lt=threshold).delete()
        self.stdout.write(f"Cleaned up {deleted} expired session(s)")
        logger.info("Cleaned up %d expired session(s) (older than %d hours)", deleted, hours)
