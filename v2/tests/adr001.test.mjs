// ADR-001 — nền + bộ quyền thực hiện + agent điều phối + danh mục + mô phỏng. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, TOKEN_KINGSMEN: 'tok', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null;
const api = async (p, method = 'GET', body, tok) => {
  const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j };
};
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
let db;
test('seed: admin đầu tiên phải đổi mật khẩu, 12 bước NGƯỜI, chiến lược trống', async () => {
  const r = await dangNhap('admin@kingsmen.vn', 'admin123'); TOKEN = r.token; db = r.db;
  assert.equal(db.me.vai_tro, 'ADMIN'); assert.equal(db.me.doi_mat_khau, true);
  assert.equal(db.buoc.length, 12); assert.ok(db.buoc.every(b => b.nguoi_thuc_hien === 'NGUOI' && b.hoc === true && b.san_sang === 0));
  assert.equal(db.chien_luoc.phien_ban, 0); assert.equal(db.mo_phong, false);
  assert.deepEqual(db.module_config.may, { nguong_san_sang: 80, min_mau: 30, gio_chay: 6 });
});
test('đổi mật khẩu lần đầu → cờ tắt', async () => {
  const r = await api('/me', 'PATCH', { password: 'MatKhauMoi1' }); assert.equal(r.status, 200); assert.equal(r.j.db.me.doi_mat_khau, false);
  assert.equal((await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).status, 401);
});
let tMkt, tTruong, tGD;
test('tạo người dùng: Admin tạo được mọi vai; Trưởng MKT không tạo Admin', async () => {
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT'], ['Sếp', 'gd@k.vn', 'GIAM_DOC'], ['Sale', 'sale@k.vn', 'SALES']]) {
    const r = await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt }); assert.equal(r.status, 200, email);
  }
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token; tGD = (await dangNhap('gd@k.vn', '123456')).token;
  assert.equal((await api('/users', 'POST', { ho_ten: 'X', email: 'x@k.vn', password: '123456', vai_tro: 'ADMIN' }, tTruong)).status, 403);
  assert.equal((await api('/users', 'POST', { ho_ten: 'X', email: 'y@k.vn', password: '123456', vai_tro: 'SALES' }, tMkt)).status, 403);
});
test('gạt bước: luật mức tối đa, ngưỡng sẵn sàng, ai được gạt', async () => {
  assert.equal((await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' }, tMkt)).status, 403, 'Marketing không gạt');
  assert.equal((await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' }, tGD)).status, 403, 'GĐ không gạt');
  let r = await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' }, tTruong); assert.equal(r.status, 200); assert.equal(r.j.db.buoc.find(b => b.ma === 'B4').nguoi_thuc_hien, 'AI_GOI_Y');
  r = await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' }); assert.equal(r.status, 422); assert.match(r.j.error, /chưa đủ sẵn sàng/);
  r = await api('/buoc/B8', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' }); assert.equal(r.status, 422, 'B8 video tối đa NGƯỜI');
  r = await api('/buoc/B2', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' }); assert.equal(r.status, 422, 'B2 cổng G2 tối đa AI_GOI_Y');
  r = await api('/buoc/B5', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' }); assert.equal(r.status, 422, 'B5 không bao giờ tự duyệt');
  r = await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'XYZ' }); assert.equal(r.status, 422);
  r = await api('/buoc/B4', 'PATCH', { hoc: false, vai_tro_nguoi: 'TRUONG_MKT' }); assert.equal(r.status, 200); const b4 = r.j.db.buoc.find(b => b.ma === 'B4'); assert.equal(b4.hoc, false); assert.equal(b4.vai_tro_nguoi, 'TRUONG_MKT'); assert.equal(b4.doi_boi, 'Admin');
  const au = DB.raw.prepare(`SELECT * FROM audit WHERE action='gạt bước' ORDER BY at DESC`).all(); assert.ok(au.length >= 2 && au[0].tac_nhan === 'NGUOI');
});
test('điểm sẵn sàng từ mẫu học → mở khoá AI TỰ LÀM', async () => {
  for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run('t' + i, 'B4', '2026-10-01', 0.9, new Date(Date.now() - i * 1000).toISOString());
  let r = await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.equal(r.status, 200);
  const b4 = r.j.db.buoc.find(b => b.ma === 'B4'); assert.equal(b4.san_sang, 90); assert.equal(b4.so_mau, 30);
  assert.ok(r.j.db.agent_run[0].thu === true && r.j.db.agent_run[0].agent === 'TINH_SAN_SANG');
  r = await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' }); assert.equal(r.status, 200);
  // nâng ngưỡng lên 95 → gạt lại phải bị chặn
  assert.equal((await api('/cau-hinh/may', 'PUT', { cau_hinh: { nguong_san_sang: 95 } })).status, 200);
  await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'NGUOI' });
  assert.equal((await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' })).status, 422);
  assert.equal((await api('/cau-hinh/may', 'PUT', { cau_hinh: { nguong_san_sang: 80 } })).status, 200);
});
test('cấu hình: kiểm tra giá trị, quyền', async () => {
  assert.equal((await api('/cau-hinh/may', 'PUT', { cau_hinh: { nguong_san_sang: 120 } })).status, 422);
  assert.equal((await api('/cau-hinh/may', 'PUT', { cau_hinh: { la: 1 } })).status, 422);
  assert.equal((await api('/cau-hinh/xyz', 'PUT', { cau_hinh: {} })).status, 422);
  assert.equal((await api('/cau-hinh/may', 'PUT', { cau_hinh: { gio_chay: 7 } }, tMkt)).status, 403);
  const r = await api('/cau-hinh/ai', 'PUT', { cau_hinh: { ngan_sach_thang_usd: 50, chan_khi_vuot: false } }); assert.equal(r.status, 200); assert.equal(r.j.db.module_config.ai.ngan_sach_thang_usd, 50); assert.equal(r.j.db.ai_thang.ngan_sach_usd, 50);
});
test('agent điều phối theo cron: đúng giờ chạy 1 lần/ngày, sai giờ bỏ qua', async () => {
  const gioNay = (new Date().getUTCHours() + 7) % 24;
  await api('/cau-hinh/may', 'PUT', { cau_hinh: { gio_chay: (gioNay + 1) % 24 } });
  const truoc = DB.raw.prepare(`SELECT COUNT(*) n FROM agent_run WHERE thu=0`).get().n;
  await worker.scheduled({ cron: '*/15 * * * *' }, env, { waitUntil(p) { return p; } }); await new Promise(r => setTimeout(r, 50));
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM agent_run WHERE thu=0`).get().n, truoc, 'chưa tới giờ → không ghi');
  await api('/cau-hinh/may', 'PUT', { cau_hinh: { gio_chay: gioNay } });
  await worker.scheduled({ cron: '*/15 * * * *' }, env, { waitUntil(p) { return p; } }); await new Promise(r => setTimeout(r, 50));
  await worker.scheduled({ cron: '*/15 * * * *' }, env, { waitUntil(p) { return p; } }); await new Promise(r => setTimeout(r, 50));
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM agent_run WHERE thu=0`).get().n, truoc + 1, 'đúng giờ: 2 lần cron → 1 lượt');
});
test('danh mục gốc: CRUD, làm sạch, tắt thay vì xoá, token kênh chỉ là cờ', async () => {
  let r = await api('/danh-muc/pillars', 'POST', { ten: 'Branding', ty_trong: '40', mo_ta: 'x' }, tMkt); assert.equal(r.status, 200); const pid = r.j.id;
  assert.equal(r.j.db.pillars[0].ty_trong, 40);
  r = await api('/danh-muc/san_pham', 'POST', { ma: 'G7000', ten: 'G7000', thong_so: [{ k: 'Giữ màu', v: '30 năm' }, { k: '', v: '' }, 'rác'] }, tMkt); assert.equal(r.status, 200);
  assert.deepEqual(r.j.db.san_pham[0].thong_so, [{ k: 'Giữ màu', v: '30 năm' }]);
  r = await api('/danh-muc/claim_cam', 'POST', { cum_tu: 'tốt nhất', muc_do: 'chan' }); assert.equal(r.j.db.claim_cam[0].muc_do, 'CHAN');
  r = await api('/danh-muc/kenh', 'POST', { ten: 'Fanpage', loai: 'FANPAGE', api_ma: 'kingsmen', cach_dang: 'api' }); const k = r.j.db.kenh[0]; assert.equal(k.api_ma, 'KINGSMEN'); assert.equal(k.co_token, true); assert.ok(!JSON.stringify(r.j.db).includes('"tok"'));
  r = await api('/danh-muc/pillars/' + pid, 'DELETE'); assert.equal(r.j.db.pillars[0].active, false, 'pillar chỉ tắt');
  r = await api('/danh-muc/claim_cam/' + r.j.db.claim_cam[0].id, 'DELETE'); assert.equal(r.j.db.claim_cam.length, 0, 'claim xoá thật');
  assert.equal((await api('/danh-muc/pillars', 'POST', { ten: 'x' }, tGD)).status, 403);
  assert.equal((await api('/danh-muc/bang_la', 'POST', { ten: 'x' })).status, 404);
});
test('nhập danh mục một lần: upsert theo mã/tên, chỉ Admin', async () => {
  const body = { san_pham: [{ ma: 'G7000', ten: 'Kingsmen G7000 (mới)', thong_so: [] }, { ma: 'G3000', ten: 'G3000' }], pillars: [{ ten: 'Branding', ty_trong: 45 }, { ten: 'Problems', ty_trong: 20 }], kenh: [{ ten: 'Fanpage', loai: 'FANPAGE' }], claim_cam: [{ cum_tu: 'vĩnh viễn', muc_do: 'CHAN' }] };
  assert.equal((await api('/nhap/danh-muc', 'POST', body, tTruong)).status, 403);
  const r = await api('/nhap/danh-muc', 'POST', body); assert.equal(r.status, 200);
  assert.deepEqual(r.j.dem.san_pham, { them: 1, sua: 1 }); assert.deepEqual(r.j.dem.pillars, { them: 1, sua: 1 }); assert.deepEqual(r.j.dem.kenh, { them: 0, sua: 1 });
  assert.equal(r.j.db.san_pham.find(s => s.ma === 'G7000').ten, 'Kingsmen G7000 (mới)'); assert.equal(r.j.db.pillars.find(p => p.ten === 'Branding').ty_trong, 45);
});
test('việc giao người: staff tạo, người nhận xong, người ngoài không đụng', async () => {
  let r = await api('/cong-viec', 'POST', { loai: 'DUNG_VIDEO', tieu_de: 'Dựng clip A', giao_cho_vai_tro: 'SALES', han: '2026-10-10' }, tMkt); assert.equal(r.status, 200); const id = r.j.id;
  const tSale = (await dangNhap('sale@k.vn', '123456')).token;
  const bSale = (await api('/bootstrap', 'GET', null, tSale)).j.db; assert.equal(bSale.cong_viec.length, 1); assert.equal(bSale.buoc.length, 0, 'Sales không thấy bộ quyền');
  assert.equal((await api('/cong-viec/' + id + '/xong', 'POST', null, tGD)).status, 403);
  r = await api('/cong-viec/' + id + '/xong', 'POST', null, tSale); assert.equal(r.status, 200); assert.equal(r.j.db.cong_viec.length, 0);
});
test('mô phỏng: nạp → dữ liệu mp_, cờ bật, điểm sẵn sàng theo mẫu giả; xoá → sạch', async () => {
  assert.equal((await api('/mo-phong/nap', 'POST', null, tTruong)).status, 403);
  let r = await api('/mo-phong/nap', 'POST'); assert.equal(r.status, 200); const d = r.j.db;
  assert.equal(d.mo_phong, true); assert.equal(d.pillars.filter(p => p.id.startsWith('mp_')).length, 4); assert.equal(d.san_pham.filter(p => p.id.startsWith('mp_')).length, 4); assert.equal(d.cong_viec.filter(v => v.id.startsWith('mp_')).length, 3);
  const b1 = d.buoc.find(b => b.ma === 'B1'), b5 = d.buoc.find(b => b.ma === 'B5'); assert.ok(b1.so_mau === 45 && b1.san_sang >= 80, 'B1 đủ gạt'); assert.ok(b5.so_mau === 30 && b5.san_sang >= 80);
  assert.equal((await api('/buoc/B1', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' })).status, 200, 'mô phỏng cho phép thấy luật gạt hoạt động');
  r = await api('/mo-phong/nap', 'POST'); assert.equal(r.j.db.pillars.filter(p => p.id.startsWith('mp_')).length, 4, 'nạp lại không nhân đôi');
  r = await api('/mo-phong/xoa', 'POST'); assert.equal(r.status, 200); assert.equal(r.j.db.mo_phong, false);
  assert.equal(r.j.db.pillars.filter(p => p.id.startsWith('mp_')).length, 0); assert.equal(r.j.db.cong_viec.filter(v => v.id.startsWith('mp_')).length, 0);
  assert.equal(r.j.db.buoc.find(b => b.ma === 'B1').so_mau, 0); assert.equal(r.j.db.pillars.length, 2, 'danh mục thật (2 pillar từ test trước: Branding đã tắt + Problems) còn nguyên');
});
