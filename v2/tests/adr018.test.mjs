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

test('018a: chuyển dữ liệu cũ vào mau_doan — nhãn người, thầy, kiểm, source, câu thoại; chạy lại vô hại', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  await api('/danh-muc/san_pham', 'POST', { ma: 'F', ten: 'Finex', dong: 'Finex', quy_trinh: 'Lăn lót\nTrát' });
  // dữ liệu kiểu cũ (trước 018): nhãn nằm trong phan_tich.timeline, mẫu nhan_khung / doc_loi / chat_luong_source ở mau_hoc_ai
  const tl = [{ tu: 0, den: 3, nhom: 'THI_CONG', buoc: 'Trát', nguoi: 'Thiện', nguoi_luc: '2026-09-25T01:00:00Z', may: { nhom: 'THI_CONG', buoc: 'Lăn lót' }, thay: { nhom: 'THI_CONG', buoc: 'Trát', chac: 0.8 }, mo_ta_nguoi: 'trát lớp 2', source_nguoi: { dung: false, ly_do: ['mờ'] } },
    { tu: 3, den: 6, nhom: 'HOAN_THIEN', thay: { nhom: 'HOAN_THIEN', chac: 0.4 }, mo: { nhom: 'THI_CONG' }, can_xac_nhan: true, kiem_ngau_nhien: false }, { tu: 6, den: 9, khong_ro: true, nguoi: 'Thiện' }];
  DB.raw.prepare(`INSERT INTO kho_thanh_pham (id, ten, nguon, nguon_id, dai, so_shot, phan_tich, created_at, dong, link) VALUES ('tp1','v.mp4','TIKTOK','v',9,2,?, '2026-09-24', 'Finex', 'https://tt/v')`).run(JSON.stringify({ shots: [{ t0: 0, t1: 9, loi: 'trát lớp hai' }], timeline: tl }));
  DB.raw.prepare(`INSERT INTO mau_hoc_ai (id, tinh_nang, doi_tuong, doi_tuong_id, dau_vao, dau_ra, nhan, dong, created_at, cham_at, cham_boi) VALUES ('m1','doc_loi','kho_thanh_pham','tp1',?,?,?,'Finex','2026-09-24','2026-09-25','Thiện')`).run(JSON.stringify({ text: 'trát lớp hai cho phẳng', dai: 4, vi_tri: 0 }), JSON.stringify({ thay: { nhom: 'THI_CONG', chac: 0.9 } }), JSON.stringify({ nhom: 'THI_CONG', buoc: 'Trát', nguon: 'NGUOI', hinh: { nhom: 'THI_CONG' } }));
  DB.raw.prepare(`INSERT INTO mau_hoc_ai (id, tinh_nang, doi_tuong, doi_tuong_id, dau_vao, nhan, created_at) VALUES ('m2','nhan_khung','kho_thanh_pham','tp1','{"i":0,"ngau_nhien":true}','{}','2026-09-24')`).run();
  // lần chạm kho mẫu đầu tiên trên một D1 mới → chuyển (dùng đối tượng DB mới để mô phỏng một lần khởi động worker)
  env = taoEnv({ ...DB, raw: DB.raw }); DB.raw.prepare(`DELETE FROM module_config WHERE id='mau_doan'`).run(); DB.raw.prepare(`DELETE FROM mau_doan`).run();
  const k = (await api('/kho-mau?kn=K1')).j; assert.deepEqual(k.dem, { VANG: 1, KHONG_CHAC: 1, KHONG_RO: 1 });
  const r0 = DB.raw.prepare(`SELECT * FROM mau_doan WHERE id='H:tp1:0'`).get(); const ng = JSON.parse(r0.nhan_nguoi);
  assert.equal(ng.buoc, 'Trát'); assert.equal(ng.mo_ta, 'trát lớp 2'); assert.equal(r0.nguoi_ten, 'Thiện'); assert.equal(JSON.parse(r0.nhan_mo).buoc, 'Lăn lót', 'nhãn máy trước khi người sửa'); assert.equal(r0.kiem, 1, 'cờ kiểm từ mẫu cũ'); assert.equal(JSON.parse(r0.nguoi_source).dung, false);
  assert.equal(JSON.parse(DB.raw.prepare(`SELECT phan_tich FROM kho_thanh_pham`).get().phan_tich).timeline, undefined, 'timeline gỡ khỏi phan_tich');
  const l = DB.raw.prepare(`SELECT * FROM mau_doan WHERE loai='LOI'`).all(); assert.equal(l.length, 1); assert.equal(l[0].trang_thai, 'VANG'); assert.equal(JSON.parse(l[0].nhan_nguoi).buoc, 'Trát'); assert.equal(l[0].nguoi_ten, 'Thiện');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang IN ('nhan_khung','doc_loi')`).get().n, 0, 'mẫu cũ không còn song song');
  // chạy lại (worker khởi động lại) → không nhân đôi, không mất
  env = taoEnv({ ...DB, raw: DB.raw }); assert.deepEqual((await api('/kho-mau?kn=K1')).j.dem, { VANG: 1, KHONG_CHAC: 1, KHONG_RO: 1 });
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_doan`).get().n, 4);
  // màn đọc dòng thời gian từ kho mẫu (bootstrap gắn vào footage; máy dựng nhận qua /hub/viec/dung_video)
  const d = (await api('/do-chinh-xac')).j; assert.equal(d.so_nhan, 1); assert.equal(d.theo_truong.buoc.thay_dung, 1); assert.equal(d.dem.k1, 1);
});

