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

## Changelog

### 2026-09-23 · ADR-002 (đợt 2)
- **Worker**: bảng `chien_luoc_phien_ban, ke_hoach_thang, muc_noi_dung, y_tuong`; `pillars.muc_tieu`; hằng `MUC_TIEU, DINH_DANG, GIAI_DOAN`; helpers `tuanCuaNgay/soTuanThang/tuanCuaMuc, lamSachChiTieu, deXuatKeHoach, thieuTheoTuan, taoMucConThieu, gomYTuong, chamYTuongAI, taoMucTuYTuong, ghiMauHoc, giongChiTieu`; agent `GOM_TREND` (HE_THONG/B1), `DE_XUAT_KE_HOACH` (THUC_HIEN/B2), `CHIA_TUAN` (THUC_HIEN/B3); API `POST /chien-luoc/chot`, `POST /ke-hoach/:thang/de-xuat`, `PUT /ke-hoach/:thang`, `POST /ke-hoach/:thang/chot`, `POST /ke-hoach/:thang/tao-muc`, `GET /ke-hoach/:thang` (còn thiếu theo tuần), `POST/PATCH/DELETE /muc`, `POST /y-tuong`, `POST /y-tuong/:id/quyet`; config `trend {tu_khoa_nganh, chong_trung_ngay, nguong_tu_duyet}`, `ke_hoach {tong_bai_mac_dinh, ngay_de_xuat}`; bootstrap thêm `chien_luoc_phien_ban, ke_hoach_thang, muc_noi_dung, y_tuong, hang_so`. Mô phỏng nạp thêm ý tưởng, kế hoạch đề xuất, 3 mục.
- **Giao diện**: Chiến lược & Kế hoạch có 9 tab: Định vị (nút ✅ Chốt G1 + lịch sử phiên bản), **Kế hoạch tháng** (✨ Máy đề xuất với 🤖 lý do từng nhóm, 4 khối pillar/mục tiêu/định dạng/kênh có thực tế, KPI kết quả brand+bán hàng, 💾 Lưu, ✅ Chốt G2), **Tuần & mục** (cột tuần với "thiếu: …", 🤖 Máy tạo mục còn thiếu, thẻ mục đổi tuần, form mục đầy đủ), **Ý tưởng & trend** (điểm máy, lý do, Duyệt → mục / Bỏ kèm lý do, ▶ Gom thử, ＋ Ý tưởng của tôi), Pillar có cột Mục tiêu. Việc của tôi: G1/G2 trạng thái thật. Dòng chảy: thẻ thật từ mục nội dung tháng này. Máy › Cấu hình: Trend (từ khoá ngành, ngưỡng tự duyệt, chống trùng), Kế hoạch (tổng mặc định, ngày đề xuất).
- Test `tests/adr002.test.mjs`: 7 nhóm (G1, đề xuất/sửa/chốt + mẫu B2, tạo mục idempotent + mẫu B3, gom trend + mẫu B1, B1 AI tự làm không bịa khi thiếu key, agent đề xuất tháng sau + chốt với B3 AI).

### 2026-09-23 · ADR-001 (đợt 1)
- **Nền**: `v2/wrangler.toml` (project `kingsmen-content-os`, D1 `kingsmen-content-os-db`, R2 `kingsmen-content-os-media`, cron 15'), `build.mjs` (gộp `app/src/*.jsx` theo tên → Babel → Tailwind từ `app/tailwind.config.json`), `dev.mjs` (Worker thật + D1 giả lập `node:sqlite`, không cần wrangler), `tests/` (node --test).
- **Worker**: schema đợt 1 (`users, sessions, audit(tac_nhan), module_config, ai_usage, chien_luoc, pillars, frameworks, san_pham, claim_cam, kenh, buoc_thuc_hien, mau_hoc, agent_run, cong_viec`); seed admin `admin@kingsmen.vn/admin123` bắt đổi mật khẩu; 12 bước NGƯỜI; API: login/logout/bootstrap/me, users (ADMIN/TRUONG_MKT; chỉ Admin tạo/sửa Admin), chiến lược PUT, `/danh-muc/:bang` CRUD (tắt thay vì xoá, claim xoá thật), `/nhap/danh-muc` (Admin, upsert), `/buoc/:ma` PATCH (luật gạt), `/may/chay-thu`, `/cau-hinh/:key` PUT (validator), `/cong-viec` + xong/bỏ, `/mo-phong/nap|xoa`. Agent đăng ký: `TINH_SAN_SANG`. AI helpers (goiAI, ngân sách, ngân sách học) sẵn cho đợt 2.
- **Giao diện 5 màn**: Việc của tôi (4 cổng, việc được giao, máy hôm nay), Chiến lược & Kế hoạch (chiến lược cơ bản + 6 danh mục gốc; tab Kế hoạch mô phỏng), Dòng chảy (khung 6 giai đoạn + kanban mô phỏng + hàng đợi duyệt mô phỏng), Kết quả & Báo cáo (3 mức + báo cáo/đề xuất mô phỏng), Máy (bảng bước người/AI có luật gạt, nhật ký, chi phí AI, cấu hình, người dùng, nhập danh mục, mô phỏng).
- Test `tests/adr001.test.mjs`: 11 nhóm (seed, đổi mật khẩu, người dùng, luật gạt, điểm sẵn sàng, cấu hình, cron 1 lượt/ngày, danh mục, nhập, việc giao, mô phỏng).
