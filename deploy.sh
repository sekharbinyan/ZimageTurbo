#!/bin/bash
set -euo pipefail

echo "==> Pulling latest code..."
git pull

echo "==> Rebuilding container (no cache)..."
docker compose down || true
docker compose build --no-cache
docker compose up -d

echo "==> Waiting for service..."
sleep 3

echo "==> Health check:"
curl -s "http://127.0.0.1:8189/health" | python3 -m json.tool || curl -s "http://127.0.0.1:8189/health"

echo ""
echo "Open: http://YOUR_SERVER_IP:8189"
