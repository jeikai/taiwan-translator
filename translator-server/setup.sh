#!/usr/bin/env bash
# One-shot installer for an Oracle Cloud "Always Free" Ubuntu VM (Ampere A1, ARM64).
# Usage (on the VM):  DOMAIN=xxx.duckdns.org DUCKDNS_TOKEN=yyy bash setup.sh
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. my-translator.duckdns.org}"
: "${DUCKDNS_TOKEN:?Set DUCKDNS_TOKEN from duckdns.org}"
SUB="${DOMAIN%%.duckdns.org}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Opening ports 80 and 443 in the VM firewall (Oracle images block them by default)"
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p tcp --dport "$p" -j ACCEPT
done
sudo apt-get install -y iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save || true

echo "==> Pointing $DOMAIN at this VM and keeping it updated every 5 minutes"
curl -fsS "https://www.duckdns.org/update?domains=${SUB}&token=${DUCKDNS_TOKEN}&ip=" && echo
( crontab -l 2>/dev/null | grep -v duckdns.org; echo "*/5 * * * * curl -fsS 'https://www.duckdns.org/update?domains=${SUB}&token=${DUCKDNS_TOKEN}&ip=' >/dev/null" ) | crontab -

echo "==> Writing .env"
cd "$DIR"
if [ ! -f .env ]; then
  KEY="$(openssl rand -hex 32)"
  sed -e "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" -e "s|^API_KEY=.*|API_KEY=${KEY}|" .env.example > .env
fi

echo "==> Building and starting (the first build downloads the model, about 10-20 minutes)"
sudo docker compose up -d --build

echo "==> Waiting for https://${DOMAIN}/health"
for i in $(seq 1 60); do
  if curl -fsS "https://${DOMAIN}/health" >/dev/null 2>&1; then
    echo "Server is up."
    echo
    echo "Put these in Vercel > Project > Settings > Environment Variables:"
    echo "  TRANSLATE_API_URL=https://${DOMAIN}"
    echo "  TRANSLATE_API_KEY=$(grep ^API_KEY= .env | cut -d= -f2)"
    echo
    echo "Benchmark: sudo docker compose exec translator python bench.py https://${DOMAIN} \$API_KEY"
    exit 0
  fi
  sleep 10
done
echo "Server did not answer yet. Check: sudo docker compose logs --tail=50" >&2
exit 1
