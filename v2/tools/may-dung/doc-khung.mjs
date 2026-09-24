// M1 ĐỌC HÌNH (ADR-014a → ADR-016, 24/09) — nền cho mọi phần thông minh phía sau (chủ: "cần thiết kế kiến trúc để mô hình nhận diện chính
// xác khung hình đang nói về gì"; "ngoài quy trình thi công cần bối cảnh chung, vấn đề, giải pháp, hoàn thiện sản phẩm, các bài test…").
// Đo thật lần 1 (14 clip Keo chít mạch, 1 khung/giây): nhãn bước viết 5 kiểu khác nhau, thẩm mỹ gần như luôn 8, cảnh có chuyển động nhảy nhãn
// giữa "pha trộn" và "thi công". Kiến trúc mới sửa đúng ba chỗ đó:
//   1. HAI TẦNG NHÃN: nhóm cảnh (BOI_CANH · VAN_DE · GIAI_PHAP · THI_CONG · THU_NGHIEM · HOAN_THIEN · NGUOI_NOI · KHAC) → chi tiết
//      (bước trong quy trình chuẩn khi THI_CONG, bài test của sản phẩm khi THU_NGHIEM).
//   2. TẬP ĐÓNG: Ollama "format" = JSON schema với enum → mô hình chỉ được chọn đúng tên có trong danh sách, không tự chép.
//   3. NGỮ CẢNH: (a) một lượt tổng quan cả clip (lưới 6 khung) → nhóm/bước chính làm gợi ý; (b) mỗi lượt đọc là DẢI 3 khung liên tiếp
//      (1,5 giây) nên thấy được chuyển động (bơm ≠ gạt); (c) Viterbi trên chuỗi nhãn: đổi nhãn phải trả giá, lùi bước thi công trả giá cao.
//   4. THƯỚC THẨM MỸ CÓ MỐC: 0–3 bẩn/lem/chưa xong · 4–6 đang thi công · 7–8 xong nhưng chưa sạch/chưa đều · 9–10 đều, sạch, đáng làm cảnh chốt;
//      -1 = không phải bề mặt hoàn thiện (không chấm).
//   5. TỰ BIẾT KHÔNG CHẮC: mỗi dải có tu_tin 0–1; đoạn trung bình < 0,6 → can_xac_nhan (người xác nhận ở màn Huấn luyện → nhãn vàng).
//   6. HỌC TỪ NGƯỜI: vi_du = các lần người sửa nhãn (app gửi kèm việc) đưa vào lời nhắc.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const MO_HINH_VL = process.env.MO_HINH_VL || "qwen2.5vl:7b";
const OLLAMA = process.env.OLLAMA_HOST ? (/^https?:/.test(process.env.OLLAMA_HOST) ? process.env.OLLAMA_HOST : "http://" + process.env.OLLAMA_HOST) : "http://127.0.0.1:11434";
export const CO_CANH = ["RONG", "TRUNG", "CAN", "SAN_PHAM", "THAO_TAC", "NGUOI_NOI", "CHU"];
export const NHOM = ["BOI_CANH", "VAN_DE", "GIAI_PHAP", "THI_CONG", "THU_NGHIEM", "HOAN_THIEN", "NGUOI_NOI", "KHAC"];
export const TEN_NHOM = { BOI_CANH: "bối cảnh chung: công trình, không gian, ngôi nhà", VAN_DE: "vấn đề: hư hỏng, mốc, nứt, thấm, xuống cấp", GIAI_PHAP: "giải pháp: sản phẩm, bao bì, giới thiệu sản phẩm", THI_CONG: "thi công: đang làm một bước trong quy trình", THU_NGHIEM: "bài test / chứng minh: đổ nước, chà, cào, so sánh", HOAN_THIEN: "hoàn thiện: kết quả sau thi công, trước-sau", NGUOI_NOI: "người nói trước máy", KHAC: "không thuộc nhóm nào" };
const BUOC_CHUNG = ["Chuẩn bị bề mặt", "Vệ sinh", "Pha trộn vật liệu", "Thi công chính", "Gạt / miết / làm phẳng", "Lau dọn"];
const KHONG = "(không)";

