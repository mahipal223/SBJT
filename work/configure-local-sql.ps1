param(
    [string]$ServerName = '.\SQLEXPRESS',
    [string]$DatabaseName = 'ServiceDeskDev'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $root 'src\ServiceDesk.Api\ServiceDesk.Api.csproj'
$seedFile = Join-Path $root 'outputs\backend-spec\06-development-data.sql'
$administratorPassword = Read-Host 'SQL administrator password' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($administratorPassword)
$plainAdministratorPassword = $null
$administratorConnection = $null

try {
    $plainAdministratorPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $administratorConnection = New-Object System.Data.SqlClient.SqlConnection
    $administratorConnection.ConnectionString = "Server=$ServerName;Database=$DatabaseName;User ID=sa;Password=$plainAdministratorPassword;Encrypt=False;TrustServerCertificate=True;Application Name=ServiceDesk Local Setup"
    $administratorConnection.Open()

    $seedSql = [IO.File]::ReadAllText($seedFile)
    $seedCommand = $administratorConnection.CreateCommand()
    $seedCommand.CommandTimeout = 120
    $seedCommand.CommandText = $seedSql
    [void]$seedCommand.ExecuteNonQuery()

    $runtimePasswordBytes = New-Object byte[] 36
    [Security.Cryptography.RandomNumberGenerator]::Fill($runtimePasswordBytes)
    $runtimePassword = [Convert]::ToBase64String($runtimePasswordBytes)
    $escapedRuntimePassword = $runtimePassword.Replace("'", "''")
    $loginSql = @"
USE [master];
IF SUSER_ID(N'servicedesk_runtime') IS NULL
    CREATE LOGIN [servicedesk_runtime] WITH PASSWORD=N'$escapedRuntimePassword', CHECK_POLICY=ON, CHECK_EXPIRATION=OFF;
ELSE
    ALTER LOGIN [servicedesk_runtime] WITH PASSWORD=N'$escapedRuntimePassword';
USE [$DatabaseName];
IF USER_ID(N'servicedesk_runtime') IS NULL
    CREATE USER [servicedesk_runtime] FOR LOGIN [servicedesk_runtime];
IF NOT EXISTS
(
    SELECT 1
    FROM sys.database_role_members AS drm
    INNER JOIN sys.database_principals AS role_principal ON role_principal.principal_id = drm.role_principal_id
    INNER JOIN sys.database_principals AS member_principal ON member_principal.principal_id = drm.member_principal_id
    WHERE role_principal.name = N'servicedesk_app' AND member_principal.name = N'servicedesk_runtime'
)
    ALTER ROLE [servicedesk_app] ADD MEMBER [servicedesk_runtime];
GRANT DELETE ON OBJECT::app.JobItems TO [servicedesk_runtime];
"@
    $loginCommand = $administratorConnection.CreateCommand()
    $loginCommand.CommandTimeout = 120
    $loginCommand.CommandText = $loginSql
    [void]$loginCommand.ExecuteNonQuery()

    $connectionString = "Server=$ServerName;Database=$DatabaseName;User ID=servicedesk_runtime;Password=$runtimePassword;Encrypt=False;TrustServerCertificate=True;Application Name=ServiceDesk API"
    $env:DOTNET_CLI_HOME = (Resolve-Path (Join-Path $root 'work')).Path
    & dotnet user-secrets set 'ConnectionStrings:ServiceDesk' $connectionString --project $apiProject | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not save the local API connection string in .NET user-secrets.'
    }

    Write-Output 'Development workspace data was applied.'
    Write-Output 'Restricted SQL login was created and the API connection was saved in .NET user-secrets.'
}
finally {
    if ($administratorConnection) { $administratorConnection.Dispose() }
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    Remove-Variable plainAdministratorPassword -ErrorAction SilentlyContinue
    Remove-Variable runtimePassword -ErrorAction SilentlyContinue
    Remove-Variable connectionString -ErrorAction SilentlyContinue
}
