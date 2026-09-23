// ===== MÔ PHỎNG — dữ liệu giả để duyệt thiết kế các màn của đợt 2–4 trước khi làm thật.
// Chỉ hiện khi Admin bấm "Nạp dữ liệu mô phỏng" (Máy › Mô phỏng). Mọi hành động trong màn mô phỏng chỉ báo "sẽ làm ở đợt N".
const MP = {
  thang: '2026-10',
  ke_hoach: { tong:24, dinh_huong:'Đẩy G7000 mùa mưa · 2 video review KOC · giữ nhịp 6 bài/tuần', nguon:'Máy đề xuất 25/09 · Trưởng MKT sửa 2 số · CHỜ CHỐT',
    pillar:[['Branding',10,7],['Information',7,4],['Problems',5,5],['Interaction',2,1]],
    dinh_dang:[['🎬 Video ngắn',8,5],['📝 Bài post',10,8],['🖼️ Ảnh / banner',4,3],['🎠 Carousel',2,1]],
    kenh:[['Fanpage Kingsmen',14,11],['YouTube',4,2],['TikTok',6,4]] },
  tuan: [ {t:1, co:6, ct:6, thieu:[]}, {t:2, co:5, ct:6, thieu:['Video 1']}, {t:3, co:4, ct:6, thieu:['Information 1','Carousel 1']}, {t:4, co:2, ct:6, thieu:['Branding 2','Post 2']} ],
  y_tuong: [ {ten:'Mùa mưa 2026: ron gạch ố mốc sau 1 mùa', nguon:'Google Trends', diem:82, pillar:'Problems', tt:'ĐÃ DUYỆT → mục KH tuần 2'}, {ten:'#nhàđẹpkhôngtốn — trend nhà phố hoàn thiện', nguon:'TikTok (n8n)', diem:71, pillar:'Branding', tt:'CHỜ NGƯỜI CHẤM'}, {ten:'So sánh keo ron epoxy vs polyurea', nguon:'YouTube', diem:64, pillar:'Information', tt:'CHỜ NGƯỜI CHẤM'}, {ten:'Giảm giá sốc cuối năm', nguon:'Google Trends', diem:12, pillar:'—', tt:'MÁY BỎ: rủi ro claim giá'} ],
  the: [
    {id:'m1', gd:'Y_TUONG', ten:'Ron gạch ố mốc sau mùa mưa — cách nhận biết', dd:'🎬', pillar:'Problems', ai:'Máy tạo từ trend', ngay:'10/10'},
    {id:'m2', gd:'SOAN', ten:'G7000 giữ màu 30 năm — vì sao?', dd:'📝', pillar:'Information', ai:'Ngọc đang soạn · máy viết bóng', ngay:'12/10'},
    {id:'m3', gd:'SOAN', ten:'Carousel: 5 lỗi thi công ron gạch', dd:'🎠', pillar:'Problems', ai:'Máy soạn nháp (AI gợi ý)', ngay:'13/10'},
    {id:'m4', gd:'CHO_DUYET', ten:'Review KOC: hồ bơi G9000 sau 2 năm', dd:'🎬', pillar:'Branding', ai:'Máy chấm 86/100 · không rủi ro', ngay:'14/10'},
    {id:'m5', gd:'CHO_DUYET', ten:'Banner: Bảo hành 30 năm', dd:'🖼️', pillar:'Branding', ai:'Máy chấm 58/100 · thiếu CTA', ngay:'11/10'},
    {id:'m6', gd:'SAN_XUAT', ten:'Thi công ron gạch ngoài trời — 3 bước', dd:'🎬', pillar:'Information', ai:'Việc dựng giao Kỹ thuật · hạn 09/10', ngay:'15/10'},
    {id:'m7', gd:'DA_DANG', ten:'Chọn keo ron cho ban công', dd:'📝', pillar:'Information', ai:'Tự đăng 07/10 20:00', ngay:'07/10'},
    {id:'m8', gd:'DA_DO', ten:'Ron gạch nhà vệ sinh không ố vàng', dd:'🎬', pillar:'Problems', ai:'12.4k xem · 310 tương tác · 0 đơn quy được', ngay:'02/10'},
  ],
  duyet: [ {ten:'Review KOC: hồ bơi G9000 sau 2 năm', ai:'86/100 — đủ checklist, thông số đúng hồ sơ, không claim cấm', nguoi:'Ngọc', cho:'6 giờ'}, {ten:'Banner: Bảo hành 30 năm', ai:'58/100 — thiếu CTA, headline 11 từ (>8)', nguoi:'Máy soạn (AI gợi ý)', cho:'1 ngày'} ],
  ket_qua: { truc_tiep:{dt:18500000, don:7}, gian_tiep:{dt:9200000, don:4}, kqd:{xem:48200, tt:1830, click:212} },
  bao_cao: { ky:'Tuần 40 (29/09–05/10)', nhan_dinh:'Đạt 6/6 bài. Video ngắn về Problems kéo 61% lượt xem tuần; bài post Information tương tác thấp nhất (0,9%). Kênh TikTok tăng 34% xem so với tuần trước nhờ 2 video trend mùa mưa. 3 bài chờ duyệt quá 24h.',
    viec:['Duyệt 3 bài đang chờ (G3) — quá SLA','Đổi giờ đăng Fanpage từ 12:00 sang 19:30 (dữ liệu 4 tuần)','Bổ sung thông số G6000 vào hồ sơ sản phẩm — máy đang phải ghi [điền …]'], gui:'App · Zalo (n8n) · Email' },
  de_xuat: [ {ten:'Tăng pillar Problems 20% → 30%, giảm Branding 40% → 30%', bang_chung:'8 tuần · 37 bài · Problems: 2,1× lượt xem/bài, 1,6× click', loai:'Chiến lược (G4)'}, {ten:'Giờ đăng Fanpage 19:30 thay 12:00', bang_chung:'6 tuần · 22 bài · 19:30: +48% tương tác', loai:'Lịch đăng'}, {ten:'Mẫu hook "Sau 1 mùa mưa, ron gạch nhà bạn…" thành khuôn cho Problems', bang_chung:'4 bài dùng · top 3 lượt xem tháng', loai:'Khuôn nội dung'} ],
};
function MoPhongBanner(){ return <div className="rounded-xl bg-amber-100 text-amber-900 text-[11px] px-3 py-1.5 font-semibold">🧪 MÔ PHỎNG — số liệu giả để duyệt thiết kế. Hành động ở đây chưa ghi gì.</div>; }
const mpBao=(notify, dot)=>()=>notify('Mô phỏng: hành động này sẽ làm thật ở đợt '+dot,'warn');
