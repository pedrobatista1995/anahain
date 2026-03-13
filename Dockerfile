FROM php:8.2-apache

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev python3 python3-pip ca-certificates \
    && python3 -m pip install --no-cache-dir --break-system-packages playwright \
    && python3 -m playwright install --with-deps chromium \
    && docker-php-ext-install pdo_sqlite \
    && printf "ServerName localhost\n" > /etc/apache2/conf-available/servername.conf \
    && a2enconf servername \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY docker/render-entrypoint.sh /usr/local/bin/render-entrypoint
RUN chmod +x /usr/local/bin/render-entrypoint

COPY . /var/www/html

ENTRYPOINT ["render-entrypoint"]
CMD ["apache2-foreground"]
