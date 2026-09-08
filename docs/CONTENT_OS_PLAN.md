# KINGSMEN CONTENT & SEEDING OS — KẾ HOẠCH TRIỂN KHAI (bộ nhớ bền)

> **Đọc file này ĐẦU TIÊN mỗi phiên.** Đây là nguồn sự thật về mục tiêu, kiến trúc, tiến độ, và cách build/test/deploy. Cập nhật file này sau MỖI lát cắt hoàn thành (mục "Changelog" + đổi trạng thái module).
> Cập nhật lần cuối: **2026-09-08** — sau **P3 lát cắt 2a** (commit `a8a6024`). Nhánh `claude/cap-nhat-hien-trang-v38et4` đang **bằng `main`**.

---

## ⚡ HIỆN TRẠNG ĐÃ KIỂM (ảnh chụp — chạy thật, không phải mô tả)
Kiểm ngày 2026-09-08 trên đúng mã đang ở `main`:

| Hạng mục | Kết quả |
|---|---|
| `dist/index.html` vs `seeding-app.html` | ✅ **trùng khớp** (3.740 dòng) — không lệch bản deploy |
| `node --check worker/index.js` | ✅ hợp lệ (1.112 dòng) |
| Babel transform khối `app-src` (preset react) | ✅ **BABEL OK** (3.675 dòng JSX) |
| Bảng D1 tạo trong `migrate()` | ✅ **26 bảng** (19 Domain A + 7 Domain B) |
| Test tích hợp Worker (mô phỏng D1 bằng `node:sqlite`) | ✅ **16/16 đạt** |

**Seed thật khi dựng DB mới** (đếm từ `bootstrap`): `pillars` **4** · `frameworks` **12** · `kenh` **10** · `content_strategy` có OKR thật · tài khoản `mkt@kingsmen.vn` (MARKETING) + `dev@masfico.vn` (ADMIN, `is_dev=1`).

**16 test đã chạy:** đăng nhập · bootstrap · seed 4 pillar/12 framework/10 kênh/OKR · tạo–sửa–xoá `content_items` · PIC theo khâu lưu đúng · `chi_tiet.ngay_dang` (nguồn của Lịch) lưu đúng · chuyển giai đoạn · import bỏ dòng rỗng · tạo tài khoản SALES · **SALES bị chặn ghi content (403)** · SALES vẫn đọc được dữ liệu nền · chưa có khoá AI.

**⚠️ Lệch đã phát hiện & phải nhớ:** `san_pham` và `claim_cam` **đếm = 0 trên DB mới** — P1 chỉ giao *màn quản lý + endpoint*, **KHÔNG có seed dữ liệu thật**. §7 từng ghi "seed thẳng" là **sai thực tế**, đã sửa ở §7/§8. Hệ quả: **guardrail claim của P4 hiện rỗng** (không có cụm từ nào để chặn) → phải nhập dữ liệu trước khi làm P4.

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

**DEV PREVIEW (cờ `is_dev` trên user):** chỉ tài khoản `is_dev=1` thấy các module ĐANG NÂNG CẤP. `BETA_KEYS = {strategy, plan, products}` (lọc trong `Shell`). Seed sẵn **`dev@masfico.vn` / `Dev2026!`** (ADMIN, is_dev=1) — đổi mật khẩu sau. Admin/Marketing bật/tắt cờ dev cho từng tài khoản ở màn Tài khoản. Khi 1 module "ra mắt chính thức" → bỏ key khỏi `BETA_KEYS`.

**Quyền helper trong Worker:**
- `isStaff(u)` = MARKETING || ADMIN (gác 29+ hành động seeding/review — **KHÔNG mở rộng bừa**).
- `canBaseData(u)` = KY_THUAT || MARKETING || ADMIN (dữ liệu nền P1).
- ⏳ P0 thật: viết `can(user, action)` tập trung + tách `TRUONG_MKT`/`MKT_STAFF`/`GIAM_DOC`. Chưa làm để tránh phá seeding đang chạy.

**Quy tắc quyền không được phá:** 2 cổng duyệt song song độc lập (Trưởng MKT = nội dung; Kỹ thuật = claim, chỉ Duyệt/Trả về, KHÔNG sửa nội dung). Item "Đã duyệt" khi CẢ HAI pass.

