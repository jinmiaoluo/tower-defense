# 前端开发指南

## 开发模式

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

## 开发优先级

- P0 项目初始化: Vite + Vue 3 + TypeScript + Phaser 3 + Vitest
- P0 类型定义 + Mock: 所有开发的基础
- P1 核心系统 (TDD): PathSystem, DamageSystem, BuildingSystem, EconomySystem, BulletSystem, WaveManager, WaveRecorder
- P1 Phaser 实体: Monster, Building, GameScene
- P2 状态管理: Pinia Store
- P2 API 层: Mock -> 真实 API 切换
- P3 Vue UI: GameHeader, BuildingPanel, GameOverModal, LeaderboardView

## 核心系统

详细测试用例见各模块同目录下的 `*.spec.ts` 文件。

### PathSystem

负责怪物路径计算。使用动态寻路算法（BFS），与旧实现保持一致。

**核心特性**：

- 每个怪物独立计算路径，不共享
- 怪物每帧有 10% 概率自动重新寻路
- 寻路回溯时若有多条等距路径，随机选择一条
- 建筑放置后该格子变为不可通行，影响后续怪物的路径计算

**怪物重新寻路触发条件**：

- 路径列表为空时
- 每步有 10% 概率自动重新寻路（模拟随机移动）
- 下一步格子变为不可通行时（如被新建筑占据）

> **来源**: 旧实现 `td-obj-monster.js:184-203` getNextGrid()

```typescript
interface PathSystem {
  generatePath(mapConfig: MapConfig): Position[]
  generatePathFrom(startPosition: Position, mapConfig: MapConfig): Position[]
  getPositionAtProgress(path: Position[], progress: number): { x: number; y: number }
  canReachExit(startPosition: Position, excludePosition?: Position): boolean
}
```

### GridSystem

负责地图格子状态管理和建筑放置验证。

**双层检查机制**：

建筑放置时需要通过两层检查：

1. 路径检查: 确保入口到出口的路径不被完全阻断
2. 怪物检查: 确保地图上已有的怪物不会被新建筑完全阻塞

> **注意**: 可以阻断怪物的当前最短路线（怪物会重新寻路走更远的路线），但不能使怪物完全无路可走。

> **来源**: 旧实现 `td-obj-grid.js:47-77` checkBlock()

```typescript
interface GridSystem {
  canPlaceBuilding(position: Position, monsterPositions: Position[]): boolean
  wouldBlockPath(position: Position): boolean
  wouldBlockMonster(buildPosition: Position, monsterPosition: Position): boolean
  isPassable(position: Position): boolean
  placeBuilding(position: Position, buildingId: string): boolean
  removeBuilding(position: Position): boolean
  findPathFromPosition(position: Position): Position[]
  findPathFromPositionExcluding(position: Position, excludePosition: Position): Position[]
}
```

### DamageSystem

负责伤害和得分计算。

公式：
- 实际伤害 = `max(rawDamage - shield, rawDamage × 0.1)`
- 命中得分 = `floor(√actualDamage)`

```typescript
interface DamageSystem {
  calculate(rawDamage: number, shield: number): number
  calculateScore(actualDamage: number): number
  isKilled(monster: Monster, damage: number): boolean
}
```

### BuildingSystem

负责建筑相关计算，包括成本、伤害、射程和金钱检查。

```typescript
interface BuildingSystem {
  getTotalCost(type: string, level: number): number
  getUpgradeCost(type: string, level: number): number
  getSellIncome(type: string, level: number): number
  getDamageAtLevel(type: string, level: number): number
  getRangeAtLevel(type: string, level: number): number
  isInRange(building: Building, targetPos: [number, number]): boolean
  getAttackSpeedFrames(type: string): number
  canAfford(money: number, type: string): boolean
  canAffordUpgrade(money: number, type: string, level: number): boolean
  isWeapon(type: string): boolean
  getBuildingConfig(type: string): BuildingConfig
}
```

### EconomySystem

负责波次生命奖励计算。

规则：每 5 波 +5 生命，每 10 波 +10 生命，上限 100。

