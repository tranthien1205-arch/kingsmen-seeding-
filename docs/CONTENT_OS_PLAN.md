# KINGSMEN CONTENT & SEEDING OS — KẾ HOẠCH TRIỂN KHAI (bộ nhớ bền)

> **Đọc file này ĐẦU TIÊN mỗi phiên.** Đây là nguồn sự thật về mục tiêu, kiến trúc, tiến độ, và cách build/test/deploy. Cập nhật file này sau MỖI lát cắt hoàn thành (mục "Changelog" + đổi trạng thái module).
> Cập nhật lần cuối: sau khi deploy **P10** (commit `ee1ed40`) — **đã xong toàn bộ P1→P10**.

---

## 0. MỤC TIÊU TỐI THƯỢNG
Biến app từ "quản lý seeding" thành **hệ vận hành nội dung khép vòng**, **thay thế hoàn toàn**:
- Các **file Excel rời rạc** (2 file đã nhận — xem §7).
- Các **chatbot AI đứng lẻ** (viết script không có ngữ cảnh sản phẩm, dễ bịa/sai claim).

Và phải **vượt trội thật** (không chỉ thay ngang) — xem §6 (9 trụ giá trị).

**Nguyên tắc "không nửa vời":** một tính năng chỉ "xong" khi mở app dùng trọn vẹn: tạo → xem → sửa → xóa → F5 còn nguyên → số đúng → phân quyền đúng. Đụng cái gì → truy hết mối liên hệ → xử lý đủ.

**Nguyên tắc "không bịa số":** thiếu dữ liệu thì để trống + ghi "chưa đủ dữ liệu", KHÔNG điền số mặc định. Không dùng AI dự đoán viral/%xem-3s.

---

## 1. STACK & ÁNH XẠ (đã chốt — thích ứng vào app hiện tại)
App hiện tại KHÔNG phải Next.js/Supabase như brief gốc. Ta **thích ứng Content OS vào stack đang chạy**:

| Brief gốc (Content OS) | Thực tế app này |
|---|---|
| Next.js 15 + Prisma | **1 file `seeding-app.html`** (React 18 + Babel in-browser, classic runtime) |
| Supabase Postgres + RLS | **Cloudflare D1 (SQLite)** + kiểm quyền ở Worker |
| Supabase Auth | Auth tự viết (bảng `users`+`sessions`, bcrypt-ish) |
| Supabase Storage | **Cloudflare R2** (binding `MEDIA`, bucket `kingsmen-media`) |
| Vercel Cron | **Cloudflare Cron** (`wrangler.toml` crons) |
| Anthropic SDK (client) | Gọi từ **Worker** (cần cắm `ANTHROPIC_API_KEY` — CHƯA có) |
| Vercel hosting | **Cloudflare** (Worker phục vụ `dist/` + API) |

**File chính:**
- `seeding-app.html` — toàn bộ frontend. **Sau khi sửa: copy sang `dist/index.html`.**
- `worker/index.js` — API + D1 + R2 + serve static + cron.
- `wrangler.toml` — bindings: `DB` (D1 `appseedingkingsmen-db`), `MEDIA` (R2), cron `["0 18 * * *"]`.

---

## 2. QUY TRÌNH BUILD / TEST / DEPLOY (BẮT BUỘC theo đúng)
1. **Sửa `worker/index.js` và/hoặc `seeding-app.html`.**
2. **Đồng bộ:** `cp seeding-app.html dist/index.html`.
3. **Validate (không cần trình duyệt):**
   - Worker: `node --check worker/index.js`.
   - Frontend: cài tạm `@babel/standalone`, transform khối `<script type="text/plain" id="app-src">` với preset `react`. Phải in `BABEL OK`. (Nhớ `rm -rf node_modules` trước khi commit.)
4. **Test tích hợp backend** (mô phỏng D1 bằng `node:sqlite`): tạo `DatabaseSync(':memory:')` làm adapter cho `env.DB.prepare().bind().first()/all()/run()` + `env.DB.batch()`, gọi `worker.fetch(new Request('https://x/api'+path,...), env, {waitUntil(){}})`. Seed Marketing mặc định: **`mkt@kingsmen.vn` / `123456`**. Mẫu test ở `/tmp/.../scratchpad/test_*.mjs`.
5. **Deploy:** `git push origin HEAD:main` → Cloudflare tự build. (User đã cho phép push thẳng main.)
   - Commit identity: `git config user.email noreply@anthropic.com && user.name Claude`.
   - HTML có header `no-cache` nhưng vẫn nên hard-refresh (Ctrl/Cmd+Shift+R) 1 lần.
6. **Báo cáo theo mẫu:** ✅ ĐÃ LÀM · 🔗 LIÊN ĐỚI · 🧪 ĐÃ KIỂM · ⚠️ CHƯA LÀM · ▶️ BẠN KIỂM TRA.

**Kiến trúc dữ liệu:** MỘT nguồn sự thật. Mọi mutation ở Worker trả `{db: await bootstrap(env, me)}` → frontend `setDb(r.db)`. Frontend có nhánh **DEMO** (`const DEMO` trong AppProvider) chạy in-memory (đối chiếu logic backend) — khi thêm bảng/endpoint phải cập nhật **cả demo lẫn real** + `seedDB()` + `migrate()`.

---

## 3. VAI TRÒ (mở dần 3 → 6, chỉ thêm khi có màn thật)
| Vai trò | Trạng thái | Ghi chú |
|---|---|---|
| `MARKETING` | ✅ có | = Trưởng MKT tạm thời; `isStaff` |
| `SALES` | ✅ có | seeding |
| `ADMIN` | ✅ có | "Admin / Kế toán"; `isStaff` |
| `KY_THUAT` | ✅ **đã thêm (P1)** | chủ sở hữu Sản phẩm & Claim; KHÔNG `isStaff`; quyền qua `canBaseData` |
| `TRUONG_MKT` | ⏳ thêm ở P3/P6 | tách khỏi MARKETING khi có duyệt 2 cổng |
| `MKT_STAFF` | ⏳ thêm ở P3/P4 | người sản xuất |
| `GIAM_DOC` | ⏳ thêm ở P9 | xem Dashboard + đặt pillar/tỷ lệ |

**DEV PREVIEW (cờ `is_dev` trên user):** chỉ tài khoản `is_dev=1` thấy các module ĐANG NÂNG CẤP. `BETA_KEYS = {strategy, plan, studio, approve, air, ketqua, footage, cdash, hoc, products}` (lọc trong `Shell`) — tức **toàn bộ Content OS đang ẩn với user thường**. Seed sẵn **`dev@masfico.vn` / `Dev2026!`** (ADMIN, is_dev=1) — đổi mật khẩu sau. Admin/Marketing bật/tắt cờ dev cho từng tài khoản ở màn Tài khoản. Khi 1 module "ra mắt chính thức" → bỏ key khỏi `BETA_KEYS`.

**Quyền helper trong Worker:**
- `isStaff(u)` = MARKETING || ADMIN (gác 29+ hành động seeding/review — **KHÔNG mở rộng bừa**).
- `canBaseData(u)` = KY_THUAT || MARKETING || ADMIN (dữ liệu nền P1).
- ⏳ P0 thật: viết `can(user, action)` tập trung + tách `TRUONG_MKT`/`MKT_STAFF`/`GIAM_DOC`. Chưa làm để tránh phá seeding đang chạy.

**Quy tắc quyền không được phá:** 2 cổng duyệt song song độc lập (Trưởng MKT = nội dung; Kỹ thuật = claim, chỉ Duyệt/Trả về, KHÔNG sửa nội dung). Item "Đã duyệt" khi CẢ HAI pass.

