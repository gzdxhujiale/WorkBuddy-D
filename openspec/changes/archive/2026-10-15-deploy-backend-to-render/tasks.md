# Tasks

## 1. Render Deployment Infrastructure

- [x] 1.1 Verify and optimize `deploy/Dockerfile` for Render container runtime compatibility (dynamic `$PORT` and minimal Alpine image)
- [x] 1.2 Create `render.yaml` blueprint defining the WorkBuddy-D Go Web Service, health check, and environment parameters
- [x] 1.3 Create comprehensive deployment guide in `docs/RENDER_DEPLOYMENT.md` detailing Render settings, Neon connection, and custom domain CNAME setup

## 2. Frontend Multi-Environment & Variable Alignment

- [x] 2.1 Create `.env.development` configuring local API and WebSocket endpoints (`http://localhost:8080`, `ws://localhost:8080/ws`)
- [x] 2.2 Create `.env.production` configuring production domain endpoints (`https://workbuddy.hujiale.works`, `wss://workbuddy.hujiale.works/ws`)
- [x] 2.3 Align `.env.example` with standard `VITE_API_BASE_URL` and `VITE_WS_URL` variables

## 3. Verification & Build Validation

- [x] 3.1 Verify local Go server build passes cleanly (`go -C server build -o bin/server.exe ./cmd/server`)
- [x] 3.2 Verify frontend production build (`pnpm build`) succeeds and binds production assets without warnings
