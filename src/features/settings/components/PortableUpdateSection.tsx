import React, { useState, useEffect } from "react";
import {
  DownloadCloud,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { isTauriEnv } from "@/lib/preferences";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  checkPortableUpdate,
  downloadPortableUpdate,
  applyPortableUpdate,
  relaunchPortableApp,
  onDownloadProgress,
  type UpdateCheckResult,
  type DownloadProgressPayload,
} from "@/lib/portableUpdater";

export const PortableUpdateSection: React.FC = () => {
  const { isPixelTheme } = useAppThemeStyle();
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number | undefined>(undefined);
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [relaunching, setRelaunching] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (isTauriEnv()) {
      onDownloadProgress((payload: DownloadProgressPayload) => {
        setProgress(Math.round(payload.percentage));
        setDownloadedBytes(payload.downloaded_bytes);
        setTotalBytes(payload.total_bytes);
      }).then((fn) => {
        unlisten = fn;
      });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleCheckUpdate = async () => {
    if (!isTauriEnv()) {
      toast.info("当前处于 Web 预览环境，便携版自动更新仅在 Windows 桌面端生效");
      return;
    }

    setChecking(true);
    setStatusMessage(null);
    try {
      const res = await checkPortableUpdate();
      setCheckResult(res);
      if (res.available) {
        toast.info(`发现新版本 ${res.remote_version}！`);
      } else {
        toast.success("当前已是最新版本");
      }
    } catch (err: any) {
      console.error("检查更新异常:", err);
      setStatusMessage(typeof err === "string" ? err : err.message || "无法连接到更新服务器");
      toast.error("检查更新失败");
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadAndStage = async () => {
    if (!checkResult?.download_url || !checkResult?.sha256) return;

    setDownloading(true);
    setProgress(0);
    setStatusMessage(null);
    try {
      await downloadPortableUpdate(checkResult.download_url, checkResult.sha256);
      setIsUpdateReady(true);
      toast.success("新版本已静默下载并就绪，重启即刻生效！");
    } catch (err: any) {
      console.error("下载更新失败:", err);
      setStatusMessage(typeof err === "string" ? err : err.message || "下载或校验失败");
      toast.error("更新包下载或 SHA-256 校验失败");
    } finally {
      setDownloading(false);
    }
  };

  const handleApplyAndRestart = async () => {
    setRelaunching(true);
    try {
      await applyPortableUpdate();
      toast.info("正在重启启动新版本...");
      setTimeout(async () => {
        await relaunchPortableApp();
      }, 300);
    } catch (err: any) {
      console.error("应用热替换更新失败:", err);
      toast.error(typeof err === "string" ? err : err.message || "替换失败已自动回滚");
      setRelaunching(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 MB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div
      className={cn(
        "pt-6 space-y-4",
        isPixelTheme ? "border-t-2 border-border/90 font-mono" : "border-t border-border"
      )}
    >
      <div className="flex items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <DownloadCloud
            size={19}
            className={cn(isPixelTheme ? "text-amber-600 dark:text-amber-400" : "text-primary")}
          />
          <div>
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  "text-foreground",
                  isPixelTheme ? "font-mono font-bold text-sm" : "font-medium"
                )}
              >
                {isPixelTheme ? "版本状态与原地静默更新" : "版本信息与自动更新"}
              </h3>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold",
                  isPixelTheme
                    ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-900/30"
                    : "bg-primary/10 text-primary"
                )}
              >
                Portable 便携版
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              基于 In-place Rename 与 Cloudflare R2 全球 CDN 加速，原地静默更新无需安装包
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCheckUpdate}
          disabled={checking || downloading || relaunching}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition-all select-none disabled:opacity-50",
            isPixelTheme
              ? "rounded-xs border border-border bg-card hover:bg-muted shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              : "rounded-lg border border-border bg-background hover:bg-accent text-foreground shadow-2xs"
          )}
        >
          <RefreshCw size={13} className={cn(checking && "animate-spin")} />
          <span>{checking ? "检查中..." : "检查更新"}</span>
        </button>
      </div>

      {/* 状态卡片 */}
      {checkResult && (
        <div
          className={cn(
            "p-3.5 rounded-xl border text-xs space-y-2.5",
            isPixelTheme
              ? "rounded-xs border-2 border-border/80 bg-card/60 shadow-[2px_2px_0px_rgba(0,0,0,0.06)]"
              : "border-border/70 bg-muted/30"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {checkResult.available ? (
                <Sparkles size={15} className="text-amber-500 animate-pulse" />
              ) : (
                <CheckCircle2 size={15} className="text-emerald-500" />
              )}
              <span className="font-semibold text-foreground">
                {checkResult.available
                  ? `发现新版本: ${checkResult.remote_version}`
                  : `已是最新版本 (当前: v${checkResult.current_version})`}
              </span>
            </div>
            {checkResult.pub_date && (
              <span className="text-[11px] text-muted-foreground">
                发布时间: {new Date(checkResult.pub_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {checkResult.notes && (
            <div className="p-2 rounded bg-background/80 border border-border/50 text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {checkResult.notes}
            </div>
          )}

          {/* 下载进度条 */}
          {downloading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>正在通过 Cloudflare 边缘加速节点静默拉取...</span>
                <span>
                  {formatFileSize(downloadedBytes)}
                  {totalBytes ? ` / ${formatFileSize(totalBytes)}` : ""} ({progress}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden border border-border/40">
                <div
                  className="h-full bg-primary transition-all duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 交互按钮组 */}
          {checkResult.available && !isUpdateReady && !downloading && (
            <div className="pt-1 flex items-center justify-end">
              <button
                type="button"
                onClick={handleDownloadAndStage}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer text-primary-foreground bg-primary transition-all shadow-xs",
                  isPixelTheme
                    ? "rounded-xs shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg hover:bg-primary/90"
                )}
              >
                <DownloadCloud size={14} />
                <span>立即下载更新</span>
              </button>
            </div>
          )}

          {/* 就绪待重启 */}
          {isUpdateReady && (
            <div className="pt-1 flex items-center justify-between border-t border-border/40">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                <ShieldCheck size={14} />
                <span>SHA-256 完整性已通过，文件已准备就绪</span>
              </div>
              <button
                type="button"
                onClick={handleApplyAndRestart}
                disabled={relaunching}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs",
                  isPixelTheme
                    ? "rounded-xs shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    : "rounded-lg"
                )}
              >
                <Rocket size={14} />
                <span>{relaunching ? "正在重启..." : "立即重启生效"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {statusMessage && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
};
