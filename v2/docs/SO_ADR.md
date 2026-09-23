# KINGSMEN CONTENT OS — SỔ ADR & CHANGELOG (app mới)

Hồ sơ nền: [`../../docs/CONTENT_OS_V2_BAN_VE.md`](../../docs/CONTENT_OS_V2_BAN_VE.md) (bản vẽ, duyệt 2026-09-23).
Luật: mọi thay đổi chạm nền (schema, bộ quyền, cổng, agent) phải có ADR 6 dòng được duyệt trước khi code; mỗi đợt ghi changelog; `dist/` commit kèm.

## Sổ ADR

```
ADR-001 · 2026-09-23 · Nền + Bộ quyền thực hiện 12 bước + Agent điều phối + màn Máy + danh mục gốc
Bối cảnh : App cũ là "kho + form + nút", người kéo nội dung qua 20 trang; không có khái niệm bước nào do người hay AI làm.
Quyết định: (1) Worker + D1 + R2 mới, mã giao diện tách file 5 màn. (2) Bảng buoc_thuc_hien: 12 bước, mỗi bước NGUOI |
            AI_GOI_Y | AI_TU_LAM, có muc_toi_da (cổng G2/G3/G4 và B8 video không lên AI_TU_LAM), điểm san_sang do máy tự
            chấm từ mau_hoc (trung bình "giống" 60 mẫu gần nhất), gạt lên AI_TU_LAM cần ≥ ngưỡng (80) và ≥ min_mau (30);
            chỉ ADMIN/TRUONG_MKT gạt, GĐ xem. (3) Agent điều phối theo cron 15', mỗi agent chốt 1 lượt/ngày đúng giờ,
            "chạy thử" ghi thu=1; THUC_HIEN chỉ chạy khi bước ở mức AI, HOC chỉ khi hoc=BẬT. (4) Danh mục gốc nhập lại
            (không kéo dữ liệu app cũ). (5) Chế độ mô phỏng (Admin nạp/xoá dữ liệu mp_) để duyệt thiết kế đợt 2–4 trước.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-23, "Duyệt, bắt đầu đợt 1"; repo: thư mục v2/; Admin + Trưởng MKT gạt; 80/100 & ≥30 mẫu)
```

```
ADR-002 · 2026-09-23 · Chiến lược có phiên bản (G1) · Kế hoạch tháng máy đề xuất ↔ người chốt (G2) · Tuần & mục · Ý tưởng/trend (B1) · KPI theo mục tiêu
Bối cảnh : Đợt 1 mới có khung; cần tầng đầu của vòng lặp. Thiện bổ sung: kết quả phải đo cả tiếp cận/xem/chia sẻ (nội dung
            brand) chứ không chỉ đơn/doanh thu (nội dung bán hàng).
Quyết định: (1) chien_luoc_phien_ban: chốt G1 = snapshot (định vị, tông giọng, đối tượng, pillar %); GĐ/Trưởng MKT/Admin chốt.
            (2) pillars.muc_tieu BRAND|BAN_HANG; muc_noi_dung.muc_tieu kế thừa từ pillar; chỉ tiêu tháng có theo_muc_tieu và
            ket_qua {tiep_can, luot_xem, chia_se, tuong_tac, so_don}. (3) ke_hoach_thang: máy đề xuất (deXuatKeHoach: pillar %,
            cơ cấu định dạng/kênh tháng trước, kèm ly_do từng nhóm) → người sửa → Trưởng MKT/Admin chốt; bản chốt so bản đề xuất
            = mẫu học B2. (4) muc_noi_dung: tuần trong tháng (1–6, T2–CN), máy tạo mục còn thiếu (taoMucConThieu, idempotent);
            người sửa mục máy tạo = mẫu học B3. (5) y_tuong: agent GOM_TREND (Google Trends, YouTube; chống trùng, lọc từ khoá,
            AI chấm nếu có key — không có thì không đoán); người quyết = mẫu học B1; B1 ở AI_TU_LAM tự duyệt điểm ≥ ngưỡng & không
            rủi ro claim. (6) Agent DE_XUAT_KE_HOACH (B2, ngày 25) và CHIA_TUAN (B3) chỉ chạy khi bước ở mức AI.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-23, "tiếp tục đợt 2" + yêu cầu KPI brand)
```

