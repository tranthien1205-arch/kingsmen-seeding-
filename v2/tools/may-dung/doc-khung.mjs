// ĐỌC TỪNG GIÂY FOOTAGE BẰNG MÔ HÌNH NHÌN-HIỂU TẠI CHỖ (ADR-014a, 24/09 — chủ: "sản phẩm là vật liệu với quy trình thi công kỹ thuật khá phức
// tạp và độ thẩm mỹ hoàn thiện, muốn mô hình AI hiểu được từng khung hình để lựa chọn cắt ghép phù hợp với kịch bản và lời thoại").
//   · docKhung(file, {quy_trinh, san_pham, chu_de, log}) → tách 1 khung/giây (tối đa 40), hỏi qwen2.5vl:7b qua Ollama (máy học, không tốn phí):
//     bước thi công (chọn trong quy trình chuẩn của sản phẩm nếu có), hành động, vật liệu/dụng cụ, cỡ cảnh, thẩm mỹ hoàn thiện, độ nét, có người
//     → gộp các giây liền nhau cùng bước + cỡ cảnh thành đoạn {tu, den, buoc, hanh_dong, vat_lieu, co_canh, tham_my, ro_net, co_nguoi, mo_ta}.
//   · docMotKhung(jpg, ...) dùng lại cho shot của video thành phẩm (hoc-thanh-pham).
// Không có Ollama / không có qwen2.5vl → ném lỗi rõ, không bịa.
import { existsSync, readFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const MO_HINH_VL = process.env.MO_HINH_VL || "qwen2.5vl:7b";
const OLLAMA = process.env.OLLAMA_HOST ? (/^https?:/.test(process.env.OLLAMA_HOST) ? process.env.OLLAMA_HOST : "http://" + process.env.OLLAMA_HOST) : "http://127.0.0.1:11434";
const CO_CANH = ["RONG", "TRUNG", "CAN", "SAN_PHAM", "THAO_TAC", "NGUOI_NOI", "CHU"];
const BUOC_CHUNG = ["chuẩn bị / hiện trạng trước thi công", "vệ sinh bề mặt", "pha trộn vật liệu", "thi công chính (bơm, trét, lăn, dán…)", "gạt / miết / hoàn thiện", "lau dọn", "kết quả hoàn thiện / so sánh trước-sau", "giới thiệu sản phẩm / bao bì", "người nói trước máy", "khác"];

export async function coVL() { try { const r = await fetch(OLLAMA + "/api/tags"); if (!r.ok) return false; const j = await r.json(); return (j.models || []).some((m) => String(m.name || m.model).startsWith(MO_HINH_VL.split(":")[0]) && String(m.name || m.model).includes(MO_HINH_VL.split(":")[1] || "")); } catch { return false; } }

function loiNhac({ quy_trinh, san_pham, chu_de, vi_du }) {
  const buoc = (quy_trinh && quy_trinh.length ? quy_trinh : BUOC_CHUNG).map((b, i) => (i + 1) + ". " + b).join("\n");
  return "Bạn là kỹ thuật viên thi công vật liệu xây dựng kiêm biên tập video. Đây là MỘT khung hình trong clip quay cho video" + (san_pham ? " về sản phẩm \"" + san_pham + "\"" : "") + (chu_de ? " (chủ đề: " + chu_de + ")" : "") + ".\n" +
    "Các bước thi công chuẩn:\n" + buoc + "\n" + (vi_du && vi_du.length ? "Người đã sửa những lần trước (làm theo):\n" + vi_du.slice(0, 8).map((v) => "- " + v).join("\n") + "\n" : "") +
    "Chỉ trả JSON, tiếng Việt có dấu, không chữ Hán:\n{\"buoc\": \"<chép đúng tên một bước trong danh sách; không thuộc bước nào thì 'khác: ...'>\", \"hanh_dong\": \"<động từ + đối tượng, ≤ 10 chữ>\", \"vat_lieu\": \"<vật liệu / dụng cụ nhìn thấy, ≤ 8 chữ>\", \"co_canh\": \"RONG|TRUNG|CAN|SAN_PHAM|THAO_TAC|NGUOI_NOI|CHU\", \"tham_my\": <0-10: bề mặt / mạch / đường hoàn thiện có đều, sạch, đẹp để khoe không>, \"ro_net\": <0-10>, \"co_nguoi\": <true|false>, \"mo_ta\": \"<≤ 20 chữ đúng thứ nhìn thấy>\"}";
}
const soGioiHan = (x, a, b) => Math.max(a, Math.min(b, Number(x) || 0));

/** Hỏi mô hình nhìn một khung JPG → đối tượng đã làm sạch. */
export async function docMotKhung(jpg, ctx = {}) {
  const img = readFileSync(jpg).toString("base64");
  const r = await fetch(OLLAMA + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MO_HINH_VL, stream: false, format: "json", options: { temperature: 0, num_predict: 220 }, messages: [{ role: "user", content: loiNhac(ctx), images: [img] }] }) });
  if (!r.ok) throw new Error("Ollama HTTP " + r.status + " " + (await r.text().catch(() => "")).slice(0, 120));
  const j = await r.json(); let o = {}; try { o = JSON.parse((j.message && j.message.content) || "{}"); } catch { o = {}; }
  return { buoc: String(o.buoc || "khác").slice(0, 80), hanh_dong: String(o.hanh_dong || "").slice(0, 120), vat_lieu: String(o.vat_lieu || "").slice(0, 120), co_canh: CO_CANH.includes(o.co_canh) ? o.co_canh : null, tham_my: soGioiHan(o.tham_my, 0, 10), ro_net: soGioiHan(o.ro_net, 0, 10), co_nguoi: !!o.co_nguoi, mo_ta: String(o.mo_ta || "").slice(0, 200) };
}

