// HỌC TỪ VIDEO THÀNH PHẨM (ADR-010d, 24/09 — chủ: "có nhiều video đã sản xuất thủ công làm kho huấn luyện", "cả tiktok nữa",
// "có lượt xem cũng là một cách học hiệu quả"). Lệnh hoc_thanh_pham {nguon: DRIVE|LOCAL|TIKTOK, folder_id?, duong_dan?, kenh?, toi_da}
//   1. liệt kê video thành phẩm: thư mục Drive công khai (script nap-drive đọc) / thư mục trên máy dựng / thư mục Trạm đã tải TikTok
//      (kèm _meta.json: link, lượt xem, ngày đăng). Thư mục con tên "goc|source|nguon|footage|quay" = clip gốc để dò shot lấy từ đâu.
//   2. mỗi video: dò điểm cắt cảnh (ffmpeg scdet) → shot {t0,t1}; khung giữa shot (tải lên để app xếp cỡ cảnh); Whisper nghe lời
//      từng shot (nếu máy có @huggingface/transformers); dò clip gốc bằng chữ ký ảnh 16×16 (khớp → goc {ten,tu,den,doan} cho mô hình chọn đoạn)
//   3. POST /hub/thanh-pham → app ghi mẫu ghep_canh (độ dài shot, chuyển cỡ cảnh), chon_canh (lời ↔ khung), chon_doan (đoạn trong clip gốc);
//      lượt xem đi theo mẫu → huấn luyện đặt trọng số. KHÔNG BỊA: không có lượt xem thì để trống, không ghi 0.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";

const LA_VIDEO = /\.(mp4|mov|m4v|avi|mkv|webm)$/i, LA_GOC = /^(goc|gốc|source|nguon|nguồn|footage|quay|raw)/i;
const thoiLuong = (f) => { const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }); const d = Number(String(p.stdout || "").trim()); return Number.isFinite(d) && d > 0 ? d : 0; };

/** Điểm cắt cảnh: scdet ngưỡng 8 (thang 0–100), shot tối thiểu 0,4 giây, tối đa 120 shot. */
export function catShot(file, dai) {
  const p = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-an", "-vf", "scale=320:-2,scdet=threshold=8", "-f", "null", "-"], { encoding: "utf8", timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  const moc = []; const re = /lavfi\.scd\.time:\s*([\d.]+)/g; let m; const s = String(p.stderr || ""); while ((m = re.exec(s))) moc.push(+m[1]);
  const cat = [0]; for (const t of moc.sort((a, b) => a - b)) if (t - cat[cat.length - 1] >= 0.4 && t < dai - 0.2) cat.push(t);
  cat.push(dai); const shots = []; for (let i = 0; i < cat.length - 1 && shots.length < 120; i++) shots.push({ t0: +cat[i].toFixed(2), t1: +cat[i + 1].toFixed(2) });
  return shots;
}
/** Chữ ký ảnh: mỗi khung (fps cho trước) → 256 số xám 16×16. Dùng để dò shot thành phẩm nằm ở đâu trong clip gốc. */
export function chuKy(file, fps, tu, dai) {
  const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...(tu != null ? ["-ss", String(tu)] : []), "-i", file, ...(dai != null ? ["-t", String(dai)] : []), "-an", "-vf", "fps=" + fps + ",scale=16:16,format=gray", "-f", "rawvideo", "pipe:1"], { maxBuffer: 256 * 1024 * 1024, timeout: 600000 });
  if (p.status !== 0 || !p.stdout) return []; const b = p.stdout; const ra = []; for (let i = 0; i + 256 <= b.length; i += 256) ra.push(b.subarray(i, i + 256)); return ra;
}
const khoangCach = (a, b) => { let s = 0; for (let i = 0; i < 256; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s / 256); };

function docMeta(th) { try { const f = join(th, "_meta.json"); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {}; } catch { return {}; } }
function amThanh16k(f, tu, dai) { const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(tu), "-i", f, "-t", String(dai), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { maxBuffer: 64 * 1024 * 1024, timeout: 300000 }); if (p.status !== 0) return null; const b = p.stdout; return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4)); }

