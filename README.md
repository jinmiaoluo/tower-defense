# Tower Defense

基于 Vue 3 + Phaser 3 + Django 的塔防游戏，包含防作弊验证机制和排行榜功能。

## 项目结构

```
tower-defense/
├── frontend/          # 前端 (Vue 3 + Phaser 3)
├── backend/           # 后端 (Django + DRF)
└── docs/              # 设计文档
```

## 快速开始

### VSCode Workspace

使用 VSCode 打开项目推荐通过 workspace 文件：

```bash
code tower-defense.code-workspace
```

或在 VSCode 中选择 File -> Open Workspace from File，然后选择 `tower-defense.code-workspace`。

### 后端

```bash
cd backend

# 安装依赖
uv sync --all-extras

# 激活虚拟环境
source .venv/bin/activate

# 创建环境配置文件
cp .env.example .env

# 运行数据库迁移
python manage.py migrate

# 启动开发服务器
python manage.py runserver

# 测试
pytest
```

### 前端

```bash
cd frontend

# 安装依赖
npm install

# 创建本地开发环境配置
cp .env.example .env.local

# 开发模式
# 开发服务器默认运行在 http://localhost:8080
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 测试
npm run test
```

## Docker 部署

```bash
# 构建并启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 停止并清除数据
docker compose down -v
```

启动后访问 http://localhost:8580 即可开始游戏。

## 提交成绩与排行榜

游戏结束时（生命值归零），会弹出成绩提交窗口：

- 输入昵称（1-32 字符）
- 提交后查看本次排名和排行榜
- 最低上榜要求：得分大于 0（至少击杀一只怪物）

游戏过程中也可随时结束并提交当前成绩。

## 开发文档

- [架构文档](./docs/ARCHITECTURE.md)
- [技术规范](./docs/SPEC.md)
- [前端开发指南](./docs/FRONTEND_GUIDE.md)
- [后端开发指南](./docs/BACKEND_GUIDE.md)
