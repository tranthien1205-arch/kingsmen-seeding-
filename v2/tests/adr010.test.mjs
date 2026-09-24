// ADR-010 — máy học chọn & ghép source: (a) chỉnh ghép người → mẫu học + dựng lại theo bản người; (b) phân tích footage theo đoạn + cỡ cảnh;
// (c) tập mẫu chon_doan / ghep_canh cho máy huấn luyện; (d) kho video thành phẩm từ Drive / thư mục máy dựng / kênh TikTok, lượt xem đi theo mẫu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => { const u = String(url); if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"mo_ta":"tay bóp keo lên ron gạch","co_canh":"CAN"}' }], usage: { input_tokens: 500, output_tokens: 50 } }), { status: 200 }); return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ANTHROPIC_API_KEY: 'sk-ant-thu-nghiem', ASSETS: { fetch: async (req) => new Response('export default async function x(){}', { status: String(req.url).includes('khong-co') ? 404 : 200 }) }, MEDIA: { get: async () => ({ arrayBuffer: async () => new Uint8Array([255, 216, 255, 217]).buffer, httpMetadata: { contentType: 'image/jpeg' } }), put: async () => ({}) } };
let TOKEN = null, KHOA = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hub = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': KHOA }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
let mucId, ndId, ts = [];

