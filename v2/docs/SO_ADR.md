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
ADR-007 · 2026-09-23 · SEEDING TỰ ĐỘNG — thay Domain A của app cũ, thiết kế mới (bản vẽ §11)
Bối cảnh : App cũ: người soạn/đăng/chụp màn hình/nghiệm thu/tính tiền seeding; Thiện: "thiết kế 007 mới hoàn toàn theo hướng tự động
            seeding", "tự động thông qua agent Trạm", KHÔNG cho Trạm gửi hộ Zalo, BỎ quay công trình.
Quyết định: (1) Seeding chỉ từ bài chính đã đăng (qua G3). (2) B13 soạn biến thể (AI, giọng thợ/chủ nhà/thầu, chống trùng, guardrail),
            B14 phân công & lịch (Sales × nhóm phụ trách, xoay vòng, nhịp), B15 Sales tự đăng Zalo/FB (NGƯỜI), B16 nghiệm thu tự động
            (FB: Trạm mở link; Zalo: Trạm nghe nhóm → lô zalo.tin khớp việc; ĐẠT/KHÔNG ĐẠT theo luật cứng, NGHI NGỜ → người), B17
            tính tiền & tự chốt bảng chi trả tháng (không cổng người; Admin ghi đã chi / điều chỉnh có audit). (3) Bảng nhom_seeding,
            goi_seeding, bien_the, viec_seeding, bang_gia_seeding, chi_tra. (4) Trạm: việc seeding_kiem cho agent content_os; món zalo.tin.
            (5) Màn Seeding: Sales (Việc hôm nay · Thu nhập · Nhóm của tôi) / staff (gói, việc, nhóm, bảng giá, chi trả). (6) Chống gian:
            trùng link/nội dung, react bất thường, không kiểm được 7 ngày → NGHI NGỜ. Quay công trình: BỎ.
Người duyệt: Thiện · Trạng thái: CHỜ DUYỆT BẢN VẼ §11 (viết lại 23/09 theo "thợ ở hội nhóm Facebook, seeding truyền thông điệp định vị tự nhiên"; không Sales, không tiền, bỏ quay CT). Mã nháp trong working tree chưa commit.
```

## Changelog

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
