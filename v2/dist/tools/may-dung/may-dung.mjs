// MÁY CON DỰNG VIDEO — Kingsmen Content OS (ADR-008). Trình chạy rút gọn: không Playwright, không tài khoản mạng xã hội.
//   Ghép:   node may-dung.mjs ghep MAY1.xxxxx      (mã ghép lấy ở app › Hồ sơ › Máy dựng — hiện một lần)
//   Chạy:   node may-dung.mjs                       (hoặc BAT-DAU.bat) — nhịp tim 2 phút, hỏi lệnh 30 giây/lần
//   Thử:    node may-dung.mjs --mot-lan              (lấy lệnh một lượt rồi thoát)
// Mã dựng KHÔNG nằm ở máy này: mỗi lệnh, máy hỏi app /hub/script/dung-video, kiểm hash, rồi mới chạy → sửa ở app là mọi máy dùng bản mới.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import os from "node:os";

export const DIR = dirname(fileURLToPath(import.meta.url));
const BAN = "1.1";
// việc app giao → script phát từ app (ADR-008/009): máy chỉ chạy script đúng hash app xác nhận
const VIEC_SCRIPT = { dung_video: "dung-video", mo_hinh_bong: "mo-hinh", huan_luyen: "huan-luyen" };
const coTransformers = existsSync(join(DIR, "node_modules", "@huggingface", "transformers"));
const gpu = (() => { const r = spawnSync("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader"], { encoding: "utf8" }); return !r.error && r.status === 0 ? String(r.stdout || "").trim().split("\n")[0].slice(0, 60) : ""; })();
async function coOllama() { try { const p = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(1500) }); return p.ok; } catch { return false; } }
const CFG = join(DIR, "may-dung.json");
const args = process.argv.slice(2);
export const log = (...m) => console.log(new Date().toLocaleTimeString("vi-VN"), ...m);

if (args[0] === "ghep") {
  const ma = String(args[1] || "").trim(); if (!ma.startsWith("MAY1.")) { console.error("Mã ghép phải bắt đầu bằng MAY1."); process.exit(2); }
  const o = JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  writeFileSync(CFG, JSON.stringify({ url: o.url, khoa: o.khoa, may_id: o.may_id, may_ten: o.may_ten, ghep_luc: new Date().toISOString() }, null, 2));
  console.log("Đã ghép máy '" + o.may_ten + "' với " + o.url + ". Chạy: node may-dung.mjs"); process.exit(0);
}
if (!existsSync(CFG)) { console.error("Chưa ghép: node may-dung.mjs ghep <mã ghép từ app › Hồ sơ › Máy dựng>"); process.exit(2); }
export const APP = JSON.parse(readFileSync(CFG, "utf8"));
const ffmpegOk = (() => { const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }); return !r.error && r.status === 0; })();
if (!ffmpegOk) console.error("⚠ Chưa có ffmpeg trong PATH — cài: winget install Gyan.FFmpeg rồi mở lại cửa sổ này. Máy vẫn ghép nhưng không dựng được.");

export async function goiApp(duong, opt = {}) {
  const r = await fetch(APP.url.replace(/\/+$/, "") + duong, { ...opt, headers: { "Content-Type": "application/json", "X-Hub-Key": APP.khoa, ...(opt.headers || {}) } });
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
async function chayLenh(l) {
  dangLam = l.viec + " " + (l.tham_so && l.tham_so.noi_dung_id || ""); log("▶ lệnh", l.id, l.viec, JSON.stringify(l.tham_so));
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
  await goiApp("/hub/lenh_xong", { method: "POST", body: JSON.stringify({ id: l.id, ok, msg }) }).catch(() => {});
  log(ok ? "  ✓ xong" : "  ✗ hỏng", msg);
}
async function motLuot() { const r = await goiApp("/hub/lenh"); if (!r.ok) { log("hỏi lệnh lỗi HTTP", r.status, r.d && r.d.error); return 0; } const ds = (r.d && r.d.lenh) || []; for (const l of ds) await chayLenh(l); return ds.length; }

const ping = await goiApp("/hub/ping"); if (!ping.ok) { console.error("Không nối được app (HTTP " + ping.status + "): " + ((ping.d && ping.d.error) || "")); process.exit(1); }
log("Máy dựng '" + APP.may_ten + "' (" + os.hostname() + ") đã nối " + APP.url + " · app v" + ping.d.ban + " · ffmpeg " + (ffmpegOk ? "có" : "KHÔNG") + " · AI nhìn " + (coTransformers ? "có" : "chưa (npm install)") + (gpu ? " · GPU " + gpu : ""));
await nhipTim();
if (args.includes("--mot-lan")) { const n = await motLuot(); log("xong", n, "lệnh"); process.exit(0); }
setInterval(nhipTim, 120000);
for (;;) { try { await motLuot(); } catch (e) { log("lỗi vòng lặp:", e.message); } await new Promise((x) => setTimeout(x, 30000)); }