test('018b: thầy gán đủ trường theo bộ nhãn → đề xuất; duyệt / gộp / đổi tên kéo theo mẫu; sửa hàng loạt; xoá video xoá mẫu', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  const sp = (await api('/danh-muc/san_pham', 'POST', { ma: 'F', ten: 'Finex', dong: 'Finex', quy_trinh: 'Lăn lót\nTrát' })).j.id;
  let bn = (await api('/bo-nhan')).j; assert.ok(bn.truong.some((t) => t.k === 'dung_cu')); assert.ok(bn.gia_tri.some((x) => x.truong === 'dung_cu' && x.ten === 'bay răng')); assert.ok(bn.gia_tri.some((x) => x.truong === 'buoc' && x.ten === 'Trát' && x.dong === 'Finex'), 'bước lấy từ quy trình sản phẩm');
  TRA = ['{"nhom":"THI_CONG","buoc":"trát","bai_test":null,"hanh_dong":["Gạt","xoa nền"],"vat_lieu":["vữa đặc biệt","sơn epoxy hiệu ứng hạt cát FINEX F300"],"dung_cu":["Bay Răng","dao lam"],"vi_tri":"sàn nhà tắm","nguoi":"thợ","co_canh":"cận thao tác","goc_may":"từ trên xuống","chuyen_dong":"bay bổng","tham_my":-1,"dung_cho":"minh hoạ lời","chac":0.85,"mo_ta":"thợ gạt Finex","ly_do":"bay trên nền"}'];
  const r = await may('/hub/thay-doc', 'POST', { dong: 'Finex', san_pham: 'Finex', doan: [{ anh: ['/media/media/a.jpg'] }] }); const n = r.j.kq[0].nhan;
  assert.equal(n.buoc, 'Trát', 'chuẩn hoá theo quy trình (hoa/thường)'); assert.deepEqual(n.hanh_dong, ['gạt', 'xoa nền']); assert.deepEqual(n.vat_lieu, ['vữa đặc biệt', 'Finex F300'], 'tên dài theo luật chuẩn → tên chuẩn, không thành đề xuất'); assert.deepEqual(n.dung_cu, ['bay răng', 'dao lam']); assert.equal(n.co_canh, 'THAO_TAC', 'tên cỡ cảnh → mã'); assert.equal(n.chuyen_dong, null, 'giá trị cố định lạ bị bỏ'); assert.equal(n.tham_my, null); assert.equal(n.nguoi, 'thợ');
  bn = (await api('/bo-nhan')).j; const dx = bn.de_xuat.map((x) => x.truong + ':' + x.ten).sort(); assert.deepEqual(dx, ['dung_cu:dao lam', 'hanh_dong:xoa nền', 'vat_lieu:vữa đặc biệt'], 'thứ thầy thấy mà bộ nhãn chưa có → đề xuất');
  // footage có nhãn thầy chi tiết
  const muc = (await api('/muc', 'POST', { tieu_de: 'x', dinh_dang: 'VIDEO', san_pham_id: sp })).j.id;
  const ts = (await may('/hub/tai-san', 'POST', { muc_id: muc, ten: 'A.mp4', media_url: '/media/media/a.mp4', media_type: 'VIDEO', giay: 6 })).j.id;
  await may('/hub/doc-khung', 'POST', { tai_san_id: ts, timeline: [{ tu: 0, den: 3, nhom: 'THI_CONG', thay: { ...n, dung_cu: ['dao lam'] } }, { tu: 3, den: 6, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', buoc: 'Lăn lót', dung_cu: ['dao lam', 'con lăn'], chac: 0.9 } }] });
  // gộp "dao lam" vào "bay răng": mọi mẫu chuyển theo
  const inox = bn.de_xuat.find((x) => x.ten === 'dao lam'); assert.equal(inox.so_mau, 0);
  let g = await api('/bo-nhan/' + inox.id + '/gop', 'POST', { vao: 'bay răng' }); assert.equal(g.s, 200); assert.equal(g.j.mau_chuyen, 2);
  assert.deepEqual(JSON.parse(DB.raw.prepare(`SELECT nhan_thay FROM mau_doan WHERE id=?`).get('H:' + ts + ':1').nhan_thay).dung_cu, ['bay răng', 'con lăn']);
  // duyệt đề xuất vật liệu; đề xuất bước → vào quy trình sản phẩm
  const vl = g.j.de_xuat.find((x) => x.ten === 'vữa đặc biệt'); g = await api('/bo-nhan/' + vl.id + '/duyet', 'POST', {}); assert.ok(g.j.gia_tri.some((x) => x.ten === 'vữa đặc biệt' && x.trang_thai === 'DUNG'));
  await api('/mau-doan/' + encodeURIComponent('H:' + ts + ':0'), 'POST', { nhan: { nhom: 'THI_CONG', buoc: 'Vệ sinh nền', dung_cu: ['bay răng'] } });
  const bb = (await api('/bo-nhan')).j.de_xuat.find((x) => x.truong === 'buoc'); assert.equal(bb.ten, 'Vệ sinh nền'); assert.equal(bb.nguon, 'NGUOI'); assert.equal(bb.dong, 'Finex');
  g = await api('/bo-nhan/' + bb.id + '/duyet', 'POST', {}); assert.equal(g.s, 200); assert.deepEqual(DB.raw.prepare(`SELECT quy_trinh FROM san_pham`).get().quy_trinh.split('\n'), ['Lăn lót', 'Trát', 'Vệ sinh nền']);
  // đổi tên giá trị: mẫu đổi theo
  const lan = (await api('/bo-nhan')).j.gia_tri.find((x) => x.truong === 'dung_cu' && x.ten === 'con lăn'); g = await api('/bo-nhan/' + lan.id + '/doi-ten', 'POST', { ten: 'con lăn sơn' });
  assert.deepEqual(JSON.parse(DB.raw.prepare(`SELECT nhan_thay FROM mau_doan WHERE id=?`).get('H:' + ts + ':1').nhan_thay).dung_cu, ['bay răng', 'con lăn sơn']);
  // thêm giá trị tay; trường cố định không thêm được
  assert.equal((await api('/bo-nhan', 'POST', { truong: 'vi_tri', ten: 'hồ bơi' })).s, 200); assert.equal((await api('/bo-nhan', 'POST', { truong: 'goc_may', ten: 'chéo' })).s, 400);
  // sửa hàng loạt: chấp nhận nhãn thầy cho đoạn 1; đặt vị trí cho cả hai
  let hl = await api('/mau-doan/hang-loat', 'POST', { ids: ['H:' + ts + ':1'], lay_thay: true }); assert.equal(hl.j.so, 1);
  assert.equal(DB.raw.prepare(`SELECT trang_thai FROM mau_doan WHERE id=?`).get('H:' + ts + ':1').trang_thai, 'VANG');
  hl = await api('/mau-doan/hang-loat', 'POST', { ids: ['H:' + ts + ':0', 'H:' + ts + ':1'], truong: 'vi_tri', gia_tri: 'hồ bơi' }); assert.equal(hl.j.so, 2);
  assert.equal(JSON.parse(DB.raw.prepare(`SELECT nhan_nguoi FROM mau_doan WHERE id=?`).get('H:' + ts + ':0').nhan_nguoi).vi_tri, 'hồ bơi');
  // kho mẫu lọc theo trạng thái, tìm theo nhãn chi tiết; dòng thời gian gửi màn đọc từ kho mẫu
  assert.equal((await api('/kho-mau?kn=K1&q=' + encodeURIComponent('con lăn sơn'))).j.loc, 1);
  const tsDb = (await api('/bootstrap')).j.db.tai_san.find((x) => x.id === ts); assert.equal(tsDb.phan_tich.timeline.length, 2); assert.equal(tsDb.phan_tich.timeline[0].buoc, 'Vệ sinh nền', 'nhãn người thắng');
  // xoá footage → mẫu của nó đi theo
  assert.equal((await api('/tai-san/' + ts, 'DELETE')).s, 200); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE doi_tuong_id=?`).get(ts).n, 0);
});

test('018c: tỉ lệ kiểm tự tăng khi thầy yếu ở một trường', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await may('/hub/thanh-pham', 'POST', { ten: 'a.mp4', nguon_id: 'a', nguon: 'TIKTOK', dai: 60, shots: [{ t0: 0, t1: 30 }, { t0: 30, t1: 60 }], timeline: Array.from({ length: 30 }, (_, i) => ({ tu: i * 2, den: i * 2 + 2, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', vi_tri: 'bếp', chac: 0.9 } })) });
  const tp = DB.raw.prepare(`SELECT id FROM kho_thanh_pham`).get().id;
  for (let i = 0; i < 25; i++) await api('/mau-doan/' + encodeURIComponent('H:' + tp + ':' + i), 'POST', { nhan: { nhom: 'THI_CONG', vi_tri: i < 20 ? 'tường' : 'bếp' } });
  const d = (await api('/do-chinh-xac')).j; assert.deepEqual(d.truong_yeu, ['vi_tri'], 'vị trí thầy đúng 5/25 < 85%');
  Math.random = () => 0.15;   // 0,15: dưới 20% (trường yếu) nhưng trên 8%
  await may('/hub/thanh-pham', 'POST', { ten: 'b.mp4', nguon_id: 'b', nguon: 'TIKTOK', dai: 4, shots: [{ t0: 0, t1: 2 }, { t0: 2, t1: 4 }], timeline: [{ tu: 0, den: 2, nhom: 'KHAC', thay: { nhom: 'KHAC', chac: 0.9 } }, { tu: 2, den: 4, nhom: 'KHAC', thay: { nhom: 'KHAC', vi_tri: 'bếp', chac: 0.9 } }] });
  const tp2 = DB.raw.prepare(`SELECT id FROM kho_thanh_pham WHERE nguon_id='b'`).get().id;
  assert.equal(DB.raw.prepare(`SELECT trang_thai FROM mau_doan WHERE id=?`).get('H:' + tp2 + ':0').trang_thai, 'THAY_CHOT', 'không có trường yếu → 8%');
  assert.equal(DB.raw.prepare(`SELECT trang_thai FROM mau_doan WHERE id=?`).get('H:' + tp2 + ':1').trang_thai, 'KIEM', 'có trường thầy yếu → 20%');
  Math.random = () => 0.99;
});

test('018d: bản xem 360p cho video đã đăng + /media tua được (206)', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa); await may('/hub/trang_thai', 'POST', { may: 'Q2', ffmpeg: true, kha_nang: ['dung_video'] });
  const body = { ten: 'a.mp4', nguon_id: 'a.mp4', nguon: 'TIKTOK', link: 'https://www.tiktok.com/@x/video/1', dai: 10, shots: [{ t0: 0, t1: 5, loi: 'câu một đủ dài' }, { t0: 5, t1: 10 }], timeline: [{ tu: 0, den: 10, nhom: 'KHAC', thay: { nhom: 'KHAC', chac: 0.9 } }] };
  await may('/hub/thanh-pham', 'POST', body); await may('/hub/thanh-pham', 'POST', { ...body, ten: 'b.mp4', nguon_id: 'b.mp4', proxy_url: '/media/media/b360.mp4' });
  const tp = (n) => DB.raw.prepare(`SELECT id, proxy_url FROM kho_thanh_pham WHERE nguon_id=?`).get(n);
  assert.equal(tp('b.mp4').proxy_url, '/media/media/b360.mp4'); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE doi_tuong_id=? AND media_url='/media/media/b360.mp4'`).get(tp('b.mp4').id).n, 2, 'đoạn hình + câu thoại đều có bản xem');
  // video cũ chưa có bản xem → giao máy Q2 một lệnh chỉ tạo bản xem
  const g = await api('/kho-thanh-pham/tao-proxy', 'POST', {}); assert.equal(g.j.so, 2, 'a thiếu bản xem + ảnh đoạn, b chỉ thiếu ảnh đoạn'); const l = JSON.parse(DB.raw.prepare(`SELECT tham_so FROM tram_lenh WHERE viec='hoc_thanh_pham'`).get().tham_so);
  const la = l.ds_proxy.find((x) => x.nguon_id === 'a.mp4'), lb = l.ds_proxy.find((x) => x.nguon_id === 'b.mp4');
  assert.equal(l.chi_proxy, true); assert.equal(la.link, 'https://www.tiktok.com/@x/video/1'); assert.equal(la.can_proxy, true); assert.equal(lb.can_proxy, false); assert.deepEqual(lb.doan, [{ i: 0, tu: 0, den: 10 }], 'đoạn thiếu ảnh để máy cắt bù');
  assert.equal((await may('/hub/thanh-pham/proxy', 'POST', { nguon_id: 'a.mp4', proxy_url: '/media/media/a360.mp4' })).j.so_mau, 2);
  assert.equal((await api('/kho-mau?kn=K4&tt=')).j.hang.find((x) => x.doi_tuong_id === tp('a.mp4').id).media_url, '/media/media/a360.mp4');
  // học lại giữ bản xem
  await may('/hub/thanh-pham', 'POST', { ...body, lam_lai: true }); assert.equal(tp('a.mp4').proxy_url, '/media/media/a360.mp4');
  // cron tự giao lệnh bản xem cho video còn thiếu (không trùng khi đang có lệnh, không lặp trong 6 giờ)
  await may('/hub/thanh-pham', 'POST', { ...body, ten: 'c.mp4', nguon_id: 'c.mp4', link: 'https://www.tiktok.com/@x/video/3' }); DB.raw.prepare("UPDATE tram_lenh SET trang_thai='XONG'").run();
  const cron = async () => { let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p; };
  await cron(); await cron(); const ls = DB.raw.prepare("SELECT tham_so FROM tram_lenh WHERE trang_thai='CHO'").all(); assert.equal(ls.length, 1, 'một lệnh'); const dc = JSON.parse(ls[0].tham_so).ds_proxy; assert.ok(dc.find((x) => x.nguon_id === 'c.mp4').can_proxy, 'video mới thiếu bản xem'); assert.equal(dc.find((x) => x.nguon_id === 'b.mp4').can_proxy, false);
  // máy cắt xong ảnh đoạn → gửi về; thầy đọc bù đoạn có ảnh mà nhãn thầy thiếu trường; hết trần thì dừng và báo
  const idB = tp('b.mp4').id; assert.equal((await may('/hub/mau-doan/anh', 'POST', { doi_tuong_id: idB, anh: [{ i: 0, url: '/media/media/dai-b0.jpg' }, { i: 7, url: '/media/media/x.jpg' }] })).j.so, 1);
  let bu = (await api('/thay/bu')).j; assert.equal(bu.cho, 1, 'đoạn b0: có ảnh, nhãn thầy cũ thiếu trường');
  TRA = ['{"nhom":"KHAC","hanh_dong":["đo"],"dung_cu":["thước dây"],"nguoi":"không có","co_canh":"CHU","goc_may":"từ trên xuống","chuyen_dong":"đứng yên","dung_cho":"minh hoạ lời","chac":0.9,"mo_ta":"đồ hoạ đo"}'];
  const r0 = await api('/thay/doc-bu', 'POST', {}); assert.equal(r0.j.so, 1); const nt = JSON.parse(DB.raw.prepare('SELECT nhan_thay FROM mau_doan WHERE id=?').get('H:' + idB + ':0').nhan_thay); assert.equal(nt.goc_may, 'từ trên xuống'); assert.deepEqual(nt.dung_cu, ['thước dây']);
  assert.equal(r0.j.bu.cho, 0, 'đọc rồi không đọc lại');
  DB.raw.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at) VALUES ('ai', ?, '')`).run(JSON.stringify({ ngan_sach_thay_usd: 0.0001 })); assert.equal((await api('/thay/bu')).j.het_tran, true, 'báo hết trần thầy');
  // /media trả 206 khi có Range
  const buf = new Uint8Array(1000); env.MEDIA.get = async (k, o) => ({ body: buf.slice(100, 200), size: 1000, range: o && o.range ? { offset: 100, length: 100 } : undefined, httpMetadata: { contentType: 'video/mp4' } });
  const r = await worker.fetch(new Request('https://x/media/media/a360.mp4', { headers: { Range: 'bytes=100-199' } }), env, { waitUntil() {} });
  assert.equal(r.status, 206); assert.equal(r.headers.get('content-range'), 'bytes 100-199/1000'); assert.equal(r.headers.get('accept-ranges'), 'bytes');
});

test('018e: dòng chưa có sản phẩm vẫn duyệt được bước; thêm dòng; duyệt / bỏ hàng loạt; đếm mẫu theo dòng', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  // như prod 26/09: Danh mục trống, video Terrazo + Finex, thầy gán bước "Pha trộn vật liệu" ở cả hai dòng
  const tl = (n) => Array.from({ length: n }, (_, i) => ({ tu: i * 2, den: i * 2 + 2, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', buoc: 'Pha trộn vật liệu', vat_lieu: ['bột màu'], chac: 0.9 } }));
  await may('/hub/thanh-pham', 'POST', { ten: 't.mp4', nguon_id: 't', nguon: 'TIKTOK', dai: 6, dong: 'Terrazo', shots: [{ t0: 0, t1: 3 }, { t0: 3, t1: 6 }], timeline: tl(3) });
  await may('/hub/thanh-pham', 'POST', { ten: 'f.mp4', nguon_id: 'f', nguon: 'TIKTOK', dai: 2, dong: 'Sàn gỗ', mot_canh: true, shots: [{ t0: 0, t1: 2 }], timeline: tl(1) });
  let bn = (await api('/bo-nhan')).j; const dx = bn.de_xuat.filter((x) => x.ten === 'Pha trộn vật liệu');
  assert.deepEqual(dx.map((x) => x.dong + ':' + x.so_mau).sort(), ['Sàn gỗ:1', 'Terrazo:3'], 'mẫu dùng đếm theo đúng dòng'); assert.deepEqual(bn.dongs, ['Terrazy', 'Finex F300', 'Keo chít mạch', 'Sàn gỗ', 'Terrazo'], 'một danh sách dòng: ba dòng đăng ký trước, rồi dòng từ mẫu'); assert.match(bn.dong_ct.find((x) => x.dong === 'Finex F300').mo_ta, /^Finex · /);
  const t = dx.find((x) => x.dong === 'Terrazo'); const r = await api('/bo-nhan/' + t.id + '/duyet', 'POST', {}); assert.equal(r.s, 200, 'không còn lỗi "chưa có sản phẩm"');
  assert.ok(r.j.gia_tri.some((x) => x.truong === 'buoc' && x.ten === 'Pha trộn vật liệu' && x.dong === 'Terrazo' && x.trang_thai === 'DUNG'));
  assert.ok(r.j.de_xuat.some((x) => x.ten === 'Pha trộn vật liệu' && x.dong === 'Sàn gỗ'), 'đề xuất của dòng khác vẫn còn');
  // thầy lần sau thấy bước này trong quy trình Terrazo → không đề xuất lại
  await may('/hub/thanh-pham', 'POST', { ten: 't2.mp4', nguon_id: 't2', nguon: 'TIKTOK', dai: 6, dong: 'Terrazo', shots: [{ t0: 0, t1: 3 }, { t0: 3, t1: 6 }], timeline: tl(3) });
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM bo_nhan WHERE truong='buoc' AND dong='Terrazo' AND trang_thai='DE_XUAT'`).get().n, 0);
  // thêm bước tay cho dòng chưa có sản phẩm; thêm dòng mới
  assert.equal((await api('/bo-nhan', 'POST', { truong: 'buoc', ten: 'Cán phẳng', dong: 'Terrazo' })).s, 200);
  const d = await api('/bo-nhan', 'POST', { truong: 'dong', ten: 'Keo chít mạch' }); assert.ok(d.j.dongs.includes('Keo chít mạch'));
  assert.ok((await api('/dong-san-pham')).j.dong.some((x) => x.dong === 'Keo chít mạch'), 'màn Dòng sản phẩm thấy dòng mới');
  // hàng loạt
  bn = (await api('/bo-nhan')).j; const vl = bn.de_xuat.filter((x) => x.truong === 'vat_lieu').map((x) => x.id); assert.equal(vl.length, 2);
  const h = await api('/bo-nhan/hang-loat', 'POST', { ids: vl, hanh: 'duyet' }); assert.equal(h.j.so, 2); assert.equal(h.j.de_xuat.filter((x) => x.truong === 'vat_lieu').length, 0);
  const h2 = await api('/bo-nhan/hang-loat', 'POST', { ids: h.j.de_xuat.map((x) => x.id), hanh: 'bo' }); assert.equal(h2.j.de_xuat.length, 0);
});

