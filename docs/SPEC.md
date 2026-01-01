# 塔防游戏技术规范

本文档描述基于 Vue 3 + Phaser 3 重写的塔防游戏核心流程，包含防作弊验证机制。

---

## 目录

1. [项目目标](#项目目标)
2. [游戏规则](#游戏规则)
3. [技术栈](#技术栈)
4. [整体架构](#整体架构)
5. [游戏生命周期](#游戏生命周期)
6. [API 定义](#api-定义)
7. [客户端数据记录](#客户端数据记录)
8. [服务端验证逻辑](#服务端验证逻辑)
9. [错误处理](#错误处理)
10. [会话管理](#会话管理)
11. [前端开发指南](#前端开发指南)

---

## 项目目标

1. 使用现代前端技术栈（Vue 3 + Phaser 3 + TypeScript）重构原游戏
2. 实现现代后端技术栈（Django + DRF + PostgreSQL）实现结果验证和积分排行榜
3. 保持原游戏的核心玩法和数值体系
4. 添加与后端交互的排行榜功能

---

## 游戏规则

### 基础设定

| 配置项 | 值 |
|--------|-----|
| 游戏类型 | 固定路径塔防（无限模式） |
| 地图规格 | 16×16 格子 |
| 格子大小 | 32px |
| 帧率 | 60 FPS |
| 入口 | 左上角 (0, 0) |
| 出口 | 右下角 (15, 15) |

### 怪物系统

#### 怪物属性

| 属性 | 说明 |
|------|------|
| life | 生命值 |
| speed | 移动速度（1-40） |
| max_speed | 最大速度 |
| shield | 护盾值（减伤） |
| damage | 到达终点造成的伤害（1-10） |
| money | 击杀奖励金币 |

#### 怪物类型（9 种）

| 索引 | 名称 | 生命值 | 速度 | 护盾 | 伤害 | 特点 |
|------|------|--------|------|------|------|------|
| 0 | 普通怪 | 50 | 3 | 0 | 1 | 最弱小的怪物 |
| 1 | 稍强怪 | 50 | 6 | 1 | 2 | 稍强一些 |
| 2 | 速度怪 | 50 | 12 | 1 | 3 | 速度较快 |
| 3 | 血量怪 | 500 | 5 | 1 | 3 | 生命值很高 |
| 4 | 护盾怪 | 50 | 5 | 20 | 3 | 防御很强 |
| 5 | 伤害怪 | 50 | 7 | 2 | 10 | 到达终点伤害高 |
| 6 | 速度血量怪 | 100 | 15 | 3 | 3 | 速度、生命都较高 |
| 7 | 极速怪 | 30 | 30 | 1 | 4 | 速度很快 |
| 8 | 护盾血量怪 | 300 | 3 | 15 | 5 | 防御强、生命高 |

#### 波次生成规则

- 同一类型怪物单波最多出现 3 个
- 波次 1-10 使用预定义配置
- 波次 11+ 自动生成，怪物数量 = min(wave^1.1, 100)
- 波次间隔：60 FPS × 3 = 180 帧

#### 难度动态调整

```
如果上波未造成伤害：
  - wave < 5: difficulty × 1.05
  - difficulty > 30: difficulty × 1.1
  - 其他: difficulty × 1.2

如果上波造成伤害：
  - >= 50 点: difficulty × 0.6
  - >= 30 点: difficulty × 0.7
  - >= 20 点: difficulty × 0.8
  - >= 10 点: difficulty × 0.9
  - < 10 点且 wave >= 10: difficulty × 1.05

difficulty 最小值为 1
```

### 防御塔系统

#### 塔属性

| 属性 | 说明 |
|------|------|
| damage | 攻击力 |
| range | 最小攻击范围（格子数） |
| max_range | 最大攻击范围 |
| speed | 攻击速度 |
| bullet_speed | 子弹速度 |
| life | 塔的生命值 |
| shield | 塔的护盾值 |
| cost | 建造费用 |

#### 塔类型（5 种）

| 类型 | 名称 | 攻击力 | 范围 | 攻速 | 造价 | 特点 |
|------|------|--------|------|------|------|------|
| wall | 路障 | 0 | 0 | 0 | 5 | 阻挡路径，不攻击 |
| cannon | 炮台 | 12 | 4-8 | 2 | 300 | 平衡型 |
| LMG | 轻机枪 | 5 | 5-10 | 3 | 100 | 低攻击，大范围，经济型 |
| HMG | 重机枪 | 30 | 3-5 | 3 | 800 | 高攻击，小范围 |
| laser_gun | 激光枪 | 25 | 6-10 | 20 | 2000 | 高速攻击，高造价 |

#### 升级机制

| 塔类型 | 升级规则 |
|--------|----------|
| 默认 | 每级属性 × 1.2 |
| cannon（炮台） | 1-10 级 × 1.2，11 级起 × 1.3 |
| HMG（重机枪） | 每级 × 1.3 |

### 经济系统

| 配置项 | 值 |
|--------|-----|
| 初始金币 | 500 |
| 初始生命 | 100 |
| 击杀奖励 | 根据怪物配置（monster.money 或按公式计算） |

**波次奖励**：

| 条件 | 奖励 |
|------|------|
| 每 5 波 | +5 生命（不超过 100） |
| 每 10 波 | +10 生命（不超过 100） |

### 胜负条件

| 条件 | 结果 |
|------|------|
| 生命值降为 0 | 失败 |
| 无限模式 | 无胜利条件 |

### 得分计算

```
最终得分 = 击杀得分 + 波次奖励 + 剩余生命奖励 + 剩余金币奖励

击杀得分 = Σ(怪物基础分 × 难度系数)
波次奖励 = 完成波次数 × 波次系数
剩余生命 = 剩余生命 × 生命系数
剩余金币 = 剩余金币 × 金币系数
```

---

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5 | UI 框架 |
| Phaser | 3.90 | 游戏引擎 |
| Vite | 7.2 | 构建工具 |
| TypeScript | 5 | 开发语言 |
| Pinia | 3.0 | 状态管理 |
| Axios | 1.13 | HTTP 客户端 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.13 | 开发语言 |
| Django | 5.2 | Web 框架 |
| Django REST Framework | 3.16 | API 框架 |
| PostgreSQL | 15 | 数据库 |
| pytest + pytest-django | - | 测试框架 |
| Docker + Gunicorn | - | 部署 |

---

## 整体架构

### 设计原则

- **服务端权威**：怪物属性、建筑属性、波次配置由服务端定义
- **客户端零配置**：客户端不内置任何游戏配置和默认状态，所有数值均从服务端获取
- **客户端执行**：游戏逻辑在客户端执行，服务端验证结果
- **批量提交**：每波结束时批量提交，而非实时上传
- **渐进验证**：每波验证一次，而非游戏结束时一次性验证

### 验证方案

采用 Level 1 + 2 + 4 验证架构：

| 层级 | 名称 | 验证内容 |
|------|------|----------|
| Level 1 | 基础验证 | 收益上限、成本验证、数量一致性 |
| Level 2 | 伤害验证 | 生命池验证、DPS 容量验证、攻击次数验证 |
| Level 3 | 行为重放 | 服务端根据操作序列重新模拟，对比结果 |
| Level 4 | 统计分析 | 击杀率异常、资源效率异常、历史对比 |

> **为何跳过 Level 3？** 开发和计算成本高。Level 1 + 2 + 4 已能覆盖大部分作弊场景。

---

## 游戏生命周期

### 流程概览

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 页面加载  │───▶│ 放置建筑  │───▶│ 波次进行  │───▶│ 游戏结束  │
│ 创建会话  │    │ 开始动画  │    │ 提交验证  │    │ 提交排名  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
POST /sessions    无请求     POST /sessions/wave  POST /sessions/end
```

### 详细时序

```
┌────────┐                                    ┌────────┐
│ Client │                                    │ Server │
└───┬────┘                                    └───┬────┘
    │                                             │
    │  ══════════ 页面加载 ══════════             │
    │                                             │
    │  POST /api/game/sessions                    │
    │────────────────────────────────────────────▶│
    │                                             │ 创建会话
    │  {sessionId, config, firstWave}             │
    │◀────────────────────────────────────────────│
    │                                             │
    │  ┌─────────────────────────────┐            │
    │  │ 渲染地图、建筑面板           │            │
    │  │ 显示 config.initial 中的状态 │            │
    │  └─────────────────────────────┘            │
    │                                             │
    │  ══════════ 放置第一个建筑 ══════════       │
    │  （前端本地处理，无网络请求）                │
    │                                             │
    │  ┌─────────────────────────────┐            │
    │  │ 扣除金钱、放置建筑           │            │
    │  │ 开始游戏动画                 │            │
    │  │ 生成第一波怪物               │            │
    │  │ 记录操作到本地               │            │
    │  └─────────────────────────────┘            │
    │                                             │
    │  ══════════ 第 1 波结束 ══════════          │
    │                                             │
    │  POST /api/game/sessions/wave               │
    │  {sessionId, waveNumber, actions,           │
    │   result, buildings}                        │
    │────────────────────────────────────────────▶│
    │                                             │ 验证数据
    │  {valid, serverState, nextWave}             │
    │◀────────────────────────────────────────────│
    │                                             │
    │  ┌─────────────────────────────┐            │
    │  │ 同步服务端状态               │            │
    │  │ 准备下一波怪物               │            │
    │  └─────────────────────────────┘            │
    │                                             │
    │  ══════════ 第 2 ~ N 波 ══════════          │
    │        （重复上述流程）                      │
    │                                             │
    │  ══════════ 游戏结束 ══════════             │
    │                                             │
    │  ┌─────────────────────────────┐            │
    │  │ 显示 Game Over               │            │
    │  │ 弹出昵称输入框               │            │
    │  └─────────────────────────────┘            │
    │                                             │
    │  POST /api/game/sessions/end                 │
    │  {sessionId, nickname, lastWave}            │
    │────────────────────────────────────────────▶│
    │                                             │ 最终验证
    │  {verified, ranking}                        │ 记录排行榜
    │◀────────────────────────────────────────────│
    │                                             │
    │  ┌─────────────────────────────┐            │
    │  │ 显示排行榜和本次排名         │            │
    │  └─────────────────────────────┘            │
    │                                             │
```

---

## API 定义

### 概览

| API | 方法 | 时机 | 说明 |
|-----|------|------|------|
| `/api/game/sessions` | POST | 页面加载 | 创建会话，返回配置和第一波 |
| `/api/game/sessions/wave` | POST | 每波结束 | 提交结果，返回下一波 |
| `/api/game/sessions/end` | POST | 游戏结束 | 提交最后一波并结束，返回排名 |
| `/api/game/leaderboard` | GET | 查看排行榜 | 获取排行榜列表 |

---

### POST /api/game/sessions

创建游戏会话，返回配置和第一波怪物。

#### 请求

无参数（空 body）。

#### 响应

```typescript
interface GameStartResponse {
  sessionId: string;

  config: {
    buildings: {
      [type: string]: {
        name: string;              // 显示名称
        cost: number;              // 建造成本
        damage: number;            // 基础伤害
        range: number;             // 攻击范围（格子数）
        speed: number;             // 攻击间隔（帧）
        upgradeCostRatio: number;  // 升级成本比例
        sellRatio: number;         // 出售回收比例
      }
    };

    monsters: {
      [typeId: number]: {
        name: string;
        color: string;
      }
    };

    map: {
      width: number;               // 地图宽度（格子数）
      height: number;              // 地图高度（格子数）
      entrance: [number, number];  // 入口坐标
      exit: [number, number];      // 出口坐标
      obstacles: [number, number][];
    };

    initial: {
      money: number;               // 初始金钱（服务端配置）
      life: number;                // 初始生命（服务端配置，上限 100）
      difficulty: number;          // 初始难度系数（默认 1.0）
    };
  };

  firstWave: {
    waveNumber: 1;
    monsters: Array<{
      id: string;                  // 怪物唯一 ID（服务端生成的 UUID）
      type: number;                // 怪物类型（0-8）
      life: number;
      speed: number;
      shield: number;
      money: number;               // 击杀获得金钱
      score: number;               // 击杀获得分数
    }>;
  };
}
```

---

### POST /api/game/sessions/wave

提交波次结果，获取下一波配置。

#### 请求

```typescript
interface WaveRequest {
  sessionId: string;
  waveNumber: number;

  // 本波所有建筑操作（cost/income 由服务端计算）
  actions: Array<{
    type: 'BUILD' | 'UPGRADE' | 'SELL';
    frame: number;                 // 操作发生的帧号
    buildingType?: string;         // BUILD 时的建筑类型
    buildingId: string;            // 建筑唯一 ID
    position?: [number, number];   // BUILD 时的位置
    level?: number;                // UPGRADE 后的等级
  }>;

  // 本波所有攻击事件
  attacks: Array<{
    frame: number;                 // 攻击帧号
    buildingId: string;            // 建筑 ID
    monsterId: string;             // 怪物 ID（使用服务端下发的 UUID）
    damage: number;                // 实际伤害
    monsterPosition: [number, number];  // 怪物所在格子 [x, y]
  }>;

  // 战斗结果
  result: {
    killed: number;                // 击杀怪物总数
    killedByType: Record<number, number>;  // 每种怪物的击杀数 {typeId: count}
    passed: number;                // 穿过终点的怪物数
    scoreGained: number;           // 获得分数
    moneyGained: number;           // 获得金钱
    lifeLost: number;              // 损失生命
    totalDamageDealt: number;      // 总伤害输出
    totalLifeDestroyed: number;    // 击杀怪物的总生命值
    waveDurationFrames: number;    // 波次持续帧数
  };

  // 当前建筑列表
  buildings: Array<{
    id: string;
    type: string;
    position: [number, number];
    level: number;
    damageDealt: number;           // 本波造成的伤害
    kills: number;                 // 本波击杀数
  }>;
}
```

#### 响应

```typescript
interface WaveResponse {
  valid: boolean;

  // 服务端计算的状态（用于同步）
  serverState: {
    money: number;
    score: number;
    life: number;
    difficulty: number;              // 当前难度系数（影响下一波怪物属性）
  };

  // 下一波配置（游戏继续时返回）
  nextWave?: {
    waveNumber: number;
    monsters: Array<{
      id: string;                  // 怪物唯一 ID（服务端生成的 UUID）
      type: number;                // 怪物类型（0-8）
      life: number;
      speed: number;
      shield: number;
      money: number;
      score: number;
    }>;
    lifeReward?: number;           // 生命恢复奖励，下一波开始前应用（每 5 波 +5，每 10 波 +10，上限 100）
  };

  // 验证失败时返回
  error?: {
    code: string;
    message: string;
  };
}
```

---

### POST /api/game/sessions/end

提交游戏最终结果（含最后一波数据），获取排名。

#### 请求

```typescript
interface GameEndRequest {
  sessionId: string;
  nickname: string;

  // 最后一波数据（与 WaveRequest 结构相同）
  lastWave: {
    waveNumber: number;
    actions: Array<{
      type: 'BUILD' | 'UPGRADE' | 'SELL';
      frame: number;
      buildingType?: string;
      buildingId: string;
      position?: [number, number];
      level?: number;
    }>;
    attacks: Array<{
      frame: number;
      buildingId: string;
      monsterId: string;             // 使用服务端下发的 UUID
      damage: number;
      monsterPosition: [number, number];
    }>;
    result: {
      killed: number;
      killedByType: Record<number, number>;
      passed: number;
      scoreGained: number;
      moneyGained: number;
      lifeLost: number;
      totalDamageDealt: number;
      totalLifeDestroyed: number;
      waveDurationFrames: number;
    };
    buildings: Array<{
      id: string;
      type: string;
      position: [number, number];
      level: number;
      damageDealt: number;
      kills: number;
    }>;
  };
}
```

#### 响应

```typescript
interface GameEndResponse {
  verified: boolean;

  // 排名信息
  ranking?: {
    rank: number;                  // 本次排名
    total: number;                 // 总参与人数
    isNewRecord: boolean;          // 是否创造新纪录
  };

  // 验证失败时返回
  error?: {
    code: string;
    message: string;
  };
}
```

---

### GET /api/game/leaderboard

获取排行榜列表。

#### 请求

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | number | 否 | 返回条数，默认 10，最大 100 |

#### 响应

```typescript
interface LeaderboardResponse {
  entries: Array<{
    rank: number;                  // 排名（从 1 开始）
    nickname: string;              // 玩家昵称
    score: number;                 // 最终得分
    wavesCompleted: number;        // 完成波次数
    createdAt: string;             // 记录时间（ISO 8601）
  }>;
}
```

---

## 客户端数据记录

### 记录时机

| 事件 | 记录内容 | 时机 |
|------|----------|------|
| 建造建筑 | type, frame, buildingType, buildingId, position | 立即记录 |
| 升级建筑 | type, frame, buildingId, level | 立即记录 |
| 出售建筑 | type, frame, buildingId | 立即记录 |
| 攻击命中 | frame, buildingId, monsterId, damage, monsterPosition | 每次攻击 |
| 击杀怪物 | killedByType[type]++, totalLifeDestroyed += life | 击杀时 |
| 怪物穿过 | 累加 passed, lifeLost | 到达终点时 |

### 攻击事件记录

每次建筑攻击命中怪物时记录，用于路径验证和精确伤害验证。

```typescript
interface AttackEvent {
  frame: number;                      // 攻击发生的帧号
  buildingId: string;                 // 发起攻击的建筑 ID
  monsterId: string;                  // 被攻击的怪物 ID（使用服务端下发的 UUID）
  damage: number;                     // 实际造成的伤害（扣除护盾后）
  monsterPosition: [number, number];  // 怪物所在格子 [x, y]
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| frame | number | 攻击发生的帧号，用于验证攻击时序和 DPS |
| buildingId | string | 发起攻击的建筑 ID，如 "b-001" |
| monsterId | string | 被攻击的怪物 ID，使用服务端下发的 UUID |
| damage | number | 实际伤害 = max(建筑伤害 - 怪物护盾, 1) |
| monsterPosition | [number, number] | 怪物所在格子坐标 [x, y]，用于路径验证 |

**monsterPosition 示例**：

```
入口位置 → monsterPosition: [0, 0]
中间位置 → monsterPosition: [5, 3]
出口位置 → monsterPosition: [15, 15]
```

**记录时机**：

```typescript
// 在建筑攻击命中时记录
function onBuildingHit(building: Building, monster: Monster, rawDamage: number) {
  const actualDamage = Math.max(rawDamage - monster.shield, 1)

  attacks.push({
    frame: currentFrame,
    buildingId: building.id,
    monsterId: monster.id,
    damage: actualDamage,
    monsterPosition: [monster.gridX, monster.gridY],
  })

  // 同时更新统计
  result.totalDamageDealt += actualDamage
  building.damageDealt += actualDamage
}
```

### 波次记录结构

```typescript
interface WaveRecord {
  waveNumber: number;
  startFrame: number;

  actions: Action[];
  attacks: AttackEvent[];

  result: {
    killed: number;
    killedByType: Record<number, number>;  // {typeId: count}
    passed: number;
    scoreGained: number;
    moneyGained: number;
    lifeLost: number;
    totalDamageDealt: number;
    totalLifeDestroyed: number;
    waveDurationFrames: number;
  };

  buildings: Building[];
}
```

### 数据量估算

| 数据类型 | 每条大小 | 典型数量/波 | 小计 |
|---------|---------|------------|------|
| 建筑操作 | ~80 bytes | 5 | ~400 bytes |
| 攻击事件 | ~50 bytes | 500 | ~25 KB |
| 战斗结果 | ~200 bytes | 1 | ~200 bytes |
| 建筑列表 | ~60 bytes | 10 | ~600 bytes |
| **合计** | - | - | **~26 KB/波** |

**整局游戏（42 波）**：约 1.1 MB（压缩后约 150 KB）

---

## 服务端验证逻辑

### 建筑成本计算

服务端根据 `session.buildings` 和 `actions` 计算每个操作的 cost/income。

**成本公式**：

| 操作 | 公式 |
|------|------|
| BUILD | `config.buildings[type].cost` |
| UPGRADE | `total_cost × upgradeCostRatio` |
| SELL | `total_cost × sellRatio` |

其中 `total_cost` = 建造成本 + 历次升级成本。

```python
# game/calculators.py

def calc_total_cost(building_type: str, level: int, config: dict) -> int:
    """计算建筑累计花费"""
    base = config["buildings"][building_type]["cost"]
    ratio = config["buildings"][building_type].get("upgradeCostRatio", 0.75)
    total = base
    for _ in range(2, level + 1):
        total += int(total * ratio)
    return total


def process_actions(actions: list, session_buildings: list, config: dict) -> tuple:
    """遍历操作计算金钱变化，返回 (spent, income, updated_buildings)"""
    buildings = {b["id"]: b.copy() for b in session_buildings}
    spent, income = 0, 0

    for action in sorted(actions, key=lambda a: a["frame"]):
        bid, atype = action["buildingId"], action["type"]
        if atype == "BUILD":
            spent += config["buildings"][action["buildingType"]]["cost"]
            buildings[bid] = {"type": action["buildingType"], "level": 1}
        elif atype == "UPGRADE":
            b = buildings[bid]
            spent += int(calc_total_cost(b["type"], b["level"], config) * 0.75)
            b["level"] += 1
        elif atype == "SELL":
            b = buildings.pop(bid)
            income += int(calc_total_cost(b["type"], b["level"], config) * 0.5) or 1

    return spent, income, list(buildings.values())
```

**新状态计算**：

```
// 波次结束时（serverState 返回的值）
new_money      = old_money - spent + income + moneyGained
new_score      = old_score + scoreGained
new_life       = old_life - lifeLost
new_difficulty = calc_new_difficulty(old_difficulty, lifeLost, wave)

// 下一波开始前（客户端根据 nextWave.lifeReward 应用）
if lifeReward > 0:
    new_life = min(new_life + lifeReward, 100)
```

**lifeReward 应用时序**：

```
第 5 波结束
    │
    ├─ 客户端提交 { result: { lifeLost: 3, ... } }
    │
    ├─ 服务端验证通过，计算新状态
    │      └─ new_life = 97 - 3 = 94
    │
    ├─ 服务端返回
    │      ├─ serverState.life = 94         ← 不含奖励
    │      └─ nextWave.lifeReward = 5       ← 奖励信息
    │
    └─ 第 6 波开始前，客户端应用奖励
           └─ life = min(94 + 5, 100) = 99
```

> **说明**：`serverState.life` 反映波次结束时的精确状态，`lifeReward` 作为下一波的奖励单独返回，由客户端在下一波开始前应用。

### 动态难度计算

根据玩家上一波的表现（受到的伤害）动态调整难度系数。

```python
# game/calculators.py

def calc_new_difficulty(current: float, life_lost: int, wave: int) -> float:
    """根据上一波受伤情况调整难度"""
    if life_lost == 0:
        # 没有受伤，增加难度
        factor = 1.2 if wave >= 5 else 1.05
    elif life_lost >= 50:
        factor = 0.6
    elif life_lost >= 30:
        factor = 0.7
    elif life_lost >= 20:
        factor = 0.8
    elif life_lost >= 10:
        factor = 0.9
    else:
        # 受伤较少（< 10），波次 >= 10 时略微增加难度
        factor = 1.05 if wave >= 10 else 1.0
    return max(current * factor, 1.0)
```

**难度调整规则**：

| 上一波受伤 | 难度变化 | 说明 |
|------------|----------|------|
| 0 | ×1.05 ~ ×1.2 | 玩家太强，增加挑战 |
| 1 ~ 9 | ×1.0 ~ ×1.05 | 表现良好，维持或略增 |
| 10 ~ 19 | ×0.9 | 略微降低 |
| 20 ~ 29 | ×0.8 | 中等降低 |
| 30 ~ 49 | ×0.7 | 较多降低 |
| ≥ 50 | ×0.6 | 大幅降低 |

### 怪物属性计算

怪物的实际属性基于基础属性和当前难度系数计算。

```python
def calc_monster_attrs(base: dict, difficulty: float) -> dict:
    """基于 difficulty 计算怪物实际属性"""
    return {
        **base,
        "speed": base["speed"] + difficulty / 2,
        "life": int(base["life"] * (difficulty + 1) * 0.5),
        "shield": int(base["shield"] + difficulty / 2),
        # money 和 score 不受 difficulty 影响
    }
```

**属性计算公式**：

| 属性 | 公式 | difficulty=1.0 时 | difficulty=2.0 时 |
|------|------|-------------------|-------------------|
| speed | `base + difficulty/2` | base + 0.5 | base + 1.0 |
| life | `base × (difficulty+1) × 0.5` | base × 1.0 | base × 1.5 |
| shield | `base + difficulty/2` | base + 0.5 | base + 1.0 |

**波次生成流程**：

```
第 N 波结束
    │
    ├─ 服务端验证（使用 session.next_wave 中的怪物属性）
    │
    ├─ 计算新难度
    │      └─ new_difficulty = calc_new_difficulty(session.difficulty, lifeLost, N)
    │
    ├─ 生成第 N+1 波配置
    │      └─ for base in base_monsters:
    │             monster = calc_monster_attrs(base, new_difficulty)
    │
    ├─ 保存到 session
    │      ├─ session.difficulty = new_difficulty
    │      └─ session.next_wave = { monsters: [...] }
    │
    └─ 返回 { serverState: { difficulty: new_difficulty }, nextWave }
```

> **验证兼容性**：现有的 Level 1、Level 2 验证逻辑无需修改，因为验证时使用的 `wave_config`（即 `session.next_wave`）已包含基于当前 difficulty 计算的怪物属性。

### 波次连续性验证

防止跳波或重复提交。

```python
def validate_wave_continuity(session: GameSession, wave_number: int) -> tuple[bool, str]:
    """验证波次连续性"""
    if wave_number != session.wave_count + 1:
        return False, f"波次不连续: 期望 {session.wave_count + 1}, 收到 {wave_number}"
    return True, ""
```

> **说明**：`WaveRecord` 的 `unique_together = [["session", "wave_number"]]` 在数据库层面防止重复提交。

### Level 1：基础验证

```python
# game/validators.py

def validate_basic(result: dict, wave_config: dict) -> tuple[bool, str]:
    """基础验证：收益上限、数量一致性"""

    killed_by_type = result["killed_by_type"]
    wave_monsters = {m["type"]: m for m in wave_config["monsters"]}

    # killedByType 一致性验证
    if sum(killed_by_type.values()) != result["killed"]:
        return False, "击杀数量不一致"

    # 每种怪物击杀数不能超过波次配置
    for monster_type, killed_count in killed_by_type.items():
        if monster_type not in wave_monsters:
            return False, f"未知的怪物类型: {monster_type}"
        if killed_count > wave_monsters[monster_type]["count"]:
            return False, f"怪物 {monster_type} 击杀数超出配置"

    # 总数量一致性验证
    total_monsters = sum(m["count"] for m in wave_config["monsters"])
    if result["killed"] + result["passed"] != total_monsters:
        return False, "怪物数量不一致"

    # 金钱收益验证（基于 killedByType 精确计算）
    expected_money = sum(
        killed_by_type.get(m["type"], 0) * m["money"]
        for m in wave_config["monsters"]
    )
    if result["money_gained"] != expected_money:
        return False, "金钱收益不匹配"

    # 分数收益验证（基于 killedByType 精确计算）
    expected_score = sum(
        killed_by_type.get(m["type"], 0) * m["score"]
        for m in wave_config["monsters"]
    )
    if result["score_gained"] != expected_score:
        return False, "分数收益不匹配"

    return True, ""


def validate_money_balance(new_state: dict) -> tuple[bool, str]:
    """验证金钱余额不为负"""
    if new_state["money"] < 0:
        return False, "金钱余额不足，无法完成所有操作"
    return True, ""


def validate_buildings_consistency(
    calculated_buildings: list[dict],
    submitted_buildings: list[dict],
) -> tuple[bool, str]:
    """验证服务端计算的建筑列表与客户端提交的一致"""
    calc_map = {b["id"]: (b["type"], b["level"]) for b in calculated_buildings}
    submit_map = {b["id"]: (b["type"], b["level"]) for b in submitted_buildings}

    if calc_map != submit_map:
        return False, "建筑列表不一致"
    return True, ""
```

### Level 2：伤害验证

```python
def validate_damage(
    result: dict,
    buildings: list[dict],
    wave_config: dict,
    building_config: dict,
) -> tuple[bool, str]:
    """伤害验证：生命池、DPS 容量"""

    killed_by_type = result["killed_by_type"]
    wave_monsters = {m["type"]: m for m in wave_config["monsters"]}

    # 生命池验证（基于 killedByType 精确计算）
    expected_life = sum(
        killed_by_type.get(m["type"], 0) * m["life"]
        for m in wave_config["monsters"]
    )
    if result["total_life_destroyed"] != expected_life:
        return False, f"生命池验证失败: 期望 {expected_life}, 实际 {result['total_life_destroyed']}"

    # 伤害下限验证
    if result["total_damage_dealt"] < result["total_life_destroyed"]:
        return False, "伤害值不足以击杀"

    # DPS 容量验证
    max_dps = sum(
        building_config[b["type"]]["damage"] * b["level"] / building_config[b["type"]]["speed"]
        for b in buildings
        if building_config[b["type"]]["speed"] > 0
    )
    max_damage = max_dps * result["wave_duration_frames"]
    if result["total_damage_dealt"] > max_damage * 1.1:  # 10% 容差
        return False, "DPS 容量超限"

    return True, ""
```

### Level 2+：攻击事件验证

基于攻击事件记录进行更精确的验证。

```python
import math


def validate_attacks(
    attacks: list[dict],
    buildings: list[dict],
    result: dict,
    building_config: dict,
    map_config: dict,
    monsters_config: dict,  # 服务端下发的怪物配置 {id: {type, life, ...}}
) -> tuple[bool, str]:
    """攻击事件验证：伤害一致性、射程验证、路径合理性、累计伤害验证"""

    building_map = {b["id"]: b for b in buildings}

    # 1. 伤害总和一致性
    total_damage = sum(a["damage"] for a in attacks)
    if total_damage != result["total_damage_dealt"]:
        return False, f"伤害总和不一致: 攻击记录 {total_damage}, 结果 {result['total_damage_dealt']}"

    # 2. 攻击帧号时序验证
    for i in range(1, len(attacks)):
        if attacks[i]["frame"] < attacks[i - 1]["frame"]:
            return False, "攻击帧号时序错误"

    # 3. 怪物 ID 有效性验证（必须是服务端下发的 UUID）
    ok, err = validate_monster_ids(attacks, monsters_config)
    if not ok:
        return False, err

    # 4. 逐条验证
    for attack in attacks:
        building = building_map.get(attack["buildingId"])
        if not building:
            return False, f"未知建筑: {attack['buildingId']}"

        # 射程验证
        ok, err = validate_attack_range(attack, building, building_config)
        if not ok:
            return False, err

        # 伤害值合法性验证
        ok, err = validate_damage_value(attack, building, building_config)
        if not ok:
            return False, err

    # 5. 累计伤害验证
    ok, err = validate_cumulative_damage(attacks, result, monsters_config)
    if not ok:
        return False, err

    # 6. 路径合理性验证
    ok, err = validate_monster_paths(attacks, map_config)
    if not ok:
        return False, err

    return True, ""


def validate_monster_ids(
    attacks: list[dict],
    monsters_config: dict,
) -> tuple[bool, str]:
    """验证攻击事件中的 monsterId 是否是服务端下发的有效 UUID"""
    for attack in attacks:
        mid = attack["monsterId"]
        if mid not in monsters_config:
            return False, f"未知的 monsterId: {mid}（不是服务端下发的 UUID）"
    return True, ""


def validate_cumulative_damage(
    attacks: list[dict],
    result: dict,
    monsters_config: dict,
) -> tuple[bool, str]:
    """验证击杀怪物的累计伤害是否足够"""
    # 按 monsterId 分组计算累计伤害
    damage_by_monster: dict[str, int] = {}
    for attack in attacks:
        mid = attack["monsterId"]
        damage_by_monster[mid] = damage_by_monster.get(mid, 0) + attack["damage"]

    # 验证被击杀怪物的累计伤害
    killed_by_type = result.get("killedByType", {})
    killed_count_by_type: dict[int, int] = {int(k): 0 for k in killed_by_type.keys()}

    for mid, total_damage in damage_by_monster.items():
        monster = monsters_config[mid]
        monster_life = monster["life"]

        if total_damage >= monster_life:
            # 怪物应被击杀
            killed_count_by_type[monster["type"]] = killed_count_by_type.get(monster["type"], 0) + 1
        # 如果累计伤害 < 生命值，怪物未被击杀（可能逃脱）

    # 验证击杀数量一致性
    for monster_type, expected_count in killed_by_type.items():
        actual_count = killed_count_by_type.get(int(monster_type), 0)
        if actual_count != expected_count:
            return False, f"类型 {monster_type} 击杀数不一致: 期望 {expected_count}, 实际根据伤害计算为 {actual_count}"

    return True, ""


def validate_attack_range(
    attack: dict,
    building: dict,
    building_config: dict,
) -> tuple[bool, str]:
    """验证攻击是否在建筑射程内"""
    bx, by = building["position"]
    mx, my = attack["monsterPosition"]

    distance = math.sqrt((bx - mx) ** 2 + (by - my) ** 2)
    building_range = building_config[building["type"]]["range"] * building["level"] ** 0.1

    if distance > building_range + 1:  # 1 格容差（怪物可能在格子边缘）
        return False, f"攻击超出射程: 建筑 {building['id']} 在 ({bx},{by}), 怪物在 ({mx},{my}), 距离 {distance:.1f}, 射程 {building_range:.1f}"

    return True, ""


def validate_damage_value(
    attack: dict,
    building: dict,
    building_config: dict,
) -> tuple[bool, str]:
    """验证伤害值是否合法"""
    base_damage = building_config[building["type"]]["damage"]
    level = building["level"]

    # 计算建筑在当前等级的伤害（升级规则：每级 ×1.2）
    expected_damage = base_damage
    for _ in range(1, level):
        expected_damage = int(expected_damage * 1.2)

    # 实际伤害 = 建筑伤害 - 怪物护盾，最低为 1
    # 由于不知道具体打的是哪个怪物，只验证伤害不超过建筑伤害
    if attack["damage"] > expected_damage:
        return False, f"伤害值超过建筑上限: {attack['damage']} > {expected_damage}"
    if attack["damage"] < 1:
        return False, f"伤害值不能小于 1"

    return True, ""


def validate_monster_paths(
    attacks: list[dict],
    map_config: dict,
) -> tuple[bool, str]:
    """验证怪物路径合理性"""
    entrance = map_config["entrance"]
    exit_pos = map_config["exit"]

    # 按怪物分组
    monster_attacks: dict[str, list[dict]] = {}
    for attack in attacks:
        mid = attack["monsterId"]
        if mid not in monster_attacks:
            monster_attacks[mid] = []
        monster_attacks[mid].append(attack)

    for mid, atks in monster_attacks.items():
        atks.sort(key=lambda a: a["frame"])

        if len(atks) < 2:
            continue

        first_pos = atks[0]["monsterPosition"]
        last_pos = atks[-1]["monsterPosition"]

        # 计算到出口的距离
        first_to_exit = position_distance(first_pos, exit_pos)
        last_to_exit = position_distance(last_pos, exit_pos)

        # 怪物应该从入口向出口移动
        if last_to_exit > first_to_exit + 3:  # 允许 3 格容差（绕路）
            return False, f"怪物 {mid} 路径异常: 远离出口方向移动"

    return True, ""


def position_distance(pos1: list, pos2: list) -> int:
    """计算两个位置之间的曼哈顿距离"""
    return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])
```

**验证能力总结**：

| 验证项 | 说明 | 作弊类型 |
|--------|------|---------|
| 伤害总和一致性 | attacks 伤害总和 = result.totalDamageDealt | 伪造总伤害 |
| 攻击帧号时序 | 帧号递增 | 伪造攻击时序 |
| 怪物 ID 有效性 | monsterId 必须是服务端下发的 UUID | 伪造怪物 ID |
| 累计伤害验证 | 被击杀怪物的累计伤害 ≥ 生命值 | 减少怪物生命值 |
| 击杀数量一致性 | 根据伤害计算的击杀数 = 上报的击杀数 | 伪造击杀结果 |
| 射程验证 | 攻击时怪物在建筑射程内 | 增加射程 |
| 伤害值合法性 | 伤害 ≤ 建筑伤害，伤害 ≥ 1 | 增加伤害 |
| 路径合理性 | 怪物从入口向出口移动 | 绕圈刷分 |

### Level 4：统计分析

基于 `WaveRecord` 历史数据检测异常行为。

```python
import logging

logger = logging.getLogger(__name__)


def analyze_statistics(session: GameSession, result: dict, money_spent: int) -> None:
    """统计分析：基于历史数据检测异常"""
    wave_records = list(session.waves.all())
    if len(wave_records) < 3:
        return  # 数据不足

    # 历史平均击杀率
    hist_killed = sum(r.killed for r in wave_records)
    hist_total = sum(r.killed + r.passed for r in wave_records)
    hist_kill_rate = hist_killed / max(hist_total, 1)

    # 当前击杀率
    curr_total = result["killed"] + result["passed"]
    curr_kill_rate = result["killed"] / max(curr_total, 1)

    # 击杀率突增检测
    if hist_kill_rate < 0.5 and curr_kill_rate > 0.95:
        logger.warning("击杀率异常突增", extra={"wave": session.wave_count + 1})

    # 历史平均效率
    hist_score = sum(r.score_gained for r in wave_records)
    hist_cost = sum(r.money_spent for r in wave_records)
    hist_efficiency = hist_score / max(hist_cost, 1)

    # 当前效率
    curr_efficiency = result["score_gained"] / max(money_spent, 1)

    # 效率突增检测
    if curr_efficiency > hist_efficiency * 3:
        logger.warning("资源效率异常突增", extra={"wave": session.wave_count + 1})
```

### 游戏结束验证

游戏结束时验证累计状态一致性。

```python
def validate_game_end(session: GameSession) -> tuple[bool, str]:
    """验证累计状态一致性"""
    wave_records = list(session.waves.order_by("wave_number"))

    # 验证波次连续性
    for i, record in enumerate(wave_records):
        if record.wave_number != i + 1:
            return False, f"波次记录不连续: 缺少波次 {i + 1}"

    # 验证分数累计
    expected_score = sum(r.score_gained for r in wave_records)
    if session.score != expected_score:
        return False, f"分数累计不一致: 期望 {expected_score}, 实际 {session.score}"

    return True, ""
```

---

## 错误处理

### 错误码

| 错误码 | 说明 | 客户端处理 |
|--------|------|-----------|
| `SESSION_NOT_FOUND` | 会话不存在或已被清理 | 提示并重新加载页面 |
| `VALIDATION_FAILED` | 数据验证失败 | 显示错误信息 |
| `INVALID_REQUEST` | 请求格式错误 | 显示错误信息 |

### 客户端处理示例

```typescript
// src/composables/useGameApi.ts
import axios from 'axios'
import { useGameStore } from '@/stores/game'
import { useRouter } from 'vue-router'

const api = axios.create({ baseURL: '/api/game/sessions' })

export function useGameApi() {
  const gameStore = useGameStore()
  const router = useRouter()

  function handleError(error: { code: string; message: string }) {
    switch (error.code) {
      case 'SESSION_NOT_FOUND':
        gameStore.$reset()
        router.replace({ name: 'game' })
        break
    }
  }

  async function request<T>(method: 'get' | 'post', url: string, data?: unknown): Promise<T> {
    try {
      const res = await api[method](url, data)
      return res.data
    } catch (e: any) {
      if (e.response?.data?.error) {
        handleError(e.response.data.error)
      }
      throw e
    }
  }

  return {
    createSession: () => request<GameStartResponse>('post', ''),
    submitWave: (data: WaveRequest) => request<WaveResponse>('post', '/wave', data),
    endSession: (data: GameEndRequest) => request<GameEndResponse>('post', '/end', data),
  }
}
```

---

## 会话管理

### 设计原则

- 塔防游戏是策略游戏，允许玩家暂停思考
- 不对暂停时间和每波耗时做限制
- 客户端的开始/暂停是 UI 状态，服务端不感知
- Session 存在即有效，不存在即失效

### 会话生命周期

```
创建 ──(波次提交)──▶ 更新 ──(游戏结束)──▶ 删除
                      │
            （定时任务清理过期会话）
```

服务端只关心：Session 是否存在、提交数据是否合法。

### 会话数据结构

```python
# game/models.py

import uuid
from django.db import models


class GameSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # 游戏状态
    money = models.IntegerField()
    score = models.IntegerField(default=0)
    life = models.IntegerField()
    wave_count = models.IntegerField(default=0)
    difficulty = models.FloatField(default=1.0)

    # 建筑状态（用于跨波次验证）
    # 格式: [{"id": "b-001", "type": "cannon", "level": 2}, ...]
    buildings = models.JSONField(default=list)

    # 配置（JSON 存储）
    config = models.JSONField()
    next_wave = models.JSONField()

    class Meta:
        db_table = "game_session"
        indexes = [
            models.Index(fields=["created_at"]),
        ]


class WaveRecord(models.Model):
    """波次记录，用于统计分析和一致性验证"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="waves")
    wave_number = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    # 战斗结果（客户端提供，验证后写入）
    killed = models.IntegerField()
    passed = models.IntegerField()
    score_gained = models.IntegerField()
    money_gained = models.IntegerField()
    life_lost = models.IntegerField()
    total_damage_dealt = models.IntegerField()
    wave_duration_frames = models.IntegerField()

    # 经济数据（服务端计算）
    money_spent = models.IntegerField()
    money_income = models.IntegerField()
    building_count = models.IntegerField()

    # 状态快照（波次结束时）
    end_money = models.IntegerField()
    end_score = models.IntegerField()
    end_life = models.IntegerField()
    end_difficulty = models.FloatField()

    class Meta:
        db_table = "wave_record"
        ordering = ["wave_number"]
        unique_together = [["session", "wave_number"]]
```

**WaveRecord 创建时机**：

| API | 创建的 WaveRecord | 说明 |
|-----|-------------------|------|
| `POST /wave` | 第 1 ~ N-1 波 | 普通波次，验证通过后创建 |
| `POST /end` | 第 N 波 | 最后一波，从 lastWave 创建 |

> **原则**：WaveRecord 只创建不更新，是不可变的历史记录。

```python
class LeaderboardEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nickname = models.CharField(max_length=32)
    score = models.IntegerField()
    waves_completed = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "leaderboard"
        ordering = ["-score", "-waves_completed"]
        indexes = [
            models.Index(fields=["-score"]),
        ]
```

### 定时清理策略

每局游戏上限 24 小时，超时自动清理：

```python
# game/management/commands/cleanup_sessions.py

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from game.models import GameSession


class Command(BaseCommand):
    help = "清理过期的游戏会话"

    def handle(self, *args, **options):
        threshold = timezone.now() - timedelta(hours=24)
        deleted, _ = GameSession.objects.filter(created_at__lt=threshold).delete()
        self.stdout.write(f"已清理 {deleted} 个过期会话")
```

定时执行：

```cron
0 * * * * /app/.venv/bin/python manage.py cleanup_sessions
```

### 服务端实现要点

1. **创建会话**（POST /api/game/sessions）：生成 sessionId，存储配置和初始状态
2. **波次提交**（POST /api/game/sessions/wave）：
   - 验证波次连续性
   - Level 1/2 验证
   - 计算经济数据（spent, income）
   - 创建 WaveRecord
   - 更新 GameSession 状态
   - Level 4 统计分析
3. **游戏结束**（POST /api/game/sessions/end）：验证 lastWave，累计验证，记录排行榜，删除会话
4. **排行榜查询**（GET /api/game/leaderboard）：按 score 降序、waves_completed 降序返回
5. **会话不存在**：返回 `SESSION_NOT_FOUND`，客户端提示用户重新开始

### 过期处理流程

```
创建会话 → 24 小时后 → 定时任务删除
                            ↓
            下次请求返回 SESSION_NOT_FOUND
                            ↓
              客户端提示"会话已失效，请重新开始"
```

---

## 前端开发指南

### 开发模式

采用 Mock + TDD 模式，前后端并行开发：

```
1. 定义类型 (types/)
       ↓
2. 编写 Mock 数据 (mocks/)
       ↓
3. 编写测试用例 (*.spec.ts)
       ↓
4. 实现功能代码
       ↓
5. 测试通过后，替换 Mock 为真实 API
```

### 目录结构

```
frontend/
├── src/
│   ├── types/           # 类型定义
│   ├── mocks/           # Mock 数据
│   ├── api/             # API 层
│   ├── stores/          # Pinia 状态管理
│   ├── game/            # Phaser 游戏逻辑
│   │   ├── scenes/      # 游戏场景
│   │   ├── entities/    # 游戏实体（怪物、建筑）
│   │   └── systems/     # 游戏系统（路径、伤害、经济）
│   ├── components/      # Vue 组件
│   ├── composables/     # 组合式函数
│   └── utils/           # 工具函数
├── tests/               # 测试文件
└── vite.config.ts
```

### 开发优先级

| 阶段 | 内容 | 说明 |
|------|------|------|
| P0 | 项目初始化 | Vite + Vue 3 + TypeScript + Phaser 3 + Vitest |
| P0 | 类型定义 + Mock | 所有开发的基础 |
| P1 | 核心系统 (TDD) | PathSystem, DamageSystem, BuildingSystem, EconomySystem, WaveRecorder |
| P1 | Phaser 实体 | Monster, Building, GameScene |
| P2 | 状态管理 | Pinia Store |
| P2 | API 层 | Mock → 真实 API 切换 |
| P3 | Vue UI | GameHeader, BuildingPanel, GameOverModal, LeaderboardView |

### 核心系统

#### PathSystem

负责怪物路径计算。

```typescript
// src/game/systems/PathSystem.ts
interface PathSystem {
  generatePath(mapConfig: MapConfig): [number, number][]
  getPositionAtProgress(path: Path, progress: number): { x: number; y: number }
}
```

#### DamageSystem

负责伤害计算。

```typescript
// src/game/systems/DamageSystem.ts
interface DamageSystem {
  calculate(rawDamage: number, shield: number): number  // max(damage - shield, 1)
  isKilled(monster: Monster, damage: number): boolean
}
```

#### BuildingSystem

负责建筑相关计算。

```typescript
// src/game/systems/BuildingSystem.ts
interface BuildingSystem {
  getUpgradeCost(type: string, level: number, config: GameConfig): number
  getSellIncome(type: string, level: number, config: GameConfig): number
  getDamageAtLevel(type: string, level: number, config: GameConfig): number
  isInRange(building: Building, targetPos: [number, number], config: GameConfig): boolean
}
```

#### EconomySystem

负责经济相关计算。

```typescript
// src/game/systems/EconomySystem.ts
interface EconomySystem {
  canAfford(money: number, buildingType: string, config: GameConfig): boolean
  getLifeReward(waveNumber: number): number  // 每 5 波 +5，每 10 波 +10
}
```

#### WaveRecorder（关键）

负责记录所有需要提交给服务端的数据。

```typescript
// src/game/systems/WaveRecorder.ts
class WaveRecorder {
  constructor(waveNumber: number)

  // 记录建筑操作
  recordBuild(id: string, type: string, position: [number, number], frame: number): void
  recordUpgrade(id: string, level: number, frame: number): void
  recordSell(id: string, frame: number): void

  // 记录攻击事件
  recordAttack(
    buildingId: string,
    monsterId: string,
    damage: number,
    monsterPosition: [number, number],
    frame: number
  ): void

  // 记录战斗结果
  recordKill(monsterType: number, monsterLife: number): void
  recordPassed(damage: number): void
  addMoney(amount: number): void
  addScore(amount: number): void
  setDuration(frames: number): void

  // 导出数据
  getActions(): Action[]
  getAttacks(): AttackEvent[]
  getResult(): WaveResult
  toWaveRequest(sessionId: string, buildings: BuildingState[]): WaveRequest
}
```

### 游戏实体

#### Monster

```typescript
// src/game/entities/Monster.ts
class Monster extends Phaser.GameObjects.Sprite {
  id: string           // 服务端下发的 UUID
  type: number
  maxLife: number
  currentLife: number
  speed: number
  shield: number
  money: number
  score: number
  damage: number       // 到达终点造成的伤害
  progress: number     // 路径进度 0-1

  takeDamage(rawDamage: number): number  // 返回实际伤害
  isDead(): boolean
  reachedExit(): boolean
  getGridPosition(): [number, number]
}
```

#### Building

```typescript
// src/game/entities/Building.ts
class Building extends Phaser.GameObjects.Sprite {
  id: string
  type: string
  level: number
  position: [number, number]
  cooldown: number
  damageDealt: number  // 本波累计
  kills: number        // 本波累计

  canAttack(): boolean
  findTarget(monsters: Monster[]): Monster | null
  attack(target: Monster, recorder: WaveRecorder): void
  getDamage(): number
  getRange(): number
  getAttackSpeed(): number
}
```

### 状态管理

```typescript
// src/stores/game.ts
interface GameState {
  sessionId: string | null
  config: GameConfig | null

  // 游戏状态（与服务端同步）
  money: number
  score: number
  life: number
  difficulty: number
  waveNumber: number

  // 建筑列表
  buildings: BuildingState[]

  // 游戏控制
  isPlaying: boolean
  isPaused: boolean
}

interface GameActions {
  syncServerState(state: ServerState): void
  applyLifeReward(reward: number): void
  spendMoney(amount: number): void
  addMoney(amount: number): void
  addBuilding(building: BuildingState): void
  removeBuilding(id: string): void
  updateBuilding(id: string, updates: Partial<BuildingState>): void
}
```

### API 层

```typescript
// src/api/game.ts
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export const gameApi = {
  createSession(): Promise<GameStartResponse>
  submitWave(request: WaveRequest): Promise<WaveResponse>
  endGame(request: GameEndRequest): Promise<GameEndResponse>
  getLeaderboard(limit?: number): Promise<LeaderboardResponse>
}
```

环境变量配置：

```bash
# .env.development
VITE_USE_MOCK=true

# .env.production
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api
```

### Vue 组件

| 组件 | 功能 |
|------|------|
| `GameHeader.vue` | 显示金钱、生命、分数、波次 |
| `BuildingPanel.vue` | 建筑选择面板，升级/出售按钮 |
| `PhaserCanvas.vue` | Phaser 游戏容器 |
| `GameOverModal.vue` | 游戏结束弹窗 + 昵称输入 |
| `LeaderboardView.vue` | 排行榜展示 |
| `ErrorToast.vue` | 错误提示 |

### 测试规范

使用 Vitest 编写单元测试：

```typescript
// tests/game/WaveRecorder.spec.ts
describe('WaveRecorder', () => {
  let recorder: WaveRecorder

  beforeEach(() => {
    recorder = new WaveRecorder(1)
  })

  it('should record build action', () => {
    recorder.recordBuild('b-001', 'cannon', [5, 5], 100)
    expect(recorder.getActions()).toHaveLength(1)
    expect(recorder.getActions()[0]).toEqual({
      type: 'BUILD',
      buildingId: 'b-001',
      buildingType: 'cannon',
      position: [5, 5],
      frame: 100,
    })
  })

  it('should calculate total damage dealt', () => {
    recorder.recordAttack('b-001', 'uuid-1', 10, [3, 3], 100)
    recorder.recordAttack('b-001', 'uuid-2', 15, [4, 4], 120)
    expect(recorder.getResult().totalDamageDealt).toBe(25)
  })

  it('should track kills by type', () => {
    recorder.recordKill(0, 50)
    recorder.recordKill(0, 50)
    recorder.recordKill(1, 100)
    expect(recorder.getResult().killed).toBe(3)
    expect(recorder.getResult().killedByType).toEqual({ 0: 2, 1: 1 })
    expect(recorder.getResult().totalLifeDestroyed).toBe(200)
  })
})
```

### 注意事项

1. **怪物 ID 必须使用服务端 UUID**：不能自己生成，必须使用 `firstWave`/`nextWave` 中下发的 `monster.id`
2. **状态同步**：每波结束后用 `serverState` 覆盖本地状态
3. **生命奖励时序**：`lifeReward` 在下一波开始前应用，不是立即应用
4. **帧号记录**：所有操作和攻击都要记录准确的帧号
5. **攻击位置记录**：攻击时记录怪物的格子坐标，用于服务端路径验证
