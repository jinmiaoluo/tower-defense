# 后端开发指南

## 开发模式

采用 TDD 模式，测试先行：

```
1. 定义数据模型 (models.py)
       ↓
2. 编写计算器测试 (test_calculators.py)
       ↓
3. 实现计算器 (calculators.py)
       ↓
4. 编写验证器测试 (test_validators.py)
       ↓
5. 实现验证器 (validators.py)
       ↓
6. 编写 API 测试 (test_views.py)
       ↓
7. 实现 API 视图 (views.py)
```

## 目录结构

```
backend/
├── config/              # Django 项目配置
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── game/                # 游戏应用
│   ├── models.py        # 数据模型
│   ├── serializers.py   # DRF 序列化器
│   ├── views.py         # API 视图
│   ├── urls.py          # URL 路由
│   ├── calculators.py   # 核心计算逻辑
│   ├── validators.py    # 验证逻辑
│   ├── generators.py    # 波次生成逻辑
│   ├── config.py        # 游戏配置（建筑、怪物基础属性）
│   └── management/
│       └── commands/
│           └── cleanup_sessions.py
├── tests/
│   ├── test_calculators.py
│   ├── test_validators.py
│   ├── test_generators.py
│   └── test_views.py
├── manage.py
├── pyproject.toml
└── pytest.ini
```

## 开发优先级

| 阶段 | 内容 | 说明 |
|------|------|------|
| P0 | 项目初始化 | Django + DRF + PostgreSQL + pytest |
| P0 | 数据模型 | GameSession, WaveRecord, LeaderboardEntry |
| P0 | 游戏配置 | 建筑配置、怪物基础属性、地图配置 |
| P1 | 计算器 (TDD) | calc_total_cost, process_actions, calc_new_difficulty, calc_monster_attrs |
| P1 | 波次生成器 (TDD) | generate_wave, generate_first_wave |
| P2 | 验证器 (TDD) | Level 1, Level 2, Level 2+, Level 4 |
| P2 | API 视图 (TDD) | 创建会话, 提交波次, 游戏结束, 排行榜 |
| P3 | 管理命令 | cleanup_sessions |
| P3 | 部署配置 | Docker, Gunicorn, Nginx |

## 游戏配置

服务端内部使用完整的怪物配置（包含所有属性），API 响应时只返回部分属性：

| 属性 | 服务端配置 | API config.monsters | API wave.monsters |
|------|-----------|---------------------|-------------------|
| name | ✅ | ✅ | - |
| color | ✅ | ✅ | - |
| damage | ✅ | ✅ | - |
| life | ✅ 基础值 | - | ✅ 计算后 |
| speed | ✅ 基础值 | - | ✅ 计算后 |
| shield | ✅ 基础值 | - | ✅ 计算后 |
| money | ✅ | - | ✅ |
| score | ✅ | - | ✅ |

> **说明**：`life/speed/shield` 会根据难度系数动态计算，因此在每波怪物配置中返回计算后的值。`damage` 是静态属性，不受难度影响，放在 `config.monsters` 中。

