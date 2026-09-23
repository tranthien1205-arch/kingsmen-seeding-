// ============================================================
//  KINGSMEN CONTENT OS — Worker (API + D1 + cron agent điều phối) + web tĩnh dist/
//  Hồ sơ nền: ../docs/CONTENT_OS_V2_BAN_VE.md · Sổ ADR: docs/SO_ADR.md
//  ADR-001: nền + bộ quyền thực hiện 12 bước + agent điều phối + màn Máy + danh mục gốc
// ============================================================

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
];
const BUOC_MAP = Object.fromEntries(BUOC.map(b=>[b.ma,b]));

// ---------- cấu hình module (mặc định; module_config ghi đè) ----------
const AI_MODEL_MAC_DINH='claude-sonnet-4-5';
const CONFIG_MAC_DINH = {
  // nguong_san_sang & min_mau: điều kiện để gạt một bước lên AI TỰ LÀM (Thiện chốt 80/100 & ≥30 mẫu)
  may:   { nguong_san_sang:80, min_mau:30, gio_chay:6 },
  // Chi phí AI: gia = USD / 1 triệu token. ngan_sach_thang_usd=0 → không giới hạn. ngan_sach_hoc_pct: phần dành cho bản nháp bóng (chế độ học)
  ai:    { ngan_sach_thang_usd:0, ngan_sach_hoc_pct:20, canh_bao_pct:80, chan_khi_vuot:true, ty_gia_vnd:26000,
           gia:{ 'claude-sonnet-4-5':{vao:3,ra:15}, 'claude-haiku-4-5-20251001':{vao:1,ra:5}, 'claude-opus-4-1':{vao:15,ra:75} } },
  duyet: { chan_tu_duyet:true },
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
    // bai_dang.trang_thai: CHUAN_BI | DA_LEN_LICH | DA_DANG | LOI. cach: TAY | API | N8N
    `CREATE TABLE IF NOT EXISTS bai_dang (id TEXT PRIMARY KEY, noi_dung_id TEXT, muc_id TEXT, kenh_id TEXT, gio_dang TEXT, cach TEXT, noi_dung_dang TEXT, media_url TEXT, link TEXT, trang_thai TEXT DEFAULT 'CHUAN_BI', loi TEXT, lan_thu INTEGER DEFAULT 0, posted_at TEXT, created_at TEXT, created_by_name TEXT, updated_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_bai_dang_tt ON bai_dang(trang_thai, gio_dang)`,
    // ADR-004 — Trạm: hàng đợi lệnh (Trạm hỏi 20 giây/lần), trạng thái nhịp tim, lô dữ liệu Trạm đẩy về
    `CREATE TABLE IF NOT EXISTS tram_lenh (id TEXT PRIMARY KEY, viec TEXT, tham_so TEXT, trang_thai TEXT DEFAULT 'CHO', ket_qua TEXT, tao_boi TEXT, created_at TEXT, gui_at TEXT, xong_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS tram_trang_thai (id TEXT PRIMARY KEY, than TEXT, nhan_luc TEXT)`,
    `CREATE TABLE IF NOT EXISTS tram_lo (id TEXT PRIMARY KEY, viec TEXT, bang TEXT, luot TEXT, phan TEXT, so_dong INTEGER, xu_ly TEXT, created_at TEXT)`,
  );
  for(const s of q) await env.DB.prepare(s).run();
  // pillar phục vụ mục tiêu nào → chỉ tiêu tháng & KPI đo theo đó
  try{ await env.DB.prepare(`ALTER TABLE pillars ADD COLUMN muc_tieu TEXT DEFAULT 'BRAND'`).run(); }catch(e){}
  await seedNeuTrong(env);
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
  try{ await env.DB.prepare(`INSERT INTO ai_usage (id,at,thang,provider,model,tinh_nang,user_id,user_name,tokens_vao,tokens_ra,chi_phi_usd,ok,ms,loi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid('ai'), nowISO(), thangHienTai(), o.provider||'anthropic', o.model||'', chuoi(o.tinh_nang||'khac',40), (o.me&&o.me.id)||null, (o.me&&o.me.ho_ten)||'Agent', so(o.tokens_vao), so(o.tokens_ra), tinhChiPhiAI(cfg,o.model,o.tokens_vao,o.tokens_ra), bool(o.ok!==false), so(o.ms), o.loi?chuoi(o.loi,300):null).run(); }catch(e){}
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
async function goiAI(env, {system, messages, max_tokens=4000, tinh_nang='khac', me=null}){
  const key=env.ANTHROPIC_API_KEY; if(!key) return {ok:false, thieu_key:true, loi:'Chưa cắm ANTHROPIC_API_KEY'};
  const ns=await kiemNganSachAI(env,{hoc:/^hoc_/.test(tinh_nang)}); if(!ns.ok) return ns;
  const model=env.ANTHROPIC_MODEL||AI_MODEL_MAC_DINH; const t0=Date.now();
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{ method:'POST', headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' }, body: JSON.stringify({ model, max_tokens, system, messages }) });
    const j=await res.json().catch(()=>({})); const u=j.usage||{};
    if(!res.ok){ const loi='AI trả lỗi: '+((j.error&&j.error.message)||('HTTP '+res.status)); await ghiAIUsage(env,{model,tinh_nang,me,tokens_vao:u.input_tokens,tokens_ra:u.output_tokens,ok:false,ms:Date.now()-t0,loi}); return {ok:false, loi}; }
    await ghiAIUsage(env,{model,tinh_nang,me,tokens_vao:u.input_tokens,tokens_ra:u.output_tokens,ok:true,ms:Date.now()-t0});
    return {ok:true, text:(j.content||[]).map(c=>c.text||'').join(''), usage:u, model};
  }catch(e){ await ghiAIUsage(env,{model,tinh_nang,me,ok:false,ms:Date.now()-t0,loi:e.message}); return {ok:false, loi:'Không gọi được AI: '+e.message}; }
}

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
// Điểm sẵn sàng = trung bình "giống" của 60 mẫu gần nhất (0..100); so_mau = tổng mẫu có bản nháp bóng
async function tinhSanSang(env, ma){
  const rows=(await env.DB.prepare(`SELECT giong FROM mau_hoc WHERE buoc=? AND giong IS NOT NULL ORDER BY created_at DESC LIMIT 60`).bind(ma).all()).results;
  const tong=(await env.DB.prepare(`SELECT COUNT(*) n FROM mau_hoc WHERE buoc=? AND giong IS NOT NULL`).bind(ma).first())||{n:0};
  const ss=rows.length? Math.round(rows.reduce((s,r)=>s+Math.max(0,Math.min(1,so(r.giong))),0)/rows.length*100) : 0;
  await env.DB.prepare(`UPDATE buoc_thuc_hien SET san_sang=?, so_mau=? WHERE buoc=?`).bind(ss, so(tong.n), ma).run();
  return {buoc:ma, san_sang:ss, so_mau:so(tong.n)};
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
    ket_qua:{ tiep_can:so0((o.ket_qua||{}).tiep_can), luot_xem:so0((o.ket_qua||{}).luot_xem), chia_se:so0((o.ket_qua||{}).chia_se), tuong_tac:so0((o.ket_qua||{}).tuong_tac), so_don:so0((o.ket_qua||{}).so_don) } };
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
  return { chi_tieu:lamSachChiTieu({tong_bai:tong, theo_pillar, theo_dinh_dang, theo_kenh, theo_muc_tieu, ket_qua}), ly_do, tu_thang:truoc };
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
async function chamYTuongAI(env, yt){
  if(!env.ANTHROPIC_API_KEY) return null;
  const pillars=(await env.DB.prepare(`SELECT id,ten,mo_ta,muc_tieu FROM pillars WHERE active=1`).all()).results;
  const claims=(await env.DB.prepare(`SELECT cum_tu FROM claim_cam WHERE active=1`).all()).results.map(c=>c.cum_tu);
  const cl=await env.DB.prepare(`SELECT * FROM chien_luoc WHERE id=1`).first()||{};
  const sys='Bạn là trưởng phòng marketing của thương hiệu keo ron gạch Kingsmen. Chấm một ý tưởng/trend có đáng làm nội dung không. CHỈ trả JSON: {"diem":0-100,"pillar_id":"<id hoặc null>","dinh_dang":"VIDEO|POST|ANH|CAROUSEL","muc_tieu":"BRAND|BAN_HANG","rui_ro_claim":true|false,"ly_do":"<1-2 câu>"}. Điểm cao khi: liên quan ngành vật liệu/thi công/nhà ở, hợp định vị, làm được với thông số thật. rui_ro_claim=true nếu để khai thác phải nói quá (giá, "tốt nhất", vĩnh viễn…).';
  const usr='ĐỊNH VỊ: '+(cl.dinh_vi||'(chưa)')+'\nĐỐI TƯỢNG: '+(cl.doi_tuong||'(chưa)')+'\nPILLAR: '+JSON.stringify(pillars)+'\nCỤM CẤM: '+JSON.stringify(claims)+'\nÝ TƯỞNG: '+yt.ten+'\nMÔ TẢ: '+(yt.mo_ta||'')+'\nNGUỒN: '+yt.nguon;
  const r=await goiAI(env,{system:sys, messages:[{role:'user',content:usr}], max_tokens:300, tinh_nang:'cham_y_tuong'}); if(!r.ok) return null;
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
    const id=uid('yt'); const ch=await chamYTuongAI(env,{ten,mo_ta,nguon:x.nguon}); if(ch) cham++;
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
  const usr='MỤC TIÊU BÀI: '+(b.muc_tieu==='BAN_HANG'?'BÁN HÀNG (dẫn tới hỏi mua/inbox, nói rõ sản phẩm & lợi ích thật)':'XÂY DỰNG BRAND (để được xem, chia sẻ, nhớ tên; không ép mua)')+'\nPILLAR: '+(pl?(pl.ten+(pl.mo_ta?(' — '+pl.mo_ta):'')):'(chưa)')+'\nFRAMEWORK: '+(fw?(fw.ten+(fw.mo_ta?(' — '+fw.mo_ta):'')):'(tự chọn cấu trúc)')+'\nSẢN PHẨM: '+(sp?sp.ten:'(chưa chọn)')+'\nTHÔNG SỐ THẬT (chỉ được dùng những cái này): '+(sp?JSON.stringify(docJSON(sp.thong_so,[])):'(chưa có)')+'\nTIÊU CHUẨN: '+((sp&&sp.tieu_chuan)||'(chưa có)')+'\nBẢO HÀNH (trích nguyên văn được): '+((sp&&sp.bao_hanh)||'(chưa có)')+'\nHƯỚNG DẪN DÙNG: '+((sp&&sp.huong_dan)||'(chưa có)')+'\nKÊNH: '+(kn?(kn.ten+' ('+kn.loai+')'):'(chưa chọn)')+'\nĐỊNH VỊ: '+(cl.dinh_vi||'(chưa đặt)')+'\nTÔNG GIỌNG: '+(cl.tong_giong||'(chưa đặt)')+'\nĐỐI TƯỢNG: '+(cl.doi_tuong||'(chưa đặt)')+'\nCỤM TỪ CẤM: '+JSON.stringify(claims.map(c=>c.cum_tu))+(viDu.length?('\nVÍ DỤ ĐÃ ĐƯỢC DUYỆT (học giọng, không chép):\n'+viDu.map(v=>'- '+v.tieu_de+' | hook: '+v.hook+' | cta: '+v.cta).join('\n')):'')+(cacBuoc.length?('\nCÁC BƯỚC CÓ SẴN TRONG NGUỒN QUAY:\n'+cacBuoc.map((x,i)=>(i+1)+'. '+x).join('\n')):'')+'\nĐỀ BÀI: '+(chuoi(b.tieu_de,200)||'(tự đặt)')+'\nGÓC NHÌN: '+(chuoi(b.angle,300)||'(tự chọn góc hợp framework)');
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
async function aiVietNoiDung(env, b, me, tinhNang='soan_noi_dung'){ const p=await promptNoiDung(env,b); const r=await goiAI(env,{system:p.sys, messages:[{role:'user',content:p.usr}], max_tokens:2000, tinh_nang:tinhNang, me}); if(!r.ok) return r; const d=duyetVanBanAI(r.text, p.cacBuoc, p.claims, p.dd); return {...d, so_vi_du:p.so_vi_du, model:r.model}; }
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
const VIEC_TRAM=['chay_agent','chay_hang_loat','lich_viec','zalo_qr','gui_otp','huy_dang_nhap'];
// Món Content OS nhận từ Trạm: kết quả đăng/đo của chính agent content_os + tin đối thủ (→ ý tưởng) + bình luận TikTok
const MON_HUB=[{viec:'content_os.dang', bang:['content_os.dang_ket_qua']},{viec:'content_os.do_luong', bang:['content_os.ket_qua']},{viec:'content_os.dung_video', bang:['content_os.video']},{viec:'doi_thu.quet', bang:['doi_thu_tin']},{viec:'doi_thu.quet_nhom', bang:['doi_thu_tin']},{viec:'doi_thu.quet_nhom_trua', bang:['doi_thu_tin']},{viec:'tiktok_cn.binh_luan', bang:['fchat_events']}];
async function xacThucHub(env, request){ const cfg=(await docCauHinh(env)).tram||{}; const k=chuoi(cfg.khoa,200); if(!k||cfg.bat===false) return {ok:false, status:503, loi:'Content OS chưa bật Trạm / chưa tạo khoá'}; if((request.headers.get('X-Hub-Key')||'')!==k) return {ok:false, status:401, loi:'Sai khoá Trạm'}; return {ok:true}; }
async function taoLenhTram(env, viec, tham_so, tacNhan){ if(!VIEC_TRAM.includes(viec)) return {ok:false, loi:'Trạm không nhận lệnh '+viec};
  // gộp: cùng việc & tham số đang CHỜ/ĐÃ GỬI (chưa xong) thì không xếp thêm
  const ts=JSON.stringify(tham_so||{}); const cu=await env.DB.prepare(`SELECT id FROM tram_lenh WHERE viec=? AND tham_so=? AND trang_thai IN ('CHO','DA_GUI')`).bind(viec, ts).first(); if(cu) return {ok:true, id:cu.id, trung:true};
  const id=uid('tl'); await env.DB.prepare(`INSERT INTO tram_lenh (id,viec,tham_so,trang_thai,tao_boi,created_at) VALUES (?,?,?,'CHO',?,?)`).bind(id, viec, ts, (tacNhan&&tacNhan.ho_ten)||'Máy', nowISO()).run(); return {ok:true, id}; }
async function docTramTrangThai(env){ const r=await env.DB.prepare(`SELECT * FROM tram_trang_thai WHERE id='tram'`).first(); if(!r) return null; const cfg=(await docCauHinh(env)).tram||{}; const im=Date.now()-Date.parse(r.nhan_luc||0); return { ...docJSON(r.than,{}), nhan_luc:r.nhan_luc, im_phut:Math.round(im/60000), song: im < Math.max(2,so(cfg.im_lang_phut,6))*60000 }; }
// Trạm đẩy một lô dữ liệu về — xử lý theo tên bảng; bảng lạ chỉ ghi sổ (không đoán)
async function napLoTram(env, b){
  const bang=chuoi(b.bang,60), dong=Array.isArray(b.dong)?b.dong.slice(0,400):[]; let moi=0, cap=0; const loi=[];
  if(bang==='doi_thu_tin'){ const kq=await gomYTuong(env, dong.map(d=>({ ten:chuoi(d.tieu_de||d.ten||d.title,200), mo_ta:chuoi(d.noi_dung||d.mo_ta||d.tom_tat,500), link:chuoi(d.link||d.url,500), nguon:'DOI_THU' })).filter(x=>x.ten), 'Trạm'); moi=kq.them; }
  else if(bang==='content_os.dang_ket_qua'){ for(const d of dong){ const bd=d.bai_dang_id?await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(String(d.bai_dang_id)).first():null; if(!bd){ loi.push('không thấy bài '+d.bai_dang_id); continue; }
      if(d.ok===true){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DA_DANG', link=?, posted_at=?, loi=NULL, updated_at=? WHERE id=?`).bind(chuoi(d.link,500)||bd.link||'', nowISO(), nowISO(), bd.id).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DANG', 'Trạm đăng xong', MAY('Trạm')); cap++; }
      else { await env.DB.prepare(`UPDATE bai_dang SET trang_thai='LOI', loi=?, lan_thu=lan_thu+1, updated_at=? WHERE id=?`).bind('Trạm: '+chuoi(d.loi||'không rõ',300), nowISO(), bd.id).run(); cap++; } } }
  else if(bang==='content_os.video'){ for(const d of dong){ const nd=d.noi_dung_id?await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(String(d.noi_dung_id)).first():null; if(!nd||!chuoi(d.media_url)){ loi.push('thiếu nội dung/media '+(d.noi_dung_id||'')); continue; }
      const tsId=uid('ts'); await env.DB.prepare(`INSERT INTO tai_san (id,loai,ten,mo_ta,media_url,media_type,muc_id,noi_dung_id,nguon,created_at,created_by_name) VALUES (?,'VIDEO_XUAT',?,?,?,'VIDEO',?,?,'TRAM',?,?)`).bind(tsId,'Video Trạm dựng: '+(nd.tieu_de||nd.hook).slice(0,80), chuoi(d.mo_ta,500), chuoi(d.media_url,500), nd.muc_id, nd.id, nowISO(), 'Trạm').run();
      await env.DB.prepare(`UPDATE noi_dung SET chi_tiet=?, updated_at=? WHERE id=?`).bind(JSON.stringify(lamSachChiTiet({...docJSON(nd.chi_tiet,{}), video_url:chuoi(d.media_url,500), video_tai_san_id:tsId, video_luc:nowISO()})), nowISO(), nd.id).run(); moi++; } }
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
//  AGENT ĐIỀU PHỐI — cron 15' gọi vào; mỗi agent chốt 1 lượt/ngày đúng giờ; "chạy thử" ghi thu=1
//  Đăng ký agent: {ma, ten, loai:'HE_THONG'|'THUC_HIEN'|'HOC', buoc, chay(env,ctx)→{ok,tom_tat,doc,ghi,chi_tiet,bo_qua}}
//  THUC_HIEN chỉ chạy khi bước ở AI_GOI_Y/AI_TU_LAM; HOC chỉ khi bước có hoc=BẬT. (Các agent tầng khác thêm ở ADR sau.)
// ============================================================
const AGENTS = [
  { ma:'TINH_SAN_SANG', ten:'Chấm điểm sẵn sàng 12 bước', loai:'HE_THONG', buoc:null,
    chay: async (env)=>{ const kq=[]; for(const b of BUOC) kq.push(await tinhSanSang(env,b.ma)); const co=kq.filter(x=>x.so_mau>0);
      return { ok:true, doc:kq.reduce((s,x)=>s+x.so_mau,0), ghi:BUOC.length, tom_tat: co.length? ('Đã chấm '+co.length+' bước có mẫu: '+co.map(x=>x.buoc+'='+x.san_sang+'/100 ('+x.so_mau+' mẫu)').join(', ')) : 'Chưa có mẫu học nào — mọi bước 0/100', chi_tiet:{buoc:kq} }; } },
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
      let soan=0, gui=0; const loi=[]; let usd=0;
      for(const m of muc){ const r=await aiVietNoiDung(env,{dinh_dang:m.dinh_dang, tieu_de:m.tieu_de, framework_id:m.framework_id, san_pham_id:m.san_pham_id, kenh_id:m.kenh_id, pillar_id:m.pillar_id, muc_tieu:m.muc_tieu, angle:m.ghi_chu}, null, 'soan_nhap_agent');
        if(!r.ok){ loi.push(m.tieu_de+': '+r.loi); if(r.vuot_ngan_sach) break; continue; }
        const t=await taoNoiDung(env,{...r.noi_dung, muc_id:m.id, ly_do_may:'Soạn từ mục kế hoạch · '+(r.so_vi_du?(r.so_vi_du+' ví dụ đã duyệt'):'chưa có ví dụ')}, MAY('Máy (B4)')); if(!t.ok){ loi.push(m.tieu_de+': '+t.loi); continue; } soan++;
        if(b4.nguoi_thuc_hien==='AI_TU_LAM'){ const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(t.id).first(); const g=await guiDuyet(env, nd, MAY('Máy (B4)')); if(g.ok&&!g.tu_tra_lai) gui++; } }
      return { ok:soan>0||!loi.length, doc:muc.length, ghi:soan, tom_tat:'Soạn '+soan+'/'+muc.length+' bài'+(gui?(' · gửi duyệt '+gui):'')+(loi.length?(' · lỗi '+loi.length):''), chi_tiet:{loi:loi.slice(0,10)} }; } },
  // B4 học: bản nháp bóng cho bài người gửi duyệt 7 ngày gần đây chưa có mẫu (tối đa N/ngày, ngân sách học)
  { ma:'HOC_SOAN_NHAP', ten:'Bản nháp bóng — máy học cách người soạn', loai:'HOC', buoc:'B4',
    chay: async (env)=>{ if(!env.ANTHROPIC_API_KEY) return {bo_qua:'Chưa cắm ANTHROPIC_API_KEY'}; const cfg=(await docCauHinh(env)).noi_dung||{}; const toiDa=Math.max(1,so(cfg.hoc_toi_da_ngay,5)); const tu=new Date(Date.now()-7*864e5).toISOString();
      const ds=(await env.DB.prepare(`SELECT n.* FROM noi_dung n WHERE n.tao_boi='NGUOI' AND n.trang_thai IN ('CHO_DUYET','DUYET','TRA_LAI') AND n.updated_at>=? AND NOT EXISTS (SELECT 1 FROM mau_hoc h WHERE h.buoc='B4' AND h.doi_tuong_id=n.id) ORDER BY n.updated_at DESC LIMIT ?`).bind(tu, toiDa).all()).results;
      if(!ds.length) return {bo_qua:'Không có bài mới của người để học'}; let hoc=0; const gs=[]; const loi=[];
      for(const nd of ds){ const r=await banNhapBong(env, nd); if(r.ok){ hoc++; gs.push(r.giong); } else { loi.push(r.loi); if(r.vuot_ngan_sach) break; } }
      return { ok:hoc>0, doc:ds.length, ghi:hoc, tom_tat:'Học '+hoc+' bài · giống trung bình '+(gs.length?(gs.reduce((s,x)=>s+x,0)/gs.length*100).toFixed(0):0)+'%'+(loi.length?(' · lỗi: '+loi[0]):''), chi_tiet:{giong:gs} }; } },
  // B9: đăng bài tới giờ (mỗi 15'); B9 NGƯỜI → giao việc đăng tay
  { ma:'DANG_BAI', ten:'Đăng bài tới giờ (API / n8n / giao đăng tay)', loai:'HE_THONG', buoc:'B9', nhip:'15p', chay: async (env)=>chayDangBai(env) },
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
async function bootstrap(env, u){
  const all=async s=>(await env.DB.prepare(s).all()).results;
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
  const [ndR, dyR, tsR, bdR] = xem ? await Promise.all([
    env.DB.prepare(`SELECT * FROM noi_dung WHERE updated_at>=? ORDER BY updated_at DESC LIMIT 400`).bind(tu90).all().then(r=>r.results),
    env.DB.prepare(`SELECT * FROM duyet WHERE trang_thai='CHO' OR created_at>=? ORDER BY created_at DESC LIMIT 300`).bind(tu30).all().then(r=>r.results),
    all(`SELECT * FROM tai_san ORDER BY created_at DESC LIMIT 300`),
    env.DB.prepare(`SELECT * FROM bai_dang WHERE created_at>=? ORDER BY gio_dang DESC LIMIT 300`).bind(tu90).all().then(r=>r.results),
  ]) : [[],[],[],[]];
  return {
    me:{ id:u.id, ho_ten:u.ho_ten, email:u.email, vai_tro:u.vai_tro, doi_mat_khau:uBool(u.doi_mat_khau) },
    noi_dung: ndR.map(n=>({...n, sections:docSections(n.sections), chi_tiet:docJSON(n.chi_tiet,{})})),
    duyet: dyR.map(d=>({...d, cham_may:docJSON(d.cham_may,{})})), tai_san: tsR, bai_dang: bdR,
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
    san_sang: { ai:!!env.ANTHROPIC_API_KEY, youtube:!!env.YOUTUBE_API_KEY, n8n:!!(env.N8N_TOKEN&&env.N8N_WEBHOOK_URL), media:!!env.MEDIA },
    // ADR-004: Trạm — cờ có khoá (không bao giờ trả khoá), nhịp tim & phiên, lệnh/lô gần đây
    tram: xem ? { co_khoa:!!chuoi((cfg.tram||{}).khoa), bat:(cfg.tram||{}).bat!==false, trang_thai: await docTramTrangThai(env),
      lenh:(await all(`SELECT * FROM tram_lenh ORDER BY created_at DESC LIMIT 20`)).map(l=>({...l, tham_so:docJSON(l.tham_so,{})})), lo:(await all(`SELECT id,viec,bang,luot,so_dong,xu_ly,created_at FROM tram_lo ORDER BY created_at DESC LIMIT 20`)).map(l=>{ const x=docJSON(l.xu_ly,{}); delete x.dong; return {...l, xu_ly:x}; }) } : null,
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
  san_pham:   { truong:['ma','ten','dong','mo_ta','thong_so','tieu_chuan','bao_hanh','huong_dan','active'], batBuoc:['ten'] },
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
    return json({ media_url:'/media/'+key, media_type: ct.startsWith('image/')?'IMAGE':'VIDEO' });
  }
  // n8n báo kết quả đăng (secret dùng chung, không phiên người)
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
    if(path==='/hub/ping' && method==='GET') return json({ ok:true, app:'content_os', ten:'Kingsmen Content OS', ban:'2.0.'+3, hop_dong:1, mon:MON_HUB, nhan_lenh:true });
    if(path==='/hub/lenh' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT * FROM tram_lenh WHERE trang_thai='CHO' ORDER BY created_at LIMIT 20`).all()).results; for(const l of ds) await env.DB.prepare(`UPDATE tram_lenh SET trang_thai='DA_GUI', gui_at=? WHERE id=?`).bind(nowISO(), l.id).run();
      // lệnh đã gửi quá 30 phút mà Trạm không báo xong → coi là hỏng (Trạm tắt giữa chừng)
      await env.DB.prepare(`UPDATE tram_lenh SET trang_thai='HONG', ket_qua='Trạm không báo kết quả sau 30 phút', xong_at=? WHERE trang_thai='DA_GUI' AND gui_at<?`).bind(nowISO(), new Date(Date.now()-30*60000).toISOString()).run();
      return json({ lenh: ds.map(l=>({id:l.id, viec:l.viec, tham_so:docJSON(l.tham_so,{})})) }); }
    if(path==='/hub/lenh_xong' && method==='POST'){ const l=await env.DB.prepare(`SELECT * FROM tram_lenh WHERE id=?`).bind(String(body.id||'')).first(); if(!l) return json({error:'không có lệnh'},404);
      await env.DB.prepare(`UPDATE tram_lenh SET trang_thai=?, ket_qua=?, xong_at=? WHERE id=?`).bind(body.ok?'XONG':'HONG', chuoi(body.msg,400), nowISO(), l.id).run(); await logAudit(env, MAY('Trạm'), 'Trạm '+(body.ok?'làm xong':'báo hỏng')+' lệnh', 'tram_lenh', l.id, l.viec+' · '+chuoi(body.msg,200)); return json({ok:true}); }
    if(path==='/hub/trang_thai' && method==='POST'){ const than=JSON.stringify({ may:chuoi(body.may,80), ban:chuoi(body.ban,20), khoi_luc:chuoi(body.khoi_luc,40), gio_may:chuoi(body.gio_may,40), dung_nha:body.dung_nha!==false, phien:(body.phien&&typeof body.phien==='object')?body.phien:{}, hang_loat:body.hang_loat||null }).slice(0,20000);
      await env.DB.prepare(`INSERT INTO tram_trang_thai (id,than,nhan_luc) VALUES ('tram',?,?) ON CONFLICT(id) DO UPDATE SET than=excluded.than, nhan_luc=excluded.nhan_luc`).bind(than, nowISO()).run(); return json({ok:true, ban:'2.0.3'}); }
    if(path==='/hub/nap' && method==='POST'){ const r=await napLoTram(env, body); return json(r); }
    // Trạm hỏi danh sách việc cho agent content_os (script content-os-dang / content-os-do-luong / content-os-dung-video)
    if(path==='/hub/viec/dang' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT b.*, k.ten kenh_ten, k.loai kenh_loai, k.api_object_id kenh_doi_tuong, n.dinh_dang, n.tieu_de FROM bai_dang b LEFT JOIN kenh k ON k.id=b.kenh_id LEFT JOIN noi_dung n ON n.id=b.noi_dung_id WHERE b.trang_thai='DANG_GUI' AND b.cach='TRAM' ORDER BY b.gio_dang LIMIT 20`).all()).results;
      const goc=env.APP_BASE_URL||''; return json({ viec: ds.map(b=>({ bai_dang_id:b.id, kenh:{ten:b.kenh_ten, loai:b.kenh_loai, doi_tuong:b.kenh_doi_tuong}, dinh_dang:b.dinh_dang, tieu_de:b.tieu_de, noi_dung:b.noi_dung_dang, media_url:b.media_url?(/^https?:/.test(b.media_url)?b.media_url:goc+b.media_url):'', gio_dang:b.gio_dang })) }); }
    if(path==='/hub/viec/do_luong' && method==='GET'){ const cfg=(await docCauHinh(env)).tram||{}; const tu=new Date(Date.now()-Math.max(1,so(cfg.so_ngay_do,30))*864e5).toISOString();
      const ds=(await env.DB.prepare(`SELECT b.id, b.link, b.posted_at, k.loai kenh_loai, k.ten kenh_ten, m.muc_tieu FROM bai_dang b LEFT JOIN kenh k ON k.id=b.kenh_id LEFT JOIN muc_noi_dung m ON m.id=b.muc_id WHERE b.trang_thai='DA_DANG' AND COALESCE(b.link,'')<>'' AND COALESCE(b.posted_at,b.updated_at)>=? ORDER BY b.posted_at DESC LIMIT 200`).bind(tu).all()).results;
      return json({ viec: ds.map(b=>({ bai_dang_id:b.id, link:b.link, kenh_loai:b.kenh_loai, kenh_ten:b.kenh_ten, muc_tieu:b.muc_tieu, posted_at:b.posted_at })) }); }
    if(path==='/hub/viec/dung_video' && method==='GET'){ const ds=(await env.DB.prepare(`SELECT n.id, n.tieu_de, n.hook, n.sections, n.cta, n.chi_tiet, n.muc_id FROM noi_dung n LEFT JOIN muc_noi_dung m ON m.id=n.muc_id WHERE n.trang_thai='DUYET' AND n.dinh_dang='VIDEO' AND m.giai_doan='SAN_XUAT' ORDER BY n.updated_at DESC LIMIT 20`).all()).results;
      const goc=env.APP_BASE_URL||''; const out=[]; for(const n of ds){ const ct=docJSON(n.chi_tiet,{}); if(ct.video_url) continue; const ts=(await env.DB.prepare(`SELECT media_url,media_type,loai,ten FROM tai_san WHERE (muc_id=? OR noi_dung_id=?) AND loai IN ('FOOTAGE','ANH')`).bind(n.muc_id, n.id).all()).results;
        out.push({ noi_dung_id:n.id, tieu_de:n.tieu_de, hook:n.hook, sections:docSections(n.sections), cta:n.cta, tai_san:ts.map(t=>({...t, media_url:/^https?:/.test(t.media_url)?t.media_url:goc+t.media_url})) }); } return json({ viec: out }); }
    return json({error:'Không có đường hub '+path},404);
  }   // công cụ Lọc video hỏi nhạc nền — không có trên web

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
    await logAudit(env,me,'gạt bước','buoc_thuc_hien',ma, meta.ten+': '+cu.nguoi_thuc_hien+' → '+muc+' · vai trò '+vt+' · học '+(hoc?'BẬT':'TẮT'));
    return json({ db: await bootstrap(env,me) });
  }
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
    const id=uid('yt'); const ch=body.cham_ai===false?null:await chamYTuongAI(env,{ten:chuoi(body.ten,200),mo_ta:chuoi(body.mo_ta,500),nguon:'NGUOI'});
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
    const r=await aiVietNoiDung(env,{ ...body, dinh_dang:body.dinh_dang||(muc&&muc.dinh_dang), tieu_de:body.tieu_de||(muc&&muc.tieu_de), pillar_id:body.pillar_id||(muc&&muc.pillar_id), muc_tieu:body.muc_tieu||(muc&&muc.muc_tieu), framework_id:body.framework_id||(muc&&muc.framework_id), san_pham_id:body.san_pham_id||(muc&&muc.san_pham_id), kenh_id:body.kenh_id||(muc&&muc.kenh_id) }, me);
    if(!r.ok) return json({ok:false, thieu_key:!!r.thieu_key, vuot_ngan_sach:!!r.vuot_ngan_sach, loi:r.loi, blocked:r.blocked||[]},200);
    return json({ ok:true, kich_ban:r.noi_dung, noi_dung:r.noi_dung, canh_bao:r.canh_bao, so_vi_du:r.so_vi_du }); }
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
  if((path==='/tai-san'||path==='/footage') && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const media_url=chuoi(body.media_url,500); if(!media_url) return json({error:'Cần file hoặc link media'},400);
    const loai=['FOOTAGE','ANH','VIDEO_XUAT','GOI_DUNG','KHAC'].includes(String(body.loai||'').toUpperCase())?String(body.loai).toUpperCase():(String(body.media_type||'').toUpperCase()==='IMAGE'?'ANH':'FOOTAGE'); const id=uid('ts');
    await env.DB.prepare(`INSERT INTO tai_san (id,loai,ten,mo_ta,media_url,media_type,muc_id,noi_dung_id,nguon,created_at,created_by_name) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, loai, chuoi(body.ten,200)||media_url.split('/').pop(), chuoi(body.mo_ta,500), media_url, String(body.media_type||(loai==='ANH'?'IMAGE':'VIDEO')).toUpperCase(), body.muc_id||null, body.noi_dung_id||null, chuoi(body.nguon,40)||'NGUOI', nowISO(), me.ho_ten).run();
    await logAudit(env,me,'thêm tài sản','tai_san',id,chuoi(body.ten,100)); return json({ db: await bootstrap(env,me), id }); }
  if((m=path.match(/^\/tai-san\/([^/]+)$/)) && method==='DELETE'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const t=await env.DB.prepare(`SELECT * FROM tai_san WHERE id=?`).bind(m[1]).first(); if(!t) return json({error:'Không tìm thấy'},404);
    await env.DB.prepare(`DELETE FROM tai_san WHERE id=?`).bind(t.id).run(); if(env.MEDIA&&t.media_url&&t.media_url.startsWith('/media/')) try{ await env.MEDIA.delete(t.media_url.slice(7)); }catch(e){} await logAudit(env,me,'xoá tài sản','tai_san',t.id,t.ten); return json({ db: await bootstrap(env,me) }); }
  if(path==='/ai/usage' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const provider=String(body.provider||'').toLowerCase(); if(!['gemini','ollama','local'].includes(provider)) return json({error:'provider không hợp lệ'},400);
    await ghiAIUsage(env,{provider, model:chuoi(body.model,80), tinh_nang:chuoi(body.tinh_nang||'cong_cu',40), me, tokens_vao:so(body.tokens_vao), tokens_ra:so(body.tokens_ra), ok:body.ok!==false, ms:so(body.ms), loi:chuoi(body.loi,300)}); return json({ok:true}); }
  // Bài đăng
  if(path==='/bai-dang' && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(body.noi_dung_id||'').first(); if(!nd) return json({error:'Không tìm thấy nội dung'},404); if(nd.trang_thai!=='DUYET') return json({error:'Chỉ đưa vào đăng nội dung ĐÃ DUYỆT (G3)'},409);
    const kenh=body.kenh_id?await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(body.kenh_id).first():(nd.kenh_id?await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(nd.kenh_id).first():null); if(!kenh) return json({error:'Chọn kênh đăng'},400);
    const cach=['TAY','API','N8N'].includes(String(body.cach||'').toUpperCase())?String(body.cach).toUpperCase():(kenh.cach_dang||'TAY'); const gio=body.gio_dang&&!isNaN(Date.parse(body.gio_dang))?new Date(body.gio_dang).toISOString():nowISO();
    const ct=docJSON(nd.chi_tiet,{}); const media=chuoi(body.media_url,500)||ct.video_url||ct.anh_url||''; const id=uid('bd');
    await env.DB.prepare(`INSERT INTO bai_dang (id,noi_dung_id,muc_id,kenh_id,gio_dang,cach,noi_dung_dang,media_url,link,trang_thai,created_at,created_by_name,updated_at) VALUES (?,?,?,?,?,?,?,?,'',?,?,?,?)`).bind(id, nd.id, nd.muc_id, kenh.id, gio, cach, body.noi_dung_dang!=null?chuoi(body.noi_dung_dang,8000):banDang(nd), media, body.len_lich===false?'CHUAN_BI':'DA_LEN_LICH', nowISO(), me.ho_ten, nowISO()).run();
    await logAudit(env,me,'đưa vào đăng','bai_dang',id,kenh.ten+' · '+cach+' · '+gio); return json({ db: await bootstrap(env,me), id }); }
  if((m=path.match(/^\/bai-dang\/([^/]+)$/)) && method==='PATCH'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(m[1]).first(); if(!bd) return json({error:'Không tìm thấy'},404);
    if(body.da_dang===true){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DA_DANG', link=?, posted_at=?, loi=NULL, updated_at=? WHERE id=?`).bind(chuoi(body.link,500)||bd.link||'', nowISO(), nowISO(), bd.id).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DANG', 'đăng tay', me);
      await env.DB.prepare(`UPDATE cong_viec SET trang_thai='XONG', xong_at=?, xong_boi=? WHERE doi_tuong='bai_dang' AND doi_tuong_id=? AND trang_thai='MO'`).bind(nowISO(), me.ho_ten, bd.id).run(); await logAudit(env,me,'đã đăng tay','bai_dang',bd.id,chuoi(body.link,200)); return json({ db: await bootstrap(env,me) }); }
    const gio=body.gio_dang&&!isNaN(Date.parse(body.gio_dang))?new Date(body.gio_dang).toISOString():bd.gio_dang; const cach=['TAY','API','N8N'].includes(String(body.cach||'').toUpperCase())?String(body.cach).toUpperCase():bd.cach;
    await env.DB.prepare(`UPDATE bai_dang SET gio_dang=?, cach=?, noi_dung_dang=?, media_url=?, link=?, trang_thai=?, loi=NULL, updated_at=? WHERE id=?`).bind(gio, cach, body.noi_dung_dang!=null?chuoi(body.noi_dung_dang,8000):bd.noi_dung_dang, body.media_url!=null?chuoi(body.media_url,500):bd.media_url, body.link!=null?chuoi(body.link,500):bd.link, bd.trang_thai==='DA_DANG'?'DA_DANG':(body.len_lich===false?'CHUAN_BI':'DA_LEN_LICH'), nowISO(), bd.id).run();
    await logAudit(env,me,'sửa bài đăng','bai_dang',bd.id,cach+' · '+gio); return json({ db: await bootstrap(env,me) }); }
  if((m=path.match(/^\/bai-dang\/([^/]+)\/dang-ngay$/)) && method==='POST'){ if(!isStaff(me)) return json({error:'Không có quyền'},403); const bd=await env.DB.prepare(`SELECT * FROM bai_dang WHERE id=?`).bind(m[1]).first(); if(!bd) return json({error:'Không tìm thấy'},404); if(bd.trang_thai==='DA_DANG') return json({error:'Đã đăng rồi'},409);
    const nd=await env.DB.prepare(`SELECT * FROM noi_dung WHERE id=?`).bind(bd.noi_dung_id).first(); const kenh=await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(bd.kenh_id).first(); if(!nd||!kenh) return json({error:'Thiếu nội dung/kênh'},400);
    const r= bd.cach==='N8N' ? await dangN8n(env,bd,nd,kenh) : bd.cach==='API' ? await dangFacebook(env,kenh,bd,nd) : {ok:false, loi:'Kênh đăng tay — đánh dấu "Đã đăng" kèm link'};
    if(!r.ok){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='LOI', loi=?, updated_at=? WHERE id=?`).bind(r.loi, nowISO(), bd.id).run(); return json({ ok:false, loi:r.loi, db: await bootstrap(env,me) }); }
    if(r.cho_callback){ await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DANG_GUI', updated_at=? WHERE id=?`).bind(nowISO(), bd.id).run(); return json({ ok:true, cho_callback:true, db: await bootstrap(env,me) }); }
    await env.DB.prepare(`UPDATE bai_dang SET trang_thai='DA_DANG', link=?, posted_at=?, loi=NULL, updated_at=? WHERE id=?`).bind(r.link||'', nowISO(), nowISO(), bd.id).run(); await datGiaiDoan(env, bd.muc_id, 'DA_DANG', 'đăng qua API', me); await logAudit(env,me,'đăng ngay qua API','bai_dang',bd.id,r.link||''); return json({ ok:true, link:r.link, db: await bootstrap(env,me) }); }
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
  async scheduled(controller, env, ctx){ ctx.waitUntil(dieuPhoi(env).catch(()=>{})); },
  async fetch(request, env, ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      if(request.method==='OPTIONS') return new Response(null,{status:204, headers:CORS});
      try{ return await handleApi(request, env); }catch(e){ return json({error:'Lỗi server: '+(e.message||e)},500); }
    }
    if(url.pathname.startsWith('/media/') && env.MEDIA){
      const obj=await env.MEDIA.get(url.pathname.slice(7)); if(!obj) return new Response('Not found',{status:404});
      return new Response(obj.body,{ headers:{ 'content-type':(obj.httpMetadata&&obj.httpMetadata.contentType)||'application/octet-stream', 'cache-control':'public, max-age=31536000, immutable' } });
    }
    // SPA: đường dẫn không có phần mở rộng → index.html
    if(env.ASSETS){ const r=await env.ASSETS.fetch(request); if(r.status!==404 || /\.[a-z0-9]+$/i.test(url.pathname)) return r;
      return env.ASSETS.fetch(new Request(new URL('/index.html', url).toString(), request)); }
    return new Response('Kingsmen Content OS', {status:200});
  },
};
