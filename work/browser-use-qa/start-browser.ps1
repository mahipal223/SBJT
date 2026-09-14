$ErrorActionPreference = 'Stop'
$profile = Join-Path $PSScriptRoot 'runtime/chrome-profile'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
Start-Process -FilePath $chrome -WindowStyle Hidden -ArgumentList @(
    '--headless=new',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=9223',
    "--user-data-dir=`"$profile`"",
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
)
