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

### 开发指南

- [前端开发指南](./FRONTEND_GUIDE.md)
- [后端开发指南](./BACKEND_GUIDE.md)

---

## 项目目标

1. 使用现代前端技术栈（Vue 3 + Phaser 3 + TypeScript）重构原游戏
2. 实现现代后端技术栈（Django + DRF + PostgreSQL）实现结果验证和积分排行榜
3. 保持原游戏的核心玩法和数值体系
4. 添加与后端交互的排行榜功能

---

## 游戏规则

### 基础设定

- 游戏类型: 动态寻路塔防（无限模式）
- 地图规格: 16x16 格子
- 格子大小: 32px
- 帧率: 60 FPS
- 入口: 左上角 (0, 0)
- 出口: 右下角 (15, 15)
- 全局速度系数: 0.1（GLOBAL_SPEED，用于将配置速度转换为每帧实际像素移动量）

#### 帧号计数

游戏使用帧号（frame）作为内部时间单位，用于记录操作时序和计算持续时间。

**帧号规则**：

- 帧号从游戏开始时为 0，每帧递增 1
- 暂停时帧号不增长，只有游戏运行时才递增
- 所有时间相关的记录都使用帧号而非系统时间戳

> **设计说明**：使用帧号而非时间戳可防止客户端系统时间被篡改，且能准确反映游戏实际运行时间（排除暂停时间）。

#### 路径系统

怪物使用动态寻路算法（BFS）从入口移动到出口。

**核心特性**：

- 独立路径: 每个怪物独立计算路径，不共享。同一位置出发的怪物可能走不同路径
- 动态重算: 怪物每帧有 10% 概率自动重新寻路，遇到障碍时强制重算
- 路径随机性: 寻路回溯时若有多条等距路径，随机选择一条
- 建筑影响: 建筑放置后该格子变为不可通行，影响后续怪物的路径计算

**可通行性规则**：

- 预设障碍物（`obstacles` 配置）: 不可通行
- 已放置建筑的格子: 不可通行
- 其他格子: 可通行

**怪物重新寻路机制**：

怪物在以下情况下会重新计算路径：

- 路径列表为空时
- 每步有 10% 概率自动重新寻路（模拟随机移动）
- 下一步格子变为不可通行时（如被新建筑占据）

当建筑放置后阻断了怪物的当前路线，怪物会自动重新寻路，可能选择更远的绕行路线。这是游戏策略的核心部分：玩家可以通过建筑引导怪物走更长的路线，但不能完全阻断所有通路。

> **来源**: 旧实现 `td-obj-monster.js:184-203` getNextGrid()

**建筑放置约束**：

建筑放置时需要通过双层检查机制：

- 不能放置在入口或出口格子
- 不能完全阻断入口到出口的所有路径（路径检查）
- 不能使已存在的怪物无法到达出口（怪物检查）

> **注意**: 可以阻断怪物的当前最短路线，此时怪物会重新寻路走更远的路线。但如果新建筑会导致某个怪物完全无路可走，则禁止建造。

> **来源**: 旧实现 `td-obj-monster.js:124-136`（寻路）、`td-walk.js`（寻路算法）、`td-obj-grid.js:47-77`（建筑阻塞检查 checkBlock）、`td-obj-monster.js:211-226`（怪物阻塞检查 chkIfBlocked）

#### 速度计算

**帧率换算**:

新实现使用 60 FPS，旧实现使用 24 FPS。为保持相同的实际移动速度，需要进行帧率补偿。

```
帧率比例 = OLD_FPS / FPS = 24 / 60 = 0.4
```

**怪物移动速度**:

```
实际速度 = speed × GLOBAL_SPEED × (24 / 60)
示例: 普通怪 speed=3 → 实际速度 = 3 × 0.1 × 0.4 = 0.12 像素/帧
```

> **帧率补偿说明**: 旧实现 (24 FPS) 每帧移动 `speed × 0.1` 像素，每秒移动 `speed × 2.4` 像素。新实现 (60 FPS) 需要乘以帧率比例 `24/60` 以保持相同的每秒移动距离。

