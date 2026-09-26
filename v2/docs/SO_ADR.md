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

```
ADR-009 · 2026-09-24 · BỘ NÃO AI — kết nối, chọn, quản lý, huấn luyện mô hình; mô hình mở học dần để thay API
Bối cảnh : Bộ não hiện là một hàm goiAI gọi cứng Anthropic (claude-sonnet-4-5) cho mọi việc chữ; TTS Google; lọc/dựng video chưa
            có AI (công cụ trình duyệt dùng CLIP + Whisper tại máy nhưng rời rạc, không học). Thiện: "kết nối, lựa chọn, quản lý và
            huấn luyện mô hình AI; mô hình mã nguồn mở chuyên lọc và dựng video cần huấn luyện ngày càng thông minh; ban đầu dùng
            API, mô hình mở phải học để làm tốt và tiết kiệm chi phí".
Quyết định: (1) DANH MỤC MÔ HÌNH mo_hinh (ma, ten, nha_cung_cap, loai NGON_NGU|NHIN|NGHE|TTS|ANH, cach_goi API|MAY_GHEP, gia,
            phien_ban/checkpoint R2, trang_thai, diem, so_mau) — API: Anthropic/Google/OpenAI (khoá ở Worker); MỞ: chạy trên máy
            ghép có kha_nang 'mo_hinh' (Ollama cho LLM, SigLIP/CLIP cho nhìn, Whisper cho nghe, Piper/viXTTS cho TTS) — script
            phát từ app như máy dựng. (2) ĐỊNH TUYẾN theo TÍNH NĂNG (soan_noi_dung, seeding_bien_the, cham_y_tuong, bao_cao, tts,
            loc_footage, chon_canh, cham_video…): mỗi tính năng có mô hình chính, dự phòng, ngưỡng chất lượng và MỨC như bộ quyền
            bước: API (thầy) → BÓNG (mô hình mở chạy song song, so với API/người, không dùng kết quả) → MỞ (mô hình mở tự làm, API
            chỉ dự phòng). Máy đề nghị nâng mức khi điểm ≥ ngưỡng & ≥ mẫu; Admin/Trưởng MKT gạt (không tự gạt — luật L1 cho AI).
            (3) KHO MẪU mau_hoc_ai: mỗi lượt gọi lưu đầu vào, đầu ra từng mô hình, phán quyết người (duyệt/sửa/trả, cảnh người
            chọn, clip người giữ khi lọc, bản cuối người tải lên so với bản nháp) → nhãn huấn luyện; xuất tập JSONL + khung hình
            từ R2. (4) HUẤN LUYỆN trên máy ghép có GPU (kha_nang 'huan_luyen'): lệnh huan_luyen {mo_hinh, tap_mau} → script phát
            từ app: (a) nhìn: head trên embedding SigLIP/CLIP (linear/LoRA) học "footage nào khớp gợi ý hình", "clip nào là clip
            chuẩn", "cảnh nào thợ xem lâu" — rẻ, chạy được CPU; (b) ngôn ngữ: LoRA Qwen/Gemma trên bài đã duyệt + lý do trả; (c)
            TTS: chọn giọng mở tiếng Việt, người chấm; checkpoint → R2 → phiên bản mới → ĐÁNH GIÁ trên tập kiểm giữ lại (điểm
            khớp người) → người duyệt bật (cổng G4) → ai_usage ghi mo_hinh_id để so chi phí API vs mở. (5) Guardrail sau đầu ra
            (claim, dữ kiện, JSON) áp cho MỌI mô hình; mô hình mở không bao giờ được bỏ qua cổng người. (6) Màn Máy › Bộ não AI:
            Mô hình (kết nối, thử, giá) · Định tuyến (tính năng × mức × điểm × mẫu) · Huấn luyện (kho mẫu, phiên, đánh giá, bật)
            · Chi phí (theo mô hình, tiết kiệm so API).
Lộ trình  : 009a danh mục + định tuyến + ai_usage theo mô hình + máy ghép chạy mô hình mở (Ollama/SigLIP/Whisper) + chế độ BÓNG cho
            loc_footage/chon_canh & cham_y_tuong · 009b kho mẫu + huấn luyện head nhìn + đánh giá + bật MỞ cho lọc/chọn cảnh ·
            009c LoRA ngôn ngữ + TTS mở.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, 009a + 009b; huấn luyện trên GPU thuê khi cần, suy luận CPU) · ĐÃ LÀM 009a+b
```

```
ADR-009c · 2026-09-24 · BỘ NÃO AI (phần 3) — mô hình mở TỰ LÀM cho ngôn ngữ, giọng đọc mở, Whisper lọc footage, LoRA trên GPU thuê
Bối cảnh : 009a+b đã có định tuyến, bóng, kho mẫu, đầu nhìn. Ngôn ngữ mở mới dừng ở BÓNG vì Worker không gọi được máy ghép đồng bộ;
            TTS vẫn trả tiền Google; lọc footage chưa có AI. Thiện: "mô hình mã nguồn mở cần học để làm tốt và tiết kiệm chi phí".
Quyết định: (1) HÀNG ĐỢI AI (ai_viec): tính năng ngôn ngữ ở mức MỞ → Worker không gọi API mà tạo việc {tinh_nang, dau_vao, doi_tuong}
            + lệnh mo_hinh_chay cho máy ghép có Ollama; máy trả /hub/ai-xong; agent điều phối (15') nhận kết quả và đi tiếp đúng
            như API (soạn nháp → taoNoiDung, chấm ý tưởng → điểm, biến thể seeding → gói, báo cáo → nhận định); guardrail
            duyetVanBanAI/claim áp y hệt. Người bấm ✨ ở mức MỞ: app trả "máy ghép đang viết", màn tự hỏi lại 5 giây/lần rồi đổ vào
            form. Máy im quá ai.cho_may_phut (mặc định 10) → tự rơi về API dự phòng và ghi mẫu "mở trễ" (điểm hạ). (2) HUẤN LUYỆN
            NGÔN NGỮ: /hub/tap-mau?tinh_nang=soan_nhap_agent xuất cặp (system, user, bài người đã duyệt + bài máy bị trả kèm lý do)
            dạng JSONL; script huan-luyen-ngon-ngu (Python/unsloth) chạy trên GPU thuê (RunPod/Colab) → LoRA Qwen2.5-7B → GGUF →
            Ollama model kingsmen-qwen:vN → máy con gửi /hub/mo-hinh/phien-ban với đánh giá = giống trung bình trên tập KIỂM so
            với bài người → Trưởng MKT duyệt → mo_hinh.model_id đổi sang bản mới. (3) TTS MỞ: Piper tiếng Việt chạy trên máy con
            (tải giọng một lần); tính năng tts mức BÓNG = máy sinh cả Google và Piper, gói CapCut có thư mục giong-mo/, người nghe
            và chấm "dùng được / không" ở Sản xuất → mẫu; MỞ = dùng Piper, Google dự phòng; tiết kiệm toàn bộ phí TTS. (4) LỌC
            FOOTAGE (loc_footage): máy con chạy Whisper base trên footage thô → lời + mốc thời gian; kết hợp điểm CLIP theo gợi ý
            hình → đề xuất đoạn cắt "chuẩn" cho từng bước kịch bản; BÓNG so với đoạn người giữ trong công cụ Lọc (công cụ gửi
            lựa chọn người về app thay vì chỉ lưu cục bộ); đủ mẫu → huấn luyện đầu loc_footage như chon_canh. (5) Chi phí: bảng
            "tiết kiệm so với API" theo tháng ở Bộ não AI › Chi phí (số lượt MỞ × giá API tương đương).
Lộ trình  : 009c-1 hàng đợi AI + MỞ ngôn ngữ + tiết kiệm · 009c-2 TTS Piper (bóng → mở) · 009c-3 Whisper lọc footage + công cụ Lọc gửi mẫu
            · 009c-4 xuất tập mẫu + script LoRA cho GPU thuê + nhận phiên bản Ollama.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "ADR-009c cả 4 bước") · ĐÃ LÀM
```

```
ADR-010 · 2026-09-24 · MÁY HỌC CHỌN & GHÉP SOURCE — chỉnh ghép, phân tích đoạn, mô hình chọn đoạn/ghép, kho video thành phẩm (Drive · máy · TikTok)
Bối cảnh : Video Keo chít mạch dựng từ 15 clip Drive: máy mới chọn "clip nào cho cảnh nào" (ADR-009 chon_canh), còn cắt ở giây 0, một
            cảnh một clip, clip lặp; không học được cách người dựng tay. Thiện: "cần có mô hình huấn luyện cách chọn và ghép source",
            "hiện tại tôi có nhiều video đã sản xuất thủ công làm kho huấn luyện", "có sẵn ở tiktok / reel / drive / thư mục local",
            "cả tiktok nữa nhé", "có lượt xem cũng là một cách học hiệu quả".
Quyết định: (a) CHỈNH GHÉP: máy dựng báo kế hoạch ghép (mỗi cảnh = chuỗi shot {clip, giây vào, giây ra}) → bảng ghep_video nguồn MAY;
            màn Sản xuất › ✂️ Chỉnh ghép cho người đổi clip, cắt giây, thêm/bớt/đảo shot → POST /noi-dung/:id/ghep lưu bản NGUOI, so
            máy↔người thành mẫu chon_canh (đổi clip) · chon_doan (cửa sổ người giữ trên clip) · ghep_canh (độ dài shot) rồi giao máy
            dựng đúng bản người (ghep_id). (b) PHÂN TÍCH FOOTAGE (script phan-tich, một lượt ffmpeg fps=2): mỗi 0,5 s → nét
            (blurdetect), động (scdet), sáng (signalstats) + 3 khung → Claude Haiku mô tả & xếp CỠ CẢNH (RONG/TRUNG/CAN/SAN_PHAM/
            THAO_TAC/NGUOI_NOI/CHU) → tai_san.phan_tich; nạp Drive làm sẵn, footage cũ chạy lệnh phan_tich_footage. (c) HAI MÔ HÌNH
            MỞ chạy CPU: chon_doan = logistic trên cửa sổ [nét, động, sáng, vị trí, gần 30% đầu, động×nét] (mở: doan-tuyen-tinh);
            ghep_canh = thống kê có trọng số: độ dài shot trung vị/15%/85% + ma trận chuyển cỡ cảnh (mở: ghep-thong-ke). Máy dựng:
            shot đầu = clip đã chọn, shot sau = clip khớp tiếp theo chưa dùng, độ dài theo ghep_canh, đoạn theo chon_doan (MỞ) hay
            luật nét+động (API/BÓNG); cùng cổng G4 duyệt phiên bản như ADR-009. (d) KHO VIDEO THÀNH PHẨM (kho_thanh_pham): Trưởng MKT
            dán link thư mục Drive / đường dẫn thư mục máy dựng / kênh TikTok @tenkenh ở Bộ não AI › Huấn luyện. Máy dựng (script
            hoc-thanh-pham) cắt shot bằng scdet, khung giữa shot → Claude xếp cỡ cảnh, Whisper nghe lời từng shot (nếu có), dò clip
            gốc bằng chữ ký ảnh 16×16 (thư mục con goc/source) → POST /hub/thanh-pham → mẫu ghep_canh (luôn), chon_canh (lời ↔
            khung), chon_doan (khớp gốc). TikTok: Trạm (việc content_os/tai_tiktok, hồ sơ tiktok_cn) tải mp4 + LƯỢT XEM + ngày
            vào D:\may-dung\thanh-pham\tiktok\<kênh> kèm _meta.json → /hub/tiktok-da-tai → máy dựng học. LƯỢT XEM = TRỌNG SỐ MẪU:
            log10(xem+10)/log10(trung vị cùng kênh+10) kẹp [0,4; 2,5]; không có lượt xem (Drive/máy/chỉnh ghép) = 1, không ghi 0.
Đánh đổi  : Chỉnh ghép bằng số giây thay vì kéo thả (375 dùng được, ít mã); scdet bỏ lỡ chuyển cảnh mờ (fade) → shot dài hơn thật;
            dò clip gốc chỉ đúng khi thành phẩm không đổi màu/crop mạnh; TikTok tải qua phiên đăng nhập, TikTok đổi giao diện thì
            việc báo lỗi rõ chứ không bịa; Whisper tuỳ máy có transformers.
Lộ trình  : 010a chỉnh ghép + mẫu · 010b phân tích đoạn + cỡ cảnh · 010c hai mô hình + máy dựng ghép theo shot · 010d kho thành phẩm
            Drive/máy/TikTok + trọng số lượt xem.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "Duyệt cả 010a + 010b + 010c"; 010d: "cả tiktok nữa nhé", "có lượt xem
            cũng là một cách học hiệu quả") · ĐÃ LÀM (chưa đo trên video thật — xem changelog)
```

