@echo off
chcp 65001 >nul
cd /d "%~dp0"
set API_PORT=8090
rem 关闭 SQL 日志：账号密码等参数会被它明文写进 logs/，自用不需要
set SQL_LOG_ENABLED=false
".venv\Scripts\python.exe" Start.py
pause
