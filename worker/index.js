// ============================================================
//  KINGSMEN SEEDING — Cloudflare Worker (API + D1) + web tĩnh
//  - Phục vụ app tĩnh từ dist/ (binding ASSETS)
//  - /api/* : server (đăng nhập, tạo tài khoản, CRUD, tính tiền)
//  - Dữ liệu dùng chung trong Cloudflare D1 (binding DB)
// ============================================================

const ROLES = { MARKETING:'MARKETING', SALES:'SALES', ADMIN:'ADMIN', KY_THUAT:'KY_THUAT' };
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
    `CREATE TABLE IF NOT EXISTS filming_shots (id TEXT PRIMARY KEY, phase_id TEXT, ten TEXT, mo_ta TEXT, source_mau_url TEXT, bat_buoc INTEGER DEFAULT 1, thu_tu INTEGER, active INTEGER DEFAULT 1, don_gia REAL)`,
    `CREATE TABLE IF NOT EXISTS project_filmings (id TEXT PRIMARY KEY, sales_id TEXT, template_id TEXT, ten_cong_trinh TEXT, khu_vuc TEXT, ngay_quay TEXT, trang_thai TEXT, reviewed_by TEXT, reviewed_at TEXT, ly_do_loai TEXT, thanh_tien REAL, ky_thanh_toan TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS filming_uploads (id TEXT PRIMARY KEY, project_filming_id TEXT, shot_id TEXT, media_type TEXT, media_url TEXT, dat_item INTEGER, ghi_chu TEXT, uploaded_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS guides (key TEXT PRIMARY KEY, noi_dung TEXT, video_url TEXT, updated_at TEXT)`,
    // Ưu tiên/ẩn-hiện từng LOẠI BÀI theo giai đoạn (an=1: ẩn khỏi Sales · uu_tien=1: ưu tiên)
    `CREATE TABLE IF NOT EXISTS post_type_prefs (loai TEXT PRIMARY KEY, an INTEGER DEFAULT 0, uu_tien INTEGER DEFAULT 0, thu_tu INTEGER)`,
    // Lịch đăng POST: mỗi ngày đủ điều kiện 1 suất, xoay vòng Sales + chủ đề gợi ý
    `CREATE TABLE IF NOT EXISTS post_slots (id TEXT PRIMARY KEY, ngay TEXT UNIQUE, sales_id TEXT, topic_id TEXT, post_id TEXT, status TEXT, created_at TEXT)`,
    // Thư viện ảnh dùng chung (MKT + Sales cùng tải) để seeding POST/CMT
    `CREATE TABLE IF NOT EXISTS media_library (id TEXT PRIMARY KEY, media_url TEXT, caption TEXT, muc_dich TEXT, topic_id TEXT, tags TEXT, uploaded_by TEXT, uploaded_by_name TEXT, active INTEGER DEFAULT 1, uploaded_at TEXT)`,
    // CONTENT OS · P1 — Dữ liệu nền: sản phẩm (spec thật) + cụm từ claim bị cấm
    `CREATE TABLE IF NOT EXISTS san_pham (id TEXT PRIMARY KEY, ma TEXT, ten TEXT, dong TEXT, thong_so TEXT, tieu_chuan TEXT, huong_dan TEXT, anh TEXT, active INTEGER DEFAULT 1, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS claim_cam (id TEXT PRIMARY KEY, cum_tu TEXT, ly_do TEXT, muc_do TEXT, active INTEGER DEFAULT 1, created_at TEXT)`,
    // CONTENT OS · P2 — Chiến lược & Pillar (trụ cột nội dung + OKR/Big Idea)
    `CREATE TABLE IF NOT EXISTS pillars (id TEXT PRIMARY KEY, ten TEXT, objective TEXT, point_of_difference TEXT, request TEXT, ty_trong REAL, thu_tu INTEGER, active INTEGER DEFAULT 1, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS content_strategy (id INTEGER PRIMARY KEY, okr TEXT, big_idea TEXT, purpose TEXT, audience TEXT, swot TEXT, updated_at TEXT)`,
    // CONTENT OS · P3 — Kế hoạch & lịch: nhóm kịch bản, kênh, và content_item (trung tâm)
    `CREATE TABLE IF NOT EXISTS frameworks (id TEXT PRIMARY KEY, ten TEXT, mo_ta TEXT, thu_tu INTEGER, active INTEGER DEFAULT 1, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS kenh (id TEXT PRIMARY KEY, ten TEXT, loai TEXT, thuong_hieu TEXT, active INTEGER DEFAULT 1, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS content_items (id TEXT PRIMARY KEY, loai TEXT, tieu_de TEXT, loai_muc_tieu TEXT, pillar_id TEXT, framework_id TEXT, san_pham_id TEXT, kenh_id TEXT, thang TEXT, trang_thai TEXT, pic TEXT, chi_tiet TEXT, links TEXT, created_at TEXT, created_by TEXT, created_by_name TEXT, updated_at TEXT)`,
    // CONTENT OS · P4 — Creative Studio: kịch bản có guardrail (chỉ trích spec thật, chặn claim cấm) + lịch sử phiên bản
    `CREATE TABLE IF NOT EXISTS scripts (id TEXT PRIMARY KEY, content_item_id TEXT, framework_id TEXT, san_pham_id TEXT, kenh_id TEXT, tieu_de TEXT, hook TEXT, sections TEXT, cta TEXT, brand_voice TEXT, claim_flags TEXT, trang_thai TEXT, version INTEGER DEFAULT 1, created_at TEXT, created_by TEXT, created_by_name TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS script_versions (id TEXT PRIMARY KEY, script_id TEXT, version INTEGER, snapshot TEXT, created_at TEXT, created_by_name TEXT)`,
    // CONTENT OS · P6 — Hàng đợi duyệt 2 CỔNG SONG SONG: NOI_DUNG (Marketing) + CLAIM (Kỹ thuật)
    `CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, doi_tuong TEXT, doi_tuong_id TEXT, cong TEXT, trang_thai TEXT, nguoi_gui TEXT, nguoi_gui_ten TEXT, nguoi_duyet TEXT, nguoi_duyet_ten TEXT, ghi_chu TEXT, created_at TEXT, decided_at TEXT)`,
    // CONTENT OS · P7 — Đăng thủ công theo checklist (KHÔNG auto-post) + khoá mã theo dõi (1 mã = 1 bài, khoá cho P8)
    `CREATE TABLE IF NOT EXISTS air_posts (id TEXT PRIMARY KEY, content_item_id TEXT, script_id TEXT, kenh_id TEXT, tieu_de TEXT, ngay_dang TEXT, link_bai TEXT, ma_theo_doi TEXT, loai_ma TEXT, checklist TEXT, ghi_chu TEXT, trang_thai TEXT, nguoi_dang TEXT, nguoi_dang_ten TEXT, created_at TEXT, updated_at TEXT, posted_at TEXT)`,
    // 1 mã theo dõi chỉ thuộc 1 bài → tránh "1 voucher nhiều video" làm P8 không quy đơn được
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_air_ma ON air_posts(ma_theo_doi) WHERE ma_theo_doi IS NOT NULL AND ma_theo_doi<>''`,
    // CONTENT OS · P8 — Kết quả với 3 MỨC TIN CẬY (TUYỆT ĐỐI KHÔNG cộng dồn 3 mức thành "doanh thu từ content")
    `CREATE TABLE IF NOT EXISTS ket_qua (id TEXT PRIMARY KEY, air_post_id TEXT, muc_tin_cay TEXT, nguon TEXT, ky TEXT, doanh_thu REAL DEFAULT 0, so_don INTEGER DEFAULT 0, luot_xem INTEGER DEFAULT 0, luot_tuong_tac INTEGER DEFAULT 0, luot_click INTEGER DEFAULT 0, ma_theo_doi TEXT, ghi_chu TEXT, created_at TEXT, created_by TEXT, created_by_name TEXT)`,
    // Đơn không khớp được 1 bài duy nhất → CHỜ GÁN TAY, KHÔNG chia đều (ràng buộc §9)
    `CREATE TABLE IF NOT EXISTS don_cho_gan (id TEXT PRIMARY KEY, nguon TEXT, ma_doi_soat TEXT, doanh_thu REAL DEFAULT 0, so_don INTEGER DEFAULT 0, ky TEXT, ly_do TEXT, trang_thai TEXT, air_post_id TEXT, created_at TEXT, decided_at TEXT, decided_by_name TEXT)`,
    // CONTENT OS · P5 — Kho footage tái sử dụng + shot list bám theo kịch bản
    `CREATE TABLE IF NOT EXISTS footage (id TEXT PRIMARY KEY, ten TEXT, mo_ta TEXT, media_url TEXT, media_type TEXT, tags TEXT, san_pham_id TEXT, kenh_id TEXT, dia_diem TEXT, ngay_quay TEXT, nguoi_quay TEXT, active INTEGER DEFAULT 1, created_at TEXT, created_by TEXT, created_by_name TEXT)`,
    `CREATE TABLE IF NOT EXISTS shot_list (id TEXT PRIMARY KEY, script_id TEXT, thu_tu INTEGER, ten_canh TEXT, mo_ta TEXT, goc_may TEXT, thoi_luong INTEGER, footage_id TEXT, trang_thai TEXT, ghi_chu TEXT, created_at TEXT, updated_at TEXT)`,
    // CONTENT OS · TREND — nghiên cứu & triển khai. KHÔNG scrape (ToS): người tự ghi nhận + đánh giá.
    `CREATE TABLE IF NOT EXISTS trends (id TEXT PRIMARY KEY, ten TEXT, nguon TEXT, link TEXT, mo_ta TEXT, phat_hien_ngay TEXT, han_dung TEXT, pillar_id TEXT, san_pham_id TEXT, danh_gia TEXT, rui_ro TEXT, trang_thai TEXT, ly_do TEXT, nguoi_de_xuat TEXT, nguoi_duyet_ten TEXT, content_item_id TEXT, script_id TEXT, created_at TEXT, decided_at TEXT)`,
    // CONTENT OS · P10 — Thư viện học. ĐỀ XUẤT do máy rút ra nhưng PHẢI người duyệt mới thành quy tắc.
    `CREATE TABLE IF NOT EXISTS bai_hoc (id TEXT PRIMARY KEY, loai TEXT, tieu_de TEXT, noi_dung TEXT, bang_chung TEXT, so_mau INTEGER DEFAULT 0, nguon_tu_dong INTEGER DEFAULT 0, trang_thai TEXT, nguoi_duyet_ten TEXT, ghi_chu TEXT, created_at TEXT, decided_at TEXT)`,
  ];
  await env.DB.batch(stmts.map(s=>env.DB.prepare(s)));
  // thêm cột đơn giá quay công trình cho DB cũ (bỏ qua nếu đã có)
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN don_gia_cong_trinh REAL DEFAULT 150000`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN don_gia_canh REAL DEFAULT 10000`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE filming_shots ADD COLUMN don_gia REAL`).run(); } catch(e){}
  // chống spam: số ngày coi là "trùng nội dung–nhóm" (0 = tắt kiểm tra trùng)
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN dedupe_days INTEGER DEFAULT 7`).run(); } catch(e){}
  // nghiệm thu quay công trình theo 3 mức chất lượng mỗi source (Kế toán/Admin cấu hình)
  try { await env.DB.prepare(`ALTER TABLE filming_uploads ADD COLUMN level INTEGER`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN film_lv1 REAL DEFAULT 5000`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN film_lv2 REAL DEFAULT 10000`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN film_lv3 REAL DEFAULT 15000`).run(); } catch(e){}
  // lịch đăng POST: bật/tắt · chặn cứng · các thứ trong tuần (JS getDay: CN=0..T7=6) mặc định T3,T5,T7,CN
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN sched_on INTEGER DEFAULT 0`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN sched_enforce INTEGER DEFAULT 1`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE pricing ADD COLUMN sched_days TEXT DEFAULT '0,2,4,6'`).run(); } catch(e){}
  // P4 — brand voice (tông giọng thương hiệu) dùng cho Creative Studio
  try { await env.DB.prepare(`ALTER TABLE content_strategy ADD COLUMN brand_voice TEXT DEFAULT ''`).run(); } catch(e){}
  // LỊCH ĐĂNG TỰ ĐỘNG
  try { await env.DB.prepare(`ALTER TABLE air_posts ADD COLUMN lich_dang TEXT`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE air_posts ADD COLUMN tu_dong INTEGER DEFAULT 0`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE air_posts ADD COLUMN lan_thu INTEGER DEFAULT 0`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE air_posts ADD COLUMN loi TEXT`).run(); } catch(e){}
  // Kênh: bật tự động + định danh trên nền tảng. TOKEN KHÔNG lưu ở DB (xem §bảo mật dưới).
  try { await env.DB.prepare(`ALTER TABLE kenh ADD COLUMN tu_dong_dang INTEGER DEFAULT 0`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE kenh ADD COLUMN api_ma TEXT`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE kenh ADD COLUMN api_object_id TEXT`).run(); } catch(e){}
  // NỐI SEEDING ↔ CONTENT OS: chủ đề seeding biết mình sinh ra từ nội dung nào
  try { await env.DB.prepare(`ALTER TABLE content_topics ADD COLUMN content_item_id TEXT`).run(); } catch(e){}
  // P6 — đếm số lần bị trả lại (chỉ số Process cho P9)
  try { await env.DB.prepare(`ALTER TABLE scripts ADD COLUMN so_lan_tra INTEGER DEFAULT 0`).run(); } catch(e){}
  try { await env.DB.prepare(`ALTER TABLE content_items ADD COLUMN so_lan_tra INTEGER DEFAULT 0`).run(); } catch(e){}
  // cờ DEV PREVIEW: chỉ tài khoản is_dev=1 thấy các module đang nâng cấp
  try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN is_dev INTEGER DEFAULT 0`).run(); } catch(e){}

  // seed pricing
  const pr = await env.DB.prepare(`SELECT id FROM pricing WHERE id=1`).first();
  if(!pr) await env.DB.prepare(`INSERT INTO pricing (id,don_gia_post,don_gia_cmt,don_gia_cong_trinh,don_gia_canh,min_nhac_kingsmen,min_usp,dedupe_days,film_lv1,film_lv2,film_lv3,sched_on,sched_enforce,sched_days) VALUES (1,15000,3000,150000,10000,6,2,7,5000,10000,15000,0,1,'0,2,4,6')`).run();

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

  // seed hướng dẫn mặc định (POST/CMT/QUAY)
  const guideSeed = [
    ['post','Hướng dẫn tạo POST seeding:\n1. Chọn tuyến nội dung phù hợp (ưu tiên mục ⭐).\n2. Chọn group mục tiêu, đăng bài theo brief.\n3. Dán link bài, nhập số react & cmt.\n4. Gửi nghiệm thu để Marketing duyệt.',''],
    ['cmt','Hướng dẫn tạo CMT seeding:\n1. Chọn post cần cmt (hoặc CMT dạo).\n2. Dùng gợi ý nội dung cmt cho tự nhiên.\n3. Up ảnh đã seeding làm bằng chứng.\n4. Nhập số cmt, gửi nghiệm thu.',''],
    ['filming','Hướng dẫn quay công trình:\n1. Chọn quy trình theo hệ sản phẩm.\n2. Xem VIDEO MẪU từng cảnh → quay đúng yêu cầu.\n3. Upload/dán link từng cảnh, đủ cảnh bắt buộc thì Gửi nghiệm thu.',''],
  ];
  for(const [k,txt,vid] of guideSeed){
    const ex = await env.DB.prepare(`SELECT key FROM guides WHERE key=?`).bind(k).first();
    if(!ex) await env.DB.prepare(`INSERT INTO guides (key,noi_dung,video_url,updated_at) VALUES (?,?,?,?)`).bind(k,txt,vid,nowISO()).run();
  }

  // CONTENT OS · P2 — seed trụ cột nội dung THẬT của Kingsmen (từ file kế hoạch social)
  const anyPillar = await env.DB.prepare(`SELECT id FROM pillars LIMIT 1`).first();
  if(!anyPillar){
    const P = [
      ['Branding','Giới thiệu thương hiệu Kingsmen: nguồn gốc xuất xứ, vật liệu công nghệ mới, đội ngũ chuyên gia.','Nguồn gốc thương hiệu · Công nghệ mới · Đội ngũ chuyên gia','Mỗi tuần 1–2 bài branding (tùy thị trường).',50],
      ['Information','Cung cấp thông tin, kiến thức hữu ích về thị trường keo ron gạch và ngành hoàn thiện.','Kiến thức chuyên môn, đáng tin','Xen kẽ bài kiến thức mỗi tuần.',30],
      ['Problems','Giải quyết vấn đề, nỗi đau của tệp khách hàng đang gặp phải.','Chạm đúng nỗi đau thực tế','Bài giải pháp theo pain-point.',15],
      ['Interaction','Nội dung tương tác, chương trình ưu đãi thu hút khách hàng tương tác trực tiếp.','Ưu đãi · minigame · tương tác','Theo dịp/khuyến mãi.',5],
    ];
    let so=1;
    for(const [ten,obj,pod,req,ty] of P){
      await env.DB.prepare(`INSERT INTO pillars (id,ten,objective,point_of_difference,request,ty_trong,thu_tu,active,created_at) VALUES (?,?,?,?,?,?,?,1,?)`)
        .bind(uid('pil'),ten,obj,pod,req,ty,so++,nowISO()).run();
    }
  }
  const anyStrat = await env.DB.prepare(`SELECT id FROM content_strategy WHERE id=1`).first();
  if(!anyStrat){
    await env.DB.prepare(`INSERT INTO content_strategy (id,okr,big_idea,purpose,audience,swot,updated_at) VALUES (1,?,?,?,?,?,?)`)
      .bind('Xây dựng nhận diện thương hiệu Kingsmen; tăng tiếp xúc & niềm tin với khách hàng.','Your satisfaction – Our quality – Persistence over time','Tăng độ nhận diện thương hiệu; tiếp xúc khách hàng, tạo niềm tin; thúc đẩy chuyển đổi.','','',nowISO()).run();
  }

  // CONTENT OS · P3 — seed 12 nhóm kịch bản THẬT (từ file ecom) + kênh thật
  const anyFw = await env.DB.prepare(`SELECT id FROM frameworks LIMIT 1`).first();
  if(!anyFw){
    const FW = ['Chuẩn bán hàng','PAS','Phản biện comment','Test chất lượng','Hành trình thi công','Size / Combo','FOMO','Review KOC','"đừng..." Trend','Q&A khách hàng','So sánh kinh tế','Hướng dẫn thi công'];
    let so=1;
    for(const ten of FW) await env.DB.prepare(`INSERT INTO frameworks (id,ten,mo_ta,thu_tu,active,created_at) VALUES (?,?,?,?,1,?)`).bind(uid('fw'),ten,'',so++,nowISO()).run();
  }
  const anyKenh = await env.DB.prepare(`SELECT id FROM kenh LIMIT 1`).first();
  if(!anyKenh){
    const K = [
      ['Fanpage Kingsmen','FANPAGE','Kingsmen'],['TikTok Kingsmen','TIKTOK','Kingsmen'],['YouTube Short Kingsmen','YOUTUBE','Kingsmen'],
      ['Fanpage VKXD','FANPAGE','VKXD'],['TikTok VKXD','TIKTOK','VKXD'],['Shopee VKXD','SHOPEE','VKXD'],['Zalo OA','ZALO_OA','Kingsmen'],
      ['CHÍNH - Vật liệu mới FINEX','TIKTOK','FINEX'],['AFF - Sơn sàn hiệu ứng','TIKTOK','FINEX'],['BC - Vật liệu hoàn thiện','TIKTOK','Kingsmen'],
    ];
    for(const [ten,loai,th] of K) await env.DB.prepare(`INSERT INTO kenh (id,ten,loai,thuong_hieu,active,created_at) VALUES (?,?,?,?,1,?)`).bind(uid('kn'),ten,loai,th,nowISO()).run();
  }

  // Tài khoản ADMIN DEV — chỉ tài khoản này (is_dev=1) thấy module đang nâng cấp. Đổi mật khẩu sau khi nhận.
  const devEx = await env.DB.prepare(`SELECT id FROM users WHERE lower(email)=?`).bind('dev@masfico.vn').first();
  if(!devEx){
    const dpass = await hashPassword('Dev2026!');
    await env.DB.prepare(`INSERT INTO users (id,ho_ten,email,password,vai_tro,active,is_dev,created_at) VALUES (?,?,?,?,?,1,1,?)`)
      .bind(uid('u'),'Admin Dev','dev@masfico.vn',dpass,ROLES.ADMIN,nowISO()).run();
  }

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
function rowUser(u){ if(!u) return null; return { id:u.id, ho_ten:u.ho_ten, email:u.email, vai_tro:u.vai_tro, active:uBool(u.active), is_dev:uBool(u.is_dev), created_at:u.created_at }; }
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
// Content OS · dữ liệu nền (sản phẩm + claim cấm): chủ sở hữu Kỹ thuật, thêm Marketing/Admin
const canBaseData = (u) => u && (u.vai_tro===ROLES.KY_THUAT || u.vai_tro===ROLES.MARKETING || u.vai_tro===ROLES.ADMIN);
async function logAudit(env, u, action, entity, entity_id, detail=''){
  await env.DB.prepare(`INSERT INTO audit (id,at,by_id,by_name,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(uid('a'),nowISO(),u?.id||null,u?.ho_ten||'—',action,entity,String(entity_id||''),detail).run();
}