```
ADR-011 · 2026-09-24 · KALODATA — tài khoản trên Trạm, agent quét video bán chạy, kho thành phẩm theo doanh thu, học kịch bản bán hàng
Bối cảnh : ADR-010d học từ video thành phẩm của mình và kênh TikTok (lượt xem). Thiện: "tôi muốn máy trạm thêm tài khoản kalodata và các
            agent để học video và kịch bản hiệu quả bán hàng" — Kalodata (SaaS trả phí) có bảng video TikTok Shop theo ngành hàng với
            doanh thu, lượt bán, lượt xem, sản phẩm; doanh thu là thước đo "hiệu quả bán hàng" tốt hơn lượt xem.
Quyết định: (1) TÀI KHOẢN `kalodata` trên Trạm (masfico-insight v9.164): thẻ chỉ đăng nhập (dang-nhap-chung, hồ sơ kalodata-profile,
            Trạm không giữ mật khẩu); nền tảng "Kalodata" trong sổ tài khoản; cấp mặc định cho nhân viên content_os:dang_do vai kiem.
            (2) AGENT content_os/kalodata_video (lịch ngày 06:40, chỉ chạy khi app nói đến hạn: tự động mỗi ~7 ngày khi có ngành hàng,
            hoặc chủ bấm Quét ngay): hỏi /hub/viec/kalodata → mở kalodata.com/video bằng hồ sơ kalodata → lọc từng ngành → bảng đã
            xếp theo doanh thu → đọc top N (tiêu đề, kênh, doanh thu, lượt bán, lượt xem, sản phẩm, ngày) → mở chi tiết lấy link
            tiktok.com → POST /hub/kalodata. Ô còn **** (chưa đăng nhập / hết gói) → báo lỗi rõ, không bịa. (3) APP xếp các link vào
            hàng đợi tai_tiktok (kenh 'kalodata:<ngành>', nguon KALODATA, meta doanh thu) → Trạm tải bằng tiktok_cn (việc tai_tiktok
            nhận danh sách link) → /hub/tiktok-da-tai nguon KALODATA → máy dựng hoc-thanh-pham: cắt shot, Whisper nghe lời, cỡ cảnh;
            kho_thanh_pham thêm doanh_thu, luot_ban, san_pham, kich_ban (lời thoại ghép lại). TRỌNG SỐ MẪU: có doanh thu thì dùng
            doanh thu (×100 rồi so log với trung vị cùng kênh), không thì lượt xem, không có gì = 1. (4) HỌC KỊCH BẢN BÁN HÀNG:
            angleFootage (lời dặn AI viết kịch bản VIDEO) kèm 3 kịch bản bán tốt nhất theo doanh thu, luật "chỉ học cấu trúc: mở đầu
            3 giây, vấn đề, bằng chứng, chốt đơn; không chép câu, không nhắc shop/sản phẩm/giá"; /hub/tap-mau-ngon-ngu
            (soan_nhap_agent) thêm mỗi kịch bản bán tốt thành một mẫu DUYỆT (lý do = doanh thu) cho LoRA ADR-009c. (5) MÀN: Bộ não
            AI › Huấn luyện › Kho thành phẩm › khối Kalodata (ngành hàng, top N, tự quét tuần, Quét ngay, kết quả lần cuối); bảng kho
            thêm cột Doanh thu và dấu 🗣 có lời thoại.
Đánh đổi  : Kalodata đổi giao diện thì việc quét báo lỗi chứ không tự sửa (đo 24/09: bảng là <table> thứ 2, cột 2 tiêu đề, 3 kênh, 4 doanh
            thu, 5 sản phẩm, 6 lượt bán, 8 lượt xem, 15 ngày; link TikTok lấy ở trang chi tiết — chưa kiểm được vì cần đăng nhập);
            dùng gói Kalodata của công ty đúng điều khoản (chỉ đọc bảng, top N ≤ 50/ngành/tuần); lời thoại Whisper base có sai chính tả
            → chỉ làm tham chiếu cấu trúc, không làm câu chữ.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "Duyệt, làm cả 4 phần") · ĐÃ LÀM (chưa quét thật — chờ đăng nhập Kalodata trên Trạm)
```

```
ADR-012 · 2026-09-24 · KIẾN TRÚC HUẤN LUYỆN — mẫu có nhãn dòng sản phẩm / mục đích, bản chung + bản riêng theo phạm vi, màn Huấn luyện 5 khối
Bối cảnh : Sau ADR-010/011 có 7 đầu học nhưng màn Huấn luyện "quá cơ bản" (Thiện), nạp ngành Kalodata xong không thấy tiến trình, và câu hỏi
            "có 2 dòng sản phẩm thì có nên huấn luyện chuyên sâu cho mỗi dòng, hoặc cho từng mục đích không". Mô phỏng
            docs/huan-luyen-mo-phong.html (artifact 82ScBu38fYWWEJ7Nv3HcQ4) duyệt 24/09 "Duyệt cả màn lẫn kiến trúc".
Quyết định: (1) NHÃN MẪU: mau_hoc_ai + dong (san_pham.dong) + muc_dich (BAN_HANG|BRAND). Mẫu sinh từ bài tự suy nhãn: bài → mục kế hoạch →
            sản phẩm.dong + muc_tieu (phamViCua); mẫu từ kho thành phẩm lấy nhãn người nạp (kho_thanh_pham + dong, muc_dich; mọi cửa nạp
            Drive / máy / TikTok / Kalodata hỏi nhãn; gắn lại nhãn → mẫu đổi theo; loại video → xoá mẫu). (2) PHẠM VI: 'chung' |
            'dong:<dòng>' | 'muc_dich:<mục đích>'. Mỗi tính năng luôn có bản chung. /ai/huan-luyen {tinh_nang, pham_vi} đếm mẫu trong
            phạm vi (≥ 10), lệnh huan_luyen mang pham_vi, máy lọc /hub/tap-mau?pham_vi, phiên bản gửi lên mang pham_vi. Duyệt bản riêng
            KHÔNG đè checkpoint bản chung. Máy dựng tra /hub/mo-hinh/:tn?dong=&muc_dich= (việc dựng mang pham_vi của bài): bản riêng
            chỉ dùng khi điểm kiểm ≥ điểm bản chung đã duyệt + 3; không thì bản chung. (3) LOẠI ĐẦU HỌC: nhìn (chọn cảnh, lọc clip, chọn
            đoạn, ghép) = CLIP đóng băng + đầu nhỏ, tách theo dòng rẻ → làm ngay; ngôn ngữ (soạn kịch bản, chấm ý tưởng) = LoRA Qwen 7B
            trên GPU thuê, một nền + adapter theo phạm vi khi ≥ 60 mẫu (xuất tập mẫu ?pham_vi; kịch bản bán tốt nằm sẵn trong tập),
            trước đó điều kiện hoá bằng lời dặn; nghe/đọc (Whisper, Piper) không huấn luyện. (4) MÀN HUẤN LUYỆN 5 khối: mô hình đang học
            (mức, mẫu có/cần theo phạm vi, điểm, bản riêng đã duyệt, chọn phạm vi rồi 🎓), bốn cửa nạp có nhãn, tiến trình (tram_lenh
            huan_luyen/hoc_thanh_pham/phan_tich_footage/nap_drive + chay_agent tai_tiktok/kalodata_video, kết quả nguyên văn), kho mẫu
            (lọc nguồn/dòng/lời thoại, gắn nhãn, loại), phiên bản chờ duyệt có nhãn phạm vi.
Đánh đổi  : mo_hinh.diem vẫn bị tinhDinhTuyen tính lại theo bóng → so sánh bản riêng dùng điểm kiểm của phiên bản chung đã duyệt; nhãn
            mục đích chỉ có khi mục kế hoạch đặt mục tiêu; adapter ngôn ngữ theo dòng là lộ trình (chưa đủ mẫu).
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24) · ĐÃ LÀM (bản riêng chưa có phiên bản thật — kho mới có 0 video)
```

