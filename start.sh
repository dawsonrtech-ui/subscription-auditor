#!/bin/sh
set -e

if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
  node server/index.js &
  sleep 2
  cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
  wait
else
  exec node server/index.js
fi
