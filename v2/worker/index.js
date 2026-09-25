// ============================================================
//  KINGSMEN CONTENT OS — Worker (API + D1 + cron agent điều phối) + web tĩnh dist/
//  Hồ sơ nền: ../docs/CONTENT_OS_V2_BAN_VE.md · Sổ ADR: docs/SO_ADR.md
//  ADR-001: nền + bộ quyền thực hiện 12 bước + agent điều phối + màn Máy + danh mục gốc
// ============================================================

import { taoMau } from './mau.js';   // ADR-018: kho mẫu một nguồn (mau_doan + bo_nhan)
const ROLES = { MARKETING:'MARKETING', SALES:'SALES', ADMIN:'ADMIN', KY_THUAT:'KY_THUAT', TRUONG_MKT:'TRUONG_MKT', GIAM_DOC:'GIAM_DOC' };
const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type,Authorization,X-App-Token' };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers:{'Content-Type':'application/json; charset=utf-8', ...CORS} });
const uid = (p='id') => p+'_'+crypto.randomUUID().slice(0,8)+Date.now().toString(36).slice(-4);
const nowISO = () => new Date().toISOString();
const thangHienTai = () => nowISO().slice(0,7);
// giờ Việt Nam (UTC+7) — cron Cloudflare chạy theo UTC
function gioVN(d){ return (new Date(d||Date.now()).getUTCHours()+7)%24; }
function ngayVN(d){ return new Date((d||Date.now())+7*36e5).toISOString().slice(0,10); }
const bool = v => v ? 1 : 0;
const uBool = v => v===1 || v===true || v==='1';
const chuoi = (v, max=500) => String(v==null?'':v).trim().slice(0,max);
const so = (v, mac=0) => { const n=Number(v); return Number.isFinite(n)?n:mac; };

// ---------- mật khẩu (PBKDF2) ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
async function hashPassword(pw){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:100000, hash:'SHA-256'}, key, 256);
  return 'pbkdf2$100000$'+b64(salt)+'$'+b64(bits);
}
async function verifyPassword(pw, stored){
  try{
    const [scheme,iter,saltB64,hashB64] = (stored||'').split('$');
    if(scheme!=='pbkdf2') return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:fromB64(saltB64), iterations:Number(iter), hash:'SHA-256'}, key, 256);
    return b64(bits)===hashB64;
  }catch(e){ return false; }
}

// ---------- quyền ----------
const isStaff   = u => u && [ROLES.MARKETING, ROLES.TRUONG_MKT, ROLES.ADMIN].includes(u.vai_tro);
const canXemMkt = u => u && (isStaff(u) || u.vai_tro===ROLES.GIAM_DOC);      // GĐ đọc toàn bộ
const canGat    = u => u && [ROLES.ADMIN, ROLES.TRUONG_MKT].includes(u.vai_tro); // gạt mức người/AI, cấu hình Máy (Thiện chốt 2026-09-23)
const canNguoiDung = u => u && [ROLES.ADMIN, ROLES.TRUONG_MKT].includes(u.vai_tro);

// ============================================================
//  BỘ QUYỀN THỰC HIỆN — 12 bước của vòng lặp (bản vẽ §3b)
//  muc_toi_da: mức cao nhất người được gạt. Cổng G1–G4 luôn là NGƯỜI (không phải bước, nên không nằm đây).
// ============================================================
const MUC = ['NGUOI','AI_GOI_Y','AI_TU_LAM'];
const CONG = { G1:'Chốt định vị & chiến lược', G2:'Chốt kế hoạch tháng', G3:'Duyệt nội dung trước đăng', G4:'Duyệt đề xuất cải tiến' };
const BUOC = [
  { ma:'B1',  ten:'Gom & chấm trend',          tang:'T1',  cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'trend nào người duyệt/bỏ, lý do' },
  { ma:'B2',  ten:'Lập kế hoạch tháng',        tang:'T2',  cong:'G2', muc_toi_da:'AI_GOI_Y',  vai_tro:'TRUONG_MKT', hoc_gi:'người sửa số nào so với đề xuất' },
  { ma:'B3',  ten:'Chia tuần & tạo mục',       tang:'T3',  cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'người xếp tuần/ngày/kênh thế nào' },
  { ma:'B4',  ten:'Soạn nội dung',             tang:'T4',  cong:'G3', muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'bản nháp bóng so với bản người gửi duyệt' },
  { ma:'B5',  ten:'Thẩm định trước duyệt',     tang:'T5',  cong:'G3', muc_toi_da:'AI_GOI_Y',  vai_tro:'TRUONG_MKT', hoc_gi:'vì sao trả lại — máy không bao giờ tự duyệt' },
  { ma:'B6',  ten:'Sản xuất post / carousel',  tang:'T6',  cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'bản đăng cuối khác kịch bản chỗ nào' },
  { ma:'B7',  ten:'Sản xuất ảnh',              tang:'T6',  cong:null, muc_toi_da:'AI_GOI_Y',  vai_tro:'MARKETING',  hoc_gi:'brief nào ra ảnh được duyệt (cần API ảnh)' },
  { ma:'B8',  ten:'Sản xuất video',            tang:'T6',  cong:null, muc_toi_da:'NGUOI',     vai_tro:'MARKETING',  hoc_gi:'footage nào được chọn — máy chỉ chuẩn bị gói & giao việc' },
  { ma:'B9',  ten:'Xếp lịch & đăng',           tang:'T7',  cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'giờ/kênh nào cho kết quả tốt' },
  { ma:'B10', ten:'Đo lường',                  tang:'T8',  cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'— (số từ API, không học)' },
  { ma:'B11', ten:'Báo cáo',                   tang:'T9',  cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'TRUONG_MKT', hoc_gi:'người hay nhìn số nào, hỏi gì' },
  { ma:'B12', ten:'Rút bài học & đề xuất',     tang:'T10', cong:'G4', muc_toi_da:'AI_GOI_Y',  vai_tro:'TRUONG_MKT', hoc_gi:'bài học nào được duyệt, có số kèm không' },
  // ADR-007 — SEEDING HỘI NHÓM FACEBOOK (bản vẽ §11): phòng MKT tự vận hành, Trạm đăng bằng tài khoản MKT (mỗi tài khoản một giọng) — không Sales, không tiền
  { ma:'B13', ten:'Soạn gói & biến thể seeding',   tang:'S2',  cong:'G3', muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'người sửa biến thể / duyệt hay trả gói máy soạn (G3-gói)' },
  { ma:'B14', ten:'Xếp lịch seeding (nhóm × tài khoản × giờ vàng)', tang:'S3', cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING', hoc_gi:'người đổi nhóm/giờ/tài khoản thế nào' },
  { ma:'B15', ten:'Đăng vào hội nhóm qua Trạm',    tang:'S4',  cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'— (máy đăng bằng tài khoản MKT; NGƯỜI = giao việc đăng tay)' },
  { ma:'B16', ten:'Kiểm, đo & bắt lead seeding',   tang:'S5',  cong:null, muc_toi_da:'AI_TU_LAM', vai_tro:'MARKETING',  hoc_gi:'người lật kết luận máy (ĐẠT / KHÔNG ĐẠT / NGHI NGỜ); lead luôn người trả lời' },
  { ma:'B17', ten:'Học seeding & đề xuất',         tang:'S6',  cong:'G4', muc_toi_da:'AI_GOI_Y',  vai_tro:'TRUONG_MKT', hoc_gi:'đề xuất nhóm/thông điệp/giọng/giờ nào được duyệt' },
];
const BUOC_MAP = Object.fromEntries(BUOC.map(b=>[b.ma,b]));

// ---------- cấu hình module (mặc định; module_config ghi đè) ----------
const AI_MODEL_MAC_DINH='claude-sonnet-4-5';
const CONFIG_MAC_DINH = {
  // nguong_san_sang & min_mau: điều kiện để gạt một bước lên AI TỰ LÀM (Thiện chốt 80/100 & ≥30 mẫu)
  // ADR-006: nguong_ha & ngay_gan — bước đang ở mức AI mà điểm giống N ngày gần nhất tụt dưới nguong_ha (≥ mau_ha mẫu) → máy ĐỀ NGHỊ hạ (không tự hạ)
  may:   { nguong_san_sang:80, min_mau:30, gio_chay:6, nguong_ha:60, ngay_gan:14, mau_ha:5 },
  // Chi phí AI: gia = USD / 1 triệu token. ngan_sach_thang_usd=0 → không giới hạn. ngan_sach_hoc_pct: phần dành cho bản nháp bóng (chế độ học)
  // cho_may_phut: mô hình mở (máy ghép) không trả kết quả trong N phút → coi trễ, rơi về API dự phòng (ADR-009c)
  // ngan_sach_thay_usd: trần riêng cho Claude làm thầy gán nhãn hình khi học (ADR-016b/017), 0 = không giới hạn
  ai:    { ngan_sach_thay_usd:20, thay_nhin:true, thay_nhin_model:'claude-opus-5', thay_nhin_effort:'medium', ngan_sach_thang_usd:0, ngan_sach_hoc_pct:20, canh_bao_pct:80, chan_khi_vuot:true, ty_gia_vnd:26000, cho_may_phut:10,
           gia:{ 'claude-opus-5':{vao:5,ra:25}, 'claude-sonnet-5':{vao:2,ra:10}, 'claude-fable-5-1':{vao:10,ra:50}, 'claude-sonnet-4-5':{vao:3,ra:15}, 'claude-haiku-4-5-20251001':{vao:1,ra:5}, 'claude-opus-4-1':{vao:15,ra:75} } },
  duyet: { chan_tu_duyet:true },
  // ADR-017: bàn huấn luyện. tran_phut_ngay: hộp việc của người đóng khi đã làm đủ N phút trong ngày (bấm "làm thêm" vẫn được)
  // source_nguong: ngưỡng K2 ban đầu (ước lượng) — máy tự học lại khi có ≥ 30 lần người quyết. thay_loi: Claude Haiku gán nhãn câu lời theo cron.
  // anh_xa_dong: tên thư mục / kênh CHỨA chuỗi này (không phân biệt hoa thường) → dòng sản phẩm; máy học đọc luật này mỗi lượt
  huan_luyen:{ anh_xa_dong:[{chua:'FINEX',dong:'Finex'},{chua:'TERRAZ',dong:'Terrazo'},{chua:'KEO CHIT MACH',dong:'Keo chít mạch'},{chua:'KEO CHÍT MẠCH',dong:'Keo chít mạch'}], tran_phut_ngay:20, k1_gom_chung:300, k1_gom_dong:100, k1_vang_chung:200, k1_vang_dong:60, k2_gom:100, k2_vang:50, k4_gom:150, k4_vang:100, thay_loi:true, thay_loi_model:'claude-haiku-4-5-20251001',
    source_nguong:{ net:0.55, dong:0.25, sang0:0.15, sang1:0.92 } },
  // ADR-002: gom trend/ý tưởng. tu_khoa_nganh rỗng = nhận tất cả (dễ ngập rác — người trong nghề tự khai);
  // nguong_tu_duyet: điểm máy ≥ ngưỡng và không rủi ro claim thì tự duyệt KHI B1 ở mức AI_TU_LAM
  trend:   { tu_khoa_nganh:[], chong_trung_ngay:30, nguong_tu_duyet:70 },
  // ADR-002: kế hoạch tháng. ngay_de_xuat: máy lập bản đề xuất tháng sau vào ngày này (khi B2 ở mức AI)
  ke_hoach:{ tong_bai_mac_dinh:20, ngay_de_xuat:25 },
  // ADR-003: nội dung. soan_nhap_toi_da_ngay: máy soạn tối đa N bài/ngày (B4 ở mức AI); hoc_toi_da_ngay: bản nháp bóng/ngày;
  // diem_tham_dinh: điểm máy chấm ≥ ngưỡng → "máy nghĩ nên duyệt" (chỉ để học & xếp thứ tự, máy KHÔNG BAO GIỜ tự duyệt G3)
  noi_dung:{ soan_nhap_toi_da_ngay:5, hoc_toi_da_ngay:5, diem_tham_dinh:70 },
  // ADR-004: Trạm máy văn phòng (masfico-tram, hợp đồng hub1). khoa = khoá X-Hub-Key do Admin tạo trong màn Máy › Trạm;
  // so_ngay_do: bài đã đăng trong N ngày được đưa cho Trạm đo; im_lang_phut: quá N phút không nhịp tim → coi là mất Trạm
  tram:    { khoa:'', bat:true, so_ngay_do:30, im_lang_phut:6 },
  // ADR-008: video nháp máy dựng — giọng Google TTS vi-VN (Neural2-D nam / -A nữ), tốc độ, nhạc nền giảm dB, số cảnh & giây tối đa, giá TTS USD/1 triệu ký tự
  dung_video: { tts_giong:'vi-VN-Neural2-D', tts_toc_do:1, nhac_giam_db:18, canh_toi_da:12, giay_toi_da:90, tts_usd_1m_ky_tu:16 },
  // ADR-005: đo lường & báo cáo & học. so_ngay_do: bài đã đăng trong N ngày còn được đo; min_mau: số bài tối thiểu mỗi nhóm
  // để máy được rút đề xuất (bằng chứng ≥ min_mau, không có số thì không đề xuất); gui_n8n: báo cáo bắn sang N8N_WEBHOOK_URL (Zalo/mail)
  do_luong:{ so_ngay_do:30 },
  bao_cao: { gui_n8n:true, ngay_bao_cao_thang:1 },
  hoc:     { min_mau:5, lech_toi_thieu_pct:25, buoc_doi_ty_trong:10 },
  // ADR-007: seeding hội nhóm Facebook. gio_vang: mốc giờ thợ (VN); ty_le_link_toi_da %; nhip_tai_khoan_ngay; khoang_cach_phut; ngay_kiem: kiểm sau 2 & 7 ngày;
  // seeding_tuan_mac_dinh: chỉ tiêu bài seeding/tuần khi kế hoạch tháng chưa đặt; thong_diep_doi_ngay: thông điệp không có bài trong N ngày = "đói"
  seeding: { so_bien_the:3, so_ngay_lich:7, nhip_tai_khoan_ngay:2, khoang_cach_phut:180, gio_vang:[6,12,20], khop_toi_thieu:70, ngay_kiem:2, ngay_kiem_2:7, ngay_kiem_toi_da:10, goi_tu_dong_ngay:3, react_bat_thuong_x:5, tam_dung_gio:24, ty_le_link_toi_da:30, seeding_tuan_mac_dinh:4, thong_diep_doi_ngay:30, nhom_go_bai_pct:40,
    // 007b: bình luận dẫn dắt mỗi bài (tài khoản khác), trễ sau đăng (phút); nuôi tài khoản mỗi ngày (phút xem, số tim); tự chỉnh nhịp khi bị gỡ/checkpoint
    binh_luan_moi_bai:2, binh_luan_tre_min:30, binh_luan_tre_max:180, nuoi_moi_ngay:1, nuoi_phut:4, nuoi_tim:3, nhip_tu_chinh:true, go_bai_ha_nhip:2, checkpoint_ha_nhip:2 },
  // Mô phỏng: dữ liệu giả (tiền tố id mp_) để duyệt thiết kế; bật/tắt bằng /mo-phong/nap|xoa
  mo_phong: { bat:false },
};
async function docCauHinh(env){
  const out={}; for(const k of Object.keys(CONFIG_MAC_DINH)) out[k]=JSON.parse(JSON.stringify(CONFIG_MAC_DINH[k]));
  try{ (await env.DB.prepare(`SELECT * FROM module_config`).all()).results.forEach(r=>{ try{ out[r.id]={...(out[r.id]||{}), ...JSON.parse(r.cau_hinh||'{}')}; }catch(e){} }); }catch(e){}
  return out;
}

// ============================================================
//  SCHEMA (đợt 1). Bảng của các tầng khác thêm ở ADR sau.
// ============================================================
async function ensureSchema(env){
  const q=[
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, ho_ten TEXT, email TEXT UNIQUE, password TEXT, vai_tro TEXT, active INTEGER DEFAULT 1, doi_mat_khau INTEGER DEFAULT 0, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT)`,
    // tac_nhan: NGUOI | AGENT — luật L4: máy làm gì cũng có dấu vết
    `CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, at TEXT, tac_nhan TEXT, by_id TEXT, by_name TEXT, action TEXT, entity TEXT, entity_id TEXT, detail TEXT)`,
    `CREATE TABLE IF NOT EXISTS module_config (id TEXT PRIMARY KEY, cau_hinh TEXT, updated_at TEXT, updated_by_name TEXT)`,
    // khoá API dán từ giao diện (chủ 24/09) — giá trị mã hoá AES-GCM bằng két riêng; chỉ trả 4 ký tự cuối
    `CREATE TABLE IF NOT EXISTS khoa_api (ten TEXT PRIMARY KEY, gia_tri TEXT, iv TEXT, duoi TEXT, updated_at TEXT, updated_by_name TEXT)`,
    `CREATE TABLE IF NOT EXISTS ai_usage (id TEXT PRIMARY KEY, at TEXT, thang TEXT, provider TEXT, model TEXT, tinh_nang TEXT, user_id TEXT, user_name TEXT, tokens_vao INTEGER DEFAULT 0, tokens_ra INTEGER DEFAULT 0, chi_phi_usd REAL DEFAULT 0, ok INTEGER DEFAULT 1, ms INTEGER DEFAULT 0, loi TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_usage_thang ON ai_usage(thang)`,
    // Chiến lược (G1) — có phiên bản; chốt = tăng phien_ban (đợt 2 làm đầy đủ)
    `CREATE TABLE IF NOT EXISTS chien_luoc (id INTEGER PRIMARY KEY, dinh_vi TEXT, tong_giong TEXT, doi_tuong TEXT, phien_ban INTEGER DEFAULT 0, chot_boi TEXT, chot_at TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS pillars (id TEXT PRIMARY KEY, ten TEXT, mo_ta TEXT, ty_trong REAL DEFAULT 0, thu_tu INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS frameworks (id TEXT PRIMARY KEY, ten TEXT, mo_ta TEXT, pillar_id TEXT, active INTEGER DEFAULT 1, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS san_pham (id TEXT PRIMARY KEY, ma TEXT, ten TEXT, dong TEXT, mo_ta TEXT, thong_so TEXT, tieu_chuan TEXT, bao_hanh TEXT, huong_dan TEXT, active INTEGER DEFAULT 1, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS claim_cam (id TEXT PRIMARY KEY, cum_tu TEXT, muc_do TEXT, ly_do TEXT, active INTEGER DEFAULT 1, created_at TEXT)`,
    // token kênh KHÔNG lưu D1 — secret Worker TOKEN_<api_ma>
    `CREATE TABLE IF NOT EXISTS kenh (id TEXT PRIMARY KEY, ten TEXT, loai TEXT, api_ma TEXT, api_object_id TEXT, cach_dang TEXT DEFAULT 'TAY', active INTEGER DEFAULT 1, created_at TEXT)`,
    // Bộ quyền thực hiện — một dòng mỗi bước
    `CREATE TABLE IF NOT EXISTS buoc_thuc_hien (buoc TEXT PRIMARY KEY, nguoi_thuc_hien TEXT, vai_tro_nguoi TEXT, hoc INTEGER DEFAULT 1, san_sang INTEGER DEFAULT 0, so_mau INTEGER DEFAULT 0, doi_boi TEXT, doi_at TEXT)`,
    // Mẫu học: đầu vào máy thấy · đầu ra người · đầu ra máy (bản nháp bóng) · giong 0..1
    `CREATE TABLE IF NOT EXISTS mau_hoc (id TEXT PRIMARY KEY, buoc TEXT, ngay TEXT, doi_tuong_id TEXT, dau_vao TEXT, dau_ra_nguoi TEXT, dau_ra_may TEXT, giong REAL, ket_qua_sau TEXT, ghi_chu TEXT, created_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_mau_hoc_buoc ON mau_hoc(buoc, created_at)`,
    // Nhật ký agent: một dòng mỗi lượt chạy; thu=1 là "chạy thử" (không chiếm lượt của ngày)
    `CREATE TABLE IF NOT EXISTS agent_run (id TEXT PRIMARY KEY, agent TEXT, buoc TEXT, ngay TEXT, at TEXT, ok INTEGER, thu INTEGER DEFAULT 0, bo_qua_ly_do TEXT, tom_tat TEXT, doc INTEGER DEFAULT 0, ghi INTEGER DEFAULT 0, tokens INTEGER DEFAULT 0, usd REAL DEFAULT 0, ms INTEGER DEFAULT 0, chi_tiet TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_agent_run_ngay ON agent_run(agent, ngay)`,
    // Việc máy (hoặc người) giao cho người, có hạn
    `CREATE TABLE IF NOT EXISTS cong_viec (id TEXT PRIMARY KEY, loai TEXT, tieu_de TEXT, doi_tuong TEXT, doi_tuong_id TEXT, giao_cho_vai_tro TEXT, giao_cho_id TEXT, han TEXT, trang_thai TEXT DEFAULT 'MO', tao_boi TEXT, ly_do TEXT, created_at TEXT, xong_at TEXT, xong_boi TEXT)`,
  ];
  // ADR-002 — Chiến lược có phiên bản (G1), kế hoạch tháng (G2), mục nội dung, ý tưởng/trend
  q.push(
    `CREATE TABLE IF NOT EXISTS chien_luoc_phien_ban (id TEXT PRIMARY KEY, phien_ban INTEGER, dinh_vi TEXT, tong_giong TEXT, doi_tuong TEXT, pillars TEXT, ghi_chu TEXT, chot_boi TEXT, chot_at TEXT)`,
    // trang_thai: DE_XUAT (máy/người đang soạn) | CHOT (G2). nguon: DE_XUAT (máy) | NGUOI. ly_do: máy giải thích từng số
    `CREATE TABLE IF NOT EXISTS ke_hoach_thang (thang TEXT PRIMARY KEY, trang_thai TEXT DEFAULT 'DE_XUAT', chi_tieu TEXT, dinh_huong TEXT, nguon TEXT, ly_do TEXT, de_xuat TEXT, de_xuat_at TEXT, chot_boi TEXT, chot_at TEXT, updated_at TEXT, updated_by_name TEXT)`,
    // Một thẻ đi hết 6 giai đoạn. muc_tieu: BRAND | BAN_HANG (KPI đo khác nhau). tao_boi: NGUOI | AGENT
    `CREATE TABLE IF NOT EXISTS muc_noi_dung (id TEXT PRIMARY KEY, thang TEXT, tuan INTEGER, ngay_dang TEXT, tieu_de TEXT, muc_tieu TEXT, pillar_id TEXT, framework_id TEXT, san_pham_id TEXT, kenh_id TEXT, dinh_dang TEXT, giai_doan TEXT DEFAULT 'Y_TUONG', tao_boi TEXT, y_tuong_id TEXT, ghi_chu TEXT, created_at TEXT, created_by_name TEXT, updated_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_muc_thang ON muc_noi_dung(thang, tuan)`,
    // Ý tưởng: từ trend máy gom / AI / người. trang_thai: MOI | DUYET | BO. diem_may 0–100 (null = chưa chấm)
    `CREATE TABLE IF NOT EXISTS y_tuong (id TEXT PRIMARY KEY, nguon TEXT, ten TEXT, mo_ta TEXT, link TEXT, pillar_id TEXT, dinh_dang TEXT, muc_tieu TEXT, diem_may INTEGER, ly_do_may TEXT, rui_ro TEXT, trang_thai TEXT DEFAULT 'MOI', ngay TEXT, quyet_boi TEXT, quyet_at TEXT, ly_do_nguoi TEXT, muc_id TEXT, created_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_y_tuong_ngay ON y_tuong(created_at)`,
    // ADR-003 — nội dung (4 định dạng), phiên bản, duyệt G3, tài sản media, bài đăng
    // noi_dung.trang_thai: NHAP | CHO_DUYET | DUYET | TRA_LAI. dinh_dang bất biến sau khi tạo.
    `CREATE TABLE IF NOT EXISTS noi_dung (id TEXT PRIMARY KEY, muc_id TEXT, dinh_dang TEXT, phien_ban INTEGER DEFAULT 1, tieu_de TEXT, hook TEXT, sections TEXT, cta TEXT, chi_tiet TEXT, framework_id TEXT, san_pham_id TEXT, kenh_id TEXT, trang_thai TEXT DEFAULT 'NHAP', tao_boi TEXT, ly_do_may TEXT, created_at TEXT, created_by TEXT, created_by_name TEXT, updated_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_noi_dung_muc ON noi_dung(muc_id)`,
    `CREATE TABLE IF NOT EXISTS noi_dung_phien_ban (id TEXT PRIMARY KEY, noi_dung_id TEXT, phien_ban INTEGER, snapshot TEXT, created_at TEXT, created_by_name TEXT)`,
    // duyet: một dòng mỗi lần gửi duyệt. cham_may = {diem, ly_do[], loi_cung[]}. trang_thai: CHO | DUYET | TRA_LAI
    `CREATE TABLE IF NOT EXISTS duyet (id TEXT PRIMARY KEY, doi_tuong TEXT, doi_tuong_id TEXT, cong TEXT, trang_thai TEXT DEFAULT 'CHO', nguoi_gui_id TEXT, nguoi_gui_ten TEXT, cham_may TEXT, quyet_boi TEXT, quyet_at TEXT, ly_do_nguoi TEXT, created_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_duyet_tt ON duyet(trang_thai, created_at)`,
    // tai_san.loai: FOOTAGE | ANH | VIDEO_XUAT | GOI_DUNG | KHAC
    `CREATE TABLE IF NOT EXISTS tai_san (id TEXT PRIMARY KEY, loai TEXT, ten TEXT, mo_ta TEXT, media_url TEXT, media_type TEXT, muc_id TEXT, noi_dung_id TEXT, nguon TEXT, created_at TEXT, created_by_name TEXT)`,
    // ADR-010: kế hoạch ghép của một bản dựng — nguồn MAY (máy chọn) | NGUOI (người chỉnh ở màn Chỉnh ghép); canh=[{k,label,text,hinh,d,shots:[{tai_san_id,tu,den}]}]
    `CREATE TABLE IF NOT EXISTS ghep_video (id TEXT PRIMARY KEY, noi_dung_id TEXT, nguon TEXT, canh TEXT, video_url TEXT, created_at TEXT, created_by_name TEXT)`,
    // ADR-010d: kho video thành phẩm (dựng tay) để học — mỗi video: shot (t0,t1,cỡ cảnh,lời nói), nhịp; khớp clip gốc nếu thư mục có
    `CREATE TABLE IF NOT EXISTS kho_thanh_pham (id TEXT PRIMARY KEY, ten TEXT, nguon TEXT, nguon_id TEXT, thu_muc TEXT, dai REAL, so_shot INTEGER, nhip REAL, co_goc INTEGER DEFAULT 0, phan_tich TEXT, created_at TEXT)`,
    // bai_dang.trang_thai: CHUAN_BI | DA_LEN_LICH | DA_DANG | LOI. cach: TAY | API | N8N
    `CREATE TABLE IF NOT EXISTS bai_dang (id TEXT PRIMARY KEY, noi_dung_id TEXT, muc_id TEXT, kenh_id TEXT, gio_dang TEXT, cach TEXT, noi_dung_dang TEXT, media_url TEXT, link TEXT, trang_thai TEXT DEFAULT 'CHUAN_BI', loi TEXT, lan_thu INTEGER DEFAULT 0, posted_at TEXT, created_at TEXT, created_by_name TEXT, updated_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_bai_dang_tt ON bai_dang(trang_thai, gio_dang)`,
    // ADR-004 — Trạm: hàng đợi lệnh (Trạm hỏi 20 giây/lần), trạng thái nhịp tim, lô dữ liệu Trạm đẩy về
    `CREATE TABLE IF NOT EXISTS tram_lenh (id TEXT PRIMARY KEY, viec TEXT, tham_so TEXT, trang_thai TEXT DEFAULT 'CHO', ket_qua TEXT, tao_boi TEXT, created_at TEXT, gui_at TEXT, xong_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS tram_trang_thai (id TEXT PRIMARY KEY, than TEXT, nhan_luc TEXT)`,
    // ADR-008 — máy ghép theo tài khoản (máy con dựng video): khoá chỉ lưu hash; kha_nang ['dung_video']; than = nhịp tim gần nhất
    `CREATE TABLE IF NOT EXISTS may_ghep (id TEXT PRIMARY KEY, ten TEXT, chu_user_id TEXT, chu_ten TEXT, khoa_hash TEXT, kha_nang TEXT, ban TEXT, nhan_luc TEXT, than TEXT, active INTEGER DEFAULT 1, created_at TEXT)`,
    // ADR-009 — BỘ NÃO AI. mo_hinh: loai NGON_NGU|NHIN|NGHE|TTS|ANH · cach_goi API|MAY_GHEP · gia theo don_vi (1M_token | 1M_ky_tu) · phien_ban/checkpoint = đầu đã huấn luyện (mô hình mở)
    `CREATE TABLE IF NOT EXISTS mo_hinh (id TEXT PRIMARY KEY, ten TEXT, nha_cung_cap TEXT, loai TEXT, cach_goi TEXT, model_id TEXT, gia_vao REAL DEFAULT 0, gia_ra REAL DEFAULT 0, don_vi TEXT DEFAULT '1M_token', kha_nang TEXT, trang_thai TEXT DEFAULT 'BAT', phien_ban TEXT, checkpoint_url TEXT, diem INTEGER DEFAULT 0, so_mau INTEGER DEFAULT 0, ghi_chu TEXT, created_at TEXT, updated_at TEXT)`,
    // dinh_tuyen: mỗi TÍNH NĂNG một mô hình chính (API/quy tắc = thầy), dự phòng, mô hình mở (trò); muc API → BONG (mở chạy song song, không dùng) → MO (mở tự làm) — máy đề nghị, người gạt
    `CREATE TABLE IF NOT EXISTS dinh_tuyen (tinh_nang TEXT PRIMARY KEY, ten TEXT, loai TEXT, mo_hinh_chinh TEXT, mo_hinh_du_phong TEXT, mo_hinh_mo TEXT, muc TEXT DEFAULT 'API', nguong INTEGER DEFAULT 80, min_mau INTEGER DEFAULT 30, diem INTEGER DEFAULT 0, so_mau INTEGER DEFAULT 0, de_nghi TEXT, de_nghi_ly_do TEXT, updated_at TEXT, updated_by_name TEXT)`,
    // mau_hoc_ai: kho mẫu — đầu vào, đầu ra mô hình chính, đầu ra mô hình mở (bóng), phán quyết/nhãn người; tap HOC|KIEM (giữ lại 20% để đánh giá)
    `CREATE TABLE IF NOT EXISTS mau_hoc_ai (id TEXT PRIMARY KEY, tinh_nang TEXT, mo_hinh_id TEXT, doi_tuong TEXT, doi_tuong_id TEXT, dau_vao TEXT, dau_ra TEXT, dau_ra_mo TEXT, mo_hinh_mo_id TEXT, giong_mo REAL, phan_quyet TEXT, nhan TEXT, giong REAL, tap TEXT DEFAULT 'HOC', created_at TEXT, cham_at TEXT, cham_boi TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_mau_ai_tn ON mau_hoc_ai(tinh_nang, created_at)`,
    // mo_hinh_phien_ban: checkpoint máy huấn luyện gửi về + đánh giá trên tập kiểm → người duyệt (G4) mới bật
    `CREATE TABLE IF NOT EXISTS mo_hinh_phien_ban (id TEXT PRIMARY KEY, mo_hinh_id TEXT, tinh_nang TEXT, phien_ban TEXT, checkpoint_url TEXT, danh_gia TEXT, so_mau INTEGER, may TEXT, trang_thai TEXT DEFAULT 'CHO_DUYET', duyet_boi TEXT, duyet_at TEXT, ly_do TEXT, created_at TEXT, model_id TEXT)`,
    // ADR-009c — hàng đợi AI: tính năng ngôn ngữ ở mức MỞ → việc cho máy ghép chạy Ollama; ngu_canh = cách đi tiếp khi có kết quả; trang_thai CHO|DANG|XONG|HONG|HET_HAN
    `CREATE TABLE IF NOT EXISTS ai_viec (id TEXT PRIMARY KEY, tinh_nang TEXT, mo_hinh_id TEXT, may_id TEXT, dau_vao TEXT, ngu_canh TEXT, trang_thai TEXT DEFAULT 'CHO', dau_ra TEXT, ket_qua TEXT, loi TEXT, tokens_vao INTEGER DEFAULT 0, tokens_ra INTEGER DEFAULT 0, ms INTEGER DEFAULT 0, xu_ly INTEGER DEFAULT 0, created_at TEXT, bat_dau_at TEXT, xong_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_viec_tt ON ai_viec(trang_thai, created_at)`,
    `CREATE TABLE IF NOT EXISTS tram_lo (id TEXT PRIMARY KEY, viec TEXT, bang TEXT, luot TEXT, phan TEXT, so_dong INTEGER, xu_ly TEXT, created_at TEXT)`,
    // ADR-005 — kết quả (3 mức tin cậy, không cộng dồn), báo cáo, đề xuất cải tiến
    // ket_qua: muc_tin_cay TRUC_TIEP|GIAN_TIEP|KHONG_QUY_DON · nguon API_KENH|TRAM|SAN|NHAP_TAY|NGOAI · ky = ngày (API) hoặc kỳ đối soát
    // Số API/Trạm là TÍCH LUỸ → lưu PHẦN TĂNG so với lần đo trước (tổng các dòng = tích luỹ), tích luỹ giữ trong ghi_chu.
    `CREATE TABLE IF NOT EXISTS ket_qua (id TEXT PRIMARY KEY, bai_dang_id TEXT, muc_id TEXT, muc_tin_cay TEXT, nguon TEXT, ky TEXT, tiep_can INTEGER DEFAULT 0, luot_xem INTEGER DEFAULT 0, tuong_tac INTEGER DEFAULT 0, chia_se INTEGER DEFAULT 0, binh_luan INTEGER DEFAULT 0, luu INTEGER DEFAULT 0, click INTEGER DEFAULT 0, so_don INTEGER DEFAULT 0, doanh_thu REAL DEFAULT 0, ma_theo_doi TEXT, ghi_chu TEXT, created_at TEXT, created_by_name TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_ket_qua_bai ON ket_qua(bai_dang_id, nguon, ky)`,
    `CREATE TABLE IF NOT EXISTS bao_cao (id TEXT PRIMARY KEY, loai TEXT, ky TEXT, tu TEXT, den TEXT, so_lieu TEXT, nhan_dinh TEXT, nhan_dinh_may TEXT, viec_can_lam TEXT, trang_thai TEXT DEFAULT 'NHAP', gui_qua TEXT, gui_at TEXT, gui_boi TEXT, tao_boi TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS de_xuat (id TEXT PRIMARY KEY, ky TEXT, loai TEXT, tieu_de TEXT, noi_dung TEXT, bang_chung TEXT, ly_do TEXT, trang_thai TEXT DEFAULT 'CHO', quyet_boi TEXT, quyet_at TEXT, ly_do_nguoi TEXT, ap_dung TEXT, created_at TEXT)`,
    // ADR-007 — seeding hội nhóm Facebook (bản vẽ §11). Bản đồ thông điệp thuộc chiến lược (snapshot khi chốt G1)
    `CREATE TABLE IF NOT EXISTS thong_diep_seeding (id TEXT PRIMARY KEY, ten TEXT, y_chinh TEXT, du_kien TEXT, cach_noi_tho TEXT, khong_noi TEXT, pillar_id TEXT, thu_tu INTEGER DEFAULT 0, active INTEGER DEFAULT 1, tao_boi TEXT, created_at TEXT, updated_at TEXT)`,
    // tai_khoan_seeding: tài khoản MKT trên Trạm; giong THO|THAU|CHU_NHA cố định; tram_id = hồ sơ trình duyệt trên Trạm (facebook | facebook-<id>)
    `CREATE TABLE IF NOT EXISTS tai_khoan_seeding (id TEXT PRIMARY KEY, nhan TEXT, nen TEXT DEFAULT 'FB', tram_id TEXT, giong TEXT, persona TEXT, nhip_ngay INTEGER DEFAULT 2, active INTEGER DEFAULT 1, tam_dung_den TEXT, suc_khoe TEXT, created_at TEXT)`,
    // nhom_seeding.quy_tac {duyet_bai, cam_ban_hang, cam_link}; gio_vang [giờ VN]; tai_khoan_ids [] tài khoản đã ở trong nhóm
    `CREATE TABLE IF NOT EXISTS nhom_seeding (id TEXT PRIMARY KEY, ten TEXT, nen TEXT DEFAULT 'FB', link_hoac_id TEXT, chu_de TEXT, quy_tac TEXT, gio_vang TEXT, tai_khoan_ids TEXT, cach TEXT DEFAULT 'TRAM', nhip_tuan INTEGER DEFAULT 1, active INTEGER DEFAULT 1, hieu_qua TEXT, ghi_chu TEXT, created_at TEXT, created_by_name TEXT)`,
    // goi_seeding: đơn vị duyệt (G3-gói). loai BAI_CHINH | DINH_KY. trang_thai NHAP | CHO_DUYET | DUYET | TRA_LAI | HET_HAN
    `CREATE TABLE IF NOT EXISTS goi_seeding (id TEXT PRIMARY KEY, loai TEXT, bai_dang_id TEXT, noi_dung_id TEXT, muc_id TEXT, thong_diep_ids TEXT, so_bien_the INTEGER, so_viec INTEGER DEFAULT 0, han TEXT, trang_thai TEXT DEFAULT 'CHO_DUYET', cham_may TEXT, duyet_boi TEXT, duyet_at TEXT, ly_do TEXT, tao_boi TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS bien_the (id TEXT PRIMARY KEY, goi_id TEXT, thong_diep_id TEXT, giong TEXT, dang_bai TEXT, noi_dung TEXT, co_link INTEGER DEFAULT 0, binh_luan TEXT, bam TEXT, tao_boi TEXT, sua_boi TEXT, created_at TEXT, updated_at TEXT)`,
    // viec_seeding.trang_thai: CHO | DANG_GUI | DA_DANG | CHO_QUAN_TRI | LOI | DAT | KHONG_DAT | NGHI_NGO | HUY · cach TRAM | TAY
    `CREATE TABLE IF NOT EXISTS viec_seeding (id TEXT PRIMARY KEY, goi_id TEXT, bien_the_id TEXT, nhom_id TEXT, tai_khoan_id TEXT, cach TEXT DEFAULT 'TRAM', gio_dang TEXT, trang_thai TEXT DEFAULT 'CHO', link TEXT, msg_id TEXT, dang_at TEXT, lan_thu INTEGER DEFAULT 0, loi TEXT, bang_chung TEXT, kiem TEXT, so_lan_kiem INTEGER DEFAULT 0, ly_do TEXT, quyet_boi TEXT, quyet_at TEXT, created_at TEXT, updated_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_viec_seeding_tt ON viec_seeding(trang_thai, gio_dang)`,
    // lead từ bình luận hỏi mua/hỏi giá dưới bài seeding → giao MKT trả lời (luôn người)
    // ADR-007b — bình luận dẫn dắt (tài khoản khác trong nhóm bình luận dưới bài seeding) · nuôi tài khoản (xem, thả tim) · lead có loại/mức/gợi ý
    `CREATE TABLE IF NOT EXISTS binh_luan_seeding (id TEXT PRIMARY KEY, viec_id TEXT, tai_khoan_id TEXT, vai TEXT, text TEXT, gio TEXT, trang_thai TEXT DEFAULT 'CHO', dang_at TEXT, loi TEXT, lan_thu INTEGER DEFAULT 0, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS nuoi_seeding (id TEXT PRIMARY KEY, tai_khoan_id TEXT, nhom_id TEXT, gio TEXT, phut INTEGER DEFAULT 4, tim INTEGER DEFAULT 3, trang_thai TEXT DEFAULT 'CHO', ket_qua TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS lead_seeding (id TEXT PRIMARY KEY, viec_id TEXT, nguoi TEXT, noi_dung_hoi TEXT, link_bl TEXT, trang_thai TEXT DEFAULT 'MOI', giao_cho TEXT, tra_loi_at TEXT, tra_loi_boi TEXT, ghi_chu TEXT, created_at TEXT)`,
  );
  // ADR-006: điểm N ngày gần nhất + đề nghị của máy (LEN | XUONG | null) cho từng bước
  for(const s of [`ALTER TABLE buoc_thuc_hien ADD COLUMN san_sang_gan INTEGER DEFAULT 0`,`ALTER TABLE buoc_thuc_hien ADD COLUMN so_mau_gan INTEGER DEFAULT 0`,`ALTER TABLE buoc_thuc_hien ADD COLUMN de_nghi TEXT`,`ALTER TABLE buoc_thuc_hien ADD COLUMN de_nghi_ly_do TEXT`,`ALTER TABLE buoc_thuc_hien ADD COLUMN de_nghi_at TEXT`]) try{ await env.DB.prepare(s).run(); }catch(e){}
  for(const s of q) await env.DB.prepare(s).run();
  // cột thêm sau (DB cũ) — ALTER phải chạy SAU khi bảng đã tạo
  for(const st of [`ALTER TABLE kho_thanh_pham ADD COLUMN proxy_url TEXT`,`ALTER TABLE san_pham ADD COLUMN quy_trinh TEXT`,`ALTER TABLE san_pham ADD COLUMN bai_test TEXT`,`ALTER TABLE tai_san ADD COLUMN phan_tich TEXT`,`ALTER TABLE kho_thanh_pham ADD COLUMN luot_xem INTEGER`,`ALTER TABLE kho_thanh_pham ADD COLUMN luot_thich INTEGER`,`ALTER TABLE kho_thanh_pham ADD COLUMN ngay_dang TEXT`,`ALTER TABLE kho_thanh_pham ADD COLUMN link TEXT`,`ALTER TABLE kho_thanh_pham ADD COLUMN kenh TEXT`,`ALTER TABLE kho_thanh_pham ADD COLUMN doanh_thu REAL`,`ALTER TABLE kho_thanh_pham ADD COLUMN luot_ban INTEGER`,`ALTER TABLE kho_thanh_pham ADD COLUMN san_pham TEXT`,`ALTER TABLE kho_thanh_pham ADD COLUMN kich_ban TEXT`,`ALTER TABLE kho_thanh_pham ADD COLUMN dong TEXT`,`ALTER TABLE kho_thanh_pham ADD COLUMN muc_dich TEXT`,`ALTER TABLE mau_hoc_ai ADD COLUMN dong TEXT`,`ALTER TABLE mau_hoc_ai ADD COLUMN muc_dich TEXT`,`ALTER TABLE mo_hinh_phien_ban ADD COLUMN pham_vi TEXT DEFAULT 'chung'`,`ALTER TABLE bai_dang ADD COLUMN ma_theo_doi TEXT`,`ALTER TABLE tram_lenh ADD COLUMN may_id TEXT`,`ALTER TABLE ai_usage ADD COLUMN mo_hinh_id TEXT`,`ALTER TABLE ai_usage ADD COLUMN muc TEXT`,`ALTER TABLE mo_hinh_phien_ban ADD COLUMN model_id TEXT`,`ALTER TABLE lead_seeding ADD COLUMN loai TEXT`,`ALTER TABLE lead_seeding ADD COLUMN muc_do INTEGER`,`ALTER TABLE lead_seeding ADD COLUMN goi_y TEXT`,`ALTER TABLE mo_hinh ADD COLUMN base_url TEXT`,`ALTER TABLE mo_hinh ADD COLUMN khoa_env TEXT`]) try{ await env.DB.prepare(st).run(); }catch(e){}
  // pillar phục vụ mục tiêu nào → chỉ tiêu tháng & KPI đo theo đó
  try{ await env.DB.prepare(`ALTER TABLE pillars ADD COLUMN muc_tieu TEXT DEFAULT 'BRAND'`).run(); }catch(e){}
  await seedNeuTrong(env);
  await seedBoNaoAI(env);
}
async function seedNeuTrong(env){
  const u=await env.DB.prepare(`SELECT id FROM users LIMIT 1`).first();
  if(!u){
    // Tài khoản đầu tiên — bắt đổi mật khẩu ngay lần đăng nhập đầu (doi_mat_khau=1)
    await env.DB.prepare(`INSERT INTO users (id,ho_ten,email,password,vai_tro,active,doi_mat_khau,created_at) VALUES (?,?,?,?,?,1,1,?)`)
      .bind(uid('u'),'Admin','admin@kingsmen.vn',await hashPassword('admin123'),ROLES.ADMIN,nowISO()).run();
  }
  if(!(await env.DB.prepare(`SELECT id FROM chien_luoc WHERE id=1`).first()))
    await env.DB.prepare(`INSERT INTO chien_luoc (id,dinh_vi,tong_giong,doi_tuong,phien_ban,updated_at) VALUES (1,'','','',0,?)`).bind(nowISO()).run();
  // mọi bước mặc định NGƯỜI, học BẬT (giai đoạn 1: người làm, máy học)
  for(const b of BUOC){
    if(!(await env.DB.prepare(`SELECT buoc FROM buoc_thuc_hien WHERE buoc=?`).bind(b.ma).first()))
      await env.DB.prepare(`INSERT INTO buoc_thuc_hien (buoc,nguoi_thuc_hien,vai_tro_nguoi,hoc,san_sang,so_mau) VALUES (?,'NGUOI',?,1,0,0)`).bind(b.ma,b.vai_tro).run();
  }
}
async function logAudit(env, u, action, entity, entity_id, detail=''){
  await env.DB.prepare(`INSERT INTO audit (id,at,tac_nhan,by_id,by_name,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(uid('a'),nowISO(), u&&u.agent?'AGENT':'NGUOI', (u&&u.id)||null, (u&&u.ho_ten)||'—', action, entity, String(entity_id||''), chuoi(detail,1000)).run();
}

// ============================================================
//  AI (Anthropic ở Worker) + chi phí — chép từ app cũ, dùng từ đợt 2
// ============================================================
function tinhChiPhiAI(cfg, model, vao, ra){ const g=(cfg.gia||{})[model]; if(!g) return 0; return (so(vao)*so(g.vao)+so(ra)*so(g.ra))/1e6; }
async function ghiAIUsage(env, o){
  const cfg=(await docCauHinh(env)).ai||{};
  try{ await env.DB.prepare(`INSERT INTO ai_usage (id,at,thang,provider,model,tinh_nang,user_id,user_name,tokens_vao,tokens_ra,chi_phi_usd,ok,ms,loi,mo_hinh_id,muc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid('ai'), nowISO(), thangHienTai(), o.provider||'anthropic', o.model||'', chuoi(o.tinh_nang||'khac',40), (o.me&&o.me.id)||null, (o.me&&o.me.ho_ten)||'Agent', so(o.tokens_vao), so(o.tokens_ra), (o.chi_phi_usd!=null?so(o.chi_phi_usd):tinhChiPhiAI(cfg,o.model,o.tokens_vao,o.tokens_ra)), bool(o.ok!==false), so(o.ms), o.loi?chuoi(o.loi,300):null, o.mo_hinh_id||null, o.muc||null).run(); }catch(e){}
}
async function tongHopAI(env, thang){
  const t=await env.DB.prepare(`SELECT COUNT(*) so_lan, COALESCE(SUM(tokens_vao),0) vao, COALESCE(SUM(tokens_ra),0) ra, COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE thang=?`).bind(thang).first()||{};
  const cfg=(await docCauHinh(env)).ai||{}; const ns=so(cfg.ngan_sach_thang_usd);
  return { thang, so_lan:so(t.so_lan), tokens_vao:so(t.vao), tokens_ra:so(t.ra), usd:so(t.usd), ngan_sach_usd:ns, pct: ns? so(t.usd)/ns*100 : null, ty_gia_vnd:so(cfg.ty_gia_vnd,26000) };
}
async function kiemNganSachAI(env, {hoc=false}={}){
  const cfg=(await docCauHinh(env)).ai||{}; const ns=so(cfg.ngan_sach_thang_usd); if(!ns) return {ok:true};
  const t=await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE thang=?`).bind(thangHienTai()).first()||{};
  const usd=so(t.usd);
  if(cfg.chan_khi_vuot!==false && usd>=ns) return {ok:false, vuot_ngan_sach:true, loi:'Đã vượt ngân sách AI tháng này ('+usd.toFixed(2)+'/'+ns+' USD)'};
  if(hoc){ const th=await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE thang=? AND tinh_nang LIKE 'hoc_%'`).bind(thangHienTai()).first()||{};
    const nsHoc=ns*so(cfg.ngan_sach_hoc_pct,20)/100; if(so(th.usd)>=nsHoc) return {ok:false, vuot_ngan_sach:true, loi:'Hết ngân sách học tháng này ('+so(th.usd).toFixed(2)+'/'+nsHoc.toFixed(2)+' USD)'}; }
  return {ok:true, pct:usd/ns*100};
}
// ============================================================
//  ADR-009 — BỘ NÃO AI: danh mục mô hình · định tuyến theo tính năng · kho mẫu · bóng · huấn luyện
// ============================================================
const MO_HINH_SEED=[
  { id:'claude-sonnet-4-5', ten:'Claude Sonnet 4.5', nha_cung_cap:'anthropic', loai:'NGON_NGU', cach_goi:'API', model_id:'claude-sonnet-4-5', gia_vao:3, gia_ra:15, ghi_chu:'mặc định soạn bài' },
  { id:'claude-haiku-4-5', ten:'Claude Haiku 4.5', nha_cung_cap:'anthropic', loai:'NGON_NGU', cach_goi:'API', model_id:'claude-haiku-4-5-20251001', gia_vao:1, gia_ra:5, ghi_chu:'rẻ — chấm điểm, tóm tắt' },
  { id:'gemini-2-5-flash', ten:'Gemini 2.5 Flash', nha_cung_cap:'google', loai:'NGON_NGU', cach_goi:'API', model_id:'gemini-2.5-flash', gia_vao:0.3, gia_ra:2.5, ghi_chu:'cần GEMINI_API_KEY' },
  { id:'gpt-4o-mini', ten:'GPT-4o mini', nha_cung_cap:'openai', loai:'NGON_NGU', cach_goi:'API', model_id:'gpt-4o-mini', gia_vao:0.15, gia_ra:0.6, ghi_chu:'cần OPENAI_API_KEY' },
  // mô hình MỞ chạy trên máy chủ thuê ngoài, gọi qua API chuẩn OpenAI — nhanh & rẻ, không cần GPU tại chỗ (Thiện hỏi 24/09: "mô hình mở tốt nhất, hiệu quả, nhanh")
  { id:'groq-llama-3-3-70b', ten:'Llama 3.3 70B (Groq — rất nhanh)', nha_cung_cap:'openai_tuong_thich', loai:'NGON_NGU', cach_goi:'API', model_id:'llama-3.3-70b-versatile', gia_vao:0.59, gia_ra:0.79, base_url:'https://api.groq.com/openai/v1', khoa_env:'GROQ_API_KEY', ghi_chu:'mở · ~300 token/giây · có gói miễn phí' },
  { id:'deepinfra-qwen2-5-72b', ten:'Qwen2.5 72B Instruct (DeepInfra)', nha_cung_cap:'openai_tuong_thich', loai:'NGON_NGU', cach_goi:'API', model_id:'Qwen/Qwen2.5-72B-Instruct', gia_vao:0.35, gia_ra:0.4, base_url:'https://api.deepinfra.com/v1/openai', khoa_env:'DEEPINFRA_API_KEY', ghi_chu:'mở · tiếng Việt tốt nhất trong nhóm mở · rẻ hơn Claude ~10 lần' },
  { id:'vllm-tu-thue', ten:'vLLM máy chủ tự thuê (điền base_url)', nha_cung_cap:'openai_tuong_thich', loai:'NGON_NGU', cach_goi:'API', model_id:'kingsmen-qwen', gia_vao:0, gia_ra:0, base_url:'', khoa_env:'VLLM_API_KEY', ghi_chu:'mở · sau khi LoRA: chạy vLLM trên GPU thuê, dán base_url ở đây' },
  { id:'google-tts-neural2', ten:'Google TTS Neural2 vi-VN', nha_cung_cap:'google', loai:'TTS', cach_goi:'API', model_id:'vi-VN-Neural2-D', gia_vao:16, gia_ra:0, don_vi:'1M_ky_tu', ghi_chu:'cần GOOGLE_TTS_KEY' },
  { id:'qwen2-5-7b', ten:'Qwen2.5 7B (Ollama)', nha_cung_cap:'ollama', loai:'NGON_NGU', cach_goi:'MAY_GHEP', model_id:'qwen2.5:7b', gia_vao:0, gia_ra:0, ghi_chu:'mở — chạy bóng trên máy ghép có Ollama' },
  { id:'clip-vit-b16', ten:'CLIP ViT-B/16 + đầu học', nha_cung_cap:'huggingface', loai:'NHIN', cach_goi:'MAY_GHEP', model_id:'Xenova/clip-vit-base-patch16', gia_vao:0, gia_ra:0, ghi_chu:'mở — chọn cảnh / lọc footage; đầu (head) huấn luyện từ mẫu người chấm' },
  // ADR-010c: hai đầu học nhẹ riêng (không đè checkpoint CLIP của chọn cảnh) — chạy CPU trên máy dựng
  { id:'doan-tuyen-tinh', ten:'Đầu chọn đoạn (tuyến tính trên nét/động/sáng)', nha_cung_cap:'may', loai:'NHIN', cach_goi:'MAY_GHEP', model_id:'chon-doan-v1', gia_vao:0, gia_ra:0, ghi_chu:'mở — học từ màn Chỉnh ghép & video thành phẩm khớp clip gốc' },
  { id:'ghep-thong-ke', ten:'Đầu ghép (độ dài shot, chuyển cỡ cảnh)', nha_cung_cap:'may', loai:'NHIN', cach_goi:'MAY_GHEP', model_id:'ghep-v1', gia_vao:0, gia_ra:0, ghi_chu:'mở — thống kê có trọng số lượt xem từ video thành phẩm & bản người chỉnh' },
  { id:'whisper-base', ten:'Whisper base', nha_cung_cap:'huggingface', loai:'NGHE', cach_goi:'MAY_GHEP', model_id:'onnx-community/whisper-base', gia_vao:0, gia_ra:0, ghi_chu:'mở — nghe lời trong footage (009c)' },
  { id:'piper-vi', ten:'Piper TTS tiếng Việt', nha_cung_cap:'piper', loai:'TTS', cach_goi:'MAY_GHEP', model_id:'vi_VN-vais1000-medium', gia_vao:0, gia_ra:0, don_vi:'1M_ky_tu', ghi_chu:'mở — giọng đọc miễn phí (009c)' },
];
// mô hình chính null = quy tắc/người (không gọi API); NGON_NGU mức MỞ thuộc 009c (cần hàng đợi máy ghép) — 009 chỉ cho BÓNG
const DINH_TUYEN_SEED=[
  { tinh_nang:'soan_noi_dung', ten:'Soạn nội dung (người bấm ✨)', loai:'NGON_NGU', chinh:'claude-sonnet-4-5', du_phong:'claude-haiku-4-5', mo:'qwen2-5-7b' },
  { tinh_nang:'soan_nhap_agent', ten:'Soạn nháp theo kế hoạch (B4)', loai:'NGON_NGU', chinh:'claude-sonnet-4-5', du_phong:'claude-haiku-4-5', mo:'qwen2-5-7b' },
  { tinh_nang:'hoc_ban_bong', ten:'Bản nháp bóng (học B4)', loai:'NGON_NGU', chinh:'claude-haiku-4-5', du_phong:'claude-sonnet-4-5', mo:'qwen2-5-7b' },
  { tinh_nang:'seeding_bien_the', ten:'Biến thể seeding (B13)', loai:'NGON_NGU', chinh:'claude-sonnet-4-5', du_phong:'claude-haiku-4-5', mo:'qwen2-5-7b' },
  { tinh_nang:'seeding_thong_diep', ten:'Đề xuất bản đồ thông điệp', loai:'NGON_NGU', chinh:'claude-sonnet-4-5', du_phong:null, mo:null },
  { tinh_nang:'cham_y_tuong', ten:'Chấm ý tưởng/trend (B1)', loai:'NGON_NGU', chinh:'claude-haiku-4-5', du_phong:'claude-sonnet-4-5', mo:'qwen2-5-7b' },
  { tinh_nang:'bao_cao', ten:'Nhận định báo cáo (B11)', loai:'NGON_NGU', chinh:'claude-haiku-4-5', du_phong:'claude-sonnet-4-5', mo:'qwen2-5-7b' },
  { tinh_nang:'phan_loai_lead', ten:'Phân loại bình luận seeding → lead (B16)', loai:'NGON_NGU', chinh:'claude-haiku-4-5', du_phong:'claude-sonnet-4-5', mo:'qwen2-5-7b' },
  { tinh_nang:'tts', ten:'Giọng đọc video nháp', loai:'TTS', chinh:'google-tts-neural2', du_phong:null, mo:'piper-vi' },
  { tinh_nang:'chon_canh', ten:'Chọn footage cho từng cảnh (dựng video)', loai:'NHIN', chinh:null, du_phong:null, mo:'clip-vit-b16', nguong:75, min_mau:40 },
  { tinh_nang:'loc_footage', ten:'Lọc clip chuẩn từ footage thô', loai:'NHIN', chinh:null, du_phong:null, mo:'clip-vit-b16', nguong:75, min_mau:60 },
  // ADR-010: chọn ĐOẠN trong clip (nét, chuyển động, sáng, vị trí) và GHÉP (độ dài shot, nhịp cắt, chuyển cỡ cảnh) — học từ màn Chỉnh ghép và video thành phẩm
  { tinh_nang:'chon_doan', ten:'Chọn đoạn đẹp trong clip', loai:'NHIN', chinh:null, du_phong:null, mo:'doan-tuyen-tinh', nguong:75, min_mau:40 },
  { tinh_nang:'ghep_canh', ten:'Ghép shot: độ dài, nhịp, chuyển cảnh', loai:'NHIN', chinh:null, du_phong:null, mo:'ghep-thong-ke', nguong:75, min_mau:20 },
];
async function seedBoNaoAI(env){ for(const m of MO_HINH_SEED){ await env.DB.prepare(`INSERT OR IGNORE INTO mo_hinh (id,ten,nha_cung_cap,loai,cach_goi,model_id,gia_vao,gia_ra,don_vi,kha_nang,trang_thai,ghi_chu,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'BAT',?,?,?)`).bind(m.id,m.ten,m.nha_cung_cap,m.loai,m.cach_goi,m.model_id,m.gia_vao,m.gia_ra,m.don_vi||'1M_token','[]',m.ghi_chu||'',nowISO(),nowISO()).run(); if(m.base_url!=null||m.khoa_env) await env.DB.prepare(`UPDATE mo_hinh SET base_url=COALESCE(base_url,?), khoa_env=COALESCE(khoa_env,?) WHERE id=?`).bind(m.base_url||'', m.khoa_env||null, m.id).run(); }
  for(const d of DINH_TUYEN_SEED) await env.DB.prepare(`INSERT OR IGNORE INTO dinh_tuyen (tinh_nang,ten,loai,mo_hinh_chinh,mo_hinh_du_phong,mo_hinh_mo,muc,nguong,min_mau,updated_at) VALUES (?,?,?,?,?,?,'API',?,?,?)`).bind(d.tinh_nang,d.ten,d.loai,d.chinh,d.du_phong,d.mo,so(d.nguong,80),so(d.min_mau,30),nowISO()).run(); }
const KHOA_NCC={ anthropic:'ANTHROPIC_API_KEY', google:'GEMINI_API_KEY', openai:'OPENAI_API_KEY' };
// tên biến khoá của một mô hình: khai riêng (khoa_env) hoặc theo nhà cung cấp; TTS Google dùng GOOGLE_TTS_KEY
const tenKhoa=mh=>mh?(mh.khoa_env||KHOA_NCC[mh.nha_cung_cap]||(mh.loai==='TTS'?'GOOGLE_TTS_KEY':'')):'';
async function docMoHinh(env, id){ return id?await env.DB.prepare(`SELECT * FROM mo_hinh WHERE id=?`).bind(id).first():null; }
// định tuyến: mô hình chính đang BẬT và có khoá → dùng; không thì dự phòng; không có gì → null (goiAI rơi về Anthropic mặc định)
async function chonMoHinh(env, tinh_nang){ const dt=await env.DB.prepare(`SELECT * FROM dinh_tuyen WHERE tinh_nang=?`).bind(tinh_nang).first(); if(!dt) return {dt:null, mh:null, du_phong:null};
  const ok=m=>m&&m.trang_thai==='BAT'&&m.cach_goi==='API'&&!!env[tenKhoa(m)]; const c=await docMoHinh(env, dt.mo_hinh_chinh), d=await docMoHinh(env, dt.mo_hinh_du_phong);
  return { dt, mh: ok(c)?c:(ok(d)?d:null), du_phong: ok(c)&&ok(d)?d:null, thieu_key: c&&c.cach_goi==='API'&&!env[tenKhoa(c)]?tenKhoa(c):null }; }
// gọi một nhà cung cấp — cùng hình dạng trả về {ok, text, vao, ra}
async function goiNhaCungCap(env, mh, {system, messages, max_tokens}){ const key=env[tenKhoa(mh)]; if(!key) return {ok:false, loi:'Chưa cắm '+(tenKhoa(mh)||'khoá')};
  try{
    if(mh.nha_cung_cap==='anthropic'){ const res=await fetch('https://api.anthropic.com/v1/messages',{ method:'POST', headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' }, body: JSON.stringify({ model:mh.model_id, max_tokens, system, messages }) }); const j=await res.json().catch(()=>({})); const u=j.usage||{}; if(!res.ok) return {ok:false, loi:'AI trả lỗi: '+((j.error&&j.error.message)||('HTTP '+res.status)), vao:u.input_tokens, ra:u.output_tokens}; return {ok:true, text:(j.content||[]).map(c=>c.text||'').join(''), vao:u.input_tokens, ra:u.output_tokens}; }
    if(mh.nha_cung_cap==='google'){ const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(mh.model_id)+':generateContent?key='+encodeURIComponent(key),{ method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ system_instruction:{parts:[{text:system||''}]}, contents:messages.map(m=>({role:m.role==='assistant'?'model':'user', parts:[{text:String(m.content||'')}]})), generationConfig:{maxOutputTokens:max_tokens} }) }); const j=await res.json().catch(()=>({})); const u=j.usageMetadata||{}; if(!res.ok) return {ok:false, loi:'AI trả lỗi: '+((j.error&&j.error.message)||('HTTP '+res.status)), vao:u.promptTokenCount, ra:u.candidatesTokenCount}; return {ok:true, text:(((j.candidates||[])[0]||{}).content||{}).parts?.map(p=>p.text||'').join('')||'', vao:u.promptTokenCount, ra:u.candidatesTokenCount}; }
    if(mh.nha_cung_cap==='openai'||mh.nha_cung_cap==='openai_tuong_thich'){ const goc=(mh.nha_cung_cap==='openai_tuong_thich'?String(mh.base_url||'').replace(/\/+$/,''):'https://api.openai.com/v1'); if(!goc) return {ok:false, loi:'Mô hình '+mh.id+' chưa có base_url'}; const res=await fetch(goc+'/chat/completions',{ method:'POST', headers:{ 'content-type':'application/json', authorization:'Bearer '+key }, body: JSON.stringify({ model:mh.model_id, max_tokens, messages:[...(system?[{role:'system',content:system}]:[]), ...messages] }) }); const j=await res.json().catch(()=>({})); const u=j.usage||{}; if(!res.ok) return {ok:false, loi:'AI trả lỗi: '+((j.error&&j.error.message)||('HTTP '+res.status)), vao:u.prompt_tokens, ra:u.completion_tokens}; return {ok:true, text:(((j.choices||[])[0]||{}).message||{}).content||'', vao:u.prompt_tokens, ra:u.completion_tokens}; }
    return {ok:false, loi:'Nhà cung cấp lạ '+mh.nha_cung_cap};
  }catch(e){ return {ok:false, loi:'Không gọi được AI: '+e.message}; } }
const chiPhiMoHinh=(mh, vao, ra)=>mh?((so(vao)*so(mh.gia_vao)+so(ra)*so(mh.gia_ra))/1e6):0;
// kho mẫu: mỗi lượt gọi có định tuyến → một dòng (đầu vào/đầu ra chính); tap KIEM cho ~20% để đánh giá mô hình mở
// ADR-012 — phạm vi của một mẫu: dòng sản phẩm (san_pham.dong của bài/mục) + mục đích (muc_noi_dung.muc_tieu); kho thành phẩm lấy nhãn người nạp
const MUC_DICH=['BAN_HANG','BRAND'];
const tienVN=n=>n>=1e9?((n/1e9).toFixed(2).replace('.',',')+' tỉ đồng'):n>=1e6?((n/1e6).toFixed(1).replace('.',',')+' triệu đồng'):(Math.round(n).toLocaleString('vi-VN')+' đồng');
async function phamViCua(env, doi_tuong, id){ try{
    if(doi_tuong==='noi_dung'&&id){ const r=await env.DB.prepare(`SELECT sp.dong, m.muc_tieu FROM noi_dung n LEFT JOIN muc_noi_dung m ON m.id=n.muc_id LEFT JOIN san_pham sp ON sp.id=COALESCE(n.san_pham_id,m.san_pham_id) WHERE n.id=?`).bind(id).first(); if(r) return { dong:chuoi(r.dong,80)||null, muc_dich:MUC_DICH.includes(r.muc_tieu)?r.muc_tieu:null }; }
    if(doi_tuong==='kho_thanh_pham'&&id){ const r=await env.DB.prepare(`SELECT dong, muc_dich FROM kho_thanh_pham WHERE id=?`).bind(id).first(); if(r) return { dong:r.dong||null, muc_dich:r.muc_dich||null }; }
  }catch(e){} return { dong:null, muc_dich:null }; }
const docPhamVi=(pv)=>{ const t=chuoi(pv,90)||'chung'; if(t.startsWith('dong:')) return {loai:'dong', gia_tri:t.slice(5)}; if(t.startsWith('muc_dich:')) return {loai:'muc_dich', gia_tri:t.slice(9)}; return {loai:'chung', gia_tri:null}; };
const dkPhamVi=(pv)=>{ const p=docPhamVi(pv); return p.loai==='dong'?{sql:' AND dong=?', bind:[p.gia_tri]}:p.loai==='muc_dich'?{sql:' AND muc_dich=?', bind:[p.gia_tri]}:{sql:'', bind:[]}; };
async function ghiMauAI(env, {tinh_nang, mo_hinh_id, doi_tuong=null, doi_tuong_id=null, dau_vao, dau_ra, dau_ra_mo=null, mo_hinh_mo_id=null, giong_mo=null, nhan=null, pham_vi=null}){ const id=uid('ma'); const tap=(parseInt(id.slice(-2),36)%5===0)?'KIEM':'HOC'; const pv=pham_vi||await phamViCua(env, doi_tuong, doi_tuong_id);
  await env.DB.prepare(`INSERT INTO mau_hoc_ai (id,tinh_nang,mo_hinh_id,doi_tuong,doi_tuong_id,dau_vao,dau_ra,dau_ra_mo,mo_hinh_mo_id,giong_mo,nhan,tap,created_at,dong,muc_dich) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, tinh_nang, mo_hinh_id||null, doi_tuong, doi_tuong_id, JSON.stringify(dau_vao||{}).slice(0,8000), dau_ra==null?null:JSON.stringify(dau_ra).slice(0,6000), dau_ra_mo==null?null:JSON.stringify(dau_ra_mo).slice(0,6000), mo_hinh_mo_id, giong_mo, nhan==null?null:JSON.stringify(nhan).slice(0,2000), tap, nowISO(), pv.dong||null, pv.muc_dich||null).run(); return id; }
// gắn mẫu vừa tạo với đối tượng (bài máy vừa soạn) để phán quyết người (duyệt/trả) chảy về kho mẫu
async function ganMauAI(env, tinh_nang, doi_tuong, doi_tuong_id){ const r=await env.DB.prepare(`SELECT id FROM mau_hoc_ai WHERE tinh_nang=? AND doi_tuong_id IS NULL AND created_at>=? ORDER BY created_at DESC LIMIT 1`).bind(tinh_nang, new Date(Date.now()-120000).toISOString()).first(); if(r){ const pv=await phamViCua(env, doi_tuong, doi_tuong_id); await env.DB.prepare(`UPDATE mau_hoc_ai SET doi_tuong=?, doi_tuong_id=?, dong=COALESCE(dong,?), muc_dich=COALESCE(muc_dich,?) WHERE id=?`).bind(doi_tuong, doi_tuong_id, pv.dong, pv.muc_dich, r.id).run(); } return r?r.id:null; }
// tính năng ngôn ngữ được phép MỞ (có bước đi tiếp sau khi máy ghép trả kết quả); còn lại chỉ BÓNG
const MO_NGON_NGU_HO_TRO=['soan_noi_dung','soan_nhap_agent','cham_y_tuong','bao_cao'];
async function goiAI(env, {system, messages, max_tokens=4000, tinh_nang='khac', me=null, ngu_canh=null, epAPI=false}){
  const {dt, mh, du_phong, thieu_key}=await chonMoHinh(env, tinh_nang);
  // ADR-009c: mức MỞ + máy ghép có mô hình đang bật → xếp việc cho máy, trả "chờ máy"; không có máy → đi API như thường (ghi nhận)
  if(!epAPI && dt && dt.muc==='MO' && dt.loai==='NGON_NGU' && dt.mo_hinh_mo && MO_NGON_NGU_HO_TRO.includes(tinh_nang)){ const mayId=await mayChoViec(env,'mo_hinh');
    if(mayId){ const id=uid('av'); await env.DB.prepare(`INSERT INTO ai_viec (id,tinh_nang,mo_hinh_id,may_id,dau_vao,ngu_canh,trang_thai,created_at) VALUES (?,?,?,?,?,?,'CHO',?)`).bind(id, tinh_nang, dt.mo_hinh_mo, mayId, JSON.stringify({system:String(system||''), messages, max_tokens}).slice(0,60000), JSON.stringify(ngu_canh||{loai:'khac'}).slice(0,8000), nowISO()).run();
      await taoLenhTram(env,'mo_hinh_chay',{tinh_nang}, MAY('Máy (bộ não)'), mayId); return {ok:false, cho_may:true, viec_id:id, loi:'Mô hình mở trên máy ghép đang xử lý — kết quả về trong vài phút'}; } }
  // chưa có định tuyến (tính năng lạ) → Anthropic mặc định như trước
  const macDinh=!mh?(env.ANTHROPIC_API_KEY?{id:null, nha_cung_cap:'anthropic', model_id:env.ANTHROPIC_MODEL||AI_MODEL_MAC_DINH, gia_vao:null}:null):null;
  const m1=mh||macDinh; if(!m1) return {ok:false, thieu_key:true, loi:'Chưa cắm '+(thieu_key||'ANTHROPIC_API_KEY')+(dt?(' cho mô hình của tính năng '+tinh_nang):'')};
  const ns=await kiemNganSachAI(env,{hoc:/^hoc_/.test(tinh_nang)}); if(!ns.ok) return ns;
  const cfg=(await docCauHinh(env)).ai||{}; const muc=dt?dt.muc:'API';
  const chay=async(m)=>{ const t0=Date.now(); const r=await goiNhaCungCap(env, m, {system, messages, max_tokens}); const chi=m.gia_vao==null?tinhChiPhiAI(cfg,m.model_id,r.vao,r.ra):chiPhiMoHinh(m,r.vao,r.ra);
    await ghiAIUsage(env,{provider:m.nha_cung_cap, model:m.model_id, tinh_nang, me, tokens_vao:r.vao, tokens_ra:r.ra, ok:r.ok, ms:Date.now()-t0, loi:r.ok?null:r.loi, chi_phi_usd:chi, mo_hinh_id:m.id, muc}); return {...r, model:m.model_id, mo_hinh_id:m.id}; };
  let r=await chay(m1); if(!r.ok && du_phong){ const r2=await chay(du_phong); if(r2.ok) r={...r2, du_phong:true, loi_chinh:r.loi}; }
  if(!r.ok) return {ok:false, loi:r.loi};
  if(epAPI) r.ep_api=true;
  // kho mẫu + bóng: có định tuyến → lưu mẫu; mức BÓNG/MỞ với mô hình mở → xếp lệnh cho máy ghép chạy song song
  if(dt){ const mauId=await ghiMauAI(env,{tinh_nang, mo_hinh_id:r.mo_hinh_id, dau_vao:{system:String(system||'').slice(0,3000), user:messages.map(x=>String(x.content||'')).join('\n').slice(0,4000)}, dau_ra:r.text.slice(0,6000)});
    if(['BONG','MO'].includes(dt.muc)&&dt.mo_hinh_mo){ const mayId=await mayChoViec(env,'mo_hinh'); if(mayId) await taoLenhTram(env,'mo_hinh_bong',{tinh_nang}, MAY('Máy (bộ não)'), mayId); } r.mau_id=mauId; }
  return {ok:true, text:r.text, usage:{input_tokens:r.vao, output_tokens:r.ra}, model:r.model, mo_hinh_id:r.mo_hinh_id, du_phong:!!r.du_phong, mau_id:r.mau_id};
}
// ADR-009c — đi tiếp sau khi mô hình mở trả kết quả (hoặc API dự phòng khi máy trễ)
function docJSONAI(text){ try{ const t=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,''); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}')+1)); }catch(e){ return null; } }
async function xuLyAIViec(env, v, {nguon='MO'}={}){ if(uBool(v.xu_ly)) return {ok:true, bo_qua:'đã xử lý'}; const nc=docJSON(v.ngu_canh,{}); const claims=await docClaims(env); let kq={ok:true};
  try{
    if(nc.loai==='ai_viet'||nc.loai==='soan_nhap'){ const d=duyetVanBanAI(v.dau_ra, nc.cacBuoc||[], claims, nc.dd); if(!d.ok) kq={ok:false, loi:d.loi};
      else if(nc.loai==='soan_nhap'){ const cu=await env.DB.prepare(`SELECT id FROM noi_dung WHERE muc_id=?`).bind(nc.muc_id).first(); if(cu) kq={ok:true, ghi_chu:'mục đã có nội dung'};
        else { const t=await taoNoiDung(env,{...d.noi_dung, muc_id:nc.muc_id, ly_do_may:'Mô hình mở soạn ('+(nguon==='MO'?'máy ghép':'API dự phòng')+')'}, MAY('Máy (B4)')); if(!t.ok) kq={ok:false, loi:t.loi}; else { await ganMauAI(env, v.tinh_nang, 'noi_dung', t.id); kq={ok:true, noi_dung_id:t.id}; const b4=await mucBuoc(env,'B4'); if(b4.nguoi_thuc_hien==='AI_TU_LAM'){ const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(t.id).first(); await guiDuyet(env, nd, MAY('Máy (B4)')); } } } }
      else kq={ok:true, noi_dung:d.noi_dung, canh_bao:d.canh_bao}; }
    else if(nc.loai==='cham_y_tuong'){ const o=docJSONAI(v.dau_ra); if(!o) kq={ok:false, loi:'JSON AI hỏng'}; else { const pillars=(await env.DB.prepare(`SELECT id FROM pillars WHERE active=1`).all()).results; const ch={ diem:Math.max(0,Math.min(100,Math.round(so(o.diem)))), pillar_id:pillars.some(p=>p.id===o.pillar_id)?o.pillar_id:null, dinh_dang:dinhDang(o.dinh_dang), muc_tieu:mucTieu(o.muc_tieu), rui_ro:o.rui_ro_claim===true?'claim':'', ly_do:chuoi(o.ly_do,400) };
      await env.DB.prepare(`UPDATE y_tuong SET diem_may=?, ly_do_may=?, rui_ro=?, pillar_id=COALESCE(pillar_id,?), dinh_dang=COALESCE(dinh_dang,?), muc_tieu=COALESCE(muc_tieu,?) WHERE id=? AND diem_may IS NULL`).bind(ch.diem, ch.ly_do, ch.rui_ro, ch.pillar_id, ch.dinh_dang, ch.muc_tieu, nc.y_tuong_id).run(); kq={ok:true, cham:ch}; } }
    else if(nc.loai==='bao_cao'){ const o=docJSONAI(v.dau_ra); if(!o||!o.nhan_dinh) kq={ok:false, loi:'JSON AI hỏng'}; else { const nd=chuoi(o.nhan_dinh,3000); const vc=(Array.isArray(o.viec_can_lam)?o.viec_can_lam:[]).map(x=>chuoi(x,200)).filter(Boolean).slice(0,3);
      await env.DB.prepare(`UPDATE bao_cao SET nhan_dinh=CASE WHEN trang_thai='NHAP' THEN ? ELSE nhan_dinh END, nhan_dinh_may=?, viec_can_lam=CASE WHEN trang_thai='NHAP' THEN ? ELSE viec_can_lam END, tao_boi=? WHERE id=?`).bind(nd, nd, JSON.stringify(vc), nguon==='MO'?'Máy (AI mở)':'Máy (AI)', nc.bao_cao_id).run(); kq={ok:true}; } }
  }catch(e){ kq={ok:false, loi:'xử lý: '+e.message}; }
  await env.DB.prepare(`UPDATE ai_viec SET xu_ly=1, ket_qua=?, loi=COALESCE(?,loi) WHERE id=?`).bind(JSON.stringify(kq).slice(0,20000), kq.ok?null:chuoi(kq.loi,300), v.id).run(); return kq; }
// máy trễ → API dự phòng làm thay (cùng đầu vào), ghi mẫu "mở trễ" để điểm mở hạ
async function chayLaiAPI(env, v){ const dv=docJSON(v.dau_vao,{}); const r=await goiAI(env,{system:dv.system, messages:dv.messages||[], max_tokens:so(dv.max_tokens,2000)||2000, tinh_nang:v.tinh_nang, epAPI:true}); if(!r.ok) return r;
  await env.DB.prepare(`UPDATE ai_viec SET trang_thai='HET_HAN', dau_ra=?, loi=COALESCE(loi,'máy ghép trễ — API dự phòng làm thay'), xong_at=? WHERE id=?`).bind(r.text, nowISO(), v.id).run(); if(r.mau_id) await env.DB.prepare(`UPDATE mau_hoc_ai SET dau_ra_mo=?, mo_hinh_mo_id=?, giong_mo=0 WHERE id=?`).bind('"(mở trễ)"', v.mo_hinh_id, r.mau_id).run();
  return xuLyAIViec(env, {...v, dau_ra:r.text}, {nguon:'API'}); }
async function tietKiemMo(env, thang){ const rows=(await env.DB.prepare(`SELECT u.tinh_nang, SUM(u.tokens_vao) vao, SUM(u.tokens_ra) ra, COUNT(*) n FROM ai_usage u WHERE u.thang=? AND u.muc='MO' AND u.provider='may_ghep' AND u.ok=1 GROUP BY u.tinh_nang`).bind(thang).all()).results; let usd=0, luot=0; const ct=[];
  for(const r of rows){ const dt=await env.DB.prepare(`SELECT mo_hinh_chinh FROM dinh_tuyen WHERE tinh_nang=?`).bind(r.tinh_nang).first(); const mh=dt?await docMoHinh(env, dt.mo_hinh_chinh):null; const u=mh?chiPhiMoHinh(mh, r.vao, r.ra):0; usd+=u; luot+=so(r.n); ct.push({tinh_nang:r.tinh_nang, luot:so(r.n), usd_tuong_duong:+u.toFixed(4), theo:mh?mh.ten:'—'}); }
  return {usd:+usd.toFixed(4), luot, chi_tiet:ct}; }
// máy ghép đang bật có khả năng X (mo_hinh | huan_luyen | dung_video) → id, không có → null
// 24/09: máy mạnh trước cho việc mô hình/huấn luyện (VRAM lớn nhất, có Ollama); việc dựng giữ thứ tự cũ. Máy Q2 (3070 Ti 8 GB) > Ngoc-Han (1650 4 GB).
const sucMay=m=>(((m.than||{}).ollama)?1e6:0)+vramMay(m);
const vramMay=m=>{ const g=String((m.than||{}).gpu||''); const x=g.match(/(\d{3,6})\s*MiB/i); return x?+x[1]:0; };
async function mayManhNhat(env, khaNang){ const ds=(await mayGhepSong(env)).filter(x=>x.kha_nang.includes(khaNang)); if(!ds.length) return null; return ds.slice().sort((a,b)=>((b.song?1:0)-(a.song?1:0))||(sucMay(b)-sucMay(a)))[0].id; }
async function mayChoViec(env, khaNang, {cungMay=null}={}){ let ds=(await mayGhepSong(env)).filter(x=>x.song&&x.kha_nang.includes(khaNang)); if(!ds.length) return null;
  if(cungMay){ const c=ds.find(x=>String((x.than||{}).may||'').toLowerCase()===String(cungMay).toLowerCase()); if(c) return c.id; }
  ds=ds.slice().sort((a,b)=>sucMay(b)-sucMay(a));
  return ds[0].id; }
// điểm & đề nghị định tuyến: NGON_NGU BÓNG = giống trung bình mở↔chính (×100); NHIN = % mẫu người chấm mà mô hình mở chọn đúng; đủ ngưỡng & mẫu (& có phiên bản duyệt với NHIN) → đề nghị LÊN, việc cho Trưởng MKT
async function tinhDinhTuyen(env){ const ds=(await env.DB.prepare(`SELECT * FROM dinh_tuyen`).all()).results; const kq=[]; let len=0;
  for(const d of ds){ let diem=0, soMau=0;
    if(d.tinh_nang==='loc_footage'){ const r=await env.DB.prepare(`SELECT COUNT(*) n, AVG(giong_mo) g FROM mau_hoc_ai WHERE tinh_nang=? AND phan_quyet IS NOT NULL`).bind(d.tinh_nang).first(); soMau=so(r&&r.n); diem=Math.round(so(r&&r.g)*100); }
    else if(d.loai==='NHIN'){ const r=await env.DB.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN dau_ra_mo IS NOT NULL AND json_extract(dau_ra_mo,'$.tai_san_id')=json_extract(nhan,'$.tai_san_id') THEN 1 ELSE 0 END) dung, SUM(CASE WHEN dau_ra_mo IS NOT NULL THEN 1 ELSE 0 END) co_mo FROM mau_hoc_ai WHERE tinh_nang=? AND nhan IS NOT NULL`).bind(d.tinh_nang).first(); soMau=so(r&&r.n); diem=so(r&&r.co_mo)?Math.round(so(r.dung)/so(r.co_mo)*100):0; }
    else { const r=await env.DB.prepare(`SELECT COUNT(*) n, AVG(giong_mo) g FROM mau_hoc_ai WHERE tinh_nang=? AND giong_mo IS NOT NULL`).bind(d.tinh_nang).first(); soMau=so(r&&r.n); diem=Math.round(so(r&&r.g)*100); }
    const mo=await docMoHinh(env, d.mo_hinh_mo); const coPhienBan=!!(mo&&mo.phien_ban); const duocMo=d.loai!=='NGON_NGU'||MO_NGON_NGU_HO_TRO.includes(d.tinh_nang);
    let deNghi=null, lyDo=null; if(d.muc!=='MO' && d.mo_hinh_mo && soMau>=so(d.min_mau,30) && diem>=so(d.nguong,80) && (d.loai!=='NHIN'||coPhienBan)){ if(d.muc==='API'){ deNghi='LEN'; lyDo='Mô hình mở khớp '+diem+'/100 trên '+soMau+' mẫu — bật BÓNG để theo dõi'; } else if(duocMo){ deNghi='LEN'; lyDo='Bóng khớp '+diem+'/100 trên '+soMau+' mẫu, có phiên bản đã duyệt — có thể gạt MỞ (tiết kiệm API)'; } }
    else if(d.muc==='MO' && soMau>=so(d.min_mau,30) && diem<Math.max(0,so(d.nguong,80)-20)){ deNghi='XUONG'; lyDo='Mô hình mở chỉ khớp '+diem+'/100 gần đây — nên hạ về BÓNG'; }
    await env.DB.prepare(`UPDATE dinh_tuyen SET diem=?, so_mau=?, de_nghi=?, de_nghi_ly_do=? WHERE tinh_nang=?`).bind(diem, soMau, deNghi, lyDo, d.tinh_nang).run(); if(mo && soMau>0) await env.DB.prepare(`UPDATE mo_hinh SET diem=?, so_mau=? WHERE id=?`).bind(diem, soMau, mo.id).run();   // một mô hình mở có thể phục vụ nhiều tính năng — chỉ tính năng có mẫu mới cập nhật điểm
    const key='dinh_tuyen:'+d.tinh_nang+':'+(deNghi||'');
    if(deNghi){ const cu=await env.DB.prepare(`SELECT id FROM cong_viec WHERE loai='GAT_DINH_TUYEN' AND doi_tuong_id=? AND trang_thai='MO'`).bind(key).first(); if(!cu){ await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'GAT_DINH_TUYEN',(deNghi==='LEN'?'Nâng mức AI: ':'Hạ mức AI: ')+d.ten,'dinh_tuyen',key,'TRUONG_MKT',ngayVN(Date.now()+3*864e5),'Máy (bộ não)',lyDo+' — Máy › Bộ não AI › Định tuyến',nowISO()).run(); len++; } }
    else await env.DB.prepare(`UPDATE cong_viec SET trang_thai='BO', xong_at=?, xong_boi='Máy' WHERE loai='GAT_DINH_TUYEN' AND doi_tuong_id LIKE ? AND trang_thai='MO'`).bind(nowISO(),'dinh_tuyen:'+d.tinh_nang+':%').run();
    kq.push({tinh_nang:d.tinh_nang, diem, so_mau:soMau, de_nghi:deNghi}); }
  return {kq, len}; }

// ============================================================
//  BỘ QUYỀN: đọc mức bước, gạt mức
// ============================================================
async function docBuoc(env){
  const rows=(await env.DB.prepare(`SELECT * FROM buoc_thuc_hien`).all()).results; const m={}; rows.forEach(r=>m[r.buoc]=r);
  return BUOC.map(b=>({ ...b, ...(m[b.ma]||{}), hoc: m[b.ma]?uBool(m[b.ma].hoc):true, nguoi_thuc_hien:(m[b.ma]||{}).nguoi_thuc_hien||'NGUOI', vai_tro_nguoi:(m[b.ma]||{}).vai_tro_nguoi||b.vai_tro }));
}
async function mucBuoc(env, ma){ const r=await env.DB.prepare(`SELECT * FROM buoc_thuc_hien WHERE buoc=?`).bind(ma).first(); return r||{buoc:ma, nguoi_thuc_hien:'NGUOI', hoc:1}; }
// Trả {ok} hoặc {ok:false, loi} — luật gạt (bản vẽ §3b)
async function kiemGat(env, ma, muc, cfgMay){
  const meta=BUOC_MAP[ma]; if(!meta) return {ok:false, loi:'Không có bước '+ma};
  if(!MUC.includes(muc)) return {ok:false, loi:'Mức không hợp lệ'};
  if(MUC.indexOf(muc)>MUC.indexOf(meta.muc_toi_da)) return {ok:false, loi:'Bước "'+meta.ten+'" tối đa chỉ tới '+meta.muc_toi_da+(meta.cong?(' (cổng '+meta.cong+' luôn là người)'):'')};
  if(muc==='AI_TU_LAM'){ const r=await mucBuoc(env, ma); const nguong=so(cfgMay.nguong_san_sang,80), minMau=so(cfgMay.min_mau,30);
    if(so(r.san_sang)<nguong || so(r.so_mau)<minMau) return {ok:false, loi:'Máy chưa đủ sẵn sàng cho "'+meta.ten+'": '+so(r.san_sang)+'/'+nguong+' điểm · '+so(r.so_mau)+'/'+minMau+' mẫu'}; }
  return {ok:true};
}
// Điểm sẵn sàng = trung bình "giống" của 60 mẫu gần nhất (0..100); so_mau = tổng mẫu; ADR-006: thêm điểm N ngày gần nhất
async function tinhSanSang(env, ma){
  const cfg=(await docCauHinh(env)).may||{}; const tuGan=new Date(Date.now()-Math.max(1,so(cfg.ngay_gan,14))*864e5).toISOString();
  const rows=(await env.DB.prepare(`SELECT giong, created_at FROM mau_hoc WHERE buoc=? AND giong IS NOT NULL ORDER BY created_at DESC LIMIT 60`).bind(ma).all()).results;
  const tong=(await env.DB.prepare(`SELECT COUNT(*) n FROM mau_hoc WHERE buoc=? AND giong IS NOT NULL`).bind(ma).first())||{n:0};
  const tb=a=>a.length?Math.round(a.reduce((s,r)=>s+Math.max(0,Math.min(1,so(r.giong))),0)/a.length*100):0;
  const gan=rows.filter(r=>r.created_at>=tuGan); const ss=tb(rows), ssGan=tb(gan);
  await env.DB.prepare(`UPDATE buoc_thuc_hien SET san_sang=?, so_mau=?, san_sang_gan=?, so_mau_gan=? WHERE buoc=?`).bind(ss, so(tong.n), ssGan, gan.length, ma).run();
  return {buoc:ma, san_sang:ss, so_mau:so(tong.n), san_sang_gan:ssGan, so_mau_gan:gan.length};
}
// ADR-006 — MÁY ĐỀ NGHỊ gạt (không tự gạt). LÊN: đang NGƯỜI/AI_GOI_Y, đủ ngưỡng & mẫu, chưa ở mức tối đa. XUỐNG: đang mức AI mà điểm gần đây
// < nguong_ha trên ≥ mau_ha mẫu. Mỗi đề nghị = một việc giao TRUONG_MKT (gộp trùng theo bước + hướng + mức hiện tại).
const MUC_KE=(muc, toiDa)=>{ const i=MUC.indexOf(muc); return i<MUC.indexOf(toiDa)?MUC[i+1]:null; };
async function deNghiGat(env){
  const cfg=(await docCauHinh(env)).may||{}; const nguong=so(cfg.nguong_san_sang,80), minMau=so(cfg.min_mau,30), nguongHa=so(cfg.nguong_ha,60), mauHa=so(cfg.mau_ha,5);
  const ds=await docBuoc(env); let len=0, xuong=0, huy=0;
  for(const b of ds){
    const ke=MUC_KE(b.nguoi_thuc_hien, b.muc_toi_da); let dn=null, ly='';
    // AI_GOI_Y → AI_TU_LAM còn đòi điểm gần đây đủ (nếu có mẫu gần đây) — không có bằng chứng ngược thì theo điểm tổng
    if(ke && so(b.san_sang)>=nguong && so(b.so_mau)>=minMau && (b.nguoi_thuc_hien==='NGUOI' || !so(b.so_mau_gan) || so(b.san_sang_gan)>=nguong)){ dn='LEN'; ly='Sẵn sàng '+b.san_sang+'/'+nguong+' trên '+b.so_mau+' mẫu — đủ để gạt sang '+ke; }
    else if(b.nguoi_thuc_hien!=='NGUOI' && so(b.so_mau_gan)>=mauHa && so(b.san_sang_gan)<nguongHa){ dn='XUONG'; ly='Điểm '+so(cfg.ngay_gan,14)+' ngày gần nhất chỉ '+b.san_sang_gan+'/100 ('+b.so_mau_gan+' mẫu) — người đang sửa/trả nhiều, nên hạ về '+MUC[Math.max(0,MUC.indexOf(b.nguoi_thuc_hien)-1)]; }
    const khoa='buoc:'+b.ma+':'+(dn||'')+':'+b.nguoi_thuc_hien;
    if(dn){ await env.DB.prepare(`UPDATE buoc_thuc_hien SET de_nghi=?, de_nghi_ly_do=?, de_nghi_at=COALESCE(de_nghi_at,?) WHERE buoc=?`).bind(dn, ly, nowISO(), b.ma).run();
      const co=await env.DB.prepare(`SELECT id FROM cong_viec WHERE loai='GAT_BUOC' AND doi_tuong_id=? AND trang_thai='MO'`).bind(khoa).first();
      if(!co){ await env.DB.prepare(`UPDATE cong_viec SET trang_thai='BO', xong_at=?, xong_boi='Máy' WHERE loai='GAT_BUOC' AND doi_tuong='buoc' AND doi_tuong_id LIKE ? AND trang_thai='MO'`).bind(nowISO(), 'buoc:'+b.ma+':%').run();
        await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'GAT_BUOC',(dn==='LEN'?'⬆ Gạt bước '+b.ma+' ('+b.ten+') sang '+ke:'⬇ Hạ bước '+b.ma+' ('+b.ten+') về mức thấp hơn'),'buoc',khoa,'TRUONG_MKT',null,'Máy (điều phối)',ly+'. Vào Máy › Bước để gạt — máy không tự gạt.',nowISO()).run(); dn==='LEN'?len++:xuong++; } }
    else if(b.de_nghi){ await env.DB.prepare(`UPDATE buoc_thuc_hien SET de_nghi=NULL, de_nghi_ly_do=NULL, de_nghi_at=NULL WHERE buoc=?`).bind(b.ma).run(); const r=await env.DB.prepare(`UPDATE cong_viec SET trang_thai='BO', xong_at=?, xong_boi='Máy' WHERE loai='GAT_BUOC' AND doi_tuong_id LIKE ? AND trang_thai='MO'`).bind(nowISO(),'buoc:'+b.ma+':%').run(); if(r.meta&&r.meta.changes) huy++; }
  }
  return {len, xuong, huy};
}

// ============================================================
//  ADR-002 — CHIẾN LƯỢC (G1) · KẾ HOẠCH THÁNG (G2) · TUẦN & MỤC · Ý TƯỞNG/TREND (B1)
// ============================================================
const MUC_TIEU=['BRAND','BAN_HANG']; const mucTieu=v=>MUC_TIEU.includes(String(v||'').toUpperCase())?String(v).toUpperCase():'BRAND';
const DINH_DANG=['VIDEO','POST','ANH','CAROUSEL']; const dinhDang=v=>DINH_DANG.includes(String(v||'').toUpperCase())?String(v).toUpperCase():null;
const GIAI_DOAN=['Y_TUONG','SOAN','CHO_DUYET','SAN_XUAT','DA_DANG','DA_DO'];
const laThang=s=>/^\d{4}-\d{2}$/.test(s||''); const laNgay=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'');
const thangSau=(ym,k=1)=>{ const [y,m]=ym.split('-').map(Number); const d=new Date(Date.UTC(y,m-1+k,1)); return d.toISOString().slice(0,7); };
// tuần trong tháng: tuần 1 từ ngày 1 tới CN đầu tiên, sau đó T2–CN, tối đa 6
function tuanCuaNgay(ymd){ if(!laNgay(ymd)) return null; const d=new Date(ymd+'T00:00:00Z'); const lechT2=(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).getUTCDay()+6)%7; return Math.min(6, Math.floor((d.getUTCDate()-1+lechT2)/7)+1); }
function soTuanThang(ym){ const [y,m]=ym.split('-').map(Number); const cuoi=new Date(Date.UTC(y,m,0)).getUTCDate(); return tuanCuaNgay(ym+'-'+String(cuoi).padStart(2,'0'))||4; }
const tuanCuaMuc=m=>(m.tuan!=null?Number(m.tuan):tuanCuaNgay(m.ngay_dang))||null;
function lamSachChiTieu(o){
  const so0=x=>Math.max(0,Math.round(so(x))); const map=m=>{ const r={}; Object.entries((m&&typeof m==='object')?m:{}).slice(0,60).forEach(([k,v])=>{ if(String(k).trim()) r[String(k).trim().slice(0,40)]=so0(v); }); return r; };
  o=(o&&typeof o==='object')?o:{};
  return { tong_bai:so0(o.tong_bai), theo_pillar:map(o.theo_pillar), theo_dinh_dang:map(o.theo_dinh_dang), theo_kenh:map(o.theo_kenh), theo_muc_tieu:map(o.theo_muc_tieu),
    // KPI kết quả mong muốn của tháng — brand đo tiếp cận/xem/chia sẻ, bán hàng đo đơn (Thiện 2026-09-23)
    ket_qua:{ tiep_can:so0((o.ket_qua||{}).tiep_can), luot_xem:so0((o.ket_qua||{}).luot_xem), chia_se:so0((o.ket_qua||{}).chia_se), tuong_tac:so0((o.ket_qua||{}).tuong_tac), so_don:so0((o.ket_qua||{}).so_don) },
    // ADR-007: chỉ tiêu bài seeding hội nhóm mỗi tuần (gói ĐỊNH KỲ) — 0 = dùng mặc định cấu hình seeding
    seeding_tuan:so0(o.seeding_tuan) };
}
const docKeHoach=r=>r&&({ ...r, chi_tieu:lamSachChiTieu(docJSON(r.chi_tieu,{})), ly_do:docJSON(r.ly_do,{}), de_xuat:r.de_xuat?lamSachChiTieu(docJSON(r.de_xuat,{})):null });
// Đề xuất chỉ tiêu tháng từ chiến lược + thực tế tháng trước. Thuần dữ liệu, mọi số kèm lý do.
async function deXuatKeHoach(env, thang, tongMuon){
  const cfg=(await docCauHinh(env)).ke_hoach||{};
  const pillars=(await env.DB.prepare(`SELECT * FROM pillars WHERE active=1 ORDER BY thu_tu`).all()).results;
  const kenhs=(await env.DB.prepare(`SELECT id,ten FROM kenh WHERE active=1`).all()).results;
  const truoc=thangSau(thang,-1); const cu=(await env.DB.prepare(`SELECT * FROM muc_noi_dung WHERE thang=?`).bind(truoc).all()).results;
  const khTruoc=docKeHoach(await env.DB.prepare(`SELECT * FROM ke_hoach_thang WHERE thang=?`).bind(truoc).first());
  const tong=Math.max(1, Math.round(so(tongMuon) || (khTruoc&&khTruoc.trang_thai==='CHOT'&&khTruoc.chi_tieu.tong_bai) || cu.length || so(cfg.tong_bai_mac_dinh,20)));
  const ly_do={ tong_bai: so(tongMuon)?'Tổng do người nhập':(khTruoc&&khTruoc.trang_thai==='CHOT'&&khTruoc.chi_tieu.tong_bai)?('Bằng chỉ tiêu đã chốt tháng '+truoc):cu.length?('Bằng số mục thực tế tháng '+truoc):('Mặc định '+so(cfg.tong_bai_mac_dinh,20)+' bài (chưa có tháng trước)') };
  const theo_pillar={}; let cong=0, maxP=null; const tongTT=pillars.reduce((s,p)=>s+so(p.ty_trong),0)||1;
  pillars.forEach(p=>{ const n=Math.round(tong*so(p.ty_trong)/tongTT); theo_pillar[p.id]=n; cong+=n; if(!maxP||so(p.ty_trong)>so(maxP.ty_trong)) maxP=p; });
  if(maxP) theo_pillar[maxP.id]+=tong-cong; ly_do.theo_pillar='Chia theo tỷ trọng pillar trong chiến lược'+(tongTT!==100?(' (tổng tỷ trọng '+tongTT+'%, đã quy về 100)'):'')+'; số dư dồn vào pillar lớn nhất';
  const chia=(keys,dem,ten)=>{ const r={}; const td=keys.reduce((s,k)=>s+(dem[k]||0),0); let c=0; keys.forEach(k=>{ const n=td?Math.round(tong*(dem[k]||0)/td):Math.round(tong/keys.length); r[k]=n; c+=n; }); if(keys.length) r[keys[0]]+=tong-c; ly_do[ten]=td?('Theo cơ cấu thực tế tháng '+truoc):'Chia đều (chưa có dữ liệu tháng trước)'; return r; };
  const dem=f=>{ const r={}; cu.forEach(m=>{ const k=f(m); if(k) r[k]=(r[k]||0)+1; }); return r; };
  const theo_dinh_dang=chia(DINH_DANG, dem(m=>m.dinh_dang), 'theo_dinh_dang');
  const theo_kenh=chia(kenhs.map(k=>k.id), dem(m=>m.kenh_id), 'theo_kenh');
  const theo_muc_tieu={BRAND:0,BAN_HANG:0}; pillars.forEach(p=>{ theo_muc_tieu[mucTieu(p.muc_tieu)]+=theo_pillar[p.id]||0; }); ly_do.theo_muc_tieu='Cộng chỉ tiêu các pillar theo mục tiêu (BRAND / BÁN HÀNG) khai trong Pillar';
  // KPI kết quả: đợt 4 mới có số đo thật → đề xuất bằng chỉ tiêu tháng trước nếu có, không thì 0 (không bịa)
  const ket_qua=(khTruoc&&khTruoc.chi_tieu.ket_qua)||{}; ly_do.ket_qua=khTruoc?('Giữ KPI kết quả tháng '+truoc+' — sẽ tự đề xuất từ số đo thật khi có đo lường (đợt 4)'):'Chưa có số đo thật → để 0, người tự đặt';
  const seeding_tuan=(khTruoc&&khTruoc.chi_tieu.seeding_tuan)||0; if(seeding_tuan) ly_do.seeding_tuan='Giữ nhịp seeding tháng '+truoc;
  return { chi_tieu:lamSachChiTieu({tong_bai:tong, theo_pillar, theo_dinh_dang, theo_kenh, theo_muc_tieu, ket_qua, seeding_tuan}), ly_do, tu_thang:truoc };
}
async function thieuTheoTuan(env, thang){
  const kh=docKeHoach(await env.DB.prepare(`SELECT * FROM ke_hoach_thang WHERE thang=?`).bind(thang).first()); if(!kh) return null;
  const soTuan=soTuanThang(thang); const muc=(await env.DB.prepare(`SELECT * FROM muc_noi_dung WHERE thang=?`).bind(thang).all()).results;
  const pillars=(await env.DB.prepare(`SELECT * FROM pillars WHERE active=1 ORDER BY thu_tu`).all()).results;
  // chia chỉ tiêu tháng xuống tuần: chia đều, phần dư dồn các tuần đầu → tổng các tuần = đúng chỉ tiêu tháng (không phình vì làm tròn)
  const chia=(tong)=>{ const n=Math.max(0,Math.round(so(tong))); const c=Math.floor(n/soTuan), du=n%soTuan; return Array.from({length:soTuan},(_,i)=>c+(i<du?1:0)); };
  const tongTuan=chia(kh.chi_tieu.tong_bai); const pTuan={}; pillars.forEach(p=>pTuan[p.id]=chia(kh.chi_tieu.theo_pillar[p.id])); const dTuan={}; DINH_DANG.forEach(dd=>dTuan[dd]=chia(kh.chi_tieu.theo_dinh_dang[dd]));
  const ra=[];
  for(let t=1;t<=soTuan;t++){ const items=muc.filter(m=>tuanCuaMuc(m)===t); const thieu=[];
    pillars.forEach(p=>{ const ct=pTuan[p.id][t-1]; const co=items.filter(m=>m.pillar_id===p.id).length; if(ct>co) thieu.push({loai:'pillar', id:p.id, ten:p.ten, thieu:ct-co}); });
    DINH_DANG.forEach(dd=>{ const ct=dTuan[dd][t-1]; const co=items.filter(m=>m.dinh_dang===dd).length; if(ct>co) thieu.push({loai:'dinh_dang', id:dd, ten:dd, thieu:ct-co}); });
    ra.push({ tuan:t, co:items.length, chi_tieu:tongTuan[t-1], thieu }); }
  return { thang, so_tuan:soTuan, tuan:ra, ke_hoach:kh };
}
// Máy tạo mục còn thiếu (B3): ghép pillar thiếu × định dạng thiếu theo tuần, kênh xoay vòng theo chỉ tiêu kênh. Idempotent: chỉ tạo phần thiếu.
async function taoMucConThieu(env, thang, tacNhan){
  const th=await thieuTheoTuan(env, thang); if(!th) return {ok:false, loi:'Tháng '+thang+' chưa có kế hoạch'};
  const pillars=(await env.DB.prepare(`SELECT * FROM pillars WHERE active=1 ORDER BY thu_tu`).all()).results;
  const kenhCT=Object.entries(th.ke_hoach.chi_tieu.theo_kenh).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).map(([id])=>id);
  const kenhAll=(await env.DB.prepare(`SELECT id FROM kenh WHERE active=1`).all()).results.map(k=>k.id);
  const vongKenh=kenhCT.length?kenhCT:kenhAll; let ki=0, tao=0; const ds=[];
  for(const t of th.tuan){
    const pThieu=t.thieu.filter(x=>x.loai==='pillar').flatMap(x=>Array(x.thieu).fill(x.id));
    const dThieu=t.thieu.filter(x=>x.loai==='dinh_dang').flatMap(x=>Array(x.thieu).fill(x.id));
    const n=Math.max(pThieu.length, dThieu.length);
    for(let i=0;i<n;i++){ const pid=pThieu[i]||pThieu[i%Math.max(1,pThieu.length)]||(pillars[0]||{}).id||null; const dd=dThieu[i]||dThieu[i%Math.max(1,dThieu.length)]||'POST';
      const p=pillars.find(x=>x.id===pid)||{}; const id=uid('muc'); const kenh=vongKenh.length?vongKenh[ki++%vongKenh.length]:null;
      await env.DB.prepare(`INSERT INTO muc_noi_dung (id,thang,tuan,tieu_de,muc_tieu,pillar_id,kenh_id,dinh_dang,giai_doan,tao_boi,ghi_chu,created_at,created_by_name,updated_at) VALUES (?,?,?,?,?,?,?,?,'Y_TUONG','AGENT',?,?,?,?)`)
        .bind(id, thang, t.tuan, '['+(p.ten||'?')+' · '+dd+'] tuần '+t.tuan+' — đặt tiêu đề', mucTieu(p.muc_tieu), pid, kenh, dd, 'Máy tạo vì tuần '+t.tuan+' thiếu '+(p.ten||'')+' / '+dd+' so với kế hoạch tháng', nowISO(), tacNhan, nowISO()).run();
      ds.push(id); tao++; }
  }
  return {ok:true, tao, ids:ds};
}
// ----- Ý tưởng / trend -----
const chuanHoaTen=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
const THAM_SO_THEO_DOI=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','igshid','is_from_webapp','sender_device','_r','_t','share_app_id','share_link_id'];
function chuanHoaLink(s){ const raw=String(s||'').trim(); if(!raw) return ''; try{ const u=new URL(raw); u.hash=''; THAM_SO_THEO_DOI.forEach(k=>u.searchParams.delete(k)); const q=u.searchParams.toString(); return (u.host.replace(/^www\./,'')+u.pathname.replace(/\/+$/,'')+(q?'?'+q:'')).toLowerCase(); }catch(e){ return raw.toLowerCase(); } }
function khopTuKhoa(text, tuKhoa){ const ds=(tuKhoa||[]).map(chuanHoaTen).filter(Boolean); if(!ds.length) return true; const t=chuanHoaTen(text); return ds.some(k=>t.includes(k)); }
function docRSS(xml){ const ra=[]; const items=String(xml||'').split(/<item[\s>]/i).slice(1);
  const lay=(s,tag)=>{ const m=s.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i')); if(!m) return ''; return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); };
  for(const it of items){ const ten=lay(it,'title'); if(!ten) continue; ra.push({ ten, nguon:'GOOGLE_TRENDS', link:lay(it,'link'), mo_ta:[lay(it,'ht:news_item_title'), lay(it,'description')].filter(Boolean).join(' — ').slice(0,500) }); }
  return ra; }
async function layGoogleTrends(){ const r=await fetch('https://trends.google.com/trending/rss?geo=VN',{headers:{'user-agent':'KingsmenContentOS/2.0'}}); if(!r.ok) throw new Error('Google Trends trả về '+r.status); return docRSS(await r.text()); }
async function layYouTubeVN(env){ const key=env.YOUTUBE_API_KEY; if(!key) return {bo_qua:'Chưa cắm YOUTUBE_API_KEY', ds:[]};
  const r=await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=VN&maxResults=25&key='+encodeURIComponent(key)); if(!r.ok) throw new Error('YouTube API trả về '+r.status);
  const j=await r.json(); return { ds:(j.items||[]).filter(v=>v&&v.snippet&&v.snippet.title).map(v=>({ ten:String(v.snippet.title).trim(), nguon:'YOUTUBE', link:'https://www.youtube.com/watch?v='+v.id, mo_ta:String(v.snippet.description||'').slice(0,500) })) }; }
// AI chấm ý tưởng: trả JSON {diem, pillar_id, dinh_dang, muc_tieu, rui_ro_claim, ly_do}. Thiếu key → null (không đoán).
async function chamYTuongAI(env, yt, yTuongId=null){
  const pillars=(await env.DB.prepare(`SELECT id,ten,mo_ta,muc_tieu FROM pillars WHERE active=1`).all()).results;
  const claims=(await env.DB.prepare(`SELECT cum_tu FROM claim_cam WHERE active=1`).all()).results.map(c=>c.cum_tu);
  const cl=await env.DB.prepare(`SELECT * FROM chien_luoc WHERE id=1`).first()||{};
  const sys='Bạn là trưởng phòng marketing của thương hiệu keo ron gạch Kingsmen. Chấm một ý tưởng/trend có đáng làm nội dung không. CHỈ trả JSON: {"diem":0-100,"pillar_id":"<id hoặc null>","dinh_dang":"VIDEO|POST|ANH|CAROUSEL","muc_tieu":"BRAND|BAN_HANG","rui_ro_claim":true|false,"ly_do":"<1-2 câu>"}. Điểm cao khi: liên quan ngành vật liệu/thi công/nhà ở, hợp định vị, làm được với thông số thật. rui_ro_claim=true nếu để khai thác phải nói quá (giá, "tốt nhất", vĩnh viễn…).';
  const usr='ĐỊNH VỊ: '+(cl.dinh_vi||'(chưa)')+'\nĐỐI TƯỢNG: '+(cl.doi_tuong||'(chưa)')+'\nPILLAR: '+JSON.stringify(pillars)+'\nCỤM CẤM: '+JSON.stringify(claims)+'\nÝ TƯỞNG: '+yt.ten+'\nMÔ TẢ: '+(yt.mo_ta||'')+'\nNGUỒN: '+yt.nguon;
  const r=await goiAI(env,{system:sys, messages:[{role:'user',content:usr}], max_tokens:300, tinh_nang:'cham_y_tuong', ngu_canh:{loai:'cham_y_tuong', y_tuong_id:yTuongId}}); if(!r.ok) return null;
  try{ const t=r.text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,''); const o=JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}')+1));
    return { diem:Math.max(0,Math.min(100,Math.round(so(o.diem)))), pillar_id:pillars.some(p=>p.id===o.pillar_id)?o.pillar_id:null, dinh_dang:dinhDang(o.dinh_dang), muc_tieu:mucTieu(o.muc_tieu), rui_ro:o.rui_ro_claim===true?'claim':'', ly_do:chuoi(o.ly_do,400) }; }catch(e){ return null; }
}
// Gom ý tưởng vào DB: chống trùng (tên/link trong N ngày) · lọc từ khoá · chấm AI · tự duyệt nếu B1 ở AI_TU_LAM
async function gomYTuong(env, ds, nguonMay){
  const cfg=(await docCauHinh(env)).trend||{}; const tuCut=new Date(Date.now()-Math.max(1,so(cfg.chong_trung_ngay,30))*864e5).toISOString();
  const gan=(await env.DB.prepare(`SELECT ten,link FROM y_tuong WHERE created_at>=?`).bind(tuCut).all()).results;
  const daLink=new Set(gan.map(x=>chuanHoaLink(x.link)).filter(Boolean)), daTen=new Set(gan.map(x=>chuanHoaTen(x.ten)));
  const b1=await mucBuoc(env,'B1'); const tuLam=b1.nguoi_thuc_hien==='AI_TU_LAM'; const nguong=so(cfg.nguong_tu_duyet,70);
  let them=0, cham=0, tuDuyet=0; const trung=[], lech=[];
  for(const x of ds.slice(0,200)){
    const ten=chuoi(x&&x.ten,200); if(!ten) continue; const link=chuoi(x&&x.link,500), mo_ta=chuoi(x&&x.mo_ta,500);
    const kL=chuanHoaLink(link), kT=chuanHoaTen(ten); if((kL&&daLink.has(kL))||daTen.has(kT)){ trung.push(ten); continue; }
    if(!khopTuKhoa(ten+' '+mo_ta, cfg.tu_khoa_nganh)){ lech.push(ten); continue; }
    const id=uid('yt'); const ch=await chamYTuongAI(env,{ten,mo_ta,nguon:x.nguon}, id); if(ch) cham++;
    const duyet=tuLam && ch && ch.diem>=nguong && !ch.rui_ro;
    await env.DB.prepare(`INSERT INTO y_tuong (id,nguon,ten,mo_ta,link,pillar_id,dinh_dang,muc_tieu,diem_may,ly_do_may,rui_ro,trang_thai,ngay,quyet_boi,quyet_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, chuoi(x.nguon||'KHAC',30).toUpperCase(), ten, mo_ta, link, ch?ch.pillar_id:null, ch?ch.dinh_dang:null, ch?ch.muc_tieu:'BRAND', ch?ch.diem:null, ch?ch.ly_do:null, ch?ch.rui_ro:'', duyet?'DUYET':'MOI', ngayVN(), duyet?'Máy (B1 AI tự làm)':null, duyet?nowISO():null, nowISO()).run();
    if(duyet){ tuDuyet++; await taoMucTuYTuong(env, id, 'Máy (B1 AI tự làm)'); }
    if(kL) daLink.add(kL); daTen.add(kT); them++;
  }
  return { them, cham, tu_duyet:tuDuyet, trung:trung.length, lech_tu_khoa:lech.length, chi_tiet:{trung:trung.slice(0,10), lech:lech.slice(0,10)} };
}
async function taoMucTuYTuong(env, ytId, boi){
  const y=await env.DB.prepare(`SELECT * FROM y_tuong WHERE id=?`).bind(ytId).first(); if(!y||y.muc_id) return null;
  const p=y.pillar_id?await env.DB.prepare(`SELECT muc_tieu FROM pillars WHERE id=?`).bind(y.pillar_id).first():null;
  const thang=thangHienTai(); const id=uid('muc');
  await env.DB.prepare(`INSERT INTO muc_noi_dung (id,thang,tuan,tieu_de,muc_tieu,pillar_id,dinh_dang,giai_doan,tao_boi,y_tuong_id,ghi_chu,created_at,created_by_name,updated_at) VALUES (?,?,NULL,?,?,?,?,'Y_TUONG',?,?,?,?,?,?)`)
    .bind(id, thang, y.ten, mucTieu(y.muc_tieu||(p&&p.muc_tieu)), y.pillar_id||null, y.dinh_dang||null, /Máy/.test(boi)?'AGENT':'NGUOI', y.id, 'Từ ý tưởng '+y.nguon+(y.ly_do_may?(' · máy: '+y.ly_do_may):''), nowISO(), boi, nowISO()).run();
  await env.DB.prepare(`UPDATE y_tuong SET muc_id=? WHERE id=?`).bind(id, y.id).run(); return id;
}
// Mẫu học: ghi một quyết định của người kèm đầu ra máy để chấm điểm sẵn sàng
async function ghiMauHoc(env, buoc, o){
  if(o.doi_tuong_id) try{ await env.DB.prepare(`UPDATE mau_hoc_ai SET phan_quyet=?, giong=COALESCE(?,giong), cham_at=?, cham_boi='NGUOI' WHERE doi_tuong_id=? AND phan_quyet IS NULL`).bind(JSON.stringify(o.dau_ra_nguoi||{}).slice(0,2000), o.giong==null?null:Math.max(0,Math.min(1,so(o.giong))), nowISO(), o.doi_tuong_id).run(); }catch(e){}   // ADR-009: kho mẫu AI nhận phán quyết
  await env.DB.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,doi_tuong_id,dau_vao,dau_ra_nguoi,dau_ra_may,giong,ghi_chu,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid('mh'), buoc, ngayVN(), o.doi_tuong_id||null, JSON.stringify(o.dau_vao||{}).slice(0,2000), JSON.stringify(o.dau_ra_nguoi||{}).slice(0,2000), o.dau_ra_may==null?null:JSON.stringify(o.dau_ra_may).slice(0,2000), o.giong==null?null:Math.max(0,Math.min(1,so(o.giong))), chuoi(o.ghi_chu,300), nowISO()).run();
}
// Độ giống giữa hai bộ chỉ tiêu (0..1): 1 − trung bình lệch tương đối theo từng số
// (bỏ qua ket_qua: KPI kết quả máy cố ý để 0 khi chưa có số đo — người điền không phải là "máy sai")
function giongChiTieu(a,b){ const cap=[]; const duyet=(x,y)=>{ for(const k of new Set([...Object.keys(x||{}),...Object.keys(y||{})])){ if(k==='ket_qua') continue; const u=so(x&&x[k]), v=so(y&&y[k]); if(typeof (x&&x[k])==='object'||typeof (y&&y[k])==='object'){ duyet(x&&x[k], y&&y[k]); continue; } if(u===0&&v===0) continue; cap.push(Math.abs(u-v)/Math.max(u,v,1)); } }; duyet(a,b); return cap.length? 1-cap.reduce((s,x)=>s+x,0)/cap.length : 1; }

// ============================================================
//  ADR-003 — DÒNG CHẢY NỘI DUNG: soạn (B4) · thẩm định & duyệt G3 (B5) · tài sản · đăng (B9)
// ============================================================
function lamSachChiTiet(o){ const out={}; if(!o||typeof o!=='object'||Array.isArray(o)) return out; for(const k of Object.keys(o).slice(0,20)){ const v=o[k]; if(typeof v==='string'||typeof v==='number') out[String(k).slice(0,40)]=String(v).trim().slice(0,5000); } return out; }
const docSections=v=>{ const a=Array.isArray(v)?v:docJSON(v,[]); return (Array.isArray(a)?a:[]).filter(x=>x&&(x.label||x.text)).map(x=>({label:chuoi(x.label,80), text:chuoi(x.text,3000), hinh:chuoi(x.hinh,500), buoc:x.buoc?chuoi(x.buoc,120):null})).slice(0,40); };
// Toàn văn để quét claim & so giống — phủ cả ghi chú hình và mọi trường chữ trong chi_tiet
function vanBan(nd){ const secs=docSections(nd.sections).map(x=>[x.text,x.hinh].filter(Boolean).join('\n')).join('\n'); const ct=docJSON(nd.chi_tiet,nd.chi_tiet&&typeof nd.chi_tiet==='object'?nd.chi_tiet:{}); const ctT=Object.keys(ct).filter(k=>!/url|ti_le|_luc|_id$/.test(k)).map(k=>ct[k]).filter(Boolean).join('\n'); return [nd.tieu_de,nd.hook,secs,nd.cta,ctT].filter(Boolean).join('\n'); }
// Bản đăng cuối theo định dạng (post/carousel/ảnh: caption; video: lời bình)
function banDang(nd){ const secs=docSections(nd.sections); const ct=docJSON(nd.chi_tiet,{}); const than=secs.map(x=>x.text); const dd=nd.dinh_dang||'VIDEO'; let p;
  if(dd==='POST') p=[nd.hook,...than,nd.cta,ct.hashtag]; else if(dd==='ANH') p=[ct.caption||[nd.hook,ct.chu_phu].filter(Boolean).join('\n'),nd.cta,ct.hashtag]; else if(dd==='CAROUSEL') p=[ct.caption||[nd.hook,...than].filter(Boolean).join('\n'),nd.cta,ct.hashtag]; else p=[nd.hook,...than,nd.cta];
  return p.filter(Boolean).join('\n\n'); }
function quetClaim(text, claims){ const t=String(text||'').toLowerCase(); return (claims||[]).filter(c=>c.cum_tu&&t.includes(String(c.cum_tu).toLowerCase())).map(c=>({cum_tu:c.cum_tu, muc_do:c.muc_do, ly_do:c.ly_do||''})); }
async function docClaims(env){ return (await env.DB.prepare(`SELECT cum_tu,muc_do,ly_do FROM claim_cam WHERE active=1`).all()).results; }
// Máy thẩm định (B5) — luật cứng + luật mềm, KHÔNG dùng AI, giải thích được từng điểm trừ
function chamNoiDungMay(nd, claims){
  const ly_do=[], loi_cung=[]; let diem=100; const dd=nd.dinh_dang||'VIDEO'; const secs=docSections(nd.sections); const ct=docJSON(nd.chi_tiet,{}); const vb=vanBan(nd);
  const chan=quetClaim(vb,claims).filter(c=>c.muc_do==='CHAN'), cb=quetClaim(vb,claims).filter(c=>c.muc_do!=='CHAN');
  if(chan.length){ diem-=60; loi_cung.push('Có cụm bị CHẶN: '+chan.map(c=>c.cum_tu).join(', ')); }
  if(cb.length){ diem-=10*cb.length; ly_do.push('Cụm cần cân nhắc: '+cb.map(c=>c.cum_tu).join(', ')); }
  if(!chuoi(nd.hook)){ diem-=25; loi_cung.push('Thiếu hook / câu mở'); } else if(dd==='ANH' && nd.hook.split(/\s+/).length>8){ diem-=10; ly_do.push('Headline ảnh dài hơn 8 từ'); }
  if(!chuoi(nd.cta)){ diem-=20; loi_cung.push('Thiếu CTA'); }
  if(dd!=='ANH' && secs.length===0){ diem-=25; loi_cung.push('Chưa có thân bài / cảnh'); }
  if(dd==='CAROUSEL' && (secs.length<3||secs.length>8)){ diem-=10; ly_do.push('Carousel nên 4–8 slide (đang '+secs.length+')'); }
  if(dd==='VIDEO' && secs.some(x=>!x.hinh)){ diem-=5; ly_do.push('Có cảnh chưa ghi gợi ý hình'); }
  if(/\[điền/i.test(vb)){ diem-=15; ly_do.push('Còn chỗ "[điền …]" chưa điền dữ kiện'); }
  if(/\d{2,3}[.,]?\d{3}\s*(đ|vnd|k\b)/i.test(vb)){ diem-=15; ly_do.push('Có con số tiền — bảng giá đổi theo đợt, bài đăng sống mãi'); }
  if(!nd.san_pham_id && /\b(G\d{4}|kingsmen)\b/i.test(vb)) ly_do.push('Nhắc sản phẩm nhưng chưa gắn sản phẩm để đối chiếu thông số');
  return { diem:Math.max(0,Math.min(100,diem)), ly_do, loi_cung, nen_duyet: loi_cung.length===0 && diem>=70 };
}
// Prompt soạn theo định dạng — chép từ app cũ, thêm mục tiêu (brand/bán hàng) và ví dụ tốt đã duyệt (kho ví dụ)
const AI_NGUYEN_TAC='NGUYÊN TẮC: 1. Chỉ dùng thông số/bảo hành/tiêu chuẩn có trong dữ kiện; không bịa số, không so sánh tên đối thủ. 2. Không dùng cụm từ cấm. 3. Tông giọng và đối tượng theo chiến lược. 4. Mỗi câu ngắn, cụ thể, nói cho thợ và chủ nhà hiểu ngay. 5. Không nói giá, khuyến mãi, con số tiền — cần thì viết "[điền giá]". 6. Thiếu dữ kiện thì viết "[điền …]" thay vì đoán.';
async function promptNoiDung(env, b){
  const fw=b.framework_id?await env.DB.prepare(`SELECT * FROM frameworks WHERE id=?`).bind(b.framework_id).first():null;
  const sp=b.san_pham_id?await env.DB.prepare(`SELECT * FROM san_pham WHERE id=?`).bind(b.san_pham_id).first():null;
  const kn=b.kenh_id?await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(b.kenh_id).first():null;
  const pl=b.pillar_id?await env.DB.prepare(`SELECT * FROM pillars WHERE id=?`).bind(b.pillar_id).first():null;
  const cl=await env.DB.prepare(`SELECT * FROM chien_luoc WHERE id=1`).first()||{}; const claims=await docClaims(env);
  const dd=dinhDang(b.dinh_dang)||'VIDEO'; const cacBuoc=(dd==='VIDEO'&&Array.isArray(b.cac_buoc))?b.cac_buoc.map(s=>chuoi(s,120)).filter(Boolean).slice(0,60):[];
  // kho ví dụ: 2 bài cùng định dạng (ưu tiên cùng pillar) đã DUYỆT gần nhất — máy học "giọng đã được duyệt"
  const viDu=(await env.DB.prepare(`SELECT n.tieu_de,n.hook,n.cta,n.sections,n.chi_tiet FROM noi_dung n LEFT JOIN muc_noi_dung m ON m.id=n.muc_id WHERE n.trang_thai='DUYET' AND n.dinh_dang=? ORDER BY CASE WHEN m.pillar_id=? THEN 0 ELSE 1 END, n.updated_at DESC LIMIT 2`).bind(dd, b.pillar_id||'').all()).results;
  const KHUON={
    VIDEO:{ vai:'Bạn viết kịch bản video ngắn 30–60 giây cho thương hiệu keo ron gạch Kingsmen.', json:'{"tieu_de":"...","hook":"<3 giây đầu>","sections":[{"label":"Cảnh 1","text":"<lời bình>","hinh":"<gợi ý hình>","buoc":'+(cacBuoc.length?'"<tên bước nguyên văn hoặc null>"':'null')+'}],"cta":"..."}' },
    POST:{ vai:'Bạn viết BÀI ĐĂNG mạng xã hội (Facebook/Zalo) cho thương hiệu keo ron gạch Kingsmen. Câu mở phải khiến người đọc bấm "Xem thêm"; thân 3–5 đoạn ngắn ≤ 60 từ; chốt bằng CTA.', json:'{"tieu_de":"...","hook":"<câu mở>","sections":[{"label":"Đoạn 1","text":"..."}],"cta":"...","hashtag":"#kingsmen #..."}' },
    ANH:{ vai:'Bạn viết CHỮ TRÊN ẢNH/BANNER cho thương hiệu keo ron gạch Kingsmen. Headline ≤ 8 từ; chữ phụ ≤ 20 từ; nút CTA ≤ 4 từ; caption 2–4 câu; brief cho designer.', json:'{"tieu_de":"...","hook":"<headline>","chu_phu":"...","cta":"<nút>","caption":"...","hashtag":"#...","brief":"..."}' },
    CAROUSEL:{ vai:'Bạn viết CAROUSEL 5–7 slide cho thương hiệu keo ron gạch Kingsmen. Slide bìa ≤ 10 từ; mỗi slide ≤ 30 từ + gợi ý hình; slide chốt là CTA; caption 2–3 câu.', json:'{"tieu_de":"...","hook":"<slide bìa>","sections":[{"label":"Slide 2","text":"...","hinh":"<gợi ý hình>"}],"cta":"<slide chốt>","caption":"...","hashtag":"#..."}' } }[dd];
  const sys=KHUON.vai+'\n'+AI_NGUYEN_TAC+(cacBuoc.length?'\n7. Nguồn quay THẬT chỉ có các bước trong "CÁC BƯỚC CÓ SẴN" — mỗi mục sections gắn "buoc" đúng nguyên văn một tên trong đó.':'')+'\nCHỈ trả về JSON thuần dạng '+KHUON.json+' — không giải thích.';
  const usr='MỤC TIÊU BÀI: '+(b.muc_tieu==='BAN_HANG'?'BÁN HÀNG (dẫn tới hỏi mua/inbox, nói rõ sản phẩm & lợi ích thật)':'XÂY DỰNG BRAND (để được xem, chia sẻ, nhớ tên; không ép mua)')+'\nPILLAR: '+(pl?(pl.ten+(pl.mo_ta?(' — '+pl.mo_ta):'')):'(chưa)')+'\nFRAMEWORK: '+(fw?(fw.ten+(fw.mo_ta?(' — '+fw.mo_ta):'')):'(tự chọn cấu trúc)')+'\nSẢN PHẨM: '+(sp?sp.ten:'(chưa chọn)')+'\nTHÔNG SỐ THẬT (chỉ được dùng những cái này): '+(sp?JSON.stringify(docJSON(sp.thong_so,[])):'(chưa có)')+'\nTIÊU CHUẨN: '+((sp&&sp.tieu_chuan)||'(chưa có)')+'\nBẢO HÀNH (trích nguyên văn được): '+((sp&&sp.bao_hanh)||'(chưa có)')+'\nHƯỚNG DẪN DÙNG: '+((sp&&sp.huong_dan)||'(chưa có)')+'\nKÊNH: '+(kn?(kn.ten+' ('+kn.loai+')'):'(chưa chọn)')+'\nĐỊNH VỊ: '+(cl.dinh_vi||'(chưa đặt)')+'\nTÔNG GIỌNG: '+(cl.tong_giong||'(chưa đặt)')+'\nĐỐI TƯỢNG: '+(cl.doi_tuong||'(chưa đặt)')+'\nCỤM TỪ CẤM: '+JSON.stringify(claims.map(c=>c.cum_tu))+(viDu.length?('\nVÍ DỤ ĐÃ ĐƯỢC DUYỆT (học giọng, không chép):\n'+viDu.map(v=>'- '+v.tieu_de+' | hook: '+v.hook+' | cta: '+v.cta).join('\n')):'')+(cacBuoc.length?('\nCÁC BƯỚC CÓ SẴN TRONG NGUỒN QUAY:\n'+cacBuoc.map((x,i)=>(i+1)+'. '+x).join('\n')):'')+'\nĐỀ BÀI: '+(chuoi(b.tieu_de,200)||'(tự đặt)')+'\nGÓC NHÌN: '+(chuoi(b.angle,8000)||'(tự chọn góc hợp framework)');
  return { sys, usr, cacBuoc, claims, dd, so_vi_du:viDu.length };
}
// Thẩm định JSON AI trả về — cùng bộ kiểm cho mọi nhà cung cấp; cụm CHẶN → từ chối
function duyetVanBanAI(text, cacBuoc, claims, dd){
  let t=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim(); const i=t.indexOf('{'), k=t.lastIndexOf('}'); if(i<0||k<0) return {ok:false, loi:'AI không trả về JSON'};
  let kb; try{ kb=JSON.parse(t.slice(i,k+1)); }catch(e){ return {ok:false, loi:'JSON từ AI hỏng'}; } if(!kb||(!kb.hook&&!kb.tieu_de)) return {ok:false, loi:'AI trả nội dung rỗng'};
  const ds=Array.isArray(cacBuoc)?cacBuoc:[]; let secs=docSections(kb.sections).map(x=>({...x, buoc:(ds.length&&x.buoc&&ds.includes(x.buoc))?x.buoc:null})); if(dd==='ANH') secs=[];
  const KHOA={POST:['hashtag'],ANH:['chu_phu','caption','hashtag','brief'],CAROUSEL:['caption','hashtag'],VIDEO:[]}[dd]||[]; const ct={}; KHOA.forEach(x=>{ if(kb[x]!=null&&String(kb[x]).trim()) ct[x]=String(kb[x]).trim().slice(0,5000); });
  const out={ tieu_de:chuoi(kb.tieu_de,200), hook:chuoi(kb.hook,1000), sections:secs, cta:chuoi(kb.cta,500), chi_tiet:ct, dinh_dang:dd };
  const flags=quetClaim(vanBan(out), claims); const chan=flags.filter(f=>f.muc_do==='CHAN'); if(chan.length) return {ok:false, loi:'AI viết trúng cụm bị CHẶN ('+chan.map(c=>c.cum_tu).join(', ')+') — thử lại hoặc đổi góc', blocked:chan.map(c=>c.cum_tu)};
  return {ok:true, noi_dung:out, canh_bao:flags.filter(f=>f.muc_do!=='CHAN')};
}
// Kho footage của mục (mô tả do Claude nhìn khung khi nạp Drive) → nối vào góc viết để kịch bản bám đúng hình đang có (24/09).
async function angleFootage(env, mucId, dinhDang, goc){ if(!mucId||dinhDang!=='VIDEO') return goc||''; const ft=(await env.DB.prepare(`SELECT ten,mo_ta FROM tai_san WHERE muc_id=? AND loai IN ('FOOTAGE','ANH') AND COALESCE(mo_ta,'')<>'' AND COALESCE(nguon,'')<>'THU_NGHIEM' ORDER BY created_at LIMIT 20`).bind(mucId).all()).results;
  const tot=(await env.DB.prepare(`SELECT ten,kich_ban,doanh_thu,luot_xem,san_pham FROM kho_thanh_pham WHERE kich_ban IS NOT NULL AND length(kich_ban)>80 ORDER BY COALESCE(doanh_thu,0) DESC, COALESCE(luot_xem,0) DESC LIMIT 3`).all()).results;
  const thamChieu=tot.length?('\n\nKỊCH BẢN BÁN TỐT THAM KHẢO ('+tot.length+' video TikTok Shop có doanh thu cao, lời thoại máy nghe được). CHỈ HỌC CẤU TRÚC: cách mở đầu 3 giây, cách nêu vấn đề, bằng chứng, chốt đơn. KHÔNG chép câu, KHÔNG nhắc tên shop/sản phẩm/giá trong đó.\n'+tot.map((x,i)=>'Mẫu '+(i+1)+(x.doanh_thu?(' (doanh thu ~'+tienVN(x.doanh_thu)+')'):'')+': '+String(x.kich_ban).slice(0,700)).join('\n')):'';
  return (goc||'')+thamChieu+(ft.length?('\n\nFOOTAGE ĐANG CÓ TRONG KHO ('+ft.length+' clip, mô tả do máy nhìn khung hình). Luật bắt buộc: (1) mỗi cảnh chỉ nói điều mà một clip dưới đây quay được; (2) trường "hinh" của cảnh = CHÉP NGUYÊN VĂN phần mô tả (trước dấu |) của clip bạn chọn cho cảnh đó — KHÔNG đặt tên file, KHÔNG tự bịa hình; (3) mỗi clip dùng tối đa một lần; (4) không nêu tính năng/thông số mà mô tả mục kế hoạch không có.\n'+ft.map((x,i)=>'Clip '+(i+1)+': '+String(x.mo_ta).split(' · ')[0].slice(0,220)).join('\n')):''); }
async function aiVietNoiDung(env, b, me, tinhNang='soan_noi_dung', nguCanh=null){ const p=await promptNoiDung(env,b); const r=await goiAI(env,{system:p.sys, messages:[{role:'user',content:p.usr}], max_tokens:2000, tinh_nang:tinhNang, me, ngu_canh:{loai:'ai_viet', ...(nguCanh||{}), dd:p.dd, cacBuoc:p.cacBuoc}}); if(!r.ok) return r; const d=duyetVanBanAI(r.text, p.cacBuoc, p.claims, p.dd); return {...d, so_vi_du:p.so_vi_du, model:r.model}; }
// Độ giống hai văn bản (Jaccard theo từ) — dùng cho bản nháp bóng B4
function giongVanBan(a,b){ const tach=s=>new Set(String(s||'').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(w=>w.length>1)); const A=tach(a),B=tach(b); if(!A.size&&!B.size) return 1; let g=0; A.forEach(w=>{ if(B.has(w)) g++; }); return g/(A.size+B.size-g); }
async function datGiaiDoan(env, mucId, gd, lyDo, tacNhan){ if(!mucId||!GIAI_DOAN.includes(gd)) return; const m=await env.DB.prepare(`SELECT giai_doan,tieu_de FROM muc_noi_dung WHERE id=?`).bind(mucId).first(); if(!m||m.giai_doan===gd) return;
  await env.DB.prepare(`UPDATE muc_noi_dung SET giai_doan=?, updated_at=? WHERE id=?`).bind(gd, nowISO(), mucId).run(); await logAudit(env, tacNhan, 'giai đoạn '+m.giai_doan+' → '+gd, 'muc_noi_dung', mucId, lyDo||''); }
const MAY=(ten)=>({ id:'', ho_ten:ten||'Máy', vai_tro:ROLES.MARKETING, agent:true });
async function luuPhienBan(env, nd, boi){ await env.DB.prepare(`INSERT INTO noi_dung_phien_ban (id,noi_dung_id,phien_ban,snapshot,created_at,created_by_name) VALUES (?,?,?,?,?,?)`).bind(uid('ndv'), nd.id, nd.phien_ban, JSON.stringify({tieu_de:nd.tieu_de,hook:nd.hook,sections:docSections(nd.sections),cta:nd.cta,chi_tiet:docJSON(nd.chi_tiet,{}),trang_thai:nd.trang_thai}), nowISO(), boi).run(); }
async function taoNoiDung(env, b, tacNhan){
  const dd=dinhDang(b.dinh_dang)||'VIDEO'; const claims=await docClaims(env); const nd={ tieu_de:chuoi(b.tieu_de,200), hook:chuoi(b.hook,1000), sections:docSections(b.sections), cta:chuoi(b.cta,500), chi_tiet:lamSachChiTiet(b.chi_tiet), dinh_dang:dd };
  if(!nd.tieu_de&&!nd.hook) return {ok:false, loi:'Cần tiêu đề hoặc hook'}; const chan=quetClaim(vanBan(nd),claims).filter(c=>c.muc_do==='CHAN'); if(chan.length) return {ok:false, loi:'Có cụm bị CHẶN: '+chan.map(c=>c.cum_tu).join(', '), blocked:chan.map(c=>c.cum_tu)};
  const id=uid('nd'); const muc=b.muc_id?await env.DB.prepare(`SELECT * FROM muc_noi_dung WHERE id=?`).bind(b.muc_id).first():null;
  await env.DB.prepare(`INSERT INTO noi_dung (id,muc_id,dinh_dang,phien_ban,tieu_de,hook,sections,cta,chi_tiet,framework_id,san_pham_id,kenh_id,trang_thai,tao_boi,ly_do_may,created_at,created_by,created_by_name,updated_at) VALUES (?,?,?,1,?,?,?,?,?,?,?,?,'NHAP',?,?,?,?,?,?)`)
    .bind(id, muc?muc.id:null, dd, nd.tieu_de, nd.hook, JSON.stringify(nd.sections), nd.cta, JSON.stringify(nd.chi_tiet), b.framework_id||(muc&&muc.framework_id)||null, b.san_pham_id||(muc&&muc.san_pham_id)||null, b.kenh_id||(muc&&muc.kenh_id)||null, tacNhan.agent?'AGENT':'NGUOI', chuoi(b.ly_do_may,500)||null, nowISO(), tacNhan.id||'', tacNhan.ho_ten, nowISO()).run();
  await luuPhienBan(env, {...nd, id, phien_ban:1, trang_thai:'NHAP'}, tacNhan.ho_ten);
  if(muc){ if(muc.dinh_dang!==dd) await env.DB.prepare(`UPDATE muc_noi_dung SET dinh_dang=? WHERE id=?`).bind(dd, muc.id).run(); await datGiaiDoan(env, muc.id, 'SOAN', 'có nội dung', tacNhan); }
  await logAudit(env, tacNhan, 'tạo nội dung', 'noi_dung', id, nd.tieu_de||nd.hook); return {ok:true, id};
}
// Gửi duyệt (G3): tạo dòng duyệt, máy chấm sẵn (B5); B5 ở mức AI → tự TRẢ LẠI bài trượt luật cứng (không bao giờ tự duyệt)
async function guiDuyet(env, nd, tacNhan){
  const cho=await env.DB.prepare(`SELECT id FROM duyet WHERE doi_tuong='noi_dung' AND doi_tuong_id=? AND trang_thai='CHO'`).bind(nd.id).first(); if(cho) return {ok:false, loi:'Bài đang chờ duyệt rồi'};
  const claims=await docClaims(env); const cham=chamNoiDungMay(nd, claims); const b5=await mucBuoc(env,'B5'); const id=uid('dy');
  const tuTra = b5.nguoi_thuc_hien!=='NGUOI' && cham.loi_cung.length>0;
  await env.DB.prepare(`INSERT INTO duyet (id,doi_tuong,doi_tuong_id,cong,trang_thai,nguoi_gui_id,nguoi_gui_ten,cham_may,quyet_boi,quyet_at,ly_do_nguoi,created_at) VALUES (?,'noi_dung',?,'G3',?,?,?,?,?,?,?,?)`)
    .bind(id, nd.id, tuTra?'TRA_LAI':'CHO', tacNhan.id||'', tacNhan.ho_ten, JSON.stringify(cham), tuTra?'Máy (B5 · luật cứng)':null, tuTra?nowISO():null, tuTra?('Máy trả lại: '+cham.loi_cung.join('; ')):null, nowISO()).run();
  await env.DB.prepare(`UPDATE noi_dung SET trang_thai=?, updated_at=? WHERE id=?`).bind(tuTra?'TRA_LAI':'CHO_DUYET', nowISO(), nd.id).run();
  await datGiaiDoan(env, nd.muc_id, tuTra?'SOAN':'CHO_DUYET', tuTra?'máy trả lại':'gửi duyệt', tacNhan);
  await logAudit(env, tacNhan, tuTra?'máy trả lại bài (B5)':'gửi duyệt (G3)', 'noi_dung', nd.id, 'máy chấm '+cham.diem+'/100'+(cham.loi_cung.length?(' · '+cham.loi_cung.join('; ')):''));
  return {ok:true, id, cham, tu_tra_lai:tuTra};
}
// Bản nháp bóng (chế độ học B4): máy viết ngầm cùng đầu vào bài người gửi duyệt, so giống, ghi mẫu — không hiện cho người
async function banNhapBong(env, nd){
  const muc=nd.muc_id?await env.DB.prepare(`SELECT * FROM muc_noi_dung WHERE id=?`).bind(nd.muc_id).first():null;
  const r=await aiVietNoiDung(env, { dinh_dang:nd.dinh_dang, tieu_de:nd.tieu_de, framework_id:nd.framework_id, san_pham_id:nd.san_pham_id, kenh_id:nd.kenh_id, pillar_id:muc&&muc.pillar_id, muc_tieu:muc&&muc.muc_tieu }, null, 'hoc_ban_bong');
  if(!r.ok) return r; const g=giongVanBan(vanBan(nd), vanBan(r.noi_dung)); const claims=await docClaims(env); const chamMay=chamNoiDungMay(r.noi_dung,claims), chamNguoi=chamNoiDungMay(nd,claims);
  // giống = 0.6 × giống văn bản + 0.4 × cùng đạt luật cứng (máy viết ra bài đủ chuẩn như người)
  const giong=0.6*g+0.4*((chamMay.loi_cung.length===0)===(chamNguoi.loi_cung.length===0)?1:0);
  await ghiMauHoc(env,'B4',{doi_tuong_id:nd.id, dau_vao:{dinh_dang:nd.dinh_dang,tieu_de:nd.tieu_de,muc_id:nd.muc_id}, dau_ra_nguoi:{hook:nd.hook,cta:nd.cta,so_doan:docSections(nd.sections).length,diem:chamNguoi.diem}, dau_ra_may:{hook:r.noi_dung.hook,cta:r.noi_dung.cta,so_doan:r.noi_dung.sections.length,diem:chamMay.diem}, giong, ghi_chu:'bản nháp bóng · giống chữ '+(g*100).toFixed(0)+'%'});
  return {ok:true, giong};
}
// Đăng lên Facebook Page bằng Graph API (POST/CAROUSEL: feed; ANH: photos với url công khai). VIDEO → đăng tay/n8n.
async function dangFacebook(env, kenh, bd, nd){
  const token=layToken(env,kenh); if(!token) return {ok:false, loi:'Chưa cắm secret TOKEN_'+(kenh.api_ma||'?')}; const page=chuoi(kenh.api_object_id,80); if(!page) return {ok:false, loi:'Kênh chưa có Page ID'};
  const dd=nd.dinh_dang||'POST'; if(dd==='VIDEO') return {ok:false, loi:'Video không đăng qua API ở đợt này — đăng tay hoặc n8n'};
  const base='https://graph.facebook.com/v21.0/'+encodeURIComponent(page); const body=new URLSearchParams({access_token:token});
  let url; if(dd==='ANH'){ if(!bd.media_url) return {ok:false, loi:'Bài ảnh chưa có ảnh'}; url=base+'/photos'; body.set('url', /^https?:/.test(bd.media_url)?bd.media_url:((env.APP_BASE_URL||'')+bd.media_url)); body.set('caption', bd.noi_dung_dang||''); } else { url=base+'/feed'; body.set('message', bd.noi_dung_dang||''); }
  let r,j; try{ r=await fetch(url,{method:'POST', body}); j=await r.json().catch(()=>({})); }catch(e){ return {ok:false, loi:'Không gọi được Graph API: '+e.message}; }
  if(!r.ok||j.error) return {ok:false, loi:'Graph API: '+((j.error&&j.error.message)||('HTTP '+r.status))};
  const id=j.post_id||j.id||''; return {ok:true, id, link: id?('https://www.facebook.com/'+id):''};
}
async function dangN8n(env, bd, nd, kenh){ const url=env.N8N_WEBHOOK_URL; if(!url) return {ok:false, loi:'Chưa cắm N8N_WEBHOOK_URL'}; try{ const r=await fetch(url,{method:'POST', headers:{'content-type':'application/json', ...(env.N8N_TOKEN?{'X-App-Token':env.N8N_TOKEN}:{})}, body:JSON.stringify({loai:'DANG_BAI', bai_dang_id:bd.id, kenh:{ten:kenh.ten, loai:kenh.loai, api_ma:kenh.api_ma, api_object_id:kenh.api_object_id}, dinh_dang:nd.dinh_dang, noi_dung:bd.noi_dung_dang, media_url:bd.media_url, callback:(env.APP_BASE_URL||'')+'/api/bai-dang/'+bd.id+'/n8n-callback'})}); if(!r.ok) return {ok:false, loi:'n8n trả '+r.status}; return {ok:true, cho_callback:true}; }catch(e){ return {ok:false, loi:'Không gọi được n8n: '+e.message}; } }
// ===== ADR-004 — TRẠM MÁY VĂN PHÒNG (masfico-tram, hợp đồng hub1) =====
// Trạm sau NAT nên chiều nào cũng do Trạm chủ động gọi: hỏi lệnh /hub/lenh (20 giây), đẩy dữ liệu /hub/nap, nhịp tim /hub/trang_thai (2 phút).
// Content OS chỉ được sai Trạm bằng bộ lệnh VIEC_HUB của Trạm; agent của Content OS trên Trạm là "content_os" (may/agents.mjs).
const VIEC_TRAM=['chay_agent','chay_hang_loat','lich_viec','zalo_qr','gui_otp','huy_dang_nhap','dung_video','mo_hinh_bong','huan_luyen','mo_hinh_chay','loc_footage','nap_drive','phan_tich_footage','hoc_thanh_pham'];   // ADR-010   // nap_drive: máy con nạp footage từ thư mục Drive (24/09)   // dung_video/mo_hinh_bong/huan_luyen: lệnh cho máy ghép (ADR-008/009)   // dung_video: lệnh cho máy con (ADR-008)
// Món Content OS nhận từ Trạm: kết quả đăng/đo của chính agent content_os + tin đối thủ (→ ý tưởng) + bình luận TikTok
const MON_HUB=[{viec:'content_os.dang', bang:['content_os.dang_ket_qua']},{viec:'content_os.do_luong', bang:['content_os.ket_qua']},{viec:'content_os.dung_video', bang:['content_os.video']},{viec:'may_dung.loc_footage', bang:['content_os.loc_footage']},{viec:'doi_thu.quet', bang:['doi_thu_tin']},{viec:'doi_thu.quet_nhom', bang:['doi_thu_tin']},{viec:'doi_thu.quet_nhom_trua', bang:['doi_thu_tin']},{viec:'tiktok_cn.binh_luan', bang:['fchat_events']},{viec:'content_os.seeding_dang', bang:['content_os.seeding_dang_ket_qua']},{viec:'content_os.seeding_kiem', bang:['content_os.seeding_kiem']},{viec:'zalo.tin', bang:['zalo.tin']}];
async function sha256Hex(s){ const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
const b64url=str=>btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
// Khoá Trạm văn phòng (module_config.tram.khoa) → may_id 'tram'; khoá máy con kmay_* → tra hash trong may_ghep (ADR-008)
async function xacThucHub(env, request){ const cfg=(await docCauHinh(env)).tram||{}; const k=chuoi(cfg.khoa,200); const h=request.headers.get('X-Hub-Key')||'';
  if(k && cfg.bat!==false && h===k) return {ok:true, may_id:'tram', may:null};
  if(h.startsWith('kmay_')){ const mg=await env.DB.prepare(`SELECT * FROM may_ghep WHERE khoa_hash=? AND active=1`).bind(await sha256Hex(h)).first(); if(mg) return {ok:true, may_id:mg.id, may:{...mg, kha_nang:docJSON(mg.kha_nang,[])}}; return {ok:false, status:401, loi:'Máy ghép không còn hiệu lực — ghép lại ở Hồ sơ › Máy dựng'}; }
  if(!k||cfg.bat===false) return {ok:false, status:503, loi:'Content OS chưa bật Trạm / chưa tạo khoá'}; if(h!==k) return {ok:false, status:401, loi:'Sai khoá Trạm'}; return {ok:true, may_id:'tram', may:null}; }
async function taoLenhTram(env, viec, tham_so, tacNhan, mayId=null){ if(!VIEC_TRAM.includes(viec)) return {ok:false, loi:'Trạm không nhận lệnh '+viec};
  // gộp: cùng việc & tham số đang CHỜ/ĐÃ GỬI (chưa xong) thì không xếp thêm
  const ts=JSON.stringify(tham_so||{}); const cu=await env.DB.prepare(`SELECT id FROM tram_lenh WHERE viec=? AND tham_so=? AND COALESCE(may_id,'tram')=? AND trang_thai IN ('CHO','DA_GUI')`).bind(viec, ts, mayId||'tram').first(); if(cu) return {ok:true, id:cu.id, trung:true};
  const id=uid('tl'); await env.DB.prepare(`INSERT INTO tram_lenh (id,viec,tham_so,trang_thai,tao_boi,created_at,may_id) VALUES (?,?,?,'CHO',?,?,?)`).bind(id, viec, ts, (tacNhan&&tacNhan.ho_ten)||'Máy', nowISO(), mayId||'tram').run(); return {ok:true, id}; }
// ADR-008 — máy ghép: sống = có nhịp tim trong im_lang_phut; chọn máy dựng: máy chỉ định > máy của người > máy ít việc chờ; không có → Trạm văn phòng nếu sống
async function mayGhepSong(env){ const cfg=(await docCauHinh(env)).tram||{}; const han=Date.now()-Math.max(2,so(cfg.im_lang_phut,6))*60000; return (await env.DB.prepare(`SELECT * FROM may_ghep WHERE active=1 ORDER BY created_at`).all()).results.map(x=>({...x, kha_nang:docJSON(x.kha_nang,[]), than:docJSON(x.than,{}), song:!!x.nhan_luc&&Date.parse(x.nhan_luc)>han})); }
async function chonMayDung(env, {mayId=null, uuTienUserId=null}={}){ const ds=(await mayGhepSong(env)).filter(x=>x.kha_nang.includes('dung_video'));
  if(mayId){ const x=ds.find(q=>q.id===mayId); return x?{may:x, ly_do:x.song?'':'máy đang im — lệnh chờ tới khi máy bật'}:null; }
  const song=ds.filter(x=>x.song); if(!song.length) return null; const cho={}; for(const l of (await env.DB.prepare(`SELECT may_id, COUNT(*) n FROM tram_lenh WHERE trang_thai IN ('CHO','DA_GUI') AND may_id IS NOT NULL GROUP BY may_id`).all()).results) cho[l.may_id]=so(l.n);
  song.sort((a,b)=>(sucMay(b)-sucMay(a)) || so(cho[a.id])-so(cho[b.id])); return {may:song[0], ly_do:''}; }   // 24/09 (chủ: gom về Q2, Ngoc-Han dự phòng): máy mạnh nhất đang bật nhận hết
async function giaoDung(env, nd, {mayId=null, uuTienUserId=null, tacNhan}){ const c=await chonMayDung(env,{mayId, uuTienUserId});
  if(c){ const r=await taoLenhTram(env,'dung_video',{noi_dung_id:nd.id}, tacNhan, c.may.id); if(!r.ok) return r; if(!r.trung) await logAudit(env, tacNhan, 'giao dựng video nháp', 'noi_dung', nd.id, 'máy '+c.may.ten+(c.ly_do?(' · '+c.ly_do):'')); return {ok:true, id:r.id, trung:!!r.trung, may_ten:c.may.ten, may_id:c.may.id, ly_do:c.ly_do}; }
  if(mayId) return {ok:false, loi:'Máy đã chọn không còn ghép hoặc không dựng được video'};
  const tt=await docTramTrangThai(env); if(tt&&tt.song){ const r=await taoLenhTram(env,'chay_agent',{id:'content_os', viec:'dung_video'}, tacNhan, 'tram'); return {ok:true, id:r.id, trung:!!r.trung, may_ten:'Trạm văn phòng', may_id:'tram', ly_do:''}; }
  return {ok:false, loi:'Không có máy dựng nào đang bật. Ghép máy của bạn ở Hồ sơ › Máy dựng (tải máy con từ app), hoặc bật Trạm văn phòng.'}; }
async function docTramTrangThai(env){ const r=await env.DB.prepare(`SELECT * FROM tram_trang_thai WHERE id='tram'`).first(); if(!r) return null; const cfg=(await docCauHinh(env)).tram||{}; const im=Date.now()-Date.parse(r.nhan_luc||0); return { ...docJSON(r.than,{}), nhan_luc:r.nhan_luc, im_phut:Math.round(im/60000), song: im < Math.max(2,so(cfg.im_lang_phut,6))*60000 }; }
// Trạm đẩy một lô dữ liệu về — xử lý theo tên bảng; bảng lạ chỉ ghi sổ (không đoán)
async function napLoTram(env, b){
  const bang=chuoi(b.bang,60), dong=Array.isArray(b.dong)?b.dong.slice(0,400):[]; let moi=0, cap=0; const loi=[];
  if(bang==='doi_thu_tin'){ const kq=await gomYTuong(env, dong.map(d=>({ ten:chuoi(d.tieu_de||d.ten||d.title,200), mo_ta:chuoi(d.noi_dung||d.mo_ta||d.tom_tat,500), link:chuoi(d.link||d.url,500), nguon:'DOI_THU' })).filter(x=>x.ten), 'Trạm'); moi=kq.them; }
  else if(bang==='content_os.dang_ket_qua'){ for(const d of dong){ const bd=d.bai_dang_id?await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(String(d.bai_dang_id)).first():null; if(!bd){ loi.push('không thấy bài '+d.bai_dang_id); continue; }
      if(d.ok===true){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DA_DANG', link=?, posted_at=?, loi=NULL, updated_at=? WHERE id=?`).bind(chuoi(d.link,500)||bd.link||'', nowISO(), nowISO(), bd.id).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DANG', 'Trạm đăng xong', MAY('Trạm')); cap++; }
      else { await env.DB.prepare(`UPDATE bai_dang SET trang_thai='LOI', loi=?, lan_thu=lan_thu+1, updated_at=? WHERE id=?`).bind('Trạm: '+chuoi(d.loi||'không rõ',300), nowISO(), bd.id).run(); cap++; } } }
  else if(bang==='content_os.video'){ for(const d of dong){ const nd=d.noi_dung_id?await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(String(d.noi_dung_id)).first():null; if(!nd||!chuoi(d.media_url)){ loi.push('thiếu nội dung/media '+(d.noi_dung_id||'')); continue; }
      const thieu=(Array.isArray(d.thieu_hinh)?d.thieu_hinh:[]).map(x=>chuoi(x,120)).filter(Boolean).slice(0,20); const nguon=chuoi(d.may,60)||'Trạm'; const ten=(nd.tieu_de||nd.hook||'').slice(0,80);
      const tsId=uid('ts'); await env.DB.prepare(`INSERT INTO tai_san (id,loai,ten,mo_ta,media_url,media_type,muc_id,noi_dung_id,nguon,created_at,created_by_name) VALUES (?,'VIDEO_XUAT',?,?,?,'VIDEO',?,?,'TRAM',?,?)`).bind(tsId,'Video nháp máy dựng: '+ten, chuoi(d.mo_ta,400)+(thieu.length?(' · thiếu hình: '+thieu.join('; ')):''), chuoi(d.media_url,500), nd.muc_id, nd.id, nowISO(), nguon).run();
      let goiUrl=''; if(chuoi(d.goi_url)){ goiUrl=chuoi(d.goi_url,500); await env.DB.prepare(`INSERT INTO tai_san (id,loai,ten,mo_ta,media_url,media_type,muc_id,noi_dung_id,nguon,created_at,created_by_name) VALUES (?,'GOI_DUNG',?,?,?,'FILE',?,?,'TRAM',?,?)`).bind(uid('ts'),'Gói dựng tiếp (CapCut): '+ten,'từng cảnh đã cắt + giọng đọc từng cảnh + phụ đề SRT + nhạc nền + bản nháp — giải nén rồi kéo vào CapCut', goiUrl, nd.muc_id, nd.id, nowISO(), nguon).run(); }
      // ADR-009: mỗi cảnh máy chọn = một mẫu chon_canh (đầu ra quy tắc + đầu ra mô hình mở nếu chạy bóng) chờ người chấm
      const canhChon=(Array.isArray(d.canh_chon)?d.canh_chon:[]).slice(0,20).map(c=>({ k:so(c.k), label:chuoi(c.label,60), hinh:chuoi(c.hinh,200), text:chuoi(c.text,300), chon:chuoi(c.chon,40), chon_mo:chuoi(c.chon_mo,40)||null, cach:chuoi(c.cach,12)||'TU_KHOA', ung_vien:(Array.isArray(c.ung_vien)?c.ung_vien:[]).slice(0,12).map(u=>({id:chuoi(u.id,40), ten:chuoi(u.ten,120), mo_ta:chuoi(u.mo_ta,200), media_url:chuoi(u.media_url,500), media_type:chuoi(u.media_type,10), diem:so(u.diem), diem_mo:u.diem_mo==null?null:so(u.diem_mo)})) }));
      // ADR-009c: giọng mở (Piper) chạy bóng → một mẫu tts/video để người nghe chấm
      let ttsMoUrl='', ttsMoMau=null; if(d.tts_mo&&chuoi(d.tts_mo.mau_url)){ ttsMoUrl=chuoi(d.tts_mo.mau_url,500); ttsMoMau=await ghiMauAI(env,{tinh_nang:'tts', mo_hinh_id:'google-tts-neural2', doi_tuong:'noi_dung', doi_tuong_id:nd.id, dau_vao:{cau:chuoi(d.tts_mo.cau,300)}, dau_ra:{giong:'google'}, dau_ra_mo:{url:ttsMoUrl, giong:chuoi(d.tts_mo.giong,60)}, mo_hinh_mo_id:'piper-vi'}); }
      const mauIds=[]; for(const c of canhChon){ if(!c.ung_vien.length) continue; mauIds.push(await ghiMauAI(env,{tinh_nang:'chon_canh', mo_hinh_id:null, doi_tuong:'noi_dung', doi_tuong_id:nd.id, dau_vao:{k:c.k, label:c.label, hinh:c.hinh, text:c.text, ung_vien:c.ung_vien}, dau_ra:{tai_san_id:c.chon, cach:c.cach}, dau_ra_mo:c.chon_mo?{tai_san_id:c.chon_mo}:null, mo_hinh_mo_id:c.chon_mo?'clip-vit-b16':null, giong_mo:c.chon_mo?(c.chon_mo===c.chon?1:0):null})); }
      await env.DB.prepare(`UPDATE noi_dung SET chi_tiet=?, updated_at=? WHERE id=?`).bind(JSON.stringify(lamSachChiTiet({...docJSON(nd.chi_tiet,{}), video_url:chuoi(d.media_url,500), video_tai_san_id:tsId, video_luc:nowISO(), goi_dung_url:goiUrl, thieu_hinh:thieu.join(' | '), tts_mo_url:ttsMoUrl, tts_mo_mau_id:ttsMoMau||'', canh_chon:JSON.stringify(canhChon.map((c,i)=>({...c, mau_id:mauIds[i]||null}))).slice(0,5000)})), nowISO(), nd.id).run();
      // B8 vẫn NGƯỜI: người xem, chỉnh (CapCut) và duyệt bản nháp; thiếu hình → việc quay bổ sung
      const cu=await env.DB.prepare(`SELECT id FROM cong_viec WHERE loai='DUYET_VIDEO_NHAP' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nd.id).first();
      if(!cu) await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'DUYET_VIDEO_NHAP','Xem & duyệt video nháp: '+ten.slice(0,60),'noi_dung',nd.id,'MARKETING',ngayVN(Date.now()+864e5),nguon,'Mở thẻ › Sản xuất: xem bản nháp'+(goiUrl?', tải gói CapCut nếu cần dựng sâu':'')+', gắn bản cuối rồi qua tab Đăng',nowISO()).run();
      if(thieu.length && !(await env.DB.prepare(`SELECT id FROM cong_viec WHERE loai='QUAY_BO_SUNG' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nd.id).first())) await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'QUAY_BO_SUNG','Quay bổ sung '+thieu.length+' cảnh thiếu hình: '+ten.slice(0,50),'noi_dung',nd.id,'MARKETING',ngayVN(Date.now()+3*864e5),nguon,'Máy không tìm được footage khớp gợi ý hình: '+thieu.join('; ')+' — quay/tải lên tài sản của thẻ rồi bấm dựng lại',nowISO()).run();
      // ADR-010: kế hoạch ghép máy vừa dùng (hoặc kế hoạch người nếu bản này dựng theo màn Chỉnh ghép)
      if(Array.isArray(d.ghep)&&d.ghep.length){ const gid=uid('gp'); await env.DB.prepare(`INSERT INTO ghep_video (id,noi_dung_id,nguon,canh,video_url,created_at,created_by_name) VALUES (?,?,?,?,?,?,?)`).bind(gid, nd.id, d.ghep_nguon==='NGUOI'?'NGUOI_DUNG':'MAY', JSON.stringify(sachGhep(d.ghep)), chuoi(d.media_url,500), nowISO(), nguon).run(); }
      moi++; } }
  // ADR-009c — máy lọc footage: đoạn máy đề xuất → tài sản FOOTAGE (nguồn MÁY) + mẫu loc_footage chờ người giữ/bỏ
  else if(bang==='content_os.loc_footage'){ for(const d of dong){ const nd=d.noi_dung_id?await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(String(d.noi_dung_id)).first():null; if(!nd){ loi.push('thiếu nội dung '+(d.noi_dung_id||'')); continue; } const ds=(Array.isArray(d.de_xuat)?d.de_xuat:[]).slice(0,30); const ra=[];
      for(const x of ds){ const mediaUrl=chuoi(x.media_url,500); if(!mediaUrl) continue; const tsId=uid('ts'); const ten='Cắt máy: '+chuoi(x.label,40)+' · '+chuoi(x.hinh,60); await env.DB.prepare(`INSERT INTO tai_san (id,loai,ten,mo_ta,media_url,media_type,muc_id,noi_dung_id,nguon,created_at,created_by_name) VALUES (?,'FOOTAGE',?,?,?,'VIDEO',?,?,'MAY',?,?)`).bind(tsId, ten, chuoi(x.hinh,120)+(x.loi_noi?(' · nói: '+chuoi(x.loi_noi,200)):''), mediaUrl, nd.muc_id, nd.id, nowISO(), chuoi(d.may,60)||'máy ghép').run();
        const mauId=await ghiMauAI(env,{tinh_nang:'loc_footage', mo_hinh_id:null, doi_tuong:'noi_dung', doi_tuong_id:nd.id, dau_vao:{k:so(x.k), label:chuoi(x.label,60), hinh:chuoi(x.hinh,200), text:chuoi(x.text,300), tai_san_goc:chuoi(x.tai_san_goc,40), tu:so(x.tu), den:so(x.den), loi_noi:chuoi(x.loi_noi,300), diem:so(x.diem)}, dau_ra:{tai_san_id:tsId}, dau_ra_mo:{tai_san_id:tsId}, mo_hinh_mo_id:'clip-vit-b16'}); ra.push({k:so(x.k), label:chuoi(x.label,60), hinh:chuoi(x.hinh,200), tai_san_id:tsId, tu:so(x.tu), den:so(x.den), loi_noi:chuoi(x.loi_noi,200), diem:so(x.diem), mau_id:mauId}); }
      await env.DB.prepare(`UPDATE noi_dung SET chi_tiet=?, updated_at=? WHERE id=?`).bind(JSON.stringify(lamSachChiTiet({...docJSON(nd.chi_tiet,{}), loc_de_xuat:JSON.stringify(ra).slice(0,5000), loc_luc:nowISO(), loc_ghi_chu:chuoi(d.ghi_chu,300)})), nowISO(), nd.id).run();
      if(ra.length && !(await env.DB.prepare(`SELECT id FROM cong_viec WHERE loai='DUYET_LOC_FOOTAGE' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nd.id).first())) await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'DUYET_LOC_FOOTAGE','Giữ/bỏ '+ra.length+' đoạn máy cắt: '+(nd.tieu_de||nd.hook||'').slice(0,50),'noi_dung',nd.id,'MARKETING',ngayVN(Date.now()+2*864e5),chuoi(d.may,60)||'máy ghép','Thẻ › Sản xuất › Đoạn máy đề xuất — mỗi ✓/✗ là mẫu học lọc footage',nowISO()).run();
      moi+=ra.length; } }
  else if(bang==='content_os.seeding_dang_ket_qua'){ const r=await napSeedingDang(env, dong); cap+=r.cap; loi.push(...r.loi); }
  else if(bang==='content_os.seeding_kiem'){ const r=await napSeedingKiem(env, dong); cap+=r.cap; loi.push(...r.loi); }
  else if(bang==='content_os.seeding_binh_luan_ket_qua'){ const r=await napBinhLuan(env, dong); cap+=r.cap; loi.push(...r.loi); }
  else if(bang==='content_os.seeding_nuoi_ket_qua'){ const r=await napNuoi(env, dong); cap+=r.cap; }
  else if(bang==='zalo.tin'){ const r=await napZaloTin(env, dong); cap+=r.cap; }
  // content_os.ket_qua (số đo) và bảng khác: giữ nguyên lô trong tram_lo — ADR-005 (đo lường) đọc từ đây
  await env.DB.prepare(`INSERT INTO tram_lo (id,viec,bang,luot,phan,so_dong,xu_ly,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(uid('lo'), chuoi(b.viec,60), bang, chuoi(b.luot,40), JSON.stringify(b.phan||{}), dong.length, JSON.stringify({moi,cap_nhat:cap,loi:loi.slice(0,10), dong: ['content_os.ket_qua'].includes(bang)?dong:undefined}).slice(0,60000), nowISO()).run();
  await env.DB.prepare(`DELETE FROM tram_lo WHERE id NOT IN (SELECT id FROM tram_lo ORDER BY created_at DESC LIMIT 500)`).run();
  return {ok:true, moi, cap_nhat:cap, loi};
}
// Máy đăng bài tới giờ (B9). B9 NGƯỜI → giao việc đăng tay khi tới giờ. Chạy mỗi 15'. Cách TRAM → giao Trạm (agent content_os/dang) đăng bằng trình duyệt đã đăng nhập.
async function chayDangBai(env){
  const due=(await env.DB.prepare(`SELECT * FROM bai_dang WHERE trang_thai='DA_LEN_LICH' AND gio_dang<=? ORDER BY gio_dang LIMIT 20`).bind(nowISO()).all()).results; if(!due.length) return {bo_qua:'Không có bài tới giờ'};
  const b9=await mucBuoc(env,'B9'); let dang=0, giao=0, loi=0; const ct=[]; let giaoTram=0;
  for(const bd of due){ const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(bd.noi_dung_id).first(); const kenh=bd.kenh_id?await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(bd.kenh_id).first():null; if(!nd||!kenh){ loi++; continue; }
    const giaoTay=async(lyDo)=>{ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='CHUAN_BI', loi=?, updated_at=? WHERE id=?`).bind(lyDo, nowISO(), bd.id).run();
      await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'DANG_TAY','Đăng tay: '+(nd.tieu_de||nd.hook).slice(0,80)+' → '+kenh.ten,'bai_dang',bd.id,'MARKETING',ngayVN(),'Máy',lyDo,nowISO()).run(); giao++; };
    if(bd.cach==='TAY' || b9.nguoi_thuc_hien==='NGUOI'){ await giaoTay(bd.cach==='TAY'?'Kênh đăng tay — tới giờ đăng':'Bước B9 đang do người làm — tới giờ đăng'); continue; }
    if(bd.cach==='TRAM'){ const tt=await docTramTrangThai(env); if(!tt||!tt.song){ await giaoTay('Trạm máy văn phòng đang im (không nhịp tim) — đăng tay'); continue; }
      await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DANG_GUI', loi=NULL, updated_at=? WHERE id=?`).bind(nowISO(), bd.id).run(); await taoLenhTram(env,'chay_agent',{id:'content_os', viec:'dang'}, MAY('Máy (B9)')); giaoTram++; ct.push(bd.id+': giao Trạm'); continue; }
    const r= bd.cach==='N8N' ? await dangN8n(env,bd,nd,kenh) : await dangFacebook(env,kenh,bd,nd);
    if(r.ok&&r.cho_callback){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DANG_GUI', updated_at=? WHERE id=?`).bind(nowISO(), bd.id).run(); ct.push(bd.id+': gửi n8n'); continue; }
    if(r.ok){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DA_DANG', link=?, posted_at=?, loi=NULL, updated_at=? WHERE id=?`).bind(r.link||'', nowISO(), nowISO(), bd.id).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DANG', 'máy đăng qua API', MAY('Máy (B9)')); dang++; ct.push(bd.id+': đã đăng'); }
    else { const lan=so(bd.lan_thu)+1; if(lan>=3){ await giaoTay('API lỗi 3 lần: '+r.loi); await env.DB.prepare(`UPDATE bai_dang SET lan_thu=? WHERE id=?`).bind(lan, bd.id).run(); } else await env.DB.prepare(`UPDATE bai_dang SET trang_thai='LOI', lan_thu=?, loi=?, updated_at=? WHERE id=?`).bind(lan, r.loi, nowISO(), bd.id).run(); loi++; ct.push(bd.id+': lỗi '+r.loi); }
  }
  return { ok:true, doc:due.length, ghi:dang+giao+giaoTram, tom_tat:'Tới giờ '+due.length+' bài: đăng '+dang+' · giao Trạm '+giaoTram+' · giao đăng tay '+giao+' · lỗi '+loi, chi_tiet:{ct} };
}

// ============================================================
//  ADR-005 — ĐO LƯỜNG (B10) · BÁO CÁO (B11) · HỌC & ĐỀ XUẤT (B12, cổng G4)
// ============================================================
const MUC_TIN_CAY={ TRUC_TIEP:'Trực tiếp', GIAN_TIEP:'Gián tiếp', KHONG_QUY_DON:'Không quy đơn' };
const NGUON_KQ=['API_KENH','TRAM','SAN','NHAP_TAY','NGOAI'];
const KPI=['tiep_can','luot_xem','tuong_tac','chia_se','binh_luan','luu','click'];
const soAn=v=>{ const n=Number(v); return Number.isFinite(n)&&n>0?Math.round(n):0; };
// Nhận diện bài từ link đã đăng → {nen, id, loai}; không nhận diện được → null (không đoán)
function layIdBaiTuLink(link){ const s=String(link||'').trim(); if(!s) return null; let u; try{ u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s); }catch(e){ return null; }
  const host=u.hostname.replace(/^www\.|^m\.|^web\./,'').toLowerCase(); const p=u.pathname; const q=u.searchParams;
  if(/(^|\.)youtube\.com$/.test(host)||host==='youtu.be'){ const id=host==='youtu.be'?p.split('/')[1]:(q.get('v')||(p.match(/^\/(shorts|live|embed)\/([\w-]{6,})/)||[])[2]); return id?{nen:'YOUTUBE', id, loai:'video'}:null; }
  if(/(^|\.)facebook\.com$/.test(host)||host==='fb.watch'||host==='fb.com'){ let m; if((m=p.match(/\/(videos|reel|reels)\/(\d+)/))) return {nen:'FACEBOOK', id:m[2], loai:'video'}; if((m=p.match(/\/posts\/(pfbid[\w]+|\d+)/))) return {nen:'FACEBOOK', id:m[1], loai:'post'}; if((m=p.match(/\/photos\/[^/]*\/(\d+)/))) return {nen:'FACEBOOK', id:m[1], loai:'post'}; if(q.get('story_fbid')) return {nen:'FACEBOOK', id:q.get('story_fbid'), loai:'post'}; if(q.get('v')) return {nen:'FACEBOOK', id:q.get('v'), loai:'video'}; if(q.get('fbid')) return {nen:'FACEBOOK', id:q.get('fbid'), loai:'post'}; if(host==='fb.watch'&&p.length>1) return {nen:'FACEBOOK', id:p.slice(1).replace(/\/$/,''), loai:'video'}; if(/^\/\d+_\d+/.test(p)) return {nen:'FACEBOOK', id:p.slice(1).split('/')[0], loai:'post'}; return null; }
  if(/(^|\.)tiktok\.com$/.test(host)){ const m=p.match(/\/video\/(\d+)/); return m?{nen:'TIKTOK', id:m[1], loai:'video'}:null; }
  return null; }
async function doFacebook(env, kenh, bai){ const token=layToken(env,kenh); if(!token) return {ok:false, loi:'Chưa cắm secret TOKEN_'+(kenh.api_ma||'?')}; const pageId=chuoi(kenh.api_object_id,80);
  const obj=(bai.loai==='post'&&/^\d+$/.test(bai.id)&&pageId&&!bai.id.includes('_'))?pageId+'_'+bai.id:bai.id;
  const fields=bai.loai==='video'?'video_insights.metric(total_video_impressions,total_video_views){name,values},likes.summary(true).limit(0),comments.summary(true).limit(0)':'insights.metric(post_impressions,post_impressions_unique,post_engaged_users,post_clicks){name,values},likes.summary(true).limit(0),comments.summary(true).limit(0),shares';
  let r,j; try{ r=await fetch('https://graph.facebook.com/'+GRAPH_VER+'/'+encodeURIComponent(obj)+'?fields='+encodeURIComponent(fields)+'&access_token='+encodeURIComponent(token)); j=await r.json().catch(()=>({})); }catch(e){ return {ok:false, loi:'Không gọi được Graph API: '+e.message}; }
  if(!r.ok||j.error) return {ok:false, loi:'Graph API: '+((j.error&&j.error.message)||('HTTP '+r.status))};
  const m={}; ((j.insights||j.video_insights||{}).data||[]).forEach(x=>{ const v=(x.values||[])[0]; m[x.name]=typeof (v&&v.value)==='object'?Object.values(v.value).reduce((s,n)=>s+(Number(n)||0),0):Number(v&&v.value)||0; });
  const likes=soAn(j.likes&&j.likes.summary&&j.likes.summary.total_count), cmts=soAn(j.comments&&j.comments.summary&&j.comments.summary.total_count), shares=soAn(j.shares&&j.shares.count);
  return {ok:true, tich_luy:{ tiep_can:soAn(m.post_impressions_unique!=null?m.post_impressions_unique:m.total_video_impressions), luot_xem:soAn(m.post_impressions!=null?m.post_impressions:m.total_video_views), tuong_tac:m.post_engaged_users!=null?soAn(m.post_engaged_users):(likes+cmts+shares), chia_se:shares, binh_luan:cmts, luu:0, click:soAn(m.post_clicks) }, raw:{...m, likes, comments:cmts, shares}}; }
async function doYouTube(env, bai){ const key=env.YOUTUBE_API_KEY; if(!key) return {ok:false, loi:'Chưa cắm YOUTUBE_API_KEY'}; let r,j; try{ r=await fetch('https://www.googleapis.com/youtube/v3/videos?part=statistics&id='+encodeURIComponent(bai.id)+'&key='+encodeURIComponent(key)); j=await r.json().catch(()=>({})); }catch(e){ return {ok:false, loi:'YouTube: '+e.message}; }
  if(!r.ok) return {ok:false, loi:'YouTube API: HTTP '+r.status}; const st=((j.items||[])[0]||{}).statistics; if(!st) return {ok:false, loi:'YouTube không thấy video'}; return {ok:true, tich_luy:{ tiep_can:0, luot_xem:soAn(st.viewCount), tuong_tac:soAn(st.likeCount)+soAn(st.commentCount), chia_se:0, binh_luan:soAn(st.commentCount), luu:0, click:0 }, raw:st}; }
const GRAPH_VER='v21.0';
// Ghi 1 dòng/ngày/nguồn cho bài từ số TÍCH LUỸ: lưu phần tăng so với dòng cùng nguồn gần nhất trước ngày đó; đo lại trong ngày = thay dòng. Xong → mục DA_DO.
async function ghiKetQuaTichLuy(env, bd, nguon, tl, ky, meta){
  const truoc=await env.DB.prepare(`SELECT ghi_chu FROM ket_qua WHERE bai_dang_id=? AND nguon=? AND ky<? ORDER BY ky DESC LIMIT 1`).bind(bd.id, nguon, ky).first();
  const cu=(docJSON(truoc&&truoc.ghi_chu,{}).tich_luy)||{}; const tang={}; KPI.forEach(k=>tang[k]=Math.max(0, soAn(tl[k])-soAn(cu[k])));
  await env.DB.prepare(`DELETE FROM ket_qua WHERE bai_dang_id=? AND nguon=? AND ky=?`).bind(bd.id, nguon, ky).run();
  await env.DB.prepare(`INSERT INTO ket_qua (id,bai_dang_id,muc_id,muc_tin_cay,nguon,ky,tiep_can,luot_xem,tuong_tac,chia_se,binh_luan,luu,click,so_don,doanh_thu,ma_theo_doi,ghi_chu,created_at,created_by_name) VALUES (?,?,?,'KHONG_QUY_DON',?,?,?,?,?,?,?,?,?,0,0,?,?,?,?)`)
    .bind(uid('kq'), bd.id, bd.muc_id, nguon, ky, tang.tiep_can, tang.luot_xem, tang.tuong_tac, tang.chia_se, tang.binh_luan, tang.luu, tang.click, bd.ma_theo_doi||'', JSON.stringify({...meta, tich_luy:Object.fromEntries(KPI.map(k=>[k,soAn(tl[k])]))}).slice(0,3000), nowISO(), (meta&&meta.boi)||'Máy').run();
  await datGiaiDoan(env, bd.muc_id, 'DA_DO', 'có số đo', MAY((meta&&meta.boi)||'Máy (B10)')); return tang; }
// Agent đo lường: Graph/YouTube cho bài có link & kênh có token/key; số Trạm gửi (tram_lo content_os.ket_qua) chưa xử lý → ghi cùng luật
async function chayDoLuong(env){
  const cfg=(await docCauHinh(env)).do_luong||{}; const tu=new Date(Date.now()-Math.max(1,so(cfg.so_ngay_do,30))*864e5).toISOString(); const hn=ngayVN();
  const ds=(await env.DB.prepare(`SELECT * FROM bai_dang WHERE trang_thai='DA_DANG' AND COALESCE(link,'')<>'' AND COALESCE(posted_at,updated_at)>=? ORDER BY posted_at DESC LIMIT 200`).bind(tu).all()).results;
  const kenhMap={}; (await env.DB.prepare(`SELECT * FROM kenh`).all()).results.forEach(k=>kenhMap[k.id]=k);
  let doApi=0, boQua=0, loi=0, doTram=0; const ct=[];
  for(const bd of ds){ const b=layIdBaiTuLink(bd.link); if(!b||b.nen==='TIKTOK'){ boQua++; continue; } const r=b.nen==='FACEBOOK'?await doFacebook(env, kenhMap[bd.kenh_id]||{}, b):await doYouTube(env, b);
    if(!r.ok){ loi++; ct.push({bai:bd.id, loi:r.loi}); continue; } await ghiKetQuaTichLuy(env, bd, 'API_KENH', r.tich_luy, hn, {api:b.nen, raw:r.raw, boi:'Máy (B10)'}); doApi++; }
  // lô Trạm
  const lo=(await env.DB.prepare(`SELECT * FROM tram_lo WHERE bang='content_os.ket_qua' ORDER BY created_at LIMIT 50`).all()).results;
  for(const l of lo){ const x=docJSON(l.xu_ly,{}); if(x.da_xu_ly) continue; let n=0; for(const d of (x.dong||[])){ const bd=d.bai_dang_id?await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(String(d.bai_dang_id)).first():null; if(!bd||!d.tich_luy) continue; await ghiKetQuaTichLuy(env, bd, 'TRAM', d.tich_luy, laNgay(d.ngay)?d.ngay:hn, {api:chuoi(d.nen,20)||'TRAM', boi:'Trạm'}); n++; doTram++; }
    await env.DB.prepare(`UPDATE tram_lo SET xu_ly=? WHERE id=?`).bind(JSON.stringify({...x, dong:undefined, da_xu_ly:true, ghi:n}), l.id).run(); }
  if(!ds.length&&!doTram) return {bo_qua:'Không có bài đã đăng có link để đo'};
  return { ok:true, doc:ds.length, ghi:doApi+doTram, tom_tat:'Đo '+doApi+' bài qua API · '+doTram+' số từ Trạm · bỏ qua '+boQua+' (không API) · lỗi '+loi, chi_tiet:{loi:ct.slice(0,10)} };
}
// ----- Báo cáo: số liệu thuần (không AI) + nhận định (AI khi có, không thì luật) -----
const tuanISO=d=>{ const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); const day=x.getUTCDay()||7; x.setUTCDate(x.getUTCDate()+4-day); const y=new Date(Date.UTC(x.getUTCFullYear(),0,1)); return x.getUTCFullYear()+'-W'+String(Math.ceil(((x-y)/864e5+1)/7)).padStart(2,'0'); };
async function soLieuBaoCao(env, tu, den){
  const all=async(s,...a)=>(await env.DB.prepare(s).bind(...a).all()).results;
  const kq=await all(`SELECT k.*, m.muc_tieu, m.pillar_id, m.dinh_dang, m.kenh_id FROM ket_qua k LEFT JOIN muc_noi_dung m ON m.id=k.muc_id WHERE k.ky>=? AND k.ky<=?`, ngayVN(Date.parse(tu)), ngayVN(Date.parse(den)));   // ky là ngày VN — so bằng ngày VN, không dùng ngày UTC (lệch 0–7h sáng)
  const bai=await all(`SELECT b.*, m.muc_tieu, m.pillar_id, m.dinh_dang FROM bai_dang b LEFT JOIN muc_noi_dung m ON m.id=b.muc_id WHERE b.posted_at>=? AND b.posted_at<=?`, tu, den);
  const muc=await all(`SELECT giai_doan, COUNT(*) n FROM muc_noi_dung GROUP BY giai_doan`); const pillars=await all(`SELECT id,ten,ty_trong,muc_tieu FROM pillars WHERE active=1`);
  const sum=(arr,f)=>arr.reduce((s,x)=>s+(Number(x[f])||0),0); const muc3=m=>kq.filter(k=>k.muc_tin_cay===m);
  const nhom=(key)=>{ const r={}; kq.filter(k=>k.muc_tin_cay==='KHONG_QUY_DON').forEach(k=>{ const g=k[key]||'—'; r[g]=r[g]||{bai:new Set(),tiep_can:0,luot_xem:0,tuong_tac:0,chia_se:0}; r[g].bai.add(k.bai_dang_id); KPI.slice(0,4).forEach(f=>r[g][f]+=Number(k[f])||0); }); return Object.fromEntries(Object.entries(r).map(([g,v])=>[g,{...v, bai:v.bai.size}])); };
  const theoBai={}; kq.forEach(k=>{ theoBai[k.bai_dang_id]=theoBai[k.bai_dang_id]||{luot_xem:0,tuong_tac:0,so_don:0,doanh_thu:0}; ['luot_xem','tuong_tac','so_don','doanh_thu'].forEach(f=>theoBai[k.bai_dang_id][f]+=Number(k[f])||0); });
  const top=Object.entries(theoBai).sort((a,b)=>b[1].luot_xem-a[1].luot_xem).slice(0,5).map(([id,v])=>{ const b=bai.find(x=>x.id===id); return {bai_dang_id:id, tieu_de:b?(b.noi_dung_dang||'').slice(0,60):id, ...v}; });
  const ket=await all(`SELECT (SELECT COUNT(*) FROM duyet WHERE trang_thai='CHO' AND created_at<?) duyet_qua_24h, (SELECT COUNT(*) FROM bai_dang WHERE trang_thai='LOI') bai_loi, (SELECT COUNT(*) FROM cong_viec WHERE trang_thai='MO' AND han<?) viec_qua_han`, new Date(Date.now()-864e5).toISOString(), ngayVN());
  const ai=await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd FROM ai_usage WHERE at>=? AND at<=?`).bind(tu,den).first();
  return { tu, den, bai_dang:bai.length, bai_theo_muc_tieu:{BRAND:bai.filter(b=>b.muc_tieu==='BRAND').length, BAN_HANG:bai.filter(b=>b.muc_tieu==='BAN_HANG').length},
    ba_muc:{ TRUC_TIEP:{doanh_thu:sum(muc3('TRUC_TIEP'),'doanh_thu'), so_don:sum(muc3('TRUC_TIEP'),'so_don'), n:muc3('TRUC_TIEP').length}, GIAN_TIEP:{doanh_thu:sum(muc3('GIAN_TIEP'),'doanh_thu'), so_don:sum(muc3('GIAN_TIEP'),'so_don'), n:muc3('GIAN_TIEP').length}, KHONG_QUY_DON:Object.fromEntries(KPI.map(f=>[f,sum(muc3('KHONG_QUY_DON'),f)])) },
    theo_pillar:nhom('pillar_id'), theo_dinh_dang:nhom('dinh_dang'), theo_kenh:nhom('kenh_id'), theo_muc_tieu:nhom('muc_tieu'), top, giai_doan:Object.fromEntries(muc.map(x=>[x.giai_doan,x.n])), ket:ket[0]||{}, ai_usd:so(ai&&ai.usd), pillars };
}
function nhanDinhLuat(sl){ const kq=sl.ba_muc.KHONG_QUY_DON; const c=[]; c.push('Kỳ '+sl.tu.slice(0,10)+' → '+sl.den.slice(0,10)+': đăng '+sl.bai_dang+' bài ('+sl.bai_theo_muc_tieu.BRAND+' brand · '+sl.bai_theo_muc_tieu.BAN_HANG+' bán hàng).');
  c.push('Brand: '+kq.tiep_can.toLocaleString('vi-VN')+' tiếp cận · '+kq.luot_xem.toLocaleString('vi-VN')+' lượt xem · '+kq.chia_se.toLocaleString('vi-VN')+' chia sẻ · '+kq.tuong_tac.toLocaleString('vi-VN')+' tương tác (không quy đơn).');
  c.push('Bán hàng: trực tiếp '+sl.ba_muc.TRUC_TIEP.so_don+' đơn / '+sl.ba_muc.TRUC_TIEP.doanh_thu.toLocaleString('vi-VN')+' đ · gián tiếp '+sl.ba_muc.GIAN_TIEP.so_don+' đơn / '+sl.ba_muc.GIAN_TIEP.doanh_thu.toLocaleString('vi-VN')+' đ — hai mức không cộng dồn.');
  const p=Object.entries(sl.theo_pillar).filter(([g])=>g!=='—').map(([g,v])=>[(sl.pillars.find(x=>x.id===g)||{}).ten||g, v.bai?Math.round(v.luot_xem/v.bai):0]).sort((a,b)=>b[1]-a[1]); if(p.length) c.push('Xem/bài theo pillar: '+p.map(([t,n])=>t+' '+n).join(' · ')+'.');
  if(sl.top.length) c.push('Bài xem nhiều nhất: "'+sl.top[0].tieu_de+'" ('+sl.top[0].luot_xem.toLocaleString('vi-VN')+' xem).');
  const viec=[]; if(so(sl.ket.duyet_qua_24h)) viec.push('Duyệt '+sl.ket.duyet_qua_24h+' bài chờ quá 24h (G3)'); if(so(sl.ket.bai_loi)) viec.push('Xử lý '+sl.ket.bai_loi+' bài đăng lỗi'); if(so(sl.ket.viec_qua_han)) viec.push('Đóng '+sl.ket.viec_qua_han+' việc quá hạn'); if(!sl.bai_dang) viec.push('Chưa có bài đăng nào trong kỳ — xem lại kế hoạch tuần');
  return { nhan_dinh:c.join(' '), viec_can_lam:viec.slice(0,3) }; }
async function nhanDinhAI(env, sl, baoCaoId=null){ const r=await goiAI(env,{ ngu_canh:{loai:'bao_cao', bao_cao_id:baoCaoId}, system:'Bạn là trưởng phòng marketing của Kingsmen (keo ron gạch). Viết nhận định báo cáo NGẮN (5–7 câu, tiếng Việt, số cụ thể, không tô hồng) từ số liệu JSON và đề nghị đúng 3 việc cần làm tuần tới. Ba mức tin cậy kết quả (trực tiếp / gián tiếp / không quy đơn) KHÔNG được cộng dồn; nội dung brand đánh giá bằng tiếp cận/xem/chia sẻ, nội dung bán hàng bằng đơn. CHỈ trả JSON {"nhan_dinh":"...","viec_can_lam":["...","...","..."]}.', messages:[{role:'user',content:JSON.stringify({...sl, pillars:undefined, top:sl.top.slice(0,3)}).slice(0,12000)}], max_tokens:700, tinh_nang:'bao_cao' });
  if(!r.ok) return null; try{ const t=r.text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,''); const o=JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}')+1)); return { nhan_dinh:chuoi(o.nhan_dinh,3000), viec_can_lam:(Array.isArray(o.viec_can_lam)?o.viec_can_lam:[]).map(x=>chuoi(x,200)).filter(Boolean).slice(0,3) }; }catch(e){ return null; } }
async function taoBaoCao(env, loai, {ep=false}={}){
  const now=new Date(Date.now()+7*36e5); let ky, tu, den;
  if(loai==='THANG'){ const th=thangSau(thangHienTai(),-1); ky=th; tu=th+'-01T00:00:00.000Z'; den=thangHienTai()+'-01T00:00:00.000Z'; }
  else { const t2=new Date(now); t2.setUTCDate(t2.getUTCDate()-((t2.getUTCDay()||7)-1)); const tuD=new Date(t2); tuD.setUTCDate(tuD.getUTCDate()-7); ky=tuanISO(tuD); tu=tuD.toISOString().slice(0,10)+'T00:00:00.000Z'; den=t2.toISOString().slice(0,10)+'T00:00:00.000Z'; }
  const cu=await env.DB.prepare(`SELECT id FROM bao_cao WHERE loai=? AND ky=?`).bind(loai,ky).first(); if(cu&&!ep) return {bo_qua:'Đã có báo cáo '+loai+' '+ky};
  const id=cu?cu.id:uid('bc');
  const sl=await soLieuBaoCao(env, tu, den); const b11=await mucBuoc(env,'B11'); const luat=nhanDinhLuat(sl); const ai=(b11.nguoi_thuc_hien!=='NGUOI')?await nhanDinhAI(env, sl, id):null; const nd=ai||luat; if(cu) await env.DB.prepare(`DELETE FROM bao_cao WHERE id=?`).bind(cu.id).run();
  await env.DB.prepare(`INSERT INTO bao_cao (id,loai,ky,tu,den,so_lieu,nhan_dinh,nhan_dinh_may,viec_can_lam,trang_thai,tao_boi,created_at) VALUES (?,?,?,?,?,?,?,?,?,'NHAP',?,?)`).bind(id, loai, ky, tu, den, JSON.stringify(sl).slice(0,60000), nd.nhan_dinh, nd.nhan_dinh, JSON.stringify(nd.viec_can_lam), ai?'Máy (AI)':'Máy (luật)', nowISO()).run();
  let gui=null; if(b11.nguoi_thuc_hien==='AI_TU_LAM'){ gui=await guiBaoCao(env, id, MAY('Máy (B11)')); }
  return { ok:true, id, ky, ghi:1, tom_tat:'Báo cáo '+(loai==='THANG'?'tháng':'tuần')+' '+ky+': '+sl.bai_dang+' bài · '+(ai?'AI nhận định':'nhận định theo luật')+(gui?(' · '+gui.tom_tat):''), chi_tiet:{ky, tu, den, ai:!!ai} };
}
async function guiBaoCao(env, id, tacNhan){ const bc=await env.DB.prepare(`SELECT * FROM bao_cao WHERE id=?`).bind(id).first(); if(!bc) return {ok:false, loi:'Không thấy báo cáo'}; const cfg=(await docCauHinh(env)).bao_cao||{}; const qua=['app'];
  if(cfg.gui_n8n!==false && env.N8N_WEBHOOK_URL){ try{ const r=await fetch(env.N8N_WEBHOOK_URL,{method:'POST', headers:{'content-type':'application/json', ...(env.N8N_TOKEN?{'X-App-Token':env.N8N_TOKEN}:{})}, body:JSON.stringify({loai:'BAO_CAO', bao_cao_id:bc.id, ky:bc.ky, kieu:bc.loai, tieu_de:'Báo cáo '+(bc.loai==='THANG'?'tháng':'tuần')+' '+bc.ky+' — Kingsmen Content OS', nhan_dinh:bc.nhan_dinh, viec_can_lam:docJSON(bc.viec_can_lam,[]), so_lieu:docJSON(bc.so_lieu,{}), kenh:['zalo','email']})}); qua.push(r.ok?'n8n':'n8n_loi_'+r.status); }catch(e){ qua.push('n8n_loi'); } }
  // mẫu học B11: người gửi mà không sửa nhận định máy = 1; sửa = độ giống văn bản
  if(!tacNhan.agent) await ghiMauHoc(env,'B11',{doi_tuong_id:bc.id, dau_vao:{ky:bc.ky}, dau_ra_may:{nhan_dinh:bc.nhan_dinh_may}, dau_ra_nguoi:{nhan_dinh:bc.nhan_dinh}, giong:giongVanBan(bc.nhan_dinh_may, bc.nhan_dinh), ghi_chu:'gửi báo cáo'});
  await env.DB.prepare(`UPDATE bao_cao SET trang_thai='DA_GUI', gui_qua=?, gui_at=?, gui_boi=? WHERE id=?`).bind(JSON.stringify(qua), nowISO(), tacNhan.ho_ten, id).run(); await logAudit(env, tacNhan, 'gửi báo cáo', 'bao_cao', id, qua.join(','));
  return {ok:true, tom_tat:'gửi qua '+qua.join(' + ')}; }
// ----- Học & đề xuất (B12): so nhóm với trung bình, chỉ khi đủ mẫu; đề xuất kèm bằng chứng; người duyệt (G4) → máy áp -----
async function chayDeXuat(env, {ep=false}={}){
  const cfg=(await docCauHinh(env)).hoc||{}; const minMau=Math.max(2,so(cfg.min_mau,5)), lech=Math.max(5,so(cfg.lech_toi_thieu_pct,25))/100, buoc=Math.max(1,Math.min(30,so(cfg.buoc_doi_ty_trong,10)));
  const den=new Date().toISOString(); const tu=new Date(Date.now()-90*864e5).toISOString(); const sl=await soLieuBaoCao(env, tu, den); const ky=thangSau(thangHienTai(),-1);
  const cu=await env.DB.prepare(`SELECT COUNT(*) n FROM de_xuat WHERE ky=?`).bind(ky).first(); if(so(cu&&cu.n)&&!ep) return {bo_qua:'Tháng '+ky+' đã có đề xuất'};
  const ds=[]; const tb=(nh)=>{ const v=Object.values(nh).filter(x=>x.bai>0); const b=v.reduce((s,x)=>s+x.bai,0); return b?v.reduce((s,x)=>s+x.luot_xem,0)/b:0; };
  // pillar: xem/bài lệch ≥ lech% so trung bình & ≥ min_mau bài → dịch tỷ trọng buoc điểm
  const tbP=tb(sl.theo_pillar); const pl=sl.pillars; const manh=[], yeu=[];
  for(const p of pl){ const v=sl.theo_pillar[p.id]; if(!v||v.bai<minMau||!tbP) continue; const r=(v.luot_xem/v.bai)/tbP; if(r>=1+lech) manh.push({p, r, v}); else if(r<=1-lech) yeu.push({p, r, v}); }
  if(manh.length&&yeu.length){ const m=manh.sort((a,b)=>b.r-a.r)[0], y=yeu.sort((a,b)=>a.r-b.r)[0]; const b=Math.min(buoc, so(y.p.ty_trong)); if(b>0) ds.push({ loai:'TY_TRONG_PILLAR', tieu_de:'Tăng pillar '+m.p.ten+' '+so(m.p.ty_trong)+'% → '+(so(m.p.ty_trong)+b)+'%, giảm '+y.p.ten+' '+so(y.p.ty_trong)+'% → '+(so(y.p.ty_trong)-b)+'%', noi_dung:{tang:m.p.id, giam:y.p.id, buoc:b}, bang_chung:{ky:'90 ngày', [m.p.ten]:{bai:m.v.bai, xem_moi_bai:Math.round(m.v.luot_xem/m.v.bai)}, [y.p.ten]:{bai:y.v.bai, xem_moi_bai:Math.round(y.v.luot_xem/y.v.bai)}, trung_binh:Math.round(tbP)}, ly_do:m.p.ten+' đạt '+m.r.toFixed(1)+'× xem/bài so trung bình, '+y.p.ten+' chỉ '+y.r.toFixed(1)+'× (mỗi nhóm ≥ '+minMau+' bài)' }); }
  // định dạng: nhóm mạnh nhất/yếu nhất
  const tbD=tb(sl.theo_dinh_dang); const dd=Object.entries(sl.theo_dinh_dang).filter(([g,v])=>g!=='—'&&v.bai>=minMau&&tbD).map(([g,v])=>({g, r:(v.luot_xem/v.bai)/tbD, v})).sort((a,b)=>b.r-a.r);
  if(dd.length>=2&&dd[0].r>=1+lech) ds.push({ loai:'DINH_DANG', tieu_de:'Ưu tiên định dạng '+dd[0].g+' (xem/bài '+dd[0].r.toFixed(1)+'× trung bình), giảm '+dd[dd.length-1].g, noi_dung:{tang:dd[0].g, giam:dd[dd.length-1].g}, bang_chung:Object.fromEntries(dd.map(x=>[x.g,{bai:x.v.bai, xem_moi_bai:Math.round(x.v.luot_xem/x.v.bai)}])), ly_do:'Cơ cấu định dạng tháng sau nên nghiêng về '+dd[0].g });
  // giờ đăng: xem/bài theo khung giờ (bài có posted_at)
  const gio={}; const bai=(await env.DB.prepare(`SELECT b.id, b.posted_at FROM bai_dang b WHERE b.trang_thai='DA_DANG' AND b.posted_at>=?`).bind(tu).all()).results; const xemBai={}; sl.top.forEach(()=>{}); (await env.DB.prepare(`SELECT bai_dang_id, SUM(luot_xem) x FROM ket_qua WHERE ky>=? GROUP BY bai_dang_id`).bind(tu.slice(0,10)).all()).results.forEach(r=>xemBai[r.bai_dang_id]=so(r.x));
  bai.forEach(b=>{ const h=Math.floor(((new Date(b.posted_at).getUTCHours()+7)%24)/3)*3; const k=String(h).padStart(2,'0')+'–'+String(h+3).padStart(2,'0')+'h'; gio[k]=gio[k]||{bai:0,xem:0}; gio[k].bai++; gio[k].xem+=xemBai[b.id]||0; });
  const g=Object.entries(gio).filter(([,v])=>v.bai>=minMau).map(([k,v])=>({k, tb:v.xem/v.bai, v})).sort((a,b)=>b.tb-a.tb); const tbG=g.length?g.reduce((s,x)=>s+x.v.xem,0)/g.reduce((s,x)=>s+x.v.bai,0):0;
  if(g.length>=2&&tbG&&g[0].tb/tbG>=1+lech) ds.push({ loai:'GIO_DANG', tieu_de:'Đăng vào khung '+g[0].k+' (xem/bài '+(g[0].tb/tbG).toFixed(1)+'× trung bình)', noi_dung:{khung:g[0].k}, bang_chung:Object.fromEntries(g.map(x=>[x.k,{bai:x.v.bai, xem_moi_bai:Math.round(x.tb)}])), ly_do:'Khung giờ '+g[0].k+' cho xem/bài cao nhất trên '+g[0].v.bai+' bài' });
  for(const d of ds) await env.DB.prepare(`INSERT INTO de_xuat (id,ky,loai,tieu_de,noi_dung,bang_chung,ly_do,trang_thai,created_at) VALUES (?,?,?,?,?,?,?,'CHO',?)`).bind(uid('dx'), ky, d.loai, d.tieu_de, JSON.stringify(d.noi_dung), JSON.stringify(d.bang_chung), d.ly_do, nowISO()).run();
  if(!ds.length) return {ok:true, ghi:0, tom_tat:'Chưa đủ bằng chứng (mỗi nhóm cần ≥ '+minMau+' bài và lệch ≥ '+Math.round(lech*100)+'%) — không đề xuất'};
  return {ok:true, ghi:ds.length, tom_tat:'Đề xuất '+ds.length+' cải tiến cho G4: '+ds.map(d=>d.loai).join(', ')}; }
async function apDungDeXuat(env, d, me){ const nd=docJSON(d.noi_dung,{}); const ap={};
  if(d.loai==='SEEDING_NHOM'&&nd.tat){ await env.DB.prepare(`UPDATE nhom_seeding SET active=0 WHERE id=?`).bind(nd.nhom_id).run(); ap.nhom_tat=nd.nhom_id; ap.ghi_chu='đã tắt nhóm seeding'; return ap; }
  if(d.loai==='SEEDING_GIONG'){ await datCauHinh(env,'seeding',{giong_uu_tien:nd.giong_uu_tien}, me.ho_ten); ap.giong_uu_tien=nd.giong_uu_tien; ap.ghi_chu='máy sẽ xếp tài khoản giọng này trước'; return ap; }
  if(d.loai==='SEEDING_NHIP'){ await env.DB.prepare(`UPDATE nhom_seeding SET nhip_tuan=? WHERE id=?`).bind(Math.max(1,Math.min(7,so(nd.nhip_tuan))), nd.nhom_id).run(); ap.nhip_tuan=so(nd.nhip_tuan); ap.ghi_chu='đã tăng nhịp nhóm'; return ap; }
  if(d.loai==='SEEDING_THONG_DIEP'){ await env.DB.prepare(`UPDATE thong_diep_seeding SET thu_tu=thu_tu-100 WHERE id=?`).bind(nd.thong_diep_id).run(); ap.thong_diep=nd.thong_diep_id; ap.ghi_chu='đã đẩy thông điệp lên đầu bản đồ'; return ap; }
  if(d.loai==='TY_TRONG_PILLAR'){ const t=await env.DB.prepare(`SELECT ty_trong FROM pillars WHERE id=?`).bind(nd.tang).first(), g=await env.DB.prepare(`SELECT ty_trong FROM pillars WHERE id=?`).bind(nd.giam).first(); if(t&&g){ await env.DB.prepare(`UPDATE pillars SET ty_trong=? WHERE id=?`).bind(so(t.ty_trong)+so(nd.buoc), nd.tang).run(); await env.DB.prepare(`UPDATE pillars SET ty_trong=? WHERE id=?`).bind(Math.max(0,so(g.ty_trong)-so(nd.buoc)), nd.giam).run(); await env.DB.prepare(`UPDATE chien_luoc SET updated_at=? WHERE id=1`).bind(nowISO()).run(); ap.pillars=true; ap.ghi_chu='đã đổi tỷ trọng pillar — chiến lược cần chốt lại phiên bản (G1)'; } }
  else { const cfg=(await docCauHinh(env)).hoc||{}; const goiY={...(cfg.goi_y||{})}; goiY[d.loai]=nd; await datCauHinh(env,'hoc',{goi_y:goiY}, me.ho_ten); ap.goi_y=true; ap.ghi_chu='ghi vào gợi ý (máy đề xuất kế hoạch/lịch đăng sẽ dùng)'; }
  return ap; }

// ============================================================
//  ADR-007 — SEEDING HỘI NHÓM FACEBOOK (bản vẽ §11): định vị → bản đồ thông điệp → biến thể (giọng × dạng bài × thông điệp) → bài trong nhóm.
//  Máy: soạn gói (B13, qua G3-gói) · xếp lịch (B14) · Trạm đăng (B15) · Trạm kiểm/đo/bắt lead (B16) · học (B17, G4). Không Sales, không tiền.
// ============================================================
const GIONG_SEED=[['THO','thợ ốp lát đã dùng thử: nói mộc, kể việc thật, từ ngữ nghề'],['THAU','nhà thầu nhỏ: tính chi phí bảo hành lâu dài, uy tín với chủ nhà'],['CHU_NHA','chủ nhà vừa hoàn thiện: khoe kết quả hoặc hỏi kinh nghiệm']];
const DANG_BAI_SEED=[['KE','kể trải nghiệm'],['HOI','hỏi tư vấn (kéo bình luận)'],['KHOE','khoe công trình'],['SO_SANH','so sánh vật liệu'],['CANH_BAO','cảnh báo lỗi thi công']];
const bamVanBan=s=>{ const w=String(s||'').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(x=>x.length>1); const m={}; w.forEach(x=>m[x]=(m[x]||0)+1); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k])=>k).sort().join(' '); };
const docTaiKhoan=async(env,id)=>id?await env.DB.prepare(`SELECT * FROM tai_khoan_seeding WHERE id=?`).bind(id).first():null;
const tkSong=tk=>tk&&uBool(tk.active)&&(!tk.tam_dung_den||tk.tam_dung_den<nowISO());
// ADR-T01 đợt 4: Trạm cũng có sổ dừng riêng theo tài khoản (checkpoint do script báo về Trạm, hạ nhịp…) — app tôn trọng, không giao việc cho tài khoản Trạm đang dừng
const tkDungTram=(tt,tk)=>{ const p=tt&&tt.phien&&tk?tt.phien[tk.tram_id||'facebook']:null; return p&&p.dung_den&&p.dung_den>nowISO()?p.dung_den:null; };
const coLink=t=>/https?:\/\/|www\.|facebook\.com|fb\.com/i.test(String(t||''));
// Thông điệp "đói": ít bài seeding trong N ngày → máy ưu tiên
async function thongDiepDoi(env, soCan){ const cfg=(await docCauHinh(env)).seeding||{}; const tu=new Date(Date.now()-Math.max(7,so(cfg.thong_diep_doi_ngay,30))*864e5).toISOString();
  const ds=(await env.DB.prepare(`SELECT t.*, (SELECT COUNT(*) FROM bien_the b JOIN viec_seeding v ON v.bien_the_id=b.id WHERE b.thong_diep_id=t.id AND v.created_at>=? AND v.trang_thai IN ('DA_DANG','DAT','CHO','DANG_GUI')) so_bai FROM thong_diep_seeding t WHERE t.active=1 ORDER BY so_bai ASC, t.thu_tu ASC`).bind(tu).all()).results;
  return ds.slice(0, Math.max(1,soCan)).map(t=>({...t, du_kien:docJSON(t.du_kien,[])})); }
// B13: máy soạn biến thể — mỗi biến thể = (tài khoản/giọng sẵn có) × dạng bài (luân phiên, tôn trọng quy tắc nhóm) × thông điệp; kèm 2–3 bình luận dẫn dắt vai khác
async function soanBienThe(env, {bd, nd, thongDiep, giongs, soBT}){
  const claims=await docClaims(env); const cl=await env.DB.prepare(`SELECT * FROM chien_luoc WHERE id=1`).first()||{}; const sp=nd&&nd.san_pham_id?await env.DB.prepare(`SELECT ten,thong_so,bao_hanh FROM san_pham WHERE id=?`).bind(nd.san_pham_id).first():null;
  const dang=DANG_BAI_SEED; const yc=[]; for(let i=0;i<soBT;i++){ const g=giongs[i%giongs.length]; const td=thongDiep[i%thongDiep.length]; const d=dang[i%dang.length]; yc.push({stt:i+1, giong:g, thong_diep:td, dang_bai:d}); }
  const sys='Bạn viết bài SEEDING cho hội nhóm Facebook của thợ ốp lát / thầu / chủ nhà, để truyền một THÔNG ĐIỆP định vị của keo ron gạch Kingsmen một cách tự nhiên như người trong nghề kể chuyện. Mỗi bài 60–140 từ, đúng GIỌNG và DẠNG BÀI được giao, mang đúng MỘT thông điệp, nhắc tên Kingsmen tự nhiên đúng 1 lần, KHÔNG nói giá, KHÔNG bịa thông số ngoài "dữ kiện được dùng", KHÔNG dùng cụm cấm và các điều "không nói", KHÔNG chèn link, không giọng quảng cáo. Kèm 2–3 bình luận dẫn dắt (≤ 25 từ, vai khác người đăng: hỏi kinh nghiệm · xác nhận đã dùng · hỏi mua ở đâu). CHỈ trả JSON {"bien_the":[{"stt":1,"noi_dung":"...","binh_luan":[{"vai":"HOI_KN","text":"..."},{"vai":"XAC_NHAN","text":"..."},{"vai":"HOI_MUA","text":"..."}]}]}. Các bài phải khác nhau rõ rệt về câu chữ và tình huống.';
  const usr='ĐỊNH VỊ: '+(cl.dinh_vi||'(chưa)')+'\nTÔNG GIỌNG THƯƠNG HIỆU: '+(cl.tong_giong||'')+'\nSẢN PHẨM LIÊN QUAN: '+(sp?(sp.ten+' · thông số '+JSON.stringify(docJSON(sp.thong_so,[]))+' · bảo hành '+(sp.bao_hanh||'')):'(theo dữ kiện của thông điệp)')+(bd?('\nBÀI CHÍNH ĐÃ ĐĂNG (ý để kể lại, không chép): '+String(bd.noi_dung_dang||'').slice(0,1500)):'')+'\nCỤM CẤM: '+JSON.stringify(claims.map(c=>c.cum_tu))+'\nYÊU CẦU TỪNG BÀI:\n'+yc.map(y=>y.stt+'. GIỌNG '+y.giong[0]+' ('+y.giong[1]+') · DẠNG '+y.dang_bai[0]+' ('+y.dang_bai[1]+') · THÔNG ĐIỆP "'+y.thong_diep.ten+'": '+(y.thong_diep.y_chinh||'')+' · dữ kiện được dùng: '+JSON.stringify(y.thong_diep.du_kien||[])+' · thợ hay nói: '+(y.thong_diep.cach_noi_tho||'')+' · KHÔNG nói: '+(y.thong_diep.khong_noi||'')).join('\n');
  const r=await goiAI(env,{system:sys, messages:[{role:'user',content:usr}], max_tokens:2500, tinh_nang:'seeding_bien_the'}); if(!r.ok) return r;
  let o; try{ const t=r.text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,''); o=JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}')+1)); }catch(e){ return {ok:false, loi:'JSON AI hỏng'}; }
  const ok=[]; const loi=[]; for(const x of (Array.isArray(o.bien_the)?o.bien_the:[])){ const y=yc.find(q=>q.stt===so(x.stt))||yc[ok.length]; if(!y) continue; const ndung=chuoi(x.noi_dung,1500); if(!ndung) continue;
    const bl=(Array.isArray(x.binh_luan)?x.binh_luan:[]).map(b=>({vai:chuoi((b&&b.vai)||'HOI_KN',20), text:chuoi((b&&b.text)||b,200)})).filter(b=>b.text).slice(0,3);
    const chan=quetClaim(ndung+'\n'+bl.map(b=>b.text).join('\n'), claims).filter(c=>c.muc_do==='CHAN'); if(chan.length){ loi.push('bài '+y.stt+' trúng cụm CHẶN '+chan[0].cum_tu); continue; }
    if(!/kingsmen/i.test(ndung)){ loi.push('bài '+y.stt+' không nhắc Kingsmen'); continue; } if(/\d{2,3}[.,]?\d{3}\s*(đ|vnd|k\b)/i.test(ndung)){ loi.push('bài '+y.stt+' có con số tiền'); continue; }
    ok.push({ giong:y.giong[0], dang_bai:y.dang_bai[0], thong_diep_id:y.thong_diep.id, noi_dung:ndung, binh_luan:bl, co_link:coLink(ndung)?1:0 }); }
  return {ok:ok.length>0, bien_the:ok, loi};
}
// Máy chấm gói (G3-gói chấm sẵn): mỗi biến thể có nhắc Kingsmen, không giá, không claim, tỷ lệ link ≤ cấu hình, khác nhau ≥ 40%
async function chamGoiMay(env, goiId){ const cfg=(await docCauHinh(env)).seeding||{}; const bts=(await env.DB.prepare(`SELECT * FROM bien_the WHERE goi_id=?`).bind(goiId).all()).results; const ly=[]; let diem=100;
  if(!bts.length) return {diem:0, ly:['gói không có biến thể'], nen_duyet:false}; const claims=await docClaims(env);
  const link=bts.filter(b=>uBool(b.co_link)).length; if(link/bts.length*100>so(cfg.ty_le_link_toi_da,30)){ diem-=20; ly.push('quá '+so(cfg.ty_le_link_toi_da,30)+'% bài có link'); }
  for(const b of bts){ if(quetClaim(b.noi_dung, claims).some(c=>c.muc_do==='CHAN')){ diem-=40; ly.push('biến thể có cụm CHẶN'); } if(!/kingsmen/i.test(b.noi_dung)){ diem-=15; ly.push('biến thể không nhắc Kingsmen'); } if(/giá|khuyến mãi|giảm giá/i.test(b.noi_dung)){ diem-=10; ly.push('biến thể nhắc giá/khuyến mãi'); } }
  for(let i=0;i<bts.length;i++) for(let j=i+1;j<bts.length;j++) if(giongVanBan(bts[i].noi_dung, bts[j].noi_dung)>0.6){ diem-=15; ly.push('hai biến thể quá giống nhau'); }
  const d=Math.max(0,Math.min(100,diem)); return {diem:d, ly:[...new Set(ly)], nen_duyet:d>=70&&!ly.some(x=>/CHẶN/.test(x))}; }
// Tạo gói (BAI_CHINH hoặc DINH_KY) → biến thể → chấm máy → CHO_DUYET (G3-gói); B13 ở AI_TU_LAM và máy chấm ĐẠT → tự DUYỆT
async function taoGoiSeeding(env, {loai, bd, tacNhan, soBT}){
  const cfg=(await docCauHinh(env)).seeding||{}; const nd=bd?await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(bd.noi_dung_id).first():null;
  if(bd){ const cu=await env.DB.prepare(`SELECT id FROM goi_seeding WHERE bai_dang_id=?`).bind(bd.id).first(); if(cu) return {ok:false, loi:'Bài đã có gói seeding', id:cu.id}; }
  const tks=(await env.DB.prepare(`SELECT * FROM tai_khoan_seeding WHERE active=1`).all()).results.filter(tkSong); const giongs=[...new Set(tks.map(t=>t.giong).filter(Boolean))].map(g=>GIONG_SEED.find(x=>x[0]===g)).filter(Boolean); if(!giongs.length) giongs.push(GIONG_SEED[0]);
  const N=Math.max(1,Math.min(6,so(soBT)||so(cfg.so_bien_the,3))); const td=await thongDiepDoi(env, N); if(!td.length) return {ok:false, loi:'Chưa có thông điệp nào trong bản đồ thông điệp (Chiến lược › Thông điệp seeding)'};
  const r=await soanBienThe(env,{bd, nd, thongDiep:td, giongs, soBT:N}); if(!r.ok) return {ok:false, loi:r.loi||'không soạn được', vuot_ngan_sach:r.vuot_ngan_sach};
  const id=uid('gs'); const han=ngayVN(Date.now()+Math.max(1,so(cfg.so_ngay_lich,7))*864e5);
  await env.DB.prepare(`INSERT INTO goi_seeding (id,loai,bai_dang_id,noi_dung_id,muc_id,thong_diep_ids,so_bien_the,so_viec,han,trang_thai,tao_boi,created_at) VALUES (?,?,?,?,?,?,?,0,?,'NHAP',?,?)`).bind(id, loai==='DINH_KY'?'DINH_KY':'BAI_CHINH', bd?bd.id:null, nd?nd.id:null, bd?bd.muc_id:null, JSON.stringify([...new Set(r.bien_the.map(b=>b.thong_diep_id))]), r.bien_the.length, han, tacNhan.ho_ten, nowISO()).run();
  for(const x of r.bien_the) await env.DB.prepare(`INSERT INTO bien_the (id,goi_id,thong_diep_id,giong,dang_bai,noi_dung,co_link,binh_luan,bam,tao_boi,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('bt'), id, x.thong_diep_id, x.giong, x.dang_bai, x.noi_dung, x.co_link, JSON.stringify(x.binh_luan), bamVanBan(x.noi_dung), tacNhan.agent?'AGENT':'NGUOI', nowISO()).run();
  const cham=await chamGoiMay(env, id); const b13=await mucBuoc(env,'B13'); const tuQua=b13.nguoi_thuc_hien==='AI_TU_LAM'&&cham.nen_duyet;
  await env.DB.prepare(`UPDATE goi_seeding SET trang_thai=?, cham_may=?, duyet_boi=?, duyet_at=? WHERE id=?`).bind(tuQua?'DUYET':'CHO_DUYET', JSON.stringify(cham), tuQua?'Máy (B13 AI tự làm)':null, tuQua?nowISO():null, id).run();
  if(!tuQua) await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'DUYET_GOI_SEEDING','Duyệt gói seeding (G3-gói): '+r.bien_the.length+' biến thể · máy chấm '+cham.diem+'/100','goi_seeding',id,'TRUONG_MKT',ngayVN(Date.now()+864e5),tacNhan.ho_ten,(cham.ly.join('; ')||'máy không thấy lỗi')+' — vào Seeding › Gói để duyệt/sửa',nowISO()).run();
  await logAudit(env, tacNhan, 'tạo gói seeding', 'goi_seeding', id, (loai==='DINH_KY'?'định kỳ':'bài chính')+' · '+r.bien_the.length+' biến thể · máy chấm '+cham.diem+(tuQua?' · tự duyệt':'')+(r.loi.length?(' · bỏ: '+r.loi.join('; ')):''));
  return {ok:true, id, so_bien_the:r.bien_the.length, cham, tu_duyet:tuQua, loi:r.loi};
}
// B14: mỗi nhóm bật + tài khoản trong nhóm còn sống → một việc; biến thể chọn theo giọng của tài khoản & quy tắc nhóm; giờ = giờ vàng nhóm/mặc định, nhịp tài khoản/ngày, khoảng cách
async function xepLichGoi(env, goi, tacNhan){
  if(goi.trang_thai!=='DUYET') return {ok:false, loi:'gói chưa được duyệt (G3-gói)'};
  const cfg=(await docCauHinh(env)).seeding||{}; const gioMac=(Array.isArray(cfg.gio_vang)&&cfg.gio_vang.length?cfg.gio_vang:[6,12,20]).map(x=>so(x)); const soNgay=Math.max(1,so(cfg.so_ngay_lich,7)), khoang=Math.max(5,so(cfg.khoang_cach_phut,180))*60000;
  const bts=(await env.DB.prepare(`SELECT * FROM bien_the WHERE goi_id=?`).bind(goi.id).all()).results; if(!bts.length) return {ok:false, loi:'gói chưa có biến thể'};
  const daCo=new Set((await env.DB.prepare(`SELECT nhom_id FROM viec_seeding WHERE goi_id=? AND trang_thai<>'HUY'`).bind(goi.id).all()).results.map(x=>x.nhom_id));
  const tks=(await env.DB.prepare(`SELECT * FROM tai_khoan_seeding`).all()).results; const nhom=(await env.DB.prepare(`SELECT * FROM nhom_seeding WHERE active=1`).all()).results;
  const diem=n=>{ const h=docJSON(n.hieu_qua,{}); return (so(h.dat)+1)/(so(h.tong)+2); }; nhom.sort((a,b)=>diem(b)-diem(a));
  const lich=(await env.DB.prepare(`SELECT tai_khoan_id, nhom_id, gio_dang FROM viec_seeding WHERE trang_thai IN ('CHO','DANG_GUI') AND gio_dang>=?`).bind(nowISO()).all()).results;
  const tuan=(await env.DB.prepare(`SELECT nhom_id, COUNT(*) n FROM viec_seeding WHERE created_at>=? AND trang_thai<>'HUY' GROUP BY nhom_id`).bind(new Date(Date.now()-7*864e5).toISOString()).all()).results; const demTuan={}; tuan.forEach(r=>demTuan[r.nhom_id]=so(r.n));
  const giongUuTien=chuoi(cfg.giong_uu_tien,20); let tao=0, i=0; const bo=[];
  for(const n of nhom){ if(daCo.has(n.id)) continue; if(so(demTuan[n.id])>=Math.max(1,so(n.nhip_tuan,1))){ bo.push(n.ten+': đủ nhịp tuần'); continue; }
    const qt=docJSON(n.quy_tac,{}); const ids=docJSON(n.tai_khoan_ids,[]); const ung=tks.filter(t=>ids.includes(t.id)&&tkSong(t)); if(n.cach!=='TAY'&&!ung.length){ bo.push(n.ten+': không có tài khoản sống trong nhóm'); continue; }
    // biến thể hợp quy tắc nhóm (cấm bán hàng → bỏ dạng KHOE/SO_SANH có link; cấm link → bỏ bài có link), ưu tiên giọng của tài khoản
    const tk=ung.length?ung.sort((a,b)=>(a.giong===giongUuTien?-1:0)-(b.giong===giongUuTien?-1:0)||(lich.filter(l=>l.tai_khoan_id===a.id).length-lich.filter(l=>l.tai_khoan_id===b.id).length))[0]:null;
    let hop=bts.filter(b=>!(qt.cam_link&&uBool(b.co_link))&&!(qt.cam_ban_hang&&['KHOE','SO_SANH'].includes(b.dang_bai)&&uBool(b.co_link))); if(tk) hop=hop.filter(b=>b.giong===tk.giong).length?hop.filter(b=>b.giong===tk.giong):hop; if(!hop.length){ bo.push(n.ten+': không có biến thể hợp quy tắc nhóm'); continue; }
    const b=hop[i++%hop.length]; const gioNhom=docJSON(n.gio_vang,[]).map(x=>so(x)).filter(x=>x>=0&&x<=23); const moc=gioNhom.length?gioNhom:gioMac; const ds=tk?lich.filter(l=>l.tai_khoan_id===tk.id).map(l=>Date.parse(l.gio_dang)):[]; const nhip=tk?Math.max(1,so(tk.nhip_ngay,2)):99; let gio=null;
    for(let d=0; d<soNgay && !gio; d++){ for(const h of moc){ const t=new Date(ngayVN(Date.now()+d*864e5)+'T'+String(h).padStart(2,'0')+':00:00+07:00').getTime()+Math.floor(Math.random()*25)*60000; if(t<Date.now()+10*60000) continue; const ngay=new Date(t+7*36e5).toISOString().slice(0,10); if(ds.filter(x=>new Date(x+7*36e5).toISOString().slice(0,10)===ngay).length>=nhip) continue; if(ds.some(x=>Math.abs(x-t)<khoang)) continue; gio=new Date(t).toISOString(); break; } }
    if(!gio){ bo.push(n.ten+': tài khoản kín lịch '+soNgay+' ngày'); continue; }
    await env.DB.prepare(`INSERT INTO viec_seeding (id,goi_id,bien_the_id,nhom_id,tai_khoan_id,cach,gio_dang,trang_thai,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'CHO',?,?)`).bind(uid('vs'), goi.id, b.id, n.id, tk?tk.id:null, n.cach==='TAY'?'TAY':'TRAM', gio, nowISO(), nowISO()).run(); lich.push({tai_khoan_id:tk?tk.id:null, nhom_id:n.id, gio_dang:gio}); demTuan[n.id]=so(demTuan[n.id])+1; tao++; }
  await env.DB.prepare(`UPDATE goi_seeding SET so_viec=so_viec+? WHERE id=?`).bind(tao, goi.id).run();
  if(tao) await logAudit(env, tacNhan, 'xếp lịch seeding', 'goi_seeding', goi.id, tao+' việc'); return {ok:true, tao, bo, khong_nhom:nhom.length===0};
}
// B15: tới giờ → Trạm đăng (lệnh seeding_dang); cách TAY hoặc B15 NGƯỜI → giao việc đăng tay; Trạm im → dời 30'
async function chayDangSeeding(env){
  const due=(await env.DB.prepare(`SELECT * FROM viec_seeding WHERE trang_thai='CHO' AND gio_dang<=? ORDER BY gio_dang LIMIT 20`).bind(nowISO()).all()).results; if(!due.length) return {bo_qua:'Không có việc seeding tới giờ'};
  const b15=await mucBuoc(env,'B15'); const tt=await docTramTrangThai(env); let giao=0, gui=0, hoan=0;
  for(const v of due){ const tk=await docTaiKhoan(env, v.tai_khoan_id);
    if(v.cach==='TAY' || b15.nguoi_thuc_hien==='NGUOI'){ await env.DB.prepare(`UPDATE viec_seeding SET trang_thai='DANG_GUI', cach='TAY', updated_at=? WHERE id=?`).bind(nowISO(), v.id).run(); await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'SEEDING_TAY','Đăng seeding tay vào nhóm (việc '+v.id+')','viec_seeding',v.id,b15.vai_tro_nguoi||'MARKETING',ngayVN(),'Máy (B15)',v.cach==='TAY'?'Nhóm đặt cách đăng TAY':'Bước B15 đang do người làm — mở Seeding, copy biến thể, đăng rồi dán link',nowISO()).run(); giao++; continue; }
    if(!tkSong(tk)){ await env.DB.prepare(`UPDATE viec_seeding SET gio_dang=?, loi=?, updated_at=? WHERE id=?`).bind(new Date(Date.now()+6*3600e3).toISOString(), 'tài khoản tạm dừng/không có — dời 6 giờ', nowISO(), v.id).run(); hoan++; continue; }
    const dungTram=tkDungTram(tt,tk); if(dungTram){ await env.DB.prepare(`UPDATE viec_seeding SET gio_dang=?, loi=?, updated_at=? WHERE id=?`).bind(new Date(Math.max(Date.parse(dungTram), Date.now()+30*60000)).toISOString(), 'Trạm đang dừng tài khoản '+(tk.tram_id||'facebook')+' (checkpoint) tới '+dungTram.slice(0,16).replace('T',' ')+' — dời tới lúc đó', nowISO(), v.id).run(); hoan++; continue; }
    if(!tt||!tt.song){ await env.DB.prepare(`UPDATE viec_seeding SET gio_dang=?, loi='Trạm im — dời 30 phút', updated_at=? WHERE id=?`).bind(new Date(Date.now()+30*60000).toISOString(), nowISO(), v.id).run(); hoan++; continue; }
    await env.DB.prepare(`UPDATE viec_seeding SET trang_thai='DANG_GUI', loi=NULL, updated_at=? WHERE id=?`).bind(nowISO(), v.id).run(); gui++; }
  if(gui) await taoLenhTram(env,'chay_agent',{id:'content_os', viec:'seeding_dang'}, MAY('Máy (B15)'));
  return { ok:true, doc:due.length, ghi:gui+giao, tom_tat:'Tới giờ '+due.length+': giao Trạm đăng '+gui+' · giao tay '+giao+' · hoãn '+hoan };
}
// Trạm báo kết quả đăng: lô content_os.seeding_dang_ket_qua {viec_id, ok, link, msg_id, loi, checkpoint, cho_quan_tri}
// ADR-007b — bình luận dẫn dắt: sau khi bài lên, 1–2 tài khoản KHÁC trong nhóm bình luận theo vai (hỏi kinh nghiệm / xác nhận / hỏi mua), giãn 30–180 phút, không trùng người đăng
async function lenBinhLuan(env, v){ const cfg=(await docCauHinh(env)).seeding||{}; const soBL=Math.max(0,so(cfg.binh_luan_moi_bai,2)); if(!soBL||!v.link) return 0;
  if(await env.DB.prepare(`SELECT id FROM binh_luan_seeding WHERE viec_id=?`).bind(v.id).first()) return 0;
  const bt=await env.DB.prepare(`SELECT binh_luan FROM bien_the WHERE id=?`).bind(v.bien_the_id).first(); const nhom=await env.DB.prepare(`SELECT * FROM nhom_seeding WHERE id=?`).bind(v.nhom_id).first(); if(!bt||!nhom) return 0;
  const qt=docJSON(nhom.quy_tac,{}); const ds=docJSON(bt.binh_luan,[]).filter(b=>b&&b.text&&!(qt.cam_ban_hang&&b.vai==='HOI_MUA')).slice(0,soBL); if(!ds.length) return 0;
  const ids=docJSON(nhom.tai_khoan_ids,[]).filter(x=>x!==v.tai_khoan_id); const tks=[]; for(const id of ids){ const t=await docTaiKhoan(env,id); if(tkSong(t)) tks.push(t); } if(!tks.length) return 0;
  const mn=Math.max(5,so(cfg.binh_luan_tre_min,30)), mx=Math.max(mn+5,so(cfg.binh_luan_tre_max,180)); let tao=0; let t=Date.parse(v.dang_at||nowISO());
  for(let i=0;i<ds.length && i<tks.length;i++){ t+= (mn + Math.floor(Math.random()*(mx-mn)))*60000; await env.DB.prepare(`INSERT INTO binh_luan_seeding (id,viec_id,tai_khoan_id,vai,text,gio,trang_thai,created_at) VALUES (?,?,?,?,?,?,'CHO',?)`).bind(uid('bl'), v.id, tks[i].id, chuoi(ds[i].vai,20)||'HOI_KN', chuoi(ds[i].text,200), new Date(t).toISOString(), nowISO()).run(); tao++; }
  return tao; }
// tới giờ → Trạm bình luận (lệnh seeding_binh_luan) hoặc giao tay khi B15 NGƯỜI; tài khoản tạm dừng → dời 6 giờ
async function chayBinhLuanSeeding(env){ const due=(await env.DB.prepare(`SELECT b.*, v.link FROM binh_luan_seeding b JOIN viec_seeding v ON v.id=b.viec_id WHERE b.trang_thai='CHO' AND b.gio<=? ORDER BY b.gio LIMIT 20`).bind(nowISO()).all()).results; if(!due.length) return {bo_qua:'Không có bình luận dẫn dắt tới giờ'};
  const b15=await mucBuoc(env,'B15'); const tt=await docTramTrangThai(env); let gui=0, giao=0, hoan=0;
  for(const b of due){ const tk=await docTaiKhoan(env,b.tai_khoan_id); if(!tkSong(tk)){ await env.DB.prepare(`UPDATE binh_luan_seeding SET gio=?, loi='tài khoản tạm dừng — dời 6 giờ' WHERE id=?`).bind(new Date(Date.now()+6*3600e3).toISOString(), b.id).run(); hoan++; continue; }
    const dungTram=tkDungTram(tt,tk); if(dungTram){ await env.DB.prepare(`UPDATE binh_luan_seeding SET gio=?, loi=? WHERE id=?`).bind(new Date(Math.max(Date.parse(dungTram), Date.now()+30*60000)).toISOString(), 'Trạm đang dừng tài khoản (checkpoint) tới '+dungTram.slice(0,16).replace('T',' '), b.id).run(); hoan++; continue; }
    if(b15.nguoi_thuc_hien==='NGUOI'){ await env.DB.prepare(`UPDATE binh_luan_seeding SET trang_thai='DANG_GUI' WHERE id=?`).bind(b.id).run(); await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'BINH_LUAN_TAY','Bình luận tay bằng '+(tk.nhan||'tài khoản')+': "'+b.text.slice(0,50)+'"','binh_luan_seeding',b.id,'MARKETING',ngayVN(),'Máy (B15)','B15 đang do người làm — mở '+(b.link||'bài')+', bình luận rồi bấm đã đăng',nowISO()).run(); giao++; continue; }
    if(!tt||!tt.song){ await env.DB.prepare(`UPDATE binh_luan_seeding SET gio=?, loi='Trạm im — dời 30 phút' WHERE id=?`).bind(new Date(Date.now()+30*60000).toISOString(), b.id).run(); hoan++; continue; }
    await env.DB.prepare(`UPDATE binh_luan_seeding SET trang_thai='DANG_GUI', loi=NULL WHERE id=?`).bind(b.id).run(); gui++; }
  if(gui) await taoLenhTram(env,'chay_agent',{id:'content_os', viec:'seeding_binh_luan'}, MAY('Máy (B15)'), 'tram');
  return { ok:true, doc:due.length, ghi:gui+giao, tom_tat:'Bình luận tới giờ '+due.length+': Trạm '+gui+' · tay '+giao+' · hoãn '+hoan }; }
async function napBinhLuan(env, dong){ const cfg=(await docCauHinh(env)).seeding||{}; let cap=0; const loi=[]; for(const d of dong){ const b=d.id?await env.DB.prepare(`SELECT * FROM binh_luan_seeding WHERE id=?`).bind(String(d.id)).first():null; if(!b||!['DANG_GUI','CHO'].includes(b.trang_thai)){ loi.push('không thấy bình luận '+(d.id||'?')); continue; }
    if(d.ok===true){ await env.DB.prepare(`UPDATE binh_luan_seeding SET trang_thai='DA_DANG', dang_at=?, loi=NULL WHERE id=?`).bind(nowISO(), b.id).run(); cap++; continue; }
    const cp=d.checkpoint===true||/checkpoint|captcha|xác minh/i.test(String(d.loi||'')); if(cp&&b.tai_khoan_id) await ghiCheckpoint(env, b.tai_khoan_id, chuoi(d.loi,200), cfg);
    const lan=so(b.lan_thu)+1; if(lan>=2) await env.DB.prepare(`UPDATE binh_luan_seeding SET trang_thai='LOI', lan_thu=?, loi=? WHERE id=?`).bind(lan, chuoi(d.loi,200), b.id).run(); else await env.DB.prepare(`UPDATE binh_luan_seeding SET trang_thai='CHO', lan_thu=?, loi=?, gio=? WHERE id=?`).bind(lan, chuoi(d.loi,200), new Date(Date.now()+2*3600e3).toISOString(), b.id).run(); cap++; }
  return {cap, loi}; }
// checkpoint: tạm dừng tài khoản + ghi lịch sử; đủ N lần trong 30 ngày → tự hạ nhịp (007b tự chỉnh nhịp — hạ thì máy tự làm, tăng phải qua G4)
async function ghiCheckpoint(env, tkId, loiText, cfg){ const tk=await docTaiKhoan(env,tkId); if(!tk) return; const sk=docJSON(tk.suc_khoe,{}); const cps=(Array.isArray(sk.checkpoints)?sk.checkpoints:[]).filter(x=>Date.parse(x)>Date.now()-30*864e5); cps.push(nowISO()); sk.checkpoints=cps; sk.loi=loiText; sk.luc=nowISO();
  let nhip=so(tk.nhip_ngay,2), dung=Math.max(1,so(cfg.tam_dung_gio,24)); let ha=false; if(cfg.nhip_tu_chinh!==false && cps.length>=Math.max(1,so(cfg.checkpoint_ha_nhip,2)) && nhip>1){ nhip=nhip-1; dung=72; ha=true; }
  await env.DB.prepare(`UPDATE tai_khoan_seeding SET tam_dung_den=?, suc_khoe=?, nhip_ngay=? WHERE id=?`).bind(new Date(Date.now()+dung*3600e3).toISOString(), JSON.stringify(sk), nhip, tkId).run();
  await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'KIEM_TAI_KHOAN','Tài khoản seeding gặp checkpoint — kiểm tra trên Trạm','tai_khoan_seeding',tkId,'MARKETING',ngayVN(),'Máy (B15)',loiText+' — máy tạm dừng '+dung+' giờ'+(ha?(', tự hạ nhịp còn '+nhip+' bài/ngày ('+cps.length+' checkpoint/30 ngày)'):'')+', không tự vượt',nowISO()).run();
  if(ha) await logAudit(env, MAY('Máy (nhịp)'), 'tự hạ nhịp tài khoản', 'tai_khoan_seeding', tkId, cps.length+' checkpoint/30 ngày → '+nhip+' bài/ngày, dừng 72 giờ'); }
// nuôi tài khoản: mỗi ngày một lượt xem/thả tim trong nhóm của nó (giờ ngẫu nhiên 8–21h, tránh giờ đăng) → Trạm làm; mục đích: tài khoản có sinh hoạt thật, không chỉ đăng
async function lenLichNuoi(env){ const cfg=(await docCauHinh(env)).seeding||{}; const soNgay=Math.max(0,so(cfg.nuoi_moi_ngay,1)); if(!soNgay) return {tao:0}; const hn=ngayVN(); const tks=(await env.DB.prepare(`SELECT * FROM tai_khoan_seeding WHERE active=1`).all()).results.filter(tkSong); let tao=0;
  for(const tk of tks){ const co=await env.DB.prepare(`SELECT COUNT(*) n FROM nuoi_seeding WHERE tai_khoan_id=? AND gio LIKE ?`).bind(tk.id, hn+'%').first(); if(so(co&&co.n)>=soNgay) continue;
    const nhoms=(await env.DB.prepare(`SELECT id, tai_khoan_ids FROM nhom_seeding WHERE active=1`).all()).results.filter(x=>docJSON(x.tai_khoan_ids,[]).includes(tk.id)); if(!nhoms.length) continue; const nh=nhoms[Math.floor(Math.random()*nhoms.length)];
    const dang=(await env.DB.prepare(`SELECT gio_dang FROM viec_seeding WHERE tai_khoan_id=? AND gio_dang LIKE ?`).bind(tk.id, hn+'%').all()).results.map(x=>Date.parse(x.gio_dang)); let gio=null; for(let k=0;k<10&&!gio;k++){ const h=8+Math.floor(Math.random()*14); const t=new Date(hn+'T'+String(h).padStart(2,'0')+':'+String(Math.floor(Math.random()*60)).padStart(2,'0')+':00+07:00').getTime(); if(t<Date.now()) continue; if(dang.some(x=>Math.abs(x-t)<90*60000)) continue; gio=new Date(t).toISOString(); }
    if(!gio) continue; await env.DB.prepare(`INSERT INTO nuoi_seeding (id,tai_khoan_id,nhom_id,gio,phut,tim,trang_thai,created_at) VALUES (?,?,?,?,?,?,'CHO',?)`).bind(uid('nu'), tk.id, nh.id, gio, Math.max(1,so(cfg.nuoi_phut,4)), Math.max(0,so(cfg.nuoi_tim,3)), nowISO()).run(); tao++; }
  return {tao}; }
async function chayNuoi(env){ const due=(await env.DB.prepare(`SELECT * FROM nuoi_seeding WHERE trang_thai='CHO' AND gio<=? LIMIT 10`).bind(nowISO()).all()).results; if(!due.length) return {bo_qua:'Không có lượt nuôi tới giờ'}; const tt=await docTramTrangThai(env); if(!tt||!tt.song){ for(const d of due) await env.DB.prepare(`UPDATE nuoi_seeding SET gio=? WHERE id=?`).bind(new Date(Date.now()+30*60000).toISOString(), d.id).run(); return {bo_qua:'Trạm im — dời '+due.length+' lượt nuôi'}; }
  for(const d of due) await env.DB.prepare(`UPDATE nuoi_seeding SET trang_thai='DANG_GUI' WHERE id=?`).bind(d.id).run(); await taoLenhTram(env,'chay_agent',{id:'content_os', viec:'seeding_nuoi'}, MAY('Máy (nuôi)'), 'tram'); return {ok:true, ghi:due.length, tom_tat:'Giao Trạm nuôi '+due.length+' tài khoản'}; }
async function napNuoi(env, dong){ const cfg=(await docCauHinh(env)).seeding||{}; let cap=0; for(const d of dong){ const x=d.id?await env.DB.prepare(`SELECT * FROM nuoi_seeding WHERE id=?`).bind(String(d.id)).first():null; if(!x) continue; await env.DB.prepare(`UPDATE nuoi_seeding SET trang_thai=?, ket_qua=? WHERE id=?`).bind(d.ok===true?'XONG':'LOI', JSON.stringify({tim:so(d.tim), xem_phut:so(d.xem_phut), loi:chuoi(d.loi,200), luc:nowISO()}), x.id).run();
    if(d.ok===true){ const tk=await docTaiKhoan(env,x.tai_khoan_id); if(tk){ const sk=docJSON(tk.suc_khoe,{}); sk.nuoi_so=so(sk.nuoi_so)+1; sk.nuoi_lan_cuoi=nowISO(); await env.DB.prepare(`UPDATE tai_khoan_seeding SET suc_khoe=? WHERE id=?`).bind(JSON.stringify(sk), tk.id).run(); } }
    else if(d.checkpoint===true && x.tai_khoan_id) await ghiCheckpoint(env, x.tai_khoan_id, chuoi(d.loi,200), cfg); cap++; } return {cap, loi:[]}; }
// tự chỉnh nhịp nhóm: bị gỡ ≥ N bài/30 ngày → hạ nhịp tuần (máy tự làm, có audit + báo Trưởng MKT); nhóm tốt (≥ 8 bài đạt, 0 gỡ, react cao) → ĐỀ XUẤT tăng nhịp (G4)
async function chinhNhipSeeding(env){ const cfg=(await docCauHinh(env)).seeding||{}; if(cfg.nhip_tu_chinh===false) return {bo_qua:'Tự chỉnh nhịp đang tắt'}; const tu=new Date(Date.now()-30*864e5).toISOString(); let ha=0, dx=0;
  const nhom=(await env.DB.prepare(`SELECT n.*, SUM(CASE WHEN v.trang_thai='DAT' THEN 1 ELSE 0 END) dat, SUM(CASE WHEN json_extract(v.kiem,'$.song')=0 THEN 1 ELSE 0 END) go, AVG(COALESCE(json_extract(v.kiem,'$.react'),0)) react FROM nhom_seeding n LEFT JOIN viec_seeding v ON v.nhom_id=n.id AND v.created_at>=? AND v.trang_thai IN ('DAT','KHONG_DAT','NGHI_NGO') WHERE n.active=1 GROUP BY n.id`).bind(tu).all()).results;
  for(const g of nhom){ const hq=docJSON(g.hieu_qua,{}); if(so(g.go)>=Math.max(1,so(cfg.go_bai_ha_nhip,2)) && so(g.nhip_tuan)>1 && hq.nhip_ha_luc!==ngayVN().slice(0,7)){ const moi=so(g.nhip_tuan)-1; hq.nhip_ha_luc=ngayVN().slice(0,7); await env.DB.prepare(`UPDATE nhom_seeding SET nhip_tuan=?, hieu_qua=? WHERE id=?`).bind(moi, JSON.stringify(hq), g.id).run(); await logAudit(env, MAY('Máy (nhịp)'), 'tự hạ nhịp nhóm', 'nhom_seeding', g.id, so(g.go)+' bài bị gỡ/30 ngày → '+moi+' bài/tuần'); await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'NHIP_SEEDING','Máy đã hạ nhịp nhóm "'+g.ten+'" còn '+moi+' bài/tuần','nhom_seeding',g.id,'TRUONG_MKT',ngayVN(Date.now()+3*864e5),'Máy (nhịp)',so(g.go)+' bài bị gỡ trong 30 ngày — xem lại quy tắc nhóm; muốn tăng lại thì sửa nhịp ở Seeding › Nhóm',nowISO()).run(); ha++; continue; }
    if(so(g.dat)>=8 && so(g.go)===0 && so(g.react)>=5 && so(g.nhip_tuan)<7){ const cu=await env.DB.prepare(`SELECT id FROM de_xuat WHERE loai='SEEDING_NHIP' AND trang_thai='CHO' AND noi_dung LIKE ?`).bind('%'+g.id+'%').first(); if(cu) continue; await env.DB.prepare(`INSERT INTO de_xuat (id,ky,loai,tieu_de,noi_dung,bang_chung,ly_do,trang_thai,created_at) VALUES (?,?,?,?,?,?,?,'CHO',?)`).bind(uid('dx'), thangHienTai(), 'SEEDING_NHIP', 'Tăng nhịp nhóm "'+g.ten+'" lên '+(so(g.nhip_tuan)+1)+' bài/tuần', JSON.stringify({nhom_id:g.id, nhip_tuan:so(g.nhip_tuan)+1}), JSON.stringify({[g.ten]:{dat:so(g.dat), go:0, react_tb:Math.round(so(g.react))}}), '30 ngày: '+so(g.dat)+' bài đạt, không bị gỡ, react trung bình '+Math.round(so(g.react))+' — nhóm chịu được thêm bài', nowISO()).run(); dx++; } }
  return {ok:true, ghi:ha+dx, tom_tat:'Hạ nhịp '+ha+' nhóm · đề xuất tăng '+dx}; }
// lead AI phân loại: một lượt gọi cho cả danh sách bình luận của bài → loại (HOI_MUA|HOI_GIA|HOI_KY_THUAT|TIEU_CUC|KHAC), mức 1–3, gợi ý trả lời; không có AI → từ khoá
async function phanLoaiBinhLuan(env, bt, ds){ const kq=ds.map(c=>({...c, loai:TU_KHOA_LEAD.test(c.text)?(/giá|bao nhiêu|báo giá/i.test(c.text)?'HOI_GIA':'HOI_MUA'):'KHAC', muc_do:TU_KHOA_LEAD.test(c.text)?2:0, goi_y:'', nguon:'TU_KHOA'})); if(!ds.length) return kq;
  const r=await goiAI(env,{ system:'Bạn là nhân viên marketing Kingsmen (keo ron gạch) đọc bình luận dưới bài seeding trong hội nhóm thợ. Phân loại từng bình luận: HOI_MUA (muốn mua/hỏi chỗ bán), HOI_GIA (hỏi giá), HOI_KY_THUAT (hỏi cách dùng/thi công), TIEU_CUC (chê, tố quảng cáo, gây gổ), KHAC. muc_do 1–3 (3 = cần trả lời ngay). goi_y: một câu trả lời ngắn, tự nhiên như người trong nhóm, KHÔNG nói giá cụ thể, KHÔNG bịa thông số. CHỈ trả JSON {"ds":[{"i":0,"loai":"...","muc_do":2,"goi_y":"..."}]}.', messages:[{role:'user',content:'BÀI SEEDING: '+String(bt.noi_dung||'').slice(0,600)+'\nBÌNH LUẬN:\n'+ds.map((c,i)=>i+'. '+(c.nguoi?('['+c.nguoi+'] '):'')+c.text.slice(0,200)).join('\n')}], max_tokens:1200, tinh_nang:'phan_loai_lead' });
  if(!r.ok) return kq; const o=docJSONAI(r.text); if(!o||!Array.isArray(o.ds)) return kq; for(const x of o.ds){ const c=kq[so(x.i,-1)]; if(!c) continue; const loai=['HOI_MUA','HOI_GIA','HOI_KY_THUAT','TIEU_CUC','KHAC'].includes(x.loai)?x.loai:c.loai; c.loai=loai; c.muc_do=Math.max(0,Math.min(3,so(x.muc_do))); c.goi_y=chuoi(x.goi_y,300); c.nguon='AI'; } return kq; }
async function napSeedingDang(env, dong){ const cfg=(await docCauHinh(env)).seeding||{}; let cap=0; const loi=[];
  for(const d of dong){ const v=d.viec_id?await env.DB.prepare(`SELECT * FROM viec_seeding WHERE id=?`).bind(String(d.viec_id)).first():null; if(!v||!['DANG_GUI','CHO','CHO_QUAN_TRI'].includes(v.trang_thai)){ loi.push('không thấy/không chờ đăng: '+(d.viec_id||'?')); continue; }
    if(d.ok===true){ const cq=d.cho_quan_tri===true||/chờ quản trị|pending/i.test(String(d.ghi_chu||'')); await env.DB.prepare(`UPDATE viec_seeding SET trang_thai=?, link=?, msg_id=?, dang_at=?, loi=NULL, bang_chung=?, updated_at=? WHERE id=?`).bind(cq?'CHO_QUAN_TRI':'DA_DANG', chuoi(d.link,500), chuoi(d.msg_id,120), nowISO(), JSON.stringify({nguon:'TRAM', luc:nowISO(), ghi_chu:chuoi(d.ghi_chu,200)}), nowISO(), v.id).run(); if(!cq&&chuoi(d.link)) await lenBinhLuan(env, {...v, link:chuoi(d.link,500), dang_at:nowISO()}); cap++; continue; }
    const lan=so(v.lan_thu)+1; const cp=d.checkpoint===true||/checkpoint|captcha|xác minh|verify/i.test(String(d.loi||''));
    if(cp&&v.tai_khoan_id) await ghiCheckpoint(env, v.tai_khoan_id, chuoi(d.loi,200), cfg);
    if(lan>=3) await env.DB.prepare(`UPDATE viec_seeding SET trang_thai='HUY', lan_thu=?, loi=?, updated_at=? WHERE id=?`).bind(lan, 'huỷ sau 3 lần lỗi: '+chuoi(d.loi,200), nowISO(), v.id).run();
    else await env.DB.prepare(`UPDATE viec_seeding SET trang_thai='CHO', lan_thu=?, loi=?, gio_dang=?, updated_at=? WHERE id=?`).bind(lan, chuoi(d.loi,300), new Date(Date.now()+(cp?Math.max(1,so(cfg.tam_dung_gio,24))*3600e3:2*3600e3)).toISOString(), nowISO(), v.id).run(); cap++; }
  return {cap, loi}; }
const TU_KHOA_LEAD=/giá|bao nhiêu|mua ở đâu|mua đâu|inbox|ib\b|liên hệ|địa chỉ|đại lý|sdt|số điện thoại|báo giá|ship/i;
// B16: chấm bằng chứng (luật cứng) + nghi ngờ + lead từ bình luận hỏi mua (giao MKT, luôn người) + hiệu quả nhóm/tài khoản
async function chamSeeding(env, v, kiem){
  const cfg=(await docCauHinh(env)).seeding||{}; const bt=await env.DB.prepare(`SELECT * FROM bien_the WHERE id=?`).bind(v.bien_the_id).first()||{}; const ly=[]; let kq='DAT';
  if(kiem.song===false){ kq='KHONG_DAT'; ly.push('bài không còn / bị gỡ'); }
  const khop=kiem.noi_dung!=null&&kiem.noi_dung!==''?Math.round(giongVanBan(bt.noi_dung, kiem.noi_dung)*100):null; if(khop!=null && khop<so(cfg.khop_toi_thieu,70)){ kq='KHONG_DAT'; ly.push('nội dung chỉ khớp '+khop+'%'); }
  if(v.link){ const tr=await env.DB.prepare(`SELECT id FROM viec_seeding WHERE link=? AND id<>? AND trang_thai<>'HUY'`).bind(v.link, v.id).first(); if(tr){ kq='NGHI_NGO'; ly.push('link trùng việc '+tr.id); } }
  if(soAn(kiem.react)>0){ const tv=await env.DB.prepare(`SELECT AVG(json_extract(kiem,'$.react')) r FROM viec_seeding WHERE nhom_id=? AND trang_thai='DAT'`).bind(v.nhom_id).first().catch(()=>null); const x=so(cfg.react_bat_thuong_x,5); if(tv&&so(tv.r)>0&&soAn(kiem.react)>so(tv.r)*x){ kq='NGHI_NGO'; ly.push('react '+kiem.react+' gấp '+x+'× trung bình nhóm'); } }
  // lead: bình luận hỏi mua/giá (Trạm liệt kê) hoặc từ khoá
  // 007b: bình luận dưới bài → AI phân loại (hỏi mua / giá / kỹ thuật / tiêu cực) + gợi ý trả lời; người vẫn là người trả lời; bỏ bình luận của chính tài khoản seeding
  let lead=0; const tkNhan=new Set((await env.DB.prepare(`SELECT nhan FROM tai_khoan_seeding`).all()).results.map(x=>String(x.nhan||'').toLowerCase()).filter(Boolean));
  const dsBL=(Array.isArray(kiem.binh_luan_ds)?kiem.binh_luan_ds:[]).slice(0,30).map(c=>({nguoi:chuoi((c&&c.nguoi)||'',120), text:chuoi((c&&c.text)||c,500), link:chuoi((c&&c.link)||v.link,500)})).filter(c=>c.text&&!tkNhan.has(c.nguoi.toLowerCase()));
  const moi=[]; const daThay=new Set(); for(const c of dsBL){ if(daThay.has(c.text)) continue; daThay.add(c.text); const cu=await env.DB.prepare(`SELECT id FROM lead_seeding WHERE viec_id=? AND noi_dung_hoi=?`).bind(v.id, c.text).first(); if(!cu) moi.push(c); }
  if(moi.length){ const pl=await phanLoaiBinhLuan(env, bt, moi); for(const c of pl){ if(c.loai==='KHAC') continue; const lid=uid('ld'); const laLead=['HOI_MUA','HOI_GIA','HOI_KY_THUAT'].includes(c.loai);
      await env.DB.prepare(`INSERT INTO lead_seeding (id,viec_id,nguoi,noi_dung_hoi,link_bl,trang_thai,loai,muc_do,goi_y,created_at) VALUES (?,?,?,?,?,'MOI',?,?,?,?)`).bind(lid, v.id, c.nguoi, c.text, c.link, c.loai, so(c.muc_do), c.goi_y||'', nowISO()).run();
      await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'), laLead?'LEAD_SEEDING':'XU_LY_TIEU_CUC', (laLead?({HOI_MUA:'Trả lời người hỏi mua',HOI_GIA:'Trả lời người hỏi giá',HOI_KY_THUAT:'Trả lời hỏi kỹ thuật'})[c.loai]:'Bình luận tiêu cực dưới bài seeding')+': "'+c.text.slice(0,60)+'"', 'lead_seeding', lid, 'MARKETING', ngayVN(so(c.muc_do)>=3?0:864e5), 'Máy (B16)', 'Người: '+(c.nguoi||'?')+' · '+(v.link||'')+(c.goi_y?(' · gợi ý: '+c.goi_y):'')+' — máy không tự trả lời', nowISO()).run(); if(laLead) lead++; } }
  const kiemMoi={...(docJSON(v.kiem,{})), song:kiem.song!==false, noi_dung:kiem.noi_dung!=null?String(kiem.noi_dung).slice(0,1500):undefined, react:soAn(kiem.react), binh_luan:soAn(kiem.binh_luan), khop, lead, nguon:kiem.nguon, ['lan'+(so(v.so_lan_kiem)+1)]:{react:soAn(kiem.react), binh_luan:soAn(kiem.binh_luan), luc:nowISO()}, cham_luc:nowISO()};
  await env.DB.prepare(`UPDATE viec_seeding SET trang_thai=?, kiem=?, so_lan_kiem=so_lan_kiem+1, ly_do=?, quyet_boi=?, quyet_at=?, updated_at=? WHERE id=?`).bind(kq, JSON.stringify(kiemMoi).slice(0,8000), ly.join('; '), 'Máy (B16)', nowISO(), nowISO(), v.id).run();
  if(so(v.so_lan_kiem)===0) for(const [bang,id,col] of [['nhom_seeding',v.nhom_id,'hieu_qua'],['tai_khoan_seeding',v.tai_khoan_id,'suc_khoe']]){ if(!id) continue; const h=await env.DB.prepare(`SELECT ${col} c FROM ${bang} WHERE id=?`).bind(id).first(); if(!h) continue; const hq=docJSON(h.c,{}); hq.tong=so(hq.tong)+1; if(kq==='DAT') hq.dat=so(hq.dat)+1; if(kq==='KHONG_DAT'&&kiem.song===false) hq.go=so(hq.go)+1; hq.react=so(hq.react)+soAn(kiem.react); hq.binh_luan=so(hq.binh_luan)+soAn(kiem.binh_luan); hq.lead=so(hq.lead)+lead; await env.DB.prepare(`UPDATE ${bang} SET ${col}=? WHERE id=?`).bind(JSON.stringify(hq), id).run(); }
  if(kq==='NGHI_NGO') await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'SEEDING_NGHI_NGO','Seeding nghi ngờ: '+ly[0],'viec_seeding',v.id,'MARKETING',ngayVN(Date.now()+2*864e5),'Máy (B16)',ly.join('; ')+' — vào Seeding để quyết',nowISO()).run();
  return {kq, ly, khop, lead};
}
async function napSeedingKiem(env, dong){ let cap=0; const loi=[]; for(const d of dong){ const v=d.viec_id?await env.DB.prepare(`SELECT * FROM viec_seeding WHERE id=?`).bind(String(d.viec_id)).first():null; if(!v||!['DA_DANG','DAT','CHO_QUAN_TRI'].includes(v.trang_thai)){ loi.push('không thấy/chưa đăng: '+(d.viec_id||'?')); continue; }
    if(d.loi&&d.song!==false){ await env.DB.prepare(`UPDATE viec_seeding SET kiem=?, updated_at=? WHERE id=?`).bind(JSON.stringify({...docJSON(v.kiem,{}), loi:chuoi(d.loi,300), kiem_luc:nowISO()}), nowISO(), v.id).run(); continue; }
    if(v.trang_thai==='CHO_QUAN_TRI' && d.song!==false && d.da_len===true){ await env.DB.prepare(`UPDATE viec_seeding SET trang_thai='DA_DANG', dang_at=COALESCE(dang_at,?), link=COALESCE(NULLIF(?,''),link), updated_at=? WHERE id=?`).bind(nowISO(), chuoi(d.link,500), nowISO(), v.id).run(); v.trang_thai='DA_DANG'; await lenBinhLuan(env, {...v, link:chuoi(d.link,500)||v.link, dang_at:v.dang_at||nowISO()}); }
    await chamSeeding(env, v, {song:d.song!==false, noi_dung:d.noi_dung!=null?chuoi(d.noi_dung,3000):null, react:soAn(d.react), binh_luan:soAn(d.binh_luan), binh_luan_ds:Array.isArray(d.binh_luan_ds)?d.binh_luan_ds:[], nguon:'TRAM'}); cap++; } return {cap, loi}; }
// B17: học seeding → đề xuất G4: tắt nhóm bị gỡ nhiều/đạt thấp, ưu tiên thông điệp/giọng kéo tương tác & lead, giờ vàng thật
async function chayHocSeeding(env, {ep=false}={}){
  const cfg=(await docCauHinh(env)).hoc||{}; const cs=(await docCauHinh(env)).seeding||{}; const minMau=Math.max(2,so(cfg.min_mau,5)); const ky=thangSau(thangHienTai(),-1);
  const cu=await env.DB.prepare(`SELECT COUNT(*) n FROM de_xuat WHERE ky=? AND loai LIKE 'SEEDING_%'`).bind(ky).first(); if(so(cu&&cu.n)&&!ep) return {bo_qua:'Tháng '+ky+' đã có đề xuất seeding'};
  const tu=new Date(Date.now()-60*864e5).toISOString(); const ds=[]; const tt=(r)=>so(r.react)+2*so(r.bl)+5*so(r.lead);
  const nhom=(await env.DB.prepare(`SELECT n.id, n.ten, SUM(CASE WHEN v.trang_thai='DAT' THEN 1 ELSE 0 END) dat, SUM(CASE WHEN json_extract(v.kiem,'$.song')=0 THEN 1 ELSE 0 END) go, COUNT(*) tong FROM viec_seeding v JOIN nhom_seeding n ON n.id=v.nhom_id WHERE v.created_at>=? AND v.trang_thai IN ('DAT','KHONG_DAT','NGHI_NGO') GROUP BY n.id`).bind(tu).all()).results;
  for(const n of nhom){ if(so(n.tong)<minMau) continue; if(so(n.go)/so(n.tong)*100>=so(cs.nhom_go_bai_pct,40)) ds.push({loai:'SEEDING_NHOM', tieu_de:'Tắt nhóm "'+n.ten+'" ('+Math.round(so(n.go)/so(n.tong)*100)+'% bài bị gỡ trên '+n.tong+' bài)', noi_dung:{nhom_id:n.id, tat:true}, bang_chung:{[n.ten]:{bai:so(n.tong), bi_go:so(n.go), dat:so(n.dat)}}, ly_do:'quản trị nhóm gỡ bài liên tục — nhóm không hợp hoặc quy tắc chưa khai đúng'}); }
  const theo=async(cot,ten)=>(await env.DB.prepare(`SELECT b.${cot} k, COUNT(*) tong, AVG(COALESCE(json_extract(v.kiem,'$.react'),0)) react, AVG(COALESCE(json_extract(v.kiem,'$.binh_luan'),0)) bl, SUM(COALESCE(json_extract(v.kiem,'$.lead'),0)) lead FROM viec_seeding v JOIN bien_the b ON b.id=v.bien_the_id WHERE v.created_at>=? AND v.trang_thai='DAT' GROUP BY b.${cot}`).bind(tu).all()).results.filter(g=>g.k&&so(g.tong)>=minMau).sort((a,b)=>tt(b)-tt(a));
  const gi=await theo('giong','giọng'); if(gi.length>=2 && tt(gi[0])>=1.5*Math.max(1,tt(gi[gi.length-1]))) ds.push({loai:'SEEDING_GIONG', tieu_de:'Ưu tiên giọng "'+gi[0].k+'" (tương tác/bài gấp ≥1.5× giọng '+gi[gi.length-1].k+')', noi_dung:{giong_uu_tien:gi[0].k}, bang_chung:Object.fromEntries(gi.map(g=>[g.k,{bai:so(g.tong), react_tb:Math.round(so(g.react)), bl_tb:Math.round(so(g.bl)), lead:so(g.lead)}])), ly_do:'máy sẽ xếp tài khoản giọng này trước'});
  const td=await theo('thong_diep_id','thông điệp'); if(td.length>=2 && tt(td[0])>=1.5*Math.max(1,tt(td[td.length-1]))){ const t0=await env.DB.prepare(`SELECT ten FROM thong_diep_seeding WHERE id=?`).bind(td[0].k).first(); ds.push({loai:'SEEDING_THONG_DIEP', tieu_de:'Thông điệp "'+((t0&&t0.ten)||td[0].k)+'" kéo tương tác/lead tốt nhất — tăng tần suất', noi_dung:{thong_diep_id:td[0].k, uu_tien:true}, bang_chung:Object.fromEntries(td.map(g=>[g.k,{bai:so(g.tong), react_tb:Math.round(so(g.react)), lead:so(g.lead)}])), ly_do:'máy sẽ chọn thông điệp này thường hơn khi soạn gói định kỳ'}); }
  for(const d of ds) await env.DB.prepare(`INSERT INTO de_xuat (id,ky,loai,tieu_de,noi_dung,bang_chung,ly_do,trang_thai,created_at) VALUES (?,?,?,?,?,?,?,'CHO',?)`).bind(uid('dx'), ky, d.loai, d.tieu_de, JSON.stringify(d.noi_dung), JSON.stringify(d.bang_chung), d.ly_do, nowISO()).run();
  return {ok:true, ghi:ds.length, tom_tat:ds.length?('Đề xuất seeding: '+ds.map(d=>d.loai).join(', ')):('Chưa đủ bằng chứng seeding (mỗi nhóm/giọng/thông điệp cần ≥ '+minMau+' bài)')};
}

// ============================================================
//  AGENT ĐIỀU PHỐI — cron 15' gọi vào; mỗi agent chốt 1 lượt/ngày đúng giờ; "chạy thử" ghi thu=1
//  Đăng ký agent: {ma, ten, loai:'HE_THONG'|'THUC_HIEN'|'HOC', buoc, chay(env,ctx)→{ok,tom_tat,doc,ghi,chi_tiet,bo_qua}}
//  THUC_HIEN chỉ chạy khi bước ở AI_GOI_Y/AI_TU_LAM; HOC chỉ khi bước có hoc=BẬT. (Các agent tầng khác thêm ở ADR sau.)
// ============================================================
const AGENTS = [
  { ma:'TINH_SAN_SANG', ten:'Chấm điểm sẵn sàng 12 bước', loai:'HE_THONG', buoc:null,
    chay: async (env)=>{ const kq=[]; for(const b of BUOC) kq.push(await tinhSanSang(env,b.ma)); const co=kq.filter(x=>x.so_mau>0); const dn=await deNghiGat(env);
      return { ok:true, doc:kq.reduce((s,x)=>s+x.so_mau,0), ghi:BUOC.length, tom_tat: (co.length? ('Đã chấm '+co.length+' bước có mẫu: '+co.map(x=>x.buoc+'='+x.san_sang+'/100 ('+x.so_mau+' mẫu)').join(', ')) : 'Chưa có mẫu học nào — mọi bước 0/100')+(dn.len||dn.xuong?(' · đề nghị gạt lên '+dn.len+' · hạ '+dn.xuong):''), chi_tiet:{buoc:kq, de_nghi:dn} }; } },
  // ADR-006 · B6: hoàn thiện bài post/carousel đã duyệt thành bài đăng. AI_GOI_Y: bài đăng CHUẨN BỊ (người xem rồi lên lịch); AI_TU_LAM: lên lịch luôn theo ngày đăng dự kiến (hoặc giờ gợi ý)
  { ma:'HOAN_THIEN_BAI', ten:'Hoàn thiện post/carousel đã duyệt → bài đăng', loai:'THUC_HIEN', buoc:'B6',
    chay: async (env)=>{ const b6=await mucBuoc(env,'B6'); const goiY=((await docCauHinh(env)).hoc||{}).goi_y||{}; const gioGoiY=goiY.GIO_DANG&&goiY.GIO_DANG.khung?so(String(goiY.GIO_DANG.khung).slice(0,2)):19;
      const ds=(await env.DB.prepare(`SELECT n.*, m.ngay_dang, m.kenh_id muc_kenh, m.giai_doan FROM noi_dung n JOIN muc_noi_dung m ON m.id=n.muc_id WHERE n.trang_thai='DUYET' AND n.dinh_dang IN ('POST','CAROUSEL') AND m.giai_doan='SAN_XUAT' AND NOT EXISTS (SELECT 1 FROM bai_dang b WHERE b.noi_dung_id=n.id) LIMIT 20`).all()).results;
      if(!ds.length) return {bo_qua:'Không có post/carousel đã duyệt chờ hoàn thiện'}; let tao=0; const bo=[];
      for(const n of ds){ const kenhId=n.kenh_id||n.muc_kenh; const kenh=kenhId?await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(kenhId).first():null; if(!kenh){ bo.push((n.tieu_de||n.id)+': chưa có kênh'); continue; }
        const ngay=laNgay(n.ngay_dang)&&n.ngay_dang>=ngayVN()?n.ngay_dang:ngayVN(); const gio=new Date(ngay+'T'+String(gioGoiY).padStart(2,'0')+':00:00+07:00').toISOString(); const len=b6.nguoi_thuc_hien==='AI_TU_LAM';
        await env.DB.prepare(`INSERT INTO bai_dang (id,noi_dung_id,muc_id,kenh_id,gio_dang,cach,noi_dung_dang,media_url,link,trang_thai,created_at,created_by_name,updated_at) VALUES (?,?,?,?,?,?,?,?,'',?,?,?,?)`).bind(uid('bd'), n.id, n.muc_id, kenh.id, gio, kenh.cach_dang||'TAY', banDang(n), docJSON(n.chi_tiet,{}).anh_url||'', len?'DA_LEN_LICH':'CHUAN_BI', nowISO(), 'Máy (B6)', nowISO()).run(); tao++;
        if(!len) await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'LEN_LICH','Xem bản đăng & lên lịch: '+(n.tieu_de||n.hook).slice(0,70),'noi_dung',n.id,b6.vai_tro_nguoi||'MARKETING',ngay,'Máy (B6)','Máy đã soạn bản đăng cuối (bài đăng ở trạng thái Chuẩn bị) — mở thẻ › Đăng để xem/sửa rồi lên lịch',nowISO()).run(); }
      return { ok:true, doc:ds.length, ghi:tao, tom_tat:'Hoàn thiện '+tao+' bài ('+(b6.nguoi_thuc_hien==='AI_TU_LAM'?'đã lên lịch':'chuẩn bị, chờ người lên lịch')+')'+(bo.length?(' · bỏ '+bo.length+': '+bo[0]):'') }; } },
  // ADR-002 · B1: gom trend mỗi sáng. Ở mức NGƯỜI máy chỉ gom + chấm (người quyết → mẫu học); ở AI_TU_LAM máy tự duyệt ý tưởng đủ điểm & không rủi ro.
  { ma:'GOM_TREND', ten:'Gom trend & ý tưởng (Google Trends, YouTube)', loai:'HE_THONG', buoc:'B1',
    chay: async (env)=>{ const nguon={}; const ds=[];
      try{ const g=await layGoogleTrends(); ds.push(...g); nguon.google_trends=g.length; }catch(e){ nguon.google_trends='lỗi: '+e.message; }
      try{ const y=await layYouTubeVN(env); ds.push(...(y.ds||[])); nguon.youtube=y.bo_qua||(y.ds||[]).length; }catch(e){ nguon.youtube='lỗi: '+e.message; }
      if(!ds.length) return { ok:false, tom_tat:'Không lấy được trend nào', chi_tiet:{nguon} };
      const kq=await gomYTuong(env, ds, 'Agent');
      return { ok:true, doc:ds.length, ghi:kq.them, tom_tat:'Gom '+ds.length+' → '+kq.them+' ý tưởng mới ('+kq.cham+' AI chấm, '+kq.tu_duyet+' tự duyệt) · trùng '+kq.trung+' · lệch từ khoá '+kq.lech_tu_khoa, chi_tiet:{nguon, ...kq.chi_tiet} }; } },
  // B2: ngày ngay_de_xuat, máy lập bản đề xuất tháng sau nếu chưa có (chỉ khi B2 ở AI_GOI_Y — người vẫn phải chốt G2)
  { ma:'DE_XUAT_KE_HOACH', ten:'Đề xuất kế hoạch tháng sau', loai:'THUC_HIEN', buoc:'B2',
    chay: async (env)=>{ const cfg=(await docCauHinh(env)).ke_hoach||{}; const ngay=Number(ngayVN().slice(8,10)); if(ngay<so(cfg.ngay_de_xuat,25)) return {bo_qua:'Chưa tới ngày '+so(cfg.ngay_de_xuat,25)};
      const thang=thangSau(thangHienTai(),1); const cu=await env.DB.prepare(`SELECT thang FROM ke_hoach_thang WHERE thang=?`).bind(thang).first(); if(cu) return {bo_qua:'Tháng '+thang+' đã có bản kế hoạch'};
      const dx=await deXuatKeHoach(env, thang, 0);
      await env.DB.prepare(`INSERT INTO ke_hoach_thang (thang,trang_thai,chi_tieu,dinh_huong,nguon,ly_do,de_xuat,de_xuat_at,updated_at,updated_by_name) VALUES (?,'DE_XUAT',?,?,'DE_XUAT',?,?,?,?,?)`).bind(thang, JSON.stringify(dx.chi_tieu), '', JSON.stringify(dx.ly_do), JSON.stringify(dx.chi_tieu), nowISO(), nowISO(), 'Máy').run();
      await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'CHOT_KE_HOACH','Chốt kế hoạch tháng '+thang+' (G2)','ke_hoach_thang',thang,'TRUONG_MKT',thangHienTai()+'-28','Máy','Máy đã lập bản đề xuất từ chiến lược + thực tế tháng '+dx.tu_thang,nowISO()).run();
      return { ok:true, ghi:1, tom_tat:'Đã lập đề xuất kế hoạch '+thang+' ('+dx.chi_tieu.tong_bai+' bài) và giao Trưởng MKT chốt', chi_tiet:dx }; } },
  // B3: với kế hoạch đã CHỐT của tháng này và tháng sau, máy tạo mục còn thiếu theo tuần
  { ma:'CHIA_TUAN', ten:'Chia tuần & tạo mục còn thiếu', loai:'THUC_HIEN', buoc:'B3',
    chay: async (env)=>{ let tao=0; const ct=[]; for(const th of [thangHienTai(), thangSau(thangHienTai(),1)]){ const kh=await env.DB.prepare(`SELECT trang_thai FROM ke_hoach_thang WHERE thang=?`).bind(th).first(); if(!kh||kh.trang_thai!=='CHOT') continue; const r=await taoMucConThieu(env, th, 'Máy (B3)'); if(r.ok){ tao+=r.tao; ct.push(th+': +'+r.tao); } }
      if(!ct.length) return {bo_qua:'Chưa có kế hoạch tháng nào đã chốt'}; return { ok:true, ghi:tao, tom_tat:'Tạo '+tao+' mục còn thiếu ('+ct.join(', ')+')' }; } },
  // ADR-003 · B4: máy soạn nháp cho mục Ý TƯỞNG tuần này + tuần sau chưa có nội dung. AI_GOI_Y: để NHÁP cho người xem; AI_TU_LAM: gửi duyệt luôn (vẫn qua G3)
  { ma:'SOAN_NHAP', ten:'Soạn nháp nội dung cho mục kế hoạch', loai:'THUC_HIEN', buoc:'B4',
    chay: async (env)=>{ if(!env.ANTHROPIC_API_KEY) return {bo_qua:'Chưa cắm ANTHROPIC_API_KEY'}; const cfg=(await docCauHinh(env)).noi_dung||{}; const toiDa=Math.max(1,so(cfg.soan_nhap_toi_da_ngay,5)); const b4=await mucBuoc(env,'B4');
      const hn=ngayVN(); const tuanNay=tuanCuaNgay(hn); const thangNay=thangHienTai();
      const muc=(await env.DB.prepare(`SELECT m.* FROM muc_noi_dung m WHERE m.giai_doan='Y_TUONG' AND m.dinh_dang IS NOT NULL AND NOT EXISTS (SELECT 1 FROM noi_dung n WHERE n.muc_id=m.id) AND ((m.thang=? AND COALESCE(m.tuan,99)<=?) OR m.thang=?) ORDER BY m.thang, m.tuan LIMIT ?`).bind(thangNay, tuanNay+1, thangSau(thangNay,1), toiDa).all()).results;
      if(!muc.length) return {bo_qua:'Không có mục nào cần soạn (cần định dạng, chưa có nội dung, tuần này/tuần sau)'};
      let soan=0, gui=0, choMay=0; const loi=[]; let usd=0;
      for(const m of muc){ if(await env.DB.prepare(`SELECT id FROM ai_viec WHERE tinh_nang='soan_nhap_agent' AND trang_thai IN ('CHO','DANG') AND ngu_canh LIKE ?`).bind('%"muc_id":"'+m.id+'"%').first()){ choMay++; continue; }
        const angle=await angleFootage(env, m.id, m.dinh_dang, m.ghi_chu);
        const r=await aiVietNoiDung(env,{dinh_dang:m.dinh_dang, tieu_de:m.tieu_de, framework_id:m.framework_id, san_pham_id:m.san_pham_id, kenh_id:m.kenh_id, pillar_id:m.pillar_id, muc_tieu:m.muc_tieu, angle}, null, 'soan_nhap_agent', {loai:'soan_nhap', muc_id:m.id});
        if(r.cho_may){ choMay++; continue; } if(!r.ok){ loi.push(m.tieu_de+': '+r.loi); if(r.vuot_ngan_sach) break; continue; }
        const t=await taoNoiDung(env,{...r.noi_dung, muc_id:m.id, ly_do_may:'Soạn từ mục kế hoạch · '+(r.so_vi_du?(r.so_vi_du+' ví dụ đã duyệt'):'chưa có ví dụ')}, MAY('Máy (B4)')); if(!t.ok){ loi.push(m.tieu_de+': '+t.loi); continue; } soan++; await ganMauAI(env,'soan_nhap_agent','noi_dung',t.id);
        if(b4.nguoi_thuc_hien==='AI_TU_LAM'){ const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(t.id).first(); const g=await guiDuyet(env, nd, MAY('Máy (B4)')); if(g.ok&&!g.tu_tra_lai) gui++; } }
      return { ok:soan>0||!loi.length, doc:muc.length, ghi:soan, tom_tat:'Soạn '+soan+'/'+muc.length+' bài'+(choMay?(' · '+choMay+' chờ mô hình mở trên máy ghép'):'')+(gui?(' · gửi duyệt '+gui):'')+(loi.length?(' · lỗi '+loi.length):''), chi_tiet:{loi:loi.slice(0,10)} }; } },
  // B4 học: bản nháp bóng cho bài người gửi duyệt 7 ngày gần đây chưa có mẫu (tối đa N/ngày, ngân sách học)
  { ma:'HOC_SOAN_NHAP', ten:'Bản nháp bóng — máy học cách người soạn', loai:'HOC', buoc:'B4',
    chay: async (env)=>{ if(!env.ANTHROPIC_API_KEY) return {bo_qua:'Chưa cắm ANTHROPIC_API_KEY'}; const cfg=(await docCauHinh(env)).noi_dung||{}; const toiDa=Math.max(1,so(cfg.hoc_toi_da_ngay,5)); const tu=new Date(Date.now()-7*864e5).toISOString();
      const ds=(await env.DB.prepare(`SELECT n.* FROM noi_dung n WHERE n.tao_boi='NGUOI' AND n.trang_thai IN ('CHO_DUYET','DUYET','TRA_LAI') AND n.updated_at>=? AND NOT EXISTS (SELECT 1 FROM mau_hoc h WHERE h.buoc='B4' AND h.doi_tuong_id=n.id) ORDER BY n.updated_at DESC LIMIT ?`).bind(tu, toiDa).all()).results;
      if(!ds.length) return {bo_qua:'Không có bài mới của người để học'}; let hoc=0; const gs=[]; const loi=[];
      for(const nd of ds){ const r=await banNhapBong(env, nd); if(r.ok){ hoc++; gs.push(r.giong); } else { loi.push(r.loi); if(r.vuot_ngan_sach) break; } }
      return { ok:hoc>0, doc:ds.length, ghi:hoc, tom_tat:'Học '+hoc+' bài · giống trung bình '+(gs.length?(gs.reduce((s,x)=>s+x,0)/gs.length*100).toFixed(0):0)+'%'+(loi.length?(' · lỗi: '+loi[0]):''), chi_tiet:{giong:gs} }; } },
  // B9: đăng bài tới giờ (mỗi 15'); B9 NGƯỜI → giao việc đăng tay
  { ma:'DANG_BAI', ten:'Đăng bài tới giờ (API / n8n / giao đăng tay)', loai:'HE_THONG', buoc:'B9', nhip:'15p', chay: async (env)=>chayDangBai(env) },
  // ADR-005 · B10 đo lường hằng ngày (API + số Trạm); B11 báo cáo tuần (thứ Hai) / tháng (ngày cấu hình); B12 đề xuất sau báo cáo tháng
  { ma:'DO_LUONG', ten:'Đo lường bài đã đăng (Graph / YouTube / Trạm)', loai:'HE_THONG', buoc:'B10', chay: async (env)=>chayDoLuong(env) },
  { ma:'BAO_CAO', ten:'Báo cáo tuần / tháng', loai:'HE_THONG', buoc:'B11',
    chay: async (env, ctx)=>{ const cfg=(await docCauHinh(env)).bao_cao||{}; const d=new Date(Date.now()+7*36e5); const ra=[]; if(ctx&&ctx.thu){ ra.push(await taoBaoCao(env,'TUAN',{ep:true})); return {...ra[0], tom_tat:'(thử) '+ra[0].tom_tat}; }
      if(d.getUTCDay()===1) ra.push(await taoBaoCao(env,'TUAN')); if(d.getUTCDate()===so(cfg.ngay_bao_cao_thang,1)) ra.push(await taoBaoCao(env,'THANG'));
      const lam=ra.filter(r=>r.ok); if(!ra.length) return {bo_qua:'Không phải ngày báo cáo (thứ Hai / ngày '+so(cfg.ngay_bao_cao_thang,1)+')'}; if(!lam.length) return {bo_qua:ra.map(r=>r.bo_qua).join('; ')}; return {ok:true, ghi:lam.length, tom_tat:lam.map(r=>r.tom_tat).join(' | ')}; } },
  // ADR-007 · seeding hội nhóm: B13 gói định kỳ (theo chỉ tiêu/tuần) + gói cho bài chính mới · B14 xếp lịch gói đã duyệt · B15 Trạm đăng (15') · B16 kiểm 2 & 7 ngày · B17 học (ngày 3)
  { ma:'TAO_GOI_SEEDING', ten:'Soạn gói seeding (định kỳ + bài chính mới đăng)', loai:'THUC_HIEN', buoc:'B13',
    chay: async (env)=>{ if(!env.ANTHROPIC_API_KEY) return {bo_qua:'Chưa cắm ANTHROPIC_API_KEY'}; const cfg=(await docCauHinh(env)).seeding||{}; let tao=0; const loi=[];
      const tu=new Date(Date.now()-Math.max(1,so(cfg.goi_tu_dong_ngay,3))*864e5).toISOString(); const ds=(await env.DB.prepare(`SELECT b.* FROM bai_dang b WHERE b.trang_thai='DA_DANG' AND COALESCE(b.posted_at,b.updated_at)>=? AND NOT EXISTS (SELECT 1 FROM goi_seeding g WHERE g.bai_dang_id=b.id) LIMIT 3`).bind(tu).all()).results;
      for(const bd of ds){ const r=await taoGoiSeeding(env,{loai:'BAI_CHINH', bd, tacNhan:MAY('Máy (B13)')}); if(r.ok) tao++; else { loi.push(r.loi); if(r.vuot_ngan_sach) return {ok:false, tom_tat:'Hết ngân sách AI'}; } }
      // gói định kỳ: chỉ tiêu seeding/tuần (kế hoạch tháng) trừ số việc đã có tuần này
      const kh=docKeHoach(await env.DB.prepare(`SELECT * FROM ke_hoach_thang WHERE thang=?`).bind(thangHienTai()).first()); const ctTuan=so(kh&&kh.chi_tieu&&kh.chi_tieu.seeding_tuan)||so(cfg.seeding_tuan_mac_dinh,4);
      const tuTuan=new Date(Date.now()-7*864e5).toISOString(); const daCo=so((await env.DB.prepare(`SELECT COUNT(*) n FROM viec_seeding WHERE created_at>=? AND trang_thai<>'HUY'`).bind(tuTuan).first()||{}).n); const goiMo=so((await env.DB.prepare(`SELECT COUNT(*) n FROM goi_seeding WHERE loai='DINH_KY' AND trang_thai IN ('NHAP','CHO_DUYET','DUYET') AND created_at>=?`).bind(tuTuan).first()||{}).n);
      if(daCo<ctTuan && !goiMo){ const r=await taoGoiSeeding(env,{loai:'DINH_KY', tacNhan:MAY('Máy (B13)'), soBT:Math.min(6, Math.max(1, ctTuan-daCo))}); if(r.ok) tao++; else loi.push(r.loi); }
      if(!tao&&!loi.length) return {bo_qua:'Không cần gói mới (đủ chỉ tiêu tuần '+ctTuan+', không có bài chính mới)'}; return { ok:tao>0, ghi:tao, tom_tat:'Tạo '+tao+' gói seeding'+(loi.length?(' · lỗi: '+loi[0]):'') }; } },
  { ma:'XEP_LICH_SEEDING', ten:'Xếp lịch gói seeding đã duyệt', loai:'THUC_HIEN', buoc:'B14',
    chay: async (env)=>{ await env.DB.prepare(`UPDATE goi_seeding SET trang_thai='HET_HAN' WHERE trang_thai IN ('DUYET','CHO_DUYET') AND han<?`).bind(ngayVN()).run(); const ds=(await env.DB.prepare(`SELECT * FROM goi_seeding WHERE trang_thai='DUYET' ORDER BY created_at LIMIT 20`).all()).results; if(!ds.length) return {bo_qua:'Không có gói seeding đã duyệt chờ xếp lịch'}; let tao=0, khongNhom=false; const bo=[]; for(const g of ds){ const r=await xepLichGoi(env, g, MAY('Máy (B14)')); tao+=r.tao||0; if(r.khong_nhom) khongNhom=true; bo.push(...(r.bo||[])); }
      return { ok:true, doc:ds.length, ghi:tao, tom_tat:'Xếp '+tao+' việc cho '+ds.length+' gói'+(khongNhom?' · chưa khai nhóm seeding':'')+(bo.length?(' · bỏ: '+[...new Set(bo)].slice(0,3).join('; ')):''), chi_tiet:{bo:bo.slice(0,20)} }; } },
  { ma:'DANG_SEEDING', ten:'Đăng seeding tới giờ (Trạm / giao tay)', loai:'HE_THONG', buoc:'B15', nhip:'15p', chay: async (env)=>chayDangSeeding(env) },
  // ADR-007b · bình luận dẫn dắt & nuôi tài khoản tới giờ (15'); lên lịch nuôi + tự chỉnh nhịp (ngày)
  { ma:'BINH_LUAN_SEEDING', ten:'Bình luận dẫn dắt tới giờ (Trạm / giao tay)', loai:'HE_THONG', buoc:'B15', nhip:'15p', chay: async (env)=>chayBinhLuanSeeding(env) },
  { ma:'NUOI_TAI_KHOAN', ten:'Nuôi tài khoản seeding tới giờ (Trạm xem/thả tim)', loai:'HE_THONG', buoc:'B15', nhip:'15p', chay: async (env)=>chayNuoi(env) },
  { ma:'LEN_LICH_NUOI', ten:'Lên lịch nuôi tài khoản hôm nay + tự chỉnh nhịp', loai:'HE_THONG', buoc:null, chay: async (env)=>{ const a=await lenLichNuoi(env); const b=await chinhNhipSeeding(env); return { ok:true, ghi:so(a.tao)+so(b.ghi), tom_tat:'Lên lịch nuôi '+so(a.tao)+' tài khoản · '+(b.tom_tat||b.bo_qua) }; } },
  { ma:'KIEM_SEEDING', ten:'Kiểm & đo bài seeding (2 & 7 ngày) qua Trạm', loai:'THUC_HIEN', buoc:'B16',
    chay: async (env)=>{ const cfg=(await docCauHinh(env)).seeding||{}; const han=new Date(Date.now()-Math.max(1,so(cfg.ngay_kiem_toi_da,10))*864e5).toISOString();
      const qua=(await env.DB.prepare(`SELECT id FROM viec_seeding WHERE trang_thai IN ('DA_DANG','CHO_QUAN_TRI') AND dang_at<? AND so_lan_kiem=0`).bind(han).all()).results; for(const v of qua){ await env.DB.prepare(`UPDATE viec_seeding SET trang_thai='NGHI_NGO', ly_do=?, quyet_boi='Máy (B16)', quyet_at=?, updated_at=? WHERE id=?`).bind('không kiểm được bằng chứng sau '+so(cfg.ngay_kiem_toi_da,10)+' ngày', nowISO(), nowISO(), v.id).run(); await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'SEEDING_NGHI_NGO','Seeding chưa kiểm được: việc '+v.id,'viec_seeding',v.id,'MARKETING',ngayVN(Date.now()+2*864e5),'Máy (B16)','Trạm không đọc được bài — người xem rồi quyết',nowISO()).run(); }
      const cho=await env.DB.prepare(`SELECT COUNT(*) n FROM viec_seeding WHERE trang_thai IN ('DA_DANG','DAT','CHO_QUAN_TRI') AND COALESCE(link,'')<>'' AND ((so_lan_kiem=0 AND dang_at<=?) OR (so_lan_kiem=1 AND dang_at<=?))`).bind(new Date(Date.now()-Math.max(0,so(cfg.ngay_kiem,2))*864e5).toISOString(), new Date(Date.now()-Math.max(1,so(cfg.ngay_kiem_2,7))*864e5).toISOString()).first(); const tt=await docTramTrangThai(env); let lenh=null; if(so(cho&&cho.n)&&tt&&tt.song) lenh=await taoLenhTram(env,'chay_agent',{id:'content_os', viec:'seeding_kiem'}, MAY('Máy (B16)'));
      if(!qua.length&&!so(cho&&cho.n)) return {bo_qua:'Không có bài seeding tới hạn kiểm'}; return { ok:true, doc:so(cho&&cho.n)+qua.length, ghi:qua.length, tom_tat:so(cho&&cho.n)+' bài chờ Trạm kiểm'+(lenh?' (đã xếp lệnh)':(tt&&tt.song?'':' · Trạm đang im'))+' · '+qua.length+' quá hạn → nghi ngờ' }; } },
  { ma:'HOC_SEEDING', ten:'Học seeding → đề xuất nhóm/giọng/thông điệp (G4)', loai:'THUC_HIEN', buoc:'B17', chay: async (env, ctx)=>{ const d=new Date(Date.now()+7*36e5); if(!(ctx&&ctx.thu) && d.getUTCDate()!==3) return {bo_qua:'Chạy ngày 3 hằng tháng'}; return chayHocSeeding(env,{ep:!!(ctx&&ctx.thu)}); } },
  // ADR-008 · B8: máy CHUẨN BỊ video nháp — giao kịch bản VIDEO đã duyệt chưa có video cho máy dựng đang bật (B8 vẫn NGƯỜI: người xem, chỉnh, duyệt)
  { ma:'CHUAN_BI_DUNG', ten:'Giao dựng video nháp cho máy ghép', loai:'HE_THONG', buoc:'B8',
    chay: async (env)=>{ const ds=(await env.DB.prepare(`SELECT n.* FROM noi_dung n JOIN muc_noi_dung m ON m.id=n.muc_id WHERE n.trang_thai='DUYET' AND n.dinh_dang='VIDEO' AND m.giai_doan='SAN_XUAT' AND (n.chi_tiet IS NULL OR n.chi_tiet NOT LIKE '%"video_url":"/%' AND n.chi_tiet NOT LIKE '%"video_url":"http%') ORDER BY n.updated_at LIMIT 10`).all()).results; if(!ds.length) return {bo_qua:'Không có kịch bản video đã duyệt chờ dựng'};
      let giao=0, trung=0, loi=''; for(const nd of ds){ const r=await giaoDung(env, nd, {tacNhan:MAY('Máy (B8)')}); if(!r.ok){ loi=r.loi; break; } if(r.trung) trung++; else giao++; }
      if(!giao&&!trung) return {bo_qua:loi||'Không có máy dựng đang bật'}; return { ok:true, doc:ds.length, ghi:giao, tom_tat:'Giao dựng '+giao+' video nháp'+(trung?(' · '+trung+' đang chờ máy'):'') }; } },
  // ADR-009 · bộ não: chấm điểm mô hình mở theo tính năng, đề nghị nâng/hạ mức (người gạt)
  { ma:'NHAN_AI_MO', ten:'Nhận kết quả mô hình mở / máy trễ → API dự phòng', loai:'HE_THONG', buoc:null, nhip:'15p',
    chay: async (env)=>{ const cfg=(await docCauHinh(env)).ai||{}; const han=new Date(Date.now()-Math.max(2,so(cfg.cho_may_phut,10))*60000).toISOString(); let xong=0, du=0;
      for(const v of (await env.DB.prepare(`SELECT * FROM ai_viec WHERE trang_thai='XONG' AND xu_ly=0 LIMIT 20`).all()).results){ await xuLyAIViec(env, v); xong++; }
      for(const v of (await env.DB.prepare(`SELECT * FROM ai_viec WHERE trang_thai IN ('CHO','DANG','HONG') AND xu_ly=0 AND created_at<? LIMIT 10`).bind(han).all()).results){ const r=await chayLaiAPI(env, v); if(r.ok||r.loi) du++; }
      if(!xong&&!du) return {bo_qua:'Không có việc AI mở chờ xử lý'}; return { ok:true, ghi:xong+du, tom_tat:'Nhận '+xong+' kết quả mô hình mở'+(du?(' · '+du+' việc máy trễ → API dự phòng'):'') }; } },
  { ma:'TINH_DINH_TUYEN', ten:'Chấm mô hình mở & đề nghị mức API/BÓNG/MỞ', loai:'HE_THONG', buoc:null,
    chay: async (env)=>{ const r=await tinhDinhTuyen(env); const co=r.kq.filter(x=>x.so_mau>0); return { ok:true, doc:co.length, ghi:r.len, tom_tat: co.length?('Chấm '+co.length+' tính năng: '+co.map(x=>x.tinh_nang+'='+x.diem+'/100 ('+x.so_mau+' mẫu'+(x.de_nghi?(', đề nghị '+x.de_nghi):'')+')').join(', ')):'Chưa có mẫu bóng/nhãn nào' }; } },
  { ma:'HOC_DE_XUAT', ten:'Học từ kết quả → đề xuất cải tiến (G4)', loai:'THUC_HIEN', buoc:'B12',
    chay: async (env, ctx)=>{ const d=new Date(Date.now()+7*36e5); if(!(ctx&&ctx.thu) && d.getUTCDate()!==2) return {bo_qua:'Chạy ngày 2 hằng tháng (sau báo cáo tháng)'}; return chayDeXuat(env,{ep:!!(ctx&&ctx.thu)}); } },
];
async function ghiAgentRun(env, o){
  await env.DB.prepare(`INSERT INTO agent_run (id,agent,buoc,ngay,at,ok,thu,bo_qua_ly_do,tom_tat,doc,ghi,tokens,usd,ms,chi_tiet) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid('run'), o.agent, o.buoc||null, o.ngay||ngayVN(), nowISO(), bool(o.ok), bool(o.thu), o.bo_qua_ly_do||null, chuoi(o.tom_tat,300), so(o.doc), so(o.ghi), so(o.tokens), so(o.usd), so(o.ms), JSON.stringify(o.chi_tiet||{}).slice(0,4000)).run();
  await env.DB.prepare(`DELETE FROM agent_run WHERE id NOT IN (SELECT id FROM agent_run ORDER BY at DESC LIMIT 500)`).run();
}
async function chayMotAgent(env, ag, {thu=false}={}){
  const t0=Date.now(); let r;
  // quyền chạy theo bộ quyền thực hiện
  if(ag.buoc){ const m=await mucBuoc(env, ag.buoc);
    if(ag.loai==='THUC_HIEN' && m.nguoi_thuc_hien==='NGUOI') return {bo_qua:'Bước '+ag.buoc+' đang do NGƯỜI làm'};
    if(ag.loai==='HOC' && !uBool(m.hoc)) return {bo_qua:'Bước '+ag.buoc+' đã tắt học'}; }
  try{ r=await ag.chay(env,{thu}); }catch(e){ r={ok:false, tom_tat:'Lỗi: '+e.message}; }
  if(r&&r.bo_qua){ if(thu) await ghiAgentRun(env,{agent:ag.ma, buoc:ag.buoc, ok:true, thu, bo_qua_ly_do:r.bo_qua, tom_tat:r.bo_qua, ms:Date.now()-t0}); return r; }
  await ghiAgentRun(env,{agent:ag.ma, buoc:ag.buoc, ok:r.ok, thu, tom_tat:r.tom_tat, doc:r.doc, ghi:r.ghi, tokens:r.tokens, usd:r.usd, ms:Date.now()-t0, chi_tiet:r.chi_tiet});
  return r;
}
async function dieuPhoi(env, {thu=false, chi=null}={}){
  await ensureSchema(env);
  const cfg=(await docCauHinh(env)).may||{}; const gio=so(cfg.gio_chay,6); const hn=ngayVN(); const kq=[];
  for(const ag of AGENTS){
    if(chi && ag.ma!==chi) continue;
    // nhịp 15': chạy mỗi lần cron gọi, tự idempotent (chỉ ghi nhật ký khi có việc)
    if(ag.nhip==='15p' && !thu){ const r=await ag.chay(env).catch(e=>({ok:false, tom_tat:'Lỗi: '+e.message})); if(r&&!r.bo_qua) await ghiAgentRun(env,{agent:ag.ma, buoc:ag.buoc, ok:r.ok, tom_tat:r.tom_tat, doc:r.doc, ghi:r.ghi, chi_tiet:r.chi_tiet}); kq.push({agent:ag.ma, ...r}); continue; }
    if(!thu){
      if(gioVN()!==gio){ kq.push({agent:ag.ma, bo_qua:'Chưa tới giờ ('+gio+'h)'}); continue; }
      const da=await env.DB.prepare(`SELECT id FROM agent_run WHERE agent=? AND ngay=? AND ok=1 AND thu=0`).bind(ag.ma,hn).first();
      if(da){ kq.push({agent:ag.ma, bo_qua:'Hôm nay đã chạy'}); continue; }
    }
    kq.push({agent:ag.ma, ...(await chayMotAgent(env, ag, {thu}))});
  }
  return kq;
}

// ============================================================
//  BOOTSTRAP — một nguồn sự thật cho giao diện
// ============================================================
const docJSON=(v,mac)=>{ try{ const o=JSON.parse(v||''); return o==null?mac:o; }catch(e){ return mac; } };
function layToken(env, kenh){ const ma=String((kenh&&kenh.api_ma)||'').trim().toUpperCase().replace(/[^A-Z0-9_]/g,''); return ma? (env['TOKEN_'+ma]||null) : null; }
// ===== KHOÁ API DÁN TỪ GIAO DIỆN (Máy › Bộ não AI › Khoá API) — chủ 24/09 "có UI ở app để ghép khoá" =====
// Ưu tiên: secret Cloudflare (wrangler / dan-khoa.bat) > khoá dán ở app. Khoá dán lưu D1, mã hoá AES-GCM bằng két riêng
// (module_config 'ket'); không bao giờ trả giá trị ra ngoài, chỉ "đã có …4 ký tự cuối". Kém secret Cloudflare một bậc
// (ai đọc được cả D1 lẫn két thì mở được) — đổi lấy việc chủ tự cắm ngay trên app, không cần máy có wrangler.
const KHOA_CHO_PHEP=[['ANTHROPIC_API_KEY','Bộ não Claude: kịch bản, chấm ý tưởng, soạn bài, báo cáo'],['GOOGLE_TTS_KEY','Giọng đọc Google cho video nháp'],['GEMINI_API_KEY','Gemini (dự phòng, rẻ)'],['OPENAI_API_KEY','OpenAI (dự phòng)'],['GROQ_API_KEY','Groq: Llama 3.3 70B rất nhanh'],['DEEPINFRA_API_KEY','DeepInfra: Qwen 72B'],['VLLM_API_KEY','vLLM máy chủ tự thuê'],['YOUTUBE_API_KEY','Xu hướng YouTube Việt Nam'],['N8N_WEBHOOK_URL','n8n: gửi báo cáo Zalo/mail, đăng bài'],['N8N_TOKEN','n8n: khoá bảo vệ tuyến ingest']];
const tenKhoaHopLe=t=>/^(ANTHROPIC_API_KEY|GOOGLE_TTS_KEY|GEMINI_API_KEY|OPENAI_API_KEY|GROQ_API_KEY|DEEPINFRA_API_KEY|VLLM_API_KEY|YOUTUBE_API_KEY|N8N_WEBHOOK_URL|N8N_TOKEN|TOKEN_[A-Z0-9_]{1,40})$/.test(String(t||''));
let KHOA_CACHE={luc:0, ds:null};
const b64k=b=>btoa(String.fromCharCode(...new Uint8Array(b))), unb64k=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function ketKhoa(env){ const r=await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='ket'`).first(); let k=r?docJSON(r.cau_hinh,{}).k:null;
  if(!k){ k=b64k(crypto.getRandomValues(new Uint8Array(32))); await env.DB.prepare(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES ('ket',?,?,'hệ thống') ON CONFLICT(id) DO UPDATE SET cau_hinh=excluded.cau_hinh`).bind(JSON.stringify({k}), nowISO()).run(); }
  return crypto.subtle.importKey('raw', unb64k(k), 'AES-GCM', false, ['encrypt','decrypt']); }
async function maHoa(env, s){ const key=await ketKhoa(env); const iv=crypto.getRandomValues(new Uint8Array(12)); const ct=await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(s)); return { gia_tri:b64k(ct), iv:b64k(iv) }; }
async function giaiMa(env, r){ try{ const key=await ketKhoa(env); const pt=await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64k(r.iv)}, key, unb64k(r.gia_tri)); return new TextDecoder().decode(pt); }catch(e){ return ''; } }
/** Phủ khoá dán ở app lên env (chỉ khoá env CHƯA có). Trả env mới, giữ mọi binding (DB, MEDIA, ASSETS). */
async function napKhoa(env){
  if(!env||!env.DB||env.__env_goc) return env;
  if(!KHOA_CACHE.ds || Date.now()-KHOA_CACHE.luc>60000){ try{ const ds={}; const rows=(await env.DB.prepare(`SELECT ten,gia_tri,iv,duoi FROM khoa_api`).all()).results; for(const r of rows){ const v=await giaiMa(env,r); if(v) ds[r.ten]={v, duoi:r.duoi}; } KHOA_CACHE={luc:Date.now(), ds}; }catch(e){ return env; } }
  const them={}, app={}; for(const [t,x] of Object.entries(KHOA_CACHE.ds||{})) if(!env[t]){ them[t]=x.v; app[t]=x.duoi; }
  return Object.assign({}, env, them, { __khoa_app: app, __env_goc: env }); }
/** Thử khoá với nhà cung cấp trước khi lưu — gọi nhẹ nhất có thể (danh sách mô hình / giọng, hoặc 5 token). null = không có cách thử. */
async function thuKhoa(ten, key){ try{
  const jOf=async r=>{ try{ return await r.json(); }catch(e){ return {}; } }; const loiCua=(j,r)=>(j&&j.error&&(j.error.message||j.error))||('HTTP '+r.status);
  if(ten==='ANTHROPIC_API_KEY'){ const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:AI_MODEL_MAC_DINH, max_tokens:5, messages:[{role:'user',content:'ping'}]})}); const j=await jOf(r); return r.ok?{ok:true, ghi:'Claude trả lời được'}:{ok:false, loi:String(loiCua(j,r)).slice(0,160)}; }
  if(ten==='GOOGLE_TTS_KEY'){ const r=await fetch('https://texttospeech.googleapis.com/v1/voices?languageCode=vi-VN&key='+encodeURIComponent(key)); const j=await jOf(r); return r.ok?{ok:true, ghi:((j.voices||[]).length)+' giọng vi-VN'}:{ok:false, loi:String(loiCua(j,r)).slice(0,160)}; }
  if(ten==='GEMINI_API_KEY'){ const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?key='+encodeURIComponent(key)); const j=await jOf(r); return r.ok?{ok:true, ghi:((j.models||[]).length)+' mô hình'}:{ok:false, loi:String(loiCua(j,r)).slice(0,160)}; }
  if(ten==='OPENAI_API_KEY'||ten==='GROQ_API_KEY'||ten==='DEEPINFRA_API_KEY'){ const goc=ten==='GROQ_API_KEY'?'https://api.groq.com/openai/v1':ten==='DEEPINFRA_API_KEY'?'https://api.deepinfra.com/v1/openai':'https://api.openai.com/v1'; const r=await fetch(goc+'/models',{headers:{authorization:'Bearer '+key}}); const j=await jOf(r); return r.ok?{ok:true, ghi:((j.data||[]).length)+' mô hình'}:{ok:false, loi:String(loiCua(j,r)).slice(0,160)}; }
  if(ten==='YOUTUBE_API_KEY'){ const r=await fetch('https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=VN&key='+encodeURIComponent(key)); const j=await jOf(r); return r.ok?{ok:true, ghi:'YouTube Data API trả lời'}:{ok:false, loi:String(loiCua(j,r)).slice(0,160)}; }
  return null; }catch(e){ return {ok:false, loi:String(e.message||e).slice(0,120)}; } }
/** Danh sách khoá cho màn Khoá API (Admin): tên, dùng cho, đã có?, nguồn (wrangler | app), 4 ký tự cuối. Không bao giờ có giá trị. */
async function dsKhoaApi(env){ let kenh=[]; try{ kenh=(await env.DB.prepare(`SELECT ten, api_ma FROM kenh WHERE COALESCE(api_ma,'')<>''`).all()).results; }catch(e){}
  const ds=[...KHOA_CHO_PHEP.map(([ten,dung])=>({ten, dung_cho:dung})), ...kenh.map(k=>({ten:'TOKEN_'+String(k.api_ma).toUpperCase().replace(/[^A-Z0-9_]/g,''), dung_cho:'Token đăng bài kênh '+k.ten})).filter(x=>tenKhoaHopLe(x.ten))];
  const app=env.__khoa_app||{}, goc=env.__env_goc||env; let rows=[]; try{ rows=(await env.DB.prepare(`SELECT ten,duoi,updated_at,updated_by_name FROM khoa_api`).all()).results; }catch(e){} const byTen=Object.fromEntries(rows.map(r=>[r.ten,r]));
  return ds.map(d=>{ const wr=!!goc[d.ten]&&!app[d.ten]; return {...d, co:!!env[d.ten], nguon: wr?'wrangler':(byTen[d.ten]?'app':null), duoi: wr?'':(byTen[d.ten]?byTen[d.ten].duoi:'')   /* khoá wrangler chỉ là cờ, không lộ ký tự nào (luật ADR-001) */, luc: byTen[d.ten]?byTen[d.ten].updated_at:null, boi: byTen[d.ten]?byTen[d.ten].updated_by_name:null, thu_duoc: ['ANTHROPIC_API_KEY','GOOGLE_TTS_KEY','GEMINI_API_KEY','OPENAI_API_KEY','GROQ_API_KEY','DEEPINFRA_API_KEY','YOUTUBE_API_KEY'].includes(d.ten)}; }); }
// Claude nhìn một khung hình footage → mô tả ngắn tiếng Việt (để máy dựng chọn cảnh khớp gợi ý hình). Không khoá → bỏ qua.
const CO_CANH=['RONG','TRUNG','CAN','SAN_PHAM','THAO_TAC','NGUOI_NOI','CHU'];
const NHOM_CANH=['BOI_CANH','VAN_DE','GIAI_PHAP','THI_CONG','THU_NGHIEM','HOAN_THIEN','NGUOI_NOI','KHAC'];   // ADR-016: tầng 1 của nhãn hình
function tlSach(arr){ return (Array.isArray(arr)?arr:[]).slice(0,120).map(x=>({ tu:+so(x.tu).toFixed(2), den:+so(x.den).toFixed(2), nhom:NHOM_CANH.includes(x.nhom)?x.nhom:(x.buoc?'THI_CONG':'KHAC'), buoc:chuoi(x.buoc,80)||null, bai_test:chuoi(x.bai_test,80)||null, hanh_dong:chuoi(x.hanh_dong,120), vat_lieu:chuoi(x.vat_lieu,120), co_canh:CO_CANH.includes(x.co_canh)?x.co_canh:null, tham_my:x.tham_my==null?null:Math.max(0,Math.min(10,so(x.tham_my))), ro_net:Math.max(0,Math.min(10,so(x.ro_net))), tu_tin:x.tu_tin==null?null:+Math.max(0,Math.min(1,so(x.tu_tin))).toFixed(2), can_xac_nhan:!!x.can_xac_nhan, kiem_ngau_nhien:!!x.kiem_ngau_nhien, co_nguoi:!!x.co_nguoi, mo_ta:chuoi(x.mo_ta,200), khung_url:/^(https?:|\/)/.test(String(x.khung_url||''))?chuoi(x.khung_url,300):null, mo:nhanGon(x.mo), thay:nhanGon(x.thay), nguon_nhan:['THAY_KHOP','THAY','MO'].includes(x.nguon_nhan)?x.nguon_nhan:null })).filter(x=>x.den>x.tu); }
function nhanGon(x){ if(!x||typeof x!=='object'||!NHOM_CANH.includes(x.nhom)) return null; const mang=v=>(Array.isArray(v)?v:v?[v]:[]).map(y=>chuoi(y,60)).filter(Boolean).slice(0,6); return { nhom:x.nhom, buoc:chuoi(x.buoc,80)||null, bai_test:chuoi(x.bai_test,80)||null, hanh_dong:mang(x.hanh_dong), vat_lieu:mang(x.vat_lieu), dung_cu:mang(x.dung_cu), vi_tri:chuoi(x.vi_tri,60)||null, nguoi:chuoi(x.nguoi,40)||null, co_canh:chuoi(x.co_canh,30)||null, goc_may:chuoi(x.goc_may,40)||null, chuyen_dong:chuoi(x.chuyen_dong,40)||null, tham_my:x.tham_my==null||x.tham_my===''||Number(x.tham_my)<0?null:Math.max(0,Math.min(10,so(x.tham_my))), dung_cho:chuoi(x.dung_cho,40)||null, mo_ta:chuoi(x.mo_ta,200)||null, chac:x.chac==null?null:+Math.max(0,Math.min(1,so(x.chac))).toFixed(2), model:chuoi(x.model,60)||null, ly_do:chuoi(x.ly_do,120)||null }; }
const TEN_NHOM_CANH={ BOI_CANH:'bối cảnh chung: công trình, không gian, ngôi nhà, khung cảnh', VAN_DE:'vấn đề: hư hỏng, mốc, nứt, thấm, bong tróc, xuống cấp', GIAI_PHAP:'giải pháp: sản phẩm, bao bì, logo, giới thiệu sản phẩm', THI_CONG:'thi công: đang làm một bước trong quy trình', THU_NGHIEM:'bài test / chứng minh: đổ nước, chà, cào, đốt, so sánh', HOAN_THIEN:'hoàn thiện: kết quả sau thi công, bề mặt xong, trước–sau', NGUOI_NOI:'người nói trước máy (chuyên gia, chủ nhà, MC)', KHAC:'không thuộc nhóm nào (chữ, đồ hoạ, chuyển cảnh)' };
async function phutNguoiHomNay(env){ return MAU().phutNguoi(env); }
async function hetTran(env, url){ const hl=(await docCauHinh(env)).huan_luyen||{}; const phut=await phutNguoiHomNay(env); return { het:so(hl.tran_phut_ngay)>0&&phut>=so(hl.tran_phut_ngay)&&url.searchParams.get('them')!=='1', phut:+phut.toFixed(1), tran:so(hl.tran_phut_ngay) }; }
// ADR-017 đợt B — K2 CHẤT LƯỢNG SOURCE: số đo ffmpeg của một đoạn footage (nửa giây một mẫu) → luật ngưỡng; người quyết dùng/loại, máy học ngưỡng.
function soDoSource(pt, d){ const m=(Array.isArray(pt.doan)?pt.doan:[]).filter(x=>x.t>=d.tu-0.01&&x.t<d.den); if(!m.length) return null; const tb=k=>+(m.reduce((a,x)=>a+so(x[k]),0)/m.length).toFixed(3);
  return { net:tb('net'), net_min:+Math.min(...m.map(x=>so(x.net))).toFixed(3), dong:tb('dong'), dong_max:+Math.max(...m.map(x=>so(x.dong))).toFixed(3), sang:tb('sang'), ro_net:d.ro_net==null?null:so(d.ro_net) }; }
function luatSource(ng, x){ if(!x) return null; const ly=[]; if(x.net<so(ng.net,0.55)) ly.push('mờ'); if(x.dong>so(ng.dong,0.25)) ly.push('rung'); if(x.sang<so(ng.sang0,0.15)) ly.push('tối'); if(x.sang>so(ng.sang1,0.92)) ly.push('cháy sáng'); return { dung:!ly.length, ly_do:ly }; }
function bienSource(ng, x){ return Math.min(Math.abs(x.net-so(ng.net,0.55))/0.1, Math.abs(x.dong-so(ng.dong,0.25))/0.1, Math.abs(x.sang-so(ng.sang0,0.15))/0.1, Math.abs(x.sang-so(ng.sang1,0.92))/0.1); }   // gần ngưỡng → đáng hỏi người
const hocNguongSource=(env)=>MAU().hocNguong(env);
const thayDocLoi=(env, n)=>MAU().thayDocLoi(env, n);   // ADR-018: thầy đọc lời / kho mẫu / hàng việc ở worker/mau.js
async function dsDongSanPham(env){ await MAU().dam(env); const m={}; const cong=(d,k,v=1)=>{ const key=d||'(chưa có)'; m[key]=m[key]||{dong:key, san_pham:0, video:0, footage:0, mau:0}; m[key][k]+=v; };
  for(const r of (await env.DB.prepare(`SELECT dong, COUNT(*) n FROM san_pham GROUP BY dong`).all()).results) cong(r.dong,'san_pham',r.n);
  for(const r of (await env.DB.prepare(`SELECT dong, COUNT(*) n FROM kho_thanh_pham GROUP BY dong`).all()).results) cong(r.dong,'video',r.n);
  for(const r of (await env.DB.prepare(`SELECT sp.dong, COUNT(*) n FROM tai_san t JOIN muc_noi_dung mu ON mu.id=t.muc_id JOIN san_pham sp ON sp.id=mu.san_pham_id GROUP BY sp.dong`).all()).results) cong(r.dong,'footage',r.n);
  for(const r of (await env.DB.prepare(`SELECT dong, COUNT(*) n FROM (SELECT dong FROM mau_hoc_ai UNION ALL SELECT dong FROM mau_doan WHERE hieu_luc=1) GROUP BY dong`).all()).results) cong(r.dong,'mau',r.n);
  for(const r of (await env.DB.prepare(`SELECT ten FROM bo_nhan WHERE truong='dong' AND trang_thai='DUNG'`).all()).results) cong(r.ten,'san_pham',0);
  const sp=(await env.DB.prepare(`SELECT id, ma, ten, dong FROM san_pham ORDER BY dong, ten`).all()).results;
  return { dong:Object.values(m).sort((a,b)=>(b.video+b.footage+b.mau)-(a.video+a.footage+a.mau)), san_pham:sp, anh_xa_dong:((await docCauHinh(env)).huan_luyen||{}).anh_xa_dong||[] }; }
// ADR-017 — khuôn làn: 1 Gom · 2 Thầy gán · 3 Người xác nhận · 4 Đo · 5 Bóng · 6 Bật. Mỗi ô tính từ dữ liệu thật; làn chưa làm nói rõ đợt nào.
const LAN_HOC=[
  {k:'K1', ten:'Nhận diện khung', dot:'A'}, {k:'K2', ten:'Chất lượng source', dot:'B'}, {k:'K3', ten:'Thẩm mỹ', dot:'C', cho:['K1']},
  {k:'K4', ten:'Đọc lời', dot:'B'}, {k:'K5', ten:'Ghép và nhịp', dot:'D', cho:['K1','K4']}, {k:'K6', ten:'Kiểm kỹ thuật', dot:'D', cho:['K1']} ];
async function banHuanLuyen(env){ const cfg=await docCauHinh(env); const hl=cfg.huan_luyen||{}; const ai=cfg.ai||{}; await MAU().dam(env);
  const sp=(await env.DB.prepare(`SELECT DISTINCT dong FROM san_pham WHERE dong IS NOT NULL AND dong<>''`).all()).results.map(x=>x.dong);
  const th=(await env.DB.prepare(`SELECT phan_tich, dong, created_at FROM kho_thanh_pham ORDER BY created_at DESC`).all()).results;
  const md=(await env.DB.prepare(`SELECT loai, nguon, dong, nhan_mo, nhan_thay, nhan_nguoi, nhan_hinh, kiem, so_do, nguoi_source FROM mau_doan WHERE hieu_luc=1`).all()).results.map(r=>({loai:r.loai, nguon:r.nguon, dong:r.dong||null, mo:docJSON(r.nhan_mo,null), thay:docJSON(r.nhan_thay,null), ng:docJSON(r.nhan_nguoi,null), hinh:docJSON(r.nhan_hinh,null), kiem:!!r.kiem, sd:docJSON(r.so_do,null), src:docJSON(r.nguoi_source,null)}));
  const dongs=[...new Set([...sp, ...th.map(x=>x.dong).filter(Boolean)])]; const hinh=md.filter(x=>x.loai==='HINH');
  const doan=hinh.map(x=>({dong:x.dong, thay:!!x.thay, bat:!!(x.thay&&x.mo&&x.thay.nhom!==x.mo.nhom), nguoi:!!x.ng}));
  const vang=hinh.filter(x=>x.ng&&!x.ng.khong_ro&&x.ng.nhom).map(x=>({v:{ngau_nhien:x.kiem, mo:x.mo, thay:x.thay}, c:x.thay||x.mo||{}, n:x.ng, dong:x.dong}));
  const pct=(a,b)=>b?Math.round(a/b*100):null;
  const k1=(dong)=>{ const ds=doan.filter(x=>!dong||x.dong===dong), vg=vang.filter(x=>!dong||x.dong===dong); const gomCan=so(dong?hl.k1_gom_dong:hl.k1_gom_chung,dong?100:300), vangCan=so(dong?hl.k1_vang_dong:hl.k1_vang_chung,dong?60:200);
    const nThay=ds.filter(x=>x.thay).length, nBat=ds.filter(x=>x.bat).length; const nn=vg.filter(x=>x.v.ngau_nhien);
    const mo=vg.filter(x=>x.v.mo&&x.v.mo.nhom), tay=vg.filter(x=>x.v.thay&&x.v.thay.nhom);
    const so_do={ doan:ds.length, thay:nThay, bat_dong_pct:pct(nBat,nThay), vang:vg.length, dung_ngau_nhien_pct:pct(nn.filter(x=>x.c.nhom===x.n.nhom).length,nn.length), mo_pct:pct(mo.filter(x=>x.v.mo.nhom===x.n.nhom).length,mo.length), thay_pct:pct(tay.filter(x=>x.v.thay.nhom===x.n.nhom).length,tay.length) };
    let chang=1, thieu='cần '+gomCan+' đoạn đã đọc (có '+ds.length+')';
    if(ds.length>=gomCan){ chang=2; thieu='thầy mới đọc '+nThay+'/'+ds.length+' đoạn'; if(nThay>=ds.length*0.8){ chang=3; thieu='cần '+vangCan+' nhãn vàng (có '+vg.length+')'; if(vg.length>=vangCan){ chang=4; thieu='Bóng cần đầu nhận diện học riêng (đợt sau đợt A)'; } } }
    return { chang, thieu, so_do, tien_do:chang===1?pct(ds.length,gomCan):chang===2?pct(nThay,ds.length):chang===3?pct(vg.length,vangCan):null }; };
  const k1Chung=k1(null);
  const o={}; for(const l of LAN_HOC){ o[l.k]={ chung:null, dong:{} }; }
  o.K1.chung=k1Chung; for(const d of dongs) o.K1.dong[d]=k1(d);
  const chuaLam=(l, so_do, gom)=>({ chang:1, chua_lam:true, thieu:'làm ở đợt '+l.dot, so_do, gom });
  // K2 source: thầy = số đo ffmpeg (đã có sẵn khi gom) → chặng 2 qua ngay
  { const nDoan=hinh.filter(x=>x.nguon==='FOOTAGE'&&x.sd).length;
    const sv=hinh.filter(x=>x.src&&typeof x.src.dung==='boolean').map(x=>({v:{so_do:x.sd, ngau_nhien:x.kiem}, n:x.src})); const hocS=hl.source_hoc||null; const ng=hl.source_nguong||{};
    const nn=sv.filter(x=>x.v.ngau_nhien&&x.v.so_do); const gomCan=so(hl.k2_gom,100), vangCan=so(hl.k2_vang,50);
    const so_do={ doan:nDoan, vang:sv.length, luat_khop_pct:pct(sv.filter(x=>x.v.so_do&&luatSource(ng,x.v.so_do).dung===x.n.dung).length, sv.filter(x=>x.v.so_do).length), ngau_nhien_khop_pct:pct(nn.filter(x=>luatSource(ng,x.v.so_do).dung===x.n.dung).length, nn.length), hoc_khop_pct:hocS?hocS.khop_pct:null };
    let chang=1, thieu='cần '+gomCan+' đoạn footage có số đo (có '+nDoan+')'; if(nDoan>=gomCan){ chang=3; thieu='cần '+vangCan+' lần người quyết dùng/loại (có '+sv.length+')'; if(sv.length>=vangCan){ chang=4; thieu=hocS?('ngưỡng học khớp người '+hocS.khop_pct+'% (ngưỡng cũ '+hocS.khop_cu_pct+'%) — Bóng: lọc footage dùng ngưỡng học song song (đợt sau)'):'máy chưa học ngưỡng'; } }
    o.K2.chung={ chang, thieu, so_do, tien_do:chang===1?pct(nDoan,gomCan):chang===3?pct(sv.length,vangCan):null }; }
  // K4 đọc lời: thầy Claude Haiku theo lô; người xác nhận
  { const lv=md.filter(x=>x.loai==='LOI').map(x=>({t:x.thay, n:x.ng?{...x.ng, nguon:'NGUOI'}:(x.hinh||{}), dong:x.dong}));
    const k4=(dong)=>{ const ds=lv.filter(x=>!dong||x.dong===dong); const nThay=ds.filter(x=>x.t).length; const ng=ds.filter(x=>x.n.nguon==='NGUOI'); const ngHieu=ng.filter(x=>!x.n.nghe_sai); const gomCan=so(hl.k4_gom,dong?50:150), vangCan=so(hl.k4_vang,dong?40:100);
      const so_do={ cau:ds.length, thay:nThay, bat_dong_pct:pct(ds.filter(x=>x.t&&x.n.nhom&&x.n.nguon!=='NGUOI'&&x.t.nhom!==x.n.nhom).length, nThay), vang:ng.length, thay_nghe_sai_pct:pct(ds.filter(x=>x.t&&x.t.nghe_sai).length, nThay), thay_pct:pct(ngHieu.filter(x=>x.t&&x.t.nhom===x.n.nhom).length, ngHieu.filter(x=>x.t).length), nghe_sai_pct:pct(ng.filter(x=>x.n.nghe_sai).length, ng.length) };
      let chang=1, thieu='cần '+gomCan+' câu có lời (có '+ds.length+')'; if(ds.length>=gomCan){ chang=2; thieu='thầy mới đọc '+nThay+'/'+ds.length+' câu'; if(nThay>=ds.length*0.8){ chang=3; thieu='cần '+vangCan+' câu người xác nhận (có '+ng.length+')'; if(ng.length>=vangCan){ chang=4; thieu='Bóng cần mô hình mở đọc lời (qwen2.5:7b trên Q2) chạy song song — đợt sau'; } } }
      return { chang, thieu, so_do, tien_do:chang===1?pct(ds.length,gomCan):chang===2?pct(nThay,ds.length):chang===3?pct(ng.length,vangCan):null }; };
    o.K4.chung=k4(null); for(const d of dongs) if(lv.some(x=>x.dong===d)) o.K4.dong[d]=k4(d); }
  const choCua=(l)=>({ cho:l.cho, thieu:'chờ '+l.cho.join(' + ')+' tới Bóng' });
  o.K3.chung=choCua(LAN_HOC[2]); o.K5.chung={...choCua(LAN_HOC[4]), so_do:{video_da_air:th.length}}; o.K6.chung={ cho:['K1'], thieu:'chờ K1 bật' };
  const pbGhep=(await env.DB.prepare(`SELECT COUNT(*) n FROM mo_hinh_phien_ban WHERE tinh_nang='ghep_canh' AND trang_thai='CHO_DUYET'`).first().catch(()=>({n:0})))||{n:0}; if(so(pbGhep.n)) o.K5.chung.ghi_chu=so(pbGhep.n)+' phiên bản ghép cũ đang chờ duyệt ở tab Huấn luyện';
  // nguồn lực
  const may=(await env.DB.prepare(`SELECT id,ten,nhan_luc,than FROM may_ghep WHERE active=1`).all()).results.map(m=>{ const t=docJSON(m.than,{})||{}; return { ten:m.ten, song:Date.now()-Date.parse(m.nhan_luc||0)<5*60e3, dang_lam:t.dang_lam||'', gpu:t.gpu||'', ollama:t.ollama===true, can_nhin:/[6-9]\d{3} MiB|\d{5} MiB/.test(t.gpu||'') }; });
  const hang=(await env.DB.prepare(`SELECT m.ten, COUNT(*) n FROM tram_lenh l JOIN may_ghep m ON m.id=l.may_id WHERE l.trang_thai IN ('CHO','DA_GUI') GROUP BY m.ten`).all()).results;
  for(const m of may) m.hang=so((hang.find(h=>h.ten===m.ten)||{}).n);
  const tg=th.map(r=>(docJSON(r.phan_tich,{})||{}).thoi_gian).filter(Boolean).slice(0,10); const tb={}; for(const x of tg) for(const [k,v] of Object.entries(x)) tb[k]=(tb[k]||0)+so(v)/tg.length; Object.keys(tb).forEach(k=>tb[k]=+tb[k].toFixed(1));
  const thayDa=(await env.DB.prepare(`SELECT COALESCE(SUM(chi_phi_usd),0) usd, COUNT(*) n FROM ai_usage WHERE thang=? AND tinh_nang IN ('hoc_nhan_khung','hoc_doc_loi')`).bind(thangHienTai()).first())||{};
  const cho=doan.filter(x=>!x.nguoi).length;
  return { lan:LAN_HOC, dongs, o, nguon_luc:{ may, thoi_gian_tb:tg.length?{...tb, so_video:tg.length}:null, thay:{ usd:+so(thayDa.usd).toFixed(2), lan:so(thayDa.n), tran_usd:so(ai.ngan_sach_thay_usd), bat:ai.thay_nhin!==false }, nguoi:{ phut_hom_nay:+(await phutNguoiHomNay(env)).toFixed(1), tran_phut:so(hl.tran_phut_ngay), doan_chua_gan:cho } } };
}
const dsDongSP=(v)=>String(v||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,20);
let _mau=null; const MAU=()=>_mau||(_mau=taoMau({ json, uid, nowISO, thangHienTai, ngayVN, chuoi, so, docJSON, isStaff, canGat, logAudit, docCauHinh, ghiAIUsage, kiemNganSachAI, NHOM_CANH, TEN_NHOM_CANH, CO_CANH, dsDongSP, soDoSource, luatSource }));
// ADR-010b: làm sạch phân tích máy con gửi (đoạn 0,5 giây: nét, động, sáng) + khung + cỡ cảnh
function phanTichSach(p, khung, coCanh){ if(!p||typeof p!=='object') return khung&&khung.length?{khung, co_canh:coCanh||null}:null; const doan=(Array.isArray(p.doan)?p.doan:[]).slice(0,240).map(d=>({t:+so(d.t).toFixed(2), net:+so(d.net).toFixed(3), dong:+so(d.dong).toFixed(3), sang:+so(d.sang).toFixed(3)}));
  return { dai:+so(p.dai).toFixed(2), doan, khung:khung||[], co_canh: CO_CANH.includes(coCanh)?coCanh:(CO_CANH.includes(p.co_canh)?p.co_canh:null) }; }
async function moTaKhungHinh(env, khungIn, chuDe){ const key=env.ANTHROPIC_API_KEY; const ds=(Array.isArray(khungIn)?khungIn:[khungIn]).filter(u=>u&&/^\/media\//.test(u)).slice(0,3); if(!key||!ds.length||!env.MEDIA) return {mo_ta:'', loi:key?null:'chưa có ANTHROPIC_API_KEY'}; const khungUrl=ds[0];
  try{ const anh=[]; for(const u of ds){ const obj=await env.MEDIA.get(u.slice(7)); if(!obj) continue; const buf=new Uint8Array(await obj.arrayBuffer()); let bin=''; for(let i=0;i<buf.length;i+=0x8000) bin+=String.fromCharCode(...buf.subarray(i,i+0x8000)); anh.push({type:'image', source:{type:'base64', media_type:'image/jpeg', data:btoa(bin)}}); } if(!anh.length) return {mo_ta:'', loi:'không thấy khung'};
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST', headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'}, body:JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:160,
      messages:[{role:'user', content:[...anh, {type:'text', text:(anh.length>1?('Đây là '+anh.length+' khung hình (đầu, giữa, cuối) của MỘT clip. '):'')+'Đây là một khung hình trong clip quay cho video marketing vật liệu xây dựng (chủ đề: '+String(chuDe||'').slice(0,120)+'). Chỉ dùng tiếng Việt có dấu (không chữ Hán). Viết MỘT câu dưới 30 chữ mô tả đúng thứ nhìn thấy (vật, người, hành động, bối cảnh, màu), rồi dấu | và 5–8 từ khoá cách nhau dấu phẩy, rồi dấu | và MỘT mã cỡ cảnh: RONG (toàn cảnh/không gian), TRUNG, CAN (cận chi tiết), SAN_PHAM (cận sản phẩm/bao bì), THAO_TAC (tay/thợ đang làm), NGUOI_NOI (người nói trước máy), CHU (chữ/đồ hoạ). Không suy đoán thứ không thấy.'}]}] })});
    const j=await res.json().catch(()=>({})); if(!res.ok) return {mo_ta:'', loi:String((j.error&&j.error.message)||res.status).slice(0,120)};
    const t=((j.content||[]).find(c=>c.type==='text')||{}).text||''; const u=j.usage||{};
    try{ await env.DB.prepare(`INSERT INTO ai_usage (id,at,thang,provider,model,tinh_nang,user_id,user_name,tokens_vao,tokens_ra,chi_phi_usd,ok) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`).bind(uid('au'), nowISO(), thangHienTai(), 'anthropic', 'claude-haiku-4-5-20251001', 'mo_ta_footage', '', 'Máy (nạp Drive)', so(u.input_tokens), so(u.output_tokens), (so(u.input_tokens)*1+so(u.output_tokens)*5)/1e6).run(); }catch(e){}
    const coCanh=(t.match(/\b(RONG|TRUNG|CAN|SAN_PHAM|THAO_TAC|NGUOI_NOI|CHU)\b/)||[])[1]||null; return {co_canh:coCanh, mo_ta: t.replace(/\|\s*(RONG|TRUNG|CAN|SAN_PHAM|THAO_TAC|NGUOI_NOI|CHU)\s*$/,'').replace(/[　-鿿가-힯]+/g,' ').replace(/\s+/g,' ').trim().slice(0,300)};   /* bỏ chữ Hán/Hàn lọt vào (đo 24/09: "t施工") */ }catch(e){ return {mo_ta:'', loi:String(e.message||e).slice(0,120)}; } }
// ===== ADR-010 — ghép: làm sạch kế hoạch, so máy↔người → mẫu học (chon_canh · chon_doan · ghep_canh) =====
function sachGhep(ds){ return (Array.isArray(ds)?ds:[]).slice(0,20).map((c,i)=>({ k:so(c.k??i), label:chuoi(c.label,60), text:chuoi(c.text,300), hinh:chuoi(c.hinh,200), d:+so(c.d).toFixed(2),
  shots:(Array.isArray(c.shots)?c.shots:[]).slice(0,8).map(x=>({ tai_san_id:chuoi(x.tai_san_id,40), tu:+Math.max(0,so(x.tu)).toFixed(2), den:+Math.max(0,so(x.den)).toFixed(2) })).filter(x=>x.tai_san_id&&x.den>x.tu) })); }
// đặc trưng một cửa sổ [tu,den] trên đoạn phân tích của clip — dùng chung cho mẫu người và mẫu thành phẩm
function dacTrungCuaSo(pt, tu, den){ const d=(pt&&pt.doan)||[]; const trong=d.filter(x=>x.t>=tu-0.01&&x.t<den); if(!trong.length) return null; const tb=k=>trong.reduce((s,x)=>s+so(x[k]),0)/trong.length; const dai=so(pt.dai)||den;
  return { net:+tb('net').toFixed(3), dong:+tb('dong').toFixed(3), sang:+tb('sang').toFixed(3), vi_tri:+(dai?tu/dai:0).toFixed(3), dai:+(den-tu).toFixed(2) }; }
async function mauTuChinhGhep(env, nd, may, nguoi){ const ts={}; for(const t of (await env.DB.prepare(`SELECT id,ten,mo_ta,media_url,media_type,phan_tich FROM tai_san WHERE (muc_id=? OR noi_dung_id=?) AND loai IN ('FOOTAGE','ANH')`).bind(nd.muc_id, nd.id).all()).results) ts[t.id]={...t, phan_tich:docJSON(t.phan_tich,null)};
  let n=0; const uv=Object.values(ts).slice(0,12).map(t=>({id:t.id, ten:t.ten, mo_ta:t.mo_ta, media_url:t.media_url, media_type:t.media_type}));
  for(const c of nguoi){ const m=(may||[]).find(x=>x.k===c.k)||{shots:[]}; const s0=c.shots[0]; if(!s0) continue; const m0=m.shots[0]||{};
    // chon_canh: người đổi clip của cảnh → nhãn clip đúng
    if(m0.tai_san_id&&s0.tai_san_id!==m0.tai_san_id){ await ghiMauAI(env,{tinh_nang:'chon_canh', doi_tuong:'noi_dung', doi_tuong_id:nd.id, dau_vao:{k:c.k, label:c.label, hinh:c.hinh, text:c.text, ung_vien:uv}, dau_ra:{tai_san_id:m0.tai_san_id, cach:'MAY'}, nhan:{tai_san_id:s0.tai_san_id, nguon:'CHINH_GHEP'}}); n++; }
    // chon_doan: mỗi shot người giữ/chỉnh = một nhãn cửa sổ đúng trên clip đó (kèm các cửa sổ khác cùng clip làm âm)
    for(const x of c.shots){ const pt=ts[x.tai_san_id]&&ts[x.tai_san_id].phan_tich; if(!pt||!(pt.doan||[]).length) continue; const mx=m.shots.find(y=>y.tai_san_id===x.tai_san_id);
      if(mx&&Math.abs(mx.tu-x.tu)<0.25&&Math.abs(mx.den-x.den)<0.25) continue;   // không sửa gì thì không là nhãn mới
      await ghiMauAI(env,{tinh_nang:'chon_doan', doi_tuong:'noi_dung', doi_tuong_id:nd.id, dau_vao:{tai_san_id:x.tai_san_id, doan:pt.doan, dai:pt.dai, can:+(x.den-x.tu).toFixed(2), co_canh:pt.co_canh}, dau_ra:mx?{tu:mx.tu, den:mx.den}:null, nhan:{tu:x.tu, den:x.den, nguon:'CHINH_GHEP'}}); n++; } }
  // ghep_canh: cả bản người = một mẫu (độ dài shot, số shot mỗi cảnh, chuỗi cỡ cảnh)
  const chuoiShot=nguoi.flatMap(c=>c.shots.map(x=>({dai:+(x.den-x.tu).toFixed(2), co_canh:(ts[x.tai_san_id]&&ts[x.tai_san_id].phan_tich&&ts[x.tai_san_id].phan_tich.co_canh)||null, lap:0})));
  await ghiMauAI(env,{tinh_nang:'ghep_canh', doi_tuong:'noi_dung', doi_tuong_id:nd.id, dau_vao:{nguon:'CHINH_GHEP', so_canh:nguoi.length}, dau_ra:may?{shots:(may||[]).flatMap(c=>c.shots.map(x=>+(x.den-x.tu).toFixed(2)))}:null, nhan:{shots:chuoiShot, nguon:'CHINH_GHEP'}}); n++;
  return n; }
// ADR-018: nhãn không còn nằm trong phan_tich — gắn dòng thời gian (đọc từ mau_doan) khi gửi footage / thành phẩm ra màn và máy
// 25/09: giao máy Q2 tạo bản xem 360p cho video đã học chưa có (lô 25, không đọc hình / thầy lại)
async function giaoProxy(env, tacNhan){ await MAU().dam(env); const THIEU=`EXISTS (SELECT 1 FROM mau_doan m WHERE m.doi_tuong_id=X.id AND m.loai='HINH' AND m.hieu_luc=1 AND m.khung_url IS NULL AND COALESCE(m.anh_thu,0)<2)`;
  const tp=(await env.DB.prepare(`SELECT X.id, X.ten, X.nguon, X.nguon_id, X.link, X.kenh, X.proxy_url FROM kho_thanh_pham X WHERE X.proxy_url IS NULL OR ${THIEU} ORDER BY X.created_at DESC`).all()).results;
  const ft=(await env.DB.prepare(`SELECT X.id, X.ten, X.media_url FROM tai_san X WHERE ${THIEU}`).all()).results;
  const doanThieu=async(id)=>(await env.DB.prepare(`SELECT i, tu, den FROM mau_doan WHERE doi_tuong_id=? AND loai='HINH' AND hieu_luc=1 AND khung_url IS NULL AND COALESCE(anh_thu,0)<2 ORDER BY i`).bind(id).all()).results;
  const ds=[]; for(const x of tp) ds.push({ id:x.id, ten:x.ten, nguon:x.nguon, nguon_id:x.nguon_id, link:x.link||null, kenh:x.kenh||null, can_proxy:!x.proxy_url, doan:await doanThieu(x.id) });
  for(const x of ft) ds.push({ id:x.id, ten:x.ten, nguon:'FOOTAGE', nguon_id:x.id, media_url:x.media_url, can_proxy:false, doan:await doanThieu(x.id) });
  if(!ds.length) return {ok:true, so:0, lenh:[]}; await env.DB.prepare(`UPDATE mau_doan SET anh_thu=COALESCE(anh_thu,0)+1 WHERE loai='HINH' AND hieu_luc=1 AND khung_url IS NULL`).run();
  const mayId=await mayManhNhat(env,'dung_video'); if(!mayId) return {ok:false, loi:'chưa ghép máy học nào'}; const lenh=[];
  for(let i=0;i<ds.length;i+=25){ const r=await taoLenhTram(env,'hoc_thanh_pham',{ chi_proxy:true, nguon:'PROXY', ds_proxy:ds.slice(i,i+25) }, tacNhan, mayId); if(r.id) lenh.push(r.id); }
  return {ok:true, so:ds.length, lenh}; }
// cron: video đã học còn thiếu bản xem → tự giao máy Q2 (nhiều nhất 6 giờ / lần, không giao khi còn lệnh bản xem đang chờ)
async function tuGiaoProxy(env){ const cho=await env.DB.prepare(`SELECT 1 x FROM tram_lenh WHERE viec='hoc_thanh_pham' AND trang_thai IN ('CHO','DA_GUI') AND tham_so LIKE '%"chi_proxy":true%' LIMIT 1`).first(); if(cho) return {bo_qua:'đang có lệnh'};
  const r=await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='proxy_lan'`).first(); const lan=r?Date.parse((docJSON(r.cau_hinh,{})||{}).luc||0):0; if(Date.now()-lan<6*36e5) return {bo_qua:'chưa tới giờ'};
  await MAU().dam(env); const thieu=await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM kho_thanh_pham WHERE proxy_url IS NULL)+(SELECT COUNT(*) FROM mau_doan WHERE loai='HINH' AND hieu_luc=1 AND khung_url IS NULL AND COALESCE(anh_thu,0)<2) n`).first(); if(!so((thieu||{}).n)) return {bo_qua:'đủ bản xem và ảnh đoạn'};
  await env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('proxy_lan', ?, ?, 'Máy')`).bind(JSON.stringify({luc:nowISO()}), nowISO()).run(); return giaoProxy(env, MAY('Máy (bản xem)')); }
async function ganTimeline(env, ds){ const ids=ds.map(t=>t.id).filter(Boolean); if(!ids.length) return ds; const tl=await MAU().timelineCua(env, ids); return ds.map(t=>{ if(!tl[t.id]) return t; const pt=typeof t.phan_tich==='string'?(docJSON(t.phan_tich,{})||{}):(t.phan_tich||{}); return {...t, phan_tich:{...pt, timeline:tl[t.id]}}; }); }
async function bootstrap(env, u){
  const all=async(s,...a)=>(await env.DB.prepare(s).bind(...a).all()).results;
  const staff=isStaff(u), xem=canXemMkt(u);
  const [users, cl, pillars, frameworks, spR, claims, kenhR, buoc, runs, cv] = await Promise.all([
    canNguoiDung(u) ? all(`SELECT id,ho_ten,email,vai_tro,active,doi_mat_khau,created_at FROM users ORDER BY created_at`) : Promise.resolve([]),
    env.DB.prepare(`SELECT * FROM chien_luoc WHERE id=1`).first(),
    xem ? all(`SELECT * FROM pillars ORDER BY thu_tu, created_at`) : Promise.resolve([]),
    xem ? all(`SELECT * FROM frameworks ORDER BY created_at`) : Promise.resolve([]),
    xem ? all(`SELECT * FROM san_pham ORDER BY ma`) : Promise.resolve([]),
    xem ? all(`SELECT * FROM claim_cam ORDER BY muc_do, cum_tu`) : Promise.resolve([]),
    xem ? all(`SELECT * FROM kenh ORDER BY created_at`) : Promise.resolve([]),
    xem ? docBuoc(env) : Promise.resolve([]),
    xem ? all(`SELECT * FROM agent_run ORDER BY at DESC LIMIT 40`) : Promise.resolve([]),
    all(`SELECT * FROM cong_viec WHERE trang_thai='MO' ORDER BY han, created_at`),
  ]);
  const cfg=await docCauHinh(env);
  // ADR-002: chiến lược phiên bản, kế hoạch 12 tháng, mục nội dung 3 tháng gần, ý tưởng 60 ngày
  const tuThang=thangSau(thangHienTai(),-1), tuNgay=new Date(Date.now()-60*864e5).toISOString();
  const [pb, khR, mucR, ytR] = xem ? await Promise.all([
    all(`SELECT * FROM chien_luoc_phien_ban ORDER BY phien_ban DESC LIMIT 10`),
    all(`SELECT * FROM ke_hoach_thang ORDER BY thang DESC LIMIT 12`),
    env.DB.prepare(`SELECT * FROM muc_noi_dung WHERE thang>=? ORDER BY thang, tuan, ngay_dang`).bind(tuThang).all().then(r=>r.results),
    env.DB.prepare(`SELECT * FROM y_tuong WHERE created_at>=? ORDER BY CASE trang_thai WHEN 'MOI' THEN 0 ELSE 1 END, created_at DESC LIMIT 200`).bind(tuNgay).all().then(r=>r.results),
  ]) : [[],[],[],[]];
  // ADR-003: nội dung 90 ngày, duyệt (chờ + 30 ngày đã quyết), tài sản 300 mới nhất, bài đăng 90 ngày
  const tu90=new Date(Date.now()-90*864e5).toISOString(), tu30=new Date(Date.now()-30*864e5).toISOString();
  // ADR-005: kết quả 120 ngày, báo cáo 12 gần nhất, đề xuất chờ + 6 tháng
  const tu120=new Date(Date.now()-120*864e5).toISOString().slice(0,10);
  const [kqR, bcR, dxR] = xem ? await Promise.all([
    env.DB.prepare(`SELECT * FROM ket_qua WHERE ky>=? ORDER BY ky DESC LIMIT 2000`).bind(tu120).all().then(r=>r.results),
    all(`SELECT id,loai,ky,tu,den,nhan_dinh,nhan_dinh_may,viec_can_lam,trang_thai,gui_qua,gui_at,gui_boi,tao_boi,created_at,so_lieu FROM bao_cao ORDER BY created_at DESC LIMIT 12`),
    all(`SELECT * FROM de_xuat ORDER BY CASE trang_thai WHEN 'CHO' THEN 0 ELSE 1 END, created_at DESC LIMIT 60`),
  ]) : [[],[],[]];
  const [ndR, dyR, tsR, bdR] = xem ? await Promise.all([
    env.DB.prepare(`SELECT * FROM noi_dung WHERE updated_at>=? ORDER BY updated_at DESC LIMIT 400`).bind(tu90).all().then(r=>r.results),
    env.DB.prepare(`SELECT * FROM duyet WHERE trang_thai='CHO' OR created_at>=? ORDER BY created_at DESC LIMIT 300`).bind(tu30).all().then(r=>r.results),
    all(`SELECT * FROM tai_san ORDER BY created_at DESC LIMIT 300`),
    env.DB.prepare(`SELECT * FROM bai_dang WHERE created_at>=? ORDER BY gio_dang DESC LIMIT 300`).bind(tu90).all().then(r=>r.results),
  ]) : [[],[],[],[]];
  return {
    me:{ id:u.id, ho_ten:u.ho_ten, email:u.email, vai_tro:u.vai_tro, doi_mat_khau:uBool(u.doi_mat_khau) },
    noi_dung: ndR.map(n=>({...n, sections:docSections(n.sections), chi_tiet:docJSON(n.chi_tiet,{})})),
    ket_qua: kqR.map(k=>({...k, ghi_chu:docJSON(k.ghi_chu,{})})), muc_tin_cay:MUC_TIN_CAY, nguon_kq:NGUON_KQ,
    bao_cao: bcR.map(b=>({...b, viec_can_lam:docJSON(b.viec_can_lam,[]), gui_qua:docJSON(b.gui_qua,[]), so_lieu:docJSON(b.so_lieu,{})})),
    de_xuat: dxR.map(d=>({...d, noi_dung:docJSON(d.noi_dung,{}), bang_chung:docJSON(d.bang_chung,{}), ap_dung:docJSON(d.ap_dung,null)})),
    // ADR-007: seeding hội nhóm (60 ngày)
    seeding: xem ? await (async()=>{ const tu=new Date(Date.now()-60*864e5).toISOString(); const goi=(await env.DB.prepare(`SELECT * FROM goi_seeding WHERE created_at>=? ORDER BY created_at DESC LIMIT 100`).bind(tu).all()).results; const ids=goi.map(g=>g.id);
      const bt=ids.length?(await env.DB.prepare(`SELECT * FROM bien_the WHERE goi_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all()).results:[];
      return { giong:GIONG_SEED, dang_bai:DANG_BAI_SEED, thong_diep:(await all(`SELECT * FROM thong_diep_seeding ORDER BY thu_tu, created_at`)).map(t=>({...t, du_kien:docJSON(t.du_kien,[]), active:uBool(t.active)})),
        tai_khoan:(await all(`SELECT * FROM tai_khoan_seeding ORDER BY created_at`)).map(t=>({...t, active:uBool(t.active), suc_khoe:docJSON(t.suc_khoe,{}), persona:docJSON(t.persona,{}), song:tkSong(t)})),
        nhom:(await all(`SELECT * FROM nhom_seeding ORDER BY created_at`)).map(n=>({...n, active:uBool(n.active), hieu_qua:docJSON(n.hieu_qua,{}), quy_tac:docJSON(n.quy_tac,{}), gio_vang:docJSON(n.gio_vang,[]), tai_khoan_ids:docJSON(n.tai_khoan_ids,[])})),
        goi:goi.map(g=>({...g, thong_diep_ids:docJSON(g.thong_diep_ids,[]), cham_may:docJSON(g.cham_may,{})})), bien_the:bt.map(b=>({...b, binh_luan:docJSON(b.binh_luan,[]), co_link:uBool(b.co_link)})),
        viec:(await env.DB.prepare(`SELECT * FROM viec_seeding WHERE created_at>=? ORDER BY gio_dang DESC LIMIT 400`).bind(tu).all()).results.map(v=>({...v, kiem:docJSON(v.kiem,{}), bang_chung:docJSON(v.bang_chung,{})})),
        lead:(await all(`SELECT * FROM lead_seeding ORDER BY created_at DESC LIMIT 100`)),
        binh_luan:(await env.DB.prepare(`SELECT * FROM binh_luan_seeding WHERE created_at>=? ORDER BY gio DESC LIMIT 300`).bind(tu).all()).results,
        nuoi:(await env.DB.prepare(`SELECT * FROM nuoi_seeding WHERE created_at>=? ORDER BY gio DESC LIMIT 200`).bind(new Date(Date.now()-14*864e5).toISOString()).all()).results.map(x=>({...x, ket_qua:docJSON(x.ket_qua,{})})) }; })() : null,
    duyet: dyR.map(d=>({...d, cham_may:docJSON(d.cham_may,{})})), tai_san: await ganTimeline(env, tsR||[]), bai_dang: bdR,
    chien_luoc_phien_ban: pb.map(x=>({...x, pillars:docJSON(x.pillars,[])})),
    ke_hoach_thang: khR.map(docKeHoach), muc_noi_dung: mucR, y_tuong: ytR,
    hang_so:{ muc_tieu:MUC_TIEU, dinh_dang:DINH_DANG, giai_doan:GIAI_DOAN, thang_nay:thangHienTai(), ngay_nay:ngayVN() },
    roles:ROLES, muc:MUC, cong:CONG,
    users: users.map(x=>({...x, active:uBool(x.active), doi_mat_khau:uBool(x.doi_mat_khau)})),
    chien_luoc: cl||{},
    pillars: pillars.map(p=>({...p, active:uBool(p.active)})),
    frameworks: frameworks.map(f=>({...f, active:uBool(f.active)})),
    san_pham: spR.map(s=>({...s, thong_so:docJSON(s.thong_so,[]), active:uBool(s.active)})),
    claim_cam: claims.map(c=>({...c, active:uBool(c.active)})),
    kenh: kenhR.map(k=>({...k, active:uBool(k.active), co_token:!!layToken(env,k)})),
    buoc, agents: AGENTS.map(a=>({ma:a.ma, ten:a.ten, loai:a.loai, buoc:a.buoc})),
    agent_run: runs.map(r=>({...r, ok:uBool(r.ok), thu:uBool(r.thu), chi_tiet:docJSON(r.chi_tiet,{})})),
    // việc: staff thấy hết; người khác thấy việc giao cho mình hoặc vai trò mình
    cong_viec: cv.filter(v=> staff || v.giao_cho_id===u.id || v.giao_cho_vai_tro===u.vai_tro),
    // khoá Trạm không bao giờ ra khỏi server — chỉ cờ co_khoa ở tram
    module_config: xem ? {...cfg, tram:{...(cfg.tram||{}), khoa:undefined}} : {duyet:cfg.duyet},
    ai_thang: xem ? await tongHopAI(env, thangHienTai()) : null,
    khoa_api: (u&&u.vai_tro===ROLES.ADMIN) ? await dsKhoaApi(env) : null,   // màn Khoá API (chỉ Admin)
    san_sang: { tts:!!env.GOOGLE_TTS_KEY, gemini:!!env.GEMINI_API_KEY, openai:!!env.OPENAI_API_KEY,  ai:!!env.ANTHROPIC_API_KEY, youtube:!!env.YOUTUBE_API_KEY, n8n:!!(env.N8N_TOKEN&&env.N8N_WEBHOOK_URL), media:!!env.MEDIA },
    // ADR-004: Trạm — cờ có khoá (không bao giờ trả khoá), nhịp tim & phiên, lệnh/lô gần đây
    tram: xem ? { co_khoa:!!chuoi((cfg.tram||{}).khoa), bat:(cfg.tram||{}).bat!==false, trang_thai: await docTramTrangThai(env),
      lenh:(await all(`SELECT * FROM tram_lenh ORDER BY created_at DESC LIMIT 20`)).map(l=>({...l, tham_so:docJSON(l.tham_so,{})})), lo:(await all(`SELECT id,viec,bang,luot,so_dong,xu_ly,created_at FROM tram_lo ORDER BY created_at DESC LIMIT 20`)).map(l=>{ const x=docJSON(l.xu_ly,{}); delete x.dong; return {...l, xu_ly:x}; }) } : null,
    ai_nao: xem ? await (async()=>{ const th=thangHienTai(); return {
      mo_hinh:(await all(`SELECT * FROM mo_hinh ORDER BY loai, cach_goi, created_at`)).map(x=>({...x, ten_khoa:tenKhoa(x), co_khoa: x.cach_goi==='API'?!!env[tenKhoa(x)]:null})),
      dinh_tuyen: await all(`SELECT * FROM dinh_tuyen ORDER BY loai, tinh_nang`),
      phien_ban:(await all(`SELECT * FROM mo_hinh_phien_ban ORDER BY created_at DESC LIMIT 20`)).map(p=>({...p, danh_gia:docJSON(p.danh_gia,{})})),
      ky_nang: await tomTatKyNang(env),
      do_chinh_xac_hinh: await MAU().doChinhXac(env),
      nhat_ky_hoc: await all(`SELECT at, by_name user_name, action hanh_dong, entity doi_tuong, entity_id doi_tuong_id, detail ghi_chu FROM audit WHERE action IN ('máy tự học','bật máy nhà','tắt máy nhà','nạp kho thành phẩm','nạp kho thành phẩm TikTok','quét Kalodata','gắn nhãn video kho thành phẩm','loại video khỏi kho thành phẩm','duyệt phiên bản mô hình','gửi phiên bản mô hình','ra lệnh huấn luyện') ORDER BY at DESC LIMIT 20`),
      dong_san_pham: (await all(`SELECT dong FROM (SELECT dong FROM san_pham UNION SELECT dong FROM kho_thanh_pham UNION SELECT dong FROM mau_hoc_ai) WHERE dong IS NOT NULL AND dong<>'' GROUP BY dong ORDER BY dong`)).map(x=>x.dong),
      pham_vi_thong_ke: await all(`SELECT tinh_nang, COALESCE(dong,'') dong, COALESCE(muc_dich,'') muc_dich, COUNT(*) tong, SUM(CASE WHEN nhan IS NOT NULL OR phan_quyet IS NOT NULL THEN 1 ELSE 0 END) da_cham FROM mau_hoc_ai GROUP BY tinh_nang, dong, muc_dich`),
      tien_trinh:(await all(`SELECT * FROM tram_lenh WHERE viec IN ('huan_luyen','hoc_thanh_pham','phan_tich_footage','nap_drive','chay_agent') ORDER BY created_at DESC LIMIT 40`)).map(l=>({...l, tham_so:docJSON(l.tham_so,{})})).filter(l=>l.viec!=='chay_agent'||['tai_tiktok','kalodata_video'].includes(l.tham_so.viec)).slice(0,20),
      kho_thanh_pham: await all(`SELECT id,ten,nguon,thu_muc,dai,so_shot,nhip,co_goc,created_at,luot_xem,luot_thich,ngay_dang,link,kenh,doanh_thu,luot_ban,san_pham,dong,muc_dich,substr(kich_ban,1,300) kich_ban FROM kho_thanh_pham ORDER BY COALESCE(doanh_thu,-1) DESC, COALESCE(luot_xem,-1) DESC, created_at DESC LIMIT 80`),
      kalodata: (await docCauHinh(env)).kalodata||{},
      tai_tiktok_cho: ((await docCauHinh(env)).tai_tiktok||{}).hang||[],
      mau_thong_ke: await all(`SELECT tinh_nang, COUNT(*) tong, SUM(CASE WHEN phan_quyet IS NOT NULL OR nhan IS NOT NULL THEN 1 ELSE 0 END) da_cham, SUM(CASE WHEN dau_ra_mo IS NOT NULL THEN 1 ELSE 0 END) co_bong, SUM(CASE WHEN tap='KIEM' THEN 1 ELSE 0 END) kiem FROM mau_hoc_ai GROUP BY tinh_nang`),
      chi_phi: await all(`SELECT COALESCE(mo_hinh_id, model) mo_hinh, provider, COUNT(*) so_lan, COALESCE(SUM(chi_phi_usd),0) usd, COALESCE(SUM(tokens_vao),0) vao, COALESCE(SUM(tokens_ra),0) ra FROM ai_usage WHERE thang=? GROUP BY COALESCE(mo_hinh_id, model), provider ORDER BY usd DESC`, th),
      lenh_hoc:(await all(`SELECT * FROM tram_lenh WHERE viec IN ('huan_luyen','mo_hinh_bong','mo_hinh_chay','loc_footage','hoc_thanh_pham','phan_tich_footage') ORDER BY created_at DESC LIMIT 12`)).map(l=>({...l, tham_so:docJSON(l.tham_so,{})})),
      tiet_kiem: await tietKiemMo(env, th), mo_ho_tro:MO_NGON_NGU_HO_TRO,
      ai_viec:(await all(`SELECT id,tinh_nang,mo_hinh_id,may_id,trang_thai,loi,created_at,xong_at,ms FROM ai_viec ORDER BY created_at DESC LIMIT 15`)) }; })() : null,
    may_ghep: xem ? (await mayGhepSong(env)).map(x=>({id:x.id, ten:x.ten, chu_user_id:x.chu_user_id, chu_ten:x.chu_ten, kha_nang:x.kha_nang, ban:x.ban, nhan_luc:x.nhan_luc, song:x.song, than:x.than})) : null,
    mo_phong: !!(cfg.mo_phong&&cfg.mo_phong.bat),
    dot: 1,
  };
}

// ============================================================
//  API
// ============================================================
async function getSession(env, req){
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim(); if(!token) return null;
  const s=await env.DB.prepare(`SELECT * FROM sessions WHERE token=?`).bind(token).first(); if(!s) return null;
  if(s.expires_at && s.expires_at<nowISO()){ await env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(token).run(); return null; }
  const u=await env.DB.prepare(`SELECT * FROM users WHERE id=?`).bind(s.user_id).first(); if(!u||!uBool(u.active)) return null;
  return {token, user:u};
}
// Danh mục gốc — CRUD chung, whitelist trường theo bảng
const DANH_MUC = {
  pillars:    { truong:['ten','mo_ta','ty_trong','thu_tu','muc_tieu','active'], batBuoc:['ten'] },
  frameworks: { truong:['ten','mo_ta','pillar_id','active'], batBuoc:['ten'] },
  san_pham:   { truong:['ma','ten','dong','mo_ta','thong_so','tieu_chuan','bao_hanh','huong_dan','quy_trinh','bai_test','active'], batBuoc:['ten'] },
  claim_cam:  { truong:['cum_tu','muc_do','ly_do','active'], batBuoc:['cum_tu'] },
  kenh:       { truong:['ten','loai','api_ma','api_object_id','cach_dang','active'], batBuoc:['ten'] },
};
function lamSachDanhMuc(bang, body, cu){
  const o={}; for(const k of DANH_MUC[bang].truong){ if(body[k]===undefined) continue;
    if(k==='active') o[k]=bool(body[k]!==false && body[k]!==0);
    else if(k==='ty_trong'||k==='thu_tu') o[k]=Math.max(0, so(body[k]));
    else if(k==='thong_so') o[k]=JSON.stringify((Array.isArray(body[k])?body[k]:[]).filter(x=>x&&(x.k||x.v)).map(x=>({k:chuoi(x.k,80), v:chuoi(x.v,500)})).slice(0,60));
    else if(k==='muc_do') o[k]=['CHAN','CANH_BAO'].includes(String(body[k]).toUpperCase())?String(body[k]).toUpperCase():'CANH_BAO';
    else if(k==='muc_tieu') o[k]=mucTieu(body[k]);
    else if(k==='api_ma') o[k]=String(body[k]||'').trim().toUpperCase().replace(/[^A-Z0-9_]/g,'');
    else if(k==='cach_dang') o[k]=['API','N8N','TAY','TRAM'].includes(String(body[k]).toUpperCase())?String(body[k]).toUpperCase():'TAY';
    else o[k]=chuoi(body[k], k==='mo_ta'||k==='huong_dan'||k==='ly_do'?3000:300); }
  return o;
}
function kiemConfig(key, cau_hinh){
  if(!CONFIG_MAC_DINH[key]) return 'Không có nhóm cấu hình "'+key+'"';
  if(!cau_hinh||typeof cau_hinh!=='object'||Array.isArray(cau_hinh)) return 'Cấu hình phải là object';
  const mac=CONFIG_MAC_DINH[key];
  for(const [k,v] of Object.entries(cau_hinh)){
    if(!(k in mac)) return 'Trường lạ "'+k+'"';
    const t=typeof mac[k];
    if(t==='number'){ if(typeof v!=='number'||!isFinite(v)||v<0||v>1e9) return 'Giá trị "'+k+'" không hợp lệ'; if(k==='nguong_san_sang'&&v>100) return 'Ngưỡng sẵn sàng tối đa 100'; if(k==='gio_chay'&&v>23) return 'Giờ 0–23'; }
    else if(t==='string'){ if(typeof v!=='string'||v.length>200) return '"'+k+'" phải là chuỗi ≤ 200 ký tự'; if(key==='tram'&&k==='khoa') return 'Khoá Trạm chỉ tạo bằng nút "Tạo khoá" (không dán tay)'; }
    else if(t==='boolean'){ if(typeof v!=='boolean') return '"'+k+'" phải là bật/tắt'; }
    else if(t==='object'){ if(!v||typeof v!=='object') return '"'+k+'" phải là object'; }
  }
  return null;
}

// ===== ADR-013 — LỚP HỌC CỦA MÁY =====
const KY_NANG=[ {id:'chon_canh', ten:'Chọn cảnh', icon:'🎞', tinh_nang:['chon_canh'], mo_ta:'footage nào cho cảnh nào'},
  {id:'cat_ghep', ten:'Cắt ghép', icon:'✂️', tinh_nang:['ghep_canh','chon_doan'], mo_ta:'độ dài shot, nhịp, đoạn nào trong clip'},
  {id:'viet', ten:'Viết kịch bản', icon:'✍️', tinh_nang:['soan_nhap_agent','soan_noi_dung'], mo_ta:'kịch bản theo kế hoạch, học từ bài anh duyệt và kịch bản bán tốt'},
  {id:'giong', ten:'Giọng đọc', icon:'🔊', tinh_nang:['tts'], mo_ta:'giọng máy nhà thay Google'} ];
// máy rảnh nhất có một trong các khả năng: ít lệnh CHỜ/ĐANG nhất, bằng nhau thì máy có Ollama + VRAM lớn hơn
async function mayRanhNhat(env, khaNangs){ const ds=(await mayGhepSong(env)).filter(x=>x.song&&khaNangs.some(k=>x.kha_nang.includes(k))); if(!ds.length) return null; const cho={}; for(const l of (await env.DB.prepare(`SELECT may_id, COUNT(*) n FROM tram_lenh WHERE trang_thai IN ('CHO','DA_GUI') AND may_id IS NOT NULL GROUP BY may_id`).all()).results) cho[l.may_id]=so(l.n);
  return ds.slice().sort((a,b)=>(sucMay(b)-sucMay(a))||((cho[a.id]||0)-(cho[b.id]||0)))[0].id; }   // gom về máy mạnh; máy khác chỉ khi máy mạnh im
async function tuHoc(env){ const cfg=await docCauHinh(env); const lh=cfg.lop_hoc||{}; if(lh.tu_hoc===false) return {bo_qua:'tắt tự học'}; const da=lh.da_hoc||{}; const ra=[];
  const dts=(await env.DB.prepare(`SELECT * FROM dinh_tuyen WHERE loai='NHIN' AND mo_hinh_mo IS NOT NULL`).all()).results;
  for(const dt of dts){ const cho=await env.DB.prepare(`SELECT id FROM mo_hinh_phien_ban WHERE tinh_nang=? AND trang_thai='CHO_DUYET'`).bind(dt.tinh_nang).first(); if(cho) continue;
    const dangHoc=await env.DB.prepare(`SELECT id FROM tram_lenh WHERE viec='huan_luyen' AND trang_thai IN ('CHO','DA_GUI') AND tham_so LIKE ?`).bind('%"tinh_nang":"'+dt.tinh_nang+'"%').first(); if(dangHoc) continue;
    const mayId=await mayRanhNhat(env, ['chon_doan','ghep_canh'].includes(dt.tinh_nang)?['huan_luyen','dung_video']:['huan_luyen']); if(!mayId) continue;   // song song: chia cho máy đang rảnh, máy mạnh trước
    const nhom=(await env.DB.prepare(`SELECT COALESCE(dong,'') dong, COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang=? AND nhan IS NOT NULL GROUP BY dong`).bind(dt.tinh_nang).all()).results; const tong=nhom.reduce((a,x)=>a+x.n,0); const can=so(dt.min_mau,30);
    const pvs=[]; if(tong>=can) pvs.push({pv:'chung', n:tong}); for(const x of nhom) if(x.dong&&x.n>=can) pvs.push({pv:'dong:'+x.dong, n:x.n});
    for(const {pv,n} of pvs){ const k=dt.tinh_nang+'|'+pv; if(so((da[k]||{}).n)>=n-9) continue;   // chưa thêm ≥ 10 mẫu từ lần học trước
      const r=await taoLenhTram(env,'huan_luyen',{tinh_nang:dt.tinh_nang, mo_hinh_id:dt.mo_hinh_mo, pham_vi:pv, tu_hoc:true}, MAY('Lớp học'), mayId); da[k]={n, luc:nowISO(), lenh:r.id}; ra.push(dt.tinh_nang+' '+pv+' ('+n+' mẫu)'); }
  }
  if(ra.length){ await env.DB.prepare(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES ('lop_hoc',?,?,'Lớp học') ON CONFLICT(id) DO UPDATE SET cau_hinh=excluded.cau_hinh, updated_at=excluded.updated_at`).bind(JSON.stringify({...lh, da_hoc:da}), nowISO()).run(); await logAudit(env, MAY('Lớp học'), 'máy tự học', 'dinh_tuyen', '', ra.join(' · ')); }
  return {hoc:ra}; }
// tóm tắt 4 kỹ năng cho màn Lớp học: đang làm bằng gì · học được bao nhiêu · có gì mới để bật
async function tomTatKyNang(env){ const dts=(await env.DB.prepare(`SELECT * FROM dinh_tuyen`).all()).results; const pbs=(await env.DB.prepare(`SELECT * FROM mo_hinh_phien_ban ORDER BY created_at DESC LIMIT 60`).all()).results.map(p=>({...p, danh_gia:docJSON(p.danh_gia,{})}));
  const mau=(await env.DB.prepare(`SELECT tinh_nang, COALESCE(dong,'') dong, COUNT(*) n FROM mau_hoc_ai WHERE nhan IS NOT NULL OR phan_quyet IS NOT NULL GROUP BY tinh_nang, dong`).all()).results; const soTP=so((await env.DB.prepare(`SELECT COUNT(*) n FROM kho_thanh_pham`).first()||{}).n); const soKB=so((await env.DB.prepare(`SELECT COUNT(*) n FROM kho_thanh_pham WHERE kich_ban IS NOT NULL AND length(kich_ban)>80`).first()||{}).n);
  const dangHoc=(await env.DB.prepare(`SELECT tham_so FROM tram_lenh WHERE viec='huan_luyen' AND trang_thai IN ('CHO','DA_GUI')`).all()).results.map(l=>docJSON(l.tham_so,{}).tinh_nang);
  return KY_NANG.map(k=>{ const tn=k.tinh_nang[0]; const dt=dts.find(d=>d.tinh_nang===tn)||{}; const soMau=mau.filter(m=>k.tinh_nang.includes(m.tinh_nang)&&m.tinh_nang===tn).reduce((a,x)=>a+x.n,0);
    const theoDong=mau.filter(m=>m.tinh_nang===tn&&m.dong).map(m=>({dong:m.dong, n:m.n})); const moi=pbs.find(p=>p.tinh_nang===tn&&p.trang_thai==='CHO_DUYET'&&(p.pham_vi||'chung')==='chung'); const dangDung=pbs.find(p=>p.tinh_nang===tn&&p.trang_thai==='DUYET'&&(p.pham_vi||'chung')==='chung'); const banRieng=pbs.filter(p=>p.tinh_nang===tn&&p.trang_thai==='DUYET'&&p.pham_vi&&p.pham_vi!=='chung').map(p=>({pham_vi:p.pham_vi, diem:so(p.danh_gia.diem)}));
    let can=so(dt.min_mau,30), co=soMau; if(k.id==='cat_ghep'){ can=20; co=soTP; } if(k.id==='viet'){ can=60; co=soMau+soKB; }
    const trangThai=moi?'MOI':dt.muc==='MO'?'NHA':(dangHoc.includes(tn)?'DANG_HOC':co>=can?'DU_MAU':'GOM');
    return { ...k, tinh_nang_chinh:tn, muc:dt.muc||'API', trang_thai:trangThai, so_mau:co, can, theo_dong:theoDong, ban_moi:moi?{id:moi.id, phien_ban:moi.phien_ban, diem:so(moi.danh_gia.diem), diem_truoc:so(moi.danh_gia.diem_truoc), n_kiem:so(moi.danh_gia.n_kiem), vi_du:moi.danh_gia.vi_du||[], may:moi.may, luc:moi.created_at}:null, dang_dung:dangDung?{phien_ban:dangDung.phien_ban, diem:so(dangDung.danh_gia.diem), luc:dangDung.duyet_at}:null, ban_rieng:banRieng, dang_hoc:dangHoc.includes(tn), so_kich_ban:k.id==='viet'?soKB:undefined }; }); }
async function handleApi(request, env){
  const url=new URL(request.url); const path=url.pathname.replace(/^\/api/,''); const method=request.method; let m=null;
  // Upload media lên R2 (nhị phân, không parse JSON). Đường cũ /filming/upload giữ cho công cụ Lọc/Dựng video.
  if((path==='/tai-san/upload'||path==='/filming/upload'||path==='/hub/upload') && method==='POST'){
    await ensureSchema(env);
    if(path==='/hub/upload' || request.headers.get('X-Hub-Key')){ const xt=await xacThucHub(env, request); if(!xt.ok) return json({error:xt.loi}, xt.status); }   // Trạm tải video dựng / ảnh lên bằng khoá hub
    else { const sess=await getSession(env, request); if(!sess) return json({error:'Chưa đăng nhập'},401); if(!isStaff(sess.user)) return json({error:'Không có quyền'},403); }
    if(!env.MEDIA) return json({error:'Chưa cấu hình kho lưu file (R2 MEDIA) — dán link thay thế'},503);
    const ct=url.searchParams.get('type')||request.headers.get('content-type')||'application/octet-stream'; const len=Number(request.headers.get('content-length')||0);
    if(!request.body||len<=0) return json({error:'File rỗng'},400); if(len>200*1024*1024) return json({error:'File quá lớn (>200MB) — dán link Drive'},413);
    const ext=((ct.split('/')[1]||'bin').split(';')[0]).replace(/[^a-z0-9]/gi,'')||'bin'; const key='media/'+uid('m')+'.'+ext;
    await env.MEDIA.put(key, request.body, { httpMetadata:{ contentType:ct } });
    return json({ media_url:'/media/'+key, media_type: ct.startsWith('image/')?'IMAGE':ct.startsWith('audio/')?'AUDIO':/zip|octet-stream|x-tar/.test(ct)?'FILE':'VIDEO' });
  }
  // n8n báo kết quả đăng (secret dùng chung, không phiên người)
  // ADR-005: n8n / agent ngoài đẩy số đo (X-App-Token). Số tích luỹ → app tính phần tăng theo ngày; không quy đơn.
  if(path==='/ket-qua/ingest' && method==='POST'){ if(!env.N8N_TOKEN) return json({error:'Chưa cấu hình N8N_TOKEN'},503); if((request.headers.get('X-App-Token')||'')!==env.N8N_TOKEN) return json({error:'Sai token'},401);
    await ensureSchema(env); const b=await request.json().catch(()=>({})); const ds=Array.isArray(b.items)?b.items.slice(0,200):[]; if(!ds.length) return json({error:'Không có items'},400); let ghi=0; const loi=[];
    for(const o of ds){ let bd=null; if(o.bai_dang_id) bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(String(o.bai_dang_id)).first(); else if(o.link) bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE link=? ORDER BY posted_at DESC LIMIT 1`).bind(String(o.link).trim()).first(); if(!bd){ loi.push({item:o.bai_dang_id||o.link||'?', ly_do:'không khớp bài'}); continue; }
      await ghiKetQuaTichLuy(env, bd, 'NGOAI', o.tich_luy&&typeof o.tich_luy==='object'?o.tich_luy:o, laNgay(o.ky)?o.ky:ngayVN(), {api:chuoi(o.nen||'NGOAI',30), boi:chuoi(o.boi||'n8n',60)}); ghi++; }
    return json({ok:true, ghi, loi}); }
  if((m=path.match(/^\/bai-dang\/(.+)\/n8n-callback$/)) && method==='POST'){
    if(!env.N8N_TOKEN) return json({error:'Chưa cấu hình N8N_TOKEN'},503); if((request.headers.get('X-App-Token')||'')!==env.N8N_TOKEN) return json({error:'Sai token'},401);
    await ensureSchema(env); const cb=await request.json().catch(()=>({})); const bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(m[1]).first(); if(!bd) return json({error:'Không tìm thấy bài'},404);
    if(cb.ok===true){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DA_DANG', link=?, posted_at=?, loi=NULL, updated_at=? WHERE id=?`).bind(chuoi(cb.link,500)||bd.link||'', nowISO(), nowISO(), bd.id).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DANG', 'n8n báo đã đăng', MAY('n8n')); return json({ok:true}); }
    await env.DB.prepare(`UPDATE bai_dang SET trang_thai='LOI', loi=?, updated_at=? WHERE id=?`).bind(chuoi(cb.loi||'n8n báo thất bại',300), nowISO(), bd.id).run(); return json({ok:true, recorded:'that_bai'});
  }
  const body=(method==='POST'||method==='PATCH'||method==='PUT') ? await request.json().catch(()=>({})) : {};
  await ensureSchema(env);
  if(path==='/nhac' && method==='GET') return json([]);
  // ===== ADR-004 — hợp đồng hub1 với Trạm (xác thực X-Hub-Key, không phiên người) =====
  if(path.startsWith('/hub/')){
    const xt=await xacThucHub(env, request); if(!xt.ok) return json({error:xt.loi}, xt.status);
    if(path==='/hub/ping' && method==='GET') return json({ ok:true, app:'content_os', ten:'Kingsmen Content OS', ban:'2.0.'+4, hop_dong:1, mon:MON_HUB, nhan_lenh:true, may_id:xt.may_id });
    // ADR-008 — máy con tải script mới nhất từ app (kèm hash để máy chỉ chạy đúng bản app phát) — mã dựng nằm ở app, không nằm trên máy
    if((m=path.match(/^\/hub\/script\/([a-z0-9-]+)$/)) && method==='GET'){ if(!['dung-video','nhin','mo-hinh','huan-luyen','piper','loc-footage','danh-gia-ngon-ngu','nap-drive','phan-tich','hoc-thanh-pham','doc-khung'].includes(m[1])) return json({error:'Không có script '+m[1]},404); const r=await env.ASSETS.fetch(new Request(url.origin+'/tools/may-dung/'+m[1]+'.mjs')); if(!r.ok) return json({error:'App chưa đóng gói script '+m[1]},503); const script=await r.text(); const hash=await sha256Hex(script); return json({ ten:m[1], ban:hash.slice(0,12), hash, script }); }
    // NẠP DRIVE (24/09): máy con hỏi file nào đã nạp cho thẻ (khỏi tải lại), rồi gửi từng tài sản; app nhờ Claude nhìn khung hình viết mô tả
    // ADR-010b: phân tích footage đã có trong kho (clip nạp trước khi có 010b) — máy con hỏi danh sách, gửi lại phân tích
    if(path==='/hub/viec/phan_tich' && method==='GET'){ const mid=chuoi(url.searchParams.get('muc_id'),40); const goc=env.APP_BASE_URL||url.origin; const ds=(await env.DB.prepare(`SELECT id,ten,media_url,media_type FROM tai_san WHERE loai IN ('FOOTAGE','ANH') AND (phan_tich IS NULL OR phan_tich NOT LIKE '%"doan":[{%') AND media_type='VIDEO' AND (?='' OR muc_id=?) ORDER BY created_at DESC LIMIT 40`).bind(mid||'', mid||'').all()).results; return json({ viec: ds.map(t=>({...t, media_url:/^https?:/.test(t.media_url)?t.media_url:goc+t.media_url})) }); }
    // ADR-014a — đọc từng giây: danh sách footage cần đọc + quy trình thi công chuẩn của sản phẩm (danh mục) để mô hình nhìn gắn đúng bước
    if(path==='/hub/viec/doc_khung' && method==='GET'){ const mid=chuoi(url.searchParams.get('muc_id'),40), tid=chuoi(url.searchParams.get('tai_san_id'),40), lai=url.searchParams.get('lai')==='1'; const goc=env.APP_BASE_URL||url.origin;
      await MAU().dam(env);
      const ds=(await env.DB.prepare(`SELECT t.id,t.ten,t.media_url,t.phan_tich,t.muc_id,m.tieu_de,sp.ten sp_ten,sp.dong,sp.quy_trinh,sp.bai_test FROM tai_san t LEFT JOIN muc_noi_dung m ON m.id=t.muc_id LEFT JOIN san_pham sp ON sp.id=m.san_pham_id WHERE t.loai='FOOTAGE' AND t.media_type='VIDEO' AND (?='' OR t.muc_id=?) AND (?='' OR t.id=?) ORDER BY t.created_at LIMIT 60`).bind(mid||'',mid||'',tid||'',tid||'').all()).results;
      const daDoc=new Set((await env.DB.prepare(`SELECT DISTINCT doi_tuong_id d FROM mau_doan WHERE loai='HINH' AND nguon='FOOTAGE' AND hieu_luc=1`).all()).results.map(x=>x.d));
      const vdDong={}; for(const t of ds){ const k=t.dong||''; if(!vdDong[k]) vdDong[k]=await MAU().viDu(env, t.dong, 10); }
      const dsDong=(v)=>String(v||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,20);
      return json({ viec: ds.filter(t=>lai||!daDoc.has(t.id)).map(t=>({ id:t.id, ten:t.ten, media_url:/^https?:/.test(t.media_url)?t.media_url:goc+t.media_url, dai:so(docJSON(t.phan_tich,{}).dai), chu_de:t.tieu_de||'', san_pham:t.sp_ten||'', dong:t.dong||'', quy_trinh:dsDong(t.quy_trinh), bai_test:dsDong(t.bai_test), vi_du:vdDong[t.dong||''] })) }); }
    if(path==='/hub/cau-hinh-hoc' && method==='GET'){ const hl=(await docCauHinh(env)).huan_luyen||{}; return json({ anh_xa_dong:(hl.anh_xa_dong||[]).filter(x=>x&&x.chua&&x.dong) }); }
    if(path==='/hub/thay-doc' && method==='POST') return MAU().hubThayDoc(env, body);   // ADR-018: thầy gán đủ trường theo Bộ nhãn
    if(path==='/hub/doc-khung' && method==='POST'){ const t=await env.DB.prepare(`SELECT t.id,t.ten,t.media_url,t.phan_tich,sp.dong FROM tai_san t LEFT JOIN muc_noi_dung mu ON mu.id=t.muc_id LEFT JOIN san_pham sp ON sp.id=mu.san_pham_id WHERE t.id=?`).bind(chuoi(body.tai_san_id,40)).first(); if(!t) return json({error:'Không có tài sản'},404);
      const tl=tlSach(body.timeline); if(!tl.length) return json({error:'Dòng thời gian rỗng'},400); const pt=docJSON(t.phan_tich,{})||{}; delete pt.timeline; pt.mau_doan=1; pt.vl={ model:chuoi(body.model,60), so_khung:so(body.so_khung), ms_khung:so(body.ms_khung), luc:nowISO(), may:chuoi(body.may,80), tong_quan:chuoi(body.tong_quan,200)||null };
      const kq=await MAU().upsertHinh(env,{ nguon:'FOOTAGE', doi_tuong_id:t.id, dong:t.dong, ten:t.ten, media_url:t.media_url, timeline:tl, pt, khungCua:(d)=>Array.isArray(pt.khung)&&pt.khung.length?pt.khung[Math.min(pt.khung.length-1, Math.floor(pt.khung.length*((d.tu+d.den)/2)/Math.max(1,so(pt.dai)||d.den)))]:null });   // giữ nhãn người của đúng đoạn khi đọc lại
      await env.DB.prepare(`UPDATE tai_san SET phan_tich=? WHERE id=?`).bind(JSON.stringify(pt), t.id).run(); return json({ ok:true, so_doan:tl.length, de_xuat:kq.de_xuat }); }
    if(path==='/hub/phan-tich' && method==='POST'){ const t=await env.DB.prepare(`SELECT * FROM tai_san WHERE id=?`).bind(chuoi(body.tai_san_id,40)).first(); if(!t) return json({error:'Không có tài sản'},404); const khungDs=(Array.isArray(body.khung_urls)?body.khung_urls:[]).map(x=>chuoi(x,500)).filter(Boolean).slice(0,3);
      const cu=docJSON(t.phan_tich,{}); let coCanh=cu.co_canh||null, moTa=t.mo_ta; if(khungDs.length&&(!coCanh||body.mo_ta_lai)){ const mt=await moTaKhungHinh(env, khungDs, ''); coCanh=mt.co_canh||coCanh; if(mt.mo_ta) moTa=[mt.mo_ta, String(t.mo_ta||'').split(' · ').slice(1).join(' · ')].filter(Boolean).join(' · ').slice(0,500); }
      const pt=phanTichSach(body.phan_tich, khungDs.length?khungDs:(cu.khung||[]), coCanh); if(pt&&cu.vl){ pt.vl=cu.vl; pt.mau_doan=cu.mau_doan; } await env.DB.prepare(`UPDATE tai_san SET phan_tich=?, mo_ta=? WHERE id=?`).bind(JSON.stringify(pt), moTa, t.id).run(); if(pt) await MAU().capNhatSoDo(env, t.id, pt); return json({ ok:true, co_canh:pt.co_canh }); }
    // ADR-010d: một video thành phẩm đã phân tích → kho + mẫu học (ghep_canh luôn; chon_canh khi có lời nói theo shot; chon_doan khi khớp clip gốc)
    if(path==='/hub/viec/tai_tiktok' && method==='GET'){ const cfg=await docCauHinh(env); const hang=((cfg.tai_tiktok||{}).hang)||[]; const da=(await env.DB.prepare(`SELECT nguon_id FROM kho_thanh_pham WHERE nguon='TIKTOK'`).all()).results.map(x=>x.nguon_id); return json({ viec: hang, da_co: da }); }
    if(path==='/hub/tiktok-da-tai' && method==='POST'){ const kenh=chuoi(body.kenh,60), thu=chuoi(body.thu_muc,300); if(!kenh||(!thu&&!Array.isArray(body.links))) return json({error:'Thiếu kênh/danh sách'},400);
      const cfg=await docCauHinh(env); const mucCu=(((cfg.tai_tiktok||{}).hang)||[]).find(x=>x.kenh===kenh)||{}; const hang=(((cfg.tai_tiktok||{}).hang)||[]).filter(x=>x.kenh!==kenh); await env.DB.prepare(`UPDATE module_config SET cau_hinh=? WHERE id='tai_tiktok'`).bind(JSON.stringify({hang})).run();
      const dsLink=(Array.isArray(body.links)?body.links:[]).slice(0,60).map(v=>({link:chuoi(v.link,300), meta:(v.meta&&typeof v.meta==='object')?v.meta:{}})).filter(v=>/tiktok\.com\/.+\/video\/\d+/.test(v.link));
      if(Array.isArray(body.links)&&!dsLink.length) return json({ok:true, giao:false, loi:'Trạm gửi danh sách rỗng cho '+kenh+' — không giao máy học'});
      if(dsLink.length){ const mayId=await mayManhNhat(env,'dung_video'); if(!mayId) return json({ok:true, giao:false, loi:'chưa ghép máy học nào'}); const r=await taoLenhTram(env,'hoc_thanh_pham',{nguon:chuoi(body.nguon,10)==='KALODATA'?'KALODATA':'TIKTOK', kenh, toi_da:dsLink.length, dong:mucCu.dong||null, muc_dich:mucCu.muc_dich||null, links:dsLink}, MAY('Trạm'), mayId); return json({ ok:true, giao:true, lenh_id:r.id }); }
      const dsVideo=(Array.isArray(body.video)?body.video:[]).slice(0,60).map(v=>({ten:chuoi(v.ten,120), url:chuoi(v.url,500), meta:(v.meta&&typeof v.meta==='object')?v.meta:{}})).filter(v=>v.ten&&/^\/media\//.test(v.url)); const ttTram=await docTramTrangThai(env); const hostTram=(ttTram&&(ttTram.may||ttTram.hostname))||null; const mayId=dsVideo.length?(await mayChoViec(env,'dung_video')):(await mayChoViec(env,'dung_video',{cungMay:hostTram})||await mayChoViec(env,'mo_hinh')); if(!mayId) return json({ok:true, giao:false, loi:'không có máy dựng đang bật — nạp lại sau'});   // thư mục Trạm tải về nằm trên ổ máy Trạm
      const r=await taoLenhTram(env,'hoc_thanh_pham',{nguon:chuoi(body.nguon,10)==='KALODATA'?'KALODATA':'TIKTOK', kenh, duong_dan:dsVideo.length?null:thu, video:dsVideo.length?dsVideo:undefined, toi_da:Math.max(1,Math.min(60,so(body.so,20))), dong:mucCu.dong||null, muc_dich:mucCu.muc_dich||null}, MAY('Trạm'), mayId); return json({ ok:true, giao:true, lenh_id:r.id }); }
    // ADR-011 — Kalodata: Trạm hỏi ngành hàng cần quét (đến hạn theo lịch tuần hoặc chủ bấm quét); Trạm trả bảng video → app xếp hàng tải bằng tiktok_cn
    if(path==='/hub/viec/kalodata' && method==='GET'){ const cfg=(await docCauHinh(env)).kalodata||{}; const nganh=Array.isArray(cfg.nganh)?cfg.nganh:[]; const lanCuoi=cfg.lan_cuoi?new Date(cfg.lan_cuoi).getTime():0; const denHan=!!cfg.quet_ngay||(cfg.tu_dong!==false&&nganh.length>0&&Date.now()-lanCuoi>6.5*864e5); return json({ viec: denHan&&nganh.length?{ nganh, top_n:Math.max(3,Math.min(50,so(cfg.top_n,10))), khu_vuc:cfg.khu_vuc||'VN', thoi_gian:cfg.thoi_gian||'30' }:null, da_co:(await env.DB.prepare(`SELECT link FROM kho_thanh_pham WHERE link IS NOT NULL`).all()).results.map(x=>x.link) }); }
    if(path==='/hub/kalodata' && method==='POST'){ const nganh=chuoi(body.nganh,80); const ds=(Array.isArray(body.video)?body.video:[]).slice(0,60).map(v=>({ link:chuoi(v.link,300), tieu_de:chuoi(v.tieu_de,300), kenh:chuoi(v.kenh,80), doanh_thu:v.doanh_thu==null?null:+so(v.doanh_thu).toFixed(2), luot_ban:v.luot_ban==null?null:Math.round(so(v.luot_ban)), luot_xem:v.luot_xem==null?null:Math.round(so(v.luot_xem)), san_pham:chuoi(v.san_pham,200), ngay_dang:chuoi(v.ngay_dang,30) })).filter(v=>/tiktok\.com\/.+\/video\/\d+/.test(v.link));
      const cfg=await docCauHinh(env); const kd={...(cfg.kalodata||{}), lan_cuoi:nowISO(), quet_ngay:false, ket_qua_cuoi:{nganh, so:ds.length, loi:chuoi(body.loi,300)||null, luc:nowISO()}}; await env.DB.prepare(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES ('kalodata',?,?,'Trạm') ON CONFLICT(id) DO UPDATE SET cau_hinh=excluded.cau_hinh, updated_at=excluded.updated_at`).bind(JSON.stringify(kd), nowISO()).run();
      if(!ds.length) return json({ ok:true, so:0 });
      const slug=(nganh||'kalodata').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'kalodata'; const kenh='kalodata:'+slug;
      // 24/09 tối (chủ: "tải về máy Q2 luôn để huấn luyện"): không qua Trạm tải nữa — giao thẳng máy học mạnh nhất, máy đó tự tải về ổ của nó
      const mayId=await mayManhNhat(env,'dung_video'); if(!mayId) return json({ ok:true, so:ds.length, kenh, giao:false, loi:'chưa ghép máy học nào' });
      const kdc=cfg.kalodata||{}; const r=await taoLenhTram(env,'hoc_thanh_pham',{nguon:'KALODATA', kenh, nganh, toi_da:ds.length, dong:kdc.dong||null, muc_dich:kdc.muc_dich||'BAN_HANG', links:ds.map(v=>({link:v.link, meta:{...v, nganh}}))}, MAY('Kalodata'), mayId); return json({ ok:true, so:ds.length, kenh, giao:true, lenh_id:r.id }); }

    if(path==='/hub/viec/thanh_pham' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT nguon_id, ten FROM kho_thanh_pham`).all()).results; return json({ da_co: ds.map(x=>x.nguon_id||x.ten) }); }
    if(path==='/hub/thanh-pham' && method==='POST'){ const ten=chuoi(body.ten,200); const nid=chuoi(body.nguon_id,120)||ten; if(!ten) return json({error:'Thiếu tên'},400); const daCo=await env.DB.prepare(`SELECT id, proxy_url FROM kho_thanh_pham WHERE nguon_id=?`).bind(nid).first(); if(daCo&&!body.lam_lai) return json({ok:true, trung:true});
      if(daCo){ await env.DB.prepare(`DELETE FROM mau_hoc_ai WHERE doi_tuong='kho_thanh_pham' AND doi_tuong_id=? AND tinh_nang<>'nhan_khung'`).bind(daCo.id).run(); await env.DB.prepare(`DELETE FROM kho_thanh_pham WHERE id=?`).bind(daCo.id).run(); }   // học lại: thay bản cũ cùng mẫu của nó
      const shots=(Array.isArray(body.shots)?body.shots:[]).slice(0,120).map(x=>({ t0:+so(x.t0).toFixed(2), t1:+so(x.t1).toFixed(2), co_canh:CO_CANH.includes(x.co_canh)?x.co_canh:null, loi:chuoi(x.loi,300), khung_url:chuoi(x.khung_url,500), goc:x.goc&&typeof x.goc==='object'?{ten:chuoi(x.goc.ten,200), tu:+so(x.goc.tu).toFixed(2), den:+so(x.goc.den).toFixed(2), diem:+so(x.goc.diem).toFixed(3), doan:Array.isArray(x.goc.doan)?x.goc.doan.slice(0,240):null, dai:so(x.goc.dai)}:null, nhom:NHOM_CANH.includes(x.nhom)?x.nhom:null, buoc:chuoi(x.buoc,80)||null, bai_test:chuoi(x.bai_test,80)||null, tham_my:x.tham_my==null?null:Math.max(0,Math.min(10,so(x.tham_my))), tu_tin:x.tu_tin==null?null:+so(x.tu_tin).toFixed(2), mo_ta_vl:chuoi(x.mo_ta_vl,200)||null, am_url:/^\/media\//.test(String(x.am_url||''))?chuoi(x.am_url,300):null })).filter(x=>x.t1>x.t0);
      if(shots.length<(body.mot_canh?1:2)) return json({error:'Cần ít nhất 2 shot'},400); const dai=so(body.dai)||shots[shots.length-1].t1; const coGoc=shots.filter(x=>x.goc).length;
      const canCo=shots.filter(x=>!x.co_canh&&x.khung_url).slice(0,12); for(let i=0;i<canCo.length;i+=3){ const nhom=canCo.slice(i,i+3); const mt=await moTaKhungHinh(env, nhom.map(x=>x.khung_url), ''); if(mt.co_canh){ for(const x of nhom) if(!x.co_canh) x.co_canh=mt.co_canh; } if(mt.loi) break; }
      const luotXem=body.luot_xem==null?null:Math.max(0,Math.round(so(body.luot_xem))), kenh=chuoi(body.kenh,80)||null; const doanhThu=body.doanh_thu==null?null:Math.max(0,+so(body.doanh_thu).toFixed(2)); const kichBan=chuoi(body.kich_ban,6000)||shots.map(x=>x.loi).filter(Boolean).join(' ').slice(0,6000)||null;
      const id=daCo?daCo.id:uid('tp'); await env.DB.prepare(`INSERT INTO kho_thanh_pham (id,ten,nguon,nguon_id,thu_muc,dai,so_shot,nhip,co_goc,phan_tich,created_at,luot_xem,luot_thich,ngay_dang,link,kenh,doanh_thu,luot_ban,san_pham,kich_ban,dong,muc_dich) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, ten, ['DRIVE','LOCAL','TIKTOK','REELS','KALODATA'].includes(chuoi(body.nguon,10))?chuoi(body.nguon,10):'DRIVE', nid, chuoi(body.thu_muc,200), +dai.toFixed(2), shots.length, +(dai/shots.length).toFixed(2), coGoc, JSON.stringify({shots:shots.map(x=>({...x, goc:x.goc?{...x.goc, doan:undefined}:null})), mau_doan:1, thoi_gian:(body.thoi_gian&&typeof body.thoi_gian==='object')?Object.fromEntries(Object.entries(body.thoi_gian).slice(0,10).map(([k,v])=>[chuoi(k,20),+so(v).toFixed(1)])):null, may:chuoi(xt&&xt.may&&xt.may.ten,60)||null}), nowISO(), luotXem, body.luot_thich==null?null:Math.round(so(body.luot_thich)), chuoi(body.ngay_dang,30)||null, chuoi(body.link,300)||null, kenh, doanhThu, body.luot_ban==null?null:Math.round(so(body.luot_ban)), chuoi(body.san_pham,200)||null, kichBan, chuoi(body.dong,80)||null, MUC_DICH.includes(chuoi(body.muc_dich,10))?chuoi(body.muc_dich,10):null).run();
      const soLieu={luot_xem:luotXem, kenh, ngay_dang:chuoi(body.ngay_dang,30)||null, doanh_thu:doanhThu};
      let n=0; if(!body.mot_canh) await ghiMauAI(env,{tinh_nang:'ghep_canh', doi_tuong:'kho_thanh_pham', doi_tuong_id:id, dau_vao:{nguon:'THANH_PHAM', dai, ...soLieu}, dau_ra:null, nhan:{shots:shots.map(x=>({dai:+(x.t1-x.t0).toFixed(2), co_canh:x.co_canh, lap:0})), nguon:'THANH_PHAM'}}); n++;
      { const dongTP=chuoi(body.dong,80)||null, linkTP=chuoi(body.link,300)||null; const proxy=/^\/media\//.test(String(body.proxy_url||''))?chuoi(body.proxy_url,300):(daCo&&daCo.proxy_url)||null; if(proxy) await env.DB.prepare(`UPDATE kho_thanh_pham SET proxy_url=? WHERE id=?`).bind(proxy, id).run();
        await MAU().upsertHinh(env,{ nguon:'THANH_PHAM', doi_tuong_id:id, dong:dongTP, ten, link:linkTP, media_url:proxy, timeline:tlSach(body.timeline), khungCua:(d)=>{ const g=(d.tu+d.den)/2; const co=shots.filter(x=>x.khung_url); const sh=co.find(x=>g>=x.t0&&g<x.t1)||co.sort((a,b)=>Math.abs((a.t0+a.t1)/2-g)-Math.abs((b.t0+b.t1)/2-g))[0]; return sh?sh.khung_url:null; } }); const tlTP=tlSach(body.timeline); await MAU().upsertLoi(env,{ doi_tuong_id:id, dong:dongTP, ten, link:linkTP, media_url:proxy, shots:shots.map(s=>{ if(s.nhom) return s; const g=(s.t0+s.t1)/2; const d=tlTP.find(x=>g>=x.tu&&g<x.den); return d?{...s, hinh:d.thay||d.mo||{nhom:d.nhom, buoc:d.buoc, bai_test:d.bai_test}}:s; }) }); }   // ADR-018: đoạn hình + câu thoại vào kho mẫu
      // (24/09) KHÔNG ghi mẫu chon_canh từ video thành phẩm nữa: "lời thoại của shot ↔ khung shot" trong 30–40 shot cùng video là bài toán gần ngẫu nhiên → huấn luyện ra 4/100. Chọn cảnh chỉ học từ người chấm ✓/✗ và Chỉnh ghép.
      for(const x of shots.filter(y=>y.goc&&Array.isArray(y.goc.doan)&&y.goc.doan.length)){ await ghiMauAI(env,{tinh_nang:'chon_doan', doi_tuong:'kho_thanh_pham', doi_tuong_id:id, dau_vao:{...soLieu, tai_san_id:null, goc:x.goc.ten, doan:x.goc.doan, dai:x.goc.dai, can:+(x.t1-x.t0).toFixed(2), co_canh:x.co_canh}, dau_ra:null, nhan:{tu:x.goc.tu, den:x.goc.den, nguon:'THANH_PHAM'}}); n++; }
      return json({ ok:true, id, so_mau:n }); }
    // 25/09: bản xem 360p của video đã đăng (máy Q2 tạo) → người xem / nghe đúng đoạn mẫu trong Kho mẫu
    if(path==='/hub/thanh-pham/proxy' && method==='POST'){ const u=chuoi(body.proxy_url,300); if(!/^\/media\//.test(u)) return json({error:'proxy_url phải là file đã tải lên app'},400); const tp=await env.DB.prepare(`SELECT id FROM kho_thanh_pham WHERE nguon_id=? OR id=?`).bind(chuoi(body.nguon_id,120), chuoi(body.id,40)).first(); if(!tp) return json({error:'Không có video'},404);
      await env.DB.prepare(`UPDATE kho_thanh_pham SET proxy_url=? WHERE id=?`).bind(u, tp.id).run(); await MAU().dam(env); const r=await env.DB.prepare(`UPDATE mau_doan SET media_url=?, updated_at=? WHERE doi_tuong_id=?`).bind(u, nowISO(), tp.id).run(); return json({ ok:true, so_mau:(r.meta&&r.meta.changes)||0 }); }
    if(path==='/hub/mau-doan/anh' && method==='POST'){ const id=chuoi(body.doi_tuong_id,40); const ds=(Array.isArray(body.anh)?body.anh:[]).filter(x=>x&&/^\/media\//.test(String(x.url||''))).slice(0,120); await MAU().dam(env); let n=0;
      for(const x of ds){ const r=await env.DB.prepare(`UPDATE mau_doan SET khung_url=?, updated_at=? WHERE id=? AND khung_url IS NULL`).bind(chuoi(x.url,300), nowISO(), 'H:'+id+':'+Math.round(so(x.i))).run(); n+=(r.meta&&r.meta.changes)||0; } return json({ ok:true, so:n }); }
    if(path==='/hub/viec/nap_drive' && method==='GET'){ const mid=chuoi(url.searchParams.get('muc_id'),40); const ds=(await env.DB.prepare(`SELECT ten FROM tai_san WHERE muc_id=? AND nguon='DRIVE'`).bind(mid).all()).results; return json({ da_co: ds.map(x=>x.ten) }); }
    if(path==='/hub/tai-san' && method==='POST'){ const mucId=chuoi(body.muc_id,40); const muc=mucId?await env.DB.prepare(`SELECT id,tieu_de FROM muc_noi_dung WHERE id=?`).bind(mucId).first():null; if(!muc) return json({error:'Không có mục'},404);
      const media_url=chuoi(body.media_url,500); if(!/^\/media\//.test(media_url)) return json({error:'media_url phải là file đã tải lên app'},400); const ten=chuoi(body.ten,200)||media_url.split('/').pop(); const mt=String(body.media_type||'VIDEO').toUpperCase()==='IMAGE'?'IMAGE':'VIDEO';
      if(await env.DB.prepare(`SELECT id FROM tai_san WHERE muc_id=? AND ten=? AND nguon='DRIVE'`).bind(mucId, ten).first()) return json({ ok:true, trung:true });
      const nd=await env.DB.prepare(`SELECT id FROM noi_dung WHERE muc_id=? ORDER BY created_at DESC LIMIT 1`).bind(mucId).first();
      const khungDs=(Array.isArray(body.khung_urls)?body.khung_urls:[body.khung_url]).map(x=>chuoi(x,500)).filter(Boolean).slice(0,3); const mt2=await moTaKhungHinh(env, khungDs, muc.tieu_de); const moTa=[mt2.mo_ta, chuoi(body.thu_muc,120)?('thư mục '+chuoi(body.thu_muc,120)):'', body.giay?('clip '+so(body.giay)+' giây'):'', 'nguồn Drive'].filter(Boolean).join(' · ');
      const pt=phanTichSach(body.phan_tich, khungDs, mt2.co_canh); const id=uid('ts'); await env.DB.prepare(`INSERT INTO tai_san (id,loai,ten,mo_ta,media_url,media_type,muc_id,noi_dung_id,nguon,created_at,created_by_name,phan_tich) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, mt==='IMAGE'?'ANH':'FOOTAGE', ten, moTa.slice(0,500), media_url, mt, mucId, nd?nd.id:null, chuoi(body.nguon,20)==='LOCAL'?'LOCAL':'DRIVE', nowISO(), MAY('Máy (nạp Drive)').ho_ten, pt?JSON.stringify(pt):null).run();
      return json({ ok:true, id, mo_ta: moTa, loi_mo_ta: mt2.loi||null }); }
    // ADR-008 — giọng đọc tiếng Việt: khoá Google ở Worker, máy con chỉ nhận mp3; tính vào ngân sách AI (tính năng 'tts')
    if(path==='/hub/tts' && method==='POST'){ const text=chuoi(body.text,1500); if(!text) return json({error:'Thiếu text'},400); const key=env.GOOGLE_TTS_KEY; if(!key) return json({error:'Chưa cắm GOOGLE_TTS_KEY — video nháp không có giọng đọc', thieu_key:true},503);
      const cfg=(await docCauHinh(env)).dung_video||{}; const ns=await kiemNganSachAI(env); if(!ns.ok) return json({error:ns.loi, vuot_ngan_sach:true},402); const giong=chuoi(body.giong,40)||cfg.tts_giong||'vi-VN-Neural2-D'; const t0=Date.now();
      const res=await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:{text}, voice:{languageCode:'vi-VN', name:giong}, audioConfig:{audioEncoding:'MP3', speakingRate:Math.min(2,Math.max(0.5,so(cfg.tts_toc_do,1)||1))}})});
      const j=await res.json().catch(()=>({})); const usd=text.length*so(cfg.tts_usd_1m_ky_tu,16)/1e6;
      if(!res.ok||!j.audioContent){ await ghiAIUsage(env,{provider:'google',model:giong,tinh_nang:'tts',tokens_vao:text.length,ok:false,ms:Date.now()-t0,loi:(j.error&&j.error.message)||('HTTP '+res.status),chi_phi_usd:0}); return json({error:'TTS lỗi: '+((j.error&&j.error.message)||('HTTP '+res.status))},502); }
      await ghiAIUsage(env,{provider:'google',model:giong,tinh_nang:'tts',tokens_vao:text.length,ok:true,ms:Date.now()-t0,chi_phi_usd:usd});
      const bin=Uint8Array.from(atob(j.audioContent), c=>c.charCodeAt(0)); return new Response(bin,{headers:{'content-type':'audio/mpeg','x-tts-giong':giong,'x-tts-ky-tu':String(text.length)}}); }
    if(path==='/hub/lenh' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT * FROM tram_lenh WHERE trang_thai='CHO' AND COALESCE(may_id,'tram')=? ORDER BY created_at LIMIT 20`).bind(xt.may_id).all()).results; for(const l of ds) await env.DB.prepare(`UPDATE tram_lenh SET trang_thai='DA_GUI', gui_at=? WHERE id=?`).bind(nowISO(), l.id).run();
      // lệnh Trạm đã gửi quá 30 phút mà không báo xong → coi là hỏng (Trạm tắt giữa chừng)
      await env.DB.prepare(`UPDATE tram_lenh SET trang_thai='HONG', ket_qua='Trạm không báo kết quả sau 30 phút', xong_at=? WHERE trang_thai='DA_GUI' AND may_id IS NULL AND gui_at<?`).bind(nowISO(), new Date(Date.now()-30*60000).toISOString()).run();
      // (25/09) máy con lấy nhiều lệnh một lần rồi làm lần lượt: lệnh đang chờ sau một lượt học dài KHÔNG được đánh hỏng khi máy còn sống.
      // Chỉ hỏng khi máy giữ lệnh mất nhịp tim > 15 phút, hoặc lệnh quá 12 giờ.
      await env.DB.prepare(`UPDATE tram_lenh SET trang_thai='HONG', ket_qua='Máy con mất liên lạc hoặc quá 12 giờ không báo kết quả', xong_at=? WHERE trang_thai='DA_GUI' AND may_id IS NOT NULL AND (gui_at<? OR may_id NOT IN (SELECT id FROM may_ghep WHERE nhan_luc>?)) AND gui_at<?`).bind(nowISO(), new Date(Date.now()-12*3600e3).toISOString(), new Date(Date.now()-15*60000).toISOString(), new Date(Date.now()-15*60000).toISOString()).run();
      return json({ lenh: ds.map(l=>({id:l.id, viec:l.viec, tham_so:docJSON(l.tham_so,{})})) }); }
    if(path==='/hub/lenh_xong' && method==='POST'){ const l=await env.DB.prepare(`SELECT * FROM tram_lenh WHERE id=?`).bind(String(body.id||'')).first(); if(!l) return json({error:'không có lệnh'},404);
      await env.DB.prepare(`UPDATE tram_lenh SET trang_thai=?, ket_qua=?, xong_at=? WHERE id=?`).bind(body.ok?'XONG':'HONG', chuoi(body.msg,400), nowISO(), l.id).run(); await logAudit(env, MAY('Trạm'), 'Trạm '+(body.ok?'làm xong':'báo hỏng')+' lệnh', 'tram_lenh', l.id, l.viec+' · '+chuoi(body.msg,200)); return json({ok:true}); }
    if(path==='/hub/trang_thai' && method==='POST' && xt.may_id!=='tram'){ const kn=[...new Set(['dung_video', ...(Array.isArray(body.kha_nang)?body.kha_nang.map(x=>chuoi(x,30)).filter(x=>['dung_video','mo_hinh','huan_luyen'].includes(x)):[])])];
      await env.DB.prepare(`UPDATE may_ghep SET nhan_luc=?, ban=?, than=?, kha_nang=? WHERE id=?`).bind(nowISO(), chuoi(body.ban,20), JSON.stringify({ may:chuoi(body.may,80), gio_may:chuoi(body.gio_may,40), ffmpeg:body.ffmpeg!==false, gpu:chuoi(body.gpu,60), ollama:body.ollama===true, dang_lam:chuoi(body.dang_lam,120) }).slice(0,4000), JSON.stringify(kn), xt.may_id).run(); return json({ok:true, ban:'2.0.5', may_id:xt.may_id, kha_nang:kn}); }
    // ADR-009c — hàng đợi AI: máy ghép lấy việc MỞ của mình (tối đa 5), đánh dấu ĐANG; trả kết quả về /hub/ai-xong
    if(path==='/hub/viec/ai' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT * FROM ai_viec WHERE trang_thai='CHO' AND (may_id=? OR may_id IS NULL) ORDER BY created_at LIMIT 5`).bind(xt.may_id).all()).results; const out=[];
      for(const v of ds){ await env.DB.prepare(`UPDATE ai_viec SET trang_thai='DANG', bat_dau_at=?, may_id=? WHERE id=?`).bind(nowISO(), xt.may_id, v.id).run(); const mo=await docMoHinh(env, v.mo_hinh_id); out.push({ id:v.id, tinh_nang:v.tinh_nang, dau_vao:docJSON(v.dau_vao,{}), mo_hinh:{ id:v.mo_hinh_id, model_id:mo?mo.model_id:'qwen2.5:7b' } }); } return json({ viec: out }); }
    if(path==='/hub/ai-xong' && method==='POST'){ let cap=0; const kqs=[]; for(const d of (Array.isArray(body.dong)?body.dong:[body]).slice(0,20)){ const v=d.id?await env.DB.prepare(`SELECT * FROM ai_viec WHERE id=?`).bind(String(d.id)).first():null; if(!v||!['DANG','CHO'].includes(v.trang_thai)) continue; const ra=chuoi(d.dau_ra,60000);
        await env.DB.prepare(`UPDATE ai_viec SET trang_thai=?, dau_ra=?, loi=?, tokens_vao=?, tokens_ra=?, ms=?, xong_at=? WHERE id=?`).bind(ra?'XONG':'HONG', ra||null, ra?null:chuoi(d.loi,300)||'máy không trả kết quả', so(d.tokens_vao), so(d.tokens_ra), so(d.ms), nowISO(), v.id).run();
        await ghiAIUsage(env,{provider:'may_ghep', model:chuoi(d.model_id,80), tinh_nang:v.tinh_nang, tokens_vao:so(d.tokens_vao), tokens_ra:so(d.tokens_ra), ok:!!ra, ms:so(d.ms), loi:ra?null:chuoi(d.loi,200), chi_phi_usd:0, mo_hinh_id:v.mo_hinh_id, muc:'MO'});
        if(ra){ const dv=docJSON(v.dau_vao,{}); const nc=docJSON(v.ngu_canh,{}); await ghiMauAI(env,{tinh_nang:v.tinh_nang, mo_hinh_id:v.mo_hinh_id, doi_tuong:nc.y_tuong_id?'y_tuong':nc.bao_cao_id?'bao_cao':null, doi_tuong_id:nc.y_tuong_id||nc.bao_cao_id||null, dau_vao:{system:String(dv.system||'').slice(0,3000), user:(dv.messages||[]).map(x=>String(x.content||'')).join('\n').slice(0,4000)}, dau_ra:ra.slice(0,6000)}); const kq=await xuLyAIViec(env, {...v, dau_ra:ra}); kqs.push({id:v.id, ok:kq.ok, loi:kq.loi}); }
        else { const kq=await chayLaiAPI(env, v); kqs.push({id:v.id, ok:kq.ok, du_phong:true}); } cap++; } return json({ok:true, cap, kq:kqs}); }
    // ADR-009c — lọc footage: máy ghép lấy footage thô + kịch bản; trả lô content_os.loc_footage
    if(path==='/hub/viec/loc_footage' && method==='GET'){ const chi=chuoi(url.searchParams.get('noi_dung_id'),40); const nd=chi?await env.DB.prepare(`SELECT n.*, m.tieu_de muc_tieu_de FROM noi_dung n LEFT JOIN muc_noi_dung m ON m.id=n.muc_id WHERE n.id=?`).bind(chi).first():null; if(!nd) return json({ viec: [] }); const goc=env.APP_BASE_URL||url.origin; const tuyet=u=>/^https?:/.test(u||'')?u:goc+u;
      const ts=(await env.DB.prepare(`SELECT id,media_url,media_type,loai,ten,mo_ta,nguon FROM tai_san WHERE (muc_id=? OR noi_dung_id=?) AND loai='FOOTAGE' AND media_type='VIDEO' AND COALESCE(nguon,'')<>'MAY'`).bind(nd.muc_id, nd.id).all()).results; const mh=await env.DB.prepare(`SELECT * FROM dinh_tuyen WHERE tinh_nang='loc_footage'`).first(); const mo=mh?await docMoHinh(env, mh.mo_hinh_mo):null;
      return json({ viec: [{ noi_dung_id:nd.id, tieu_de:nd.tieu_de||nd.muc_tieu_de, hook:nd.hook, sections:docSections(nd.sections), footage:ts.map(t=>({...t, media_url:tuyet(t.media_url)})), muc:mh?mh.muc:'API', mo_hinh_mo:mo?{id:mo.id, model_id:mo.model_id, phien_ban:mo.phien_ban, checkpoint_url:mo.checkpoint_url?tuyet(mo.checkpoint_url):null}:null, whisper:(await docMoHinh(env,'whisper-base')||{}).model_id||'onnx-community/whisper-base' }] }); }
    // ADR-009c — tập mẫu ngôn ngữ để LoRA: cặp (system, user, bài máy, bài người đã duyệt, phán quyết)
    if(path==='/hub/tap-mau-ngon-ngu' && method==='GET'){ const tn=chuoi(url.searchParams.get('tinh_nang'),40)||'soan_nhap_agent'; const ds=(await env.DB.prepare(`SELECT m.id, m.tap, m.dau_vao, m.dau_ra, m.phan_quyet, m.doi_tuong_id, n.trang_thai nd_tt, n.tieu_de, n.hook, n.sections, n.cta, n.chi_tiet FROM mau_hoc_ai m LEFT JOIN noi_dung n ON n.id=m.doi_tuong_id WHERE m.tinh_nang=? AND (m.phan_quyet IS NOT NULL OR n.trang_thai='DUYET')`+dkPhamVi(url.searchParams.get('pham_vi')).sql.replace(' AND ',' AND m.')+` ORDER BY m.created_at DESC LIMIT 3000`).bind(tn, ...dkPhamVi(url.searchParams.get('pham_vi')).bind).all()).results;
      const dkB=dkPhamVi(url.searchParams.get('pham_vi')); const banTot=tn==='soan_nhap_agent'?(await env.DB.prepare(`SELECT id,ten,kich_ban,doanh_thu,luot_xem,san_pham,kenh FROM kho_thanh_pham WHERE kich_ban IS NOT NULL AND length(kich_ban)>80`+dkB.sql+` ORDER BY COALESCE(doanh_thu,0) DESC LIMIT 300`).bind(...dkB.bind).all()).results:[];
      return json({ tinh_nang:tn, mau: [...ds.map(r=>{ const dv=docJSON(r.dau_vao,{}); const pq=docJSON(r.phan_quyet,{})||{}; return { id:r.id, tap:r.tap, system:dv.system||'', user:dv.user||'', may:docJSON(r.dau_ra,r.dau_ra)||'', nguoi:(r.nd_tt==='DUYET'&&(r.tieu_de||r.hook))?JSON.stringify({tieu_de:r.tieu_de, hook:r.hook, sections:docSections(r.sections), cta:r.cta, ...docJSON(r.chi_tiet,{})}):'', quyet:pq.quyet||(r.nd_tt==='DUYET'?'DUYET':''), ly_do:pq.ly_do||'' }; }),
        ...banTot.map((x,i)=>({ id:'tp_'+x.id, tap:i%5===0?'KIEM':'HOC', system:'Bạn viết lời thoại video bán hàng TikTok Shop tiếng Việt: mở đầu 3 giây giữ người xem, nêu vấn đề, bằng chứng, chốt đơn.', user:'Viết lời thoại video bán hàng cho sản phẩm: '+(x.san_pham||x.ten)+(x.kenh?(' (kênh '+x.kenh+')'):''), may:'', nguoi:String(x.kich_ban), quyet:'DUYET', ly_do:'video thành phẩm bán tốt'+(x.doanh_thu?(' · doanh thu ~'+tienVN(x.doanh_thu)):'')+(x.luot_xem?(' · '+x.luot_xem+' lượt xem'):''), doanh_thu:x.doanh_thu, luot_xem:x.luot_xem }))] }); }
    // ADR-009 — bóng: máy ghép lấy mẫu chưa có đầu ra mở của các tính năng đang BÓNG/MỞ → chạy mô hình mở → trả /hub/bong
    if(path==='/hub/viec/bong' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT m.id, m.tinh_nang, m.dau_vao, d.mo_hinh_mo FROM mau_hoc_ai m JOIN dinh_tuyen d ON d.tinh_nang=m.tinh_nang WHERE m.dau_ra_mo IS NULL AND d.muc IN ('BONG','MO') AND d.mo_hinh_mo IS NOT NULL AND d.loai='NGON_NGU' AND m.created_at>=? ORDER BY m.created_at DESC LIMIT 10`).bind(new Date(Date.now()-7*864e5).toISOString()).all()).results;
      const out=[]; for(const r of ds){ const mo=await docMoHinh(env, r.mo_hinh_mo); if(!mo) continue; out.push({ mau_id:r.id, tinh_nang:r.tinh_nang, dau_vao:docJSON(r.dau_vao,{}), mo_hinh:{id:mo.id, nha_cung_cap:mo.nha_cung_cap, model_id:mo.model_id} }); } return json({ viec: out }); }
    if(path==='/hub/bong' && method==='POST'){ let cap=0; for(const d of (Array.isArray(body.dong)?body.dong:[body]).slice(0,50)){ const r=d.mau_id?await env.DB.prepare(`SELECT * FROM mau_hoc_ai WHERE id=?`).bind(String(d.mau_id)).first():null; if(!r) continue; const ra=chuoi(d.dau_ra_mo,6000); const g=ra?giongVanBan(docJSON(r.dau_ra,r.dau_ra)||'', ra):0;
        await env.DB.prepare(`UPDATE mau_hoc_ai SET dau_ra_mo=?, mo_hinh_mo_id=?, giong_mo=? WHERE id=?`).bind(JSON.stringify(ra||('(lỗi) '+chuoi(d.loi,200))), chuoi(d.mo_hinh_id,60)||r.mo_hinh_mo_id, ra?g:0, r.id).run(); await ghiAIUsage(env,{provider:'may_ghep', model:chuoi(d.model_id,80), tinh_nang:r.tinh_nang, tokens_vao:so(d.tokens_vao), tokens_ra:so(d.tokens_ra), ok:!!ra, ms:so(d.ms), loi:d.loi?chuoi(d.loi,200):null, chi_phi_usd:0, mo_hinh_id:chuoi(d.mo_hinh_id,60), muc:'BONG'}); cap++; } return json({ok:true, cap}); }
    // ADR-009 — tập mẫu để huấn luyện đầu nhìn: mẫu có nhãn người (chon_canh: cảnh + ứng viên + tài sản người chọn); link tuyệt đối để máy tải khung hình
    if(path==='/hub/tap-mau' && method==='GET'){ const tn=chuoi(url.searchParams.get('tinh_nang'),40)||'chon_canh'; const goc=env.APP_BASE_URL||url.origin; const tuyet=u=>/^https?:/.test(u||'')?u:goc+u;
      const dk=dkPhamVi(url.searchParams.get('pham_vi')); const ds=(await env.DB.prepare(`SELECT id, tap, dau_vao, nhan, dau_ra FROM mau_hoc_ai WHERE tinh_nang=? AND nhan IS NOT NULL`+dk.sql+` ORDER BY created_at DESC LIMIT 2000`).bind(tn, ...dk.bind).all()).results;
      return json({ tinh_nang:tn, mau: ds.map(r=>{ const dv=docJSON(r.dau_vao,{}); if(tn==='chon_doan'||tn==='ghep_canh') return { id:r.id, tap:r.tap, dau_vao:dv, nhan:docJSON(r.nhan,{}) }; return { id:r.id, tap:r.tap, luot_xem:dv.luot_xem??null, doanh_thu:dv.doanh_thu??null, kenh:dv.kenh||null, hinh:dv.hinh, text:dv.text, ung_vien:(dv.ung_vien||[]).map(u=>({...u, media_url:tuyet(u.media_url)})), nhan:docJSON(r.nhan,{}) }; }) }); }
    // máy dựng hỏi: tính năng nhìn đang ở mức nào, mô hình mở + checkpoint đã duyệt
    if((m=path.match(/^\/hub\/mo-hinh\/([a-z_]+)$/)) && method==='GET'){ const dt=await env.DB.prepare(`SELECT * FROM dinh_tuyen WHERE tinh_nang=?`).bind(m[1]).first(); if(!dt) return json({error:'Không có tính năng '+m[1]},404); const mo=await docMoHinh(env, dt.mo_hinh_mo); const goc=env.APP_BASE_URL||url.origin;
      const tuyet2=u=>u?(/^https?:/.test(u)?u:goc+u):null; let rieng=null; const dong=chuoi(url.searchParams.get('dong'),80), md=chuoi(url.searchParams.get('muc_dich'),10);
      const pbChung=mo?await env.DB.prepare(`SELECT danh_gia FROM mo_hinh_phien_ban WHERE tinh_nang=? AND mo_hinh_id=? AND trang_thai='DUYET' AND COALESCE(pham_vi,'chung')='chung' ORDER BY duyet_at DESC LIMIT 1`).bind(dt.tinh_nang, mo.id).first():null; const diemChung=pbChung?so(docJSON(pbChung.danh_gia,{}).diem):so(mo&&mo.diem);   // điểm kiểm của bản chung đã duyệt (mo_hinh.diem bị tính lại theo bóng nên không dùng để so)
      if(mo&&(dong||md)){ const pvs=[...(dong?['dong:'+dong]:[]), ...(md?['muc_dich:'+md]:[])]; const ds=(await env.DB.prepare(`SELECT * FROM mo_hinh_phien_ban WHERE tinh_nang=? AND mo_hinh_id=? AND trang_thai='DUYET' AND pham_vi IN (`+pvs.map(()=>'?').join(',')+`) ORDER BY duyet_at DESC`).bind(dt.tinh_nang, mo.id, ...pvs).all()).results; for(const pv of pvs){ const p=ds.find(x=>x.pham_vi===pv); if(p&&so(docJSON(p.danh_gia,{}).diem)>=diemChung+3){ rieng={ pham_vi:pv, phien_ban:p.phien_ban, checkpoint_url:tuyet2(p.checkpoint_url), model_id:p.model_id||mo.model_id, diem:so(docJSON(p.danh_gia,{}).diem) }; break; } } }
      return json({ tinh_nang:dt.tinh_nang, muc:dt.muc, pham_vi:rieng?rieng.pham_vi:'chung', mo_hinh_mo: mo?{ id:mo.id, model_id:rieng?rieng.model_id:mo.model_id, phien_ban:rieng?rieng.phien_ban:mo.phien_ban, checkpoint_url: rieng?rieng.checkpoint_url:tuyet2(mo.checkpoint_url), diem_chung:diemChung, diem_rieng:rieng?rieng.diem:null }:null }); }
    // máy huấn luyện gửi checkpoint + đánh giá → phiên bản CHỜ DUYỆT + việc Trưởng MKT (G4)
    if(path==='/hub/mo-hinh/phien-ban' && method==='POST'){ const mo=await docMoHinh(env, chuoi(body.mo_hinh_id,60)); if(!mo) return json({error:'Không có mô hình'},404); const dg=(body.danh_gia&&typeof body.danh_gia==='object')?body.danh_gia:{}; const pb=chuoi(body.phien_ban,40)||('v'+ngayVN().replace(/-/g,'')+'-'+uid('').slice(-4)); const id=uid('pb'); const kem=so(dg.diem)<so(dg.diem_truoc);   // kém quy tắc cũ → máy tự loại, không làm phiền người duyệt
      const phamVi=chuoi(body.pham_vi,90)||'chung'; await env.DB.prepare(`INSERT INTO mo_hinh_phien_ban (id,mo_hinh_id,tinh_nang,phien_ban,checkpoint_url,danh_gia,so_mau,may,trang_thai,created_at,model_id,pham_vi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, mo.id, chuoi(body.tinh_nang,40)||'chon_canh', pb, chuoi(body.checkpoint_url,500), JSON.stringify({diem:so(dg.diem), n_kiem:so(dg.n_kiem), n_hoc:so(dg.n_hoc), diem_truoc:so(dg.diem_truoc), ghi_chu:chuoi(dg.ghi_chu,300), vi_du:(Array.isArray(dg.vi_du)?dg.vi_du:[]).slice(0,8).map(x=>({mau_id:chuoi(x.mau_id,40), hinh:chuoi(x.hinh,200), text:chuoi(x.text,200), nguoi:chuoi(x.nguoi,40), moi:chuoi(x.moi,40), cu:chuoi(x.cu,40)}))}), so(dg.n_hoc)+so(dg.n_kiem), chuoi(body.may,80)||(xt.may?xt.may.ten:'máy'), kem?'TU_CHOI':'CHO_DUYET', nowISO(), chuoi(body.model_id,120)||null, phamVi).run();
      if(kem){ await env.DB.prepare(`UPDATE mo_hinh_phien_ban SET duyet_boi='Máy', duyet_at=?, ly_do=? WHERE id=?`).bind(nowISO(), 'máy tự loại: '+so(dg.diem)+'/100 kém quy tắc cũ '+so(dg.diem_truoc)+'/100', id).run(); await logAudit(env, MAY('Máy huấn luyện'), 'máy tự loại phiên bản', 'mo_hinh', mo.id, pb+' · '+so(dg.diem)+'/100 kém quy tắc cũ '+so(dg.diem_truoc)); return json({ok:true, id, phien_ban:pb, tu_loai:true}); }
      await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'DUYET_MO_HINH','Duyệt phiên bản mô hình '+mo.ten+' '+pb+(phamVi!=='chung'?(' ['+phamVi+']'):'')+' — khớp người '+so(dg.diem)+'/100 trên '+so(dg.n_kiem)+' mẫu kiểm','mo_hinh_phien_ban',id,'TRUONG_MKT',ngayVN(Date.now()+3*864e5),'Máy huấn luyện',(dg.diem_truoc?('phiên bản trước '+so(dg.diem_truoc)+'/100 · '):'')+'Máy › Bộ não AI › Huấn luyện',nowISO()).run();
      await logAudit(env, MAY('Máy huấn luyện'), 'gửi phiên bản mô hình', 'mo_hinh', mo.id, pb+' · '+so(dg.diem)+'/100'); return json({ok:true, id, phien_ban:pb}); }
    if(path==='/hub/trang_thai' && method==='POST'){ const than=JSON.stringify({ may:chuoi(body.may,80), ban:chuoi(body.ban,20), khoi_luc:chuoi(body.khoi_luc,40), gio_may:chuoi(body.gio_may,40), dung_nha:body.dung_nha!==false, phien:(body.phien&&typeof body.phien==='object')?body.phien:{}, hang_loat:body.hang_loat||null,
        // ADR-T01 đợt 4 (Trạm v9.161): sổ tài khoản (dung_den = Trạm dừng sau checkpoint) và nhân viên máy kèm tài khoản được cấp
        tai_khoan:Array.isArray(body.tai_khoan)?body.tai_khoan.slice(0,60):[], nhan_vien:Array.isArray(body.nhan_vien)?body.nhan_vien.slice(0,30):[] }).slice(0,60000);
      await env.DB.prepare(`INSERT INTO tram_trang_thai (id,than,nhan_luc) VALUES ('tram',?,?) ON CONFLICT(id) DO UPDATE SET than=excluded.than, nhan_luc=excluded.nhan_luc`).bind(than, nowISO()).run();
      /* "Thêm tài khoản ở Trạm là app dùng được" (chủ 24/09): tài khoản Facebook mà Trạm đã cấp cho nhân viên Seeding hội nhóm với vai đăng,
         app chưa khai → TỰ KHAI (nhãn = tên trên Trạm, giọng THỢ mặc định, nhịp = trần Trạm). Người còn phải: chọn đúng giọng/câu chuyện và
         gắn tài khoản vào nhóm nó là thành viên (máy không biết tài khoản nào ở nhóm nào). Không xoá khi Trạm bỏ — chỉ hiện ○ chưa đăng nhập. */
      let tuKhai=0; try{ const nvSeed=(Array.isArray(body.nhan_vien)?body.nhan_vien:[]).find(n=>n&&n.nv==='content_os:seeding'); const capDang={}; for(const c of ((nvSeed&&nvSeed.cap)||[])) if(c&&(c.vai||[]).includes('dang')) capDang[c.tk]=c;
        for(const t of (Array.isArray(body.tai_khoan)?body.tai_khoan:[])){ if(!t||t.nen!=='facebook'||!capDang[t.id]) continue; const co=await env.DB.prepare(`SELECT id FROM tai_khoan_seeding WHERE tram_id=?`).bind(t.id).first(); if(co) continue;
          const tran=(capDang[t.id].tran||{}).bai_ngay; await env.DB.prepare(`INSERT INTO tai_khoan_seeding (id,nhan,nen,tram_id,giong,persona,nhip_ngay,active,created_at) VALUES (?,?,'FB',?,?,?,?,1,?)`).bind(uid('tk'), chuoi(t.ten,80)||t.id, chuoi(t.id,60), 'THO', JSON.stringify({nghe:'',khu_vuc:'',cau_chuyen:'',tu_tram:true}), Math.max(1,Math.min(10,so(tran,2))), nowISO()).run();
          await logAudit(env, MAY('Trạm'), 'tự khai tài khoản seeding từ Trạm', 'tai_khoan_seeding', t.id, 'giọng THỢ mặc định — chọn lại giọng/câu chuyện và gắn nhóm ở Seeding › Tài khoản MKT'); tuKhai++; } }catch(e){}
      return json({ok:true, ban:'2.0.3', tu_khai:tuKhai}); }
    if(path==='/hub/nap' && method==='POST'){ const r=await napLoTram(env, body); return json(r); }
    // Trạm hỏi danh sách việc cho agent content_os (script content-os-dang / content-os-do-luong / content-os-dung-video)
    if(path==='/hub/viec/dang' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT b.*, k.ten kenh_ten, k.loai kenh_loai, k.api_object_id kenh_doi_tuong, n.dinh_dang, n.tieu_de FROM bai_dang b LEFT JOIN kenh k ON k.id=b.kenh_id LEFT JOIN noi_dung n ON n.id=b.noi_dung_id WHERE b.trang_thai='DANG_GUI' AND b.cach='TRAM' ORDER BY b.gio_dang LIMIT 20`).all()).results;
      const goc=env.APP_BASE_URL||''; return json({ viec: ds.map(b=>({ bai_dang_id:b.id, kenh:{ten:b.kenh_ten, loai:b.kenh_loai, doi_tuong:b.kenh_doi_tuong}, dinh_dang:b.dinh_dang, tieu_de:b.tieu_de, noi_dung:b.noi_dung_dang, media_url:b.media_url?(/^https?:/.test(b.media_url)?b.media_url:goc+b.media_url):'', gio_dang:b.gio_dang })) }); }
    if(path==='/hub/viec/do_luong' && method==='GET'){ const cfg=(await docCauHinh(env)).tram||{}; const tu=new Date(Date.now()-Math.max(1,so(cfg.so_ngay_do,30))*864e5).toISOString();
      const ds=(await env.DB.prepare(`SELECT b.id, b.link, b.posted_at, k.loai kenh_loai, k.ten kenh_ten, m.muc_tieu FROM bai_dang b LEFT JOIN kenh k ON k.id=b.kenh_id LEFT JOIN muc_noi_dung m ON m.id=b.muc_id WHERE b.trang_thai='DA_DANG' AND COALESCE(b.link,'')<>'' AND COALESCE(b.posted_at,b.updated_at)>=? ORDER BY b.posted_at DESC LIMIT 200`).bind(tu).all()).results;
      return json({ viec: ds.map(b=>({ bai_dang_id:b.id, link:b.link, kenh_loai:b.kenh_loai, kenh_ten:b.kenh_ten, muc_tieu:b.muc_tieu, posted_at:b.posted_at })) }); }
    if(path==='/hub/viec/seeding_dang' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT v.*, b.noi_dung bt_noi_dung, b.binh_luan bt_binh_luan, b.giong, b.dang_bai, n.ten nhom_ten, n.nen, n.link_hoac_id, n.quy_tac, t.tram_id, t.nhan tk_nhan FROM viec_seeding v JOIN bien_the b ON b.id=v.bien_the_id JOIN nhom_seeding n ON n.id=v.nhom_id LEFT JOIN tai_khoan_seeding t ON t.id=v.tai_khoan_id WHERE v.trang_thai='DANG_GUI' AND v.cach='TRAM' ORDER BY v.gio_dang LIMIT 20`).all()).results;
      return json({ viec: ds.map(v=>({ viec_id:v.id, nen:v.nen||'FB', nhom:{ten:v.nhom_ten, link_hoac_id:v.link_hoac_id, quy_tac:docJSON(v.quy_tac,{})}, tai_khoan:{tram_id:v.tram_id||'facebook', nhan:v.tk_nhan}, noi_dung:v.bt_noi_dung, binh_luan:docJSON(v.bt_binh_luan,[]), giong:v.giong, dang_bai:v.dang_bai })) }); }
    if(path==='/hub/viec/seeding_binh_luan' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT b.id, b.text, b.vai, v.link, t.tram_id, t.nhan FROM binh_luan_seeding b JOIN viec_seeding v ON v.id=b.viec_id LEFT JOIN tai_khoan_seeding t ON t.id=b.tai_khoan_id WHERE b.trang_thai='DANG_GUI' ORDER BY b.gio LIMIT 20`).all()).results; return json({ viec: ds.map(b=>({ id:b.id, link:b.link, text:b.text, vai:b.vai, tai_khoan:{tram_id:b.tram_id||'facebook', nhan:b.nhan} })) }); }
    if(path==='/hub/viec/seeding_nuoi' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT x.id, x.phut, x.tim, n.link_hoac_id, n.ten nhom_ten, t.tram_id, t.nhan FROM nuoi_seeding x JOIN nhom_seeding n ON n.id=x.nhom_id LEFT JOIN tai_khoan_seeding t ON t.id=x.tai_khoan_id WHERE x.trang_thai='DANG_GUI' ORDER BY x.gio LIMIT 10`).all()).results; return json({ viec: ds.map(x=>({ id:x.id, nhom:{ten:x.nhom_ten, link_hoac_id:x.link_hoac_id}, phut:so(x.phut), tim:so(x.tim), tai_khoan:{tram_id:x.tram_id||'facebook', nhan:x.nhan} })) }); }
    if(path==='/hub/viec/seeding_kiem' && method==='GET'){ const cfg=(await docCauHinh(env)).seeding||{}; const d1=new Date(Date.now()-Math.max(0,so(cfg.ngay_kiem,2))*864e5).toISOString(), d2=new Date(Date.now()-Math.max(1,so(cfg.ngay_kiem_2,7))*864e5).toISOString();
      const ds=(await env.DB.prepare(`SELECT v.id, v.link, v.trang_thai, v.so_lan_kiem, n.link_hoac_id, t.tram_id FROM viec_seeding v JOIN nhom_seeding n ON n.id=v.nhom_id LEFT JOIN tai_khoan_seeding t ON t.id=v.tai_khoan_id WHERE v.trang_thai IN ('DA_DANG','DAT','CHO_QUAN_TRI') AND COALESCE(v.link,'')<>'' AND ((v.so_lan_kiem=0 AND v.dang_at<=?) OR (v.so_lan_kiem=1 AND v.dang_at<=?)) ORDER BY v.dang_at LIMIT 50`).bind(d1,d2).all()).results;
      return json({ viec: ds.map(v=>({ viec_id:v.id, link:v.link, lan:so(v.so_lan_kiem)+1, cho_quan_tri:v.trang_thai==='CHO_QUAN_TRI', nhom:v.link_hoac_id, tai_khoan:{tram_id:v.tram_id||'facebook'} })) }); }
    if(path==='/hub/viec/dung_video' && method==='GET'){ const chi=chuoi(url.searchParams.get('noi_dung_id'),40); const ds=(await env.DB.prepare(`SELECT n.id, n.tieu_de, n.hook, n.sections, n.cta, n.chi_tiet, n.muc_id, m.tieu_de muc_tieu_de FROM noi_dung n LEFT JOIN muc_noi_dung m ON m.id=n.muc_id WHERE n.trang_thai='DUYET' AND n.dinh_dang='VIDEO' AND m.giai_doan='SAN_XUAT' ${chi?'AND n.id=?':''} ORDER BY n.updated_at DESC LIMIT 20`).bind(...(chi?[chi]:[])).all()).results;
      const goc=env.APP_BASE_URL||url.origin; const tuyet=u=>/^https?:/.test(u||'')?u:goc+u; const cfg=(await docCauHinh(env)).dung_video||{}; const nhac=(await env.DB.prepare(`SELECT id,ten,mo_ta,media_url FROM tai_san WHERE loai='NHAC' ORDER BY created_at DESC LIMIT 20`).all()).results.map(t=>({...t, media_url:tuyet(t.media_url)}));
      const out=[]; for(const nd of ds){ const ct=docJSON(nd.chi_tiet,{}); if(ct.video_url&&!chi) continue; const ts=(await env.DB.prepare(`SELECT id,media_url,media_type,loai,ten,mo_ta,phan_tich FROM tai_san WHERE (muc_id=? OR noi_dung_id=?) AND loai IN ('FOOTAGE','ANH') AND COALESCE(nguon,'')<>'THU_NGHIEM_LOAI'`).bind(nd.muc_id, nd.id).all()).results.map(t=>({...t, phan_tich:docJSON(t.phan_tich,null)})); const tlm=await MAU().timelineCua(env, ts.map(t=>t.id)); for(const t of ts) if(tlm[t.id]) t.phan_tich={...(t.phan_tich||{}), timeline:tlm[t.id]};
        const ghepId=chuoi(url.searchParams.get('ghep_id'),40); const gp=ghepId?await env.DB.prepare(`SELECT * FROM ghep_video WHERE id=? AND noi_dung_id=?`).bind(ghepId, nd.id).first():null;
        const phamVi=await phamViCua(env,'noi_dung',nd.id);
        out.push({ noi_dung_id:nd.id, tieu_de:nd.tieu_de||nd.muc_tieu_de, hook:nd.hook, sections:docSections(nd.sections), cta:nd.cta, pham_vi:phamVi, tai_san:ts.map(t=>({...t, media_url:tuyet(t.media_url)})), nhac, cau_hinh:{ tts_giong:cfg.tts_giong, nhac_giam_db:so(cfg.nhac_giam_db,18), canh_toi_da:so(cfg.canh_toi_da,12), giay_toi_da:so(cfg.giay_toi_da,90) }, ghep: gp?{id:gp.id, canh:docJSON(gp.canh,[])}:null }); } return json({ viec: out }); }
    return json({error:'Không có đường hub '+path},404);
  }   // công cụ Lọc video hỏi nhạc nền — không có trên web

  // (25/09) phiên bản đang chạy — lấy từ sổ deploy (deploy.mjs ghi commit + máy + giờ); app hiện ở góc phải dưới và so để báo "có bản mới"
  if(path==='/ban' && method==='GET'){ const r=await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='deploy_so'`).first().catch(()=>null); const d=r?docJSON(r.cau_hinh,{}):{}; return new Response(JSON.stringify({ commit:d.commit||null, luc:d.luc||null, may:d.may||null }),{ headers:{ 'content-type':'application/json', 'cache-control':'no-store' } }); }
  if(path==='/login' && method==='POST'){
    const email=chuoi(body.email,200).toLowerCase();
    const u=await env.DB.prepare(`SELECT * FROM users WHERE lower(email)=?`).bind(email).first();
    if(!u) return json({error:'Email chưa đăng ký'},401);
    if(!(await verifyPassword(body.password||'', u.password))) return json({error:'Sai mật khẩu'},401);
    if(!uBool(u.active)) return json({error:'Tài khoản đang bị khoá'},403);
    const token=crypto.randomUUID()+crypto.randomUUID().replace(/-/g,'');
    await env.DB.prepare(`INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)`).bind(token,u.id,new Date(Date.now()+30*864e5).toISOString()).run();
    return json({ token, db: await bootstrap(env,u) });
  }
  if(path==='/suc-khoe' && method==='GET') return json({ok:true, app:'kingsmen-content-os', dot:1});

  const sess=await getSession(env, request); if(!sess) return json({error:'Chưa đăng nhập'},401);
  const me=sess.user;
  if(path==='/logout' && method==='POST'){ await env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(sess.token).run(); return json({ok:true}); }
  if(path==='/bootstrap' && method==='GET') return json({ db: await bootstrap(env,me) });

  // --- hồ sơ cá nhân ---
  if(path==='/me' && method==='PATCH'){
    const ten=chuoi(body.ho_ten,120)||me.ho_ten;
    if(body.password){ if(String(body.password).length<6) return json({error:'Mật khẩu tối thiểu 6 ký tự'},400);
      await env.DB.prepare(`UPDATE users SET ho_ten=?, password=?, doi_mat_khau=0 WHERE id=?`).bind(ten, await hashPassword(String(body.password)), me.id).run(); }
    else await env.DB.prepare(`UPDATE users SET ho_ten=? WHERE id=?`).bind(ten, me.id).run();
    await logAudit(env,me,'sửa hồ sơ','user',me.id, body.password?'đổi mật khẩu':'');
    return json({ db: await bootstrap(env, await env.DB.prepare(`SELECT * FROM users WHERE id=?`).bind(me.id).first()) });
  }
  // --- người dùng (Admin, Trưởng MKT) ---
  if(path==='/users' && method==='POST'){
    if(!canNguoiDung(me)) return json({error:'Không có quyền'},403);
    const email=chuoi(body.email,200).toLowerCase();
    if(!chuoi(body.ho_ten)||!email||!body.password) return json({error:'Nhập đủ họ tên, email, mật khẩu'},400);
    if(await env.DB.prepare(`SELECT id FROM users WHERE lower(email)=?`).bind(email).first()) return json({error:'Email đã tồn tại'},409);
    if(!Object.values(ROLES).includes(body.vai_tro)) return json({error:'Vai trò không hợp lệ'},400);
    if(body.vai_tro===ROLES.ADMIN && me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin tạo được Admin'},403);
    const id=uid('u');
    await env.DB.prepare(`INSERT INTO users (id,ho_ten,email,password,vai_tro,active,doi_mat_khau,created_at) VALUES (?,?,?,?,?,1,1,?)`).bind(id,chuoi(body.ho_ten,120),email,await hashPassword(String(body.password)),body.vai_tro,nowISO()).run();
    await logAudit(env,me,'tạo tài khoản','user',id,body.vai_tro);
    return json({ db: await bootstrap(env,me) });
  }
  if((m=path.match(/^\/users\/(.+)$/)) && method==='PATCH'){
    if(!canNguoiDung(me)) return json({error:'Không có quyền'},403);
    const r=await env.DB.prepare(`SELECT * FROM users WHERE id=?`).bind(m[1]).first(); if(!r) return json({error:'Không tìm thấy'},404);
    if((r.vai_tro===ROLES.ADMIN||body.vai_tro===ROLES.ADMIN) && me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin sửa được Admin'},403);
    if(body.vai_tro!=null && !Object.values(ROLES).includes(body.vai_tro)) return json({error:'Vai trò không hợp lệ'},400);
    if(r.id===me.id && body.active===false) return json({error:'Không tự khoá chính mình'},400);
    await env.DB.prepare(`UPDATE users SET ho_ten=?, vai_tro=?, active=?, password=COALESCE(?,password), doi_mat_khau=CASE WHEN ? THEN 1 ELSE doi_mat_khau END WHERE id=?`)
      .bind(body.ho_ten!=null?chuoi(body.ho_ten,120):r.ho_ten, body.vai_tro||r.vai_tro, body.active!=null?bool(body.active):r.active, body.password?await hashPassword(String(body.password)):null, bool(!!body.password), r.id).run();
    await logAudit(env,me,'sửa tài khoản','user',r.id,(body.vai_tro||'')+(body.active===false?' khoá':'')+(body.password?' đặt lại mật khẩu':''));
    return json({ db: await bootstrap(env,me) });
  }
  // --- chiến lược (nội dung cơ bản; chốt phiên bản G1 ở ADR-002) ---
  if(path==='/chien-luoc' && method==='PUT'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`UPDATE chien_luoc SET dinh_vi=?, tong_giong=?, doi_tuong=?, updated_at=? WHERE id=1`).bind(chuoi(body.dinh_vi,3000),chuoi(body.tong_giong,2000),chuoi(body.doi_tuong,2000),nowISO()).run();
    await logAudit(env,me,'sửa chiến lược','chien_luoc',1,''); return json({ db: await bootstrap(env,me) });
  }
  // --- danh mục gốc ---
  if((m=path.match(/^\/danh-muc\/(\w+)(?:\/(.+))?$/)) && DANH_MUC[m[1]]){
    const bang=m[1], id=m[2];
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(method==='POST' && !id){
      const o=lamSachDanhMuc(bang, body); for(const k of DANH_MUC[bang].batBuoc) if(!o[k]) return json({error:'Thiếu '+k},400);
      if(o.active===undefined) o.active=1; const nid=uid(bang.slice(0,2)); const cols=['id',...Object.keys(o),'created_at'];
      await env.DB.prepare(`INSERT INTO ${bang} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).bind(nid,...Object.values(o),nowISO()).run();
      await logAudit(env,me,'thêm '+bang,bang,nid,o.ten||o.cum_tu||''); return json({ db: await bootstrap(env,me), id:nid });
    }
    if(method==='PATCH' && id){
      const r=await env.DB.prepare(`SELECT id FROM ${bang} WHERE id=?`).bind(id).first(); if(!r) return json({error:'Không tìm thấy'},404);
      const o=lamSachDanhMuc(bang, body); if(!Object.keys(o).length) return json({error:'Không có gì để sửa'},400);
      await env.DB.prepare(`UPDATE ${bang} SET ${Object.keys(o).map(k=>k+'=?').join(', ')} WHERE id=?`).bind(...Object.values(o), id).run();
      await logAudit(env,me,'sửa '+bang,bang,id,Object.keys(o).join(',')); return json({ db: await bootstrap(env,me) });
    }
    if(method==='DELETE' && id){
      // claim cấm xoá thật; danh mục khác chỉ tắt (nội dung cũ còn trỏ tới)
      if(bang==='claim_cam') await env.DB.prepare(`DELETE FROM claim_cam WHERE id=?`).bind(id).run();
      else await env.DB.prepare(`UPDATE ${bang} SET active=0 WHERE id=?`).bind(id).run();
      await logAudit(env,me,'xoá/tắt '+bang,bang,id,''); return json({ db: await bootstrap(env,me) });
    }
  }
  // Nhập danh mục gốc một lần (từ app cũ, file JSON) — upsert theo mã/tên, không đụng dữ liệu khác
  if(path==='/nhap/danh-muc' && method==='POST'){
    if(me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin'},403);
    const dem={};
    for(const bang of Object.keys(DANH_MUC)){
      const ds=Array.isArray(body[bang])?body[bang].slice(0,500):[]; dem[bang]={them:0, sua:0};
      for(const raw of ds){ const o=lamSachDanhMuc(bang, raw); if(!DANH_MUC[bang].batBuoc.every(k=>o[k])) continue;
        const khoa=bang==='san_pham'&&o.ma?['ma',o.ma]:bang==='claim_cam'?['cum_tu',o.cum_tu]:['ten',o.ten];
        const cu=await env.DB.prepare(`SELECT id FROM ${bang} WHERE ${khoa[0]}=?`).bind(khoa[1]).first();
        if(cu){ await env.DB.prepare(`UPDATE ${bang} SET ${Object.keys(o).map(k=>k+'=?').join(', ')} WHERE id=?`).bind(...Object.values(o), cu.id).run(); dem[bang].sua++; }
        else { if(o.active===undefined) o.active=1; const cols=['id',...Object.keys(o),'created_at']; await env.DB.prepare(`INSERT INTO ${bang} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).bind(uid(bang.slice(0,2)),...Object.values(o),nowISO()).run(); dem[bang].them++; } }
    }
    await logAudit(env,me,'nhập danh mục gốc','danh_muc','',JSON.stringify(dem));
    return json({ ok:true, dem, db: await bootstrap(env,me) });
  }
  // --- bộ quyền thực hiện ---
  if((m=path.match(/^\/buoc\/(B\d+)$/)) && method==='PATCH'){
    if(!canGat(me)) return json({error:'Chỉ Admin hoặc Trưởng MKT được gạt mức người/AI'},403);
    const ma=m[1]; const meta=BUOC_MAP[ma]; if(!meta) return json({error:'Không có bước'},404);
    const cu=await mucBuoc(env, ma); const cfg=(await docCauHinh(env)).may||{};
    const muc=body.nguoi_thuc_hien!=null?String(body.nguoi_thuc_hien):cu.nguoi_thuc_hien;
    if(body.nguoi_thuc_hien!=null){ const k=await kiemGat(env, ma, muc, cfg); if(!k.ok) return json({error:k.loi},422); }
    const vt=body.vai_tro_nguoi!=null?String(body.vai_tro_nguoi):cu.vai_tro_nguoi; if(!Object.values(ROLES).includes(vt)) return json({error:'Vai trò không hợp lệ'},400);
    const hoc=body.hoc!=null?bool(body.hoc):cu.hoc;
    await env.DB.prepare(`UPDATE buoc_thuc_hien SET nguoi_thuc_hien=?, vai_tro_nguoi=?, hoc=?, doi_boi=?, doi_at=? WHERE buoc=?`).bind(muc, vt, hoc, me.ho_ten, nowISO(), ma).run();
    // ADR-006: gạt xong thì đóng việc đề nghị & tính lại đề nghị (mức mới có thể lại đủ/không đủ)
    if(muc!==cu.nguoi_thuc_hien){ await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='GAT_BUOC' AND doi_tuong_id LIKE ? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, 'buoc:'+ma+':%').run(); await deNghiGat(env); }
    await logAudit(env,me,'gạt bước','buoc_thuc_hien',ma, meta.ten+': '+cu.nguoi_thuc_hien+' → '+muc+' · vai trò '+vt+' · học '+(hoc?'BẬT':'TẮT'));
    return json({ db: await bootstrap(env,me) });
  }
  // ADR-006: mẫu học & lịch sử gạt của một bước — để người nhìn thấy máy "học" gì trước khi gạt
  if((m=path.match(/^\/buoc\/(B\d+)\/mau$/)) && method==='GET'){ if(!canXemMkt(me)) return json({error:'Không có quyền'},403);
    const mau=(await env.DB.prepare(`SELECT id,ngay,doi_tuong_id,dau_ra_nguoi,dau_ra_may,giong,ghi_chu,created_at FROM mau_hoc WHERE buoc=? ORDER BY created_at DESC LIMIT 20`).bind(m[1]).all()).results.map(x=>({...x, dau_ra_nguoi:docJSON(x.dau_ra_nguoi,{}), dau_ra_may:docJSON(x.dau_ra_may,{})}));
    const lich=(await env.DB.prepare(`SELECT at,by_name,detail FROM audit WHERE entity='buoc_thuc_hien' AND entity_id=? ORDER BY at DESC LIMIT 20`).bind(m[1]).all()).results;
    return json({ mau, lich_su:lich }); }
  // --- máy: chạy thử, cấu hình ---
  if(path==='/may/chay-thu' && method==='POST'){
    if(!canGat(me)) return json({error:'Chỉ Admin hoặc Trưởng MKT'},403);
    const kq=await dieuPhoi(env,{thu:true, chi:body.agent||null});
    await logAudit(env,me,'chạy thử agent','agent_run',body.agent||'tất cả', kq.map(k=>k.agent+': '+(k.tom_tat||k.bo_qua||'')).join(' | '));
    return json({ ok:true, kq, db: await bootstrap(env,me) });
  }
  if((m=path.match(/^\/cau-hinh\/(\w+)$/)) && method==='PUT'){
    if(!canGat(me)) return json({error:'Chỉ Admin hoặc Trưởng MKT'},403);
    const loi=kiemConfig(m[1], body.cau_hinh); if(loi) return json({error:loi},422);
    const cu=await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id=?`).bind(m[1]).first();
    const moi={...docJSON(cu&&cu.cau_hinh,{}), ...body.cau_hinh};
    if(cu) await env.DB.prepare(`UPDATE module_config SET cau_hinh=?, updated_at=?, updated_by_name=? WHERE id=?`).bind(JSON.stringify(moi),nowISO(),me.ho_ten,m[1]).run();
    else await env.DB.prepare(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES (?,?,?,?)`).bind(m[1],JSON.stringify(moi),nowISO(),me.ho_ten).run();
    await logAudit(env,me,'sửa cấu hình','module_config',m[1],JSON.stringify(body.cau_hinh).slice(0,300));
    return json({ db: await bootstrap(env,me) });
  }
  // --- việc giao người ---
  if(path==='/cong-viec' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!chuoi(body.tieu_de)) return json({error:'Thiếu tiêu đề'},400);
    const id=uid('cv');
    await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,giao_cho_id,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,?,'MO',?,?,?)`)
      .bind(id, chuoi(body.loai||'KHAC',30), chuoi(body.tieu_de,200), chuoi(body.doi_tuong,30)||null, chuoi(body.doi_tuong_id,60)||null, body.giao_cho_vai_tro||null, body.giao_cho_id||null, /^\d{4}-\d{2}-\d{2}$/.test(body.han||'')?body.han:null, me.ho_ten, chuoi(body.ly_do,500), nowISO()).run();
    await logAudit(env,me,'giao việc','cong_viec',id,chuoi(body.tieu_de,200)); return json({ db: await bootstrap(env,me), id });
  }
  if((m=path.match(/^\/cong-viec\/(.+)\/(xong|bo)$/)) && method==='POST'){
    const r=await env.DB.prepare(`SELECT * FROM cong_viec WHERE id=?`).bind(m[1]).first(); if(!r) return json({error:'Không tìm thấy'},404);
    if(!(isStaff(me) || r.giao_cho_id===me.id || r.giao_cho_vai_tro===me.vai_tro)) return json({error:'Việc này không giao cho bạn'},403);
    await env.DB.prepare(`UPDATE cong_viec SET trang_thai=?, xong_at=?, xong_boi=? WHERE id=?`).bind(m[2]==='xong'?'XONG':'BO', nowISO(), me.ho_ten, r.id).run();
    await logAudit(env,me,m[2]==='xong'?'xong việc':'bỏ việc','cong_viec',r.id,r.tieu_de); return json({ db: await bootstrap(env,me) });
  }
  // ===== ADR-002 =====
  // G1: chốt chiến lược = snapshot phiên bản (Giám đốc, Trưởng MKT, Admin)
  if(path==='/chien-luoc/chot' && method==='POST'){
    if(!(canGat(me)||me.vai_tro===ROLES.GIAM_DOC)) return json({error:'Chỉ Giám đốc, Trưởng MKT hoặc Admin chốt chiến lược (G1)'},403);
    const cl=await env.DB.prepare(`SELECT * FROM chien_luoc WHERE id=1`).first(); if(!chuoi(cl.dinh_vi)) return json({error:'Chưa có định vị để chốt'},400);
    const pillars=(await env.DB.prepare(`SELECT id,ten,ty_trong,muc_tieu FROM pillars WHERE active=1 ORDER BY thu_tu`).all()).results;
    const pb=so(cl.phien_ban)+1;
    await env.DB.prepare(`INSERT INTO chien_luoc_phien_ban (id,phien_ban,dinh_vi,tong_giong,doi_tuong,pillars,ghi_chu,chot_boi,chot_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(uid('clv'),pb,cl.dinh_vi,cl.tong_giong,cl.doi_tuong,JSON.stringify(pillars),chuoi(body.ghi_chu,500),me.ho_ten,nowISO()).run();
    await env.DB.prepare(`UPDATE chien_luoc SET phien_ban=?, chot_boi=?, chot_at=? WHERE id=1`).bind(pb, me.ho_ten, nowISO()).run();
    await logAudit(env,me,'chốt chiến lược (G1)','chien_luoc',pb,chuoi(body.ghi_chu,200)); return json({ db: await bootstrap(env,me) });
  }
  // Kế hoạch tháng
  if((m=path.match(/^\/ke-hoach\/(\d{4}-\d{2})(?:\/(de-xuat|chot|tao-muc))?$/))){
    const thang=m[1], hd=m[2]; if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const cu=docKeHoach(await env.DB.prepare(`SELECT * FROM ke_hoach_thang WHERE thang=?`).bind(thang).first());
    if(hd==='de-xuat' && method==='POST'){
      if(cu&&cu.trang_thai==='CHOT'&&!canGat(me)) return json({error:'Tháng đã chốt — Trưởng MKT/Admin mới đề xuất lại'},403);
      const dx=await deXuatKeHoach(env, thang, body.tong_bai);
      if(cu) await env.DB.prepare(`UPDATE ke_hoach_thang SET chi_tieu=?, nguon='DE_XUAT', ly_do=?, de_xuat=?, de_xuat_at=?, updated_at=?, updated_by_name=? WHERE thang=?`).bind(JSON.stringify(dx.chi_tieu),JSON.stringify(dx.ly_do),JSON.stringify(dx.chi_tieu),nowISO(),nowISO(),me.ho_ten,thang).run();
      else await env.DB.prepare(`INSERT INTO ke_hoach_thang (thang,trang_thai,chi_tieu,dinh_huong,nguon,ly_do,de_xuat,de_xuat_at,updated_at,updated_by_name) VALUES (?,'DE_XUAT',?,'','DE_XUAT',?,?,?,?,?)`).bind(thang,JSON.stringify(dx.chi_tieu),JSON.stringify(dx.ly_do),JSON.stringify(dx.chi_tieu),nowISO(),nowISO(),me.ho_ten).run();
      await logAudit(env,me,'máy đề xuất kế hoạch','ke_hoach_thang',thang,dx.chi_tieu.tong_bai+' bài'); return json({ db: await bootstrap(env,me), de_xuat:dx });
    }
    if(!hd && method==='PUT'){
      if(cu&&cu.trang_thai==='CHOT'&&!canGat(me)) return json({error:'Tháng đã chốt — Trưởng MKT/Admin mới sửa được'},403);
      const ct=lamSachChiTieu(body.chi_tieu||(cu&&cu.chi_tieu)); const dh=body.dinh_huong!=null?chuoi(body.dinh_huong,2000):((cu&&cu.dinh_huong)||'');
      if(cu) await env.DB.prepare(`UPDATE ke_hoach_thang SET chi_tieu=?, dinh_huong=?, nguon='NGUOI', updated_at=?, updated_by_name=? WHERE thang=?`).bind(JSON.stringify(ct),dh,nowISO(),me.ho_ten,thang).run();
      else await env.DB.prepare(`INSERT INTO ke_hoach_thang (thang,trang_thai,chi_tieu,dinh_huong,nguon,ly_do,updated_at,updated_by_name) VALUES (?,'DE_XUAT',?,?,'NGUOI','{}',?,?)`).bind(thang,JSON.stringify(ct),dh,nowISO(),me.ho_ten).run();
      await logAudit(env,me,'sửa kế hoạch tháng','ke_hoach_thang',thang,ct.tong_bai+' bài'); return json({ db: await bootstrap(env,me) });
    }
    if(hd==='chot' && method==='POST'){
      if(!canGat(me)) return json({error:'Chỉ Trưởng MKT hoặc Admin chốt kế hoạch tháng (G2)'},403);
      if(!cu) return json({error:'Chưa có bản kế hoạch để chốt'},400); if(cu.trang_thai==='CHOT') return json({error:'Đã chốt rồi'},409);
      await env.DB.prepare(`UPDATE ke_hoach_thang SET trang_thai='CHOT', chot_boi=?, chot_at=?, updated_at=? WHERE thang=?`).bind(me.ho_ten,nowISO(),nowISO(),thang).run();
      // mẫu học B2: bản chốt giống bản máy đề xuất bao nhiêu
      if(cu.de_xuat){ const g=giongChiTieu(cu.de_xuat, cu.chi_tieu); await ghiMauHoc(env,'B2',{doi_tuong_id:thang, dau_vao:{thang}, dau_ra_nguoi:cu.chi_tieu, dau_ra_may:cu.de_xuat, giong:g, ghi_chu:'chốt kế hoạch tháng'}); }
      await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='CHOT_KE_HOACH' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(),me.ho_ten,thang).run();
      // B3 ở mức AI → máy chia tuần & tạo mục ngay; ở mức NGƯỜI → giao việc
      const b3=await mucBuoc(env,'B3'); let tao=null;
      if(b3.nguoi_thuc_hien!=='NGUOI'){ const r=await taoMucConThieu(env, thang, 'Máy (B3)'); tao=r.tao; }
      else await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,doi_tuong,doi_tuong_id,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,?,?,'MO',?,?,?)`).bind(uid('cv'),'CHIA_TUAN','Chia tuần & tạo mục nội dung tháng '+thang,'ke_hoach_thang',thang,b3.vai_tro_nguoi||'MARKETING',null,me.ho_ten,'Kế hoạch tháng đã chốt (G2). Bước B3 đang do người làm — dùng nút "Máy tạo mục còn thiếu" nếu muốn máy gợi ý',nowISO()).run();
      await logAudit(env,me,'chốt kế hoạch tháng (G2)','ke_hoach_thang',thang,tao!=null?('máy tạo '+tao+' mục'):'giao việc chia tuần'); return json({ db: await bootstrap(env,me), tao });
    }
    if(hd==='tao-muc' && method==='POST'){
      const r=await taoMucConThieu(env, thang, me.ho_ten+' (máy gợi ý)'); if(!r.ok) return json({error:r.loi},400);
      await logAudit(env,me,'máy tạo mục còn thiếu','muc_noi_dung',thang,r.tao+' mục'); return json({ db: await bootstrap(env,me), tao:r.tao });
    }
    if(!hd && method==='GET'){ return json({ thieu: await thieuTheoTuan(env, thang) }); }
  }
  // Mục nội dung
  const lamSachMuc=(b, cu)=>({ thang: laThang(b.thang)?b.thang:(cu?cu.thang:thangHienTai()), tuan: b.tuan==null||b.tuan===''?(b.tuan===''?null:(cu?cu.tuan:null)):Math.max(1,Math.min(6,Math.round(so(b.tuan)))), ngay_dang: b.ngay_dang!=null?(laNgay(b.ngay_dang)?b.ngay_dang:null):(cu?cu.ngay_dang:null),
    tieu_de: b.tieu_de!=null?chuoi(b.tieu_de,200):(cu?cu.tieu_de:''), muc_tieu: b.muc_tieu!=null?mucTieu(b.muc_tieu):(cu?cu.muc_tieu:'BRAND'), pillar_id: b.pillar_id!==undefined?(b.pillar_id||null):(cu?cu.pillar_id:null), framework_id: b.framework_id!==undefined?(b.framework_id||null):(cu?cu.framework_id:null),
    san_pham_id: b.san_pham_id!==undefined?(b.san_pham_id||null):(cu?cu.san_pham_id:null), kenh_id: b.kenh_id!==undefined?(b.kenh_id||null):(cu?cu.kenh_id:null), dinh_dang: b.dinh_dang!==undefined?dinhDang(b.dinh_dang):(cu?cu.dinh_dang:null), ghi_chu: b.ghi_chu!=null?chuoi(b.ghi_chu,1000):(cu?cu.ghi_chu:'') });
  if(path==='/muc' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403); const o=lamSachMuc(body,null); if(!o.tieu_de) return json({error:'Thiếu tiêu đề'},400);
    const id=uid('muc'); await env.DB.prepare(`INSERT INTO muc_noi_dung (id,thang,tuan,ngay_dang,tieu_de,muc_tieu,pillar_id,framework_id,san_pham_id,kenh_id,dinh_dang,giai_doan,tao_boi,ghi_chu,created_at,created_by_name,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'Y_TUONG','NGUOI',?,?,?,?)`)
      .bind(id,o.thang,o.tuan,o.ngay_dang,o.tieu_de,o.muc_tieu,o.pillar_id,o.framework_id,o.san_pham_id,o.kenh_id,o.dinh_dang,o.ghi_chu,nowISO(),me.ho_ten,nowISO()).run();
    await logAudit(env,me,'thêm mục nội dung','muc_noi_dung',id,o.tieu_de); return json({ db: await bootstrap(env,me), id });
  }
  if((m=path.match(/^\/muc\/(.+)$/)) && (method==='PATCH'||method==='DELETE')){
    if(!isStaff(me)) return json({error:'Không có quyền'},403); const cu=await env.DB.prepare(`SELECT * FROM muc_noi_dung WHERE id=?`).bind(m[1]).first(); if(!cu) return json({error:'Không tìm thấy'},404);
    if(method==='DELETE'){ if(cu.giai_doan!=='Y_TUONG') return json({error:'Chỉ xoá được mục còn ở Ý tưởng'},409); await env.DB.prepare(`DELETE FROM muc_noi_dung WHERE id=?`).bind(cu.id).run(); await logAudit(env,me,'xoá mục','muc_noi_dung',cu.id,cu.tieu_de); return json({ db: await bootstrap(env,me) }); }
    const o=lamSachMuc(body,cu); if(!o.tieu_de) return json({error:'Thiếu tiêu đề'},400);
    await env.DB.prepare(`UPDATE muc_noi_dung SET thang=?, tuan=?, ngay_dang=?, tieu_de=?, muc_tieu=?, pillar_id=?, framework_id=?, san_pham_id=?, kenh_id=?, dinh_dang=?, ghi_chu=?, updated_at=? WHERE id=?`).bind(o.thang,o.tuan,o.ngay_dang,o.tieu_de,o.muc_tieu,o.pillar_id,o.framework_id,o.san_pham_id,o.kenh_id,o.dinh_dang,o.ghi_chu,nowISO(),cu.id).run();
    // mẫu học B3: người sửa mục máy tạo → máy xếp đúng bao nhiêu phần (tuần, kênh, định dạng, pillar)
    if(cu.tao_boi==='AGENT'){ const cap=[['tuan',tuanCuaMuc(cu),tuanCuaMuc(o)],['kenh_id',cu.kenh_id,o.kenh_id],['dinh_dang',cu.dinh_dang,o.dinh_dang],['pillar_id',cu.pillar_id,o.pillar_id]]; const g=cap.filter(([,a,b])=>a===b).length/cap.length;
      await ghiMauHoc(env,'B3',{doi_tuong_id:cu.id, dau_vao:{thang:cu.thang}, dau_ra_may:{tuan:cu.tuan,kenh_id:cu.kenh_id,dinh_dang:cu.dinh_dang,pillar_id:cu.pillar_id}, dau_ra_nguoi:{tuan:o.tuan,kenh_id:o.kenh_id,dinh_dang:o.dinh_dang,pillar_id:o.pillar_id}, giong:g, ghi_chu:'người sửa mục máy tạo'}); }
    await logAudit(env,me,'sửa mục nội dung','muc_noi_dung',cu.id,o.tieu_de); return json({ db: await bootstrap(env,me) });
  }
  // Ý tưởng: người thêm tay · người quyết (B1 học) · máy gom thử
  if(path==='/y-tuong' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403); if(!chuoi(body.ten)) return json({error:'Thiếu tên ý tưởng'},400);
    const id=uid('yt'); const ch=body.cham_ai===false?null:await chamYTuongAI(env,{ten:chuoi(body.ten,200),mo_ta:chuoi(body.mo_ta,500),nguon:'NGUOI'}, id);
    await env.DB.prepare(`INSERT INTO y_tuong (id,nguon,ten,mo_ta,link,pillar_id,dinh_dang,muc_tieu,diem_may,ly_do_may,rui_ro,trang_thai,ngay,created_at) VALUES (?,'NGUOI',?,?,?,?,?,?,?,?,?,'MOI',?,?)`)
      .bind(id, chuoi(body.ten,200), chuoi(body.mo_ta,500), chuoi(body.link,500), body.pillar_id||(ch&&ch.pillar_id)||null, dinhDang(body.dinh_dang)||(ch&&ch.dinh_dang)||null, body.muc_tieu?mucTieu(body.muc_tieu):(ch?ch.muc_tieu:'BRAND'), ch?ch.diem:null, ch?ch.ly_do:null, ch?ch.rui_ro:'', ngayVN(), nowISO()).run();
    await logAudit(env,me,'thêm ý tưởng','y_tuong',id,chuoi(body.ten,100)); return json({ db: await bootstrap(env,me), id });
  }
  if((m=path.match(/^\/y-tuong\/(.+)\/quyet$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403); const y=await env.DB.prepare(`SELECT * FROM y_tuong WHERE id=?`).bind(m[1]).first(); if(!y) return json({error:'Không tìm thấy'},404);
    const q=body.quyet==='DUYET'?'DUYET':body.quyet==='BO'?'BO':null; if(!q) return json({error:'quyet phải là DUYET hoặc BO'},400);
    if(body.pillar_id!==undefined||body.dinh_dang!==undefined||body.muc_tieu!==undefined) await env.DB.prepare(`UPDATE y_tuong SET pillar_id=?, dinh_dang=?, muc_tieu=? WHERE id=?`).bind(body.pillar_id!==undefined?(body.pillar_id||null):y.pillar_id, body.dinh_dang!==undefined?dinhDang(body.dinh_dang):y.dinh_dang, body.muc_tieu!==undefined?mucTieu(body.muc_tieu):y.muc_tieu, y.id).run();
    await env.DB.prepare(`UPDATE y_tuong SET trang_thai=?, quyet_boi=?, quyet_at=?, ly_do_nguoi=? WHERE id=?`).bind(q, me.ho_ten, nowISO(), chuoi(body.ly_do,300), y.id).run();
    // mẫu học B1: máy có chấm thì so quyết định máy (điểm ≥ ngưỡng & không rủi ro → DUYET) với người
    if(y.diem_may!=null){ const nguong=so(((await docCauHinh(env)).trend||{}).nguong_tu_duyet,70); const may=(y.diem_may>=nguong&&!y.rui_ro)?'DUYET':'BO';
      await ghiMauHoc(env,'B1',{doi_tuong_id:y.id, dau_vao:{ten:y.ten,nguon:y.nguon}, dau_ra_may:{quyet:may,diem:y.diem_may}, dau_ra_nguoi:{quyet:q,ly_do:chuoi(body.ly_do,200)}, giong:may===q?1:0}); }
    let mucId=null; if(q==='DUYET' && body.tao_muc!==false) mucId=await taoMucTuYTuong(env, y.id, me.ho_ten);
    await logAudit(env,me,q==='DUYET'?'duyệt ý tưởng':'bỏ ý tưởng','y_tuong',y.id,y.ten); return json({ db: await bootstrap(env,me), muc_id:mucId });
  }
  // ===== ADR-003 =====
  if((path==='/noi-dung/ngu-canh'||path==='/scripts/ngu-canh') && method==='GET'){ if(!isStaff(me)) return json({error:'Không có quyền'},403);
    return json({ frameworks:(await env.DB.prepare(`SELECT id,ten,mo_ta FROM frameworks WHERE active=1 ORDER BY ten`).all()).results, san_pham:(await env.DB.prepare(`SELECT id,ten FROM san_pham WHERE active=1 ORDER BY ten`).all()).results, kenh:(await env.DB.prepare(`SELECT id,ten,loai FROM kenh WHERE active=1 ORDER BY ten`).all()).results }); }
  if((path==='/noi-dung/ai-viet'||path==='/scripts/ai-sinh') && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const muc=body.muc_id?await env.DB.prepare(`SELECT * FROM muc_noi_dung WHERE id=?`).bind(body.muc_id).first():null;
    const r=await aiVietNoiDung(env,{ ...body, angle: muc?await angleFootage(env, muc.id, body.dinh_dang||muc.dinh_dang, body.angle||muc.ghi_chu):body.angle, dinh_dang:body.dinh_dang||(muc&&muc.dinh_dang), tieu_de:body.tieu_de||(muc&&muc.tieu_de), pillar_id:body.pillar_id||(muc&&muc.pillar_id), muc_tieu:body.muc_tieu||(muc&&muc.muc_tieu), framework_id:body.framework_id||(muc&&muc.framework_id), san_pham_id:body.san_pham_id||(muc&&muc.san_pham_id), kenh_id:body.kenh_id||(muc&&muc.kenh_id) }, me);
    if(!r.ok) return json({ok:false, cho_may:!!r.cho_may, viec_id:r.viec_id||null, thieu_key:!!r.thieu_key, vuot_ngan_sach:!!r.vuot_ngan_sach, loi:r.loi, blocked:r.blocked||[]},200);
    return json({ ok:true, kich_ban:r.noi_dung, noi_dung:r.noi_dung, canh_bao:r.canh_bao, so_vi_du:r.so_vi_du, mo_hinh_id:r.mo_hinh_id }); }
  // ADR-009c: người bấm ✨ ở mức MỞ → màn hỏi lại việc tới khi máy ghép trả
  if((m=path.match(/^\/ai\/viec\/([^/]+)$/)) && method==='GET'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const v=await env.DB.prepare(`SELECT * FROM ai_viec WHERE id=?`).bind(m[1]).first(); if(!v) return json({error:'Không có việc'},404); const kq=docJSON(v.ket_qua,null); return json({ id:v.id, trang_thai:v.trang_thai, tinh_nang:v.tinh_nang, may_id:v.may_id, loi:v.loi, ket_qua:kq, noi_dung:kq&&kq.noi_dung||null, created_at:v.created_at, xong_at:v.xong_at }); }
  if((path==='/noi-dung/kho'||path==='/scripts/kho') && method==='GET'){ if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const rows=(await env.DB.prepare(`SELECT n.id,n.tieu_de,n.hook,n.sections,n.cta,n.chi_tiet,n.san_pham_id,n.kenh_id,n.muc_id content_item_id,n.updated_at,n.created_by_name, m.tieu_de ke_hoach, m.thang, k.ten kenh_ten FROM noi_dung n LEFT JOIN muc_noi_dung m ON m.id=n.muc_id LEFT JOIN kenh k ON k.id=n.kenh_id WHERE n.trang_thai='DUYET' AND n.dinh_dang='VIDEO' ORDER BY n.updated_at DESC LIMIT 100`).all()).results;
    return json({ kich_ban: rows.map(r=>({...r, sections:docSections(r.sections), chi_tiet:docJSON(r.chi_tiet,{})})) }); }
  if(path==='/noi-dung' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const r=await taoNoiDung(env, body, me); if(!r.ok) return json({error:r.loi, blocked:r.blocked},422); return json({ db: await bootstrap(env,me), id:r.id }); }
  if((m=path.match(/^\/noi-dung\/([^/]+)$/)) && method==='PATCH'){ if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(m[1]).first(); if(!nd) return json({error:'Không tìm thấy'},404);
    if(nd.trang_thai==='CHO_DUYET') return json({error:'Bài đang chờ duyệt — rút về (trả lại) rồi mới sửa'},409);
    const moi={ tieu_de:body.tieu_de!=null?chuoi(body.tieu_de,200):nd.tieu_de, hook:body.hook!=null?chuoi(body.hook,1000):nd.hook, sections:body.sections!=null?docSections(body.sections):docSections(nd.sections), cta:body.cta!=null?chuoi(body.cta,500):nd.cta, chi_tiet:body.chi_tiet!=null?lamSachChiTiet(body.chi_tiet):docJSON(nd.chi_tiet,{}), dinh_dang:nd.dinh_dang };
    const chan=quetClaim(vanBan(moi), await docClaims(env)).filter(c=>c.muc_do==='CHAN'); if(chan.length) return json({error:'Có cụm bị CHẶN: '+chan.map(c=>c.cum_tu).join(', '), blocked:chan.map(c=>c.cum_tu)},422);
    const pb=so(nd.phien_ban)+1; // sửa bài đã duyệt → về NHÁP, phải duyệt lại
    await env.DB.prepare(`UPDATE noi_dung SET tieu_de=?, hook=?, sections=?, cta=?, chi_tiet=?, framework_id=?, san_pham_id=?, kenh_id=?, phien_ban=?, trang_thai='NHAP', updated_at=? WHERE id=?`).bind(moi.tieu_de, moi.hook, JSON.stringify(moi.sections), moi.cta, JSON.stringify(moi.chi_tiet), body.framework_id!==undefined?(body.framework_id||null):nd.framework_id, body.san_pham_id!==undefined?(body.san_pham_id||null):nd.san_pham_id, body.kenh_id!==undefined?(body.kenh_id||null):nd.kenh_id, pb, nowISO(), nd.id).run();
    await luuPhienBan(env, {...moi, id:nd.id, phien_ban:pb, trang_thai:'NHAP'}, me.ho_ten); if(nd.trang_thai==='DUYET') await datGiaiDoan(env, nd.muc_id, 'SOAN', 'sửa bài đã duyệt', me);
    await logAudit(env,me,'sửa nội dung','noi_dung',nd.id,'v'+pb); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/noi-dung\/([^/]+)\/gui-duyet$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(m[1]).first(); if(!nd) return json({error:'Không tìm thấy'},404); if(nd.trang_thai==='DUYET') return json({error:'Bài đã duyệt rồi'},409);
    const r=await guiDuyet(env, nd, me); if(!r.ok) return json({error:r.loi},409); return json({ db: await bootstrap(env,me), cham:r.cham, tu_tra_lai:r.tu_tra_lai }); }
  if((m=path.match(/^\/(?:noi-dung|scripts)\/([^/]+)\/video$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(m[1]).first(); if(!nd) return json({error:'Không tìm thấy nội dung'},404); if(nd.dinh_dang!=='VIDEO') return json({error:'Chỉ gắn video cho nội dung định dạng Video'},400);
    const media_url=chuoi(body.media_url,500); if(!media_url) return json({error:'Thiếu media_url'},400);
    const tsId=uid('ts'); await env.DB.prepare(`INSERT INTO tai_san (id,loai,ten,mo_ta,media_url,media_type,muc_id,noi_dung_id,nguon,created_at,created_by_name) VALUES (?,'VIDEO_XUAT',?,?,?,'VIDEO',?,?,'DUNG_VIDEO',?,?)`).bind(tsId, 'Video dựng: '+(nd.tieu_de||nd.hook).slice(0,80), chuoi(body.mo_ta,500), media_url, nd.muc_id, nd.id, nowISO(), me.ho_ten).run();
    const ct={...docJSON(nd.chi_tiet,{}), video_url:media_url, video_tai_san_id:tsId, video_luc:nowISO()}; await env.DB.prepare(`UPDATE noi_dung SET chi_tiet=?, updated_at=? WHERE id=?`).bind(JSON.stringify(lamSachChiTiet(ct)), nowISO(), nd.id).run();
    await logAudit(env,me,'gắn video đã dựng','noi_dung',nd.id,media_url); return json({ db: await bootstrap(env,me), tai_san_id:tsId }); }
  // Duyệt G3 — Trưởng MKT/Admin; người gửi không tự duyệt (duyet.chan_tu_duyet); máy không bao giờ duyệt
  if((m=path.match(/^\/duyet\/([^/]+)\/quyet$/)) && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT hoặc Admin duyệt nội dung (G3)'},403);
    const d=await env.DB.prepare(`SELECT * FROM duyet WHERE id=?`).bind(m[1]).first(); if(!d) return json({error:'Không tìm thấy'},404); if(d.trang_thai!=='CHO') return json({error:'Đã quyết rồi'},409);
    const cfgD=(await docCauHinh(env)).duyet||{}; if(cfgD.chan_tu_duyet!==false && d.nguoi_gui_id===me.id) return json({error:'Người gửi không tự duyệt bài mình (luật L5)'},403);
    const q=body.quyet==='DUYET'?'DUYET':body.quyet==='TRA_LAI'?'TRA_LAI':null; if(!q) return json({error:'quyet phải là DUYET hoặc TRA_LAI'},400); if(q==='TRA_LAI'&&!chuoi(body.ly_do)) return json({error:'Trả lại phải ghi lý do (máy học từ đây)'},400);
    const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(d.doi_tuong_id).first();
    await env.DB.prepare(`UPDATE duyet SET trang_thai=?, quyet_boi=?, quyet_at=?, ly_do_nguoi=? WHERE id=?`).bind(q, me.ho_ten, nowISO(), chuoi(body.ly_do,500), d.id).run();
    if(nd){ await env.DB.prepare(`UPDATE noi_dung SET trang_thai=?, updated_at=? WHERE id=?`).bind(q, nowISO(), nd.id).run(); await datGiaiDoan(env, nd.muc_id, q==='DUYET'?'SAN_XUAT':'SOAN', q==='DUYET'?'duyệt G3':'trả lại: '+chuoi(body.ly_do,100), me);
      // mẫu học B5: máy "nghĩ" nên duyệt hay không (điểm ≥ ngưỡng & không lỗi cứng) so với người
      const cham=docJSON(d.cham_may,{}); const nguong=so(((await docCauHinh(env)).noi_dung||{}).diem_tham_dinh,70); const may=(so(cham.diem)>=nguong&&!(cham.loi_cung||[]).length)?'DUYET':'TRA_LAI';
      await ghiMauHoc(env,'B5',{doi_tuong_id:nd.id, dau_vao:{dinh_dang:nd.dinh_dang}, dau_ra_may:{quyet:may, diem:cham.diem, ly_do:cham.ly_do}, dau_ra_nguoi:{quyet:q, ly_do:chuoi(body.ly_do,200)}, giong:may===q?1:0}); }
    await logAudit(env,me,q==='DUYET'?'duyệt nội dung (G3)':'trả lại nội dung','noi_dung',d.doi_tuong_id,chuoi(body.ly_do,200)); return json({ db: await bootstrap(env,me) }); }
  // Tài sản media
  if((path==='/tai-san'||path==='/footage') && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const media_url=chuoi(body.media_url,500); if(!media_url) return json({error:'Cần file hoặc link media'},400); if(/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(media_url)) return json({error:'Đây là link THƯ MỤC Drive, không phải một file — dùng nút 📥 Nạp từ Drive để máy tải các clip trong thư mục'},400);
    const mt=String(body.media_type||'').toUpperCase(); const loai=['FOOTAGE','ANH','VIDEO_XUAT','GOI_DUNG','NHAC','KHAC'].includes(String(body.loai||'').toUpperCase())?String(body.loai).toUpperCase():(mt==='IMAGE'?'ANH':mt==='AUDIO'?'NHAC':mt==='FILE'?'KHAC':'FOOTAGE'); const id=uid('ts');
    await env.DB.prepare(`INSERT INTO tai_san (id,loai,ten,mo_ta,media_url,media_type,muc_id,noi_dung_id,nguon,created_at,created_by_name) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, loai, chuoi(body.ten,200)||media_url.split('/').pop(), chuoi(body.mo_ta,500), media_url, String(body.media_type||(loai==='ANH'?'IMAGE':'VIDEO')).toUpperCase(), body.muc_id||null, body.noi_dung_id||null, chuoi(body.nguon,40)||'NGUOI', nowISO(), me.ho_ten).run();
    await logAudit(env,me,'thêm tài sản','tai_san',id,chuoi(body.ten,100)); return json({ db: await bootstrap(env,me), id }); }
  if((m=path.match(/^\/tai-san\/([^/]+)$/)) && method==='DELETE'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const t=await env.DB.prepare(`SELECT * FROM tai_san WHERE id=?`).bind(m[1]).first(); if(!t) return json({error:'Không tìm thấy'},404);
    await env.DB.prepare(`DELETE FROM tai_san WHERE id=?`).bind(t.id).run(); await MAU().xoaTheoDoiTuong(env, t.id); if(env.MEDIA&&t.media_url&&t.media_url.startsWith('/media/')) try{ await env.MEDIA.delete(t.media_url.slice(7)); }catch(e){} await logAudit(env,me,'xoá tài sản','tai_san',t.id,t.ten); return json({ db: await bootstrap(env,me) }); }
  if(path==='/ai/usage' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const provider=String(body.provider||'').toLowerCase(); if(!['gemini','ollama','local'].includes(provider)) return json({error:'provider không hợp lệ'},400);
    await ghiAIUsage(env,{provider, model:chuoi(body.model,80), tinh_nang:chuoi(body.tinh_nang||'cong_cu',40), me, tokens_vao:so(body.tokens_vao), tokens_ra:so(body.tokens_ra), ok:body.ok!==false, ms:so(body.ms), loi:chuoi(body.loi,300)}); return json({ok:true}); }
  // Bài đăng
  if(path==='/bai-dang' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(body.noi_dung_id||'').first(); if(!nd) return json({error:'Không tìm thấy nội dung'},404); if(nd.trang_thai!=='DUYET') return json({error:'Chỉ đưa vào đăng nội dung ĐÃ DUYỆT (G3)'},409);
    const kenh=body.kenh_id?await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(body.kenh_id).first():(nd.kenh_id?await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(nd.kenh_id).first():null); if(!kenh) return json({error:'Chọn kênh đăng'},400);
    const cach=['TAY','API','N8N','TRAM'].includes(String(body.cach||'').toUpperCase())?String(body.cach).toUpperCase():(kenh.cach_dang||'TAY'); const gio=body.gio_dang&&!isNaN(Date.parse(body.gio_dang))?new Date(body.gio_dang).toISOString():nowISO();
    const ct=docJSON(nd.chi_tiet,{}); const media=chuoi(body.media_url,500)||ct.video_url||ct.anh_url||''; const id=uid('bd');
    await env.DB.prepare(`INSERT INTO bai_dang (id,noi_dung_id,muc_id,kenh_id,gio_dang,cach,noi_dung_dang,media_url,link,trang_thai,created_at,created_by_name,updated_at) VALUES (?,?,?,?,?,?,?,?,'',?,?,?,?)`).bind(id, nd.id, nd.muc_id, kenh.id, gio, cach, body.noi_dung_dang!=null?chuoi(body.noi_dung_dang,8000):banDang(nd), media, body.len_lich===false?'CHUAN_BI':'DA_LEN_LICH', nowISO(), me.ho_ten, nowISO()).run();
    await logAudit(env,me,'đưa vào đăng','bai_dang',id,kenh.ten+' · '+cach+' · '+gio); return json({ db: await bootstrap(env,me), id }); }
  if((m=path.match(/^\/bai-dang\/([^/]+)$/)) && method==='PATCH'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(m[1]).first(); if(!bd) return json({error:'Không tìm thấy'},404);
    if(body.da_dang===true){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DA_DANG', link=?, posted_at=?, loi=NULL, updated_at=? WHERE id=?`).bind(chuoi(body.link,500)||bd.link||'', nowISO(), nowISO(), bd.id).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DANG', 'đăng tay', me);
      await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE doi_tuong='bai_dang' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, bd.id).run(); await logAudit(env,me,'đã đăng tay','bai_dang',bd.id,chuoi(body.link,200)); return json({ db: await bootstrap(env,me) }); }
    const gio=body.gio_dang&&!isNaN(Date.parse(body.gio_dang))?new Date(body.gio_dang).toISOString():bd.gio_dang; const cach=['TAY','API','N8N','TRAM'].includes(String(body.cach||'').toUpperCase())?String(body.cach).toUpperCase():bd.cach;
    // ADR-006: bài máy hoàn thiện (B6) mà người sửa bản đăng → mẫu học B6 (giống văn bản); lên lịch không sửa → 1
    if(bd.created_by_name==='Máy (B6)' && bd.trang_thai==='CHUAN_BI' && body.len_lich!==false){ const moi=body.noi_dung_dang!=null?chuoi(body.noi_dung_dang,8000):bd.noi_dung_dang; await ghiMauHoc(env,'B6',{doi_tuong_id:bd.id, dau_vao:{noi_dung_id:bd.noi_dung_id}, dau_ra_may:{ban_dang:bd.noi_dung_dang, gio:bd.gio_dang}, dau_ra_nguoi:{ban_dang:moi, gio}, giong:0.7*giongVanBan(bd.noi_dung_dang, moi)+0.3*(gio===bd.gio_dang?1:0), ghi_chu:'người lên lịch bài máy hoàn thiện'}); await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='LEN_LICH' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, bd.noi_dung_id).run(); }
    await env.DB.prepare(`UPDATE bai_dang SET gio_dang=?, cach=?, noi_dung_dang=?, media_url=?, link=?, trang_thai=?, loi=NULL, updated_at=? WHERE id=?`).bind(gio, cach, body.noi_dung_dang!=null?chuoi(body.noi_dung_dang,8000):bd.noi_dung_dang, body.media_url!=null?chuoi(body.media_url,500):bd.media_url, body.link!=null?chuoi(body.link,500):bd.link, bd.trang_thai==='DA_DANG'?'DA_DANG':(body.len_lich===false?'CHUAN_BI':'DA_LEN_LICH'), nowISO(), bd.id).run();
    await logAudit(env,me,'sửa bài đăng','bai_dang',bd.id,cach+' · '+gio); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/bai-dang\/([^/]+)\/dang-ngay$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(m[1]).first(); if(!bd) return json({error:'Không tìm thấy'},404); if(bd.trang_thai==='DA_DANG') return json({error:'Đã đăng rồi'},409);
    const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(bd.noi_dung_id).first(); const kenh=await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(bd.kenh_id).first(); if(!nd||!kenh) return json({error:'Thiếu nội dung/kênh'},400);
    const r= bd.cach==='N8N' ? await dangN8n(env,bd,nd,kenh) : bd.cach==='API' ? await dangFacebook(env,kenh,bd,nd) : {ok:false, loi:'Kênh đăng tay — đánh dấu "Đã đăng" kèm link'};
    if(!r.ok){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='LOI', loi=?, updated_at=? WHERE id=?`).bind(r.loi, nowISO(), bd.id).run(); return json({ ok:false, loi:r.loi, db: await bootstrap(env,me) }); }
    if(r.cho_callback){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DANG_GUI', updated_at=? WHERE id=?`).bind(nowISO(), bd.id).run(); return json({ ok:true, cho_callback:true, db: await bootstrap(env,me) }); }
    await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DA_DANG', link=?, posted_at=?, loi=NULL, updated_at=? WHERE id=?`).bind(r.link||'', nowISO(), nowISO(), bd.id).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DANG', 'đăng qua API', me); await logAudit(env,me,'đăng ngay qua API','bai_dang',bd.id,r.link||''); return json({ ok:true, link:r.link, db: await bootstrap(env,me) }); }
  // ===== ADR-005 =====
  // Nhập kết quả tay / đối soát sàn — luật: KHÔNG QUY ĐƠN không được mang doanh thu/đơn
  if(path==='/ket-qua' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(String(body.bai_dang_id||'')).first(); if(!bd) return json({error:'Chọn bài đăng'},400);
    const muc=String(body.muc_tin_cay||'').toUpperCase(); if(!MUC_TIN_CAY[muc]) return json({error:'Mức tin cậy không hợp lệ'},400); const nguon=NGUON_KQ.includes(String(body.nguon||'').toUpperCase())?String(body.nguon).toUpperCase():'NHAP_TAY';
    const dt=so(body.doanh_thu), sd=soAn(body.so_don); if(muc==='KHONG_QUY_DON'&&(dt>0||sd>0)) return json({error:'Mức "Không quy đơn" chỉ ghi chỉ số hiển thị/tương tác, không gắn doanh thu hay số đơn'},422); if(muc!=='KHONG_QUY_DON'&&nguon==='API_KENH') return json({error:'Số từ API kênh không quy đơn được'},422);
    const id=uid('kq'); await env.DB.prepare(`INSERT INTO ket_qua (id,bai_dang_id,muc_id,muc_tin_cay,nguon,ky,tiep_can,luot_xem,tuong_tac,chia_se,binh_luan,luu,click,so_don,doanh_thu,ma_theo_doi,ghi_chu,created_at,created_by_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, bd.id, bd.muc_id, muc, nguon, laNgay(body.ky)?body.ky:(chuoi(body.ky,20)||ngayVN()), soAn(body.tiep_can), soAn(body.luot_xem), soAn(body.tuong_tac), soAn(body.chia_se), soAn(body.binh_luan), soAn(body.luu), soAn(body.click), sd, dt, chuoi(body.ma_theo_doi,60)||bd.ma_theo_doi||'', JSON.stringify({ghi_chu:chuoi(body.ghi_chu,500)}), nowISO(), me.ho_ten).run();
    await datGiaiDoan(env, bd.muc_id, 'DA_DO', 'nhập kết quả', me); await logAudit(env,me,'nhập kết quả','ket_qua',id,MUC_TIN_CAY[muc]+' · '+nguon); return json({ db: await bootstrap(env,me), id }); }
  // Import đối soát sàn: dòng {ma_theo_doi|link, ky, doanh_thu, so_don, nguon} → khớp bài theo mã theo dõi hoặc link; không khớp trả về để người gán
  if(path==='/ket-qua/doi-soat' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const ds=Array.isArray(body.dong)?body.dong.slice(0,500):[]; if(!ds.length) return json({error:'Không có dòng nào'},400);
    const muc=String(body.muc_tin_cay||'TRUC_TIEP').toUpperCase()==='GIAN_TIEP'?'GIAN_TIEP':'TRUC_TIEP'; const nguon=String(body.nguon||'SAN').toUpperCase()==='NHAP_TAY'?'NHAP_TAY':'SAN'; let khop=0; const khongKhop=[];
    for(const d of ds){ let bd=null; const ma=chuoi(d.ma_theo_doi,60), link=chuoi(d.link,500); if(ma) bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE ma_theo_doi=? AND ma_theo_doi<>'' ORDER BY posted_at DESC LIMIT 1`).bind(ma).first(); if(!bd&&link) bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE link=? ORDER BY posted_at DESC LIMIT 1`).bind(link).first(); if(!bd&&d.bai_dang_id) bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(String(d.bai_dang_id)).first();
      if(!bd){ khongKhop.push({ma_theo_doi:ma, link, doanh_thu:so(d.doanh_thu), so_don:soAn(d.so_don), ky:chuoi(d.ky,20)}); continue; }
      await env.DB.prepare(`INSERT INTO ket_qua (id,bai_dang_id,muc_id,muc_tin_cay,nguon,ky,so_don,doanh_thu,ma_theo_doi,ghi_chu,created_at,created_by_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('kq'), bd.id, bd.muc_id, muc, nguon, chuoi(d.ky,20)||ngayVN(), soAn(d.so_don), so(d.doanh_thu), ma, JSON.stringify({doi_soat:true, ghi_chu:chuoi(d.ghi_chu,200)}), nowISO(), me.ho_ten).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DO', 'đối soát sàn', me); khop++; }
    await logAudit(env,me,'import đối soát','ket_qua',nguon,'khớp '+khop+' · không khớp '+khongKhop.length); return json({ db: await bootstrap(env,me), khop, khong_khop:khongKhop }); }
  if((m=path.match(/^\/ket-qua\/([^/]+)$/)) && method==='DELETE'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin xoá kết quả'},403); const k=await env.DB.prepare(`SELECT * FROM ket_qua WHERE id=?`).bind(m[1]).first(); if(!k) return json({error:'Không tìm thấy'},404); await env.DB.prepare(`DELETE FROM ket_qua WHERE id=?`).bind(k.id).run(); await logAudit(env,me,'xoá kết quả','ket_qua',k.id,k.nguon); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/bai-dang\/([^/]+)\/ma-theo-doi$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); await env.DB.prepare(`UPDATE bai_dang SET ma_theo_doi=?, updated_at=? WHERE id=?`).bind(chuoi(body.ma_theo_doi,60), nowISO(), m[1]).run(); return json({ db: await bootstrap(env,me) }); }
  // Báo cáo: tạo (staff), sửa nhận định, gửi (Trưởng MKT/Admin — mẫu học B11)
  if(path==='/bao-cao' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const r=await taoBaoCao(env, body.loai==='THANG'?'THANG':'TUAN', {ep:true}); await logAudit(env,me,'tạo báo cáo','bao_cao',r.id||'',r.tom_tat||r.bo_qua||''); return json({ ok:!!r.ok, ...r, db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/bao-cao\/([^/]+)$/)) && method==='PATCH'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const bc=await env.DB.prepare(`SELECT * FROM bao_cao WHERE id=?`).bind(m[1]).first(); if(!bc) return json({error:'Không tìm thấy'},404);
    await env.DB.prepare(`UPDATE bao_cao SET nhan_dinh=?, viec_can_lam=? WHERE id=?`).bind(body.nhan_dinh!=null?chuoi(body.nhan_dinh,3000):bc.nhan_dinh, Array.isArray(body.viec_can_lam)?JSON.stringify(body.viec_can_lam.map(x=>chuoi(x,200)).filter(Boolean).slice(0,5)):bc.viec_can_lam, bc.id).run(); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/bao-cao\/([^/]+)\/gui$/)) && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin gửi báo cáo'},403); const r=await guiBaoCao(env, m[1], me); if(!r.ok) return json({error:r.loi},400); return json({ ok:true, tom_tat:r.tom_tat, db: await bootstrap(env,me) }); }
  // Đề xuất cải tiến — cổng G4: Trưởng MKT / Admin / Giám đốc duyệt → máy áp dụng; bỏ phải có lý do (máy học)
  if((m=path.match(/^\/de-xuat\/([^/]+)\/quyet$/)) && method==='POST'){ if(!(canGat(me)||me.vai_tro===ROLES.GIAM_DOC)) return json({error:'Cổng G4: Trưởng MKT, Admin hoặc Giám đốc'},403); const d=await env.DB.prepare(`SELECT * FROM de_xuat WHERE id=?`).bind(m[1]).first(); if(!d) return json({error:'Không tìm thấy'},404); if(d.trang_thai!=='CHO') return json({error:'Đã quyết rồi'},409);
    const q=body.quyet==='DUYET'?'DUYET':body.quyet==='BO'?'BO':null; if(!q) return json({error:'quyet phải là DUYET hoặc BO'},400); if(q==='BO'&&!chuoi(body.ly_do)) return json({error:'Bỏ đề xuất phải ghi lý do (máy học từ đây)'},400);
    let ap=null; if(q==='DUYET') ap=await apDungDeXuat(env, d, me);
    await env.DB.prepare(`UPDATE de_xuat SET trang_thai=?, quyet_boi=?, quyet_at=?, ly_do_nguoi=?, ap_dung=? WHERE id=?`).bind(q, me.ho_ten, nowISO(), chuoi(body.ly_do,500), ap?JSON.stringify(ap):null, d.id).run();
    await ghiMauHoc(env,'B12',{doi_tuong_id:d.id, dau_vao:{loai:d.loai}, dau_ra_may:{quyet:'DUYET', ly_do:d.ly_do}, dau_ra_nguoi:{quyet:q, ly_do:chuoi(body.ly_do,200)}, giong:q==='DUYET'?1:0});
    await logAudit(env,me,q==='DUYET'?'duyệt đề xuất (G4) → máy áp dụng':'bỏ đề xuất','de_xuat',d.id,d.tieu_de); return json({ db: await bootstrap(env,me), ap_dung:ap }); }
  // ===== ADR-007 — seeding hội nhóm Facebook =====
  // Bản đồ thông điệp (thuộc chiến lược): staff sửa; máy đề xuất từ chiến lược (AI)
  if((m=path.match(/^\/seeding\/thong-diep(?:\/([^/]+))?$/))){ if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const sach=(b,cu)=>({ ten:b.ten!=null?chuoi(b.ten,150):(cu?cu.ten:''), y_chinh:b.y_chinh!=null?chuoi(b.y_chinh,500):(cu?cu.y_chinh:''), du_kien:b.du_kien!==undefined?JSON.stringify((Array.isArray(b.du_kien)?b.du_kien:String(b.du_kien||'').split('\n')).map(x=>chuoi(x,200)).filter(Boolean).slice(0,10)):(cu?cu.du_kien:'[]'), cach_noi_tho:b.cach_noi_tho!=null?chuoi(b.cach_noi_tho,300):(cu?cu.cach_noi_tho:''), khong_noi:b.khong_noi!=null?chuoi(b.khong_noi,300):(cu?cu.khong_noi:''), pillar_id:b.pillar_id!==undefined?(b.pillar_id||null):(cu?cu.pillar_id:null), thu_tu:b.thu_tu!=null?so(b.thu_tu):(cu?cu.thu_tu:0), active:b.active!=null?bool(b.active):(cu?cu.active:1) });
    if(method==='POST'&&!m[1]&&body.de_xuat_ai){ if(!env.ANTHROPIC_API_KEY) return json({error:'Cần ANTHROPIC_API_KEY để máy đề xuất'},503); const cl=await env.DB.prepare(`SELECT * FROM chien_luoc WHERE id=1`).first()||{}; const pillars=(await env.DB.prepare(`SELECT id,ten,mo_ta FROM pillars WHERE active=1`).all()).results; const sp=(await env.DB.prepare(`SELECT ten,thong_so,bao_hanh,tieu_chuan FROM san_pham WHERE active=1 LIMIT 12`).all()).results; const claims=await docClaims(env);
      const r=await goiAI(env,{system:'Bạn là trưởng phòng marketing keo ron gạch Kingsmen. Từ định vị, pillar, thông số sản phẩm thật, rút ra 5–8 THÔNG ĐIỆP seeding cho hội nhóm thợ. Mỗi thông điệp: ten (≤ 12 từ), y_chinh (1–2 câu), du_kien (mảng dữ kiện được dùng — chỉ lấy từ thông số/bảo hành/tiêu chuẩn đã cho), cach_noi_tho (cách thợ hay nói, từ ngữ nghề), khong_noi (điều không được nói: giá, tuyệt đối, so sánh tên đối thủ…), pillar_id. CHỈ trả JSON {"thong_diep":[…]}.', messages:[{role:'user',content:'ĐỊNH VỊ: '+(cl.dinh_vi||'')+'\nTÔNG GIỌNG: '+(cl.tong_giong||'')+'\nĐỐI TƯỢNG: '+(cl.doi_tuong||'')+'\nPILLAR: '+JSON.stringify(pillars)+'\nSẢN PHẨM: '+JSON.stringify(sp.map(s=>({ten:s.ten, thong_so:docJSON(s.thong_so,[]), bao_hanh:s.bao_hanh, tieu_chuan:s.tieu_chuan})))+'\nCỤM CẤM: '+JSON.stringify(claims.map(c=>c.cum_tu))}], max_tokens:2500, tinh_nang:'seeding_thong_diep', me}); if(!r.ok) return json({error:r.loi},502);
      let o; try{ const t=r.text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,''); o=JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}')+1)); }catch(e){ return json({error:'JSON AI hỏng'},502); } let them=0;
      for(const x of (Array.isArray(o.thong_diep)?o.thong_diep:[]).slice(0,8)){ const s2=sach({...x, pillar_id:pillars.some(p=>p.id===x.pillar_id)?x.pillar_id:null},null); if(!s2.ten) continue; if(await env.DB.prepare(`SELECT id FROM thong_diep_seeding WHERE ten=?`).bind(s2.ten).first()) continue; await env.DB.prepare(`INSERT INTO thong_diep_seeding (id,ten,y_chinh,du_kien,cach_noi_tho,khong_noi,pillar_id,thu_tu,active,tao_boi,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,'AGENT',?,?)`).bind(uid('td'),s2.ten,s2.y_chinh,s2.du_kien,s2.cach_noi_tho,s2.khong_noi,s2.pillar_id,them,nowISO(),nowISO()).run(); them++; }
      await logAudit(env,me,'máy đề xuất bản đồ thông điệp','thong_diep_seeding','',them+' thông điệp'); return json({ db: await bootstrap(env,me), them }); }
    if(method==='POST'&&!m[1]){ const o=sach(body,null); if(!o.ten) return json({error:'Thiếu tên thông điệp'},400); const id=uid('td'); await env.DB.prepare(`INSERT INTO thong_diep_seeding (id,ten,y_chinh,du_kien,cach_noi_tho,khong_noi,pillar_id,thu_tu,active,tao_boi,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'NGUOI',?,?)`).bind(id,o.ten,o.y_chinh,o.du_kien,o.cach_noi_tho,o.khong_noi,o.pillar_id,o.thu_tu,o.active,nowISO(),nowISO()).run(); await env.DB.prepare(`UPDATE chien_luoc SET updated_at=? WHERE id=1`).bind(nowISO()).run(); await logAudit(env,me,'thêm thông điệp seeding','thong_diep_seeding',id,o.ten); return json({ db: await bootstrap(env,me), id }); }
    if(method==='PATCH'&&m[1]){ const cu=await env.DB.prepare(`SELECT * FROM thong_diep_seeding WHERE id=?`).bind(m[1]).first(); if(!cu) return json({error:'Không tìm thấy'},404); const o=sach(body,cu); await env.DB.prepare(`UPDATE thong_diep_seeding SET ten=?, y_chinh=?, du_kien=?, cach_noi_tho=?, khong_noi=?, pillar_id=?, thu_tu=?, active=?, updated_at=? WHERE id=?`).bind(o.ten,o.y_chinh,o.du_kien,o.cach_noi_tho,o.khong_noi,o.pillar_id,o.thu_tu,o.active,nowISO(),cu.id).run(); await env.DB.prepare(`UPDATE chien_luoc SET updated_at=? WHERE id=1`).bind(nowISO()).run(); return json({ db: await bootstrap(env,me) }); }
    if(method==='DELETE'&&m[1]){ await env.DB.prepare(`UPDATE thong_diep_seeding SET active=0, updated_at=? WHERE id=?`).bind(nowISO(), m[1]).run(); return json({ db: await bootstrap(env,me) }); } }
  if((m=path.match(/^\/seeding\/tai-khoan(?:\/([^/]+))?$/))){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin quản lý tài khoản seeding'},403);
    const giongOk=g=>GIONG_SEED.some(x=>x[0]===g)?g:'THO';
    if(method==='POST'&&!m[1]){ if(!chuoi(body.nhan)) return json({error:'Thiếu nhãn'},400); const id=uid('tk'); await env.DB.prepare(`INSERT INTO tai_khoan_seeding (id,nhan,nen,tram_id,giong,persona,nhip_ngay,active,created_at) VALUES (?,?,'FB',?,?,?,?,1,?)`).bind(id, chuoi(body.nhan,80), chuoi(body.tram_id,60)||'facebook', giongOk(body.giong), JSON.stringify({nghe:chuoi(body.nghe,80), khu_vuc:chuoi(body.khu_vuc,80), cau_chuyen:chuoi(body.cau_chuyen,500)}), Math.max(1,Math.min(10,so(body.nhip_ngay,2))), nowISO()).run(); await logAudit(env,me,'thêm tài khoản seeding','tai_khoan_seeding',id,chuoi(body.nhan,80)+' · '+giongOk(body.giong)); return json({ db: await bootstrap(env,me), id }); }
    if(method==='PATCH'&&m[1]){ const t=await docTaiKhoan(env,m[1]); if(!t) return json({error:'Không tìm thấy'},404); const p=docJSON(t.persona,{}); await env.DB.prepare(`UPDATE tai_khoan_seeding SET nhan=?, tram_id=?, giong=?, persona=?, nhip_ngay=?, active=?, tam_dung_den=? WHERE id=?`).bind(body.nhan!=null?chuoi(body.nhan,80):t.nhan, body.tram_id!=null?chuoi(body.tram_id,60):t.tram_id, body.giong!=null?giongOk(body.giong):t.giong, JSON.stringify({nghe:body.nghe!=null?chuoi(body.nghe,80):p.nghe, khu_vuc:body.khu_vuc!=null?chuoi(body.khu_vuc,80):p.khu_vuc, cau_chuyen:body.cau_chuyen!=null?chuoi(body.cau_chuyen,500):p.cau_chuyen}), body.nhip_ngay!=null?Math.max(1,Math.min(10,so(body.nhip_ngay,2))):t.nhip_ngay, body.active!=null?bool(body.active):t.active, body.mo_lai?null:t.tam_dung_den, t.id).run(); await logAudit(env,me,'sửa tài khoản seeding','tai_khoan_seeding',t.id,''); return json({ db: await bootstrap(env,me) }); }
    if(method==='DELETE'&&m[1]){ await env.DB.prepare(`UPDATE tai_khoan_seeding SET active=0 WHERE id=?`).bind(m[1]).run(); return json({ db: await bootstrap(env,me) }); } }
  if((m=path.match(/^\/seeding\/nhom(?:\/([^/]+))?$/))){ if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const sach=(b,cu)=>({ ten:b.ten!=null?chuoi(b.ten,150):(cu?cu.ten:''), link_hoac_id:b.link_hoac_id!=null?chuoi(b.link_hoac_id,300):(cu?cu.link_hoac_id:''), chu_de:b.chu_de!=null?chuoi(b.chu_de,200):(cu?cu.chu_de:''), quy_tac:b.quy_tac!==undefined?JSON.stringify({duyet_bai:!!(b.quy_tac||{}).duyet_bai, cam_ban_hang:!!(b.quy_tac||{}).cam_ban_hang, cam_link:!!(b.quy_tac||{}).cam_link}):(cu?cu.quy_tac:'{}'), gio_vang:b.gio_vang!==undefined?JSON.stringify((Array.isArray(b.gio_vang)?b.gio_vang:String(b.gio_vang||'').split(/[,\s]+/)).map(x=>so(x,-1)).filter(x=>x>=0&&x<=23).slice(0,6)):(cu?cu.gio_vang:'[]'), tai_khoan_ids:b.tai_khoan_ids!==undefined?JSON.stringify((Array.isArray(b.tai_khoan_ids)?b.tai_khoan_ids:[]).map(x=>chuoi(x,40)).filter(Boolean).slice(0,10)):(cu?cu.tai_khoan_ids:'[]'), cach:b.cach!=null?(String(b.cach).toUpperCase()==='TAY'?'TAY':'TRAM'):(cu?cu.cach:'TRAM'), nhip_tuan:b.nhip_tuan!=null?Math.max(1,Math.min(7,so(b.nhip_tuan,1))):(cu?cu.nhip_tuan:1), active:b.active!=null?bool(b.active):(cu?cu.active:1), ghi_chu:b.ghi_chu!=null?chuoi(b.ghi_chu,500):(cu?cu.ghi_chu:'') });
    if(method==='POST'&&!m[1]){ const o=sach(body,null); if(!o.ten) return json({error:'Thiếu tên nhóm'},400); const id=uid('nh'); await env.DB.prepare(`INSERT INTO nhom_seeding (id,ten,nen,link_hoac_id,chu_de,quy_tac,gio_vang,tai_khoan_ids,cach,nhip_tuan,active,hieu_qua,ghi_chu,created_at,created_by_name) VALUES (?,?,'FB',?,?,?,?,?,?,?,?,'{}',?,?,?)`).bind(id,o.ten,o.link_hoac_id,o.chu_de,o.quy_tac,o.gio_vang,o.tai_khoan_ids,o.cach,o.nhip_tuan,o.active,o.ghi_chu,nowISO(),me.ho_ten).run(); await logAudit(env,me,'thêm nhóm seeding','nhom_seeding',id,o.ten); return json({ db: await bootstrap(env,me), id }); }
    if(method==='PATCH'&&m[1]){ const cu=await env.DB.prepare(`SELECT * FROM nhom_seeding WHERE id=?`).bind(m[1]).first(); if(!cu) return json({error:'Không tìm thấy'},404); const o=sach(body,cu); await env.DB.prepare(`UPDATE nhom_seeding SET ten=?, link_hoac_id=?, chu_de=?, quy_tac=?, gio_vang=?, tai_khoan_ids=?, cach=?, nhip_tuan=?, active=?, ghi_chu=? WHERE id=?`).bind(o.ten,o.link_hoac_id,o.chu_de,o.quy_tac,o.gio_vang,o.tai_khoan_ids,o.cach,o.nhip_tuan,o.active,o.ghi_chu,cu.id).run(); await logAudit(env,me,'sửa nhóm seeding','nhom_seeding',cu.id,o.ten); return json({ db: await bootstrap(env,me) }); }
    if(method==='DELETE'&&m[1]){ await env.DB.prepare(`UPDATE nhom_seeding SET active=0 WHERE id=?`).bind(m[1]).run(); return json({ db: await bootstrap(env,me) }); } }
  // Gói: tạo tay (bài chính hoặc định kỳ), duyệt/trả (G3-gói, Trưởng MKT/Admin), xếp lịch
  if(path==='/seeding/goi' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); let bd=null; if(body.bai_dang_id){ bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(String(body.bai_dang_id)).first(); if(!bd||bd.trang_thai!=='DA_DANG') return json({error:'Chỉ tạo gói cho bài chính ĐÃ ĐĂNG'},409); }
    const r=await taoGoiSeeding(env,{loai:bd?'BAI_CHINH':'DINH_KY', bd, tacNhan:me, soBT:so(body.so_bien_the)}); if(!r.ok) return json({error:r.loi},r.id?409:400); return json({ db: await bootstrap(env,me), id:r.id, so_bien_the:r.so_bien_the, cham:r.cham, tu_duyet:r.tu_duyet }); }
  if((m=path.match(/^\/seeding\/goi\/([^/]+)\/(duyet|tra-lai|xep-lich|gui-duyet)$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const g=await env.DB.prepare(`SELECT * FROM goi_seeding WHERE id=?`).bind(m[1]).first(); if(!g) return json({error:'Không tìm thấy gói'},404);
    if(m[2]==='xep-lich'){ const x=await xepLichGoi(env, g, me); if(!x.ok) return json({error:x.loi},409); return json({ db: await bootstrap(env,me), xep:x.tao, bo:x.bo }); }
    if(m[2]==='gui-duyet'){ const cham=await chamGoiMay(env,g.id); await env.DB.prepare(`UPDATE goi_seeding SET trang_thai='CHO_DUYET', cham_may=? WHERE id=?`).bind(JSON.stringify(cham), g.id).run(); return json({ db: await bootstrap(env,me), cham }); }
    if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin duyệt gói seeding (G3-gói)'},403); if(g.trang_thai!=='CHO_DUYET') return json({error:'Gói không ở trạng thái chờ duyệt'},409);
    const q=m[2]==='duyet'?'DUYET':'TRA_LAI'; if(q==='TRA_LAI'&&!chuoi(body.ly_do)) return json({error:'Trả lại phải ghi lý do (máy học)'},400); const cham=docJSON(g.cham_may,{});
    await env.DB.prepare(`UPDATE goi_seeding SET trang_thai=?, duyet_boi=?, duyet_at=?, ly_do=? WHERE id=?`).bind(q, me.ho_ten, nowISO(), chuoi(body.ly_do,300), g.id).run(); await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='DUYET_GOI_SEEDING' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, g.id).run();
    await ghiMauHoc(env,'B13',{doi_tuong_id:g.id, dau_vao:{loai:g.loai}, dau_ra_may:{nen_duyet:!!cham.nen_duyet, diem:cham.diem}, dau_ra_nguoi:{quyet:q, ly_do:chuoi(body.ly_do,200)}, giong:(!!cham.nen_duyet)===(q==='DUYET')?1:0, ghi_chu:'G3-gói'});
    let xep=null; if(q==='DUYET'){ const b14=await mucBuoc(env,'B14'); if(b14.nguoi_thuc_hien!=='NGUOI'){ const x=await xepLichGoi(env, {...g, trang_thai:'DUYET'}, MAY('Máy (B14)')); xep=x.tao; } }
    await logAudit(env,me,q==='DUYET'?'duyệt gói seeding (G3-gói)':'trả lại gói seeding','goi_seeding',g.id,chuoi(body.ly_do,200)+(xep!=null?(' · máy xếp '+xep+' việc'):'')); return json({ db: await bootstrap(env,me), xep }); }
  if((m=path.match(/^\/seeding\/bien-the\/([^/]+)$/)) && method==='PATCH'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const b=await env.DB.prepare(`SELECT * FROM bien_the WHERE id=?`).bind(m[1]).first(); if(!b) return json({error:'Không tìm thấy'},404); const nd=chuoi(body.noi_dung,1500)||b.noi_dung; const chan=quetClaim(nd, await docClaims(env)).filter(c=>c.muc_do==='CHAN'); if(chan.length) return json({error:'Có cụm bị CHẶN: '+chan.map(c=>c.cum_tu).join(', ')},422);
    if(b.tao_boi==='AGENT'&&nd!==b.noi_dung) await ghiMauHoc(env,'B13',{doi_tuong_id:b.id, dau_vao:{goi_id:b.goi_id, giong:b.giong, dang_bai:b.dang_bai}, dau_ra_may:{noi_dung:b.noi_dung}, dau_ra_nguoi:{noi_dung:nd}, giong:giongVanBan(b.noi_dung, nd), ghi_chu:'người sửa biến thể máy soạn'});
    await env.DB.prepare(`UPDATE bien_the SET noi_dung=?, co_link=?, binh_luan=?, bam=?, sua_boi=?, updated_at=? WHERE id=?`).bind(nd, coLink(nd)?1:0, Array.isArray(body.binh_luan)?JSON.stringify(body.binh_luan.map(x=>{ if(typeof x==='string'){ const mm=x.match(/^(HOI_KN|XAC_NHAN|HOI_MUA)\s*[:：]\s*(.+)$/i); return mm?{vai:mm[1].toUpperCase(),text:chuoi(mm[2],200)}:{vai:'HOI_KN',text:chuoi(x,200)}; } return {vai:chuoi(x&&x.vai,20)||'HOI_KN',text:chuoi(x&&x.text,200)}; }).filter(x=>x.text).slice(0,3)):b.binh_luan, bamVanBan(nd), me.ho_ten, nowISO(), b.id).run(); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/seeding\/viec\/([^/]+)\/(quyet|huy|dang-ngay|da-dang)$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const v=await env.DB.prepare(`SELECT * FROM viec_seeding WHERE id=?`).bind(m[1]).first(); if(!v) return json({error:'Không tìm thấy việc'},404);
    if(m[2]==='huy'){ await env.DB.prepare(`UPDATE viec_seeding SET trang_thai='HUY', ly_do=?, quyet_boi=?, quyet_at=?, updated_at=? WHERE id=?`).bind(chuoi(body.ly_do,300)||'người huỷ', me.ho_ten, nowISO(), nowISO(), v.id).run(); await logAudit(env,me,'huỷ việc seeding','viec_seeding',v.id,chuoi(body.ly_do,200)); return json({ db: await bootstrap(env,me) }); }
    if(m[2]==='dang-ngay'){ if(v.trang_thai!=='CHO') return json({error:'Chỉ đẩy việc đang CHỜ'},409); await env.DB.prepare(`UPDATE viec_seeding SET gio_dang=?, updated_at=? WHERE id=?`).bind(nowISO(), nowISO(), v.id).run(); const r=await chayDangSeeding(env); return json({ db: await bootstrap(env,me), tom_tat:r.tom_tat||r.bo_qua }); }
    if(m[2]==='da-dang'){ if(!['CHO','DANG_GUI','LOI','CHO_QUAN_TRI'].includes(v.trang_thai)) return json({error:'Việc không ở trạng thái chờ đăng'},409); await env.DB.prepare(`UPDATE viec_seeding SET trang_thai='DA_DANG', link=?, dang_at=COALESCE(dang_at,?), bang_chung=?, loi=NULL, updated_at=? WHERE id=?`).bind(chuoi(body.link,500), nowISO(), JSON.stringify({nguon:'NGUOI', boi:me.ho_ten}), nowISO(), v.id).run(); await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='SEEDING_TAY' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, v.id).run(); await logAudit(env,me,'đăng seeding tay','viec_seeding',v.id,chuoi(body.link,200)); return json({ db: await bootstrap(env,me) }); }
    const q=body.quyet==='DAT'?'DAT':body.quyet==='KHONG_DAT'?'KHONG_DAT':null; if(!q) return json({error:'quyet phải là DAT hoặc KHONG_DAT'},400); if(!['DA_DANG','DAT','KHONG_DAT','NGHI_NGO','CHO_QUAN_TRI'].includes(v.trang_thai)) return json({error:'Việc chưa đăng'},409);
    if(v.quyet_boi&&/Máy/.test(v.quyet_boi)) await ghiMauHoc(env,'B16',{doi_tuong_id:v.id, dau_vao:{nhom_id:v.nhom_id}, dau_ra_may:{kq:v.trang_thai, ly_do:v.ly_do}, dau_ra_nguoi:{kq:q, ly_do:chuoi(body.ly_do,200)}, giong:v.trang_thai===q?1:0});
    await env.DB.prepare(`UPDATE viec_seeding SET trang_thai=?, ly_do=?, quyet_boi=?, quyet_at=?, updated_at=? WHERE id=?`).bind(q, chuoi(body.ly_do,300)||v.ly_do, me.ho_ten, nowISO(), nowISO(), v.id).run(); await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='SEEDING_NGHI_NGO' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, v.id).run();
    await logAudit(env,me,'quyết việc seeding','viec_seeding',v.id,q+' · '+chuoi(body.ly_do,200)); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/seeding\/binh-luan\/([^/]+)\/(huy|da-dang)$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const b=await env.DB.prepare(`SELECT * FROM binh_luan_seeding WHERE id=?`).bind(m[1]).first(); if(!b) return json({error:'Không tìm thấy'},404);
    await env.DB.prepare(`UPDATE binh_luan_seeding SET trang_thai=?, dang_at=?, loi=? WHERE id=?`).bind(m[2]==='huy'?'HUY':'DA_DANG', m[2]==='huy'?b.dang_at:nowISO(), m[2]==='huy'?(chuoi(body.ly_do,200)||'người huỷ'):null, b.id).run(); await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='BINH_LUAN_TAY' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, b.id).run(); await logAudit(env,me,m[2]==='huy'?'huỷ bình luận dẫn dắt':'bình luận tay','binh_luan_seeding',b.id,''); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/seeding\/nuoi\/([^/]+)\/huy$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); await env.DB.prepare(`UPDATE nuoi_seeding SET trang_thai='HUY' WHERE id=? AND trang_thai IN ('CHO','DANG_GUI')`).bind(m[1]).run(); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/seeding\/lead\/([^/]+)$/)) && method==='PATCH'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const l=await env.DB.prepare(`SELECT * FROM lead_seeding WHERE id=?`).bind(m[1]).first(); if(!l) return json({error:'Không tìm thấy'},404); const tt=['MOI','DA_TRA_LOI','CHUYEN_SALE'].includes(String(body.trang_thai||'').toUpperCase())?String(body.trang_thai).toUpperCase():l.trang_thai;
    await env.DB.prepare(`UPDATE lead_seeding SET trang_thai=?, ghi_chu=?, tra_loi_at=CASE WHEN ?<>'MOI' THEN ? ELSE tra_loi_at END, tra_loi_boi=CASE WHEN ?<>'MOI' THEN ? ELSE tra_loi_boi END WHERE id=?`).bind(tt, body.ghi_chu!=null?chuoi(body.ghi_chu,500):l.ghi_chu, tt, nowISO(), tt, me.ho_ten, l.id).run(); if(tt!=='MOI') await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='LEAD_SEEDING' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, l.id).run(); return json({ db: await bootstrap(env,me) }); }
  // ===== KHOÁ API dán từ giao diện (Admin) — PUT lưu (thử trước với nhà cung cấp), DELETE gỡ; khoá wrangler không đè được =====
  if((m=path.match(/^\/khoa-api\/([A-Z0-9_]+)$/)) && (method==='PUT'||method==='DELETE')){ if(me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin cắm khoá'},403); const ten=m[1]; if(!tenKhoaHopLe(ten)) return json({error:'Tên khoá không nằm trong danh sách cho phép'},400);
    const goc=env.__env_goc||env; if(goc[ten]&&!(env.__khoa_app||{})[ten]) return json({error:'Khoá này đang cắm bằng wrangler secret trên Cloudflare — app không đè được; gỡ ở Cloudflare (wrangler secret delete '+ten+') rồi dán lại ở đây'},409);
    if(method==='DELETE'){ await env.DB.prepare(`DELETE FROM khoa_api WHERE ten=?`).bind(ten).run(); KHOA_CACHE={luc:0, ds:null}; await logAudit(env,me,'gỡ khoá API','khoa_api',ten,''); return json({ db: await bootstrap(await napKhoa(goc),me) }); }
    const gt=String(body.gia_tri||'').trim(); if(gt.length<8||gt.length>4000||/\s/.test(gt)) return json({error:'Khoá không hợp lệ (quá ngắn, quá dài hoặc có khoảng trắng)'},400);
    let thu=null; if(body.thu!==false){ thu=await thuKhoa(ten, gt); if(thu&&thu.ok===false&&!body.van_luu) return json({error:'Thử khoá không được: '+thu.loi+' — kiểm lại rồi dán lại, hoặc bấm Vẫn lưu', thu},422); }
    const mh=await maHoa(env, gt); await env.DB.prepare(`INSERT INTO khoa_api (ten,gia_tri,iv,duoi,updated_at,updated_by_name) VALUES (?,?,?,?,?,?) ON CONFLICT(ten) DO UPDATE SET gia_tri=excluded.gia_tri, iv=excluded.iv, duoi=excluded.duoi, updated_at=excluded.updated_at, updated_by_name=excluded.updated_by_name`).bind(ten, mh.gia_tri, mh.iv, gt.slice(-4), nowISO(), me.ho_ten).run();
    KHOA_CACHE={luc:0, ds:null}; await logAudit(env,me,'cắm khoá API','khoa_api',ten,'…'+gt.slice(-4)+(thu?(' · thử: '+(thu.ok?'được':'không')):''));
    return json({ db: await bootstrap(await napKhoa(goc),me), thu }); }
  // ===== ADR-009 — bộ não AI: mô hình, định tuyến, kho mẫu, huấn luyện, phiên bản =====
  if(path==='/ai/mo-hinh' && method==='POST'){ if(me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin thêm mô hình'},403); const id=chuoi(body.id,60).toLowerCase().replace(/[^a-z0-9-]/g,'-'); if(!id||!chuoi(body.ten)) return json({error:'Thiếu id/tên'},400); if(await docMoHinh(env,id)) return json({error:'Trùng id'},409);
    const kenv=chuoi(body.khoa_env,60).replace(/[^A-Z0-9_]/g,''); await env.DB.prepare(`INSERT INTO mo_hinh (id,ten,nha_cung_cap,loai,cach_goi,model_id,gia_vao,gia_ra,don_vi,kha_nang,trang_thai,ghi_chu,created_at,updated_at,base_url,khoa_env) VALUES (?,?,?,?,?,?,?,?,?,'[]','BAT',?,?,?,?,?)`).bind(id, chuoi(body.ten,80), chuoi(body.nha_cung_cap,30)||'anthropic', ['NGON_NGU','NHIN','NGHE','TTS','ANH'].includes(body.loai)?body.loai:'NGON_NGU', body.cach_goi==='MAY_GHEP'?'MAY_GHEP':'API', chuoi(body.model_id,120), Math.max(0,so(body.gia_vao)), Math.max(0,so(body.gia_ra)), body.don_vi==='1M_ky_tu'?'1M_ky_tu':'1M_token', chuoi(body.ghi_chu,300), nowISO(), nowISO(), chuoi(body.base_url,300), kenv||null).run(); await logAudit(env,me,'thêm mô hình AI','mo_hinh',id,chuoi(body.ten,80)); return json({ db: await bootstrap(env,me), id }); }
  if((m=path.match(/^\/ai\/mo-hinh\/([^/]+)(?:\/(thu))?$/))){ const mo=await docMoHinh(env,m[1]); if(!mo) return json({error:'Không có mô hình'},404);
    if(m[2]==='thu' && method==='POST'){ if(!canGat(me)) return json({error:'Không có quyền'},403); if(mo.cach_goi!=='API'||mo.loai!=='NGON_NGU') return json({error:'Chỉ thử được mô hình ngôn ngữ gọi API; mô hình mở thử qua máy ghép (bóng)'},409); const t0=Date.now(); const r=await goiNhaCungCap(env, mo, {system:'Trả lời đúng một câu ngắn tiếng Việt.', messages:[{role:'user',content:'Kingsmen là thương hiệu gì? (nếu không biết, nói không biết)'}], max_tokens:60}); await ghiAIUsage(env,{provider:mo.nha_cung_cap, model:mo.model_id, tinh_nang:'thu_mo_hinh', me, tokens_vao:r.vao, tokens_ra:r.ra, ok:r.ok, ms:Date.now()-t0, loi:r.ok?null:r.loi, chi_phi_usd:chiPhiMoHinh(mo,r.vao,r.ra), mo_hinh_id:mo.id, muc:'THU'}); return json({ ok:r.ok, loi:r.loi, text:(r.text||'').slice(0,300), ms:Date.now()-t0, tokens:{vao:so(r.vao), ra:so(r.ra)}, usd:chiPhiMoHinh(mo,r.vao,r.ra) }); }
    if(method==='PATCH'){ if(me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin sửa mô hình'},403); await env.DB.prepare(`UPDATE mo_hinh SET ten=?, model_id=?, gia_vao=?, gia_ra=?, trang_thai=?, ghi_chu=?, base_url=?, khoa_env=?, updated_at=? WHERE id=?`).bind(body.ten!=null?chuoi(body.ten,80):mo.ten, body.model_id!=null?chuoi(body.model_id,120):mo.model_id, body.gia_vao!=null?Math.max(0,so(body.gia_vao)):mo.gia_vao, body.gia_ra!=null?Math.max(0,so(body.gia_ra)):mo.gia_ra, body.trang_thai==='TAT'?'TAT':body.trang_thai==='BAT'?'BAT':mo.trang_thai, body.ghi_chu!=null?chuoi(body.ghi_chu,300):mo.ghi_chu, body.base_url!=null?chuoi(body.base_url,300):mo.base_url, body.khoa_env!=null?(chuoi(body.khoa_env,60).replace(/[^A-Z0-9_]/g,'')||null):mo.khoa_env, nowISO(), mo.id).run(); await logAudit(env,me,'sửa mô hình AI','mo_hinh',mo.id,''); return json({ db: await bootstrap(env,me) }); } }
  if((m=path.match(/^\/ai\/dinh-tuyen\/([a-z_]+)$/)) && method==='PATCH'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin định tuyến'},403); const dt=await env.DB.prepare(`SELECT * FROM dinh_tuyen WHERE tinh_nang=?`).bind(m[1]).first(); if(!dt) return json({error:'Không có tính năng'},404);
    const layMo=async(id, loaiCan, cachCan)=>{ if(id===undefined) return undefined; if(!id) return null; const x=await docMoHinh(env,String(id)); if(!x||x.loai!==loaiCan||(cachCan&&x.cach_goi!==cachCan)) throw new Error('Mô hình '+id+' không hợp ('+loaiCan+(cachCan?(' · '+cachCan):'')+')'); return x.id; };
    let chinh, duPhong, mo; try{ chinh=await layMo(body.mo_hinh_chinh, dt.loai, 'API'); duPhong=await layMo(body.mo_hinh_du_phong, dt.loai, 'API'); mo=await layMo(body.mo_hinh_mo, dt.loai, 'MAY_GHEP'); }catch(e){ return json({error:e.message},422); }
    const mucMoi=body.muc!=null?String(body.muc).toUpperCase():dt.muc; if(!['API','BONG','MO'].includes(mucMoi)) return json({error:'Mức phải là API | BONG | MO'},400); const moId=mo===undefined?dt.mo_hinh_mo:mo;
    if(mucMoi!=='API' && !moId) return json({error:'Cần chọn mô hình mở trước khi bật BÓNG/MỞ'},422);
    if(mucMoi==='MO'){ if(dt.loai==='NGON_NGU'&&!MO_NGON_NGU_HO_TRO.includes(dt.tinh_nang)) return json({error:'Tính năng này chưa có bước đi tiếp cho mô hình mở (hỗ trợ: '+MO_NGON_NGU_HO_TRO.join(', ')+') — dùng BÓNG'},422); const moX=await docMoHinh(env,moId); if(dt.loai==='NHIN'&&!(moX&&moX.phien_ban)) return json({error:'Mô hình mở chưa có phiên bản đã duyệt — huấn luyện & duyệt trước'},422); if(so(dt.diem)<so(body.nguong!=null?body.nguong:dt.nguong)||so(dt.so_mau)<so(body.min_mau!=null?body.min_mau:dt.min_mau)) return json({error:'Chưa đủ điều kiện gạt MỞ: cần điểm ≥ '+dt.nguong+' và ≥ '+dt.min_mau+' mẫu (hiện '+dt.diem+'/100, '+dt.so_mau+' mẫu)'},422); }
    await env.DB.prepare(`UPDATE dinh_tuyen SET mo_hinh_chinh=?, mo_hinh_du_phong=?, mo_hinh_mo=?, muc=?, nguong=?, min_mau=?, updated_at=?, updated_by_name=? WHERE tinh_nang=?`).bind(chinh===undefined?dt.mo_hinh_chinh:chinh, duPhong===undefined?dt.mo_hinh_du_phong:duPhong, moId, mucMoi, body.nguong!=null?Math.max(0,Math.min(100,so(body.nguong))):dt.nguong, body.min_mau!=null?Math.max(1,so(body.min_mau)):dt.min_mau, nowISO(), me.ho_ten, dt.tinh_nang).run();
    if(mucMoi!==dt.muc) await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='GAT_DINH_TUYEN' AND doi_tuong_id LIKE ? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, 'dinh_tuyen:'+dt.tinh_nang+':%').run();
    await logAudit(env,me,'định tuyến AI','dinh_tuyen',dt.tinh_nang,dt.muc+' → '+mucMoi+(chinh!==undefined?(' · chính '+chinh):'')); await tinhDinhTuyen(env); return json({ db: await bootstrap(env,me) }); }
  if(path==='/ai/mau' && method==='GET'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const tn=chuoi(url.searchParams.get('tinh_nang'),40); const ds=(await env.DB.prepare(`SELECT * FROM mau_hoc_ai ${tn?'WHERE tinh_nang=?':''} ORDER BY created_at DESC LIMIT 60`).bind(...(tn?[tn]:[])).all()).results; return json({ mau: ds.map(r=>({...r, dau_vao:docJSON(r.dau_vao,{}), dau_ra:docJSON(r.dau_ra,r.dau_ra), dau_ra_mo:docJSON(r.dau_ra_mo,r.dau_ra_mo), phan_quyet:docJSON(r.phan_quyet,r.phan_quyet), nhan:docJSON(r.nhan,null)})) }); }
  if((m=path.match(/^\/ai\/mau\/([^/]+)$/)) && method==='PATCH'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const r=await env.DB.prepare(`SELECT * FROM mau_hoc_ai WHERE id=?`).bind(m[1]).first(); if(!r) return json({error:'Không có mẫu'},404); const pq=String(body.phan_quyet||'').toUpperCase(); if(!['DUNG','SAI'].includes(pq)) return json({error:'phan_quyet DUNG | SAI'},400);
    const nhan=(body.nhan&&typeof body.nhan==='object')?body.nhan:(pq==='DUNG'?docJSON(r.dau_ra,{}):{}); if(r.tinh_nang==='chon_canh'&&!nhan.tai_san_id) return json({error:'Cần nhãn: tài sản đúng cho cảnh'},400);
    const giong=r.tinh_nang==='chon_canh'?(nhan.tai_san_id===(docJSON(r.dau_ra,{})||{}).tai_san_id?1:0):(pq==='DUNG'?1:0);
    // ADR-009c: tts & loc_footage là chấm mô hình mở trực tiếp → giong_mo = phán quyết; đoạn cắt bị bỏ → gỡ tài sản máy cắt
    const giongMo=['tts','loc_footage'].includes(r.tinh_nang)?(pq==='DUNG'?1:0):null; if(r.tinh_nang==='loc_footage'&&pq==='SAI'){ const tsId=(docJSON(r.dau_ra,{})||{}).tai_san_id; if(tsId) await env.DB.prepare(`DELETE FROM tai_san WHERE id=? AND nguon='MAY'`).bind(tsId).run(); if(!nhan.tai_san_id) nhan.bo=true; }
    if(r.tinh_nang==='loc_footage'&&pq==='DUNG') nhan.tai_san_id=nhan.tai_san_id||(docJSON(r.dau_ra,{})||{}).tai_san_id;
    await env.DB.prepare(`UPDATE mau_hoc_ai SET phan_quyet=?, nhan=?, giong=?, giong_mo=COALESCE(?,giong_mo), cham_at=?, cham_boi=? WHERE id=?`).bind(pq, JSON.stringify(nhan).slice(0,2000), giong, giongMo, nowISO(), me.ho_ten, r.id).run(); await logAudit(env,me,'chấm mẫu AI','mau_hoc_ai',r.id,r.tinh_nang+' · '+pq); return json({ db: await bootstrap(env,me) }); }
  if(path==='/ai/huan-luyen' && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin ra lệnh huấn luyện'},403); const tn=chuoi(body.tinh_nang,40)||'chon_canh'; const dt=await env.DB.prepare(`SELECT * FROM dinh_tuyen WHERE tinh_nang=?`).bind(tn).first(); if(!dt||dt.loai!=='NHIN') return json({error:'Chỉ huấn luyện tính năng NHÌN (chon_canh, loc_footage, chon_doan, ghep_canh)'},409); if(!dt.mo_hinh_mo) return json({error:'Tính năng chưa gán mô hình mở'},422); const phamVi=chuoi(body.pham_vi,90)||'chung'; const dk=dkPhamVi(phamVi);
    const n=so((await env.DB.prepare(`SELECT COUNT(*) n FROM mau_hoc_ai WHERE tinh_nang=? AND nhan IS NOT NULL`+dk.sql).bind(tn, ...dk.bind).first()||{}).n); const minHl=10; if(n<minHl) return json({error:'Cần ≥ '+minHl+' mẫu người đã chấm'+(phamVi!=='chung'?(' trong phạm vi '+phamVi):'')+' (hiện '+n+') — chấm cảnh ở thẻ video › Sản xuất hoặc nạp kho thành phẩm'},409);
    const mayId=await mayChoViec(env,'huan_luyen')||(['chon_doan','ghep_canh'].includes(tn)?await mayChoViec(env,'dung_video'):null); if(!mayId) return json({error:'Không có máy huấn luyện đang bật — bật máy con có GPU (thuê) với kha_nang huan_luyen rồi thử lại'},409);
    const r=await taoLenhTram(env,'huan_luyen',{tinh_nang:tn, mo_hinh_id:dt.mo_hinh_mo, pham_vi:phamVi}, me, mayId); await logAudit(env,me,'ra lệnh huấn luyện','dinh_tuyen',tn,dt.mo_hinh_mo+' · '+n+' mẫu · '+phamVi); return json({ db: await bootstrap(env,me), lenh_id:r.id, trung:!!r.trung, so_mau:n }); }
  if((m=path.match(/^\/ai\/phien-ban\/([^/]+)\/(duyet|tu-choi)$/)) && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin duyệt phiên bản mô hình'},403); const pb=await env.DB.prepare(`SELECT * FROM mo_hinh_phien_ban WHERE id=?`).bind(m[1]).first(); if(!pb) return json({error:'Không có phiên bản'},404); if(pb.trang_thai!=='CHO_DUYET') return json({error:'Phiên bản không chờ duyệt'},409);
    const q=m[2]==='duyet'?'DUYET':'TU_CHOI'; if(q==='TU_CHOI'&&!chuoi(body.ly_do)) return json({error:'Từ chối phải ghi lý do'},400); await env.DB.prepare(`UPDATE mo_hinh_phien_ban SET trang_thai=?, duyet_boi=?, duyet_at=?, ly_do=? WHERE id=?`).bind(q, me.ho_ten, nowISO(), chuoi(body.ly_do,300), pb.id).run();
    if(q==='DUYET'&&(pb.pham_vi||'chung')==='chung'){ const dg=docJSON(pb.danh_gia,{}); await env.DB.prepare(`UPDATE mo_hinh SET phien_ban=?, checkpoint_url=COALESCE(?,checkpoint_url), model_id=COALESCE(?,model_id), diem=?, so_mau=?, updated_at=? WHERE id=?`).bind(pb.phien_ban, pb.checkpoint_url||null, pb.model_id||null, so(dg.diem), so(pb.so_mau), nowISO(), pb.mo_hinh_id).run(); }   // ADR-012: bản riêng (dong:/muc_dich:) không đè bản chung — máy dựng tra /hub/mo-hinh/:tn?dong=
    await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE loai='DUYET_MO_HINH' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, pb.id).run(); await logAudit(env,me,q==='DUYET'?'duyệt phiên bản mô hình':'từ chối phiên bản mô hình','mo_hinh',pb.mo_hinh_id,pb.phien_ban+' · '+chuoi(body.ly_do,200)); await tinhDinhTuyen(env); return json({ db: await bootstrap(env,me) }); }
  // ===== ADR-008 — máy dựng ghép theo tài khoản =====
  if(path==='/may-ghep' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const ten=chuoi(body.ten,80)||('Máy của '+me.ho_ten); const id=uid('may'); const khoa='kmay_'+crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'').slice(0,8);
    await env.DB.prepare(`INSERT INTO may_ghep (id,ten,chu_user_id,chu_ten,khoa_hash,kha_nang,active,created_at) VALUES (?,?,?,?,?,?,1,?)`).bind(id, ten, me.id, me.ho_ten, await sha256Hex(khoa), JSON.stringify(['dung_video']), nowISO()).run();
    const goc=(env.APP_BASE_URL||url.origin).replace(/\/+$/,''); const ma='MAY1.'+b64url(JSON.stringify({ id:'content_os', ten:'Kingsmen Content OS', url:goc+'/api', khoa, may_id:id, may_ten:ten, kha_nang:['dung_video'] }));
    await logAudit(env,me,'ghép máy dựng','may_ghep',id,ten); return json({ ok:true, id, ma_ghep:ma, db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/may-ghep\/([^/]+)$/)) && method==='DELETE'){ const x=await env.DB.prepare(`SELECT * FROM may_ghep WHERE id=? AND active=1`).bind(m[1]).first(); if(!x) return json({error:'Không tìm thấy máy'},404); if(x.chu_user_id!==me.id&&me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ chủ máy hoặc Admin gỡ'},403);
    await env.DB.prepare(`UPDATE may_ghep SET active=0 WHERE id=?`).bind(x.id).run(); await env.DB.prepare(`UPDATE tram_lenh SET trang_thai='HONG', ket_qua='máy đã gỡ', xong_at=? WHERE may_id=? AND trang_thai IN ('CHO','DA_GUI')`).bind(nowISO(), x.id).run(); await logAudit(env,me,'gỡ máy dựng','may_ghep',x.id,x.ten); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/noi-dung\/([^/]+)\/loc$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(m[1]).first(); if(!nd||nd.dinh_dang!=='VIDEO') return json({error:'Chỉ lọc footage cho kịch bản VIDEO'},409);
    const so_ft=so((await env.DB.prepare(`SELECT COUNT(*) n FROM tai_san WHERE (muc_id=? OR noi_dung_id=?) AND loai='FOOTAGE' AND media_type='VIDEO' AND COALESCE(nguon,'')<>'MAY'`).bind(nd.muc_id, nd.id).first()||{}).n); if(!so_ft) return json({error:'Chưa có footage thô (video) gắn với thẻ'},409);
    const mayId=await mayChoViec(env,'mo_hinh'); if(!mayId) return json({error:'Không có máy ghép có mô hình đang bật (cần npm install trong máy con)'},409); const r=await taoLenhTram(env,'loc_footage',{noi_dung_id:nd.id}, me, mayId); await logAudit(env,me,'giao máy lọc footage','noi_dung',nd.id,so_ft+' footage'); return json({ db: await bootstrap(env,me), lenh_id:r.id, trung:!!r.trung, so_footage:so_ft }); }
  // ADR-010a — Chỉnh ghép: GET kế hoạch mới nhất; POST lưu kế hoạch người → mẫu học → dựng lại theo đúng kế hoạch
  if((m=path.match(/^\/noi-dung\/([^/]+)\/ghep$/)) && method==='GET'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const ds=(await env.DB.prepare(`SELECT * FROM ghep_video WHERE noi_dung_id=? ORDER BY created_at DESC LIMIT 10`).bind(m[1]).all()).results.map(g=>({...g, canh:docJSON(g.canh,[])})); return json({ ghep: ds }); }
  if((m=path.match(/^\/noi-dung\/([^/]+)\/ghep$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const nd=await env.DB.prepare(`SELECT n.*, m.giai_doan FROM noi_dung n LEFT JOIN muc_noi_dung m ON m.id=n.muc_id WHERE n.id=?`).bind(m[1]).first(); if(!nd) return json({error:'Không tìm thấy'},404); if(nd.dinh_dang!=='VIDEO'||nd.trang_thai!=='DUYET') return json({error:'Chỉ chỉnh ghép kịch bản VIDEO đã duyệt'},409);
    const canh=sachGhep(body.canh); if(!canh.length||canh.some(c=>!c.shots.length)) return json({error:'Mỗi cảnh cần ít nhất một shot (clip + giây vào/ra)'},400);
    const mayGp=await env.DB.prepare(`SELECT canh FROM ghep_video WHERE noi_dung_id=? AND nguon='MAY' ORDER BY created_at DESC LIMIT 1`).bind(nd.id).first();
    const gid=uid('gp'); await env.DB.prepare(`INSERT INTO ghep_video (id,noi_dung_id,nguon,canh,video_url,created_at,created_by_name) VALUES (?,?,'NGUOI',?,NULL,?,?)`).bind(gid, nd.id, JSON.stringify(canh), nowISO(), me.ho_ten).run();
    const soMau=await mauTuChinhGhep(env, nd, mayGp?docJSON(mayGp.canh,[]):null, canh);
    let lenh=null; if(body.dung!==false){ const c=await chonMayDung(env,{mayId:chuoi(body.may_id,40)||null, uuTienUserId:me.id}); if(c) lenh=await taoLenhTram(env,'dung_video',{noi_dung_id:nd.id, ghep_id:gid}, me, c.may.id); }
    await logAudit(env,me,'chỉnh ghép video','noi_dung',nd.id,canh.length+' cảnh · '+soMau+' mẫu học'); return json({ db: await bootstrap(env,me), ghep_id:gid, so_mau:soMau, lenh_id:lenh&&lenh.id, dung:!!lenh }); }
  // ADR-010d — kho video thành phẩm: nạp từ thư mục Drive hoặc thư mục trên máy dựng; máy con cắt shot, nghe lời, dò clip gốc
  // ADR-011 — Kalodata: Trưởng MKT đặt ngành hàng / top N / tự quét tuần; nút Quét ngay xin Trạm chạy việc kalodata_video
  if(path==='/kalodata' && method==='PUT'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const cfg=await docCauHinh(env); const nganh=(Array.isArray(body.nganh)?body.nganh:String(body.nganh||'').split(/[,;\n]/)).map(x=>chuoi(x,80).trim()).filter(Boolean).slice(0,8);
    const kd={...(cfg.kalodata||{}), nganh, top_n:Math.max(3,Math.min(50,so(body.top_n,10))), tu_dong:body.tu_dong!==false, dong:chuoi(body.dong,80)||null, muc_dich:MUC_DICH.includes(chuoi(body.muc_dich,10))?chuoi(body.muc_dich,10):'BAN_HANG', khu_vuc:chuoi(body.khu_vuc,5)||'VN', thoi_gian:['7','30','90'].includes(String(body.thoi_gian))?String(body.thoi_gian):'30'};
    await env.DB.prepare(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES ('kalodata',?,?,?) ON CONFLICT(id) DO UPDATE SET cau_hinh=excluded.cau_hinh, updated_at=excluded.updated_at, updated_by_name=excluded.updated_by_name`).bind(JSON.stringify(kd), nowISO(), me.ho_ten).run(); await logAudit(env,me,'cấu hình Kalodata','module_config','kalodata',nganh.join(', ')); return json({ db: await bootstrap(env,me) }); }
  if(path==='/kalodata/quet' && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const cfg=await docCauHinh(env); const kd=cfg.kalodata||{}; if(!(kd.nganh||[]).length) return json({error:'Đặt ít nhất một ngành hàng trước'},400);
    const tt=await docTramTrangThai(env); if(!tt||!tt.song) return json({error:'Trạm văn phòng đang im — Kalodata quét qua phiên đăng nhập trên Trạm'},409);
    await env.DB.prepare(`UPDATE module_config SET cau_hinh=? WHERE id='kalodata'`).bind(JSON.stringify({...kd, quet_ngay:true})).run(); const r=await taoLenhTram(env,'chay_agent',{id:'content_os', viec:'kalodata_video'}, me, 'tram'); await logAudit(env,me,'quét Kalodata','module_config','kalodata',(kd.nganh||[]).join(', ')); return json({ db: await bootstrap(env,me), lenh_id:r.id, trung:!!r.trung }); }
  // ADR-013 — nạp một ô: tự nhận Drive / thư mục máy / @kênh TikTok / ngành Kalodata, rồi chuyển cho tuyến tương ứng
  if(path==='/lop-hoc/nap' && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const t=String(body.nap||'').trim(); if(!t) return json({error:'Dán link thư mục Drive, đường dẫn thư mục trên máy dựng, @kênh TikTok hoặc tên ngành hàng Kalodata'},400);
    const laDrive=/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(t), laLocal=/^[A-Za-z]:[\\/]|^\//.test(t), laTikTok=/tiktok\.com\/@|^@[A-Za-z0-9_.]{2,}$/.test(t); const loai=laDrive?'DRIVE':laLocal?'LOCAL':laTikTok?'TIKTOK':'KALODATA';
    if(body.chi_nhan) return json({ loai, ten:loai==='KALODATA'?('ngành Kalodata “'+t+'”'):loai==='TIKTOK'?('kênh TikTok '+t):loai==='DRIVE'?'thư mục Drive':'thư mục trên máy dựng' });
    const goi=async(p,b,mt)=>handleApi(new Request(url.origin+'/api'+p,{method:mt||'POST', headers:request.headers, body:JSON.stringify(b)}), env);
    if(loai==='KALODATA'){ const cfg=(await docCauHinh(env)).kalodata||{}; const nganh=[...(cfg.nganh||[]).filter(x=>x!==t), t].slice(-8); let r=await goi('/kalodata',{nganh, top_n:cfg.top_n||10, tu_dong:cfg.tu_dong!==false, dong:body.dong||cfg.dong||undefined, muc_dich:body.muc_dich||'BAN_HANG'},'PUT'); if(!r.ok) return r; r=await goi('/kalodata/quet',{}); const j=await r.json().catch(()=>({})); return json({...j, loai, nganh:t}, r.status); }
    const r=await goi('/kho-thanh-pham/nap',{link:t, toi_da:so(body.toi_da,20)||20, nguon:loai==='TIKTOK'?'TIKTOK':undefined, dong:body.dong||undefined, muc_dich:body.muc_dich||undefined}); const j=await r.json().catch(()=>({})); return json({...j, loai}, r.status); }
  // bật kỹ năng: duyệt phiên bản chờ (nếu có) + gạt MỞ; điều kiện điểm lấy từ phiên bản đã duyệt (mo_hinh.diem bị tính lại theo bóng)
  if((m=path.match(/^\/lop-hoc\/(bat|tat)$/)) && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const tn=chuoi(body.tinh_nang,40); const dt=await env.DB.prepare(`SELECT * FROM dinh_tuyen WHERE tinh_nang=?`).bind(tn).first(); if(!dt) return json({error:'Không có tính năng'},404);
    if(m[1]==='tat'){ await env.DB.prepare(`UPDATE dinh_tuyen SET muc='API', updated_at=?, updated_by_name=? WHERE tinh_nang=?`).bind(nowISO(), me.ho_ten, tn).run(); await logAudit(env,me,'tắt máy nhà','dinh_tuyen',tn,'về AI ngoài'); return json({ db: await bootstrap(env,me) }); }
    const pbId=chuoi(body.phien_ban_id,40); if(pbId){ const pb=await env.DB.prepare(`SELECT * FROM mo_hinh_phien_ban WHERE id=? AND tinh_nang=?`).bind(pbId, tn).first(); if(!pb) return json({error:'Không có phiên bản'},404); if(pb.trang_thai==='CHO_DUYET'){ const r=await handleApi(new Request(url.origin+'/api/ai/phien-ban/'+pb.id+'/duyet',{method:'POST', headers:request.headers, body:'{}'}), env); if(!r.ok) return r; } }
    if(dt.loai==='NHIN'){ const pb=await env.DB.prepare(`SELECT danh_gia FROM mo_hinh_phien_ban WHERE tinh_nang=? AND trang_thai='DUYET' AND COALESCE(pham_vi,'chung')='chung' ORDER BY duyet_at DESC LIMIT 1`).bind(tn).first(); if(!pb) return json({error:'Chưa có bản nào đã duyệt để bật'},409); const dgp=docJSON(pb.danh_gia,{}); const diem=so(dgp.diem), truoc=so(dgp.diem_truoc); if(diem<so(dt.nguong,75)&&diem<truoc+5) return json({error:'Bản này chỉ khớp người '+diem+'/100 (quy tắc cũ '+truoc+'), chưa hơn quy tắc cũ đủ 5 điểm và dưới ngưỡng '+dt.nguong+' — chưa nên bật'},409); }   // 24/09: được bật khi đạt ngưỡng HOẶC hơn quy tắc cũ ≥ 5 điểm (bản ghép đầu tiên 60 vs 53 bị kẹt ở ngưỡng 75)
    else if(dt.loai==='TTS'){ if(!dt.mo_hinh_mo) return json({error:'Chưa gán giọng máy nhà'},422); }
    else if(!MO_NGON_NGU_HO_TRO.includes(tn)) return json({error:'Kỹ năng này chưa bật máy nhà được'},422); else { const mo=await docMoHinh(env, dt.mo_hinh_mo); if(!mo||!mo.phien_ban) return json({error:'Chưa có bản ngôn ngữ đã huấn luyện và duyệt'},409); }
    await env.DB.prepare(`UPDATE dinh_tuyen SET muc='MO', updated_at=?, updated_by_name=? WHERE tinh_nang=?`).bind(nowISO(), me.ho_ten, tn).run(); await tinhDinhTuyen(env); await logAudit(env,me,'bật máy nhà','dinh_tuyen',tn,pbId||''); return json({ db: await bootstrap(env,me) }); }
  if(path==='/lop-hoc/tu-hoc' && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const r=await tuHoc(env); return json({ db: await bootstrap(env,me), ...r }); }
  if((m=path.match(/^\/kho-thanh-pham\/([^/]+)$/)) && (method==='PATCH'||method==='DELETE')){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const tp=await env.DB.prepare(`SELECT id,ten FROM kho_thanh_pham WHERE id=?`).bind(m[1]).first(); if(!tp) return json({error:'Không có video này trong kho'},404);
    if(method==='DELETE'){ await MAU().xoaTheoDoiTuong(env, tp.id); await env.DB.prepare(`DELETE FROM mau_hoc_ai WHERE doi_tuong='kho_thanh_pham' AND doi_tuong_id=?`).bind(tp.id).run(); await env.DB.prepare(`DELETE FROM kho_thanh_pham WHERE id=?`).bind(tp.id).run(); await logAudit(env,me,'loại video khỏi kho thành phẩm','kho_thanh_pham',tp.id,tp.ten); return json({ db: await bootstrap(env,me) }); }
    const dong=body.dong===undefined?undefined:(chuoi(body.dong,80)||null), md=body.muc_dich===undefined?undefined:(MUC_DICH.includes(chuoi(body.muc_dich,10))?chuoi(body.muc_dich,10):null);
    if(dong!==undefined) await env.DB.prepare(`UPDATE kho_thanh_pham SET dong=? WHERE id=?`).bind(dong, tp.id).run(); if(md!==undefined) await env.DB.prepare(`UPDATE kho_thanh_pham SET muc_dich=? WHERE id=?`).bind(md, tp.id).run();
    const pv=await phamViCua(env,'kho_thanh_pham',tp.id); await env.DB.prepare(`UPDATE mau_hoc_ai SET dong=?, muc_dich=? WHERE doi_tuong='kho_thanh_pham' AND doi_tuong_id=?`).bind(pv.dong, pv.muc_dich, tp.id).run(); await logAudit(env,me,'gắn nhãn video kho thành phẩm','kho_thanh_pham',tp.id,(pv.dong||'chung')+' · '+(pv.muc_dich||'—')); return json({ db: await bootstrap(env,me) }); }
  if(path==='/kho-thanh-pham/tao-proxy' && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const r=await giaoProxy(env, me); if(!r.ok) return json({error:r.loi},409); await logAudit(env,me,'tạo bản xem video đã học','kho_thanh_pham','',r.so+' video'); return json(r); }
  if(path==='/kho-thanh-pham/nap' && method==='POST' && String(body.nguon||'').toUpperCase()==='TIKTOK'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403);
    const kenh=String(body.link||'').trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//,'').replace(/[?#].*$/,'').replace(/\/.*$/,'').replace(/^@?/,'@'); if(!/^@[A-Za-z0-9_.]{2,40}$/.test(kenh)) return json({error:'Nhập kênh TikTok dạng @tenkenh hoặc link tiktok.com/@tenkenh'},400);
    const tt=await docTramTrangThai(env); if(!tt||!tt.song) return json({error:'Trạm văn phòng đang im — TikTok tải qua phiên đăng nhập trên Trạm'},409);
    const cfg=await docCauHinh(env); const ds=((cfg.tai_tiktok||{}).hang||[]).filter(x=>x.kenh!==kenh); ds.push({kenh, toi_da:Math.max(1,Math.min(60,so(body.toi_da,20))), thu_muc:'D:\\may-dung\\thanh-pham\\tiktok\\'+kenh.slice(1), luc:nowISO(), boi:me.ho_ten, dong:chuoi(body.dong,80)||null, muc_dich:MUC_DICH.includes(chuoi(body.muc_dich,10))?chuoi(body.muc_dich,10):null});
    await env.DB.prepare(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES ('tai_tiktok',?,?,?) ON CONFLICT(id) DO UPDATE SET cau_hinh=excluded.cau_hinh, updated_at=excluded.updated_at`).bind(JSON.stringify({hang:ds.slice(-10)}), nowISO(), me.ho_ten).run();
    const r=await taoLenhTram(env,'chay_agent',{id:'content_os', viec:'tai_tiktok'}, me, 'tram'); await logAudit(env,me,'nạp kho thành phẩm TikTok','kho_thanh_pham',kenh,'tối đa '+ds[ds.length-1].toi_da);
    return json({ db: await bootstrap(env,me), lenh_id:r.id, trung:!!r.trung, kenh }); }
  if(path==='/kho-thanh-pham/nap' && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const lk=String(body.link||'').trim();
    const fm=lk.match(/folders\/([A-Za-z0-9_-]{10,})/); const local=!fm&&/^[A-Za-z]:[\\/]|^\//.test(lk); if(!fm&&!local) return json({error:'Dán link THƯ MỤC Drive, hoặc đường dẫn thư mục trên máy dựng (vd D:\\Video da dung)'},400);
    const mayId=await mayChoViec(env,'mo_hinh')||(await chonMayDung(env,{uuTienUserId:me.id})||{may:{}}).may.id; if(!mayId) return json({error:'Không có máy dựng/máy nhìn nào đang bật'},409);
    const r=await taoLenhTram(env,'hoc_thanh_pham',{nguon:fm?'DRIVE':'LOCAL', folder_id:fm?fm[1]:null, duong_dan:local?lk.slice(0,300):null, toi_da:Math.max(1,Math.min(60,so(body.toi_da,20))), dong:chuoi(body.dong,80)||null, muc_dich:MUC_DICH.includes(chuoi(body.muc_dich,10))?chuoi(body.muc_dich,10):null}, me, mayId);
    await logAudit(env,me,'nạp kho thành phẩm','kho_thanh_pham',fm?fm[1]:lk.slice(0,80),''); return json({ db: await bootstrap(env,me), lenh_id:r.id, trung:!!r.trung }); }
  // ADR-010b — phân tích lại footage đã có (nạp trước khi có phân tích đoạn / cỡ cảnh): lệnh phan_tich_footage {muc_id} cho máy dựng
  // ADR-018 — mọi đường nhãn (kho mẫu, hàng việc, ghi nhãn người có version, bộ nhãn) ở worker/mau.js
  { const r=await MAU().api(env, path, method, body, me, url); if(r) return r; }
  // ADR-017 — Bàn huấn luyện: sáu làn × dòng sản phẩm, mỗi ô có chặng + số đo + điều còn thiếu; nguồn lực (máy, thầy, người)
  if(path==='/ban-huan-luyen' && method==='GET'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); return json(await banHuanLuyen(env)); }
  // ===== KHO MẪU (25/09): mọi nhãn của mô hình mở, thầy, người — lọc theo kỹ năng / trạng thái / dòng / nguồn, sửa trực tiếp =====
  // ===== DÒNG SẢN PHẨM: xem dòng đang dùng ở đâu, đổi tên / gộp, luật nhận dòng từ tên thư mục =====
  if(path==='/dong-san-pham' && method==='GET'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); return json(await dsDongSanPham(env)); }
  if(path==='/dong-san-pham/doi-ten' && method==='POST'){ if(!canGat(me)) return json({error:'Chỉ Trưởng MKT/Admin'},403); const tu=chuoi(body.tu,80), sang=chuoi(body.sang,80); if(!tu||!sang||tu===sang) return json({error:'Cần tên cũ và tên mới khác nhau'},400);
    await MAU().dam(env); const n={}; for(const [bang,cot] of [['san_pham','dong'],['kho_thanh_pham','dong'],['mau_hoc_ai','dong'],['mau_doan','dong'],['bo_nhan','dong']]){ const r=await env.DB.prepare(`UPDATE ${bang} SET ${cot}=? WHERE ${cot}=?`).bind(sang,tu).run(); n[bang]=(r.meta&&r.meta.changes)||0; }
    const row=await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id='huan_luyen'`).first(); const hl={...((await docCauHinh(env)).huan_luyen||{}), ...(row?docJSON(row.cau_hinh,{}):{})}; const ax=(hl.anh_xa_dong||[]).map(x=>x.dong===tu?{...x, dong:sang}:x);
    const o=row?docJSON(row.cau_hinh,{}):{}; o.anh_xa_dong=ax; await env.DB.prepare(`INSERT OR REPLACE INTO module_config (id, cau_hinh, updated_at, updated_by_name) VALUES ('huan_luyen', ?, ?, ?)`).bind(JSON.stringify(o), nowISO(), me.ho_ten).run();
    await logAudit(env,me,'đổi tên dòng sản phẩm','dong',tu,tu+' → '+sang+' · '+JSON.stringify(n)); return json({ ok:true, doi:n, ...(await dsDongSanPham(env)) }); }
  // Dạy máy (25/09, chủ: "những gì cần hỏi người thì đẩy qua sub tab này") — đếm thẻ đang chờ người, nhẹ, gọi khi mở Bộ não AI
  // ADR-017 đợt B — K2: hàng đoạn footage để người quyết dùng/loại (gần ngưỡng trước, xen 1/4 ngẫu nhiên)
  // ADR-017 đợt B — K4: thầy đọc lời (nút) + hàng câu để người xác nhận
  // ADR-016 — hàng đợi gán nhãn vàng: đoạn máy chưa chắc trước, xen 1/4 đoạn ngẫu nhiên máy "chắc" (để đo độ chính xác không lệch)
  if((m=path.match(/^\/muc\/([^/]+)\/doc-khung$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const muc=await env.DB.prepare(`SELECT id FROM muc_noi_dung WHERE id=?`).bind(m[1]).first(); if(!muc) return json({error:'Không tìm thấy mục'},404);
    const mayId=await mayManhNhat(env,'mo_hinh'); if(!mayId) return json({error:'Chưa ghép máy có mô hình (Ollama + qwen2.5vl)'},409); const r=await taoLenhTram(env,'phan_tich_footage',{doc_khung:true, muc_id:muc.id, lai:!!body.lai}, me, mayId);
    await logAudit(env,me,'đọc từng giây footage','muc_noi_dung',muc.id,''); return json({ db: await bootstrap(env,me), lenh_id:r.id, trung:!!r.trung }); }
  if((m=path.match(/^\/muc\/([^/]+)\/phan-tich$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const muc=await env.DB.prepare(`SELECT id,tieu_de FROM muc_noi_dung WHERE id=?`).bind(m[1]).first(); if(!muc) return json({error:'Không tìm thấy mục'},404);
    const chua=so((await env.DB.prepare(`SELECT COUNT(*) n FROM tai_san WHERE muc_id=? AND loai='FOOTAGE' AND media_type='VIDEO' AND phan_tich IS NULL`).bind(muc.id).first()||{}).n); if(!chua) return json({error:'Footage của mục này đã phân tích hết'},409);
    const c=await chonMayDung(env,{mayId:chuoi(body.may_id,40)||null, uuTienUserId:me.id}); if(!c) return json({error:'Không có máy dựng nào đang bật để phân tích. Bật máy con (Hồ sơ › Máy dựng).'},409);
    const r=await taoLenhTram(env,'phan_tich_footage',{muc_id:muc.id}, me, c.may.id); if(!r.ok) return json({error:r.loi},409);
    await logAudit(env,me,'phân tích footage','muc_noi_dung',muc.id,chua+' clip · máy '+c.may.ten); return json({ db: await bootstrap(env,me), lenh_id:r.id, trung:!!r.trung, may_ten:c.may.ten, so_clip:chua }); }
  if((m=path.match(/^\/muc\/([^/]+)\/nap-drive$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const muc=await env.DB.prepare(`SELECT id,tieu_de FROM muc_noi_dung WHERE id=?`).bind(m[1]).first(); if(!muc) return json({error:'Không tìm thấy mục'},404);
    const lk=String(body.link||''); const fm=lk.match(/folders\/([A-Za-z0-9_-]{10,})/)||lk.match(/[?&]id=([A-Za-z0-9_-]{10,})/)||(/^[A-Za-z0-9_-]{20,}$/.test(lk.trim())?[0,lk.trim()]:null); if(!fm) return json({error:'Dán link THƯ MỤC Google Drive (dạng drive.google.com/drive/folders/…)'},400);
    const c=await chonMayDung(env,{mayId:chuoi(body.may_id,40)||null, uuTienUserId:me.id}); if(!c) return json({error:'Không có máy dựng nào đang bật để tải footage. Bật máy con (Hồ sơ › Máy dựng).'},409);
    const toiDa=Math.max(1,Math.min(40,so(body.toi_da,8))); const r=await taoLenhTram(env,'nap_drive',{muc_id:muc.id, folder_id:fm[1], toi_da:toiDa}, me, c.may.id); if(!r.ok) return json({error:r.loi},409);
    await logAudit(env,me,'nạp footage từ Drive','muc_noi_dung',muc.id,fm[1]+' · tối đa '+toiDa+' · máy '+c.may.ten); return json({ db: await bootstrap(env,me), lenh_id:r.id, trung:!!r.trung, may_ten:c.may.ten, toi_da:toiDa }); }
  if((m=path.match(/^\/noi-dung\/([^/]+)\/dung$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const nd=await env.DB.prepare(`SELECT n.*, m.giai_doan FROM noi_dung n LEFT JOIN muc_noi_dung m ON m.id=n.muc_id WHERE n.id=?`).bind(m[1]).first(); if(!nd) return json({error:'Không tìm thấy'},404); if(nd.dinh_dang!=='VIDEO'||nd.trang_thai!=='DUYET') return json({error:'Chỉ dựng kịch bản VIDEO đã duyệt (G3)'},409);
    const r=await giaoDung(env, nd, {mayId:chuoi(body.may_id,40)||null, uuTienUserId:me.id, tacNhan:me}); if(!r.ok) return json({error:r.loi},409); return json({ db: await bootstrap(env,me), lenh_id:r.id, may_ten:r.may_ten, may_id:r.may_id, trung:r.trung, ly_do:r.ly_do }); }
  // ADR-004 — Trạm: tạo khoá & mã ghép (Admin), xếp lệnh (staff)
  if(path==='/tram/khoa' && method==='POST'){ if(me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin tạo khoá Trạm'},403);
    const khoa='kcos_'+crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'').slice(0,8); await datCauHinh(env,'tram',{khoa, bat:true}, me.ho_ten);
    const goc=(env.APP_BASE_URL||url.origin).replace(/\/+$/,''); const ma='HUB1.'+btoa(JSON.stringify({ id:'content_os', ten:'Kingsmen Content OS', url:goc+'/api', khoa, mon:['content_os.*','doi_thu.*','tiktok_cn.binh_luan'], nhan_lenh:true })).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await logAudit(env,me,'tạo khoá Trạm','tram','','khoá mới — khoá cũ hết hiệu lực'); return json({ ok:true, ma_ghep:ma, khoa_duoi:khoa.slice(-4), db: await bootstrap(env,me) }); }
  if(path==='/tram/lenh' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const r=await taoLenhTram(env, String(body.viec||''), body.tham_so||{}, me); if(!r.ok) return json({error:r.loi},400);
    await logAudit(env,me,'xếp lệnh cho Trạm','tram_lenh',r.id,String(body.viec)+' '+JSON.stringify(body.tham_so||{}).slice(0,150)); return json({ ok:true, id:r.id, trung:!!r.trung, db: await bootstrap(env,me) }); }
  // Đổi giai đoạn tay (lùi/tiến) — có audit
  if((m=path.match(/^\/muc\/([^/]+)\/giai-doan$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); if(!GIAI_DOAN.includes(body.giai_doan)) return json({error:'Giai đoạn không hợp lệ'},400); await datGiaiDoan(env, m[1], body.giai_doan, 'đổi tay: '+chuoi(body.ly_do,200), me); return json({ db: await bootstrap(env,me) }); }
  // --- mô phỏng (Admin): nạp / xoá dữ liệu giả có tiền tố mp_ ---
  if(path==='/mo-phong/nap' && method==='POST'){
    if(me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin'},403);
    await napMoPhong(env, me); return json({ ok:true, db: await bootstrap(env,me) });
  }
  if(path==='/mo-phong/xoa' && method==='POST'){
    if(me.vai_tro!==ROLES.ADMIN) return json({error:'Chỉ Admin'},403);
    await xoaMoPhong(env, me); return json({ ok:true, db: await bootstrap(env,me) });
  }
  return json({error:'Không có đường dẫn '+method+' '+path},404);
}
async function datCauHinh(env, key, patch, boi){
  const cu=await env.DB.prepare(`SELECT cau_hinh FROM module_config WHERE id=?`).bind(key).first(); const moi={...docJSON(cu&&cu.cau_hinh,{}), ...patch};
  if(cu) await env.DB.prepare(`UPDATE module_config SET cau_hinh=?, updated_at=?, updated_by_name=? WHERE id=?`).bind(JSON.stringify(moi),nowISO(),boi,key).run();
  else await env.DB.prepare(`INSERT INTO module_config (id,cau_hinh,updated_at,updated_by_name) VALUES (?,?,?,?)`).bind(key,JSON.stringify(moi),nowISO(),boi).run();
}
async function napMoPhong(env, me){
  await xoaMoPhong(env, null);
  const t=nowISO(); const ins=async(bang,cols,rows)=>{ for(const r of rows) await env.DB.prepare(`INSERT INTO ${bang} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).bind(...r).run(); };
  await ins('pillars',['id','ten','mo_ta','ty_trong','thu_tu','muc_tieu','active','created_at'],[['mp_p1','Branding','Thương hiệu, cam kết, bảo hành',40,1,'BRAND',1,t],['mp_p2','Information','Kiến thức, thông số, so sánh',30,2,'BRAND',1,t],['mp_p3','Problems','Vấn đề thực tế của ron gạch → giải pháp',20,3,'BAN_HANG',1,t],['mp_p4','Interaction','Hỏi đáp, minigame, KOC',10,4,'BRAND',1,t]]);
  // ADR-002: ý tưởng máy gom + kế hoạch tháng này (đề xuất) + vài mục
  const hn=ngayVN();
  await ins('y_tuong',['id','nguon','ten','mo_ta','link','pillar_id','dinh_dang','muc_tieu','diem_may','ly_do_may','rui_ro','trang_thai','ngay','created_at'],[
    ['mp_y1','GOOGLE_TRENDS','Mùa mưa 2026: ron gạch ố mốc sau 1 mùa','Nhiều nhà mới hoàn thiện than ron ố vàng sau mùa mưa đầu','','mp_p3','VIDEO','BAN_HANG',82,'Đúng nỗi đau khách, có thông số bền màu để nói, không cần nói quá','','MOI',hn,t],
    ['mp_y2','YOUTUBE','So sánh keo ron epoxy vs polyurea','Video so sánh vật liệu đang lên top','https://www.youtube.com/watch?v=mp2','mp_p2','CAROUSEL','BRAND',64,'Hợp pillar Information; cần dữ liệu so sánh thật, tránh chê đối thủ','','MOI',hn,t],
    ['mp_y3','GOOGLE_TRENDS','Giảm giá sốc cuối năm','','','',null,'BRAND',12,'Buộc nói về giá — bảng giá đổi theo đợt, bài đăng sống mãi','claim','MOI',hn,t]]);
  const thangNay=thangHienTai(); const dx=await deXuatKeHoach(env, thangNay, 24);
  await env.DB.prepare(`INSERT OR REPLACE INTO ke_hoach_thang (thang,trang_thai,chi_tieu,dinh_huong,nguon,ly_do,de_xuat,de_xuat_at,updated_at,updated_by_name) VALUES (?,'DE_XUAT',?,?,'DE_XUAT',?,?,?,?,'(mô phỏng)')`).bind(thangNay, JSON.stringify(dx.chi_tieu), '(mô phỏng) Đẩy G7000 mùa mưa · 2 video review KOC · giữ nhịp 6 bài/tuần', JSON.stringify(dx.ly_do), JSON.stringify(dx.chi_tieu), t, t).run();
  await ins('muc_noi_dung',['id','thang','tuan','ngay_dang','tieu_de','muc_tieu','pillar_id','kenh_id','dinh_dang','giai_doan','tao_boi','created_at','created_by_name','updated_at'],[
    ['mp_m1',thangNay,1,null,'G7000 giữ màu 30 năm — vì sao?','BRAND','mp_p2','mp_k1','POST','SOAN','NGUOI',t,'Ngọc (mô phỏng)',t],
    ['mp_m2',thangNay,2,null,'Ron gạch ố mốc sau mùa mưa — cách nhận biết','BAN_HANG','mp_p3','mp_k3','VIDEO','Y_TUONG','AGENT',t,'Máy (mô phỏng)',t],
    ['mp_m3',thangNay,2,null,'Review KOC: hồ bơi G9000 sau 2 năm','BRAND','mp_p1','mp_k2','VIDEO','CHO_DUYET','NGUOI',t,'Ngọc (mô phỏng)',t]]);
  // ADR-003: nội dung mẫu + một bài chờ duyệt (máy chấm sẵn)
  const secs=JSON.stringify([{label:'Đoạn 1',text:'G7000 dùng gốc polyurea cao cấp, tăng 50% hoạt chất chống UV so với dòng G6000.',hinh:''},{label:'Đoạn 2',text:'Thông số theo hồ sơ: giữ màu 30 năm, dùng được trong nhà và ngoài trời.',hinh:''}]);
  await ins('noi_dung',['id','muc_id','dinh_dang','phien_ban','tieu_de','hook','sections','cta','chi_tiet','trang_thai','tao_boi','created_at','created_by','created_by_name','updated_at'],[
    ['mp_n1','mp_m1','POST',1,'G7000 giữ màu 30 năm — vì sao?','Sau một mùa mưa, ron gạch ngoài ban công nhà bạn có đang ngả vàng?',secs,'Inbox để nhận bảng màu và tư vấn hạng keo đúng khu vực.','{"hashtag":"#kingsmen #keorongach"}','NHAP','NGUOI',t,'','Ngọc (mô phỏng)',t],
    ['mp_n3','mp_m3','VIDEO',1,'Review KOC: hồ bơi G9000 sau 2 năm','2 năm ngâm nước hồ bơi — ron gạch G9000 giờ ra sao?',JSON.stringify([{label:'Cảnh 1',text:'Cận mép hồ, ron còn nguyên màu.',hinh:'cận cảnh'},{label:'Cảnh 2',text:'KOC kể lại lúc thi công.',hinh:'trung cảnh'}]),'Xem thêm công trình thật tại fanpage.','{}','CHO_DUYET','NGUOI',t,'','Ngọc (mô phỏng)',t]]);
  await ins('duyet',['id','doi_tuong','doi_tuong_id','cong','trang_thai','nguoi_gui_id','nguoi_gui_ten','cham_may','created_at'],[['mp_d1','noi_dung','mp_n3','G3','CHO','','Ngọc (mô phỏng)',JSON.stringify({diem:86,ly_do:['Có cảnh chưa ghi gợi ý hình'],loi_cung:[],nen_duyet:true}),t]]);
  await ins('frameworks',['id','ten','mo_ta','pillar_id','active','created_at'],[['mp_f1','Vấn đề → nguyên nhân → giải pháp','Mở bằng vết ố/nứt thật, giải thích, chốt bằng sản phẩm đúng hạng','mp_p3',1,t],['mp_f2','So sánh 2 lựa chọn','Epoxy vs polyurea, trong nhà vs ngoài trời','mp_p2',1,t],['mp_f3','Review sau N năm','KOC/công trình thật sau thời gian dùng','mp_p1',1,t],['mp_f4','Hỏi nhanh đáp gọn','1 câu hỏi thợ hay hỏi, trả lời trong 20 giây','mp_p4',1,t]]);
  const ts=a=>JSON.stringify(a);
  await ins('san_pham',['id','ma','ten','dong','mo_ta','thong_so','tieu_chuan','bao_hanh','huong_dan','active','created_at'],[
    ['mp_s1','G3000','Kingsmen G3000 (Tiêu chuẩn)','Kingsmen grout','',ts([{k:'Phân hạng',v:'Tiêu chuẩn'},{k:'Phạm vi sử dụng',v:'Trong nhà'}]),'','1 năm chống ố vàng · 30 năm chống thấm','',1,t],
    ['mp_s2','G5000','Kingsmen G5000 (Cao cấp)','Kingsmen grout','',ts([{k:'Phân hạng',v:'Cao cấp'},{k:'Phạm vi sử dụng',v:'Trong nhà'},{k:'Bám dính',v:'Mạnh hơn 50%'}]),'','3 năm chống ố vàng · 30 năm chống thấm','',1,t],
    ['mp_s3','G6000','Kingsmen G6000 (Chống UV)','Kingsmen grout','',ts([{k:'Gốc hoá học',v:'Polyurea'},{k:'Phạm vi sử dụng',v:'Trong nhà và ngoài trời'}]),'','10 năm chống ố vàng · 30 năm chống thấm','',1,t],
    ['mp_s4','G7000','Kingsmen G7000 (Chống UV Plus)','Kingsmen grout','',ts([{k:'Gốc hoá học',v:'Polyurea cao cấp'},{k:'Chống UV',v:'Tăng 50% hoạt chất'},{k:'Giữ màu',v:'30 năm'}]),'','30 năm chống ố vàng · 30 năm chống thấm','',1,t]]);
  await ins('claim_cam',['id','cum_tu','muc_do','ly_do','active','created_at'],[['mp_c1','tốt nhất thị trường','CHAN','Không có số liệu so sánh độc lập',1,t],['mp_c2','vĩnh viễn','CHAN','Bảo hành có thời hạn, không hứa vĩnh viễn',1,t],['mp_c3','rẻ nhất','CANH_BAO','Giá đổi theo đợt, bài đăng sống mãi',1,t]]);
  await ins('kenh',['id','ten','loai','api_ma','api_object_id','cach_dang','active','created_at'],[['mp_k1','Fanpage Kingsmen','FANPAGE','KINGSMEN','','API',1,t],['mp_k2','YouTube Kingsmen','YOUTUBE','','','TAY',1,t],['mp_k3','TikTok Kingsmen','TIKTOK','','','N8N',1,t]]);
  // mẫu học giả: B1 45 mẫu ~0.86 (đủ gạt), B4 18 mẫu ~0.62, B5 30 mẫu ~0.9 (đủ), B9 12 mẫu ~0.7
  const mau=[['B1',45,0.86],['B4',18,0.62],['B5',30,0.9],['B9',12,0.7]]; let i=0;
  for(const [b,n,g] of mau) for(let k=0;k<n;k++){ i++; await env.DB.prepare(`INSERT INTO mau_hoc (id,buoc,ngay,doi_tuong_id,dau_vao,dau_ra_nguoi,dau_ra_may,giong,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind('mp_m'+i, b, ngayVN(Date.now()-k*864e5), 'mp_x'+k, '{}', '{}', '{}', Math.max(0,Math.min(1,g+((k%5)-2)*0.03)), new Date(Date.now()-k*864e5).toISOString()).run(); }
  for(const b of BUOC) await tinhSanSang(env,b.ma);
  await env.DB.prepare(`INSERT INTO agent_run (id,agent,buoc,ngay,at,ok,thu,tom_tat,doc,ghi,ms,chi_tiet) VALUES (?,?,?,?,?,1,0,?,?,?,120,'{}')`).bind('mp_r1','TINH_SAN_SANG',null,ngayVN(),nowISO(),'Đã chấm 4 bước có mẫu: B1=86/100 (45 mẫu), B4=62/100 (18 mẫu), B5=90/100 (30 mẫu), B9=70/100 (12 mẫu)',105,12).run();
  await env.DB.prepare(`INSERT INTO agent_run (id,agent,buoc,ngay,at,ok,thu,tom_tat,doc,ghi,ms,chi_tiet) VALUES (?,?,?,?,?,1,0,?,?,?,80,'{}')`).bind('mp_r2','GOM_TREND','B1',ngayVN(),nowISO(),'(mô phỏng đợt 2) Gom 14 trend, AI chấm 14, 3 chờ người, 1 máy bỏ vì rủi ro claim',14,4).run();
  await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,'MO',?,?,?)`).bind('mp_v1','DUNG_VIDEO','Dựng video "Thi công ron gạch ngoài trời — 3 bước"','KY_THUAT',ngayVN(Date.now()+2*864e5),'Máy (mô phỏng)','Kịch bản đã duyệt 06/10, gói dựng + footage gợi ý sẵn trong thẻ',nowISO()).run();
  await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,'MO',?,?,?)`).bind('mp_v2','DANG_TAY','Đăng tay YouTube: "Review KOC hồ bơi G9000"','MARKETING',ngayVN(),'Máy (mô phỏng)','Kênh YouTube đang ở cách đăng TAY',nowISO()).run();
  await env.DB.prepare(`INSERT INTO cong_viec (id,loai,tieu_de,giao_cho_vai_tro,han,trang_thai,tao_boi,ly_do,created_at) VALUES (?,?,?,?,?,'MO',?,?,?)`).bind('mp_v3','TOKEN','Cắm lại token Fanpage Kingsmen (secret TOKEN_KINGSMEN)','ADMIN',ngayVN(Date.now()-864e5),'Máy (mô phỏng)','Graph API trả lỗi OAuth từ 05/10 — máy không bịa số, đo lường đang dừng',nowISO()).run();
  await env.DB.prepare(`UPDATE chien_luoc SET dinh_vi=CASE WHEN COALESCE(dinh_vi,'')='' THEN ? ELSE dinh_vi END, tong_giong=CASE WHEN COALESCE(tong_giong,'')='' THEN ? ELSE tong_giong END, doi_tuong=CASE WHEN COALESCE(doi_tuong,'')='' THEN ? ELSE doi_tuong END WHERE id=1`)
    .bind('(mô phỏng) Kingsmen — keo ron gạch gốc polyurea, giữ màu và chống thấm dài hạn cho công trình hoàn thiện cao cấp.','(mô phỏng) Chuyên gia thi công, chắc chắn, nói bằng thông số và bảo hành, không hô hào.','(mô phỏng) Nhà thầu hoàn thiện, thợ ốp lát, chủ nhà đang xây/sửa.').run();
  await datCauHinh(env,'mo_phong',{bat:true}, (me&&me.ho_ten)||'Admin');
  if(me) await logAudit(env,me,'nạp mô phỏng','mo_phong','','');
}
async function xoaMoPhong(env, me){
  for(const b of ['pillars','frameworks','san_pham','claim_cam','kenh','mau_hoc','agent_run','cong_viec','muc_noi_dung','y_tuong','noi_dung','noi_dung_phien_ban','duyet','tai_san','bai_dang']) await env.DB.prepare(`DELETE FROM ${b} WHERE id LIKE 'mp_%'`).run();
  await env.DB.prepare(`DELETE FROM ke_hoach_thang WHERE updated_by_name='(mô phỏng)'`).run();
  await env.DB.prepare(`UPDATE chien_luoc SET dinh_vi=CASE WHEN dinh_vi LIKE '(mô phỏng)%' THEN '' ELSE dinh_vi END, tong_giong=CASE WHEN tong_giong LIKE '(mô phỏng)%' THEN '' ELSE tong_giong END, doi_tuong=CASE WHEN doi_tuong LIKE '(mô phỏng)%' THEN '' ELSE doi_tuong END WHERE id=1`).run();
  for(const b of BUOC) await tinhSanSang(env,b.ma);
  await datCauHinh(env,'mo_phong',{bat:false}, (me&&me.ho_ten)||'Admin');
  if(me) await logAudit(env,me,'xoá mô phỏng','mo_phong','','');
}

export default {
  async scheduled(controller, env, ctx){ ctx.waitUntil((async()=>{ const e=await napKhoa(env); await dieuPhoi(e); await tuHoc(e).catch(()=>{}); await thayDocLoi(e, 40).catch(()=>{}); await tuGiaoProxy(e).catch(()=>{}); await MAU().thayDocBu(e, 16).catch(()=>{}); await MAU().chuanHoaBuoc(e, 60).catch(()=>{}); })().catch(()=>{})); },
  async fetch(request, env, ctx){
    const url=new URL(request.url);
    env=await napKhoa(env);   // khoá dán ở app phủ lên env (secret Cloudflare vẫn ưu tiên)
    if(url.pathname.startsWith('/api/')){
      if(request.method==='OPTIONS') return new Response(null,{status:204, headers:CORS});
      try{ return await handleApi(request, env); }catch(e){ return json({error:'Lỗi server: '+(e.message||e)},500); }
    }
    if(url.pathname.startsWith('/media/') && env.MEDIA){
      const coRange=!!request.headers.get('range'); const obj=await env.MEDIA.get(url.pathname.slice(7), coRange?{ range:request.headers }:undefined); if(!obj) return new Response('Not found',{status:404});
      const h={ 'content-type':(obj.httpMetadata&&obj.httpMetadata.contentType)||'application/octet-stream', 'cache-control':'public, max-age=31536000, immutable', 'accept-ranges':'bytes' };   /* 25/09: trả 206 theo Range → trình duyệt tua được giữa video (xem đúng đoạn mẫu) */
      if(coRange&&obj.range&&obj.size!=null){ const r=obj.range; const off=r.offset!=null?r.offset:(r.suffix!=null?obj.size-r.suffix:0); const len=r.length!=null?r.length:obj.size-off; return new Response(obj.body,{ status:206, headers:{ ...h, 'content-range':'bytes '+off+'-'+(off+len-1)+'/'+obj.size, 'content-length':String(len) } }); }
      if(obj.size!=null) h['content-length']=String(obj.size); return new Response(obj.body,{ headers:h });
    }
    // SPA: đường dẫn không có phần mở rộng → index.html
    if(env.ASSETS){ const r=await env.ASSETS.fetch(request); if(r.status!==404 || /\.[a-z0-9]+$/i.test(url.pathname)) return r;
      return env.ASSETS.fetch(new Request(new URL('/index.html', url).toString(), request)); }
    return new Response('Kingsmen Content OS', {status:200});
  },
};
