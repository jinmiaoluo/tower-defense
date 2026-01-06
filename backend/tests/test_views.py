"""API 视图单元测试."""

import math
import uuid

import pytest
from rest_framework.test import APIClient

from game.config import GAME_CONFIG, INITIAL
from game.generators import generate_wave
from game.models import GameSession, LeaderboardEntry, WaveRecord


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

    def _make_valid_building(
        self,
        building_id: str = "b-001",
        building_type: str = "LMG",
    ) -> dict:
        """创建有效的建筑数据.

        默认使用 LMG（成本 100，伤害 5，射程 5-10）。
        位置 [0, 0] 在入口，射程可以覆盖怪物路径。
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
        """根据波次配置生成有效的波次结果.

        内部生成攻击事件并计算匹配的得分。
        """
        attacks = self._make_valid_attacks(wave_config, building_type=building_type)
        return self._make_valid_wave_result_with_attacks(wave_config, attacks)

    def _make_valid_attacks(
        self,
        wave_config: dict,
        building_id: str = "b-001",
        building_type: str = "LMG",
    ) -> list[dict]:
        """根据波次配置生成有效的攻击事件.

        位置 [4, 3] 在射程内（距离 [0,0] = 5，等于 LMG 1 级射程）。
        每次攻击造成建筑的固定伤害，多次攻击累计击杀怪物。
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
        """根据攻击事件生成匹配的波次结果."""
        monsters = wave_config["monsters"]
        monsters_map = {m["id"]: m for m in monsters}

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
        """测试成功提交波次."""
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
        assert data["valid"] is False
        assert "击杀数量不一致" in data["error"]["message"]

    @pytest.mark.django_db
    def test_submit_wave_money_mismatch(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试金钱收益不匹配."""
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
        assert data["valid"] is False
        assert "金钱收益不匹配" in data["error"]["message"]

    @pytest.mark.django_db
    def test_submit_wave_creates_wave_record(
        self, api_client: APIClient, session_with_first_wave: GameSession
    ):
        """测试成功提交后创建 WaveRecord."""
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
        """测试成功提交后更新 GameSession."""
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
        """测试带有建造操作的波次提交."""
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
        """测试金钱不足."""
        session = session_with_first_wave
        wave_config = session.next_wave
        monsters = wave_config["monsters"]

        total_money = sum(m["money"] for m in monsters)
        total_life = sum(m["life"] for m in monsters)
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
        assert data["valid"] is False
        assert "建筑列表不一致" in data["error"]["message"]

    # ========== remaining 字段验证测试 ==========

    @pytest.fixture
    def session_with_multi_monster_wave(self, db) -> GameSession:
        """创建带有多怪物波次配置的会话（用于测试 remaining 场景）.

        使用第 5 波配置，包含多个怪物，便于测试部分击杀场景。
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
        """生成部分击杀场景的攻击事件和结果.

        Args:
            wave_config: 波次配置
            killed_count: 击杀的怪物数量
            remaining_count: 场上剩余的怪物数量
            building_id: 建筑 ID
            building_type: 建筑类型

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
        """测试提交带 remaining 的波次成功."""
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
        """测试 remainingMonsterIds 包含无效 UUID 时失败."""
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
        assert data["valid"] is False
        assert "remainingMonsterId" in data["error"]["message"]


class TestEndSessionView:
    """POST /api/game/sessions/end 测试."""

    @pytest.fixture
    def session_with_waves(self, db) -> GameSession:
        """创建带有波次记录的会话（模拟玩家已完成 5 波）."""
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
        """构建怪物 ID 到怪物数据的映射."""
        return {m["id"]: m for m in wave_config["monsters"]}

    def _make_valid_building(
        self,
        building_id: str = "b-001",
        building_type: str = "LMG",
    ) -> dict:
        """创建有效的建筑数据."""
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
        """根据波次配置生成有效的攻击事件.

        位置 [4, 3] 在射程内（距离 [0,0] = 5，等于 LMG 1 级射程）。
        使用多击模式: 每次攻击造成建筑固定伤害。
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
        """根据攻击事件生成匹配的波次结果."""
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
        """生成有效的 lastWave 数据."""
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
        """测试成功结束会话."""
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
        """测试成功后创建排行榜记录."""
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
        """测试成功后删除游戏会话."""
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
        """测试会话不存在."""
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
        assert data["error"]["code"] == "SESSION_NOT_FOUND"

    @pytest.mark.django_db
    def test_end_session_missing_fields(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试缺少必填字段."""
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
        assert data["error"]["code"] == "INVALID_REQUEST"

    @pytest.mark.django_db
    def test_end_session_invalid_wave_number(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试 lastWave 波次不连续."""
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
        assert data["verified"] is False
        assert "波次不连续" in data["error"]["message"]

    @pytest.mark.django_db
    def test_end_session_lastwave_validation_failure(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试 lastWave 基础验证失败."""
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
        assert data["verified"] is False
        assert "金钱收益不匹配" in data["error"]["message"]

    @pytest.mark.django_db
    def test_end_session_ranking_calculation(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试排名计算."""
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
        """测试 isNewRecord 标志（第一条记录）."""
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
        """测试最终得分计算."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)
        last_wave_score = last_wave["result"]["scoreGained"]
        last_wave_money = last_wave["result"]["moneyGained"]

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

        # 最终得分 = 累计积分（没有额外奖励）
        expected_score = session.score + last_wave_score

        assert entry.score == expected_score

    @pytest.mark.django_db
    def test_end_session_validate_game_end_score_mismatch(
        self, api_client: APIClient, db
    ):
        """测试 validate_game_end 分数累计不一致."""
        wave_1 = generate_wave(1, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=100,
            score=9999,  # 故意设置错误的分数
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
        assert data["verified"] is False
        assert "分数累计不一致" in data["error"]["message"]

    @pytest.mark.django_db
    def test_end_session_nickname_too_long(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试昵称过长."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "A" * 33,  # 超过 32 字符限制
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "INVALID_REQUEST"

    @pytest.mark.django_db
    def test_end_session_nickname_empty(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试昵称为空."""
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
        assert data["error"]["code"] == "INVALID_REQUEST"

    @pytest.mark.django_db
    def test_end_session_nickname_whitespace_only(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试昵称为纯空白字符."""
        session = session_with_waves
        last_wave = self._make_valid_last_wave(session)

        request_data = {
            "sessionId": str(session.id),
            "nickname": "   ",  # 纯空格
            "lastWave": last_wave,
        }

        response = api_client.post(
            "/api/game/sessions/end",
            data=request_data,
            format="json",
        )

        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "INVALID_REQUEST"

    @pytest.mark.django_db
    def test_end_session_without_last_wave_success(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试不带 lastWave 的提前结束（已完成的波次数据用于计算得分）."""
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
        """测试不带 lastWave 时必须至少完成一波."""
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
        assert data["verified"] is False
        assert "至少完成一波" in data["error"]["message"]

    @pytest.mark.django_db
    def test_end_session_without_last_wave_final_score(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试不带 lastWave 时的最终得分计算."""
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

        # 最终得分 = 累计积分（没有额外奖励）
        expected_score = session.score

        assert entry.score == expected_score

    @pytest.mark.django_db
    def test_end_session_without_last_wave_deletes_session(
        self, api_client: APIClient, session_with_waves: GameSession
    ):
        """测试不带 lastWave 的提前结束后删除会话."""
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
        """测试不带 lastWave 时也应验证分数累计一致性.

        这个测试验证 _end_without_last_wave 也调用 validate_game_end。
        当 session.score 与 WaveRecord 累计分数不一致时，应返回错误。
        """
        wave_6 = generate_wave(6, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=100,
            score=9999,  # 故意设置错误的分数（与 WaveRecord 累计不一致）
            difficulty=1.0,
            wave_count=5,
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_6,
        )

        # 创建 5 波记录，每波 30 分，累计 150 分
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

        # session.score=9999，但 WaveRecord 累计只有 150，应验证失败
        assert response.status_code == 400
        data = response.json()
        assert data["verified"] is False
        assert "分数累计不一致" in data["error"]["message"]

    # ========== 0 分提交拒绝测试 ==========

    @pytest.mark.django_db
    def test_end_session_zero_score_rejected(self, api_client: APIClient, db):
        """测试带 lastWave 时 0 分不能提交到排行榜.

        场景：玩家完成一波但没有击杀任何怪物（全部穿过终点），score = 0。
        排行榜应记录有意义的成绩，0 分表示没有任何击杀，不应上榜。
        """
        wave_1 = generate_wave(1, 1.0)
        wave_2 = generate_wave(2, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=99,  # 被怪物扣了 1 点
            score=0,  # 没有击杀任何怪物
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
                "attacks": [],  # 没有任何攻击
                "result": {
                    "killed": 0,
                    "killedByType": {},
                    "passed": total_monsters,  # 全部穿过
                    "scoreGained": 0,
                    "moneyGained": 0,
                    "lifeLost": total_monsters,  # 每个怪物造成 1 点伤害
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
        assert data["verified"] is False
        assert "0 分" in data["error"]["message"] or "零分" in data["error"]["message"]

    @pytest.mark.django_db
    def test_end_session_without_last_wave_zero_score_rejected(
        self, api_client: APIClient, db
    ):
        """测试不带 lastWave 时 0 分不能提交到排行榜.

        场景：玩家完成了一波但没有击杀任何怪物，想要提前结束游戏。
        排行榜应记录有意义的成绩，0 分表示没有任何击杀，不应上榜。
        """
        wave_2 = generate_wave(2, 1.0)
        session = GameSession.objects.create(
            money=500,
            life=99,
            score=0,  # 没有击杀任何怪物
            difficulty=1.0,
            wave_count=1,  # 已完成 1 波
            buildings=[],
            config=GAME_CONFIG,
            next_wave=wave_2,
        )

        # 创建一波 0 分的记录
        WaveRecord.objects.create(
            session=session,
            wave_number=1,
            killed=0,
            killed_by_type={},
            passed=1,
            score_gained=0,  # 0 分
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
        assert data["verified"] is False
        assert "0 分" in data["error"]["message"] or "零分" in data["error"]["message"]

    # ========== 带 remainingMonsterIds 的提前结束集成测试 ==========

    @pytest.fixture
    def session_with_multi_monster_wave(self, db) -> GameSession:
        """创建带有多怪物波次配置的会话（模拟提前结束场景）.

        使用第 6 波配置，包含多个怪物，便于测试部分击杀场景。
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
        """生成部分击杀场景的 lastWave 数据.

        Args:
            session: 游戏会话
            killed_count: 击杀的怪物数量
            remaining_count: 场上剩余的怪物数量（提前结束）

        Returns:
            lastWave 请求数据

        Note:
            passed 会根据总怪物数自动计算：
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
        """测试带 remainingMonsterIds 的提前结束成功场景.

        场景：波次进行中，部分怪物被击杀，部分还在场上时结束游戏。
        验证：
        1. API 返回验证通过
        2. LeaderboardEntry 正确创建
        3. 会话被正确删除

        注意：WaveRecord 会随会话级联删除（CASCADE），因此不在此处验证。
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
        """测试 remainingMonsterIds 数量与 remaining 不一致时失败."""
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
        assert data["verified"] is False
        assert "remainingMonsterIds" in data["error"]["message"]

    @pytest.mark.django_db
    def test_end_session_remaining_monster_ids_invalid_uuid(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """测试 remainingMonsterIds 包含无效 UUID 时失败."""
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
        assert data["verified"] is False
        assert "remainingMonsterId" in data["error"]["message"]

    @pytest.mark.django_db
    def test_end_session_remaining_monster_should_be_killed(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """测试 remainingMonsterIds 包含应被击杀的怪物时失败.

        场景：声称怪物在场上（remaining），但攻击记录显示累计伤害 >= 生命值。
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
        assert data["verified"] is False
        assert "击杀" in data["error"]["message"] or "remaining" in data["error"]["message"].lower()

    @pytest.mark.django_db
    def test_end_session_remaining_monster_ids_duplicate(
        self, api_client: APIClient, session_with_multi_monster_wave: GameSession
    ):
        """测试 remainingMonsterIds 包含重复 ID 时失败."""
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
        assert data["verified"] is False
        assert "重复" in data["error"]["message"]


class TestLeaderboardView:
    """GET /api/game/leaderboard 测试."""

    @pytest.fixture
    def leaderboard_entries(self, db):
        """创建测试用排行榜数据."""
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
        """成功获取排行榜."""
        response = api_client.get("/api/game/leaderboard")

        assert response.status_code == 200
        data = response.json()
        assert "entries" in data

    @pytest.mark.django_db
    def test_get_leaderboard_default_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """默认返回 10 条."""
        response = api_client.get("/api/game/leaderboard")
        data = response.json()

        assert len(data["entries"]) == 10

    @pytest.mark.django_db
    def test_get_leaderboard_custom_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """自定义返回条数."""
        response = api_client.get("/api/game/leaderboard?limit=5")
        data = response.json()

        assert len(data["entries"]) == 5

    @pytest.mark.django_db
    def test_get_leaderboard_max_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """limit 最大为 100."""
        response = api_client.get("/api/game/leaderboard?limit=200")
        data = response.json()

        assert len(data["entries"]) <= 100

    @pytest.mark.django_db
    def test_get_leaderboard_order_by_score(
        self, api_client: APIClient, leaderboard_entries
    ):
        """按分数降序排列."""
        response = api_client.get("/api/game/leaderboard")
        data = response.json()

        scores = [e["score"] for e in data["entries"]]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.django_db
    def test_get_leaderboard_entry_structure(
        self, api_client: APIClient, leaderboard_entries
    ):
        """每条记录包含必需字段."""
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
        """排名从 1 开始."""
        response = api_client.get("/api/game/leaderboard")
        data = response.json()

        ranks = [e["rank"] for e in data["entries"]]
        assert ranks == list(range(1, len(ranks) + 1))

    @pytest.mark.django_db
    def test_get_leaderboard_empty(self, api_client: APIClient, db):
        """空排行榜."""
        response = api_client.get("/api/game/leaderboard")

        assert response.status_code == 200
        data = response.json()
        assert data["entries"] == []

    @pytest.mark.django_db
    def test_get_leaderboard_invalid_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """无效 limit 使用默认值."""
        response = api_client.get("/api/game/leaderboard?limit=abc")

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 10

    @pytest.mark.django_db
    def test_get_leaderboard_negative_limit(
        self, api_client: APIClient, leaderboard_entries
    ):
        """负数 limit 使用默认值."""
        response = api_client.get("/api/game/leaderboard?limit=-5")

        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 10
