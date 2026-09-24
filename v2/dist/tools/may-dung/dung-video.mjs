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
const xuongDong = (s, n = 26) => { const w = String(s).split(" "); const dong = []; let cur = ""; for (const x of w) { if ((cur + " " + x).trim().length > n && cur) { dong.push(cur); cur = x; } else cur = (cur + " " + x).trim(); } if (cur) dong.push(cur); return dong.slice(0, 4).join("\n"); };
const srtTime = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000; return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "," + String(x).padStart(3, "0"); };

// ADR-010c — cửa sổ đoạn trên phân tích footage: đặc trưng [nét, động, sáng, vị trí, gần 30% đầu, động×nét]
const cuaSoDoan = (doan, dai, can, buoc = 0.5) => { const ra = []; const het = Math.max(0, dai - can); for (let tu = 0; tu <= het + 1e-6; tu += buoc) { const den = tu + can; const trong = doan.filter((x) => x.t >= tu - 0.01 && x.t < den); if (!trong.length) continue; const tb = (k) => trong.reduce((a, x) => a + (x[k] || 0), 0) / trong.length; const vt = dai ? tu / dai : 0; const net = tb("net"), dong = tb("dong"); ra.push({ tu: +tu.toFixed(2), den: +den.toFixed(2), f: [net, dong, tb("sang"), vt, 1 - Math.abs(vt - 0.3), dong * net] }); } return ra; };
const diemDau2 = (dau, f) => { let z = dau.b || 0; for (let k = 0; k < f.length; k++) z += (dau.w[k] || 0) * f[k]; return z; };

