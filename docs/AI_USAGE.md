# AI 辅助开发记录

本文档记录使用 Claude Code 辅助开发塔防游戏的完整流程和参考 Prompt。

## 1. 分析旧项目

旧项目地址: https://github.com/oldcai/html5-tower-defense

克隆到本地后，使用 Claude Code 逐步分析。

### 1.1 分析游戏核心流程

```
@/home/jinmiaoluo/repo/html5-tower-defense

分析这个塔防游戏的核心流程，包括：
- 游戏生命周期（开始、进行、结束）
- 波次系统（生成、间隔、难度调整）
- 主循环逻辑
```

### 1.2 分析游戏实体

```
@/home/jinmiaoluo/repo/html5-tower-defense

分析游戏中的主要实体：
- 怪物：属性、类型、移动逻辑
- 建筑：属性、类型、攻击逻辑
- 子弹：飞行、碰撞检测
- 地图：格子系统、路径计算
```

### 1.3 分析主要规则

```
@/home/jinmiaoluo/repo/html5-tower-defense

分析游戏的核心规则：
- 伤害计算（护盾减伤）
- 得分计算
- 经济系统（建造、升级、出售）
- 路径系统（BFS 寻路、动态重算）
```

## 2. 排行榜功能设计

### 2.1 校验方案调研

```
@/home/jinmiaoluo/repo/html5-tower-defense

如果要加入排行榜功能，需要防止作弊。分析：
- 客户端验证的局限性
- 服务端需要验证哪些内容
- 哪些游戏逻辑必须服务端可重放
```

### 2.2 校验分级

```
@/home/jinmiaoluo/repo/html5-tower-defense

将校验流程按实现复杂度分级：
- Level 1: 基础验证（数量一致性、收益上限）
- Level 2: 伤害验证（生命池、DPS 容量、射程、伤害值、累计伤害）
- Level 3: 确定性事件重放（路径选择）
- Level 4: 统计异常检测
```

## 3. 开发规划

### 3.1 开发方式

```
@/home/jinmiaoluo/repo/html5-tower-defense

基于 Mock + TDD 的前后端并行开发，给出注意事项：
- 前端如何使用 Mock 数据
- 后端如何使用 TDD
- 前后端如何对接
```

### 3.2 开发优先级

```
@/home/jinmiaoluo/repo/html5-tower-defense

确认开发优先级、MVP 和里程碑：
- P0: 项目初始化、数据模型、游戏配置
- P1: 核心系统（计算器、验证器、游戏实体）
- P2: API 层、状态管理
- P3: UI 组件、部署
```

## 4. 文档输出

```
@/home/jinmiaoluo/repo/html5-tower-defense

将核心部分进行文档描述，输出到 docs 目录：
- SPEC.md: 游戏规则、技术栈、整体架构
- BACKEND_GUIDE.md: 计算器、验证器、API 规范
- FRONTEND_GUIDE.md: 核心系统、游戏实体、类型定义
```

## 5. 文档驱动开发

使用 git worktree + vscode workspace，主仓库只有 docs，前后端作为不同的 worktree 分开实现。

### 5.1 实现任务

```
参考设计文档：

@docs/SPEC.md
@docs/BACKEND_GUIDE.md
@docs/FRONTEND_GUIDE.md

参考旧实现的代码：

@/home/jinmiaoluo/repo/html5-tower-defense

基于 TDD 的方式，给出实现，需求如下：

<具体需求>
```

### 5.2 质量核对

每实现一个任务，基于旧实现和文档进行核对：

```
参考旧实现的代码：

@/home/jinmiaoluo/repo/html5-tower-defense

和设计文档：

@docs/SPEC.md
@docs/BACKEND_GUIDE.md
@docs/FRONTEND_GUIDE.md

解释当前仓库中 git 改动是否充分且合理，如果不合理，解释原因，给出改进意见。

确认跟旧实现是否有严重不一致之处，解释原因，分析必要性。

如果需要更新文档，请给出必要性的原因。

如果有改动，基于 TDD 的方式进行验证。
```

### 5.3 问题修复

如果核对出现问题，进行修复：

```
参考旧实现的代码：

@/home/jinmiaoluo/repo/html5-tower-defense

和设计文档：

@docs/SPEC.md
@docs/BACKEND_GUIDE.md
@docs/FRONTEND_GUIDE.md

再次核对问题，确认问题是否存在，如果的确存在，请给出具体原因和建议，基于 TDD 的方式修复问题。

确认跟旧实现是否有严重不一致之处，解释原因，分析必要性。

确认是否需要更新文档。

问题如下：

<具体问题>
```

### 5.4 提交改动

问题解决后提交，开始下一个任务，循环直到结束。

## 总结

开发流程：

- 分析旧项目: 理解核心流程、实体、规则
- 功能设计: 排行榜校验方案、分级实现
- 开发规划: Mock + TDD、优先级、里程碑
- 文档输出: 规范文档作为开发依据
- 迭代开发: 实现 -> 核对 -> 修复 -> 提交
