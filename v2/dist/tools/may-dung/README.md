# Máy dựng video — Kingsmen Content OS (ADR-008)

Máy con rút gọn: nhận lệnh **dựng video nháp** từ app cho tài khoản của bạn. Không cài Playwright, không giữ tài khoản mạng xã hội. Mã dựng nằm ở app — máy tải bản mới nhất mỗi lần chạy.

## Cài một lần (Windows)
1. Cài **Node.js 22** (https://nodejs.org) và **ffmpeg**: mở PowerShell, chạy `winget install Gyan.FFmpeg`, đóng mở lại cửa sổ.
2. Tạo thư mục, ví dụ `C:\may-dung`, tải 3 file vào đó: `may-dung.mjs`, `BAT-DAU.bat`, `README.md` (link ở app › Hồ sơ › Máy dựng).
3. Trong app: **Hồ sơ › Máy dựng › ＋ Kết nối máy này** → copy mã ghép (hiện một lần).
4. Chạy `BAT-DAU.bat`, dán mã ghép khi được hỏi. Máy báo nhịp tim 2 phút/lần; app hiện 🟢 ở Hồ sơ › Máy dựng.

## Bật phần AI (tuỳ chọn — ADR-009)
- Mô hình nhìn mở (chọn cảnh, huấn luyện đầu học): trong thư mục máy con chạy `npm install` (tải @huggingface/transformers; CLIP ~150 MB tải lần đầu). Máy sẽ khai `mo_hinh` + `huan_luyen` với app. Có GPU NVIDIA thì nhanh hơn, không bắt buộc.
- Mô hình ngôn ngữ mở chạy bóng: cài Ollama (https://ollama.com) rồi `ollama pull qwen2.5:7b`. Máy tự nhận ra Ollama đang chạy.
- Giọng đọc mở (Piper, ADR-009c): tự tải `piper` + giọng `vi_VN-vais1000-medium` vào thư mục `piper/` lần đầu dựng khi tính năng tts ở mức BÓNG/MỞ.
- Lọc footage (Whisper + CLIP): cần `npm install` (whisper-base tải lần đầu ~150 MB); bấm 🤖 Máy lọc footage ở thẻ video.
- LoRA ngôn ngữ: `node may-dung.mjs xuat-tap-mau soan_nhap_agent` → đưa `.train.jsonl` + `huan-luyen-ngon-ngu.py` lên GPU thuê → `ollama create kingsmen-qwen:v1` → `node may-dung.mjs phien-ban kingsmen-qwen:v1` → Trưởng MKT duyệt trong app.
- Mã các phần này cũng phát từ app, máy chỉ giữ bản cache theo hash.

## Dùng
- Ở thẻ video đã duyệt › tab **Sản xuất** › **🎬 Dựng trên máy…** chọn máy của bạn. Máy tải footage/ảnh của thẻ, đọc lời bình bằng giọng Google (nếu Admin đã cắm khoá), trộn nhạc nền, in phụ đề, xuất **bản nháp** và **gói CapCut** (từng cảnh + giọng + SRT + nhạc) về thẻ.
- Máy nào cũng chạy được lệnh của người khác nếu người đó chọn máy bạn; máy chỉ nhận lệnh gửi đích danh cho nó.
- Kết quả xem ở thẻ › Sản xuất; việc "Xem & duyệt video nháp" xuất hiện ở Việc của tôi.

## Gỡ
Xoá máy ở app (Hồ sơ › Máy dựng › Gỡ) → khoá hết hiệu lực; xoá thư mục là xong.
