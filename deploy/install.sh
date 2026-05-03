#!/usr/bin/env bash
#
# HR.AI installer for Ubuntu 22.04 / 24.04.
#
# What it does (idempotent — safe to re-run):
#   1.  apt update + base packages (curl, git, nginx, ufw, jq)
#   2.  Docker Engine + compose plugin
#   3.  Node.js 20 (host-side, used to seed Redis)
#   4.  Adds 4 GB swap if RAM < 6 GB (helps `next build`)
#   5.  Copies .env.example → .env on first run, then exits so you can edit
#   6.  Builds + starts deploy/docker-compose.yml
#   7.  Seeds Redis with master data + 8 demo candidates
#   8.  UFW firewall (SSH + 80 + 443)
#   9.  nginx reverse proxy (SSE-friendly config) for your domain
#   10. Let's Encrypt cert via certbot if you pass an email
#   11. systemd unit so the stack restarts on reboot
#
# Usage:
#   sudo bash deploy/install.sh <domain> [letsencrypt-email]
#
# Examples:
#   sudo bash deploy/install.sh hr-ai.example.com you@example.com
#   sudo bash deploy/install.sh hr-ai.example.com         # nginx, no TLS yet
#   sudo bash deploy/install.sh _                         # skip nginx; expose :3000

set -euo pipefail

DOMAIN="${1:-}"
LE_EMAIL="${2:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash deploy/install.sh <domain> [letsencrypt-email]"
  echo "  pass _ as <domain> to skip nginx and expose port 3000 directly"
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Pick the user who will own files / be added to the docker group
RUN_USER="${SUDO_USER:-$USER}"
if [[ -z "${RUN_USER}" || "${RUN_USER}" == "root" ]]; then
  RUN_USER="$(whoami)"
fi

SUDO=""
if [[ $(id -u) -ne 0 ]]; then SUDO="sudo"; fi

c_blue() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
c_warn() { printf "\033[1;33m! %s\033[0m\n" "$*"; }
c_ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
fail()   { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

[[ -f deploy/docker-compose.yml ]] \
  || fail "must run from the repo root (couldn't find deploy/docker-compose.yml)"

# --- 1. base packages ------------------------------------------------------
c_blue "apt update + base packages"
$SUDO apt-get update -y
$SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl gnupg git nginx ufw jq

# --- 2. Docker -------------------------------------------------------------
if ! command -v docker >/dev/null; then
  c_blue "Installing Docker"
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io \
                           docker-buildx-plugin docker-compose-plugin
  $SUDO usermod -aG docker "$RUN_USER" || true
  c_warn "Added $RUN_USER to docker group — re-login or run 'newgrp docker' for non-sudo docker"
else
  c_ok "Docker already installed: $(docker --version)"
fi

# --- 3. Node.js 20 (host-side, for seeding) -------------------------------
if ! command -v node >/dev/null || [[ "$(node --version | cut -dv -f2 | cut -d. -f1)" -lt 18 ]]; then
  c_blue "Installing Node.js 20 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
else
  c_ok "Node already installed: $(node --version)"
fi

# --- 4. Swap (helps next build on small VMs) ------------------------------
TOTAL_MB=$(free -m | awk '/^Mem:/ {print $2}')
if [[ ! -f /swapfile ]] && [[ "$TOTAL_MB" -lt 6000 ]]; then
  c_blue "Adding 4 GB swap (RAM=${TOTAL_MB}MB; next build needs more headroom)"
  $SUDO fallocate -l 4G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile
  $SUDO swapon /swapfile
  echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

# --- 5. .env ---------------------------------------------------------------
if [[ ! -f .env ]]; then
  c_blue "Creating .env from template"
  cp .env.example .env
  $SUDO chown "$RUN_USER":"$RUN_USER" .env
  c_warn "Edit .env now, then re-run this script. Required keys:"
  c_warn "  AZURE_OPENAI_CHAT_*, AZURE_OPENAI_REALTIME_*, AZURE_COMM_*,"
  c_warn "  AUTH_SESSION_SECRET (use: openssl rand -hex 32),"
  c_warn "  COMPANY_NAME, COMPANY_OFFICE_CITY, COMPANY_OFFICE_ADDRESS"
  c_warn ""
  c_warn "  nano $REPO_DIR/.env"
  c_warn "  sudo bash deploy/install.sh $DOMAIN ${LE_EMAIL:-}"
  exit 0
fi

# Next.js loads env from each package directory — keep them in sync
cp .env packages/portal/.env
cp .env packages/orchestrator/.env

# --- 6. docker compose up --------------------------------------------------
c_blue "Building + starting containers (first build takes 5–10 min)"
$SUDO docker compose -f deploy/docker-compose.yml up -d --build

c_blue "Waiting for orchestrator on :3001"
for i in {1..90}; do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    c_ok "orchestrator OK"; break
  fi
  sleep 2
  [[ $i -eq 90 ]] && c_warn "orchestrator did not become healthy in 180s — continuing"
done

c_blue "Waiting for portal on :3000"
for i in {1..90}; do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/login; then
    c_ok "portal OK"; break
  fi
  sleep 2
  [[ $i -eq 90 ]] && c_warn "portal did not become healthy in 180s — continuing"
done

# --- 7. Seed Redis ---------------------------------------------------------
c_blue "Installing repo deps (needed for seed script)"
if [[ ! -d node_modules ]]; then
  $SUDO -u "$RUN_USER" npm install --no-audit --no-fund
fi

c_blue "Seeding Redis with master data + 8 demo candidates"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}" $SUDO -u "$RUN_USER" \
  npx tsx scripts/seed.ts \
  || c_warn "seed step failed — re-run later with: REDIS_URL=redis://localhost:6379 npx tsx scripts/seed.ts"

