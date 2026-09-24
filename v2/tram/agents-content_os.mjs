// MỤC AGENT "content_os" — chép vào mảng AGENTS trong may/agents.mjs của masfico-insight (và thêm NHOM.noi_dung).
// Không có bước đăng nhập riêng: dùng lại hồ sơ đã đăng nhập của agent "tiktok_cn" (TikTok) và "facebook" trên Trạm.
export const NHOM_THEM = { noi_dung: { ten: "Nội dung & đăng bài", icon: "📣", mo_ta: "đăng bài, đo lường, dựng video cho Kingsmen Content OS" } };
export const AGENT_CONTENT_OS = {
  id: "content_os",
  ten: "Kingsmen Content OS — đăng · đo · dựng",
  icon: "📣",
  nhom: "noi_dung",
  gioi_thieu: "Tay máy của Kingsmen Content OS (app ghép hub1): đăng bài lên TikTok/Facebook bằng trình duyệt đã đăng nhập, đọc số xem/tương tác của bài đã đăng, dựng video nháp bằng ffmpeg. Việc và kết quả đi qua /hub/viec/* và lô content_os.*.",
  san_sang: true,
  uu_tien: false,
  dang_nhap: null,   // dùng hồ sơ tiktok_cn-profile / facebook-profile của các agent khác
  viec: [
    { id: "dang", ten: "Đăng bài chờ Trạm", script: "content-os-dang.mjs", lich: true, san_sang: true,
      gio: "08:00", lap: "gio", cach: 30, den: "21:30",
      mo_ta: "hỏi Content OS bài DANG_GUI cách TRAM → đăng TikTok (tiktok_cn-profile) / Facebook Page (facebook-profile) → báo content_os.dang_ket_qua" },
    { id: "do_luong", ten: "Đo lường bài đã đăng", script: "content-os-do-luong.mjs", lich: true, san_sang: true,
      gio: "07:10", lap: "ngay",
      mo_ta: "mở link bài đã đăng (30 ngày) bằng trình duyệt đã đăng nhập, đọc xem/thích/bình luận/chia sẻ/lưu tích luỹ → content_os.ket_qua" },
    { id: "dung_video", ten: "Dựng video nháp (ffmpeg)", script: "content-os-dung-video.mjs", lich: false, san_sang: true,
      mo_ta: "kịch bản VIDEO đã duyệt + footage gắn thẻ → mp4 1080x1920 có lời bình → tải lên R2 Content OS → content_os.video" },
    // ADR-007 — seeding hội nhóm Facebook bằng tài khoản MKT trên Trạm (mỗi tài khoản một hồ sơ facebook[-n]-profile; không Sales, không tiền)
    { id: "seeding_dang", ten: "Đăng seeding vào hội nhóm FB", script: "content-os-seeding-dang.mjs", lich: false, san_sang: true,
      mo_ta: "hỏi /hub/viec/seeding_dang → mở nhóm bằng hồ sơ tài khoản MKT tương ứng → đăng biến thể → content_os.seeding_dang_ket_qua (link / chờ QTV); checkpoint → báo, không vượt" },
    { id: "seeding_kiem", ten: "Kiểm & đo bài seeding + bắt lead", script: "content-os-seeding-kiem.mjs", lich: true, san_sang: true,
      gio: "07:30", lap: "ngay",
      mo_ta: "mở link bài seeding đã đăng 2 & 7 ngày → còn sống / nội dung / react / bình luận + danh sách bình luận (Content OS bắt lead hỏi mua) → content_os.seeding_kiem" },
    // ADR-007b — bình luận dẫn dắt bằng tài khoản khác trong nhóm; nuôi tài khoản (xem, thả tim)
    { id: "seeding_binh_luan", ten: "Bình luận dẫn dắt dưới bài seeding", script: "content-os-seeding-binh-luan.mjs", lich: false, san_sang: true,
      mo_ta: "hỏi /hub/viec/seeding_binh_luan → mở link bài bằng hồ sơ tài khoản MKT khác → bình luận theo vai → content_os.seeding_binh_luan_ket_qua" },
    { id: "seeding_nuoi", ten: "Nuôi tài khoản seeding (xem, thả tim)", script: "content-os-seeding-nuoi.mjs", lich: false, san_sang: true,
      mo_ta: "hỏi /hub/viec/seeding_nuoi → mở nhóm bằng hồ sơ tài khoản → cuộn xem vài phút, thả tim vài bài → content_os.seeding_nuoi_ket_qua" },
  ],
};
// ADR-007b — TÀI KHOẢN SEEDING THÊM (facebook-2 … facebook-5): mỗi tài khoản một agent chỉ có bước ĐĂNG NHẬP (dang-nhap-chung),
// tạo hồ sơ trình duyệt <id>-profile mà content_os dùng để đăng/bình luận/nuôi. Chép vào AGENTS của masfico-insight cùng AGENT_CONTENT_OS.
export const TAI_KHOAN_SEEDING_AGENTS = [2, 3, 4, 5].map((k) => ({
  id: "facebook-" + k, ten: "Facebook tài khoản seeding " + k, icon: "👤", nhom: "noi_dung", san_sang: true, uu_tien: false,
  gioi_thieu: "Tài khoản Facebook thứ " + k + " của phòng MKT dùng cho seeding hội nhóm (Content OS gọi tram_id facebook-" + k + "). Chỉ cần đăng nhập một lần; đăng/bình luận/nuôi do agent content_os làm.",
  phien: "facebook-" + k + "-phien.json",
  dang_nhap: { kieu: "trinh_duyet", script: "dang-nhap-chung.mjs", tham_so: ["--ten=facebook-" + k, "--phien=facebook-" + k + "-phien.json", "--url=https://www.facebook.com/", "--dau_hieu=[aria-label*=\"Tài khoản của bạn\" i],[aria-label*=\"Your profile\" i]"], huong_dan: "Đăng nhập tài khoản Facebook seeding số " + k + " trong cửa sổ vừa mở (đúng tài khoản đã khai ở Content OS › Seeding › Tài khoản MKT). Trạm không giữ mật khẩu." },
  viec: [],
}));