```
ADR-013 · 2026-09-24 · LỚP HỌC CỦA MÁY — một ô nạp, bốn kỹ năng nói tiếng người, máy tự học khi đủ mẫu, xem thử rồi bật
Bối cảnh : Thiện: "quy trình và UI huấn luyện AI tôi thấy khó hiểu và không thuận tiện chưa tối ưu". Màn ADR-012 bắt người hiểu mức
            API/BÓNG/MỞ, phạm vi, mẫu có/cần, phiên bản chờ duyệt, 7 tính năng, 4 cửa nạp × 3 ô. Mô phỏng docs/lop-hoc-mo-phong.html
            (artifact BmkTz1uvALqJPUhn3n2qq9) duyệt 24/09.
Quyết định: (1) NẠP MỘT Ô: POST /lop-hoc/nap {nap, dong?, muc_dich?, toi_da?} tự nhận loại (Drive / thư mục máy / @kênh TikTok / ngành
            Kalodata) rồi chuyển nội bộ cho tuyến sẵn có; {chi_nhan:true} chỉ trả loại để màn hỏi "về sản phẩm nào" bằng nút bấm (bỏ qua
            được). (2) BỐN KỸ NĂNG (KY_NANG): Chọn cảnh, Cắt ghép, Viết kịch bản, Giọng đọc; bootstrap ai_nao.ky_nang tóm tắt mỗi kỹ năng:
            trạng thái GOM | DU_MAU | DANG_HOC | MOI | NHA, số mẫu/cần, bản mới (điểm, ví dụ), bản đang dùng, bản riêng theo dòng.
            (3) MÁY TỰ HỌC: tuHoc(env) chạy theo cron (mỗi lượt điều phối) và nút "Học ngay": tính năng NHÌN có ≥ min_mau mẫu nhãn, không
            có phiên bản chờ duyệt, không có lệnh đang học, đã thêm ≥ 10 mẫu từ lần trước → lệnh huan_luyen chung; mỗi dòng đủ min_mau →
            bản riêng. Sổ lop_hoc.da_hoc ghi lần học gần nhất. (4) XEM THỬ: máy huấn luyện gửi danh_gia.vi_du (6 cảnh kiểm: người chọn /
            bản mới / quy tắc cũ) → màn hiện ba ảnh cạnh nhau. (5) BẬT / TẮT: POST /lop-hoc/bat {tinh_nang, phien_ban_id?} = duyệt phiên bản
            chờ (nếu có) + gạt MỞ, điều kiện điểm lấy từ phiên bản chung đã duyệt (≥ dinh_tuyen.nguong), không lấy mo_hinh.diem (bị tính
            lại theo bóng); /lop-hoc/tat = về API. (6) MÀN: tab "🎓 Lớp học" = Nạp · Kỹ năng · Nhật ký (audit + lệnh) · Kho video; màn
            ADR-012 gấp thành "Chi tiết kỹ thuật". Cổng G4 giữ nguyên: máy chỉ học và trình, người bật.
Đánh đổi  : Kỹ năng "Viết kịch bản" và "Cắt ghép" gộp nhiều tính năng nội bộ → số mẫu hiện là số gần đúng (kịch bản: mẫu duyệt + kịch bản
            bán tốt; cắt ghép: video thành phẩm); ngôn ngữ chưa tự học (LoRA cần GPU, làm tay theo hướng dẫn trong phần kỹ thuật).
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "Duyệt, làm theo mô phỏng") · ĐÃ LÀM
```

```
ADR-014 · 2026-09-24 · MÁY HIỂU TỪNG ĐOẠN HÌNH THEO QUY TRÌNH THI CÔNG
Bối cảnh : Thiện: "các sản phẩm của tôi là vật liệu với quy trình thi công kỹ thuật khá phức tạp và độ thẩm mỹ hoàn thiện nên tôi muốn mô hình
            AI hiểu được từng khung hình để có thể lựa chọn cắt ghép phù hợp với kịch bản và lời thoại". Trước đó máy chỉ nhìn 3 khung/clip
            (Claude Haiku) và CLIP so chữ–hình chung chung → chọn đúng clip nhưng không đúng giây.
Quyết định: (a) san_pham.quy_trinh (mỗi dòng một bước, đúng thứ tự). Máy học (Q2, qwen2.5vl:7b qua Ollama, không phí) đọc 1 khung/giây
            (tối đa 40) → bước (chọn trong quy trình chuẩn, không có thì bộ bước chung), hành động, vật liệu, cỡ cảnh, thẩm mỹ 0–10, nét 0–10,
            có người, mô tả; làm mượt cửa sổ 3 giây; gộp thành đoạn → tai_san.phan_tich.timeline (+ vl {model, so_khung, ms_khung}).
            Tuyến /muc/:id/doc-khung, hub /hub/viec/doc_khung + /hub/doc-khung; lệnh đi qua phan_tich_footage {doc_khung} → script doc-khung.
            (b) gắn nhãn kịch bản + chọn đoạn theo bước/thẩm mỹ, (c) học từ sửa của người — gộp vào ADR-015 (M2, M3, M1).
Đo thật  : RTX 3070 Ti ≈ 2,4 s/khung; clip 5 s ≈ 12 s. Cảnh bao bì tĩnh bị nhảy nhãn giữa các giây → thêm làm mượt (74258fb).
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "Duyệt cả 014a + 014b + 014c") · 014a ĐÃ LÀM (a99d85d, 74258fb)
```

```
ADR-015 · 2026-09-24 · KIẾN TRÚC HỌC VIDEO THI CÔNG — đúng kỹ thuật và đẹp, học từ video Kingsmen đã air
Bối cảnh : Thiện: "cần thiết kế kiến trúc học phù hợp đặc thù sản phẩm để tạo ra video đúng chuẩn và đẹp"; "hiện tại tôi đã sản xuất và air
            rất nhiều video dựng thủ công, đây có thể là nguồn huấn luyện hữu ích nhất". Bản thiết kế docs/kien-truc-hoc.html (artifact
            G7b31HbDaE5K8MRRLWG9kd).
Quyết định: Năm chỉ số: đúng trình tự (100%, luật cứng), khớp lời (≥ 85% câu), thẩm mỹ cảnh chốt (≥ 8/10), nét ≥ 6 và lệch nhịp ≤ 20%,
            điểm tái dựng video đã air. Bốn tầng dữ liệu: vàng = video đã air + clip gốc; bạc = footage đã đọc (ADR-014a); đồng = video bán
            chạy ngoài (chỉ cấu trúc bán hàng); sửa của người. Năm phần máy: M1 đọc hình (qwen2.5vl; học: ví dụ sửa trong lời nhắc, tinh chỉnh
            khi ≥ 300 nhãn); M2 đọc lời (qwen2.5 7B: câu → ý + bước, tập đóng; học từ câu nói lúc shot chiếu bước nào); M3 ghép câu–đoạn
            (xếp hạng 6 đặc trưng: khớp bước, khớp ý, thẩm mỹ, nét, đủ dài, chưa dùng; học từ video đã air có clip gốc + Chỉnh ghép);
            M4 nhịp (ADR-010 ghep_canh, mở rộng theo ý/bước); M5 kiểm định (luật cứng: đảo bước, thiếu bước bắt buộc, đoạn mờ, cảnh chốt
            xấu, lặp clip). Chuẩn vàng: giữ 20% video đã air có clip gốc, dựng lại từ clip gốc, so từng shot với người; bản mới chỉ đề nghị bật
            khi điểm tái dựng cao hơn.
Thứ tự   : 1 M5 · 2 M2 · 3 M3 · 4 bộ đề tái dựng · 5 M1 học từ sửa nhãn.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "ok duyệt") · ĐANG LÀM
```






```
ADR-007b · 2026-09-24 · SEEDING NÂNG CAO — bình luận dẫn dắt đa tài khoản, lead AI phân loại, nuôi tài khoản, tự chỉnh nhịp
Bối cảnh : 007a đã có gói → lịch → Trạm đăng → kiểm/lead từ khoá → học. Bản vẽ §11.9 để lại 007b. Thiện: "tiếp tục 007b".
Quyết định: (1) BÌNH LUẬN DẪN DẮT: bài lên (có link) → máy lên lịch N bình luận (mặc định 2) cho N tài khoản KHÁC người đăng đang ở
            trong nhóm, theo vai trong biến thể (hỏi kinh nghiệm / xác nhận / hỏi mua — nhóm cấm bán hàng thì bỏ hỏi mua), giãn
            30–180 phút, không trùng; tới giờ Trạm bình luận (việc seeding_binh_luan), B15 NGƯỜI → giao tay; lỗi thử lại 1 lần;
            checkpoint → tạm dừng tài khoản. (2) LEAD AI: bình luận dưới bài (bỏ bình luận của chính tài khoản seeding) → một lượt
            AI (tính năng phan_loai_lead, Haiku) phân loại HOI_MUA | HOI_GIA | HOI_KY_THUAT | TIEU_CUC | KHAC + mức 1–3 + gợi ý trả
            lời tự nhiên (không giá, không bịa); tiêu cực → việc XU_LY_TIEU_CUC; không AI → từ khoá; người vẫn trả lời. (3) NUÔI TÀI
            KHOẢN: mỗi ngày mỗi tài khoản sống có nhóm 1 lượt (giờ ngẫu nhiên 8–21h, tránh giờ đăng ±90'): Trạm mở nhóm cuộn xem
            N phút, thả N tim, không bình luận/đăng → suc_khoe.nuoi_so. (4) TỰ CHỈNH NHỊP: HẠ thì máy tự làm có audit + báo Trưởng
            MKT (tài khoản ≥ 2 checkpoint/30 ngày → nhip_ngay −1 & dừng 72 giờ; nhóm bị gỡ ≥ 2 bài/30 ngày → nhip_tuan −1, một lần/
            tháng); TĂNG phải qua G4 (nhóm ≥ 8 bài đạt, 0 gỡ, react tb ≥ 5 → đề xuất SEEDING_NHIP). Công tắc seeding.nhip_tu_chinh.
            (5) Bảng binh_luan_seeding, nuoi_seeding; lead_seeding thêm loai, muc_do, goi_y. (6) Trạm: việc seeding_binh_luan,
            seeding_nuoi (v9.156).
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "tiếp tục 007b") · ĐÃ LÀM
```

