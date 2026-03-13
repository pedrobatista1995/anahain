<?php

$secureCookie = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
$scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
$cookiePath = '/';
if ($scriptName !== '') {
    $derivedPath = preg_replace('#/api(?:/.*)?$#', '', $scriptName);
    if (is_string($derivedPath) && $derivedPath !== '') {
        $cookiePath = rtrim($derivedPath, '/') . '/';
    }
}
session_set_cookie_params([
    'lifetime' => 0,
    'path' => $cookiePath,
    'domain' => '',
    'secure' => $secureCookie,
    'httponly' => true,
    'samesite' => 'Strict'
]);
session_start();

date_default_timezone_set('America/Sao_Paulo');

$dbDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$dbPath = $dbDir . DIRECTORY_SEPARATOR . 'app.sqlite';
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

$pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON');

function respond_json(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function require_post(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        respond_json(['ok' => false, 'message' => 'Metodo nao permitido'], 405);
    }
}

function require_get(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        respond_json(['ok' => false, 'message' => 'Metodo nao permitido'], 405);
    }
}

function require_auth(): void {
    if (empty($_SESSION['admin_user'])) {
        respond_json(['ok' => false, 'message' => 'Nao autenticado'], 401);
    }
}

function sanitize_phone(string $phone): string {
    return preg_replace('/\D+/', '', $phone) ?? '';
}

