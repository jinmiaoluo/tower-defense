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

- P0 项目初始化: Django + DRF + PostgreSQL + pytest
- P0 数据模型: GameSession, WaveRecord, LeaderboardEntry
- P0 游戏配置: 建筑配置、怪物基础属性、地图配置
- P1 计算器 (TDD): calc_total_cost, process_actions, calc_new_difficulty, calc_monster_attrs, calc_actual_damage, calc_hit_score, calc_life_reward
- P1 波次生成器 (TDD): generate_wave, generate_first_wave
- P2 验证器 (TDD): Level 1, Level 2, Level 2+, Level 4
- P2 API 视图 (TDD): 创建会话, 提交波次, 游戏结束, 排行榜
- P3 管理命令: cleanup_sessions
- P3 部署配置: Docker, Gunicorn, Nginx

## 游戏配置

服务端内部使用完整的怪物配置（包含所有属性），API 响应时只返回部分属性：

- name: 服务端配置有，API config.monsters 有，API wave.monsters 无
- color: 服务端配置有，API config.monsters 有，API wave.monsters 无
- damage: 服务端配置有，API config.monsters 有，API wave.monsters 无
- life: 服务端配置有基础值，API config.monsters 无，API wave.monsters 有计算后的值
- speed: 服务端配置有基础值，API config.monsters 无，API wave.monsters 有计算后的值
- shield: 服务端配置有基础值，API config.monsters 无，API wave.monsters 有计算后的值
- money: 服务端配置有，API config.monsters 无，API wave.monsters 有

> **说明**：
> - `life/speed/shield` 会根据难度系数动态计算，因此在每波怪物配置中返回计算后的值
> - `damage` 是静态属性，不受难度影响，放在 `config.monsters` 中
> - 得分基于每次攻击伤害计算（`√伤害`），不再是怪物的固定属性

```python
# game/config.py
# 来源：旧实现 td-cfg-buildings.js

GAME_CONFIG = {
    "buildings": {
        "wall": {
            "name": "路障",
            "cost": 5,
            "damage": 0,
            "range": 0,
            "max_range": 0,
            "speed": 0,
            "bullet_speed": 0,
            "life": 100,
            "shield": 500,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
        "cannon": {
            "name": "炮台",
            "cost": 300,
            "damage": 12,
            "range": 4,
            "max_range": 8,
            "speed": 2,
            "bullet_speed": 6,
            "life": 100,
            "shield": 100,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
        "LMG": {
            "name": "轻机枪",
            "cost": 100,
            "damage": 5,
            "range": 5,
            "max_range": 10,
            "speed": 3,
            "bullet_speed": 6,
            "life": 100,
            "shield": 50,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
        "HMG": {
            "name": "重机枪",
            "cost": 800,
            "damage": 30,
            "range": 3,
            "max_range": 5,
            "speed": 3,
            "bullet_speed": 5,
            "life": 100,
            "shield": 200,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
        "laser_gun": {
            "name": "激光枪",
            "cost": 2000,
            "damage": 25,
            "range": 6,
            "max_range": 10,
            "speed": 20,
            "bullet_speed": 0,  # 激光瞬发
            "life": 100,
            "shield": 100,
            "upgradeCostRatio": 0.75,
            "sellRatio": 0.5,
        },
    },
    "monsters": {
        0: {"name": "普通怪", "life": 50, "speed": 3, "max_speed": 10, "shield": 0, "damage": 1, "money": 5, "color": "#00ff00"},
        1: {"name": "稍强怪", "life": 50, "speed": 6, "max_speed": 20, "shield": 1, "damage": 2, "money": 8, "color": "#33ff33"},
        2: {"name": "速度怪", "life": 50, "speed": 12, "max_speed": 30, "shield": 1, "damage": 3, "money": 10, "color": "#66ff66"},
        3: {"name": "血量怪", "life": 500, "speed": 5, "max_speed": 10, "shield": 1, "damage": 3, "money": 50, "color": "#ff0000"},
        4: {"name": "护盾怪", "life": 50, "speed": 5, "max_speed": 10, "shield": 20, "damage": 3, "money": 30, "color": "#0000ff"},
        5: {"name": "伤害怪", "life": 50, "speed": 7, "max_speed": 14, "shield": 2, "damage": 10, "money": 25, "color": "#ff00ff"},
        6: {"name": "速度血量怪", "life": 100, "speed": 15, "max_speed": 30, "shield": 3, "damage": 3, "money": 35, "color": "#ffff00"},
        7: {"name": "极速怪", "life": 30, "speed": 30, "max_speed": 40, "shield": 1, "damage": 4, "money": 20, "color": "#00ffff"},
        8: {"name": "护盾血量怪", "life": 300, "speed": 3, "max_speed": 10, "shield": 15, "damage": 5, "money": 60, "color": "#ff6600"},
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
# 来源：旧实现 td-data-stage-1.js:184-250
# 前 10 波只使用 type 0/1/2 三种基础怪物，难度渐进
PREDEFINED_WAVES = {
    1: [{"type": 0, "count": 1}],
    2: [{"type": 0, "count": 1}, {"type": 1, "count": 1}],
    3: [{"type": 0, "count": 2}, {"type": 1, "count": 1}],
    4: [{"type": 0, "count": 2}, {"type": 1, "count": 1}],
    5: [{"type": 0, "count": 3}, {"type": 1, "count": 2}],
    6: [{"type": 0, "count": 4}, {"type": 1, "count": 2}],
    7: [{"type": 0, "count": 5}, {"type": 1, "count": 3}, {"type": 2, "count": 1}],
    8: [{"type": 0, "count": 6}, {"type": 1, "count": 4}, {"type": 2, "count": 1}],
    9: [{"type": 0, "count": 7}, {"type": 1, "count": 3}, {"type": 2, "count": 2}],
    10: [{"type": 0, "count": 8}, {"type": 1, "count": 4}, {"type": 2, "count": 3}],
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

根据上一波受伤情况计算新难度。第 1 波（教学波）不调整难度。

```python
def test_calc_new_difficulty_wave_1_no_adjustment():
    # Wave 1 不调整难度
    assert calc_new_difficulty(1.0, 0, 1) == 1.0
    assert calc_new_difficulty(2.0, 50, 1) == 2.0

