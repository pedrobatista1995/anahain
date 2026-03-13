<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();
require_auth();

$payload = request_json();
$dateKey = trim((string)($payload['block_date'] ?? ''));
$reason = trim((string)($payload['reason'] ?? ''));
$cancelExisting = !empty($payload['cancel_existing']);

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateKey)) {
    respond_json(['ok' => false, 'message' => 'Informe uma data válida para o bloqueio.'], 422);
}

if ($reason === '') {
    $reason = 'Indisponibilidade médica.';
}

$confirmedStmt = $pdo->prepare('SELECT id, patient_name, patient_email, patient_phone, slot_start, slot_end, status
    FROM bookings
    WHERE substr(slot_start, 1, 10) = :d
      AND status = "confirmed"
    ORDER BY slot_start ASC');
$confirmedStmt->execute([':d' => $dateKey]);
$confirmedBookings = $confirmedStmt->fetchAll();

if ($confirmedBookings && !$cancelExisting) {
    respond_json([
        'ok' => false,
        'message' => 'Existem consultas confirmadas neste dia. Marque a opção para cancelar os atendimentos antes de bloquear.'
    ], 409);
}

try {
    $pdo->beginTransaction();

    $upsert = $pdo->prepare('INSERT INTO schedule_blocks (block_date, reason, created_at, updated_at)
        VALUES (:d, :r, :c, :u)
        ON CONFLICT(block_date) DO UPDATE SET
          reason = excluded.reason,
          updated_at = excluded.updated_at');
    $upsert->execute([
        ':d' => $dateKey,
        ':r' => $reason,
        ':c' => date('c'),
        ':u' => date('c')
    ]);

    $cancelledCount = 0;
    foreach ($confirmedBookings as $booking) {
        cancel_booking_with_notification($pdo, $booking, $reason, 'doctor_block');
        $cancelledCount++;
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond_json(['ok' => false, 'message' => 'Falha ao bloquear o dia da agenda.'], 500);
}

respond_json([
    'ok' => true,
    'message' => $cancelledCount > 0
        ? 'Dia bloqueado e consultas canceladas com sucesso.'
        : 'Dia bloqueado com sucesso.',
    'cancelled_count' => $cancelledCount,
]);
