@echo off
chcp 65001 >nul
cd /d "%~dp0"
title May dung video - Kingsmen Content OS
echo === MAY DUNG VIDEO (Kingsmen Content OS) ===
where node >nul 2>nul || (echo Chua co Node.js 22 - tai tai https://nodejs.org roi chay lai & pause & exit /b 1)
where ffmpeg >nul 2>nul || (echo Chua co ffmpeg - chay: winget install Gyan.FFmpeg  roi mo lai cua so nay & pause & exit /b 1)
if not exist may-dung.json (
  echo Chua ghep app. Dan ma ghep (lay o app: Ho so ^> May dung ^> Ket noi may nay):
  set /p MA=MA GHEP:
  node may-dung.mjs ghep %MA% || (pause & exit /b 1)
)
:lap
node may-dung.mjs
echo May dung da thoat - chay lai sau 30 giay (Ctrl+C de dung)
timeout /t 30 >nul
goto lap
