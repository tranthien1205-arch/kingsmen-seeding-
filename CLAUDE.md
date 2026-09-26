# Kingsmen Content OS — luật cho mọi phiên Claude (nhiều máy cùng làm repo này)

Repo này được sửa từ **nhiều máy cùng lúc** (máy Ngoc-Han và Máy VP Q2, mỗi máy một phiên Claude). Ngày 24/09/2026 hai phiên deploy cùng một
Worker cách nhau 1 phút, bản sau đè bản trước. Vì vậy:

## Deploy
- **Chỉ deploy bằng `cd v2 && npm run deploy`** (file `v2/deploy.mjs`). **Không chạy `npx wrangler deploy` trực tiếp.**
- Lệnh đó tự chặn khi: còn file chưa commit trong `v2/`, máy lệch `origin/main`, máy khác đang giữ khoá deploy, bản đang chạy trên
  Cloudflare chứa commit máy này chưa có, hoặc có ai đã deploy ngoài lệnh này. Nó chạy test, build, deploy kèm `--message "<commit> · <máy>"`,
  ghi sổ `module_config.deploy_so` và nhả khoá `module_config.deploy_lock` (tự hết hạn sau 10 phút).
- Bị chặn thì làm đúng lời nhắn (thường là `git pull --rebase` rồi `git push`), không dùng `--bo-qua-so` trừ khi đã kiểm tay bản trên Cloudflare.
- Thử không deploy: `npm run deploy:thu`.

## Git
- Luôn `git fetch` + `git pull --rebase --autostash` trước khi sửa và trước khi push. Không `--force`.
- `git add` đúng file, không `git add -A`.
- Commit rồi push trước khi deploy — deploy chỉ nhận code đã có trên `origin/main`.

## Vận hành thay chủ (ADR-019)
- Muốn app làm việc gì thay chủ (chạy trợ lý, giao dựng, gửi duyệt, trả lại bài), dùng `cd v2 && node scripts/thay-chu.mjs <lệnh>`. Chạy `node scripts/thay-chu.mjs xem` để xem trạng thái.
- Không tự viết SQL hay JS trong trình duyệt để đổi dữ liệu app.
- **Không có lệnh duyệt.** Bài đạt ngưỡng do luật "Chế độ AI thay chủ" tự duyệt, và chỉ khi chủ đã bật luật đó ở Máy › Bước: người hay AI. AI không bật / tắt luật, không bấm Duyệt thay người.
- Nhãn kho mẫu vẫn đi hàng `viec_thay_chu` (mau.js `chayViecThayChu`).

## Máy con (`v2/tools/may-dung`)
- Script phát cho máy con lấy từ `dist/tools/may-dung` sau build. Sửa `tools/may-dung/*` rồi build; không sửa file máy con tại chỗ trên máy
  (sửa tại chỗ sẽ mất ở lần cập nhật sau và máy khác không có).
- Sổ quyết định và changelog: `v2/docs/SO_ADR.md`.