```
ADR-016 · 2026-09-24 · NHẬN DIỆN KHUNG HÌNH ĐANG NÓI VỀ GÌ — nền cho mọi phần thông minh, đo trên nhãn người
Bối cảnh : Thiện: "cần thiết kế kiến trúc để mô hình nhận diện chính xác khung hình đang nói về gì … đây là cơ sở cho mọi sự phát triển
            thông minh hơn … ngoài nhận diện chính xác mới tới tiêu chuẩn thẩm mỹ và chất lượng source". Đo thật 24/09 (video
            "ĐỊNH VỊ _GIÁ TRỊ CÔNG TRÌNH", 44 shot): qwen2.5vl gán gần hết THI_CONG với tự khai chắc 1,0 — sai cho video định vị;
            whisper-base nghe tiếng Việt kém ("KISSMAN", "đeo chứt mặt"). Bản vẽ: docs/kien-truc-nhan-dien.html.
Quyết định: (1) THỨ TỰ: nhận diện nội dung (nhóm cảnh → bước/bài test) trước; thẩm mỹ và chất lượng source chỉ sau khi nhận diện đạt.
            (2) KHÔNG TIN SỐ TỰ KHAI: can_xac_nhan khi đoạn ngắn < 2 dải, bị Viterbi sửa, hoặc tu_tin < 0,6. (3) NHÃN VÀNG: màn Bộ não
            AI › 👁 Nhãn hình — phím 1–8 nhóm, 1–9 bước/bài test, Enter đồng ý máy, 0 hình không rõ (không thành mẫu), → bỏ qua; hàng
            đợi GET /nhan-hinh/hang lấy cả footage lẫn video thành phẩm, đoạn máy chưa chắc trước, cứ 4 đoạn xen 1 đoạn ngẫu nhiên.
            (4) BẢNG ĐO: độ chính xác trên MẪU NGẪU NHIÊN là con số thật; kèm theo nhóm, cặp nhầm, mức tự khai, theo nguồn.
            (5) CỔNG: chưa dùng nhãn máy để huấn luyện khi chưa có ~200 nhãn vàng và chưa đạt 80% đúng nhóm trên mẫu ngẫu nhiên.
            (6) ĐẦU VÀO TỐT HƠN: dải 3 khung 448px (từ 320), ảnh giữa mỗi đoạn tải lên kho để người nhìn; video thành phẩm đọc kèm
            mô tả bài đăng TikTok + lời thoại cả video làm ngữ cảnh; Whisper small (dự phòng base), nghe cả video một lần có mốc giờ.
            (7) Học lại video thành phẩm giữ nhãn người (mẫu nhan_khung không bị xoá); gán lại một đoạn thay mẫu cũ, vẫn so với nhãn máy gốc.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "tiếp tục" sau đề xuất làm màn gán nhãn + bảng đo) · ĐÃ LÀM phần 1
```

```
ADR-017 · 2026-09-24 · TRIỂN KHAI HUẤN LUYỆN SONG SONG VÀ CUỐN CHIẾU — khuôn làn sáu chặng, Bàn huấn luyện
Bối cảnh : Thiện: "thiết kế kiến trúc và ui để có thể triển khai song song và cuốn chiếu". Bản vẽ docs/kien-truc-trien-khai.html.
Quyết định: (1) Sáu làn K1 nhận diện · K2 source · K3 thẩm mỹ · K4 đọc lời · K5 ghép và nhịp · K6 kiểm kỹ thuật, cùng khuôn
            Gom → Thầy gán → Người → Đo → Bóng → Bật; cổng bằng số, cổng Bật do người duyệt. (2) Làn sau mở khi làn trước tới Bóng.
            (3) Mỗi làn tính riêng từng dòng sản phẩm (bản chung + bản riêng). (4) Một hộp việc cho người, trần phút/ngày (mặc định 20).
            (5) Trần riêng cho thầy Claude (ai.ngan_sach_thay_usd, mặc định 20 USD/tháng). (6) CHƯA tách việc học sang Ngoc-Han:
            đo thời gian từng chặng trước (Trạm chạy trên Ngoc-Han, tách có rủi ro); chỉ tách khi tải/cắt/nghe chiếm phần lớn.
            (7) Huấn luyện chỉ trên Q2; mô hình một nguồn, có phiên bản trong kho app.
Người duyệt: Thiện · Trạng thái: ĐÃ DUYỆT (2026-09-24, "ok bạn quyết đi") · ĐÃ LÀM đợt A
```

## Changelog

### 2026-09-26 · Nguồn học (Bộ não AI › 📥 Nguồn học) · dòng một nguồn ở danh sách video cũ · ffmpeg máy con có hạn giờ
- Chủ: "nguồn dữ liệu học đang quản lý ở đâu" · "cần có ui quản lý nguồn dữ liệu học".
- `GET /nguon-hoc` (mau.js `nguonHoc`): gom `kho_thanh_pham` theo nguồn — TikTok theo kênh, Drive theo thư mục gốc + thư mục con cấp 1, Kalodata theo ngành, máy dựng theo thư mục; footage (`tai_san`) theo mục. Mỗi nguồn: số video, phân bố dòng (kể cả chưa có), đoạn hình / % có ảnh / % nhãn thầy / nhãn người, câu thoại / % nghe sai, % bản xem, lần học cuối, danh sách video, chuỗi `nap` để học thêm. Kèm 30 lệnh học gần nhất và nhịp tim các máy (sống nếu < 6 phút).
- Giao diện `NguonHoc` (86-nhanmau.jsx): 5 số tổng, dải trạng thái máy học (đỏ khi không máy nào sống), ô nạp nguồn (chuyển từ tab Mô hình sang), bảng nguồn lọc theo loại (PC bảng, điện thoại thẻ), mỗi nguồn: ＋ Học thêm video mới (`/lop-hoc/nap`), gán dòng cả nguồn (`/mau-doan/dat-dong` với `doi_tuong_ids`), xem video.
- Sửa: `PATCH /kho-thanh-pham/:id` đổi dòng giờ đổi cả `mau_doan.dong` (trước chỉ đổi video, mẫu giữ dòng cũ).
- Máy con: mọi lệnh ffmpeg trong hoc-thanh-pham / nap-drive / phan-tich có `timeout` (sự cố 26/09: Máy VP Q2 im từ 07:01 khi đang học — `spawnSync` không hạn giờ chặn cả nhịp tim lẫn nhận lệnh).
- Test 018k. Kiểm Playwright 1440 / 390: không tràn ngang, gán dòng cả nguồn cập nhật ngay.

### 2026-09-26 · Claude duyệt / gán thay chủ · tự gán dòng · tạo tên chuẩn khi gộp
- Chủ: "xổ chọn không có thì có tạo thêm được không" · "dòng sản phẩm ở bộ nhãn chưa đủ" · "bạn trực tiếp xử lý thay tôi việc gán nhãn và duyệt nhãn".
- Ô gộp có "＋ tạo tên chuẩn mới": đổi tên đề xuất rồi duyệt, mẫu đổi theo. Ô dòng ở hàng đề xuất dùng danh sách dòng đầy đủ.
- Cron `tuGanDong`: video đã đăng chưa có dòng → đếm vật liệu thầy / người nhận ra + chữ trong tên / lời thoại (≥ 2 điểm, ≥ 70%) → gán dòng; không rõ thì để người.
- Hàng `module_config.viec_thay_chu`: Claude soạn quyết định (duyệt / gộp / bỏ / tạo tên, gán dòng, nhãn mẫu); cron chạy qua đúng đường ghi của app, nhật ký "Claude (thay chủ)", kết quả ở `viec_thay_chu_kq`. Nhãn Claude không tính vào độ đúng của thầy (chỉ nhãn người).

### 2026-09-26 · Lọc sâu · dòng một nguồn · đề xuất dễ duyệt
- Chủ: "kho mẫu và bộ nhãn cần bộ lọc chuyên sâu hơn" · "dòng sản phẩm vẫn chưa có keo chít mạch, mỗi nơi một kiểu" · "Finex có tên F300, Kingsmen có tên Terrazy" · "đề xuất khó hiểu để duyệt".
- Dòng một nguồn (`dsDongChuan`): ba dòng đăng ký ở bộ nhãn có thương hiệu (Terrazy — Kingsmen cao cấp · Finex F300 — Finex trung cấp · Keo chít mạch — Kingsmen), rồi dòng từ sản phẩm / mẫu; Kho mẫu, Bộ nhãn, Dòng sản phẩm dùng chung. Lần chuyển 6: Finex → Finex F300 ở mọi bảng + luật nhận dòng.
- Gán dòng cho video (`POST /mau-doan/dat-dong`): từ chi tiết mẫu (dải vàng khi video chưa có dòng) hoặc hàng loạt; mọi đoạn / câu của video đổi theo, bước chuẩn hoá lại theo quy trình dòng.
- Kho mẫu lọc sâu: nhóm cảnh, bước (kể cả chưa có bước), một trường = giá trị, thiếu trường, nguồn, video, thầy chắc dưới mức, học trò lệch thầy; chip đang lọc bấm để bỏ.
- Hàng đề xuất: mỗi mục nói thành câu ("Thầy thấy một dụng cụ chưa có trong danh sách…"), ảnh các mẫu đang dùng, gợi ý nhãn có sẵn để gộp (luật chuẩn, hoặc trùng ≥ 2 từ đặc trưng), ba nút Thêm / Gộp / Bỏ; lọc theo trường, dòng, nguồn, tìm, sắp xếp; gộp theo gợi ý hàng loạt. Bảng nhãn: tìm + chỉ nhãn chưa dùng.

### 2026-09-26 · Bộ nhãn chuẩn theo tài liệu Kingsmen + dòng Terrazy
- Chủ: "dựa vào tài liệu chuẩn cập nhật nâng cấp bộ nhãn và gán nhãn giúp tôi" · "Finex và Terrazy là 2 dòng trung và cao cấp, giống quy trình, khác phân khúc" · "đều là sàn epoxy tự phẳng hiệu ứng terrazzo".
- `worker/bo-nhan-chuan.js`: tên chuẩn + luật quy về cho vật liệu (Finex F300 / S100, Kingsmen Terrazy, keo G3000–G7000, primer, hạt trang trí…), dụng cụ, bài test sàn (8 bài: cào xước, chống trơn, chống bám bẩn, chống thấm, va đập…), bước tự đặt tên → bước chuẩn; luật "bỏ" cho rác (nước, bụi mài, "Thi công 2.8 đến 3.5m2"…).
- Áp khi thầy / người gán (tên khớp luật không thành đề xuất) + lần chuyển 4 dọn đề xuất tồn: gộp về tên chuẩn (mẫu đổi theo), bỏ rác (gỡ khỏi mẫu); tên chưa có luật để người duyệt.
- Đổi dòng Terrazo → Terrazy ở video, mẫu, bộ nhãn, luật nhận dòng; kiến thức thầy: Terrazy cao cấp / Finex trung cấp, cùng là sàn epoxy tự phẳng hiệu ứng terrazzo, nhận dòng qua bao bì.
- Sao lưu trước khi chạy: `D:/OS MKT/sao-luu-d1/2026-09-26-truoc-bo-nhan-chuan/`.