**子弹飞行速度**:

```
实际速度 = bullet_speed × 20 × GLOBAL_SPEED × (24 / 60)
示例: cannon bullet_speed=6 → 实际速度 = 6 × 20 × 0.1 × 0.4 = 4.8 像素/帧
```

> **设计说明**: 子弹速度额外乘以 20 倍系数，使子弹速度远快于怪物移动速度。这确保了即使对高速怪物（如极速怪 speed=30），子弹也能有效追击。来源: 旧实现 `td-obj-building.js:466`。

**建筑攻击间隔**:

```
攻击间隔(帧) = floor(max(2 / (speed × GLOBAL_SPEED), 1)) × (60 / 24)
示例（60 FPS）:
- cannon (speed=2): floor(2 / 0.2) × 2.5 = 25 帧
- LMG/HMG (speed=3): floor(2 / 0.3) × 2.5 ≈ 16 帧
- laser_gun (speed=20): floor(2 / 2) × 2.5 ≈ 2 帧
```

> **设计说明**: 攻击间隔与建筑的 `speed` 属性成反比。`speed` 越高，攻击越频繁。新实现 60 FPS 下的帧数是旧实现 24 FPS 的 2.5 倍，但实际攻击频率（每秒攻击次数）保持不变。来源: 旧实现 `td-obj-building.js:168`。

### 怪物系统

#### 怪物属性

- life: 生命值
- speed: 移动速度（1-40）
- max_speed: 最大速度
- shield: 护盾值（减伤）
- damage: 到达终点造成的伤害（1-10）
- money: 击杀奖励金币

#### 怪物类型（9 种）

- 索引 0 - 普通怪: 生命值 50, 速度 3, 速度上限 10, 护盾 0, 伤害 1, 金币 5, 最弱小的怪物
- 索引 1 - 稀强怪: 生命值 50, 速度 6, 速度上限 20, 护盾 1, 伤害 2, 金币 8, 稍强一些
- 索引 2 - 速度怪: 生命值 50, 速度 12, 速度上限 30, 护盾 1, 伤害 3, 金币 10, 速度较快
- 索引 3 - 血量怪: 生命值 500, 速度 5, 速度上限 10, 护盾 1, 伤害 3, 金币 50, 生命值很高
- 索引 4 - 护盾怪: 生命值 50, 速度 5, 速度上限 10, 护盾 20, 伤害 3, 金币 30, 防御很强
- 索引 5 - 伤害怪: 生命值 50, 速度 7, 速度上限 14, 护盾 2, 伤害 10, 金币 25, 到达终点伤害高
- 索引 6 - 速度血量怪: 生命值 100, 速度 15, 速度上限 30, 护盾 3, 伤害 3, 金币 35, 速度、生命都较高
- 索引 7 - 极速怪: 生命值 30, 速度 30, 速度上限 40, 护盾 1, 伤害 4, 金币 20, 速度很快
- 索引 8 - 护盾血量怪: 生命值 300, 速度 3, 速度上限 10, 护盾 15, 伤害 5, 金币 60, 防御强、生命高

> **金币设计依据**：基础怪物（0-2）金币较低（5-10），高难度怪物（3-8）金币较高（20-60），与怪物的击杀难度成正比。

#### 波次生成规则

- 波次 1-10 使用预定义配置
- 波次 11+ 自动生成：
  - 怪物总数 = min(wave^1.1, 100)
  - 使用确定性轮询算法分配怪物：
    - 组大小按 1→2→3→1→2→3... 循环
    - 怪物类型按 0→1→2→...→8→0→1... 轮询
    - 确保服务端可根据 (wave_number, difficulty) 精确重建配置用于验证
  - 一波可以有多组同类型怪物，总数可超过 3 个
- 波次间隔：60 FPS × 3 = 180 帧

> **与旧实现的区别**：旧实现使用随机算法生成波次配置（每组随机 1-3 个怪物，随机怪物类型）。新实现改为确定性轮询算法，原因是：
> - 服务端验证需要精确重建波次配置
> - 随机算法无法仅凭 (wave_number, difficulty) 重建相同配置
> - 确定性算法保证相同输入产生相同输出，支持服务端独立验证

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

