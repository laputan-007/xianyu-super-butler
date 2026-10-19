; 鱼小铺 Windows 客户端安装包脚本（Inno Setup 6）
; 由 scripts/build_client.py 调用 ISCC 编译，产出 dist/鱼小铺-<版本>-setup.exe
; 设计：**用户级安装**（装到 {localappdata}\Programs，无需管理员权限），
; 数据目录跟着程序走且可写；Node 与 Chromium 运行时均已内置，安装即用。
; 卸载只移除程序文件，运行期生成的 data/ 等数据目录保留（重装可恢复数据）。

#define AppName "鱼小铺"
#define AppVersion GetEnv("YXP_VERSION")
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppExeName "鱼小铺.exe"

[Setup]
AppId={{8B3F5A72-6C4D-4E9A-B1F7-3A5C2D8E9041}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=鱼小铺
DefaultDirName={localappdata}\Programs\{#AppName}
PrivilegesRequired=lowest
DefaultGroupName={#AppName}
UninstallDisplayName={#AppName}
OutputDir=..\dist
OutputBaseFilename=鱼小铺-{#AppVersion}-setup
SetupIconFile=app.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
ShowLanguageDialog=no

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Messages]
chinesesimplified.WelcomeLabel2=这将把 [name/ver] 安装到您的用户目录（无需管理员权限）。%n%n浏览器内核与 Node 运行时已内置，安装后即可直接使用。%n%n数据保存在程序目录下，卸载不会删除数据，重装可继续使用。

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式(&D)"; Flags: checkedonce

[Files]
; 打包产物整体复制（含 _internal/、playwright/、version.txt、使用说明.txt）
Source: "..\dist\鱼小铺\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\卸载 {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
; 静默安装（/SILENT /VERYSILENT）时不自动启动，交互安装完提供「立即运行」
Filename: "{app}\{#AppExeName}"; Description: "立即运行{#AppName}"; Flags: nowait postinstall skipifsilent
