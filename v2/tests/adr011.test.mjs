// ADR-011 — Kalodata: cấu hình ngành hàng, quét qua Trạm, Trạm trả bảng video → hàng đợi tải bằng tiktok_cn (link + doanh thu),
// kho thành phẩm nguồn KALODATA có doanh thu + lời thoại = kịch bản bán tốt → vào lời dặn AI viết kịch bản VIDEO và tập mẫu ngôn ngữ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let PROMPT = '';
globalThis.fetch = async (url, opt) => { const u = String(url); if (u.includes('api.anthropic.com')) { try { const b = JSON.parse(opt.body); PROMPT = (b.system || '') + '\n' + b.messages.map(m => typeof m.content === 'string' ? m.content : '').join('\n'); } catch {} return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ tieu_de: 'Ron mốc', hook: 'Ron gạch nhà bạn mốc chưa?', sections: [{ label: 'Vấn đề', text: 'Ron đen sau một năm.', hinh: 'tay bóp keo lên ron gạch' }], cta: 'Kingsmen.' }) }], usage: { input_tokens: 500, output_tokens: 80 } }), { status: 200 }); } return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ANTHROPIC_API_KEY: 'sk-ant-thu', ASSETS: { fetch: async () => new Response('export default async function x(){}') }, MEDIA: { get: async () => ({ arrayBuffer: async () => new Uint8Array([255, 216, 255, 217]).buffer }), put: async () => ({}) } };
let TOKEN = null, KHOA = null, KHOA_TRAM = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
const LINK = (n) => 'https://www.tiktok.com/@shopkeo/video/72000000000' + n;