- damage: 攻击力
- range: 初始射程（格子数），可升级
- max_range: 射程升级上限
- speed: 攻击速度
- bullet_speed: 子弹速度
- life: 塔的生命值
- shield: 塔的护盾值
- cost: 建造费用

#### 塔类型（5 种）

- wall (路障): 攻击力 0, 范围 0, 攻速 0, 造价 5, 阻挡路径不攻击
- cannon (炮台): 攻击力 12, 范围 4-8, 攻速 2, 造价 300, 平衡型
- LMG (轻机枪): 攻击力 5, 范围 5-10, 攻速 3, 造价 100, 低攻击大范围经济型
- HMG (重机枪): 攻击力 30, 范围 3-5, 攻速 3, 造价 800, 高攻击小范围
- laser_gun (激光枪): 攻击力 25, 范围 6-10, 攻速 20, 造价 2000, 高速攻击高造价

#### 升级机制

- 默认: 每级属性 x 1.2
- cannon（炮台）: 前 11 次升级 x 1.2，第 12 次升级起 x 1.3（即 Level 2-12 用 1.2，Level 13+ 用 1.3）
- HMG（重机枪）: 每级 x 1.3

**精度处理**：计算过程中保持浮点精度，仅在最终结果时截断（floor）。这与旧实现的 `_upgrade_records` 机制一致。

### 经济系统

- 初始金币: 500
- 初始生命: 100
- 击杀奖励: 根据怪物配置（monster.money 或按公式计算）

**波次奖励**：

- 每 5 波: +5 生命（不超过 100）
- 每 10 波: +10 生命（不超过 100）

### 胜负条件

- 生命值降为 0: 失败
- 无限模式: 无胜利条件

### 得分计算

**得分公式**（每次攻击命中时累加）：

```
命中得分 = floor(√实际伤害)
```

**最终得分**：积分就是最终得分，即游戏过程中累计的命中得分总和。

> **设计说明**：每次击中怪物时立即加分，而非击杀时加分。这使得高攻速武器（如激光枪）在得分上更有价值。

---

## 技术栈

### 前端

- Vue 3.5: UI 框架
- Phaser 3.90: 游戏引擎
- Vite 7.2: 构建工具
- TypeScript 5: 开发语言
- Pinia 3.0: 状态管理
- Axios 1.13: HTTP 客户端

### 后端

- Python 3.13: 开发语言
- uv: 0.9.15 包管理器
- Django 5.2: Web 框架
- Django REST Framework 3.16: API 框架
- PostgreSQL 15: 数据库
- pytest + pytest-django: 测试框架
- Docker + Gunicorn: 部署

---

## 整体架构

### 设计原则

- **服务端权威**：怪物属性、建筑属性、波次配置由服务端定义
- **客户端零配置**：客户端不内置任何游戏配置和默认状态，所有数值均从服务端获取
- **客户端执行**：游戏逻辑在客户端执行，服务端验证结果
- **批量提交**：每波结束时批量提交，而非实时上传
- **渐进验证**：每波验证一次，而非游戏结束时一次性验证
- **确定性生成**：波次配置使用确定性算法生成，服务端可精确重建用于验证

### 验证方案

采用 Level 1 + 2 + 4 验证架构：

- Level 1 (基础验证): 收益上限、成本验证、数量一致性
- Level 2 (伤害验证): 生命池验证、DPS 容量验证、攻击次数验证
- Level 3 (行为重放): 服务端根据操作序列重新模拟，对比结果
- Level 4 (统计分析): 击杀率异常、资源效率异常、历史对比

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

