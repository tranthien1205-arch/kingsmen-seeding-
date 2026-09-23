// ĐĂNG SEEDING VÀO HỘI NHÓM FACEBOOK BẰNG TÀI KHOẢN CỦA PHÒNG MKT TRÊN TRẠM (B15 — ADR-007, bản vẽ §11). Không Sales, không tiền.
//   Mỗi việc ghi tài khoản → hồ sơ trình duyệt trên Trạm: <tram_id>-profile (facebook-profile, facebook-2-profile…), đã đăng nhập một lần bằng tay.
//   Mở link nhóm → ô "Bạn viết gì đi…" → gõ biến thể (gõ chậm như người) → Đăng → lấy link bài; nhóm QTV duyệt → báo cho_quan_tri.
// RANH GIỚI: checkpoint/captcha/xác minh → dừng tài khoản đó, báo checkpoint:true (Content OS tự tạm dừng 24h), KHÔNG vượt.
//            Mỗi lượt tối đa --toi-da bài (mặc định 5), giãn 2–4 phút giữa hai bài, không đăng 2 bài liên tiếp cùng tài khoản.
import { bao, loHub } from "./_env.mjs";
import { appContentOS, goiApp, moHoSo, log } from "./content-os-lib.mjs";

const XEM = process.argv.includes("--xem");
const TOI_DA = Number((process.argv.find((a) => a.startsWith("--toi-da=")) || "").split("=")[1]) || 5;
const app = appContentOS();
const r = await goiApp(app, "/hub/viec/seeding_dang");
if (!r.ok) { bao({ b: "loi", m: "không hỏi được việc seeding (HTTP " + r.status + ")" }); process.exit(1); }
// xen kẽ tài khoản: sắp xếp để hai việc liền nhau khác tài khoản khi có thể
const goc = Array.isArray(r.d.viec) ? r.d.viec : []; const ds = []; const con = [...goc];
while (con.length && ds.length < TOI_DA) { const truoc = ds.length ? ds[ds.length - 1].tai_khoan.tram_id : null; let i = con.findIndex((v) => v.tai_khoan.tram_id !== truoc); if (i < 0) i = 0; ds.push(con.splice(i, 1)[0]); }
if (!ds.length) { bao({ b: "ok", ket_qua: [{ man: "không có việc seeding chờ Trạm", dong: 0, moi: 0 }] }); process.exit(0); }
const kq = []; const ctx = {}; const dung = new Set();
const cho = (ms) => new Promise((x) => setTimeout(x, ms));
async function dangFB(v) {
  const tk = (v.tai_khoan && v.tai_khoan.tram_id) || "facebook";
  if (!ctx[tk]) ctx[tk] = await moHoSo(tk, { headless: false });
  if (!ctx[tk]) return { ok: false, loi: "chưa đăng nhập Facebook trên Trạm (hồ sơ " + tk + "-profile)" };
  const page = await ctx[tk].newPage();
  try {
    await page.goto(String(v.nhom.link_hoac_id).replace(/\/+$/, ""), { waitUntil: "domcontentloaded", timeout: 60000 }); await page.waitForTimeout(4000 + Math.random() * 3000);
    if (/login|checkpoint|two_step|verify/.test(page.url())) return { ok: false, checkpoint: true, loi: "phiên Facebook cần đăng nhập/xác minh lại (" + page.url().slice(0, 60) + ")" };
    const t0 = await page.locator("body").innerText().catch(() => "");
    if (/Tham gia nhóm|Join group/i.test(t0) && !/Đã tham gia|Joined/i.test(t0)) return { ok: false, loi: "tài khoản " + tk + " chưa là thành viên nhóm " + (v.nhom.ten || "") };
    const oSoan = page.locator('[role="button"]:has-text("Bạn viết gì đi"), [role="button"]:has-text("Write something"), [role="button"]:has-text("Bạn đang nghĩ gì"), [role="button"]:has-text("Tạo bài viết")').first();
    await oSoan.waitFor({ timeout: 25000 }); await oSoan.click(); await page.waitForTimeout(2500);
    const hop = page.locator('[role="dialog"] [contenteditable="true"]').first(); await hop.waitFor({ timeout: 20000 }); await hop.click();
    for (const doan of String(v.noi_dung || "").slice(0, 5000).split("\n")) { await page.keyboard.type(doan, { delay: 12 + Math.random() * 30 }); await page.keyboard.press("Shift+Enter"); await page.waitForTimeout(200 + Math.random() * 500); }
    await page.waitForTimeout(1500);
    try { bao({ b: "anh", jpg: (await page.screenshot({ type: "jpeg", quality: 45 })).toString("base64") }); } catch {}
    if (XEM) return { ok: false, loi: "chế độ --xem: không bấm Đăng" };
    const nut = page.locator('[role="dialog"] [aria-label="Đăng"], [role="dialog"] [aria-label="Post"]').first(); await nut.waitFor({ timeout: 20000 }); await nut.click();
    await page.waitForTimeout(12000);
    const t1 = await page.locator("body").innerText().catch(() => "");
    if (/chờ quản trị viên phê duyệt|pending approval|đang chờ duyệt|Bài viết của bạn đang chờ/i.test(t1)) return { ok: true, cho_quan_tri: true, link: "", msg_id: "", ghi_chu: "chờ quản trị nhóm duyệt" };
    // link bài vừa đăng: bài mới nhất của mình trong nhóm
    let link = ""; try { const a = page.locator('[role="article"] a[href*="/posts/"], [role="article"] a[href*="permalink"], a[href*="/posts/"]').first(); if (await a.count()) link = (await a.getAttribute("href")) || ""; if (link && !/^https?:/.test(link)) link = "https://www.facebook.com" + link; } catch {}
    return { ok: true, link: link.split("?")[0], msg_id: "" };
  } catch (e) { const m = String(e.message || e); return { ok: false, checkpoint: /checkpoint|captcha/i.test(m), loi: "Facebook: " + m.slice(0, 200) }; }
  finally { await page.close().catch(() => {}); }
}
let i = 0;
for (const v of ds) {
  i++; bao({ b: "buoc", i, n: ds.length, m: "đăng seeding → " + (v.nhom && v.nhom.ten) + " (" + (v.tai_khoan && v.tai_khoan.nhan) + ")" });
  const tk = v.tai_khoan && v.tai_khoan.tram_id; let x;
  if (dung.has(tk)) x = { ok: false, loi: "tài khoản " + tk + " vừa gặp checkpoint — bỏ qua lượt này" };
  else x = await dangFB(v);
  if (x.checkpoint) dung.add(tk);
  kq.push({ viec_id: v.viec_id, ok: !!x.ok, link: x.link || "", msg_id: x.msg_id || "", loi: x.loi || "", checkpoint: !!x.checkpoint, cho_quan_tri: !!x.cho_quan_tri, ghi_chu: x.ghi_chu || "" });
  log(v.viec_id, x.ok ? "✓ đã đăng" + (x.cho_quan_tri ? " (chờ QTV)" : "") : "✗ " + x.loi);
  if (i < ds.length) await cho(120000 + Math.random() * 120000);   // giãn 2–4 phút
}
for (const c of Object.values(ctx)) if (c) await c.close().catch(() => {});
loHub("content_os.seeding_dang_ket_qua", kq);
const hong = kq.filter((k) => !k.ok);
bao({ b: hong.length * 2 > kq.length ? "loi" : "ok", ket_qua: [{ man: "đăng seeding hội nhóm", dong: kq.length, moi: kq.length - hong.length, loi: hong.length ? true : undefined, msg: hong.map((h) => h.loi).slice(0, 3).join(" · ") || undefined }] });
