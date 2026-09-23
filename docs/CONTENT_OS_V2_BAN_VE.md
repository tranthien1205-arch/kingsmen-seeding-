# KINGSMEN CONTENT OS — BẢN VẼ APP MỚI "PHÒNG MARKETING TỰ VẬN HÀNH"

Ngày: 2026-09-23 · Người duyệt: Thiện · Trạng thái: **DỰ THẢO chờ duyệt**

Đây là **thiết kế mới hoàn toàn**, không phải bản nâng cấp: app mới, mã nguồn mới (thư mục/repo riêng), cơ sở dữ liệu mới, sổ ADR đánh số lại từ **ADR-001**. App đang chạy (`kingsmen-seeding-`, hồ sơ `CONTENT_OS_PLAN.md`) gọi là **app cũ**: vẫn dùng tạm, chỉ là nơi chép lại những mô-đun đã kiểm thử; không kế thừa cấu trúc, không kéo dữ liệu.

## 0. Một câu

> App là **một vòng lặp kín tự chạy**: Chiến lược → Kế hoạch → Nội dung → Đăng → Đo → Học → (quay lại Chiến lược).
> Con người chỉ đứng ở **4 cổng**. Ngoài 4 cổng đó, nếu người phải bấm là app đang thiếu.

## 1. Mục đích & 6 luật nền (không ADR nào được vi phạm)

| # | Luật | Vì sao |
|---|---|---|
| L1 | **Mỗi bước có một "người thực hiện" gán được: NGƯỜI / AI GỢI Ý / AI TỰ LÀM** (§3b Bộ quyền thực hiện). Giai đoạn 1 mọi bước là NGƯỜI, máy đứng cạnh **học**; bước nào máy đủ điểm sẵn sàng thì người gạt sang AI. Không bước nào tự gạt. | Tự động hoá dần theo bằng chứng, không nhảy cóc |
| L2 | **4 cổng người là bắt buộc, không công tắc nào tắt được:** (G1) chốt định vị/chiến lược, (G2) chốt kế hoạch tháng, (G3) duyệt nội dung trước đăng, (G4) duyệt đề xuất cải tiến chiến lược. | Đây là chỗ chịu trách nhiệm thương hiệu và tiền |
| L3 | **Máy không bịa số, không bịa dữ kiện.** Số đo chỉ từ API/đối soát; thông số sản phẩm chỉ từ hồ sơ sản phẩm; thiếu thì ghi `[điền …]`. Ba mức tin cậy kết quả không cộng dồn. | Luật đã chứng minh ở app cũ, giữ nguyên |
| L4 | **Mọi hành động của máy đều có dấu vết:** ai (agent nào), lúc nào, đọc gì, ghi gì, tốn bao nhiêu (token/USD), lý do bỏ qua. Người xem được trong 1 màn. | Tự động mà không truy vết được thì không ai dám bật |
| L5 | **Người gửi không tự duyệt; máy không tự duyệt cổng G3.** Kịch bản máy soạn vẫn qua đúng hàng đợi duyệt như người soạn. | Luật từ app cũ (người lập ≠ người duyệt) |
| L6 | **Chi phí AI có ngân sách tháng**, vượt thì máy dừng khâu tốn tiền (soạn nháp, sinh ảnh), khâu rẻ (đo, báo cáo tóm tắt) vẫn chạy. | Luật từ app cũ (ngân sách AI) |

## 2. Vòng lặp kín — 10 tầng, 4 cổng

