#!/usr/bin/env bash
# ==========================================================================
# Knowunity Content OS — team server installer for an Oracle Cloud VM
# Works on Ubuntu and Oracle Linux, x86_64 and ARM (Ampere A1).
#
# On the VM, as root:
#   git clone https://github.com/eiw7immanuel-creator/knowunity-system.git
#   sudo bash knowunity-system/server/install.sh
#
# What it does (safe to run again; keeps your key and data):
#   1. Installs Node.js (if missing) and copies server.js to /opt/knowunity
#   2. Creates a team key in /etc/knowunity/env and a systemd service
#   3. Installs Caddy and gets a free HTTPS certificate for <your-ip>.sslip.io
#      (set DOMAIN=board.example.com to use your own domain instead)
#   4. Opens ports 80/443 in the VM firewall
#   5. Prints the API URL and the team key to paste into the app
#
# Optional: DOMAIN=... PORT=... sudo -E bash install.sh
# ==========================================================================
set -euo pipefail

PORT="${PORT:-8787}"
DOMAIN="${DOMAIN:-}"
NODE_VERSION="${NODE_VERSION:-22.12.0}"
APP_DIR=/opt/knowunity
DATA_DIR=/var/lib/knowunity
ENV_FILE=/etc/knowunity/env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/eiw7immanuel-creator/knowunity-system/claude/unity-social-posting-system-mmzywo/server}"

say() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "Run this as root: sudo bash install.sh"
command -v curl >/dev/null || die "curl is required (apt install curl / dnf install curl)"

case "$(uname -m)" in
  x86_64)  NODE_ARCH=x64;   CADDY_ARCH=amd64 ;;
  aarch64) NODE_ARCH=arm64; CADDY_ARCH=arm64 ;;
  *) die "Unsupported CPU: $(uname -m)" ;;
esac

# ---- 1. Node.js ----------------------------------------------------------
NODE_BIN=""
if command -v node >/dev/null && [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -ge 18 ]; then
  NODE_BIN="$(command -v node)"
  say "Node.js already installed: $(node -v)"
else
  say "Installing Node.js $NODE_VERSION"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.gz" -o /tmp/node.tgz
  rm -rf /opt/node && mkdir -p /opt/node
  tar -xzf /tmp/node.tgz -C /opt/node --strip-components=1
  ln -sf /opt/node/bin/node /usr/local/bin/node
  NODE_BIN=/usr/local/bin/node
  rm -f /tmp/node.tgz
fi

# ---- 2. App, user, data, key, service ------------------------------------
say "Installing the team server to $APP_DIR"
id -u knowunity >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin knowunity 2>/dev/null || useradd --system --home "$DATA_DIR" --shell /sbin/nologin knowunity
mkdir -p "$APP_DIR" "$DATA_DIR" "$(dirname "$ENV_FILE")"
if [ -f "$SCRIPT_DIR/server.js" ]; then
  cp "$SCRIPT_DIR/server.js" "$APP_DIR/server.js"
else
  curl -fsSL "$REPO_RAW/server.js" -o "$APP_DIR/server.js"
fi
chown -R knowunity:knowunity "$DATA_DIR"

if [ -f "$ENV_FILE" ] && grep -q '^KU_KEY=' "$ENV_FILE"; then
  KEY="$(sed -n 's/^KU_KEY=//p' "$ENV_FILE" | head -1)"
  say "Keeping the existing team key"
else
  KEY="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  say "Generated a new team key"
fi
cat > "$ENV_FILE" <<EOF
KU_KEY=$KEY
KU_PORT=$PORT
KU_HOST=127.0.0.1
KU_DATA=$DATA_DIR/items.json
EOF
chown root:knowunity "$ENV_FILE"; chmod 640 "$ENV_FILE"

cat > /etc/systemd/system/knowunity-api.service <<EOF
[Unit]
Description=Knowunity Content OS team server
After=network.target

