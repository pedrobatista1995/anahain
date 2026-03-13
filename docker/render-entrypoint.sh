#!/bin/sh
set -eu

PORT="${PORT:-10000}"
DATA_DIR="${MEDICAL_DATA_DIR:-/var/data}"

mkdir -p "$DATA_DIR"
chown -R www-data:www-data "$DATA_DIR" 2>/dev/null || true
chmod 775 "$DATA_DIR" 2>/dev/null || true

sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \\*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

exec docker-php-entrypoint "$@"
