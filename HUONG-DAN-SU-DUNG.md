# Hướng dẫn sử dụng — Kingsmen Seeding (bản dùng thật)

**Link app:** https://kingsmen-app-seeding.tranthien1205.workers.dev

Dữ liệu **dùng chung cho cả đội** (lưu trên Cloudflare D1). Ai đăng nhập ở máy/điện thoại nào cũng thấy cùng số liệu.

---

## 1. Đăng nhập lần đầu (Marketing)
Tài khoản Marketing mặc định (quyền cao nhất):
- **Email:** `mkt@kingsmen.vn`
- **Mật khẩu:** `123456`

👉 Vào ngay **👥 Tài khoản** → bấm **Sửa** dòng của bạn → đổi **mật khẩu** (và họ tên) → Lưu.

## 2. Tạo tài khoản cho Sales / Kế toán
**👥 Tài khoản → ＋ Tạo tài khoản** → nhập Họ tên, Email, Mật khẩu, chọn Vai trò → **Tạo & cấp**.
Gửi **email + mật khẩu** đó cho nhân viên. Họ mở link, đăng nhập là dùng được ngay (không tự đăng ký).

- **Sales:** nhận việc, seeding, báo cáo, xem thu nhập.
- **Admin / Kế toán:** đơn giá, bảng lương, đánh dấu Đã chi.
- **Marketing:** duyệt seeding, quản lý thư viện & tài khoản (quyền cao nhất).

Đổi vai trò / khoá (Tắt) / xoá tài khoản: ngay tại màn **Tài khoản**.

## 3. Vận hành hằng ngày
- **Marketing:** cập nhật **Thư viện** (group / chủ đề / gợi ý cmt, gắn ⭐ ưu tiên); **Nghiệm thu** POST/CMT (Đạt → tự tính tiền; Không đạt → nhập lý do).
- **Sales:** **Tạo POST** (chọn nội dung → copy → mở group đăng → dán link) / **Tạo CMT** (mình đăng hoặc dạo → up ảnh) → gửi nghiệm thu.
- **Kế toán:** **Bảng lương** → **Đã chi** theo kỳ; xuất Excel.

## 4. Xoá dữ liệu TEST để bắt đầu sạch (làm 1 lần)
Trong lúc dựng, có vài bản ghi test (tài khoản `nv1@`, `saletest@`, 1 post mẫu). Xoá sạch để bắt đầu:

1. Cloudflare → **Storage & Databases → D1** → mở `appseedingkingsmen-db` → tab **Console**.
2. Dán và **Run** lệnh sau (giữ lại thư viện + đơn giá; xoá mọi tài khoản & giao dịch; tài khoản Marketing mặc định sẽ **tự tạo lại** khi có người đăng nhập lần kế tiếp):
   ```sql
   DELETE FROM post_seedings;
   DELETE FROM cmt_seedings;
   DELETE FROM cmt_proofs;
   DELETE FROM sessions;
   DELETE FROM audit;
   DELETE FROM users;
   ```
3. Mở lại app → đăng nhập `mkt@kingsmen.vn` / `123456` (được tạo lại) → đổi mật khẩu → tạo tài khoản thật.

> Muốn xoá cả thư viện mẫu, thêm: `DELETE FROM groups; DELETE FROM content_topics; DELETE FROM cmt_suggestions;`

## 5. Cập nhật app về sau
Sửa `seeding-app.html` → đồng bộ `dist/index.html` → `git push` → Cloudflare tự deploy. (Backend nằm ở `worker/index.js`, database là Cloudflare D1.)

## Ghi chú kỹ thuật
- Mật khẩu lưu **băm PBKDF2** (không lưu thô).
- Phân quyền enforce **phía server**: Sales chỉ thấy/sửa việc của mình, không tự Đạt; tính tiền chạy ở server.
- Ảnh báo cáo hiện lưu nén trong D1 (đủ cho lượng nhỏ). Nếu ảnh nhiều, nâng lên Cloudflare R2 sau.
