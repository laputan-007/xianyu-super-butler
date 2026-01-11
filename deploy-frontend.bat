@echo off
echo ========================================
echo 前端部署脚本
echo ========================================

echo.
echo [1/3] 构建前端...
cd frontend
call npm run build
if errorlevel 1 (
    echo 构建失败！
    pause
    exit /b 1
)

echo.
echo [2/3] 清理旧版本的 JS/CSS 文件...
del /Q ..\static\assets\*.js 2>nul
del /Q ..\static\assets\*.css 2>nul
echo 已清理旧文件

echo.
echo [3/3] 复制新的构建产物...
xcopy /E /I /Y dist\* ..\static\ >nul
if errorlevel 1 (
    echo 复制失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo 部署完成！
echo 请重启后端服务并刷新浏览器
echo ========================================
pause
