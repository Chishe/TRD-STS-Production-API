@echo off
echo ===============================
echo START CSV API WITH PM2
echo ===============================

:: ไปยังโฟลเดอร์โปรเจกต์
cd /d C:\Users\HOME\Documents\backned

:: Start PM2 with ecosystem
pm2 start ecosystem.config.js

:: แสดงสถานะ
pm2 status

pause
