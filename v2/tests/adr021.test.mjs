// ADR-021 — HỒ SƠ ĐỊNH VỊ: lõi (thương hiệu, định vị từng dòng, trụ thông điệp, quy tắc claim) + ý đồ triển khai (gợi ý hướng đi cho gốc content)
// + xu hướng & cái mới (cả đội thêm, tự hết hạn). Trợ lý viết theo DÒNG của bài; mục mang ý đồ; B3 gắn ý đồ; thông số nhập bằng chuỗi không còn mất.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoD1 } from './d1.mjs';
const realFetch = globalThis.fetch; let GUI = [];
const BAI = '{"tieu_de":"Ron ban công","hook":"Ban công nắng dùng keo gì?","sections":[{"label":"Cảnh 1","text":"Chọn đúng keo cho khu vực nắng","hinh":"ban công"}],"cta":"Nhắn tư vấn"}';
globalThis.fetch = async (url, opt) => { if (String(url).includes('api.anthropic.com')) { GUI.push(JSON.parse(opt.body)); return new Response(JSON.stringify({ content: [{ type: 'text', text: BAI }], usage: { input_tokens: 1000, output_tokens: 100 } }), { status: 200 }); } return realFetch(url, opt); };
const worker = (await import('../worker/index.js')).default;
const taoEnv = (DB) => ({ DB, ANTHROPIC_API_KEY: 'k', APP_BASE_URL: 'https://os.kingsmen.vn', ASSETS: { fetch: async () => new Response('x') }, MEDIA: { get: async () => null, put: async () => ({}), delete: async () => {} } });
let env; let TOKEN = null;
const api = async (p, method = 'GET', body) => { const r = await worker.fetch(new Request('https://x/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); return { s: r.status, j: await r.json() }; };
const PILLARS = ['Chuyên dụng đúng bài toán', 'Đẹp chuẩn thiết kế', 'Chuẩn thi công & chứng minh', 'Bền lâu, ít rủi ro hậu mãi', 'Công trình thật & người thật'].map((ten, i) => ({ ten, ty_trong: 20, thu_tu: i + 1 }));
const SP = [
  { ma: 'G3000', ten: 'Keo chít mạch G3000', dong: 'Keo chít mạch', thong_so: 'Gốc: epoxy tiêu chuẩn · Khu vực: trong nhà', bao_hanh: '1 năm chống ố vàng, bạc màu · 30 năm chống thấm bẩn' },
  { ma: 'G7000', ten: 'Keo chít mạch G7000', dong: 'Keo chít mạch', bao_hanh: '30 năm chống ố vàng, bạc màu · 30 năm chống thấm bẩn' },
  { ma: 'TL', ten: 'Terrazy Leveling', dong: 'Terrazy', bao_hanh: 'Chưa chốt' },
];
const batDau = async () => { const DB = taoD1(); env = taoEnv(DB); GUI = []; TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token;
  const r = await api('/nhap/danh-muc', 'POST', { san_pham: SP, pillars: PILLARS }); assert.equal(r.s, 200); return DB; };

test('021a: hồ sơ gốc đọc được; thông số nhập bằng chuỗi lưu thành mảng; ý đồ sửa / thêm / tắt chỉ Trưởng MKT–Admin; claim đề xuất thêm một chạm', async () => {
  const DB = await batDau();
  const ts = JSON.parse(DB.raw.prepare(`SELECT thong_so FROM san_pham WHERE ma='G3000'`).get().thong_so);
  assert.deepEqual(ts, [{ k: 'Gốc', v: 'epoxy tiêu chuẩn' }, { k: 'Khu vực', v: 'trong nhà' }], 'chuỗi "a: b · c: d" → mảng {k,v}, không còn thành []');
  const g = (await api('/ho-so-dinh-vi')).j; assert.equal(g.luu, false, 'chưa ai sửa → bản gốc từ tài liệu');
  assert.deepEqual(g.ho_so.dong.map((d) => d.dong), ['Keo chít mạch', 'Terrazy', 'Finex F300']);
  assert.equal(g.ho_so.dong[0].cau_dinh_vi, 'Keo chít mạch chuyên dụng cho từng khu vực'); assert.equal(g.ho_so.dong[0].tru_cot.length, 5);
  assert.ok(g.ho_so.y_do.length >= 15 && g.ho_so.y_do.every((y) => /^[a-z0-9_]{3,40}$/.test(y.id)));
  // MKT không sửa lõi / ý đồ, nhưng thêm được xu hướng
  await api('/users', 'POST', { ho_ten: 'MKT', email: 'mkt@k.vn', password: '123456', vai_tro: 'MARKETING' }); const tAdmin = TOKEN; TOKEN = (await api('/login', 'POST', { email: 'mkt@k.vn', password: '123456' })).j.token;
  assert.equal((await api('/ho-so-dinh-vi/y-do', 'POST', { ten: 'Thử' })).s, 403);
  assert.equal((await api('/ho-so-dinh-vi', 'PUT', { ho_so: g.ho_so })).s, 403);
  const x = await api('/xu-huong', 'POST', { noi_dung: 'ASMR chà nhám lộ hạt đang lên trên TikTok', dong: 'Terrazy', loai: 'DINH_DANG', han_tuan: 4 }); assert.equal(x.s, 200);
  assert.equal(x.j.db.xu_huong.length, 1); assert.equal(x.j.db.xu_huong[0].dong, 'Terrazy');
  TOKEN = tAdmin;
  // sửa một ý đồ + thêm ý đồ mới + tắt một ý đồ
  const y1 = await api('/ho-so-dinh-vi/y-do', 'POST', { id: 'keo_colormatch', ten: 'ColorMatch™ – ron đồng màu gạch', dong: 'Keo chít mạch', pillar: 'Đẹp chuẩn thiết kế', thong_diep: 'Ron hoà vào gạch', uu_tien: 1, truc: { cau_truc: 'TRUOC_SAU', mo_dau: 'XAU' } });
  assert.equal(y1.s, 200); const k = y1.j.ho_so.y_do.find((y) => y.id === 'keo_colormatch'); assert.equal(k.thong_diep, 'Ron hoà vào gạch'); assert.equal(k.truc.cau_truc, 'TRUOC_SAU'); assert.equal(k.truc.mo_dau, '', 'giá trị trục lạ bị bỏ'); assert.equal(k.nguon, 'TAI_LIEU');
  const y2 = await api('/ho-so-dinh-vi/y-do', 'POST', { ten: 'Mùa mưa – ron không thấm', dong: 'Keo chít mạch', pillar: 'Bền lâu, ít rủi ro hậu mãi', thong_diep: 'Mùa mưa là lúc ron kém lộ ra', tu_khoa: 'mùa mưa\nthấm' });
  assert.equal(y2.s, 200); assert.match(y2.j.id, /^yd_/); assert.equal(y2.j.ho_so.y_do.find((y) => y.id === y2.j.id).nguon, 'NGUOI'); assert.equal(y2.j.luu, true);
  assert.equal((await api('/ho-so-dinh-vi/y-do', 'POST', { ten: 'Sai dòng', dong: 'Không có' })).s, 400);
  const y3 = await api('/ho-so-dinh-vi/y-do', 'POST', { ...y2.j.ho_so.y_do.find((y) => y.id === 'tz_mono_co_gian'), active: false }); assert.equal(y3.s, 200);
  const b = (await api('/ho-so-dinh-vi')).j; assert.ok(!(await api('/ho-so-dinh-vi')).j.ho_so.y_do.find((y) => y.id === 'tz_mono_co_gian').active);
  // bootstrap chỉ đưa ý đồ đang bật
  const boot = (await api('/xu-huong', 'POST', { noi_dung: 'Gam terracotta phối hạt trắng' })).j.db; assert.ok(!boot.y_do.some((y) => y.id === 'tz_mono_co_gian')); assert.ok(boot.y_do.some((y) => y.id === y2.j.id));
  // PUT cả hồ sơ: phiên cũ → 409 (hai người cùng sửa không đè mù); mã ý đồ trùng → 400
  assert.equal((await api('/ho-so-dinh-vi', 'PUT', { ho_so: b.ho_so, phien: 0 })).s, 409);
  assert.equal((await api('/ho-so-dinh-vi', 'PUT', { ho_so: { ...b.ho_so, y_do: [...b.ho_so.y_do, b.ho_so.y_do[0]] }, phien: b.ho_so.phien })).s, 400);
  const p = await api('/ho-so-dinh-vi', 'PUT', { ho_so: { ...b.ho_so, thuong_hieu: { ...b.ho_so.thuong_hieu, tagline: 'Kingsmen – thử' } }, phien: b.ho_so.phien }); assert.equal(p.s, 200); assert.equal(p.j.ho_so.thuong_hieu.tagline, 'Kingsmen – thử');
  // nạp lại từ tài liệu: giữ ý đồ tự thêm và trạng thái tắt
  const nl = (await api('/ho-so-dinh-vi/nap-lai', 'POST', {})).j; assert.equal(nl.ho_so.thuong_hieu.tagline, 'Kingsmen – Vật liệu hoàn thiện chuyên dụng (thế hệ mới)');
  assert.ok(nl.ho_so.y_do.some((y) => y.id === y2.j.id)); assert.equal(nl.ho_so.y_do.find((y) => y.id === 'tz_mono_co_gian').active, false);
  // claim đề xuất: thêm những cụm chưa có, lần hai không thêm trùng
  const truoc = nl.claim_thieu.length; assert.ok(truoc > 0); const c1 = (await api('/ho-so-dinh-vi/claim', 'POST', {})).j; assert.equal(c1.them, truoc); assert.equal(c1.claim_thieu.length, 0);
  assert.equal((await api('/ho-so-dinh-vi/claim', 'POST', {})).j.them, 0);
  assert.equal(DB.raw.prepare(`SELECT muc_do FROM claim_cam WHERE cum_tu='chống ố vàng 30 năm'`).get().muc_do, 'CANH_BAO');
});

test('021b: trợ lý viết theo dòng của mục — hết "keo ron gạch" cứng; định vị + ý đồ + xu hướng + sản phẩm trong dòng; thông số chuỗi cũ vẫn đọc được', async () => {
  const DB = await batDau();
  await api('/xu-huong', 'POST', { noi_dung: 'Trend âm thanh "đổi nhà" đang lên', loai: 'TREND' });
  await api('/xu-huong', 'POST', { noi_dung: 'Chỉ cho Terrazy: ASMR chà nhám', dong: 'Terrazy' });
  const m = (await api('/muc', 'POST', { tieu_de: 'Ban công nắng dùng keo gì', dinh_dang: 'VIDEO', dong: 'Keo chít mạch', y_do: 'keo_dung_khu_vuc' })).j.id;
  const r = await api('/noi-dung/ai-viet', 'POST', { muc_id: m }); assert.equal(r.s, 200); assert.equal(r.j.ok, true);
  const q = GUI.at(-1); const sys = q.system; const usr = q.messages[0].content;
  assert.ok(!/keo ron gạch/.test(sys + usr), 'không còn vai "keo ron gạch" cứng'); assert.match(sys, /Kingsmen — Keo chít mạch \("Keo chít mạch chuyên dụng cho từng khu vực"\)/);
  assert.match(sys, /Định vị là la bàn, không phải khuôn/);
  assert.match(usr, /Ý ĐỒ TRIỂN KHAI \(hướng chiến lược của bài — giữ đúng thông điệp lõi, cách kể tự do\): Đúng keo – đúng khu vực/);
  assert.match(usr, /Gợi ý cách kể \(không bắt buộc\): mục đích hướng dẫn thi công, cấu trúc danh sách, kiểu mở đầu câu hỏi, phong cách người nói/);
  assert.match(usr, /Trụ "Bền màu dài lâu – ít rủi ro hậu mãi"/); assert.match(usr, /SẢN PHẨM TRONG DÒNG .*G3000 1 năm chống ố vàng/);
  assert.match(usr, /THÔNG SỐ CHUNG CỦA HỆ KEO CHÍT MẠCH/); assert.match(usr, /Trend âm thanh "đổi nhà"/); assert.ok(!/ASMR chà nhám/.test(usr), 'xu hướng dòng khác không lọt vào');
  // bài Terrazy: vai + quy tắc nói đúng của Terrazy, không lẫn trụ keo
  const sp = DB.raw.prepare(`SELECT id FROM san_pham WHERE ma='TL'`).get().id;
  await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'POST', tieu_de: 'Đổi sàn không đục phá', san_pham_id: sp }); const q2 = GUI.at(-1);
  assert.match(q2.system, /Kingsmen — Terrazy/); assert.match(q2.messages[0].content, /"Nhanh gọn, không chà nhám, hạn chế bụi tối đa" thay cho ""Không bụi" tuyệt đối \(Leveling\)"/);
  assert.ok(!/Trụ "ColorMatch/.test(q2.messages[0].content) && !/THÔNG SỐ CHUNG CỦA HỆ KEO/.test(q2.messages[0].content)); assert.match(q2.messages[0].content, /ASMR chà nhám/);
  // chưa rõ dòng: tóm tắt thương hiệu mẹ + câu định vị từng dòng
  await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'ANH', tieu_de: 'Chào tháng mới' }); const q3 = GUI.at(-1);
  assert.match(q3.system, /Kingsmen — vật liệu hoàn thiện chuyên dụng \(keo chít mạch, Terrazy, Finex\)/); assert.match(q3.messages[0].content, /· Terrazy: Hệ bề mặt terrazzo chuyên dụng/);
  // thông số cũ lưu chuỗi thô (không JSON) vẫn đọc được thay vì "[]"
  DB.raw.prepare(`UPDATE san_pham SET thong_so='Gốc epoxy · tuýp 400 ml' WHERE ma='G7000'`).run(); const g7 = DB.raw.prepare(`SELECT id FROM san_pham WHERE ma='G7000'`).get().id;
  await api('/noi-dung/ai-viet', 'POST', { dinh_dang: 'VIDEO', tieu_de: 'Sân thượng', san_pham_id: g7 }); assert.match(GUI.at(-1).messages[0].content, /THÔNG SỐ THẬT \(chỉ được dùng những cái này\): Gốc epoxy · tuýp 400 ml/);
});