---

### ✅ QUẢN LÝ SẢN XUẤT (`san_xuat`) — thay file ECOM 51 cột
6 khâu `SX_KHAU`: Kế hoạch → Brief → Quay → Dựng → Đăng → Đo lường; mỗi khâu có PIC / deadline / trạng thái / link riêng. Cột phụ vào `chi_tiet` JSON, số đo vào `so_lieu` JSON.
- **Nối về `content_items`** qua `san_xuat.content_item_id`. Import khớp theo **tên + tháng**; không khớp thì (tuỳ chọn) **tạo mục kế hoạch mới** rồi nối — import lại **không nhân đôi**.
- `gomSanXuatTheoNoiDung()` → cột **Sản xuất** trong Kế hoạch nội dung (đang ở khâu nào, mấy dòng trễ). Cảnh báo dòng **chưa nối** vì chúng không lên Dashboard.
- **Auto-map 51/51 cột** file thật, đọc 139 dòng. **`LOI_EXCEL` bỏ qua ô `#DIV/0!`/`#N/A`…** — file thật có **53 ô lỗi**, nếu để `Number()` xử lý sẽ thành **0 giả**. (15 + 12 test)

### ⚠️ VÌ SAO TRƯỚC ĐÂY KHÔNG IMPORT ĐƯỢC (đã sửa — đừng lặp lại)
1. **SheetJS nạp từ `cdn.sheetjs.com`** → CDN bị chặn/chậm là `XLSX` không bao giờ tồn tại, user không import được lần nào. **Nay TỰ HOST `/vendor/xlsx.full.min.js`** (giống `tools/vendor/ffmpeg/`). **Không dùng CDN bên thứ ba cho thư viện sống-còn.**
2. **Parse cả workbook** để lấy 1 sheet → file Social 1.8 MB / 36 sheet treo giao diện. **Nay `bookSheets:true` lấy tên sheet trước, rồi `{sheets:sn}` parse đúng 1 sheet** (nhanh ~4.6×), có báo "đang đọc".

### ✅ AI TRONG APP (3 mảng)
**Hạ tầng chung:** `goiAI()` gọi Anthropic; `boiCanhAI()` dựng ảnh chụp dữ liệu THẬT; `AI_NGUYEN_TAC` là system prompt ép 6 nguyên tắc (không bịa số · **không cộng dồn 3 mức tin cậy** · không dự đoán viral · chỉ trích spec thật · tránh cụm cấm · trả lời tiếng Việt). Thiếu key → `thieu_key:true`, **không bao giờ giả vờ trả lời**.
1. **AI viết kịch bản** `POST /scripts/ai-sinh` — prompt kèm **thông số/tiêu chuẩn thật** của sản phẩm + brand voice + **danh sách cụm cấm** + **bài học đã duyệt (RAG)**. Output **quét lại claim**: chạm mức CHẶN → **từ chối, không đưa cho user**. Nút "🤖 Nhờ AI viết" cạnh nút sinh theo khuôn.
2. **Chatbot** `POST /ai/chat` (nút nổi, chỉ MKT/ADMIN) — hỏi đáp trên dữ liệu thật. Bối cảnh gửi đi có `ket_qua_TACH_3_MUC` nên **AI không thể cộng nhầm**; **không gửi mật khẩu/dữ liệu nhạy cảm**.
3. **AI chấm trend** `POST /trends/:id/ai-danh-gia` — xem mục "AI đánh giá trend" bên dưới.
4. **AI CHẠY TRÊN MÁY — MIỄN PHÍ** (`BocLoiThoai`): Whisper qua transformers.js, tách âm bằng WebAudio, bóc lời thoại video → điền caption bài đăng / mô tả footage. **Video không rời máy, không gọi API, không tốn phí.** Nạp thư viện theo yêu cầu (lazy) vì nặng.
- Test: 20/20 (gồm AI lỡ viết cụm CHẶN → chặn; AI trả rác; thiếu key; RBAC).

### ✅ AI ĐÁNH GIÁ TREND — "AI chấm sẵn, người quyết" (mặc định KHÔNG tự duyệt)
**Vì sao không cho AI tự quyết ngay:** trend là chỗ **rủi ro thương hiệu cao nhất**, và "trend này có đáng làm không" về bản chất là **dự đoán** — thứ đã thống nhất không giao cho AI (§ranh giới). Nên thiết kế là: **AI chấm sẵn checklist kèm lý do từng mục → người đọc rồi bấm duyệt**. Ai muốn tự động hơn thì **tự bật công tắc**, có ràng buộc.
- `POST /trends/:id/ai-danh-gia` (Marketing/Admin; Sales 403; trend `DA_TRIEN_KHAI` → 409). Prompt gửi kèm **trụ cột, định hướng thương hiệu, thông số/tiêu chuẩn THẬT của sản phẩm, danh sách cụm cấm**; system prompt **cấm dự đoán viral/%view**.
- **Ba chốt chặn AI bịa:**
  1. Chỉ nhận **đúng mã mục có trong checklist** — AI bịa thêm mục thì **bỏ**, không ghi vào.
  2. Mục `kip_thoi` **hệ thống tự tính** từ `han_dung` vs hôm nay — **không nghe AI**, kể cả khi AI bảo "còn kịp".
  3. AI trả rác / thiếu phần đánh giá → **báo lỗi rõ, giữ nguyên trạng thái trend**, không ghi bừa.
- **Tự duyệt (mặc định TẮT)** — chỉ xảy ra khi **cả ba** đều đúng: bật `tu_dong_duyet` + AI chấm **đủ mọi mục bắt buộc** + **không có `rui_ro_claim`** (khi `chan_khi_rui_ro` bật). Không đủ thì trả `vi_sao_khong_tu_duyet` nói rõ vướng ở đâu. Tự duyệt ghi `nguoi_duyet_ten = "AI tự duyệt (bật trong Cấu hình)"` — **không mạo danh người thật** — và audit tách riêng `AI tự duyệt trend` vs `AI đánh giá trend`.
- **Trend quá hạn tự Bỏ qua** (`tuDongHetHanTrend`, cron hằng ngày, tắt được bằng `tu_dong_het_han`): so ngày thuần **không gọi AI**; ghi `nguoi_duyet_ten = "Hệ thống"`; không đụng trend đã triển khai / còn hạn / không đặt hạn.
- **Cấu hình nằm chung tab ⚙️ của module Trend** (`module_config.trend`): checklist + 3 công tắc trong một chỗ, sửa cái này không mất cái kia. `CauHinhModule` có thêm kiểu trường `bat` (công tắc bật/tắt kèm giải thích).
- UI: nút **"🤖 Nhờ AI chấm trước"** trong `TrendDetail` (chỉ hiện khi `db.ai_san_sang`); lý do từng mục hiện ngay dưới mục đó; thẻ tóm tắt nổi lên trên nên **vẫn đọc được sau khi AI tự duyệt**; dòng chú thích luôn nói rõ đang bật hay tắt tự duyệt.
- Test: **40/40** (thiếu key · RBAC · AI bịa mục · `kip_thoi` tự tính · chặn tự duyệt khi thiếu mục / có rủi ro claim · cron hết hạn · checklist sửa rồi AI chấm theo bản mới · công tắc và checklist không đè nhau).

## 4. REGISTRY BẢNG D1 (nguồn sự thật schema)
**Nền tảng & Seeding (Domain A — ĐANG CHẠY, không đụng):**
`users, sessions, groups, content_topics, cmt_suggestions, post_seedings, cmt_seedings, cmt_proofs, audit, pricing, filming_templates, filming_phases, filming_shots, project_filmings, filming_uploads, guides, post_type_prefs, post_slots, media_library`

