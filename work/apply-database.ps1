param(
    [string]$DatabaseName = 'ServiceDeskDev',
    [switch]$RunSmokeTest,
    [switch]$DropAfter
)

$ErrorActionPreference = 'Stop'

$databaseName = $DatabaseName
$serverName = '.\SQLEXPRESS'
$root = Split-Path -Parent $PSScriptRoot
$sqlFiles = @(
    'outputs/backend-spec/01-schema.sql',
    'outputs/backend-spec/02-tenant-security.sql',
    'outputs/backend-spec/03-reference-data.sql',
    'outputs/backend-spec/04-document-guards.sql'
)
if ($RunSmokeTest) { $sqlFiles += 'outputs/backend-spec/05-isolation-smoke-tests.sql' }

$password = Read-Host 'SQL password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plainPassword = $null
$masterConnection = $null
$databaseConnection = $null
$createdDatabase = $false

function New-Connection([string]$catalog, [string]$passwordText) {
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = "Server=$serverName;Database=$catalog;User ID=sa;Password=$passwordText;Encrypt=False;TrustServerCertificate=True;Application Name=ServiceDesk Schema Installer"
    return $connection
}

function Invoke-Scalar($connection, [string]$sql) {
    $command = $connection.CreateCommand()
    $command.CommandTimeout = 120
    $command.CommandText = $sql
    return $command.ExecuteScalar()
}

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $masterConnection = New-Connection 'master' $plainPassword
    $masterConnection.Open()

    $exists = [int](Invoke-Scalar $masterConnection "SELECT COUNT(*) FROM sys.databases WHERE name=N'$databaseName'")
    if ($exists -eq 0) {
        $command = $masterConnection.CreateCommand()
        $command.CommandText = "CREATE DATABASE [$databaseName]"
        [void]$command.ExecuteNonQuery()
        $createdDatabase = $true
        Write-Output "Created database $databaseName."
    }

    $databaseConnection = New-Connection $databaseName $plainPassword
    $databaseConnection.Open()
    $tableCount = [int](Invoke-Scalar $databaseConnection "SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0")
    if ($tableCount -gt 0) {
        throw "Database $databaseName is not empty ($tableCount application tables). Scripts were not reapplied."
    }

    foreach ($relativePath in $sqlFiles) {
        $fullPath = Join-Path $root $relativePath
        $contents = [IO.File]::ReadAllText($fullPath)
        $batches = [Text.RegularExpressions.Regex]::Split($contents, '(?im)^\s*GO\s*(?:--.*)?$')
        foreach ($batch in $batches) {
            if ([string]::IsNullOrWhiteSpace($batch)) { continue }
            $command = $databaseConnection.CreateCommand()
            $command.CommandTimeout = 120
            $command.CommandText = $batch
            [void]$command.ExecuteNonQuery()
        }
        Write-Output "Applied $relativePath."
    }

    $summary = $databaseConnection.CreateCommand()
    $summary.CommandText = @'
SELECT
  (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0) AS TableCount,
  (SELECT COUNT(*) FROM sys.security_policies) AS SecurityPolicyCount,
  (SELECT COUNT(*) FROM sys.triggers WHERE is_ms_shipped=0) AS TriggerCount,
  (SELECT COUNT(*) FROM auth.Permissions) AS PermissionCount;
'@
    $reader = $summary.ExecuteReader()
    if ($reader.Read()) {
        Write-Output ("Verified database: {0} tables, {1} security policies, {2} triggers, {3} permissions." -f $reader['TableCount'], $reader['SecurityPolicyCount'], $reader['TriggerCount'], $reader['PermissionCount'])
    }
    $reader.Close()

    if ($DropAfter -and $createdDatabase) {
        $databaseConnection.Close()
        $drop = $masterConnection.CreateCommand()
        $drop.CommandText = "ALTER DATABASE [$databaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$databaseName]"
        [void]$drop.ExecuteNonQuery()
        $createdDatabase = $false
        Write-Output "Removed verification database $databaseName."
    }
}
catch {
    if ($databaseConnection) { $databaseConnection.Close() }
    if ($createdDatabase -and $masterConnection -and $masterConnection.State -eq 'Open') {
        $cleanup = $masterConnection.CreateCommand()
        $cleanup.CommandText = "ALTER DATABASE [$databaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$databaseName]"
        [void]$cleanup.ExecuteNonQuery()
        Write-Output "Removed the incomplete database."
    }
    throw
}
finally {
    if ($databaseConnection) { $databaseConnection.Dispose() }
    if ($masterConnection) { $masterConnection.Dispose() }
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    Remove-Variable plainPassword -ErrorAction SilentlyContinue
}