### 2026-09-26 · Quy trình chuẩn theo dòng từ tài liệu Kingsmen
- Chủ gửi hướng dẫn thi công sàn epoxy hiệu ứng / tự phẳng (áp cho Terrazy và Finex; độ ẩm nền cập nhật ≤ 8%) và keo chít mạch (keokingsmen.com). Nạp thành quy trình chuẩn: sàn tự phẳng 8 bước, keo chít mạch 4 bước, mỗi bước có dấu hiệu nhận biết (`bo_nhan.mo_ta`, `thu_tu`); gieo dụng cụ / thao tác / vật liệu; kiến thức lỗi thường gặp đưa vào lời nhắc thầy để nhận cảnh VAN_DE.
- Dòng đã khai quy trình ở Danh mục sản phẩm thì giữ quy trình đó (bước chuẩn của hệ thống bị bỏ qua cho dòng này).
- Thầy chọn bước theo danh sách có dấu hiệu, không đặt tên bước mới khi cảnh khớp bước có sẵn.
- Chuẩn hoá bước cũ (cron, Haiku đọc mô tả / dụng cụ / thao tác thầy đã ghi — không đọc lại hình, một lượt gọi / 30 đoạn); giữ tên cũ ở `buoc_goc`; dòng chuẩn hoá xong thì dọn đề xuất bước (GOP → quy trình chuẩn).

### 2026-09-25 · Thầy đọc bù (chủ: "sao thầy để trống nhãn nhiều quá")
- Đo prod: thầy chạm trần 20,12 / 20 USD (Opus 5: 578 lượt 17,51 USD) → video học sau đó chỉ có nhãn mô hình mở; 527 đoạn cũ không có ảnh (học trước khi có ảnh dải); ~300 đoạn thầy đọc bằng lời nhắc cũ chỉ có nhóm + mô tả.
- Máy Q2 cắt bù ảnh dải (3 khung 448px, cách 0,5 giây quanh giữa đoạn — đúng khuôn `doc-khung`) chung lệnh bản xem `hoc_thanh_pham {chi_proxy}`; mỗi đoạn thử tối đa 2 lần (`mau_doan.anh_thu`). Footage cũng được cắt bù.
- Cron `thayDocBu`: 16 đoạn / 15 phút, đoạn chưa có thầy trước, rồi đoạn thiếu trường; ngữ cảnh = câu thoại cùng lúc; trong trần thầy; mỗi đoạn tối đa 2 lần (`thay_thu`). Nút "Đọc bù ngay" (Admin / Trưởng MKT).
- Báo trên màn (Tổng quan + Kho mẫu): hết trần thầy / số đoạn chờ đọc bù / số đoạn chờ ảnh.

### 2026-09-25 · Xem / nghe đúng đoạn mẫu · thầy chắc theo nhóm cảnh · danh sách hẹp
- Chủ: "câu thoại và footage chưa nghe và xem được" · "câu mô tả rất đúng nhưng trạng thái chưa chắc rất nhiều, thầy có thể gán" · "bảng người kiểm bị hẹp; cột danh sách chỉ còn tên mẫu".
- `/media` trả 206 theo Range (trước trả cả file → trình duyệt không tua được giữa clip). Bản xem 360p cho video đã đăng (`kho_thanh_pham.proxy_url`, gắn `media_url` cho mọi mẫu của video): máy Q2 tạo khi học, video cũ tạo bù bằng lệnh `hoc_thanh_pham {chi_proxy}` (tìm file đã tải trên ổ trước, không nghe / nhìn / thầy lại); cron tự giao khi còn thiếu (≤ 6 giờ / lần). Đo thử: video 20 giây → bản xem 224 KB, 6–10 giây.
- Kho mẫu: ▶ xem đúng đoạn [tu, den] ngay trong khung (khung hình, câu thoại khi chưa có đoạn trích, footage), tới cuối đoạn tự dừng. Cột danh sách 300px: ảnh nhỏ + tên mẫu + chấm trạng thái (rê chuột xem chi tiết); phần sửa rộng ra.
- Thầy: `chac` = chắc về nhóm cảnh, bước chấm riêng `chac_buoc`; chỉ hỏi người khi `chac` < 0,5. Đo trên prod: 85/86 mẫu 0,55–0,6 không có bước — thầy trừ điểm vì quy trình dòng thiếu bước, nhóm cảnh vẫn đúng. Chuyển lần 2: chấm lại trạng thái + gieo 8% mẫu kiểm cho mẫu thầy chốt cũ để đo thầy.

### 2026-09-25 · ADR-018 làm thật: kho mẫu một nguồn + bộ nhãn hai chiều
- Chủ: "cần xử lý mọi liên đới với nhau… hoạt động liên hoàn như một cỗ máy" · "ui cần chính xác theo mô phỏng".
- **Dữ liệu** (`worker/mau.js`): bảng `mau_doan` là nguồn duy nhất của nhãn (mỗi đoạn hình HINH / câu thoại LOI một dòng: nhãn mô hình mở, thầy, người, quyết định chất lượng footage; trạng thái có chỉ mục; `version` → 409 khi hai máy cùng sửa). Bảng `bo_nhan` (giá trị mở rộng + đề xuất). Nhãn không còn nằm trong `phan_tich.timeline`; màn và máy dựng đọc dòng thời gian từ kho mẫu (`timelineCua`).
- **Chuyển dữ liệu cũ** một lần (cờ `module_config.mau_doan`): timeline + nhãn người + cờ kiểm + source + mẫu `doc_loi` → `mau_doan`, rồi xoá mẫu `nhan_khung / doc_loi / chat_luong_source` ở `mau_hoc_ai`. Sao lưu D1 trước khi deploy ở `D:/OS MKT/sao-luu-d1/2026-09-25-truoc-adr018/`.
- **Thầy** gán đủ 14 trường theo Bộ nhãn; giá trị chưa có → đề xuất (nguồn THAY / NGUOI) → Duyệt / Gộp (mọi mẫu chuyển theo) / Đổi tên / Bỏ; duyệt bước → vào quy trình sản phẩm. Tỉ lệ kiểm do app quyết: 8%, lên 20% khi thầy đúng < 85% ở một trường (≥ 20 mẫu).
- Học lại giữ id video, nhãn người bám đúng đơn vị (ranh giới đổi → nhãn cũ giữ dạng hết hiệu lực). Xoá video xoá mẫu; đổi tên dòng đổi cả kho mẫu.
- **Máy Q2**: `hoc-thanh-pham` cắt đoạn trích ≤ 12 s mp3 cho mỗi câu thoại (`am_url`); `doc-khung` bỏ cờ kiểm tự chọn.
- **Giao diện** (`86-nhanmau.jsx`, theo mô phỏng): Tổng quan (4 số + độ đúng từng trường + việc cần quyết) · Kho mẫu (Khung hình / Câu thoại / Footage; ⚑ Cần người; bảng Mô hình mở | Thầy | Người | ↩ thầy; tách 3 khung; Duyệt tuần tự Enter / 1–8 / 0 / → / ←; sửa hàng loạt; nghe đoạn trích) · Bộ nhãn (hàng đề xuất, trường theo nhóm, dòng sản phẩm, chọn thầy) · Mô hình (bàn huấn luyện, tiến trình, video đã học, danh mục, định tuyến) · Chi phí & khoá. Tab Dạy máy cũ gộp vào Kho mẫu. Điện thoại: trường xếp dọc.
- Test `tests/adr018.test.mjs` (chuyển dữ liệu, bộ nhãn, hàng loạt, tỉ lệ kiểm) + cập nhật 014/016/016b/016c/017/017b/017c/017d · 123 test qua.

### 2026-09-25 · Gán nhãn trên PC
- Chủ: "tối ưu ui dạy trên pc sao cho trực quan và thao tác người kiểm tra xử lý dễ dàng nhanh chóng". Ba cột vừa một màn 1440×900: hàng thẻ (đã làm · tiếp theo) | ảnh lớn + dải thời gian cả video (`tl_video`) | bảng quyết định (thầy gán + lý do, nút Đúng lớn, nhóm, bước, mô tả, tách khung). Lưu lạc quan (sang thẻ kế ~0,16 giây, lỗi thì thẻ quay lại hàng), tải sẵn ảnh 5 thẻ kế; phím Enter/1–8/1–9/Esc/M/T/0/→/←/?. Dạy máy: thầy + việc cần quyết thu thành một dòng; khung giải thích Bộ não AI chỉ ở Tổng quan. Kiểm bằng trình duyệt tự động: không lỗi, không tràn ở 390px.

### 2026-09-25 · Thầy làm chủ đạo
- Chủ: "thầy (Opus) giải thích gần như chính xác → nâng vai trò thầy làm chủ đạo để gán nhãn chi tiết nhiều hơn thay vì đẩy cho người". Nhãn thầy là nhãn làm việc; mô hình mở lệch thầy chỉ để đo học trò. Hàng việc của người chỉ còn đoạn thầy chắc < 0,6 và mẫu kiểm ngẫu nhiên ~8% (`kiem_ngau_nhien`, dùng để đo độ đúng thầy không lệch). Đoạn chưa có thầy đọc không vào hàng (sẽ học lại).
- Bản vẽ ADR-018 và mô phỏng cập nhật theo vai trò mới (tỉ lệ kiểm tự tăng ở trường thầy đúng < 85%).