test('018f: quy trình chuẩn sàn tự phẳng (Terrazy / Finex) + chuẩn hoá bước cũ bằng Haiku + dọn đề xuất bước', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  const bn = (await api('/bo-nhan')).j; const qt = bn.gia_tri.filter((x) => x.truong === 'buoc' && x.dong === 'Terrazy').map((x) => x.ten);
  assert.deepEqual(qt, ['Kiểm tra và chuẩn bị nền', 'Tạo nhám', 'Trám và vệ sinh bề mặt', 'Thi công lớp lót (primer)', 'Trộn vật liệu', 'Thi công lớp phủ (đổ và cán)', 'Lăn gai chỉnh bề mặt', 'Bảo vệ chờ khô'], '8 bước đúng thứ tự khi Danh mục chưa khai');
  assert.ok(bn.gia_tri.some((x) => x.truong === 'dung_cu' && x.ten === 'con lăn gai'));
  assert.deepEqual(bn.gia_tri.filter((x) => x.truong === 'buoc' && x.dong === 'Keo chít mạch').map((x) => x.ten), ['Chuẩn bị và vệ sinh khe ron', 'Bơm keo vào khe gạch', 'Miết ron tạo bề mặt', 'Làm sạch và hoàn thiện'], 'keo chít mạch: 4 bước theo hướng dẫn'); assert.ok(bn.gia_tri.some((x) => x.truong === 'dung_cu' && x.ten === 'bi cầu miết ron')); assert.ok(bn.gia_tri.some((x) => x.truong === 'buoc' && x.dong === 'Finex F300' && x.ten === 'Tạo nhám'));
  // thầy thấy dấu hiệu từng bước + kiến thức lỗi (ngưỡng ẩm 8%)
  let nhac = ''; const f0 = globalThis.fetch; globalThis.fetch = async (u, o) => { if (String(u).includes('anthropic')) nhac = JSON.parse(o.body).messages[0].content.slice(-1)[0].text; return f0(u, o); };
  TRA = ['{"nhom":"THI_CONG","buoc":"Lăn gai chỉnh bề mặt","chac":0.9}']; await may('/hub/thay-doc', 'POST', { dong: 'Terrazy', doan: [{ anh: ['/media/media/a.jpg'] }] }); globalThis.fetch = f0;
  assert.match(nhac, /Lăn gai chỉnh bề mặt — nhận biết: con lăn gai/); assert.match(nhac, /trên 8%/);
  // bước cũ đặt tên tự do → Haiku đưa về bước chuẩn; đề xuất bước của dòng được dọn
  await may('/hub/thanh-pham', 'POST', { ten: 't.mp4', nguon_id: 't', nguon: 'TIKTOK', dai: 6, dong: 'Terrazy', shots: [{ t0: 0, t1: 3 }, { t0: 3, t1: 6 }], timeline: [
    { tu: 0, den: 3, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', buoc: 'Hoà hỗn hợp màu', mo_ta: 'khuấy bột trong xô', chac: 0.9 } }, { tu: 3, den: 6, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', buoc: 'Xử lý bề mặt bằng rulo', mo_ta: 'rulo gai lăn phá bọt', chac: 0.9 } }] });
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM bo_nhan WHERE truong='buoc' AND dong='Terrazy' AND trang_thai='DE_XUAT'`).get().n, 2);
  const goi0 = globalThis.fetch; const DS_GOI = []; globalThis.fetch = async (u, o) => { if (String(u).includes('anthropic') && String(o.body).includes('Quy trình thi công dòng')) { DS_GOI.push('chuan_hoa'); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Kết quả: [{"i":1,"buoc":"Trộn vật liệu"},{"i":2,"buoc":"lăn gai chỉnh bề mặt"}]' }], usage: { input_tokens: 900, output_tokens: 60 } }), { status: 200 }); } return goi0(u, o); };
  TRA = ['Kết quả: [{"i":1,"buoc":"Trộn vật liệu"},{"i":2,"buoc":"lăn gai chỉnh bề mặt"}]'];
  const cron = async () => { let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p; }; await cron();
  const b = (i) => JSON.parse(DB.raw.prepare('SELECT nhan_thay FROM mau_doan WHERE id=?').get('H:' + DB.raw.prepare(`SELECT id FROM kho_thanh_pham`).get().id + ':' + i).nhan_thay);
  globalThis.fetch = goi0; assert.deepEqual(DS_GOI, ['chuan_hoa'], 'một lần gọi Haiku cho cả lô'); assert.equal(b(0).buoc, 'Trộn vật liệu'); assert.equal(b(0).buoc_goc, 'Hoà hỗn hợp màu', 'giữ tên cũ để đối chiếu'); assert.equal(b(1).buoc, 'Lăn gai chỉnh bề mặt', 'chuẩn hoá hoa / thường');
  await cron(); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM bo_nhan WHERE truong='buoc' AND dong='Terrazy' AND trang_thai='DE_XUAT'`).get().n, 0, 'dòng chuẩn hoá xong → dọn đề xuất bước');
});

