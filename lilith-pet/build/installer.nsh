!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WordFunc.nsh"

!ifndef BUILD_UNINSTALLER
Var LilithPage
Var LilithUpdateButton
Var LilithRemoveButton
Var LilithInstallVersion
Var LilithInstallFolder
Var LilithInstallScope

!macro customWelcomePage
  Page custom LilithMaintenancePage LilithMaintenanceLeave
!macroend

!macro customHeader
Function LilithMaintenancePage
  ${If} ${Silent}
    Abort
  ${EndIf}
  ${If} ${isUpdated}
    Abort
  ${EndIf}
  StrCpy $LilithInstallFolder ""
  StrCpy $LilithInstallScope "currentuser"
  ReadRegStr $LilithInstallVersion HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${If} $hasPerUserInstallation == "1"
    StrCpy $LilithInstallFolder $perUserInstallationFolder
  ${ElseIf} $hasPerMachineInstallation == "1"
    StrCpy $LilithInstallFolder $perMachineInstallationFolder
    StrCpy $LilithInstallScope "allusers"
    ReadRegStr $LilithInstallVersion HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Lilith Setup" "Install, update, or remove your desktop companion."
  nsDialogs::Create 1018
  Pop $LilithPage
  ${If} $LilithPage == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 25u "This setup installs Lilith.exe and creates your shortcuts. You do not need a separate portable download."
  Pop $0
  ${If} $LilithInstallFolder == ""
    ${NSD_CreateLabel} 0 32u 100% 18u "Lilith is not installed. Click Next to install version ${VERSION}."
    Pop $0
  ${Else}
    ${NSD_CreateLabel} 0 32u 100% 18u "Installed: $LilithInstallVersion. Click Next to reinstall this setup's version (${VERSION})."
    Pop $0
  ${EndIf}
  ${NSD_CreateButton} 0 60u 48% 23u "Update from GitHub"
  Pop $LilithUpdateButton
  ${NSD_OnClick} $LilithUpdateButton LilithCheckUpdate
  ${NSD_CreateButton} 52% 60u 48% 23u "Uninstall Lilith"
  Pop $LilithRemoveButton
  ${NSD_OnClick} $LilithRemoveButton LilithRemove
  ${NSD_CreateLabel} 0 94u 100% 38u "Update checks the latest stable GitHub release and verifies its SHA-256 before installing. Uninstall removes the app and shortcuts; your settings and extracted game assets are kept."
  Pop $0
  ${If} $LilithInstallFolder == ""
    EnableWindow $LilithUpdateButton 0
    EnableWindow $LilithRemoveButton 0
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function LilithMaintenanceLeave
  ${If} $LilithInstallVersion != ""
    ${VersionCompare} "$LilithInstallVersion" "${VERSION}" $0
    ${If} $0 == 1
      MessageBox MB_ICONINFORMATION "A newer Lilith is already installed. Use Update from GitHub to check for updates, or Cancel to keep your installation."
      Abort
    ${EndIf}
  ${EndIf}
FunctionEnd

Function LilithCheckUpdate
  InitPluginsDir
  ; The helper outlives this setup; copy to its own unique temporary directory.
  GetTempFileName $0
  Delete $0
  CreateDirectory $0
  SetOutPath $0
  File /oname=update.ps1 "${BUILD_RESOURCES_DIR}\update.ps1"
  Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "$0\update.ps1" -InstalledVersion "$LilithInstallVersion" -InstallFolder "$LilithInstallFolder" -Scope "$LilithInstallScope"'
  IfErrors 0 +3
    MessageBox MB_ICONSTOP "Could not start the update checker. Please download setup from github.com/nuttyuwu/lilith-desktop/releases."
    Return
  System::Call 'user32::PostMessageW(p $HWNDPARENT, i ${WM_CLOSE}, p 0, p 0)'
  Return
FunctionEnd

Function LilithRemove
  IfFileExists "$LilithInstallFolder\${UNINSTALL_FILENAME}" 0 missingUninstaller
  ExecShell "open" "$LilithInstallFolder\${UNINSTALL_FILENAME}"
  IfErrors missingUninstaller
  System::Call 'user32::PostMessageW(p $HWNDPARENT, i ${WM_CLOSE}, p 0, p 0)'
  Return
missingUninstaller:
  MessageBox MB_ICONEXCLAMATION "The uninstaller could not be opened. Use Windows Settings > Apps > Installed apps > Lilith > Uninstall."
FunctionEnd
!macroend
!endif
