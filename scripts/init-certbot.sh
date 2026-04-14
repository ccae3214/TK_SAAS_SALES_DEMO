#!/bin/bash
# Initialize Let's Encrypt certificates for the first time
# Run this script before starting the docker-compose stack

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

DOMAIN="${LETSENCRYPT_DOMAIN}"
EMAIL="${LETSENCRYPT_EMAIL}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Error: LETSENCRYPT_DOMAIN and LETSENCRYPT_EMAIL must be set in .env"
  exit 1
fi

echo "Initializing Let's Encrypt certificates for domain: $DOMAIN"
echo "Email: $EMAIL"

# Create necessary directories
mkdir -p ./certs
mkdir -p ./certbot_www

# Start nginx to allow ACME challenge
echo "Starting nginx for ACME challenge validation..."
docker-compose up -d nginx

# Wait for nginx to be ready
sleep 5

# Run certbot to obtain initial certificate
echo "Requesting certificate from Let's Encrypt..."
docker-compose run --rm certbot

# Verify certificate was created
if [ -f "./certs/live/$DOMAIN/fullchain.pem" ]; then
  echo "✓ Certificate obtained successfully!"
  echo "✓ Location: ./certs/live/$DOMAIN/"
  
  # Update nginx.conf with correct certificate path
  sed -i "s|ssl_certificate /etc/letsencrypt/live/yourdomain|ssl_certificate /etc/letsencrypt/live/$DOMAIN|g" ./nginx.conf
  sed -i "s|ssl_certificate_key /etc/letsencrypt/live/yourdomain|ssl_certificate_key /etc/letsencrypt/live/$DOMAIN|g" ./nginx.conf
  
  # Reload nginx
  docker-compose exec -T nginx nginx -s reload
  echo "✓ Nginx configuration updated and reloaded"
else
  echo "✗ Certificate not found. Check certbot logs above for errors."
  exit 1
fi

echo ""
echo "Setup complete! Your site now has HTTPS enabled."
echo "Certificates will be automatically renewed by the certbot service."
