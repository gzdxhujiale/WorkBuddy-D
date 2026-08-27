# SECURITY.md

## Security Overview

WorkBuddy-D 采用基于「桌面端原生沙箱 + PostgreSQL 行级安全（RLS）强隔离 + 最小权限原则」的多层纵深安全防御架构。系统确保所有用户数据与操作边界均受数据库底层强制约束，前端界面不作为安全隔离的唯一依据：

| 安全核心不变式 | 风险动因 | 事实依据与实现控制 |
| :--- | :--- | :--- |
| **严禁前端暴露 Service Role 密钥** | 前端构建产物属于客户端公开环境，高权密钥泄露将导致全库提权风险。 | `src/lib/supabase.ts` 仅使用公开的 `anon_key`，无任何特权密钥。 |
| **所有公开业务表必须启用 RLS** | 单纯依靠 `TO authenticated` 无法阻止合法用户跨租户越权读取他人数据。 | `supabase/migrations/` 中全量表开启 `ENABLE ROW LEVEL SECURITY`。 |
| **更新与删除操作必须锁定所有权** | 缺乏所有权校验的 Update 可能导致数据被恶意重新指派（Reassign）给其他用户。 | RLS 策略强制包含 `USING (auth.uid() = user_id)` 与 `WITH CHECK` 约束。 |
| **数据库特权函数严格收敛权限** | `SECURITY DEFINER` 函数若配置不当易被用于越权提权。 | 函数显式声明安全 `search_path = public`，仅向 `authenticated` 授权。 |
| **审计与状态转换事实由数据库决定** | 客户端时钟易受篡改或存在偏差，不可作为安全或计费依据。 | 时间戳由 `DEFAULT now()` 与 `BEFORE UPDATE` 触发器强制写入。 |

## Trust Boundaries

系统清晰划分了四个核心信任边界与隔离控制模型：

1. **Webview 用户输入 ➜ 前端状态与服务层**：
   - **信任模型**：用户在输入框、富文本编辑器与快捷窗口中的输入被视为非可信（Untrusted）。
   - **安全控制**：前端在提交前执行格式与类型校验，仅向 RPC 接口传递受支持的受限 Payload 字段。
2. **前端客户端 ➜ Supabase Auth / PostgREST / RPC 接口**：
   - **信任模型**：前端运行于用户本地机器，持有公钥，不具备任何特权权限。
   - **安全控制**：所有请求必须附带有效的 JWT Bearer Token；所有表读写与 RPC 存储过程严格受 PostgreSQL RLS 策略保护。
3. **数据库变更触发器 ➜ Realtime 实时广播**：
   - **信任模型**：触发器由已提交的事务触发，可发布轻量级变更元数据。
   - **安全控制**：仅向私有主题 `user:<user_id>:sync` 发送消息；`realtime.messages` 策略严格校验 `auth.uid() = topic_user_id`，消息体仅包含 `{ table, operation, id }`，绝不包含正文或敏感行数据。
4. **前端 Webview ➜ Tauri 原生底层 API**：
   - **信任模型**：Webview 上下文与操作系统原生底层必须保持最小权限隔离。
   - **安全控制**：通过 `src-tauri/capabilities/` 显式声明各独立窗口（主窗口、快捷窗口、专注伴侣）的权限白名单，禁止全局滥用高权原生能力。

## Secrets and Configuration

密钥管理与运行时配置安全规范：

- **环境变量与凭证收敛**：项目仅依赖 `VITE_SUPABASE_URL` 与公开的 `VITE_SUPABASE_ANON_KEY`，均属于客户端安全公开配置。
- **严禁凭证硬编码**：禁止在源码、测试文件、文档、提交历史或错误堆栈中硬编码任何真实私钥或密码。
- **无敏感外联服务**：当前应用无自建私有后端中间件、无第三方支付网关、无 Webhook 暴露端点，攻击面收敛至 Supabase 托管边界。

## Known Risks or Limitations

当前已验证的安全风险与已知局限性：

- **Tauri CSP 暂未收紧**：`src-tauri/tauri.conf.json` 中 `app.security.csp` 当前配置为 `null`，尚未启用严格的内容安全策略（Content Security Policy）白名单。
- **云端控制台公共通道设置需人工确认**：Supabase Dashboard 中的“关闭公共频道访问（Allow public access to channels = false）”属于云端后台配置，无法直接通过 Git 仓库文件进行机械验证，发布前需人工复核。
- **缺乏自动化安全测试套件**：当前尚未建立针对 RLS 越权测试、Tauri Capabilities 提权测试与 SQL 注入的自动化安全回归流水线。

## Security Review Criteria

任何涉及认证鉴权、数据库迁移、RPC 编写、Tauri 权限声明或环境配置的变更，必须严格通过以下安全审查门禁：

1. **[ ] RLS 策略完备性**：新建表已显式执行 `ENABLE ROW LEVEL SECURITY`，且所有 CRUD 策略均包含 `user_id` 所有权强隔离。
2. **[ ] RPC 函数权限最小化**：新建存储过程显式配置 `SET search_path = public`，仅向 `authenticated` 授权，未向 `anon` 或 `public` 暴露。
3. **[ ] 广播通道与载荷安全**：实时广播严格限定在 `user:<user_id>:sync` 私有主题，载荷中不含笔记正文或整行敏感数据。
4. **[ ] 零高权密钥引入**：代码与构建产物中未引入 Service Role 密钥，环境变量未泄露。
5. **[ ] Tauri 原生权限最小化**：修改 Capabilities 配置时仅授予窗口所需的最小 API 白名单，未随意扩大权限范围。
