// ĐĂNG BÀI CHO KINGSMEN CONTENT OS QUA TRÌNH DUYỆT ĐÃ ĐĂNG NHẬP TRÊN TRẠM (B9, cách đăng "TRAM").
// Content OS xếp bài (trạng thái DANG_GUI, cách TRAM) → sai Trạm chạy content_os/dang → script này:
//   1. hỏi /hub/viec/dang lấy danh sách bài, 2. theo loại kênh: TIKTOK → TikTok Studio upload bằng hồ sơ tiktok_cn-profile;
//   FACEBOOK → Content OS tự đăng qua Graph API nên ở đây chỉ nhận khi kênh đặt TRAM (đăng bằng facebook-profile lên Page);
//   nền tảng khác → báo hỏng rõ lý do. 3. báo kết quả từng bài bằng ::TRAM lô "content_os.dang_ket_qua".
// RANH GIỚI: gặp captcha/xác minh → dừng, báo hỏng, KHÔNG vượt. Không đăng lại bài đã đăng (Content OS chỉ đưa bài DANG_GUI).
import { bao, loHub } from "./_env.mjs";
import { appContentOS, goiApp, taiVe, moHoSo, log } from "./content-os-lib.mjs";

const XEM = process.argv.includes("--xem");
const app = appContentOS();
const r = await goiApp(app, "/hub/viec/dang");
if (!r.ok) { bao({ b: "loi", m: "không hỏi được việc đăng (HTTP " + r.status + " " + (r.d.error || "") + ")" }); process.exit(1); }
const ds = Array.isArray(r.d.viec) ? r.d.viec : [];
if (!ds.length) { bao({ b: "ok", ket_qua: [{ man: "không có bài chờ Trạm đăng", dong: 0, moi: 0 }] }); log("Không có bài nào chờ Trạm."); process.exit(0); }
log("có", ds.length, "bài chờ Trạm đăng");
const kq = []; let ctxTT = null, ctxFB = null;
async function dangTikTok(v) {
  if (!ctxTT) ctxTT = await moHoSo("tiktok_cn", { headless: false });
  if (!ctxTT) return { ok: false, loi: "chưa đăng nhập TikTok trên Trạm (agent 'TikTok kênh cá nhân')" };
  if (!v.media_url) return { ok: false, loi: "bài không có video/ảnh" };
  const file = await taiVe(v.media_url, v.bai_dang_id + (v.dinh_dang === "VIDEO" ? ".mp4" : ".jpg"));
  const page = await ctxTT.newPage();
  try {
    await page.goto("https://www.tiktok.com/tiktokstudio/upload", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    if (/login|signin/.test(page.url())) return { ok: false, loi: "phiên TikTok hết hạn — đăng nhập lại trên Trạm" };
    const input = page.locator('input[type="file"]').first(); await input.setInputFiles(file);
    // chờ TikTok xử lý xong video (thanh tiến trình biến mất / ô caption hiện)
    const cap = page.locator('[contenteditable="true"]').first(); await cap.waitFor({ timeout: 120000 });
    await page.waitForTimeout(8000);
    await cap.click(); await page.keyboard.press("Control+A"); await page.keyboard.type(String(v.noi_dung || "").slice(0, 2000), { delay: 5 });
    try { bao({ b: "anh", jpg: (await page.screenshot({ type: "jpeg", quality: 45 })).toString("base64") }); } catch {}
    if (XEM) return { ok: false, loi: "chế độ --xem: không bấm Đăng" };
    const nut = page.locator('button:has-text("Đăng"), button:has-text("Post"), [data-e2e="post_video_button"]').first();
    await nut.waitFor({ timeout: 30000 }); await nut.click();
    // TikTok chuyển sang trang quản lý nội dung hoặc hiện hộp "đã đăng"
    await page.waitForTimeout(12000);
    const daDang = await page.locator('text=/đã đăng|posted|Your video is being uploaded|Manage your posts|Quản lý bài đăng/i').count();
    if (!daDang && /upload/.test(page.url())) return { ok: false, loi: "TikTok không xác nhận đã đăng (xem ảnh màn hình)" };
    return { ok: true, link: "" };   // TikTok chưa cho link ngay; đo lường lấy link từ trang hồ sơ sau
  } catch (e) { return { ok: false, loi: "TikTok: " + String(e.message || e).slice(0, 200) }; }
  finally { await page.close().catch(() => {}); }
}
async function dangFacebook(v) {
  if (!ctxFB) ctxFB = await moHoSo("facebook", { headless: false });
  if (!ctxFB) return { ok: false, loi: "chưa đăng nhập Facebook trên Trạm — hoặc đặt kênh sang cách đăng API (token Page)" };
  if (!v.kenh || !v.kenh.doi_tuong) return { ok: false, loi: "kênh chưa có Page ID/tên Page" };
  const page = await ctxFB.newPage();
  try {
    await page.goto("https://www.facebook.com/" + v.kenh.doi_tuong, { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(4000);
    if (/login|checkpoint/.test(page.url())) return { ok: false, loi: "phiên Facebook hết hạn / checkpoint — đăng nhập lại trên Trạm" };
    const oSoan = page.locator('[role="button"]:has-text("Bạn đang nghĩ gì"), [role="button"]:has-text("What\'s on your mind"), [role="button"]:has-text("Tạo bài viết")').first();
    await oSoan.waitFor({ timeout: 20000 }); await oSoan.click(); await page.waitForTimeout(2000);
    const hop = page.locator('[role="dialog"] [contenteditable="true"]').first(); await hop.waitFor({ timeout: 20000 }); await hop.click(); await page.keyboard.type(String(v.noi_dung || "").slice(0, 5000), { delay: 3 });
    if (v.media_url) { const file = await taiVe(v.media_url, v.bai_dang_id + (v.dinh_dang === "VIDEO" ? ".mp4" : ".jpg")); const inp = page.locator('[role="dialog"] input[type="file"]').first(); if (await inp.count()) { await inp.setInputFiles(file); await page.waitForTimeout(6000); } }
    try { bao({ b: "anh", jpg: (await page.screenshot({ type: "jpeg", quality: 45 })).toString("base64") }); } catch {}
    if (XEM) return { ok: false, loi: "chế độ --xem: không bấm Đăng" };
    const nut = page.locator('[role="dialog"] [aria-label="Đăng"], [role="dialog"] [aria-label="Post"]').first(); await nut.waitFor({ timeout: 20000 }); await nut.click();
    await page.waitForTimeout(10000);
    return { ok: true, link: "" };
  } catch (e) { return { ok: false, loi: "Facebook: " + String(e.message || e).slice(0, 200) }; }
  finally { await page.close().catch(() => {}); }
}
let i = 0;
for (const v of ds) {
  i++; bao({ b: "buoc", i, n: ds.length, m: "đăng " + (v.tieu_de || v.bai_dang_id) + " → " + (v.kenh && v.kenh.ten) });
  const loai = String((v.kenh && v.kenh.loai) || "").toUpperCase();
  let x;
  if (/TIKTOK/.test(loai)) x = await dangTikTok(v);
  else if (/FANPAGE|FACEBOOK/.test(loai)) x = await dangFacebook(v);
  else x = { ok: false, loi: "Trạm chưa có cách đăng cho kênh loại " + (loai || "?") + " (có: TIKTOK, FANPAGE)" };
  kq.push({ bai_dang_id: v.bai_dang_id, ok: !!x.ok, link: x.link || "", loi: x.loi || "" });
  log(v.bai_dang_id, x.ok ? "✓ đã đăng" : "✗ " + x.loi);
}
for (const c of [ctxTT, ctxFB]) if (c) await c.close().catch(() => {});
loHub("content_os.dang_ket_qua", kq);
const hong = kq.filter((k) => !k.ok);
bao({ b: hong.length * 2 > kq.length ? "loi" : "ok", ket_qua: [{ man: "đăng bài Content OS", dong: kq.length, moi: kq.length - hong.length, loi: hong.length ? true : undefined, msg: hong.map((h) => h.loi).slice(0, 3).join(" · ") || undefined }] });
