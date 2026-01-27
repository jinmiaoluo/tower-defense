# 架构文档

本文档帮助新开发者快速理解 tower-defense 项目的整体架构。

## 目录

1. [系统概述](#系统概述)
2. [高层架构](#高层架构)
3. [目录结构](#目录结构)
4. [核心模块](#核心模块)
5. [设计决策](#设计决策)
6. [数据流](#数据流)
7. [扩展指南](#扩展指南)

## 系统概述

### 项目目标

使用现代技术栈重写经典塔防游戏，核心挑战是**防作弊**：客户端执行游戏逻辑，服务端验证结果的可信性。

### 技术栈选型

**前端**：

- Vue 3 + TypeScript：UI 层，状态管理
- Phaser 3：游戏引擎，处理渲染和游戏循环
- Pinia：跨组件状态共享

**后端**：

- Django + DRF：API 服务，数据验证
- PostgreSQL：持久化存储

**选型理由**：

- Phaser 3 提供成熟的 2D 游戏引擎能力，避免重复造轮子
- Vue 3 处理游戏外的 UI（排行榜、设置面板），与 Phaser 解耦
- Django 的 ORM 和验证框架适合实现复杂的防作弊逻辑

### 架构风格

前后端分离的单体应用：

- 前端：SPA，包含完整游戏逻辑
- 后端：RESTful API，无状态服务
- 通信：HTTP JSON，每波次结束时批量提交

## 高层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │   Vue UI     │   │   Phaser     │   │    Pinia     │    │
│  │  Components  │◄──│   Game       │──►│    Store     │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│         │                  │                   │            │
│         └──────────────────┼───────────────────┘            │
│                            │                                │
│                     ┌──────▼──────┐                         │
│                     │   API Layer │                         │
│                     └──────┬──────┘                         │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP/JSON
┌────────────────────────────┼────────────────────────────────┐
│                        Backend                              │
│                     ┌──────▼──────┐                         │
│                     │    Views    │                         │
│                     └──────┬──────┘                         │
│                            │                                │
│  ┌──────────────┐   ┌──────▼──────┐   ┌──────────────┐     │
│  │  Generators  │──►│  Validators │◄──│ Calculators  │     │
│  └──────────────┘   └──────┬──────┘   └──────────────┘     │
│                            │                                │
│                     ┌──────▼──────┐                         │
│                     │   Models    │                         │
│                     │ (PostgreSQL)│                         │
│                     └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### 组件职责

- **Vue UI**：游戏外界面（排行榜、设置、游戏结束弹窗）
- **Phaser Game**：游戏核心（渲染、物理、游戏循环）
- **Pinia Store**：游戏状态（金钱、生命、分数、建筑列表）
- **API Layer**：封装后端通信，支持 Mock 切换
- **Views**：API 端点，协调验证流程
- **Validators**：多层验证逻辑（基础/伤害/统计）
- **Calculators**：纯函数计算（成本、伤害、难度）
- **Generators**：波次配置生成（随机算法）
- **Models**：数据持久化（会话、波次记录、排行榜）

## 目录结构

```
tower-defense/
├── frontend/
│   └── src/
│       ├── api/              # API 封装层
│       ├── components/       # Vue 组件
│       ├── game/             # Phaser 游戏核心
│       │   ├── entities/     # 游戏实体（Monster, Building）
│       │   ├── systems/      # 游戏系统（核心逻辑）
│       │   ├── render/       # 渲染器（与 Phaser 解耦）
│       │   └── scenes/       # Phaser 场景
│       ├── mocks/            # Mock 数据（开发用）
│       ├── stores/           # Pinia 状态管理
│       ├── types/            # TypeScript 类型定义
│       └── i18n/             # 国际化
│
├── backend/
│   ├── config/               # Django 配置
│   ├── game/                 # 游戏应用
│   │   ├── models.py         # 数据模型
│   │   ├── views.py          # API 视图
│   │   ├── validators.py     # 验证逻辑
│   │   ├── calculators.py    # 计算逻辑
│   │   ├── generators.py     # 波次生成
│   │   └── config.py         # 游戏配置
│   └── tests/                # 测试文件
│
└── docs/                     # 文档
```

### 前端架构风格

目录命名借鉴 ECS（Entity-Component-System）概念，但实际实现是 OOP：

- `entities`：OOP 类，包含数据和行为（Monster、Building）
- `systems`：服务层，提供跨实体的工具函数
- `render`：渲染层，与实体解耦

### 关键目录说明

**frontend/src/game/systems/**：游戏核心逻辑，与渲染解耦

- `PathSystem`：BFS 寻路算法
- `GridSystem`：地图格子状态、建筑放置验证
- `DamageSystem`：伤害计算（含护盾减伤）
- `BuildingSystem`：建筑成本、升级、射程计算
- `BulletSystem`：子弹飞行、碰撞检测
- `WaveManager`：波次状态机、怪物生成调度
- `WaveRecorder`：记录提交数据（操作、攻击、结果）
- `GameSceneLogic`：场景主循环，协调各系统

**frontend/src/game/render/**：渲染层，依赖 Phaser

- `PhaserAdapter`：Phaser API 适配器
- `MonsterRenderer`：怪物渲染
- `BuildingRenderer`：建筑渲染
- `BulletRenderer`：子弹渲染

**backend/game/**：后端验证逻辑

- `validators.py`：Level 1/2/4 验证
- `calculators.py`：成本、难度、伤害计算
- `generators.py`：波次配置生成

## 核心模块

### 前端模块依赖

```
GameSceneLogic (协调者)
    │
    ├── WaveManager (波次状态)
    │       └── Monster (游戏实体)
    │
    ├── GridSystem (地图状态)
    │       └── PathSystem (寻路)
    │
    ├── BuildingSystem (建筑计算)
    │       └── Building (游戏实体)
    │
    ├── BulletSystem (子弹物理)
    │       └── DamageSystem (伤害计算)
    │
    └── WaveRecorder (数据记录)
            └── API Layer (提交)
```

### 后端模块依赖

```
Views (API 入口)
    ├── Generators (波次生成)
    ├── Validators (数据验证)
    │       ├── validate_basic (Level 1)
    │       └── validate_damage, validate_attacks (Level 2)
    ├── Calculators (计算逻辑)
    │       ├── process_actions (操作处理)
    │       ├── calc_new_difficulty (难度调整)
    │       └── calc_monster_attrs (怪物属性)
    └── Models (数据持久化)
            ├── GameSession
            ├── WaveRecord
            └── LeaderboardEntry
```

## 设计决策

### ADR-1: 客户端执行 + 服务端验证

**背景**：塔防游戏需要实时交互，完全服务端计算会有延迟问题。

**决策**：游戏逻辑在客户端执行，服务端只做结果验证。

**替代方案**：
- 完全服务端计算：延迟高，体验差
- 完全信任客户端：易作弊

**权衡**：采用多层验证（Level 1 基础 + Level 2 伤害 + Level 4 统计）平衡安全性和开发成本。

### ADR-2: 帧号替代时间戳

**背景**：需要记录操作时序用于验证。

**决策**：使用帧号（frame）而非系统时间戳。

**理由**：
- 防止客户端系统时间被篡改
- 准确反映游戏实际运行时间（排除暂停）
- 服务端可基于帧号验证 DPS 容量

### ADR-3: 服务端随机波次生成

**背景**：服务端需要验证波次配置是否被篡改，同时保持游戏变化性。

**决策**：波次 11+ 使用随机生成算法，服务端生成完整配置并下发。

**实现方式**：
- 服务端生成怪物配置时为每只怪物分配唯一 UUID
- 完整配置（含 ID、属性）下发给客户端
- 验证时通过怪物 ID 精确匹配

**权衡**：增加少量网络传输，换取游戏随机性和验证准确性。

### ADR-4: 渲染与逻辑分离

**背景**：游戏逻辑需要单元测试，但 Phaser 依赖浏览器环境。

**决策**：将游戏逻辑（systems 目录）与渲染（render 目录）分离。

**实现**：
- `systems` 包含纯 TypeScript 逻辑，可在 Node.js 测试
- `render` 包含 Phaser 相关代码
- `PhaserAdapter` 作为适配层

## 数据流

### 游戏生命周期数据流

```
1. 页面加载
   Client ──POST /sessions──► Server
   Client ◄──config + firstWave── Server

2. 每波结束
   Client ──POST /sessions/wave──► Server
          (actions, attacks, result)
   Client ◄──serverState + nextWave── Server

3. 游戏结束
   Client ──POST /sessions/end──► Server
          (nickname, lastWave?)
   Client ◄──ranking── Server
```

### 波次内数据流

```
Frame Loop:
┌─────────────────────────────────────────────────────────┐
│  WaveManager.update()                                   │
│      │                                                  │
│      ▼                                                  │
│  Spawn Monster ──► Monster.update() ──► PathSystem      │
│                           │                             │
│                           ▼                             │
│  Building.findTarget() ──► BulletSystem.update()        │
│                                   │                     │
│                                   ▼                     │
│                           DamageSystem.calculate()      │
│                                   │                     │
│                                   ▼                     │
│                           WaveRecorder.recordAttack()   │
└─────────────────────────────────────────────────────────┘
```

### 状态同步策略

- **本地状态**：前端维护金钱、生命、分数、建筑列表
- **服务端权威**：每波结束后用 `serverState` 覆盖本地状态
- **配置来源**：所有游戏配置（建筑属性、怪物属性）从服务端获取，客户端不内置

## 扩展指南

### 添加新建筑类型

1. **后端配置**：`backend/game/config.py` 添加建筑属性
2. **前端渲染**：`frontend/src/game/render/BuildingRenderer.ts` 添加渲染逻辑
3. **测试**：添加计算器和渲染器测试

### 添加新怪物类型

1. **后端配置**：`backend/game/config.py` 添加怪物属性
2. **前端渲染**：`frontend/src/game/render/MonsterRenderer.ts` 添加渲染逻辑
3. **波次生成**：如需出现在自动生成波次，检查 `generators.py` 的轮询逻辑

### 添加新验证规则

1. **定义验证函数**：`backend/game/validators.py`
2. **集成到视图**：`backend/game/views.py` 的验证流程
3. **测试用例**：`backend/tests/test_validators.py`

### 修改游戏规则

1. **更新规范**：`docs/SPEC.md` 记录规则变更
2. **同步修改**：前端 systems/ 和后端 calculators/validators
3. **版本兼容**：考虑是否需要数据库迁移

### 开发注意事项

- **TDD 优先**：后端采用测试驱动开发，先写测试再实现
- **Mock 模式**：前端可通过 `VITE_USE_MOCK=true` 脱离后端开发
- **类型安全**：前后端共享类型定义，避免接口不一致

## 相关文档

- [技术规范](./SPEC.md)：详细的游戏规则和 API 定义
- [前端开发指南](./FRONTEND_GUIDE.md)：系统接口和测试规范
- [后端开发指南](./BACKEND_GUIDE.md)：验证器和计算器实现
