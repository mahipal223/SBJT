param(
    [string]$Server = ".\SQLEXPRESS",
    [string]$Database = "ServiceDeskDev"
)

$ErrorActionPreference = "Stop"

function Execute-SqlBatches([string]$connectionString, [string]$scriptPath) {
    Write-Host "Executing script: $(Split-Path $scriptPath -Leaf)..." -ForegroundColor Cyan
    $content = Get-Content $scriptPath -Raw
    
    # Split batches by GO statements on their own line (case-insensitive, optional semicolon or comment)
    $batches = [System.Text.RegularExpressions.Regex]::Split($content, '(?im)^\s*GO;?\s*(?:--.*)?$')
    
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    try {
        foreach ($batch in $batches) {
            $trimmed = $batch.Trim()
            if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
            
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = $trimmed
            $cmd.CommandTimeout = 120
            $null = $cmd.ExecuteNonQuery()
        }
        Write-Host " -> Completed $(Split-Path $scriptPath -Leaf)" -ForegroundColor Green
    }
    finally {
        $conn.Dispose()
    }
}

Write-Host "Connecting to server: $Server" -ForegroundColor Yellow
$masterConnStr = "Server=$Server;Database=master;Integrated Security=True;Encrypt=True;TrustServerCertificate=True"

# Check / Clean-Create Database
$conn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
$conn.Open()
try {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "IF EXISTS (SELECT 1 FROM sys.databases WHERE name = '$Database') BEGIN ALTER DATABASE [$Database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$Database]; END; CREATE DATABASE [$Database];"
    $null = $cmd.ExecuteNonQuery()
    Write-Host "Pristine database [$Database] created on $Server" -ForegroundColor Green
}
finally {
    $conn.Dispose()
}

$dbConnStr = "Server=$Server;Database=$Database;Integrated Security=True;Encrypt=True;TrustServerCertificate=True"
$specDir = Join-Path $PSScriptRoot "..\docs\backend-spec"

# Execute only schemas, rules, reference codes, and guards (strictly skipping demo data)
$scripts = @(
    "01-schema.sql",
    "02-tenant-security.sql",
    "03-reference-data.sql",
    "04-document-guards.sql"
)

foreach ($script in $scripts) {
    $fullPath = Join-Path $specDir $script
    if (Test-Path $fullPath) {
        Execute-SqlBatches -connectionString $dbConnStr -scriptPath $fullPath
    } else {
        Write-Warning "Script not found: $fullPath"
    }
}

Write-Host "`nSUCCESS: Database [$Database] initialized with tables and security rules (no demo data)." -ForegroundColor Green
