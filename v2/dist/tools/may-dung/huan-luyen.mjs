// HUẤN LUYỆN ĐẦU NHÌN (ADR-009b): học "footage nào khớp gợi ý hình" từ mẫu người chấm (chon_canh).
//   tập mẫu từ /hub/tap-mau → CLIP embed chữ (gợi ý hình + lời bình) & khung hình từng ứng viên → logistic regression trên [cos, t⊙i]
//   → đánh giá top-1 trên tập KIỂM (giữ lại, máy chưa từng học) so với cách quy tắc cos thuần → checkpoint JSON → /hub/upload → /hub/mo-hinh/phien-ban (chờ Trưởng MKT duyệt).
// Chạy được CPU (đầu tuyến tính); GPU thuê chỉ cần khi mẫu nhiều nghìn.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export default async function huanLuyen({ app, goiApp, lenh, dir, log, script, may }) {
  const tn = String((lenh.tham_so || {}).tinh_nang || "chon_canh"); const moId = String((lenh.tham_so || {}).mo_hinh_id || "clip-vit-b16"); const phamVi = String((lenh.tham_so || {}).pham_vi || "chung");   // ADR-012: chung | dong:<dòng> | muc_dich:<mục đích>
  if (tn === "chon_doan" || tn === "ghep_canh") return hocGhep({ app, goiApp, tn, moId, dir, log, may, phamVi });   // ADR-010c
  log("  phạm vi:", phamVi);
  const r = await goiApp("/hub/tap-mau?tinh_nang=" + encodeURIComponent(tn) + "&pham_vi=" + encodeURIComponent(phamVi)); if (!r.ok) return { ok: false, msg: "không lấy được tập mẫu (HTTP " + r.status + ")" };
  const mau = ((r.d && r.d.mau) || []).filter((m) => m.nhan && m.nhan.tai_san_id && (m.ung_vien || []).length >= 2); if (mau.length < 8) return { ok: false, msg: "tập mẫu quá nhỏ (" + mau.length + " cảnh có ≥ 2 ứng viên) — cần người chấm thêm" };
  const mh = await goiApp("/hub/mo-hinh/" + tn); const modelId = (mh.d && mh.d.mo_hinh_mo && mh.d.mo_hinh_mo.model_id) || "Xenova/clip-vit-base-patch16";
  const N = await (await script("nhin")).taoNhin({ model_id: modelId, log });
  const TH = join(dir, "hoc", tn); mkdirSync(join(TH, "src"), { recursive: true }); const taiVe = async (u, ten) => { const f = join(TH, "src", ten); try { readFileSync(f); return f; } catch {} const x = await fetch(u, { headers: /\/media\//.test(u) ? { "X-Hub-Key": app.khoa } : {} }); if (!x.ok) throw new Error("tải " + ten + " HTTP " + x.status); writeFileSync(f, Buffer.from(await x.arrayBuffer())); return f; };
  const { dacTrung, diemDau, cos, khungHinh } = await script("nhin");
  // ---- đặc trưng
  const canh = []; let i = 0;
  for (const m of mau) { i++; if (i % 10 === 0) log("  đặc trưng", i, "/", mau.length);
    try { const t = await N.embText((m.hinh || "") + " " + (m.text || "")); const uv = [];
      for (const u of m.ung_vien) { if (!u.media_url || !u.id) continue; try { const src = await taiVe(u.media_url, u.id + (u.media_type === "IMAGE" ? ".jpg" : ".mp4")); const kh = khungHinh(src, join(TH, "khung"), u.id); uv.push({ id: u.id, f: dacTrung(t, await N.embImage(kh)) }); } catch (e) { log("  bỏ ứng viên", u.id, e.message.slice(0, 80)); } }
      if (uv.length >= 2 && uv.some((u) => u.id === m.nhan.tai_san_id)) canh.push({ id: m.id, tap: m.tap, uv, nhan: m.nhan.tai_san_id }); } catch (e) { log("  bỏ mẫu", m.id, e.message.slice(0, 80)); } }
  const tso = trongSoLuotXem(mau); for (const c of canh) c.w = tso(mau.find((m) => m.id === c.id));
  const hoc = canh.filter((c) => c.tap !== "KIEM"), kiem = canh.filter((c) => c.tap === "KIEM"); const tapKiem = kiem.length >= 4 ? kiem : hoc;
  if (hoc.length < 6) return { ok: false, msg: "không đủ mẫu dùng được sau khi lấy đặc trưng (" + hoc.length + ")" };
  // ---- logistic regression (SGD, L2) — dương = ứng viên người chọn, âm = ứng viên còn lại (cân trọng số)
  const D = hoc[0].uv[0].f.length; const w = new Float64Array(D); let b = 0; const lr = 0.05, l2 = 1e-4, EPOCH = 150;
  const pairs = []; for (const c of hoc) for (const u of c.uv) pairs.push({ f: u.f, y: u.id === c.nhan ? 1 : 0, w: c.w || 1 }); const nPos = pairs.filter((p) => p.y).length, nNeg = pairs.length - nPos; const wPos = nNeg / Math.max(1, nPos);
  for (let e = 0; e < EPOCH; e++) { for (let k = pairs.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pairs[k], pairs[j]] = [pairs[j], pairs[k]]; }
    for (const p of pairs) { let z = b; for (let k = 0; k < D; k++) z += w[k] * p.f[k]; const s = 1 / (1 + Math.exp(-z)); const g = (s - p.y) * (p.y ? wPos : 1) * (p.w || 1); for (let k = 0; k < D; k++) w[k] -= lr * (g * p.f[k] + l2 * w[k]); b -= lr * g; } }
  const dau = { model_id: modelId, w: Array.from(w).map((x) => +x.toFixed(6)), b: +b.toFixed(6), dims: D, tinh_nang: tn };
  const top1 = (tap, cham) => { let dung = 0; for (const c of tap) { let best = null, bs = -1e9; for (const u of c.uv) { const sc = cham(u); if (sc > bs) { bs = sc; best = u.id; } } if (best === c.nhan) dung++; } return tap.length ? Math.round(dung / tap.length * 100) : 0; };
  const diem = top1(tapKiem, (u) => diemDau(dau, u.f)); const diemTruoc = top1(tapKiem, (u) => u.f[0]); const diemHoc = top1(hoc, (u) => diemDau(dau, u.f));
  // ADR-013: ví dụ để người "xem thử" trước khi bật — 6 cảnh kiểm: người chọn / bản mới chọn / quy tắc cũ chọn
  const chonTot = (c, cham) => { let best = null, bs = -1e9; for (const u of c.uv) { const sc = cham(u); if (sc > bs) { bs = sc; best = u.id; } } return best; };
  const viDu = tapKiem.slice(0, 6).map((c) => { const m = mau.find((x) => x.id === c.id) || {}; return { mau_id: c.id, hinh: m.hinh || "", text: (m.text || "").slice(0, 120), nguoi: c.nhan, moi: chonTot(c, (u) => diemDau(dau, u.f)), cu: chonTot(c, (u) => u.f[0]) }; });
  log("  kết quả: đầu học " + diem + "/100 trên " + tapKiem.length + " cảnh kiểm (cos thuần " + diemTruoc + ", tập học " + diemHoc + ")");
  // ---- checkpoint → app
  const f = join(TH, "dau-" + Date.now() + ".json"); writeFileSync(f, JSON.stringify({ ...dau, danh_gia: { diem, diem_truoc: diemTruoc, n_hoc: hoc.length, n_kiem: tapKiem.length, luc: new Date().toISOString(), may } }));
  const buf = readFileSync(f); const up = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=application/json", { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": "application/json", "Content-Length": String(buf.length) }, body: buf }); const uj = await up.json().catch(() => ({})); if (!up.ok) return { ok: false, msg: "không tải checkpoint lên (" + up.status + " " + (uj.error || "") + ")" };
  const pb = await goiApp("/hub/mo-hinh/phien-ban", { method: "POST", body: JSON.stringify({ mo_hinh_id: moId, tinh_nang: tn, pham_vi: phamVi, checkpoint_url: uj.media_url, may, danh_gia: { diem, diem_truoc: diemTruoc, n_hoc: hoc.length, n_kiem: tapKiem.length, vi_du: viDu, ghi_chu: "tập học " + diemHoc + "/100 · " + pairs.length + " cặp" } }) });
  if (!pb.ok) return { ok: false, msg: "app không nhận phiên bản (HTTP " + pb.status + ")" };
  return { ok: true, msg: "đầu " + tn + " " + (pb.d && pb.d.phien_ban) + ": " + diem + "/100 trên " + tapKiem.length + " cảnh kiểm (cos thuần " + diemTruoc + ") — chờ Trưởng MKT duyệt" };
}

