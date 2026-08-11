# Database Schema & Technical Architecture

> **已部署命名说明**：清单模块实际使用 `knowledge_bases`、`knowledge_base_folders`、`folder_note_groups`、`notes` 和 `knowledge_base_templates`（下文的 `list_*` 为早期逻辑模型名称）。知识库/文件夹/笔记继续使用 `deleted_at` 软删除；`daily_reviews` 改为硬删除，并通过 `delete_daily_review` RPC 执行。

> **项目说明**：本项目的后端数据库采用 **Supabase (PostgreSQL 15+)** 引擎。
> 
> **前端数据架构**：TanStack Query + Zustand 乐观更新 (Optimistic Updates) 与延迟写入 (Deferred Writes)
> 
> **前端路由**：TanStack Router

---

## 一、 数据库设计概述

1. **引擎与多租户隔离 (RLS)**：
   - 数据库引擎使用 PostgreSQL 15+（由 Supabase 托管）。
   - 所有业务表均开启 **Row Level Security (RLS)**。
   - 所有多租户/用户相关表均包含 `user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE`，确保通过 Data API (PostgREST) 暴露时具备强类型权限隔离，防止越权访问 (BOLA/IDOR)。

2. **数据保留策略与软删除 (Soft Delete)**：
   - 业务表包含 `deleted_at TIMESTAMPTZ NULL DEFAULT NULL` 字段，采用软删除机制，防止多端同步冲掉历史数据或引发并发碰撞。
   - 数据库高频索引采用带 `WHERE deleted_at IS NULL` 的 PostgreSQL **部分索引 (Partial Indexes)**，降低索引体积并极大提升检索性能。

3. **外键约束与数据一致性**：
   - 依赖 PostgreSQL 原生外键约束。
   - 父级删除时，子级关联数据提供 `ON DELETE CASCADE` 或 `ON DELETE SET NULL`。
   - 所有外键列建立独立索引，防止 JOIN 关联查询与级联删除时全表扫描。

---

## 二、 云端同步表一览

| 表名 | 业务功能 | 主键类型 | RLS隔离支持 | 软删除支持 |
| :--- | :--- | :---: | :---: | :---: |
| `mission_roles` | 使命角色定义 | UUID | ✅ (`user_id`) | ✅ |
| `mission_statement` | 个人使命宣言/宪章 | UUID | ✅ (`user_id`) | ❌ |
| `mission_goals` | 使命角色目标 | UUID | ✅ (`user_id`) | ✅ |
| `time_management_tasks` | 四象限时间管理任务 | UUID | ✅ (`user_id`) | ✅ |
| `habits` | 习惯打卡定义 | UUID | ✅ (`user_id`) | ✅ |
| `habit_checkins` | 习惯打卡历史记录 | UUID | ✅ (`user_id`) | ✅ |
| `pomodoro_records` | 番茄钟专注历史记录 | UUID | ✅ (`user_id`) | ✅ |
| `pomodoro_favorites` | 番茄钟常用预设 | UUID | ✅ (`user_id`) | ✅ |
| `list_folders` | 清单文件夹 | UUID | ✅ (`user_id`) | ✅ |
| `list_lists` | 清单/卡片集 | UUID | ✅ (`user_id`) | ✅ |
| `list_note_groups` | 清单笔记分组 | UUID | ✅ (`user_id`) | ✅ |
| `list_notes` | 清单笔记/卡片内容 | UUID | ✅ (`user_id`) | ✅ |
| `list_templates` | 清单/笔记模板 | UUID | ✅ (`user_id`) | ✅ |
| `daily_reviews` | 每日复盘与心情评分 | UUID | ✅ (`user_id`) | ✅ |
| `app_preferences` | 应用本地/云端配置偏好 | UUID | ✅ (`user_id`) | ❌ |

---

## 三、 详细表结构定义

### 1. 个人使命与角色模块 (Mission)

#### 1.1 `mission_roles` (使命角色表)

定义用户的人生角色（如 "职业者", "家庭成员", "终身学习者"）。

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 角色唯一标识 |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID (RLS隔离) |
| `name` | `TEXT` | NOT NULL | - | 角色名称 |
| `sort_order` | `INTEGER` | NOT NULL | `0` | 排序权重 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

#### 1.2 `mission_statement` (使命宣言表)

