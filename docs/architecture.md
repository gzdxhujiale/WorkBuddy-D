# 架构

WorkBuddy-D 分离 React 界面、查询/写入编排、Supabase 持久化和 Tauri 桌面能力。

```text
Routes/pages -> components/hooks -> services/lib
                                 -> Supabase Auth + PostgREST/RPC + private Broadcast
                                 -> Tauri APIs
Migrations -> PostgreSQL schema + RLS + triggers + RPCs
```

知识模块先加载知识库与清单容器；选择清单时获取分组和笔记元数据；打开笔记时才读取正文。Realtime Broadcast 只传精确失效线索，随后由 React Query 通过 RLS 查询权威数据。
