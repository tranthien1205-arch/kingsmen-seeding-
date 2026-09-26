@echo off
rem MAY CON CHAY NEN KHI BAT MAY (Kingsmen Content OS, 26/09) - Task Scheduler goi luc khoi dong, KHONG can dang nhap Windows.
rem Cai bang cai-chay-nen.ps1. Khong hoi gi, khong mo cua so: nhat ky o may-dung.log.
rem Khong dung "timeout" (loi khi khong co ban phim o phien nen) - cho bang ping.
cd /d "%~dp0"
if exist chay-nen-path.cmd call chay-nen-path.cmd
if not exist may-dung.json exit /b 1
where ollama >nul 2>nul && ("%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq ollama.exe" | "%SystemRoot%\System32\find.exe" /i "ollama.exe" >nul || start "" /b ollama serve)
:lap
node may-dung.mjs --nen
if errorlevel 3 if not errorlevel 4 goto cho
"%SystemRoot%\System32\PING.EXE" -n 31 127.0.0.1 >nul
goto lap
:cho
rem ban khac (cua so BAT-DAU) dang chay - cho 1 phut roi thu lai; cua so dong la ban nen nhan viec
"%SystemRoot%\System32\PING.EXE" -n 61 127.0.0.1 >nul
goto lap