记录用户的核心价值与个人宪章。

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 宣言记录ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID (UNIQUE) |
| `content` | `TEXT` | NOT NULL | - | 宣言富文本/Markdown内容 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |

#### 1.3 `mission_goals` (使命目标表)

关联指定角色下的中长期目标。

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 目标唯一标识 |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `role_id` | `UUID` | NOT NULL, FOREIGN KEY (`mission_roles.id`) ON DELETE CASCADE | - | 所属角色ID |
| `title` | `TEXT` | NOT NULL | - | 目标标题 |
| `status` | `TEXT` | NOT NULL | `'not_started'` | 状态 (`not_started`, `in_progress`, `completed`, `abandoned`) |
| `time_scope` | `TEXT` | NOT NULL | `'long'` | 时间跨度 (`long` 长期 / `medium` 中期 / `short` 短期) |
| `start_date` | `DATE` | NULL | `NULL` | 开始日期 (`YYYY-MM-DD`) |
| `end_date` | `DATE` | NULL | `NULL` | 目标完成截止日期 |
| `sort_order` | `INTEGER` | NOT NULL | `0` | 排序权重 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

---

### 2. 时间管理与任务模块 (Time Management)

#### 2.1 `time_management_tasks` (四象限任务表)

基于史蒂芬·柯维四象限法则的任务清单。

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 任务ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `role_id` | `UUID` | NULL, FOREIGN KEY (`mission_roles.id`) ON DELETE SET NULL | `NULL` | 关联角色ID |
| `title` | `TEXT` | NOT NULL | - | 任务标题 |
| `quadrant` | `TEXT` | NOT NULL | - | 所属象限 (`Q1_URGENT_IMPORTANT`, `Q2_NOT_URGENT_IMPORTANT`, `Q3_URGENT_NOT_IMPORTANT`, `Q4_NOT_URGENT_NOT_IMPORTANT`) |
| `schedule_mode` | `TEXT` | NULL, CHECK (`point` / `range`) | `NULL` | 排期模式：`point` 为单个截止时间，`range` 为时间段 |
| `scheduled_start_at` | `TIMESTAMPTZ` | NULL | `NULL` | 时间段开始时间，仅 `range` 使用 |
| `scheduled_end_at` | `TIMESTAMPTZ` | NULL | `NULL` | 单时间的截止时间，或时间段的结束时间 |
| `completed` | `BOOLEAN` | NOT NULL | `FALSE` | 是否完成 |
| `completed_at` | `TIMESTAMPTZ` | NULL | `NULL` | 完成时间戳 |
| `description` | `TEXT` | NULL | `NULL` | 任务详细描述 |
| `reminder` | `JSONB` | NULL | `NULL` | 提醒配置(如提醒时间/推送通道) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

> **排期约束**：未设置时间时，三个排期字段均为 `NULL`；`point` 必须填写 `scheduled_end_at`；`range` 必须填写开始与结束时间，且结束时间晚于开始时间。

---

### 3. 习惯培养与打卡模块 (Habits)

#### 3.1 `habits` (习惯定义表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 习惯ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `name` | `TEXT` | NOT NULL | - | 习惯名称 |
| `frequency_type` | `TEXT` | NOT NULL, CHECK (`frequency_type IN ('daily', 'weekly_days', 'custom')`) | `'daily'` | 打卡频率类型 (`daily`, `weekly_days`, `custom`) |
| `frequency_days` | `INT[]` | NULL | `NULL` | 指定执行星期 (如 `[1,3,5]` 代表周一三五) |
| `goal` | `TEXT` | NULL | `NULL` | 打卡目标/定量要求 |
| `start_date` | `DATE` | NULL | `NULL` | 培养开始日期 (`YYYY-MM-DD`) |
| `duration` | `TEXT` | NULL | `NULL` | 目标持续时长 |
| `category` | `TEXT` | NULL | `NULL` | 分类标签 |
| `reminder` | `TEXT` | NULL | `NULL` | 每日提醒时间点 |
| `auto_popup_log` | `BOOLEAN` | NOT NULL | `FALSE` | 是否自动弹出记录框 |
| `sort_order` | `INTEGER` | NOT NULL | `0` | 排序权重 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

