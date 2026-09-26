# CÀI MÁY CON CHẠY NỀN KHI BẬT MÁY — không cần đăng nhập Windows (26/09/2026)
# Mở PowerShell bằng "Run as administrator" rồi chạy:
#   irm https://content.masfico.vn/tools/may-dung/cai-chay-nen.ps1 | iex
# Làm gì: tải bản mới may-dung.mjs / BAT-DAU.bat / CHAY-NEN.bat vào thư mục máy con (C:\may-dung hoặc nơi đã cài), ghi PATH hiện tại (node, ffmpeg, ollama) vào
#   chay-nen-path.cmd, tạo tác vụ Task Scheduler chạy CHAY-NEN.bat lúc khởi động máy dưới chính tài khoản này, kiểu S4U
#   ("chạy dù người dùng chưa đăng nhập", KHÔNG lưu mật khẩu). Máy khởi động lại (Windows Update, mất điện) là máy con tự lên, tự học tiếp.
# Vì sao S4U được ở đây (khác Trạm): máy con không mở trình duyệt / không cần màn hình — chỉ ffmpeg, Whisper, CLIP, Ollama, gọi app qua HTTPS.
#   Giới hạn của S4U: không vào được ổ mạng (\\máy-khác\...) — thư mục nạp phải nằm trên ổ của chính máy này (C:, D:...).
# Có cửa sổ BAT-DAU đang mở thì bản nền chờ; đóng cửa sổ là bản nền nhận việc (khoá dang-chay.json, máy con 1.6).
# Gỡ: Unregister-ScheduledTask 'Kingsmen may con - chay nen khi bat may'
# Dòng lệnh viết không dấu (irm giải mã ISO-8859-1).
$ErrorActionPreference = 'Continue'
$APP = 'https://content.masfico.vn'
# thư mục máy con: $env:MAY_CON_DIR, hoặc chỗ đầu tiên có may-dung.json + may-dung.mjs
$ung = @($env:MAY_CON_DIR, 'C:\may-dung', 'D:\may-dung', (Join-Path $HOME 'may-dung'), (Join-Path $HOME 'Desktop\may-dung'), (Join-Path $HOME 'Downloads\may-dung')) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'may-dung.json')) -and (Test-Path (Join-Path $_ 'may-dung.mjs')) }
$DIR = if ($ung) { @($ung)[0] } else { 'C:\may-dung' }
$TEN = 'Kingsmen may con - chay nen khi bat may'
Write-Host "== Kingsmen Content OS - may con chay nen khi bat may" -ForegroundColor Cyan
$laAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laAdmin) { Write-Host "  X Can mo PowerShell bang 'Run as administrator' (bam phai PowerShell > Run as administrator) roi chay lai lenh nay." -ForegroundColor Red; return }
if (-not (Test-Path (Join-Path $DIR 'may-dung.json'))) { Write-Host "  X May nay chua ghep app ($DIR\may-dung.json). Neu may con cai o cho khac: `$env:MAY_CON_DIR='D:\duong\toi\may-dung' roi chay lai." -ForegroundColor Red; return }
foreach ($f in 'may-dung.mjs','BAT-DAU.bat','CHAY-NEN.bat') {
  try { Invoke-WebRequest -UseBasicParsing "$APP/tools/may-dung/$f" -OutFile (Join-Path $DIR $f); Write-Host "  tai $f" } catch { Write-Host "  X khong tai duoc $f - $($_.Exception.Message)" -ForegroundColor Red; return }
}
$duong = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
Set-Content -Path (Join-Path $DIR 'chay-nen-path.cmd') -Value ('@set "PATH=' + $duong + '"') -Encoding ASCII
foreach ($t in 'node','ffmpeg','ollama') { $c = Get-Command $t -ErrorAction SilentlyContinue; Write-Host ("  " + $t + ": " + $(if ($c) { $c.Source } else { 'KHONG THAY' })) }

$act = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c "' + (Join-Path $DIR 'CHAY-NEN.bat') + '"') -WorkingDirectory $DIR
$trg = New-ScheduledTaskTrigger -AtStartup
$trg.Delay = 'PT1M'
$pri = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited
$set = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TEN -Action $act -Trigger $trg -Principal $pri -Settings $set -Description ('May con Kingsmen Content OS chay khi bat may, khong can dang nhap (S4U, khong luu mat khau). Nhat ky: ' + (Join-Path $DIR 'may-dung.log')) -Force | Out-Null
$t = Get-ScheduledTask -TaskName $TEN -ErrorAction SilentlyContinue
if (-not $t) { Write-Host "  X khong tao duoc tac vu" -ForegroundColor Red; return }
Start-ScheduledTask -TaskName $TEN
Write-Host "  da tao va bat tac vu: $TEN" -ForegroundColor Green
Write-Host "  Tu gio: bat may la may con tu chay (khong can dang nhap). Cua so BAT-DAU dang mo (neu co) van chay; dong no thi ban nen nhan viec trong 1 phut."
Write-Host "  Kiem: Get-ScheduledTaskInfo '$TEN'  |  nhat ky: Get-Content $DIR\may-dung.log -Tail 20"
