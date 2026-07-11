# Deploy lên Vercel

App đóng gói ở thư mục **`dist/`** (`dist/index.html`). Vercel deploy chủ yếu qua **GitHub**
(giống cách bạn đang dùng với Cloudflare). Có 2 cách:

---

## Cách A — Qua GitHub (khuyến nghị, tự động deploy khi sửa)
1. Tạo 1 repo GitHub (vd `kingsmen-seeding`), đẩy **cả thư mục dự án** lên.
2. Vào https://vercel.com → đăng nhập bằng GitHub.
3. **Add New… → Project** → chọn repo vừa tạo → **Import**.
4. Ở màn cấu hình:
   - **Framework Preset**: `Other`
   - **Root Directory**: bấm **Edit** → chọn **`dist`**
   - Build Command / Output: để trống (static)
5. **Deploy** → có link `https://<ten>.vercel.app`.
6. Từ nay `git push` là Vercel tự deploy bản mới.

## Cách B — Vercel CLI (không cần GitHub, cần Node.js)
```bash
npm i -g vercel
cd "D:\APP SEEDING COMMUNITY\dist"
vercel            # lần đầu: đăng nhập + tạo project
vercel --prod     # deploy production
```

---

## Gắn Supabase (biến app thành bản dùng chung nhiều người)
Xem file **`DEPLOY.md`** (phần A–C) để:
1. Tạo project Supabase, chạy `supabase/schema.sql` + `supabase/storage.sql`.
2. Lấy **Project URL** + **anon public key**.
3. Gửi cho mình 2 khoá đó → mình nối app + test, rồi bạn deploy lại lên Vercel.

> Khi đã dùng Supabase: dữ liệu **chung cho cả đội**, đăng nhập bằng email, ảnh lưu cloud,
> hàng chờ duyệt realtime. Lúc đó KHÔNG cần `DEMO_MODE` nữa (đặt `false`).