```
ADR-003 · 2026-09-23 · Dòng chảy nội dung: soạn 4 định dạng (B4) · thẩm định máy & duyệt G3 (B5) · tài sản & Lọc/Dựng · đăng (B9) · chế độ học thật
Bối cảnh : Tầng giữa của vòng lặp chưa có; app cũ có Studio/duyệt/đăng nhưng người kéo qua từng trang và không có mẫu học.
Quyết định: (1) noi_dung (dinh_dang bất biến, phiên bản, tao_boi NGUOI|AGENT) + duyet (G3, cham_may). (2) Guardrail claim CHẶN chặn
            ở mọi cửa (lưu, AI viết). (3) chamNoiDungMay: luật cứng (hook/CTA/thân/claim CHẶN) + luật mềm, không AI; B5 ở mức AI
            chỉ TỰ TRẢ LẠI bài trượt luật cứng, không bao giờ tự duyệt; người quyết = mẫu học B5. (4) Prompt soạn theo định dạng
            + mục tiêu brand/bán hàng + "kho ví dụ" 2 bài đã duyệt cùng định dạng/pillar. (5) Agent SOAN_NHAP (B4: AI_GOI_Y để
            nháp, AI_TU_LAM gửi duyệt — vẫn qua G3) và HOC_SOAN_NHAP (bản nháp bóng, ngân sách học riêng, giong = 0.6 chữ + 0.4
            đạt luật). (6) tai_san (R2) + công cụ Lọc/Dựng video chép nguyên, worker giữ đường cũ (/scripts/kho, /scripts/:id/video,
            /filming/upload, /scripts/ai-sinh, /nhac). (7) bai_dang: TAY|API (Graph feed/photos)|N8N (webhook + callback); agent
            DANG_BAI nhịp 15'; B9 NGƯỜI → giao việc đăng tay; video không đăng qua API. Mục giai_doan chảy theo sự kiện, đổi tay có audit.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-23, "ok tiếp tục")
```

```
ADR-004 · 2026-09-23 · Dùng chung Trạm máy văn phòng (masfico-tram) làm "tay máy" của Content OS theo hợp đồng hub1
Bối cảnh : Thiện đã có Trạm (may/ trong repo masfico-insight, chạy trên máy văn phòng, giữ phiên TikTok/Facebook/Zalo thật,
            hub cho nhiều app) và muốn "dùng chung hạ tầng đó luôn, nâng cấp thêm cho phù hợp". Worker Cloudflare không
            đăng được TikTok, không chạy ffmpeg, không đo nền tảng không API.
Quyết định: (1) Content OS là app hub1: /api/hub/ping|lenh|lenh_xong|trang_thai|nap|upload xác thực X-Hub-Key; khoá do Admin
            tạo (module_config.tram.khoa, không dán tay, không bao giờ trả ra bootstrap), mã ghép HUB1.<base64url>.
            (2) Content OS chỉ sai Trạm bằng VIEC_HUB của Trạm (chay_agent content_os/…); hàng đợi tram_lenh, gộp trùng,
            quá 30' không báo → HONG. (3) Agent "content_os" trên Trạm (3 script, không sửa tram.mjs): dang (TikTok/Facebook
            bằng hồ sơ đã đăng nhập), do_luong (đọc số tích luỹ), dung_video (ffmpeg → /hub/upload). Kết quả về bằng lô
            content_os.* → bai_dang DA_DANG/LOI, tài sản VIDEO_XUAT, tram_lo (số đo, ADR-005 dùng). (4) Lô doi_thu_tin của
            agent đối thủ → ý tưởng nguồn DOI_THU qua gomYTuong. (5) bai_dang/kenh có cách đăng TRAM; DANG_BAI: Trạm im →
            giao đăng tay. (6) Thư mục Trạm/repo đang do phiên Claude khác dùng → file ghép soạn ở v2/tram/, ghép sau; hook
            khoá thư mục ~/.claude/hooks/khoa-thu-muc.mjs chống hai phiên sửa cùng thư mục.
            Đợt "Kết quả · Báo cáo · Đề xuất (G4)" dời thành ADR-005.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-23, "dùng chung hạ tầng đó luôn, và có thể nâng cấp thêm")
```

```
ADR-005 · 2026-09-23 · Kết quả (B10) · Báo cáo (B11) · Học & đề xuất cải tiến — cổng G4 (B12)
Bối cảnh : Vòng lặp chưa khép: chưa có số đo, chưa có báo cáo, chưa có đường quay về chiến lược. Thiện: đo cả tiếp cận/xem/
            chia sẻ cho brand; báo cáo gửi app + Zalo + mail; đề xuất phải có bằng chứng.
Quyết định: (1) ket_qua: 3 mức tin cậy tách bạch (TRUC_TIEP/GIAN_TIEP/KHONG_QUY_DON — không cộng dồn; KHÔNG QUY ĐƠN không
            mang doanh thu/đơn), KPI tiep_can/luot_xem/tuong_tac/chia_se/binh_luan/luu/click + so_don/doanh_thu, nguồn
            API_KENH/TRAM/SAN/NHAP_TAY/NGOAI; số tích luỹ → ghi PHẦN TĂNG mỗi ngày (tích luỹ trong ghi_chu). (2) Agent DO_LUONG
            hằng ngày: Graph (post/video), YouTube Data, số Trạm gửi (tram_lo); TikTok → Trạm; mục → DA_DO. (3) Đối soát sàn theo
            mã theo dõi (bai_dang.ma_theo_doi) hoặc link; không khớp trả về. (4) bao_cao: số liệu luôn máy tổng hợp; nhận định AI
            chỉ khi B11 ở mức AI & có key (không thì theo luật); Trưởng MKT/Admin gửi (app + n8n → Zalo/mail); người sửa nhận định
            = mẫu học B11; AI_TU_LAM tự gửi. (5) de_xuat (G4): máy so 90 ngày theo pillar/định dạng/khung giờ, chỉ đề xuất khi mỗi
            nhóm ≥ min_mau bài và lệch ≥ 25%; Trưởng MKT/Admin/GĐ duyệt → máy áp (đổi tỷ trọng pillar → chiến lược cần chốt lại
            G1; định dạng/giờ → gợi ý hoc.goi_y); bỏ phải có lý do = mẫu học B12. (6) /ket-qua/ingest cho n8n/agent ngoài.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-23, "tiếp tục")
```

