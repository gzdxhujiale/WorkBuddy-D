import { useEffect, useId, useState } from "react";
import { FileText, Power, Settings2, SlidersHorizontal, X } from "lucide-react";

type Tab = "general" | "templates";
const tabs: Array<{ id: Tab; label: string; icon: typeof Settings2 }> = [
  { id: "general", label: "通用设置", icon: SlidersHorizontal },
  { id: "templates", label: "模板管理", icon: FileText },
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

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex h-[min(600px,calc(100vh-2rem))] w-[min(900px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl" onMouseDown={event => event.stopPropagation()}>
      <aside className="w-52 shrink-0 border-r border-border bg-muted/40 p-3">
        <div className="mb-3 flex items-center gap-2 px-2 py-2 text-base font-semibold text-foreground"><Settings2 size={18} />设置</div>
        <nav aria-label="设置分类" className="space-y-1">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer ${tab === item.id ? "border border-border bg-card text-primary font-medium shadow-xs" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}><Icon size={16} />{item.label}</button>; })}</nav>
      </aside>
      <div className="min-w-0 flex-1 bg-card flex flex-col">
        <header className="flex h-13 items-center justify-between border-b border-border px-8 shrink-0"><h2 id={titleId} className="font-semibold text-foreground">{current.label}</h2><button type="button" onClick={onClose} aria-label="关闭设置" className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"><X size={18} /></button></header>
        <div className="p-8 flex-1 overflow-y-auto">{tab === "general" ? <div className="rounded-xl border border-border bg-card p-5 shadow-xs"><div className="flex items-center justify-between gap-5"><div className="flex gap-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Power size={22} /></div><div><h3 className="font-medium text-foreground">开机自启动</h3><p className="mt-1 text-sm text-muted-foreground">在计算机启动时自动运行应用</p></div></div><button type="button" role="switch" aria-checked={autostart} disabled={!ready} onClick={toggleAutostart} className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${autostart ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${autostart ? "translate-x-5" : "translate-x-0.5"}`} /></button></div><p className="mt-4 rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">开启后，电脑每次开机时程序将自动在后台运行。</p></div> : <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">模板在清单和复盘编辑器中按需加载。</div>}</div>
      </div>
    </section>
  </div>;
}
