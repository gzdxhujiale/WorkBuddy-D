# Design

## Context

WorkBuddy-D 富文本编辑器由基于 `@tiptap/react` 组合式架构搭建的模块化体系（`src/components/editor/`）驱动，同时服务于今日任务快速编辑（`minimal`）、每日复盘与侧边抽屉（`compact`）及知识库全功能笔记（`full`）。Go 独立后端提供 RESTful API 与数据持久化。详细动因参见 `proposal.md`。

## Goals / Non-Goals

**Goals:**
- 恢复每日复盘与笔记编辑器中选中文本浮动菜单（Bubble Menu）的完整可用性与即刻可点击交互。
- 建立统一且符合桌面操作直觉的多级列表升降级（`Mod-]` / `Mod-[` / `Tab` / `Shift-Tab`）与无缝排版系统。
- 阻断普通文本段落下的 `Tab` 焦点逃逸，提升长文撰写稳定性。
- 引入 Go 后端专用媒体存储端点（`/api/v1/media/upload`），杜绝大体积未压缩 Base64 污染文档 JSON。
- 构筑前端自动 Canvas WebP 压制、多图并发拖拽队列与骨架加载态。
- 赋予图片节点可交互的尺寸调节、对齐方式、专属悬浮菜单及全屏灯箱（Lightbox）预览。

**Non-Goals:**
- 不对接第三方商业图床（S3、OSS），保持本地单机后端自包含服务。
- 不强制对历史笔记存量 Base64 做破坏性迁移，保持向下兼容读写。

## Decisions

### 1. 浮动菜单（Bubble Menu）事件模型重构与防失焦保护

* **技术选择**：
  - 彻底移除 `BubbleMenu.tsx` 根元素上无效的 `pointer-events-none data-[state=visible]:pointer-events-auto` 类名，直接使用纯净的 `pointer-events-auto`。
  - 为浮动工具栏中的所有 `<button>` 增加 `onMouseDown={(e) => e.preventDefault()}`。
* **原因与替代方案**：
  - `@tiptap/extension-bubble-menu` 并不向 DOM 添加 `data-state` 属性，原代码遗留的样式导致浏览器始终判定浮动层穿透。
  - 如果不拦截 `mousedown`，鼠标点击操作会导致 ProseMirror 编辑器立即失去焦点并折叠选区，导致浮动菜单在 `click` 触发前被卸载。通过 `e.preventDefault()` 可锁定编辑器选区。

### 2. 列表层级切换与 Tab 防逃逸架构

```
                     键盘事件与命令分发流程
────────────────────────────────────────────────────────────────
 按下 Mod-] / Tab
        │
        ├─▶ 是否在 listItem 中?  ──(是)──▶ 执行 sinkListItem('listItem')
        │
        ├─▶ 是否在 taskItem 中?  ──(是)──▶ 执行 sinkListItem('taskItem')
        │
        └─▶ 处于常规段落/块中?   ──(是)──▶ 阻止默认跳焦，插入2个空格/水平缩进
```

* **技术选择**：
  - 在 `CustomKeymapExtensions.ts` 集中注册 `Mod-]` 与 `Mod-[`，并在检测到列表中按 `Tab` / `Shift-Tab` 时执行升降级。
  - 对于常规非列表段落，配置按 `Tab` 时执行 `insertContent("  ")`（插入2个空格）并阻止默认行为，杜绝 Webview 焦点向外部 DOM 控件（如侧边栏导航、窗口控制按钮）发生逃逸。
  - 在 `FullToolbar.tsx` 与 `CompactToolbar.tsx` 增加可视化 `Indent`（增加缩进）与 `Outdent`（减少缩进）按钮，并绑定相同的命令能力。

### 3. 多层级排版体系与垂直间隙优化

* **技术选择**：
  - 符号阶梯：
    ```css
    ul: list-disc
    ul ul: list-[circle]
    ul ul ul: list-[square]
    ol: list-decimal
    ol ol: list-[lower-alpha]
    ol ol ol: list-[lower-roman]
    ```
  - 外边距塌陷重置：为 `li ul` 和 `li ol` 设定 `my-0.5`，消除默认 `my-1.5` 在多层嵌套时造成的巨大垂直撕裂断层。
  - 辅助导引线：为深层子列表左边距配置微弱引导线（`border-l border-border/40 pl-3.5`），在浅色、暗色及 Retro Pixel 主题下均呈现清晰缩进参考。

