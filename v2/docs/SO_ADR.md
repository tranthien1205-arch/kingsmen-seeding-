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

## Changelog

### 2026-09-23 · ADR-001 (đợt 1)
- **Nền**: `v2/wrangler.toml` (project `kingsmen-content-os`, D1 `kingsmen-content-os-db`, R2 `kingsmen-content-os-media`, cron 15'), `build.mjs` (gộp `app/src/*.jsx` theo tên → Babel → Tailwind từ `app/tailwind.config.json`), `dev.mjs` (Worker thật + D1 giả lập `node:sqlite`, không cần wrangler), `tests/` (node --test).
- **Worker**: schema đợt 1 (`users, sessions, audit(tac_nhan), module_config, ai_usage, chien_luoc, pillars, frameworks, san_pham, claim_cam, kenh, buoc_thuc_hien, mau_hoc, agent_run, cong_viec`); seed admin `admin@kingsmen.vn/admin123` bắt đổi mật khẩu; 12 bước NGƯỜI; API: login/logout/bootstrap/me, users (ADMIN/TRUONG_MKT; chỉ Admin tạo/sửa Admin), chiến lược PUT, `/danh-muc/:bang` CRUD (tắt thay vì xoá, claim xoá thật), `/nhap/danh-muc` (Admin, upsert), `/buoc/:ma` PATCH (luật gạt), `/may/chay-thu`, `/cau-hinh/:key` PUT (validator), `/cong-viec` + xong/bỏ, `/mo-phong/nap|xoa`. Agent đăng ký: `TINH_SAN_SANG`. AI helpers (goiAI, ngân sách, ngân sách học) sẵn cho đợt 2.
- **Giao diện 5 màn**: Việc của tôi (4 cổng, việc được giao, máy hôm nay), Chiến lược & Kế hoạch (chiến lược cơ bản + 6 danh mục gốc; tab Kế hoạch mô phỏng), Dòng chảy (khung 6 giai đoạn + kanban mô phỏng + hàng đợi duyệt mô phỏng), Kết quả & Báo cáo (3 mức + báo cáo/đề xuất mô phỏng), Máy (bảng bước người/AI có luật gạt, nhật ký, chi phí AI, cấu hình, người dùng, nhập danh mục, mô phỏng).
- Test `tests/adr001.test.mjs`: 11 nhóm (seed, đổi mật khẩu, người dùng, luật gạt, điểm sẵn sàng, cấu hình, cron 1 lượt/ngày, danh mục, nhập, việc giao, mô phỏng).
