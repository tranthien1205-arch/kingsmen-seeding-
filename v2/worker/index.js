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
  for(const s of q) await env.DB.prepare(s).run();
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
//  AGENT ĐIỀU PHỐI — cron 15' gọi vào; mỗi agent chốt 1 lượt/ngày đúng giờ; "chạy thử" ghi thu=1
//  Đăng ký agent: {ma, ten, loai:'HE_THONG'|'THUC_HIEN'|'HOC', buoc, chay(env,ctx)→{ok,tom_tat,doc,ghi,chi_tiet,bo_qua}}
//  THUC_HIEN chỉ chạy khi bước ở AI_GOI_Y/AI_TU_LAM; HOC chỉ khi bước có hoc=BẬT. (Các agent tầng khác thêm ở ADR sau.)
// ============================================================
const AGENTS = [
  { ma:'TINH_SAN_SANG', ten:'Chấm điểm sẵn sàng 12 bước', loai:'HE_THONG', buoc:null,
    chay: async (env)=>{ const kq=[]; for(const b of BUOC) kq.push(await tinhSanSang(env,b.ma)); const co=kq.filter(x=>x.so_mau>0);
      return { ok:true, doc:kq.reduce((s,x)=>s+x.so_mau,0), ghi:BUOC.length, tom_tat: co.length? ('Đã chấm '+co.length+' bước có mẫu: '+co.map(x=>x.buoc+'='+x.san_sang+'/100 ('+x.so_mau+' mẫu)').join(', ')) : 'Chưa có mẫu học nào — mọi bước 0/100', chi_tiet:{buoc:kq} }; } },
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
  return {
    me:{ id:u.id, ho_ten:u.ho_ten, email:u.email, vai_tro:u.vai_tro, doi_mat_khau:uBool(u.doi_mat_khau) },
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
    module_config: xem ? cfg : {duyet:cfg.duyet},
    ai_thang: xem ? await tongHopAI(env, thangHienTai()) : null,
    san_sang: { ai:!!env.ANTHROPIC_API_KEY, youtube:!!env.YOUTUBE_API_KEY, n8n:!!(env.N8N_TOKEN&&env.N8N_WEBHOOK_URL), media:!!env.MEDIA },
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
  pillars:    { truong:['ten','mo_ta','ty_trong','thu_tu','active'], batBuoc:['ten'] },
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
    else if(k==='api_ma') o[k]=String(body[k]||'').trim().toUpperCase().replace(/[^A-Z0-9_]/g,'');
    else if(k==='cach_dang') o[k]=['API','N8N','TAY'].includes(String(body[k]).toUpperCase())?String(body[k]).toUpperCase():'TAY';
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
    else if(t==='boolean'){ if(typeof v!=='boolean') return '"'+k+'" phải là bật/tắt'; }
    else if(t==='object'){ if(!v||typeof v!=='object') return '"'+k+'" phải là object'; }
  }
  return null;
}

async function handleApi(request, env){
  const url=new URL(request.url); const path=url.pathname.replace(/^\/api/,''); const method=request.method;
  const body=(method==='POST'||method==='PATCH'||method==='PUT') ? await request.json().catch(()=>({})) : {};
  await ensureSchema(env);

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
  const me=sess.user; let m;
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
  await ins('pillars',['id','ten','mo_ta','ty_trong','thu_tu','active','created_at'],[['mp_p1','Branding','Thương hiệu, cam kết, bảo hành',40,1,1,t],['mp_p2','Information','Kiến thức, thông số, so sánh',30,2,1,t],['mp_p3','Problems','Vấn đề thực tế của ron gạch → giải pháp',20,3,1,t],['mp_p4','Interaction','Hỏi đáp, minigame, KOC',10,4,1,t]]);
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
  for(const b of ['pillars','frameworks','san_pham','claim_cam','kenh','mau_hoc','agent_run','cong_viec']) await env.DB.prepare(`DELETE FROM ${b} WHERE id LIKE 'mp_%'`).run();
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