### 4. Go 后端独立媒体存储端点设计

* **技术选择**：
  - 新增路由 `POST /api/v1/media/upload`：
    - 鉴权：集成现有 JWT 用户中间件，确保仅授权用户可上传。
    - 限制：`MaxMultipartMemory` 设定为 12MB，限制单图最大 10MB。
    - 校验：嗅探二进制文件头（`http.DetectContentType`），严格仅放行 `image/jpeg`、`image/png`、`image/webp`、`image/gif`、`image/svg+xml`。
    - 去重与落盘：计算内容的 SHA-256 哈希，存放在 `data/media/<hash>.<ext>`。如果该哈希文件已存在，直接复用既有存储，返回相对或绝对静态访问地址 `/api/v1/media/assets/<hash>.<ext>`。
  - 静态服务：在 HTTP 路由树挂载静态文件文件服务，并配置 `Cache-Control: public, max-age=31536000, immutable` 强缓存。

### 5. 前端客户端压缩与并发拖拽管线

* **技术选择**：
  - 构建客户端辅助函数 `compressImageToWebP(file: File, maxWidth = 1920, quality = 0.82): Promise<{ blob: Blob, dataUrl: string }>`。
  - 在剪贴板粘贴与文件拖拽时：
    1. 立即通过 `files.filter(...)` 提取所有图片文件（支持批量多图）。
    2. 生成临时客户端 Object URL 或占位标记，并在当前光标处插入带 `loading: true` 属性的占位节点。
    3. 异步并发调用后端上传接口；上传成功后，原子更新图片节点 `src` 为正式媒体 URL，并将 `loading` 置为 `false`。
    4. 若处于离线模式或后端不可达，平滑降级为将压缩后的轻量 WebP Data URL 存入文档，确保编辑流程零中断。

### 6. 图片交互排版扩展、专属菜单与灯箱

* **技术选择**：
  - 扩展 `CustomImage` 节点属性：
    - `width`: 支持字符串（`"25%"`, `"50%"`, `"75%"`, `"100%"` 或像素值），默认 `"100%"`。
    - `align`: 支持 `"left"` | `"center"` | `"right"`，默认 `"center"`。
  - 渲染结构：
    ```html
    <figure class="my-3 block transition-all" data-align="center">
      <div class="relative inline-block max-w-full" style="width: 50%;">
        <img src="..." class="rounded-lg border ..." />
      </div>
    </figure>
    ```
  - 新建 `ImageBubbleMenu.tsx`：当选中图片节点时呼出，提供尺寸比例切换（25%、50%、75%、100%）、对齐切换（左、中、右）、放大查看大图及删除按钮。
  - 新建 `ImageLightbox.tsx`：提供现代扁平与 Retro Pixel 双风格的大图查看模态层，支持按比例缩放查看和 `Esc` 快捷退出。

## Risks / Trade-offs

- **[Risk] 后端数据目录迁移与多平台路径差异**  
  → **Mitigation**：存储目录使用从配置文件/环境变量读取的统一抽象（默认 `./data/media`），使用 Go 标准库 `filepath.Join` 处理跨平台路径分隔符，服务启动时自动调用 `os.MkdirAll` 确保目录就绪。
- **[Risk] 离线网络下图片上传失败阻断记录**  
  → **Mitigation**：前端实现优雅容错机制，当 `/api/v1/media/upload` 请求超时或失败时，自动退回到 Canvas 压制后的轻量 WebP Data URL 写入，保障笔记内容绝对安全，并在右下角轻量提示。
- **[Risk] 历史笔记存量 Base64 渲染**  
  → **Mitigation**：`CustomImage` 的 `src` 属性完全兼容 HTTP 路径、相对路径以及既有历史 Data URL，不执行破坏性重构。

## Migration Plan

1. **后端端点交付**：在 `server/` 新增媒体上传 Handler、路由与静态文件托管，完成单元测试。
2. **前端基础交互修复**：修复 `BubbleMenu.tsx` 交互穿透，增强多级列表键盘映射与排印样式。
3. **前端图片处理流交付**：实现 Canvas 压制工具、更新 `CustomImage` 接入上传与多图拖拽。
4. **图片高级交互交付**：引入 `ImageBubbleMenu` 与 `ImageLightbox`，接入双主题。
5. **全流程回归**：在复盘页面验证悬浮菜单、多级列表升降、多图粘贴上传及大图预览。
