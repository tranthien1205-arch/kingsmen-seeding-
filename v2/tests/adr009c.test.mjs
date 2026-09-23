// ADR-009c — hàng đợi AI mở (ngôn ngữ MỞ → máy ghép Ollama → app đi tiếp), máy trễ → API dự phòng, người bấm ✨ chờ máy, tiết kiệm,
// TTS mở chấm bóng, máy lọc footage (tài sản MÁY + mẫu + giữ/bỏ), tập mẫu ngôn ngữ + phiên bản Ollama (model_id) duyệt
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let AI_TEXT = JSON.stringify({ diem: 70, pillar_id: null, dinh_dang: 'POST', muc_tieu: 'BRAND', rui_ro_claim: false, ly_do: 'API chấm' });
globalThis.fetch = async (url, opt) => { const u = String(url); if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: AI_TEXT }], usage: { input_tokens: 500, output_tokens: 100 } }), { status: 200 }); return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const SCRIPTS = Object.fromEntries(['dung-video', 'nhin', 'mo-hinh', 'huan-luyen', 'piper', 'loc-footage', 'danh-gia-ngon-ngu'].map(t => [t, fs.readFileSync(new URL('../tools/may-dung/' + t + '.mjs', import.meta.url), 'utf8')]));
const DB = taoD1(); const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async (req) => { const m = new URL(req.url).pathname.match(/^\/tools\/may-dung\/([a-z-]+)\.mjs$/); return m && SCRIPTS[m[1]] ? new Response(SCRIPTS[m[1]], { status: 200 }) : new Response('x', { status: 404 }); } } };
let TOKEN = null, KHOA_MAY = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const hub = (p, method = 'GET', body) => worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': KHOA_MAY }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }).then(async r => ({ status: r.status, j: await r.json().catch(() => null) }));
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7); const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
let tMkt, tTruong, mayId, p1, kenh, ndId, mucId, tsA;
test('chuẩn bị: máy ghép có mo_hinh; chấm ý tưởng gạt MỞ (được phép vì có bước đi tiếp); tính năng không hỗ trợ → 422', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt });
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token;
  p1 = (await api('/danh-muc/pillars', 'POST', { ten: 'Problems', ty_trong: 100 })).j.id; kenh = (await api('/danh-muc/kenh', 'POST', { ten: 'FB', loai: 'FANPAGE', cach_dang: 'TAY' })).j.id;
  const r0 = await api('/may-ghep', 'POST', { ten: 'PC Ngọc' }, tMkt); mayId = r0.j.id; KHOA_MAY = giai(r0.j.ma_ghep).khoa; await hub('/hub/trang_thai', 'POST', { may: 'PC-NGOC', ban: '1.1', kha_nang: ['mo_hinh', 'huan_luyen'], ollama: true });
  // đủ điều kiện MỞ: 1 mẫu giống 1, min_mau 1, ngưỡng 50
  DB.raw.prepare(`INSERT INTO mau_hoc_ai (id,tinh_nang,dau_vao,dau_ra,dau_ra_mo,mo_hinh_mo_id,giong_mo,tap,created_at) VALUES ('m1','cham_y_tuong','{}','"a"','"a"','qwen2-5-7b',1,'HOC',?)`).run(new Date().toISOString());
  let r = await api('/ai/dinh-tuyen/cham_y_tuong', 'PATCH', { min_mau: 1, nguong: 50 }, tTruong); assert.equal(r.status, 200); await api('/may/chay-thu', 'POST', { agent: 'TINH_DINH_TUYEN' });
  r = await api('/ai/dinh-tuyen/cham_y_tuong', 'PATCH', { muc: 'MO' }, tTruong); assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.db.ai_nao.dinh_tuyen.find(d => d.tinh_nang === 'cham_y_tuong').muc, 'MO'); assert.deepEqual(r.j.db.ai_nao.mo_ho_tro, ['soan_noi_dung', 'soan_nhap_agent', 'cham_y_tuong', 'bao_cao']);
  DB.raw.prepare(`INSERT INTO mau_hoc_ai (id,tinh_nang,dau_vao,dau_ra,dau_ra_mo,mo_hinh_mo_id,giong_mo,tap,created_at) VALUES ('m2','seeding_bien_the','{}','"a"','"a"','qwen2-5-7b',1,'HOC',?)`).run(new Date().toISOString());
  await api('/ai/dinh-tuyen/seeding_bien_the', 'PATCH', { min_mau: 1, nguong: 50 }, tTruong); await api('/may/chay-thu', 'POST', { agent: 'TINH_DINH_TUYEN' }); r = await api('/ai/dinh-tuyen/seeding_bien_the', 'PATCH', { muc: 'MO' }, tTruong); assert.equal(r.status, 422); assert.match(r.j.error, /chưa có bước đi tiếp/);
});
test('chấm ý tưởng MỞ: thêm ý tưởng → không gọi API, tạo ai_viec + lệnh mo_hinh_chay; máy lấy /hub/viec/ai (ĐANG) → /hub/ai-xong → ý tưởng có điểm, ai_usage MỞ 0 đ, mẫu kho', async () => {
  const truoc = DB.raw.prepare(`SELECT COUNT(*) n FROM ai_usage`).get().n;
  let r = await api('/y-tuong', 'POST', { ten: 'Ron mốc mùa mưa', mo_ta: 'thợ than phiền' }, tMkt); assert.equal(r.status, 200); const yt = r.j.db.y_tuong.find(x => x.ten === 'Ron mốc mùa mưa'); assert.equal(yt.diem_may, null, 'chưa chấm — chờ máy');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM ai_usage`).get().n, truoc, 'không gọi API');
  const v = DB.raw.prepare(`SELECT * FROM ai_viec`).all(); assert.equal(v.length, 1); assert.equal(v[0].tinh_nang, 'cham_y_tuong'); assert.equal(v[0].trang_thai, 'CHO'); assert.equal(v[0].may_id, mayId); assert.equal(JSON.parse(v[0].ngu_canh).y_tuong_id, yt.id);
  let h = await hub('/hub/lenh'); assert.ok(h.j.lenh.some(l => l.viec === 'mo_hinh_chay'));
  h = await hub('/hub/viec/ai'); assert.equal(h.j.viec.length, 1); const job = h.j.viec[0]; assert.equal(job.mo_hinh.model_id, 'qwen2.5:7b'); assert.ok(job.dau_vao.system && job.dau_vao.messages.length === 1); assert.equal(DB.raw.prepare(`SELECT trang_thai FROM ai_viec WHERE id=?`).get(job.id).trang_thai, 'DANG');
  h = await hub('/hub/viec/ai'); assert.equal(h.j.viec.length, 0, 'đã giao rồi không giao lại');
  h = await hub('/hub/ai-xong', 'POST', { dong: [{ id: job.id, dau_ra: JSON.stringify({ diem: 88, pillar_id: p1, dinh_dang: 'VIDEO', muc_tieu: 'BRAND', rui_ro_claim: false, ly_do: 'Mô hình mở chấm' }), model_id: 'qwen2.5:7b', tokens_vao: 400, tokens_ra: 60, ms: 3000 }] }); assert.equal(h.status, 200); assert.equal(h.j.cap, 1); assert.equal(h.j.kq[0].ok, true);
  const b = (await api('/bootstrap')).j.db; const yt2 = b.y_tuong.find(x => x.id === yt.id); assert.equal(yt2.diem_may, 88); assert.equal(yt2.pillar_id, p1); assert.equal(yt2.dinh_dang, 'VIDEO'); assert.match(yt2.ly_do_may, /mở/);
  const u = DB.raw.prepare(`SELECT * FROM ai_usage ORDER BY rowid DESC LIMIT 1`).get(); assert.equal(u.provider, 'may_ghep'); assert.equal(u.muc, 'MO'); assert.equal(u.chi_phi_usd, 0); assert.equal(u.tinh_nang, 'cham_y_tuong');
  const m = DB.raw.prepare(`SELECT * FROM mau_hoc_ai WHERE tinh_nang='cham_y_tuong' AND doi_tuong_id=?`).get(yt.id); assert.ok(m); assert.equal(m.mo_hinh_id, 'qwen2-5-7b');
  assert.equal(b.ai_nao.ai_viec[0].trang_thai, 'XONG'); assert.ok(b.ai_nao.tiet_kiem.usd > 0, 'tiết kiệm tính theo giá Haiku'); assert.equal(b.ai_nao.tiet_kiem.luot, 1);
});
test('máy trễ: việc CHO quá cho_may_phut → agent NHAN_AI_MO gọi API dự phòng làm thay, ý tưởng vẫn được chấm, mẫu ghi mở trễ', async () => {
  let r = await api('/y-tuong', 'POST', { ten: 'Keo ron chống thấm', mo_ta: 'x' }, tMkt); const yt = r.j.db.y_tuong.find(x => x.ten === 'Keo ron chống thấm'); const v = DB.raw.prepare(`SELECT * FROM ai_viec WHERE trang_thai='CHO'`).get(); assert.ok(v);
  r = await api('/may/chay-thu', 'POST', { agent: 'NHAN_AI_MO' }); assert.match(r.j.kq[0].bo_qua || '', /Không có/, 'chưa quá hạn');
  DB.raw.prepare(`UPDATE ai_viec SET created_at=? WHERE id=?`).run(new Date(Date.now() - 20 * 60000).toISOString(), v.id);
  r = await api('/may/chay-thu', 'POST', { agent: 'NHAN_AI_MO' }); assert.match(r.j.kq[0].tom_tat, /1 việc máy trễ → API dự phòng/);
  const v2 = DB.raw.prepare(`SELECT * FROM ai_viec WHERE id=?`).get(v.id); assert.equal(v2.trang_thai, 'HET_HAN'); assert.equal(v2.xu_ly, 1); assert.equal(r.j.db.y_tuong.find(x => x.id === yt.id).diem_may, 70, 'API chấm 70');
  const u = DB.raw.prepare(`SELECT provider, muc, mo_hinh_id FROM ai_usage ORDER BY rowid DESC LIMIT 1`).get(); assert.equal(u.provider, 'anthropic'); assert.equal(u.mo_hinh_id, 'claude-haiku-4-5');
  const m = DB.raw.prepare(`SELECT giong_mo, dau_ra_mo FROM mau_hoc_ai WHERE tinh_nang='cham_y_tuong' ORDER BY rowid DESC LIMIT 1`).get(); assert.equal(m.giong_mo, 0); assert.match(m.dau_ra_mo, /mở trễ/);
});
test('người bấm ✨ ở MỞ: ai-viet trả cho_may + viec_id; /ai/viec/:id CHO → máy trả → XONG có noi_dung đã qua guardrail; soạn nháp agent chờ máy rồi tạo nội dung', async () => {
  for (const tn of ['soan_noi_dung', 'soan_nhap_agent']) { DB.raw.prepare(`INSERT INTO mau_hoc_ai (id,tinh_nang,dau_vao,dau_ra,dau_ra_mo,mo_hinh_mo_id,giong_mo,tap,created_at) VALUES (?,?,'{}','"a"','"a"','qwen2-5-7b',1,'HOC',?)`).run('m_' + tn, tn, new Date().toISOString()); await api('/ai/dinh-tuyen/' + tn, 'PATCH', { min_mau: 1, nguong: 50 }, tTruong); }
  await api('/may/chay-thu', 'POST', { agent: 'TINH_DINH_TUYEN' }); for (const tn of ['soan_noi_dung', 'soan_nhap_agent']) assert.equal((await api('/ai/dinh-tuyen/' + tn, 'PATCH', { muc: 'MO' }, tTruong)).status, 200);
  let r = await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Ron mốc', pillar_id: p1 }, tMkt); assert.equal(r.j.ok, false); assert.equal(r.j.cho_may, true); assert.ok(r.j.viec_id);
  let g = await api('/ai/viec/' + r.j.viec_id, 'GET', null, tMkt); assert.equal(g.j.trang_thai, 'CHO'); assert.equal(g.j.noi_dung, null);
  let h = await hub('/hub/viec/ai'); const job = h.j.viec.find(x => x.id === r.j.viec_id); assert.ok(job);
  await hub('/hub/ai-xong', 'POST', { dong: [{ id: job.id, dau_ra: JSON.stringify({ tieu_de: 'Ron mốc', hook: 'Ron nhà bạn đen?', sections: [{ label: 'Đoạn 1', text: 'Kingsmen giữ ron sạch.' }], cta: 'Inbox', hashtag: '#kingsmen' }), model_id: 'qwen2.5:7b', tokens_vao: 900, tokens_ra: 200, ms: 5000 }] });
  g = await api('/ai/viec/' + r.j.viec_id, 'GET', null, tMkt); assert.equal(g.j.trang_thai, 'XONG'); assert.match(g.j.noi_dung.hook, /Ron nhà bạn/); assert.equal(g.j.noi_dung.dinh_dang, 'POST');
  // guardrail: máy trả cụm CHẶN → việc HONG-kết quả lỗi, không có nội dung
  await api('/danh-muc/claim_cam', 'POST', { cum_tu: 'tốt nhất thị trường', muc_do: 'CHAN' });
  r = await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Ron mốc', pillar_id: p1 }, tMkt); h = await hub('/hub/viec/ai'); const j2 = h.j.viec.find(x => x.id === r.j.viec_id);
  h = await hub('/hub/ai-xong', 'POST', { dong: [{ id: j2.id, dau_ra: JSON.stringify({ tieu_de: 'x', hook: 'Kingsmen tốt nhất thị trường', sections: [], cta: 'x' }), model_id: 'qwen2.5:7b' }] }); assert.equal(h.j.kq[0].ok, false); g = await api('/ai/viec/' + j2.id, 'GET', null, tMkt); assert.match(g.j.loi, /CHẶN/);
  // soạn nháp agent
  mucId = (await api('/muc', 'POST', { tieu_de: 'Bài ron mốc', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: kenh, dinh_dang: 'POST' }, tMkt)).j.id;
  for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run('b4' + i, 'B4', thangNay + '-01', 1, new Date().toISOString()); await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); assert.equal((await api('/buoc/B4', 'PATCH', { nguoi_thuc_hien: 'AI_GOI_Y' })).status, 200);
  r = await api('/may/chay-thu', 'POST', { agent: 'SOAN_NHAP' }); assert.match(r.j.kq[0].tom_tat, /1 chờ mô hình mở/); assert.equal(r.j.db.noi_dung.filter(n => n.muc_id === mucId).length, 0);
  r = await api('/may/chay-thu', 'POST', { agent: 'SOAN_NHAP' }); assert.match(r.j.kq[0].tom_tat, /1 chờ mô hình mở/, 'không xếp việc trùng'); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM ai_viec WHERE tinh_nang='soan_nhap_agent'`).get().n, 1);
  h = await hub('/hub/viec/ai'); const j3 = h.j.viec.find(x => x.tinh_nang === 'soan_nhap_agent'); await hub('/hub/ai-xong', 'POST', { dong: [{ id: j3.id, dau_ra: JSON.stringify({ tieu_de: 'Bài ron mốc', hook: 'Hook mở', sections: [{ label: '1', text: 'Kingsmen' }], cta: 'CTA', hashtag: '#k' }), model_id: 'qwen2.5:7b', tokens_vao: 800, tokens_ra: 300 }] });
  const b = (await api('/bootstrap')).j.db; const nd = b.noi_dung.find(n => n.muc_id === mucId); assert.ok(nd); assert.equal(nd.hook, 'Hook mở'); assert.match(nd.ly_do_may || '', /máy ghép/); assert.equal(b.muc_noi_dung.find(m => m.id === mucId).giai_doan, 'SOAN');
  assert.equal(b.ai_nao.tiet_kiem.luot, 4, '4 lượt mở: chấm ý tưởng, 2 lần ✨ (kể cả bị chặn), soạn nháp');
});
test('TTS mở chạy bóng: lô video có tts_mo → mẫu tts + chi_tiet; người chấm dùng được → giong_mo 1; đủ mẫu → tts đề nghị/gạt MỞ được', async () => {
  const vId = (await api('/muc', 'POST', { tieu_de: 'Clip', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: kenh, dinh_dang: 'VIDEO' }, tMkt)).j.id;
  ndId = (await api('/noi-dung', 'POST', { muc_id: vId, dinh_dang: 'VIDEO', tieu_de: 'Clip', hook: 'Ron đen?', sections: [{ label: 'Cảnh 1', text: 'Ron cũ mốc.', hinh: 'cận cảnh ron mốc' }, { label: 'Cảnh 2', text: 'Thợ trét.', hinh: 'thợ trét keo' }], cta: 'Inbox' }, tMkt)).j.id;
  const g = await api('/noi-dung/' + ndId + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === ndId && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong);
  tsA = (await api('/tai-san', 'POST', { ten: 'tho quay tho.mp4', mo_ta: 'quay thô công trình', media_url: '/media/media/a.mp4', media_type: 'VIDEO', loai: 'FOOTAGE', muc_id: vId }, tMkt)).j.id;
  let h = await hub('/hub/nap', 'POST', { viec: 'may_dung.dung_video', bang: 'content_os.video', luot: 'v1', dong: [{ noi_dung_id: ndId, media_url: '/media/media/nhap.mp4', may: 'PC-NGOC', tts_mo: { mau_url: '/media/media/piper.mp3', cau: 'Ron đen? Ron cũ mốc.', giong: 'vi_VN-vais1000-medium' } }] }); assert.equal(h.j.moi, 1);
  const b = (await api('/bootstrap', 'GET', null, tMkt)).j.db; const nd = b.noi_dung.find(x => x.id === ndId); assert.equal(nd.chi_tiet.tts_mo_url, '/media/media/piper.mp3'); assert.ok(nd.chi_tiet.tts_mo_mau_id);
  let r = await api('/ai/mau/' + nd.chi_tiet.tts_mo_mau_id, 'PATCH', { phan_quyet: 'DUNG' }, tMkt); assert.equal(r.status, 200); assert.equal(DB.raw.prepare(`SELECT giong_mo FROM mau_hoc_ai WHERE id=?`).get(nd.chi_tiet.tts_mo_mau_id).giong_mo, 1);
  await api('/ai/dinh-tuyen/tts', 'PATCH', { min_mau: 1, nguong: 50 }, tTruong); r = await api('/may/chay-thu', 'POST', { agent: 'TINH_DINH_TUYEN' }); const dt = r.j.db.ai_nao.dinh_tuyen.find(x => x.tinh_nang === 'tts'); assert.equal(dt.diem, 100); assert.equal(dt.de_nghi, 'LEN');
  r = await api('/ai/dinh-tuyen/tts', 'PATCH', { muc: 'MO' }, tTruong); assert.equal(r.status, 200); h = await hub('/hub/mo-hinh/tts'); assert.equal(h.j.muc, 'MO'); assert.equal(h.j.mo_hinh_mo.model_id, 'vi_VN-vais1000-medium');
});
test('máy lọc footage: POST /noi-dung/:id/loc → lệnh loc_footage; /hub/viec/loc_footage có footage thô + cảnh; lô loc_footage → tài sản MÁY + mẫu + việc; bỏ → gỡ tài sản; giữ → giong_mo 1; điểm loc_footage', async () => {
  let r = await api('/noi-dung/' + ndId + '/loc', 'POST', {}, tMkt); assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.so_footage, 1); assert.ok(r.j.db.tram.lenh.some(l => l.viec === 'loc_footage' && l.may_id === mayId));
  let h = await hub('/hub/viec/loc_footage?noi_dung_id=' + ndId); const v = h.j.viec[0]; assert.equal(v.footage.length, 1); assert.equal(v.footage[0].media_url, 'https://os.kingsmen.vn/media/media/a.mp4'); assert.equal(v.sections[0].hinh, 'cận cảnh ron mốc'); assert.equal(v.mo_hinh_mo.id, 'clip-vit-b16'); assert.equal(v.whisper, 'onnx-community/whisper-base');
  assert.equal((await hub('/hub/script/loc-footage')).status, 200); assert.equal((await hub('/hub/script/piper')).status, 200); assert.equal((await hub('/hub/script/danh-gia-ngon-ngu')).status, 200);
  h = await hub('/hub/nap', 'POST', { viec: 'may_dung.loc_footage', bang: 'content_os.loc_footage', luot: 'lf1', dong: [{ noi_dung_id: ndId, may: 'PC-NGOC', ghi_chu: 'có whisper · cos thuần', de_xuat: [{ k: 0, label: 'Cảnh 1', hinh: 'cận cảnh ron mốc', text: 'Ron cũ mốc.', tai_san_goc: tsA, tu: 3, den: 7, loi_noi: 'ron này đen hết rồi', diem: 0.81, media_url: '/media/media/cat1.mp4' }, { k: 1, label: 'Cảnh 2', hinh: 'thợ trét keo', tai_san_goc: tsA, tu: 20, den: 24, diem: 0.6, media_url: '/media/media/cat2.mp4' }] }] }); assert.equal(h.j.moi, 2);
  let b = (await api('/bootstrap', 'GET', null, tMkt)).j.db; const nd = b.noi_dung.find(x => x.id === ndId); const dx = JSON.parse(nd.chi_tiet.loc_de_xuat); assert.equal(dx.length, 2); assert.ok(dx[0].mau_id); const cat = b.tai_san.filter(t => t.nguon === 'MAY' && t.noi_dung_id === ndId); assert.equal(cat.length, 2); assert.match(cat[0].ten, /Cắt máy/); assert.match(cat.find(t => t.id === dx[0].tai_san_id).mo_ta, /nói: ron này/);
  assert.ok(b.cong_viec.some(c => c.loai === 'DUYET_LOC_FOOTAGE' && c.doi_tuong_id === ndId));
  h = await hub('/hub/viec/loc_footage?noi_dung_id=' + ndId); assert.equal(h.j.viec[0].footage.length, 1, 'tài sản máy cắt không được coi là footage thô');
  r = await api('/ai/mau/' + dx[1].mau_id, 'PATCH', { phan_quyet: 'SAI' }, tMkt); assert.equal(r.status, 200); assert.ok(!r.j.db.tai_san.some(t => t.id === dx[1].tai_san_id), 'bỏ → gỡ tài sản máy cắt');
  r = await api('/ai/mau/' + dx[0].mau_id, 'PATCH', { phan_quyet: 'DUNG' }, tMkt); assert.equal(DB.raw.prepare(`SELECT giong_mo, nhan FROM mau_hoc_ai WHERE id=?`).get(dx[0].mau_id).giong_mo, 1);
  r = await api('/may/chay-thu', 'POST', { agent: 'TINH_DINH_TUYEN' }); const dt = r.j.db.ai_nao.dinh_tuyen.find(x => x.tinh_nang === 'loc_footage'); assert.equal(dt.so_mau, 2); assert.equal(dt.diem, 50);
});
test('009c-4: /hub/tap-mau-ngon-ngu cặp (system,user,máy,người,quyết); phiên bản Ollama có model_id → duyệt → mo_hinh.model_id đổi', async () => {
  // bài máy soạn ở test trước (muc Bài ron mốc) được người duyệt → mẫu có bài người
  const nd = DB.raw.prepare(`SELECT * FROM noi_dung WHERE muc_id=?`).get(mucId); const g = await api('/noi-dung/' + nd.id + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === nd.id && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong);
  let h = await hub('/hub/tap-mau-ngon-ngu?tinh_nang=soan_nhap_agent'); assert.equal(h.status, 200); const m = h.j.mau.find(x => x.nguoi); assert.ok(m, JSON.stringify(h.j.mau).slice(0, 300)); assert.ok(m.system && m.user); assert.match(m.nguoi, /Hook mở/); assert.equal(m.quyet, 'DUYET');
  h = await hub('/hub/mo-hinh/phien-ban', 'POST', { mo_hinh_id: 'qwen2-5-7b', tinh_nang: 'soan_nhap_agent', model_id: 'kingsmen-qwen:v1', phien_ban: 'kingsmen-qwen:v1', may: 'GPU-THUE', danh_gia: { diem: 71, diem_truoc: 55, n_hoc: 40, n_kiem: 8 } }); assert.equal(h.status, 200);
  const r = await api('/ai/phien-ban/' + h.j.id + '/duyet', 'POST', {}, tTruong); assert.equal(r.status, 200); const mo = r.j.db.ai_nao.mo_hinh.find(x => x.id === 'qwen2-5-7b'); assert.equal(mo.model_id, 'kingsmen-qwen:v1'); assert.equal(mo.phien_ban, 'kingsmen-qwen:v1'); assert.ok(mo.diem >= 0, 'điểm chạy = điểm mẫu thực tế, không phải điểm phiên bản');
  const job = await hub('/hub/viec/ai'); // việc mới sẽ dùng model mới
  await api('/y-tuong', 'POST', { ten: 'Ý mới', mo_ta: 'x' }, tMkt); const j2 = await hub('/hub/viec/ai'); assert.equal(j2.j.viec[0].mo_hinh.model_id, 'kingsmen-qwen:v1');
});