// ===== ADR-010d — lượt xem làm trọng số: so với trung vị CÙNG KÊNH; không có lượt xem (Drive/local, chỉnh ghép) = 1 =====
// ADR-011: có doanh thu (Kalodata) thì doanh thu là thước đo, không thì lượt xem
const soDo = (m) => { const dt = m.doanh_thu ?? (m.dau_vao && m.dau_vao.doanh_thu); if (dt != null) return dt * 100; const v = m.luot_xem ?? (m.dau_vao && m.dau_vao.luot_xem); return v == null ? null : v; };
export function trongSoLuotXem(mau) { const theoKenh = {}; for (const m of mau) { const v = soDo(m); if (v == null) continue; const k = (m.kenh ?? (m.dau_vao && m.dau_vao.kenh)) || "_"; (theoKenh[k] = theoKenh[k] || []).push(v); }
  const tv = {}; for (const [k, a] of Object.entries(theoKenh)) { a.sort((x, y) => x - y); tv[k] = a[Math.floor(a.length / 2)]; }
  return (m) => { if (!m) return 1; const v = soDo(m); if (v == null) return 1; const k = (m.kenh ?? (m.dau_vao && m.dau_vao.kenh)) || "_"; const med = tv[k] || v; return Math.max(0.4, Math.min(2.5, Math.log10(v + 10) / Math.log10(med + 10))); }; }

