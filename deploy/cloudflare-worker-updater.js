/**
 * Cloudflare Worker: WorkBuddy-D Portable Updater Acceleration Proxy
 * 
 * 部署说明:
 * 1. 登录 Cloudflare 控制台 -> Workers & Pages -> Create Application -> Worker
 * 2. 将本文件代码完整粘贴进 Worker 编辑器中并 Save and Deploy
 * 3. 在 Settings -> Triggers -> Custom Domains 中添加二级域名:
 *    update.workbuddy.hujiale.works (或你拥有的其他域名)
 * 
 * 功能:
 * - 代理 GitHub Releases 的 latest.json 静态清单（附带 60s 边缘缓存与 CORS）
 * - 代理 /download/:tag/:filename 二进制文件下载，自动跟随并代理 GitHub 302 跨域重定向，
 *   使国内客户端无需翻墙即可满速下载 objects.githubusercontent.com 附件
 */

const GITHUB_REPO = 'hujiale/WorkBuddy';
const GITHUB_BASE = `https://github.com/${GITHUB_REPO}/releases`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. 健康检查
    if (pathname === '/health' || pathname === '/') {
      return new Response(JSON.stringify({ status: 'ok', service: 'workbuddy-updater-proxy' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 请求最新版本清单 /latest.json
    if (pathname === '/latest.json') {
      const targetUrl = `${GITHUB_BASE}/latest/download/latest.json`;
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'WorkBuddy-Updater-Proxy/1.0',
          'Accept': 'application/json',
        },
        cf: {
          cacheTtl: 60,
          cacheEverything: true,
        },
      });

      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Cache-Control', 'public, max-age=60');

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    // 3. 代理指定版本或最新下载: /download/:tag/:filename 或 /download/:filename
    if (pathname.startsWith('/download/')) {
      const segments = pathname.replace(/^\/download\//, '').split('/');
      let targetUrl = '';
      if (segments.length === 1) {
        // 例: /download/WorkBuddy-portable-x64.exe -> latest/download/...
        targetUrl = `${GITHUB_BASE}/latest/download/${segments[0]}`;
      } else {
        // 例: /download/v0.2.0/WorkBuddy-portable-x64.exe -> download/v0.2.0/...
        const [tag, ...fileParts] = segments;
        targetUrl = `${GITHUB_BASE}/download/${tag}/${fileParts.join('/')}`;
      }

      // GitHub Releases 下载会返回 302 重定向到 objects.githubusercontent.com
      // 使用 redirect: 'follow' 自动在 Cloudflare 边缘节点跟随并拉取二进制流
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'WorkBuddy-Updater-Proxy/1.0',
        },
        redirect: 'follow',
      });

      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