var DEM_BN = 0;
test('018g: dọn bộ nhãn theo tài liệu chuẩn (lần chuyển 4): gộp tên trùng, mẫu đổi theo, bỏ rác, dòng Terrazo → Terrazy', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  // như prod trước 26/09: dòng tên Terrazo, đề xuất tên dài, mẫu đang dùng tên cũ
  const nt = { nhom: 'THI_CONG', buoc: 'Gạt / miết / làm phẳng', vat_lieu: ['sơn epoxy hiệu ứng hạt cát FINEX F300', 'nước'], dung_cu: ['rulo gai', 'bàn gạt nhựa vàng'], chac: 0.9 };
  DB.raw.prepare(`INSERT INTO mau_doan (id, loai, nguon, doi_tuong_id, i, tu, den, dong, nhan_thay, trang_thai, hieu_luc, version, created_at) VALUES ('H:x:0','HINH','THANH_PHAM','x',0,0,3,'Terrazo',?,'THAY_CHOT',1,1,'')`).run(JSON.stringify(nt));
  for (const [t, ten, d] of [['vat_lieu', 'sơn epoxy hiệu ứng hạt cát FINEX F300', 'Terrazo'], ['vat_lieu', 'nước', 'Terrazo'], ['dung_cu', 'rulo gai', ''], ['dung_cu', 'bàn gạt nhựa vàng', ''], ['buoc', 'Gạt / miết / làm phẳng', 'Terrazo'], ['buoc', 'Thi công 2.8 đến 3.5m2', ''], ['bai_test', 'Dùng chìa khóa cào mạnh lên bề mặt', 'Terrazo'], ['vat_lieu', 'thứ lạ chưa có luật', '']])
    DB.raw.prepare(`INSERT INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,created_at,updated_at) VALUES (?,?,?,?,'DE_XUAT','THAY','','')`).run('bn_t' + (DEM_BN = (typeof DEM_BN === 'number' ? DEM_BN : 0) + 1), t, ten, d);
  DB.raw.prepare(`UPDATE module_config SET cau_hinh='{"v":3}' WHERE id='mau_doan'`).run(); env = taoEnv({ ...DB, raw: DB.raw });
  const bn = (await api('/bo-nhan')).j;
  assert.deepEqual(bn.de_xuat.map((x) => x.ten), ['thứ lạ chưa có luật'], 'chỉ còn tên thật sự mới cho người duyệt');
  const o = JSON.parse(DB.raw.prepare(`SELECT nhan_thay, dong FROM mau_doan WHERE id='H:x:0'`).get().nhan_thay);
  assert.deepEqual(o.vat_lieu, ['Finex F300'], 'tên dài → tên chuẩn, "nước" bị bỏ'); assert.deepEqual(o.dung_cu, ['con lăn gai', 'bay nhựa (bàn gạt)']); assert.equal(o.buoc, 'Thi công lớp phủ (đổ và cán)');
  assert.equal(DB.raw.prepare(`SELECT dong FROM mau_doan WHERE id='H:x:0'`).get().dong, 'Terrazy'); assert.ok(bn.dongs.includes('Terrazy') && !bn.dongs.includes('Terrazo'));
  assert.ok(bn.gia_tri.some((x) => x.truong === 'bai_test' && x.dong === 'Terrazy' && x.ten === 'Cào xước bề mặt'), 'bài test chuẩn của dòng sàn');
  assert.equal(DB.raw.prepare(`SELECT trang_thai FROM bo_nhan WHERE ten='Thi công 2.8 đến 3.5m2'`).get().trang_thai, 'BO');
  assert.ok(DB.raw.prepare(`SELECT detail FROM audit WHERE action='dọn bộ nhãn theo tài liệu chuẩn'`).all().some((x) => /gộp 5 · bỏ 2/.test(x.detail)), 'nhật ký ghi số gộp / bỏ');
});

