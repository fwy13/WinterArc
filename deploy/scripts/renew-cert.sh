#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
docker compose run --rm certbot renew --webroot -w /var/www/certbot --quiet
docker compose -f compose.yml -f compose.https.yml exec -T nginx nginx -t
docker compose -f compose.yml -f compose.https.yml exec -T nginx nginx -s reload
