<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();

function media_proxy_fail(int $status, string $message): void {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

function media_proxy_allowed_host(string $host): bool {
    $host = strtolower(trim($host));
    if ($host === '') {
        return false;
    }

    return (bool) preg_match('/(^|\.)cdninstagram\.com$/', $host)
        || (bool) preg_match('/(^|\.)fbcdn\.net$/', $host);
}

function media_proxy_cache_read(string $metaPath): ?array {
    if (!is_file($metaPath)) {
        return null;
    }

    $raw = file_get_contents($metaPath);
    if ($raw === false || trim($raw) === '') {
        return null;
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function media_proxy_cache_fresh(array $meta, int $ttlSeconds): bool {
    $fetchedAt = strtotime((string)($meta['fetched_at'] ?? ''));
    if ($fetchedAt === false) {
        return false;
    }

    return (time() - $fetchedAt) < $ttlSeconds;
}

function media_proxy_write_cache(string $bodyPath, string $metaPath, string $body, string $contentType): void {
    $dir = dirname($bodyPath);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    file_put_contents($bodyPath, $body);
    file_put_contents($metaPath, json_encode([
        'content_type' => $contentType,
        'content_length' => strlen($body),
        'fetched_at' => date('c'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function media_proxy_output_file(string $bodyPath, array $meta): void {
    if (!is_file($bodyPath)) {
        media_proxy_fail(404, 'Arquivo nao encontrado');
    }

    $contentType = trim((string)($meta['content_type'] ?? ''));
    if ($contentType === '') {
        $contentType = 'application/octet-stream';
    }

    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . (string)filesize($bodyPath));
    header('Cache-Control: public, max-age=3600');
    readfile($bodyPath);
    exit;
}

function media_proxy_fetch_remote(string $url): ?array {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => [
                'Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language: pt-BR,pt;q=0.9,en;q=0.8',
                'Referer: https://www.instagram.com/',
            ],
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        ]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $contentType = trim((string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE));
        curl_close($ch);

        if (is_string($body) && $body !== '' && $status >= 200 && $status < 400 && str_starts_with($contentType, 'image/')) {
            return [
                'body' => $body,
                'content_type' => $contentType,
            ];
        }
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 20,
            'header' => "User-Agent: Mozilla/5.0\r\nAccept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8\r\nReferer: https://www.instagram.com/\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    if ($body === false || $body === '') {
        return null;
    }

    $contentType = 'application/octet-stream';
    if (!empty($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $line) {
            if (stripos($line, 'Content-Type:') === 0) {
                $contentType = trim(substr($line, 13));
                break;
            }
        }
    }

    if (!str_starts_with($contentType, 'image/')) {
        return null;
    }

    return [
        'body' => $body,
        'content_type' => $contentType,
    ];
}

$sourceUrl = trim((string)($_GET['url'] ?? ''));
if ($sourceUrl === '') {
    media_proxy_fail(400, 'URL nao informada');
}

$parts = parse_url($sourceUrl);
$scheme = strtolower((string)($parts['scheme'] ?? ''));
$host = strtolower((string)($parts['host'] ?? ''));
if ($scheme !== 'https' || !media_proxy_allowed_host($host)) {
    media_proxy_fail(400, 'Fonte nao permitida');
}

$cacheKey = md5($sourceUrl);
$cacheDir = app_data_path('social-media');
$bodyPath = $cacheDir . DIRECTORY_SEPARATOR . $cacheKey . '.bin';
$metaPath = $cacheDir . DIRECTORY_SEPARATOR . $cacheKey . '.json';
$cacheTtl = 21600;

$cachedMeta = media_proxy_cache_read($metaPath);
if (is_array($cachedMeta) && is_file($bodyPath) && media_proxy_cache_fresh($cachedMeta, $cacheTtl)) {
    media_proxy_output_file($bodyPath, $cachedMeta);
}

$fetched = media_proxy_fetch_remote($sourceUrl);
if (is_array($fetched)) {
    media_proxy_write_cache($bodyPath, $metaPath, (string)$fetched['body'], (string)$fetched['content_type']);
    media_proxy_output_file($bodyPath, [
        'content_type' => (string)$fetched['content_type'],
    ]);
}

if (is_array($cachedMeta) && is_file($bodyPath)) {
    media_proxy_output_file($bodyPath, $cachedMeta);
}

media_proxy_fail(502, 'Nao foi possivel carregar a imagem agora');
