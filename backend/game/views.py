"""Game API views."""

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class CreateSessionView(APIView):
    """POST /api/game/sessions - 创建游戏会话"""

    def post(self, request: Request) -> Response:
        # TODO: 实现创建会话逻辑
        return Response(
            {"error": {"code": "NOT_IMPLEMENTED", "message": "尚未实现"}},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class SubmitWaveView(APIView):
    """POST /api/game/sessions/wave - 提交波次结果"""

    def post(self, request: Request) -> Response:
        # TODO: 实现提交波次逻辑
        return Response(
            {"error": {"code": "NOT_IMPLEMENTED", "message": "尚未实现"}},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class EndSessionView(APIView):
    """POST /api/game/sessions/end - 结束游戏会话"""

    def post(self, request: Request) -> Response:
        # TODO: 实现结束会话逻辑
        return Response(
            {"error": {"code": "NOT_IMPLEMENTED", "message": "尚未实现"}},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class LeaderboardView(APIView):
    """GET /api/game/leaderboard - 获取排行榜"""

    def get(self, request: Request) -> Response:
        # TODO: 实现排行榜逻辑
        return Response(
            {"error": {"code": "NOT_IMPLEMENTED", "message": "尚未实现"}},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )
