// MÁY CON DỰNG VIDEO — Kingsmen Content OS (ADR-008). Trình chạy rút gọn: không Playwright, không tài khoản mạng xã hội.
//   Ghép:   node may-dung.mjs ghep MAY1.xxxxx      (mã ghép lấy ở app › Hồ sơ › Máy dựng — hiện một lần)
//   Chạy:   node may-dung.mjs                       (hoặc BAT-DAU.bat) — nhịp tim 2 phút, hỏi lệnh 30 giây/lần
//   Thử:    node may-dung.mjs --mot-lan              (lấy lệnh một lượt rồi thoát)
// Mã dựng KHÔNG nằm ở máy này: mỗi lệnh, máy hỏi app /hub/script/dung-video, kiểm hash, rồi mới chạy → sửa ở app là mọi máy dùng bản mới.
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, statSync, renameSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import os from "node:os";

export const DIR = dirname(fileURLToPath(import.meta.url));
const BAN = "1.4";
// việc app giao → script phát từ app (ADR-008/009): máy chỉ chạy script đúng hash app xác nhận
const VIEC_SCRIPT = { dung_video: "dung-video", mo_hinh_bong: "mo-hinh", mo_hinh_chay: "mo-hinh", huan_luyen: "huan-luyen", loc_footage: "loc-footage", nap_drive: "nap-drive", phan_tich_footage: "phan-tich", hoc_thanh_pham: "hoc-thanh-pham" };   // nap_drive: nạp footage từ thư mục Drive (24/09) · phan_tich_footage / hoc_thanh_pham: ADR-010
const coTransformers = existsSync(join(DIR, "node_modules", "@huggingface", "transformers"));
const gpu = (() => { const r = spawnSync("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader"], { encoding: "utf8" }); return !r.error && r.status === 0 ? String(r.stdout || "").trim().split("\n")[0].slice(0, 60) : ""; })();
async function coOllama() { try { const p = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(1500) }); return p.ok; } catch { return false; } }
const CFG = join(DIR, "may-dung.json");
const args = process.argv.slice(2);
// Nhật ký ra file may-dung.log cạnh máy con (ngoài cửa sổ): đọc lại được sau khi cửa sổ đóng / máy khởi động lại.
// Quá 5 MB thì đổi tên sang may-dung.log.1 (giữ một bản cũ). Ghi hỏng thì bỏ qua — không làm máy dừng.
const LOG_FILE = join(DIR, "may-dung.log");
const chuoiLog = (m) => m.map((x) => (typeof x === "string" ? x : x instanceof Error ? (x.stack || x.message) : JSON.stringify(x))).join(" ");
function ghiLog(muc, m) { try { if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > 5e6) renameSync(LOG_FILE, LOG_FILE + ".1"); appendFileSync(LOG_FILE, new Date().toLocaleString("vi-VN") + (muc ? " " + muc : "") + " " + chuoiLog(m) + "\n"); } catch {} }
export const log = (...m) => { console.log(new Date().toLocaleTimeString("vi-VN"), ...m); ghiLog("", m); };
const loi = (...m) => { console.error(...m); ghiLog("[LỖI]", m); };
process.on("uncaughtException", (e) => { loi("máy con dừng vì lỗi:", e); process.exit(1); });
process.on("unhandledRejection", (e) => { loi("máy con dừng vì lỗi:", e); process.exit(1); });

if (args[0] === "ghep") {
  const ma = String(args[1] || "").trim(); if (!ma.startsWith("MAY1.")) { loi("Mã ghép phải bắt đầu bằng MAY1."); process.exit(2); }
  const o = JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  writeFileSync(CFG, JSON.stringify({ url: o.url, khoa: o.khoa, may_id: o.may_id, may_ten: o.may_ten, ghep_luc: new Date().toISOString() }, null, 2));
  log("Đã ghép máy '" + o.may_ten + "' với " + o.url + ". Chạy: node may-dung.mjs"); process.exit(0);
}
if (!existsSync(CFG)) { loi("Chưa ghép: node may-dung.mjs ghep <mã ghép từ app › Hồ sơ › Máy dựng>"); process.exit(2); }
export const APP = JSON.parse(readFileSync(CFG, "utf8"));
const ffmpegOk = (() => { const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }); return !r.error && r.status === 0; })();
if (!ffmpegOk) loi("⚠ Chưa có ffmpeg trong PATH — cài: winget install Gyan.FFmpeg rồi mở lại cửa sổ này. Máy vẫn ghép nhưng không dựng được.");