```python
# game/config.py

GAME_CONFIG = {
    "buildings": {
        "wall": {
            "name": "路障",
            "cost": 5,
            "damage": 0,
            "range": 0,
            "speed": 0,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
        "cannon": {
            "name": "炮台",
            "cost": 300,
            "damage": 12,
            "range": 8,
            "speed": 30,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
        "LMG": {
            "name": "轻机枪",
            "cost": 100,
            "damage": 5,
            "range": 10,
            "speed": 20,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
        "HMG": {
            "name": "重机枪",
            "cost": 800,
            "damage": 30,
            "range": 5,
            "speed": 20,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
        "laser_gun": {
            "name": "激光枪",
            "cost": 2000,
            "damage": 25,
            "range": 10,
            "speed": 3,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
    },
    "monsters": {
        0: {"name": "普通怪", "life": 50, "speed": 3, "shield": 0, "damage": 1, "money": 10, "score": 10, "color": "#00ff00"},
        1: {"name": "稍强怪", "life": 50, "speed": 6, "shield": 1, "damage": 2, "money": 15, "score": 15, "color": "#33ff33"},
        2: {"name": "速度怪", "life": 50, "speed": 12, "shield": 1, "damage": 3, "money": 20, "score": 20, "color": "#66ff66"},
        3: {"name": "血量怪", "life": 500, "speed": 5, "shield": 1, "damage": 3, "money": 50, "score": 50, "color": "#ff0000"},
        4: {"name": "护盾怪", "life": 50, "speed": 5, "shield": 20, "damage": 3, "money": 30, "score": 30, "color": "#0000ff"},
        5: {"name": "伤害怪", "life": 50, "speed": 7, "shield": 2, "damage": 10, "money": 25, "score": 25, "color": "#ff00ff"},
        6: {"name": "速度血量怪", "life": 100, "speed": 15, "shield": 3, "damage": 3, "money": 35, "score": 35, "color": "#ffff00"},
        7: {"name": "极速怪", "life": 30, "speed": 30, "shield": 1, "damage": 4, "money": 20, "score": 20, "color": "#00ffff"},
        8: {"name": "护盾血量怪", "life": 300, "speed": 3, "shield": 15, "damage": 5, "money": 60, "score": 60, "color": "#ff6600"},
    },
    "map": {
        "width": 16,
        "height": 16,
        "entrance": [0, 0],
        "exit": [15, 15],
        "obstacles": [],
    },
    "initial": {
        "money": 500,
        "life": 100,
        "difficulty": 1.0,
    },
}

# 波次 1-10 的预定义配置
PREDEFINED_WAVES = {
    1: [{"type": 0, "count": 3}],
    2: [{"type": 0, "count": 3}, {"type": 1, "count": 2}],
    3: [{"type": 1, "count": 3}, {"type": 2, "count": 2}],
    4: [{"type": 0, "count": 2}, {"type": 2, "count": 3}],
    5: [{"type": 1, "count": 3}, {"type": 3, "count": 1}],
    6: [{"type": 2, "count": 3}, {"type": 4, "count": 2}],
    7: [{"type": 3, "count": 2}, {"type": 5, "count": 2}],
    8: [{"type": 4, "count": 3}, {"type": 6, "count": 2}],
    9: [{"type": 5, "count": 2}, {"type": 7, "count": 3}],
    10: [{"type": 6, "count": 2}, {"type": 8, "count": 2}],
}
```

## 核心计算器

### calc_total_cost

计算建筑累计花费（建造 + 所有升级）。

```python
# tests/test_calculators.py
def test_calc_total_cost_level_1():
    assert calc_total_cost("cannon", 1, GAME_CONFIG) == 300

def test_calc_total_cost_level_2():
    # 300 + 300 * 0.75 = 525
    assert calc_total_cost("cannon", 2, GAME_CONFIG) == 525

def test_calc_total_cost_level_3():
    # 300 + 225 + 525 * 0.75 = 918
    assert calc_total_cost("cannon", 3, GAME_CONFIG) == 918
```

### process_actions

处理建筑操作序列，计算花费和收入。

```python
def test_process_actions_build():
    actions = [{"type": "BUILD", "buildingType": "cannon", "buildingId": "b-001", "frame": 100}]
    spent, income, buildings = process_actions(actions, [], GAME_CONFIG)
    assert spent == 300
    assert income == 0
    assert len(buildings) == 1

def test_process_actions_upgrade():
    session_buildings = [{"id": "b-001", "type": "cannon", "level": 1}]
    actions = [{"type": "UPGRADE", "buildingId": "b-001", "level": 2, "frame": 200}]
    spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
    assert spent == 225  # 300 * 0.75

def test_process_actions_sell():
    session_buildings = [{"id": "b-001", "type": "cannon", "level": 1}]
    actions = [{"type": "SELL", "buildingId": "b-001", "frame": 300}]
    spent, income, buildings = process_actions(actions, session_buildings, GAME_CONFIG)
    assert income == 150  # 300 * 0.5
    assert len(buildings) == 0
```

### calc_new_difficulty

根据上一波受伤情况计算新难度。

