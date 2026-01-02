# Tower Defense Backend

塔防游戏后端 API 服务。

## 技术栈

- Django 5.2
- Django REST Framework 3.16
- PostgreSQL 15
- pytest

## 开发环境设置

```bash
# 安装依赖
uv sync --all-extras

# 运行数据库迁移
python manage.py migrate

# 启动开发服务器
python manage.py runserver
```

## 测试

```bash
pytest
```