---

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
| `content_items` | P3 | ✅ | id, loai(ECOM/SOCIAL), tieu_de, loai_muc_tieu, pillar_id, framework_id, san_pham_id, kenh_id, thang, trang_thai, **pic**(JSON theo khâu), **chi_tiet**(JSON — chứa `ngay_dang` nuôi Lịch), links(JSON), created_at, created_by, created_by_name, updated_at |
| ~~`content_stages`~~ | P3 | ✅ **không cần bảng riêng** | Giai đoạn là **cột `trang_thai`** trên `content_items`. 7 giá trị (`PIPELINE` trong frontend): `Y_TUONG` → `SCRIPT` → `QUAY` → `DUNG` → `CHO_DUYET` → `DA_DANG` → `DA_DO`. Dùng chung cho cả ECOM lẫn SOCIAL |
| `frameworks` | P3/P4 | ✅ | id, ten, mo_ta, thu_tu, active, created_at — **seed 12 nhóm kịch bản thật** (§7) |
| `kenh` | P3 | ✅ | id, ten, loai, thuong_hieu, active, created_at — **seed 10 kênh thật**; `loai` ∈ FANPAGE/TIKTOK/YOUTUBE/ZALO_OA/SHOPEE/WEBSITE |
| `brand_voice` | P4 | ⏳ | tone, từ nên/cấm, CTA |
| `script`, `script_version` | P4 | ⏳ | AI output có version/rollback |
| `duyet_log` | P6 | ⏳ | cổng(nội dung/claim), kết quả, lý do |
| `ket_qua` | P8 | ⏳ | chỉ số + mucTinCay(TRUC_TIEP/GIAN_TIEP/KHONG_QUY_DON) + nguồn |
| `muc_tieu_thang` | P2b/P3 | ⏳ | (tuỳ chọn) tỷ lệ mục tiêu theo tháng để so lệch |

**4 loại mục tiêu KPI** (`LOAI_MUC_TIEU_KPI`, bắt buộc khi tạo nội dung): `BAN_HANG` Bán hàng · `THUONG_HIEU` Thương hiệu · `KY_THUAT` Kỹ thuật · `KENH_DAI_LY` Kênh đại lý. Đây là 4 hệ KPI sẽ tách riêng ở P9 (KHÔNG cộng dồn).

`bootstrap(env,u)` trả tất cả các mảng trên (đọc chung cho mọi vai trò; ghi thì gác quyền). Endpoint mutation luôn `return json({db: await bootstrap(env,me)})`.

---

## 5. LỘ TRÌNH MODULE (P0–P10) — trạng thái & spec

**Trạng thái:** ✅ xong · 🔨 đang làm · ⏳ chưa · ◐ một phần

### ✅ Domain A — Seeding & Quay công trình (ĐÃ CHẠY)
POST/CMT seeding, Quay công trình (3 mức chất lượng/source: Tạm ổn 5k/Chuẩn 10k/Đẹp 15k), Thư viện (group/chủ đề/CMT/ảnh), Lịch đăng xoay vòng (T3/5/7/CN), Nghiệm thu, Chống trùng nội dung–nhóm (P1 seeding), Bảng lương, Vinh danh Top 3. **Giữ nguyên.**

### ◐ P0 — Khung + 6 vai trò + `can()`
Có 3 vai trò + KY_THUAT. ⏳ Còn: `can()` tập trung + 3 vai trò còn lại + sidebar theo quyền. Làm khi P3/P6/P9 cần.

### ✅ P1 — Dữ liệu nền: Sản phẩm + Claim cấm
- Bảng: `san_pham`, `claim_cam`. Quyền: `canBaseData`.
- Endpoints: `POST/PATCH/DELETE /sanpham`, `POST/PATCH/DELETE /claimcam`.
- UI: `ProductClaimManager` (nav `products`) — 2 tab, editor thông số key-value, upload ảnh, import/export CSV sản phẩm. Nav cho MARKETING/ADMIN/KY_THUAT.
- Tiện ích: `scanClaims(text, claims)` (dùng lại ở P4).
- **Dùng cho:** guardrail claim ở P4 (AI chỉ trích thong_so; chặn nếu chạm CHAN).
- ⚠️ **CHƯA có seed dữ liệu:** `san_pham`/`claim_cam` rỗng trên DB mới (đã kiểm — xem §Hiện trạng). Màn hình chạy đủ nhưng **kho dữ liệu trống** → phải nhập/import trước khi P4 có tác dụng.

### ✅ P2 — Chiến lược & Pillar
- Bảng: `pillars` (seed 4 THẬT: Branding 50/Information 30/Problems 15/Interaction 5), `content_strategy` (OKR/BigIdea/Purpose thật). Quyền: `isStaff`.
- Endpoints: `POST/PATCH/DELETE /pillars`, `PATCH /strategy`.
- UI: `StrategyPillar` (nav `strategy`) — sửa định hướng + quản pillar + thanh phân bổ % + badge tổng %.
- **Dùng cho:** cảnh báo lệch tỷ lệ ở P3 (so % kế hoạch với ty_trong pillar, lệch >15% → banner).