[Service]
User=knowunity
Group=knowunity
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

# ---- 3. Caddy for HTTPS ---------------------------------------------------
if [ -z "$DOMAIN" ]; then
  IP="$(curl -fsS --max-time 8 https://api.ipify.org || true)"
  [ -n "$IP" ] || IP="$(curl -fsS --max-time 5 -H 'Authorization: Bearer Oracle' http://169.254.169.254/opc/v2/vnics/ 2>/dev/null | sed -n 's/.*"publicIp" *: *"\([0-9.]*\)".*/\1/p' | head -1 || true)"
  [ -n "$IP" ] || die "Could not find the public IP. Run again with DOMAIN=<your-ip>.sslip.io"
  DOMAIN="$(echo "$IP" | tr . -).sslip.io"
fi
say "HTTPS address will be https://$DOMAIN"

if ! command -v caddy >/dev/null; then
  say "Installing Caddy"
  curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=${CADDY_ARCH}" -o /usr/local/bin/caddy
  chmod +x /usr/local/bin/caddy
fi
CADDY_BIN="$(command -v caddy)"
id -u caddy >/dev/null 2>&1 || useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy 2>/dev/null || useradd --system --home /var/lib/caddy --shell /sbin/nologin caddy
mkdir -p /etc/caddy /var/lib/caddy
chown -R caddy:caddy /var/lib/caddy
command -v setcap >/dev/null && setcap 'cap_net_bind_service=+ep' "$CADDY_BIN" || true

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$PORT {
		flush_interval -1
	}
}
EOF

cat > /etc/systemd/system/caddy.service <<EOF
[Unit]
Description=Caddy (HTTPS for the Knowunity team server)
After=network.target

[Service]
User=caddy
Group=caddy
Environment=XDG_DATA_HOME=/var/lib/caddy
Environment=XDG_CONFIG_HOME=/etc/caddy
ExecStart=$CADDY_BIN run --config /etc/caddy/Caddyfile
ExecReload=$CADDY_BIN reload --config /etc/caddy/Caddyfile
Restart=on-failure
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF

# ---- 4. Firewall on the VM ------------------------------------------------
say "Opening ports 80 and 443 on the VM"
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http --add-service=https >/dev/null
  firewall-cmd --reload >/dev/null
elif command -v iptables >/dev/null; then
  for p in 80 443; do
    iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$p" -j ACCEPT
  done
  if command -v netfilter-persistent >/dev/null; then netfilter-persistent save >/dev/null 2>&1 || true
  elif [ -d /etc/iptables ]; then iptables-save > /etc/iptables/rules.v4 || true
  fi
fi

# ---- 5. Start everything --------------------------------------------------
say "Starting services"
systemctl daemon-reload
systemctl enable --now knowunity-api.service >/dev/null
systemctl restart knowunity-api.service
systemctl enable --now caddy.service >/dev/null
systemctl restart caddy.service
sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null; then
  say "Team server is running"
else
  journalctl -u knowunity-api -n 20 --no-pager || true
  die "The server did not start. See the log above."
fi

cat <<EOF

==========================================================================
✅ Done. Paste these two values into the app (Settings → Data → Connect):

   API URL:   https://$DOMAIN
   Team key:  $KEY

One thing only the Oracle Cloud console can do (once):
   Networking → Virtual Cloud Networks → your VCN → Security Lists →
   Default Security List → Add Ingress Rules:
   Source 0.0.0.0/0, IP Protocol TCP, Destination Port Range 80,443

Check from your laptop (the certificate can take about a minute):
   curl https://$DOMAIN/api/health        → {"ok":true}

Useful later:
   sudo systemctl status knowunity-api caddy
   sudo journalctl -u knowunity-api -f
   Data: $DATA_DIR/items.json  (daily copies in $DATA_DIR/backups)
   Update: git pull, then run this installer again.
==========================================================================
EOF
