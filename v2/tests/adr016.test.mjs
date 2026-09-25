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

Math.random = () => 0.99;   // ADR-018: tỉ lệ kiểm ngẫu nhiên do máy chủ quyết — ghim để test không lắc
test('016: hàng đợi nhãn vàng + gán nhãn hai nguồn + bảng đo', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await may('/hub/trang_thai', 'POST', { may: 'Q2', ffmpeg: true, ollama: true, gpu: 'RTX 3070 Ti, 8192 MiB', kha_nang: ['dung_video', 'mo_hinh'] });
  const sp = (await api('/danh-muc/san_pham', 'POST', { ma: 'FX', ten: 'Finex', dong: 'Finex', quy_trinh: 'Vệ sinh\nLăn lót\nTrát', bai_test: 'Đổ nước\nCào dao' })).j.id;
  const mucId = (await api('/muc', 'POST', { tieu_de: 'Tường thấm', dinh_dang: 'VIDEO', san_pham_id: sp })).j.id;
  const ts = (await may('/hub/tai-san', 'POST', { muc_id: mucId, ten: 'A.mp4', media_url: '/media/media/a.mp4', media_type: 'VIDEO', giay: 9 })).j.id;
  await may('/hub/doc-khung', 'POST', { tai_san_id: ts, timeline: [
    { tu: 0, den: 3, nhom: 'THI_CONG', buoc: 'Trát', tu_tin: 1, can_xac_nhan: true, kiem_ngau_nhien: true, thay: { nhom: 'THI_CONG', chac: 0.9 }, khung_url: '/media/k0.jpg' },
    { tu: 3, den: 4.5, nhom: 'THI_CONG', buoc: 'Lăn lót', tu_tin: 0.5, can_xac_nhan: true, thay: { nhom: 'THI_CONG', buoc: 'Lăn lót', chac: 0.45 }, khung_url: '/media/k1.jpg' },
    { tu: 4.5, den: 9, nhom: 'HOAN_THIEN', tu_tin: 0.9, can_xac_nhan: true, kiem_ngau_nhien: true, thay: { nhom: 'THI_CONG', chac: 0.9 }, khung_url: 'javascript:x' }] });
  // video thành phẩm: dòng thời gian lưu được, đoạn không có ảnh riêng lấy ảnh shot gần nhất
  const tpBody = { ten: 'dinh-vi.mp4', nguon_id: 'drv1', nguon: 'DRIVE', dai: 10, dong: 'Finex', shots: [{ t0: 0, t1: 5, khung_url: '/media/s0.jpg' }, { t0: 5, t1: 10, khung_url: '/media/s1.jpg' }],
    timeline: [{ tu: 0, den: 6, nhom: 'THI_CONG', buoc: 'Trát', tu_tin: 1, can_xac_nhan: true, kiem_ngau_nhien: true, thay: { nhom: 'THI_CONG', chac: 0.9 } }, { tu: 6, den: 10, nhom: 'BOI_CANH', tu_tin: 0.4, can_xac_nhan: true, thay: { nhom: 'THI_CONG', chac: 0.4 } }] };
  assert.equal((await may('/hub/thanh-pham', 'POST', tpBody)).s, 200);
  const tp = DB.raw.prepare(`SELECT id, phan_tich FROM kho_thanh_pham`).get(); assert.equal(JSON.parse(tp.phan_tich).timeline, undefined, 'ADR-018: nhãn ở mau_doan');
  const md = (id) => DB.raw.prepare(`SELECT * FROM mau_doan WHERE id=?`).get(id);
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE loai='HINH'`).get().n, 5);
  assert.equal(md('H:' + ts + ':0').trang_thai, 'KIEM', 'máy gửi cờ kiểm'); assert.equal(md('H:' + ts + ':1').trang_thai, 'KHONG_CHAC', 'thầy < 0,6'); assert.equal(md('H:' + tp.id + ':0').trang_thai, 'KIEM');

  let h = (await api('/nhan-hinh/hang?n=10')).j; assert.equal(h.tong_doan, 5); assert.equal(h.con_lai, 5); assert.equal(h.can_xac_nhan, 2);
  assert.equal(h.hang[0].tt, 'KHONG_CHAC', 'đoạn thầy chưa chắc trước'); assert.equal(h.hang[0].tu_tin, 0.4, 'thấp nhất trước');
  assert.ok(h.hang.some((x) => x.ngau_nhien), 'có xen đoạn kiểm');
  const ftDoan = h.hang.find((x) => x.nguon === 'FOOTAGE' && x.i === 1); assert.deepEqual(ftDoan.quy_trinh, ['Vệ sinh', 'Lăn lót', 'Trát']); assert.deepEqual(ftDoan.bai_test_ds, ['Đổ nước', 'Cào dao']); assert.ok(ftDoan.version >= 1);
  const tpDoan = h.hang.find((x) => x.nguon === 'THANH_PHAM' && x.i === 1); assert.equal(tpDoan.khung_url, '/media/s1.jpg', 'ảnh shot gần nhất'); assert.deepEqual(tpDoan.quy_trinh, ['Vệ sinh', 'Lăn lót', 'Trát'], 'quy trình theo dòng');
  assert.equal(h.hang.find((x) => x.nguon === 'FOOTAGE' && x.i === 2).khung_url, null, 'ảnh lạ bị bỏ');
  assert.ok(Array.isArray(ftDoan.tl_video) && ftDoan.tl_video.length === 3, 'dải thời gian cả video');

  // gán: footage đoạn 1 sửa (thầy nói Lăn lót, người nói Vệ sinh); thành phẩm đoạn 1 người nói BOI_CANH (thầy THI_CONG); footage đoạn 0 hình không rõ
  let r = await api('/tai-san/' + ts + '/doan/1', 'POST', { nhom: 'THI_CONG', buoc: 'Vệ sinh', nhe: true }); assert.equal(r.s, 200); assert.equal(r.j.dung, false); assert.equal(r.j.db, undefined, 'không trả db');
  assert.equal(r.j.row.tt, 'VANG'); assert.equal(r.j.row.nguoi.buoc, 'Vệ sinh');
  r = await api('/kho-thanh-pham/' + tp.id + '/doan/1', 'POST', { nhom: 'BOI_CANH', nhe: true }); assert.equal(r.j.dung, false);
  r = await api('/tai-san/' + ts + '/doan/0', 'POST', { khong_ro: true }); assert.equal(r.j.bo_qua, true); assert.equal(md('H:' + ts + ':0').trang_thai, 'KHONG_RO');
  // gán lại: vẫn một dòng, so với nhãn thầy; version tăng — gửi version cũ thì bị chặn 409 (không đè mù)
  const v1 = md('H:' + ts + ':1').version;
  r = await api('/mau-doan/' + encodeURIComponent('H:' + ts + ':1'), 'POST', { nhom: 'THI_CONG', buoc: 'Lăn lót', version: v1 }); assert.equal(r.s, 200); assert.equal(r.j.dung, true, 'khớp thầy');
  r = await api('/mau-doan/' + encodeURIComponent('H:' + ts + ':1'), 'POST', { nhom: 'KHAC', version: v1 }); assert.equal(r.s, 409, 'version cũ → xung đột'); assert.equal(r.j.row.nguoi.buoc, 'Lăn lót', 'trả bản mới để xem lại');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE nhan_nguoi IS NOT NULL`).get().n, 3, 'gán lại không đếm hai lần');

  h = (await api('/nhan-hinh/hang?n=10')).j; assert.equal(h.da_gan, 3); assert.equal(h.con_lai, 2);
  const d = (await api('/bootstrap')).j.db.ai_nao.do_chinh_xac_hinh;
  assert.equal(d.so_nhan, 2, 'không rõ không tính'); assert.equal(d.dung_nhom, 1); assert.equal(d.theo_nguon.THANH_PHAM.so, 1); assert.equal(d.theo_nhom.THI_CONG.so, 1); assert.ok(Array.isArray(d.muc_tin));
  assert.equal(d.theo_truong.buoc.so, 1, 'đo theo trường'); assert.equal(d.theo_truong.buoc.thay_dung, 1);

  // học lại thành phẩm: giữ id, nhãn người của đúng đoạn vẫn còn
  assert.equal((await may('/hub/thanh-pham', 'POST', { ...tpBody, lam_lai: true })).s, 200);
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM kho_thanh_pham`).get().n, 1); assert.equal(DB.raw.prepare(`SELECT id FROM kho_thanh_pham`).get().id, tp.id, 'học lại giữ id');
  assert.equal(md('H:' + tp.id + ':1').trang_thai, 'VANG', 'học lại giữ nhãn người');
  // footage đọc lại với ranh giới khác → đoạn đổi, nhãn người không gán nhầm sang đoạn mới
  await may('/hub/doc-khung', 'POST', { tai_san_id: ts, timeline: [{ tu: 0, den: 2, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', chac: 0.9 } }, { tu: 2, den: 9, nhom: 'HOAN_THIEN', thay: { nhom: 'HOAN_THIEN', chac: 0.9 } }] });
  assert.equal(md('H:' + ts + ':1').nhan_nguoi, null, 'ranh giới đổi → không mang nhãn người'); assert.equal(md('H:' + ts + ':2'), undefined, 'đoạn thừa không nhãn người → xoá'); assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM mau_doan WHERE doi_tuong_id=? AND hieu_luc=0 AND nhan_nguoi IS NOT NULL').get(ts).n, 2, 'nhãn người của đoạn cũ giữ lại dạng hết hiệu lực');
});