### ◐ P3 — Kế hoạch & lịch (THỐNG NHẤT ecom + social) — **module lớn nhất, thay 2 file Excel**
**Lát cắt (1) ✅ ĐÃ LÀM & DEPLOY:** bảng `content_items`, `frameworks` (seed 12 nhóm kịch bản thật), `kenh` (seed 10 kênh thật). content_item có: loai(ECOM/SOCIAL), tieu_de, loai_muc_tieu(4 KPI), pillar_id, framework_id, san_pham_id, kenh_id, thang, trang_thai(7 giai đoạn PIPELINE), pic/chi_tiet/links(JSON), created_by. Endpoints: `POST/PATCH/DELETE /content` + `POST /content/import` + CRUD `/frameworks` `/kenh` (isStaff). UI `ContentPlan` (nav `plan`, MKT/ADMIN): **Kanban 7 cột + Danh sách**, lọc (loại/kênh/pillar/tháng), tạo/sửa (bắt buộc pillar+framework+kênh+mục tiêu), chuyển giai đoạn, **cảnh báo lệch tỷ lệ pillar >15%** (khi ≥5 mục), **Import CSV/paste**. Helper `insertContentItem`.
**Lát cắt (2a) ✅:** **Calendar** (agenda theo ngày, mobile-first) — dùng `chi_tiet.ngay_dang`; **PIC theo từng khâu** (pic.ke_hoach/brief/quay/dung/dang/tracking — nền Trụ A); form mobile 1-cột. 3 view: Kanban/Danh sách/Lịch.
**Lát cắt (2b) ⏳ — VIỆC KẾ TIẾP:** faithful .xlsx import 2 file bằng SheetJS (139 video ecom + lịch social đa kênh) · đẩy trạng thái `CHO_DUYET` sang hàng đợi duyệt P6.
**Đã kiểm chạy thật (§Hiện trạng):** tạo/sửa/xoá nội dung, chuyển giai đoạn, import bỏ dòng rỗng, PIC theo khâu và `ngay_dang` lưu đúng, SALES bị chặn ghi (403) nhưng vẫn đọc được dữ liệu nền.
Thiết kế `content_items` bao cả 2 loại:
- **Chung:** id, loai(ECOM|SOCIAL), tieu_de, pillar_id, framework_id, san_pham_id, kenh_id, **nguoi_phu_trach theo từng khâu** (PIC), trang_thai, thang(YYYY-MM), created_at, created_by. (4 chiều bắt buộc: pillar+loaiMucTieu, campaign, sanpham, framework+hook — KHÔNG cho lưu nếu thiếu.)
- **ECOM (từ file 1):** 6 giai đoạn GĐ1 Kế hoạch → GĐ2 Brief → GĐ3 Quay → GĐ4 Dựng → GĐ5 Air → GĐ6 Tracking; các trường: loai_video, concept, link_kich_ban, PIC brief/quay/dựng/đăng/tracking, ngày quay/đăng, link final, link air, reup Shopee, ghi chú.
- **SOCIAL (từ file 2):** lich_dang, content_pillar, format, content_angle, noi_dung, brief_thiet_ke, link_final, link_post.
- **Views (thực tế đang chạy):** 3 chế độ — **Kanban 7 cột** (dùng chung ECOM/SOCIAL) · **Danh sách** · **Lịch** (agenda theo ngày, đọc `chi_tiet.ngay_dang`, mobile-first).
- **Import cả 2 file .xlsx** làm dữ liệu khởi tạo (139 video ecom + ~lịch social đa kênh).
- **Cảnh báo lệch tỷ lệ** so với pillar (P2).
- **Lát cắt:** (1) ✅ schema + import + list/Kanban → (2a) ✅ calendar + PIC theo khâu + cảnh báo lệch → (2b) ⏳ .xlsx faithful import + đẩy "Chờ duyệt" sang P6.
- Bảng phụ `frameworks` (12 kịch bản §7) và `kenh` (10 kênh §7): ✅ đã tạo & seed.

### ⏳ P4 — Creative Studio (AI) — **thay chatbot rời**
Chọn framework + brand_voice + sản phẩm + góc → Worker gọi Anthropic (cần API key) → output block (hook/problem/solution/proof/cta), lưu `script`+`script_version`. **Guardrail claim bắt buộc** (dùng `scanClaims` + chỉ trích `thong_so`): chạm CHAN → chặn "Gửi duyệt". Hook Optimizer 5 variant + lý do (KHÔNG dự đoán %). Cần: `ANTHROPIC_API_KEY`.

