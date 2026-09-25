// ADR-017 đợt A — Bàn huấn luyện (làn × dòng, chặng tính từ dữ liệu thật), trần riêng cho thầy, trần phút hộp việc, thời gian từng chặng máy học.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => { if (String(url).includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"nhom":"THI_CONG","chac":0.9}' }], usage: { input_tokens: 2000, output_tokens: 100 } }), { status: 200 }); return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const anh = { arrayBuffer: async () => new Uint8Array([255, 216, 255, 217]).buffer };
const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async (k) => (k.startsWith('media/') ? anh : null), put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
const datCH = (id, v) => DB.raw.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at) VALUES (?, ?, '')`).run(id, JSON.stringify(v));

Math.random = () => 0.99;   // kiểm ngẫu nhiên do máy chủ quyết — ghim
test('017a: bàn huấn luyện, trần thầy, trần phút, thời gian chặng', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await may('/hub/trang_thai', 'POST', { may: 'Q2', ffmpeg: true, ollama: true, gpu: 'RTX 3070 Ti, 8192 MiB', kha_nang: ['dung_video', 'mo_hinh'], dang_lam: 'hoc_thanh_pham' });
  await api('/danh-muc/san_pham', 'POST', { ma: 'F', ten: 'Finex', dong: 'Finex', quy_trinh: 'Lăn lót\nTrát' });
  const tl = (n) => Array.from({ length: n }, (_, i) => ({ tu: i * 2, den: i * 2 + 2, nhom: 'THI_CONG', mo: { nhom: i % 2 ? 'HOAN_THIEN' : 'THI_CONG' }, thay: { nhom: 'THI_CONG', chac: i % 2 ? 0.4 : 0.9 }, can_xac_nhan: !!(i % 2), khung_url: '/media/media/k' + i + '.jpg' }));
  let r = await may('/hub/thanh-pham', 'POST', { ten: 'a.mp4', nguon_id: 'a', nguon: 'TIKTOK', dai: 20, dong: 'Finex', shots: [{ t0: 0, t1: 10, loi: 'lăn lớp lót trước khi trát' }, { t0: 10, t1: 20 }], timeline: tl(10), thoi_gian: { tai: 12.3, cat: 4, nghe: 30, anh_shot: 20, nhin: 150, thay: 25 } });
  assert.equal(r.s, 200);
  const pt = JSON.parse(DB.raw.prepare(`SELECT phan_tich FROM kho_thanh_pham`).get().phan_tich); assert.equal(pt.thoi_gian.nhin, 150); assert.equal(pt.may, 'Q2');

  let b = (await api('/ban-huan-luyen')).j;
  assert.equal(b.lan.length, 6); assert.ok(b.dongs.includes('Finex'));
  assert.equal(b.o.K1.chung.chang, 1); assert.equal(b.o.K1.chung.so_do.doan, 10); assert.equal(b.o.K1.chung.so_do.bat_dong_pct, 50);
  assert.match(b.o.K3.chung.thieu, /chờ K1/); assert.equal(b.o.K2.chung.chang, 1); assert.equal(b.o.K4.chung.chang, 1);
  assert.equal(b.nguon_luc.thoi_gian_tb.nhin, 150); assert.equal(b.nguon_luc.may[0].dang_lam, 'hoc_thanh_pham'); assert.equal(b.nguon_luc.thay.tran_usd, 20);
  // ngưỡng nhỏ → K1 Finex lên chặng 3 (thầy đã đọc hết, chờ nhãn vàng)
  datCH('huan_luyen', { k1_gom_dong: 5, k1_vang_dong: 2, tran_phut_ngay: 0.1 });
  b = (await api('/ban-huan-luyen')).j; assert.equal(b.o.K1.dong.Finex.chang, 3); assert.match(b.o.K1.dong.Finex.thieu, /nhãn vàng/);

  // trần phút: 1 nhãn 10 giây > 0,1 phút → hộp đóng; them=1 vẫn lấy được
  const tp = DB.raw.prepare(`SELECT id FROM kho_thanh_pham`).get().id;
  await api('/kho-thanh-pham/' + tp + '/doan/1', 'POST', { nhom: 'THI_CONG', giay: 10, nhe: true });
  let h = (await api('/nhan-hinh/hang')).j; assert.equal(h.het_tran, true); assert.equal(h.hang.length, 0);
  h = (await api('/nhan-hinh/hang?them=1')).j; assert.ok(h.hang.length > 0);
  b = (await api('/ban-huan-luyen')).j; assert.equal(b.o.K1.dong.Finex.so_do.vang, 1); assert.equal(b.o.K1.dong.Finex.so_do.thay_pct, 100); assert.equal(b.o.K1.dong.Finex.so_do.mo_pct, 0);

  // trần thầy riêng: đã tiêu ≥ trần → không gọi Claude
  datCH('ai', { ngan_sach_thay_usd: 0.001 });
  r = await may('/hub/thay-doc', 'POST', { doan: [{ anh: ['/media/media/a.jpg'] }] }); assert.equal(r.j.kq[0].ok, true, 'lần đầu còn trần');
  r = await may('/hub/thay-doc', 'POST', { doan: [{ anh: ['/media/media/a.jpg'] }] }); assert.match(r.j.kq[0].loi, /ngân sách thầy/);
  datCH('ai', { thay_nhin: false }); r = await may('/hub/thay-doc', 'POST', { doan: [{ anh: ['/media/media/a.jpg'] }] }); assert.equal(r.j.tat, true);
});
