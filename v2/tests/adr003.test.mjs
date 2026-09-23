// ADR-003 — soạn (B4, AI giả lập) · thẩm định & duyệt G3 (B5) · tài sản · bài đăng (B9) · mẫu học B4/B5. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; const calls = []; let AI_TEXT = null; let FB_OK = true;
globalThis.fetch = async (url, opt) => { const u = String(url); calls.push(u);
  if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: AI_TEXT }], usage: { input_tokens: 500, output_tokens: 300 } }), { status: 200 });
  if (u.includes('graph.facebook.com')) return FB_OK ? new Response(JSON.stringify({ id: '123_456' }), { status: 200 }) : new Response(JSON.stringify({ error: { message: 'Invalid OAuth' } }), { status: 400 });
  if (u.includes('n8n.local')) return new Response('{}', { status: 200 });
  return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, ANTHROPIC_API_KEY: 'k', TOKEN_KM: 'tok', N8N_TOKEN: 'n8', N8N_WEBHOOK_URL: 'https://n8n.local/hook', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7);
let tMkt, tMkt2, tTruong, p1, k1, mucId, ndId, mucVideo, ndVideo;
test('chuẩn bị: người dùng, pillar, kênh có token, claim cấm, mục kế hoạch', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Linh', 'mkt2@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt });
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tMkt2 = (await dangNhap('mkt2@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token;
  p1 = (await api('/danh-muc/pillars', 'POST', { ten: 'Problems', ty_trong: 100, muc_tieu: 'BAN_HANG' })).j.id;
  k1 = (await api('/danh-muc/kenh', 'POST', { ten: 'Fanpage', loai: 'FANPAGE', api_ma: 'KM', api_object_id: '999', cach_dang: 'API' })).j.id;
  await api('/danh-muc/claim_cam', 'POST', { cum_tu: 'tốt nhất thị trường', muc_do: 'CHAN' }); await api('/danh-muc/claim_cam', 'POST', { cum_tu: 'rẻ nhất', muc_do: 'CANH_BAO' });
  const sp = (await api('/danh-muc/san_pham', 'POST', { ma: 'G7000', ten: 'G7000', thong_so: [{ k: 'Giữ màu', v: '30 năm' }] })).j.id;
  mucId = (await api('/muc', 'POST', { tieu_de: 'Ron ố vàng mùa mưa', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: k1, dinh_dang: 'POST', san_pham_id: sp }, tMkt)).j.id;
  mucVideo = (await api('/muc', 'POST', { tieu_de: 'Video review', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: k1, dinh_dang: 'VIDEO' }, tMkt)).j.id;
});
test('AI viết: JSON được làm sạch theo định dạng; cụm CHẶN → từ chối', async () => {
  AI_TEXT = '```json\n{"tieu_de":"Ron ố vàng","hook":"Sau mùa mưa ron nhà bạn ngả vàng?","sections":[{"label":"Đoạn 1","text":"G7000 giữ màu 30 năm theo hồ sơ.","la":1}],"cta":"Inbox nhận bảng màu","hashtag":"#kingsmen","chu_phu":"bỏ"}\n```';
  let r = await api('/noi-dung/ai-viet', 'POST', { muc_id: mucId }, tMkt); assert.equal(r.status, 200); assert.equal(r.j.ok, true); assert.equal(r.j.noi_dung.dinh_dang, 'POST'); assert.deepEqual(r.j.noi_dung.chi_tiet, { hashtag: '#kingsmen' }); assert.equal(r.j.noi_dung.sections[0].la, undefined);
  assert.ok(calls.some(u => u.includes('api.anthropic.com'))); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM ai_usage WHERE tinh_nang='soan_noi_dung'`).get().n, 1);
  AI_TEXT = '{"hook":"Keo tốt nhất thị trường","cta":"mua"}'; r = await api('/noi-dung/ai-viet', 'POST', { muc_id: mucId }, tMkt); assert.equal(r.j.ok, false); assert.match(r.j.loi, /CHẶN/);
  r = await api('/scripts/ngu-canh', 'GET', null, tMkt); assert.equal(r.status, 200); assert.equal(r.j.kenh.length, 1, 'đường cũ cho công cụ video còn chạy');
});
test('nội dung: lưu nháp (mục → SOAN), cụm CHẶN 422, sửa → phiên bản mới', async () => {
  let r = await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'POST', tieu_de: 'Bài 1', hook: 'Keo tốt nhất thị trường' }, tMkt); assert.equal(r.status, 422); assert.deepEqual(r.j.blocked, ['tốt nhất thị trường']);
  r = await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'POST', tieu_de: 'Bài 1', hook: 'Sau mùa mưa, ron nhà bạn ngả vàng?', sections: [{ label: 'Đoạn 1', text: 'G7000 giữ màu 30 năm.' }], cta: '', chi_tiet: { hashtag: '#kingsmen' } }, tMkt); assert.equal(r.status, 200); ndId = r.j.id;
  const nd = r.j.db.noi_dung.find(n => n.id === ndId); assert.equal(nd.trang_thai, 'NHAP'); assert.equal(nd.tao_boi, 'NGUOI'); assert.equal(r.j.db.muc_noi_dung.find(m => m.id === mucId).giai_doan, 'SOAN');
  r = await api('/noi-dung/' + ndId, 'PATCH', { cta: 'Inbox nhận bảng màu' }, tMkt); assert.equal(r.status, 200); assert.equal(r.j.db.noi_dung.find(n => n.id === ndId).phien_ban, 2);
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM noi_dung_phien_ban WHERE noi_dung_id=?`).get(ndId).n, 2);
});
test('G3: gửi duyệt → máy chấm; người gửi không tự duyệt; Marketing không duyệt; trả lại cần lý do; duyệt → SAN_XUAT + mẫu B5', async () => {
  let r = await api('/noi-dung/' + ndId + '/gui-duyet', 'POST', null, tMkt); assert.equal(r.status, 200); assert.equal(r.j.tu_tra_lai, false); assert.ok(r.j.cham.diem >= 70, 'điểm ' + r.j.cham.diem); assert.equal(r.j.db.muc_noi_dung.find(m => m.id === mucId).giai_doan, 'CHO_DUYET');
  const d = r.j.db.duyet.find(x => x.doi_tuong_id === ndId && x.trang_thai === 'CHO'); assert.ok(d); assert.equal(d.cham_may.loi_cung.length, 0);
  assert.equal((await api('/noi-dung/' + ndId + '/gui-duyet', 'POST', null, tMkt)).status, 409, 'đang chờ rồi');
  assert.equal((await api('/noi-dung/' + ndId, 'PATCH', { cta: 'x' }, tMkt)).status, 409, 'chờ duyệt không sửa');
  assert.equal((await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tMkt2)).status, 403, 'Marketing không duyệt');
  // Trưởng MKT tự gửi rồi tự duyệt → chặn
  const nd2 = (await api('/noi-dung', 'POST', { muc_id: mucVideo, dinh_dang: 'VIDEO', tieu_de: 'Video review', hook: '2 năm ngâm nước — ron ra sao?', sections: [{ label: 'Cảnh 1', text: 'Cận mép hồ', hinh: 'cận' }], cta: 'Xem fanpage' }, tTruong)).j.id;
  const g2 = await api('/noi-dung/' + nd2 + '/gui-duyet', 'POST', null, tTruong); const d2 = g2.j.db.duyet.find(x => x.doi_tuong_id === nd2 && x.trang_thai === 'CHO');
  assert.equal((await api('/duyet/' + d2.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong)).status, 403, 'người gửi không tự duyệt');
  assert.equal((await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'TRA_LAI' }, tTruong)).status, 400, 'trả lại phải có lý do');
  r = await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong); assert.equal(r.status, 200);
  assert.equal(r.j.db.noi_dung.find(n => n.id === ndId).trang_thai, 'DUYET'); assert.equal(r.j.db.muc_noi_dung.find(m => m.id === mucId).giai_doan, 'SAN_XUAT');
  const mh = DB.raw.prepare(`SELECT * FROM mau_hoc WHERE buoc='B5'`).all(); assert.equal(mh.length, 1); assert.equal(mh[0].giong, 1, 'máy nghĩ duyệt, người duyệt → giống 1');
  r = await api('/duyet/' + d2.id + '/quyet', 'POST', { quyet: 'TRA_LAI', ly_do: 'thiếu cảnh sản phẩm' }); assert.equal(r.status, 200); ndVideo = nd2;
  assert.equal(r.j.db.noi_dung.find(n => n.id === nd2).trang_thai, 'TRA_LAI'); assert.equal(r.j.db.muc_noi_dung.find(m => m.id === mucVideo).giai_doan, 'SOAN');
  assert.equal(DB.raw.prepare(`SELECT giong FROM mau_hoc WHERE buoc='B5' ORDER BY created_at DESC LIMIT 1`).get().giong, 0, 'máy nghĩ duyệt, người trả → 0');
  // sửa bài đã duyệt → về NHÁP, mục về SOAN
  r = await api('/noi-dung/' + ndId, 'PATCH', { cta: 'Inbox ngay để nhận bảng màu' }, tMkt); assert.equal(r.j.db.noi_dung.find(n => n.id === ndId).trang_thai, 'NHAP'); assert.equal(r.j.db.muc_noi_dung.find(m => m.id === mucId).giai_doan, 'SOAN');
  r = await api('/noi-dung/' + ndId + '/gui-duyet', 'POST', null, tMkt); const d3 = r.j.db.duyet.find(x => x.doi_tuong_id === ndId && x.trang_thai === 'CHO'); await api('/duyet/' + d3.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong);
});
test('B5 ở AI GỢI Ý: máy tự TRẢ LẠI bài trượt luật cứng (thiếu CTA), không bao giờ tự duyệt', async () => {
  await api('/buoc/B5', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' });
  const m2 = (await api('/muc', 'POST', { tieu_de: 'Bài thiếu CTA', thang: thangNay, tuan: 2, pillar_id: p1, dinh_dang: 'POST' }, tMkt)).j.id;
  const nd = (await api('/noi-dung', 'POST', { muc_id: m2, dinh_dang: 'POST', tieu_de: 'Thiếu CTA', hook: 'Hook ok', sections: [{ label: '1', text: 'x' }] }, tMkt)).j.id;
  const r = await api('/noi-dung/' + nd + '/gui-duyet', 'POST', null, tMkt); assert.equal(r.j.tu_tra_lai, true); assert.match(r.j.cham.loi_cung.join(), /CTA/);
  assert.equal(r.j.db.noi_dung.find(n => n.id === nd).trang_thai, 'TRA_LAI'); assert.equal(r.j.db.muc_noi_dung.find(m => m.id === m2).giai_doan, 'SOAN');
  const d = DB.raw.prepare(`SELECT * FROM duyet WHERE doi_tuong_id=?`).get(nd); assert.equal(d.trang_thai, 'TRA_LAI'); assert.match(d.quyet_boi, /Máy/);
  // bài đủ luật cứng → vẫn CHỜ người
  const nd2 = (await api('/noi-dung', 'POST', { muc_id: m2, dinh_dang: 'POST', tieu_de: 'Đủ', hook: 'Hook ok', sections: [{ label: '1', text: 'x' }], cta: 'Inbox' }, tMkt)).j.id;
  const r2 = await api('/noi-dung/' + nd2 + '/gui-duyet', 'POST', null, tMkt); assert.equal(r2.j.tu_tra_lai, false); assert.equal(r2.j.db.noi_dung.find(n => n.id === nd2).trang_thai, 'CHO_DUYET');
  await api('/buoc/B5', 'PATCH', { nguoi_thuc_hien: 'NGUOI' });
});
test('kho kịch bản VIDEO đã duyệt + gắn video từ công cụ → tài sản VIDEO_XUAT; tài sản thêm/xoá', async () => {
  let r = await api('/scripts/kho', 'GET', null, tMkt); assert.equal(r.j.kich_ban.length, 0, 'video chưa duyệt');
  await api('/noi-dung/' + ndVideo, 'PATCH', { sections: [{ label: 'Cảnh 1', text: 'Cận mép hồ', hinh: 'cận' }, { label: 'Cảnh 2', text: 'Cận sản phẩm', hinh: 'cận' }] }, tTruong); const g = await api('/noi-dung/' + ndVideo + '/gui-duyet', 'POST', null, tTruong); const d = g.j.db.duyet.find(x => x.doi_tuong_id === ndVideo && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' });
  r = await api('/scripts/kho', 'GET', null, tMkt); assert.equal(r.j.kich_ban.length, 1); assert.equal(r.j.kich_ban[0].ke_hoach, 'Video review'); assert.equal(r.j.kich_ban[0].content_item_id, mucVideo);
  r = await api('/scripts/' + ndVideo + '/video', 'POST', { media_url: '/media/media/abc.mp4', footage_id: '' }, tMkt); assert.equal(r.status, 200); assert.ok(r.j.tai_san_id);
  const nd = r.j.db.noi_dung.find(n => n.id === ndVideo); assert.equal(nd.chi_tiet.video_url, '/media/media/abc.mp4'); assert.equal(r.j.db.tai_san.find(t => t.id === r.j.tai_san_id).loai, 'VIDEO_XUAT');
  assert.equal((await api('/scripts/' + ndId + '/video', 'POST', { media_url: 'x' }, tMkt)).status, 400, 'post không gắn video');
  r = await api('/tai-san', 'POST', { ten: 'anh1.jpg', media_url: 'https://x/a.jpg', media_type: 'IMAGE', muc_id: mucId }, tMkt); const ts = r.j.id; assert.equal(r.j.db.tai_san.find(t => t.id === ts).loai, 'ANH');
  r = await api('/tai-san/' + ts, 'DELETE', null, tMkt); assert.ok(!r.j.db.tai_san.some(t => t.id === ts));
  r = await api('/nhac', 'GET', null, tMkt); assert.equal(r.status, 200);
});
test('bài đăng: chỉ từ nội dung đã duyệt; đăng tay → DA_DANG + xong việc; API qua Graph; lỗi → LOI; B9 NGƯỜI → giao việc', async () => {
  assert.equal((await api('/bai-dang', 'POST', { noi_dung_id: ndVideo, kenh_id: k1 }, tMkt)).status, 200, 'video đã duyệt');
  const ndNhap = (await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'POST', tieu_de: 'nháp', hook: 'h', cta: 'c' }, tMkt)).j.id; assert.equal((await api('/bai-dang', 'POST', { noi_dung_id: ndNhap, kenh_id: k1 }, tMkt)).status, 409);
  const qua = new Date(Date.now() - 60e3).toISOString();
  let r = await api('/bai-dang', 'POST', { noi_dung_id: ndId, kenh_id: k1, gio_dang: qua, cach: 'API' }, tMkt); assert.equal(r.status, 200); const bd = r.j.db.bai_dang.find(b => b.id === r.j.id); assert.equal(bd.trang_thai, 'DA_LEN_LICH'); assert.match(bd.noi_dung_dang, /ngả vàng/); assert.match(bd.noi_dung_dang, /#kingsmen/);
  // B9 NGƯỜI → tới giờ máy giao việc đăng tay
  r = await api('/may/chay-thu', 'POST', { agent: 'DANG_BAI' }); assert.match(r.j.kq[0].tom_tat, /giao đăng tay [12]/); assert.ok(r.j.db.cong_viec.some(v => v.loai === 'DANG_TAY' && v.doi_tuong_id === bd.id)); assert.equal(r.j.db.bai_dang.find(b => b.id === bd.id).trang_thai, 'CHUAN_BI');
  r = await api('/bai-dang/' + bd.id, 'PATCH', { da_dang: true, link: 'https://fb.com/p/1' }, tMkt); assert.equal(r.j.db.bai_dang.find(b => b.id === bd.id).trang_thai, 'DA_DANG'); assert.equal(r.j.db.muc_noi_dung.find(m => m.id === mucId).giai_doan, 'DA_DANG'); assert.ok(!r.j.db.cong_viec.some(v => v.doi_tuong_id === bd.id));
  // B9 AI → API Graph
  for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run('b9' + i, 'B9', thangNay + '-01', 1, new Date().toISOString()); await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.equal((await api('/buoc/B9', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' })).status, 200);
  r = await api('/bai-dang', 'POST', { noi_dung_id: ndId, kenh_id: k1, gio_dang: qua, cach: 'API' }, tMkt); const bd2 = r.j.id;
  r = await api('/may/chay-thu', 'POST', { agent: 'DANG_BAI' }); assert.match(r.j.kq[0].tom_tat, /đăng 1/); const b2 = r.j.db.bai_dang.find(b => b.id === bd2); assert.equal(b2.trang_thai, 'DA_DANG'); assert.equal(b2.link, 'https://www.facebook.com/123_456'); assert.ok(calls.some(u => u.includes('/999/feed')));
  FB_OK = false; r = await api('/bai-dang', 'POST', { noi_dung_id: ndId, kenh_id: k1, gio_dang: qua, cach: 'API' }, tMkt); const bd3 = r.j.id; r = await api('/may/chay-thu', 'POST', { agent: 'DANG_BAI' }); assert.equal(r.j.db.bai_dang.find(b => b.id === bd3).trang_thai, 'LOI'); FB_OK = true;
  r = await api('/bai-dang/' + bd3 + '/dang-ngay', 'POST', null, tMkt); assert.equal(r.j.ok, true); assert.equal(r.j.db.bai_dang.find(b => b.id === bd3).trang_thai, 'DA_DANG');
  // n8n: gửi và callback
  r = await api('/bai-dang', 'POST', { noi_dung_id: ndId, kenh_id: k1, gio_dang: qua, cach: 'N8N' }, tMkt); const bd4 = r.j.id; r = await api('/bai-dang/' + bd4 + '/dang-ngay', 'POST', null, tMkt); assert.equal(r.j.cho_callback, true);
  const cb = await worker.fetch(new Request('https://x/api/bai-dang/' + bd4 + '/n8n-callback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Token': 'n8' }, body: JSON.stringify({ ok: true, link: 'https://tiktok.com/v/1' }) }), env, { waitUntil() {} }); assert.equal(cb.status, 200);
  assert.equal(DB.raw.prepare(`SELECT trang_thai FROM bai_dang WHERE id=?`).get(bd4).trang_thai, 'DA_DANG');
  await api('/buoc/B9', 'PATCH', { nguoi_thuc_hien: 'NGUOI' });
});
test('B4 agent: NGƯỜI → bỏ qua; AI_GOI_Y → soạn nháp cho mục Y_TUONG tuần này/sau; AI_TU_LAM → gửi duyệt luôn; học bản nháp bóng → mẫu B4', async () => {
  const tuan = (() => { const d = new Date(Date.now() + 7 * 36e5); const lech = (new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).getUTCDay() + 6) % 7; return Math.min(6, Math.floor((d.getUTCDate() - 1 + lech) / 7) + 1); })();
  const m = (await api('/muc', 'POST', { tieu_de: 'Máy soạn giúp', thang: thangNay, tuan, pillar_id: p1, kenh_id: k1, dinh_dang: 'CAROUSEL' }, tMkt)).j.id;
  await api('/muc', 'POST', { tieu_de: 'Chưa định dạng', thang: thangNay, tuan, pillar_id: p1 }, tMkt);
  let r = await api('/may/chay-thu', 'POST', { agent: 'SOAN_NHAP' }); assert.match(r.j.kq[0].bo_qua || '', /NGƯỜI/);
  await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' });
  AI_TEXT = '{"tieu_de":"5 lỗi thi công ron","hook":"Slide bìa: 5 lỗi","sections":[{"label":"Slide 2","text":"Lỗi 1","hinh":"ảnh"},{"label":"Slide 3","text":"Lỗi 2","hinh":"ảnh"},{"label":"Slide 4","text":"Lỗi 3","hinh":"ảnh"}],"cta":"Lưu lại","caption":"cap","hashtag":"#k"}';
  r = await api('/may/chay-thu', 'POST', { agent: 'SOAN_NHAP' }); assert.equal(r.j.kq[0].ok, true, JSON.stringify(r.j.kq[0])); assert.match(r.j.kq[0].tom_tat, /Soạn 1\/1/);
  const nd = r.j.db.noi_dung.find(n => n.muc_id === m); assert.ok(nd); assert.equal(nd.tao_boi, 'AGENT'); assert.equal(nd.trang_thai, 'NHAP'); assert.equal(nd.dinh_dang, 'CAROUSEL'); assert.equal(r.j.db.muc_noi_dung.find(x => x.id === m).giai_doan, 'SOAN');
  r = await api('/may/chay-thu', 'POST', { agent: 'SOAN_NHAP' }); assert.match(r.j.kq[0].bo_qua || '', /Không có mục/, 'không soạn lại mục đã có nội dung');
  // AI_TU_LAM: gửi duyệt luôn (vẫn chờ người G3)
  for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run('b4' + i, 'B4', thangNay + '-01', 0.95, new Date().toISOString()); await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.equal((await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' })).status, 200);
  const m3 = (await api('/muc', 'POST', { tieu_de: 'Máy tự làm', thang: thangNay, tuan, pillar_id: p1, kenh_id: k1, dinh_dang: 'POST' }, tMkt)).j.id;
  AI_TEXT = '{"tieu_de":"Tự làm","hook":"Hook","sections":[{"label":"1","text":"x"}],"cta":"Inbox","hashtag":"#k"}';
  r = await api('/may/chay-thu', 'POST', { agent: 'SOAN_NHAP' }); assert.match(r.j.kq[0].tom_tat, /gửi duyệt 1/); const nd3 = r.j.db.noi_dung.find(n => n.muc_id === m3); assert.equal(nd3.trang_thai, 'CHO_DUYET'); assert.equal(r.j.db.muc_noi_dung.find(x => x.id === m3).giai_doan, 'CHO_DUYET');
  assert.ok(r.j.db.duyet.some(d => d.doi_tuong_id === nd3.id && d.trang_thai === 'CHO'), 'vẫn chờ người duyệt — máy không tự duyệt');
  // học bản nháp bóng cho bài NGƯỜI đã gửi duyệt
  DB.raw.prepare(`DELETE FROM mau_hoc WHERE buoc='B4'`).run(); AI_TEXT = '{"tieu_de":"Bài 1","hook":"Sau mùa mưa, ron nhà bạn ngả vàng?","sections":[{"label":"Đoạn 1","text":"G7000 giữ màu 30 năm."}],"cta":"Inbox nhận bảng màu","hashtag":"#kingsmen"}';
  r = await api('/may/chay-thu', 'POST', { agent: 'HOC_SOAN_NHAP' }); assert.equal(r.j.kq[0].ok, true, JSON.stringify(r.j.kq[0])); const mh = DB.raw.prepare(`SELECT * FROM mau_hoc WHERE buoc='B4'`).all(); assert.ok(mh.length >= 1); const mhBai1 = mh.find(x => x.doi_tuong_id === ndId); assert.ok(mhBai1 && mhBai1.giong > 0.5, 'bài 1 giống cao vì máy viết gần y hệt: ' + JSON.stringify(mh.map(x => [x.doi_tuong_id === ndId, x.giong])));
  assert.ok(DB.raw.prepare(`SELECT COUNT(*) n FROM ai_usage WHERE tinh_nang='hoc_ban_bong'`).get().n >= 1, 'chi phí học ghi riêng');
  r = await api('/may/chay-thu', 'POST', { agent: 'HOC_SOAN_NHAP' }); assert.match(r.j.kq[0].bo_qua || '', /Không có bài mới/, 'không học lại bài đã có mẫu');
});
test('ngân sách học: vượt phần học → bản nháp bóng dừng, soạn thật vẫn chạy', async () => {
  await api('/cau-hinh/ai', 'PUT', { cau_hinh: { ngan_sach_thang_usd: 100, ngan_sach_hoc_pct: 1 } });
  DB.raw.prepare(`INSERT INTO ai_usage (id,at,thang,provider,model,tinh_nang,tokens_vao,tokens_ra,chi_phi_usd,ok) VALUES ('big',?,?,'anthropic','x','hoc_ban_bong',0,0,5,1)`).run(new Date().toISOString(), thangNay);
  const ndN = (await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'POST', tieu_de: 'Bài mới', hook: 'Hook', sections: [{ label: '1', text: 'x' }], cta: 'CTA' }, tMkt2)).j.id; await api('/noi-dung/' + ndN + '/gui-duyet', 'POST', null, tMkt2);
  const r = await api('/may/chay-thu', 'POST', { agent: 'HOC_SOAN_NHAP' }); assert.equal(r.j.kq[0].ok, false); assert.match(r.j.kq[0].tom_tat, /ngân sách học/);
  const r2 = await api('/noi-dung/ai-viet', 'POST', { muc_id: mucId }, tMkt); assert.equal(r2.j.ok, true, 'soạn thật vẫn chạy (5/100 USD)');
});
