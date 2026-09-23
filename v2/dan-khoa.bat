@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
echo === DAN KHOA API CHO KINGSMEN CONTENT OS (content.masfico.vn) ===
echo Moi dong: dan khoa roi Enter. Bo trong + Enter = bo qua khoa do. Khoa chi luu tren Cloudflare, khong luu o may nay.
echo.
for %%K in (ANTHROPIC_API_KEY GOOGLE_TTS_KEY GEMINI_API_KEY OPENAI_API_KEY GROQ_API_KEY DEEPINFRA_API_KEY YOUTUBE_API_KEY) do (
  set "GT="
  set /p GT=%%K =
  if defined GT (
    echo(!GT!| npx wrangler secret put %%K >nul 2>&1 && echo   [OK] %%K da luu || echo   [LOI] %%K khong luu duoc
  ) else (
    echo   (bo qua %%K)
  )
)
echo.
echo Xong. Mo https://content.masfico.vn ^> May de kiem tra cac dau ● san sang.
pause