test('chuẩn bị: kịch bản VIDEO đã duyệt + 3 footage; máy con khai dung_video', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const ma = (await api('/may-ghep', 'POST', { ten: 'Máy thử 010' })).j; KHOA = giai(ma.ma_ghep).khoa;
  await hub('/hub/trang_thai', 'POST', { may: 'thu', ban: '1.2', ffmpeg: true, kha_nang: ['dung_video'] });
  mucId = (await api('/muc', 'POST', { tieu_de: 'Keo chít mạch', dinh_dang: 'VIDEO' })).j.id;
  for (const [ten, mo] of [['A.mp4', 'tay bóp keo'], ['B.mp4', 'gạch bóng'], ['C.mp4', 'người nói']]) { const t = await hub('/hub/tai-san', 'POST', { muc_id: mucId, ten, media_url: '/media/media/' + ten, media_type: 'VIDEO', giay: 6, mo_ta: mo }); ts.push(t.j.id); }
  const nd = (await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'VIDEO', hook: 'Ron gạch ố?', sections: [{ label: 'Vấn đề', text: 'Ron mốc đen sau một năm.' }, { label: 'Cách làm', text: 'Bóp keo, gạt phẳng, lau sạch.' }], cta: 'Kingsmen.' })).j; ndId = nd.id;
  DB.raw.prepare(`UPDATE noi_dung SET trang_thai='DUYET' WHERE id=?`).run(ndId); DB.raw.prepare(`UPDATE muc_noi_dung SET giai_doan='SAN_XUAT' WHERE id=?`).run(mucId);
  assert.ok(ndId && ts.length === 3);
});
test('010b: máy con báo phân tích đoạn + khung → tai_san.phan_tich (cỡ cảnh do Claude xếp); /hub/viec/phan_tich chỉ trả footage chưa phân tích', async () => {
  let v = (await hub('/hub/viec/phan_tich?muc_id=' + mucId)).j.viec; assert.equal(v.length, 3);
  const r = await hub('/hub/phan-tich', 'POST', { tai_san_id: ts[0], phan_tich: { dai: 6, doan: Array.from({ length: 12 }, (_, i) => ({ t: i / 2, net: 0.8, dong: i > 4 ? 0.6 : 0.1, sang: 0.5 })) }, khung_urls: ['/media/media/k0.jpg', '/media/media/k1.jpg'], mo_ta_lai: true });
  assert.equal(r.s, 200); assert.equal(r.j.co_canh, 'CAN');
  const row = DB.raw.prepare(`SELECT phan_tich, mo_ta FROM tai_san WHERE id=?`).get(ts[0]); const pt = JSON.parse(row.phan_tich); assert.equal(pt.doan.length, 12); assert.equal(pt.co_canh, 'CAN'); assert.ok(String(row.mo_ta).includes('tay bóp keo lên ron'));
  v = (await hub('/hub/viec/phan_tich?muc_id=' + mucId)).j.viec; assert.equal(v.length, 2);
  const dv = (await hub('/hub/viec/dung_video?noi_dung_id=' + ndId)).j.viec[0]; assert.ok(dv); const tA = dv.tai_san.find(t => t.id === ts[0]); assert.equal(tA.phan_tich.doan.length, 12);
});
test('010b: người bấm 🔬 Phân tích footage → lệnh phan_tich_footage cho máy dựng; hết footage chưa phân tích → 409', async () => {
  const r = await api('/muc/' + mucId + '/phan-tich', 'POST', {}); assert.equal(r.s, 200); assert.equal(r.j.so_clip, 2, 'A đã phân tích, còn B và C');
  const l = (await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'phan_tich_footage'); assert.ok(l); assert.equal(l.tham_so.muc_id, mucId);
  for (const id of ts.slice(1)) await hub('/hub/phan-tich', 'POST', { tai_san_id: id, phan_tich: { dai: 6, doan: [{ t: 0, net: 0.5, dong: 0.1, sang: 0.5 }, { t: 0.5, net: 0.5, dong: 0.1, sang: 0.5 }, { t: 1, net: 0.5, dong: 0.1, sang: 0.5 }] } });
  assert.equal((await api('/muc/' + mucId + '/phan-tich', 'POST', {})).s, 409);
  assert.equal((await api('/bootstrap')).j.db.tai_san.filter(t => t.muc_id === mucId && t.phan_tich).length, 3, 'bootstrap mang phan_tich để màn hiện/ẩn nút');
});
test('010a: lô video mang kế hoạch ghép MAY → ghep_video; GET /noi-dung/:id/ghep; người chỉnh (đổi clip, cắt giây) → POST lưu NGUOI, ghi mẫu, giao dựng lại với ghep_id', async () => {
  const ghep = [{ k: 0, label: 'Vấn đề', text: 'Ron mốc đen', hinh: 'ron mốc', d: 3, shots: [{ tai_san_id: ts[1], tu: 0, den: 3 }] }, { k: 1, label: 'Cách làm', text: 'Bóp keo', hinh: 'tay bóp keo', d: 4, shots: [{ tai_san_id: ts[1], tu: 3, den: 5 }, { tai_san_id: ts[2], tu: 0, den: 2 }] }];
  const lo = await hub('/hub/nap', 'POST', { viec: 'may_dung.dung_video', bang: 'content_os.video', luot: 'v010', dong: [{ noi_dung_id: ndId, media_url: '/media/media/v1.mp4', giay: 7, ghep_nguon: 'MAY', ghep, canh_chon: ghep.map(c => ({ k: c.k, label: c.label, hinh: c.hinh, chon: c.shots[0].tai_san_id, cach: 'API', ung_vien: ts.map(id => ({ id, ten: id })) })) }] });
  assert.equal(lo.s, 200);
  let g = (await api('/noi-dung/' + ndId + '/ghep')).j.ghep; assert.equal(g.length, 1); assert.equal(g[0].nguon, 'MAY'); assert.equal(g[0].canh[1].shots.length, 2);
  const truoc = DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang IN ('chon_canh','chon_doan','ghep_canh')`).get().n;
  // người: cảnh 2 đổi shot đầu sang clip A (tay bóp keo) đoạn 1–3.5, bỏ shot 2
  const nguoi = [ghep[0], { ...ghep[1], shots: [{ tai_san_id: ts[0], tu: 1, den: 3.5 }] }];
  assert.equal((await api('/noi-dung/' + ndId + '/ghep', 'POST', { canh: [{ k: 0, label: 'x', d: 3, shots: [] }] })).s, 400);
  const r = await api('/noi-dung/' + ndId + '/ghep', 'POST', { canh: nguoi }); assert.equal(r.s, 200); assert.ok(r.j.ghep_id); assert.ok(r.j.so_mau >= 2, 'có mẫu chon_canh + chon_doan/ghep'); assert.equal(r.j.dung, true);
  const sau = DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang IN ('chon_canh','chon_doan','ghep_canh')`).get().n; assert.ok(sau > truoc);
  const mauDoan = DB.raw.prepare(`SELECT nhan, dau_vao FROM mau_hoc_ai WHERE tinh_nang='chon_doan' ORDER BY created_at DESC LIMIT 1`).get(); assert.ok(mauDoan, 'clip A có phân tích đoạn → mẫu chọn đoạn'); assert.equal(JSON.parse(mauDoan.nhan).tu, 1); assert.equal(JSON.parse(mauDoan.nhan).den, 3.5);
  g = (await api('/noi-dung/' + ndId + '/ghep')).j.ghep; assert.equal(g[0].nguon, 'NGUOI'); assert.equal(g[0].canh[1].shots[0].tai_san_id, ts[0]);
  const l = (await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'dung_video' && x.tham_so.ghep_id); assert.ok(l, 'lệnh dựng lại mang ghep_id');
  const dv = (await hub('/hub/viec/dung_video?noi_dung_id=' + ndId + '&ghep_id=' + r.j.ghep_id)).j.viec[0]; assert.ok(dv.ghep); assert.equal(dv.ghep.canh[1].shots[0].tu, 1);
});
test('010d: kho thành phẩm — Drive/thư mục máy → lệnh hoc_thanh_pham; /hub/thanh-pham ghi kho + mẫu (lượt xem theo mẫu, cỡ cảnh do Claude xếp), chống trùng; /hub/tap-mau có luot_xem', async () => {
  assert.equal((await api('/kho-thanh-pham/nap', 'POST', { link: 'https://example.com/x' })).s, 400);
  let r = await api('/kho-thanh-pham/nap', 'POST', { link: 'D:\\Video da dung', toi_da: 5 }); assert.equal(r.s, 200);
  let l = (await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'hoc_thanh_pham'); assert.equal(l.tham_so.nguon, 'LOCAL'); assert.equal(l.tham_so.duong_dan, 'D:\\Video da dung'); assert.equal(l.tham_so.toi_da, 5);
  r = await api('/kho-thanh-pham/nap', 'POST', { link: 'https://drive.google.com/drive/folders/1EodWW7d1a4Q5lDA9rV4HAnbmvfWzGbrb' }); assert.equal(r.s, 200);
  l = (await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'hoc_thanh_pham' && x.tham_so.nguon === 'DRIVE'); assert.equal(l.tham_so.folder_id, '1EodWW7d1a4Q5lDA9rV4HAnbmvfWzGbrb');
  const shots = [{ t0: 0, t1: 2.5, khung_url: '/media/media/s0.jpg', loi: 'ron gạch nhà bạn có bị mốc' }, { t0: 2.5, t1: 4, khung_url: '/media/media/s1.jpg', loi: 'bóp keo', goc: { ten: 'A.mp4', tu: 1, den: 2.5, diem: 0.9, doan: Array.from({ length: 12 }, (_, i) => ({ t: i / 2, net: 0.7, dong: 0.3, sang: 0.5 })), dai: 6 } }, { t0: 4, t1: 7.2, khung_url: '/media/media/s2.jpg', loi: 'Kingsmen' }];
  r = await hub('/hub/thanh-pham', 'POST', { ten: 'keo-chit-1.mp4', nguon_id: 'keo-chit-1.mp4', nguon: 'TIKTOK', thu_muc: 'D:\\may-dung\\thanh-pham\\tiktok\\kingsmen', dai: 7.2, shots, luot_xem: 12500, kenh: '@kingsmen', link: 'https://www.tiktok.com/@kingsmen/video/1', ngay_dang: '2026-09-01' });
  assert.equal(r.s, 200); assert.ok(r.j.so_mau >= 1 + 3 + 1, 'ghep_canh + 3 chon_canh + 1 chon_doan');
  assert.equal((await hub('/hub/thanh-pham', 'POST', { ten: 'keo-chit-1.mp4', nguon_id: 'keo-chit-1.mp4', shots })).j.trung, true);
  assert.deepEqual((await hub('/hub/viec/thanh_pham')).j.da_co, ['keo-chit-1.mp4']);
  const kho = DB.raw.prepare(`SELECT * FROM kho_thanh_pham`).all(); assert.equal(kho.length, 1); assert.equal(kho[0].luot_xem, 12500); assert.equal(kho[0].kenh, '@kingsmen'); assert.equal(kho[0].so_shot, 3); assert.equal(kho[0].co_goc, 1);
  assert.equal(JSON.parse(kho[0].phan_tich).shots[0].co_canh, 'CAN', 'cỡ cảnh do Claude xếp từ khung');
  const tm = (await hub('/hub/tap-mau?tinh_nang=ghep_canh')).j.mau; const m = tm.find(x => x.dau_vao.nguon === 'THANH_PHAM'); assert.ok(m); assert.equal(m.dau_vao.luot_xem, 12500); assert.equal(m.nhan.shots.length, 3);
  const tmc = (await hub('/hub/tap-mau?tinh_nang=chon_canh')).j.mau; assert.ok(tmc.some(x => x.luot_xem === 12500), 'mẫu chọn cảnh mang lượt xem để đặt trọng số');
  const b = (await api('/bootstrap')).j.db.ai_nao; assert.equal(b.kho_thanh_pham.length, 1); assert.equal(b.kho_thanh_pham[0].luot_xem, 12500);
  assert.ok(b.dinh_tuyen.some(d => d.tinh_nang === 'chon_doan' && d.mo_hinh_mo === 'doan-tuyen-tinh')); assert.ok(b.dinh_tuyen.some(d => d.tinh_nang === 'ghep_canh' && d.mo_hinh_mo === 'ghep-thong-ke'));
  let h = await api('/ai/huan-luyen', 'POST', { tinh_nang: 'ghep_canh' }); assert.equal(h.s, 409); assert.ok(h.j.error.includes('Cần ≥ 10 mẫu'), 'chưa đủ mẫu thì nói rõ, không bịa');
  for (let i = 2; i <= 10; i++) await hub('/hub/thanh-pham', 'POST', { ten: 'keo-chit-' + i + '.mp4', nguon: 'LOCAL', shots: shots.map(x => ({ t0: x.t0, t1: x.t1 })), luot_xem: null });
  h = await api('/ai/huan-luyen', 'POST', { tinh_nang: 'ghep_canh' }); assert.equal(h.s, 200, 'đủ 10 mẫu: huấn luyện ghép rơi về máy dựng khi không có máy huấn luyện'); assert.ok(h.j.so_mau >= 10);
  assert.equal((await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'huan_luyen').tham_so.mo_hinh_id, 'ghep-thong-ke');
  assert.equal((await api('/bootstrap')).j.db.ai_nao.kho_thanh_pham.filter(t => t.luot_xem == null).length, 9, 'không có lượt xem thì để trống, không ghi 0');
});
test('010d TikTok: cần Trạm sống; kênh vào hàng đợi module_config tai_tiktok + lệnh chay_agent tai_tiktok; Trạm hỏi /hub/viec/tai_tiktok; báo đã tải → lệnh hoc_thanh_pham TIKTOK cho máy dựng', async () => {
  assert.equal((await api('/kho-thanh-pham/nap', 'POST', { link: '@kingsmen', nguon: 'TIKTOK' })).s, 409, 'Trạm im');
  const khoaTram = giai((await api('/tram/khoa', 'POST')).j.ma_ghep).khoa;
  const hubT = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': khoaTram }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
  await hubT('/hub/trang_thai', 'POST', { may: 'NGOC-HAN', ban: '9.163', tai_khoan: [], nhan_vien: [] });
  assert.equal((await api('/kho-thanh-pham/nap', 'POST', { link: 'rác', nguon: 'TIKTOK' })).s, 400);
  const r = await api('/kho-thanh-pham/nap', 'POST', { link: 'https://www.tiktok.com/@kingsmen.vn?lang=vi', nguon: 'TIKTOK', toi_da: 15 }); assert.equal(r.s, 200); assert.equal(r.j.kenh, '@kingsmen.vn');
  const v = (await hubT('/hub/viec/tai_tiktok')).j; assert.equal(v.viec.length, 1); assert.equal(v.viec[0].toi_da, 15); assert.ok(v.viec[0].thu_muc.endsWith('kingsmen.vn')); assert.deepEqual(v.da_co, ['keo-chit-1.mp4']);
  const lt = (await hubT('/hub/lenh')).j.lenh.find(x => x.viec === 'chay_agent' && x.tham_so.viec === 'tai_tiktok'); assert.ok(lt, 'Trạm nhận lệnh chạy việc tai_tiktok');
  assert.equal((await api('/bootstrap')).j.db.ai_nao.tai_tiktok_cho.length, 1);
  const d = await hubT('/hub/tiktok-da-tai', 'POST', { kenh: '@kingsmen.vn', thu_muc: 'D:\\may-dung\\thanh-pham\\tiktok\\kingsmen.vn', so: 9 }); assert.equal(d.s, 200); assert.equal(d.j.giao, true);
  const l = (await hub('/hub/lenh')).j.lenh.find(x => x.viec === 'hoc_thanh_pham' && x.tham_so.nguon === 'TIKTOK'); assert.ok(l); assert.equal(l.tham_so.kenh, '@kingsmen.vn'); assert.equal(l.tham_so.toi_da, 9);
  assert.equal((await hubT('/hub/viec/tai_tiktok')).j.viec.length, 0, 'hết hàng đợi');
  for (const s of ['phan-tich', 'hoc-thanh-pham', 'nap-drive']) assert.equal((await hub('/hub/script/' + s)).s, 200, 'script ' + s + ' được phát');
});
