# ADR-020 — Trục phân nhóm video (mục đích · cấu trúc · kiểu mở đầu · phong cách · góc quay)

**Trạng thái:** ĐÃ DUYỆT 26/09/2026 (chủ: "ok") · đợt 1–3 đã làm
**Chủ hỏi:** "trong huấn luyện mô hình có cần phân nhóm nhỏ hơn các loại video theo mục đích sử dụng, theo cấu trúc, theo phong cách, theo góc quay… một cách hợp lý không. Khi đó đầu ra sẽ tuỳ chọn linh hoạt và đa dạng" → "làm đi nhé".

## Quyết định

Mỗi **video thành phẩm** có 5 trục, mỗi trục một bộ giá trị **cố định, ít** (5–8 giá trị). **Góc quay** gắn theo từng **đoạn**, không theo cả video.
Không tách mô hình theo nhóm (89 video, chia nhỏ là mỗi nhóm vài video). Vẫn **một mô hình chung**; các trục là **điều kiện đầu vào** khi học và khi làm video mới.

| Trục | Mức | Giá trị |
|---|---|---|
| Mục đích | video | QUANG_CAO (chạy ads chuyển đổi) · THUONG_HIEU · BAN_HANG_HANG_NGAY (TikTok Shop / live) · HUONG_DAN (thi công) · CHUNG_MINH (test độ bền, so sánh) · PHAN_HOI (khách / đại lý / công trình thật) |
| Cấu trúc | video | VAN_DE_GIAI_PHAP (vấn đề → giải pháp → bằng chứng → chốt) · TRUOC_SAU · TUNG_BUOC · THU_NGHIEM · KE_CHUYEN · DANH_SACH (3 lý do / 5 lỗi…) |
| Kiểu mở đầu (3 giây đầu) | video | CAU_HOI · KET_QUA_TRUOC · LOI_HAY_GAP · CON_SO · HANH_DONG_MANH · CAM_XUC |
| Phong cách | video | NGUOI_NOI (nhìn camera) · LONG_TIENG · CHU_VA_NHAC (không lời) · AM_THANH_THAT (ASMR thi công) · TREND |
| Góc quay | đoạn | CAN_CHI_TIET · TRUNG · TOAN_CANH · POV (góc thợ) · TREN_XUONG · SPLIT_TRUOC_SAU |

Nhịp (độ dài, số cảnh, thời lượng cảnh trung bình) máy đã tự đo — không cần gán.

## Ai gán

- **Thầy (Claude) gán** khi học video: đọc lời thoại + dải ảnh từng đoạn đã có → 4 trục cấp video + góc quay từng đoạn. Chi phí ước ~0,01–0,02 USD / video (chỉ đọc chữ + ảnh đã có, không xem lại video). 89 video cũ gán bù một lần ≈ 1–2 USD.
- **Footage gốc:** tên thư mục con là nhãn sẵn (VD "6. POV", "1. SOURCE - GÓC CẬN & TRUNG") → gán góc quay không tốn thầy.
- **Người sửa** ở Kho mẫu / Nguồn học khi thầy sai; nhãn người luôn thắng.
- Giá trị mới ngoài bộ cố định → thành **đề xuất** ở Bộ nhãn (như cơ chế bộ nhãn hiện có), không tự thêm.

## Dùng ở đâu

1. **Nguồn học:** lọc theo trục; thấy thiếu nhóm nào (VD Terrazy chưa có video "chứng minh").
2. **Kết quả:** ghép trục với lượt xem / doanh thu (TikTok, Kalodata, Reels) → bảng "tổ hợp nào hiệu quả cho dòng nào".
3. **Tạo video mới:** mục kế hoạch chọn (hoặc máy đề xuất theo bảng hiệu quả) mục đích · cấu trúc · kiểu mở đầu · phong cách →
   - trợ lý viết kịch bản theo cấu trúc đó, lấy ví dụ từ video cùng tổ hợp;
   - máy dựng chọn đoạn footage đúng góc quay cho từng cảnh, nhịp theo nhóm video bán tốt;
   - một bộ footage ra nhiều phiên bản (khác cấu trúc / mở đầu) để thử A/B.

## Ngưỡng

- Một giá trị được dùng làm điều kiện khi học khi có **≥ 15 video**; dưới ngưỡng → gộp về "chung".
- Máy báo ở Nguồn học: "Terrazy × CHUNG_MINH: 2/15 video — cần thêm nguồn".

## Làm theo đợt

1. Bảng + thầy gán 4 trục cấp video + góc quay đoạn; gán bù video cũ; hiện ở Nguồn học (lọc, thiếu nhóm).
2. Ghép với số hiệu quả → bảng tổ hợp hiệu quả ở Kết quả.
3. Mục kế hoạch chọn tổ hợp → kịch bản + dựng theo tổ hợp; nhiều phiên bản A/B.

## Không làm

- Không tách mô hình riêng theo nhóm.
- Không cho thầy tự thêm giá trị trục (chỉ đề xuất).
- Không gán trục cho footage bằng thầy khi tên thư mục đã nói rõ.
