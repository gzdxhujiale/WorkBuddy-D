# Proposal: Portable Auto Update and Cloudflare R2 Unified Storage

## Why

WorkBuddy-D 采用绿色便携版发布形态供用户免安装即开即用，且生产环境 Go 后端部署在 Render 云端容器。当前架构面临两个突出的资产持久化与分发痛点：
1. **Render 容器临时文件系统导致丢图**：当前后端将 Tiptap 编辑器上传的图片保存在本地目录 `./data/media` 中，Render 容器在重新部署、例行重启或休眠唤醒时会完全抹除本地文件系统，导致用户笔记图片变成 404 裂图；
2. **多处静态资产分散且国内网络受限**：更新包若托管于 GitHub Releases，国内用户频繁遭遇 DNS 污染与断流。

为彻底解决上述问题，本项目决定**将客户端更新包与 Tiptap 富文本媒体资产统一托管于 Cloudflare R2 对象存储**（通过自定义 CDN 域名 `assets.workbuddy.hujiale.works` 统一加速分发），同时保持本地开发环境的 Local 驱动平滑回退，实现零出口流量费、无状态容器持久化与全国满速下载。

## What Changes

- **Cloudflare R2 统一对象存储架构**：
  - 建立统一的 R2 存储桶，规范顶级路径划分：
    - `/media/*`：存放 Tiptap 富文本图片与文档附件，基于 SHA-256 内容寻址去重，返回永久有效的公共 CDN 加速 URL。
    - `/releases/*`：存放桌面便携版二进制产物（`WorkBuddy-portable-x64.exe`）及版本元数据清单 `latest.json`。
- **Go 服务端双模存储驱动 (`server/internal/storage`)**：
  - 定义抽象 `StorageDriver` 接口，提供 `LocalStorageDriver`（用于纯本地离线开发）与 `R2StorageDriver`（S3 兼容协议，用于云端生产环境）。
  - 根据环境变量 `STORAGE_DRIVER`（`local` / `r2`）无缝切换；生产环境自动推送到 R2 桶并返回 `https://assets.workbuddy.hujiale.works/media/{hash}{ext}`。
- **客户端更新引擎 (`updater.rs`) 端点对齐**：
  - 客户端更新检测直接请求 R2 绑定的自定义加速域名 `https://assets.workbuddy.hujiale.works/releases/latest.json`，享受全球 Anycast 边缘缓存与 0 流量费用。
  - 保留 Windows In-place Rename (`MoveFile`) 原地静默热替换机制，避免弹出控制台黑框。
- **版本发布脚本 (`scripts/release.cjs`) 适配**：
  - 生成以 Cloudflare R2 域名为基准的 `latest.json`。
  - 支持直接通过 S3 协议将构建产物一键推送到 R2 存储桶的 `/releases/` 前缀。

## Non-goals (非目标)

- 不强制要求本地开发环境必须配置云端 Cloudflare R2 凭据，本地开发环境默认使用 `./data/media` 保持完全独立离线。
- 不修改既有 PostgreSQL 数据库的实体关系结构，仅在媒体返回 URL 层面由本地相对路径透明升级为标准 CDN 绝对 URL。

## Capabilities

### New Capabilities
- `app-auto-updater`: 覆盖便携客户端版本检测、Cloudflare R2 资产下载、In-place Rename 原地热替换与版本自动化发布规约。
- `media-storage`: 覆盖富文本媒体资产的双模存储驱动抽象、SHA-256 内容寻址去重、Cloudflare R2 对象存储持久化与公共 CDN URL 解析契约。

### Modified Capabilities
<!-- 无现有规格的行为变更 -->

## Impact

- **Affected Code**:
  - `server/`：新增 `internal/storage/` 存储抽象层与 R2 驱动，改造 `internal/handler/media_handler.go` 注入存储驱动，更新 `internal/config/config.go` 增加 R2 配置。
  - `src-tauri/src/updater.rs`：更新默认更新检查端点至 Cloudflare R2 域名。
  - `scripts/release.cjs`：更新发布清单生成逻辑，适配 R2 路径。
- **External Dependencies**:
  - 引入 `github.com/aws/aws-sdk-go-v2` 基础 S3 客户端用于 Go 服务端连接 Cloudflare R2。
  - 依赖 Cloudflare R2 存储桶与绑定的 CDN 自定义域名。