def test_calc_new_difficulty_no_damage_early():
    assert calc_new_difficulty(1.0, 0, 3) == 1.05

def test_calc_new_difficulty_no_damage_late():
    assert calc_new_difficulty(1.0, 0, 10) == 1.2

def test_calc_new_difficulty_no_damage_high_difficulty():
    # 高难度（> 30）时减缓增长
    assert calc_new_difficulty(31.0, 0, 5) == 34.1  # 31 * 1.1

def test_calc_new_difficulty_heavy_damage():
    assert calc_new_difficulty(2.0, 50, 5) == 1.2  # 2.0 * 0.6

def test_calc_new_difficulty_min_value():
    assert calc_new_difficulty(0.5, 50, 5) == 1.0  # 不低于 1.0
```

### calc_monster_attrs

基于难度系数计算怪物实际属性。

约束条件（来源：旧实现 `td-obj-monster.js:27-36`）：
- `speed`: 最小值 1，最大值 `max_speed`（如有）
- `life`: 最小值 1
- `shield`: 最小值 0

```python
def test_calc_monster_attrs_default_difficulty():
    base = {"life": 50, "speed": 3, "shield": 0, "money": 10}
    result = calc_monster_attrs(base, 1.0)
    assert result["life"] == 50   # 50 * (1+1) * 0.5 = 50
    assert result["speed"] == 3.5  # 3 + 1.0/2
    assert result["shield"] == 0   # 0 + 1.0/2 = 0.5 -> int = 0

def test_calc_monster_attrs_high_difficulty():
    base = {"life": 50, "speed": 3, "shield": 0, "money": 10}
    result = calc_monster_attrs(base, 3.0)
    assert result["life"] == 100  # 50 * (3+1) * 0.5 = 100
    assert result["speed"] == 4.5  # 3 + 3.0/2

def test_calc_monster_attrs_max_speed_limit():
    # 极速怪 base speed=30, max_speed=40, difficulty=30.0
    # 计算速度 = 30 + 30/2 = 45，被 max_speed 限制为 40
    base = {"life": 30, "speed": 30, "max_speed": 40, "shield": 1, "money": 20}
    result = calc_monster_attrs(base, 30.0)
    assert result["speed"] == 40

def test_calc_monster_attrs_min_values():
    # 极端情况：验证最小值约束
    base = {"life": 1, "speed": 0, "max_speed": 10, "shield": -5, "money": 10}
    result = calc_monster_attrs(base, 0.0)
    assert result["speed"] == 1   # 最小值 1
    assert result["life"] == 1    # 最小值 1
    assert result["shield"] == 0  # 最小值 0
