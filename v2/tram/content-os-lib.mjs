// THƯ VIỆN CHUNG cho các script agent "content_os" trên Trạm (masfico-tram, may/).
// Content OS là app ghép theo hợp đồng hub1 (hub-apps.json + hub-khoa.json) — script tìm app id "content_os" ở đó,
// gọi các đường /hub/viec/* để lấy việc, trả kết quả bằng ::TRAM {b:"lo"} (loHub) để Trạm đẩy về /hub/nap.
// Chạy tay ngoài Trạm: cần hub-apps.json có app content_os (dán mã ghép ở trang Trạm một lần).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DIR, gio, bao } from "./_env.mjs";
import { docSoApp } from "./hub-apps.mjs";

export const APP_ID = "content_os";
export function appContentOS() {
  const a = docSoApp().find((x) => x.id === APP_ID && x.kieu === "hub1");
  if (!a || !a.khoa) { bao({ b: "loi", m: "Trạm chưa ghép Kingsmen Content OS (dán mã ghép HUB1 ở trang Trạm › Cài đặt › Ứng dụng ghép)" }); console.error("Chưa ghép Content OS"); process.exit(2); }
  return a;
}
export async function goiApp(a, duong, opt) {
  const r = await fetch(a.url.replace(/\/+$/, "") + duong, { ...(opt || {}), headers: { "Content-Type": "application/json", "X-Hub-Key": a.khoa, ...((opt && opt.headers) || {}) } });
  let d = null; try { d = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, d: d || {} };
}
/** Tải một media về thư mục tạm của Trạm (out/content-os/), trả đường dẫn file. */
export async function taiVe(url, ten) {
  const th = join(DIR, "out", "content-os"); mkdirSync(th, { recursive: true });
  const f = join(th, String(ten || "f").replace(/[^a-z0-9_.-]/gi, "_"));
  if (existsSync(f)) return f;
  const r = await fetch(url); if (!r.ok) throw new Error("tải media " + r.status);
  writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f;
}
/** Tải file lên kho R2 của Content OS (đường /hub/upload, khoá hub) → media_url tương đối (/media/…). */
export async function taiLen(a, buf, type) {
  const r = await fetch(a.url.replace(/\/+$/, "") + "/hub/upload?type=" + encodeURIComponent(type || "video/mp4"), { method: "POST", headers: { "X-Hub-Key": a.khoa, "Content-Type": type || "video/mp4", "Content-Length": String(buf.length) }, body: buf });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error("tải lên " + r.status + " " + (d.error || "")); return d.media_url;
}
export const log = (...m) => console.log(gio(), ...m);
/** Mở trình duyệt với hồ sơ đã đăng nhập của một agent Trạm (tiktok_cn-profile, facebook-profile…). Không có hồ sơ → null. */
export async function moHoSo(ten, { headless = true } = {}) {
  const hs = join(DIR, ten + "-profile"); if (!existsSync(hs)) return null;
  const { chromium } = await import("playwright");
  return chromium.launchPersistentContext(hs, { headless, locale: "vi-VN", viewport: { width: 1366, height: 860 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" });
}
export const soTu = (s) => { const m = String(s || "").replace(/,/g, ".").match(/([\d.]+)\s*([kKmM])?/); if (!m) return 0; let n = parseFloat(m[1]) || 0; if (/k/i.test(m[2] || "")) n *= 1e3; if (/m/i.test(m[2] || "")) n *= 1e6; return Math.round(n); };