#### 3.2 `habit_checkins` (习惯打卡记录表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 打卡记录ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `habit_id` | `UUID` | NOT NULL, FOREIGN KEY (`habits.id`) ON DELETE CASCADE | - | 所属习惯ID |
| `date` | `DATE` | NOT NULL | - | 打卡日期 (`YYYY-MM-DD`) |
| `completed` | `BOOLEAN` | NOT NULL | `TRUE` | 完成状态 (`TRUE`: 成功打卡, `FALSE`: 未完成) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

> ⚠️ **约束条件**：`UNIQUE (user_id, habit_id, date)` 保证同一用户同一习惯在同一天只能有一条打卡记录。

---

### 4. 番茄钟与专注模块 (Pomodoro)

#### 4.1 `pomodoro_records` (专注历史记录表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 专注记录ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `mode` | `TEXT` | NOT NULL | - | 计时模式 (`pomodoro`, `stopwatch`, `count_down`) |
| `phase` | `TEXT` | NOT NULL | - | 专注阶段 (`work`, `short_break`, `long_break`) |
| `start_time` | `TIMESTAMPTZ` | NOT NULL | - | 开始时间 |
| `end_time` | `TIMESTAMPTZ` | NOT NULL | - | 结束时间 |
| `duration_minutes` | `INTEGER` | NOT NULL | - | 实际专注时长 (分钟) |
| `date` | `DATE` | NOT NULL | - | 归属日期 (`YYYY-MM-DD`) |
| `task_id` | `UUID` | NULL, FOREIGN KEY (`time_management_tasks.id`) ON DELETE SET NULL | `NULL` | 关联的时间管理任务ID |
| `linked_target` | `TEXT` | NULL | `NULL` | 关联的其它自定义目标 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

#### 4.2 `pomodoro_favorites` (专注预设表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 预设ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `name` | `TEXT` | NOT NULL | - | 预设名称 (如 "深度编程", "英语阅读") |
| `mode` | `TEXT` | NOT NULL | - | 预设模式 |
| `duration_minutes` | `INTEGER` | NOT NULL | - | 预设时长 (分钟) |
| `accumulated_minutes` | `INTEGER` | NOT NULL | `0` | 使用该预设累计专注时长 |
| `linked_target` | `TEXT` | NULL | `NULL` | 关联的目标标识 |
| `is_archived` | `BOOLEAN` | NOT NULL | `FALSE` | 是否存档 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

---

### 5. 清单与笔记文档模块 (Lists & Notes)

#### 5.1 `list_folders` (清单文件夹表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 文件夹ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `name` | `TEXT` | NOT NULL | - | 文件夹名称 |
| `is_pinned` | `BOOLEAN` | NOT NULL | `FALSE` | 是否置顶 |
| `sort_order` | `INTEGER` | NOT NULL | `0` | 排序权重 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

#### 5.2 `list_lists` (清单表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 清单ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `folder_id` | `UUID` | NULL, FOREIGN KEY (`list_folders.id`) ON DELETE SET NULL | `NULL` | 父文件夹ID |
| `name` | `TEXT` | NOT NULL | - | 清单名称 |
| `icon` | `TEXT` | NOT NULL | `''` | 清单图标 |
| `color` | `TEXT` | NOT NULL | `'#000000'` | 清单主题色 |
| `view_type` | `TEXT` | NOT NULL | `'list'` | 视图显示模式 (`list`, `kanban`, `grid`) |
| `is_pinned` | `BOOLEAN` | NOT NULL | `FALSE` | 是否置顶 |
| `sort_order` | `INTEGER` | NOT NULL | `0` | 排序权重 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

#### 5.3 `list_note_groups` (清单笔记分组表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 分组ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `list_id` | `UUID` | NOT NULL, FOREIGN KEY (`list_lists.id`) ON DELETE CASCADE | - | 所属清单ID |
| `name` | `TEXT` | NOT NULL | - | 分组名称 (如 "待处理", "进行中") |
| `sort_order` | `INTEGER` | NOT NULL | `0` | 排序权重 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

#### 5.4 `list_notes` (笔记/卡片条目表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 笔记ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `list_id` | `UUID` | NOT NULL, FOREIGN KEY (`list_lists.id`) ON DELETE CASCADE | - | 所属清单ID |
| `group_id` | `UUID` | NULL, FOREIGN KEY (`list_note_groups.id`) ON DELETE SET NULL | `NULL` | 所属分组ID |
| `title` | `TEXT` | NOT NULL | `''` | 笔记标题 |
| `content` | `TEXT` | NOT NULL | - | 笔记正文内容 (Markdown/HTML) |
| `is_pinned` | `BOOLEAN` | NOT NULL | `FALSE` | 是否置顶 |
| `sort_order` | `INTEGER` | NOT NULL | `0` | 排序权重 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