**Content OS (Domain B — đang xây):**
| Bảng | Module | Trạng thái | Cột chính |
|---|---|---|---|
| `san_pham` | P1 | ✅ | id, ma, ten, dong, thong_so(JSON kv), tieu_chuan, huong_dan, anh, active, created_at |
| `claim_cam` | P1 | ✅ | id, cum_tu, ly_do, muc_do(CANH_BAO/CHAN), active, created_at |
| `pillars` | P2 | ✅ | id, ten, objective, point_of_difference, request, ty_trong(REAL %), thu_tu, active, created_at |
| `content_strategy` | P2 | ✅ | id=1 singleton: okr, big_idea, purpose, audience, swot, updated_at |
| `content_items` | P3 | ✅ | XEM §5.P3 — trung tâm, 2 loại (ECOM/SOCIAL) |
| `content_stages` / status | P3 | ✅ | dùng cột `content_items.trang_thai` (7 giai đoạn), không tách bảng |
| `air_posts` | P7 | ✅ | + UNIQUE `ma_theo_doi` → 1 mã = 1 bài |
| `don_cho_gan` | P8 | ✅ | hàng đợi gán tay, KHÔNG chia đều |
| `footage`, `shot_list` | P5 | ✅ | kho footage tái sử dụng + cảnh bám kịch bản |
| `bai_hoc` | P10 | ✅ | đề xuất máy rút, phải người duyệt |
| `frameworks` | P3/P4 | ✅ | 12 nhóm kịch bản thật (§7) |
| `kenh` | P3 | ✅ | kênh/shop đa thương hiệu (§7) |
| `content_strategy.brand_voice` | P4 | ✅ | cột trên bảng chiến lược (không tách bảng riêng) |
| `scripts`, `script_versions` | P4 | ✅ | AI output có version/rollback |
| `approvals` | P6 | ✅ | doi_tuong, cong(NOI_DUNG/CLAIM), trang_thai, nguoi_gui/nguoi_duyet, ghi_chu |
| `ket_qua` | P8 | ✅ | chỉ số + mucTinCay(TRUC_TIEP/GIAN_TIEP/KHONG_QUY_DON) + nguồn |
| `muc_tieu_thang` | P2b/P3 | ⏳ | (tuỳ chọn) tỷ lệ mục tiêu theo tháng để so lệch |

`bootstrap(env,u)` trả tất cả các mảng trên (đọc chung cho mọi vai trò; ghi thì gác quyền). Endpoint mutation luôn `return json({db: await bootstrap(env,me)})`.

---

## 5. LỘ TRÌNH MODULE (P0–P10) — trạng thái & spec

**Trạng thái:** ✅ xong · 🔨 đang làm · ⏳ chưa · ◐ một phần

### ✅ Domain A — Seeding & Quay công trình (ĐÃ CHẠY)
POST/CMT seeding, Quay công trình (3 mức chất lượng/source: Tạm ổn 5k/Chuẩn 10k/Đẹp 15k), Thư viện (group/chủ đề/CMT/ảnh), Lịch đăng xoay vòng (T3/5/7/CN), Nghiệm thu, Chống trùng nội dung–nhóm (P1 seeding), Bảng lương, Vinh danh Top 3. **Giữ nguyên.**

### ◐ P0 — Khung + 6 vai trò + `can()`
Có 3 vai trò + KY_THUAT. ⏳ Còn: `can()` tập trung + 3 vai trò còn lại + sidebar theo quyền. Làm khi P3/P6/P9 cần.

**⚠️ QUY ƯỚC TAB CẤU HÌNH (BẮT BUỘC GIỮ — user yêu cầu):** mỗi module có **tab con ⚙️ Cấu hình** để Admin/Marketing đổi ngưỡng **mà không cần sửa code + deploy**.
- Bảng `module_config (id, cau_hinh JSON, updated_at, updated_by_name)`; `CONFIG_MAC_DINH` là nguồn sự thật khi chưa ai cấu hình; `docCauHinh()` merge mặc định + đã lưu.
- Quyền: `canCauHinh(u)` = ADMIN || MARKETING. Kỹ thuật/Sales **không** sửa được. Mọi thay đổi **ghi audit**.
- **Thêm cấu hình cho module mới = khai báo 1 mục trong `CONFIG_SCHEMA` (frontend) + `CONFIG_MAC_DINH` (worker)** — `ModuleShell` + `CauHinhModule` render tự động, không phải viết UI.
- Đang cấu hình được: `air.checklist` · `trend.checklist` · `viec_ket` (5 ngưỡng ngày) · `dash.min_mau`/`lech_pillar` · `hoc.min_mau` · `lich.timeout_phut`/`max_lan_thu`.
- **Chặn cấu hình vô lý ở backend:** số ngoài 0–3650 → 422; checklist rỗng / trùng mã / thiếu mã / **không còn mục bắt buộc nào** → 422 (giữ tính nghiêm của checklist).
- Có nút **Khôi phục mặc định** cho từng module. (21 test)

**⚠️ QUY ƯỚC MENU (BẮT BUỘC GIỮ — user yêu cầu, tránh dàn trải):** menu **2 cấp** qua `NAV_GROUPS` (KHÔNG dùng `NAV` phẳng nữa). Đúng **5 nhóm lớn dùng chung toàn app**: `Content` (✍️) · `Seeding` (💬) · `Quay CT` (🎬) · `Ngân sách` (💰) · `Hệ thống` (⚙️). **Mọi module mới phải nằm trong 1 trong 5 nhóm này** — không thêm mục cấp 1 mới. Module Content OS (P1–P10) vào nhóm **Content**.
- Desktop: sidebar nhóm có tiêu đề nhỏ + danh sách module con.
- Mobile: bottom bar **chỉ 5 nhóm, chia đều `flex-1`, KHÔNG cuộn ngang**; module con hiện ở **hàng tab phụ** trong header (tự ẩn khi nhóm chỉ có 1 module).
- Nhóm rỗng sau khi lọc `BETA_KEYS` sẽ tự biến mất; badge nhóm = tổng badge module con.

### ✅ P1 — Dữ liệu nền: Sản phẩm + Claim cấm
- Bảng: `san_pham`, `claim_cam`. Quyền: `canBaseData`.
- Endpoints: `POST/PATCH/DELETE /sanpham`, `POST/PATCH/DELETE /claimcam`.
- UI: `ProductClaimManager` (nav `products`) — 2 tab, editor thông số key-value, upload ảnh, import/export CSV sản phẩm. Nav cho MARKETING/ADMIN/KY_THUAT.
- Tiện ích: `scanClaims(text, claims)` (dùng lại ở P4).
- **Dùng cho:** guardrail claim ở P4 (AI chỉ trích thong_so; chặn nếu chạm CHAN).

### ✅ P2 — Chiến lược & Pillar
- Bảng: `pillars` (seed 4 THẬT: Branding 50/Information 30/Problems 15/Interaction 5), `content_strategy` (OKR/BigIdea/Purpose thật). Quyền: `isStaff`.
- Endpoints: `POST/PATCH/DELETE /pillars`, `PATCH /strategy`.
- UI: `StrategyPillar` (nav `strategy`) — sửa định hướng + quản pillar + thanh phân bổ % + badge tổng %.
- **Dùng cho:** cảnh báo lệch tỷ lệ ở P3 (so % kế hoạch với ty_trong pillar, lệch >15% → banner).

