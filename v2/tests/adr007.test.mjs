// ADR-007a — seeding hội nhóm Facebook (bản vẽ §11): bản đồ thông điệp · tài khoản MKT có giọng · nhóm có quy tắc/giờ vàng · gói + G3-gói
// · xếp lịch nhóm × tài khoản × giờ vàng · Trạm đăng (checkpoint → tạm dừng) · kiểm 2 & 7 ngày + lead · học → đề xuất G4 · gói định kỳ theo chỉ tiêu tuần
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let AI_TEXT = null;
globalThis.fetch = async (url, opt) => { const u = String(url);
  if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: AI_TEXT }], usage: { input_tokens: 500, output_tokens: 300 } }), { status: 200 });
  return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null, KHOA = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const hub = (p, method = 'GET', body) => worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': KHOA }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }).then(async r => ({ status: r.status, j: await r.json().catch(() => null) }));
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7); const gioVN = iso => (new Date(iso).getUTCHours() + 7) % 24;
let tMkt, tTruong, tGD, tk1, tk2, nhomA, nhomB, goiId, v1, v2, td1;
const gat = async (buoc, muc) => { for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run(buoc + 'g' + i + Math.random(), buoc, thangNay + '-01', 1, new Date().toISOString()); await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); const r = await api('/buoc/' + buoc, 'PATCH', { nguoi_thuc_hien: muc }); assert.equal(r.status, 200, buoc + ' → ' + muc + ': ' + JSON.stringify(r.j)); };
test('chuẩn bị: người dùng, khoá Trạm + nhịp tim, claim CHẶN, chiến lược', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT'], ['Sếp', 'gd@k.vn', 'GIAM_DOC']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt });
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token; tGD = (await dangNhap('gd@k.vn', '123456')).token;
  const r = await api('/tram/khoa', 'POST'); KHOA = JSON.parse(Buffer.from(r.j.ma_ghep.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).khoa;
  await hub('/hub/trang_thai', 'POST', { may: 'Ngoc-Han', ban: '9.154' });
  await api('/danh-muc/claim_cam', 'POST', { cum_tu: 'tốt nhất thị trường', muc_do: 'CHAN' });
  await api('/chien-luoc', 'PUT', { dinh_vi: 'Keo ron Kingsmen — ron sạch bền, thợ làm một lần', tong_giong: 'mộc, thật', doi_tuong: 'thợ ốp lát' });
  const b = (await api('/bootstrap')).j.db; assert.ok(b.buoc.some(x => x.ma === 'B13' && x.cong === 'G3')); assert.ok(b.buoc.some(x => x.ma === 'B17' && x.muc_toi_da === 'AI_GOI_Y')); assert.ok(b.seeding && Array.isArray(b.seeding.giong) && b.seeding.giong.length === 3);
});
test('bản đồ thông điệp: MKT thêm/sửa; máy đề xuất từ chiến lược (AI) không trùng tên; tắt = active 0; chỉ tiêu seeding_tuan trong kế hoạch tháng', async () => {
  let r = await api('/seeding/thong-diep', 'POST', { ten: 'Ron không ố sau mùa mưa', y_chinh: 'Ron giữ màu, không mốc đen', du_kien: 'chống thấm theo tiêu chuẩn X\nbảo hành 5 năm', cach_noi_tho: 'ron sạch, không đen', khong_noi: 'giá, tuyệt đối' }, tMkt); assert.equal(r.status, 200); td1 = r.j.id;
  const t = r.j.db.seeding.thong_diep.find(x => x.id === td1); assert.deepEqual(t.du_kien, ['chống thấm theo tiêu chuẩn X', 'bảo hành 5 năm']); assert.equal(t.tao_boi, 'NGUOI');
  AI_TEXT = JSON.stringify({ thong_diep: [{ ten: 'Ron không ố sau mùa mưa', y_chinh: 'trùng' }, { ten: 'Thi công một lần không phải làm lại', y_chinh: 'Đỡ công sửa', du_kien: ['bảo hành 5 năm'], cach_noi_tho: 'làm một phát ăn luôn', khong_noi: 'giá', pillar_id: 'khong_co' }] });
  r = await api('/seeding/thong-diep', 'POST', { de_xuat_ai: true }, tMkt); assert.equal(r.status, 200); assert.equal(r.j.them, 1, 'trùng tên bị bỏ'); const t2 = r.j.db.seeding.thong_diep.find(x => x.ten === 'Thi công một lần không phải làm lại'); assert.equal(t2.tao_boi, 'AGENT'); assert.equal(t2.pillar_id, null, 'pillar không tồn tại → null');
  r = await api('/seeding/thong-diep/' + t2.id, 'PATCH', { cach_noi_tho: 'một phát ăn ngay' }, tMkt); assert.equal(r.j.db.seeding.thong_diep.find(x => x.id === t2.id).cach_noi_tho, 'một phát ăn ngay');
  r = await api('/seeding/thong-diep/' + t2.id, 'DELETE', null, tMkt); assert.equal(r.j.db.seeding.thong_diep.find(x => x.id === t2.id).active, false);
  r = await api('/ke-hoach/' + thangNay, 'PUT', { chi_tieu: { tong_bai: 10, seeding_tuan: 3 } }); assert.equal(r.status, 200); assert.equal(r.j.db.ke_hoach_thang.find(k => k.thang === thangNay).chi_tieu.seeding_tuan, 3);
});
test('tài khoản MKT (chỉ Trưởng MKT/Admin; giọng cố định; không giữ mật khẩu) và nhóm (quy tắc, giờ vàng, tài khoản trong nhóm)', async () => {
  assert.equal((await api('/seeding/tai-khoan', 'POST', { nhan: 'x' }, tMkt)).status, 403);
  let r = await api('/seeding/tai-khoan', 'POST', { nhan: 'Anh Tư thợ ốp', tram_id: 'facebook', giong: 'THO', nghe: 'thợ ốp lát', cau_chuyen: '12 năm làm nhà phố', nhip_ngay: 2 }, tTruong); assert.equal(r.status, 200); tk1 = r.j.id;
  r = await api('/seeding/tai-khoan', 'POST', { nhan: 'Thầu Bảy', tram_id: 'facebook-2', giong: 'THAU', nhip_ngay: 2 }, tTruong); tk2 = r.j.id;
  const ts = r.j.db.seeding.tai_khoan; assert.equal(ts.length, 2); assert.equal(ts.find(t => t.id === tk1).persona.cau_chuyen, '12 năm làm nhà phố'); assert.ok(ts.every(t => t.song)); assert.ok(!JSON.stringify(ts).includes('password'));
  r = await api('/seeding/nhom', 'POST', { ten: 'Hội thợ ốp lát miền Nam', link_hoac_id: 'https://www.facebook.com/groups/tho-op-lat', quy_tac: { cam_link: true }, gio_vang: '9, 21', tai_khoan_ids: [tk1, tk2], nhip_tuan: 2 }, tMkt); assert.equal(r.status, 200); nhomA = r.j.id;
  r = await api('/seeding/nhom', 'POST', { ten: 'Nhà thầu xây dựng dân dụng', link_hoac_id: 'https://www.facebook.com/groups/nha-thau', quy_tac: { duyet_bai: true }, tai_khoan_ids: [tk2], nhip_tuan: 1 }, tMkt); nhomB = r.j.id;
  const n = r.j.db.seeding.nhom.find(x => x.id === nhomA); assert.deepEqual(n.gio_vang, [9, 21]); assert.equal(n.quy_tac.cam_link, true); assert.deepEqual(n.tai_khoan_ids, [tk1, tk2]);
});
test('gói định kỳ: máy soạn biến thể theo giọng tài khoản × dạng bài × thông điệp đói; bỏ bài trúng CHẶN / không nhắc Kingsmen / có tiền; chấm máy; B13 NGƯỜI → CHO_DUYET + việc Trưởng MKT', async () => {
  AI_TEXT = JSON.stringify({ bien_the: [
    { stt: 1, noi_dung: 'Hôm bữa làm nhà chị Lan, mùa mưa xong ron vẫn sáng, tôi xài keo ron Kingsmen thấy ổn, không đen như mấy loại trước.', binh_luan: [{ vai: 'HOI_KN', text: 'Bác xài loại nào mà ron sạch vậy?' }, { vai: 'HOI_MUA', text: 'Mua ở đâu anh?' }] },
    { stt: 2, noi_dung: 'Anh em thầu cho hỏi, chủ nhà đòi bảo hành ron 5 năm, tôi đang tính Kingsmen vì có bảo hành, ai làm rồi cho xin kinh nghiệm https://kingsmen.vn/ron', binh_luan: ['Tôi làm 3 căn rồi, ok'] },
    { stt: 3, noi_dung: 'Keo ron Kingsmen tốt nhất thị trường, ai cũng nên dùng', binh_luan: [] },
    { stt: 4, noi_dung: 'Ron không ố, thợ khỏe, giá 120.000đ một hộp', binh_luan: [] },
  ] });
  let r = await api('/seeding/goi', 'POST', {}, tMkt); assert.equal(r.status, 200, JSON.stringify(r.j)); goiId = r.j.id; assert.equal(r.j.so_bien_the, 2); assert.equal(r.j.tu_duyet, false);
  const g = r.j.db.seeding.goi.find(x => x.id === goiId); assert.equal(g.loai, 'DINH_KY'); assert.equal(g.trang_thai, 'CHO_DUYET'); assert.ok(g.cham_may.diem <= 80 && g.cham_may.ly.some(l => /link/.test(l)), JSON.stringify(g.cham_may));
  const bts = r.j.db.seeding.bien_the.filter(b => b.goi_id === goiId); assert.deepEqual(bts.map(b => b.giong).sort(), ['THAU', 'THO']); assert.equal(bts.find(b => b.giong === 'THAU').co_link, true); assert.equal(bts.find(b => b.giong === 'THO').binh_luan[1].vai, 'HOI_MUA'); assert.ok(bts.every(b => b.thong_diep_id === td1)); assert.ok(bts.every(b => b.tao_boi === 'NGUOI'), 'người bấm tạo → tao_boi NGUOI');
  assert.ok(r.j.db.cong_viec.some(v => v.loai === 'DUYET_GOI_SEEDING' && v.doi_tuong_id === goiId && v.giao_cho_vai_tro === 'TRUONG_MKT'));
  assert.equal((await api('/seeding/goi', 'POST', { bai_dang_id: 'khong_co' }, tMkt)).status, 409);
});
test('G3-gói: MKT không duyệt; trả lại phải có lý do; Trưởng MKT duyệt → mẫu học B13, việc XONG; sửa biến thể máy soạn → mẫu học; cụm CHẶN bị chặn', async () => {
  assert.equal((await api('/seeding/goi/' + goiId + '/duyet', 'POST', {}, tMkt)).status, 403);
  assert.equal((await api('/seeding/goi/' + goiId + '/tra-lai', 'POST', {}, tTruong)).status, 400);
  const bt = DB.raw.prepare(`SELECT id FROM bien_the WHERE goi_id=? AND giong='THO'`).get(goiId); DB.raw.prepare(`UPDATE bien_the SET tao_boi='AGENT' WHERE id=?`).run(bt.id);
  assert.equal((await api('/seeding/bien-the/' + bt.id, 'PATCH', { noi_dung: 'Kingsmen tốt nhất thị trường luôn' }, tMkt)).status, 422);
  let r = await api('/seeding/bien-the/' + bt.id, 'PATCH', { noi_dung: 'Hôm bữa làm nhà chị Lan, mùa mưa xong ron vẫn sáng, tôi xài keo ron Kingsmen thấy ổn, không đen như mấy loại trước. Ai cần tôi chỉ cách trét.', binh_luan: ['HOI_MUA: Mua chỗ nào anh ơi?'] }, tMkt); assert.equal(r.status, 200);
  assert.equal(r.j.db.seeding.bien_the.find(b => b.id === bt.id).binh_luan[0].vai, 'HOI_MUA'); assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc WHERE buoc='B13'`).get().n, 1);
  r = await api('/seeding/goi/' + goiId + '/duyet', 'POST', { ly_do: '' }, tTruong); assert.equal(r.status, 200); const g = r.j.db.seeding.goi.find(x => x.id === goiId); assert.equal(g.trang_thai, 'DUYET'); assert.equal(g.duyet_boi, 'Trang');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM mau_hoc WHERE buoc='B13'`).get().n, 2); assert.ok(!r.j.db.cong_viec.some(v => v.loai === 'DUYET_GOI_SEEDING' && v.trang_thai === 'MO'));
  assert.equal(r.j.xep, null, 'B14 NGƯỜI → máy không tự xếp'); assert.equal((await api('/seeding/goi/' + goiId + '/duyet', 'POST', {}, tTruong)).status, 409);
});
test('B14 xếp lịch: mỗi nhóm một việc, tài khoản trong nhóm, biến thể hợp quy tắc (cấm link), giờ vàng của nhóm, nhịp tuần; xếp lại không nhân đôi', async () => {
  let r = await api('/seeding/goi/' + goiId + '/xep-lich', 'POST', {}, tMkt); assert.equal(r.status, 200); assert.equal(r.j.xep, 2, JSON.stringify(r.j.bo));
  const vs = r.j.db.seeding.viec.filter(v => v.goi_id === goiId); assert.equal(vs.length, 2);
  const vA = vs.find(v => v.nhom_id === nhomA), vB = vs.find(v => v.nhom_id === nhomB); const bt = id => r.j.db.seeding.bien_the.find(b => b.id === id);
  assert.equal(bt(vA.bien_the_id).co_link, false, 'nhóm cấm link → biến thể không link'); assert.ok([9, 21].includes(gioVN(vA.gio_dang)), 'giờ vàng nhóm A: ' + vA.gio_dang); assert.ok([tk1, tk2].includes(vA.tai_khoan_id));
  assert.equal(vB.tai_khoan_id, tk2); assert.equal(bt(vB.bien_the_id).giong, 'THAU', 'biến thể theo giọng tài khoản'); assert.ok([6, 12, 20].includes(gioVN(vB.gio_dang)), 'giờ vàng mặc định: ' + vB.gio_dang);
  r = await api('/seeding/goi/' + goiId + '/xep-lich', 'POST', {}, tMkt); assert.equal(r.j.xep, 0); assert.equal(r.j.db.seeding.viec.filter(v => v.goi_id === goiId).length, 2);
  v1 = vA.id; v2 = vB.id;
});
test('B15: đăng ngay → Trạm sống → DANG_GUI + lệnh; /hub/viec/seeding_dang có hồ sơ tài khoản & quy tắc; lô kết quả: link → DA_DANG; chờ QTV → CHO_QUAN_TRI; checkpoint → tài khoản tạm dừng + việc dời + việc kiểm tra', async () => {
  // B15 NGƯỜI → tới giờ máy giao đăng tay (không gửi Trạm)
  let r = await api('/seeding/viec/' + v1 + '/dang-ngay', 'POST', {}, tMkt); assert.equal(r.status, 200); let x = r.j.db.seeding.viec.find(v => v.id === v1); assert.equal(x.trang_thai, 'DANG_GUI'); assert.equal(x.cach, 'TAY'); assert.ok(r.j.db.cong_viec.some(c => c.loai === 'SEEDING_TAY' && c.doi_tuong_id === v1));
  DB.raw.prepare(`UPDATE viec_seeding SET trang_thai='CHO', cach='TRAM' WHERE id=?`).run(v1); DB.raw.prepare(`UPDATE cong_viec SET trang_thai='XONG' WHERE loai='SEEDING_TAY'`).run();
  await gat('B15', 'AI_TU_LAM');
  r = await api('/seeding/viec/' + v1 + '/dang-ngay', 'POST', {}, tMkt); assert.equal(r.status, 200); x = r.j.db.seeding.viec.find(v => v.id === v1); assert.equal(x.trang_thai, 'DANG_GUI'); assert.equal(x.cach, 'TRAM');
  r = await api('/seeding/viec/' + v2 + '/dang-ngay', 'POST', {}, tMkt); assert.equal(r.j.db.seeding.viec.find(v => v.id === v2).trang_thai, 'DANG_GUI');
  const l = await hub('/hub/lenh'); assert.ok(l.j.lenh.some(x => x.viec === 'chay_agent' && x.tham_so.viec === 'seeding_dang'));
  const h = await hub('/hub/viec/seeding_dang'); assert.equal(h.j.viec.length, 2); const hv2 = h.j.viec.find(x => x.viec_id === v2); assert.equal(hv2.tai_khoan.tram_id, 'facebook-2'); assert.equal(hv2.nhom.quy_tac.duyet_bai, true); assert.match(hv2.noi_dung, /Kingsmen/); assert.equal(hv2.giong, 'THAU');
  let n = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_dang', bang: 'content_os.seeding_dang_ket_qua', luot: 's1', dong: [{ viec_id: v1, ok: true, link: 'https://www.facebook.com/groups/tho-op-lat/posts/111' }, { viec_id: v2, ok: true, cho_quan_tri: true, link: '' }, { viec_id: 'x', ok: true }] }); assert.equal(n.status, 200); assert.equal(n.j.cap_nhat, 2); assert.equal(n.j.loi.length, 1);
  let b = (await api('/bootstrap')).j.db.seeding; assert.equal(b.viec.find(v => v.id === v1).trang_thai, 'DA_DANG'); assert.equal(b.viec.find(v => v.id === v2).trang_thai, 'CHO_QUAN_TRI');
  // checkpoint trên việc khác của tk1: tạo việc tay
  DB.raw.prepare(`INSERT INTO viec_seeding (id,goi_id,bien_the_id,nhom_id,tai_khoan_id,cach,gio_dang,trang_thai,created_at,updated_at) VALUES ('vs_cp',?,?,?,?,'TRAM',?,'DANG_GUI',?,?)`).run(goiId, b.viec.find(v => v.id === v1).bien_the_id, nhomA, tk1, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
  n = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_dang', bang: 'content_os.seeding_dang_ket_qua', luot: 's2', dong: [{ viec_id: 'vs_cp', ok: false, checkpoint: true, loi: 'phiên Facebook cần xác minh' }] }); assert.equal(n.j.cap_nhat, 1);
  b = (await api('/bootstrap')).j.db; const t1 = b.seeding.tai_khoan.find(t => t.id === tk1); assert.equal(t1.song, false); assert.ok(t1.tam_dung_den > new Date().toISOString()); assert.ok(b.cong_viec.some(v => v.loai === 'KIEM_TAI_KHOAN' && v.doi_tuong_id === tk1));
  const cp = b.seeding.viec.find(v => v.id === 'vs_cp'); assert.equal(cp.trang_thai, 'CHO'); assert.equal(cp.lan_thu, 1); assert.ok(cp.gio_dang > new Date(Date.now() + 20 * 3600e3).toISOString(), 'dời ≥ 24 giờ');
  // tài khoản tạm dừng → tới giờ máy hoãn chứ không gửi Trạm
  DB.raw.prepare(`UPDATE viec_seeding SET gio_dang=? WHERE id='vs_cp'`).run(new Date(Date.now() - 60e3).toISOString()); let r2 = await api('/may/chay-thu', 'POST', { agent: 'DANG_SEEDING' }); assert.match(r2.j.kq[0].tom_tat, /hoãn 1/);
  r2 = await api('/seeding/tai-khoan/' + tk1, 'PATCH', { mo_lai: true }, tTruong); assert.equal(r2.j.db.seeding.tai_khoan.find(t => t.id === tk1).song, true); await api('/seeding/viec/vs_cp/huy', 'POST', { ly_do: 'test' }, tMkt);
});
test('B16: /hub/viec/seeding_kiem tới hạn 2 ngày; lô kiểm: ĐẠT + bình luận hỏi mua → lead + việc MKT; CHO_QUAN_TRI thấy bài → DA_DANG; lần 2 (7 ngày) bài bị gỡ → KHÔNG ĐẠT; hiệu quả nhóm; người quyết nghi ngờ = mẫu học', async () => {
  let h = await hub('/hub/viec/seeding_kiem'); assert.equal(h.j.viec.length, 0, 'chưa tới 2 ngày');
  DB.raw.prepare(`UPDATE viec_seeding SET dang_at=? WHERE id IN (?,?)`).run(new Date(Date.now() - 3 * 864e5).toISOString(), v1, v2); DB.raw.prepare(`UPDATE viec_seeding SET link='https://www.facebook.com/groups/nha-thau/posts/222' WHERE id=?`).run(v2);
  h = await hub('/hub/viec/seeding_kiem'); assert.equal(h.j.viec.length, 2); assert.equal(h.j.viec.find(x => x.viec_id === v2).cho_quan_tri, true); assert.equal(h.j.viec.find(x => x.viec_id === v1).lan, 1);
  const nd1 = DB.raw.prepare(`SELECT b.noi_dung FROM bien_the b JOIN viec_seeding v ON v.bien_the_id=b.id WHERE v.id=?`).get(v1).noi_dung;
  let n = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_kiem', bang: 'content_os.seeding_kiem', luot: 'k1', dong: [
    { viec_id: v1, song: true, noi_dung: nd1, react: 14, binh_luan: 3, binh_luan_ds: [{ nguoi: 'Nam Thợ', text: 'ron này mua ở đâu vậy anh, cho xin giá' }, { nguoi: 'Hùng', text: 'đẹp đó' }, { nguoi: 'Nam Thợ', text: 'ron này mua ở đâu vậy anh, cho xin giá' }] },
    { viec_id: v2, song: true, da_len: true, link: 'https://www.facebook.com/groups/nha-thau/posts/222', noi_dung: 'nội dung khác hẳn không liên quan gì tới bài đã soạn ở trên kia cả', react: 0, binh_luan: 0 } ] }); assert.equal(n.j.cap_nhat, 2);
  let b = (await api('/bootstrap')).j.db; const x1 = b.seeding.viec.find(v => v.id === v1); assert.equal(x1.trang_thai, 'DAT'); assert.equal(x1.kiem.react, 14); assert.equal(x1.kiem.lead, 1); assert.equal(x1.so_lan_kiem, 1);
  assert.equal(b.seeding.lead.length, 1, 'bình luận trùng không tạo 2 lead'); const ld = b.seeding.lead[0]; assert.equal(ld.nguoi, 'Nam Thợ'); assert.equal(ld.trang_thai, 'MOI'); assert.ok(b.cong_viec.some(v => v.loai === 'LEAD_SEEDING' && v.doi_tuong_id === ld.id && v.giao_cho_vai_tro === 'MARKETING'));
  const x2 = b.seeding.viec.find(v => v.id === v2); assert.equal(x2.trang_thai, 'KHONG_DAT', 'khớp nội dung thấp'); assert.match(x2.ly_do, /khớp/);
  const nA = b.seeding.nhom.find(x => x.id === nhomA); assert.equal(nA.hieu_qua.tong, 1); assert.equal(nA.hieu_qua.dat, 1); assert.equal(nA.hieu_qua.lead, 1); assert.equal(b.seeding.tai_khoan.find(t => t.id === x1.tai_khoan_id).suc_khoe.tong, 1);
  let r = await api('/seeding/lead/' + ld.id, 'PATCH', { trang_thai: 'DA_TRA_LOI', ghi_chu: 'đã inbox chỉ đại lý' }, tMkt); assert.equal(r.j.db.seeding.lead[0].trang_thai, 'DA_TRA_LOI'); assert.ok(!r.j.db.cong_viec.some(v => v.loai === 'LEAD_SEEDING' && v.trang_thai === 'MO'));
  // lần 2 sau 7 ngày: bài bị gỡ
  h = await hub('/hub/viec/seeding_kiem'); assert.equal(h.j.viec.length, 0); DB.raw.prepare(`UPDATE viec_seeding SET dang_at=? WHERE id=?`).run(new Date(Date.now() - 8 * 864e5).toISOString(), v1);
  h = await hub('/hub/viec/seeding_kiem'); assert.equal(h.j.viec.length, 1); assert.equal(h.j.viec[0].lan, 2);
  n = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_kiem', bang: 'content_os.seeding_kiem', luot: 'k2', dong: [{ viec_id: v1, song: false }] }); assert.equal(n.j.cap_nhat, 1);
  b = (await api('/bootstrap')).j.db; assert.equal(b.seeding.viec.find(v => v.id === v1).trang_thai, 'KHONG_DAT'); assert.equal(b.seeding.nhom.find(x => x.id === nhomA).hieu_qua.tong, 1, 'lần 2 không cộng dồn hiệu quả');
  // người lật kết luận máy → mẫu học B16
  r = await api('/seeding/viec/' + v2 + '/quyet', 'POST', { quyet: 'DAT', ly_do: 'QTV sửa lại chữ, bài vẫn đúng ý' }, tMkt); assert.equal(r.status, 200); assert.equal(r.j.db.seeding.viec.find(v => v.id === v2).trang_thai, 'DAT'); const mh = DB.raw.prepare(`SELECT giong FROM mau_hoc WHERE buoc='B16'`).all(); assert.equal(mh.length, 1); assert.equal(mh[0].giong, 0);
  // quá hạn kiểm 10 ngày → NGHI NGỜ
  DB.raw.prepare(`INSERT INTO viec_seeding (id,goi_id,bien_the_id,nhom_id,tai_khoan_id,cach,gio_dang,trang_thai,link,dang_at,created_at,updated_at) VALUES ('vs_cu',?,?,?,?,'TRAM',?,'DA_DANG','https://www.facebook.com/groups/x/posts/9',?,?,?)`).run(goiId, x1.bien_the_id, nhomA, tk1, new Date().toISOString(), new Date(Date.now() - 11 * 864e5).toISOString(), new Date().toISOString(), new Date().toISOString());
  r = await api('/may/chay-thu', 'POST', { agent: 'KIEM_SEEDING' }); assert.match(r.j.kq[0].bo_qua || '', /NGƯỜI/, 'B16 NGƯỜI → máy không kiểm'); await gat('B16', 'AI_TU_LAM');
  r = await api('/may/chay-thu', 'POST', { agent: 'KIEM_SEEDING' }); assert.match(r.j.kq[0].tom_tat, /1 quá hạn → nghi ngờ/); assert.equal(r.j.db.seeding.viec.find(v => v.id === 'vs_cu').trang_thai, 'NGHI_NGO'); assert.ok(r.j.db.cong_viec.some(v => v.loai === 'SEEDING_NGHI_NGO' && v.doi_tuong_id === 'vs_cu'));
});
test('B17 học: chưa đủ mẫu → bỏ qua; đủ → đề xuất SEEDING_GIONG / SEEDING_NHOM (G4, GĐ duyệt → áp cấu hình giọng ưu tiên, tắt nhóm)', async () => {
  await gat('B17', 'AI_GOI_Y'); assert.equal((await api('/buoc/B17', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' })).status, 422, 'B17 tối đa AI gợi ý (G4)');
  let r = await api('/may/chay-thu', 'POST', { agent: 'HOC_SEEDING' }); assert.match(r.j.kq[0].tom_tat || r.j.kq[0].bo_qua || '', /Chưa đủ/);
  const bt = DB.raw.prepare(`SELECT id, giong FROM bien_the WHERE goi_id=?`).all(goiId); const btTho = bt.find(b => b.giong === 'THO').id, btThau = bt.find(b => b.giong === 'THAU').id; const now = new Date().toISOString();
  for (let i = 0; i < 10; i++) { if (i < 6) DB.raw.prepare(`INSERT INTO viec_seeding (id,goi_id,bien_the_id,nhom_id,tai_khoan_id,cach,gio_dang,trang_thai,kiem,created_at,updated_at) VALUES (?,?,?,?,?,'TRAM',?,?,?,?,?)`).run('h_tho' + i, goiId, btTho, nhomA, tk1, now, 'DAT', JSON.stringify({ react: 40, binh_luan: 6, lead: 1, song: true }), now, now);
    DB.raw.prepare(`INSERT INTO viec_seeding (id,goi_id,bien_the_id,nhom_id,tai_khoan_id,cach,gio_dang,trang_thai,kiem,created_at,updated_at) VALUES (?,?,?,?,?,'TRAM',?,?,?,?,?)`).run('h_thau' + i, goiId, btThau, nhomB, tk2, now, i < 5 ? 'DAT' : 'KHONG_DAT', JSON.stringify({ react: 2, binh_luan: 0, lead: 0, song: i < 5 }), now, now); }
  r = await api('/may/chay-thu', 'POST', { agent: 'HOC_SEEDING' }); assert.match(r.j.kq[0].tom_tat, /SEEDING_GIONG/); assert.match(r.j.kq[0].tom_tat, /SEEDING_NHOM/);
  const dxG = r.j.db.de_xuat.find(d => d.loai === 'SEEDING_GIONG'); assert.equal(dxG.noi_dung.giong_uu_tien, 'THO'); assert.ok(dxG.bang_chung.THO.bai >= 6);
  const dxN = r.j.db.de_xuat.find(d => d.loai === 'SEEDING_NHOM'); assert.equal(dxN.noi_dung.nhom_id, nhomB); assert.match(dxN.tieu_de, /Nhà thầu/);
  assert.equal((await api('/de-xuat/' + dxG.id + '/quyet', 'POST', { quyet: 'DUYET' }, tMkt)).status, 403);
  r = await api('/de-xuat/' + dxG.id + '/quyet', 'POST', { quyet: 'DUYET' }, tGD); assert.equal(r.status, 200); assert.equal(r.j.db.module_config.seeding.giong_uu_tien, 'THO');
  r = await api('/de-xuat/' + dxN.id + '/quyet', 'POST', { quyet: 'DUYET' }, tGD); assert.equal(r.status, 200); assert.equal(r.j.db.seeding.nhom.find(n => n.id === nhomB).active, false);
  r = await api('/may/chay-thu', 'POST', { agent: 'HOC_SEEDING' }); assert.match(r.j.kq[0].tom_tat, /Đề xuất seeding|Chưa đủ/);
});
test('agent TAO_GOI_SEEDING: gói định kỳ theo chỉ tiêu tuần (3) — đã có gói mở trong tuần → không tạo; hết hạn → tạo gói máy (tao_boi AGENT); B13 AI tự làm + máy chấm đạt → tự duyệt', async () => {
  AI_TEXT = JSON.stringify({ bien_the: [{ stt: 1, noi_dung: 'Tuần rồi làm sân sau nhà bác Sáu, ron Kingsmen trét êm, khô rồi màu đều, chủ nhà ưng.', binh_luan: [{ vai: 'HOI_KN', text: 'Trét cữ nào bác?' }] }, { stt: 2, noi_dung: 'Anh em cho hỏi, khách đòi ron bảo hành lâu, mình xài Kingsmen được không, có bảo hành 5 năm theo hãng nói.', binh_luan: [] }] });
  DB.raw.prepare(`DELETE FROM viec_seeding WHERE id LIKE 'h_%'`).run(); await gat('B13', 'AI_GOI_Y');
  let r = await api('/may/chay-thu', 'POST', { agent: 'TAO_GOI_SEEDING' }); assert.match(r.j.kq[0].bo_qua || r.j.kq[0].tom_tat, /Không cần gói mới/, JSON.stringify(r.j.kq[0]));
  DB.raw.prepare(`UPDATE goi_seeding SET trang_thai='HET_HAN'`).run(); DB.raw.prepare(`UPDATE viec_seeding SET created_at=? WHERE goi_id=?`).run(new Date(Date.now() - 10 * 864e5).toISOString(), goiId);
  r = await api('/may/chay-thu', 'POST', { agent: 'TAO_GOI_SEEDING' }); assert.match(r.j.kq[0].tom_tat, /Tạo 1 gói/); let g = r.j.db.seeding.goi.find(x => x.loai === 'DINH_KY' && x.trang_thai === 'CHO_DUYET'); assert.ok(g); assert.equal(g.tao_boi, 'Máy (B13)'); assert.ok(r.j.db.seeding.bien_the.filter(b => b.goi_id === g.id).every(b => b.tao_boi === 'AGENT'));
  // B13 AI tự làm → gói máy chấm đạt tự duyệt; B14 AI → tự xếp lịch
  await gat('B13', 'AI_TU_LAM'); await gat('B14', 'AI_TU_LAM');
  DB.raw.prepare(`UPDATE goi_seeding SET trang_thai='HET_HAN'`).run();
  r = await api('/may/chay-thu', 'POST', { agent: 'TAO_GOI_SEEDING' }); g = r.j.db.seeding.goi.find(x => x.loai === 'DINH_KY' && x.trang_thai === 'DUYET'); assert.ok(g, 'tự duyệt'); assert.match(g.duyet_boi, /Máy/);
  r = await api('/may/chay-thu', 'POST', { agent: 'XEP_LICH_SEEDING' }); assert.match(r.j.kq[0].tom_tat, /Xếp 1 việc/, 'nhóm B đã tắt → chỉ nhóm A');
  // bootstrap không lộ gì ngoài dữ liệu seeding; GĐ xem được, Sales không thấy màn (không có seeding)
  await api('/users', 'POST', { ho_ten: 'S', email: 's@k.vn', password: '123456', vai_tro: 'SALES' }); const tS = (await dangNhap('s@k.vn', '123456')).token; const bs = (await api('/bootstrap', 'GET', null, tS)).j.db; assert.equal(bs.seeding, null);
  assert.equal((await api('/seeding/nhom', 'POST', { ten: 'x' }, tS)).status, 403);
});