```python
def test_calc_new_difficulty_no_damage_early():
    assert calc_new_difficulty(1.0, 0, 3) == 1.05

def test_calc_new_difficulty_no_damage_late():
    assert calc_new_difficulty(1.0, 0, 10) == 1.2

def test_calc_new_difficulty_heavy_damage():
    assert calc_new_difficulty(2.0, 50, 5) == 1.2  # 2.0 * 0.6

def test_calc_new_difficulty_min_value():
    assert calc_new_difficulty(0.5, 50, 5) == 1.0  # 不低于 1.0
```

### calc_monster_attrs

基于难度系数计算怪物实际属性。

```python
def test_calc_monster_attrs_default_difficulty():
    base = {"life": 50, "speed": 3, "shield": 0, "money": 10, "score": 10}
    result = calc_monster_attrs(base, 1.0)
    assert result["life"] == 50   # 50 * (1+1) * 0.5 = 50
    assert result["speed"] == 3.5  # 3 + 1.0/2
    assert result["shield"] == 0   # 0 + 1.0/2 = 0.5 -> int = 0

def test_calc_monster_attrs_high_difficulty():
    base = {"life": 50, "speed": 3, "shield": 0, "money": 10, "score": 10}
    result = calc_monster_attrs(base, 3.0)
    assert result["life"] == 100  # 50 * (3+1) * 0.5 = 100
    assert result["speed"] == 4.5  # 3 + 3.0/2
```

## 波次生成器

### generate_wave

生成指定波次的怪物配置。

```python
# tests/test_generators.py
def test_generate_wave_predefined():
    wave = generate_wave(1, 1.0)
    assert wave["waveNumber"] == 1
    assert len(wave["monsters"]) == 3
    assert all(m["type"] == 0 for m in wave["monsters"])

def test_generate_wave_auto():
    wave = generate_wave(15, 1.0)
    assert wave["waveNumber"] == 15
    # 怪物数量 = min(15^1.1, 100) ≈ 19
    assert len(wave["monsters"]) <= 100

def test_generate_wave_with_difficulty():
    wave = generate_wave(1, 2.0)
    # 验证怪物属性已按难度调整
    for monster in wave["monsters"]:
        assert monster["life"] > 50  # 基础值 50，难度 2.0 时应增加

def test_generate_wave_monster_ids():
    wave = generate_wave(1, 1.0)
    # 每个怪物应有唯一 UUID
    ids = [m["id"] for m in wave["monsters"]]
    assert len(ids) == len(set(ids))
```

## 验证器

### Level 1：基础验证

```python
# tests/test_validators.py
def test_validate_basic_success():
    result = {
        "killed": 3,
        "killedByType": {0: 3},
        "passed": 0,
        "moneyGained": 30,
        "scoreGained": 30,
    }
    wave_config = {
        "monsters": [{"type": 0, "count": 3, "money": 10, "score": 10}]
    }
    ok, err = validate_basic(result, wave_config)
    assert ok is True

def test_validate_basic_killed_mismatch():
    result = {"killed": 5, "killedByType": {0: 3}, "passed": 0}
    wave_config = {"monsters": [{"type": 0, "count": 3}]}
    ok, err = validate_basic(result, wave_config)
    assert ok is False
    assert "击杀数量不一致" in err

def test_validate_basic_money_mismatch():
    result = {
        "killed": 3,
        "killedByType": {0: 3},
        "passed": 0,
        "moneyGained": 100,  # 错误值
        "scoreGained": 30,
    }
    wave_config = {
        "monsters": [{"type": 0, "count": 3, "money": 10, "score": 10}]
    }
    ok, err = validate_basic(result, wave_config)
    assert ok is False
    assert "金钱收益不匹配" in err
```

### Level 2：伤害验证

