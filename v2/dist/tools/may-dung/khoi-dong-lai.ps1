# KHỞI ĐỘNG LẠI HẰNG NGÀY cho máy con (Task Scheduler gọi, mặc định 4:00 sáng). Giữ máy chạy lâu ngày cho ổn định.
# Chờ máy con làm xong lệnh đang dở (dang-lam.json) tối đa $ChoToiDaPhut phút rồi mới khởi động lại. Quá hạn vẫn khởi động
# lại: lệnh chưa xong thì máy con (bản 1.4+) tự làm tiếp sau khi Windows lên và tự đăng nhập.
# Dòng lệnh viết không dấu: file .ps1 có thể bị đọc bằng cp1252 → dấu tiếng Việt phá cú pháp.
param([int]$ChoToiDaPhut = 180, [int]$DemNguocGiay = 120)
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOG = Join-Path $DIR 'may-dung.log'
$DANG = Join-Path $DIR 'dang-lam.json'
function Ghi($m) { try { Add-Content -Path $LOG -Value ((Get-Date -Format 'HH:mm:ss d/M/yyyy') + ' [khoi-dong-lai] ' + $m) -Encoding UTF8 } catch {} }

$han = (Get-Date).AddMinutes($ChoToiDaPhut)
if (Test-Path $DANG) { Ghi "may con dang lam lenh - cho toi da $ChoToiDaPhut phut" }
while ((Test-Path $DANG) -and ((Get-Date) -lt $han)) { Start-Sleep -Seconds 60 }
$con = Test-Path $DANG
Ghi ("khoi dong lai may sau $DemNguocGiay giay" + $(if ($con) { ' (lenh chua xong - may con se lam tiep sau khi len)' } else { '' }))
shutdown.exe /r /t $DemNguocGiay /c "Khoi dong lai hang ngay (Kingsmen may con). Huy: shutdown /a"
