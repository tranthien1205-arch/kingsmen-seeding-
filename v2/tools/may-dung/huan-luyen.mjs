// HUẤN LUYỆN ĐẦU NHÌN (ADR-009b): học "footage nào khớp gợi ý hình" từ mẫu người chấm (chon_canh).
//   tập mẫu từ /hub/tap-mau → CLIP embed chữ (gợi ý hình + lời bình) & khung hình từng ứng viên → logistic regression trên [cos, t⊙i]
//   → đánh giá top-1 trên tập KIỂM (giữ lại, máy chưa từng học) so với cách quy tắc cos thuần → checkpoint JSON → /hub/upload → /hub/mo-hinh/phien-ban (chờ Trưởng MKT duyệt).
// Chạy được CPU (đầu tuyến tính); GPU thuê chỉ cần khi mẫu nhiều nghìn.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export default async function huanLuyen({ app, goiApp, lenh, dir, log, script, may }) {
  const tn = String((lenh.tham_so || {}).tinh_nang || "chon_canh"); const moId = String((lenh.tham_so || {}).mo_hinh_id || "clip-vit-b16");
  const r = await goiApp("/hub/tap-mau?tinh_nang=" + encodeURIComponent(tn)); if (!r.ok) return { ok: false, msg: "không lấy được tập mẫu (HTTP " + r.status + ")" };
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
  const hoc = canh.filter((c) => c.tap !== "KIEM"), kiem = canh.filter((c) => c.tap === "KIEM"); const tapKiem = kiem.length >= 4 ? kiem : hoc;
  if (hoc.length < 6) return { ok: false, msg: "không đủ mẫu dùng được sau khi lấy đặc trưng (" + hoc.length + ")" };
  // ---- logistic regression (SGD, L2) — dương = ứng viên người chọn, âm = ứng viên còn lại (cân trọng số)
  const D = hoc[0].uv[0].f.length; const w = new Float64Array(D); let b = 0; const lr = 0.05, l2 = 1e-4, EPOCH = 150;
  const pairs = []; for (const c of hoc) for (const u of c.uv) pairs.push({ f: u.f, y: u.id === c.nhan ? 1 : 0 }); const nPos = pairs.filter((p) => p.y).length, nNeg = pairs.length - nPos; const wPos = nNeg / Math.max(1, nPos);
  for (let e = 0; e < EPOCH; e++) { for (let k = pairs.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pairs[k], pairs[j]] = [pairs[j], pairs[k]]; }
    for (const p of pairs) { let z = b; for (let k = 0; k < D; k++) z += w[k] * p.f[k]; const s = 1 / (1 + Math.exp(-z)); const g = (s - p.y) * (p.y ? wPos : 1); for (let k = 0; k < D; k++) w[k] -= lr * (g * p.f[k] + l2 * w[k]); b -= lr * g; } }
  const dau = { model_id: modelId, w: Array.from(w).map((x) => +x.toFixed(6)), b: +b.toFixed(6), dims: D, tinh_nang: tn };
  const top1 = (tap, cham) => { let dung = 0; for (const c of tap) { let best = null, bs = -1e9; for (const u of c.uv) { const sc = cham(u); if (sc > bs) { bs = sc; best = u.id; } } if (best === c.nhan) dung++; } return tap.length ? Math.round(dung / tap.length * 100) : 0; };
  const diem = top1(tapKiem, (u) => diemDau(dau, u.f)); const diemTruoc = top1(tapKiem, (u) => u.f[0]); const diemHoc = top1(hoc, (u) => diemDau(dau, u.f));
  log("  kết quả: đầu học " + diem + "/100 trên " + tapKiem.length + " cảnh kiểm (cos thuần " + diemTruoc + ", tập học " + diemHoc + ")");
  // ---- checkpoint → app
  const f = join(TH, "dau-" + Date.now() + ".json"); writeFileSync(f, JSON.stringify({ ...dau, danh_gia: { diem, diem_truoc: diemTruoc, n_hoc: hoc.length, n_kiem: tapKiem.length, luc: new Date().toISOString(), may } }));
  const buf = readFileSync(f); const up = await fetch(app.url.replace(/\/+$/, "") + "/hub/upload?type=application/json", { method: "POST", headers: { "X-Hub-Key": app.khoa, "Content-Type": "application/json", "Content-Length": String(buf.length) }, body: buf }); const uj = await up.json().catch(() => ({})); if (!up.ok) return { ok: false, msg: "không tải checkpoint lên (" + up.status + " " + (uj.error || "") + ")" };
  const pb = await goiApp("/hub/mo-hinh/phien-ban", { method: "POST", body: JSON.stringify({ mo_hinh_id: moId, tinh_nang: tn, checkpoint_url: uj.media_url, may, danh_gia: { diem, diem_truoc: diemTruoc, n_hoc: hoc.length, n_kiem: tapKiem.length, ghi_chu: "tập học " + diemHoc + "/100 · " + pairs.length + " cặp" } }) });
  if (!pb.ok) return { ok: false, msg: "app không nhận phiên bản (HTTP " + pb.status + ")" };
  return { ok: true, msg: "đầu " + tn + " " + (pb.d && pb.d.phien_ban) + ": " + diem + "/100 trên " + tapKiem.length + " cảnh kiểm (cos thuần " + diemTruoc + ") — chờ Trưởng MKT duyệt" };
}
