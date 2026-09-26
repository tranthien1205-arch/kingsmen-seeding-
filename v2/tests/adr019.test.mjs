// ADR-018 — kho mẫu một nguồn (mau_doan) + bộ nhãn hai chiều (bo_nhan): chuyển dữ liệu cũ, thầy gán đủ trường, đề xuất → duyệt / gộp / đổi tên
// kéo theo mọi mẫu, sửa hàng loạt, kiểm ngẫu nhiên do máy chủ quyết, xoá video xoá mẫu, dòng thời gian gửi ra màn / máy dựng đọc từ kho mẫu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let TRA = [];
globalThis.fetch = async (url, opt) => { if (String(url).includes('api.anthropic.com')) { const t = TRA.shift() || '{"nhom":"KHAC","chac":0.3}'; return new Response(JSON.stringify({ content: [{ type: 'text', text: t }], usage: { input_tokens: 1000, output_tokens: 100 } }), { status: 200 }); } return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const anh = { arrayBuffer: async () => new Uint8Array([255, 216, 255, 217]).buffer };
const taoEnv = (DB) => ({ DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async (k) => (k.startsWith('media/') ? anh : null), put: async () => ({}), delete: async () => {} } });
let env; let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const hubK = (k) => async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': k }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const giai = (ma) => JSON.parse(Buffer.from(ma.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
Math.random = () => 0.99;