// ---------- LỊCH ĐĂNG POST (xoay vòng Sales + chủ đề) ----------
// ngày theo giờ Việt Nam (UTC+7); trả {ymd, dow} với dow theo JS getDay (CN=0..T7=6)
function vnDayInfo(ms){ const d=new Date((ms==null?Date.now():ms)+7*3600*1000); return { ymd:d.toISOString().slice(0,10), dow:d.getUTCDay() }; }
function ymdPlus(ymd, k){ const d=new Date(Date.parse(ymd+'T00:00:00Z')+k*864e5); return { ymd:d.toISOString().slice(0,10), dow:d.getUTCDay() }; }
function schedCfg(pricing){
  return { on: uBool(pricing && pricing.sched_on), enforce: pricing==null||pricing.sched_enforce==null?true:uBool(pricing.sched_enforce),
    days: new Set(String((pricing&&pricing.sched_days)||'0,2,4,6').split(',').map(s=>parseInt(s,10)).filter(n=>!isNaN(n))) };
}
// đảm bảo có suất cho ~3 tuần tới + đánh dấu bỏ lỡ các suất quá hạn chưa đăng
async function ensurePostSlots(env){
  const pricing = await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first();
  const cfg = schedCfg(pricing);
  if(!cfg.on || !cfg.days.size) return;
  const today = vnDayInfo().ymd;
  // đánh dấu bỏ lỡ
  await env.DB.prepare(`UPDATE post_slots SET status='BO_LO' WHERE status='CHO' AND post_id IS NULL AND ngay < ?`).bind(today).run();
  // pool Sales đang hoạt động (theo thứ tự tạo) + chủ đề gợi ý (active, không thuộc loại bài đang ẩn, ưu tiên trước)
  const sales = (await env.DB.prepare(`SELECT id FROM users WHERE active=1 AND vai_tro='SALES' ORDER BY created_at ASC, id ASC`).all()).results.map(r=>r.id);
  if(!sales.length) return;
  const hidden = new Set((await env.DB.prepare(`SELECT loai FROM post_type_prefs WHERE an=1`).all()).results.map(r=>r.loai));
  const topics = (await env.DB.prepare(`SELECT id, loai_bai, uu_tien FROM content_topics WHERE active=1 ORDER BY uu_tien DESC, updated_at ASC, id ASC`).all()).results
    .filter(t=>!hidden.has(t.loai_bai)).map(r=>r.id);
  // ordinal xoay vòng = số suất đã tạo từ trước
  let ord = Number((await env.DB.prepare(`SELECT COUNT(*) c FROM post_slots`).first())?.c || 0);
  for(let k=0;k<21;k++){
    const d = ymdPlus(today, k);
    if(!cfg.days.has(d.dow)) continue;
    const exist = await env.DB.prepare(`SELECT id FROM post_slots WHERE ngay=?`).bind(d.ymd).first();
    if(exist) continue;
    const sid = sales[ord % sales.length];
    const tid = topics.length ? topics[ord % topics.length] : null;
    await env.DB.prepare(`INSERT INTO post_slots (id,ngay,sales_id,topic_id,post_id,status,created_at) VALUES (?,?,?,?,NULL,'CHO',?)`)
      .bind(uid('slot'), d.ymd, sid, tid, nowISO()).run();
    ord++;
  }
}

