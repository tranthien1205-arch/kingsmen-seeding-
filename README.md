# Kingsmen Seeding

App quản lý & nghiệm thu seeding (Marketing duyệt · Sales báo cáo · tự tính tiền).

## Cấu trúc
- `seeding-app.html` — **file nguồn** của app (React + Tailwind, 1 file). Mở trực tiếp được (dùng CDN) để dev nhanh.
- `tools/loc-video.html` — công cụ Lọc & dựng video (nhúng trong Creative Studio).
- `worker/index.js` + `wrangler.toml` — backend Cloudflare Worker (API + D1 + R2 + cron), phục vụ luôn web tĩnh từ `dist/`.
- `build.mjs` — build `dist/`: biên dịch JSX sẵn, CSS Tailwind build sẵn, React tự host, chép `tools/`.
- `dist/` — **sản phẩm build, không sửa tay** (`index.html` + `app.<hash>.js` + `app.<hash>.css` + `vendor/` + `tools/`).
- `docs/CONTENT_OS_PLAN.md` — nguồn sự thật về kiến trúc, tiến độ, quy trình.

## Lấy code về máy & chạy thử
```bash
git clone https://github.com/tranthien1205-arch/kingsmen-seeding-.git
cd kingsmen-seeding-
npm install          # lần đầu (cần Node.js 18+)
```
- **Xem giao diện nhanh:** double-click `Chay-App-Seeding.bat` (Windows) → mở `http://localhost:5177/seeding-app.html`. Bản này gọi thẳng API của app thật trên Cloudflare, nên đăng nhập bằng tài khoản thật.
- **Kiểm tra bản build:** `npm run build` rồi mở `dist/index.html` qua một static server bất kỳ (ví dụ `npx serve dist`).

## Sửa code → đưa lên app thật
1. Sửa `seeding-app.html` (giao diện) và/hoặc `worker/index.js` (backend).
2. `npm run build` — sinh lại `dist/`.
3. `node --check worker/index.js` nếu có sửa backend.
4. Commit **cả `dist/`**, push lên nhánh, mở PR vào `main`. Merge vào `main` → Cloudflare tự deploy (Production branch = `main`).
