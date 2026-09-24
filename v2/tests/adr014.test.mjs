// ADR-014a — máy hiểu từng đoạn hình: quy trình thi công chuẩn theo sản phẩm; /hub/viec/doc_khung trả footage + quy trình;
// /hub/doc-khung lưu dòng thời gian (làm sạch); phân tích đoạn lần sau không xoá dòng thời gian; /muc/:id/doc-khung giao máy có mô hình mạnh nhất.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('export default async function x(){}') }, MEDIA: { get: async () => null, put: async () => ({}) } };
let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

test('014a: quy trình thi công theo sản phẩm → việc đọc khung; lưu dòng thời gian làm sạch; không mất khi phân tích lại; giao máy mạnh có mô hình', async () => {
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const yeu = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Ngoc-Han' })).j.ma_ghep).khoa), manh = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await yeu('/hub/trang_thai', 'POST', { may: 'NGOC-HAN', ffmpeg: true, gpu: 'GTX 1650, 4096 MiB', kha_nang: ['dung_video', 'mo_hinh'] });
  await manh('/hub/trang_thai', 'POST', { may: 'Q2', ffmpeg: true, ollama: true, gpu: 'RTX 3070 Ti, 8192 MiB', kha_nang: ['dung_video', 'mo_hinh', 'huan_luyen'] });
  const sp = (await api('/danh-muc/san_pham', 'POST', { ma: 'KCM', ten: 'Keo chít mạch Kingsmen', dong: 'Keo chít mạch', quy_trinh: 'Vệ sinh ron\nTrộn A+B\nBơm keo vào ron\nGạt phẳng\nLau bề mặt\n' })).j.id; assert.ok(sp);
  const mucId = (await api('/muc', 'POST', { tieu_de: 'Ron mốc', dinh_dang: 'VIDEO', san_pham_id: sp })).j.id;
  const ts = (await manh('/hub/tai-san', 'POST', { muc_id: mucId, ten: 'A.mp4', media_url: '/media/media/a.mp4', media_type: 'VIDEO', giay: 12 })).j.id;
  let v = (await manh('/hub/viec/doc_khung?muc_id=' + mucId)).j.viec; assert.equal(v.length, 1); assert.deepEqual(v[0].quy_trinh, ['Vệ sinh ron', 'Trộn A+B', 'Bơm keo vào ron', 'Gạt phẳng', 'Lau bề mặt']); assert.equal(v[0].san_pham, 'Keo chít mạch Kingsmen'); assert.ok(v[0].media_url.startsWith('https://os.kingsmen.vn/media/'));
  // phân tích đoạn trước, đọc khung sau, rồi phân tích đoạn lại → dòng thời gian còn
  await manh('/hub/phan-tich', 'POST', { tai_san_id: ts, phan_tich: { dai: 12, doan: [{ t: 0, net: .8, dong: .2, sang: .5 }] } });
  assert.equal((await manh('/hub/doc-khung', 'POST', { tai_san_id: ts, timeline: [] })).s, 400);
  let r = await manh('/hub/doc-khung', 'POST', { tai_san_id: ts, model: 'qwen2.5vl:7b', so_khung: 12, ms_khung: 2100, may: 'Q2', timeline: [{ tu: 0, den: 4, buoc: 'Bơm keo vào ron', hanh_dong: 'bơm keo', vat_lieu: 'súng bơm, keo A+B', co_canh: 'CAN', tham_my: 6, ro_net: 9 }, { tu: 4, den: 12, buoc: 'Gạt phẳng', co_canh: 'XAU', tham_my: 42, ro_net: 8 }, { tu: 5, den: 3, buoc: 'lỗi' }] });
  assert.equal(r.s, 200); assert.equal(r.j.so_doan, 2, 'đoạn ngược bị bỏ');
  let pt = JSON.parse(DB.raw.prepare(`SELECT phan_tich FROM tai_san WHERE id=?`).get(ts).phan_tich); assert.equal(pt.timeline[1].co_canh, null, 'cỡ cảnh lạ bị bỏ'); assert.equal(pt.timeline[1].tham_my, 10, 'thẩm mỹ kẹp 0–10'); assert.equal(pt.vl.model, 'qwen2.5vl:7b'); assert.equal(pt.doan.length, 1);
  await manh('/hub/phan-tich', 'POST', { tai_san_id: ts, phan_tich: { dai: 12, doan: [{ t: 0, net: .9, dong: .1, sang: .5 }, { t: .5, net: .9, dong: .1, sang: .5 }] } });
  pt = JSON.parse(DB.raw.prepare(`SELECT phan_tich FROM tai_san WHERE id=?`).get(ts).phan_tich); assert.equal(pt.doan.length, 2); assert.equal(pt.timeline.length, 2, 'dòng thời gian không mất');
  assert.equal((await manh('/hub/viec/doc_khung?muc_id=' + mucId)).j.viec.length, 0, 'đã đọc → không đọc lại'); assert.equal((await manh('/hub/viec/doc_khung?muc_id=' + mucId + '&lai=1')).j.viec.length, 1, 'lai=1 → đọc lại');
  r = await api('/muc/' + mucId + '/doc-khung', 'POST', {}); assert.equal(r.s, 200);
  const l = DB.raw.prepare(`SELECT l.tham_so, m.ten FROM tram_lenh l JOIN may_ghep m ON m.id=l.may_id WHERE l.viec='phan_tich_footage' ORDER BY l.created_at DESC LIMIT 1`).get(); assert.equal(l.ten, 'Q2', 'giao máy mạnh có Ollama'); assert.equal(JSON.parse(l.tham_so).doc_khung, true);
  assert.equal((await manh('/hub/script/doc-khung')).s, 200, 'script doc-khung được phát');
});
