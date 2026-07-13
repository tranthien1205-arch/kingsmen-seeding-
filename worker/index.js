// ============================================================
//  KINGSMEN SEEDING — Cloudflare Worker (API + D1) + web tĩnh
//  - Phục vụ app tĩnh từ dist/ (binding ASSETS)
//  - /api/* : server (đăng nhập, tạo tài khoản, CRUD, tính tiền)
//  - Dữ liệu dùng chung trong Cloudflare D1 (binding DB)
// ============================================================

const ROLES = { MARKETING:'MARKETING', SALES:'SALES', ADMIN:'ADMIN' };
const ST = { NHAP:'NHAP', CHO_DUYET:'CHO_DUYET', DAT:'DAT', KHONG_DAT:'KHONG_DAT', DA_CHI:'DA_CHI' };
const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type,Authorization' };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers:{'Content-Type':'application/json; charset=utf-8', ...CORS} });
const uid = (p='id') => p+'_'+crypto.randomUUID().slice(0,8)+Date.now().toString(36).slice(-4);
const nowISO = () => new Date().toISOString();
const kyOf = (iso) => { const d=new Date(iso||nowISO()); return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0'); };

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

// ---------- khởi tạo schema + seed ----------
let SCHEMA_READY = false;
async function ensureSchema(env){
  if(SCHEMA_READY) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, ho_ten TEXT, email TEXT UNIQUE, password TEXT, vai_tro TEXT, active INTEGER DEFAULT 1, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS pricing (id INTEGER PRIMARY KEY, don_gia_post REAL, don_gia_cmt REAL, min_nhac_kingsmen INTEGER, min_usp INTEGER)`,
    `CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, ten_group TEXT, link TEXT, loai TEXT, so_member INTEGER, active INTEGER, uu_tien INTEGER, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS content_topics (id TEXT PRIMARY KEY, chu_de TEXT, noi_dung TEXT, loai_bai TEXT, muc_tieu TEXT, tags TEXT, active INTEGER, uu_tien INTEGER, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS cmt_suggestions (id TEXT PRIMARY KEY, noi_dung_goi_y TEXT, tuyen TEXT, loai_bai TEXT, tags TEXT, thu_tu INTEGER, active INTEGER, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS post_seedings (id TEXT PRIMARY KEY, topic_id TEXT, sales_id TEXT, group_id TEXT, link_bai TEXT, react INTEGER, so_cmt_seeding INTEGER, so_cmt_tu_nhien INTEGER, trang_thai TEXT, reviewed_by TEXT, reviewed_at TEXT, ly_do_loai TEXT, thanh_tien REAL, ky_thanh_toan TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS cmt_seedings (id TEXT PRIMARY KEY, loai TEXT, post_seeding_id TEXT, post_link TEXT, suggestion_id TEXT, sales_id TEXT, so_cmt_seeding INTEGER, react INTEGER, so_cmt_tu_nhien INTEGER, trang_thai TEXT, reviewed_by TEXT, reviewed_at TEXT, ly_do_loai TEXT, thanh_tien REAL, ky_thanh_toan TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS cmt_proofs (id TEXT PRIMARY KEY, cmt_seeding_id TEXT, image_url TEXT, uploaded_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, at TEXT, by_id TEXT, by_name TEXT, action TEXT, entity TEXT, entity_id TEXT, detail TEXT)`,
    // ---- QUAY CÔNG TRÌNH ----
    `CREATE TABLE IF NOT EXISTS filming_templates (id TEXT PRIMARY KEY, ten TEXT, he_san_pham TEXT, active INTEGER DEFAULT 1, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS filming_phases (id TEXT PRIMARY KEY, template_id TEXT, ten TEXT, thu_tu INTEGER)`,
    `CREATE TABLE IF NOT EXISTS filming_shots (id TEXT PRIMARY KEY, phase_id TEXT, ten TEXT, mo_ta TEXT, source_mau_url TEXT, bat_buoc INTEGER DEFAULT 1, thu_tu INTEGER, active INTEGER DEFAULT 1)`,
    `CREATE TABLE IF NOT EXISTS project_filmings (id TEXT PRIMARY KEY, sales_id TEXT, template_id TEXT, ten_cong_trinh TEXT, khu_vuc TEXT, ngay_quay TEXT, trang_thai TEXT, reviewed_by TEXT, reviewed_at TEXT, ly_do_loai TEXT, thanh_tien REAL, ky_thanh_toan TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS filming_uploads (id TEXT PRIMARY KEY, project_filming_id TEXT, shot_id TEXT, media_type TEXT, media_url TEXT, dat_item INTEGER, ghi_chu TEXT, uploaded_at TEXT)`,
  ];
  await env.DB.batch(stmts.map(s=>env.DB.prepare(s)));
  // thêm cột đơn giá quay công trình cho DB cũ (bỏ qua nếu đã có)
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN don_gia_cong_trinh REAL DEFAULT 150000`).run(); } catch(e){}

  // seed pricing
  const pr = await env.DB.prepare(`SELECT id FROM pricing WHERE id=1`).first();
  if(!pr) await env.DB.prepare(`INSERT INTO pricing (id,don_gia_post,don_gia_cmt,don_gia_cong_trinh,min_nhac_kingsmen,min_usp) VALUES (1,15000,3000,150000,6,2)`).run();

  // seed tài khoản Marketing đầu tiên + thư viện (chỉ khi chưa có user nào)
  const anyUser = await env.DB.prepare(`SELECT id FROM users LIMIT 1`).first();
  if(!anyUser){
    const pass = await hashPassword('123456');
    await env.DB.prepare(`INSERT INTO users (id,ho_ten,email,password,vai_tro,active,created_at) VALUES (?,?,?,?,?,1,?)`)
      .bind(uid('u'),'Marketing','mkt@kingsmen.vn',pass,ROLES.MARKETING,nowISO()).run();
    const g=(t,l,lo,m,ut)=>env.DB.prepare(`INSERT INTO groups (id,ten_group,link,loai,so_member,active,uu_tien,updated_at) VALUES (?,?,?,?,?,1,?,?)`).bind(uid('g'),t,l,lo,m,ut,nowISO());
    const t=(c,n,lb,mt,ut)=>env.DB.prepare(`INSERT INTO content_topics (id,chu_de,noi_dung,loai_bai,muc_tieu,tags,active,uu_tien,updated_at) VALUES (?,?,?,?,?,?,1,?,?)`).bind(uid('t'),c,n,lb,mt,'[]',ut,nowISO());
    const c=(n,tu,lb,to)=>env.DB.prepare(`INSERT INTO cmt_suggestions (id,noi_dung_goi_y,tuyen,loai_bai,tags,thu_tu,active,updated_at) VALUES (?,?,?,?,?,?,1,?)`).bind(uid('c'),n,tu,lb,'[]',to,nowISO());
    await env.DB.batch([
      g('Cộng đồng Xây nhà trọn gói','https://facebook.com/groups/xaynha','Nhà ở',128000,1),
      g('Thầu thợ hoàn thiện nội thất','https://facebook.com/groups/thautho','Thầu thợ',56000,1),
      g('Vật liệu hoàn thiện & thi công','https://facebook.com/groups/vatlieu','Vật liệu XD',41000,0),
      t('Keo chít mạch chống ố vàng','Bạn đang đau đầu vì mạch gạch ố vàng, đen mốc sau vài tháng? Keo chít mạch Kingsmen kháng khuẩn, chống thấm, giữ màu bền 10 năm...','Chống ố vàng/Bảo hành','CÂN NHẮC',1),
      t('ColorMatch - chọn màu mạch chuẩn','Đừng để mạch gạch phá hỏng cả không gian. Với bảng màu ColorMatch của Kingsmen bạn chọn được tông mạch ăn khớp gạch...','ColorMatch','BIẾT',1),
      t('Review thi công thực tế','Chia sẻ công trình vừa hoàn thiện dùng keo Kingsmen. Mạch đều, không bong, không ố...','Review','TIN',0),
      c('Nhà mình dùng Kingsmen 6 tháng rồi mạch vẫn sáng, không ố tí nào 👍','Trải nghiệm','Review',1),
      c('Cho hỏi keo này chống thấm nhà tắm ổn không ạ?','Đặt câu hỏi','Hỏi đáp',2),
      c('Mình là thợ, chít Kingsmen nhanh hơn keo thường, khách ưng màu ColorMatch.','Chuyên gia','ColorMatch',3),
    ]);
  }

  // seed quy trình quay khi chưa có (áp dụng cho cả DB đã tồn tại người dùng)
  const anyTpl = await env.DB.prepare(`SELECT id FROM filming_templates LIMIT 1`).first();
  if(!anyTpl) await seedFilming(env);

  SCHEMA_READY = true;
}

// Dữ liệu mẫu QUY TRÌNH QUAY (nhiều quy trình theo hệ sản phẩm)
const FILM_SEED = [
  ['Keo ron ColorMatch — quy trình chuẩn','Keo chít mạch', [
    ['Tổng quan', [['Mặt tiền công trình','Quay ngang toàn mặt tiền, thấy rõ địa chỉ/biển hiệu.',1],['Toàn cảnh khu vực','Pan chậm bao quát khu vực thi công.',1],['Người cầm sản phẩm','Cầm hộp keo Kingsmen hướng camera, rõ nhãn.',1]]],
    ['Before', [['Toàn cảnh nền trước khi làm','Quay toàn bộ nền/tường trước thi công (đánh dấu góc để After trùng góc).',1],['Cận gạch và khe ron','Cận khe ron bẩn/ố để so sánh.',1],['Sản phẩm trên nền Before','Đặt sản phẩm cạnh khu vực chưa làm.',0]]],
    ['Chọn màu', [['So 2–3 màu trên gạch','Đặt 2–3 mẫu màu lên gạch cho khách so.',1],['Tư vấn khách hàng','Quay khoảnh khắc tư vấn/khách chọn màu.',0],['Cận màu ColorMatch đã chọn','Cận màu cuối cùng khách chốt.',1]]],
    ['Thi công', [['Vệ sinh khe ron & bôi sáp','Quay bước làm sạch khe & bôi sáp.',1],['Lắp keo vào súng','Thao tác lắp tuýp keo vào súng.',0],['Bơm và miết ron','Quay rõ bơm keo & miết đều tay.',1],['Lột keo hoàn thiện','Bước lột/làm sạch keo thừa.',1]]],
    ['After', [['Toàn cảnh After (trùng góc Before)','Quay đúng góc Before để so sánh.',1],['Cận đường ron hoàn thiện','Cận ron đều, sạch, lên màu.',1],['Sản phẩm trên nền After','Đặt sản phẩm cạnh khu vực đã hoàn thiện.',0]]],
  ]],
  ['Epoxy sàn — quy trình quay','Sơn Epoxy sàn', [
    ['Tổng quan', [['Mặt tiền / khu vực sàn','Quay bao quát khu vực sàn cần thi công.',1],['Người cầm sản phẩm','Cầm thùng sơn epoxy Kingsmen.',1]]],
    ['Before', [['Toàn cảnh sàn trước thi công','Quay toàn bộ mặt sàn ban đầu.',1],['Cận khuyết điểm sàn','Cận vết nứt, bong tróc, bụi bẩn.',1]]],
    ['Thi công', [['Mài & xử lý bề mặt','Quay bước mài sàn, hút bụi.',1],['Thi công lớp lót (primer)','Lăn/gạt lớp lót.',1],['Đổ & gạt lớp epoxy','Quay rõ đổ và gạt phẳng.',1],['Lăn phá bọt hoàn thiện','Dùng rulo gai phá bọt.',0]]],
    ['After', [['Toàn cảnh sàn After','Quay trùng góc Before.',1],['Cận bề mặt bóng gương','Cận độ phẳng, bóng.',1]]],
  ]],
  ['Terrazzo mài — quy trình quay','Terrazzo', [
    ['Tổng quan', [['Mặt tiền công trình','Quay bao quát khu vực.',1],['Người cầm sản phẩm','Cầm vật liệu terrazzo Kingsmen.',1]]],
    ['Thi công', [['Trộn vật liệu','Quay tỉ lệ trộn đá + xi/keo.',1],['Đổ terrazzo','Quay bước đổ, dàn đều.',1],['Mài thô','Quay máy mài thô.',1],['Mài tinh & đánh bóng','Quay mài tinh, lên bóng.',1]]],
    ['After', [['Toàn cảnh After','Quay bề mặt hoàn thiện.',1],['Cận bề mặt đá lộ','Cận hạt đá, độ bóng.',1]]],
  ]],
];
async function seedFilming(env){
  const stmts=[];
  for(const [ten, he, phases] of FILM_SEED){
    const tid=uid('tpl');
    stmts.push(env.DB.prepare(`INSERT INTO filming_templates (id,ten,he_san_pham,active,updated_at) VALUES (?,?,?,1,?)`).bind(tid,ten,he,nowISO()));
    let po=1;
    for(const [pten, shots] of phases){
      const pid=uid('ph');
      stmts.push(env.DB.prepare(`INSERT INTO filming_phases (id,template_id,ten,thu_tu) VALUES (?,?,?,?)`).bind(pid,tid,pten,po++));
      let so=1;
      for(const [sten,mo_ta,bb] of shots){
        stmts.push(env.DB.prepare(`INSERT INTO filming_shots (id,phase_id,ten,mo_ta,source_mau_url,bat_buoc,thu_tu,active) VALUES (?,?,?,?,?,?,?,1)`).bind(uid('sh'),pid,sten,mo_ta,'',bb,so++));
      }
    }
  }
  await env.DB.batch(stmts);
}

// ---------- helpers ----------
const bool = v => v?1:0;
const uBool = v => !!v;
function rowUser(u){ if(!u) return null; return { id:u.id, ho_ten:u.ho_ten, email:u.email, vai_tro:u.vai_tro, active:uBool(u.active), created_at:u.created_at }; }
function rowGroup(g){ return { ...g, active:uBool(g.active), uu_tien:uBool(g.uu_tien) }; }
function rowTopic(t){ return { ...t, active:uBool(t.active), uu_tien:uBool(t.uu_tien), tags: JSON.parse(t.tags||'[]') }; }
function rowCmtSug(c){ return { ...c, active:uBool(c.active), tags: JSON.parse(c.tags||'[]') }; }

async function getSession(env, req){
  const auth = req.headers.get('Authorization')||'';
  const token = auth.replace(/^Bearer\s+/i,'').trim();
  if(!token) return null;
  const s = await env.DB.prepare(`SELECT * FROM sessions WHERE token=?`).bind(token).first();
  if(!s) return null;
  if(s.expires_at && s.expires_at < nowISO()){ await env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(token).run(); return null; }
  const u = await env.DB.prepare(`SELECT * FROM users WHERE id=?`).bind(s.user_id).first();
  if(!u || !u.active) return null;
  return { token, user:u };
}
const isStaff = (u) => u && (u.vai_tro===ROLES.MARKETING || u.vai_tro===ROLES.ADMIN);
async function logAudit(env, u, action, entity, entity_id, detail=''){
  await env.DB.prepare(`INSERT INTO audit (id,at,by_id,by_name,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(uid('a'),nowISO(),u?.id||null,u?.ho_ten||'—',action,entity,String(entity_id||''),detail).run();
}

// ---------- bootstrap: toàn bộ dữ liệu theo quyền ----------
async function bootstrap(env, u){
  const staff = isStaff(u);
  const pricingRow = await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first();
  const groups = (await env.DB.prepare(`SELECT * FROM groups`).all()).results.map(rowGroup);
  const topics = (await env.DB.prepare(`SELECT * FROM content_topics`).all()).results.map(rowTopic);
  const cmtsug = (await env.DB.prepare(`SELECT * FROM cmt_suggestions`).all()).results.map(rowCmtSug);
  const users = staff ? (await env.DB.prepare(`SELECT * FROM users`).all()).results.map(rowUser) : [rowUser(u)];
  const postSql = staff ? `SELECT * FROM post_seedings` : `SELECT * FROM post_seedings WHERE sales_id=?`;
  const cmtSql  = staff ? `SELECT * FROM cmt_seedings`  : `SELECT * FROM cmt_seedings WHERE sales_id=?`;
  const posts = (await (staff ? env.DB.prepare(postSql) : env.DB.prepare(postSql).bind(u.id)).all()).results;
  const cmts  = (await (staff ? env.DB.prepare(cmtSql)  : env.DB.prepare(cmtSql).bind(u.id)).all()).results;
  // proofs
  const proofRows = (await env.DB.prepare(`SELECT * FROM cmt_proofs`).all()).results;
  const proofsByCmt = {};
  for(const p of proofRows){ (proofsByCmt[p.cmt_seeding_id] ||= []).push({ id:p.id, image_url:p.image_url, uploaded_at:p.uploaded_at }); }
  const cmtsFull = cmts.map(c=>({ ...c, proofs: proofsByCmt[c.id]||[] }));
  const audit = staff ? (await env.DB.prepare(`SELECT * FROM audit ORDER BY at DESC LIMIT 200`).all()).results : [];

  // ---- QUAY CÔNG TRÌNH ----
  const ftpls  = (await env.DB.prepare(`SELECT * FROM filming_templates`).all()).results;
  const fphs   = (await env.DB.prepare(`SELECT * FROM filming_phases`).all()).results;
  const fshots = (await env.DB.prepare(`SELECT * FROM filming_shots`).all()).results;
  const filming_templates = ftpls.map(t=>({
    id:t.id, ten:t.ten, he_san_pham:t.he_san_pham, active:uBool(t.active),
    phases: fphs.filter(p=>p.template_id===t.id).sort((a,b)=>(a.thu_tu||0)-(b.thu_tu||0)).map(p=>({
      id:p.id, ten:p.ten, thu_tu:p.thu_tu,
      shots: fshots.filter(s=>s.phase_id===p.id).sort((a,b)=>(a.thu_tu||0)-(b.thu_tu||0)).map(s=>({
        id:s.id, ten:s.ten, mo_ta:s.mo_ta, source_mau_url:s.source_mau_url, bat_buoc:uBool(s.bat_buoc), thu_tu:s.thu_tu, active:uBool(s.active),
      })),
    })),
  }));
  const pfSql = staff ? `SELECT * FROM project_filmings` : `SELECT * FROM project_filmings WHERE sales_id=?`;
  const pfRows = (await (staff ? env.DB.prepare(pfSql) : env.DB.prepare(pfSql).bind(u.id)).all()).results;
  const fups = (await env.DB.prepare(`SELECT * FROM filming_uploads`).all()).results;
  const project_filmings = pfRows.map(p=>({
    ...p, uploads: fups.filter(x=>x.project_filming_id===p.id).map(x=>({ id:x.id, shot_id:x.shot_id, media_type:x.media_type, media_url:x.media_url, dat_item:x.dat_item==null?null:uBool(x.dat_item) })),
  }));

  return {
    me: rowUser(u),
    users, groups, content_topics:topics, cmt_suggestions:cmtsug,
    post_seedings: posts, cmt_seedings: cmtsFull,
    filming_templates, project_filmings,
    pricing: pricingRow, payouts: [], audit,
  };
}

// ============================================================
//  ROUTER
// ============================================================
async function handleApi(request, env){
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/,'');
  const method = request.method;

  // Upload media lên R2 (đọc nhị phân — không parse JSON)
  if(path==='/filming/upload' && method==='POST'){
    await ensureSchema(env);
    const sess = await getSession(env, request);
    if(!sess) return json({error:'Chưa đăng nhập'}, 401);
    if(!env.MEDIA) return json({error:'Chưa cấu hình kho lưu file (R2 MEDIA) — dùng tạm tab Dán link Drive'}, 503);
    const ct = url.searchParams.get('type') || request.headers.get('content-type') || 'application/octet-stream';
    const buf = await request.arrayBuffer();
    if(!buf || buf.byteLength===0) return json({error:'File rỗng'}, 400);
    const ext = ((ct.split('/')[1]||'bin').split(';')[0]).replace(/[^a-z0-9]/gi,'') || 'bin';
    const key = 'filming/'+uid('m')+'.'+ext;
    await env.MEDIA.put(key, buf, { httpMetadata:{ contentType: ct } });
    return json({ media_url: '/media/'+key, media_type: ct.startsWith('image/') ? 'IMAGE' : 'VIDEO' });
  }

  const body = (method==='POST'||method==='PATCH') ? await request.json().catch(()=>({})) : {};

  await ensureSchema(env);

  // --- đăng nhập ---
  if(path==='/login' && method==='POST'){
    const email = (body.email||'').trim().toLowerCase();
    const u = await env.DB.prepare(`SELECT * FROM users WHERE lower(email)=?`).bind(email).first();
    if(!u) return json({error:'Email chưa đăng ký'}, 401);
    if(!(await verifyPassword(body.password||'', u.password))) return json({error:'Sai mật khẩu'}, 401);
    if(!u.active) return json({error:'Tài khoản đang bị khoá — liên hệ Marketing'}, 403);
    const token = crypto.randomUUID()+crypto.randomUUID().replace(/-/g,'');
    const exp = new Date(Date.now()+30*864e5).toISOString();
    await env.DB.prepare(`INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)`).bind(token,u.id,exp).run();
    return json({ token, db: await bootstrap(env, u) });
  }

  // các route dưới đây cần đăng nhập
  const sess = await getSession(env, request);
  if(!sess) return json({error:'Chưa đăng nhập'}, 401);
  const me = sess.user;

  if(path==='/logout' && method==='POST'){ await env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(sess.token).run(); return json({ok:true}); }
  if(path==='/bootstrap' && method==='GET'){ return json({ db: await bootstrap(env, me) }); }

  // --- hồ sơ cá nhân: bất kỳ ai cũng tự đổi TÊN HIỂN THỊ (và mật khẩu) của chính mình ---
  if(path==='/me' && method==='PATCH'){
    const name = (body.ho_ten||'').trim();
    if(!name) return json({error:'Nhập tên hiển thị'},400);
    if(body.password){
      const pass = await hashPassword(body.password);
      await env.DB.prepare(`UPDATE users SET ho_ten=?, password=? WHERE id=?`).bind(name, pass, me.id).run();
    } else {
      await env.DB.prepare(`UPDATE users SET ho_ten=? WHERE id=?`).bind(name, me.id).run();
    }
    await logAudit(env, me, 'đổi hồ sơ cá nhân','user',me.id);
    const meNew = await env.DB.prepare(`SELECT * FROM users WHERE id=?`).bind(me.id).first();
    return json({ db: await bootstrap(env, meNew) });
  }

  // ===== TÀI KHOẢN (staff) =====
  if(path==='/users' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const email=(body.email||'').trim().toLowerCase();
    if(!body.ho_ten||!email||!body.password) return json({error:'Nhập đủ họ tên, email, mật khẩu'},400);
    const dup = await env.DB.prepare(`SELECT id FROM users WHERE lower(email)=?`).bind(email).first();
    if(dup) return json({error:'Email đã tồn tại'},409);
    const id=uid('u'); const pass=await hashPassword(body.password);
    await env.DB.prepare(`INSERT INTO users (id,ho_ten,email,password,vai_tro,active,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(id,body.ho_ten.trim(),email,pass,body.vai_tro||ROLES.SALES,bool(body.active!==false),nowISO()).run();
    await logAudit(env,me,'tạo tài khoản','user',id,body.vai_tro);
    return json({ db: await bootstrap(env, me) });
  }
  let m;
  if((m=path.match(/^\/users\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const u=await env.DB.prepare(`SELECT * FROM users WHERE id=?`).bind(id).first();
    if(!u) return json({error:'Không tìm thấy'},404);
    const activeMkt = (await env.DB.prepare(`SELECT COUNT(*) n FROM users WHERE active=1 AND vai_tro=?`).bind(ROLES.MARKETING).first()).n;
    const newRole = body.vai_tro ?? u.vai_tro;
    const newActive = body.active!=null ? bool(body.active) : u.active;
    if(u.vai_tro===ROLES.MARKETING && u.active && activeMkt<=1 && (newRole!==ROLES.MARKETING || !newActive))
      return json({error:'Phải còn ít nhất 1 Marketing đang hoạt động'},400);
    const pass = body.password ? await hashPassword(body.password) : u.password;
    await env.DB.prepare(`UPDATE users SET ho_ten=?, vai_tro=?, active=?, password=? WHERE id=?`)
      .bind(body.ho_ten??u.ho_ten, newRole, newActive, pass, id).run();
    await logAudit(env,me,'sửa tài khoản','user',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/users\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1];
    if(id===me.id) return json({error:'Không thể xoá chính mình'},400);
    await env.DB.prepare(`DELETE FROM users WHERE id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(id).run();
    await logAudit(env,me,'xoá tài khoản','user',id);
    return json({ db: await bootstrap(env, me) });
  }

  // ===== THƯ VIỆN (staff) =====
  const libCfg = {
    groups: { table:'groups', cols:['ten_group','link','loai','so_member','active','uu_tien'] },
    topics: { table:'content_topics', cols:['chu_de','noi_dung','loai_bai','muc_tieu','tags','active','uu_tien'] },
    cmtsug: { table:'cmt_suggestions', cols:['noi_dung_goi_y','tuyen','loai_bai','tags','thu_tu','active'] },
  };
  for(const key of Object.keys(libCfg)){
    const cfg = libCfg[key];
    const prep = (obj)=>{ const o={...obj}; if('tags' in o) o.tags=JSON.stringify(o.tags||[]); if('active' in o) o.active=bool(o.active!==false); if('uu_tien' in o) o.uu_tien=bool(o.uu_tien); return o; };
    if(path===`/${key}` && method==='POST'){
      if(!isStaff(me)) return json({error:'Không có quyền'},403);
      const o=prep(body); const id=uid(key[0]); const cols=cfg.cols;
      const vals=cols.map(c=> c in o ? o[c] : (c==='active'?1:(c==='so_member'||c==='thu_tu'||c==='uu_tien'?0:null)));
      await env.DB.prepare(`INSERT INTO ${cfg.table} (id,${cols.join(',')},updated_at) VALUES (?,${cols.map(()=>'?').join(',')},?)`).bind(id,...vals,nowISO()).run();
      await logAudit(env,me,'thêm','lib:'+key,id);
      return json({ db: await bootstrap(env, me) });
    }
    if((m=path.match(new RegExp(`^/${key}/(.+)$`))) && method==='PATCH'){
      if(!isStaff(me)) return json({error:'Không có quyền'},403);
      const id=m[1]; const o=prep(body);
      const sets=cfg.cols.filter(c=>c in o); if(!sets.length) return json({error:'Không có gì để sửa'},400);
      await env.DB.prepare(`UPDATE ${cfg.table} SET ${sets.map(c=>c+'=?').join(',')}, updated_at=? WHERE id=?`).bind(...sets.map(c=>o[c]),nowISO(),id).run();
      await logAudit(env,me,'sửa','lib:'+key,id);
      return json({ db: await bootstrap(env, me) });
    }
    if((m=path.match(new RegExp(`^/${key}/(.+)$`))) && method==='DELETE'){
      if(!isStaff(me)) return json({error:'Không có quyền'},403);
      await env.DB.prepare(`DELETE FROM ${cfg.table} WHERE id=?`).bind(m[1]).run();
      await logAudit(env,me,'xoá','lib:'+key,m[1]);
      return json({ db: await bootstrap(env, me) });
    }
  }

  // ===== ĐƠN GIÁ (admin) =====
  if(path==='/pricing' && method==='PATCH'){
    if(me.vai_tro!==ROLES.ADMIN && me.vai_tro!==ROLES.MARKETING) return json({error:'Không có quyền'},403);
    const p=body;
    await env.DB.prepare(`UPDATE pricing SET don_gia_post=?, don_gia_cmt=?, don_gia_cong_trinh=?, min_nhac_kingsmen=?, min_usp=? WHERE id=1`)
      .bind(Number(p.don_gia_post)||0,Number(p.don_gia_cmt)||0,Number(p.don_gia_cong_trinh)||0,Number(p.min_nhac_kingsmen)||0,Number(p.min_usp)||0).run();
    await logAudit(env,me,'sửa đơn giá','pricing','-');
    return json({ db: await bootstrap(env, me) });
  }

  // ===== POST SEEDING =====
  if(path==='/posts' && method==='POST'){
    const id=uid('p');
    const status = body.submit ? ST.CHO_DUYET : ST.NHAP;
    await env.DB.prepare(`INSERT INTO post_seedings (id,topic_id,sales_id,group_id,link_bai,react,so_cmt_seeding,so_cmt_tu_nhien,trang_thai,ly_do_loai,thanh_tien,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
      .bind(id, body.topic_id||null, me.id, body.group_id||null, (body.link_bai||'').trim(), Number(body.react)||0, Number(body.so_cmt_seeding)||0, Number(body.so_cmt_tu_nhien)||0, status, '', nowISO()).run();
    await logAudit(env,me, body.submit?'gửi nghiệm thu':'tạo nháp','post_seeding',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/posts\/(.+)\/review$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const p=await env.DB.prepare(`SELECT * FROM post_seedings WHERE id=?`).bind(id).first();
    if(!p) return json({error:'Không tìm thấy'},404);
    const pricing=await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first();
    if(body.result===ST.DAT){
      await env.DB.prepare(`UPDATE post_seedings SET trang_thai=?, thanh_tien=?, reviewed_by=?, reviewed_at=?, ky_thanh_toan=?, ly_do_loai='' WHERE id=?`)
        .bind(ST.DAT, pricing.don_gia_post, me.ho_ten, nowISO(), kyOf(), id).run();
      await logAudit(env,me,'nghiệm thu ĐẠT','post_seeding',id);
    } else {
      if(!body.reason) return json({error:'Cần lý do'},400);
      await env.DB.prepare(`UPDATE post_seedings SET trang_thai=?, thanh_tien=0, reviewed_by=?, reviewed_at=?, ly_do_loai=? WHERE id=?`)
        .bind(ST.KHONG_DAT, me.ho_ten, nowISO(), body.reason, id).run();
      await logAudit(env,me,'nghiệm thu KHÔNG ĐẠT','post_seeding',id,body.reason);
    }
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CMT SEEDING =====
  if(path==='/cmtseed' && method==='POST'){
    const id=uid('c');
    const status = body.submit ? ST.CHO_DUYET : ST.NHAP;
    await env.DB.prepare(`INSERT INTO cmt_seedings (id,loai,post_seeding_id,post_link,suggestion_id,sales_id,so_cmt_seeding,react,so_cmt_tu_nhien,trang_thai,ly_do_loai,thanh_tien,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?)`)
      .bind(id, body.loai, body.post_seeding_id||null, (body.post_link||'').trim(), body.suggestion_id||null, me.id, Number(body.so_cmt_seeding)||0, Number(body.react)||0, Number(body.so_cmt_tu_nhien)||0, status, '', nowISO()).run();
    const proofs = Array.isArray(body.proofs)?body.proofs:[];
    for(const img of proofs){
      await env.DB.prepare(`INSERT INTO cmt_proofs (id,cmt_seeding_id,image_url,uploaded_at) VALUES (?,?,?,?)`).bind(uid('img'),id,img,nowISO()).run();
    }
    await logAudit(env,me, body.submit?'gửi nghiệm thu':'tạo nháp','cmt_seeding',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/cmtseed\/(.+)\/review$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const c=await env.DB.prepare(`SELECT * FROM cmt_seedings WHERE id=?`).bind(id).first();
    if(!c) return json({error:'Không tìm thấy'},404);
    const pricing=await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first();
    if(body.result===ST.DAT){
      const tien = (Number(c.so_cmt_seeding)||0)*pricing.don_gia_cmt;
      await env.DB.prepare(`UPDATE cmt_seedings SET trang_thai=?, thanh_tien=?, reviewed_by=?, reviewed_at=?, ky_thanh_toan=?, ly_do_loai='' WHERE id=?`)
        .bind(ST.DAT, tien, me.ho_ten, nowISO(), kyOf(), id).run();
      await logAudit(env,me,'nghiệm thu ĐẠT','cmt_seeding',id);
    } else {
      if(!body.reason) return json({error:'Cần lý do'},400);
      await env.DB.prepare(`UPDATE cmt_seedings SET trang_thai=?, thanh_tien=0, reviewed_by=?, reviewed_at=?, ly_do_loai=? WHERE id=?`)
        .bind(ST.KHONG_DAT, me.ho_ten, nowISO(), body.reason, id).run();
      await logAudit(env,me,'nghiệm thu KHÔNG ĐẠT','cmt_seeding',id,body.reason);
    }
    return json({ db: await bootstrap(env, me) });
  }

  // ===== ĐÁNH DẤU ĐÃ CHI (admin/marketing) =====
  if(path==='/markpaid' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const { sales_id, ky } = body;
    const kyCond = ky ? ` AND ky_thanh_toan=?` : ``;
    const args = ky ? [sales_id, ky] : [sales_id];
    await env.DB.prepare(`UPDATE post_seedings SET trang_thai='DA_CHI' WHERE sales_id=? AND trang_thai='DAT'${kyCond}`).bind(...args).run();
    await env.DB.prepare(`UPDATE cmt_seedings SET trang_thai='DA_CHI' WHERE sales_id=? AND trang_thai='DAT'${kyCond}`).bind(...args).run();
    await env.DB.prepare(`UPDATE project_filmings SET trang_thai='DA_CHI' WHERE sales_id=? AND trang_thai='DAT'${kyCond}`).bind(...args).run();
    await logAudit(env,me,'đánh dấu ĐÃ CHI','payroll',sales_id,'kỳ '+(ky||'all'));
    return json({ db: await bootstrap(env, me) });
  }

  // ===== QUAY CÔNG TRÌNH — QUY TRÌNH (staff) =====
  if(path==='/filming/templates' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!body.ten||!body.he_san_pham) return json({error:'Nhập hệ sản phẩm & tên quy trình'},400);
    const id=uid('tpl');
    await env.DB.prepare(`INSERT INTO filming_templates (id,ten,he_san_pham,active,updated_at) VALUES (?,?,?,1,?)`).bind(id,body.ten,body.he_san_pham,nowISO()).run();
    await logAudit(env,me,'thêm','filming_template',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/templates\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const t=await env.DB.prepare(`SELECT * FROM filming_templates WHERE id=?`).bind(id).first();
    if(!t) return json({error:'Không tìm thấy'},404);
    await env.DB.prepare(`UPDATE filming_templates SET ten=?, he_san_pham=?, active=?, updated_at=? WHERE id=?`)
      .bind(body.ten??t.ten, body.he_san_pham??t.he_san_pham, body.active!=null?bool(body.active):t.active, nowISO(), id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/templates\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1];
    const phs=(await env.DB.prepare(`SELECT id FROM filming_phases WHERE template_id=?`).bind(id).all()).results;
    for(const p of phs) await env.DB.prepare(`DELETE FROM filming_shots WHERE phase_id=?`).bind(p.id).run();
    await env.DB.prepare(`DELETE FROM filming_phases WHERE template_id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM filming_templates WHERE id=?`).bind(id).run();
    await logAudit(env,me,'xoá','filming_template',id);
    return json({ db: await bootstrap(env, me) });
  }
  // giai đoạn
  if(path==='/filming/phases' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=uid('ph');
    const n=(await env.DB.prepare(`SELECT COUNT(*) c FROM filming_phases WHERE template_id=?`).bind(body.template_id).first()).c;
    await env.DB.prepare(`INSERT INTO filming_phases (id,template_id,ten,thu_tu) VALUES (?,?,?,?)`).bind(id,body.template_id,body.ten||'',Number(n)+1).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/phases\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`UPDATE filming_phases SET ten=? WHERE id=?`).bind(body.ten||'',m[1]).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/phases\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM filming_shots WHERE phase_id=?`).bind(m[1]).run();
    await env.DB.prepare(`DELETE FROM filming_phases WHERE id=?`).bind(m[1]).run();
    return json({ db: await bootstrap(env, me) });
  }
  // cảnh
  if(path==='/filming/shots' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!body.ten) return json({error:'Nhập tên cảnh'},400);
    const id=uid('sh');
    const n=(await env.DB.prepare(`SELECT COUNT(*) c FROM filming_shots WHERE phase_id=?`).bind(body.phase_id).first()).c;
    await env.DB.prepare(`INSERT INTO filming_shots (id,phase_id,ten,mo_ta,source_mau_url,bat_buoc,thu_tu,active) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id,body.phase_id,body.ten,body.mo_ta||'',body.source_mau_url||'',bool(body.bat_buoc!==false),Number(n)+1,bool(body.active!==false)).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/shots\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const s=await env.DB.prepare(`SELECT * FROM filming_shots WHERE id=?`).bind(id).first();
    if(!s) return json({error:'Không tìm thấy'},404);
    await env.DB.prepare(`UPDATE filming_shots SET ten=?, mo_ta=?, source_mau_url=?, bat_buoc=?, active=? WHERE id=?`)
      .bind(body.ten??s.ten, body.mo_ta??s.mo_ta, body.source_mau_url??s.source_mau_url, body.bat_buoc!=null?bool(body.bat_buoc):s.bat_buoc, body.active!=null?bool(body.active):s.active, id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/shots\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM filming_shots WHERE id=?`).bind(m[1]).run();
    return json({ db: await bootstrap(env, me) });
  }
  // công trình quay (Sales tạo & gửi nghiệm thu)
  if(path==='/filming/projects' && method==='POST'){
    const tpl = await env.DB.prepare(`SELECT id FROM filming_templates WHERE id=?`).bind(body.template_id).first();
    if(!tpl) return json({error:'Quy trình không tồn tại'},400);
    if(!body.ten_cong_trinh) return json({error:'Nhập tên công trình'},400);
    // kiểm tra đủ cảnh bắt buộc
    const req = (await env.DB.prepare(`SELECT s.id FROM filming_shots s JOIN filming_phases p ON s.phase_id=p.id WHERE p.template_id=? AND s.active=1 AND s.bat_buoc=1`).bind(body.template_id).all()).results.map(x=>x.id);
    const uploaded = new Set((Array.isArray(body.uploads)?body.uploads:[]).map(u=>u.shot_id));
    if(!req.every(id=>uploaded.has(id))) return json({error:'Chưa đủ media cho các cảnh bắt buộc'},400);
    const id=uid('pf');
    await env.DB.prepare(`INSERT INTO project_filmings (id,sales_id,template_id,ten_cong_trinh,khu_vuc,ngay_quay,trang_thai,ly_do_loai,thanh_tien,created_at) VALUES (?,?,?,?,?,?,?,'',0,?)`)
      .bind(id, me.id, body.template_id, body.ten_cong_trinh, body.khu_vuc||'', body.ngay_quay||nowISO(), ST.CHO_DUYET, nowISO()).run();
    for(const up of (Array.isArray(body.uploads)?body.uploads:[])){
      await env.DB.prepare(`INSERT INTO filming_uploads (id,project_filming_id,shot_id,media_type,media_url,uploaded_at) VALUES (?,?,?,?,?,?)`)
        .bind(uid('up'), id, up.shot_id||null, up.media_type||'VIDEO', (up.media_url||'').trim(), nowISO()).run();
    }
    await logAudit(env,me,'gửi nghiệm thu','project_filming',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/projects\/(.+)\/review$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const p=await env.DB.prepare(`SELECT * FROM project_filmings WHERE id=?`).bind(id).first();
    if(!p) return json({error:'Không tìm thấy'},404);
    const pricing=await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first();
    if(body.result===ST.DAT){
      await env.DB.prepare(`UPDATE project_filmings SET trang_thai=?, thanh_tien=?, reviewed_by=?, reviewed_at=?, ky_thanh_toan=?, ly_do_loai='' WHERE id=?`)
        .bind(ST.DAT, Number(pricing.don_gia_cong_trinh)||0, me.ho_ten, nowISO(), kyOf(), id).run();
      await logAudit(env,me,'nghiệm thu ĐẠT','project_filming',id);
    } else {
      if(!body.reason) return json({error:'Cần lý do'},400);
      await env.DB.prepare(`UPDATE project_filmings SET trang_thai=?, thanh_tien=0, reviewed_by=?, reviewed_at=?, ly_do_loai=? WHERE id=?`)
        .bind(ST.KHONG_DAT, me.ho_ten, nowISO(), body.reason, id).run();
      await logAudit(env,me,'nghiệm thu KHÔNG ĐẠT','project_filming',id,body.reason);
    }
    return json({ db: await bootstrap(env, me) });
  }

  return json({error:'Route không tồn tại: '+method+' '+path}, 404);
}

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      if(request.method==='OPTIONS') return new Response(null, { status:204, headers:CORS });
      try { return await handleApi(request, env); }
      catch(e){ return json({error:'Lỗi server: '+(e.message||e)}, 500); }
    }
    // media từ R2 (ảnh/video Sales tải lên app)
    if(url.pathname.startsWith('/media/')){
      if(!env.MEDIA) return new Response('R2 chưa cấu hình', { status:503 });
      const key = decodeURIComponent(url.pathname.slice('/media/'.length));
      const obj = await env.MEDIA.get(key);
      if(!obj) return new Response('Not found', { status:404 });
      const h = new Headers();
      obj.writeHttpMetadata(h);
      h.set('etag', obj.httpEtag);
      h.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(obj.body, { headers:h });
    }
    // web tĩnh
    const res = await env.ASSETS.fetch(request);
    // HTML luôn revalidate để người dùng nhận bản deploy mới ngay (tránh kẹt cache cũ)
    const ct = res.headers.get('content-type') || '';
    if(ct.includes('text/html')){
      const h = new Headers(res.headers);
      h.set('Cache-Control', 'no-cache, must-revalidate');
      return new Response(res.body, { status:res.status, statusText:res.statusText, headers:h });
    }
    return res;
  }
};
