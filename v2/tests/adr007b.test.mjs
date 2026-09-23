// ADR-007b — bình luận dẫn dắt đa tài khoản (lên lịch sau đăng, Trạm bình luận, giao tay khi B15 NGƯỜI), lead AI phân loại + gợi ý,
// nuôi tài khoản (lên lịch, Trạm làm, sức khoẻ), tự chỉnh nhịp (checkpoint → hạ nhịp tài khoản; bị gỡ → hạ nhịp nhóm; nhóm tốt → đề xuất tăng qua G4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let AI_TEXT = null;
globalThis.fetch = async (url, opt) => { const u = String(url); if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: AI_TEXT }], usage: { input_tokens: 300, output_tokens: 100 } }), { status: 200 }); return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const DB = taoD1(); const env = { DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') } };
let TOKEN = null, KHOA = null;
const api = async (p, method = 'GET', body, tok) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...((tok || TOKEN) ? { Authorization: 'Bearer ' + (tok || TOKEN) } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, j }; };
const hub = (p, method = 'GET', body) => worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Hub-Key': KHOA }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }).then(async r => ({ status: r.status, j: await r.json().catch(() => null) }));
const dangNhap = async (email, pw) => (await api('/login', 'POST', { email, password: pw })).j;
const thangNay = new Date().toISOString().slice(0, 7);
const gat = async (buoc, muc) => { for (let i = 0; i < 30; i++) DB.raw.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,giong,created_at) VALUES (?,?,?,?,?)`).run(buoc + 'g' + i + Math.random(), buoc, thangNay + '-01', 1, new Date().toISOString()); await api('/may/chay-thu', 'POST', { agent: 'TINH_SAN_SANG' }); const r = await api('/buoc/' + buoc, 'PATCH', { nguoi_thuc_hien: muc }); assert.equal(r.status, 200, buoc + ' → ' + muc + ': ' + JSON.stringify(r.j)); };
let tMkt, tTruong, tGD, tk1, tk2, tk3, nhomA, goiId, v1, btId;
test('chuẩn bị: 3 tài khoản, nhóm (cấm bán hàng), gói duyệt, việc đã đăng qua Trạm', async () => {
  TOKEN = (await dangNhap('admin@kingsmen.vn', 'admin123')).token;
  for (const [ten, email, vt] of [['Ngọc', 'mkt@k.vn', 'MARKETING'], ['Trang', 'truong@k.vn', 'TRUONG_MKT'], ['Sếp', 'gd@k.vn', 'GIAM_DOC']]) await api('/users', 'POST', { ho_ten: ten, email, password: '123456', vai_tro: vt });
  tMkt = (await dangNhap('mkt@k.vn', '123456')).token; tTruong = (await dangNhap('truong@k.vn', '123456')).token; tGD = (await dangNhap('gd@k.vn', '123456')).token;
  KHOA = JSON.parse(Buffer.from((await api('/tram/khoa', 'POST')).j.ma_ghep.slice(5).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).khoa; await hub('/hub/trang_thai', 'POST', { may: 'Ngoc-Han', ban: '9.156' });
  await api('/chien-luoc', 'PUT', { dinh_vi: 'Keo ron Kingsmen' }); await api('/seeding/thong-diep', 'POST', { ten: 'Ron không ố', y_chinh: 'ron sạch' }, tMkt);
  tk1 = (await api('/seeding/tai-khoan', 'POST', { nhan: 'Anh Tư thợ', tram_id: 'facebook', giong: 'THO', nhip_ngay: 2 }, tTruong)).j.id; tk2 = (await api('/seeding/tai-khoan', 'POST', { nhan: 'Thầu Bảy', tram_id: 'facebook-2', giong: 'THAU', nhip_ngay: 2 }, tTruong)).j.id; tk3 = (await api('/seeding/tai-khoan', 'POST', { nhan: 'Chị Lan', tram_id: 'facebook-3', giong: 'CHU_NHA', nhip_ngay: 2 }, tTruong)).j.id;
  nhomA = (await api('/seeding/nhom', 'POST', { ten: 'Hội thợ ốp lát', link_hoac_id: 'https://www.facebook.com/groups/tho', quy_tac: { cam_ban_hang: true }, tai_khoan_ids: [tk1, tk2, tk3], nhip_tuan: 3 }, tMkt)).j.id;
  AI_TEXT = JSON.stringify({ bien_the: [{ stt: 1, noi_dung: 'Hôm bữa làm nhà chị Lan, ron Kingsmen vẫn sáng sau mùa mưa, thợ như tôi thấy ổn.', binh_luan: [{ vai: 'HOI_KN', text: 'Bác dùng loại nào vậy?' }, { vai: 'XAC_NHAN', text: 'Tôi cũng xài, ron sạch thật' }, { vai: 'HOI_MUA', text: 'Mua ở đâu anh?' }] }] });
  let r = await api('/seeding/goi', 'POST', {}, tMkt); goiId = r.j.id; await api('/seeding/goi/' + goiId + '/duyet', 'POST', {}, tTruong); r = await api('/seeding/goi/' + goiId + '/xep-lich', 'POST', {}, tMkt); assert.equal(r.j.xep, 1);
  const v = r.j.db.seeding.viec.find(x => x.goi_id === goiId); v1 = v.id; btId = v.bien_the_id; await gat('B15', 'AI_TU_LAM');
  await api('/seeding/viec/' + v1 + '/dang-ngay', 'POST', {}, tMkt);
});
test('bình luận dẫn dắt: bài lên (link) → 2 bình luận cho 2 tài khoản KHÁC người đăng, bỏ vai hỏi mua vì nhóm cấm bán hàng → thay bằng vai còn lại, giãn 30–180 phút; không lên lịch trùng', async () => {
  let h = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_dang', bang: 'content_os.seeding_dang_ket_qua', luot: 'd1', dong: [{ viec_id: v1, ok: true, link: 'https://www.facebook.com/groups/tho/posts/111' }] }); assert.equal(h.j.cap_nhat, 1);
  const b = (await api('/bootstrap', 'GET', null, tMkt)).j.db.seeding; const v = b.viec.find(x => x.id === v1); assert.equal(v.trang_thai, 'DA_DANG'); const bl = b.binh_luan.filter(x => x.viec_id === v1); assert.equal(bl.length, 2);
  assert.ok(bl.every(x => x.tai_khoan_id !== v.tai_khoan_id), 'không phải người đăng'); assert.equal(new Set(bl.map(x => x.tai_khoan_id)).size, 2, 'hai tài khoản khác nhau'); assert.ok(!bl.some(x => x.vai === 'HOI_MUA'), 'nhóm cấm bán hàng → không hỏi mua'); assert.deepEqual(bl.map(x => x.vai).sort(), ['HOI_KN', 'XAC_NHAN']);
  const d0 = Date.parse(v.dang_at); for (const x of bl) { const dt = (Date.parse(x.gio) - d0) / 60000; assert.ok(dt >= 30 && dt <= 400, 'giãn ' + dt); } assert.ok(Date.parse(bl[0].gio) !== Date.parse(bl[1].gio));
  await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_dang', bang: 'content_os.seeding_dang_ket_qua', luot: 'd2', dong: [{ viec_id: v1, ok: true, link: 'https://www.facebook.com/groups/tho/posts/111' }] });
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM binh_luan_seeding WHERE viec_id=?`).get(v1).n, 2, 'không nhân đôi');
});
test('tới giờ: Trạm sống → DANG_GUI + lệnh seeding_binh_luan; /hub/viec/seeding_binh_luan có hồ sơ tài khoản; kết quả ok → DA_DANG; lỗi → thử lại rồi LOI; checkpoint → tạm dừng + ghi lịch sử', async () => {
  DB.raw.prepare(`UPDATE binh_luan_seeding SET gio=? WHERE viec_id=?`).run(new Date(Date.now() - 60e3).toISOString(), v1);
  let r = await api('/may/chay-thu', 'POST', { agent: 'BINH_LUAN_SEEDING' }); assert.match(r.j.kq[0].tom_tat, /Trạm 2/); const l = await hub('/hub/lenh'); assert.ok(l.j.lenh.some(x => x.viec === 'chay_agent' && x.tham_so.viec === 'seeding_binh_luan'));
  let h = await hub('/hub/viec/seeding_binh_luan'); assert.equal(h.j.viec.length, 2); const [a, b] = h.j.viec; assert.match(a.link, /posts\/111/); assert.ok(['facebook-2', 'facebook-3', 'facebook'].includes(a.tai_khoan.tram_id)); assert.ok(a.text);
  h = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_binh_luan', bang: 'content_os.seeding_binh_luan_ket_qua', luot: 'b1', dong: [{ id: a.id, ok: true }, { id: b.id, ok: false, loi: 'không thấy ô bình luận' }] }); assert.equal(h.j.cap_nhat, 2);
  let s = (await api('/bootstrap', 'GET', null, tMkt)).j.db.seeding.binh_luan; assert.equal(s.find(x => x.id === a.id).trang_thai, 'DA_DANG'); const bb = s.find(x => x.id === b.id); assert.equal(bb.trang_thai, 'CHO'); assert.equal(bb.lan_thu, 1);
  DB.raw.prepare(`UPDATE binh_luan_seeding SET gio=?, trang_thai='DANG_GUI' WHERE id=?`).run(new Date().toISOString(), b.id);
  h = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_binh_luan', bang: 'content_os.seeding_binh_luan_ket_qua', luot: 'b2', dong: [{ id: b.id, ok: false, checkpoint: true, loi: 'checkpoint' }] });
  const bd = (await api('/bootstrap', 'GET', null, tMkt)).j.db; assert.equal(bd.seeding.binh_luan.find(x => x.id === b.id).trang_thai, 'LOI'); const tkB = bd.seeding.tai_khoan.find(t => t.id === bb.tai_khoan_id); assert.equal(tkB.song, false); assert.equal(tkB.suc_khoe.checkpoints.length, 1); assert.equal(tkB.nhip_ngay, 2, 'mới 1 checkpoint → chưa hạ nhịp');
  // checkpoint lần 2 → tự hạ nhịp còn 1, dừng 72 giờ
  DB.raw.prepare(`INSERT INTO viec_seeding (id,goi_id,bien_the_id,nhom_id,tai_khoan_id,cach,gio_dang,trang_thai,created_at,updated_at) VALUES ('vs_cp',?,?,?,?,'TRAM',?,'DANG_GUI',?,?)`).run(goiId, btId, nhomA, bb.tai_khoan_id, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
  await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_dang', bang: 'content_os.seeding_dang_ket_qua', luot: 'd3', dong: [{ viec_id: 'vs_cp', ok: false, checkpoint: true, loi: 'checkpoint lần 2' }] });
  const t2 = (await api('/bootstrap', 'GET', null, tMkt)).j.db.seeding.tai_khoan.find(t => t.id === bb.tai_khoan_id); assert.equal(t2.nhip_ngay, 1); assert.ok(Date.parse(t2.tam_dung_den) > Date.now() + 60 * 3600e3, 'dừng 72 giờ');
  // B15 NGƯỜI → giao bình luận tay
  await api('/buoc/B15', 'PATCH', { nguoi_thuc_hien: 'NGUOI' }); DB.raw.prepare(`INSERT INTO binh_luan_seeding (id,viec_id,tai_khoan_id,vai,text,gio,trang_thai,created_at) VALUES ('bl_tay',?,?,'HOI_KN','x',?,'CHO',?)`).run(v1, tk1, new Date(Date.now() - 1000).toISOString(), new Date().toISOString());
  r = await api('/may/chay-thu', 'POST', { agent: 'BINH_LUAN_SEEDING' }); assert.match(r.j.kq[0].tom_tat, /tay 1/); assert.ok(r.j.db.cong_viec.some(c => c.loai === 'BINH_LUAN_TAY' && c.doi_tuong_id === 'bl_tay'));
  r = await api('/seeding/binh-luan/bl_tay/da-dang', 'POST', {}, tMkt); assert.equal(r.j.db.seeding.binh_luan.find(x => x.id === 'bl_tay').trang_thai, 'DA_DANG'); assert.ok(!r.j.db.cong_viec.some(c => c.loai === 'BINH_LUAN_TAY' && c.trang_thai === 'MO')); await api('/buoc/B15', 'PATCH', { nguoi_thuc_hien: 'AI_TU_LAM' });
});
test('lead AI phân loại: kiểm bài → bình luận → AI chia loại/mức/gợi ý; tiêu cực → việc xử lý; bỏ bình luận của tài khoản seeding; không AI → từ khoá', async () => {
  DB.raw.prepare(`UPDATE viec_seeding SET dang_at=? WHERE id=?`).run(new Date(Date.now() - 3 * 864e5).toISOString(), v1);
  AI_TEXT = JSON.stringify({ ds: [{ i: 0, loai: 'HOI_KY_THUAT', muc_do: 2, goi_y: 'Bác trét khi gạch khô, miết đều là đẹp.' }, { i: 1, loai: 'TIEU_CUC', muc_do: 3, goi_y: 'Mình chỉ chia sẻ trải nghiệm thôi bác.' }, { i: 2, loai: 'KHAC', muc_do: 0 }, { i: 3, loai: 'HOI_MUA', muc_do: 3, goi_y: 'Anh inbox mình gửi chỗ mua gần anh.' }] });
  const nd1 = DB.raw.prepare(`SELECT noi_dung FROM bien_the WHERE id=?`).get(btId).noi_dung;
  let h = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_kiem', bang: 'content_os.seeding_kiem', luot: 'k1', dong: [{ viec_id: v1, song: true, noi_dung: nd1, react: 9, binh_luan: 5, binh_luan_ds: [{ nguoi: 'Nam', text: 'trét kiểu gì cho đều vậy bác' }, { nguoi: 'Hùng', text: 'quảng cáo trá hình à' }, { nguoi: 'Tèo', text: 'đẹp' }, { nguoi: 'Long', text: 'cho xin chỗ mua' }, { nguoi: 'Thầu Bảy', text: 'Tôi cũng xài, ron sạch thật' }] }] }); assert.equal(h.j.cap_nhat, 1);
  const b = (await api('/bootstrap', 'GET', null, tMkt)).j.db; const leads = b.seeding.lead.filter(l => l.viec_id === v1); assert.equal(leads.length, 3, 'kỹ thuật + tiêu cực + hỏi mua (bỏ "đẹp" và bình luận của Thầu Bảy)');
  const kt = leads.find(l => l.loai === 'HOI_KY_THUAT'); assert.equal(kt.muc_do, 2); assert.match(kt.goi_y, /trét/); const tc = leads.find(l => l.loai === 'TIEU_CUC'); assert.equal(tc.nguoi, 'Hùng');
  assert.ok(b.cong_viec.some(c => c.loai === 'XU_LY_TIEU_CUC' && c.doi_tuong_id === tc.id)); assert.equal(b.cong_viec.filter(c => c.loai === 'LEAD_SEEDING' && c.trang_thai === 'MO').length, 2); assert.equal(b.seeding.viec.find(v => v.id === v1).kiem.lead, 2, 'lead = hỏi mua/giá/kỹ thuật, không tính tiêu cực');
  assert.equal(DB.raw.prepare(`SELECT COUNT(*) n FROM ai_usage WHERE tinh_nang='phan_loai_lead'`).get().n, 1);
  // không khoá AI → từ khoá
  delete env.ANTHROPIC_API_KEY; DB.raw.prepare(`UPDATE viec_seeding SET so_lan_kiem=0, trang_thai='DA_DANG' WHERE id=?`).run(v1);
  h = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_kiem', bang: 'content_os.seeding_kiem', luot: 'k2', dong: [{ viec_id: v1, song: true, noi_dung: nd1, react: 9, binh_luan: 6, binh_luan_ds: [{ nguoi: 'Vũ', text: 'giá bao nhiêu một hộp' }] }] });
  const l2 = (await api('/bootstrap', 'GET', null, tMkt)).j.db.seeding.lead.find(l => l.nguoi === 'Vũ'); assert.equal(l2.loai, 'HOI_GIA'); assert.equal(l2.muc_do, 2); assert.equal(l2.goi_y, ''); env.ANTHROPIC_API_KEY = 'k';
});
test('nuôi tài khoản: lên lịch 1 lượt/ngày cho tài khoản sống có nhóm, giờ 8–21h; tới giờ → Trạm; /hub/viec/seeding_nuoi; kết quả → sức khoẻ nuoi_so; không lên lịch lần 2 trong ngày', async () => {
  let r = await api('/may/chay-thu', 'POST', { agent: 'LEN_LICH_NUOI' }); const nu = r.j.db.seeding.nuoi; const song = r.j.db.seeding.tai_khoan.filter(t => t.song).length; assert.ok(nu.length >= 1 && nu.length <= song, 'nuôi ' + nu.length + ' / sống ' + song); for (const x of nu) { const g = (new Date(x.gio).getUTCHours() + 7) % 24; assert.ok(g >= 8 && g <= 21, 'giờ ' + g); assert.equal(x.nhom_id, nhomA); }
  r = await api('/may/chay-thu', 'POST', { agent: 'LEN_LICH_NUOI' }); assert.equal(r.j.db.seeding.nuoi.length, nu.length, 'không nhân đôi trong ngày');
  const x = nu[0]; DB.raw.prepare(`UPDATE nuoi_seeding SET gio=? WHERE id=?`).run(new Date(Date.now() - 1000).toISOString(), x.id);
  r = await api('/may/chay-thu', 'POST', { agent: 'NUOI_TAI_KHOAN' }); assert.match(r.j.kq[0].tom_tat, /nuôi 1/); let h = await hub('/hub/viec/seeding_nuoi'); assert.equal(h.j.viec.length, 1); assert.equal(h.j.viec[0].phut, 4); assert.equal(h.j.viec[0].tim, 3); assert.match(h.j.viec[0].nhom.link_hoac_id, /groups\/tho/);
  h = await hub('/hub/nap', 'POST', { viec: 'content_os.seeding_nuoi', bang: 'content_os.seeding_nuoi_ket_qua', luot: 'n1', dong: [{ id: x.id, ok: true, tim: 2, xem_phut: 4.2 }] }); assert.equal(h.j.cap_nhat, 1);
  const b = (await api('/bootstrap', 'GET', null, tMkt)).j.db.seeding; assert.equal(b.nuoi.find(y => y.id === x.id).trang_thai, 'XONG'); assert.equal(b.tai_khoan.find(t => t.id === x.tai_khoan_id).suc_khoe.nuoi_so, 1);
  r = await api('/seeding/nuoi/' + x.id + '/huy', 'POST', {}, tMkt); assert.equal(r.status, 200);
});
test('tự chỉnh nhịp nhóm: bị gỡ 2 bài/30 ngày → hạ nhịp tuần 3→2 + việc báo Trưởng MKT (một lần/tháng); nhóm tốt → đề xuất SEEDING_NHIP, GĐ duyệt → tăng nhịp', async () => {
  const now = new Date().toISOString(); for (let i = 0; i < 2; i++) DB.raw.prepare(`INSERT INTO viec_seeding (id,goi_id,bien_the_id,nhom_id,tai_khoan_id,cach,gio_dang,trang_thai,kiem,created_at,updated_at) VALUES (?,?,?,?,?,'TRAM',?,'KHONG_DAT',?,?,?)`).run('go' + i, goiId, btId, nhomA, tk1, now, JSON.stringify({ song: false }), now, now);
  let r = await api('/may/chay-thu', 'POST', { agent: 'LEN_LICH_NUOI' }); assert.match(r.j.kq[0].tom_tat, /Hạ nhịp 1 nhóm/); assert.equal(r.j.db.seeding.nhom.find(n => n.id === nhomA).nhip_tuan, 2); assert.ok(r.j.db.cong_viec.some(c => c.loai === 'NHIP_SEEDING' && c.doi_tuong_id === nhomA));
  r = await api('/may/chay-thu', 'POST', { agent: 'LEN_LICH_NUOI' }); assert.equal(r.j.db.seeding.nhom.find(n => n.id === nhomA).nhip_tuan, 2, 'không hạ tiếp trong cùng tháng');
  // nhóm tốt
  const nhomB = (await api('/seeding/nhom', 'POST', { ten: 'Nhóm tốt', link_hoac_id: 'https://www.facebook.com/groups/tot', tai_khoan_ids: [tk1], nhip_tuan: 2 }, tMkt)).j.id;
  for (let i = 0; i < 9; i++) DB.raw.prepare(`INSERT INTO viec_seeding (id,goi_id,bien_the_id,nhom_id,tai_khoan_id,cach,gio_dang,trang_thai,kiem,created_at,updated_at) VALUES (?,?,?,?,?,'TRAM',?,'DAT',?,?,?)`).run('tot' + i, goiId, btId, nhomB, tk1, now, JSON.stringify({ song: true, react: 12 }), now, now);
  r = await api('/may/chay-thu', 'POST', { agent: 'LEN_LICH_NUOI' }); assert.match(r.j.kq[0].tom_tat, /đề xuất tăng 1/); const dx = r.j.db.de_xuat.find(d => d.loai === 'SEEDING_NHIP'); assert.equal(dx.noi_dung.nhip_tuan, 3);
  r = await api('/de-xuat/' + dx.id + '/quyet', 'POST', { quyet: 'DUYET' }, tGD); assert.equal(r.status, 200); assert.equal(r.j.db.seeding.nhom.find(n => n.id === nhomB).nhip_tuan, 3);
  // tắt tự chỉnh
  await api('/cau-hinh/seeding', 'PUT', { cau_hinh: { nhip_tu_chinh: false } }); r = await api('/may/chay-thu', 'POST', { agent: 'LEN_LICH_NUOI' }); assert.match(r.j.kq[0].tom_tat, /đang tắt/);
});
