import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface UpdateCheckResult {
  available: boolean;
  current_version: string;
  remote_version?: string;
  pub_date?: string;
  notes?: string;
  download_url?: string;
  sha256?: string;
}

export interface DownloadProgressPayload {
  downloaded_bytes: u64;
  total_bytes?: u64;
  percentage: number;
}

type u64 = number;

/**
 * 检查便携版更新（通过 Cloudflare Worker 代理或 GitHub Releases）
 */
export async function checkPortableUpdate(): Promise<UpdateCheckResult> {
  return await invoke<UpdateCheckResult>('check_portable_update');
}

/**
 * 后台下载便携版更新，并执行 SHA-256 完整性校验
 */
export async function downloadPortableUpdate(
  downloadUrl: string,
  expectedSha256: string
): Promise<string> {
  return await invoke<string>('download_portable_update', {
    downloadUrl,
    expectedSha256,
  });
}

/**
 * 执行 Windows In-place Rename 原地热替换
 */
export async function applyPortableUpdate(): Promise<boolean> {
  return await invoke<boolean>('apply_portable_update');
}

/**
 * 重启拉起新版本并退出当前实例
 */
export async function relaunchPortableApp(): Promise<void> {
  return await invoke<void>('relaunch_portable_app');
}

/**
 * 监听下载进度事件
 */
export async function onDownloadProgress(
  callback: (payload: DownloadProgressPayload) => void
): Promise<UnlistenFn> {
  return await listen<DownloadProgressPayload>('portable-updater-progress', (event) => {
    callback(event.payload);
  });
}
