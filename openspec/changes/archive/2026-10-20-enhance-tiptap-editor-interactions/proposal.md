# Proposal

## Why

在每日复盘（Daily Review）及全功能笔记编辑器中，用户频繁反馈悬浮菜单（Bubble Menu）出现后无法点击，严重阻碍快速高亮与格式化；同时，有序与无序列表在多层级嵌套时缺乏桌面生产力主流快捷键（如 `Mod-]` / `Mod-[`）与清晰的递进排印视觉，且存在垂直间距断层与 Tab 误逃逸；此外，图片扩展目前直接将大体积未压缩 Base64 嵌入文档 JSON，引发文档体积膨胀、自动保存与 WebSocket 广播卡顿，且缺乏尺寸调整、对齐、悬浮控制条、画廊大图预览以及多图拖拽并发支持。

本次变更系统性解决上述富文本交互与媒体管理短板，打通 Go 后端独立媒体上传接口与前端自动压制管线，补齐专业级列表与图片编辑交互体验。

## What Changes

- **修复悬浮菜单交互链路**：清除 `BubbleMenu` 上的阻断性 `pointer-events-none` 样式，为所有工具按钮补充 `onMouseDown` 防失焦阻止默认行为，确保选区稳定且所有格式化按钮即点即生效。
- **列表与待办多层级切换优化**：
  - 支持桌面生产力标准快捷键 `Mod-]`（增加缩进/降级）与 `Mod-[`（减少缩进/升级）。
  - 实现 `listItem` 与 `taskItem` 的统一链式升降级判定，保持一致操作手感。
  - 拦截普通段落内按 `Tab` 导致的焦点逃逸（Tab Defense），转换为可控缩进或插入空格。
  - 在编辑器完整与简易工具栏中补充可视化缩进与反缩进按钮。
  - 视觉排版层级递进：无序列表逐级采用 `disc` ➔ `circle` ➔ `square`；有序列表逐级采用 `decimal` ➔ `lower-alpha` ➔ `lower-roman`。
  - 消除子列表多余垂直外边距（Margin Collapse），增加优雅的嵌套辅助对齐导引线。
- **高性能图片管理与后端媒体上传管线**：
  - **Go 独立后端媒体接口**：新增 `POST /api/v1/media/upload` 接口与静态文件安全托管服务，支持基于 SHA-256 哈希去重落盘，返回标准可访问媒体 URL。
  - **前端 Canvas WebP 自动压制**：在图片读取或上传前，前端使用离屏 Canvas 进行尺寸约束（最大宽度 1920px）与 WebP 高效无损/轻损压缩，将几兆原始截图体积压缩 90% 以上。
  - **多图批量拖拽与并发插入**：修复拖拽时仅处理第一张图片的截断缺陷，支持多图顺序插入。
  - **异步加载占位与骨架态**：在图片压制与上传期间展示带有微动效的占位骨架，上传完成后原子替换为真实图片节点。
  - **图片交互控制与排版**：
    - 扩展图片节点属性：支持 `width`（百分比/像素）与 `align`（左对齐、居中、右对齐）。
    - 专属图片悬浮工具栏（Image Bubble Menu）：支持快捷缩放（25% / 50% / 75% / 100%）、对齐切换与删除。
    - 点击图片打开全屏画廊灯箱（Lightbox）预览，支持按比例查看细节与快捷关闭。

## Non-Goals

- 不引入外部商业第三方图床或云端对象存储（如 AWS S3 / 阿里云 OSS），采用 Go 后端独立持久化存储与本地静态文件路由。
- 不引入不可控的外部重型富文本插件，所有 UI 控件均保持对现代主题与 Retro Pixel 复古像素双主题的视觉对齐。
- 不破坏现有历史笔记与每日复盘的历史 JSON 数据结构，旧笔记中包含的纯 Base64 图片依然保持向下兼容正常渲染。

## Capabilities

### Modified Capabilities
- `rich-text-editor`: 增强悬浮菜单可交互性契约、升级图片粘贴/拖拽处理为多图并发、前端压缩、后端媒体服务接入、尺寸缩放与预览灯箱，并新增结构化多层级列表升降级、快捷键与排印规范。

## Impact

- **前端影响**：
  - `src/components/editor/menus/BubbleMenu.tsx`：清除失效类名，补齐事件穿透与失焦防护。
  - `src/components/editor/menus/ImageBubbleMenu.tsx`：新增图片专属悬浮工具条。
  - `src/components/editor/extensions/CustomKeymapExtensions.ts`：增补 `Mod-]`、`Mod-[` 与段落防逃逸键位。
  - `src/components/editor/extensions/CustomImage.ts`：扩展 `width`、`align` 属性，改造粘贴拖拽管线接入 WebP 压制与后端上传。
  - `src/components/editor/toolbars/`：`FullToolbar` 与 `CompactToolbar` 增加缩进/反缩进控制。
  - `src/components/editor/RichTextEditor.tsx`：更新多层级列表样式规则、导引线与灯箱挂载。
- **后端影响**：
  - `server/internal/handler/media_handler.go`：新增图片媒体上传与获取接口。
  - `server/cmd/server/main.go` / 路由表：注册 `/api/v1/media/upload` 与静态媒体资源路由。
