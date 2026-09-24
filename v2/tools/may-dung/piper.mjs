// GIỌNG ĐỌC MỞ TIẾNG VIỆT — Piper (ADR-009c-2). Tải piper + giọng một lần vào <máy con>/piper/, đọc câu → wav → mp3 (ffmpeg).
// Nguồn: github.com/rhasspy/piper (MIT) · giọng huggingface.co/rhasspy/piper-voices (vi_VN vais1000 medium).
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PIPER_ZIP = process.platform === "win32" ? "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip" : "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz";
const GIONG_URL = (g) => { const [lang, name, q] = g.split("-"); const cc = lang.replace("_", "_"); return "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/" + lang.split("_")[0] + "/" + cc + "/" + name + "/" + q + "/" + g + ".onnx"; };
async function taiFile(url, f, log) { if (existsSync(f)) return f; log("  tải", url.split("/").pop()); const r = await fetch(url, { redirect: "follow" }); if (!r.ok) throw new Error("tải " + url.split("/").pop() + " HTTP " + r.status); writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f; }

export async function taoPiper({ dir, log = console.log, giong = "vi_VN-vais1000-medium" } = {}) {
  const TH = join(dir, "..", "piper"); mkdirSync(TH, { recursive: true });
  const exe = join(TH, "piper", process.platform === "win32" ? "piper.exe" : "piper");
  if (!existsSync(exe)) { const z = join(TH, PIPER_ZIP.split("/").pop()); await taiFile(PIPER_ZIP, z, log); const t = spawnSync("tar", ["-xf", PIPER_ZIP.split("/").pop()], { cwd: TH, encoding: "utf8" }); /* tên tương đối + cwd: bsdtar Windows hiểu "D:\…" là máy_chủ:đường (24/09) */ if (t.status !== 0 || !existsSync(exe)) throw new Error("không giải nén được piper: " + String(t.stderr || "").slice(0, 120)); rmSync(z, { force: true }); }
  const model = join(TH, giong + ".onnx"); await taiFile(GIONG_URL(giong), model, log); await taiFile(GIONG_URL(giong) + ".json", model + ".json", log);
  return {
    giong,
    /** đọc một câu → file mp3 (đường dẫn) */
    doc(text, outMp3) { const wav = outMp3.replace(/\.mp3$/i, ".wav"); const p = spawnSync(exe, ["-m", model, "-f", wav, "--sentence_silence", "0.25"], { input: String(text || "").trim() + "\n", encoding: "utf8", timeout: 120000 }); if (p.status !== 0 || !existsSync(wav)) throw new Error("piper: " + String(p.stderr || p.error || "").slice(-160));
      const f = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-ar", "44100", "-b:a", "96k", outMp3], { encoding: "utf8", timeout: 60000 }); if (f.status !== 0) throw new Error("ffmpeg wav→mp3: " + String(f.stderr || "").slice(-120)); rmSync(wav, { force: true }); return outMp3; },
  };
}
