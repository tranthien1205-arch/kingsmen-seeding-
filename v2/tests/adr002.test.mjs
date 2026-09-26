// ADR-002 — chiến lược (G1) · kế hoạch tháng (G2) · tuần & mục (B3) · ý tưởng/trend (B1) · mẫu học. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
// fetch giả: Google Trends RSS + YouTube; Anthropic không có key → máy không chấm (không đoán)
const realFetch = globalThis.fetch; const calls = [];
globalThis.fetch = async (url, opt) => { const u = String(url); calls.push(u);
  if (u.includes('trends.google.com')) return new Response('<rss><channel><item><title>Ron gạch ố vàng mùa mưa</title><link>https://t/1</link><description>nhà mới</description></item><item><title>Giá vàng hôm nay</title><link>https://t/2</link></item><item><title>Keo ron epoxy</title><link>https://t/3?utm_source=x</link></item></channel></rss>', { status: 200 });
  if (u.includes('googleapis.com/youtube')) return new Response(JSON.stringify({ items: [{ id: 'v1', snippet: { title: 'Thi công ốp lát chuẩn', description: '' } }] }), { status: 200 });
  return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, YOUTUBE_API_KEY: 'yt', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7); const [Y, M] = thangNay.split('-').map(Number); const thangSau = new Date(Date.UTC(Y, M, 1)).toISOString().slice(0, 7);
