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

## 目录结构

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

## 开发优先级

- P0 项目初始化: Vite + Vue 3 + TypeScript + Phaser 3 + Vitest
- P0 类型定义 + Mock: 所有开发的基础
- P1 核心系统 (TDD): PathSystem, DamageSystem, BuildingSystem, EconomySystem, BulletSystem, WaveManager, WaveRecorder
- P1 Phaser 实体: Monster, Building, GameScene
- P2 状态管理: Pinia Store
- P2 API 层: Mock -> 真实 API 切换
- P3 Vue UI: GameHeader, BuildingPanel, GameOverModal, LeaderboardView

## 核心系统

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

当建筑阻断怪物当前路线时，怪物会自动重新寻路，可能选择更远的绕行路线。

> **来源**: 旧实现 `td-obj-monster.js:184-203` getNextGrid()

```typescript
// src/game/systems/PathSystem.ts
interface PathSystem {
  // 生成从入口到出口的路径
  generatePath(mapConfig: MapConfig): Position[]

  // 从指定位置生成到出口的路径（用于怪物独立寻路）
  generatePathFrom(startPosition: Position, mapConfig: MapConfig): Position[]

  // 获取路径上指定进度的位置（用于平滑移动）
  getPositionAtProgress(path: Position[], progress: number): { x: number; y: number }

  // 检查从指定位置是否能到达出口
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
// src/game/systems/GridSystem.ts
interface GridSystem {
  // 检查是否可以在指定位置放置建筑（双层检查）
  // 1. 检查是否为入口或出口
  // 2. 检查入口到出口路径是否会被完全阻断
  // 3. 检查已存在的怪物是否会被完全阻塞
  canPlaceBuilding(position: Position, monsterPositions: Position[]): boolean

  // 检查放置建筑是否会完全阻断入口到出口的路径
  wouldBlockPath(position: Position): boolean

  // 检查放置建筑是否会使指定怪物完全无路可走
  // 参考旧实现：td-obj-monster.js:211-226 chkIfBlocked()
  wouldBlockMonster(buildPosition: Position, monsterPosition: Position): boolean

  // 检查指定位置是否可通行
  isPassable(position: Position): boolean

  // 在指定位置放置建筑
  placeBuilding(position: Position, buildingId: string): boolean

  // 移除指定位置的建筑
  removeBuilding(position: Position): boolean

  // 从指定位置计算到出口的路径
  findPathFromPosition(position: Position): Position[]

  // 从指定位置计算到出口的路径（排除某个格子，用于建筑放置检查）
  findPathFromPositionExcluding(position: Position, excludePosition: Position): Position[]
}
```

### DamageSystem

负责伤害和得分计算。

```typescript
// src/game/systems/DamageSystem.ts
interface DamageSystem {
  // 计算实际伤害 = max(rawDamage - shield, rawDamage × 0.1)
  // 最低伤害为原始伤害的 10%，保证高伤害武器打护盾怪更有效
  calculate(rawDamage: number, shield: number): number

  // 计算命中得分 = floor(√actualDamage)
  calculateScore(actualDamage: number): number

  isKilled(monster: Monster, damage: number): boolean
}

// 实现示例
const damageSystem: DamageSystem = {
  calculate(rawDamage: number, shield: number): number {
    const minDamage = Math.ceil(rawDamage * 0.1)
    return Math.max(rawDamage - shield, minDamage)
  },

  calculateScore(actualDamage: number): number {
    return Math.floor(Math.sqrt(actualDamage))
  },

  isKilled(monster: Monster, damage: number): boolean {
    return monster.currentLife - damage <= 0
  },
}
```

### BuildingSystem

负责建筑相关计算，包括成本、伤害、射程和金钱检查。

```typescript
// src/game/systems/BuildingSystem.ts
interface BuildingSystem {
  getTotalCost(type: string, level: number): number      // 累计花费（建造 + 升级）
  getUpgradeCost(type: string, level: number): number    // 升级成本
  getSellIncome(type: string, level: number): number     // 出售回收
  getDamageAtLevel(type: string, level: number): number  // 等级伤害
  getRangeAtLevel(type: string, level: number): number   // 等级射程
  isInRange(building: Building, targetPos: [number, number]): boolean
  getAttackSpeedFrames(type: string): number             // 攻击间隔帧数
  canAfford(money: number, type: string): boolean        // 检查建造金钱
  canAffordUpgrade(money: number, type: string, level: number): boolean  // 检查升级金钱
  isWeapon(type: string): boolean                        // 是否为武器建筑
  getBuildingConfig(type: string): BuildingConfig        // 获取配置
}
```

### EconomySystem

负责波次生命奖励计算。

```typescript
// src/game/systems/EconomySystem.ts
interface EconomySystem {
  getLifeReward(waveNumber: number): number  // 每 5 波 +5，每 10 波 +10
  applyLifeReward(currentLife: number, reward: number): number  // 应用奖励，不超过 100
}
```

> **注意**: `canAfford` 方法已移至 BuildingSystem，与 `canAffordUpgrade` 统一管理建筑成本检查。

### BulletSystem

