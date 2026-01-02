"""Game API views."""

from typing import Any

from django.db import transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from game.calculators import (
    calc_final_score,
    calc_life_reward,
    calc_new_difficulty,
    process_actions,
)
from game.config import GAME_CONFIG, INITIAL, SCORE_CONFIG
from game.generators import generate_first_wave, generate_wave
from game.models import GameSession, LeaderboardEntry, WaveRecord
from game.validators import (
    validate_basic,
    validate_buildings_consistency,
    validate_game_end,
    validate_money_balance,
    validate_nickname,
    validate_score,
    validate_wave_continuity,
)


def _require_fields(data: dict, *fields: str) -> tuple[bool, str]:
    """检查必填字段."""
    missing = [f for f in fields if f not in data]
    if missing:
        return False, f"缺少必填字段: {', '.join(missing)}"
    return True, ""


def _convert_keys_to_snake_case(result: dict[str, Any]) -> dict[str, Any]:
    """将 camelCase 键转换为 snake_case."""
    mapping = {
        "killedByType": "killed_by_type",
        "scoreGained": "score_gained",
        "moneyGained": "money_gained",
        "lifeLost": "life_lost",
        "totalDamageDealt": "total_damage_dealt",
        "totalLifeDestroyed": "total_life_destroyed",
        "waveDurationFrames": "wave_duration_frames",
    }
    return {mapping.get(k, k): v for k, v in result.items()}


def _build_wave_config_for_validation(next_wave: dict) -> dict:
    """构建用于验证的波次配置."""
    monsters_by_type: dict[int, dict] = {}
    for m in next_wave["monsters"]:
        t = m["type"]
        if t not in monsters_by_type:
            monsters_by_type[t] = {
                "type": t,
                "count": 0,
                "life": m["life"],
                "money": m["money"],
            }
        monsters_by_type[t]["count"] += 1
    return {"monsters": list(monsters_by_type.values())}


class CreateSessionView(APIView):
    """POST /api/game/sessions - 创建游戏会话"""

    def post(self, request: Request) -> Response:
        first_wave = generate_first_wave()

        session = GameSession.objects.create(
            money=INITIAL["money"],
            life=INITIAL["life"],
            difficulty=INITIAL["difficulty"],
            wave_count=0,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=first_wave,
        )

        return Response({
            "sessionId": str(session.id),
            "config": GAME_CONFIG,
            "firstWave": first_wave,
        })


