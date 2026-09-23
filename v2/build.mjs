// Build dist/ cho app mới.
//   node build.mjs                 → dist/index.html, dist/app.<hash>.js, dist/app.<hash>.css, dist/vendor/react*.js
//   node build.mjs --out <thư mục> (dùng cho kiểm tra)
//
// Nguồn giao diện tách file trong app/src/*.jsx, gộp theo thứ tự tên (00-core, 10-ui, …, 99-main)
// rồi biên dịch JSX một lần lúc build. Tailwind lấy theme từ app/tailwind.config.json (một nguồn sự thật).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(opt('--out', path.join(ROOT, 'dist')));
const SRC_DIR = path.join(ROOT, 'app', 'src');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);

// 1) gộp nguồn theo thứ tự tên file → một khối JSX
const files = fs.readdirSync(SRC_DIR).filter(f => /\.jsx?$/.test(f)).sort();
if (!files.length) throw new Error('app/src rỗng');
const appSrc = files.map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(SRC_DIR, f), 'utf8')).join('\n');
const Babel = require('@babel/standalone');
const js = Babel.transform(appSrc, { presets: [['react', { runtime: 'classic' }]], compact: true, comments: false }).code;
const jsName = `app.${hash(js)}.js`;

// 2) Tailwind
const theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'tailwind.config.json'), 'utf8'));
const tmpDir = fs.mkdtempSync(path.join(ROOT, '.build-'));
let css;
try {
  fs.writeFileSync(path.join(tmpDir, 'src.jsx'), appSrc);
  fs.writeFileSync(path.join(tmpDir, 'tw.config.cjs'), 'module.exports=' + JSON.stringify({ ...theme, content: [path.join(tmpDir, 'src.jsx'), path.join(ROOT, 'app', 'index.html')] }) + ';');
  fs.writeFileSync(path.join(tmpDir, 'in.css'), '@tailwind base;@tailwind components;@tailwind utilities;');
  // node_modules dùng chung với app cũ (thư mục cha) khi v2 chưa cài riêng
  let twBin; try { twBin = require.resolve('tailwindcss/lib/cli.js'); } catch (e) { twBin = require.resolve('tailwindcss/lib/cli.js', { paths: [path.join(ROOT, '..')] }); }
  execFileSync(process.execPath, [twBin, '-c', path.join(tmpDir, 'tw.config.cjs'), '-i', path.join(tmpDir, 'in.css'), '-o', path.join(tmpDir, 'out.css'), '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });
  css = fs.readFileSync(path.join(tmpDir, 'out.css'), 'utf8');
} finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
const cssName = `app.${hash(css)}.css`;

// 3) ghi dist
fs.mkdirSync(path.join(OUT, 'vendor'), { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^app\.[0-9a-f]+\.(js|css)$/.test(f)) fs.rmSync(path.join(OUT, f));
fs.writeFileSync(path.join(OUT, jsName), js);
fs.writeFileSync(path.join(OUT, cssName), css);
const nmOf = (p) => { for (const base of [ROOT, path.join(ROOT, '..')]) { const c = path.join(base, 'node_modules', p); if (fs.existsSync(c)) return c; } throw new Error('Không thấy node_modules/' + p + ' — chạy npm install'); };
fs.copyFileSync(nmOf('react/umd/react.production.min.js'), path.join(OUT, 'vendor', 'react.production.min.js'));
fs.copyFileSync(nmOf('react-dom/umd/react-dom.production.min.js'), path.join(OUT, 'vendor', 'react-dom.production.min.js'));

// 3b) công cụ Lọc/Dựng video (chép nguyên từ app cũ, đã đổi khoá token)
const TOOLS=path.join(ROOT,'tools'); if(fs.existsSync(TOOLS)){ fs.rmSync(path.join(OUT,'tools'),{recursive:true,force:true}); fs.cpSync(TOOLS, path.join(OUT,'tools'), {recursive:true}); }

// 4) index.html từ mẫu
const html = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8')
  .replace('{{CSS}}', '/' + cssName).replace('{{JS}}', '/' + jsName);
if (html.includes('{{')) throw new Error('index.html còn chỗ trống chưa thay');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`✓ ${path.relative(ROOT, OUT) || '.'}/index.html · ${jsName} (${(js.length / 1024).toFixed(0)} KB) · ${cssName} (${(css.length / 1024).toFixed(0)} KB) · ${files.length} file nguồn`);
