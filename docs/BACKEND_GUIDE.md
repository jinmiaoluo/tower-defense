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

详见 [ARCHITECTURE.md](./ARCHITECTURE.md#目录结构)。

## 开发优先级

- P0 项目初始化: Django + DRF + PostgreSQL + pytest
- P0 数据模型: GameSession, WaveRecord, LeaderboardEntry
- P0 游戏配置: 建筑配置、怪物基础属性、地图配置
- P1 计算器 (TDD): calc_total_cost, process_actions, build_validation_buildings, calc_new_difficulty, calc_monster_attrs, calc_actual_damage, calc_hit_score, calc_life_reward
- P1 波次生成器 (TDD): generate_wave, generate_first_wave
- P2 验证器 (TDD): Level 1, Level 2, Level 2+, Level 4
- P2 API 视图 (TDD): 创建会话, 提交波次, 游戏结束, 排行榜
- P3 管理命令: cleanup_sessions
- P3 部署配置: Docker, Gunicorn, Nginx

## 游戏配置

配置定义在 `game/config.py`，包含 `buildings`、`monsters`、`map`、`initial` 四个部分。

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

## 核心计算器

详细测试用例见 `tests/test_calculators.py`。

### calc_total_cost

计算建筑累计花费（建造 + 所有升级）。

公式：`累计花费 = 建造成本 + Σ(上一级累计花费 × upgradeCostRatio)`

### process_actions

处理建筑操作序列，计算花费和收入。

操作类型：
- BUILD: 花费 = 建造成本
- UPGRADE: 花费 = 当前累计花费 × upgradeCostRatio
- SELL: 收入 = 累计花费 × sellRatio

### calc_new_difficulty

根据上一波受伤情况计算新难度。

规则：
- Wave 1（教学波）不调整难度
- 无伤害时难度增加（早期 +5%~20%，高难度时 +10%）
- 受伤害时难度降低（最多降至 60%）
- 最低难度为 1.0

### calc_monster_attrs

基于难度系数计算怪物实际属性。

公式：
- `life = base_life × (difficulty + 1) × 0.5`
- `speed = base_speed + difficulty / 2`（上限为 max_speed）
- `shield = base_shield + difficulty / 2`

约束条件：
- speed: 最小值 1，最大值 max_speed
- life: 最小值 1
- shield: 最小值 0

### calc_actual_damage

计算实际伤害（考虑护盾减伤和最低伤害）。

公式：`实际伤害 = max(原始伤害 - 护盾, 原始伤害 × 0.1)`

### calc_hit_score

计算命中得分（每次攻击命中时累加）。

公式：`得分 = floor(√实际伤害)`

> **设计说明**：得分在每次攻击命中时累加，而非击杀时加分。这使高攻速武器（如激光枪）在得分上更有价值。

### calc_life_reward

计算波次生命奖励。

规则：
- 每 10 波: +10 生命
- 每 5 波（非 10 的倍数）: +5 生命
- 其他: 0

## 波次生成器

详细测试用例见 `tests/test_generators.py`。

### generate_wave

生成指定波次的怪物配置。

**波次 1-10**：使用 `PREDEFINED_WAVES` 预定义配置。

**波次 11+**：使用确定性轮询算法：
- 组大小按 1→2→3→1→2→3... 循环
- 怪物类型按 0→1→2→...→8→0→1... 轮询
- 怪物数量 = min(wave^1.1, 100)
- 相同的 (wave_number, difficulty) 输入始终产生相同的配置输出

> **设计说明**：确定性算法确保服务端可以独立重建波次配置用于验证，无需存储完整的怪物列表。

## 验证器

详细测试用例见 `tests/test_validators.py`。

伤害和得分计算规则见上方 `calc_actual_damage` 和 `calc_hit_score` 计算器。

### Level 1: 基础验证

验证内容：
- killed + passed + remaining = 波次怪物总数
- killedByType 各类型击杀数 = 该类型怪物数量
- moneyGained = Σ(被击杀怪物的 money)
- spawned <= 波次怪物总数（提前结束场景）

### Level 2: 伤害验证

验证内容：
- totalLifeDestroyed = Σ(被击杀怪物的 life)
- totalDamageDealt <= 理论最大 DPS × waveDurationFrames

### Level 2+: 攻击事件验证

验证内容：
- 每个攻击事件的 monsterId 必须是服务端下发的 UUID
- originalTargetPosition 必须在建筑射程内（发射时验证）
- 累计伤害 >= 怪物生命值时，怪物必须在 killedByType 中
- remaining 怪物的 ID 必须有效且累计伤害 < 生命值

> **误伤机制**：只验证 originalTargetPosition 在射程内，不验证实际命中位置（允许子弹命中其他怪物）。

> **存储策略**：`remaining_monster_ids` 只用于验证，验证通过后只存储 `remaining` 数量到 `WaveRecord`，ID 列表不持久化。

## API 视图

详细测试用例见 `tests/test_views.py`。

### POST /api/game/sessions

创建新游戏会话，返回 sessionId、config 和 firstWave。

### POST /api/game/sessions/wave

提交波次数据，验证后返回 serverState 和 nextWave。

### POST /api/game/sessions/end

结束游戏，支持两种模式：
- 带 lastWave: 提交最后一波数据并结束（正常结束）
- 不带 lastWave: 直接结束游戏（提前结束）

**排行榜最低要求**：最终得分必须大于 0，0 分不能上榜。

### GET /api/game/leaderboard

获取排行榜，支持 limit 参数，按分数降序返回。

## CORS 跨域配置

开发环境默认允许以下源:
- `http://localhost:8080`
- `http://127.0.0.1:8080`

环境变量配置:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
CSRF_TRUSTED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
```

生产环境需要配置实际的前端域名。

## 认证配置

游戏 API 不使用用户认证，因此禁用了 DRF 的默认认证类。

这意味着:
- API 请求无需携带 CSRF token
- 游戏会话通过 sessionId（UUID）标识，而非用户会话
- 防作弊依赖服务端验证逻辑，而非认证机制

## 注意事项

1. **服务端权威**：所有游戏配置和怪物属性由服务端定义，客户端不内置任何数值
2. **怪物 ID 生成**：每波次怪物必须由服务端生成唯一 UUID，用于后续验证
3. **验证顺序**：波次连续性 → Level 1 → Level 2 → Level 2+ → 更新状态 → Level 4
4. **事务处理**：波次提交应在数据库事务中完成，验证失败时回滚
5. **状态一致性**：GameSession 的状态必须与所有 WaveRecord 的累计结果一致
6. **会话清理**：定时任务每小时清理超过 24 小时的过期会话
7. **跨域配置**：开发环境默认允许 localhost:8080，生产环境需要配置实际域名