```
 [G1] ĐỊNH VỊ & CHIẾN LƯỢC (người chốt; máy đề xuất chỉnh mỗi quý từ tầng 10)
   │  pillar %, tông giọng, đối tượng, kênh, claim cấm, sản phẩm & thông số thật
   ▼
 T1  TREND & TÍN HIỆU THỊ TRƯỜNG        máy gom mỗi sáng, AI chấm, tự duyệt theo luật, tự sinh ý tưởng
   ▼
 T2  KẾ HOẠCH THÁNG                     máy lập ngày 25 từ: chiến lược + kết quả tháng trước + trend đã duyệt
 [G2]                                    người sửa & CHỐT (một nút)
   ▼
 T3  KẾ HOẠCH TUẦN & MỤC NỘI DUNG       máy chia tuần, tạo mục (pillar/định dạng/kênh/sản phẩm/ngày đăng)
   ▼
 T4  SOẠN NHÁP                          máy viết đúng định dạng (video/post/ảnh/carousel), tự thẩm định claim & dữ kiện
   ▼
 T5  HÀNG ĐỢI DUYỆT                     máy chấm điểm sẵn (checklist + rủi ro) → xếp thứ tự
 [G3]                                    người DUYỆT / SỬA / TRẢ LẠI (SLA: nhắc sau N giờ)
   ▼
 T6  SẢN XUẤT                           post/carousel: máy hoàn thiện. ảnh: máy sinh (nếu bật API). video: máy chuẩn bị gói dựng, NGƯỜI dựng (Lọc/Dựng)
   ▼
 T7  LỊCH & ĐĂNG                        máy xếp giờ tốt nhất theo dữ liệu, tự đăng qua API/n8n, đăng tay thì giao việc
   ▼
 T8  ĐO LƯỜNG                           máy đo mỗi ngày qua API nền tảng, gắn đơn từ đối soát sàn
   ▼
 T9  BÁO CÁO                            máy viết báo cáo tuần/tháng (số + nhận định + việc cần làm), gửi app / Zalo / mail
   ▼
 T10 HỌC & ĐỀ XUẤT CẢI TIẾN             máy so pillar/định dạng/hook/kênh/giờ đăng → đề xuất đổi tỷ trọng, mẫu hook, lịch
 [G4]                                    người DUYỆT đề xuất → máy tự cập nhật chiến lược/kế hoạch → quay lại G1/T2
```

**Điểm khác căn bản với app cũ:** app cũ là "kho + form + nút", người kéo nội dung qua từng trang. app mới là **máy kéo**, mỗi tầng có một agent con; người chỉ nhận **việc** ở 4 cổng qua màn *Việc của tôi*.

## 3. Bộ máy: Agent điều phối + 9 agent con

Một **Agent điều phối** chạy theo cron 15' (cron Worker), mỗi lượt hỏi từng agent con "tới giờ chưa, có việc không, có ngân sách không", chạy tuần tự, ghi `agent_run`. Mỗi agent con là một hàm thuần trong Worker (không cần n8n; n8n chỉ là "tay nối" ra nền tảng không API).

| Agent | Kích hoạt | Đọc | Ghi | Công tắc | Cổng người |
|---|---|---|---|---|---|
| **A1 Trend** | mỗi sáng | Google Trends, YouTube, (n8n: TikTok) | `trends` + điểm AI; `TU_LAM`: tự duyệt trend đủ điểm & không rủi ro → tạo **ý tưởng** gắn pillar | có | — |
| **A2 Kế hoạch tháng** | ngày 25 hằng tháng (và khi bấm) | pillar %, chỉ tiêu tháng trước, kết quả theo pillar/định dạng/kênh, ý tưởng từ A1, sản phẩm ưu tiên | `ke_hoach_thang` bản **ĐỀ XUẤT** kèm lý do từng số | có | **G2** chốt |
| **A3 Chia tuần & tạo mục** | ngay khi G2 chốt | kế hoạch tháng đã chốt, lịch nghỉ, giờ đăng tốt | `muc_noi_dung` với tuần, ngày đăng dự kiến, pillar/định dạng/kênh/sản phẩm/framework | có | — |
| **A4 Soạn nháp** | hằng ngày, cho mục tuần này + tuần sau chưa có kịch bản | mục kế hoạch, hồ sơ sản phẩm, framework, bài học đã duyệt, claim cấm, hook đang thắng | `noi_dung` (tao_boi = AGENT) → tự thẩm định → **gửi duyệt** | có; giới hạn N bài/ngày & ngân sách | **G3** |
| **A5 Thẩm định** | mỗi khi có kịch bản mới (người hay máy) | checklist duyệt, claim cấm, thông số thật, lịch sử trả lại | điểm + lý do gắn vào bản ghi duyệt; `TU_LAM`: tự **trả lại** bài trượt luật cứng (claim CHẶN, thiếu CTA…) — không bao giờ tự **duyệt** | có | — |
| **A6 Sản xuất** | khi G3 duyệt | kịch bản đã duyệt | post/carousel: bản đăng cuối; ảnh: sinh qua API (nếu bật) vào Kho media; video: gói dựng (EDL/CSV/kho footage gợi ý) + **giao việc dựng** cho người | có | video: người |
| **A7 Lịch & Đăng** | khi có bản đăng cuối | suất lịch, giờ tốt theo dữ liệu, kênh & cách đăng | `bai_dang` + tự đăng (API/n8n) / giao việc đăng tay | có | — |
| **A8 Đo lường** | hằng ngày | link đã đăng, token kênh, đối soát sàn | `ket_qua` API_KENH (đo Graph/YouTube, phần tăng theo ngày) + gắn đơn | có | — |
| **A9 Báo cáo** | thứ Hai hằng tuần + ngày 1 hằng tháng | kết quả kỳ, kế hoạch vs thực tế, việc kẹt, chi phí AI | `bao_cao` (số + nhận định AI + 3 việc cần làm) → gửi app, n8n→Zalo/mail | có | — |
| **A10 Học & Đề xuất** | sau báo cáo tháng | kết quả ≥ min_mau theo pillar/định dạng/hook/kênh/giờ | `de_xuat` (đổi % pillar, cơ cấu định dạng, hook mẫu, giờ đăng, dừng kênh yếu) kèm bằng chứng | có | **G4** |

