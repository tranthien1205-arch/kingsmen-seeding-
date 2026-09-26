// ===== ADR-018 · KHO MẪU MỘT NGUỒN (25/09) =====
// Chủ: "cần xử lý mọi liên đới với nhau đừng chỉ làm vỏ … hoạt động liên hoàn như một cỗ máy thật sự".
// Bảng mau_doan là NGUỒN DUY NHẤT của mọi nhãn: mỗi đoạn hình (HINH) / mỗi câu thoại (LOI) là một dòng, giữ nhãn mô hình mở, nhãn thầy,
// nhãn người, quyết định chất lượng footage; trạng thái có chỉ mục; version chống đè khi hai máy cùng sửa (409).
// Dòng thời gian trong video KHÔNG còn giữ nhãn — mọi màn / máy đọc ra từ đây (timelineCua). Bộ nhãn: trường cố định ở hằng số,
// trường mở rộng + đề xuất ở bảng bo_nhan; bước thi công / bài test vẫn lấy nguồn là quy trình của sản phẩm (một chỗ).
import { CHUAN, quyVe, BAI_TEST_SAN, BAI_TEST_KEO } from './bo-nhan-chuan.js';
export const TRUONG = [
  { k: 'nhom', ten: 'Nhóm cảnh', nhom: 'Nội dung', kieu: 'CO_DINH' },
  { k: 'buoc', ten: 'Bước thi công', nhom: 'Nội dung', kieu: 'QUY_TRINH', khi: 'THI_CONG' },
  { k: 'bai_test', ten: 'Bài test', nhom: 'Nội dung', kieu: 'QUY_TRINH', khi: 'THU_NGHIEM' },
  { k: 'hanh_dong', ten: 'Hành động', nhom: 'Nội dung', kieu: 'MO_RONG', nhieu: 1 },
  { k: 'vat_lieu', ten: 'Sản phẩm / vật liệu', nhom: 'Nội dung', kieu: 'MO_RONG', nhieu: 1, theo_dong: 1 },
  { k: 'dung_cu', ten: 'Dụng cụ', nhom: 'Nội dung', kieu: 'MO_RONG', nhieu: 1 },
  { k: 'vi_tri', ten: 'Vị trí', nhom: 'Nội dung', kieu: 'MO_RONG' },
  { k: 'nguoi', ten: 'Người trong khung', nhom: 'Nội dung', kieu: 'CO_DINH' },
  { k: 'co_canh', ten: 'Cỡ cảnh', nhom: 'Hình', kieu: 'CO_DINH' },
  { k: 'goc_may', ten: 'Góc máy', nhom: 'Hình', kieu: 'CO_DINH' },
  { k: 'chuyen_dong', ten: 'Chuyển động máy', nhom: 'Hình', kieu: 'CO_DINH' },
  { k: 'tham_my', ten: 'Thẩm mỹ hoàn thiện', nhom: 'Chất lượng', kieu: 'SO', khi: 'HOAN_THIEN' },
  { k: 'dung_cho', ten: 'Dùng cho', nhom: 'Dùng cho', kieu: 'CO_DINH' },
  { k: 'mo_ta', ten: 'Mô tả', nhom: 'Dùng cho', kieu: 'CHU' },
];
export const TEN_CO_CANH = { RONG: 'toàn cảnh', TRUNG: 'trung cảnh', CAN: 'cận', SAN_PHAM: 'cận sản phẩm', THAO_TAC: 'cận thao tác', NGUOI_NOI: 'người nói', CHU: 'chữ / đồ hoạ' };
export const CO_DINH = { nguoi: ['không có', 'thợ', 'chủ nhà', 'người dẫn', 'chuyên gia'], goc_may: ['ngang mắt', 'từ trên xuống', 'sát mặt phẳng', 'từ dưới lên'],
  chuyen_dong: ['đứng yên', 'lia', 'theo tay', 'rung tay'], dung_cho: ['cảnh chốt', 'minh hoạ lời', 'mở đầu (hook)', 'chuyển cảnh', 'loại'] };
// Hướng dẫn thi công sàn epoxy hiệu ứng / tự phẳng (tài liệu Kingsmen, chủ gửi 26/09) — áp cho dòng Terrazy (Terrazo) và Finex
export const QT_TU_PHANG = [
  { ten: 'Kiểm tra và chuẩn bị nền', mo_ta: 'đo độ ẩm nền bằng máy đo (≤ 8%), nền bê tông / vữa / gạch cứng, khô, sạch' },
  { ten: 'Tạo nhám', mo_ta: 'máy mài sàn hoặc đĩa mài tạo nhám nền, sau đó hút bụi sạch bằng máy hút bụi' },
  { ten: 'Trám và vệ sinh bề mặt', mo_ta: 'dao / bay trét bột bả epoxy trám vết nứt, mất ron, bể; mài sơ bằng lưỡi nhám xếp; hút bụi' },
  { ten: 'Thi công lớp lót (primer)', mo_ta: 'trộn primer 1:1, con lăn lăn lớp lót đều lên sàn, cọ quét chỗ hẹp và chân tường' },
  { ten: 'Trộn vật liệu', mo_ta: 'trộn vật liệu (Terrazy 6:1) trong xô / thùng, khuấy tay hoặc máy khuấy tốc độ thấp, nghiêng xô để khuấy, dùng cân đong tỉ lệ' },
  { ten: 'Thi công lớp phủ (đổ và cán)', mo_ta: 'đổ vật liệu ra sàn, dùng bay (bay răng / bay inox) trải đều, cán phẳng, dày 1–2 mm' },
  { ten: 'Lăn gai chỉnh bề mặt', mo_ta: 'con lăn gai lăn trên lớp phủ còn ướt để chỉnh phẳng, phá bọt khí, lăn 3–4 lần' },
  { ten: 'Bảo vệ chờ khô', mo_ta: 'sàn đã phủ xong để khô, không đi lại (khô mặt 6–12 giờ, đi nhẹ 12–24 giờ, dùng sau 48 giờ)' },
];
const KIEN_THUC_TU_PHANG = 'Hai sản phẩm sàn epoxy tự phẳng hiệu ứng terrazzo, cùng quy trình thi công, khác thương hiệu và phân khúc: Terrazy (thương hiệu Kingsmen, cao cấp) và F300 (thương hiệu Finex, trung cấp) — nhận ra qua bao bì / chữ trên thùng. Lỗi thường gặp của sàn tự phẳng (nhóm VAN_DE khi thấy): phồng rộp, bong tróc do nền ẩm (độ ẩm nền trên 8% thì chưa thi công được) hoặc bê tông chưa đủ 28 ngày; nứt lớp phủ, thất thoát vật liệu do không trám vá khuyết điểm; chỗ khô chỗ không do trộn sai tỉ lệ hoặc khuấy không đều; nổi / rỗ bọt khí do lăn gai quá ít. Gạch bóng trơn bắt buộc phải tạo nhám.';
const GIEO_TU_PHANG = { dung_cu: ['máy đo độ ẩm', 'máy mài sàn', 'máy hút bụi', 'dao trét', 'lưỡi nhám xếp', 'con lăn', 'cọ quét', 'máy khuấy', 'cân', 'bay răng', 'bay inox', 'con lăn gai'],
  hanh_dong: ['mài', 'hút bụi', 'trám', 'khuấy', 'cán', 'lăn gai', 'đo độ ẩm'], vat_lieu: ['bột bả epoxy', 'sơn lót primer', 'keo epoxy'] };
// Hướng dẫn thi công keo chít mạch Kingsmen (keokingsmen.com, chủ gửi 26/09)
export const QT_KEO_RON = [
  { ten: 'Chuẩn bị và vệ sinh khe ron', mo_ta: 'dao / vít cạo ron làm sạch khe, hút bụi; khe khô sạch, không còn keo dán gạch thừa (sâu 5 mm, rộng 2 mm); thoa lớp sáp bảo vệ (wax) mỏng lên mép gạch' },
  { ten: 'Bơm keo vào khe gạch', mo_ta: 'súng bơm keo Kingsmen, cắt đầu vòi, bơm bỏ 20–30 cm keo đầu; giữ súng góc trên 60°, đi chậm đều tay dọc khe gạch' },
  { ten: 'Miết ron tạo bề mặt', mo_ta: 'bi cầu hoặc thanh miết ron ép keo chặt xuống khe khi keo còn dẻo (vài phút đầu), tạo ron phẳng mịn' },
  { ten: 'Làm sạch và hoàn thiện', mo_ta: 'sau 2–3 giờ dùng dao sủi / dao gạt bỏ keo dư, bóc keo dư bằng tay, lau khăn sạch; ron bóng mịn liền mạch (đi nhẹ sau 4–6 giờ, khô hoàn toàn 48 giờ)' },
];
const KIEN_THUC_KEO_RON = 'Lưu ý / lỗi keo chít mạch (nhóm VAN_DE khi thấy): ron cũ đen mốc, ố vàng, bạc màu, nứt bong; keo không khô hoặc loang do trộn sai tỉ lệ 1:1 (không bơm bỏ keo đầu); sáp thoa quá dày làm keo kém bám; keo đóng rắn trong vòi khi ngưng quá 20 phút; ron bị nước / hoá chất trong 48 giờ đầu; bọt khí khi bơm nhanh. Khe ron chuẩn sâu 5 mm, rộng 2 mm.';
const GIEO_KEO_RON = { dung_cu: ['súng bơm keo', 'dao cạo ron', 'vít cạo ron', 'bi cầu miết ron', 'thanh miết ron', 'dao sủi', 'khăn sạch', 'máy hút bụi', 'găng tay'],
  hanh_dong: ['cạo ron', 'thoa sáp', 'bơm keo', 'miết ron', 'sủi keo dư', 'bóc keo dư', 'lau'], vat_lieu: ['keo chít mạch Kingsmen', 'sáp bảo vệ gạch (wax)'] };
const BO_CHUAN = [{ khop: /terraz|finex|tự phẳng|tu phang|epoxy/i, buoc: QT_TU_PHANG, kien_thuc: KIEN_THUC_TU_PHANG, gieo: GIEO_TU_PHANG },
  { khop: /keo|chít mạch|chit mach|ron/i, buoc: QT_KEO_RON, kien_thuc: KIEN_THUC_KEO_RON, gieo: GIEO_KEO_RON }];
const chuanCua = (d) => BO_CHUAN.find((b) => b.khop.test(String(d || ''))) || null;
const GIEO = { hanh_dong: ['gạt', 'lăn', 'bơm', 'trộn', 'đổ', 'khò', 'lau', 'đo', 'nói', 'cầm sản phẩm', 'cắt', 'quét'], dung_cu: ['bay răng', 'con lăn', 'súng bơm keo', 'máy khò', 'thước dây', 'xô trộn', 'máy trộn'],
  vi_tri: ['sàn nhà tắm', 'sàn phòng khách', 'ron gạch', 'bếp', 'tường', 'cầu thang', 'sân thượng', 'ngoài trời'], vat_lieu: [] };
const TT_CAN = ['KHONG_CHAC', 'KIEM'];
const CHAC_TOI_THIEU = 0.5;   // thầy tự chấm nhóm cảnh dưới mức này mới hỏi người
const COT = 'id,loai,nguon,doi_tuong_id,i,tu,den,dong,ten,link,media_url,khung_url,am_url,text,cau_truoc,cau_sau,so_do,nhan_mo,nhan_thay,nhan_hinh,nhan_nguoi,nguoi_source,trang_thai,tt_source,kiem,chac,hieu_luc,version,nguoi_ten,nguoi_luc,nguoi_giay,created_at,updated_at';

