#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const releaseDir = path.join(rootDir, 'release');

function readCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return pkg.version || '0.1.0';
}

function normalizeVersion(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/^v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/);
  return match ? match[1] : null;
}

function updatePackageJson(version) {
  const content = fs.readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(content);
  pkg.version = version;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

function updateTauriConf(version) {
  const content = fs.readFileSync(tauriConfPath, 'utf8');
  const conf = JSON.parse(content);
  conf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2) + '\n', 'utf8');
}

function updateCargoToml(version) {
  let content = fs.readFileSync(cargoTomlPath, 'utf8');
  // Only replace version under [package] section
  const packageRegex = /(\[package\][\s\S]*?version\s*=\s*)"[^"]+"/;
  if (!packageRegex.test(content)) {
    throw new Error('Could not find version under [package] in Cargo.toml');
  }
  content = content.replace(packageRegex, `$1"${version}"`);
  fs.writeFileSync(cargoTomlPath, content, 'utf8');
}

function calculateSha256(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

function generateLatestJson(version, notes = '', artifactPath = null) {
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  let sha256 = '';
  let size = 0;
  if (artifactPath && fs.existsSync(artifactPath)) {
    sha256 = calculateSha256(artifactPath);
    size = fs.statSync(artifactPath).size;
  }

  const manifest = {
    version: `v${version}`,
    pub_date: new Date().toISOString(),
    notes: notes || `WorkBuddy-D Release v${version}`,
    download_url: `https://assets.workbuddy.hujiale.works/releases/v${version}/WorkBuddy-portable-x64.exe`,
    proxy_url: `https://update.workbuddy.hujiale.works/download/v${version}/WorkBuddy-portable-x64.exe`,
    github_url: `https://github.com/hujiale/WorkBuddy/releases/download/v${version}/WorkBuddy-portable-x64.exe`,
    sha256: sha256 || 'SHA256_PLACEHOLDER',
    size: size || 0
  };

  const manifestPath = path.join(releaseDir, 'latest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { manifestPath, manifest };
}

async function promptVersion(currentVersion) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`\x1b[36m当前版本为 v${currentVersion}，请输入新版本号 (例: 0.2.0):\x1b[0m `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const currentVersion = readCurrentVersion();
  const args = process.argv.slice(2);
  let targetVersionRaw = args.find(arg => !arg.startsWith('--'));
  const shouldBuild = args.includes('--build');

  console.log('\n=========================================');
  console.log('  WorkBuddy-D 桌面端版本发布与更新管理脚本  ');
  console.log('=========================================\n');

  if (!targetVersionRaw) {
    targetVersionRaw = await promptVersion(currentVersion);
  }

  const version = normalizeVersion(targetVersionRaw);
  if (!version) {
    console.error(`\x1b[31m[错误] 无效的版本号格式: "${targetVersionRaw}"。请遵循语义化版本格式，如 0.2.0 或 1.0.0-beta.1\x1b[0m\n`);
    process.exit(1);
  }

  console.log(`\n准备同步更新版本: \x1b[32mv${currentVersion} -> v${version}\x1b[0m`);

  // 1. 同步三处版本
  updatePackageJson(version);
  console.log(' [√] 已更新 package.json version');

  updateTauriConf(version);
  console.log(' [√] 已更新 src-tauri/tauri.conf.json version');

  updateCargoToml(version);
  console.log(' [√] 已更新 src-tauri/Cargo.toml [package] version');

  // 2. 预备 release/latest.json
  const defaultNotes = `1. WorkBuddy 便携版原地静默自动更新\n2. 任务中心交互体验与性能优化`;
  const { manifestPath } = generateLatestJson(version, defaultNotes);
  console.log(` [√] 已生成最新发布元数据草稿: ${path.relative(rootDir, manifestPath)}`);

  // 3. 构建便携版产物 (如果指定了 --build)
  if (shouldBuild) {
    console.log('\n正在执行生产编译构建 (pnpm run "tauri build")...');
    execSync('pnpm run "tauri build"', { stdio: 'inherit', cwd: rootDir });
    const exePath = path.join(rootDir, 'src-tauri', 'target', 'release', 'workbuddy.exe');
    if (fs.existsSync(exePath)) {
      generateLatestJson(version, defaultNotes, exePath);
      console.log(` [√] 已根据构建二进制更新 SHA-256 哈希值`);
    }
  }

  console.log('\n\x1b[32m版本更新成功完成！后续发布步骤指引:\x1b[0m');
  console.log(` 1. git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml release/latest.json`);
  console.log(` 2. git commit -m "chore(release): bump version to v${version}"`);
  console.log(` 3. git tag -a v${version} -m "Release v${version}"`);
  console.log(` 4. git push origin main --tags`);
  console.log(` 5. 在 GitHub Releases 创建 Release 并上传生成的 WorkBuddy 二进制与 release/latest.json\n`);
}

main().catch(err => {
  console.error('\x1b[31m[异常退出]\x1b[0m', err);
  process.exit(1);
});
