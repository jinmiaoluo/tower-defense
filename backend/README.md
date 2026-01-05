# Tower Defense Backend

塔防游戏后端 API 服务。

## 开发环境设置

```bash
# 来到后端目录
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

## 开发指南

详细开发文档请参考：

- [后端开发指南](../docs/BACKEND_GUIDE.md)
- [技术规范](../docs/SPEC.md)
