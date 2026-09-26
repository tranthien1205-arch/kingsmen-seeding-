@echo off
chcp 65001 >nul
cd /d "%~dp0"
title May dung video - Kingsmen Content OS
echo === MAY DUNG VIDEO (Kingsmen Content OS) ===
where node >nul 2>nul || (echo Chua co Node.js 22 - tai tai https://nodejs.org roi chay lai & pause & exit /b 1)
where ffmpeg >nul 2>nul || (echo Chua co ffmpeg - chay: winget install Gyan.FFmpeg  roi mo lai cua so nay & pause & exit /b 1)
rem Ghep lan dau. KHONG dat khoi ( ... ) quanh set /p: %MA% trong khoi bi no truoc khi nguoi dung dan ma,
rem va dau ) trong dong echo se dong khoi som (loi ": was unexpected at this time").
if exist may-dung.json goto lap
echo Chua ghep app. Lay ma ghep trong app: bam TEN CUA BAN goc duoi ben trai ^> khung May dung cua toi ^> + Ket noi may nay.
echo Dan ma MAY1... vao day roi Enter:
set /p MA=MA GHEP: 
node may-dung.mjs ghep %MA% || (pause & exit /b 1)
:lap
node may-dung.mjs
if errorlevel 3 if not errorlevel 4 goto nen
echo May dung da thoat - chay lai sau 30 giay (Ctrl+C de dung)
timeout /t 30 >nul
goto lap
:nen
echo May con dang chay nen (tac vu khi bat may) - cua so nay khong can nua. Nhat ky: may-dung.log
timeout /t 20 >nul
exit /b 0