export async function goiApp(duong, opt = {}) {
  let r; try { r = await fetch(APP.url.replace(/\/+$/, "") + duong, { ...opt, headers: { "Content-Type": "application/json", "X-Hub-Key": APP.khoa, ...(opt.headers || {}) } }); } catch (e) { return { ok: false, status: 0, d: { error: "không nối được app: " + String(e.message || e).slice(0, 80) }, headers: new Headers() }; }
  const ct = r.headers.get("content-type") || ""; let d = null;
  if (ct.includes("json")) { try { d = await r.json(); } catch {} } else d = Buffer.from(await r.arrayBuffer());
  return { ok: r.ok, status: r.status, d, headers: r.headers };
}
let dangLam = "";
// khả năng máy khai với app: dung_video (ffmpeg) · mo_hinh (CLIP qua transformers hoặc Ollama) · huan_luyen (transformers — đầu tuyến tính chạy CPU được, GPU chỉ để nhanh)
async function khaNang() { const ol = await coOllama(); return { kha_nang: [...(ffmpegOk ? ["dung_video"] : []), ...((coTransformers || ol) ? ["mo_hinh"] : []), ...(coTransformers ? ["huan_luyen"] : [])], ollama: ol }; }
async function nhipTim() { try { const kn = await khaNang(); await goiApp("/hub/trang_thai", { method: "POST", body: JSON.stringify({ may: os.hostname(), ban: BAN, gio_may: new Date().toLocaleString("vi-VN"), ffmpeg: ffmpegOk, gpu, ollama: kn.ollama, kha_nang: kn.kha_nang, dang_lam: dangLam }) }); } catch (e) { log("nhịp tim lỗi:", e.message); } }
const scriptCache = {};
async function napScript(ten) { if (scriptCache[ten]) return scriptCache[ten]; const sc = await layScript(ten); const mod = await import(pathToFileURL(sc.f).href); scriptCache[ten] = mod; return mod; }
async function layScript(ten) {
  const r = await goiApp("/hub/script/" + ten); if (!r.ok || !r.d || !r.d.script) throw new Error("không tải được script " + ten + " (HTTP " + r.status + (r.d && r.d.error ? " " + r.d.error : "") + ")");
  const hash = createHash("sha256").update(r.d.script).digest("hex"); if (hash !== r.d.hash) throw new Error("script " + ten + " sai hash — không chạy");
  const th = join(DIR, "cache"); mkdirSync(th, { recursive: true }); const f = join(th, ten + "." + hash.slice(0, 12) + ".mjs");
  if (!existsSync(f)) writeFileSync(f, r.d.script); return { f, ban: hash.slice(0, 12) };
}
// Lệnh đang làm ghi ra dang-lam.json: máy tắt/khởi động lại giữa chừng (Windows Update, khởi động lại hằng ngày) thì lần
// chạy sau làm tiếp đúng lệnh đó. Script việc tự bỏ phần đã xong (video đã học, file đã tải) nên chạy lại = làm tiếp.
const DANG_LAM_F = join(DIR, "dang-lam.json");
const LAN_TOI_DA = 3;   // chính lệnh làm sập máy con thì thôi sau 3 lần, báo hỏng
async function chayLenh(l, lan = 1) {
  dangLam = l.viec + " " + (l.tham_so && l.tham_so.noi_dung_id || ""); const ts = JSON.stringify(l.tham_so || {});
  log("▶ lệnh", l.id, l.viec, ts.length > 300 ? ts.slice(0, 300) + "… (" + ts.length + " ký tự)" : ts, lan > 1 ? "· làm tiếp lần " + lan : "");
  try { writeFileSync(DANG_LAM_F, JSON.stringify({ id: l.id, viec: l.viec, tham_so: l.tham_so || {}, lan, bat_dau: new Date().toISOString() })); } catch {}
  let ok = false, msg = "";
  try {
    const ten = VIEC_SCRIPT[l.viec]; if (!ten) throw new Error("máy con không nhận lệnh " + l.viec);
    if (l.viec === "dung_video" && !ffmpegOk) throw new Error("máy chưa có ffmpeg");
    for (const k of Object.keys(scriptCache)) delete scriptCache[k];   // mỗi lệnh tải lại bản mới nhất từ app
    const sc = await layScript(ten); log("  script", ten, "bản", sc.ban);
    const mod = await import(pathToFileURL(sc.f).href + "?t=" + Date.now());
    const kq = await mod.default({ app: APP, goiApp, lenh: l, dir: join(DIR, "out"), log, ban: BAN, may: os.hostname(), script: napScript });
    ok = !!(kq && kq.ok); msg = (kq && kq.msg) || "";
  } catch (e) { ok = false; msg = String(e.message || e).slice(0, 380); log("  ✗", msg); }
  dangLam = "";
  await goiApp("/hub/lenh_xong", { method: "POST", body: JSON.stringify({ id: l.id, ok, msg: (lan > 1 ? "(làm tiếp sau khởi động lại) " : "") + msg }) }).catch(() => {});
  try { rmSync(DANG_LAM_F, { force: true }); } catch {}
  log(ok ? "  ✓ xong" : "  ✗ hỏng", msg);
}
async function lamTiepLenhDo() {
  if (!existsSync(DANG_LAM_F)) return;
  let d = null; try { d = JSON.parse(readFileSync(DANG_LAM_F, "utf8")); } catch {}
  if (!d || !d.id || !d.viec) { try { rmSync(DANG_LAM_F, { force: true }); } catch {} return; }
  if ((d.lan || 1) >= LAN_TOI_DA) {
    loi("Lệnh", d.id, d.viec, "đã dở dang", d.lan, "lần — thôi làm tiếp, báo hỏng");
    await goiApp("/hub/lenh_xong", { method: "POST", body: JSON.stringify({ id: d.id, ok: false, msg: "máy con dừng giữa chừng " + d.lan + " lần khi làm lệnh này" }) }).catch(() => {});
    try { rmSync(DANG_LAM_F, { force: true }); } catch {} return;
  }
  // vừa khởi động lại: Ollama (mô hình nhìn/ngôn ngữ) có thể chưa lên — chờ tối đa 3 phút cho lệnh cần nó
  for (let i = 0; i < 36 && !(await coOllama()); i++) { if (i === 0) log("  chờ Ollama lên trước khi làm tiếp…"); await new Promise((x) => setTimeout(x, 5000)); }
  log("Làm tiếp lệnh dở dang từ " + (d.bat_dau || "?") + " (máy tắt/khởi động lại giữa chừng)");
  await chayLenh({ id: d.id, viec: d.viec, tham_so: d.tham_so }, (d.lan || 1) + 1);
}
async function motLuot() { const r = await goiApp("/hub/lenh"); if (!r.ok) { log("hỏi lệnh lỗi HTTP", r.status, r.d && r.d.error); return 0; } const ds = (r.d && r.d.lenh) || []; for (const l of ds) await chayLenh(l); return ds.length; }

