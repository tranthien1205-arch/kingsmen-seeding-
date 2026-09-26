# CÀI KHỞI ĐỘNG LẠI HẰNG NGÀY cho máy con Kingsmen Content OS (không cần quyền admin):
#   irm https://content.masfico.vn/tools/may-dung/cai-khoi-dong-lai.ps1 | iex
# Đổi giờ: $env:GIO_KHOI_DONG_LAI = '03:30' trước khi chạy (mặc định 04:00). Gỡ: Unregister-ScheduledTask 'Kingsmen may con - khoi dong lai hang ngay'
# Làm gì: tải khoi-dong-lai.ps1 vào C:\may-dung, tạo tác vụ Task Scheduler chạy mỗi ngày dưới tài khoản đang đăng nhập (Interactive,
#         không S4U — theo luật máy con), kiểm tra Windows có tự đăng nhập sau khởi động lại chưa (thiếu thì máy nằm ở màn hình khoá,
#         lối tắt Startup của máy con và Ollama không chạy — sự cố 25/09: Windows Update khởi động lại 02:30, máy nghỉ tới 06:15).
# Dòng lệnh viết không dấu (irm giải mã ISO-8859-1, chạy từ đĩa giải mã cp1252).
$ErrorActionPreference = 'Continue'
$APP = 'https://content.masfico.vn'
$DIR = 'C:\may-dung'
$TEN = 'Kingsmen may con - khoi dong lai hang ngay'
$GIO = if ($env:GIO_KHOI_DONG_LAI) { $env:GIO_KHOI_DONG_LAI } else { '04:00' }
Write-Host "== Kingsmen Content OS - khoi dong lai hang ngay luc $GIO" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $DIR 'may-dung.mjs'))) { Write-Host "  X Chua co may con o $DIR - chay cai-may-hoc.ps1 truoc." -ForegroundColor Red; return }
try { Invoke-WebRequest -UseBasicParsing "$APP/tools/may-dung/khoi-dong-lai.ps1" -OutFile (Join-Path $DIR 'khoi-dong-lai.ps1'); Write-Host "  tai khoi-dong-lai.ps1" } catch { Write-Host "  X khong tai duoc khoi-dong-lai.ps1 - $($_.Exception.Message)" -ForegroundColor Red; return }

$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $DIR 'khoi-dong-lai.ps1') + '"') -WorkingDirectory $DIR
$trg = New-ScheduledTaskTrigger -Daily -At $GIO
$pri = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$set = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 4) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TEN -Action $act -Trigger $trg -Principal $pri -Settings $set -Description 'Cho may con lam xong lenh dang do (toi da 3 gio) roi khoi dong lai; may con tu lam tiep lenh dang do sau khi len.' -Force | Out-Null
$t = Get-ScheduledTask -TaskName $TEN -ErrorAction SilentlyContinue
if ($t) { Write-Host "  da tao tac vu: $TEN - lan chay toi: $((Get-ScheduledTaskInfo -TaskName $TEN).NextRunTime)" -ForegroundColor Green } else { Write-Host "  X khong tao duoc tac vu" -ForegroundColor Red }

$wl = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -ErrorAction SilentlyContinue
if (Get-ScheduledTask -TaskName 'Kingsmen may con - chay nen khi bat may' -ErrorAction SilentlyContinue) { Write-Host "  May con chay nen khi bat may: CO (khong can tu dang nhap)" -ForegroundColor Green }
elseif ($wl.AutoAdminLogon -eq '1') { Write-Host "  Windows tu dang nhap: CO ($($wl.DefaultUserName))" -ForegroundColor Green }
else {
  Write-Host "  ! Windows CHUA tu dang nhap sau khi khoi dong lai. Khong co buoc nay, may nam o man hinh khoa va may con khong chay." -ForegroundColor Yellow
  Write-Host "    Cach de nhat (khong can mat khau): PowerShell Run as administrator > irm https://content.masfico.vn/tools/may-dung/cai-chay-nen.ps1 | iex"
  Write-Host "    Hoac tu dang nhap (can mat khau, nguoi dung tu nhap): tai Autologon cua Microsoft https://learn.microsoft.com/sysinternals/downloads/autologon"
  Write-Host "    -> mo Autologon64.exe -> nhap mat khau -> Enable. (Tai khoan Microsoft: truoc do tat 'Chi cho dang nhap Windows Hello' trong Cai dat > Tai khoan > Tuy chon dang nhap.)"
}
