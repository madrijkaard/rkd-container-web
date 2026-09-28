FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY docker/certificates/ /usr/local/share/ca-certificates/
RUN set -eu; \
    ca_bundle=/tmp/rkd-build-ca.pem; \
    : > "$ca_bundle"; \
    for certificate in /usr/local/share/ca-certificates/*.crt; do \
        if [ -f "$certificate" ]; then \
            cat "$certificate" >> "$ca_bundle"; \
            printf '\n' >> "$ca_bundle"; \
        fi; \
    done; \
    if [ -s "$ca_bundle" ]; then \
        NODE_EXTRA_CA_CERTS="$ca_bundle" npm ci; \
    else \
        npm ci; \
    fi
COPY . .
RUN if [ -s /tmp/rkd-build-ca.pem ]; then \
        NODE_EXTRA_CA_CERTS=/tmp/rkd-build-ca.pem npm run build; \
    else \
        npm run build; \
    fi

FROM nginx:stable-alpine
COPY docker/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/container-web/browser/ /usr/share/nginx/html/
EXPOSE 80
