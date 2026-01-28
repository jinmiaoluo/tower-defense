"""Unified JSON error response builder with business error codes."""

from enum import Enum

from rest_framework.response import Response


class ErrorCode(str, Enum):
    """Business error codes for API responses.

    These codes indicate the specific type of error that occurred,
    separate from HTTP status codes which indicate transport-level status.
    """

    # Request format errors
    MISSING_FIELDS = "MISSING_FIELDS"

    # Session errors
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"

    # Wave continuity errors
    WAVE_NOT_CONTINUOUS = "WAVE_NOT_CONTINUOUS"

    # Level 1 basic validation errors
    BASIC_VALIDATION_FAILED = "BASIC_VALIDATION_FAILED"

    # Score validation errors
    SCORE_VALIDATION_FAILED = "SCORE_VALIDATION_FAILED"

    # Level 2 damage validation errors
    DAMAGE_VALIDATION_FAILED = "DAMAGE_VALIDATION_FAILED"

    # Level 2 attack event validation errors
    ATTACK_VALIDATION_FAILED = "ATTACK_VALIDATION_FAILED"

    # Remaining monsters validation errors
    REMAINING_VALIDATION_FAILED = "REMAINING_VALIDATION_FAILED"

    # Money balance validation errors
    MONEY_VALIDATION_FAILED = "MONEY_VALIDATION_FAILED"

    # Buildings consistency validation errors
    BUILDINGS_VALIDATION_FAILED = "BUILDINGS_VALIDATION_FAILED"

    # Nickname validation errors
    INVALID_NICKNAME = "INVALID_NICKNAME"

    # Game end validation errors
    GAME_END_VALIDATION_FAILED = "GAME_END_VALIDATION_FAILED"

    # Early end requirements not met
    EARLY_END_REQUIRES_WAVE = "EARLY_END_REQUIRES_WAVE"

    # Zero score cannot be submitted
    ZERO_SCORE = "ZERO_SCORE"


def error_response(code: ErrorCode, message: str, status_code: int) -> Response:
    """Build a JSON error response with code and message.

    Args:
        code: Business error code from ErrorCode enum
        message: Human-readable error description
        status_code: HTTP status code

    Returns:
        Response with format: {"code": "ERROR_CODE", "message": "..."}
    """
    return Response({"code": code.value, "message": message}, status=status_code)