Nguyên tắc chung cho mọi agent: **idempotent theo ngày** (chạy lại không nhân đôi), **bỏ qua có lý do** (không có việc / thiếu token / hết ngân sách / chưa tới giờ), **thử-thật tách bạch** (nút "Chạy thử" không chiếm lượt của ngày).

## 3b. BỘ QUYỀN THỰC HIỆN — người hay AI làm bước này?

Đây là trái tim của app mới. Mỗi **bước** trong vòng lặp có một dòng trong bảng `buoc_thuc_hien`:

| Trường | Ý nghĩa |
|---|---|
| `buoc` | mã bước (bảng dưới) |
| `nguoi_thuc_hien` | `NGUOI` · `AI_GOI_Y` (máy làm bản nháp, người xem/sửa/bấm) · `AI_TU_LAM` (máy làm xong, người chỉ thấy kết quả) |
| `vai_tro_nguoi` | khi là NGƯỜI hoặc AI_GOI_Y: vai trò nào nhận việc (MARKETING / TRUONG_MKT / GIAM_DOC / KY_THUAT…) |
| `nguoi_duyet` | vai trò duyệt đầu ra (chỉ 4 cổng G1–G4 là bắt buộc có; bước khác có thể `KHONG`) |
| `hoc` | `BAT`/`TAT` — máy có được đứng cạnh học khi người làm không (mặc định BẬT) |
| `san_sang` | điểm sẵn sàng của máy cho bước này, máy tự tính (0–100), người **không sửa được** |
| `doi_boi`, `doi_at` | ai gạt mức gần nhất, lúc nào (audit) |

**Ai được gạt:** Admin và Trưởng MKT (GĐ được xem). Gạt lên `AI_TU_LAM` chỉ mở khi `san_sang ≥ ngưỡng` (mặc định 80) **và** ≥ `min_mau` mẫu; gạt xuống thì lúc nào cũng được. Bốn cổng G1–G4 **không có ô AI_TU_LAM** — cố định NGƯỜI.

### Danh sách bước & lộ trình tự nhiên của mỗi bước