```
ADR-006 · 2026-09-23 · Gạt bước sang AI theo bằng chứng: máy đề nghị (không tự gạt), điểm gần đây, đề nghị hạ, tay máy B6
Bối cảnh : Đợt 1–5 đã có mẫu học thật chảy về mọi bước; cần cơ chế để chuyển từ "người làm, máy học" sang "gạt từng bước" đúng
            luật L1 (không bước nào tự gạt) và §3b (máy đề nghị hạ khi bị sửa/trả nhiều).
Quyết định: (1) buoc_thuc_hien thêm san_sang_gan/so_mau_gan (N ngày gần nhất) + de_nghi LEN|XUONG + lý do. (2) deNghiGat sau
            mỗi lượt chấm: LÊN khi đủ ngưỡng & mẫu (AI_GOI_Y còn cần điểm gần đây đủ), XUỐNG khi mức AI mà điểm gần đây < nguong_ha
            (60) trên ≥ mau_ha (5) mẫu; mỗi đề nghị = việc GAT_BUOC giao TRUONG_MKT (gộp trùng theo bước+hướng+mức, tự huỷ khi
            hết lý do); gạt xong đóng việc và tính lại. Máy tuyệt đối không đổi nguoi_thuc_hien. (3) Tay máy B6 HOAN_THIEN_BAI:
            post/carousel đã duyệt → bài đăng (AI_GOI_Y: CHUẨN BỊ + việc lên lịch; AI_TU_LAM: lên lịch theo ngày đăng dự kiến, giờ
            từ gợi ý G4 hoặc 19h); người sửa bản đăng/giờ khi lên lịch = mẫu học B6. (4) GET /buoc/:ma/mau: mẫu học & lịch sử gạt để
            người thấy máy học gì trước khi gạt. (5) Thứ tự gợi ý: nhóm ① B1·B5·B9·B11, nhóm ② B4·B2·B3·B6·B7; B7 chưa có tay máy
            (cần API ảnh) — bảng ghi rõ "chưa có tay máy".
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-23, "tiếp 006")
```

```
ADR-007 · 2026-09-23 · SEEDING HỘI NHÓM FACEBOOK — thay Domain A của app cũ, thiết kế mới (bản vẽ §11)
Bối cảnh : Thợ ốp lát tập trung ở hội nhóm Facebook; cần seeding truyền thông điệp định vị một cách tự nhiên. Thiện: "chỉ MKT tự
            vận hành", không Sales, không tiền, Trạm tự đăng bằng tài khoản phòng MKT, bỏ quay công trình. Chốt thêm: G3-gói giữ,
            có gói ĐỊNH KỲ, 2–5 tài khoản mỗi tài khoản một giọng.
Quyết định: (1) Ba tầng: định vị → BẢN ĐỒ THÔNG ĐIỆP (thuộc chiến lược, người/AI đề xuất, kèm dữ kiện thật & "không nói") → biến thể
            = giọng (theo tài khoản) × dạng bài (kể/hỏi/khoe/so sánh/cảnh báo) × thông điệp "đói". (2) Bước B13 soạn gói (G3-gói,
            tối đa AI tự làm), B14 xếp lịch nhóm × tài khoản trong nhóm × giờ vàng nhóm, B15 Trạm đăng (hồ sơ facebook[-n]-profile;
            NGƯỜI = giao đăng tay), B16 kiểm 2 & 7 ngày (luật cứng: bị gỡ/khớp < 70% → KHÔNG ĐẠT; trùng link/react bất thường/quá
            10 ngày → NGHI NGỜ người quyết) + bắt LEAD từ bình luận hỏi mua (giao MKT, máy không trả lời), B17 học → đề xuất G4
            (tắt nhóm bị gỡ ≥ 40%, ưu tiên giọng/thông điệp kéo tương tác+lead ≥ 1.5×). (3) Gói BAI_CHINH (bài chính mới đăng) và
            DINH_KY (chỉ tiêu ke_hoach_thang.chi_tieu.seeding_tuan, mặc định 4); máy chấm gói (claim, Kingsmen, giá, ≤30% link,
            khác nhau); trạng thái NHAP|CHO_DUYET|DUYET|TRA_LAI|HET_HAN. (4) Quy tắc nhóm (QTV duyệt → CHO_QUAN_TRI; cấm link;
            cấm bán hàng) lọc biến thể. (5) Checkpoint/captcha → tạm dừng tài khoản 24h + việc kiểm tra, không vượt. (6) Bảng
            thong_diep_seeding, tai_khoan_seeding(giong, persona), nhom_seeding(quy_tac, gio_vang, tai_khoan_ids), goi_seeding,
            bien_the(binh_luan[{vai,text}]), viec_seeding, lead_seeding. (7) Trạm: việc seeding_dang, seeding_kiem (kèm danh sách
            bình luận). (8) 007b sau: bình luận dẫn dắt đa tài khoản, lead AI phân loại, nuôi tài khoản, tự chỉnh nhịp.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-23, "thiết kế bản vẽ trước" + 3 câu trả lời) · ADR-007a ĐÃ LÀM
```

