"""API 视图单元测试."""

import math
import uuid

import pytest
from rest_framework.test import APIClient

from game.config import GAME_CONFIG, INITIAL
from game.generators import generate_wave
from game.models import GameSession, WaveRecord


class TestCreateSession:
    """POST /api/game/sessions 测试."""

    @pytest.mark.django_db
    def test_create_session_success(self, api_client):
        """成功创建会话."""
        response = api_client.post("/api/game/sessions")
        assert response.status_code == 200

        data = response.json()
        assert "sessionId" in data
        assert "config" in data
        assert "firstWave" in data

    @pytest.mark.django_db
    def test_create_session_returns_valid_uuid(self, api_client):
        """返回有效的 UUID."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        import uuid
        uuid.UUID(data["sessionId"])

    @pytest.mark.django_db
    def test_create_session_config_structure(self, api_client):
        """配置包含必需字段."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        config = data["config"]
        assert "buildings" in config
        assert "monsters" in config
        assert "map" in config
        assert "initial" in config

    @pytest.mark.django_db
    def test_create_session_initial_values(self, api_client):
        """初始值正确."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        initial = data["config"]["initial"]
        assert initial["money"] == 500
        assert initial["life"] == 100
        assert initial["difficulty"] == 1.0

    @pytest.mark.django_db
    def test_create_session_first_wave_structure(self, api_client):
        """第一波配置结构正确."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        first_wave = data["firstWave"]
        assert first_wave["waveNumber"] == 1
        assert "monsters" in first_wave
        assert len(first_wave["monsters"]) == 1  # 第一波只有 1 个怪物

    @pytest.mark.django_db
    def test_create_session_monster_attributes(self, api_client):
        """怪物包含必需属性."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        monster = data["firstWave"]["monsters"][0]
        required_fields = {"id", "type", "life", "speed", "shield", "money"}
        assert required_fields.issubset(monster.keys())

    @pytest.mark.django_db
    def test_create_session_persists_to_database(self, api_client):
        """会话持久化到数据库."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        session_id = data["sessionId"]
        assert GameSession.objects.filter(id=session_id).exists()

    @pytest.mark.django_db
    def test_create_session_database_state(self, api_client):
        """数据库中的会话状态正确."""
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
        """数据库中存储了下一波配置."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        session = GameSession.objects.get(id=data["sessionId"])
        assert session.next_wave["waveNumber"] == 1
        assert len(session.next_wave["monsters"]) == 1

    @pytest.mark.django_db
    def test_create_session_buildings_config(self, api_client):
        """建筑配置正确."""
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
        """怪物配置正确（只包含展示属性）."""
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
        """地图配置正确."""
        response = api_client.post("/api/game/sessions")
        data = response.json()

        map_config = data["config"]["map"]
        assert map_config["width"] == 16
        assert map_config["height"] == 16
        assert map_config["entrance"] == [0, 0]
        assert map_config["exit"] == [15, 15]


class TestSubmitWaveView:
    """POST /api/game/sessions/wave 测试."""

    @pytest.fixture
    def session_with_first_wave(self, db) -> GameSession:
        """创建带有第一波配置的会话."""
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
        """构建怪物 ID 到怪物数据的映射."""
        return {m["id"]: m for m in wave_config["monsters"]}

    def _make_valid_wave_result(self, wave_config: dict) -> dict:
        """根据波次配置生成有效的波次结果."""
        monsters = wave_config["monsters"]
        killed_by_type: dict[int, int] = {}
        total_life = 0
        total_money = 0

        for m in monsters:
            t = m["type"]
            killed_by_type[t] = killed_by_type.get(t, 0) + 1
            total_life += m["life"]
            total_money += m["money"]

        total_killed = len(monsters)
        score = sum(int(math.sqrt(m["life"])) for m in monsters)

        return {
            "killed": total_killed,
            "killedByType": killed_by_type,
            "passed": 0,
            "scoreGained": score,
            "moneyGained": total_money,
            "lifeLost": 0,
            "totalDamageDealt": total_life,
            "totalLifeDestroyed": total_life,
            "waveDurationFrames": 1000,
        }

    def _make_valid_attacks(self, wave_config: dict) -> list[dict]:
        """根据波次配置生成有效的攻击事件."""
        attacks = []
        frame = 100
        for m in wave_config["monsters"]:
            attacks.append({
                "frame": frame,
                "buildingId": "b-001",
                "originalTargetId": m["id"],
                "originalTargetPosition": [5, 5],
                "monsterId": m["id"],
                "monsterPosition": [5, 5],
                "damage": m["life"],
            })
            frame += 10
        return attacks

    @pytest.mark.django_db
    def test_submit_wave_success(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试成功提交波次."""
        session = session_with_first_wave
        wave_config = session.next_wave

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": [],
            "attacks": self._make_valid_attacks(wave_config),
            "result": self._make_valid_wave_result(wave_config),
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
        assert "serverState" in data
        assert "nextWave" in data

        server_state = data["serverState"]
        assert server_state["money"] == INITIAL["money"] + request_data["result"]["moneyGained"]
        assert server_state["score"] == request_data["result"]["scoreGained"]
        assert server_state["life"] == INITIAL["life"]

        next_wave = data["nextWave"]
        assert next_wave["waveNumber"] == 2
        assert len(next_wave["monsters"]) > 0

    @pytest.mark.django_db
    def test_submit_wave_session_not_found(self, api_client: APIClient, db):
        """测试会话不存在."""
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
        assert data["error"]["code"] == "SESSION_NOT_FOUND"

    @pytest.mark.django_db
    def test_submit_wave_invalid_wave_number(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试波次不连续."""
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
        assert data["valid"] is False
        assert "error" in data
        assert "波次不连续" in data["error"]["message"]

    @pytest.mark.django_db
    def test_submit_wave_killed_count_mismatch(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试击杀数量不一致."""
        session = session_with_first_wave
        wave_config = session.next_wave

        result = self._make_valid_wave_result(wave_config)
        result["killed"] = 999

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
        assert data["valid"] is False
        assert "击杀数量不一致" in data["error"]["message"]

    @pytest.mark.django_db
    def test_submit_wave_money_mismatch(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试金钱收益不匹配."""
        session = session_with_first_wave
        wave_config = session.next_wave

        result = self._make_valid_wave_result(wave_config)
        result["moneyGained"] = 9999

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
        assert data["valid"] is False
        assert "金钱收益不匹配" in data["error"]["message"]

    @pytest.mark.django_db
    def test_submit_wave_creates_wave_record(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试成功提交后创建 WaveRecord."""
        session = session_with_first_wave
        wave_config = session.next_wave

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": [],
            "attacks": self._make_valid_attacks(wave_config),
            "result": self._make_valid_wave_result(wave_config),
            "buildings": [],
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
        """测试成功提交后更新 GameSession."""
        session = session_with_first_wave
        wave_config = session.next_wave
        result = self._make_valid_wave_result(wave_config)

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

        assert response.status_code == 200

        session.refresh_from_db()
        assert session.wave_count == 1
        assert session.money == INITIAL["money"] + result["moneyGained"]
        assert session.score == result["scoreGained"]
        assert session.life == INITIAL["life"] - result["lifeLost"]

    @pytest.mark.django_db
    def test_submit_wave_with_build_action(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试带有建造操作的波次提交."""
        session = session_with_first_wave
        wave_config = session.next_wave
        result = self._make_valid_wave_result(wave_config)

        actions = [
            {
                "type": "BUILD",
                "frame": 50,
                "buildingType": "LMG",
                "buildingId": "b-001",
                "position": [5, 5],
            }
        ]
        buildings = [
            {
                "id": "b-001",
                "type": "LMG",
                "position": [5, 5],
                "level": 1,
                "damageDealt": result["totalDamageDealt"],
                "kills": result["killed"],
            }
        ]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": self._make_valid_attacks(wave_config),
            "result": result,
            "buildings": buildings,
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
        """测试金钱不足."""
        session = session_with_first_wave
        wave_config = session.next_wave
        result = self._make_valid_wave_result(wave_config)

        actions = [
            {
                "type": "BUILD",
                "frame": 50,
                "buildingType": "laser_gun",
                "buildingId": "b-001",
                "position": [5, 5],
            }
        ]
        buildings = [
            {
                "id": "b-001",
                "type": "laser_gun",
                "position": [5, 5],
                "level": 1,
                "damageDealt": 0,
                "kills": 0,
            }
        ]

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": self._make_valid_attacks(wave_config),
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
        assert data["valid"] is False
        assert "金钱余额不足" in data["error"]["message"]

    @pytest.mark.django_db
    def test_submit_wave_score_mismatch(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试得分不匹配."""
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
        assert data["valid"] is False
        assert "分数不匹配" in data["error"]["message"]

    @pytest.mark.django_db
    def test_submit_wave_life_reward(self, api_client: APIClient, db):
        """测试第 5 波的生命奖励."""
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

        result = self._make_valid_wave_result(wave_5)

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 5,
            "actions": [],
            "attacks": self._make_valid_attacks(wave_5),
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

        assert data["nextWave"]["lifeReward"] == 5

    @pytest.mark.django_db
    def test_submit_wave_missing_fields(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试缺少必填字段."""
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
        assert data["error"]["code"] == "INVALID_REQUEST"

    @pytest.mark.django_db
    def test_submit_wave_game_over(self, api_client: APIClient, db):
        """测试生命归零时不返回下一波."""
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
        """测试建筑列表一致性验证."""
        session = session_with_first_wave
        wave_config = session.next_wave
        result = self._make_valid_wave_result(wave_config)

        actions = [
            {
                "type": "BUILD",
                "frame": 50,
                "buildingType": "LMG",
                "buildingId": "b-001",
                "position": [5, 5],
            }
        ]
        buildings = []

        request_data = {
            "sessionId": str(session.id),
            "waveNumber": 1,
            "actions": actions,
            "attacks": self._make_valid_attacks(wave_config),
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
        assert data["valid"] is False
        assert "建筑列表不一致" in data["error"]["message"]