export async function coVL() { try { const r = await fetch(OLLAMA + "/api/tags"); if (!r.ok) return false; const j = await r.json(); const [ten, tag] = MO_HINH_VL.split(":"); return (j.models || []).some((m) => String(m.name || m.model).startsWith(ten) && String(m.name || m.model).includes(tag || "")); } catch { return false; } }

function schema(dsBuoc, dsTest) { return { type: "object", required: ["nhom", "buoc", "bai_test", "co_canh", "tham_my", "ro_net", "tu_tin", "mo_ta"], properties: {
  nhom: { type: "string", enum: NHOM }, buoc: { type: "string", enum: [...dsBuoc, KHONG] }, bai_test: dsTest.length ? { type: "string", enum: [...dsTest, KHONG] } : { type: "string" },
  hanh_dong: { type: "string" }, vat_lieu: { type: "string" }, co_canh: { type: "string", enum: CO_CANH }, tham_my: { type: "integer", minimum: -1, maximum: 10 }, ro_net: { type: "integer", minimum: 0, maximum: 10 },
  tu_tin: { type: "number", minimum: 0, maximum: 1 }, co_nguoi: { type: "boolean" }, mo_ta: { type: "string" } } }; }

function loiNhac({ dsBuoc, dsTest, san_pham, chu_de, vi_du, tong_quan, dai }) {
  return "Bạn là kỹ thuật viên thi công vật liệu xây dựng kiêm biên tập video. Ảnh là DẢI 3 khung liên tiếp (trái → phải, cách nhau 0,5 giây) trong clip quay cho video" + (san_pham ? " về \"" + san_pham + "\"" : "") + (chu_de ? " (chủ đề: " + chu_de + ")" : "") + ". Nhìn chuyển động giữa 3 khung để biết đang làm gì.\n" +
    (tong_quan ? "Tổng quan cả clip: " + tong_quan + "\n" : "") +
    "NHÓM CẢNH:\n" + NHOM.map((n) => "- " + n + ": " + TEN_NHOM[n]).join("\n") + "\n" +
    "BƯỚC THI CÔNG (chỉ khi nhóm = THI_CONG, không thì \"" + KHONG + "\"):\n" + dsBuoc.map((b, i) => (i + 1) + ". " + b).join("\n") + "\n" +
    "BÀI TEST (chỉ khi nhóm = THU_NGHIEM, không thì \"" + KHONG + "\"):\n" + (dsTest.length ? dsTest.map((b, i) => (i + 1) + ". " + b).join("\n") : "(chưa khai — mô tả ngắn bài test nhìn thấy)") + "\n" +
    "THẨM MỸ (chỉ chấm bề mặt/mạch/đường hoàn thiện; không phải thì -1): 0–3 bẩn, lem, chưa xong · 4–6 đang thi công, còn vữa · 7–8 xong nhưng chưa sạch hoặc chưa đều · 9–10 đều, thẳng, sạch, sáng đẹp, đáng làm cảnh chốt. Đừng chấm 8 theo thói quen.\n" +
    "tu_tin: bạn chắc bao nhiêu về nhóm + bước/bài test (0–1). Mơ hồ thì ghi thấp.\n" +
    (vi_du && vi_du.length ? "Người đã sửa những lần trước (làm theo đúng):\n" + vi_du.slice(0, 10).map((v) => "- " + v).join("\n") + "\n" : "") +
    "mo_ta: ≤ 20 chữ, đúng thứ nhìn thấy, tiếng Việt có dấu, không chữ Hán.";
}
async function hoiVL(jpg, prompt, fmt) {
  const r = await fetch(OLLAMA + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MO_HINH_VL, stream: false, format: fmt, options: { temperature: 0, num_predict: 260 }, messages: [{ role: "user", content: prompt, images: [readFileSync(jpg).toString("base64")] }] }) });
  if (!r.ok) throw new Error("Ollama HTTP " + r.status + " " + (await r.text().catch(() => "")).slice(0, 120)); const j = await r.json(); try { return JSON.parse((j.message && j.message.content) || "{}"); } catch { return {}; } }

