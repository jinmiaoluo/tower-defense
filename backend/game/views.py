"""Game API views."""

from typing import Any

from django.db import transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from game.calculators import (
    build_validation_buildings,
    calc_life_reward,
    calc_new_difficulty,
    process_actions,
)
from game.config import GAME_CONFIG, INITIAL
from game.generators import generate_wave
from game.models import GameSession, LeaderboardEntry, WaveRecord
from game.validators import (
    analyze_statistics,
    validate_attacks,
    validate_basic,
    validate_buildings_consistency,
    validate_damage,
    validate_game_end,
    validate_money_balance,
    validate_nickname,
    validate_remaining_monsters,
    validate_score,
    validate_wave_continuity,
)


def _require_fields(data: dict, *fields: str) -> tuple[bool, str]:
    missing = [f for f in fields if f not in data]
    if missing:
        return False, f"Missing required fields: {', '.join(missing)}"
    return True, ""


def _convert_keys_to_snake_case(result: dict[str, Any]) -> dict[str, Any]:
    mapping = {
        "killedByType": "killed_by_type",
        "scoreGained": "score_gained",
        "moneyGained": "money_gained",
        "lifeLost": "life_lost",
        "totalDamageDealt": "total_damage_dealt",
        "totalLifeDestroyed": "total_life_destroyed",
        "waveDurationFrames": "wave_duration_frames",
        "remainingMonsterIds": "remaining_monster_ids",
    }
    return {mapping.get(k, k): v for k, v in result.items()}


def _get_wave_config(next_wave: dict) -> dict:
    return {"monsters": next_wave["waveConfig"]}


def _get_monsters_config(next_wave: dict) -> dict[str, dict]:
    """Build {monster_id: monster_data} lookup dict."""
    return {m["id"]: m for m in next_wave["monsters"]}


def _get_monsters_list(next_wave: dict) -> list[str]:
    """Extract ordered monster ID list for spawn validation."""
    return [m["id"] for m in next_wave["monsters"]]


def _strip_wave_config(wave_data: dict) -> dict:
    return {k: v for k, v in wave_data.items() if k != "waveConfig"}


class CreateSessionView(APIView):
    """POST /api/game/sessions - Create game session."""

    def post(self, request: Request) -> Response:
        first_wave = generate_wave(1, INITIAL["difficulty"])

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
            "firstWave": _strip_wave_config(first_wave),
        })


