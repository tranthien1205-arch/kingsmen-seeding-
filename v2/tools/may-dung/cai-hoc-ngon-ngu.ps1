# CÀI BỘ HUẤN LUYỆN NGÔN NGỮ (LoRA Qwen, ADR-009c-4) CHO MÁY HỌC — Windows, GPU NVIDIA ≥ 8 GB (24/09/2026)
# Chạy trong PowerShell (không cần quyền admin):
#   irm https://content.masfico.vn/tools/may-dung/cai-hoc-ngon-ngu.ps1 | iex
# Muốn đặt ở ổ khác (mô hình gốc 7B ~5,5 GB + thư viện ~5 GB):  $env:MAY_HOC_DIR = 'D:\AI_models'  rồi mới chạy lệnh trên.
# Làm gì: cài Python 3.12 (winget, theo người dùng) nếu thiếu → venv riêng → torch CUDA 12.8 + triton-windows + unsloth + trl + datasets
#         (ghim bản đã chạy thật trên RTX 3070 Ti) → tải huan-luyen-ngon-ngu.py từ app → tạo HUAN-LUYEN.bat.
# Dùng:  node may-dung.mjs xuat-tap-mau soan_nhap_agent   (trong C:\may-dung)
#        HUAN-LUYEN.bat C:\may-dung\out\hoc\ngon-ngu\soan_nhap_agent.train.jsonl --out <thư mục ra>
$ErrorActionPreference = 'Continue'
$APP = 'https://content.masfico.vn'
$GOC = if ($env:MAY_HOC_DIR) { $env:MAY_HOC_DIR } else { 'C:\may-dung\hoc' }
$VENV = Join-Path $GOC 'py-hoc'
Write-Host "== Kingsmen Content OS - cai bo huan luyen ngon ngu vao $GOC" -ForegroundColor Cyan
New-Item -ItemType Directory -Force $GOC | Out-Null

try { $gpu = (nvidia-smi --query-gpu=name,memory.total --format=csv,noheader) } catch { $gpu = '' }
if (-not $gpu) { Write-Host "  X Khong thay GPU NVIDIA (nvidia-smi). Huan luyen LoRA can GPU - dung." -ForegroundColor Red; return }
Write-Host "  GPU: $gpu"

$py = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
if (-not (Test-Path $py)) {
  Write-Host "  cai Python 3.12..."
  winget install -e --id Python.Python.3.12 --scope user --accept-source-agreements --accept-package-agreements --disable-interactivity
}
if (-not (Test-Path $py)) { Write-Host "  X Chua co Python 3.12 tai $py - cai tay tu python.org roi chay lai." -ForegroundColor Red; return }

if (-not (Test-Path (Join-Path $VENV 'Scripts\python.exe'))) { & $py -m venv $VENV }
$p = Join-Path $VENV 'Scripts\python.exe'
$env:PIP_CACHE_DIR = Join-Path $GOC 'pip-cache'
& $p -m pip install -q --upgrade pip
Write-Host "  torch CUDA 12.8 (~3 GB)..."
& $p -m pip install -q torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128
Write-Host "  unsloth + trl + datasets..."
& $p -m pip install -q "triton-windows==3.4.0.post21"
& $p -m pip install -q unsloth==2026.9.11 unsloth_zoo==2026.9.7 trl==0.24.0 datasets==4.3.0
& $p -c "import torch,sys; ok=torch.cuda.is_available(); print('  torch', torch.__version__, '- CUDA', ok, '-', torch.cuda.get_device_name(0) if ok else ''); sys.exit(0 if ok else 1)"
if ($LASTEXITCODE -ne 0) { Write-Host "  X torch khong thay CUDA - kiem tra driver NVIDIA (nvidia-smi) roi chay lai." -ForegroundColor Red; return }

try { Invoke-WebRequest -UseBasicParsing "$APP/tools/may-dung/huan-luyen-ngon-ngu.py" -OutFile (Join-Path $GOC 'huan-luyen-ngon-ngu.py'); Write-Host "  tai huan-luyen-ngon-ngu.py" } catch { Write-Host "  X khong tai duoc huan-luyen-ngon-ngu.py - $($_.Exception.Message)" -ForegroundColor Red }
$bat = @"
@echo off
rem Huan luyen LoRA Qwen tai may hoc. Tat mo hinh Ollama dang nap de tra VRAM roi chay.
chcp 65001 >nul
set HF_HOME=$GOC\huggingface
set UNSLOTH_LLAMA_CPP_PATH=$GOC\llama.cpp
set UNSLOTH_LLAMA_CPP_CONVERTER_CACHE=$GOC\llama.cpp-converter
set PYTHONUTF8=1
for /f "skip=1 tokens=1" %%m in ('ollama ps 2^>nul') do ollama stop %%m >nul 2>nul
"$p" "$GOC\huan-luyen-ngon-ngu.py" %*
"@
[IO.File]::WriteAllText((Join-Path $GOC 'HUAN-LUYEN.bat'), ($bat -replace "`r?`n", "`r`n"), (New-Object Text.UTF8Encoding $false))
Write-Host ""
Write-Host "== Xong. Huan luyen:" -ForegroundColor Green
Write-Host "   1. cd C:\may-dung ; node may-dung.mjs xuat-tap-mau soan_nhap_agent"
Write-Host "   2. $GOC\HUAN-LUYEN.bat C:\may-dung\out\hoc\ngon-ngu\soan_nhap_agent.train.jsonl --out $GOC\kingsmen-qwen-v1"
Write-Host "      (thu nhanh: them --max-steps 5 --khong-gguf)"
