#!/bin/bash
# init-letsencrypt.sh
#
# Run this script ONCE on the server before starting the full stack for the first time.
# It bootstraps the Let's Encrypt certificate so nginx can start with a valid cert.
#
# Usage:
#   chmod +x scripts/init-letsencrypt.sh
#   ./scripts/init-letsencrypt.sh
#
# Requirements:
#   - .env file must exist with DOMAIN and CERTBOT_EMAIL set
#   - Ports 80 and 443 must be open on the server firewall
#   - The domain's DNS A record must point to this server's IP

set -e

# Load variables from .env
if [ ! -f .env ]; then
    echo "Error: .env file not found. Copy .env.example to .env and fill in DOMAIN and CERTBOT_EMAIL."
    exit 1
fi

source .env

if [ -z "$DOMAIN" ] || [ -z "$CERTBOT_EMAIL" ]; then
    echo "Error: DOMAIN and CERTBOT_EMAIL must be set in .env"
    exit 1
fi

CERT_PATH="$(docker volume inspect gams-project_certbot-conf --format '{{.Mountpoint}}' 2>/dev/null)/live/$DOMAIN"

echo "==> Domain   : $DOMAIN"
echo "==> Email    : $CERTBOT_EMAIL"

# Step 1: Create a dummy certificate so nginx can start on HTTPS for the first time
echo ""
echo "==> [1/4] Creating temporary self-signed certificate..."
docker compose run --rm --entrypoint "" certbot sh -c "
    mkdir -p /etc/letsencrypt/live/$DOMAIN &&
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
        -out    /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
        -subj '/CN=localhost'
"

# Step 2: Start nginx (it will use the dummy cert)
echo ""
echo "==> [2/4] Starting nginx with temporary certificate..."
docker compose up -d frontend
sleep 5

# Step 3: Delete the dummy cert and request a real one from Let's Encrypt
echo ""
echo "==> [3/4] Requesting Let's Encrypt certificate..."
docker compose run --rm --entrypoint "" certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$CERTBOT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# Step 4: Reload nginx to pick up the real certificate
echo ""
echo "==> [4/4] Reloading nginx with the real certificate..."
docker exec gams-frontend nginx -s reload

echo ""
echo "Done. HTTPS is now active for https://$DOMAIN"
echo "Certbot will auto-renew the certificate every 12 hours (see certbot service in docker-compose.yml)."
