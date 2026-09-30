#!/bin/sh
set -eu

cert=/etc/letsencrypt/live/sinan-pro.com/fullchain.pem
key=/etc/letsencrypt/live/sinan-pro.com/privkey.pem
active=/etc/nginx/conf.d/default.conf

if [ -s "$cert" ] && [ -s "$key" ]; then
    cp /etc/nginx/rkd/https.conf "$active"
    previous=$(sha256sum "$cert" "$key")
else
    cp /etc/nginx/rkd/http.conf "$active"
    previous=''
fi

(
    while :; do
        sleep 30
        if [ -s "$cert" ] && [ -s "$key" ]; then
            current=$(sha256sum "$cert" "$key")
            if [ "$current" != "$previous" ]; then
                cp /etc/nginx/rkd/https.conf "$active"
                if nginx -t && nginx -s reload; then
                    previous=$current
                fi
            fi
        fi
    done
) &