### ◐ P3 — Kế hoạch & lịch (THỐNG NHẤT ecom + social) — **module lớn nhất, thay 2 file Excel**
**Lát cắt (1) ✅ ĐÃ LÀM & DEPLOY:** bảng `content_items`, `frameworks` (seed 12 nhóm kịch bản thật), `kenh` (seed 10 kênh thật). content_item có: loai(ECOM/SOCIAL), tieu_de, loai_muc_tieu(4 KPI), pillar_id, framework_id, san_pham_id, kenh_id, thang, trang_thai(7 giai đoạn PIPELINE), pic/chi_tiet/links(JSON), created_by. Endpoints: `POST/PATCH/DELETE /content` + `POST /content/import` + CRUD `/frameworks` `/kenh` (isStaff). UI `ContentPlan` (nav `plan`, MKT/ADMIN): **Kanban 7 cột + Danh sách**, lọc (loại/kênh/pillar/tháng), tạo/sửa (bắt buộc pillar+framework+kênh+mục tiêu), chuyển giai đoạn, **cảnh báo lệch tỷ lệ pillar >15%** (khi ≥5 mục), **Import CSV/paste**. Helper `insertContentItem`.
**Lát cắt (2a) ✅:** **Calendar** (agenda theo ngày, mobile-first) — dùng `chi_tiet.ngay_dang`; **PIC theo từng khâu** (pic.ke_hoach/brief/quay/dung/dang/tracking — nền Trụ A); form mobile 1-cột. 3 view: Kanban/Danh sách/Lịch.
**Lát cắt (2b) ✅ ĐÃ LÀM & DEPLOY:** import trực tiếp `.xlsx/.xls` bằng SheetJS (CDN). `ContentImportModal`: chọn **sheet** · tự **dò dòng tiêu đề** (max ô có dữ liệu trong 15 dòng đầu, cho override) · **auto-map cột→trường** theo từ khoá ưu tiên, không trùng cột (`impAutoMap`), cho chỉnh tay từng cột · **mặc định cả lần import** (Loại/Mục tiêu/Kênh/Tháng) · ngày→YYYY-MM (`impToMonth`) · khớp tên Pillar/Framework/Kênh/Sản phẩm→id (đúng rồi gần). Giữ luồng `.csv`/dán tay. Test: 8/8 (test_import.mjs) — verified trên 2 file thật (ECOM header idx 2/52 cột; Social per-kênh header idx 1). Còn ⏳: đẩy "Chờ duyệt" sang P6.
Thiết kế `content_items` bao cả 2 loại:
- **Chung:** id, loai(ECOM|SOCIAL), tieu_de, pillar_id, framework_id, san_pham_id, kenh_id, **nguoi_phu_trach theo từng khâu** (PIC), trang_thai, thang(YYYY-MM), created_at, created_by. (4 chiều bắt buộc: pillar+loaiMucTieu, campaign, sanpham, framework+hook — KHÔNG cho lưu nếu thiếu.)
- **ECOM (từ file 1):** 6 giai đoạn GĐ1 Kế hoạch → GĐ2 Brief → GĐ3 Quay → GĐ4 Dựng → GĐ5 Air → GĐ6 Tracking; các trường: loai_video, concept, link_kich_ban, PIC brief/quay/dựng/đăng/tracking, ngày quay/đăng, link final, link air, reup Shopee, ghi chú.
- **SOCIAL (từ file 2):** lich_dang, content_pillar, format, content_angle, noi_dung, brief_thiet_ke, link_final, link_post.
- **Views:** Kanban (6 cột ecom / trạng thái social) kéo-thả + Calendar tháng.
- **Import cả 2 file .xlsx** làm dữ liệu khởi tạo (139 video ecom + ~lịch social đa kênh).
- **Cảnh báo lệch tỷ lệ** so với pillar (P2).
- **Lát cắt:** (1) schema + import + list/Kanban → (2) calendar + cảnh báo lệch → (3) đẩy "Chờ duyệt" sang P6.
- Thêm bảng phụ: `frameworks` (seed 12 nhóm kịch bản §7), `kenh` (seed kênh §7).

### ◐ P4 — Creative Studio — **thay chatbot rời**
**Lát cắt (1) ✅ ĐÃ LÀM & DEPLOY (rule-based, chưa cần API key):** bảng `scripts` (content_item_id, framework_id, san_pham_id, kenh_id, tieu_de, hook, sections[JSON], cta, brand_voice, claim_flags[JSON], trang_thai, version) + `script_versions` (snapshot mỗi lần lưu) + cột `content_strategy.brand_voice`. Endpoints `POST/PATCH/DELETE /scripts` + `GET /scripts/:id/versions` (staff-only; Sales không thấy `scripts` trong bootstrap). **Guardrail claim ở BACKEND** (`scanScriptClaims` quét toàn văn qua `scriptText`): mức `CHAN` → **422, không lưu**; `CANH_BAO` → lưu nhưng ghi `claim_flags`. UI `CreativeStudio` (nav `studio`, MKT/ADMIN, dev preview): danh sách thẻ + trình soạn (hook / các phần / CTA sửa tay), **`generateScript` rule-based cho cả 12 framework thật** — chỉ chèn `thong_so`/`tieu_chuan`/`huong_dan` THẬT của sản phẩm, thiếu dữ liệu thì để `[điền …]`, **không tự sinh số liệu**; cảnh báo claim hiện ngay khi gõ + khoá nút Lưu khi còn cụm CHẶN; xem lịch sử phiên bản. Test: 16/16 integration + 6/6 kiểm tra bộ sinh.
**Lát cắt (2) ⏳ (chờ `ANTHROPIC_API_KEY`):** thay/bổ sung bộ sinh bằng gọi Anthropic từ Worker; Hook Optimizer 5 variant + lý do (**KHÔNG dự đoán %view**). Giữ nguyên guardrail claim + nguyên tắc không bịa số liệu. Fallback về rule-based khi thiếu key.

