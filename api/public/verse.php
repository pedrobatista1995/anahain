<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();

$sourceUrl = 'https://www.bible.com/pt/verse-of-the-day?day=70';
$cachePath = dirname(__DIR__, 2) . '/data/verse-cache.json';
$today = date('Y-m-d');

function read_cached_verse(string $path): ?array {
    if (!is_file($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return null;
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function write_cached_verse(string $path, array $payload): void {
    file_put_contents(
        $path,
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
    );
}

function fetch_remote_html(string $url): string {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if (is_string($body) && $body !== '' && $status >= 200 && $status < 400) {
            return $body;
        }
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 12,
            'header' => "User-Agent: Mozilla/5.0\r\nAccept-Language: pt-BR,pt;q=0.9\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    return is_string($body) ? $body : '';
}

function extract_meta_content(string $html, string $attribute, string $value): string {
    $pattern = '/<meta[^>]*' . preg_quote($attribute, '/') . '=["\']' . preg_quote($value, '/') . '["\'][^>]*content=["\']([^"\']+)["\']/i';
    if (preg_match($pattern, $html, $matches)) {
        return html_entity_decode(trim($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    $pattern = '/<meta[^>]*content=["\']([^"\']+)["\'][^>]*' . preg_quote($attribute, '/') . '=["\']' . preg_quote($value, '/') . '["\']/i';
    if (preg_match($pattern, $html, $matches)) {
        return html_entity_decode(trim($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    return '';
}

function extract_title(string $html): string {
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $matches)) {
        return html_entity_decode(trim($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    return '';
}

function parse_verse_meta(string $content): array {
    $normalized = preg_replace('/\s+/', ' ', trim($content)) ?? trim($content);
    if ($normalized !== '' && preg_match('/^(.+?)\s+[—―-]\s+(.+)$/u', $normalized, $matches)) {
        return [
            'reference' => trim($matches[1]),
            'text' => trim($matches[2]),
        ];
    }

    return [
        'reference' => '',
        'text' => $normalized,
    ];
}

$cached = read_cached_verse($cachePath);
if (
    is_array($cached) &&
    ($cached['date'] ?? '') === $today &&
    !empty($cached['text']) &&
    (($cached['source_url'] ?? '') === $sourceUrl)
) {
    respond_json([
        'ok' => true,
        'date' => $cached['date'],
        'reference' => $cached['reference'],
        'text' => $cached['text'],
        'source_url' => $cached['source_url'] ?? $sourceUrl,
        'cached' => true,
    ]);
}

$html = fetch_remote_html($sourceUrl);
$ogDescription = $html !== '' ? extract_meta_content($html, 'property', 'og:description') : '';
$twitterDescription = $html !== '' ? extract_meta_content($html, 'name', 'twitter:description') : '';
$pageTitle = $html !== '' ? extract_title($html) : '';
$verseData = parse_verse_meta($ogDescription !== '' ? $ogDescription : $twitterDescription);

if (!empty($verseData['text'])) {
    $reference = $verseData['reference'];
    if ($reference === '' && $pageTitle !== '' && preg_match('/-\s*(.+)$/u', $pageTitle, $matches)) {
        $reference = trim($matches[1]);
    }
    if ($reference === '') {
        $reference = 'Versículo do Dia';
    }

    $payload = [
        'date' => $today,
        'reference' => $reference,
        'text' => $verseData['text'],
        'source_url' => $sourceUrl,
    ];
    write_cached_verse($cachePath, $payload);

    respond_json([
        'ok' => true,
        'date' => $payload['date'],
        'reference' => $payload['reference'],
        'text' => $payload['text'],
        'source_url' => $payload['source_url'],
        'cached' => false,
    ]);
}

if (is_array($cached) && !empty($cached['text'])) {
    respond_json([
        'ok' => true,
        'date' => $cached['date'] ?? '',
        'reference' => $cached['reference'] ?? '1 Pedro 5:7 (NTLH)',
        'text' => $cached['text'],
        'source_url' => $cached['source_url'] ?? $sourceUrl,
        'cached' => true,
        'stale' => true,
    ]);
}

respond_json([
    'ok' => true,
    'date' => $today,
    'reference' => 'Versículo do Dia',
    'text' => 'Carregando o versículo do dia novamente em instantes.',
    'source_url' => $sourceUrl,
    'cached' => false,
    'fallback' => true,
]);
