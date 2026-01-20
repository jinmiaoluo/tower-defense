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
        "remainingMonsterIds": "remaining_monster_ids",
    }
    return {mapping.get(k, k): v for k, v in result.items()}


def _get_wave_config(next_wave: dict) -> dict:
    """获取用于验证的波次配置."""
    return {"monsters": next_wave["waveConfig"]}


def _get_monsters_config(next_wave: dict) -> dict[str, dict]:
    """构建怪物配置字典，用于 Level 2 验证.

    Args:
        next_wave: 波次数据，包含 monsters 列表

    Returns:
        {monster_id: {type, life, ...}} 格式的字典
    """
    return {m["id"]: m for m in next_wave["monsters"]}


def _get_monsters_list(next_wave: dict) -> list[str]:
    """获取有序的怪物 ID 列表，用于 spawned 验证.

    Args:
        next_wave: 波次数据，包含 monsters 列表

    Returns:
        有序的怪物 ID 列表
    """
    return [m["id"] for m in next_wave["monsters"]]


def _strip_wave_config(wave_data: dict) -> dict:
    """移除波次数据中的 waveConfig，用于 API 响应."""
    return {k: v for k, v in wave_data.items() if k != "waveConfig"}


class CreateSessionView(APIView):
    """POST /api/game/sessions - 创建游戏会话"""

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

        wave_config = _get_wave_config(session.next_wave)
        ok, msg = validate_basic(result, wave_config)
        if not ok:
            return self._validation_error(msg)

        ok, msg = validate_score(attacks, result)
        if not ok:
            return self._validation_error(msg)

        # 构建用于验证的建筑列表
        # 使用 validation_buildings 而非 submitted_buildings，
        # 因为攻击可能发生在建筑被出售之前
        validation_buildings = build_validation_buildings(actions, session.buildings)

        # Level 2 伤害验证
        ok, msg = validate_damage(
            result, validation_buildings, wave_config, GAME_CONFIG["buildings"]
        )
        if not ok:
            return self._validation_error(msg)

        # Level 2 攻击事件验证
        monsters_config = _get_monsters_config(session.next_wave)
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

        # remaining 怪物验证（防作弊）
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

        # Level 4 统计分析（在事务提交后执行，只记录日志不影响验证结果）
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
        """返回验证错误响应."""
        return Response(
            {
                "valid": False,
                "error": {"code": "VALIDATION_FAILED", "message": message},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class EndSessionView(APIView):
    """POST /api/game/sessions/end - 结束游戏会话

    支持两种模式：
    1. 带 lastWave: 提交最后一波数据并结束
    2. 不带 lastWave: 直接结束游戏（提前结束），使用已提交的波次数据
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
                {"error": {"code": "SESSION_NOT_FOUND", "message": "会话不存在"}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if "lastWave" in data:
            return self._end_with_last_wave(session, data)
        else:
            return self._end_without_last_wave(session, data)

    def _end_with_last_wave(
        self, session: GameSession, data: dict
    ) -> Response:
        """处理带 lastWave 的结束请求（原有逻辑）."""
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

        # 构建用于验证的建筑列表
        # 使用 validation_buildings 而非 submitted_buildings，
        # 因为攻击可能发生在建筑被出售之前
        validation_buildings = build_validation_buildings(actions, session.buildings)

        ok, msg = validate_damage(
            result, validation_buildings, wave_config, GAME_CONFIG["buildings"]
        )
        if not ok:
            return self._validation_error(msg)

        monsters_config = _get_monsters_config(session.next_wave)
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
                    raise ValueError("0 分不能提交到排行榜，至少需要击杀一只怪物")

                entry = LeaderboardEntry.objects.create(
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
        """处理不带 lastWave 的提前结束请求.

        使用当前会话状态的积分作为最终得分，适用于：
        - 用户在波次完成后主动选择结束游戏
        - 必须至少完成一波才能使用此模式
        """
        if session.wave_count < 1:
            return self._validation_error("提前结束需要至少完成一波")

        try:
            with transaction.atomic():
                ok, msg = validate_game_end(session)
                if not ok:
                    raise ValueError(msg)

                if session.score <= 0:
                    raise ValueError("0 分不能提交到排行榜，至少需要击杀一只怪物")

                entry = LeaderboardEntry.objects.create(
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
