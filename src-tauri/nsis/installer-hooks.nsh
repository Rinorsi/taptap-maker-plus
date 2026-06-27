!macro STOP_TAPTAP_MAKER_PLUS ROOT_PATH
  nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { $$target = [System.IO.Path]::GetFullPath('${ROOT_PATH}\app.exe'); Get-Process app -ErrorAction SilentlyContinue | Where-Object { $$_.Path -eq $$target } | Stop-Process -Force }"`
  Pop $2
  Pop $3
!macroend

!macro STOP_TAPTAP_NODE_RUNTIME ROOT_PATH
  nsExec::ExecToStack `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "& { $$target = [System.IO.Path]::GetFullPath('${ROOT_PATH}\node-runtime\node.exe'); Get-Process node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -eq $$target } | Stop-Process -Force }"`
  Pop $2
  Pop $3
!macroend

!macro NSIS_HOOK_PREINSTALL
  Push $0
  Push $1
  Push $2
  Push $3

  !insertmacro STOP_TAPTAP_MAKER_PLUS "$INSTDIR"
  !insertmacro STOP_TAPTAP_NODE_RUNTIME "$INSTDIR"

  ReadRegStr $0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\TapTap Maker Plus" "InstallLocation"
  StrCmp $0 "" check_wrong_product
    StrCpy $1 $0 1
    StrCmp $1 '"' 0 check_polluted_current_location
      StrCpy $0 $0 "" 1
      StrCpy $0 $0 -1

  check_polluted_current_location:
    ${StrLoc} $1 $0 "TapTap Maker Plus 桌面端" ">"
    StrCmp $1 "" 0 cleanup_polluted_current
    StrCmp $0 "$LOCALAPPDATA\TapTap Maker Plus" done
    Goto done

  cleanup_polluted_current:
    !insertmacro STOP_TAPTAP_MAKER_PLUS "$0"
    ReadRegStr $3 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\TapTap Maker Plus" "UninstallString"
    StrCmp $3 "" skip_current_uninstall
      ExecWait '$3 /UPDATE /P _?=$0' $2

  skip_current_uninstall:
    RMDir /r "$0"
    DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\TapTap Maker Plus"
    DeleteRegKey SHCTX "Software\TapTap Maker\TapTap Maker Plus"
    StrCpy $INSTDIR "$LOCALAPPDATA\TapTap Maker Plus"
    SetOutPath $INSTDIR

  check_wrong_product:
  ReadRegStr $0 SHCTX "Software\TapTap Maker\TapTap Maker Plus" ""
  StrCmp $0 "" check_wrong_product_uninstall
    StrCpy $1 $0 1
    StrCmp $1 '"' 0 check_polluted_manufacturer_location
      StrCpy $0 $0 "" 1
      StrCpy $0 $0 -1

  check_polluted_manufacturer_location:
    ${StrLoc} $1 $0 "TapTap Maker Plus 桌面端" ">"
    StrCmp $1 "" 0 cleanup_polluted_manufacturer_location
    Goto check_wrong_product_uninstall

  cleanup_polluted_manufacturer_location:
    RMDir /r "$0"
    DeleteRegKey SHCTX "Software\TapTap Maker\TapTap Maker Plus"
    StrCpy $INSTDIR "$LOCALAPPDATA\TapTap Maker Plus"
    SetOutPath $INSTDIR

  check_wrong_product_uninstall:
  ReadRegStr $1 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\TapTap Maker Plus 桌面端" "InstallLocation"
  StrCmp $1 "" fallback_wrong_location
    StrCpy $2 $1 1
    StrCmp $2 '"' 0 use_wrong_location
      StrCpy $1 $1 "" 1
      StrCpy $1 $1 -1
    Goto use_wrong_location

  fallback_wrong_location:
    StrCpy $1 "$LOCALAPPDATA\TapTap Maker Plus 桌面端"
    IfFileExists "$1\app.exe" 0 done

  use_wrong_location:
    !insertmacro STOP_TAPTAP_MAKER_PLUS "$1"
    ReadRegStr $3 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\TapTap Maker Plus 桌面端" "UninstallString"
    StrCmp $3 "" skip_wrong_uninstall
      ExecWait '$3 /UPDATE /P _?=$1' $2

  skip_wrong_uninstall:
    RMDir /r "$1"
    DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\TapTap Maker Plus 桌面端"
    DeleteRegKey SHCTX "Software\TapTap Maker\TapTap Maker Plus 桌面端"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TapTap Maker Plus 桌面端"
    StrCpy $INSTDIR "$LOCALAPPDATA\TapTap Maker Plus"
    SetOutPath $INSTDIR

  done:
    RMDir /r "$INSTDIR\apps"
    RMDir /r "$INSTDIR\node_modules"
    RMDir /r "$INSTDIR\node-runtime"
    Pop $3
    Pop $2
    Pop $1
    Pop $0
!macroend

!macro NSIS_HOOK_POSTINSTALL
  Delete "$DESKTOP\TapTap Maker Plus 桌面端.lnk"
  Delete "$SMPROGRAMS\TapTap Maker Plus\TapTap Maker Plus 桌面端.lnk"
  Delete "$SMPROGRAMS\TapTap Maker Plus 桌面端.lnk"
  Delete "$SMPROGRAMS\TapTap Maker Plus 桌面端\TapTap Maker Plus 桌面端.lnk"
  RMDir "$SMPROGRAMS\TapTap Maker Plus 桌面端"
!macroend