class SubmitWaveView(APIView):
    """POST /api/game/sessions/wave - Submit wave result."""

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
                {"error": {"code": "SESSION_NOT_FOUND", "message": "Session not found"}},
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

        wave_config = _get_wave_config(session.next_wave)
        ok, msg = validate_basic(result, wave_config)
        if not ok:
            return self._validation_error(msg)

        ok, msg = validate_score(attacks, result)
        if not ok:
            return self._validation_error(msg)

        # Use validation_buildings instead of submitted_buildings
        # because attacks may occur before buildings are sold.
        validation_buildings = build_validation_buildings(actions, session.buildings)
        monsters_config = _get_monsters_config(session.next_wave)

        ok, msg = validate_damage(
            result, validation_buildings, wave_config, GAME_CONFIG["buildings"],
            monsters_config,
        )
        if not ok:
            return self._validation_error(msg)

        ok, msg = validate_attacks(
            attacks,
            validation_buildings,
            result,
            GAME_CONFIG["buildings"],
            GAME_CONFIG["map"],
            monsters_config,
        )
        if not ok:
            return self._validation_error(msg)

        monsters_list = _get_monsters_list(session.next_wave)
        ok, msg = validate_remaining_monsters(
            attacks, result, monsters_config, monsters_list
        )
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
                remaining=result.get("remaining", 0),
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

        # Run after transaction commit; only logs, does not affect validation.
        analyze_statistics(session, result, spent)

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
            response_data["nextWave"] = _strip_wave_config(next_wave_data)

        return Response(response_data)

    def _validation_error(self, message: str) -> Response:
        return Response(
            {
                "valid": False,
                "error": {"code": "VALIDATION_FAILED", "message": message},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class EndSessionView(APIView):
    """POST /api/game/sessions/end - End game session

    Two modes:
    1. With lastWave: submit final wave data and end
    2. Without lastWave: end early using already-submitted wave data
    """

    def post(self, request: Request) -> Response:
        data = request.data

        ok, msg = _require_fields(data, "sessionId", "nickname")
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
                {"error": {"code": "SESSION_NOT_FOUND", "message": "Session not found"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if "lastWave" in data:
            return self._end_with_last_wave(session, data)
        else:
            return self._end_without_last_wave(session, data)

    def _end_with_last_wave(
        self, session: GameSession, data: dict
    ) -> Response:
        """End with lastWave: validate and submit final wave data."""
        last_wave_data = data["lastWave"]
        wave_number = last_wave_data["waveNumber"]
        actions = last_wave_data["actions"]
        attacks = last_wave_data["attacks"]
        result = _convert_keys_to_snake_case(last_wave_data["result"])
        submitted_buildings = last_wave_data["buildings"]

        ok, msg = validate_wave_continuity(session, wave_number)
        if not ok:
            return self._validation_error(msg)

        wave_config = _get_wave_config(session.next_wave)
        ok, msg = validate_basic(result, wave_config)
        if not ok:
            return self._validation_error(msg)

        ok, msg = validate_score(attacks, result)
        if not ok:
            return self._validation_error(msg)

        # Use validation_buildings instead of submitted_buildings
        # because attacks may occur before buildings are sold.
        validation_buildings = build_validation_buildings(actions, session.buildings)
        monsters_config = _get_monsters_config(session.next_wave)

        ok, msg = validate_damage(
            result, validation_buildings, wave_config, GAME_CONFIG["buildings"],
            monsters_config,
        )
        if not ok:
            return self._validation_error(msg)
        ok, msg = validate_attacks(
            attacks,
            validation_buildings,
            result,
            GAME_CONFIG["buildings"],
            GAME_CONFIG["map"],
            monsters_config,
        )
        if not ok:
            return self._validation_error(msg)

        monsters_list = _get_monsters_list(session.next_wave)
        ok, msg = validate_remaining_monsters(
            attacks, result, monsters_config, monsters_list
        )
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
                    remaining=result.get("remaining", 0),
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

                analyze_statistics(session, result, spent)

                ok, msg = validate_game_end(session)
                if not ok:
                    raise ValueError(msg)

                if new_score <= 0:
                    raise ValueError(
                        "Zero score cannot be submitted to leaderboard,"
                        " at least one kill is required"
                    )

                LeaderboardEntry.objects.create(
                    nickname=data["nickname"],
                    score=new_score,
                    waves_completed=wave_number,
                )

                rank = LeaderboardEntry.objects.filter(score__gt=new_score).count() + 1
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

    def _end_without_last_wave(
        self, session: GameSession, data: dict
    ) -> Response:
        """End early without lastWave, using current session score.

        Requires at least one completed wave.
        """
        if session.wave_count < 1:
            return self._validation_error("Early end requires at least one completed wave")

        try:
            with transaction.atomic():
                ok, msg = validate_game_end(session)
                if not ok:
                    raise ValueError(msg)

                if session.score <= 0:
                    raise ValueError("0 分不能提交到排行榜，至少需要击杀一只怪物")

                LeaderboardEntry.objects.create(
                    nickname=data["nickname"],
                    score=session.score,
                    waves_completed=session.wave_count,
                )

                rank = LeaderboardEntry.objects.filter(score__gt=session.score).count() + 1
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
        return Response(
            {
                "verified": False,
                "error": {"code": "VALIDATION_FAILED", "message": message},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class LeaderboardView(APIView):
    """GET /api/game/leaderboard - Get leaderboard."""

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
