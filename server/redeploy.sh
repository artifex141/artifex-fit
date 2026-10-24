#!/bin/sh
# Пересобрать и пересоздать контейнер. Нужен после правки .env: docker restart .env не перечитывает.
set -e
cd "$(dirname "$0")"
docker build -q -t artifex-fit-push . >/dev/null
docker rm -f artifex-fit-push >/dev/null 2>&1 || true
docker run -d --name artifex-fit-push --restart unless-stopped --env-file .env -p 127.0.0.1:8097:8097 -v artifex-fit-push-data:/data artifex-fit-push >/dev/null
echo "artifex-fit-push перезапущен"
