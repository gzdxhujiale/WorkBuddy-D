import { useEffect, useState, useRef, useTransition, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Y from "yjs";
import {
  History,
  Plus,
  RotateCcw,
  LoaderCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  FileText,
} from "lucide-react";
import { Drawer, DrawerHeader, DrawerTitle, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/syncEngine";
import * as knowledgeService from "../api/knowledgeService";
import type { NoteSnapshot } from "../api/notes";
import {
  base64ToBytes,
  createDocSnapshotBase64,
  computeSnapshotDiff,
  computeRawTextDiff,
  restoreDocFromSnapshot,
  extractBlocksFromYDoc,
  type DocumentDiffResult,
} from "../utils/snapshotDiff";

export interface NoteVersionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  noteTitle: string;
  ydoc: Y.Doc | null;
  currentContent: string;
  onRestoreContent: (restoredContent: string) => void;
}

export function NoteVersionHistoryDrawer({
  open,
  onOpenChange,
  noteId,
  noteTitle,
  ydoc,
  currentContent,
  onRestoreContent,
}: NoteVersionHistoryDrawerProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const queryClient = useQueryClient();

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<DocumentDiffResult | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode, setViewMode] = useState<"diff" | "clean">("diff");
  const [activeChangeIndex, setActiveChangeIndex] = useState<number>(0);
  const [, startDiffTransition] = useTransition();
  const snapshotDataCacheRef = useRef<Record<string, string>>({});

  const changedBlockIndices = useMemo(() => {
    if (!diffResult?.blocks) return [];
    const indices: number[] = [];
    diffResult.blocks.forEach((block, idx) => {
      if (block.status === "added" || block.status === "removed" || block.status === "modified") {
        indices.push(idx);
      }
    });
    return indices;
  }, [diffResult]);

  const handleJumpChange = (direction: "prev" | "next") => {
    if (changedBlockIndices.length === 0) return;
    let nextIdx =
      direction === "next" ? activeChangeIndex + 1 : activeChangeIndex - 1;
    if (nextIdx >= changedBlockIndices.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = changedBlockIndices.length - 1;
    setActiveChangeIndex(nextIdx);

    const blockIdx = changedBlockIndices[nextIdx];
    const targetEl = document.getElementById(`note-diff-block-${blockIdx}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    setActiveChangeIndex(0);
  }, [selectedSnapshotId]);

  // 1. Lightweight snapshot list via TanStack Query (cached for 5 minutes)
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: queryKeys.notes.snapshots(noteId),
    queryFn: () => knowledgeService.listNoteSnapshots(noteId),
    enabled: open && Boolean(noteId),
    staleTime: 1000 * 60 * 5,
  });

  const selectedSnapshot =
    snapshots.find((s) => s.id === selectedSnapshotId) ?? snapshots[0] ?? null;

  // 2. Compute diff on demand when snapshot selection or live content changes
  useEffect(() => {
    if (!open || !selectedSnapshot || !noteId) {
      if (!open) {
        setSelectedSnapshotId(null);
        setDiffResult(null);
      }
      return;
    }

    let isCancelled = false;
    const snapId = selectedSnapshot.id;

    const loadDataAndDiff = async () => {
      setIsDiffLoading(true);
      try {
        let snapshotData = snapshotDataCacheRef.current[snapId] || selectedSnapshot.snapshotData;
        if (!snapshotData) {
          const detail = await queryClient.fetchQuery({
            queryKey: queryKeys.notes.snapshotDetail(noteId, snapId),
            queryFn: () => knowledgeService.getNoteSnapshot(noteId, snapId),
            staleTime: 1000 * 60 * 10,
          });
          snapshotData = detail.snapshotData;
          snapshotDataCacheRef.current[snapId] = snapshotData;
        }

        if (isCancelled) return;

        startDiffTransition(() => {
          try {
            if (ydoc && snapshotData) {
              const bytes = base64ToBytes(snapshotData);
              const result = computeSnapshotDiff(ydoc, bytes);
              setDiffResult(result);
            } else {
              const result = computeRawTextDiff(selectedSnapshot.summary || "", currentContent);
              setDiffResult(result);
            }
          } catch (err) {
            console.error("Diff calculation error, falling back to text diff:", err);
            const result = computeRawTextDiff(selectedSnapshot.summary || "", currentContent);
            setDiffResult(result);
          }
        });
      } catch (err) {
        console.error("Failed to load note snapshot data:", err);
      } finally {
        if (!isCancelled) {
          setIsDiffLoading(false);
        }
      }
    };

    void loadDataAndDiff();

    return () => {
      isCancelled = true;
    };
  }, [open, selectedSnapshot?.id, noteId, ydoc, currentContent, queryClient]);

  // Manually create a new snapshot point
  const handleCreateSnapshot = async () => {
    if (!noteId) return;
    setIsCreating(true);
    try {
      let snapshotData = "";
      if (ydoc) {
        snapshotData = createDocSnapshotBase64(ydoc);
      } else {
        snapshotData = btoa(unescape(encodeURIComponent(currentContent)));
      }

      const summary = `手动保存点 - ${new Date().toLocaleTimeString("zh-CN")}`;
      const newSnapshot = await knowledgeService.createNoteSnapshot(noteId, snapshotData, summary);
      snapshotDataCacheRef.current[newSnapshot.id] = newSnapshot.snapshotData;
      queryClient.setQueryData<NoteSnapshot[]>(
        queryKeys.notes.snapshots(noteId),
        (prev) => [newSnapshot, ...(prev || [])]
      );
      setSelectedSnapshotId(newSnapshot.id);
      toast.success("已创建当前版本快照");
    } catch (err) {
      console.error("Create snapshot failed:", err);
      toast.error("创建版本快照失败");
    } finally {
      setIsCreating(false);
    }
  };

  // Restore snapshot content
  const handleRestore = async (snapshot: NoteSnapshot) => {
    try {
      let snapshotData = snapshotDataCacheRef.current[snapshot.id] || snapshot.snapshotData;
      if (!snapshotData) {
        const detail = await queryClient.fetchQuery({
          queryKey: queryKeys.notes.snapshotDetail(noteId, snapshot.id),
          queryFn: () => knowledgeService.getNoteSnapshot(noteId, snapshot.id),
          staleTime: 1000 * 60 * 10,
        });
        snapshotData = detail.snapshotData;
        snapshotDataCacheRef.current[snapshot.id] = snapshotData;
      }

      let restoredText = "";
      if (ydoc && snapshotData) {
        const bytes = base64ToBytes(snapshotData);
        const historicalDoc = restoreDocFromSnapshot(ydoc, bytes);
        const blocks = extractBlocksFromYDoc(historicalDoc);
        restoredText = blocks.map((b) => b.text).join("\n\n");
      }

      if (!restoredText && snapshot.summary) {
        restoredText = snapshot.summary;
      }

      if (restoredText) {
        onRestoreContent(restoredText);
        toast.success("已成功恢复至该历史版本！");
        onOpenChange(false);
      } else {
        toast.error("历史版本内容为空，无法恢复");
      }
    } catch (err) {
      console.error("Restore failed:", err);
      toast.error("恢复历史快照失败，请稍后重试");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} side="right" className="w-[880px] max-w-[96vw]">
      <DrawerHeader onClose={() => onOpenChange(false)}>
        <div className="flex items-center gap-2">
          <History className="size-5 text-primary" />
          <DrawerTitle className="text-base">
            版本历史 & 可视化对比 - {noteTitle || "未命名笔记"}
          </DrawerTitle>
        </div>
      </DrawerHeader>

      <DrawerContent className="p-4 flex flex-col gap-4 overflow-hidden h-full">
        {/* Top Actions Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70 shrink-0">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5" />
            共 {snapshots.length} 个历史快照
          </div>
          <Button
            size="sm"
            onClick={handleCreateSnapshot}
            disabled={isCreating}
            className={cn(
              "h-8 text-xs flex items-center gap-1.5",
              isPixelTheme && "font-mono shadow-[2px_2px_0px_#000]"
            )}
          >
            {isCreating ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            创建当前快照
          </Button>
        </div>

        {/* Main Body: Snapshots list + Visual Diff Viewport */}
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          {/* Snapshots Timeline List */}
          <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto pr-1 border-r border-border/60">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
                <LoaderCircle className="size-5 animate-spin text-primary" />
                正在加载历史记录...
              </div>
            ) : snapshots.length === 0 ? (
              <div className="text-center py-10 px-2 text-xs text-muted-foreground">
                暂无版本快照，点击上方按钮创建首个快照
              </div>
            ) : (
              snapshots.map((snap, index) => {
                const isSelected = selectedSnapshot?.id === snap.id;
                const dateStr = new Date(snap.createdAt).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <button
                    key={snap.id}
                    onClick={() => setSelectedSnapshotId(snap.id)}
                    className={cn(
                      "w-full text-left p-2.5 transition-all text-xs flex flex-col gap-1 cursor-pointer",
                      isPixelTheme
                        ? "border font-mono rounded-xs"
                        : "rounded-lg border",
                      isSelected
                        ? isPixelTheme
                          ? "bg-amber-100 border-amber-900 text-amber-950 dark:bg-amber-950 dark:text-amber-100 shadow-[1px_1px_0px_#000]"
                          : "bg-primary/10 border-primary text-primary shadow-2xs font-medium"
                        : "bg-card hover:bg-accent border-border text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>#{snapshots.length - index} 快照</span>
                      <ChevronRight className="size-3 opacity-60" />
                    </div>
                    <div className="text-[11px] text-muted-foreground">{dateStr}</div>
                    {snap.summary && (
                      <div className="text-[10px] text-muted-foreground/80 truncate">
                        {snap.summary}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Visual Diff Viewport (Feishu / DingTalk Style) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-card/40 rounded-lg border border-border/70 shadow-2xs">
            {selectedSnapshot ? (
              <>
                {/* Feishu-Style Diff Header Bar */}
                <div className="flex items-center justify-between p-2.5 px-3.5 border-b border-border/70 bg-card/80 shrink-0 gap-3">
                  {/* Left: View Mode Toggle & Stats */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center p-0.5 rounded-md bg-muted/80 border border-border/60 text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode("diff")}
                        className={cn(
                          "px-2.5 py-0.5 rounded-sm transition-all font-medium cursor-pointer text-xs",
                          viewMode === "diff"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        痕迹对比
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("clean")}
                        className={cn(
                          "px-2.5 py-0.5 rounded-sm transition-all font-medium cursor-pointer text-xs",
                          viewMode === "clean"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        纯净预览
                      </button>
                    </div>

                    {viewMode === "diff" && diffResult?.stats && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
                          +{diffResult.stats.additions}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-bold line-through">
                          -{diffResult.stats.deletions}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Center: Diff Navigator */}
                  {viewMode === "diff" && changedBlockIndices.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                      <button
                        type="button"
                        onClick={() => handleJumpChange("prev")}
                        className="p-0.5 rounded hover:bg-muted text-foreground transition-colors cursor-pointer"
                        title="上一处修改"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <span className="font-mono text-[11px] font-medium text-foreground px-1">
                        {activeChangeIndex + 1} / {changedBlockIndices.length} 处变更
                      </span>
                      <button
                        type="button"
                        onClick={() => handleJumpChange("next")}
                        className="p-0.5 rounded hover:bg-muted text-foreground transition-colors cursor-pointer"
                        title="下一处修改"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Right: Restore Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(selectedSnapshot)}
                    className={cn(
                      "h-7 text-xs flex items-center gap-1 hover:border-primary font-medium",
                      isPixelTheme && "font-mono shadow-[1px_1px_0px_#000]"
                    )}
                  >
                    <RotateCcw className="size-3 text-primary" />
                    恢复此版本
                  </Button>
                </div>

                {/* Diff Blocks Rendering (WYSIWYG Natural Document Style) */}
                {isDiffLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle className="size-5 animate-spin text-primary" />
                    正在比对版本差异...
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-2.5 font-sans leading-relaxed text-sm bg-background/50">
                    {diffResult?.blocks && diffResult.blocks.length > 0 ? (
                      diffResult.blocks.map((block, bIdx) => {
                        if (viewMode === "clean" && block.status === "removed") return null;

                        return (
                          <div
                            key={bIdx}
                            id={`note-diff-block-${bIdx}`}
                            className={cn(
                              "transition-all duration-200 rounded-xs",
                              viewMode === "diff" &&
                                block.status === "added" &&
                                "border-l-3 border-emerald-500 pl-3 py-1 bg-emerald-500/5",
                              viewMode === "diff" &&
                                block.status === "removed" &&
                                "border-l-3 border-rose-500 pl-3 py-1 bg-rose-500/5",
                              viewMode === "diff" &&
                                block.status === "modified" &&
                                "border-l-3 border-amber-500 pl-3 py-1 bg-amber-500/5"
                            )}
                          >
                            {block.type === "heading" ? (
                              block.level === 1 ? (
                                <h1 className="text-xl font-bold tracking-tight text-foreground my-2">
                                  {block.spans.map((span, sIdx) => (
                                    <DiffSpanView key={sIdx} span={span} viewMode={viewMode} />
                                  ))}
                                </h1>
                              ) : block.level === 2 ? (
                                <h2 className="text-lg font-semibold tracking-tight text-foreground my-1.5">
                                  {block.spans.map((span, sIdx) => (
                                    <DiffSpanView key={sIdx} span={span} viewMode={viewMode} />
                                  ))}
                                </h2>
                              ) : (
                                <h3 className="text-base font-medium text-foreground my-1">
                                  {block.spans.map((span, sIdx) => (
                                    <DiffSpanView key={sIdx} span={span} viewMode={viewMode} />
                                  ))}
                                </h3>
                              )
                            ) : block.type === "code_block" ? (
                              <pre className="p-3 bg-muted/70 rounded-md font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-border/50 text-foreground my-1.5">
                                {block.spans.map((span, sIdx) => (
                                  <DiffSpanView key={sIdx} span={span} viewMode={viewMode} />
                                ))}
                              </pre>
                            ) : block.type === "blockquote" ? (
                              <blockquote className="border-l-3 border-primary/60 pl-3.5 py-1.5 my-1.5 bg-muted/30 italic text-muted-foreground rounded-r-xs">
                                {block.spans.map((span, sIdx) => (
                                  <DiffSpanView key={sIdx} span={span} viewMode={viewMode} />
                                ))}
                              </blockquote>
                            ) : block.type === "list_item" ? (
                              <div className="flex items-start gap-2 my-1 text-foreground/90">
                                <span className="text-primary/70 select-none font-bold">•</span>
                                <div>
                                  {block.spans.map((span, sIdx) => (
                                    <DiffSpanView key={sIdx} span={span} viewMode={viewMode} />
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-foreground/90 my-1">
                                {block.spans.map((span, sIdx) => (
                                  <DiffSpanView key={sIdx} span={span} viewMode={viewMode} />
                                ))}
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-16">
                        <Sparkles className="size-6 text-muted-foreground/50" />
                        <span>该快照与当前编辑内容完全一致，无任何变更</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-16">
                <FileText className="size-8 text-muted-foreground/30" />
                <span className="text-xs">请在左侧选择一个历史快照查看差异对比</span>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function DiffSpanView({
  span,
  viewMode = "diff",
}: {
  span: { type: "added" | "removed" | "unchanged"; text: string };
  viewMode?: "diff" | "clean";
}) {
  if (viewMode === "clean") {
    if (span.type === "removed") return null;
    return <span>{span.text}</span>;
  }

  if (span.type === "added") {
    return (
      <span className="bg-emerald-500/18 text-emerald-950 dark:text-emerald-100 font-semibold px-0.5 rounded-2xs underline decoration-emerald-500/80 decoration-2">
        {span.text}
      </span>
    );
  }
  if (span.type === "removed") {
    return (
      <span className="bg-rose-500/18 text-rose-950 dark:text-rose-100 line-through opacity-85 px-0.5 rounded-2xs decoration-rose-500/80 decoration-2">
        {span.text}
      </span>
    );
  }
  return <span>{span.text}</span>;
}