| Bước | Giai đoạn 1 (người làm, máy học) | Máy học gì | Điểm sẵn sàng tính từ | Đích |
|---|---|---|---|---|
| B1 Gom & chấm trend | máy gom (đã có), **người** chấm/duyệt | trend nào người duyệt/bỏ, lý do | tỷ lệ AI chấm trùng với người | AI_TU_LAM |
| B2 Lập kế hoạch tháng | **người** lập (có nút Đề xuất) | người sửa số nào so với đề xuất | độ lệch đề xuất ↔ bản chốt | AI_GOI_Y (G2 chốt) |
| B3 Chia tuần, tạo mục | **người** | người xếp tuần/ngày/kênh thế nào | tỷ lệ mục máy đề xuất được giữ nguyên | AI_TU_LAM |
| B4 Soạn nội dung | **người** viết (AI trong Studio là công cụ) | **bản nháp bóng**: máy viết ngầm cùng mục, so với bản người gửi duyệt; người sửa gì ở bài AI | điểm giống + tỷ lệ bài AI được duyệt không sửa | AI_GOI_Y → AI_TU_LAM (vẫn qua G3) |
| B5 Thẩm định trước duyệt | **người** duyệt (G3) | vì sao trả lại (checklist, claim, thiếu gì) | tỷ lệ máy đoán đúng "duyệt/trả" | AI_GOI_Y chấm sẵn + tự trả bài trượt luật cứng |
| B6 Sản xuất post/carousel | **người** hoàn thiện | bản đăng cuối khác kịch bản chỗ nào | tỷ lệ bản máy được dùng nguyên | AI_TU_LAM |
| B7 Sản xuất ảnh | **người** thiết kế | brief nào ra ảnh được duyệt | (cần API ảnh) | AI_GOI_Y |
| B8 Sản xuất video | **người** quay, lọc, dựng | footage nào được chọn cho bước nào, nhịp cắt | — | NGƯỜI (máy chuẩn bị gói + giao việc) |
| B9 Xếp lịch & đăng | **người** đặt giờ; tự đăng đã có | giờ/kênh nào cho kết quả tốt | đủ mẫu giờ đăng vs kết quả | AI_TU_LAM |
| B10 Đo lường | máy (ADR-008) | — | — | AI_TU_LAM (đã) |
| B11 Báo cáo | **người** đọc dashboard | người hay nhìn số nào, hỏi gì | — | AI_TU_LAM |
| B12 Rút bài học & đề xuất | **người** viết bài học | bài học nào được duyệt, có số kèm không | số bài học máy đề xuất được duyệt | AI_GOI_Y (G4 duyệt) |

### Chế độ học ("máy đứng cạnh") — giai đoạn 1 làm gì cụ thể

1. **Ghi quyết định người** ở mọi bước có `hoc=BAT`: đầu vào máy thấy, đầu ra người làm, lý do (nếu form có ô lý do) → bảng `mau_hoc (buoc, dau_vao, dau_ra_nguoi, dau_ra_may, giong, ghi_chu)`.
2. **Bản nháp bóng** cho B4/B5/B2: máy làm ngầm cùng đầu vào (trong ngân sách AI riêng cho học, mặc định thấp), **không hiện cho người** trừ khi người bật "xem máy làm thử". So khớp tự động (cùng cấu trúc, cùng claim, cùng CTA, độ giống văn bản) → cộng vào `san_sang`.
3. **Mẫu tốt thành ví dụ**: bài người viết được duyệt không sửa + có kết quả tốt → vào kho ví dụ theo pillar/định dạng, máy dùng làm few-shot khi được gạt sang AI.
4. **Bảng sẵn sàng** ở màn *Máy*: mỗi bước một thanh 0–100 + số mẫu + "còn thiếu gì để gạt". Khi đủ, máy chỉ **đề nghị** ("B4 đã sẵn sàng 83/100 trên 41 mẫu — gạt sang AI GỢI Ý?"), người gạt.
5. **Gạt rồi vẫn học**: ở mức AI_GOI_Y/AI_TU_LAM, mỗi lần người sửa/trả lại là một mẫu mới; tỷ lệ trả lại tăng quá ngưỡng 2 tuần → máy tự đề nghị hạ mức (không tự hạ).

Chi phí học: bản nháp bóng tốn AI. Có ngân sách riêng `ai.ngan_sach_hoc_usd` (mặc định 20% ngân sách tháng), hết thì tạm dừng học, người làm vẫn bình thường.

## 4. Con người: 4 cổng + màn "Việc của tôi" là màn chính

| Cổng | Ai | Việc | SLA & nhắc |
|---|---|---|---|
| G1 Chiến lược | Giám đốc + Trưởng MKT | chốt định vị, pillar %, kênh, claim cấm; duyệt bản cập nhật quý | nhắc khi có đề xuất G4 đã duyệt chờ ghi vào chiến lược |
| G2 Kế hoạch tháng | Trưởng MKT (GĐ xem) | sửa & bấm **Chốt** bản đề xuất của A2 | ngày 25 có bản; chưa chốt tới ngày 28 → nhắc đỏ |
| G3 Duyệt nội dung | Trưởng MKT / người duyệt được phân | duyệt / sửa / trả lại (máy chấm sẵn) | bài nằm > 24h → nhắc; > 48h → GĐ thấy |
| G4 Đề xuất cải tiến | Trưởng MKT + GĐ | duyệt / bỏ từng đề xuất; duyệt = máy tự áp | sau báo cáo tháng |

