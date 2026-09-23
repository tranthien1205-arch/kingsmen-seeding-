// ADR-005 — đo lường (Graph/YouTube giả lập + số Trạm), 3 mức tin cậy, nhập/đối soát, báo cáo (luật & AI giả), đề xuất G4 + áp dụng, ingest n8n
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; const calls = []; let FB = { post_impressions: 1000, post_impressions_unique: 800, post_engaged_users: 80, post_clicks: 12 }; let AI_ON = false; let N8N = [];
globalThis.fetch = async (url, opt) => { const u = String(url); calls.push(u);
  if (u.includes('graph.facebook.com')) return new Response(JSON.stringify({ insights: { data: Object.entries(FB).map(([name, v]) => ({ name, values: [{ value: v }] })) }, likes: { summary: { total_count: 50 } }, comments: { summary: { total_count: 5 } }, shares: { count: 2 } }), { status: 200 });
  if (u.includes('googleapis.com/youtube')) return new Response(JSON.stringify({ items: [{ statistics: { viewCount: '500', likeCount: '20', commentCount: '5' } }] }), { status: 200 });
  if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"nhan_dinh":"AI: tuần tốt, video Problems dẫn đầu.","viec_can_lam":["Duyệt bài chờ","Đổi giờ đăng","Bổ sung thông số"]}' }], usage: { input_tokens: 800, output_tokens: 200 } }), { status: 200 });
  if (u.includes('n8n.local')) { N8N.push(JSON.parse(opt.body)); return new Response('{}', { status: 200 }); }
  return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, TOKEN_KM: 'tok', YOUTUBE_API_KEY: 'yt', N8N_TOKEN: 'n8', N8N_WEBHOOK_URL: 'https://n8n.local/hook', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null;
