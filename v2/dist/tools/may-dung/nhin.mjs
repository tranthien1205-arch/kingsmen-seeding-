// MÔ HÌNH NHÌN MỞ (ADR-009): CLIP chạy tại máy ghép bằng @huggingface/transformers (CPU được) + ĐẦU HỌC (logistic) huấn luyện từ mẫu người chấm.
// Dùng chung cho dung-video (chọn footage theo gợi ý hình) và huan-luyen (học đầu). App phát script này qua /hub/script/nhin.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const chuanHoa = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Float32Array.from(v, (x) => x / s); };
export const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
/** đặc trưng cặp (chữ, hình) cho đầu học: [cos, t⊙i (512)] */
export const dacTrung = (t, i) => { const f = new Float32Array(1 + t.length); f[0] = cos(t, i); for (let k = 0; k < t.length; k++) f[k + 1] = t[k] * i[k]; return f; };
export const diemDau = (dau, f) => { let z = dau.b || 0; const w = dau.w; for (let k = 0; k < w.length && k < f.length; k++) z += w[k] * f[k]; return 1 / (1 + Math.exp(-z)); };
/** khung hình đại diện của video (giây 1) → jpg; ảnh trả nguyên */
export function khungHinh(src, outDir, ten) {
  if (/\.(jpe?g|png|webp|gif)$/i.test(src)) return src;
  mkdirSync(outDir, { recursive: true }); const out = join(outDir, ten + ".jpg"); if (existsSync(out)) return out;
  const p = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", "1", "-i", src, "-frames:v", "1", "-vf", "scale=320:-2", out], { encoding: "utf8", timeout: 60000 });
  if (p.status !== 0 || !existsSync(out)) throw new Error("không lấy được khung hình: " + String(p.stderr || "").slice(-120)); return out;
}
/** tải CLIP; thiếu thư viện → ném lỗi rõ để script gọi bỏ qua phần AI */
export async function taoNhin({ model_id = "Xenova/clip-vit-base-patch16", log = console.log } = {}) {
  let T; try { T = await import("@huggingface/transformers"); } catch (e) { throw new Error("máy chưa cài @huggingface/transformers (chạy: npm install trong thư mục máy con)"); }
  const { AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage } = T;
  log("  tải mô hình nhìn", model_id, "(lần đầu tải về ~150MB)");
  const tok = await AutoTokenizer.from_pretrained(model_id); const textModel = await CLIPTextModelWithProjection.from_pretrained(model_id);
  const proc = await AutoProcessor.from_pretrained(model_id); const visModel = await CLIPVisionModelWithProjection.from_pretrained(model_id);
  const cacheT = new Map(), cacheI = new Map();
  return {
    model_id,
    async embText(text) { const k = String(text || "").trim().slice(0, 300); if (cacheT.has(k)) return cacheT.get(k); const ti = tok([k || "hình"], { padding: true, truncation: true }); const { text_embeds } = await textModel(ti); const v = chuanHoa(Array.from(text_embeds.data)); cacheT.set(k, v); return v; },
    async embImage(path) { if (cacheI.has(path)) return cacheI.get(path); const img = await RawImage.read(path); const ii = await proc(img); const { image_embeds } = await visModel(ii); const v = chuanHoa(Array.from(image_embeds.data)); cacheI.set(path, v); return v; },
  };
}
/** đọc đầu học từ file JSON tải về */
export const docDau = (f) => { const d = JSON.parse(readFileSync(f, "utf8")); if (!Array.isArray(d.w)) throw new Error("đầu học hỏng"); return d; };
