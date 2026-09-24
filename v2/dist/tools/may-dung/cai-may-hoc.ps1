# CÀI MÁY HỌC / MÁY DỰNG KINGSMEN CONTENT OS — một lệnh (24/09/2026, ADR-012)
# Chạy trong PowerShell (không cần quyền admin nếu winget đã có):
#   irm https://content.masfico.vn/tools/may-dung/cai-may-hoc.ps1 | iex
# Làm gì: tạo C:\may-dung, tải may-dung.mjs + BAT-DAU.bat + package.json + README.md từ app, cài Node 22 / ffmpeg / Ollama nếu thiếu,
#         npm install (CLIP + Whisper), ollama pull qwen2.5:7b (bản mở ngôn ngữ, cần ~5 GB VRAM), rồi mở BAT-DAU.bat để dán mã ghép.
# Không giữ mật khẩu gì: mã ghép lấy ở app › Hồ sơ › Máy dựng › Kết nối máy này (hiện một lần).
$ErrorActionPreference = 'Continue'
$APP = 'https://content.masfico.vn'
$DIR = 'C:\may-dung'
Write-Host "== Kingsmen Content OS · cài máy học vào $DIR" -ForegroundColor Cyan
New-Item -ItemType Directory -Force $DIR | Out-Null
foreach ($f in 'may-dung.mjs','BAT-DAU.bat','package.json','README.md') {
  try { Invoke-WebRequest -UseBasicParsing "$APP/tools/may-dung/$f" -OutFile (Join-Path $DIR $f); Write-Host "  tải $f" } catch { Write-Host "  ✗ không tải được $f — $($_.Exception.Message)" -ForegroundColor Red }
}
function CoLenh($t) { return [bool](Get-Command $t -ErrorAction SilentlyContinue) }
if (-not (CoLenh 'node'))   { Write-Host "  cài Node.js 22…";  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements }
if (-not (CoLenh 'ffmpeg')) { Write-Host "  cài ffmpeg…";      winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements }
if (-not (CoLenh 'ollama')) { Write-Host "  cài Ollama…";      winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements }
# PATH mới sau winget
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
Set-Location $DIR
Write-Host "  npm install (CLIP ViT-B/16 + Whisper, ~700 MB tải lần đầu khi dùng)…"
npm install --no-audit --no-fund
if (CoLenh 'ollama') {
  Write-Host "  ollama pull qwen2.5:7b (~4,7 GB)…"
  Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden -ErrorAction SilentlyContinue
  Start-Sleep 4
  ollama pull qwen2.5:7b
}
try { nvidia-smi --query-gpu=name,memory.total --format=csv,noheader } catch { Write-Host "  (không thấy nvidia-smi — chạy CPU)" }
Write-Host ""
Write-Host "== Xong phần cài. Bây giờ:" -ForegroundColor Green
Write-Host "   1. Trong app $APP › Hồ sơ › Máy dựng › ＋ Kết nối máy này → copy mã ghép"
Write-Host "   2. Cửa sổ BAT-DAU sắp mở: dán mã ghép rồi Enter. ĐỂ YÊN cửa sổ đó (đóng là máy ngừng nhận việc)."
Start-Process -FilePath (Join-Path $DIR 'BAT-DAU.bat') -WorkingDirectory $DIR