Việc **ngoài cổng** vẫn còn người làm (thật thà): dựng video, chụp/quay footage, đăng tay ở nền tảng không API, nhập đối soát sàn. Chúng xuất hiện ở *Việc của tôi* dưới dạng **việc được giao có hạn** (máy giao, máy nhắc), không phải "trang để vào xem".

## 5. Giao diện — 5 màn (app cũ có 20 trang)

| Màn | Gộp những gì của app cũ | Nội dung |
|---|---|---|
| **1. Việc của tôi** (mặc định khi mở app) | Dashboard + Bắt đầu + hàng đợi rải rác | 4 cổng dưới dạng thẻ việc theo hạn; việc được giao (dựng/đăng/đối soát); bảng "máy đang làm gì hôm nay" |
| **2. Chiến lược & Kế hoạch** | Chiến lược, Kế hoạch (tháng/tuần/lịch), Trend | Định vị & pillar (G1) · Kế hoạch tháng đề xuất↔chốt (G2) · Tuần & lịch (chỉ xem, sửa tay khi cần) · Trend & ý tưởng máy gom |
| **3. Dòng chảy nội dung** | Studio, Duyệt, Sản xuất, Đăng bài, Lịch & dựng video | **Một kanban tự chạy** theo 6 giai đoạn; mỗi thẻ mở popup đúng việc: soạn/sửa (Studio), duyệt (G3), dựng (Lọc/Dựng), đăng. Không còn trang riêng cho từng khâu |
| **4. Kết quả & Báo cáo** | Kết quả, Dashboard nội dung, Thư viện học | Số theo 3 mức tin cậy · báo cáo tuần/tháng máy viết · đề xuất cải tiến (G4) · bài học |
| **5. Máy** | Hệ thống, Bộ não AI, Cấu hình rải rác, Kênh | Bảng công tắc 10 agent (TAT/GOI_Y/TU_LAM + giờ) · nhật ký `agent_run` · chi phí AI & ngân sách · kênh & token · người dùng & quyền · sản phẩm & claim cấm |

Sales/Seeding: nhóm màn riêng (Nhiệm vụ, Bằng chứng, Đơn) — chép logic app cũ, giao diện PWA.

## 6. Dữ liệu — cơ sở dữ liệu mới, sạch (không kéo dữ liệu app cũ)

Quyết định (Thiện, 2026-09-23): **bỏ qua dữ liệu hiện tại**. D1 mới, schema thiết kế lại từ đầu theo vòng lặp; không kéo bảng cũ sang. Chỉ nhập lại **danh mục gốc** một lần bằng script (hoặc nhập tay): `san_pham` + thông số thật, `claim_cam`, `pillars`, `frameworks`, `kenh`, `users`. Nội dung/kịch bản/kết quả cũ không mang theo (app cũ vẫn đọc được cho tới khi tắt).

Schema — nhóm theo tầng của vòng lặp (tên bảng tiếng Việt không dấu):

