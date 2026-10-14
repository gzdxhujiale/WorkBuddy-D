# WorkBuddy-D Go 后端 Render 部署指南

本指南记录如何将 WorkBuddy-D 的 Go 后端（`server/`）与 WebSocket 增量同步服务部署到 [Render](https://render.com) 免费 Docker 容器，并绑定自定义二级域名 `workbuddy.hujiale.works`。

---

## 1. 架构与前置准备

- **后端运行形态**：基于 `deploy/Dockerfile` 的轻量多阶段 Alpine 镜像（~20MB，常驻内存 ~20MB）。
- **数据库**：Neon Serverless PostgreSQL（位于 AWS `ap-southeast-1` 新加坡区域）。
- **推荐 Render 部署区域**：`Singapore`（与 Neon 同机房，内网级毫秒级低延迟）。
- **自定义域名**：`workbuddy.hujiale.works`。

---

## 2. 部署方式

### 方式 A：通过 Render Blueprint 一键导入（推荐）

1. 将本仓库最新代码推送到 GitHub（`gzdxhujiale/WorkBuddy-D`）。
2. 打开 Render 控制台 -> 点击右上角 **New** -> **Blueprint**。
3. 关联你的 GitHub 仓库，Render 会自动识别根目录的 `render.yaml`。
4. 在环境变量确认页中填入必填密钥：
   - `DB_DSN`：你的 Neon 数据库连接串（例如 `postgresql://neondb_owner:...@ep-cold-glitter-b3mgezby-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`）
   - `JWT_SECRET`：设置一个安全的生产密钥字符串（如 32 字符随机字符串）。
5. 点击 **Apply**，Render 将自动开始多阶段 Docker 构建。

---

### 方式 B：手动创建 Web Service

1. 在 Render 控制台点击 **New** -> **Web Service**。
2. 选择 **Build and deploy from a Git repository**，选择当前仓库。
3. 关键配置项填写：
   - **Name**: `workbuddy-server`
   - **Region**: `Singapore` (推荐，紧邻 Neon)
   - **Branch**: `main`（或你当前的分支）
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./deploy/Dockerfile`
   - **Docker Context**: `.`
   - **Instance Type**: `Free`
4. 在 **Environment Variables** 添加以下环境变量：
   | 变量名 | 值 / 示例 | 说明 |
   | :--- | :--- | :--- |
   | `GIN_MODE` | `release` | 生产环境启用 Gin 高性能释放模式 |
   | `CORS_ORIGIN` | `*` | 允许 Tauri 客户端（`tauri://localhost`）跨域通信 |
   | `DB_DSN` | `postgresql://...neon.tech/neondb?sslmode=require` | 包含 `sslmode=require` 的 Neon 连接串 |
   | `JWT_SECRET` | 你的生产 JWT 密钥 | 用户 Token 加密签名密钥 |
5. **Health Check Path**：设置为 `/api/v1/health`。
6. 点击 **Create Web Service** 触发首次构建。

---

## 3. 自定义域名绑定 (`workbuddy.hujiale.works`)

1. 在 Render 对应 Web Service 的设置页，找到 **Settings** -> **Custom Domains**。
2. 点击 **Add Custom Domain**，输入 `workbuddy.hujiale.works` 并保存。
3. 前往你的域名 DNS 服务商（如 Cloudflare、阿里云、腾讯云等），添加一条解析记录：
   - **记录类型**：`CNAME`
   - **主机记录**：`workbuddy`
   - **记录值**：Render 提示的目标地址（格式通常为 `workbuddy-server-xxxx.onrender.com`）
   - **代理状态**：如果使用 Cloudflare，初期建议先选择 **DNS Only**（仅解析），方便 Render 自动通过 Let's Encrypt 签发 SSL 证书；证书生效后可按需开启 CDN 代理。
4. 等待几分钟，Render 控制台显示该域名状态为 **Verified**，即可通过 `https://workbuddy.hujiale.works` 访问。

---

## 4. 关键：免费版 15 分钟休眠防坑策略（保活配置）

Render 免费实例在 **15 分钟无入站 HTTP 请求后会自动进入休眠**。休眠会导致：
1. 正在运行的 Tauri 桌面端 WebSocket 长连接掉线；
2. 再次打开桌面端请求数据时，需要等待约 50 秒唤醒容器。

### 零成本永久保活方案：
使用免费的第三方 Uptime 监控服务（例如 [UptimeRobot](https://uptimerobot.com) 或 [cron-job.org](https://cron-job.org)）：
1. 注册并新建一个 Monitor（HTTP(s) 类型）。
2. **URL** 填写：`https://workbuddy.hujiale.works/api/v1/health`。
3. **Monitoring Interval** 设置为 **10 分钟**。
4. 每 10 分钟自动访问一次健康检查接口，即可让 Render 容器永久常驻运行，WebSocket 连接永不中断！

---

## 5. 验证部署成果

在终端或浏览器中验证公网访问：
```bash
# 1. 验证 HTTP API 健康状态
curl https://workbuddy.hujiale.works/api/v1/health
# 预期返回: {"service":"workbuddy-server","status":"ok"}

# 2. 验证用户注册与登录 API
curl -X POST https://workbuddy.hujiale.works/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"yourpassword"}'
```
