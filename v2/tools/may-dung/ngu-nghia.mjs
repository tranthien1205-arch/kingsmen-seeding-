// DỰNG THEO NGHĨA (ADR-015, 24/09) — dùng chung cho dung-video (dựng) và huan-luyen (học, tái dựng):
//   M2 docLoi   : mỗi câu/cảnh → ý (VAN_DE · GIOI_THIEU · CACH_LAM · CHUNG_MINH · KET_QUA · KEU_GOI) + bước thi công được nhắc (tập đóng =
//                 các bước có trong dòng thời gian footage / quy trình chuẩn). qwen2.5:7b trên máy học; không có Ollama → luật từ khoá.
//   M3 dacTrung / diem / keHoach : chấm mọi đoạn footage (dòng thời gian ADR-014a) cho từng cảnh bằng 6 đặc trưng
//                 [khớp bước, khớp ý, thẩm mỹ, nét, đủ dài, chưa dùng] × trọng số (mặc định hoặc đầu học ghep_ngu_nghia đã duyệt).
//   M5 kiemDinh : luật cứng — đảo trình tự thi công, thiếu bước bắt buộc (kịch bản hướng dẫn), đoạn mờ, cảnh chốt xấu, lặp đoạn.
// Không bịa: không có dòng thời gian thì trả null để bộ dựng dùng cách cũ.
const OLLAMA = process.env.OLLAMA_HOST ? (/^https?:/.test(process.env.OLLAMA_HOST) ? process.env.OLLAMA_HOST : "http://" + process.env.OLLAMA_HOST) : "http://127.0.0.1:11434";
export const MO_HINH_LOI = process.env.MO_HINH_LOI || "qwen2.5:7b";
export const Y = ["VAN_DE", "GIOI_THIEU", "CACH_LAM", "CHUNG_MINH", "KET_QUA", "KEU_GOI"];
export const W_MAC_DINH = { buoc: 2.0, y: 1.0, tham_my: 1.0, net: 0.8, du_dai: 0.6, chua_dung: 0.8, b: 0 };
const bo = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

/** Ý hợp với loại bước nào (theo tên bước) — dùng khi câu không nhắc bước cụ thể. */
export function yHopBuoc(y, buoc) { const b = bo(buoc);
  if (y === "GIOI_THIEU") return /gioi thieu|bao bi|san pham/.test(b) ? 1 : 0.2;
  if (y === "KET_QUA" || y === "KEU_GOI") return /ket qua|hoan thien|truoc.?sau|thanh pham/.test(b) ? 1 : /lau|gat|miet/.test(b) ? 0.5 : 0.1;
  if (y === "VAN_DE") return /hien trang|chuan bi|truoc thi cong|cu\b|moc|nut|tham/.test(b) ? 1 : 0.2;
  if (y === "CACH_LAM" || y === "CHUNG_MINH") return /gioi thieu|bao bi|nguoi noi|khac/.test(b) ? 0.2 : 1;
  return 0.5; }

function yTuKhoa(t) { const b = bo(t);
  if (/lien he|inbox|dat hang|mua ngay|goi ngay|hotline|gio hang|dang ky/.test(b)) return "KEU_GOI";
  if (/ket qua|sau khi|hoan thien|nhu moi|sach bong|dep|ben mau/.test(b)) return "KET_QUA";
  if (/buoc|dau tien|tiep theo|sau do|tron|bom|gat|tret|lau|ve sinh|thi cong/.test(b)) return "CACH_LAM";
  if (/\?|ban co|lo lang|moc|nut|tham|bong troc|den xi|xuong cap/.test(b)) return "VAN_DE";
  if (/kingsmen|san pham|gioi thieu/.test(b)) return "GIOI_THIEU";
  return "CHUNG_MINH"; }
function buocTuKhoa(t, dsBuoc) { const b = bo(t); let tot = null, d0 = 0; for (const x of dsBuoc) { const w = bo(x).split(/[^a-z0-9]+/).filter((s) => s.length > 2); const d = w.filter((s) => b.includes(s)).length / Math.max(1, w.length); if (d > d0) { d0 = d; tot = x; } } return d0 >= 0.34 ? tot : null; }

