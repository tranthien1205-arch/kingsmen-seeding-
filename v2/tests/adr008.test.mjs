// ADR-008 — máy dựng ghép theo tài khoản: ghép máy (khoá hash, mã MAY1), nhịp tim máy con, lệnh có máy đích, script tải từ app kèm hash,
// TTS ở Worker (khoá Google, ngân sách AI), việc dựng → máy của người / máy rảnh / Trạm, lô content_os.video có gói CapCut + thiếu hình → việc người, agent B8, gỡ máy
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let TTS_OK = true; const calls = [];
globalThis.fetch = async (url, opt) => { const u = String(url); calls.push(u);
  if (u.includes('texttospeech.googleapis.com')) return TTS_OK ? new Response(JSON.stringify({ audioContent: Buffer.from('ID3fake-mp3').toString('base64') }), { status: 200 }) : new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 });
  return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const SCRIPT = fs.readFileSync(new URL('../tools/may-dung/dung-video.mjs', import.meta.url), 'utf8');
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async (req) => new URL(req.url).pathname === '/tools/may-dung/dung-video.mjs' ? new Response(SCRIPT, { status: 200 }) : new Response('x', { status: 404 }) } };
let TOKEN = null, KHOA_TRAM = null, KHOA_MAY = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const hubRaw = (p, method, body, khoa) => worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': khoa }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
const hub = (p, method = 'GET', body, khoa) => hubRaw(p, method, body, khoa || KHOA_MAY).then(async r => ({ status: r.status, j: await r.json().catch(() => null), h: r.headers }));
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7);
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
let tMkt, tTruong, tMkt2, mayId, ndId, mucId, lenhId;
test('chuẩn bị: người dùng, khoá Trạm văn phòng, kịch bản VIDEO duyệt → Sản xuất, footage', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT'], ['Hải', 'mkt2@k.vn', 'MARKETING']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt });
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token; tMkt2 = (await dangNhap('mkt2@k.vn', '123456')).token;
  KHOA_TRAM = giai((await api('/tram/khoa', 'POST')).j.ma_ghep).khoa;
  const p1 = (await api('/danh-muc/pillars', 'POST', { ten: 'Problems', ty_trong: 100 })).j.id; const k = (await api('/danh-muc/kenh', 'POST', { ten: 'TikTok', loai: 'TIKTOK', cach_dang: 'TAY' })).j.id;
  mucId = (await api('/muc', 'POST', { tieu_de: 'Ron mốc sau mùa mưa', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: k, dinh_dang: 'VIDEO' }, tMkt)).j.id;
  ndId = (await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'VIDEO', tieu_de: 'Ron mốc', hook: 'Ron nhà bạn đen sau một mùa mưa?', sections: [{ label: 'Cảnh 1', text: 'Đây là ron cũ bị mốc đen. Nhìn rất xấu.', hinh: 'cận cảnh ron mốc đen' }, { label: 'Cảnh 2', text: 'Thợ trét keo ron Kingsmen, khô nhanh.', hinh: 'thợ đang trét keo ron' }], cta: 'Inbox Kingsmen để được tư vấn' }, tMkt)).j.id;
  const g = await api('/noi-dung/' + ndId + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === ndId && x.trang_thai === 'CHO'); const q = await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong); assert.equal(q.j.db.muc_noi_dung.find(m => m.id === mucId).giai_doan, 'SAN_XUAT');
  await api('/tai-san', 'POST', { ten: 'ron moc den can canh.mp4', mo_ta: 'cận cảnh ron mốc', media_url: '/media/media/a.mp4', media_type: 'VIDEO', loai: 'FOOTAGE', muc_id: mucId }, tMkt);
  await api('/tai-san', 'POST', { ten: 'nhac nen nhe.mp3', mo_ta: 'nhẹ nhàng', media_url: '/media/media/n.mp3', media_type: 'AUDIO', loai: 'NHAC' }, tMkt);
  const b = (await api('/bootstrap')).j.db; assert.ok(b.tai_san.some(t => t.loai === 'NHAC' && t.media_type === 'AUDIO')); assert.deepEqual(b.may_ghep, []); assert.equal(b.san_sang.tts, false); assert.equal(b.module_config.dung_video.tts_giong, 'vi-VN-Neural2-D');
});
test('ghép máy: MKT tạo mã MAY1 (khoá hiện một lần, DB chỉ giữ hash); máy con ping/nhịp tim → 🟢; Trạm văn phòng vẫn dùng khoá cũ; khoá lạ 401', async () => {
  let r = await api('/may-ghep', 'POST', { ten: 'Laptop Ngọc' }, tMkt); assert.equal(r.status, 200); mayId = r.j.id; const o = giai(r.j.ma_ghep); assert.equal(o.may_id, mayId); assert.ok(o.khoa.startsWith('kmay_')); assert.equal(o.url, 'https://os.kingsmen.vn/api'); assert.deepEqual(o.kha_nang, ['dung_video']); KHOA_MAY = o.khoa;
  const row = DB.raw.prepare(`SELECT khoa_hash FROM may_ghep WHERE id=?`).get(mayId); assert.ok(row.khoa_hash.length === 64 && row.khoa_hash !== KHOA_MAY); assert.ok(!JSON.stringify(r.j.db).includes(KHOA_MAY), 'bootstrap không lộ khoá máy');
  const m = r.j.db.may_ghep.find(x => x.id === mayId); assert.equal(m.chu_ten, 'Ngọc'); assert.equal(m.song, false);
  let h = await hub('/hub/ping'); assert.equal(h.status, 200); assert.equal(h.j.may_id, mayId);
  h = await hub('/hub/trang_thai', 'POST', { may: 'NGOC-LAPTOP', ban: '1.0', ffmpeg: true }); assert.equal(h.status, 200); assert.equal(h.j.may_id, mayId);
  const b = (await api('/bootstrap')).j.db; const m2 = b.may_ghep.find(x => x.id === mayId); assert.equal(m2.song, true); assert.equal(m2.than.may, 'NGOC-LAPTOP'); assert.equal(m2.ban, '1.0');
  assert.equal(b.tram.trang_thai, null, 'nhịp tim máy con không ghi đè trạng thái Trạm');
  h = await hub('/hub/ping', 'GET', null, KHOA_TRAM); assert.equal(h.j.may_id, 'tram'); assert.equal((await hub('/hub/ping', 'GET', null, 'kmay_khong_co')).status, 401);
});
test('script tải từ app: /hub/script/dung-video trả script + hash sha256 đúng; script lạ 404', async () => {
  const h = await hub('/hub/script/dung-video'); assert.equal(h.status, 200); assert.equal(h.j.script, SCRIPT); const { createHash } = await import('node:crypto'); assert.equal(h.j.hash, createHash('sha256').update(SCRIPT).digest('hex')); assert.equal(h.j.ban, h.j.hash.slice(0, 12));
  assert.equal((await hub('/hub/script/xoa-o-cung')).status, 404);
});
test('giao dựng: MKT bấm dựng → lệnh dung_video gắn máy của mình; máy khác không thấy; Trạm không thấy; gộp trùng; /hub/viec/dung_video?noi_dung_id có gợi ý hình + nhạc + cấu hình', async () => {
  let r = await api('/noi-dung/' + ndId + '/dung', 'POST', {}, tMkt); assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.may_id, mayId); assert.equal(r.j.may_ten, 'Laptop Ngọc'); lenhId = r.j.lenh_id;
  const l = r.j.db.tram.lenh.find(x => x.id === lenhId); assert.equal(l.viec, 'dung_video'); assert.equal(l.tham_so.noi_dung_id, ndId); assert.equal(l.may_id, mayId);
  r = await api('/noi-dung/' + ndId + '/dung', 'POST', {}, tMkt); assert.equal(r.j.trung, true);
  // máy của Hải chưa ghép → Hải bấm dựng: máy rảnh duy nhất là máy Ngọc
  r = await api('/noi-dung/' + ndId + '/dung', 'POST', {}, tMkt2); assert.equal(r.j.may_id, mayId); assert.equal(r.j.trung, true);
  assert.equal((await api('/noi-dung/' + ndId + '/dung', 'POST', { may_id: 'may_khong_co' }, tMkt)).status, 409);
  let h = await hub('/hub/lenh', 'GET', null, KHOA_TRAM); assert.equal(h.j.lenh.length, 0, 'Trạm không thấy lệnh của máy con');
  h = await hub('/hub/lenh'); assert.equal(h.j.lenh.length, 1); assert.equal(h.j.lenh[0].id, lenhId); assert.equal(h.j.lenh[0].tham_so.noi_dung_id, ndId);
  h = await hub('/hub/lenh'); assert.equal(h.j.lenh.length, 0, 'đã gửi thì không gửi lại');
  h = await hub('/hub/viec/dung_video?noi_dung_id=' + ndId); assert.equal(h.j.viec.length, 1); const v = h.j.viec[0]; assert.equal(v.sections[0].hinh, 'cận cảnh ron mốc đen'); assert.equal(v.tai_san.length, 1); assert.equal(v.tai_san[0].media_url, 'https://os.kingsmen.vn/media/media/a.mp4'); assert.equal(v.nhac.length, 1); assert.equal(v.cau_hinh.nhac_giam_db, 18); assert.equal(v.cau_hinh.tts_giong, 'vi-VN-Neural2-D');
});
test('TTS ở Worker: chưa khoá → 503; có khoá → mp3 + ai_usage tinh_nang tts có chi phí; Google lỗi → 502; vượt ngân sách → 402', async () => {
  let h = await hub('/hub/tts', 'POST', { text: 'Ron nhà bạn đen sau một mùa mưa?' }); assert.equal(h.status, 503); assert.equal(h.j.thieu_key, true);
  env.GOOGLE_TTS_KEY = 'g-key'; const r = await hubRaw('/hub/tts', 'POST', { text: 'Ron nhà bạn đen sau một mùa mưa?' }, KHOA_MAY); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'audio/mpeg'); assert.equal(r.headers.get('x-tts-giong'), 'vi-VN-Neural2-D'); assert.equal(Buffer.from(await r.arrayBuffer()).toString(), 'ID3fake-mp3');
  const u = DB.raw.prepare(`SELECT * FROM ai_usage WHERE tinh_nang='tts'`).all(); assert.equal(u.length, 1); assert.equal(u[0].provider, 'google'); assert.equal(u[0].tokens_vao, 32); assert.ok(Math.abs(u[0].chi_phi_usd - 32 * 16 / 1e6) < 1e-9);
  TTS_OK = false; h = await hub('/hub/tts', 'POST', { text: 'x y z' }); assert.equal(h.status, 502); TTS_OK = true;
  await api('/cau-hinh/ai', 'PUT', { cau_hinh: { ngan_sach_thang_usd: 0.0001, chan_khi_vuot: true } }); h = await hub('/hub/tts', 'POST', { text: 'x y z' }); assert.equal(h.status, 402); await api('/cau-hinh/ai', 'PUT', { cau_hinh: { ngan_sach_thang_usd: 0 } });
});
test('máy báo xong + lô content_os.video: bản nháp VIDEO_XUAT + gói CapCut GOI_DUNG + thiếu hình → việc DUYET_VIDEO_NHAP & QUAY_BO_SUNG (không nhân đôi); lệnh XONG', async () => {
  let h = await hub('/hub/upload?type=application/zip', 'POST', null); assert.equal(h.status, 503, 'không có R2 trong test → 503, máy dùng link');
  h = await hub('/hub/nap', 'POST', { viec: 'may_dung.dung_video', bang: 'content_os.video', luot: 'md1', dong: [{ noi_dung_id: ndId, media_url: '/media/media/ban-nhap.mp4', goi_url: '/media/media/goi.zip', thieu_hinh: ['Cảnh 2: thợ đang trét keo ron'], mo_ta: 'Máy dựng v2 · 3 cảnh · 24s · có giọng đọc', may: 'NGOC-LAPTOP' }] }); assert.equal(h.status, 200); assert.equal(h.j.moi, 1);
  h = await hub('/hub/lenh_xong', 'POST', { id: lenhId, ok: true, msg: 'Máy dựng v2 · 3 cảnh' }); assert.equal(h.status, 200);
  const b = (await api('/bootstrap', 'GET', null, tMkt)).j.db; const nd = b.noi_dung.find(x => x.id === ndId); assert.equal(nd.chi_tiet.video_url, '/media/media/ban-nhap.mp4'); assert.equal(nd.chi_tiet.goi_dung_url, '/media/media/goi.zip'); assert.match(nd.chi_tiet.thieu_hinh, /Cảnh 2/);
  const ts = b.tai_san.filter(t => t.noi_dung_id === ndId); assert.ok(ts.some(t => t.loai === 'VIDEO_XUAT' && t.created_by_name === 'NGOC-LAPTOP')); const goi = ts.find(t => t.loai === 'GOI_DUNG'); assert.equal(goi.media_type, 'FILE'); assert.match(goi.ten, /CapCut/);
  assert.equal(b.cong_viec.filter(v => v.loai === 'DUYET_VIDEO_NHAP' && v.doi_tuong_id === ndId && v.trang_thai === 'MO').length, 1); const q = b.cong_viec.find(v => v.loai === 'QUAY_BO_SUNG' && v.doi_tuong_id === ndId); assert.ok(q); assert.match(q.ly_do, /thợ đang trét/);
  assert.equal(b.tram.lenh.find(x => x.id === lenhId).trang_thai, 'XONG');
  await hub('/hub/nap', 'POST', { viec: 'may_dung.dung_video', bang: 'content_os.video', luot: 'md2', dong: [{ noi_dung_id: ndId, media_url: '/media/media/ban-nhap-2.mp4', thieu_hinh: [], may: 'NGOC-LAPTOP' }] });
  const b2 = (await api('/bootstrap', 'GET', null, tMkt)).j.db; assert.equal(b2.cong_viec.filter(v => v.loai === 'DUYET_VIDEO_NHAP' && v.doi_tuong_id === ndId && v.trang_thai === 'MO').length, 1, 'không nhân đôi việc'); assert.equal(b2.noi_dung.find(x => x.id === ndId).chi_tiet.goi_dung_url, '', 'lần dựng mới không gói → xoá link gói cũ');
});
test('agent B8 CHUAN_BI_DUNG: kịch bản đã có video → bỏ qua; kịch bản mới + máy im → bỏ qua (không chờ máy im); máy sống → giao; dựng lại vẫn được khi chỉ định máy đang im', async () => {
  let r = await api('/may/chay-thu', 'POST', { agent: 'CHUAN_BI_DUNG' }); assert.match(r.j.kq[0].bo_qua || '', /Không có kịch bản/);
  const p1 = (await api('/bootstrap')).j.db.pillars[0].id; const k = (await api('/bootstrap')).j.db.kenh[0].id;
  const m2 = (await api('/muc', 'POST', { tieu_de: 'Clip 2', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: k, dinh_dang: 'VIDEO' }, tMkt)).j.id; const nd2 = (await api('/noi-dung', 'POST', { muc_id: m2, dinh_dang: 'VIDEO', tieu_de: 'Clip 2', hook: 'Hook 2', sections: [{ label: '1', text: 'x' }], cta: 'CTA' }, tMkt)).j.id;
  const g = await api('/noi-dung/' + nd2 + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === nd2 && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong);
  DB.raw.prepare(`UPDATE may_ghep SET nhan_luc=? WHERE id=?`).run(new Date(Date.now() - 20 * 60000).toISOString(), mayId);
  r = await api('/may/chay-thu', 'POST', { agent: 'CHUAN_BI_DUNG' }); assert.match(r.j.kq[0].bo_qua || '', /Không có máy dựng/);
  r = await api('/noi-dung/' + nd2 + '/dung', 'POST', { may_id: mayId }, tMkt); assert.equal(r.status, 200); assert.match(r.j.ly_do, /đang im/); DB.raw.prepare(`UPDATE tram_lenh SET trang_thai='HONG' WHERE viec='dung_video' AND tham_so LIKE ?`).run('%' + nd2 + '%');
  await hub('/hub/trang_thai', 'POST', { may: 'NGOC-LAPTOP', ban: '1.0' });
  r = await api('/may/chay-thu', 'POST', { agent: 'CHUAN_BI_DUNG' }); assert.match(r.j.kq[0].tom_tat, /Giao dựng 1/); assert.ok(r.j.db.tram.lenh.some(l => l.viec === 'dung_video' && l.tham_so.noi_dung_id === nd2 && l.may_id === mayId && l.trang_thai === 'CHO'));
  r = await api('/may/chay-thu', 'POST', { agent: 'CHUAN_BI_DUNG' }); assert.match(r.j.kq[0].tom_tat || r.j.kq[0].bo_qua, /đang chờ máy|Giao dựng 0/);
  // B8 vẫn NGƯỜI
  assert.equal((await api('/bootstrap')).j.db.buoc.find(b => b.ma === 'B8').nguoi_thuc_hien, 'NGUOI');
});
test('gỡ máy: người khác không gỡ được; chủ gỡ → khoá hết hiệu lực, lệnh chờ HONG; không máy → Trạm sống nhận lệnh chay_agent dung_video', async () => {
  assert.equal((await api('/may-ghep/' + mayId, 'DELETE', null, tMkt2)).status, 403);
  let r = await api('/may-ghep/' + mayId, 'DELETE', null, tMkt); assert.equal(r.status, 200); assert.ok(!r.j.db.may_ghep.some(m => m.id === mayId)); assert.equal((await hub('/hub/ping')).status, 401);
  assert.ok(r.j.db.tram.lenh.filter(l => l.may_id === mayId).every(l => ['HONG', 'XONG'].includes(l.trang_thai)));
  await hub('/hub/trang_thai', 'POST', { may: 'Ngoc-Han', ban: '9.155' }, KHOA_TRAM);
  r = await api('/noi-dung/' + ndId + '/dung', 'POST', {}, tMkt); assert.equal(r.status, 200); assert.equal(r.j.may_id, 'tram'); const h = await hub('/hub/lenh', 'GET', null, KHOA_TRAM); assert.ok(h.j.lenh.some(l => l.viec === 'chay_agent' && l.tham_so.viec === 'dung_video'));
});
