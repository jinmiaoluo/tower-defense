# Tower Defense

A tower defense game built with Vue 3 + Phaser 3 + Django, featuring anti-cheat validation and leaderboard functionality.

This is a modern rewrite of [html5-tower-defense](https://github.com/oldj/html5-tower-defense).

## Quick Start

### Backend

```bash
cd backend

# Install dependencies
uv sync --all-extras

# Activate virtual environment
source .venv/bin/activate

# Create environment configuration
cp .env.example .env

# Run database migrations
python manage.py migrate

# Start development server
python manage.py runserver

# Run tests
pytest
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create local development configuration
cp .env.example .env.local

# Development mode
# Dev server runs at http://localhost:8080 by default
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test
```

## Deployment

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove data
docker compose down -v
```

Once started, visit http://localhost:8580 to play the game.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Technical Specification](./docs/SPEC.md)
- [Frontend Guide](./docs/FRONTEND_GUIDE.md)
- [Backend Guide](./docs/BACKEND_GUIDE.md)