test('021c: mục mang ý đồ — người chọn (kèm dòng), máy tự gán khi đủ tín hiệu, không gán chéo dòng; B3 gắn ý đồ cùng pillar và rải đều', async () => {
  const DB = await batDau(); const pl = (ten) => DB.raw.prepare(`SELECT id FROM pillars WHERE ten=?`).get(ten).id;
  // người chọn ý đồ → mục nhận luôn dòng của ý đồ; ý đồ khác dòng bị chặn
  const m1 = (await api('/muc', 'POST', { tieu_de: 'Mục trống', dinh_dang: 'VIDEO' })).j.id;
  const c = await api('/muc/' + m1 + '/y-do', 'POST', { y_do: 'tz_doi_san' }); assert.equal(c.s, 200);
  let r = DB.raw.prepare(`SELECT y_do, y_do_boi, dong FROM muc_noi_dung WHERE id=?`).get(m1); assert.deepEqual({ ...r }, { y_do: 'tz_doi_san', y_do_boi: 'NGUOI', dong: 'Terrazy' });
  assert.equal((await api('/muc/' + m1 + '/y-do', 'POST', { y_do: 'keo_colormatch' })).s, 409, 'ý đồ keo cho mục Terrazy');
  assert.equal((await api('/muc/' + m1 + '/y-do', 'POST', { y_do: 'khong_co' })).s, 400);
  await api('/muc/' + m1 + '/y-do', 'POST', { y_do: null }); assert.equal(DB.raw.prepare(`SELECT y_do FROM muc_noi_dung WHERE id=?`).get(m1).y_do, null);
  // máy gán lúc thêm mục: dòng + từ khoá → đúng ý đồ; mục mơ hồ → để trống cho người
  const m2 = (await api('/muc', 'POST', { tieu_de: 'Pha màu ron đồng màu gạch marble', dinh_dang: 'VIDEO', dong: 'Keo chít mạch', pillar_id: pl('Đẹp chuẩn thiết kế') })).j.id;
  r = DB.raw.prepare(`SELECT y_do, y_do_boi FROM muc_noi_dung WHERE id=?`).get(m2); assert.equal(r.y_do, 'keo_colormatch'); assert.equal(r.y_do_boi, 'MAY');
  const m3 = (await api('/muc', 'POST', { tieu_de: 'Bài chào tuần mới', dinh_dang: 'POST' })).j.id; assert.equal(DB.raw.prepare(`SELECT y_do FROM muc_noi_dung WHERE id=?`).get(m3).y_do, null, 'không đủ tín hiệu → không đoán');
  const m4 = (await api('/muc', 'POST', { tieu_de: 'Bắt trend thử thách đang hot với keo', dinh_dang: 'VIDEO' })).j.id; assert.equal(DB.raw.prepare(`SELECT y_do FROM muc_noi_dung WHERE id=?`).get(m4).y_do, 'bat_trend');
  const m5 = (await api('/muc', 'POST', { tieu_de: 'Sàn cải tạo không đục phá nền cũ', dinh_dang: 'VIDEO' })).j.id; assert.equal(DB.raw.prepare(`SELECT y_do FROM muc_noi_dung WHERE id=?`).get(m5).y_do, 'tz_doi_san', 'chưa rõ dòng nhưng tiêu đề nói rõ (≥ 2 từ khoá)');
  // tạo mục từ ý đồ (UI "＋ Tạo mục"): dòng lấy theo ý đồ; ý đồ đang tắt bị chặn
  const m6 = (await api('/muc', 'POST', { tieu_de: 'Mặt tiền thay áo đá', dinh_dang: 'VIDEO', y_do: 'tz_wall_ao_da' })).j.id; assert.equal(DB.raw.prepare(`SELECT dong FROM muc_noi_dung WHERE id=?`).get(m6).dong, 'Terrazy');
  const ph = (await api('/ho-so-dinh-vi')).j; assert.equal(ph.phu.tz_wall_ao_da.thang_nay, 1); assert.equal(ph.phu.keo_colormatch.thang_nay, 1); assert.equal(ph.chua_y_do, 2, 'm1 (đã bỏ) + m3');
  // B3: kế hoạch tháng thiếu 4 bài pillar "Chuẩn thi công & chứng minh" → mỗi mục một ý đồ cùng pillar, rải đều, tiêu đề là đề bài gợi ý
  const th = DB.raw.prepare(`SELECT strftime('%Y-%m','now') t`).get().t;
  await api('/ke-hoach/' + th, 'PUT', { chi_tieu: { tong_bai: 4, theo_pillar: { [pl('Chuẩn thi công & chứng minh')]: 4 }, theo_dinh_dang: { VIDEO: 4 }, theo_kenh: {}, theo_muc_tieu: {}, ket_qua: {} }, dinh_huong: '' });
  const t = await api('/ke-hoach/' + th + '/tao-muc', 'POST', {}); assert.equal(t.s, 200); assert.ok(t.j.tao >= 4);
  const tao = DB.raw.prepare(`SELECT y_do, y_do_boi, dong, tieu_de FROM muc_noi_dung WHERE tao_boi='AGENT'`).all();
  const yds = (await api('/ho-so-dinh-vi')).j.ho_so.y_do; const cungPillar = yds.filter((y) => y.pillar === 'Chuẩn thi công & chứng minh').map((y) => y.id);
  assert.ok(tao.every((x) => cungPillar.includes(x.y_do) && x.y_do_boi === 'MAY'), 'mọi mục B3 mang ý đồ cùng pillar');
  assert.ok(new Set(tao.map((x) => x.y_do)).size >= 3, 'rải đều nhiều ý đồ, không dồn một');
  assert.ok(tao.every((x) => !/đặt tiêu đề/.test(x.tieu_de)), 'tiêu đề lấy đề bài gợi ý của ý đồ');
  assert.ok(tao.filter((x) => x.y_do.startsWith('tz_')).every((x) => x.dong === 'Terrazy') && tao.filter((x) => x.y_do.startsWith('keo_')).every((x) => x.dong === 'Keo chít mạch'));
});

