param(
  [switch]$SkipInstall,
  [int]$BlogPort = 4173
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BlogDir = Join-Path $Root "blog"
$SyncScript = Join-Path $BlogDir "scripts\sync-content.js"
$PidFile = Join-Path $Root ".preview-pids.json"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$WorkingDirectory = $Root
  )

  Write-Host "> $Command $($Arguments -join ' ')" -ForegroundColor Cyan
  Push-Location $WorkingDirectory
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Escape-PowerShellSingleQuote {
  param([Parameter(Mandatory = $true)][string]$Value)
  return $Value.Replace("'", "''")
}

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

function Stop-PreviewPort {
  param([Parameter(Mandatory = $true)][int]$Port)

  try {
    $connections = @(Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    foreach ($connection in $connections) {
      if ($connection.OwningProcess) {
        Stop-PreviewProcessTree -ProcessId ([int]$connection.OwningProcess)
        Write-Host "Stopped process $($connection.OwningProcess) on port $Port"
      }
    }
  } catch {
    Write-Warning "Could not inspect preview port $Port`: $($_.Exception.Message)"
  }
}

function Wait-PreviewReady {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
      continue
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

if (Test-Path -LiteralPath $PidFile) {
  try {
    $Existing = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
    foreach ($ProcessId in @($Existing.blogPid)) {
      if ($ProcessId) {
        Stop-PreviewProcessTree -ProcessId ([int]$ProcessId)
      }
    }
  } catch {
    Write-Warning "Could not stop previous preview processes: $($_.Exception.Message)"
  }
}
Stop-PreviewPort -Port $BlogPort

Write-Host "1. Sync articles -> Mizuki content" -ForegroundColor Green
Invoke-Checked -Command "node" -Arguments @($SyncScript)

Write-Host "2. Install blog dependencies when needed" -ForegroundColor Green
$NodeModulesDir = Join-Path $BlogDir "node_modules"
if (-not (Test-Path -LiteralPath $NodeModulesDir)) {
  Write-Host "> blog/node_modules missing; installing dependencies"
  Invoke-Checked -Command "pnpm" -Arguments @("install", "--frozen-lockfile") -WorkingDirectory $BlogDir
} elseif (-not $SkipInstall) {
  Invoke-Checked -Command "pnpm" -Arguments @("install", "--frozen-lockfile") -WorkingDirectory $BlogDir
} else {
  Write-Host "> skipped pnpm install because blog/node_modules exists"
}

Write-Host "3. Build Mizuki blog" -ForegroundColor Green
Invoke-Checked -Command "pnpm" -Arguments @("run", "build") -WorkingDirectory $BlogDir

$EscapedBlog = Escape-PowerShellSingleQuote $BlogDir

Write-Host "4. Start local blog preview server" -ForegroundColor Green
$BlogProcess = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "Set-Location -LiteralPath '$EscapedBlog'; pnpm run preview -- --host 127.0.0.1 --port $BlogPort"
)

$BlogUrl = "http://127.0.0.1:$BlogPort/"

@{
  blogPid = $BlogProcess.Id
  blogUrl = $BlogUrl
} | ConvertTo-Json | ForEach-Object {
  $Utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($PidFile, $_, $Utf8NoBom)
}

if (Wait-PreviewReady -Url $BlogUrl) {
  Write-Host "> preview server is ready"
} else {
  Write-Warning "Preview server did not respond before timeout. Browser auto-open may fall back to the plugin."
}

Write-Host "Blog: $BlogUrl" -ForegroundColor Green
Write-Host "Stop: .\scripts\stop-preview.ps1"