// Content OS · P3 — chèn 1 content_item từ body (dùng chung cho tạo & import)
// TREND — Checklist đánh giá do NGƯỜI tick. Cố ý KHÔNG có mục "dự đoán % viral":
// app không đoán trend sẽ nổ hay không, chỉ giúp kiểm tra có nên làm và có kịp không.
const TREND_CHECK = [
  {k:'hop_pillar',  label:'Gắn được vào trụ cột nội dung / định vị thương hiệu', bat_buoc:true},
  {k:'co_goc_sp',   label:'Có sản phẩm hoặc góc nhìn thật để gắn vào', bat_buoc:true},
  {k:'khong_claim', label:'Không buộc phải nói quá / chạm claim cấm', bat_buoc:true},
  {k:'kip_thoi',    label:'Còn kịp sản xuất trước khi trend nguội', bat_buoc:true},
  {k:'an_toan',     label:'Không nhạy cảm, không rủi ro hình ảnh thương hiệu', bat_buoc:true},
  {k:'lam_khac',    label:'Làm được khác biệt, không bắt chước y hệt', bat_buoc:false},
];
const TREND_ST = { MOI:'Mới ghi nhận', DANH_GIA:'Đang đánh giá', DUYET:'Duyệt triển khai', TU_CHOI:'Bỏ qua', DA_TRIEN_KHAI:'Đã triển khai' };
// NỐI SEEDING ↔ CONTENT OS: gom kết quả seeding về nội dung gốc.
// CHỦ Ý: chỉ đếm số bài + tương tác. KHÔNG quy ra doanh thu — seeding không quy đơn được (§9).
function gomSeedingTheoNoiDung(topics, posts, cmts){
  const map={};
  const topicToCi={};
  (topics||[]).forEach(t=>{ if(t.content_item_id) topicToCi[t.id]=t.content_item_id; });
  (posts||[]).forEach(p=>{
    const ci=topicToCi[p.topic_id]; if(!ci) return;
    (map[ci] ||= {so_bai:0, so_bai_dat:0, react:0, cmt:0});
    map[ci].so_bai++;
    if(p.trang_thai==='DAT'||p.trang_thai==='DA_CHI') map[ci].so_bai_dat++;
    map[ci].react += Number(p.react)||0;
    map[ci].cmt += (Number(p.so_cmt_seeding)||0)+(Number(p.so_cmt_tu_nhien)||0);
  });
  const postToCi={}; (posts||[]).forEach(p=>{ const ci=topicToCi[p.topic_id]; if(ci) postToCi[p.id]=ci; });
  (cmts||[]).forEach(c=>{
    const ci=postToCi[c.post_seeding_id]; if(!ci) return;
    (map[ci] ||= {so_bai:0, so_bai_dat:0, react:0, cmt:0});
    map[ci].cmt += Number(c.so_cmt_seeding)||0;
  });
  return map;
}
// NHẮC VIỆC — ngưỡng "để lâu quá" (ngày). Tính trực tiếp mỗi lần bootstrap nên KHÔNG BAO GIỜ LỆCH;
// cron chỉ ghi nhật ký hằng ngày, không phải nguồn sự thật.
const NGUONG_KET = { sua_lai:3, cho_duyet:2, chua_nhap_kq:14, trend_sap_het:7, don_cho_gan:3 };
function soNgay(iso){ if(!iso) return 0; const d=(Date.now()-new Date(iso).getTime())/864e5; return d>0?Math.floor(d):0; }
// Trả về các nhóm việc đang kẹt + lý do cụ thể, KHÔNG gộp thành một con số vô nghĩa
function tinhViecKet({scripts,approvals,air_posts,ket_qua,trends,don_cho_gan}){
  const homNay=new Date().toISOString().slice(0,10);
  const coKQ=new Set((ket_qua||[]).map(k=>k.air_post_id));
  const suaLai=(scripts||[]).filter(s=>s.trang_thai==='NHAP' && Number(s.so_lan_tra||0)>0 && soNgay(s.updated_at)>=NGUONG_KET.sua_lai)
    .map(s=>({id:s.id, ten:s.tieu_de||s.hook||'(không tên)', ngay:soNgay(s.updated_at)}));
  const choDuyet=(approvals||[]).filter(a=>a.trang_thai==='CHO' && soNgay(a.created_at)>=NGUONG_KET.cho_duyet)
    .map(a=>({id:a.id, cong:a.cong, ngay:soNgay(a.created_at)}));
  const chuaNhapKQ=(air_posts||[]).filter(a=>a.trang_thai==='DA_DANG' && !coKQ.has(a.id) && soNgay(a.posted_at)>=NGUONG_KET.chua_nhap_kq)
    .map(a=>({id:a.id, ten:a.tieu_de||'(không tên)', ngay:soNgay(a.posted_at)}));
  const trendGap=(trends||[]).filter(t=>['MOI','DANH_GIA','DUYET'].includes(t.trang_thai) && t.han_dung)
    .map(t=>({id:t.id, ten:t.ten, con:Math.floor((new Date(t.han_dung)-new Date(homNay))/864e5)}))
    .filter(t=>t.con<=NGUONG_KET.trend_sap_het);
  const donKet=(don_cho_gan||[]).filter(d=>d.trang_thai==='CHO_GAN' && soNgay(d.created_at)>=NGUONG_KET.don_cho_gan)
    .map(d=>({id:d.id, ma:d.ma_doi_soat||'', ngay:soNgay(d.created_at)}));
  // Bài đã tới giờ mà chưa lên sóng (không tự động được hoặc đăng lỗi) — phải nhắc ngay, không để trôi
  const denGio=(air_posts||[]).filter(a=>a.trang_thai==='DEN_GIO'||a.trang_thai==='LOI')
    .map(a=>({id:a.id, ten:a.tieu_de||'(không tên)', loi:a.loi||'', lich:a.lich_dang||''}));
  return { sua_lai:suaLai, cho_duyet:choDuyet, chua_nhap_kq:chuaNhapKQ, trend_gap:trendGap, don_ket:donKet, den_gio:denGio,
    tong: suaLai.length+choDuyet.length+chuaNhapKQ.length+trendGap.length+donKet.length+denGio.length, nguong:NGUONG_KET };
}
// P10 — Ngưỡng bằng chứng: DƯỚI ngưỡng này thì KHÔNG rút ra kết luận nào.
// Ranh giới: chỉ tổng hợp cái đã quan sát được; KHÔNG dự đoán viral/%view bằng AI.
const MIN_MAU_BANG_CHUNG = 5;
// P8 — 3 MỨC TIN CẬY. Ranh giới đạo đức số liệu: 3 mức này KHÔNG BAO GIỜ được cộng dồn
// thành một con số "doanh thu từ content" — luôn báo cáo tách 3 cột riêng.
const MUC_TIN_CAY = {
  TRUC_TIEP:   'Trực tiếp',      // sàn trả về đúng mã của bài → quy đơn chắc chắn
  GIAN_TIEP:   'Gián tiếp',      // có liên hệ nhưng không chắc 100% (vd voucher dùng chung)
  KHONG_QUY_DON:'Không quy đơn', // chỉ là chỉ số hiển thị/tương tác, KHÔNG suy ra doanh thu
};
const NGUON_KQ = ['TIKTOK_SHOP','SHOPEE','API_KENH','NHAP_TAY'];
// Nguồn nào mặc định thuộc mức tin cậy nào (người nhập vẫn có thể chọn khác)
const NGUON_MUC_MAC_DINH = { TIKTOK_SHOP:'TRUC_TIEP', SHOPEE:'GIAN_TIEP', API_KENH:'KHONG_QUY_DON', NHAP_TAY:'KHONG_QUY_DON' };
// P7 — Checklist đăng thủ công. KHÔNG auto-post (TikTok Content Posting API cần audit → SELF_ONLY).
// bat_buoc=true → phải tick hết mới cho đánh dấu "Đã đăng".
const AIR_CHECKLIST = [
  {k:'noi_dung_duyet', label:'Nội dung đã qua 2 cổng duyệt', bat_buoc:true},
  {k:'dung_kenh',      label:'Đúng kênh & đúng định dạng của kênh', bat_buoc:true},
  {k:'ma_gan',         label:'Đã gắn mã theo dõi / voucher vào bài', bat_buoc:true},
  {k:'link_sp',        label:'Link sản phẩm / giỏ hàng đúng', bat_buoc:true},
  {k:'caption_claim',  label:'Caption đã rà lại cụm từ cấm', bat_buoc:true},
  {k:'media_ty_le',    label:'Ảnh/video đúng tỉ lệ, không vỡ nét', bat_buoc:false},
  {k:'hashtag_cta',    label:'Hashtag & CTA đầy đủ', bat_buoc:false},
  {k:'hen_gio',        label:'Đã hẹn giờ / canh khung giờ đăng', bat_buoc:false},
];
const AIR_ST = { CHUAN_BI:'CHUAN_BI', DA_LEN_LICH:'DA_LEN_LICH', DEN_GIO:'DEN_GIO', DA_DANG:'DA_DANG', LOI:'LOI' };
// Nền tảng nào ĐĂNG TỰ ĐỘNG ĐƯỢC. Ghi rõ điều kiện để không hứa quá.
// TikTok cố ý = false: Content Posting API chưa qua audit thì bài ra SELF_ONLY (chỉ mình thấy) → auto-post vô nghĩa.
const KENH_TU_DONG = {
  FANPAGE:  { duoc:true,  ten:'Facebook Page', dieu_kien:'Cần Page access token + quyền pages_manage_posts (app phải qua Meta review)' },
  YOUTUBE:  { duoc:true,  ten:'YouTube',       dieu_kien:'Cần OAuth token có scope youtube.upload' },
  ZALO_OA:  { duoc:true,  ten:'Zalo OA',       dieu_kien:'Cần OA access token' },
  TIKTOK:   { duoc:false, ten:'TikTok',        dieu_kien:'Chưa qua audit thì bài đăng chỉ mình bạn thấy (SELF_ONLY) → phải đăng tay' },
  SHOPEE:   { duoc:false, ten:'Shopee',        dieu_kien:'Không có API đăng bài công khai → đăng tay' },
  WEBSITE:  { duoc:false, ten:'Website',       dieu_kien:'Tuỳ hệ quản trị website → đăng tay' },
};
// Token đọc từ SECRET của Worker theo quy ước TOKEN_<api_ma>, KHÔNG lưu trong D1.
// Lý do: D1 không mã hoá; token rò rỉ là chiếm quyền đăng bài trên Page thật.
function layToken(env, kenh){
  const ma=String((kenh&&kenh.api_ma)||'').trim().toUpperCase().replace(/[^A-Z0-9_]/g,'');
  if(!ma) return null;
  return env['TOKEN_'+ma] || null;
}
// Đăng thật lên nền tảng. Trả {ok, id} hoặc {ok:false, loi}. KHÔNG BAO GIỜ trả ok khi không chắc.
async function dangLenNenTang(env, kenh, post){
  const cap=KENH_TU_DONG[String(kenh.loai||'').toUpperCase()];
  if(!cap || !cap.duoc) return {ok:false, loi:'Nền tảng này không đăng tự động được — '+((cap&&cap.dieu_kien)||'')};
  const token=layToken(env, kenh);
  if(!token) return {ok:false, loi:'Chưa cắm token cho kênh này (secret TOKEN_'+((kenh.api_ma)||'?')+')'};
  const objId=String(kenh.api_object_id||'').trim();
  if(!objId) return {ok:false, loi:'Chưa khai báo ID đối tượng trên nền tảng (VD: Page ID)'};
  try{
    if(String(kenh.loai).toUpperCase()==='FANPAGE'){
      const noi_dung=[post.tieu_de, post.ghi_chu].filter(Boolean).join('\n\n');
      const body=new URLSearchParams();
      body.set('message', noi_dung || post.tieu_de || '');
      if(post.link_bai) body.set('link', post.link_bai);
      body.set('access_token', token);
      const res=await fetch('https://graph.facebook.com/v21.0/'+encodeURIComponent(objId)+'/feed',{method:'POST',body});
      const j=await res.json().catch(()=>({}));
      if(!res.ok || !j.id) return {ok:false, loi:'Facebook từ chối: '+((j.error&&j.error.message)||('HTTP '+res.status))};
      return {ok:true, id:j.id};
    }
    // Các nền tảng còn lại: chưa hiện thực → nói thẳng, KHÔNG giả vờ thành công
    return {ok:false, loi:'Chưa hiện thực bộ đăng cho '+cap.ten+' — hiện phải đăng tay'};
  }catch(e){ return {ok:false, loi:'Lỗi gọi API: '+(e.message||e)}; }
}
// Cron: quét bài đến giờ. Đăng được thì đăng, không thì chuyển ĐẾN GIỜ để nhắc đăng tay.
const MAX_LAN_THU = 3;
async function chayLichDang(env){
  try{
    await ensureSchema(env);
    const now=nowISO();
    const dueRows=(await env.DB.prepare(
      `SELECT * FROM air_posts WHERE lich_dang IS NOT NULL AND lich_dang<>'' AND lich_dang<=? AND trang_thai IN ('DA_LEN_LICH','LOI') AND COALESCE(lan_thu,0)<?`
    ).bind(now, MAX_LAN_THU).all()).results;
    for(const p of dueRows){
      const kenh=p.kenh_id ? await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(p.kenh_id).first() : null;
      const batTuDong = p.tu_dong && kenh && uBool(kenh.tu_dong_dang);
      if(!batTuDong){
        // Không tự động được → KHÔNG im lặng: chuyển ĐẾN GIỜ để hiện trong nhắc việc
        await env.DB.prepare(`UPDATE air_posts SET trang_thai='DEN_GIO', updated_at=? WHERE id=?`).bind(nowISO(),p.id).run();
        continue;
      }
      const r=await dangLenNenTang(env, kenh, p);
      if(r.ok){
        await env.DB.prepare(`UPDATE air_posts SET trang_thai='DA_DANG', posted_at=?, updated_at=?, loi=NULL WHERE id=?`).bind(nowISO(),nowISO(),p.id).run();
      } else {
        const lan=Number(p.lan_thu||0)+1;
        const het = lan>=MAX_LAN_THU;
        await env.DB.prepare(`UPDATE air_posts SET trang_thai=?, lan_thu=?, loi=?, updated_at=? WHERE id=?`)
          .bind(het?'DEN_GIO':'LOI', lan, (r.loi||'')+(het?' — đã thử '+lan+' lần, chuyển sang đăng tay':''), nowISO(), p.id).run();
      }
    }
  }catch(e){}
}
// P6 — 2 cổng duyệt song song. Ai được quyết cổng nào.
// (Khi thêm vai trò TRUONG_MKT ở P0, chỉ cần bổ sung vào nhánh NOI_DUNG.)
const APPROVAL_GATES = ['NOI_DUNG','CLAIM'];
function canDecideGate(u, cong){
  if(!u) return false;
  if(u.vai_tro===ROLES.ADMIN) return true;
  if(cong==='NOI_DUNG') return u.vai_tro===ROLES.MARKETING;
  if(cong==='CLAIM') return u.vai_tro===ROLES.KY_THUAT;
  return false;
}
// Bảng + cột trạng thái của từng loại đối tượng đưa vào hàng đợi duyệt
const APPROVAL_TARGETS = { SCRIPT:'scripts', CONTENT:'content_items' };
// P4 — gộp toàn văn kịch bản để quét claim cấm
function scriptText(s){
  const secs=Array.isArray(s.sections)?s.sections.map(x=>(x&&x.text)||'').join('\n'):'';
  return [s.tieu_de,s.hook,secs,s.cta].filter(Boolean).join('\n');
}
// P4 — quét văn bản với danh sách claim cấm → [{cum_tu,ly_do,muc_do}]
function scanScriptClaims(text, claims){
  const t=String(text||'').toLowerCase();
  return (claims||[]).filter(c=>c.cum_tu && t.includes(String(c.cum_tu).toLowerCase()))
    .map(c=>({ cum_tu:c.cum_tu, ly_do:c.ly_do||'', muc_do:c.muc_do||'CANH_BAO' }));
}
async function insertContentItem(env, me, body){
  const id=uid('ci');
  await env.DB.prepare(`INSERT INTO content_items (id,loai,tieu_de,loai_muc_tieu,pillar_id,framework_id,san_pham_id,kenh_id,thang,trang_thai,pic,chi_tiet,links,created_at,created_by,created_by_name,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, body.loai||'SOCIAL', (body.tieu_de||'').trim(), body.loai_muc_tieu||'', body.pillar_id||null, body.framework_id||null, body.san_pham_id||null, body.kenh_id||null, (body.thang||'').trim(), body.trang_thai||'Y_TUONG', JSON.stringify(body.pic||{}), JSON.stringify(body.chi_tiet||{}), JSON.stringify(body.links||{}), nowISO(), me.id, me.ho_ten, nowISO()).run();
  return id;
}

// ---------- bootstrap: toàn bộ dữ liệu theo quyền ----------
async function bootstrap(env, u){
  const staff = isStaff(u);
  try { await ensurePostSlots(env); } catch(e){}
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
        id:s.id, ten:s.ten, mo_ta:s.mo_ta, source_mau_url:s.source_mau_url, bat_buoc:uBool(s.bat_buoc), thu_tu:s.thu_tu, active:uBool(s.active), don_gia:s.don_gia==null?null:Number(s.don_gia),
      })),
    })),
  }));
  const pfSql = staff ? `SELECT * FROM project_filmings` : `SELECT * FROM project_filmings WHERE sales_id=?`;
  const pfRows = (await (staff ? env.DB.prepare(pfSql) : env.DB.prepare(pfSql).bind(u.id)).all()).results;
  const fups = (await env.DB.prepare(`SELECT * FROM filming_uploads`).all()).results;
  const project_filmings = pfRows.map(p=>({
    ...p, uploads: fups.filter(x=>x.project_filming_id===p.id).map(x=>({ id:x.id, shot_id:x.shot_id, media_type:x.media_type, media_url:x.media_url, uploaded_at:x.uploaded_at, dat_item:x.dat_item==null?null:uBool(x.dat_item), level:x.level==null?null:Number(x.level) })),
  }));
  const guides = {};
  (await env.DB.prepare(`SELECT * FROM guides`).all()).results.forEach(g=>{ guides[g.key]={ noi_dung:g.noi_dung, video_url:g.video_url }; });
  const post_type_prefs = {};
  (await env.DB.prepare(`SELECT * FROM post_type_prefs`).all()).results.forEach(r=>{ post_type_prefs[r.loai]={ an:uBool(r.an), uu_tien:uBool(r.uu_tien), thu_tu:r.thu_tu==null?null:Number(r.thu_tu) }; });
  const slotSince = ymdPlus(vnDayInfo().ymd, -14).ymd;
  const post_slots = (await env.DB.prepare(`SELECT * FROM post_slots WHERE ngay>=? ORDER BY ngay ASC`).bind(slotSince).all()).results;
  const media_library = (await env.DB.prepare(`SELECT * FROM media_library ORDER BY uploaded_at DESC`).all()).results
    .map(r=>({ ...r, active:uBool(r.active), tags: JSON.parse(r.tags||'[]') }));
  const san_pham = (await env.DB.prepare(`SELECT * FROM san_pham ORDER BY created_at DESC`).all()).results
    .map(r=>({ ...r, active:uBool(r.active), thong_so: JSON.parse(r.thong_so||'[]') }));
  const claim_cam = (await env.DB.prepare(`SELECT * FROM claim_cam ORDER BY created_at DESC`).all()).results
    .map(r=>({ ...r, active:uBool(r.active) }));
  const pillars = (await env.DB.prepare(`SELECT * FROM pillars ORDER BY thu_tu ASC, created_at ASC`).all()).results
    .map(r=>({ ...r, active:uBool(r.active), ty_trong:r.ty_trong==null?0:Number(r.ty_trong) }));
  const content_strategy = (await env.DB.prepare(`SELECT * FROM content_strategy WHERE id=1`).first()) || { okr:'', big_idea:'', purpose:'', audience:'', swot:'', brand_voice:'' };
  const frameworks = (await env.DB.prepare(`SELECT * FROM frameworks ORDER BY thu_tu ASC, created_at ASC`).all()).results.map(r=>({ ...r, active:uBool(r.active) }));
  const kenh = (await env.DB.prepare(`SELECT * FROM kenh ORDER BY created_at ASC`).all()).results.map(r=>({ ...r, active:uBool(r.active), tu_dong_dang:uBool(r.tu_dong_dang) }));
  const content_items = (await env.DB.prepare(`SELECT * FROM content_items ORDER BY created_at DESC`).all()).results
    .map(r=>({ ...r, pic: JSON.parse(r.pic||'{}'), chi_tiet: JSON.parse(r.chi_tiet||'{}'), links: JSON.parse(r.links||'{}') }));
  // P4 — kịch bản (chỉ staff xem; Sales không cần)
  const canContent = staff || u.vai_tro===ROLES.KY_THUAT;
  const scripts = canContent ? (await env.DB.prepare(`SELECT * FROM scripts ORDER BY updated_at DESC`).all()).results
    .map(r=>({ ...r, sections: JSON.parse(r.sections||'[]'), claim_flags: JSON.parse(r.claim_flags||'[]') })) : [];
  // P6 — hàng đợi duyệt 2 cổng (Kỹ thuật cần thấy để duyệt cổng CLAIM)
  const approvals = canContent ? (await env.DB.prepare(`SELECT * FROM approvals ORDER BY created_at DESC`).all()).results : [];
  // P7 — bài đăng (checklist thủ công + mã theo dõi)
  const air_posts = canContent ? (await env.DB.prepare(`SELECT * FROM air_posts ORDER BY created_at DESC`).all()).results
    .map(r=>({ ...r, checklist: JSON.parse(r.checklist||'{}') })) : [];
  // P8 — kết quả 3 mức tin cậy + hàng đợi gán tay
  const ket_qua = canContent ? (await env.DB.prepare(`SELECT * FROM ket_qua ORDER BY created_at DESC`).all()).results : [];
  const don_cho_gan = canContent ? (await env.DB.prepare(`SELECT * FROM don_cho_gan ORDER BY created_at DESC`).all()).results : [];
  // P5 — kho footage + shot list
  const footage = canContent ? (await env.DB.prepare(`SELECT * FROM footage ORDER BY created_at DESC`).all()).results
    .map(r=>({ ...r, active:uBool(r.active), tags: JSON.parse(r.tags||'[]') })) : [];
  const shot_list = canContent ? (await env.DB.prepare(`SELECT * FROM shot_list ORDER BY thu_tu ASC, created_at ASC`).all()).results : [];
  // TREND — nghiên cứu & triển khai
  const trends = canContent ? (await env.DB.prepare(`SELECT * FROM trends ORDER BY created_at DESC`).all()).results
    .map(r=>({ ...r, danh_gia: JSON.parse(r.danh_gia||'{}') })) : [];
  // P10 — thư viện học
  const bai_hoc = canContent ? (await env.DB.prepare(`SELECT * FROM bai_hoc ORDER BY created_at DESC`).all()).results
    .map(r=>({ ...r, bang_chung: JSON.parse(r.bang_chung||'{}') })) : [];

  return {
    me: rowUser(u),
    users, groups, content_topics:topics, cmt_suggestions:cmtsug,
    post_seedings: posts, cmt_seedings: cmtsFull,
    filming_templates, project_filmings, guides, post_type_prefs, post_slots, media_library,
    san_pham, claim_cam, pillars, content_strategy,
    frameworks, kenh, content_items, scripts, approvals, air_posts, air_checklist:AIR_CHECKLIST,
    ket_qua, don_cho_gan, muc_tin_cay:MUC_TIN_CAY, nguon_kq:NGUON_KQ,
    kenh_tu_dong: KENH_TU_DONG,
    kenh_san_sang: staff ? Object.fromEntries((kenh||[]).map(k=>[k.id, !!layToken(env,k) && !!String(k.api_object_id||'').trim()])) : {},
    footage, shot_list, bai_hoc, min_mau:MIN_MAU_BANG_CHUNG, trends, trend_check:TREND_CHECK,
    viec_ket: canContent ? tinhViecKet({scripts,approvals,air_posts,ket_qua,trends,don_cho_gan}) : null,
    seeding_theo_noi_dung: staff ? gomSeedingTheoNoiDung(topics, posts, cmts) : {},
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
    const len = Number(request.headers.get('content-length')||0);
    if(!request.body || len<=0) return json({error:'File rỗng'}, 400);
    if(len > 100*1024*1024) return json({error:'File quá lớn (>100MB) — dùng tab Dán link Drive cho video lớn'}, 413);
    const ext = ((ct.split('/')[1]||'bin').split(';')[0]).replace(/[^a-z0-9]/gi,'') || 'bin';
    const key = 'filming/'+uid('m')+'.'+ext;
    // stream thẳng vào R2 (không nạp cả file vào bộ nhớ)
    await env.MEDIA.put(key, request.body, { httpMetadata:{ contentType: ct } });
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

  // Công cụ Lọc video (/tools/loc-video.html) hỏi danh sách nhạc nền từ folder cục bộ.
  // Bản chạy trên web không có folder đó → trả mảng rỗng để công cụ hiện đúng trạng thái
  // thay vì 401/404. Không có dữ liệu nào nên để công khai (công cụ chạy ngoài phiên đăng nhập).
  if(path==='/nhac' && method==='GET') return json([]);

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
    await env.DB.prepare(`INSERT INTO users (id,ho_ten,email,password,vai_tro,active,is_dev,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id,body.ho_ten.trim(),email,pass,body.vai_tro||ROLES.SALES,bool(body.active!==false),bool(body.is_dev),nowISO()).run();
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
    const newDev = body.is_dev!=null ? bool(body.is_dev) : u.is_dev;
    await env.DB.prepare(`UPDATE users SET ho_ten=?, vai_tro=?, active=?, is_dev=?, password=? WHERE id=?`)
      .bind(body.ho_ten??u.ho_ten, newRole, newActive, newDev, pass, id).run();
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
    const cur = await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first() || {};
    const num = (v, d)=> (v!=null && v!=='' ? Number(v)||0 : Number(d)||0);
    const schedOn = p.sched_on!=null ? (p.sched_on?1:0) : (cur.sched_on||0);
    const schedEnf = p.sched_enforce!=null ? (p.sched_enforce?1:0) : (cur.sched_enforce==null?1:cur.sched_enforce);
    const schedDays = p.sched_days!=null ? String(p.sched_days) : (cur.sched_days||'0,2,4,6');
    await env.DB.prepare(`UPDATE pricing SET don_gia_post=?, don_gia_cmt=?, don_gia_cong_trinh=?, don_gia_canh=?, min_nhac_kingsmen=?, min_usp=?, dedupe_days=?, film_lv1=?, film_lv2=?, film_lv3=?, sched_on=?, sched_enforce=?, sched_days=? WHERE id=1`)
      .bind(Number(p.don_gia_post)||0,Number(p.don_gia_cmt)||0,Number(p.don_gia_cong_trinh)||0,Number(p.don_gia_canh)||0,Number(p.min_nhac_kingsmen)||0,Number(p.min_usp)||0,Math.max(0,Number(p.dedupe_days)||0),num(p.film_lv1,cur.film_lv1),num(p.film_lv2,cur.film_lv2),num(p.film_lv3,cur.film_lv3),schedOn,schedEnf,schedDays).run();
    if(schedOn) { try { await ensurePostSlots(env); } catch(e){} }
    await logAudit(env,me,'sửa đơn giá','pricing','-');
    return json({ db: await bootstrap(env, me) });
  }

  // ===== Ưu tiên / ẩn-hiện LOẠI BÀI theo giai đoạn =====
  if((m=path.match(/^\/posttypes\/(.+)$/)) && method==='PATCH'){
    if(me.vai_tro!==ROLES.ADMIN && me.vai_tro!==ROLES.MARKETING) return json({error:'Không có quyền'},403);
    const loai = decodeURIComponent(m[1]);
    const cur = await env.DB.prepare(`SELECT * FROM post_type_prefs WHERE loai=?`).bind(loai).first();
    const an = body.an!=null ? (body.an?1:0) : (cur?cur.an:0);
    const uu = body.uu_tien!=null ? (body.uu_tien?1:0) : (cur?cur.uu_tien:0);
    const tt = body.thu_tu!=null ? Number(body.thu_tu) : (cur?cur.thu_tu:null);
    if(cur) await env.DB.prepare(`UPDATE post_type_prefs SET an=?, uu_tien=?, thu_tu=? WHERE loai=?`).bind(an,uu,tt,loai).run();
    else await env.DB.prepare(`INSERT INTO post_type_prefs (loai,an,uu_tien,thu_tu) VALUES (?,?,?,?)`).bind(loai,an,uu,tt).run();
    await logAudit(env,me,'đổi ưu tiên/ẩn loại bài','post_type',loai);
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CHỐNG SPAM: kiểm tra trùng nội dung–nhóm (bất kỳ Sales nào, trong N ngày) =====
  if(path==='/posts/dupcheck' && method==='GET'){
    const topic_id = url.searchParams.get('topic_id');
    const group_id = url.searchParams.get('group_id');
    const pr = await env.DB.prepare(`SELECT dedupe_days FROM pricing WHERE id=1`).first();
    const days = Math.max(0, Number(pr && pr.dedupe_days!=null ? pr.dedupe_days : 7));
    if(!topic_id || !group_id || !days) return json({ dup:false, days });
    const since = new Date(Date.now() - days*864e5).toISOString();
    const rows = (await env.DB.prepare(
      `SELECT ps.id, ps.sales_id, ps.trang_thai, ps.created_at, u.ho_ten
       FROM post_seedings ps LEFT JOIN users u ON u.id=ps.sales_id
       WHERE ps.topic_id=? AND ps.group_id=? AND ps.trang_thai IN (?,?,?) AND ps.created_at>=?
       ORDER BY ps.created_at ASC`
    ).bind(topic_id, group_id, ST.CHO_DUYET, ST.DAT, ST.DA_CHI, since).all()).results;
    return json({
      dup: rows.length>0, days, count: rows.length,
      mine: rows.some(r=>r.sales_id===me.id),
      won: rows.some(r=>r.trang_thai===ST.DAT || r.trang_thai===ST.DA_CHI),
      examples: rows.slice(0,5).map(r=>({ sales: r.sales_id===me.id?'Bạn':(r.ho_ten||'—'), trang_thai:r.trang_thai, created_at:r.created_at, mine:r.sales_id===me.id })),
    });
  }

  // ===== POST SEEDING =====
  if(path==='/posts' && method==='POST'){
    // Giới hạn theo LỊCH ĐĂNG: chỉ đúng người, đúng ngày (T3/T5/T7/CN), mỗi ngày 1 post
    let slotToday = null;
    if(body.submit && me.vai_tro===ROLES.SALES){
      const pricing = await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first();
      const cfg = schedCfg(pricing);
      if(cfg.on && cfg.enforce){
        const t = vnDayInfo();
        if(!cfg.days.has(t.dow)) return json({error:'Hôm nay không phải ngày đăng bài (chỉ đăng Thứ 3 · Thứ 5 · Thứ 7 · Chủ nhật).'},403);
        slotToday = await env.DB.prepare(`SELECT * FROM post_slots WHERE ngay=?`).bind(t.ymd).first();
        if(slotToday){
          if(slotToday.sales_id!==me.id){ const owner=await env.DB.prepare(`SELECT ho_ten FROM users WHERE id=?`).bind(slotToday.sales_id).first(); return json({error:'Hôm nay là lượt của '+((owner&&owner.ho_ten)||'người khác')+' — chưa tới lượt đăng của bạn.'},403); }
          if(slotToday.post_id) return json({error:'Suất đăng hôm nay đã hoàn thành (mỗi ngày 1 post).'},403);
        }
      }
    }
    const id=uid('p');
    const status = body.submit ? ST.CHO_DUYET : ST.NHAP;
    await env.DB.prepare(`INSERT INTO post_seedings (id,topic_id,sales_id,group_id,link_bai,react,so_cmt_seeding,so_cmt_tu_nhien,trang_thai,ly_do_loai,thanh_tien,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
      .bind(id, body.topic_id||null, me.id, body.group_id||null, (body.link_bai||'').trim(), Number(body.react)||0, Number(body.so_cmt_seeding)||0, Number(body.so_cmt_tu_nhien)||0, status, '', nowISO()).run();
    if(slotToday && !slotToday.post_id) await env.DB.prepare(`UPDATE post_slots SET post_id=?, status='DA_DANG' WHERE id=?`).bind(id, slotToday.id).run();
    await logAudit(env,me, body.submit?'gửi nghiệm thu':'tạo nháp','post_seeding',id);
    return json({ db: await bootstrap(env, me) });
  }
  // ===== LỊCH ĐĂNG POST: cấu hình / tạo lại / phân lại (staff) =====
  if(path==='/schedule/regen' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const today = vnDayInfo().ymd;
    await env.DB.prepare(`DELETE FROM post_slots WHERE ngay>=? AND post_id IS NULL`).bind(today).run();
    await ensurePostSlots(env);
    await logAudit(env,me,'tạo lại lịch đăng','post_slots','-');
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/slots\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const s = await env.DB.prepare(`SELECT * FROM post_slots WHERE id=?`).bind(m[1]).first();
    if(!s) return json({error:'Không tìm thấy suất'},404);
    const sid = body.sales_id!==undefined ? body.sales_id : s.sales_id;
    const tid = body.topic_id!==undefined ? (body.topic_id||null) : s.topic_id;
    await env.DB.prepare(`UPDATE post_slots SET sales_id=?, topic_id=? WHERE id=?`).bind(sid, tid, m[1]).run();
    await logAudit(env,me,'đổi phân công suất đăng','post_slots',m[1]);
    return json({ db: await bootstrap(env, me) });
  }

  // ===== THƯ VIỆN ẢNH dùng chung (MKT + Sales cùng tải) =====
  if(path==='/library' && method==='POST'){
    if(!(body.media_url||'').trim()) return json({error:'Thiếu ảnh'},400);
    const id=uid('lib'); const tags=Array.isArray(body.tags)?body.tags:[];
    await env.DB.prepare(`INSERT INTO media_library (id,media_url,caption,muc_dich,topic_id,tags,uploaded_by,uploaded_by_name,active,uploaded_at) VALUES (?,?,?,?,?,?,?,?,1,?)`)
      .bind(id,(body.media_url||'').trim(),(body.caption||'').trim(),body.muc_dich||'CA_HAI',body.topic_id||null,JSON.stringify(tags),me.id,me.ho_ten,nowISO()).run();
    await logAudit(env,me,'tải ảnh thư viện','media_library',id);
    return json({ db: await bootstrap(env, me) });
  }
  if(path==='/library/bulkdelete' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const ids=Array.isArray(body.ids)?body.ids:[]; let n=0;
    for(const id of ids){ const r=await env.DB.prepare(`SELECT media_url FROM media_library WHERE id=?`).bind(id).first(); if(r){ await deleteMediaObject(env,r.media_url); await env.DB.prepare(`DELETE FROM media_library WHERE id=?`).bind(id).run(); n++; } }
    await logAudit(env,me,'xoá ảnh thư viện hàng loạt','media_library',n+' ảnh');
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/library\/(.+)$/)) && method==='PATCH'){
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM media_library WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    if(!isStaff(me) && r.uploaded_by!==me.id) return json({error:'Chỉ sửa ảnh của bạn'},403);
    const caption=body.caption!=null?String(body.caption):r.caption;
    const muc_dich=body.muc_dich!=null?body.muc_dich:r.muc_dich;
    const topic_id=body.topic_id!==undefined?(body.topic_id||null):r.topic_id;
    const tags=body.tags!=null?JSON.stringify(Array.isArray(body.tags)?body.tags:[]):r.tags;
    const active=body.active!=null?(body.active?1:0):r.active;
    await env.DB.prepare(`UPDATE media_library SET caption=?, muc_dich=?, topic_id=?, tags=?, active=? WHERE id=?`).bind(caption,muc_dich,topic_id,tags,active,id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/library\/(.+)$/)) && method==='DELETE'){
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM media_library WHERE id=?`).bind(id).first();
    if(r){ if(!isStaff(me) && r.uploaded_by!==me.id) return json({error:'Chỉ xoá ảnh của bạn'},403);
      await deleteMediaObject(env,r.media_url); await env.DB.prepare(`DELETE FROM media_library WHERE id=?`).bind(id).run(); await logAudit(env,me,'xoá ảnh thư viện','media_library',id); }
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P1 — SẢN PHẨM (spec thật · chủ sở hữu Kỹ thuật) =====
  if(path==='/sanpham' && method==='POST'){
    if(!canBaseData(me)) return json({error:'Không có quyền'},403);
    const id=uid('sp'); const ts=Array.isArray(body.thong_so)?body.thong_so:[];
    await env.DB.prepare(`INSERT INTO san_pham (id,ma,ten,dong,thong_so,tieu_chuan,huong_dan,anh,active,created_at) VALUES (?,?,?,?,?,?,?,?,1,?)`)
      .bind(id,(body.ma||'').trim(),(body.ten||'').trim(),(body.dong||'').trim(),JSON.stringify(ts),(body.tieu_chuan||'').trim(),(body.huong_dan||'').trim(),(body.anh||'').trim(),nowISO()).run();
    await logAudit(env,me,'thêm sản phẩm','san_pham',id,(body.ten||'').trim());
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/sanpham\/(.+)$/)) && method==='PATCH'){
    if(!canBaseData(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM san_pham WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    const g=(k,d)=> body[k]!=null?String(body[k]).trim():d;
    const ts = body.thong_so!=null ? JSON.stringify(Array.isArray(body.thong_so)?body.thong_so:[]) : r.thong_so;
    await env.DB.prepare(`UPDATE san_pham SET ma=?, ten=?, dong=?, thong_so=?, tieu_chuan=?, huong_dan=?, anh=?, active=? WHERE id=?`)
      .bind(g('ma',r.ma),g('ten',r.ten),g('dong',r.dong),ts,g('tieu_chuan',r.tieu_chuan),g('huong_dan',r.huong_dan),g('anh',r.anh),body.active!=null?bool(body.active):r.active,id).run();
    await logAudit(env,me,'sửa sản phẩm','san_pham',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/sanpham\/(.+)$/)) && method==='DELETE'){
    if(!canBaseData(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM san_pham WHERE id=?`).bind(m[1]).run();
    await logAudit(env,me,'xoá sản phẩm','san_pham',m[1]);
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P1 — CLAIM CẤM (mọi thay đổi ghi Nhật ký) =====
  if(path==='/claimcam' && method==='POST'){
    if(!canBaseData(me)) return json({error:'Không có quyền'},403);
    const id=uid('cc');
    await env.DB.prepare(`INSERT INTO claim_cam (id,cum_tu,ly_do,muc_do,active,created_at) VALUES (?,?,?,?,1,?)`)
      .bind(id,(body.cum_tu||'').trim(),(body.ly_do||'').trim(),body.muc_do==='CHAN'?'CHAN':'CANH_BAO',nowISO()).run();
    await logAudit(env,me,'thêm claim cấm','claim_cam',id,(body.cum_tu||'').trim());
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/claimcam\/(.+)$/)) && method==='PATCH'){
    if(!canBaseData(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM claim_cam WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    const cum=body.cum_tu!=null?String(body.cum_tu).trim():r.cum_tu;
    const ly=body.ly_do!=null?String(body.ly_do).trim():r.ly_do;
    const mu=body.muc_do!=null?(body.muc_do==='CHAN'?'CHAN':'CANH_BAO'):r.muc_do;
    const ac=body.active!=null?bool(body.active):r.active;
    await env.DB.prepare(`UPDATE claim_cam SET cum_tu=?, ly_do=?, muc_do=?, active=? WHERE id=?`).bind(cum,ly,mu,ac,id).run();
    await logAudit(env,me,'sửa claim cấm','claim_cam',id,cum);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/claimcam\/(.+)$/)) && method==='DELETE'){
    if(!canBaseData(me)) return json({error:'Không có quyền'},403);
    const r=await env.DB.prepare(`SELECT cum_tu FROM claim_cam WHERE id=?`).bind(m[1]).first();
    await env.DB.prepare(`DELETE FROM claim_cam WHERE id=?`).bind(m[1]).run();
    await logAudit(env,me,'xoá claim cấm','claim_cam',m[1],r&&r.cum_tu);
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P2 — Pillar (trụ cột nội dung) + Chiến lược =====
  if(path==='/pillars' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=uid('pil');
    const n = Number((await env.DB.prepare(`SELECT COUNT(*) c FROM pillars`).first())?.c||0);
    await env.DB.prepare(`INSERT INTO pillars (id,ten,objective,point_of_difference,request,ty_trong,thu_tu,active,created_at) VALUES (?,?,?,?,?,?,?,1,?)`)
      .bind(id,(body.ten||'').trim(),(body.objective||'').trim(),(body.point_of_difference||'').trim(),(body.request||'').trim(),Number(body.ty_trong)||0,n+1,nowISO()).run();
    await logAudit(env,me,'thêm pillar','pillars',id,(body.ten||'').trim());
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/pillars\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM pillars WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    const g=(k,d)=> body[k]!=null?String(body[k]).trim():d;
    await env.DB.prepare(`UPDATE pillars SET ten=?, objective=?, point_of_difference=?, request=?, ty_trong=?, active=? WHERE id=?`)
      .bind(g('ten',r.ten),g('objective',r.objective),g('point_of_difference',r.point_of_difference),g('request',r.request),body.ty_trong!=null?Number(body.ty_trong)||0:r.ty_trong,body.active!=null?bool(body.active):r.active,id).run();
    await logAudit(env,me,'sửa pillar','pillars',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/pillars\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM pillars WHERE id=?`).bind(m[1]).run();
    await logAudit(env,me,'xoá pillar','pillars',m[1]);
    return json({ db: await bootstrap(env, me) });
  }
  if(path==='/strategy' && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const r=await env.DB.prepare(`SELECT * FROM content_strategy WHERE id=1`).first()||{};
    const g=(k)=> body[k]!=null?String(body[k]):(r[k]||'');
    await env.DB.prepare(`UPDATE content_strategy SET okr=?, big_idea=?, purpose=?, audience=?, swot=?, brand_voice=?, updated_at=? WHERE id=1`)
      .bind(g('okr'),g('big_idea'),g('purpose'),g('audience'),g('swot'),g('brand_voice'),nowISO()).run();
    await logAudit(env,me,'sửa chiến lược','content_strategy','1');
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P3 — nhóm kịch bản (framework) + kênh =====
  if(path==='/frameworks' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=uid('fw'); const n=Number((await env.DB.prepare(`SELECT COUNT(*) c FROM frameworks`).first())?.c||0);
    await env.DB.prepare(`INSERT INTO frameworks (id,ten,mo_ta,thu_tu,active,created_at) VALUES (?,?,?,?,1,?)`).bind(id,(body.ten||'').trim(),(body.mo_ta||'').trim(),n+1,nowISO()).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/frameworks\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM frameworks WHERE id=?`).bind(id).first(); if(!r) return json({error:'Không tìm thấy'},404);
    await env.DB.prepare(`UPDATE frameworks SET ten=?, mo_ta=?, active=? WHERE id=?`).bind(body.ten!=null?String(body.ten).trim():r.ten,body.mo_ta!=null?String(body.mo_ta).trim():r.mo_ta,body.active!=null?bool(body.active):r.active,id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/frameworks\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM frameworks WHERE id=?`).bind(m[1]).run();
    return json({ db: await bootstrap(env, me) });
  }
  if(path==='/kenh' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=uid('kn');
    await env.DB.prepare(`INSERT INTO kenh (id,ten,loai,thuong_hieu,active,created_at) VALUES (?,?,?,?,1,?)`).bind(id,(body.ten||'').trim(),(body.loai||'FANPAGE').trim(),(body.thuong_hieu||'').trim(),nowISO()).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/kenh\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(id).first(); if(!r) return json({error:'Không tìm thấy'},404);
    await env.DB.prepare(`UPDATE kenh SET ten=?, loai=?, thuong_hieu=?, active=?, tu_dong_dang=?, api_ma=?, api_object_id=? WHERE id=?`)
      .bind(body.ten!=null?String(body.ten).trim():r.ten, body.loai!=null?String(body.loai).trim():r.loai,
        body.thuong_hieu!=null?String(body.thuong_hieu).trim():r.thuong_hieu, body.active!=null?bool(body.active):r.active,
        body.tu_dong_dang!=null?bool(body.tu_dong_dang):r.tu_dong_dang,
        body.api_ma!=null?String(body.api_ma).trim().toUpperCase().replace(/[^A-Z0-9_]/g,''):r.api_ma,
        body.api_object_id!=null?String(body.api_object_id).trim():r.api_object_id, id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/kenh\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM kenh WHERE id=?`).bind(m[1]).run();
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P3 — content_item (trung tâm: kế hoạch nội dung) =====
  if(path==='/content' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=await insertContentItem(env, me, body);
    await logAudit(env,me,'thêm nội dung','content_items',id,(body.tieu_de||'').trim());
    return json({ db: await bootstrap(env, me) });
  }
  if(path==='/content/import' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const items=Array.isArray(body.items)?body.items:[]; let n=0;
    for(const it of items){ if(!(it.tieu_de||'').trim()) continue; await insertContentItem(env, me, it); n++; }
    await logAudit(env,me,'import nội dung','content_items',n+' mục');
    return json({ db: await bootstrap(env, me), imported:n });
  }
  if((m=path.match(/^\/content\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM content_items WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    const g=(k,d)=> body[k]!=null?String(body[k]).trim():d;
    const pic = body.pic!=null?JSON.stringify(body.pic):r.pic;
    const chi_tiet = body.chi_tiet!=null?JSON.stringify(body.chi_tiet):r.chi_tiet;
    const links = body.links!=null?JSON.stringify(body.links):r.links;
    await env.DB.prepare(`UPDATE content_items SET loai=?, tieu_de=?, loai_muc_tieu=?, pillar_id=?, framework_id=?, san_pham_id=?, kenh_id=?, thang=?, trang_thai=?, pic=?, chi_tiet=?, links=?, updated_at=? WHERE id=?`)
      .bind(g('loai',r.loai),g('tieu_de',r.tieu_de),g('loai_muc_tieu',r.loai_muc_tieu),body.pillar_id!==undefined?(body.pillar_id||null):r.pillar_id,body.framework_id!==undefined?(body.framework_id||null):r.framework_id,body.san_pham_id!==undefined?(body.san_pham_id||null):r.san_pham_id,body.kenh_id!==undefined?(body.kenh_id||null):r.kenh_id,g('thang',r.thang),g('trang_thai',r.trang_thai),pic,chi_tiet,links,nowISO(),id).run();
    await logAudit(env,me,'sửa nội dung','content_items',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/content\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM content_items WHERE id=?`).bind(m[1]).run();
    await logAudit(env,me,'xoá nội dung','content_items',m[1]);
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P4 — Creative Studio: kịch bản có guardrail claim + lịch sử phiên bản =====
  if(path==='/scripts' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!(body.tieu_de||'').trim() && !(body.hook||'').trim()) return json({error:'Cần tiêu đề hoặc hook'},400);
    // Guardrail: quét claim cấm trên toàn văn; mức CHẶN → không cho lưu
    const claims=(await env.DB.prepare(`SELECT * FROM claim_cam WHERE active=1`).all()).results;
    const flags=scanScriptClaims(scriptText(body), claims);
    const blocked=flags.filter(f=>f.muc_do==='CHAN');
    if(blocked.length) return json({error:'Có cụm từ bị CHẶN, gỡ trước khi lưu', blocked:blocked.map(b=>b.cum_tu)},422);
    const id=uid('scr');
    await env.DB.prepare(`INSERT INTO scripts (id,content_item_id,framework_id,san_pham_id,kenh_id,tieu_de,hook,sections,cta,brand_voice,claim_flags,trang_thai,version,created_at,created_by,created_by_name,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, body.content_item_id||null, body.framework_id||null, body.san_pham_id||null, body.kenh_id||null, (body.tieu_de||'').trim(), (body.hook||'').trim(), JSON.stringify(body.sections||[]), (body.cta||'').trim(), (body.brand_voice||'').trim(), JSON.stringify(flags), body.trang_thai||'NHAP', 1, nowISO(), me.id, me.ho_ten, nowISO()).run();
    await env.DB.prepare(`INSERT INTO script_versions (id,script_id,version,snapshot,created_at,created_by_name) VALUES (?,?,?,?,?,?)`)
      .bind(uid('sv'), id, 1, JSON.stringify({tieu_de:body.tieu_de,hook:body.hook,sections:body.sections||[],cta:body.cta}), nowISO(), me.ho_ten).run();
    await logAudit(env,me,'tạo kịch bản','scripts',id,(body.tieu_de||'').trim());
    return json({ db: await bootstrap(env, me), id });
  }
  if((m=path.match(/^\/scripts\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM scripts WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    const merged={ tieu_de: body.tieu_de!=null?body.tieu_de:r.tieu_de, hook: body.hook!=null?body.hook:r.hook,
      sections: body.sections!=null?body.sections:JSON.parse(r.sections||'[]'), cta: body.cta!=null?body.cta:r.cta };
    const claims=(await env.DB.prepare(`SELECT * FROM claim_cam WHERE active=1`).all()).results;
    const flags=scanScriptClaims(scriptText(merged), claims);
    const blocked=flags.filter(f=>f.muc_do==='CHAN');
    if(blocked.length) return json({error:'Có cụm từ bị CHẶN, gỡ trước khi lưu', blocked:blocked.map(b=>b.cum_tu)},422);
    const ver=Number(r.version||1)+1;
    const g=(k,d)=> body[k]!=null?String(body[k]).trim():d;
    await env.DB.prepare(`UPDATE scripts SET content_item_id=?, framework_id=?, san_pham_id=?, kenh_id=?, tieu_de=?, hook=?, sections=?, cta=?, brand_voice=?, claim_flags=?, trang_thai=?, version=?, updated_at=? WHERE id=?`)
      .bind(body.content_item_id!==undefined?(body.content_item_id||null):r.content_item_id, body.framework_id!==undefined?(body.framework_id||null):r.framework_id, body.san_pham_id!==undefined?(body.san_pham_id||null):r.san_pham_id, body.kenh_id!==undefined?(body.kenh_id||null):r.kenh_id, String(merged.tieu_de||'').trim(), String(merged.hook||'').trim(), JSON.stringify(merged.sections||[]), String(merged.cta||'').trim(), g('brand_voice',r.brand_voice), JSON.stringify(flags), g('trang_thai',r.trang_thai), ver, nowISO(), id).run();
    await env.DB.prepare(`INSERT INTO script_versions (id,script_id,version,snapshot,created_at,created_by_name) VALUES (?,?,?,?,?,?)`)
      .bind(uid('sv'), id, ver, JSON.stringify(merged), nowISO(), me.ho_ten).run();
    await logAudit(env,me,'sửa kịch bản','scripts',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/scripts\/(.+)\/versions$/)) && method==='GET'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const rows=(await env.DB.prepare(`SELECT * FROM script_versions WHERE script_id=? ORDER BY version DESC`).bind(m[1]).all()).results
      .map(v=>({ ...v, snapshot: JSON.parse(v.snapshot||'{}') }));
    return json({ versions: rows });
  }
  if((m=path.match(/^\/scripts\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM script_versions WHERE script_id=?`).bind(m[1]).run();
    await env.DB.prepare(`DELETE FROM approvals WHERE doi_tuong='SCRIPT' AND doi_tuong_id=?`).bind(m[1]).run();
    await env.DB.prepare(`DELETE FROM scripts WHERE id=?`).bind(m[1]).run();
    await logAudit(env,me,'xoá kịch bản','scripts',m[1]);
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P6 — Hàng đợi duyệt 2 cổng song song (NOI_DUNG + CLAIM) =====
  if(path==='/approvals/submit' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const loai=String(body.doi_tuong||'').toUpperCase(); const tbl=APPROVAL_TARGETS[loai];
    if(!tbl) return json({error:'Loại đối tượng không hợp lệ'},400);
    const obj=await env.DB.prepare(`SELECT * FROM ${tbl} WHERE id=?`).bind(body.doi_tuong_id||'').first();
    if(!obj) return json({error:'Không tìm thấy đối tượng'},404);
    if(obj.trang_thai==='CHO_DUYET') return json({error:'Đối tượng đang chờ duyệt'},409);
    // Guardrail: kịch bản còn cụm CHẶN thì không được gửi duyệt
    if(loai==='SCRIPT'){
      const claims=(await env.DB.prepare(`SELECT * FROM claim_cam WHERE active=1`).all()).results;
      const flags=scanScriptClaims(scriptText({...obj, sections:JSON.parse(obj.sections||'[]')}), claims);
      const blocked=flags.filter(f=>f.muc_do==='CHAN');
      if(blocked.length) return json({error:'Còn cụm từ bị CHẶN, không thể gửi duyệt', blocked:blocked.map(b=>b.cum_tu)},422);
    }
    // gửi lại: xoá các cổng cũ rồi mở lại 2 cổng
    await env.DB.prepare(`DELETE FROM approvals WHERE doi_tuong=? AND doi_tuong_id=?`).bind(loai,obj.id).run();
    for(const cong of APPROVAL_GATES){
      await env.DB.prepare(`INSERT INTO approvals (id,doi_tuong,doi_tuong_id,cong,trang_thai,nguoi_gui,nguoi_gui_ten,ghi_chu,created_at) VALUES (?,?,?,?,'CHO',?,?,'',?)`)
        .bind(uid('ap'),loai,obj.id,cong,me.id,me.ho_ten,nowISO()).run();
    }
    await env.DB.prepare(`UPDATE ${tbl} SET trang_thai='CHO_DUYET', updated_at=? WHERE id=?`).bind(nowISO(),obj.id).run();
    await logAudit(env,me,'gửi duyệt',tbl,obj.id,(obj.tieu_de||''));
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/approvals\/(.+)\/decide$/)) && method==='POST'){
    const id=m[1]; const ap=await env.DB.prepare(`SELECT * FROM approvals WHERE id=?`).bind(id).first();
    if(!ap) return json({error:'Không tìm thấy'},404);
    if(!canDecideGate(me, ap.cong)) return json({error:'Bạn không có quyền duyệt cổng này'},403);
    if(ap.trang_thai!=='CHO') return json({error:'Cổng này đã được quyết'},409);
    const pass = body.result==='DAT';
    if(!pass && !String(body.ghi_chu||'').trim()) return json({error:'Trả lại phải nêu lý do'},400);
    const tbl=APPROVAL_TARGETS[ap.doi_tuong]; if(!tbl) return json({error:'Loại đối tượng không hợp lệ'},400);
    await env.DB.prepare(`UPDATE approvals SET trang_thai=?, nguoi_duyet=?, nguoi_duyet_ten=?, ghi_chu=?, decided_at=? WHERE id=?`)
      .bind(pass?'DAT':'TRA_LAI', me.id, me.ho_ten, String(body.ghi_chu||'').trim(), nowISO(), id).run();
    if(!pass){
      // Một cổng trả lại → đối tượng về Nháp, cổng còn lại huỷ (khỏi duyệt thừa)
      await env.DB.prepare(`UPDATE approvals SET trang_thai='HUY', decided_at=? WHERE doi_tuong=? AND doi_tuong_id=? AND trang_thai='CHO'`)
        .bind(nowISO(),ap.doi_tuong,ap.doi_tuong_id).run();
      await env.DB.prepare(`UPDATE ${tbl} SET trang_thai='NHAP', so_lan_tra=COALESCE(so_lan_tra,0)+1, updated_at=? WHERE id=?`).bind(nowISO(),ap.doi_tuong_id).run();
    } else {
      // Chỉ DUYỆT khi CẢ HAI cổng đều Đạt
      const rest=(await env.DB.prepare(`SELECT * FROM approvals WHERE doi_tuong=? AND doi_tuong_id=?`).bind(ap.doi_tuong,ap.doi_tuong_id).all()).results;
      if(rest.length && rest.every(r=>r.trang_thai==='DAT'))
        await env.DB.prepare(`UPDATE ${tbl} SET trang_thai='DUYET', updated_at=? WHERE id=?`).bind(nowISO(),ap.doi_tuong_id).run();
    }
    await logAudit(env,me,(pass?'duyệt ':'trả lại ')+'cổng '+ap.cong,tbl,ap.doi_tuong_id,String(body.ghi_chu||'').trim());
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P7 — Đăng thủ công theo checklist + khoá mã theo dõi =====
  if(path==='/air' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    // Chỉ đưa vào khâu đăng khi nội dung/kịch bản ĐÃ DUYỆT (2 cổng)
    let tieu_de=(body.tieu_de||'').trim(), src=null;
    if(body.script_id){
      src=await env.DB.prepare(`SELECT * FROM scripts WHERE id=?`).bind(body.script_id).first();
      if(!src) return json({error:'Không tìm thấy kịch bản'},404);
    } else if(body.content_item_id){
      src=await env.DB.prepare(`SELECT * FROM content_items WHERE id=?`).bind(body.content_item_id).first();
      if(!src) return json({error:'Không tìm thấy nội dung'},404);
    } else return json({error:'Cần chọn kịch bản hoặc nội dung'},400);
    if(src.trang_thai!=='DUYET') return json({error:'Chỉ đăng nội dung ĐÃ DUYỆT (qua 2 cổng)'},409);
    tieu_de = tieu_de || src.tieu_de || '';
    const ma=String(body.ma_theo_doi||'').trim();
    if(ma){
      const dup=await env.DB.prepare(`SELECT id FROM air_posts WHERE ma_theo_doi=?`).bind(ma).first();
      if(dup) return json({error:'Mã theo dõi đã dùng cho bài khác — 1 mã chỉ thuộc 1 bài'},409);
    }
    const id=uid('air');
    await env.DB.prepare(`INSERT INTO air_posts (id,content_item_id,script_id,kenh_id,tieu_de,ngay_dang,link_bai,ma_theo_doi,loai_ma,checklist,ghi_chu,trang_thai,nguoi_dang,nguoi_dang_ten,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, body.content_item_id||src.content_item_id||null, body.script_id||null, body.kenh_id||src.kenh_id||null, tieu_de,
        (body.ngay_dang||'').trim(), (body.link_bai||'').trim(), ma, (body.loai_ma||'VOUCHER').trim(),
        JSON.stringify(body.checklist||{}), (body.ghi_chu||'').trim(), AIR_ST.CHUAN_BI, me.id, me.ho_ten, nowISO(), nowISO()).run();
    await logAudit(env,me,'tạo bài đăng','air_posts',id,tieu_de);
    return json({ db: await bootstrap(env, me), id });
  }
  if((m=path.match(/^\/air\/(.+)\/publish$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM air_posts WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    if(r.trang_thai===AIR_ST.DA_DANG) return json({error:'Bài này đã đánh dấu đã đăng'},409);
    const cl=JSON.parse(r.checklist||'{}');
    const thieu=AIR_CHECKLIST.filter(c=>c.bat_buoc && !cl[c.k]).map(c=>c.label);
    if(thieu.length) return json({error:'Chưa xong checklist bắt buộc', thieu},422);
    if(!String(r.link_bai||'').trim()) return json({error:'Cần dán link bài đã đăng'},400);
    if(!String(r.ma_theo_doi||'').trim()) return json({error:'Cần mã theo dõi để quy đơn ở bước đo lường'},400);
    await env.DB.prepare(`UPDATE air_posts SET trang_thai=?, posted_at=?, updated_at=? WHERE id=?`).bind(AIR_ST.DA_DANG,nowISO(),nowISO(),id).run();
    await logAudit(env,me,'đánh dấu đã đăng','air_posts',id,r.tieu_de||'');
    return json({ db: await bootstrap(env, me) });
  }
  // Lên lịch đăng
  if((m=path.match(/^\/air\/(.+)\/schedule$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM air_posts WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    if(r.trang_thai===AIR_ST.DA_DANG) return json({error:'Bài đã đăng rồi'},409);
    const lich=String(body.lich_dang||'').trim();
    if(!lich) return json({error:'Chọn thời điểm đăng'},400);
    if(isNaN(new Date(lich).getTime())) return json({error:'Thời điểm không hợp lệ'},400);
    if(new Date(lich).getTime() <= Date.now()) return json({error:'Thời điểm phải ở tương lai'},400);
    const tuDong = bool(body.tu_dong);
    // Bật tự động thì phải kiểm tra kênh có làm được không — nói TRƯỚC, không để đến giờ mới vỡ
    if(tuDong){
      const kenh = r.kenh_id ? await env.DB.prepare(`SELECT * FROM kenh WHERE id=?`).bind(r.kenh_id).first() : null;
      if(!kenh) return json({error:'Bài chưa gắn kênh — không tự đăng được'},400);
      const cap=KENH_TU_DONG[String(kenh.loai||'').toUpperCase()];
      if(!cap || !cap.duoc) return json({error:'Kênh loại '+(kenh.loai||'?')+' không đăng tự động được: '+((cap&&cap.dieu_kien)||'')},422);
      if(!uBool(kenh.tu_dong_dang)) return json({error:'Kênh này chưa bật tự động đăng (mở ở Kênh & Framework)'},422);
      if(!layToken(env,kenh)) return json({error:'Chưa cắm token cho kênh (secret TOKEN_'+(kenh.api_ma||'?')+')'},422);
      if(!String(kenh.api_object_id||'').trim()) return json({error:'Kênh chưa khai ID đối tượng (VD: Page ID)'},422);
    }
    // Đăng tự động thì checklist vẫn phải xong — không vì tự động mà bỏ qua kiểm tra
    const cl=JSON.parse(r.checklist||'{}');
    const thieu=AIR_CHECKLIST.filter(c=>c.bat_buoc && !cl[c.k]).map(c=>c.label);
    if(thieu.length) return json({error:'Chưa xong checklist bắt buộc', thieu},422);
    if(!String(r.ma_theo_doi||'').trim()) return json({error:'Cần mã theo dõi trước khi lên lịch'},400);
    await env.DB.prepare(`UPDATE air_posts SET lich_dang=?, tu_dong=?, trang_thai='DA_LEN_LICH', lan_thu=0, loi=NULL, updated_at=? WHERE id=?`)
      .bind(lich, tuDong?1:0, nowISO(), id).run();
    await logAudit(env,me,'lên lịch đăng','air_posts',id,lich+(tuDong?' (tự động)':' (nhắc đăng tay)'));
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/air\/(.+)\/unschedule$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM air_posts WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    if(r.trang_thai===AIR_ST.DA_DANG) return json({error:'Bài đã đăng rồi'},409);
    await env.DB.prepare(`UPDATE air_posts SET lich_dang=NULL, tu_dong=0, trang_thai='CHUAN_BI', lan_thu=0, loi=NULL, updated_at=? WHERE id=?`).bind(nowISO(),id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/air\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM air_posts WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    const ma = body.ma_theo_doi!=null ? String(body.ma_theo_doi).trim() : r.ma_theo_doi;
    if(ma && ma!==r.ma_theo_doi){
      const dup=await env.DB.prepare(`SELECT id FROM air_posts WHERE ma_theo_doi=? AND id<>?`).bind(ma,id).first();
      if(dup) return json({error:'Mã theo dõi đã dùng cho bài khác — 1 mã chỉ thuộc 1 bài'},409);
    }
    const g=(k,d)=> body[k]!=null?String(body[k]).trim():d;
    await env.DB.prepare(`UPDATE air_posts SET kenh_id=?, tieu_de=?, ngay_dang=?, link_bai=?, ma_theo_doi=?, loai_ma=?, checklist=?, ghi_chu=?, updated_at=? WHERE id=?`)
      .bind(body.kenh_id!==undefined?(body.kenh_id||null):r.kenh_id, g('tieu_de',r.tieu_de), g('ngay_dang',r.ngay_dang), g('link_bai',r.link_bai),
        ma, g('loai_ma',r.loai_ma), body.checklist!=null?JSON.stringify(body.checklist):r.checklist, g('ghi_chu',r.ghi_chu), nowISO(), id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/air\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM air_posts WHERE id=?`).bind(m[1]).run();
    await logAudit(env,me,'xoá bài đăng','air_posts',m[1]);
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P8 — Nhập kết quả (3 mức tin cậy) + hàng đợi gán tay =====
  if(path==='/ketqua' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!body.air_post_id) return json({error:'Cần chọn bài đăng'},400);
    const ap=await env.DB.prepare(`SELECT * FROM air_posts WHERE id=?`).bind(body.air_post_id).first();
    if(!ap) return json({error:'Không tìm thấy bài đăng'},404);
    const muc=String(body.muc_tin_cay||'').toUpperCase();
    if(!MUC_TIN_CAY[muc]) return json({error:'Mức tin cậy không hợp lệ'},400);
    // Ranh giới: mức KHÔNG QUY ĐƠN không được mang doanh thu/đơn — nếu không sẽ thành "bịa" quy đơn
    const dt=Number(body.doanh_thu)||0, sd=Number(body.so_don)||0;
    if(muc==='KHONG_QUY_DON' && (dt>0||sd>0))
      return json({error:'Mức "Không quy đơn" chỉ ghi chỉ số hiển thị/tương tác, không được gắn doanh thu hay số đơn'},422);
    const id=uid('kq');
    await env.DB.prepare(`INSERT INTO ket_qua (id,air_post_id,muc_tin_cay,nguon,ky,doanh_thu,so_don,luot_xem,luot_tuong_tac,luot_click,ma_theo_doi,ghi_chu,created_at,created_by,created_by_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, ap.id, muc, (body.nguon||'NHAP_TAY').trim(), (body.ky||'').trim(), dt, sd,
        Number(body.luot_xem)||0, Number(body.luot_tuong_tac)||0, Number(body.luot_click)||0,
        ap.ma_theo_doi||'', (body.ghi_chu||'').trim(), nowISO(), me.id, me.ho_ten).run();
    await logAudit(env,me,'nhập kết quả','ket_qua',id,MUC_TIN_CAY[muc]);
    return json({ db: await bootstrap(env, me), id });
  }
  // Import lô đối soát từ sàn: khớp mã → quy đơn; KHÔNG khớp duy nhất → vào hàng đợi gán tay
  if(path==='/ketqua/import' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const rows=Array.isArray(body.rows)?body.rows:[];
    const nguon=(body.nguon||'SHOPEE').trim();
    const muc=String(body.muc_tin_cay||NGUON_MUC_MAC_DINH[nguon]||'GIAN_TIEP').toUpperCase();
    if(!MUC_TIN_CAY[muc]) return json({error:'Mức tin cậy không hợp lệ'},400);
    if(muc==='KHONG_QUY_DON') return json({error:'Import đối soát phải là mức quy đơn được (Trực tiếp/Gián tiếp)'},400);
    let gan=0, cho=0;
    for(const r of rows){
      const ma=String(r.ma_theo_doi||r.ma||'').trim();
      const dt=Number(r.doanh_thu)||0, sd=Number(r.so_don)||0;
      if(!ma && !dt && !sd) continue;
      // Khớp mã: CHỈ quy đơn khi khớp ĐÚNG 1 bài. Mọi trường hợp khác → gán tay.
      const hits = ma ? (await env.DB.prepare(`SELECT * FROM air_posts WHERE ma_theo_doi=?`).bind(ma).all()).results : [];
      if(hits.length===1){
        await env.DB.prepare(`INSERT INTO ket_qua (id,air_post_id,muc_tin_cay,nguon,ky,doanh_thu,so_don,luot_xem,luot_tuong_tac,luot_click,ma_theo_doi,ghi_chu,created_at,created_by,created_by_name) VALUES (?,?,?,?,?,?,?,0,0,0,?,?,?,?,?)`)
          .bind(uid('kq'), hits[0].id, muc, nguon, (r.ky||body.ky||'').trim(), dt, sd, ma, 'Khớp mã tự động', nowISO(), me.id, me.ho_ten).run();
        gan++;
      } else {
        await env.DB.prepare(`INSERT INTO don_cho_gan (id,nguon,ma_doi_soat,doanh_thu,so_don,ky,ly_do,trang_thai,created_at) VALUES (?,?,?,?,?,?,?, 'CHO_GAN',?)`)
          .bind(uid('dcg'), nguon, ma, dt, sd, (r.ky||body.ky||'').trim(),
            !ma ? 'Dòng không có mã theo dõi' : (hits.length===0 ? 'Mã không khớp bài nào' : 'Mã khớp nhiều bài ('+hits.length+')'), nowISO()).run();
        cho++;
      }
    }
    await logAudit(env,me,'import đối soát','ket_qua',nguon,'khớp '+gan+' · chờ gán '+cho);
    return json({ db: await bootstrap(env, me), gan, cho });
  }
  if((m=path.match(/^\/ketqua\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM ket_qua WHERE id=?`).bind(m[1]).run();
    await logAudit(env,me,'xoá kết quả','ket_qua',m[1]);
    return json({ db: await bootstrap(env, me) });
  }
  // Gán tay 1 đơn trong hàng đợi vào đúng 1 bài (KHÔNG chia đều cho nhiều bài)
  if((m=path.match(/^\/donchogan\/(.+)\/assign$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const d=await env.DB.prepare(`SELECT * FROM don_cho_gan WHERE id=?`).bind(id).first();
    if(!d) return json({error:'Không tìm thấy'},404);
    if(d.trang_thai!=='CHO_GAN') return json({error:'Đơn này đã xử lý'},409);
    const ap=await env.DB.prepare(`SELECT * FROM air_posts WHERE id=?`).bind(body.air_post_id||'').first();
    if(!ap) return json({error:'Chọn bài đăng để gán'},400);
    // Gán tay luôn là GIÁN TIẾP: người vận hành suy luận, không phải sàn khẳng định
    await env.DB.prepare(`INSERT INTO ket_qua (id,air_post_id,muc_tin_cay,nguon,ky,doanh_thu,so_don,luot_xem,luot_tuong_tac,luot_click,ma_theo_doi,ghi_chu,created_at,created_by,created_by_name) VALUES (?,?,'GIAN_TIEP',?,?,?,?,0,0,0,?,?,?,?,?)`)
      .bind(uid('kq'), ap.id, d.nguon, d.ky||'', Number(d.doanh_thu)||0, Number(d.so_don)||0, d.ma_doi_soat||'', 'Gán tay từ hàng đợi', nowISO(), me.id, me.ho_ten).run();
    await env.DB.prepare(`UPDATE don_cho_gan SET trang_thai='DA_GAN', air_post_id=?, decided_at=?, decided_by_name=? WHERE id=?`).bind(ap.id,nowISO(),me.ho_ten,id).run();
    await logAudit(env,me,'gán tay đơn','don_cho_gan',id,ap.tieu_de||'');
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/donchogan\/(.+)\/skip$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const d=await env.DB.prepare(`SELECT * FROM don_cho_gan WHERE id=?`).bind(id).first();
    if(!d) return json({error:'Không tìm thấy'},404);
    if(d.trang_thai!=='CHO_GAN') return json({error:'Đơn này đã xử lý'},409);
    await env.DB.prepare(`UPDATE don_cho_gan SET trang_thai='BO_QUA', decided_at=?, decided_by_name=? WHERE id=?`).bind(nowISO(),me.ho_ten,id).run();
    await logAudit(env,me,'bỏ qua đơn không quy được','don_cho_gan',id,(body.ly_do||'').trim());
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/posts\/(.+)\/review$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const p=await env.DB.prepare(`SELECT * FROM post_seedings WHERE id=?`).bind(id).first();
    if(!p) return json({error:'Không tìm thấy'},404);
    const pricing=await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first();
    if(body.result===ST.DAT){
      // Chống trùng khi tính công: nếu đã có bài ĐẠT/ĐÃ CHI cùng nội dung–nhóm → bài này trùng, không tính tiền
      const dupWinner = (p.topic_id && p.group_id) ? await env.DB.prepare(
        `SELECT ps.id, u.ho_ten FROM post_seedings ps LEFT JOIN users u ON u.id=ps.sales_id
         WHERE ps.topic_id=? AND ps.group_id=? AND ps.id<>? AND ps.trang_thai IN (?,?) LIMIT 1`
      ).bind(p.topic_id, p.group_id, id, ST.DAT, ST.DA_CHI).first() : null;
      if(dupWinner && !body.force){
        const reason = 'Trùng nội dung–nhóm với bài đã duyệt'+(dupWinner.ho_ten?(' (của '+dupWinner.ho_ten+')'):'')+' — chỉ tính công 1 lần.';
        await env.DB.prepare(`UPDATE post_seedings SET trang_thai=?, thanh_tien=0, reviewed_by=?, reviewed_at=?, ly_do_loai=? WHERE id=?`)
          .bind(ST.KHONG_DAT, me.ho_ten, nowISO(), reason, id).run();
        await logAudit(env,me,'nghiệm thu TRÙNG (không tính công)','post_seeding',id,reason);
        return json({ db: await bootstrap(env, me), deduped:true, reason });
      }
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
    const dg = (body.don_gia===''||body.don_gia==null) ? null : Number(body.don_gia);
    await env.DB.prepare(`INSERT INTO filming_shots (id,phase_id,ten,mo_ta,source_mau_url,bat_buoc,thu_tu,active,don_gia) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(id,body.phase_id,body.ten,body.mo_ta||'',body.source_mau_url||'',bool(body.bat_buoc!==false),Number(n)+1,bool(body.active!==false),dg).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/shots\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const s=await env.DB.prepare(`SELECT * FROM filming_shots WHERE id=?`).bind(id).first();
    if(!s) return json({error:'Không tìm thấy'},404);
    const dg = ('don_gia' in body) ? ((body.don_gia===''||body.don_gia==null) ? null : Number(body.don_gia)) : s.don_gia;
    await env.DB.prepare(`UPDATE filming_shots SET ten=?, mo_ta=?, source_mau_url=?, bat_buoc=?, active=?, don_gia=? WHERE id=?`)
      .bind(body.ten??s.ten, body.mo_ta??s.mo_ta, body.source_mau_url??s.source_mau_url, body.bat_buoc!=null?bool(body.bat_buoc):s.bat_buoc, body.active!=null?bool(body.active):s.active, dg, id).run();
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
    const submit = body.submit!==false; // false = lưu nháp
    if(submit){
      const req = (await env.DB.prepare(`SELECT s.id FROM filming_shots s JOIN filming_phases p ON s.phase_id=p.id WHERE p.template_id=? AND s.active=1 AND s.bat_buoc=1`).bind(body.template_id).all()).results.map(x=>x.id);
      const uploaded = new Set((Array.isArray(body.uploads)?body.uploads:[]).map(u=>u.shot_id));
      if(!req.every(id=>uploaded.has(id))) return json({error:'Chưa đủ media cho các cảnh bắt buộc'},400);
    }
    const id=uid('pf');
    await env.DB.prepare(`INSERT INTO project_filmings (id,sales_id,template_id,ten_cong_trinh,khu_vuc,ngay_quay,trang_thai,ly_do_loai,thanh_tien,created_at) VALUES (?,?,?,?,?,?,?,'',0,?)`)
      .bind(id, me.id, body.template_id, body.ten_cong_trinh, body.khu_vuc||'', body.ngay_quay||nowISO(), submit?ST.CHO_DUYET:ST.NHAP, nowISO()).run();
    for(const up of (Array.isArray(body.uploads)?body.uploads:[])){
      await env.DB.prepare(`INSERT INTO filming_uploads (id,project_filming_id,shot_id,media_type,media_url,uploaded_at) VALUES (?,?,?,?,?,?)`)
        .bind(uid('up'), id, up.shot_id||null, up.media_type||'VIDEO', (up.media_url||'').trim(), nowISO()).run();
    }
    await logAudit(env,me, submit?'gửi nghiệm thu':'lưu nháp','project_filming',id);
    return json({ db: await bootstrap(env, me) });
  }
  // sửa/tiếp tục nháp (chủ công trình; chỉ khi Nháp hoặc bị trả về)
  if((m=path.match(/^\/filming\/projects\/([^\/]+)$/)) && method==='PATCH'){
    const id=m[1]; const p=await env.DB.prepare(`SELECT * FROM project_filmings WHERE id=?`).bind(id).first();
    if(!p) return json({error:'Không tìm thấy'},404);
    if(p.sales_id!==me.id) return json({error:'Không có quyền'},403);
    if(![ST.NHAP, ST.KHONG_DAT].includes(p.trang_thai)) return json({error:'Chỉ sửa được công trình nháp hoặc bị trả về'},400);
    const submit = body.submit===true;
    const newList = Array.isArray(body.uploads)?body.uploads:[];
    const newUrls = new Set(newList.map(u=>(u.media_url||'').trim()));
    const existing = (await env.DB.prepare(`SELECT * FROM filming_uploads WHERE project_filming_id=?`).bind(id).all()).results;
    const exUrls = new Set(existing.map(u=>u.media_url));
    for(const ex of existing){ if(!newUrls.has(ex.media_url)){ await deleteMediaObject(env, ex.media_url); await env.DB.prepare(`DELETE FROM filming_uploads WHERE id=?`).bind(ex.id).run(); } }
    for(const up of newList){ const url=(up.media_url||'').trim(); if(!exUrls.has(url)){ await env.DB.prepare(`INSERT INTO filming_uploads (id,project_filming_id,shot_id,media_type,media_url,uploaded_at) VALUES (?,?,?,?,?,?)`).bind(uid('up'), id, up.shot_id||null, up.media_type||'VIDEO', url, nowISO()).run(); } }
    if(submit){
      const req = (await env.DB.prepare(`SELECT s.id FROM filming_shots s JOIN filming_phases ph ON s.phase_id=ph.id WHERE ph.template_id=? AND s.active=1 AND s.bat_buoc=1`).bind(p.template_id).all()).results.map(x=>x.id);
      const have = new Set(newList.map(u=>u.shot_id));
      if(!req.every(x=>have.has(x))) return json({error:'Chưa đủ media cho các cảnh bắt buộc'},400);
    }
    await env.DB.prepare(`UPDATE project_filmings SET ten_cong_trinh=?, khu_vuc=?, ngay_quay=?, trang_thai=?, ly_do_loai=CASE WHEN ?='1' THEN '' ELSE ly_do_loai END WHERE id=?`)
      .bind(body.ten_cong_trinh??p.ten_cong_trinh, body.khu_vuc??p.khu_vuc, body.ngay_quay??p.ngay_quay, submit?ST.CHO_DUYET:ST.NHAP, submit?'1':'0', id).run();
    await logAudit(env,me, submit?'gửi nghiệm thu (nháp)':'lưu nháp','project_filming',id);
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/filming\/projects\/(.+)\/review$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const p=await env.DB.prepare(`SELECT * FROM project_filmings WHERE id=?`).bind(id).first();
    if(!p) return json({error:'Không tìm thấy'},404);
    const pricing=await env.DB.prepare(`SELECT * FROM pricing WHERE id=1`).first();
    // lưu kết quả chấm từng source theo MỨC (ratings: { uploadId: 0=loại | 1=Tạm ổn | 2=Chuẩn | 3=Đẹp })
    const ratings = body.ratings || {};
    for(const upId of Object.keys(ratings)){
      const lv = Number(ratings[upId])||0;
      await env.DB.prepare(`UPDATE filming_uploads SET dat_item=?, level=? WHERE id=? AND project_filming_id=?`).bind(lv>0?1:0, lv>0?lv:null, upId, id).run();
    }
    // tính tiền theo MỨC của TỪNG source đạt (Tạm ổn/Chuẩn/Đẹp), mỗi source tính riêng
    const lvPrice = (lv)=>{ lv=Number(lv); return lv===1?(Number(pricing.film_lv1)||0):lv===2?(Number(pricing.film_lv2)||0):lv===3?(Number(pricing.film_lv3)||0):0; };
    const ups = (await env.DB.prepare(`SELECT * FROM filming_uploads WHERE project_filming_id=?`).bind(id).all()).results;
    let tien = 0, okCount = 0;
    for(const u of ups){ const lv = u.level!=null ? Number(u.level) : (uBool(u.dat_item)?2:0); if(lv>0){ tien += lvPrice(lv); okCount++; } }
    if(body.result===ST.DAT){
      await env.DB.prepare(`UPDATE project_filmings SET trang_thai=?, thanh_tien=?, reviewed_by=?, reviewed_at=?, ky_thanh_toan=?, ly_do_loai='' WHERE id=?`)
        .bind(ST.DAT, tien, me.ho_ten, nowISO(), kyOf(), id).run();
      await logAudit(env,me,'hoàn tất nghiệm thu ĐẠT','project_filming',id, okCount+' source · '+tien);
    } else {
      if(!body.reason) return json({error:'Cần lý do'},400);
      await env.DB.prepare(`UPDATE project_filmings SET trang_thai=?, thanh_tien=0, reviewed_by=?, reviewed_at=?, ly_do_loai=? WHERE id=?`)
        .bind(ST.KHONG_DAT, me.ho_ten, nowISO(), body.reason, id).run();
      await logAudit(env,me,'nghiệm thu KHÔNG ĐẠT','project_filming',id,body.reason);
    }
    return json({ db: await bootstrap(env, me) });
  }
  // xoá 1 media (staff) — xoá luôn file trên R2 nếu là file app
  if((m=path.match(/^\/filming\/uploads\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const up = await env.DB.prepare(`SELECT * FROM filming_uploads WHERE id=?`).bind(m[1]).first();
    if(up){
      await deleteMediaObject(env, up.media_url);
      await env.DB.prepare(`DELETE FROM filming_uploads WHERE id=?`).bind(m[1]).run();
      await logAudit(env,me,'xoá media','filming_upload',m[1]);
    }
    return json({ db: await bootstrap(env, me) });
  }
  // hướng dẫn (staff sửa)
  if((m=path.match(/^\/guides\/([^\/]+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const k=m[1];
    await env.DB.prepare(`INSERT INTO guides (key,noi_dung,video_url,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET noi_dung=excluded.noi_dung, video_url=excluded.video_url, updated_at=excluded.updated_at`)
      .bind(k, body.noi_dung||'', body.video_url||'', nowISO()).run();
    await logAudit(env,me,'sửa hướng dẫn','guide',k);
    return json({ db: await bootstrap(env, me) });
  }
  // dọn media hết hạn ngay (staff)
  if(path==='/filming/cleanup' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const r = await cleanupOldMedia(env);
    return json({ db: await bootstrap(env, me), cleaned:r });
  }

  // ===== NỐI SEEDING ↔ CONTENT OS: đẩy nội dung ĐÃ DUYỆT sang thư viện seeding =====
  if((m=path.match(/^\/content\/(.+)\/day-seeding$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const ci=await env.DB.prepare(`SELECT * FROM content_items WHERE id=?`).bind(id).first();
    if(!ci) return json({error:'Không tìm thấy nội dung'},404);
    // Chỉ đẩy nội dung ĐÃ QUA 2 CỔNG DUYỆT — đây chính là giá trị: Sales seeding nội dung đã kiểm claim
    if(ci.trang_thai!=='DUYET') return json({error:'Chỉ đẩy nội dung ĐÃ DUYỆT (qua 2 cổng) sang seeding'},409);
    const daCo=await env.DB.prepare(`SELECT id FROM content_topics WHERE content_item_id=?`).bind(id).first();
    if(daCo) return json({error:'Nội dung này đã có trong thư viện seeding'},409);
    // Lấy nội dung đầy đủ từ kịch bản đã duyệt (nếu có) để Sales copy dùng ngay
    const sc=await env.DB.prepare(`SELECT * FROM scripts WHERE content_item_id=? AND trang_thai='DUYET' ORDER BY updated_at DESC LIMIT 1`).bind(id).first();
    let noi_dung='';
    if(sc){
      const secs=JSON.parse(sc.sections||'[]');
      noi_dung=[sc.hook, ...secs.map(x=>(x&&x.text)||''), sc.cta].filter(Boolean).join('\n\n');
    }
    if(!noi_dung){ const ct=JSON.parse(ci.chi_tiet||'{}'); noi_dung=ct.noi_dung||ct.brief||''; }
    const tid=uid('t');
    await env.DB.prepare(`INSERT INTO content_topics (id,chu_de,noi_dung,loai_bai,muc_tieu,tags,active,uu_tien,updated_at,content_item_id) VALUES (?,?,?,?,?,?,1,0,?,?)`)
      .bind(tid, (ci.tieu_de||'').trim(), noi_dung, (body.loai_bai||'').trim(), (body.muc_tieu||'').trim(),
        JSON.stringify(Array.isArray(body.tags)?body.tags:[]), nowISO(), id).run();
    await logAudit(env,me,'đẩy nội dung sang seeding','content_topics',tid,(ci.tieu_de||'').trim());
    return json({ db: await bootstrap(env, me), topic_id: tid });
  }

  // ===== CONTENT OS · TREND — nghiên cứu & triển khai =====
  if(path==='/trends' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!(body.ten||'').trim()) return json({error:'Nhập tên trend'},400);
    const id=uid('tr');
    await env.DB.prepare(`INSERT INTO trends (id,ten,nguon,link,mo_ta,phat_hien_ngay,han_dung,pillar_id,san_pham_id,danh_gia,rui_ro,trang_thai,ly_do,nguoi_de_xuat,created_at) VALUES (?,?,?,?,?,?,?,?,?,'{}',?,'MOI','',?,?)`)
      .bind(id,(body.ten||'').trim(),(body.nguon||'TIKTOK').trim(),(body.link||'').trim(),(body.mo_ta||'').trim(),
        (body.phat_hien_ngay||'').trim(),(body.han_dung||'').trim(), body.pillar_id||null, body.san_pham_id||null,
        (body.rui_ro||'').trim(), me.ho_ten, nowISO()).run();
    await logAudit(env,me,'ghi nhận trend','trends',id,(body.ten||'').trim());
    return json({ db: await bootstrap(env, me), id });
  }
  if((m=path.match(/^\/trends\/(.+)\/decide$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM trends WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    if(r.trang_thai==='DA_TRIEN_KHAI') return json({error:'Trend này đã triển khai'},409);
    const duyet = body.result==='DUYET';
    if(duyet){
      // Chỉ cho duyệt khi đã tick ĐỦ mục bắt buộc — tránh chạy theo trend rồi vỡ claim/hình ảnh
      const dg=JSON.parse(r.danh_gia||'{}');
      const thieu=TREND_CHECK.filter(c=>c.bat_buoc && !dg[c.k]).map(c=>c.label);
      if(thieu.length) return json({error:'Chưa đánh giá đủ mục bắt buộc', thieu},422);
    } else if(!String(body.ly_do||'').trim()) return json({error:'Bỏ qua phải nêu lý do'},400);
    await env.DB.prepare(`UPDATE trends SET trang_thai=?, ly_do=?, nguoi_duyet_ten=?, decided_at=? WHERE id=?`)
      .bind(duyet?'DUYET':'TU_CHOI', String(body.ly_do||'').trim(), me.ho_ten, nowISO(), id).run();
    await logAudit(env,me,(duyet?'duyệt':'bỏ qua')+' trend','trends',id,r.ten||'');
    return json({ db: await bootstrap(env, me) });
  }
  // Triển khai: trend đã duyệt → tạo thẳng 1 mục trong kế hoạch nội dung
  if((m=path.match(/^\/trends\/(.+)\/trien-khai$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM trends WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    if(r.trang_thai!=='DUYET') return json({error:'Chỉ triển khai trend ĐÃ DUYỆT'},409);
    const ciId = await insertContentItem(env, me, {
      loai: body.loai||'SOCIAL', tieu_de: (body.tieu_de||('[Trend] '+r.ten)).trim(),
      loai_muc_tieu: body.loai_muc_tieu||'THUONG_HIEU', pillar_id: r.pillar_id||null,
      framework_id: body.framework_id||null, san_pham_id: r.san_pham_id||null, kenh_id: body.kenh_id||null,
      thang: (body.thang||'').trim(), trang_thai:'Y_TUONG',
      chi_tiet: { tu_trend: r.ten, link_trend: r.link||'', han_dung: r.han_dung||'' },
    });
    await env.DB.prepare(`UPDATE trends SET trang_thai='DA_TRIEN_KHAI', content_item_id=?, decided_at=? WHERE id=?`).bind(ciId,nowISO(),id).run();
    await logAudit(env,me,'triển khai trend','trends',id,r.ten||'');
    return json({ db: await bootstrap(env, me), content_item_id: ciId });
  }
  if((m=path.match(/^\/trends\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM trends WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    const g=(k,d)=> body[k]!=null?String(body[k]).trim():d;
    const dg = body.danh_gia!=null ? JSON.stringify(body.danh_gia) : r.danh_gia;
    // đang đánh giá dở thì chuyển sang trạng thái DANH_GIA cho đúng thực tế
    let st = body.trang_thai!=null ? String(body.trang_thai).trim() : r.trang_thai;
    if(body.danh_gia!=null && st==='MOI') st='DANH_GIA';
    await env.DB.prepare(`UPDATE trends SET ten=?, nguon=?, link=?, mo_ta=?, phat_hien_ngay=?, han_dung=?, pillar_id=?, san_pham_id=?, danh_gia=?, rui_ro=?, trang_thai=? WHERE id=?`)
      .bind(g('ten',r.ten),g('nguon',r.nguon),g('link',r.link),g('mo_ta',r.mo_ta),g('phat_hien_ngay',r.phat_hien_ngay),g('han_dung',r.han_dung),
        body.pillar_id!==undefined?(body.pillar_id||null):r.pillar_id, body.san_pham_id!==undefined?(body.san_pham_id||null):r.san_pham_id,
        dg, g('rui_ro',r.rui_ro), st, id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/trends\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM trends WHERE id=?`).bind(m[1]).run();
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P10 — Thư viện học (máy rút đề xuất, NGƯỜI quyết) =====
  if(path==='/baihoc/quet' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const scripts=(await env.DB.prepare(`SELECT * FROM scripts`).all()).results;
    const airs=(await env.DB.prepare(`SELECT * FROM air_posts`).all()).results;
    const kq=(await env.DB.prepare(`SELECT * FROM ket_qua`).all()).results;
    const fws=(await env.DB.prepare(`SELECT * FROM frameworks`).all()).results;
    const aps=(await env.DB.prepare(`SELECT * FROM approvals WHERE cong='CLAIM' AND trang_thai='TRA_LAI'`).all()).results;
    const daCo=(await env.DB.prepare(`SELECT tieu_de FROM bai_hoc`).all()).results.map(x=>x.tieu_de);
    const scrById={}; scripts.forEach(s=>scrById[s.id]=s);
    let them=0;
    const push=async(loai,tieu_de,noi_dung,bang_chung,so_mau)=>{
      if(daCo.includes(tieu_de)) return;            // không tạo trùng đề xuất
      await env.DB.prepare(`INSERT INTO bai_hoc (id,loai,tieu_de,noi_dung,bang_chung,so_mau,nguon_tu_dong,trang_thai,ghi_chu,created_at) VALUES (?,?,?,?,?,?,1,'DE_XUAT','',?)`)
        .bind(uid('bh'),loai,tieu_de,noi_dung,JSON.stringify(bang_chung||{}),so_mau||0,nowISO()).run();
      daCo.push(tieu_de); them++;
    };
    // (1) Framework: chỉ kết luận khi ĐỦ MẪU. Tổng hợp cái đã xảy ra, KHÔNG dự đoán.
    const perFw={};
    airs.forEach(a=>{ const sc=a.script_id?scrById[a.script_id]:null; const fid=sc&&sc.framework_id; if(!fid) return;
      (perFw[fid] ||= {bai:0, dt:0, don:0, view:0});
      perFw[fid].bai++;
      kq.filter(k=>k.air_post_id===a.id).forEach(k=>{
        if(k.muc_tin_cay==='KHONG_QUY_DON') perFw[fid].view += Number(k.luot_xem)||0;
        else { perFw[fid].dt += Number(k.doanh_thu)||0; perFw[fid].don += Number(k.so_don)||0; }
      });
    });
    for(const fid of Object.keys(perFw)){
      const st=perFw[fid]; if(st.bai < MIN_MAU_BANG_CHUNG) continue;      // chưa đủ mẫu → im lặng
      const fw=fws.find(f=>f.id===fid); if(!fw) continue;
      const tb=Math.round(st.dt/st.bai);
      await push('FRAMEWORK', 'Framework "'+fw.ten+'": '+st.bai+' bài đã đo',
        'Quan sát trên '+st.bai+' bài đã đăng: doanh thu quy đơn được '+st.dt.toLocaleString('vi-VN')+'đ ('+st.don+' đơn), trung bình '+tb.toLocaleString('vi-VN')+'đ/bài; '+st.view.toLocaleString('vi-VN')+' lượt xem (không quy đơn). Đây là số ĐÃ XẢY RA, không phải dự đoán cho bài sau.',
        {framework_id:fid, ...st, trung_binh:tb}, st.bai);
    }
    // (2) Claim: cụm từ bị Kỹ thuật trả lại lặp lại nhiều lần → đề xuất bổ sung danh sách cấm
    const lyDo={};
    aps.forEach(a=>{ const t=String(a.ghi_chu||'').trim().toLowerCase(); if(t.length>=6) lyDo[t]=(lyDo[t]||0)+1; });
    for(const t of Object.keys(lyDo)){
      if(lyDo[t] < 2) continue;                                          // lặp ít nhất 2 lần mới coi là mẫu hình
      await push('CLAIM', 'Lỗi claim lặp lại: '+t.slice(0,60),
        'Kỹ thuật đã trả lại '+lyDo[t]+' lần với cùng lý do này. Cân nhắc bổ sung cụm từ liên quan vào danh sách claim cấm, hoặc ghi vào brand voice để người viết tránh từ đầu.',
        {so_lan:lyDo[t], ly_do:t}, lyDo[t]);
    }
    await logAudit(env,me,'quét thư viện học','bai_hoc','',them+' đề xuất mới');
    return json({ db: await bootstrap(env, me), them });
  }
  if(path==='/baihoc' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!(body.tieu_de||'').trim()) return json({error:'Nhập tiêu đề bài học'},400);
    const id=uid('bh');
    await env.DB.prepare(`INSERT INTO bai_hoc (id,loai,tieu_de,noi_dung,bang_chung,so_mau,nguon_tu_dong,trang_thai,ghi_chu,created_at) VALUES (?,?,?,?,'{}',0,0,'DE_XUAT','',?)`)
      .bind(id,(body.loai||'KHAC').trim(),(body.tieu_de||'').trim(),(body.noi_dung||'').trim(),nowISO()).run();
    return json({ db: await bootstrap(env, me), id });
  }
  // NGƯỜI quyết: đề xuất chỉ thành quy tắc khi được duyệt
  if((m=path.match(/^\/baihoc\/(.+)\/decide$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM bai_hoc WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    if(r.trang_thai!=='DE_XUAT') return json({error:'Bài học này đã được quyết'},409);
    const duyet = body.result==='DUYET';
    if(!duyet && !String(body.ghi_chu||'').trim()) return json({error:'Từ chối phải nêu lý do'},400);
    await env.DB.prepare(`UPDATE bai_hoc SET trang_thai=?, nguoi_duyet_ten=?, ghi_chu=?, decided_at=? WHERE id=?`)
      .bind(duyet?'DA_DUYET':'TU_CHOI', me.ho_ten, String(body.ghi_chu||'').trim(), nowISO(), id).run();
    await logAudit(env,me,(duyet?'duyệt':'từ chối')+' bài học','bai_hoc',id,r.tieu_de||'');
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/baihoc\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM bai_hoc WHERE id=?`).bind(m[1]).run();
    return json({ db: await bootstrap(env, me) });
  }

  // ===== CONTENT OS · P5 — Kho footage + shot list =====
  if(path==='/footage' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!(body.media_url||'').trim()) return json({error:'Cần file hoặc link media'},400);
    const id=uid('ft');
    await env.DB.prepare(`INSERT INTO footage (id,ten,mo_ta,media_url,media_type,tags,san_pham_id,kenh_id,dia_diem,ngay_quay,nguoi_quay,active,created_at,created_by,created_by_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`)
      .bind(id,(body.ten||'').trim(),(body.mo_ta||'').trim(),(body.media_url||'').trim(),(body.media_type||'VIDEO').trim(),
        JSON.stringify(Array.isArray(body.tags)?body.tags:[]), body.san_pham_id||null, body.kenh_id||null,
        (body.dia_diem||'').trim(),(body.ngay_quay||'').trim(),(body.nguoi_quay||'').trim(), nowISO(), me.id, me.ho_ten).run();
    await logAudit(env,me,'thêm footage','footage',id,(body.ten||'').trim());
    return json({ db: await bootstrap(env, me), id });
  }
  if((m=path.match(/^\/footage\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM footage WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    const g=(k,d)=> body[k]!=null?String(body[k]).trim():d;
    await env.DB.prepare(`UPDATE footage SET ten=?, mo_ta=?, tags=?, san_pham_id=?, kenh_id=?, dia_diem=?, ngay_quay=?, nguoi_quay=?, active=? WHERE id=?`)
      .bind(g('ten',r.ten),g('mo_ta',r.mo_ta), body.tags!=null?JSON.stringify(body.tags):r.tags,
        body.san_pham_id!==undefined?(body.san_pham_id||null):r.san_pham_id, body.kenh_id!==undefined?(body.kenh_id||null):r.kenh_id,
        g('dia_diem',r.dia_diem),g('ngay_quay',r.ngay_quay),g('nguoi_quay',r.nguoi_quay),
        body.active!=null?bool(body.active):r.active, id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/footage\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM footage WHERE id=?`).bind(id).first();
    if(r) await deleteMediaObject(env, r.media_url);
    // gỡ liên kết ở shot list để không trỏ vào footage đã xoá
    await env.DB.prepare(`UPDATE shot_list SET footage_id=NULL, trang_thai='CHUA_QUAY' WHERE footage_id=?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM footage WHERE id=?`).bind(id).run();
    await logAudit(env,me,'xoá footage','footage',id);
    return json({ db: await bootstrap(env, me) });
  }
  // Sinh shot list TỪ kịch bản đã có: mỗi phần thân kịch bản → 1 cảnh cần quay
  if((m=path.match(/^\/shotlist\/from-script\/(.+)$/)) && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const sid=m[1]; const sc=await env.DB.prepare(`SELECT * FROM scripts WHERE id=?`).bind(sid).first();
    if(!sc) return json({error:'Không tìm thấy kịch bản'},404);
    const cur=(await env.DB.prepare(`SELECT COUNT(*) c FROM shot_list WHERE script_id=?`).bind(sid).first())?.c||0;
    if(Number(cur)>0) return json({error:'Kịch bản này đã có shot list — xoá cảnh cũ trước nếu muốn sinh lại'},409);
    const secs=JSON.parse(sc.sections||'[]');
    const rows=[]; let so=1;
    if((sc.hook||'').trim()) rows.push(['Hook — '+String(sc.hook).slice(0,60), sc.hook]);
    secs.forEach(x=>{ if(x && (x.label||x.text)) rows.push([x.label||('Cảnh '+so), x.text||'']); });
    if((sc.cta||'').trim()) rows.push(['CTA', sc.cta]);
    if(!rows.length) return json({error:'Kịch bản chưa có nội dung để tách cảnh'},400);
    for(const [ten,mo] of rows){
      await env.DB.prepare(`INSERT INTO shot_list (id,script_id,thu_tu,ten_canh,mo_ta,goc_may,thoi_luong,footage_id,trang_thai,ghi_chu,created_at,updated_at) VALUES (?,?,?,?,?,'',0,NULL,'CHUA_QUAY','',?,?)`)
        .bind(uid('sl'),sid,so++,String(ten).slice(0,120),String(mo).slice(0,500),nowISO(),nowISO()).run();
    }
    await logAudit(env,me,'sinh shot list','shot_list',sid,rows.length+' cảnh');
    return json({ db: await bootstrap(env, me), created: rows.length });
  }
  if(path==='/shotlist' && method==='POST'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    if(!body.script_id) return json({error:'Cần kịch bản'},400);
    const n=Number((await env.DB.prepare(`SELECT COUNT(*) c FROM shot_list WHERE script_id=?`).bind(body.script_id).first())?.c||0);
    const id=uid('sl');
    await env.DB.prepare(`INSERT INTO shot_list (id,script_id,thu_tu,ten_canh,mo_ta,goc_may,thoi_luong,footage_id,trang_thai,ghi_chu,created_at,updated_at) VALUES (?,?,?,?,?,?,?,NULL,'CHUA_QUAY','',?,?)`)
      .bind(id, body.script_id, n+1, (body.ten_canh||'Cảnh mới').trim(), (body.mo_ta||'').trim(), (body.goc_may||'').trim(), Number(body.thoi_luong)||0, nowISO(), nowISO()).run();
    return json({ db: await bootstrap(env, me), id });
  }
  if((m=path.match(/^\/shotlist\/(.+)$/)) && method==='PATCH'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    const id=m[1]; const r=await env.DB.prepare(`SELECT * FROM shot_list WHERE id=?`).bind(id).first();
    if(!r) return json({error:'Không tìm thấy'},404);
    // gắn footage vào cảnh → tự chuyển trạng thái ĐÃ QUAY (nếu chưa đặt tay)
    let fid = body.footage_id!==undefined ? (body.footage_id||null) : r.footage_id;
    if(fid){ const f=await env.DB.prepare(`SELECT id FROM footage WHERE id=?`).bind(fid).first(); if(!f) return json({error:'Footage không tồn tại'},404); }
    const st = body.trang_thai!=null ? String(body.trang_thai).trim() : (body.footage_id!==undefined ? (fid?'DA_QUAY':'CHUA_QUAY') : r.trang_thai);
    const g=(k,d)=> body[k]!=null?String(body[k]).trim():d;
    await env.DB.prepare(`UPDATE shot_list SET ten_canh=?, mo_ta=?, goc_may=?, thoi_luong=?, footage_id=?, trang_thai=?, ghi_chu=?, thu_tu=?, updated_at=? WHERE id=?`)
      .bind(g('ten_canh',r.ten_canh),g('mo_ta',r.mo_ta),g('goc_may',r.goc_may), body.thoi_luong!=null?Number(body.thoi_luong)||0:r.thoi_luong,
        fid, st, g('ghi_chu',r.ghi_chu), body.thu_tu!=null?Number(body.thu_tu)||0:r.thu_tu, nowISO(), id).run();
    return json({ db: await bootstrap(env, me) });
  }
  if((m=path.match(/^\/shotlist\/(.+)$/)) && method==='DELETE'){
    if(!isStaff(me)) return json({error:'Không có quyền'},403);
    await env.DB.prepare(`DELETE FROM shot_list WHERE id=?`).bind(m[1]).run();
    return json({ db: await bootstrap(env, me) });
  }


  return json({error:'Route không tồn tại: '+method+' '+path}, 404);
}

// xoá object trên R2 nếu media_url là file do app lưu ('/media/<key>')
async function deleteMediaObject(env, media_url){
  if(env.MEDIA && typeof media_url==='string' && media_url.startsWith('/media/')){
    try { await env.MEDIA.delete(decodeURIComponent(media_url.slice('/media/'.length))); } catch(e){}
  }
}

// Dọn media của công trình CHƯA ĐƯỢC DUYỆT quá 30 ngày (chạy theo cron)
// Cron hằng ngày: chụp lại tình trạng việc kẹt vào nhật ký để có dấu vết theo thời gian.
// Nguồn sự thật vẫn là bootstrap (tính tươi); đây chỉ là bản ghi lịch sử.
async function ghiNhatKyViecKet(env){
  try{
    await ensureSchema(env);
    const g=async(sql)=>(await env.DB.prepare(sql).all()).results;
    const v=tinhViecKet({
      scripts: await g(`SELECT id,tieu_de,hook,trang_thai,so_lan_tra,updated_at FROM scripts`),
      approvals: await g(`SELECT id,cong,trang_thai,created_at FROM approvals`),
      air_posts: await g(`SELECT id,tieu_de,trang_thai,posted_at FROM air_posts`),
      ket_qua: await g(`SELECT air_post_id FROM ket_qua`),
      trends: await g(`SELECT id,ten,trang_thai,han_dung FROM trends`),
      don_cho_gan: await g(`SELECT id,ma_doi_soat,trang_thai,created_at FROM don_cho_gan`),
    });
    if(v.tong===0) return;
    const mo=[
      v.sua_lai.length?v.sua_lai.length+' kịch bản bị trả chưa sửa':'',
      v.cho_duyet.length?v.cho_duyet.length+' cổng duyệt tồn':'',
      v.chua_nhap_kq.length?v.chua_nhap_kq.length+' bài đã đăng chưa nhập kết quả':'',
      v.trend_gap.length?v.trend_gap.length+' trend sắp/đã hết hạn':'',
      v.don_ket.length?v.don_ket.length+' đơn chờ gán tay':'',
    ].filter(Boolean).join(' · ');
    await env.DB.prepare(`INSERT INTO audit (id,at,by_id,by_name,action,entity,entity_id,detail) VALUES (?,?,'','Hệ thống','nhắc việc','viec_ket',?,?)`)
      .bind(uid('a'), nowISO(), String(v.tong), mo).run();
  }catch(e){}
}
async function cleanupOldMedia(env){
  await ensureSchema(env);
  const cutoff = new Date(Date.now() - 30*24*60*60*1000).toISOString();
  const stale = (await env.DB.prepare(
    `SELECT id FROM project_filmings WHERE trang_thai NOT IN ('DAT','DA_CHI') AND created_at < ?`
  ).bind(cutoff).all()).results;
  let removed = 0;
  for(const p of stale){
    const ups = (await env.DB.prepare(`SELECT * FROM filming_uploads WHERE project_filming_id=?`).bind(p.id).all()).results;
    for(const up of ups){ await deleteMediaObject(env, up.media_url); removed++; }
    await env.DB.prepare(`DELETE FROM filming_uploads WHERE project_filming_id=?`).bind(p.id).run();
  }
  if(stale.length) await logAudit(env, null, 'dọn media hết hạn 30 ngày', 'filming', '-', stale.length+' công trình · '+removed+' media');
  return { projects: stale.length, media: removed };
}

export default {
  // Cron: dọn media công trình chưa duyệt quá 30 ngày
  async scheduled(controller, env, ctx){
    // Hai lịch cron khác nhau vào chung handler → phải tách, nếu không việc hằng ngày
    // sẽ chạy mỗi 15 phút và làm rác nhật ký.
    const cron = (controller && controller.cron) || '';
    if(cron.startsWith('*/15')){
      ctx.waitUntil(chayLichDang(env));           // quét bài tới giờ đăng
    } else {
      ctx.waitUntil(cleanupOldMedia(env));        // dọn media quá hạn
      ctx.waitUntil(ghiNhatKyViecKet(env));       // chụp tình trạng việc kẹt
      ctx.waitUntil(chayLichDang(env));           // chạy kèm cho chắc, phòng lịch 15' lỗi
    }
  },
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      if(request.method==='OPTIONS') return new Response(null, { status:204, headers:CORS });
      try { return await handleApi(request, env); }
      catch(e){ return json({error:'Lỗi server: '+(e.message||e)}, 500); }
    }
    // media từ R2 (ảnh/video Sales tải lên app) — hỗ trợ Range để tua video
    if(url.pathname.startsWith('/media/')){
      if(!env.MEDIA) return new Response('R2 chưa cấu hình', { status:503 });
      const key = decodeURIComponent(url.pathname.slice('/media/'.length));
      const rangeHeader = request.headers.get('range');
      let rangeOpt;
      if(rangeHeader){ const mm = /bytes=(\d*)-(\d*)/.exec(rangeHeader); if(mm){ const o={}; if(mm[1]!=='') o.offset=Number(mm[1]); if(mm[2]!=='') o.length=Number(mm[2])-(o.offset||0)+1; rangeOpt=o; } }
      const obj = await env.MEDIA.get(key, rangeOpt?{ range:rangeOpt }:undefined);
      if(!obj) return new Response('Not found', { status:404 });
      const h = new Headers();
      obj.writeHttpMetadata(h);
      h.set('etag', obj.httpEtag);
      h.set('Cache-Control', 'public, max-age=31536000, immutable');
      h.set('Accept-Ranges', 'bytes');
      const size = obj.size;
      if(obj.range && (obj.range.offset!=null || obj.range.length!=null)){
        const start = obj.range.offset||0; const end = start + (obj.range.length|| (size-start)) - 1;
        h.set('Content-Range', `bytes ${start}-${end}/${size}`);
        return new Response(obj.body, { status:206, headers:h });
      }
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