export function taoMau(H) {
  const { json, uid, nowISO, thangHienTai, ngayVN, chuoi, so, docJSON, isStaff, canGat, logAudit, docCauHinh, ghiAIUsage, kiemNganSachAI, NHOM_CANH, TEN_NHOM_CANH, CO_CANH, dsDongSP, soDoSource, luatSource } = H;
  const daDung = new WeakSet(); const J = (o) => o == null ? null : JSON.stringify(o); const P = (s) => docJSON(s, null);
  const cf = (s) => String(s || '').trim().toLowerCase();

  // ---------- bảng + gieo + chuyển dữ liệu cũ (một lần mỗi D1) ----------
  // chạy bảng + chuyển dữ liệu một lần mỗi isolate; lỗi thì ghi nhật ký 'lỗi chuyển dữ liệu kho mẫu' (trước đây bị nuốt trong cron, 26/09) và không chặn app
  const dangDam = new WeakMap();
  async function dam(env) { if (daDung.has(env.DB) || dangDam.has(env.DB)) return;   /* gọi lồng trong lúc đang chuyển (vd upsertHinh) hoặc lượt song song: trả ngay như trước */
    const p = damThat(env).catch(async (e) => { try { await env.DB.prepare(`INSERT INTO audit (id,at,tac_nhan,by_id,by_name,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?,?,?,?)`).bind(uid('a'), nowISO(), 'AGENT', null, 'Máy', 'lỗi chuyển dữ liệu kho mẫu', 'mau_doan', '', String((e && e.stack) || e).slice(0, 900)).run(); } catch (e2) {} }).finally(() => { daDung.add(env.DB); dangDam.delete(env.DB); });
    dangDam.set(env.DB, p); return p; }
  async function damThat(env) {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS mau_doan (id TEXT PRIMARY KEY, loai TEXT, nguon TEXT, doi_tuong_id TEXT, i INTEGER, tu REAL, den REAL, dong TEXT, ten TEXT, link TEXT, media_url TEXT, khung_url TEXT, am_url TEXT, text TEXT, cau_truoc TEXT, cau_sau TEXT, so_do TEXT, nhan_mo TEXT, nhan_thay TEXT, nhan_hinh TEXT, nhan_nguoi TEXT, nguoi_source TEXT, trang_thai TEXT, tt_source TEXT, kiem INTEGER DEFAULT 0, chac REAL, hieu_luc INTEGER DEFAULT 1, version INTEGER DEFAULT 1, nguoi_ten TEXT, nguoi_luc TEXT, nguoi_giay REAL, created_at TEXT, updated_at TEXT)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS ix_md_tt ON mau_doan(loai, hieu_luc, trang_thai)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS ix_md_ts ON mau_doan(loai, hieu_luc, tt_source)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS ix_md_dt ON mau_doan(doi_tuong_id)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS ix_md_nl ON mau_doan(nguoi_luc)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS bo_nhan (id TEXT PRIMARY KEY, truong TEXT, ten TEXT, dong TEXT, trang_thai TEXT, nguon TEXT, gop_vao TEXT, created_at TEXT, updated_at TEXT)`),
      env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS ux_bn ON bo_nhan(truong, ten, dong)`),
    ]);
    for (const c of ['anh_thu', 'thay_thu', 'buoc_thu']) { try { await env.DB.prepare(`ALTER TABLE mau_doan ADD COLUMN ${c} INTEGER DEFAULT 0`).run(); } catch (e) {} }
    for (const c of ['mo_ta TEXT', 'thu_tu INTEGER']) { try { await env.DB.prepare(`ALTER TABLE bo_nhan ADD COLUMN ${c}`).run(); } catch (e) {} }   // số lần đã thử cắt ảnh bù / thầy đọc bù
    if (!(await env.DB.prepare(`SELECT 1 x FROM bo_nhan LIMIT 1`).first())) { const st = [];
      for (const [t, ds] of Object.entries(GIEO)) for (const v of ds) st.push(env.DB.prepare(`INSERT OR IGNORE INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,created_at,updated_at) VALUES (?,?,?,'',?,?,?,?)`).bind(uid('bn'), t, v, 'DUNG', 'HE_THONG', nowISO(), nowISO()));
      if (st.length) await env.DB.batch(st); }
    const cu = await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='mau_doan'`).first(); const v0 = (cu && (P(cu.cau_hinh) || {}).v) || 0; if (v0 < 1) await chuyenCu(env);
    if (v0 < 2) { await env.DB.batch([env.DB.prepare(`UPDATE mau_doan SET trang_thai='THAY_CHOT' WHERE trang_thai='KHONG_CHAC' AND chac>=?`).bind(CHAC_TOI_THIEU),
      env.DB.prepare(`UPDATE mau_doan SET kiem=1, trang_thai='KIEM' WHERE loai='HINH' AND hieu_luc=1 AND trang_thai='THAY_CHOT' AND kiem=0 AND abs(random()) % 100 < 8`),
      env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('mau_doan', ?, ?, 'Máy')`).bind(JSON.stringify({ v: 2, luc: nowISO() }), nowISO())]); }
    if (v0 < 3) await napTuPhang(env, null);
    if (v0 < 4) await donBoNhanChuan(env, 4);
    if (v0 < 5) await donBoNhanChuan(env, 5);
    if (v0 < 6) await chuyen6(env);
    if (v0 < 7) await donBoNhanChuan(env, 7);
    if (v0 < 8) { const r = await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='huan_luyen'`).first(); const o = r ? (P(r.cau_hinh) || {}) : null; if (o && Array.isArray(o.anh_xa_dong)) { o.anh_xa_dong = o.anh_xa_dong.map((x) => x && String(x.chua).toUpperCase() === 'TERRAZ' ? { ...x, chua: 'TERRAZY' } : x); await env.DB.prepare(`UPDATE module_config SET cau_hinh=? WHERE id='huan_luyen'`).bind(JSON.stringify(o)).run(); }   /* 'terrazzo' là hiệu ứng sàn, Terrazy mới là sản phẩm */
      await env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('mau_doan', ?, ?, 'Máy')`).bind(JSON.stringify({ v: 8, luc: nowISO() }), nowISO()).run(); }   /* 26/09 tối: luật từ đợt Claude duyệt thay chủ (bước keo từ lời thoại, vệ sinh nền, bài test keo, máy đo màu ColorMatch) */   // 26/09 chiều: thêm luật (sáp, vữa, dụng cụ phổ biến, bài test keo / thời gian khô) — dọn lại đề xuất mới
  }

  // quy trình chuẩn sàn tự phẳng cho các dòng Terrazy / Finex (hoặc một dòng chỉ định): 8 bước có thứ tự + dấu hiệu; gieo dụng cụ / thao tác / vật liệu
  async function napTuPhang(env, chiDong) { const dongs = chiDong ? [chiDong] : [...new Set(['Finex F300', 'Terrazy', 'Keo chít mạch', ...(await env.DB.prepare(`SELECT DISTINCT dong FROM mau_doan WHERE dong IS NOT NULL`).all()).results.map((x) => x.dong), ...(await env.DB.prepare(`SELECT DISTINCT dong FROM san_pham WHERE dong IS NOT NULL`).all()).results.map((x) => x.dong)].filter(chuanCua))]; const st = []; const now = nowISO();
    const up = (truong, ten, dong, mo_ta, thu_tu) => env.DB.prepare(`INSERT INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,mo_ta,thu_tu,created_at,updated_at) VALUES (?,?,?,?,'DUNG','HE_THONG',?,?,?,?) ON CONFLICT(truong,ten,dong) DO UPDATE SET trang_thai='DUNG', mo_ta=COALESCE(excluded.mo_ta, bo_nhan.mo_ta), thu_tu=COALESCE(excluded.thu_tu, bo_nhan.thu_tu), updated_at=excluded.updated_at`).bind(uid('bn'), truong, ten, dong, mo_ta, thu_tu, now, now);
    const coQTSP = new Set((await env.DB.prepare(`SELECT DISTINCT dong FROM san_pham WHERE COALESCE(quy_trinh,'')<>''`).all()).results.map((x) => x.dong));   /* dòng đã khai quy trình ở Danh mục thì giữ quy trình đó */
    for (const d of dongs) { const c = chuanCua(d); if (!c) continue; if (!coQTSP.has(d)) c.buoc.forEach((b, i) => st.push(up('buoc', b.ten, d, b.mo_ta, i + 1))); for (const v of c.gieo.vat_lieu) st.push(up('vat_lieu', v, d, null, null)); }
    for (const c of BO_CHUAN) for (const t of ['dung_cu', 'hanh_dong']) for (const v of c.gieo[t]) st.push(up(t, v, '', null, null));
    st.push(env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('mau_doan', ?, ?, 'Máy')`).bind(JSON.stringify({ v: 3, luc: now }), now)); await env.DB.batch(st); return { dongs }; }
  // lần chuyển 4: dòng Terrazo → Terrazy (chủ 26/09: Terrazy cao cấp, Finex trung cấp, cùng quy trình); gieo tên chuẩn; dọn đề xuất tồn theo luật bộ nhãn chuẩn
  async function donBoNhanChuan(env, phien = 4) { const now = nowISO(); const MAYCHUAN = { id: '', ho_ten: 'Máy (bộ nhãn chuẩn)', agent: true };
    for (const bang of ['kho_thanh_pham', 'mau_hoc_ai', 'mau_doan', 'san_pham']) { try { await env.DB.prepare(`UPDATE ${bang} SET dong='Terrazy' WHERE dong='Terrazo'`).run(); } catch (e) {} }
    await env.DB.prepare(`UPDATE OR IGNORE bo_nhan SET dong='Terrazy' WHERE dong='Terrazo'`).run(); await env.DB.prepare(`DELETE FROM bo_nhan WHERE dong='Terrazo'`).run();
    { const r = await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='huan_luyen'`).first(); const o = r ? (P(r.cau_hinh) || {}) : null; if (o && Array.isArray(o.anh_xa_dong)) { o.anh_xa_dong = o.anh_xa_dong.map((x) => x && x.dong === 'Terrazo' ? { ...x, dong: 'Terrazy' } : x); await env.DB.prepare(`UPDATE module_config SET cau_hinh=? WHERE id='huan_luyen'`).bind(JSON.stringify(o)).run(); } }
    const up = (truong, ten, dong) => env.DB.prepare(`INSERT INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,created_at,updated_at) VALUES (?,?,?,?,'DUNG','HE_THONG',?,?) ON CONFLICT(truong,ten,dong) DO UPDATE SET trang_thai='DUNG', updated_at=excluded.updated_at`).bind(uid('bn'), truong, ten, dong, now, now);
    const st = []; for (const t of ['vat_lieu', 'dung_cu', 'vi_tri', 'hanh_dong']) for (const [, c] of CHUAN[t]) if (c) st.push(up(t, c, ''));
    const dongSan = [...new Set(['Finex F300', 'Terrazy', ...(await env.DB.prepare(`SELECT DISTINCT dong FROM mau_doan WHERE dong IS NOT NULL`).all()).results.map((x) => x.dong)].filter((d) => chuanCua(d) && chuanCua(d).buoc === QT_TU_PHANG))];
    for (const d of dongSan) BAI_TEST_SAN.forEach((b) => st.push(up('bai_test', b, d)));
    for (const d of [...new Set(['Keo chít mạch', ...(await env.DB.prepare(`SELECT DISTINCT dong FROM mau_doan WHERE dong IS NOT NULL`).all()).results.map((x) => x.dong)].filter((d) => chuanCua(d) && chuanCua(d).buoc === QT_KEO_RON))]) BAI_TEST_KEO.forEach((b) => st.push(up('bai_test', b, d)));
    await env.DB.batch(st);
    const coTen = new Set((await env.DB.prepare(`SELECT truong, ten FROM bo_nhan WHERE trang_thai='DUNG'`).all()).results.map((x) => x.truong + '|' + cf(x.ten)));
    const dx = (await env.DB.prepare(`SELECT * FROM bo_nhan WHERE trang_thai='DE_XUAT'`).all()).results; let gop = 0, bo = 0, mau = 0;
    const doi = {}, st2 = [];   /* một lượt: gom mọi đổi tên thành bảng tra, quét mẫu MỘT lần (trước đây mỗi đề xuất quét cả bảng → quá giới hạn CPU của Worker) */
    for (const r of dx) { const q = quyVe(r.truong, r.ten); if (!q) continue;
      if (q.bo) { doi[r.truong + '|' + cf(r.ten)] = null; st2.push(env.DB.prepare(`UPDATE bo_nhan SET trang_thai='BO', updated_at=? WHERE id=?`).bind(now, r.id)); bo++; continue; }
      if (!coTen.has(r.truong + '|' + cf(q.ten))) continue;   /* tên chuẩn chưa có trong bộ nhãn (vd bước keo ở dòng sàn) → để người duyệt */
      doi[r.truong + '|' + cf(r.ten)] = q.ten; st2.push(env.DB.prepare(`UPDATE bo_nhan SET trang_thai='GOP', gop_vao=?, updated_at=? WHERE id=?`).bind(q.ten, now, r.id)); gop++; }
    const truongDoi = [...new Set(Object.keys(doi).map((k) => k.split('|')[0]))]; const ghi = [];
    if (truongDoi.length) for (const m of (await env.DB.prepare(`SELECT id, nhan_mo, nhan_thay, nhan_nguoi FROM mau_doan`).all()).results) { const up = {};
      for (const c of ['nhan_mo', 'nhan_thay', 'nhan_nguoi']) { const o = P(m[c]); if (!o) continue; let doiO = false;
        for (const t of truongDoi) { const v = o[t]; if (v == null) continue; const tra = (x) => { const k = t + '|' + cf(x); return k in doi ? doi[k] : x; };
          if (Array.isArray(v)) { const n2 = [...new Set(v.map(tra))].filter((x) => x != null); if (JSON.stringify(n2) !== JSON.stringify(v)) { o[t] = n2; doiO = true; } } else { const n2 = tra(v); if (n2 !== v) { o[t] = n2; doiO = true; } } }
        if (doiO) up[c] = J(o); }
      if (Object.keys(up).length) { ghi.push(env.DB.prepare(`UPDATE mau_doan SET ${Object.keys(up).map((c) => c + '=?').join(', ')}, version=version+1, updated_at=? WHERE id=?`).bind(...Object.values(up), now, m.id)); mau++; } }
    const tatCa = [...ghi, ...st2]; for (let k = 0; k < tatCa.length; k += 80) await env.DB.batch(tatCa.slice(k, k + 80));
    await env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('mau_doan', ?, ?, 'Máy')`).bind(JSON.stringify({ v: phien, luc: now, don: { gop, bo, mau } }), now).run();
    await logAudit(env, MAYCHUAN, 'dọn bộ nhãn theo tài liệu chuẩn', 'bo_nhan', '', 'gộp ' + gop + ' · bỏ ' + bo + ' · ' + mau + ' mẫu đổi theo · dòng Terrazo → Terrazy'); return { gop, bo, mau }; }
  // đổi tên dòng ở mọi bảng (video, mẫu, sản phẩm, bộ nhãn, luật nhận dòng)
  async function doiTenDong(env, tu, sang) { for (const bang of ['kho_thanh_pham', 'mau_hoc_ai', 'mau_doan', 'san_pham']) { try { await env.DB.prepare(`UPDATE ${bang} SET dong=? WHERE dong=?`).bind(sang, tu).run(); } catch (e) {} }
    await env.DB.prepare(`UPDATE OR IGNORE bo_nhan SET dong=? WHERE dong=?`).bind(sang, tu).run(); await env.DB.prepare(`DELETE FROM bo_nhan WHERE dong=?`).bind(tu).run();
    await env.DB.prepare(`UPDATE OR IGNORE bo_nhan SET ten=? WHERE truong='dong' AND ten=?`).bind(sang, tu).run(); await env.DB.prepare(`DELETE FROM bo_nhan WHERE truong='dong' AND ten=?`).bind(tu).run();
    const r = await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='huan_luyen'`).first(); const o = r ? (P(r.cau_hinh) || {}) : null; if (o && Array.isArray(o.anh_xa_dong)) { o.anh_xa_dong = o.anh_xa_dong.map((x) => x && x.dong === tu ? { ...x, dong: sang } : x); await env.DB.prepare(`UPDATE module_config SET cau_hinh=? WHERE id='huan_luyen'`).bind(JSON.stringify(o)).run(); } }
  // lần chuyển 6 (26/09, chủ: 'sản phẩm sàn tự phẳng thương hiệu Finex có tên F300, thương hiệu Kingsmen có tên Terrazy'; 'dòng mỗi nơi một kiểu'): Finex → Finex F300; ba dòng đăng ký một chỗ, có thương hiệu
  const DONG_CHUAN = [{ ten: 'Terrazy', mo_ta: 'Kingsmen · sàn epoxy tự phẳng hiệu ứng terrazzo · cao cấp' }, { ten: 'Finex F300', mo_ta: 'Finex · sàn epoxy tự phẳng hiệu ứng terrazzo · trung cấp' }, { ten: 'Keo chít mạch', mo_ta: 'Kingsmen · keo chít mạch chuyên dụng (G3000 / G5000 / G6000 / G7000)' }];
  async function chuyen6(env) { const now = nowISO(); await doiTenDong(env, 'Finex', 'Finex F300');
    for (const [i, d] of DONG_CHUAN.entries()) await env.DB.prepare(`INSERT INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,mo_ta,thu_tu,created_at,updated_at) VALUES (?,'dong',?,'','DUNG','HE_THONG',?,?,?,?) ON CONFLICT(truong,ten,dong) DO UPDATE SET trang_thai='DUNG', mo_ta=excluded.mo_ta, thu_tu=excluded.thu_tu, updated_at=excluded.updated_at`).bind(uid('bn'), d.ten, d.mo_ta, i + 1, now, now).run();
    await env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('mau_doan', ?, ?, 'Máy')`).bind(JSON.stringify({ v: 6, luc: now }), now).run(); }
  // danh sách dòng MỘT nguồn cho mọi màn: dòng đăng ký (có thương hiệu) trước, rồi dòng từ sản phẩm / mẫu
  async function dsDongChuan(env) { const bn = await boNhan(env); const reg = bn.rows.filter((r) => r.truong === 'dong' && r.trang_thai === 'DUNG').sort((a, b) => (so(a.thu_tu) || 99) - (so(b.thu_tu) || 99));
    const ten = [...new Set([...reg.map((r) => r.ten), ...bn.dongs])]; return ten.map((d) => { const r = reg.find((x) => x.ten === d); return { dong: d, mo_ta: (r && r.mo_ta) || null }; }); }
  // gán dòng cho video (của các mẫu chọn) — dòng nằm ở video, mọi đoạn / câu của video đổi theo; bước sẽ được chuẩn hoá lại theo quy trình dòng mới
  async function datDong(env, me, body) { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); await dam(env); const dong = chuoi(body.dong, 80); const ds = await dsDongChuan(env); if (!ds.some((x) => x.dong === dong)) return json({ error: 'Dòng "' + dong + '" chưa có — thêm ở Bộ nhãn › Dòng sản phẩm' }, 400);
    const dts = new Set((Array.isArray(body.doi_tuong_ids) ? body.doi_tuong_ids : []).map((x) => chuoi(x, 60)).filter(Boolean)); for (const id of (Array.isArray(body.ids) ? body.ids : []).slice(0, 300)) { const r = await env.DB.prepare(`SELECT doi_tuong_id FROM mau_doan WHERE id=?`).bind(chuoi(id, 120)).first(); if (r) dts.add(r.doi_tuong_id); }
    let mau = 0; const now = nowISO(); for (const dt of dts) { await env.DB.prepare(`UPDATE kho_thanh_pham SET dong=? WHERE id=?`).bind(dong, dt).run(); const r = await env.DB.prepare(`UPDATE mau_doan SET dong=?, buoc_thu=0, updated_at=? WHERE doi_tuong_id=?`).bind(dong, now, dt).run(); mau += (r.meta && r.meta.changes) || 0; }
    await logAudit(env, me, 'gán dòng sản phẩm', 'kho_thanh_pham', dts.size + ' video', dong + ' · ' + mau + ' mẫu'); return json({ ok: true, so_video: dts.size, so_mau: mau }); }
  // tự gán dòng cho video đã đăng chưa có dòng: đếm vật liệu thầy / người đã nhận ra + chữ trong tên / lời thoại; rõ ràng (≥ 2 điểm, ≥ 70%) mới gán
  async function tuGanDong(env) { await dam(env); const rows = (await env.DB.prepare(`SELECT doi_tuong_id, ten, text, nhan_thay, nhan_nguoi, dong FROM mau_doan WHERE hieu_luc=1 AND nguon='THANH_PHAM'`).all()).results; const phieu = {}; const hienTai = {};   /* 26/09: thiếu cột dong → mỗi lượt cron gán lại cả 64 video */
    const cong = (v, d, n) => { const p = phieu[v] = phieu[v] || {}; p[d] = (p[d] || 0) + n; };
    for (const r of rows) { hienTai[r.doi_tuong_id] = r.dong || ''; for (const s of [r.nhan_nguoi, r.nhan_thay]) { const o = P(s); if (!o) continue; for (const x of [].concat(o.vat_lieu || [])) { if (x === 'Finex F300' || x === 'Finex S100') cong(r.doi_tuong_id, 'Finex F300', 1); else if (x === 'Kingsmen Terrazy') cong(r.doi_tuong_id, 'Terrazy', 1); else if (/^keo chít mạch Kingsmen/.test(x)) cong(r.doi_tuong_id, 'Keo chít mạch', 1); } }
      const chu = (r.ten || '') + ' ' + (r.text || ''); if (/terrazy/i.test(chu)) cong(r.doi_tuong_id, 'Terrazy', 2); if (/finex|\bf ?300\b/i.test(chu)) cong(r.doi_tuong_id, 'Finex F300', 2); if (/keo (chà|chít)|keo ron|\bg ?[3567]000\b/i.test(chu)) cong(r.doi_tuong_id, 'Keo chít mạch', 1); }
    const gan = []; for (const [v, p] of Object.entries(phieu)) { const ds = Object.entries(p).sort((a, b) => b[1] - a[1]); const tong = ds.reduce((a, x) => a + x[1], 0); const cu = hienTai[v] || ''; if (ds[0][0] === cu) continue;
      if (!cu) { if (ds[0][1] >= 2 && ds[0][1] / tong >= 0.7) gan.push([v, ds[0][0]]); }
      else if (!(p[cu] > 0) && ds[0][1] >= 3 && ds[0][1] / tong >= 0.8) gan.push([v, ds[0][0], cu]); }   /* dòng đang gán không có bằng chứng nào, dòng khác có ≥ 3 → sửa (vd luật TERRAZ khớp nhầm kênh sàn terrazzo bán Finex F300) */
    const now = nowISO(); for (const [v, d] of gan) { await env.DB.prepare(`UPDATE kho_thanh_pham SET dong=? WHERE id=?`).bind(d, v).run(); await env.DB.prepare(`UPDATE mau_doan SET dong=?, buoc_thu=0, updated_at=? WHERE doi_tuong_id=?`).bind(d, now, v).run(); }
    if (gan.length) await logAudit(env, { id: '', ho_ten: 'Máy (tự gán dòng)', agent: true }, 'tự gán dòng theo vật liệu thầy thấy', 'kho_thanh_pham', gan.length + ' video', gan.map(([, d]) => d).reduce((a, d) => { a[d] = (a[d] || 0) + 1; return a; }, {}) && JSON.stringify(gan.map(([, d]) => d).reduce((a, d) => { a[d] = (a[d] || 0) + 1; return a; }, {})));
    return { so: gan.length }; }
  // hàng việc thay chủ (chủ 26/09: 'bạn trực tiếp xử lý thay tôi việc gán nhãn và duyệt nhãn'): Claude soạn quyết định vào module_config.viec_thay_chu,
  // cron chạy qua đúng các đường ghi của app (gộp đổi mẫu theo, version…), ghi nhật ký tên 'Claude (thay chủ)'; nhãn Claude không tính vào độ đúng của thầy
  async function chayViecThayChu(env) { const r = await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='viec_thay_chu'`).first(); const o = r ? (P(r.cau_hinh) || {}) : {}; const ds = Array.isArray(o.viec) ? o.viec : []; if (!ds.length) return { so: 0 };
    await dam(env); const me = { id: '', ho_ten: 'Claude (thay chủ)', vai_tro: 'ADMIN', agent: true }; const kq = []; const trangThai = async (res) => res.status + (res.status >= 400 ? ' ' + ((await res.clone().json().catch(() => ({}))).error || '') : '');
    for (const v of ds.slice(0, 150)) { try {
      if (v.loai === 'bo_nhan') { const row = await env.DB.prepare(`SELECT id FROM bo_nhan WHERE id=? AND trang_thai='DE_XUAT'`).bind(v.id).first(); if (!row) { kq.push([v.id, 'bỏ qua: không còn đề xuất']); continue; }
        if (v.hanh === 'doi_ten_duyet') { const a = await suaBoNhan(env, me, v.id, 'doi-ten', { ten: v.ten }); kq.push([v.id, 'đổi tên ' + (await trangThai(a))]); const b = await suaBoNhan(env, me, v.id, 'duyet', {}); kq.push([v.id, 'duyệt ' + (await trangThai(b))]); }
        else { const a = await suaBoNhan(env, me, v.id, v.hanh === 'gop' ? 'gop' : v.hanh === 'bo' ? 'bo' : 'duyet', { vao: v.vao }); kq.push([v.id, v.hanh + ' ' + (await trangThai(a))]); } }
      else if (v.loai === 'dong') { const a = await datDong(env, me, { doi_tuong_ids: [v.doi_tuong_id], dong: v.dong }); kq.push([v.doi_tuong_id, 'dòng ' + (await trangThai(a))]); }
      else if (v.loai === 'loi') { const a = await luuLoi(env, me, v.mau_id, v.nghe_sai ? { nghe_sai: true } : { nhom: v.nhom, buoc: v.buoc || null, bai_test: v.bai_test || null }); kq.push([v.mau_id, 'lời ' + (await trangThai(a))]); }
      else if (v.loai === 'nhan') { const a = await luuHinh(env, me, v.mau_id, v.khong_ro ? { khong_ro: true } : { nhan: v.nhan }); kq.push([v.mau_id, 'nhãn ' + (await trangThai(a))]); }
    } catch (e) { kq.push([v.id || v.mau_id || v.doi_tuong_id, 'lỗi ' + String(e.message || e).slice(0, 80)]); } }
    const con = ds.slice(150); const now = nowISO(); const cu = await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='viec_thay_chu_kq'`).first(); const lich = ((cu && P(cu.cau_hinh)) || { lan: [] }).lan || [];
    lich.unshift({ luc: now, so: kq.length, loi: kq.filter((x) => !/ 200|bỏ qua/.test(x[1])).length, kq: kq.slice(0, 300) });
    await env.DB.batch([env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('viec_thay_chu', ?, ?, 'Claude')`).bind(JSON.stringify({ viec: con }), now), env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('viec_thay_chu_kq', ?, ?, 'Claude')`).bind(JSON.stringify({ lan: lich.slice(0, 20) }), now)]);
    await logAudit(env, me, 'Claude duyệt / gán thay chủ', 'mau_doan', kq.length + ' việc', kq.slice(0, 20).map((x) => x.join(': ')).join(' · ')); return { so: kq.length }; }
  // ===== ADR-020 TRỤC VIDEO (duyệt 26/09): 4 trục cấp video + góc quay từng đoạn; một mô hình chung, trục là điều kiện; nhóm < 15 video gộp về chung
  const TRUC = {
    muc_dich: { ten: 'Mục đích', gt: { QUANG_CAO: 'quảng cáo chuyển đổi', THUONG_HIEU: 'thương hiệu', BAN_HANG_HANG_NGAY: 'bán hàng hằng ngày', HUONG_DAN: 'hướng dẫn thi công', CHUNG_MINH: 'chứng minh / test', PHAN_HOI: 'phản hồi khách / công trình' } },
    cau_truc: { ten: 'Cấu trúc', gt: { VAN_DE_GIAI_PHAP: 'vấn đề → giải pháp', TRUOC_SAU: 'trước / sau', TUNG_BUOC: 'từng bước', THU_NGHIEM: 'thử nghiệm', KE_CHUYEN: 'kể chuyện', DANH_SACH: 'danh sách' } },
    mo_dau: { ten: 'Kiểu mở đầu', gt: { CAU_HOI: 'câu hỏi', KET_QUA_TRUOC: 'khoe kết quả trước', LOI_HAY_GAP: 'lỗi hay gặp', CON_SO: 'con số', HANH_DONG_MANH: 'hành động mạnh', CAM_XUC: 'cảm xúc' } },
    phong_cach: { ten: 'Phong cách', gt: { NGUOI_NOI: 'người nói', LONG_TIENG: 'lồng tiếng', CHU_VA_NHAC: 'chữ + nhạc', AM_THANH_THAT: 'âm thanh thi công thật', TREND: 'trend' } },
  };
  const GOC_QUAY = { CAN_CHI_TIET: 'cận chi tiết', TRUNG: 'trung', TOAN_CANH: 'toàn cảnh', POV: 'POV (góc thợ)', TREN_XUONG: 'từ trên xuống', SPLIT_TRUOC_SAU: 'chia đôi trước / sau' };
  const NGUONG_TRUC = 15;
  // thầy gán trục: đọc lời thoại + mô tả từng đoạn thầy đã viết (chữ, không ảnh — rẻ), Haiku; tính vào ngân sách thầy
  async function thayGanTruc(env, toiDa = 8) { await dam(env); const cfg = await docCauHinh(env); const ai = cfg.ai || {}; const hl = cfg.huan_luyen || {}; if (ai.thay_nhin === false || hl.thay_truc === false) return { ok: false, tat: true };
    const key = env.ANTHROPIC_API_KEY; if (!key) return { ok: false, loi: 'chưa có ANTHROPIC_API_KEY' };
    if (so(ai.ngan_sach_thay_usd) > 0) { const da = (await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE thang=? AND tinh_nang IN ('hoc_nhan_khung','hoc_doc_loi','hoc_gan_truc')`).bind(thangHienTai()).first()) || {}; if (so(da.usd) >= so(ai.ngan_sach_thay_usd)) return { ok: false, loi: 'Hết ngân sách thầy tháng này' }; }
    const vs = (await env.DB.prepare(`SELECT id, ten, kenh, dong, luot_xem, doanh_thu FROM kho_thanh_pham WHERE truc IS NULL AND EXISTS (SELECT 1 FROM mau_doan m WHERE m.doi_tuong_id=kho_thanh_pham.id AND m.loai='HINH' AND m.nhan_thay IS NOT NULL) ORDER BY created_at DESC LIMIT ?`).bind(Math.max(1, Math.min(30, toiDa))).all()).results; if (!vs.length) return { ok: true, so: 0 };
    const model = chuoi(hl.thay_truc_model, 60) || 'claude-haiku-4-5-20251001'; let xong = 0, loi = null; const dsGt = (o) => Object.entries(o).map(([k, v]) => k + ' (' + v + ')').join('; ');
    for (const v of vs) { const doan = (await env.DB.prepare(`SELECT i, tu, den, nhan_thay FROM mau_doan WHERE doi_tuong_id=? AND loai='HINH' AND hieu_luc=1 ORDER BY i LIMIT 40`).bind(v.id).all()).results; const loiThoai = (await env.DB.prepare(`SELECT text FROM mau_doan WHERE doi_tuong_id=? AND loai='LOI' AND hieu_luc=1 AND trang_thai<>'NGHE_SAI' ORDER BY i LIMIT 40`).bind(v.id).all()).results.map((x) => x.text).filter(Boolean);
      const p = 'Bạn là biên tập viên video của Kingsmen (vật liệu xây dựng' + (v.dong ? ', dòng ' + v.dong : '') + '). Phân loại video thành phẩm dưới đây theo 4 trục, và góc quay từng đoạn.\n' +
        'TRỤC (chọn ĐÚNG MỘT mã mỗi trục, không chắc thì null):\n' + Object.entries(TRUC).map(([k, t]) => '- ' + k + ' — ' + t.ten + ': ' + dsGt(t.gt)).join('\n') + '\n- góc quay từng đoạn: ' + dsGt(GOC_QUAY) + '\n\n' +
        'VIDEO: ' + (v.ten || '') + (v.kenh ? ' · kênh ' + v.kenh : '') + '\nLỜI THOẠI (máy nghe, có thể sai chữ): ' + (loiThoai.join(' / ').slice(0, 2500) || '(không có lời — có thể chữ + nhạc)') + '\nCÁC ĐOẠN (mô tả hình do thầy viết):\n' +
        doan.map((d) => { const t = P(d.nhan_thay) || {}; return '#' + d.i + ' ' + (+d.tu).toFixed(1) + '–' + (+d.den).toFixed(1) + 's: ' + (t.nhom || '') + ' — ' + String(t.mo_ta || '').slice(0, 160); }).join('\n') +
        '\n\nTrả về DUY NHẤT JSON: {"muc_dich":"MÃ|null","cau_truc":"MÃ|null","mo_dau":"MÃ|null","phong_cach":"MÃ|null","chac":0..1,"doan":[{"i":số,"goc":"MÃ|null"}]}';
      const t0 = Date.now(); let res, j; try { res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content: p }] }) }); j = await res.json().catch(() => ({})); } catch (e) { loi = String(e.message || e).slice(0, 100); break; }
      await ghiAIUsage(env, { provider: 'anthropic', model, tinh_nang: 'hoc_gan_truc', tokens_vao: so(j.usage && j.usage.input_tokens), tokens_ra: so(j.usage && j.usage.output_tokens), ok: !!res.ok, ms: Date.now() - t0, loi: res.ok ? null : String((j.error && j.error.message) || res.status).slice(0, 200), muc: 'API' });
      if (!res.ok) { loi = String((j.error && j.error.message) || res.status).slice(0, 100); break; }
      const txt = ((j.content || []).find((c) => c.type === 'text') || {}).text || ''; let o = null; try { o = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)); } catch { o = null; } if (!o) continue;
      const truc = { nguon: 'THAY', model, luc: nowISO(), chac: Math.max(0, Math.min(1, +o.chac || 0)) }; for (const k of Object.keys(TRUC)) truc[k] = TRUC[k].gt[o[k]] ? o[k] : null;
      const st = [env.DB.prepare(`UPDATE kho_thanh_pham SET truc=? WHERE id=?`).bind(J(truc), v.id)]; for (const d of (Array.isArray(o.doan) ? o.doan : [])) if (GOC_QUAY[d.goc]) st.push(env.DB.prepare(`UPDATE mau_doan SET goc_quay=? WHERE id=? AND goc_quay IS NULL`).bind(d.goc, 'H:' + v.id + ':' + Math.round(so(d.i))));
      await env.DB.batch(st); xong++; }
    return { ok: true, so: xong, loi }; }
  // Độ phủ trục theo dòng: số video mỗi giá trị (≥ ngưỡng = dùng được làm điều kiện), góc quay đoạn thành phẩm + footage kho
  async function doPhuTruc(env) { await dam(env); const vs = (await env.DB.prepare(`SELECT id, dong, truc FROM kho_thanh_pham`).all()).results; const out = {};
    const o = (d) => out[d] = out[d] || { tong: 0, da_gan: 0, truc: Object.fromEntries(Object.keys(TRUC).map((k) => [k, {}])), goc_doan: {}, goc_footage: {} };
    for (const v of vs) { const x = o(v.dong || '(chưa có dòng)'); x.tong++; const t = P(v.truc); if (!t) continue; x.da_gan++; for (const k of Object.keys(TRUC)) if (t[k]) x.truc[k][t[k]] = (x.truc[k][t[k]] || 0) + 1; }
    for (const r of (await env.DB.prepare(`SELECT dong, goc_quay, COUNT(*) n FROM mau_doan WHERE loai='HINH' AND hieu_luc=1 AND goc_quay IS NOT NULL GROUP BY dong, goc_quay`).all()).results) o(r.dong || '(chưa có dòng)').goc_doan[r.goc_quay] = so(r.n);
    for (const r of (await env.DB.prepare(`SELECT mu.dong, t.goc_quay, COUNT(*) n FROM tai_san t JOIN muc_noi_dung mu ON mu.id=t.muc_id WHERE t.loai='FOOTAGE' AND t.goc_quay IS NOT NULL GROUP BY mu.dong, t.goc_quay`).all()).results) o(r.dong || '(chưa có dòng)').goc_footage[r.goc_quay] = so(r.n);
    return { truc: TRUC, goc_quay: GOC_QUAY, nguong: NGUONG_TRUC, dong: out }; }
  async function suaTruc(env, me, id, body) { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); const v = await env.DB.prepare(`SELECT id, truc FROM kho_thanh_pham WHERE id=?`).bind(id).first(); if (!v) return json({ error: 'Không có video' }, 404);
    const t = { ...(P(v.truc) || {}), nguon: 'NGUOI', nguoi: me.ho_ten, luc: nowISO() }; for (const k of Object.keys(TRUC)) if (body[k] !== undefined) t[k] = TRUC[k].gt[body[k]] ? body[k] : null;
    await env.DB.prepare(`UPDATE kho_thanh_pham SET truc=? WHERE id=?`).bind(J(t), v.id).run(); await logAudit(env, me, 'sửa trục video', 'kho_thanh_pham', v.id, JSON.stringify(Object.fromEntries(Object.keys(TRUC).map((k) => [k, t[k]])))); return json({ ok: true, truc: t }); }
  // NGUỒN HỌC: gom video đã học theo nguồn (kênh / thư mục / ngành) + footage theo mục; mỗi nguồn: video, mẫu, dòng, ảnh, thầy, người, lời, bản xem, lần học cuối, chuỗi nạp lại
  async function nguonHoc(env) { await dam(env);
    const tk = {}; for (const r of (await env.DB.prepare(`SELECT doi_tuong_id d, SUM(loai='HINH') hinh, SUM(loai='HINH' AND khung_url IS NOT NULL) anh, SUM(loai='HINH' AND nhan_thay IS NOT NULL) thay, SUM(nhan_nguoi IS NOT NULL) nguoi, SUM(loai='LOI') loi, SUM(trang_thai='NGHE_SAI') nghe_sai FROM mau_doan WHERE hieu_luc=1 GROUP BY doi_tuong_id`).all()).results) tk[r.d] = r;
    const kd = ((await docCauHinh(env)).kalodata || {}).nganh || []; const nhom = {};
    const cong = (key, base, v, dong, cuoi, banXem) => { const g = nhom[key] = nhom[key] || { ...base, so_video: 0, dong: {}, hinh: 0, anh: 0, thay: 0, nguoi: 0, loi: 0, nghe_sai: 0, ban_xem: 0, cuoi: '', video: [] }; const t = tk[v.id] || {};
      g.so_video++; g.dong[dong || '(chưa có)'] = (g.dong[dong || '(chưa có)'] || 0) + 1; for (const k of ['hinh', 'anh', 'thay', 'nguoi', 'loi', 'nghe_sai']) g[k] += so(t[k]); if (banXem) g.ban_xem++; if (String(cuoi) > g.cuoi) g.cuoi = String(cuoi);
      g.video.push({ id: v.id, ten: v.ten, dong: dong || null, hinh: so(t.hinh), thay: so(t.thay), cuoi, truc: P(v.truc) }); };
    for (const v of (await env.DB.prepare(`SELECT id, ten, nguon, kenh, thu_muc, dong, proxy_url, created_at, truc FROM kho_thanh_pham`).all()).results) { const tm = String(v.thu_muc || ''); let key, base;
      if (v.nguon === 'DRIVE') { const m = tm.match(/^drive:([^/]+)(?:\/([^/]+))?/) || []; key = 'DRIVE|' + (m[1] || '') + '|' + (m[2] || ''); base = { loai: 'DRIVE', ten: m[2] || 'thư mục gốc', phu: 'Drive · ' + (m[1] || '').slice(0, 10) + '…', nap: m[1] ? 'https://drive.google.com/drive/folders/' + m[1] : null }; }
      else if (v.nguon === 'KALODATA') { const ng = tm.split(/[\\/]/).pop() || 'kalodata'; const ten = (kd.find((x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === ng) || ng); key = 'KALODATA|' + ng; base = { loai: 'KALODATA', ten: 'Ngành ' + ten, phu: 'Kalodata · video bán chạy của nhiều kênh', nap: kd.includes(ten) ? ten : null }; }
      else if (v.nguon === 'REELS') { const k = v.kenh || 'fb/?'; key = 'REELS|' + k; base = { loai: 'REELS', ten: k.replace(/^fb\//, 'facebook.com/'), phu: 'Reels của fanpage Facebook', nap: 'https://www.facebook.com/' + k.replace(/^fb\//, '') }; }
      else if (v.nguon === 'TIKTOK') { const k = v.kenh || '@' + (tm.split(/[\\/]/).pop() || '?'); key = 'TIKTOK|' + k; base = { loai: 'TIKTOK', ten: k, phu: 'kênh TikTok', nap: /^@/.test(k) ? k : null }; }
      else { const goc = tm.split(/[\\/]/).slice(0, -1).join('\\') || tm; key = 'LOCAL|' + goc; base = { loai: 'LOCAL', ten: tm.split(/[\\/]/).pop() || tm, phu: 'thư mục trên máy dựng · ' + goc, nap: tm || null }; }
      cong(key, { key, ...base }, v, v.dong, v.created_at, !!v.proxy_url); }
    for (const v of (await env.DB.prepare(`SELECT t.id, t.ten, t.created_at, t.muc_id, mu.tieu_de, COALESCE(mu.dong, sp.dong) dong, mu.giai_doan FROM tai_san t LEFT JOIN muc_noi_dung mu ON mu.id=t.muc_id LEFT JOIN san_pham sp ON sp.id=mu.san_pham_id WHERE t.loai='FOOTAGE' AND t.media_type='VIDEO'`).all()).results)
      cong('FOOTAGE|' + (v.muc_id || ''), { key: 'FOOTAGE|' + (v.muc_id || ''), loai: 'FOOTAGE', ten: v.tieu_de || 'footage chưa gắn mục', phu: v.giai_doan === 'KHO' ? 'kho footage gốc của dòng · viết kịch bản và dựng lấy clip từ đây' : 'footage quay của một mục', nap: null, muc_id: v.muc_id }, v, v.dong, v.created_at, true);
    // nguồn đang học: lệnh nạp / học chưa xong → hiện ngay, không đợi video đầu tiên (26/09, chủ: "tôi không thấy trong danh sách nguồn học")
    for (const l of (await env.DB.prepare(`SELECT id, viec, trang_thai, tham_so, created_at FROM tram_lenh WHERE viec IN ('hoc_thanh_pham','nap_drive') AND trang_thai IN ('CHO','DA_GUI') ORDER BY created_at DESC LIMIT 20`).all()).results) { const t = P(l.tham_so) || {}; if (t.chi_proxy) continue;
      const loai = l.viec === 'nap_drive' ? 'FOOTAGE' : (t.nguon === 'REELS' ? 'REELS' : t.nguon === 'TIKTOK' ? 'TIKTOK' : t.nguon === 'KALODATA' ? 'KALODATA' : t.nguon === 'LOCAL' ? 'LOCAL' : 'DRIVE');
      const ten = l.viec === 'nap_drive' ? (t.kho_dong ? '📦 Kho footage — ' + t.kho_dong : 'footage Drive') : (t.kenh || (t.folder_id ? 'thư mục Drive ' + String(t.folder_id).slice(0, 10) + '…' : t.duong_dan || 'nguồn mới'));
      nhom['CHO|' + l.id] = { key: 'CHO|' + l.id, loai, ten, phu: (l.trang_thai === 'CHO' ? 'đang chờ máy nhận' : 'máy đang học') + (t.folder_id ? ' · thư mục Drive ' + String(t.folder_id).slice(0, 8) + '…' : '') + (t.dong || t.kho_dong ? ' · dòng ' + (t.dong || t.kho_dong) : ''), nap: null, dang_hoc: l.trang_thai, so_video: 0, dong: {}, hinh: 0, anh: 0, thay: 0, nguoi: 0, loi: 0, nghe_sai: 0, ban_xem: 0, cuoi: l.created_at, video: [] }; }
    // nguồn còn xếp hàng chờ Trạm (kênh TikTok, fanpage Reels) hoặc chờ lượt AI thay chủ — cũng hiện (26/09, chủ: "danh sách nguồn học còn thiếu")
    const cfgN = await docCauHinh(env); const choTram = (ten, loai, phu, dong, luc) => { const k = 'CHO_TRAM|' + loai + '|' + ten; if (!nhom[k]) nhom[k] = { key: k, loai, ten, phu, nap: null, dang_hoc: 'CHO_TRAM', so_video: 0, dong: dong ? { [dong]: 0 } : {}, hinh: 0, anh: 0, thay: 0, nguoi: 0, loi: 0, nghe_sai: 0, ban_xem: 0, cuoi: luc || '', video: [] }; };
    for (const h of ((cfgN.tai_tiktok || {}).hang || [])) if (!nhom['TIKTOK|' + h.kenh]) choTram(h.kenh, 'TIKTOK', 'chờ Trạm lấy danh sách video kênh' + (h.dong ? ' · dòng ' + h.dong : ''), h.dong, h.luc);
    for (const h of ((cfgN.tai_reels || {}).hang || [])) if (!nhom['REELS|fb/' + h.trang]) choTram('facebook.com/' + h.trang, 'REELS', 'chờ Trạm đọc Reels fanpage' + (h.dong ? ' · dòng ' + h.dong : ''), h.dong, h.luc);
    for (const v of ((cfgN.lenh_thay_chu || {}).lenh || [])) { if (v.loai === 'hoc_tiktok') choTram(String(v.kenh || '').replace(/^https?:\/\/(www\.)?tiktok\.com\//, '').replace(/[?#].*$/, ''), 'TIKTOK', 'AI thay chủ đã xếp — chạy lượt tới (≤ 15 phút)', v.dong, v.luc);
      else if (v.loai === 'hoc_reels') choTram(String(v.link || '').replace(/^https?:\/\/(www\.)?/, ''), 'REELS', 'AI thay chủ đã xếp — chạy lượt tới (≤ 15 phút)', v.dong, v.luc);
      else if (v.loai === 'nap_footage') choTram('📦 Kho footage — ' + (v.dong || '?'), 'FOOTAGE', 'AI thay chủ đã xếp — chạy lượt tới (≤ 15 phút)', v.dong, v.luc); }
    const ds = Object.values(nhom).sort((a, b) => String(b.cuoi).localeCompare(String(a.cuoi))); for (const g of ds) g.video.sort((a, b) => String(b.cuoi).localeCompare(String(a.cuoi)));
    const lenh = (await env.DB.prepare(`SELECT id, viec, trang_thai, tham_so, ket_qua, created_at, xong_at FROM tram_lenh WHERE viec IN ('hoc_thanh_pham','phan_tich_footage','chay_agent') ORDER BY created_at DESC LIMIT 30`).all()).results.map((l) => ({ ...l, tham_so: (() => { const t = P(l.tham_so) || {}; return { nguon: t.nguon, kenh: t.kenh, chi_proxy: !!t.chi_proxy, so: (t.links || t.video || t.ds_proxy || []).length || t.toi_da || null, folder_id: t.folder_id || null }; })() }));
    const may = (await env.DB.prepare(`SELECT ten, nhan_luc FROM may_ghep WHERE active=1`).all()).results.map((m) => ({ ten: m.ten, nhan_luc: m.nhan_luc, song: Date.now() - Date.parse(m.nhan_luc || 0) < 6 * 60e3 }));
    // kho footage: thư mục Drive đã nạp (từ lệnh nap_drive) → "Nạp thêm" dùng lại đúng thư mục
    const thuMucKho = {}; for (const l of (await env.DB.prepare(`SELECT tham_so FROM tram_lenh WHERE viec='nap_drive' ORDER BY created_at DESC LIMIT 200`).all()).results) { const t = P(l.tham_so) || {}; if (!t.muc_id || !t.folder_id) continue; const a = thuMucKho[t.muc_id] = thuMucKho[t.muc_id] || []; if (!a.includes(t.folder_id)) a.push(t.folder_id); }
    for (const g of ds) if (g.loai === 'FOOTAGE' && g.muc_id && thuMucKho[g.muc_id]) { g.thu_muc_drive = thuMucKho[g.muc_id].map((id) => 'https://drive.google.com/drive/folders/' + id); g.nap = g.thu_muc_drive[0]; g.kho_dong = /^kho_ft_/.test(g.muc_id) ? Object.keys(g.dong).find((k) => k !== '(chưa có)') || null : null; }
    const theoDoi = (((await docCauHinh(env)).nguon_theo_doi || {}).ds) || []; const nhomTheoKey = {}; for (const g of ds) nhomTheoKey[g.key] = g;
    for (const t of theoDoi) { const g = nhomTheoKey[t.key] || (t.loai === 'FOOTAGE' ? ds.find((x) => x.loai === 'FOOTAGE' && t.key.indexOf('FOOTAGE|' + x.muc_id + '|') === 0) : null);
      const gCho = !g && ds.find((x) => x.dang_hoc && x.ten === t.ten);
      if (g || gCho) { const x = g || gCho; x.theo_doi = t; if (!x.nap) x.nap = t.nap; } else ds.push({ key: t.key, loai: t.loai, ten: t.ten, phu: (t.tk_tram ? 'tài khoản Trạm ' + t.tk_tram + ' · ' : '') + 'đã đăng ký, chưa học video nào', nap: t.nap, theo_doi: t, so_video: 0, dong: t.dong ? { [t.dong]: 0 } : {}, hinh: 0, anh: 0, thay: 0, nguoi: 0, loi: 0, nghe_sai: 0, ban_xem: 0, cuoi: t.them_luc || '', video: [] }); }
    for (const g of ds) if (g.theo_doi && g.theo_doi.tk_tram && !/tài khoản Trạm/.test(g.phu || '')) g.phu = (g.phu || '') + ' · tài khoản Trạm ' + g.theo_doi.tk_tram;
    const kdCfg = (await docCauHinh(env)).kalodata || {};
    return { nguon: ds, lenh, may, dongs: (await dsDongChuan(env)).map((x) => x.dong), kalodata: { nganh: kdCfg.nganh || [], top_n: kdCfg.top_n || 10, tu_dong: kdCfg.tu_dong !== false, dong: kdCfg.dong || null, muc_dich: kdCfg.muc_dich || 'BAN_HANG', lan_cuoi: kdCfg.lan_cuoi || null, ket_qua_cuoi: kdCfg.ket_qua_cuoi || null } }; }
  // chuẩn hoá bước cũ về quy trình của dòng: Haiku đọc mô tả / dụng cụ / thao tác thầy đã ghi (không đọc lại hình, ~0,001 USD / đoạn); xong dòng nào thì dọn đề xuất bước của dòng đó
  async function chuanHoaBuoc(env, toiDa = 60) { await dam(env); const key = env.ANTHROPIC_API_KEY; if (!key) return { ok: false, loi: 'chưa có ANTHROPIC_API_KEY' }; const ai = (await docCauHinh(env)).ai || {};
    if (so(ai.ngan_sach_thay_usd) > 0) { const da = (await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE thang=? AND tinh_nang IN ('hoc_nhan_khung','hoc_doc_loi')`).bind(thangHienTai()).first()) || {}; if (so(da.usd) >= so(ai.ngan_sach_thay_usd)) return { ok: false, loi: 'hết trần thầy' }; }
    const bn = await boNhan(env); const coQT = Object.keys(bn.qt).filter((d) => bn.qt[d].length); if (!coQT.length) return { ok: true, so: 0 };
    const rows = (await env.DB.prepare(`SELECT id, dong, nhan_thay, kiem, nhan_nguoi, loai, chac FROM mau_doan WHERE loai='HINH' AND hieu_luc=1 AND COALESCE(buoc_thu,0)=0 AND nhan_thay LIKE '%"nhom":"THI_CONG"%' AND dong IN (${coQT.map(() => '?').join(',')}) LIMIT 400`).bind(...coQT).all()).results.filter((r) => { const t = P(r.nhan_thay) || {}; return !(bn.qt[r.dong] || []).includes(t.buoc); }).slice(0, toiDa);
    const xongDong = []; for (const d of coQT) { const con = rows.some((r) => r.dong === d); if (!con) xongDong.push(d); }
    if (xongDong.length) await env.DB.prepare(`UPDATE bo_nhan SET trang_thai='GOP', gop_vao='(quy trình chuẩn)', updated_at=? WHERE truong='buoc' AND trang_thai='DE_XUAT' AND dong IN (${xongDong.map(() => '?').join(',')})`).bind(nowISO(), ...xongDong).run();
    if (!rows.length) return { ok: true, so: 0 }; const model = 'claude-haiku-4-5-20251001'; let xong = 0; const theo = {}; for (const r of rows) (theo[r.dong] = theo[r.dong] || []).push(r);
    for (const [dong, ds] of Object.entries(theo)) for (let b = 0; b < ds.length; b += 30) { const lo = ds.slice(b, b + 30); const qt = bn.qt[dong];
      const p = 'Quy trình thi công dòng ' + dong + ' (Kingsmen):\n' + qt.map((v, i) => (i + 1) + '. ' + v + (bn.moTa[v] ? ' — ' + bn.moTa[v] : '')).join('\n') + '\n\nMỗi dòng dưới là một cảnh THI CÔNG đã được mô tả. Chọn ĐÚNG MỘT bước trong quy trình khớp với cảnh (chép nguyên văn tên bước), hoặc null nếu không bước nào khớp.\n' +
        lo.map((r, i) => { const t = P(r.nhan_thay) || {}; return (i + 1) + '. mô tả: ' + chuoi(t.mo_ta, 160) + (t.buoc ? ' | bước đã ghi: ' + t.buoc : '') + ((t.dung_cu || []).length ? ' | dụng cụ: ' + t.dung_cu.join(', ') : '') + ((t.hanh_dong || []).length ? ' | thao tác: ' + t.hanh_dong.join(', ') : '') + ((t.vat_lieu || []).length ? ' | vật liệu: ' + t.vat_lieu.join(', ') : ''); }).join('\n') + '\nChỉ trả MỘT mảng JSON: [{"i":số,"buoc":"…"|null}]';
      const t0 = Date.now(); let res, j; try { res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: p }] }) }); j = await res.json().catch(() => ({})); } catch (e) { return { ok: false, loi: String(e.message || e).slice(0, 100), so: xong }; }
      await ghiAIUsage(env, { provider: 'anthropic', model, tinh_nang: 'hoc_doc_loi', tokens_vao: so(j.usage && j.usage.input_tokens), tokens_ra: so(j.usage && j.usage.output_tokens), ok: !!res.ok, ms: Date.now() - t0, loi: res.ok ? null : String((j.error && j.error.message) || res.status).slice(0, 200), muc: 'API' }); if (!res.ok) return { ok: false, so: xong };
      const txt = ((j.content || []).find((c) => c.type === 'text') || {}).text || ''; let arr = []; try { arr = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1)); } catch { arr = []; } const kq = {}; for (const o of (Array.isArray(arr) ? arr : [])) kq[so(o.i)] = o.buoc;
      const st = []; lo.forEach((r, i) => { const t = P(r.nhan_thay) || {}; const moi = qt.find((v) => cf(v) === cf(kq[i + 1])) || null; const nt = { ...t, buoc: moi, buoc_goc: t.buoc_goc || t.buoc || null }; const rr = { ...r, nhan_thay: J(nt) };
        st.push(env.DB.prepare(`UPDATE mau_doan SET nhan_thay=?, trang_thai=?, buoc_thu=1, updated_at=? WHERE id=?`).bind(rr.nhan_thay, tinhTT(rr), nowISO(), r.id)); xong++; }); await env.DB.batch(st); }
    return { ok: true, so: xong }; }
  // ---------- bộ nhãn ----------
  async function boNhan(env) { const rows = (await env.DB.prepare(`SELECT * FROM bo_nhan`).all()).results; const sp = (await env.DB.prepare(`SELECT id, ten, dong, quy_trinh, bai_test FROM san_pham`).all()).results;
    const qt = {}, bt = {}; for (const s of sp) { if (!s.dong) continue; qt[s.dong] = qt[s.dong] || []; bt[s.dong] = bt[s.dong] || []; for (const v of dsDongSP(s.quy_trinh)) if (!qt[s.dong].includes(v)) qt[s.dong].push(v); for (const v of dsDongSP(s.bai_test)) if (!bt[s.dong].includes(v)) bt[s.dong].push(v); }
    const qtSP = JSON.parse(JSON.stringify(qt)), btSP = JSON.parse(JSON.stringify(bt));
    const moTa = {}; for (const r of rows) if (r.mo_ta && r.trang_thai === 'DUNG') moTa[r.ten] = r.mo_ta;
    for (const r of rows.filter((x) => x.trang_thai === 'DUNG' && x.dong && (x.truong === 'buoc' || x.truong === 'bai_test')).sort((a, b) => (so(a.thu_tu) || 999) - (so(b.thu_tu) || 999) || String(a.created_at).localeCompare(String(b.created_at)))) { if (r.nguon === 'HE_THONG' && ((r.truong === 'buoc' ? qtSP : btSP)[r.dong] || []).length) continue; const o = r.truong === 'buoc' ? qt : bt; o[r.dong] = o[r.dong] || []; if (!o[r.dong].some((v) => cf(v) === cf(r.ten))) o[r.dong].push(r.ten); }
    const dung = (truong, dong) => rows.filter((r) => r.truong === truong && r.trang_thai === 'DUNG' && (!r.dong || !dong || r.dong === dong)).map((r) => r.ten);
    const dongs = [...new Set([...sp.map((s) => s.dong), ...rows.filter((r) => r.truong === 'dong' && r.trang_thai === 'DUNG').map((r) => r.ten), ...(await env.DB.prepare(`SELECT DISTINCT dong FROM mau_doan WHERE dong IS NOT NULL AND dong<>''`).all()).results.map((x) => x.dong)].filter(Boolean))].sort();
    return { rows, sp, qt, bt, qtSP, btSP, dung, dongs, moTa }; }
  const coTrong = (ds, v) => ds.some((x) => cf(x) === cf(v));
  // làm sạch một nhãn theo bộ nhãn; giá trị mới (không có trong bộ) được giữ và ghi vào hàng đề xuất (nguon THAY / NGUOI); trường cố định lạ thì bỏ
  function sach(o, bn, dong, deXuat, nguon) { if (!o || typeof o !== 'object') return null; const r = {};
    r.nhom = NHOM_CANH.includes(o.nhom) ? o.nhom : null;
    const moi = (truong, v) => { if (deXuat && nguon) deXuat.push({ truong, ten: v, dong: (truong === 'buoc' || truong === 'bai_test' || truong === 'vat_lieu') ? (dong || '') : '', nguon }); };
    const qd = (truong, v, ds) => { v = chuoi(v, 80); if (!v || v === '(không)') return null; const khop = ds.find((x) => cf(x) === cf(v)); if (khop) return khop; const q = quyVe(truong, v); if (q && q.bo) return null; if (q) { const k2 = ds.find((x) => cf(x) === cf(q.ten)) || (!dong && Object.values(truong === 'buoc' ? bn.qt : bn.bt).flat().find((x) => cf(x) === cf(q.ten))); if (k2) return k2; } moi(truong, v); return v; };
    r.buoc = r.nhom === 'THI_CONG' ? qd('buoc', o.buoc, (bn.qt[dong] || [])) : null;
    r.bai_test = r.nhom === 'THU_NGHIEM' ? qd('bai_test', o.bai_test, (bn.bt[dong] || [])) : null;
    for (const t of ['hanh_dong', 'vat_lieu', 'dung_cu']) { const ds = bn.dung(t, t === 'vat_lieu' ? dong : null); const vs = (Array.isArray(o[t]) ? o[t] : o[t] ? [o[t]] : []).map((v) => chuoi(v, 60)).filter(Boolean).slice(0, 6);
      r[t] = [...new Set(vs.map((v) => { const k = ds.find((x) => cf(x) === cf(v)); if (k) return k; const q = quyVe(t, v); if (q) return q.bo ? null : (ds.find((x) => cf(x) === cf(q.ten)) || q.ten); moi(t, v); return v; }).filter(Boolean))]; }
    { const v = chuoi(o.vi_tri, 60); if (v) { const q = quyVe('vi_tri', v); const v2 = q ? (q.bo ? null : q.ten) : v; const k = v2 && bn.dung('vi_tri').find((x) => cf(x) === cf(v2)); if (v2 && !k && !q) moi('vi_tri', v2); r.vi_tri = k || v2; } else r.vi_tri = null; }
    for (const t of Object.keys(CO_DINH)) { const v = chuoi(o[t], 40); r[t] = CO_DINH[t].find((x) => cf(x) === cf(v)) || null; }
    { const v = chuoi(o.co_canh, 30); r.co_canh = CO_CANH.includes(v) ? v : (Object.entries(TEN_CO_CANH).find(([, t]) => cf(t) === cf(v)) || [null])[0]; }
    r.tham_my = o.tham_my == null || o.tham_my === '' || Number(o.tham_my) < 0 ? null : Math.max(0, Math.min(10, so(o.tham_my)));
    r.mo_ta = chuoi(o.mo_ta, 200) || null;
    if (o.chac != null) r.chac = +Math.max(0, Math.min(1, so(o.chac))).toFixed(2); if (o.chac_buoc != null) r.chac_buoc = +Math.max(0, Math.min(1, so(o.chac_buoc))).toFixed(2); if (o.ly_do) r.ly_do = chuoi(o.ly_do, 160); if (o.model) r.model = chuoi(o.model, 60); if (o.nghe_sai) r.nghe_sai = true;
    return r; }
  async function ghiDeXuat(env, ds) { if (!ds.length) return; const st = [];
    for (const d of ds) st.push(env.DB.prepare(`INSERT OR IGNORE INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(uid('bn'), d.truong, chuoi(d.ten, 80), d.dong || '', 'DE_XUAT', d.nguon, nowISO(), nowISO()));
    await env.DB.batch(st); }

  // ---------- trạng thái (tính ra từ các cột nhãn, lưu để có chỉ mục) ----------
  function tinhTT(r) { const ng = P(r.nhan_nguoi), th = P(r.nhan_thay);
    if (r.loai === 'LOI') { if (ng) return ng.nghe_sai ? 'NGHE_SAI' : 'VANG'; if (!th) return 'CHO_THAY'; if (th.nghe_sai) return 'NGHE_SAI'; if (r.kiem) return 'KIEM'; return so(th.chac, 0.7) < CHAC_TOI_THIEU ? 'KHONG_CHAC' : 'THAY_CHOT'; }
    if (ng) return ng.khong_ro ? 'KHONG_RO' : 'VANG'; if (!th) return 'MO'; if (r.kiem) return 'KIEM'; return so(th.chac, 0.7) < CHAC_TOI_THIEU ? 'KHONG_CHAC' : 'THAY_CHOT'; }
  const tinhTS = (r) => r.nguoi_source ? 'VANG' : r.so_do ? 'LUAT' : null;

  // ---------- độ đúng theo trường (tính từ nhãn người) → tỉ lệ kiểm tự điều chỉnh ----------
  const TRUONG_DO = TRUONG.filter((t) => t.k !== 'mo_ta'); const coGt = (o, k) => !!o && o[k] != null && !(Array.isArray(o[k]) && !o[k].length);
  const giong = (t, a, b) => { if (t === 'tham_my') return a != null && b != null && Math.abs(so(a) - so(b)) <= 1; if (Array.isArray(a) || Array.isArray(b)) { const x = new Set((a || []).map(cf)), y = new Set((b || []).map(cf)); return x.size === y.size && [...x].every((v) => y.has(v)); } return cf(a) === cf(b); };
  async function doChinhXac(env) { await dam(env); const ds = (await env.DB.prepare(`SELECT loai, nguon, dong, kiem, nhan_mo, nhan_thay, nhan_nguoi, chac FROM mau_doan WHERE loai='HINH' AND nhan_nguoi IS NOT NULL AND COALESCE(nguoi_ten,'') NOT LIKE 'Claude%'`).all()).results.map((r) => ({ ...r, ng: P(r.nhan_nguoi), th: P(r.nhan_thay), mo: P(r.nhan_mo) })).filter((r) => r.ng && !r.ng.khong_ro && r.ng.nhom);
    const may = (r) => r.th || r.mo; const dN = (r) => may(r) && may(r).nhom === r.ng.nhom; const dC = (r) => dN(r) && cf(may(r).buoc) === cf(r.ng.buoc) && cf(may(r).bai_test) === cf(r.ng.bai_test);
    const dem = (a) => ({ so: a.length, dung_nhom: a.filter(dN).length, dung_chi_tiet: a.filter(dC).length });
    const theo_truong = {}; for (const t of TRUONG_DO) { const co = ds.filter((r) => r.ng[t.k] != null && !(Array.isArray(r.ng[t.k]) && !r.ng[t.k].length) && (!t.khi || r.ng.nhom === t.khi));
      theo_truong[t.k] = { so: co.length, thay_dung: co.filter((r) => r.th && giong(t.k, r.th[t.k], r.ng[t.k])).length, thay_so: co.filter((r) => r.th).length, mo_dung: co.filter((r) => coGt(r.mo, t.k) && giong(t.k, r.mo[t.k], r.ng[t.k])).length, mo_so: co.filter((r) => coGt(r.mo, t.k)).length }; /* mô hình mở đời cũ không gán trường này → chưa đo, không tính sai */ }
    const theo_nhom = {}; for (const r of ds) { const k = r.ng.nhom; (theo_nhom[k] = theo_nhom[k] || { so: 0, dung: 0 }).so++; if (dN(r)) theo_nhom[k].dung++; }
    const nh = {}; for (const r of ds) if (may(r) && !dN(r)) { const k = may(r).nhom + '>' + r.ng.nhom; nh[k] = (nh[k] || 0) + 1; }
    const coTin = ds.filter((r) => r.th && r.th.chac != null); const muc = [['≥ 0,9', (x) => x >= 0.9], ['0,6–0,9', (x) => x >= 0.6 && x < 0.9], ['< 0,6', (x) => x < 0.6]].map(([ten, fn]) => ({ ten, ...dem(coTin.filter((r) => fn(r.th.chac))) }));
    const ben = (k) => { const a = ds.filter((r) => r[k] && r[k].nhom); return { so: a.length, dung_nhom: a.filter((r) => r[k].nhom === r.ng.nhom).length }; };
    return { so_nhan: ds.length, ...(({ dung_nhom, dung_chi_tiet }) => ({ dung_nhom, dung_chi_tiet }))(dem(ds)), ngau_nhien: dem(ds.filter((r) => r.kiem)), can_xac_nhan: dem(ds.filter((r) => !r.kiem)),
      theo_nguon: { FOOTAGE: dem(ds.filter((r) => r.nguon === 'FOOTAGE')), THANH_PHAM: dem(ds.filter((r) => r.nguon === 'THANH_PHAM')) }, theo_nhom, theo_truong,
      nham: Object.entries(nh).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ may: k.split('>')[0], nguoi: k.split('>')[1], so: n })), muc_tin: muc, thay: ben('th'), mo: ben('mo') }; }
  // trường thầy đúng < 85% (≥ 20 mẫu kiểm) → kiểm 20%; còn lại 8%
  async function tiLeKiem(env) { const d = await doChinhXac(env); const yeu = Object.entries(d.theo_truong).filter(([, v]) => v.thay_so >= 20 && v.thay_dung / v.thay_so < 0.85).map(([k]) => k); return { yeu, p: (nhan) => (nhan && yeu.some((k) => nhan[k] != null && !(Array.isArray(nhan[k]) && !nhan[k].length))) ? 0.2 : 0.08 }; }

  // ---------- ghi từ MÁY (máy học gửi dòng thời gian / shot) — giữ nhãn người của đúng đơn vị khi học lại ----------
  async function upsertHinh(env, { nguon, doi_tuong_id, dong, ten, link, media_url, timeline, pt, cu, khungCua }) { await dam(env);
    const bn = await boNhan(env); const tl = Array.isArray(timeline) ? timeline : []; const cuRows = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE doi_tuong_id=? AND loai='HINH'`).bind(doi_tuong_id).all()).results; const byId = Object.fromEntries(cuRows.map((r) => [r.id, r]));
    const kiemTL = cu ? null : await tiLeKiem(env); const deXuat = []; const st = []; const now = nowISO();
    tl.forEach((d, i) => { const id = 'H:' + doi_tuong_id + ':' + i; const o = byId[id]; const cungDonVi = o && Math.abs(so(o.tu) - so(d.tu)) < 0.35 && Math.abs(so(o.den) - so(d.den)) < 0.35;
      const mo = sach(d.mo || (d.thay || d.nguoi || d.may ? d.may || null : { nhom: d.nhom, buoc: d.buoc, bai_test: d.bai_test, co_canh: d.co_canh, tham_my: d.tham_my, mo_ta: d.mo_ta }), bn, dong, null, null);
      const th = d.thay ? sach({ ...d.thay, mo_ta: d.thay.mo_ta || d.mo_ta }, bn, dong, deXuat, 'THAY') : null;
      let ng = null, ngTen = null, ngLuc = null, ngGiay = null, kiem = 0, src = null, ver = 1;
      if (cu) { if (d.nguoi || d.khong_ro) { ng = d.khong_ro ? { khong_ro: true } : sach({ nhom: d.nhom, buoc: d.buoc, bai_test: d.bai_test, tham_my: d.tham_my, mo_ta: d.mo_ta_nguoi || d.mo_ta }, bn, dong, null, null); if (ng && d.phan) ng.phan = d.phan; ngTen = d.nguoi || null; ngLuc = d.nguoi_luc || null; }
        kiem = d.kiem_ngau_nhien || d._ngau_nhien ? 1 : 0; src = d.source_nguoi ? J(d.source_nguoi) : null; }
      else if (cungDonVi) { ng = P(o.nhan_nguoi); ngTen = o.nguoi_ten; ngLuc = o.nguoi_luc; ngGiay = o.nguoi_giay; kiem = o.kiem; src = o.nguoi_source; ver = so(o.version, 1) + 1; }
      else { kiem = d.kiem_ngau_nhien || Math.random() < kiemTL.p(th) ? 1 : 0; if (o && o.nhan_nguoi) st.push(env.DB.prepare(`INSERT OR REPLACE INTO mau_doan (${COT}) SELECT ${COT.replace(/^id,/, '?,').replace(/hieu_luc/, '0')} FROM mau_doan WHERE id=?`).bind(id + ':cu' + Date.now().toString(36), id)); }   // ranh giới đổi: nhãn người cũ giữ lại (hết hiệu lực), không gán nhầm sang đoạn mới
      const so_do = pt ? soDoSource(pt, d) : (o ? P(o.so_do) : null);
      const r = { id, loai: 'HINH', nguon, doi_tuong_id, i, tu: +so(d.tu).toFixed(2), den: +so(d.den).toFixed(2), dong: dong || null, ten: ten || null, link: link || null, media_url: media_url || null, khung_url: d.khung_url || (khungCua && khungCua(d)) || (o && o.khung_url) || null,
        so_do: J(so_do), nhan_mo: J(mo), nhan_thay: J(th), nhan_nguoi: J(ng), nguoi_source: src, kiem, chac: th ? th.chac : null, version: ver };
      r.trang_thai = tinhTT(r); r.tt_source = tinhTS(r);
      st.push(env.DB.prepare(`INSERT INTO mau_doan (id,loai,nguon,doi_tuong_id,i,tu,den,dong,ten,link,media_url,khung_url,so_do,nhan_mo,nhan_thay,nhan_nguoi,nguoi_source,trang_thai,tt_source,kiem,chac,hieu_luc,version,nguoi_ten,nguoi_luc,nguoi_giay,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET tu=excluded.tu, den=excluded.den, dong=excluded.dong, ten=excluded.ten, link=excluded.link, media_url=excluded.media_url, khung_url=excluded.khung_url, so_do=excluded.so_do, nhan_mo=excluded.nhan_mo, nhan_thay=excluded.nhan_thay, nhan_nguoi=excluded.nhan_nguoi, nguoi_source=excluded.nguoi_source, trang_thai=excluded.trang_thai, tt_source=excluded.tt_source, kiem=excluded.kiem, chac=excluded.chac, hieu_luc=1, version=excluded.version, nguoi_ten=excluded.nguoi_ten, nguoi_luc=excluded.nguoi_luc, nguoi_giay=excluded.nguoi_giay, updated_at=excluded.updated_at`)
        .bind(r.id, r.loai, r.nguon, r.doi_tuong_id, r.i, r.tu, r.den, r.dong, r.ten, r.link, r.media_url, r.khung_url, r.so_do, r.nhan_mo, r.nhan_thay, r.nhan_nguoi, r.nguoi_source, r.trang_thai, r.tt_source, r.kiem, r.chac, r.version, ngTen, ngLuc, ngGiay, o ? o.created_at : now, now)); });
    for (const o of cuRows) if (o.i >= tl.length) st.push(o.nhan_nguoi ? env.DB.prepare(`UPDATE mau_doan SET hieu_luc=0, updated_at=? WHERE id=?`).bind(now, o.id) : env.DB.prepare(`DELETE FROM mau_doan WHERE id=?`).bind(o.id));
    if (st.length) await env.DB.batch(st); await ghiDeXuat(env, deXuat); return { so: tl.length, de_xuat: deXuat.length }; }
  // số đo nét/rung/sáng của footage đến sau (phân tích đoạn) → cập nhật đúng các đơn vị đã có
  async function capNhatSoDo(env, tai_san_id, pt) { await dam(env); const rows = (await env.DB.prepare(`SELECT id, tu, den, nguoi_source FROM mau_doan WHERE doi_tuong_id=? AND loai='HINH'`).bind(tai_san_id).all()).results; if (!rows.length) return;
    await env.DB.batch(rows.map((r) => { const sd = soDoSource(pt, r); return env.DB.prepare(`UPDATE mau_doan SET so_do=?, tt_source=?, updated_at=? WHERE id=?`).bind(J(sd), r.nguoi_source ? 'VANG' : sd ? 'LUAT' : null, nowISO(), r.id); })); }
  // câu thoại: mỗi shot có lời là một đơn vị; câu trước / sau làm ngữ cảnh; nhãn hình lúc câu chạy từ shot
  async function upsertLoi(env, { doi_tuong_id, dong, ten, link, media_url, shots, cu }) { await dam(env);
    const bn = await boNhan(env); const cuRows = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE doi_tuong_id=? AND loai='LOI'`).bind(doi_tuong_id).all()).results; const byId = Object.fromEntries(cuRows.map((r) => [r.id, r]));
    const ds = (Array.isArray(shots) ? shots : []).map((s, j) => ({ ...s, j })).filter((s) => chuoi(s.loi).length >= 4); const st = []; const now = nowISO(); const giu = new Set();
    ds.forEach((s, k) => { const id = cu ? s.id : 'L:' + doi_tuong_id + ':' + s.j; giu.add(id); const o = byId[id]; const text = chuoi(s.loi, 400); const cung = o && o.text === text;
      const hinh = sach(s.hinh || { nhom: s.nhom, buoc: s.buoc, bai_test: s.bai_test }, bn, dong, null, null);
      const th = cu ? (s.thay ? sach(s.thay, bn, dong, null, null) : null) : (cung ? P(o.nhan_thay) : null);
      const ng = cu ? s.nguoi || null : (cung ? P(o.nhan_nguoi) : null);
      const r = { id, loai: 'LOI', nguon: 'THANH_PHAM', media_url: media_url || (o && o.media_url) || null, doi_tuong_id, i: s.j, tu: +so(s.t0).toFixed(2), den: +so(s.t1).toFixed(2), dong: dong || null, ten: ten || null, link: link || null, khung_url: s.khung_url || null, am_url: s.am_url || null, text,
        cau_truoc: k > 0 ? chuoi(ds[k - 1].loi, 300) : null, cau_sau: k < ds.length - 1 ? chuoi(ds[k + 1].loi, 300) : null, nhan_hinh: J(hinh), nhan_thay: J(th), nhan_nguoi: J(ng), kiem: cu ? (s.kiem ? 1 : 0) : cung ? o.kiem : (Math.random() < 0.08 ? 1 : 0), version: o ? so(o.version, 1) + 1 : 1 };
      r.chac = th ? th.chac : null; r.trang_thai = tinhTT(r);
      st.push(env.DB.prepare(`INSERT INTO mau_doan (id,loai,nguon,doi_tuong_id,i,tu,den,dong,ten,link,media_url,khung_url,am_url,text,cau_truoc,cau_sau,nhan_hinh,nhan_thay,nhan_nguoi,trang_thai,kiem,chac,hieu_luc,version,nguoi_ten,nguoi_luc,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET tu=excluded.tu, den=excluded.den, dong=excluded.dong, ten=excluded.ten, link=excluded.link, media_url=excluded.media_url, khung_url=excluded.khung_url, am_url=excluded.am_url, text=excluded.text, cau_truoc=excluded.cau_truoc, cau_sau=excluded.cau_sau, nhan_hinh=excluded.nhan_hinh, nhan_thay=excluded.nhan_thay, nhan_nguoi=excluded.nhan_nguoi, trang_thai=excluded.trang_thai, kiem=excluded.kiem, chac=excluded.chac, hieu_luc=1, version=excluded.version, updated_at=excluded.updated_at`)
        .bind(r.id, 'LOI', 'THANH_PHAM', doi_tuong_id, r.i, r.tu, r.den, r.dong, r.ten, r.link, r.media_url, r.khung_url, r.am_url, r.text, r.cau_truoc, r.cau_sau, r.nhan_hinh, r.nhan_thay, r.nhan_nguoi, r.trang_thai, r.kiem, r.chac, r.version, cu ? s.cham_boi || null : (cung ? o.nguoi_ten : null), cu ? s.cham_at || null : (cung ? o.nguoi_luc : null), o ? o.created_at : (cu ? s.created_at || now : now), now)); });
    if (!cu) for (const o of cuRows) if (!giu.has(o.id)) st.push(o.nhan_nguoi ? env.DB.prepare(`UPDATE mau_doan SET hieu_luc=0, updated_at=? WHERE id=?`).bind(now, o.id) : env.DB.prepare(`DELETE FROM mau_doan WHERE id=?`).bind(o.id));
    if (st.length) await env.DB.batch(st); return { so: ds.length }; }
  async function xoaTheoDoiTuong(env, id) { await dam(env); await env.DB.prepare(`DELETE FROM mau_doan WHERE doi_tuong_id=?`).bind(id).run(); }

  // ---------- chuyển dữ liệu cũ (một lần; chạy lại vô hại) ----------
  async function chuyenCu(env) {
    const nk = (await env.DB.prepare(`SELECT doi_tuong_id, dau_vao FROM mau_hoc_ai WHERE tinh_nang='nhan_khung'`).all()).results; const ngauNhien = new Set();
    for (const x of nk) { const v = P(x.dau_vao) || {}; if (v.ngau_nhien) ngauNhien.add(x.doi_tuong_id + ':' + v.i); }
    const doVideo = async (bang, nguon, r, dong, extra) => { const pt = P(r.phan_tich) || {}; if (!Array.isArray(pt.timeline)) return; const tl = pt.timeline.map((d, i) => ({ ...d, _ngau_nhien: ngauNhien.has(r.id + ':' + i) }));
      await upsertHinh(env, { nguon, doi_tuong_id: r.id, dong, ten: r.ten, link: extra.link, media_url: extra.media_url, timeline: tl, pt: bang === 'tai_san' ? pt : null, cu: true });
      delete pt.timeline; pt.mau_doan = 1; await env.DB.prepare(`UPDATE ${bang} SET phan_tich=? WHERE id=?`).bind(JSON.stringify(pt), r.id).run(); };
    for (const r of (await env.DB.prepare(`SELECT id, ten, link, dong, phan_tich FROM kho_thanh_pham WHERE phan_tich LIKE '%"timeline"%'`).all()).results) await doVideo('kho_thanh_pham', 'THANH_PHAM', r, r.dong, { link: r.link });
    for (const r of (await env.DB.prepare(`SELECT t.id, t.ten, t.media_url, t.phan_tich, sp.dong FROM tai_san t LEFT JOIN muc_noi_dung mu ON mu.id=t.muc_id LEFT JOIN san_pham sp ON sp.id=mu.san_pham_id WHERE t.phan_tich LIKE '%"timeline"%'`).all()).results) await doVideo('tai_san', 'FOOTAGE', r, r.dong, { media_url: r.media_url });
    // câu thoại: mẫu doc_loi cũ → dòng LOI (id theo mẫu cũ), nhãn hình cũ, thầy cũ, người cũ
    const dl = (await env.DB.prepare(`SELECT m.id, m.doi_tuong_id, m.dau_vao, m.dau_ra, m.nhan, m.dong, m.created_at, m.cham_at, m.cham_boi, k.ten, k.link FROM mau_hoc_ai m LEFT JOIN kho_thanh_pham k ON k.id=m.doi_tuong_id WHERE m.tinh_nang='doc_loi'`).all()).results;
    const theoVideo = {}; for (const x of dl) (theoVideo[x.doi_tuong_id] = theoVideo[x.doi_tuong_id] || []).push(x);
    for (const [vid, ds] of Object.entries(theoVideo)) { const v0 = ds[0];
      await upsertLoi(env, { doi_tuong_id: vid, dong: v0.dong, ten: v0.ten, link: v0.link, cu: true, shots: ds.map((x) => { const dv = P(x.dau_vao) || {}, n = P(x.nhan) || {}, t = (P(x.dau_ra) || {}).thay || null; const nguoi = n.nguon === 'NGUOI' ? { nhom: n.nhom || null, buoc: n.buoc || null, bai_test: n.bai_test || null, nghe_sai: !!n.nghe_sai } : null;
        const hinh = n.nguon === 'NGUOI' ? (n.hinh || {}) : n; return { id: 'L:' + vid + ':m' + x.id, j: 0, loi: dv.text, t0: so(dv.vi_tri) * so(dv.dai), t1: so(dv.vi_tri) * so(dv.dai) + so(dv.dai), hinh, thay: t, nguoi, kiem: n.ngau_nhien, cham_boi: x.cham_boi, cham_at: x.cham_at, created_at: x.created_at }; }) }); }
    await env.DB.batch([env.DB.prepare(`DELETE FROM mau_hoc_ai WHERE tinh_nang IN ('nhan_khung','chat_luong_source','doc_loi')`),
      env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('mau_doan', ?, ?, 'Máy')`).bind(JSON.stringify({ v: 1, luc: nowISO() }), nowISO())]); }

  // ---------- đọc ra ----------
  const trangThaiTen = { VANG: 'Người đã kiểm', KIEM: 'Kiểm ngẫu nhiên', KHONG_CHAC: 'Thầy chưa chắc', THAY_CHOT: 'Thầy chốt', MO: 'Chỉ mô hình mở', KHONG_RO: 'Hình không rõ', NGHE_SAI: 'Nghe sai', CHO_THAY: 'Chờ thầy', LUAT: 'Chỉ luật máy' };
  function hienRow(r, extra = {}) { const ng = P(r.nhan_nguoi), th = P(r.nhan_thay), mo = P(r.nhan_mo), sd = P(r.so_do); const hieu = ng && !ng.khong_ro && !ng.nghe_sai ? ng : th || mo || P(r.nhan_hinh) || {};
    return { k: r.id, id: r.id, loai: r.loai, kn: r.loai === 'LOI' ? 'K4' : 'K1', nguon: r.nguon, doi_tuong_id: r.doi_tuong_id, i: r.i, ten: r.ten, dong: r.dong, link: r.link, media_url: r.media_url, khung_url: r.khung_url, am_url: r.am_url, tu: r.tu, den: r.den,
      text: r.text, cau_truoc: r.cau_truoc, cau_sau: r.cau_sau, tt: r.trang_thai, tt_source: r.tt_source, ngau_nhien: !!r.kiem, ly_do_hoi: r.kiem ? 'KIEM' : 'THAY_CHUA_CHAC', version: r.version,
      mo, thay: th, nguoi: ng ? { ...ng, ai: r.nguoi_ten, luc: r.nguoi_luc } : null, hinh: P(r.nhan_hinh), so_do: sd, nguoi_source: P(r.nguoi_source), may: sd ? luatSource(extra.nguong || {}, sd) : null,
      nhom: hieu.nhom || null, buoc: hieu.buoc || null, bai_test: hieu.bai_test || null, tu_tin: th ? th.chac : null, mo_ta: (ng && ng.mo_ta) || (th && th.mo_ta) || (mo && mo.mo_ta) || '', ...extra.them }; }
  async function timelineCua(env, ids) { await dam(env); const ra = {}; if (!ids.length) return ra; const rows = [];
    for (let k = 0; k < ids.length; k += 80) { const lo = ids.slice(k, k + 80); rows.push(...(await env.DB.prepare(`SELECT * FROM mau_doan WHERE loai='HINH' AND hieu_luc=1 AND doi_tuong_id IN (${lo.map(() => '?').join(',')}) ORDER BY i`).bind(...lo).all()).results); }
    for (const r of rows) { const h = hienRow(r); (ra[r.doi_tuong_id] = ra[r.doi_tuong_id] || []).push({ tu: r.tu, den: r.den, nhom: h.nhom, buoc: h.buoc, bai_test: h.bai_test, co_canh: (h.nguoi || h.thay || h.mo || {}).co_canh || null, tham_my: (h.nguoi || h.thay || h.mo || {}).tham_my ?? null, mo_ta: h.mo_ta, khung_url: r.khung_url, can_xac_nhan: TT_CAN.includes(r.trang_thai), nguoi: r.nguoi_ten || null, id: r.id }); }
    return ra; }
  async function quyTrinhDong(env) { const bn = await boNhan(env); return bn; }
  // ---------- hàng việc của người: chỉ đơn vị thầy chưa chắc + mẫu kiểm ngẫu nhiên ----------
  async function hangHinh(env, q) { await dam(env); const dong = chuoi(q.get('dong'), 80), n = Math.max(5, Math.min(60, so(q.get('n')) || 30)); const bo = new Set(String(q.get('bo') || '').split(',').filter(Boolean));
    const rows = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE loai='HINH' AND hieu_luc=1 AND trang_thai IN ('KHONG_CHAC','KIEM') ${dong ? 'AND dong=?' : ''} ORDER BY CASE trang_thai WHEN 'KHONG_CHAC' THEN 0 ELSE 1 END, chac, updated_at DESC LIMIT 300`).bind(...(dong ? [dong] : [])).all()).results.filter((r) => !bo.has(r.id));
    const kc = rows.filter((r) => r.trang_thai === 'KHONG_CHAC'), ki = rows.filter((r) => r.trang_thai === 'KIEM'); const chon = []; while (chon.length < n && (kc.length || ki.length)) chon.push(ki.length && (chon.length % 4 === 3 || !kc.length) ? ki.shift() : kc.shift());
    const vids = [...new Set(chon.map((r) => r.doi_tuong_id))]; const tlv = await timelineCua(env, vids); const bn = await boNhan(env);
    const hang = chon.map((r) => { const h = hienRow(r); return { ...h, quy_trinh: bn.qt[r.dong] || [], bai_test_ds: bn.bt[r.dong] || [], tl_video: (tlv[r.doi_tuong_id] || []).map((y) => [y.tu, y.den, y.nhom, y.nguoi ? 1 : 0]) }; });
    const d = await dem(env); const hl = (await docCauHinh(env)).huan_luyen || {}; const phut = await phutNguoi(env); const het = so(hl.tran_phut_ngay) > 0 && phut >= so(hl.tran_phut_ngay) && q.get('them') !== '1';
    return { hang: het ? [] : hang, het_tran: het, phut_hom_nay: +phut.toFixed(1), tran_phut: so(hl.tran_phut_ngay), con_lai: d.k1, can_xac_nhan: d.k1_can, tong_doan: d.hinh, da_gan: d.hinh_vang, khong_anh: 0, nhom: NHOM_CANH }; }
  async function hangLoi(env, q) { await dam(env); const dong = chuoi(q.get('dong'), 80), bo = new Set(String(q.get('bo') || '').split(',').filter(Boolean));
    const rows = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE loai='LOI' AND hieu_luc=1 AND trang_thai IN ('KHONG_CHAC','KIEM') ${dong ? 'AND dong=?' : ''} ORDER BY CASE trang_thai WHEN 'KHONG_CHAC' THEN 0 ELSE 1 END, chac LIMIT 60`).bind(...(dong ? [dong] : [])).all()).results.filter((r) => !bo.has(r.id));
    const bn = await boNhan(env); const d = await dem(env); const hl = (await docCauHinh(env)).huan_luyen || {}; const phut = await phutNguoi(env); const het = so(hl.tran_phut_ngay) > 0 && phut >= so(hl.tran_phut_ngay) && q.get('them') !== '1';
    return { hang: het ? [] : rows.slice(0, 30).map((r) => ({ ...hienRow(r), lech: !!(P(r.nhan_hinh) && P(r.nhan_thay) && P(r.nhan_hinh).nhom !== P(r.nhan_thay).nhom), quy_trinh: bn.qt[r.dong] || [], bai_test_ds: bn.bt[r.dong] || [] })), het_tran: het, phut_hom_nay: +phut.toFixed(1), tran_phut: so(hl.tran_phut_ngay), con_lai: d.k4, thay_nghe_sai: d.loi_nghe_sai, cho_thay: d.loi_cho_thay }; }
  async function hangSource(env, q) { await dam(env); const hl = (await docCauHinh(env)).huan_luyen || {}; const ng = hl.source_nguong || {}; const bo = new Set(String(q.get('bo') || '').split(',').filter(Boolean));
    const rows = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE loai='HINH' AND hieu_luc=1 AND tt_source='LUAT' AND nguon='FOOTAGE' LIMIT 400`).all()).results.filter((r) => !bo.has(r.id));
    const ds = rows.map((r) => { const sd = P(r.so_do); return { ...hienRow(r, { nguong: ng }), bien: Math.min(Math.abs(sd.net - so(ng.net, 0.55)), Math.abs(sd.dong - so(ng.dong, 0.25)), Math.abs(sd.sang - so(ng.sang0, 0.15)), Math.abs(sd.sang - so(ng.sang1, 0.92))) }; });
    const gan = ds.slice().sort((a, b) => a.bien - b.bien), nn = ds.slice().sort(() => Math.random() - 0.5); const ra = [], da = new Set();
    while (ra.length < 30 && (gan.length || nn.length)) { const x = (ra.length % 4 === 3 && nn.length) ? { ...nn.shift(), ngau_nhien: true } : (gan.shift() || { ...nn.shift(), ngau_nhien: true }); if (x && !da.has(x.k)) { da.add(x.k); ra.push(x); } }
    const phut = await phutNguoi(env); const het = so(hl.tran_phut_ngay) > 0 && phut >= so(hl.tran_phut_ngay) && q.get('them') !== '1';
    return { hang: het ? [] : ra, het_tran: het, phut_hom_nay: +phut.toFixed(1), tran_phut: so(hl.tran_phut_ngay), con_lai: ds.length, nguong: ng, hoc: hl.source_hoc || null }; }
  async function dem(env) { await dam(env); const g = (await env.DB.prepare(`SELECT loai, trang_thai, COUNT(*) n FROM mau_doan WHERE hieu_luc=1 GROUP BY loai, trang_thai`).all()).results; const s = (await env.DB.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE loai='HINH' AND hieu_luc=1 AND tt_source='LUAT' AND nguon='FOOTAGE'`).first()) || {};
    const c = (l, ts) => g.filter((x) => x.loai === l && (!ts || ts.includes(x.trang_thai))).reduce((a, x) => a + x.n, 0);
    return { k1: c('HINH', TT_CAN), k1_can: c('HINH', ['KHONG_CHAC']), k2: so(s.n), k4: c('LOI', TT_CAN), hinh: c('HINH'), hinh_vang: c('HINH', ['VANG', 'KHONG_RO']), loi_nghe_sai: c('LOI', ['NGHE_SAI']), loi_cho_thay: c('LOI', ['CHO_THAY']), hinh_thay_chot: c('HINH', ['THAY_CHOT']), theo: g }; }
  async function phutNguoi(env) { const tu = new Date(Date.parse(ngayVN() + 'T00:00:00Z') - 7 * 36e5).toISOString(); const r = (await env.DB.prepare(`SELECT COALESCE(SUM(COALESCE(nguoi_giay,5)),0) g FROM mau_doan WHERE nguoi_luc>=?`).bind(tu).first()) || {}; return so(r.g) / 60; }

  // ---------- KHO MẪU: lọc theo kỹ năng / trạng thái / dòng / nguồn / chữ; phân trang; có chỉ mục ----------
  async function khoMau(env, q) { await dam(env); const kn = ['K1', 'K2', 'K4'].includes(q.get('kn')) ? q.get('kn') : 'K1'; const tt = chuoi(q.get('tt'), 12), dong = chuoi(q.get('dong'), 80), nguon = chuoi(q.get('nguon'), 12), tim = chuoi(q.get('q'), 80);
    const trang = Math.max(1, so(q.get('trang')) || 1), n = Math.max(10, Math.min(60, so(q.get('n')) || 30)); const loai = kn === 'K4' ? 'LOI' : 'HINH'; const cot = kn === 'K2' ? 'tt_source' : 'trang_thai';
    const dk = [`loai=?`, `hieu_luc=1`], b = [loai]; if (kn === 'K2') dk.push(`tt_source IS NOT NULL`, `nguon='FOOTAGE'`);
    if (dong) { if (dong === '(chưa có)') dk.push(`(dong IS NULL OR dong='')`); else { dk.push(`dong=?`); b.push(dong); } } if (nguon) { dk.push(`nguon=?`); b.push(nguon); }
    if (tim) { dk.push(`(ten LIKE ? OR text LIKE ? OR nhan_thay LIKE ? OR nhan_nguoi LIKE ? OR nhan_mo LIKE ?)`); const l = '%' + tim + '%'; b.push(l, l, l, l, l); }
    { const L = `COALESCE(nhan_nguoi, nhan_thay, nhan_mo, nhan_hinh)`; const fNhom = chuoi(q.get('nhom'), 20), fBuoc = chuoi(q.get('buoc'), 80), fTr = chuoi(q.get('f'), 20), fGt = chuoi(q.get('v'), 80), fThieu = chuoi(q.get('thieu'), 20), fVideo = chuoi(q.get('video'), 60), fChac = so(q.get('chac_duoi'));   /* lọc theo nhãn đang có hiệu lực (người > thầy > mở) */
      const tr = (k) => TRUONG.find((t) => t.k === k);
      if (NHOM_CANH.includes(fNhom)) { dk.push(`json_extract(${L},'$.nhom')=?`); b.push(fNhom); }
      if (fBuoc) { if (fBuoc === '(trống)') dk.push(`json_extract(${L},'$.buoc') IS NULL`); else { dk.push(`json_extract(${L},'$.buoc')=?`); b.push(fBuoc); } }
      if (tr(fTr) && fGt) { if (tr(fTr).nhieu) dk.push(`EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(${L},'$.${fTr}'),'[]')) WHERE value=?)`); else dk.push(`json_extract(${L},'$.${fTr}')=?`); b.push(fGt); }
      if (tr(fThieu)) dk.push(tr(fThieu).nhieu ? `COALESCE(json_array_length(json_extract(${L},'$.${fThieu}')),0)=0` : `json_extract(${L},'$.${fThieu}') IS NULL`);
      if (q.get('lech') === '1') dk.push(`nhan_thay IS NOT NULL AND nhan_mo IS NOT NULL AND json_extract(nhan_thay,'$.nhom')<>json_extract(nhan_mo,'$.nhom')`);
      if (fVideo) { dk.push(`doi_tuong_id=?`); b.push(fVideo); } if (fChac > 0) { dk.push(`chac IS NOT NULL AND chac<?`); b.push(fChac); } }
    const demRows = (await env.DB.prepare(`SELECT ${cot} t, COUNT(*) n FROM mau_doan WHERE ${dk.join(' AND ')} GROUP BY ${cot}`).bind(...b).all()).results; const demTT = Object.fromEntries(demRows.filter((x) => x.t).map((x) => [x.t, x.n]));
    if (tt) { if (tt === 'CAN') { if (kn === 'K2') dk.push(`tt_source='LUAT'`); else dk.push(`${cot} IN ('KHONG_CHAC','KIEM')`); } else { dk.push(`${cot}=?`); b.push(tt); } }
    const tong = so(((await env.DB.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE ${dk.join(' AND ')}`).bind(...b).first()) || {}).n);
    const rows = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE ${dk.join(' AND ')} ORDER BY CASE ${cot} WHEN 'KHONG_CHAC' THEN 0 WHEN 'KIEM' THEN 1 ELSE 2 END, created_at DESC, doi_tuong_id, i LIMIT ? OFFSET ?`).bind(...b, n, (trang - 1) * n).all()).results;
    const ng = ((await docCauHinh(env)).huan_luyen || {}).source_nguong || {}; const bn = await boNhan(env);
    const dongCT = await dsDongChuan(env); const dongs = [...dongCT.map((x) => x.dong), '(chưa có)'];
    const videos = (await env.DB.prepare(`SELECT doi_tuong_id id, MAX(ten) ten, MAX(dong) dong, COUNT(*) n FROM mau_doan WHERE loai=? AND hieu_luc=1 GROUP BY doi_tuong_id ORDER BY MAX(created_at) DESC LIMIT 300`).bind(loai).all()).results;
    const hang = rows.map((r) => { const h = hienRow(r, { nguong: ng }); if (kn === 'K2') h.tt = r.tt_source; h.quy_trinh = bn.qt[r.dong] || []; h.bai_test_ds = bn.bt[r.dong] || []; h.kn = kn; return h; });
    return { kn, dem: demTT, tong: Object.values(demTT).reduce((a, x) => a + x, 0), can: kn === 'K2' ? (demTT.LUAT || 0) : (demTT.KHONG_CHAC || 0) + (demTT.KIEM || 0), loc: tong, dong_ct: dongCT, videos, nguong: kn === 'K2' ? ng : undefined, trang, so_trang: Math.max(1, Math.ceil(tong / n)), hang, dongs, ten_tt: trangThaiTen }; }

  // ---------- ghi từ NGƯỜI (version chống đè; 409 khi máy khác vừa sửa) ----------
  async function layRow(env, id) { await dam(env); return env.DB.prepare(`SELECT * FROM mau_doan WHERE id=?`).bind(id).first(); }
  const xungDot = (r) => json({ error: 'Mẫu vừa được người khác cập nhật — đã nạp bản mới, xem lại rồi lưu', xung_dot: true, row: hienRow(r) }, 409);
  async function ghiNguoiRow(env, me, r, ng, extra = {}) { const now = nowISO(); const moi = { ...r, nhan_nguoi: J(ng), ...extra }; moi.trang_thai = tinhTT(moi); moi.tt_source = tinhTS(moi);
    const kq = await env.DB.prepare(`UPDATE mau_doan SET nhan_nguoi=?, nguoi_source=?, text=?, trang_thai=?, tt_source=?, version=version+1, nguoi_ten=?, nguoi_luc=?, nguoi_giay=?, updated_at=? WHERE id=? AND version=?`)
      .bind(moi.nhan_nguoi, moi.nguoi_source || null, moi.text || null, moi.trang_thai, moi.tt_source, me.ho_ten, now, extra.nguoi_giay ?? null, now, r.id, r.version).run();
    return !!(kq.meta && kq.meta.changes); }
  async function luuHinh(env, me, id, body) { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); const r = await layRow(env, id); if (!r || r.loai !== 'HINH') return json({ error: 'Không có mẫu ' + id }, 404);
    if (body.version != null && so(body.version) !== r.version) return xungDot(r); const bn = await boNhan(env); const deXuat = []; const giay = Math.max(0, Math.min(120, so(body.giay))) || null;
    let ng; if (body.khong_ro) ng = { khong_ro: true };
    else { const goc = P(r.nhan_nguoi) || P(r.nhan_thay) || P(r.nhan_mo) || {}; const vao = body.nhan && typeof body.nhan === 'object' ? { ...body.nhan } : { ...goc, ...('nhom' in body ? { nhom: body.nhom, buoc: body.buoc, bai_test: body.bai_test } : {}), ...(body.tham_my != null && body.tham_my !== '' ? { tham_my: body.tham_my } : {}), ...(body.mo_ta ? { mo_ta: body.mo_ta } : {}) };
      let ph = null; if (Array.isArray(body.phan) && body.phan.filter(Boolean).length) { ph = body.phan.slice(0, 3).map((p) => p && NHOM_CANH.includes(p.nhom) ? sach(p, bn, r.dong, deXuat, 'NGUOI') : null); const dm = {}; ph.filter(Boolean).forEach((p) => { const k = p.nhom + '|' + (p.buoc || '') + '|' + (p.bai_test || ''); dm[k] = (dm[k] || 0) + 1; });   // một dải nhiều nội dung: nhãn cả đoạn = nhãn nhiều khung nhất
        if (Object.keys(dm).length) { const [nh, bu, bt] = Object.entries(dm).sort((a, b) => b[1] - a[1])[0][0].split('|'); Object.assign(vao, { nhom: nh, buoc: bu || null, bai_test: bt || null }); const m0 = ph.find((p) => p && p.mo_ta); if (m0 && !body.mo_ta) vao.mo_ta = m0.mo_ta; } else ph = null; }
      if (!NHOM_CANH.includes(vao.nhom)) return json({ error: 'Thiếu nhóm cảnh' }, 400);
      ng = sach(vao, bn, r.dong, deXuat, 'NGUOI'); delete ng.chac; delete ng.ly_do; delete ng.model; if (ph) ng.phan = ph.map((p, k) => p ? { ...p, k } : null); }
    let themVao = null; if (body.them_buoc && r.dong && ng && (ng.buoc || ng.bai_test)) themVao = await themQuyTrinh(env, me, r.dong, ng.buoc ? 'quy_trinh' : 'bai_test', ng.buoc || ng.bai_test);
    const ok = await ghiNguoiRow(env, me, r, ng, { nguoi_giay: giay }); if (!ok) return xungDot(await layRow(env, id));
    await ghiDeXuat(env, deXuat.filter((d) => !(themVao && !themVao.loi && cf(d.ten) === cf(themVao.gia_tri)))); const may = P(r.nhan_thay) || P(r.nhan_mo) || {};
    const dung = !!(ng && !ng.khong_ro && may.nhom === ng.nhom && cf(may.buoc) === cf(ng.buoc) && cf(may.bai_test) === cf(ng.bai_test));
    await logAudit(env, me, ng.khong_ro ? 'đánh dấu hình không rõ' : dung ? 'xác nhận nhãn hình' : 'sửa nhãn hình', 'mau_doan', id, ng.khong_ro ? '' : (may.nhom || '') + '/' + (may.buoc || '') + ' → ' + ng.nhom + '/' + (ng.buoc || ng.bai_test || ''));
    return json({ ok: true, dung, bo_qua: !!ng.khong_ro, them_vao: themVao, row: hienRow(await layRow(env, id)) }); }
  async function luuSource(env, me, id, body) { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); const r = await layRow(env, id); if (!r || r.loai !== 'HINH') return json({ error: 'Không có mẫu' }, 404);
    if (body.version != null && so(body.version) !== r.version) return xungDot(r); const LY = ['mờ', 'rung', 'tối', 'cháy sáng', 'che khuất', 'bố cục xấu', 'khác'];
    const quyet = { dung: !!body.dung, ly_do: (Array.isArray(body.ly_do) ? body.ly_do : []).filter((x) => LY.includes(x)).slice(0, 4), nguoi: me.ho_ten, luc: nowISO() }; const now = nowISO();
    const kq = await env.DB.prepare(`UPDATE mau_doan SET nguoi_source=?, tt_source='VANG', version=version+1, nguoi_giay=COALESCE(nguoi_giay,0)+?, nguoi_luc=COALESCE(nguoi_luc,?), updated_at=? WHERE id=? AND version=?`).bind(J(quyet), Math.max(0, Math.min(120, so(body.giay))) || 5, now, now, id, r.version).run();
    if (!(kq.meta && kq.meta.changes)) return xungDot(await layRow(env, id)); const sd = P(r.so_do); const ng = ((await docCauHinh(env)).huan_luyen || {}).source_nguong || {}; const may = sd ? luatSource(ng, sd) : null;
    const n = so(((await env.DB.prepare(`SELECT COUNT(*) n FROM mau_doan WHERE nguoi_source IS NOT NULL`).first()) || {}).n); let hoc = null; if (n >= 30 && n % 10 === 0) hoc = await hocNguong(env);
    const moi = hienRow(await layRow(env, id), { nguong: ng }); moi.tt = moi.tt_source; return json({ ok: true, dung: !!may && may.dung === quyet.dung, hoc, row: moi }); }
  async function luuLoi(env, me, id, body) { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); const r = await layRow(env, id); if (!r || r.loai !== 'LOI') return json({ error: 'Không có câu' }, 404);
    if (body.version != null && so(body.version) !== r.version) return xungDot(r); const bn = await boNhan(env); const deXuat = [];
    const hinh = P(r.nhan_hinh); let ng; if (body.nghe_sai) ng = { nghe_sai: true, hinh };
    else { const th = P(r.nhan_thay) || {}; const vao = body.nhan || { nhom: body.nhom || th.nhom, buoc: body.buoc, bai_test: body.bai_test }; if (!NHOM_CANH.includes(vao.nhom)) return json({ error: 'Thiếu nhóm' }, 400); ng = { ...sach(vao, bn, r.dong, deXuat, 'NGUOI'), hinh, khop_hinh: body.khop_hinh == null ? null : !!body.khop_hinh, ngau_nhien: !!r.kiem }; delete ng.chac; }
    const textMoi = chuoi(body.text, 400); if (textMoi && textMoi !== r.text) ng.text_goc = r.text;
    const ok = await ghiNguoiRow(env, me, r, ng, { text: textMoi || r.text, nguoi_giay: Math.max(0, Math.min(120, so(body.giay))) || null }); if (!ok) return xungDot(await layRow(env, id)); await ghiDeXuat(env, deXuat);
    const th = P(r.nhan_thay) || {}; return json({ ok: true, dung: !body.nghe_sai && th.nhom === ng.nhom, row: hienRow(await layRow(env, id)) }); }
  // sửa hàng loạt: chấp nhận nhãn thầy, hoặc đặt một trường cho nhiều mẫu
  async function hangLoat(env, me, body) { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 200); const bn = await boNhan(env); let n = 0, bo = 0; const deXuat = [];
    const tr = TRUONG.find((t) => t.k === body.truong);
    for (const id of ids) { const r = await layRow(env, id); if (!r || r.loai !== 'HINH') { bo++; continue; } let ng;
      if (body.lay_thay) { const th = P(r.nhan_thay); if (!th) { bo++; continue; } ng = { ...th }; delete ng.chac; delete ng.ly_do; delete ng.model; }
      else { if (!tr) return json({ error: 'Trường lạ' }, 400); const goc = { ...(P(r.nhan_nguoi) || P(r.nhan_thay) || P(r.nhan_mo) || {}) }; goc[tr.k] = tr.nhieu ? [...new Set([...(goc[tr.k] || []), body.gia_tri])] : body.gia_tri; ng = sach(goc, bn, r.dong, deXuat, 'NGUOI'); delete ng.chac; delete ng.ly_do; delete ng.model; }
      if (await ghiNguoiRow(env, me, r, ng)) n++; else bo++; }
    await ghiDeXuat(env, deXuat); await logAudit(env, me, 'sửa nhãn hàng loạt', 'mau_doan', ids.length + ' mẫu', body.lay_thay ? 'chấp nhận nhãn thầy' : (tr ? tr.ten + ' = ' + body.gia_tri : '')); return json({ ok: true, so: n, bo }); }
  async function themQuyTrinh(env, me, dong, cot, gt) { const truong = cot === 'quy_trinh' ? 'buoc' : 'bai_test'; if (!dong) return { loi: 'Chọn dòng sản phẩm cho ' + (truong === 'buoc' ? 'bước thi công' : 'bài test') };
    const sp = await env.DB.prepare(`SELECT id, ${cot} v FROM san_pham WHERE dong=? ORDER BY id LIMIT 1`).bind(dong).first();
    if (sp) { const ds = dsDongSP(sp.v); if (!ds.some((x) => cf(x) === cf(gt))) { await env.DB.prepare(`UPDATE san_pham SET ${cot}=? WHERE id=?`).bind([...ds, gt].join('\n'), sp.id).run(); await logAudit(env, me, 'thêm ' + (truong === 'buoc' ? 'bước thi công' : 'bài test'), 'san_pham', sp.id, dong + ': ' + gt); }
      await env.DB.prepare(`DELETE FROM bo_nhan WHERE truong=? AND ten=? AND dong=? AND trang_thai='DE_XUAT'`).bind(truong, gt, dong).run(); }
    else await env.DB.prepare(`INSERT INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,created_at,updated_at) VALUES (?,?,?,?,'DUNG','NGUOI',?,?) ON CONFLICT(truong,ten,dong) DO UPDATE SET trang_thai='DUNG', updated_at=excluded.updated_at`).bind(uid('bn'), truong, gt, dong, nowISO(), nowISO()).run();   // dòng chưa có sản phẩm: bước sống ở bộ nhãn của dòng
    return { dong, cot, gia_tri: gt }; }
  async function hocNguong(env) { const ds = (await env.DB.prepare(`SELECT id, so_do, nguoi_source FROM mau_doan WHERE nguoi_source IS NOT NULL AND so_do IS NOT NULL`).all()).results.map((r) => ({ sd: P(r.so_do), n: P(r.nguoi_source), kiem: parseInt(r.id.replace(/\D/g, '').slice(-2) || '0', 10) % 5 === 0 })).filter((x) => x.sd && x.n);
    if (ds.length < 30) return { ok: false, loi: 'cần ≥ 30 lần người quyết (có ' + ds.length + ')' }; const hoc = ds.filter((x) => !x.kiem), kiem = ds.filter((x) => x.kiem); const cham = (tap, ng) => tap.filter((x) => luatSource(ng, x.sd).dung === x.n.dung).length;
    let best = null; for (let net = 0.40; net <= 0.80; net += 0.02) for (let dg = 0.10; dg <= 0.60; dg += 0.05) for (let s0 = 0.05; s0 <= 0.30; s0 += 0.05) for (let s1 = 0.78; s1 <= 0.99; s1 += 0.03) { const ng = { net: +net.toFixed(2), dong: +dg.toFixed(2), sang0: +s0.toFixed(2), sang1: +s1.toFixed(2) }; const d = cham(hoc.length ? hoc : ds, ng); if (!best || d > best.d) best = { ng, d }; }
    const hl = (await docCauHinh(env)).huan_luyen || {}; const cu = hl.source_nguong || {}; const tapDo = kiem.length >= 8 ? kiem : ds;
    const moi = { ...best.ng, khop_pct: Math.round(cham(tapDo, best.ng) / tapDo.length * 100), khop_cu_pct: Math.round(cham(tapDo, cu) / tapDo.length * 100), n: ds.length, n_kiem: kiem.length, luc: nowISO() };
    const row = await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='huan_luyen'`).first(); const o = row ? (P(row.cau_hinh) || {}) : {}; o.source_hoc = moi;
    await env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at) VALUES ('huan_luyen', ?, ?)`).bind(JSON.stringify(o), nowISO()).run(); return { ok: true, ...moi }; }

  // ---------- ví dụ người đã sửa (cho thầy + mô hình mở ở lượt sau) ----------
  async function viDu(env, dong, n = 12) { await dam(env); const rows = (await env.DB.prepare(`SELECT dong, nhan_nguoi, nhan_thay, nhan_mo FROM mau_doan WHERE loai='HINH' AND nhan_nguoi IS NOT NULL AND nhan_nguoi NOT LIKE '%khong_ro%' ORDER BY nguoi_luc DESC LIMIT 80`).all()).results;
    const xep = [...rows.filter((r) => dong && r.dong && cf(dong).includes(cf(r.dong))), ...rows.filter((r) => !(dong && r.dong && cf(dong).includes(cf(r.dong))))].slice(0, n);
    return xep.map((r) => { const ng = P(r.nhan_nguoi) || {}, may = P(r.nhan_thay) || P(r.nhan_mo) || {}; const ct = ['dung_cu', 'hanh_dong', 'vat_lieu'].map((k) => (ng[k] || []).length ? k.replace('_', ' ') + ': ' + ng[k].join(', ') : '').filter(Boolean).join('; ');
      return 'Cảnh "' + chuoi(ng.mo_ta || may.mo_ta, 90) + '" là ' + ng.nhom + (ng.buoc ? ' / ' + ng.buoc : '') + (ng.bai_test ? ' / ' + ng.bai_test : '') + (ct ? ' (' + ct + ')' : '') + ((may.nhom && (may.nhom !== ng.nhom || cf(may.buoc) !== cf(ng.buoc))) ? ' — máy từng gán nhầm là ' + may.nhom + (may.buoc ? ' / ' + may.buoc : '') : ''); }); }

  // ---------- THẦY gán đủ trường theo bộ nhãn ----------
  async function thayDocDoan(env, x, bn, vd) { const key = env.ANTHROPIC_API_KEY; if (!key) return { ok: false, loi: 'chưa có ANTHROPIC_API_KEY' };
    { const ns = await kiemNganSachAI(env, { hoc: true }); if (!ns.ok) return { ok: false, loi: ns.loi, vuot_ngan_sach: true }; }   // hạn mức học chung của app
    const ai = (await docCauHinh(env)).ai || {}; if (so(ai.ngan_sach_thay_usd) > 0) { const da = (await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE thang=? AND tinh_nang IN ('hoc_nhan_khung','hoc_doc_loi')`).bind(thangHienTai()).first()) || {}; if (so(da.usd) >= so(ai.ngan_sach_thay_usd)) return { ok: false, loi: 'Hết ngân sách thầy tháng này (' + so(da.usd).toFixed(2) + '/' + so(ai.ngan_sach_thay_usd) + ' USD)', vuot_ngan_sach: true }; }
    const model = chuoi(ai.thay_nhin_model, 60) || 'claude-opus-5'; const doiMoi = /^claude-(opus-5|fable-5|sonnet-5)/.test(model); const dong = chuoi(x.dong || x.san_pham, 80);
    const qt = (Array.isArray(x.quy_trinh) && x.quy_trinh.length ? x.quy_trinh : bn.qt[dong] || []).map((v) => chuoi(v, 80)).filter(Boolean).slice(0, 20), bt = (Array.isArray(x.bai_test) && x.bai_test.length ? x.bai_test : bn.bt[dong] || []).map((v) => chuoi(v, 80)).filter(Boolean).slice(0, 20);
    const anh = []; for (const u of (Array.isArray(x.anh) ? x.anh : []).filter((u) => /^\/media\//.test(String(u || ''))).slice(0, 3)) { const obj = env.MEDIA && await env.MEDIA.get(u.slice(7)); if (!obj) continue; const buf = new Uint8Array(await obj.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); anh.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: btoa(bin) } }); }
    if (!anh.length) return { ok: false, loi: 'không thấy ảnh đoạn' };
    const ds = (t) => bn.dung(t, t === 'vat_lieu' ? dong : null); const L = (a) => a.length ? a.join(' | ') : '(chưa có — ghi tên đúng thứ nhìn thấy, sẽ thành đề xuất)';
    const LB = (a) => a.length ? '\n' + a.map((v, i) => '  ' + (i + 1) + '. ' + v + (bn.moTa[v] ? ' — nhận biết: ' + bn.moTa[v] : '')).join('\n') : ' (chưa có — ghi tên bước ngắn gọn, sẽ thành đề xuất)';
    const loi = 'Bạn là kỹ thuật viên thi công vật liệu xây dựng kiêm biên tập video của Kingsmen. ' + anh.length + ' ảnh là các DẢI của MỘT đoạn video (mỗi dải 3 khung liên tiếp, trái → phải, cách nhau 0,5 giây)' + (dong ? ' — dòng "' + dong + '"' : '') + '.\n' + (x.ngu_canh ? 'Ngữ cảnh: ' + chuoi(x.ngu_canh, 900) + '\n' : '') +
      'Gán ĐỦ các trường, chỉ chọn trong danh sách; thấy thứ chưa có tên trong danh sách thì ghi tên ngắn gọn đúng thứ nhìn thấy (sẽ thành đề xuất cho người duyệt).\n' +
      'nhom (một mã): ' + NHOM_CANH.map((k) => k + ' = ' + TEN_NHOM_CANH[k]).join('; ') + '\n' +
      'buoc (chỉ khi THI_CONG, chép nguyên văn MỘT tên bước trong danh sách, không rõ thì null; đừng đặt tên bước mới nếu cảnh khớp một bước có sẵn):' + LB(qt) + '\n' + (chuanCua(dong) ? chuanCua(dong).kien_thuc + '\n' : '') + 'bai_test (chỉ khi THU_NGHIEM, chép nguyên văn hoặc null): ' + L(bt) + '\n' +
      'hanh_dong (mảng): ' + L(ds('hanh_dong')) + '\n' + 'vat_lieu (mảng, sản phẩm / vật liệu thấy được): ' + L(ds('vat_lieu')) + '\n' + 'dung_cu (mảng): ' + L(ds('dung_cu')) + '\n' + 'vi_tri: ' + L(ds('vi_tri')) + '\n' +
      'nguoi: ' + CO_DINH.nguoi.join(' | ') + '\n' + 'co_canh (một mã): ' + Object.entries(TEN_CO_CANH).map(([k, v]) => k + ' = ' + v).join('; ') + '\n' + 'goc_may: ' + CO_DINH.goc_may.join(' | ') + '\n' + 'chuyen_dong: ' + CO_DINH.chuyen_dong.join(' | ') + '\n' + 'dung_cho: ' + CO_DINH.dung_cho.join(' | ') + '\n' +
      'tham_my (0–10, chỉ khi thấy bề mặt / mạch hoàn thiện, không thì -1): 0–3 bẩn, lem · 4–6 đang thi công · 7–8 xong nhưng chưa sạch / chưa đều · 9–10 đều, sạch, đáng làm cảnh chốt.\n' +
      'chac 0–1: bạn chắc bao nhiêu về NHÓM CẢNH (nhom). Chỉ ghi dưới 0,5 khi hình không rõ hoặc thật sự có thể là nhóm khác; KHÔNG trừ chac vì bước thi công không có trong danh sách — chuyện đó chấm riêng ở chac_buoc (0–1).\n' +
      (vd && vd.length ? 'Người của Kingsmen đã sửa những lần trước — làm theo đúng cách gán và cách gọi tên này:\n' + vd.slice(0, 12).map((v) => '- ' + chuoi(v, 220)).join('\n') + '\n' : '') +
      'Chỉ trả MỘT JSON: {"nhom":"…","buoc":null,"bai_test":null,"hanh_dong":[],"vat_lieu":[],"dung_cu":[],"vi_tri":null,"nguoi":"…","co_canh":"…","goc_may":"…","chuyen_dong":"…","tham_my":-1,"dung_cho":"…","chac":0.8,"chac_buoc":0.7,"mo_ta":"≤ 20 chữ tiếng Việt có dấu, đúng thứ nhìn thấy","ly_do":"≤ 15 chữ vì sao chọn nhóm này"}';
    const t0 = Date.now(); let res, j; try { res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', ...(doiMoi ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}) },
      body: JSON.stringify({ model, max_tokens: doiMoi ? 5000 : 700, ...(doiMoi ? { output_config: { effort: chuoi(ai.thay_nhin_effort, 10) || 'medium' }, fallbacks: 'default' } : {}), messages: [{ role: 'user', content: [...anh, { type: 'text', text: loi }] }] }) }); j = await res.json().catch(() => ({})); } catch (e) { return { ok: false, loi: String(e.message || e).slice(0, 120) }; }
    await ghiAIUsage(env, { provider: 'anthropic', model: chuoi(j && j.model, 60) || model, tinh_nang: 'hoc_nhan_khung', tokens_vao: so(j.usage && j.usage.input_tokens), tokens_ra: so(j.usage && j.usage.output_tokens), ok: !!res.ok, ms: Date.now() - t0, loi: res.ok ? null : String((j.error && j.error.message) || res.status).slice(0, 200), muc: 'API' });
    if (!res.ok) return { ok: false, loi: String((j.error && j.error.message) || res.status).slice(0, 120) }; if (j && j.stop_reason === 'refusal') return { ok: false, loi: 'thầy từ chối đọc đoạn này' };
    const o = docJSON(((j.content || []).find((c) => c.type === 'text') || {}).text, null) || (() => { const t = ((j.content || []).find((c) => c.type === 'text') || {}).text || ''; try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return null; } })() || {};
    if (!NHOM_CANH.includes(o.nhom)) return { ok: false, loi: 'thầy trả nhãn lạ' };
    const deXuat = []; const nhan = sach({ ...o, model: chuoi(j && j.model, 60) || model }, bn, dong, deXuat, 'THAY'); await ghiDeXuat(env, deXuat);
    return { ok: true, model: nhan.model, nhan, vao: so(j.usage && j.usage.input_tokens), ra: so(j.usage && j.usage.output_tokens) }; }
  async function hubThayDoc(env, body) { await dam(env); const ai = (await docCauHinh(env)).ai || {}; if (ai.thay_nhin === false) return json({ ok: false, tat: true, loi: 'Thầy (Claude) đang tắt ở Cấu hình' });
    const bn = await boNhan(env); const vd = await viDu(env, chuoi(body.dong || body.san_pham, 80)); const ds = (Array.isArray(body.doan) ? body.doan : []).slice(0, 30); const kq = new Array(ds.length); let k = 0;
    const chay = async () => { while (k < ds.length) { const i = k++; kq[i] = await thayDocDoan(env, { anh: ds[i].anh, quy_trinh: body.quy_trinh, bai_test: body.bai_test, san_pham: body.san_pham, dong: body.dong, ngu_canh: body.ngu_canh }, bn, vd).catch((e) => ({ ok: false, loi: String(e.message || e).slice(0, 100) }));
      if (kq[i].vuot_ngan_sach) { for (let q = k; q < ds.length; q++) kq[q] = { ok: false, loi: kq[i].loi, vuot_ngan_sach: true }; k = ds.length; } } };
    await Promise.all([chay(), chay(), chay(), chay()]); return json({ ok: true, kq }); }

  // ---------- THẦY đọc lời (Haiku, lô 20 câu) ----------
  async function thayDocLoi(env, toiDa = 60) { await dam(env); const cfg = await docCauHinh(env); const hl = cfg.huan_luyen || {}; const ai = cfg.ai || {}; if (hl.thay_loi === false || ai.thay_nhin === false) return { ok: false, tat: true }; const key = env.ANTHROPIC_API_KEY; if (!key) return { ok: false, loi: 'chưa có ANTHROPIC_API_KEY' };
    if (so(ai.ngan_sach_thay_usd) > 0) { const da = (await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE thang=? AND tinh_nang IN ('hoc_nhan_khung','hoc_doc_loi')`).bind(thangHienTai()).first()) || {}; if (so(da.usd) >= so(ai.ngan_sach_thay_usd)) return { ok: false, loi: 'Hết ngân sách thầy tháng này' }; }
    const ds = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE loai='LOI' AND hieu_luc=1 AND nhan_thay IS NULL AND nhan_nguoi IS NULL ORDER BY created_at LIMIT ?`).bind(Math.max(1, Math.min(200, toiDa))).all()).results; if (!ds.length) return { ok: true, so: 0 };
    const bn = await boNhan(env); const model = chuoi(hl.thay_loi_model, 60) || 'claude-haiku-4-5-20251001'; let xong = 0, loi = null; const deXuat = []; const theo = {}; for (const x of ds) (theo[x.dong || ''] = theo[x.dong || ''] || []).push(x);
    for (const [dong, d0] of Object.entries(theo)) for (let b = 0; b < d0.length; b += 20) { const lo = d0.slice(b, b + 20); const qt = bn.qt[dong] || [], bt = bn.bt[dong] || [];
      const p = 'Bạn là biên tập viên video của Kingsmen (vật liệu xây dựng' + (dong ? ', dòng ' + dong : '') + '). Dưới đây là các câu thoại (máy nghe chép lại, có thể sai chữ) trong video đã đăng. Với MỖI câu, cho biết câu đó đang nói về nhóm cảnh nào để chọn hình minh hoạ đúng.\nNHÓM: ' + NHOM_CANH.map((k) => k + ' (' + TEN_NHOM_CANH[k] + ')').join('; ') + '.\nBƯỚC THI CÔNG (chỉ khi THI_CONG, chép đúng một dòng hoặc null): ' + (qt.length ? qt.join(' | ') : '(chưa khai — null)') + '.\nBÀI TEST (chỉ khi THU_NGHIEM): ' + (bt.length ? bt.join(' | ') : '(chưa khai)') + '.\nNếu câu nghe sai tới mức không hiểu thì nghe_sai=true. chac 0–1, không chắc thì ghi dưới 0,6.\nCÂU:\n' + lo.map((x, i) => (i + 1) + '. "' + String(x.text || '').slice(0, 300).replace(/"/g, "'") + '"').join('\n') + '\nChỉ trả MỘT mảng JSON, mỗi phần tử {"i":số thứ tự,"nhom":"…","buoc":"…"|null,"bai_test":"…"|null,"chac":số,"nghe_sai":true|false}.';
      const t0 = Date.now(); let res, j; try { res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 1800, messages: [{ role: 'user', content: p }] }) }); j = await res.json().catch(() => ({})); } catch (e) { loi = String(e.message || e).slice(0, 100); break; }
      await ghiAIUsage(env, { provider: 'anthropic', model, tinh_nang: 'hoc_doc_loi', tokens_vao: so(j.usage && j.usage.input_tokens), tokens_ra: so(j.usage && j.usage.output_tokens), ok: !!res.ok, ms: Date.now() - t0, loi: res.ok ? null : String((j.error && j.error.message) || res.status).slice(0, 200), muc: 'API' });
      if (!res.ok) { loi = String((j.error && j.error.message) || res.status).slice(0, 100); break; }
      const txt = ((j.content || []).find((c) => c.type === 'text') || {}).text || ''; let arr = []; try { arr = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1)); } catch { arr = []; }
      const st = []; for (const o of (Array.isArray(arr) ? arr : [])) { const r = lo[so(o.i) - 1]; if (!r || !NHOM_CANH.includes(o.nhom)) continue; const th = { ...sach({ nhom: o.nhom, buoc: o.buoc, bai_test: o.bai_test, chac: o.chac }, bn, dong, deXuat, 'THAY'), model }; if (o.nghe_sai) th.nghe_sai = true;
        const moi = { ...r, nhan_thay: J(th), chac: th.chac }; moi.trang_thai = tinhTT(moi); st.push(env.DB.prepare(`UPDATE mau_doan SET nhan_thay=?, chac=?, trang_thai=?, updated_at=? WHERE id=?`).bind(moi.nhan_thay, moi.chac, moi.trang_thai, nowISO(), r.id)); xong++; }
      if (st.length) await env.DB.batch(st); }
    await ghiDeXuat(env, deXuat); return { ok: true, so: xong, loi }; }

  // ---------- THẦY ĐỌC BÙ (cron): đoạn có ảnh mà chưa có nhãn thầy, hoặc nhãn thầy đời cũ thiếu trường chi tiết → thầy đọc lại theo bộ nhãn.
  // Chỉ chạy trong trần ngân sách thầy; mỗi đoạn thử tối đa 2 lần; đoạn chưa có nhãn thầy trước. Ngữ cảnh = câu thoại cùng lúc của video.
  const SQL_BU = `loai='HINH' AND hieu_luc=1 AND khung_url LIKE '/media/%' AND COALESCE(thay_thu,0)<2 AND (nhan_thay IS NULL OR nhan_thay NOT LIKE '%"goc_may":"%')`;
  async function thayDocBu(env, n = 16) { await dam(env); const ai = (await docCauHinh(env)).ai || {}; if (ai.thay_nhin === false || ai.thay_bu === false) return { ok: false, tat: true }; if (!env.ANTHROPIC_API_KEY) return { ok: false, loi: 'chưa có ANTHROPIC_API_KEY' };
    const rows = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE ${SQL_BU} ORDER BY CASE WHEN nhan_thay IS NULL THEN 0 ELSE 1 END, created_at DESC LIMIT ?`).bind(Math.max(1, Math.min(40, n))).all()).results; if (!rows.length) return { ok: true, so: 0 };
    const bn = await boNhan(env); const vdCache = {}; const kiemTL = await tiLeKiem(env); let xong = 0, k = 0, dung = null;
    const lam = async () => { while (k < rows.length && !dung) { const r = rows[k++]; const loi = (await env.DB.prepare(`SELECT text FROM mau_doan WHERE doi_tuong_id=? AND loai='LOI' AND hieu_luc=1 AND den>=? AND tu<=? ORDER BY i LIMIT 4`).bind(r.doi_tuong_id, so(r.tu) - 3, so(r.den) + 3).all()).results.map((x) => x.text).filter(Boolean).join(' ');
      const vd = vdCache[r.dong || ''] || (vdCache[r.dong || ''] = await viDu(env, r.dong));
      const kq = await thayDocDoan(env, { anh: [r.khung_url], dong: r.dong, san_pham: r.dong, ngu_canh: [r.ten ? 'Video: ' + r.ten : '', loi ? 'Lời thoại lúc đó: ' + loi : ''].filter(Boolean).join(' · ') }, bn, vd).catch((e) => ({ ok: false, loi: String(e.message || e) }));
      if (kq.vuot_ngan_sach) { dung = kq.loi; break; }
      if (!kq.ok) { await env.DB.prepare(`UPDATE mau_doan SET thay_thu=COALESCE(thay_thu,0)+1 WHERE id=?`).bind(r.id).run(); continue; }
      const moi = { ...r, nhan_thay: J(kq.nhan), chac: kq.nhan.chac, kiem: r.nhan_thay ? r.kiem : (Math.random() < kiemTL.p(kq.nhan) ? 1 : 0) }; moi.trang_thai = tinhTT(moi);
      await env.DB.prepare(`UPDATE mau_doan SET nhan_thay=?, chac=?, kiem=?, trang_thai=?, thay_thu=COALESCE(thay_thu,0)+1, updated_at=? WHERE id=?`).bind(moi.nhan_thay, moi.chac, moi.kiem, moi.trang_thai, nowISO(), r.id).run(); xong++; } };
    await Promise.all([lam(), lam(), lam(), lam()]); return { ok: true, so: xong, het_tran: dung || null }; }
  async function tinhBu(env) { await dam(env); const g = (await env.DB.prepare(`SELECT SUM(CASE WHEN ${SQL_BU} THEN 1 ELSE 0 END) cho, SUM(CASE WHEN loai='HINH' AND hieu_luc=1 AND khung_url IS NULL THEN 1 ELSE 0 END) thieu_anh FROM mau_doan`).first()) || {};
    const ai = (await docCauHinh(env)).ai || {}; const da = (await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE thang=? AND tinh_nang IN ('hoc_nhan_khung','hoc_doc_loi')`).bind(thangHienTai()).first()) || {};
    return { cho: so(g.cho), thieu_anh: so(g.thieu_anh), usd: +so(da.usd).toFixed(2), tran: so(ai.ngan_sach_thay_usd), het_tran: so(ai.ngan_sach_thay_usd) > 0 && so(da.usd) >= so(ai.ngan_sach_thay_usd) }; }
  // ---------- BỘ NHÃN: đọc, thêm, duyệt, gộp (mọi mẫu chuyển theo), bỏ, đổi tên ----------
  async function dsBoNhan(env) { await dam(env); const bn = await boNhan(env); const all = (await env.DB.prepare(`SELECT id, loai, dong, ten, tu, den, khung_url, text, nhan_mo, nhan_thay, nhan_nguoi FROM mau_doan WHERE hieu_luc=1 ORDER BY created_at DESC`).all()).results;
    const dxKey = new Set(bn.rows.filter((r) => r.trang_thai === 'DE_XUAT').map((r) => r.truong + '|' + cf(r.ten))); const viDuDx = {};
    for (const r of all) for (const s of [r.nhan_thay, r.nhan_nguoi, r.nhan_mo]) { const o = P(s); if (!o) continue; for (const t of TRUONG) { const v = o[t.k]; if (v == null) continue; for (const x of [].concat(v)) { const k = t.k + '|' + cf(x); if (!dxKey.has(k)) continue; const a = viDuDx[k] = viDuDx[k] || []; if (a.length < 3 && !a.some((y) => y.id === r.id)) a.push({ id: r.id, khung_url: r.khung_url, mo_ta: chuoi(o.mo_ta || (r.loai === 'LOI' ? r.text : ''), 140), ten: r.ten, tu: r.tu, den: r.den }); } } } const THEO_DONG = ['buoc', 'bai_test', 'vat_lieu'];
    const dem = {}; for (const r of all) { const thay = new Set(); for (const s of [r.nhan_thay, r.nhan_nguoi, r.nhan_mo]) { const o = P(s); if (!o) continue; for (const t of TRUONG) { const v = o[t.k]; if (v == null || t.k === 'mo_ta') continue; for (const x of [].concat(v)) { const kk = t.k + '|' + cf(x) + (THEO_DONG.includes(t.k) ? '|' + (r.dong || '') : ''); if (thay.has(kk)) continue; thay.add(kk); dem[kk] = (dem[kk] || 0) + 1; } } } }   /* một mẫu đếm một lần dù cả mở, thầy, người cùng gán */
    const soMau = (truong, ten, dong) => dem[truong + '|' + cf(ten) + (THEO_DONG.includes(truong) ? '|' + (dong || '') : '')] || 0;
    const rows = bn.rows.filter((r) => r.trang_thai !== 'BO' && r.trang_thai !== 'GOP' && r.truong !== 'dong').map((r) => ({ ...r, dong: r.dong || null, so_mau: soMau(r.truong, r.ten, r.dong) })).sort((a, b) => (so(a.thu_tu) || 999) - (so(b.thu_tu) || 999));
    const quy = []; for (const [d, ds] of Object.entries(bn.qtSP)) ds.forEach((v, i) => quy.push({ id: 'qt:' + d + ':' + i, truong: 'buoc', ten: v, dong: d, trang_thai: 'DUNG', nguon: 'QUY_TRINH', thu_tu: i + 1, so_mau: soMau('buoc', v, d) }));
    for (const [d, ds] of Object.entries(bn.btSP)) ds.forEach((v, i) => quy.push({ id: 'bt:' + d + ':' + i, truong: 'bai_test', ten: v, dong: d, trang_thai: 'DUNG', nguon: 'QUY_TRINH', thu_tu: i + 1, so_mau: soMau('bai_test', v, d) }));
    const coDinh = []; for (const k of NHOM_CANH) coDinh.push({ id: 'cd:nhom:' + k, truong: 'nhom', ten: TEN_NHOM_CANH[k].split(':')[0], ma: k, trang_thai: 'DUNG', nguon: 'HE_THONG', so_mau: dem['nhom|' + cf(k)] || 0 });
    for (const [k, v] of Object.entries(TEN_CO_CANH)) coDinh.push({ id: 'cd:co_canh:' + k, truong: 'co_canh', ten: v, ma: k, trang_thai: 'DUNG', nguon: 'HE_THONG', so_mau: dem['co_canh|' + cf(k)] || 0 });
    for (const [t, ds] of Object.entries(CO_DINH)) for (const v of ds) coDinh.push({ id: 'cd:' + t + ':' + v, truong: t, ten: v, trang_thai: 'DUNG', nguon: 'HE_THONG', so_mau: dem[t + '|' + cf(v)] || 0 });
    return { truong: TRUONG, gia_tri: [...coDinh, ...quy, ...rows.filter((r) => r.trang_thai === 'DUNG')], de_xuat: rows.filter((r) => r.trang_thai === 'DE_XUAT').map((r) => ({ ...r, vi_du: viDuDx[r.truong + '|' + cf(r.ten)] || [], goi_y: goiYGop(r, [...coDinh, ...quy, ...rows.filter((x) => x.trang_thai === 'DUNG')]) })).sort((a, b) => b.so_mau - a.so_mau), dongs: (await dsDongChuan(env)).map((x) => x.dong), dong_ct: await dsDongChuan(env) }; }
  // gợi ý gộp: luật bộ nhãn chuẩn trước, không có thì nhãn cùng trường giống chữ nhất (≥ 40% từ chung)
  const TU_CHUNG = new Set(['may', 'cam', 'tay', 'bo', 'cai', 'cay', 'loai', 'dung', 'cu', 'bang', 'cua', 'va', 'cho', 'de', 'tren', 'len', 'san', 'mat', 'be', 'kingsmen', 'keo', 'son']);
  function goiYGop(r, dung) { const ds = dung.filter((x) => x.truong === r.truong && (!r.dong || !x.dong || x.dong === r.dong)); const q = quyVe(r.truong, r.ten); if (q && !q.bo) { const k = ds.find((x) => cf(x.ten) === cf(q.ten)); if (k) return { ten: k.ten, ly_do: 'theo bộ nhãn chuẩn' }; }
    const tu = (s) => new Set(cf(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !TU_CHUNG.has(w))); const a = tu(r.ten); let best = null;
    for (const x of ds) { const b = tu(x.ten); const chung = [...a].filter((w) => b.has(w)).length; const d = a.size + b.size ? 2 * chung / (a.size + b.size) : 0; if ((chung >= 2 || (chung === 1 && a.size === 1 && b.size === 1)) && d >= 0.6 && (!best || d > best.d)) best = { ten: x.ten, d }; }   /* bỏ từ chung (máy, cầm tay, bộ…), cần trùng từ đặc trưng */ return best ? { ten: best.ten, ly_do: 'giống chữ ' + Math.round(best.d * 100) + '%' } : null; }
  async function doiGiaTriMau(env, truong, tu, sang) { const rows = (await env.DB.prepare(`SELECT * FROM mau_doan WHERE nhan_thay LIKE ? OR nhan_nguoi LIKE ? OR nhan_mo LIKE ?`).bind('%' + tu + '%', '%' + tu + '%', '%' + tu + '%').all()).results; const st = [];
    for (const r of rows) { const up = {}; for (const c of ['nhan_mo', 'nhan_thay', 'nhan_nguoi']) { const o = P(r[c]); if (!o || o[truong] == null) continue; const cu = JSON.stringify(o[truong]); if (Array.isArray(o[truong])) o[truong] = [...new Set(o[truong].map((v) => cf(v) === cf(tu) ? sang : v))].filter((v) => v != null); else if (cf(o[truong]) === cf(tu)) o[truong] = sang; if (JSON.stringify(o[truong]) !== cu) up[c] = J(o); }
      if (Object.keys(up).length) st.push(env.DB.prepare(`UPDATE mau_doan SET ${Object.keys(up).map((c) => c + '=?').join(', ')}, version=version+1, updated_at=? WHERE id=?`).bind(...Object.values(up), nowISO(), r.id)); }
    if (st.length) await env.DB.batch(st); return st.length; }
  async function suaBoNhan(env, me, id, hanh, body) { if (!canGat(me)) return json({ error: 'Chỉ Trưởng MKT/Admin' }, 403); await dam(env); const r = await env.DB.prepare(`SELECT * FROM bo_nhan WHERE id=?`).bind(id).first(); if (!r) return json({ error: 'Không có nhãn' }, 404); let n = 0;
    if (hanh === 'duyet') { const loi = await duyetMot(env, me, r); if (loi) return json({ error: loi }, 400); }
    else if (hanh === 'gop') { const vao = chuoi(body.vao, 80); if (!vao) return json({ error: 'Chọn nhãn đích' }, 400); n = await doiGiaTriMau(env, r.truong, r.ten, vao); await env.DB.prepare(`UPDATE bo_nhan SET trang_thai='GOP', gop_vao=?, updated_at=? WHERE id=?`).bind(vao, nowISO(), id).run(); }
    else if (hanh === 'bo') await env.DB.prepare(`UPDATE bo_nhan SET trang_thai='BO', updated_at=? WHERE id=?`).bind(nowISO(), id).run();
    else if (hanh === 'doi-ten') { const ten = chuoi(body.ten, 80); if (!ten) return json({ error: 'Tên mới trống' }, 400); n = await doiGiaTriMau(env, r.truong, r.ten, ten); await env.DB.prepare(`UPDATE bo_nhan SET ten=?, updated_at=? WHERE id=?`).bind(ten, nowISO(), id).run(); }
    else return json({ error: 'Việc lạ' }, 400);
    await logAudit(env, me, ({ duyet: 'duyệt nhãn', gop: 'gộp nhãn', bo: 'bỏ nhãn', 'doi-ten': 'đổi tên nhãn' })[hanh], 'bo_nhan', id, r.truong + ': ' + r.ten + (body.vao ? ' → ' + body.vao : body.ten ? ' → ' + body.ten : '') + (n ? ' · ' + n + ' mẫu chuyển theo' : ''));
    return json({ ok: true, mau_chuyen: n, ...(await dsBoNhan(env)) }); }
  async function duyetMot(env, me, r) { if ((r.truong === 'buoc' || r.truong === 'bai_test') && r.dong) { const kq = await themQuyTrinh(env, me, r.dong, r.truong === 'buoc' ? 'quy_trinh' : 'bai_test', r.ten); if (kq.loi) return kq.loi; }
    await env.DB.prepare(`UPDATE bo_nhan SET trang_thai='DUNG', updated_at=? WHERE id=?`).bind(nowISO(), r.id).run(); return null; }
  async function hangLoatBoNhan(env, me, body) { if (!canGat(me)) return json({ error: 'Chỉ Trưởng MKT/Admin' }, 403); await dam(env); const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 400); if (!['duyet', 'bo'].includes(body.hanh)) return json({ error: 'Việc lạ' }, 400); let n = 0; const loi = [];
    for (const id of ids) { const r = await env.DB.prepare(`SELECT * FROM bo_nhan WHERE id=? AND trang_thai='DE_XUAT'`).bind(id).first(); if (!r) continue; if (body.hanh === 'bo') { await env.DB.prepare(`UPDATE bo_nhan SET trang_thai='BO', updated_at=? WHERE id=?`).bind(nowISO(), id).run(); n++; } else { const e = await duyetMot(env, me, r); if (e) loi.push(r.ten + ': ' + e); else n++; } }
    await logAudit(env, me, body.hanh === 'duyet' ? 'duyệt nhãn hàng loạt' : 'bỏ nhãn hàng loạt', 'bo_nhan', n + ' nhãn', loi.slice(0, 3).join(' · ')); return json({ ok: true, so: n, loi, ...(await dsBoNhan(env)) }); }
  async function themBoNhan(env, me, body) { if (!canGat(me)) return json({ error: 'Chỉ Trưởng MKT/Admin' }, 403); await dam(env); const ten = chuoi(body.ten, 80);
    if (body.truong === 'dong') { if (!ten) return json({ error: 'Gõ tên dòng' }, 400); await env.DB.prepare(`INSERT INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,created_at,updated_at) VALUES (?,'dong',?,'','DUNG','NGUOI',?,?) ON CONFLICT(truong,ten,dong) DO UPDATE SET trang_thai='DUNG', updated_at=excluded.updated_at`).bind(uid('bn'), ten, nowISO(), nowISO()).run(); await logAudit(env, me, 'thêm dòng sản phẩm', 'bo_nhan', ten, ''); return json({ ok: true, ...(await dsBoNhan(env)) }); }
    const tr = TRUONG.find((t) => t.k === body.truong); if (!tr || !ten) return json({ error: 'Thiếu trường / tên' }, 400);
    if (tr.kieu === 'CO_DINH' || tr.kieu === 'SO' || tr.kieu === 'CHU') return json({ error: 'Trường cố định, không thêm giá trị' }, 400);
    if (tr.kieu === 'QUY_TRINH') { const kq = await themQuyTrinh(env, me, chuoi(body.dong, 80), tr.k === 'buoc' ? 'quy_trinh' : 'bai_test', ten); if (kq.loi) return json({ error: kq.loi }, 400); }
    else await env.DB.prepare(`INSERT INTO bo_nhan (id,truong,ten,dong,trang_thai,nguon,created_at,updated_at) VALUES (?,?,?,?,'DUNG','NGUOI',?,?) ON CONFLICT(truong,ten,dong) DO UPDATE SET trang_thai='DUNG', updated_at=excluded.updated_at`).bind(uid('bn'), tr.k, ten, tr.theo_dong ? chuoi(body.dong, 80) : '', nowISO(), nowISO()).run();
    return json({ ok: true, ...(await dsBoNhan(env)) }); }

  // ---------- điều phối đường API ----------
  async function api(env, path, method, body, me, url) { let m;
    if (path === '/kho-mau' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await khoMau(env, url.searchParams)); }
    if (path === '/nhan-hinh/hang' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await hangHinh(env, url.searchParams)); }
    if (path === '/doc-loi/hang' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await hangLoi(env, url.searchParams)); }
    if (path === '/source/hang' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await hangSource(env, url.searchParams)); }
    if (path === '/source/hoc' && method === 'POST') { if (!canGat(me)) return json({ error: 'Chỉ Trưởng MKT/Admin' }, 403); return json(await hocNguong(env)); }
    if (path === '/doc-loi/thay' && method === 'POST') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await thayDocLoi(env, so(body.so) || 60)); }
    if (path === '/hop-viec/dem' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); const d = await dem(env); const hl = (await docCauHinh(env)).huan_luyen || {}; const phut = await phutNguoi(env); const dx = await env.DB.prepare(`SELECT COUNT(*) n FROM bo_nhan WHERE trang_thai='DE_XUAT'`).first(); return json({ k1: d.k1, k1_can: d.k1_can, k2: d.k2, k4: d.k4, de_xuat: so((dx || {}).n), phut_hom_nay: +phut.toFixed(1), tran_phut: so(hl.tran_phut_ngay), het_tran: so(hl.tran_phut_ngay) > 0 && phut >= so(hl.tran_phut_ngay) }); }
    if (path === '/mau-doan/hang-loat' && method === 'POST') return hangLoat(env, me, body);
    if (path === '/mau-doan/dat-dong' && method === 'POST') return datDong(env, me, body);
    if ((m = path.match(/^\/mau-doan\/([^/]+)\/source$/)) && method === 'POST') return luuSource(env, me, decodeURIComponent(m[1]), body);
    if ((m = path.match(/^\/mau-doan\/([^/]+)\/loi$/)) && method === 'POST') return luuLoi(env, me, decodeURIComponent(m[1]), body);
    if ((m = path.match(/^\/mau-doan\/([^/]+)$/)) && method === 'POST') return luuHinh(env, me, decodeURIComponent(m[1]), body);
    // đường cũ (theo video + chỉ số đoạn) — giữ cho tương thích, đi cùng một chỗ ghi
    if ((m = path.match(/^\/(tai-san|kho-thanh-pham)\/([^/]+)\/doan\/(\d+)\/source$/)) && method === 'POST') return luuSource(env, me, 'H:' + m[2] + ':' + m[3], body);
    if ((m = path.match(/^\/(tai-san|kho-thanh-pham)\/([^/]+)\/doan\/(\d+)$/)) && method === 'POST') return luuHinh(env, me, 'H:' + m[2] + ':' + m[3], body);
    if (path === '/bo-nhan' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await dsBoNhan(env)); }
    if (path === '/bo-nhan' && method === 'POST') return themBoNhan(env, me, body);
    if (path === '/bo-nhan/hang-loat' && method === 'POST') return hangLoatBoNhan(env, me, body);
    if ((m = path.match(/^\/bo-nhan\/([^/]+)\/(duyet|gop|bo|doi-ten)$/)) && method === 'POST') return suaBoNhan(env, me, m[1], m[2], body);
    if (path === '/do-chinh-xac' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); const d = await doChinhXac(env); const tl = await tiLeKiem(env); const dx = await env.DB.prepare(`SELECT COUNT(*) n FROM bo_nhan WHERE trang_thai='DE_XUAT'`).first(); return json({ ...d, truong_yeu: tl.yeu, dem: await dem(env), so_de_xuat: so((dx || {}).n), bu: await tinhBu(env) }); }
    if (path === '/thay/doc-bu' && method === 'POST') { if (!canGat(me)) return json({ error: 'Chỉ Trưởng MKT/Admin' }, 403); const r = await thayDocBu(env, so(body.so) || 12); return json({ ...r, bu: await tinhBu(env) }); }
    if (path === '/bo-nhan/tu-phang' && method === 'POST') { if (!canGat(me)) return json({ error: 'Chỉ Trưởng MKT/Admin' }, 403); const d = chuoi(body.dong, 80); if (!d) return json({ error: 'Chọn dòng' }, 400); await napTuPhang(env, d); return json({ ok: true, ...(await dsBoNhan(env)) }); }
    if (path === '/do-phu-truc' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await doPhuTruc(env)); }
    if ((m = path.match(/^\/kho-thanh-pham\/([^/]+)\/truc$/)) && method === 'POST') return suaTruc(env, me, m[1], body);
    if (path === '/nguon-hoc' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await nguonHoc(env)); }
    if (path === '/thay/bu' && method === 'GET') { if (!isStaff(me)) return json({ error: 'Không có quyền' }, 403); return json(await tinhBu(env)); }
    return null; }
  return { dam, api, dsDongChuan, thayGanTruc, doPhuTruc, TRUC, GOC_QUAY, tuGanDong, chayViecThayChu, chuanHoaBuoc, napTuPhang, thayDocBu, tinhBu, hubThayDoc, upsertHinh, upsertLoi, capNhatSoDo, xoaTheoDoiTuong, timelineCua, viDu, doChinhXac, dem, phutNguoi, thayDocLoi, hocNguong, boNhan, TRUONG };
}
