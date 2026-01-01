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

| 阶段 | 内容 | 说明 |
|------|------|------|
| P0 | 项目初始化 | Vite + Vue 3 + TypeScript + Phaser 3 + Vitest |
| P0 | 类型定义 + Mock | 所有开发的基础 |
| P1 | 核心系统 (TDD) | PathSystem, DamageSystem, BuildingSystem, EconomySystem, BulletSystem, WaveManager, WaveRecorder |
| P1 | Phaser 实体 | Monster, Building, GameScene |
| P2 | 状态管理 | Pinia Store |
| P2 | API 层 | Mock → 真实 API 切换 |
| P3 | Vue UI | GameHeader, BuildingPanel, GameOverModal, LeaderboardView |

## 核心系统

### PathSystem

负责怪物路径计算。

```typescript
// src/game/systems/PathSystem.ts
interface PathSystem {
  generatePath(mapConfig: MapConfig): [number, number][]
  getPositionAtProgress(path: Path, progress: number): { x: number; y: number }
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

### EconomySystem

负责经济相关计算。

```typescript
// src/game/systems/EconomySystem.ts
interface EconomySystem {
  canAfford(money: number, buildingType: string, config: GameConfig): boolean
  getLifeReward(waveNumber: number): number  // 每 5 波 +5，每 10 波 +10
}
```

### BulletSystem

负责子弹的创建、飞行和碰撞检测。保持与旧实现一致的物理规则。

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
  constructor(waveNumber: number)

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
  setDuration(frames: number): void

  // 导出数据
  getActions(): Action[]
  getAttacks(): AttackEvent[]
  getResult(): WaveResult
  toWaveRequest(sessionId: string, buildings: BuildingState[]): WaveRequest
}
```

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
  progress: number     // 路径进度 0-1

  takeDamage(rawDamage: number): number  // 返回实际伤害
  isDead(): boolean
  reachedExit(): boolean
  getGridPosition(): [number, number]
}

// 创建怪物时，damage 从 config 中获取
function createMonster(monsterData: WaveMonster, config: GameConfig): Monster {
  return new Monster({
    ...monsterData,
    damage: config.monsters[monsterData.type].damage,  // 从静态配置获取
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

| 特性 | 说明 |
|------|------|
| 子弹飞行 | 有物理轨迹，按固定方向直线飞行 |
| 可能 miss | 目标移走后子弹可能飞出地图 |
| 误伤机制 | 子弹可以命中路径上的任意怪物 |
| laser_gun | 即时命中，无子弹飞行 |

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

| 组件 | 功能 |
|------|------|
| `GameHeader.vue` | 显示金钱、生命、分数、波次 |
| `BuildingPanel.vue` | 建筑选择面板，升级/出售按钮 |
| `PhaserCanvas.vue` | Phaser 游戏容器 |
| `GameOverModal.vue` | 游戏结束弹窗 + 昵称输入 |
| `LeaderboardView.vue` | 排行榜展示 |
| `ErrorToast.vue` | 错误提示 |

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
