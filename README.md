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

## Testar localmente com Docker

Use Docker Desktop no modo **containers Linux**, com Docker Compose disponível. O script do backend pode gerar a chave pelo **Git Bash no Windows** (com OpenSSL disponível) ou pelo Ubuntu/WSL com a [integração Docker](https://docs.docker.com/desktop/features/wsl/) habilitada. Os comandos Compose também funcionam no PowerShell. Para melhor compatibilidade de permissões e volumes, prefira os clones no sistema de arquivos Linux do WSL.

Primeiro, no diretório `rkd-container-core`, prepare a chave e inicie o backend:

```bash
bash configure-secret-key.sh --generate-only
docker compose -f docker-compose.local.yml up -d --build --wait
docker compose -f docker-compose.local.yml exec backend python manage.py createsuperuser --username RKD
```

A geração da chave não depende de um backend existente: ela salva o valor no `.env` antes da criação do container. O Compose fornece a variável ao backend. O comando `bash configure-secret-key.sh --local` também pode gerar/preservar a chave e iniciar o backend em um único passo. Crie o usuário somente na primeira instalação.

Depois, neste diretório do frontend:

```bash
docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml logs -f nginx
```

Abra **http://localhost:8080/**. O Compose local inicia frontend e Nginx, conectados à rede `rkd-local-network` criada pelo backend. Nginx usa `volumes/nginx/local.conf` e encaminha as chamadas `/api/` ao backend. A porta 8080 fica vinculada apenas à interface local da máquina. Não é necessário configurar `ACME_EMAIL`, certificado, DNS ou um `.env` do frontend para esse modo.

O backend local roda em desenvolvimento, com Turnstile desativado e cookies compatíveis com HTTP. Isso permite testar login, cadastros, branches e criação de containers no Docker local; o CAPTCHA e HTTPS de produção continuam no Compose da VPS. O banco local persiste em `rkd-container-core/volumes/sqlite/container_core.local.sqlite3`, com usuários próprios.

Use sempre `-f docker-compose.local.yml` para subir, consultar ou parar esse ambiente. O Compose sem `-f` continua sendo a implantação para `sinan-pro.com` na VPS. Para parar os containers locais do frontend, execute `docker compose -f docker-compose.local.yml stop`; para parar o backend, execute o mesmo comando no diretório dele.

## Deploy on the Ubuntu VPS with Docker Compose

Este repositório tem um `docker-compose.yml` separado. Ele inicia três containers: frontend Angular estático, Nginx (porta de entrada HTTP/HTTPS) e Certbot (emissão e renovação do certificado). Os três entram na rede `rkd-network` criada pelo Compose do backend. O Nginx envia `/api/`, `/admin/` e `/static/` ao backend e as demais rotas ao frontend.

### Pré-requisitos na VPS

1. Ubuntu com SSH, Git, Docker Engine e plugin Docker Compose funcionando. Consulte a [instalação oficial do Docker no Ubuntu](https://docs.docker.com/engine/install/ubuntu/) e do [Compose](https://docs.docker.com/compose/install/linux/). Verifique com `sudo docker version` e `sudo docker compose version`. Node.js, npm, Nginx e Certbot **não precisam** ser instalados diretamente na VPS: eles são usados nos containers.
2. Clone de `rkd-container-core` e `rkd-container-web` na VPS. Configure acesso Git antes do clone se algum repositório da aplicação for privado. Inicie [o backend primeiro](https://github.com/madrijkaard/rkd-container-core#deploy-on-the-ubuntu-vps-with-docker-compose), incluindo seu `.env` com `DJANGO_SECRET_KEY`, `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`. Confirme que `sudo docker network inspect rkd-network` funciona.
3. DNS A de **`sinan-pro.com`** apontando para o IPv4 público da VPS; se existir AAAA, use apenas um IPv6 que chegue à mesma VPS. TCP 80 e 443 liberados no firewall e no painel da Hostinger, sem outro serviço usando essas portas. A VPS precisa de saída para os servidores do Let's Encrypt. O Certbot usa a porta 80 para validar o domínio; enquanto o certificado não estiver pronto, o Nginx ainda não servirá o login por HTTPS.
4. [Widget Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/) com hostname `sinan-pro.com` já criado. Configure as duas chaves no `.env` do backend; este frontend recebe a Site key pública pela API. A Secret key permanece apenas no backend e nunca deve ser colocada neste repositório ou neste Compose. Não é necessário migrar o DNS para a Cloudflare para usar o widget.
5. Um endereço de email válido que você controla para o registro e os avisos do certificado Let's Encrypt (`ACME_EMAIL`).

### Instalação inicial do frontend

Depois que o backend estiver no ar, execute no diretório `rkd-container-web` da VPS:

```bash
cp .env.example .env
nano .env
chmod 600 .env
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs -f certbot nginx
```

Preencha o arquivo `.env` com o email, por exemplo `ACME_EMAIL=voce@seu-dominio.com`. Esse é o único valor necessário neste `.env`; a Site key e a Secret key do Turnstile já foram configuradas no backend. Saia do acompanhamento de logs com `Ctrl+C` sem parar os containers.

Quando o Certbot gravar o certificado em `volumes/nginx/letsencrypt/`, o Nginx habilita HTTPS automaticamente. Os arquivos temporários de validação ficam em `volumes/nginx/acme/`; ambos os diretórios são persistidos na VPS e ignorados pelo Git. Não os apague em atualizações. Verifique:

```bash
curl -I https://sinan-pro.com/
sudo docker compose ps
sudo docker compose logs --tail=100 certbot nginx
```

Abra **`https://sinan-pro.com/`** no navegador. O login deve mostrar o Turnstile; entre com uma conta `staff` criada no banco do backend (`sudo docker compose exec backend python manage.py createsuperuser`, executado **no diretório do backend**). O banco da VPS começa vazio; os usuários cadastrados apenas na máquina de desenvolvimento não aparecem automaticamente.

Se o certificado não for emitido, confira o DNS, a liberação da porta 80 e os logs do Certbot. Se o login indicar falha no CAPTCHA, confirme o hostname do widget e as duas chaves no `.env` do backend; depois recrie o container do backend com `sudo docker compose up -d --force-recreate` no diretório dele. Em produção, o login exige as duas chaves.

Ao atualizar este frontend, execute `git pull` e `sudo docker compose up -d --build` neste diretório. A configuração atual atende apenas `sinan-pro.com`; para usar `www.sinan-pro.com`, acrescente esse hostname ao certificado, ao Nginx, ao backend e ao widget Turnstile.

## Verify

```bash
npm test -- --watch=false
npm run build
```