```python
def test_validate_damage_success():
    result = {
        "killedByType": {0: 3},
        "totalLifeDestroyed": 150,
        "totalDamageDealt": 180,
        "waveDurationFrames": 1000,
    }
    buildings = [{"type": "cannon", "level": 1}]
    wave_config = {"monsters": [{"type": 0, "count": 3, "life": 50}]}
    ok, err = validate_damage(result, buildings, wave_config, GAME_CONFIG["buildings"])
    assert ok is True

def test_validate_damage_life_pool_mismatch():
    result = {
        "killedByType": {0: 3},
        "totalLifeDestroyed": 200,  # 错误值，应为 150
        "totalDamageDealt": 200,
        "waveDurationFrames": 1000,
    }
    buildings = [{"type": "cannon", "level": 1}]
    wave_config = {"monsters": [{"type": 0, "count": 3, "life": 50}]}
    ok, err = validate_damage(result, buildings, wave_config, GAME_CONFIG["buildings"])
    assert ok is False
    assert "生命池验证失败" in err

def test_validate_damage_dps_exceeded():
    result = {
        "killedByType": {0: 3},
        "totalLifeDestroyed": 150,
        "totalDamageDealt": 10000,  # 不可能的高伤害
        "waveDurationFrames": 100,
    }
    buildings = [{"type": "cannon", "level": 1}]  # DPS = 12/30 = 0.4
    wave_config = {"monsters": [{"type": 0, "count": 3, "life": 50}]}
    ok, err = validate_damage(result, buildings, wave_config, GAME_CONFIG["buildings"])
    assert ok is False
    assert "DPS 容量超限" in err
```

### Level 2+：攻击事件验证

```python
def test_validate_attacks_success():
    attacks = [
        {"frame": 100, "buildingId": "b-001", "monsterId": "uuid-1", "damage": 10, "monsterPosition": [5, 5]},
        {"frame": 120, "buildingId": "b-001", "monsterId": "uuid-1", "damage": 10, "monsterPosition": [6, 5]},
    ]
    buildings = [{"id": "b-001", "type": "cannon", "level": 1, "position": [5, 4]}]
    result = {"totalDamageDealt": 20, "killedByType": {}}
    monsters_config = {"uuid-1": {"type": 0, "life": 50}}
    ok, err = validate_attacks(attacks, buildings, result, GAME_CONFIG["buildings"], GAME_CONFIG["map"], monsters_config)
    assert ok is True

def test_validate_attacks_invalid_monster_id():
    attacks = [
        {"frame": 100, "buildingId": "b-001", "monsterId": "fake-id", "damage": 10, "monsterPosition": [5, 5]},
    ]
    monsters_config = {"uuid-1": {"type": 0, "life": 50}}
    ok, err = validate_monster_ids(attacks, monsters_config)
    assert ok is False
    assert "不是服务端下发的 UUID" in err

def test_validate_cumulative_damage():
    attacks = [
        {"monsterId": "uuid-1", "damage": 30},
        {"monsterId": "uuid-1", "damage": 25},  # 累计 55 >= 50，应击杀
    ]
    result = {"killedByType": {0: 1}}
    monsters_config = {"uuid-1": {"type": 0, "life": 50}}
    ok, err = validate_cumulative_damage(attacks, result, monsters_config)
    assert ok is True
```

## API 视图

### POST /api/game/sessions

```python
# tests/test_views.py
@pytest.mark.django_db
def test_create_session(client):
    response = client.post("/api/game/sessions", content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert "sessionId" in data
    assert "config" in data
    assert "firstWave" in data
    assert data["firstWave"]["waveNumber"] == 1

@pytest.mark.django_db
def test_create_session_initial_state(client):
    response = client.post("/api/game/sessions", content_type="application/json")
    data = response.json()
    assert data["config"]["initial"]["money"] == 500
    assert data["config"]["initial"]["life"] == 100
```

### POST /api/game/sessions/wave

