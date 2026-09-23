// ADR-009 — bộ não AI: danh mục mô hình + định tuyến nhiều nhà cung cấp (dự phòng khi thiếu khoá/lỗi), kho mẫu, bóng trên máy ghép,
// mẫu chọn cảnh từ máy dựng + người chấm, huấn luyện đầu nhìn (tập mẫu, phiên bản CHỜ DUYỆT → duyệt), chấm điểm & đề nghị mức, luật gạt MỞ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let AI_TEXT = 'Ron sạch, không ố. Kingsmen.'; let ANTHROPIC_OK = true; const calls = [];
globalThis.fetch = async (url, opt) => { const u = String(url); calls.push(u);
  if (u.includes('api.anthropic.com')) return ANTHROPIC_OK ? new Response(JSON.stringify({ content: [{ type: 'text', text: AI_TEXT }], usage: { input_tokens: 1000, output_tokens: 200 } }), { status: 200 }) : new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 529 });
  if (u.includes('generativelanguage.googleapis.com')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'GEMINI: ' + AI_TEXT }] } }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 150 } }), { status: 200 });
  return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const SCRIPTS = Object.fromEntries(['dung-video', 'nhin', 'mo-hinh', 'huan-luyen'].map(t => [t, fs.readFileSync(new URL('../tools/may-dung/' + t + '.mjs', import.meta.url), 'utf8')]));
