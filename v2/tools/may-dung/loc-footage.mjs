// LỌC FOOTAGE BẰNG WHISPER + CLIP (ADR-009c-3): từ footage thô của thẻ, đề xuất đoạn cắt "chuẩn" cho từng cảnh kịch bản.
//   · Whisper (transformers.js, CPU) nghe lời trong footage → câu + mốc giây
//   · CLIP chấm khung hình mỗi 2 giây theo gợi ý hình (đầu học chon_canh nếu đã duyệt, không thì cos thuần)
//   · mỗi cảnh: cửa sổ 4 giây có điểm nhìn + điểm lời cao nhất → ffmpeg cắt → tải lên → lô content_os.loc_footage
//   Người giữ/bỏ ở thẻ › Sản xuất → mẫu loc_footage (huấn luyện sau).
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const tach = (s) => new Set(String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));
const khop = (a, b) => { const A = tach(a), B = tach(b); let g = 0; A.forEach((w) => { if (B.has(w)) g++; }); return A.size ? g / A.size : 0; };
const thoiLuong = (f) => { const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }); const d = Number(String(p.stdout || "").trim()); return Number.isFinite(d) ? d : 0; };
function amThanh16k(f) { const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", f, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { maxBuffer: 1024 * 1024 * 512, timeout: 300000 }); if (p.status !== 0) return null; const b = p.stdout; return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4)); }
function khungMoi2s(f, outDir) { mkdirSync(outDir, { recursive: true }); const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", f, "-vf", "fps=0.5,scale=320:-2", join(outDir, "k%04d.jpg")], { encoding: "utf8", timeout: 300000 }); if (p.status !== 0) throw new Error("ffmpeg khung: " + String(p.stderr || "").slice(-120)); let n = 1; const ds = []; while (existsSync(join(outDir, "k" + String(n).padStart(4, "0") + ".jpg"))) { ds.push({ t: (n - 1) * 2, f: join(outDir, "k" + String(n).padStart(4, "0") + ".jpg") }); n++; } return ds; }

export default async function loc({ app, goiApp, lenh, dir, log, script, may }) {
  const id = String((lenh.tham_so || {}).noi_dung_id || ""); const r = await goiApp("/hub/viec/loc_footage?noi_dung_id=" + encodeURIComponent(id)); const v = ((r.d && r.d.viec) || [])[0]; if (!v) return { ok: false, msg: "không lấy được việc lọc (HTTP " + r.status + ")" };
  const ft = (v.footage || []).filter((t) => t.media_url); if (!ft.length) return { ok: false, msg: "thẻ chưa có footage thô" };
  const TH = join(dir, "loc", id); rmSync(TH, { recursive: true, force: true }); mkdirSync(join(TH, "src"), { recursive: true }); mkdirSync(join(TH, "cat"), { recursive: true });
  const taiVe = async (u, ten) => { const f = join(TH, "src", ten); if (existsSync(f)) return f; const x = await fetch(u, { headers: /\/media\//.test(u) ? { "X-Hub-Key": app.khoa } : {} }); if (!x.ok) throw new Error("tải " + ten + " HTTP " + x.status); writeFileSync(f, Buffer.from(await x.arrayBuffer())); return f; };
  const nhin = await script("nhin"); const N = await nhin.taoNhin({ model_id: (v.mo_hinh_mo && v.mo_hinh_mo.model_id) || "Xenova/clip-vit-base-patch16", log });
  let dau = null; if (v.mo_hinh_mo && v.mo_hinh_mo.checkpoint_url) { try { const x = await fetch(v.mo_hinh_mo.checkpoint_url, { headers: /\/media\//.test(v.mo_hinh_mo.checkpoint_url) ? { "X-Hub-Key": app.khoa } : {} }); if (x.ok) dau = await x.json(); } catch {} }
  // Whisper (tuỳ chọn — không có thì chỉ dùng hình)
  let asr = null; try { const T = await import("@huggingface/transformers"); asr = await T.pipeline("automatic-speech-recognition", v.whisper || "onnx-community/whisper-base", { dtype: "q8" }); log("  whisper sẵn sàng"); } catch (e) { log("  không có whisper:", String(e.message || e).slice(0, 80)); }
  // ---- phân tích từng footage
  const kho = []; let i = 0;
  for (const t of ft) { i++; log("  footage", i, "/", ft.length, t.ten);
    try { const src = await taiVe(t.media_url, t.id + ".mp4"); const dai = thoiLuong(src); if (!dai) continue; const khung = khungMoi2s(src, join(TH, "khung", t.id)); const emb = []; for (const k of khung) { try { emb.push({ t: k.t, v: await N.embImage(k.f) }); } catch {} }
      let loi = []; if (asr) { try { const a = amThanh16k(src); if (a && a.length > 16000) { const out = await asr(a, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, language: "vi", task: "transcribe" }); loi = (out.chunks || []).map((c) => ({ tu: (c.timestamp || [0])[0] || 0, den: (c.timestamp || [0, 0])[1] || 0, text: String(c.text || "").trim() })).filter((c) => c.text); } } catch (e) { log("  whisper lỗi:", String(e.message || e).slice(0, 80)); } }
      kho.push({ t, src, dai, emb, loi }); } catch (e) { log("  bỏ", t.ten, String(e.message || e).slice(0, 80)); } }
  if (!kho.length) return { ok: false, msg: "không phân tích được footage nào" };
  // ---- mỗi cảnh: cửa sổ tốt nhất
  const canh = (v.sections || []).map((s, k) => ({ k, label: s.label || "Cảnh " + (k + 1), hinh: s.hinh || "", text: s.text || "" })).filter((c) => c.hinh || c.text).slice(0, 12);
  const daDung = new Set(); const deXuat = [];
  for (const c of canh) { const tv = await N.embText(c.hinh + " " + c.text); let best = null;
    for (const f of kho) for (const e of f.emb) { const key = f.t.id + ":" + Math.floor(e.t / 4); if (daDung.has(key)) continue; const ff = nhin.dacTrung(tv, e.v); const dHinh = dau ? nhin.diemDau(dau, ff) : (ff[0] + 1) / 2; const noi = f.loi.filter((l) => l.tu <= e.t + 3 && l.den >= e.t - 1).map((l) => l.text).join(" "); const dLoi = noi ? khop(c.hinh + " " + c.text, noi) : 0; const diem = dHinh + 0.5 * dLoi; if (!best || diem > best.diem) best = { f, t: e.t, diem, dHinh, noi }; }
    if (!best) continue; daDung.add(best.f.t.id + ":" + Math.floor(best.t / 4)); const tu = Math.max(0, best.t - 1), den = Math.min(best.f.dai, tu + 4); if (den - tu < 1.5) continue;
    const out = join(TH, "cat", String(c.k + 1).padStart(2, "0") + ".mp4"); const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", tu.toFixed(2), "-i", best.f.src, "-t", (den - tu).toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", out], { encoding: "utf8", timeout: 120000 }); if (p.status !== 0) { log("  cắt lỗi", c.label); continue; }
    const buf = readFileSync(out); const up = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=video/mp4", { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": "video/mp4", "Content-Length": String(buf.length) }, body: buf }); const uj = await up.json().catch(() => ({})); if (!up.ok) { log("  tải lên lỗi", uj.error); continue; }
    deXuat.push({ k: c.k, label: c.label, hinh: c.hinh, text: c.text, tai_san_goc: best.f.t.id, tu: +tu.toFixed(2), den: +den.toFixed(2), loi_noi: best.noi.slice(0, 200), diem: +best.diem.toFixed(3), media_url: uj.media_url }); log("  ✓", c.label, "←", best.f.t.ten, tu.toFixed(1) + "s", "điểm", best.diem.toFixed(2));
  }
  if (!deXuat.length) return { ok: false, msg: "không tìm được đoạn nào hợp kịch bản" };
  const n = await goiApp("/hub/nap", { method: "POST", body: JSON.stringify({ viec: "may_dung.loc_footage", bang: "content_os.loc_footage", luot: "lf" + Date.now(), phan: { i: 1, n: 1 }, dong: [{ noi_dung_id: id, de_xuat: deXuat, may, ghi_chu: (asr ? "có whisper" : "không whisper") + " · " + (dau ? "đầu học " + (v.mo_hinh_mo.phien_ban || "") : "cos thuần") }] }) });
  if (!n.ok) return { ok: false, msg: "app không nhận lô lọc (HTTP " + n.status + ")" };
  return { ok: true, msg: "đề xuất " + deXuat.length + "/" + canh.length + " đoạn từ " + kho.length + " footage" };
}