/** Đọc cả clip: 1 khung/giây (tối đa toiDa), gộp giây liền nhau cùng bước + cỡ cảnh. */
export async function docKhung(file, ctx = {}) {
  const log = ctx.log || (() => {}); const thu = join(ctx.thuMuc || join(file + "_khung")); rmSync(thu, { recursive: true, force: true }); mkdirSync(thu, { recursive: true });
  const toiDa = Math.max(4, Math.min(60, Number(ctx.toiDa) || 40)); const dai = Number(ctx.dai) || 0; const fps = dai > toiDa ? (toiDa / dai).toFixed(3) : "1";
  const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-vf", "fps=" + fps + ",scale=512:-2", "-q:v", "4", join(thu, "k%03d.jpg")], { encoding: "utf8", timeout: 300000 });
  if (p.status !== 0) throw new Error("ffmpeg tách khung: " + String(p.stderr || "").slice(-160));
  const ds = readdirSync(thu).filter((n) => /^k\d+\.jpg$/.test(n)).sort(); const buoc = 1 / Number(fps); const giay = []; const t0 = Date.now();
  for (let i = 0; i < ds.length; i++) { const t = +(i * buoc).toFixed(2); try { giay.push({ t, ...(await docMotKhung(join(thu, ds[i]), ctx)) }); } catch (e) { log("  khung", i, "lỗi:", String(e.message || e).slice(0, 80)); if (i === 0) throw e; } }
  const msKhung = ds.length ? Math.round((Date.now() - t0) / ds.length) : 0;
  // làm mượt theo thời gian (đo 24/09: cùng một cảnh bao bì tĩnh, khung lẻ nhảy "pha trộn" ↔ "giới thiệu"): mỗi giây lấy bước chiếm đa số
  // trong cửa sổ 3 giây quanh nó; cảnh không đổi cỡ cảnh thì không tách đoạn chỉ vì một khung lệch
  if (giay.length >= 3) { const goc = giay.map((g) => g.buoc); for (let i = 0; i < giay.length; i++) { const cs = goc.slice(Math.max(0, i - 1), i + 2); const dem = {}; for (const b of cs) dem[b] = (dem[b] || 0) + 1; const top = Object.entries(dem).sort((x, y) => y[1] - x[1])[0]; if (top[1] >= 2) giay[i].buoc = top[0]; } }
  const doan = []; for (const g of giay) { const cu = doan[doan.length - 1]; if (cu && cu.buoc === g.buoc && cu.co_canh === g.co_canh) { cu.den = +(g.t + buoc).toFixed(2); cu._n++; cu.tham_my += g.tham_my; cu.ro_net += g.ro_net; cu.co_nguoi = cu.co_nguoi || g.co_nguoi; } else doan.push({ tu: g.t, den: +(g.t + buoc).toFixed(2), buoc: g.buoc, hanh_dong: g.hanh_dong, vat_lieu: g.vat_lieu, co_canh: g.co_canh, tham_my: g.tham_my, ro_net: g.ro_net, co_nguoi: g.co_nguoi, mo_ta: g.mo_ta, _n: 1 }); }
  for (const d of doan) { d.tham_my = +(d.tham_my / d._n).toFixed(1); d.ro_net = +(d.ro_net / d._n).toFixed(1); delete d._n; } if (dai && doan.length) doan[doan.length - 1].den = +Math.min(doan[doan.length - 1].den, dai).toFixed(2);
  rmSync(thu, { recursive: true, force: true });
  return { timeline: doan, so_khung: ds.length, ms_khung: msKhung };
}

