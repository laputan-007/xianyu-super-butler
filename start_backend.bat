@echo off
rem Fully detached backend start: the spawned python process is not tied
rem to this session's background task tree, so it survives the session.
set API_PORT=9999
cd /d E:\workspace\2026\custome_project\xianyu-super-butler
start "yuxiaopu-backend" /min "E:\software\python\python.exe" Start.py >> backend.log 2>&1
