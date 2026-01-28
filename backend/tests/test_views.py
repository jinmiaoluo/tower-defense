"""API view unit tests."""

import math
import uuid

import pytest
from rest_framework.test import APIClient

from game.config import GAME_CONFIG, INITIAL
from game.generators import generate_wave
from game.models import GameSession, LeaderboardEntry, WaveRecord
from game.responses import ErrorCode


class TestCreateSession:
    """POST /api/game/sessions tests."""

    @pytest.mark.django_db
    def test_create_session_success(self, api_client):
        """Successfully create a session."""
        response = api_client.post("/api/game/sessions")
        assert response.status_code == 200

        data = response.json()
        assert "sessionId" in data
        assert "config" in data
        assert "firstWave" in data

    @pytest.mark.django_db
    def test_create_session_returns_valid_uuid(self, api_client):
        """Return a valid UUID."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        import uuid
        uuid.UUID(data["sessionId"])

    @pytest.mark.django_db
    def test_create_session_config_structure(self, api_client):
        """Config contains required fields."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        config = data["config"]
        assert "buildings" in config
        assert "monsters" in config
        assert "map" in config
        assert "initial" in config

    @pytest.mark.django_db
    def test_create_session_initial_values(self, api_client):
        """Initial values are correct."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        initial = data["config"]["initial"]
        assert initial["money"] == 500
        assert initial["life"] == 100
        assert initial["difficulty"] == 1.0

    @pytest.mark.django_db
    def test_create_session_first_wave_structure(self, api_client):
        """First wave config structure is correct."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        first_wave = data["firstWave"]
        assert first_wave["waveNumber"] == 1
        assert "monsters" in first_wave
        assert len(first_wave["monsters"]) == 1  # first wave has only 1 monster

    @pytest.mark.django_db
    def test_create_session_monster_attributes(self, api_client):
        """Monster contains required attributes."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        monster = data["firstWave"]["monsters"][0]
        required_fields = {"id", "type", "life", "speed", "shield", "money"}
        assert required_fields.issubset(monster.keys())

    @pytest.mark.django_db
    def test_create_session_persists_to_database(self, api_client):
        """Session persists to database."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        session_id = data["sessionId"]
        assert GameSession.objects.filter(id=session_id).exists()

    @pytest.mark.django_db
    def test_create_session_database_state(self, api_client):
        """Session state in database is correct."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        session = GameSession.objects.get(id=data["sessionId"])
        assert session.money == 500
        assert session.life == 100
        assert session.score == 0
        assert session.wave_count == 0
        assert session.difficulty == 1.0
        assert session.buildings == []

    @pytest.mark.django_db
    def test_create_session_stores_next_wave(self, api_client):
        """Next wave config stored in database."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        session = GameSession.objects.get(id=data["sessionId"])
        assert session.next_wave["waveNumber"] == 1
        assert len(session.next_wave["monsters"]) == 1

    @pytest.mark.django_db
    def test_create_session_buildings_config(self, api_client):
        """Building config is correct."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        buildings = data["config"]["buildings"]
        assert "cannon" in buildings
        assert "LMG" in buildings
        assert "HMG" in buildings
        assert "laser_gun" in buildings
        assert "wall" in buildings

        cannon = buildings["cannon"]
        assert cannon["cost"] == 300
        assert cannon["damage"] == 12

    @pytest.mark.django_db
    def test_create_session_monsters_config(self, api_client):
        """Monster config is correct (display-only attributes)."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        monsters = data["config"]["monsters"]
        assert "0" in monsters or 0 in monsters

        monster_0 = monsters.get("0") or monsters.get(0)
        assert "name" in monster_0
        assert "color" in monster_0
        assert "damage" in monster_0
        assert "life" not in monster_0
        assert "speed" not in monster_0

    @pytest.mark.django_db
    def test_create_session_map_config(self, api_client):
        """Map config is correct."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        map_config = data["config"]["map"]
        assert map_config["width"] == 16
        assert map_config["height"] == 16
        assert map_config["entrance"] == [0, 0]
        assert map_config["exit"] == [15, 15]


class TestSubmitWaveView:
    """POST /api/game/sessions/wave tests."""

    @pytest.fixture
    def session_with_first_wave(self, db) -> GameSession:
        """Create a session with first wave config."""
        first_wave = generate_wave(1, INITIAL["difficulty"])
        return GameSession.objects.create(
            money=INITIAL["money"],
            life=INITIAL["life"],
            difficulty=INITIAL["difficulty"],
            wave_count=0,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=first_wave,
        )

    def _make_wave_monsters_map(self, wave_config: dict) -> dict:
        """Build a mapping from monster ID to monster data."""
        return {m["id"]: m for m in wave_config["monsters"]}

    def _make_valid_building(
        self,
        building_id: str = "b-001",
        building_type: str = "LMG",
    ) -> dict:
        """Create valid building data.

        Defaults to LMG (cost 100, damage 5, range 5-10).
        Position [0, 0] is at the entrance, range covers the monster path.
        """
        return {
            "id": building_id,
            "type": building_type,
            "position": [0, 0],
            "level": 1,
            "damageDealt": 0,
            "kills": 0,
        }

    def _make_valid_wave_result(
        self,
        wave_config: dict,
        building_type: str = "LMG",
    ) -> dict:
        """Generate a valid wave result from wave config.

        Internally generates attack events and calculates matching score.
        """
        attacks = self._make_valid_attacks(wave_config, building_type=building_type)
        return self._make_valid_wave_result_with_attacks(wave_config, attacks)

    def _make_valid_attacks(
        self,
        wave_config: dict,
        building_id: str = "b-001",
        building_type: str = "LMG",
    ) -> list[dict]:
        """Generate valid attack events from wave config.

        Position [4, 3] is within range (distance from [0,0] = 5, equals LMG level 1 range).
        Each attack deals the building's fixed damage, multiple attacks accumulate to kill monsters.
        """
        attacks = []
        frame = 100
        building_damage = GAME_CONFIG["buildings"][building_type]["damage"]

        for m in wave_config["monsters"]:
            monster_life = m["life"]
            hits_needed = (monster_life + building_damage - 1) // building_damage

            for _ in range(hits_needed):
                attacks.append({
                    "frame": frame,
                    "buildingId": building_id,
                    "originalTargetId": m["id"],
                    "originalTargetPosition": [4, 3],
                    "monsterId": m["id"],
                    "monsterPosition": [4, 3],
                    "damage": building_damage,
                })
                frame += 3

        return attacks

    def _make_valid_wave_result_with_attacks(
        self, wave_config: dict, attacks: list[dict]
    ) -> dict:
        """Generate matching wave result from attack events."""
        monsters = wave_config["monsters"]

        killed_by_type: dict[int, int] = {}
        total_life = 0
        total_money = 0
        total_damage = sum(a["damage"] for a in attacks)

        for m in monsters:
            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1
            total_life += m["life"]
            total_money += m["money"]

        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        return {
            "killed": len(monsters),
            "killedByType": killed_by_type,
            "passed": 0,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": 0,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life,
            "waveDurationFrames": 1000,
        }

    @pytest.mark.django_db
    def test_submit_wave_success(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test successful wave submission."""
        session = session_with_first_wave
        wave_config = session.next_wave

        building = self._make_valid_building()
        attacks = self._make_valid_attacks(wave_config)
        result = self._make_valid_wave_result_with_attacks(wave_config, attacks)
        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = result["killed"]

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        building_cost = GAME_CONFIG["buildings"][building["type"]]["cost"]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert "serverState" in data
        assert "nextWave" in data

        server_state = data["serverState"]
        expected_money = INITIAL["money"] - building_cost + result["moneyGained"]
        assert server_state["money"] == expected_money
        assert server_state["score"] == result["scoreGained"]
        assert server_state["life"] == INITIAL["life"]

        next_wave = data["nextWave"]
        assert next_wave["waveNumber"] == 2
        assert len(next_wave["monsters"]) > 0

    @pytest.mark.django_db
    def test_submit_wave_session_not_found(self, api_client: APIClient, db):
        """Test session not found."""
        request_data = {
            "sessionId": str(uuid.uuid4()),
            "waveNumber": 1,
            "actions": [],
            "attacks": [],
            "result": {
                "killed": 0,
                "killedByType": {},
                "passed": 1,
                "scoreGained": 0,
                "moneyGained": 0,
                "lifeLost": 1,
                "totalDamageDealt": 0,
                "totalLifeDestroyed": 0,
                "waveDurationFrames": 100,
            },
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 404
        data = response.json()
        assert data["code"] == ErrorCode.SESSION_NOT_FOUND.value
        assert data["message"] == "Session not found"

    @pytest.mark.django_db
    def test_submit_wave_invalid_wave_number(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test non-consecutive wave number."""
        session = session_with_first_wave

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 5,
            "actions": [],
            "attacks": [],
            "result": {
                "killed": 0,
                "killedByType": {},
                "passed": 1,
                "scoreGained": 0,
                "moneyGained": 0,
                "lifeLost": 1,
                "totalDamageDealt": 0,
                "totalLifeDestroyed": 0,
                "waveDurationFrames": 100,
            },
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.WAVE_NOT_CONTINUOUS.value
        assert "Wave not continuous" in data["message"]

    @pytest.mark.django_db
    def test_submit_wave_killed_count_mismatch(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test killed count mismatch."""
        session = session_with_first_wave
        wave_config = session.next_wave

        attacks = self._make_valid_attacks(wave_config)
        result = self._make_valid_wave_result_with_attacks(wave_config, attacks)
        result["killed"] = 999

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": [],
            "attacks": attacks,
            "result": result,
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_submit_wave_money_mismatch(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test money gained mismatch."""
        session = session_with_first_wave
        wave_config = session.next_wave

        attacks = self._make_valid_attacks(wave_config)
        result = self._make_valid_wave_result_with_attacks(wave_config, attacks)
        result["moneyGained"] = 9999

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": [],
            "attacks": attacks,
            "result": result,
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_submit_wave_creates_wave_record(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test WaveRecord creation after successful submission."""
        session = session_with_first_wave
        wave_config = session.next_wave

        building = self._make_valid_building()
        attacks = self._make_valid_attacks(wave_config)
        result = self._make_valid_wave_result_with_attacks(wave_config, attacks)
        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = result["killed"]

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200

        wave_record = WaveRecord.objects.filter(
            session=session, wave_number=1
        ).first()
        assert wave_record is not None
        assert wave_record.killed == request_data["result"]["killed"]
        assert wave_record.score_gained == request_data["result"]["scoreGained"]

    @pytest.mark.django_db
    def test_submit_wave_updates_session(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test GameSession update after successful submission."""
        session = session_with_first_wave
        wave_config = session.next_wave

        building = self._make_valid_building()
        attacks = self._make_valid_attacks(wave_config)
        result = self._make_valid_wave_result_with_attacks(wave_config, attacks)
        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = result["killed"]

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        building_cost = GAME_CONFIG["buildings"][building["type"]]["cost"]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200

        session.refresh_from_db()
        assert session.wave_count == 1
        assert session.money == INITIAL["money"] - building_cost + result["moneyGained"]
        assert session.score == result["scoreGained"]
        assert session.life == INITIAL["life"] - result["lifeLost"]

    @pytest.mark.django_db
    def test_submit_wave_with_build_action(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test wave submission with build action."""
        session = session_with_first_wave
        wave_config = session.next_wave

        building = self._make_valid_building()
        attacks = self._make_valid_attacks(wave_config)
        result = self._make_valid_wave_result_with_attacks(wave_config, attacks)
        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = result["killed"]

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()

        lmg_cost = GAME_CONFIG["buildings"]["LMG"]["cost"]
        expected_money = INITIAL["money"] - lmg_cost + result["moneyGained"]
        assert data["serverState"]["money"] == expected_money

    @pytest.mark.django_db
    def test_submit_wave_insufficient_money(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test insufficient money."""
        session = session_with_first_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]

        killed_by_type: dict[int, int] = {}
        for m in monsters:
            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1

        result = {
            "killed": 0,
            "killedByType": {},
            "passed": len(monsters),
            "scoreGained": 0,
            "moneyGained": 0,
            "lifeLost": len(monsters),
            "totalDamageDealt": 0,
            "totalLifeDestroyed": 0,
            "waveDurationFrames": 1000,
        }

        actions = [
            {
                "type": "BUILD",
                "frame": 50,
                "buildingType": "laser_gun",
                "buildingId": "b-001",
                "position": [0, 0],
            }
        ]
        buildings = [
            {
                "id": "b-001",
                "type": "laser_gun",
                "position": [0, 0],
                "level": 1,
                "damageDealt": 0,
                "kills": 0,
            }
        ]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": [],
            "result": result,
            "buildings": buildings,
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_submit_wave_score_mismatch(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test score mismatch."""
        session = session_with_first_wave
        wave_config = session.next_wave

        result = self._make_valid_wave_result(wave_config)
        result["scoreGained"] = 9999

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": [],
            "attacks": self._make_valid_attacks(wave_config),
            "result": result,
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_submit_wave_life_reward(self, api_client: APIClient, db):
        """Test life reward at wave 5."""
        wave_5 = generate_wave(5, 1.0)
        session = GameSession.objects.create(
            money=600,
            life=90,
            difficulty=1.0,
            wave_count=4,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_5,
        )

        building = self._make_valid_building()
        attacks = self._make_valid_attacks(wave_5)
        result = self._make_valid_wave_result_with_attacks(wave_5, attacks)
        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = result["killed"]

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 5,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()

        assert data["nextWave"]["lifeReward"] == 5

    @pytest.mark.django_db
    def test_submit_wave_missing_fields(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test missing required fields."""
        request_data = {
            "sessionId": str(session_with_first_wave.id),
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.MISSING_FIELDS.value
        assert "Missing required fields" in data["message"]

    @pytest.mark.django_db
    def test_submit_wave_game_over(self, api_client: APIClient, db):
        """Test no next wave returned when life reaches zero."""
        wave_1 = generate_wave(1, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=1,
            difficulty=1.0,
            wave_count=0,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_1,
        )

        result = {
            "killed": 0,
            "killedByType": {},
            "passed": 1,
            "scoreGained": 0,
            "moneyGained": 0,
            "lifeLost": 1,
            "totalDamageDealt": 0,
            "totalLifeDestroyed": 0,
            "waveDurationFrames": 1000,
        }

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": [],
            "attacks": [],
            "result": result,
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["serverState"]["life"] == 0
        assert data.get("nextWave") is None

    @pytest.mark.django_db
    def test_submit_wave_buildings_consistency(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test building list consistency validation."""
        session = session_with_first_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]

        result = {
            "killed": 0,
            "killedByType": {},
            "passed": len(monsters),
            "scoreGained": 0,
            "moneyGained": 0,
            "lifeLost": len(monsters),
            "totalDamageDealt": 0,
            "totalLifeDestroyed": 0,
            "waveDurationFrames": 1000,
        }

        actions = [
            {
                "type": "BUILD",
                "frame": 50,
                "buildingType": "LMG",
                "buildingId": "b-001",
                "position": [0, 0],
            }
        ]
        buildings = []

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": [],
            "result": result,
            "buildings": buildings,
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    # ========== DPS validation using validation_buildings tests ==========

    @pytest.mark.django_db
    def test_submit_wave_dps_validation_with_sold_buildings(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test DPS validation still works when building is sold after construction.

        Scenario (reproducing the issue):
        1. Build an LMG building
        2. LMG attacks monsters, dealing damage
        3. Sell the LMG
        4. Submit wave result with empty buildings list

        Before fix: DPS validation used submitted_buildings (empty list), causing max_dps=0,
                    any damage would trigger "DPS capacity exceeded" error.

        After fix: DPS validation uses validation_buildings (includes buildings that existed
                   during the wave), correctly calculates max_dps, validation should pass.
        """
        session = session_with_first_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]

        building_id = "b-001"
        building_type = "LMG"
        building_damage = GAME_CONFIG["buildings"][building_type]["damage"]

        attacks = []
        frame = 100
        killed_by_type: dict[int, int] = {}
        total_life_destroyed = 0
        total_money = 0

        for m in monsters:
            hits_needed = (m["life"] + building_damage - 1) // building_damage
            for _ in range(hits_needed):
                attacks.append({
                    "frame": frame,
                    "buildingId": building_id,
                    "originalTargetId": m["id"],
                    "originalTargetPosition": [4, 3],
                    "monsterId": m["id"],
                    "monsterPosition": [4, 3],
                    "damage": building_damage,
                })
                frame += 3

            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1
            total_life_destroyed += m["life"]
            total_money += m["money"]

        total_damage = sum(a["damage"] for a in attacks)
        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        result = {
            "killed": len(monsters),
            "killedByType": killed_by_type,
            "passed": 0,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": 0,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life_destroyed,
            "waveDurationFrames": 1000,
        }

        actions = [
            {
                "type": "BUILD",
                "frame": 10,
                "buildingType": building_type,
                "buildingId": building_id,
                "position": [0, 0],
            },
            {
                "type": "SELL",
                "frame": frame + 10,
                "buildingId": building_id,
            },
        ]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

    @pytest.mark.django_db
    def test_submit_wave_dps_validation_with_upgraded_then_sold_building(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test DPS validation uses upgraded level when building is upgraded then sold.

        Scenario:
        1. Build LMG (level 1, damage=5)
        2. Upgrade to level 2 (damage=6)
        3. Attack monsters with level 2 damage
        4. Sell the building
        5. buildings list is empty

        Validation:
        - DPS should use level 2 damage value (6 / 3 = 2)
        - Not level 1 damage value (5 / 3 = 1.67)
        """
        session = session_with_first_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]

        building_id = "b-001"
        building_type = "LMG"
        # LMG level 2 damage: int(5 * 1.2) = 6
        building_damage_level_2 = 6

        attacks = []
        frame = 100
        killed_by_type: dict[int, int] = {}
        total_life_destroyed = 0
        total_money = 0

        for m in monsters:
            hits_needed = (m["life"] + building_damage_level_2 - 1) // building_damage_level_2
            for _ in range(hits_needed):
                attacks.append({
                    "frame": frame,
                    "buildingId": building_id,
                    "originalTargetId": m["id"],
                    "originalTargetPosition": [4, 3],
                    "monsterId": m["id"],
                    "monsterPosition": [4, 3],
                    "damage": building_damage_level_2,
                })
                frame += 3

            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1
            total_life_destroyed += m["life"]
            total_money += m["money"]

        total_damage = sum(a["damage"] for a in attacks)
        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        result = {
            "killed": len(monsters),
            "killedByType": killed_by_type,
            "passed": 0,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": 0,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life_destroyed,
            "waveDurationFrames": 1000,
        }

        actions = [
            {
                "type": "BUILD",
                "frame": 10,
                "buildingType": building_type,
                "buildingId": building_id,
                "position": [0, 0],
            },
            {
                "type": "UPGRADE",
                "frame": 50,
                "buildingId": building_id,
                "level": 2,
            },
            {
                "type": "SELL",
                "frame": frame + 10,
                "buildingId": building_id,
            },
        ]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

    @pytest.mark.django_db
    def test_submit_wave_dps_validation_with_existing_building_sold(
        self, api_client: APIClient, db
    ):
        """Test existing building upgraded then sold scenario (user reproduction).

        Scenario (simulating wave 2):
        1. At wave start, session.buildings already has b-1 (LMG, level 1)
        2. Upgrade b-1 to level 2
        3. Sell b-1
        4. Build b-2 (LMG)
        5. b-2 attacks monsters
        6. Sell b-2
        7. buildings list is empty

        Validation:
        - DPS should include both b-1 (level 2) and b-2 (level 1) buildings
        """
        wave_2 = generate_wave(2, INITIAL["difficulty"])
        session = GameSession.objects.create(
            money=450,  # 500 - 100(LMG) + 5(monster reward) = 405, plus extra margin
            life=INITIAL["life"],
            difficulty=INITIAL["difficulty"],
            wave_count=1,
            buildings=[
                {"id": "b-1", "type": "LMG", "level": 1, "position": [2, 2]},
            ],
            config=GAME_CONFIG,
            next_wave=wave_2,
        )

        monsters = wave_2["monsters"]
        building_damage = GAME_CONFIG["buildings"]["LMG"]["damage"]

        attacks = []
        frame = 1000
        killed_by_type: dict[int, int] = {}
        total_life_destroyed = 0
        total_money = 0

        for m in monsters:
            hits_needed = (m["life"] + building_damage - 1) // building_damage
            for _ in range(hits_needed):
                attacks.append({
                    "frame": frame,
                    "buildingId": "b-2",
                    "originalTargetId": m["id"],
                    "originalTargetPosition": [4, 3],
                    "monsterId": m["id"],
                    "monsterPosition": [4, 3],
                    "damage": building_damage,
                })
                frame += 3

            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1
            total_life_destroyed += m["life"]
            total_money += m["money"]

        total_damage = sum(a["damage"] for a in attacks)
        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        result = {
            "killed": len(monsters),
            "killedByType": killed_by_type,
            "passed": 0,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": 0,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life_destroyed,
            "waveDurationFrames": 1000,
        }

        actions = [
            {"type": "UPGRADE", "frame": 100, "buildingId": "b-1", "level": 2},
            {"type": "SELL", "frame": 200, "buildingId": "b-1"},
            {
                "type": "BUILD",
                "frame": 500,
                "buildingType": "LMG",
                "buildingId": "b-2",
                "position": [3, 3],
            },
            {"type": "SELL", "frame": frame + 10, "buildingId": "b-2"},
        ]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 2,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

    @pytest.mark.django_db
    def test_submit_wave_dps_validation_with_multiple_buildings_partial_sold(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test multiple buildings partially sold scenario.

        Scenario:
        1. Build b-1 (LMG)
        2. Build b-2 (cannon)
        3. Both buildings attack monsters
        4. Only sell b-1
        5. buildings list only has b-2

        Validation:
        - DPS should include both b-1 (LMG) and b-2 (cannon) buildings
        - Cannot only calculate b-2's DPS
        """
        session = session_with_first_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]

        lmg_damage = GAME_CONFIG["buildings"]["LMG"]["damage"]
        cannon_damage = GAME_CONFIG["buildings"]["cannon"]["damage"]

        attacks = []
        frame = 100
        killed_by_type: dict[int, int] = {}
        total_life_destroyed = 0
        total_money = 0

        for m in monsters:
            # LMG attacks first
            lmg_hits = 2
            for _ in range(lmg_hits):
                attacks.append({
                    "frame": frame,
                    "buildingId": "b-1",
                    "originalTargetId": m["id"],
                    "originalTargetPosition": [4, 3],
                    "monsterId": m["id"],
                    "monsterPosition": [4, 3],
                    "damage": lmg_damage,
                })
                frame += 3

            # cannon continues attacking until kill
            remaining_life = m["life"] - lmg_hits * lmg_damage
            cannon_hits = (remaining_life + cannon_damage - 1) // cannon_damage
            for _ in range(max(cannon_hits, 1)):
                attacks.append({
                    "frame": frame,
                    "buildingId": "b-2",
                    "originalTargetId": m["id"],
                    "originalTargetPosition": [4, 3],
                    "monsterId": m["id"],
                    "monsterPosition": [4, 3],
                    "damage": cannon_damage,
                })
                frame += 2

            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1
            total_life_destroyed += m["life"]
            total_money += m["money"]

        total_damage = sum(a["damage"] for a in attacks)
        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        result = {
            "killed": len(monsters),
            "killedByType": killed_by_type,
            "passed": 0,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": 0,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life_destroyed,
            "waveDurationFrames": 1000,
        }

        actions = [
            {
                "type": "BUILD",
                "frame": 10,
                "buildingType": "LMG",
                "buildingId": "b-1",
                "position": [0, 0],
            },
            {
                "type": "BUILD",
                "frame": 20,
                "buildingType": "cannon",
                "buildingId": "b-2",
                "position": [1, 1],
            },
            {"type": "SELL", "frame": frame + 10, "buildingId": "b-1"},
        ]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [
                {"id": "b-2", "type": "cannon", "position": [1, 1], "level": 1,
                 "damageDealt": 0, "kills": 0},
            ],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

    @pytest.mark.django_db
    def test_submit_wave_dps_validation_with_sold_building_no_attacks(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """Test building sold without any attacks (zero damage boundary).

        Scenario:
        1. Build LMG
        2. No attacks on any monsters (all monsters pass through)
        3. Sell the building
        4. total_damage_dealt = 0

        Validation:
        - 0 <= max_dps * duration * 1.1
        - Should pass validation
        """
        session = session_with_first_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]

        result = {
            "killed": 0,
            "killedByType": {},
            "passed": len(monsters),
            "scoreGained": 0,
            "moneyGained": 0,
            "lifeLost": len(monsters),
            "totalDamageDealt": 0,
            "totalLifeDestroyed": 0,
            "waveDurationFrames": 1000,
        }

        actions = [
            {
                "type": "BUILD",
                "frame": 10,
                "buildingType": "LMG",
                "buildingId": "b-001",
                "position": [0, 0],
            },
            {"type": "SELL", "frame": 500, "buildingId": "b-001"},
        ]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": [],
            "result": result,
            "buildings": [],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

    # ========== remaining field validation tests ==========

    @pytest.fixture
    def session_with_multi_monster_wave(self, db) -> GameSession:
        """Create a session with multi-monster wave config (for testing remaining scenarios).

        Uses wave 5 config with multiple monsters for testing partial kill scenarios.
        """
        wave_5 = generate_wave(5, 1.0)
        return GameSession.objects.create(
            money=600,
            life=90,
            difficulty=1.0,
            wave_count=4,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_5,
        )

    def _make_partial_kill_wave_data(
        self,
        wave_config: dict,
        killed_count: int,
        remaining_count: int,
        building_id: str = "b-001",
        building_type: str = "LMG",
    ) -> tuple[list[dict], dict, list[str]]:
        """Generate attack events and result for partial kill scenarios.

        Args:
            wave_config: Wave configuration
            killed_count: Number of monsters killed
            remaining_count: Number of monsters remaining on the field
            building_id: Building ID
            building_type: Building type

        Returns:
            (attacks, result, remaining_monster_ids)
        """
        monsters = wave_config["monsters"]
        total_monsters = len(monsters)
        passed_count = total_monsters - killed_count - remaining_count

        building_damage = GAME_CONFIG["buildings"][building_type]["damage"]

        attacks = []
        frame = 100
        killed_by_type: dict[int, int] = {}
        total_life_destroyed = 0
        total_money = 0
        remaining_monster_ids = []

        for idx, m in enumerate(monsters):
            if idx < killed_count:
                hits_needed = (m["life"] + building_damage - 1) // building_damage
                for _ in range(hits_needed):
                    attacks.append({
                        "frame": frame,
                        "buildingId": building_id,
                        "originalTargetId": m["id"],
                        "originalTargetPosition": [4, 3],
                        "monsterId": m["id"],
                        "monsterPosition": [4, 3],
                        "damage": building_damage,
                    })
                    frame += 3

                t = m["type"]
                killed_by_type[t] = killed_by_type.get(t, 0) + 1
                total_life_destroyed += m["life"]
                total_money += m["money"]
            elif idx < killed_count + remaining_count:
                remaining_monster_ids.append(m["id"])

        total_damage = sum(a["damage"] for a in attacks)
        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        result = {
            "killed": killed_count,
            "killedByType": killed_by_type,
            "passed": passed_count,
            "remaining": remaining_count,
            "remainingMonsterIds": remaining_monster_ids,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": passed_count,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life_destroyed,
            "waveDurationFrames": 1000,
        }

        return attacks, result, remaining_monster_ids

    @pytest.mark.django_db
    def test_submit_wave_with_remaining_success(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """Test successful wave submission with remaining monsters."""
        session = session_with_multi_monster_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]
        total_monsters = len(monsters)

        killed_count = min(2, total_monsters - 1)
        remaining_count = total_monsters - killed_count

        building = self._make_valid_building()
        attacks, result, _ = self._make_partial_kill_wave_data(
            wave_config, killed_count, remaining_count
        )
        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = killed_count

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 5,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

        wave_record = WaveRecord.objects.filter(session=session, wave_number=5).first()
        assert wave_record is not None
        assert wave_record.remaining == remaining_count

    @pytest.mark.django_db
    def test_submit_wave_remaining_monster_ids_invalid(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """Test failure when remainingMonsterIds contains invalid UUID."""
        session = session_with_multi_monster_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]
        total_monsters = len(monsters)

        killed_count = min(2, total_monsters - 1)
        remaining_count = total_monsters - killed_count

        building = self._make_valid_building()
        attacks, result, remaining_ids = self._make_partial_kill_wave_data(
            wave_config, killed_count, remaining_count
        )

        result["remainingMonsterIds"] = ["invalid-uuid-not-from-server"] + remaining_ids[1:]

        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = killed_count

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 5,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        response = api_client.post(
            "/api/game/sessions/wave",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""


class TestEndSessionView:
    """POST /api/game/sessions/end tests."""

    @pytest.fixture
    def session_with_waves(self, db) -> GameSession:
        """Create a session with wave records (simulating player completed 5 waves)."""
        wave_6 = generate_wave(6, 1.2)
        session = GameSession.objects.create(
            money=800,
            life=90,
            score=150,
            difficulty=1.2,
            wave_count=5,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_6,
        )

        for i in range(1, 6):
            WaveRecord.objects.create(
                session=session,
                wave_number=i,
                killed=3,
                killed_by_type={0: 3},
                passed=0,
                score_gained=30,
                money_gained=15,
                life_lost=2,
                total_damage_dealt=100,
                total_life_destroyed=100,
                wave_duration_frames=1000,
                money_spent=0,
                money_income=0,
                building_count=0,
                end_money=500 + i * 15,
                end_score=i * 30,
                end_life=100 - i * 2,
                end_difficulty=1.0 + i * 0.04,
            )

        return session

    def _make_wave_monsters_map(self, wave_config: dict) -> dict:
        """Build a mapping from monster ID to monster data."""
        return {m["id"]: m for m in wave_config["monsters"]}

    def _make_valid_building(
        self,
        building_id: str = "b-001",
        building_type: str = "LMG",
    ) -> dict:
        """Create valid building data."""
        return {
            "id": building_id,
            "type": building_type,
            "position": [0, 0],
            "level": 1,
            "damageDealt": 0,
            "kills": 0,
        }

    def _make_valid_attacks(
        self,
        wave_config: dict,
        building_id: str = "b-001",
        building_type: str = "LMG",
    ) -> list[dict]:
        """Generate valid attack events from wave config.

        Position [4, 3] is within range (distance from [0,0] = 5, equals LMG level 1 range).
        Multi-hit mode: each attack deals the building's fixed damage.
        """
        attacks = []
        frame = 100
        building_damage = GAME_CONFIG["buildings"][building_type]["damage"]

        for m in wave_config["monsters"]:
            monster_life = m["life"]
            hits_needed = (monster_life + building_damage - 1) // building_damage

            for _ in range(hits_needed):
                attacks.append({
                    "frame": frame,
                    "buildingId": building_id,
                    "originalTargetId": m["id"],
                    "originalTargetPosition": [4, 3],
                    "monsterId": m["id"],
                    "monsterPosition": [4, 3],
                    "damage": building_damage,
                })
                frame += 3

        return attacks

    def _make_valid_wave_result(
        self, wave_config: dict, attacks: list[dict]
    ) -> dict:
        """Generate matching wave result from attack events."""
        monsters = wave_config["monsters"]
        killed_by_type: dict[int, int] = {}
        total_life = 0
        total_money = 0
        total_damage = sum(a["damage"] for a in attacks)

        for m in monsters:
            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1
            total_life += m["life"]
            total_money += m["money"]

        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        return {
            "killed": len(monsters),
            "killedByType": killed_by_type,
            "passed": 0,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": 0,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life,
            "waveDurationFrames": 1000,
        }

    def _make_valid_last_wave(self, session: GameSession) -> dict:
        """Generate valid lastWave data."""
        wave_config = session.next_wave
        building = self._make_valid_building()
        attacks = self._make_valid_attacks(wave_config)
        result = self._make_valid_wave_result(wave_config, attacks)
        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = result["killed"]

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        return {
            "waveNumber": session.wave_count + 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

    @pytest.mark.django_db
    def test_end_session_success(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test successful session end."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["verified"] is True
        assert "ranking" in data
        assert "rank" in data["ranking"]
        assert "total" in data["ranking"]
        assert "isNewRecord" in data["ranking"]

    @pytest.mark.django_db
    def test_end_session_creates_leaderboard_entry(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test leaderboard entry creation after success."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200

        entry = LeaderboardEntry.objects.filter(nickname="TestPlayer").first()
        assert entry is not None
        assert entry.waves_completed == 6

    @pytest.mark.django_db
    def test_end_session_deletes_game_session(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test game session deletion after success."""
        session = session_with_waves
        session_id = session.id
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session_id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        assert not GameSession.objects.filter(id=session_id).exists()

    @pytest.mark.django_db
    def test_end_session_session_not_found(self, api_client: APIClient, db):
        """Test session not found."""
        request_data = {
            "sessionId": str(uuid.uuid4()),
            "nickname": "TestPlayer",
            "lastWave": {
                "waveNumber": 1,
                "actions": [],
                "attacks": [],
                "result": {
                    "killed": 0,
                    "killedByType": {},
                    "passed": 1,
                    "scoreGained": 0,
                    "moneyGained": 0,
                    "lifeLost": 1,
                    "totalDamageDealt": 0,
                    "totalLifeDestroyed": 0,
                    "waveDurationFrames": 100,
                },
                "buildings": [],
            },
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 404
        data = response.json()
        assert data["code"] == ErrorCode.SESSION_NOT_FOUND.value
        assert data["message"] == "Session not found"

    @pytest.mark.django_db
    def test_end_session_missing_fields(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test missing required fields."""
        request_data = {
            "sessionId": str(session_with_waves.id),
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.MISSING_FIELDS.value
        assert "Missing required fields" in data["message"]

    @pytest.mark.django_db
    def test_end_session_invalid_wave_number(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test lastWave non-consecutive wave number."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)
        last_wave["waveNumber"] = 10

        request_data = {
            "sessionId": str(session.id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert "message" in data
        assert "Wave not continuous" in data["message"]

    @pytest.mark.django_db
    def test_end_session_lastwave_validation_failure(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test lastWave basic validation failure."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)
        last_wave["result"]["moneyGained"] = 9999

        request_data = {
            "sessionId": str(session.id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_end_session_dps_validation_with_sold_buildings(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test DPS validation in lastWave still works when building is sold after construction.

        Scenario (reproducing the issue):
        1. Build an LMG building
        2. LMG attacks monsters, dealing damage
        3. Sell the LMG
        4. End game with empty lastWave.buildings list

        Before fix: DPS validation used submitted_buildings (empty list), causing max_dps=0,
                    any damage would trigger "DPS capacity exceeded" error.

        After fix: DPS validation uses validation_buildings (includes buildings that existed
                   during the wave), correctly calculates max_dps, validation should pass.
        """
        session = session_with_waves
        wave_config = session.next_wave
        monsters = wave_config["monsters"]

        building_id = "b-001"
        building_type = "LMG"
        building_damage = GAME_CONFIG["buildings"][building_type]["damage"]

        attacks = []
        frame = 100
        killed_by_type: dict[int, int] = {}
        total_life_destroyed = 0
        total_money = 0

        for m in monsters:
            hits_needed = (m["life"] + building_damage - 1) // building_damage
            for _ in range(hits_needed):
                attacks.append({
                    "frame": frame,
                    "buildingId": building_id,
                    "originalTargetId": m["id"],
                    "originalTargetPosition": [4, 3],
                    "monsterId": m["id"],
                    "monsterPosition": [4, 3],
                    "damage": building_damage,
                })
                frame += 3

            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1
            total_life_destroyed += m["life"]
            total_money += m["money"]

        total_damage = sum(a["damage"] for a in attacks)
        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        result = {
            "killed": len(monsters),
            "killedByType": killed_by_type,
            "passed": 0,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": 0,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life_destroyed,
            "waveDurationFrames": 1000,
        }

        actions = [
            {
                "type": "BUILD",
                "frame": 10,
                "buildingType": building_type,
                "buildingId": building_id,
                "position": [0, 0],
            },
            {
                "type": "SELL",
                "frame": frame + 10,
                "buildingId": building_id,
            },
        ]

        last_wave = {
            "waveNumber": session.wave_count + 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [],
        }

        request_data = {
            "sessionId": str(session.id),
            "nickname": "SoldBuildingTester",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["verified"] is True

    @pytest.mark.django_db
    def test_end_session_ranking_calculation(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test ranking calculation."""
        LeaderboardEntry.objects.create(
            nickname="HighScorer",
            score=99999,
            waves_completed=100,
        )
        LeaderboardEntry.objects.create(
            nickname="LowScorer",
            score=10,
            waves_completed=1,
        )

        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ranking"]["rank"] == 2
        assert data["ranking"]["total"] == 3

    @pytest.mark.django_db
    def test_end_session_is_new_record(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test isNewRecord flag (first entry)."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ranking"]["isNewRecord"] is True
        assert data["ranking"]["rank"] == 1

    @pytest.mark.django_db
    def test_end_session_final_score_calculation(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test final score calculation."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)
        last_wave_score = last_wave["result"]["scoreGained"]

        request_data = {
            "sessionId": str(session.id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200

        entry = LeaderboardEntry.objects.get(nickname="TestPlayer")

        # final score = accumulated score (no extra bonus)
        expected_score = session.score + last_wave_score

        assert entry.score == expected_score

    @pytest.mark.django_db
    def test_end_session_validate_game_end_score_mismatch(
        self, api_client: APIClient, db
    ):
        """Test validate_game_end score accumulation mismatch."""
        wave_1 = generate_wave(1, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=100,
            score=9999,  # deliberately set wrong score
            difficulty=1.0,
            wave_count=0,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_1,
        )

        building = self._make_valid_building()
        attacks = self._make_valid_attacks(wave_1)
        result = self._make_valid_wave_result(wave_1, attacks)
        building["damageDealt"] = result["totalDamageDealt"]
        building["kills"] = result["killed"]

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        last_wave = {
            "waveNumber": 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        request_data = {
            "sessionId": str(session.id),
            "nickname": "TestPlayer",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_end_session_nickname_too_long(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test nickname too long."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "A" * 33,  # exceeds 32 character limit
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert "message" in data

    @pytest.mark.django_db
    def test_end_session_nickname_empty(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test empty nickname."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert "message" in data

    @pytest.mark.django_db
    def test_end_session_nickname_whitespace_only(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test whitespace-only nickname."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "   ",  # whitespace only
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert "message" in data

    @pytest.mark.django_db
    def test_end_session_nickname_xss_attack(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test correct error message when nickname contains XSS attack code."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "<script>alert(1)</script>",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert "message" in data
        assert "Nickname contains illegal characters" in data["message"]

    @pytest.mark.django_db
    def test_end_session_without_last_wave_success(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test early end without lastWave (completed wave data used for score calculation)."""
        session = session_with_waves

        request_data = {
            "sessionId": str(session.id),
            "nickname": "EarlyEnder",
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["verified"] is True
        assert "ranking" in data

        entry = LeaderboardEntry.objects.get(nickname="EarlyEnder")
        assert entry.waves_completed == 5

    @pytest.mark.django_db
    def test_end_session_without_last_wave_requires_at_least_one_wave(
        self, api_client: APIClient, db
    ):
        """Test at least one wave must be completed when ending without lastWave."""
        wave_1 = generate_wave(1, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=100,
            score=0,
            difficulty=1.0,
            wave_count=0,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_1,
        )

        request_data = {
            "sessionId": str(session.id),
            "nickname": "NoWavePlayer",
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert "message" in data
        assert "at least one completed wave" in data["message"]

    @pytest.mark.django_db
    def test_end_session_without_last_wave_final_score(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test final score calculation when ending without lastWave."""
        session = session_with_waves

        request_data = {
            "sessionId": str(session.id),
            "nickname": "ScoreChecker",
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200

        entry = LeaderboardEntry.objects.get(nickname="ScoreChecker")

        # final score = accumulated score (no extra bonus)
        expected_score = session.score

        assert entry.score == expected_score

    @pytest.mark.django_db
    def test_end_session_without_last_wave_deletes_session(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """Test session deletion after early end without lastWave."""
        session = session_with_waves
        session_id = session.id

        request_data = {
            "sessionId": str(session_id),
            "nickname": "SessionDeleter",
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        assert not GameSession.objects.filter(id=session_id).exists()

    @pytest.mark.django_db
    def test_end_session_without_last_wave_validate_game_end_score_mismatch(
        self, api_client: APIClient, db
    ):
        """Test score accumulation consistency is also validated without lastWave.

        This test verifies that _end_without_last_wave also calls validate_game_end.
        When session.score does not match WaveRecord accumulated score, an error should be returned.
        """
        wave_6 = generate_wave(6, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=100,
            score=9999,  # deliberately set wrong score (inconsistent with WaveRecord accumulation)
            difficulty=1.0,
            wave_count=5,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_6,
        )

        # create 5 wave records, 30 points each, 150 total
        for i in range(1, 6):
            WaveRecord.objects.create(
                session=session,
                wave_number=i,
                killed=3,
                killed_by_type={0: 3},
                passed=0,
                score_gained=30,
                money_gained=15,
                life_lost=0,
                total_damage_dealt=100,
                total_life_destroyed=100,
                wave_duration_frames=1000,
                money_spent=0,
                money_income=0,
                building_count=0,
                end_money=500 + i * 15,
                end_score=i * 30,
                end_life=100,
                end_difficulty=1.0,
            )

        request_data = {
            "sessionId": str(session.id),
            "nickname": "ScoreMismatchPlayer",
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        # session.score=9999, but WaveRecord total is only 150, validation should fail
        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    # ========== zero score submission rejection tests ==========

    @pytest.mark.django_db
    def test_end_session_zero_score_rejected(self, api_client: APIClient, db):
        """Test zero score cannot be submitted to leaderboard with lastWave.

        Scenario: Player completes a wave but kills no monsters (all pass through), score = 0.
        Leaderboard should record meaningful achievements, zero score means no kills and should not be listed.
        """
        wave_1 = generate_wave(1, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=99,  # lost 1 point to monsters
            score=0,  # no monsters killed
            difficulty=1.0,
            wave_count=0,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_1,
        )

        monster_ids = [m["id"] for m in wave_1["monsters"]]
        total_monsters = len(monster_ids)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "ZeroScorePlayer",
            "lastWave": {
                "waveNumber": 1,
                "actions": [],
                "attacks": [],  # no attacks
                "result": {
                    "killed": 0,
                    "killedByType": {},
                    "passed": total_monsters,  # all pass through
                    "scoreGained": 0,
                    "moneyGained": 0,
                    "lifeLost": total_monsters,  # each monster deals 1 point of damage
                    "totalDamageDealt": 0,
                    "totalLifeDestroyed": 0,
                    "waveDurationFrames": 1000,
                },
                "buildings": [],
            },
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert "message" in data
        assert "zero score" in data["message"].lower()

    @pytest.mark.django_db
    def test_end_session_without_last_wave_zero_score_rejected(
        self, api_client: APIClient, db
    ):
        """Test zero score cannot be submitted to leaderboard without lastWave.

        Scenario: Player completed a wave but killed no monsters, wants to end the game early.
        Leaderboard should record meaningful achievements, zero score means no kills and should not be listed.
        """
        wave_2 = generate_wave(2, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=99,
            score=0,  # no monsters killed
            difficulty=1.0,
            wave_count=1,  # 1 wave completed
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_2,
        )

        # create a wave record with 0 score
        WaveRecord.objects.create(
            session=session,
            wave_number=1,
            killed=0,
            killed_by_type={},
            passed=1,
            score_gained=0,  # 0 score
            money_gained=0,
            life_lost=1,
            total_damage_dealt=0,
            total_life_destroyed=0,
            wave_duration_frames=1000,
            money_spent=0,
            money_income=0,
            building_count=0,
            end_money=500,
            end_score=0,
            end_life=99,
            end_difficulty=1.0,
        )

        request_data = {
            "sessionId": str(session.id),
            "nickname": "ZeroScoreEnder",
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert "message" in data
        assert "zero score" in data["message"].lower()

    # ========== early end with remainingMonsterIds integration tests ==========

    @pytest.fixture
    def session_with_multi_monster_wave(self, db) -> GameSession:
        """Create a session with multi-monster wave config (simulating early end scenario).

        Uses wave 6 config with multiple monsters for testing partial kill scenarios.
        """
        wave_6 = generate_wave(6, 1.0)
        session = GameSession.objects.create(
            money=800,
            life=90,
            score=150,
            difficulty=1.0,
            wave_count=5,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_6,
        )

        for i in range(1, 6):
            WaveRecord.objects.create(
                session=session,
                wave_number=i,
                killed=3,
                killed_by_type={0: 3},
                passed=0,
                score_gained=30,
                money_gained=15,
                life_lost=2,
                total_damage_dealt=100,
                total_life_destroyed=100,
                wave_duration_frames=1000,
                money_spent=0,
                money_income=0,
                building_count=0,
                end_money=500 + i * 15,
                end_score=i * 30,
                end_life=100 - i * 2,
                end_difficulty=1.0,
            )

        return session

    def _make_partial_kill_last_wave(
        self,
        session: GameSession,
        killed_count: int,
        remaining_count: int,
    ) -> dict:
        """Generate lastWave data for partial kill scenarios.

        Args:
            session: Game session
            killed_count: Number of monsters killed
            remaining_count: Number of monsters remaining on the field (early end)

        Returns:
            lastWave request data

        Note:
            passed is automatically calculated from total monster count:
            passed = total_monsters - killed_count - remaining_count
        """
        wave_config = session.next_wave
        monsters = wave_config["monsters"]
        total_monsters = len(monsters)
        passed_count = total_monsters - killed_count - remaining_count

        building = self._make_valid_building()
        building_damage = GAME_CONFIG["buildings"]["LMG"]["damage"]

        attacks = []
        frame = 100
        killed_by_type: dict[int, int] = {}
        total_life_destroyed = 0
        total_money = 0
        remaining_monster_ids = []

        for idx, m in enumerate(monsters):
            if idx < killed_count:
                hits_needed = (m["life"] + building_damage - 1) // building_damage
                for _ in range(hits_needed):
                    attacks.append({
                        "frame": frame,
                        "buildingId": building["id"],
                        "originalTargetId": m["id"],
                        "originalTargetPosition": [4, 3],
                        "monsterId": m["id"],
                        "monsterPosition": [4, 3],
                        "damage": building_damage,
                    })
                    frame += 3

                t = m["type"]
                killed_by_type[t] = killed_by_type.get(t, 0) + 1
                total_life_destroyed += m["life"]
                total_money += m["money"]
            elif idx < killed_count + remaining_count:
                remaining_monster_ids.append(m["id"])

        total_damage = sum(a["damage"] for a in attacks)
        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        result = {
            "killed": killed_count,
            "killedByType": killed_by_type,
            "passed": passed_count,
            "remaining": remaining_count,
            "remainingMonsterIds": remaining_monster_ids,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": passed_count,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": total_life_destroyed,
            "waveDurationFrames": 1000,
        }

        building["damageDealt"] = total_damage
        building["kills"] = killed_count

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        return {
            "waveNumber": session.wave_count + 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

    @pytest.mark.django_db
    def test_end_session_with_remaining_monsters_success(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """Test successful early end with remainingMonsterIds.

        Scenario: During a wave, some monsters are killed, game ends while others remain on field.
        Validation:
        1. API returns verification passed
        2. LeaderboardEntry is correctly created
        3. Session is correctly deleted

        Note: WaveRecords are cascade-deleted with the session (CASCADE), so not verified here.
        """
        session = session_with_multi_monster_wave
        session_id = session.id
        monsters = session.next_wave["monsters"]
        total_monsters = len(monsters)

        killed_count = min(2, total_monsters - 1)
        remaining_count = total_monsters - killed_count

        last_wave = self._make_partial_kill_last_wave(
            session, killed_count, remaining_count
        )

        request_data = {
            "sessionId": str(session.id),
            "nickname": "RemainingTester",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["verified"] is True
        assert "ranking" in data

        entry = LeaderboardEntry.objects.get(nickname="RemainingTester")
        assert entry.waves_completed == 6

        assert not GameSession.objects.filter(id=session_id).exists()

    @pytest.mark.django_db
    def test_end_session_remaining_monster_ids_count_mismatch(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """Test failure when remainingMonsterIds count does not match remaining."""
        session = session_with_multi_monster_wave
        last_wave = self._make_partial_kill_last_wave(session, 2, 2)

        last_wave["result"]["remainingMonsterIds"] = [
            last_wave["result"]["remainingMonsterIds"][0]
        ]

        request_data = {
            "sessionId": str(session.id),
            "nickname": "MismatchTester",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_end_session_remaining_monster_ids_invalid_uuid(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """Test failure when remainingMonsterIds contains invalid UUID."""
        session = session_with_multi_monster_wave
        last_wave = self._make_partial_kill_last_wave(session, 2, 2)

        last_wave["result"]["remainingMonsterIds"] = [
            "invalid-uuid-not-from-server",
            last_wave["result"]["remainingMonsterIds"][1],
        ]

        request_data = {
            "sessionId": str(session.id),
            "nickname": "InvalidIdTester",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_end_session_remaining_monster_should_be_killed(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """Test failure when remainingMonsterIds contains monsters that should have been killed.

        Scenario: Claims monster is still on field (remaining), but attack records show
        accumulated damage >= life.
        """
        session = session_with_multi_monster_wave
        monsters = session.next_wave["monsters"]
        total_monsters = len(monsters)
        building = self._make_valid_building()
        building_damage = GAME_CONFIG["buildings"]["LMG"]["damage"]

        first_monster = monsters[0]
        second_monster = monsters[1] if len(monsters) > 1 else monsters[0]

        hits_needed = (first_monster["life"] + building_damage - 1) // building_damage
        attacks = []
        frame = 100

        for _ in range(hits_needed):
            attacks.append({
                "frame": frame,
                "buildingId": building["id"],
                "originalTargetId": first_monster["id"],
                "originalTargetPosition": [4, 3],
                "monsterId": first_monster["id"],
                "monsterPosition": [4, 3],
                "damage": building_damage,
            })
            frame += 3

        total_damage = sum(a["damage"] for a in attacks)
        score = sum(int(math.sqrt(a["damage"])) for a in attacks)

        killed_count = 0
        remaining_count = 2
        passed_count = total_monsters - killed_count - remaining_count

        result = {
            "killed": killed_count,
            "killedByType": {},
            "passed": passed_count,
            "remaining": remaining_count,
            "remainingMonsterIds": [first_monster["id"], second_monster["id"]],
            "scoreGained": score,
            "moneyGained": 0,
            "lifeLost": passed_count,
            "totalDamageDealt": total_damage,
            "totalLifeDestroyed": 0,
            "waveDurationFrames": 1000,
        }

        building["damageDealt"] = total_damage
        building["kills"] = killed_count

        actions = [{
            "type": "BUILD",
            "frame": 10,
            "buildingType": building["type"],
            "buildingId": building["id"],
            "position": building["position"],
        }]

        last_wave = {
            "waveNumber": session.wave_count + 1,
            "actions": actions,
            "attacks": attacks,
            "result": result,
            "buildings": [building],
        }

        request_data = {
            "sessionId": str(session.id),
            "nickname": "FakeRemainingTester",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""

    @pytest.mark.django_db
    def test_end_session_remaining_monster_ids_duplicate(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """Test failure when remainingMonsterIds contains duplicate IDs."""
        session = session_with_multi_monster_wave
        last_wave = self._make_partial_kill_last_wave(session, 2, 2)

        first_remaining_id = last_wave["result"]["remainingMonsterIds"][0]
        last_wave["result"]["remainingMonsterIds"] = [
            first_remaining_id,
            first_remaining_id,
        ]

        request_data = {
            "sessionId": str(session.id),
            "nickname": "DuplicateTester",
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["code"] == ErrorCode.VALIDATION_FAILED.value
        assert data["message"] == ""


class TestLeaderboardView:
    """GET /api/game/leaderboard tests."""

    @pytest.fixture
    def leaderboard_entries(self, db):
        """Create test leaderboard data."""
        from game.models import LeaderboardEntry

        entries = []
        for i in range(20):
            entries.append(
                LeaderboardEntry.objects.create(
                    nickname=f"Player{i}",
                    score=1000 - i * 50,
                    waves_completed=10 + i,
                )
            )
        return entries

    @pytest.mark.django_db
    def test_get_leaderboard_success(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Successfully get leaderboard."""
        response = api_client.get("/api/game/leaderboard")

        assert response.status_code == 200
        data = response.json()
        assert "entries" in data

    @pytest.mark.django_db
    def test_get_leaderboard_default_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Default returns 10 entries."""
        response = api_client.get("/api/game/leaderboard")
        data = response.json()

        assert len(data["entries"]) == 10

    @pytest.mark.django_db
    def test_get_leaderboard_custom_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Custom return count."""
        response = api_client.get("/api/game/leaderboard?limit=5")
        data = response.json()

        assert len(data["entries"]) == 5

    @pytest.mark.django_db
    def test_get_leaderboard_max_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Maximum limit is 100."""
        response = api_client.get("/api/game/leaderboard?limit=200")
        data = response.json()

        assert len(data["entries"]) <= 100

    @pytest.mark.django_db
    def test_get_leaderboard_order_by_score(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Sorted by score in descending order."""
        response = api_client.get("/api/game/leaderboard")
        data = response.json()

        scores = [e["score"] for e in data["entries"]]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.django_db
    def test_get_leaderboard_entry_structure(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Each entry contains required fields."""
        response = api_client.get("/api/game/leaderboard")
        data = response.json()

        entry = data["entries"][0]
        assert "rank" in entry
        assert "nickname" in entry
        assert "score" in entry
        assert "wavesCompleted" in entry
        assert "createdAt" in entry

    @pytest.mark.django_db
    def test_get_leaderboard_rank_starts_at_1(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Ranking starts from 1."""
        response = api_client.get("/api/game/leaderboard")
        data = response.json()

        ranks = [e["rank"] for e in data["entries"]]
        assert ranks == list(range(1, len(ranks) + 1))

    @pytest.mark.django_db
    def test_get_leaderboard_empty(self, api_client: APIClient, db):
        """Empty leaderboard."""
        response = api_client.get("/api/game/leaderboard")

        assert response.status_code == 200
        data = response.json()
        assert data["entries"] == []

    @pytest.mark.django_db
    def test_get_leaderboard_invalid_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Invalid limit falls back to default."""
        response = api_client.get("/api/game/leaderboard?limit=abc")

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 10

    @pytest.mark.django_db
    def test_get_leaderboard_negative_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """Negative limit falls back to default."""
        response = api_client.get("/api/game/leaderboard?limit=-5")

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 10
