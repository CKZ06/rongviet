@echo off
title Dino4VN Web Server & Steam Login
cd /d "%~dp0"

echo ========================================================
echo   DANG KHOI DONG SERVER DINO4VN & STEAM LOGIN
echo   Dia chi web: http://localhost:3000
echo ========================================================
echo.

:: Tu dong mo trinh duyet vao localhost:3000 sau 1 giay
start "" http://localhost:3000

:: Chay web server
node server.js

pause

