import React, { useState } from "react";
import { Terminal, CheckCircle2, XCircle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ToolCallItem } from "../types";

interface AIToolCallBlockProps {
  toolCalls?: ToolCallItem[];
}

export const AIToolCallBlock: React.FC<AIToolCallBlockProps> = ({ toolCalls = [] }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return null;
  }

  const toggleItem = (key: string) => {
    setActiveKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const getStatusBadge = (status: ToolCallItem["status"], durationMs?: number) => {
    switch (status) {
      case "running":
      case "pending":
        return (
          <Badge variant="outline" className="flex items-center gap-1 font-mono text-[11px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800">
            <Loader2 className="size-3 animate-spin" />
            执行中
          </Badge>
        );
      case "success":
        return (
          <Badge variant="outline" className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="size-3" />
            已完成 {durationMs ? `(${durationMs}ms)` : ""}
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="flex items-center gap-1 font-mono text-[11px] text-destructive border-destructive/40">
            <XCircle className="size-3" />
            失败
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="my-2 space-y-2">
      {toolCalls.map((tc, idx) => {
        const itemKey = tc.id || `tool-${idx}`;
        const isExpanded = activeKeys.includes(itemKey);

        return (
          <div
            key={itemKey}
            className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-2xs"
          >
            <div
              onClick={() => toggleItem(itemKey)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs select-none cursor-pointer hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-5 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                  <Terminal className="size-3" />
                </div>
                <span className="font-mono font-medium text-foreground">
                  {tc.name}
                </span>
                {getStatusBadge(tc.status, tc.duration_ms)}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                <span>{isExpanded ? "收起" : "入参与回包"}</span>
                {isExpanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-border/80 space-y-2 text-xs font-mono bg-muted/20">
                {tc.arguments && Object.keys(tc.arguments).length > 0 && (
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-0.5">调用参数:</div>
                    <pre className="p-2 rounded bg-muted text-foreground text-[11px] overflow-x-auto max-h-36">
                      {JSON.stringify(tc.arguments, null, 2)}
                    </pre>
                  </div>
                )}
                {tc.result && (
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-0.5">执行回包:</div>
                    <pre className="p-2 rounded bg-muted text-foreground text-[11px] overflow-x-auto max-h-36">
                      {typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
