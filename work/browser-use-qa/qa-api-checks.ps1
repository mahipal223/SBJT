$ErrorActionPreference = 'Stop'
$root = 'http://localhost:5080/api/v1/businesses/11111111-1111-1111-1111-111111111111'
$headers = @{'X-Dev-User-Id'='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}
$customerId = '6cfebe44-bd73-46ad-abd4-e02f6b019218'
$jobId = '48bc3174-fd62-48f1-9f31-71e652eee9f9'
function Check-Request($name, $url, $expected, $body = $null, $requestHeaders = $headers) {
    $parameters = @{Uri=$url;Headers=$requestHeaders;SkipHttpErrorCheck=$true}
    if ($null -ne $body) { $parameters.Method='POST'; $parameters.ContentType='application/json'; $parameters.Body=($body|ConvertTo-Json) }
    $response = Invoke-WebRequest @parameters
    if ([int]$response.StatusCode -ne $expected) { throw "$name expected $expected, received $($response.StatusCode): $($response.Content)" }
    [pscustomobject]@{check=$name;status=[int]$response.StatusCode;result='PASS'}
}
Check-Request 'Anonymous denied' "$root/customers" 401 $null @{}
Check-Request 'Foreign workspace hidden' ($root.Replace('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')+'/customers') 404
Check-Request 'Missing customer hidden' "$root/customers/22222222-2222-2222-2222-222222222222" 404
Check-Request 'Test customer persisted' "$root/customers/$customerId" 200
Check-Request 'Test job persisted' "$root/jobs/$jobId" 200
Check-Request 'Invalid job transition rejected' "$root/jobs/$jobId/status" 422 @{status='Scheduled'}
Check-Request 'Invalid arrival window rejected' "$root/jobs" 400 @{customerId=$customerId;title='QA P1-4 INVALID MUST NOT SAVE';priority='Normal';scheduledDate='2026-09-12';arrivalWindow='10:00 AM - 9:00 AM'}


