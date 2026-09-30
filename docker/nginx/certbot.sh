#!/bin/sh
set -eu

: "${ACME_EMAIL:?Set ACME_EMAIL in the frontend .env file.}"

until certbot certonly --webroot --webroot-path /var/www/certbot \
    --non-interactive --agree-tos --no-eff-email --email "$ACME_EMAIL" \
    --keep-until-expiring --domain sinan-pro.com; do
    echo 'Certificate request failed; retrying in 10 minutes.' >&2
    sleep 600
done

while :; do
    sleep 43200
    certbot renew --webroot --webroot-path /var/www/certbot --quiet || true
done