// ===== ADR-010c — chọn đoạn (logistic trên cửa sổ) & ghép (thống kê có trọng số) =====
const DT_DOAN = ["net", "dong", "sang", "vi_tri", "gan_dau", "dong_net"];
export function cuaSo(doan, dai, can, buoc = 0.5) { const ra = []; if (!doan || !doan.length) return ra; const het = Math.max(0, (dai || doan[doan.length - 1].t + 0.5) - can);
  for (let tu = 0; tu <= het + 1e-6; tu += buoc) { const den = tu + can; const trong = doan.filter((x) => x.t >= tu - 0.01 && x.t < den); if (!trong.length) continue; const tb = (k) => trong.reduce((a, x) => a + (x[k] || 0), 0) / trong.length; const vt = dai ? tu / dai : 0;
    const net = tb("net"), dong = tb("dong"); ra.push({ tu: +tu.toFixed(2), den: +den.toFixed(2), f: [net, dong, tb("sang"), vt, 1 - Math.abs(vt - 0.3), dong * net] }); }
  return ra; }
export const diemCuaSo = (dau, f) => { let z = dau.b || 0; for (let k = 0; k < f.length; k++) z += (dau.w[k] || 0) * f[k]; return z; };
const iou = (a, b) => { const g = Math.max(0, Math.min(a.den, b.den) - Math.max(a.tu, b.tu)); const h = Math.max(a.den, b.den) - Math.min(a.tu, b.tu); return h > 0 ? g / h : 0; };

