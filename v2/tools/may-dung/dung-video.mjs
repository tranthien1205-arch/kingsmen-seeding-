// SCRIPT DỰNG VIDEO NHÁP v2 (ADR-008b) — app phát cho máy con qua /hub/script/dung-video; máy con import và gọi default().
// Đầu vào: lệnh dung_video {noi_dung_id}. Các bước:
//   1. hỏi /hub/viec/dung_video?noi_dung_id → kịch bản (hook, cảnh + gợi ý hình, CTA), tài sản footage/ảnh, kho nhạc nền, cấu hình
//   2. mỗi cảnh: chọn footage KHỚP gợi ý hình (so từ khoá với tên/mô tả tài sản; không khớp → xoay vòng + ghi "thiếu hình")
//   3. mỗi câu: giọng đọc qua /hub/tts (khoá Google ở Worker; không có khoá → không tiếng, thời lượng ước theo số chữ)
//   4. ffmpeg: cảnh 1080×1920 dài bằng giọng đọc, phụ đề từng câu đúng nhịp, ghép cảnh, trộn nhạc nền −N dB
//   5. gói dựng tiếp cho CapCut: canh/*.mp4 · giong/*.mp3 · phu-de.srt · nhac.mp3 · ban-nhap.mp4 · DOC-TOI.txt → zip (bsdtar có sẵn Windows)
//   6. tải mp4 + zip lên /hub/upload → lô content_os.video {noi_dung_id, media_url, goi_url, thieu_hinh, mo_ta, may}
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const FONT = ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find(existsSync) || "";
const ff = (args, timeout = 300000) => { const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8", timeout }); if (p.status !== 0) throw new Error("ffmpeg: " + String(p.stderr || p.error || "").trim().slice(-220)); };
const thoiLuong = (f) => { const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }); const d = Number(String(p.stdout || "").trim()); return Number.isFinite(d) && d > 0 ? d : 0; };
const escDT = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%").replace(/\n/g, " ");
const tach = (s) => new Set(String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["cua", "cho", "voi", "khi", "the", "nay", "canh", "hinh", "toan", "can", "anh"].includes(w)));
const khop = (a, b) => { const A = tach(a), B = tach(b); let g = 0; A.forEach((w) => { if (B.has(w)) g++; }); return g; };
const tachCau = (t) => { const ds = String(t || "").replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean); const out = []; for (const c of ds) { if (out.length && out[out.length - 1].split(" ").length < 4) out[out.length - 1] += " " + c; else out.push(c); } return out.length ? out : [String(t || "").trim()].filter(Boolean); };
const xuongDong = (s, n = 26) => { const w = String(s).split(" "); const dong = []; let cur = ""; for (const x of w) { if ((cur + " " + x).trim().length > n && cur) { dong.push(cur); cur = x; } else cur = (cur + " " + x).trim(); } if (cur) dong.push(cur); return dong.slice(0, 3).join("\n"); };
const srtTime = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000; return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "," + String(x).padStart(3, "0"); };

