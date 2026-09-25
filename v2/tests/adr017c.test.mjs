// Sửa lỗi đo được đêm 24–25/09: lệnh máy con đang giữ chờ không bị luật 30 phút đánh hỏng khi máy còn sống; video một cảnh vẫn học nhìn + nghe (không ghi mẫu ghép).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async () => null, put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

test('017c: hàng lệnh máy con + video một cảnh', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const q2 = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa), nh = hubK(giai((await api('/may-ghep', 'POST', { ten: 'NH' })).j.ma_ghep).khoa);
  await q2('/hub/trang_thai', 'POST', { may: 'Q2', dang_lam: 'hoc_thanh_pham' }); await nh('/hub/trang_thai', 'POST', { may: 'NH' });
  const q2id = DB.raw.prepare(`SELECT id FROM may_ghep WHERE ten='Q2'`).get().id;
  for (const k of ['a', 'b']) DB.raw.prepare(`INSERT INTO tram_lenh (id, viec, tham_so, trang_thai, may_id, created_at) VALUES (?, 'hoc_thanh_pham', '{}', 'CHO', ?, ?)`).run('l' + k, q2id, new Date().toISOString());
  assert.equal((await q2('/hub/lenh')).j.lenh.length, 2, 'Q2 lấy cả hai');
  DB.raw.prepare(`UPDATE tram_lenh SET gui_at=?`).run(new Date(Date.now() - 3 * 3600e3).toISOString());
  await nh('/hub/lenh');   // máy khác hỏi lệnh — trước đây đánh hỏng lệnh của Q2 sau 30 phút
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM tram_lenh WHERE trang_thai='DA_GUI'`).get().n, 2, 'Q2 còn sống → lệnh chờ không bị hỏng');
  DB.raw.prepare(`UPDATE may_ghep SET nhan_luc=? WHERE id=?`).run(new Date(Date.now() - 40 * 60000).toISOString(), q2id);
  await nh('/hub/lenh'); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM tram_lenh WHERE trang_thai='HONG'`).get().n, 2, 'Q2 mất nhịp tim → hỏng');

  // video một cảnh: 1 shot được nhận khi mot_canh; không ghi mẫu ghép; vẫn ghi câu lời
  let r = await q2('/hub/thanh-pham', 'POST', { ten: 'x.mp4', nguon_id: 'x', nguon: 'TIKTOK', dai: 5, shots: [{ t0: 0, t1: 5, loi: 'một câu nói đủ dài', nhom: 'NGUOI_NOI' }] }); assert.equal(r.s, 400, 'không cờ → vẫn đòi 2 shot');
  r = await q2('/hub/thanh-pham', 'POST', { ten: 'x.mp4', nguon_id: 'x', nguon: 'TIKTOK', dai: 5, mot_canh: true, shots: [{ t0: 0, t1: 5, loi: 'một câu nói đủ dài', nhom: 'NGUOI_NOI' }] }); assert.equal(r.s, 200);
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang='ghep_canh'`).get().n, 0);
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE loai='LOI'`).get().n, 1, 'ADR-018: câu lời vào kho mẫu');
});
