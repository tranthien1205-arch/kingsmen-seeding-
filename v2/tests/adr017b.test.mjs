// ADR-017 đợt B — K2 chất lượng source (hàng gần ngưỡng, người quyết, máy học ngưỡng ≥ 30 lần) · K4 đọc lời (Claude Haiku theo lô, hàng câu lệch, người xác nhận / nghe sai)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let GOI = 0;
globalThis.fetch = async (url, opt) => { if (String(url).includes('api.anthropic.com')) { GOI++; const n = (JSON.parse(opt.body).messages[0].content.match(/^\d+\. "/gm) || []).length; const arr = Array.from({ length: n }, (_, i) => ({ i: i + 1, nhom: i === 0 ? 'GIAI_PHAP' : 'THI_CONG', buoc: i === 1 ? 'Trát' : 'Bịa', chac: i === 2 ? 0.4 : 0.9, nghe_sai: i === 3 })); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Kết quả: ' + JSON.stringify(arr) }], usage: { input_tokens: 800, output_tokens: 300 } }), { status: 200 }); } return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1();
const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async () => null, put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

test('017b: K2 source + K4 đọc lời', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  const sp = (await api('/danh-muc/san_pham', 'POST', { ma: 'F', ten: 'Finex', dong: 'Finex', quy_trinh: 'Lăn lót\nTrát' })).j.id;
  const muc = (await api('/muc', 'POST', { tieu_de: 'x', dinh_dang: 'VIDEO', san_pham_id: sp })).j.id;
  // footage 40 đoạn: nét giảm dần 0,80 → 0,41 (người: dưới 0,62 là mờ, loại)
  const ts = (await may('/hub/tai-san', 'POST', { muc_id: muc, ten: 'A.mp4', media_url: '/media/media/a.mp4', media_type: 'VIDEO', giay: 40 })).j.id;
  const doan = Array.from({ length: 80 }, (_, i) => ({ t: i * 0.5, net: +(0.8 - Math.floor(i / 2) * 0.01).toFixed(3), dong: 0.05, sang: 0.6 }));
  await may('/hub/phan-tich', 'POST', { tai_san_id: ts, phan_tich: { dai: 40, doan } });
  await may('/hub/doc-khung', 'POST', { tai_san_id: ts, timeline: Array.from({ length: 40 }, (_, i) => ({ tu: i, den: i + 1, nhom: 'THI_CONG', khung_url: '/media/media/k.jpg' })) });
  let h = (await api('/source/hang')).j; assert.equal(h.con_lai, 40); assert.ok(Math.abs(h.hang[0].so_do.net - 0.55) < 0.03, 'gần ngưỡng 0,55 trước'); assert.ok(h.hang.some((x) => x.ngau_nhien));
  for (let i = 0; i < 40; i++) { const net = 0.8 - i * 0.01; const r = await api('/tai-san/' + ts + '/doan/' + i + '/source', 'POST', { dung: net >= 0.62, ly_do: net >= 0.62 ? [] : ['mờ', 'bịa'], giay: 3 }); assert.equal(r.s, 200); if (i === 29) assert.ok(r.j.hoc && r.j.hoc.ok, 'học ngưỡng khi đủ 30'); }
  const cfg = JSON.parse(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='huan_luyen'`).get().cau_hinh).source_hoc; assert.ok(cfg.net >= 0.6 && cfg.net <= 0.64, 'ngưỡng học ≈ 0,62: ' + cfg.net); assert.ok(cfg.khop_pct > cfg.khop_cu_pct);
  const mau = JSON.parse(DB.raw.prepare(`SELECT nhan FROM mau_hoc_ai WHERE tinh_nang='chat_luong_source' AND dau_vao LIKE '{"i":39,%'`).get().nhan); assert.deepEqual(mau.ly_do, ['mờ'], 'lý do lạ bị bỏ');
  assert.equal((await api('/source/hang')).j.con_lai, 0);
  let b = (await api('/ban-huan-luyen')).j; assert.equal(b.o.K2.chung.so_do.vang, 40); assert.equal(b.nguon_luc.nguoi.phut_hom_nay, 2);

  // K4: 5 câu từ video đã air (nhãn hình từ shot)
  await may('/hub/thanh-pham', 'POST', { ten: 'v.mp4', nguon_id: 'v', nguon: 'TIKTOK', dai: 25, dong: 'Finex', shots: [0, 1, 2, 3, 4].map((i) => ({ t0: i * 5, t1: i * 5 + 5, loi: 'câu số ' + i + ' nói về thi công', nhom: 'THI_CONG', buoc: 'Trát', khung_url: '/media/media/s' + i + '.jpg' })) });
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang='doc_loi'`).get().n, 5);
  let r = await api('/doc-loi/thay', 'POST', {}); assert.equal(r.j.so, 5); assert.equal(GOI, 1, 'một lô 20 câu = một lần gọi');
  assert.equal((await api('/doc-loi/thay', 'POST', {})).j.so, 0, 'không đọc lại');
  assert.ok(DB.raw.prepare(`SELECT COUNT(*) n FROM ai_usage WHERE tinh_nang='hoc_doc_loi'`).get().n === 1);
  h = (await api('/doc-loi/hang')).j; assert.equal(h.con_lai, 5);
  assert.equal(h.hang[0].thay.nghe_sai, true, 'nghe sai lên đầu'); assert.equal(h.hang[1].lech, true, 'thầy khác nhãn hình lên trước'); assert.equal(h.hang[1].thay.nhom, 'GIAI_PHAP');
  const c2 = h.hang.find((x) => x.thay.buoc === 'Trát'); assert.ok(c2, 'bước đúng danh sách giữ'); assert.ok(h.hang.every((x) => x.thay.buoc !== 'Bịa'), 'bước bịa bỏ'); assert.ok(h.hang.some((x) => x.khung_url), 'ảnh shot cùng câu');
  r = await api('/mau/' + h.hang[1].id + '/doc-loi', 'POST', { nhom: 'GIAI_PHAP', giay: 4 }); assert.equal(r.j.dung, true);
  r = await api('/mau/' + h.hang[0].id + '/doc-loi', 'POST', { nghe_sai: true }); assert.equal(r.j.dung, false);
  assert.equal((await api('/doc-loi/hang')).j.con_lai, 3);
  b = (await api('/ban-huan-luyen')).j; assert.equal(b.o.K4.chung.so_do.vang, 2); assert.equal(b.o.K4.chung.so_do.thay_pct, 100); assert.equal(b.o.K4.chung.so_do.nghe_sai_pct, 50); assert.ok(b.o.K4.dong.Finex);
});