```

### calc_actual_damage

计算实际伤害（考虑护盾减伤和最低伤害）。

```python
# game/calculators.py
def calc_actual_damage(raw_damage: int, shield: int) -> int:
    """计算实际伤害 = max(原始伤害 - 护盾, 原始伤害 × 0.1)"""
    min_damage = math.ceil(raw_damage * 0.1)
    return max(raw_damage - shield, min_damage)
```

```python
# tests/test_calculators.py
def test_calc_actual_damage_no_shield():
    assert calc_actual_damage(12, 0) == 12

def test_calc_actual_damage_with_shield():
    assert calc_actual_damage(12, 5) == 7  # 12 - 5 = 7

def test_calc_actual_damage_high_shield():
    # 护盾高于伤害时，使用最低伤害（10%）
    assert calc_actual_damage(12, 20) == 2  # ceil(12 * 0.1) = 2

def test_calc_actual_damage_min_damage():
    # 最低伤害保证高攻武器对高护盾怪有效
    assert calc_actual_damage(30, 100) == 3  # ceil(30 * 0.1) = 3
```

### calc_hit_score

计算命中得分（每次攻击命中时累加）。

```python
# game/calculators.py
def calc_hit_score(actual_damage: int) -> int:
    """计算命中得分 = floor(√实际伤害)"""
    return int(math.sqrt(actual_damage))
```

```python
# tests/test_calculators.py
def test_calc_hit_score_basic():
    assert calc_hit_score(1) == 1   # √1 = 1
    assert calc_hit_score(4) == 2   # √4 = 2
    assert calc_hit_score(9) == 3   # √9 = 3

def test_calc_hit_score_floor():
    assert calc_hit_score(10) == 3  # √10 ≈ 3.16 -> 3
    assert calc_hit_score(15) == 3  # √15 ≈ 3.87 -> 3

def test_calc_hit_score_high_damage():
    assert calc_hit_score(100) == 10  # √100 = 10
```

> **设计说明**：得分在每次攻击命中时累加（`√伤害`），而非击杀时加分。这使高攻速武器（如激光枪）在得分上更有价值。

### calc_life_reward

计算波次生命奖励。

```python
# game/calculators.py
def calc_life_reward(wave: int) -> int:
    """计算波次生命奖励

    - 每 10 波: +10 生命
    - 每 5 波（非 10 的倍数）: +5 生命
    - 其他: 0
    """
    if wave % 10 == 0:
        return 10
    elif wave % 5 == 0:
        return 5
    return 0
```

```python
# tests/test_calculators.py
def test_calc_life_reward_normal_wave():
    assert calc_life_reward(1) == 0
    assert calc_life_reward(3) == 0
    assert calc_life_reward(7) == 0

def test_calc_life_reward_every_5_waves():
    assert calc_life_reward(5) == 5
    assert calc_life_reward(15) == 5
    assert calc_life_reward(25) == 5

def test_calc_life_reward_every_10_waves():
    # 10 的倍数返回 10（覆盖 5 的规则）
    assert calc_life_reward(10) == 10
    assert calc_life_reward(20) == 10
    assert calc_life_reward(30) == 10
```

### calc_final_score

计算游戏结束时的最终得分（P2 阶段实现）。

```python
# game/calculators.py
def calc_final_score(
    accumulated_score: int,
    waves_completed: int,
    remaining_life: int,
    remaining_money: int,
    score_config: dict,
) -> int:
    """计算最终得分

    最终得分 = 累计命中得分 + 波次奖励 + 剩余生命奖励 + 剩余金币奖励
    """
    wave_bonus = waves_completed * score_config["wave_coefficient"]
    life_bonus = remaining_life * score_config["life_coefficient"]
    money_bonus = int(remaining_money * score_config["money_coefficient"])
    return accumulated_score + wave_bonus + life_bonus + money_bonus
```

```python
# tests/test_calculators.py
def test_calc_final_score():
    score_config = {
        "wave_coefficient": 10,
        "life_coefficient": 5,
        "money_coefficient": 0.1,
    }
    # 累计 1000 分 + 10 波 × 10 + 50 生命 × 5 + 200 金币 × 0.1
    # = 1000 + 100 + 250 + 20 = 1370
    result = calc_final_score(1000, 10, 50, 200, score_config)
    assert result == 1370