/** Lượt tổng quan: lưới 6 khung rải đều → câu tóm tắt clip (gợi ý cho từng dải). */
async function tongQuan(file, dai, thu, ctx) { const o = join(thu, "luoi.jpg"); const fps = Math.max(0.05, 6 / Math.max(1, dai));
  spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vf", "fps=" + fps.toFixed(3) + ",scale=320:-2,tile=3x2", "-frames:v", "1", o], { encoding: "utf8", timeout: 120000 }); if (!existsSync(o)) return "";
  const x = await hoiVL(o, "Ảnh là lưới 6 khung rải đều của MỘT clip quay thi công vật liệu" + (ctx.san_pham ? " \"" + ctx.san_pham + "\"" : "") + ". Tóm tắt clip trong ≤ 25 chữ tiếng Việt: đang ở giai đoạn nào (bối cảnh, vấn đề, sản phẩm, thi công bước nào, bài test, hoàn thiện), làm gì.", { type: "object", required: ["tom_tat"], properties: { tom_tat: { type: "string" } } });
  return String(x.tom_tat || "").slice(0, 200); }

/** Viterbi trên chuỗi dải: nhãn = nhom|buoc|bai_test. Đổi nhãn trả giá 1; lùi bước thi công (theo quy trình) trả thêm 1,5. */
export function viterbi(ds, qt) { const S = [...new Set(ds.map((d) => d.k))]; if (S.length < 2) return ds.map((d) => d.k); const buocCua = (k) => { const p = k.split("|"); return p[0] === "THI_CONG" ? qt.indexOf(p[1]) : -1; };
  const phat = (d, s) => Math.log(s === d.k ? Math.max(0.05, d.tu_tin) : Math.max(0.02, (1 - d.tu_tin) / S.length)); const chuyen = (a, b) => (a === b ? 0 : -1 - (buocCua(a) >= 0 && buocCua(b) >= 0 && buocCua(b) < buocCua(a) ? 1.5 : 0));
  let v = S.map((s) => phat(ds[0], s)); const tro = [];
  for (let i = 1; i < ds.length; i++) { const nv = [], tr = []; for (let j = 0; j < S.length; j++) { let best = -1e9, bi = 0; for (let q = 0; q < S.length; q++) { const x = v[q] + chuyen(S[q], S[j]); if (x > best) { best = x; bi = q; } } nv.push(best + phat(ds[i], S[j])); tr.push(bi); } v = nv; tro.push(tr); }
  let j = v.indexOf(Math.max(...v)); const ra = [S[j]]; for (let i = tro.length - 1; i >= 0; i--) { j = tro[i][j]; ra.unshift(S[j]); } return ra; }

