// ADR-013 — Lớp học của máy: nạp một ô tự nhận loại; tóm tắt 4 kỹ năng; máy tự học khi đủ mẫu (không tạo lệnh trùng); bật = duyệt + gạt MỞ
// theo điểm phiên bản đã duyệt; tắt = về API; phiên bản mang ví dụ để xem thử.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('export default async function x(){}') }, MEDIA: { get: async () => null, put: async () => ({}) } };
let TOKEN = null, KHOA = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hub = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': KHOA }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

test('nạp một ô: tự nhận Drive / thư mục máy / @kênh / ngành Kalodata; chi_nhan chỉ trả loại; nạp thật chuyển cho tuyến tương ứng', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  KHOA = giai((await api('/may-ghep', 'POST', { ten: 'Máy 013' })).j.ma_ghep).khoa; await hub('/hub/trang_thai', 'POST', { may: 'thu', ban: '1.2', ffmpeg: true, kha_nang: ['dung_video', 'mo_hinh', 'huan_luyen'] });
  assert.equal((await api('/lop-hoc/nap', 'POST', { nap: 'https://drive.google.com/drive/folders/1abcdefghijklmnop', chi_nhan: true })).j.loai, 'DRIVE');
  assert.equal((await api('/lop-hoc/nap', 'POST', { nap: 'D:\\Video', chi_nhan: true })).j.loai, 'LOCAL');
  assert.equal((await api('/lop-hoc/nap', 'POST', { nap: '@kingsmen.vn', chi_nhan: true })).j.loai, 'TIKTOK');
  assert.equal((await api('/lop-hoc/nap', 'POST', { nap: 'Vật tư xây dựng', chi_nhan: true })).j.loai, 'KALODATA');
  let r = await api('/lop-hoc/nap', 'POST', { nap: 'D:\\Video da dung', dong: 'Keo chít mạch', muc_dich: 'BAN_HANG', toi_da: 7 }); assert.equal(r.s, 200); assert.equal(r.j.loai, 'LOCAL');
  const l = (await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'hoc_thanh_pham'); assert.equal(l.tham_so.duong_dan, 'D:\\Video da dung'); assert.equal(l.tham_so.dong, 'Keo chít mạch'); assert.equal(l.tham_so.toi_da, 7);
  r = await api('/lop-hoc/nap', 'POST', { nap: 'Vật tư xây dựng', dong: 'Keo chít mạch' }); assert.equal(r.s, 409, 'Kalodata cần Trạm sống → lỗi rõ'); assert.ok(r.j.error.includes('Trạm'));
  assert.deepEqual((await api('/bootstrap')).j.db.ai_nao.kalodata.nganh, ['Vật tư xây dựng'], 'ngành vẫn được lưu để lần sau Trạm quét');
});
test('kỹ năng: 4 thẻ với trạng thái; tự học tạo lệnh huấn luyện khi đủ mẫu, không trùng; phiên bản mang ví dụ; bật cần điểm ≥ ngưỡng, tắt về API', async () => {
  let b = (await api('/bootstrap')).j.db.ai_nao; assert.equal(b.ky_nang.length, 4); const cc = b.ky_nang.find(k => k.id === 'chon_canh'); assert.equal(cc.trang_thai, 'GOM'); assert.equal(cc.muc, 'API');
  // 12 mẫu chọn cảnh có nhãn (min_mau chon_canh đặt xuống 10 cho test) → tự học
  DB.raw.prepare(`UPDATE dinh_tuyen SET min_mau=10 WHERE tinh_nang='chon_canh'`).run();
  const mucId = (await api('/muc', 'POST', { tieu_de: 'Ron', dinh_dang: 'VIDEO' })).j.id; const ts = []; for (const ten of ['A.mp4', 'B.mp4']) ts.push((await hub('/hub/tai-san', 'POST', { muc_id: mucId, ten, media_url: '/media/media/' + ten, media_type: 'IMAGE' })).j.id);
  for (let i = 0; i < 12; i++) DB.raw.prepare(`INSERT INTO mau_hoc_ai (id,tinh_nang,dau_vao,nhan,tap,created_at) VALUES (?,?,?,?,?,?)`).run('ma_t' + i, 'chon_canh', JSON.stringify({ k: 0, hinh: 'ron', text: 'x', ung_vien: ts.map(id => ({ id, media_url: '/media/media/x.jpg' })) }), JSON.stringify({ tai_san_id: ts[0] }), i % 5 === 0 ? 'KIEM' : 'HOC', new Date().toISOString());
  b = (await api('/bootstrap')).j.db.ai_nao; assert.equal(b.ky_nang.find(k => k.id === 'chon_canh').trang_thai, 'DU_MAU');
  let r = await api('/lop-hoc/tu-hoc', 'POST'); assert.equal(r.s, 200); assert.deepEqual(r.j.hoc, ['chon_canh chung (12 mẫu)']);
  r = await api('/lop-hoc/tu-hoc', 'POST'); assert.deepEqual(r.j.hoc, [], 'đang học → không tạo lệnh trùng');
  const lenh = (await hub('/hub/lenh')).j.lenh.filter(x => x.viec === 'huan_luyen'); assert.equal(lenh.length, 1); assert.equal(lenh[0].tham_so.pham_vi, 'chung'); assert.equal(lenh[0].tham_so.tu_hoc, true);
  assert.equal((await api('/bootstrap')).j.db.ai_nao.ky_nang.find(k => k.id === 'chon_canh').trang_thai, 'DANG_HOC');
  // máy gửi phiên bản 70 điểm kèm ví dụ → trạng thái MỚI; bật bị chặn vì dưới ngưỡng 75; phiên bản 88 → bật được → NHÀ; tắt → API
  await hub('/hub/lenh/' + lenh[0].id, 'POST', { trang_thai: 'XONG', ket_qua: 'ok' }).catch(() => {});
  const gui = async (diem) => (await hub('/hub/mo-hinh/phien-ban', 'POST', { mo_hinh_id: 'clip-vit-b16', tinh_nang: 'chon_canh', pham_vi: 'chung', checkpoint_url: '/media/media/ck-' + diem + '.json', may: 'thu', danh_gia: { diem, n_kiem: 3, n_hoc: 9, diem_truoc: 50, vi_du: [{ mau_id: 'ma_t0', hinh: 'ron', text: 'x', nguoi: ts[0], moi: ts[0], cu: ts[1] }] } })).j.id;
  const p70 = await gui(70); assert.equal((await hub('/hub/mo-hinh/phien-ban', 'POST', { mo_hinh_id: 'clip-vit-b16', tinh_nang: 'chon_canh', checkpoint_url: '/media/media/ck-4.json', may: 'thu', danh_gia: { diem: 4, n_kiem: 3, n_hoc: 9, diem_truoc: 12 } })).j.tu_loai, true, 'kém quy tắc cũ → máy tự loại'); b = (await api('/bootstrap')).j.db.ai_nao; let k = b.ky_nang.find(x => x.id === 'chon_canh'); assert.equal(k.trang_thai, 'MOI'); assert.equal(k.ban_moi.diem, 70); assert.equal(k.ban_moi.vi_du.length, 1); assert.equal(k.ban_moi.vi_du[0].cu, ts[1]);
  r = await api('/lop-hoc/bat', 'POST', { tinh_nang: 'chon_canh', phien_ban_id: p70 }); assert.equal(r.s, 409); assert.ok(r.j.error.includes('dưới ngưỡng'));
  const p88 = await gui(88); r = await api('/lop-hoc/bat', 'POST', { tinh_nang: 'chon_canh', phien_ban_id: p88 }); assert.equal(r.s, 200);
  b = r.j.db.ai_nao; k = b.ky_nang.find(x => x.id === 'chon_canh'); assert.equal(k.trang_thai, 'NHA'); assert.equal(k.muc, 'MO'); assert.equal(k.dang_dung.diem, 88);
  assert.equal(DB.raw.prepare(`SELECT muc FROM dinh_tuyen WHERE tinh_nang='chon_canh'`).get().muc, 'MO');
  r = await api('/lop-hoc/tat', 'POST', { tinh_nang: 'chon_canh' }); assert.equal(r.s, 200); assert.equal(r.j.db.ai_nao.ky_nang.find(x => x.id === 'chon_canh').muc, 'API');
  assert.ok(r.j.db.ai_nao.nhat_ky_hoc.some(x => x.hanh_dong === 'máy tự học')); assert.ok(r.j.db.ai_nao.nhat_ky_hoc.some(x => x.hanh_dong === 'bật máy nhà'));
});
