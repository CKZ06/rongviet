@echo off
title Mo link Online Cloudflare cho khach xem web
cd /d "%~dp0"

echo ======================================================================
echo   DANG KHOI TAO LINK ONLINE CHO KHACH XEM (CLOUDFLARE TUNNEL)
echo ======================================================================
echo.
echo   [QUAN TRONG] Hay chac chan ban DA BAT file "chay_web.bat" truoc!
echo   (Neu chua bat chay_web.bat thi web se bao loi ket noi).
echo.
echo   Doi khoang 3 giay, ben duoi se hien link https://...trycloudflare.com
echo   Ban chi can COPY link do va gui cho khach xem tren dien thoai / may tinh!
echo.
echo   KHI KHACH BAO SUA:
echo   Ban chi can sua file HTML/CSS/JS o may ban va bam Luu (Ctrl + S),
echo   Khach chi can bam F5 (tai lai trang) la thay doi moi ngay lap tuc!
echo ======================================================================
echo.

cloudflared.exe tunnel --url http://127.0.0.1:3000

pause
