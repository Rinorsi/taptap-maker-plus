@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"
set "TAPTAP_INSTALL_ROOT=%ROOT:~0,-1%"
set "TAPTAP_DIAGNOSTICS_DIR=%TAPTAP_INSTALL_ROOT%\diagnostics"
"%ROOT%node-runtime\node.exe" "%ROOT%collect-desktop-diagnostics.mjs" --open
echo.
echo If the diagnostics folder did not open, check: %TAPTAP_DIAGNOSTICS_DIR%
pause
