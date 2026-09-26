# Máy dựng video — Kingsmen Content OS (ADR-008)

Máy con rút gọn: nhận lệnh **dựng video nháp** từ app cho tài khoản của bạn. Không cài Playwright, không giữ tài khoản mạng xã hội. Mã dựng nằm ở app — máy tải bản mới nhất mỗi lần chạy.

## Cài một lần (Windows)
1. Cài **Node.js 22** (https://nodejs.org) và **ffmpeg**: mở PowerShell, chạy `winget install Gyan.FFmpeg`, đóng mở lại cửa sổ.
2. Tạo thư mục, ví dụ `C:\may-dung`, tải 3 file vào đó: `may-dung.mjs`, `BAT-DAU.bat`, `README.md` (link ở app › Hồ sơ › Máy dựng).
3. Trong app: bấm vào **tên của bạn** (góc dưới bên trái) → hộp Hồ sơ của tôi → khung **🎬 Máy dựng của tôi** → **＋ Kết nối máy này** → copy mã ghép (hiện một lần). Khung này chỉ hiện với vai trò Marketing, Trưởng MKT, Admin.
4. Chạy `BAT-DAU.bat`, dán mã ghép khi được hỏi. Máy báo nhịp tim 2 phút/lần; app hiện 🟢 ở Hồ sơ › Máy dựng.

## Bật phần AI (tuỳ chọn — ADR-009)
- Mô hình nhìn mở (chọn cảnh, huấn luyện đầu học): trong thư mục máy con chạy `npm install` (tải @huggingface/transformers; CLIP ~150 MB tải lần đầu). Máy sẽ khai `mo_hinh` + `huan_luyen` với app. Có GPU NVIDIA thì nhanh hơn, không bắt buộc.
- Mô hình ngôn ngữ mở chạy bóng: cài Ollama (https://ollama.com) rồi `ollama pull qwen2.5:7b`. Máy tự nhận ra Ollama đang chạy.
- Giọng đọc mở (Piper, ADR-009c): tự tải `piper` + giọng `vi_VN-vais1000-medium` vào thư mục `piper/` lần đầu dựng khi tính năng tts ở mức BÓNG/MỞ.
- Lọc footage (Whisper + CLIP): cần `npm install` (whisper-base tải lần đầu ~150 MB); bấm 🤖 Máy lọc footage ở thẻ video.
- LoRA ngôn ngữ: máy có GPU NVIDIA ≥ 8 GB cài một lần `irm https://content.masfico.vn/tools/may-dung/cai-hoc-ngon-ngu.ps1 | iex` (Python 3.12 + torch CUDA + unsloth, ~10 GB). Rồi `node may-dung.mjs xuat-tap-mau soan_nhap_agent` → `HUAN-LUYEN.bat <file .train.jsonl>` tại máy (hoặc đưa `.train.jsonl` + `huan-luyen-ngon-ngu.py` lên GPU thuê) → `ollama create kingsmen-qwen:v1` → `node may-dung.mjs phien-ban kingsmen-qwen:v1` → Trưởng MKT duyệt trong app.
- Mã các phần này cũng phát từ app, máy chỉ giữ bản cache theo hash.

## Dùng
- Ở thẻ video đã duyệt › tab **Sản xuất** › **🎬 Dựng trên máy…** chọn máy của bạn. Máy tải footage/ảnh của thẻ, đọc lời bình bằng giọng Google (nếu Admin đã cắm khoá), trộn nhạc nền, in phụ đề, xuất **bản nháp** và **gói CapCut** (từng cảnh + giọng + SRT + nhạc) về thẻ.
- Máy nào cũng chạy được lệnh của người khác nếu người đó chọn máy bạn; máy chỉ nhận lệnh gửi đích danh cho nó.
- Kết quả xem ở thẻ › Sản xuất; việc "Xem & duyệt video nháp" xuất hiện ở Việc của tôi.
- Tắt/khởi động lại giữa chừng: máy con (bản 1.4+) nhớ lệnh đang làm ở `dang-lam.json`, lần chạy sau tự làm tiếp (script bỏ phần đã xong), tối đa 3 lần.
- Khởi động lại hằng ngày (máy chạy lâu cho ổn định): `irm https://content.masfico.vn/tools/may-dung/cai-khoi-dong-lai.ps1 | iex` → tác vụ 4:00 sáng chờ máy con làm xong (tối đa 3 giờ) rồi khởi động lại. Cần bật **tự đăng nhập Windows** (Autologon của Microsoft) — không thì máy nằm ở màn hình khoá và máy con không chạy.
- **Chạy khi bật máy, không cần đăng nhập** (26/09, máy con 1.6): PowerShell *Run as administrator* → `irm https://content.masfico.vn/tools/may-dung/cai-chay-nen.ps1 | iex`. Tạo tác vụ Windows kiểu S4U dưới chính tài khoản này (không lưu mật khẩu) chạy `CHAY-NEN.bat` lúc khởi động. Mỗi máy chỉ một máy con chạy (khoá `dang-chay.json`): cửa sổ BAT-DAU đang mở thì bản nền chờ, đóng cửa sổ là bản nền nhận việc; máy con treo quá 20 phút thì bản sau dừng nó và nhận thay. Giới hạn: không vào được ổ mạng (\máy-khác…) — thư mục nạp để trên ổ của chính máy.
- Nhật ký: mọi dòng hiện trên cửa sổ đen cũng được ghi vào `may-dung.log` cạnh máy con (quá 5 MB thì bản cũ sang `may-dung.log.1`). Máy dừng vì lỗi bất ngờ thì dòng `[LỖI]` cuối file cho biết lý do.

## Gỡ
Xoá máy ở app (Hồ sơ › Máy dựng › Gỡ) → khoá hết hiệu lực; xoá thư mục là xong.
