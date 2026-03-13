<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();
require_auth();

$payload = request_json();
$rows = $payload['availability'] ?? null;
if (!is_array($rows)) {
    respond_json(['ok' => false, 'message' => 'Formato invalido de disponibilidade.'], 422);
}

$update = $pdo->prepare('UPDATE weekly_availability SET is_enabled = :e, start_time = :s, end_time = :t WHERE day_of_week = :d');

for ($d = 0; $d <= 6; $d++) {
    if ($d === 0 || $d === 6) {
        $update->execute([
            ':e' => 0,
            ':s' => '',
            ':t' => '',
            ':d' => $d,
        ]);
        continue;
    }

    $item = $rows[$d] ?? null;
    if (!is_array($item)) {
        $update->execute([
            ':e' => 0,
            ':s' => '',
            ':t' => '',
            ':d' => $d,
        ]);
        continue;
    }
    $enabled = !empty($item['is_enabled']) ? 1 : 0;
    $start = trim((string)($item['start_time'] ?? ''));
    $end = trim((string)($item['end_time'] ?? ''));

    if ($enabled) {
        if (!is_valid_time($start) || !is_valid_time($end) || $start >= $end) {
            respond_json(['ok' => false, 'message' => 'Horario invalido no dia ' . $d], 422);
        }
    } else {
        $start = '';
        $end = '';
    }

    $update->execute([
        ':e' => $enabled,
        ':s' => $start,
        ':t' => $end,
        ':d' => $d,
    ]);
}

respond_json(['ok' => true]);
