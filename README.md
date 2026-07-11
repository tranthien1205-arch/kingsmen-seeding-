# Kingsmen Seeding

App quản lý & nghiệm thu seeding (Marketing duyệt · Sales báo cáo · tự tính tiền).

## Cấu trúc
- `seeding-app.html` — **file nguồn** của app (React + Tailwind, 1 file).
- `dist/index.html` — bản đóng gói để deploy (đồng bộ từ `seeding-app.html`).
- `supabase/` — schema SQL + RLS + trigger tính tiền (bản dùng chung nhiều người).
- `deploy/`, `DEPLOY.md`, `VERCEL.md` — hướng dẫn deploy.

## Deploy
Cloudflare Pages trỏ vào thư mục **`dist`** (xem `deploy/CLOUDFLARE-VERCEL.md`).
Mỗi lần cập nhật: sửa `seeding-app.html` → đồng bộ `dist/index.html` → commit → push → Cloudflare tự deploy.

## Chạy thử cục bộ
Mở thẳng `seeding-app.html`, hoặc double-click `Chay-App-Seeding.bat` để chạy localhost.