### 2026-09-25 · Gom Bộ não AI · Kho mẫu · Dòng sản phẩm · phiên bản app
- Chủ: "trên pc vẫn là ui cũ" → tab mở từ trước giữ bản cũ: `GET /api/ban` (từ sổ deploy) + góc phải dưới hiện phiên bản; kiểm 2 phút/lần và khi quay lại tab, có bản mới thì báo "Tải lại"; quay lại tab sau 1 phút tự tải lại dữ liệu. Kiểm thật bằng trình duyệt tự động ở 1280 và 390 px.
- Chủ: "hệ thống lại ui của tất cả sub tab bộ não AI … gom gọn" → 8 tab còn 5: 🎯 Tổng quan (bàn làn × dòng, kỹ năng, phiên bản, tiến trình, nhật ký) · 🎓 Dạy máy · 📚 Kho mẫu (kho mẫu mới, dòng sản phẩm, nạp video, video đã học) · 🧠 Mô hình (bảng huấn luyện, mô hình, định tuyến) · 💰 Chi phí & khoá.
- Chủ: "kho mẫu thầy và mô hình mở chấm pass cũng cần lưu để tôi kiểm tra cập nhật" → `GET /kho-mau` (kỹ năng K1/K2/K4; trạng thái VANG/BAC/LECH/THAY/MO/KHONG_RO/NGHE_SAI/CHO_THAY/LUAT; lọc dòng, nguồn, tìm; phân trang), sửa trực tiếp qua đúng các đường gán nhãn của Dạy máy.
- Chủ: "định nghĩa các dòng đang bị sai thì tuỳ chỉnh thế nào ở đâu" → Kho mẫu › Dòng sản phẩm: `GET /dong-san-pham`, `POST /dong-san-pham/doi-ten` (đổi/gộp ở san_pham, kho_thanh_pham, mau_hoc_ai, luật); luật nhận dòng `huan_luyen.anh_xa_dong` sửa được, máy học đọc qua `/hub/cau-hinh-hoc` (bỏ luật cứng /RON/ khớp nhầm). Test `adr017d`.

### 2026-09-25 · Gán nhãn chi tiết + thầy Opus 5
- Chủ (gán trên điện thoại): "3 ảnh nhưng 2 nội dung" → nút ✂ Gán từng khung (dải 3 khung cắt riêng bằng CSS, mỗi khung một nhãn vàng, nhãn đoạn = nhóm nhiều nhất, lưu `phan`); ô Mô tả đúng (thành ví dụ cho mô hình mở và thầy); ＋ Bước/bài test khác, tuỳ chọn thêm vào quy trình chuẩn của dòng.
- Chủ: "thay đổi mô hình thầy nâng cấp hơn để tôi đỡ chỉnh" → thầy mặc định Claude Opus 5 (effort vừa, suy nghĩ thích ứng, dự phòng server khi bị từ chối), thầy xem 12 nhãn người sửa gần nhất (cùng dòng trước). Chọn mô hình / mức suy nghĩ / trần USD ở đầu tab Dạy máy (`ai.thay_nhin_model`, `thay_nhin_effort`, `ngan_sach_thay_usd`). Bảng giá thêm Opus 5, Sonnet 5, Fable 5.1.
- Test `adr016c`, `adr016d`.

### 2026-09-25 · Ollama tắt sau khởi động lại
- Đo 07:15: Q2 khởi động lại 06:29, nhịp tim báo ollama:false; video học sau đó không đọc hình (nhìn 0–2 giây) mà lệnh vẫn báo xong. Bộ nghe cả video đã chạy (76–86 giây/video).
- `doc-khung.mjs`: `batOllama()` tự chạy `ollama serve` nền khi Ollama tắt, chờ ≤ 60 giây; `hoc-thanh-pham.mjs` ghi rõ "KHÔNG ĐỌC HÌNH" vào kết quả lệnh nếu vẫn không lên.

### 2026-09-25 · Dạy máy về Bộ não AI
- Chủ: "mục dạy máy nên nằm trong bộ não và huấn luyện là 1 sub tab … những gì cần hỏi người thì đẩy qua sub tab này". Bỏ mục Dạy máy ở thanh bên; tab con 🎓 Dạy máy cạnh 🎯 Bàn huấn luyện (thay tab Nhãn hình), số trên tab = việc chờ người.
- Tab gom MỌI việc máy hỏi người khi học: quyết định (kỹ năng có bản mới, phiên bản chờ duyệt, đề nghị định tuyến) + thẻ gán nhãn (khung hình, footage, câu thoại). `GET /hop-viec/dem` đếm thẻ chờ. Bàn huấn luyện giữ bảng đo nhận diện và lối sang Dạy máy. Thẻ ở Việc của tôi mở thẳng tab này.
- Test seeding nuôi tài khoản: gửi lại nhịp tim Trạm sau khi cố định đồng hồ (chạy trước 10h VN thì "Trạm im").

### 2026-09-25 · Sửa ba lỗi đo được qua đêm
- Đo đêm 24–25/09: Drive 36/36 xong; TikTok @vatlieuchuyendung 9/30; hai kênh TikTok còn lại bị đánh hỏng oan. Thời gian một video TikTok: tải 1–4 giây, đọc hình (qwen) 226–354 giây, ảnh + nghe từng shot 53–126 giây, thầy 17–57 giây → đọc hình chiếm phần lớn: GIỮ Q2, không tách sang Ngoc-Han. Thầy nhìn: 137 lượt 1,72 USD.
- Luật 30 phút chỉ còn cho lệnh Trạm; lệnh máy con chỉ hỏng khi máy mất nhịp tim > 15 phút hoặc quá 12 giờ (trước đây máy khác hỏi lệnh là đánh hỏng lệnh Q2 đang giữ chờ).
- `amThanh16k` gọi thiếu mốc → `-ss undefined` → không nghe cả video được, rơi về nghe từng shot vụn. Sửa mặc định.
- Video một cảnh không bỏ nữa: chia đoạn 5 giây, học nhìn + nghe, `mot_canh` → không ghi mẫu ghép. Test `tests/adr017c.test.mjs`.

### 2026-09-24 · Bộ nghe tiếng Việt: đo và chọn
- Đo trên "Làm đúng ngay từ đầu.mp4" (74 giây, máy Ngoc-Han CPU): whisper-base 42 giây, không đọc được; whisper-small 61 giây, đọc hiểu gần hết, sai tên riêng; PhoWhisper-small (huuquyet ONNX) 45 giây, tương đương nhưng rơi một đoạn giữa. Giữ whisper-small.
- `hoc-thanh-pham.mjs`: `suaThuatNgu()` sửa chỗ chắc chắn (Kingsmen, epoxy, keo chít mạch, đường/màu ron); video Drive giữ lại ở `thanh-pham/drive/<id>` trên máy học (học lại không tải lại ~180 MB/video).

### 2026-09-24 · ADR-017 đợt B — K2 chất lượng source, K4 đọc lời
- **K2**: `GET /source/hang` (đoạn footage có số đo nét/rung/sáng, gần ngưỡng trước, xen 1/4 ngẫu nhiên), `POST /tai-san/:id/doan/:i/source` {dung, ly_do} → mẫu `chat_luong_source`; ≥ 30 lần quyết thì `hocNguongSource()` dò lưới ngưỡng khớp người nhất (đo trên tập KIỂM) → `huan_luyen.source_hoc`; `POST /source/hoc`.
- **K4**: `thayDocLoi()` Claude Haiku gán nhóm/bước cho 20 câu một lần gọi (cron 40 câu/15 phút, nút đọc ngay), chi phí `hoc_doc_loi` chung trần thầy; `GET /doc-loi/hang` (nghe sai → lời khác hình → thầy không chắc → 1/4 ngẫu nhiên); `POST /mau/:id/doc-loi` {nhom,buoc | nghe_sai}.
- **Bàn**: K2, K4 tính chặng thật; hộp việc ba loại thẻ (K1 nhãn hình, K2 source, K4 câu lời), trần phút tính chung.
- **Test** `tests/adr017b.test.mjs` (máy học đúng ngưỡng nét người dùng).

### 2026-09-24 · ADR-017 đợt A — Bàn huấn luyện
- **Worker**: `GET /ban-huan-luyen` (`banHuanLuyen()`, `LAN_HOC`), trần thầy `ai.ngan_sach_thay_usd`, cấu hình `huan_luyen` (trần phút, ngưỡng K1), `/nhan-hinh/hang` báo `het_tran` (`them=1` để làm thêm), mẫu nhãn ghi `giay`, video thành phẩm lưu `thoi_gian` từng chặng + máy.
- **Máy con**: `hoc-thanh-pham.mjs` đo tải/cắt/nghe/ảnh/nhìn/thầy; `doc-khung.mjs` trả `ms_thay`.
- **Giao diện**: tab mặc định 🎯 Bàn huấn luyện (làn × dòng, số đo từng ô, thời gian máy học, hộp việc).
- **Test** `tests/adr017.test.mjs`.

### 2026-09-24 · ADR-016b — Claude làm thầy gán nhãn hình khi học
- Chủ 24/09: "khi học có thể dùng gọi api hoặc claude nhận diện gán nhãn để dạy cho mô hình mở, khung hình nào không chắc thì tôi sẽ tham gia gán nhãn".
- **Worker**: `POST /hub/thay-doc` (≤ 30 đoạn, song song 4) → `thayDocDoan()` gọi Claude (mặc định `ai.thay_nhin_model` = Sonnet 4.5) với ≤ 3 dải hình/đoạn, tập nhãn đóng theo sản phẩm; chi phí ghi `hoc_nhan_khung` (chịu hạn mức ngân sách học); tắt bằng `ai.thay_nhin=false`. Dòng thời gian giữ `mo` (mô hình mở), `thay` (Claude), `nguon_nhan` THAY_KHOP | THAY | MO; bảng đo tách độ chính xác thầy / mô hình mở.
- **Máy con**: `doc-khung.mjs` tải dải đầu/giữa/cuối mỗi đoạn, gọi thầy; khớp → nhãn bạc (tu_tin ≥ 0,85, không cần người); bất đồng hoặc thầy chắc < 0,7 → cần người xác nhận; nhãn chính = nhãn thầy.
- **Giao diện**: màn Nhãn hình hiện ý kiến thầy + mô hình mở + "hai bên bất đồng"; ô "Thầy Claude đúng nhóm".
- **Test** `tests/adr016b.test.mjs`.

### 2026-09-24 · ADR-016 — Nhãn vàng cho mô hình nhìn
- **Worker**: `tlSach()` dùng chung; `/hub/thanh-pham` lưu `timeline`; `POST /(tai-san|kho-thanh-pham)/:id/doan/:i` (`khong_ro`, `nhe`, `ngau_nhien`);
  `GET /nhan-hinh/hang`; bootstrap `ai_nao.do_chinh_xac_hinh` thêm `ngau_nhien`, `theo_nhom`, `nham`, `muc_tin`, `theo_nguon`.
