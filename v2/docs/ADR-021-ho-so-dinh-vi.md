# ADR-021 — Hồ sơ định vị: lõi · ý đồ triển khai · xu hướng & cái mới

**Trạng thái:** LÀM theo yêu cầu trực tiếp của chủ 26/09/2026
**Chủ yêu cầu:**
- "nạp vào với ui chuẩn đẹp để tôi có thể xem lại và hữu ích cho app sử dụng, gốc content phải có ý đồ triển khai các chiến lược lõi này nhé"
- "nội dung định vị và chiến lược này mang tính cốt lõi và định hướng chứ không cứng nhắc vì phải luôn cập nhật xu hướng và cái mới để dễ dàng tiếp cận và linh hoạt cho đội ngũ sáng tạo"

**Nguồn:** 5 tài liệu chủ gửi 26/09:
- BOD.THI03 Chiến lược định vị 2026–2030
- Hồ sơ chiến lược định vị keo chít mạch (hai bản; bản thứ hai là Message House hoàn chỉnh gồm TDS, bảo hành, khảo sát đối thủ, định vị SKU)
- BOD.THI06 Định vị SKU keo
- Hồ sơ định vị Terrazy STP & 4P

## Vấn đề trước khi làm

- Trợ lý viết bài hard-code vai "thương hiệu keo ron gạch Kingsmen" ở cả 4 định dạng, cộng thêm 5 prompt khác (chấm ý tưởng, seeding, đọc bình luận, báo cáo, đề xuất thông điệp). Bài Terrazy vì thế vẫn bị viết như keo.
- Định vị nằm trong một khối chữ `chien_luoc.dinh_vi` 2.000 ký tự trộn keo, Terrazy và Finex. Bài nào cũng nhận cả khối đó.
- Lần nhập danh mục 26/09 gửi thông số sản phẩm dạng chuỗi, nhưng `lamSachDanhMuc` chỉ nhận mảng. Kết quả: cả 11 SKU lưu `[]`, trợ lý không có thông số thật. Lỗi này do mình gây ra.
- Mục nội dung không mang một hướng chiến lược nào. Máy B3 tạo mục chỉ theo pillar × định dạng, tiêu đề để "— đặt tiêu đề".

## Quyết định

1. **Ba lớp** (theo lời chủ: cốt lõi, định hướng, không cứng nhắc):
   - **Lõi — giữ vững.** Gồm thương hiệu mẹ; định vị từng dòng (câu định vị, lời hứa, 3 định vị chính, sự thật, trụ thông điệp / 3 dòng con Terrazy); khách hàng; chọn sản phẩm; bảo hành; lộ trình; quy tắc claim; cần bổ sung. Chỉ Trưởng MKT / Admin sửa. Lưu ở `module_config.ho_so_dinh_vi` (JSON, có `phien` chống ghi đè mù). Khi chưa ai sửa, app dùng bản gốc `worker/ho-so-dinh-vi.js`, có trong git nên xem lại được từng dòng.
   - **Ý đồ triển khai — gợi ý hướng đi.** Hiện có 18 ý đồ: 8 keo, 8 Terrazy, 1 thương hiệu mẹ, 1 "Bắt trend – neo thông điệp lõi". Mỗi ý đồ gồm:
     - trụ thông điệp, pillar, đối tượng, thông điệp lõi, bằng chứng nên có;
     - gợi ý cách kể theo 4 trục ADR-020 (chỉ là gợi ý, không bắt buộc);
     - định dạng, mục tiêu, ưu tiên, đề bài gợi ý, từ khoá, lưu ý claim.

     Trưởng MKT / Admin thêm, sửa hoặc tắt ý đồ, không cần sửa code.
   - **Xu hướng & cái mới — sống.** Lưu ở bảng `xu_huong`. Cả đội MKT thêm được: trend, định dạng mới, insight, câu hay. Mỗi xu hướng gắn một dòng hoặc mọi dòng, và tự hết hạn sau 2–26 tuần. Người thêm hoặc Trưởng MKT gỡ được.
2. **Gốc content mang ý đồ.** Thêm cột `muc_noi_dung.y_do` và `y_do_boi` (NGUOI hoặc MAY).
   - **Người chọn:** ở form mục, ở popup mục, hoặc bấm "＋ Tạo mục" từ một ý đồ. Chọn ý đồ riêng của một dòng thì mục nhận luôn dòng đó.
   - **Máy gắn:** khi thêm mục và mỗi lượt cron 15'. Máy chỉ xét ý đồ cùng dòng, chấm điểm theo pillar, sản phẩm, định dạng, mục tiêu và từ khoá, trừ điểm ý đồ đã nhiều mục để rải đều. Dưới 4 điểm thì để trống cho người chọn, không đoán.
   - **B3 máy tạo mục:** gắn ý đồ cùng pillar, rải đều, lấy đề bài gợi ý của ý đồ làm tiêu đề.
3. **Trợ lý viết theo dòng.** Vai là "Kingsmen — <dòng> (câu định vị)", không còn "keo ron gạch". Prompt gồm:
   - khối định vị lõi của đúng dòng;
   - ý đồ của mục;
   - sản phẩm trong dòng, khi bài chưa gắn sản phẩm;
   - thông số chung của hệ keo (TDS);
   - quy tắc "nói đúng" của Terrazy;
   - 5 xu hướng mới nhất cùng dòng, dùng làm cảm hứng.

   Nguyên tắc 7: "Định vị là la bàn, không phải khuôn". Bài chưa rõ dòng thì nhận tóm tắt thương hiệu mẹ, câu định vị từng dòng và tóm tắt chiến lược. Năm prompt khác cũng đọc tóm tắt này.
4. **Sửa dữ liệu:**
   - `thongSoMang` nhận cả chuỗi lẫn mảng.
   - Cron chạy `suaThongSo2609` đúng một lần, chỉ điền SKU còn `[]`. Dữ liệu điền vào là thông số riêng từng SKU, không có giá, vì trợ lý không được nói giá.
   - Claim đề xuất có 4 cụm cảnh báo: "đầu tiên", "khuyên dùng", "chống ố vàng 30 năm", "cao nhất". Máy không tự thêm; Trưởng MKT / Admin bấm thêm vào Claim cấm.
5. **Giao diện:**
   - Tab đầu của Chiến lược & Kế hoạch là "🧭 Hồ sơ định vị": bản điện thoại trước, PC hai cột.
     - Băng thương hiệu mẹ, 3 lớp, rồi chọn dòng.
     - Cột trái: định vị dòng, mái nhà thông điệp (có nút chép câu), 3 dòng Terrazy, ý đồ triển khai (độ phủ tháng, "＋ Tạo mục", sửa).
     - Cột phải: xu hướng, khách hàng, chọn sản phẩm, rào cản, thi công, bảo hành, lộ trình, kênh, nói đúng, lợi thế, cần bổ sung, nguồn.
   - Tab cũ đổi tên thành "Tóm tắt & chốt (G1)".
   - Chip 🧭 ý đồ hiện trên thẻ Tuần & mục và thẻ dòng chảy.

## Không làm (để sau)

- Chấm ý tưởng (B1) chưa trả thẳng ý đồ. Khi ý tưởng thành mục, máy gắn ý đồ theo luật ở mục 2.
- Finex F300 chưa có hồ sơ, nên không bịa ý đồ. Dòng này hiện "Cần bổ sung".
