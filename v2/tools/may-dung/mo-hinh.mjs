// MÔ HÌNH NGÔN NGỮ MỞ CHẠY BÓNG (ADR-009a): máy ghép lấy mẫu của các tính năng đang BÓNG/MỞ, chạy Ollama tại máy với cùng đầu vào,
// trả đầu ra về /hub/bong để app so với mô hình API (giống ↔ điểm sẵn sàng). Không dùng kết quả cho việc thật — chỉ để học & chấm.
// Cần Ollama chạy tại máy (https://ollama.com) và đã `ollama pull <model>` (mặc định qwen2.5:7b).
export default async function bong({ goiApp, lenh, log }) {
  const r = await goiApp("/hub/viec/bong"); if (!r.ok) return { ok: false, msg: "không lấy được mẫu bóng (HTTP " + r.status + ")" };
  const ds = (r.d && r.d.viec) || []; if (!ds.length) return { ok: true, msg: "không có mẫu cần chạy bóng" };
  let ol = false; try { const p = await fetch("http://localhost:11434/api/tags"); ol = p.ok; } catch {} if (!ol) return { ok: false, msg: "máy chưa chạy Ollama (localhost:11434)" };
  const dong = []; let i = 0;
  for (const v of ds) { i++; const model = (v.mo_hinh && v.mo_hinh.model_id) || "qwen2.5:7b"; const t0 = Date.now(); log("  bóng", i, "/", ds.length, v.tinh_nang, model);
    try { const res = await fetch("http://localhost:11434/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: false, options: { temperature: 0.4 }, messages: [...(v.dau_vao.system ? [{ role: "system", content: v.dau_vao.system }] : []), { role: "user", content: v.dau_vao.user || "" }] }) });
      const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error((j.error || "HTTP " + res.status).slice(0, 160));
      dong.push({ mau_id: v.mau_id, dau_ra_mo: ((j.message || {}).content || "").slice(0, 6000), mo_hinh_id: v.mo_hinh.id, model_id: model, tokens_vao: j.prompt_eval_count || 0, tokens_ra: j.eval_count || 0, ms: Date.now() - t0 });
    } catch (e) { dong.push({ mau_id: v.mau_id, dau_ra_mo: "", mo_hinh_id: v.mo_hinh.id, model_id: model, loi: String(e.message || e).slice(0, 200), ms: Date.now() - t0 }); } }
  const n = await goiApp("/hub/bong", { method: "POST", body: JSON.stringify({ dong }) }); if (!n.ok) return { ok: false, msg: "app không nhận kết quả bóng (HTTP " + n.status + ")" };
  const loi = dong.filter((d) => d.loi).length; return { ok: loi < dong.length, msg: "bóng " + (dong.length - loi) + "/" + dong.length + " mẫu" + (loi ? " · lỗi: " + dong.find((d) => d.loi).loi : "") };
}
