<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();

function doctoralia_cache_read(string $path): ?array {
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

function doctoralia_cache_write(string $path, array $payload): void {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    file_put_contents(
        $path,
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
    );
}

function doctoralia_cache_fresh(array $payload, int $ttlSeconds): bool {
    $fetchedAt = strtotime((string)($payload['fetched_at'] ?? ''));
    if ($fetchedAt === false) {
        return false;
    }

    return (time() - $fetchedAt) < $ttlSeconds;
}

function doctoralia_fetch_html(string $url): string {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => [
                'Accept-Language: pt-BR,pt;q=0.9,en;q=0.8',
            ],
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
            'timeout' => 20,
            'header' => "User-Agent: Mozilla/5.0\r\nAccept-Language: pt-BR,pt;q=0.9,en;q=0.8\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    return is_string($body) ? $body : '';
}

function doctoralia_clean_text(string $text): string {
    $normalized = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $normalized = preg_replace('/\s+/u', ' ', $normalized) ?? $normalized;
    return trim($normalized);
}

function doctoralia_parse_html(string $html, string $sourceUrl): ?array {
    if (!class_exists('DOMDocument')) {
        return null;
    }

    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $loaded = $dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOWARNING | LIBXML_NOERROR);
    libxml_clear_errors();
    if (!$loaded) {
        return null;
    }

    $xpath = new DOMXPath($dom);
    $canonicalUrl = doctoralia_clean_text((string) $xpath->evaluate('string((//link[@rel="canonical"]/@href)[1])'));
    $title = doctoralia_clean_text((string) $xpath->evaluate('string((//title)[1])'));
    $rating = doctoralia_clean_text((string) $xpath->evaluate(
        'string((//*[@itemprop="aggregateRating"]//*[@itemprop="ratingValue"]/@content | //*[@itemprop="aggregateRating"]//*[@itemprop="ratingValue"]/@value)[1])'
    ));
    $reviewCount = doctoralia_clean_text((string) $xpath->evaluate(
        'string((//*[@itemprop="aggregateRating"]//*[@itemprop="reviewCount"]/@content | //*[@itemprop="aggregateRating"]//*[@itemprop="reviewCount"]/@value)[1])'
    ));

    $reviews = [];
    $reviewNodes = $xpath->query('//*[@itemtype="http://schema.org/Review" or @itemtype="https://schema.org/Review"]');
    if ($reviewNodes instanceof DOMNodeList) {
        foreach ($reviewNodes as $reviewNode) {
            $author = doctoralia_clean_text((string) $xpath->evaluate(
                'string((.//*[@itemprop="author"]//*[@itemprop="name"] | .//*[@itemprop="author"])[1])',
                $reviewNode
            ));
            $body = doctoralia_clean_text((string) $xpath->evaluate(
                'string((.//*[@itemprop="reviewBody"])[1])',
                $reviewNode
            ));
            $datePublished = doctoralia_clean_text((string) $xpath->evaluate(
                'string((.//*[@itemprop="datePublished"]/@datetime | .//*[@itemprop="datePublished"]/@content | .//*[@itemprop="datePublished"])[1])',
                $reviewNode
            ));
            $score = doctoralia_clean_text((string) $xpath->evaluate(
                'string((.//*[@itemprop="reviewRating"]//*[@itemprop="ratingValue"]/@content | .//*[@itemprop="reviewRating"]//*[@itemprop="ratingValue"]/@value | .//*[@itemprop="ratingValue"]/@content | .//*[@itemprop="ratingValue"])[1])',
                $reviewNode
            ));
            $service = doctoralia_clean_text((string) $xpath->evaluate(
                'string((.//*[@itemprop="itemReviewed"]//*[@itemprop="name"]/@content | .//*[@itemprop="itemReviewed"]//*[@itemprop="name"])[1])',
                $reviewNode
            ));

            if ($author === '' || $body === '') {
                continue;
            }

            $reviews[] = [
                'author' => $author,
                'body' => $body,
                'rating' => $score !== '' ? (float) str_replace(',', '.', $score) : null,
                'date_published' => $datePublished,
                'service' => $service,
            ];

            if (count($reviews) >= 6) {
                break;
            }
        }
    }

    if ($canonicalUrl === '') {
        $canonicalUrl = $sourceUrl;
    }

    if ($title === '' && empty($reviews) && $rating === '' && $reviewCount === '') {
        return null;
    }

    return [
        'ok' => true,
        'source' => 'doctoralia',
        'source_label' => 'Doctoralia',
        'source_url' => $sourceUrl,
        'canonical_url' => $canonicalUrl,
        'title' => $title,
        'rating' => $rating !== '' ? (float) str_replace(',', '.', $rating) : null,
        'review_count' => $reviewCount !== '' ? (int) preg_replace('/\D+/', '', $reviewCount) : 0,
        'reviews' => $reviews,
        'fetched_at' => date('c'),
    ];
}

$sourceUrl = trim((string)($_GET['url'] ?? ''));
if ($sourceUrl === '') {
    respond_json(['ok' => false, 'message' => 'URL nao informada'], 400);
}

$parts = parse_url($sourceUrl);
$scheme = strtolower((string)($parts['scheme'] ?? ''));
$host = strtolower((string)($parts['host'] ?? ''));
if ($scheme !== 'https' || !in_array($host, ['doctoralia.com.br', 'www.doctoralia.com.br'], true)) {
    respond_json(['ok' => false, 'message' => 'Fonte nao permitida'], 400);
}

$cachePath = app_data_path('social/doctoralia-' . md5($sourceUrl) . '.json');
$cacheTtl = 21600;
$cached = doctoralia_cache_read($cachePath);
if (is_array($cached) && doctoralia_cache_fresh($cached, $cacheTtl)) {
    $cached['cached'] = true;
    respond_json($cached);
}

$html = doctoralia_fetch_html($sourceUrl);
$parsed = $html !== '' ? doctoralia_parse_html($html, $sourceUrl) : null;
if (is_array($parsed)) {
    $parsed['cached'] = false;
    doctoralia_cache_write($cachePath, $parsed);
    respond_json($parsed);
}

if (is_array($cached)) {
    $cached['cached'] = true;
    $cached['stale'] = true;
    respond_json($cached);
}

respond_json(['ok' => false, 'message' => 'Nao foi possivel carregar as avaliacoes publicas agora.'], 502);