| Tầng | Bảng | Ghi chú thiết kế mới |
|---|---|---|
| Nền | `users, phien, audit, module_config, ai_usage` | `audit.tac_nhan` phân biệt NGUOI / AGENT |
| Chiến lược (G1) | `chien_luoc (id, phien_ban, dinh_vi, tong_giong, doi_tuong, chot_boi, chot_at)`, `pillars`, `frameworks`, `san_pham`, `claim_cam`, `kenh (+ token qua secret TOKEN_<ma>)` | chiến lược **có phiên bản** — G4 duyệt đề xuất = tạo phiên bản mới, lịch sử giữ nguyên |
| Kế hoạch (G2) | `ke_hoach_thang (thang, phien_ban, chi_tieu, dinh_huong, nguon DE_XUAT/NGUOI, chot_boi, chot_at)`, `y_tuong`, `muc_noi_dung (id, thang, tuan, ngay_dang, pillar, dinh_dang, kenh, san_pham, framework, giai_doan, tao_boi NGUOI/AGENT)` | `muc_noi_dung` thay `content_items` + `san_xuat` — một thẻ đi hết 6 giai đoạn |
| Nội dung (G3) | `noi_dung (id, muc_id, dinh_dang, phien_ban, hook, sections, cta, chi_tiet, tao_boi, trang_thai)`, `noi_dung_phien_ban`, `duyet (id, doi_tuong, cong, trang_thai, cham_may, ly_do_nguoi)` | `noi_dung` thay `scripts`; `duyet.cham_may` = điểm & lý do máy chấm sẵn |
| Sản xuất & Đăng | `tai_san (id, loai FOOTAGE/ANH/VIDEO_XUAT/GOI_DUNG, nguon, muc_id, r2_key)`, `bai_dang (id, noi_dung_id, kenh, gio_dang, cach, link, trang_thai)`, `suat_lich` | `tai_san` gộp footage + media_library + video xuất (ADR-004 hoàn tất) |
| Đo & Học | `ket_qua` (3 mức tin cậy; cột KPI đủ cho cả brand lẫn bán hàng: tiep_can, luot_xem, chia_se, luu, binh_luan, tuong_tac, click, so_don, doanh_thu; API_KENH ghi phần tăng/ngày), `bao_cao`, `bai_hoc`, `de_xuat` | Thiện 2026-09-23: nội dung brand đo tiếp cận/xem/chia sẻ, không chỉ đơn. Mỗi mục nội dung và mỗi pillar có `muc_tieu` BRAND | BAN_HANG để chọn bộ KPI |
| Máy | `buoc_thuc_hien`, `mau_hoc`, `agent_run`, `cong_viec` | mới — xem §3b |
| Seeding/Sales | `nhiem_vu, bang_chung, don` | chép logic app cũ sang schema mới ở đợt cuối |

Bảng mới (giải thích):
| Bảng | Vai trò |
|---|---|
| `agent_run (id, agent, ngay, at, ok, bo_qua_ly_do, doc, ghi, tokens, usd, chi_tiet)` | thay `agent_log`; một dòng/lượt/agent; nền của màn "Máy" và luật L4 |
| `cong_viec (id, loai, doi_tuong_id, giao_cho, han, trang_thai, tao_boi=agent, ly_do)` | việc máy giao người: dựng video, đăng tay, nhập đối soát, sửa bài bị trả |
| `de_xuat (id, ky, loai, noi_dung JSON, bang_chung JSON, trang_thai CHO/DUYET/BO, ap_dung_at)` | đầu ra A10, cổng G4; duyệt = máy tự ghi vào chiến lược/kế hoạch |
| `bao_cao (id, ky, loai TUAN/THANG, so_lieu JSON, nhan_dinh, viec_can_lam JSON, gui_qua)` | đầu ra A9 |
| `y_tuong (id, nguon TREND/AI/NGUOI, pillar_id, dinh_dang, tieu_de, ly_do, trang_thai)` | giữa Trend và Kế hoạch — trend hay nhưng chưa thành mục kế hoạch thì nằm đây |

| `buoc_thuc_hien (buoc PK, nguoi_thuc_hien, vai_tro_nguoi, nguoi_duyet, hoc, san_sang, so_mau, doi_boi, doi_at)` | **bộ quyền người/AI** theo bước (§3b) — thay cho các công tắc rải rác `trend.agent_bat`, `doluong.agent_bat`… (migrate sang) |
| `mau_hoc (id, buoc, ngay, doi_tuong_id, dau_vao, dau_ra_nguoi, dau_ra_may, giong, ket_qua_sau, ghi_chu)` | mẫu học từ quyết định người + bản nháp bóng; nền của `san_sang` và kho ví dụ few-shot |

Agent chỉ được **chạy** một bước khi `buoc_thuc_hien[buoc].nguoi_thuc_hien` là `AI_GOI_Y`/`AI_TU_LAM`; ở mức `NGUOI` agent chỉ được **học** (nếu `hoc=BAT`).

## 7. Mức tự động hoá: hôm nay → đích