#### 5.5 `list_templates` (清单模板表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 模板ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `name` | `TEXT` | NOT NULL | - | 模板名称 |
| `content` | `JSONB` | NOT NULL | - | 预设模板结构内容 (JSON) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

---

### 6. 每日复盘与系统本地管理表 (Daily Review & System)

#### 6.1 `daily_reviews` (每日复盘表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 复盘记录ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `date` | `DATE` | NOT NULL | - | 归属日期 (`YYYY-MM-DD`) |
| `content` | `JSONB` | NOT NULL | - | 复盘总结与心情评分结构 (JSON/Markdown) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | `NULL` | 软删除时间 |

> ⚠️ **约束条件**：`UNIQUE (user_id, date)` 保证同一用户在同一天只能有一条复盘记录。

#### 6.2 `app_preferences` (应用配置偏好表)

| 字段名 | 类型 | 约束 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY, NOT NULL | `gen_random_uuid()` | 记录ID |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY (`auth.users.id`) ON DELETE CASCADE | `auth.uid()` | 所属用户ID |
| `pref_key` | `TEXT` | NOT NULL | - | 配置项 Key |
| `pref_value` | `JSONB` | NOT NULL | - | 配置项 Value |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 最后修改时间 |

> ⚠️ **约束条件**：`UNIQUE (user_id, pref_key)` 保证用户配置键的唯一性。

---

## 四、 Supabase 行级安全 (RLS) 规范

所有业务表在创建时必须显式开启 RLS，并配置 `TO authenticated` 与 `user_id` 匹配策略：

```sql
-- 以 mission_roles 表为例 (所有业务表遵循此通用策略模版)
ALTER TABLE public.mission_roles ENABLE ROW LEVEL SECURITY;

-- 查询策略 (SELECT)
CREATE POLICY "Users can select own records"
ON public.mission_roles FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

-- 插入策略 (INSERT)
CREATE POLICY "Users can insert own records"
ON public.mission_roles FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

-- 更新策略 (UPDATE: 必须同时包含 USING 和 WITH CHECK)
CREATE POLICY "Users can update own records"
ON public.mission_roles FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- 删除策略 (DELETE)
CREATE POLICY "Users can delete own records"
ON public.mission_roles FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);
```

---

## 五、 高频数据库索引 (PostgreSQL Partial Indexes)

为支持高性能列表渲染与软删除，系统在 PostgreSQL 中创建以下带 `WHERE deleted_at IS NULL` 的**部分索引**及**外键索引**：

```sql
-- 1. 清单与笔记相关部分索引
CREATE INDEX idx_list_lists_folder ON public.list_lists (user_id, folder_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_list_note_groups_list ON public.list_note_groups (user_id, list_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_list_notes_list_group ON public.list_notes (user_id, list_id, group_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_list_notes_pinned ON public.list_notes (user_id, list_id, is_pinned) WHERE deleted_at IS NULL AND is_pinned = TRUE;

-- 2. 使命与任务相关部分索引
CREATE INDEX idx_mission_goals_role ON public.mission_goals (user_id, role_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_time_management_tasks_quadrant ON public.time_management_tasks (user_id, quadrant) WHERE deleted_at IS NULL;
CREATE INDEX idx_time_management_tasks_schedule ON public.time_management_tasks (user_id, scheduled_end_at, scheduled_start_at) WHERE deleted_at IS NULL AND scheduled_end_at IS NOT NULL;
CREATE INDEX idx_time_management_tasks_role ON public.time_management_tasks (role_id) WHERE role_id IS NOT NULL;

-- 3. 习惯打卡与番茄钟部分索引
CREATE INDEX idx_habit_checkins_habit_date ON public.habit_checkins (user_id, habit_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_pomodoro_records_user_date ON public.pomodoro_records (user_id, date, start_time) WHERE deleted_at IS NULL;
CREATE INDEX idx_pomodoro_records_task ON public.pomodoro_records (task_id) WHERE task_id IS NOT NULL;
```
