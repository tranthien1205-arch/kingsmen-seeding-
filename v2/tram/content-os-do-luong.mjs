// ĐO LƯỜNG SAU AIR BẰNG TRÌNH DUYỆT ĐÃ ĐĂNG NHẬP (B10) — cho nền tảng không có API đo (TikTok kênh cá nhân, Facebook khi
// không có token Page). Content OS gọi Graph/YouTube API cho kênh có token; Trạm lo phần còn lại.
//   1. hỏi /hub/viec/do_luong (bài đã đăng có link trong N ngày) → 2. mở từng link, đọc số TÍCH LUỸ trên trang
//   (xem · thích · bình luận · chia sẻ · lưu) → 3. lô "content_os.ket_qua" (Content OS tự tính phần tăng theo ngày).
// KHÔNG BỊA: không đọc được số nào thì báo loi cho bài đó, không ghi 0.
import { bao, loHub } from "./_env.mjs";
import { appContentOS, goiApp, moHoSo, log, soTu } from "./content-os-lib.mjs";

const app = appContentOS();
const r = await goiApp(app, "/hub/viec/do_luong");
if (!r.ok) { bao({ b: "loi", m: "không hỏi được danh sách bài (HTTP " + r.status + ")" }); process.exit(1); }
const ds = Array.isArray(r.d.viec) ? r.d.viec : [];
if (!ds.length) { bao({ b: "ok", ket_qua: [{ man: "không có bài cần đo", dong: 0, moi: 0 }] }); process.exit(0); }
const ngay = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const kq = []; const loi = []; let ctxTT = null, ctxFB = null, ctxAn = null;
async function docTikTok(v) {
  if (!ctxTT) ctxTT = (await moHoSo("tiktok_cn")) || (ctxAn ||= await (await import("playwright")).chromium.launchPersistentContext(process.cwd() + "/out/content-os/an-danh", { headless: true }));
  const page = await ctxTT.newPage();
  try {
    await page.goto(v.link, { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(5000);
    const lay = async (sel) => { const el = page.locator(sel).first(); return (await el.count()) ? soTu(await el.innerText()) : null; };
    const thich = await lay('[data-e2e="like-count"], [data-e2e="browse-like-count"]'), bl = await lay('[data-e2e="comment-count"], [data-e2e="browse-comment-count"]'), cs = await lay('[data-e2e="share-count"]'), luu = await lay('[data-e2e="undefined-count"], [data-e2e="favorite-count"]');
    let xem = await lay('[data-e2e="video-views"]');
    if (xem == null) { const t = await page.locator("body").innerText().catch(() => ""); const m = t.match(/([\d.,]+\s*[kKmM]?)\s*(lượt xem|views)/i); if (m) xem = soTu(m[1]); }
    if (thich == null && xem == null) return { loi: "không đọc được số (trang đổi giao diện hoặc cần đăng nhập)" };
    return { tich_luy: { luot_xem: xem || 0, tuong_tac: (thich || 0) + (bl || 0) + (cs || 0), binh_luan: bl || 0, chia_se: cs || 0, luu: luu || 0, thich: thich || 0 }, nen: "TIKTOK" };
  } catch (e) { return { loi: String(e.message || e).slice(0, 160) }; } finally { await page.close().catch(() => {}); }
}
async function docFacebook(v) {
  if (!ctxFB) ctxFB = await moHoSo("facebook");
  if (!ctxFB) return { loi: "chưa đăng nhập Facebook trên Trạm — đặt token Page để Content OS đo qua API" };
  const page = await ctxFB.newPage();
  try {
    await page.goto(v.link, { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(5000);
    const t = await page.locator("body").innerText().catch(() => "");
    const so = (re) => { const m = t.match(re); return m ? soTu(m[1]) : null; };
    const xem = so(/([\d.,]+\s*[kKmM]?)\s*(lượt xem|views)/i), cs = so(/([\d.,]+\s*[kKmM]?)\s*(lượt chia sẻ|shares?)/i), bl = so(/([\d.,]+\s*[kKmM]?)\s*(bình luận|comments?)/i);
    let thich = null; const al = page.locator('[aria-label*="cảm xúc"], [aria-label*="reactions"]').first(); if (await al.count()) thich = soTu(await al.getAttribute("aria-label"));
    if (xem == null && cs == null && bl == null && thich == null) return { loi: "không đọc được số trên trang Facebook" };
    return { tich_luy: { luot_xem: xem || 0, tuong_tac: (thich || 0) + (bl || 0) + (cs || 0), binh_luan: bl || 0, chia_se: cs || 0, luu: 0, thich: thich || 0 }, nen: "FACEBOOK" };
  } catch (e) { return { loi: String(e.message || e).slice(0, 160) }; } finally { await page.close().catch(() => {}); }
}
let i = 0;
for (const v of ds) {
  i++; bao({ b: "buoc", i, n: ds.length, m: "đo " + v.link });
  const x = /tiktok\.com/i.test(v.link) ? await docTikTok(v) : /facebook\.com|fb\.watch/i.test(v.link) ? await docFacebook(v) : { loi: "Trạm chưa đo được nền tảng của link này" };
  if (x.loi) { loi.push(v.bai_dang_id + ": " + x.loi); continue; }
  kq.push({ bai_dang_id: v.bai_dang_id, ngay, nen: x.nen, tich_luy: x.tich_luy, link: v.link });
}
for (const c of [ctxTT, ctxFB, ctxAn]) if (c) await c.close().catch(() => {});
if (kq.length) loHub("content_os.ket_qua", kq);
bao({ b: loi.length * 2 > ds.length ? "loi" : "ok", ket_qua: [{ man: "đo lường Content OS", dong: kq.length, moi: kq.length, loi: loi.length ? true : undefined, msg: loi.slice(0, 3).join(" · ") || undefined }] });
log("đo xong", kq.length, "/", ds.length, loi.length ? "· lỗi " + loi.length : "");