### ✅ P5 — Kho footage & shot list (mobile-first, R2)
Bảng `footage` (tái sử dụng nhiều kịch bản; tags, sản phẩm, địa điểm, người quay) + `shot_list` (cảnh bám kịch bản).
- `POST /shotlist/from-script/:id` sinh cảnh từ kịch bản: **hook → từng phần thân → CTA**. Đã có cảnh → 409 (không nhân đôi); kịch bản rỗng → 400.
- Gắn footage vào cảnh → tự `DA_QUAY`; gỡ → `CHUA_QUAY`. **Xoá footage sẽ tự gỡ liên kết ở mọi cảnh** (không để cảnh trỏ vào file đã mất) + xoá object R2.
- UI `FootageLib` (nav `footage`): lưới xem trước ảnh/video, tìm theo tên/mô tả/thẻ, lọc theo thẻ; tab `ShotListTab` gắn footage cho từng cảnh, đếm tiến độ. Test **22/22**.
### ◐ P6 — Hàng đợi duyệt (2 cổng song song: nội dung / claim)
**Lát cắt (1) ✅ ĐÃ LÀM & DEPLOY:** bảng `approvals` (doi_tuong SCRIPT|CONTENT, doi_tuong_id, **cong** NOI_DUNG|CLAIM, trang_thai CHO|DAT|TRA_LAI|HUY, nguoi_gui, nguoi_duyet, ghi_chu) + cột `so_lan_tra` cho `scripts`/`content_items` (**chỉ số Process cho P9**).
- Endpoints: `POST /approvals/submit` (mở đúng 2 cổng; **chặn gửi nếu còn cụm claim CHAN** → 422; đang chờ mà gửi lại → 409; gửi lại sau khi bị trả thì **reset** 2 cổng chứ không cộng dồn) · `POST /approvals/:id/decide`.
- Quy tắc: **CẢ HAI cổng Đạt** → đối tượng `DUYET`. **Một cổng trả lại** → đối tượng về `NHAP`, `so_lan_tra+1`, **cổng còn lại tự HUỶ**. Trả lại **bắt buộc nêu lý do** (400 nếu thiếu). Quyết lại cổng đã quyết → 409.
- Phân quyền qua `canDecideGate(u,cong)` (worker) ⟷ `canDecideGateFE(me,cong)` (FE), khớp nhau: **NOI_DUNG = Marketing**, **CLAIM = Kỹ thuật**, Admin cả hai, Sales không cổng nào. Kỹ thuật được thấy `approvals`+`scripts` trong bootstrap để duyệt claim; **Sales không thấy gì**.
- UI: `ApprovalQueue` (nav `approve`, tab "Việc của tôi" / "Tất cả", badge chỉ đếm việc thuộc cổng của chính mình) + `ApprovalStatus` nhúng trong trình soạn kịch bản (nút Gửi duyệt + trạng thái 2 cổng + lý do bị trả). Cổng CLAIM hiện sẵn **kết quả rà claim** để Kỹ thuật quyết nhanh.
- Test: **22/22** integration.
**⏳ Còn:** vai trò `TRUONG_MKT` riêng (hiện dùng MARKETING) — chỉ cần thêm 1 nhánh vào `canDecideGate`/`canDecideGateFE`; đẩy nút "Gửi duyệt" vào cả màn Kế hoạch nội dung (P3).
### ✅ P7 — Đăng & checklist (KHÔNG auto-post) + khoá mã đơn/voucher (khoá cho P8)
Bảng `air_posts` + **UNIQUE index `idx_air_ma` trên `ma_theo_doi`** (partial, bỏ qua rỗng) — **1 mã = 1 bài**, đây chính là cơ chế chặn tình huống "1 voucher nhiều video" khiến P8 không quy đơn được (§9).
- `AIR_CHECKLIST` (8 mục, 5 bắt buộc) định nghĩa ở worker và **trả qua bootstrap** (`db.air_checklist`) → FE không hard-code; có bản dự phòng `AIR_CHECKLIST_FE` khớp y hệt.
- Endpoints: `POST /air` (**chỉ nhận nguồn `trang_thai==='DUYET'`** → 409 nếu chưa qua 2 cổng; trùng mã → 409) · `PATCH /air/:id` (đổi sang mã đã dùng → 409) · `POST /air/:id/publish` (thiếu checklist bắt buộc → **422 + trả `thieu[]`**; thiếu link → 400; **thiếu mã theo dõi → 400**; đăng lại → 409) · `DELETE /air/:id`.
- UI `AirPosts` (nav `air`): 2 tab Đang chuẩn bị / Đã đăng, chọn nội dung ĐÃ DUYỆT để đưa vào đăng (ẩn cái đã có bài), `AirEditor` có checklist tick + mã theo dõi + link; **đã đăng thì khoá sửa** để giữ nguyên dữ liệu quy đơn.
- Test: **21/21**.

### ✅ Công cụ Lọc & dựng video (gắn vào Creative Studio)
Công cụ `tools/loc-video.html` — **bản v4.0** (user cung cấp, 415 KB) — chạy **cục bộ trên máy**: File System Access API gán video theo folder, chấm chất lượng source, gom take trùng & chọn bản tốt nhất, **dựng/kết xuất video**, và **"Dạy AI — càng dùng càng khôn"** (AI tự học mỗi khi người dùng sửa tay). AI chạy trong trình duyệt (Whisper ASR + CLIP qua WebGPU, model tải từ CDN jsdelivr); tuỳ chọn Ollama/Gemini bằng key của chính người dùng.
- **Cách gắn:** phục vụ tĩnh tại `/tools/loc-video.html`, Creative Studio có **tab "🎬 Lọc & dựng video"** nhúng iframe + nút *Toàn màn hình* / *Mở tab mới*. **KHÔNG nhúng thẳng vào `seeding-app.html`** vì file 415 KB sẽ phình bộ mã và CSS riêng của nó xung đột với Tailwind.
- **⚠️ ffmpeg PHẢI cùng origin:** công cụ nạp `FF_UMD = "vendor/ffmpeg/ffmpeg.js"` (đường dẫn **tương đối** → `/tools/vendor/ffmpeg/ffmpeg.js`), và bản UMD tự tạo worker từ **`814.ffmpeg.js` nằm cạnh nó**. Đã vendor sẵn 2 file từ `@ffmpeg/ffmpeg@0.12.15` vào `tools/vendor/ffmpeg/`. **Thiếu 2 file này là mất tính năng dựng video.** (Core wasm vẫn lấy từ CDN `@ffmpeg/core@0.12.10` — bản 1 luồng nên KHÔNG cần header COOP/COEP.)
- Route công khai `GET /api/nhac` → `[]` (công cụ hỏi folder nhạc cục bộ; bản web không có nên trả rỗng thay vì 401/404). Đặt **trước cổng đăng nhập** vì iframe không gửi token; không lộ dữ liệu gì.
- ⚠️ Cần Chrome/Edge desktop mới chọn được folder; nếu iframe chặn thì dùng **Mở tab mới**.
- Test: **13/13** (phục vụ file, đúng bản v4.0, ffmpeg vendor cùng origin + đúng global `FFmpegWASM`, `/api/nhac`, app chính không ảnh hưởng).
### ✅ P8 — Nhập kết quả (3 mức tin cậy)
Bảng `ket_qua` + `don_cho_gan`. Hằng số `MUC_TIN_CAY` / `NGUON_MUC_MAC_DINH` (TikTok Shop→TRUC_TIEP, Shopee→GIAN_TIEP).
- **Ranh giới:** mức `KHONG_QUY_DON` **không được gắn doanh thu/số đơn** → 422. Chỉ ghi view/tương tác/click.
- `POST /ketqua/import`: **chỉ quy đơn khi mã khớp ĐÚNG 1 bài**. Không mã / không khớp / khớp nhiều bài → `don_cho_gan` kèm lý do. **KHÔNG chia đều** (§9).
- Gán tay (`/donchogan/:id/assign`) luôn ghi mức **GIAN_TIEP** và chỉ 1 bài. `/skip` để bỏ qua.
- UI `KetQua`: 3 thẻ mức tin cậy **tách bạch** + banner cảnh báo không cộng dồn, tab hàng đợi gán tay, import đối soát. Test **25/25**.
### ✅ P9 — Dashboard 4 hệ KPI + hiệu suất người
`ContentDashboard` (nav `cdash`) — **tính hoàn toàn ở frontend từ bootstrap**, không thêm bảng, không suy đoán.
- 4 hệ KPI đo riêng, mỗi hệ 3 cột tin cậy tách bạch. **Không có phép cộng nào giữa 3 mức** (đã có test chặn hồi quy).
- Ô trống ghi rõ "chưa có dữ liệu" (≠ 0); cảnh báo số bài **chưa gắn hệ mục tiêu**.
- Hiệu suất người tách **Process** (kịch bản, qua duyệt lần 1, số lần bị trả, bài có cảnh báo claim) khỏi **Outcome** (3 mức tin cậy).
- `MIN_MAU = 5`: dưới ngưỡng **không tính %**, gắn nhãn "chưa đủ mẫu". Kỹ thuật đo bằng **số claim chặn được**. Test **9/9** ràng buộc số liệu.
- ⏳ Vai trò `GIAM_DOC` riêng chưa thêm (hiện Admin/Marketing xem được).
### ✅ P10 — Thư viện học + vòng lặp tự học
Bảng `bai_hoc` (loai, tieu_de, noi_dung, bang_chung JSON, so_mau, nguon_tu_dong, trang_thai DE_XUAT/DA_DUYET/TU_CHOI).
- `POST /baihoc/quet` rút đề xuất **từ dữ liệu thật**: (1) framework có **≥ `MIN_MAU_BANG_CHUNG` (5)** bài đã đo → tổng hợp doanh thu/đơn/view kèm câu ghi rõ *"số ĐÃ XẢY RA, không phải dự đoán"*; (2) lý do Kỹ thuật trả lại **lặp ≥2 lần** → đề xuất bổ sung claim cấm. **Dưới ngưỡng thì im lặng**, không kết luận. Quét lại không tạo trùng.
- **NGƯỜI QUYẾT:** `/baihoc/:id/decide` — đề xuất **không tự thành quy tắc**; từ chối bắt buộc nêu lý do; quyết lại → 409.
- **Vòng lặp khép kín:** bài học `DA_DUYET` hiện lại trong **Creative Studio** khi soạn (lọc theo framework đang chọn), kèm nhắc "không phải dự đoán bài này sẽ chạy tốt".
- UI `ThuVienHoc` (nav `hoc`): 3 tab theo trạng thái, nút Quét dữ liệu, ghi bài học tay. Test **19/19**.

