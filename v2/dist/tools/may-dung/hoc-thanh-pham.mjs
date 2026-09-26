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

// Sửa thuật ngữ bộ nghe hay sai (đo 24/09 trên "Làm đúng ngay từ đầu.mp4": whisper-small nghe "Kingsman", "kín smen", "Ron Ebuci",
// "kêu chích mạch"). Chỉ sửa chỗ chắc chắn; tên lạ không đoán.
const THUAT_NGU = [
  [/\b(kings?man|kinsmen|kín ?s ?men|kin ?smen|kim ?man|kis+man|king ?s ?men)\b/gi, "Kingsmen"],
  [/\b(e ?bu ?(ci|si|xi|xy|xi)|evu ?xy|ê ?pô ?xi|epoxi)\b/gi, "epoxy"],
  [/\b(fnx|fn ?x|finess|finnex|finex|phanx|phinx|phinex|phoenix|phi ?nex|fi ?nex)\b/gi, "Finex"],
  [/\b(kêu|kéo|keo|kiêu) (chích|chít|chết|chứt|chiếc|chịch) (mạch|mặt|mặc)\b/gi, "keo chít mạch"],
  [/(^|[\s,.])(đường|màu|phần|khe|mạch) (rôn|rồn|rõn|rốn|gion|jones|rôm)(?=$|[\s,.?!])/gi, "$1$2 ron"],   // \b không nhận chữ có dấu
  [/\bron(?= epoxy)/gi, "ron"],
];
export function suaThuatNgu(t) { let x = String(t || ""); for (const [re, v] of THUAT_NGU) x = x.replace(re, v); return x; }
function docMeta(th) { try { const f = join(th, "_meta.json"); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {}; } catch { return {}; } }
function amThanh16k(f, tu = 0, dai = null) { const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(tu || 0), "-i", f, ...(dai ? ["-t", String(dai)] : []), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"], { maxBuffer: 64 * 1024 * 1024, timeout: 300000 }); if (p.status !== 0) return null; const b = p.stdout; return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4)); }

export default async function hoc({ app, goiApp, lenh, dir, log, script }) {
  const ts = lenh.tham_so || {}; const nguon = String(ts.nguon || "DRIVE").toUpperCase(); const toiDa = Math.max(1, Math.min(60, Number(ts.toi_da) || 20));
  const TH = join(dir, "thanh-pham", "lam"); mkdirSync(TH, { recursive: true });
  // (24/09) video Drive giữ lại trên máy học (mỗi video ~150–190 MB): học lại không phải tải lại
  const KHO_DRIVE = join(dir, "thanh-pham", "drive"); mkdirSync(KHO_DRIVE, { recursive: true });
  const daCo = new Set(((await goiApp("/hub/viec/thanh_pham")).d || {}).da_co || []);
  const PT = script ? await script("phan-tich").catch(() => null) : null;
  // ---- 1. danh sách video thành phẩm + clip gốc
  let video = [], goc = [], thuMuc = "", meta = {};
  // 25/09: chế độ chỉ tạo bản xem 360p cho video đã học (không nghe / nhìn / thầy lại) — tìm file đã tải trên ổ trước, không có mới tải
  const timFile = (ten, th = join(dir, "thanh-pham"), sau = 0) => { if (!existsSync(th) || sau > 3) return null; for (const n of readdirSync(th)) { const p = join(th, n); let st; try { st = statSync(p); } catch { continue; } if (st.isFile() && n === ten && st.size > 50000) return p; if (st.isDirectory()) { const x = timFile(ten, p, sau + 1); if (x) return x; } } return null; };
  if (Array.isArray(ts.ds_proxy)) { thuMuc = "bản xem"; const TAI = join(dir, "thanh-pham", "proxy-tai"); mkdirSync(TAI, { recursive: true });
    for (const x of ts.ds_proxy) { const idTT = (String(x.link || "").match(/\/video\/(\d+)/) || [])[1]; const them = { nguon_id: x.nguon_id, app_id: x.id, can_proxy: x.can_proxy !== false, doan: Array.isArray(x.doan) ? x.doan : [] };
      if (String(x.nguon).toUpperCase() === "FOOTAGE" && x.media_url) video.push({ id: x.id, ten: x.ten || x.id, url: x.media_url, ...them });   // footage đã ở kho app: tải về cắt ảnh đoạn
      else if (idTT) { const ten = idTT + ".mp4"; video.push({ id: ten, ten, link: x.link, f: timFile(ten) || join(TAI, ten), ...them }); }
      else if (String(x.nguon).toUpperCase() === "DRIVE") video.push({ id: x.nguon_id, ten: x.ten, drive: true, ...them });
      else { const f = timFile(String(x.ten || "")); if (f) video.push({ id: x.ten, ten: x.ten, f, ...them }); else log("  ·", x.ten, "không thấy file trên máy — bỏ"); } }
  } else if (nguon === "DRIVE") {
    const ND = await script("nap-drive"); const fid = String(ts.folder_id || ""); if (!fid) return { ok: false, msg: "lệnh thiếu folder_id" }; thuMuc = "drive:" + fid;
    // đi sâu tối đa 3 tầng thư mục (đo 24/09: kho của chủ là gốc → BÁN HÀNG → DOUYIN_20V/FINEX/TERRAZY → video); thư mục tên goc/source ở tầng nào cũng là clip gốc
    const duyet = async (id, duong, tang) => { const ds = await ND.docThuMuc(id).catch(() => []); for (const x of ds) { if (x.la_thu_muc) { if (tang < 5 && !/thumb/i.test(x.ten)) await duyet(x.id, duong ? duong + "/" + x.ten : x.ten, tang + 1); } else if (LA_VIDEO.test(x.ten)) { if (LA_GOC.test((duong || "").split("/").pop() || "")) goc.push({ ...x, drive: true }); else video.push({ ...x, drive: true, nhom: duong || "" }); } } };
    await duyet(fid, "", 0); log("  Drive:", video.length, "video ·", goc.length, "clip gốc");
  } else if (Array.isArray(ts.links) && ts.links.length) {
    // 24/09 tối (chủ: "tải về máy Q2 luôn để huấn luyện"): máy học tự tải thẳng từ TikTok về ổ của nó, giữ lại để học lại lần sau
    const slug = String(ts.kenh || nguon).replace(/^kalodata:/, "").replace(/^@/, "").replace(/[^a-z0-9_.-]/gi, "_").slice(0, 60) || "khac";
    thuMuc = join(dir, "thanh-pham", nguon.toLowerCase(), slug); mkdirSync(thuMuc, { recursive: true });
    for (const x of ts.links) { const id = (String(x.link).match(/\/video\/(\d+)/) || [])[1]; if (!id) continue; const ten = id + ".mp4"; video.push({ id: ten, ten, link: x.link, play: (x.meta && x.meta.play) || null, f: join(thuMuc, ten) }); meta[ten] = { ...(x.meta || {}), link: x.link }; }
    try { writeFileSync(join(thuMuc, "_meta.json"), JSON.stringify(meta, null, 1)); } catch {}
  } else if (Array.isArray(ts.video) && ts.video.length) {
    // 24/09 (gom về một máy): Trạm tải xong đẩy video lên kho app → máy học lấy về từ app, không cần chung ổ với Trạm
    thuMuc = "app:" + (ts.kenh || nguon); for (const x of ts.video) { video.push({ id: x.ten, ten: x.ten, url: x.url }); meta[x.ten] = x.meta || {}; }
  } else {
    thuMuc = String(ts.duong_dan || ""); if (!thuMuc || !existsSync(thuMuc)) return { ok: false, msg: "máy dựng không thấy thư mục " + (thuMuc || "(trống)") + (nguon === "TIKTOK" || nguon === "KALODATA" ? " — Trạm tải TikTok về máy khác? Đặt Trạm và máy dựng cùng máy, hoặc chép thư mục sang" : "") };
    meta = docMeta(thuMuc); const ls = (th) => readdirSync(th).map((n) => ({ n, f: join(th, n), st: statSync(join(th, n)) }));
    for (const e of ls(thuMuc)) { if (e.st.isDirectory()) { const trong = ls(e.f).filter((x) => x.st.isFile() && LA_VIDEO.test(x.n)).map((x) => ({ id: x.f, ten: x.n, f: x.f })); if (LA_GOC.test(e.n)) goc.push(...trong); else video.push(...trong.map((x) => ({ ...x, nhom: e.n }))); } else if (LA_VIDEO.test(e.n)) video.push({ id: e.f, ten: e.n, f: e.f }); }
  }
  video = video.filter((v) => ts.lam_lai || ts.chi_proxy || !daCo.has(v.drive ? v.id : v.ten)).slice(0, ts.chi_proxy ? 60 : toiDa); goc = goc.slice(0, 40);
  if (!video.length) return { ok: true, msg: "không có video thành phẩm mới trong " + thuMuc + " (đã học " + daCo.size + ")" };
  log("  thành phẩm:", video.length, "· clip gốc:", goc.length, "· nguồn", nguon);
  const taiDrive = async (x, f) => { if (existsSync(f) && statSync(f).size > 1000) return f; const r = await fetch("https://drive.usercontent.google.com/download?id=" + encodeURIComponent(x.id) + "&export=download&confirm=t", { redirect: "follow" }); if (!r.ok) throw new Error("tải Drive HTTP " + r.status); if (/text\/html/.test(r.headers.get("content-type") || "")) throw new Error("Drive trả trang HTML (file riêng tư / hết hạn mức)"); writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f; };
  const up = async (f, type) => { let e0; for (let k = 0; k < 3; k++) { try { const buf = readFileSync(f); const x = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=" + encodeURIComponent(type), { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": type, "Content-Length": String(buf.length) }, body: buf }); const j = await x.json().catch(() => ({})); if (!x.ok) throw new Error("tải lên " + x.status); return j.media_url; } catch (e) { e0 = e; await new Promise((r) => setTimeout(r, 3000 * (k + 1))); } } throw e0; };
  // bản xem 360p (~2–4 MB / phút) để người xem, nghe đúng đoạn mẫu trong Kho mẫu
  const taoProxy = async (f, ten) => { const pf = join(TH, "px_" + String(ten).replace(/[^a-z0-9_.-]/gi, "_") + ".mp4"); spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", f, "-vf", "scale=-2:360", "-c:v", "libx264", "-preset", "veryfast", "-crf", "32", "-c:a", "aac", "-b:a", "48k", "-ac", "1", "-movflags", "+faststart", pf], { encoding: "utf8", timeout: 600000, windowsHide: true });
    if (!existsSync(pf) || statSync(pf).size < 1000) return null; try { return await up(pf, "video/mp4"); } finally { rmSync(pf, { force: true }); } };
  // ---- chữ ký clip gốc (2 khung/giây) + phân tích đoạn — tính một lần
  const gocKy = []; for (const g of goc) { try { const f = g.drive ? await taiDrive(g, join(TH, "goc_" + basename(g.ten).replace(/[^a-z0-9_.-]/gi, "_"))) : g.f; const dai = thoiLuong(f); if (!dai) continue; const ky = chuKy(f, 2); let pt = null; if (PT) { try { pt = PT.phanTich(f, join(TH, "pt_" + gocKy.length)); } catch {} } gocKy.push({ ten: g.ten, f, dai, ky, doan: pt ? pt.doan : null }); log("  gốc", g.ten, dai.toFixed(1) + "s", ky.length, "khung"); } catch (e) { log("  bỏ gốc", g.ten, String(e.message || e).slice(0, 60)); } }
  // ---- Whisper (tuỳ máy)
  // (24/09) whisper-base nghe tiếng Việt quá kém ("KISSMAN", "đeo chứt mặt") → mặc định whisper-small; nghe CẢ VIDEO một lần có mốc giờ rồi chia câu về shot
  // (shot 1–2 giây nghe riêng thì mất ngữ cảnh câu). Đổi mô hình: tham số whisper hoặc biến WHISPER_MO_HINH.
  let asr = null; for (const mh of (ts.chi_proxy ? [] : [ts.whisper || process.env.WHISPER_MO_HINH || "onnx-community/whisper-small", "onnx-community/whisper-base"])) { try { const T = await import("@huggingface/transformers"); asr = await T.pipeline("automatic-speech-recognition", mh, { dtype: "q8" }); log("  whisper sẵn sàng:", mh); break; } catch (e) { log("  không nạp được", mh, String(e.message || e).slice(0, 60)); } }
  if (!asr && !ts.chi_proxy) log("  không có whisper — bỏ lời thoại");
  // ---- M1 đọc hình video thành phẩm (máy có qwen2.5vl): mỗi shot mang nhóm cảnh / bước / bài test / thẩm mỹ → câu nói lúc đó ↔ cảnh (nguồn học M2)
  let DK = null, khongNhin = ""; try { const m = script && !ts.chi_proxy ? await script("doc-khung") : null; if (m && !(await m.coVL(log))) khongNhin = " · KHÔNG ĐỌC HÌNH: Ollama tắt hoặc thiếu " + m.MO_HINH_VL + " — bật Ollama rồi cho học lại"; if (m && !khongNhin) { DK = m; log("  mô hình nhìn sẵn sàng:", m.MO_HINH_VL); } } catch (e) { log("  không tải được doc-khung:", String(e.message || e).slice(0, 60)); }
  // nhãn theo đường dẫn thư mục (chủ đặt tên thư mục theo mục đích và nhãn hàng)
  // (25/09) luật nhận dòng lấy từ app (Bộ não AI › Kho mẫu › Dòng sản phẩm) — trước viết cứng ở đây, /RON/ khớp nhầm mọi tên có "RON"
  let AX = []; try { const r = await goiApp("/hub/cau-hinh-hoc"); AX = ((r.d && r.d.anh_xa_dong) || []).filter((x) => x && x.chua && x.dong); } catch {}
  const boDau = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toUpperCase();
  const nhanDuong = (duong) => { const b = String(duong || "").toUpperCase(), b0 = boDau(duong); const ax = AX.find((x) => b0.includes(boDau(x.chua)));
    return { muc_dich: /ECOMMERCE|BÁN HÀNG|BAN HANG|SALE|TEASER/.test(b) ? "BAN_HANG" : /CREATIVE|BRAND|ĐỊNH VỊ|DINH VI/.test(b) ? "BRAND" : null, dong: ax ? ax.dong : AX.length ? null : /FINEX/.test(b) ? "Finex F300" : /TERRAZY/.test(b) ? "Terrazy" : null }; };
  // ---- 2+3. từng video
  let xong = 0, mau = 0; const loi = [];
  for (const v of video) {
    try {
      // tải một video TikTok thẳng về máy: yt-dlp nếu máy có Python + yt-dlp, không thì tikwm.com (chỉ gửi link công khai, không cookie)
      const taiTikTok = async (x, f) => { if (existsSync(f) && statSync(f).size > 50000) return f;
        if (x.play) { try { const v = await fetch(x.play, { headers: { referer: "https://www.tiktok.com/", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" } }); if (v.ok) { writeFileSync(f, Buffer.from(await v.arrayBuffer())); if (statSync(f).size > 50000) return f; } } catch {} }   // đường dẫn file từ TikTok Studio (chủ kênh)
        const py = spawnSync("python", ["-m", "yt_dlp", "-q", "--no-playlist", "--no-warnings", "-f", "mp4/best", "-o", f, x.link], { encoding: "utf8", timeout: 240000, windowsHide: true });
        if (py.status === 0 && existsSync(f) && statSync(f).size > 50000) return f;
        for (let k = 0; k < 3; k++) { await new Promise((r) => setTimeout(r, 1500 * (k + 1))); const r = await fetch("https://www.tikwm.com/api/?url=" + encodeURIComponent(x.link) + "&hd=1", { headers: { "user-agent": "Mozilla/5.0" } }).catch(() => null); const j = r ? await r.json().catch(() => null) : null; const u = j && j.data && (j.data.hdplay || j.data.play);
          if (u) { const v = await fetch(/^https?:/.test(u) ? u : "https://www.tikwm.com" + u, { headers: { "user-agent": "Mozilla/5.0" } }); if (!v.ok) throw new Error("tikwm tải HTTP " + v.status); writeFileSync(f, Buffer.from(await v.arrayBuffer())); if (statSync(f).size > 50000) return f; }
          if (j && j.code === -1 && !/limit/i.test(j.msg || "")) break; }
        throw new Error("không tải được video (yt-dlp và tikwm đều không trả mp4)"); };
      const taiApp = async (x, f) => { if (existsSync(f) && statSync(f).size > 1000) return f; const u = /^https?:/.test(x.url) ? x.url : app.url.replace(/\/api\/?$/, "").replace(/\/+$/, "") + x.url; const r = await fetch(u, { headers: { "X-Hub-Key": app.khoa } }); if (!r.ok) throw new Error("tải từ kho app HTTP " + r.status); writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f; };
      const tg = {}; let tMoc = Date.now(); const bam = (k) => { tg[k] = +((Date.now() - tMoc) / 1000).toFixed(1); tMoc = Date.now(); };   // ADR-017: đo từng chặng để quyết tách máy
      const f = v.link ? await taiTikTok(v, v.f) : v.drive ? await taiDrive(v, join(KHO_DRIVE, v.id + ((v.ten.match(/.[a-z0-9]+$/i) || [".mp4"])[0]))) : v.url ? await taiApp(v, join(TH, "tp_" + basename(v.ten).replace(/[^a-z0-9_.-]/gi, "_"))) : v.f; const dai = thoiLuong(f); if (!dai) throw new Error("không đọc được thời lượng");
      if (ts.chi_proxy) { let ghi = "";
        if (v.can_proxy !== false) { const u = await taoProxy(f, v.ten); if (!u) throw new Error("ffmpeg không tạo được bản xem"); const r = await goiApp("/hub/thanh-pham/proxy", { method: "POST", body: JSON.stringify({ id: v.app_id, nguon_id: v.nguon_id, proxy_url: u }) }); if (!r.ok) throw new Error("app " + r.status); ghi += "bản xem · "; }
        // ảnh dải bù cho đoạn học từ trước khi có ảnh: 3 khung 448px cách 0,5 giây quanh giữa đoạn (đúng khuôn doc-khung) → thầy đọc bù được
        const anh = []; for (const d of (v.doan || []).slice(0, 120)) { const giua = (Number(d.tu) + Number(d.den)) / 2; const t0 = Math.max(0, Math.max(Number(d.tu), giua - 0.5)); const o = join(TH, "bu_" + xong + "_" + d.i + ".jpg");
          spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", t0.toFixed(2), "-i", f, "-vf", "fps=2,scale=448:-2,tile=3x1", "-frames:v", "1", "-q:v", "4", o], { encoding: "utf8", timeout: 60000, windowsHide: true });
          if (existsSync(o)) { try { anh.push({ i: d.i, url: await up(o, "image/jpeg") }); } catch {} rmSync(o, { force: true }); } }
        if (anh.length) { const r = await goiApp("/hub/mau-doan/anh", { method: "POST", body: JSON.stringify({ doi_tuong_id: v.app_id, anh }) }); ghi += ((r.d && r.d.so) || 0) + " ảnh đoạn"; }
        xong++; log("  ✓", v.ten, "·", ghi || "không có gì phải làm"); if (v.url) rmSync(f, { force: true }); continue; }
      let proxyUrl = null; try { proxyUrl = await taoProxy(f, v.ten); } catch (e) { log("  bản xem lỗi:", String(e.message || e).slice(0, 80)); }
      bam("tai"); let shots = catShot(f, dai); bam("cat"); let motCanh = false;
      // (25/09) video một cảnh (nhiều video TikTok quay liền) vẫn dạy được nhìn + nghe: chia đoạn 5 giây, không ghi mẫu ghép
      if (shots.length < 2) { motCanh = true; shots = []; for (let t = 0; t < dai - 0.5; t += 5) shots.push({ t0: +t.toFixed(2), t1: +Math.min(dai, t + 5).toFixed(2) }); log("  ·", v.ten, "một cảnh — chia", shots.length, "đoạn 5 giây, chỉ học nhìn + nghe"); }
      const KD = join(TH, "k_" + xong); mkdirSync(KD, { recursive: true });
      let cau = []; if (asr) { try { const a = amThanh16k(f); if (a && a.length > 16000) { const o = await asr(a, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, language: "vi", task: "transcribe" }); cau = (o.chunks || []).map((c) => ({ t0: +(c.timestamp && c.timestamp[0]) || 0, t1: +(c.timestamp && c.timestamp[1]) || +(c.timestamp && c.timestamp[0]) + 2, text: suaThuatNgu(String(c.text || "").trim()) })).filter((c) => c.text); } } catch (e) { log("  nghe cả video lỗi:", String(e.message || e).slice(0, 60)); } }
      const giaoCau = cau.map((c) => { let best = -1, bo = 0; shots.forEach((sh, i) => { const o = Math.min(sh.t1, c.t1) - Math.max(sh.t0, c.t0); if (o > bo) { bo = o; best = i; } }); return best; });   // mỗi câu về đúng một shot
      const loiCua = (t0, t1) => { const i = shots.findIndex((sh) => sh.t0 === t0 && sh.t1 === t1); return cau.filter((c, j) => giaoCau[j] === i).map((c) => c.text).join(" ").slice(0, 300); };
      bam("nghe");
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i]; const giua = (s.t0 + s.t1) / 2; const kf = join(KD, i + ".jpg");
        if (i < 40) { spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", giua.toFixed(2), "-i", f, "-frames:v", "1", "-vf", "scale=512:-2", kf], { encoding: "utf8" }); if (existsSync(kf)) s.khung_url = await up(kf, "image/jpeg"); }
        if (cau.length) s.loi = loiCua(s.t0, s.t1) || undefined; else if (asr && s.t1 - s.t0 >= 0.8) { try { const a = amThanh16k(f, s.t0, s.t1 - s.t0); if (a && a.length > 8000) { const o = await asr(a, { language: "vi", task: "transcribe" }); s.loi = String(o.text || "").trim().slice(0, 300); } } catch {} }
        if (s.loi && s.loi.length >= 4 && i < 60) { const af = join(KD, i + ".mp3"); spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", Math.max(0, s.t0 - 0.2).toFixed(2), "-i", f, "-t", Math.min(12, s.t1 - s.t0 + 0.4).toFixed(2), "-vn", "-ac", "1", "-ar", "22050", "-b:a", "32k", af], { encoding: "utf8" }); if (existsSync(af)) { try { s.am_url = await up(af, "audio/mpeg"); } catch {} } }   // ADR-018: đoạn trích ≤ 12 s để người nghe lại câu trong Kho mẫu
        if (gocKy.length) { const kyS = chuKy(f, 2, s.t0, s.t1 - s.t0); if (kyS.length) { let best = null; for (const g of gocKy) { for (let j = 0; j + kyS.length <= g.ky.length; j++) { let d = 0; for (let q = 0; q < kyS.length; q++) d += khoangCach(kyS[q], g.ky[j + q]); d /= kyS.length; if (!best || d < best.d) best = { g, j, d }; } }
          if (best && best.d < 18) { const tu = best.j / 2, den = tu + (s.t1 - s.t0); s.goc = { ten: best.g.ten, tu: +tu.toFixed(2), den: +den.toFixed(2), diem: +(1 - best.d / 18).toFixed(3), doan: best.g.doan, dai: best.g.dai }; } } }
      }
      bam("anh_shot"); let tlVL = null; if (DK) { try { const mt0 = meta[v.ten] || {}; const kq = await DK.docKhung(f, { dai, toiDa: 60, san_pham: nhanDuong(v.nhom).dong || "", chu_de: v.ten.replace(/.[a-z0-9]+$/i, ""), ngu_canh: [mt0.mo_ta ? "Mô tả bài đăng: " + String(mt0.mo_ta).slice(0, 300) : "", cau.length ? "Lời thoại cả video: " + cau.map((c) => c.text).join(" ").slice(0, 500) : "", "Đây là video ĐÃ DỰNG xong để đăng: có nhiều cảnh khác nhau (bối cảnh, vấn đề, sản phẩm, thi công, test, kết quả, người nói) — đừng gán cả video một nhóm."].filter(Boolean).join(" · "), up, thay: DK.taoThay ? DK.taoThay(goiApp) : null, log, thuMuc: join(TH, "vl_" + xong) }); tlVL = kq.timeline; tlVL._msThay = kq.ms_thay || 0;
        for (const sh of shots) { const giua = (sh.t0 + sh.t1) / 2; const d = tlVL.find((x) => giua >= x.tu && giua < x.den) || tlVL[tlVL.length - 1]; if (d) { sh.nhom = d.nhom; sh.buoc = d.buoc; sh.bai_test = d.bai_test; sh.tham_my = d.tham_my; sh.tu_tin = d.tu_tin; sh.mo_ta_vl = d.mo_ta; } } } catch (e) { log("  đọc hình lỗi:", String(e.message || e).slice(0, 80)); } }
      const nd = nhanDuong(v.nhom);
      const mt = meta[v.ten] || {};
      const kichBan = shots.map((x) => x.loi).filter(Boolean).join(" ").trim();   // ADR-011: lời thoại nghe được = kịch bản mẫu bán hàng
      bam("nhin"); if (tlVL && tlVL._msThay) { tg.thay = +(tlVL._msThay / 1000).toFixed(1); tg.nhin = +Math.max(0, tg.nhin - tg.thay).toFixed(1); } log("  thời gian (giây):", JSON.stringify(tg));
      const r = await goiApp("/hub/thanh-pham", { method: "POST", body: JSON.stringify({ proxy_url: proxyUrl, thoi_gian: tg, mot_canh: motCanh, ten: v.ten, nguon_id: v.drive ? v.id : v.ten, nguon, thu_muc: (thuMuc + (v.nhom ? "/" + v.nhom : "")).slice(0, 200), dai: +dai.toFixed(2), shots, timeline: tlVL || undefined, lam_lai: !!ts.lam_lai, luot_xem: mt.luot_xem ?? null, luot_thich: mt.luot_thich ?? null, ngay_dang: mt.ngay_dang || null, link: mt.link || null, kenh: mt.kenh || ts.kenh || null, dong: ts.dong || nd.dong || null, muc_dich: ts.muc_dich || nd.muc_dich || null, doanh_thu: mt.doanh_thu ?? null, luot_ban: mt.luot_ban ?? null, san_pham: mt.san_pham || null, kich_ban: kichBan || null }) });
      if (!r.ok) throw new Error("app " + r.status + " " + ((r.d && r.d.error) || ""));
      xong++; mau += (r.d && r.d.so_mau) || 0; log("  ✓", v.ten, "·", shots.length, "shot ·", shots.filter((s) => s.goc).length, "khớp gốc ·", (r.d && r.d.so_mau) || 0, "mẫu", mt.luot_xem != null ? "· " + mt.luot_xem + " xem" : "");
      rmSync(KD, { recursive: true, force: true }); if (v.url) rmSync(f, { force: true });
    } catch (e) { loi.push(v.ten + ": " + String(e.message || e).slice(0, 80)); log("  ✗", v.ten, String(e.message || e).slice(0, 100)); }
  }
  if (ts.chi_proxy) return { ok: xong > 0, msg: "tạo bản xem " + xong + "/" + video.length + " video" + (loi.length ? " · lỗi: " + loi.slice(0, 2).join(" · ") : "") };
  return { ok: xong > 0, msg: "học " + xong + "/" + video.length + " video thành phẩm · " + mau + " mẫu" + khongNhin + (gocKy.length ? " · " + gocKy.length + " clip gốc" : "") + (loi.length ? " · lỗi: " + loi.slice(0, 2).join(" · ") : "") };
}