class SubmitWaveView(APIView):
    """POST /api/game/sessions/wave - 提交波次结果"""

    def post(self, request: Request) -> Response:
        data = request.data

        ok, msg = _require_fields(
            data, "sessionId", "waveNumber", "actions", "attacks", "result", "buildings"
        )
        if not ok:
            return Response(
                {"error": {"code": "INVALID_REQUEST", "message": msg}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            session = GameSession.objects.get(id=data["sessionId"])
        except GameSession.DoesNotExist:
            return Response(
                {"error": {"code": "SESSION_NOT_FOUND", "message": "会话不存在"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        wave_number = data["waveNumber"]
        actions = data["actions"]
        attacks = data["attacks"]
        result = _convert_keys_to_snake_case(data["result"])
        submitted_buildings = data["buildings"]

        ok, msg = validate_wave_continuity(session, wave_number)
        if not ok:
            return self._validation_error(msg)

        wave_config = _build_wave_config_for_validation(session.next_wave)
        ok, msg = validate_basic(result, wave_config)
        if not ok:
            return self._validation_error(msg)

        ok, msg = validate_score(attacks, result)
        if not ok:
            return self._validation_error(msg)

        spent, income, calculated_buildings = process_actions(
            actions, session.buildings, GAME_CONFIG
        )

        new_money = session.money - spent + income + result["money_gained"]
        new_state = {"money": new_money}

        ok, msg = validate_money_balance(new_state)
        if not ok:
            return self._validation_error(msg)

        ok, msg = validate_buildings_consistency(calculated_buildings, submitted_buildings)
        if not ok:
            return self._validation_error(msg)

        new_score = session.score + result["score_gained"]
        new_life = session.life - result["life_lost"]
        new_difficulty = calc_new_difficulty(session.difficulty, result["life_lost"], wave_number)

        with transaction.atomic():
            WaveRecord.objects.create(
                session=session,
                wave_number=wave_number,
                killed=result["killed"],
                killed_by_type=result["killed_by_type"],
                passed=result["passed"],
                score_gained=result["score_gained"],
                money_gained=result["money_gained"],
                life_lost=result["life_lost"],
                total_damage_dealt=result["total_damage_dealt"],
                total_life_destroyed=result["total_life_destroyed"],
                wave_duration_frames=result["wave_duration_frames"],
                money_spent=spent,
                money_income=income,
                building_count=len(calculated_buildings),
                end_money=new_money,
                end_score=new_score,
                end_life=new_life,
                end_difficulty=new_difficulty,
            )

            next_wave_data = None
            if new_life > 0:
                next_wave_number = wave_number + 1
                next_wave_data = generate_wave(next_wave_number, new_difficulty)

                life_reward = calc_life_reward(wave_number)
                if life_reward > 0:
                    next_wave_data["lifeReward"] = life_reward

                session.next_wave = next_wave_data

            session.money = new_money
            session.score = new_score
            session.life = new_life
            session.difficulty = new_difficulty
            session.wave_count = wave_number
            session.buildings = calculated_buildings
            session.save()

        response_data: dict[str, Any] = {
            "valid": True,
            "serverState": {
                "money": new_money,
                "score": new_score,
                "life": new_life,
                "difficulty": new_difficulty,
            },
        }

        if next_wave_data:
            response_data["nextWave"] = next_wave_data

        return Response(response_data)

    def _validation_error(self, message: str) -> Response:
        """返回验证错误响应."""
        return Response(
            {
                "valid": False,
                "error": {"code": "VALIDATION_FAILED", "message": message},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class EndSessionView(APIView):
    """POST /api/game/sessions/end - 结束游戏会话"""

    def post(self, request: Request) -> Response:
        data = request.data

        ok, msg = _require_fields(data, "sessionId", "nickname", "lastWave")
        if not ok:
            return Response(
                {"error": {"code": "INVALID_REQUEST", "message": msg}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ok, msg = validate_nickname(data["nickname"])
        if not ok:
            return Response(
                {"error": {"code": "INVALID_REQUEST", "message": msg}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            session = GameSession.objects.get(id=data["sessionId"])
        except GameSession.DoesNotExist:
            return Response(
                {"error": {"code": "SESSION_NOT_FOUND", "message": "会话不存在"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        last_wave_data = data["lastWave"]
        wave_number = last_wave_data["waveNumber"]
        actions = last_wave_data["actions"]
        attacks = last_wave_data["attacks"]
        result = _convert_keys_to_snake_case(last_wave_data["result"])
        submitted_buildings = last_wave_data["buildings"]

        ok, msg = validate_wave_continuity(session, wave_number)
        if not ok:
            return self._validation_error(msg)

        wave_config = _build_wave_config_for_validation(session.next_wave)
        ok, msg = validate_basic(result, wave_config)
        if not ok:
            return self._validation_error(msg)

        ok, msg = validate_score(attacks, result)
        if not ok:
            return self._validation_error(msg)

        spent, income, calculated_buildings = process_actions(
            actions, session.buildings, GAME_CONFIG
        )

        new_money = session.money - spent + income + result["money_gained"]
        new_state = {"money": new_money}

        ok, msg = validate_money_balance(new_state)
        if not ok:
            return self._validation_error(msg)

        ok, msg = validate_buildings_consistency(calculated_buildings, submitted_buildings)
        if not ok:
            return self._validation_error(msg)

        new_score = session.score + result["score_gained"]
        new_life = session.life - result["life_lost"]
        new_difficulty = calc_new_difficulty(
            session.difficulty, result["life_lost"], wave_number
        )

        try:
            with transaction.atomic():
                WaveRecord.objects.create(
                    session=session,
                    wave_number=wave_number,
                    killed=result["killed"],
                    killed_by_type=result["killed_by_type"],
                    passed=result["passed"],
                    score_gained=result["score_gained"],
                    money_gained=result["money_gained"],
                    life_lost=result["life_lost"],
                    total_damage_dealt=result["total_damage_dealt"],
                    total_life_destroyed=result["total_life_destroyed"],
                    wave_duration_frames=result["wave_duration_frames"],
                    money_spent=spent,
                    money_income=income,
                    building_count=len(calculated_buildings),
                    end_money=new_money,
                    end_score=new_score,
                    end_life=new_life,
                    end_difficulty=new_difficulty,
                )

                session.money = new_money
                session.score = new_score
                session.life = new_life
                session.difficulty = new_difficulty
                session.wave_count = wave_number
                session.buildings = calculated_buildings
                session.save()

                ok, msg = validate_game_end(session)
                if not ok:
                    raise ValueError(msg)

                final_score = calc_final_score(
                    accumulated_score=new_score,
                    waves_completed=wave_number,
                    remaining_life=new_life,
                    remaining_money=new_money,
                    score_config=SCORE_CONFIG,
                )

                entry = LeaderboardEntry.objects.create(
                    nickname=data["nickname"],
                    score=final_score,
                    waves_completed=wave_number,
                )

                rank = LeaderboardEntry.objects.filter(score__gt=final_score).count() + 1
                total = LeaderboardEntry.objects.count()
                is_new_record = rank == 1

                session.delete()
        except ValueError as e:
            return self._validation_error(str(e))

        return Response({
            "verified": True,
            "ranking": {
                "rank": rank,
                "total": total,
                "isNewRecord": is_new_record,
            },
        })

    def _validation_error(self, message: str) -> Response:
        """返回验证错误响应."""
        return Response(
            {
                "verified": False,
                "error": {"code": "VALIDATION_FAILED", "message": message},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class LeaderboardView(APIView):
    """GET /api/game/leaderboard - 获取排行榜"""

    DEFAULT_LIMIT = 10
    MAX_LIMIT = 100

    def get(self, request: Request) -> Response:
        try:
            limit = int(request.query_params.get("limit", self.DEFAULT_LIMIT))
            if limit <= 0:
                limit = self.DEFAULT_LIMIT
        except (TypeError, ValueError):
            limit = self.DEFAULT_LIMIT

        limit = min(limit, self.MAX_LIMIT)

        entries = LeaderboardEntry.objects.order_by(
            "-score", "-waves_completed"
        )[:limit]

        return Response({
            "entries": [
                {
                    "rank": idx + 1,
                    "nickname": entry.nickname,
                    "score": entry.score,
                    "wavesCompleted": entry.waves_completed,
                    "createdAt": entry.created_at.isoformat(),
                }
                for idx, entry in enumerate(entries)
            ]
        })