```

## 波次生成器

### generate_wave

生成指定波次的怪物配置。

**确定性轮询算法**（波次 11+）：

与旧实现的随机算法不同，新实现使用确定性轮询算法：
- 组大小按 1→2→3→1→2→3... 循环
- 怪物类型按 0→1→2→...→8→0→1... 轮询
- 相同的 (wave_number, difficulty) 输入始终产生相同的配置输出

这确保服务端可以独立重建波次配置用于验证，无需存储完整的怪物列表。

```python
# tests/test_generators.py
def test_generate_wave_predefined():
    wave = generate_wave(1, 1.0)
    assert wave["waveNumber"] == 1
    assert len(wave["monsters"]) == 1  # 第一波只有 1 个怪物
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

> 伤害和得分计算规则见上方 `calc_actual_damage` 和 `calc_hit_score` 计算器。

### Level 1：基础验证

```python
# tests/test_validators.py
def test_validate_basic_success():
    result = {
        "killed": 3,
        "killedByType": {0: 3},
        "passed": 0,
        "moneyGained": 30,
        "totalDamageDealt": 150,
    }
    wave_config = {
        "monsters": [{"type": 0, "count": 3, "money": 10, "life": 50}]
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
        "totalDamageDealt": 150,
    }
    wave_config = {
        "monsters": [{"type": 0, "count": 3, "money": 10, "life": 50}]
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
    # 攻击事件包含原始目标和实际命中信息（支持"误伤"机制）
    attacks = [
        {
            "frame": 100,
            "buildingId": "b-001",
            "originalTargetId": "uuid-1",           # 发射时瞄准的目标
            "originalTargetPosition": [5, 5],       # 发射时目标位置（用于射程验证）
            "monsterId": "uuid-1",                  # 实际命中的怪物
            "monsterPosition": [5, 5],              # 命中时怪物位置
            "damage": 10,
        },
        {
            "frame": 120,
            "buildingId": "b-001",
            "originalTargetId": "uuid-1",
            "originalTargetPosition": [6, 5],
            "monsterId": "uuid-1",
            "monsterPosition": [6, 5],
            "damage": 10,
        },
    ]
    buildings = [{"id": "b-001", "type": "cannon", "level": 1, "position": [5, 4]}]
    result = {"totalDamageDealt": 20, "killedByType": {}}
    monsters_config = {"uuid-1": {"type": 0, "life": 50}}
    ok, err = validate_attacks(attacks, buildings, result, GAME_CONFIG["buildings"], GAME_CONFIG["map"], monsters_config)
    assert ok is True

def test_validate_attacks_friendly_fire():
    # 测试"误伤"场景：瞄准 uuid-1，但命中了 uuid-2
    attacks = [
        {
            "frame": 100,
            "buildingId": "b-001",
            "originalTargetId": "uuid-1",           # 原始目标在射程内
            "originalTargetPosition": [5, 5],
            "monsterId": "uuid-2",                  # 实际命中了其他怪物
            "monsterPosition": [7, 7],              # 可能在射程外（允许）
            "damage": 10,
        },
    ]
    buildings = [{"id": "b-001", "type": "cannon", "level": 1, "position": [5, 4]}]
    result = {"totalDamageDealt": 10, "killedByType": {}}
    monsters_config = {"uuid-1": {"type": 0, "life": 50}, "uuid-2": {"type": 0, "life": 50}}
    # 只验证 originalTargetPosition 在射程内，不验证 monsterPosition
    ok, err = validate_attacks(attacks, buildings, result, GAME_CONFIG["buildings"], GAME_CONFIG["map"], monsters_config)
    assert ok is True

def test_validate_attacks_invalid_monster_id():
    attacks = [
        {
            "frame": 100,
            "buildingId": "b-001",
            "originalTargetId": "fake-id",
            "originalTargetPosition": [5, 5],
            "monsterId": "fake-id",
            "monsterPosition": [5, 5],
            "damage": 10,
        },
    ]
    monsters_config = {"uuid-1": {"type": 0, "life": 50}}
    ok, err = validate_monster_ids(attacks, monsters_config)
    assert ok is False
    assert "不是服务端下发的 UUID" in err

def test_validate_cumulative_damage():
    attacks = [
        {"monsterId": "uuid-1", "damage": 30, "originalTargetId": "uuid-1", "originalTargetPosition": [3, 3], "monsterPosition": [3, 3]},
        {"monsterId": "uuid-1", "damage": 25, "originalTargetId": "uuid-1", "originalTargetPosition": [4, 4], "monsterPosition": [4, 4]},  # 累计 55 >= 50，应击杀
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