export default async function dung({ app, goiApp, lenh, dir, log, may, script }) {
  const id = String((lenh.tham_so || {}).noi_dung_id || ""); if (!id) return { ok: false, msg: "lệnh thiếu noi_dung_id" };
  const r = await goiApp("/hub/viec/dung_video?noi_dung_id=" + encodeURIComponent(id)); if (!r.ok) return { ok: false, msg: "không hỏi được việc dựng (HTTP " + r.status + ")" };
  const v = ((r.d && r.d.viec) || [])[0]; if (!v) return { ok: false, msg: "kịch bản không còn ở trạng thái đã duyệt / sản xuất" };
  const cfg = v.cau_hinh || {}; const TH = join(dir, "dung", id); rmSync(TH, { recursive: true, force: true }); for (const d of ["src", "canh", "giong"]) mkdirSync(join(TH, d), { recursive: true });
  const taiVe = async (url, ten) => { const f = join(TH, "src", ten); if (existsSync(f)) return f; const x = await fetch(url, { headers: /\/media\//.test(url) ? { "X-Hub-Key": app.khoa } : {} }); if (!x.ok) throw new Error("tải " + ten + " HTTP " + x.status); writeFileSync(f, Buffer.from(await x.arrayBuffer())); return f; };
  const nguon = (v.tai_san || []).filter((t) => t.media_url); if (!nguon.length) return { ok: false, msg: "chưa có footage/ảnh gắn với thẻ — tải lên tab Sản xuất rồi dựng lại" };

  // ---- cảnh & câu
  const canhGoc = (v.sections && v.sections.length ? v.sections : [{ label: "Cảnh 1", text: v.hook || v.tieu_de }]).slice(0, Math.max(1, cfg.canh_toi_da || 12));
  if (v.cta) canhGoc.push({ label: "Chốt", text: v.cta, hinh: "logo Kingsmen, sản phẩm" });
  const canh = canhGoc.map((c, k) => ({ k, label: c.label || "Cảnh " + (k + 1), hinh: c.hinh || "", cau: tachCau((k === 0 && v.hook && c.text !== v.hook ? v.hook + " " : "") + (c.text || "")) })).filter((c) => c.cau.length);

  // ---- chọn footage theo gợi ý hình: quy tắc từ khoá (thầy) + mô hình nhìn mở (trò — BÓNG: chỉ ghi, MỞ: dùng) — ADR-009
  const thieuHinh = []; let xoay = 0; let truoc = null;
  for (const c of canh) {
    const diem = nguon.map((t) => ({ t, d: khop(c.hinh + " " + c.cau.join(" "), (t.ten || "") + " " + (t.mo_ta || "")) + (t.loai === "FOOTAGE" ? 0.5 : 0) - (t === truoc ? 0.4 : 0) }));
    diem.sort((a, b) => b.d - a.d); const tot = diem[0]; c.ung_vien = diem.map((x) => ({ id: x.t.id, ten: x.t.ten, mo_ta: x.t.mo_ta, media_url: x.t.media_url, media_type: x.t.media_type, diem: +x.d.toFixed(2) }));
    if (tot && tot.d >= 1) c.ts = tot.t; else { c.ts = nguon[xoay++ % nguon.length]; if (c.hinh) thieuHinh.push(c.label + ": " + c.hinh.slice(0, 60)); }
    c.chon_tu_khoa = c.ts; truoc = c.ts;
  }
  let cachChon = "TU_KHOA";
  try { const mh = await goiApp("/hub/mo-hinh/chon_canh"); const dt = mh.ok ? mh.d : null;
    if (dt && ["BONG", "MO"].includes(dt.muc) && dt.mo_hinh_mo && script) { const nhin = await script("nhin"); const N = await nhin.taoNhin({ model_id: dt.mo_hinh_mo.model_id, log });
      let dau = null; if (dt.mo_hinh_mo.checkpoint_url) { try { const x = await fetch(dt.mo_hinh_mo.checkpoint_url, { headers: /\/media\//.test(dt.mo_hinh_mo.checkpoint_url) ? { "X-Hub-Key": app.khoa } : {} }); if (x.ok) dau = await x.json(); } catch (e) { log("  không tải được đầu học:", e.message); } }
      const emb = {}; for (const t of nguon) { try { const src = await taiVe(t.media_url, "ts_" + t.id + (t.media_type === "IMAGE" ? ".jpg" : ".mp4")); emb[t.id] = await N.embImage(nhin.khungHinh(src, join(TH, "khung"), t.id)); } catch (e) { log("  bỏ nhìn", t.ten, e.message.slice(0, 60)); } }
      let prev = null; for (const c of canh) { const tv = await N.embText(c.hinh + " " + c.cau.join(" ")); let best = null, bs = -1e9;
        for (const u of c.ung_vien) { const iv = emb[u.id]; if (!iv) continue; const f = nhin.dacTrung(tv, iv); const sc = (dau ? nhin.diemDau(dau, f) : (f[0] + 1) / 2) - (prev === u.id ? 0.08 : 0); u.diem_mo = +sc.toFixed(3); if (sc > bs) { bs = sc; best = u.id; } }
        c.chon_mo = best; prev = best; if (dt.muc === "MO" && best) { c.ts = nguon.find((t) => t.id === best) || c.ts; } }
      cachChon = dt.muc === "MO" ? "MO" : "TU_KHOA"; log("  mô hình nhìn mở:", dt.muc, dau ? "đầu " + (dau.tinh_nang || "") : "cos thuần"); } } catch (e) { log("  bỏ mô hình nhìn:", e.message.slice(0, 120)); }

  // ---- giọng đọc từng câu: Google (API) hoặc Piper (mở, ADR-009c) theo định tuyến tts: API → BÓNG (Google + mẫu Piper để người chấm) → MỞ (Piper, Google dự phòng)
  let ttsRoute = null; try { const x = await goiApp("/hub/mo-hinh/tts"); ttsRoute = x.ok ? x.d : null; } catch {}
  let piper = null; if (ttsRoute && ["BONG", "MO"].includes(ttsRoute.muc) && script) { try { piper = await (await script("piper")).taoPiper({ dir, log, giong: (ttsRoute.mo_hinh_mo && ttsRoute.mo_hinh_mo.model_id) || "vi_VN-vais1000-medium" }); } catch (e) { log("  piper không sẵn:", String(e.message || e).slice(0, 100)); } }
  const docGoogle = async (text, f) => { const x = await goiApp("/hub/tts", { method: "POST", body: JSON.stringify({ text, giong: cfg.tts_giong }) }); if (!x.ok) throw new Error((x.d && x.d.error) || ("HTTP " + x.status)); writeFileSync(f, x.d); return f; };
  let coGiong = true; let ttsLoi = ""; let nguonGiong = ttsRoute && ttsRoute.muc === "MO" && piper ? "piper" : "google";
  for (const c of canh) { c.mp3 = []; for (let i = 0; i < c.cau.length; i++) { if (!coGiong) break; const f = join(TH, "giong", "c" + c.k + "_" + i + ".mp3");
      try { if (nguonGiong === "piper") piper.doc(c.cau[i], f); else await docGoogle(c.cau[i], f); c.mp3.push(f); }
      catch (e) { if (nguonGiong === "google" && piper) { try { piper.doc(c.cau[i], f); c.mp3.push(f); nguonGiong = "piper"; log("  Google lỗi → dùng Piper:", String(e.message || e).slice(0, 60)); continue; } catch {} } coGiong = false; ttsLoi = String(e.message || e).slice(0, 120); break; } } }
  if (!coGiong) log("  không có giọng đọc:", ttsLoi); else log("  giọng đọc:", nguonGiong);
  // BÓNG: thêm mẫu giọng Piper (2 câu đầu) để người nghe chấm — không dùng trong bản nháp
  let ttsMo = null; if (piper && ttsRoute.muc === "BONG" && coGiong && nguonGiong === "google") { try { mkdirSync(join(TH, "giong-mo"), { recursive: true }); const cauMau = canh.flatMap((c) => c.cau).slice(0, 2).join(" "); const fm = join(TH, "giong-mo", "mau.mp3"); piper.doc(cauMau, fm); ttsMo = { file: fm, cau: cauMau, giong: piper.giong }; } catch (e) { log("  mẫu Piper lỗi:", String(e.message || e).slice(0, 80)); } }
  for (const c of canh) { c.cauDs = c.cau.map((text, i) => { const d = coGiong && c.mp3[i] ? Math.max(1.2, thoiLuong(c.mp3[i]) + 0.35) : Math.max(2.5, text.split(" ").length / 2.6); return { text, d }; }); c.d = c.cauDs.reduce((s, x) => s + x.d, 0); }
  const gioiHan = Math.max(20, cfg.giay_toi_da || 90); let tong = 0; const canhDung = []; for (const c of canh) { if (tong + c.d > gioiHan && canhDung.length) break; canhDung.push(c); tong += c.d; }

  // ---- dựng từng cảnh
  const clips = []; let t0 = 0; const srt = []; let stt = 1;
  for (const c of canhDung) {
    const src = await taiVe(c.ts.media_url, "ts_" + c.ts.id + (c.ts.media_type === "IMAGE" ? ".jpg" : ".mp4"));
    const laAnh = c.ts.media_type === "IMAGE"; const out = join(TH, "canh", String(c.k + 1).padStart(2, "0") + "-" + c.label.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 30) + ".mp4");
    let tt = 0; const dt = c.cauDs.map((x) => { const a = tt; tt += x.d; return FONT ? ",drawtext=fontfile='" + FONT.replace(/:/g, "\\:") + "':text='" + escDT(xuongDong(x.text)) + "':fontcolor=white:fontsize=52:line_spacing=10:box=1:boxcolor=black@0.45:boxborderw=18:x=(w-text_w)/2:y=h-text_h-260:enable='between(t," + a.toFixed(2) + "," + tt.toFixed(2) + ")'" : ""; }).join("");
    const vf = (laAnh ? "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.12)':d=" + Math.ceil(c.d * 30) + ":s=1080x1920:fps=30" : "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30") + dt;
    const vao = laAnh ? ["-loop", "1", "-t", c.d.toFixed(2), "-i", src] : ["-stream_loop", "-1", "-t", c.d.toFixed(2), "-i", src];
    if (coGiong && c.mp3.length) { const lst = join(TH, "giong", "c" + c.k + ".txt"); writeFileSync(lst, c.mp3.map((f) => "file '" + f.replace(/\\/g, "/") + "'").join("\n")); const gi = join(TH, "giong", String(c.k + 1).padStart(2, "0") + "-giong.mp3"); ff(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", gi]); c.giong = gi;
      ff([...vao, "-i", gi, "-vf", vf, "-map", "0:v", "-map", "1:a", "-t", c.d.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out]); }
    else ff([...vao, "-f", "lavfi", "-t", c.d.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo", "-vf", vf, "-map", "0:v", "-map", "1:a", "-t", c.d.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out]);
    clips.push(out); for (const x of c.cauDs) { srt.push(stt++ + "\n" + srtTime(t0) + " --> " + srtTime(t0 + x.d) + "\n" + x.text + "\n"); t0 += x.d; }
    log("  cảnh", c.k + 1, c.label, "·", c.d.toFixed(1) + "s ·", c.ts.ten);
  }
  const lst = join(TH, "canh.txt"); writeFileSync(lst, clips.map((c) => "file '" + c.replace(/\\/g, "/") + "'").join("\n"));
  const khongNhac = join(TH, "ban-nhap-khong-nhac.mp4"); ff(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", khongNhac]);
  writeFileSync(join(TH, "phu-de.srt"), srt.join("\n"));

  // ---- nhạc nền (kho NHAC của app, chọn theo tên/mô tả khớp kịch bản, không thì bài đầu)
  const banNhap = join(TH, "ban-nhap.mp4"); let nhacF = "";
  const nhacDs = (v.nhac || []).filter((x) => x.media_url); if (nhacDs.length) { try { nhacDs.sort((a, b) => khop(v.tieu_de + " " + v.hook, b.ten + " " + b.mo_ta) - khop(v.tieu_de + " " + v.hook, a.ten + " " + a.mo_ta)); nhacF = await taiVe(nhacDs[0].media_url, "nhac.mp3"); copyFileSync(nhacF, join(TH, "nhac.mp3")); } catch (e) { log("  nhạc nền lỗi:", e.message); nhacF = ""; } }
  if (nhacF) ff(["-i", khongNhac, "-stream_loop", "-1", "-i", nhacF, "-filter_complex", "[1:a]volume=-" + Math.max(0, cfg.nhac_giam_db || 18) + "dB,afade=t=out:st=" + Math.max(0, t0 - 2).toFixed(2) + ":d=2[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-t", t0.toFixed(2), banNhap]); else copyFileSync(khongNhac, banNhap);

  // ---- gói dựng tiếp cho CapCut (zip bằng bsdtar có sẵn trên Windows 10+/macOS/Linux)
  writeFileSync(join(TH, "DOC-TOI.txt"), ["GÓI DỰNG TIẾP — " + (v.tieu_de || v.hook), "", "1. Mở CapCut (máy tính) → Dự án mới → Nhập: kéo cả thư mục canh/ (từng cảnh đã cắt đúng thời lượng, đã có phụ đề đè) hoặc ban-nhap.mp4.", "2. Muốn chỉnh chữ: dùng phu-de.srt (CapCut: Văn bản → Phụ đề → Nhập tệp SRT) trên clip không chữ — clip trong canh/ đã in chữ, nếu cần bản không chữ hãy bấm dựng lại sau khi tắt phụ đề.", "3. Giọng đọc từng cảnh ở giong/ · nhạc nền nhac.mp3 (đã giảm " + (cfg.nhac_giam_db || 18) + " dB trong bản nháp).", "4. Thứ tự cảnh = số đầu tên file. Cảnh thiếu hình: " + (thieuHinh.join("; ") || "không"), "", "Dựng xong → tải bản cuối lên thẻ › Sản xuất (Tải ảnh/video) rồi qua tab Đăng."].join("\r\n"));
  let goiF = ""; try { goiF = join(dir, "dung", id + "-goi-capcut.zip"); rmSync(goiF, { force: true }); const z = spawnSync("tar", ["-a", "-c", "-f", goiF, "-C", TH, "canh", "giong", "phu-de.srt", "ban-nhap.mp4", "DOC-TOI.txt", ...(nhacF ? ["nhac.mp3"] : []), ...(ttsMo ? ["giong-mo"] : [])], { encoding: "utf8", timeout: 300000 }); if (z.status !== 0 || !existsSync(goiF)) { log("  không nén được gói:", String(z.stderr || z.error || "").slice(0, 120)); goiF = ""; } } catch (e) { goiF = ""; }

  // ---- tải lên & báo về
  const taiLen = async (f, type) => { const buf = readFileSync(f); const x = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=" + encodeURIComponent(type), { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": type, "Content-Length": String(buf.length) }, body: buf }); const d = await x.json().catch(() => ({})); if (!x.ok) throw new Error("tải lên " + x.status + " " + (d.error || "")); return d.media_url; };
  const mediaUrl = await taiLen(banNhap, "video/mp4"); let goiUrl = ""; let ttsMoUrl = ""; if (ttsMo) { try { ttsMoUrl = await taiLen(ttsMo.file, "audio/mpeg"); } catch (e) { log("  tải mẫu giọng lỗi:", e.message); } } if (goiF) { try { goiUrl = await taiLen(goiF, "application/zip"); } catch (e) { log("  tải gói lỗi:", e.message); } }
  const moTa = "Máy dựng v2 · " + canhDung.length + " cảnh · " + Math.round(t0) + "s · " + (coGiong ? "giọng " + (nguonGiong === "piper" ? "Piper (mở)" : "Google " + (cfg.tts_giong || "")) : "không giọng (" + ttsLoi + ")") + (nhacF ? " · nhạc nền" : "") + (goiUrl ? " · có gói CapCut" : "");
  const nap = await goiApp("/hub/nap", { method: "POST", body: JSON.stringify({ viec: "may_dung.dung_video", bang: "content_os.video", luot: "md" + Date.now(), phan: { i: 1, n: 1 }, dong: [{ noi_dung_id: id, media_url: mediaUrl, goi_url: goiUrl, thieu_hinh: thieuHinh, mo_ta: moTa, may, tts_mo: ttsMoUrl ? { mau_url: ttsMoUrl, cau: ttsMo.cau, giong: ttsMo.giong } : undefined, canh_chon: canhDung.map((c) => ({ k: c.k, label: c.label, hinh: c.hinh, text: c.cau.join(" ").slice(0, 300), chon: c.ts && c.ts.id, chon_mo: c.chon_mo || null, cach: cachChon, ung_vien: (c.ung_vien || []).slice(0, 12) })) }] }) });
  if (!nap.ok) return { ok: false, msg: "dựng xong nhưng app không nhận lô (HTTP " + nap.status + ")" };
  return { ok: true, msg: moTa + (thieuHinh.length ? " · thiếu hình " + thieuHinh.length + " cảnh" : "") };
}
