param([Parameter(Mandatory)][string]$Script)
$ErrorActionPreference = 'Stop'
$env:BH_HOME = Join-Path $PSScriptRoot 'runtime/harness'
$env:BU_CDP_URL = 'http://127.0.0.1:9223'
$env:BH_RECORD = '0'
$env:BH_TAB_MARKER = '0'
$env:ANONYMIZED_TELEMETRY = 'false'
$env:PYTHONIOENCODING = 'utf-8'
Get-Content -LiteralPath $Script -Raw | & "$PSScriptRoot/.venv/Scripts/browser-use.exe"
if ($LASTEXITCODE -ne 0) { throw "Browser-use exited with code $LASTEXITCODE" }
