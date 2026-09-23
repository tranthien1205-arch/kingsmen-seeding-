// DỰNG VIDEO NHÁP BẰNG FFMPEG TRÊN TRẠM (B8 — máy CHUẨN BỊ, người duyệt/chỉnh; video vẫn là việc của người).
// Với mỗi kịch bản VIDEO đã duyệt (mục ở giai đoạn Sản xuất) chưa có video: lấy footage/ảnh gắn với thẻ, cắt mỗi cảnh
// ~4 giây theo thứ tự, in lời bình (drawtext) lên cảnh, ghép thành mp4 1080x1920, tải lên R2 Content OS → lô
// "content_os.video" (Content OS gắn video vào nội dung dưới dạng tài sản VIDEO_XUAT). Không có footage → bỏ qua, nói rõ.
// Cần ffmpeg trong PATH của máy Trạm (winget install Gyan.FFmpeg).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DIR, bao, loHub } from "./_env.mjs";
import { appContentOS, goiApp, taiVe, taiLen, log } from "./content-os-lib.mjs";

const app = appContentOS();
const ff = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }); if (ff.error || ff.status !== 0) { bao({ b: "loi", m: "máy Trạm chưa có ffmpeg (winget install Gyan.FFmpeg rồi mở lại Trạm)" }); process.exit(2); }
const r = await goiApp(app, "/hub/viec/dung_video");
if (!r.ok) { bao({ b: "loi", m: "không hỏi được việc dựng (HTTP " + r.status + ")" }); process.exit(1); }
const ds = Array.isArray(r.d.viec) ? r.d.viec : [];
if (!ds.length) { bao({ b: "ok", ket_qua: [{ man: "không có kịch bản video cần dựng", dong: 0, moi: 0 }] }); process.exit(0); }
const FONT = ["C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find(existsSync) || "";
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/\n/g, " ").slice(0, 90);
const TH = join(DIR, "out", "content-os", "dung"); mkdirSync(TH, { recursive: true });
const kq = []; const loi = []; let i = 0;
for (const v of ds) {
  i++; bao({ b: "buoc", i, n: ds.length, m: "dựng " + v.tieu_de });
  const nguon = (v.tai_san || []).filter((t) => t.media_url); if (!nguon.length) { loi.push(v.tieu_de + ": chưa có footage/ảnh gắn với thẻ"); continue; }
  try {
    const canh = (v.sections && v.sections.length ? v.sections : [{ text: v.hook }]).slice(0, 12); const clips = [];
    for (let k = 0; k < canh.length; k++) {
      const t = nguon[k % nguon.length]; const src = await taiVe(t.media_url, "src_" + v.noi_dung_id + "_" + (k % nguon.length) + (t.media_type === "IMAGE" ? ".jpg" : ".mp4"));
      const out = join(TH, v.noi_dung_id + "_" + k + ".mp4"); const loop = t.media_type === "IMAGE" ? ["-loop", "1", "-t", "4"] : ["-t", "4"];
      const vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" + (FONT ? ",drawtext=fontfile='" + FONT.replace(/:/g, "\\:") + "':text='" + esc((k === 0 ? v.hook + " " : "") + (canh[k].text || "")) + "':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.5:boxborderw=16:x=(w-text_w)/2:y=h-260" : "");
      const p = spawnSync("ffmpeg", ["-y", ...loop, "-i", src, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", out], { encoding: "utf8", timeout: 180000 });
      if (p.status !== 0) throw new Error("ffmpeg cảnh " + (k + 1) + ": " + String(p.stderr || "").slice(-200)); clips.push(out);
    }
    const lst = join(TH, v.noi_dung_id + ".txt"); writeFileSync(lst, clips.map((c) => "file '" + c.replace(/\\/g, "/") + "'").join("\n"));
    const outF = join(TH, v.noi_dung_id + ".mp4"); const c = spawnSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", outF], { encoding: "utf8", timeout: 180000 });
    if (c.status !== 0) throw new Error("ffmpeg ghép: " + String(c.stderr || "").slice(-200));
    const url = await taiLen(app, readFileSync(outF), "video/mp4");
    kq.push({ noi_dung_id: v.noi_dung_id, media_url: url, mo_ta: "Trạm dựng nháp bằng ffmpeg · " + canh.length + " cảnh × 4s · " + nguon.length + " nguồn" });
    log("✓ dựng xong", v.tieu_de, url);
  } catch (e) { loi.push(v.tieu_de + ": " + String(e.message || e).slice(0, 160)); }
}
if (kq.length) loHub("content_os.video", kq);
bao({ b: loi.length * 2 > ds.length ? "loi" : "ok", ket_qua: [{ man: "dựng video nháp", dong: kq.length, moi: kq.length, loi: loi.length ? true : undefined, msg: loi.slice(0, 3).join(" · ") || undefined }] });