| Khâu | App cũ hôm nay | Đích app mới | Ghi chú |
|---|---|---|---|
| Trend | gom + chấm; tự duyệt/tự tạo mục TẮT | `TU_LAM` sinh ý tưởng, mục kế hoạch chờ A2 | luật rủi ro claim vẫn chặn |
| Kế hoạch tháng | nút Đề xuất, người bấm | máy lập ngày 25, người chốt (G2) | |
| Tuần & mục | người xếp | máy chia, máy tạo mục | người vẫn thêm/sửa được |
| Soạn nội dung | người mở Studio, AI viết | máy soạn hằng ngày, tự thẩm định, gửi duyệt | Studio còn để sửa |
| Duyệt | người | người (G3) + máy chấm sẵn & tự trả bài trượt luật cứng | không bao giờ máy duyệt |
| Sản xuất post/carousel | người | máy | |
| Sản xuất ảnh | không | máy sinh qua API ảnh (cần chọn nhà cung cấp + ngân sách) | tuỳ chọn |
| Sản xuất video | người (Lọc/Dựng) | máy chuẩn bị gói + giao việc; người dựng | **giới hạn thật** cho tới khi có AI video đáng tin |
| Đăng | tự đăng API/n8n | như cũ + máy chọn giờ theo dữ liệu | |
| Đo | ADR-008 | như cũ + TikTok/Threads qua n8n | |
| Báo cáo | không | máy viết tuần/tháng, gửi app + Zalo + mail (qua n8n) | |
| Học & cải tiến | người rút bài học | máy đề xuất, người duyệt (G4), máy áp | |
| Nâng cấp app | — | máy ghi "đề xuất tính năng" từ việc kẹt lặp lại; người/Claude triển khai | không tự sửa code |

## 8. Giới hạn nói thẳng

1. **Video** vẫn cần người quay và dựng. Máy chỉ rút ngắn: kịch bản, gói dựng, chọn footage gợi ý, giao việc, nhắc hạn.
2. **Ảnh** chỉ tự động khi cắm API sinh ảnh (Gemini Imagen / Ideogram…) — cần quyết định nhà cung cấp + ngân sách riêng; ảnh sản phẩm thật vẫn phải chụp.
3. **Zalo, TikTok, Threads** không có API đo/đăng ổn định cho doanh nghiệp nhỏ → đi đường n8n; app không cào web.
4. **Chất lượng bài máy soạn** phụ thuộc hồ sơ sản phẩm + bài học đã duyệt. Hồ sơ nghèo → bài đầy `[điền …]`. Đây là chỗ người phải đầu tư một lần.
5. **Máy không tự nâng cấp code**; nó chỉ chỉ ra chỗ kẹt lặp lại.

## 9. Kiến trúc kỹ thuật & lộ trình — app mới, chạy song song app cũ, thay hẳn khi xong