/** M2: gắn ý + bước cho từng cảnh. viDu = [{text, buoc, y}] (từ video đã air / người sửa) đưa vào lời nhắc. */
export async function docLoi(canh, { dsBuoc = [], viDu = [], log = () => {} } = {}) {
  const cau = canh.map((c) => (Array.isArray(c.cau) ? c.cau.join(" ") : String(c.text || "")).slice(0, 400));
  const luat = () => cau.map((t) => ({ y: yTuKhoa(t), buoc: buocTuKhoa(t, dsBuoc), cach: "LUAT" }));
  try {
    const prompt = "Bạn là biên tập viên video thi công vật liệu xây dựng. Với MỖI câu lời thoại dưới đây, cho biết:\n- y: một trong " + Y.join(", ") + "\n- buoc: câu đang nói tới bước thi công nào, CHÉP ĐÚNG một tên trong danh sách bước (không nhắc bước nào thì null)\n" +
      "Danh sách bước:\n" + dsBuoc.map((b, i) => (i + 1) + ". " + b).join("\n") + "\n" +
      (viDu.length ? "Ví dụ từ video Kingsmen đã dựng tay (câu → bước đang chiếu):\n" + viDu.slice(0, 12).map((v) => "- \"" + String(v.text).slice(0, 120) + "\" → " + (v.buoc || "null") + (v.y ? " (" + v.y + ")" : "")).join("\n") + "\n" : "") +
      "Các câu:\n" + cau.map((t, i) => (i + 1) + ". " + t).join("\n") + "\nChỉ trả JSON: {\"cau\": [{\"y\": \"...\", \"buoc\": \"...\"|null}, ...]} đúng " + cau.length + " phần tử theo thứ tự.";
    const r = await fetch(OLLAMA + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MO_HINH_LOI, stream: false, format: "json", options: { temperature: 0 }, messages: [{ role: "user", content: prompt }] }) });
    if (!r.ok) throw new Error("Ollama HTTP " + r.status); const j = await r.json(); const o = JSON.parse((j.message && j.message.content) || "{}"); const ds = Array.isArray(o.cau) ? o.cau : [];
    if (ds.length !== cau.length) throw new Error("trả " + ds.length + "/" + cau.length + " câu");
    const tapBuoc = new Set(dsBuoc); return ds.map((x, i) => ({ y: Y.includes(x.y) ? x.y : yTuKhoa(cau[i]), buoc: tapBuoc.has(x.buoc) ? x.buoc : buocTuKhoa(cau[i], dsBuoc), cach: "MO" }));
  } catch (e) { log("  đọc lời bằng " + MO_HINH_LOI + " không được (" + String(e.message || e).slice(0, 60) + ") → luật từ khoá"); return luat(); }
}

/** Các đoạn ứng viên từ dòng thời gian footage: [{ts, tu, den, buoc, tham_my, ro_net, co_canh, mo_ta}] */
export function doanUngVien(nguon) { const ra = []; for (const t of nguon) { const tl = (t.phan_tich && t.phan_tich.timeline) || []; for (const d of tl) if (d.den - d.tu >= 0.8) ra.push({ ts: t, tu: d.tu, den: d.den, buoc: d.buoc, tham_my: +d.tham_my || 0, ro_net: +d.ro_net || 0, co_canh: d.co_canh, mo_ta: d.mo_ta || d.hanh_dong || "" }); } return ra; }

/** M3: 6 đặc trưng của một đoạn cho một cảnh. */
export function dacTrung(c, d, can, daDung) { const khopBuoc = c.buoc ? (d.buoc === c.buoc ? 1 : 0) : yHopBuoc(c.y, d.buoc) * 0.6; const chot = c.y === "KET_QUA" || c.y === "KEU_GOI";
  return [khopBuoc, yHopBuoc(c.y, d.buoc), (d.tham_my / 10) * (chot ? 1.5 : 1), d.ro_net / 10, Math.min(1, (d.den - d.tu) / Math.max(0.5, can)), daDung ? 0 : 1]; }
export function diem(W, f) { return (W.b || 0) + W.buoc * f[0] + W.y * f[1] + W.tham_my * f[2] + W.net * f[3] + W.du_dai * f[4] + W.chua_dung * f[5]; }
export const wTuDau = (dau) => (dau && Array.isArray(dau.w) && dau.w.length === 6 ? { buoc: dau.w[0], y: dau.w[1], tham_my: dau.w[2], net: dau.w[3], du_dai: dau.w[4], chua_dung: dau.w[5], b: dau.b || 0 } : W_MAC_DINH);