/** Đọc cả clip → dòng thời gian đoạn. */
export async function docKhung(file, ctx = {}) {
  const log = ctx.log || (() => {}); const thu = ctx.thuMuc || (file + "_khung"); rmSync(thu, { recursive: true, force: true }); mkdirSync(thu, { recursive: true });
  const dai = Number(ctx.dai) || 0; const dsBuoc = (ctx.quy_trinh && ctx.quy_trinh.length ? ctx.quy_trinh : BUOC_CHUNG).slice(0, 20); const dsTest = (ctx.bai_test || []).slice(0, 20);
  const toiDa = Math.max(4, Math.min(40, Number(ctx.toiDa) || 40)); const fps = dai && dai / 1.5 > toiDa ? (3 * toiDa / dai) : 2; const cua = 3 / fps;   // mỗi dải 3 khung = cua giây
  const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-vf", "fps=" + fps.toFixed(3) + ",scale=320:-2,tile=3x1", "-q:v", "4", join(thu, "d%03d.jpg")], { encoding: "utf8", timeout: 300000 });
  if (p.status !== 0) throw new Error("ffmpeg tách dải: " + String(p.stderr || "").slice(-160));
  const tq = await tongQuan(file, dai || 10, thu, ctx).catch(() => "");
  const ds = readdirSync(thu).filter((n) => /^d\d+\.jpg$/.test(n)).sort(); const fmt = schema(dsBuoc, dsTest); const prompt = loiNhac({ ...ctx, dsBuoc, dsTest, tong_quan: tq }); const t0 = Date.now(); const dai3 = [];
  for (let i = 0; i < ds.length; i++) { try { const o = await hoiVL(join(thu, ds[i]), prompt, fmt); const nhom = NHOM.includes(o.nhom) ? o.nhom : "KHAC";
      const buoc = nhom === "THI_CONG" && dsBuoc.includes(o.buoc) ? o.buoc : null; const test = nhom === "THU_NGHIEM" ? (o.bai_test && o.bai_test !== KHONG ? String(o.bai_test).slice(0, 80) : null) : null;
      dai3.push({ t: +(i * cua).toFixed(2), nhom, buoc, bai_test: test, k: nhom + "|" + (buoc || "") + "|" + (test || ""), hanh_dong: String(o.hanh_dong || "").slice(0, 120), vat_lieu: String(o.vat_lieu || "").slice(0, 120), co_canh: CO_CANH.includes(o.co_canh) ? o.co_canh : null,
        tham_my: Number.isFinite(+o.tham_my) && +o.tham_my >= 0 ? Math.min(10, +o.tham_my) : null, ro_net: Math.max(0, Math.min(10, +o.ro_net || 0)), tu_tin: Math.max(0, Math.min(1, +o.tu_tin || 0.5)), co_nguoi: !!o.co_nguoi, mo_ta: String(o.mo_ta || "").slice(0, 200) });
    } catch (e) { log("  dải", i, "lỗi:", String(e.message || e).slice(0, 80)); if (i === 0) throw e; } }
  const msDai = ds.length ? Math.round((Date.now() - t0) / ds.length) : 0;
  const nhan = viterbi(dai3, dsBuoc); dai3.forEach((d, i) => { if (nhan[i] !== d.k) { const [n, b, t] = nhan[i].split("|"); d.nhom = n; d.buoc = b || null; d.bai_test = t || null; d.k = nhan[i]; d.tu_tin = Math.min(d.tu_tin, 0.5); } });
  const doan = []; for (const g of dai3) { const cu = doan[doan.length - 1]; if (cu && cu.k === g.k && cu.co_canh === g.co_canh) { cu.den = +(g.t + cua).toFixed(2); cu._n++; cu._tm.push(g.tham_my); cu.ro_net += g.ro_net; cu.tu_tin += g.tu_tin; cu.co_nguoi = cu.co_nguoi || g.co_nguoi; }
    else doan.push({ tu: g.t, den: +(g.t + cua).toFixed(2), k: g.k, nhom: g.nhom, buoc: g.buoc, bai_test: g.bai_test, hanh_dong: g.hanh_dong, vat_lieu: g.vat_lieu, co_canh: g.co_canh, _tm: [g.tham_my], ro_net: g.ro_net, tu_tin: g.tu_tin, co_nguoi: g.co_nguoi, mo_ta: g.mo_ta, _n: 1 }); }
  for (const d of doan) { const tm = d._tm.filter((x) => x != null); d.tham_my = tm.length ? +(tm.reduce((a, x) => a + x, 0) / tm.length).toFixed(1) : null; d.ro_net = +(d.ro_net / d._n).toFixed(1); d.tu_tin = +(d.tu_tin / d._n).toFixed(2); d.can_xac_nhan = d.tu_tin < 0.6; delete d._n; delete d._tm; delete d.k; }
  if (dai && doan.length) doan[doan.length - 1].den = +Math.min(doan[doan.length - 1].den, dai).toFixed(2);
  rmSync(thu, { recursive: true, force: true });
  return { timeline: doan, tong_quan: tq, so_khung: ds.length * 3, so_dai: ds.length, ms_dai: msDai };
}

