# Kingsmen Content OS (app mới)

Bản vẽ: [`../docs/CONTENT_OS_V2_BAN_VE.md`](../docs/CONTENT_OS_V2_BAN_VE.md) · Sổ ADR & changelog: [`docs/SO_ADR.md`](docs/SO_ADR.md)

## Chạy cục bộ (không cần Cloudflare)
```bash
cd v2 && node build.mjs && node dev.mjs
```
Mở http://localhost:5180 — tài khoản đầu `admin@kingsmen.vn / admin123` (bị bắt đổi mật khẩu ngay). Dữ liệu nằm ở `v2/.dev.sqlite` (`--fresh` để làm lại). Vào **Máy › 🧪 Mô phỏng › Nạp** để xem 5 màn với dữ liệu giả.

## Kiểm thử
```bash
cd v2 && npm test
```

## Deploy Cloudflare (một lần)
```bash
cd v2
npx wrangler d1 create kingsmen-content-os-db        # dán database_id vào wrangler.toml
npx wrangler r2 bucket create kingsmen-content-os-media
npx wrangler secret put ANTHROPIC_API_KEY             # bộ não (đợt 2+)
npx wrangler secret put TOKEN_KINGSMEN                # token Page theo mã API kênh (đợt 3+)
node build.mjs && npx wrangler deploy
```

## Nhập danh mục gốc từ app cũ (một lần)
```bash
node scripts/xuat-danh-muc-cu.mjs https://kingsmen-app-seeding.tranthien1205.workers.dev email@kingsmen.vn
```
Script hỏi mật khẩu app cũ, ghi `danh-muc.json`; dán nội dung vào **Máy › Nhập danh mục**. Không nhập nội dung/kịch bản/kết quả cũ (đã chốt bỏ dữ liệu cũ).

## Cấu trúc
- `worker/index.js` — API + schema + agent điều phối (cron) · `app/src/*.jsx` — 5 màn, gộp theo thứ tự tên · `tests/` — D1 giả lập + test theo ADR · `dist/` — bản build (commit kèm).