/** M3: lập shot cho từng cảnh từ các đoạn. G = nhịp (ADR-010). Trả số cảnh đã lập. */
export function keHoach(canhDung, doan, { W = W_MAC_DINH, G = { dai_tb: 2.8, dai_min: 1.5, dai_max: 4.5 }, netToiThieu = 5 } = {}) {
  const dung = []; let so = 0; const trung = (d, tu, den) => dung.some((u) => u.id === d.ts.id && Math.min(u.den, den) - Math.max(u.tu, tu) > 0.3);
  for (const c of canhDung) { if (c.shots && c.shots.length) continue; let con = c.d; const shots = [];
    while (con > 0.3 && shots.length < 6) { let can = con > G.dai_max ? G.dai_tb : con; if (con - can < G.dai_min * 0.6) can = con;
      let tot = null, bs = -1e9; for (const d of doan) { if (d.ro_net < netToiThieu) continue; const f = dacTrung(c, d, can, trung(d, d.tu, d.den)); const sc = diem(W, f); if (sc > bs) { bs = sc; tot = { d, f, sc }; } }
      if (!tot) break; const len = Math.min(can, tot.d.den - tot.d.tu); const tu = +(tot.d.tu + Math.max(0, (tot.d.den - tot.d.tu - len) / 2)).toFixed(2);   // lấy giữa đoạn: đầu/cuối đoạn hay dính chuyển động máy
      shots.push({ ts: tot.d.ts, tu, den: +(tu + len).toFixed(2), buoc: tot.d.buoc, tham_my: tot.d.tham_my, ro_net: tot.d.ro_net, diem: +tot.sc.toFixed(2), f: tot.f.map((x) => +x.toFixed(3)) }); dung.push({ id: tot.d.ts.id, tu, den: tu + len }); con -= len; }
    if (shots.length) { const tong = shots.reduce((a, x) => a + (x.den - x.tu), 0); if (tong < c.d - 0.05) shots[shots.length - 1].den = +(shots[shots.length - 1].den + c.d - tong).toFixed(2); c.shots = shots; c.cach_chon = "NGU_NGHIA"; so++; } }
  return so; }

/** M5: kiểm định cứng. quyTrinh = danh sách bước theo thứ tự. */
export function kiemDinh(canhDung, { quyTrinh = [] } = {}) {
  const loi = [], canhBao = []; const idx = (b) => quyTrinh.indexOf(b);
  // 1. trình tự: các shot CACH_LAM (và CHUNG_MINH có bước trong quy trình) phải theo thứ tự không lùi
  let truoc = -1, truocTen = ""; for (const c of canhDung) { if (!["CACH_LAM", "CHUNG_MINH"].includes(c.y)) continue; for (const s of c.shots || []) { const i = idx(s.buoc); if (i < 0) continue; if (i < truoc) loi.push("Đảo trình tự: cảnh " + (c.k + 1) + " chiếu \"" + s.buoc + "\" sau \"" + truocTen + "\""); if (i > truoc) { truoc = i; truocTen = s.buoc; } } }
  // 2. thiếu bước bắt buộc khi kịch bản là hướng dẫn cách làm (≥ 2 cảnh CACH_LAM)
  if (quyTrinh.length && canhDung.filter((c) => c.y === "CACH_LAM").length >= 2) { const co = new Set(canhDung.flatMap((c) => (c.shots || []).map((s) => s.buoc))); const thieu = quyTrinh.filter((b) => !co.has(b) && !/gioi thieu|nguoi noi|khac/.test(bo(b))); if (thieu.length) canhBao.push("Chưa có hình cho bước: " + thieu.join(", ")); }
  // 3. đoạn mờ · 4. cảnh chốt xấu · 5. lặp đoạn
  const seen = []; for (const c of canhDung) for (const s of c.shots || []) {
    if (s.ro_net != null && s.ro_net < 6) loi.push("Cảnh " + (c.k + 1) + " dùng đoạn mờ (nét " + s.ro_net + "/10) của " + ((s.ts && s.ts.ten) || ""));
    if ((c.y === "KET_QUA" || c.y === "KEU_GOI") && s.tham_my != null && s.tham_my < 8) canhBao.push("Cảnh " + (c.k + 1) + " (" + c.y + ") thẩm mỹ chỉ " + s.tham_my + "/10 — cần cảnh hoàn thiện đẹp hơn");
    const id = s.ts && s.ts.id; if (id && seen.some((u) => u.id === id && Math.min(u.den, s.den) - Math.max(u.tu, s.tu) > 0.3)) loi.push("Cảnh " + (c.k + 1) + " lặp lại đoạn đã dùng của " + ((s.ts && s.ts.ten) || "")); seen.push({ id, tu: s.tu, den: s.den }); }
  return { dat: loi.length === 0, loi: loi.slice(0, 12), canh_bao: canhBao.slice(0, 12), co_quy_trinh: quyTrinh.length > 0 };
}
