# Windows 客户端打包方案（EXE）

把「鱼小铺」打成一个双击即用的 Windows 桌面客户端：**无边框原生窗口**（pywebview + Edge WebView2 内核）承载管理后台界面，服务端（uvicorn + 账号任务）整体跑在进程内，无需安装 Python、无需另起服务。

## 一、方案总览

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 打包器 | **PyInstaller（onedir 目录式）** | 单文件模式（onefile）每次启动要解压到临时目录且更易被杀软误报，本应用有 data/ 等持久化目录，目录式才是正确形态 |
| 窗口壳 | **pywebview 6.x（frameless）** | 无原生标题栏；网页自绘标题栏（拖拽 + 最小化/最大化/关闭），窗口控制走 `js_api` 桥 |
| 界面 | 复用现有 React 前端 | 标题栏组件按 `window.pywebview` 桥存在与否门控——**浏览器访问完全不受影响** |
| 浏览器内核 | Playwright Chromium 随包分发 | 滑块验证、扫码登录依赖；装在 exe 旁的 `playwright/` 目录 |
| 版本管理 | `app/version.py` 单一来源 | 打包时回写构建时间与 git 提交号（构建后源码自动还原）；运行期优先读 exe 旁 `version.txt` |

## 二、产物结构

```
鱼小铺/
├── 鱼小铺.exe            # 双击启动（弹桌面窗口，默认端口 18099）
├── version.txt           # 发行版本号（运行期读取，升级只换包不动源码常量）
├── 使用说明.txt           # 用户须知（Node.js 依赖、默认账号、数据目录、常见问题）
├── _internal/            # PyInstaller 运行时
│   ├── static/           # 前端构建产物 + 签名 JS（xianyu_js_version_2.js）
│   ├── global_config.yml # 全局配置模板（PROJECT_ROOT 运行期解析到这里）
│   ├── playwright/driver/# pywebview/playwright 的 node 驱动（必须显式收集）
│   └── libssl-3-x64.dll 等 # conda 底座 venv 需要的 OpenSSL DLL
├── playwright/           # Playwright Chromium 浏览器（chromium-*/chrome-win64/）
├── data/                 # 运行后生成：SQLite 数据库
├── browser_data/         # 运行后生成：账号浏览器配置
└── logs/                 # 运行后生成：日志（无控制台模式下 stdout 也重定向到这里）
```

**数据与升级**：`data/`、`browser_data/`、`logs/` 都在 exe 同目录生成；升级 = 删旧程序文件、解压新包覆盖，数据不动。

## 三、打包步骤

```bash
# 前置：一次性安装打包依赖（业务依赖 requirements.txt 另装）
pip install -r requirements-build.txt   # pyinstaller / pillow / pywebview

# 一键打包（在仓库根目录，用项目 venv 的 Python）
.venv/Scripts/python.exe scripts/build_client.py            # 完整构建
.venv/Scripts/python.exe scripts/build_client.py --skip-frontend  # 前端产物已最新时跳过

# 产物
dist/鱼小铺/                      # 发行目录
dist/鱼小铺-<版本>-win64.zip      # 可分发压缩包（约 400+ MB，含 Chromium）
```

`scripts/build_client.py` 内部流程：

1. **版本打戳**：把构建时间和 git 提交号写入 `app/version.py`（`BUILD_TIME`/`GIT_COMMIT`），构建完成后还原源码
2. **前端构建**：`npm run build`（产物进 `static/`）
3. **图标**：`frontend/public/logo.png` → `packaging/app.ico`（Pillow 多尺寸转换）
4. **PyInstaller**：按 `packaging/xianyu_butler.spec` 打 onedir 包
5. **组装**：写 `version.txt`、`使用说明.txt`
6. **浏览器**：`playwright install chromium` 装到发行目录的 `playwright/`
7. **压缩**：产出 `鱼小铺-<版本>-win64.zip`

## 四、关键实现点（踩过的坑）

1. **uvicorn 字符串导入**：`Start.py` 里 `uvicorn.Config("app.reply_server:app", ...)` 是运行期字符串导入，PyInstaller 静态分析抓不到 → spec 里 `hiddenimports=['app.reply_server']`
2. **playwright node 驱动**：PyInstaller 常规分析**不会**收集 `playwright/driver/`（node.exe + package），缺失时 `chromium.launch` 报 `WinError 2` → spec 里从构建环境的 playwright 包显式收进 datas（官方文档做法）
3. **conda 底座 OpenSSL**：venv 基于 Anaconda Python 时 `_ssl` 依赖的 `libssl-3-x64.dll`/`libcrypto-3-x64.dll` 在 `Library/bin` 下收不到 → spec 里手动收集（python.org 官方发行版不需要）
4. **Chromium 目录布局**：Playwright 新版（1.5x+）Windows 布局是 `chrome-win64/`，旧版是 `chrome-win/`——`Start.py` 的浏览器预检函数两种都认
5. **冻结模式初始化顺序**：`Start.py` 顶部的 frozen 块必须在任何 `app.*` 导入之前执行——db_manager 导入时就按相对路径建 `data/xianyu_data.db`；块内完成三件事：`os.chdir(exe目录)`、设 `PLAYWRIGHT_BROWSERS_PATH`、默认 `API_PORT=18099`，并给无控制台模式重定向 stdout/stderr 到日志文件
6. **窗口形态**：`__main__` 里检测 pywebview 可用性 → 应用整体跑后台线程，主线程跑 `webview.start()`；窗口关闭 `os._exit(0)` 硬退（后台线程为 daemon）
7. **标题栏门控**：前端 `DesktopTitleBar` 组件与布局偏移（`pt-9`、侧栏 `top-9`）全部以 `window.pywebview` 桥存在为条件——浏览器/网页版零影响；壳内布局高度统一 `calc(100vh-36px)` 防溢出滚动条

## 五、用户环境要求

- **Node.js**（消息签名计算用，PyExecJS 运行时；无 Node 时部分环境可回落 Windows 自带 JScript，未充分验证）
- WebView2 运行时（Win11 自带；Win10 绝大多数随 Edge 已装）
- 杀软误报：无代码签名的 exe 可能被误报，需引导用户将目录加白（正式分发建议购买代码签名证书）

## 六、版本与发布流程

1. 改版本号：`app/version.py` 的 `APP_VERSION`（单一来源，`/health`、关于页、版本检查都从这里取）
2. 打包：`scripts/build_client.py`（自动带上 git 提交号）
3. 发布：`dist/鱼小铺-<版本>-win64.zip` 即发行物；公网公告源同步更新 `latest_version` 供「关于」页检查更新
4. 用户升级：解压覆盖程序目录（`data/` 等不受影响），`version.txt` 随包更新

## 七、常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 双击后没反应 | 看 `logs/stdout.log` 与 `logs/` 最新日志；多为端口被占（默认 18099，可设环境变量 `API_PORT`） |
| 启动报「浏览器无法启动」 | `playwright/` 目录缺失或布局不对（应含 `chromium-*/chrome-win64/chrome.exe`）——重新打包 |
| AI/签名相关功能失效 | 用户机器未装 Node.js |
| 滑块验证、扫码登录不可用 | 启动自检会打印「浏览器自检通过/失败」；失败多为杀软拦截 Chromium 或目录被杀软隔离 |
| 升级后数据丢失 | 确认是「覆盖程序目录」而不是换整个目录（data/ 在程序目录里） |
