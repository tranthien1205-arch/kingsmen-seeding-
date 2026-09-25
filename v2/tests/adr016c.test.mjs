// Gán nhãn chi tiết (chủ 25/09): gán từng khung khi một dải có nhiều nội dung · mô tả đúng do người viết (thành ví dụ cho lần đọc sau) · bước mới thêm vào quy trình chuẩn của dòng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async () => null, put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

test('016c: gán từng khung, mô tả đúng, bước mới vào quy trình', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await api('/danh-muc/san_pham', 'POST', { ma: 'F', ten: 'Finex F300', dong: 'Finex', quy_trinh: 'Vệ sinh nền' });
  await may('/hub/thanh-pham', 'POST', { ten: 'f.mp4', nguon_id: 'f', nguon: 'TIKTOK', dai: 20, dong: 'Finex', shots: [{ t0: 0, t1: 10 }, { t0: 10, t1: 20 }],
    timeline: [{ tu: 0, den: 10, nhom: 'THI_CONG', buoc: 'Gạt / miết / làm phẳng', mo_ta: 'dùng dao gạt vật liệu', can_xac_nhan: true, khung_url: '/media/media/d.jpg' }, { tu: 10, den: 20, nhom: 'HOAN_THIEN', can_xac_nhan: true }] });
  const tp = DB.raw.prepare(`SELECT id FROM kho_thanh_pham`).get().id;
  // khung 1–2 gạt bằng bay răng (bước mới, thêm vào quy trình), khung 3 khò nhiệt
  let r = await api('/kho-thanh-pham/' + tp + '/doan/0', 'POST', { nhe: true, them_buoc: true, phan: [
    { nhom: 'THI_CONG', buoc: 'Cán vật liệu bằng bay răng', mo_ta: 'gạt Finex bằng bay răng vàng' }, { nhom: 'THI_CONG', buoc: 'Cán vật liệu bằng bay răng' }, { nhom: 'THI_CONG', buoc: 'Khò nhiệt phá bọt khí', mo_ta: 'dùng máy khò nhiệt' }] });
  assert.equal(r.s, 200); assert.equal(r.j.dung, false, 'máy nói bước chung → sai chi tiết');
  const nguoi = () => JSON.parse(DB.raw.prepare(`SELECT nhan_nguoi FROM mau_doan WHERE id=?`).get('H:' + tp + ':0').nhan_nguoi); const d = nguoi();
  assert.equal(d.buoc, 'Cán vật liệu bằng bay răng', 'nhãn cả đoạn = nhóm/bước nhiều nhất'); assert.equal(d.phan.length, 3); assert.equal(d.phan[2].buoc, 'Khò nhiệt phá bọt khí');
  assert.equal(d.mo_ta, 'gạt Finex bằng bay răng vàng', 'mô tả khung đầu thành mô tả đoạn'); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM bo_nhan WHERE truong='buoc' AND ten='Khò nhiệt phá bọt khí' AND trang_thai='DE_XUAT'`).get().n, 1, 'bước khung lẻ chưa có → đề xuất'); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM bo_nhan WHERE ten='Cán vật liệu bằng bay răng' AND trang_thai='DE_XUAT'`).get().n, 0, 'bước đã thêm vào quy trình → không còn đề xuất');
  const qt = DB.raw.prepare(`SELECT quy_trinh FROM san_pham WHERE dong='Finex'`).get().quy_trinh.split('\n'); assert.deepEqual(qt, ['Vệ sinh nền', 'Cán vật liệu bằng bay răng'], 'bước mới vào quy trình, không trùng');
  // gán lại đoạn: mẫu từng khung cũ bị thay
  r = await api('/kho-thanh-pham/' + tp + '/doan/0', 'POST', { nhe: true, nhom: 'THI_CONG', buoc: 'Cán vật liệu bằng bay răng', mo_ta: 'gạt Finex bằng bay răng vàng trên nền gạch cũ' });
  assert.equal(nguoi().phan, undefined, 'gán lại cả đoạn thì bỏ nhãn từng khung cũ');
  assert.equal(nguoi().mo_ta, 'gạt Finex bằng bay răng vàng trên nền gạch cũ');
  // mô tả người viết thành ví dụ cho lần đọc hình sau
  const spId = DB.raw.prepare(`SELECT id FROM san_pham WHERE dong='Finex'`).get().id; const mucId = (await api('/muc', 'POST', { tieu_de: 'Cải tạo sàn', dinh_dang: 'VIDEO', san_pham_id: spId })).j.id;
  await may('/hub/tai-san', 'POST', { muc_id: mucId, ten: 'A.mp4', media_url: '/media/media/a.mp4', media_type: 'VIDEO', giay: 5 });
  const v = (await may('/hub/viec/doc_khung?muc_id=' + mucId)).j.viec[0]; assert.ok(v.vi_du.some((x) => /bay răng vàng trên nền gạch cũ/.test(x)), 'ví dụ dùng mô tả người');
});
