param(
  [string]$BaseUrl = "http://localhost"
)

$ErrorActionPreference = "Stop"

function Get-EnvOrDefault {
  param(
    [string]$Name,
    [string]$DefaultValue
  )

  $current = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($current)) {
    [Environment]::SetEnvironmentVariable($Name, $DefaultValue)
    return $DefaultValue
  }

  return $current
}

function Assert-Status {
  param(
    [string]$Url,
    [int]$ExpectedStatus,
    [string]$Label
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 15
    $status = [int]$response.StatusCode
    $body = $response.Content
  } catch {
    if (-not $_.Exception.Response) {
      throw
    }

    $status = [int]$_.Exception.Response.StatusCode
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    $reader.Close()
  }

  if ($status -ne $ExpectedStatus) {
    throw "$Label failed. Expected HTTP $ExpectedStatus from $Url but got $status. Body: $body"
  }

  Write-Host "[ok] $Label => $status"
  return $body
}

$null = New-Item -ItemType Directory -Force scripts | Out-Null

$env:NEXTAUTH_URL = Get-EnvOrDefault "NEXTAUTH_URL" $BaseUrl
$env:APP_ORIGIN = Get-EnvOrDefault "APP_ORIGIN" $BaseUrl
$env:NEXTAUTH_SECRET = Get-EnvOrDefault "NEXTAUTH_SECRET" "local-docker-test-secret"
$env:ADMIN_EMAILS = Get-EnvOrDefault "ADMIN_EMAILS" "admin@example.com"
$env:OIDC_CLIENT_ID = Get-EnvOrDefault "OIDC_CLIENT_ID" "dummy-client-id"
$env:OIDC_CLIENT_SECRET = Get-EnvOrDefault "OIDC_CLIENT_SECRET" "dummy-client-secret"
$env:OIDC_ISSUER = Get-EnvOrDefault "OIDC_ISSUER" "https://accounts.google.com"

Write-Host "[step] docker compose build"
docker compose build
if ($LASTEXITCODE -ne 0) {
  throw "docker compose build failed"
}

Write-Host "[step] docker compose up -d --force-recreate"
docker compose up -d --force-recreate
if ($LASTEXITCODE -ne 0) {
  throw "docker compose up failed"
}

Write-Host "[step] waiting for app"
Start-Sleep -Seconds 4

$homeBody = Assert-Status -Url $BaseUrl -ExpectedStatus 200 -Label "Homepage"
$productsBody = Assert-Status -Url "$BaseUrl/api/products" -ExpectedStatus 200 -Label "Products API"
$adminBody = Assert-Status -Url "$BaseUrl/api/admin/dashboard" -ExpectedStatus 401 -Label "Admin API without auth"

$products = $productsBody | ConvertFrom-Json
if ($products.Count -lt 1) {
  throw "Products API returned no products"
}

if ($homeBody -notmatch "__NEXT_DATA__|_next/static|Demo") {
  throw "Homepage response did not look like a Next.js page"
}

Write-Host "[ok] Product count => $($products.Count)"
Write-Host "[ok] Admin API body => $adminBody"

Write-Host "[step] recent app logs"
docker logs --tail 20 tk_saas_sales_demo-app-1
if ($LASTEXITCODE -ne 0) {
  throw "docker logs failed"
}

Write-Host "[done] Docker deploy and verification completed successfully."
