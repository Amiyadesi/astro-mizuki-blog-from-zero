Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PreviewScript = Join-Path $PSScriptRoot "preview-local.ps1"
& $PreviewScript @args
