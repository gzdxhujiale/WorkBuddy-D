# Design: WorkBuddy-D Go Backend Deployment to Render

## Context

The WorkBuddy-D Go backend (`server/`) is implemented with Gin, pgxpool, and an in-memory WebSocket Hub for multi-window synchronization. PostgreSQL is hosted on Neon (`ep-cold-glitter-b3mgezby-pooler.c-4.ap-southeast-1.aws.neon.tech`). 

This design establishes the production deployment pipeline to Render using containerization, sets up custom domain routing (`workbuddy.hujiale.works`), and isolates local development environments from production bundling.

## Goals / Non-Goals

**Goals:**
- Provide a zero-friction Render deployment specification leveraging `deploy/Dockerfile`.
- Support Render's dynamic `$PORT` and Neon's `sslmode=require` database pooling.
- Configure custom domain `workbuddy.hujiale.works` with automated SSL termination on Render.
- Guarantee strict environment isolation: local development runs on `localhost:8080`, production builds bind to `workbuddy.hujiale.works`.
- Implement a health-check endpoint keepalive strategy to bypass Render Free Tier 15-minute hibernation.

**Non-Goals:**
- Running multiple project services inside the same container (deferred per user decision to prioritize WorkBuddy-D first).
- Modifying internal Go API routes or database schemas.

## Decisions

### Decision 1: Use `deploy/Dockerfile` with Docker Environment on Render
- **Rationale**: Render supports native Docker deployments with customizable Dockerfile paths (`./deploy/Dockerfile`) and root build context (`.`). The multi-stage Alpine build outputs a minimal ~20MB binary, minimizing cold-start and memory consumption.
- **Alternatives Considered**:
  - *Native Go Environment on Render*: Requires Render to compile Go with standard Go runtime; less reproducible across different OSes than Docker.
  - *Root Dockerfile symlink*: Redundant since Render UI supports custom Dockerfile path specification.

### Decision 2: Render Edge TLS Termination & Host Binding
- **Rationale**: Render automatically provisions and renews Let's Encrypt certificates for any custom domain assigned in its dashboard. The Go Gin server in the container receives forwarded plain HTTP/WebSocket traffic on `$PORT` without requiring complex ACME management inside the container.
- **Domain**: `workbuddy.hujiale.works` (CNAME to `<render-service>.onrender.com`).

### Decision 3: Frontend Multi-Environment Variables via Vite Modes
- **Rationale**: Vite automatically picks `.env.development` during `pnpm dev`/`pnpm tauri` and `.env.production` during `pnpm build`/`tauri build`.
- **Configuration**:
  - `.env.development`:
    ```env
    VITE_API_BASE_URL=http://localhost:8080
    VITE_WS_URL=ws://localhost:8080/ws
    ```
  - `.env.production`:
    ```env
    VITE_API_BASE_URL=https://workbuddy.hujiale.works
    VITE_WS_URL=wss://workbuddy.hujiale.works/ws
    ```

### Decision 4: Free-Tier Keepalive via `/api/v1/health`
- **Rationale**: Render Free Web Services sleep after 15 minutes of inactivity. When asleep, active WebSockets drop and waking takes ~50s. Pinging `https://workbuddy.hujiale.works/api/v1/health` every 10–14 minutes using UptimeRobot / cron-job.org prevents sleeping at zero cost.

## Risks / Trade-offs

- **[Risk] Render Free Tier monthly 750h limit** → Mitigation: A single continuous instance consumes ~720h per month, fitting comfortably within the 750h free quota.
- **[Risk] WebSocket disconnect on deployment restarts** → Mitigation: `wsClient.ts` already implements exponential backoff reconnection (`scheduleReconnect`) every 3 seconds.