```typescript
interface EconomySystem {
  getLifeReward(waveNumber: number): number
  applyLifeReward(currentLife: number, reward: number): number
}
```

### BulletSystem

负责子弹的创建、飞行和碰撞检测。保持与旧实现一致的物理规则。

**速度计算公式**:

```typescript
// 子弹实际速度 = bullet_speed × 20 × GLOBAL_SPEED
// GLOBAL_SPEED = 0.1，所以实际为: bullet_speed × 2 像素/帧
// 例如: cannon bullet_speed=6 → 实际速度 = 6 × 20 × 0.1 = 12 像素/帧
```

> **与怪物速度的对比**: 怪物速度公式为 `speed × GLOBAL_SPEED`（无 20 倍系数）。子弹额外的 20 倍系数确保子弹飞行速度远快于怪物移动速度。来源: 旧实现 `td-obj-building.js:466`。

```typescript
interface Bullet {
  id: string
  building: Building
  damage: number
  speed: number
  x: number
  y: number
  vx: number
  vy: number
  originalTargetId: string
  originalTargetPosition: [number, number]
}

class BulletSystem {
  createBullet(config: { building, target, damage, speed, position }): Bullet
  update(monsters: Monster[], mapBounds: Rect, recorder: WaveRecorder): void
  getBullets(): Bullet[]
}
```

**核心逻辑**：

1. 检查是否飞出地图（miss，不记录攻击事件）
2. 检查是否命中任意怪物（可命中非原目标，即误伤机制）
3. 命中时记录攻击事件（包含原始目标和实际命中信息）
4. 移动子弹

**碰撞检测公式**（与旧实现一致）：

```typescript
const hitRadius = (monster.radius + bullet.radius) * Math.sqrt(2)
// 距离 <= hitRadius 时判定命中
```

### WaveManager

负责波次状态管理和怪物生成调度。

```typescript
type WaveState = 'idle' | 'spawning' | 'fighting' | 'interval' | 'completed'

class WaveManager {
  state: WaveState
  startWave(waveConfig: WaveConfig): void
  update(currentFrame: number): WaveMonster | null
  registerMonster(monster: Monster): void
  onMonsterRemoved(monster: Monster): void
  isWaveComplete(): boolean
  getAliveMonsters(): Monster[]
  startInterval(): void
  isIntervalComplete(): boolean
}
```

**状态流转**：

```
idle → (startWave) → spawning → (所有怪物生成完毕) → fighting
                                                        ↓
                                            (所有怪物死亡/穿过)
                                                        ↓
interval ← (startInterval) ← completed ← (isWaveComplete)
    ↓
(isIntervalComplete)
    ↓
  idle → 等待下一波 startWave
```

### WaveRecorder（关键）

负责记录所有需要提交给服务端的数据。

```typescript
class WaveRecorder {
  constructor(waveNumber: number, startFrame: number)

  // 建筑操作
  recordBuild(id, type, position, frame): void
  recordUpgrade(id, level, frame): void
  recordSell(id, frame): void

  // 攻击事件（包含原始目标和实际命中信息）
  recordAttack(event: {
    buildingId, originalTargetId, originalTargetPosition,
    monsterId, monsterPosition, damage, frame
  }): void

  // 战斗结果
  recordKill(monsterType, monsterLife): void
  recordPassed(damage): void
  recordSpawn(): void
  recordRemainingMonster(monsterId): void
  addMoney(amount): void
  addScore(amount): void
  setDuration(currentFrame): void

  // 导出
  getActions(): Action[]
  getAttacks(): AttackEvent[]
  getResult(): WaveResult
  getRemainingMonsterIds(): string[]
  toWaveRequest(sessionId, buildings): WaveRequest
  reset(newWaveNumber, newStartFrame): void
}
```

**waveDurationFrames 计算**：

- 起点：波次第一个怪物生成的帧号
- 终点：波次最后一个怪物死亡或穿过的帧号
- 暂停时帧号不增长，只记录实际游戏进行的帧数

## 游戏实体

### Monster

