// Dev server cục bộ: chạy Worker thật với D1 giả lập (node:sqlite, file .dev.sqlite) + phục vụ dist/.
//   node build.mjs && node dev.mjs [--port 5180] [--fresh]
// Không cần wrangler/đăng nhập Cloudflare. Tài khoản đầu: admin@kingsmen.vn / admin123 (worker tự tạo).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { taoD1 } from './tests/d1.mjs';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(opt('--port', 5180));
const DBFILE = path.join(ROOT, '.dev.sqlite');
if (args.includes('--fresh')) fs.rmSync(DBFILE, { force: true });
const DIST = path.join(ROOT, 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const ASSETS = { fetch: async (req) => {
  let p = decodeURIComponent(new URL(req.url).pathname); if (p === '/' || !path.extname(p)) p = '/index.html';
  const f = path.join(DIST, p); if (!f.startsWith(DIST) || !fs.existsSync(f)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(f), { headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' } });
} };
const env = { DB: taoD1(DBFILE), ASSETS, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(ANTHROPIC_|YOUTUBE_|N8N_|TOKEN_)/.test(k))) };
const worker = (await import('./worker/index.js')).default;
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : null;
  const r = await worker.fetch(new Request('http://localhost:' + PORT + req.url, { method: req.method, headers: req.headers, body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined }), env, { waitUntil() {} });
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log('Kingsmen Content OS dev → http://localhost:' + PORT + '  (D1: ' + path.basename(DBFILE) + ')'));
// cron giả: gọi agent điều phối mỗi 15' như Cloudflare
setInterval(() => worker.scheduled({ cron: '*/15 * * * *' }, env, { waitUntil(p) { p.catch(e => console.error('cron:', e.message)); } }), 15 * 60 * 1000);
