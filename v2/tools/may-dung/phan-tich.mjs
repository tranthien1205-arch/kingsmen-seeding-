// PHÂN TÍCH FOOTAGE THEO ĐOẠN 0,5 GIÂY (ADR-010b) — nền cho mô hình chọn đoạn & ghép.
//   · phanTich(file): một lượt ffmpeg (fps=2) → mỗi khung: độ nhoè (blurdetect), chuyển động so khung trước (scdet), độ sáng (signalstats)
//     → doan[{t, net, dong, sang}] (0..1) + 3 khung hình ở 15% / 50% / 85% thời lượng (để Claude mô tả & xếp cỡ cảnh)
//   · lệnh phan_tich_footage {muc_id?}: phân tích lại footage đã có trong kho (nạp trước khi có 010b) → /hub/phan-tich
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const thoiLuong = (f) => { const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }); const d = Number(String(p.stdout || "").trim()); return Number.isFinite(d) && d > 0 ? d : 0; };
const gioiHan = (x) => Math.max(0, Math.min(1, x));

export function phanTich(file, khungDir) {
  const dai = thoiLuong(file); if (!dai) throw new Error("không đọc được thời lượng");
  mkdirSync(khungDir, { recursive: true }); const meta = join(khungDir, "meta.txt"); rmSync(meta, { force: true });
  const metaE = meta.replace(/\\/g, "/").replace(/:/g, "\\:");
  const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-an", "-vf", "fps=2,scale=240:-2,blurdetect=block_width=16:block_height=16,signalstats,scdet=threshold=100,metadata=print:file='" + metaE + "'", "-f", "null", "-"], { encoding: "utf8", timeout: 600000 });
  if (p.status !== 0 || !existsSync(meta)) throw new Error("ffmpeg phân tích: " + String(p.stderr || "").slice(-160));
  const doan = []; let cur = null;
  for (const dong of readFileSync(meta, "utf8").split(/\r?\n/)) {
    const m = dong.match(/pts_time:([\d.]+)/); if (m) { if (cur) doan.push(cur); cur = { t: +(+m[1]).toFixed(2), blur: null, y: null, sc: null }; continue; }
    if (!cur) continue; const kv = dong.split("="); const k = kv[0], v = Number(kv[1]);
    if (k === "lavfi.blur") cur.blur = v; else if (k === "lavfi.signalstats.YAVG") cur.y = v; else if (k === "lavfi.scd.score") cur.sc = v;
  }
  if (cur) doan.push(cur);
  const ra = doan.map((x, i) => ({ t: x.t, net: +gioiHan(1 - (x.blur ?? 5) / 10).toFixed(3), dong: +gioiHan(i === 0 ? 0 : (x.sc ?? 0) / 20).toFixed(3), sang: +gioiHan((x.y ?? 128) / 255).toFixed(3) }));
  const khung = [0.15, 0.5, 0.85].map((r, i) => { const o = join(khungDir, "k" + i + ".jpg"); spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", (dai * r).toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=512:-2", o], { encoding: "utf8" }); return existsSync(o) ? o : null; }).filter(Boolean);
  return { dai: +dai.toFixed(2), doan: ra, khung };
}

export default async function chay({ app, goiApp, lenh, dir, log }) {
  const mid = String((lenh.tham_so || {}).muc_id || ""); const r = await goiApp("/hub/viec/phan_tich?muc_id=" + encodeURIComponent(mid)); const ds = (r.d && r.d.viec) || [];
  if (!ds.length) return { ok: true, msg: "không có footage nào cần phân tích" };
  const TH = join(dir, "phan-tich"); mkdirSync(TH, { recursive: true });
  const up = async (f, type) => { const buf = readFileSync(f); const x = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=" + encodeURIComponent(type), { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": type, "Content-Length": String(buf.length) }, body: buf }); const j = await x.json().catch(() => ({})); if (!x.ok) throw new Error("tải lên " + x.status); return j.media_url; };
  let xong = 0; const loi = [];
  for (const t of ds) {
    try { const src = join(TH, t.id + ".mp4"); if (!existsSync(src)) { const x = await fetch(t.media_url, { headers: /\/media\//.test(t.media_url) ? { "X-Hub-Key": app.khoa } : {} }); if (!x.ok) throw new Error("tải " + x.status); writeFileSync(src, Buffer.from(await x.arrayBuffer())); }
      const pt = phanTich(src, join(TH, t.id)); const khungUrls = []; for (const k of pt.khung) khungUrls.push(await up(k, "image/jpeg"));
      const g = await goiApp("/hub/phan-tich", { method: "POST", body: JSON.stringify({ tai_san_id: t.id, phan_tich: { dai: pt.dai, doan: pt.doan }, khung_urls: khungUrls, mo_ta_lai: true }) }); if (!g.ok) throw new Error("app " + g.status);
      xong++; log("  ✓", t.ten, "·", pt.doan.length, "đoạn ·", (g.d && g.d.co_canh) || "?"); rmSync(src, { force: true });
    } catch (e) { loi.push(t.ten + ": " + String(e.message || e).slice(0, 80)); log("  ✗", t.ten, String(e.message || e).slice(0, 80)); }
  }
  return { ok: xong > 0, msg: "phân tích " + xong + "/" + ds.length + " footage" + (loi.length ? " · lỗi: " + loi.slice(0, 2).join(" · ") : "") };
}
