// ===== BỘ NHÃN CHUẨN (26/09) — dựa trên tài liệu thi công Kingsmen (sàn tự phẳng Terrazy / Finex, keo chít mạch) + tên thầy đã gọi trên 1.300 đoạn video.
// Mỗi luật: [regex trên tên thầy / người ghi, tên chuẩn] — tên chuẩn null = bỏ (không phải nhãn của trường này). Luật trên cùng khớp trước.
// Dùng ở hai chỗ: (1) khi thầy / người gán — tên khớp luật đổi thẳng về tên chuẩn, không thành đề xuất; (2) một lần dọn đề xuất cũ (gộp, mẫu đổi theo).
// Tên không khớp luật nào vẫn thành đề xuất như cũ để người duyệt ở tab Bộ nhãn.

export const CHUAN = {
  vat_lieu: [
    [/terrazy/i, 'Kingsmen Terrazy'],
    [/finex.*s ?100|\bs ?100\b/i, 'Finex S100'],
    [/finex|\bf ?300\b/i, 'Finex F300'],
    [/primer|sơn lót|lớp lót/i, 'sơn lót primer'],
    [/\bkt ?[78]00\b/i, 'bộ thi công Kingsmen KT700 / KT800'],
    [/g ?3000.*g ?5000|g ?6000.*g ?7000/i, 'keo chít mạch Kingsmen'],
    [/\bg ?3000\b/i, 'keo chít mạch Kingsmen G3000'],
    [/\bg ?5000\b/i, 'keo chít mạch Kingsmen G5000'],
    [/\bg ?6000\b/i, 'keo chít mạch Kingsmen G6000'],
    [/\bg ?7000\b/i, 'keo chít mạch Kingsmen G7000'],
    [/silicone/i, 'keo silicone'],
    [/sáp/i, 'sáp bảo vệ gạch (wax)'],
    [/vữa xi măng/i, 'vữa xi măng'],
    [/tương (cà|ớt)|dầu mỡ|nước sốt|nước tương/i, 'chất bẩn để thử (tương cà / dầu mỡ)'],
    [/keo dán gạch/i, 'keo dán gạch'],
    [/keo dán thảm/i, 'keo dán thảm'],
    [/bột bả|bột trét|vữa trám/i, 'bột bả epoxy'],
    [/keo (chà|chít|trám)|keo ron|polyurea|keo (ab|kingsmen)|tuýp/i, 'keo chít mạch Kingsmen'],
    [/keo epoxy/i, 'keo epoxy'],
    [/cát màu|sạn màu|flake|kim tuyến|hạt (trang trí|cát)/i, 'hạt trang trí (cát màu / flake / kim tuyến)'],
    [/thành phần (a|b)|a và b|a \+ b|chất đóng rắn|(2|hai) thành phần/i, 'vật liệu 2 thành phần (A + B)'],
    [/sơn.*epoxy|sàn epoxy|epoxy.*(tự phẳng|hiệu ứng)|sơn .*hiệu ứng|vữa epoxy|sơn sàn/i, 'sàn epoxy tự phẳng hiệu ứng terrazzo'],
    [/ron gạch/i, 'ron gạch cũ'],
    [/thảm/i, 'thảm sàn cũ'],
    [/bê tông/i, 'nền bê tông'],
    [/gạch.*cũ|nền gạch/i, 'nền gạch cũ'],
    [/gạch/i, 'gạch ốp lát'],
    [/^(nước|bụi.*|can nhựa.*|can sơn.*|bột phụ gia|bộ bi.*|bộ dụng cụ.*|bộ sản phẩm.*|combo.*)$/i, null],
  ],
  dung_cu: [
    [/lăn gai|rulo gai/i, 'con lăn gai'],
    [/máy (mài|chà nhám).*(sàn|nhám)|máy chà nhám/i, 'máy mài sàn'],
    [/máy mài/i, 'máy mài cầm tay'],
    [/hút bụi/i, 'máy hút bụi'],
    [/\bbi\b|miết ron|bay miết/i, 'bi cầu miết ron'],
    [/sủi ron|cạo ron/i, 'dao cạo ron'],
    [/bay nhựa|bàn gạt|cây gạt/i, 'bay nhựa (bàn gạt)'],
    [/bay trét|dao trét/i, 'dao trét'],
    [/bông (tròn|chà)/i, 'bông chà'],
    [/bàn chải/i, 'bàn chải'],
    [/dao rọc/i, 'dao rọc'],
    [/máy đục|^đục$/i, 'máy đục'],
    [/que (khuấy|trộn)/i, 'que khuấy'],
    [/vật nhọn/i, 'vật nhọn (thử cào)'],
    [/đo màu|color ?match|colormax/i, 'máy đo màu ColorMatch'],
    [/bảng màu/i, 'bảng màu ron Kingsmen'],
    [/khăn/i, 'khăn sạch'],
    [/búa cao su/i, 'búa cao su'],
    [/chổi/i, 'chổi quét'],
    [/cây lau nhà/i, 'cây lau nhà'],
    [/thước cán/i, 'thước cán vữa'],
    [/vòi sen/i, 'vòi sen'],
    [/^kìm$/i, 'kìm'],
  ],
  // bài test sàn: gom theo đúng thứ video muốn chứng minh
  bai_test: [
    [/tuýp|lượng keo|2 chai|hai chai|khối lượng|trọng lượng|kích thước/i, 'So sánh lượng keo trong tuýp'],
    [/co ngót|sau khi khô|đóng rắn|độ đầy|thay đổi hình dạng/i, 'Thử co ngót sau khi khô'],
    [/màu.*gạch|thử mẫu|so sánh (màu|mẫu|không gian)|cốc nhỏ/i, 'Thử màu ron trên gạch thật'],
    [/^(kiểm chứng chất lượng|kiểm tra độ bền theo thời gian)$/i, null],
    [/độ khô|thời gian khô/i, 'Thử thời gian khô'],
    [/cào|xước|chìa kh|nĩa|que gỗ/i, 'Cào xước bề mặt'],
    [/chân (trần|ướt)|trơn|trượt|độ nhám/i, 'Thử chống trơn trượt'],
    [/lau|vết bẩn|tương cà|dầu mỡ|nước sốt|chất lỏng/i, 'Lau vết bẩn thử chống bám bẩn'],
    [/đập|va đập|chày|búa/i, 'Thử va đập'],
    [/gõ|độ chắc/i, 'Gõ kiểm tra độ chắc nền'],
    [/chà tay|giấy trắng|bền màu/i, 'Chà thử độ bền màu'],
    [/đổ nước|xịt nước|xối nước|test nước|thoát nước|thấm|khô ráo/i, 'Đổ nước thử chống thấm'],
    [/đi lại|đứng lên|chạm tay/i, 'Thử đi lại trên sàn'],
  ],
  // bước: tên thầy tự đặt → bước chuẩn (xét vế đầu trước dấu phẩy); chỉ nhận nếu bước chuẩn có trong quy trình của dòng
  buoc: [
    [/^(vệ sinh|thi công chính|thi công [\d.,]+.*|tùy .*|giới thiệu .*|lựa chọn .*|thực hiện trên .*|đang thi? ?công|đang thí công|thi công đúng kỹ thuật.*)$/i, null],
    [/chấm nước|trình bề mặt/i, 'Miết ron tạo bề mặt'],
    [/băng keo|ban keo|dán .*keo|lắp ráp/i, 'Chuẩn bị và vệ sinh khe ron'],
    [/lột màng|cạo|cạp|chết \(|bọt biển|bọ biển|móng tay|keo dư|check keo|đợi keo|nhúng vào nước|đánh bề mặt|đánh chung/i, 'Làm sạch và hoàn thiện'],
    [/bơm keo|keo chà ron|keo chít mạch|súng bơm|ống keo/i, 'Bơm keo vào khe gạch'],
    [/miết ron/i, 'Miết ron tạo bề mặt'],
    [/cạo ron|vệ sinh khe/i, 'Chuẩn bị và vệ sinh khe ron'],
    [/trám|nứt/i, 'Trám và vệ sinh bề mặt'],
    [/primer|sơn lót|lót/i, 'Thi công lớp lót (primer)'],
    [/nhám|mài/i, 'Tạo nhám'],
    [/lăn gai|phá bọ[tc]|bọ[tc] khí|lang gạy|đuổi/i, 'Lăn gai chỉnh bề mặt'],
    [/^lăn d|^lăn .*lần/i, 'Lăn gai chỉnh bề mặt'],
    [/^(trộn|pha|khuấy)/i, 'Trộn vật liệu'],
    [/đổ|gạt|phủ|san phẳng|cán|làm phẳng/i, 'Thi công lớp phủ (đổ và cán)'],
    [/trộn|pha/i, 'Trộn vật liệu'],
    [/lăn .*vật liệu|trải vật liệu/i, 'Thi công lớp phủ (đổ và cán)'],
    [/vệ sinh|chà|quét|hút bụi|làm sạch/i, 'Kiểm tra và chuẩn bị nền'],
    [/kiểm tra|chuẩn bị|xử lý nền|nền cũ/i, 'Kiểm tra và chuẩn bị nền'],
  ],
  vi_tri: [[/ban công/i, 'ban công']],
  hanh_dong: [[/^theo tay$/i, null], [/^chỉ tay$/i, 'chỉ tay']],
};
// bài test chuẩn theo dòng (sàn) — tạo sẵn để thầy chọn
export const BAI_TEST_SAN = ['Cào xước bề mặt', 'Thử chống trơn trượt', 'Lau vết bẩn thử chống bám bẩn', 'Đổ nước thử chống thấm', 'Thử va đập', 'Gõ kiểm tra độ chắc nền', 'Chà thử độ bền màu', 'Thử đi lại trên sàn', 'Thử thời gian khô'];
export const BAI_TEST_KEO = ['So sánh lượng keo trong tuýp', 'Thử co ngót sau khi khô', 'Thử màu ron trên gạch thật'];

const cf = (s) => String(s || '').trim().toLowerCase();
// tên → { ten: tên chuẩn } | { bo: true } | null (không có luật)
export function quyVe(truong, ten) { const ds = CHUAN[truong]; if (!ds || !ten) return null; const t = String(ten).trim(); const dau = truong === 'buoc' ? t.split(/[,;]/)[0] : t;
  for (const [re, chuan] of ds) { if (re.test(dau)) return chuan === null ? { bo: true } : { ten: chuan }; }
  if (truong === 'buoc') for (const [re, chuan] of ds) if (re.test(t)) return chuan === null ? { bo: true } : { ten: chuan };
  return null; }
export const giongTen = (a, b) => cf(a) === cf(b);