- `POST /api/game/sessions`: 页面加载时创建会话，返回配置和第一波
- `POST /api/game/sessions/wave`: 每波结束时提交结果，返回下一波
- `POST /api/game/sessions/end`: 游戏结束时提交最后一波并结束，返回排名
- `GET /api/game/leaderboard`: 查看排行榜时获取排行榜列表

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
        range: number;             // 最小攻击范围（格子数）
        max_range: number;         // 最大攻击范围（升级可扩展）
        speed: number;             // 攻击速度
        bullet_speed: number;      // 子弹速度（laser_gun 为 0）
        life: number;              // 建筑生命值
        shield: number;            // 建筑护盾值
        upgradeCostRatio: number;  // 升级成本比例
        sellRatio: number;         // 出售回收比例
      }
    };

    monsters: {
      [typeId: number]: {
        name: string;
        color: string;
        damage: number;            // 到达终点造成的伤害（1-10）
      }
    };

    map: {
      width: number;               // 地图宽度（格子数）
      height: number;              // 地图高度（格子数）
      entrance: [number, number];  // 入口坐标
      exit: [number, number];      // 出口坐标
      obstacles: [number, number][]; // 预设障碍物坐标列表（不可通行格子）
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

  // 本波所有攻击事件（支持子弹"误伤"机制）
  attacks: Array<{
    frame: number;                           // 命中帧号
    buildingId: string;                      // 建筑 ID
    originalTargetId: string;                // 发射时瞄准的怪物 ID
    originalTargetPosition: [number, number]; // 发射时目标位置（用于射程验证）
    monsterId: string;                       // 实际命中的怪物 ID（可能不同）
    monsterPosition: [number, number];       // 命中时怪物位置（用于路径验证）
    damage: number;                          // 实际伤害
  }>;

  // 战斗结果
  result: {
    killed: number;                // 击杀怪物总数
    killedByType: Record<number, number>;  // 每种怪物的击杀数 {typeId: count}
    passed: number;                // 穿过终点的怪物数
    remaining?: number;            // 提前结束时场上剩余的怪物数（可选，默认 0）
    remainingMonsterIds?: string[];  // 提前结束时场上剩余怪物的 ID 列表（可选）
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

结束游戏会话，获取排名。支持两种模式：

1. **带 lastWave**：提交最后一波数据并结束（正常结束）
2. **不带 lastWave**：直接结束游戏（提前结束），使用已提交的波次数据计算得分

#### 请求

```typescript
interface GameEndRequest {
  sessionId: string;
  nickname: string;              // 玩家昵称（1-32 字符，不能为纯空白）

  // 最后一波数据（可选，提前结束时不提供）
  // 不提供 lastWave 时，必须至少已完成一波
  lastWave?: {
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
      remaining?: number;            // 提前结束时场上剩余的怪物数（可选，默认 0）
      remainingMonsterIds?: string[];  // 提前结束时场上剩余怪物的 ID 列表（可选）
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

- `limit` (number, 可选): 返回条数，默认 10，最大 100

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

- 建造建筑: 立即记录 type, frame, buildingType, buildingId, position
- 升级建筑: 立即记录 type, frame, buildingId, level
- 出售建筑: 立即记录 type, frame, buildingId
- 攻击命中: 每次攻击记录 frame, buildingId, monsterId, damage, monsterPosition
- 击杀怪物: 击杀时记录 killedByType[type]++, totalLifeDestroyed += life
- 怪物穿过: 到达终点时累加 passed, lifeLost

### 攻击事件记录

每次建筑攻击命中怪物时记录，用于路径验证和精确伤害验证。

```typescript
interface AttackEvent {
  frame: number;                               // 命中发生的帧号
  buildingId: string;                          // 发起攻击的建筑 ID

  // 发射时的原始目标信息（用于射程验证）
  originalTargetId: string;                    // 发射时瞄准的怪物 ID
  originalTargetPosition: [number, number];    // 发射时目标的格子坐标

  // 实际命中信息（子弹可能命中其他怪物）
  monsterId: string;                           // 实际命中的怪物 ID
  monsterPosition: [number, number];           // 命中时怪物的格子坐标
  damage: number;                              // 实际造成的伤害（扣除护盾后）
}
```

**字段说明**：

- frame (number): 命中发生的帧号，用于验证攻击时序和 DPS
- buildingId (string): 发起攻击的建筑 ID，如 "b-001"
- originalTargetId (string): 发射时瞄准的怪物 ID（用于验证建筑有合法目标）
- originalTargetPosition ([number, number]): 发射时目标的格子坐标（用于射程验证）
- monsterId (string): 实际命中的怪物 ID，可能与 originalTargetId 不同（"误伤"）
- monsterPosition ([number, number]): 命中时怪物的格子坐标，用于路径验证
- damage (number): 实际伤害 = max(建筑伤害 - 怪物护盾, 建筑伤害 x 0.1)

**为什么需要记录原始目标？**

子弹系统存在"误伤"机制：建筑向 Monster A 发射子弹，但子弹可能命中路径上的 Monster B。
- `originalTargetPosition`：用于验证建筑发射时有合法目标（在射程内）
- `monsterPosition`：用于验证怪物路径合理性（从入口向出口移动）

**monsterPosition 示例**：

```
入口位置 → monsterPosition: [0, 0]
中间位置 → monsterPosition: [5, 3]
出口位置 → monsterPosition: [15, 15]
```

**记录时机**：

```typescript
// 子弹命中时记录（bullet 携带原始目标信息）
function onBulletHit(bullet: Bullet, hitMonster: Monster) {
  // 最低伤害 = 原始伤害的 10%（保证高伤害武器打护盾怪更有效）
  const minDamage = Math.ceil(bullet.damage * 0.1)
  const actualDamage = Math.max(bullet.damage - hitMonster.shield, minDamage)

  attacks.push({
    frame: currentFrame,
    buildingId: bullet.building.id,

    // 原始目标信息（从 bullet 获取）
    originalTargetId: bullet.originalTarget.id,
    originalTargetPosition: bullet.originalTargetPosition,

    // 实际命中信息（可能与原始目标不同）
    monsterId: hitMonster.id,
    monsterPosition: [hitMonster.gridX, hitMonster.gridY],
    damage: actualDamage,
  })

  // 同时更新统计
  result.totalDamageDealt += actualDamage
  bullet.building.damageDealt += actualDamage

  // 每次击中时加分（分数 = √伤害）
  result.scoreGained += Math.floor(Math.sqrt(actualDamage))
}

// laser_gun 即时命中（原始目标 = 实际命中）
function onLaserHit(building: Building, monster: Monster, rawDamage: number) {
  const minDamage = Math.ceil(rawDamage * 0.1)
  const actualDamage = Math.max(rawDamage - monster.shield, minDamage)
  const monsterPos: [number, number] = [monster.gridX, monster.gridY]

  attacks.push({
    frame: currentFrame,
    buildingId: building.id,
    originalTargetId: monster.id,
    originalTargetPosition: monsterPos,
    monsterId: monster.id,
    monsterPosition: monsterPos,
    damage: actualDamage,
  })
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
    remaining?: number;            // 提前结束时场上剩余的怪物数（可选，默认 0）
    remainingMonsterIds?: string[];  // 提前结束时场上剩余怪物的 ID 列表（可选）
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

**waveDurationFrames 定义**：

波次持续帧数，用于 DPS 容量验证。

- 起点（startFrame）：波次第一个怪物生成的帧号
- 终点：波次最后一个怪物死亡或穿过终点的帧号
- 计算：`waveDurationFrames = endFrame - startFrame`

> **与旧实现的差异**：旧实现（24 FPS）没有记录波次持续帧数。新实现增加此字段用于服务端 DPS 容量验证，防止客户端伪造过高的伤害输出。

### 数据量估算

- 建筑操作: 每条约 80 bytes，典型 5 条/波，小计约 400 bytes
- 攻击事件: 每条约 50 bytes，典型 500 条/波，小计约 25 KB
- 战斗结果: 约 200 bytes，1 条/波，小计约 200 bytes
- 建筑列表: 每条约 60 bytes，典型 10 条/波，小计约 600 bytes
- 合计: 约 26 KB/波

**整局游戏（42 波）**：约 1.1 MB（压缩后约 150 KB）

---

## 服务端验证逻辑

### 建筑成本计算

服务端根据 `session.buildings` 和 `actions` 计算每个操作的 cost/income。

**成本公式**：

- BUILD: `config.buildings[type].cost`
- UPGRADE: `total_cost x upgradeCostRatio`
- SELL: `total_cost x sellRatio`

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
    # Wave 1 不调整难度（教学波）
    if wave == 1:
        return current

    if life_lost == 0:
        # 没有受伤，增加难度
        if wave < 5:
            factor = 1.05
        elif current > 30:
            factor = 1.1  # 高难度时减缓增长
        else:
            factor = 1.2
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

> **注意**：第 1 波（教学波）不调整难度，直接返回当前值。

- Wave 1: x1.0，教学波不调整
- 0 伤害 (wave < 5): x1.05，早期无伤小幅增加
- 0 伤害 (difficulty > 30): x1.1，高难度无伤减缓增长
- 0 伤害 (其他): x1.2，正常无伤较大增加
- 1-9 伤害: x1.0 ~ x1.05，表现良好维持或略增
- 10-19 伤害: x0.9，略微降低
- 20-29 伤害: x0.8，中等降低
- 30-49 伤害: x0.7，较多降低
- 50+ 伤害: x0.6，大幅降低

### 怪物属性计算

怪物的实际属性基于基础属性和当前难度系数计算。

```python
def calc_monster_attrs(base: dict, difficulty: float) -> dict:
    """基于 difficulty 计算怪物实际属性"""
    speed = base["speed"] + difficulty / 2
    if "max_speed" in base:
        speed = min(speed, base["max_speed"])
    speed = max(speed, 1)

    life = int(base["life"] * (difficulty + 1) * 0.5)
    life = max(life, 1)

    shield = int(base["shield"] + difficulty / 2)
    shield = max(shield, 0)

    return {
        **base,
        "speed": speed,
        "life": life,
        "shield": shield,
        # money 不受 difficulty 影响
    }
```

**属性计算公式**：

- speed: `base + difficulty/2`，约束 `1 <= speed <= max_speed`
  - difficulty=1.0 时: base + 0.5
  - difficulty=2.0 时: base + 1.0
- life: `base x (difficulty+1) x 0.5`，约束 `life >= 1`
  - difficulty=1.0 时: base x 1.0
  - difficulty=2.0 时: base x 1.5
- shield: `base + difficulty/2`，约束 `shield >= 0`
  - difficulty=1.0 时: base + 0.5
  - difficulty=2.0 时: base + 1.0

> **约束来源**：旧实现 `td-obj-monster.js:27-36`，确保游戏平衡性。如极速怪 (type 7) 的 `max_speed=40`，防止高难度下速度超过 40。

> **与旧实现的差异**：旧实现在计算 speed/life/damage 时包含随机因子 `(Math.random() * 0.5 + 0.75)`，使同一波次同类型怪物的属性有 ±25% 的变化。新实现**有意移除**了这一随机因子，原因是服务端验证需要确定性：服务端必须能够仅凭 `(wave_number, difficulty)` 精确重建波次配置，随机因子会使服务端无法独立计算每个怪物的实际属性。这是安全性与游戏体验的设计权衡。

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

    # remaining 字段验证（向后兼容，默认为 0）
    remaining = result.get("remaining", 0)
    if remaining < 0:
        return False, "remaining 不能为负数"

    # 总数量一致性验证
    total_monsters = sum(m["count"] for m in wave_config["monsters"])
    if result["killed"] + result["passed"] + remaining != total_monsters:
        return False, "怪物数量不一致"

    # 金钱收益验证（基于 killedByType 精确计算）
    expected_money = sum(
        killed_by_type.get(m["type"], 0) * m["money"]
        for m in wave_config["monsters"]
    )
    if result["money_gained"] != expected_money:
        return False, "金钱收益不匹配"

    return True, ""


def validate_score(attacks: list[dict], result: dict) -> tuple[bool, str]:
    """验证得分：基于攻击伤害计算"""
    # 得分 = Σ floor(√每次攻击伤害)
    expected_score = sum(int(math.sqrt(a["damage"])) for a in attacks)
    if result["score_gained"] != expected_score:
        return False, f"分数不匹配: 期望 {expected_score}, 实际 {result['score_gained']}"
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


def validate_remaining_monsters(
    attacks: list[dict],
    result: dict,
    monsters_config: dict,
) -> tuple[bool, str]:
    """验证 remaining 怪物的合法性

    验证项目：
    1. remainingMonsterIds 长度 == remaining
    2. 每个 ID 都是服务端下发的有效 UUID
    3. 这些怪物的累计伤害 < 生命值（确实没被击杀）
    4. 这些怪物 ID 不重复

    Args:
        attacks: 攻击事件列表
        result: 波次结果
        monsters_config: 服务端下发的怪物配置 {id: {type, life, ...}}

    Returns:
        (成功标志, 错误信息)
    """
    remaining = result.get("remaining", 0)
    remaining_ids = result.get("remaining_monster_ids", [])

    # 如果 remaining 为 0，跳过验证（向后兼容）
    if remaining == 0:
        return True, ""

    # 1. 数量一致性
    if len(remaining_ids) != remaining:
        return False, f"remainingMonsterIds 数量与 remaining 不一致: {len(remaining_ids)} != {remaining}"

    # 2. ID 不重复
    if len(remaining_ids) != len(set(remaining_ids)):
        return False, "remainingMonsterIds 包含重复的怪物 ID"

    # 3. ID 有效性
    for mid in remaining_ids:
        if mid not in monsters_config:
            return False, f"未知的 remaining 怪物 ID: {mid}（不是服务端下发的 UUID）"

    # 4. 计算每个怪物的累计伤害
    damage_by_monster: dict[str, int] = {}
    for attack in attacks:
        mid = attack["monsterId"]
        damage_by_monster[mid] = damage_by_monster.get(mid, 0) + attack["damage"]

    # 5. 验证 remaining 怪物确实没被击杀
    for mid in remaining_ids:
        total_damage = damage_by_monster.get(mid, 0)
        monster_life = monsters_config[mid]["life"]
        if total_damage >= monster_life:
            return False, f"怪物 {mid} 累计伤害 {total_damage} >= 生命值 {monster_life}，应被击杀而非 remaining"

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
    """验证攻击事件中的怪物 ID 是否是服务端下发的有效 UUID

    验证项目：
    1. monsterId: 实际命中的怪物 ID
    2. originalTargetId: 发射时瞄准的怪物 ID（用于验证建筑有合法目标）

    两者都必须是服务端下发的有效 UUID。由于存在"误伤"机制，
    monsterId 可能与 originalTargetId 不同，但两者都必须有效。
    """
    for attack in attacks:
        # 验证实际命中的怪物 ID
        mid = attack["monsterId"]
        if mid not in monsters_config:
            return False, f"未知的 monsterId: {mid}（不是服务端下发的 UUID）"

        # 验证原始目标怪物 ID
        original_tid = attack.get("originalTargetId")
        if original_tid is not None and original_tid not in monsters_config:
            return False, f"未知的 originalTargetId: {original_tid}（不是服务端下发的 UUID）"

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
    """
    验证发射时的原始目标是否在建筑射程内。

    射程规则（与旧实现一致，参考 td-obj-building.js:187-204）：
    - range: 初始射程（1 级时的值）
    - max_range: 射程升级上限
    - 升级后射程：min(range * 1.2^(level-1), max_range)
    - 建筑可攻击 0 到当前射程内的任意目标（无最小射程限制）

    注意：由于子弹存在"误伤"机制，实际命中的怪物 (monsterPosition) 可能在射程外，
    但发射时的原始目标 (originalTargetPosition) 必须在射程内。
    """
    bx, by = building["position"]
    # 使用原始目标位置进行验证，而不是实际命中位置
    tx, ty = attack["originalTargetPosition"]

    distance = math.sqrt((bx - tx) ** 2 + (by - ty) ** 2)

    # 计算当前射程：range 每级 × 1.2，但不超过 max_range
    base_range = building_config[building["type"]]["range"]
    max_range = building_config[building["type"]]["max_range"]
    level_factor = 1.2 ** (building["level"] - 1)
    current_range = min(base_range * level_factor, max_range)

    # 只验证最大射程（无最小射程限制，与旧实现一致）
    if distance > current_range + 1:  # 1 格容差（怪物可能在格子边缘）
        return False, f"目标太远: 建筑 {building['id']} 射程 {current_range:.1f}, 目标距离 {distance:.1f}"

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
    # 重要：保持浮点精度，仅在最后截断
    expected_damage = float(base_damage)
    for _ in range(1, level):
        expected_damage = expected_damage * 1.2
    expected_damage = int(expected_damage)

    # 实际伤害 = max(建筑伤害 - 怪物护盾, 建筑伤害 × 0.1)
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
    """验证怪物路径合理性（只检查合法性，不检查精确性）

    设计说明：
    旧实现的路径系统具有不可预测性：
    1. 路径回溯时若有多条等距路径会随机选择一条
    2. 怪物每帧有 10% 概率自动重新寻路
    3. 玩家建造建筑会改变地图，触发路径重算

    因此服务端无法精确重建怪物路径，只能验证路径的合法性：
    - 怪物整体朝出口方向移动（最后位置比第一位置更接近出口）
    - 允许一定容差（绕路、避障）

    这能防止：反向移动、瞬移等明显作弊行为
    无法防止：走非最优路径（但这在旧实现中本来就可能发生）
    """
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

- 伤害总和一致性: attacks 伤害总和 = result.totalDamageDealt，防止伪造总伤害
- 攻击帧号时序: 帧号递增，防止伪造攻击时序
- 怪物 ID 有效性: monsterId 和 originalTargetId 都必须是服务端下发的 UUID，防止伪造怪物 ID
- 原始目标验证: originalTargetId 确保建筑发射时有合法目标（支持"误伤"机制）
- 累计伤害验证: 被击杀怪物的累计伤害 >= 生命值，防止减少怪物生命值
- 击杀数量一致性: 根据伤害计算的击杀数 = 上报的击杀数，防止伪造击杀结果
- 射程验证: 攻击时怪物在建筑射程内，防止增加射程
- 伤害值合法性: 伤害 <= 建筑伤害且伤害 >= 1，防止增加伤害
- 路径合理性: 怪物整体朝出口方向移动，防止反向移动刷分（注：只验证方向合法性，不验证具体路径，因为旧实现的路径有随机性和动态性）
- remaining 怪物验证: remainingMonsterIds 必须是有效 UUID 且累计伤害 < 生命值，防止把 passed 怪物伪装成 remaining 来避免生命损失

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

- `SESSION_NOT_FOUND`: 会话不存在或已被清理，客户端应提示并重新加载页面
- `VALIDATION_FAILED`: 数据验证失败，客户端应显示错误信息
- `INVALID_REQUEST`: 请求格式错误，客户端应显示错误信息

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
    remaining = models.IntegerField(default=0)  # 提前结束时场上剩余的怪物数（只存储数量，不存储 ID 列表）
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

- `POST /wave`: 创建第 1 ~ N-1 波的记录，普通波次验证通过后创建
- `POST /end`: 创建第 N 波的记录，最后一波从 lastWave 创建

> **原则**：WaveRecord 只创建不更新，是不可变的历史记录。

**remaining_monster_ids 存储策略**：

API 请求中的 `remainingMonsterIds` 字段只用于验证，验证通过后不持久化存储。原因如下：

- **验证时使用**：服务端使用 `remainingMonsterIds` 验证客户端没有作弊（如把 passed 的怪物伪装成 remaining 来避免生命损失）
- **验证后丢弃**：验证通过后，只存储 `remaining` 数量到 `WaveRecord`，ID 列表不再有用途
- **可反推性**：如需回溯，可从攻击记录反推（累计伤害 < 生命值且不在 killed/passed 中的怪物）
- **存储效率**：存储一个整数比存储 UUID 列表更高效

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

每局游戏上限 24 小时，超时自动清理。

**使用方式**：

```bash
# 清理超过 24 小时的会话（默认）
python manage.py cleanup_sessions

# 清理超过 12 小时的会话（自定义）
python manage.py cleanup_sessions --hours=12
```

**定时执行（cron）**：

```cron
# 每小时执行一次清理
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
