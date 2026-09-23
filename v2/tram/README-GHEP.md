# Ghép Kingsmen Content OS vào Trạm máy văn phòng (masfico-tram)

Trạm (repo `tranthien1205-arch/masfico-insight`, thư mục `may/`, chạy trên máy văn phòng cổng 8899) là **hub** cho nhiều app theo hợp đồng hub1 (`hub-apps.mjs`). Content OS ghép như một app hub1 — **không sửa `tram.mjs`**, chỉ thêm một agent + 3 script + 1 thư viện.

> Thư mục Trạm/repo đang được phiên Claude khác dùng (khoá bằng `~/.claude/hooks/khoa-thu-muc.mjs`). Các file ở đây để **ghép sau khi khoá mở**.

## 1. Chép vào repo masfico-insight (`may/`)
```
may/content-os-lib.mjs          ← v2/tram/content-os-lib.mjs
may/content-os-dang.mjs         ← v2/tram/content-os-dang.mjs
may/content-os-do-luong.mjs     ← v2/tram/content-os-do-luong.mjs
may/content-os-dung-video.mjs   ← v2/tram/content-os-dung-video.mjs
```
Trong `may/agents.mjs`: thêm `NHOM.noi_dung` và mục `AGENT_CONTENT_OS` (xem `agents-content_os.mjs`) vào mảng `AGENTS`. Tăng `VER` trong `tram.mjs`, commit, push `main` → trên trang Trạm bấm **Cài đặt → 🔄 Cập nhật Trạm** (Trạm tự `node --check` từng file rồi khởi động lại).

## 2. Ghép Content OS vào Trạm (một lần)
1. Content OS (Admin) → **Máy › 🖥 Trạm máy văn phòng › 🔑 Tạo khoá & mã ghép** → copy mã `HUB1.…` (hiện một lần).
2. Trang Trạm (http://127.0.0.1:8899 trên máy văn phòng) → **Cài đặt → Ứng dụng ghép → dán mã → Ghép**. Trạm ping `/api/hub/ping` thật rồi mới ghi sổ.
3. Trên thẻ app Content OS ở Trạm: bật **Cho nhận lệnh**. Kiểm: Content OS › Máy › Trạm hiện 🟢 nhịp tim (2 phút/lần).

Mã ghép chứa: `url = <gốc app>/api`, `mon = ["content_os.*","doi_thu.*","tiktok_cn.binh_luan"]` — Trạm sẽ đẩy về Content OS: kết quả đăng/đo/dựng của chính agent content_os, **tin đối thủ máy quét** (→ Ý tưởng, nguồn DOI_THU), bình luận TikTok.

## 3. Phiên đăng nhập trên Trạm mà Content OS dùng lại
- TikTok: agent **"TikTok kênh cá nhân"** (hồ sơ `tiktok_cn-profile`) — đăng nhập một lần trên Trạm.
- Facebook: agent **"Facebook"** (hồ sơ `facebook-profile`). Với Fanpage có token Page thì Content OS đăng/đo qua Graph API, không cần Trạm.
- ffmpeg cho dựng video: `winget install Gyan.FFmpeg` trên máy Trạm.

## 4. Luồng
| Việc | Content OS | Trạm |
|---|---|---|
| Đăng bài kênh cách đăng **TRAM** | tới giờ → bài `DANG_GUI` + lệnh `chay_agent content_os/dang` | `content-os-dang.mjs` hỏi `/hub/viec/dang`, đăng, báo lô `content_os.dang_ket_qua` → bài `DA_DANG`/`LOI` |
| Đo lường | (ADR-005) | `content-os-do-luong.mjs` 07:10 hỏi `/hub/viec/do_luong`, đọc số tích luỹ, lô `content_os.ket_qua` (Content OS giữ trong `tram_lo`, ADR-005 tính phần tăng) |
| Dựng video nháp | nút 🎬 ở Máy › Trạm hoặc lịch | `content-os-dung-video.mjs` hỏi `/hub/viec/dung_video`, ffmpeg, tải lên `/hub/upload`, lô `content_os.video` → tài sản VIDEO_XUAT gắn nội dung |
| Tin đối thủ | nhận lô `doi_thu_tin` → Ý tưởng (chống trùng, AI chấm nếu có key) | agent `doi_thu` có sẵn |

Trạm chỉ nhận bộ lệnh `VIEC_HUB` của nó (`chay_agent, chay_hang_loat, lich_viec, zalo_qr, gui_otp, huy_dang_nhap`); Content OS không sai được việc khác — đúng luật L4 (mọi hành động máy có dấu vết ở cả hai bên).