- **Máy con**: `doc-khung.mjs` 448px, `khung_url` mỗi đoạn, `ngu_canh`, cần xác nhận không dựa số tự khai; `hoc-thanh-pham.mjs` Whisper small + nghe cả video + ngữ cảnh.
- **Giao diện**: tab 👁 Nhãn hình (bảng đo + gán nhãn nhanh); dải thời gian tô theo nhóm cảnh, viền đứt = chờ xác nhận; Danh mục sản phẩm có ô Bài test.
- **Test** `tests/adr016.test.mjs`.

### 2026-09-24 · ADR-013 — Lớp học của máy (thay màn Huấn luyện)
- **Worker**: `POST /lop-hoc/nap` (một ô, tự nhận loại, `chi_nhan`), `POST /lop-hoc/bat|tat`, `POST /lop-hoc/tu-hoc`; `tuHoc()` theo cron; `tomTatKyNang()` → bootstrap `ai_nao.ky_nang`, `nhat_ky_hoc`; phiên bản lưu `danh_gia.vi_du`.
- **Máy dựng**: `huan-luyen.mjs` gửi 6 ví dụ cảnh kiểm (người / mới / cũ) theo phiên bản.
- **Giao diện**: tab 🎓 Lớp học = Nạp (hỏi sản phẩm bằng nút) · 4 kỹ năng (Bật bản mới / Xem thử / Tắt) · Nhật ký · Kho video; màn ADR-012 nằm trong "Chi tiết kỹ thuật".
- **Test** `tests/adr013.test.mjs` (2 bài).

### 2026-09-24 · ADR-012 — nhãn mẫu, bản chung / bản riêng theo phạm vi, màn Huấn luyện 5 khối
- **Worker**: `mau_hoc_ai` +dong, muc_dich (tự suy qua `phamViCua`; `ganMauAI` bổ sung); `kho_thanh_pham` +dong, muc_dich; `mo_hinh_phien_ban` +pham_vi. `/kho-thanh-pham/nap`, hàng đợi TikTok, cấu hình Kalodata mang nhãn → lệnh `hoc_thanh_pham` mang nhãn. `PATCH/DELETE /kho-thanh-pham/:id`. `/ai/huan-luyen {pham_vi}`; `/hub/tap-mau`, `/hub/tap-mau-ngon-ngu` lọc `?pham_vi`; `/hub/mo-hinh/phien-ban` nhận pham_vi; duyệt bản riêng không đè bản chung; `/hub/mo-hinh/:tn?dong=&muc_dich=` chọn bản riêng khi ≥ bản chung + 3 (so với điểm kiểm phiên bản chung đã duyệt); `/hub/viec/dung_video` trả `pham_vi`. Bootstrap: `dong_san_pham`, `pham_vi_thong_ke`, `tien_trinh`.
- **Máy dựng**: `huan-luyen.mjs` nhận `pham_vi` (tập mẫu lọc, phiên bản gửi lên có nhãn); `dung-video.mjs` tra checkpoint chọn cảnh / chọn đoạn / ghép theo phạm vi của bài; `hoc-thanh-pham.mjs` gửi nhãn.
- **Giao diện** Máy › Bộ não AI › Huấn luyện viết lại theo mô phỏng: 1 mô hình đang học · 2 bốn cửa nạp (Drive, máy dựng, TikTok, Kalodata) có nhãn · 3 việc đang chạy · 4 kho mẫu (lọc, gắn nhãn, loại) · 5 phiên bản.
- **Trạm** v9.165: nhân viên `content_os:hoc` sở hữu `tai_tiktok` + `kalodata_video` (trước đó hai việc không thuộc ai → Trạm không hiện, từ chối tài khoản); dấu hiệu đăng nhập Kalodata rộng hơn.
- **Test** `tests/adr012.test.mjs` (3 bài).

### 2026-09-24 · ADR-011 — Kalodata: video bán chạy → kho thành phẩm theo doanh thu → kịch bản bán hàng
- **Worker**: `kho_thanh_pham` +doanh_thu, luot_ban, san_pham, kich_ban; `PUT /kalodata` (ngành hàng, top N, tự quét tuần), `POST /kalodata/quet` (cần Trạm sống → `chay_agent content_os/kalodata_video`); hub `GET /hub/viec/kalodata` (đến hạn?), `POST /hub/kalodata` (bảng video → hàng đợi `tai_tiktok` nguồn KALODATA với link + meta → lệnh Trạm tải), `/hub/tiktok-da-tai` nhận `nguon`; `/hub/thanh-pham` nhận doanh thu/sản phẩm/kịch bản (lời shot ghép lại); `angleFootage` kèm 3 kịch bản bán tốt; `/hub/tap-mau-ngon-ngu` thêm mẫu từ kho; bootstrap `ai_nao.kalodata`.
- **Máy dựng**: `hoc-thanh-pham.mjs` gửi doanh thu / sản phẩm / kịch bản từ `_meta.json`; `huan-luyen.mjs` trọng số ưu tiên doanh thu.
- **Trạm** (v9.164): thẻ đăng nhập `kalodata`, nền tảng Kalodata, cấp mặc định content_os:dang_do vai kiem; việc `kalodata_video` (`content-os-kalodata.mjs`); `content-os-tai-tiktok.mjs` nhận danh sách link + meta.
- **Giao diện**: khối 📈 Kalodata trong Kho video thành phẩm; cột Doanh thu, dấu 🗣 lời thoại.
- **Test** `tests/adr011.test.mjs` (3 bài). Chưa quét thật: cần Thiện đăng nhập Kalodata ở Trạm › Tài khoản rồi đặt ngành hàng và bấm Quét ngay.

### 2026-09-24 · ADR-010 — máy học chọn & ghép source (010a–d)
- **Worker**: bảng `ghep_video`, `kho_thanh_pham` (+luot_xem, luot_thich, ngay_dang, link, kenh), cột `tai_san.phan_tich`; định tuyến `chon_doan` (mở `doan-tuyen-tinh`), `ghep_canh` (mở `ghep-thong-ke`). Tuyến người: `GET/POST /noi-dung/:id/ghep`, `POST /kho-thanh-pham/nap` (Drive/thư mục máy → lệnh `hoc_thanh_pham`; `nguon:TIKTOK` → hàng đợi `module_config.tai_tiktok` + lệnh Trạm `chay_agent content_os/tai_tiktok`, cần Trạm sống). Tuyến hub: `/hub/viec/phan_tich`, `/hub/phan-tich`, `/hub/viec/thanh_pham`, `/hub/thanh-pham` (Claude xếp cỡ cảnh cho shot có khung, tối đa 12), `/hub/viec/tai_tiktok`, `/hub/tiktok-da-tai`; `/hub/viec/dung_video` trả `phan_tich` từng clip và `ghep` khi có `ghep_id`; lô `content_os.video` nhận `ghep`/`ghep_nguon`; `/hub/tap-mau` trả đủ đầu vào cho chon_doan/ghep_canh + `luot_xem`/`kenh`; `/ai/huan-luyen` cho hai tính năng mới, rơi về máy dựng khi không có máy huấn luyện. Script phát thêm: `phan-tich`, `hoc-thanh-pham`.
- **Máy dựng** (`may-dung.mjs` 1.2): `phan-tich.mjs` (đo thật clip 4,6 s → 9 đoạn, 3 khung), `hoc-thanh-pham.mjs` (scdet cắt shot, khung, Whisper tuỳ máy, chữ ký 16×16 dò clip gốc, `_meta.json` lượt xem TikTok), `dung-video.mjs` ghép theo shot (kế hoạch người khi có `ghep_id`; máy: shot sau = clip khớp chưa dùng, độ dài theo mô hình ghép, đoạn theo mô hình chọn đoạn/luật; báo `ghep` về app), `huan-luyen.mjs` +`hocGhep` (chon_doan logistic, ghep_canh thống kê) +`trongSoLuotXem` áp cả chon_canh, `nap-drive.mjs` phân tích ngay khi nạp.
- **Trạm** (masfico-insight v9.163): việc `content_os/tai_tiktok` (`content-os-tai-tiktok.mjs`, hồ sơ tiktok_cn, vai kiem): mở kênh, cuộn lấy link + lượt xem, tải mp4 qua phiên, `_meta.json`, báo `/hub/tiktok-da-tai`; captcha → `tk_su_co`, không vượt.
- **Giao diện**: Sản xuất › ✂️ Chỉnh ghép (mỗi cảnh: clip · giây vào/ra · ↑↓ · ✕ · + shot · 🎬 Dựng lại theo bản chỉnh); Máy › Bộ não AI › Huấn luyện › 🎞 Kho video thành phẩm (dán Drive / `D:\…` / `@kenh`, bảng video · shot · nhịp · khớp gốc · lượt xem, hàng đợi Trạm); nút 🎓 Huấn luyện tự có "Chọn đoạn" và "Ghép shot".
- **Test** `tests/adr010.test.mjs` (6 bài) — bộ 94/94. **Đo thật 24/09 14:19:** 15 clip Keo chít mạch phân tích xong (mỗi clip ~40 s, Claude xếp cỡ cảnh SAN_PHAM/THAO_TAC/RONG); dựng lại `nd_9b2030d64i3h` → video `/media/media/m_10020ab1bobx.mp4` 31 s, 5 cảnh / 10 shot, 10 clip khác nhau, không clip nào lặp (cảnh 1: 4 shot, cảnh 2/3/5: 2 shot); shot ~2,8 s theo luật vì chưa có mẫu huấn luyện ghép. Lần dựng đầu một clip mở đầu 3 cảnh liền → sửa: clip đã lên hình nhường clip chưa dùng (commit 115998c).

### 2026-09-24 · Khoá API dán trên app (Máy › Bộ não AI › 🔑 Khoá API) — chủ: "có UI ở app để ghép khoá"
- Đổi quy ước ADR-001 "khoá chỉ là secret Worker": nay **secret Cloudflare vẫn ưu tiên**, nhưng Admin dán được khoá ngay trên app. Bảng `khoa_api` (giá trị mã hoá AES-GCM bằng két `module_config.ket`, chỉ trả 4 ký tự cuối của khoá dán trên app; khoá wrangler chỉ là cờ). `napKhoa(env)` phủ khoá lên env ở cửa `fetch`/`scheduled` (cache 60 giây) nên mọi tuyến cũ (`env.ANTHROPIC_API_KEY`…) dùng được không sửa.
- `PUT /khoa-api/:ten` (Admin; **thử với nhà cung cấp trước khi lưu**: Anthropic, Google TTS, Gemini, OpenAI/Groq/DeepInfra, YouTube; sai thì 422, có "Vẫn lưu"), `DELETE /khoa-api/:ten`; khoá đang cắm bằng wrangler → 409. Bootstrap `khoa_api[]` chỉ cho Admin. Test `tests/khoa-api.test.mjs` 3 nhóm.
- Đánh đổi ghi rõ: kém secret Cloudflare một bậc (ai đọc được cả D1 lẫn két thì mở được) — đổi lấy việc chủ tự cắm không cần máy có wrangler.

