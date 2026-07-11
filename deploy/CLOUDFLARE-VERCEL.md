# Deploy demo public lên Cloudflare Pages / Vercel

App demo đã đóng gói sẵn ở thư mục **`dist/`** (file `dist/index.html`).
Chọn 1 trong 2 nền tảng dưới — cả hai đều **miễn phí, HTTPS sẵn, chạy trên điện thoại**.

> Mỗi lần bạn sửa `seeding-app.html`, nhớ copy lại vào `dist/index.html` trước khi deploy
> (hoặc nhờ mình copy). File đang deploy là `dist/index.html`.

---

## Cách A — Cloudflare Pages (Direct Upload, KHÔNG cần GitHub) ⭐ dễ nhất
1. Vào https://dash.cloudflare.com → đăng ký/đăng nhập (miễn phí).
2. Menu trái **Workers & Pages** → **Create** → tab **Pages** → **Upload assets**.
3. Đặt tên project (vd `kingsmen-seeding-demo`) → **Create project**.
4. Kéo-thả **cả thư mục `dist`** (hoặc chọn file `dist/index.html`) vào ô upload → **Deploy**.
5. Xong: link dạng `https://kingsmen-seeding-demo.pages.dev` — gửi cho ai cũng xem được.

Cập nhật sau này: vào project → **Create new deployment** → upload lại `dist` mới.

## Cách B — Cloudflare Pages qua GitHub (tự động deploy khi sửa)
1. Tạo repo GitHub, đẩy toàn bộ thư mục dự án lên.
2. Cloudflare **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → chọn repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(để trống)*
   - Build output directory: **`dist`**
4. **Save and Deploy**. Từ nay `git push` là tự deploy.

## Cách C — Vercel
1. Vào https://vercel.com → đăng nhập bằng GitHub.
2. **Add New… → Project** → import repo (hoặc dùng **Vercel CLI**: `npm i -g vercel` rồi chạy `vercel` trong thư mục `dist`).
3. Framework Preset: **Other**; Output/Root: trỏ tới `dist`.
4. **Deploy** → link `https://<ten>.vercel.app`.

---

## Ghi nhớ
- Đây là **demo**: mỗi người xem có dữ liệu riêng (localStorage) và đã được **seed sẵn**
  vài post/cmt + bảng lương để thấy ngay luồng. Có nút **Reset dữ liệu** ở màn đăng nhập.
- Khi muốn dùng **thật, nhiều người chung dữ liệu**: mở `seeding-app.html`, đổi
  `const DEMO_MODE = true` → `false`, rồi chuyển sang Supabase (xem `DEPLOY.md`).
