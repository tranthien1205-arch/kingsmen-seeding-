// ADR-T01 (Trạm bản 3) phía Content OS: nhịp tim mang tai_khoan[] + nhan_vien[] → app lưu, tự khai tài khoản seeding mới,
// tôn trọng tài khoản Trạm đang dừng (dung_den) khi xếp lịch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null, KHOA = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, {}); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hub = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': KHOA }, body: body ? JSON.stringify(body) : undefined }), env, {}); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const NHIP = (them) => Object.assign({ may: 'Ngoc-Han', ban: '9.161', gio_may: '2026-09-24 10:00', dung_nha: true,
  phien: { 'facebook-2': { ten: 'Anh Tư', tt: 'ok', co_phien: true }, 'facebook-3': { ten: 'Thầu Bảy', tt: 'loi', co_phien: true, dung_den: new Date(Date.now() + 20 * 3600e3).toISOString() } },
  tai_khoan: [
    { id: 'facebook', nen: 'facebook', ten: 'Facebook chính', co_phien: true, tt: 'nghi' },
    { id: 'facebook-2', nen: 'facebook', ten: 'Anh Tư', co_phien: true, tt: 'ok' },
    { id: 'facebook-3', nen: 'facebook', ten: 'Thầu Bảy', co_phien: true, tt: 'loi', dung_den: new Date(Date.now() + 20 * 3600e3).toISOString(), checkpoint_30d: 1 },
    { id: 'tiktok_cn', nen: 'tiktok', ten: 'TikTok #1', co_phien: true, tt: 'nghi' } ],
  nhan_vien: [
    { nv: 'content_os:seeding', ten: 'Seeding hội nhóm', agent: 'content_os', tam_nghi: false, viec: ['seeding_dang'], cap: [
      { tk: 'facebook', vai: ['kiem'], tran: {} }, { tk: 'facebook-2', vai: ['dang', 'binh_luan', 'nuoi'], tran: { bai_ngay: 3 } }, { tk: 'facebook-3', vai: ['dang', 'binh_luan'], tran: { bai_ngay: 1 } } ] },
    { nv: 'content_os:dang_do', ten: 'Đăng bài & đo lường', agent: 'content_os', cap: [{ tk: 'facebook', vai: ['dang', 'kiem'], tran: {} }, { tk: 'tiktok_cn', vai: ['dang', 'kiem'], tran: {} }] } ] }, them || {});

test('nhịp tim Trạm bản 3: app lưu tai_khoan + nhan_vien, TỰ KHAI tài khoản seeding facebook được cấp vai đăng (không khai facebook chính / tiktok), không khai trùng', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  KHOA = JSON.parse(Buffer.from((await api('/tram/khoa', 'POST')).j.ma_ghep.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).khoa;
  let h = await hub('/hub/trang_thai', 'POST', NHIP());
  assert.equal(h.s, 200); assert.equal(h.j.tu_khai, 2);
  const db = (await api('/bootstrap')).j.db;
  const tks = db.seeding.tai_khoan; const ids = tks.map(t => t.tram_id).sort();
  assert.deepEqual(ids, ['facebook-2', 'facebook-3']);
  const t2 = tks.find(t => t.tram_id === 'facebook-2'); assert.equal(t2.nhan, 'Anh Tư'); assert.equal(t2.giong, 'THO'); assert.equal(t2.nhip_ngay, 3); assert.equal(t2.persona.tu_tram, true);
  assert.equal(tks.find(t => t.tram_id === 'facebook-3').nhip_ngay, 1);
  assert.equal(db.tram.trang_thai.nhan_vien.length, 2); assert.equal(db.tram.trang_thai.tai_khoan.length, 4);
  assert.equal(db.tram.trang_thai.phien['facebook-3'].dung_den.length > 10, true);
  h = await hub('/hub/trang_thai', 'POST', NHIP()); assert.equal(h.j.tu_khai, 0);
  assert.equal((await api('/bootstrap')).j.db.seeding.tai_khoan.length, 2);
  // đổi tên trên Trạm không đè nhãn người đã sửa
  await api('/seeding/tai-khoan/' + t2.id, 'PATCH', { nhan: 'Anh Tư thợ ốp' });
  await hub('/hub/trang_thai', 'POST', NHIP());
  assert.equal((await api('/bootstrap')).j.db.seeding.tai_khoan.find(t => t.tram_id === 'facebook-2').nhan, 'Anh Tư thợ ốp');
});
