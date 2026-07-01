import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (process.platform !== "win32") {
  process.exit(0);
}

const exePath = resolve("src-tauri/target/debug/app.exe");
const workspaceRoot = resolve(".");

if (!existsSync(exePath)) {
  process.exit(0);
}

const escapedExePath = exePath.replaceAll("'", "''");
const escapedWorkspaceRoot = workspaceRoot.replaceAll("'", "''");
const script = `
$target = '${escapedExePath}'
$workspaceRoot = '${escapedWorkspaceRoot}'
$protectedIds = New-Object 'System.Collections.Generic.HashSet[int]'
$current = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
while ($null -ne $current) {
  [void]$protectedIds.Add([int]$current.ProcessId)
  $parentId = [int]$current.ParentProcessId
  if ($parentId -le 0 -or $protectedIds.Contains($parentId)) {
    break
  }
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$parentId" -ErrorAction SilentlyContinue
}
$processes = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $target }
foreach ($process in $processes) {
  Write-Host "Stopping stale Tauri app process tree $($process.ProcessId): $target"
  taskkill.exe /PID $process.ProcessId /T /F 2>$null
}

$tauriDevProcesses = Get-CimInstance Win32_Process | Where-Object {
  -not $protectedIds.Contains([int]$_.ProcessId) -and
  $_.CommandLine -like "*$workspaceRoot*" -and
  $_.CommandLine -like "*@tauri-apps\\cli\\tauri.js*" -and
  $_.CommandLine -like "* dev*"
}
foreach ($process in $tauriDevProcesses) {
  Write-Host "Stopping stale Tauri dev runner $($process.ProcessId)"
  taskkill.exe /PID $process.ProcessId /T /F 2>$null
}
exit 0
`;

execFileSync(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
  { stdio: "inherit" },
);
