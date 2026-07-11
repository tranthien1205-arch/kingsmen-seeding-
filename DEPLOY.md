# Deploy Kingsmen Seeding — dữ liệu dùng chung (Supabase, miễn phí)

Mục tiêu: nhiều người (Marketing, Sales, Admin) dùng **chung một nguồn dữ liệu**, xem realtime, ảnh lưu trên cloud — thay cho bản localStorage (dữ liệu riêng từng máy).

Kiến trúc: **File HTML tĩnh** (host miễn phí) + **Supabase** (Postgres + Auth + Storage). Toàn bộ đều có gói **Free**.

---

## Phần A — Tạo Supabase (bạn tự làm, ~10 phút)

1. Vào https://supabase.com → **Start your project** → đăng nhập bằng GitHub/Google.
2. **New project**:
   - Name: `kingsmen-seeding`
   - Database password: đặt 1 mật khẩu mạnh, **lưu lại** (sau này cần thì dùng).
   - Region: chọn **Southeast Asia (Singapore)** cho nhanh.
   - Bấm **Create new project** → chờ ~2 phút.
3. **Chạy schema**: menu trái → **SQL Editor** → **New query** → mở file
   `supabase/schema.sql`, copy toàn bộ, dán vào, bấm **Run**. Phải thấy "Success".
4. **Tạo bucket ảnh**: menu trái → **Storage** → **New bucket** → tên **`proofs`** →
   bật **Public bucket** → Save. Rồi quay lại **SQL Editor**, chạy tiếp file
   `supabase/storage.sql`.
5. *(Tuỳ chọn)* Muốn có sẵn thư viện mẫu để test: chạy file `supabase/seed-library.sql`.

## Phần B — Lấy khoá để tôi nối app

Menu trái → **Project Settings** (bánh răng) → **API**. Gửi tôi **2 giá trị**:

- **Project URL** — dạng `https://xxxxxxxx.supabase.co`
- **anon public** key — chuỗi dài bắt đầu bằng `eyJ...`

> ✅ Hai giá trị này **an toàn để nhúng vào web** (được RLS bảo vệ).
> ❌ **KHÔNG** gửi `service_role` key (khoá bí mật, bỏ qua RLS).

Có 2 khoá này, tôi sẽ chuyển app sang Supabase và **test thật** trước khi bàn giao.

## Phần C — Tạo người dùng & phân quyền

Sau khi app nối xong, với mỗi nhân sự:

1. **Authentication → Users → Add user** (hoặc để họ tự đăng nhập lần đầu bằng OTP email).
2. Mặc định mọi user mới là **SALES**. Nâng quyền bằng SQL (SQL Editor):
   ```sql
   -- Cho chính bạn làm Admin:
   update profiles set vai_tro='ADMIN' where email='ban@congty.com';
   -- Cho 1 bạn làm Marketing:
   update profiles set vai_tro='MARKETING' where email='mkt@congty.com';
   ```

## Phần D — Đưa web lên mạng (miễn phí, có HTTPS)

Chọn **1** trong các cách sau (đều free, chạy được trên điện thoại):

### Cách 1 — Netlify Drop (dễ nhất, kéo-thả)
1. Vào https://app.netlify.com/drop
2. Kéo file `seeding-app.html` (bản đã nối Supabase) vào trang → có ngay link
   `https://ten-ngau-nhien.netlify.app`. Đổi tên site trong Site settings nếu muốn.

### Cách 2 — Cloudflare Pages / Vercel
- Tạo repo GitHub chứa file, kết nối Cloudflare Pages hoặc Vercel → auto deploy.

> Không cần VPS. File tĩnh + Supabase là đủ cho production nhỏ. Nếu vẫn muốn VPS,
> Oracle Cloud "Always Free" là lựa chọn VPS miễn phí vĩnh viễn — nhưng phức tạp hơn
> và với app này không cần thiết.

---

## Giới hạn gói Free (đủ cho đội nhỏ)
- Supabase Free: 500MB database, 1GB storage ảnh, 50k người dùng auth/tháng.
  Ảnh đã được app nén trước khi upload nên 1GB dùng được rất lâu.
- Netlify/Cloudflare Free: băng thông rộng rãi cho nội bộ.

## Tóm tắt việc cần bạn làm ngay
1. Làm **Phần A** (tạo project + chạy `schema.sql` + `storage.sql`).
2. Gửi tôi **Project URL** + **anon public key** (Phần B).
→ Tôi lo phần nối app + test, rồi hướng dẫn bạn bấm deploy (Phần D).
