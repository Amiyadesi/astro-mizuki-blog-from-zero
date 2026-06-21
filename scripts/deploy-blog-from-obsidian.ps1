param(
  [switch]$SkipInstall,
  [switch]$CommitChanges,
  [switch]$PushChanges,
  [switch]$VerifyLocalBuild,
  [string]$PushRemote = "origin",
  [string]$PushBranch = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BlogDir = Join-Path $Root "blog"
$BlogDist = Join-Path $BlogDir "dist"
$SyncScript = Join-Path $BlogDir "scripts\sync-content.js"

$GitPublishPaths = @(
  "articles/posts",
  "articles/friends",
  "articles/anime",
  "articles/templates",
  "articles/spec",
  "articles/site",
  "articles/assets",
  "articles/.obsidian/community-plugins.json",
  "articles/.obsidian/templates.json",
  "articles/.obsidian/types.json",
  "articles/.obsidian/core-plugins.json",
  "articles/.obsidian/plugins/post-history-tracker",
  "blog/src/content/posts",
  "blog/src/content/spec",
  "blog/src/data/anime.ts",
  "blog/src/data/friends.ts",
  "blog/public/_redirects",
  "blog/public/assets",
  "blog/public/images/posts",
  "blog/src/generated/friends.ts",
  "blog/src/generated/obsidian-config.ts"
)

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

function Invoke-GitPublishCommit {
  $status = & git -C $Root status --porcelain -- $GitPublishPaths
  if (-not $status) {
    Write-Host "> no blog content changes to commit"
    return $false
  }

  Invoke-Checked -Command "git" -Arguments (@("add", "--") + $GitPublishPaths)

  $staged = & git -C $Root diff --cached --name-only -- $GitPublishPaths
  if (-not $staged) {
    Write-Host "> no staged blog content changes"
    return $false
  }

  $commitMessage = @"
Publish Obsidian blog content

Sync Obsidian-authored content before remote deployment.
"@

  Invoke-Checked -Command "git" -Arguments @("commit", "-m", $commitMessage)
  return $true
}

function Get-GitPublishBranch {
  $branch = [string](& git -C $Root branch --show-current)
  if ($LASTEXITCODE -ne 0) {
    throw "git branch --show-current failed with exit code $LASTEXITCODE"
  }

  $branch = $branch.Trim()
  if (-not $branch) {
    throw "Cannot push from detached HEAD. Pass -PushBranch explicitly."
  }

  return $branch
}

function Get-HttpsRemoteUrl {
  param(
    [Parameter(Mandatory = $true)][string]$Remote
  )

  $remoteUrl = [string](& git -C $Root remote get-url $Remote 2>$null)
  if ($LASTEXITCODE -ne 0) {
    return ""
  }

  $remoteUrl = $remoteUrl.Trim()
  if ($remoteUrl -match "^git@github\.com:(.+)$") {
    return "https://github.com/$($Matches[1])"
  }

  if ($remoteUrl -match "^ssh://git@github\.com/(.+)$") {
    return "https://github.com/$($Matches[1])"
  }

  if ($remoteUrl -match "^https://") {
    return $remoteUrl
  }

  return ""
}

function Invoke-GitPublishHttpsFallback {
  param(
    [Parameter(Mandatory = $true)][string]$Remote,
    [Parameter(Mandatory = $true)][string]$Branch
  )

  $proxy = $env:HTTPS_PROXY
  if (-not $proxy) {
    $proxy = $env:HTTP_PROXY
  }
  if (-not $proxy) {
    return $false
  }

  $httpsRemote = Get-HttpsRemoteUrl -Remote $Remote
  if (-not $httpsRemote) {
    return $false
  }

  Write-Warning "git push over SSH failed. Retrying once over HTTPS via configured proxy."
  Invoke-Checked -Command "git" -Arguments @("-c", "http.proxy=$proxy", "push", $httpsRemote, $Branch)
  return $true
}

function Invoke-GitPublishPush {
  $remote = $PushRemote.Trim()
  if (-not $remote) {
    throw "Push remote cannot be empty."
  }

  $branch = $PushBranch.Trim()
  if (-not $branch) {
    $branch = Get-GitPublishBranch
  }

  try {
    Invoke-Checked -Command "git" -Arguments @("push", $remote, $branch)
  } catch {
    if (Invoke-GitPublishHttpsFallback -Remote $remote -Branch $branch) {
      return
    }
    throw
  }
}

Write-Host "1. Sync Obsidian articles/site/assets -> blog" -ForegroundColor Green
Invoke-Checked -Command "node" -Arguments @($SyncScript)

$committed = $false
if ($CommitChanges) {
  Write-Host "2. Commit blog content changes" -ForegroundColor Green
  $committed = Invoke-GitPublishCommit
} else {
  Write-Host "2. Skip git commit" -ForegroundColor Green
}

if ($VerifyLocalBuild) {
  Write-Host "3. Install blog dependencies when needed" -ForegroundColor Green
  if (-not $SkipInstall -or -not (Test-Path -LiteralPath (Join-Path $BlogDir "node_modules"))) {
    Invoke-Checked -Command "pnpm" -Arguments @("install", "--frozen-lockfile") -WorkingDirectory $BlogDir
  } else {
    Write-Host "> skipped pnpm install"
  }

  Write-Host "4. Build blog locally" -ForegroundColor Green
  Invoke-Checked -Command "pnpm" -Arguments @("run", "build") -WorkingDirectory $BlogDir

  if (-not (Test-Path -LiteralPath $BlogDist)) {
    throw "Blog dist directory not found: $BlogDist"
  }
} else {
  Write-Host "3. Skip local build; GitHub Actions or Cloudflare Pages can build after push" -ForegroundColor Green
}

if ($PushChanges) {
  Write-Host "5. Push source changes to GitHub" -ForegroundColor Green
  Invoke-GitPublishPush
} else {
  Write-Host "5. Skip git push" -ForegroundColor Green
}

Write-Host "Done." -ForegroundColor Green
if ($committed -and -not $PushChanges) {
  Write-Host "> run git push when ready to trigger GitHub Actions deployment"
}