// ADR-019 — CHẾ ĐỘ AI THAY CHỦ: chủ bật; bài G3 máy chấm ≥ ngưỡng, không lỗi cứng → tự duyệt; dưới ngưỡng vẫn chờ người; hàng lệnh chỉ nhận loại cho phép.
const taoBai = async (mucId, them = {}) => (await api('/noi-dung', 'POST', { muc_id: mucId, dinh_dang: 'VIDEO', tieu_de: 'Bài thử', hook: 'Mạch gạch nhà bạn có đều không?', cta: 'Nhắn tư vấn', sections: [{ label: 'Cảnh 1', text: 'Bơm keo vào khe gạch', hinh: 'thợ bơm keo' }], ...them })).j;
test('019a: tắt → không tự duyệt; bật → bài đạt ngưỡng tự sang Sản xuất, bài dưới ngưỡng chờ người; chỉ người bật được', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const muc = async (t) => (await api('/muc', 'POST', { tieu_de: t, dinh_dang: 'VIDEO' })).j.id;
  const m1 = await muc('Mục 1'); const b1 = await taoBai(m1); const nd1 = (b1.db.noi_dung.find((x) => x.muc_id === m1) || {}).id || b1.id;
  await api('/noi-dung/' + nd1 + '/gui-duyet', 'POST', {});
  assert.equal(DB.raw.prepare(`SELECT trang_thai FROM duyet WHERE doi_tuong_id=?`).get(nd1).trang_thai, 'CHO', 'chế độ tắt: vẫn chờ người');
  const g = (await api('/thay-chu')).j; assert.equal(g.cau_hinh.bat, false); assert.equal(g.cho_duyet.length, 1);
  const bat = (await api('/thay-chu', 'PATCH', { bat: true, diem_toi_thieu: 90 })).j; assert.equal(bat.cau_hinh.bat, true); assert.equal(bat.vua_chay.so, 1, 'bật xong xử lý luôn bài đang chờ');
  const d1 = DB.raw.prepare(`SELECT trang_thai, quyet_boi FROM duyet WHERE doi_tuong_id=?`).get(nd1); assert.equal(d1.trang_thai, 'DUYET'); assert.equal(d1.quyet_boi, 'AI thay chủ');
  assert.equal(DB.raw.prepare(`SELECT giai_doan FROM muc_noi_dung WHERE id=?`).get(m1).giai_doan, 'SAN_XUAT');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc WHERE buoc='B5'`).get().n, 0, 'AI tự duyệt không thành mẫu học B5');
  // bài mới gửi khi đang bật → duyệt ngay
  const m2 = await muc('Mục 2'); const b2 = await taoBai(m2); const nd2 = b2.db.noi_dung.find((x) => x.muc_id === m2).id;
  await api('/noi-dung/' + nd2 + '/gui-duyet', 'POST', {}); assert.equal(DB.raw.prepare(`SELECT trang_thai FROM duyet WHERE doi_tuong_id=?`).get(nd2).trang_thai, 'DUYET');
  // dưới ngưỡng (cảnh thiếu gợi ý hình → 95 < 100) → chờ người
  await api('/thay-chu', 'PATCH', { diem_toi_thieu: 100 });
  const m3 = await muc('Mục 3'); const b3 = await taoBai(m3, { sections: [{ label: 'Cảnh 1', text: 'Bơm keo' }] }); const nd3 = b3.db.noi_dung.find((x) => x.muc_id === m3).id;
  await api('/noi-dung/' + nd3 + '/gui-duyet', 'POST', {}); assert.equal(DB.raw.prepare(`SELECT trang_thai FROM duyet WHERE doi_tuong_id=?`).get(nd3).trang_thai, 'CHO');
  assert.equal((await api('/thay-chu', 'PATCH', { diem_toi_thieu: 20 })).j.cau_hinh.diem_toi_thieu, 70, 'ngưỡng không dưới 70');
  const nk = (await api('/thay-chu')).j.nhat_ky; assert.ok(nk.some((x) => /AI thay chủ · duyệt/.test(x.action)));
});
test('019b: hàng lệnh AI thay chủ chỉ nhận loại cho phép; giao dựng qua đúng đường app; tắt thì không chạy', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa); await may('/hub/trang_thai', 'POST', { may: 'Q2', kha_nang: ['dung_video'] });
  const m = (await api('/muc', 'POST', { tieu_de: 'Mục dựng', dinh_dang: 'VIDEO' })).j.id; const nd = (await taoBai(m)).db.noi_dung.find((x) => x.muc_id === m).id;
  await api('/thay-chu', 'PATCH', { bat: true }); await api('/noi-dung/' + nd + '/gui-duyet', 'POST', {});
  const lenh = [{ loai: 'dung', noi_dung_id: nd }, { loai: 'xoa_du_lieu' }, { loai: 'chay_agent', agent: 'KHONG_CO' }];
  DB.raw.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at) VALUES ('lenh_thay_chu', ?, '2026-09-26')`).run(JSON.stringify({ lenh }));
  let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p;
  const kq = JSON.parse(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='lenh_thay_chu_kq'`).get().cau_hinh).lan[0].kq.map((x) => x.join(': ')).join(' | ');
  assert.match(kq, /giao dựng · (đã có lệnh )?tl_/); assert.match(kq, /xoa_du_lieu: bỏ: loại lệnh không cho phép/); assert.match(kq, /KHONG_CO: bỏ: không có agent/);
  assert.equal(JSON.parse(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='lenh_thay_chu'`).get().cau_hinh).lenh.length, 0, 'lệnh đã làm thì rời hàng');
  await api('/thay-chu', 'PATCH', { bat: false }); DB.raw.prepare(`UPDATE module_config SET cau_hinh=? WHERE id='lenh_thay_chu'`).run(JSON.stringify({ lenh: [{ loai: 'dung', noi_dung_id: nd }] }));
  await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p;
  assert.equal(JSON.parse(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='lenh_thay_chu'`).get().cau_hinh).lenh.length, 1, 'tắt thì lệnh nằm yên');
});
test('kho footage theo dòng: nạp Drive loại footage → kho của dòng + lệnh nap_drive; nguồn học hiện "đang học"; dựng lấy clip từ kho cùng dòng', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa); await may('/hub/trang_thai', 'POST', { may: 'Q2', kha_nang: ['dung_video'] });
  await api('/bo-nhan', 'POST', { truong: 'dong', ten: 'Keo chít mạch', mo_ta: 'Kingsmen' });
  const link = 'https://drive.google.com/drive/folders/1wvkEsb_hZdQVyKh0AD0WuzM6lqGTeCU7';
  assert.equal((await api('/lop-hoc/nap', 'POST', { nap: link, loai_nap: 'FOOTAGE' })).s, 400, 'footage phải chọn dòng');
  const r = (await api('/lop-hoc/nap', 'POST', { nap: link, loai_nap: 'FOOTAGE', dong: 'Keo chít mạch' })).j; assert.equal(r.loai, 'FOOTAGE'); assert.equal(r.kho, 'kho_ft_keo_chit_mach'); assert.equal(r.toi_da, 200);
  const l = DB.raw.prepare(`SELECT tham_so FROM tram_lenh WHERE id=?`).get(r.lenh_id); assert.deepEqual(JSON.parse(l.tham_so), { muc_id: 'kho_ft_keo_chit_mach', folder_id: '1wvkEsb_hZdQVyKh0AD0WuzM6lqGTeCU7', toi_da: 200, kho_dong: 'Keo chít mạch' });
  const kho = DB.raw.prepare(`SELECT giai_doan, dong, dinh_dang FROM muc_noi_dung WHERE id='kho_ft_keo_chit_mach'`).get(); assert.equal(kho.giai_doan, 'KHO'); assert.equal(kho.dong, 'Keo chít mạch'); assert.equal(kho.dinh_dang, null);
  const nh = (await api('/nguon-hoc')).j.nguon.find((g) => g.dang_hoc); assert.ok(nh && /Kho footage — Keo chít mạch/.test(nh.ten), 'nguồn đang học hiện ngay');
  // máy nạp một clip vào kho → bài VIDEO cùng dòng thấy clip khi dựng
  await may('/hub/tai-san', 'POST', { muc_id: 'kho_ft_keo_chit_mach', ten: 'van-de-1.mp4', thu_muc: '/1. SOURCE VẤN ĐỀ', media_url: '/media/van-de-1.mp4', media_type: 'VIDEO', nguon: 'DRIVE' });
  const m = (await api('/muc', 'POST', { tieu_de: 'Keo chít mạch — video thử', dinh_dang: 'VIDEO' })).j.id;
  const nd = (await api('/noi-dung', 'POST', { muc_id: m, dinh_dang: 'VIDEO', hook: 'Mạch gạch ố?', cta: 'Nhắn tư vấn', sections: [{ text: 'Vấn đề', hinh: 'ron ố' }] })).j.db.noi_dung.find((x) => x.muc_id === m).id;
  await api('/thay-chu', 'PATCH', { bat: true }); await api('/noi-dung/' + nd + '/gui-duyet', 'POST', {});
  const v = (await may('/hub/viec/dung_video?noi_dung_id=' + nd)).j; const ts = (v.viec || v.ds || v)[0] || v; const clip = JSON.stringify(v);
  assert.match(clip, /van-de-1\.mp4/, 'dựng thấy clip trong kho footage cùng dòng');
});
test('lệnh hoc_tiktok: Trạm im thì bỏ và ghi lý do; dòng lạ thì bỏ', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  await api('/thay-chu', 'PATCH', { bat: true });
  DB.raw.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at) VALUES ('lenh_thay_chu', ?, '2026-09-26')`).run(JSON.stringify({ lenh: [{ loai: 'hoc_tiktok', kenh: 'https://www.tiktok.com/@keokingsmen.com?_r=1', muc_dich: 'BRAND' }, { loai: 'hoc_tiktok', kenh: '@abc', dong: 'Dòng bịa' }] }));
  let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p;
  const kq = JSON.parse(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='lenh_thay_chu_kq'`).get().cau_hinh).lan[0].kq.map((x) => x.join(': ')).join(' | ');
  assert.match(kq, /keokingsmen\.com.*bỏ: Trạm văn phòng đang im/); assert.match(kq, /@abc: bỏ: dòng không có trong Bộ nhãn/);
});
test('Reels Facebook: Trạm gửi danh sách reel → máy học nhận lệnh hoc_thanh_pham nguồn REELS (bỏ trùng, bỏ link lạ); ô nạp nhận link fanpage', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa); await may('/hub/trang_thai', 'POST', { may: 'Q2', kha_nang: ['dung_video'] });
  assert.equal((await api('/lop-hoc/nap', 'POST', { nap: 'https://www.facebook.com/KeoKingsmen', chi_nhan: true })).j.loai, 'REELS');
  assert.equal((await api('/lop-hoc/nap', 'POST', { nap: 'https://www.facebook.com/KeoKingsmen' })).s, 409, 'Trạm im → báo rõ');
  const r = (await may('/hub/reels-da-tai', 'POST', { trang: 'KeoKingsmen', links: [{ link: 'https://www.facebook.com/reel/111', meta: { luot_xem: 1200 } }, { link: 'https://www.facebook.com/reel/111' }, { link: 'https://www.facebook.com/reel/222' }, { link: 'https://example.com/x' }] })).j;
  assert.equal(r.giao, true); assert.equal(r.so, 2);
  const ts = JSON.parse(DB.raw.prepare(`SELECT tham_so FROM tram_lenh WHERE id=?`).get(r.lenh_id).tham_so); assert.equal(ts.nguon, 'REELS'); assert.equal(ts.kenh, 'fb/KeoKingsmen'); assert.equal(ts.links[0].meta.luot_xem, 1200);
  assert.equal((await may('/hub/reels-da-tai', 'POST', { trang: 'KeoKingsmen', links: [], loi: 'checkpoint' })).j.giao, false);
});