async function hocGhep({ app, goiApp, tn, moId, dir, log, may, phamVi = "chung" }) {
  const r = await goiApp("/hub/tap-mau?tinh_nang=" + tn + "&pham_vi=" + encodeURIComponent(phamVi)); if (!r.ok) return { ok: false, msg: "không lấy được tập mẫu (HTTP " + r.status + ")" };
  const mau = (r.d && r.d.mau) || []; const tso = trongSoLuotXem(mau);
  let dau, diem, diemTruoc, nHoc, nKiem, ghiChu;
  if (tn === "chon_doan") {
    const mauOk = mau.filter((m) => m.dau_vao && Array.isArray(m.dau_vao.doan) && m.dau_vao.doan.length >= 3 && m.nhan && m.nhan.den > m.nhan.tu).map((m) => ({ ...m, cs: cuaSo(m.dau_vao.doan, m.dau_vao.dai, Math.max(0.5, +(m.nhan.den - m.nhan.tu).toFixed(2))), w: tso(m) })).filter((m) => m.cs.length >= 2);
    const hoc = mauOk.filter((m) => m.tap !== "KIEM"), kiem = mauOk.filter((m) => m.tap === "KIEM"); const tapKiem = kiem.length >= 4 ? kiem : hoc; if (hoc.length < 6) return { ok: false, msg: "chưa đủ mẫu chọn đoạn (" + hoc.length + ")" };
    const D = DT_DOAN.length; const w = new Float64Array(D); let b = 0; const pairs = []; for (const m of hoc) for (const c of m.cs) pairs.push({ f: c.f, y: iou(c, m.nhan) >= 0.6 ? 1 : 0, w: m.w });
    const nPos = pairs.filter((p) => p.y).length || 1, wPos = (pairs.length - nPos) / nPos;
    for (let e = 0; e < 300; e++) for (const p of pairs) { let z = b; for (let k = 0; k < D; k++) z += w[k] * p.f[k]; const s = 1 / (1 + Math.exp(-z)); const g = (s - p.y) * (p.y ? wPos : 1) * p.w; for (let k = 0; k < D; k++) w[k] -= 0.05 * (g * p.f[k] + 1e-4 * w[k]); b -= 0.05 * g; }
    dau = { tinh_nang: tn, dac_trung: DT_DOAN, w: Array.from(w).map((x) => +x.toFixed(5)), b: +b.toFixed(5) };
    const top = (tap, cham) => { let dung = 0; for (const m of tap) { let best = null, bs = -1e9; for (const c of m.cs) { const sc = cham(c.f); if (sc > bs) { bs = sc; best = c; } } if (best && iou(best, m.nhan) >= 0.5) dung++; } return tap.length ? Math.round(dung / tap.length * 100) : 0; };
    diem = top(tapKiem, (f) => diemCuaSo(dau, f)); diemTruoc = top(tapKiem, (f) => f[0] + 0.5 * f[1]); nHoc = hoc.length; nKiem = tapKiem.length; ghiChu = "chọn đoạn: IoU≥0,5 với đoạn người/thành phẩm chọn";
  } else {
    const mauOk = mau.filter((m) => m.nhan && Array.isArray(m.nhan.shots) && m.nhan.shots.length >= 2).map((m) => ({ ...m, w: tso(m) }));
    const hoc = mauOk.filter((m) => m.tap !== "KIEM"), kiem = mauOk.filter((m) => m.tap === "KIEM"); const tapKiem = kiem.length >= 2 ? kiem : hoc; if (hoc.length < 3) return { ok: false, msg: "chưa đủ mẫu ghép (" + hoc.length + ")" };
    const dsDai = []; const chuyen = {}; for (const m of hoc) { const sh = m.nhan.shots; for (let i = 0; i < sh.length; i++) { dsDai.push({ v: +sh[i].dai, w: m.w }); if (i && sh[i - 1].co_canh && sh[i].co_canh) { const a = sh[i - 1].co_canh, c = sh[i].co_canh; chuyen[a] = chuyen[a] || {}; chuyen[a][c] = (chuyen[a][c] || 0) + m.w; } } }
    dsDai.sort((x, y) => x.v - y.v); const tongW = dsDai.reduce((a, x) => a + x.w, 0); const phanVi = (q) => { let acc = 0; for (const x of dsDai) { acc += x.w; if (acc >= q * tongW) return x.v; } return dsDai[dsDai.length - 1].v; };
    for (const a of Object.keys(chuyen)) { const t = Object.values(chuyen[a]).reduce((x, y) => x + y, 0); for (const c of Object.keys(chuyen[a])) chuyen[a][c] = +(chuyen[a][c] / t).toFixed(3); }
    dau = { tinh_nang: tn, dai_tb: +phanVi(0.5).toFixed(2), dai_min: +Math.max(0.8, phanVi(0.15)).toFixed(2), dai_max: +Math.max(phanVi(0.85), phanVi(0.5) + 0.5).toFixed(2), chuyen, n_shot: dsDai.length };
    const loi = (tap, du) => { const e = []; for (const m of tap) { const tb = m.nhan.shots.reduce((a, x) => a + (+x.dai), 0) / m.nhan.shots.length; e.push(Math.abs(du - tb) / Math.max(0.5, tb)); } return e.length ? Math.max(0, Math.round(100 - 100 * e.reduce((a, x) => a + x, 0) / e.length)) : 0; };
    diem = loi(tapKiem, dau.dai_tb); diemTruoc = loi(tapKiem, 2.8); nHoc = hoc.length; nKiem = tapKiem.length; ghiChu = "ghép: độ lệch độ dài shot trung vị so với video thành phẩm/đã chỉnh (luật cũ 2,8s)";
  }
  log("  " + tn + ": " + diem + "/100 trên " + nKiem + " mẫu kiểm (luật cũ " + diemTruoc + ")");
  const TH = join(dir, "hoc", tn); mkdirSync(TH, { recursive: true }); const f = join(TH, "dau-" + Date.now() + ".json"); writeFileSync(f, JSON.stringify({ ...dau, danh_gia: { diem, diem_truoc: diemTruoc, n_hoc: nHoc, n_kiem: nKiem, luc: new Date().toISOString(), may } }));
  const buf = readFileSync(f); const up = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=application/json", { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": "application/json", "Content-Length": String(buf.length) }, body: buf }); const uj = await up.json().catch(() => ({})); if (!up.ok) return { ok: false, msg: "tải checkpoint lỗi " + up.status };
  const pb = await goiApp("/hub/mo-hinh/phien-ban", { method: "POST", body: JSON.stringify({ mo_hinh_id: moId, tinh_nang: tn, pham_vi: phamVi, checkpoint_url: uj.media_url, may, danh_gia: { diem, diem_truoc: diemTruoc, n_hoc: nHoc, n_kiem: nKiem, ghi_chu: ghiChu + (phamVi !== "chung" ? " · phạm vi " + phamVi : "") } }) });
  if (!pb.ok) return { ok: false, msg: "app không nhận phiên bản (HTTP " + pb.status + ")" };
  return { ok: true, msg: tn + " " + (pb.d && pb.d.phien_ban) + ": " + diem + "/100 (luật cũ " + diemTruoc + ") — chờ Trưởng MKT duyệt" };
}
