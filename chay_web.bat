@echo off
title Server Rong Viet
cd /d "%~dp0"
echo ===================================================
echo Dang khoi dong Web va dong bo API Rong Viet...
echo ===================================================
if not exist "dino4vn.com\assets\img\spinosaurus_render.png" (
    copy /y "C:\Users\Cuong\.gemini\antigravity\brain\9af05656-aeb6-48da-a8ff-d1fc0ec7cfce\.user_uploaded\media_1792587815579_d8f54288.png" "dino4vn.com\assets\img\spinosaurus_render.png" >nul 2>&1
)
node server.js
pause
