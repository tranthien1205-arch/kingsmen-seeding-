// Kho mẫu + dòng sản phẩm (25/09): trạng thái mẫu theo mô hình mở / thầy / người; đổi tên dòng đổi ở mọi bảng + luật; máy học đọc luật nhận dòng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async () => null, put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

Math.random = () => 0.99;
test('017d: kho mẫu + dòng sản phẩm', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await api('/danh-muc/san_pham', 'POST', { ma: 'T', ten: 'Terrazo sàn', dong: 'Terrazo', quy_trinh: 'Trộn\nCán' });
  await may('/hub/thanh-pham', 'POST', { ten: 't.mp4', nguon_id: 't', nguon: 'TIKTOK', dai: 20, dong: 'Terrazo', shots: [{ t0: 0, t1: 10 }, { t0: 10, t1: 20 }], timeline: [
    { tu: 0, den: 5, nhom: 'THI_CONG', mo: { nhom: 'THI_CONG' }, thay: { nhom: 'THI_CONG', chac: 0.9 } },
    { tu: 5, den: 10, nhom: 'HOAN_THIEN', mo: { nhom: 'THI_CONG' }, thay: { nhom: 'HOAN_THIEN', chac: 0.7, ly_do: 'bề mặt xong' } },
    { tu: 10, den: 15, nhom: 'KHAC' }, { tu: 15, den: 20, nhom: 'KHAC' }] });
  const tp = DB.raw.prepare(`SELECT id FROM kho_thanh_pham`).get().id;
  await api('/kho-thanh-pham/' + tp + '/doan/2', 'POST', { nhe: true, nhom: 'NGUOI_NOI', mo_ta: 'chủ nhà nói' }); await api('/kho-thanh-pham/' + tp + '/doan/3', 'POST', { khong_ro: true });
  let k = (await api('/kho-mau?kn=K1')).j; assert.deepEqual(k.dem, { THAY_CHOT: 2, VANG: 1, KHONG_RO: 1 }); assert.equal(k.can, 0);
  const lech = (await api('/kho-mau?kn=K1&tt=THAY_CHOT&q=' + encodeURIComponent('bề mặt'))).j.hang[0]; assert.equal(lech.thay.ly_do, 'bề mặt xong'); assert.equal(lech.mo.nhom, 'THI_CONG'); assert.deepEqual(lech.quy_trinh, ['Trộn', 'Cán'], 'quy trình theo dòng để sửa bước');
  assert.equal((await api('/kho-mau?kn=K1&q=chủ nhà')).j.loc, 1, 'tìm theo mô tả người');
  // đổi tên dòng Terrazo → Terrazy: sản phẩm, video, mẫu, luật cùng đổi
  let d = (await api('/dong-san-pham')).j; assert.ok(d.dong.some((x) => x.dong === 'Terrazo' && x.video === 1 && x.san_pham === 1));
  const r = await api('/dong-san-pham/doi-ten', 'POST', { tu: 'Terrazo', sang: 'Terrazy' }); assert.equal(r.s, 200);
  assert.equal(DB.raw.prepare(`SELECT dong FROM san_pham`).get().dong, 'Terrazy'); assert.equal(DB.raw.prepare(`SELECT dong FROM kho_thanh_pham`).get().dong, 'Terrazy');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE dong='Terrazo'`).get().n, 0); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE dong='Terrazy'`).get().n, 4, 'kho mẫu đổi dòng theo');
  assert.ok(r.j.anh_xa_dong.some((x) => x.chua === 'TERRAZ' && x.dong === 'Terrazy'), 'luật trỏ dòng mới');
  // máy học đọc luật; sửa luật từ app
  assert.equal((await api('/cau-hinh/huan_luyen', 'PUT', { cau_hinh: { anh_xa_dong: [{ chua: 'SAN TERRAZ', dong: 'Terrazy' }] } })).s, 200);
  assert.deepEqual((await may('/hub/cau-hinh-hoc')).j.anh_xa_dong, [{ chua: 'SAN TERRAZ', dong: 'Terrazy' }]);
});
