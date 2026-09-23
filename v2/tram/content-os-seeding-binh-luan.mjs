// BÌNH LUẬN DẪN DẮT DƯỚI BÀI SEEDING (ADR-007b) — tài khoản MKT khác trong nhóm bình luận theo vai (hỏi kinh nghiệm / xác nhận / hỏi mua).
//   hỏi /hub/viec/seeding_binh_luan → mở link bài bằng hồ sơ <tram_id>-profile → ô bình luận → gõ chậm → Enter → lô content_os.seeding_binh_luan_ket_qua.
// RANH GIỚI: checkpoint → báo, không vượt; giãn 1–3 phút giữa hai bình luận; không bình luận hai lần cùng bài trong một lượt.
import { bao, loHub } from "./_env.mjs";
import { appContentOS, goiApp, moHoSo, log } from "./content-os-lib.mjs";

const XEM = process.argv.includes("--xem");
const app = appContentOS();
const r = await goiApp(app, "/hub/viec/seeding_binh_luan");
if (!r.ok) { bao({ b: "loi", m: "không hỏi được việc bình luận (HTTP " + r.status + ")" }); process.exit(1); }
const ds = (Array.isArray(r.d.viec) ? r.d.viec : []).slice(0, 8);
if (!ds.length) { bao({ b: "ok", ket_qua: [{ man: "không có bình luận dẫn dắt chờ", dong: 0, moi: 0 }] }); process.exit(0); }
const kq = []; const ctx = {}; const dung = new Set(); const cho = (ms) => new Promise((x) => setTimeout(x, ms)); let i = 0;
for (const v of ds) {
  i++; bao({ b: "buoc", i, n: ds.length, m: "bình luận (" + (v.tai_khoan && v.tai_khoan.nhan) + "): " + v.text.slice(0, 40) });
  const tk = (v.tai_khoan && v.tai_khoan.tram_id) || "facebook"; let x;
  if (dung.has(tk)) x = { ok: false, loi: "tài khoản " + tk + " vừa gặp checkpoint" };
  else if (!v.link) x = { ok: false, loi: "việc không có link bài" };
  else {
    if (!ctx[tk]) ctx[tk] = await moHoSo(tk, { headless: false });
    if (!ctx[tk]) x = { ok: false, loi: "chưa đăng nhập Facebook trên Trạm (hồ sơ " + tk + "-profile)" };
    else { const page = await ctx[tk].newPage();
      try { await page.goto(v.link, { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(4000 + Math.random() * 3000);
        if (/login|checkpoint|two_step|verify/.test(page.url())) x = { ok: false, checkpoint: true, loi: "phiên cần đăng nhập/xác minh (" + page.url().slice(0, 50) + ")" };
        else { const o = page.locator('[aria-label="Viết bình luận…"], [aria-label="Viết bình luận"], [aria-label*="Write a comment"], [contenteditable="true"][aria-label*="bình luận"]').first(); await o.waitFor({ timeout: 25000 }); await o.click(); await page.waitForTimeout(800 + Math.random() * 800);
          await page.keyboard.type(String(v.text || "").slice(0, 300), { delay: 40 + Math.random() * 60 }); await page.waitForTimeout(1200);
          if (XEM) x = { ok: false, loi: "chế độ --xem: không gửi" }; else { await page.keyboard.press("Enter"); await page.waitForTimeout(5000); x = { ok: true }; } }
      } catch (e) { const m = String(e.message || e); x = { ok: false, checkpoint: /checkpoint|captcha/i.test(m), loi: "Facebook: " + m.slice(0, 160) }; }
      finally { await page.close().catch(() => {}); } }
  }
  if (x.checkpoint) dung.add(tk);
  kq.push({ id: v.id, ok: !!x.ok, loi: x.loi || "", checkpoint: !!x.checkpoint }); log(v.id, x.ok ? "✓ đã bình luận" : "✗ " + x.loi);
  if (i < ds.length) await cho(60000 + Math.random() * 120000);
}
for (const c of Object.values(ctx)) if (c) await c.close().catch(() => {});
loHub("content_os.seeding_binh_luan_ket_qua", kq);
const hong = kq.filter((k) => !k.ok);
bao({ b: hong.length * 2 > kq.length ? "loi" : "ok", ket_qua: [{ man: "bình luận dẫn dắt", dong: kq.length, moi: kq.length - hong.length, loi: hong.length ? true : undefined, msg: hong.map((h) => h.loi).slice(0, 3).join(" · ") || undefined }] });