export default async function dung({ app, goiApp, lenh, dir, log, may, script }) {
  const id = String((lenh.tham_so || {}).noi_dung_id || ""); if (!id) return { ok: false, msg: "lệnh thiếu noi_dung_id" };
  const ghepId = String((lenh.tham_so || {}).ghep_id || ""); const r = await goiApp("/hub/viec/dung_video?noi_dung_id=" + encodeURIComponent(id) + (ghepId ? "&ghep_id=" + encodeURIComponent(ghepId) : "")); if (!r.ok) return { ok: false, msg: "không hỏi được việc dựng (HTTP " + r.status + ")" };
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

  // ---- ADR-010: KẾ HOẠCH GHÉP — mỗi cảnh = chuỗi shot {clip, giây vào, giây ra}. Có kế hoạch NGƯỜI (màn Chỉnh ghép) thì làm đúng;
  //      không thì máy lập: shot đầu = clip đã chọn cho cảnh, shot sau = clip khớp tiếp theo CHƯA DÙNG; độ dài shot theo mô hình ghép
  //      (thống kê từ video thành phẩm, có trọng số lượt xem); đoạn trong clip theo mô hình chọn đoạn (nét/động/sáng) — MỞ mới dùng, BÓNG/API dùng luật.
  const layDau = async (tn) => { try { const x = await goiApp("/hub/mo-hinh/" + tn); if (!x.ok) return { muc: "API" }; const d = x.d || {}; let dau = null;
      if (["BONG", "MO"].includes(d.muc) && d.mo_hinh_mo && d.mo_hinh_mo.checkpoint_url) { const y = await fetch(d.mo_hinh_mo.checkpoint_url, { headers: /\/media\//.test(d.mo_hinh_mo.checkpoint_url) ? { "X-Hub-Key": app.khoa } : {} }); if (y.ok) { const j = await y.json().catch(() => null); if (j && j.tinh_nang === tn) dau = j; } }
      return { muc: d.muc || "API", dau }; } catch { return { muc: "API" }; } };
  const dDoan = await layDau("chon_doan"), dGhep = await layDau("ghep_canh");
  const G = dGhep.muc === "MO" && dGhep.dau ? dGhep.dau : { dai_tb: 2.8, dai_min: 1.5, dai_max: 4.5, chuyen: {} };
  const ptCua = (t) => (t && t.phan_tich) || null; const daiCua = (t) => (ptCua(t) && ptCua(t).dai) || 0;
  const diemDoan = (f) => (dDoan.muc === "MO" && dDoan.dau ? diemDau2(dDoan.dau, f) : f[0] + 0.5 * f[1] + (f[2] > 0.25 && f[2] < 0.85 ? 0.1 : 0) + 0.05 * f[4]);
  const dungDoan = {}; const chonDoan = (t, can) => { const pt = ptCua(t), dai = daiCua(t); if (!pt || !(pt.doan || []).length || !dai) return { tu: 0 };
    const cs = cuaSoDoan(pt.doan, dai, Math.min(can, dai)); let best = null, bs = -1e9; for (const c of cs) { const trung = (dungDoan[t.id] || []).some((u) => Math.min(u.den, c.den) - Math.max(u.tu, c.tu) > 0.2); const sc = diemDoan(c.f) - (trung ? 5 : 0); if (sc > bs) { bs = sc; best = c; } } return { tu: best ? best.tu : 0 }; };
  const ghepNguoi = v.ghep && Array.isArray(v.ghep.canh) ? v.ghep.canh : null; const byId = Object.fromEntries(nguon.map((t) => [t.id, t])); const daDung = new Set();
  for (const c of canhDung) {
    const gn = ghepNguoi && ghepNguoi.find((x) => x.k === c.k);
    if (gn && (gn.shots || []).length) c.shots = gn.shots.map((x) => ({ ts: byId[x.tai_san_id], tu: +x.tu, den: +x.den })).filter((x) => x.ts && x.den > x.tu);
    if (!c.shots || !c.shots.length) {
      c.shots = []; let con = c.d, truocCo = null, lap = 0;
      const ds = [c.ts, ...(c.ung_vien || []).map((u) => byId[u.id])].filter((t, i, a) => t && a.indexOf(t) === i);
      const hang = [ds[0], ...ds.slice(1).filter((t) => !daDung.has(t.id)), ...ds.slice(1).filter((t) => daDung.has(t.id))];
      while (con > 0.3 && lap < hang.length * 2 && c.shots.length < 6) {
        const t = hang[lap % hang.length]; lap++; const laAnh = t.media_type === "IMAGE"; const dai = laAnh ? 99 : (daiCua(t) || 99);
        let can = con > G.dai_max ? G.dai_tb : con; if (con - can < G.dai_min * 0.6) can = con; can = Math.min(can, dai); if (can < 0.6 && con > 0.6) continue;
        const co = ptCua(t) && ptCua(t).co_canh; if (truocCo && co && G.chuyen && G.chuyen[truocCo] && G.chuyen[truocCo][co] != null && G.chuyen[truocCo][co] < 0.05 && lap < hang.length) continue;
        const tu = laAnh ? 0 : chonDoan(t, can).tu; c.shots.push({ ts: t, tu, den: +(tu + can).toFixed(2) }); (dungDoan[t.id] = dungDoan[t.id] || []).push({ tu, den: tu + can }); daDung.add(t.id); con -= can; truocCo = co || truocCo;
      }
      if (!c.shots.length) c.shots = [{ ts: c.ts, tu: 0, den: +c.d.toFixed(2) }];
      const tongS = c.shots.reduce((a, x) => a + (x.den - x.tu), 0); if (tongS < c.d - 0.05) c.shots[c.shots.length - 1].den = +(c.shots[c.shots.length - 1].den + c.d - tongS).toFixed(2);
    }
    c.ts = c.shots[0].ts;
  }
  log("  ghép:", ghepNguoi ? "theo kế hoạch người" : ("máy · shot ~" + G.dai_tb + "s (" + (dGhep.muc === "MO" && dGhep.dau ? "mô hình" : "luật") + ") · đoạn " + (dDoan.muc === "MO" && dDoan.dau ? "mô hình" : "luật")));

  // ---- dựng từng cảnh
  const clips = []; let t0 = 0; const srt = []; let stt = 1;
  for (const c of canhDung) {
    mkdirSync(join(TH, "shot"), { recursive: true }); const shotF = [];
    for (let i = 0; i < c.shots.length; i++) { const x = c.shots[i]; const len = Math.max(0.3, x.den - x.tu); const sf = join(TH, "shot", "c" + (c.k + 1) + "_" + i + ".mp4"); const s0 = await taiVe(x.ts.media_url, "ts_" + x.ts.id + (x.ts.media_type === "IMAGE" ? ".jpg" : ".mp4"));
      if (x.ts.media_type === "IMAGE") ff(["-loop", "1", "-t", len.toFixed(2), "-i", s0, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.12)':d=" + Math.ceil(len * 30) + ":s=1080x1920:fps=30,setsar=1", "-t", len.toFixed(2), "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", sf]);
      else ff(["-ss", Math.max(0, x.tu).toFixed(2), "-i", s0, "-t", len.toFixed(2), "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,tpad=stop_mode=clone:stop_duration=" + len.toFixed(2), "-t", len.toFixed(2), "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", sf]);
      shotF.push(sf); }
    const src = join(TH, "shot", "c" + (c.k + 1) + "_hinh.mp4"); if (shotF.length === 1) copyFileSync(shotF[0], src); else { const ls = join(TH, "shot", "c" + (c.k + 1) + ".txt"); writeFileSync(ls, shotF.map((q) => "file '" + q.replace(/\\/g, "/") + "'").join("\n")); ff(["-f", "concat", "-safe", "0", "-i", ls, "-c", "copy", src]); }
    const laAnh = false; const out = join(TH, "canh", String(c.k + 1).padStart(2, "0") + "-" + c.label.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 30) + ".mp4");
    // Phụ đề ghi ra tệp chữ (textfile) để GIỮ xuống dòng — trước đây escDT đổi "\n" thành dấu cách nên cả câu thành một dòng tràn hai mép (đo 24/09 trên footage thật)
    mkdirSync(join(TH, "pd"), { recursive: true });
    let tt = 0; const dt = c.cauDs.map((x, i) => { const a = tt; tt += x.d; const tf = join(TH, "pd", "c" + (c.k + 1) + "_" + i + ".txt"); writeFileSync(tf, xuongDong(x.text, 24).replace(/\r/g, ""), "utf8"); const tfE = tf.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "");
      return FONT ? ",drawtext=fontfile='" + FONT.replace(/:/g, "\\:") + "':textfile='" + tfE + "':expansion=none:fontcolor=white:fontsize=52:line_spacing=10:box=1:boxcolor=black@0.45:boxborderw=18:x=(w-text_w)/2:y=h-text_h-260:enable='between(t," + a.toFixed(2) + "," + tt.toFixed(2) + ")'" : ""; }).join("");
    const vf = (laAnh ? "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.12)':d=" + Math.ceil(c.d * 30) + ":s=1080x1920:fps=30" : "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30") + dt;
    const vao = laAnh ? ["-loop", "1", "-t", c.d.toFixed(2), "-i", src] : ["-stream_loop", "-1", "-t", c.d.toFixed(2), "-i", src];
    if (coGiong && c.mp3.length) { const lst = join(TH, "giong", "c" + c.k + ".txt"); writeFileSync(lst, c.mp3.map((f) => "file '" + f.replace(/\\/g, "/") + "'").join("\n")); const gi = join(TH, "giong", String(c.k + 1).padStart(2, "0") + "-giong.mp3"); ff(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", gi]); c.giong = gi;
      ff([...vao, "-i", gi, "-vf", vf, "-map", "0:v", "-map", "1:a", "-t", c.d.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out]); }
    else ff([...vao, "-f", "lavfi", "-t", c.d.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo", "-vf", vf, "-map", "0:v", "-map", "1:a", "-t", c.d.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out]);
    clips.push(out); for (const x of c.cauDs) { srt.push(stt++ + "\n" + srtTime(t0) + " --> " + srtTime(t0 + x.d) + "\n" + x.text + "\n"); t0 += x.d; }
    log("  cảnh", c.k + 1, c.label, "·", c.d.toFixed(1) + "s ·", c.shots.map((x) => (x.ts.ten || "").replace(/\.[a-z0-9]+$/i, "").slice(-12) + "[" + x.tu.toFixed(1) + "–" + x.den.toFixed(1) + "]").join(" + "));
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
  // bsdtar trên Windows hiểu "D:\…" sau -f là máy_chủ:đường (đo 24/09: "Cannot connect to D: resolve failed") → chạy trong thư mục đích, tên tệp tương đối
  // Windows: bsdtar 3.8 ở System32 SẬP (segfault) khi tạo zip, tar của Git thì không biết zip (đo 24/09 trên Ngoc-Han) → dùng PowerShell Compress-Archive; máy khác dùng tar -a.
  let goiF = ""; try { goiF = join(dir, "dung", id + "-goi-capcut.zip"); rmSync(goiF, { force: true });
    const muc = ["canh", "giong", "phu-de.srt", "ban-nhap.mp4", "DOC-TOI.txt", ...(nhacF ? ["nhac.mp3"] : []), ...(ttsMo ? ["giong-mo"] : [])];
    const z = process.platform === "win32"
      ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Compress-Archive -Path " + muc.map((m) => "'" + m + "'").join(",") + " -DestinationPath '" + goiF.replace(/'/g, "''") + "' -CompressionLevel Fastest -Force"], { cwd: TH, encoding: "utf8", timeout: 300000 })
      : spawnSync("tar", ["-a", "-c", "-f", id + "-goi-capcut.zip", "-C", TH, ...muc], { cwd: join(dir, "dung"), encoding: "utf8", timeout: 300000 }); if (z.status !== 0 || !existsSync(goiF)) { log("  không nén được gói:", String(z.stderr || z.error || "").slice(0, 120)); goiF = ""; } } catch (e) { goiF = ""; }

  // ---- tải lên & báo về
  const taiLen = async (f, type) => { const buf = readFileSync(f); const x = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=" + encodeURIComponent(type), { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": type, "Content-Length": String(buf.length) }, body: buf }); const d = await x.json().catch(() => ({})); if (!x.ok) throw new Error("tải lên " + x.status + " " + (d.error || "")); return d.media_url; };
  const mediaUrl = await taiLen(banNhap, "video/mp4"); let goiUrl = ""; let ttsMoUrl = ""; if (ttsMo) { try { ttsMoUrl = await taiLen(ttsMo.file, "audio/mpeg"); } catch (e) { log("  tải mẫu giọng lỗi:", e.message); } } if (goiF) { try { goiUrl = await taiLen(goiF, "application/zip"); } catch (e) { log("  tải gói lỗi:", e.message); } }
  const moTa = "Máy dựng v2 · " + canhDung.length + " cảnh · " + Math.round(t0) + "s · " + (coGiong ? "giọng " + (nguonGiong === "piper" ? "Piper (mở)" : "Google " + (cfg.tts_giong || "")) : "không giọng (" + ttsLoi + ")") + (nhacF ? " · nhạc nền" : "") + (goiUrl ? " · có gói CapCut" : "");
  const nap = await goiApp("/hub/nap", { method: "POST", body: JSON.stringify({ viec: "may_dung.dung_video", bang: "content_os.video", luot: "md" + Date.now(), phan: { i: 1, n: 1 }, dong: [{ noi_dung_id: id, media_url: mediaUrl, goi_url: goiUrl, thieu_hinh: thieuHinh, mo_ta: moTa, may, tts_mo: ttsMoUrl ? { mau_url: ttsMoUrl, cau: ttsMo.cau, giong: ttsMo.giong } : undefined, ghep_nguon: ghepNguoi ? "NGUOI" : "MAY", ghep: canhDung.map((c) => ({ k: c.k, label: c.label, hinh: c.hinh, text: c.cau.join(" ").slice(0, 300), d: +c.d.toFixed(2), shots: c.shots.map((x) => ({ tai_san_id: x.ts.id, tu: +x.tu.toFixed(2), den: +x.den.toFixed(2) })) })), canh_chon: canhDung.map((c) => ({ k: c.k, label: c.label, hinh: c.hinh, text: c.cau.join(" ").slice(0, 300), chon: c.ts && c.ts.id, chon_mo: c.chon_mo || null, cach: cachChon, ung_vien: (c.ung_vien || []).slice(0, 12) })) }] }) });
  if (!nap.ok) return { ok: false, msg: "dựng xong nhưng app không nhận lô (HTTP " + nap.status + ")" };
  return { ok: true, msg: moTa + (thieuHinh.length ? " · thiếu hình " + thieuHinh.length + " cảnh" : "") };
}
