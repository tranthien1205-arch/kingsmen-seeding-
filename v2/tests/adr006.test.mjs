// ADR-006 — gạt bước sang AI: điểm gần đây, máy đề nghị lên/hạ (giao việc, không tự gạt), gạt đóng việc, tay máy B6, mẫu học B6, xem mẫu & lịch sử
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7); const hn = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const mau = (buoc, n, giong, ngayTruoc = 0) => { for (let i = 0; i < n; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,dau_ra_may,dau_ra_nguoi,created_at) VALUES (?,?,?,?,?,?,?)`).run(buoc + Math.random(), buoc, hn, giong, '{"quyet":"DUYET"}', '{"quyet":"' + (giong >= 0.5 ? 'DUYET' : 'BO') + '"}', new Date(Date.now() - ngayTruoc * 864e5 - i * 1000).toISOString()); };
let tMkt, tTruong, p1, kFB;
test('chuẩn bị', async () => { TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token; for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt }); tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token;
  p1 = (await api('/danh-muc/pillars', 'POST', { ten: 'Problems', ty_trong: 100 })).j.id; kFB = (await api('/danh-muc/kenh', 'POST', { ten: 'Fanpage', loai: 'FANPAGE', cach_dang: 'TAY' })).j.id; });
test('đề nghị LÊN: B1 đủ 80/100 & 30 mẫu → de_nghi=LEN + việc cho Trưởng MKT (không nhân đôi); B8 (tối đa NGƯỜI) không bao giờ đề nghị', async () => {
  mau('B1', 35, 0.9, 20); mau('B8', 40, 1);   // 35 mẫu tốt từ 20 ngày trước (ngoài cửa sổ "gần đây")
  let r = await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.match(r.j.kq[0].tom_tat, /đề nghị gạt lên 1/);
  let b = r.j.db.buoc.find(x => x.ma === 'B1'); assert.equal(b.de_nghi, 'LEN'); assert.match(b.de_nghi_ly_do, /AI_GOI_Y/); assert.equal(b.san_sang, 90); assert.equal(b.so_mau_gan, 0);
  assert.equal(r.j.db.buoc.find(x => x.ma === 'B8').de_nghi, null);
  const v = r.j.db.cong_viec.filter(x => x.loai === 'GAT_BUOC'); assert.equal(v.length, 1); assert.equal(v[0].giao_cho_vai_tro, 'TRUONG_MKT'); assert.match(v[0].tieu_de, /B1/);
  r = await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.equal(r.j.db.cong_viec.filter(x => x.loai === 'GAT_BUOC').length, 1, 'chạy lại không nhân đôi');
  // máy KHÔNG tự gạt
  assert.equal(r.j.db.buoc.find(x => x.ma === 'B1').nguoi_thuc_hien, 'NGUOI');
});
test('người gạt theo đề nghị → việc đóng, đề nghị tính lại (AI_GOI_Y đủ điểm gần đây → lại đề nghị lên AI_TU_LAM)', async () => {
  let r = await api('/buoc/B1', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' }, tTruong); assert.equal(r.status, 200);
  assert.equal(r.j.db.cong_viec.filter(x => x.loai === 'GAT_BUOC' && x.trang_thai === 'MO').length, 1, 'việc cũ XONG, việc mới (lên AI_TU_LAM) được tạo');
  const b = r.j.db.buoc.find(x => x.ma === 'B1'); assert.equal(b.de_nghi, 'LEN'); assert.match(b.de_nghi_ly_do, /AI_TU_LAM/);
  assert.equal(DB.raw.prepare(`SELECT trang_thai FROM cong_viec WHERE loai='GAT_BUOC' AND doi_tuong_id LIKE 'buoc:B1:LEN:NGUOI'`).get().trang_thai, 'XONG');
  r = await api('/buoc/B1', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' }, tTruong); assert.equal(r.status, 200); assert.equal(r.j.db.buoc.find(x => x.ma === 'B1').de_nghi, null, 'đã tối đa → hết đề nghị');
  assert.equal(r.j.db.cong_viec.filter(x => x.loai === 'GAT_BUOC' && x.trang_thai === 'MO').length, 0);
});
test('đề nghị HẠ: bước ở mức AI mà điểm 14 ngày gần nhất < 60 trên ≥ 5 mẫu → de_nghi=XUONG; hồi phục → huỷ đề nghị', async () => {
  mau('B1', 6, 0.2);   // 6 mẫu xấu gần đây (tổng vẫn cao vì 35 mẫu cũ)
  let r = await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); const b = r.j.db.buoc.find(x => x.ma === 'B1'); assert.equal(b.de_nghi, 'XUONG', JSON.stringify({ ss: b.san_sang, gan: b.san_sang_gan, n: b.so_mau_gan })); assert.equal(b.nguoi_thuc_hien, 'AI_TU_LAM', 'máy không tự hạ');
  assert.ok(r.j.db.cong_viec.some(x => x.loai === 'GAT_BUOC' && /Hạ bước B1/.test(x.tieu_de) && x.trang_thai === 'MO'));
  mau('B1', 30, 1);   // người đồng ý lại nhiều → điểm gần đây lên
  r = await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.equal(r.j.db.buoc.find(x => x.ma === 'B1').de_nghi, null); assert.equal(r.j.db.cong_viec.filter(x => x.loai === 'GAT_BUOC' && x.trang_thai === 'MO').length, 0, 'việc đề nghị hạ bị máy huỷ');
});
test('B6 tay máy: post đã duyệt → AI_GOI_Y tạo bài đăng CHUẨN BỊ + giao việc; người lên lịch → mẫu học B6; AI_TU_LAM lên lịch luôn theo ngày đăng', async () => {
  const taoDuyet = async (ngay) => { const m = (await api('/muc', 'POST', { tieu_de: 'Post', thang: thangNay, tuan: 1, ngay_dang: ngay, pillar_id: p1, kenh_id: kFB, dinh_dang: 'POST' }, tMkt)).j.id; const nd = (await api('/noi-dung', 'POST', { muc_id: m, dinh_dang: 'POST', tieu_de: 'P', hook: 'Hook', sections: [{ label: '1', text: 'x' }], cta: 'CTA', chi_tiet: { hashtag: '#k' } }, tMkt)).j.id; const g = await api('/noi-dung/' + nd + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === nd && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong); return { m, nd }; };
  const a = await taoDuyet(null);
  let r = await api('/may/chay-thu', 'POST', { agent: 'HOAN_THIEN_BAI' }); assert.match(r.j.kq[0].bo_qua || '', /NGƯỜI/);
  await api('/buoc/B6', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' }); r = await api('/may/chay-thu', 'POST', { agent: 'HOAN_THIEN_BAI' }); assert.match(r.j.kq[0].tom_tat, /Hoàn thiện 1 bài \(chuẩn bị/);
  const bd = r.j.db.bai_dang.find(x => x.noi_dung_id === a.nd); assert.equal(bd.trang_thai, 'CHUAN_BI'); assert.equal(bd.created_by_name, 'Máy (B6)'); assert.match(bd.noi_dung_dang, /Hook[\s\S]*#k/); assert.ok(r.j.db.cong_viec.some(v => v.loai === 'LEN_LICH' && v.doi_tuong_id === a.nd));
  r = await api('/may/chay-thu', 'POST', { agent: 'HOAN_THIEN_BAI' }); assert.match(r.j.kq[0].bo_qua || '', /Không có/, 'không tạo lại');
  // người sửa bản đăng rồi lên lịch → mẫu B6 giống < 1; việc LEN_LICH xong
  r = await api('/bai-dang/' + bd.id, 'PATCH', { noi_dung_dang: bd.noi_dung_dang + '\n\nThêm một câu của người.', gio_dang: new Date(Date.now() + 864e5).toISOString() }, tMkt); assert.equal(r.j.db.bai_dang.find(x => x.id === bd.id).trang_thai, 'DA_LEN_LICH');
  const mh = DB.raw.prepare(`SELECT giong FROM mau_hoc WHERE buoc='B6'`).all(); assert.equal(mh.length, 1); assert.ok(mh[0].giong > 0.1 && mh[0].giong < 1, 'giong=' + mh[0].giong); assert.ok(!r.j.db.cong_viec.some(v => v.loai === 'LEN_LICH' && v.trang_thai === 'MO'));
  // AI_TU_LAM
  mau('B6', 30, 0.95); await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.equal((await api('/buoc/B6', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' })).status, 200);
  const ngayMai = new Date(Date.now() + 2 * 864e5 + 7 * 36e5).toISOString().slice(0, 10); const c = await taoDuyet(ngayMai);
  r = await api('/may/chay-thu', 'POST', { agent: 'HOAN_THIEN_BAI' }); assert.match(r.j.kq[0].tom_tat, /đã lên lịch/); const bd2 = r.j.db.bai_dang.find(x => x.noi_dung_id === c.nd); assert.equal(bd2.trang_thai, 'DA_LEN_LICH'); assert.ok(bd2.gio_dang.startsWith(new Date(ngayMai + 'T19:00:00+07:00').toISOString().slice(0, 13)), bd2.gio_dang);
});
test('xem mẫu học & lịch sử gạt của bước; GĐ xem được, Sales không', async () => {
  const r = await api('/buoc/B1/mau'); assert.equal(r.status, 200); assert.ok(r.j.mau.length > 0 && r.j.mau.length <= 20); assert.ok(r.j.lich_su.length >= 2); assert.match(r.j.lich_su[0].detail, /→/);
  await api('/users', 'POST', { ho_ten: 'S', email: 's@k.vn', password: '123456', vai_tro: 'SALES' }); const tS = (await dangNhap('s@k.vn', '123456')).token; assert.equal((await api('/buoc/B1/mau', 'GET', null, tS)).status, 403);
});
