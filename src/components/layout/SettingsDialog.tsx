import { useEffect, useId, useState } from "react";
import { FileText, Settings2, SlidersHorizontal, Timer, X } from "lucide-react";
import { setOpenFocusAssistantOnStart as persistOpenFocusAssistantOnStart, shouldOpenFocusAssistantOnStart } from "@/lib/preferences";

type Tab = "general" | "templates";

const tabs: Array<{ id: Tab; label: string; icon: typeof Settings2 }> = [
  { id: "general", label: "通用设置", icon: SlidersHorizontal },
  { id: "templates", label: "模板管理", icon: FileText },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("general");
  const [openFocusAssistantOnStart, setOpenFocusAssistantOnStart] = useState(shouldOpenFocusAssistantOnStart);
  const titleId = useId();
  const current = tabs.find((item) => item.id === tab)!;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleFocusAssistantOnStart = () => {
    setOpenFocusAssistantOnStart((enabled) => {
      const next = !enabled;
      persistOpenFocusAssistantOnStart(next);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex h-[min(600px,calc(100vh-2rem))] w-[min(900px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <aside className="w-52 shrink-0 border-r border-border bg-muted/40 p-3">
          <div className="mb-3 flex items-center gap-2 px-2 py-2 text-base font-semibold text-foreground"><Settings2 size={18} />设置</div>
          <nav aria-label="设置分类" className="space-y-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${tab === item.id ? "border border-border bg-card font-medium text-primary shadow-xs" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}><Icon size={16} />{item.label}</button>;
            })}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-card">
          <header className="flex h-13 shrink-0 items-center justify-between border-b border-border px-8"><h2 id={titleId} className="font-semibold text-foreground">{current.label}</h2><button type="button" onClick={onClose} aria-label="关闭设置" className="cursor-pointer rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><X size={18} /></button></header>
          <div className="flex-1 overflow-y-auto p-8">
            {tab === "general" ? (
              <div className="flex items-center justify-between gap-5 border-b border-border pb-5">
                <div className="flex items-center gap-3"><Timer size={19} className="text-primary" /><div><h3 className="font-medium text-foreground">启动时打开悬浮专注助手</h3><p className="mt-1 text-sm text-muted-foreground">打开应用后自动显示专注助手</p></div></div>
                <button type="button" role="switch" aria-checked={openFocusAssistantOnStart} onClick={toggleFocusAssistantOnStart} className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${openFocusAssistantOnStart ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${openFocusAssistantOnStart ? "translate-x-5" : "translate-x-0.5"}`} /></button>
              </div>
            ) : <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">模板在清单和复盘编辑器中按需加载。</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
