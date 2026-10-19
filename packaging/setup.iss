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

[Code]
var
  PortPage: TInputQueryWizardPage;

procedure InitializeWizard();
begin
  // 端口设置页：默认 18099，被占用或用户偏好时可改；安装后写入 {app}\port.txt。
  // 注意：此阶段 {app} 常量尚未初始化，读回旧端口的逻辑在 CurStepChanged 里做。
  PortPage := CreateInputQueryPage(wpWelcome,
    '服务端口设置',
    '鱼小铺管理后台在本机监听的端口',
    '默认 18099。若该端口被占用或您有其他偏好，可修改为 1024-65535 之间的任意端口。' + #13#10#13#10 +
    '安装后如需再改：编辑程序目录下的 port.txt 并重启程序即可。');
  PortPage.Add('监听端口：', False);
  PortPage.Values[0] := '18099';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  PortStr: string;
  PortNum: Integer;
begin
  Result := True;
  if CurPageID = PortPage.ID then
  begin
    PortStr := Trim(PortPage.Values[0]);
    PortNum := StrToIntDef(PortStr, 0);
    if (PortNum < 1024) or (PortNum > 65535) then
    begin
      MsgBox('端口必须是 1024-65535 之间的数字（默认 18099）。', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  FinalPort: string;
  PrevPort: string;
  PrevLines: TArrayOfString;
begin
  if CurStep = ssPostInstall then
  begin
    FinalPort := Trim(PortPage.Values[0]);
    // 升级安装且用户没在向导里改过（仍是默认值，含静默安装）：读回上一次的
    // 自定义端口，不悄悄重置用户的选择（旧 port.txt 不在 [Files] 清单，安装不会删它）
    if FinalPort = '18099' then
    begin
      if FileExists(ExpandConstant('{app}\port.txt')) then
      begin
        if LoadStringsFromFile(ExpandConstant('{app}\port.txt'), PrevLines) then
        begin
          if GetArrayLength(PrevLines) > 0 then
          begin
            PrevPort := Trim(PrevLines[0]);
            if (StrToIntDef(PrevPort, 0) >= 1024) and (StrToIntDef(PrevPort, 0) <= 65535) then
              FinalPort := PrevPort;
          end;
        end;
      end;
    end;
    SaveStringToFile(ExpandConstant('{app}\port.txt'), FinalPort + #13#10, False);
  end;
end;
