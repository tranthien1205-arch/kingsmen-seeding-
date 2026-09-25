// ADR-016b — Claude làm thầy: /hub/thay-doc đọc đoạn theo tập nhãn đóng của sản phẩm, làm sạch nhãn lạ, ghi chi phí vào mục học,
// hết ngân sách học thì dừng cả lô; dòng thời gian giữ nhãn mô hình mở + nhãn thầy; bảng đo tách độ chính xác từng bên.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let TRA = [];
globalThis.fetch = async (url, opt) => { if (String(url).includes('api.anthropic.com')) { const t = TRA.shift() || '{"nhom":"KHAC","chac":0.3}'; return new Response(JSON.stringify({ content: [{ type: 'text', text: t }], usage: { input_tokens: 2000, output_tokens: 100 } }), { status: 200 }); } return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const anh = { arrayBuffer: async () => new Uint8Array([255, 216, 255, 217]).buffer };
const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async (k) => (k.startsWith('media/') ? anh : null), put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

test('016b: thầy Claude đọc đoạn, nhãn đóng, chi phí mục học, hết ngân sách dừng lô, bảng đo tách thầy / mô hình mở', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  const qt = ['Vệ sinh ron', 'Bơm keo vào ron', 'Gạt phẳng'];
  TRA = ['{"nhom":"THI_CONG","buoc":"Bơm keo vào ron","tham_my":-1,"chac":0.9,"mo_ta":"bơm keo","ly_do":"súng bơm"}', 'Đây: {"nhom":"THI_CONG","buoc":"Bước bịa","chac":0.8}', '{"nhom":"LA","chac":1}'];
  let r = await may('/hub/thay-doc', 'POST', { quy_trinh: qt, bai_test: [], san_pham: 'Keo', doan: [{ anh: ['/media/media/a.jpg'] }, { anh: ['/media/media/b.jpg'] }, { anh: ['/media/media/c.jpg'] }, { anh: ['https://ngoai/x.jpg'] }] });
  assert.equal(r.s, 200); const kq = r.j.kq; assert.equal(kq.length, 4);
  const ok = kq.filter((x) => x.ok); assert.equal(ok.length, 2, 'nhãn lạ + ảnh ngoài kho bị loại');
  assert.ok(ok.some((x) => x.nhan.buoc === 'Bơm keo vào ron' && x.nhan.tham_my === null), 'bước đúng danh sách, thẩm mỹ -1 → null');
  assert.ok(ok.some((x) => x.nhan.nhom === 'THI_CONG' && x.nhan.buoc === null), 'bước bịa → null');
  assert.equal(kq[3].loi, 'không thấy ảnh đoạn');
  const u = DB.raw.prepare(`SELECT COUNT(*) n, SUM(chi_phi_usd) usd FROM ai_usage WHERE tinh_nang='hoc_nhan_khung'`).get(); assert.equal(u.n, 3); assert.ok(u.usd > 0, 'chi phí có giá');
  // hết ngân sách học → cả lô dừng, không gọi thêm
  DB.raw.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at) VALUES ('ai', ?, '')`).run(JSON.stringify({ ngan_sach_thang_usd: 0.05, ngan_sach_hoc_pct: 20 }));
  const cfgR = await api('/bootstrap'); assert.equal(cfgR.s, 200);
  r = await may('/hub/thay-doc', 'POST', { quy_trinh: qt, doan: [{ anh: ['/media/media/a.jpg'] }, { anh: ['/media/media/b.jpg'] }] });
  const dem2 = DB.raw.prepare(`SELECT COUNT(*) n FROM ai_usage WHERE tinh_nang='hoc_nhan_khung'`).get().n;
  assert.ok(r.j.kq.every((x) => !x.ok && /ngân sách/.test(x.loi)), 'hết ngân sách → cả lô báo'); assert.equal(dem2, 3, 'không gọi Claude khi hết ngân sách');
  DB.raw.prepare(`DELETE FROM module_config WHERE id='ai'`).run();
  // dòng thời gian giữ mo + thay; bảng đo tách
  const sp = (await api('/danh-muc/san_pham', 'POST', { ma: 'K', ten: 'Keo', dong: 'Keo', quy_trinh: qt.join('\n') })).j.id;
  const muc = (await api('/muc', 'POST', { tieu_de: 'x', dinh_dang: 'VIDEO', san_pham_id: sp })).j.id;
  const ts = (await may('/hub/tai-san', 'POST', { muc_id: muc, ten: 'A.mp4', media_url: '/media/media/a.mp4', media_type: 'VIDEO', giay: 6 })).j.id;
  await may('/hub/doc-khung', 'POST', { tai_san_id: ts, timeline: [{ tu: 0, den: 3, nhom: 'THI_CONG', buoc: 'Gạt phẳng', can_xac_nhan: true, nguon_nhan: 'THAY', mo: { nhom: 'HOAN_THIEN', chac: 1 }, thay: { nhom: 'THI_CONG', buoc: 'Gạt phẳng', chac: 0.6, model: 'claude-sonnet-4-5', ly_do: 'tay cầm bay' } }, { tu: 3, den: 6, nhom: 'HOAN_THIEN', can_xac_nhan: false, nguon_nhan: 'THAY', mo: { nhom: 'THI_CONG' }, thay: { nhom: 'HOAN_THIEN', chac: 0.9 } }] });
  assert.equal((await api('/nhan-hinh/hang')).j.hang.length, 1, 'thầy chắc mà lệch mô hình mở → KHÔNG đẩy cho người');
  const h = (await api('/nhan-hinh/hang')).j.hang[0]; assert.equal(h.thay.ly_do, 'tay cầm bay'); assert.equal(h.mo.nhom, 'HOAN_THIEN');
  await api('/tai-san/' + ts + '/doan/0', 'POST', { nhom: 'THI_CONG', buoc: 'Gạt phẳng', nhe: true });
  const d = (await api('/bootstrap')).j.db.ai_nao.do_chinh_xac_hinh; assert.deepEqual(d.thay, { so: 1, dung_nhom: 1 }); assert.deepEqual(d.mo, { so: 1, dung_nhom: 0 });
});