test('021d: sửa thông số 26/09 chạy một lần qua cron — điền sản phẩm còn "[]", không đè thông số đã có, lần sau không chạy lại', async () => {
  const DB = await batDau();
  DB.raw.prepare(`UPDATE san_pham SET thong_so='[]' WHERE ma IN ('G7000','TL')`).run();
  const ctx = { ps: [], waitUntil(p) { this.ps.push(p); } }; await worker.scheduled({}, env, ctx); await Promise.all(ctx.ps);
  const g7 = JSON.parse(DB.raw.prepare(`SELECT thong_so FROM san_pham WHERE ma='G7000'`).get().thong_so); assert.equal(g7[0].k, 'Gốc'); assert.equal(g7[1].v, 'Ngoài trời hoàn toàn');
  assert.ok(JSON.parse(DB.raw.prepare(`SELECT thong_so FROM san_pham WHERE ma='TL'`).get().thong_so).some((x) => x.k === 'Định mức' && x.v === '3 kg/m²'));
  assert.equal(JSON.parse(DB.raw.prepare(`SELECT thong_so FROM san_pham WHERE ma='G3000'`).get().thong_so)[0].v, 'epoxy tiêu chuẩn', 'thông số đã có không bị đè');
  assert.ok(!/giá|đ\/kg|đ\/m²/.test(DB.raw.prepare(`SELECT thong_so FROM san_pham WHERE ma='TL'`).get().thong_so), 'không đưa giá vào thông số (AI không nói giá)');
  DB.raw.prepare(`UPDATE san_pham SET thong_so='[]' WHERE ma='G7000'`).run(); const ctx2 = { ps: [], waitUntil(p) { this.ps.push(p); } }; await worker.scheduled({}, env, ctx2); await Promise.all(ctx2.ps);
  assert.equal(DB.raw.prepare(`SELECT thong_so FROM san_pham WHERE ma='G7000'`).get().thong_so, '[]', 'chỉ chạy một lần — người cố ý xoá thì giữ');
  assert.match(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='sua_du_lieu'`).get().cau_hinh, /"so":2/);
});

test('021e: khởi tạo schema chạy MỘT LẦN mỗi phiên bản mã — request sau không chạy lại câu tạo bảng / thêm cột (26/09: ~105 câu mỗi request làm API prod ~22 s)', async () => {
  const DB = taoD1(); env = taoEnv(DB); const goc = DB.prepare.bind(DB); let ddl = 0; DB.prepare = (sql) => { if (/^\s*(CREATE|ALTER)\b/i.test(sql)) ddl++; return goc(sql); };
  TOKEN = (await api('/login', 'POST', { email: 'admin@kingsmen.vn', password: 'admin123' })).j.token; assert.ok(ddl > 50, 'lần đầu: tạo đủ bảng');
  assert.match(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='schema_ban'`).get().cau_hinh, /"ban":"/);
  ddl = 0; for (let i = 0; i < 3; i++) assert.equal((await api('/ho-so-dinh-vi')).s, 200); assert.equal(ddl, 0, 'request sau: không câu DDL nào');
  // isolate mới (env.DB là đối tượng khác, cùng dữ liệu): chỉ đọc dấu phiên bản, không chạy lại
  const DB2 = { ...DB, prepare: (sql) => { if (/^\s*(CREATE|ALTER)\b/i.test(sql)) ddl++; return goc(sql); }, batch: DB.batch && DB.batch.bind(DB), raw: DB.raw }; env = taoEnv(DB2);
  assert.equal((await api('/ho-so-dinh-vi')).s, 200); assert.equal(ddl, 0, 'isolate mới thấy dấu đúng phiên bản → bỏ qua');
  // dấu sai phiên bản (mã schema đổi) → chạy lại một lần rồi ghi dấu mới
  DB.raw.prepare(`UPDATE module_config SET cau_hinh='{"ban":"cu"}' WHERE id='schema_ban'`).run(); const DB3 = { ...DB2 }; env = taoEnv(DB3);
  assert.equal((await api('/ho-so-dinh-vi')).s, 200); assert.ok(ddl > 50, 'phiên bản đổi → chạy lại'); assert.doesNotMatch(DB.raw.prepare(`SELECT cau_hinh FROM module_config WHERE id='schema_ban'`).get().cau_hinh, /"cu"/);
});