// CLI 009c-4: xuất tập mẫu ngôn ngữ / đánh giá phiên bản Ollama (không cần app giao lệnh)
if (args[0] === "xuat-tap-mau" || args[0] === "phien-ban") {
  const sc = await layScript("danh-gia-ngon-ngu"); const mod = await import(pathToFileURL(sc.f).href);
  const kq = await mod.default({ app: APP, goiApp, lenh: { viec: "danh_gia", tham_so: args[0] === "xuat-tap-mau" ? { xuat: true, tinh_nang: args[1] || "soan_nhap_agent" } : { model_id: args[1], tinh_nang: args[2] || "soan_nhap_agent" } }, dir: join(DIR, "out"), log, may: os.hostname() });
  log(kq.ok ? "✓" : "✗", kq.msg); process.exit(kq.ok ? 0 : 1);
}
// app chưa lên (dev server khởi động lại, mất mạng) → chờ 30 giây rồi thử lại, không thoát
let ping = await goiApp("/hub/ping"); while (!ping.ok) { log("Chưa nối được app (" + (ping.status || "mạng") + "): " + ((ping.d && ping.d.error) || "") + " — thử lại sau 30 giây"); await new Promise((x) => setTimeout(x, 30000)); ping = await goiApp("/hub/ping"); }
log("Máy dựng '" + APP.may_ten + "' (" + os.hostname() + ") đã nối " + APP.url + " · app v" + ping.d.ban + " · ffmpeg " + (ffmpegOk ? "có" : "KHÔNG") + " · AI nhìn " + (coTransformers ? "có" : "chưa (npm install)") + (gpu ? " · GPU " + gpu : ""));
await nhipTim();
await lamTiepLenhDo();
if (args.includes("--mot-lan")) { const n = await motLuot(); log("xong", n, "lệnh"); process.exit(0); }
setInterval(nhipTim, 120000);
for (;;) { try { await motLuot(); } catch (e) { log("lỗi vòng lặp:", e.message); } await new Promise((x) => setTimeout(x, 30000)); }
