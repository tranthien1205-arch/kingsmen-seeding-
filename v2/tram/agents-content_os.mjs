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
  ],
};
