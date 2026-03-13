<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();
require_auth();

$payload = request_json();
$bookingId = (int)($payload['booking_id'] ?? 0);

if ($bookingId <= 0) {
    respond_json(['ok' => false, 'message' => 'Consulta inválida para salvar o prontuário.'], 422);
}

$bookingStmt = $pdo->prepare('SELECT id FROM bookings WHERE id = :id LIMIT 1');
$bookingStmt->execute([':id' => $bookingId]);
if (!$bookingStmt->fetch()) {
    respond_json(['ok' => false, 'message' => 'Consulta não encontrada.'], 404);
}

$record = [
    'booking_id' => $bookingId,
    'chief_complaint' => trim((string)($payload['chief_complaint'] ?? '')),
    'clinical_history' => trim((string)($payload['clinical_history'] ?? '')),
    'examination_notes' => trim((string)($payload['examination_notes'] ?? '')),
    'diagnosis' => trim((string)($payload['diagnosis'] ?? '')),
    'conduct' => trim((string)($payload['conduct'] ?? '')),
    'prescription_text' => trim((string)($payload['prescription_text'] ?? '')),
    'follow_up' => trim((string)($payload['follow_up'] ?? '')),
    'private_notes' => trim((string)($payload['private_notes'] ?? '')),
];

$now = date('c');
$stmt = $pdo->prepare('INSERT INTO medical_records (
        booking_id,
        chief_complaint,
        clinical_history,
        examination_notes,
        diagnosis,
        conduct,
        prescription_text,
        follow_up,
        private_notes,
        created_at,
        updated_at
    ) VALUES (
        :booking_id,
        :chief_complaint,
        :clinical_history,
        :examination_notes,
        :diagnosis,
        :conduct,
        :prescription_text,
        :follow_up,
        :private_notes,
        :created_at,
        :updated_at
    )
    ON CONFLICT(booking_id) DO UPDATE SET
        chief_complaint = excluded.chief_complaint,
        clinical_history = excluded.clinical_history,
        examination_notes = excluded.examination_notes,
        diagnosis = excluded.diagnosis,
        conduct = excluded.conduct,
        prescription_text = excluded.prescription_text,
        follow_up = excluded.follow_up,
        private_notes = excluded.private_notes,
        updated_at = excluded.updated_at');
$stmt->execute([
    ':booking_id' => $record['booking_id'],
    ':chief_complaint' => $record['chief_complaint'],
    ':clinical_history' => $record['clinical_history'],
    ':examination_notes' => $record['examination_notes'],
    ':diagnosis' => $record['diagnosis'],
    ':conduct' => $record['conduct'],
    ':prescription_text' => $record['prescription_text'],
    ':follow_up' => $record['follow_up'],
    ':private_notes' => $record['private_notes'],
    ':created_at' => $now,
    ':updated_at' => $now,
]);

$record['updated_at'] = $now;
$record['created_at'] = $now;

respond_json([
    'ok' => true,
    'message' => 'Prontuário salvo com sucesso.',
    'record' => $record,
]);