function get_client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function ensure_schema(PDO $pdo): void {
    global $dbPath;

    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS weekly_availability (
        day_of_week INTEGER PRIMARY KEY,
        is_enabled INTEGER NOT NULL DEFAULT 0,
        start_time TEXT,
        end_time TEXT
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_name TEXT NOT NULL,
        patient_email TEXT NOT NULL DEFAULT "",
        patient_phone TEXT NOT NULL,
        slot_start TEXT NOT NULL UNIQUE,
        slot_end TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT "confirmed",
        cancel_token_hash TEXT NOT NULL DEFAULT "",
        cancel_expires_at TEXT NOT NULL DEFAULT "",
        cancelled_at TEXT NOT NULL DEFAULT "",
        cancellation_source TEXT NOT NULL DEFAULT "",
        cancellation_reason TEXT NOT NULL DEFAULT "",
        created_at TEXT NOT NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS schedule_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_date TEXT NOT NULL UNIQUE,
        reason TEXT NOT NULL DEFAULT "",
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS medical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL UNIQUE,
        chief_complaint TEXT NOT NULL DEFAULT "",
        clinical_history TEXT NOT NULL DEFAULT "",
        examination_notes TEXT NOT NULL DEFAULT "",
        diagnosis TEXT NOT NULL DEFAULT "",
        conduct TEXT NOT NULL DEFAULT "",
        prescription_text TEXT NOT NULL DEFAULT "",
        follow_up TEXT NOT NULL DEFAULT "",
        private_notes TEXT NOT NULL DEFAULT "",
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS metrics (
        event_name TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS metric_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        metric_value INTEGER NOT NULL DEFAULT 1,
        occurred_at TEXT NOT NULL,
        year_month TEXT NOT NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        attempted_at INTEGER NOT NULL
    )');

    $userCount = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($userCount === 0) {
        $bootstrapUser = trim((string) (getenv('MEDICAL_ADMIN_USER') ?: 'medico'));
        if ($bootstrapUser === '') {
            $bootstrapUser = 'medico';
        }

        $bootstrapPass = (string) (getenv('MEDICAL_ADMIN_PASSWORD') ?: '');
        if ($bootstrapPass === '') {
            try {
                $bootstrapPass = rtrim(strtr(base64_encode(random_bytes(12)), '+/', '-_'), '=');
            } catch (Throwable $exception) {
                $bootstrapPass = 'DefinaMEDICAL_ADMIN_PASSWORD';
            }

            $bootstrapInfo = "username=" . $bootstrapUser . "\n"
                . "password=" . $bootstrapPass . "\n"
                . "created_at=" . date('c') . "\n";
            @file_put_contents($dbPath . '.initial-admin.txt', $bootstrapInfo);
        }

        $hash = password_hash($bootstrapPass, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (:u, :p, :c)');
        $stmt->execute([
            ':u' => $bootstrapUser,
            ':p' => $hash,
            ':c' => date('c')
        ]);
    }

    $defaults = [
        'slot_duration_minutes' => '60',
        'min_notice_hours' => '4',
        'max_days_ahead' => '120',
        'timezone' => 'America/Sao_Paulo',
        'clinic_name' => 'Tricologia',
        'doctor_name' => 'Dra. Ana Hain',
        'doctor_whatsapp' => '5541999487501',
        'doctor_email' => '',
        'public_base_url' => '',
        'smtp_host' => '',
        'smtp_port' => '587',
        'smtp_username' => '',
        'smtp_password' => '',
        'smtp_encryption' => 'tls',
        'smtp_from_email' => '',
        'smtp_from_name' => 'Tricologia',
        'cancellation_reasons' => "Reagendamento interno\nIndisponibilidade da agenda\nSolicitacao do paciente por telefone/WhatsApp"
    ];
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (:k, :v)');
    foreach ($defaults as $k => $v) {
        $stmt->execute([':k' => $k, ':v' => $v]);
    }

    $availabilityCount = (int) $pdo->query('SELECT COUNT(*) FROM weekly_availability')->fetchColumn();
    if ($availabilityCount === 0) {
        $insert = $pdo->prepare('INSERT INTO weekly_availability (day_of_week, is_enabled, start_time, end_time) VALUES (:d,:e,:s,:t)');
        for ($d = 0; $d <= 6; $d++) {
            $enabled = ($d >= 1 && $d <= 5) ? 1 : 0;
            $start = $enabled ? '09:00' : null;
            $end = $enabled ? '14:00' : null;
            $insert->execute([':d' => $d, ':e' => $enabled, ':s' => $start, ':t' => $end]);
        }
    }

    $colCheck = $pdo->query("PRAGMA table_info(bookings)")->fetchAll();
    $hasEmail = false;
    $hasCancelHash = false;
    $hasCancelExpires = false;
    $hasCancelledAt = false;
    $hasCancellationSource = false;
    $hasCancellationReason = false;
    foreach ($colCheck as $col) {
        $name = (string)($col['name'] ?? '');
        if ($name === 'patient_email') {
            $hasEmail = true;
        } elseif ($name === 'cancel_token_hash') {
            $hasCancelHash = true;
        } elseif ($name === 'cancel_expires_at') {
            $hasCancelExpires = true;
        } elseif ($name === 'cancelled_at') {
            $hasCancelledAt = true;
        } elseif ($name === 'cancellation_source') {
            $hasCancellationSource = true;
        } elseif ($name === 'cancellation_reason') {
            $hasCancellationReason = true;
        }
    }
    if (!$hasEmail) {
        $pdo->exec('ALTER TABLE bookings ADD COLUMN patient_email TEXT NOT NULL DEFAULT ""');
    }
    if (!$hasCancelHash) {
        $pdo->exec('ALTER TABLE bookings ADD COLUMN cancel_token_hash TEXT NOT NULL DEFAULT ""');
    }
    if (!$hasCancelExpires) {
        $pdo->exec('ALTER TABLE bookings ADD COLUMN cancel_expires_at TEXT NOT NULL DEFAULT ""');
    }
    if (!$hasCancelledAt) {
        $pdo->exec('ALTER TABLE bookings ADD COLUMN cancelled_at TEXT NOT NULL DEFAULT ""');
    }
    if (!$hasCancellationSource) {
        $pdo->exec('ALTER TABLE bookings ADD COLUMN cancellation_source TEXT NOT NULL DEFAULT ""');
    }
    if (!$hasCancellationReason) {
        $pdo->exec('ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT NOT NULL DEFAULT ""');
    }
}

function get_settings(PDO $pdo): array {
    $settings = [];
    $rows = $pdo->query('SELECT key, value FROM app_settings')->fetchAll();
    foreach ($rows as $row) {
        $settings[$row['key']] = $row['value'];
    }
    return $settings;
}

function get_weekly_availability(PDO $pdo): array {
    $rows = $pdo->query('SELECT day_of_week, is_enabled, start_time, end_time FROM weekly_availability ORDER BY day_of_week')->fetchAll();
    $data = [];
    foreach ($rows as $row) {
        $data[(int)$row['day_of_week']] = [
            'day_of_week' => (int)$row['day_of_week'],
            'is_enabled' => (int)$row['is_enabled'] === 1,
            'start_time' => $row['start_time'] ?? '',
            'end_time' => $row['end_time'] ?? ''
        ];
    }
    return $data;
}

function get_day_blocks(PDO $pdo, ?string $month = null): array {
    if ($month !== null && preg_match('/^\d{4}-\d{2}$/', $month)) {
        $stmt = $pdo->prepare('SELECT id, block_date, reason, created_at, updated_at
            FROM schedule_blocks
            WHERE substr(block_date, 1, 7) = :m
            ORDER BY block_date ASC');
        $stmt->execute([':m' => $month]);
        return $stmt->fetchAll();
    }

    return $pdo->query('SELECT id, block_date, reason, created_at, updated_at
        FROM schedule_blocks
        ORDER BY block_date ASC')->fetchAll();
}

function get_day_block_for_date(PDO $pdo, string $dateKey): ?array {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateKey)) {
        return null;
    }

    $stmt = $pdo->prepare('SELECT id, block_date, reason, created_at, updated_at
        FROM schedule_blocks
        WHERE block_date = :d
        LIMIT 1');
    $stmt->execute([':d' => $dateKey]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function is_valid_time(string $time): bool {
    return (bool) preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time);
}

function compute_day_capacity_from_rule(?array $dayRule, array $rules): int {
    if (!$dayRule || empty($dayRule['is_enabled'])) {
        return 0;
    }
    if (!is_valid_time((string)($dayRule['start_time'] ?? '')) || !is_valid_time((string)($dayRule['end_time'] ?? ''))) {
        return 0;
    }

    [$sh, $sm] = array_map('intval', explode(':', (string)$dayRule['start_time']));
    [$eh, $em] = array_map('intval', explode(':', (string)$dayRule['end_time']));
    $startMinutes = ($sh * 60) + $sm;
    $endMinutes = ($eh * 60) + $em;
    $duration = max(10, (int)($rules['slot_duration_minutes'] ?? 60));

    if ($endMinutes <= $startMinutes) {
        return 0;
    }

    return (int) floor(($endMinutes - $startMinutes) / $duration);
}

function compute_day_capacity(PDO $pdo, string $dateKey, array $rules, ?array $availability = null, ?array $blockMap = null): int {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateKey)) {
        return 0;
    }

    $availability = $availability ?? get_weekly_availability($pdo);
    $blockMap = $blockMap ?? [];
    if (isset($blockMap[$dateKey])) {
        return 0;
    }

    $tz = new DateTimeZone($rules['timezone'] ?? 'America/Sao_Paulo');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $dateKey, $tz);
    if (!$date) {
        return 0;
    }

    $dow = (int)$date->format('w');
    $dayRule = $availability[$dow] ?? null;
    return compute_day_capacity_from_rule($dayRule, $rules);
}

function increment_metric(PDO $pdo, string $eventName, int $increment = 1): void {
    $stmt = $pdo->prepare('INSERT INTO metrics (event_name, count) VALUES (:e, :c)
        ON CONFLICT(event_name) DO UPDATE SET count = count + :c2');
    $stmt->execute([':e' => $eventName, ':c' => $increment, ':c2' => $increment]);

    $eventStmt = $pdo->prepare('INSERT INTO metric_events (event_name, metric_value, occurred_at, year_month) VALUES (:e, :v, :o, :m)');
    $eventStmt->execute([
        ':e' => $eventName,
        ':v' => $increment,
        ':o' => date('c'),
        ':m' => date('Y-m')
    ]);
}

function load_metrics(PDO $pdo): array {
    $result = [];
    $rows = $pdo->query('SELECT event_name, count FROM metrics')->fetchAll();
    foreach ($rows as $row) {
        $result[$row['event_name']] = (int) $row['count'];
    }
    return $result;
}

function get_rules_from_settings(array $settings): array {
    return [
        'slot_duration_minutes' => max(10, min(240, (int)($settings['slot_duration_minutes'] ?? 60))),
        'min_notice_hours' => max(0, min(72, (int)($settings['min_notice_hours'] ?? 4))),
        'max_days_ahead' => max(1, min(365, (int)($settings['max_days_ahead'] ?? 120))),
        'timezone' => $settings['timezone'] ?? 'America/Sao_Paulo'
    ];
}

function compute_slots(PDO $pdo, array $rules): array {
    $tz = new DateTimeZone($rules['timezone']);
    $now = new DateTimeImmutable('now', $tz);
    $startBoundary = $now->modify('+' . $rules['min_notice_hours'] . ' hours');
    $endBoundary = $now->modify('+' . $rules['max_days_ahead'] . ' days')->setTime(23, 59, 59);

    $availability = get_weekly_availability($pdo);

    $bookedRows = $pdo->prepare('SELECT slot_start FROM bookings WHERE status = "confirmed" AND slot_start >= :s AND slot_start <= :e');
    $bookedRows->execute([
        ':s' => $startBoundary->format('c'),
        ':e' => $endBoundary->format('c')
    ]);
    $booked = [];
    foreach ($bookedRows->fetchAll() as $row) {
        $booked[$row['slot_start']] = true;
    }

    $blockMap = [];
    foreach (get_day_blocks($pdo) as $block) {
        $blockMap[(string)$block['block_date']] = $block;
    }

    $slots = [];
    $cursor = $now->setTime(0, 0, 0);
    while ($cursor <= $endBoundary) {
        $dateKey = $cursor->format('Y-m-d');
        if (isset($blockMap[$dateKey])) {
            $cursor = $cursor->modify('+1 day');
            continue;
        }

        $dow = (int) $cursor->format('w');
        $dayRule = $availability[$dow] ?? null;
        if ($dayRule && $dayRule['is_enabled']) {
            $startTime = $dayRule['start_time'];
            $endTime = $dayRule['end_time'];
            if (is_valid_time($startTime) && is_valid_time($endTime)) {
                [$sh, $sm] = array_map('intval', explode(':', $startTime));
                [$eh, $em] = array_map('intval', explode(':', $endTime));

                $dayStart = $cursor->setTime($sh, $sm, 0);
                $dayEnd = $cursor->setTime($eh, $em, 0);
                $slotStart = $dayStart;
                while ($slotStart < $dayEnd) {
                    $slotEnd = $slotStart->modify('+' . $rules['slot_duration_minutes'] . ' minutes');
                    if ($slotEnd > $dayEnd) {
                        break;
                    }

                    if ($slotStart >= $startBoundary && $slotStart <= $endBoundary) {
                        $iso = $slotStart->format('c');
                        if (empty($booked[$iso])) {
                            $slots[] = [
                                'slot_start' => $iso,
                                'slot_end' => $slotEnd->format('c'),
                                'date_key' => $dateKey,
                                'time_label' => $slotStart->format('H:i')
                            ];
                        }
                    }

                    $slotStart = $slotEnd;
                }
            }
        }
        $cursor = $cursor->modify('+1 day');
    }

    return $slots;
}

function is_slot_allowed(PDO $pdo, string $slotStartIso, array $rules): bool {
    $tz = new DateTimeZone($rules['timezone']);
    $slotStart = DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, $slotStartIso);
    if (!$slotStart) {
        return false;
    }
    $slotStart = $slotStart->setTimezone($tz);

    $now = new DateTimeImmutable('now', $tz);
    $minStart = $now->modify('+' . $rules['min_notice_hours'] . ' hours');
    $maxStart = $now->modify('+' . $rules['max_days_ahead'] . ' days')->setTime(23, 59, 59);

    if ($slotStart < $minStart || $slotStart > $maxStart) {
        return false;
    }

    if (get_day_block_for_date($pdo, $slotStart->format('Y-m-d'))) {
        return false;
    }

    $dow = (int)$slotStart->format('w');
    $availability = get_weekly_availability($pdo);
    $dayRule = $availability[$dow] ?? null;
    if (!$dayRule || !$dayRule['is_enabled']) {
        return false;
    }

    if (!is_valid_time($dayRule['start_time']) || !is_valid_time($dayRule['end_time'])) {
        return false;
    }

    [$sh, $sm] = array_map('intval', explode(':', $dayRule['start_time']));
    [$eh, $em] = array_map('intval', explode(':', $dayRule['end_time']));
    $dayStart = $slotStart->setTime($sh, $sm, 0);
    $dayEnd = $slotStart->setTime($eh, $em, 0);
    $slotEnd = $slotStart->modify('+' . $rules['slot_duration_minutes'] . ' minutes');

    if ($slotStart < $dayStart || $slotEnd > $dayEnd) {
        return false;
    }

    $minu = (int)$slotStart->format('i');
    $hour = (int)$slotStart->format('H');
    $totalMinutes = $hour * 60 + $minu;
    $startTotal = $sh * 60 + $sm;
    if ((($totalMinutes - $startTotal) % $rules['slot_duration_minutes']) !== 0) {
        return false;
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM bookings WHERE slot_start = :s AND status = "confirmed"');
    $stmt->execute([':s' => $slotStart->format('c')]);
    return ((int)$stmt->fetchColumn()) === 0;
}

function block_if_rate_limited(PDO $pdo, string $ip): void {
    $now = time();
    $windowStart = $now - 900;
    $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < :w')->execute([':w' => $windowStart]);
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = :ip AND attempted_at >= :w');
    $stmt->execute([':ip' => $ip, ':w' => $windowStart]);
    if ((int)$stmt->fetchColumn() >= 15) {
        respond_json(['ok' => false, 'message' => 'Muitas tentativas. Aguarde 15 minutos.'], 429);
    }
}

function register_login_attempt(PDO $pdo, string $ip): void {
    $stmt = $pdo->prepare('INSERT INTO login_attempts (ip, attempted_at) VALUES (:ip, :ts)');
    $stmt->execute([':ip' => $ip, ':ts' => time()]);
}

function app_base_url(array $settings): string {
    $manual = trim((string)($settings['public_base_url'] ?? ''));
    if ($manual !== '') {
        return rtrim($manual, '/');
    }

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $scheme = $isHttps ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
    $script = $_SERVER['SCRIPT_NAME'] ?? '/api/public/book.php';
    $basePath = preg_replace('#/api/public/[^/]+$#', '', $script);
    return $scheme . '://' . $host . rtrim((string)$basePath, '/');
}

function cancel_booking_with_notification(PDO $pdo, array $booking, string $reason, string $source = 'doctor'): void {
    $bookingId = (int)($booking['id'] ?? 0);
    if ($bookingId <= 0 || (string)($booking['status'] ?? '') !== 'confirmed') {
        return;
    }

    $reason = trim($reason);
    if ($reason === '') {
        $reason = 'Cancelado pela clínica.';
    }

    $upd = $pdo->prepare('UPDATE bookings
      SET status = "cancelled",
          cancelled_at = :c,
          cancellation_source = :s,
          cancellation_reason = :r
      WHERE id = :id AND status = "confirmed"');
    $upd->execute([
        ':c' => date('c'),
        ':s' => $source,
        ':r' => $reason,
        ':id' => $bookingId
    ]);

    if ($upd->rowCount() < 1) {
        return;
    }

    increment_metric($pdo, 'booking_cancelled', 1);
    if (str_starts_with($source, 'doctor')) {
        increment_metric($pdo, 'booking_cancelled_by_doctor', 1);
    }
    if ($source === 'doctor_block') {
        increment_metric($pdo, 'booking_cancelled_by_schedule_block', 1);
    }

    $settings = get_settings($pdo);
    $doctorName = trim((string)($settings['doctor_name'] ?? 'Médico'));
    $clinicName = trim((string)($settings['clinic_name'] ?? 'Clínica'));
    $doctorEmail = trim((string)($settings['doctor_email'] ?? ''));
    $rules = get_rules_from_settings($settings);

    $slotDate = DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, (string)($booking['slot_start'] ?? ''));
    $dayLabel = $slotDate
        ? $slotDate->setTimezone(new DateTimeZone($rules['timezone']))->format('d/m/Y H:i')
        : (string)($booking['slot_start'] ?? '');

    $subject = 'Consulta cancelada - ' . $clinicName;
    $body = "Olá, " . (string)($booking['patient_name'] ?? 'paciente') . ".\n\n" .
        "Sua consulta de " . $dayLabel . " foi cancelada pela clínica.\n" .
        "Motivo: " . $reason . "\n\n" .
        "Entre em contato para reagendar.\n" .
        $doctorName;

    send_email((string)($booking['patient_email'] ?? ''), $subject, $body, $doctorEmail !== '' ? $doctorEmail : null);
}

function send_email(string $to, string $subject, string $body, ?string $from = null): bool {
    global $pdo;
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $settings = get_settings($pdo);
    $smtpHost = trim((string)($settings['smtp_host'] ?? ''));
    $smtpPort = (int)($settings['smtp_port'] ?? 587);
    $smtpUser = trim((string)($settings['smtp_username'] ?? ''));
    $smtpPass = (string)($settings['smtp_password'] ?? '');
    $smtpEnc = strtolower(trim((string)($settings['smtp_encryption'] ?? 'tls')));
    $fromEmail = trim((string)($settings['smtp_from_email'] ?? ''));
    $fromName = trim((string)($settings['smtp_from_name'] ?? 'Tricologia'));

    if ($smtpHost !== '' && $smtpPort > 0 && $smtpUser !== '' && $smtpPass !== '' && filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        return smtp_send(
            $smtpHost,
            $smtpPort,
            $smtpUser,
            $smtpPass,
            $smtpEnc,
            $fromEmail,
            $fromName,
            $to,
            $subject,
            $body
        );
    }

    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/plain; charset=UTF-8',
    ];
    if ($from && filter_var($from, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'From: ' . $from;
    }
    return @mail($to, $subject, $body, implode("\r\n", $headers));
}

function smtp_send(
    string $host,
    int $port,
    string $username,
    string $password,
    string $encryption,
    string $fromEmail,
    string $fromName,
    string $toEmail,
    string $subject,
    string $body
): bool {
    $remote = $host . ':' . $port;
    $flags = STREAM_CLIENT_CONNECT;
    $context = stream_context_create([]);
    $fp = @stream_socket_client($remote, $errno, $errstr, 20, $flags, $context);
    if (!$fp) {
        return false;
    }

    stream_set_timeout($fp, 20);

    $read = function () use ($fp): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };

    $expect = function (array $codes) use ($read): bool {
        $resp = $read();
        if ($resp === '') return false;
        $code = (int)substr($resp, 0, 3);
        return in_array($code, $codes, true);
    };

    $write = function (string $cmd) use ($fp): bool {
        return fwrite($fp, $cmd . "\r\n") !== false;
    };

    if (!$expect([220])) { fclose($fp); return false; }
    if (!$write('EHLO localhost') || !$expect([250])) { fclose($fp); return false; }

    if ($encryption === 'tls') {
        if (!$write('STARTTLS') || !$expect([220])) { fclose($fp); return false; }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($fp); return false; }
        if (!$write('EHLO localhost') || !$expect([250])) { fclose($fp); return false; }
    }

    if (!$write('AUTH LOGIN') || !$expect([334])) { fclose($fp); return false; }
    if (!$write(base64_encode($username)) || !$expect([334])) { fclose($fp); return false; }
    if (!$write(base64_encode($password)) || !$expect([235])) { fclose($fp); return false; }

    if (!$write('MAIL FROM:<' . $fromEmail . '>') || !$expect([250])) { fclose($fp); return false; }
    if (!$write('RCPT TO:<' . $toEmail . '>') || !$expect([250, 251])) { fclose($fp); return false; }
    if (!$write('DATA') || !$expect([354])) { fclose($fp); return false; }

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $safeFromName = str_replace(["\r", "\n"], ' ', $fromName);
    $headers = [];
    $headers[] = 'From: ' . $safeFromName . ' <' . $fromEmail . '>';
    $headers[] = 'To: <' . $toEmail . '>';
    $headers[] = 'Subject: ' . $encodedSubject;
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: 8bit';

    $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    $message = str_replace("\r\n.", "\r\n..", $message);

    if (fwrite($fp, $message . "\r\n.\r\n") === false || !$expect([250])) { fclose($fp); return false; }
    $write('QUIT');
    fclose($fp);
    return true;
}

ensure_schema($pdo);