test('021f: G1 chốt từ Hồ sơ — bản chụp hồ sơ + pillar + định hướng; so sánh chỉ ra đã đổi gì; cờ đã đổi sau khi chốt; prompt đọc định hướng, không đọc khối chữ cũ', async () => {
  const DB = await batDau();
  let s = (await api('/chien-luoc/so-sanh')).j; assert.equal(s.phien_ban, 0); assert.equal(s.co_ban_cu, false); assert.equal(s.tom_tat.dong[0].cau_dinh_vi, 'Keo chít mạch chuyên dụng cho từng khu vực'); assert.equal(s.tom_tat.pillars.length, 5);
  assert.ok(s.tom_tat.pillars.find((p) => p.ten === 'Chuẩn thi công & chứng minh').so_y_do >= 3);
  await api('/chien-luoc', 'PUT', { dinh_huong: 'Quý 4: đẩy Terrazy Wall + tuyển đội Kingpro' });
  let r = await api('/chien-luoc/chot', 'POST', { ghi_chu: 'bản đầu từ hồ sơ' }); assert.equal(r.s, 200); assert.equal(r.j.db.chien_luoc.phien_ban, 1); assert.equal(r.j.db.chien_luoc.da_doi, false);
  assert.ok(!('ho_so' in r.j.db.chien_luoc_phien_ban[0]), 'bootstrap không mang bản chụp nặng');
  const chup = DB.raw.prepare(`SELECT ho_so, dinh_huong, ma FROM chien_luoc_phien_ban WHERE phien_ban=1`).get(); assert.equal(JSON.parse(chup.ho_so).dong.length, 3); assert.match(chup.dinh_huong, /Terrazy Wall/);
  s = (await api('/chien-luoc/so-sanh')).j; assert.equal(s.da_doi, false); assert.deepEqual(s.thay_doi, []);
  // sửa hồ sơ + pillar + định hướng → so sánh chỉ đúng chỗ đổi; bootstrap báo đã đổi
  await api('/ho-so-dinh-vi/y-do', 'POST', { ten: 'Mùa mưa – ron không thấm', dong: 'Keo chít mạch', pillar: 'Bền lâu, ít rủi ro hậu mãi', thong_diep: 'Mùa mưa lộ ron kém' });
  const k = (await api('/ho-so-dinh-vi')).j.ho_so.y_do.find((y) => y.id === 'tz_mono_co_gian'); await api('/ho-so-dinh-vi/y-do', 'POST', { ...k, active: false });
  const pid = DB.raw.prepare(`SELECT id FROM pillars WHERE ten='Chuẩn thi công & chứng minh'`).get().id; await api('/danh-muc/pillars/' + pid, 'PATCH', { ty_trong: 30 });
  r = await api('/chien-luoc', 'PUT', { dinh_huong: 'Quý 4: Terrazy Wall, Kingpro, keo mùa mưa' }); assert.equal(r.j.db.chien_luoc.da_doi, true);
  s = (await api('/chien-luoc/so-sanh')).j; const td = s.thay_doi.map((x) => x.loai + ' ' + x.noi_dung);
  assert.ok(td.includes('+ Ý đồ "Mùa mưa – ron không thấm"')); assert.ok(td.includes('- Tắt ý đồ "Terrazzo biết co giãn"')); assert.ok(td.includes('~ Pillar "Chuẩn thi công & chứng minh" 20% → 30%')); assert.ok(td.includes('~ Định hướng giai đoạn'));
  assert.equal(td.length, 4, 'không báo thừa: ' + td.join(' | '));
  // chốt bản 2; xem lại bản 1
  r = await api('/chien-luoc/chot', 'POST', {}); assert.equal(r.j.db.chien_luoc.phien_ban, 2); assert.equal(r.j.db.chien_luoc.da_doi, false);
  const v1 = (await api('/chien-luoc/phien-ban/1')).j; assert.equal(v1.co_ho_so, true); assert.equal(v1.tom_tat.y_do_bat, 18); assert.equal(v1.ghi_chu, 'bản đầu từ hồ sơ');
  // prompt: định hướng giai đoạn + tháng, tông giọng hồ sơ, không còn khối chữ cũ
  DB.raw.prepare(`UPDATE chien_luoc SET dinh_vi='KHOI_CHU_CU', tong_giong='TONG_CU', doi_tuong='DOI_TUONG_CU' WHERE id=1`).run();
  const th = DB.raw.prepare(`SELECT strftime('%Y-%m','now') t`).get().t; await api('/ke-hoach/' + th, 'PUT', { chi_tieu: { tong_bai: 1, theo_pillar: {}, theo_dinh_dang: {}, theo_kenh: {}, theo_muc_tieu: {}, ket_qua: {} }, dinh_huong: 'Tháng này đẩy chuẩn thi công' });
  const m = (await api('/muc', 'POST', { tieu_de: 'Chào tháng mới', dinh_dang: 'ANH' })).j.id; await api('/noi-dung/ai-viet', 'POST', { muc_id: m });
  const u = GUI.at(-1).messages[0].content; assert.match(u, /ĐỊNH HƯỚNG GIAI ĐOẠN \(ưu tiên khi chọn góc\): Quý 4: Terrazy Wall, Kingpro, keo mùa mưa/); assert.match(u, /ĐỊNH HƯỚNG THÁNG: Tháng này đẩy chuẩn thi công/);
  assert.ok(!/KHOI_CHU_CU|TONG_CU|DOI_TUONG_CU/.test(u), 'không đọc ba ô chữ cũ'); assert.match(u, /ĐỐI TƯỢNG: Keo chít mạch: Chủ nhà xây \/ sửa/);
});