---

## 6. 9 TRỤ GIÁ TRỊ VƯỢT TRỘI (đừng đánh mất)
1. Một nguồn sự thật (bootstrap) · 2. Vòng lặp khép kín (Chiến lược→…→Học) · 3. AI in-context có guardrail claim · 4. Đo lường trung thực 3 mức tin cậy · 5. Phân quyền + 2 cổng duyệt + audit · 6. Tự động hoá (lịch xoay vòng, chống trùng, cron, tính tiền) · 7. Mobile hiện trường · 8. Tài sản tích luỹ.
9a. **Đo hiệu suất 2 trục — NỘI DUNG × NGƯỜI** (P9): nội dung theo 4 hệ KPI; người tách **Process** (đúng hạn %, qua duyệt lần 1 %, số lần bị trả, claim đỏ tự bắt) vs **Outcome** (kết quả, 3 mức tin cậy). Công bằng: Process≠Outcome, chỉ xếp hạng khi đủ mẫu, đo cả Kỹ thuật (claim chặn được).
9b. **Vòng lặp AI tự học** (P10→P4): kho bằng chứng framework×hook×mục tiêu (≥5 mẫu) → RAG vào Studio → explore/exploit → học ClaimCam/BrandVoice từ vận hành (người duyệt) → cảnh báo suy giảm. **Ranh giới:** không dự đoán viral bằng AI; quy tắc mới phải người duyệt.

---

## 7. HAI FILE EXCEL CẦN THAY (đã phân tích) + DỮ LIỆU THẬT SEED ĐƯỢC
### File 1 — "QUẢN LÝ SẢN XUẤT NỘI DUNG ECOM 2026.xlsx" (pipeline ecom)
- Sheet 00 Kế hoạch tháng (phân bổ 155 video/kênh×cấu trúc) → P2/P3
- Sheet 02 Quản lý nội dung (51 cột · 6 giai đoạn GĐ1→GĐ6 · PIC mỗi khâu · tracking GMV/đơn/views…) → **P3 ECOM + P8**
- Sheet 01 Đo lường + Sheet 03 Dashboard → P8/P9
- ~139 video/tháng.

### File 2 — "Kế hoạch nội dung Social.xlsx" (editorial calendar đa kênh, 37 sheet)
- KINGSMEN CONTENT PLAN / TRỤ CỘT NỘI DUNG (OKR/BigIdea/Purpose + pillar %) → **P2 (ĐÃ seed)**
- ~15 lịch kênh (Fanpage/TikTok/YT Short/Zalo/Shopee × Kingsmen/VKXD/Terrazy/ColorMatch): Lịch đăng·Content Pillar·Format·Content Angle·Nội dung·Brief thiết kế·Link Final·Link post → **P3 SOCIAL**
- SEEDING PLAN, Group FB Thầu thợ → Domain A. Audience/SWOT → P2. HÌNH ẢNH → Thư viện ảnh.

### DỮ LIỆU THẬT (seed thẳng, KHÔNG cần file json ngoài):
- **Pillar (đã seed):** Branding 50 · Information 30 · Problems 15 · Interaction 5.
- **Sản phẩm (dòng):** Finex · Terrazy · Keo Ron (+ Kingsmen grout, ColorMatch, FINEX, Sàn tự phẳng…).
- **12 nhóm kịch bản = frameworks (seed ở P3/P4):** PAS · Phản biện comment · Test chất lượng · Hành trình thi công · Size/Combo · Chuẩn bán hàng · FOMO · Review KOC · "đừng..." Trend · Q&A khách hàng · So sánh kinh tế · Hướng dẫn thi công.
- **Kênh/Shop:** BC-Vật liệu hoàn thiện · CHÍNH-Finex · AFF-Sơn sàn hiệu ứng · Vua keo xây dựng (+ các trang social ở file 2).
- **Pipeline ecom (6 GĐ):** ⚪ Mới lên kế hoạch → ✍️ Brief → 🛠 Sản xuất → 🎬 Chờ air → ✅ Đã air (+ Tracking).

---

## 8. CẦN USER CUNG CẤP (chặn các mốc)
- ⏳ `ANTHROPIC_API_KEY` (Cloudflare secret) — cho **P4** Creative Studio.
- ⏳ Baseline KPI 3 tháng thật — cho ngưỡng đạt/không đạt ở **P9** (nếu chưa có → để trống, ghi "chưa có baseline").
- (Không còn cần `pillars.json`/`frameworks.json` riêng — đã có trong 2 file Excel.)

## 9. RÀNG BUỘC ĐÃ BIẾT (đừng hứa quá)
- **Auto-post: TUỲ NỀN TẢNG** (cập nhật — user yêu cầu nâng cấp). `KENH_TU_DONG` khai báo rõ: Facebook Page / YouTube / Zalo OA **đăng tự động được** (cần token + app review); **TikTok = false** vì chưa qua audit thì bài ra SELF_ONLY → auto-post vô nghĩa; Shopee/Website = đăng tay.
  - **Token KHÔNG lưu D1** (không mã hoá, rò rỉ = mất quyền đăng Page thật) → đọc từ **secret Worker** theo quy ước `TOKEN_<api_ma>` qua `layToken()`.
  - Cron `*/15 * * * *` chạy `chayLichDang()`. **Handler `scheduled` PHẢI tách theo `controller.cron`** — nếu không, việc hằng ngày (dọn media, ghi nhật ký) sẽ chạy mỗi 15 phút và làm rác nhật ký.
  - Trạng thái: `CHUAN_BI → DA_LEN_LICH → (DA_DANG | LOI | DEN_GIO)`. **Không tự động được hoặc lỗi → `DEN_GIO`, KHÔNG BAO GIỜ tự đánh dấu đã đăng.** Thử tối đa `MAX_LAN_THU=3` rồi chuyển đăng tay. Bài `DEN_GIO`/`LOI` vào nhắc việc.
  - Bật tự động bị **chặn ngay lúc lên lịch** nếu kênh chưa đủ điều kiện (422 kèm lý do) — không để đến giờ mới vỡ. **Đăng tự động vẫn phải xong checklist**, không có ngoại lệ.
  - UI: `KenhManager` (nav `kenh`, nhóm Hệ thống) cấu hình kênh; `LichDangBox` trong trình soạn bài đăng. (21 test, gồm cả đường thất bại)

