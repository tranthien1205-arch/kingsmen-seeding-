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
  r = await api('/lop-hoc/bat', 'POST', { tinh_nang: 'chon_canh', phien_ban_id: p70 }); assert.equal(r.s, 200, '70 dưới ngưỡng 75 nhưng hơn quy tắc cũ 50 ≥ 5 điểm → bật được'); await api('/lop-hoc/tat', 'POST', { tinh_nang: 'chon_canh' });
  const p52 = await gui(52); r = await api('/lop-hoc/bat', 'POST', { tinh_nang: 'chon_canh', phien_ban_id: p52 }); assert.equal(r.s, 409, '52 chỉ hơn quy tắc cũ 2 điểm → chưa bật'); assert.ok(r.j.error.includes('dưới ngưỡng'));
  const p88 = await gui(88); r = await api('/lop-hoc/bat', 'POST', { tinh_nang: 'chon_canh', phien_ban_id: p88 }); assert.equal(r.s, 200);
  b = r.j.db.ai_nao; k = b.ky_nang.find(x => x.id === 'chon_canh'); assert.equal(k.trang_thai, 'NHA'); assert.equal(k.muc, 'MO'); assert.equal(k.dang_dung.diem, 88);
  assert.equal(DB.raw.prepare(`SELECT muc FROM dinh_tuyen WHERE tinh_nang='chon_canh'`).get().muc, 'MO');
  r = await api('/lop-hoc/tat', 'POST', { tinh_nang: 'chon_canh' }); assert.equal(r.s, 200); assert.equal(r.j.db.ai_nao.ky_nang.find(x => x.id === 'chon_canh').muc, 'API');
  assert.ok(r.j.db.ai_nao.nhat_ky_hoc.some(x => x.hanh_dong === 'máy tự học')); assert.ok(r.j.db.ai_nao.nhat_ky_hoc.some(x => x.hanh_dong === 'bật máy nhà'));
});
test('gom về một máy (24/09): máy mạnh nhất đang bật nhận dựng + học; máy yếu chỉ khi máy mạnh im; video Trạm đẩy lên kho app → lệnh học mang danh sách, giao máy mạnh', async () => {
  const yeu = giai((await api('/may-ghep', 'POST', { ten: 'Ngoc-Han' })).j.ma_ghep).khoa; const manh = giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa;
  const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
  DB.raw.prepare(`UPDATE may_ghep SET active=0 WHERE ten='Máy 013'`).run();
  await hubK(yeu)('/hub/trang_thai', 'POST', { may: 'NGOC-HAN', ban: '1.2', ffmpeg: true, gpu: 'NVIDIA GeForce GTX 1650, 4096 MiB', kha_nang: ['dung_video', 'mo_hinh', 'huan_luyen'] });
  await hubK(manh)('/hub/trang_thai', 'POST', { may: 'DESKTOP-Q2', ban: '1.3', ffmpeg: true, ollama: true, gpu: 'NVIDIA GeForce RTX 3070 Ti, 8192 MiB', kha_nang: ['dung_video', 'mo_hinh', 'huan_luyen'] });
  const idManh = DB.raw.prepare(`SELECT id FROM may_ghep WHERE ten='Q2'`).get().id, idYeu = DB.raw.prepare(`SELECT id FROM may_ghep WHERE ten='Ngoc-Han'`).get().id;
  let r = await api('/lop-hoc/nap', 'POST', { nap: 'https://drive.google.com/drive/folders/1zzzzzzzzzzzzzzzzz' }); assert.equal(r.s, 200);
  assert.equal(DB.raw.prepare(`SELECT may_id FROM tram_lenh WHERE viec='hoc_thanh_pham' ORDER BY created_at DESC LIMIT 1`).get().may_id, idManh, 'máy mạnh nhận');
  // máy mạnh im → máy yếu dự phòng
  DB.raw.prepare(`UPDATE may_ghep SET nhan_luc='2020-01-01T00:00:00Z' WHERE id=?`).run(idManh);
  r = await api('/lop-hoc/nap', 'POST', { nap: 'https://drive.google.com/drive/folders/1yyyyyyyyyyyyyyyyy' }); assert.equal(r.s, 200);
  assert.equal(DB.raw.prepare(`SELECT may_id FROM tram_lenh WHERE viec='hoc_thanh_pham' ORDER BY created_at DESC LIMIT 1`).get().may_id, idYeu, 'máy yếu dự phòng');
  await hubK(manh)('/hub/trang_thai', 'POST', { may: 'DESKTOP-Q2', ban: '1.3', ffmpeg: true, ollama: true, gpu: 'NVIDIA GeForce RTX 3070 Ti, 8192 MiB', kha_nang: ['dung_video', 'mo_hinh', 'huan_luyen'] });
  // Trạm báo tải xong kèm danh sách video trên kho app
  const khoaTram = giai((await api('/tram/khoa', 'POST')).j.ma_ghep).khoa; await hubK(khoaTram)('/hub/trang_thai', 'POST', { may: 'NGOC-HAN', ban: '9.166' });
  r = await hubK(khoaTram)('/hub/tiktok-da-tai', 'POST', { kenh: 'kalodata:vat-tu', thu_muc: 'D:/x', so: 2, nguon: 'KALODATA', video: [{ ten: '1.mp4', url: '/media/media/v1.mp4', meta: { doanh_thu: 3e8 } }, { ten: '2.mp4', url: 'https://ngoai.com/x.mp4' }] });
  assert.equal(r.j.giao, true);
  const l = DB.raw.prepare(`SELECT may_id, tham_so FROM tram_lenh WHERE viec='hoc_thanh_pham' ORDER BY created_at DESC LIMIT 1`).get(); const ts = JSON.parse(l.tham_so);
  assert.equal(l.may_id, idManh, 'video đã lên kho app → học ở máy mạnh, không cần chung ổ với Trạm'); assert.equal(ts.video.length, 1, 'link ngoài kho app bị bỏ'); assert.equal(ts.video[0].meta.doanh_thu, 3e8); assert.equal(ts.duong_dan, null);
});