const DB = taoD1(); const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async (req) => { const p = new URL(req.url).pathname; const m = p.match(/^\/tools\/may-dung\/([a-z-]+)\.mjs$/); return m && SCRIPTS[m[1]] ? new Response(SCRIPTS[m[1]], { status: 200 }) : new Response('x', { status: 404 }); } } };
let TOKEN = null, KHOA_MAY = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const hub = (p, method = 'GET', body) => worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': KHOA_MAY }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }).then(async r => ({ status: r.status, j: await r.json().catch(() => null) }));
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7); const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
let tMkt, tTruong, mayId, ndId, mucId, tsA, tsB, mauCanh = [];
test('seed bộ não: 9 mô hình, 10 định tuyến mức API, cờ khoá', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt });
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token;
  const a = (await api('/bootstrap')).j.db.ai_nao; assert.equal(a.mo_hinh.length, 9); assert.equal(a.dinh_tuyen.length, 10); assert.ok(a.dinh_tuyen.every(d => d.muc === 'API'));
  assert.equal(a.mo_hinh.find(m => m.id === 'claude-sonnet-4-5').co_khoa, true); assert.equal(a.mo_hinh.find(m => m.id === 'gemini-2-5-flash').co_khoa, false); assert.equal(a.mo_hinh.find(m => m.id === 'clip-vit-b16').co_khoa, null);
  assert.equal(a.dinh_tuyen.find(d => d.tinh_nang === 'chon_canh').mo_hinh_mo, 'clip-vit-b16');
});
test('định tuyến: gọi AI ghi ai_usage theo mô hình + kho mẫu; chính thiếu khoá → dự phòng; có khoá Gemini → đi Gemini; Anthropic lỗi → dự phòng; MKT không định tuyến', async () => {
  const p1 = (await api('/danh-muc/pillars', 'POST', { ten: 'Problems', ty_trong: 100 })).j.id;
  let r = await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Ron mốc', pillar_id: p1 }, tMkt); assert.equal(r.status, 200); assert.equal(r.j.ok, false, 'JSON AI hỏng vì mock trả chữ thường — nhưng lượt gọi vẫn ghi');
  let u = DB.raw.prepare(`SELECT * FROM ai_usage WHERE tinh_nang='soan_noi_dung' ORDER BY at DESC LIMIT 1`).get(); assert.equal(u.mo_hinh_id, 'claude-sonnet-4-5'); assert.equal(u.muc, 'API'); assert.ok(Math.abs(u.chi_phi_usd - (1000 * 3 + 200 * 15) / 1e6) < 1e-9, 'giá theo mo_hinh');
  let m = DB.raw.prepare(`SELECT * FROM mau_hoc_ai WHERE tinh_nang='soan_noi_dung'`).all(); assert.equal(m.length, 1); assert.equal(m[0].mo_hinh_id, 'claude-sonnet-4-5'); assert.ok(['HOC', 'KIEM'].includes(m[0].tap));
  assert.equal((await api('/ai/dinh-tuyen/soan_noi_dung', 'PATCH', { mo_hinh_chinh: 'gemini-2-5-flash' }, tMkt)).status, 403);
  assert.equal((await api('/ai/dinh-tuyen/soan_noi_dung', 'PATCH', { mo_hinh_chinh: 'clip-vit-b16' }, tTruong)).status, 422, 'sai loại');
  r = await api('/ai/dinh-tuyen/soan_noi_dung', 'PATCH', { mo_hinh_chinh: 'gemini-2-5-flash' }, tTruong); assert.equal(r.status, 200);
  await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Ron mốc', pillar_id: p1 }, tMkt); u = DB.raw.prepare(`SELECT * FROM ai_usage WHERE tinh_nang='soan_noi_dung' ORDER BY at DESC LIMIT 1`).get(); assert.equal(u.mo_hinh_id, 'claude-haiku-4-5', 'Gemini thiếu khoá → dự phòng Haiku');
  env.GEMINI_API_KEY = 'g'; AI_TEXT = JSON.stringify({ tieu_de: 'Ron mốc', hook: 'Ron nhà bạn đen?', sections: [{ label: 'Đoạn 1', text: 'Kingsmen giữ ron sạch.' }], cta: 'Inbox', hashtag: '#kingsmen' });
  r = await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Ron mốc', pillar_id: p1 }, tMkt); assert.equal(r.j.ok, true, JSON.stringify(r.j)); assert.match(r.j.noi_dung.hook, /Ron nhà bạn/); u = DB.raw.prepare(`SELECT * FROM ai_usage WHERE tinh_nang='soan_noi_dung' ORDER BY at DESC LIMIT 1`).get(); assert.equal(u.mo_hinh_id, 'gemini-2-5-flash'); assert.equal(u.provider, 'google'); assert.equal(u.tokens_vao, 900);
  await api('/ai/dinh-tuyen/soan_noi_dung', 'PATCH', { mo_hinh_chinh: 'claude-sonnet-4-5', mo_hinh_du_phong: 'gemini-2-5-flash' }, tTruong); ANTHROPIC_OK = false;
  r = await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Ron mốc', pillar_id: p1 }, tMkt); assert.equal(r.j.ok, true); u = DB.raw.prepare(`SELECT mo_hinh_id, ok FROM ai_usage WHERE tinh_nang='soan_noi_dung' ORDER BY rowid DESC LIMIT 2`).all(); assert.equal(u[0].mo_hinh_id, 'gemini-2-5-flash'); assert.equal(u[1].ok, 0); ANTHROPIC_OK = true;
  // mô hình: Admin thêm/sửa/tắt, thử
  assert.equal((await api('/ai/mo-hinh', 'POST', { id: 'x', ten: 'x', model_id: 'x' }, tTruong)).status, 403);
  r = await api('/ai/mo-hinh', 'POST', { id: 'Claude Opus 4.1', ten: 'Claude Opus', nha_cung_cap: 'anthropic', loai: 'NGON_NGU', cach_goi: 'API', model_id: 'claude-opus-4-1', gia_vao: 15, gia_ra: 75 }); assert.equal(r.status, 200); assert.equal(r.j.id, 'claude-opus-4-1');
  r = await api('/ai/mo-hinh/claude-opus-4-1/thu', 'POST', {}, tTruong); assert.equal(r.j.ok, true); assert.ok(r.j.usd > 0); assert.equal(DB.raw.prepare(`SELECT tinh_nang FROM ai_usage ORDER BY rowid DESC LIMIT 1`).get().tinh_nang, 'thu_mo_hinh');
  r = await api('/ai/mo-hinh/claude-opus-4-1', 'PATCH', { trang_thai: 'TAT', gia_vao: 10 }); const mo = r.j.db.ai_nao.mo_hinh.find(x => x.id === 'claude-opus-4-1'); assert.equal(mo.trang_thai, 'TAT'); assert.equal(mo.gia_vao, 10);
});
test('BÓNG ngôn ngữ: cần mô hình mở; bật BÓNG → lượt gọi xếp lệnh mo_hinh_bong cho máy ghép có mo_hinh; /hub/viec/bong → /hub/bong → giống mở; MỞ ngôn ngữ bị từ chối (009c)', async () => {
  assert.equal((await api('/ai/dinh-tuyen/seeding_thong_diep', 'PATCH', { muc: 'BONG' }, tTruong)).status, 422, 'chưa gán mô hình mở');
  assert.equal((await api('/ai/dinh-tuyen/soan_noi_dung', 'PATCH', { muc: 'MO' }, tTruong)).status, 422);
  let r = await api('/ai/dinh-tuyen/soan_noi_dung', 'PATCH', { muc: 'BONG' }, tTruong); assert.equal(r.status, 200); assert.equal(r.j.db.ai_nao.dinh_tuyen.find(d => d.tinh_nang === 'soan_noi_dung').muc, 'BONG');
  const p1 = (await api('/bootstrap')).j.db.pillars[0].id;
  await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Ron mốc', pillar_id: p1 }, tMkt); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM tram_lenh WHERE viec='mo_hinh_bong'`).get().n, 0, 'chưa có máy mo_hinh → không xếp lệnh');
  r = await api('/may-ghep', 'POST', { ten: 'PC Ngọc' }, tMkt); mayId = r.j.id; KHOA_MAY = giai(r.j.ma_ghep).khoa; let h = await hub('/hub/trang_thai', 'POST', { may: 'PC-NGOC', ban: '1.1', ffmpeg: true, kha_nang: ['mo_hinh'], ollama: true }); assert.deepEqual(h.j.kha_nang, ['dung_video', 'mo_hinh']);
  await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Ron mốc', pillar_id: p1 }, tMkt); const l = DB.raw.prepare(`SELECT * FROM tram_lenh WHERE viec='mo_hinh_bong'`).all(); assert.equal(l.length, 1); assert.equal(l[0].may_id, mayId);
  h = await hub('/hub/lenh'); assert.ok(h.j.lenh.some(x => x.viec === 'mo_hinh_bong'));
  h = await hub('/hub/viec/bong'); assert.ok(h.j.viec.length >= 2); const v = h.j.viec[0]; const v2 = h.j.viec[1]; assert.equal(v.tinh_nang, 'soan_noi_dung'); assert.equal(v.mo_hinh.model_id, 'qwen2.5:7b'); assert.ok(v.dau_vao.system && v.dau_vao.user);
  h = await hub('/hub/bong', 'POST', { dong: [{ mau_id: v.mau_id, dau_ra_mo: AI_TEXT, mo_hinh_id: 'qwen2-5-7b', model_id: 'qwen2.5:7b', tokens_vao: 800, tokens_ra: 100, ms: 4000 }, { mau_id: v2.mau_id, dau_ra_mo: '', mo_hinh_id: 'qwen2-5-7b', loi: 'timeout' }] }); assert.equal(h.j.cap, 2);
  const m = DB.raw.prepare(`SELECT * FROM mau_hoc_ai WHERE id=?`).get(v.mau_id); assert.equal(m.giong_mo, 1, 'giống hệt → 1'); assert.equal(DB.raw.prepare(`SELECT giong_mo FROM mau_hoc_ai WHERE id=?`).get(v2.mau_id).giong_mo, 0);
  const u = DB.raw.prepare(`SELECT * FROM ai_usage WHERE provider='may_ghep'`).all(); assert.equal(u.length, 2); assert.equal(u[0].chi_phi_usd, 0); assert.equal(u[0].muc, 'BONG');
  h = await hub('/hub/viec/bong'); assert.ok(!h.j.viec.some(x => x.mau_id === v.mau_id), 'đã có bóng thì không giao lại');
  assert.equal((await hub('/hub/script/nhin')).j.hash.length, 64); assert.equal((await hub('/hub/script/huan-luyen')).status, 200);
});
test('chọn cảnh: lô video có canh_chon → mẫu chon_canh (+ chi_tiet.canh_chon); người chấm ✓/✗ → nhãn; /hub/tap-mau', async () => {
  const p1 = (await api('/bootstrap')).j.db.pillars[0].id; const k = (await api('/danh-muc/kenh', 'POST', { ten: 'TikTok', loai: 'TIKTOK', cach_dang: 'TAY' })).j.id;
  mucId = (await api('/muc', 'POST', { tieu_de: 'Ron mốc', thang: thangNay, tuan: 1, pillar_id: p1, kenh_id: k, dinh_dang: 'VIDEO' }, tMkt)).j.id;
  ndId = (await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'VIDEO', tieu_de: 'Ron mốc', hook: 'Ron đen?', sections: [{ label: 'Cảnh 1', text: 'Ron cũ mốc đen.', hinh: 'cận cảnh ron mốc' }, { label: 'Cảnh 2', text: 'Thợ trét Kingsmen.', hinh: 'thợ trét keo' }], cta: 'Inbox' }, tMkt)).j.id;
  const g = await api('/noi-dung/' + ndId + '/gui-duyet', 'POST', null, tMkt); const d = g.j.db.duyet.find(x => x.doi_tuong_id === ndId && x.trang_thai === 'CHO'); await api('/duyet/' + d.id + '/quyet', 'POST', { quyet: 'DUYET' }, tTruong);
  tsA = (await api('/tai-san', 'POST', { ten: 'ron moc.mp4', mo_ta: 'cận cảnh ron mốc', media_url: '/media/media/a.mp4', media_type: 'VIDEO', loai: 'FOOTAGE', muc_id: mucId }, tMkt)).j.id; tsB = (await api('/tai-san', 'POST', { ten: 'tho tret.mp4', mo_ta: 'thợ trét keo', media_url: '/media/media/b.mp4', media_type: 'VIDEO', loai: 'FOOTAGE', muc_id: mucId }, tMkt)).j.id;
  const uv = [{ id: tsA, ten: 'ron moc.mp4', mo_ta: 'cận cảnh ron mốc', media_url: '/media/media/a.mp4', media_type: 'VIDEO', diem: 2 }, { id: tsB, ten: 'tho tret.mp4', mo_ta: 'thợ trét keo', media_url: '/media/media/b.mp4', media_type: 'VIDEO', diem: 0.5 }];
  const h = await hub('/hub/nap', 'POST', { viec: 'may_dung.dung_video', bang: 'content_os.video', luot: 'v1', dong: [{ noi_dung_id: ndId, media_url: '/media/media/nhap.mp4', may: 'PC-NGOC', canh_chon: [{ k: 0, label: 'Cảnh 1', hinh: 'cận cảnh ron mốc', text: 'Ron cũ mốc đen.', chon: tsA, chon_mo: tsA, cach: 'TU_KHOA', ung_vien: uv }, { k: 1, label: 'Cảnh 2', hinh: 'thợ trét keo', text: 'Thợ trét Kingsmen.', chon: tsA, chon_mo: tsB, cach: 'TU_KHOA', ung_vien: uv }] }] }); assert.equal(h.j.moi, 1);
  const b = (await api('/bootstrap', 'GET', null, tMkt)).j.db; const nd = b.noi_dung.find(x => x.id === ndId); const cc = JSON.parse(nd.chi_tiet.canh_chon); assert.equal(cc.length, 2); assert.ok(cc[0].mau_id); mauCanh = cc.map(c => c.mau_id);
  const ms = DB.raw.prepare(`SELECT * FROM mau_hoc_ai WHERE tinh_nang='chon_canh' ORDER BY rowid`).all(); assert.equal(ms.length, 2); assert.equal(JSON.parse(ms[1].dau_ra_mo).tai_san_id, tsB); assert.equal(ms[1].giong_mo, 0); assert.equal(ms[0].giong_mo, 1);
  assert.equal((await hub('/hub/tap-mau?tinh_nang=chon_canh')).j.mau.length, 0, 'chưa có nhãn');
  let r = await api('/ai/mau/' + mauCanh[0], 'PATCH', { phan_quyet: 'DUNG' }, tMkt); assert.equal(r.status, 200); r = await api('/ai/mau/' + mauCanh[1], 'PATCH', { phan_quyet: 'SAI', nhan: { tai_san_id: tsB } }, tMkt); assert.equal(r.status, 200);
  const m2 = DB.raw.prepare(`SELECT nhan, giong, cham_boi FROM mau_hoc_ai WHERE id=?`).get(mauCanh[1]); assert.equal(JSON.parse(m2.nhan).tai_san_id, tsB); assert.equal(m2.giong, 0); assert.equal(m2.cham_boi, 'Ngọc');
  const tm = await hub('/hub/tap-mau?tinh_nang=chon_canh'); assert.equal(tm.j.mau.length, 2); assert.equal(tm.j.mau[0].ung_vien[0].media_url, 'https://os.kingsmen.vn/media/media/a.mp4'); assert.ok(['HOC', 'KIEM'].includes(tm.j.mau[0].tap));
  assert.equal(r.j.db.ai_nao.mau_thong_ke.find(t => t.tinh_nang === 'chon_canh').da_cham, 2);
});
test('huấn luyện: thiếu mẫu 409; đủ mẫu nhưng không máy huan_luyen 409; máy khai huan_luyen → lệnh; máy gửi phiên bản → CHỜ DUYỆT + việc; Trưởng MKT duyệt → mô hình có checkpoint; /hub/mo-hinh/chon_canh', async () => {
  assert.equal((await api('/ai/huan-luyen', 'POST', { tinh_nang: 'chon_canh' }, tMkt)).status, 403);
  let r = await api('/ai/huan-luyen', 'POST', { tinh_nang: 'chon_canh' }, tTruong); assert.equal(r.status, 409); assert.match(r.j.error, /Cần ≥ 10 mẫu/);
  const now = new Date().toISOString(); for (let i = 0; i < 12; i++) DB.raw.prepare(`INSERT INTO mau_hoc_ai (id,tinh_nang,doi_tuong,doi_tuong_id,dau_vao,dau_ra,dau_ra_mo,mo_hinh_mo_id,giong_mo,nhan,tap,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run('mc' + i, 'chon_canh', 'noi_dung', ndId, JSON.stringify({ hinh: 'x', text: 'y', ung_vien: [{ id: tsA, media_url: '/media/media/a.mp4', media_type: 'VIDEO' }, { id: tsB, media_url: '/media/media/b.mp4', media_type: 'VIDEO' }] }), JSON.stringify({ tai_san_id: tsA }), JSON.stringify({ tai_san_id: i < 10 ? tsA : tsB }), 'clip-vit-b16', i < 10 ? 1 : 0, JSON.stringify({ tai_san_id: tsA }), i % 5 === 0 ? 'KIEM' : 'HOC', now);
  r = await api('/ai/huan-luyen', 'POST', { tinh_nang: 'chon_canh' }, tTruong); assert.equal(r.status, 409); assert.match(r.j.error, /máy huấn luyện/);
  await hub('/hub/trang_thai', 'POST', { may: 'PC-NGOC', ban: '1.1', kha_nang: ['mo_hinh', 'huan_luyen'], gpu: 'RTX 4090' });
  r = await api('/ai/huan-luyen', 'POST', { tinh_nang: 'chon_canh' }, tTruong); assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.so_mau, 14); const l = r.j.db.ai_nao.lenh_hoc.find(x => x.viec === 'huan_luyen'); assert.equal(l.may_id, mayId); assert.equal(l.tham_so.mo_hinh_id, 'clip-vit-b16');
  let h = await hub('/hub/mo-hinh/chon_canh'); assert.equal(h.j.muc, 'API'); assert.equal(h.j.mo_hinh_mo.model_id, 'Xenova/clip-vit-base-patch16'); assert.equal(h.j.mo_hinh_mo.checkpoint_url, null);
  h = await hub('/hub/mo-hinh/phien-ban', 'POST', { mo_hinh_id: 'clip-vit-b16', tinh_nang: 'chon_canh', checkpoint_url: '/media/media/dau1.json', may: 'PC-NGOC', danh_gia: { diem: 86, diem_truoc: 64, n_hoc: 11, n_kiem: 3 } }); assert.equal(h.status, 200); const pbId = h.j.id;
  let b = (await api('/bootstrap')).j.db; const pb = b.ai_nao.phien_ban.find(x => x.id === pbId); assert.equal(pb.trang_thai, 'CHO_DUYET'); assert.equal(pb.danh_gia.diem, 86); assert.ok(b.cong_viec.some(v => v.loai === 'DUYET_MO_HINH' && v.doi_tuong_id === pbId && v.giao_cho_vai_tro === 'TRUONG_MKT'));
  assert.equal((await api('/ai/phien-ban/' + pbId + '/duyet', 'POST', {}, tMkt)).status, 403); assert.equal((await api('/ai/phien-ban/' + pbId + '/tu-choi', 'POST', {}, tTruong)).status, 400);
  r = await api('/ai/phien-ban/' + pbId + '/duyet', 'POST', {}, tTruong); assert.equal(r.status, 200); const mo = r.j.db.ai_nao.mo_hinh.find(x => x.id === 'clip-vit-b16'); assert.equal(mo.phien_ban, pb.phien_ban); assert.equal(mo.checkpoint_url, '/media/media/dau1.json'); assert.equal(mo.diem, 86); assert.ok(!r.j.db.cong_viec.some(v => v.loai === 'DUYET_MO_HINH' && v.trang_thai === 'MO'));
  h = await hub('/hub/mo-hinh/chon_canh'); assert.equal(h.j.mo_hinh_mo.checkpoint_url, 'https://os.kingsmen.vn/media/media/dau1.json');
});
test('chấm & đề nghị: agent TINH_DINH_TUYEN → điểm chon_canh = % mở chọn đúng nhãn; đủ ngưỡng → đề nghị LÊN + việc; gạt BÓNG → việc xong, đề nghị MỞ; gạt MỞ (nhìn) OK; thiếu điểm → 422', async () => {
  let r = await api('/may/chay-thu', 'POST', { agent: 'TINH_DINH_TUYEN' }); const d = r.j.db.ai_nao.dinh_tuyen.find(x => x.tinh_nang === 'chon_canh'); assert.equal(d.so_mau, 14); assert.equal(d.diem, Math.round(12 / 14 * 100), 'mở đúng 12/14 mẫu có nhãn (10 giả + 2 thật đều khớp nhãn)'); assert.equal(d.de_nghi, null, 'chưa đủ 40 mẫu');
  assert.equal((await api('/ai/dinh-tuyen/chon_canh', 'PATCH', { muc: 'MO' }, tTruong)).status, 422, 'chưa đủ điều kiện');
  r = await api('/ai/dinh-tuyen/chon_canh', 'PATCH', { min_mau: 10, nguong: 70 }, tTruong); let d2 = r.j.db.ai_nao.dinh_tuyen.find(x => x.tinh_nang === 'chon_canh'); assert.equal(d2.de_nghi, 'LEN'); assert.match(d2.de_nghi_ly_do, /BÓNG/); assert.ok(r.j.db.cong_viec.some(v => v.loai === 'GAT_DINH_TUYEN' && v.doi_tuong_id === 'dinh_tuyen:chon_canh:LEN' && v.trang_thai === 'MO'));
  r = await api('/ai/dinh-tuyen/chon_canh', 'PATCH', { muc: 'BONG' }, tTruong); assert.equal(r.status, 200); d2 = r.j.db.ai_nao.dinh_tuyen.find(x => x.tinh_nang === 'chon_canh'); assert.equal(d2.muc, 'BONG'); assert.equal(d2.de_nghi, 'LEN'); assert.match(d2.de_nghi_ly_do, /MỞ/);
  assert.equal(r.j.db.cong_viec.filter(v => v.loai === 'GAT_DINH_TUYEN' && v.trang_thai === 'MO').length, 1, 'việc cũ xong, việc đề nghị MỞ mới');
  r = await api('/ai/dinh-tuyen/chon_canh', 'PATCH', { muc: 'MO' }, tTruong); assert.equal(r.status, 200); d2 = r.j.db.ai_nao.dinh_tuyen.find(x => x.tinh_nang === 'chon_canh'); assert.equal(d2.muc, 'MO'); assert.equal(d2.de_nghi, null); assert.equal(r.j.db.cong_viec.filter(v => v.loai === 'GAT_DINH_TUYEN' && v.trang_thai === 'MO').length, 0);
  const h = await hub('/hub/mo-hinh/chon_canh'); assert.equal(h.j.muc, 'MO');
  // chi phí theo mô hình có dòng máy ghép 0 đ
  const cp = r.j.db.ai_nao.chi_phi; assert.ok(cp.some(x => x.provider === 'may_ghep' && x.usd === 0)); assert.ok(cp.some(x => x.mo_hinh === 'claude-sonnet-4-5' && x.usd > 0));
});