let tMkt, tTruong, tGD, p1, p2, k1;
test('chuẩn bị: admin, người dùng, danh mục', async () => {
  const r = await dangNhap('admin@kingsmen.vn', 'admin123'); TOKEN = r.token;
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT'], ['Sếp', 'gd@k.vn', 'GIAM_DOC']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt });
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token; tGD = (await dangNhap('gd@k.vn', '123456')).token;
  p1 = (await api('/danh-muc/pillars', 'POST', { ten: 'Branding', ty_trong: 60, muc_tieu: 'BRAND' })).j.id;
  p2 = (await api('/danh-muc/pillars', 'POST', { ten: 'Problems', ty_trong: 40, muc_tieu: 'ban_hang' })).j.id;
  const r2 = await api('/danh-muc/kenh', 'POST', { ten: 'Fanpage', loai: 'FANPAGE' }); k1 = r2.j.id; await api('/danh-muc/kenh', 'POST', { ten: 'TikTok', loai: 'TIKTOK' });
  assert.equal(r2.j.db.pillars.find(p => p.id === p2).muc_tieu, 'BAN_HANG');
});
test('G1: chốt chiến lược = snapshot phiên bản (từ 27/09: bản chụp Hồ sơ định vị + pillar + định hướng); Marketing không chốt; GĐ chốt được', async () => {
  await api('/chien-luoc', 'PUT', { dinh_huong: 'Quý 4: đẩy Terrazy Wall + tuyển đội Kingpro' }, tMkt);
  assert.equal((await api('/chien-luoc/chot', 'POST', {}, tMkt)).status, 403);
  let r = await api('/chien-luoc/chot', 'POST', { ghi_chu: 'bản đầu' }, tGD); assert.equal(r.status, 200);
  assert.equal(r.j.db.chien_luoc.phien_ban, 1); assert.equal(r.j.db.chien_luoc_phien_ban[0].pillars.length, 2); assert.equal(r.j.db.chien_luoc_phien_ban[0].chot_boi, 'Sếp');
  r = await api('/chien-luoc/chot', 'POST', {}, tTruong); assert.equal(r.j.db.chien_luoc.phien_ban, 2);
});
test('B2: máy đề xuất kế hoạch từ pillar % (kèm lý do), người sửa, Trưởng MKT chốt → mẫu học B2 + giao việc chia tuần (B3 NGƯỜI)', async () => {
  let r = await api('/ke-hoach/' + thangNay + '/de-xuat', 'POST', { tong_bai: 20 }, tMkt); assert.equal(r.status, 200);
  const dx = r.j.de_xuat.chi_tieu; assert.equal(dx.tong_bai, 20); assert.equal(dx.theo_pillar[p1], 12); assert.equal(dx.theo_pillar[p2], 8);
  assert.deepEqual(dx.theo_muc_tieu, { BRAND: 12, BAN_HANG: 8 }); assert.equal(Object.values(dx.theo_dinh_dang).reduce((s, v) => s + v, 0), 20); assert.equal(Object.values(dx.theo_kenh).reduce((s, v) => s + v, 0), 20);
  assert.match(r.j.de_xuat.ly_do.theo_pillar, /tỷ trọng/); assert.match(r.j.de_xuat.ly_do.ket_qua, /Chưa có số đo/);
  const kh = r.j.db.ke_hoach_thang.find(k => k.thang === thangNay); assert.equal(kh.trang_thai, 'DE_XUAT'); assert.equal(kh.nguon, 'DE_XUAT'); assert.ok(kh.de_xuat);
  // người sửa: brand tăng, KPI kết quả
  const ct = JSON.parse(JSON.stringify(kh.chi_tieu)); ct.theo_pillar[p1] = 14; ct.tong_bai = 22; ct.ket_qua = { tiep_can: 50000, chia_se: 200, so_don: 10, la: 9 };
  r = await api('/ke-hoach/' + thangNay, 'PUT', { chi_tieu: ct, dinh_huong: 'Đẩy G7000' }, tMkt); assert.equal(r.status, 200);
  const kh2 = r.j.db.ke_hoach_thang.find(k => k.thang === thangNay); assert.equal(kh2.nguon, 'NGUOI'); assert.equal(kh2.chi_tieu.ket_qua.tiep_can, 50000); assert.equal(kh2.chi_tieu.ket_qua.la, undefined); assert.equal(kh2.de_xuat.theo_pillar[p1], 12, 'bản đề xuất giữ nguyên để so');
  assert.equal((await api('/ke-hoach/' + thangNay + '/chot', 'POST', {}, tMkt)).status, 403, 'Marketing không chốt G2');
  r = await api('/ke-hoach/' + thangNay + '/chot', 'POST', {}, tTruong); assert.equal(r.status, 200); assert.equal(r.j.tao, null, 'B3 đang NGƯỜI → không tự tạo mục');
  const kh3 = r.j.db.ke_hoach_thang.find(k => k.thang === thangNay); assert.equal(kh3.trang_thai, 'CHOT'); assert.equal(kh3.chot_boi, 'Trang');
  assert.ok(r.j.db.cong_viec.some(v => v.loai === 'CHIA_TUAN' && v.giao_cho_vai_tro === 'MARKETING'), 'giao việc chia tuần');
  const mh = DB.raw.prepare(`SELECT * FROM mau_hoc WHERE buoc='B2'`).all(); assert.equal(mh.length, 1); assert.ok(mh[0].giong > 0.8 && mh[0].giong < 1, 'giống ~0.9 vì sửa 2 số: ' + mh[0].giong);
  assert.equal((await api('/ke-hoach/' + thangNay + '/chot', 'POST', {}, tTruong)).status, 409);
  assert.equal((await api('/ke-hoach/' + thangNay, 'PUT', { chi_tieu: ct }, tMkt)).status, 403, 'đã chốt → Marketing không sửa');
});
test('B3: máy tạo mục còn thiếu theo tuần (idempotent), người sửa mục máy tạo → mẫu học B3, tuần suy từ ngày', async () => {
  let r = await api('/ke-hoach/' + thangNay); assert.equal(r.status, 200); const th = r.j.thieu; assert.ok(th.so_tuan >= 4 && th.tuan[0].thieu.length > 0);
  r = await api('/ke-hoach/' + thangNay + '/tao-muc', 'POST', {}, tMkt); assert.equal(r.status, 200); const tao1 = r.j.tao; assert.ok(tao1 >= 20, 'tạo ≥ tổng chỉ tiêu 22 chia tuần: ' + tao1);
  const muc = r.j.db.muc_noi_dung.filter(m => m.thang === thangNay); assert.equal(muc.length, tao1); assert.ok(muc.every(m => m.tao_boi === 'AGENT' && m.giai_doan === 'Y_TUONG' && m.tuan >= 1));
  assert.ok(muc.some(m => m.muc_tieu === 'BAN_HANG' && m.pillar_id === p2), 'mục Problems mang mục tiêu BÁN HÀNG từ pillar');
  r = await api('/ke-hoach/' + thangNay + '/tao-muc', 'POST', {}, tMkt); assert.equal(r.j.tao, 0, 'chạy lại không tạo thêm');
  r = await api('/ke-hoach/' + thangNay); assert.ok(r.j.thieu.tuan.every(t => t.thieu.length === 0), 'không còn thiếu');
  // người sửa mục máy tạo: đổi kênh & tuần → giống 0.5
  const m0 = muc[0]; r = await api('/muc/' + m0.id, 'PATCH', { tieu_de: 'Bài thật', kenh_id: m0.kenh_id === k1 ? null : k1, tuan: m0.tuan === 1 ? 2 : 1 }, tMkt); assert.equal(r.status, 200);
  const mh = DB.raw.prepare(`SELECT * FROM mau_hoc WHERE buoc='B3'`).all(); assert.equal(mh.length, 1); assert.equal(mh[0].giong, 0.5);
  // mục người tạo với ngày đăng → tuần null (suy từ ngày ở giao diện/agent); xoá chỉ khi Y_TUONG
  r = await api('/muc', 'POST', { tieu_de: 'Mục người', thang: thangNay, ngay_dang: thangNay + '-15', pillar_id: p1, muc_tieu: 'x' }, tMkt); const mn = r.j.db.muc_noi_dung.find(m => m.tieu_de === 'Mục người'); assert.equal(mn.tuan, null); assert.equal(mn.muc_tieu, 'BRAND'); assert.equal(mn.tao_boi, 'NGUOI');
  DB.raw.prepare(`UPDATE muc_noi_dung SET giai_doan='SOAN' WHERE id=?`).run(mn.id); assert.equal((await api('/muc/' + mn.id, 'DELETE', null, tMkt)).status, 409);
  assert.equal((await api('/muc', 'POST', { tieu_de: 'x' }, tGD)).status, 403);
});
test('B1: gom trend (chống trùng, lọc từ khoá, không AI → không chấm), người quyết → mẫu học chỉ khi máy có chấm; duyệt → mục', async () => {
  await api('/cau-hinh/trend', 'PUT', { cau_hinh: { tu_khoa_nganh: ['ron', 'ốp lát'] } });
  let r = await api('/may/chay-thu', 'POST', { agent: 'GOM_TREND' }); assert.equal(r.status, 200); const kq = r.j.kq[0]; assert.match(kq.tom_tat, /Gom 4 → 3 ý tưởng mới/); assert.match(kq.tom_tat, /lệch từ khoá 1/);
  const yt = r.j.db.y_tuong; assert.equal(yt.length, 3); assert.ok(yt.every(y => y.diem_may === null && y.trang_thai === 'MOI'), 'không có key → không chấm, không đoán');
  r = await api('/may/chay-thu', 'POST', { agent: 'GOM_TREND' }); assert.match(r.j.kq[0].tom_tat, /→ 0 ý tưởng mới/); assert.match(r.j.kq[0].tom_tat, /trùng 3/);
  const y1 = yt.find(y => /ố vàng/.test(y.ten));
  r = await api('/y-tuong/' + y1.id + '/quyet', 'POST', { quyet: 'DUYET', ly_do: 'đúng mùa', pillar_id: p2, dinh_dang: 'VIDEO' }, tMkt); assert.equal(r.status, 200); assert.ok(r.j.muc_id);
  const muc = r.j.db.muc_noi_dung.find(m => m.id === r.j.muc_id); assert.equal(muc.y_tuong_id, y1.id); assert.equal(muc.pillar_id, p2); assert.equal(muc.dinh_dang, 'VIDEO'); assert.equal(muc.tao_boi, 'NGUOI');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc WHERE buoc='B1'`).get().n, 0, 'máy chưa chấm → không có mẫu để so');
  // giả lập máy đã chấm 85 điểm cho ý tưởng khác → người bỏ → giống 0; người duyệt ý tưởng 20 điểm → giống 0; đồng ý → 1
  const y2 = yt.find(y => /epoxy/i.test(y.ten)), y3 = yt.find(y => /ốp lát/i.test(y.ten));
  DB.raw.prepare(`UPDATE y_tuong SET diem_may=85 WHERE id=?`).run(y2.id); DB.raw.prepare(`UPDATE y_tuong SET diem_may=20 WHERE id=?`).run(y3.id);
  await api('/y-tuong/' + y2.id + '/quyet', 'POST', { quyet: 'BO' }, tMkt); await api('/y-tuong/' + y3.id + '/quyet', 'POST', { quyet: 'BO' }, tMkt);
  const mh = DB.raw.prepare(`SELECT giong FROM mau_hoc WHERE buoc='B1' ORDER BY created_at`).all(); assert.deepEqual(mh.map(x => x.giong), [0, 1]);
  r = await api('/y-tuong', 'POST', { ten: 'Ý tưởng của Ngọc', muc_tieu: 'BAN_HANG' }, tMkt); assert.equal(r.status, 200); assert.equal(r.j.db.y_tuong.find(y => y.id === r.j.id).nguon, 'NGUOI');
  assert.equal((await api('/y-tuong/' + y1.id + '/quyet', 'POST', { quyet: 'XYZ' }, tMkt)).status, 400);
});
test('B1 ở AI TỰ LÀM: ý tưởng đủ điểm & không rủi ro tự duyệt và thành mục (giả lập điểm qua cấu hình ngưỡng 0)', async () => {
  for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run('s' + i, 'B1', thangNay + '-01', 1, new Date().toISOString());
  await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' });
  assert.equal((await api('/buoc/B1', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' })).status, 200);
  // không có AI key → diem null → không tự duyệt dù ở AI_TU_LAM (không bịa)
  DB.raw.prepare(`DELETE FROM y_tuong`).run();
  const r = await api('/may/chay-thu', 'POST', { agent: 'GOM_TREND' }); assert.match(r.j.kq[0].tom_tat, /0 tự duyệt/); assert.ok(r.j.db.y_tuong.every(y => y.trang_thai === 'MOI'));
});
test('agent DE_XUAT_KE_HOACH: bỏ qua khi B2 ở NGƯỜI; ở AI_GOI_Y và tới ngày → lập đề xuất tháng sau + giao Trưởng MKT chốt', async () => {
  let r = await api('/may/chay-thu', 'POST', { agent: 'DE_XUAT_KE_HOACH' }); assert.match(r.j.kq[0].bo_qua || '', /NGƯỜI/);
  await api('/buoc/B2', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' });
  const ngay = Number(new Date(Date.now() + 7 * 36e5).toISOString().slice(8, 10));
  await api('/cau-hinh/ke_hoach', 'PUT', { cau_hinh: { ngay_de_xuat: Math.min(28, ngay + 1) } });
  r = await api('/may/chay-thu', 'POST', { agent: 'DE_XUAT_KE_HOACH' }); if (ngay < 28) assert.match(r.j.kq[0].bo_qua || '', /Chưa tới ngày/);
  await api('/cau-hinh/ke_hoach', 'PUT', { cau_hinh: { ngay_de_xuat: Math.max(1, ngay) } });
  r = await api('/may/chay-thu', 'POST', { agent: 'DE_XUAT_KE_HOACH' }); assert.equal(r.j.kq[0].ok, true, JSON.stringify(r.j.kq[0]));
  const kh = r.j.db.ke_hoach_thang.find(k => k.thang === thangSau); assert.ok(kh && kh.trang_thai === 'DE_XUAT' && kh.chi_tieu.tong_bai === 22, 'tổng = chỉ tiêu tháng này đã chốt');
  assert.ok(r.j.db.cong_viec.some(v => v.loai === 'CHOT_KE_HOACH' && v.doi_tuong_id === thangSau && v.giao_cho_vai_tro === 'TRUONG_MKT'));
  r = await api('/may/chay-thu', 'POST', { agent: 'DE_XUAT_KE_HOACH' }); assert.match(r.j.kq[0].bo_qua || '', /đã có/);
  // chốt tháng sau với B3 ở AI → máy tạo mục ngay, việc CHOT_KE_HOACH xong
  await api('/buoc/B3', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' });
  r = await api('/ke-hoach/' + thangSau + '/chot', 'POST', {}, tTruong); assert.equal(r.status, 200); assert.ok(r.j.tao >= 20, 'máy tạo mục: ' + r.j.tao);
  assert.ok(!r.j.db.cong_viec.some(v => v.loai === 'CHOT_KE_HOACH' && v.doi_tuong_id === thangSau));
  r = await api('/may/chay-thu', 'POST', { agent: 'CHIA_TUAN' }); assert.ok(r.j.kq[0].tom_tat.includes(thangSau + ': +0'), 'tháng sau đã đủ, không tạo thêm: ' + r.j.kq[0].tom_tat);
});