**✅ ĐĂNG QUA n8n (cách user chọn) — giải được TikTok.** `kenh.cach_dang = 'API' | 'N8N'`.
- ⚠️ **ĐÍNH CHÍNH (từng ghi sai):** n8n **tự host KHÔNG phải partner được TikTok cấp quyền** — nó vẫn gọi API bằng credential của chính bạn nên **vẫn vướng audit**. Bên lách được là Buffer/Publer/Later (partner đã đăng ký). **n8n + TikTok = vẫn cần audit**, trừ khi cho n8n gọi tiếp sang API của một dịch vụ partner. Facebook/YouTube/Zalo qua n8n thì chạy tốt thật.
- Khi `cach_dang='N8N'`, bỏ qua bảng `KENH_TU_DONG` (n8n tự lo phần nền tảng).
- Secret: `N8N_WEBHOOK_URL`, `N8N_TOKEN`, `APP_BASE_URL`. App POST payload (air_post_id, kenh, tieu_de, caption, **media_url**, ma_theo_doi, **callback_url**) kèm header `X-App-Token`.
- **Hai chế độ trả kết quả:** workflow ngắn trả thẳng `{ok,link}` trong response → chốt luôn; workflow dài (upload video) → app đặt `DANG_GUI`, n8n gọi `POST /api/air/:id/n8n-callback` (header `X-N8N-Token`, **công khai nhưng bắt buộc token**, không có `N8N_TOKEN` thì 503 chứ không mở toang).
- **Chống treo:** `DANG_GUI` quá `N8N_TIMEOUT_PHUT=60` → cron chuyển `DEN_GIO` kèm lý do. n8n sập / HTTP lỗi → `LOI`, **không bao giờ tự đánh dấu đã đăng**.
- Thêm `air_posts.media_url` (**bắt buộc để đăng thật** — trước đó thiếu, n8n không có gì để đăng); chọn từ Kho footage hoặc dán link.
- UI `HuongDanN8N` in sẵn payload mẫu + lệnh cắm secret + mẫu node callback để khỏi đoán. (21 test)
- **✅ SINH SẴN WORKFLOW n8n** (`n8nWorkflow()`): tải file .json hoặc copy → n8n **Import from File**/Ctrl+V. Khung dựng sẵn: Webhook → Code (kiểm `X-App-Token` + làm phẳng dữ liệu) → Respond ngay → Switch **rẽ theo đúng các loại kênh user đang có** → chỗ cắm node đăng (NoOp) → HTTP callback kèm `X-N8N-Token`. Kèm **Sticky Note hướng dẫn 3 bước ngay trong workflow**. Token nhúng sẵn nếu user nhập.
- **✅ AI DỰNG WORKFLOW** (`POST /n8n/sinh-workflow`, cần `ANTHROPIC_API_KEY`): mô tả nhu cầu → Claude sinh workflow. **`kiemTraWorkflow()` bắt buộc thẩm định trước khi trả**: mọi liên kết phải trỏ node có thật, không trùng tên, có node Webhook, có gọi `callback_url`. Không đạt → trả `ok:false` kèm lý do và **frontend tự rơi về bản dựng sẵn**, không bao giờ đưa file hỏng cho user. Gỡ được cả ```json fence. (12 test gồm mọi đường hỏng)
- **Bộ dựng sẵn nay dùng NODE THẬT:** `n8n-nodes-base.facebookGraphApi` (đã map `caption`/`object_id`) và `n8n-nodes-base.youTube` — import xong chỉ gắn credential. Nền tảng không có node sẵn (TikTok, Zalo OA) → `httpRequest` đặt tên rõ "(điền endpoint)". Không còn NoOp rỗng.
- **⚠️ `download()` chèn BOM** — hợp cho CSV (Excel đọc UTF-8) nhưng **JSON có BOM là n8n import hỏng**. Đã sửa: chỉ thêm BOM khi mime là csv/text-plain. (12 kiểm tra bộ sinh)

**⚠️ Bẫy đã dính khi làm, đừng lặp lại:**
- Route đặt **trước** `let m` → TDZ `Cannot access 'm'`. Dùng biến riêng cho match ở vùng chưa đăng nhập.
- `const body = await request.json()` chạy **trước** vùng route công khai → đọc `request.json()` lần nữa ra rỗng, hiểu nhầm thành thất bại. Dùng lại `body`.
- Không scrape Creative Center / không đọc nội dung từ link Facebook (ToS).
- Đo lường: chỉ API kênh sở hữu + nhập tay; 3 mức tin cậy, KHÔNG cộng dồn thành "doanh thu từ content".
- Đơn Shopee mơ hồ (1 voucher nhiều video) → hàng đợi gán tay, KHÔNG chia đều.

## 10. THƯƠNG HIỆU (UI)
Tokens Tailwind (inline config trong `seeding-app.html`): `ink #0b3543` (soft #114654, muted #5c7480), `brand #0a92b4` (dark #0a6a80, light #7fd4e4, bg #eafafd), `line #dbe6e9`. Font: **Montserrat** (display) + **Maven Pro** (body). Không dùng gold.

---

