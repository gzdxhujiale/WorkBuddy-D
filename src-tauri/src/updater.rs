use std::{
    fs::{self, File},
    io::Write,
    path::PathBuf,
    process::Command,
};
use futures_util::StreamExt;
use reqwest::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

const PRIMARY_UPDATE_ENDPOINT: &str = "https://assets.workbuddy.hujiale.works/releases/latest.json";
const SECONDARY_UPDATE_ENDPOINT: &str = "https://update.workbuddy.hujiale.works/latest.json";
const FALLBACK_UPDATE_ENDPOINT: &str =
    "https://github.com/hujiale/WorkBuddy/releases/latest/download/latest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteReleaseManifest {
    pub version: String,
    pub pub_date: Option<String>,
    pub notes: Option<String>,
    pub download_url: String,
    pub github_url: Option<String>,
    pub sha256: String,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub available: bool,
    pub current_version: String,
    pub remote_version: Option<String>,
    pub pub_date: Option<String>,
    pub notes: Option<String>,
    pub download_url: Option<String>,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percentage: f32,
}

fn parse_semver(v: &str) -> Option<Version> {
    let clean = v.trim().trim_start_matches('v');
    Version::parse(clean).ok()
}

fn get_portable_paths() -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
    let current_exe = std::env::current_exe().map_err(|e| format!("无法定位当前程序路径: {}", e))?;
    let parent = current_exe
        .parent()
        .ok_or_else(|| "无法获取当前程序所在目录".to_string())?;

    let file_stem = current_exe
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("WorkBuddy");

    let tmp_path = parent.join(format!("{}.download.tmp", file_stem));
    let new_exe_path = parent.join(format!("{}.new.exe", file_stem));
    let old_exe_path = parent.join(format!("{}.old.exe", file_stem));

    Ok((current_exe, tmp_path, new_exe_path, old_exe_path))
}

/// 在启动时自动静默清理上次热替换遗留的 .old.exe 和中断的临时下载文件
pub fn cleanup_legacy_backup() {
    if let Ok((_curr, tmp, _new_exe, old_exe)) = get_portable_paths() {
        if old_exe.exists() {
            let _ = fs::remove_file(&old_exe);
        }
        if tmp.exists() {
            let _ = fs::remove_file(&tmp);
        }
    }
}

async fn fetch_manifest(client: &Client, url: &str) -> Result<RemoteReleaseManifest, String> {
    let resp = client
        .get(url)
        .header("User-Agent", "WorkBuddy-Portable-Updater/1.0")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("远端返回异常状态码: {}", resp.status()));
    }

    let manifest = resp
        .json::<RemoteReleaseManifest>()
        .await
        .map_err(|e| format!("解析版本清单失败: {}", e))?;

    Ok(manifest)
}

#[tauri::command]
pub async fn check_portable_update(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version_str = app.package_info().version.to_string();
    let current_ver = parse_semver(&current_version_str)
        .ok_or_else(|| format!("当前版本格式非法: {}", current_version_str))?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    // 优先尝试 Cloudflare R2 CDN，失败则尝试 Worker 代理，最终降级回 GitHub Releases
    let manifest = match fetch_manifest(&client, PRIMARY_UPDATE_ENDPOINT).await {
        Ok(m) => m,
        Err(err) => {
            eprintln!("[updater] R2 CDN 检查失败: {}，尝试 Worker 代理源", err);
            match fetch_manifest(&client, SECONDARY_UPDATE_ENDPOINT).await {
                Ok(m) => m,
                Err(err2) => {
                    eprintln!("[updater] Worker 代理检查失败: {}，降级回 GitHub 原始源", err2);
                    fetch_manifest(&client, FALLBACK_UPDATE_ENDPOINT)
                        .await
                        .map_err(|e| format!("所有更新通道检查均失败: {}", e))?
                }
            }
        }
    };

    let remote_ver = parse_semver(&manifest.version)
        .ok_or_else(|| format!("远端版本格式非法: {}", manifest.version))?;

    let available = remote_ver > current_ver;

    Ok(UpdateCheckResult {
        available,
        current_version: current_version_str,
        remote_version: Some(manifest.version),
        pub_date: manifest.pub_date,
        notes: manifest.notes,
        download_url: Some(manifest.download_url),
        sha256: Some(manifest.sha256),
    })
}

