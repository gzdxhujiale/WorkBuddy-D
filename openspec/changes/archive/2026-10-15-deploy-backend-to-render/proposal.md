# Proposal: Deploy WorkBuddy-D Go Backend to Render

## Why

WorkBuddy-D has transitioned to a lightweight Go backend (`server/`) with Neon PostgreSQL and WebSocket delta synchronization. To support production desktop client distributions and remote synchronization without relying on localhost, the Go backend must be deployed to a persistent container hosting environment (Render). 

Deploying to Render provides native WebSocket support, constant uptime for delta sync, and seamless custom domain integration (`workbuddy.hujiale.works`) while keeping local development isolated on `localhost:8080`.

## What Changes

- **Render Deployment Configuration**:
  - Provide a standardized Render configuration (`render.yaml` Blueprint or verified Docker build instructions) targeting `deploy/Dockerfile`.
  - Configure the Go service to adapt to Render's dynamic `$PORT` environment variable and production Neon Postgres connection string (`DB_DSN`).
  - Add instructions and support for custom subdomain binding (`workbuddy.hujiale.works`).
- **Frontend Multi-Environment Configuration**:
  - Add `.env.development` with `VITE_API_BASE_URL=http://localhost:8080` and `VITE_WS_URL=ws://localhost:8080/ws` for offline local development.
  - Add `.env.production` with `VITE_API_BASE_URL=https://workbuddy.hujiale.works` and `VITE_WS_URL=wss://workbuddy.hujiale.works/ws` for production desktop bundling.
  - Fix any mismatched environment variable references (e.g. `VITE_API_URL` vs `VITE_API_BASE_URL`).
- **Keep-Alive Guidance**:
  - Provide a zero-cost UptimeRobot / Cron ping strategy targeting `/api/v1/health` to prevent Render Free Tier from spinning down after 15 minutes of inactivity.

## Capabilities

### New Capabilities
<!-- Pure deployment and infrastructure configuration; no new functional capability specs. -->

### Modified Capabilities
<!-- No changes to existing functional user interaction specs (project-management-center, task-management-center, task-quick-edit, today-workbench). -->

## Impact

- **Affected Code**: `deploy/Dockerfile`, `render.yaml` (new), `.env.development` (new), `.env.production` (new), `.env.example`.
- **Desktop Runtime**: `pnpm dev` and `pnpm tauri` continue connecting to `localhost:8080`; production `pnpm run "tauri build"` automatically connects to `https://workbuddy.hujiale.works`.