负责子弹的创建、飞行和碰撞检测。保持与旧实现一致的物理规则。

**速度计算公式**:

```typescript
// 子弹实际速度 = bullet_speed × 20 × GLOBAL_SPEED
// GLOBAL_SPEED = 0.1，所以实际为: bullet_speed × 2 像素/帧
// 例如: cannon bullet_speed=6 → 实际速度 = 6 × 20 × 0.1 = 12 像素/帧
const BULLET_SPEED_FACTOR = 20
const actualSpeed = bulletSpeed * BULLET_SPEED_FACTOR * GLOBAL_SPEED
```

> **与怪物速度的对比**: 怪物速度公式为 `speed × GLOBAL_SPEED`（无 20 倍系数）。子弹额外的 20 倍系数确保子弹飞行速度远快于怪物移动速度。来源: 旧实现 `td-obj-building.js:466`。

```typescript
// src/game/systems/BulletSystem.ts
interface Bullet {
  id: string
  building: Building                         // 发射的建筑
  damage: number                             // 伤害值
  speed: number                              // 飞行速度
  x: number                                  // 当前位置
  y: number
  vx: number                                 // 速度向量（发射时计算，之后不变）
  vy: number

  // 原始目标信息（用于服务端验证射程）
  originalTargetId: string                   // 发射时瞄准的怪物 ID
  originalTargetPosition: [number, number]   // 发射时目标的格子坐标
}

class BulletSystem {
  private bullets: Bullet[] = []

  // 创建子弹（发射时计算方向，之后不再追踪）
  createBullet(config: {
    building: Building
    target: Monster
    damage: number
    speed: number
    position: [number, number]
  }): Bullet

  // 每帧更新：移动子弹、检测碰撞、清理无效子弹
  update(monsters: Monster[], mapBounds: Rect, recorder: WaveRecorder): void

  // 检测子弹与怪物的碰撞（可命中任意怪物，不只是原目标）
  private checkCollision(bullet: Bullet, monsters: Monster[]): Monster | null

  // 检测子弹是否飞出地图（miss）
  private isOutOfBounds(bullet: Bullet, mapBounds: Rect): boolean

  // 获取当前所有子弹（用于渲染）
  getBullets(): Bullet[]
}
```

**核心逻辑**：

```typescript
update(monsters: Monster[], mapBounds: Rect, recorder: WaveRecorder): void {
  this.bullets = this.bullets.filter(bullet => {
    // 1. 检查是否飞出地图（miss）
    if (this.isOutOfBounds(bullet, mapBounds)) {
      return false  // 移除子弹，不记录（miss 不计入攻击记录）
    }

    // 2. 检查是否命中任意怪物
    const hitMonster = this.checkCollision(bullet, monsters)
    if (hitMonster) {
      // 计算实际伤害
      const actualDamage = hitMonster.takeDamage(bullet.damage)

      // 记录攻击事件（包含原始目标和实际命中信息）
      recorder.recordAttack({
        buildingId: bullet.building.id,
        originalTargetId: bullet.originalTargetId,
        originalTargetPosition: bullet.originalTargetPosition,
        monsterId: hitMonster.id,
        monsterPosition: hitMonster.getGridPosition(),
        damage: actualDamage,
        frame: currentFrame,
      })

      return false  // 移除子弹
    }

    // 3. 移动子弹
    bullet.x += bullet.vx
    bullet.y += bullet.vy

    return true  // 保留子弹
  })
}
```

**碰撞检测**（与旧实现一致）：

```typescript
private checkCollision(bullet: Bullet, monsters: Monster[]): Monster | null {
  for (const monster of monsters) {
    if (!monster.isAlive()) continue

    const dx = monster.x - bullet.x
    const dy = monster.y - bullet.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const hitRadius = (monster.radius + bullet.radius) * Math.sqrt(2)

    if (distance <= hitRadius) {
      return monster
    }
  }
  return null
}
```

### WaveManager

负责波次状态管理和怪物生成调度。

