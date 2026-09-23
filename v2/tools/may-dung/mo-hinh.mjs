// MÔ HÌNH NGÔN NGỮ MỞ TRÊN MÁY GHÉP (ADR-009a/009c) — chạy Ollama tại máy.
//   · lệnh mo_hinh_chay: lấy việc MỞ (/hub/viec/ai) → trả /hub/ai-xong → app đi tiếp (soạn nháp, chấm ý tưởng, báo cáo, ✨ người bấm)
//   · lệnh mo_hinh_bong: lấy mẫu BÓNG (/hub/viec/bong) → trả /hub/bong → app chấm độ giống với mô hình API
// Cần Ollama chạy tại máy (https://ollama.com) và đã `ollama pull <model>`.
async function coOllama() { try { const p = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) }); return p.ok ? (await p.json()) : null; } catch { return null; } }
async function chat(model, system, messages, maxTokens) {
  const res = await fetch("http://localhost:11434/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: false, options: { temperature: 0.4, num_predict: Math.min(4000, maxTokens || 2000) }, messages: [...(system ? [{ role: "system", content: system }] : []), ...messages] }) });
  const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(String(j.error || "HTTP " + res.status).slice(0, 200));
  return { text: ((j.message || {}).content || ""), vao: j.prompt_eval_count || 0, ra: j.eval_count || 0 };
}
// model chưa pull → thử pull một lần (chậm, nhưng tự phục vụ)
async function chacCoModel(tags, model, log) { if ((tags.models || []).some((m) => m.name === model || m.name === model + ":latest")) return true; log("  ollama pull", model, "(lần đầu, có thể vài phút)"); const r = await fetch("http://localhost:11434/api/pull", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: model, stream: false }) }); return r.ok; }

export default async function chay({ goiApp, lenh, log }) {
  const tags = await coOllama(); if (!tags) return { ok: false, msg: "máy chưa chạy Ollama (localhost:11434)" };
  if (lenh.viec === "mo_hinh_chay") {
    const r = await goiApp("/hub/viec/ai"); if (!r.ok) return { ok: false, msg: "không lấy được việc AI (HTTP " + r.status + ")" };
    const ds = (r.d && r.d.viec) || []; if (!ds.length) return { ok: true, msg: "không có việc AI mở chờ" };
    const dong = []; let i = 0;
    for (const v of ds) { i++; const model = (v.mo_hinh && v.mo_hinh.model_id) || "qwen2.5:7b"; const t0 = Date.now(); log("  việc", i, "/", ds.length, v.tinh_nang, model);
      try { if (!(await chacCoModel(tags, model, log))) throw new Error("không pull được model " + model); const dv = v.dau_vao || {}; const k = await chat(model, dv.system, dv.messages || [], dv.max_tokens); dong.push({ id: v.id, dau_ra: k.text, model_id: model, tokens_vao: k.vao, tokens_ra: k.ra, ms: Date.now() - t0 }); }
      catch (e) { dong.push({ id: v.id, dau_ra: "", model_id: model, loi: String(e.message || e).slice(0, 200), ms: Date.now() - t0 }); } }
    const n = await goiApp("/hub/ai-xong", { method: "POST", body: JSON.stringify({ dong }) }); if (!n.ok) return { ok: false, msg: "app không nhận kết quả (HTTP " + n.status + ")" };
    const loi = dong.filter((d) => d.loi).length; return { ok: loi < dong.length, msg: "mô hình mở làm " + (dong.length - loi) + "/" + dong.length + " việc" + (loi ? " · lỗi: " + dong.find((d) => d.loi).loi : "") };
  }
  // bóng
  const r = await goiApp("/hub/viec/bong"); if (!r.ok) return { ok: false, msg: "không lấy được mẫu bóng (HTTP " + r.status + ")" };
  const ds = (r.d && r.d.viec) || []; if (!ds.length) return { ok: true, msg: "không có mẫu cần chạy bóng" };
  const dong = []; let i = 0;
  for (const v of ds) { i++; const model = (v.mo_hinh && v.mo_hinh.model_id) || "qwen2.5:7b"; const t0 = Date.now(); log("  bóng", i, "/", ds.length, v.tinh_nang, model);
    try { if (!(await chacCoModel(tags, model, log))) throw new Error("không pull được model " + model); const k = await chat(model, v.dau_vao.system, [{ role: "user", content: v.dau_vao.user || "" }], 2000); dong.push({ mau_id: v.mau_id, dau_ra_mo: k.text.slice(0, 6000), mo_hinh_id: v.mo_hinh.id, model_id: model, tokens_vao: k.vao, tokens_ra: k.ra, ms: Date.now() - t0 }); }
    catch (e) { dong.push({ mau_id: v.mau_id, dau_ra_mo: "", mo_hinh_id: v.mo_hinh.id, model_id: model, loi: String(e.message || e).slice(0, 200), ms: Date.now() - t0 }); } }
  const n = await goiApp("/hub/bong", { method: "POST", body: JSON.stringify({ dong }) }); if (!n.ok) return { ok: false, msg: "app không nhận kết quả bóng (HTTP " + n.status + ")" };
  const loi = dong.filter((d) => d.loi).length; return { ok: loi < dong.length, msg: "bóng " + (dong.length - loi) + "/" + dong.length + " mẫu" + (loi ? " · lỗi: " + dong.find((d) => d.loi).loi : "") };
}
