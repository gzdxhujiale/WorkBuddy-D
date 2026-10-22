# Design: Portable In-Place Silent Auto Update and Cloudflare R2 Unified Storage

## Context

See `proposal.md` for background and motivation. WorkBuddy-D 在 Windows 平台上以独立便携可执行文件方式分发，生产环境下 Go 后端部署在 Render 云端容器。Render 容器的临时磁盘（Ephemeral Filesystem）会导致存放在本地 `./data/media` 的富文本图片在服务重启后丢失。为解决图片持久化和安装包国内分发加速问题，架构上统一引入 **Cloudflare R2 对象存储**，并将其作为静态资产的单一权威源。

## Goals / Non-Goals

**Goals:**
- 将 Tiptap 编辑器上传的图片与文档附件持久化至 Cloudflare R2，实现无状态容器重启零丢图。
- 将便携版客户端更新包与 `latest.json` 清单统一托管于 Cloudflare R2 的 `/releases/` 前缀下，享有全球 Anycast 边缘加速与永久 0 出口流量费用。
- 提供 Go 服务端双模存储驱动（`local` / `r2`），确保本地离线开发与云端生产环境平滑解耦。
- 保留 Windows In-place Rename (`MoveFile`) 原地热替换，确保更新过程无黑框弹窗。
- 升级版本发布脚本（`scripts/release.cjs`），自动生成适配 R2 路径的发布清单。

**Non-Goals:**
- 不强制本地开发环境绑定云端 R2，未配置凭据时默认自动降级为本地 `./data/media`。
- 不影响现有的数据库业务表与 WebSocket 同步拓扑。

## Decisions

### 1. 统一 Cloudflare R2 存储桶拓扑与自定义域名
- **决策**: 创建单一 R2 存储桶（如 `workbuddy-assets`），绑定二级加速域名 `https://assets.workbuddy.hujiale.works`。
- **目录规划**:
  - `media/{hash}{ext}`: 用户在 Tiptap 中上传的高清图片与附件（带强缓存 `Cache-Control: public, max-age=31536000, immutable`）。
  - `releases/latest.json`: 客户端自动更新轻量清单（带轻量缓存 `Cache-Control: public, max-age=60`）。
  - `releases/{version}/WorkBuddy-portable-x64.exe`: 绿色便携版更新二进制。

### 2. Go 服务端存储驱动抽象 (`server/internal/storage`)
- **决策**: 定义高内聚的 `StorageDriver` 接口：
  ```go
  type StorageDriver interface {
      Put(ctx context.Context, key string, data []byte, contentType string) (string, error)
      Exists(ctx context.Context, key string) (bool, error)
      GetURL(key string) string
  }
  ```
- **双模实现**:
  - `LocalStorage`: 写入 `uploadDir`（`./data/media`），返回相对路径 `/api/v1/media/assets/{filename}`。
  - `R2Storage`: 基于 AWS S3 Go SDK v2，配置 R2 Endpoint (`https://<account_id>.r2.cloudflarestorage.com`)，写入指定 Bucket，直接返回 CDN 绝对 URL (`https://assets.workbuddy.hujiale.works/media/{key}`)。
- **配置与注入**:
  在 `server/cmd/server/main.go` 中根据 `cfg.StorageDriver` 初始化对应驱动并注入 `handler.NewMediaHandler(storageDriver)`。

### 3. In-place Rename 与 R2 加速端点对齐
- **决策**:
  - 客户端更新端点更新为 `https://assets.workbuddy.hujiale.works/releases/latest.json`。
  - 保持 Rust 原生流式下载 + SHA-256 完整性校验 + `std::fs::rename` 原地热替换流程。

## Risks / Trade-offs

- **[Risk] 云端 R2 凭据配置错误或网络故障**
  → **Mitigation**: Go 服务端启动时校验 R2 凭据可用性；若未配置或初始化失败，输出警告并安全降级为 `LocalStorage`，不阻断系统核心业务。
- **[Risk] 重复上传大图占用空间**
  → **Mitigation**: 继续保留 SHA-256 内容寻址机制。上传前计算哈希，若存储驱动中已存在该 Key，直接返回现有 URL，避免重复存储。

## Migration Plan

1. 在 `server/` 引入 S3 客户端依赖，实现 `internal/storage` 模块与单元测试。
2. 改造 `server/internal/config` 与 `server/internal/handler/media_handler.go` 接入存储驱动。
3. 更新 `src-tauri/src/updater.rs` 默认更新源至 R2 域名。
4. 适配 `scripts/release.cjs` 支持 R2 路径并生成对应 `latest.json`。