### 2026-09-24 · ADR-T01 Trạm (đợt 4, phía Content OS) — Trạm chia ba: Tài khoản · Agent · Cài đặt
- Trạm (masfico-insight v9.158→9.161) đổi giao diện theo bản vẽ `may/BAN-VE-GIAO-DIEN-3.md`; hợp đồng hub1 không đổi, thêm khối vào nhịp tim `/hub/trang_thai`: `tai_khoan[]` (phiên, `dung_den` khi Trạm dừng sau checkpoint, `dang_dung_boi`, `checkpoint_30d`) và `nhan_vien[]` (nhân viên máy làm cho Content OS + tài khoản được cấp theo vai/trần).
- **Worker**: lưu hai khối đó vào `tram_trang_thai`; `tkDungTram` — xếp lịch đăng seeding và bình luận **không giao** việc cho tài khoản Trạm đang dừng, dời tới hết hạn dừng (không tự vượt).
- **Giao diện**: Seeding › Tài khoản MKT hiện "⏸ Trạm dừng tới…", "đang được X dùng"; Máy › Trạm hiện danh sách nhân viên máy + tài khoản được cấp (chỉ xem — cấp quyền đặt trên Trạm).

### 2026-09-24 · ADR-007b (seeding nâng cao)
- **Worker**: bảng `binh_luan_seeding, nuoi_seeding`, `lead_seeding.loai/muc_do/goi_y`; config seeding `binh_luan_moi_bai, binh_luan_tre_min/max, nuoi_moi_ngay, nuoi_phut, nuoi_tim, nhip_tu_chinh, go_bai_ha_nhip, checkpoint_ha_nhip`; định tuyến `phan_loai_lead`; helpers `lenBinhLuan, chayBinhLuanSeeding, napBinhLuan, ghiCheckpoint (lịch sử + tự hạ nhịp), lenLichNuoi, chayNuoi, napNuoi, chinhNhipSeeding, phanLoaiBinhLuan`; agents `BINH_LUAN_SEEDING` (15'), `NUOI_TAI_KHOAN` (15'), `LEN_LICH_NUOI` (ngày: nuôi + chỉnh nhịp); hub `/hub/viec/seeding_binh_luan`, `/hub/viec/seeding_nuoi`, lô `content_os.seeding_binh_luan_ket_qua`, `content_os.seeding_nuoi_ket_qua`; endpoints `/seeding/binh-luan/:id/(huy|da-dang)`, `/seeding/nuoi/:id/huy`; `apDungDeXuat` SEEDING_NHIP; bootstrap `seeding.binh_luan, nuoi`.
- **Trạm** (`v2/tram/`): `content-os-seeding-binh-luan.mjs`, `content-os-seeding-nuoi.mjs`, agents entry +2 việc → masfico-insight v9.156.
- **Giao diện**: Seeding › tab **Bình luận & nuôi**; Lead hiện loại/mức/gợi ý trả lời; Máy › Cấu hình › thẻ Seeding.
- Test `tests/adr007b.test.mjs`: 6 nhóm.

### 2026-09-24 · ADR-009c (Bộ não AI phần 3)
- **Worker**: bảng `ai_viec` (hàng đợi mô hình mở); config `ai.cho_may_phut`; `goiAI` mức MỞ ngôn ngữ (tính năng hỗ trợ: soan_noi_dung, soan_nhap_agent, cham_y_tuong, bao_cao) → tạo việc + lệnh `mo_hinh_chay`, trả `cho_may`; `xuLyAIViec` đi tiếp theo ngữ cảnh (guardrail duyetVanBanAI/claim y hệt API) · `chayLaiAPI` máy trễ → API dự phòng + mẫu "mở trễ"; agent `NHAN_AI_MO` (15'); `GET /ai/viec/:id` (người bấm ✨ hỏi lại); hub `/hub/viec/ai`, `/hub/ai-xong`, `/hub/viec/loc_footage`, `/hub/tap-mau-ngon-ngu`, phiên bản có `model_id` (duyệt → đổi model Ollama); lô `content_os.video.tts_mo` → mẫu tts (chấm giọng mở); lô `content_os.loc_footage` → tài sản FOOTAGE nguồn MÁY + mẫu loc_footage + việc; `POST /noi-dung/:id/loc`; PATCH mẫu tts/loc_footage → giong_mo, bỏ đoạn → gỡ tài sản; `tietKiemMo` (USD tương đương theo giá mô hình chính); bootstrap `ai_nao.tiet_kiem, mo_ho_tro, ai_viec`.
- **Máy con** v1.1: `mo-hinh.mjs` (Ollama: việc MỞ + bóng, tự pull model), `piper.mjs` (tải piper + giọng vi_VN một lần, wav→mp3), `dung-video.mjs` giọng theo định tuyến tts (API → BÓNG kèm mẫu Piper → MỞ Piper, Google dự phòng; gói CapCut có giong-mo/), `loc-footage.mjs` (Whisper transformers.js + CLIP, cửa sổ 4s, cắt & tải lên), `danh-gia-ngon-ngu.mjs` + CLI `node may-dung.mjs xuat-tap-mau | phien-ban <model>`, `huan-luyen-ngon-ngu.py` (unsloth LoRA Qwen2.5-7B → GGUF → Modelfile).
- **Giao diện**: ✨ AI viết chờ máy ghép (hỏi lại 5"), Sản xuất › 🤖 Máy lọc footage + giữ/bỏ đoạn cắt + 🎙 chấm giọng mở; Bộ não AI › Chi phí: thẻ "mô hình mở làm thay −USD"; Huấn luyện: hướng dẫn LoRA + việc mô hình mở gần đây.
- **Máy Ngoc-Han** (24/09): cài ffmpeg + Ollama (winget), `D:\may-dung` ghép app dev (Node 24, transformers, GPU GTX 1650 4GB), Ollama pull `qwen2.5:3b`, mô hình mở qwen2-5-7b trỏ model_id `qwen2.5:3b`; dev server đọc khoá từ `v2/.env.local`.
- Test `tests/adr009c.test.mjs`: 7 nhóm.

### 2026-09-24 · ADR-009a+b (Bộ não AI)
- **Worker**: bảng `mo_hinh` (9 mô hình seed: Claude Sonnet/Haiku, Gemini Flash, GPT-4o mini, Google TTS, Qwen 7B Ollama, CLIP ViT-B/16 + đầu học, Whisper, Piper), `dinh_tuyen` (10 tính năng: 7 ngôn ngữ, tts, chon_canh, loc_footage; mức API|BONG|MO, ngưỡng, min_mau, điểm, đề nghị), `mau_hoc_ai` (kho mẫu, tap HOC/KIEM), `mo_hinh_phien_ban`; `ai_usage.mo_hinh_id, muc`; `goiAI` → `chonMoHinh` (chính → dự phòng khi thiếu khoá/lỗi) → `goiNhaCungCap` (anthropic / google Gemini / openai) → ghi mẫu → mức BÓNG xếp lệnh `mo_hinh_bong` cho máy ghép có kha_nang mo_hinh; `ghiMauHoc` đổ phán quyết người vào kho mẫu; `ganMauAI` gắn mẫu với bài máy soạn; `tinhDinhTuyen` (điểm mở: ngôn ngữ = giống trung bình bóng↔chính, nhìn = % chọn đúng nhãn; đề nghị LÊN/XUỐNG → việc GAT_DINH_TUYEN cho Trưởng MKT; máy không tự gạt); agent `TINH_DINH_TUYEN`; endpoints `/ai/mo-hinh` (POST/PATCH/thu), `/ai/dinh-tuyen/:tinh_nang` (luật: MỞ ngôn ngữ = 009c; MỞ nhìn cần phiên bản duyệt + điểm ≥ ngưỡng + đủ mẫu), `/ai/mau` (GET/PATCH chấm), `/ai/huan-luyen`, `/ai/phien-ban/:id/(duyet|tu-choi)`; hub `/hub/viec/bong`, `/hub/bong`, `/hub/tap-mau`, `/hub/mo-hinh/:tinh_nang`, `/hub/mo-hinh/phien-ban`, `/hub/script/(nhin|mo-hinh|huan-luyen)`; lô video nhận `canh_chon` → mẫu chon_canh; heartbeat máy ghép khai `kha_nang` (mo_hinh, huan_luyen), gpu, ollama; bootstrap `ai_nao {mo_hinh, dinh_tuyen, phien_ban, mau_thong_ke, chi_phi, lenh_hoc}`, `san_sang.gemini/openai`.
- **Máy con** (v1.1): runner tải script theo lệnh (`dung-video`, `mo-hinh`, `huan-luyen`) + `script()` nạp module dùng chung; `nhin.mjs` (CLIP qua @huggingface/transformers, khung hình ffmpeg, đặc trưng [cos, t⊙i], đầu logistic); `dung-video.mjs` ghi ứng viên từng cảnh, chạy mô hình nhìn BÓNG/MỞ; `mo-hinh.mjs` (Ollama chạy bóng ngôn ngữ); `huan-luyen.mjs` (tập mẫu → embed → logistic SGD → đánh giá top-1 tập KIỂM so cos thuần → checkpoint JSON → phiên bản chờ duyệt); `package.json` (npm install tuỳ chọn cho AI).
- **Giao diện**: Máy › 🧠 Bộ não AI (Định tuyến · Mô hình · Huấn luyện · Chi phí theo mô hình); thẻ video › Sản xuất › chấm cảnh máy chọn ✓/✗ (nhãn huấn luyện).
- Test `tests/adr009.test.mjs`: 6 nhóm.
- Còn lại 009c: LoRA ngôn ngữ mở tự làm (hàng đợi máy ghép), TTS mở tiếng Việt, Whisper lọc footage theo lời.

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
