// Thầy nâng cấp (chủ 25/09): mặc định Claude Opus 5 · effort · dự phòng khi bị từ chối · ví dụ người đã sửa đi kèm · đổi mô hình từ app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; const GUI = [];
globalThis.fetch = async (url, opt) => { if (String(url).includes('api.anthropic.com')) { GUI.push({ h: opt.headers, b: JSON.parse(opt.body) }); return new Response(JSON.stringify({ model: JSON.parse(opt.body).model, stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"nhom":"THI_CONG","buoc":"Trát","chac":0.8}' }], usage: { input_tokens: 2500, output_tokens: 400 } }), { status: 200 }); } return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const anh = { arrayBuffer: async () => new Uint8Array([255, 216, 255, 217]).buffer };
const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async (k) => (k.startsWith('media/') ? anh : null), put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

test('016d: thầy Opus 5 + ví dụ người sửa + đổi mô hình từ app', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  // một nhãn người có mô tả (dòng Finex)
  await may('/hub/thanh-pham', 'POST', { ten: 'f.mp4', nguon_id: 'f', nguon: 'TIKTOK', dai: 10, dong: 'Finex', shots: [{ t0: 0, t1: 5 }, { t0: 5, t1: 10 }], timeline: [{ tu: 0, den: 10, nhom: 'HOAN_THIEN', can_xac_nhan: true }] });
  const tp = DB.raw.prepare(`SELECT id FROM kho_thanh_pham`).get().id;
  await api('/kho-thanh-pham/' + tp + '/doan/0', 'POST', { nhe: true, nhom: 'THI_CONG', buoc: 'Cán bay răng', mo_ta: 'gạt Finex bằng bay răng vàng' });
  let r = await may('/hub/thay-doc', 'POST', { quy_trinh: ['Trát'], san_pham: 'Finex', doan: [{ anh: ['/media/media/a.jpg'] }] });
  assert.equal(r.j.kq[0].ok, true); assert.equal(r.j.kq[0].nhan.buoc, 'Trát', 'đọc được chữ sau khối suy nghĩ');
  const g = GUI[0]; assert.equal(g.b.model, 'claude-opus-5'); assert.equal(g.b.output_config.effort, 'medium'); assert.equal(g.b.fallbacks, 'default'); assert.equal(g.h['anthropic-beta'], 'server-side-fallback-2026-07-01'); assert.ok(g.b.max_tokens >= 2000, 'đủ chỗ cho suy nghĩ');
  assert.match(g.b.messages[0].content.at(-1).text, /bay răng vàng/, 'ví dụ người sửa đi kèm');
  assert.ok(DB.raw.prepare(`SELECT chi_phi_usd FROM ai_usage WHERE tinh_nang='hoc_nhan_khung'`).get().chi_phi_usd > 0.02, 'giá Opus 5 có trong bảng');
  // đổi sang Sonnet 4.5 từ app: không gửi effort / fallbacks
  assert.equal((await api('/cau-hinh/ai', 'PUT', { cau_hinh: { thay_nhin_model: 'claude-sonnet-4-5' } })).s, 200);
  r = await may('/hub/thay-doc', 'POST', { quy_trinh: ['Trát'], doan: [{ anh: ['/media/media/a.jpg'] }] }); const g2 = GUI[1];
  assert.equal(g2.b.model, 'claude-sonnet-4-5'); assert.equal(g2.b.output_config, undefined); assert.equal(g2.h['anthropic-beta'], undefined);
  // bị từ chối → báo lỗi, không đọc nhầm
  globalThis.fetch = async () => new Response(JSON.stringify({ stop_reason: 'refusal', content: [], usage: {} }), { status: 200 });
  r = await may('/hub/thay-doc', 'POST', { doan: [{ anh: ['/media/media/a.jpg'] }] }); assert.match(r.j.kq[0].loi, /từ chối/);
  globalThis.fetch = realFetch;
});