test('018h: lọc sâu kho mẫu + gán dòng hàng loạt + đề xuất kèm ví dụ và gợi ý gộp', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await may('/hub/thanh-pham', 'POST', { ten: 'k.mp4', nguon_id: 'k', nguon: 'TIKTOK', dai: 6, shots: [{ t0: 0, t1: 3, khung_url: '/media/a.jpg' }, { t0: 3, t1: 6, khung_url: '/media/b.jpg' }], timeline: [
    { tu: 0, den: 3, nhom: 'THI_CONG', khung_url: '/media/a.jpg', mo: { nhom: 'HOAN_THIEN' }, thay: { nhom: 'THI_CONG', buoc: 'Bơm keo chà ron vào mạch gạch', dung_cu: ['súng bơm keo', 'thước laser đo góc'], chac: 0.9, mo_ta: 'đo góc bằng thước laser' } },
    { tu: 3, den: 6, nhom: 'HOAN_THIEN', khung_url: '/media/b.jpg', mo: { nhom: 'HOAN_THIEN' }, thay: { nhom: 'HOAN_THIEN', dung_cu: [], chac: 0.9, mo_ta: 'ron trắng đều' } }] });
  const vid = DB.raw.prepare(`SELECT id FROM kho_thanh_pham`).get().id; const k = (qs) => api('/kho-mau?kn=K1&tt=&' + qs).then((r) => r.j);
  assert.equal((await k('nhom=THI_CONG')).loc, 1); assert.equal((await k('f=dung_cu&v=' + encodeURIComponent('súng bơm keo'))).loc, 1, 'trường mảng = giá trị');
  assert.equal((await k('thieu=dung_cu')).loc, 1, 'thiếu dụng cụ'); assert.equal((await k('lech=1')).loc, 1, 'thầy lệch học trò'); assert.equal((await k('video=' + vid)).loc, 2);
  let kk = await k('dong=' + encodeURIComponent('(chưa có)')); assert.equal(kk.loc, 2); assert.ok(kk.dongs.includes('Keo chít mạch'), 'dòng keo luôn có trong bộ lọc'); assert.ok(kk.videos.some((x) => x.id === vid));
  // gán dòng cho video của mẫu chọn → cả video đổi dòng
  const r = await api('/mau-doan/dat-dong', 'POST', { ids: ['H:' + vid + ':0'], dong: 'Keo chít mạch' }); assert.equal(r.j.so_video, 1); assert.ok(r.j.so_mau >= 2);
  assert.equal((await k('dong=' + encodeURIComponent('Keo chít mạch'))).loc, 2); assert.equal(DB.raw.prepare(`SELECT dong FROM kho_thanh_pham`).get().dong, 'Keo chít mạch');
  assert.equal((await api('/mau-doan/dat-dong', 'POST', { ids: ['H:' + vid + ':0'], dong: 'Dòng bịa' })).s, 400);
  // đề xuất có ảnh mẫu + gợi ý gộp
  const bn = (await api('/bo-nhan')).j; const dx = bn.de_xuat.find((x) => x.ten === 'thước laser đo góc');
  assert.equal(dx.vi_du[0].khung_url, '/media/a.jpg'); assert.equal(dx.vi_du[0].mo_ta, 'đo góc bằng thước laser'); assert.equal(dx.goi_y, null, 'không có nhãn nào giống');
  DB.raw.prepare(`INSERT INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,created_at,updated_at) VALUES ('bn_x','dung_cu','bay miết inox cán gỗ','','DE_XUAT','THAY','','')`).run();
  assert.deepEqual((await api('/bo-nhan')).j.de_xuat.find((x) => x.id === 'bn_x').goi_y, { ten: 'bi cầu miết ron', ly_do: 'theo bộ nhãn chuẩn' });
});