// lệnh phan_tich_footage {doc_khung:true, muc_id?, tai_san_id?, lai?} (phan-tich.mjs chuyển sang đây)
export default async function chay({ app, goiApp, lenh, dir, log, may }) {
  const ts = lenh.tham_so || {}; if (!(await coVL())) return { ok: false, msg: "máy này chưa có " + MO_HINH_VL + " trong Ollama (chạy: ollama pull " + MO_HINH_VL + ")" };
  const r = await goiApp("/hub/viec/doc_khung?muc_id=" + encodeURIComponent(ts.muc_id || "") + "&tai_san_id=" + encodeURIComponent(ts.tai_san_id || "") + (ts.lai ? "&lai=1" : "")); const ds = (r.d && r.d.viec) || [];
  if (!ds.length) return { ok: true, msg: "không có footage nào cần đọc" };
  const TH = join(dir, "doc-khung"); mkdirSync(TH, { recursive: true }); let xong = 0, tongMs = 0, tongKhung = 0; const loi = [];
  for (const t of ds) {
    try { const src = join(TH, t.id + ".mp4"); if (!existsSync(src)) { const x = await fetch(t.media_url, { headers: /\/media\//.test(t.media_url) ? { "X-Hub-Key": app.khoa } : {} }); if (!x.ok) throw new Error("tải " + x.status); (await import("node:fs")).writeFileSync(src, Buffer.from(await x.arrayBuffer())); }
      const kq = await docKhung(src, { quy_trinh: t.quy_trinh, san_pham: t.san_pham, chu_de: t.chu_de, dai: t.dai, log, thuMuc: join(TH, t.id + "_k") });
      const g = await goiApp("/hub/doc-khung", { method: "POST", body: JSON.stringify({ tai_san_id: t.id, timeline: kq.timeline, model: MO_HINH_VL, so_khung: kq.so_khung, ms_khung: kq.ms_khung, may }) }); if (!g.ok) throw new Error("app " + g.status);
      xong++; tongMs += kq.ms_khung * kq.so_khung; tongKhung += kq.so_khung; log("  ✓", t.ten, "·", kq.so_khung, "khung ·", kq.ms_khung, "ms/khung ·", kq.timeline.length, "đoạn:", kq.timeline.map((d) => d.buoc.slice(0, 18) + "[" + d.tu + "–" + d.den + "]").join(" | ").slice(0, 200));
      rmSync(src, { force: true });
    } catch (e) { loi.push(t.ten + ": " + String(e.message || e).slice(0, 80)); log("  ✗", t.ten, String(e.message || e).slice(0, 120)); }
  }
  return { ok: xong > 0, msg: "đọc từng giây " + xong + "/" + ds.length + " footage · " + tongKhung + " khung · " + (tongKhung ? Math.round(tongMs / tongKhung) : 0) + " ms/khung (" + MO_HINH_VL + ")" + (loi.length ? " · lỗi: " + loi.slice(0, 2).join(" · ") : "") };
}
