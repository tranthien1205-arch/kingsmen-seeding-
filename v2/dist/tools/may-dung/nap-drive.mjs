// NẠP FOOTAGE TỪ THƯ MỤC GOOGLE DRIVE (24/09 — chủ: "làm thông qua sự tự động hoá của app… vướng thì nâng cấp app").
// App phát lệnh nap_drive {muc_id, folder_id, toi_da}; máy con:
//   1. đọc danh sách thư mục qua trang nhúng công khai (drive.google.com/embeddedfolderview) — thư mục phải "ai có link cũng xem"
//   2. chọn tối đa N video/ảnh, RẢI ĐỀU theo thứ tự tên (đại diện cả buổi quay), bỏ file đã nạp cho thẻ này
//   3. tải từng file (drive.usercontent), nén về 1080×1920 (clip dọc giữ nguyên, clip ngang đặt vào khung dọc), tối đa 20 giây
//   4. cắt một khung giữa clip → tải cả clip + khung lên /hub/upload → POST /hub/tai-san: app lưu FOOTAGE và nhờ Claude nhìn khung viết mô tả
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const LA_VIDEO = /\.(mp4|mov|m4v|avi|mkv)$/i, LA_ANH = /\.(jpe?g|png|webp)$/i;
const thoiLuong = (f) => { const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }); const d = Number(String(p.stdout || "").trim()); return Number.isFinite(d) ? d : 0; };
const giaiMa = (s) => String(s).replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function docThuMuc(folderId) {
  const r = await fetch("https://drive.google.com/embeddedfolderview?id=" + encodeURIComponent(folderId), { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("không đọc được thư mục Drive (HTTP " + r.status + ") — thư mục phải để “Bất kỳ ai có đường liên kết”");
  const s = await r.text(); const ra = []; const re = /<div class="flip-entry" id="entry-([A-Za-z0-9_-]+)"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g; let m;
  while ((m = re.exec(s))) { const khoi = s.slice(m.index, m.index + 600); ra.push({ id: m[1], ten: giaiMa(m[2]).trim(), la_thu_muc: /\/drive\/folders\//.test(khoi) }); }
  if (!ra.length && /ServiceLogin|accounts\.google\.com/.test(s)) throw new Error("thư mục Drive đang để riêng tư — mở chia sẻ “Bất kỳ ai có đường liên kết đều xem được”");
  return ra;
}
export function raiDeu(ds, n) { if (ds.length <= n) return ds.slice(); const out = []; for (let i = 0; i < n; i++) out.push(ds[Math.floor((i + 0.5) * ds.length / n)]); return out; }

export default async function nap({ app, goiApp, lenh, dir, log, script }) {
  const PT = script ? await script("phan-tich").catch(() => null) : null;   // ADR-010b: phân tích theo đoạn + 3 khung
  const ts = lenh.tham_so || {}; const mucId = String(ts.muc_id || ""), folderId = String(ts.folder_id || ""); const toiDa = Math.max(1, Math.min(300, Number(ts.toi_da) || 8));   // 26/09: kho footage theo dòng nạp cả thư mục (≤ 300)
  if (!mucId || !folderId) return { ok: false, msg: "lệnh thiếu muc_id / folder_id" };
  const daCo = new Set(((await goiApp("/hub/viec/nap_drive?muc_id=" + encodeURIComponent(mucId))).d || {}).da_co || []);
  // thư mục có thư mục con (vd link gốc "Keo chít mạch" chỉ chứa QUAY SẢN PHẨM, POV…): đi xuống tối đa 2 tầng, tối đa 30 thư mục
  const tatCa = []; const hang = [{ id: folderId, duong: "" }]; let soTM = 0;
  while (hang.length && soTM < 30) { const tm = hang.shift(); soTM++; let ds = []; try { ds = await docThuMuc(tm.id); } catch (e) { if (tm.id === folderId) throw e; log("  bỏ thư mục", tm.duong, String(e.message || e).slice(0, 60)); continue; }
    for (const f of ds) { if (f.la_thu_muc) { if (/kịch bản|kich ban|kho hàng|kho hang|script/i.test(f.ten)) { log("  bỏ thư mục", f.ten, "(không phải footage)"); continue; } if (tm.duong.split("/").filter(Boolean).length < 2) hang.push({ id: f.id, duong: tm.duong + "/" + f.ten }); } else if (LA_VIDEO.test(f.ten) || LA_ANH.test(f.ten)) tatCa.push({ ...f, thu_muc: tm.duong }); } }
  tatCa.sort((a, b) => (a.thu_muc + "/" + a.ten).localeCompare(b.thu_muc + "/" + b.ten)); if (soTM > 1) log("  đã đọc", soTM, "thư mục");
  const con = tatCa.filter((f) => !daCo.has(f.ten)); const chon = raiDeu(con, toiDa);
  log("  thư mục có", tatCa.length, "file hình/clip · đã nạp", tatCa.length - con.length, "· nạp", chon.length);
  if (!chon.length) return { ok: true, msg: "không còn file mới trong thư mục (đã nạp " + daCo.size + ")" };
  const TH = join(dir, "nap-drive", mucId); mkdirSync(TH, { recursive: true });
  const up1 = async (f, type) => { const buf = readFileSync(f); const r = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=" + encodeURIComponent(type), { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": type, "Content-Length": String(buf.length) }, body: buf }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error("tải lên " + r.status + " " + (j.error || "")); return j.media_url; };
  const up = async (f, type) => { let e0; for (let k = 0; k < 3; k++) { try { return await up1(f, type); } catch (e) { e0 = e; log("  tải lên lỗi, thử lại", k + 1, String(e.message || e).slice(0, 60)); await new Promise((x) => setTimeout(x, 4000 * (k + 1))); } } throw e0; };
  let xong = 0; const loi = [];
  for (const f of chon) {
    try {
      const goc = join(TH, "goc_" + f.id.slice(-10) + (f.ten.match(/\.[a-z0-9]+$/i) || [".bin"])[0]);
      if (!existsSync(goc) || statSync(goc).size < 1000) { const r = await fetch("https://drive.usercontent.google.com/download?id=" + encodeURIComponent(f.id) + "&export=download&confirm=t", { redirect: "follow" }); if (!r.ok) throw new Error("tải Drive HTTP " + r.status); const ct = r.headers.get("content-type") || ""; if (/text\/html/.test(ct)) throw new Error("Drive trả trang HTML (file riêng tư hoặc quá hạn mức tải)"); writeFileSync(goc, Buffer.from(await r.arrayBuffer())); }
      const la = LA_VIDEO.test(f.ten); const ra = join(TH, f.ten.replace(/\.[a-z0-9]+$/i, "") + (la ? ".mp4" : ".jpg")); const khung = join(TH, f.ten.replace(/\.[a-z0-9]+$/i, "") + "_khung.jpg");
      const vf = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1";
      if (la) {
        const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", goc, "-t", "20", "-map", "0:v:0", "-map", "0:a?", "-vf", vf, "-r", "30", "-c:v", "libx264", "-crf", "23", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", ra], { encoding: "utf8", timeout: 600000 });
        if (p.status !== 0) throw new Error("ffmpeg nén: " + String(p.stderr || "").slice(0, 120));
        const d = thoiLuong(ra); if (PT) { try { f.pt = PT.phanTich(ra, join(TH, "pt_" + f.id.slice(-10))); } catch (e) { log("  bỏ phân tích", String(e.message || e).slice(0, 60)); } }
        if (!f.pt) spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", (d / 2).toFixed(2), "-i", ra, "-frames:v", "1", "-vf", "scale=512:-2", khung], { encoding: "utf8", timeout: 300000, windowsHide: true });
      } else {
        const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", goc, "-vf", "scale=1080:-2", ra], { encoding: "utf8", timeout: 300000, windowsHide: true }); if (p.status !== 0) throw new Error("ffmpeg ảnh lỗi");
        spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", goc, "-vf", "scale=512:-2", khung], { encoding: "utf8", timeout: 300000, windowsHide: true });
      }
      const mediaUrl = await up(ra, la ? "video/mp4" : "image/jpeg"); const khungUrls = []; if (f.pt) { for (const k of f.pt.khung) khungUrls.push(await up(k, "image/jpeg")); } else if (existsSync(khung)) khungUrls.push(await up(khung, "image/jpeg"));
      let x; for (let k = 0; k < 3; k++) { x = await goiApp("/hub/tai-san", { method: "POST", body: JSON.stringify({ muc_id: mucId, ten: f.ten, thu_muc: f.thu_muc || "", media_url: mediaUrl, media_type: la ? "VIDEO" : "IMAGE", khung_urls: khungUrls, phan_tich: f.pt ? { dai: f.pt.dai, doan: f.pt.doan } : null, nguon: "DRIVE", drive_id: f.id, giay: la ? +thoiLuong(ra).toFixed(1) : null }) }); if (x.ok || (x.status && x.status < 500)) break; await new Promise((q) => setTimeout(q, 4000 * (k + 1))); }
      if (!x.ok) throw new Error("app không nhận tài sản: " + ((x.d && x.d.error) || x.status));
      xong++; log("  ✓", f.ten, "·", (x.d && x.d.mo_ta) ? String(x.d.mo_ta).slice(0, 80) : "(chưa có mô tả)");
      try { rmSync(goc, { force: true }); } catch {}
    } catch (e) { loi.push(f.ten + ": " + String(e.message || e).slice(0, 100)); log("  ✗", f.ten, String(e.message || e).slice(0, 100)); }
  }
  return { ok: xong > 0, msg: "nạp " + xong + "/" + chon.length + " file từ Drive" + (loi.length ? " · lỗi: " + loi.slice(0, 2).join(" · ") : "") };
}