```
ADR-008 · 2026-09-24 · MÁY DỰNG GHÉP THEO TÀI KHOẢN — mã dựng video nằm ở app, máy nào cần thì ghép vào chạy
Bối cảnh : Dựng video đang là một việc của agent content_os trên Trạm Ngoc-Han: Trạm chỉ là bộ quản lý, tay máy là script ffmpeg
            chạy trên máy đó; Worker Cloudflare không chạy được ffmpeg. Thiện: "nguồn code để dựng video ở app, tài khoản nào cần
            dựng thì kết nối với máy tính đó để chạy module dựng". Trạm đầy đủ kéo theo Playwright/Zalo/AMIS — không nên cài lên máy
            nhân viên. Bản dựng nháp hiện thô: footage xoay vòng, 4s/cảnh, chữ đè, không tiếng.
Quyết định: (1) MÁY GHÉP: bảng may_ghep (id, ten, chu_user_id, khoa_hash, kha_nang[], ban, nhan_luc, trang_thai); Trạm Ngoc-Han
            cũng là một máy ghép với kha_nang [dang, do_luong, seeding_dang, seeding_kiem]; máy nhân viên có kha_nang [dung_video].
            Hợp đồng hub1 giữ nguyên, khoá xác thực trả về may_id; tram_lenh thêm may_id; /hub/lenh chỉ trả lệnh của máy hỏi.
            Mỗi người dùng ghép máy của mình ở Hồ sơ › "Kết nối máy này" (mã ghép hiện một lần, khoá chỉ lưu hash). (2) MÁY CON
            (may-dung): trình chạy rút gọn ~200 dòng Node, không Playwright, không tài khoản MXH; tải về từ app
            (/tools/may-dung/), cần Node 22 + ffmpeg (winget). Mỗi lần chạy nó hỏi /hub/script/dung_video → nhận script mới nhất
            kèm hash; script đổi ở app là mọi máy dùng bản mới; máy chỉ chạy script có hash app xác nhận. (3) ĐỊNH TUYẾN: nút
            "🎬 Dựng trên máy tôi" ở thẻ video → lệnh dung_video gắn máy của người bấm; agent B8 tự động → máy rảnh có kha_nang
            dung_video, ưu tiên máy của người phụ trách thẻ; máy im > 6' → lệnh chờ, không đổi máy nếu người chọn đích danh.
            (4) PIPELINE DỰNG v2 (008b): chọn footage theo "gợi ý hình" từng cảnh (so từ khoá với tên/mô tả tài sản, thiếu → báo
            "cảnh N thiếu hình" + việc quay bổ sung); giọng đọc tiếng Việt qua TTS gọi từ Worker (khoá ở Worker, máy con chỉ tải
            mp3) — thời lượng cảnh = độ dài câu đọc; nhạc nền từ tài sản loại NHAC do MKT duyệt, trộn −18 dB; phụ đề theo câu đúng
            nhịp giọng đọc; xuất 1080×1920 → R2 → tài sản VIDEO_XUAT + việc "xem & duyệt video nháp" (B8 giữ NGƯỜI). (5) Công cụ
            Lọc/Dựng trong trình duyệt giữ cho sửa nhanh; footage lọc và video dựng đẩy thẳng vào tài sản của thẻ. (6) Chi phí TTS
            tính vào ngân sách AI (L6), tính năng 'tts'.
Lộ trình  : 008a máy ghép + máy con + script dựng hiện tại chạy trên máy ghép · 008b pipeline dựng v2 (footage theo cảnh, TTS, nhạc, phụ đề).
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "ok đề suất" — cả 008a + 008b, TTS Google; thêm: xuất gói dựng tiếp cho CapCut) · ĐÃ LÀM
```

## Changelog