// lệnh phan_tich_footage {doc_khung:true, muc_id?, tai_san_id?, lai?} (phan-tich.mjs chuyển sang đây)
export default async function chay({ app, goiApp, lenh, dir, log, may }) {
  const ts = lenh.tham_so || {}; if (!(await coVL())) return { ok: false, msg: "máy này chưa có " + MO_HINH_VL + " trong Ollama (chạy: ollama pull " + MO_HINH_VL + ")" };
  const r = await goiApp("/hub/viec/doc_khung?muc_id=" + encodeURIComponent(ts.muc_id || "") + "&tai_san_id=" + encodeURIComponent(ts.tai_san_id || "") + (ts.lai ? "&lai=1" : "")); const ds = (r.d && r.d.viec) || [];
  if (!ds.length) return { ok: true, msg: "không có footage nào cần đọc" };
  const TH = join(dir, "doc-khung"); mkdirSync(TH, { recursive: true }); let xong = 0, tongMs = 0, tongDai = 0, canXN = 0; const loi = [];
  for (const t of ds) {
    try { const src = join(TH, t.id + ".mp4"); if (!existsSync(src)) { const x = await fetch(t.media_url, { headers: /\/media\//.test(t.media_url) ? { "X-Hub-Key": app.khoa } : {} }); if (!x.ok) throw new Error("tải " + x.status); writeFileSync(src, Buffer.from(await x.arrayBuffer())); }
      const kq = await docKhung(src, { quy_trinh: t.quy_trinh, bai_test: t.bai_test, vi_du: t.vi_du, san_pham: t.san_pham, chu_de: t.chu_de, dai: t.dai, log, thuMuc: join(TH, t.id + "_k") });
      const g = await goiApp("/hub/doc-khung", { method: "POST", body: JSON.stringify({ tai_san_id: t.id, timeline: kq.timeline, tong_quan: kq.tong_quan, model: MO_HINH_VL, so_khung: kq.so_khung, ms_khung: kq.so_dai ? Math.round(kq.ms_dai * kq.so_dai / kq.so_khung) : 0, may }) }); if (!g.ok) throw new Error("app " + g.status);
      xong++; tongMs += kq.ms_dai * kq.so_dai; tongDai += kq.so_dai; canXN += kq.timeline.filter((d) => d.can_xac_nhan).length;
      log("  ✓", t.ten, "·", kq.so_dai, "dải ·", kq.ms_dai, "ms/dải ·", kq.timeline.map((d) => (d.nhom + (d.buoc ? ":" + d.buoc : d.bai_test ? ":" + d.bai_test : "")).slice(0, 26) + " tm" + d.tham_my + " tt" + d.tu_tin).join(" | ").slice(0, 240));
      rmSync(src, { force: true });
    } catch (e) { loi.push(t.ten + ": " + String(e.message || e).slice(0, 80)); log("  ✗", t.ten, String(e.message || e).slice(0, 120)); }
  }
  return { ok: xong > 0, msg: "đọc hình " + xong + "/" + ds.length + " footage · " + tongDai + " dải · " + (tongDai ? Math.round(tongMs / tongDai) : 0) + " ms/dải · " + canXN + " đoạn cần người xác nhận (" + MO_HINH_VL + ")" + (loi.length ? " · lỗi: " + loi.slice(0, 2).join(" · ") : "") };
}
