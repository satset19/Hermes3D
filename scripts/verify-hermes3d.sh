#!/usr/bin/env bash
# verify-hermes3d.sh — Run smoke tests for Hermes3D & adapter end-to-end integration

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
HERMES3D_DIR="$(cd -- "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

STUDIO_ACCESS_TOKEN=""
if [ -f "$HERMES3D_DIR/.env" ]; then
  STUDIO_ACCESS_TOKEN=$(grep -E '^STUDIO_ACCESS_TOKEN=' "$HERMES3D_DIR/.env" | cut -d '=' -f2- | tr -d '"'\'' ' | tr -d '\r')
fi

DOMAIN="kerja.besoksenin.web.id"
FAILED=0

echo "=== Hermes3D Smoke Test Verification ==="

# 1. UI local, no cookie (expect 401)
RES_1=$(curl -s -L -o /dev/null -w "%{http_code}" http://127.0.0.1:8113/ 2>/dev/null || echo "ERR")
echo "ui local, no cookie ($RES_1)"
if [ "$RES_1" != "401" ]; then FAILED=1; fi

# 2. UI local, cookie (expect 200)
RES_2=$(curl -s -L -o /dev/null -w "%{http_code}" -H "Cookie: studio_access=${STUDIO_ACCESS_TOKEN}" http://127.0.0.1:8113/ 2>/dev/null || echo "ERR")
echo "ui local, cookie ($RES_2)"
if [ "$RES_2" != "200" ]; then FAILED=1; fi

# 3. Adapter http (expect 200)
RES_3=$(curl -s -L -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/ 2>/dev/null || echo "ERR")
echo "adapter http ($RES_3)"
if [ "$RES_3" != "200" ]; then FAILED=1; fi

# 4. Adapter ws direct (expect OK)
RES_4=$(node "$SCRIPT_DIR/ws-probe.js" "ws://127.0.0.1:18789" 2>&1 | tail -n 1)
echo "adapter ws direct ($RES_4)"
if [ "$RES_4" != "OK" ]; then FAILED=1; fi

# 5. WS via local proxy (expect OK)
RES_5=$(node "$SCRIPT_DIR/ws-probe.js" "ws://127.0.0.1:8113/api/gateway/ws" "studio_access=${STUDIO_ACCESS_TOKEN}" 2>&1 | tail -n 1)
echo "ws via local proxy ($RES_5)"
if [ "$RES_5" != "OK" ]; then FAILED=1; fi

# 6. Domain, no cookie (expect 401)
RES_6=$(curl -k -s -L -o /dev/null -w "%{http_code}" "https://${DOMAIN}/" 2>/dev/null || echo "ERR")
echo "domain, no cookie ($RES_6)"
if [ "$RES_6" != "401" ]; then FAILED=1; fi

# 7. Domain, cookie (expect 200)
RES_7=$(curl -k -s -L -o /dev/null -w "%{http_code}" -H "Cookie: studio_access=${STUDIO_ACCESS_TOKEN}" "https://${DOMAIN}/" 2>/dev/null || echo "ERR")
echo "domain, cookie ($RES_7)"
if [ "$RES_7" != "200" ]; then FAILED=1; fi

# 8. WS via domain (expect OK)
RES_8=$(node "$SCRIPT_DIR/ws-probe.js" "wss://${DOMAIN}/api/gateway/ws" "studio_access=${STUDIO_ACCESS_TOKEN}" 2>&1 | tail -n 1)
echo "ws via domain ($RES_8)"
if [ "$RES_8" != "OK" ]; then FAILED=1; fi

echo "=========================================="
if [ "$FAILED" -eq 0 ]; then
  echo "All 8 verification checks PASSED!"
  exit 0
else
  echo "Some verification checks FAILED!"
  exit 1
fi
