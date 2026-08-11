import { useEffect, useId, useState } from "react";
import { Database, FileText, ListChecks, Power, Settings2, SlidersHorizontal, X } from "lucide-react";

type Tab = "general" | "templates" | "lists" | "database";
const tabs: Array<{ id: Tab; label: string; icon: typeof Settings2 }> = [
  { id: "general", label: "通用设置", icon: SlidersHorizontal },
  { id: "templates", label: "模板管理", icon: FileText },
  { id: "lists", label: "清单设置", icon: ListChecks },
  { id: "database", label: "数据库配置", icon: Database },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("general");
  const [autostart, setAutostart] = useState(false);
  const [ready, setReady] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    void import("@tauri-apps/plugin-autostart").then(async api => { setAutostart(await api.isEnabled()); setReady(true); }).catch(() => setReady(true));
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleAutostart = async () => {
    try {
      const api = await import("@tauri-apps/plugin-autostart");
      if (autostart) await api.disable(); else await api.enable();
      setAutostart(!autostart);
    } catch { /* Browser preview has no native autostart facility. */ }
  };
  const current = tabs.find(item => item.id === tab)!;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex h-[min(600px,calc(100vh-2rem))] w-[min(900px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
      <aside className="w-52 shrink-0 border-r border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 flex items-center gap-2 px-2 py-2 text-base font-semibold"><Settings2 size={18} />设置</div>
        <nav aria-label="设置分类" className="space-y-1">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${tab === item.id ? "border border-blue-200 bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:bg-white"}`}><Icon size={16} />{item.label}</button>; })}</nav>
      </aside>
      <div className="min-w-0 flex-1 bg-white">
        <header className="flex h-13 items-center justify-between border-b border-slate-200 px-8"><h2 id={titleId} className="font-semibold text-slate-900">{current.label}</h2><button type="button" onClick={onClose} aria-label="关闭设置" className="rounded p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>
        <div className="p-9">{tab === "general" ? <div className="rounded-xl border border-slate-200 p-5 shadow-sm"><div className="flex items-center justify-between gap-5"><div className="flex gap-4"><div className="rounded-lg bg-blue-50 p-3 text-blue-600"><Power size={22} /></div><div><h3 className="font-medium text-slate-900">开机自启动</h3><p className="mt-1 text-sm text-slate-500">在计算机启动时自动运行应用</p></div></div><button type="button" role="switch" aria-checked={autostart} disabled={!ready} onClick={toggleAutostart} className={`relative h-6 w-11 rounded-full transition-colors ${autostart ? "bg-blue-600" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${autostart ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">开启后，电脑每次开机时程序将自动在后台运行。</p></div> : <div className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600">{tab === "templates" ? "模板在清单和复盘编辑器中按需加载。" : tab === "lists" ? "清单、笔记与排序变更会保留离线草稿，并在网络恢复后同步。" : "数据按登录账户隔离。当前状态、错误与最后同步时间会在各数据页面显示。"}</div>}</div>
      </div>
    </section>
  </div>;
}
