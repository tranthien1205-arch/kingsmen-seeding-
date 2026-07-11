-- =====================================================================
--  DỮ LIỆU THƯ VIỆN MẪU (tuỳ chọn) — chạy sau schema.sql nếu muốn có sẵn
--  vài group / chủ đề / gợi ý cmt để test ngay. Xoá/sửa thoải mái sau.
-- =====================================================================

insert into groups (ten_group, link, loai, so_member, active, uu_tien) values
  ('Cộng đồng Xây nhà trọn gói',       'https://facebook.com/groups/xaynha',   'Nhà ở',       128000, true,  true),
  ('Thầu thợ hoàn thiện nội thất',      'https://facebook.com/groups/thautho',  'Thầu thợ',     56000, true,  true),
  ('Vật liệu hoàn thiện & thi công',    'https://facebook.com/groups/vatlieu',  'Vật liệu XD',  41000, true,  false),
  ('Nghiện nhà - Décor nội thất',       'https://facebook.com/groups/nghiennha','Nội thất',    220000, false, false)
on conflict do nothing;

insert into content_topics (chu_de, noi_dung, loai_bai, muc_tieu, tags, active, uu_tien) values
  ('Keo chít mạch chống ố vàng', 'Bạn đang đau đầu vì mạch gạch ố vàng, đen mốc sau vài tháng? Keo chít mạch Kingsmen kháng khuẩn, chống thấm, giữ màu bền 10 năm...', 'Chống ố vàng/Bảo hành', 'CÂN NHẮC', array['keo chít mạch','ố vàng'], true, true),
  ('ColorMatch - chọn màu mạch chuẩn', 'Đừng để mạch gạch phá hỏng cả không gian. Với bảng màu ColorMatch của Kingsmen bạn chọn được tông mạch ăn khớp gạch...', 'ColorMatch', 'BIẾT', array['colormatch','màu mạch'], true, true),
  ('Review thi công thực tế', 'Chia sẻ công trình vừa hoàn thiện dùng keo Kingsmen. Mạch đều, không bong, không ố. Hình thực tế bên dưới...', 'Review', 'TIN', array['review','công trình'], true, false),
  ('Hỏi đáp: nên dùng keo epoxy hay xi măng?', 'Nhiều bác thợ hỏi mình nên chít mạch bằng gì cho bền. Cùng bàn nhé...', 'Hỏi đáp', 'CÂN NHẮC', array['epoxy','so sánh'], true, false)
on conflict do nothing;

insert into cmt_suggestions (noi_dung_goi_y, tuyen, loai_bai, tags, thu_tu, active) values
  ('Nhà mình dùng Kingsmen 6 tháng rồi mạch vẫn sáng, không ố tí nào 👍', 'Trải nghiệm', 'Review', array['review'], 1, true),
  ('Cho hỏi keo này chống thấm nhà tắm ổn không ạ?', 'Đặt câu hỏi', 'Hỏi đáp', array['hỏi'], 2, true),
  ('Mình là thợ, chít Kingsmen nhanh hơn keo thường, khách ưng màu ColorMatch.', 'Chuyên gia', 'ColorMatch', array['thợ'], 3, true),
  ('Có bảo hành không shop ơi, dùng cho công trình lớn.', 'Đặt câu hỏi', null, array['bảo hành'], 4, true)
on conflict do nothing;