export default async function hoc({ app, goiApp, lenh, dir, log, script }) {
  const ts = lenh.tham_so || {}; const nguon = String(ts.nguon || "DRIVE").toUpperCase(); const toiDa = Math.max(1, Math.min(60, Number(ts.toi_da) || 20));
  const TH = join(dir, "thanh-pham", "lam"); mkdirSync(TH, { recursive: true });
  const daCo = new Set(((await goiApp("/hub/viec/thanh_pham")).d || {}).da_co || []);
  const PT = script ? await script("phan-tich").catch(() => null) : null;
  // ---- 1. danh sách video thành phẩm + clip gốc
  let video = [], goc = [], thuMuc = "", meta = {};
  if (nguon === "DRIVE") {
    const ND = await script("nap-drive"); const fid = String(ts.folder_id || ""); if (!fid) return { ok: false, msg: "lệnh thiếu folder_id" }; thuMuc = "drive:" + fid;
    // đi sâu tối đa 3 tầng thư mục (đo 24/09: kho của chủ là gốc → BÁN HÀNG → DOUYIN_20V/FINEX/TERRAZY → video); thư mục tên goc/source ở tầng nào cũng là clip gốc
    const duyet = async (id, duong, tang) => { const ds = await ND.docThuMuc(id).catch(() => []); for (const x of ds) { if (x.la_thu_muc) { if (tang < 3) await duyet(x.id, duong ? duong + "/" + x.ten : x.ten, tang + 1); } else if (LA_VIDEO.test(x.ten)) { if (LA_GOC.test((duong || "").split("/").pop() || "")) goc.push({ ...x, drive: true }); else video.push({ ...x, drive: true, nhom: duong || "" }); } } };
    await duyet(fid, "", 0); log("  Drive:", video.length, "video ·", goc.length, "clip gốc");
  } else if (Array.isArray(ts.video) && ts.video.length) {
    // 24/09 (gom về một máy): Trạm tải xong đẩy video lên kho app → máy học lấy về từ app, không cần chung ổ với Trạm
    thuMuc = "app:" + (ts.kenh || nguon); for (const x of ts.video) { video.push({ id: x.ten, ten: x.ten, url: x.url }); meta[x.ten] = x.meta || {}; }
  } else {
    thuMuc = String(ts.duong_dan || ""); if (!thuMuc || !existsSync(thuMuc)) return { ok: false, msg: "máy dựng không thấy thư mục " + (thuMuc || "(trống)") + (nguon === "TIKTOK" || nguon === "KALODATA" ? " — Trạm tải TikTok về máy khác? Đặt Trạm và máy dựng cùng máy, hoặc chép thư mục sang" : "") };
    meta = docMeta(thuMuc); const ls = (th) => readdirSync(th).map((n) => ({ n, f: join(th, n), st: statSync(join(th, n)) }));
    for (const e of ls(thuMuc)) { if (e.st.isDirectory()) { const trong = ls(e.f).filter((x) => x.st.isFile() && LA_VIDEO.test(x.n)).map((x) => ({ id: x.f, ten: x.n, f: x.f })); if (LA_GOC.test(e.n)) goc.push(...trong); else video.push(...trong.map((x) => ({ ...x, nhom: e.n }))); } else if (LA_VIDEO.test(e.n)) video.push({ id: e.f, ten: e.n, f: e.f }); }
  }
  video = video.filter((v) => !daCo.has(v.drive ? v.id : v.ten)).slice(0, toiDa); goc = goc.slice(0, 40);
  if (!video.length) return { ok: true, msg: "không có video thành phẩm mới trong " + thuMuc + " (đã học " + daCo.size + ")" };
  log("  thành phẩm:", video.length, "· clip gốc:", goc.length, "· nguồn", nguon);
  const taiDrive = async (x, f) => { if (existsSync(f) && statSync(f).size > 1000) return f; const r = await fetch("https://drive.usercontent.google.com/download?id=" + encodeURIComponent(x.id) + "&export=download&confirm=t", { redirect: "follow" }); if (!r.ok) throw new Error("tải Drive HTTP " + r.status); if (/text\/html/.test(r.headers.get("content-type") || "")) throw new Error("Drive trả trang HTML (file riêng tư / hết hạn mức)"); writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f; };
  const up = async (f, type) => { let e0; for (let k = 0; k < 3; k++) { try { const buf = readFileSync(f); const x = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=" + encodeURIComponent(type), { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": type, "Content-Length": String(buf.length) }, body: buf }); const j = await x.json().catch(() => ({})); if (!x.ok) throw new Error("tải lên " + x.status); return j.media_url; } catch (e) { e0 = e; await new Promise((r) => setTimeout(r, 3000 * (k + 1))); } } throw e0; };
  // ---- chữ ký clip gốc (2 khung/giây) + phân tích đoạn — tính một lần
  const gocKy = []; for (const g of goc) { try { const f = g.drive ? await taiDrive(g, join(TH, "goc_" + basename(g.ten).replace(/[^a-z0-9_.-]/gi, "_"))) : g.f; const dai = thoiLuong(f); if (!dai) continue; const ky = chuKy(f, 2); let pt = null; if (PT) { try { pt = PT.phanTich(f, join(TH, "pt_" + gocKy.length)); } catch {} } gocKy.push({ ten: g.ten, f, dai, ky, doan: pt ? pt.doan : null }); log("  gốc", g.ten, dai.toFixed(1) + "s", ky.length, "khung"); } catch (e) { log("  bỏ gốc", g.ten, String(e.message || e).slice(0, 60)); } }
  // ---- Whisper (tuỳ máy)
  let asr = null; try { const T = await import("@huggingface/transformers"); asr = await T.pipeline("automatic-speech-recognition", "onnx-community/whisper-base", { dtype: "q8" }); log("  whisper sẵn sàng"); } catch { log("  không có whisper — bỏ lời thoại"); }
  // ---- 2+3. từng video
  let xong = 0, mau = 0; const loi = [];
  for (const v of video) {
    try {
      const taiApp = async (x, f) => { if (existsSync(f) && statSync(f).size > 1000) return f; const u = /^https?:/.test(x.url) ? x.url : app.url.replace(/\/api\/?$/, "").replace(/\/+$/, "") + x.url; const r = await fetch(u, { headers: { "X-Hub-Key": app.khoa } }); if (!r.ok) throw new Error("tải từ kho app HTTP " + r.status); writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f; };
      const f = v.drive ? await taiDrive(v, join(TH, "tp_" + basename(v.ten).replace(/[^a-z0-9_.-]/gi, "_"))) : v.url ? await taiApp(v, join(TH, "tp_" + basename(v.ten).replace(/[^a-z0-9_.-]/gi, "_"))) : v.f; const dai = thoiLuong(f); if (!dai) throw new Error("không đọc được thời lượng");
      const shots = catShot(f, dai); if (shots.length < 2) { log("  ✗", v.ten, "chỉ 1 shot — bỏ (video một cảnh không dạy được cách ghép)"); loi.push(v.ten + ": 1 shot"); continue; }
      const KD = join(TH, "k_" + xong); mkdirSync(KD, { recursive: true });
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i]; const giua = (s.t0 + s.t1) / 2; const kf = join(KD, i + ".jpg");
        if (i < 40) { spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", giua.toFixed(2), "-i", f, "-frames:v", "1", "-vf", "scale=512:-2", kf], { encoding: "utf8" }); if (existsSync(kf)) s.khung_url = await up(kf, "image/jpeg"); }
        if (asr && s.t1 - s.t0 >= 0.8) { try { const a = amThanh16k(f, s.t0, s.t1 - s.t0); if (a && a.length > 8000) { const o = await asr(a, { language: "vi", task: "transcribe" }); s.loi = String(o.text || "").trim().slice(0, 300); } } catch {} }
        if (gocKy.length) { const kyS = chuKy(f, 2, s.t0, s.t1 - s.t0); if (kyS.length) { let best = null; for (const g of gocKy) { for (let j = 0; j + kyS.length <= g.ky.length; j++) { let d = 0; for (let q = 0; q < kyS.length; q++) d += khoangCach(kyS[q], g.ky[j + q]); d /= kyS.length; if (!best || d < best.d) best = { g, j, d }; } }
          if (best && best.d < 18) { const tu = best.j / 2, den = tu + (s.t1 - s.t0); s.goc = { ten: best.g.ten, tu: +tu.toFixed(2), den: +den.toFixed(2), diem: +(1 - best.d / 18).toFixed(3), doan: best.g.doan, dai: best.g.dai }; } } }
      }
      const mt = meta[v.ten] || {};
      const kichBan = shots.map((x) => x.loi).filter(Boolean).join(" ").trim();   // ADR-011: lời thoại nghe được = kịch bản mẫu bán hàng
      const r = await goiApp("/hub/thanh-pham", { method: "POST", body: JSON.stringify({ ten: v.ten, nguon_id: v.drive ? v.id : v.ten, nguon, thu_muc: thuMuc.slice(0, 200), dai: +dai.toFixed(2), shots, luot_xem: mt.luot_xem ?? null, luot_thich: mt.luot_thich ?? null, ngay_dang: mt.ngay_dang || null, link: mt.link || null, kenh: mt.kenh || ts.kenh || null, dong: ts.dong || null, muc_dich: ts.muc_dich || null, doanh_thu: mt.doanh_thu ?? null, luot_ban: mt.luot_ban ?? null, san_pham: mt.san_pham || null, kich_ban: kichBan || null }) });
      if (!r.ok) throw new Error("app " + r.status + " " + ((r.d && r.d.error) || ""));
      xong++; mau += (r.d && r.d.so_mau) || 0; log("  ✓", v.ten, "·", shots.length, "shot ·", shots.filter((s) => s.goc).length, "khớp gốc ·", (r.d && r.d.so_mau) || 0, "mẫu", mt.luot_xem != null ? "· " + mt.luot_xem + " xem" : "");
      rmSync(KD, { recursive: true, force: true }); if (v.drive || v.url) rmSync(f, { force: true });
    } catch (e) { loi.push(v.ten + ": " + String(e.message || e).slice(0, 80)); log("  ✗", v.ten, String(e.message || e).slice(0, 100)); }
  }
  return { ok: xong > 0, msg: "học " + xong + "/" + video.length + " video thành phẩm · " + mau + " mẫu" + (gocKy.length ? " · " + gocKy.length + " clip gốc" : "") + (loi.length ? " · lỗi: " + loi.slice(0, 2).join(" · ") : "") };
}
