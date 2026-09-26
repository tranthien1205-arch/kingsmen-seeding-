// DEPLOY CÓ CHỐT (24/09/2026 — chủ: "cần có cơ chế chống deploy trùng đè nhau"). Hai phiên Claude ở hai máy (Ngoc-Han, Q2) từng deploy
// cùng một Worker cách nhau 1 phút, bản sau đè bản trước. Lệnh DUY NHẤT để deploy: `npm run deploy` (hoặc `node deploy.mjs`).
//   1. Code phải ĐÃ COMMIT và ĐÃ PUSH: thư mục v2 không có file theo dõi nào đang sửa dở; HEAD == origin/main sau khi fetch.
//   2. KHOÁ DEPLOY trên D1 (module_config 'deploy_lock', hết hạn 10 phút): máy khác đang giữ khoá → từ chối, nói máy nào, tới khi nào.
//   3. SỔ DEPLOY (module_config 'deploy_so'): commit + mã deployment lần trước. Commit lần trước KHÔNG nằm trong lịch sử của HEAD → có máy khác
//      đã deploy code mình chưa có → từ chối. Deployment mới nhất trên Cloudflare khác mã trong sổ → có ai deploy ngoài lệnh này → từ chối.
//   4. Chạy test, build, `wrangler deploy --message "<commit> · <máy>"`, ghi sổ, nhả khoá (kể cả khi lỗi).
// Cờ: --khong-test (bỏ chạy test) · --bo-qua-so (chấp nhận bản trên Cloudflare lạ — chỉ khi đã kiểm tay) · --thu (dry-run, không deploy).
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir, hostname } from "node:os";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const V2 = dirname(fileURLToPath(import.meta.url)); const ROOT = join(V2, "..");
const CO = (t) => process.argv.includes("--" + t);
const MAY = hostname(); const THE = randomUUID().slice(0, 8); const DB = "kingsmen-content-os-db";
const bao = (m) => console.log("· " + m); const dung = (m) => { console.error("✗ " + m); process.exitCode = 1; };
const chay = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { cwd: opt.cwd || V2, encoding: "utf8", shell: false, maxBuffer: 64 * 1024 * 1024, stdio: opt.hien ? "inherit" : "pipe" }); return { ok: r.status === 0, out: String(r.stdout || ""), err: String(r.stderr || "") + (r.error ? String(r.error.message) : "") }; };
// wrangler chạy thẳng bằng Node (không qua shell → câu SQL truyền nguyên vẹn): node_modules của repo, rồi bản npx đã cache, mới nhất trước
const WJS = (() => { for (const p of [join(V2, "node_modules", "wrangler", "bin", "wrangler.js"), join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js")]) if (existsSync(p)) return p;
  const npxDir = join(process.env.LOCALAPPDATA || join(process.env.HOME || "", ".npm"), process.env.LOCALAPPDATA ? "npm-cache/_npx" : "_npx"); let tot = null, t0 = 0;
  try { for (const d of readdirSync(npxDir)) { const p = join(npxDir, d, "node_modules", "wrangler", "bin", "wrangler.js"); if (existsSync(p)) { const t = statSync(p).mtimeMs; if (t > t0) { t0 = t; tot = p; } } } } catch {}
  return tot; })();
if (!WJS) { console.error("✗ không tìm thấy wrangler — chạy `npx wrangler --version` một lần rồi chạy lại"); process.exit(1); }
const wr = (args, opt) => chay(process.execPath, [WJS, ...args], opt);
const git = (...a) => chay("git", a, { cwd: ROOT });
const TMP = mkdtempSync(join(tmpdir(), "kcos-deploy-"));
function sql(q) { const r = wr(["d1", "execute", DB, "--remote", "--json", "--command", q]); if (!r.ok) throw new Error("D1 lỗi: " + (r.err || r.out).slice(-300)); const i = r.out.indexOf("["); const j = JSON.parse(r.out.slice(i)); return (j[0] && j[0].results) || []; }
const esc = (s) => String(s).replace(/'/g, "''");
const bayGio = () => new Date().toISOString();

let giuKhoa = false;
try {
  // 1. đã commit + đã push
  if (!git("fetch", "-q", "origin").ok) throw new Error("git fetch lỗi — kiểm mạng / quyền GitHub");
  const sua = git("status", "--porcelain", "--untracked-files=no", "--", "v2").out.split("\n").filter((l) => l.trim() && !/v2\/dist\//.test(l));
  if (sua.length) throw new Error("còn file chưa commit trong v2 (commit + push trước khi deploy):\n  " + sua.slice(0, 10).join("\n  "));
  const head = git("rev-parse", "HEAD").out.trim(), goc = git("rev-parse", "origin/main").out.trim();
  if (head !== goc) { const sau = git("rev-list", "--count", "HEAD..origin/main").out.trim(), truoc = git("rev-list", "--count", "origin/main..HEAD").out.trim(); throw new Error("máy này lệch origin/main (thiếu " + sau + " commit, dư " + truoc + " commit chưa push) — `git pull --rebase` rồi `git push` trước"); }
  bao("code: " + head.slice(0, 7) + " = origin/main, sạch");
  // 2. khoá
  const hetHan = new Date(Date.now() + 10 * 60000).toISOString();
  sql(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES ('deploy_lock','${esc(JSON.stringify({ may: MAY, the: THE, het_han: hetHan, commit: head.slice(0, 7) }))}','${bayGio()}','${esc(MAY)}') ON CONFLICT(id) DO UPDATE SET cau_hinh=excluded.cau_hinh, updated_at=excluded.updated_at, updated_by_name=excluded.updated_by_name WHERE json_extract(module_config.cau_hinh,'$.het_han') < '${bayGio()}' OR json_extract(module_config.cau_hinh,'$.may') = '${esc(MAY)}';`);
  const k = JSON.parse((sql(`SELECT cau_hinh FROM module_config WHERE id='deploy_lock'`)[0] || {}).cau_hinh || "{}");
  if (k.the !== THE) throw new Error("máy " + k.may + " đang deploy (commit " + k.commit + "), khoá hết hạn " + k.het_han + " — chờ máy đó xong rồi pull và chạy lại");
  giuKhoa = true; bao("đã giữ khoá deploy tới " + hetHan.slice(11, 19) + " UTC");
  // 3. sổ deploy: không lùi, không đè bản lạ
  const so = JSON.parse((sql(`SELECT cau_hinh FROM module_config WHERE id='deploy_so'`)[0] || {}).cau_hinh || "{}");
  const dsCf = (() => { const r = wr(["deployments", "list", "--json"]); try { return JSON.parse(r.out.slice(r.out.indexOf("["))); } catch { return []; } })();
  const moiNhat = dsCf.slice().sort((a, b) => String(b.created_on).localeCompare(String(a.created_on)))[0];
  if (so.commit) {
    if (!git("cat-file", "-e", so.commit + "^{commit}").ok || !git("merge-base", "--is-ancestor", so.commit, "HEAD").ok) throw new Error("bản đang chạy do máy " + so.may + " deploy từ commit " + so.commit.slice(0, 7) + " — commit đó không có trong lịch sử máy này. Pull về rồi chạy lại");
    if (moiNhat && so.deploy_id && moiNhat.id !== so.deploy_id && !CO("bo-qua-so")) throw new Error("Cloudflare có deployment " + moiNhat.id + " (" + moiNhat.created_on + ") KHÔNG qua lệnh này (sổ ghi " + so.deploy_id + " của máy " + so.may + "). Có ai chạy `wrangler deploy` tay. Kiểm rồi chạy lại với --bo-qua-so");
    bao("sổ: lần trước " + so.commit.slice(0, 7) + " của " + so.may + " lúc " + so.luc + " — nằm trong lịch sử, không lùi");
  } else bao("sổ deploy trống — lần đầu dùng lệnh này");
  // 4. test · build · deploy
  if (!CO("khong-test")) { bao("chạy test…"); const t = chay("node", ["--test", "--no-warnings", "tests/*.test.mjs"]); const m = t.out.match(/ℹ fail (\d+)/); if (!t.ok || (m && m[1] !== "0")) throw new Error("test hỏng — không deploy:\n" + (t.out.split("\n").filter((l) => /^✖|ℹ (pass|fail)/.test(l)).slice(0, 12).join("\n"))); bao("test: " + ((t.out.match(/ℹ pass (\d+)/) || [])[1] || "?") + " qua"); }
  const b = chay("node", ["build.mjs"]); if (!b.ok) throw new Error("build lỗi:\n" + (b.err || b.out).slice(-600)); bao("build xong");
  if (CO("thu")) { const d = wr(["deploy", "--dry-run"]); bao("dry-run " + (d.ok ? "ổn" : "LỖI")); }
  else {
    const d = wr(["deploy", "--message", head.slice(0, 7) + " · " + MAY], { hien: true }); if (!d.ok) throw new Error("wrangler deploy lỗi");
    const sau = (() => { const r = wr(["deployments", "list", "--json"]); try { return JSON.parse(r.out.slice(r.out.indexOf("["))).sort((a, x) => String(x.created_on).localeCompare(String(a.created_on)))[0]; } catch { return null; } })();
    sql(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES ('deploy_so','${esc(JSON.stringify({ commit: head, may: MAY, luc: bayGio(), deploy_id: sau ? sau.id : null }))}','${bayGio()}','${esc(MAY)}') ON CONFLICT(id) DO UPDATE SET cau_hinh=excluded.cau_hinh, updated_at=excluded.updated_at, updated_by_name=excluded.updated_by_name;`);
    bao("ĐÃ DEPLOY " + head.slice(0, 7) + " từ " + MAY + (sau ? " · deployment " + sau.id : ""));
    // làm nóng (27/09): request đầu sau deploy chạy khởi tạo schema một lần (~20 s khi mã schema đổi) — gọi trước để người dùng không gặp
    try { const t0 = Date.now(); const r = await fetch("https://kingsmen-content-os.tranthien1205.workers.dev/api/ban", { signal: AbortSignal.timeout(90000) }); bao("làm nóng " + r.status + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s"); } catch (e) { bao("làm nóng lỗi (không sao, request đầu của người dùng sẽ chậm): " + e.message); }
  }
} catch (e) { dung(e.message); }
finally {
  if (giuKhoa) { try { sql(`DELETE FROM module_config WHERE id='deploy_lock' AND json_extract(cau_hinh,'$.the')='${THE}';`); bao("đã nhả khoá"); } catch (e) { console.error("không nhả được khoá (tự hết hạn sau 10 phút): " + e.message); } }
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
}
