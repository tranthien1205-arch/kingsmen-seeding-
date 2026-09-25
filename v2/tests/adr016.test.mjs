// ADR-016 — nhãn vàng: hàng đợi gán nhãn (footage + video thành phẩm, đoạn máy chưa chắc trước, xen đoạn ngẫu nhiên),
// gán nhãn chung cho hai nguồn, "hình không rõ" không thành mẫu, gán lại không đếm hai lần, học lại thành phẩm giữ nhãn người, bảng đo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('export default async function x(){}') }, MEDIA: { get: async () => null, put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

test('016: hàng đợi nhãn vàng + gán nhãn hai nguồn + bảng đo', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await may('/hub/trang_thai', 'POST', { may: 'Q2', ffmpeg: true, ollama: true, gpu: 'RTX 3070 Ti, 8192 MiB', kha_nang: ['dung_video', 'mo_hinh'] });
  const sp = (await api('/danh-muc/san_pham', 'POST', { ma: 'FX', ten: 'Finex', dong: 'Finex', quy_trinh: 'Vệ sinh\nLăn lót\nTrát', bai_test: 'Đổ nước\nCào dao' })).j.id;
  const mucId = (await api('/muc', 'POST', { tieu_de: 'Tường thấm', dinh_dang: 'VIDEO', san_pham_id: sp })).j.id;
  const ts = (await may('/hub/tai-san', 'POST', { muc_id: mucId, ten: 'A.mp4', media_url: '/media/media/a.mp4', media_type: 'VIDEO', giay: 9 })).j.id;
  await may('/hub/doc-khung', 'POST', { tai_san_id: ts, timeline: [
    { tu: 0, den: 3, nhom: 'THI_CONG', buoc: 'Trát', tu_tin: 1, can_xac_nhan: true, kiem_ngau_nhien: true, thay: { nhom: 'THI_CONG', chac: 0.9 }, khung_url: '/media/k0.jpg' },
    { tu: 3, den: 4.5, nhom: 'THI_CONG', buoc: 'Lăn lót', tu_tin: 0.5, can_xac_nhan: true, thay: { nhom: 'THI_CONG', chac: 0.5 }, khung_url: '/media/k1.jpg' },
    { tu: 4.5, den: 9, nhom: 'HOAN_THIEN', tu_tin: 0.9, can_xac_nhan: true, kiem_ngau_nhien: true, thay: { nhom: 'THI_CONG', chac: 0.9 }, khung_url: 'javascript:x' }] });
  // video thành phẩm: dòng thời gian lưu được, đoạn không có ảnh riêng lấy ảnh shot gần nhất
  const tpBody = { ten: 'dinh-vi.mp4', nguon_id: 'drv1', nguon: 'DRIVE', dai: 10, dong: 'Finex', shots: [{ t0: 0, t1: 5, khung_url: '/media/s0.jpg' }, { t0: 5, t1: 10, khung_url: '/media/s1.jpg' }],
    timeline: [{ tu: 0, den: 6, nhom: 'THI_CONG', buoc: 'Trát', tu_tin: 1, can_xac_nhan: true, kiem_ngau_nhien: true, thay: { nhom: 'THI_CONG', chac: 0.9 } }, { tu: 6, den: 10, nhom: 'BOI_CANH', tu_tin: 0.4, can_xac_nhan: true, thay: { nhom: 'THI_CONG', chac: 0.5 } }] };
  assert.equal((await may('/hub/thanh-pham', 'POST', tpBody)).s, 200);
  const tp = DB.raw.prepare(`SELECT id, phan_tich FROM kho_thanh_pham`).get(); assert.equal(JSON.parse(tp.phan_tich).timeline.length, 2);

  let h = (await api('/nhan-hinh/hang?n=10')).j; assert.equal(h.tong_doan, 5); assert.equal(h.con_lai, 5);
  assert.equal(h.hang[0].can_xac_nhan, true, 'đoạn chưa chắc trước'); assert.equal(h.hang[0].tu_tin, 0.4, 'thấp nhất trước');
  assert.ok(h.hang.some((x) => x.ngau_nhien), 'có xen đoạn ngẫu nhiên');
  const ftDoan = h.hang.find((x) => x.nguon === 'FOOTAGE' && x.i === 1); assert.deepEqual(ftDoan.quy_trinh, ['Vệ sinh', 'Lăn lót', 'Trát']); assert.deepEqual(ftDoan.bai_test_ds, ['Đổ nước', 'Cào dao']);
  const tpDoan = h.hang.find((x) => x.nguon === 'THANH_PHAM' && x.i === 1); assert.equal(tpDoan.khung_url, '/media/s1.jpg', 'ảnh shot gần nhất'); assert.deepEqual(tpDoan.quy_trinh, ['Vệ sinh', 'Lăn lót', 'Trát'], 'quy trình theo dòng');
  assert.equal(h.hang.find((x) => x.nguon === 'FOOTAGE' && x.i === 2).khung_url, null, 'ảnh lạ bị bỏ');

  // gán: footage đoạn 1 sửa (máy nói Lăn lót, người nói Vệ sinh); thành phẩm đoạn 1 xác nhận; footage đoạn 0 hình không rõ
  let r = await api('/tai-san/' + ts + '/doan/1', 'POST', { nhom: 'THI_CONG', buoc: 'Vệ sinh', nhe: true }); assert.equal(r.s, 200); assert.equal(r.j.dung, false); assert.equal(r.j.db, undefined, 'nhẹ: không trả db');
  r = await api('/kho-thanh-pham/' + tp.id + '/doan/1', 'POST', { nhom: 'BOI_CANH', ngau_nhien: true, nhe: true }); assert.equal(r.j.dung, true);
  r = await api('/tai-san/' + ts + '/doan/0', 'POST', { khong_ro: true }); assert.equal(r.j.bo_qua, true);
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang='nhan_khung'`).get().n, 2, 'không rõ → không thành mẫu');
  // gán lại đoạn đã gán: thay mẫu cũ, vẫn so với nhãn MÁY ban đầu
  r = await api('/tai-san/' + ts + '/doan/1', 'POST', { nhom: 'THI_CONG', buoc: 'Lăn lót', nhe: true }); assert.equal(r.j.dung, true, 'so với nhãn máy gốc');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang='nhan_khung'`).get().n, 2, 'gán lại không đếm hai lần');

  h = (await api('/nhan-hinh/hang?n=10')).j; assert.equal(h.da_gan, 3); assert.equal(h.con_lai, 2);
  const d = (await api('/bootstrap')).j.db.ai_nao.do_chinh_xac_hinh;
  assert.equal(d.so_nhan, 2); assert.equal(d.dung_nhom, 2); assert.equal(d.ngau_nhien.so, 1); assert.equal(d.theo_nguon.THANH_PHAM.so, 1); assert.equal(d.theo_nhom.THI_CONG.so, 1); assert.ok(Array.isArray(d.muc_tin));

  // học lại thành phẩm: nhãn người vẫn còn trong kho mẫu
  assert.equal((await may('/hub/thanh-pham', 'POST', { ...tpBody, lam_lai: true })).s, 200);
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang='nhan_khung'`).get().n, 2, 'học lại giữ nhãn vàng');
});
