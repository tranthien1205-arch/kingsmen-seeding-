// Khoá API dán từ giao diện (24/09): Admin PUT → mã hoá trong D1, phủ lên env cho mọi tuyến; DELETE gỡ; không Admin bị chặn;
// secret Cloudflare (env thật) ưu tiên và không đè được; giá trị không bao giờ lộ ra bootstrap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null;
const api = async (p, method = 'GET', body, tok, e) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), e || env, {}); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;

test('Admin dán ANTHROPIC_API_KEY (không thử) → khoá phủ lên env: san_sang.ai, mô hình claude có khoá; bootstrap không lộ giá trị', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  let b = (await api('/bootstrap')).j.db;
  assert.equal(b.san_sang.ai, false); assert.ok(Array.isArray(b.khoa_api)); assert.equal(b.khoa_api.find(k => k.ten === 'ANTHROPIC_API_KEY').co, false);
  let r = await api('/khoa-api/ANTHROPIC_API_KEY', 'PUT', { gia_tri: 'sk-ant-thu-nghiem-1234abcd', thu: false });
  assert.equal(r.s, 200); b = r.j.db;
  const k = b.khoa_api.find(x => x.ten === 'ANTHROPIC_API_KEY'); assert.equal(k.co, true); assert.equal(k.nguon, 'app'); assert.equal(k.duoi, 'abcd');
  assert.equal(b.san_sang.ai, true); assert.equal(b.ai_nao.mo_hinh.find(m => m.id === 'claude-haiku-4-5').co_khoa, true);
  assert.equal(JSON.stringify(b).includes('sk-ant-thu-nghiem'), false);
  const row = DB.raw.prepare(`SELECT gia_tri FROM khoa_api WHERE ten='ANTHROPIC_API_KEY'`).get(); assert.equal(String(row.gia_tri).includes('sk-ant'), false);
  // lần gọi sau (env mới, cache đã xoá) vẫn thấy khoá
  b = (await api('/bootstrap')).j.db; assert.equal(b.san_sang.ai, true);
});
test('tên khoá lạ / giá trị xấu bị từ chối; người không phải Admin bị chặn', async () => {
  assert.equal((await api('/khoa-api/RAC_KEY', 'PUT', { gia_tri: 'abcdefghij', thu: false })).s, 400);
  assert.equal((await api('/khoa-api/OPENAI_API_KEY', 'PUT', { gia_tri: 'ngan', thu: false })).s, 400);
  assert.equal((await api('/khoa-api/OPENAI_API_KEY', 'PUT', { gia_tri: 'co khoang trang 123456', thu: false })).s, 400);
  await api('/users', 'POST', { ho_ten: 'MKT', email: 'mkt@k.vn', password: '123456', vai_tro: 'MARKETING' });
  const tMkt = (await dangNhap('mkt@k.vn', '123456')).token;
  assert.equal((await api('/khoa-api/OPENAI_API_KEY', 'PUT', { gia_tri: 'sk-abcdefghijkl', thu: false }, tMkt)).s, 403);
  assert.equal((await api('/bootstrap', 'GET', null, tMkt)).j.db.khoa_api, null);
});
test('secret Cloudflare (env thật) ưu tiên: hiện nguồn wrangler, PUT bị từ chối 409; gỡ khoá app → mất', async () => {
  const env2 = { ...env, GOOGLE_TTS_KEY: 'AIza-that-tren-cloudflare-9999' };
  const b = (await api('/bootstrap', 'GET', null, null, env2)).j.db;
  const g = b.khoa_api.find(x => x.ten === 'GOOGLE_TTS_KEY'); assert.equal(g.co, true); assert.equal(g.nguon, 'wrangler'); assert.equal(g.duoi, '');   // khoá wrangler chỉ là cờ, không lộ ký tự nào
  assert.equal(b.khoa_api.find(x => x.ten === 'ANTHROPIC_API_KEY').nguon, 'app');
  assert.equal((await api('/khoa-api/GOOGLE_TTS_KEY', 'PUT', { gia_tri: 'AIza-khac-123456', thu: false }, null, env2)).s, 409);
  const r = await api('/khoa-api/ANTHROPIC_API_KEY', 'DELETE'); assert.equal(r.s, 200);
  assert.equal(r.j.db.san_sang.ai, false); assert.equal(r.j.db.khoa_api.find(x => x.ten === 'ANTHROPIC_API_KEY').co, false);
});
