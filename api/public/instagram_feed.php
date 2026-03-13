<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();

function instagram_cache_read(string $path): ?array {
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

function instagram_cache_write(string $path, array $payload): void {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    file_put_contents(
        $path,
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
    );
}

function instagram_cache_fresh(array $payload, int $ttlSeconds): bool {
    $fetchedAt = strtotime((string)($payload['fetched_at'] ?? ''));
    if ($fetchedAt === false) {
        return false;
    }

    return (time() - $fetchedAt) < $ttlSeconds;
}

function instagram_fetch_json(string $username): ?array {
    $url = 'https://www.instagram.com/api/v1/users/web_profile_info/?username=' . rawurlencode($username);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => [
                'Accept: */*',
                'Accept-Language: pt-BR,pt;q=0.9,en;q=0.8',
                'Referer: https://www.instagram.com/' . $username . '/',
                'X-IG-App-ID: 936619743392459',
                'X-Requested-With: XMLHttpRequest',
            ],
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if (is_string($body) && $body !== '' && $status >= 200 && $status < 400) {
            $data = json_decode($body, true);
            return is_array($data) ? $data : null;
        }
    }

    return null;
}

function instagram_clean_caption(string $text): string {
    $normalized = preg_replace('/\s+/u', ' ', trim($text)) ?? trim($text);
    return $normalized;
}

function instagram_parse_payload(array $payload, string $username): ?array {
    $user = $payload['data']['user'] ?? null;
    if (!is_array($user)) {
        return null;
    }

    $posts = [];
    $edges = $user['edge_owner_to_timeline_media']['edges'] ?? [];
    if (is_array($edges)) {
        foreach ($edges as $edge) {
            $node = is_array($edge) ? ($edge['node'] ?? null) : null;
            if (!is_array($node)) {
                continue;
            }

            $caption = '';
            $captionEdges = $node['edge_media_to_caption']['edges'] ?? [];
            if (is_array($captionEdges) && isset($captionEdges[0]['node']['text'])) {
                $caption = instagram_clean_caption((string)$captionEdges[0]['node']['text']);
            }

            $imageUrl = (string)($node['display_url'] ?? $node['thumbnail_src'] ?? '');
            if ($imageUrl === '' && !empty($node['thumbnail_resources']) && is_array($node['thumbnail_resources'])) {
                $lastThumb = end($node['thumbnail_resources']);
                if (is_array($lastThumb)) {
                    $imageUrl = (string)($lastThumb['src'] ?? '');
                }
            }

            $shortcode = (string)($node['shortcode'] ?? '');
            if ($shortcode === '' || $imageUrl === '') {
                continue;
            }

            $posts[] = [
                'shortcode' => $shortcode,
                'permalink' => 'https://www.instagram.com/p/' . $shortcode . '/',
                'image_url' => $imageUrl,
                'caption' => $caption,
                'taken_at' => !empty($node['taken_at_timestamp']) ? date('c', (int)$node['taken_at_timestamp']) : '',
                'like_count' => isset($node['edge_liked_by']['count'])
                    ? (int)$node['edge_liked_by']['count']
                    : (int)($node['like_count'] ?? 0),
                'comment_count' => isset($node['edge_media_to_comment']['count'])
                    ? (int)$node['edge_media_to_comment']['count']
                    : (int)($node['comment_count'] ?? 0),
                'is_video' => !empty($node['is_video']),
                'type' => (string)($node['__typename'] ?? ''),
            ];

            if (count($posts) >= 6) {
                break;
            }
        }
    }

    return [
        'ok' => true,
        'source' => 'instagram',
        'source_url' => 'https://www.instagram.com/' . $username . '/',
        'profile' => [
            'username' => (string)($user['username'] ?? $username),
            'full_name' => (string)($user['full_name'] ?? ''),
            'biography' => (string)($user['biography'] ?? ''),
            'followers' => (int)($user['edge_followed_by']['count'] ?? 0),
            'following' => (int)($user['edge_follow']['count'] ?? 0),
            'posts' => (int)($user['edge_owner_to_timeline_media']['count'] ?? 0),
            'profile_pic_url' => (string)($user['profile_pic_url_hd'] ?? $user['profile_pic_url'] ?? ''),
            'external_url' => (string)($user['external_url'] ?? ''),
            'category_name' => (string)($user['category_name'] ?? ''),
            'is_professional_account' => !empty($user['is_professional_account']),
        ],
        'posts' => $posts,
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
if ($scheme !== 'https' || !in_array($host, ['instagram.com', 'www.instagram.com'], true)) {
    respond_json(['ok' => false, 'message' => 'Fonte nao permitida'], 400);
}

$path = trim((string)($parts['path'] ?? ''), '/');
$segments = $path !== '' ? explode('/', $path) : [];
$username = trim((string)($segments[0] ?? ''));
if (!preg_match('/^[A-Za-z0-9._]{1,30}$/', $username)) {
    respond_json(['ok' => false, 'message' => 'Perfil invalido'], 400);
}

$cachePath = app_data_path('social/instagram-' . strtolower($username) . '.json');
$cacheTtl = 3600;
$cached = instagram_cache_read($cachePath);
if (is_array($cached) && instagram_cache_fresh($cached, $cacheTtl)) {
    $cached['cached'] = true;
    respond_json($cached);
}

$payload = instagram_fetch_json($username);
$parsed = is_array($payload) ? instagram_parse_payload($payload, $username) : null;
if (is_array($parsed)) {
    $parsed['cached'] = false;
    instagram_cache_write($cachePath, $parsed);
    respond_json($parsed);
}

if (is_array($cached)) {
    $cached['cached'] = true;
    $cached['stale'] = true;
    respond_json($cached);
}

respond_json(['ok' => false, 'message' => 'Nao foi possivel carregar o Instagram agora.'], 502);