# --- 8. UFW ----------------------------------------------------------------
c_blue "Configuring UFW (allow SSH + http + https; app ports stay localhost-only)"
$SUDO ufw allow OpenSSH >/dev/null
$SUDO ufw allow http    >/dev/null
$SUDO ufw allow https   >/dev/null
$SUDO ufw --force enable

# --- 9. nginx --------------------------------------------------------------
if [[ "$DOMAIN" == "_" ]]; then
  c_warn "Skipping nginx (domain='_'). Portal exposed on :3000."
  c_warn "WebRTC voice will NOT work without HTTPS in modern browsers."
else
  c_blue "Configuring nginx reverse proxy for $DOMAIN"
  $SUDO tee /etc/nginx/sites-available/hr-ai >/dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    # SSE — long timeouts, no buffering
    proxy_read_timeout 1d;
    proxy_send_timeout 1d;
    proxy_buffering off;
    client_max_body_size 25m;

    location /api/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
  $SUDO ln -sf /etc/nginx/sites-available/hr-ai /etc/nginx/sites-enabled/hr-ai
  $SUDO rm -f /etc/nginx/sites-enabled/default
  $SUDO nginx -t
  $SUDO systemctl reload nginx
  c_ok "nginx reloaded"
fi

# --- 10. Let's Encrypt -----------------------------------------------------
if [[ "$DOMAIN" != "_" ]] && [[ -n "$LE_EMAIL" ]]; then
  c_blue "Installing certbot + requesting cert for $DOMAIN"
  $SUDO apt-get install -y certbot python3-certbot-nginx
  $SUDO certbot --nginx -d "$DOMAIN" \
        --non-interactive --agree-tos -m "$LE_EMAIL" --redirect
elif [[ "$DOMAIN" != "_" ]]; then
  c_warn "No LE email passed — skipping TLS. Voice mode will NOT work over plain HTTP."
  c_warn "Add a cert later:  sudo apt-get install -y certbot python3-certbot-nginx"
  c_warn "                   sudo certbot --nginx -d $DOMAIN"
fi

# --- 11. systemd -----------------------------------------------------------
c_blue "Installing systemd unit (hr-ai.service)"
$SUDO tee /etc/systemd/system/hr-ai.service >/dev/null <<UNIT
[Unit]
Description=HR.AI docker compose stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/docker compose -f deploy/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f deploy/docker-compose.yml down

[Install]
WantedBy=multi-user.target
UNIT
$SUDO systemctl daemon-reload
$SUDO systemctl enable hr-ai.service >/dev/null
c_ok "systemd unit installed + enabled"

# --- summary ---------------------------------------------------------------
echo
c_ok "DONE."
echo
if [[ "$DOMAIN" == "_" ]]; then
  PUBLIC_IP=$(curl -fsS ifconfig.me || echo "<vm-public-ip>")
  echo "  Portal:        http://${PUBLIC_IP}:3000"
else
  PROTO="http"
  [[ -n "$LE_EMAIL" ]] && PROTO="https"
  echo "  Portal:        ${PROTO}://${DOMAIN}"
fi
echo "  Login:         hr / acme2026   (override in .env AUTH_USERS)"
echo
echo "  Logs:          sudo docker compose -f deploy/docker-compose.yml logs -f"
echo "  Reseed Redis:  REDIS_URL=redis://localhost:6379 npx tsx scripts/seed.ts"
echo "  Restart:       sudo systemctl restart hr-ai"
echo "  Stop:          sudo systemctl stop hr-ai"
echo "  Update:        git pull && sudo bash deploy/install.sh $DOMAIN ${LE_EMAIL:-}"
