#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
backend_script="$script_dir/../rkd-dockestra-core/refresh-local.sh"
compose_file="$script_dir/docker-compose.local.yml"

if [[ ! -f "$backend_script" ]]; then
    # Compatibilidade com o nome da pasta local anterior à renomeação.
    backend_script="$script_dir/../rkd-container-core/refresh-local.sh"
fi

if [[ ! -f "$backend_script" ]]; then
    echo 'Backend não encontrado. Mantenha rkd-dockestra-core ao lado de rkd-dockestra-web.' >&2
    exit 1
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    echo 'Docker e Docker Compose são necessários para atualizar o ambiente local.' >&2
    exit 1
fi

cd "$script_dir"
compose=(docker compose -f "$compose_file")

# Validate the local configuration before rebuilding either project.
"${compose[@]}" config --quiet

bash "$backend_script"

echo 'Reconstruindo frontend e Nginx locais...'
docker build -t rkd-web-local-frontend:latest "$script_dir"
docker build -t rkd-web-local-nginx:latest -f "$script_dir/Dockerfile.proxy.local" "$script_dir"
"${compose[@]}" up -d --no-build --force-recreate --wait --wait-timeout 180 frontend nginx

# Compose considers services without healthchecks ready when they are running.
# Confirm that Nginx actually serves the UI and reaches the backend API.
for ((attempt = 1; attempt <= 30; attempt++)); do
    if "${compose[@]}" exec -T nginx sh -c \
        'wget -q -O /dev/null http://127.0.0.1/ && wget -q -O /dev/null http://127.0.0.1/api/auth/session/' \
        >/dev/null 2>&1; then
        echo 'Ambiente local pronto em http://localhost:8080/'
        exit 0
    fi
    sleep 2
done

echo 'O Nginx iniciou, mas a interface ou a API ainda não responde. Consulte os logs:' >&2
echo "  docker compose -f $compose_file logs --tail=100 frontend nginx" >&2
exit 1
