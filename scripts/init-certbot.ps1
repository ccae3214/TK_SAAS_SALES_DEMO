# Initialize Let's Encrypt certificates for the first time (Windows PowerShell)
# Run this script before starting the docker-compose stack

param(
    [string]$Domain = "",
    [string]$Email = ""
)

# Load environment variables from .env file
if (Test-Path ".env") {
    $envContent = Get-Content ".env" | Where-Object { $_ -notmatch "^#" -and $_ -notmatch "^\s*$" }
    foreach ($line in $envContent) {
        $key, $value = $line -split "=", 2
        [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim())
    }
}

# Use provided parameters or read from environment
$Domain = if ($Domain) { $Domain } else { $env:LETSENCRYPT_DOMAIN }
$Email = if ($Email) { $Email } else { $env:LETSENCRYPT_EMAIL }

if (-not $Domain -or -not $Email) {
    Write-Host "Error: Domain and email required. Either pass as parameters or set LETSENCRYPT_DOMAIN and LETSENCRYPT_EMAIL in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Initializing Let's Encrypt certificates" -ForegroundColor Green
Write-Host "Domain: $Domain"
Write-Host "Email: $Email"
Write-Host ""

# Create necessary directories
New-Item -ItemType Directory -Force -Path "./certs" | Out-Null
New-Item -ItemType Directory -Force -Path "./certbot_www" | Out-Null

Write-Host "Starting nginx for ACME challenge validation..." -ForegroundColor Yellow
docker-compose up -d nginx

Write-Host "Waiting for nginx to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Requesting certificate from Let's Encrypt..." -ForegroundColor Yellow
docker-compose run --rm certbot

# Check if certificate was created
$certPath = "./certs/live/$Domain/fullchain.pem"
if (Test-Path $certPath) {
    Write-Host "✓ Certificate obtained successfully!" -ForegroundColor Green
    Write-Host "✓ Location: ./certs/live/$Domain/" -ForegroundColor Green
    
    # Update nginx.conf with correct certificate path
    Write-Host "Updating nginx configuration..." -ForegroundColor Yellow
    $nginxConf = Get-Content "./nginx.conf" -Raw
    $nginxConf = $nginxConf -replace "ssl_certificate /etc/letsencrypt/live/yourdomain", "ssl_certificate /etc/letsencrypt/live/$Domain"
    $nginxConf = $nginxConf -replace "ssl_certificate_key /etc/letsencrypt/live/yourdomain", "ssl_certificate_key /etc/letsencrypt/live/$Domain"
    Set-Content "./nginx.conf" $nginxConf
    
    # Reload nginx
    Write-Host "Reloading nginx..." -ForegroundColor Yellow
    docker-compose exec -T nginx nginx -s reload
    
    Write-Host "✓ Nginx configuration updated and reloaded" -ForegroundColor Green
} else {
    Write-Host "✗ Certificate not found. Check certbot logs above for errors." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Setup complete! Your site now has HTTPS enabled." -ForegroundColor Green
Write-Host "Certificates will be automatically renewed by the certbot service." -ForegroundColor Green