#[tauri::command]
pub async fn download_portable_update(
    app: AppHandle,
    download_url: String,
    expected_sha256: String,
) -> Result<String, String> {
    let (_current_exe, tmp_path, new_exe_path, _old_exe) = get_portable_paths()?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&download_url)
        .header("User-Agent", "WorkBuddy-Portable-Updater/1.0")
        .send()
        .await
        .map_err(|e| format!("下载发起失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("下载请求返回异常状态: {}", response.status()));
    }

    let total_bytes = response.content_length();
    let mut downloaded_bytes: u64 = 0;

    let mut file = File::create(&tmp_path).map_err(|e| format!("创建临时文件失败: {}", e))?;
    let mut hasher = Sha256::new();

    let mut stream = response.bytes_stream();
    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("流读取中断: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("写入文件失败: {}", e))?;
        hasher.update(&chunk);

        downloaded_bytes += chunk.len() as u64;
        let percentage = match total_bytes {
            Some(total) if total > 0 => (downloaded_bytes as f32 / total as f32) * 100.0,
            _ => 0.0,
        };

        let _ = app.emit(
            "portable-updater-progress",
            DownloadProgressPayload {
                downloaded_bytes,
                total_bytes,
                percentage,
            },
        );
    }

    file.flush().map_err(|e| format!("冲刷文件缓冲区失败: {}", e))?;
    drop(file);

    // 校验 SHA-256
    let calculated_hash = format!("{:x}", hasher.finalize());
    if !calculated_hash.eq_ignore_ascii_case(&expected_sha256.trim()) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!(
            "SHA-256 完整性校验失败！期望值: {}, 计算值: {}",
            expected_sha256, calculated_hash
        ));
    }

    // 重命名临时文件为 .new.exe
    if new_exe_path.exists() {
        let _ = fs::remove_file(&new_exe_path);
    }
    fs::rename(&tmp_path, &new_exe_path).map_err(|e| format!("重命名已就绪文件失败: {}", e))?;

    Ok("下载并校验成功，更新包已就绪".to_string())
}

#[tauri::command]
pub async fn apply_portable_update() -> Result<bool, String> {
    let (current_exe, _tmp, new_exe, old_exe) = get_portable_paths()?;

    if !new_exe.exists() {
        return Err("未找到已就绪的更新文件，请先下载更新".to_string());
    }

    // 如果残留了历史 old_exe，先移除
    if old_exe.exists() {
        let _ = fs::remove_file(&old_exe);
    }

    // 步骤 1: Windows 允许重命名正在运行中的进程自身！
    fs::rename(&current_exe, &old_exe).map_err(|e| {
        format!("备份当前运行中文件失败: {}。请检查目录写权限", e)
    })?;

    // 步骤 2: 将 new.exe 重命名为活跃的当前可执行文件名
    if let Err(e) = fs::rename(&new_exe, &current_exe) {
        // 安全回滚: 如果 new.exe 重命名失败，把 old.exe 恢复回来
        let _ = fs::rename(&old_exe, &current_exe);
        return Err(format!("新版本替换失败，已自动回滚: {}", e));
    }

    Ok(true)
}

#[tauri::command]
pub async fn relaunch_portable_app(app: AppHandle) -> Result<(), String> {
    let (current_exe, _, _, _) = get_portable_paths()?;

    // 唤起新版本进程
    Command::new(&current_exe)
        .spawn()
        .map_err(|e| format!("启动新版本失败: {}", e))?;

    // 退出当前运行中的实例
    app.exit(0);
    Ok(())
}