test('018i: tự gán dòng theo vật liệu thầy thấy + hàng việc thay chủ (duyệt / gộp / tạo tên / dòng / nhãn), nhãn Claude không tính độ đúng', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  const tp = async (id, vl, ten) => may('/hub/thanh-pham', 'POST', { ten: ten || id + '.mp4', nguon_id: id, nguon: 'TIKTOK', dai: 6, shots: [{ t0: 0, t1: 3 }, { t0: 3, t1: 6 }], timeline: [0, 1].map((i) => ({ tu: i * 3, den: i * 3 + 3, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', vat_lieu: vl, dung_cu: ['thước laser đo góc'], chac: 0.9 } })) });
  await tp('a', ['sơn epoxy tự phẳng FINEX F300']); await tp('b', ['keo chà ron polyurea Kingsmen G6000']); await tp('c', ['nền gạch cũ']); await tp('d', [], 'Sàn Terrazy cao cấp.mp4');
  const cron = async () => { let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p; }; await cron();
  const dong = (n) => DB.raw.prepare(`SELECT dong FROM kho_thanh_pham WHERE nguon_id=?`).get(n).dong;
  assert.equal(dong('a'), 'Finex F300'); assert.equal(dong('b'), 'Keo chít mạch'); assert.equal(dong('c'), null, 'không rõ thì để người gán'); assert.equal(dong('d'), 'Terrazy', 'tên video có Terrazy');
  // Claude soạn việc thay chủ → cron chạy qua đường ghi của app
  const dx = DB.raw.prepare(`SELECT id, ten FROM bo_nhan WHERE trang_thai='DE_XUAT' AND truong='dung_cu'`).get(); const idC = DB.raw.prepare(`SELECT id FROM kho_thanh_pham WHERE nguon_id='c'`).get().id;
  DB.raw.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at) VALUES ('viec_thay_chu', ?, '')`).run(JSON.stringify({ viec: [
    { loai: 'bo_nhan', id: dx.id, hanh: 'doi_ten_duyet', ten: 'máy đo màu ron' }, { loai: 'dong', doi_tuong_id: idC, dong: 'Terrazy' },
    { loai: 'nhan', mau_id: 'H:' + idC + ':0', nhan: { nhom: 'THI_CONG', buoc: 'Tạo nhám', dung_cu: ['máy mài sàn'] } }] }));
  await cron();
  assert.ok(DB.raw.prepare(`SELECT 1 x FROM bo_nhan WHERE truong='dung_cu' AND ten='máy đo màu ron' AND trang_thai='DUNG'`).get(), 'tạo tên chuẩn mới rồi duyệt');
  assert.deepEqual(JSON.parse(DB.raw.prepare(`SELECT nhan_thay FROM mau_doan WHERE id=?`).get('H:' + idC + ':1').nhan_thay).dung_cu, ['máy đo màu ron'], 'mẫu đổi theo tên mới');
  assert.equal(dong('c'), 'Terrazy'); const m0 = DB.raw.prepare(`SELECT trang_thai, nguoi_ten FROM mau_doan WHERE id=?`).get('H:' + idC + ':0'); assert.equal(m0.trang_thai, 'VANG'); assert.equal(m0.nguoi_ten, 'Claude (thay chủ)');
  assert.equal(JSON.parse(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='viec_thay_chu'`).get().cau_hinh).viec.length, 0, 'làm xong thì xoá khỏi hàng');
  assert.ok(JSON.parse(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='viec_thay_chu_kq'`).get().cau_hinh).lan[0].kq.length >= 4);
  assert.equal((await api('/do-chinh-xac')).j.so_nhan, 0, 'nhãn Claude không tính vào độ đúng của thầy');
});

test('018j: dòng gán sai (luật TERRAZ khớp kênh sàn terrazzo bán Finex F300) được máy sửa theo bằng chứng', async () => {
  const DB = taoD1(); env = taoEnv(DB); TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const may = hubK(giai((await api('/may-ghep', 'POST', { ten: 'Q2' })).j.ma_ghep).khoa);
  await may('/hub/thanh-pham', 'POST', { ten: 't.mp4', nguon_id: 't', nguon: 'TIKTOK', dai: 9, dong: 'Terrazy', shots: [{ t0: 0, t1: 3 }, { t0: 3, t1: 6 }, { t0: 6, t1: 9 }], timeline: [0, 1, 2].map((i) => ({ tu: i * 3, den: i * 3 + 3, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', vat_lieu: ['Finex F300'], chac: 0.9 } })) });
  await may('/hub/thanh-pham', 'POST', { ten: 'u.mp4', nguon_id: 'u', nguon: 'TIKTOK', dai: 6, dong: 'Terrazy', shots: [{ t0: 0, t1: 3 }, { t0: 3, t1: 6 }], timeline: [0, 1].map((i) => ({ tu: i * 3, den: i * 3 + 3, nhom: 'THI_CONG', thay: { nhom: 'THI_CONG', vat_lieu: ['Finex F300', 'Kingsmen Terrazy'], chac: 0.9 } })) });
  let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p;
  assert.equal(DB.raw.prepare(`SELECT dong FROM kho_thanh_pham WHERE nguon_id='t'`).get().dong, 'Finex F300', 'Terrazy không có bằng chứng, Finex F300 có 3 → sửa');
  assert.equal(DB.raw.prepare(`SELECT dong FROM kho_thanh_pham WHERE nguon_id='u'`).get().dong, 'Terrazy', 'có bằng chứng Terrazy → giữ');
  assert.equal(DB.raw.prepare(`SELECT dong FROM mau_doan WHERE id=?`).get('H:' + DB.raw.prepare(`SELECT id FROM kho_thanh_pham WHERE nguon_id='t'`).get().id + ':0').dong, 'Finex F300');
});
