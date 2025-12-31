# 塔防游戏技术规范

本文档描述基于 Vue 3 + Phaser 3 重写的塔防游戏核心流程，包含防作弊验证机制。

---

## 目录

1. [技术栈](#技术栈)
2. [整体架构](#整体架构)
3. [游戏生命周期](#游戏生命周期)
4. [API 定义](#api-定义)
5. [客户端数据记录](#客户端数据记录)
6. [服务端验证逻辑](#服务端验证逻辑)
7. [错误处理](#错误处理)
8. [会话管理](#会话管理)

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
    │   result, endState, buildings}              │
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
    │  {sessionId, finalState, stats, nickname}   │
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
| `/api/game/sessions/end` | POST | 游戏结束 | 提交最终结果，返回排名 |

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
    };
  };

  firstWave: {
    waveNumber: 1;
    monsters: Array<{
      type: number;
      count: number;
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

  // 本波所有建筑操作
  actions: Array<{
    type: 'BUILD' | 'UPGRADE' | 'SELL';
    frame: number;                 // 操作发生的帧号
    buildingType?: string;         // BUILD 时的建筑类型
    buildingId: string;            // 建筑唯一 ID
    position?: [number, number];   // BUILD 时的位置
    cost?: number;                 // BUILD/UPGRADE 的花费
    income?: number;               // SELL 的收入
    level?: number;                // UPGRADE 后的等级
  }>;

  // 战斗结果
  result: {
    killed: number;                // 击杀怪物数
    passed: number;                // 穿过终点的怪物数
    scoreGained: number;           // 获得分数
    moneyGained: number;           // 获得金钱
    lifeLost: number;              // 损失生命
    totalDamageDealt: number;      // 总伤害输出
    totalLifeDestroyed: number;    // 击杀怪物的总生命值
    waveDurationFrames: number;    // 波次持续帧数
  };

  // 波次结束时的状态
  endState: {
    money: number;
    score: number;
    life: number;
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
  };

  // 下一波配置（游戏继续时返回）
  nextWave?: {
    waveNumber: number;
    monsters: Array<{
      type: number;
      count: number;
      life: number;
      speed: number;
      shield: number;
      money: number;
      score: number;
    }>;
    lifeReward?: number;           // 生命恢复奖励（每 5 波 +5，每 10 波 +10，不超过上限 100）
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

提交游戏最终结果，获取排名。

#### 请求

```typescript
interface GameEndRequest {
  sessionId: string;

  // 最终状态
  finalState: {
    money: number;
    score: number;
    life: number;
    wave: number;                  // 坚持到第几波
    totalFrames: number;           // 游戏总帧数
  };

  // 全局统计
  stats: {
    totalKilled: number;
    totalPassed: number;
    totalDamage: number;
    totalBuilt: number;
    totalEarned: number;
    totalSpent: number;
  };

  // 所有波次摘要
  waveSummaries: Array<{
    wave: number;
    killed: number;
    passed: number;
    score: number;
    money: number;
  }>;

  // 玩家昵称
  nickname: string;
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

## 客户端数据记录

### 记录时机

| 事件 | 记录内容 | 时机 |
|------|----------|------|
| 建造建筑 | type, frame, buildingType, position, cost | 立即记录 |
| 升级建筑 | type, frame, buildingId, cost, level | 立即记录 |
| 出售建筑 | type, frame, buildingId, income | 立即记录 |
| 造成伤害 | 累加到 totalDamageDealt | 每次攻击 |
| 击杀怪物 | 累加 kills, totalLifeDestroyed | 击杀时 |
| 怪物穿过 | 累加 passed, lifeLost | 到达终点时 |

### 波次记录结构

```typescript
interface WaveRecord {
  waveNumber: number;
  startFrame: number;

  actions: Action[];

  result: {
    killed: number;
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

---

## 服务端验证逻辑

### Level 1：基础验证

```python
# game/validators.py

def validate_basic(result: dict, wave_config: dict, monster_config: dict) -> tuple[bool, str]:
    """基础验证：收益上限、数量一致性"""

    # 金钱收益验证
    max_money = sum(
        k["count"] * monster_config[k["type"]]["money"]
        for k in wave_config["monsters"]
        if k["type"] in monster_config
    )
    if result["money_gained"] > max_money:
        return False, "金钱收益超出上限"

    # 分数收益验证
    max_score = sum(
        k["count"] * monster_config[k["type"]]["score"]
        for k in wave_config["monsters"]
    )
    if result["score_gained"] > max_score:
        return False, "分数收益超出上限"

    # 数量一致性验证
    total_monsters = sum(m["count"] for m in wave_config["monsters"])
    if result["killed"] + result["passed"] != total_monsters:
        return False, "怪物数量不一致"

    return True, ""
```

### Level 2：伤害验证

```python
def validate_damage(
    result: dict,
    buildings: list[dict],
    wave_config: dict,
    monster_config: dict,
    building_config: dict,
) -> tuple[bool, str]:
    """伤害验证：生命池、DPS 容量"""

    # 生命池验证
    expected_life = sum(
        m["count"] * monster_config[m["type"]]["life"]
        for m in wave_config["monsters"]
        if m["count"] <= result["killed"]
    )
    if result["total_life_destroyed"] != expected_life:
        return False, "生命池验证失败"

    # 伤害下限验证
    if result["total_damage_dealt"] < result["total_life_destroyed"]:
        return False, "伤害值不足以击杀"

    # DPS 容量验证
    max_dps = sum(
        building_config[b["type"]]["damage"] * b["level"] / building_config[b["type"]]["speed"]
        for b in buildings
    )
    max_damage = max_dps * result["wave_duration_frames"]
    if result["total_damage_dealt"] > max_damage * 1.1:  # 10% 容差
        return False, "DPS 容量超限"

    return True, ""
```

### Level 4：统计分析

```python
import logging

logger = logging.getLogger(__name__)


def analyze_statistics(result: dict, total_building_cost: int, historical_average: float) -> None:
    """统计分析：检测异常行为"""

    total = result["killed"] + result["passed"]
    if total == 0:
        return

    # 击杀率异常检测
    kill_rate = result["killed"] / total
    if kill_rate > 0.99 and result["wave_duration_frames"] < 1000:
        logger.warning("击杀率异常高且时间过短", extra={"result": result})

    # 资源效率异常检测
    if total_building_cost > 0:
        efficiency = result["score_gained"] / total_building_cost
        if efficiency > historical_average * 2:
            logger.warning("资源效率异常高", extra={"result": result})
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

    # 配置（JSON 存储）
    config = models.JSONField()
    next_wave = models.JSONField()

    class Meta:
        db_table = "game_session"
        indexes = [
            models.Index(fields=["created_at"]),
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
2. **波次提交**（POST /api/game/sessions/wave）：验证数据，更新 state
3. **游戏结束**（POST /api/game/sessions/end）：最终验证，记录排行榜，删除会话
4. **会话不存在**：返回 `SESSION_NOT_FOUND`，客户端提示用户重新开始

### 过期处理流程

```
创建会话 → 24 小时后 → 定时任务删除
                            ↓
            下次请求返回 SESSION_NOT_FOUND
                            ↓
              客户端提示"会话已失效，请重新开始"
```
