<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();

function google_cache_read(string $path): ?array {
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

function google_cache_write(string $path, array $payload): void {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    file_put_contents(
        $path,
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
    );
}

function google_cache_fresh(array $payload, int $ttlSeconds): bool {
    $fetchedAt = strtotime((string)($payload['fetched_at'] ?? ''));
    if ($fetchedAt === false) {
        return false;
    }

    return (time() - $fetchedAt) < $ttlSeconds;
}

function google_run_process(array $command, string $cwd, int $timeoutSeconds): array {
    unset($timeoutSeconds);

    $descriptorSpec = [
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $pipes = [];
    $process = @proc_open($command, $descriptorSpec, $pipes, $cwd);
    if (!is_resource($process)) {
        return [
            'exit_code' => 1,
            'stdout' => '',
            'stderr' => 'Nao foi possivel iniciar o processo do scraper.',
            'timed_out' => false,
        ];
    }

    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);

    fclose($pipes[1]);
    fclose($pipes[2]);

    return [
        'exit_code' => proc_close($process),
        'stdout' => $stdout,
        'stderr' => $stderr,
        'timed_out' => false,
    ];
}

function google_python_candidates(): array {
    $candidates = [];

    $configured = trim((string)(getenv('MEDICAL_PYTHON_BIN') ?: ''));
    if ($configured !== '') {
        $candidates[] = [$configured];
    }

    if (PHP_OS_FAMILY === 'Windows') {
        $localAppData = trim((string)(getenv('LOCALAPPDATA') ?: ''));
        $pythonSearchRoots = [];
        if ($localAppData !== '') {
            $pythonSearchRoots[] = $localAppData . DIRECTORY_SEPARATOR . 'Programs' . DIRECTORY_SEPARATOR . 'Python';
        }
        $pythonSearchRoots[] = 'C:\\Users\\*\\AppData\\Local\\Programs\\Python';

        foreach ($pythonSearchRoots as $rootPattern) {
            $pythonGlobs = glob($rootPattern . DIRECTORY_SEPARATOR . 'Python*' . DIRECTORY_SEPARATOR . 'python.exe');
            if (!is_array($pythonGlobs)) {
                continue;
            }

            rsort($pythonGlobs, SORT_NATURAL);
            foreach ($pythonGlobs as $pythonPath) {
                $candidates[] = [$pythonPath];
            }
        }

        $windowsDir = trim((string)(getenv('WINDIR') ?: ''));
        if ($windowsDir !== '') {
            $pyLauncher = $windowsDir . DIRECTORY_SEPARATOR . 'py.exe';
            if (is_file($pyLauncher)) {
                $candidates[] = [$pyLauncher, '-3'];
            }
        }

        $candidates[] = ['python'];
        $candidates[] = ['py', '-3'];
    } else {
        $candidates[] = ['python3'];
        $candidates[] = ['python'];
    }

    return $candidates;
}

function google_find_python(string $cwd): ?array {
    if (!function_exists('proc_open')) {
        return null;
    }

    foreach (google_python_candidates() as $candidate) {
        $result = google_run_process(
            array_merge($candidate, ['-c', 'import playwright, sys; print(sys.executable)']),
            $cwd,
            10
        );
        if (!$result['timed_out'] && (int)$result['exit_code'] === 0) {
            return $candidate;
        }
    }

    return null;
}

function google_scrape_reviews(string $sourceUrl, int $maxReviews = 6): array {
    if (!function_exists('proc_open')) {
        return ['ok' => false, 'message' => 'proc_open indisponivel neste servidor.'];
    }

    $projectDir = dirname(dirname(__DIR__));
    $scriptPath = $projectDir . DIRECTORY_SEPARATOR . 'scripts' . DIRECTORY_SEPARATOR . 'google_reviews_scrape.py';
    if (!is_file($scriptPath)) {
        return ['ok' => false, 'message' => 'Scraper do Google nao encontrado.'];
    }

    $python = google_find_python($projectDir);
    if ($python === null) {
        return ['ok' => false, 'message' => 'Python nao encontrado no servidor para consultar o Google.'];
    }

    $result = google_run_process(
        array_merge($python, [$scriptPath, $sourceUrl, (string)$maxReviews]),
        $projectDir,
        90
    );

    if ($result['timed_out']) {
        return ['ok' => false, 'message' => 'Tempo limite excedido ao consultar o Google.'];
    }

    $stdout = trim((string)$result['stdout']);
    if ($stdout === '') {
        return ['ok' => false, 'message' => 'O Google nao retornou dados publicos agora.'];
    }

    $payload = json_decode($stdout, true);
    if (!is_array($payload)) {
        return ['ok' => false, 'message' => 'Resposta invalida do scraper do Google.'];
    }

    return $payload;
}

$sourceUrl = trim((string)($_GET['url'] ?? ''));
if ($sourceUrl === '') {
    respond_json(['ok' => false, 'message' => 'URL nao informada'], 400);
}

$parts = parse_url($sourceUrl);
$scheme = strtolower((string)($parts['scheme'] ?? ''));
$host = strtolower((string)($parts['host'] ?? ''));
$allowedHosts = [
    'google.com',
    'www.google.com',
    'share.google',
    'maps.app.goo.gl',
    'g.page',
];
if ($scheme !== 'https' || !in_array($host, $allowedHosts, true)) {
    respond_json(['ok' => false, 'message' => 'Fonte nao permitida'], 400);
}

$cachePath = app_data_path('social/google-' . md5($sourceUrl) . '.json');
$cacheTtl = 43200;
$cached = google_cache_read($cachePath);
if (is_array($cached) && google_cache_fresh($cached, $cacheTtl)) {
    $cached['cached'] = true;
    respond_json($cached);
}

$parsed = google_scrape_reviews($sourceUrl, 6);
if (!empty($parsed['ok'])) {
    $parsed['cached'] = false;
    google_cache_write($cachePath, $parsed);
    respond_json($parsed);
}

if (is_array($cached)) {
    $cached['cached'] = true;
    $cached['stale'] = true;
    respond_json($cached);
}

respond_json([
    'ok' => false,
    'message' => $parsed['message'] ?? 'Nao foi possivel carregar as avaliacoes do Google agora.',
], 502);
