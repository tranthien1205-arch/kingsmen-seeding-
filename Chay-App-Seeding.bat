@echo off
chcp 65001 >nul
title Kingsmen Seeding - Server
echo Dang khoi dong Kingsmen Seeding tren localhost...
start "Kingsmen Seeding Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
exit
