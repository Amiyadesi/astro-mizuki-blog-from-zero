Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $Root ".preview-pids.json"
$BlogPort = 4173

function Stop-PreviewProcessTree {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try {
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
    foreach ($child in $children) {
      Stop-PreviewProcessTree -ProcessId ([int]$child.ProcessId)
    }
  } catch {
    # Non-Windows PowerShell may not expose Win32_Process; stopping the parent is still useful.
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $PidFile)) {
  Write-Host "No preview PID file found."
} else {
  $Preview = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
  foreach ($ProcessId in @($Preview.blogPid)) {
    if ($ProcessId) {
      Stop-PreviewProcessTree -ProcessId ([int]$ProcessId)
      Write-Host "Stopped process $ProcessId"
    }
  }

  Remove-Item -LiteralPath $PidFile -Force
}

try {
  $connections = @(Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $BlogPort -State Listen -ErrorAction SilentlyContinue)
  foreach ($connection in $connections) {
    if ($connection.OwningProcess) {
      Stop-PreviewProcessTree -ProcessId ([int]$connection.OwningProcess)
      Write-Host "Stopped process $($connection.OwningProcess) on port $BlogPort"
    }
  }
} catch {
  Write-Warning "Could not inspect preview port $BlogPort`: $($_.Exception.Message)"
}

Write-Host "Preview stopped."