test('cấu hình Kalodata (Trưởng MKT/Admin): ngành hàng, top N; quét cần Trạm sống; Trạm chưa đến hạn thì /hub/viec/kalodata trả null', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  KHOA = giai((await api('/may-ghep', 'POST', { ten: 'Máy 011' })).j.ma_ghep).khoa; await hubK(KHOA)('/hub/trang_thai', 'POST', { may: 'thu', ban: '1.2', ffmpeg: true, kha_nang: ['dung_video'] });
  assert.equal((await api('/kalodata/quet', 'POST')).s, 400, 'chưa có ngành');
  let r = await api('/kalodata', 'PUT', { nganh: 'Keo, Vật liệu xây dựng, , Chất tẩy rửa', top_n: 8 }); assert.equal(r.s, 200); assert.deepEqual(r.j.db.ai_nao.kalodata.nganh, ['Keo', 'Vật liệu xây dựng', 'Chất tẩy rửa']); assert.equal(r.j.db.ai_nao.kalodata.top_n, 8);
  assert.equal((await api('/kalodata/quet', 'POST')).s, 409, 'Trạm im');
  KHOA_TRAM = giai((await api('/tram/khoa', 'POST')).j.ma_ghep).khoa; await hubK(KHOA_TRAM)('/hub/trang_thai', 'POST', { may: 'NGOC-HAN', ban: '9.164' });
  let v = (await hubK(KHOA_TRAM)('/hub/viec/kalodata')).j; assert.ok(v.viec, 'chưa quét lần nào + tự động → đến hạn'); assert.equal(v.viec.top_n, 8);
  await api('/users', 'POST', { ho_ten: 'MKT', email: 'mkt@k.vn', password: '123456', vai_tro: 'MARKETING' }); const tMkt = (await api('/login', 'POST', { email: 'mkt@k.vn', password: '123456' })).j.token;
  assert.equal((await api('/kalodata', 'PUT', { nganh: 'x' }, tMkt)).s, 403);
});
test('Trạm trả bảng video → hàng đợi tai_tiktok mang link + doanh thu (nguồn KALODATA), lệnh chay_agent tai_tiktok; link rác bị bỏ; quét xong hết hạn', async () => {
  const hubT = hubK(KHOA_TRAM);
  const r = await hubT('/hub/kalodata', 'POST', { nganh: 'Keo', video: [{ link: LINK(1), tieu_de: 'Keo chít mạch chống mốc', kenh: '@shopkeo', doanh_thu: 1250.5, luot_ban: 300, luot_xem: 45000, san_pham: 'Keo chít mạch Kingsmen 2 thành phần' }, { link: 'https://kalodata.com/x', doanh_thu: 1 }, { link: LINK(2), kenh: '@shopkeo', doanh_thu: 400 }] });
  assert.equal(r.s, 200); assert.equal(r.j.so, 2); assert.equal(r.j.kenh, 'kalodata:keo');
  const v = (await hubT('/hub/viec/tai_tiktok')).j; assert.equal(v.viec.length, 1); assert.equal(v.viec[0].nguon, 'KALODATA'); assert.deepEqual(v.viec[0].links, [LINK(1), LINK(2)]); assert.equal(v.viec[0].meta[LINK(1)].doanh_thu, 1250.5); assert.ok(v.viec[0].thu_muc.endsWith('kalodata\\keo'));
  assert.ok((await hubT('/hub/lenh')).j.lenh.some(x => x.viec === 'chay_agent' && x.tham_so.viec === 'tai_tiktok'));
  assert.equal((await hubT('/hub/viec/kalodata')).j.viec, null, 'vừa quét → chưa đến hạn');
  const kd = (await api('/bootstrap')).j.db.ai_nao.kalodata; assert.equal(kd.ket_qua_cuoi.so, 2); assert.ok(kd.lan_cuoi);
  assert.equal((await api('/kalodata/quet', 'POST')).s, 200); assert.ok((await hubT('/hub/viec/kalodata')).j.viec, 'chủ bấm quét ngay → đến hạn');
  const d = await hubT('/hub/tiktok-da-tai', 'POST', { kenh: 'kalodata:keo', thu_muc: 'D:\\may-dung\\thanh-pham\\kalodata\\keo', so: 2, nguon: 'KALODATA' }); assert.equal(d.j.giao, true);
  const l = (await hubK(KHOA)('/hub/lenh')).j.lenh.find(x => x.viec === 'hoc_thanh_pham'); assert.equal(l.tham_so.nguon, 'KALODATA');
});
test('kho thành phẩm KALODATA: doanh thu + lời thoại → kịch bản bán tốt vào lời dặn AI viết VIDEO và tập mẫu ngôn ngữ; mẫu học mang doanh_thu', async () => {
  const hub = hubK(KHOA);
  const shots = [{ t0: 0, t1: 2.5, loi: 'Ron gạch nhà bạn mốc đen chưa? Đừng cạo nữa.' }, { t0: 2.5, t1: 5, loi: 'Keo chít mạch hai thành phần này bóp một đường là phủ kín ron cũ, khô sau hai giờ.' }, { t0: 5, t1: 8, loi: 'Nhà mình làm từ năm ngoái vẫn trắng. Bấm giỏ hàng bên dưới, đang giảm bốn mươi phần trăm.' }];
  let r = await hub('/hub/thanh-pham', 'POST', { ten: '72000000000001.mp4', nguon: 'KALODATA', shots, link: LINK(1), kenh: '@shopkeo', doanh_thu: 1250.5, luot_ban: 300, luot_xem: 45000, san_pham: 'Keo chít mạch Kingsmen 2 thành phần' }); assert.equal(r.s, 200);
  const row = DB.raw.prepare(`SELECT * FROM kho_thanh_pham WHERE link=?`).get(LINK(1)); assert.equal(row.nguon, 'KALODATA'); assert.equal(row.doanh_thu, 1250.5); assert.ok(row.kich_ban.includes('bóp một đường'));
  const b = (await api('/bootstrap')).j.db.ai_nao; assert.equal(b.kho_thanh_pham[0].doanh_thu, 1250.5); assert.ok(b.kho_thanh_pham[0].kich_ban.length > 40);
  const m = (await hub('/hub/tap-mau?tinh_nang=ghep_canh')).j.mau.find(x => x.dau_vao.doanh_thu === 1250.5); assert.ok(m, 'mẫu ghép mang doanh thu để đặt trọng số');
  const nn = (await hub('/hub/tap-mau-ngon-ngu?tinh_nang=soan_nhap_agent')).j.mau; const tp = nn.find(x => x.id === 'tp_' + row.id); assert.ok(tp); assert.equal(tp.quyet, 'DUYET'); assert.ok(tp.nguoi.includes('bóp một đường')); assert.ok(tp.ly_do.includes('1.251 đồng'), tp.ly_do);
  // AI viết kịch bản VIDEO cho một mục → lời dặn có KỊCH BẢN BÁN TỐT THAM KHẢO
  const mucId = (await api('/muc', 'POST', { tieu_de: 'Keo chít mạch chống mốc', dinh_dang: 'VIDEO' })).j.id;
  PROMPT = ''; r = await api('/noi-dung/ai-viet', 'POST', { muc_id: mucId, dinh_dang: 'VIDEO' }); assert.equal(r.s, 200, JSON.stringify(r.j).slice(0, 200));
  assert.ok(PROMPT.includes('KỊCH BẢN BÁN TỐT THAM KHẢO'), 'lời dặn có tham chiếu'); assert.ok(PROMPT.includes('bóp một đường')); assert.ok(PROMPT.includes('KHÔNG chép câu'));
});