```typescript
// src/game/systems/WaveManager.ts
type WaveState = 'idle' | 'spawning' | 'fighting' | 'interval' | 'completed'

class WaveManager {
  state: WaveState = 'idle'
  private pendingMonsters: WaveMonster[] = []  // 待生成的怪物队列
  private spawnInterval: number = 30           // 每 30 帧生成一个怪物
  private waveIntervalFrames: number = 180     // 波次间隔 180 帧（3 秒）

  // 开始新波次（从服务端下发的配置）
  startWave(waveConfig: WaveConfig): void {
    this.pendingMonsters = [...waveConfig.monsters]
    this.state = 'spawning'
  }

  // 每帧更新，返回需要生成的怪物（或 null）
  update(currentFrame: number): WaveMonster | null

  // 注册怪物到管理器（用于追踪存活状态）
  registerMonster(monster: Monster): void

  // 通知怪物死亡或到达终点
  onMonsterRemoved(monster: Monster): void

  // 检查波次是否结束（所有怪物死亡或穿过）
  isWaveComplete(): boolean

  // 获取当前存活的怪物列表
  getAliveMonsters(): Monster[]

  // 开始波次间隔
  startInterval(): void

  // 检查波次间隔是否结束
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
// src/game/systems/WaveRecorder.ts
class WaveRecorder {
  constructor(waveNumber: number, startFrame: number)

  // 记录建筑操作
  recordBuild(id: string, type: string, position: [number, number], frame: number): void
  recordUpgrade(id: string, level: number, frame: number): void
  recordSell(id: string, frame: number): void

  // 记录攻击事件（包含原始目标和实际命中信息）
  recordAttack(event: {
    buildingId: string
    originalTargetId: string              // 发射时瞄准的怪物 ID
    originalTargetPosition: [number, number]  // 发射时目标的格子坐标
    monsterId: string                     // 实际命中的怪物 ID
    monsterPosition: [number, number]     // 命中时怪物的格子坐标
    damage: number
    frame: number
  }): void

  // 记录战斗结果
  recordKill(monsterType: number, monsterLife: number): void
  recordPassed(damage: number): void
  addMoney(amount: number): void
  addScore(amount: number): void
  setDuration(currentFrame: number): void  // 设置波次持续帧数

  // 导出数据
  getActions(): Action[]
  getAttacks(): AttackEvent[]
  getResult(): WaveResult
  toWaveRequest(sessionId: string, buildings: BuildingState[]): WaveRequest

  // 重置记录器（用于下一波）
  reset(newWaveNumber: number, newStartFrame: number): void
}
```

**waveDurationFrames 计算**：

- 起点（startFrame）：波次第一个怪物生成的帧号（构造函数或 reset 时传入）
- 终点（currentFrame）：波次最后一个怪物死亡或穿过时调用 `setDuration(currentFrame)`
- 计算：`waveDurationFrames = currentFrame - startFrame`

> **注意**：暂停时帧号不增长，因此 `waveDurationFrames` 只记录实际游戏进行的帧数。

## 游戏实体

### Monster

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
  damage: number       // 到达终点造成的伤害（从 config.monsters[type].damage 获取）
  color: string        // 颜色（从 config.monsters[type].color 获取或随机生成）
  progress: number     // 路径进度 0-1

  takeDamage(rawDamage: number): number  // 返回实际伤害
  isDead(): boolean
  reachedExit(): boolean
  getGridPosition(): [number, number]
}

// 创建怪物时，damage 和 color 从 config 中获取
function createMonster(monsterData: WaveMonster, config: GameConfig): Monster {
  const displayConfig = config.monsters[monsterData.type]
  return new Monster({
    ...monsterData,
    damage: displayConfig.damage,  // 从静态配置获取
    color: displayConfig.color,    // 从静态配置获取
  })
}
```

### Building

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

**攻击机制**：

保持与旧实现一致的子弹物理系统：

- 子弹飞行: 有物理轨迹，按固定方向直线飞行
- 可能 miss: 目标移走后子弹可能飞出地图
- 误伤机制: 子弹可以命中路径上的任意怪物
- laser_gun: 即时命中，无子弹飞行

```typescript
// fire() 方法实现思路
fire(target: Monster, bulletSystem: BulletSystem): void {
  if (this.type === 'laser_gun') {
    // 激光枪：即时命中
    target.takeDamage(this.getDamage())
  } else {
    // 其他武器：发射子弹
    bulletSystem.createBullet({
      building: this,
      target: target,
      damage: this.getDamage(),
      speed: this.getBulletSpeed(),
      position: [this.x, this.y],
    })
  }
}
```

## 状态管理

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

## API 层

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

## Vue 组件

- `GameHeader.vue`: 显示金钱、生命、分数、波次
- `BuildingPanel.vue`: 建筑选择面板，升级/出售按钮
- `PhaserCanvas.vue`: Phaser 游戏容器
- `GameOverModal.vue`: 游戏结束弹窗 + 昵称输入
- `LeaderboardView.vue`: 排行榜展示
- `ErrorToast.vue`: 错误提示

## 测试规范

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
    // 正常命中：原始目标 = 实际命中
    recorder.recordAttack({
      buildingId: 'b-001',
      originalTargetId: 'uuid-1',
      originalTargetPosition: [3, 3],
      monsterId: 'uuid-1',
      monsterPosition: [3, 3],
      damage: 10,
      frame: 100,
    })
    // 误伤：原始目标是 uuid-2，但命中了 uuid-3
    recorder.recordAttack({
      buildingId: 'b-001',
      originalTargetId: 'uuid-2',
      originalTargetPosition: [4, 4],
      monsterId: 'uuid-3',
      monsterPosition: [5, 5],
      damage: 15,
      frame: 120,
    })
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

## 注意事项

1. **怪物 ID 必须使用服务端 UUID**：不能自己生成，必须使用 `firstWave`/`nextWave` 中下发的 `monster.id`
2. **状态同步**：每波结束后用 `serverState` 覆盖本地状态
3. **生命奖励时序**：`lifeReward` 在下一波开始前应用，不是立即应用
4. **帧号记录**：所有操作和攻击都要记录准确的帧号
5. **攻击位置记录**：攻击时记录怪物的格子坐标，用于服务端路径验证
