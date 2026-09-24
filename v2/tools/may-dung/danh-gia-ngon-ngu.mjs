// XUẤT TẬP MẪU NGÔN NGỮ & ĐÁNH GIÁ PHIÊN BẢN OLLAMA (ADR-009c-4)
//   node may-dung.mjs xuat-tap-mau [tinh_nang]        → out/hoc/ngon-ngu/<tinh_nang>.train.jsonl + .kiem.jsonl (chạy huan-luyen-ngon-ngu.py tại máy học có GPU ≥ 8 GB — cai-hoc-ngon-ngu.ps1 — hoặc GPU thuê)
//   node may-dung.mjs phien-ban <ollama-model> [tinh_nang] → chạy model trên tập KIỂM, đo giống với bài người → gửi /hub/mo-hinh/phien-ban (Trưởng MKT duyệt)
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const tach = (s) => new Set(String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1));
const giong = (a, b) => { const A = tach(a), B = tach(b); if (!A.size && !B.size) return 1; let g = 0; A.forEach((w) => { if (B.has(w)) g++; }); return g / (A.size + B.size - g); };

export default async function chay({ goiApp, lenh, dir, log, may }) {
  const tn = String((lenh.tham_so || {}).tinh_nang || "soan_nhap_agent"); const model = (lenh.tham_so || {}).model_id || ""; const xuat = !!(lenh.tham_so || {}).xuat;
  const r = await goiApp("/hub/tap-mau-ngon-ngu?tinh_nang=" + encodeURIComponent(tn)); if (!r.ok) return { ok: false, msg: "không lấy được tập mẫu (HTTP " + r.status + ")" };
  const mau = ((r.d && r.d.mau) || []).filter((m) => m.user); const coNguoi = mau.filter((m) => m.nguoi); const hoc = coNguoi.filter((m) => m.tap !== "KIEM"), kiem = coNguoi.filter((m) => m.tap === "KIEM");
  const TH = join(dir, "hoc", "ngon-ngu"); mkdirSync(TH, { recursive: true });
  if (xuat || !model) {
    const dong = (ds) => ds.map((m) => JSON.stringify({ messages: [{ role: "system", content: m.system }, { role: "user", content: m.user }, { role: "assistant", content: m.nguoi }] })).join("\n");
    writeFileSync(join(TH, tn + ".train.jsonl"), dong(hoc)); writeFileSync(join(TH, tn + ".kiem.jsonl"), dong(kiem));
    log("  đã xuất", hoc.length, "mẫu học +", kiem.length, "mẫu kiểm →", TH); log("  bước tiếp: máy học có GPU ≥ 8 GB (đã chạy cai-hoc-ngon-ngu.ps1) chạy HUAN-LUYEN.bat " + join(TH, tn + ".train.jsonl") + " (hoặc đưa file lên GPU thuê: python huan-luyen-ngon-ngu.py " + tn + ".train.jsonl) → GGUF → ollama create kingsmen-qwen:v1 → node may-dung.mjs phien-ban kingsmen-qwen:v1 " + tn);
    if (!model) return { ok: true, msg: "xuất " + hoc.length + " học / " + kiem.length + " kiểm" };
  }
  // đánh giá model trên tập kiểm
  const tap = (kiem.length >= 5 ? kiem : coNguoi).slice(0, 20); if (tap.length < 3) return { ok: false, msg: "chưa đủ mẫu có bài người duyệt để đánh giá (" + tap.length + ")" };
  let ok = false; try { ok = (await fetch("http://localhost:11434/api/tags")).ok; } catch {} if (!ok) return { ok: false, msg: "máy chưa chạy Ollama" };
  let sMoi = 0, sCu = 0, n = 0; for (const m of tap) { try { const res = await fetch("http://localhost:11434/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: false, options: { temperature: 0.3 }, messages: [{ role: "system", content: m.system }, { role: "user", content: m.user }] }) }); const j = await res.json(); if (!res.ok) throw new Error(j.error || res.status); const t = (j.message || {}).content || ""; sMoi += giong(t, m.nguoi); sCu += giong(m.may, m.nguoi); n++; log("  mẫu", n, "/", tap.length, "giống người:", (giong(t, m.nguoi) * 100).toFixed(0) + "%"); } catch (e) { log("  lỗi mẫu:", String(e.message || e).slice(0, 80)); } }
  if (!n) return { ok: false, msg: "model không trả lời được mẫu nào" };
  const diem = Math.round(sMoi / n * 100), diemTruoc = Math.round(sCu / n * 100);
  const pb = await goiApp("/hub/mo-hinh/phien-ban", { method: "POST", body: JSON.stringify({ mo_hinh_id: "qwen2-5-7b", tinh_nang: tn, model_id: model, may, phien_ban: model.replace(/[^a-z0-9.:-]/gi, "").slice(0, 40), danh_gia: { diem, diem_truoc: diemTruoc, n_hoc: hoc.length, n_kiem: n, ghi_chu: "giống bài người trên tập kiểm; API hiện tại " + diemTruoc } }) });
  if (!pb.ok) return { ok: false, msg: "app không nhận phiên bản (HTTP " + pb.status + ")" };
  return { ok: true, msg: model + ": giống người " + diem + "/100 trên " + n + " mẫu kiểm (API " + diemTruoc + ") — chờ Trưởng MKT duyệt" };
}