const api = async (p, method = 'GET', body, tok, hdr = {}) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}), ...hdr }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7); const hn = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
let tMkt, tTruong, tGD, p1, p2, kFB, kYT, bdFB, bdYT, mucFB;
const taoBai = async (muc, kenh, link) => { const nd = (await api('/noi-dung', 'POST', { muc_id: muc, dinh_dang: 'POST', tieu_de: 'B', hook: 'Hook', sections: [{ label: '1', text: 'x' }], cta: 'CTA' }, tMkt)).j.id; const g = await api('/noi-dung/' + nd + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === nd && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong); const r = await api('/bai-dang', 'POST', { noi_dung_id: nd, kenh_id: kenh, cach: 'TAY' }, tMkt); await api('/bai-dang/' + r.j.id, 'PATCH', { da_dang: true, link }, tMkt); return r.j.id; };
test('chuẩn bị', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT'], ['Sếp', 'gd@k.vn', 'GIAM_DOC']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt });
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token; tGD = (await dangNhap('gd@k.vn', '123456')).token;
  p1 = (await api('/danh-muc/pillars', 'POST', { ten: 'Branding', ty_trong: 60, muc_tieu: 'BRAND' })).j.id; p2 = (await api('/danh-muc/pillars', 'POST', { ten: 'Problems', ty_trong: 40, muc_tieu: 'BAN_HANG' })).j.id;
  kFB = (await api('/danh-muc/kenh', 'POST', { ten: 'Fanpage', loai: 'FANPAGE', api_ma: 'KM', api_object_id: '999' })).j.id; kYT = (await api('/danh-muc/kenh', 'POST', { ten: 'YouTube', loai: 'YOUTUBE' })).j.id;
  mucFB = (await api('/muc', 'POST', { tieu_de: 'Bài FB', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: kFB, dinh_dang: 'POST' }, tMkt)).j.id; const mucYT = (await api('/muc', 'POST', { tieu_de: 'Video YT', thang: thangNay, tuan: 1, pillar_id: p2, kenh_id: kYT, dinh_dang: 'POST' }, tMkt)).j.id;
  bdFB = await taoBai(mucFB, kFB, 'https://www.facebook.com/kingsmen/posts/12345'); bdYT = await taoBai(mucYT, kYT, 'https://youtu.be/abcDEF12345');
});
test('đo lường: Graph (page_id_post) + YouTube → ket_qua KHÔNG QUY ĐƠN nguồn API_KENH, mục → DA_DO; đo lại cùng ngày 1 dòng; ngày sau ghi phần tăng', async () => {
  let r = await api('/may/chay-thu', 'POST', { agent: 'DO_LUONG' }); assert.match(r.j.kq[0].tom_tat, /Đo 2 bài qua API/); assert.ok(calls.some(u => u.includes('/999_12345?')));
  let b = (await api('/bootstrap')).j.db; const k1 = b.ket_qua.find(k => k.bai_dang_id === bdFB); assert.equal(k1.muc_tin_cay, 'KHONG_QUY_DON'); assert.equal(k1.nguon, 'API_KENH'); assert.equal(k1.luot_xem, 1000); assert.equal(k1.tiep_can, 800); assert.equal(k1.tuong_tac, 80); assert.equal(k1.chia_se, 2); assert.equal(k1.so_don, 0); assert.equal(b.muc_noi_dung.find(m => m.id === mucFB).giai_doan, 'DA_DO');
  const k2 = b.ket_qua.find(k => k.bai_dang_id === bdYT); assert.equal(k2.luot_xem, 500); assert.equal(k2.tuong_tac, 25);
  FB = { ...FB, post_impressions: 1300 }; r = await api('/may/chay-thu', 'POST', { agent: 'DO_LUONG' }); b = (await api('/bootstrap')).j.db; const rows = b.ket_qua.filter(k => k.bai_dang_id === bdFB && k.nguon === 'API_KENH'); assert.equal(rows.length, 1); assert.equal(rows[0].luot_xem, 1300, 'đo lại trong ngày thay dòng');
  const homQua = new Date(Date.now() - 864e5 + 7 * 36e5).toISOString().slice(0, 10); DB.raw.prepare(`UPDATE ket_qua SET ky=? WHERE id=?`).run(homQua, rows[0].id);
  FB = { ...FB, post_impressions: 1500 }; await api('/may/chay-thu', 'POST', { agent: 'DO_LUONG' }); b = (await api('/bootstrap')).j.db; const nay = b.ket_qua.find(k => k.bai_dang_id === bdFB && k.ky === hn); assert.equal(nay.luot_xem, 200, 'phần tăng 1500-1300'); assert.equal(nay.ghi_chu.tich_luy.luot_xem, 1500);
});
test('số Trạm (tram_lo content_os.ket_qua) → ket_qua nguồn TRAM, lô đánh dấu đã xử lý', async () => {
  DB.raw.prepare(`INSERT INTO tram_lo (id,viec,bang,luot,phan,so_dong,xu_ly,created_at) VALUES ('lo1','content_os.do_luong','content_os.ket_qua','l1','{}',1,?,?)`).run(JSON.stringify({ dong: [{ bai_dang_id: bdYT, ngay: hn, nen: 'TIKTOK', tich_luy: { luot_xem: 3000, tuong_tac: 100, chia_se: 9 } }] }), new Date().toISOString());
  const r = await api('/may/chay-thu', 'POST', { agent: 'DO_LUONG' }); assert.match(r.j.kq[0].tom_tat, /1 số từ Trạm/);
  const b = (await api('/bootstrap')).j.db; const k = b.ket_qua.find(x => x.bai_dang_id === bdYT && x.nguon === 'TRAM'); assert.ok(k); assert.equal(k.luot_xem, 3000); assert.equal(k.chia_se, 9);
  assert.equal(JSON.parse(DB.raw.prepare(`SELECT xu_ly FROM tram_lo WHERE id='lo1'`).get().xu_ly).da_xu_ly, true);
  await api('/may/chay-thu', 'POST', { agent: 'DO_LUONG' }); assert.equal((await api('/bootstrap')).j.db.ket_qua.filter(x => x.bai_dang_id === bdYT && x.nguon === 'TRAM').length, 1, 'không xử lý lại');
});
test('nhập tay & đối soát: KHÔNG QUY ĐƠN không được mang doanh thu; đối soát khớp mã theo dõi / link; không khớp trả về', async () => {
  let r = await api('/ket-qua', 'POST', { bai_dang_id: bdFB, muc_tin_cay: 'KHONG_QUY_DON', doanh_thu: 100 }, tMkt); assert.equal(r.status, 422);
  r = await api('/ket-qua', 'POST', { bai_dang_id: bdFB, muc_tin_cay: 'GIAN_TIEP', nguon: 'NHAP_TAY', so_don: 2, doanh_thu: 4000000, ky: hn }, tMkt); assert.equal(r.status, 200);
  await api('/bai-dang/' + bdYT + '/ma-theo-doi', 'POST', { ma_theo_doi: 'KM-G7000' }, tMkt);
  r = await api('/ket-qua/doi-soat', 'POST', { dong: [{ ma_theo_doi: 'KM-G7000', ky: thangNay, so_don: 7, doanh_thu: 18500000 }, { link: 'https://www.facebook.com/kingsmen/posts/12345', ky: thangNay, so_don: 1, doanh_thu: 300000 }, { ma_theo_doi: 'LA', so_don: 1 }], muc_tin_cay: 'TRUC_TIEP' }, tMkt);
  assert.equal(r.j.khop, 2); assert.equal(r.j.khong_khop.length, 1); assert.equal(r.j.khong_khop[0].ma_theo_doi, 'LA');
  const b = r.j.db; const tt = b.ket_qua.filter(k => k.muc_tin_cay === 'TRUC_TIEP'); assert.equal(tt.length, 2); assert.equal(tt.find(k => k.bai_dang_id === bdYT).doanh_thu, 18500000); assert.equal(tt.find(k => k.bai_dang_id === bdYT).nguon, 'SAN');
  assert.equal((await api('/ket-qua/' + tt[0].id, 'DELETE', null, tMkt)).status, 403);
});
test('ingest n8n: token, khớp link, ghi nguồn NGOAI', async () => {
  const r = await worker.fetch(new Request('https://x/api/ket-qua/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Token': 'n8' }, body: JSON.stringify({ items: [{ link: 'https://youtu.be/abcDEF12345', luot_xem: 9000, chia_se: 3, nen: 'TIKTOK' }, { link: 'https://khong' }] }) }), env, { waitUntil() {} }); const j = await r.json(); assert.equal(j.ghi, 1); assert.equal(j.loi.length, 1);
  assert.ok((await api('/bootstrap')).j.db.ket_qua.some(k => k.bai_dang_id === bdYT && k.nguon === 'NGOAI' && k.luot_xem === 9000));
  assert.equal((await worker.fetch(new Request('https://x/api/ket-qua/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), env, { waitUntil() {} })).status, 401);
});
test('báo cáo: B11 NGƯỜI → nhận định theo luật (không gọi AI); sửa; gửi (Trưởng MKT) → n8n + mẫu học B11; B11 AI → nhận định AI; AI_TU_LAM tự gửi', async () => {
  calls.length = 0; let r = await api('/bao-cao', 'POST', { loai: 'TUAN' }, tMkt); assert.equal(r.j.ok, true); assert.ok(!calls.some(u => u.includes('anthropic')), 'B11 NGƯỜI không gọi AI');
  let bc = r.j.db.bao_cao[0]; assert.equal(bc.loai, 'TUAN'); assert.match(bc.nhan_dinh, /Kỳ /); assert.equal(bc.trang_thai, 'NHAP'); assert.match(bc.tao_boi, /luật/);
  r = await api('/bao-cao', 'POST', { loai: 'THANG' }, tMkt); assert.equal(r.j.ok, true); assert.equal(r.j.db.bao_cao.length, 2);
  r = await api('/bao-cao/' + bc.id, 'PATCH', { nhan_dinh: 'Tuần này tốt.', viec_can_lam: ['Việc 1'] }, tMkt); assert.equal(r.j.db.bao_cao.find(b => b.id === bc.id).nhan_dinh, 'Tuần này tốt.');
  assert.equal((await api('/bao-cao/' + bc.id + '/gui', 'POST', null, tMkt)).status, 403);
  r = await api('/bao-cao/' + bc.id + '/gui', 'POST', null, tTruong); assert.equal(r.status, 200); assert.match(r.j.tom_tat, /app \+ n8n/); assert.equal(N8N[0].loai, 'BAO_CAO'); assert.equal(N8N[0].nhan_dinh, 'Tuần này tốt.'); assert.deepEqual(N8N[0].kenh, ['zalo', 'email']);
  bc = r.j.db.bao_cao.find(b => b.id === bc.id); assert.equal(bc.trang_thai, 'DA_GUI'); assert.deepEqual(bc.gui_qua, ['app', 'n8n']);
  const mh = DB.raw.prepare(`SELECT giong FROM mau_hoc WHERE buoc='B11'`).all(); assert.equal(mh.length, 1); assert.ok(mh[0].giong < 0.5, 'người viết lại hoàn toàn → giống thấp');
  // B11 AI_GOI_Y: có key → AI nhận định, để nháp
  env.ANTHROPIC_API_KEY = 'k'; await api('/buoc/B11', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' }); r = await api('/bao-cao', 'POST', { loai: 'TUAN' }, tMkt); const bcAI = r.j.db.bao_cao.find(b => b.loai === 'TUAN'); assert.match(bcAI.nhan_dinh, /^AI:/); assert.equal(bcAI.trang_thai, 'NHAP'); assert.equal(bcAI.viec_can_lam.length, 3);
  // AI_TU_LAM: tự gửi
  for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run('b11' + i, 'B11', hn, 1, new Date().toISOString()); await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.equal((await api('/buoc/B11', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' })).status, 200);
  N8N.length = 0; r = await api('/bao-cao', 'POST', { loai: 'TUAN' }, tMkt); assert.equal(r.j.db.bao_cao.find(b => b.loai === 'TUAN').trang_thai, 'DA_GUI'); assert.equal(N8N.length, 1);
  await api('/buoc/B11', 'PATCH', { nguoi_thuc_hien: 'NGUOI' }); delete env.ANTHROPIC_API_KEY;
});
test('đề xuất G4: không đủ mẫu → không đề xuất; đủ mẫu & lệch → đề xuất tỷ trọng pillar; GĐ duyệt → máy đổi ty_trong; bỏ phải có lý do; mẫu học B12', async () => {
  await api('/cau-hinh/hoc', 'PUT', { cau_hinh: { min_mau: 3 } });
  let r = await api('/may/chay-thu', 'POST', { agent: 'HOC_DE_XUAT' }); assert.match(r.j.kq[0].bo_qua || '', /NGƯỜI/);
  await api('/buoc/B12', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' }); r = await api('/may/chay-thu', 'POST', { agent: 'HOC_DE_XUAT' }); assert.match(r.j.kq[0].tom_tat, /Chưa đủ bằng chứng/);
  // dựng bằng chứng: pillar Problems 3 bài xem cao, Branding 3 bài xem thấp
  const them = async (pillar, xem) => { const m = (await api('/muc', 'POST', { tieu_de: 'x', thang: thangNay, tuan: 1, pillar_id: pillar, kenh_id: kFB, dinh_dang: 'POST' }, tMkt)).j.id; const bd = await taoBai(m, kFB, 'https://www.facebook.com/kingsmen/posts/' + Math.floor(Math.random() * 1e9)); DB.raw.prepare(`INSERT INTO ket_qua (id,bai_dang_id,muc_id,muc_tin_cay,nguon,ky,luot_xem,created_at) VALUES (?,?,?,'KHONG_QUY_DON','NHAP_TAY',?,?,?)`).run('kq' + Math.random(), bd, m, hn, xem, new Date().toISOString()); };
  for (let i = 0; i < 3; i++) { await them(p2, 5000); await them(p1, 500); }
  r = await api('/may/chay-thu', 'POST', { agent: 'HOC_DE_XUAT' }); assert.match(r.j.kq[0].tom_tat, /TY_TRONG_PILLAR/, r.j.kq[0].tom_tat);
  let b = (await api('/bootstrap')).j.db; const dx = b.de_xuat.find(d => d.loai === 'TY_TRONG_PILLAR'); assert.ok(dx); assert.equal(dx.noi_dung.tang, p2); assert.equal(dx.noi_dung.giam, p1); assert.match(dx.tieu_de, /Tăng pillar Problems 40% → 50%/); assert.ok(dx.bang_chung.Problems.bai >= 3);
  assert.equal((await api('/de-xuat/' + dx.id + '/quyet', 'POST', { quyet: 'DUYET' }, tMkt)).status, 403, 'Marketing không ở cổng G4');
  assert.equal((await api('/de-xuat/' + dx.id + '/quyet', 'POST', { quyet: 'BO' }, tGD)).status, 400, 'bỏ phải có lý do');
  r = await api('/de-xuat/' + dx.id + '/quyet', 'POST', { quyet: 'DUYET' }, tGD); assert.equal(r.status, 200); assert.equal(r.j.ap_dung.pillars, true);
  b = r.j.db; assert.equal(b.pillars.find(p => p.id === p2).ty_trong, 50); assert.equal(b.pillars.find(p => p.id === p1).ty_trong, 50); assert.equal(b.de_xuat.find(d => d.id === dx.id).trang_thai, 'DUYET');
  assert.equal(DB.raw.prepare(`SELECT giong FROM mau_hoc WHERE buoc='B12'`).get().giong, 1);
  r = await api('/may/chay-thu', 'POST', { agent: 'HOC_DE_XUAT' }); assert.match(r.j.kq[0].bo_qua || r.j.kq[0].tom_tat, /đã có đề xuất|Đề xuất/);
});