```typescript
class Monster extends Phaser.GameObjects.Sprite {
  id: string           // 服务端下发的 UUID
  type: number
  maxLife: number
  currentLife: number
  speed: number
  shield: number
  money: number
  damage: number       // 从 config.monsters[type].damage 获取
  color: string        // 从 config.monsters[type].color 获取
  progress: number     // 路径进度 0-1

  takeDamage(rawDamage: number): number
  isDead(): boolean
  reachedExit(): boolean
  getGridPosition(): [number, number]
}
```

### Building

```typescript
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

**攻击机制**：

- 子弹飞行: 有物理轨迹，按固定方向直线飞行
- 可能 miss: 目标移走后子弹可能飞出地图
- 误伤机制: 子弹可以命中路径上的任意怪物
- laser_gun: 即时命中，无子弹飞行

## 状态管理

```typescript
interface GameState {
  sessionId: string | null
  config: GameConfig | null
  money: number
  score: number
  life: number
  difficulty: number
  waveNumber: number
  buildings: BuildingState[]
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

## API 层

```typescript
export const gameApi = {
  createSession(): Promise<GameStartResponse>
  submitWave(request: WaveRequest): Promise<WaveResponse>
  endGame(request: GameEndRequest): Promise<GameEndResponse>
  getLeaderboard(limit?: number): Promise<LeaderboardResponse>
}
```

## Vue 组件

- `GameHeader.vue`: 显示金钱、生命、分数、波次
- `BuildingPanel.vue`: 建筑选择面板，升级/出售按钮
- `PhaserCanvas.vue`: Phaser 游戏容器
- `GameOverModal.vue`: 游戏结束弹窗 + 昵称输入
- `LeaderboardView.vue`: 排行榜展示
- `ErrorToast.vue`: 错误提示

## 测试规范

使用 Vitest 编写单元测试，测试文件位于 `frontend/src/game/systems/*.spec.ts`。

## 注意事项

1. **怪物 ID 必须使用服务端 UUID**：不能自己生成，必须使用 `firstWave`/`nextWave` 中下发的 `monster.id`
2. **状态同步**：每波结束后用 `serverState` 覆盖本地状态
3. **生命奖励时序**：`lifeReward` 在下一波开始前应用，不是立即应用
4. **帧号记录**：所有操作和攻击都要记录准确的帧号
5. **攻击位置记录**：攻击时记录怪物的格子坐标，用于服务端路径验证
6. **提前结束功能**：支持两种结束方式
   - 波次进行中结束：调用 `/end` 带 `lastWave` 数据，需要记录 `result.remaining` 表示场上剩余怪物数
   - 波次完成后结束：调用 `/end` 不带 `lastWave`（必须至少完成一波）
7. **remaining 字段**：提前结束时使用
   - `remaining` 表示场上还未被击杀也未穿过终点的怪物数
   - 验证公式：`killed + passed + remaining == spawned`
   - 该字段可选，默认为 0（向后兼容）
8. **spawned 字段**：记录实际生成的怪物数
   - 怪物是逐帧生成的，提前结束时可能部分怪物尚未生成
   - `spawned` 表示已经进入游戏场景的怪物总数
   - 约束：`spawned <= total_monsters`（不能超过波次配置的怪物总数）
   - 该字段可选，默认为波次配置的怪物总数（向后兼容）
   - 在 `GameSceneLogic.spawnMonster()` 中调用 `WaveRecorder.recordSpawn()` 记录
9. **remainingMonsterIds 字段**：配合 `remaining` 使用的防作弊字段
   - 当 `remaining > 0` 时必须提供 `remainingMonsterIds` 数组
   - 数组中的 ID 必须是服务端下发的有效 UUID
   - 数组长度必须等于 `remaining` 的值
   - 这些怪物必须确实没有被击杀（累计伤害 < 生命值）
   - 这些怪物 ID 必须是前 `spawned` 个已生成的怪物（不能使用未生成的怪物 ID）
   - 使用 `WaveRecorder.recordRemainingMonster(monsterId)` 记录在场怪物
10. **会话过期处理**：当服务端返回 `SESSION_NOT_FOUND` 错误时
    - 显示提示告知用户会话已失效
    - 自动重启游戏创建新会话
    - 详见 SPEC.md 错误处理章节
