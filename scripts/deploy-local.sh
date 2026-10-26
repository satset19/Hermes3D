#!/usr/bin/env bash
# deploy-local.sh — Build Hermes3D and restart local systemd services

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
HERMES3D_DIR="$(cd -- "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()  { echo -e "${RED}[deploy]${NC} $*"; }
info() { echo -e "${BLUE}[deploy]${NC} $*"; }

log "Starting local deployment of Hermes3D in $HERMES3D_DIR..."

cd "$HERMES3D_DIR"

# 1. Environment check
if [ ! -f .env ]; then
  err ".env file missing!"
  exit 1
fi
if [ ! -f .env.hermes ]; then
  warn ".env.hermes file missing — adapter may use default settings."
fi

# 2. Build Next.js app
export PATH=/usr/bin:/bin
export NEXT_TELEMETRY_DISABLED=1

log "Installing dependencies (if needed)..."
/usr/bin/npm install --no-audit --no-fund

log "Building Hermes3D Next.js production build..."
/usr/bin/npm run build

# 3. Restart systemd services
log "Reloading systemd daemon..."
systemctl --user daemon-reload

log "Restarting hermes3d-adapter.service and hermes3d.service..."
systemctl --user restart hermes3d-adapter.service || true
systemctl --user restart hermes3d.service || true

# 4. Health wait
log "Waiting for services to become healthy..."
sleep 3

for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:18789/ >/dev/null 2>&1 && curl -s http://127.0.0.1:8113/ >/dev/null 2>&1; then
    log "Both services responding!"
    break
  fi
  sleep 1
done

# 5. Run verification smoke test
if [ -f "$SCRIPT_DIR/verify-hermes3d.sh" ]; then
  log "Running verification smoke test..."
  bash "$SCRIPT_DIR/verify-hermes3d.sh"
fi

log "Local deployment completed successfully!"