### 2026-09-24 · ADR-008 (máy dựng ghép theo tài khoản)
- **Worker**: bảng `may_ghep` (khoá chỉ lưu hash, kha_nang, nhịp tim); `tram_lenh.may_id`; `xacThucHub` nhận khoá Trạm (may_id 'tram') hoặc khoá máy con `kmay_*`; `taoLenhTram(…, mayId)`, `mayGhepSong, chonMayDung, giaoDung`; config `dung_video {tts_giong, tts_toc_do, nhac_giam_db, canh_toi_da, giay_toi_da, tts_usd_1m_ky_tu}`; hub `/hub/script/dung-video` (script + sha256), `/hub/tts` (Google TTS, khoá `GOOGLE_TTS_KEY` ở Worker, ghi ai_usage 'tts' theo ký tự), `/hub/lenh` lọc theo máy, `/hub/trang_thai` máy con, `/hub/viec/dung_video?noi_dung_id` kèm gợi ý hình + kho nhạc + cấu hình; lô `content_os.video` nhận `goi_url` (tài sản GOI_DUNG) + `thieu_hinh` → việc DUYET_VIDEO_NHAP & QUAY_BO_SUNG; endpoints `/may-ghep` (POST/DELETE), `/noi-dung/:id/dung`; agent `CHUAN_BI_DUNG` (B8, HE_THONG); tài sản loại NHAC / media_type AUDIO, FILE; bootstrap `may_ghep`, `san_sang.tts`.
- **Máy con** `v2/tools/may-dung/` (phát qua dist/tools): `may-dung.mjs` (ghép bằng mã MAY1, nhịp tim 2', hỏi lệnh 30", tải script từ app, kiểm hash rồi mới chạy), `dung-video.mjs` (pipeline v2: footage theo gợi ý hình, TTS từng câu, phụ đề đúng nhịp, nhạc nền −18 dB, gói CapCut zip bằng bsdtar, tải lên R2, lô content_os.video), `BAT-DAU.bat`, `README.md`.
- **Giao diện**: Hồ sơ › 🖥 Máy dựng của tôi (kết nối máy, mã ghép một lần, link tải máy con, gỡ); thẻ video › Sản xuất: chọn máy + 🎬 Dựng ngay, lệnh gần đây, bản nháp + 📦 Tải gói CapCut + thiếu hình; Máy › Trạm: máy dựng đã ghép + 🎵 kho nhạc nền; Cấu hình: Video nháp máy dựng.
- Test `tests/adr008.test.mjs`: 8 nhóm.

### 2026-09-23 · ADR-007a (Seeding hội nhóm Facebook)
- **Worker**: bước B13–B17; config `seeding {so_bien_the, so_ngay_lich, khoang_cach_phut, gio_vang, khop_toi_thieu, ngay_kiem, ngay_kiem_2, ngay_kiem_toi_da, goi_tu_dong_ngay, react_bat_thuong_x, tam_dung_gio, ty_le_link_toi_da, seeding_tuan_mac_dinh, thong_diep_doi_ngay, nhom_go_bai_pct}`; `lamSachChiTieu.seeding_tuan`; bảng `thong_diep_seeding, tai_khoan_seeding, nhom_seeding, goi_seeding, bien_the, viec_seeding, lead_seeding`; helpers `thongDiepDoi, soanBienThe, chamGoiMay, taoGoiSeeding, xepLichGoi, chayDangSeeding, napSeedingDang, chamSeeding, napSeedingKiem, chayHocSeeding`; agents `TAO_GOI_SEEDING (B13), XEP_LICH_SEEDING (B14), DANG_SEEDING (B15, 15'), KIEM_SEEDING (B16), HOC_SEEDING (B17, ngày 3)`; endpoints `/seeding/thong-diep[/:id] (+de_xuat_ai)`, `/seeding/tai-khoan[/:id]`, `/seeding/nhom[/:id]`, `/seeding/goi` + `/:id/(duyet|tra-lai|gui-duyet|xep-lich)`, `/seeding/bien-the/:id`, `/seeding/viec/:id/(quyet|huy|dang-ngay|da-dang)`, `/seeding/lead/:id`; hub `/hub/viec/seeding_dang|seeding_kiem`, lô `content_os.seeding_dang_ket_qua|seeding_kiem`; `apDungDeXuat` SEEDING_NHOM/GIONG/THONG_DIEP; bootstrap `seeding {giong, dang_bai, thong_diep, tai_khoan, nhom, goi, bien_the, viec, lead}`.
- **Giao diện**: màn **📣 Seeding hội nhóm Facebook** (Gói & duyệt · Lịch & việc · Nhóm · Tài khoản MKT · Lead · Nghi ngờ · Hiệu quả); Chiến lược › tab **Thông điệp seeding** (bản đồ thông điệp, ✨ máy đề xuất); Kế hoạch tháng thêm chỉ tiêu **seeding/tuần**.
- **v2/tram/**: `content-os-seeding-dang.mjs` (hồ sơ theo tài khoản, xen kẽ tài khoản, gõ chậm, chờ QTV, checkpoint), `content-os-seeding-kiem.mjs` (sống/nội dung/react/bình luận + danh sách bình luận cho lead); `agents-content_os.mjs` thêm 2 việc.
- Test `tests/adr007.test.mjs`: 10 nhóm; `adr001` cập nhật 17 bước. Tổng 56/56.

### 2026-09-23 · ADR-006 (gạt bước)
- **Worker**: cột `san_sang_gan, so_mau_gan, de_nghi, de_nghi_ly_do, de_nghi_at`; config `may {nguong_ha, ngay_gan, mau_ha}`; `tinhSanSang` tính thêm điểm gần đây; `deNghiGat` (việc GAT_BUOC cho Trưởng MKT, huỷ khi hết lý do); PATCH /buoc đóng việc & tính lại; agent `HOAN_THIEN_BAI` (THUC_HIEN/B6); mẫu học B6 ở PATCH /bai-dang; `GET /buoc/:ma/mau`; cách đăng TRAM khi tạo bài đăng.
- **Giao diện**: Máy › Bước có cột **Máy đề nghị** (⬆/⬇ + lý do + "Gạt theo đề nghị"), điểm N ngày gần nhất, nhãn nhóm ①/②, "tay máy: …" hoặc "chưa có tay máy", mở rộng **xem mẫu học** (máy vs người, điểm giống) và **lịch sử gạt**; Cấu hình › Máy thêm ngưỡng hạ / số ngày / số mẫu.
- Test `tests/adr006.test.mjs`: 6 nhóm.

### 2026-09-23 · ADR-005 (Kết quả · Báo cáo · G4)
- **Worker**: bảng `ket_qua, bao_cao, de_xuat`, `bai_dang.ma_theo_doi`; config `do_luong {so_ngay_do}`, `bao_cao {gui_n8n, ngay_bao_cao_thang}`, `hoc {min_mau, lech_toi_thieu_pct, buoc_doi_ty_trong}`; helpers `layIdBaiTuLink, doFacebook, doYouTube, ghiKetQuaTichLuy, chayDoLuong, soLieuBaoCao, nhanDinhLuat, nhanDinhAI, taoBaoCao, guiBaoCao, chayDeXuat, apDungDeXuat`; agent `DO_LUONG` (B10), `BAO_CAO` (B11: thứ Hai tuần, ngày 1 tháng), `HOC_DE_XUAT` (B12: ngày 2, chỉ khi ở mức AI); API `POST /ket-qua`, `POST /ket-qua/doi-soat`, `DELETE /ket-qua/:id`, `POST /bai-dang/:id/ma-theo-doi`, `POST /bao-cao`, `PATCH /bao-cao/:id`, `POST /bao-cao/:id/gui`, `POST /de-xuat/:id/quyet`, `POST /ket-qua/ingest` (X-App-Token); bootstrap `ket_qua (120 ngày), bao_cao, de_xuat, muc_tin_cay, nguon_kq`.
- **Giao diện**: Kết quả & Báo cáo 3 tab — **Kết quả** (3 mức, khối Brand/Bán hàng, bảng theo bài, 📡 Đo ngay, ＋ Nhập kết quả, ⬆ Import đối soát), **Báo cáo** (tạo tuần/tháng, sửa nhận định, 📤 Gửi), **Đề xuất (G4)** (bằng chứng, ✅ Duyệt & áp dụng / Bỏ kèm lý do). Việc của tôi: G4 thật.
- Test `tests/adr005.test.mjs`: 7 nhóm.

### 2026-09-23 · ADR-004 (Trạm)
- **Worker**: bảng `tram_lenh, tram_trang_thai, tram_lo`; config `tram {khoa, bat, so_ngay_do, im_lang_phut}` (validator chặn dán khoá tay); `VIEC_TRAM`, `MON_HUB`, `xacThucHub, taoLenhTram, docTramTrangThai, napLoTram`; đường hub `/hub/ping, /hub/lenh, /hub/lenh_xong, /hub/trang_thai, /hub/nap, /hub/upload, /hub/viec/dang|do_luong|dung_video`; API `POST /tram/khoa` (Admin, mã ghép), `POST /tram/lenh` (staff); `DANG_BAI` xử lý cách TRAM; kênh/bài đăng nhận `cach_dang=TRAM`; bootstrap `tram {co_khoa, bat, trang_thai(song, im_phut, phien), lenh, lo}`.
- **Giao diện**: Máy › **🖥 Trạm máy văn phòng** (trạng thái nhịp tim/phiên, 🔑 Tạo khoá & mã ghép hiện một lần, nút sai Trạm đăng/đo/dựng, lệnh & lô gần đây); Kênh và tab Đăng có lựa chọn "Qua Trạm máy văn phòng".
- **v2/tram/** (ghép vào may/ của masfico-insight khi khoá thư mục mở): `content-os-lib.mjs`, `content-os-dang.mjs`, `content-os-do-luong.mjs`, `content-os-dung-video.mjs`, `agents-content_os.mjs`, `README-GHEP.md`.
- **Máy Thiện**: hook `~/.claude/hooks/khoa-thu-muc.mjs` + sổ `~/.claude/khoa-thu-muc.json` — đã khoá thư mục Trạm và bản clone masfico-insight cho phiên khác (8 giờ).
- Test `tests/adr004.test.mjs`: 6 nhóm.
- **Đã ghép thật (23/09, sau khi phiên khác ngưng):** repo masfico-insight commit v9.154 (agent content_os + 4 script, NHOM.noi_dung); chép vào Trạm đang chạy (máy Ngoc-Han); ghép hub bằng mã HUB1 dev (localhost:5180/api) → Trạm báo "nối được", nhịp tim 🟢 về Content OS, Trạm tự đẩy 3 lô doi_thu_tin (23 tin đối thủ → ý tưởng DOI_THU). Chờ Thiện khởi động lại Trạm để nạp agent content_os. Lên Cloudflare: đặt APP_BASE_URL, tạo khoá mới, dán lại mã ghép.

### 2026-09-23 · ADR-003 (đợt 3)
- **Worker**: bảng `noi_dung, noi_dung_phien_ban, duyet, tai_san, bai_dang`; config `noi_dung {soan_nhap_toi_da_ngay, hoc_toi_da_ngay, diem_tham_dinh}`; helpers `vanBan, banDang, quetClaim, chamNoiDungMay, promptNoiDung (KHUON 4 định dạng + ví dụ đã duyệt), duyetVanBanAI, aiVietNoiDung, giongVanBan, datGiaiDoan, taoNoiDung, guiDuyet, banNhapBong, dangFacebook, dangN8n, chayDangBai`; agent `SOAN_NHAP` (THUC_HIEN/B4), `HOC_SOAN_NHAP` (HOC/B4), `DANG_BAI` (HE_THONG/B9, nhịp 15'); dieuPhoi hỗ trợ `nhip:'15p'`; API `/noi-dung/ngu-canh|ai-viet|kho`, `POST/PATCH /noi-dung`, `/noi-dung/:id/gui-duyet`, `/noi-dung/:id/video`, `/duyet/:id/quyet`, `/tai-san/upload` (R2), `POST/DELETE /tai-san`, `/ai/usage` (công cụ), `POST/PATCH /bai-dang`, `/bai-dang/:id/dang-ngay`, `/bai-dang/:id/n8n-callback`, `/muc/:id/giai-doan`; bí danh đường cũ cho công cụ video. Bootstrap thêm `noi_dung, duyet, tai_san, bai_dang`. Mô phỏng nạp thêm 2 nội dung + 1 bài chờ duyệt.
- **Giao diện**: Dòng chảy = kanban thật 6 giai đoạn + hàng đợi duyệt G3 (xếp theo điểm máy); thẻ mở popup 4 tab: ✍️ Nội dung (form theo định dạng, ✨ AI viết, 💾 Lưu phiên bản, 👁 Xem bản đăng, 📤 Gửi duyệt), 🛂 Duyệt (điểm & lý do máy, Duyệt/Trả lại kèm lý do, chặn tự duyệt, lịch sử), 🎬 Sản xuất (tải ảnh/video R2 hoặc dán link, 🎞 Lọc footage / 🎬 Dựng video popup iframe với kịch bản nạp sẵn, video xuất tự gắn), 🚀 Đăng (lên lịch kênh/giờ/cách, ▶ Đăng ngay, ✓ Đã đăng tay + link). Việc của tôi: G3 số bài chờ/tới lượt/quá 24h. Máy › Cấu hình: Nội dung (B4·B5). `v2/tools/loc-video.html` (đổi khoá token), build chép `tools/`.
- Test `tests/adr003.test.mjs`: 9 nhóm (AI viết & làm sạch, nháp/phiên bản/claim, G3 đầy đủ + mẫu B5, B5 AI tự trả lại, kho video + gắn video + tài sản, bài đăng tay/API/n8n/lỗi + B9 giao việc, SOAN_NHAP 3 mức, HOC_SOAN_NHAP, ngân sách học).

### 2026-09-23 · ADR-002 (đợt 2)
- **Worker**: bảng `chien_luoc_phien_ban, ke_hoach_thang, muc_noi_dung, y_tuong`; `pillars.muc_tieu`; hằng `MUC_TIEU, DINH_DANG, GIAI_DOAN`; helpers `tuanCuaNgay/soTuanThang/tuanCuaMuc, lamSachChiTieu, deXuatKeHoach, thieuTheoTuan, taoMucConThieu, gomYTuong, chamYTuongAI, taoMucTuYTuong, ghiMauHoc, giongChiTieu`; agent `GOM_TREND` (HE_THONG/B1), `DE_XUAT_KE_HOACH` (THUC_HIEN/B2), `CHIA_TUAN` (THUC_HIEN/B3); API `POST /chien-luoc/chot`, `POST /ke-hoach/:thang/de-xuat`, `PUT /ke-hoach/:thang`, `POST /ke-hoach/:thang/chot`, `POST /ke-hoach/:thang/tao-muc`, `GET /ke-hoach/:thang` (còn thiếu theo tuần), `POST/PATCH/DELETE /muc`, `POST /y-tuong`, `POST /y-tuong/:id/quyet`; config `trend {tu_khoa_nganh, chong_trung_ngay, nguong_tu_duyet}`, `ke_hoach {tong_bai_mac_dinh, ngay_de_xuat}`; bootstrap thêm `chien_luoc_phien_ban, ke_hoach_thang, muc_noi_dung, y_tuong, hang_so`. Mô phỏng nạp thêm ý tưởng, kế hoạch đề xuất, 3 mục.
- **Giao diện**: Chiến lược & Kế hoạch có 9 tab: Định vị (nút ✅ Chốt G1 + lịch sử phiên bản), **Kế hoạch tháng** (✨ Máy đề xuất với 🤖 lý do từng nhóm, 4 khối pillar/mục tiêu/định dạng/kênh có thực tế, KPI kết quả brand+bán hàng, 💾 Lưu, ✅ Chốt G2), **Tuần & mục** (cột tuần với "thiếu: …", 🤖 Máy tạo mục còn thiếu, thẻ mục đổi tuần, form mục đầy đủ), **Ý tưởng & trend** (điểm máy, lý do, Duyệt → mục / Bỏ kèm lý do, ▶ Gom thử, ＋ Ý tưởng của tôi), Pillar có cột Mục tiêu. Việc của tôi: G1/G2 trạng thái thật. Dòng chảy: thẻ thật từ mục nội dung tháng này. Máy › Cấu hình: Trend (từ khoá ngành, ngưỡng tự duyệt, chống trùng), Kế hoạch (tổng mặc định, ngày đề xuất).
- Test `tests/adr002.test.mjs`: 7 nhóm (G1, đề xuất/sửa/chốt + mẫu B2, tạo mục idempotent + mẫu B3, gom trend + mẫu B1, B1 AI tự làm không bịa khi thiếu key, agent đề xuất tháng sau + chốt với B3 AI).

### 2026-09-23 · ADR-001 (đợt 1)
- **Nền**: `v2/wrangler.toml` (project `kingsmen-content-os`, D1 `kingsmen-content-os-db`, R2 `kingsmen-content-os-media`, cron 15'), `build.mjs` (gộp `app/src/*.jsx` theo tên → Babel → Tailwind từ `app/tailwind.config.json`), `dev.mjs` (Worker thật + D1 giả lập `node:sqlite`, không cần wrangler), `tests/` (node --test).
- **Worker**: schema đợt 1 (`users, sessions, audit(tac_nhan), module_config, ai_usage, chien_luoc, pillars, frameworks, san_pham, claim_cam, kenh, buoc_thuc_hien, mau_hoc, agent_run, cong_viec`); seed admin `admin@kingsmen.vn/admin123` bắt đổi mật khẩu; 12 bước NGƯỜI; API: login/logout/bootstrap/me, users (ADMIN/TRUONG_MKT; chỉ Admin tạo/sửa Admin), chiến lược PUT, `/danh-muc/:bang` CRUD (tắt thay vì xoá, claim xoá thật), `/nhap/danh-muc` (Admin, upsert), `/buoc/:ma` PATCH (luật gạt), `/may/chay-thu`, `/cau-hinh/:key` PUT (validator), `/cong-viec` + xong/bỏ, `/mo-phong/nap|xoa`. Agent đăng ký: `TINH_SAN_SANG`. AI helpers (goiAI, ngân sách, ngân sách học) sẵn cho đợt 2.
- **Giao diện 5 màn**: Việc của tôi (4 cổng, việc được giao, máy hôm nay), Chiến lược & Kế hoạch (chiến lược cơ bản + 6 danh mục gốc; tab Kế hoạch mô phỏng), Dòng chảy (khung 6 giai đoạn + kanban mô phỏng + hàng đợi duyệt mô phỏng), Kết quả & Báo cáo (3 mức + báo cáo/đề xuất mô phỏng), Máy (bảng bước người/AI có luật gạt, nhật ký, chi phí AI, cấu hình, người dùng, nhập danh mục, mô phỏng).
- Test `tests/adr001.test.mjs`: 11 nhóm (seed, đổi mật khẩu, người dùng, luật gạt, điểm sẵn sàng, cấu hình, cron 1 lượt/ngày, danh mục, nhập, việc giao, mô phỏng).
