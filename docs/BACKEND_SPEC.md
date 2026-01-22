# 后端功能规范

本文档定义后端服务的功能需求和行为规范。

## 目录

1. [项目概述](#项目概述)
2. [功能需求](#功能需求)
3. [API 规范](#api-规范)
4. [数据模型](#数据模型)
5. [验证规则](#验证规则)
6. [边界条件与约束](#边界条件与约束)
7. [验收标准](#验收标准)

## 项目概述

### 背景

塔防游戏后端服务，负责游戏配置下发、结果验证和排行榜管理。

### 核心问题

- 防作弊：验证客户端提交的游戏数据可信性
- 配置权威：所有游戏配置由服务端定义
- 状态管理：维护游戏会话和波次记录

### 设计原则

- 服务端权威：怪物属性、建筑属性、波次配置由服务端定义
- 客户端零配置：客户端不内置任何游戏数值
- 渐进验证：每波验证一次，而非游戏结束时一次性验证
- 服务端生成：波次配置由服务端随机生成并下发给客户端

## 功能需求

### 核心功能

**会话管理**：

- 创建游戏会话，返回配置和第一波
- 接收波次提交，验证并返回下一波
- 结束游戏会话，记录排行榜
- 定时清理过期会话（24 小时）

**数据验证**：

- Level 1 基础验证：数量一致性、收益上限
- Level 2 伤害验证：生命池、DPS 容量、射程、伤害值、累计伤害
- Level 3 行为重放验证：完整模拟回放（未实现）
- Level 4 统计分析：异常检测

**排行榜**：

- 记录玩家成绩（昵称、分数、波次）
- 查询排行榜列表

### 扩展功能

- 验证失败日志记录
- 异常行为告警

### 可选功能

- 成绩回放验证
- 玩家历史记录

## API 规范

### 端点概览

- `POST /api/game/sessions` - 创建会话
- `POST /api/game/sessions/wave` - 提交波次
- `POST /api/game/sessions/end` - 结束游戏
- `GET /api/game/leaderboard` - 查询排行榜

### POST /api/game/sessions

创建游戏会话。

**请求**：无参数

**响应**：

```json
{
  "sessionId": "uuid",
  "config": {
    "buildings": { ... },
    "monsters": { ... },
    "map": { ... },
    "initial": { "money": 500, "life": 100, "difficulty": 1.0 }
  },
  "firstWave": {
    "waveNumber": 1,
    "monsters": [
      { "id": "uuid", "type": 0, "life": 50, "speed": 3.5, "shield": 0, "money": 5 }
    ]
  }
}
```

### POST /api/game/sessions/wave

提交波次结果。

**请求**：

```json
{
  "sessionId": "uuid",
  "waveNumber": 1,
  "actions": [
    { "type": "BUILD", "frame": 100, "buildingType": "cannon", "buildingId": "b-001", "position": [5, 5] }
  ],
  "attacks": [
    {
      "frame": 200,
      "buildingId": "b-001",
      "originalTargetId": "m-001",
      "originalTargetPosition": [6, 5],
      "monsterId": "m-001",
      "monsterPosition": [6, 5],
      "damage": 10
    }
  ],
  "result": {
    "killed": 3,
    "killedByType": { "0": 3 },
    "passed": 0,
    "scoreGained": 10,
    "moneyGained": 15,
    "lifeLost": 0,
    "totalDamageDealt": 150,
    "totalLifeDestroyed": 150,
    "waveDurationFrames": 1000
  },
  "buildings": [
    { "id": "b-001", "type": "cannon", "position": [5, 5], "level": 1, "damageDealt": 150, "kills": 3 }
  ]
}
```

**响应（成功）**：

```json
{
  "valid": true,
  "serverState": {
    "money": 515,
    "score": 10,
    "life": 100,
    "difficulty": 1.2
  },
  "nextWave": {
    "waveNumber": 2,
    "monsters": [ ... ],
    "lifeReward": 0
  }
}
```

**响应（失败）**：

```json
{
  "valid": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "击杀数量不一致"
  }
}
```

### POST /api/game/sessions/end

结束游戏会话。

**请求**：

```json
{
  "sessionId": "uuid",
  "nickname": "Player1",
  "lastWave": { ... }  // 可选，提前结束时不提供
}
```

**响应**：

```json
{
  "verified": true,
  "ranking": {
    "rank": 5,
    "total": 100,
    "isNewRecord": false
  }
}
```

### GET /api/game/leaderboard

查询排行榜。

**请求参数**：

- `limit`（可选）：返回条数，默认 10，最大 100

**响应**：

```json
{
  "entries": [
    { "rank": 1, "nickname": "Player1", "score": 1000, "wavesCompleted": 42, "createdAt": "2024-01-01T00:00:00Z" }
  ]
}
```

### 错误码

- `SESSION_NOT_FOUND`：会话不存在或已过期
- `VALIDATION_FAILED`：数据验证失败
- `INVALID_REQUEST`：请求格式错误

## 数据模型

### GameSession

游戏会话，存储游戏进行中的状态。

**字段**：

- `id` (UUID): 主键
- `created_at` (DateTime): 创建时间
- `money` (Integer): 当前金钱
- `score` (Integer): 当前分数
- `life` (Integer): 当前生命
- `wave_count` (Integer): 已完成波次数
- `difficulty` (Float): 当前难度系数
- `buildings` (JSON): 建筑列表
- `config` (JSON): 游戏配置
- `next_wave` (JSON): 下一波配置

**生命周期**：

- 创建：POST /sessions
- 更新：POST /sessions/wave
- 删除：POST /sessions/end 或定时清理

### WaveRecord

波次记录，不可变的历史数据。

**字段**：

- `id` (UUID): 主键
- `session` (FK): 关联会话
- `wave_number` (Integer): 波次号
- `created_at` (DateTime): 创建时间
- `killed` (Integer): 击杀数
- `passed` (Integer): 穿过数
- `remaining` (Integer): 剩余数（提前结束时）
- `score_gained` (Integer): 获得分数
- `money_gained` (Integer): 获得金钱
- `life_lost` (Integer): 损失生命
- `total_damage_dealt` (Integer): 总伤害
- `wave_duration_frames` (Integer): 持续帧数
- `money_spent` (Integer): 花费金钱（服务端计算）
- `money_income` (Integer): 回收金钱（服务端计算）
- `building_count` (Integer): 建筑数量
- `end_money/score/life/difficulty`: 状态快照

**约束**：

- `unique_together: [session, wave_number]`
- 只创建不更新

### LeaderboardEntry

排行榜条目。

**字段**：

- `id` (UUID): 主键
- `nickname` (String, max=32): 玩家昵称
- `score` (Integer): 最终得分
- `waves_completed` (Integer): 完成波次
- `created_at` (DateTime): 记录时间

**排序**：

- 主排序：score 降序
- 次排序：waves_completed 降序

## 验证规则

采用多层验证架构，详见 [安全设计文档](./SECURITY.md)。

**验证层级概览**：

- Level 1 基础验证：数量一致性、金钱收益
- Level 2 伤害验证：生命池、DPS 容量、射程、伤害值、累计伤害
- Level 4 统计分析：异常检测（仅记录日志）

### 状态计算

波次验证通过后，服务端计算新状态：

```
new_money = old_money - spent + income + moneyGained
new_score = old_score + scoreGained
new_life = old_life - lifeLost
new_difficulty = calc_new_difficulty(old_difficulty, lifeLost, wave)
```

## 边界条件与约束

### 输入限制

**昵称**：

- 长度：1-32 字符
- 不能为纯空白

**分数**：

- 必须大于 0 才能上榜

**波次**：

- 必须连续提交，不能跳波

### 业务规则

**难度调整**：

- Wave 1 不调整难度
- 0 伤害：难度增加 5%-20%
- 受伤：难度降低 10%-40%
- 难度最小值：1.0

**生命奖励**：

- 每 5 波：+5 生命
- 每 10 波：+10 生命
- 不超过 100

**会话有效期**：

- 最长 24 小时
- 超时自动清理

### 已知限制

- 不支持 Level 3 行为重放验证
- 路径验证只检查方向合法性，不验证具体路径
- 统计分析仅记录日志，不阻断请求

## 验收标准

### 功能验收

**会话管理**：

- 创建会话返回正确配置
- 波次提交后状态正确更新
- 游戏结束后会话被删除
- 过期会话被正确清理

**数据验证**：

- Level 1 验证拦截数量不一致
- Level 2 验证拦截 DPS 超限和伪造攻击
- 验证失败返回正确错误信息

**排行榜**：

- 成绩正确记录
- 排名正确计算
- 查询返回正确结果

### 测试场景

- 正常游戏：完整流程测试
- 验证失败：各层级验证错误测试
- 会话过期：SESSION_NOT_FOUND 测试
- 并发提交：防止重复提交测试
- 边界值：0 分、最大波次等

### 性能指标

- API 响应：< 200ms（P95）
- 验证耗时：< 100ms
- 数据库查询：< 50ms
