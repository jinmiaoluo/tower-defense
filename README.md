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

## 开发文档

- [技术规范](./docs/SPEC.md)
- [前端开发指南](./docs/FRONTEND_GUIDE.md)
- [后端开发指南](./docs/BACKEND_GUIDE.md)