**Nền kỹ thuật (chọn lại từ đầu, giữ những gì đã chứng minh rẻ và đủ):**
- Cloudflare Worker (API + cron 15' cho agent điều phối) · D1 (SQLite) mới · R2 cho tài sản media · secrets cho mọi token (`TOKEN_<kênh>`, `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, `N8N_TOKEN`).
- Giao diện: React 18, **mã tách file theo màn** (`app/man/*.jsx`, `app/agent/*.js`), một bước build gộp + Tailwind; không còn một file 8k dòng. PWA cho điện thoại (Sales/Seeding).
- Bộ não: Anthropic ở Worker (chạy được theo cron, có ngân sách); Gemini key cá nhân chỉ là tuỳ chọn trong trình duyệt.
- Kiểm thử: D1 giả lập bằng `node:sqlite` nằm **trong repo** (`tests/`) từ ngày đầu; mỗi agent có test "chạy 2 lần không nhân đôi" và "thiếu dữ kiện thì bỏ qua có lý do".
- Repo/thư mục mới: `kingsmen-content-os` (Thiện tạo repo GitHub; Cloudflare project mới, địa chỉ mới). App cũ giữ nguyên địa chỉ cũ tới đợt 6.

**Chép mô-đun từ app cũ** (đã kiểm thử, chỉ sửa theo schema mới): đăng nhập & phiên, guardrail claim cấm, prompt theo 4 định dạng + thẩm định JSON AI, ba mức tin cậy kết quả & đối soát sàn, lịch đăng & tự đăng API/n8n, đo lường Graph/YouTube + ingest, chi phí AI & ngân sách, công cụ Lọc/Dựng video (đã là file riêng).

**Giai đoạn 1 — "Người làm, máy học"** (đợt 1–4): mọi bước ở mức NGƯỜI, máy ghi mẫu, làm bản nháp bóng, tính điểm sẵn sàng. Đội làm việc bình thường nhưng **mọi thao tác đều thành dữ liệu dạy máy**.
**Giai đoạn 2 — "Gạt từng bước"** (đợt 5–6): bước đủ điểm thì Trưởng MKT gạt sang AI GỢI Ý rồi AI TỰ LÀM; 4 cổng giữ người.

| Đợt | ADR (sổ mới) | Dựng gì | Người dùng được gì |
|---|---|---|---|
| 1 | **001 Nền + Bộ quyền thực hiện + màn Máy** | D1 mới, schema §6, đăng nhập/quyền, `buoc_thuc_hien` (12 bước, mặc định NGƯỜI), `agent_run`, agent điều phối (cron), màn **Máy** + khung 5 màn, nhập danh mục gốc (sản phẩm/claim/pillar/framework/kênh/người) | mở app mới thấy khung, bảng bước người/AI, danh mục gốc |
| 2 | **002 Chiến lược & Kế hoạch (G1, G2)** | `chien_luoc` có phiên bản, kế hoạch tháng (đề xuất ↔ chốt), tuần, `muc_noi_dung`, trend & `y_tuong` (máy gom, người chấm — máy học B1) | lập chiến lược, chốt kế hoạch tháng, có mục nội dung theo tuần |
| 3 | **003 Dòng chảy nội dung (G3) + chế độ học** | kanban 6 giai đoạn, Studio popup 4 định dạng, hàng đợi duyệt (người gửi ≠ người duyệt), Lọc/Dựng popup, `tai_san`, `bai_dang` + tự đăng; **`mau_hoc` + bản nháp bóng B4/B5** | làm nội dung end-to-end trên app mới; máy bắt đầu học thật |
| 4 | **004 Kết quả, Báo cáo, Học & Đề xuất (G4) + `cong_viec`** | đo lường (Graph/YouTube/n8n ingest), 3 mức tin cậy, `bao_cao` tuần/tháng gửi app + n8n→Zalo/mail, `de_xuat` có bằng chứng, việc máy giao có hạn | thứ Hai nhận báo cáo; cuối tháng có đề xuất để duyệt; **app mới đủ để thay app cũ cho phòng MKT** |
| 5 | **005 Gạt bước sang AI** | nhóm 1: B1 trend, B5 chấm sẵn, B9 giờ đăng, B11 báo cáo → nhóm 2: B4 soạn nháp, B2 kế hoạch đề xuất, B3 chia tuần, B6 post/carousel, B7 ảnh (nếu có API) | máy xin làm bước đủ điểm; người còn duyệt & chốt |
| 6 | **006 Seeding/Sales sang app mới + tắt app cũ** | nhiệm vụ/bằng chứng/đơn theo schema mới, test trong `tests/`, app cũ chỉ đọc rồi tắt | một app duy nhất |

Mỗi đợt: ADR 6 dòng → duyệt → code + test D1 giả lập + DEMO → changelog §11 → merge main (app mới ở địa chỉ riêng cho tới đợt 6).

## 10. Rủi ro & chốt chặn

| Rủi ro | Chốt chặn |
|---|---|
| Máy soạn nhiều bài kém → người duyệt ngập | giới hạn N bài/ngày theo chỉ tiêu tuần còn thiếu; A5 tự trả bài trượt luật; tỷ lệ trả lại > 50% hai tuần → A4 tự hạ về `GOI_Y` và báo |
| Tốn tiền AI | ngân sách tháng L6; mỗi agent ghi USD; màn Máy hiện "tháng này máy tốn X" |
| Máy đề xuất sai chiến lược | G4 bắt buộc; đề xuất phải kèm bằng chứng ≥ `min_mau` mẫu; không có số thì không đề xuất |
| Token nền tảng hết hạn | agent báo lỗi OAuth thành việc "Cắm lại token" trong Việc của tôi, không bịa số |
| Người không tin máy | mọi bài máy soạn có nhãn 🤖 + "vì sao viết vậy" (pillar, framework, bài học dùng) |

---
*Quyết định cần bạn chốt để bắt đầu đợt 1: (a) duyệt bản vẽ này làm hồ sơ nền của app mới; (b) repo mới `kingsmen-content-os` chạy song song app cũ (đã chốt: bỏ dữ liệu cũ); (c) ai được gạt mức người/AI (đề xuất: Admin + Trưởng MKT); (d) ngưỡng sẵn sàng mặc định 80/100 và ≥ 30 mẫu.*