```python
@pytest.mark.django_db
def test_submit_wave_success(client, game_session):
    request_data = {
        "sessionId": str(game_session.id),
        "waveNumber": 1,
        "actions": [],
        "attacks": [],
        "result": {
            "killed": 3,
            "killedByType": {0: 3},
            "passed": 0,
            "moneyGained": 30,
            "scoreGained": 30,
            "lifeLost": 0,
            "totalDamageDealt": 150,
            "totalLifeDestroyed": 150,
            "waveDurationFrames": 1000,
        },
        "buildings": [],
    }
    response = client.post("/api/game/sessions/wave", data=request_data, content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert "serverState" in data
    assert "nextWave" in data

@pytest.mark.django_db
def test_submit_wave_validation_failed(client, game_session):
    request_data = {
        "sessionId": str(game_session.id),
        "waveNumber": 1,
        "actions": [],
        "attacks": [],
        "result": {
            "killed": 10,  # 错误值
            "killedByType": {0: 10},
            "passed": 0,
            "moneyGained": 100,
            "scoreGained": 100,
            "lifeLost": 0,
            "totalDamageDealt": 500,
            "totalLifeDestroyed": 500,
            "waveDurationFrames": 1000,
        },
        "buildings": [],
    }
    response = client.post("/api/game/sessions/wave", data=request_data, content_type="application/json")
    assert response.status_code == 400
    data = response.json()
    assert data["valid"] is False
    assert "error" in data

@pytest.mark.django_db
def test_submit_wave_session_not_found(client):
    request_data = {"sessionId": "00000000-0000-0000-0000-000000000000", "waveNumber": 1}
    response = client.post("/api/game/sessions/wave", data=request_data, content_type="application/json")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SESSION_NOT_FOUND"
```

### POST /api/game/sessions/end

```python
@pytest.mark.django_db
def test_end_session_success(client, game_session_with_waves):
    request_data = {
        "sessionId": str(game_session_with_waves.id),
        "nickname": "Player1",
        "lastWave": {
            "waveNumber": game_session_with_waves.wave_count + 1,
            "actions": [],
            "attacks": [],
            "result": {...},
            "buildings": [],
        },
    }
    response = client.post("/api/game/sessions/end", data=request_data, content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert data["verified"] is True
    assert "ranking" in data

@pytest.mark.django_db
def test_end_session_creates_leaderboard_entry(client, game_session_with_waves):
    # ... 提交结束请求
    assert LeaderboardEntry.objects.filter(nickname="Player1").exists()
```

### GET /api/game/leaderboard

```python
@pytest.mark.django_db
def test_get_leaderboard(client, leaderboard_entries):
    response = client.get("/api/game/leaderboard?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["entries"]) <= 10
    # 验证按分数降序
    scores = [e["score"] for e in data["entries"]]
    assert scores == sorted(scores, reverse=True)
```

## Fixtures

```python
# tests/conftest.py
import pytest
from game.models import GameSession, WaveRecord, LeaderboardEntry
from game.config import GAME_CONFIG
from game.generators import generate_wave

@pytest.fixture
def game_session(db):
    first_wave = generate_wave(1, 1.0)
    return GameSession.objects.create(
        money=500,
        life=100,
        difficulty=1.0,
        wave_count=0,
        buildings=[],
        config=GAME_CONFIG,
        next_wave=first_wave,
    )

@pytest.fixture
def game_session_with_waves(game_session):
    for i in range(1, 6):
        WaveRecord.objects.create(
            session=game_session,
            wave_number=i,
            killed=3,
            passed=0,
            score_gained=30,
            money_gained=30,
            life_lost=0,
            total_damage_dealt=150,
            wave_duration_frames=1000,
            money_spent=0,
            money_income=0,
            building_count=0,
            end_money=500 + i * 30,
            end_score=i * 30,
            end_life=100,
            end_difficulty=1.0,
        )
    game_session.wave_count = 5
    game_session.score = 150
    game_session.save()
    return game_session

@pytest.fixture
def leaderboard_entries(db):
    entries = []
    for i in range(20):
        entries.append(LeaderboardEntry.objects.create(
            nickname=f"Player{i}",
            score=1000 - i * 50,
            waves_completed=10 + i,
        ))
    return entries
```

## 注意事项

1. **服务端权威**：所有游戏配置和怪物属性由服务端定义，客户端不内置任何数值
2. **怪物 ID 生成**：每波次怪物必须由服务端生成唯一 UUID，用于后续验证
3. **验证顺序**：波次连续性 → Level 1 → Level 2 → Level 2+ → 更新状态 → Level 4
4. **事务处理**：波次提交应在数据库事务中完成，验证失败时回滚
5. **状态一致性**：GameSession 的状态必须与所有 WaveRecord 的累计结果一致
6. **会话清理**：定时任务每小时清理超过 24 小时的过期会话
