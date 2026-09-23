// ADR-004 — ghép Trạm máy văn phòng (hợp đồng hub1): khoá & mã ghép, ping, lệnh, nhịp tim, nạp lô, việc cho agent content_os, đăng cách TRAM
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null, KHOA = null;
const api = async (p, method = 'GET', body, tok, hdr = {}) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}), ...hdr }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const hub = (p, method = 'GET', body, khoa = KHOA) => worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(khoa ? { 'X-Hub-Key': khoa } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }).then(async r => ({ status: r.status, j: await r.json().catch(() => null) }));
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7);
let tMkt, k1, kTram, mucId, ndId, mucVideo, ndVideo;
test('chưa có khoá → hub 503; tạo khoá (chỉ Admin) → mã ghép HUB1 giải mã đúng; sai khoá → 401', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  await api('/users', 'POST', { ho_ten: 'Ngọc', email: 'mkt@k.vn', password: '123456', vai_tro: 'MARKETING' }); tMkt = (await dangNhap('mkt@k.vn', '123456')).token;
  assert.equal((await hub('/hub/ping', 'GET', null, 'x')).status, 503);
  assert.equal((await api('/tram/khoa', 'POST', null, tMkt)).status, 403);
  const r = await api('/tram/khoa', 'POST'); assert.equal(r.status, 200); assert.match(r.j.ma_ghep, /^HUB1\./);
  const o = JSON.parse(Buffer.from(r.j.ma_ghep.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  assert.equal(o.id, 'content_os'); assert.equal(o.url, 'https://os.kingsmen.vn/api'); assert.ok(o.khoa.startsWith('kcos_')); assert.ok(o.mon.includes('content_os.*')); KHOA = o.khoa;
  assert.equal(r.j.db.tram.co_khoa, true); assert.ok(!JSON.stringify(r.j.db).includes(KHOA), 'bootstrap không lộ khoá');
  assert.equal((await hub('/hub/ping', 'GET', null, 'sai')).status, 401);
  assert.equal((await api('/cau-hinh/tram', 'PUT', { cau_hinh: { khoa: 'tay' } })).status, 422, 'không dán khoá tay');
  const p = await hub('/hub/ping'); assert.equal(p.status, 200); assert.equal(p.j.app, 'content_os'); assert.equal(p.j.hop_dong, 1); assert.ok(p.j.mon.some(m => m.viec === 'doi_thu.quet'));
});
test('lệnh: staff xếp chay_agent (gộp trùng) → Trạm hỏi /hub/lenh nhận & DA_GUI → lenh_xong; việc lạ bị từ chối', async () => {
  let r = await api('/tram/lenh', 'POST', { viec: 'chay_agent', tham_so: { id: 'content_os', viec: 'dang' } }, tMkt); assert.equal(r.status, 200); const id = r.j.id;
  r = await api('/tram/lenh', 'POST', { viec: 'chay_agent', tham_so: { id: 'content_os', viec: 'dang' } }, tMkt); assert.equal(r.j.trung, true); assert.equal(r.j.id, id);
  assert.equal((await api('/tram/lenh', 'POST', { viec: 'khoi_dong_lai_may' }, tMkt)).status, 400);
  let h = await hub('/hub/lenh'); assert.equal(h.j.lenh.length, 1); assert.deepEqual(h.j.lenh[0].tham_so, { id: 'content_os', viec: 'dang' });
  h = await hub('/hub/lenh'); assert.equal(h.j.lenh.length, 0, 'đã gửi thì không gửi lại');
  h = await hub('/hub/lenh_xong', 'POST', { id, ok: true, msg: 'đã cho chạy' }); assert.equal(h.status, 200);
  const b = (await api('/bootstrap')).j.db; assert.equal(b.tram.lenh[0].trang_thai, 'XONG'); assert.equal(b.tram.lenh[0].ket_qua, 'đã cho chạy');
});
test('nhịp tim: /hub/trang_thai → bootstrap.tram.trang_thai.song; im quá 6 phút → không sống', async () => {
  let h = await hub('/hub/trang_thai', 'POST', { may: 'Ngoc-Han', ban: '9.153', gio_may: '2026-09-23 18:00', phien: { tiktok_cn: { ten: 'TikTok', tt: 'ok', co_phien: true } } }); assert.equal(h.status, 200);
  let b = (await api('/bootstrap')).j.db; assert.equal(b.tram.trang_thai.song, true); assert.equal(b.tram.trang_thai.may, 'Ngoc-Han'); assert.equal(b.tram.trang_thai.phien.tiktok_cn.co_phien, true);
  DB.raw.prepare(`UPDATE tram_trang_thai SET nhan_luc=?`).run(new Date(Date.now() - 10 * 60000).toISOString());
  b = (await api('/bootstrap')).j.db; assert.equal(b.tram.trang_thai.song, false); assert.ok(b.tram.trang_thai.im_phut >= 9);
});
test('nạp lô: doi_thu_tin → ý tưởng nguồn DOI_THU (chống trùng); bảng lạ → chỉ ghi sổ', async () => {
  let h = await hub('/hub/nap', 'POST', { viec: 'doi_thu.quet', bang: 'doi_thu_tin', luot: 'l1', phan: { i: 1, n: 1 }, dong: [{ tieu_de: 'Hãng X ra keo ron mới', noi_dung: 'mô tả', link: 'https://x.vn/a' }, { tieu_de: 'Hãng X ra keo ron mới', link: 'https://x.vn/a' }, { tieu_de: '' }] });
  assert.equal(h.status, 200); assert.equal(h.j.moi, 1);
  const b = (await api('/bootstrap')).j.db; const y = b.y_tuong.find(x => x.nguon === 'DOI_THU'); assert.ok(y); assert.equal(y.ten, 'Hãng X ra keo ron mới'); assert.equal(y.trang_thai, 'MOI');
  h = await hub('/hub/nap', 'POST', { viec: 'tiktok_cn.binh_luan', bang: 'fchat_events', luot: 'l2', dong: [{ a: 1 }] }); assert.equal(h.status, 200); assert.equal(h.j.moi, 0);
  assert.equal(b.tram.lo.length >= 1, true); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM tram_lo`).get().n, 2);
});
test('đăng cách TRAM: kênh TikTok → tới giờ: Trạm im → giao tay; Trạm sống → DANG_GUI + lệnh; /hub/viec/dang liệt kê; lô dang_ket_qua → DA_DANG/LOI', async () => {
  const p1 = (await api('/danh-muc/pillars', 'POST', { ten: 'Problems', ty_trong: 100 })).j.id;
  kTram = (await api('/danh-muc/kenh', 'POST', { ten: 'TikTok Kingsmen', loai: 'TIKTOK', cach_dang: 'tram' })).j.id; assert.equal((await api('/bootstrap')).j.db.kenh.find(k => k.id === kTram).cach_dang, 'TRAM');
  mucId = (await api('/muc', 'POST', { tieu_de: 'Clip TikTok', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: kTram, dinh_dang: 'POST' }, tMkt)).j.id;
  ndId = (await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'POST', tieu_de: 'Clip', hook: 'Hook', sections: [{ label: '1', text: 'x' }], cta: 'CTA' }, tMkt)).j.id;
  await api('/users', 'POST', { ho_ten: 'Trang', email: 'truong@k.vn', password: '123456', vai_tro: 'TRUONG_MKT' }); const tTruong = (await dangNhap('truong@k.vn', '123456')).token;
  let g = await api('/noi-dung/' + ndId + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === ndId && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong);
  for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run('b9' + i, 'B9', thangNay + '-01', 1, new Date().toISOString()); await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); await api('/buoc/B9', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' });
  const qua = new Date(Date.now() - 60e3).toISOString();
  // Trạm đang im (nhịp tim cũ 10 phút) → giao tay
  let r = await api('/bai-dang', 'POST', { noi_dung_id: ndId, kenh_id: kTram, gio_dang: qua }, tMkt); const bd1 = r.j.id; assert.equal(r.j.db.bai_dang.find(b => b.id === bd1).cach, 'TRAM');
  r = await api('/may/chay-thu', 'POST', { agent: 'DANG_BAI' }); assert.match(r.j.kq[0].tom_tat, /giao đăng tay 1/); assert.ok(r.j.db.cong_viec.some(v => v.doi_tuong_id === bd1 && /Trạm/.test(v.ly_do)));
  // Trạm sống → DANG_GUI + lệnh chay_agent
  await hub('/hub/trang_thai', 'POST', { may: 'Ngoc-Han', ban: '9.153' });
  r = await api('/bai-dang', 'POST', { noi_dung_id: ndId, kenh_id: kTram, gio_dang: qua }, tMkt); const bd2 = r.j.id;
  r = await api('/may/chay-thu', 'POST', { agent: 'DANG_BAI' }); assert.match(r.j.kq[0].tom_tat, /giao Trạm 1/); assert.equal(r.j.db.bai_dang.find(b => b.id === bd2).trang_thai, 'DANG_GUI');
  const l = await hub('/hub/lenh'); assert.ok(l.j.lenh.some(x => x.viec === 'chay_agent' && x.tham_so.viec === 'dang'));
  const v = await hub('/hub/viec/dang'); assert.equal(v.j.viec.length, 1); assert.equal(v.j.viec[0].bai_dang_id, bd2); assert.equal(v.j.viec[0].kenh.loai, 'TIKTOK'); assert.match(v.j.viec[0].noi_dung, /Hook/);
  let h = await hub('/hub/nap', 'POST', { viec: 'content_os.dang', bang: 'content_os.dang_ket_qua', luot: 'l3', dong: [{ bai_dang_id: bd2, ok: true, link: 'https://www.tiktok.com/@k/video/1' }, { bai_dang_id: 'khong_co', ok: true }] }); assert.equal(h.j.cap_nhat, 1); assert.equal(h.j.loi.length, 1);
  let b = (await api('/bootstrap')).j.db; const x2 = b.bai_dang.find(x => x.id === bd2); assert.equal(x2.trang_thai, 'DA_DANG'); assert.equal(x2.link, 'https://www.tiktok.com/@k/video/1'); assert.equal(b.muc_noi_dung.find(m => m.id === mucId).giai_doan, 'DA_DANG');
  // đo lường: bài đã đăng có link nằm trong /hub/viec/do_luong; lô content_os.ket_qua giữ nguyên dòng trong tram_lo cho ADR-005
  const dl = await hub('/hub/viec/do_luong'); assert.equal(dl.j.viec.length, 1); assert.equal(dl.j.viec[0].link, 'https://www.tiktok.com/@k/video/1');
  h = await hub('/hub/nap', 'POST', { viec: 'content_os.do_luong', bang: 'content_os.ket_qua', luot: 'l4', dong: [{ bai_dang_id: bd2, ngay: '2026-09-23', tich_luy: { luot_xem: 1200 } }] }); assert.equal(h.status, 200);
  const lo = DB.raw.prepare(`SELECT xu_ly FROM tram_lo WHERE bang='content_os.ket_qua'`).get(); assert.equal(JSON.parse(lo.xu_ly).dong[0].tich_luy.luot_xem, 1200);
  // lỗi đăng → LOI
  r = await api('/bai-dang', 'POST', { noi_dung_id: ndId, kenh_id: kTram, gio_dang: qua }, tMkt); const bd3 = r.j.id; await api('/may/chay-thu', 'POST', { agent: 'DANG_BAI' });
  h = await hub('/hub/nap', 'POST', { viec: 'content_os.dang', bang: 'content_os.dang_ket_qua', luot: 'l5', dong: [{ bai_dang_id: bd3, ok: false, loi: 'phiên TikTok hết hạn' }] });
  b = (await api('/bootstrap')).j.db; const x3 = b.bai_dang.find(x => x.id === bd3); assert.equal(x3.trang_thai, 'LOI'); assert.match(x3.loi, /Trạm: phiên TikTok/);
});
test('dựng video: /hub/viec/dung_video liệt kê kịch bản VIDEO đã duyệt chưa có video; /hub/upload cần khoá; lô content_os.video → tài sản + gắn video', async () => {
  const p1 = (await api('/bootstrap')).j.db.pillars[0].id;
  mucVideo = (await api('/muc', 'POST', { tieu_de: 'Video Trạm dựng', thang: thangNay, tuan: 2, pillar_id: p1, dinh_dang: 'VIDEO' }, tMkt)).j.id;
  ndVideo = (await api('/noi-dung', 'POST', { muc_id: mucVideo, dinh_dang: 'VIDEO', tieu_de: 'Video Trạm dựng', hook: 'Hook', sections: [{ label: 'Cảnh 1', text: 'a', hinh: 'cận' }], cta: 'CTA' }, tMkt)).j.id;
  await api('/tai-san', 'POST', { ten: 'f1.mp4', media_url: '/media/media/f1.mp4', media_type: 'VIDEO', muc_id: mucVideo }, tMkt);
  const tTruong = (await dangNhap('truong@k.vn', '123456')).token; const g = await api('/noi-dung/' + ndVideo + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === ndVideo && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong);
  const v = await hub('/hub/viec/dung_video'); assert.equal(v.j.viec.length, 1); assert.equal(v.j.viec[0].noi_dung_id, ndVideo); assert.equal(v.j.viec[0].tai_san[0].media_url, 'https://os.kingsmen.vn/media/media/f1.mp4');
  const up = await worker.fetch(new Request('https://x/api/hub/upload?type=video/mp4', { method: 'POST', headers: { 'X-Hub-Key': 'sai', 'Content-Type': 'video/mp4', 'Content-Length': '3' }, body: 'abc' }), env, { waitUntil() {} }); assert.equal(up.status, 401);
  const h = await hub('/hub/nap', 'POST', { viec: 'content_os.dung_video', bang: 'content_os.video', luot: 'l6', dong: [{ noi_dung_id: ndVideo, media_url: '/media/media/dung.mp4', mo_ta: 'ffmpeg 1 cảnh' }] }); assert.equal(h.j.moi, 1);
  const b = (await api('/bootstrap')).j.db; assert.equal(b.noi_dung.find(n => n.id === ndVideo).chi_tiet.video_url, '/media/media/dung.mp4'); assert.ok(b.tai_san.some(t => t.loai === 'VIDEO_XUAT' && t.nguon === 'TRAM' && t.noi_dung_id === ndVideo));
  const v2 = await hub('/hub/viec/dung_video'); assert.equal(v2.j.viec.length, 0, 'đã có video → không dựng lại');
});
