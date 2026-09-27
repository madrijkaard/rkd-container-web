# Container Web

Angular and TypeScript frontend for the Container platform. Users can create, view, update, and delete projects, environments, images, and setups. Each detail page lists its child records and provides a button to add another child.

Records with associated children cannot be deleted. The detail page shows a notification when the backend rejects deletion; delete the child records first.

The icon in the top-right corner switches between light and dark themes. The preference is saved in the browser; without a saved preference, the interface follows the system theme.

Source code identifiers, routes, API fields, and configuration names use English. Text displayed in the interface remains in Brazilian Portuguese.

The backend fills `created_by` and `last_modified_by` with the logged-in operator; these fields are not shown in forms or detail pages. The Code field is converted to uppercase and accepts only letters A-Z, numbers, and `_`.
Description is free text. Its letters are converted to uppercase while spaces, accents, and punctuation are preserved.

The image detail page displays `definition` as Dockerfile code with highlighted instructions, line numbers, and horizontal scrolling for long commands. The original text remains unchanged.

An image can optionally store a GitHub repository URL and branch. In the image form, entering a URL such as `https://github.com/madrijkaard/rkd-survivor-engine` loads the repository's branches into a selection box. For a private repository, select **É um repositório privado?** and enter a token with Contents read permission. The token field is enabled only when the checkbox is selected. The token is not shown again after saving; editing with an empty token field keeps the saved credential if the repository is unchanged. Changing the URL or token clears the branch selection. GitHub errors are reported in the form. When a container is created, the backend checks out that branch and uses its source as the Docker build context.

On a project detail page, **Visualizar setups** opens a table of that project's setups with their image and environment codes. Each row links to the setup detail page and has a **Criar container** action. The action asks Container Core to build the stored Dockerfile and start a container with the setup's CPU and memory limits, optional port mapping, and optional named volume. If Docker is unavailable, the page shows a Portuguese notification.

The setup form accepts `port` as `host_port:container_port`, for example `8000:8000`, and binds to `127.0.0.1` by default. To choose an explicit IPv4 bind address, use `IP:host_port:container_port`. The optional `volume` field uses `name:/absolute/container/path`, for example `backend_data:/data`. Leave either field empty when that setup does not need it.

## Requirements

- A Node.js version compatible with Angular 22 (Node.js 24.15 or later is supported)
- npm

## Run locally

Start Container Core on port `8000` and apply its Django migrations first. Then, from this repository:

```bash
npm install
npm start
```

Open `http://localhost:4200/` and log in with a Django staff account created with `manage.py createsuperuser` or through the Django admin. The development server proxies `/api/` requests to Django using `proxy.conf.json`. For deployment, serve the app over HTTPS and forward the same path to Container Core.

## Deploy on the Ubuntu VPS with Docker Compose

This repository has a separate `docker-compose.yml`. It starts a static Angular frontend container, an Nginx gateway container, and a Certbot container for HTTPS certificate issuance and renewal. The Nginx gateway serves `https://sinan-pro.com`, forwards `/api/`, `/admin/`, and `/static/` to the backend container, and forwards other paths to the frontend. Both Compose projects join the `rkd-network` created by the backend Compose project.

Before starting, point the `sinan-pro.com` DNS A record at the VPS public IPv4 address, open inbound TCP ports 80 and 443, and ensure no other service binds those ports. HTTP port 80 is needed for Let's Encrypt's HTTP challenge. Clone the backend and frontend repositories, start the backend Compose project first, then in this frontend checkout:

```bash
cp .env.example .env
# Set ACME_EMAIL in .env to an email address you control.
docker compose up -d --build
docker compose ps
docker compose logs -f certbot nginx
```

Nginx initially answers HTTP with a temporary status page while Certbot obtains a certificate. When certificate files appear, it enables HTTPS automatically; renewal is checked twice daily, and Nginx reloads when the certificate changes. Certificate state is persisted under `volumes/nginx/letsencrypt/`; HTTP challenge files use `volumes/nginx/acme/`. These runtime directories are ignored by Git. Do not delete them during updates. To inspect the result, open `https://sinan-pro.com/` and sign in with a Django staff user created in the backend database.

This configuration serves only `sinan-pro.com`. To use `www.sinan-pro.com`, add that hostname to the certificate, Nginx configuration, backend allowed hostnames, and Cloudflare Turnstile widget.

The login form displays Cloudflare Turnstile when the backend exposes a configured site key. Configure `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and optionally `TURNSTILE_ALLOWED_HOSTNAMES` on Container Core as described in its README. No Turnstile secret belongs in the frontend. Production login is unavailable until both keys are configured.

## Verify

```bash
npm test -- --watch=false
npm run build
```