## 11. CHANGELOG (ghi mỗi lần deploy)
- `88dd874` — P1: Sản phẩm & Claim cấm + vai trò KY_THUAT (10 test).
- `719852e` — P2: Chiến lược & Pillar (seed pillar thật) (11 test).
- P3 lát cắt (1) — content_items + frameworks(12)/kenh(10) + CRUD/import + List/Kanban 7 cột + cảnh báo lệch pillar (13 test).
- DEV PREVIEW — cờ `is_dev` + BETA_KEYS ẩn module nâng cấp khỏi user thường + seed `dev@masfico.vn`; Kanban mobile horizontal-scroll (7 test). **Ưu tiên mobile-first cho mọi màn Content OS từ đây.**
- Mobile: thanh menu dưới cuộn ngang 1 dòng (nhãn ngắn + tự cuộn mục mở).
- P3 lát cắt (2a) — Calendar (agenda) + PIC theo khâu + form mobile 1-cột (4 test).
- `310a499` — P3 lát cắt (2b): import .xlsx trực tiếp (SheetJS) — sheet picker + dò dòng tiêu đề + auto-map cột + mặc định lần import + khớp tên→id (8 test, verified 2 file thật).
- `67fd596` — **P4 Creative Studio**: bảng `scripts`+`script_versions`, cột `content_strategy.brand_voice`; CRUD `/scripts` + `GET /scripts/:id/versions` (staff-only); **guardrail claim** (CHẶN→422 không lưu, Cảnh báo→lưu + ghi `claim_flags`); version tăng + snapshot mỗi lần lưu. UI: danh sách + trình soạn, **sinh nháp rule-based theo 12 framework thật** chỉ chèn dữ kiện thật của sản phẩm, thiếu thì để `[điền …]` (16 test + 6 kiểm tra bộ sinh).
- **MENU 2 CẤP** — gom toàn app vào **5 nhóm lớn**: `Content` · `Seeding` · `Quay CT` · `Ngân sách` · `Hệ thống` (`NAV_GROUPS` thay `NAV`). Desktop: sidebar có tiêu đề nhóm. Mobile: **bottom bar chỉ 5 nhóm chia đều, KHÔNG cuộn ngang** + hàng **tab phụ** cho module con (ẩn khi nhóm chỉ 1 module) (16 kiểm tra cấu trúc nav).
- **P6 Hàng đợi duyệt 2 cổng** — bảng `approvals` + `so_lan_tra`; cả 2 cổng Đạt mới duyệt, 1 cổng trả lại thì về Nháp + huỷ cổng kia; chặn gửi duyệt khi còn claim CHAN; phân quyền cổng khớp FE↔BE (22 test).
- (Trước đó, Domain A: seeding/quay/lịch/thư viện ảnh/vinh danh/chống trùng… đã deploy.)
- **P7 Đăng & checklist** — bảng `air_posts` + UNIQUE mã theo dõi (1 mã = 1 bài); chỉ đăng nội dung đã duyệt; checklist bắt buộc + link + mã mới cho đánh dấu Đã đăng; đã đăng thì khoá sửa (21 test).
- **Công cụ Lọc & dựng video v4.0** gắn vào Creative Studio dạng tab (phục vụ tĩnh `/tools/loc-video.html` + vendor ffmpeg cùng origin + route công khai `/api/nhac`) (13 test).
- **Nhắc việc** — `tinhViecKet()` tính TRỰC TIẾP trong bootstrap (luôn tươi, không lệch); cron hằng ngày chỉ ghi nhật ký. 5 nhóm: kịch bản bị trả chưa sửa (>3n) · cổng duyệt tồn (>2n) · bài đăng chưa nhập kết quả (>14n) · trend sắp/đã hết hạn (≤7n) · đơn chờ gán tay (>3n). Ngưỡng `NGUONG_KET` khớp FE↔BE, có test chặn lệch. UI: thẻ gấp gọn ở Dashboard, hết kẹt thì tự chuyển xanh (10 test).
- **Cầu nối Lọc video → Kho footage** — công cụ chạy cục bộ nên không tự đẩy được; thêm vùng **kéo-thả nhiều file** ngay dưới khung công cụ, gắn thẻ/sản phẩm/địa điểm **chung một lần cho cả lô**, dùng lại luồng upload R2 sẵn có, báo tiến độ từng file.
- ✅ **NỐI SEEDING ↔ CONTENT OS (việc 1 — ĐÃ XONG)** — cột `content_topics.content_item_id`; `POST /content/:id/day-seeding` **chỉ nhận nội dung ĐÃ DUYỆT 2 cổng** (409 nếu chưa), không tạo trùng (409). Nội dung bài lấy thẳng từ **kịch bản đã duyệt** (hook→thân→CTA) để Sales copy dùng ngay. Sales thấy nhãn **"✓ đã duyệt claim"** trên chủ đề → biết dùng nguyên văn là an toàn.
  **Chảy ngược:** `gomSeedingTheoNoiDung()` gom số bài / bài đạt / react / cmt về từng `content_item`; hiện ở cột **Seeding** trong Kế hoạch nội dung. **CHỦ Ý chỉ đếm, KHÔNG quy ra doanh thu** — seeding không quy đơn được (§9), có test chặn hồi quy. (18 test)
- ▶️ **Kế tiếp:** gỡ `BETA_KEYS` khi user duyệt xong; thêm `TRUONG_MKT`/`GIAM_DOC`; nâng P4 lên gợi ý AI khi có `ANTHROPIC_API_KEY`. Còn lại (giá trị thấp): `media_library` ↔ `footage`.
- **P8** Nhập kết quả 3 mức tin cậy (25 test) · **P5** Kho footage & shot list (22 test) · **P9** Dashboard 4 hệ KPI + hiệu suất người (9 test) · **P10** Thư viện học + vòng lặp tự học (19 test).
- ✅ **Hiện mật khẩu khi đăng nhập** — component dùng chung `PasswordInput` (nút 👁️ bên trong ô). **Mặc định vẫn ẨN**, chỉ hiện khi người dùng chủ động bấm; `type="button"` + `onMouseDown preventDefault` để không submit nhầm và không mất con trỏ đang gõ; giữ `autoComplete` đúng nên trình quản lý mật khẩu vẫn nhận ô. Áp cho **màn Đăng nhập** (mọi tài khoản, mọi vai trò) và **ô đổi mật khẩu trong Hồ sơ**. Ô mật khẩu trong form Admin tạo/sửa người dùng **cố ý để nguyên dạng hiện** — admin cần đọc lại mật khẩu vừa đặt để bàn giao. (12 test)
- ✅ **MÁY TỰ GOM TREND** (`POST /trends/ingest`) — mắt xích cuối để tự động hoá module Trend.
  - Xác thực bằng `X-App-Token` = `N8N_TOKEN` (không dùng phiên đăng nhập — n8n không phải người). **Chưa cấu hình token → 503**, không bao giờ mở cửa không khoá.
  - **Chống trùng** theo link đã chuẩn hoá (bỏ `utm_*`/`fbclid`/`is_from_webapp`… và `www`) **và** theo tên đã chuẩn hoá, trong cửa sổ `chong_trung_ngay`. Nạp danh sách gần đây **một lần**, không truy vấn theo từng dòng.
  - **Lọc từ khoá ngành** (`tu_khoa_nganh`, khớp cả tên lẫn mô tả). **Rỗng = nhận tất cả** — cố ý không hard-code hộ, nhưng UI cảnh báo rõ là sẽ ngập rác.
  - Tự đặt `han_dung` = hôm nay + `han_mac_dinh_ngay` (mặc định 7) — trend nguội nhanh, để trống hạn thì cron hết hạn không có gì để bám.
  - **AI chấm ngay khi gom về** (`tu_dong_cham_ai`, mặc định bật). Thiếu key → trend nằm ở `MOI` và response nói rõ, **không báo là đã chấm**.
  - Ghi `nguoi_de_xuat='Máy tự gom'` + audit `máy gom trend` — không mạo danh người.
  - **Không có đường tắt:** ingest và nút bấm tay dùng chung `chamVaGhiTrend()`, nên ràng buộc tự duyệt (đủ mục bắt buộc + không rủi ro claim + bật công tắc) áp dụng y hệt cho luồng máy.
- ✅ **Dán link nhanh** (`DanLinkTrend`) — TikTok/Facebook **không có API trend công khai và cào là vi phạm ToS**, nên vẫn phải làm tay; rút form còn 2 ô (link + tên), tự đoán nguồn theo tên miền, tự đặt hạn.
- ✅ **Bộ dựng workflow n8n gom trend** (`n8nWorkflowTrend`) + bảng hướng dẫn `MayGomTrend` gấp gọn trong module. Chỉ dùng **Google Trends RSS VN** và **YouTube Data API (mostPopular, VN)** — nguồn công khai / API chính thức; **không có node nào đụng TikTok/Facebook**, có test chặn hồi quy. File Import về ở trạng thái **Active = false**.
  - **Ranh giới đã nói thẳng với user:** hai nguồn này chủ yếu ra trend đại chúng; trend ngành vật liệu vẫn cần người trong nghề nhìn ra. Tự động hoá cắt ~80% việc tay chân, không thay được phán đoán ngành.
- 📌 **Tổng test đang xanh: 536** (toàn bộ `scratchpad/test_*.mjs`), trong đó AI đánh giá trend 40.
- ✅ **ĐÃ XONG TOÀN BỘ P1→P10.** Còn lại là các mảnh nhỏ: vai trò `TRUONG_MKT`/`GIAM_DOC` riêng, `can()` tập trung (P0), và nâng P4 lên gợi ý AI khi có `ANTHROPIC_API_KEY`.

### ⚙️ Quy trình deploy (CẬP NHẬT)
`cp seeding-app.html dist/index.html` **và** `rm -rf dist/tools && mkdir -p dist/tools && cp -r tools/. dist/tools/` (giữ cả `tools/vendor/ffmpeg/`) → validate (`node --check worker/index.js` + Babel transform) → `rm -rf node_modules` → commit → push.
