// Build dist/ từ seeding-app.html + tools/
//   node build.mjs            → dist/index.html, dist/app.<hash>.js, dist/app.<hash>.css, dist/vendor/react*.js, dist/tools/
//   node build.mjs --src X --out Y   (dùng cho test)
//
// Vì sao: bản cũ nhúng thẳng nguồn JSX vào HTML rồi biên dịch bằng @babel/standalone (3 MB) ngay trên
// máy người dùng mỗi lần mở, và chạy Tailwind Play CDN (JIT lúc runtime). Điện thoại tầm trung mất 5–12 s
// mới thấy trang. Build sẵn thì chỉ còn ~1 tệp JS + ~1 tệp CSS nhỏ, cache vĩnh viễn theo hash.
//
// seeding-app.html vẫn mở trực tiếp được (giữ CDN) để dev nhanh — build chỉ đọc nó làm nguồn.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
// fileURLToPath thay vì URL.pathname: trên Windows pathname ra "/D:/OS%20MKT/..." (thừa "/" + dấu cách bị mã hoá) → build hỏng
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(opt('--src', path.join(ROOT, 'seeding-app.html')));
const OUT = path.resolve(opt('--out', path.join(ROOT, 'dist')));
const TOOLS = path.join(ROOT, 'tools');

const html = fs.readFileSync(SRC, 'utf8');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
const must = (re, what) => { const m = html.match(re); if (!m) throw new Error('Không tìm thấy ' + what + ' trong ' + SRC); return m; };

// 1) JSX → JS (đúng preset app đang dùng lúc runtime: react, classic)
const [, appSrc] = must(/<script type="text\/plain" id="app-src">([\s\S]*?)<\/script>/, '#app-src');
const Babel = require('@babel/standalone');
const js = Babel.transform(appSrc, { presets: [['react', { runtime: 'classic' }]], compact: true, comments: false }).code;
const jsName = `app.${hash(js)}.js`;

// 2) Tailwind: lấy cấu hình theme từ chính khối <script>tailwind.config = {...}</script> (một nguồn sự thật)
const [, cfgText] = must(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*<\/script>/, 'tailwind.config');
const theme = new Function('return (' + cfgText + ')')();
const tmpDir = fs.mkdtempSync(path.join(ROOT, '.build-'));
try {
  fs.writeFileSync(path.join(tmpDir, 'tw.config.cjs'), 'module.exports=' + JSON.stringify({ ...theme, content: [SRC] }) + ';');
  fs.writeFileSync(path.join(tmpDir, 'in.css'), '@tailwind base;@tailwind components;@tailwind utilities;');
  const twBin = require.resolve('tailwindcss/lib/cli.js');
  execFileSync(process.execPath, [twBin, '-c', path.join(tmpDir, 'tw.config.cjs'), '-i', path.join(tmpDir, 'in.css'), '-o', path.join(tmpDir, 'out.css'), '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });
  var css = fs.readFileSync(path.join(tmpDir, 'out.css'), 'utf8');
} finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
const cssName = `app.${hash(css)}.css`;

// 3) Ghi dist: dọn bản build cũ, chép vendor React + tools
fs.mkdirSync(path.join(OUT, 'vendor'), { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^app\.[0-9a-f]+\.(js|css)$/.test(f)) fs.rmSync(path.join(OUT, f));
fs.writeFileSync(path.join(OUT, jsName), js);
fs.writeFileSync(path.join(OUT, cssName), css);
// react/react-dom không export đường dẫn umd/ qua "exports" → đi thẳng vào node_modules
const NM = path.join(ROOT, 'node_modules');
fs.copyFileSync(path.join(NM, 'react/umd/react.production.min.js'), path.join(OUT, 'vendor', 'react.production.min.js'));
fs.copyFileSync(path.join(NM, 'react-dom/umd/react-dom.production.min.js'), path.join(OUT, 'vendor', 'react-dom.production.min.js'));
// vendor/ tự host (xlsx…): trước đây chép tay vào dist → xoá dist rồi build lại là mất import Excel mà không báo
const VENDOR = path.join(ROOT, 'vendor');
if (fs.existsSync(VENDOR)) for (const f of fs.readdirSync(VENDOR)) fs.copyFileSync(path.join(VENDOR, f), path.join(OUT, 'vendor', f));
if (!fs.existsSync(path.join(OUT, 'vendor', 'xlsx.full.min.js'))) throw new Error('Thiếu vendor/xlsx.full.min.js — import Excel sẽ hỏng');
if (fs.existsSync(TOOLS)) { fs.rmSync(path.join(OUT, 'tools'), { recursive: true, force: true }); fs.cpSync(TOOLS, path.join(OUT, 'tools'), { recursive: true }); }

// 4) index.html: thay các <script> CDN + khối nguồn + khối tự biên dịch bằng tệp đã build
let out = html
  .replace(/<script src="https:\/\/unpkg\.com\/react@18\/umd\/react\.production\.min\.js"[^>]*><\/script>/, '<script src="/vendor/react.production.min.js"></script>')
  .replace(/<script src="https:\/\/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js"[^>]*><\/script>/, '<script src="/vendor/react-dom.production.min.js"></script>')
  .replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\s*/, '')
  .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*/, `<link rel="stylesheet" href="/${cssName}">\n`)
  .replace(/<script>\s*\/\/[^\n]*\n\s*tailwind\.config\s*=[\s\S]*?<\/script>\s*/, '')
  .replace(/<script type="text\/plain" id="app-src">[\s\S]*?<\/script>/, '')
  .replace(/<script>\s*\/\/ Tự biên dịch JSX[\s\S]*?<\/script>/, `<script src="/${jsName}"></script>`);
for (const bad of ['unpkg.com', 'cdn.tailwindcss.com', 'id="app-src"', 'Babel.transform']) {
  if (out.includes(bad)) throw new Error('index.html vẫn còn "' + bad + '" — build.mjs cần cập nhật theo seeding-app.html');
}
fs.writeFileSync(path.join(OUT, 'index.html'), out);
console.log(`✓ ${path.relative(ROOT, OUT)}/index.html · ${jsName} (${(js.length / 1024).toFixed(0)} KB) · ${cssName} (${(css.length / 1024).toFixed(0)} KB)`);
