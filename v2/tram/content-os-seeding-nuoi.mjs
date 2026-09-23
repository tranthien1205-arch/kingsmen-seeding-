// NUÔI TÀI KHOẢN SEEDING (ADR-007b) — mỗi ngày tài khoản MKT vào một nhóm của nó: cuộn xem vài phút, thả tim vài bài. Không bình luận, không đăng.
//   hỏi /hub/viec/seeding_nuoi → mở nhóm bằng hồ sơ tài khoản → cuộn ngẫu nhiên, thả tim N bài → lô content_os.seeding_nuoi_ket_qua {id, ok, tim, xem_phut, loi, checkpoint}.
import { bao, loHub } from "./_env.mjs";
import { appContentOS, goiApp, moHoSo, log } from "./content-os-lib.mjs";

const app = appContentOS();
const r = await goiApp(app, "/hub/viec/seeding_nuoi");
if (!r.ok) { bao({ b: "loi", m: "không hỏi được việc nuôi (HTTP " + r.status + ")" }); process.exit(1); }
const ds = (Array.isArray(r.d.viec) ? r.d.viec : []).slice(0, 5);
if (!ds.length) { bao({ b: "ok", ket_qua: [{ man: "không có lượt nuôi chờ", dong: 0, moi: 0 }] }); process.exit(0); }
const kq = []; const ctx = {}; const cho = (ms) => new Promise((x) => setTimeout(x, ms)); let i = 0;
for (const v of ds) {
  i++; bao({ b: "buoc", i, n: ds.length, m: "nuôi " + (v.tai_khoan && v.tai_khoan.nhan) + " ở " + (v.nhom && v.nhom.ten) });
  const tk = (v.tai_khoan && v.tai_khoan.tram_id) || "facebook"; let x;
  if (!ctx[tk]) ctx[tk] = await moHoSo(tk, { headless: false });
  if (!ctx[tk]) x = { ok: false, loi: "chưa đăng nhập Facebook trên Trạm (hồ sơ " + tk + "-profile)" };
  else { const page = await ctx[tk].newPage(); const t0 = Date.now(); let tim = 0;
    try { await page.goto(String(v.nhom.link_hoac_id).replace(/\/+$/, ""), { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(5000);
      if (/login|checkpoint|two_step|verify/.test(page.url())) x = { ok: false, checkpoint: true, loi: "phiên cần đăng nhập/xác minh" };
      else { const het = Date.now() + Math.max(1, v.phut || 4) * 60000;
        while (Date.now() < het) { await page.mouse.wheel(0, 400 + Math.random() * 900); await page.waitForTimeout(3000 + Math.random() * 6000);
          if (tim < (v.tim || 3) && Math.random() < 0.35) { try { const nut = page.locator('[aria-label="Thích"], [aria-label="Like"]').filter({ hasNot: page.locator('[aria-pressed="true"]') }); const n = await nut.count(); if (n) { await nut.nth(Math.floor(Math.random() * Math.min(n, 5))).click({ timeout: 3000 }); tim++; await page.waitForTimeout(1500 + Math.random() * 2500); } } catch {} } }
        x = { ok: true, tim, xem_phut: +((Date.now() - t0) / 60000).toFixed(1) }; }
    } catch (e) { const m = String(e.message || e); x = { ok: false, checkpoint: /checkpoint|captcha/i.test(m), loi: "Facebook: " + m.slice(0, 160), tim }; }
    finally { await page.close().catch(() => {}); } }
  kq.push({ id: v.id, ok: !!x.ok, tim: x.tim || 0, xem_phut: x.xem_phut || 0, loi: x.loi || "", checkpoint: !!x.checkpoint }); log(v.id, x.ok ? "✓ nuôi xong, tim " + x.tim : "✗ " + x.loi);
  if (i < ds.length) await cho(30000 + Math.random() * 60000);
}
for (const c of Object.values(ctx)) if (c) await c.close().catch(() => {});
loHub("content_os.seeding_nuoi_ket_qua", kq);
const hong = kq.filter((k) => !k.ok);
bao({ b: hong.length * 2 > kq.length ? "loi" : "ok", ket_qua: [{ man: "nuôi tài khoản", dong: kq.length, moi: kq.length - hong.length, loi: hong.length ? true : undefined, msg: hong.map((h) => h.loi).slice(0, 3).join(" · ") || undefined }] });
