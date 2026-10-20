# Tasks

## 1. Go 后端独立媒体上传与静态托管

- [x] 1.1 实现媒体文件存储逻辑与校验：在 `server/internal/handler/media_handler.go` 实现 SHA-256 去重落盘、MIME 类型限制（JPEG/PNG/WebP/GIF/SVG）与 10MB 大小检查，并编写单元测试 `media_handler_test.go` 验证有效与无效格式响应
- [x] 1.2 注册媒体路由与静态文件服务：在 `server/cmd/server/main.go` 注册 `POST /api/v1/media/upload`（挂载鉴权中间件）与 `GET /api/v1/media/assets/*` 静态资源托管，运行 `go -C server test ./...` 与 `go -C server build ./cmd/server` 验证构建通过

## 2. 悬浮菜单修复与列表层级管理升级

- [x] 2.1 修复 BubbleMenu 穿透与失焦问题：在 `src/components/editor/menus/BubbleMenu.tsx` 移除 `pointer-events-none` 阻断类名，为所有操作按钮补充 `onMouseDown={(e) => e.preventDefault()}`，并在 DailyReviewPanel 验证点击格式化按钮即时生效
- [x] 2.2 列表升降级快捷键与防逃逸实现：在 `src/components/editor/extensions/CustomKeymapExtensions.ts` 实现 `Mod-]` 与 `Mod-[` 快捷键，绑定 `sinkListItem` / `liftListItem` 链式调用（支持 `listItem` 与 `taskItem`），并拦截普通段落内按 `Tab` 导致的 Webview 焦点跳跃
- [x] 2.3 工具栏缩进按钮与排印样式美化：在 `FullToolbar.tsx` 和 `CompactToolbar.tsx` 增补缩进与反缩进按钮，在 `RichTextEditor.tsx` 更新多级列表 CSS（`disc` ➔ `circle` ➔ `square` 与 `decimal` ➔ `lower-alpha` ➔ `lower-roman`），消除嵌套外边距空白并补充对齐引导线

## 3. 前端图片压缩与多图并发上传管线

- [x] 3.1 实现客户端 Canvas WebP 自动压制：在 `src/components/editor/utils/imageCompressor.ts` 实现离屏 Canvas 等比缩放（限制最大宽度 1920px）与 WebP 导出，编写单元测试验证超大图片体积压缩有效性
- [x] 3.2 封装媒体上传客户端接口：在 `src/services/mediaService.ts` 封装与 Go 后端 `/api/v1/media/upload` 的通信接口，附带网络离线时自动回退为轻量 Data URL 的容错机制
- [x] 3.3 改造 CustomImage 粘贴与拖拽管线：在 `CustomImage.ts` 修复批量拖拽单图丢失缺陷，实现多图并发读取队列与加载中骨架占位态，上传完成后平滑替换为持久化媒体 URL

## 4. 图片交互排版、专属工具栏与画廊灯箱

- [x] 4.1 扩展图片节点属性与排版布局：在 `CustomImage.ts` 扩展 `width` 与 `align` 属性，支持 25%、50%、75%、100% 比例与居左、居中、居右对齐渲染
- [x] 4.2 实现图片专属悬浮菜单（ImageBubbleMenu）：在 `src/components/editor/menus/ImageBubbleMenu.tsx` 构建图片悬停/选中时的专属工具栏，支持对齐切换、尺寸选择、原图查看与删除，并在 `RichTextEditor.tsx` 中挂载
- [x] 4.3 构建全屏画廊灯箱组件（ImageLightbox）：在 `src/components/editor/menus/ImageLightbox.tsx` 实现支持双主题的大图全屏预览弹窗与快捷键退出（Esc），集成至图片点击与工具栏查看大图操作

## 5. 综合验证与质量准出

- [x] 5.1 运行全栈构建与边界检查：执行 `pnpm build` 与 `pnpm lint:boundaries`，确保前端 TypeScript 类型检查与架构边界零缺陷
- [x] 5.2 运行后端测试与编译检查：执行 `go -C server test ./...` 与 `go -C server build ./cmd/server`，确认媒体端点与各领域测试全绿
- [x] 5.3 桌面端集成验证：在每日复盘页面全面核对悬浮菜单点击、多级列表升降、多图粘贴上传及灯箱预览交互表现
