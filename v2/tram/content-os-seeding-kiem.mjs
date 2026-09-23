// KIỂM & ĐO BÀI SEEDING ĐÃ ĐĂNG (B16 — ADR-007, bản vẽ §11): mở link bài trong nhóm Facebook bằng hồ sơ tài khoản đã đăng
// → còn sống? nội dung? react? số bình luận? danh sách bình luận (để Content OS bắt lead hỏi mua — máy không trả lời)
// → lô content_os.seeding_kiem {viec_id, song, da_len, noi_dung, react, binh_luan, binh_luan_ds:[{nguoi,text}], loi}.
// Việc CHO_QUAN_TRI chưa có link: mở nhóm, tìm bài của mình → nếu thấy thì da_len:true kèm link.
import { bao, loHub } from "./_env.mjs";
import { appContentOS, goiApp, moHoSo, log, soTu } from "./content-os-lib.mjs";

const app = appContentOS();
const r = await goiApp(app, "/hub/viec/seeding_kiem");
if (!r.ok) { bao({ b: "loi", m: "không hỏi được việc kiểm (HTTP " + r.status + ")" }); process.exit(1); }
const ds = Array.isArray(r.d.viec) ? r.d.viec : [];
if (!ds.length) { bao({ b: "ok", ket_qua: [{ man: "không có bài seeding cần kiểm", dong: 0, moi: 0 }] }); process.exit(0); }
const ctx = {}; const kq = []; let i = 0;
for (const v of ds) {
  i++; bao({ b: "buoc", i, n: ds.length, m: "kiểm " + (v.link || v.viec_id) + " (lần " + v.lan + ")" });
  if (!/facebook\.com|fb\.com/i.test(v.link || "")) { kq.push({ viec_id: v.viec_id, loi: "việc chưa có link Facebook để kiểm" }); continue; }
  const tk = (v.tai_khoan && v.tai_khoan.tram_id) || "facebook"; if (!ctx[tk]) ctx[tk] = await moHoSo(tk); if (!ctx[tk]) { kq.push({ viec_id: v.viec_id, loi: "chưa đăng nhập Facebook trên Trạm (hồ sơ " + tk + "-profile)" }); continue; }
  const page = await ctx[tk].newPage();
  try {
    const res = await page.goto(v.link, { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(5000);
    if (/login|checkpoint/.test(page.url())) { kq.push({ viec_id: v.viec_id, loi: "phiên Facebook " + tk + " cần đăng nhập lại" }); continue; }
    const t = await page.locator("body").innerText().catch(() => "");
    if (/không còn tồn tại|content isn't available|nội dung này hiện không hiển thị|This content isn't available/i.test(t) || (res && res.status() === 404)) { kq.push({ viec_id: v.viec_id, song: false, noi_dung: "", react: 0, binh_luan: 0, binh_luan_ds: [] }); continue; }
    let noiDung = ""; try { const art = page.locator('[role="article"]').first(); if (await art.count()) noiDung = (await art.innerText()).slice(0, 3000); } catch {}
    const so = (re) => { const m = t.match(re); return m ? soTu(m[1]) : 0; };
    let react = 0; const al = page.locator('[aria-label*="cảm xúc"], [aria-label*="reactions"], [aria-label*="Thích"]').first(); if (await al.count()) react = soTu(await al.getAttribute("aria-label")); if (!react) react = so(/([\d.,]+\s*[kK]?)\s*(lượt thích|likes?)/i);
    const bl = so(/([\d.,]+\s*[kK]?)\s*(bình luận|comments?)/i);
    // danh sách bình luận (tối đa 30): mỗi article con trong vùng bình luận → tên (dòng đầu) + nội dung
    const blDs = [];
    try { const cs = page.locator('[role="article"] [role="article"], div[aria-label^="Bình luận"], div[aria-label^="Comment by"]'); const n = Math.min(await cs.count(), 30);
      for (let k = 0; k < n; k++) { const tx = (await cs.nth(k).innerText().catch(() => "")).split("\n").map((s) => s.trim()).filter(Boolean); if (tx.length < 2) continue; blDs.push({ nguoi: tx[0].slice(0, 80), text: tx.slice(1).join(" ").replace(/\b(Thích|Phản hồi|Like|Reply|\d+\s*(giờ|phút|ngày|h|m|d))\b.*$/i, "").trim().slice(0, 400) }); } } catch {}
    kq.push({ viec_id: v.viec_id, song: true, da_len: v.cho_quan_tri ? true : undefined, link: v.link, noi_dung: noiDung || t.slice(0, 1500), react, binh_luan: Math.max(bl, blDs.length), binh_luan_ds: blDs.filter((c) => c.text) });
  } catch (e) { kq.push({ viec_id: v.viec_id, loi: String(e.message || e).slice(0, 160) }); } finally { await page.close().catch(() => {}); }
}
for (const c of Object.values(ctx)) if (c) await c.close().catch(() => {});
loHub("content_os.seeding_kiem", kq);
const loi = kq.filter((k) => k.loi);
bao({ b: loi.length * 2 > kq.length ? "loi" : "ok", ket_qua: [{ man: "kiểm bài seeding", dong: kq.length, moi: kq.length - loi.length, loi: loi.length ? true : undefined, msg: loi.map((l) => l.loi).slice(0, 3).join(" · ") || undefined }] });
log("kiểm xong", kq.length - loi.length, "/", ds.length);
