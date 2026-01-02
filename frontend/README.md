# Tower Defense Frontend

基于 Vue 3 + Phaser 3 + TypeScript 的塔防游戏前端。

## 技术栈

- **Vue 3** - 响应式 UI 框架
- **Phaser 3** - 2D 游戏引擎
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Pinia** - 状态管理

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

开发服务器默认运行在 http://localhost:8080

## 目录结构

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite/
│   ├── config.dev.mts      # 开发环境配置
│   └── config.prod.mts     # 生产环境配置
├── public/
│   └── assets/             # 静态资源
└── src/
    ├── main.ts             # Vue 入口
    ├── App.vue             # 根组件
    ├── PhaserGame.vue      # Phaser 游戏组件
    ├── types/              # TypeScript 类型定义
    ├── game/
    │   ├── main.ts         # Phaser 配置
    │   ├── EventBus.ts     # Vue-Phaser 事件通信
    │   ├── scenes/         # 游戏场景
    │   ├── entities/       # 游戏实体（怪物、建筑）
    │   └── systems/        # 游戏系统
    ├── api/                # API 请求层
    ├── stores/             # Pinia 状态管理
    ├── components/         # Vue UI 组件
    └── composables/        # 组合式函数
```

## 游戏架构

### Vue 与 Phaser 通信

使用 `EventBus` 实现 Vue 组件与 Phaser 场景之间的双向通信：

```typescript
// Phaser 场景中发送事件
EventBus.emit('current-scene-ready', this)

// Vue 组件中监听事件
EventBus.on('current-scene-ready', (scene) => {
  // 处理场景就绪
})
```

### 场景流程

```
Boot → Preloader → Game
```

- **Boot**: 最小启动，加载 Preloader 所需资源
- **Preloader**: 加载游戏资源，显示进度条
- **Game**: 游戏主逻辑

## 开发指南

详细开发文档请参考：

- [前端开发指南](../docs/FRONTEND_GUIDE.md)
- [技术规范](../docs/SPEC.md)