### ⏳ P5 — Kho footage & shot list (mobile-first, R2)
### ⏳ P6 — Hàng đợi duyệt (2 cổng song song: nội dung / claim) → thêm TRUONG_MKT
### ⏳ P7 — Đăng & checklist (KHÔNG auto-post) + khóa mã đơn/voucher (khóa cho P8)
### ⏳ P8 — Nhập kết quả (3 luồng, 3 mức tin cậy: TikTok Shop TRUC_TIEP / Shopee GIAN_TIEP + hàng đợi gán tay / chỉ số KHONG_QUY_DON)
### ⏳ P9 — Dashboard 4 hệ KPI riêng + 3 cột tin cậy (KHÔNG cộng dồn) + **Hiệu suất người phụ trách** (§6 Trụ A) → thêm GIAM_DOC
### ⏳ P10 — Thư viện học + **Vòng lặp AI tự học** (§6 Trụ B): kết quả chảy ngược framework×hook → nạp lại Studio (RAG)

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

### DỮ LIỆU THẬT — trạng thái seed (đã đếm trên DB mới, §Hiện trạng):
- ✅ **Pillar (4, đã seed):** Branding 50 · Information 30 · Problems 15 · Interaction 5.
- ✅ **12 nhóm kịch bản = `frameworks` (đã seed):** Chuẩn bán hàng · PAS · Phản biện comment · Test chất lượng · Hành trình thi công · Size/Combo · FOMO · Review KOC · "đừng..." Trend · Q&A khách hàng · So sánh kinh tế · Hướng dẫn thi công.
- ✅ **10 kênh = `kenh` (đã seed):** Fanpage/TikTok/YouTube Short Kingsmen · Fanpage/TikTok/Shopee VKXD · Zalo OA · CHÍNH-Vật liệu mới FINEX · AFF-Sơn sàn hiệu ứng · BC-Vật liệu hoàn thiện.
- ❌ **Sản phẩm & Claim cấm: CHƯA seed** (`san_pham`=0, `claim_cam`=0). Dự kiến các dòng Finex · Terrazy · Keo Ron (+ Kingsmen grout, ColorMatch, Sàn tự phẳng…) nhưng **chưa nằm trong `migrate()`**. Phải nhập tay qua màn `products` hoặc import CSV — **đây là chặn của P4** (§8).
- **Pipeline ecom (6 GĐ):** ⚪ Mới lên kế hoạch → ✍️ Brief → 🛠 Sản xuất → 🎬 Chờ air → ✅ Đã air (+ Tracking).

---

## 8. CẦN USER CUNG CẤP (chặn các mốc)
- ⏳ `ANTHROPIC_API_KEY` (Cloudflare secret) — cho **P4** Creative Studio. Đã kiểm: **chưa cắm ở bất kỳ đâu** (`wrangler.toml`/worker/frontend đều không có).
- ⏳ **Nội dung Sản phẩm + Claim cấm thật** (spec kỹ thuật từng dòng · danh sách cụm từ cấm kèm mức CANH_BAO/CHAN) — cho **P4**. Hiện 2 bảng rỗng nên guardrail claim **không chặn được gì**. Cần Kỹ thuật (`KY_THUAT`) nhập, hoặc user gửi file để import.
- ⏳ Baseline KPI 3 tháng thật — cho ngưỡng đạt/không đạt ở **P9** (nếu chưa có → để trống, ghi "chưa có baseline").
- (Không còn cần `pillars.json`/`frameworks.json` riêng — đã có trong 2 file Excel.)

## 9. RÀNG BUỘC ĐÃ BIẾT (đừng hứa quá)
- KHÔNG auto-post (TikTok Content Posting API cần audit → SELF_ONLY). Đăng thủ công theo checklist.
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
- `a8a6024` — P3 lát cắt (2a): Calendar (agenda theo ngày) + PIC theo khâu + form mobile 1-cột (4 test).
- (Trước đó, Domain A: seeding/quay/lịch/thư viện ảnh/vinh danh/chống trùng… đã deploy.)
- **2026-09-08 — Rà soát hiện trạng (không đổi code app):** đối chiếu tài liệu với mã thật, chạy lại toàn bộ validate + **16 test tích hợp (16/16 đạt)**. Sửa 5 chỗ tài liệu ghi sai/lỗi thời: mốc cập nhật còn đứng ở P2 · `content_items`/`frameworks`/`kenh` còn ⏳ dù đã ✅ · `content_stages` không tồn tại (là cột `trang_thai` 7 giá trị) · views ghi "6 cột" thay vì 3 chế độ Kanban-7-cột/Danh sách/Lịch · §7 khẳng định sản phẩm "seed thẳng" trong khi thực tế **chưa seed**. Thêm §Hiện trạng làm ảnh chụp hiện trạng đã kiểm.
- ▶️ **Kế tiếp:** **P3 lát cắt (2b)** — faithful .xlsx import 2 file bằng SheetJS + đẩy `CHO_DUYET` sang P6. **Song song, việc rẻ mà gỡ chặn P4:** nhập/seed dữ liệu thật cho `san_pham` + `claim_cam` (§8).
