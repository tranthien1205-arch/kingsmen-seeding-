// ADR-012 — mẫu mang nhãn dòng sản phẩm / mục đích (tự suy từ bài → mục → sản phẩm; kho thành phẩm theo người nạp);
// huấn luyện theo phạm vi; phiên bản bản riêng không đè bản chung; máy dựng tra checkpoint theo dòng, chỉ dùng bản riêng khi hơn ≥ 3 điểm;
// kho: gắn nhãn / loại; bootstrap có dong_san_pham, pham_vi_thong_ke, tien_trinh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('export default async function x(){}') }, MEDIA: { get: async () => null, put: async () => ({}) } };
let TOKEN = null, KHOA = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hub = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': KHOA }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
let spKeo, mucId, ndId, ts = [];

test('mẫu tự mang nhãn: bài của mục (sản phẩm dòng "Keo chít mạch", mục tiêu BÁN HÀNG) → mẫu chon_canh có dong + muc_dich; bootstrap có dong_san_pham', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  KHOA = giai((await api('/may-ghep', 'POST', { ten: 'Máy 012' })).j.ma_ghep).khoa; await hub('/hub/trang_thai', 'POST', { may: 'thu', ban: '1.2', ffmpeg: true, kha_nang: ['dung_video'] });
  spKeo = (await api('/danh-muc/san_pham', 'POST', { ma: 'KCM', ten: 'Keo chít mạch Kingsmen', dong: 'Keo chít mạch' })).j.id; await api('/danh-muc/san_pham', 'POST', { ma: 'SCT', ten: 'Sơn chống thấm', dong: 'Sơn chống thấm' });
  assert.deepEqual((await api('/bootstrap')).j.db.ai_nao.dong_san_pham, ['Keo chít mạch', 'Sơn chống thấm']);
  mucId = (await api('/muc', 'POST', { tieu_de: 'Ron mốc', dinh_dang: 'VIDEO', san_pham_id: spKeo, muc_tieu: 'BAN_HANG' })).j.id;
  for (const ten of ['A.mp4', 'B.mp4']) ts.push((await hub('/hub/tai-san', 'POST', { muc_id: mucId, ten, media_url: '/media/media/' + ten, media_type: 'VIDEO', giay: 6, mo_ta: ten })).j.id);
  ndId = (await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'VIDEO', hook: 'Ron mốc?', sections: [{ label: 'Vấn đề', text: 'Ron đen.' }], cta: 'Kingsmen.' })).j.id;
  DB.raw.prepare(`UPDATE noi_dung SET trang_thai='DUYET' WHERE id=?`).run(ndId); DB.raw.prepare(`UPDATE muc_noi_dung SET giai_doan='SAN_XUAT' WHERE id=?`).run(mucId);
  const r = await hub('/hub/nap', 'POST', { viec: 'may_dung.dung_video', bang: 'content_os.video', luot: 'v012', dong: [{ noi_dung_id: ndId, media_url: '/media/media/v.mp4', giay: 7, canh_chon: [{ k: 0, label: 'Vấn đề', hinh: 'ron', chon: ts[0], cach: 'API', ung_vien: ts.map(id => ({ id, ten: id })) }] }] }); assert.equal(r.s, 200);
  const m = DB.raw.prepare(`SELECT dong, muc_dich FROM mau_hoc_ai WHERE tinh_nang='chon_canh' ORDER BY created_at DESC LIMIT 1`).get(); assert.equal(m.dong, 'Keo chít mạch'); assert.equal(m.muc_dich, 'BAN_HANG');
  const dv = (await hub('/hub/viec/dung_video?noi_dung_id=' + ndId)).j.viec[0]; assert.deepEqual(dv.pham_vi, { dong: 'Keo chít mạch', muc_dich: 'BAN_HANG' });
});
test('kho thành phẩm nạp có nhãn → lệnh mang dong/muc_dich; /hub/thanh-pham ghi nhãn → mẫu mang nhãn; gắn lại nhãn đổi mẫu theo; loại xoá cả mẫu', async () => {
  let r = await api('/kho-thanh-pham/nap', 'POST', { link: 'D:\\Video', toi_da: 5, dong: 'Keo chít mạch', muc_dich: 'BAN_HANG' }); assert.equal(r.s, 200);
  const l = (await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'hoc_thanh_pham'); assert.equal(l.tham_so.dong, 'Keo chít mạch'); assert.equal(l.tham_so.muc_dich, 'BAN_HANG');
  const shots = [{ t0: 0, t1: 2 }, { t0: 2, t1: 4.5 }, { t0: 4.5, t1: 7 }];
  r = await hub('/hub/thanh-pham', 'POST', { ten: 'tp1.mp4', nguon: 'LOCAL', shots, dong: 'Keo chít mạch', muc_dich: 'BAN_HANG' }); assert.equal(r.s, 200); const tpId = r.j.id;
  let m = DB.raw.prepare(`SELECT dong, muc_dich FROM mau_hoc_ai WHERE tinh_nang='ghep_canh' AND doi_tuong_id=?`).get(tpId); assert.equal(m.dong, 'Keo chít mạch');
  assert.equal((await api('/kho-thanh-pham/' + tpId, 'PATCH', { dong: 'Sơn chống thấm', muc_dich: 'BRAND' })).s, 200);
  m = DB.raw.prepare(`SELECT dong, muc_dich FROM mau_hoc_ai WHERE tinh_nang='ghep_canh' AND doi_tuong_id=?`).get(tpId); assert.equal(m.dong, 'Sơn chống thấm'); assert.equal(m.muc_dich, 'BRAND');
  const b = (await api('/bootstrap')).j.db.ai_nao; assert.equal(b.kho_thanh_pham[0].dong, 'Sơn chống thấm'); assert.ok(b.pham_vi_thong_ke.some(x => x.tinh_nang === 'ghep_canh' && x.dong === 'Sơn chống thấm')); assert.ok(b.tien_trinh.some(x => x.viec === 'hoc_thanh_pham'));
  assert.equal((await api('/kho-thanh-pham/' + tpId, 'DELETE')).s, 200);
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE doi_tuong_id=?`).get(tpId).n, 0); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM kho_thanh_pham WHERE id=?`).get(tpId).n, 0);
  assert.equal((await api('/kho-thanh-pham/khong-co', 'DELETE')).s, 404);
});
test('huấn luyện theo phạm vi: đếm mẫu trong phạm vi; /hub/tap-mau lọc; phiên bản bản riêng không đè bản chung; máy dựng tra theo dòng → bản riêng chỉ khi hơn ≥ 3 điểm', async () => {
  const shots = [{ t0: 0, t1: 2 }, { t0: 2, t1: 4.5 }, { t0: 4.5, t1: 7 }];
  for (let i = 0; i < 10; i++) await hub('/hub/thanh-pham', 'POST', { ten: 'keo' + i + '.mp4', nguon: 'LOCAL', shots, dong: 'Keo chít mạch' });
  for (let i = 0; i < 4; i++) await hub('/hub/thanh-pham', 'POST', { ten: 'son' + i + '.mp4', nguon: 'LOCAL', shots, dong: 'Sơn chống thấm' });
  assert.equal((await hub('/hub/tap-mau?tinh_nang=ghep_canh&pham_vi=dong:Keo%20ch%C3%ADt%20m%E1%BA%A1ch')).j.mau.length, 10);
  assert.equal((await hub('/hub/tap-mau?tinh_nang=ghep_canh&pham_vi=dong:S%C6%A1n%20ch%E1%BB%91ng%20th%E1%BA%A5m')).j.mau.length, 4);
  assert.ok((await hub('/hub/tap-mau?tinh_nang=ghep_canh')).j.mau.length >= 14);
  let r = await api('/ai/huan-luyen', 'POST', { tinh_nang: 'ghep_canh', pham_vi: 'dong:Sơn chống thấm' }); assert.equal(r.s, 409); assert.ok(r.j.error.includes('phạm vi'));
  r = await api('/ai/huan-luyen', 'POST', { tinh_nang: 'ghep_canh', pham_vi: 'dong:Keo chít mạch' }); assert.equal(r.s, 200); assert.equal(r.j.so_mau, 10);
  const l = (await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'huan_luyen'); assert.equal(l.tham_so.pham_vi, 'dong:Keo chít mạch');
  // bản chung 80 điểm (duyệt) → mo_hinh.diem; bản riêng Keo 82 (chưa đủ +3) → vẫn chung; bản riêng 85 → dùng riêng
  const gui = async (pv, diem) => (await hub('/hub/mo-hinh/phien-ban', 'POST', { mo_hinh_id: 'ghep-thong-ke', tinh_nang: 'ghep_canh', pham_vi: pv, checkpoint_url: '/media/media/ck-' + diem + '.json', may: 'thu', danh_gia: { diem, n_kiem: 5, n_hoc: 10, diem_truoc: 50 } })).j.id;
  const chung = await gui('chung', 80); assert.equal((await api('/ai/phien-ban/' + chung + '/duyet', 'POST', {})).s, 200);
  assert.equal(DB.raw.prepare(`SELECT checkpoint_url FROM mo_hinh WHERE id='ghep-thong-ke'`).get().checkpoint_url, '/media/media/ck-80.json');
  const r82 = await gui('dong:Keo chít mạch', 82); await api('/ai/phien-ban/' + r82 + '/duyet', 'POST', {});
  assert.equal(DB.raw.prepare(`SELECT checkpoint_url FROM mo_hinh WHERE id='ghep-thong-ke'`).get().checkpoint_url, '/media/media/ck-80.json', 'bản riêng không đè bản chung');
  let mh = (await hub('/hub/mo-hinh/ghep_canh?dong=Keo%20ch%C3%ADt%20m%E1%BA%A1ch')).j; assert.equal(mh.pham_vi, 'chung'); assert.ok(mh.mo_hinh_mo.checkpoint_url.endsWith('ck-80.json'));
  const r85 = await gui('dong:Keo chít mạch', 85); await api('/ai/phien-ban/' + r85 + '/duyet', 'POST', {});
  mh = (await hub('/hub/mo-hinh/ghep_canh?dong=Keo%20ch%C3%ADt%20m%E1%BA%A1ch')).j; assert.equal(mh.pham_vi, 'dong:Keo chít mạch'); assert.ok(mh.mo_hinh_mo.checkpoint_url.endsWith('ck-85.json')); assert.equal(mh.mo_hinh_mo.diem_rieng, 85); assert.equal(mh.mo_hinh_mo.diem_chung, 80);
  mh = (await hub('/hub/mo-hinh/ghep_canh?dong=S%C6%A1n%20ch%E1%BB%91ng%20th%E1%BA%A5m')).j; assert.equal(mh.pham_vi, 'chung');
  mh = (await hub('/hub/mo-hinh/ghep_canh')).j; assert.equal(mh.pham_vi, 'chung');
  const pb = (await api('/bootstrap')).j.db.ai_nao.phien_ban.find(p => p.id === r85); assert.equal(pb.pham_vi, 'dong:Keo chít mạch');
});
