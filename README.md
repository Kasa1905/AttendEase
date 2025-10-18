# AttendEase — Club Attendance Management System

[![CI](https://github.com/Kasa1905/AttendEase/actions/workflows/ci.yml/badge.svg)](https://github.com/Kasa1905/AttendEase/actions/workflows/ci.yml)

AttendEase helps clubs and student organizations manage events, track attendance, monitor duty sessions, handle leave requests, and generate reports with ease. It includes a modern React frontend and a Node.js/Express backend with PostgreSQL, plus monitoring, E2E testing, and deployment tooling.

Repository: https://github.com/Kasa1905/AttendEase

## Highlights
- Role-based workflows for Students, Teachers, and Core Team
- Real-time updates (Socket.IO) for approvals and notifications
- Offline-ready UX with resilient sync and conflict handling
- Bulk approvals/rejections, import/export (CSV/XLSX, PDF)
- Comprehensive tests: unit, integration, and E2E
- Monitoring/observability: Prometheus, Grafana, Loki, Alertmanager

## Tech Stack
- Frontend: React 18, Vite 5, TailwindCSS, React Router, React Hook Form
- Backend: Node.js, Express, Sequelize (PostgreSQL)
- Real-time: Socket.IO
- Testing: Jest, Testing Library, MSW (frontend), Supertest (backend), Playwright (E2E)
- Packaging/Deploy: Docker, docker-compose; Netlify/Vercel (frontend) ready
- Observability: prom-client, express-prometheus-middleware, Grafana/Loki/Promtail

## Monorepo Structure (this repo)
```
AttendEase/
	frontend/        # React app (Vite)
	backend/         # Node/Express API + Sequelize models/migrations
	e2e/             # Playwright specs and helpers
	monitoring/      # Prometheus/Grafana/Loki configs
	performance/     # Artillery performance tests
	scripts/         # Deploy, seed, backup, restore helpers
	nginx/           # Nginx configs for staging
	uat/             # UAT docs and data
```

## Quick Start

Prereqs:
- Node.js 18+
- npm 9+ (or pnpm/yarn)
- PostgreSQL 14+ running locally

### 1) Environment variables

Create `frontend/.env` for Vite:
```
VITE_API_URL=http://localhost:4000
VITE_SENTRY_DSN=
VITE_SENTRY_TRACES_SAMPLE_RATE=0.2
VITE_APP_VERSION=1.0.0
VITE_OFFLINE_CACHE_TTL=5
VITE_SYNC_RETRY_ATTEMPTS=3
VITE_SYNC_RETRY_DELAY=1000
```

Create `backend/.env` for API:
```
PORT=4000
DATABASE_URL=postgres://user:password@localhost:5432/attendease
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me_too
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SENTRY_DSN=
REDIS_URL=
```

### 2) Install dependencies
```
cd frontend && npm install
# backend uses Node + Sequelize; install from top-level if package.json exists.
# If backend has its own package.json, run:
# cd ../backend && npm install
```

### Getting Started (TL;DR)
```
# 1) API
cd backend
cp .env.example .env   # set DATABASE_URL, JWT secrets
npm install            # if package.json exists here
# run migrations if configured (example): npx sequelize-cli db:migrate
npm run dev            # or: node app.js

# 2) Frontend
cd ../frontend
cp .env.example .env   # set VITE_API_URL
npm ci
npm run dev            # http://localhost:5173
```

### 3) Database setup
Use Sequelize CLI or scripts to create and migrate the DB.
```
# Example (adjust if you use a local sequelize-cli setup):
# npx sequelize-cli db:create
# npx sequelize-cli db:migrate
# npx sequelize-cli db:seed:all
```

### 4) Run locally
Terminal A (API):
```
cd backend
npm run dev    # or: node app.js / node server.js depending on your entrypoint
```

Terminal B (Frontend):
```
cd frontend
npm run dev    # starts Vite on http://localhost:5173
```

## Scripts
- Frontend
	- `npm run dev` — Vite dev server (5173)
	- `npm run build` — production build
	- `npm run preview` — preview build
	- `npm run test` — Jest unit tests
	- `npm run test:integration` — integration tests
	- `npm run test:coverage` — coverage report

- Backend (examples; align with your package.json)
	- `npm run dev` — start in watch mode
	- `npm test` — backend tests (Jest/Supertest)

## Testing
- Frontend: Jest + Testing Library + MSW. See `frontend/src/tests`.
- Backend: Jest + Supertest. See `backend/tests`.
- E2E: Playwright specs in `e2e/tests`.

Run a focused E2E example (after API + frontend running):
```
# Example command if Playwright is configured globally in this repo
# npx playwright test e2e/tests/auth.spec.js
```

## Deployment
- Frontend: Netlify or Vercel (see `frontend/netlify.toml` and `frontend/vercel.json`).
- Backend: Docker/Kubernetes ready. See `Dockerfile`, `nginx/staging.conf`, and `monitoring/`.
- Staging helpers: `docker-compose.staging.yml`, scripts in `scripts/`.

### Docker (frontend only example)
```
cd frontend
docker build -t attendease-frontend:latest .
docker run -p 5173:5173 attendease-frontend:latest
```

## Monitoring & Observability
- Prometheus scrape configs and alert rules in `monitoring/`
- Grafana dashboards for club attendance overview
- Loki + Promtail for logs

## Directory Guide
- `frontend/src/components/*` — UI components by domain (student/teacher/core-team)
- `frontend/src/hooks/*` — data-fetching and feature hooks
- `frontend/src/utils/*` — helpers (auth, API, offline storage)
- `backend/controllers/*` — HTTP controllers
- `backend/models/*` — Sequelize models and associations
- `backend/migrations/*` — schema migrations
- `backend/services/*` — domain services (notifications, reports, metrics)
- `backend/routes/*` — Express routers
- `e2e/tests/*` — end-to-end test suites

## Troubleshooting
- Frontend cannot reach API: confirm `VITE_API_URL` and API `PORT`.
- DB connection errors: verify `DATABASE_URL` and run migrations.
- CORS/Proxy: ensure Nginx or dev server proxy matches API URL.
- Sentry: leave DSN empty locally to disable reporting.

## License
MIT
